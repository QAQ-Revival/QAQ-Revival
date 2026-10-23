"use strict";

const i18n = require("../../shared/i18n/core.cjs");
module.exports = {
  initialize,
  isSafeAppearancePathSegment,
  assertSafeAppearancePathSegment,
  getPersistedCharacterSkinCatalogIdentity,
  setPersistedCharacterSkinCatalogIdentity,
  deletePersistedCharacterSkinCatalogIdentity,
  normalizeAppearanceSectionId,
  isCustomAppearanceSectionId,
  readBundledCharacterSkinCatalog,
  getCharacterSkinCatalogEntry,
  getOfficialAppearanceSections,
  getCharacterOfficialSkinCount,
  getCharacterSectionGameStore,
  getCustomAppearanceSections,
  setCustomAppearanceSections,
  getAppearanceSectionImagesDir,
  getAppearanceSectionCoverUrl,
  saveAppearanceSectionCoverImage,
  getMergedAppearanceSectionDefinitions,
  getAppearanceSectionDefinition,
  getAppearanceSectionIdForSkinId,
  resolveKnownAppearanceSectionId,
  buildAppearanceSectionsWithStats,
  get characterSkinCatalogService() {
    return characterSkinCatalogService;
  }
};
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const {
  createCharacterSkinCatalogService
} = require("./skin-catalog-source.cjs");
const crypto = require("crypto");
const charactersCatalog = require("./catalog.cjs");
const charactersDirectories = require("./directories.cjs");
const charactersImages = require("./images.cjs");
const configStore = require("../config/store.cjs");
const coreLogger = require("../core/logger.cjs");
const gamesSettings = require("../games/settings.cjs");
const systemPaths = require("../system/paths.cjs");
const BASE_APPEARANCE_SECTION_ID = "base";
const CHARACTER_SKIN_CATALOG_CACHE = new Map();
let characterSkinCatalogService;
function isSafeAppearancePathSegment(value) {
  const normalized = String(value || "").trim();
  const windowsStem = normalized.split(".")[0].toUpperCase();
  return !!normalized && normalized !== "." && normalized !== ".." && !normalized.includes("\0") && !/[<>:"/\\|?*\x00-\x1F]/.test(normalized) && !/[. ]$/.test(normalized) && !/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/.test(windowsStem);
}
function assertSafeAppearancePathSegment(value, label) {
  const normalized = String(value || "").trim();
  if (!isSafeAppearancePathSegment(normalized)) {
    throw new Error(i18n.t("backend.characters.skins.unsupportedPathCharacters", {
      label: label || i18n.t("backend.characters.skins.nameLabel")
    }));
  }
  return normalized;
}
function getCharacterSkinCatalogIdentityGameStore(gameId2 = gamesSettings.getActiveGameScopeId(), {
  ensure = false
} = {}) {
  if (!configStore.currentConfig.characterSkinCatalogIdentityByGame || typeof configStore.currentConfig.characterSkinCatalogIdentityByGame !== "object" || Array.isArray(configStore.currentConfig.characterSkinCatalogIdentityByGame)) {
    if (!ensure) return {};
    configStore.currentConfig.characterSkinCatalogIdentityByGame = {};
  }
  const stores = configStore.currentConfig.characterSkinCatalogIdentityByGame;
  if (!stores[gameId2] || typeof stores[gameId2] !== "object" || Array.isArray(stores[gameId2])) {
    if (!ensure) return {};
    stores[gameId2] = {};
  }
  return stores[gameId2];
}
function getPersistedCharacterSkinCatalogIdentity(characterName, gameId2 = gamesSettings.getActiveGameScopeId()) {
  const store = getCharacterSkinCatalogIdentityGameStore(gameId2);
  const normalizedName = charactersCatalog.normalizeCharacterFolderKey(characterName);
  if (!normalizedName) return "";
  const matchedKey = Object.keys(store).find(key => charactersCatalog.normalizeCharacterFolderKey(key) === normalizedName);
  return matchedKey ? String(store[matchedKey] || "").trim() : "";
}
function setPersistedCharacterSkinCatalogIdentity(characterName, identity, gameId2 = gamesSettings.getActiveGameScopeId()) {
  const safeCharacterName = assertSafeAppearancePathSegment(characterName, i18n.t("backend.characters.skins.characterNameLabel"));
  const store = getCharacterSkinCatalogIdentityGameStore(gameId2, {
    ensure: true
  });
  const normalizedName = charactersCatalog.normalizeCharacterFolderKey(safeCharacterName);
  for (const key of Object.keys(store)) {
    if (charactersCatalog.normalizeCharacterFolderKey(key) === normalizedName && key !== safeCharacterName) {
      delete store[key];
    }
  }
  const normalizedIdentity = String(identity || "").trim();
  if (normalizedIdentity) store[safeCharacterName] = normalizedIdentity;else delete store[safeCharacterName];
}
function deletePersistedCharacterSkinCatalogIdentity(characterName, gameId2 = gamesSettings.getActiveGameScopeId()) {
  const store = getCharacterSkinCatalogIdentityGameStore(gameId2);
  const normalizedName = charactersCatalog.normalizeCharacterFolderKey(characterName);
  for (const key of Object.keys(store)) {
    if (charactersCatalog.normalizeCharacterFolderKey(key) === normalizedName) delete store[key];
  }
}
function normalizeAppearanceSectionId(value) {
  return String(value || "").trim().slice(0, 180);
}
function isCustomAppearanceSectionId(sectionId) {
  return normalizeAppearanceSectionId(sectionId).startsWith("custom:");
}
function toLocalFileUrl(filePath) {
  if (!filePath) return null;
  return encodeURI(`file:///${String(filePath).replace(/\\/g, "/")}`);
}
function resolveCharacterSkinImage(catalogPath, imageValue, fallbackImageUrl) {
  const value = String(imageValue || "").trim();
  if (!value) return {
    imagePath: null,
    coverUrl: null
  };
  const cachedCoverUrl = charactersCatalog.characterImageCache.coverUrl(value, [fallbackImageUrl]);
  if (cachedCoverUrl) return {
    imagePath: null,
    coverUrl: cachedCoverUrl
  };
  if (/^(data:|https?:\/\/|file:\/\/)/i.test(value)) {
    return {
      imagePath: null,
      coverUrl: value
    };
  }
  const imagePath = path.isAbsolute(value) ? value : path.resolve(path.dirname(catalogPath), value);
  return {
    imagePath,
    coverUrl: fs.existsSync(imagePath) ? toLocalFileUrl(imagePath) : null
  };
}
function normalizeCharacterSkinCatalog(parsed, catalogPath, gameId2) {
  const characters = Array.isArray(parsed?.characters) ? parsed.characters : [];
  return {
    schemaVersion: Number(parsed?.schemaVersion || 1),
    gameId: parsed?.gameId || gameId2,
    catalogPath,
    characters: characters.map(character => {
      const nameZh = String(character?.nameZh || character?.characterName || character?.zh || character?.name || "").trim();
      const nameEn = String(character?.nameEn || character?.characterNameEn || character?.en || "").trim();
      const characterId = String(character?.characterId || "").trim();
      const aliases = Array.isArray(character?.aliases) ? character.aliases.map(alias => String(alias || "").trim()).filter(Boolean) : [];
      const skins = (Array.isArray(character?.skins) ? character.skins : []).map(skin => {
        const skinId = String(skin?.id || skin?.skinId || "").trim();
        const sectionId = normalizeAppearanceSectionId(skin?.sectionId || (skinId ? `skin:${skinId}` : ""));
        if (!skinId || !sectionId) return null;
        const skinAliases = Array.isArray(skin?.aliases) ? skin.aliases.map(alias => String(alias || "").trim()).filter(Boolean) : [];
        const image = resolveCharacterSkinImage(catalogPath, skin?.sourceImageUrl || skin?.image, skin?.fallbackImageUrl);
        return {
          id: skinId,
          skinId,
          sectionId,
          kind: "official-skin",
          official: true,
          name: String(skin?.nameZh || skin?.nameEn || skinId).trim(),
          nameZh: String(skin?.nameZh || "").trim(),
          nameEn: String(skin?.nameEn || "").trim(),
          aliases: skinAliases,
          image: skin?.image || "",
          imagePath: image.imagePath,
          coverUrl: image.coverUrl,
          sourcePageUrl: skin?.sourcePageUrl || null,
          sourceImageUrl: skin?.sourceImageUrl || skin?.imageSourceUrl || null,
          type: Array.isArray(skin?.type) ? skin.type : skin?.type ? [skin.type] : [],
          genderVariant: skin?.genderVariant || null
        };
      }).filter(Boolean);
      if (!nameZh && !nameEn && !characterId) return null;
      return {
        characterId,
        nameZh,
        nameEn,
        aliases,
        skins
      };
    }).filter(Boolean)
  };
}
function readBundledCharacterSkinCatalog(gameId2 = gamesSettings.getActiveGameScopeId()) {
  const resourceDir = charactersCatalog.getGameCharacterResourceDir(gameId2);
  const emptyCatalog = {
    schemaVersion: 1,
    gameId: gameId2,
    catalogPath: null,
    characters: []
  };
  if (!resourceDir) return emptyCatalog;
  const candidates = [...charactersCatalog.getBundledResourceCandidates("games", resourceDir, "character-skins", "catalog.json"), ...charactersCatalog.getBundledResourceCandidates(resourceDir, "character-skins", "catalog.json")];
  for (const candidate of candidates) {
    try {
      if (!candidate || !fs.existsSync(candidate)) continue;
      const parsed = JSON.parse(fs.readFileSync(candidate, "utf-8"));
      return {
        ...parsed,
        catalogPath: candidate
      };
    } catch (error) {
      coreLogger.logger.warn(`Failed to load character skin catalog from ${candidate}:`, error?.message || error);
    }
  }
  return emptyCatalog;
}
function getCharacterSkinCatalog(gameId2 = gamesSettings.getActiveGameScopeId()) {
  const cacheKey = String(gameId2 || "default");
  if (!CHARACTER_SKIN_CATALOG_CACHE.has(cacheKey)) {
    const bundled = readBundledCharacterSkinCatalog(gameId2);
    const merged = characterSkinCatalogService.merge(gameId2, bundled);
    CHARACTER_SKIN_CATALOG_CACHE.set(cacheKey, normalizeCharacterSkinCatalog(merged, bundled.catalogPath, gameId2));
  }
  return CHARACTER_SKIN_CATALOG_CACHE.get(cacheKey);
}
function getCharacterSkinCatalogEntry(characterName, gameId2 = gamesSettings.getActiveGameScopeId()) {
  const aliases = [...charactersCatalog.getCharacterAliasCandidates(characterName, gameId2), getPersistedCharacterSkinCatalogIdentity(characterName, gameId2)].filter(Boolean);
  const aliasKeys = new Set(aliases.map(alias => charactersCatalog.normalizeCharacterFolderKey(alias)).filter(Boolean));
  const catalog = getCharacterSkinCatalog(gameId2);
  return catalog.characters.find(character => {
    const candidates = [character.nameZh, character.nameEn, character.characterId, ...(Array.isArray(character.aliases) ? character.aliases : [])];
    return candidates.some(candidate => aliasKeys.has(charactersCatalog.normalizeCharacterFolderKey(candidate)));
  }) || null;
}
function getOfficialAppearanceSections(characterName, gameId2 = gamesSettings.getActiveGameScopeId()) {
  const catalogEntry = getCharacterSkinCatalogEntry(characterName, gameId2);
  return (catalogEntry?.skins || []).map(skin => ({
    ...skin
  }));
}
function getCharacterOfficialSkinCount(characterName, gameId2 = gamesSettings.getActiveGameScopeId()) {
  return getOfficialAppearanceSections(characterName, gameId2).length;
}
function ensureCharacterSectionsByGameStore() {
  if (!configStore.currentConfig.characterSectionsByGame || typeof configStore.currentConfig.characterSectionsByGame !== "object" || Array.isArray(configStore.currentConfig.characterSectionsByGame)) {
    configStore.currentConfig.characterSectionsByGame = {};
  }
  return configStore.currentConfig.characterSectionsByGame;
}
function getCharacterSectionGameStore(gameId2 = gamesSettings.getActiveGameScopeId(), {
  ensure = false
} = {}) {
  const allStores = ensure ? ensureCharacterSectionsByGameStore() : configStore.currentConfig.characterSectionsByGame;
  if (!allStores || typeof allStores !== "object" || Array.isArray(allStores)) return {};
  if (!allStores[gameId2] || typeof allStores[gameId2] !== "object" || Array.isArray(allStores[gameId2])) {
    if (!ensure) return {};
    allStores[gameId2] = {};
  }
  return allStores[gameId2];
}
function normalizeCustomAppearanceSections(value) {
  const sections = Array.isArray(value) ? value : [];
  const seen = new Set();
  return sections.map(section => {
    const id = normalizeAppearanceSectionId(section?.id || section?.sectionId);
    const name = String(section?.name || section?.nameZh || "").trim().slice(0, 60);
    if (!id || !isCustomAppearanceSectionId(id) || !name || seen.has(id)) return null;
    seen.add(id);
    return {
      id,
      sectionId: id,
      kind: "custom",
      official: false,
      name,
      nameZh: name,
      nameEn: String(section?.nameEn || "").trim().slice(0, 80),
      createdAt: section?.createdAt || null,
      updatedAt: section?.updatedAt || null
    };
  }).filter(Boolean);
}
function getCustomAppearanceSections(characterName, gameId2 = gamesSettings.getActiveGameScopeId()) {
  const store = getCharacterSectionGameStore(gameId2);
  const {
    value
  } = charactersDirectories.getCharacterConfigStoreValue(store, characterName, [], gameId2);
  return normalizeCustomAppearanceSections(value);
}
function setCustomAppearanceSections(characterName, sections, gameId2 = gamesSettings.getActiveGameScopeId()) {
  const store = getCharacterSectionGameStore(gameId2, {
    ensure: true
  });
  const canonicalCharacterName = charactersDirectories.getCanonicalCharacterConfigKey(characterName, gameId2);
  const normalized = normalizeCustomAppearanceSections(sections);
  if (normalized.length > 0) store[canonicalCharacterName] = normalized;else delete store[canonicalCharacterName];
  configStore.saveConfig(configStore.currentConfig);
  return normalized;
}
function getAppearanceSectionImagesDir(characterName, sectionId, gameId2 = gamesSettings.getActiveGameScopeId()) {
  const safeCharacterName = assertSafeAppearancePathSegment(characterName, i18n.t("backend.characters.skins.characterNameLabel"));
  const sectionKey = crypto.createHash("sha256").update(normalizeAppearanceSectionId(sectionId), "utf8").digest("hex").slice(0, 24);
  const characterImagesDir = charactersImages.getScopedCharacterImagesDir(safeCharacterName, gameId2);
  const sectionImagesDir = path.join(characterImagesDir, "sections", sectionKey);
  if (!systemPaths.isPathInsideDirectory(sectionImagesDir, characterImagesDir)) {
    throw new Error(i18n.t("backend.characters.skins.invalidCoverPath"));
  }
  return sectionImagesDir;
}
function getAppearanceSectionCoverUrl(characterName, sectionId, gameId2 = gamesSettings.getActiveGameScopeId()) {
  const coverPath = charactersImages.findImageFileInDir(getAppearanceSectionImagesDir(characterName, sectionId, gameId2), {
    requireCoverPrefix: true
  });
  return coverPath ? toLocalFileUrl(coverPath) : null;
}
function saveAppearanceSectionCoverImage(characterName, sectionId, imagePath, gameId2 = gamesSettings.getActiveGameScopeId()) {
  const targetDir = getAppearanceSectionImagesDir(characterName, sectionId, gameId2);
  fs.mkdirSync(targetDir, {
    recursive: true
  });
  const operationId = crypto.randomUUID();
  let ext = "";
  let sourcePath = null;
  let imageBuffer = null;
  if (String(imagePath || "").startsWith("data:")) {
    const matches = String(imagePath).match(/^data:([A-Za-z0-9.+/-]+);base64,(.+)$/);
    if (!matches) throw new Error(i18n.t("backend.characters.skins.invalidCoverDataURL"));
    const mimeType = matches[1].toLowerCase();
    ext = mimeType === "image/jpeg" ? ".jpg" : mimeType === "image/gif" ? ".gif" : mimeType === "image/webp" ? ".webp" : mimeType === "image/bmp" ? ".bmp" : mimeType === "image/png" ? ".png" : "";
    if (!ext) throw new Error(i18n.t("backend.characters.skins.unsupportedCoverImageFormat"));
    imageBuffer = Buffer.from(matches[2], "base64");
    if (imageBuffer.length === 0) throw new Error(i18n.t("backend.characters.skins.coverImageIsEmpty"));
  } else {
    sourcePath = String(imagePath || "").trim();
    if (!sourcePath || !fs.existsSync(sourcePath)) throw new Error(i18n.t("backend.characters.skins.coverImageNotFound"));
    ext = path.extname(sourcePath).toLowerCase();
    if (![".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"].includes(ext)) {
      throw new Error(i18n.t("backend.characters.skins.unsupportedCoverImageFormat"));
    }
  }
  const targetPath = path.join(targetDir, `_cover${ext}`);
  const tempPath = path.join(targetDir, `._cover-${operationId}${ext}`);
  if (imageBuffer) fs.writeFileSync(tempPath, imageBuffer);else fs.copyFileSync(sourcePath, tempPath);
  if (!fs.existsSync(tempPath) || fs.statSync(tempPath).size <= 0) {
    fs.rmSync(tempPath, {
      force: true
    });
    throw new Error(i18n.t("backend.characters.skins.coverImageCouldNotBePrepared"));
  }
  const previousCovers = fs.readdirSync(targetDir).filter(fileName => /^_cover\.(png|jpg|jpeg|webp|gif|bmp)$/i.test(fileName)).map(fileName => ({
    originalPath: path.join(targetDir, fileName),
    backupPath: path.join(targetDir, `.${fileName}.backup-${operationId}`)
  }));
  const movedBackups = [];
  try {
    for (const cover of previousCovers) {
      fs.renameSync(cover.originalPath, cover.backupPath);
      movedBackups.push(cover);
    }
    fs.renameSync(tempPath, targetPath);
  } catch (error) {
    try {
      fs.rmSync(tempPath, {
        force: true
      });
      fs.rmSync(targetPath, {
        force: true
      });
    } catch (_) {}
    for (const cover of movedBackups.reverse()) {
      try {
        if (fs.existsSync(cover.backupPath)) {
          fs.renameSync(cover.backupPath, cover.originalPath);
        }
      } catch (_) {}
    }
    throw error;
  }
  for (const cover of movedBackups) {
    try {
      fs.rmSync(cover.backupPath, {
        force: true
      });
    } catch (_) {}
  }
  return {
    targetPath,
    coverUrl: toLocalFileUrl(targetPath)
  };
}
function getMergedAppearanceSectionDefinitions(characterName, gameId2 = gamesSettings.getActiveGameScopeId()) {
  const baseSection = {
    id: BASE_APPEARANCE_SECTION_ID,
    sectionId: BASE_APPEARANCE_SECTION_ID,
    kind: "base",
    official: true,
    name: "原角色",
    nameZh: "原角色",
    nameEn: "Original",
    aliases: [],
    coverUrl: charactersImages.getCharacterCoverUrl(characterName, gameId2)
  };
  const officialSections = getOfficialAppearanceSections(characterName, gameId2);
  const customSections = getCustomAppearanceSections(characterName, gameId2).map(section => ({
    ...section,
    coverUrl: getAppearanceSectionCoverUrl(characterName, section.sectionId, gameId2)
  }));
  return [baseSection, ...officialSections, ...customSections];
}
function getAppearanceSectionDefinition(characterName, sectionId, gameId2 = gamesSettings.getActiveGameScopeId()) {
  const normalized = normalizeAppearanceSectionId(sectionId) || BASE_APPEARANCE_SECTION_ID;
  return getMergedAppearanceSectionDefinitions(characterName, gameId2).find(section => section.sectionId === normalized) || null;
}
function getAppearanceSectionIdForSkinId(characterName, skinId, gameId2 = gamesSettings.getActiveGameScopeId()) {
  const normalizedSkinId = String(skinId || "").trim();
  if (!normalizedSkinId) return null;
  const section = getOfficialAppearanceSections(characterName, gameId2).find(item => item.skinId === normalizedSkinId || item.id === normalizedSkinId || item.sectionId === normalizedSkinId || item.sectionId === `skin:${normalizedSkinId}`);
  return section?.sectionId || null;
}
function resolveKnownAppearanceSectionId(characterName, sectionId, gameId2 = gamesSettings.getActiveGameScopeId()) {
  const normalized = normalizeAppearanceSectionId(sectionId);
  if (!normalized || normalized === BASE_APPEARANCE_SECTION_ID) return BASE_APPEARANCE_SECTION_ID;
  return getAppearanceSectionDefinition(characterName, normalized, gameId2) ? normalized : BASE_APPEARANCE_SECTION_ID;
}
function buildAppearanceSectionsWithStats(characterName, mods, gameId2 = gamesSettings.getActiveGameScopeId()) {
  const definitions = getMergedAppearanceSectionDefinitions(characterName, gameId2);
  const stats = new Map(definitions.map(section => [section.sectionId, {
    modCount: 0,
    enabledCount: 0
  }]));
  for (const mod of Array.isArray(mods) ? mods : []) {
    const sectionId = stats.has(mod?.appearanceSectionId) ? mod.appearanceSectionId : BASE_APPEARANCE_SECTION_ID;
    const current = stats.get(sectionId) || {
      modCount: 0,
      enabledCount: 0
    };
    current.modCount += 1;
    if (mod?.enabled) current.enabledCount += 1;
    stats.set(sectionId, current);
  }
  return definitions.map(section => ({
    ...section,
    ...(stats.get(section.sectionId) || {
      modCount: 0,
      enabledCount: 0
    })
  }));
}
function initialize() {
  characterSkinCatalogService = createCharacterSkinCatalogService({
    cacheDir: path.join(electron.app.getPath("userData"), "character-skin-catalogs"),
    fetchFn: (...args) => electron.net.fetch(...args),
    onUpdate: gameId => CHARACTER_SKIN_CATALOG_CACHE.delete(gameId)
  });
}
Object.assign(module.exports, {
  BASE_APPEARANCE_SECTION_ID
});
