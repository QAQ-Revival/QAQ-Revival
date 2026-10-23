"use strict";

const i18n = require("../../shared/i18n/core.cjs");
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const archivesDisguised = require("../archives/disguised.cjs");
const archivesExtract = require("../archives/extract.cjs");
const archivesTemp = require("../archives/temp.cjs");
const charactersDirectories = require("../characters/directories.cjs");
const charactersOrganization = require("../characters/organization.cjs");
const charactersSkins = require("../characters/skins.cjs");
const coreLogger = require("../core/logger.cjs");
const desktopNotifications = require("../desktop/notifications.cjs");
const desktopWindows = require("../desktop/windows.cjs");
const gamesEnvironment = require("../games/environment.cjs");
const gamesNevernessLoader = require("../games/neverness/loader.cjs");
const gamesSettings = require("../games/settings.cjs");
const importsBatchScan = require("./batch-scan.cjs");
const importsIntegrated = require("./integrated.cjs");
const importsLocal = require("./local.cjs");
const installManaged = require("../install/managed.cjs");
const installPaths = require("../install/paths.cjs");
const modsAppearance = require("../mods/appearance.cjs");
const modsBackups = require("../mods/backups.cjs");
const modsConflicts = require("../mods/conflicts.cjs");
const modsNevernessPaks = require("../games/neverness/paks.cjs");
const overlayKeypress = require("../overlay/keypress.cjs");
const persistMigration = require("../persist/migration.cjs");
const persistTracking = require("../persist/tracking.cjs");
const systemFiles = require("../system/files.cjs");
const systemWindows = require("../system/windows.cjs");
function registerIpc() {
  electron.ipcMain.handle("batch:scan-folder", async () => {
    try {
      const result = await electron.dialog.showOpenDialog(desktopWindows.mainWindowRef, {
        title: i18n.t("backend.imports.batch.chooseSourceFolder"),
        properties: ["openDirectory"]
      });
      if (result.canceled || !result.filePaths[0]) return {
        canceled: true
      };
      const folderPath = result.filePaths[0];
      const rootPlanItem = importsBatchScan.batchDirectoryPlanItem(folderPath);
      if (rootPlanItem) {
        return {
          folderPath,
          items: [rootPlanItem]
        };
      }
      const items = [];
      const entries = fs.readdirSync(folderPath, {
        withFileTypes: true
      });
      for (const entry of entries) {
        const entryPath = path.join(folderPath, entry.name);
        const managedItem = installManaged.buildManagedDropScanItem(entryPath);
        if (managedItem) {
          importsBatchScan.pushBatchItem(items, managedItem);
          continue;
        }
        if (entry.isDirectory()) {
          const integratedPackageItem = importsBatchScan.batchIntegratedPackageItem(entryPath);
          if (integratedPackageItem) {
            importsBatchScan.pushBatchItem(items, integratedPackageItem);
          } else if (importsBatchScan.batchIsModFolder(entryPath)) {
            importsBatchScan.pushBatchItem(items, importsBatchScan.batchDirectoryPlanItem(entryPath) || importsBatchScan.createBatchFolderItem(entryPath));
          } else {
            const innerItems = [];
            const foundInner = importsBatchScan.batchScanDir(entryPath, innerItems);
            if (foundInner) {
              items.push(...innerItems);
            } else {
              items.push(importsBatchScan.createBatchFolderItem(entryPath));
            }
          }
        } else if (entry.isFile()) {
          const item = importsBatchScan.batchArchiveItem(entryPath, true);
          const loosePakItem = item ? null : importsBatchScan.batchLoosePakItem(entryPath);
          importsBatchScan.pushBatchItem(items, item || loosePakItem);
        }
      }
      return {
        folderPath,
        items
      };
    } catch (error) {
      return {
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("batch:select-files", async (_, options = {}) => {
    try {
      const title = typeof options?.title === "string" && options.title.trim() ? options.title.trim() : i18n.t("backend.imports.batch.chooseModFiles");
      const buttonLabel = typeof options?.buttonLabel === "string" && options.buttonLabel.trim() ? options.buttonLabel.trim() : i18n.t("backend.fixes.service.selectPrefix");
      const filterName = typeof options?.filterName === "string" && options.filterName.trim() ? options.filterName.trim() : i18n.t("backend.imports.batch.modFileFilter");
      const result = await electron.dialog.showOpenDialog(desktopWindows.mainWindowRef, {
        title,
        properties: ["openFile", "multiSelections"],
        filters: [{
          name: filterName,
          extensions: ["zip", "rar", "7z", "exe", "mp4"]
        }, {
          name: i18n.t("backend.imports.batch.allFiles"),
          extensions: ["*"]
        }],
        buttonLabel
      });
      if (result.canceled || !result.filePaths.length) return {
        canceled: true
      };
      return {
        filePaths: result.filePaths,
        items: importsBatchScan.scanBatchPaths(result.filePaths)
      };
    } catch (error) {
      return {
        error: error.message,
        items: []
      };
    }
  });
  electron.ipcMain.handle("batch:scan-paths", async (_, {
    paths
  }) => {
    try {
      return {
        items: importsBatchScan.scanBatchPaths(paths)
      };
    } catch (error) {
      return {
        error: error.message,
        items: []
      };
    }
  });
  electron.ipcMain.handle("batch:decrypt-all", async (event, {
    items
  }) => {
    const results = [];
    const total = Array.isArray(items) ? items.length : 0;
    for (let idx = 0; idx < total; idx++) {
      const item = items[idx];
      let tmpDir = null;
      try {
        const filePath = item.path;
        const ext = path.extname(filePath).toLowerCase();
        const sourceStat = fs.statSync(filePath);
        const installContentType = installPaths.normalizeManagedInstallContentType(item.installContentType);
        if (installContentType !== "mod") {
          const target = installManaged.describeManagedInstallTarget(installContentType, item.targetGameId, item.importerName);
          const managedResult = {
            originalPath: filePath,
            tempPath: null,
            realName: item.name || path.basename(filePath, ext),
            success: true,
            installContentType,
            targetGameId: target.gameId,
            importerName: item.importerName || target.importerName || "",
            managedTargetPath: target.targetPath || "",
            managedTargetLabel: target.label || "",
            managedTargetError: target.error || ""
          };
          event.sender.send("batch:decrypt-progress", {
            idx,
            total,
            status: "done",
            realName: managedResult.realName,
            installContentType,
            managedTargetLabel: managedResult.managedTargetLabel,
            managedTargetError: managedResult.managedTargetError
          });
          results.push(managedResult);
          continue;
        }
        const disguised = sourceStat.isFile() && archivesDisguised.isDisguisedMp4(filePath);
        let realName = null;
        if (sourceStat.isFile() && importsBatchScan.isLargeArchiveForExternalExtraction(filePath, sourceStat)) {
          const message = importsBatchScan.formatLargeArchiveExternalExtractMessage(filePath);
          coreLogger.logger.info(`[batch:decrypt-all] Large archive requires external extraction: ${filePath}`);
          event.sender.send("batch:decrypt-progress", {
            idx,
            total,
            status: "error",
            code: "LARGE_ARCHIVE_EXTERNAL_EXTRACT",
            error: message
          });
          results.push({
            originalPath: filePath,
            tempPath: null,
            realName: item.name,
            success: false,
            code: "LARGE_ARCHIVE_EXTERNAL_EXTRACT",
            largeArchive: true,
            error: message
          });
          continue;
        }
        if (sourceStat.isDirectory()) {
          const integratedStats2 = importsIntegrated.getIntegratedModsPackageStats(filePath);
          const forcedIntegratedPackage2 = !!(item.forceIntegratedPackage || item.expectedIntegratedPackage || item.installAsIntegratedPackage || item.importMode === "integrated");
          const integratedPackageCandidate2 = forcedIntegratedPackage2 || !!item.integratedPackageCandidate || !!integratedStats2;
          const integratedPackageAmbiguous2 = !!(!forcedIntegratedPackage2 && (item.integratedPackageAmbiguous || integratedStats2 && importsBatchScan.isAmbiguousIntegratedModsSource(filePath, integratedStats2.sourceModsDir)));
          const multiModStats2 = integratedPackageCandidate2 ? {
            candidate: false,
            count: 0,
            names: []
          } : importsBatchScan.getMultiModPackageStats(filePath);
          event.sender.send("batch:decrypt-progress", {
            idx,
            total,
            status: "done",
            realName: item.name,
            integratedPackageCandidate: integratedPackageCandidate2,
            integratedPackageAmbiguous: integratedPackageAmbiguous2,
            forceIntegratedPackage: forcedIntegratedPackage2,
            integratedPackageTotalItems: integratedStats2?.totalItems || 0,
            integratedPackageModCount: integratedStats2?.modCount || 0,
            integratedPackageCharacterCount: integratedStats2?.characterCount || 0,
            multiModCandidate: !!multiModStats2.candidate,
            multiModCount: multiModStats2.count || 0,
            multiModNames: multiModStats2.names || [],
            skippedDirectoryCopy: true
          });
          results.push({
            originalPath: filePath,
            tempPath: null,
            realName: item.name,
            success: true,
            integratedPackageCandidate: integratedPackageCandidate2,
            integratedPackageAmbiguous: integratedPackageAmbiguous2,
            forceIntegratedPackage: forcedIntegratedPackage2,
            integratedPackageTotalItems: integratedStats2?.totalItems || 0,
            integratedPackageModCount: integratedStats2?.modCount || 0,
            integratedPackageCharacterCount: integratedStats2?.characterCount || 0,
            multiModCandidate: !!multiModStats2.candidate,
            multiModCount: multiModStats2.count || 0,
            multiModNames: multiModStats2.names || [],
            skippedDirectoryCopy: true
          });
          continue;
        }
        tmpDir = archivesTemp.ensureTempRootNearPath(filePath, `.qaqm-batch-${Date.now()}-${idx}`);
        if (disguised) {
          event.sender.send("batch:decrypt-progress", {
            idx,
            total,
            status: "running",
            stage: "prepare",
            message: i18n.t("backend.imports.batch.preparingVideoDecryption")
          });
          const innerZipName = await archivesDisguised.extractDisguisedMp4(filePath, tmpDir, {
            onProgress: progress => {
              event.sender.send("batch:decrypt-progress", {
                idx,
                total,
                status: progress?.status === "done" ? "running" : progress?.status || "running",
                stage: progress?.stage || "",
                message: progress?.message || i18n.t("backend.imports.batch.decryptingVideo"),
                currentBytes: progress?.currentBytes || 0,
                totalBytes: progress?.totalBytes || 0
              });
            }
          });
          realName = innerZipName || null;
        } else if (sourceStat.isFile() && ext === ".mp4") {
          coreLogger.logger.info(`[batch:decrypt-all] Skipped plain MP4: ${filePath}`);
          if (tmpDir) try {
            fs.rmSync(tmpDir, {
              recursive: true,
              force: true
            });
          } catch (_) {}
          event.sender.send("batch:decrypt-progress", {
            idx,
            total,
            status: "skipped",
            reason: "plain-mp4"
          });
          results.push({
            originalPath: filePath,
            tempPath: null,
            realName: item.name,
            success: false,
            skipped: true,
            reason: "plain-mp4"
          });
          continue;
        } else if (ext === ".zip") {
          event.sender.send("batch:decrypt-progress", {
            idx,
            total,
            status: "running",
            stage: "extract-zip",
            message: i18n.t("backend.imports.batch.extractingZip")
          });
          await archivesExtract.extractArchiveWithExternalTool(filePath, tmpDir);
        } else if ([".rar", ".7z", ".exe"].includes(ext)) {
          event.sender.send("batch:decrypt-progress", {
            idx,
            total,
            status: "running",
            stage: "extract-archive",
            message: i18n.t("backend.imports.batch.extractingArchive")
          });
          await archivesExtract.extractArchiveWithExternalTool(filePath, tmpDir);
        } else {
          throw new Error(i18n.t("backend.imports.batch.unsupportedFileFormat"));
        }
        systemFiles.assertDirectoryHasAnyFile(tmpDir, "Batch decrypt");
        const integratedStats = importsIntegrated.getIntegratedModsPackageStats(tmpDir);
        const forcedIntegratedPackage = !!(item.forceIntegratedPackage || item.expectedIntegratedPackage || item.installAsIntegratedPackage || item.importMode === "integrated");
        const integratedPackageCandidate = forcedIntegratedPackage || !!integratedStats;
        const integratedPackageAmbiguous = !!(!forcedIntegratedPackage && (item.integratedPackageAmbiguous || integratedStats && importsBatchScan.isAmbiguousIntegratedModsSource(tmpDir, integratedStats.sourceModsDir)));
        const multiModStats = integratedPackageCandidate ? {
          candidate: false,
          count: 0,
          names: []
        } : importsBatchScan.getMultiModPackageStats(tmpDir);
        if (!realName) {
          const extracted = fs.readdirSync(tmpDir);
          if (extracted.length === 1 && fs.statSync(path.join(tmpDir, extracted[0])).isDirectory()) {
            realName = extracted[0];
          } else {
            realName = item.name;
          }
        }
        event.sender.send("batch:decrypt-progress", {
          idx,
          total,
          status: "done",
          realName,
          integratedPackageCandidate,
          integratedPackageAmbiguous,
          forceIntegratedPackage: forcedIntegratedPackage,
          integratedPackageTotalItems: integratedStats?.totalItems || 0,
          integratedPackageModCount: integratedStats?.modCount || 0,
          integratedPackageCharacterCount: integratedStats?.characterCount || 0,
          multiModCandidate: !!multiModStats.candidate,
          multiModCount: multiModStats.count || 0,
          multiModNames: multiModStats.names || []
        });
        results.push({
          originalPath: filePath,
          tempPath: tmpDir,
          realName,
          success: true,
          integratedPackageCandidate: integratedPackageCandidate || !!item.integratedPackageCandidate,
          integratedPackageAmbiguous,
          forceIntegratedPackage: forcedIntegratedPackage,
          integratedPackageTotalItems: integratedStats?.totalItems || 0,
          integratedPackageModCount: integratedStats?.modCount || 0,
          integratedPackageCharacterCount: integratedStats?.characterCount || 0,
          multiModCandidate: !!multiModStats.candidate,
          multiModCount: multiModStats.count || 0,
          multiModNames: multiModStats.names || []
        });
      } catch (e) {
        coreLogger.logger.warn(`[batch:decrypt-all] Failed for ${item.path}: ${e.message}`);
        if (tmpDir) try {
          fs.rmSync(tmpDir, {
            recursive: true,
            force: true
          });
        } catch (_) {}
        event.sender.send("batch:decrypt-progress", {
          idx,
          total,
          status: "error",
          error: e.message
        });
        results.push({
          originalPath: item.path,
          tempPath: null,
          realName: item.name,
          success: false,
          error: e.message
        });
      }
    }
    return {
      results
    };
  });
  electron.ipcMain.handle("batch:add-mods", async (event, {
    items
  }) => {
    const results = [];
    const installedPaths = [];
    const gameId2 = gamesSettings.getActiveGameScopeId();
    charactersOrganization.organizeLegacyCharacterFoldersIfNeeded(gameId2);
    const batchItems = Array.isArray(items) ? items : [];
    const total = batchItems.length;
    const progressWeights = batchItems.map(item => {
      const integratedTotal = Number(item?.integratedPackageTotalItems || item?.integratedPackageModCount || 0);
      const multiModTotal = Number(item?.multiModCount || 0);
      if (item?.installAsMultipleMods && Number.isFinite(multiModTotal) && multiModTotal > 1) {
        return multiModTotal;
      }
      return item?.expectedIntegratedPackage && Number.isFinite(integratedTotal) && integratedTotal > 0 ? integratedTotal : 1;
    });
    let overallProgressTotal = progressWeights.reduce((sum, weight) => sum + weight, 0);
    let completedProgress = 0;
    function setBatchItemProgressWeight(idx, nextWeight) {
      const safeWeight = Number.isFinite(Number(nextWeight)) && Number(nextWeight) > 0 ? Number(nextWeight) : 1;
      if (safeWeight > progressWeights[idx]) {
        overallProgressTotal += safeWeight - progressWeights[idx];
        progressWeights[idx] = safeWeight;
      }
      return progressWeights[idx] || 1;
    }
    function sendBatchProgress(current, payload = {}) {
      const safeTotal = Math.max(1, overallProgressTotal || total || 1);
      const safeCurrent = Math.max(0, Math.min(Number(current) || 0, safeTotal));
      event.sender.send("batch:progress", {
        ...payload,
        current: safeCurrent,
        total: safeTotal
      });
    }
    function sendBatchItemProgress(idx, itemCurrent, itemTotal, payload = {}) {
      const itemWeight = setBatchItemProgressWeight(idx, itemTotal || progressWeights[idx]);
      const safeItemCurrent = Math.max(0, Math.min(Number(itemCurrent) || 0, itemWeight));
      sendBatchProgress(completedProgress + safeItemCurrent, payload);
    }
    function completeBatchItem(idx, payload = {}, itemTotal = null) {
      const itemWeight = setBatchItemProgressWeight(idx, itemTotal || progressWeights[idx]);
      completedProgress += itemWeight;
      sendBatchProgress(completedProgress, payload);
    }
    for (let idx = 0; idx < total; idx++) {
      const item = batchItems[idx];
      const {
        filePath
      } = item;
      let characterName = String(item.characterName || "").trim();
      let modName = String(item.modName || (item.expectedIntegratedPackage ? "整合包" : "")).replace(/^DISABLED_/i, "").trim();
      let targetPath = null;
      try {
        const installTarget = charactersDirectories.resolveCanonicalCharacterInstallTarget(characterName, gameId2, {
          ensure: false
        });
        characterName = installTarget.characterName || characterName;
        modName = charactersSkins.assertSafeAppearancePathSegment(modName || "Mod", i18n.t("backend.validation.modName"));
        if (gamesNevernessLoader.isNevernessGame(gameId2)) {
          const pakDetection = await modsNevernessPaks.detectNevernessDx12PakSource(item.tempPath || filePath);
          if (pakDetection.isPak) {
            gamesNevernessLoader.setNevernessModMode("dx12");
            const result = await modsNevernessPaks.importNevernessDx12PakMod(characterName, item.tempPath || filePath, {
              ...item,
              name: modName
            }, {
              gameId: gameId2,
              notify: false
            });
            if (item.tempPath && fs.existsSync(item.tempPath)) {
              try {
                fs.rmSync(item.tempPath, {
                  recursive: true,
                  force: true
                });
              } catch (_) {}
            }
            results.push({
              modName,
              characterName,
              modMode: "pak",
              appearanceSectionId: result?.appearanceSectionId || charactersSkins.BASE_APPEARANCE_SECTION_ID,
              success: !!result?.success,
              error: result?.error
            });
            completeBatchItem(idx, {
              modName,
              success: !!result?.success
            });
            continue;
          }
          gamesNevernessLoader.setNevernessModMode("nemi");
        }
        const preparedPath = item.tempPath && fs.existsSync(item.tempPath) ? item.tempPath : null;
        const shouldInstallIntegrated = !!(item.installAsIntegratedPackage || item.expectedIntegratedPackage);
        const integratedSourcePath = shouldInstallIntegrated ? preparedPath || (item.expectedIntegratedPackage && filePath && fs.existsSync(filePath) ? filePath : null) : null;
        if (integratedSourcePath) {
          const integratedResult = await importsIntegrated.installIntegratedModsPackageIfPresent(integratedSourcePath, {
            cleanupSource: !!preparedPath,
            gameId: gameId2,
            appearanceRequest: item,
            appearanceCharacterName: characterName,
            onProgress: progress => {
              sendBatchItemProgress(idx, progress.current, progress.total, {
                ...progress,
                success: null,
                integratedPackage: true
              });
            }
          });
          if (integratedResult?.success) {
            installedPaths.push(...(integratedResult.installedModDirs || []));
            results.push({
              ...integratedResult,
              modName: modName || "整合包",
              success: true
            });
            completeBatchItem(idx, {
              modName: i18n.t("backend.imports.batch.integratedInstallComplete"),
              success: true,
              integratedPackage: true
            }, integratedResult.totalItems || integratedResult.modCount || null);
            continue;
          }
        }
        if (shouldInstallIntegrated) {
          if (preparedPath && fs.existsSync(preparedPath)) {
            try {
              fs.rmSync(preparedPath, {
                recursive: true,
                force: true
              });
            } catch (_) {}
          }
          results.push({
            modName: modName || "整合包",
            characterName: "__all__",
            expectedIntegratedPackage: true,
            success: false,
            error: i18n.t("backend.imports.batch.integratedStructureMissing")
          });
          completeBatchItem(idx, {
            modName: "整合包",
            success: false,
            expectedIntegratedPackage: true
          });
          continue;
        }
        if (item.installAsMultipleMods) {
          const multipleSourcePath = preparedPath || (filePath && fs.existsSync(filePath) && fs.statSync(filePath).isDirectory() ? filePath : null);
          const multipleCharPath = charactersDirectories.resolveCanonicalCharacterInstallTarget(characterName, gameId2).characterPath;
          if (!multipleSourcePath || !multipleCharPath) {
            results.push({
              modName,
              characterName,
              success: false,
              error: i18n.t("backend.imports.batch.multipleModSourceNotFound")
            });
            completeBatchItem(idx, {
              modName,
              success: false
            });
            continue;
          }
          const installed = importsLocal.installMultipleModsFromRoot(multipleSourcePath, multipleCharPath, {
            moveSource: !!preparedPath
          });
          installed.forEach(entry => {
            modsBackups.restorePersistBakFiles(entry.targetPath);
            const appearance2 = modsAppearance.assignInstalledModAppearance({
              characterName,
              modName: entry.modName,
              modDir: entry.targetPath,
              requested: item,
              gameId: gameId2,
              source: modsAppearance.extractRequestedAppearanceTarget(item).sectionId || modsAppearance.extractRequestedAppearanceTarget(item).skinId ? "explicit-batch" : "name-match"
            });
            entry.appearanceSectionId = appearance2.sectionId;
            modsConflicts.clearConflictCache(characterName, gameId2);
            installedPaths.push(entry.targetPath);
          });
          if (preparedPath && fs.existsSync(preparedPath)) {
            try {
              fs.rmSync(preparedPath, {
                recursive: true,
                force: true
              });
            } catch (_) {}
          }
          results.push({
            modName: modName || `${installed.length} Mods`,
            characterName,
            modMode: "d3d",
            success: true,
            multipleMods: true,
            modCount: installed.length,
            installedMods: installed.map(entry => entry.modName),
            installedModDetails: installed.map(entry => ({
              modName: entry.modName,
              appearanceSectionId: entry.appearanceSectionId
            }))
          });
          completeBatchItem(idx, {
            modName: `${installed.length} Mods`,
            success: true,
            multipleMods: true
          }, installed.length);
          continue;
        }
        const charPath = charactersDirectories.resolveCanonicalCharacterInstallTarget(characterName, gameId2).characterPath;
        if (!charPath) {
          results.push({
            modName,
            characterName,
            success: false,
            error: i18n.t("backend.imports.batch.modsDirectoryUnresolved")
          });
          completeBatchItem(idx, {
            modName,
            success: false
          });
          continue;
        }
        targetPath = path.join(charPath, modName);
        const disabledTargetPath = path.join(charPath, `DISABLED_${modName}`);
        if (fs.existsSync(targetPath) || fs.existsSync(disabledTargetPath)) {
          results.push({
            modName,
            characterName,
            success: false,
            error: i18n.t("backend.imports.batch.modAlreadyExists")
          });
          completeBatchItem(idx, {
            modName,
            success: false
          });
          continue;
        }
        const tempPath = item.tempPath || null;
        if (tempPath && fs.existsSync(tempPath)) {
          systemFiles.assertDirectoryHasAnyFile(tempPath, "Prepared mod import");
          systemFiles.moveDirectoryWithFallback(tempPath, targetPath);
        } else {
          const ext = path.extname(filePath).toLowerCase();
          const sourceStat = fs.statSync(filePath);
          const disguised = sourceStat.isFile() && archivesDisguised.isDisguisedMp4(filePath);
          if (disguised) {
            await archivesDisguised.extractDisguisedMp4(filePath, targetPath);
          } else if (ext === ".zip") {
            await archivesExtract.extractArchiveWithExternalTool(filePath, targetPath);
          } else if ([".rar", ".7z", ".exe"].includes(ext)) {
            await archivesExtract.extractArchiveWithExternalTool(filePath, targetPath);
          } else if (ext === ".mp4") {
            results.push({
              modName,
              characterName,
              success: false,
              error: i18n.t("backend.imports.batch.videoNotDisguised")
            });
            completeBatchItem(idx, {
              modName,
              success: false
            });
            continue;
          } else if (sourceStat.isDirectory()) {
            fs.cpSync(filePath, targetPath, {
              recursive: true
            });
          } else {
            results.push({
              modName,
              characterName,
              success: false,
              error: i18n.t("backend.imports.batch.unsupportedFormat")
            });
            completeBatchItem(idx, {
              modName,
              success: false
            });
            continue;
          }
        }
        if (shouldInstallIntegrated) {
          const integratedResult = await importsIntegrated.installIntegratedModsPackageIfPresent(targetPath, {
            cleanupSource: true,
            gameId: gameId2,
            appearanceRequest: item,
            appearanceCharacterName: characterName,
            onProgress: progress => {
              sendBatchItemProgress(idx, progress.current, progress.total, {
                ...progress,
                success: null,
                integratedPackage: true
              });
            }
          });
          if (integratedResult?.success) {
            targetPath = null;
            installedPaths.push(...(integratedResult.installedModDirs || []));
            results.push({
              ...integratedResult,
              modName: modName || "整合包",
              success: true
            });
            completeBatchItem(idx, {
              modName: i18n.t("backend.imports.batch.integratedInstallComplete"),
              success: true,
              integratedPackage: true
            }, integratedResult.totalItems || integratedResult.modCount || null);
            continue;
          }
        }
        systemFiles.assertDirectoryHasAnyFile(targetPath, "Mod import");
        modsConflicts.clearConflictCache(characterName, gameId2);
        const batchRestoredCount = modsBackups.restorePersistBakFiles(targetPath);
        if (batchRestoredCount > 0) {
          coreLogger.logger.info(`Restored ${batchRestoredCount} .qaqm-persistbak file(s) in ${targetPath}`);
        }
        const appearance = modsAppearance.assignInstalledModAppearance({
          characterName,
          modName,
          modDir: targetPath,
          requested: item,
          gameId: gameId2,
          source: modsAppearance.extractRequestedAppearanceTarget(item).sectionId || modsAppearance.extractRequestedAppearanceTarget(item).skinId ? "explicit-batch" : "name-match"
        });
        installedPaths.push(targetPath);
        results.push({
          modName,
          characterName,
          modMode: "d3d",
          appearanceSectionId: appearance.sectionId,
          success: true
        });
        completeBatchItem(idx, {
          modName,
          success: true
        });
      } catch (e) {
        if (targetPath) {
          try {
            fs.rmSync(targetPath, {
              recursive: true,
              force: true
            });
          } catch (_) {}
        }
        results.push({
          modName,
          characterName,
          success: false,
          error: systemWindows.formatWindowsFileOperationError(e, {
            path: targetPath || filePath,
            operation: "batch-add-mod"
          })
        });
        completeBatchItem(idx, {
          modName,
          success: false
        });
      }
    }
    if (gamesNevernessLoader.isNevernessGame(gameId2) && results.some(item => item.success && item.modMode === "pak")) {
      gamesNevernessLoader.setNevernessModMode("dx12");
    }
    try {
      const env = gamesEnvironment.resolveActiveGameEnvRoot(gameId2);
      if (env?.root && persistTracking.isPersistBridgeEnabled(gameId2)) {
        for (const p of installedPaths) {
          persistMigration.ensurePersistBridgeMigrationForModDir(env.root, p);
        }
      }
      if (gameId2 === gamesSettings.getActiveGameScopeId()) await overlayKeypress.ensureKeypressBridgeForActiveGame();
    } catch (_) {}
    const successfulResults = results.filter(item => item?.success);
    if (successfulResults.length > 0) {
      desktopNotifications.notifyCharacterListChanged("__all__", {
        reason: "batch-import",
        changedCharacterNames: Array.from(new Set(successfulResults.map(item => item?.characterName).filter(Boolean)))
      });
    }
    return {
      results
    };
  });
}
module.exports = {
  registerIpc
};
