"use strict";

module.exports = {
  notifyAllModWindowsChanged,
  notifyCharacterListChanged,
  notifyMarkedModsChanged,
  notifyModToggleQueue
};
const electron = require("electron");
const charactersDirectories = require("../characters/directories.cjs");
const gamesSettings = require("../games/settings.cjs");
const overlayActivity = require("../overlay/activity.cjs");
function notifyAllModWindowsChanged(characterName = "__all__", meta = {}) {
  charactersDirectories.CHARACTER_DIRECTORY_STATS_CACHE.clear();
  const arknightsSync = meta?.resourcesChanged === false ? null : require("../games/arknights/service.cjs").onModsChanged(meta?.gameId || gamesSettings.getActiveGameScopeId());
  const payload = {
    characterName,
    ...(arknightsSync ? { arknightsSync } : {}),
    ...(meta && typeof meta === "object" ? meta : {})
  };
  electron.BrowserWindow.getAllWindows().forEach(window => {
    if (!window.isDestroyed()) {
      window.webContents.send("mods-changed", payload);
    }
  });
}
function notifyCharacterListChanged(characterName = "__all__", meta = {}) {
  overlayActivity.overlayActivity.invalidate();
  const changedCharacterName = String(characterName || "").trim() || "__all__";
  const safeMeta = meta && typeof meta === "object" ? meta : {};
  notifyAllModWindowsChanged("__all__", {
    ...safeMeta,
    fullRefresh: true,
    changedCharacterName
  });
}
// Queue changes only grey out or release single switches; they carry the
// finished states so windows can update before their next full refresh.
function notifyModToggleQueue(payload) {
  electron.BrowserWindow.getAllWindows().forEach(window => {
    if (!window.isDestroyed()) window.webContents.send("mod-toggle-queue", payload);
  });
}
function notifyMarkedModsChanged(gameId2 = gamesSettings.getActiveGameScopeId(), characterName = "__all__", meta = {}) {
  const payload = {
    gameId: gameId2,
    characterName,
    ...(meta && typeof meta === "object" ? meta : {})
  };
  electron.BrowserWindow.getAllWindows().forEach(window => {
    if (!window.isDestroyed()) {
      window.webContents.send("marked-mods-changed", payload);
    }
  });
}
