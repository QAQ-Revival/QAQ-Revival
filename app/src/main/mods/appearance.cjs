"use strict";

const i18n = require("../../shared/i18n/core.cjs");
module.exports = {
  getStoredModAppearanceSectionId,
  extractRequestedAppearanceTarget,
  resolveModAppearanceSectionId,
  writeModAppearanceSectionMetadata,
  assignInstalledModAppearance,
  resolveExistingModDirectoryAnyMode,
  resolveAppearanceCharacterContext,
  listModDirectoryRecordsForCharacter
};
const path = require("path");
const fs = require("fs");
const charactersCleanup = require("../characters/cleanup.cjs");
const charactersDirectories = require("../characters/directories.cjs");
const charactersSkins = require("../characters/skins.cjs");
const gamesNevernessLoader = require("../games/neverness/loader.cjs");
const gamesSettings = require("../games/settings.cjs");
const modsMetadata = require("./metadata.cjs");
const modsNevernessPaks = require("../games/neverness/paks.cjs");
const systemPaths = require("../system/paths.cjs");
function getStoredModAppearanceSectionId(meta) {
  return charactersSkins.normalizeAppearanceSectionId(meta?.qaqm?.appearanceSectionId || meta?.appearanceSectionId || "");
}
function extractRequestedAppearanceTarget(payload = {}) {
  const sectionId = charactersSkins.normalizeAppearanceSectionId(payload?.appearanceSectionId || payload?.sectionId || payload?.targetSectionId || payload?.qaqm?.appearanceSectionId || "");
  const skinId = String(payload?.characterSkinId || payload?.skinId || payload?.outfitId || payload?.characterSkin?.id || "").trim();
  return {
    sectionId,
    skinId
  };
}
function normalizeAppearanceMatchText(value) {
  return String(value || "").normalize("NFKC").trim().toLowerCase().replace(/[\s_\-－–—·•.'"`()\[\]{}【】（）<>《》:：|\\/]+/g, "");
}
function isUsefulAppearanceAlias(value) {
  const compact = normalizeAppearanceMatchText(value);
  if (!compact) return false;
  if (charactersCleanup.containsChineseCharacter(value)) return compact.length >= 2;
  return compact.length >= 4;
}
function inferOfficialAppearanceSectionId(characterName, candidateValues, gameId2 = gamesSettings.getActiveGameScopeId(), definitions = null) {
  const haystacks = (Array.isArray(candidateValues) ? candidateValues : [candidateValues]).map(normalizeAppearanceMatchText).filter(Boolean);
  if (haystacks.length === 0) return charactersSkins.BASE_APPEARANCE_SECTION_ID;
  const matchedSectionIds = new Set();
  for (const section of definitions || charactersSkins.getOfficialAppearanceSections(characterName, gameId2)) {
    if (section.kind !== "official-skin") continue;
    const aliases = [section.nameZh, section.nameEn, ...(section.aliases || [])].filter(isUsefulAppearanceAlias).map(normalizeAppearanceMatchText).filter(Boolean);
    if (aliases.some(alias => haystacks.some(candidate => candidate === alias || candidate.includes(alias)))) {
      matchedSectionIds.add(section.sectionId);
    }
  }
  return matchedSectionIds.size === 1 ? Array.from(matchedSectionIds)[0] : charactersSkins.BASE_APPEARANCE_SECTION_ID;
}
function resolveRequestedAppearanceSectionId(characterName, payload = {}, gameId2 = gamesSettings.getActiveGameScopeId()) {
  const target = extractRequestedAppearanceTarget(payload);
  if (target.sectionId) {
    const direct = charactersSkins.getAppearanceSectionDefinition(characterName, target.sectionId, gameId2);
    if (direct) return direct.sectionId;
    const sectionSkinId = target.sectionId.startsWith("skin:") ? target.sectionId.slice("skin:".length) : target.sectionId;
    const mapped = charactersSkins.getAppearanceSectionIdForSkinId(characterName, sectionSkinId, gameId2);
    return mapped || charactersSkins.BASE_APPEARANCE_SECTION_ID;
  }
  if (target.skinId) {
    return charactersSkins.getAppearanceSectionIdForSkinId(characterName, target.skinId, gameId2) || charactersSkins.BASE_APPEARANCE_SECTION_ID;
  }
  return null;
}
function resolveModAppearanceSectionId({
  characterName,
  modName,
  modDir,
  meta = null,
  requested = null,
  gameId: gameId2 = gamesSettings.getActiveGameScopeId(),
  ignoreStored = false,
  definitions = null,
  resourceScope = null
}) {
  const explicitSectionId = requested ? resolveRequestedAppearanceSectionId(characterName, requested, gameId2) : null;
  if (explicitSectionId) return explicitSectionId;
  const resolvedMeta = meta || modsMetadata.readModMetadataFromDir(modDir);
  if (!ignoreStored) {
    const storedSectionId = getStoredModAppearanceSectionId(resolvedMeta);
    const classificationSource = String(resolvedMeta?.qaqm?.classificationSource || resolvedMeta?.classificationSource || "").trim();
    if (storedSectionId) {
      const storedDefinition = definitions ? definitions.find(section => section.sectionId === storedSectionId) : charactersSkins.getAppearanceSectionDefinition(characterName, storedSectionId, gameId2);
      const shouldReinferFallback = (storedSectionId === charactersSkins.BASE_APPEARANCE_SECTION_ID && classificationSource === "base-fallback") || (gameId2 === "arknights" && ["auto", "arknights-resources"].includes(classificationSource));
      if (storedDefinition && !shouldReinferFallback) return storedDefinition.sectionId;
    }
    const storedSkinId = String(resolvedMeta?.qaqm?.characterSkinId || resolvedMeta?.characterSkinId || "").trim();
    if (storedSkinId && !(gameId2 === "arknights" && ["auto", "arknights-resources"].includes(classificationSource))) {
      const storedSkinSectionId = definitions ? definitions.find(section => section.kind === "official-skin" && (section.skinId === storedSkinId || section.id === storedSkinId || section.sectionId === storedSkinId || section.sectionId === `skin:${storedSkinId}`))?.sectionId : charactersSkins.getAppearanceSectionIdForSkinId(characterName, storedSkinId, gameId2);
      if (storedSkinSectionId) return storedSkinSectionId;
    }
  }
  const tags = Array.isArray(resolvedMeta?.tags) ? resolvedMeta.tags.map(tag => typeof tag === "string" ? tag : tag?.name || "").filter(Boolean) : [];
  if (gameId2 === "arknights" && modDir) {
    return (resourceScope || require("../games/arknights/appearance.cjs").inspectAppearance(modDir, charactersSkins.getOfficialAppearanceSections(characterName, gameId2))).sectionId;
  }
  return inferOfficialAppearanceSectionId(characterName, [modName, ...tags], gameId2, definitions);
}
function writeModAppearanceSectionMetadata(modDir, characterName, sectionId, {
  gameId: gameId2 = gamesSettings.getActiveGameScopeId(),
  source = "user"
} = {}) {
  if (!modDir || !fs.existsSync(modDir)) throw new Error(i18n.t("backend.ipc.mods.modFolderNotFound"));
  const resolvedSectionId = charactersSkins.resolveKnownAppearanceSectionId(characterName, sectionId, gameId2);
  const definition = charactersSkins.getAppearanceSectionDefinition(characterName, resolvedSectionId, gameId2);
  const tagsFile = path.join(modDir, "tags.json");
  const existing = modsMetadata.readModMetadataFromDir(modDir);
  const qaqm = existing.qaqm && typeof existing.qaqm === "object" && !Array.isArray(existing.qaqm) ? {
    ...existing.qaqm
  } : {};
  qaqm.appearanceSectionId = resolvedSectionId;
  qaqm.classificationSource = String(source || "user").slice(0, 40);
  qaqm.appearanceAssignedAt = new Date().toISOString();
  if (gameId2 === "arknights") qaqm.arknightsScope = require("../games/arknights/appearance.cjs").inspectAppearance(modDir, charactersSkins.getOfficialAppearanceSections(characterName, gameId2));
  if (definition?.kind === "official-skin" && definition.skinId) {
    qaqm.characterSkinId = definition.skinId;
  } else {
    delete qaqm.characterSkinId;
  }
  fs.writeFileSync(tagsFile, JSON.stringify({
    ...existing,
    qaqm
  }, null, 2), "utf-8");
  return {
    sectionId: resolvedSectionId,
    skinId: qaqm.characterSkinId || null
  };
}
function assignInstalledModAppearance({
  characterName,
  modName,
  modDir,
  requested = null,
  gameId: gameId2 = gamesSettings.getActiveGameScopeId(),
  source = "auto",
  ignoreStored = false
}) {
  const meta = modsMetadata.readModMetadataFromDir(modDir);
  const requestedTarget = requested ? extractRequestedAppearanceTarget(requested) : null;
  const sectionId = resolveModAppearanceSectionId({
    characterName,
    modName,
    modDir,
    meta,
    requested,
    gameId: gameId2,
    ignoreStored
  });
  return writeModAppearanceSectionMetadata(modDir, characterName, sectionId, {
    gameId: gameId2,
    source: requestedTarget?.sectionId || requestedTarget?.skinId ? source : sectionId === charactersSkins.BASE_APPEARANCE_SECTION_ID ? "base-fallback" : source
  });
}
function resolveExistingModDirectoryAnyMode(characterName, modName, gameId2 = gamesSettings.getActiveGameScopeId()) {
  const safeModName = charactersSkins.assertSafeAppearancePathSegment(modName, i18n.t("backend.validation.modName"));
  if (!gamesNevernessLoader.isNevernessDx12Mode(gameId2)) {
    const resolved = charactersDirectories.resolveExistingStandardModDirectory(characterName, safeModName, gameId2);
    if (!resolved?.modPath || !systemPaths.isPathInsideDirectory(resolved.modPath, resolved.charPath)) return null;
    return resolved;
  }
  const paths = gamesNevernessLoader.getNevernessDx12Paths(gameId2);
  const activeCharPath = modsNevernessPaks.getNevernessDx12CharacterPath(characterName, {
    ensure: true,
    gameId: gameId2
  });
  const disabledCharPath = modsNevernessPaks.getNevernessDx12DisabledCharacterPath(characterName, paths, {
    gameId: gameId2
  });
  const candidates = [activeCharPath ? path.join(activeCharPath, safeModName) : "", activeCharPath ? path.join(activeCharPath, `DISABLED_${safeModName}`) : "", disabledCharPath ? path.join(disabledCharPath, safeModName) : "", disabledCharPath ? path.join(disabledCharPath, `DISABLED_${safeModName}`) : ""].filter(Boolean);
  const allowedRoots = [activeCharPath, disabledCharPath].filter(Boolean);
  const modPath = candidates.find(candidate => allowedRoots.some(root => systemPaths.isPathInsideDirectory(candidate, root)) && fs.existsSync(candidate));
  if (!modPath) return null;
  const folderName = path.basename(modPath);
  return {
    charPath: path.dirname(modPath),
    modPath,
    folderName,
    enabled: !!activeCharPath && systemPaths.isPathInsideDirectory(modPath, activeCharPath) && !folderName.startsWith("DISABLED_")
  };
}
function resolveAppearanceCharacterContext(characterName, gameId2 = gamesSettings.getActiveGameScopeId()) {
  const safeCharacterName = charactersSkins.assertSafeAppearancePathSegment(characterName, i18n.t("backend.validation.characterName"));
  const resolvedEntry = charactersDirectories.resolveCharacterEntry(safeCharacterName, gameId2);
  if (!resolvedEntry?.characterRootPath || !fs.existsSync(resolvedEntry.characterRootPath)) {
    throw new Error(i18n.t("backend.ipc.characters.characterMissing"));
  }
  const resolvedCharacterName = charactersSkins.assertSafeAppearancePathSegment(resolvedEntry.displayName || safeCharacterName, i18n.t("backend.validation.characterName"));
  return {
    characterName: resolvedCharacterName,
    characterPath: resolvedEntry.characterRootPath,
    entry: resolvedEntry
  };
}
function listModDirectoryRecordsForCharacter(characterName, gameId2 = gamesSettings.getActiveGameScopeId()) {
  if (gamesNevernessLoader.isNevernessDx12Mode(gameId2)) {
    const paths = gamesNevernessLoader.getNevernessDx12Paths(gameId2);
    const activeCharPath = modsNevernessPaks.getNevernessDx12CharacterPath(characterName, {
      ensure: true,
      gameId: gameId2
    });
    const disabledCharPath = modsNevernessPaks.getNevernessDx12DisabledCharacterPath(characterName, paths, {
      gameId: gameId2
    });
    return [activeCharPath, disabledCharPath].filter(dirPath => dirPath && fs.existsSync(dirPath)).flatMap(dirPath => fs.readdirSync(dirPath, {
      withFileTypes: true
    }).filter(entry => entry.isDirectory()).map(entry => ({
      modName: entry.name.replace(/^DISABLED_/i, ""),
      modDir: path.join(dirPath, entry.name)
    }))).filter(entry => modsNevernessPaks.isNevernessDx12ModDir(entry.modDir));
  }
  const charPath = charactersDirectories.resolveCharacterPath(characterName, gameId2);
  if (!charPath || !fs.existsSync(charPath)) return [];
  return fs.readdirSync(charPath, {
    withFileTypes: true
  }).filter(entry => entry.isDirectory()).map(entry => ({
    modName: entry.name.replace(/^DISABLED_/i, ""),
    modDir: path.join(charPath, entry.name)
  }));
}
