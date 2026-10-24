"use strict";

const i18n = require("../../shared/i18n/core.cjs");
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const coreLogger = require("../core/logger.cjs");
const systemPaths = require("../system/paths.cjs");
const systemWindows = require("../system/windows.cjs");
const MOD_CACHE_PATH = path.join(electron.app.getPath("userData"), "mod-market-cache.json");
const LEGACY_MOD_CACHE_PATH = MOD_CACHE_PATH;
const MARKET_DOWNLOAD_SETTINGS_PATH = path.join(electron.app.getPath("userData"), "market-download-settings.json");
function getQaqInstallDir() {
  if (electron.app.isPackaged) return path.dirname(process.execPath);
  return path.resolve(electron.app.getAppPath());
}
function getDefaultMarketDownloadCacheDir() {
  const installDir = getQaqInstallDir();
  const cacheDir = path.join(installDir, "QAQR_DownloadCache");
  const legacyDir = path.join(installDir, "QAQM_DownloadCache");
  return !fs.existsSync(cacheDir) && fs.existsSync(legacyDir) ? legacyDir : cacheDir;
}
function loadMarketDownloadSettings() {
  try {
    if (!fs.existsSync(MARKET_DOWNLOAD_SETTINGS_PATH)) return {};
    const parsed = JSON.parse(fs.readFileSync(MARKET_DOWNLOAD_SETTINGS_PATH, "utf-8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    coreLogger.logger.warn("Failed to load market download settings:", error?.message || error);
    return {};
  }
}
function saveMarketDownloadSettings(settings = {}) {
  fs.writeFileSync(MARKET_DOWNLOAD_SETTINGS_PATH, JSON.stringify(settings, null, 2));
}
function getMarketDownloadCacheDir() {
  const settings = loadMarketDownloadSettings();
  const customDir = String(settings.cacheDir || "").trim();
  return customDir || getDefaultMarketDownloadCacheDir();
}
function getMarketDownloadSettingsForRenderer() {
  const cacheDir = getMarketDownloadCacheDir();
  const defaultCacheDir = getDefaultMarketDownloadCacheDir();
  return {
    success: true,
    cacheDir,
    defaultCacheDir,
    isDefault: systemPaths.normalizeComparablePath(cacheDir) === systemPaths.normalizeComparablePath(defaultCacheDir)
  };
}
function ensureMarketDownloadCacheDir() {
  const cacheDir = getMarketDownloadCacheDir();
  systemWindows.probeWritableDirectory(cacheDir, i18n.t("backend.validation.downloadCacheDirectory"));
  return cacheDir;
}
module.exports = {
  getQaqInstallDir,
  loadMarketDownloadSettings,
  saveMarketDownloadSettings,
  getMarketDownloadCacheDir,
  getMarketDownloadSettingsForRenderer,
  ensureMarketDownloadCacheDir,
  LEGACY_MOD_CACHE_PATH
};
