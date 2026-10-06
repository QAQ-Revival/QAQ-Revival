'use strict';
function parseMegaLink(input, suppliedKey = '') {
  let url;
  try { url = new URL(String(input || '').trim().replace(/^mega:\/\//i, 'https://mega.nz/')); }
  catch { throw new Error('MEGA 链接无效'); }
  if (!['https:', 'http:'].includes(url.protocol) || !/^(www\.)?mega\.(nz|co\.nz|io)$/i.test(url.hostname) || url.username || url.password || url.port) throw new Error('只支持 MEGA 分享链接');
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

module.exports = { parseMegaLink, extractMegaLinks };
