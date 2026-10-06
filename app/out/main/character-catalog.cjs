const path = require('node:path');
const { readJsonFileSync, writeJsonFileSync } = require('./json-store.cjs');

const SOURCES = {
  'wuthering-waves': ['https://api.encore.moe/zh-Hans/character', 'https://api.encore.moe/en/character'],
  zzz: ['https://raw.githubusercontent.com/EnkaNetwork/API-docs/master/store/zzz/avatars.json', 'https://raw.githubusercontent.com/EnkaNetwork/API-docs/master/store/zzz/locs.json'],
  'honkai-star-rail': ['https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/index_new/cn/characters.json', 'https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/index_new/en/characters.json'],
  endfield: ['https://endfield.hypergryph.com/operator'],
  'neverness-to-everness': ['https://wiki.mysqil.com/characters/']
};
const RESOURCE_DIRS = { 'wuthering-waves': 'wuwa', zzz: 'zzz', 'honkai-star-rail': 'honkai-star-rail', endfield: 'endfield', 'neverness-to-everness': 'neverness-to-everness' };
const CATEGORIES = new Set(['NPC', '其他', 'UI', '功能', '大世界', '武器', '载具', '滑翔翼', '光锥']);
const safeName = value => typeof value === 'string' && value.length > 0 && value.length <= 100 && !/[<>:"/\\|?*\x00-\x1f]/.test(value) && !/[. ]$/.test(value) && !/^(\.{1,2}|CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(value);
function imageUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    const hosts = ['api.encore.moe', 'enka.network', 'raw.githubusercontent.com', 'web.hycdn.cn', 'wiki.mysqil.com', 'static.wikia.nocookie.net'];
    return hosts.includes(url.hostname) ? url.href : null;
  } catch { return null; }
}
const decode = value => String(value || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim();
function normalizeRecords(records) {
  if (!Array.isArray(records) || records.length > 2000) throw Error('Invalid character list');
  const valid = records.filter(item => item && safeName(item.name)).map(item => ({
    name: item.name, en: typeof item.en === 'string' ? item.en.slice(0, 100) : '',
    aliases: Array.isArray(item.aliases) ? item.aliases.filter(safeName).slice(0, 16) : [],
    image: imageUrl(item.image)
  }));
  if (valid.length < 5) throw Error('Character source returned too few valid entries');
  return valid;
}
function parseSource(gameId, texts) {
  let records;
  if (gameId === 'wuthering-waves') {
    const english = new Map(JSON.parse(texts[1]).roleList.map(item => [item.Id, item.Name]));
    records = JSON.parse(texts[0]).roleList.filter(item => !item.Name.startsWith('漂泊者')).map(item => ({
      name: item.Name === '西格莉卡' ? '希格莉卡' : item.Name, en: english.get(item.Id), image: item.RoleHeadIcon,
      aliases: item.Name === '西格莉卡' ? [item.Name] : []
    }));
  } else if (gameId === 'zzz') {
    const loc = JSON.parse(texts[1]);
    records = Object.values(JSON.parse(texts[0])).map(item => ({
      name: loc['zh-cn']?.[item.Name]?.replace(/[「」]/g, ''), en: loc.en?.[item.Name], image: new URL(item.Image, 'https://enka.network').href
    }));
  } else if (gameId === 'honkai-star-rail') {
    const english = JSON.parse(texts[1]);
    const variants = { '1001': '三月七-存护', '1224': '三月七-巡猎', '1213': '丹恒-饮月', '1414': '丹恒-腾荒' };
    records = Object.values(JSON.parse(texts[0])).filter(item => !item.name.includes('{')).map(item => ({
      name: variants[item.id] || item.name, en: english[item.id]?.name,
      image: new URL(item.preview || item.icon, 'https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/').href
    }));
  } else if (gameId === 'endfield') {
    records = [...texts[0].matchAll(/background-image:url\((https:[^)]+)\)[\s\S]*?OperatorItem_nameText[^>]*>([^<]+)<[\s\S]*?OperatorItem_codename[^>]*>\/\/ ([^<]+)</g)]
      .map(match => ({ name: decode(match[2]), en: decode(match[3]), image: decode(match[1]) }))
      .filter(item => item.name !== '管理员');
  } else if (gameId === 'neverness-to-everness') {
    const aliases = { '埃德嘉': '埃德加', '法帝娅': '法蒂亚', '达芙蒂尔': '达芙迪尔', '灵可': '凛子', '黑羽': '黑鸟' };
    records = [...texts[0].matchAll(/<img\b[^>]*src="(\/images\/characters\/[^"]+)"[^>]*alt="([^"]+)"/g)]
      .map(match => ({ name: aliases[decode(match[2])] || decode(match[2]), aliases: [decode(match[2])], image: new URL(match[1], SOURCES[gameId][0]).href }))
      .filter(item => item.name !== '零');
  } else throw Error('Unsupported character source');
  return normalizeRecords(records);
}
async function fetchCharacters(gameId, fetchFn = fetch) {
  if (!Object.hasOwn(SOURCES, gameId)) throw Error('Unsupported game');
  const texts = await Promise.all(SOURCES[gameId].map(async url => {
    const response = await fetchFn(url, { signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw Error(`Character source returned HTTP ${response.status}`);
    if (Number(response.headers.get('content-length')) > 4 * 1024 * 1024) throw Error('Character source too large');
    const reader = response.body.getReader();
    const chunks = []; let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 4 * 1024 * 1024) throw Error('Character source too large');
        chunks.push(Buffer.from(value));
      }
    } finally { await reader.cancel(); }
    return Buffer.concat(chunks).toString('utf8');
  }));
  return parseSource(gameId, texts);
}
function mergeCharacters(base, records) {
  const defaults = [...(base.defaultCharacters || [])];
  const mappings = { ...base.manualMappings };
  const images = { ...base.characterImages };
  const pairs = [...(base.characterNameMap?.pairs || [])];
  for (const item of normalizeRecords(records)) {
    const alias = item.en && mappings[item.en.toLowerCase()];
    const pair = item.en && pairs.find(entry => String(entry.en || '').toLowerCase() === item.en.toLowerCase());
    const name = defaults.includes(item.name) ? item.name : alias?.displayName || pair?.zh || item.name;
    if (!safeName(name)) continue;
    if (!defaults.includes(name)) {
      const index = defaults.findIndex(value => CATEGORIES.has(value));
      defaults.splice(index < 0 ? defaults.length : index, 0, name);
    }
    if (item.image) images[name] = item.image;
    for (const key of [item.name, item.en, ...item.aliases].filter(Boolean)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key.toLowerCase())) continue;
      if (!Object.hasOwn(mappings, key.toLowerCase())) mappings[key.toLowerCase()] = { displayName: name, canonicalEnName: item.en || name };
    }
    if (item.en && !pairs.some(entry => entry.zh === name)) pairs.push({ zh: name, en: item.en, jasmName: item.en });
  }
  return { ...base, defaultCharacters: defaults, manualMappings: mappings, characterImages: images, characterNameMap: { ...base.characterNameMap, pairs } };
}
function createCharacterCatalogService({ cacheDir, fetchFn = fetch, onUpdate = () => {}, now = Date.now }) {
  const loaded = new Map(), pending = new Map(), attempted = new Map();
  function read(gameId) {
    if (!Object.hasOwn(SOURCES, gameId)) return null;
    if (loaded.has(gameId)) return loaded.get(gameId);
    let cache = null;
    try {
      const parsed = readJsonFileSync(path.join(cacheDir, gameId + '.json'));
      if (parsed.gameId === gameId && Number.isFinite(parsed.checkedAt) && parsed.checkedAt <= now()) {
        cache = { ...parsed, records: normalizeRecords(parsed.records) };
      }
    } catch { /* Offline and first-run fallback uses the bundled text catalog. */ }
    loaded.set(gameId, cache);
    return cache;
  }
  function refresh(gameId, force = false) {
    if (!Object.hasOwn(SOURCES, gameId)) return Promise.resolve({ success: false, error: '此游戏暂无在线角色资料源' });
    if (pending.has(gameId)) return pending.get(gameId);
    const cached = read(gameId);
    if (!force && ((cached && now() - cached.checkedAt < 86400000) || (attempted.has(gameId) && now() - attempted.get(gameId) < 3600000))) return Promise.resolve({ success: true, updated: false });
    attempted.set(gameId, now());
    const request = (async () => {
      try {
        const records = await fetchCharacters(gameId, fetchFn);
        const next = { schemaVersion: 1, gameId, checkedAt: now(), records };
        const file = path.join(cacheDir, gameId + '.json');
        writeJsonFileSync(file, next);
        loaded.set(gameId, next);
        const changed = JSON.stringify(cached?.records) !== JSON.stringify(records);
        if (changed) onUpdate(gameId);
        return { success: true, updated: changed, count: records.length };
      } catch (error) { return { success: false, error: `角色资料更新失败，已保留原有资料：${error.message}` }; }
      finally { pending.delete(gameId); }
    })();
    pending.set(gameId, request);
    return request;
  }
  return { refresh, merge: (gameId, base) => { const cache = read(gameId); return cache ? mergeCharacters(base, cache.records) : base; } };
}
module.exports = { SOURCES, RESOURCE_DIRS, imageUrl, normalizeRecords, parseSource, fetchCharacters, mergeCharacters, createCharacterCatalogService };
