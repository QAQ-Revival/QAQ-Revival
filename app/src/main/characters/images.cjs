"use strict";

const i18n = require("../../shared/i18n/core.cjs");
module.exports = {
  initialize,
  getScopedCharacterImagesDir,
  findImageFileInDir,
  findModPreviewImageFile,
  getImageMimeTypeFromExt,
  readImageAsDataUrl,
  findCharacterCoverFilePath,
  getCharacterCoverUrl
};
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const charactersCatalog = require("./catalog.cjs");
const charactersDirectories = require("./directories.cjs");
const charactersSkins = require("./skins.cjs");
const gamesNevernessLoader = require("../games/neverness/loader.cjs");
const gamesSettings = require("../games/settings.cjs");
const modsNevernessPaks = require("../games/neverness/paks.cjs");
const IMAGES_PATH = path.join(electron.app.getPath("userData"), "images");
function getScopedCharacterImagesDir(characterName, gameId2 = gamesSettings.getActiveGameScopeId()) {
  const safeGameId = charactersSkins.assertSafeAppearancePathSegment(gameId2 || "default", i18n.t("backend.validation.gameId"));
  const safeCharacterName = charactersSkins.assertSafeAppearancePathSegment(characterName, i18n.t("backend.validation.characterName"));
  return path.join(IMAGES_PATH, safeGameId, safeCharacterName);
}
function findImageFileInDir(dirPath, {
  requireCoverPrefix = false
} = {}) {
  if (!dirPath || !fs.existsSync(dirPath)) return null;
  const files = fs.readdirSync(dirPath);
  const targetFile = files.find(fileName => {
    if (!/\.(png|jpg|jpeg|webp|gif|bmp)$/i.test(fileName)) return false;
    if (requireCoverPrefix && !fileName.startsWith("_cover")) return false;
    return true;
  });
  return targetFile ? path.join(dirPath, targetFile) : null;
}
function findModPreviewImageFile(dirPath) {
  if (!dirPath || !fs.existsSync(dirPath)) return null;
  const files = fs.readdirSync(dirPath);
  let imageFile = files.find(fileName => fileName.startsWith("preview.") && /\.(png|jpg|jpeg|webp|gif|bmp)$/i.test(fileName));
  if (!imageFile) {
    imageFile = files.find(fileName => /\.(png|jpg|jpeg|webp|gif|bmp)$/i.test(fileName));
  }
  return imageFile ? path.join(dirPath, imageFile) : null;
}
function getImageMimeTypeFromExt(ext) {
  return {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".tiff": "image/tiff",
    ".tif": "image/tiff"
  }[String(ext || "").toLowerCase()] || "image/jpeg";
}
function readImageAsDataUrl(imagePath) {
  if (!imagePath || !fs.existsSync(imagePath)) return null;
  const ext = path.extname(imagePath).toLowerCase();
  const imageBuffer = fs.readFileSync(imagePath);
  return `data:${getImageMimeTypeFromExt(ext)};base64,${imageBuffer.toString("base64")}`;
}
function findImageFileInChildDirs(dirPath) {
  if (!dirPath || !fs.existsSync(dirPath)) return null;
  const childDirs = fs.readdirSync(dirPath, {
    withFileTypes: true
  }).filter(entry => entry.isDirectory());
  for (const childDir of childDirs) {
    const imagePath = findImageFileInDir(path.join(dirPath, childDir.name));
    if (imagePath) return imagePath;
  }
  return null;
}
function findCharacterCoverFilePath(characterName, gameId2 = gamesSettings.getActiveGameScopeId(), modsPath = gamesSettings.getModsPath(gameId2), knownEntry = null) {
  const resolvedEntry = knownEntry || charactersDirectories.resolveCharacterEntry(characterName, gameId2);
  const aliases = charactersCatalog.getCharacterAliasCandidates(characterName, gameId2, resolvedEntry);
  const pathAliases = aliases.filter(charactersSkins.isSafeAppearancePathSegment);
  for (const alias of pathAliases) {
    const scopedCoverPath = findImageFileInDir(getScopedCharacterImagesDir(alias, gameId2), {
      requireCoverPrefix: true
    });
    if (scopedCoverPath) return scopedCoverPath;
  }
  for (const alias of pathAliases) {
    const legacyCoverPath = findImageFileInDir(path.join(IMAGES_PATH, alias), {
      requireCoverPrefix: true
    });
    if (legacyCoverPath) return legacyCoverPath;
  }
  if (modsPath) {
    if (gamesNevernessLoader.isNevernessDx12Mode(gameId2)) {
      for (const alias of pathAliases) {
        const paths = gamesNevernessLoader.getNevernessDx12Paths(gameId2);
        const dx12CharacterPaths = [path.join(modsPath, alias), modsNevernessPaks.getNevernessDx12DisabledCharacterPath(alias, paths, {
          gameId: gameId2
        })].filter(Boolean);
        for (const dx12CharacterPath of dx12CharacterPaths) {
          const dx12RootCoverPath = findImageFileInDir(dx12CharacterPath);
          if (dx12RootCoverPath) return dx12RootCoverPath;
          const dx12ModCoverPath = findImageFileInChildDirs(dx12CharacterPath);
          if (dx12ModCoverPath) return dx12ModCoverPath;
        }
      }
    }
    for (const alias of pathAliases) {
      const modCoverPath = findImageFileInDir(path.join(modsPath, alias), {
        requireCoverPrefix: true
      });
      if (modCoverPath) return modCoverPath;
    }
  }
  return null;
}
function getCharacterCoverUrl(characterName, gameId2 = gamesSettings.getActiveGameScopeId(), knownEntry = null) {
  try {
    const resolvedEntry = knownEntry || charactersDirectories.resolveCharacterEntry(characterName, gameId2);
    const canonicalCharacterName = resolvedEntry?.displayName || charactersDirectories.getCanonicalCharacterConfigKey(characterName, gameId2);
    const coverFilePath = findCharacterCoverFilePath(canonicalCharacterName, gameId2, gamesSettings.getModsPath(gameId2), resolvedEntry);
    if (coverFilePath && fs.existsSync(coverFilePath)) {
      const ext = path.extname(coverFilePath).toLowerCase();
      const mime = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp"
      }[ext] || "image/jpeg";
      return `data:${mime};base64,${fs.readFileSync(coverFilePath).toString("base64")}`;
    }
    return charactersCatalog.characterImageCache.coverUrl(charactersCatalog.getCharacterConfigForGame(gameId2).characterImages?.[canonicalCharacterName]);
  } catch (e) {}
  return null;
}
function initialize() {
  if (!fs.existsSync(IMAGES_PATH)) {
    fs.mkdirSync(IMAGES_PATH, {
      recursive: true
    });
  }
}
Object.assign(module.exports, {
  IMAGES_PATH
});
