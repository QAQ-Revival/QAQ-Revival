"use strict";

const i18n = require("../../shared/i18n/core.cjs");
module.exports = {
  containsChineseCharacter,
  scanLooseRootModFolders,
  scanMisplacedModFolders,
  quarantineLooseRootModFolders,
  moveMisplacedModFolders
};
const path = require("path");
const fs = require("fs");
const charactersCatalog = require("./catalog.cjs");
const charactersDirectories = require("./directories.cjs");
const charactersOrganization = require("./organization.cjs");
const coreLogger = require("../core/logger.cjs");
const desktopNotifications = require("../desktop/notifications.cjs");
const gamesSettings = require("../games/settings.cjs");
const modsConflicts = require("../mods/conflicts.cjs");
const systemFiles = require("../system/files.cjs");
const LOOSE_ROOT_IGNORE_KEYS = new Set(["character", "characters", "shaderfixes", "shaderfix", "buffer", "buffers", "resources", "resource", "qaqm", "mods", "npc", "ui", "功能", "大世界", "world", "openworld", "overworld", "weapon", "weapons", "武器", "vehicle", "vehicles", "载具", "lightcone", "lightcones", "光椎", "光锥"]);
const LOOSE_CHARACTER_RESOURCE_DIR_KEYS = new Set(["mesh", "meshes", "texture", "textures", "resource", "resources", "shader", "shaders", "shaderfix", "shaderfixes", "buffer", "buffers", "buf", "paks", "pak"]);
function isIgnoredLooseCharacterFile(fileName) {
  const normalized = String(fileName || "").trim().toLowerCase();
  if (!normalized || normalized.startsWith(".")) return true;
  if (normalized === "desktop.ini" || normalized === "thumbs.db") return true;
  if (/^_cover\.(png|jpg|jpeg|webp|gif|bmp)$/i.test(fileName)) return true;
  if (/^\.qaqm-/i.test(fileName)) return true;
  return false;
}
function isLooseCharacterFile(fileName) {
  if (isIgnoredLooseCharacterFile(fileName)) return false;
  const normalized = String(fileName || "").trim().toLowerCase();
  const ext = path.extname(normalized);
  if (normalized === "tags.json" || normalized === "meta.json" || normalized === "mod.json") return true;
  if (normalized === "preview.png" || normalized === "preview.jpg" || normalized === "preview.jpeg") return true;
  if (normalized.endsWith(".ini") || /\.ini_.*\.bak$/i.test(fileName)) return true;
  return [".dds", ".buf", ".ib", ".vb", ".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif"].includes(ext);
}
function isLooseCharacterResourceDir(dirName) {
  const key = charactersCatalog.normalizeCharacterFolderKey(String(dirName || "").replace(/^DISABLED_/i, ""));
  return !!key && LOOSE_CHARACTER_RESOURCE_DIR_KEYS.has(key);
}
function containsChineseCharacter(value) {
  return /[\u3400-\u9fff\uf900-\ufaff]/.test(String(value || ""));
}
function isGeneratedLooseQuarantineDir(dirName) {
  return /^DISABLED_loose-(root|files)-/i.test(String(dirName || ""));
}
function createLooseItemId(scope, type, name, prefix = "") {
  return [scope, prefix, type, name].filter(Boolean).join(":");
}
function normalizeLooseAliasText(value) {
  return String(value || "").replace(/^DISABLED_/i, "").normalize("NFKC").trim().toLowerCase();
}
function compactLooseAliasText(value) {
  return normalizeLooseAliasText(value).replace(/[\s_\-.'"`·•()[\]{}【】（）<>《》:：|\\/]+/g, "");
}
function getLooseFolderNamePrefixCandidates(value) {
  const normalized = normalizeLooseAliasText(value);
  const candidates = [normalized];
  const prefix = normalized.split(/[\s_\-.'"`·•()[\]{}【】（）<>《》:：|\\/]+/)[0];
  if (prefix && prefix !== normalized) candidates.push(prefix);
  return Array.from(new Set(candidates.map(compactLooseAliasText).filter(Boolean)));
}
function getCharacterMoveAliasEntries(gameId2 = gamesSettings.getActiveGameScopeId()) {
  const entries = [];
  const seen = new Set();
  for (const characterName of charactersCatalog.getDefaultCharactersForGame(gameId2)) {
    const mappingEntry = charactersCatalog.getCharacterMappingEntry(characterName, gameId2);
    const displayName = mappingEntry?.displayName || characterName;
    if (!displayName || displayName === "其他") continue;
    for (const alias of charactersCatalog.getCharacterAliasCandidates(characterName, gameId2)) {
      const normalizedAlias = normalizeLooseAliasText(alias);
      const compactAlias = compactLooseAliasText(alias);
      if (!compactAlias) continue;
      if (!containsChineseCharacter(alias) && compactAlias.length < 3) continue;
      const key = `${displayName}:${compactAlias}`;
      if (seen.has(key)) continue;
      seen.add(key);
      entries.push({
        characterName: displayName,
        alias,
        normalizedAlias,
        compactAlias,
        hasChinese: containsChineseCharacter(alias),
        score: compactAlias.length
      });
    }
  }
  return entries.sort((left, right) => right.score - left.score);
}
function isAliasLikelyInFolderName(folderName, aliasEntry) {
  const compactPrefixes = getLooseFolderNamePrefixCandidates(folderName);
  if (!compactPrefixes.length || !aliasEntry?.compactAlias) return false;
  if (aliasEntry.hasChinese) {
    if (aliasEntry.compactAlias.length === 1) {
      return compactPrefixes.some(prefix => prefix === aliasEntry.compactAlias);
    }
    return compactPrefixes.some(prefix => prefix.startsWith(aliasEntry.compactAlias));
  }
  return compactPrefixes.some(prefix => prefix.startsWith(aliasEntry.compactAlias));
}
function detectMisplacedModTarget(folderName, sourceCharacterName = "", gameId2 = gamesSettings.getActiveGameScopeId()) {
  const sourceDisplayName = sourceCharacterName ? charactersOrganization.getKnownCharacterDisplayName(sourceCharacterName, gameId2) || sourceCharacterName : "";
  const sourceKey = charactersCatalog.normalizeCharacterFolderKey(sourceDisplayName);
  const matches = getCharacterMoveAliasEntries(gameId2).filter(aliasEntry => isAliasLikelyInFolderName(folderName, aliasEntry));
  if (!matches.length) return null;
  const target = matches.find(match => charactersCatalog.normalizeCharacterFolderKey(match.characterName) !== sourceKey);
  if (!target) return null;
  return {
    characterName: target.characterName,
    matchedAlias: target.alias
  };
}
function createMisplacedItemId(sourceCharacterName, targetCharacterName, name) {
  return createLooseItemId("misplaced", "directory", name, `${sourceCharacterName || "Mods 根目录"}>${targetCharacterName}`);
}
function scanLooseCharacterEntries(characterPath, characterName = "", gameId2 = gamesSettings.getActiveGameScopeId()) {
  const entries = [];
  try {
    for (const entry of fs.readdirSync(characterPath, {
      withFileTypes: true
    })) {
      if (entry.name.startsWith(".")) continue;
      const fullPath = path.join(characterPath, entry.name);
      if (entry.isFile()) {
        if (isLooseCharacterFile(entry.name)) {
          entries.push({
            id: createLooseItemId("character", "file", entry.name, characterName),
            name: entry.name,
            path: fullPath,
            relativePath: entry.name,
            type: "file",
            reason: "loose-file",
            defaultSelected: true
          });
        }
        continue;
      }
      if (!entry.isDirectory() || isGeneratedLooseQuarantineDir(entry.name)) continue;
      if (!systemFiles.directoryHasAnyFile(fullPath)) continue;
      if (isLooseCharacterResourceDir(entry.name)) {
        entries.push({
          id: createLooseItemId("character", "directory", entry.name, characterName),
          name: entry.name,
          path: fullPath,
          relativePath: entry.name,
          type: "directory",
          reason: "resource-directory",
          defaultSelected: true
        });
        continue;
      }
      if (detectMisplacedModTarget(entry.name, characterName, gameId2)) continue;
      if (!containsChineseCharacter(entry.name)) {
        entries.push({
          id: createLooseItemId("character", "directory", entry.name, characterName),
          name: entry.name,
          path: fullPath,
          relativePath: entry.name,
          type: "directory",
          reason: "non-chinese-folder",
          defaultSelected: true
        });
      }
    }
  } catch (_) {}
  return entries;
}
function getKnownCharacterPrefixDisplayName(folderName, gameId2 = gamesSettings.getActiveGameScopeId()) {
  const normalizedName = charactersCatalog.normalizeCharacterFolderKey(String(folderName || "").replace(/^DISABLED_/i, ""));
  if (!normalizedName) return null;
  for (const characterName of charactersCatalog.getDefaultCharactersForGame(gameId2)) {
    const aliases = charactersCatalog.getCharacterAliasCandidates(characterName, gameId2);
    for (const alias of aliases) {
      const aliasKey = charactersCatalog.normalizeCharacterFolderKey(alias);
      if (aliasKey && normalizedName.startsWith(aliasKey) && normalizedName !== aliasKey) {
        return charactersDirectories.getCanonicalCharacterConfigKey(characterName, gameId2);
      }
    }
  }
  return null;
}
function scanLooseRootModFolders(modsPath, gameId2 = gamesSettings.getActiveGameScopeId()) {
  const result = {
    success: true,
    hasLooseFolders: false,
    count: 0,
    folders: [],
    rootFolders: [],
    rootFiles: [],
    rootFolderCount: 0,
    rootLooseFileCount: 0,
    characterGroups: [],
    characterLooseItemCount: 0,
    targetCharacterName: charactersDirectories.getCanonicalCharacterConfigKey("其他", gameId2)
  };
  if (!modsPath || !fs.existsSync(modsPath)) return result;
  let entries = [];
  try {
    entries = fs.readdirSync(modsPath, {
      withFileTypes: true
    });
  } catch (error) {
    return {
      ...result,
      success: false,
      error: error?.message || String(error)
    };
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (entry.isFile()) {
      if (isLooseCharacterFile(entry.name)) {
        result.rootFiles.push({
          id: createLooseItemId("root", "file", entry.name),
          name: entry.name,
          path: path.join(modsPath, entry.name),
          relativePath: entry.name,
          type: "file",
          reason: "root-file",
          defaultSelected: true
        });
      }
      continue;
    }
    if (!entry.isDirectory()) continue;
    const key = charactersCatalog.normalizeCharacterFolderKey(entry.name);
    if (!key || LOOSE_ROOT_IGNORE_KEYS.has(key)) continue;
    if (charactersOrganization.isLegacyCharacterContainerName(entry.name)) continue;
    const fullPath = path.join(modsPath, entry.name);
    const knownCharacterName = charactersOrganization.getKnownCharacterDisplayName(entry.name, gameId2);
    if (knownCharacterName) {
      const looseEntries = scanLooseCharacterEntries(fullPath, knownCharacterName, gameId2);
      if (looseEntries.length > 0) {
        result.characterGroups.push({
          characterName: knownCharacterName,
          path: fullPath,
          relativePath: entry.name,
          itemCount: looseEntries.length,
          items: looseEntries
        });
        result.characterLooseItemCount += looseEntries.length;
      }
      continue;
    }
    if (!systemFiles.directoryHasAnyFile(fullPath)) continue;
    const suggestedCharacterName = getKnownCharacterPrefixDisplayName(entry.name, gameId2);
    const rootItem = {
      id: createLooseItemId("root", "directory", entry.name),
      name: entry.name,
      path: fullPath,
      relativePath: entry.name,
      type: "directory",
      reason: "root-folder",
      suggestedCharacterName,
      defaultSelected: true
    };
    result.rootFolders.push(rootItem);
    result.folders.push(rootItem);
  }
  result.rootFolderCount = result.rootFolders.length;
  result.rootLooseFileCount = result.rootFiles.length;
  result.count = result.rootFolderCount + result.rootLooseFileCount + result.characterLooseItemCount;
  result.hasLooseFolders = result.count > 0;
  return result;
}
function scanMisplacedModFolders(modsPath, gameId2 = gamesSettings.getActiveGameScopeId()) {
  const result = {
    success: true,
    hasMisplacedFolders: false,
    count: 0,
    rootCount: 0,
    characterCount: 0,
    groups: []
  };
  if (!modsPath || !fs.existsSync(modsPath)) return result;
  const groupsByTarget = new Map();
  const addItem = (target, item) => {
    if (!target?.characterName || !item?.path) return;
    const targetName = target.characterName;
    if (!groupsByTarget.has(targetName)) {
      groupsByTarget.set(targetName, {
        targetCharacterName: targetName,
        itemCount: 0,
        items: []
      });
    }
    const group = groupsByTarget.get(targetName);
    group.items.push({
      ...item,
      id: createMisplacedItemId(item.sourceCharacterName, targetName, item.name),
      targetCharacterName: targetName,
      matchedAlias: target.matchedAlias,
      defaultSelected: true
    });
    group.itemCount += 1;
    result.count += 1;
    if (item.sourceCharacterName) result.characterCount += 1;else result.rootCount += 1;
  };
  let entries = [];
  try {
    entries = fs.readdirSync(modsPath, {
      withFileTypes: true
    });
  } catch (error) {
    return {
      ...result,
      success: false,
      error: error?.message || String(error)
    };
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".") || isGeneratedLooseQuarantineDir(entry.name)) {
      continue;
    }
    const key = charactersCatalog.normalizeCharacterFolderKey(entry.name);
    if (!key || LOOSE_ROOT_IGNORE_KEYS.has(key) || charactersOrganization.isLegacyCharacterContainerName(entry.name)) {
      continue;
    }
    const fullPath = path.join(modsPath, entry.name);
    const knownCharacterName = charactersOrganization.getKnownCharacterDisplayName(entry.name, gameId2);
    if (knownCharacterName) {
      let childEntries = [];
      try {
        childEntries = fs.readdirSync(fullPath, {
          withFileTypes: true
        });
      } catch (_) {
        childEntries = [];
      }
      for (const child of childEntries) {
        if (!child.isDirectory() || child.name.startsWith(".") || isGeneratedLooseQuarantineDir(child.name)) {
          continue;
        }
        if (isLooseCharacterResourceDir(child.name)) continue;
        const childPath = path.join(fullPath, child.name);
        if (!systemFiles.directoryHasAnyFile(childPath)) continue;
        const target = detectMisplacedModTarget(child.name, knownCharacterName, gameId2);
        if (!target) continue;
        addItem(target, {
          name: child.name,
          path: childPath,
          relativePath: path.join(entry.name, child.name),
          sourceCharacterName: knownCharacterName,
          sourceLabel: knownCharacterName,
          type: "directory",
          reason: "wrong-character-folder"
        });
      }
      continue;
    }
  }
  result.groups = Array.from(groupsByTarget.values());
  result.hasMisplacedFolders = result.count > 0;
  return result;
}
function createLooseRootQuarantineName() {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
  return `DISABLED_loose-root-${stamp}`;
}
function createLooseCharacterQuarantineName() {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
  return `DISABLED_loose-files-${stamp}`;
}
function getAvailableDirectoryPath(parentDir, preferredName) {
  const baseName = String(preferredName || "Folder").trim() || "Folder";
  for (let index = 0; index < 1e3; index++) {
    const candidateName = index === 0 ? baseName : `${baseName} (${index})`;
    const candidatePath = path.join(parentDir, candidateName);
    if (!fs.existsSync(candidatePath)) return candidatePath;
  }
  throw new Error(i18n.t("backend.characters.cleanup.tooManyDuplicateFoldersFor", {
    baseName
  }));
}
function moveLooseEntryWithFallback(sourcePath, targetPath, isDirectory) {
  try {
    fs.renameSync(sourcePath, targetPath);
    return;
  } catch (error) {
    if (!error || !["EXDEV", "EPERM"].includes(error.code)) {
      throw error;
    }
  }
  fs.mkdirSync(path.dirname(targetPath), {
    recursive: true
  });
  if (isDirectory) {
    fs.cpSync(sourcePath, targetPath, {
      recursive: true
    });
    fs.rmSync(sourcePath, {
      recursive: true,
      force: true
    });
  } else {
    fs.copyFileSync(sourcePath, targetPath);
    fs.unlinkSync(sourcePath);
  }
}
function quarantineLooseRootModFolders(gameId2 = gamesSettings.getActiveGameScopeId(), options = {}) {
  const modsPath = gamesSettings.getModsPath(gameId2);
  const scan = scanLooseRootModFolders(modsPath, gameId2);
  if (!scan.hasLooseFolders) return {
    success: true,
    scan,
    moved: [],
    movedCount: 0,
    targets: []
  };
  const selectedIds = Array.isArray(options?.selectedIds) ? new Set(options.selectedIds) : null;
  const shouldMoveItem = item => !selectedIds || selectedIds.has(item?.id);
  const targets = [];
  const moved = [];
  const rootFolders = (scan.rootFolders || scan.folders || []).filter(shouldMoveItem);
  const rootFiles = (scan.rootFiles || []).filter(shouldMoveItem);
  if (rootFolders.length > 0 || rootFiles.length > 0) {
    const target = charactersDirectories.resolveCanonicalCharacterInstallTarget(scan.targetCharacterName || "其他", gameId2);
    if (!target.characterPath) throw new Error(i18n.t("backend.characters.cleanup.unableToResolveQuarantineCharacterFolder"));
    const quarantineRoot = getAvailableDirectoryPath(target.characterPath, createLooseRootQuarantineName());
    fs.mkdirSync(quarantineRoot, {
      recursive: true
    });
    targets.push({
      type: "root",
      label: i18n.t("backend.characters.cleanup.rootLooseItems"),
      characterName: target.characterName,
      path: quarantineRoot
    });
    for (const folder of rootFolders) {
      const sourcePath = folder.path || path.join(modsPath, folder.name);
      if (!fs.existsSync(sourcePath)) continue;
      const targetPath = getAvailableDirectoryPath(quarantineRoot, folder.name);
      systemFiles.moveDirectoryWithFallback(sourcePath, targetPath);
      moved.push({
        type: "root-folder",
        name: folder.name,
        sourcePath,
        targetPath
      });
    }
    for (const file of rootFiles) {
      const sourcePath = file.path || path.join(modsPath, file.name);
      if (!fs.existsSync(sourcePath)) continue;
      const targetPath = getAvailableDirectoryPath(quarantineRoot, file.name);
      moveLooseEntryWithFallback(sourcePath, targetPath, false);
      moved.push({
        type: "root-file",
        name: file.name,
        sourcePath,
        targetPath
      });
    }
  }
  for (const group of scan.characterGroups || []) {
    if (!group?.path || !fs.existsSync(group.path)) continue;
    const selectedItems = (group.items || []).filter(shouldMoveItem);
    if (!selectedItems.length) continue;
    const quarantineRoot = getAvailableDirectoryPath(group.path, createLooseCharacterQuarantineName());
    fs.mkdirSync(quarantineRoot, {
      recursive: true
    });
    targets.push({
      type: "character",
      label: i18n.t("backend.characters.cleanup.characterLooseFiles", {
        characterName: group.characterName
      }),
      characterName: group.characterName,
      path: quarantineRoot
    });
    for (const item of selectedItems) {
      const sourcePath = item.path;
      if (!sourcePath || !fs.existsSync(sourcePath)) continue;
      const targetPath = getAvailableDirectoryPath(quarantineRoot, item.name);
      moveLooseEntryWithFallback(sourcePath, targetPath, item.type === "directory");
      moved.push({
        type: `character-${item.type || "entry"}`,
        characterName: group.characterName,
        name: item.name,
        sourcePath,
        targetPath
      });
    }
  }
  modsConflicts.clearConflictCache(null, gameId2);
  desktopNotifications.notifyAllModWindowsChanged("__all__");
  coreLogger.logger.info(`[LooseRoot] quarantined=${moved.length}, targets=${targets.map(item => item.path).join("; ")}`);
  return {
    success: true,
    scan,
    moved,
    movedCount: moved.length,
    requestedCount: selectedIds ? selectedIds.size : scan.count,
    targets,
    targetSummary: targets.map(item => `${item.label} -> ${item.path}`)
  };
}
function moveMisplacedModFolders(gameId2 = gamesSettings.getActiveGameScopeId(), options = {}) {
  const modsPath = gamesSettings.getModsPath(gameId2);
  const scan = scanMisplacedModFolders(modsPath, gameId2);
  if (!scan.hasMisplacedFolders) {
    return {
      success: true,
      scan,
      moved: [],
      movedCount: 0,
      targets: []
    };
  }
  const selectedIds = Array.isArray(options?.selectedIds) ? new Set(options.selectedIds) : null;
  const shouldMoveItem = item => !selectedIds || selectedIds.has(item?.id);
  const moved = [];
  const targets = [];
  for (const group of scan.groups || []) {
    const selectedItems = (group.items || []).filter(shouldMoveItem);
    if (!selectedItems.length) continue;
    const target = charactersDirectories.resolveCanonicalCharacterInstallTarget(group.targetCharacterName, gameId2);
    if (!target.characterPath) throw new Error(i18n.t("backend.characters.cleanup.unableToResolveTargetCharacterFolder", {
      targetCharacterName: group.targetCharacterName
    }));
    targets.push({
      characterName: target.characterName,
      path: target.characterPath
    });
    for (const item of selectedItems) {
      const sourcePath = item.path;
      if (!sourcePath || !fs.existsSync(sourcePath)) continue;
      const targetPath = getAvailableDirectoryPath(target.characterPath, item.name);
      systemFiles.moveDirectoryWithFallback(sourcePath, targetPath);
      moved.push({
        characterName: target.characterName,
        name: item.name,
        matchedAlias: item.matchedAlias,
        sourceCharacterName: item.sourceCharacterName || "",
        sourcePath,
        targetPath
      });
    }
  }
  modsConflicts.clearConflictCache(null, gameId2);
  desktopNotifications.notifyAllModWindowsChanged("__all__");
  coreLogger.logger.info(`[MisplacedMods] moved=${moved.length}, targets=${targets.map(item => item.path).join("; ")}`);
  return {
    success: true,
    scan,
    moved,
    movedCount: moved.length,
    requestedCount: selectedIds ? selectedIds.size : scan.count,
    targets,
    targetSummary: moved.slice(0, 5).map(item => `${item.name} -> ${item.characterName}`)
  };
}
