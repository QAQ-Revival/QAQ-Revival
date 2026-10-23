"use strict";

module.exports = {
  isPersistBridgeEnabled,
  getPersistBridgeGameIdForRoot,
  updateActivePersistBridgeIncludesIncremental,
  extractHostedPersistStateFilesFromContent,
  collectHostedPersistStateFilesForModDir,
  rebuildActivePersistBridgeIncludes,
  syncPersistBridgeStateForModDir
};
const path = require("path");
const fs = require("fs");
const configStore = require("../config/store.cjs");
const coreLogger = require("../core/logger.cjs");
const gamesEnvironment = require("../games/environment.cjs");
const gamesSettings = require("../games/settings.cjs");
const modsIniFiles = require("../mods/ini-files.cjs");
const persistLayout = require("./layout.cjs");
const persistService = require("./service.cjs");
function isPersistBridgeEnabled(gameId = gamesSettings.getActiveGameScopeId()) {
  return configStore.currentConfig.persistBridgeByGame?.[gameId]?.enabled === true;
}
function getPersistBridgeGameIdForRoot(root) {
  const resolvedRoot = path.resolve(root).toLowerCase();
  return configStore.currentConfig.games.find(game => {
    const mods = gamesSettings.getModsPath(game.id);
    return mods && path.dirname(path.resolve(mods)).toLowerCase() === resolvedRoot;
  })?.id;
}
function getPersistBridgeTrackingKey(root) {
  return String(root || "").trim().toLowerCase();
}
function normalizePersistBridgeStateFileList(list) {
  const stateFiles = Array.isArray(list) ? list : [];
  const normalized = [];
  const seen = new Set();
  for (const item of stateFiles) {
    const fileName = persistLayout.extractPersistBridgeStateFileName(item);
    if (!fileName) continue;
    if (seen.has(fileName)) continue;
    seen.add(fileName);
    normalized.push(fileName);
  }
  return normalized;
}
function ensurePersistBridgeTrackingStore() {
  if (!configStore.currentConfig.persistBridgeTracking || typeof configStore.currentConfig.persistBridgeTracking !== "object") {
    configStore.currentConfig.persistBridgeTracking = {};
  }
  return configStore.currentConfig.persistBridgeTracking;
}
function getPersistBridgeTrackingState(root) {
  const trackingStore = ensurePersistBridgeTrackingStore();
  const trackingKey = getPersistBridgeTrackingKey(root);
  const storedState = trackingStore[trackingKey] || {};
  const enabledStateFiles = normalizePersistBridgeStateFileList(storedState.enabledStateFiles);
  const enabledSet = new Set(enabledStateFiles);
  const recentStateFiles = normalizePersistBridgeStateFileList(storedState.recentStateFiles).filter(stateFile => !enabledSet.has(stateFile));
  return {
    enabledStateFiles,
    recentStateFiles
  };
}
function setPersistBridgeTrackingState(root, state, save = true) {
  if (!root) return {
    enabledStateFiles: [],
    recentStateFiles: []
  };
  const trackingStore = ensurePersistBridgeTrackingStore();
  const trackingKey = getPersistBridgeTrackingKey(root);
  const normalizedState = getPersistBridgeTrackingStateFromValue(state);
  const existingState = getPersistBridgeTrackingState(root);
  const changed = existingState.enabledStateFiles.length !== normalizedState.enabledStateFiles.length || existingState.recentStateFiles.length !== normalizedState.recentStateFiles.length || existingState.enabledStateFiles.some((item, index) => item !== normalizedState.enabledStateFiles[index]) || existingState.recentStateFiles.some((item, index) => item !== normalizedState.recentStateFiles[index]);
  trackingStore[trackingKey] = normalizedState;
  if (changed && save) {
    configStore.saveConfig(configStore.currentConfig);
  }
  return normalizedState;
}
function getPersistBridgeTrackingStateFromValue(state) {
  const enabledStateFiles = normalizePersistBridgeStateFileList(state?.enabledStateFiles);
  const enabledSet = new Set(enabledStateFiles);
  const recentStateFiles = normalizePersistBridgeStateFileList(state?.recentStateFiles).filter(stateFile => !enabledSet.has(stateFile));
  return {
    enabledStateFiles,
    recentStateFiles
  };
}
function writeActivePersistBridgeIncludeFromState(root, state, saveTracking = true) {
  if (!root) return [];
  persistLayout.ensureQaqmBridgeDir(root);
  const normalizedState = setPersistBridgeTrackingState(root, state, saveTracking);
  const finalStateFiles = isPersistBridgeEnabled(getPersistBridgeGameIdForRoot(root)) ? [...normalizedState.enabledStateFiles, ...normalizedState.recentStateFiles].filter(name => fs.existsSync(persistLayout.resolvePersistBridgeStatePath(root, name))) : [];
  let content = "";
  for (const stateFile of finalStateFiles) {
    const includeTarget = persistLayout.getPersistBridgeStateIncludeTarget(stateFile);
    if (!includeTarget) continue;
    content = persistLayout.ensureIncludeEntry(content, persistLayout.getStateBridgeIncludeSectionName(stateFile), includeTarget);
  }
  persistLayout.writeFileIfChanged(persistLayout.getQaqmBridgeFilePath(root, persistLayout.PERSIST_ACTIVE_INCLUDE_FILE), content);
  return finalStateFiles;
}
function ensurePersistBridgeTrackingState(root) {
  if (!root) return {
    enabledStateFiles: [],
    recentStateFiles: []
  };
  const trackingKey = getPersistBridgeTrackingKey(root);
  const trackingStore = ensurePersistBridgeTrackingStore();
  if (!trackingStore[trackingKey]) {
    rebuildActivePersistBridgeIncludes(root);
  }
  return getPersistBridgeTrackingState(root);
}
function updateActivePersistBridgeIncludesIncremental(root, updates = {}) {
  if (!root) return [];
  const currentState = ensurePersistBridgeTrackingState(root);
  const enableStateFiles = normalizePersistBridgeStateFileList(updates.enableStateFiles);
  const disableStateFiles = normalizePersistBridgeStateFileList(updates.disableStateFiles);
  const removeStateFiles = normalizePersistBridgeStateFileList(updates.removeStateFiles);
  const enableSet = new Set(enableStateFiles);
  const disableSet = new Set(disableStateFiles);
  const removeSet = new Set(removeStateFiles);
  const nextEnabledStateFiles = [...enableStateFiles, ...currentState.enabledStateFiles.filter(stateFile => !enableSet.has(stateFile) && !disableSet.has(stateFile) && !removeSet.has(stateFile))];
  let nextRecentStateFiles = currentState.recentStateFiles.filter(stateFile => !enableSet.has(stateFile) && !disableSet.has(stateFile) && !removeSet.has(stateFile));
  if (disableStateFiles.length > 0) {
    nextRecentStateFiles = [...nextRecentStateFiles, ...disableStateFiles];
  }
  return writeActivePersistBridgeIncludeFromState(root, {
    enabledStateFiles: nextEnabledStateFiles,
    recentStateFiles: nextRecentStateFiles
  });
}
function extractHostedPersistStateFilesFromContent(content) {
  const matches = String(content || "").matchAll(/^[ \t]*;[ \t]*Persisted state is hosted by[ \t]+([^\r\n;]+)$/gim);
  const stateFiles = new Set();
  for (const match of matches) {
    const fileName = persistLayout.extractPersistBridgeStateFileName(match[1]);
    if (fileName) {
      stateFiles.add(fileName);
    }
  }
  return Array.from(stateFiles);
}
function collectHostedPersistStateFilesForModDir(modDirPath) {
  const stateFiles = new Set();
  if (!modDirPath || !fs.existsSync(modDirPath)) return [];
  const iniFiles = modsIniFiles.getIniFiles(modDirPath);
  for (const iniPath of iniFiles) {
    try {
      const content = fs.readFileSync(iniPath, "utf-8");
      for (const stateFile of extractHostedPersistStateFilesFromContent(content)) {
        stateFiles.add(stateFile);
      }
    } catch (_) {}
  }
  return Array.from(stateFiles).sort((left, right) => left.localeCompare(right));
}
function rebuildActivePersistBridgeIncludes(root) {
  if (!root) return [];
  const enabledStateFiles = new Set();
  const modsRoot = gamesSettings.getModsPath(getPersistBridgeGameIdForRoot(root)) || path.join(root, "Mods");
  if (fs.existsSync(modsRoot)) {
    try {
      const characterDirs = fs.readdirSync(modsRoot, {
        withFileTypes: true
      }).filter(entry => entry.isDirectory());
      for (const characterDir of characterDirs) {
        const charPath = path.join(modsRoot, characterDir.name);
        const modDirs = fs.readdirSync(charPath, {
          withFileTypes: true
        }).filter(entry => entry.isDirectory() && !entry.name.startsWith("DISABLED_"));
        for (const modDir of modDirs) {
          for (const stateFile of collectHostedPersistStateFilesForModDir(path.join(charPath, modDir.name))) {
            enabledStateFiles.add(stateFile);
          }
        }
      }
    } catch (e) {
      coreLogger.logger.warn("Failed to rebuild active persist bridge set:", e?.message || e);
    }
  }
  const activeIncludePath = persistLayout.getQaqmBridgeFilePath(root, persistLayout.PERSIST_ACTIVE_INCLUDE_FILE);
  const existingStateFiles = persistLayout.readPersistBridgeStateFilesFromInclude(activeIncludePath);
  const existingCachedStateFiles = existingStateFiles.filter(stateFile => !enabledStateFiles.has(stateFile));
  const trackedState = getPersistBridgeTrackingState(root);
  const stateDir = persistLayout.getPersistBridgeStateDir(root);
  const savedFiles = fs.existsSync(stateDir) ? fs.readdirSync(stateDir).filter(name => persistLayout.PERSIST_BRIDGE_STATE_FILE_REGEX.test(name)) : [];
  const recentStateFiles = normalizePersistBridgeStateFileList([...trackedState.recentStateFiles, ...trackedState.enabledStateFiles, ...existingCachedStateFiles, ...savedFiles]).filter(name => !enabledStateFiles.has(name) && fs.existsSync(persistLayout.resolvePersistBridgeStatePath(root, name)));
  return writeActivePersistBridgeIncludeFromState(root, {
    enabledStateFiles: Array.from(enabledStateFiles).sort((left, right) => left.localeCompare(right)),
    recentStateFiles
  });
}
function syncPersistBridgeStateForModDir(modDirPath, gameId = gamesSettings.getActiveGameScopeId()) {
  if (!isPersistBridgeEnabled(gameId)) return {
    synced: false,
    fileCount: 0
  };
  const env = gamesEnvironment.resolveActiveGameEnvRoot(gameId);
  const d3dxUserPath = env && path.join(env.root, "d3dx_user.ini");
  if (!env || !d3dxUserPath || !fs.existsSync(d3dxUserPath) || !modDirPath || !fs.existsSync(modDirPath)) {
    return {
      synced: false,
      fileCount: 0
    };
  }
  const stateFiles = collectHostedPersistStateFilesForModDir(modDirPath);
  if (stateFiles.length === 0) {
    return {
      synced: false,
      fileCount: 0
    };
  }
  const {
    constantsMap
  } = persistService.readD3dxUserConstants(d3dxUserPath);
  let updatedFiles = 0;
  for (const stateFile of stateFiles) {
    const statePath = persistLayout.resolvePersistBridgeStatePath(env.root, stateFile);
    if (!fs.existsSync(statePath)) continue;
    try {
      const originalContent = fs.readFileSync(statePath, "utf-8");
      const lines = originalContent.replace(/\r\n/g, "\n").split("\n");
      const namespaceLine = lines.find(line => /^\s*namespace\s*=/.test(line));
      const namespaceMatch = namespaceLine?.match(/^\s*namespace\s*=\s*(.+?)\s*$/i);
      const namespace = namespaceMatch?.[1]?.trim();
      if (!namespace) continue;
      let changed = false;
      const nextLines = lines.map(line => {
        const persistMatch = line.match(/^\s*global\s+persist\s+\$([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
        if (!persistMatch) return line;
        const variableName = persistMatch[1];
        const rawKey = `$\\${namespace}\\${variableName}`;
        const currentEntry = constantsMap.get(persistService.normalizeD3dxUserKey(rawKey));
        if (!currentEntry) return line;
        const nextLine = `global persist $${variableName} = ${currentEntry.value}`;
        if (nextLine !== line.trim()) {
          changed = true;
        }
        return nextLine;
      });
      if (changed) {
        fs.writeFileSync(statePath, `${nextLines.join("\n").replace(/\n+$/, "")}
`, "utf-8");
        updatedFiles += 1;
      }
    } catch (e) {
      coreLogger.logger.warn(`Failed to sync persist bridge state file ${stateFile}:`, e?.message || e);
    }
  }
  return {
    synced: updatedFiles > 0,
    fileCount: updatedFiles
  };
}
