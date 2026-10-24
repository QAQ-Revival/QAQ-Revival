"use strict";

const i18n = require("../../shared/i18n/core.cjs");
module.exports = {
  listCharacterDirectories,
  sortCharacterEntries,
  resolveCharacterEntry,
  resolveCharacterPath,
  resolveCanonicalCharacterInstallTarget,
  resolveCharacterModPath,
  resolveExistingStandardModDirectory,
  getCanonicalCharacterConfigKey,
  getCharacterStoreEntry,
  getCharacterConfigStoreValue,
  getCharacterModCacheKeys,
  trackCharacterUsage,
  ensureDefaultCharacterFolders,
  buildLegacyImportResponse,
  buildCharacterRefreshResponse,
  buildCharacterOrganizePreview
};
const path = require("path");
const fs = require("fs");
const charactersCatalog = require("./catalog.cjs");
const charactersCleanup = require("./cleanup.cjs");
const charactersFallbacks = require("./fallbacks.cjs");
const charactersHidden = require("./hidden.cjs");
const charactersImages = require("./images.cjs");
const charactersOrganization = require("./organization.cjs");
const charactersSkins = require("./skins.cjs");
const configStore = require("../config/store.cjs");
const gamesNevernessLoader = require("../games/neverness/loader.cjs");
const gamesSettings = require("../games/settings.cjs");
const modsNevernessPaks = require("../games/neverness/paks.cjs");
const systemPaths = require("../system/paths.cjs");
const systemWindows = require("../system/windows.cjs");
function mergeCharacterDirectoryStats(primaryStats, secondaryStats) {
  return {
    modCount: Number(primaryStats?.modCount || 0) + Number(secondaryStats?.modCount || 0),
    enabledCount: Number(primaryStats?.enabledCount || 0),
    fileCount: Number(primaryStats?.fileCount || 0) + Number(secondaryStats?.fileCount || 0),
    hasInfoJson: !!primaryStats?.hasInfoJson || !!secondaryStats?.hasInfoJson
  };
}
const CHARACTER_DIRECTORY_STATS_CACHE = new Map();
function getCharacterDirectoryStats(characterRootPath) {
  try {
    const entries = fs.readdirSync(characterRootPath, {
      withFileTypes: true
    });
    const stat = fs.statSync(characterRootPath);
    const cacheKey = `${gamesSettings.getActiveGameScopeId()}|${characterRootPath}|${stat.mtimeMs}|${entries.length}|${gamesNevernessLoader.isNevernessDx12Mode() ? "dx12" : "std"}`;
    if (CHARACTER_DIRECTORY_STATS_CACHE.has(cacheKey)) return CHARACTER_DIRECTORY_STATS_CACHE.get(cacheKey);
    const modDirs = entries.filter(entry => {
      if (!entry.isDirectory()) return false;
      if (gamesNevernessLoader.isNevernessDx12Mode()) {
        if (entry.name.startsWith(".")) return false;
        return modsNevernessPaks.hasShallowNevernessPakGroup(path.join(characterRootPath, entry.name));
      }
      return true;
    });
    const stats = {
      modCount: modDirs.length,
      enabledCount: modDirs.filter(entry => !entry.name.startsWith("DISABLED_")).length,
      fileCount: entries.length,
      hasInfoJson: entries.some(entry => entry.isFile() && /^info\.json$/i.test(entry.name))
    };
    CHARACTER_DIRECTORY_STATS_CACHE.set(cacheKey, stats);
    if (CHARACTER_DIRECTORY_STATS_CACHE.size > 800) CHARACTER_DIRECTORY_STATS_CACHE.clear();
    return stats;
  } catch (_) {
    return {
      modCount: 0,
      enabledCount: 0,
      fileCount: 0,
      hasInfoJson: false
    };
  }
}
function compareCharacterDirectoryEntries(left, right) {
  const score = entry => {
    const hasModsBonus = entry.modCount > 0 ? 1e5 : 0;
    const mappedBonus = entry.mapped ? 1e3 : 0;
    const infoBonus = entry.hasInfoJson ? 100 : 0;
    const fileBonus = entry.fileCount > 0 ? 10 : 0;
    return hasModsBonus + mappedBonus + infoBonus + fileBonus + entry.modCount;
  };
  const scoreDiff = score(left) - score(right);
  if (scoreDiff !== 0) return scoreDiff;
  if (left.enabledCount !== right.enabledCount) {
    return left.enabledCount - right.enabledCount;
  }
  const leftKey = charactersCatalog.normalizeCharacterFolderKey(left.diskName);
  const rightKey = charactersCatalog.normalizeCharacterFolderKey(right.diskName);
  return rightKey.localeCompare(leftKey);
}
function listCharacterDirectories(modsPath, gameId2 = gamesSettings.getActiveGameScopeId()) {
  const characterBasePath = modsNevernessPaks.getCharacterDirectoryBasePath(modsPath, gameId2);
  if (!characterBasePath || !fs.existsSync(characterBasePath)) return [];
  const entries = fs.readdirSync(characterBasePath, {
    withFileTypes: true
  });
  const foreignDefaults = getForeignDefaultCharacters(gameId2);
  const nevernessDx12Paths = gamesNevernessLoader.isNevernessDx12Mode(gameId2) ? gamesNevernessLoader.getNevernessDx12Paths(gameId2) : null;
  const deduped = new Map();
  entries.filter(entry => entry.isDirectory() && !entry.name.startsWith(".") && !charactersOrganization.isLegacyCharacterContainerName(entry.name) && !shouldHideForeignDefaultCharacterFolder(characterBasePath, entry.name, gameId2, foreignDefaults)).forEach(entry => {
    const mappingEntry = charactersCatalog.getCharacterMappingEntry(entry.name, gameId2);
    const characterRootPath = path.join(characterBasePath, entry.name);
    const disabledCharacterPath = nevernessDx12Paths ? modsNevernessPaks.getNevernessDx12DisabledCharacterPath(mappingEntry?.displayName || entry.name, nevernessDx12Paths, {
      gameId: gameId2
    }) : "";
    const stats = disabledCharacterPath && fs.existsSync(disabledCharacterPath) ? mergeCharacterDirectoryStats(getCharacterDirectoryStats(characterRootPath), getCharacterDirectoryStats(disabledCharacterPath)) : getCharacterDirectoryStats(characterRootPath);
    const characterEntry = {
      displayName: mappingEntry?.displayName || entry.name,
      diskName: entry.name,
      canonicalEnName: mappingEntry?.canonicalEnName || null,
      mapped: !!mappingEntry,
      characterRootPath,
      ...stats
    };
    const existing = deduped.get(characterEntry.displayName);
    if (!existing || compareCharacterDirectoryEntries(characterEntry, existing) > 0) {
      deduped.set(characterEntry.displayName, characterEntry);
    }
  });
  return Array.from(deduped.values());
}
function sortCharacterEntries(entries, gameId2 = gamesSettings.getActiveGameScopeId()) {
  const customOrder = Array.isArray(configStore.currentConfig.characterOrdersByGame?.[gameId2]) ? configStore.currentConfig.characterOrdersByGame[gameId2] : gameId2 === "endfield" && Array.isArray(configStore.currentConfig.characterOrder) ? configStore.currentConfig.characterOrder : [];
  const orderIndex = new Map(customOrder.map((name, index) => [charactersCatalog.normalizeCharacterFolderKey(name), index]));
  return [...entries].sort((left, right) => {
    const leftIndex = orderIndex.get(charactersCatalog.normalizeCharacterFolderKey(left.displayName));
    const rightIndex = orderIndex.get(charactersCatalog.normalizeCharacterFolderKey(right.displayName));
    const hasLeftIndex = Number.isInteger(leftIndex);
    const hasRightIndex = Number.isInteger(rightIndex);
    if (hasLeftIndex && hasRightIndex && leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }
    if (hasLeftIndex !== hasRightIndex) {
      return hasLeftIndex ? -1 : 1;
    }
    if (right.modCount !== left.modCount) return right.modCount - left.modCount;
    return left.displayName.localeCompare(right.displayName, "zh");
  });
}
function resolveCharacterEntryDirect(characterName, gameId2 = gamesSettings.getActiveGameScopeId()) {
  if (!charactersSkins.isSafeAppearancePathSegment(characterName)) return null;
  const modsPath = gamesSettings.getModsPath(gameId2);
  if (gameId2 === "arknights") require("../games/arknights/service.cjs").validateLibrary(modsPath);
  const characterBasePath = modsNevernessPaks.getCharacterDirectoryBasePath(modsPath, gameId2);
  if (!characterBasePath || !fs.existsSync(characterBasePath)) return null;
  const mappingEntry = charactersCatalog.getCharacterMappingEntry(characterName, gameId2);
  const candidates = [characterName, mappingEntry?.displayName, mappingEntry?.canonicalEnName, mappingEntry?.jasmName, ...(Array.isArray(mappingEntry?.aliases) ? mappingEntry.aliases : [])].map(name => String(name || "").trim()).filter(charactersSkins.isSafeAppearancePathSegment);
  const seen = new Set();
  for (const candidateName of candidates) {
    const key = charactersCatalog.normalizeCharacterFolderKey(candidateName);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const candidatePath = path.join(characterBasePath, candidateName);
    try {
      if (!fs.existsSync(candidatePath) || !fs.statSync(candidatePath).isDirectory()) continue;
    } catch (_) {
      continue;
    }
    const candidateMapping = charactersCatalog.getCharacterMappingEntry(candidateName, gameId2) || mappingEntry;
    return {
      displayName: candidateMapping?.displayName || candidateName,
      diskName: candidateName,
      canonicalEnName: candidateMapping?.canonicalEnName || null,
      mapped: !!candidateMapping,
      characterRootPath: candidatePath,
      ...getCharacterDirectoryStats(candidatePath)
    };
  }
  return null;
}
function resolveCharacterEntry(characterName, gameId2 = gamesSettings.getActiveGameScopeId()) {
  if (!charactersSkins.isSafeAppearancePathSegment(characterName)) return null;
  const modsPath = gamesSettings.getModsPath(gameId2);
  const characterBasePath = modsNevernessPaks.getCharacterDirectoryBasePath(modsPath, gameId2);
  if (!characterBasePath || !fs.existsSync(characterBasePath)) return null;
  const directResolved = resolveCharacterEntryDirect(characterName, gameId2);
  if (directResolved) return directResolved;
  const aliases = charactersCatalog.getCharacterAliasCandidates(characterName, gameId2);
  const aliasKeys = new Set(aliases.map(alias => charactersCatalog.normalizeCharacterFolderKey(alias)));
  const entries = listCharacterDirectories(modsPath, gameId2);
  const resolved = entries.find(entry => aliasKeys.has(charactersCatalog.normalizeCharacterFolderKey(entry.displayName)) || aliasKeys.has(charactersCatalog.normalizeCharacterFolderKey(entry.diskName)));
  if (resolved) return resolved;
  const directPath = path.join(characterBasePath, characterName);
  if (fs.existsSync(directPath)) {
    const mappingEntry = charactersCatalog.getCharacterMappingEntry(characterName, gameId2);
    return {
      displayName: mappingEntry?.displayName || characterName,
      diskName: characterName,
      canonicalEnName: mappingEntry?.canonicalEnName || null,
      mapped: !!mappingEntry,
      characterRootPath: directPath,
      ...getCharacterDirectoryStats(directPath)
    };
  }
  return null;
}
function resolveCharacterPath(characterName, gameId2 = gamesSettings.getActiveGameScopeId()) {
  return resolveCharacterEntry(characterName, gameId2)?.characterRootPath || null;
}
function resolveCanonicalCharacterInstallTarget(characterName, gameId2 = gamesSettings.getActiveGameScopeId(), {
  ensure = true
} = {}) {
  const rawName = charactersSkins.assertSafeAppearancePathSegment(characterName, i18n.t("backend.validation.characterName"));
  if (ensure) charactersHidden.assertCharacterVisible(rawName, gameId2);
  if (!rawName) return {
    characterName: "",
    characterPath: null
  };
  const canonicalCharacterName = charactersSkins.assertSafeAppearancePathSegment(getCanonicalCharacterConfigKey(rawName, gameId2), i18n.t("backend.validation.canonicalCharacterName"));
  if (gamesNevernessLoader.isNevernessDx12Mode(gameId2)) {
    return {
      characterName: canonicalCharacterName,
      characterPath: modsNevernessPaks.getNevernessDx12CharacterPath(canonicalCharacterName, {
        ensure,
        gameId: gameId2
      })
    };
  }
  const modsPath = gamesSettings.getModsPath(gameId2);
  const characterBasePath = modsNevernessPaks.getCharacterDirectoryBasePath(modsPath, gameId2, {
    ensure
  });
  if (gameId2 === "arknights") require("../games/arknights/service.cjs").validateLibrary(modsPath);
  if (!characterBasePath) {
    return {
      characterName: canonicalCharacterName,
      characterPath: null
    };
  }
  // GIMI collections commonly use aliases such as Ayaka or Raiden. Keep all
  // imports in the existing directory so detail/actions see the same Mods.
  const characterPath = (gameId2 === "genshin-impact" ? resolveCharacterPath(rawName, gameId2) : null) || path.join(characterBasePath, canonicalCharacterName);
  if (!systemPaths.isPathInsideDirectory(characterPath, characterBasePath)) {
    throw new Error(i18n.t("backend.characters.directories.invalidCharacterPath"));
  }
  if (ensure) {
    systemWindows.probeWritableDirectory(characterPath, i18n.t("backend.validation.characterDirectory", {
      canonicalCharacterName
    }));
  }
  return {
    characterName: canonicalCharacterName,
    characterPath
  };
}
function resolveCharacterModPath(characterName, modName, gameId2 = gamesSettings.getActiveGameScopeId()) {
  const safeModName = charactersSkins.assertSafeAppearancePathSegment(modName, i18n.t("backend.validation.modName"));
  const charPath = resolveCharacterPath(characterName, gameId2);
  if (!charPath) return null;
  const candidates = [path.join(charPath, safeModName), path.join(charPath, `DISABLED_${safeModName}`)];
  return candidates.find(candidate => fs.existsSync(candidate)) || candidates[0];
}
function resolveExistingStandardModDirectory(characterName, modName, gameId2 = gamesSettings.getActiveGameScopeId()) {
  const safeModName = charactersSkins.assertSafeAppearancePathSegment(modName, i18n.t("backend.validation.modName"));
  charactersOrganization.organizeLegacyCharacterFoldersIfNeeded(gameId2);
  const charPath = resolveCharacterPath(characterName, gameId2);
  if (!charPath) return null;
  const enabledPath = path.join(charPath, safeModName);
  if (fs.existsSync(enabledPath)) {
    return {
      charPath,
      modPath: enabledPath,
      folderName: safeModName,
      enabled: true
    };
  }
  const disabledFolderName = `DISABLED_${safeModName}`;
  const disabledPath = path.join(charPath, disabledFolderName);
  if (fs.existsSync(disabledPath)) {
    return {
      charPath,
      modPath: disabledPath,
      folderName: disabledFolderName,
      enabled: false
    };
  }
  return null;
}
function getCanonicalCharacterConfigKey(characterName, gameId2 = gamesSettings.getActiveGameScopeId()) {
  const mapping = charactersCatalog.getCharacterMappingEntry(characterName, gameId2);
  if (mapping) return mapping.displayName;
  const resolvedEntry = resolveCharacterEntry(characterName, gameId2);
  if (resolvedEntry?.displayName) return resolvedEntry.displayName;
  return characterName;
}
function getCharacterStoreEntry(store, characterName, gameId2 = gamesSettings.getActiveGameScopeId()) {
  if (!store || typeof store !== "object") {
    return {
      key: getCanonicalCharacterConfigKey(characterName, gameId2),
      value: void 0
    };
  }
  const resolvedEntry = resolveCharacterEntry(characterName, gameId2);
  const canonicalKey = resolvedEntry?.displayName || charactersCatalog.getCharacterMappingEntry(characterName, gameId2)?.displayName || characterName;
  const aliases = charactersCatalog.getCharacterAliasCandidates(characterName, gameId2, resolvedEntry);
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(store, alias)) {
      return {
        key: alias,
        value: store[alias],
        canonicalKey
      };
    }
  }
  const normalizedAliasKeys = new Set(aliases.map(alias => charactersCatalog.normalizeCharacterFolderKey(alias)));
  for (const key of Object.keys(store)) {
    if (normalizedAliasKeys.has(charactersCatalog.normalizeCharacterFolderKey(key))) {
      return {
        key,
        value: store[key],
        canonicalKey
      };
    }
  }
  return {
    key: canonicalKey,
    value: void 0,
    canonicalKey
  };
}
function moveCharacterStoreValueToCanonicalKey(store, characterName, gameId2 = gamesSettings.getActiveGameScopeId()) {
  if (!store || typeof store !== "object") return {
    key: getCanonicalCharacterConfigKey(characterName, gameId2),
    value: void 0
  };
  const {
    key,
    value,
    canonicalKey
  } = getCharacterStoreEntry(store, characterName, gameId2);
  if (key && canonicalKey && key !== canonicalKey && value !== void 0) {
    store[canonicalKey] = value;
    delete store[key];
    configStore.saveConfig(configStore.currentConfig);
    return {
      key: canonicalKey,
      value,
      canonicalKey
    };
  }
  return {
    key: canonicalKey || key,
    value,
    canonicalKey: canonicalKey || key
  };
}
function getCharacterConfigStoreValue(store, characterName, fallbackValue, gameId2 = gamesSettings.getActiveGameScopeId()) {
  const {
    key,
    value,
    canonicalKey
  } = moveCharacterStoreValueToCanonicalKey(store, characterName, gameId2);
  return {
    key: canonicalKey || key,
    value: value !== void 0 ? value : fallbackValue
  };
}
function getCharacterModCacheKeys(characterName, modName, gameId2 = gamesSettings.getActiveGameScopeId()) {
  return charactersCatalog.getCharacterAliasCandidates(characterName, gameId2, resolveCharacterEntry(characterName, gameId2)).map(alias => `${gameId2 === "genshin-impact" ? "genshin-impact/" : ""}${alias}/${modName}`);
}
function trackCharacterUsage(characterName, gameId2 = gamesSettings.getActiveGameScopeId()) {
  if (!configStore.currentConfig.characterUsage) configStore.currentConfig.characterUsage = {};
  const canonicalCharacterName = getCanonicalCharacterConfigKey(characterName, gameId2);
  configStore.currentConfig.characterUsage[canonicalCharacterName] = Date.now();
  configStore.saveConfig(configStore.currentConfig);
  return canonicalCharacterName;
}
function getForeignDefaultCharacters(gameId2) {
  const ownDefaults = new Set(charactersCatalog.getDefaultCharactersForGame(gameId2));
  const foreignDefaults = new Set();
  Object.entries(charactersFallbacks.FALLBACK_DEFAULT_CHARACTERS_BY_GAME).forEach(([targetGameId]) => {
    const characters = charactersCatalog.getDefaultCharactersForGame(targetGameId);
    if (targetGameId === gameId2) return;
    characters.forEach(characterName => {
      if (!ownDefaults.has(characterName)) {
        foreignDefaults.add(characterName);
      }
    });
  });
  return foreignDefaults;
}
function shouldHideForeignDefaultCharacterFolder(modsPath, characterName, gameId2 = gamesSettings.getActiveGameScopeId(), foreignDefaults = getForeignDefaultCharacters(gameId2)) {
  if (!foreignDefaults.has(characterName)) return false;
  const charDir = path.join(modsPath, characterName);
  if (!fs.existsSync(charDir)) return false;
  try {
    const entries = fs.readdirSync(charDir, {
      withFileTypes: true
    });
    const hasNestedFolders = entries.some(entry => entry.isDirectory());
    if (hasNestedFolders) return false;
    const hasInfoJson = entries.some(entry => entry.isFile() && /^info\.json$/i.test(entry.name));
    if (hasInfoJson) return false;
    return true;
  } catch (_) {
    return false;
  }
}
function ensureDefaultCharacterFolders(modsPath, gameId2 = gamesSettings.getActiveGameScopeId()) {
  if (gameId2 === "arknights") require("../games/arknights/service.cjs").validateLibrary(modsPath);
  const characterBasePath = modsNevernessPaks.getCharacterDirectoryBasePath(modsPath, gameId2, {
    ensure: true
  });
  if (!characterBasePath) return {
    createdCount: 0,
    copiedCoverCount: 0
  };
  if (!fs.existsSync(characterBasePath)) fs.mkdirSync(characterBasePath, {
    recursive: true
  });
  const existingEntries = listCharacterDirectories(modsPath, gameId2);
  const existingByKey = new Map();
  existingEntries.forEach(entry => {
    charactersCatalog.getCharacterAliasCandidates(entry.displayName, gameId2, entry).forEach(alias => {
      existingByKey.set(charactersCatalog.normalizeCharacterFolderKey(alias), entry);
    });
    existingByKey.set(charactersCatalog.normalizeCharacterFolderKey(entry.diskName), entry);
  });
  let createdCount = 0;
  let copiedCoverCount = 0;
  charactersCatalog.getDefaultCharactersForGame(gameId2).forEach(charName => {
    if (charactersHidden.isCharacterHidden(charName, gameId2)) return;
    const existingEntry = existingByKey.get(charactersCatalog.normalizeCharacterFolderKey(charName));
    const charDir = existingEntry?.characterRootPath || path.join(characterBasePath, charName);
    if (!fs.existsSync(charDir)) {
      fs.mkdirSync(charDir, {
        recursive: true
      });
      createdCount += 1;
    }
  });
  return {
    createdCount,
    copiedCoverCount
  };
}
function bootstrapDefaultCharacterFoldersIfSafe(modsPath, gameId2 = gamesSettings.getActiveGameScopeId()) {
  const characterBasePath = modsNevernessPaks.getCharacterDirectoryBasePath(modsPath, gameId2, {
    ensure: gamesNevernessLoader.isNevernessDx12Mode(gameId2)
  });
  if (!characterBasePath || !fs.existsSync(characterBasePath)) {
    return {
      bootstrapped: false,
      createdCharacters: []
    };
  }
  const beforeNames = new Set(listCharacterDirectories(modsPath, gameId2).map(entry => entry.displayName));
  if (!gamesNevernessLoader.isNevernessDx12Mode(gameId2) && charactersOrganization.shouldDeferDefaultCharacterBootstrap(modsPath, gameId2)) {
    return {
      bootstrapped: false,
      createdCharacters: []
    };
  }
  ensureDefaultCharacterFolders(modsPath, gameId2);
  const afterNames = listCharacterDirectories(modsPath, gameId2).map(entry => entry.displayName);
  const createdCharacters = afterNames.filter(name => !beforeNames.has(name));
  return {
    bootstrapped: true,
    createdCharacters
  };
}
function getCharacterListResponse(modsPath, gameId2 = gamesSettings.getActiveGameScopeId(), {
  ensureDefaults = false
} = {}) {
  if (ensureDefaults && gamesNevernessLoader.isNevernessDx12Mode(gameId2)) ensureDefaultCharacterFolders(modsPath, gameId2);
  const characters = sortCharacterEntries(listCharacterDirectories(modsPath, gameId2), gameId2).filter(entry => !charactersHidden.isCharacterHidden(entry.displayName, gameId2)).map(entry => ({
    name: entry.displayName,
    modCount: entry.modCount,
    enabledCount: entry.enabledCount,
    skinCount: charactersSkins.getCharacterOfficialSkinCount(entry.displayName, gameId2),
    coverUrl: charactersImages.getCharacterCoverUrl(entry.displayName, gameId2, entry),
    searchTerms: charactersCatalog.getCharacterAliasCandidates(entry.displayName, gameId2, entry)
  }));
  return {
    characters,
    hiddenCount: charactersHidden.hiddenCharacters.list(gameId2).length
  };
}
function buildLegacyImportResponse(modsPath, gameId2 = gamesSettings.getActiveGameScopeId()) {
  return charactersOrganization.buildImportPreview(charactersOrganization.scanImportCandidates(modsPath, gameId2), modsPath);
}
function buildCharacterRefreshResponse(modsPath, gameId2 = gamesSettings.getActiveGameScopeId()) {
  // Force a disk read, including nested Pak state whose parent mtime may not change.
  CHARACTER_DIRECTORY_STATS_CACHE.clear();
  return getCharacterListResponse(modsPath, gameId2, {
    ensureDefaults: false
  });
}
function buildCharacterOrganizePreview(modsPath, gameId2 = gamesSettings.getActiveGameScopeId()) {
  return {
    legacyImport: charactersOrganization.previewOrganization(modsPath, gameId2),
    looseRootFolders: charactersCleanup.scanLooseRootModFolders(modsPath, gameId2),
    misplacedModFolders: charactersCleanup.scanMisplacedModFolders(modsPath, gameId2)
  };
}
Object.assign(module.exports, {
  CHARACTER_DIRECTORY_STATS_CACHE
});
