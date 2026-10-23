"use strict";

const i18n = require("../../shared/i18n/core.cjs");
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const charactersDirectories = require("../characters/directories.cjs");
const gamesSettings = require("../games/settings.cjs");
const overlayHotkeyExpression = require("../overlay/hotkey-expression.cjs");
function clearHotkeysCacheForMod(characterName, modName, gameId2 = gamesSettings.getActiveGameScopeId()) {
  const cacheKeys = charactersDirectories.getCharacterModCacheKeys(characterName, modName, gameId2);
  let changed = false;
  cacheKeys.forEach(cacheKey => {
    if (Object.prototype.hasOwnProperty.call(hotkeysCache, cacheKey)) {
      delete hotkeysCache[cacheKey];
      changed = true;
    }
  });
  if (changed) {
    saveHotkeysCache();
  }
}
function getPrimaryHotkeysCacheKey(characterName, modName, gameId2 = gamesSettings.getActiveGameScopeId()) {
  const canonicalCharacterName = charactersDirectories.getCanonicalCharacterConfigKey(characterName, gameId2);
  return `${gameId2 === "genshin-impact" ? "genshin-impact/" : ""}${canonicalCharacterName}/${modName}`;
}
function invalidateHotkeysForGame(gameId = gamesSettings.getActiveGameScopeId()) {
  // Older games share the unprefixed cache; invalidate that whole legacy scope.
  for (const key of Object.keys(hotkeysCache)) {
    if (key.startsWith("genshin-impact/") === (gameId === "genshin-impact")) delete hotkeysCache[key];
  }
  saveHotkeysCache();
  notifyHotkeysChanged("__all__", null, gameId);
}
function notifyHotkeysChanged(characterName, modName, gameId = gamesSettings.getActiveGameScopeId(), senderId) {
  for (const window of electron.BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed() && window.webContents.id !== senderId) window.webContents.send("hotkeys-changed", {
      gameId,
      characterName,
      modName
    });
  }
}
const HOTKEYS_CACHE_PATH = path.join(electron.app.getPath("userData"), "hotkeys.json");
let hotkeysCache = {};
function loadHotkeysCache() {
  try {
    if (fs.existsSync(HOTKEYS_CACHE_PATH)) {
      const data = fs.readFileSync(HOTKEYS_CACHE_PATH, "utf-8");
      if (!data.trim()) {
        hotkeysCache = {};
        saveHotkeysCache();
        return;
      }
      hotkeysCache = JSON.parse(data);
    }
  } catch (e) {
    console.error("Failed to load hotkeys cache:", e);
    hotkeysCache = {};
    try {
      saveHotkeysCache();
    } catch (_) {}
  }
}
function saveHotkeysCache() {
  try {
    const tempPath = `${HOTKEYS_CACHE_PATH}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(hotkeysCache, null, 2));
    if (fs.existsSync(HOTKEYS_CACHE_PATH)) {
      fs.unlinkSync(HOTKEYS_CACHE_PATH);
    }
    fs.renameSync(tempPath, HOTKEYS_CACHE_PATH);
  } catch (e) {
    console.error("Failed to save hotkeys cache:", e);
  }
}
const HOTKEYS_CACHE_VERSION = 9;
function getHotkeyExpressionSemanticKey(expression) {
  const parsed = overlayHotkeyExpression.parseHotkeyExpression(expression);
  const normalizeTokens = tokens => (Array.isArray(tokens) ? tokens : []).map(token => `${String(token?.device || "")}:${String(token?.code || "")}`).filter(token => token !== ":").sort();
  return JSON.stringify({
    pressed: normalizeTokens(parsed.pressed),
    released: normalizeTokens(parsed.released),
    unsupported: (Array.isArray(parsed.unsupportedTokens) ? parsed.unsupportedTokens : []).map(token => String(token || "").trim().replace(/\s+/g, " ").toUpperCase()).filter(Boolean).sort()
  });
}
function getHotkeySemanticKey(hotkey) {
  const expressions = Array.isArray(hotkey?.rawKeys) ? hotkey.rawKeys : [];
  return [...new Set(expressions.map(expression => getHotkeyExpressionSemanticKey(expression)).filter(Boolean))].sort().join("|");
}
function dedupeHotkeysBySemanticBinding(hotkeys) {
  const deduped = [];
  const seen = new Map();
  for (const hotkey of Array.isArray(hotkeys) ? hotkeys : []) {
    const semanticKey = getHotkeySemanticKey(hotkey);
    if (!semanticKey) {
      deduped.push(hotkey);
      continue;
    }
    const existing = seen.get(semanticKey);
    if (!existing) {
      const first = {
        ...hotkey,
        duplicateCount: 1,
        sections: hotkey?.section ? [hotkey.section] : [],
        descriptions: hotkey?.description ? [hotkey.description] : []
      };
      seen.set(semanticKey, first);
      deduped.push(first);
      continue;
    }
    existing.duplicateCount += 1;
    if (hotkey?.section && !existing.sections.includes(hotkey.section)) {
      existing.sections.push(hotkey.section);
    }
    if (hotkey?.description && !existing.descriptions.includes(hotkey.description)) {
      existing.descriptions.push(hotkey.description);
    }
    if (hotkey?.isMenu && !existing.isMenu) {
      existing.section = hotkey.section;
      existing.keys = hotkey.keys;
      existing.rawKeys = hotkey.rawKeys;
      existing.description = hotkey.description;
      existing.isMenu = true;
      existing.canApply = hotkey.canApply;
      existing.applyPayload = hotkey.applyPayload;
      existing.alternatives = hotkey.alternatives;
    }
  }
  return deduped;
}
function parseIniForHotkeys(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split(/\r?\n/);
  const hotkeys = [];
  let currentSection = null;
  let currentKeyExpressions = [];
  let currentDesc = null;
  let isKeySection = false;
  const sectionRegex = /^\[Key(.*?)\]$/i;
  const anySectionRegex = /^\[(.*?)\]$/;
  const keyRegex = /^key\s*=\s*(.*)$/i;
  const varRegex = /\$(\w+)\s*=/;
  const flushCurrentSection = () => {
    if (!isKeySection || currentKeyExpressions.length === 0) return;
    const expressions = [];
    const seenExpressions = new Set();
    for (const item of currentKeyExpressions) {
      const expression = String(item || "").trim();
      if (!expression) continue;
      const semanticKey = getHotkeyExpressionSemanticKey(expression);
      if (seenExpressions.has(semanticKey)) continue;
      seenExpressions.add(semanticKey);
      expressions.push(expression);
    }
    if (expressions.length === 0) return;
    const alternatives = expressions.map(overlayHotkeyExpression.parseHotkeyExpression).filter(Boolean);
    const preferred = overlayHotkeyExpression.pickPreferredHotkeyAlternative(alternatives);
    const preferredIndex = preferred ? alternatives.findIndex(item => item === preferred) : -1;
    const descriptionBase = currentDesc || currentSection;
    const descLower = String(descriptionBase || "").toLowerCase();
    const isMenu = descLower === "menu";
    hotkeys.push({
      section: currentSection,
      keys: preferred && preferred.displayKeys.length > 0 ? [...preferred.displayKeys] : [],
      rawKeys: expressions,
      description: isMenu ? i18n.t("backend.mods.hotkeys.menu") : descriptionBase,
      isMenu,
      canApply: !!(preferred && preferred.canAutoApply),
      applyPayload: preferred ? overlayHotkeyExpression.buildHotkeyApplyPayloadFromAlternative(preferred) : null,
      alternatives: alternatives.map((alternative, index) => ({
        original: alternative.original,
        displayKeys: alternative.displayKeys.length > 0 ? [...alternative.displayKeys] : [alternative.original],
        label: alternative.displayLabel,
        canApply: !!alternative.canAutoApply,
        isPreferred: index === preferredIndex
      }))
    });
  };
  lines.forEach(rawLine => {
    const line = rawLine.trim();
    if (!line || line.startsWith(";")) return;
    const anySectionMatch = line.match(anySectionRegex);
    if (anySectionMatch) {
      flushCurrentSection();
      const sectionMatch = line.match(sectionRegex);
      if (!sectionMatch) {
        isKeySection = false;
        currentSection = null;
        currentKeyExpressions = [];
        currentDesc = null;
        return;
      }
      const fullSectionName = sectionMatch[1];
      currentSection = fullSectionName;
      isKeySection = true;
      currentKeyExpressions = [];
      let niceName = fullSectionName;
      if (niceName.startsWith("_")) niceName = niceName.substring(1);
      currentDesc = niceName;
      return;
    }
    if (!isKeySection) return;
    const keyMatch = line.match(keyRegex);
    if (keyMatch) {
      const keyExpression = keyMatch[1].trim();
      if (keyExpression) currentKeyExpressions.push(keyExpression);
    }
    const varMatch = line.match(varRegex);
    if (varMatch) {
      const varName = varMatch[1];
      if (!["active", "active0", "active1", "pressed", "hold"].includes(varName.toLowerCase())) {
        currentDesc = varName;
      }
    }
  });
  flushCurrentSection();
  return hotkeys;
}
function initialize() {
  loadHotkeysCache();
}
module.exports = {
  initialize,
  clearHotkeysCacheForMod,
  getPrimaryHotkeysCacheKey,
  invalidateHotkeysForGame,
  notifyHotkeysChanged,
  saveHotkeysCache,
  dedupeHotkeysBySemanticBinding,
  parseIniForHotkeys,
  get hotkeysCache() {
    return hotkeysCache;
  },
  HOTKEYS_CACHE_VERSION
};
