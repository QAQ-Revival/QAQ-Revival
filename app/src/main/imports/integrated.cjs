"use strict";

const i18n = require("../../shared/i18n/core.cjs");
module.exports = {
  isLikelyIntegratedModsRoot,
  findIntegratedModsDir,
  getIntegratedModsPackageStats,
  moveIntegratedModsToCurrentMods,
  installIntegratedModsPackageIfPresent
};
const path = require("path");
const fs = require("fs");
const charactersCatalog = require("../characters/catalog.cjs");
const charactersDirectories = require("../characters/directories.cjs");
const charactersHidden = require("../characters/hidden.cjs");
const charactersOrganization = require("../characters/organization.cjs");
const coreLogger = require("../core/logger.cjs");
const desktopNotifications = require("../desktop/notifications.cjs");
const gamesSettings = require("../games/settings.cjs");
const modsAppearance = require("../mods/appearance.cjs");
const modsBackups = require("../mods/backups.cjs");
const modsConflicts = require("../mods/conflicts.cjs");
const systemFiles = require("../system/files.cjs");
const systemPaths = require("../system/paths.cjs");
const systemWindows = require("../system/windows.cjs");
function isLikelyIntegratedModsRoot(modsDir, {
  allowNamelessRoot = true,
  gameId: gameId2 = gamesSettings.getActiveGameScopeId()
} = {}) {
  if (!modsDir || !fs.existsSync(modsDir)) return false;
  try {
    if (!fs.statSync(modsDir).isDirectory()) return false;
    const characterDirs = fs.readdirSync(modsDir, {
      withFileTypes: true
    }).filter(entry => entry.isDirectory() && !entry.name.startsWith("."));
    if (characterDirs.length === 0) return false;
    for (const characterDir of characterDirs) {
      if (allowNamelessRoot && !charactersOrganization.getKnownCharacterDisplayName(characterDir.name, gameId2)) {
        continue;
      }
      const characterPath = path.join(modsDir, characterDir.name);
      const modDirs = fs.readdirSync(characterPath, {
        withFileTypes: true
      }).filter(entry => entry.isDirectory() && !entry.name.startsWith("."));
      if (modDirs.some(entry => systemFiles.directoryHasAnyFile(path.join(characterPath, entry.name)))) {
        return true;
      }
    }
  } catch (_) {
    return false;
  }
  return false;
}
function findIntegratedModsDir(sourceRoot, maxDepth = 3) {
  if (!sourceRoot || !fs.existsSync(sourceRoot)) return null;
  if (isLikelyIntegratedModsRoot(sourceRoot, {
    allowNamelessRoot: true
  })) return sourceRoot;
  const queue = [{
    dirPath: sourceRoot,
    depth: 0
  }];
  const visited = new Set();
  while (queue.length > 0) {
    const current = queue.shift();
    let resolved;
    try {
      resolved = path.resolve(current.dirPath);
      const key = process.platform === "win32" ? resolved.toLowerCase() : resolved;
      if (visited.has(key)) continue;
      visited.add(key);
      if (!fs.statSync(resolved).isDirectory()) continue;
    } catch (_) {
      continue;
    }
    if (path.basename(resolved).toLowerCase() === "mods" && isLikelyIntegratedModsRoot(resolved, {
      allowNamelessRoot: false
    })) {
      return resolved;
    }
    if (current.depth >= maxDepth) continue;
    let children = [];
    try {
      children = fs.readdirSync(resolved, {
        withFileTypes: true
      }).filter(entry => entry.isDirectory() && !entry.name.startsWith("."));
    } catch (_) {
      continue;
    }
    children.sort((left, right) => {
      const leftIsMods = left.name.toLowerCase() === "mods";
      const rightIsMods = right.name.toLowerCase() === "mods";
      if (leftIsMods !== rightIsMods) return leftIsMods ? -1 : 1;
      return left.name.localeCompare(right.name, "zh");
    });
    for (const child of children) {
      queue.push({
        dirPath: path.join(resolved, child.name),
        depth: current.depth + 1
      });
    }
  }
  return null;
}
function getIntegratedModsPackageStats(sourceRoot) {
  const sourceModsDir = findIntegratedModsDir(sourceRoot);
  if (!sourceModsDir) return null;
  try {
    const characterDirs = fs.readdirSync(sourceModsDir, {
      withFileTypes: true
    }).filter(entry => entry.isDirectory() && !entry.name.startsWith("."));
    let modCount = 0;
    let totalItems = 0;
    const affectedCharacters = [];
    for (const characterDir of characterDirs) {
      const sourceCharacterDir = path.join(sourceModsDir, characterDir.name);
      const childEntries = fs.readdirSync(sourceCharacterDir, {
        withFileTypes: true
      });
      let characterHasContent = false;
      for (const entry of childEntries) {
        if (entry.name.startsWith(".")) continue;
        const sourcePath = path.join(sourceCharacterDir, entry.name);
        if (entry.isDirectory() && systemFiles.directoryHasAnyFile(sourcePath)) {
          modCount++;
          totalItems++;
          characterHasContent = true;
        } else if (entry.isFile()) {
          totalItems++;
          characterHasContent = true;
        }
      }
      if (characterHasContent) affectedCharacters.push(characterDir.name);
    }
    return {
      sourceModsDir,
      characterCount: affectedCharacters.length,
      modCount,
      totalItems: Math.max(totalItems, modCount),
      affectedCharacters
    };
  } catch (_) {
    return null;
  }
}
async function pathExistsAsync(targetPath) {
  try {
    await fs.promises.access(targetPath);
    return true;
  } catch (_) {
    return false;
  }
}
function getIntegratedInstallSuffix(artifactName, prefix) {
  return artifactName.startsWith(prefix) ? artifactName.slice(prefix.length) : "";
}
function getIntegratedTempMetaPath(tempRoot) {
  return path.join(tempRoot, ".qaqm-install.json");
}
function getIntegratedTempReadyPath(tempRoot) {
  return path.join(tempRoot, ".qaqm-ready");
}
async function readIntegratedTempMeta(tempRoot) {
  try {
    return JSON.parse(await fs.promises.readFile(getIntegratedTempMetaPath(tempRoot), "utf8"));
  } catch (_) {
    return null;
  }
}
async function removeDirectoryIfEmptyAsync(dirPath) {
  try {
    const entries = await fs.promises.readdir(dirPath);
    if (entries.length === 0) {
      await fs.promises.rmdir(dirPath);
      return true;
    }
  } catch (_) {}
  return false;
}
async function recoverIntegratedInstallingRoot(tempRoot, characterPath) {
  const meta = await readIntegratedTempMeta(tempRoot);
  const ready = await pathExistsAsync(getIntegratedTempReadyPath(tempRoot));
  const sourceStillExists = meta?.sourcePath ? await pathExistsAsync(meta.sourcePath) : false;
  let tempEntries = [];
  try {
    tempEntries = (await fs.promises.readdir(tempRoot, {
      withFileTypes: true
    })).filter(entry => !entry.name.startsWith(".qaqm-"));
  } catch (_) {
    return;
  }
  if (tempEntries.length === 0) {
    try {
      await fs.promises.rm(tempRoot, {
        recursive: true,
        force: true
      });
    } catch (_) {}
    return;
  }
  if (!ready && sourceStillExists) {
    try {
      await fs.promises.rm(tempRoot, {
        recursive: true,
        force: true
      });
    } catch (_) {}
    return;
  }
  const suffix = getIntegratedInstallSuffix(path.basename(tempRoot), ".qaqm-installing-");
  const backupRoot = path.join(characterPath, `.qaqm-replacebak-${suffix}`);
  for (const entry of tempEntries) {
    const tempPath = path.join(tempRoot, entry.name);
    const targetPath = path.join(characterPath, entry.name);
    const backupPath = path.join(backupRoot, entry.name);
    let hasBackup = false;
    try {
      if (await pathExistsAsync(targetPath)) {
        await fs.promises.mkdir(backupRoot, {
          recursive: true
        });
        await systemFiles.movePathToRecycleBin(backupPath, "discard stale integrated backup");
        await fs.promises.rename(targetPath, backupPath);
        hasBackup = true;
      }
      await fs.promises.rename(tempPath, targetPath);
      try {
        await systemFiles.movePathToRecycleBin(backupPath, "cleanup recovered integrated backup");
        await removeDirectoryIfEmptyAsync(backupRoot);
      } catch (cleanupError) {
        coreLogger.logger.warn(`[IntegratedPackage] Failed to cleanup recovered backup ${backupPath}: ${cleanupError?.message || cleanupError}`);
      }
    } catch (error) {
      try {
        if (!(await pathExistsAsync(targetPath)) && hasBackup && (await pathExistsAsync(backupPath))) {
          await fs.promises.rename(backupPath, targetPath);
        }
      } catch (restoreError) {
        coreLogger.logger.warn(`[IntegratedPackage] Failed to restore backup ${backupPath}: ${restoreError?.message || restoreError}`);
      }
      coreLogger.logger.warn(`[IntegratedPackage] Failed to recover installing artifact ${tempPath}: ${error?.message || error}`);
      return;
    }
  }
  try {
    await fs.promises.rm(tempRoot, {
      recursive: true,
      force: true
    });
  } catch (_) {}
}
async function recoverIntegratedBackupRoot(backupRoot, characterPath) {
  try {
    const backupEntries = await fs.promises.readdir(backupRoot, {
      withFileTypes: true
    });
    for (const backupEntry of backupEntries) {
      const backupPath = path.join(backupRoot, backupEntry.name);
      const targetPath = path.join(characterPath, backupEntry.name);
      if (await pathExistsAsync(targetPath)) {
        await systemFiles.movePathToRecycleBin(backupPath, "cleanup recovered integrated backup");
      } else {
        await fs.promises.rename(backupPath, targetPath);
      }
    }
    await removeDirectoryIfEmptyAsync(backupRoot);
  } catch (error) {
    coreLogger.logger.warn(`[IntegratedPackage] Failed to recover backup artifact ${backupRoot}: ${error?.message || error}`);
  }
}
async function recoverIntegratedInstallArtifacts(targetModsDir) {
  let characterDirs = [];
  try {
    characterDirs = await fs.promises.readdir(targetModsDir, {
      withFileTypes: true
    });
  } catch (_) {
    return;
  }
  for (const characterDir of characterDirs) {
    if (!characterDir.isDirectory() || characterDir.name.startsWith(".")) continue;
    const characterPath = path.join(targetModsDir, characterDir.name);
    let entries = [];
    try {
      entries = await fs.promises.readdir(characterPath, {
        withFileTypes: true
      });
    } catch (_) {
      continue;
    }
    for (const entry of entries) {
      const artifactPath = path.join(characterPath, entry.name);
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith(".qaqm-installing-")) {
        await recoverIntegratedInstallingRoot(artifactPath, characterPath);
      }
    }
    try {
      entries = await fs.promises.readdir(characterPath, {
        withFileTypes: true
      });
    } catch (_) {
      continue;
    }
    for (const entry of entries) {
      const artifactPath = path.join(characterPath, entry.name);
      if (entry.isDirectory() && entry.name.startsWith(".qaqm-replacebak-")) {
        await recoverIntegratedBackupRoot(artifactPath, characterPath);
      }
    }
  }
}
async function buildIntegratedCopyPlan(sourceModsDir, targetModsDir, gameId2 = gamesSettings.getActiveGameScopeId()) {
  const sourceEntries = await fs.promises.readdir(sourceModsDir, {
    withFileTypes: true
  });
  const characterDirs = sourceEntries.filter(entry => entry.isDirectory() && !entry.name.startsWith("."));
  const plan = [];
  const affectedCharacters = new Set();
  for (const characterDir of characterDirs) {
    const canonicalCharacterName = charactersDirectories.getCanonicalCharacterConfigKey(characterDir.name, gameId2);
    const sourceCharacterDir = path.join(sourceModsDir, characterDir.name);
    const targetCharacterDir = path.join(targetModsDir, canonicalCharacterName);
    const childEntries = await fs.promises.readdir(sourceCharacterDir, {
      withFileTypes: true
    });
    let characterHasContent = false;
    for (const entry of childEntries) {
      if (entry.name.startsWith(".")) continue;
      const sourcePath = path.join(sourceCharacterDir, entry.name);
      const targetName = entry.isDirectory() && charactersHidden.isCharacterHidden(canonicalCharacterName, gameId2) && !/^DISABLED_/i.test(entry.name) ? `DISABLED_${entry.name}` : entry.name;
      const targetPath = path.join(targetCharacterDir, targetName);
      const label = canonicalCharacterName === characterDir.name ? `${canonicalCharacterName} / ${entry.name}` : `${characterDir.name} -> ${canonicalCharacterName} / ${entry.name}`;
      if (entry.isDirectory()) {
        if (!systemFiles.directoryHasAnyFile(sourcePath)) continue;
        plan.push({
          characterName: canonicalCharacterName,
          modName: entry.name,
          label,
          sourcePath,
          targetPath,
          sourceIsDirectory: true,
          countsAsMod: true
        });
        characterHasContent = true;
      } else if (entry.isFile()) {
        plan.push({
          characterName: canonicalCharacterName,
          modName: entry.name,
          label,
          sourcePath,
          targetPath,
          sourceIsDirectory: false,
          countsAsMod: false
        });
        characterHasContent = true;
      }
    }
    if (characterHasContent) affectedCharacters.add(canonicalCharacterName);
  }
  return {
    plan,
    affectedCharacters: Array.from(affectedCharacters)
  };
}
async function writeIntegratedTempMeta(tempRoot, meta) {
  await fs.promises.mkdir(tempRoot, {
    recursive: true
  });
  await fs.promises.writeFile(getIntegratedTempMetaPath(tempRoot), JSON.stringify(meta, null, 2), "utf8");
}
async function markIntegratedTempReady(tempRoot) {
  await fs.promises.writeFile(getIntegratedTempReadyPath(tempRoot), String(Date.now()), "utf8");
}
async function movePathToInstallTemp(sourcePath, tempPath, sourceIsDirectory, meta) {
  const tempRoot = path.dirname(tempPath);
  await fs.promises.mkdir(tempRoot, {
    recursive: true
  });
  await fs.promises.rm(tempPath, {
    recursive: true,
    force: true
  });
  await writeIntegratedTempMeta(tempRoot, meta);
  let readyMarked = false;
  const movedFiles = await systemFiles.movePathWithFallbackAsync(sourcePath, tempPath, sourceIsDirectory, {
    onReadyToRemoveSource: async () => {
      await markIntegratedTempReady(tempRoot);
      readyMarked = true;
    }
  });
  if (!readyMarked) {
    await markIntegratedTempReady(tempRoot);
  }
  return movedFiles;
}
async function movePathWithReplaceSafety(sourcePath, targetPath, sourceIsDirectory, installId) {
  const parentDir = path.dirname(targetPath);
  const entryName = path.basename(targetPath);
  const tempRoot = path.join(parentDir, `.qaqm-installing-${installId}`);
  const backupRoot = path.join(parentDir, `.qaqm-replacebak-${installId}`);
  const tempPath = path.join(tempRoot, entryName);
  const backupPath = path.join(backupRoot, entryName);
  const meta = {
    sourcePath,
    targetPath,
    entryName,
    sourceIsDirectory,
    createdAt: Date.now()
  };
  let movedFiles = 0;
  try {
    movedFiles = await movePathToInstallTemp(sourcePath, tempPath, sourceIsDirectory, meta);
  } catch (error) {
    if (await pathExistsAsync(sourcePath)) {
      try {
        await fs.promises.rm(tempRoot, {
          recursive: true,
          force: true
        });
      } catch (_) {}
    }
    throw error;
  }
  let hasBackup = false;
  try {
    if (await pathExistsAsync(targetPath)) {
      await fs.promises.mkdir(backupRoot, {
        recursive: true
      });
      await systemFiles.movePathToRecycleBin(backupPath, "discard stale integrated backup");
      await fs.promises.rename(targetPath, backupPath);
      hasBackup = true;
    }
    await fs.promises.rename(tempPath, targetPath);
    try {
      await fs.promises.rm(tempRoot, {
        recursive: true,
        force: true
      });
    } catch (cleanupError) {
      coreLogger.logger.warn(`[IntegratedPackage] Failed to cleanup install temp ${tempRoot}: ${cleanupError?.message || cleanupError}`);
    }
    try {
      await systemFiles.movePathToRecycleBin(backupRoot, "cleanup replaced integrated backup");
    } catch (cleanupError) {
      coreLogger.logger.warn(`[IntegratedPackage] Failed to cleanup replace backup ${backupRoot}: ${cleanupError?.message || cleanupError}`);
    }
  } catch (error) {
    try {
      if (!(await pathExistsAsync(targetPath)) && hasBackup && (await pathExistsAsync(backupPath))) {
        await fs.promises.rename(backupPath, targetPath);
      }
    } catch (restoreError) {
      coreLogger.logger.warn(`[IntegratedPackage] Failed to restore backup ${backupPath}: ${restoreError?.message || restoreError}`);
    }
    try {
      if (!(await pathExistsAsync(sourcePath)) && (await pathExistsAsync(tempPath))) {
        await systemFiles.movePathWithFallbackAsync(tempPath, sourcePath, sourceIsDirectory);
      }
      if (await pathExistsAsync(sourcePath)) {
        await fs.promises.rm(tempRoot, {
          recursive: true,
          force: true
        });
      }
    } catch (_) {}
    throw error;
  }
  return movedFiles;
}
async function moveIntegratedModsToCurrentMods(sourceModsDir, targetModsDir, {
  onProgress = null,
  gameId: gameId2 = gamesSettings.getActiveGameScopeId(),
  appearanceRequest = null,
  appearanceCharacterName = ""
} = {}) {
  const installId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  await recoverIntegratedInstallArtifacts(targetModsDir);
  const {
    plan,
    affectedCharacters
  } = await buildIntegratedCopyPlan(sourceModsDir, targetModsDir, gameId2);
  let movedFiles = 0;
  let modCount = 0;
  const installedModDirs = [];
  const totalItems = Math.max(1, plan.length);
  const requestedCharacterKey = appearanceCharacterName ? charactersCatalog.normalizeCharacterFolderKey(charactersDirectories.getCanonicalCharacterConfigKey(appearanceCharacterName, gameId2)) : "";
  if (onProgress) {
    onProgress({
      current: 0,
      total: totalItems,
      modName: i18n.t("backend.imports.integrated.preparingPackage"),
      integratedPackage: true
    });
  }
  for (let index = 0; index < plan.length; index++) {
    const item = plan[index];
    if (onProgress) {
      onProgress({
        current: index,
        total: totalItems,
        modName: item.label,
        integratedPackage: true
      });
    }
    await fs.promises.mkdir(path.dirname(item.targetPath), {
      recursive: true
    });
    movedFiles += await movePathWithReplaceSafety(item.sourcePath, item.targetPath, item.sourceIsDirectory, installId);
    if (item.countsAsMod && systemFiles.directoryHasAnyFile(item.targetPath)) {
      try {
        const useRequestedAppearance = !!appearanceRequest && !!requestedCharacterKey && charactersCatalog.normalizeCharacterFolderKey(item.characterName) === requestedCharacterKey;
        modsAppearance.assignInstalledModAppearance({
          characterName: item.characterName,
          modName: item.modName.replace(/^DISABLED_/i, ""),
          modDir: item.targetPath,
          requested: useRequestedAppearance ? appearanceRequest : null,
          gameId: gameId2,
          source: useRequestedAppearance ? "explicit-integrated" : "integrated-import"
        });
      } catch (error) {
        coreLogger.logger.warn(`[IntegratedPackage] Failed to classify ${item.label}: ${error?.message || error}`);
      }
      installedModDirs.push(item.targetPath);
      modCount++;
    }
    if (onProgress) {
      onProgress({
        current: index + 1,
        total: totalItems,
        modName: item.label,
        integratedPackage: true
      });
    }
  }
  return {
    movedFiles,
    copiedFiles: movedFiles,
    modCount,
    characterCount: affectedCharacters.length,
    affectedCharacters,
    installedModDirs,
    totalItems
  };
}
async function installIntegratedModsPackageIfPresent(sourceRoot, {
  cleanupSource = false,
  onProgress = null,
  gameId: gameId2 = gamesSettings.getActiveGameScopeId(),
  appearanceRequest = null,
  appearanceCharacterName = ""
} = {}) {
  const sourceModsDir = findIntegratedModsDir(sourceRoot);
  if (!sourceModsDir) return null;
  const modsPathStatus = gamesSettings.getModsPathStatus({
    requireExisting: false,
    gameId: gameId2
  });
  if (!modsPathStatus.ok) {
    throw new Error(modsPathStatus.error || i18n.t("backend.imports.integrated.modsPathMissing"));
  }
  const targetModsDir = modsPathStatus.modsPath;
  if (systemPaths.isSameResolvedPath(sourceModsDir, targetModsDir)) {
    return {
      success: true,
      integratedPackage: true,
      skippedSelfCopy: true,
      sourceModsDir,
      targetModsDir,
      modMode: "integrated",
      modName: "整合包",
      characterName: "__all__",
      characterCount: 0,
      modCount: 0,
      movedFiles: 0,
      copiedFiles: 0,
      totalItems: 0,
      installedModDirs: []
    };
  }
  systemWindows.probeWritableDirectory(targetModsDir, i18n.t("backend.paths.modsDirectory"));
  systemFiles.assertDirectoryHasAnyFile(sourceModsDir, "Integrated Mods package");
  const moveResult = await moveIntegratedModsToCurrentMods(sourceModsDir, targetModsDir, {
    onProgress,
    gameId: gameId2,
    appearanceRequest,
    appearanceCharacterName
  });
  if (moveResult.modCount <= 0 || moveResult.movedFiles <= 0) {
    throw new Error(i18n.t("backend.imports.integrated.integratedContentEmpty"));
  }
  let restoredBakCount = 0;
  for (const modDir of moveResult.installedModDirs) {
    restoredBakCount += modsBackups.restorePersistBakFiles(modDir);
  }
  modsConflicts.clearConflictCache();
  desktopNotifications.notifyAllModWindowsChanged("__all__");
  if (cleanupSource && sourceRoot && fs.existsSync(sourceRoot) && !systemPaths.isSameResolvedPath(sourceRoot, targetModsDir)) {
    try {
      fs.rmSync(sourceRoot, {
        recursive: true,
        force: true
      });
    } catch (_) {}
  }
  coreLogger.logger.info(`[IntegratedPackage] Installed Mods package: source=${sourceModsDir}, target=${targetModsDir}, characters=${moveResult.characterCount}, mods=${moveResult.modCount}, movedFiles=${moveResult.movedFiles}`);
  return {
    success: true,
    integratedPackage: true,
    modMode: "integrated",
    modName: "整合包",
    characterName: "__all__",
    sourceModsDir,
    targetModsDir,
    restoredBakCount,
    ...moveResult
  };
}
