"use strict";

const i18n = require("../../shared/i18n/core.cjs");
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const coreLogger = require("../core/logger.cjs");
const marketSettings = require("../market/settings.cjs");
const systemWindows = require("../system/windows.cjs");
function getTempExtractFallbackBase(anchorPath) {
  try {
    const resolved = anchorPath ? path.resolve(anchorPath) : "";
    const driveRoot = resolved ? path.parse(resolved).root : "";
    if (!driveRoot) return "";
    return path.join(driveRoot, "QAQR_TempExtractCache");
  } catch (_) {
    return "";
  }
}
function ensureTempRootNearPath(anchorPath, folderName) {
  const candidates = [path.join(marketSettings.getMarketDownloadCacheDir(), "QAQR_TempExtract"), getTempExtractFallbackBase(anchorPath), path.join(electron.app.getPath("temp"), "QAQR_TempExtract")].filter(Boolean);
  let lastError = null;
  for (const baseDir of candidates) {
    try {
      systemWindows.probeWritableDirectory(baseDir, "QAQR temp extract cache");
      cleanupTempExtractCache(baseDir);
      const tempRoot = path.join(baseDir, folderName);
      fs.mkdirSync(tempRoot, {
        recursive: true
      });
      return tempRoot;
    } catch (error) {
      lastError = error;
      coreLogger.logger.warn(`[TempExtract] Cannot use ${baseDir}: ${error?.message || error}`);
    }
  }
  throw lastError || new Error(i18n.t("backend.archives.temp.noWritableTempExtractDirectoryAvailable"));
}
function cleanupTempExtractCache(baseDir, maxAgeMs = 24 * 60 * 60 * 1e3) {
  try {
    if (!baseDir || !fs.existsSync(baseDir)) return;
    const now = Date.now();
    for (const entry of fs.readdirSync(baseDir, {
      withFileTypes: true
    })) {
      if (!entry.isDirectory() || !/^\.qaqm-/i.test(entry.name)) continue;
      const fullPath = path.join(baseDir, entry.name);
      const stat = fs.statSync(fullPath);
      if (now - stat.mtimeMs > maxAgeMs) {
        fs.rmSync(fullPath, {
          recursive: true,
          force: true
        });
      }
    }
  } catch (_) {}
}
function isDiskSpaceError(resultOrMessage) {
  const message = typeof resultOrMessage === "string" ? resultOrMessage : `${resultOrMessage?.stderr || ""}
${resultOrMessage?.stdout || ""}`;
  return /磁盘空间不足|空间不足|not enough space|There is not enough space/i.test(message);
}
module.exports = {
  ensureTempRootNearPath,
  isDiskSpaceError
};
