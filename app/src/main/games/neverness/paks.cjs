"use strict";

const i18n = require("../../../shared/i18n/core.cjs");
module.exports = {
  getNevernessPakExt,
  getNevernessPakBaseName,
  scanNevernessPakGroups,
  hasShallowNevernessPakGroup,
  detectNevernessDx12PakSource,
  getNevernessDx12ModDirectoryInfo,
  isNevernessDx12ModDir,
  getCharacterDirectoryBasePath,
  getNevernessDx12CharacterPath,
  getNevernessDx12DisabledCharacterPath,
  importNevernessDx12PakMod,
  getNevernessDx12Mods,
  toggleNevernessDx12PakMod,
  deleteNevernessDx12PakMod
};
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const AdmZip = require("adm-zip");
const archivesDisguised = require("../../archives/disguised.cjs");
const archivesExtract = require("../../archives/extract.cjs");
const charactersCatalog = require("../../characters/catalog.cjs");
const charactersDirectories = require("../../characters/directories.cjs");
const charactersHidden = require("../../characters/hidden.cjs");
const charactersImages = require("../../characters/images.cjs");
const charactersSkins = require("../../characters/skins.cjs");
const coreLogger = require("../../core/logger.cjs");
const desktopNotifications = require("../../desktop/notifications.cjs");
const gamesNevernessLoader = require("./loader.cjs");
const gamesSettings = require("../settings.cjs");
const importsLocal = require("../../imports/local.cjs");
const modsAppearance = require("../../mods/appearance.cjs");
const modsConflicts = require("../../mods/conflicts.cjs");
const modsMetadata = require("../../mods/metadata.cjs");
const systemFiles = require("../../system/files.cjs");
const systemPaths = require("../../system/paths.cjs");
const systemWindows = require("../../system/windows.cjs");
function normalizeNevernessPakFileName(fileName) {
  return String(fileName || "").replace(/\.disabled$/i, "");
}
function getNevernessPakExt(fileName) {
  const normalized = normalizeNevernessPakFileName(fileName).toLowerCase();
  return gamesNevernessLoader.NEVERNESS_DX12_PAK_EXTS.find(ext => normalized.endsWith(ext)) || "";
}
function getNevernessPakBaseName(fileName) {
  const ext = getNevernessPakExt(fileName);
  if (!ext) return "";
  const normalized = normalizeNevernessPakFileName(fileName);
  return normalized.slice(0, -ext.length);
}
function walkFiles(dirPath, visitor) {
  if (!dirPath || !fs.existsSync(dirPath)) return;
  for (const entry of fs.readdirSync(dirPath, {
    withFileTypes: true
  })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) walkFiles(fullPath, visitor);else if (entry.isFile()) visitor(fullPath, entry.name);
  }
}
function scanNevernessPakGroups(sourceDir) {
  const groups = new Map();
  walkFiles(sourceDir, (filePath, fileName) => {
    const ext = getNevernessPakExt(fileName);
    const baseName = getNevernessPakBaseName(fileName);
    if (!ext || !baseName) return;
    if (!groups.has(baseName)) groups.set(baseName, {
      baseName,
      files: {},
      sourceFiles: {}
    });
    const group = groups.get(baseName);
    group.files[ext.slice(1)] = normalizeNevernessPakFileName(fileName);
    group.sourceFiles[ext.slice(1)] = filePath;
  });
  return Array.from(groups.values()).filter(group => group.sourceFiles.pak && group.sourceFiles.ucas && group.sourceFiles.utoc);
}
function hasShallowNevernessPakGroup(sourceDir) {
  if (!sourceDir || !fs.existsSync(sourceDir)) return false;
  if (fs.existsSync(path.join(sourceDir, gamesNevernessLoader.NEVERNESS_DX12_META_FILE))) return true;
  const groups = new Map();
  for (const entry of fs.readdirSync(sourceDir, {
    withFileTypes: true
  })) {
    if (!entry.isFile()) continue;
    const ext = getNevernessPakExt(entry.name);
    const baseName = getNevernessPakBaseName(entry.name);
    if (!ext || !baseName) continue;
    if (!groups.has(baseName)) groups.set(baseName, new Set());
    groups.get(baseName).add(ext);
  }
  return Array.from(groups.values()).some(exts => exts.has(".pak") && exts.has(".ucas") && exts.has(".utoc"));
}
async function prepareNevernessDx12PakDetectionSource(filePath) {
  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) return {
    sourceDir: filePath,
    cleanup: null
  };
  const ext = path.extname(filePath).toLowerCase();
  const tempDir = fs.mkdtempSync(path.join(electron.app.getPath("temp"), "qaqm-nte-pak-detect-"));
  const cleanup = () => {
    try {
      fs.rmSync(tempDir, {
        recursive: true,
        force: true
      });
    } catch (_) {}
  };
  if (stat.isFile() && archivesDisguised.isDisguisedMp4(filePath)) {
    await archivesDisguised.extractDisguisedMp4(filePath, tempDir);
  } else if (ext === ".zip") {
    const zip = new AdmZip(filePath);
    zip.extractAllTo(tempDir, true);
  } else if (ext === ".rar" || ext === ".7z" || ext === ".exe") {
    await archivesExtract.extractArchiveWithExternalTool(filePath, tempDir);
  } else {
    fs.copyFileSync(filePath, path.join(tempDir, path.basename(filePath)));
  }
  return {
    sourceDir: tempDir,
    cleanup
  };
}
async function detectNevernessDx12PakSource(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return {
    isPak: false,
    groups: []
  };
  let prepared = null;
  try {
    prepared = await prepareNevernessDx12PakDetectionSource(filePath);
    const groups = scanNevernessPakGroups(prepared.sourceDir);
    return {
      isPak: groups.length > 0,
      groups
    };
  } catch (error) {
    coreLogger.logger.warn(`[PakDetect] Failed to inspect ${filePath}: ${error.message}`);
    return {
      isPak: false,
      groups: []
    };
  } finally {
    prepared?.cleanup?.();
  }
}
function extractNevernessDx12Source(filePath) {
  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) return {
    sourceDir: filePath,
    cleanup: null
  };
  const ext = path.extname(filePath).toLowerCase();
  const tempDir = fs.mkdtempSync(path.join(electron.app.getPath("temp"), "qaqm-nte-dx12-"));
  const cleanup = () => {
    try {
      fs.rmSync(tempDir, {
        recursive: true,
        force: true
      });
    } catch (_) {}
  };
  if (ext === ".zip") {
    const zip = new AdmZip(filePath);
    zip.extractAllTo(tempDir, true);
    return {
      sourceDir: tempDir,
      cleanup
    };
  }
  if (ext === ".rar" || ext === ".7z" || ext === ".exe") {
    return {
      sourceDir: tempDir,
      cleanup,
      archive: true
    };
  }
  const fileName = path.basename(filePath);
  const target = path.join(tempDir, fileName);
  fs.copyFileSync(filePath, target);
  return {
    sourceDir: tempDir,
    cleanup
  };
}
function readNevernessDx12Meta(metaDir) {
  const metaPath = path.join(metaDir, gamesNevernessLoader.NEVERNESS_DX12_META_FILE);
  if (!fs.existsSync(metaPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(metaPath, "utf-8"));
  } catch (_) {
    return null;
  }
}
function normalizeNevernessDx12PakGroup(group, paths) {
  const files = Array.isArray(group?.files) ? group.files : Object.values(group?.files || {}).filter(Boolean);
  return {
    baseName: group?.baseName || "",
    files,
    pakDirName: group?.pakDirName || paths?.pakDirName || gamesNevernessLoader.NEVERNESS_DX12_DEFAULT_PAK_DIR
  };
}
function getNevernessDx12ModDirectoryInfo(modDir, paths = gamesNevernessLoader.getNevernessDx12Paths()) {
  const meta = readNevernessDx12Meta(modDir);
  if (meta?.type === "neverness-dx12-pak") {
    return {
      source: "meta",
      meta,
      groups: (meta.groups || []).map(group => normalizeNevernessDx12PakGroup(group, paths))
    };
  }
  const groups = scanNevernessPakGroups(modDir);
  if (!groups.length) return null;
  return {
    source: "folder",
    meta: null,
    groups: groups.map(group => normalizeNevernessDx12PakGroup(group, paths))
  };
}
function isNevernessDx12ModDir(dirPath) {
  return !!dirPath && !!getNevernessDx12ModDirectoryInfo(dirPath);
}
function writeNevernessDx12Meta(metaDir, meta) {
  fs.mkdirSync(metaDir, {
    recursive: true
  });
  fs.writeFileSync(path.join(metaDir, gamesNevernessLoader.NEVERNESS_DX12_META_FILE), JSON.stringify(meta, null, 2));
}
function getNevernessDx12CharacterBasePath({
  ensure = false,
  gameId: gameId2 = gamesNevernessLoader.NEVERNESS_GAME_ID
} = {}) {
  const paths = ensure ? gamesNevernessLoader.ensureNevernessDx12GamePaths(gameId2) : gamesNevernessLoader.getNevernessDx12Paths(gameId2);
  if (ensure && paths.pakModsDir) systemWindows.probeWritableDirectory(paths.pakModsDir, i18n.t("backend.validation.nevernessPakDirectory"));
  return paths.pakModsDir || "";
}
function getCharacterDirectoryBasePath(modsPath, gameId2 = gamesSettings.getActiveGameScopeId(), {
  ensure = false
} = {}) {
  if (gamesNevernessLoader.isNevernessDx12Mode(gameId2)) {
    return getNevernessDx12CharacterBasePath({
      ensure,
      gameId: gameId2
    });
  }
  if (ensure && modsPath && !fs.existsSync(modsPath)) fs.mkdirSync(modsPath, {
    recursive: true
  });
  return modsPath || "";
}
function getNevernessDx12CharacterPath(characterName, {
  ensure = false,
  gameId: gameId2 = gamesNevernessLoader.NEVERNESS_GAME_ID
} = {}) {
  const safeCharacterName = charactersSkins.assertSafeAppearancePathSegment(characterName, i18n.t("backend.validation.characterName"));
  const basePath = getNevernessDx12CharacterBasePath({
    ensure,
    gameId: gameId2
  });
  if (!basePath) return "";
  const charPath = path.join(basePath, safeCharacterName);
  if (!systemPaths.isPathInsideDirectory(charPath, basePath)) throw new Error(i18n.t("backend.mods.nevernessPaks.invalidCharacterPath"));
  if (ensure) systemWindows.probeWritableDirectory(charPath, i18n.t("backend.validation.nevernessCharacterDirectory", {
    safeCharacterName
  }));
  return charPath;
}
function getNevernessDx12DisabledCharacterPath(characterName, paths = null, {
  ensure = false,
  gameId: gameId2 = gamesNevernessLoader.NEVERNESS_GAME_ID
} = {}) {
  const safeCharacterName = charactersSkins.assertSafeAppearancePathSegment(characterName, i18n.t("backend.validation.characterName"));
  const resolvedPaths = paths || gamesNevernessLoader.getNevernessDx12Paths(gameId2);
  const basePath = resolvedPaths?.disabledModsDir || gamesNevernessLoader.getNevernessDx12DisabledModsDir(gameId2);
  if (!basePath) return "";
  const charPath = path.join(basePath, safeCharacterName);
  if (!systemPaths.isPathInsideDirectory(charPath, basePath)) throw new Error(i18n.t("backend.mods.nevernessPaks.invalidDisabledCharacterPath"));
  if (ensure) systemWindows.probeWritableDirectory(charPath, i18n.t("backend.validation.disabledCharacterDirectory", {
    safeCharacterName
  }));
  return charPath;
}
function sendNevernessPakToggleProgress(payload) {
  electron.BrowserWindow.getAllWindows().forEach(window => {
    if (!window.isDestroyed()) window.webContents.send("neverness:pak-toggle-progress", payload);
  });
}
function toggleNevernessDx12PakFilesInDirectory(modDir, enable) {
  walkFiles(modDir, (filePath, fileName) => {
    const ext = getNevernessPakExt(fileName);
    if (!ext) return;
    const shouldBeDisabled = fileName.toLowerCase().endsWith(".disabled");
    if (shouldBeDisabled) {
      fs.renameSync(filePath, filePath.replace(/\.disabled$/i, ""));
    }
  });
}
function normalizeNevernessDx12PakFilesInDirectory(modDir) {
  toggleNevernessDx12PakFilesInDirectory(modDir);
}
function hasDisabledNevernessDx12PakFile(modDir) {
  let found = false;
  walkFiles(modDir, (_filePath, fileName) => {
    if (found) return;
    if (String(fileName || "").toLowerCase().endsWith(".disabled") && getNevernessPakExt(fileName)) {
      found = true;
    }
  });
  return found;
}
function normalizeNevernessDx12DisabledStorage(disabledCharPath, paths, progressContext = null) {
  if (!disabledCharPath || !fs.existsSync(disabledCharPath)) return {
    normalized: 0,
    skipped: 0
  };
  let normalized = 0;
  let skipped = 0;
  const entries = fs.readdirSync(disabledCharPath, {
    withFileTypes: true
  });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const sourcePath = path.join(disabledCharPath, entry.name);
    let targetPath = sourcePath;
    if (entry.name.startsWith("DISABLED_")) {
      const cleanModName = entry.name.replace(/^DISABLED_/i, "").trim();
      if (!cleanModName || !getNevernessDx12ModDirectoryInfo(sourcePath, paths)) {
        skipped += 1;
        continue;
      }
      targetPath = path.join(disabledCharPath, cleanModName);
      if (fs.existsSync(targetPath)) {
        skipped += 1;
        continue;
      }
      if (progressContext) {
        sendNevernessPakToggleProgress({
          ...progressContext,
          current: progressContext.current,
          message: i18n.t("backend.mods.nevernessPaks.organizingDisabledMods", {
            cleanModName
          })
        });
      }
      systemFiles.moveDirectoryWithFallback(sourcePath, targetPath);
      normalized += 1;
    }
    if (hasDisabledNevernessDx12PakFile(targetPath) && getNevernessDx12ModDirectoryInfo(targetPath, paths)) {
      normalizeNevernessDx12PakFilesInDirectory(targetPath);
      normalized += 1;
    }
  }
  return {
    normalized,
    skipped
  };
}
function prepareNevernessDx12ActiveDirectoryForEnable(characterName, targetModName, paths = gamesNevernessLoader.getNevernessDx12Paths()) {
  const activeCharPath = getNevernessDx12CharacterPath(characterName);
  const disabledCharPath = getNevernessDx12DisabledCharacterPath(characterName, paths, {
    ensure: true
  });
  const targetCleanName = String(targetModName || "").replace(/^DISABLED_/i, "").trim();
  const activeEntries = activeCharPath && fs.existsSync(activeCharPath) ? fs.readdirSync(activeCharPath, {
    withFileTypes: true
  }).filter(entry => entry.isDirectory()) : [];
  const moveEntries = activeEntries.filter(entry => {
    const cleanName = entry.name.replace(/^DISABLED_/i, "").trim();
    return entry.name.startsWith("DISABLED_") && cleanName && cleanName !== targetCleanName;
  });
  const total = Math.max(1, moveEntries.length + 1);
  let migrated = 0;
  let skipped = 0;
  normalizeNevernessDx12DisabledStorage(disabledCharPath, paths, {
    status: "running",
    phase: "prepare",
    characterName,
    modName: targetCleanName,
    enable: true,
    current: 0,
    total
  });
  for (const entry of moveEntries) {
    const sourcePath = path.join(activeCharPath, entry.name);
    const cleanModName = entry.name.replace(/^DISABLED_/i, "").trim();
    if (!cleanModName || !getNevernessDx12ModDirectoryInfo(sourcePath, paths)) {
      skipped += 1;
      continue;
    }
    const targetPath = path.join(disabledCharPath, cleanModName);
    if (fs.existsSync(targetPath)) {
      skipped += 1;
      continue;
    }
    sendNevernessPakToggleProgress({
      status: "running",
      phase: "prepare",
      characterName,
      modName: targetCleanName,
      enable: true,
      current: migrated + 1,
      total,
      message: i18n.t("backend.mods.nevernessPaks.disablingOtherPakMods", {
        cleanModName
      })
    });
    normalizeNevernessDx12PakFilesInDirectory(sourcePath);
    systemFiles.moveDirectoryWithFallback(sourcePath, targetPath);
    migrated += 1;
  }
  if (migrated > 0) modsConflicts.clearConflictCache(characterName, gamesSettings.getActiveGameScopeId());
  return {
    migrated,
    skipped
  };
}
function findNevernessSigTemplate(paths) {
  try {
    if (!paths?.paksDir || !fs.existsSync(paths.paksDir)) return null;
    const files = fs.readdirSync(paths.paksDir);
    const sig = files.find(file => file.toLowerCase().endsWith(".sig"));
    return sig ? path.join(paths.paksDir, sig) : null;
  } catch (_) {
    return null;
  }
}
function findNevernessImportPaksFolder(sourceDir) {
  if (!sourceDir || !fs.existsSync(sourceDir)) return "";
  for (const entry of fs.readdirSync(sourceDir, {
    withFileTypes: true
  })) {
    if (!entry.isDirectory() || !/^paks?$/i.test(entry.name)) continue;
    const candidate = path.join(sourceDir, entry.name);
    if (scanNevernessPakGroups(candidate).length > 0) return candidate;
  }
  return "";
}
function resolveNevernessDx12ImportRoot(sourceDir) {
  if (!sourceDir || !fs.existsSync(sourceDir)) return sourceDir;
  if (findNevernessImportPaksFolder(sourceDir) || scanNevernessPakGroups(sourceDir).length > 0) return sourceDir;
  const entries = fs.readdirSync(sourceDir, {
    withFileTypes: true
  });
  const directories = entries.filter(entry => entry.isDirectory());
  if (entries.length === 1 && directories.length === 1) {
    const nestedDir = path.join(sourceDir, directories[0].name);
    if (findNevernessImportPaksFolder(nestedDir) || scanNevernessPakGroups(nestedDir).length > 0) return nestedDir;
  }
  return sourceDir;
}
function copyNevernessDx12ImportContent(sourceDir, targetDir) {
  systemWindows.probeWritableDirectory(targetDir, i18n.t("backend.validation.pakTargetDirectory"));
  const paksFolder = findNevernessImportPaksFolder(sourceDir);
  if (!paksFolder) {
    systemFiles.copyDirectoryRecursive(sourceDir, targetDir);
    return;
  }
  for (const entry of fs.readdirSync(sourceDir, {
    withFileTypes: true
  })) {
    const sourcePath = path.join(sourceDir, entry.name);
    if (sourcePath === paksFolder) {
      systemFiles.copyDirectoryRecursive(sourcePath, targetDir);
      continue;
    }
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      systemFiles.copyDirectoryRecursive(sourcePath, targetPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}
function findNevernessDx12ManagedPakFilePath(modDir, charPath, fileName, enabled) {
  const diskName = enabled ? fileName : `${fileName}.disabled`;
  const candidates = [path.join(modDir, diskName), path.join(charPath, diskName)];
  return candidates.find(candidate => fs.existsSync(candidate)) || candidates[0];
}
function findNevernessDx12ModDirectory(characterName, modName, enable, paths) {
  const activeCharPath = getNevernessDx12CharacterPath(characterName, {
    ensure: enable
  });
  const disabledCharPath = getNevernessDx12DisabledCharacterPath(characterName, paths, {
    ensure: !enable
  });
  const candidates = enable ? [path.join(disabledCharPath, modName), path.join(activeCharPath, `DISABLED_${modName}`), path.join(activeCharPath, modName)] : [path.join(activeCharPath, modName), path.join(activeCharPath, `DISABLED_${modName}`), path.join(disabledCharPath, modName)];
  return candidates.find(candidate => candidate && fs.existsSync(candidate)) || candidates[0];
}
async function importNevernessDx12PakMod(characterName, filePath, modInfo = {}, options = {}) {
  const gameId2 = options.gameId || modInfo.gameId || gamesSettings.getActiveGameScopeId();
  characterName = charactersSkins.assertSafeAppearancePathSegment(characterName, i18n.t("backend.validation.characterName"));
  charactersHidden.assertCharacterVisible(characterName, gameId2);
  let charPath = getNevernessDx12CharacterPath(characterName, {
    ensure: true,
    gameId: gameId2
  }) || charactersDirectories.resolveCharacterPath(characterName, gameId2);
  if (!charPath) return {
    error: i18n.t("backend.imports.local.characterFolderNotFound")
  };
  const paths = gamesNevernessLoader.ensureNevernessDx12GamePaths(gameId2);
  const cleanModName = charactersSkins.assertSafeAppearancePathSegment(String(modInfo.name || path.basename(filePath, path.extname(filePath)) || "Pak Mod").replace(/^DISABLED_/i, "").trim(), i18n.t("backend.validation.modName"));
  const allowDuplicateRename = !!options.allowDuplicateRename || !!modInfo.allowDuplicateRename;
  const availableTarget = importsLocal.getAvailableModFolderName(charPath, cleanModName);
  const metaDir = allowDuplicateRename ? availableTarget.path : path.join(charPath, cleanModName);
  const finalModName = allowDuplicateRename ? availableTarget.name : cleanModName;
  const disabledMetaDir = path.join(charPath, `DISABLED_${cleanModName}`);
  if (!allowDuplicateRename && (fs.existsSync(metaDir) || fs.existsSync(disabledMetaDir))) return {
    error: i18n.t("backend.imports.local.modWithThisNameAlreadyExists")
  };
  let extracted = null;
  try {
    extracted = extractNevernessDx12Source(filePath);
    if (extracted.archive) {
      await archivesExtract.extractArchiveWithExternalTool(filePath, extracted.sourceDir);
    }
    const importRoot = resolveNevernessDx12ImportRoot(extracted.sourceDir);
    const groups = scanNevernessPakGroups(importRoot);
    if (!groups.length) throw new Error(i18n.t("backend.mods.nevernessPaks.pakFilesMissing"));
    copyNevernessDx12ImportContent(importRoot, metaDir);
    const importedGroups = scanNevernessPakGroups(metaDir);
    if (!importedGroups.length) throw new Error(i18n.t("backend.mods.nevernessPaks.importedPakFilesMissing"));
    const copiedGroups = [];
    for (const group of importedGroups) {
      const copiedFiles = Object.values(group.files || {}).filter(Boolean);
      if (!group.sourceFiles.sig) {
        const sigTemplate = findNevernessSigTemplate(paths);
        if (sigTemplate) {
          const sigFileName = `${group.baseName}.sig`;
          const sigTargetPath = path.join(metaDir, sigFileName);
          if (!fs.existsSync(sigTargetPath) && !fs.existsSync(`${sigTargetPath}.disabled`)) {
            fs.copyFileSync(sigTemplate, sigTargetPath);
            copiedFiles.push(sigFileName);
          }
        }
      }
      copiedGroups.push({
        baseName: group.baseName,
        files: copiedFiles,
        pakDirName: paths.pakDirName
      });
    }
    writeNevernessDx12Meta(metaDir, {
      type: "neverness-dx12-pak",
      name: finalModName,
      characterName,
      pakDirName: paths.pakDirName,
      groups: copiedGroups,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    const appearance = modsAppearance.assignInstalledModAppearance({
      characterName,
      modName: finalModName,
      modDir: metaDir,
      requested: modInfo,
      gameId: gameId2,
      source: modsAppearance.extractRequestedAppearanceTarget(modInfo).sectionId || modsAppearance.extractRequestedAppearanceTarget(modInfo).skinId ? "explicit-install" : "name-match"
    });
    modsConflicts.clearConflictCache(characterName, gameId2);
    if (options.notify !== false) {
      desktopNotifications.notifyCharacterListChanged(characterName, {
        modName: finalModName,
        reason: "neverness-import"
      });
    }
    return {
      success: true,
      modMode: "pak",
      characterName,
      modName: finalModName,
      targetPath: metaDir,
      appearanceSectionId: appearance.sectionId,
      renamedDueToDuplicate: allowDuplicateRename && !!availableTarget.duplicate,
      duplicateOf: availableTarget.duplicate ? availableTarget.duplicateOf : null
    };
  } catch (error) {
    try {
      fs.rmSync(metaDir, {
        recursive: true,
        force: true
      });
    } catch (_) {}
    return {
      error: systemWindows.formatWindowsFileOperationError(error, {
        path: metaDir,
        operation: "import-pak"
      })
    };
  } finally {
    extracted?.cleanup?.();
  }
}
function getNevernessDx12Mods(characterName) {
  const gameId2 = gamesSettings.getActiveGameScopeId();
  const charPath = getNevernessDx12CharacterPath(characterName, {
    ensure: true
  }) || charactersDirectories.resolveCharacterPath(characterName, gameId2);
  if (!charPath || !fs.existsSync(charPath)) return {
    error: i18n.t("backend.ipc.characters.characterNotFound")
  };
  const paths = gamesNevernessLoader.getNevernessDx12Paths();
  const disabledCharPath = getNevernessDx12DisabledCharacterPath(characterName, paths);
  const addedAtAccessor = gamesSettings.createModAddedAtAccessor();
  const sourceDirs = [{
    dirPath: charPath,
    enabled: true
  }, {
    dirPath: disabledCharPath,
    enabled: false
  }].filter(source => source.dirPath && fs.existsSync(source.dirPath));
  const mods = sourceDirs.flatMap(source => fs.readdirSync(source.dirPath, {
    withFileTypes: true
  }).map(entry => ({
    entry,
    source
  }))).filter(item => item.entry.isDirectory()).map(({
    entry,
    source
  }) => {
    const originalName = entry.name;
    const metaDir = path.join(source.dirPath, originalName);
    const modInfo = getNevernessDx12ModDirectoryInfo(metaDir, paths);
    if (!modInfo) return null;
    const isDisabled = originalName.startsWith("DISABLED_");
    const displayName = isDisabled ? originalName.replace("DISABLED_", "") : originalName;
    const {
      addedAt,
      addedAtMs
    } = addedAtAccessor.get(characterName, displayName, metaDir);
    const previewImagePath = charactersImages.findModPreviewImageFile(metaDir);
    let notes = "";
    let tags = [];
    let tagMeta = {};
    try {
      const tagsFile = path.join(metaDir, "tags.json");
      if (fs.existsSync(tagsFile)) {
        tagMeta = JSON.parse(fs.readFileSync(tagsFile, "utf-8")) || {};
        notes = typeof tagMeta.notes === "string" ? tagMeta.notes : "";
        tags = Array.isArray(tagMeta.tags) ? tagMeta.tags.map(t => typeof t === "string" ? t : t?.name || "").filter(Boolean) : [];
      }
    } catch (_) {}
    return {
      name: displayName,
      originalName,
      enabled: source.enabled && !isDisabled,
      path: metaDir,
      previewUrl: previewImagePath ? "file:///" + previewImagePath.replace(/\\/g, "/") : null,
      addedAt,
      addedAtMs,
      tags,
      notes,
      hotkeyAliases: {},
      appearanceSectionId: modsAppearance.resolveModAppearanceSectionId({
        characterName,
        modName: displayName,
        modDir: metaDir,
        meta: tagMeta,
        gameId: gameId2
      }),
      modType: "dx12-pak",
      pakModsDir: paths.pakModsDir,
      pakGroups: modInfo.groups || []
    };
  }).filter(Boolean);
  const orderedMods = modsMetadata.movePinnedModsToTop(modsMetadata.applyPinnedStateToMods(characterName, mods));
  const sections = charactersSkins.buildAppearanceSectionsWithStats(characterName, orderedMods, gameId2);
  addedAtAccessor.saveIfDirty();
  return {
    success: true,
    mods: orderedMods,
    sections,
    enabledSectionIds: sections.filter(section => section.enabledCount > 0).map(section => section.sectionId),
    characterAliases: charactersCatalog.getCharacterAliasCandidates(characterName, gameId2)
  };
}
function toggleNevernessDx12PakMod(characterName, modName, enable) {
  const gameId2 = gamesSettings.getActiveGameScopeId();
  if (enable && charactersHidden.isCharacterHidden(characterName, gameId2)) return {
    error: i18n.t("backend.mods.nevernessPaks.characterHidden")
  };
  const charPath = getNevernessDx12CharacterPath(characterName, {
    ensure: true
  }) || charactersDirectories.resolveCharacterPath(characterName, gameId2);
  if (!charPath) return {
    error: i18n.t("backend.imports.local.characterFolderNotFound")
  };
  const paths = gamesNevernessLoader.getNevernessDx12Paths();
  const currentPath = findNevernessDx12ModDirectory(characterName, modName, enable, paths);
  const targetCharPath = enable ? getNevernessDx12CharacterPath(characterName, {
    ensure: true
  }) : getNevernessDx12DisabledCharacterPath(characterName, paths, {
    ensure: true
  });
  const cleanModName = path.basename(currentPath).replace(/^DISABLED_/i, "");
  const newPath = path.join(targetCharPath, cleanModName);
  const modInfo = getNevernessDx12ModDirectoryInfo(currentPath, paths);
  if (!modInfo) return {
    error: i18n.t("backend.mods.nevernessPaks.pakModNotFound")
  };
  if (path.resolve(currentPath) === path.resolve(newPath)) return {
    success: true,
    persistRestored: false,
    autoReloaded: false
  };
  if (fs.existsSync(newPath)) return {
    error: i18n.t("backend.mods.nevernessPaks.destinationExists", {
      newPath
    })
  };
  if (enable) prepareNevernessDx12ActiveDirectoryForEnable(characterName, modName, paths);
  sendNevernessPakToggleProgress({
    status: "running",
    characterName,
    modName,
    enable,
    current: 0,
    total: 1,
    message: enable ? i18n.t("backend.mods.nevernessPaks.enablingPak") : i18n.t("backend.mods.nevernessPaks.disablingPak")
  });
  if (!modInfo.meta || hasDisabledNevernessDx12PakFile(currentPath)) {
    normalizeNevernessDx12PakFilesInDirectory(currentPath);
  }
  systemFiles.moveDirectoryWithFallback(currentPath, newPath);
  modsConflicts.clearConflictCache(characterName, gameId2);
  sendNevernessPakToggleProgress({
    status: "done",
    characterName,
    modName,
    enable,
    current: 1,
    total: 1,
    message: enable ? i18n.t("backend.mods.nevernessPaks.pakEnabled") : i18n.t("backend.mods.nevernessPaks.pakDisabled")
  });
  desktopNotifications.notifyCharacterListChanged(characterName, {
    modName,
    reason: "neverness-toggle"
  });
  return {
    success: true,
    persistRestored: false,
    autoReloaded: false
  };
}
async function deleteNevernessDx12PakMod(characterName, modName) {
  const gameId2 = gamesSettings.getActiveGameScopeId();
  const charPath = getNevernessDx12CharacterPath(characterName, {
    ensure: true
  }) || charactersDirectories.resolveCharacterPath(characterName, gameId2);
  if (!charPath) return {
    error: i18n.t("backend.imports.local.characterFolderNotFound")
  };
  const paths = gamesNevernessLoader.getNevernessDx12Paths();
  const disabledCharPath = getNevernessDx12DisabledCharacterPath(characterName, paths);
  let metaDir = path.join(charPath, modName);
  if (!fs.existsSync(metaDir)) metaDir = path.join(charPath, `DISABLED_${modName}`);
  if (!fs.existsSync(metaDir) && disabledCharPath) metaDir = path.join(disabledCharPath, modName);
  if (!fs.existsSync(metaDir) && disabledCharPath) metaDir = path.join(disabledCharPath, `DISABLED_${modName}`);
  const modInfo = getNevernessDx12ModDirectoryInfo(metaDir, paths);
  if (!modInfo) return {
    error: i18n.t("backend.mods.nevernessPaks.pakModNotFound")
  };
  if (modInfo.source === "meta") {
    for (const group of modInfo.groups || []) {
      for (const fileName of group.files || []) {
        for (const enabled of [true, false]) {
          await systemFiles.movePathToRecycleBin(findNevernessDx12ManagedPakFilePath(metaDir, charPath, fileName, enabled), "delete Neverness managed Pak file");
        }
      }
    }
  }
  await systemFiles.movePathToRecycleBin(metaDir, "delete Neverness Pak mod");
  modsConflicts.clearConflictCache(characterName, gameId2);
  desktopNotifications.notifyCharacterListChanged(characterName, {
    modName,
    reason: "neverness-delete"
  });
  return {
    success: true,
    recycled: true
  };
}
