"use strict";

const electron = require("electron");
const path = require("path");
const fs = require("fs");
const coreLogger = require("../core/logger.cjs");
const runtimePaths = require("../runtime/paths.cjs");
function registerIpc() {
  electron.ipcMain.handle("dev:load-ai-tags", async (_, {
    gameId: gameId2
  }) => {
    try {
      const tagsDir = path.join(runtimePaths.mainDir, "..", "..", "..", "..", "docs", "tags");
      const absTagsDir = fs.existsSync(tagsDir) ? tagsDir : path.join(electron.app.getPath("userData"), "dev", "tags");
      const filePath = path.join(absTagsDir, "ai-tag-suggestions.json");
      if (!fs.existsSync(filePath)) return {
        success: true,
        data: {}
      };
      const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      return {
        success: true,
        data: raw[gameId2] || {}
      };
    } catch (e) {
      return {
        success: true,
        data: {}
      };
    }
  });
  electron.ipcMain.handle("dev:save-ai-tags", async (_, {
    modName,
    characterName,
    gameId: gameId2,
    allTags,
    poolTags,
    newTags,
    timestamp
  }) => {
    try {
      const tagsDir = path.join(runtimePaths.mainDir, "..", "..", "..", "..", "docs", "tags");
      const absTagsDir = fs.existsSync(tagsDir) ? tagsDir : path.join(electron.app.getPath("userData"), "dev", "tags");
      if (!fs.existsSync(absTagsDir)) {
        fs.mkdirSync(absTagsDir, {
          recursive: true
        });
      }
      const filePath = path.join(absTagsDir, "ai-tag-suggestions.json");
      let data = {};
      try {
        if (fs.existsSync(filePath)) {
          data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        }
      } catch {}
      if (!data[gameId2]) data[gameId2] = {};
      if (!data[gameId2][characterName]) data[gameId2][characterName] = {};
      data[gameId2][characterName][modName] = {
        allTags,
        poolTags,
        newTags,
        timestamp
      };
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
      coreLogger.logger.info(`AI tags saved to ${filePath} for ${gameId2}/${characterName}/${modName}`);
      return {
        success: true
      };
    } catch (e) {
      coreLogger.logger.error("Save AI tags error:", e);
      return {
        error: e.message
      };
    }
  });
}
module.exports = {
  registerIpc
};
