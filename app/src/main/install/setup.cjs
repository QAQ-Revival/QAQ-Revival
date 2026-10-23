"use strict";

const i18n = require("../../shared/i18n/core.cjs");
module.exports = {
  registerIpc,
  resolveXxmiUpdateSourceDir,
  resolveGamePackageUpdateSourceDir
};
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const AdmZip = require("adm-zip");
const crypto = require("crypto");
const archivesDisguised = require("../archives/disguised.cjs");
const archivesTemp = require("../archives/temp.cjs");
const archivesZip = require("../archives/zip.cjs");
const charactersDirectories = require("../characters/directories.cjs");
const charactersOrganization = require("../characters/organization.cjs");
const configStore = require("../config/store.cjs");
const coreLogger = require("../core/logger.cjs");
const desktopNotifications = require("../desktop/notifications.cjs");
const gamesDetection = require("../games/detection.cjs");
const gamesNevernessLaunch = require("../games/neverness/paths.cjs");
const gamesSettings = require("../games/settings.cjs");
const importsBatchScan = require("../imports/batch-scan.cjs");
const importsIntegrated = require("../imports/integrated.cjs");
const installAdvice = require("./advice.cjs");
const installPaths = require("./paths.cjs");
const modsConflicts = require("../mods/conflicts.cjs");
const systemFiles = require("../system/files.cjs");
const systemPaths = require("../system/paths.cjs");
const systemWindows = require("../system/windows.cjs");
function getAutoinstallDir() {
  const isDev = !electron.app.isPackaged;
  if (isDev) {
    return path.join(electron.app.getAppPath(), "resources", "autoinstall");
  }
  return path.join(process.resourcesPath, "autoinstall");
}
function sendSetupProgress(step, message, progress) {
  electron.BrowserWindow.getAllWindows().forEach(w => {
    if (!w.isDestroyed()) {
      w.webContents.send("autoinstall:progress", {
        step,
        message,
        progress
      });
    }
  });
}
function collectDirectoryFilesForUpdate(src, shouldSkipRelPath = null) {
  const allFiles = [];
  function collectFiles(dir, rel) {
    const entries = fs.readdirSync(dir, {
      withFileTypes: true
    });
    for (const entry of entries) {
      const relPath = path.join(rel, entry.name);
      const normalizedRel = relPath.replace(/\\/g, "/");
      if (shouldSkipRelPath?.(normalizedRel, entry)) continue;
      const srcPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        collectFiles(srcPath, relPath);
      } else {
        allFiles.push({
          srcPath,
          relPath: normalizedRel
        });
      }
    }
  }
  collectFiles(src, "");
  return allFiles;
}
function copyDirectoryUpdateSource({
  sourceDir,
  targetDir,
  step,
  messagePrefix,
  shouldSkipRelPath
}) {
  const files = collectDirectoryFilesForUpdate(sourceDir, shouldSkipRelPath);
  if (files.length === 0) {
    return {
      copied: 0
    };
  }
  let copied = 0;
  for (const file of files) {
    const destPath = path.join(targetDir, file.relPath);
    fs.mkdirSync(path.dirname(destPath), {
      recursive: true
    });
    fs.copyFileSync(file.srcPath, destPath);
    copied += 1;
    if (copied % 10 === 0 || copied === files.length) {
      sendSetupProgress(step, `${messagePrefix}: ${file.relPath}`, Math.round(10 + copied / files.length * 85));
    }
  }
  return {
    copied
  };
}
function resolveXxmiUpdateSourceDir(sourcePath) {
  if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isDirectory()) return null;
  if (path.basename(sourcePath).toLowerCase() === "resources") return sourcePath;
  const nestedResources = path.join(sourcePath, "Resources");
  if (fs.existsSync(nestedResources) && fs.statSync(nestedResources).isDirectory()) {
    return nestedResources;
  }
  const singleChild = getSingleDirectoryChild(sourcePath);
  if (singleChild) {
    const childResources = path.join(singleChild.path, "Resources");
    if (fs.existsSync(childResources) && fs.statSync(childResources).isDirectory()) {
      return childResources;
    }
  }
  return sourcePath;
}
function isTopLevelModsRelPath(normalizedRelPath) {
  const value = String(normalizedRelPath || "").replace(/\\/g, "/");
  return value === "Mods" || value.startsWith("Mods/");
}
function getSingleDirectoryChild(dirPath) {
  try {
    const dirs = fs.readdirSync(dirPath, {
      withFileTypes: true
    }).filter(entry2 => entry2.isDirectory());
    if (dirs.length !== 1) return null;
    const entry = dirs[0];
    return {
      name: entry.name,
      path: path.join(dirPath, entry.name)
    };
  } catch (_) {
    return null;
  }
}
function looksLikeGamePackageDir(dirPath) {
  const markers = ["Core", "ShaderFixes", "Mods", "d3dx.ini", "3DMigoto Loader.exe"];
  return markers.some(name => fs.existsSync(path.join(dirPath, name)));
}
function resolveGamePackageUpdateSourceDir(sourcePath, packageDir) {
  if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isDirectory()) return null;
  const packageName = path.basename(packageDir);
  if (path.basename(sourcePath).toLowerCase() === packageName.toLowerCase()) return sourcePath;
  const directPackageDir = path.join(sourcePath, packageName);
  if (fs.existsSync(directPackageDir) && fs.statSync(directPackageDir).isDirectory()) {
    return directPackageDir;
  }
  const singleChild = getSingleDirectoryChild(sourcePath);
  if (singleChild) {
    const reservedNames = new Set(["core", "shaderfixes", "mods", "resources", "bin"]);
    if (!reservedNames.has(singleChild.name.toLowerCase()) && looksLikeGamePackageDir(singleChild.path)) {
      return singleChild.path;
    }
  }
  return sourcePath;
}
function formatSetupSourceSameAsTargetMessage(targetModsDir) {
  return [i18n.t("backend.install.setup.sourceEqualsTarget"), i18n.t("backend.install.setup.currentTarget", {
    targetModsDir
  }), i18n.t("backend.install.setup.selectSeparateSourceAdvice"), i18n.t("backend.install.setup.skipImportAdvice")].join("\n");
}
function formatSetupArchiveExternalExtractMessage(filePath) {
  if (importsBatchScan.isLargeArchiveForExternalExtraction(filePath)) return importsBatchScan.formatLargeArchiveExternalExtractMessage(filePath);
  return [i18n.t("backend.install.setup.archiveDetected", {
    fileName: path.basename(filePath || "") || filePath
  }), i18n.t("backend.install.setup.extractArchiveFirst"), i18n.t("backend.install.setup.useMarketIfUnsureAdvice")].join("\n");
}
function isSetupIntegratedModsRoot(modsDir, gameId2 = gamesSettings.getActiveGameScopeId()) {
  if (!importsIntegrated.isLikelyIntegratedModsRoot(modsDir, {
    allowNamelessRoot: true,
    gameId: gameId2
  })) return false;
  if (path.basename(modsDir).toLowerCase() === "mods") return true;
  try {
    return fs.readdirSync(modsDir, {
      withFileTypes: true
    }).some(entry => entry.isDirectory() && !entry.name.startsWith(".") && !!charactersOrganization.getKnownCharacterDisplayName(entry.name, gameId2));
  } catch (_) {
    return false;
  }
}
function findSetupIntegratedModsDirUnder(rootDir, maxDepth, gameId2) {
  const queue = [{
    dirPath: rootDir,
    depth: 0
  }];
  const visited = new Set();
  while (queue.length > 0) {
    const current = queue.shift();
    let resolved;
    try {
      resolved = path.resolve(current.dirPath);
      const key = systemPaths.normalizeComparablePath(resolved);
      if (!resolved || visited.has(key)) continue;
      visited.add(key);
      if (!fs.statSync(resolved).isDirectory()) continue;
    } catch (_) {
      continue;
    }
    if (isSetupIntegratedModsRoot(resolved, gameId2)) return resolved;
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
function findSetupIntegratedModsDir(sourceRoot, targetModsDir, gameId2 = gamesSettings.getActiveGameScopeId()) {
  if (!sourceRoot || !fs.existsSync(sourceRoot) || !fs.statSync(sourceRoot).isDirectory()) return null;
  const candidates = [];
  const addCandidateRoot = (dirPath, label, depth = 3) => {
    if (!dirPath || !fs.existsSync(dirPath)) return;
    try {
      if (!fs.statSync(dirPath).isDirectory()) return;
    } catch (_) {
      return;
    }
    const modsDir = findSetupIntegratedModsDirUnder(dirPath, depth, gameId2);
    if (!modsDir) return;
    const normalized = systemPaths.normalizeComparablePath(modsDir);
    if (candidates.some(item => systemPaths.normalizeComparablePath(item.modsDir) === normalized)) return;
    candidates.push({
      modsDir,
      label
    });
  };
  addCandidateRoot(sourceRoot, i18n.t("backend.games.settings.currentFolder"), 3);
  const parent = path.dirname(sourceRoot);
  if (parent && parent !== sourceRoot) {
    addCandidateRoot(parent, i18n.t("backend.install.setup.parentFolder"), 2);
    const grandParent = path.dirname(parent);
    if (grandParent && grandParent !== parent) {
      addCandidateRoot(grandParent, i18n.t("backend.install.setup.grandparentFolder"), 1);
    }
  }
  const usable = candidates.find(item => !systemPaths.isSameResolvedPath(item.modsDir, targetModsDir));
  return usable || candidates[0] || null;
}
async function importSetupIntegratedModsDir(sourceModsDir, modsDir, gameId2) {
  if (systemPaths.isSameResolvedPath(sourceModsDir, modsDir)) {
    return {
      error: formatSetupSourceSameAsTargetMessage(modsDir),
      code: "SOURCE_EQUALS_TARGET"
    };
  }
  systemWindows.probeWritableDirectory(modsDir, i18n.t("backend.validation.targetModsDirectory"));
  systemFiles.assertDirectoryHasAnyFile(sourceModsDir, "Setup wizard Mods source");
  const result = await importsIntegrated.moveIntegratedModsToCurrentMods(sourceModsDir, modsDir, {
    gameId: gameId2 || gamesSettings.getActiveGameScopeId(),
    onProgress: progress => {
      sendSetupProgress("import-mods", progress?.modName ? i18n.t("backend.install.setup.importingNamedMod", {
        modName: progress.modName
      }) : i18n.t("backend.install.setup.importingIntegratedMods"), Math.round(5 + (progress?.current || 0) / Math.max(1, progress?.total || 1) * 90));
    }
  });
  if (result.modCount <= 0 || result.movedFiles <= 0) {
    return {
      error: i18n.t("backend.install.setup.integratedModsEmpty")
    };
  }
  modsConflicts.clearConflictCache(null, gameId2 || gamesSettings.getActiveGameScopeId());
  desktopNotifications.notifyAllModWindowsChanged("__all__");
  return {
    success: true,
    integratedPackage: true,
    sourceModsDir,
    targetModsDir: modsDir,
    copiedDirs: result.modCount,
    totalFilesCopied: result.movedFiles,
    copiedFiles: result.copiedFiles || result.movedFiles,
    movedFiles: result.movedFiles,
    modCount: result.modCount,
    characterCount: result.characterCount,
    affectedCharacters: result.affectedCharacters || []
  };
}
function registerIpc() {
  electron.ipcMain.handle("autoinstall:get-bundled-packages", async () => {
    try {
      const dir = getAutoinstallDir();
      if (!fs.existsSync(dir)) return {
        packages: []
      };
      const files = installPaths.listBundledAutoinstallFiles(dir);
      const packages = [];
      const xxmiBasePackage = installPaths.resolveBundledAutoinstallPackage(files, "xxmi-base");
      if (xxmiBasePackage) packages.push({
        type: "xxmi-base",
        file: xxmiBasePackage.file,
        version: xxmiBasePackage.version,
        label: i18n.t("backend.genshinDiagnostics.xxmiLauncherTitle")
      });
      const nemiPackage = installPaths.resolveBundledAutoinstallPackage(files, "NEMI");
      if (nemiPackage) {
        packages.push({
          type: "nemi",
          file: nemiPackage.file,
          version: nemiPackage.version,
          label: i18n.t("backend.install.setup.nevernessNemiTitle")
        });
      }
      for (const importerName of installPaths.BUNDLED_GAME_IMPORTERS) {
        const bundledPackage = installPaths.resolveBundledGamePackage(files, importerName);
        if (bundledPackage) {
          const gameLabels = {
            WWMI: "鸣潮",
            ZZMI: "绝区零",
            EFMI: "终末地",
            SRMI: "星穹铁道",
            GIMI: "原神"
          };
          packages.push({
            type: "game-package",
            file: bundledPackage.file,
            version: bundledPackage.version,
            importer: importerName,
            label: i18n.t("backend.install.setup.gamePackageTitle", {
              importerName: gameLabels[importerName] || importerName
            })
          });
        }
      }
      return {
        packages
      };
    } catch (e) {
      return {
        packages: [],
        error: e.message
      };
    }
  });
  electron.ipcMain.handle("autoinstall:select-folder", async (_, title, options = {}) => {
    const result = await electron.dialog.showOpenDialog({
      title: title || i18n.t("backend.install.setup.chooseFolder"),
      properties: ["openDirectory"]
    });
    if (result.canceled || !result.filePaths.length) return {
      canceled: true
    };
    const selectedPath = result.filePaths[0];
    if (gamesSettings.shouldResolveFolderSelectionAsMods(title, options)) {
      const resolved = gamesSettings.resolveSelectedModsFolder(selectedPath, {
        gameId: options?.gameId
      });
      if (!resolved.ok) {
        return {
          canceled: false,
          success: false,
          error: resolved.error,
          candidates: resolved.candidates || []
        };
      }
      return {
        canceled: false,
        success: true,
        ...resolved,
        path: resolved.path
      };
    }
    return {
      canceled: false,
      success: true,
      path: selectedPath
    };
  });
  electron.ipcMain.handle("autoinstall:select-zip", async (_, title) => {
    const result = await electron.dialog.showOpenDialog({
      title: title || i18n.t("backend.install.setup.chooseArchive"),
      properties: ["openFile"],
      filters: [{
        name: i18n.t("backend.install.setup.archiveFilter"),
        extensions: ["zip"]
      }]
    });
    if (result.canceled || !result.filePaths.length) return {
      canceled: true
    };
    return {
      canceled: false,
      path: result.filePaths[0]
    };
  });
  electron.ipcMain.handle("autoinstall:select-update-source", async (_, title) => {
    const result = await electron.dialog.showOpenDialog({
      title: title || i18n.t("backend.install.setup.selectUpdatePackageOrExtractedFolder"),
      properties: ["openFile", "openDirectory"],
      filters: [{
        name: i18n.t("backend.install.setup.zIPPackage"),
        extensions: ["zip"]
      }]
    });
    if (result.canceled || !result.filePaths.length) return {
      canceled: true
    };
    const selectedPath = result.filePaths[0];
    const sourceType = fs.existsSync(selectedPath) && fs.statSync(selectedPath).isDirectory() ? "folder" : "zip";
    return {
      canceled: false,
      path: selectedPath,
      sourceType
    };
  });
  electron.ipcMain.handle("autoinstall:select-mod-source", async (_, title) => {
    const result = await electron.dialog.showOpenDialog({
      title: title || i18n.t("backend.install.setup.chooseModSource"),
      properties: ["openFile", "openDirectory"],
      filters: [{
        name: i18n.t("backend.install.setup.modSourceFilter"),
        extensions: ["mp4", "zip", "rar", "7z", "exe"]
      }, {
        name: i18n.t("backend.install.setup.allFiles"),
        extensions: ["*"]
      }]
    });
    if (result.canceled || !result.filePaths.length) return {
      canceled: true
    };
    const selectedPath = result.filePaths[0];
    const sourceType = fs.existsSync(selectedPath) && fs.statSync(selectedPath).isDirectory() ? "folder" : "file";
    return {
      canceled: false,
      success: true,
      path: selectedPath,
      sourceType
    };
  });
  electron.ipcMain.handle("autoinstall:install-xxmi", async (_, {
    installPath
  }) => {
    const finalInstallPath = installAdvice.resolveNamedAutoinstallDir(installPath, "XXMI");
    let baseZip = path.join(getAutoinstallDir(), "xxmi-base.zip");
    try {
      const autoDir = getAutoinstallDir();
      const files = installPaths.listBundledAutoinstallFiles(autoDir);
      const bundledPackage = installPaths.resolveBundledAutoinstallPackage(files, "xxmi-base");
      if (bundledPackage) baseZip = path.join(autoDir, bundledPackage.file);
      if (!fs.existsSync(baseZip)) {
        return {
          error: i18n.t("backend.install.setup.xxmiPackageMissing")
        };
      }
      systemWindows.probeWritableDirectory(finalInstallPath, i18n.t("backend.validation.xxmiInstallDirectory"));
      sendSetupProgress("xxmi", i18n.t("backend.install.setup.extractingXxmi"), 10);
      const zip = new AdmZip(baseZip);
      const entries = zip.getEntries();
      const totalEntries = entries.length;
      let extracted = 0;
      for (const entry of entries) {
        const result = archivesZip.extractZipEntryWithCjkSupport(entry, finalInstallPath);
        const displayName = result?.displayName || archivesZip.decodeZipEntryName(entry);
        extracted++;
        const pct = Math.round(10 + extracted / totalEntries * 50);
        if (extracted % 20 === 0 || extracted === totalEntries) {
          sendSetupProgress("xxmi", i18n.t("backend.install.setup.extractingEntry", {
            displayName
          }), pct);
        }
      }
      const launcherExe = path.join(finalInstallPath, "Resources", "Bin", "XXMI Launcher.exe");
      const launcherExists = fs.existsSync(launcherExe);
      if (!launcherExists) {
        return {
          error: installAdvice.buildXxmiLauncherMissingAdvice(launcherExe),
          installPath: finalInstallPath,
          launcherExe: null
        };
      }
      sendSetupProgress("xxmi", i18n.t("backend.install.setup.xxmiInstalled"), 100);
      coreLogger.logger.info("Autoinstall: XXMI installed to", finalInstallPath);
      return {
        success: true,
        installPath: finalInstallPath,
        baseDir: path.dirname(finalInstallPath),
        launcherExe
      };
    } catch (e) {
      coreLogger.logger.error("Autoinstall XXMI error:", e);
      return {
        error: i18n.t("backend.install.setup.xxmiInstallFailed", {
          autoinstallArchiveError: installAdvice.formatAutoinstallArchiveError(e, baseZip, "XXMI", {
            path: finalInstallPath || installPath,
            operation: "install-xxmi"
          })
        })
      };
    }
  });
  electron.ipcMain.handle("autoinstall:install-nemi", async (_, {
    installPath,
    gamePath,
    sourceZip
  }) => {
    try {
      let zipPath = sourceZip;
      if (!zipPath) {
        const autoDir = getAutoinstallDir();
        const files = installPaths.listBundledAutoinstallFiles(autoDir);
        const bundledPackage = installPaths.resolveBundledAutoinstallPackage(files, "NEMI");
        zipPath = bundledPackage ? path.join(autoDir, bundledPackage.file) : path.join(autoDir, "NEMI.zip");
      }
      if (!fs.existsSync(zipPath)) {
        return {
          error: i18n.t("backend.install.setup.nemiPackageMissing", {
            zipPath
          })
        };
      }
      systemWindows.probeWritableDirectory(installPath, i18n.t("backend.validation.nemiInstallDirectory"));
      sendSetupProgress("nemi", i18n.t("backend.install.setup.extractingNemi"), 10);
      const zip = new AdmZip(zipPath);
      const entries = zip.getEntries();
      let extracted = 0;
      for (const entry of entries) {
        const result = archivesZip.extractZipEntryWithCjkSupport(entry, installPath);
        const displayName = result?.displayName || archivesZip.decodeZipEntryName(entry);
        extracted++;
        const pct = Math.round(10 + extracted / entries.length * 80);
        if (extracted % 20 === 0 || extracted === entries.length) {
          sendSetupProgress("nemi", i18n.t("backend.install.setup.extractingEntry", {
            displayName
          }), pct);
        }
      }
      const directStartCmd = path.join(installPath, "Start.cmd");
      const nestedRoot = path.join(installPath, "NEMI-main");
      const nemiRoot = fs.existsSync(directStartCmd) ? installPath : nestedRoot;
      const startCmd = path.join(nemiRoot, "Start.cmd");
      const loaderExe = path.join(nemiRoot, "3DMigoto Loader.exe");
      const modsDir = path.join(nemiRoot, "Mods");
      if (!fs.existsSync(startCmd) && !fs.existsSync(loaderExe)) {
        return {
          error: i18n.t("backend.install.setup.invalidNemiStructure")
        };
      }
      systemWindows.probeWritableDirectory(modsDir, i18n.t("backend.validation.nemiModsDirectory"));
      const updates = {
        modFolderPath: modsDir,
        modLoaderPath: fs.existsSync(startCmd) ? startCmd : loaderExe,
        launchMode: "NEMI",
        launchArgs: "-dx11"
      };
      if (gamePath) {
        if (gamesNevernessLaunch.isNevernessProtectedClientExecutable(gamePath)) {
          const officialLaunchPath = gamesNevernessLaunch.resolveNevernessOfficialLaunchPath(gamePath);
          if (!officialLaunchPath) {
            return {
              error: i18n.t("backend.install.setup.nevernessInternalClientSelected")
            };
          }
          updates.gamePath = officialLaunchPath;
        } else {
          updates.gamePath = gamePath;
        }
      }
      if (configStore.currentConfig.activeGameId !== "neverness-to-everness") {
        configStore.currentConfig.activeGameId = "neverness-to-everness";
      }
      gamesSettings.updateActiveGameConfig(updates);
      const defaults = charactersDirectories.ensureDefaultCharacterFolders(modsDir, "neverness-to-everness");
      electron.BrowserWindow.getAllWindows().forEach(w => {
        if (!w.isDestroyed()) {
          w.webContents.send("mods-changed", {
            characterName: "__all__"
          });
        }
      });
      sendSetupProgress("nemi", i18n.t("backend.install.setup.nemiInstalled"), 100);
      coreLogger.logger.info("Autoinstall: NEMI installed to", nemiRoot);
      return {
        success: true,
        installPath: nemiRoot,
        startCmd: fs.existsSync(startCmd) ? startCmd : null,
        loaderExe: fs.existsSync(loaderExe) ? loaderExe : null,
        modsDir,
        gamePath: updates.gamePath || "",
        defaults
      };
    } catch (e) {
      coreLogger.logger.error("Autoinstall NEMI error:", e);
      return {
        error: i18n.t("backend.install.setup.nemiInstallFailed", {
          windowsFileOperationError: systemWindows.formatWindowsFileOperationError(e, {
            path: installPath,
            operation: "install-nemi"
          })
        })
      };
    }
  });
  electron.ipcMain.handle("autoinstall:install-game-package", async (_, {
    importerName,
    targetDir,
    sourceZip
  }) => {
    const normalizedImporterName = String(importerName || "").trim().toUpperCase();
    if (!installPaths.BUNDLED_GAME_IMPORTERS.includes(normalizedImporterName)) {
      return {
        error: i18n.t("backend.install.setup.unsupportedGamePackage", {
          importerName: importerName || i18n.t("backend.install.setup.unspecifiedGamePackage")
        })
      };
    }
    const packageDir = installAdvice.resolveGamePackageAutoinstallDir(targetDir, normalizedImporterName);
    try {
      let zipPath = sourceZip;
      if (!zipPath) {
        const autoDir = getAutoinstallDir();
        const files = installPaths.listBundledAutoinstallFiles(autoDir);
        const bundledPackage = installPaths.resolveBundledGamePackage(files, normalizedImporterName);
        zipPath = bundledPackage ? path.join(autoDir, bundledPackage.file) : path.join(autoDir, `${normalizedImporterName}.zip`);
      }
      if (!fs.existsSync(zipPath)) {
        return {
          error: i18n.t("backend.install.setup.gamePackageMissing", {
            zipPath
          })
        };
      }
      systemWindows.probeWritableDirectory(packageDir, i18n.t("backend.validation.gamePackageDirectory", {
        normalizedImporterName
      }));
      sendSetupProgress("game-package", i18n.t("backend.install.setup.extractingGamePackage", {
        normalizedImporterName
      }), 10);
      const zip = new AdmZip(zipPath);
      const entries = zip.getEntries();
      const totalEntries = entries.length;
      let extracted = 0;
      for (const entry of entries) {
        const result = archivesZip.extractZipEntryWithCjkSupport(entry, packageDir);
        const displayName = result?.displayName || archivesZip.decodeZipEntryName(entry);
        extracted++;
        const pct = Math.round(10 + extracted / totalEntries * 80);
        if (extracted % 20 === 0 || extracted === totalEntries) {
          sendSetupProgress("game-package", i18n.t("backend.install.setup.extractingEntry", {
            displayName
          }), pct);
        }
      }
      const modsDir = path.join(packageDir, "Mods");
      systemWindows.probeWritableDirectory(modsDir, i18n.t("backend.validation.importerModsDirectory", {
        normalizedImporterName
      }));
      if (!fs.existsSync(modsDir)) {
        return {
          error: installAdvice.buildGamePackageMissingAdvice(normalizedImporterName, modsDir),
          packageDir,
          modsDir
        };
      }
      sendSetupProgress("game-package", i18n.t("backend.install.setup.gamePackageInstalled", {
        normalizedImporterName
      }), 100);
      coreLogger.logger.info(`Autoinstall: ${normalizedImporterName} game package installed to`, packageDir);
      return {
        success: true,
        packageDir,
        modsDir
      };
    } catch (e) {
      coreLogger.logger.error("Autoinstall game package error:", e);
      return {
        error: i18n.t("backend.install.setup.gamePackageInstallFailed", {
          windowsFileOperationError: systemWindows.formatWindowsFileOperationError(e, {
            path: packageDir || targetDir,
            operation: "install-game-package"
          })
        })
      };
    }
  });
  electron.ipcMain.handle("autoinstall:configure-xxmi", async (_, {
    xxmiRootDir,
    importerName,
    packageDir,
    gamePath
  }) => {
    try {
      const configPath = path.join(xxmiRootDir, "XXMI Launcher Config.json");
      let config = {};
      if (fs.existsSync(configPath)) {
        try {
          config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        } catch (_2) {
          config = {};
        }
      }
      if (!config.Importers) config.Importers = {};
      if (!config.Importers[importerName]) {
        config.Importers[importerName] = {
          Importer: {},
          Migoto: {}
        };
      }
      if (!config.Importers[importerName].Importer) {
        config.Importers[importerName].Importer = {};
      }
      config.Importers[importerName].Importer.importer_folder = packageDir.replace(/\\/g, "/");
      if (gamePath) {
        const gameDir = path.dirname(gamePath);
        config.Importers[importerName].Importer.game_folder = gameDir.replace(/\\/g, "/");
      }
      if (!config.Launcher) {
        config.Launcher = {
          auto_update: false,
          locale: "CN"
        };
      }
      if (!config.Launcher.enabled_importers) {
        config.Launcher.enabled_importers = [];
      }
      if (!config.Launcher.enabled_importers.includes(importerName)) {
        config.Launcher.enabled_importers.push(importerName);
      }
      fs.writeFileSync(configPath, JSON.stringify(config, null, 4), "utf-8");
      coreLogger.logger.info(`Autoinstall: XXMI config updated for ${importerName}, packageDir=${packageDir}`);
      return {
        success: true,
        configPath
      };
    } catch (e) {
      coreLogger.logger.error("Autoinstall configure XXMI error:", e);
      return {
        error: i18n.t("backend.install.setup.xxmiConfigureFailed", {
          reason: e.message
        })
      };
    }
  });
  electron.ipcMain.handle("autoinstall:apply-paths", async (_, {
    gameId: gameId2,
    modFolderPath,
    modLoaderPath,
    gamePath,
    launchMode,
    launchArgs
  }) => {
    try {
      const targetGame = (configStore.currentConfig.games || []).find(g => g.id === gameId2);
      if (!targetGame) {
        return {
          error: i18n.t("backend.install.setup.gameConfigMissing", {
            gameId: gameId2
          })
        };
      }
      const updates = {};
      if (modFolderPath) {
        const resolved = gamesSettings.resolveSelectedModsFolder(modFolderPath, {
          gameId: gameId2
        });
        if (!resolved.ok) return {
          error: resolved.error
        };
        updates.modFolderPath = resolved.path;
      }
      if (modLoaderPath) {
        if (!fs.existsSync(modLoaderPath)) {
          return {
            error: installAdvice.buildMissingXxmiLauncherLaunchError("XXMI", modLoaderPath)
          };
        }
        updates.modLoaderPath = modLoaderPath;
      }
      if (gamePath) updates.gamePath = gamePath;
      if (launchMode) updates.launchMode = launchMode;
      if (launchArgs !== void 0) updates.launchArgs = launchArgs;
      if (configStore.currentConfig.activeGameId !== gameId2) {
        configStore.currentConfig.activeGameId = gameId2;
      }
      gamesSettings.updateActiveGameConfig(updates);
      let defaults = null;
      if (updates.modFolderPath) {
        defaults = charactersDirectories.ensureDefaultCharacterFolders(updates.modFolderPath, gameId2);
        electron.BrowserWindow.getAllWindows().forEach(w => {
          if (!w.isDestroyed()) {
            w.webContents.send("mods-changed", {
              characterName: "__all__"
            });
          }
        });
      }
      return {
        success: true,
        config: gamesSettings.buildRendererConfig(),
        defaults
      };
    } catch (e) {
      return {
        error: e.message
      };
    }
  });
  electron.ipcMain.handle("autoinstall:import-mods", async (_, {
    sourceDir,
    modsDir,
    gameId: gameId2
  }) => {
    let tempDir = null;
    try {
      if (!sourceDir || !fs.existsSync(sourceDir)) {
        return {
          error: i18n.t("backend.install.setup.modSourceMissing", {
            sourceDir: sourceDir || ""
          })
        };
      }
      if (!modsDir) {
        return {
          error: i18n.t("backend.install.setup.modsTargetEmpty")
        };
      }
      if (!fs.existsSync(modsDir)) {
        fs.mkdirSync(modsDir, {
          recursive: true
        });
      }
      sendSetupProgress("import-mods", i18n.t("backend.install.setup.inspectingModSource"), 5);
      const sourcePath = path.resolve(sourceDir);
      const targetModsDir = path.resolve(modsDir);
      const sourceStat = fs.statSync(sourcePath);
      if (sourceStat.isFile()) {
        const ext = path.extname(sourcePath).toLowerCase();
        if (ext === ".mp4") {
          if (!archivesDisguised.isDisguisedMp4(sourcePath)) {
            return {
              error: i18n.t("backend.install.setup.videoNotDisguised")
            };
          }
          tempDir = archivesTemp.ensureTempRootNearPath(sourcePath, `.qaqm-setup-mp4-${Date.now()}-${crypto.randomUUID()}`);
          sendSetupProgress("import-mods", i18n.t("backend.install.setup.decryptingVideo"), 10);
          await archivesDisguised.extractDisguisedMp4(sourcePath, tempDir, {
            onProgress: progress => {
              sendSetupProgress("import-mods", progress?.message || i18n.t("backend.install.setup.decryptingVideo"), Math.min(85, Math.round(10 + Number(progress?.percent || 0) * 0.65)));
            }
          });
          const detected2 = findSetupIntegratedModsDir(tempDir, targetModsDir, gameId2);
          if (!detected2 || !detected2.modsDir) {
            return {
              error: i18n.t("backend.install.setup.integratedVideoStructureMissing")
            };
          }
          const result2 = await importSetupIntegratedModsDir(detected2.modsDir, targetModsDir, gameId2);
          if (result2.success) {
            result2.sourceType = "mp4";
            result2.detectedFrom = detected2.label;
            sendSetupProgress("import-mods", i18n.t("backend.install.setup.modsImported", {
              modCount: result2.modCount || 0
            }), 100);
            coreLogger.logger.info(`Autoinstall: imported MP4 integrated Mods from ${detected2.modsDir} to ${targetModsDir}`);
          }
          return result2;
        }
        if (importsBatchScan.isExternalExtractArchivePath(sourcePath)) {
          return {
            error: formatSetupArchiveExternalExtractMessage(sourcePath),
            code: "EXTERNAL_EXTRACT_REQUIRED"
          };
        }
        return {
          error: i18n.t("backend.install.setup.unsupportedModFile")
        };
      }
      if (!sourceStat.isDirectory()) {
        return {
          error: i18n.t("backend.install.setup.unsupportedSourceType", {
            sourcePath
          })
        };
      }
      const detected = findSetupIntegratedModsDir(sourcePath, targetModsDir, gameId2);
      if (!detected || !detected.modsDir) {
        return {
          error: i18n.t("backend.install.setup.integratedStructureMissing")
        };
      }
      if (systemPaths.isSameResolvedPath(detected.modsDir, targetModsDir)) {
        return {
          error: formatSetupSourceSameAsTargetMessage(targetModsDir),
          code: "SOURCE_EQUALS_TARGET"
        };
      }
      const result = await importSetupIntegratedModsDir(detected.modsDir, targetModsDir, gameId2);
      if (result.success) {
        result.sourceType = "folder";
        result.detectedFrom = detected.label;
      }
      sendSetupProgress("import-mods", i18n.t("backend.install.setup.modsImported", {
        modCount: result.modCount || 0
      }), 100);
      coreLogger.logger.info(`Autoinstall: imported integrated Mods from ${detected.modsDir} to ${targetModsDir}`);
      return result;
    } catch (e) {
      coreLogger.logger.error("Autoinstall import mods error:", e);
      return {
        error: i18n.t("backend.install.setup.modImportFailed", {
          reason: e.message
        })
      };
    } finally {
      if (tempDir && fs.existsSync(tempDir)) {
        try {
          fs.rmSync(tempDir, {
            recursive: true,
            force: true
          });
        } catch (_2) {}
      }
    }
  });
  electron.ipcMain.handle("autoinstall:update-xxmi", async (_, {
    xxmiRootDir,
    updateZipPath,
    updateSourcePath
  }) => {
    try {
      const sourcePath = updateSourcePath || updateZipPath;
      if (!sourcePath || !fs.existsSync(sourcePath)) {
        return {
          error: i18n.t("backend.install.setup.updateSourceMissing", {
            sourcePath: sourcePath || ""
          })
        };
      }
      const resourcesDir = path.join(xxmiRootDir, "Resources");
      if (!fs.existsSync(resourcesDir)) {
        return {
          error: i18n.t("backend.install.setup.xxmiResourcesMissing", {
            resourcesDir
          })
        };
      }
      const sourceStat = fs.statSync(sourcePath);
      if (sourceStat.isDirectory()) {
        const sourceDir = resolveXxmiUpdateSourceDir(sourcePath);
        if (!sourceDir || !fs.existsSync(sourceDir)) {
          return {
            error: i18n.t("backend.install.setup.invalidXXMIUpdateFolder", {
              sourcePath
            })
          };
        }
        sendSetupProgress("update-xxmi", i18n.t("backend.install.setup.copyingXXMIUpdateFolder"), 10);
        copyDirectoryUpdateSource({
          sourceDir,
          targetDir: resourcesDir,
          step: "update-xxmi",
          messagePrefix: "Updating"
        });
      } else {
        sendSetupProgress("update-xxmi", i18n.t("backend.install.setup.extractingXXMIUpdatePackage"), 10);
        const zip = new AdmZip(sourcePath);
        const entries = zip.getEntries();
        let extracted = 0;
        for (const entry of entries) {
          const result = archivesZip.extractZipEntryWithCjkSupport(entry, resourcesDir);
          const displayName = result?.displayName || archivesZip.decodeZipEntryName(entry);
          extracted++;
          if (extracted % 10 === 0 || extracted === entries.length) {
            sendSetupProgress("update-xxmi", i18n.t("backend.install.setup.updating", {
              displayName
            }), Math.round(10 + extracted / entries.length * 85));
          }
        }
      }
      sendSetupProgress("update-xxmi", i18n.t("backend.install.setup.xXMIUpdateComplete"), 100);
      coreLogger.logger.info("Autoinstall: XXMI updated from", sourcePath);
      return {
        success: true
      };
    } catch (e) {
      coreLogger.logger.error("Autoinstall update XXMI error:", e);
      return {
        error: i18n.t("backend.install.setup.updateXXMIFailed", {
          reason: e.message
        })
      };
    }
  });
  electron.ipcMain.handle("autoinstall:update-game-package", async (_, {
    packageDir,
    updateZipPath,
    updateSourcePath
  }) => {
    try {
      const sourcePath = updateSourcePath || updateZipPath;
      if (!sourcePath || !fs.existsSync(sourcePath)) {
        return {
          error: i18n.t("backend.install.setup.updateSourceNotFound", {
            sourcePath: sourcePath || ""
          })
        };
      }
      if (!fs.existsSync(packageDir)) {
        return {
          error: i18n.t("backend.install.setup.gamePackageDirectoryNotFound", {
            packageDir
          })
        };
      }
      const sourceStat = fs.statSync(sourcePath);
      if (sourceStat.isDirectory()) {
        const sourceDir = resolveGamePackageUpdateSourceDir(sourcePath, packageDir);
        if (!sourceDir || !fs.existsSync(sourceDir)) {
          return {
            error: i18n.t("backend.install.setup.invalidGamePackageUpdateFolder", {
              sourcePath
            })
          };
        }
        sendSetupProgress("update-game-package", i18n.t("backend.install.setup.copyingGamePackageUpdateFolder"), 10);
        copyDirectoryUpdateSource({
          sourceDir,
          targetDir: packageDir,
          step: "update-game-package",
          messagePrefix: "Updating",
          shouldSkipRelPath: (normalizedRel, entry) => entry.isDirectory() && isTopLevelModsRelPath(normalizedRel)
        });
      } else {
        sendSetupProgress("update-game-package", i18n.t("backend.install.setup.extractingGamePackageUpdate"), 10);
        const zip = new AdmZip(sourcePath);
        const entries = zip.getEntries();
        let extracted = 0;
        for (const entry of entries) {
          const decodedName = archivesZip.decodeZipEntryName(entry);
          const normalizedName = decodedName.replace(/\\/g, "/");
          if (isTopLevelModsRelPath(normalizedName)) {
            continue;
          }
          const result = archivesZip.extractZipEntryWithCjkSupport(entry, packageDir);
          const displayName = result?.displayName || decodedName;
          extracted++;
          if (extracted % 10 === 0 || extracted === entries.length) {
            sendSetupProgress("update-game-package", i18n.t("backend.install.setup.updating", {
              displayName
            }), Math.round(10 + extracted / entries.length * 85));
          }
        }
      }
      sendSetupProgress("update-game-package", i18n.t("backend.install.setup.gamePackageUpdateCompleteModsFolderPreserved"), 100);
      coreLogger.logger.info("Autoinstall: game package updated at", packageDir, "from", sourcePath);
      return {
        success: true
      };
    } catch (e) {
      coreLogger.logger.error("Autoinstall update game package error:", e);
      return {
        error: i18n.t("backend.install.setup.updateGamePackageFailed", {
          reason: e.message
        })
      };
    }
  });
  electron.ipcMain.handle("autoinstall:detect-game-path", async (_, gameId2) => {
    try {
      const gameDetection = {
        endfield: (() => {
          const candidates2 = [];
          const regPath = gamesDetection.readRegistryValue("HKCU\\SOFTWARE\\Hypergryph\\Launcher", "InstallPath");
          if (regPath) candidates2.push(path.join(regPath, "games", "Endfield Game", "Endfield.exe"));
          for (const drive of ["G", "C", "D", "E", "F"]) {
            candidates2.push(`${drive}:\\Hypergryph Launcher\\games\\Endfield Game\\Endfield.exe`);
          }
          return candidates2;
        })(),
        zzz: (() => {
          const candidates2 = [];
          const regInstall = gamesDetection.readRegistryValue("HKCU\\SOFTWARE\\miHoYo\\HYP\\1_1\\nap_cn", "GameInstallPath");
          if (regInstall) candidates2.push(path.join(regInstall, "ZenlessZoneZero.exe"));
          for (const drive of ["G", "C", "D", "E", "F"]) {
            candidates2.push(`${drive}:\\miHoYo Launcher\\games\\ZenlessZoneZero Game\\ZenlessZoneZero.exe`);
            candidates2.push(`${drive}:\\ZenlessZoneZero Game\\ZenlessZoneZero.exe`);
          }
          return candidates2;
        })(),
        "wuthering-waves": (() => {
          const candidates2 = [];
          for (const drive of ["F", "G", "C", "D", "E"]) {
            candidates2.push(`${drive}:\\Wuthering Waves\\Wuthering Waves Game\\Wuthering Waves.exe`);
            candidates2.push(`${drive}:\\Kuro Games\\Wuthering Waves\\Wuthering Waves Game\\Wuthering Waves.exe`);
            candidates2.push(`${drive}:\\KRInstall\\Wuthering Waves\\Wuthering Waves Game\\Wuthering Waves.exe`);
          }
          return candidates2;
        })(),
        "neverness-to-everness": gamesNevernessLaunch.buildNevernessGamePathCandidates(),
        "honkai-star-rail": gamesDetection.buildHonkaiStarRailGamePathCandidates(),
        "genshin-impact": gamesDetection.buildGenshinGamePathCandidates()
      };
      const candidates = gameDetection[gameId2] || [];
      for (const p of candidates) {
        if (fs.existsSync(p)) {
          const gamePath = gameId2 === "neverness-to-everness" ? gamesNevernessLaunch.resolveNevernessDetectedGamePath(p) : p;
          if (!gamePath) continue;
          return {
            found: true,
            gamePath,
            gameDir: path.dirname(gamePath)
          };
        }
      }
      return {
        found: false
      };
    } catch (e) {
      return {
        found: false,
        error: e.message
      };
    }
  });
}
