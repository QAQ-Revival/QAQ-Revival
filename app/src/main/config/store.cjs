"use strict";

const electron = require("electron");
const path = require("path");
const fs = require("fs");
const {
  readJsonFileSync,
  writeJsonFileSync
} = require("../core/json-store.cjs");
const crypto = require("crypto");
const netQaqm = require("../net/qaqm.cjs");
const overlayHelperPaths = require("../overlay/helper-paths.cjs");
const CONFIG_PATH = path.join(electron.app.getPath("userData"), "config.json");
const BASE_DEFAULT_CONFIG = {
  language: "zh-CN",
  modsPath: "",
  gamePath: "",
  loaderPath: "",
  efmiPath: "",
  xxmiPath: "",
  serverUrl: netQaqm.DEFAULT_SERVER_URL,
  characterUsage: {},
  // Map of characterName -> timestamp
  pinnedMods: {},
  characterSectionsByGame: {},
  characterSkinCatalogIdentityByGame: {},
  activeSkinId: null,
  // Currently active skin ID
  // Multi-game support
  games: [],
  // Array of game configs
  activeGameId: null,
  // Currently selected game ID
  // Close behavior: 'ask' | 'minimize' | 'quit'
  closeBehavior: "ask",
  uiZoom: 1,
  modMarketCardSize: 100,
  modDownloadImageRatio: "4:3",
  compatibilityMode: false,
  compatibilityLevel: 0,
  overlayAutoReloadEnabled: true,
  overlayPresetAutoReloadEnabled: true,
  overlayClickableHotkeysEnabled: true,
  overlayHotkey: "Alt+F",
  overlayWindowScale: 1,
  persistBridgeEnabled: false,
  persistBridgeTracking: {}
};
function createDefaultConfig() {
  return {
    ...BASE_DEFAULT_CONFIG,
    ...overlayHelperPaths.getAutoOverlayCommandDefaults()
  };
}
const CONFIG_BAK_PATH = CONFIG_PATH + ".bak";
const CONFIG_TMP_PATH = CONFIG_PATH + ".tmp";
function applyConfigFieldDefaults(parsed, defaults) {
  const normalizedServerUrl = netQaqm.normalizePersistedServerUrlInput(parsed.serverUrl);
  if (!normalizedServerUrl) {
    delete parsed.serverUrl;
  } else {
    parsed.serverUrl = normalizedServerUrl;
  }
  if (!parsed.overlayAutoReloadCommand || !parsed.overlayAutoReloadCommand.trim()) {
    parsed.overlayAutoReloadCommand = defaults.overlayAutoReloadCommand;
  } else if (overlayHelperPaths.isManagedOverlayHelperCommand(parsed.overlayAutoReloadCommand, "press_f10")) {
    parsed.overlayAutoReloadCommand = defaults.overlayAutoReloadCommand;
  }
  if (!parsed.overlayHotkeyCommandTemplate || !parsed.overlayHotkeyCommandTemplate.trim()) {
    parsed.overlayHotkeyCommandTemplate = defaults.overlayHotkeyCommandTemplate;
  } else if (overlayHelperPaths.isManagedOverlayHelperCommand(parsed.overlayHotkeyCommandTemplate, "press_hotkey")) {
    parsed.overlayHotkeyCommandTemplate = defaults.overlayHotkeyCommandTemplate;
  }
  return parsed;
}
function tryReadConfigFile(filePath) {
  if (fs.existsSync(filePath + ".copying")) {
    try {
      return readJsonFileSync(filePath);
    } catch (_) {
      return null;
    }
  }
  try {
    if (!fs.existsSync(filePath)) return null;
    const data = fs.readFileSync(filePath, "utf-8");
    if (!data || !data.trim()) return null;
    return JSON.parse(data);
  } catch (e) {
    console.error(`Failed to parse config at ${filePath}:`, e?.message || e);
    return null;
  }
}
function quarantineCorruptConfig(filePath) {
  try {
    if (!fs.existsSync(filePath)) return;
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const dest = `${filePath}.corrupt-${ts}`;
    fs.copyFileSync(filePath, dest);
    console.warn(`[Config] Quarantined corrupt config to ${dest}`);
  } catch (_) {}
}
function loadConfig() {
  const defaults = createDefaultConfig();
  const primary = tryReadConfigFile(CONFIG_PATH);
  if (primary && typeof primary === "object" && !Array.isArray(primary)) {
    return {
      ...defaults,
      ...applyConfigFieldDefaults(primary, defaults)
    };
  }
  if (fs.existsSync(CONFIG_PATH)) {
    quarantineCorruptConfig(CONFIG_PATH);
  }
  const backup = tryReadConfigFile(CONFIG_BAK_PATH);
  if (backup && typeof backup === "object" && !Array.isArray(backup)) {
    console.warn("[Config] Primary config unreadable, recovered from .bak");
    try {
      fs.copyFileSync(CONFIG_BAK_PATH, CONFIG_PATH);
    } catch (_) {}
    return {
      ...defaults,
      ...applyConfigFieldDefaults(backup, defaults)
    };
  }
  return defaults;
}
function saveConfig(config) {
  try {
    const payload = JSON.stringify(config, null, 2);
    const fd = fs.openSync(CONFIG_TMP_PATH, "w");
    try {
      fs.writeSync(fd, payload, 0, "utf-8");
      try {
        fs.fsyncSync(fd);
      } catch (_) {}
    } finally {
      fs.closeSync(fd);
    }
    if (fs.existsSync(CONFIG_PATH)) {
      try {
        const current = fs.readFileSync(CONFIG_PATH, "utf-8");
        JSON.parse(current);
        fs.copyFileSync(CONFIG_PATH, CONFIG_BAK_PATH);
      } catch (_) {}
    }
    try {
      fs.renameSync(CONFIG_TMP_PATH, CONFIG_PATH);
    } catch (error) {
      if (error.code !== "EXDEV") throw error;
      writeJsonFileSync(CONFIG_PATH, config);
    }
    return true;
  } catch (e) {
    console.error("Failed to save config:", e);
    try {
      if (fs.existsSync(CONFIG_TMP_PATH)) fs.unlinkSync(CONFIG_TMP_PATH);
    } catch (_) {}
    return false;
  }
}
function migrateFromV3() {
  const v4UserData = electron.app.getPath("userData");
  const v3UserData = path.join(path.dirname(v4UserData), "modmanager");
  const v3ConfigPath = path.join(v3UserData, "config.json");
  const v4ConfigPath = CONFIG_PATH;
  const migrationFlag = path.join(v4UserData, ".v3-migrated");
  if (fs.existsSync(migrationFlag)) return;
  if (!fs.existsSync(v3ConfigPath)) return;
  if (fs.existsSync(v4ConfigPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(v4ConfigPath, "utf-8"));
      if (existing.modsPath && existing.modsPath.trim() !== "") {
        fs.writeFileSync(migrationFlag, new Date().toISOString());
        return;
      }
    } catch (e) {}
  }
  console.log("[Migration] Detected v3 data, migrating to v4...");
  try {
    const v3Config = fs.readFileSync(v3ConfigPath, "utf-8");
    fs.writeFileSync(v4ConfigPath, v3Config);
    console.log("[Migration] config.json migrated");
    const filesToCopy = ["presets.json", "hotkeys.json", "skin-config.json", "mod-market-cache.json"];
    for (const file of filesToCopy) {
      const src = path.join(v3UserData, file);
      const dst = path.join(v4UserData, file);
      if (fs.existsSync(src) && !fs.existsSync(dst)) {
        fs.copyFileSync(src, dst);
        console.log(`[Migration] ${file} migrated`);
      }
    }
    const v3Images = path.join(v3UserData, "images");
    const v4Images = path.join(v4UserData, "images");
    if (fs.existsSync(v3Images)) {
      if (!fs.existsSync(v4Images)) fs.mkdirSync(v4Images, {
        recursive: true
      });
      const imageFiles = fs.readdirSync(v3Images);
      for (const file of imageFiles) {
        const src = path.join(v3Images, file);
        const dst = path.join(v4Images, file);
        if (!fs.existsSync(dst) && fs.statSync(src).isFile()) {
          fs.copyFileSync(src, dst);
        }
      }
      console.log(`[Migration] images/ migrated (${imageFiles.length} files)`);
    }
    const v3Bg = path.join(v3UserData, "cloud-backgrounds");
    const v4Bg = path.join(v4UserData, "cloud-backgrounds");
    if (fs.existsSync(v3Bg)) {
      if (!fs.existsSync(v4Bg)) fs.mkdirSync(v4Bg, {
        recursive: true
      });
      const bgFiles = fs.readdirSync(v3Bg);
      for (const file of bgFiles) {
        const src = path.join(v3Bg, file);
        const dst = path.join(v4Bg, file);
        if (!fs.existsSync(dst) && fs.statSync(src).isFile()) {
          fs.copyFileSync(src, dst);
        }
      }
      console.log(`[Migration] cloud-backgrounds/ migrated`);
    }
    fs.writeFileSync(migrationFlag, new Date().toISOString());
    console.log("[Migration] V3 → V4 migration complete!");
  } catch (e) {
    console.error("[Migration] Error during migration:", e);
    try {
      fs.writeFileSync(migrationFlag, `error: ${e.message}`);
    } catch (_) {}
  }
}
let currentConfig;
function normalizeCompatibilityLevel(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(3, Math.max(0, Math.round(number)));
}
function getCompatibilityLevel() {
  if (currentConfig.compatibilityLevel !== void 0) {
    return normalizeCompatibilityLevel(currentConfig.compatibilityLevel);
  }
  return currentConfig.compatibilityMode ? 3 : 0;
}
function isCompatibilityModeEnabled() {
  return getCompatibilityLevel() > 0;
}
function isStrongCompatibilityModeEnabled() {
  return getCompatibilityLevel() >= 3;
}
function initialize() {
  migrateFromV3();
  currentConfig = loadConfig();
  if (currentConfig.persistBridgeSettingsVersion !== 1 && fs.existsSync(CONFIG_PATH)) {
    const migrationBackup = CONFIG_PATH + ".before-per-game-persist.bak";
    if (!fs.existsSync(migrationBackup)) fs.copyFileSync(CONFIG_PATH, migrationBackup);
  }
  if (!currentConfig.clientId) {
    currentConfig.clientId = crypto.randomUUID();
    saveConfig(currentConfig);
  }
}
module.exports = {
  initialize,
  saveConfig,
  normalizeCompatibilityLevel,
  getCompatibilityLevel,
  isCompatibilityModeEnabled,
  isStrongCompatibilityModeEnabled,
  get currentConfig() {
    return currentConfig;
  },
  set currentConfig(value) {
    currentConfig = value;
  }
};
