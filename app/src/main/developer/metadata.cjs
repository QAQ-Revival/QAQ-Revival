"use strict";

const i18n = require("../../shared/i18n/core.cjs");
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const charactersImages = require("../characters/images.cjs");
const coreLogger = require("../core/logger.cjs");
const gamesSettings = require("../games/settings.cjs");
const modsMetadata = require("../mods/metadata.cjs");
let devCopiedModInfo = null;
function getDevModInfoClipboardDir() {
  const dir = path.join(electron.app.getPath("userData"), "DevModInfoClipboard");
  fs.mkdirSync(dir, {
    recursive: true
  });
  return dir;
}
function cleanupPreviousDevCopiedPreview() {
  try {
    const previewPath = devCopiedModInfo?.cachedPreviewPath;
    const cacheDir = getDevModInfoClipboardDir();
    if (previewPath && fs.existsSync(previewPath) && path.dirname(previewPath).toLowerCase() === cacheDir.toLowerCase()) {
      fs.unlinkSync(previewPath);
    }
  } catch (_) {}
}
function removeExistingModPreviewImages(modDir) {
  if (!modDir || !fs.existsSync(modDir)) return;
  const files = fs.readdirSync(modDir);
  for (const file of files) {
    if (!/^(preview|cover)\./i.test(file)) continue;
    if (!/\.(png|jpg|jpeg|webp|gif|bmp|svg|ico|tiff|tif)$/i.test(file)) continue;
    try {
      fs.unlinkSync(path.join(modDir, file));
    } catch (e) {
      coreLogger.logger.warn(`[DevModInfo] Failed to delete old preview ${file}: ${e.message}`);
    }
  }
}
function validateDevModDirectory(modPath) {
  if (!modPath || typeof modPath !== "string") return i18n.t("backend.developer.export.modFolderMissing");
  if (!fs.existsSync(modPath)) return i18n.t("backend.developer.publish.modFolderMissing", {
    resolvedModFolder: modPath
  });
  if (!fs.statSync(modPath).isDirectory()) return i18n.t("backend.developer.metadata.invalidModFolder", {
    modPath
  });
  return null;
}
function registerIpc() {
  electron.ipcMain.handle("dev:get-mod-tags", async (_, {
    modPath
  }) => {
    try {
      return {
        success: true,
        tags: modsMetadata.readModTagsFromDir(modPath)
      };
    } catch (e) {
      return {
        success: false,
        tags: [],
        error: e.message
      };
    }
  });
  electron.ipcMain.handle("dev:set-mod-tags", async (_, {
    modPath,
    tags
  }) => {
    try {
      modsMetadata.writeModTagsToDir(modPath, tags);
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
  electron.ipcMain.handle("dev:copy-mod-info", async (_, {
    modPath,
    modName,
    characterName,
    gameId: gameId2
  } = {}) => {
    try {
      const validationError = validateDevModDirectory(modPath);
      if (validationError) return {
        success: false,
        error: validationError
      };
      const tags = modsMetadata.readModTagsFromDir(modPath);
      const previewPath = charactersImages.findModPreviewImageFile(modPath);
      cleanupPreviousDevCopiedPreview();
      let cachedPreviewPath = null;
      if (previewPath && fs.existsSync(previewPath)) {
        const ext = path.extname(previewPath).toLowerCase() || ".png";
        cachedPreviewPath = path.join(getDevModInfoClipboardDir(), `${crypto.randomUUID()}${ext}`);
        fs.copyFileSync(previewPath, cachedPreviewPath);
      }
      const sourceModName = modName || path.basename(modPath);
      devCopiedModInfo = {
        sourceModPath: modPath,
        sourceModName,
        characterName: characterName || "",
        gameId: gameId2 || gamesSettings.getActiveGameScopeId(),
        tags,
        cachedPreviewPath,
        copiedAt: Date.now()
      };
      await electron.clipboard.writeText([i18n.t("backend.developer.metadata.infoCopied"), `Mod: ${sourceModName}`, characterName ? i18n.t("backend.developer.metadata.characterInfo", {
        characterName
      }) : "", `Tags: ${tags.join(", ") || i18n.t("backend.common.none")}`, cachedPreviewPath ? i18n.t("backend.developer.metadata.coverInfo", {
        fileName: path.basename(cachedPreviewPath)
      }) : i18n.t("backend.developer.metadata.coverMissing")].filter(Boolean).join("\n"));
      return {
        success: true,
        sourceModName,
        tagCount: tags.length,
        tags,
        hasPreview: !!cachedPreviewPath,
        copiedAt: devCopiedModInfo.copiedAt
      };
    } catch (e) {
      coreLogger.logger.error(`[DevModInfo] copy failed: ${e.message}`);
      return {
        success: false,
        error: e.message
      };
    }
  });
  electron.ipcMain.handle("dev:import-mod-info", async (_, {
    modPath
  } = {}) => {
    try {
      if (!devCopiedModInfo) return {
        success: false,
        error: i18n.t("backend.developer.metadata.clipboardEmpty")
      };
      const validationError = validateDevModDirectory(modPath);
      if (validationError) return {
        success: false,
        error: validationError
      };
      const tags = modsMetadata.writeModTagsToDir(modPath, devCopiedModInfo.tags || []);
      let previewUrl = null;
      let copiedImage = false;
      let newPreviewPath = null;
      const sourcePreviewPath = devCopiedModInfo.cachedPreviewPath;
      if (sourcePreviewPath && fs.existsSync(sourcePreviewPath)) {
        removeExistingModPreviewImages(modPath);
        const ext = path.extname(sourcePreviewPath).toLowerCase() || ".png";
        newPreviewPath = path.join(modPath, `preview${ext}`);
        fs.copyFileSync(sourcePreviewPath, newPreviewPath);
        previewUrl = charactersImages.readImageAsDataUrl(newPreviewPath);
        copiedImage = true;
      }
      return {
        success: true,
        sourceModName: devCopiedModInfo.sourceModName,
        tagCount: tags.length,
        tags,
        copiedImage,
        newPreviewPath,
        previewUrl
      };
    } catch (e) {
      coreLogger.logger.error(`[DevModInfo] import failed: ${e.message}`);
      return {
        success: false,
        error: e.message
      };
    }
  });
  electron.ipcMain.handle("mod:get-meta", async (_, {
    modPath
  }) => {
    try {
      if (!modPath) return {
        success: false,
        tags: [],
        notes: "",
        hotkeyAliases: {},
        error: i18n.t("backend.developer.metadata.modPathRequired")
      };
      const tagsFile = path.join(modPath, "tags.json");
      if (!fs.existsSync(tagsFile)) return {
        success: true,
        tags: [],
        notes: "",
        hotkeyAliases: {}
      };
      const meta = JSON.parse(fs.readFileSync(tagsFile, "utf-8")) || {};
      const tags = Array.isArray(meta.tags) ? meta.tags.map(t => typeof t === "string" ? t : t && t.name ? String(t.name) : "").filter(Boolean) : [];
      const notes = typeof meta.notes === "string" ? meta.notes : "";
      const hotkeyAliases = {};
      if (meta.hotkeyAliases && typeof meta.hotkeyAliases === "object" && !Array.isArray(meta.hotkeyAliases)) {
        for (const [section, alias] of Object.entries(meta.hotkeyAliases)) {
          if (typeof alias === "string" && alias.trim()) hotkeyAliases[section] = alias;
        }
      }
      return {
        success: true,
        tags,
        notes,
        hotkeyAliases
      };
    } catch (e) {
      return {
        success: false,
        tags: [],
        notes: "",
        hotkeyAliases: {},
        error: e.message
      };
    }
  });
  electron.ipcMain.handle("mod:set-meta", async (_, {
    modPath,
    tags,
    notes,
    hotkeyAliases
  }) => {
    try {
      if (!modPath) return {
        success: false,
        error: i18n.t("backend.developer.metadata.modPathRequired")
      };
      const tagsFile = path.join(modPath, "tags.json");
      let existing = {};
      if (fs.existsSync(tagsFile)) {
        try {
          existing = JSON.parse(fs.readFileSync(tagsFile, "utf-8")) || {};
        } catch (_2) {
          existing = {};
        }
      }
      const next = {
        ...existing
      };
      if (Array.isArray(tags)) {
        next.tags = tags.map(t => typeof t === "string" ? t : t && t.name ? String(t.name) : "").filter(Boolean);
      }
      if (typeof notes === "string") next.notes = notes;
      if (hotkeyAliases && typeof hotkeyAliases === "object" && !Array.isArray(hotkeyAliases)) {
        const prior = existing.hotkeyAliases && typeof existing.hotkeyAliases === "object" && !Array.isArray(existing.hotkeyAliases) ? {
          ...existing.hotkeyAliases
        } : {};
        for (const [section, alias] of Object.entries(hotkeyAliases)) {
          if (typeof alias !== "string" || !alias.trim()) {
            delete prior[section];
          } else {
            prior[section] = alias.trim().slice(0, 80);
          }
        }
        next.hotkeyAliases = prior;
      }
      fs.writeFileSync(tagsFile, JSON.stringify(next, null, 2), "utf-8");
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
