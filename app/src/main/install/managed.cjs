"use strict";

const i18n = require("../../shared/i18n/core.cjs");
module.exports = {
  registerIpc,
  getManagedTargetGameId,
  describeManagedInstallTarget,
  buildManagedDropScanItem
};
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const archivesExtract = require("../archives/extract.cjs");
const configStore = require("../config/store.cjs");
const coreLogger = require("../core/logger.cjs");
const fixesService = require("../fixes/service.cjs");
const gamesSettings = require("../games/settings.cjs");
const installPaths = require("./paths.cjs");
const installSetup = require("./setup.cjs");
const systemFiles = require("../system/files.cjs");
const systemPaths = require("../system/paths.cjs");
const systemWindows = require("../system/windows.cjs");
const MANAGED_UPDATE_ARCHIVE_EXTS = new Set([".zip", ".rar", ".7z", ".exe"]);
function getManagedTargetGameId(requestedGameId, importerName = "") {
  const importerGameId = installPaths.IMPORTER_GAME_IDS[String(importerName || "").toUpperCase()];
  const candidate = String(importerGameId || requestedGameId || gamesSettings.getActiveGameScopeId()).trim();
  if (candidate && (gamesSettings.getGameById(candidate) || gamesSettings.getBuiltInGameDefinition(candidate))) return candidate;
  return gamesSettings.getActiveGameScopeId();
}
function getImporterNameForGame(gameId2) {
  return Object.entries(installPaths.IMPORTER_GAME_IDS).find(([, mappedGameId]) => mappedGameId === gameId2)?.[0] || "";
}
function resolveConfiguredXxmiRoot(gameId2) {
  const candidateLoaders = [];
  const requested = gamesSettings.getResolvedGamePaths(gameId2)?.modLoaderPath;
  if (requested) candidateLoaders.push(requested);
  for (const game of configStore.currentConfig.games || []) {
    if (game?.modLoaderPath) candidateLoaders.push(game.modLoaderPath);
  }
  for (const legacyPath of [configStore.currentConfig.xxmiPath, configStore.currentConfig.loaderPath, configStore.currentConfig.efmiPath]) {
    if (legacyPath) candidateLoaders.push(legacyPath);
  }
  const seen = new Set();
  for (const loaderPath of candidateLoaders) {
    const key = systemPaths.normalizeComparablePath(loaderPath);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const root = installPaths.deriveXxmiRootFromLoaderPath(loaderPath);
    if (!root) continue;
    const resourcesDir = path.join(root, "Resources");
    if (!fs.existsSync(resourcesDir) || !fs.statSync(resourcesDir).isDirectory()) continue;
    return {
      root,
      resourcesDir,
      loaderPath
    };
  }
  return null;
}
function describeManagedInstallTarget(contentType, requestedGameId, importerName = "") {
  const normalizedType = installPaths.normalizeManagedInstallContentType(contentType);
  const gameId2 = getManagedTargetGameId(requestedGameId, importerName);
  if (normalizedType === "fixer") {
    return {
      ok: true,
      contentType: normalizedType,
      gameId: gameId2,
      importerName: getImporterNameForGame(gameId2),
      targetPath: path.join(electron.app.getPath("userData"), "fix", gameId2, "user"),
      label: i18n.t("backend.install.managed.independentFixerTitle", {
        name: gamesSettings.getGameById(gameId2)?.name || gamesSettings.getBuiltInGameDefinition(gameId2)?.name || gameId2
      })
    };
  }
  if (normalizedType === "xxmi-update") {
    const resolved = resolveConfiguredXxmiRoot(gameId2);
    if (!resolved) {
      return {
        ok: false,
        contentType: normalizedType,
        gameId: gameId2,
        importerName: "XXMI",
        error: i18n.t("backend.install.managed.xxmiRootUnresolved")
      };
    }
    return {
      ok: true,
      contentType: normalizedType,
      gameId: gameId2,
      importerName: "XXMI",
      targetPath: resolved.resourcesDir,
      rootPath: resolved.root,
      label: i18n.t("backend.install.managed.xxmiResourcesTitle", {
        root: resolved.root
      })
    };
  }
  if (normalizedType === "game-package-update") {
    const resolvedPaths = gamesSettings.getResolvedGamePaths(gameId2);
    const packageRoot = installPaths.deriveGamePackageRootFromModsPath(resolvedPaths?.modsPath);
    const modsPathExists = (() => {
      try {
        return !!resolvedPaths?.modsPath && fs.statSync(resolvedPaths.modsPath).isDirectory();
      } catch (_) {
        return false;
      }
    })();
    const packageRootExists = (() => {
      try {
        return !!packageRoot && fs.statSync(packageRoot).isDirectory();
      } catch (_) {
        return false;
      }
    })();
    if (!packageRoot || !modsPathExists || !packageRootExists) {
      return {
        ok: false,
        contentType: normalizedType,
        gameId: gameId2,
        importerName: String(importerName || getImporterNameForGame(gameId2)).toUpperCase(),
        error: i18n.t("backend.install.managed.validModsPathRequired")
      };
    }
    return {
      ok: true,
      contentType: normalizedType,
      gameId: gameId2,
      importerName: String(importerName || getImporterNameForGame(gameId2)).toUpperCase(),
      targetPath: packageRoot,
      modsPath: path.resolve(resolvedPaths.modsPath),
      label: i18n.t("backend.install.managed.gamePackageTitle", {
        fileName: path.basename(packageRoot),
        packageRoot
      })
    };
  }
  return {
    ok: true,
    contentType: "mod",
    gameId: gameId2,
    importerName: "",
    targetPath: ""
  };
}
function buildManagedDropScanItem(sourcePath, requestedGameId = gamesSettings.getActiveGameScopeId()) {
  const inferred = installPaths.inferManagedInstallFromName(sourcePath, requestedGameId);
  if (inferred.contentType === "mod") return null;
  let stat;
  try {
    stat = fs.statSync(sourcePath);
  } catch (_) {
    return null;
  }
  const ext = stat.isFile() ? path.extname(sourcePath).toLowerCase() : "";
  if (stat.isFile() && !MANAGED_UPDATE_ARCHIVE_EXTS.has(ext)) return null;
  const target = describeManagedInstallTarget(inferred.contentType, inferred.targetGameId, inferred.importerName);
  return {
    name: stat.isFile() && ext ? path.basename(sourcePath, ext) : path.basename(sourcePath),
    path: sourcePath,
    type: stat.isDirectory() ? "folder" : ext ? ext.slice(1) : "file",
    installContentType: inferred.contentType,
    suggestedContentType: inferred.contentType,
    targetGameId: target.gameId,
    importerName: inferred.importerName,
    managedTargetPath: target.targetPath || "",
    managedTargetLabel: target.label || "",
    managedTargetError: target.error || ""
  };
}
async function prepareManagedUpdateSource(sourcePath) {
  const resolvedSource = path.resolve(String(sourcePath || ""));
  const stat = fs.statSync(resolvedSource);
  if (stat.isDirectory()) return {
    sourceDir: resolvedSource,
    cleanup: null
  };
  const ext = path.extname(resolvedSource).toLowerCase();
  if (!MANAGED_UPDATE_ARCHIVE_EXTS.has(ext)) {
    throw new Error(i18n.t("backend.install.managed.unsupportedUpdateSource"));
  }
  const tempDir = fs.mkdtempSync(path.join(electron.app.getPath("temp"), "qaqm-managed-update-"));
  try {
    await archivesExtract.extractArchiveWithExternalTool(resolvedSource, tempDir, {
      flatten: false,
      purpose: "update"
    });
    systemFiles.assertDirectoryHasAnyFile(tempDir, "Managed update package");
    return {
      sourceDir: tempDir,
      cleanup: () => {
        try {
          fs.rmSync(tempDir, {
            recursive: true,
            force: true
          });
        } catch (_) {}
      }
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
function collectManagedUpdateFiles(sourceDir) {
  const files = [];
  let totalBytes = 0;
  const visit = (dirPath, relativeDir = "") => {
    for (const entry of fs.readdirSync(dirPath, {
      withFileTypes: true
    })) {
      if (entry.isSymbolicLink()) continue;
      const relativePath = path.join(relativeDir, entry.name);
      if (installPaths.relativePathTouchesMods(relativePath)) continue;
      const sourcePath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        visit(sourcePath, relativePath);
        continue;
      }
      if (!entry.isFile()) continue;
      const size = fs.statSync(sourcePath).size;
      totalBytes += size;
      if (files.length >= 2e4 || totalBytes > 4 * 1024 * 1024 * 1024) {
        throw new Error(i18n.t("backend.install.managed.updateContentTooLarge"));
      }
      files.push({
        sourcePath,
        relativePath,
        size
      });
    }
  };
  visit(sourceDir);
  return {
    files,
    totalBytes
  };
}
function resolveRealPathForPotentialWrite(targetPath) {
  let cursor = path.resolve(targetPath);
  const missingSegments = [];
  while (!fs.existsSync(cursor)) {
    const parent = path.dirname(cursor);
    if (!parent || parent === cursor) {
      throw new Error(i18n.t("backend.install.managed.unresolvedUpdateTarget", {
        targetPath
      }));
    }
    missingSegments.unshift(path.basename(cursor));
    cursor = parent;
  }
  const realExistingPath = fs.realpathSync.native ? fs.realpathSync.native(cursor) : fs.realpathSync(cursor);
  return path.resolve(realExistingPath, ...missingSegments);
}
function copyManagedUpdateFiles(sourceDir, targetDir, protectedModsPath = "") {
  const sourceRoot = path.resolve(sourceDir);
  const targetRoot = path.resolve(targetDir);
  if (systemPaths.isSameResolvedPath(sourceRoot, targetRoot)) {
    throw new Error(i18n.t("backend.install.managed.sourceEqualsTarget"));
  }
  if (!fs.existsSync(targetRoot) || !fs.statSync(targetRoot).isDirectory()) {
    throw new Error(i18n.t("backend.install.managed.targetDirectoryMissing", {
      targetRoot
    }));
  }
  const probePath = path.join(targetRoot, `.qaqm-managed-update-test-${process.pid}-${Date.now()}`);
  try {
    fs.writeFileSync(probePath, "ok");
    fs.rmSync(probePath, {
      force: true
    });
  } catch (error) {
    try {
      if (fs.existsSync(probePath)) fs.rmSync(probePath, {
        force: true
      });
    } catch (_) {}
    throw new Error(i18n.t("backend.install.managed.targetDirectoryReadOnly", {
      windowsFileOperationError: systemWindows.formatWindowsFileOperationError(error, {
        path: targetRoot,
        operation: "write-test"
      })
    }));
  }
  const {
    files,
    totalBytes
  } = collectManagedUpdateFiles(sourceRoot);
  if (!files.length) throw new Error(i18n.t("backend.install.managed.updateContentEmpty"));
  const protectedRoot = protectedModsPath ? path.resolve(protectedModsPath) : "";
  const targetRootReal = resolveRealPathForPotentialWrite(targetRoot);
  const protectedRootReal = protectedRoot ? resolveRealPathForPotentialWrite(protectedRoot) : "";
  let copiedFiles = 0;
  for (const file of files) {
    const destination = path.resolve(targetRoot, file.relativePath);
    if (!systemPaths.isPathInsideDirectory(destination, targetRoot)) {
      throw new Error(i18n.t("backend.install.managed.unsafeUpdatePath", {
        relativePath: file.relativePath
      }));
    }
    if (protectedRoot && (systemPaths.normalizeComparablePath(destination) === systemPaths.normalizeComparablePath(protectedRoot) || systemPaths.isPathInsideDirectory(destination, protectedRoot))) {
      throw new Error(i18n.t("backend.install.managed.protectedModsWrite", {
        relativePath: file.relativePath
      }));
    }
    const realDestination = resolveRealPathForPotentialWrite(destination);
    if (systemPaths.normalizeComparablePath(realDestination) !== systemPaths.normalizeComparablePath(targetRootReal) && !systemPaths.isPathInsideDirectory(realDestination, targetRootReal)) {
      throw new Error(i18n.t("backend.install.managed.linkedDirectoryEscape", {
        relativePath: file.relativePath
      }));
    }
    if (protectedRootReal && (systemPaths.normalizeComparablePath(realDestination) === systemPaths.normalizeComparablePath(protectedRootReal) || systemPaths.isPathInsideDirectory(realDestination, protectedRootReal))) {
      throw new Error(i18n.t("backend.install.managed.linkedModsWrite", {
        relativePath: file.relativePath
      }));
    }
    fs.mkdirSync(path.dirname(destination), {
      recursive: true
    });
    fs.copyFileSync(file.sourcePath, destination);
    copiedFiles += 1;
  }
  return {
    copiedFiles,
    totalBytes
  };
}
async function installManagedComponentUpdate(sourcePath, target) {
  const prepared = await prepareManagedUpdateSource(sourcePath);
  try {
    let sourceDir = prepared.sourceDir;
    if (target.contentType === "xxmi-update") {
      sourceDir = installSetup.resolveXxmiUpdateSourceDir(sourceDir);
    } else {
      sourceDir = installSetup.resolveGamePackageUpdateSourceDir(sourceDir, target.targetPath);
    }
    if (!sourceDir || !fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) {
      throw new Error(i18n.t("backend.install.managed.updateContentUnrecognized"));
    }
    if (path.basename(sourceDir).toLowerCase() === "mods") {
      throw new Error(i18n.t("backend.install.managed.modsSourceBlocked"));
    }
    const copied = copyManagedUpdateFiles(sourceDir, target.targetPath, target.modsPath || "");
    return {
      success: true,
      managedInstall: true,
      installContentType: target.contentType,
      targetGameId: target.gameId,
      importerName: target.importerName,
      targetPath: target.targetPath,
      copiedFiles: copied.copiedFiles,
      copiedBytes: copied.totalBytes,
      modName: target.contentType === "xxmi-update" ? i18n.t("backend.install.managed.xxmiUpdate") : i18n.t("backend.install.managed.gamePackageUpdate", {
        importerName: target.importerName || path.basename(target.targetPath)
      })
    };
  } finally {
    prepared.cleanup?.();
  }
}
function registerIpc() {
  electron.ipcMain.handle("managed-package:install", async (_, payload = {}) => {
    try {
      const rawSourcePath = String(payload.sourcePath || "").trim();
      if (!rawSourcePath) return {
        success: false,
        error: i18n.t("backend.install.managed.installSourceEmpty")
      };
      const sourcePath = path.resolve(rawSourcePath);
      if (!fs.existsSync(sourcePath)) {
        return {
          success: false,
          error: i18n.t("backend.install.managed.installSourceMissing", {
            sourcePath: payload.sourcePath || ""
          })
        };
      }
      const contentType = installPaths.normalizeManagedInstallContentType(payload.installContentType);
      if (contentType === "mod") {
        return {
          success: false,
          error: i18n.t("backend.install.managed.modInstallFlowRequired")
        };
      }
      const inferred = installPaths.inferManagedInstallFromName(sourcePath, payload.gameId);
      const inferredGamePackage = inferred.contentType === "game-package-update";
      const importerName = contentType === "game-package-update" ? String(payload.importerName || (inferredGamePackage ? inferred.importerName : "") || "").toUpperCase() : "";
      const requestedGameId = contentType === "game-package-update" && inferredGamePackage && inferred.importerName ? inferred.targetGameId : payload.gameId;
      const target = describeManagedInstallTarget(contentType, requestedGameId, importerName);
      if (!target.ok) return {
        success: false,
        error: target.error,
        installContentType: contentType
      };
      if (contentType === "fixer") {
        return await fixesService.installManagedFixerFromSource(sourcePath, target.gameId);
      }
      return await installManagedComponentUpdate(sourcePath, target);
    } catch (error) {
      coreLogger.logger.error(`[ManagedInstall] Failed: ${error?.stack || error}`);
      return {
        success: false,
        error: systemWindows.formatWindowsFileOperationError(error, {
          path: payload?.sourcePath,
          operation: "managed-package-install"
        })
      };
    }
  });
}
