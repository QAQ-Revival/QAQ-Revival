"use strict";

const i18n = require("../../shared/i18n/core.cjs");
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const archivesDisguised = require("../archives/disguised.cjs");
const archivesZip = require("../archives/zip.cjs");
const coreLogger = require("../core/logger.cjs");
const desktopWindows = require("../desktop/windows.cjs");
function registerIpc() {
  electron.ipcMain.handle("peek-disguised-mod-name", async (_, {
    filePath
  }) => {
    try {
      if (!filePath || !fs.existsSync(filePath)) return {
        name: null
      };
      if (!archivesDisguised.isDisguisedMp4(filePath)) return {
        name: null
      };
      const realName = archivesDisguised.peekDisguisedModName(filePath);
      return {
        name: realName
      };
    } catch (_2) {
      return {
        name: null
      };
    }
  });
  electron.ipcMain.handle("dev:export-encrypted-mod", async (event, {
    modPath,
    characterName,
    modName
  }) => {
    try {
      const sevenZipPath = archivesZip.get7zaPath();
      if (!sevenZipPath) return {
        success: false,
        error: i18n.t("backend.developer.export.sevenZipMissing")
      };
      if (!modPath || !fs.existsSync(modPath)) return {
        success: false,
        error: i18n.t("backend.developer.export.modFolderMissing")
      };
      const modStats = archivesDisguised.getDirectoryStatsSync(modPath);
      const videoPick = archivesDisguised.pickExportEncryptVideo(modStats);
      const videoPath = videoPick.videoPath;
      const useDirect7z = modStats.size >= archivesDisguised.EXPORT_ENCRYPT_DIRECT_7Z_THRESHOLD;
      const archiveSource = archivesDisguised.getEncryptedExportArchiveSource(modPath);
      coreLogger.logger.info(`[ExportEncrypt] Mod stats: ${(modStats.size / 1024 / 1024).toFixed(1)} MB, ${modStats.files} files`);
      if (archiveSource.preserveRoot) {
        coreLogger.logger.info(`[ExportEncrypt] Preserving package root folder: ${archiveSource.include}`);
      }
      if (useDirect7z) {
        coreLogger.logger.info("[ExportEncrypt] Large mod mode: direct encrypted 7z without inner ZIP");
      }
      if (videoPath) {
        coreLogger.logger.info(`[ExportEncrypt] Video source: ${videoPick.useLongVideo ? "long" : "normal"} (${videoPick.selectedDir})`);
      } else {
        coreLogger.logger.warn("[ExportEncrypt] No MP4 video素材 found, exporting with magic marker only");
      }
      const defaultName = `${modName || path.basename(modPath)}.mp4`;
      const {
        dialog: dialog2
      } = require("electron");
      const result = await dialog2.showSaveDialog(desktopWindows.mainWindowRef, {
        title: i18n.t("backend.developer.export.exportEncryptedMod"),
        defaultPath: path.join(electron.app.getPath("desktop"), defaultName),
        filters: [{
          name: i18n.t("backend.developer.export.disguisedVideoFilter"),
          extensions: ["mp4"]
        }]
      });
      if (result.canceled || !result.filePath) return {
        canceled: true
      };
      const outputPath = result.filePath;
      const outputDir = path.dirname(outputPath);
      const tmpDir = path.join(outputDir, `.qaqm-export-${Date.now()}`);
      fs.mkdirSync(tmpDir, {
        recursive: true
      });
      try {
        let innerZipPath = null;
        const innerZipName = `${modName || path.basename(modPath)}.zip`;
        if (useDirect7z) {
          coreLogger.logger.info(`[ExportEncrypt] Step 1: Skipping inner ZIP for large mod ${modName}`);
        } else {
          coreLogger.logger.info(`[ExportEncrypt] Step 1: Creating inner ZIP for ${modName} with 7-Zip`);
          innerZipPath = path.join(tmpDir, innerZipName);
          archivesDisguised.run7zSync(sevenZipPath, ["a", "-tzip", innerZipPath, archiveSource.include, "-r", "-mx=0"], 30 * 60 * 1e3, archiveSource.cwd);
        }
        coreLogger.logger.info("[ExportEncrypt] Step 2: Creating encrypted 7z");
        const enc7zName = `${modName || path.basename(modPath)}.7z`;
        const enc7zPath = path.join(tmpDir, enc7zName);
        if (useDirect7z) {
          archivesDisguised.run7zSync(sevenZipPath, ["a", enc7zPath, archiveSource.include, "-r", `-p${archivesDisguised.DISGUISE_PASSWORD}`, "-mhe=on", "-mx=0"], 30 * 60 * 1e3, archiveSource.cwd);
        } else {
          archivesDisguised.run7zSync(sevenZipPath, ["a", enc7zPath, innerZipPath, `-p${archivesDisguised.DISGUISE_PASSWORD}`, "-mhe=on", "-mx=0"]);
          try {
            fs.unlinkSync(innerZipPath);
          } catch (_) {}
        }
        coreLogger.logger.info("[ExportEncrypt] Step 3: Creating outer ZIP");
        let payloadPath = null;
        if (useDirect7z) {
          coreLogger.logger.info("[ExportEncrypt] Step 3: Streaming outer ZIP for large mod compatibility");
        } else {
          const outerZipPath = path.join(tmpDir, "outer.zip");
          archivesDisguised.run7zSync(sevenZipPath, ["a", "-tzip", outerZipPath, enc7zName, "-mx=0"], 30 * 60 * 1e3, tmpDir);
          try {
            fs.unlinkSync(enc7zPath);
          } catch (_) {}
          payloadPath = outerZipPath;
        }
        coreLogger.logger.info("[ExportEncrypt] Step 4: XOR obfuscation + concatenation");
        const outFd = fs.openSync(outputPath, "w");
        if (videoPath) {
          const videoBytes = archivesDisguised.writeFileToFdSync(videoPath, outFd);
          coreLogger.logger.info(`[ExportEncrypt] Video: ${path.basename(videoPath)} (${(videoBytes / 1024 / 1024).toFixed(1)} MB)`);
        }
        fs.writeSync(outFd, archivesDisguised.DISGUISE_MAGIC);
        const xorBytes = useDirect7z ? archivesDisguised.writeXorSingleFileZipToFdSync(enc7zPath, enc7zName, outFd, archivesDisguised.DISGUISE_XOR_KEY) : archivesDisguised.writeXorFileToFdSync(payloadPath, outFd, archivesDisguised.DISGUISE_XOR_KEY);
        fs.closeSync(outFd);
        const totalSize = fs.statSync(outputPath).size;
        const expectedMinSize = (videoPath ? fs.statSync(videoPath).size : 0) + archivesDisguised.DISGUISE_MAGIC.length + xorBytes;
        if (totalSize !== expectedMinSize) {
          throw new Error(i18n.t("backend.developer.export.encryptedExportSizeVerificationFailed"));
        }
        coreLogger.logger.info(`[ExportEncrypt] Done: ${outputPath} (${(totalSize / 1024 / 1024).toFixed(1)} MB)`);
        return {
          success: true,
          outputPath,
          size: totalSize
        };
      } finally {
        try {
          fs.rmSync(tmpDir, {
            recursive: true,
            force: true
          });
        } catch (_) {}
      }
    } catch (e) {
      coreLogger.logger.error(`[ExportEncrypt] Failed: ${e.message}`);
      return {
        success: false,
        error: e.message
      };
    }
  });
  electron.ipcMain.handle("dev:save-log", async (_, {
    category,
    modName,
    content
  }) => {
    try {
      const logsDir = path.join(electron.app.getPath("userData"), "logs", category || "general");
      fs.mkdirSync(logsDir, {
        recursive: true
      });
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const safeName = (modName || "unknown").replace(/[<>:"/\\|?*]/g, "_").slice(0, 80);
      const filename = `${timestamp}_${safeName}.log`;
      const logPath = path.join(logsDir, filename);
      fs.writeFileSync(logPath, content, "utf-8");
      return {
        success: true,
        path: logPath
      };
    } catch (e) {
      return {
        success: false,
        error: e.message
      };
    }
  });
  electron.ipcMain.handle("dev:open-logs-folder", async () => {
    try {
      const logsDir = path.join(electron.app.getPath("userData"), "logs");
      fs.mkdirSync(logsDir, {
        recursive: true
      });
      require("electron").shell.openPath(logsDir);
      return {
        success: true
      };
    } catch (e) {
      return {
        success: false,
        error: e.message
      };
    }
  });
}
module.exports = {
  registerIpc
};
