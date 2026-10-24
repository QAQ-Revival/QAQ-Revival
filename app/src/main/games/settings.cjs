"use strict";

const i18n = require("../../shared/i18n/core.cjs");
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const {
  getRandomLaunchSettings
} = require("../runtime/random-executable.cjs");
const {
  migratePersistSettings
} = require("../persist/settings.cjs");
const configStore = require("../config/store.cjs");
const coreLogger = require("../core/logger.cjs");
const gamesDefinitions = require("./definitions.cjs");
const installPaths = require("../install/paths.cjs");
const marketAccess = require("../market/access.cjs");
const marketSettings = require("../market/settings.cjs");
const systemPaths = require("../system/paths.cjs");
function getBuiltInGameDefinition(gameId2) {
  return gamesDefinitions.BUILTIN_GAME_MAP.get(gameId2) || null;
}
function getBuiltInGameImagePath(fileName) {
  const candidates = [path.join(electron.app.getAppPath(), "resources", "pics", "games", fileName), path.join(process.resourcesPath || "", "pics", "games", fileName)].filter(Boolean);
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch (_) {}
  }
  return null;
}
function getImageDataUrl(filePath) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return null;
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp"
    }[ext] || "image/png";
    return `data:${mimeType};base64,${fs.readFileSync(filePath).toString("base64")}`;
  } catch (_) {
    return null;
  }
}
function createBuiltInGameConfig(definition, overrides = {}) {
  return {
    id: definition.id,
    name: definition.name,
    shortName: definition.shortName,
    description: definition.description,
    gamePath: "",
    officialLauncherPath: "",
    modLoaderPath: "",
    dx12LauncherPath: "",
    modFolderPath: definition.id === "arknights" ? path.join(electron.app.getPath("userData"), "arknights", "Mods") : "",
    launchMode: definition.defaultLaunchMode,
    supportedLaunchModes: definition.supportedLaunchModes || ["XXMI"],
    launchArgs: definition.defaultLaunchArgs || "",
    icon: definition.imageFile,
    marketGameId: definition.marketGameId,
    isBuiltIn: true,
    ...overrides
  };
}
function ensureBuiltInGamesConfigured() {
  let changed = false;
  if (!Array.isArray(configStore.currentConfig.games)) {
    configStore.currentConfig.games = [];
    changed = true;
  }
  const legacyEndfieldOverrides = {
    modFolderPath: configStore.currentConfig.modsPath || "",
    gamePath: configStore.currentConfig.gamePath || "",
    modLoaderPath: configStore.currentConfig.xxmiPath || configStore.currentConfig.efmiPath || configStore.currentConfig.loaderPath || ""
  };
  for (const definition of gamesDefinitions.BUILTIN_GAMES) {
    let game = configStore.currentConfig.games.find(item => item.id === definition.id || item.name === definition.name);
    if (!game) {
      game = createBuiltInGameConfig(definition, definition.id === "endfield" ? legacyEndfieldOverrides : {});
      configStore.currentConfig.games.push(game);
      changed = true;
      continue;
    }
    const normalizedGame = createBuiltInGameConfig(definition, game);
    const keys = Object.keys(normalizedGame);
    for (const key of keys) {
      if (game[key] !== normalizedGame[key]) {
        game[key] = normalizedGame[key];
        changed = true;
      }
    }
    const expectedSupportedLaunchModes = definition.supportedLaunchModes || ["XXMI"];
    if (JSON.stringify(game.supportedLaunchModes || []) !== JSON.stringify(expectedSupportedLaunchModes)) {
      game.supportedLaunchModes = [...expectedSupportedLaunchModes];
      changed = true;
    }
    if (game.launchMode && !expectedSupportedLaunchModes.includes(game.launchMode)) {
      game.launchMode = definition.defaultLaunchMode;
      changed = true;
    }
    if (definition.defaultLaunchArgs && !String(game.launchArgs || "").trim()) {
      game.launchArgs = definition.defaultLaunchArgs;
      changed = true;
    }
    if (game.dx12LauncherPath === void 0) {
      game.dx12LauncherPath = "";
      changed = true;
    }
    if (game.nevernessDx12DisabledModsDir === void 0) {
      game.nevernessDx12DisabledModsDir = "";
      changed = true;
    }
    if (game.icon !== definition.imageFile && !getBuiltInGameImagePath(game.icon || "")) {
      game.icon = definition.imageFile;
      changed = true;
    }
    if (definition.id === "endfield") {
      if (!game.modFolderPath && legacyEndfieldOverrides.modFolderPath) {
        game.modFolderPath = legacyEndfieldOverrides.modFolderPath;
        changed = true;
      }
      if (!game.gamePath && legacyEndfieldOverrides.gamePath) {
        game.gamePath = legacyEndfieldOverrides.gamePath;
        changed = true;
      }
      if (!game.modLoaderPath && legacyEndfieldOverrides.modLoaderPath) {
        game.modLoaderPath = legacyEndfieldOverrides.modLoaderPath;
        changed = true;
      }
    }
  }
  if (migratePersistSettings(configStore.currentConfig)) changed = true;
  // Always retain an accessible selection, including after loading older backups.
  let visibleGames = configStore.currentConfig.games.filter(game => game.hidden !== true);
  if (!visibleGames.length) {
    configStore.currentConfig.games[0].hidden = false;
    visibleGames = [configStore.currentConfig.games[0]];
    changed = true;
  }
  const validIds = new Set(visibleGames.map(game => game.id));
  if (!configStore.currentConfig.activeGameId || !validIds.has(configStore.currentConfig.activeGameId)) {
    configStore.currentConfig.activeGameId = validIds.has("endfield") ? "endfield" : visibleGames[0].id;
    changed = true;
  }
  if (changed) {
    configStore.saveConfig(configStore.currentConfig);
  }
}
function serializeGameForRenderer(game) {
  const definition = getBuiltInGameDefinition(game.id);
  const iconPath = getBuiltInGameImagePath(game.icon || "") || getBuiltInGameImagePath(definition?.imageFile || "");
  return {
    ...game,
    description: game.description || definition?.description || "",
    shortName: game.shortName || definition?.shortName || game.name,
    marketGameId: game.marketGameId || definition?.marketGameId || game.id,
    supportedLaunchModes: definition?.supportedLaunchModes || game.supportedLaunchModes || ["XXMI"],
    modLoaderLabel: definition?.modLoaderLabel || i18n.t("backend.games.settings.modLoader"),
    executableHint: definition?.executableHint || i18n.t("backend.games.settings.gameExecutable"),
    coverUrl: getImageDataUrl(iconPath)
  };
}
function getResolvedGamePaths(gameId2 = getActiveGameScopeId()) {
  const targetGame = getGameById(gameId2);
  if (targetGame) {
    const allowLegacyFallback = targetGame.id === "endfield";
    return {
      activeGame: targetGame,
      modsPath: targetGame.modFolderPath || (allowLegacyFallback ? configStore.currentConfig.modsPath || "" : ""),
      gamePath: targetGame.gamePath || (allowLegacyFallback ? configStore.currentConfig.gamePath || "" : ""),
      modLoaderPath: targetGame.modLoaderPath || (allowLegacyFallback ? configStore.currentConfig.xxmiPath || configStore.currentConfig.efmiPath || configStore.currentConfig.loaderPath || "" : "")
    };
  }
  const activeGame = getActiveGame();
  if (String(gameId2 || "").trim() && activeGame?.id && activeGame.id !== gameId2) {
    return {
      activeGame: null,
      modsPath: "",
      gamePath: "",
      modLoaderPath: ""
    };
  }
  return {
    activeGame,
    modsPath: configStore.currentConfig.modsPath || "",
    gamePath: configStore.currentConfig.gamePath || "",
    modLoaderPath: configStore.currentConfig.xxmiPath || configStore.currentConfig.efmiPath || configStore.currentConfig.loaderPath || ""
  };
}
function getSettingsGame(gameId) {
  const game = gameId === undefined ? getActiveGame() : getGameById(gameId);
  if (!game) throw new Error(i18n.t("backend.games.settings.gameConfigMissing"));
  return game;
}
function updateActiveGameConfig(updates, gameId) {
  const activeGame = gameId === undefined ? getActiveGame() : getSettingsGame(gameId);
  if (activeGame) {
    if (activeGame.id === "arknights") require("./arknights/service.cjs").validateLibrary(updates.modFolderPath || activeGame.modFolderPath, updates.gamePath || activeGame.gamePath);
    Object.entries(updates || {}).forEach(([key, value]) => {
      activeGame[key] = value;
    });
    if (activeGame.id === "endfield") {
      if (updates.modFolderPath !== void 0) configStore.currentConfig.modsPath = updates.modFolderPath;
      if (updates.gamePath !== void 0) configStore.currentConfig.gamePath = updates.gamePath;
      if (updates.modLoaderPath !== void 0) {
        configStore.currentConfig.xxmiPath = updates.modLoaderPath;
        configStore.currentConfig.efmiPath = updates.modLoaderPath;
        configStore.currentConfig.loaderPath = updates.modLoaderPath;
      }
    }
    configStore.saveConfig(configStore.currentConfig);
    notifyGamesChanged();
    return activeGame;
  }
  if (updates.modFolderPath !== void 0) configStore.currentConfig.modsPath = updates.modFolderPath;
  if (updates.gamePath !== void 0) configStore.currentConfig.gamePath = updates.gamePath;
  if (updates.modLoaderPath !== void 0) {
    configStore.currentConfig.xxmiPath = updates.modLoaderPath;
    configStore.currentConfig.efmiPath = updates.modLoaderPath;
    configStore.currentConfig.loaderPath = updates.modLoaderPath;
  }
  configStore.saveConfig(configStore.currentConfig);
  notifyGamesChanged();
  return null;
}
const KNOWN_IMPORTER_MODS_DIRS = ["WWMI", "SRMI", "ZZMI", "EFMI", "GIMI", "NEMI", "XXMI"];
function normalizeResolvedPathKey(targetPath) {
  const resolved = path.resolve(targetPath || "");
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}
function isExistingDirectory(targetPath) {
  try {
    return !!targetPath && fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory();
  } catch (_) {
    return false;
  }
}
function isModsFolderName(folderName) {
  return String(folderName || "").toLowerCase() === "mods";
}
function getPreferredImporterNamesForGame(gameId2 = getActiveGameScopeId()) {
  const definition = getBuiltInGameDefinition(gameId2);
  const preferred = [];
  const add = name => {
    if (!name || !KNOWN_IMPORTER_MODS_DIRS.includes(name) || preferred.includes(name)) return;
    preferred.push(name);
  };
  add(definition?.defaultLaunchMode);
  (definition?.supportedLaunchModes || []).forEach(add);
  KNOWN_IMPORTER_MODS_DIRS.forEach(add);
  return preferred;
}
function addModsFolderCandidate(candidates, candidatePath, rank, label) {
  if (!isExistingDirectory(candidatePath) || !isModsFolderName(path.basename(candidatePath))) return;
  const resolvedPath = path.resolve(candidatePath);
  const key = normalizeResolvedPathKey(resolvedPath);
  const existing = candidates.get(key);
  if (!existing || rank < existing.rank) {
    candidates.set(key, {
      path: resolvedPath,
      rank,
      label
    });
  }
}
function resolveSelectedModsFolder(selectedPath, {
  gameId: gameId2 = getActiveGameScopeId()
} = {}) {
  if (!isExistingDirectory(selectedPath)) {
    return {
      ok: false,
      error: i18n.t("backend.games.settings.existingFolderRequired")
    };
  }
  const basePath = path.resolve(selectedPath);
  if (gameId2 === "arknights") {
    try {
      require("./arknights/service.cjs").validateLibrary(basePath);
      return { ok: true, path: basePath, modsPath: basePath, originalPath: basePath, adjusted: false };
    } catch (error) { return { ok: false, error: error.message }; }
  }
  const candidates = new Map();
  let current = basePath;
  for (let depth = 0; depth < 6; depth++) {
    addModsFolderCandidate(candidates, current, depth, depth === 0 ? i18n.t("backend.games.settings.currentFolder") : i18n.t("backend.games.settings.parentModsFolder"));
    const parent2 = path.dirname(current);
    if (!parent2 || parent2 === current) break;
    current = parent2;
  }
  addModsFolderCandidate(candidates, path.join(basePath, "Mods"), 20, i18n.t("backend.games.settings.childModsFolder"));
  const preferredImporters = getPreferredImporterNamesForGame(gameId2);
  preferredImporters.forEach((importerName, index) => {
    const rank = index === 0 ? 30 : 40 + index;
    addModsFolderCandidate(candidates, path.join(basePath, importerName, "Mods"), rank, i18n.t("backend.games.settings.importerModsFolder", {
      importerName
    }));
  });
  try {
    const entries = fs.readdirSync(basePath, {
      withFileTypes: true
    });
    entries.filter(entry => entry.isDirectory()).forEach(entry => {
      const importerIndex = preferredImporters.indexOf(entry.name);
      const rank = importerIndex >= 0 ? 40 + importerIndex : 80;
      addModsFolderCandidate(candidates, path.join(basePath, entry.name, "Mods"), rank, i18n.t("backend.games.settings.importerModsFolder", {
        importerName: entry.name
      }));
      preferredImporters.forEach((importerName, index) => {
        addModsFolderCandidate(candidates, path.join(basePath, entry.name, importerName, "Mods"), 120 + index, i18n.t("backend.games.settings.nestedImporterModsFolder", {
          name: entry.name,
          importerName
        }));
      });
    });
  } catch (_) {}
  let parent = path.dirname(basePath);
  for (let level = 0; level < 2; level++) {
    if (!parent || parent === basePath) break;
    addModsFolderCandidate(candidates, path.join(parent, "Mods"), 90 + level * 20, i18n.t("backend.games.settings.siblingModsFolder"));
    preferredImporters.forEach((importerName, index) => {
      addModsFolderCandidate(candidates, path.join(parent, importerName, "Mods"), 100 + level * 20 + index, i18n.t("backend.games.settings.importerModsFolder", {
        importerName
      }));
    });
    const nextParent = path.dirname(parent);
    if (!nextParent || nextParent === parent) break;
    parent = nextParent;
  }
  const sortedCandidates = Array.from(candidates.values()).sort((left, right) => {
    if (left.rank !== right.rank) return left.rank - right.rank;
    return left.path.length - right.path.length;
  });
  if (sortedCandidates.length === 0) {
    return {
      ok: false,
      error: i18n.t("backend.games.settings.modsFolderNotFound")
    };
  }
  const best = sortedCandidates[0];
  const tied = sortedCandidates.filter(candidate => candidate.rank === best.rank);
  if (tied.length > 1) {
    return {
      ok: false,
      error: i18n.t("backend.games.settings.ambiguousModsFolders"),
      candidates: tied.map(candidate => candidate.path)
    };
  }
  return {
    ok: true,
    path: best.path,
    modsPath: best.path,
    originalPath: basePath,
    adjusted: !systemPaths.isSameResolvedPath(best.path, basePath),
    label: best.label
  };
}
function shouldResolveFolderSelectionAsMods(title, options = {}) {
  if (options?.modsFolder) return true;
  return /\bmods\b/i.test(String(title || ""));
}
function readXxmiImporterPathInfo(modLoaderPath, gameId2) {
  const importerName = getBuiltInGameDefinition(gameId2)?.defaultLaunchMode || "";
  const supported = installPaths.BUNDLED_GAME_IMPORTERS.includes(importerName);
  if (!supported) {
    return {
      supported: false,
      importerName,
      status: "unsupported",
      importerPath: ""
    };
  }
  const xxmiRootDir = installPaths.resolveXxmiRootFromLauncherPath(modLoaderPath);
  if (!xxmiRootDir) {
    return {
      supported: true,
      importerName,
      status: "launcher-path-invalid",
      importerPath: ""
    };
  }
  const configPath = path.join(xxmiRootDir, "XXMI Launcher Config.json");
  if (!fs.existsSync(configPath)) {
    return {
      supported: true,
      importerName,
      status: "config-missing",
      xxmiRootDir,
      configPath,
      importerPath: ""
    };
  }
  try {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const configuredPath = String(config?.Importers?.[importerName]?.Importer?.importer_folder || "").trim();
    if (!configuredPath) {
      return {
        supported: true,
        importerName,
        status: "importer-unconfigured",
        xxmiRootDir,
        configPath,
        importerPath: ""
      };
    }
    return {
      supported: true,
      importerName,
      status: "configured",
      xxmiRootDir,
      configPath,
      gameFolder: String(config?.Importers?.[importerName]?.Importer?.game_folder || "").trim(),
      importerPath: path.resolve(xxmiRootDir, configuredPath)
    };
  } catch (error) {
    coreLogger.logger.warn(`Failed to read XXMI importer path from ${configPath}:`, error?.message || error);
    return {
      supported: true,
      importerName,
      status: "config-invalid",
      xxmiRootDir,
      configPath,
      importerPath: ""
    };
  }
}
function buildRendererConfig() {
  ensureBuiltInGamesConfigured();
  const {
    activeGame,
    modsPath,
    gamePath,
    modLoaderPath
  } = getResolvedActiveGamePaths();
  const xxmiImporterInfo = readXxmiImporterPathInfo(modLoaderPath, activeGame?.id);
  return {
    ...configStore.currentConfig,
    randomLaunch: getRandomLaunchSettings(configStore.currentConfig),
    compatibilityMode: configStore.isCompatibilityModeEnabled(),
    compatibilityLevel: configStore.getCompatibilityLevel(),
    activeGame: activeGame ? serializeGameForRenderer(activeGame) : null,
    modsPath,
    gamePath,
    xxmiPath: modLoaderPath,
    modLoaderPath,
    xxmiImporterInfo,
    games: (configStore.currentConfig.games || []).map(serializeGameForRenderer)
  };
}
function notifyGamesChanged() {
  const payload = {
    activeGameId: configStore.currentConfig.activeGameId,
    activeGame: getActiveGame() ? serializeGameForRenderer(getActiveGame()) : null,
    games: (configStore.currentConfig.games || []).map(serializeGameForRenderer)
  };
  electron.BrowserWindow.getAllWindows().forEach(window => {
    if (!window.isDestroyed()) {
      window.webContents.send("games-changed", payload);
    }
  });
}
function getResolvedActiveGamePaths() {
  return getResolvedGamePaths(getActiveGameScopeId());
}
function getActiveGame() {
  if (configStore.currentConfig.activeGameId && configStore.currentConfig.games && configStore.currentConfig.games.length > 0) {
    return configStore.currentConfig.games.find(g => g.id === configStore.currentConfig.activeGameId) || null;
  }
  return null;
}
function getGameById(gameId2 = getActiveGameScopeId()) {
  const normalizedGameId = String(gameId2 || "").trim();
  if (!normalizedGameId || !Array.isArray(configStore.currentConfig.games)) return null;
  return configStore.currentConfig.games.find(game => game.id === normalizedGameId) || null;
}
function getActiveGameScopeId() {
  return getActiveGame()?.id || configStore.currentConfig.activeGameId || "endfield";
}
function normalizeMarketGameId(gameId2) {
  const normalized = String(gameId2 || "").trim();
  if (!normalized) {
    return "endfield";
  }
  return normalized;
}
function getMarketGameId(gameId2 = getActiveGameScopeId()) {
  const normalizedGameId = normalizeMarketGameId(gameId2);
  const game = configStore.currentConfig.games?.find(entry => entry.id === normalizedGameId);
  return game?.marketGameId || getBuiltInGameDefinition(normalizedGameId)?.marketGameId || normalizedGameId;
}
function getModCachePath(gameId2 = getActiveGameScopeId()) {
  const marketGameId = normalizeMarketGameId(getMarketGameId(gameId2));
  if (marketGameId === "endfield") {
    return marketSettings.LEGACY_MOD_CACHE_PATH;
  }
  return path.join(electron.app.getPath("userData"), `mod-market-cache-${marketGameId}.json`);
}
const CACHE_SCHEMA_VERSION = 5;
function normalizeCachePayload(cache) {
  return {
    mods: Array.isArray(cache?.mods) ? cache.mods : [],
    lastSyncTimestamp: cache?.lastSyncTimestamp || null,
    marketVersion: cache?.marketVersion || null,
    responseRevision: Number.isFinite(cache?.responseRevision) ? cache.responseRevision : 0,
    marketAccess: marketAccess.normalizeMarketAccessPayload(cache?.marketAccess),
    authScope: String(cache?.authScope || ""),
    accessCheckedAt: cache?.accessCheckedAt || null,
    schemaVersion: Number.isFinite(cache?.schemaVersion) ? cache.schemaVersion : 0
  };
}
function getScopedCharacterOrder() {
  const gameId2 = getActiveGameScopeId();
  if (Array.isArray(configStore.currentConfig.characterOrdersByGame?.[gameId2])) {
    return configStore.currentConfig.characterOrdersByGame[gameId2];
  }
  if (gameId2 === "endfield" && Array.isArray(configStore.currentConfig.characterOrder)) {
    return configStore.currentConfig.characterOrder;
  }
  return [];
}
function setScopedCharacterOrder(characterOrder) {
  const gameId2 = getActiveGameScopeId();
  if (!configStore.currentConfig.characterOrdersByGame || typeof configStore.currentConfig.characterOrdersByGame !== "object") {
    configStore.currentConfig.characterOrdersByGame = {};
  }
  configStore.currentConfig.characterOrdersByGame[gameId2] = Array.isArray(characterOrder) ? characterOrder : [];
  if (gameId2 === "endfield") {
    configStore.currentConfig.characterOrder = configStore.currentConfig.characterOrdersByGame[gameId2];
  }
  configStore.saveConfig(configStore.currentConfig);
}
function getModsPath(gameId2 = getActiveGameScopeId()) {
  return getResolvedGamePaths(gameId2).modsPath || "";
}
function getModsPathStatus({
  requireExisting = true,
  gameId: gameId2 = getActiveGameScopeId()
} = {}) {
  const modsPath = getModsPath(gameId2);
  if (!modsPath) {
    return {
      ok: false,
      code: "MODS_PATH_NOT_SET",
      error: i18n.t("backend.games.settings.modsPathNotConfigured")
    };
  }
  if (requireExisting && !fs.existsSync(modsPath)) {
    return {
      ok: false,
      code: "MODS_PATH_NOT_FOUND",
      error: i18n.t("backend.games.settings.modsPathMissing")
    };
  }
  return {
    ok: true,
    modsPath
  };
}
function getModAddedAtScopeKey() {
  const activeGame = getActiveGame();
  if (activeGame?.id) return `game:${activeGame.id}`;
  const modsPath = getModsPath();
  if (modsPath) return `mods:${modsPath}`;
  return "__default__";
}
function getDirectoryBirthtimeMs(dirPath) {
  try {
    const stats = fs.statSync(dirPath);
    if (Number.isFinite(stats.birthtimeMs) && stats.birthtimeMs > 0) {
      return Math.round(stats.birthtimeMs);
    }
    if (Number.isFinite(stats.mtimeMs) && stats.mtimeMs > 0) {
      return Math.round(stats.mtimeMs);
    }
  } catch (_) {}
  return Date.now();
}
function createModAddedAtAccessor() {
  if (!configStore.currentConfig.modAddedAt || typeof configStore.currentConfig.modAddedAt !== "object") {
    configStore.currentConfig.modAddedAt = {};
  }
  const scopeKey = getModAddedAtScopeKey();
  if (!configStore.currentConfig.modAddedAt[scopeKey] || typeof configStore.currentConfig.modAddedAt[scopeKey] !== "object") {
    configStore.currentConfig.modAddedAt[scopeKey] = {};
  }
  const scopeStore = configStore.currentConfig.modAddedAt[scopeKey];
  let dirty = false;
  return {
    get(characterName, modName, modDirPath) {
      const key = `${characterName}/${modName}`;
      if (!Number.isFinite(scopeStore[key])) {
        scopeStore[key] = getDirectoryBirthtimeMs(modDirPath);
        dirty = true;
      }
      const addedAtMs = scopeStore[key];
      return {
        addedAtMs,
        addedAt: new Date(addedAtMs).toISOString()
      };
    },
    saveIfDirty() {
      if (dirty) {
        configStore.saveConfig(configStore.currentConfig);
      }
    }
  };
}
function initialize() {
  ensureBuiltInGamesConfigured();
}
module.exports = {
  initialize,
  getBuiltInGameDefinition,
  createBuiltInGameConfig,
  ensureBuiltInGamesConfigured,
  serializeGameForRenderer,
  getResolvedGamePaths,
  getSettingsGame,
  updateActiveGameConfig,
  isExistingDirectory,
  resolveSelectedModsFolder,
  shouldResolveFolderSelectionAsMods,
  readXxmiImporterPathInfo,
  buildRendererConfig,
  notifyGamesChanged,
  getResolvedActiveGamePaths,
  getActiveGame,
  getGameById,
  getActiveGameScopeId,
  normalizeMarketGameId,
  getMarketGameId,
  getModCachePath,
  normalizeCachePayload,
  getScopedCharacterOrder,
  setScopedCharacterOrder,
  getModsPath,
  getModsPathStatus,
  createModAddedAtAccessor,
  CACHE_SCHEMA_VERSION
};
