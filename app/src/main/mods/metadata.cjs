"use strict";

module.exports = {
  getPinnedModsForCharacter,
  setPinnedModsForCharacter,
  applyPinnedStateToMods,
  movePinnedModsToTop,
  readModTagsFromDir,
  writeModTagsToDir,
  readModMetadataFromDir
};
const path = require("path");
const fs = require("fs");
const charactersDirectories = require("../characters/directories.cjs");
const configStore = require("../config/store.cjs");
function normalizePinnedModNames(value, availableNames = null) {
  const list = Array.isArray(value) ? value : [];
  const seen = new Set();
  const availableSet = Array.isArray(availableNames) ? new Set(availableNames) : null;
  const normalized = [];
  for (const item of list) {
    const name = String(item || "").trim();
    if (!name || seen.has(name)) continue;
    if (availableSet && !availableSet.has(name)) continue;
    seen.add(name);
    normalized.push(name);
  }
  return normalized;
}
function getPinnedModsForCharacter(characterName, availableNames = null) {
  if (!configStore.currentConfig.pinnedMods) configStore.currentConfig.pinnedMods = {};
  const {
    key,
    value
  } = charactersDirectories.getCharacterConfigStoreValue(configStore.currentConfig.pinnedMods, characterName, []);
  const normalized = normalizePinnedModNames(value, availableNames);
  const existing = Array.isArray(value) ? value : [];
  if (existing.length !== normalized.length || existing.some((name, index) => name !== normalized[index])) {
    if (normalized.length > 0) {
      configStore.currentConfig.pinnedMods[key] = normalized;
    } else {
      delete configStore.currentConfig.pinnedMods[key];
    }
    configStore.saveConfig(configStore.currentConfig);
  }
  return normalized;
}
function setPinnedModsForCharacter(characterName, pinnedMods) {
  const normalized = normalizePinnedModNames(pinnedMods);
  if (!configStore.currentConfig.pinnedMods) configStore.currentConfig.pinnedMods = {};
  const {
    key,
    value
  } = charactersDirectories.getCharacterConfigStoreValue(configStore.currentConfig.pinnedMods, characterName, []);
  const existing = Array.isArray(value) ? value : [];
  const changed = existing.length !== normalized.length || existing.some((name, index) => name !== normalized[index]);
  if (!changed) return normalized;
  if (normalized.length > 0) {
    configStore.currentConfig.pinnedMods[key] = normalized;
  } else {
    delete configStore.currentConfig.pinnedMods[key];
  }
  configStore.saveConfig(configStore.currentConfig);
  return normalized;
}
function applyPinnedStateToMods(characterName, mods) {
  const pinnedNames = getPinnedModsForCharacter(characterName, mods.map(mod => mod.name));
  const pinnedIndexMap = new Map(pinnedNames.map((name, index) => [name, index]));
  return mods.map(mod => ({
    ...mod,
    pinned: pinnedIndexMap.has(mod.name),
    pinnedIndex: pinnedIndexMap.has(mod.name) ? pinnedIndexMap.get(mod.name) : -1
  }));
}
function movePinnedModsToTop(mods) {
  const pinned = [];
  const normal = [];
  for (const mod of mods) {
    if (mod.pinned) pinned.push(mod);else normal.push(mod);
  }
  pinned.sort((a, b) => {
    const indexDiff = (a.pinnedIndex ?? Number.MAX_SAFE_INTEGER) - (b.pinnedIndex ?? Number.MAX_SAFE_INTEGER);
    if (indexDiff !== 0) return indexDiff;
    return a.name.localeCompare(b.name, "zh-CN");
  });
  return [...pinned, ...normal];
}
function normalizeModTags(tags) {
  return Array.isArray(tags) ? tags.map(tag => typeof tag === "string" ? tag : tag && tag.name ? String(tag.name) : "").filter(Boolean) : [];
}
function readModTagsFromDir(modDir) {
  try {
    const tagsFile = path.join(modDir, "tags.json");
    if (!fs.existsSync(tagsFile)) return [];
    const data = JSON.parse(fs.readFileSync(tagsFile, "utf-8")) || {};
    return normalizeModTags(data.tags);
  } catch (_) {
    return [];
  }
}
function writeModTagsToDir(modDir, tags) {
  const tagsFile = path.join(modDir, "tags.json");
  let existing = {};
  if (fs.existsSync(tagsFile)) {
    try {
      existing = JSON.parse(fs.readFileSync(tagsFile, "utf-8")) || {};
    } catch (_) {
      existing = {};
    }
  }
  const payload = {
    ...existing,
    tags: normalizeModTags(tags)
  };
  fs.writeFileSync(tagsFile, JSON.stringify(payload, null, 2), "utf-8");
  return payload.tags;
}
function readModMetadataFromDir(modDir) {
  try {
    const tagsFile = path.join(modDir, "tags.json");
    if (!fs.existsSync(tagsFile)) return {};
    const parsed = JSON.parse(fs.readFileSync(tagsFile, "utf-8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (_) {
    return {};
  }
}
