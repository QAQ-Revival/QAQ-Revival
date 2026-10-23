"use strict";

const i18n = require("../../shared/i18n/core.cjs");
module.exports = {
  registerIpc,
  initialize,
  dirUsesManagedPersistBridge,
  usesManagedPersistBridge,
  normalizeD3dxUserKey,
  readD3dxUserConstants,
  restorePersistStateForMod,
  get persistManager() {
    return persistManager;
  }
};
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const {
  createPersistManager
} = require("./manager.cjs");
const {
  readJsonFileSync,
  writeJsonFileSync
} = require("../core/json-store.cjs");
const charactersCatalog = require("../characters/catalog.cjs");
const charactersDirectories = require("../characters/directories.cjs");
const charactersOrganization = require("../characters/organization.cjs");
const charactersSkins = require("../characters/skins.cjs");
const configStore = require("../config/store.cjs");
const coreLogger = require("../core/logger.cjs");
const gamesEnvironment = require("../games/environment.cjs");
const gamesSettings = require("../games/settings.cjs");
const modsBackups = require("../mods/backups.cjs");
const modsIniFiles = require("../mods/ini-files.cjs");
const persistIni = require("./ini.cjs");
const persistLayout = require("./layout.cjs");
const persistMigration = require("./migration.cjs");
const persistTracking = require("./tracking.cjs");
const MOD_PERSIST_STATE_PATH = path.join(electron.app.getPath("userData"), "mod-persist-state.json");
const MANAGED_PERSIST_BRIDGE_MODS = new Set(["莱万汀/莱万汀-2B落体切换"]);
let modPersistState = {
  scopes: {}
};
function loadModPersistState() {
  try {
    if (fs.existsSync(MOD_PERSIST_STATE_PATH)) {
      const data = fs.existsSync(MOD_PERSIST_STATE_PATH + ".copying") ? JSON.stringify(readJsonFileSync(MOD_PERSIST_STATE_PATH)) : fs.readFileSync(MOD_PERSIST_STATE_PATH, "utf-8");
      if (!data.trim()) {
        modPersistState = {
          scopes: {}
        };
        return;
      }
      const parsed = JSON.parse(data);
      modPersistState = parsed && typeof parsed === "object" ? parsed : {
        scopes: {}
      };
      if (!modPersistState.scopes || typeof modPersistState.scopes !== "object") {
        modPersistState.scopes = {};
      }
    }
  } catch (e) {
    console.error("Failed to load mod persist state:", e);
    modPersistState = {
      scopes: {}
    };
  }
}
let persistManager;
function saveModPersistState() {
  try {
    writeJsonFileSync(MOD_PERSIST_STATE_PATH, modPersistState);
    return true;
  } catch (e) {
    console.error("Failed to save mod persist state:", e);
    throw e;
  }
}
function getModPersistScopeKey(gameId = gamesSettings.getActiveGameScopeId()) {
  const activeGame = gamesSettings.getGameById(gameId);
  if (activeGame?.id) return `game:${activeGame.id}`;
  const env = gamesEnvironment.resolveActiveGameEnvRoot();
  if (env?.root) return `root:${env.root.toLowerCase()}`;
  const modsPath = gamesSettings.getModsPath();
  if (modsPath) return `mods:${modsPath.toLowerCase()}`;
  return "__default__";
}
function getModPersistRecordKey(characterName, modName) {
  return `${characterName}/${modName}`;
}
function dirUsesManagedPersistBridge(modDirPath) {
  if (!modDirPath || !fs.existsSync(modDirPath)) return false;
  try {
    const iniFiles = modsIniFiles.getIniFiles(modDirPath);
    for (const iniPath of iniFiles) {
      try {
        const content = fs.readFileSync(iniPath, "utf-8");
        if (content.includes("$\\QAQM\\Persist\\") || /Persisted state is hosted by qaqm_state_/i.test(content)) {
          return true;
        }
      } catch (_) {}
    }
  } catch (_) {}
  return false;
}
function usesManagedPersistBridge(characterName, modName, gameId = gamesSettings.getActiveGameScopeId()) {
  if (MANAGED_PERSIST_BRIDGE_MODS.has(getModPersistRecordKey(characterName, modName))) {
    return true;
  }
  const charPath = charactersDirectories.resolveCharacterPath(characterName, gameId);
  if (!charPath || !fs.existsSync(charPath)) return false;
  const candidatePaths = [path.join(charPath, modName), path.join(charPath, `DISABLED_${modName}`)];
  return candidatePaths.some(candidatePath => dirUsesManagedPersistBridge(candidatePath));
}
function normalizeWindowsRelativePath(value) {
  return String(value || "").replace(/[\/]+/g, "\\").replace(/^\\+/, "");
}
function normalizeD3dxUserKey(value) {
  return normalizeWindowsRelativePath(value).toLowerCase();
}
function getD3dxUserIniPath() {
  const env = gamesEnvironment.resolveActiveGameEnvRoot();
  if (!env) return null;
  return path.join(env.root, "d3dx_user.ini");
}
function readD3dxUserConstants(d3dxUserPath) {
  const defaultPrefixLines = ["; AUTOMATICALLY GENERATED FILE - DO NOT EDIT", ";", "; 3DMigoto will overwrite this file whenever any persistent settings are", '; altered by hot key or command list. Tag global variables with the "persist"', "; keyword to save them in this file. Use the post keyword in the [Constants]", "; command list if you need to do any intialisation after this file is loaded.", ";"];
  if (!d3dxUserPath || !fs.existsSync(d3dxUserPath)) {
    return {
      prefixLines: defaultPrefixLines,
      constantsMap: new Map(),
      suffixLines: []
    };
  }
  const lines = fs.readFileSync(d3dxUserPath, "utf-8").split(/\r?\n/);
  const prefixLines = [];
  const suffixLines = [];
  const constantsMap = new Map();
  let sawConstants = false;
  let inConstants = false;
  lines.forEach(line => {
    const trimmed = line.trim();
    if (/^\[Constants\]$/i.test(trimmed)) {
      sawConstants = true;
      inConstants = true;
      return;
    }
    if (inConstants && /^\[[^\]]+\]$/.test(trimmed)) {
      inConstants = false;
      suffixLines.push(line);
      return;
    }
    if (!sawConstants) {
      prefixLines.push(line);
      return;
    }
    if (inConstants) {
      if (!trimmed || trimmed.startsWith(";")) return;
      const assignmentMatch = line.match(/^\s*([^=]+?)\s*=\s*(.*?)\s*$/);
      if (!assignmentMatch) return;
      const rawKey = assignmentMatch[1].trim();
      const rawValue = assignmentMatch[2].trim();
      constantsMap.set(normalizeD3dxUserKey(rawKey), {
        key: rawKey,
        value: rawValue
      });
      return;
    }
    suffixLines.push(line);
  });
  return {
    prefixLines: prefixLines.length > 0 ? prefixLines : defaultPrefixLines,
    constantsMap,
    suffixLines
  };
}
function writeD3dxUserConstants(d3dxUserPath, constantsMap, prefixLines = [], suffixLines = []) {
  const lines = [];
  const cleanedPrefix = Array.isArray(prefixLines) ? prefixLines : [];
  const cleanedSuffix = Array.isArray(suffixLines) ? suffixLines : [];
  if (cleanedPrefix.length > 0) {
    lines.push(...cleanedPrefix);
  }
  if (lines.length > 0 && lines[lines.length - 1] !== "") {
    lines.push("");
  }
  lines.push("[Constants]");
  for (const entry of constantsMap.values()) {
    lines.push(`${entry.key} = ${entry.value}`);
  }
  if (cleanedSuffix.length > 0) {
    if (lines[lines.length - 1] !== "") {
      lines.push("");
    }
    lines.push(...cleanedSuffix);
  }
  const tempPath = `${d3dxUserPath}.tmp`;
  fs.writeFileSync(tempPath, `${lines.join("\n").replace(/\n+$/, "")}
`, "utf-8");
  if (fs.existsSync(d3dxUserPath)) {
    fs.unlinkSync(d3dxUserPath);
  }
  fs.renameSync(tempPath, d3dxUserPath);
}
function buildD3dxUserVariableKey(envRoot, iniPath, variableName) {
  const relPath = normalizeWindowsRelativePath(path.relative(envRoot, iniPath)).toLowerCase();
  const normalizedVarName = String(variableName || "").replace(/^\$/u, "").trim().toLowerCase();
  return normalizedVarName ? `$\\${relPath}\\${normalizedVarName}` : `$\\${relPath}`;
}
function restorePersistStateForMod(characterName, modName, modDirPath, gameId = gamesSettings.getActiveGameScopeId()) {
  try {
    if (usesManagedPersistBridge(characterName, modName, gameId)) {
      return {
        restored: false,
        managed: true
      };
    }
    const env = gamesEnvironment.resolveActiveGameEnvRoot(gameId);
    const d3dxUserPath = env && path.join(env.root, "d3dx_user.ini");
    if (!env || !d3dxUserPath || !fs.existsSync(modDirPath)) {
      return {
        restored: false
      };
    }
    const record = persistManager.legacyRecord(gameId, getModPersistRecordKey(characterName, modName));
    if (!record || !Array.isArray(record.files) || record.files.length === 0) {
      return {
        restored: false
      };
    }
    const {
      prefixLines,
      constantsMap,
      suffixLines
    } = readD3dxUserConstants(d3dxUserPath);
    let updated = false;
    record.files.forEach(fileRecord => {
      if (!fileRecord?.relativeIniPath || !fileRecord.variables || typeof fileRecord.variables !== "object") return;
      const iniPath = path.join(modDirPath, fileRecord.relativeIniPath);
      if (!fs.existsSync(iniPath)) return;
      Object.entries(fileRecord.variables).forEach(([variableName, value]) => {
        const rawKey = buildD3dxUserVariableKey(env.root, iniPath, variableName);
        constantsMap.set(normalizeD3dxUserKey(rawKey), {
          key: rawKey,
          value: String(value)
        });
        updated = true;
      });
    });
    if (!updated) {
      return {
        restored: false
      };
    }
    writeD3dxUserConstants(d3dxUserPath, constantsMap, prefixLines, suffixLines);
    record.lastRestoredAt = new Date().toISOString();
    saveModPersistState();
    return {
      restored: true
    };
  } catch (e) {
    coreLogger.logger.warn("Failed to restore mod persist state:", e?.message || e);
    return {
      restored: false,
      error: e?.message || String(e)
    };
  }
}
function initialize() {
  loadModPersistState();
  persistManager = createPersistManager({
    userData: electron.app.getPath("userData"),
    getConfig: () => configStore.currentConfig,
    saveConfig: configStore.saveConfig,
    getGame: gamesSettings.getSettingsGame,
    getModsPath: gamesSettings.getModsPath,
    getLegacy: () => modPersistState,
    saveLegacy: saveModPersistState,
    migrateFiles: root => {
      persistLayout.migrateQaqmBridgeFilesToBridgeDir(root);
      persistLayout.migratePersistBridgeStateFilesToCacheDir(root);
    },
    getIniFiles: modsIniFiles.getIniFiles,
    descriptor: persistIni.buildPersistBridgeDescriptor,
    hostedFiles: persistTracking.extractHostedPersistStateFilesFromContent,
    resolveMod: (gameId, characterName, modName) => charactersDirectories.resolveExistingStandardModDirectory(characterName, modName, gameId),
    characterName: (gameId, name) => charactersCatalog.getCharacterMappingEntry(name, gameId)?.displayName || name,
    describeSource: (gameId, mods, ini) => {
      const parts = path.relative(mods, ini).split(path.sep);
      if (charactersOrganization.isLegacyCharacterContainerName(parts[0])) parts.shift();
      if (parts.length < 3) return {};
      return {
        characterName: charactersCatalog.getCharacterMappingEntry(parts[0], gameId)?.displayName || parts[0],
        modName: parts[1].replace(/^DISABLED_/i, ""),
        iniPath: parts.slice(2).join("/")
      };
    },
    parseDeclarations: persistIni.parseLocalPersistDeclarations,
    sync: persistTracking.syncPersistBridgeStateForModDir,
    restoreBackups: modsBackups.restorePersistBakFiles,
    readConstants: readD3dxUserConstants,
    writeConstants: writeD3dxUserConstants,
    removeTracking: (root, names) => persistTracking.updateActivePersistBridgeIncludesIncremental(root, {
      removeStateFiles: names
    }),
    invalidate: root => {
      persistLayout.preparedPersistBridgeRoots.delete(root);
      persistLayout.preparedKeypressRoots.delete(root);
    }
  });
}
function registerIpc() {
  electron.ipcMain.handle("persist-bridge-clear-cache", async (_, gameId) => {
    try {
      return persistManager.remove(gameId);
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("persist-bridge-games", async () => {
    try {
      return {
        success: true,
        games: persistManager.listGames()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("persist-bridge-list", async (_, gameId, options = {}) => {
    try {
      return persistManager.list(gameId, {
        metadataOnly: options.metadataOnly === true,
        ids: Array.isArray(options.ids) ? options.ids.filter(id => typeof id === "string") : undefined,
        refresh: options.refresh === true
      });
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("persist-bridge-mod", async (_, {
    gameId,
    characterName,
    modName
  } = {}) => {
    try {
      characterName = charactersSkins.assertSafeAppearancePathSegment(characterName, i18n.t("backend.validation.characterName"));
      modName = charactersSkins.assertSafeAppearancePathSegment(modName, i18n.t("backend.validation.modName"));
      return persistManager.mod(gamesSettings.getSettingsGame(gameId).id, characterName, modName);
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("persist-bridge-set-enabled", async (_, {
    gameId,
    enabled
  } = {}) => {
    try {
      gamesSettings.getSettingsGame(gameId);
      persistManager.setEnabled(gameId, enabled);
      return {
        success: true,
        restartRequired: true
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("persist-bridge-delete", async (_, {
    gameId,
    ids
  } = {}) => {
    try {
      if (!Array.isArray(ids)) throw new Error(i18n.t("backend.persist.service.selectSavedItems"));
      return persistManager.remove(gameId, ids);
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("persist-bridge-reset-mod", async (_, {
    characterName,
    modName
  }) => {
    try {
      const gameId2 = gamesSettings.getActiveGameScopeId();
      const modsPath = gamesSettings.getModsPath();
      if (!modsPath || !fs.existsSync(modsPath)) {
        return {
          success: false,
          error: i18n.t("backend.mods.backups.modsPathMissing")
        };
      }
      const resolved = charactersDirectories.resolveExistingStandardModDirectory(characterName, modName, gameId2);
      if (!resolved?.modPath || !fs.existsSync(resolved.modPath)) {
        return {
          success: false,
          error: i18n.t("backend.mods.backups.modDirectoryMissing", {
            modName
          })
        };
      }
      const restoredCount = modsBackups.restorePersistBakFiles(resolved.modPath);
      const root = path.dirname(modsPath);
      persistMigration.ensurePersistBridgeMigrationForModDir(root, resolved.modPath);
      return {
        success: true,
        restoredCount
      };
    } catch (e) {
      return {
        success: false,
        error: e.message
      };
    }
  });
  electron.ipcMain.handle("persist-bridge-reset-character", async (_, characterName) => {
    try {
      const modsPath = gamesSettings.getModsPath();
      if (!modsPath || !fs.existsSync(modsPath)) {
        return {
          success: false,
          error: i18n.t("backend.mods.backups.modsPathMissing")
        };
      }
      const charDir = path.join(modsPath, characterName);
      if (!fs.existsSync(charDir)) return {
        success: false,
        error: i18n.t("backend.persist.service.characterDirectoryMissing", {
          characterName
        })
      };
      let totalRestored = 0;
      const modDirs = fs.readdirSync(charDir, {
        withFileTypes: true
      }).filter(e => e.isDirectory());
      for (const modEntry of modDirs) {
        const modDir = path.join(charDir, modEntry.name);
        totalRestored += modsBackups.restorePersistBakFiles(modDir);
      }
      const root = path.dirname(modsPath);
      if (persistTracking.isPersistBridgeEnabled()) {
        for (const modEntry of modDirs) {
          const modDir = path.join(charDir, modEntry.name);
          persistMigration.ensurePersistBridgeMigrationForModDir(root, modDir);
        }
      }
      return {
        success: true,
        restoredCount: totalRestored
      };
    } catch (e) {
      return {
        success: false,
        error: e.message
      };
    }
  });
}
