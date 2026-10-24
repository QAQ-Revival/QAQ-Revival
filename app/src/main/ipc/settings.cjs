"use strict";

const i18n = require("../../shared/i18n/core.cjs");
const electron = require("electron");
const fs = require("fs");
const {
  getRandomLaunchSettings
} = require("../runtime/random-executable.cjs");
const utils = require("@electron-toolkit/utils");
const configStore = require("../config/store.cjs");
const gamesSettings = require("../games/settings.cjs");
const netQaqm = require("../net/qaqm.cjs");
const overlayWindow = require("../overlay/window.cjs");
const presetsService = require("../presets/service.cjs");
const systemWindows = require("../system/windows.cjs");
function registerIpc() {
  electron.ipcMain.handle("get-config", async () => {
    return {
      success: true,
      config: gamesSettings.buildRendererConfig()
    };
  });
  electron.ipcMain.handle("settings:update-random-launch", async (_, updates) => {
    if (!updates || typeof updates !== "object" || Array.isArray(updates) || !Object.keys(updates).length || Object.entries(updates).some(([key, value]) => !["manager", "xxmi"].includes(key) || typeof value !== "boolean")) {
      return {
        success: false,
        error: i18n.t("backend.ipc.settings.invalidRandomLaunchSettings")
      };
    }
    const randomLaunch = {
      ...getRandomLaunchSettings(configStore.currentConfig),
      ...updates
    };
    const next = {
      ...configStore.currentConfig,
      randomLaunch
    };
    if (!configStore.saveConfig(next)) return {
      success: false,
      error: i18n.t("backend.ipc.settings.saveSettingsFailed")
    };
    configStore.currentConfig = next;
    return {
      success: true,
      settings: randomLaunch,
      restartRequired: Object.hasOwn(updates, "manager")
    };
  });
  electron.ipcMain.handle("get-runtime-info", async () => {
    return {
      appName: electron.app.getName(),
      appVersion: electron.app.getVersion(),
      platform: process.platform,
      elevated: systemWindows.isProcessElevated(),
      isDev: utils.is.dev,
      isPackaged: electron.app.isPackaged,
      userDataPath: electron.app.getPath("userData"),
      configPath: configStore.configPath,
      executable: process.execPath
    };
  });
  electron.ipcMain.handle("config:export", async () => {
    try {
      const activeGame = gamesSettings.getActiveGame();
      const result = await electron.dialog.showSaveDialog({
        title: i18n.t("backend.ipc.settings.exportPresets"),
        defaultPath: `QAQ-Revival_presets_${activeGame?.id || "default"}_${new Date().toISOString().slice(0, 10)}.json`,
        filters: [{
          name: "JSON",
          extensions: ["json"]
        }]
      });
      if (result.canceled || !result.filePath) return {
        success: false,
        canceled: true
      };
      const exportData = {
        version: electron.app.getVersion(),
        exportedAt: new Date().toISOString(),
        gameId: activeGame?.id || "endfield",
        gameName: activeGame?.name || "明日方舟终末地",
        presets: presetsService.loadPresets()
      };
      fs.writeFileSync(result.filePath, JSON.stringify(exportData, null, 2));
      return {
        success: true,
        path: result.filePath
      };
    } catch (error) {
      return {
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("config:import", async () => {
    try {
      const result = await electron.dialog.showOpenDialog({
        title: i18n.t("backend.ipc.settings.importPresets"),
        filters: [{
          name: "JSON",
          extensions: ["json"]
        }],
        properties: ["openFile"]
      });
      if (result.canceled || !result.filePaths.length) return {
        success: false,
        canceled: true
      };
      const data = JSON.parse(fs.readFileSync(result.filePaths[0], "utf-8"));
      if (!data.presets) return {
        error: i18n.t("backend.ipc.settings.invalidPresetFile")
      };
      const existing = presetsService.loadPresets();
      const existingIds = new Set((existing.presets || []).map(p => p.id));
      let importedScope = null;
      if (data.presets?.presetsByGame && typeof data.presets.presetsByGame === "object") {
        const currentGameId = gamesSettings.getActiveGameScopeId();
        importedScope = presetsService.normalizePresetScope(data.presets.presetsByGame[currentGameId] || data.presets.presetsByGame[data.gameId] || Object.values(data.presets.presetsByGame)[0]);
      } else {
        importedScope = presetsService.normalizePresetScope(data.presets);
      }
      const newPresets = importedScope.presets || [];
      let importedCount = 0;
      for (const preset of newPresets) {
        if (!existingIds.has(preset.id)) {
          existing.presets = existing.presets || [];
          existing.presets.push(preset);
          importedCount++;
        }
      }
      presetsService.savePresets(existing);
      return {
        success: true,
        message: i18n.t("backend.ipc.settings.presetsImported", {
          importedCount
        })
      };
    } catch (error) {
      return {
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("get-close-behavior", async () => {
    return {
      success: true,
      closeBehavior: configStore.currentConfig.closeBehavior || "ask"
    };
  });
  electron.ipcMain.handle("set-close-behavior", async (_, behavior) => {
    try {
      configStore.currentConfig.closeBehavior = behavior;
      configStore.saveConfig(configStore.currentConfig);
      return {
        success: true
      };
    } catch (error) {
      return {
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("set-server-url", async (_, url, options = {}) => {
    try {
      const devMode = !!options?.devMode;
      configStore.currentConfig.serverUrl = devMode ? netQaqm.normalizeDeveloperServerUrlInput(url) : netQaqm.normalizePersistedServerUrlInput(url) || netQaqm.DEFAULT_SERVER_URL;
      configStore.saveConfig(configStore.currentConfig);
      console.log(`[QAQR ServerUrl] 保存服务器地址: ${configStore.currentConfig.serverUrl}${devMode ? " (developer mode)" : ""}`);
      return {
        success: true,
        serverUrl: configStore.currentConfig.serverUrl
      };
    } catch (error) {
      return {
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("set-ui-zoom", async (_, zoom) => {
    try {
      const clamped = Math.min(1.5, Math.max(0.7, Number(zoom) || 1));
      configStore.currentConfig.uiZoom = clamped;
      configStore.saveConfig(configStore.currentConfig);
      return {
        success: true,
        uiZoom: clamped
      };
    } catch (error) {
      return {
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("set-mod-market-card-size", async (_, size) => {
    try {
      const legacyMap = {
        small: 88,
        medium: 100,
        large: 122
      };
      const raw = legacyMap[size] || Number(size);
      const normalized = Math.min(140, Math.max(80, Math.round(Number.isFinite(raw) ? raw : 100)));
      configStore.currentConfig.modMarketCardSize = normalized;
      configStore.saveConfig(configStore.currentConfig);
      return {
        success: true,
        modMarketCardSize: normalized
      };
    } catch (error) {
      return {
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("set-mod-download-image-ratio", async (_, ratio) => {
    try {
      if (!["4:3", "16:9", "16:10", "1:1", "3:4"].includes(ratio)) throw new Error(i18n.t("backend.ipc.settings.unsupportedCoverRatio"));
      configStore.currentConfig.modDownloadImageRatio = ratio;
      configStore.saveConfig(configStore.currentConfig);
      return {
        success: true,
        modDownloadImageRatio: ratio
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("set-compatibility-mode", async (_, enabled) => {
    try {
      const previousLevel = configStore.getCompatibilityLevel();
      const nextLevel = typeof enabled === "boolean" ? enabled ? 3 : 0 : configStore.normalizeCompatibilityLevel(enabled?.level ?? enabled);
      configStore.currentConfig.compatibilityLevel = nextLevel;
      configStore.currentConfig.compatibilityMode = nextLevel > 0;
      configStore.saveConfig(configStore.currentConfig);
      overlayWindow.resetOverlayWindowsForModeChange();
      return {
        success: true,
        compatibilityMode: configStore.currentConfig.compatibilityMode,
        compatibilityLevel: nextLevel,
        requiresRestart: previousLevel >= 3 || nextLevel >= 3
      };
    } catch (error) {
      return {
        error: error.message
      };
    }
  });
}
module.exports = {
  registerIpc
};
