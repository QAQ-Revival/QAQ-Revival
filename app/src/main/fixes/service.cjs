"use strict";

const i18n = require("../../shared/i18n/core.cjs");
module.exports = {
  registerIpc,
  initialize,
  installManagedFixerFromSource
};
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const {
  createIndependentFixer
} = require("./independent-fixer.cjs");
const crypto = require("crypto");
const archivesExtract = require("../archives/extract.cjs");
const charactersSkins = require("../characters/skins.cjs");
const configStore = require("../config/store.cjs");
const coreLogger = require("../core/logger.cjs");
const desktopWindows = require("../desktop/windows.cjs");
const { WUWA_FIX_GAME_ID } = require("../games/definitions.cjs");
const gamesSettings = require("../games/settings.cjs");
const installManaged = require("../install/managed.cjs");
const modsBackups = require("../mods/backups.cjs");
const systemFiles = require("../system/files.cjs");
const systemPaths = require("../system/paths.cjs");
const systemWindows = require("../system/windows.cjs");
const WUWA_INDEPENDENT_CONFIG_NAME = "config.json";
const MANAGED_FIXER_MANIFEST_NAME = "active-fixer.json";
const MANAGED_FIXER_RUNTIME_DIR = "runtimes";
const MANAGED_FIXER_MAX_FILES = 1e4;
const MANAGED_FIXER_MAX_BYTES = 1024 * 1024 * 1024;
function resolveFixRequestGameId(requestedGameId) {
  const gameId2 = String(requestedGameId || gamesSettings.getActiveGameScopeId()).trim();
  if (!gameId2 || !gamesSettings.getGameById(gameId2) && !gamesSettings.getBuiltInGameDefinition(gameId2)) {
    throw new Error(i18n.t("backend.fixes.service.invalidGame", {
      gameId: gameId2 || i18n.t("backend.fixes.service.emptyGame")
    }));
  }
  return gameId2;
}
function getManagedFixerUserDir(gameId2) {
  const safeGameId = charactersSkins.assertSafeAppearancePathSegment(gameId2, i18n.t("backend.validation.gameId"));
  return path.join(electron.app.getPath("userData"), "fix", safeGameId, "user");
}
function getManagedFixerManifestPath(gameId2) {
  return path.join(getManagedFixerUserDir(gameId2), MANAGED_FIXER_MANIFEST_NAME);
}
function promoteManagedFixerFallbackManifest(gameId2) {
  const manifestPath = getManagedFixerManifestPath(gameId2);
  const active = resolveManagedFixerForGame(gameId2);
  if (!active || systemPaths.isSameResolvedPath(active.manifestPath, manifestPath)) return false;
  const tempPath = `${manifestPath}.recover-${process.pid}-${Date.now()}`;
  fs.mkdirSync(path.dirname(manifestPath), {
    recursive: true
  });
  fs.writeFileSync(tempPath, JSON.stringify(active.manifest, null, 2) + "\n", "utf8");
  try {
    if (fs.existsSync(manifestPath)) fs.rmSync(manifestPath, {
      force: true
    });
    fs.renameSync(tempPath, manifestPath);
    coreLogger.logger.info(`[Fix] Promoted valid fallback fixer manifest before update: ${active.manifestPath}`);
    return true;
  } catch (error) {
    try {
      if (fs.existsSync(tempPath)) fs.rmSync(tempPath, {
        force: true
      });
    } catch (_) {}
    throw error;
  }
}
function writeManagedFixerManifest(gameId2, manifest) {
  const manifestPath = getManagedFixerManifestPath(gameId2);
  const dirPath = path.dirname(manifestPath);
  const tempPath = `${manifestPath}.tmp-${process.pid}-${Date.now()}`;
  const backupPath = `${manifestPath}.bak`;
  promoteManagedFixerFallbackManifest(gameId2);
  fs.mkdirSync(dirPath, {
    recursive: true
  });
  fs.writeFileSync(tempPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  try {
    if (fs.existsSync(manifestPath)) {
      if (fs.existsSync(backupPath)) fs.rmSync(backupPath, {
        force: true
      });
      fs.renameSync(manifestPath, backupPath);
    }
    fs.renameSync(tempPath, manifestPath);
  } catch (error) {
    try {
      if (!fs.existsSync(manifestPath) && fs.existsSync(backupPath)) {
        fs.renameSync(backupPath, manifestPath);
      }
    } catch (_) {}
    try {
      if (fs.existsSync(tempPath)) fs.rmSync(tempPath, {
        force: true
      });
    } catch (_) {}
    throw error;
  }
  return manifestPath;
}
function readManagedFixerManifestCandidates(gameId2) {
  const candidates = [];
  for (const manifestPath of [getManagedFixerManifestPath(gameId2), `${getManagedFixerManifestPath(gameId2)}.bak`]) {
    try {
      if (!fs.existsSync(manifestPath)) continue;
      const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      if (parsed && typeof parsed === "object" && parsed.schemaVersion === 1) {
        candidates.push({
          manifestPath,
          manifest: parsed
        });
      }
    } catch (error) {
      coreLogger.logger.warn(`[Fix] Ignoring invalid managed fixer manifest ${manifestPath}: ${error?.message || error}`);
    }
  }
  return candidates;
}
function resolveManagedFixerForGame(gameId2) {
  const baseDir = getManagedFixerUserDir(gameId2);
  for (const loaded of readManagedFixerManifestCandidates(gameId2)) {
    const relativeExe = String(loaded.manifest.executable || "");
    const exePath = path.resolve(baseDir, relativeExe);
    if (!relativeExe || !systemPaths.isPathInsideDirectory(exePath, baseDir) || !fs.existsSync(exePath)) {
      coreLogger.logger.warn(`[Fix] Managed fixer manifest points to a missing or unsafe path (${loaded.manifestPath}): ${relativeExe}`);
      continue;
    }
    let actualSha256 = "";
    try {
      actualSha256 = hashFileSha256(exePath);
    } catch (_) {
      continue;
    }
    const expectedSha256 = String(loaded.manifest.sha256 || "").toLowerCase();
    if (!expectedSha256 || actualSha256.toLowerCase() !== expectedSha256) {
      coreLogger.logger.warn(`[Fix] Managed fixer hash mismatch (${loaded.manifestPath}): ${exePath}`);
      continue;
    }
    const relativeRuntimeRoot = String(loaded.manifest.runtimeRoot || "");
    const runtimeDir = relativeRuntimeRoot ? path.resolve(baseDir, relativeRuntimeRoot) : path.dirname(exePath);
    if (!systemPaths.isPathInsideDirectory(runtimeDir, baseDir) || !fs.existsSync(runtimeDir)) {
      coreLogger.logger.warn(`[Fix] Managed fixer runtime root is missing or unsafe: ${runtimeDir}`);
      continue;
    }
    if (gameId2 === WUWA_FIX_GAME_ID) {
      const configPath = path.join(runtimeDir, WUWA_INDEPENDENT_CONFIG_NAME);
      const expectedConfigSha256 = String(loaded.manifest.configSha256 || "").toLowerCase();
      try {
        if (!expectedConfigSha256 || !fs.existsSync(configPath) || hashFileSha256(configPath).toLowerCase() !== expectedConfigSha256) {
          coreLogger.logger.warn(`[Fix] Managed Wuwa fixer config hash mismatch: ${configPath}`);
          continue;
        }
        inspectWuwaIndependentConfig(configPath, {
          expectedVersion: ""
        });
      } catch (error) {
        coreLogger.logger.warn(`[Fix] Managed Wuwa fixer config is invalid: ${error?.message || error}`);
        continue;
      }
    }
    return {
      ...loaded,
      exePath,
      runtimeDir,
      sha256: actualSha256,
      originalName: loaded.manifest.originalName || path.basename(exePath)
    };
  }
  return null;
}
function listFixerExeCandidates(rootDir, maxDepth = 5) {
  const candidates = [];
  const visit = (dirPath, depth) => {
    if (depth > maxDepth) return;
    for (const entry of fs.readdirSync(dirPath, {
      withFileTypes: true
    })) {
      if (entry.isSymbolicLink()) continue;
      const entryPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        visit(entryPath, depth + 1);
      } else if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".exe") {
        candidates.push({
          path: entryPath,
          depth
        });
      }
    }
  };
  visit(rootDir, 0);
  return candidates;
}
function chooseFixerExecutable(rootDir, sourceName = "") {
  const candidates = listFixerExeCandidates(rootDir);
  if (!candidates.length) throw new Error(i18n.t("backend.fixes.service.executableMissing"));
  const sourceStem = path.basename(sourceName, path.extname(sourceName)).toLowerCase();
  const scored = candidates.map(candidate => {
    const stem = path.basename(candidate.path, ".exe").toLowerCase();
    let score = -candidate.depth * 4;
    if (/(^|[\s._-])fix(?:er|tool)?(?=$|[\s._-])/i.test(stem) || /修复/.test(stem)) score += 100;
    if (/^(unins|uninstall|setup|update|crash)/i.test(stem)) score -= 200;
    if (sourceStem && (sourceStem.includes(stem) || stem.includes(sourceStem))) score += 20;
    return {
      ...candidate,
      score
    };
  });
  scored.sort((left, right) => right.score - left.score || left.path.localeCompare(right.path));
  if (scored.length > 1 && scored[0].score === scored[1].score) {
    throw new Error(i18n.t("backend.fixes.service.ambiguousExecutables"));
  }
  return scored[0].path;
}
function findFixerRuntimeRoot(sourceExe, packageRoot, gameId2) {
  const exeDir = path.dirname(sourceExe);
  if (gameId2 !== WUWA_FIX_GAME_ID) return exeDir;
  const boundary = path.resolve(packageRoot);
  let cursor = path.resolve(exeDir);
  while (systemPaths.isSameResolvedPath(cursor, boundary) || systemPaths.isPathInsideDirectory(cursor, boundary)) {
    const configPath = path.join(cursor, WUWA_INDEPENDENT_CONFIG_NAME);
    if (fs.existsSync(configPath) && fs.statSync(configPath).isFile()) {
      inspectWuwaIndependentConfig(configPath, {
        expectedVersion: ""
      });
      return cursor;
    }
    if (systemPaths.isSameResolvedPath(cursor, boundary)) break;
    const parent = path.dirname(cursor);
    if (!parent || parent === cursor) break;
    cursor = parent;
  }
  throw new Error(i18n.t("backend.fixes.service.wuwaConfigMissing"));
}
function copyDirectFixerSidecars(sourceExe, targetDir) {
  const sourceDir = path.dirname(sourceExe);
  const knownFiles = new Set(["config.json", "translations.json", "language.json", "lang.json"]);
  const knownDirs = new Set(["lang", "locales"]);
  fs.copyFileSync(sourceExe, path.join(targetDir, path.basename(sourceExe)));
  for (const entry of fs.readdirSync(sourceDir, {
    withFileTypes: true
  })) {
    const lowerName = entry.name.toLowerCase();
    if (entry.isFile() && knownFiles.has(lowerName)) {
      fs.copyFileSync(path.join(sourceDir, entry.name), path.join(targetDir, entry.name));
    } else if (entry.isDirectory() && knownDirs.has(lowerName)) {
      fs.cpSync(path.join(sourceDir, entry.name), path.join(targetDir, entry.name), {
        recursive: true,
        dereference: false
      });
    }
  }
}
async function prepareFixerInstallSource(sourcePath) {
  const resolvedSource = path.resolve(sourcePath);
  const stat = fs.statSync(resolvedSource);
  if (stat.isDirectory()) {
    return {
      rootDir: resolvedSource,
      cleanup: null,
      sourceName: path.basename(resolvedSource)
    };
  }
  const ext = path.extname(resolvedSource).toLowerCase();
  const tempDir = fs.mkdtempSync(path.join(electron.app.getPath("temp"), "qaqm-fixer-install-"));
  try {
    if (ext === ".exe") {
      copyDirectFixerSidecars(resolvedSource, tempDir);
    } else if ([".zip", ".rar", ".7z"].includes(ext)) {
      await archivesExtract.extractArchiveWithExternalTool(resolvedSource, tempDir);
    } else {
      throw new Error(i18n.t("backend.fixes.service.unsupportedSourceType"));
    }
    systemFiles.assertDirectoryHasAnyFile(tempDir, "Fixer package");
    return {
      rootDir: tempDir,
      cleanup: () => {
        try {
          fs.rmSync(tempDir, {
            recursive: true,
            force: true
          });
        } catch (_) {}
      },
      sourceName: path.basename(resolvedSource)
    };
  } catch (error) {
    try {
      fs.rmSync(tempDir, {
        recursive: true,
        force: true
      });
    } catch (_) {}
    throw error;
  }
}
function collectFixerRuntimeFiles(runtimeRoot) {
  const files = [];
  let totalBytes = 0;
  const visit = (dirPath, relativeDir = "") => {
    for (const entry of fs.readdirSync(dirPath, {
      withFileTypes: true
    })) {
      if (entry.isSymbolicLink()) continue;
      const relativePath = path.join(relativeDir, entry.name);
      const sourcePath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        visit(sourcePath, relativePath);
        continue;
      }
      if (!entry.isFile() || entry.name.toLowerCase() === "settings.json") continue;
      totalBytes += fs.statSync(sourcePath).size;
      if (files.length >= MANAGED_FIXER_MAX_FILES || totalBytes > MANAGED_FIXER_MAX_BYTES) {
        throw new Error(i18n.t("backend.fixes.service.runtimeTooLarge"));
      }
      files.push({
        sourcePath,
        relativePath
      });
    }
  };
  visit(runtimeRoot);
  return {
    files,
    totalBytes
  };
}
async function installManagedFixerFromSource(sourcePath, requestedGameId) {
  const gameId2 = installManaged.getManagedTargetGameId(requestedGameId);
  const prepared = await prepareFixerInstallSource(sourcePath);
  let runtimeDir = "";
  let manifestWritten = false;
  try {
    const sourceExe = chooseFixerExecutable(prepared.rootDir, prepared.sourceName);
    const runtimeRoot = findFixerRuntimeRoot(sourceExe, prepared.rootDir, gameId2);
    const sourceExeRelativePath = path.relative(runtimeRoot, sourceExe);
    const sourceConfigPath = gameId2 === WUWA_FIX_GAME_ID ? path.join(runtimeRoot, WUWA_INDEPENDENT_CONFIG_NAME) : "";
    const sourceConfigSha256 = sourceConfigPath ? hashFileSha256(sourceConfigPath) : "";
    const {
      files,
      totalBytes
    } = collectFixerRuntimeFiles(runtimeRoot);
    const sourceSha256 = hashFileSha256(sourceExe);
    const installId = `${sourceSha256.slice(0, 16)}-${Date.now().toString(36)}`;
    const userDir = getManagedFixerUserDir(gameId2);
    runtimeDir = path.join(userDir, MANAGED_FIXER_RUNTIME_DIR, installId);
    fs.mkdirSync(runtimeDir, {
      recursive: true
    });
    for (const file of files) {
      const destination = path.resolve(runtimeDir, file.relativePath);
      if (!systemPaths.isPathInsideDirectory(destination, runtimeDir)) {
        throw new Error(i18n.t("backend.fixes.service.unsafeRuntimePath", {
          relativePath: file.relativePath
        }));
      }
      fs.mkdirSync(path.dirname(destination), {
        recursive: true
      });
      fs.copyFileSync(file.sourcePath, destination);
    }
    const copiedExe = path.resolve(runtimeDir, sourceExeRelativePath);
    if (!fs.existsSync(copiedExe) || hashFileSha256(copiedExe) !== sourceSha256) {
      throw new Error(i18n.t("backend.fixes.service.executableChecksumFailed"));
    }
    let configMetadata = null;
    let configSha256 = "";
    if (gameId2 === WUWA_FIX_GAME_ID) {
      const copiedConfig = path.join(runtimeDir, WUWA_INDEPENDENT_CONFIG_NAME);
      configMetadata = inspectWuwaIndependentConfig(copiedConfig, {
        expectedVersion: ""
      });
      configSha256 = hashFileSha256(copiedConfig);
      if (configSha256 !== sourceConfigSha256) {
        throw new Error(i18n.t("backend.fixes.service.configChecksumFailed"));
      }
    }
    const relativeExe = path.relative(userDir, copiedExe);
    const manifest = {
      schemaVersion: 1,
      gameId: gameId2,
      executable: relativeExe,
      runtimeRoot: path.relative(userDir, runtimeDir),
      originalName: path.basename(sourceExe),
      sha256: sourceSha256,
      configVersion: configMetadata?.currentVersion || "",
      configSha256,
      installedAt: new Date().toISOString(),
      fileCount: files.length,
      totalBytes
    };
    writeManagedFixerManifest(gameId2, manifest);
    manifestWritten = true;
    const active = resolveManagedFixerForGame(gameId2);
    if (!active || !systemPaths.isSameResolvedPath(active.exePath, copiedExe) || active.sha256 !== sourceSha256) {
      throw new Error(i18n.t("backend.fixes.service.activeVersionInvalid"));
    }
    coreLogger.logger.info(`[Fix] Managed fixer installed game=${gameId2} exe=${active.exePath} sha256=${active.sha256}`);
    return {
      success: true,
      managedInstall: true,
      installContentType: "fixer",
      targetGameId: gameId2,
      targetPath: runtimeDir,
      resolvedExePath: active.exePath,
      sha256: active.sha256,
      fileName: active.originalName,
      fileCount: files.length,
      modName: i18n.t("backend.fixes.service.managedFixerName", {
        gameName: gamesSettings.getGameById(gameId2)?.name || gamesSettings.getBuiltInGameDefinition(gameId2)?.name || gameId2
      })
    };
  } catch (error) {
    if (manifestWritten) {
      const manifestPath = getManagedFixerManifestPath(gameId2);
      const backupPath = `${manifestPath}.bak`;
      try {
        if (fs.existsSync(manifestPath)) fs.rmSync(manifestPath, {
          force: true
        });
        if (fs.existsSync(backupPath)) fs.renameSync(backupPath, manifestPath);
      } catch (_) {}
    }
    if (runtimeDir) {
      try {
        fs.rmSync(runtimeDir, {
          recursive: true,
          force: true
        });
      } catch (_) {}
    }
    throw error;
  } finally {
    prepared.cleanup?.();
  }
}
function resolveFixExePath(gameId2) {
  const managed = resolveManagedFixerForGame(gameId2);
  if (managed) {
    coreLogger.logger.info(`[Fix] Using managed user fixer: ${managed.exePath} sha256=${managed.sha256}`);
    return managed.exePath;
  }
  const overrideDir = path.join(electron.app.getPath("userData"), "fix", gameId2);
  const userOverride = path.join(overrideDir, "_override.exe");
  try {
    if (fs.existsSync(userOverride)) {
      if (gameId2 === WUWA_FIX_GAME_ID && !fs.existsSync(path.join(overrideDir, WUWA_INDEPENDENT_CONFIG_NAME))) {
        coreLogger.logger.warn("[WuwaFix] Ignoring legacy override without config.json");
      } else {
        coreLogger.logger.info(`[Fix] Using legacy override: ${userOverride}`);
        return userOverride;
      }
    }
  } catch (_) {}
  return null;
}
function hashFileSha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}
function inspectWuwaIndependentConfig(configPath, {
  expectedVersion = ""
} = {}) {
  let config;
  try {
    config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (error) {
    throw new Error(i18n.t("backend.fixes.service.invalidConfig", {
      reason: error?.message || error
    }));
  }
  const currentVersion = String(config?.version?.current_version || "").trim();
  if (!currentVersion) {
    throw new Error(i18n.t("backend.fixes.service.configVersionMissing"));
  }
  if (expectedVersion && currentVersion !== expectedVersion) {
    throw new Error(i18n.t("backend.fixes.service.configVersionMismatch", {
      expectedVersion,
      currentVersion: currentVersion || i18n.t("backend.fixes.service.emptyGame")
    }));
  }
  for (const key of ["start_processing", "process_file_start", "no_need_fix"]) {
    const translation = config?.lang?.[key]?.zh;
    if (typeof translation !== "string" || !translation.trim()) {
      throw new Error(i18n.t("backend.fixes.service.configLogMissing", {
        key
      }));
    }
  }
  const characters = config?.characters;
  const characterCount = characters && typeof characters === "object" && !Array.isArray(characters) ? Object.keys(characters).length : 0;
  if (characterCount === 0) throw new Error(i18n.t("backend.fixes.service.configRulesMissing"));
  return {
    currentVersion,
    characterCount
  };
}
let independentFixer;
function initialize() {
  independentFixer = createIndependentFixer({
    getSavedPath: gameId => configStore.currentConfig.independentFixerPaths?.[gameId],
    savePath: (gameId, exePath) => {
      const next = {
        ...configStore.currentConfig,
        independentFixerPaths: {
          ...configStore.currentConfig.independentFixerPaths,
          [gameId]: exePath
        }
      };
      if (!configStore.saveConfig(next)) throw new Error(i18n.t("backend.fixes.service.savePathFailed"));
      configStore.currentConfig = next;
    },
    findExisting: resolveFixExePath,
    selectFile: gameId => electron.dialog.showOpenDialog(desktopWindows.mainWindowRef, {
      title: i18n.t("backend.fixes.service.selectPrefix") + (gamesSettings.getGameById(gameId)?.name || gamesSettings.getBuiltInGameDefinition(gameId)?.name || i18n.t("backend.fixes.service.currentGame")) + i18n.t("backend.fixes.service.independentFixerSuffix"),
      buttonLabel: i18n.t("backend.fixes.service.selectFixer"),
      filters: [{
        name: i18n.t("backend.fixes.service.executableFilter"),
        extensions: ["exe"]
      }],
      properties: ["openFile"]
    }),
    launch: (exePath, workingDir) => systemWindows.windowsLauncher.launch(exePath, workingDir, [], {
      requireElevation: false
    })
  });
}
function registerIpc() {
  electron.ipcMain.handle("fix:get-exe-path", async (_, options = {}) => {
    const gameId2 = resolveFixRequestGameId(options?.gameId);
    const exePath = independentFixer.resolve(gameId2);
    return {
      engine: "external",
      gameId: gameId2,
      exePath
    };
  });
  electron.ipcMain.handle("fix:run-all", async (_, options = {}) => {
    try {
      const gameId2 = resolveFixRequestGameId(options?.gameId);
      return await independentFixer.open(gameId2);
    } catch (e) {
      return {
        success: false,
        error: e.message
      };
    }
  });
  electron.ipcMain.handle("fix:run-character", async (_, payload = {}) => {
    try {
      const {
        gameId: requestedGameId
      } = payload || {};
      const gameId2 = resolveFixRequestGameId(requestedGameId);
      return await independentFixer.open(gameId2);
    } catch (e) {
      return {
        success: false,
        error: e.message
      };
    }
  });
  electron.ipcMain.handle("fix:run-mod", async (_, payload = {}) => {
    try {
      const {
        gameId: requestedGameId
      } = payload || {};
      const gameId2 = resolveFixRequestGameId(requestedGameId);
      return await independentFixer.open(gameId2);
    } catch (e) {
      return {
        success: false,
        error: e.message
      };
    }
  });
  electron.ipcMain.handle("ini-backup:list-mod", async (_, {
    characterName,
    modName
  }) => {
    try {
      const backups = modsBackups.listIniBackupsForMod(characterName, modName);
      return {
        success: true,
        backups
      };
    } catch (e) {
      return {
        success: false,
        backups: [],
        error: e.message
      };
    }
  });
  electron.ipcMain.handle("ini-backup:restore-mod", async (_, {
    characterName,
    modName,
    stamp
  }) => {
    try {
      const result = modsBackups.restoreIniBackupForMod(characterName, modName, stamp);
      return result;
    } catch (e) {
      return {
        success: false,
        restoreSucceeded: false,
        cleanupAttempted: false,
        cleanupSucceeded: false,
        snapshotDeleted: false,
        cleanupFailed: false,
        snapshotFileCount: 0,
        restoredCount: 0,
        removedBackupCount: 0,
        errors: [e.message],
        cleanupErrors: [],
        error: e.message
      };
    }
  });
  electron.ipcMain.handle("fix:select-custom-exe", async (_, options = {}) => {
    try {
      const gameId2 = resolveFixRequestGameId(options?.gameId);
      return await independentFixer.select(gameId2);
    } catch (e) {
      coreLogger.logger.error(`[Fix] select-custom-exe failed: ${e.message}`);
      return {
        success: false,
        error: e.message
      };
    }
  });
}
