"use strict";

const i18n = require("../../shared/i18n/core.cjs");
module.exports = {
  registerIpc,
  isModMarked,
  setMarkedModForConfig,
  deleteMarkedModFromConfig
};
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const configStore = require("../config/store.cjs");
const desktopNotifications = require("../desktop/notifications.cjs");
const gamesSettings = require("../games/settings.cjs");
function getMarkedModsForGame(gameId2 = gamesSettings.getActiveGameScopeId()) {
  return configStore.currentConfig.markedMods?.[gameId2] || {};
}
function isModMarked(gameId2, characterName, modName) {
  const markedForCharacter = configStore.currentConfig.markedMods?.[gameId2]?.[characterName];
  if (!markedForCharacter) return false;
  if (markedForCharacter[modName]) return true;
  return Object.entries(markedForCharacter).some(([key, value]) => {
    const item = value && typeof value === "object" ? value : {};
    return key === modName || item.name === modName || item.originalName === modName;
  });
}
function setMarkedModForConfig(gameId2, characterName, modName, payload = {}) {
  if (!configStore.currentConfig.markedMods) configStore.currentConfig.markedMods = {};
  if (!configStore.currentConfig.markedMods[gameId2]) configStore.currentConfig.markedMods[gameId2] = {};
  if (!configStore.currentConfig.markedMods[gameId2][characterName]) configStore.currentConfig.markedMods[gameId2][characterName] = {};
  configStore.currentConfig.markedMods[gameId2][characterName][modName] = payload;
  configStore.saveConfig(configStore.currentConfig);
}
function deleteMarkedModFromConfig(gameId2, characterName, modName) {
  if (!configStore.currentConfig.markedMods?.[gameId2]?.[characterName]) return;
  for (const [key, value] of Object.entries(configStore.currentConfig.markedMods[gameId2][characterName])) {
    const item = value && typeof value === "object" ? value : {};
    if (key === modName || item.name === modName || item.originalName === modName) {
      delete configStore.currentConfig.markedMods[gameId2][characterName][key];
    }
  }
  if (Object.keys(configStore.currentConfig.markedMods[gameId2][characterName]).length === 0) {
    delete configStore.currentConfig.markedMods[gameId2][characterName];
  }
  if (Object.keys(configStore.currentConfig.markedMods[gameId2]).length === 0) {
    delete configStore.currentConfig.markedMods[gameId2];
  }
  configStore.saveConfig(configStore.currentConfig);
}
function registerIpc() {
  electron.ipcMain.handle("dev:mark-mod", async (_, {
    gameId: gameId2,
    characterName,
    modName,
    modPath
  }) => {
    try {
      setMarkedModForConfig(gameId2, characterName, modName, {
        name: modName,
        characterName,
        gameId: gameId2,
        path: modPath,
        originalPath: modPath,
        markedAt: new Date().toISOString()
      });
      desktopNotifications.notifyMarkedModsChanged(gameId2, characterName);
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
  electron.ipcMain.handle("dev:unmark-mod", async (_, {
    gameId: gameId2,
    characterName,
    modName
  }) => {
    try {
      deleteMarkedModFromConfig(gameId2, characterName, modName);
      desktopNotifications.notifyMarkedModsChanged(gameId2, characterName);
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
  electron.ipcMain.handle("dev:get-marked-mods", async (_, {
    gameId: gameId2
  }) => {
    try {
      const marked = getMarkedModsForGame(gameId2);
      return {
        success: true,
        marked
      };
    } catch (e) {
      return {
        success: false,
        marked: {},
        error: e.message
      };
    }
  });
  electron.ipcMain.handle("dev:select-migrate-dest", async () => {
    try {
      const {
        dialog: dialog2
      } = require("electron");
      const defaultPath = configStore.currentConfig.lastMigrateTarget || electron.app.getPath("desktop");
      const result = await dialog2.showOpenDialog({
        title: i18n.t("backend.developer.marked.chooseMigrationDestination"),
        defaultPath,
        properties: ["openDirectory", "createDirectory"]
      });
      if (result.canceled || !result.filePaths.length) return {
        success: false,
        canceled: true
      };
      const dest = result.filePaths[0];
      configStore.currentConfig.lastMigrateTarget = dest;
      configStore.saveConfig(configStore.currentConfig);
      return {
        success: true,
        dest
      };
    } catch (e) {
      return {
        success: false,
        error: e.message
      };
    }
  });
  electron.ipcMain.handle("dev:migrate-mods", async (_, {
    gameId: gameId2,
    destFolder
  }) => {
    try {
      const marked = configStore.currentConfig.markedMods?.[gameId2] || {};
      if (!configStore.currentConfig.migratedMods) configStore.currentConfig.migratedMods = [];
      const results = [];
      for (const [charName, mods] of Object.entries(marked)) {
        for (const [modName, info] of Object.entries(mods)) {
          const src = info.originalPath;
          if (!src || !fs.existsSync(src)) {
            results.push({
              modName,
              success: false,
              error: i18n.t("backend.developer.marked.sourcePathMissing")
            });
            continue;
          }
          const dest = path.join(destFolder, path.basename(src));
          try {
            fs.renameSync(src, dest);
            configStore.currentConfig.migratedMods.push({
              gameId: gameId2,
              characterName: charName,
              modName,
              originalPath: src,
              currentPath: dest
            });
            results.push({
              modName,
              success: true,
              dest
            });
          } catch (e) {
            results.push({
              modName,
              success: false,
              error: e.message
            });
          }
        }
      }
      if (configStore.currentConfig.markedMods) delete configStore.currentConfig.markedMods[gameId2];
      configStore.saveConfig(configStore.currentConfig);
      return {
        success: true,
        results
      };
    } catch (e) {
      return {
        success: false,
        error: e.message
      };
    }
  });
  electron.ipcMain.handle("dev:migrate-mods-back", async (_, {
    gameId: gameId2
  }) => {
    try {
      if (!configStore.currentConfig.migratedMods?.length) return {
        success: true,
        results: []
      };
      const toRestore = gameId2 ? configStore.currentConfig.migratedMods.filter(m => m.gameId === gameId2) : configStore.currentConfig.migratedMods;
      const results = [];
      for (const entry of toRestore) {
        if (!fs.existsSync(entry.currentPath)) {
          results.push({
            modName: entry.modName,
            success: false,
            error: i18n.t("backend.developer.marked.currentPathMissing")
          });
          continue;
        }
        const originalDir = path.dirname(entry.originalPath);
        if (!fs.existsSync(originalDir)) fs.mkdirSync(originalDir, {
          recursive: true
        });
        try {
          fs.renameSync(entry.currentPath, entry.originalPath);
          results.push({
            modName: entry.modName,
            success: true
          });
        } catch (e) {
          results.push({
            modName: entry.modName,
            success: false,
            error: e.message
          });
        }
      }
      const restoredPaths = new Set(results.filter(r => r.success).map(r => r.modName));
      configStore.currentConfig.migratedMods = configStore.currentConfig.migratedMods.filter(m => !(m.gameId === gameId2 && restoredPaths.has(m.modName)));
      configStore.saveConfig(configStore.currentConfig);
      return {
        success: true,
        results
      };
    } catch (e) {
      return {
        success: false,
        error: e.message
      };
    }
  });
  electron.ipcMain.handle("dev:get-migrated-mods", async (_, {
    gameId: gameId2
  }) => {
    try {
      const all = configStore.currentConfig.migratedMods || [];
      const filtered = gameId2 ? all.filter(m => m.gameId === gameId2) : all;
      return {
        success: true,
        migratedMods: filtered
      };
    } catch (e) {
      return {
        success: false,
        migratedMods: [],
        error: e.message
      };
    }
  });
}
