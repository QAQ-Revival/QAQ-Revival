"use strict";

module.exports = {
  initialize,
  getGameCharacterResourceDir,
  getCharacterConfigForGame,
  getDefaultCharactersForGame,
  normalizeCharacterFolderKey,
  getBundledResourceCandidates,
  getCharacterMappingEntry,
  getCharacterAliasCandidates,
  get characterImageCache() {
    return characterImageCache;
  },
  get characterCatalogService() {
    return characterCatalogService;
  }
};
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const {
  createCharacterCatalogService
} = require("./catalog-source.cjs");
const {
  createCharacterImageCache
} = require("./image-cache.cjs");
const charactersFallbacks = require("./fallbacks.cjs");
const charactersSkins = require("./skins.cjs");
const coreLogger = require("../core/logger.cjs");
const gamesSettings = require("../games/settings.cjs");
const CHARACTER_NAME_LOOKUP_CACHE = new Map();
let characterImageCache;
let characterCatalogService;
function getGameCharacterResourceDir(gameId2 = gamesSettings.getActiveGameScopeId()) {
  return {
    "genshin-impact": "genshin-impact",
    endfield: "endfield",
    zzz: "zzz",
    "wuthering-waves": "wuwa",
    "neverness-to-everness": "neverness-to-everness",
    "honkai-star-rail": "honkai-star-rail"
  }[gameId2] || null;
}
function getCharacterConfigForGame(gameId2 = gamesSettings.getActiveGameScopeId()) {
  const cacheKey = `config:${gameId2}`;
  if (CHARACTER_NAME_LOOKUP_CACHE.has(cacheKey)) {
    return CHARACTER_NAME_LOOKUP_CACHE.get(cacheKey);
  }
  const fallbackConfig = {
    defaultCharacters: charactersFallbacks.FALLBACK_DEFAULT_CHARACTERS_BY_GAME[gameId2] || [],
    manualMappings: charactersFallbacks.FALLBACK_MANUAL_CHARACTER_MAPPINGS_BY_GAME[gameId2] || {},
    characterNameMap: {
      pairs: []
    }
  };
  const resourceDir = getGameCharacterResourceDir(gameId2);
  if (!resourceDir) {
    CHARACTER_NAME_LOOKUP_CACHE.set(cacheKey, fallbackConfig);
    return fallbackConfig;
  }
  const candidates = [...getBundledResourceCandidates("games", resourceDir, "character-config.json"), ...getBundledResourceCandidates(resourceDir, "character-config.json")];
  for (const candidate of candidates) {
    try {
      if (!candidate || !fs.existsSync(candidate)) continue;
      const parsed = JSON.parse(fs.readFileSync(candidate, "utf-8"));
      const config = characterCatalogService.merge(gameId2, {
        defaultCharacters: Array.isArray(parsed?.defaultCharacters) ? parsed.defaultCharacters.map(item => String(item || "").trim()).filter(Boolean) : fallbackConfig.defaultCharacters,
        manualMappings: parsed?.manualMappings && typeof parsed.manualMappings === "object" ? parsed.manualMappings : fallbackConfig.manualMappings,
        characterNameMap: parsed?.characterNameMap && typeof parsed.characterNameMap === "object" ? parsed.characterNameMap : fallbackConfig.characterNameMap,
        characterImages: parsed?.characterImages || {}
      });
      CHARACTER_NAME_LOOKUP_CACHE.set(cacheKey, config);
      return config;
    } catch (error) {
      coreLogger.logger.warn(`Failed to load character config from ${candidate}:`, error?.message || error);
    }
  }
  CHARACTER_NAME_LOOKUP_CACHE.set(cacheKey, fallbackConfig);
  return fallbackConfig;
}
function getDefaultCharactersForGame(gameId2) {
  return getCharacterConfigForGame(gameId2).defaultCharacters || [];
}
function normalizeCharacterFolderKey(name) {
  return String(name || "").trim().toLowerCase();
}
function getBundledResourceCandidates(...segments) {
  return [path.join(electron.app.getAppPath(), "resources", ...segments), path.join(process.resourcesPath || "", ...segments), path.join(path.dirname(electron.app.getAppPath()), "resources", ...segments)];
}
function getCharacterNameMapForGame(gameId2 = gamesSettings.getActiveGameScopeId()) {
  const cacheKey = `map:${gameId2}`;
  if (CHARACTER_NAME_LOOKUP_CACHE.has(cacheKey)) {
    return CHARACTER_NAME_LOOKUP_CACHE.get(cacheKey);
  }
  const characterNameMap = getCharacterConfigForGame(gameId2).characterNameMap;
  const pairs = Array.isArray(characterNameMap?.pairs) ? characterNameMap.pairs : [];
  CHARACTER_NAME_LOOKUP_CACHE.set(cacheKey, pairs);
  return pairs;
}
function buildCharacterNameLookup(gameId2 = gamesSettings.getActiveGameScopeId()) {
  const cacheKey = `lookup:${gameId2}`;
  if (CHARACTER_NAME_LOOKUP_CACHE.has(cacheKey)) {
    return CHARACTER_NAME_LOOKUP_CACHE.get(cacheKey);
  }
  const byDisplayKey = new Map();
  const byDiskKey = new Map();
  const pairs = getCharacterNameMapForGame(gameId2);
  pairs.forEach(pair => {
    const displayName = String(pair?.zh || "").trim();
    const canonicalEnName = String(pair?.en || "").trim();
    const jasmName = String(pair?.jasmName || "").trim();
    const aliases = Array.isArray(pair?.aliases) ? pair.aliases.map(alias => String(alias || "").trim()).filter(Boolean) : [];
    if (!displayName || !canonicalEnName) return;
    const entry = {
      gameId: gameId2,
      displayName,
      canonicalEnName,
      jasmName: jasmName || null,
      displayKey: normalizeCharacterFolderKey(displayName),
      canonicalEnKey: normalizeCharacterFolderKey(canonicalEnName),
      aliases
    };
    byDisplayKey.set(entry.displayKey, entry);
    byDiskKey.set(entry.canonicalEnKey, entry);
    if (jasmName) {
      byDiskKey.set(normalizeCharacterFolderKey(jasmName), entry);
    }
    entry.aliases.forEach(alias => {
      byDiskKey.set(normalizeCharacterFolderKey(alias), entry);
    });
  });
  const lookup = {
    byDisplayKey,
    byDiskKey
  };
  CHARACTER_NAME_LOOKUP_CACHE.set(cacheKey, lookup);
  return lookup;
}
function getManualCharacterMappingEntry(name, gameId2 = gamesSettings.getActiveGameScopeId()) {
  const normalizedKey = normalizeCharacterFolderKey(name);
  if (!normalizedKey) return null;
  const manualEntry = getCharacterConfigForGame(gameId2).manualMappings?.[normalizedKey];
  if (!manualEntry) return null;
  return {
    gameId: gameId2,
    displayName: manualEntry.displayName,
    canonicalEnName: manualEntry.canonicalEnName,
    displayKey: normalizeCharacterFolderKey(manualEntry.displayName),
    canonicalEnKey: normalizeCharacterFolderKey(manualEntry.canonicalEnName),
    aliases: []
  };
}
function mergeCharacterMappingAliases(entry, gameId2 = gamesSettings.getActiveGameScopeId()) {
  if (!entry?.displayName && !entry?.canonicalEnName) return entry;
  const lookup = buildCharacterNameLookup(gameId2);
  const candidates = [entry.displayName, entry.canonicalEnName, entry.jasmName, ...(Array.isArray(entry.aliases) ? entry.aliases : [])];
  const mergedAliases = new Set(Array.isArray(entry.aliases) ? entry.aliases.filter(Boolean) : []);
  let mappedJasmName = entry.jasmName || null;
  for (const candidate of candidates) {
    const key = normalizeCharacterFolderKey(candidate);
    if (!key) continue;
    const mapped = lookup.byDisplayKey.get(key) || lookup.byDiskKey.get(key);
    if (!mapped) continue;
    if (!mappedJasmName && mapped.jasmName) mappedJasmName = mapped.jasmName;
    [mapped.displayName, mapped.canonicalEnName, mapped.jasmName].forEach(alias => {
      if (alias) mergedAliases.add(alias);
    });
    if (Array.isArray(mapped.aliases)) {
      mapped.aliases.forEach(alias => {
        if (alias) mergedAliases.add(alias);
      });
    }
  }
  return {
    ...entry,
    jasmName: mappedJasmName,
    aliases: Array.from(mergedAliases)
  };
}
function getCharacterMappingEntry(name, gameId2 = gamesSettings.getActiveGameScopeId()) {
  const normalizedKey = normalizeCharacterFolderKey(name);
  if (!normalizedKey) return null;
  const manualEntry = getManualCharacterMappingEntry(name, gameId2);
  if (manualEntry) return mergeCharacterMappingAliases(manualEntry, gameId2);
  const lookup = buildCharacterNameLookup(gameId2);
  const mappedEntry = lookup.byDisplayKey.get(normalizedKey) || lookup.byDiskKey.get(normalizedKey) || null;
  return mappedEntry ? mergeCharacterMappingAliases(mappedEntry, gameId2) : null;
}
function getCharacterAliasCandidates(characterName, gameId2 = gamesSettings.getActiveGameScopeId(), resolvedEntry = null) {
  const aliases = [];
  const addAlias = value => {
    const normalized = String(value || "").trim();
    if (!normalized || aliases.includes(normalized)) return;
    aliases.push(normalized);
  };
  addAlias(characterName);
  addAlias(charactersSkins.getPersistedCharacterSkinCatalogIdentity(characterName, gameId2));
  const mappingEntry = getCharacterMappingEntry(characterName, gameId2);
  if (mappingEntry) {
    addAlias(mappingEntry.displayName);
    addAlias(mappingEntry.canonicalEnName);
    if (mappingEntry.jasmName) addAlias(mappingEntry.jasmName);
    if (Array.isArray(mappingEntry.aliases)) {
      mappingEntry.aliases.forEach(addAlias);
    }
  }
  if (resolvedEntry) {
    addAlias(resolvedEntry.displayName);
    addAlias(resolvedEntry.diskName);
    addAlias(resolvedEntry.canonicalEnName);
  }
  return aliases;
}
function initialize() {
  characterImageCache = createCharacterImageCache({
    cacheDir: path.join(electron.app.getPath("userData"), "character-image-cache"),
    fetchFn: (...args) => electron.net.fetch(...args),
    onCacheError: error => coreLogger.logger.warn("Character image cache unavailable:", error.code || error.message)
  });
  characterCatalogService = createCharacterCatalogService({
    cacheDir: path.join(electron.app.getPath("userData"), "character-catalogs"),
    fetchFn: (...args) => electron.net.fetch(...args),
    onUpdate: () => CHARACTER_NAME_LOOKUP_CACHE.clear()
  });
}
