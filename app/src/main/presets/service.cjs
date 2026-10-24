"use strict";

const i18n = require("../../shared/i18n/core.cjs");
module.exports = {
  registerIpc,
  withBuiltinPresets,
  findPresetByName,
  applyPresetModsForGame,
  notifyPresetApplicationChanged,
  normalizePresetScope,
  loadPresets,
  savePresets
};
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const charactersDirectories = require("../characters/directories.cjs");
const charactersHidden = require("../characters/hidden.cjs");
const configStore = require("../config/store.cjs");
const coreLogger = require("../core/logger.cjs");
const gamesEnvironment = require("../games/environment.cjs");
const gamesNevernessLoader = require("../games/neverness/loader.cjs");
const gamesSettings = require("../games/settings.cjs");
const modsConflicts = require("../mods/conflicts.cjs");
const modsNevernessPaks = require("../games/neverness/paks.cjs");
const overlayWindow = require("../overlay/window.cjs");
const persistService = require("../persist/service.cjs");
const persistTracking = require("../persist/tracking.cjs");
const systemFiles = require("../system/files.cjs");
const PRESETS_PATH = path.join(electron.app.getPath("userData"), "presets.json");
const BUILTIN_NO_MOD_PRESET_ID = "__builtin_no_mod__";
function createBuiltinNoModPreset() {
  return {
    id: BUILTIN_NO_MOD_PRESET_ID,
    name: "无mod",
    description: i18n.t("backend.presets.service.disableAllDescription"),
    mods: [],
    createdAt: null,
    updatedAt: null,
    isBuiltIn: true
  };
}
function withBuiltinPresets(presets) {
  const builtin = createBuiltinNoModPreset();
  const normalized = Array.isArray(presets) ? presets : [];
  const filtered = normalized.filter(preset => preset && preset.id !== BUILTIN_NO_MOD_PRESET_ID && preset.name !== builtin.name);
  return [builtin, ...filtered];
}
function findPresetById(data, presetId) {
  if (presetId === BUILTIN_NO_MOD_PRESET_ID) return createBuiltinNoModPreset();
  return (data.presets || []).find(preset => preset.id === presetId) || null;
}
function findPresetByName(data, presetName) {
  if (presetName === "无mod") return createBuiltinNoModPreset();
  return (data.presets || []).find(preset => preset.name === presetName) || null;
}
function createEmptyPresetScope() {
  return {
    presets: [],
    activePresetId: null
  };
}
function normalizePresetModEntry(mod, gameId2 = gamesSettings.getActiveGameScopeId()) {
  if (!mod || typeof mod !== "object") return null;
  const characterName = mod.characterName || mod.character;
  const modName = mod.modName || mod.mod;
  if (!characterName || !modName) return null;
  return {
    ...mod,
    characterName: charactersDirectories.getCanonicalCharacterConfigKey(characterName, gameId2),
    modName,
    enabled: mod.enabled !== false
  };
}
function normalizePresetMods(mods, gameId2 = gamesSettings.getActiveGameScopeId()) {
  if (!Array.isArray(mods)) return [];
  return mods.map(mod => normalizePresetModEntry(mod, gameId2)).filter(Boolean);
}
function snapshotEnabledPresetMods(gameId2 = gamesSettings.getActiveGameScopeId()) {
  const presetMods = [];
  if (gamesNevernessLoader.isNevernessDx12Mode(gameId2)) {
    const paths = gamesNevernessLoader.ensureNevernessDx12GamePaths();
    const modsPath2 = paths.pakModsDir;
    if (!modsPath2 || !fs.existsSync(modsPath2)) return [];
    const characterEntries2 = charactersDirectories.listCharacterDirectories(modsPath2, gameId2);
    for (const entry of characterEntries2) {
      const result = modsNevernessPaks.getNevernessDx12Mods(entry.displayName);
      if (!result?.success || !Array.isArray(result.mods)) continue;
      for (const mod of result.mods) {
        if (mod.enabled) {
          presetMods.push({
            characterName: entry.displayName,
            modName: mod.name,
            enabled: true
          });
        }
      }
    }
    return presetMods;
  }
  const modsPath = gamesSettings.getModsPath(gameId2);
  if (!modsPath || !fs.existsSync(modsPath)) return [];
  const characterEntries = charactersDirectories.listCharacterDirectories(modsPath, gameId2);
  for (const entry of characterEntries) {
    const modDirs = fs.readdirSync(entry.characterRootPath, {
      withFileTypes: true
    }).filter(dirent => dirent.isDirectory());
    for (const mod of modDirs) {
      if (!mod.name.startsWith("DISABLED_")) {
        presetMods.push({
          characterName: entry.displayName,
          modName: mod.name,
          enabled: true
        });
      }
    }
  }
  return presetMods;
}
async function applyPresetModsForGame(preset, gameId2 = gamesSettings.getActiveGameScopeId()) {
  const enableSet = new Set(normalizePresetMods(preset.mods, gameId2).filter(mod => mod.enabled !== false && !charactersHidden.isCharacterHidden(mod.characterName, gameId2)).map(mod => `${mod.characterName}/${mod.modName}`));
  if (gameId2 === "arknights") {
    const entries = [...enableSet].map(key => {
      const [characterName, modName] = key.split("/");
      const found = charactersDirectories.resolveExistingStandardModDirectory(characterName, modName, gameId2);
      return found ? { name: key, path: found.modPath } : null;
    }).filter(Boolean);
    try { require("../games/arknights/deployment.cjs").planDeployment(entries); }
    catch (error) { return { success: false, error: error.message }; }
  }
  const results = {
    enabled: 0,
    disabled: 0,
    missing: 0,
    errors: []
  };
  if (gamesNevernessLoader.isNevernessDx12Mode(gameId2)) {
    const paths = gamesNevernessLoader.ensureNevernessDx12GamePaths();
    const modsPath2 = paths.pakModsDir;
    if (!modsPath2 || !fs.existsSync(modsPath2)) {
      return {
        error: i18n.t("backend.presets.service.nevernessPakDirectoryMissing")
      };
    }
    const characterEntries2 = charactersDirectories.listCharacterDirectories(modsPath2, gameId2);
    for (const entry of characterEntries2) {
      const current = modsNevernessPaks.getNevernessDx12Mods(entry.displayName);
      if (!current?.success || !Array.isArray(current.mods)) continue;
      for (const mod of current.mods) {
        const key = `${entry.displayName}/${mod.name}`;
        const shouldEnable = enableSet.has(key);
        if (!!mod.enabled === shouldEnable) continue;
        const toggleResult = modsNevernessPaks.toggleNevernessDx12PakMod(entry.displayName, mod.name, shouldEnable);
        if (toggleResult?.success) {
          if (shouldEnable) results.enabled += 1;else results.disabled += 1;
        } else {
          results.errors.push(`${key}: ${toggleResult?.error || i18n.t("backend.overlay.window.pakToggleFailed")}`);
        }
      }
    }
    for (const mod of normalizePresetMods(preset.mods, gameId2)) {
      if (mod.enabled === false) continue;
      const found = characterEntries2.some(entry => {
        if (entry.displayName !== mod.characterName) return false;
        const current = modsNevernessPaks.getNevernessDx12Mods(entry.displayName);
        return current?.success && current.mods?.some(item => item.name === mod.modName);
      });
      if (!found) results.missing += 1;
    }
    modsConflicts.clearConflictCache();
    return {
      success: true,
      results
    };
  }
  const modsPath = gamesSettings.getModsPath(gameId2);
  const env = gamesEnvironment.resolveActiveGameEnvRoot(gameId2);
  if (!modsPath || !fs.existsSync(modsPath)) {
    return {
      error: i18n.t("backend.presets.service.modsDirectoryMissing")
    };
  }
  const enabledStateFiles = [];
  const disabledStateFiles = [];
  const characterEntries = charactersDirectories.listCharacterDirectories(modsPath, gameId2);
  for (const entry of characterEntries) {
    const charPath = entry.characterRootPath;
    const modDirs = fs.readdirSync(charPath, {
      withFileTypes: true
    }).filter(dirent => dirent.isDirectory());
    for (const mod of modDirs) {
      const isDisabled = mod.name.startsWith("DISABLED_");
      const cleanName = isDisabled ? mod.name.replace("DISABLED_", "") : mod.name;
      const key = `${entry.displayName}/${cleanName}`;
      const shouldEnable = enableSet.has(key);
      const currentModPath = path.join(charPath, mod.name);
      try {
        if (shouldEnable && isDisabled) {
          if (persistTracking.isPersistBridgeEnabled(gameId2)) {
            const stateFiles = persistTracking.collectHostedPersistStateFilesForModDir(currentModPath);
            enabledStateFiles.push(...stateFiles);
          }
          const renameResult = await systemFiles.renameModDirectoryWithRetry(currentModPath, path.join(charPath, cleanName));
          if (!renameResult.success) {
            throw new Error(renameResult.error || i18n.t("backend.presets.service.enableModFailed"));
          }
          results.enabled++;
        } else if (!shouldEnable && !isDisabled) {
          if (persistTracking.isPersistBridgeEnabled(gameId2)) {
            const stateFiles = persistTracking.collectHostedPersistStateFilesForModDir(currentModPath);
            if (persistService.dirUsesManagedPersistBridge(currentModPath)) {
              persistTracking.syncPersistBridgeStateForModDir(currentModPath, gameId2);
            }
            disabledStateFiles.push(...stateFiles);
          }
          const renameResult = await systemFiles.renameModDirectoryWithRetry(currentModPath, path.join(charPath, `DISABLED_${mod.name}`));
          if (!renameResult.success) {
            throw new Error(renameResult.error || i18n.t("backend.presets.service.disableModFailed"));
          }
          results.disabled++;
        }
      } catch (e) {
        results.errors.push(`${key}: ${e.message}`);
      }
    }
  }
  if (env?.root && persistTracking.isPersistBridgeEnabled(gameId2)) {
    persistTracking.updateActivePersistBridgeIncludesIncremental(env.root, {
      enableStateFiles: enabledStateFiles,
      disableStateFiles: disabledStateFiles
    });
  }
  modsConflicts.clearConflictCache();
  for (const mod of normalizePresetMods(preset.mods, gameId2)) {
    if (mod.enabled === false) continue;
    const charPath = charactersDirectories.resolveCharacterPath(mod.characterName, gameId2);
    if (!charPath || !fs.existsSync(charPath)) {
      results.missing++;
      continue;
    }
    const modPath = path.join(charPath, mod.modName);
    const disabledPath = path.join(charPath, `DISABLED_${mod.modName}`);
    if (!fs.existsSync(modPath) && !fs.existsSync(disabledPath)) {
      results.missing++;
    }
  }
  return {
    success: true,
    results
  };
}
function notifyPresetApplicationChanged(gameId2 = gamesSettings.getActiveGameScopeId()) {
  require("../desktop/notifications.cjs").notifyAllModWindowsChanged("__all__", { gameId: gameId2, reason: "preset-applied" });
  charactersDirectories.CHARACTER_DIRECTORY_STATS_CACHE.clear();
  electron.BrowserWindow.getAllWindows().forEach(w => {
    if (!w.isDestroyed()) {
      w.webContents.send("mods-changed", {
        characterName: "__all__",
        gameId: gameId2,
        reason: "preset-applied",
        fullRefresh: true
      });
      w.webContents.send("presets-changed");
    }
  });
}
function normalizePresetScope(data) {
  const emptyScope = createEmptyPresetScope();
  const gameId2 = gamesSettings.getActiveGameScopeId();
  if (Array.isArray(data)) {
    return {
      ...emptyScope,
      presets: data.map(preset => ({
        ...preset,
        mods: normalizePresetMods(preset?.mods, gameId2)
      }))
    };
  }
  return {
    ...emptyScope,
    presets: Array.isArray(data?.presets) ? data.presets.map(preset => ({
      ...preset,
      mods: normalizePresetMods(preset?.mods, gameId2)
    })) : [],
    activePresetId: data?.activePresetId || null
  };
}
function loadPresetStore() {
  try {
    if (fs.existsSync(PRESETS_PATH)) {
      const data = fs.readFileSync(PRESETS_PATH, "utf-8");
      const parsed = JSON.parse(data);
      if (parsed?.presetsByGame && typeof parsed.presetsByGame === "object") {
        const presetsByGame = {};
        Object.entries(parsed.presetsByGame).forEach(([gameId2, scope]) => {
          presetsByGame[gameId2] = normalizePresetScope(scope);
        });
        return {
          presetsByGame
        };
      }
      return {
        presetsByGame: {
          endfield: normalizePresetScope(parsed)
        }
      };
    }
  } catch (e) {
    console.error("Failed to load presets:", e);
  }
  return {
    presetsByGame: {}
  };
}
function savePresetStore(store) {
  try {
    fs.writeFileSync(PRESETS_PATH, JSON.stringify(store, null, 2));
  } catch (e) {
    console.error("Failed to save presets:", e);
  }
}
function tryLoadLegacyPresetScope(gameId2 = gamesSettings.getActiveGameScopeId()) {
  try {
    const targetGame = (configStore.currentConfig.games || []).find(game => game.id === gameId2);
    const modsPath = targetGame?.modFolderPath || (gameId2 === "endfield" ? configStore.currentConfig.modsPath || "" : "");
    if (!modsPath) return null;
    const legacyPath = path.join(path.dirname(modsPath), "presets.json");
    if (!legacyPath || legacyPath === PRESETS_PATH || !fs.existsSync(legacyPath)) return null;
    const parsed = JSON.parse(fs.readFileSync(legacyPath, "utf-8"));
    return normalizePresetScope(parsed);
  } catch (_) {
    return null;
  }
}
function loadPresets(gameId2 = gamesSettings.getActiveGameScopeId()) {
  const store = loadPresetStore();
  let scope = normalizePresetScope(store.presetsByGame?.[gameId2]);
  if (scope.presets.length === 0 && !scope.activePresetId) {
    const legacyScope = tryLoadLegacyPresetScope(gameId2);
    if (legacyScope && (legacyScope.presets.length > 0 || legacyScope.activePresetId)) {
      store.presetsByGame[gameId2] = legacyScope;
      savePresetStore(store);
      scope = legacyScope;
    }
  }
  return scope;
}
function savePresets(data, gameId2 = gamesSettings.getActiveGameScopeId()) {
  const store = loadPresetStore();
  store.presetsByGame[gameId2] = normalizePresetScope(data);
  savePresetStore(store);
}
function registerIpc() {
  electron.ipcMain.handle("preset:list", async () => {
    try {
      const data = loadPresets();
      return {
        success: true,
        presets: withBuiltinPresets(data.presets),
        activePresetId: data.activePresetId
      };
    } catch (error) {
      return {
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("preset:create", async (_, {
    name,
    description,
    mods
  }) => {
    try {
      if (!name || !name.trim()) {
        return {
          error: i18n.t("backend.presets.service.presetNameEmpty")
        };
      }
      if (name.trim() === "无mod") {
        return {
          error: i18n.t("backend.presets.service.reservedPresetName")
        };
      }
      const data = loadPresets();
      if ((data.presets || []).some(preset2 => preset2.name === name.trim())) {
        return {
          error: i18n.t("backend.presets.service.presetNameExists")
        };
      }
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      let presetMods = mods;
      if (!presetMods) {
        presetMods = snapshotEnabledPresetMods(gamesSettings.getActiveGameScopeId());
      } else {
        presetMods = normalizePresetMods(presetMods, gamesSettings.getActiveGameScopeId());
      }
      const preset = {
        id,
        name: name.trim(),
        description: description || "",
        mods: presetMods,
        createdAt: now,
        updatedAt: now
      };
      data.presets.push(preset);
      savePresets(data);
      if (overlayWindow.overlayWindow && !overlayWindow.overlayWindow.isDestroyed()) {
        overlayWindow.overlayWindow.webContents.send("presets-changed");
      }
      return {
        success: true,
        preset
      };
    } catch (error) {
      return {
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("preset:delete", async (_, presetId) => {
    try {
      if (presetId === BUILTIN_NO_MOD_PRESET_ID) {
        return {
          error: i18n.t("backend.presets.service.builtInPresetCannotDelete")
        };
      }
      const data = loadPresets();
      const idx = data.presets.findIndex(p => p.id === presetId);
      if (idx === -1) return {
        error: i18n.t("backend.overlay.window.presetMissing")
      };
      data.presets.splice(idx, 1);
      if (data.activePresetId === presetId) {
        data.activePresetId = null;
      }
      savePresets(data);
      if (overlayWindow.overlayWindow && !overlayWindow.overlayWindow.isDestroyed()) {
        overlayWindow.overlayWindow.webContents.send("presets-changed");
      }
      return {
        success: true
      };
    } catch (error) {
      return {
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("preset:update", async (_, {
    presetId,
    name,
    description,
    mods
  }) => {
    try {
      if (presetId === BUILTIN_NO_MOD_PRESET_ID) {
        return {
          error: i18n.t("backend.presets.service.builtInPresetReadOnly")
        };
      }
      const data = loadPresets();
      const preset = findPresetById(data, presetId);
      if (!preset) return {
        error: i18n.t("backend.overlay.window.presetMissing")
      };
      if (name !== void 0) {
        const trimmedName = name.trim();
        if (!trimmedName) return {
          error: i18n.t("backend.presets.service.presetNameEmpty")
        };
        if (trimmedName === "无mod") return {
          error: i18n.t("backend.presets.service.reservedPresetName")
        };
        if ((data.presets || []).some(item => item.id !== presetId && item.name === trimmedName)) {
          return {
            error: i18n.t("backend.presets.service.presetNameExists")
          };
        }
        preset.name = trimmedName;
      }
      if (description !== void 0) preset.description = description;
      if (mods !== void 0) preset.mods = normalizePresetMods(mods, gamesSettings.getActiveGameScopeId());
      preset.updatedAt = new Date().toISOString();
      savePresets(data);
      if (overlayWindow.overlayWindow && !overlayWindow.overlayWindow.isDestroyed()) {
        overlayWindow.overlayWindow.webContents.send("presets-changed");
      }
      return {
        success: true,
        preset
      };
    } catch (error) {
      return {
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("preset:activate", async (_, presetId) => {
    try {
      const gameId2 = gamesSettings.getActiveGameScopeId();
      const data = loadPresets();
      const preset = findPresetById(data, presetId);
      if (!preset) return {
        error: i18n.t("backend.overlay.window.presetMissing")
      };
      const applyResult = await applyPresetModsForGame(preset, gameId2);
      if (!applyResult?.success) {
        return {
          error: applyResult?.error || i18n.t("backend.overlay.window.presetApplyFailed")
        };
      }
      const results = applyResult.results || {
        enabled: 0,
        disabled: 0,
        missing: 0,
        errors: []
      };
      data.activePresetId = presetId;
      savePresets(data);
      coreLogger.logger.info(`[Preset] Activated "${preset.name}": enabled=${results.enabled}, disabled=${results.disabled}, missing=${results.missing}`);
      notifyPresetApplicationChanged(gameId2);
      return {
        success: true,
        results
      };
    } catch (error) {
      coreLogger.logger.error("preset:activate error:", error);
      return {
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("preset:deactivate", async () => {
    try {
      const data = loadPresets();
      data.activePresetId = null;
      savePresets(data);
      return {
        success: true
      };
    } catch (error) {
      return {
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("preset:snapshot", async (_, presetId) => {
    try {
      if (presetId === BUILTIN_NO_MOD_PRESET_ID) {
        return {
          error: i18n.t("backend.presets.service.builtInSnapshotReadOnly")
        };
      }
      const modsPath = gamesSettings.getModsPath();
      if (!modsPath || !fs.existsSync(modsPath)) {
        return {
          error: i18n.t("backend.presets.service.modsDirectoryNotConfigured")
        };
      }
      const data = loadPresets();
      const preset = data.presets.find(p => p.id === presetId);
      if (!preset) return {
        error: i18n.t("backend.overlay.window.presetMissing")
      };
      const currentMods = snapshotEnabledPresetMods(gamesSettings.getActiveGameScopeId());
      preset.mods = currentMods;
      preset.updatedAt = new Date().toISOString();
      savePresets(data);
      return {
        success: true,
        preset
      };
    } catch (error) {
      return {
        error: error.message
      };
    }
  });
}
