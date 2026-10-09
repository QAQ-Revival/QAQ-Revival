const path = require('node:path');
const { readJsonFileSync, writeJsonFileSync } = require('./json-store.cjs');
const { imageUrl } = require('./character-catalog.cjs');
const { fetchSkinCatalog } = require('./character-skin-sources.cjs');
const SUPPORTED = new Set(['genshin-impact', 'wuthering-waves', 'zzz', 'honkai-star-rail', 'neverness-to-everness']);
const key = value => String(value || '').replace(/_/g, ' ').trim().toLowerCase();
const unique = values => [...new Set(values.filter(Boolean))];
const count = catalog => (catalog.characters || []).reduce((total, character) => total + (character.skins || []).length, 0);
function sourceKey(value) {
  try { const url = new URL(value); return url.host + key(decodeURIComponent(url.pathname)); } catch { return ''; }
}
function validateCatalog(catalog, gameId) {
  if (catalog?.gameId !== gameId || !Array.isArray(catalog.characters) || !catalog.characters.length || catalog.characters.length > 1000) throw Error('外观目录格式无效');
  let total = 0;
  const ids = new Set();
  for (const character of catalog.characters) {
    if (!(character.nameZh || character.nameEn) || !Array.isArray(character.skins)) throw Error('外观所属角色无效');
    for (const skin of character.skins) {
      if (!/^[a-z0-9][a-z0-9._-]{0,140}$/i.test(skin.id) || skin.sectionId !== 'skin:' + skin.id || ids.has(skin.id) || !(skin.nameZh || skin.nameEn)) throw Error('外观标识无效或重复');
      if (!imageUrl(skin.sourceImageUrl || skin.image)) throw Error('外观图片地址无效');
      ids.add(skin.id);
      if (++total > 4000) throw Error('外观目录过大');
    }
  }
  if (!total) throw Error('外观目录为空，保留原有资料');
  return catalog;
}
function mergeSkinCatalog(base, incoming) {
  const result = structuredClone(base);
  result.characters ||= [];
  for (const next of incoming.characters || []) {
    const names = [next.nameZh, next.nameEn, ...(next.aliases || [])].map(key).filter(Boolean);
    let target = result.characters.find(character => next.nameZh && key(character.nameZh) === key(next.nameZh)) ||
      result.characters.find(character => next.nameEn && key(character.nameEn) === key(next.nameEn));
    if (!target) {
      const candidates = result.characters.filter(character => [character.nameZh, character.nameEn, ...(character.aliases || [])].some(name => names.includes(key(name))));
      if (candidates.length === 1) target = candidates[0];
    }
    if (!target) { target = { ...next, skins: [] }; result.characters.push(target); }
    target.aliases = unique([...(target.aliases || []), ...names, next.nameZh, next.nameEn]);
    for (const skin of next.skins) {
      const previous = target.skins.find(item => item.id === skin.id ||
        (skin.sourceFashionId && item.sourceFashionId === skin.sourceFashionId) ||
        (!skin.sourceFashionId && !item.sourceFashionId && (
          (sourceKey(skin.sourcePageUrl) && sourceKey(item.sourcePageUrl) === sourceKey(skin.sourcePageUrl)) ||
          (skin.nameEn && key(item.nameEn) === key(skin.nameEn)) || (skin.nameZh && key(item.nameZh) === key(skin.nameZh)))));
      if (previous) {
        const stable = { id: previous.id, sectionId: previous.sectionId };
        const aliases = unique([...(previous.aliases || []), ...(skin.aliases || []), previous.nameZh, previous.nameEn]);
        Object.assign(previous, skin, stable, { aliases, nameZh: skin.nameZh || previous.nameZh, nameEn: skin.nameEn || previous.nameEn });
      } else target.skins.push(structuredClone(skin));
    }
  }
  // Never remove entries: source outages, renamed pages and delisted skins must not orphan assigned Mods.
  result.source = incoming.source || result.source;
  return result;
}
function createCharacterSkinCatalogService({ cacheDir, fetchFn = fetch, fetchCatalog = fetchSkinCatalog, onUpdate = () => {} }) {
  const loaded = new Map(), pending = new Map();
  function read(gameId) {
    if (!SUPPORTED.has(gameId)) return null;
    if (!loaded.has(gameId)) {
      let catalog = null;
      try { catalog = validateCatalog(readJsonFileSync(path.join(cacheDir, gameId + '.json')).catalog, gameId); } catch { /* Use bundled art metadata offline or on first run. */ }
      loaded.set(gameId, catalog);
    }
    return loaded.get(gameId);
  }
  function merge(gameId, base) {
    const cached = read(gameId);
    return cached ? mergeSkinCatalog(base, cached) : base;
  }
  function refresh(gameId, base, config) {
    if (!SUPPORTED.has(gameId)) return Promise.resolve({ success: false, unsupported: true, error: '此游戏暂无可靠的在线外观目录，已保留内置资料' });
    if (pending.has(gameId)) return pending.get(gameId);
    const request = (async () => {
      try {
        const current = merge(gameId, base);
        const incoming = validateCatalog(await fetchCatalog(gameId, current, config, fetchFn), gameId);
        const next = validateCatalog(mergeSkinCatalog(current, incoming), gameId);
        writeJsonFileSync(path.join(cacheDir, gameId + '.json'), { schemaVersion: 1, gameId, checkedAt: Date.now(), catalog: next });
        loaded.set(gameId, next);
        onUpdate(gameId);
        return { success: true, added: count(next) - count(current), count: count(next) };
      } catch (error) { return { success: false, error: `外观资料更新失败，已保留原有目录：${error.message}` }; }
      finally { pending.delete(gameId); }
    })();
    pending.set(gameId, request);
    return request;
  }
  return { merge, refresh };
}
module.exports = { createCharacterSkinCatalogService, mergeSkinCatalog, validateCatalog };
