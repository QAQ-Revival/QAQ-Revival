"use strict";

const i18n = require("../../shared/i18n/core.cjs");
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const SKIN_CONFIG_PATH = path.join(electron.app.getPath("userData"), "skin-config.json");
const BUILTIN_SKINS = [{
  id: "aurora-premium",
  name: i18n.t("backend.config.appearance.auroraName"),
  description: i18n.t("backend.config.appearance.auroraDescription")
}];
function loadSkinConfig() {
  try {
    if (fs.existsSync(SKIN_CONFIG_PATH)) {
      const data = fs.readFileSync(SKIN_CONFIG_PATH, "utf-8");
      const config = JSON.parse(data);
      return {
        activeSkinId: BUILTIN_SKINS.some(skin => skin.id === config?.activeSkinId) ? config.activeSkinId : null
      };
    }
  } catch (e) {
    console.error("Failed to load skin config:", e);
  }
  return {
    activeSkinId: null
  };
}
function saveSkinConfig(config) {
  try {
    fs.writeFileSync(SKIN_CONFIG_PATH, JSON.stringify(config, null, 2));
  } catch (e) {
    console.error("Failed to save skin config:", e);
    throw e;
  }
}
function registerIpc() {
  electron.ipcMain.handle("get-skins", async () => {
    try {
      const skinConfig = loadSkinConfig();
      const skins = BUILTIN_SKINS.map(skin => ({
        ...skin,
        isActive: skin.id === skinConfig.activeSkinId
      }));
      return {
        success: true,
        skins,
        activeSkinId: skinConfig.activeSkinId
      };
    } catch (error) {
      return {
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("set-active-skin", async (_, skinId) => {
    try {
      if (skinId !== null && !BUILTIN_SKINS.some(skin => skin.id === skinId)) {
        return {
          success: false,
          error: i18n.t("backend.config.appearance.themeUnavailable")
        };
      }
      const skinConfig = loadSkinConfig();
      skinConfig.activeSkinId = skinId;
      saveSkinConfig(skinConfig);
      return {
        success: true
      };
    } catch (error) {
      return {
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("get-active-skin", async () => {
    try {
      const skinConfig = loadSkinConfig();
      if (!skinConfig.activeSkinId) {
        return {
          success: true,
          skin: null
        };
      }
      return {
        success: true,
        skin: BUILTIN_SKINS.find(skin => skin.id === skinConfig.activeSkinId) || null
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
