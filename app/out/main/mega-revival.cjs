'use strict';
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const pbkdf2 = promisify(crypto.pbkdf2);
function protectedPayload(url) {
  const payload = url.hash.match(/^#P!([A-Za-z0-9_-]+)$/);
  if (!payload || url.pathname !== '/') return null;
  const bytes = Buffer.from(payload[1], 'base64url');
  if (![0, 1, 2].includes(bytes[0]) || ![0, 1].includes(bytes[1]) || bytes.length !== (bytes[1] === 0 ? 88 : 104) || bytes.toString('base64url') !== payload[1]) throw new Error('MEGA 密码保护链接无效或加密格式暂不支持');
  return bytes;
}
function parseMegaLink(input, suppliedKey = '') {
  let url;
  try { url = new URL(String(input || '').trim().replace(/^mega:\/\//i, 'https://mega.nz/')); }
  catch { throw new Error('MEGA 链接无效'); }
  if (!['https:', 'http:'].includes(url.protocol) || !/^(www\.)?mega\.(nz|co\.nz|io)$/i.test(url.hostname) || url.username || url.password || url.port) throw new Error('只支持 MEGA 分享链接');
  const protectedBytes = protectedPayload(url);
  if (protectedBytes) return { type: 'protected', linkType: protectedBytes[1] === 0 ? 'folder' : 'file', needsKey: false, needsPassword: true, url: 'https://mega.nz/' + url.hash };
  let type, id, key, selection = '';
  const modern = url.pathname.match(/^\/(file|folder)\/([\w-]{8})\/?$/);
  const legacy = url.hash.match(/^#(F)?!([\w-]{8})(?:!([\w-]+))?(?:([!?])([\w-]{8}))?$/i);
  if (modern) {
    [, type, id] = modern;
    const parts = url.hash.slice(1).split('/');
    key = parts.shift() || '';
    if (parts.length) {
      if (type !== 'folder' || parts.length !== 2 || !['file', 'folder'].includes(parts[0]) || !/^[\w-]{8}$/.test(parts[1])) throw new Error('MEGA 子文件链接无效');
      selection = '/' + parts.join('/');
    }
  } else if (legacy) {
    type = legacy[1] ? 'folder' : 'file'; id = legacy[2]; key = legacy[3] || '';
    if (legacy[5]) selection = '/' + (legacy[4] === '?' ? 'folder' : 'file') + '/' + legacy[5];
  } else {
    // Revival also understands its encrypted enc/enc2/fenc/fenc2/elc containers.
    const encrypted = String(input || '').trim();
    if (/^mega:\/\/(?:f?enc2?|elc)\?[A-Za-z0-9_!/?=+%-]{1,12000}$/i.test(encrypted)) {
      return { type: 'encrypted', url: encrypted, needsKey: false };
    }
    throw new Error('暂不支持该 MEGA 链接格式');
  }
  key = key || String(suppliedKey).trim();
  if (key && !new RegExp(`^[\\w-]{${type === 'file' ? 43 : 22}}$`).test(key)) throw new Error('MEGA 解密密钥长度不正确，请检查链接是否完整');
  return { type, id, needsKey: !key, url: `https://mega.nz/${type}/${id}${key ? '#' + key + selection : ''}` };
}

function extractMegaLinks(content) {
  const text = String(content || '').replace(/&amp;/gi, '&').replace(/&#(?:35|x23);/gi, '#').replace(/&#(?:33|x21);/gi, '!');
  const candidates = text.match(/(?:https?:\/\/(?:www\.)?mega\.(?:co\.nz|nz|io)\/|mega:\/\/)[^\s<>"'，。；）)\]]+/gi) || [];
  const links = new Map();
  for (const candidate of candidates) {
    try { const link = parseMegaLink(candidate.replace(/[.,;:]+$/, '')); links.set(link.url, link); } catch { /* Ignore malformed URLs. */ }
  }
  return [...links.values()];
}

// MEGA's documented password link format: js/ui/export.js in meganz/webclient.
// Passwords are used only in memory; only the resulting normal share is queued.
async function unlockMegaLink(input, password) {
  const parsed = parseMegaLink(input);
  if (!parsed.needsPassword) return parsed;
  if (typeof password !== 'string' || !password.trim()) throw new Error('此 MEGA 链接受密码保护，请填写作者提供的密码');
  if (password.length > 1024) throw new Error('MEGA 链接密码过长');
  const bytes = protectedPayload(new URL(parsed.url));
  const keyLength = bytes[1] === 0 ? 16 : 32;
  const derived = await pbkdf2(password.trim(), bytes.subarray(8, 40), bytes[0] === 0 ? 1000 : 100000, 64, 'sha512');
  try {
    const data = bytes.subarray(0, bytes.length - 32), macKey = derived.subarray(32);
    const mac = bytes[0] === 1 ? crypto.createHmac('sha256', data).update(macKey).digest() : crypto.createHmac('sha256', macKey).update(data).digest();
    if (!crypto.timingSafeEqual(mac, bytes.subarray(-32))) throw new Error('MEGA 密码不正确或链接已损坏');
    const key = Buffer.alloc(keyLength);
    for (let i = 0; i < keyLength; i++) key[i] = bytes[40 + i] ^ derived[i];
    return parseMegaLink(`https://mega.nz/${bytes[1] === 0 ? 'folder' : 'file'}/${bytes.subarray(2, 8).toString('base64url')}#${key.toString('base64url')}`);
  } finally { derived.fill(0); }
}
module.exports = { parseMegaLink, extractMegaLinks, unlockMegaLink };
