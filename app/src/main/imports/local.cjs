"use strict";

const i18n = require("../../shared/i18n/core.cjs");
module.exports = {
  registerIpc,
  getAvailableModFolderName,
  installMultipleModsFromRoot,
  importModFromLocalPath
};
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const archivesDisguised = require("../archives/disguised.cjs");
const archivesExtract = require("../archives/extract.cjs");
const archivesNames = require("../archives/names.cjs");
const charactersDirectories = require("../characters/directories.cjs");
const charactersOrganization = require("../characters/organization.cjs");
const charactersSkins = require("../characters/skins.cjs");
const coreLogger = require("../core/logger.cjs");
const desktopNotifications = require("../desktop/notifications.cjs");
const gamesEnvironment = require("../games/environment.cjs");
const gamesNevernessLoader = require("../games/neverness/loader.cjs");
const gamesSettings = require("../games/settings.cjs");
const importsBatchScan = require("./batch-scan.cjs");
const importsIntegrated = require("./integrated.cjs");
const modsAppearance = require("../mods/appearance.cjs");
const modsBackups = require("../mods/backups.cjs");
const modsConflicts = require("../mods/conflicts.cjs");
const modsNevernessPaks = require("../games/neverness/paks.cjs");
const overlayKeypress = require("../overlay/keypress.cjs");
const persistMigration = require("../persist/migration.cjs");
const persistTracking = require("../persist/tracking.cjs");
const systemFiles = require("../system/files.cjs");
const systemWindows = require("../system/windows.cjs");
function getAvailableModFolderName(characterPath, preferredName) {
  const baseName = charactersSkins.assertSafeAppearancePathSegment(String(preferredName || "Mod").trim() || "Mod", i18n.t("backend.validation.modName"));
  for (let index = 0; index < 1e3; index++) {
    const candidateName = index === 0 ? baseName : `${baseName} (${index})`;
    const enabledPath = path.join(characterPath, candidateName);
    const disabledPath = path.join(characterPath, `DISABLED_${candidateName}`);
    if (!fs.existsSync(enabledPath) && !fs.existsSync(disabledPath)) {
      return {
        name: candidateName,
        path: enabledPath,
        duplicate: index > 0,
        duplicateOf: baseName
      };
    }
  }
  throw new Error(i18n.t("backend.imports.local.tooManyDuplicateMods", {
    baseName
  }));
}
function listMultiModChildren(sourceRoot) {
  const stats = importsBatchScan.getMultiModPackageStats(sourceRoot);
  if (!stats.candidate) return [];
  try {
    return fs.readdirSync(sourceRoot, {
      withFileTypes: true
    }).filter(entry => entry.isDirectory() && !entry.name.startsWith(".")).map(entry => ({
      name: entry.name.replace(/^DISABLED_/i, "") || "Mod",
      sourcePath: path.join(sourceRoot, entry.name)
    })).filter(entry => systemFiles.directoryHasAnyFile(entry.sourcePath));
  } catch (_) {
    return [];
  }
}
function installMultipleModsFromRoot(sourceRoot, characterPath, {
  moveSource = false
} = {}) {
  const children = listMultiModChildren(sourceRoot);
  if (children.length < 2) {
    throw new Error(i18n.t("backend.imports.local.multipleModInstallRequiresAtLeastTwoNonEmptyFolders"));
  }
  const installed = [];
  for (const child of children) {
    const availableTarget = getAvailableModFolderName(characterPath, child.name);
    if (moveSource) {
      systemFiles.moveDirectoryWithFallback(child.sourcePath, availableTarget.path);
    } else {
      fs.cpSync(child.sourcePath, availableTarget.path, {
        recursive: true
      });
    }
    installed.push({
      modName: path.basename(availableTarget.path),
      sourcePath: child.sourcePath,
      targetPath: availableTarget.path,
      duplicate: availableTarget.duplicate,
      duplicateOf: availableTarget.duplicateOf
    });
  }
  return installed;
}
async function importModFromLocalPath({
  characterName,
  filePath,
  modInfo = {},
  gameIdOverride = null,
  allowDuplicateRename = false,
  installAsIntegratedPackage = false,
  appearanceSectionId = null,
  characterSkinId = null
}) {
  let targetPath = null;
  try {
    const gameId2 = gameIdOverride || gamesSettings.getActiveGameScopeId();
    const appearanceRequest = {
      ...modInfo,
      ...(appearanceSectionId ? {
        appearanceSectionId
      } : {}),
      ...(characterSkinId ? {
        characterSkinId
      } : {})
    };
    if (gamesNevernessLoader.isNevernessGame(gameId2)) {
      const pakDetection = await modsNevernessPaks.detectNevernessDx12PakSource(filePath);
      if (pakDetection.isPak) {
        gamesNevernessLoader.setNevernessModMode("dx12");
        return await modsNevernessPaks.importNevernessDx12PakMod(characterName, filePath, appearanceRequest, {
          allowDuplicateRename,
          gameId: gameId2
        });
      }
      gamesNevernessLoader.setNevernessModMode("nemi");
    }
    charactersOrganization.organizeLegacyCharacterFoldersIfNeeded(gameId2);
    const installTarget = charactersDirectories.resolveCanonicalCharacterInstallTarget(characterName, gameId2);
    const canonicalCharacterName = installTarget.characterName || characterName;
    const charPath = installTarget.characterPath;
    if (!charPath) {
      return {
        error: i18n.t("backend.imports.local.characterFolderNotFound")
      };
    }
    const cleanModName = charactersSkins.assertSafeAppearancePathSegment(String(modInfo.name || archivesNames.getModArchiveName(filePath)).trim().replace(gameId2 === "arknights" ? /^DISABLED?_/i : /^DISABLED_/i, ""), i18n.t("backend.validation.modName"));
    const availableTarget = getAvailableModFolderName(charPath, cleanModName);
    targetPath = availableTarget.path;
    const disabledPath = path.join(charPath, `DISABLED_${cleanModName}`);
    if (!allowDuplicateRename && (fs.existsSync(path.join(charPath, cleanModName)) || fs.existsSync(disabledPath))) {
      return {
        error: i18n.t("backend.imports.local.modWithThisNameAlreadyExists")
      };
    }
    coreLogger.logger.info(`Adding mod: ${availableTarget.name} to ${canonicalCharacterName}`);
    coreLogger.logger.info(`Source file: ${filePath}`);
    const ext = path.extname(filePath).toLowerCase();
    const sourceStat = fs.statSync(filePath);
    const disguised = sourceStat.isFile() && archivesDisguised.isDisguisedMp4(filePath);
    if (disguised) {
      coreLogger.logger.info("[Disguise] Detected disguised MP4 mod, extracting with decryption...");
      const realModName = await archivesDisguised.extractDisguisedMp4(filePath, targetPath);
      coreLogger.logger.info(`[Disguise] realModName="${realModName}", cleanModName="${availableTarget.name}", targetPath="${targetPath}"`);
      if (realModName && realModName !== path.basename(targetPath)) {
        const realTarget = getAvailableModFolderName(charPath, realModName);
        const realTargetPath = realTarget.path;
        const realDisabledPath = path.join(charPath, `DISABLED_${realModName}`);
        coreLogger.logger.info(`[Disguise] Checking rename: realTargetPath="${realTargetPath}" exists=${fs.existsSync(realTargetPath)}, disabledExists=${fs.existsSync(realDisabledPath)}`);
        if (allowDuplicateRename || !fs.existsSync(realTargetPath) && !fs.existsSync(realDisabledPath)) {
          try {
            fs.renameSync(targetPath, realTargetPath);
            targetPath = realTargetPath;
            coreLogger.logger.info(`[Disguise] ✅ Renamed "${availableTarget.name}" → "${realTarget.name}"`);
            availableTarget.name = realTarget.name;
            availableTarget.path = realTarget.path;
            availableTarget.duplicate = realTarget.duplicate;
            availableTarget.duplicateOf = realTarget.duplicateOf;
          } catch (renameErr) {
            coreLogger.logger.warn(`[Disguise] Could not rename to ${realModName}: ${renameErr.message}`);
          }
        } else {
          coreLogger.logger.info(`[Disguise] Real name "${realModName}" already exists, keeping "${cleanModName}"`);
        }
      } else if (!realModName) {
        coreLogger.logger.warn("[Disguise] No real mod name detected from inner ZIP — folder will keep numeric name");
      }
    } else if (ext === ".zip") {
      coreLogger.logger.info("Extracting ZIP file with external archive tool");
      await archivesExtract.extractArchiveWithExternalTool(filePath, targetPath);
    } else if (ext === ".rar" || ext === ".7z") {
      coreLogger.logger.info(`Extracting ${ext.toUpperCase()} file with 7zip`);
      await archivesExtract.extractArchiveWithExternalTool(filePath, targetPath);
    } else if (ext === ".mp4") {
      return {
        error: i18n.t("backend.imports.local.videoNotDisguisedArchive")
      };
    } else if (sourceStat.isDirectory()) {
      coreLogger.logger.info("Copying directory");
      fs.cpSync(filePath, targetPath, {
        recursive: true
      });
    } else {
      return {
        error: i18n.t("backend.imports.local.unsupportedFileFormatPleaseUseZipRar7zOrDisguisedMP4")
      };
    }
    if (installAsIntegratedPackage) {
      const integratedResult = await importsIntegrated.installIntegratedModsPackageIfPresent(targetPath, {
        cleanupSource: true,
        gameId: gameId2,
        appearanceRequest,
        appearanceCharacterName: canonicalCharacterName
      });
      if (integratedResult?.success) {
        targetPath = null;
        try {
          const env = gamesEnvironment.resolveActiveGameEnvRoot(gameId2);
          if (env?.root && persistTracking.isPersistBridgeEnabled(gameId2)) {
            for (const modDir of integratedResult.installedModDirs || []) {
              persistMigration.ensurePersistBridgeMigrationForModDir(env.root, modDir);
            }
          }
          if (gameId2 === gamesSettings.getActiveGameScopeId()) await overlayKeypress.ensureKeypressBridgeForActiveGame();
        } catch (e) {
          coreLogger.logger.warn("Failed to refresh persist bridge after adding integrated package:", e?.message || e);
        }
        return {
          ...integratedResult,
          gameId: gameId2
        };
      }
    }
    systemFiles.assertDirectoryHasAnyFile(targetPath, "Mod import");
    coreLogger.logger.info(`Mod added successfully: ${targetPath}`);
    const restoredBakCount = modsBackups.restorePersistBakFiles(targetPath);
    if (restoredBakCount > 0) {
      coreLogger.logger.info(`Restored ${restoredBakCount} .qaqm-persistbak file(s) in ${targetPath}`);
    }
    try {
      const env = gamesEnvironment.resolveActiveGameEnvRoot(gameId2);
      if (env?.root && persistTracking.isPersistBridgeEnabled(gameId2)) persistMigration.ensurePersistBridgeMigrationForModDir(env.root, targetPath);
      if (gameId2 === gamesSettings.getActiveGameScopeId()) await overlayKeypress.ensureKeypressBridgeForActiveGame();
    } catch (e) {
      coreLogger.logger.warn("Failed to refresh persist bridge after adding mod:", e?.message || e);
    }
    const appearance = modsAppearance.assignInstalledModAppearance({
      characterName: canonicalCharacterName,
      modName: path.basename(targetPath),
      modDir: targetPath,
      requested: appearanceRequest,
      gameId: gameId2,
      source: modsAppearance.extractRequestedAppearanceTarget(appearanceRequest).sectionId || modsAppearance.extractRequestedAppearanceTarget(appearanceRequest).skinId ? "explicit-install" : "name-match"
    });
    if (gameId2 === "arknights") targetPath = require("../games/arknights/service.cjs").prepareImportedMod(targetPath);
    modsConflicts.clearConflictCache(canonicalCharacterName, gameId2);
    desktopNotifications.notifyCharacterListChanged(canonicalCharacterName, {
      gameId: gameId2,
      modName: path.basename(targetPath),
      reason: "mod-import"
    });
    return {
      success: true,
      modMode: gameId2 === "arknights" ? "m4a" : "d3d",
      characterName: canonicalCharacterName,
      modName: path.basename(targetPath).replace(/^DISABLED_/, ""),
      targetPath,
      appearanceSectionId: appearance.sectionId,
      renamedDueToDuplicate: availableTarget.duplicate,
      duplicateOf: availableTarget.duplicate ? availableTarget.duplicateOf : null
    };
  } catch (error) {
    coreLogger.logger.error("add-mod error:", error);
    if (targetPath) {
      try {
        fs.rmSync(targetPath, {
          recursive: true,
          force: true
        });
      } catch (_) {}
    }
    return {
      error: systemWindows.formatWindowsFileOperationError(error, {
        path: targetPath,
        operation: "add-mod"
      })
    };
  }
}
function registerIpc() {
  electron.ipcMain.handle("add-mod", async (_, payload) => importModFromLocalPath(payload || {}));
}
