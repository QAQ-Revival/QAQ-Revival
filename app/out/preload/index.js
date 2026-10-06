"use strict";
const electron = require("electron");
const preload = require("@electron-toolkit/preload");
const api = {
  getWindowState: () => electron.ipcRenderer.invoke("window:get-state"),
  controlWindow: (action) => electron.ipcRenderer.invoke("window:control", action),
  onWindowState: (callback) => {
    const listener = (_, state) => callback(state);
    electron.ipcRenderer.on("window:state", listener);
    return () => electron.ipcRenderer.removeListener("window:state", listener);
  },
  getConfig: () => electron.ipcRenderer.invoke("get-config"),
  getRuntimeInfo: () => electron.ipcRenderer.invoke("get-runtime-info"),
  gameGetSettings: (gameId) => electron.ipcRenderer.invoke("game:get-settings", gameId),
  selectModsFolder: (gameId) => electron.ipcRenderer.invoke("select-mods-folder", gameId),
  selectGamePath: (gameId) => electron.ipcRenderer.invoke("select-game-path", gameId),
  selectLoaderPath: () => electron.ipcRenderer.invoke("select-loader-path"),
  autoDetectPaths: (gameId) => electron.ipcRenderer.invoke("auto-detect-paths", gameId),
  selectXxmiPath: (gameId) => electron.ipcRenderer.invoke("select-xxmi-path", gameId),
  launchGame: (options) => electron.ipcRenderer.invoke("launch-game", options),
  getCharacters: () => electron.ipcRenderer.invoke("get-characters"),
  previewCharacterOrganization: () => electron.ipcRenderer.invoke("character:organize-preview"),
  refreshCharacters: (options) => electron.ipcRenderer.invoke("character:refresh", options),
  updateCharacterCatalog: (gameId) => electron.ipcRenderer.invoke("character:update-catalog", gameId),
  scanLegacyImport: () => electron.ipcRenderer.invoke("legacy-import:scan"),
  migrateLegacyImport: (options) => electron.ipcRenderer.invoke("legacy-import:migrate", options),
  scanLooseRootFolders: () => electron.ipcRenderer.invoke("mods-root:scan-loose-folders"),
  quarantineLooseRootFolders: (options) => electron.ipcRenderer.invoke("mods-root:quarantine-loose-folders", options || {}),
  moveMisplacedModFolders: (options) => electron.ipcRenderer.invoke("mods-root:move-misplaced-folders", options || {}),
  getMods: (characterName) => electron.ipcRenderer.invoke("get-mods", characterName),
  toggleMod: (characterName, modName, enable) => electron.ipcRenderer.invoke("toggle-mod", { characterName, modName, enable }),
  addMod: (characterName, filePath, modInfo) => electron.ipcRenderer.invoke("add-mod", { characterName, filePath, modInfo }),
  addCharacter: (name, coverImagePath) => electron.ipcRenderer.invoke("add-character", { name, coverImagePath }),
  deleteCharacter: (characterName) => electron.ipcRenderer.invoke("delete-character", characterName),
  renameCharacter: (oldName, newName) => electron.ipcRenderer.invoke("rename-character", { oldName, newName }),
  deleteMod: (characterName, modName) => electron.ipcRenderer.invoke("delete-mod", { characterName, modName }),
  renameMod: (characterName, oldName, newName) => electron.ipcRenderer.invoke("rename-mod", { characterName, oldName, newName }),
  moveModToCharacter: (sourceCharacterName, modName, targetCharacterName, options) => electron.ipcRenderer.invoke("move-mod-to-character", {
    sourceCharacterName,
    modName,
    targetCharacterName,
    ...options || {}
  }),
  getCharacterSections: (characterName) => electron.ipcRenderer.invoke("character-section:list", { characterName }),
  createCharacterSection: (characterName, name, coverImagePath, options) => electron.ipcRenderer.invoke("character-section:create", {
    characterName,
    name,
    coverImagePath,
    ...options || {}
  }),
  updateCharacterSection: (characterName, sectionId, updates) => electron.ipcRenderer.invoke("character-section:update", {
    characterName,
    sectionId,
    ...updates || {}
  }),
  deleteCharacterSection: (characterName, sectionId) => electron.ipcRenderer.invoke("character-section:delete", { characterName, sectionId }),
  setCharacterSectionCover: (characterName, sectionId, imagePath) => electron.ipcRenderer.invoke("character-section:set-cover", { characterName, sectionId, imagePath }),
  assignModToCharacterSection: (characterName, modName, sectionId) => electron.ipcRenderer.invoke("character-section:assign-mod", { characterName, modName, sectionId }),
  getCharacterCover: (characterName) => electron.ipcRenderer.invoke("get-character-cover", characterName),
  setCharacterCover: (characterName, imagePath) => electron.ipcRenderer.invoke("set-character-cover", { characterName, imagePath }),
  openCharacterFolder: (characterName) => electron.ipcRenderer.invoke("open-character-folder", characterName),
  openModFolder: (characterName, modName) => electron.ipcRenderer.invoke("open-mod-folder", { characterName, modName }),
  pinMod: (characterName, modName, pinned) => electron.ipcRenderer.invoke("pin-mod", { characterName, modName, pinned }),
  openExternalUrl: (url) => electron.ipcRenderer.invoke("open-external-url", url),
  openPathInExplorer: (targetPath) => electron.ipcRenderer.invoke("open-path-in-explorer", targetPath),
  getModDetails: (characterName, modName, refresh = false) => electron.ipcRenderer.invoke("get-mod-details", { characterName, modName, refresh }),
  setModPreview: (characterName, modName, imagePath) => electron.ipcRenderer.invoke("set-mod-preview", { characterName, modName, imagePath }),
  setModPreviewFromData: (characterName, modName, dataUrl) => electron.ipcRenderer.invoke("set-mod-preview-from-data", { characterName, modName, dataUrl }),
  // Mod Market APIs (with local cache support)
  pawchiveGetState: () => electron.ipcRenderer.invoke("pawchive:get-state"),
  kemonoGetState: () => electron.ipcRenderer.invoke("kemono:get-state"),
  kemonoListCreators: (options) => electron.ipcRenderer.invoke("kemono:list-creators", options),
  kemonoListPosts: (options) => electron.ipcRenderer.invoke("kemono:list-posts", options),
  kemonoGetPost: (post) => electron.ipcRenderer.invoke("kemono:get-post", post),
  kemonoSetFavorite: (payload) => electron.ipcRenderer.invoke("kemono:set-favorite", payload),
  kemonoMarkRead: (payload) => electron.ipcRenderer.invoke("kemono:mark-read", payload),
  kemonoCheckUpdates: () => electron.ipcRenderer.invoke("kemono:check-updates"),
  kemonoGetUpdates: (options) => electron.ipcRenderer.invoke("kemono:get-updates", options),
  onKemonoStateChanged: (callback) => {
    const handler = (_, state) => callback(state);
    electron.ipcRenderer.on("kemono:state-changed", handler);
    return () => electron.ipcRenderer.removeListener("kemono:state-changed", handler);
  },
  onKemonoProgress: (callback) => {
    const handler = (_, progress) => callback(progress);
    electron.ipcRenderer.on("kemono:progress", handler);
    return () => electron.ipcRenderer.removeListener("kemono:progress", handler);
  },
  megaRevivalDownload: (payload) => electron.ipcRenderer.invoke("mega:revival-download", payload),
  attachmentDownload: (payload) => electron.ipcRenderer.invoke("attachment:download", payload),
  attachmentTasks: () => electron.ipcRenderer.invoke("attachment:list"),
  attachmentControl: (payload) => electron.ipcRenderer.invoke("attachment:control", payload),
  attachmentOpen: (taskId) => electron.ipcRenderer.invoke("attachment:open", { taskId }),
  attachmentImportPaths: (taskId) => electron.ipcRenderer.invoke("attachment:importPaths", { taskId }),
  softwareUpdateState: () => electron.ipcRenderer.invoke('software-update:state'),
  softwareUpdateConfigure: (settings) => electron.ipcRenderer.invoke('software-update:configure', settings),
  softwareUpdateCheck: () => electron.ipcRenderer.invoke('software-update:check'),
  softwareUpdateOpenRelease: () => electron.ipcRenderer.invoke('software-update:open'),
  softwareUpdateDismiss: (version) => electron.ipcRenderer.invoke('software-update:dismiss', version),
  onSoftwareUpdateState: (callback) => {
    const handler = (_event, state) => callback(state);
    electron.ipcRenderer.on('software-update:changed', handler);
    return () => electron.ipcRenderer.removeListener('software-update:changed', handler);
  },
  megaRevivalTasks: () => electron.ipcRenderer.invoke("mega:revival-list"),
  megaRevivalControl: (payload) => electron.ipcRenderer.invoke("mega:revival-control", payload),
  megaRevivalOpen: (taskId) => electron.ipcRenderer.invoke("mega:revival-open", { taskId }),
  megaRevivalImportPaths: (taskId) => electron.ipcRenderer.invoke("mega:revival-importPaths", { taskId }),
  pawchiveListCreators: (options) => electron.ipcRenderer.invoke("pawchive:list-creators", options),
  pawchiveListPosts: (options) => electron.ipcRenderer.invoke("pawchive:list-posts", options),
  pawchiveGetPost: (post) => electron.ipcRenderer.invoke("pawchive:get-post", post),
  pawchiveSetFavorite: (payload) => electron.ipcRenderer.invoke("pawchive:set-favorite", payload),
  pawchiveMarkRead: (payload) => electron.ipcRenderer.invoke("pawchive:mark-read", payload),
  pawchiveCheckUpdates: () => electron.ipcRenderer.invoke("pawchive:check-updates"),
  pawchiveGetUpdates: (options) => electron.ipcRenderer.invoke("pawchive:get-updates", options),
  onPawchiveStateChanged: (callback) => {
    const handler = (_, state) => callback(state);
    electron.ipcRenderer.on("pawchive:state-changed", handler);
    return () => electron.ipcRenderer.removeListener("pawchive:state-changed", handler);
  },
  onPawchiveProgress: (callback) => {
    const handler = (_, progress) => callback(progress);
    electron.ipcRenderer.on("pawchive:progress", handler);
    return () => electron.ipcRenderer.removeListener("pawchive:progress", handler);
  },
  getCachedMods: (gameId) => electron.ipcRenderer.invoke("get-cached-mods", { gameId }),
  syncModMarket: (serverUrl, forceFullSync, gameId, auth = {}) => electron.ipcRenderer.invoke("sync-mod-market", {
    serverUrl,
    forceFullSync,
    gameId,
    authToken: auth?.token || "",
    authServerUrl: auth?.serverUrl || ""
  }),
  marketDownloadInstallMod: (payload) => electron.ipcRenderer.invoke("market:download-install-mod", payload),
  marketRetryInstallDownloadedMod: (payload) => electron.ipcRenderer.invoke("market:retry-install-downloaded-mod", payload),
  marketOpenDownloadedArchiveFolder: (payload) => electron.ipcRenderer.invoke("market:open-downloaded-archive-folder", payload),
  marketDownloadControl: (payload) => electron.ipcRenderer.invoke("market:download-control", payload),
  marketGetDownloadSettings: () => electron.ipcRenderer.invoke("market:get-download-settings"),
  marketSelectDownloadCacheDir: () => electron.ipcRenderer.invoke("market:select-download-cache-dir"),
  marketResetDownloadCacheDir: () => electron.ipcRenderer.invoke("market:reset-download-cache-dir"),
  onMarketDownloadProgress: (cb) => {
    const handler = (_, data) => cb(data);
    electron.ipcRenderer.on("market:download-progress", handler);
    return () => electron.ipcRenderer.removeListener("market:download-progress", handler);
  },
  setServerUrl: (url, options) => electron.ipcRenderer.invoke("set-server-url", url, options),
  setUiZoom: (zoom) => electron.ipcRenderer.invoke("set-ui-zoom", zoom),
  setModMarketCardSize: (size) => electron.ipcRenderer.invoke("set-mod-market-card-size", size),
  setCompatibilityMode: (enabled) => electron.ipcRenderer.invoke("set-compatibility-mode", enabled),
  // Skin APIs
  getSkins: () => electron.ipcRenderer.invoke("get-skins"),
  setActiveSkin: (skinId) => electron.ipcRenderer.invoke("set-active-skin", skinId),
  getActiveSkin: () => electron.ipcRenderer.invoke("get-active-skin"),
  // Order saving APIs
  saveCharacterOrder: (characterOrder) => electron.ipcRenderer.invoke("save-character-order", characterOrder),
  saveModOrder: (characterName, modOrder) => electron.ipcRenderer.invoke("save-mod-order", { characterName, modOrder }),
  // Hotkey editing API
  saveHotkey: (characterName, modName, sectionName, newKey) => electron.ipcRenderer.invoke("save-hotkey", { characterName, modName, sectionName, newKey }),
  // Preset System APIs
  presetList: () => electron.ipcRenderer.invoke("preset:list"),
  presetCreate: (name, description, mods) => electron.ipcRenderer.invoke("preset:create", { name, description, mods }),
  presetDelete: (presetId) => electron.ipcRenderer.invoke("preset:delete", presetId),
  presetUpdate: (presetId, name, description, mods) => electron.ipcRenderer.invoke("preset:update", { presetId, name, description, mods }),
  presetActivate: (presetId) => electron.ipcRenderer.invoke("preset:activate", presetId),
  presetDeactivate: () => electron.ipcRenderer.invoke("preset:deactivate"),
  presetSnapshot: (presetId) => electron.ipcRenderer.invoke("preset:snapshot", presetId),
  // Mod Conflict Detection
  detectModConflicts: (characterName) => electron.ipcRenderer.invoke("detect-mod-conflicts", characterName),
  // Config Import/Export
  configExport: () => electron.ipcRenderer.invoke("config:export"),
  configImport: () => electron.ipcRenderer.invoke("config:import"),
  // Mod Auto-Update Detection
  // Multi-Game Management
  gameList: () => electron.ipcRenderer.invoke("game:list"),
  gameAdd: (game) => electron.ipcRenderer.invoke("game:add", game),
  gameUpdate: (gameId, updates) => electron.ipcRenderer.invoke("game:update", { gameId, updates }),
  gameDelete: (gameId) => electron.ipcRenderer.invoke("game:delete", gameId),
  gameSwitch: (gameId) => electron.ipcRenderer.invoke("game:switch", gameId),
  gameSelectFolder: (title, options) => electron.ipcRenderer.invoke("game:select-folder", title, options || {}),
  gameSelectExe: (title) => electron.ipcRenderer.invoke("game:select-exe", title),
  nevernessDx12Status: () => electron.ipcRenderer.invoke("neverness:dx12-status"),
  nevernessDx12SetMode: (mode) => electron.ipcRenderer.invoke("neverness:dx12-set-mode", mode),
  nevernessDx12LaunchLoader: () => electron.ipcRenderer.invoke("neverness:dx12-launch-loader"),
  nevernessDx12ReinstallLoader: () => electron.ipcRenderer.invoke("neverness:dx12-reinstall-loader"),
  nevernessDx12OpenPakFolder: () => electron.ipcRenderer.invoke("neverness:dx12-open-pak-folder"),
  nevernessDx12SelectDisabledModsDir: () => electron.ipcRenderer.invoke("neverness:dx12-select-disabled-mods-dir"),
  nevernessDx12ResetDisabledModsDir: () => electron.ipcRenderer.invoke("neverness:dx12-reset-disabled-mods-dir"),
  onNevernessPakToggleProgress: (cb) => {
    const handler = (_, data) => cb(data);
    electron.ipcRenderer.on("neverness:pak-toggle-progress", handler);
    return () => electron.ipcRenderer.removeListener("neverness:pak-toggle-progress", handler);
  },
  // v4.0: Generic file picker
  selectFile: (options) => electron.ipcRenderer.invoke("select-file", options),
  // v5.0: Listen for mod changes from overlay
  onModsChanged: (callback) => {
    const handler = (_, data) => callback(data);
    electron.ipcRenderer.on("mods-changed", handler);
    return () => electron.ipcRenderer.removeListener("mods-changed", handler);
  },
  onOpenManagerTarget: (callback) => {
    electron.ipcRenderer.on("open-manager-target", (_, data) => callback(data));
    return () => electron.ipcRenderer.removeAllListeners("open-manager-target");
  },
  onGamesChanged: (callback) => {
    const handler = (_, data) => callback(data);
    electron.ipcRenderer.on("games-changed", handler);
    return () => electron.ipcRenderer.removeListener("games-changed", handler);
  },
  // Overlay hotkey management from main UI
  getOverlayHotkey: () => electron.ipcRenderer.invoke("get-overlay-hotkey"),
  setOverlayHotkey: (hotkey) => electron.ipcRenderer.invoke("set-overlay-hotkey", hotkey),
  toggleOverlayFromUI: () => electron.ipcRenderer.invoke("toggle-overlay-from-ui"),
  // Close behavior
  getCloseBehavior: () => electron.ipcRenderer.invoke("get-close-behavior"),
  setCloseBehavior: (behavior) => electron.ipcRenderer.invoke("set-close-behavior", behavior),
  getDefaultCharacters: (gameId) => electron.ipcRenderer.invoke("get-default-characters", { gameId }),
  // Dev: export marked mods list
  exportMarkedMods: (entries) => electron.ipcRenderer.invoke("export-marked-mods", entries),
  // Dev: mark-move feature
  markSelectDestFolder: () => electron.ipcRenderer.invoke("mark:select-dest-folder"),
  markMoveMods: (entries, destFolder) => electron.ipcRenderer.invoke("mark:move-mods", { entries, destFolder }),
  markRestoreMods: (moves) => electron.ipcRenderer.invoke("mark:restore-mods", { moves }),
  markGetMoveRecord: () => electron.ipcRenderer.invoke("mark:get-move-record"),
  // Batch import
  batchScanFolder: () => electron.ipcRenderer.invoke("batch:scan-folder"),
  batchSelectFiles: (options) => electron.ipcRenderer.invoke("batch:select-files", options || {}),
  batchScanPaths: (paths) => electron.ipcRenderer.invoke("batch:scan-paths", { paths }),
  batchDecryptAll: (payload) => electron.ipcRenderer.invoke("batch:decrypt-all", payload),
  batchAddMods: (payload) => electron.ipcRenderer.invoke("batch:add-mods", payload),
  managedPackageInstall: (payload) => electron.ipcRenderer.invoke("managed-package:install", payload || {}),
  onBatchDecryptProgress: (cb) => {
    const handler = (_, data) => cb(data);
    electron.ipcRenderer.on("batch:decrypt-progress", handler);
    return () => electron.ipcRenderer.removeListener("batch:decrypt-progress", handler);
  },
  // Market background poll (auto-reads config serverUrl)
  marketPoll: (auth = {}) => electron.ipcRenderer.invoke("market:poll", {
    authToken: auth?.token || "",
    authServerUrl: auth?.serverUrl || ""
  }),
  invalidateMarketRequests: (gameId) => electron.ipcRenderer.invoke("market:invalidate-requests", { gameId: gameId || "" }),
  // Feedback reply system
  fetchMyFeedback: (serverUrl, clientId) => electron.ipcRenderer.invoke("fetch-my-feedback", { serverUrl, clientId }),
  onBatchProgress: (cb) => {
    const handler = (_, data) => cb(data);
    electron.ipcRenderer.on("batch:progress", handler);
    return () => electron.ipcRenderer.removeListener("batch:progress", handler);
  },
  // Mod meta (tags + notes). Available to all users — dev mode is only required
  // for AI suggestions and server-side tag syncing.
  getModMeta: (modPath) => electron.ipcRenderer.invoke("mod:get-meta", { modPath }),
  setModMeta: (modPath, payload) => electron.ipcRenderer.invoke("mod:set-meta", { modPath, ...payload || {} }),
  // Developer mode: tag system & mod migration
  devGetModTags: (modPath) => electron.ipcRenderer.invoke("dev:get-mod-tags", { modPath }),
  devSetModTags: (modPath, tags) => electron.ipcRenderer.invoke("dev:set-mod-tags", { modPath, tags }),
  devCopyModInfo: (modPath, meta) => electron.ipcRenderer.invoke("dev:copy-mod-info", { modPath, ...meta || {} }),
  devImportModInfo: (modPath) => electron.ipcRenderer.invoke("dev:import-mod-info", { modPath }),
  devMarkMod: (gameId, characterName, modName, modPath) => electron.ipcRenderer.invoke("dev:mark-mod", { gameId, characterName, modName, modPath }),
  devUnmarkMod: (gameId, characterName, modName) => electron.ipcRenderer.invoke("dev:unmark-mod", { gameId, characterName, modName }),
  devGetMarkedMods: (gameId) => electron.ipcRenderer.invoke("dev:get-marked-mods", { gameId }),
  onMarkedModsChanged: (callback) => {
    const handler = (_, data) => callback(data);
    electron.ipcRenderer.on("marked-mods-changed", handler);
    return () => electron.ipcRenderer.removeListener("marked-mods-changed", handler);
  },
  devSelectMigrateDest: () => electron.ipcRenderer.invoke("dev:select-migrate-dest"),
  devMigrateMods: (gameId, destFolder) => electron.ipcRenderer.invoke("dev:migrate-mods", { gameId, destFolder }),
  devMigrateModsBack: (gameId) => electron.ipcRenderer.invoke("dev:migrate-mods-back", { gameId }),
  devGetMigratedMods: (gameId) => electron.ipcRenderer.invoke("dev:get-migrated-mods", { gameId }),
  // Fix tool
  fixGetExePath: (gameId) => electron.ipcRenderer.invoke("fix:get-exe-path", { gameId }),
  fixRunAll: (mode = "external", gameId) => electron.ipcRenderer.invoke("fix:run-all", { mode, gameId }),
  fixRunCharacter: (characterName, mode = "external", gameId) => electron.ipcRenderer.invoke("fix:run-character", { characterName, mode, gameId }),
  fixRunMod: (characterName, modName, mode = "external", gameId) => electron.ipcRenderer.invoke("fix:run-mod", { characterName, modName, mode, gameId }),
  fixSelectCustomExe: (gameId) => electron.ipcRenderer.invoke("fix:select-custom-exe", { gameId }),
  resetCharacterIni: (characterName) => electron.ipcRenderer.invoke("persist-bridge-reset-character", characterName),
  resetModIni: (characterName, modName) => electron.ipcRenderer.invoke("persist-bridge-reset-mod", { characterName, modName }),
  listModIniBackups: (characterName, modName) => electron.ipcRenderer.invoke("ini-backup:list-mod", { characterName, modName }),
  restoreModIniBackup: (characterName, modName, stamp) => electron.ipcRenderer.invoke("ini-backup:restore-mod", { characterName, modName, stamp }),
  overlayGetSettings: () => electron.ipcRenderer.invoke("overlay-get-settings"),
  overlayUpdateSettings: (updates) => electron.ipcRenderer.invoke("overlay-update-settings", updates),
  clearPersistCache: (gameId) => electron.ipcRenderer.invoke("persist-bridge-clear-cache", gameId),
  devGetDevKitStatus: () => electron.ipcRenderer.invoke("dev:get-devkit-status"),
  devUnlock: (password) => electron.ipcRenderer.invoke("dev:unlock", password),
  devLock: () => electron.ipcRenderer.invoke("dev:lock"),
  // Dev: Publish mod to market
  devGetPublishConfig: () => electron.ipcRenderer.invoke("dev:get-publish-config"),
  devSavePublishConfig: (cfg) => electron.ipcRenderer.invoke("dev:save-publish-config", cfg),
  devGetModPreview: (modFolderPath) => electron.ipcRenderer.invoke("dev:get-mod-preview", { modFolderPath }),
  devGetMarketPublishKey: (payload) => electron.ipcRenderer.invoke("dev:get-market-publish-key", payload),
  devPublishMod: (params) => electron.ipcRenderer.invoke("dev:publish-mod", params),
  devCancelPublish: (params) => electron.ipcRenderer.invoke("dev:cancel-publish", params),
  onPublishProgress: (cb, taskId = null) => {
    const handler = (_, payload) => {
      if (payload && typeof payload === "object" && Object.prototype.hasOwnProperty.call(payload, "taskId")) {
        if (taskId && payload.taskId !== taskId) return;
        cb(payload.data || "");
        return;
      }
      if (!taskId) cb(payload);
    };
    electron.ipcRenderer.on("dev:publish-progress", handler);
    return () => electron.ipcRenderer.removeListener("dev:publish-progress", handler);
  },
  onPublishDone: (cb, taskId = null) => {
    const handler = (_, payload) => {
      if (payload && typeof payload === "object" && Object.prototype.hasOwnProperty.call(payload, "taskId")) {
        if (taskId && payload.taskId !== taskId) return;
        cb(payload);
        return;
      }
      if (!taskId) cb(payload);
    };
    electron.ipcRenderer.on("dev:publish-done", handler);
    return () => electron.ipcRenderer.removeListener("dev:publish-done", handler);
  },
  // Peek disguised MP4 mod name
  peekDisguisedModName: (filePath) => electron.ipcRenderer.invoke("peek-disguised-mod-name", { filePath }),
  // Dev: Log management
  devSaveLog: (params) => electron.ipcRenderer.invoke("dev:save-log", params),
  devOpenLogsFolder: () => electron.ipcRenderer.invoke("dev:open-logs-folder"),
  // Dev: Batch cloud operations (upload / replace links)
  devListLocalMods: (params) => electron.ipcRenderer.invoke("dev:list-local-mods", params),
  devBatchCloudOp: (params) => electron.ipcRenderer.invoke("dev:batch-cloud-op", params),
  devFillMissingImages: (params) => electron.ipcRenderer.invoke("dev:fill-missing-images", params),
  devAiSuggest: (params) => electron.ipcRenderer.invoke("dev:ai-suggest", params),
  devExportEncryptedMod: (params) => electron.ipcRenderer.invoke("dev:export-encrypted-mod", params),
  devSaveAiTags: (params) => electron.ipcRenderer.invoke("dev:save-ai-tags", params),
  devLoadAiTags: (params) => electron.ipcRenderer.invoke("dev:load-ai-tags", params),
  devSaveAiSuggestCache: (params) => electron.ipcRenderer.invoke("dev:save-ai-suggest-cache", params),
  devLoadAiSuggestCache: (params) => electron.ipcRenderer.invoke("dev:load-ai-suggest-cache", params),
  onBatchCloudProgress: (cb) => {
    const handler = (_, data) => cb(data);
    electron.ipcRenderer.on("dev:batch-progress", handler);
    return () => electron.ipcRenderer.removeListener("dev:batch-progress", handler);
  },
  onBatchCloudDone: (cb) => {
    const handler = (_, data) => cb(data);
    electron.ipcRenderer.on("dev:batch-done", handler);
    return () => electron.ipcRenderer.removeListener("dev:batch-done", handler);
  },
  // Autoinstall (Setup Wizard)
  autoinstallGetBundledPackages: () => electron.ipcRenderer.invoke("autoinstall:get-bundled-packages"),
  autoinstallSelectFolder: (title, options) => electron.ipcRenderer.invoke("autoinstall:select-folder", title, options || {}),
  autoinstallSelectZip: (title) => electron.ipcRenderer.invoke("autoinstall:select-zip", title),
  autoinstallSelectUpdateSource: (title) => electron.ipcRenderer.invoke("autoinstall:select-update-source", title),
  autoinstallSelectModSource: (title) => electron.ipcRenderer.invoke("autoinstall:select-mod-source", title),
  autoinstallInstallXxmi: (opts) => electron.ipcRenderer.invoke("autoinstall:install-xxmi", opts),
  autoinstallInstallNemi: (opts) => electron.ipcRenderer.invoke("autoinstall:install-nemi", opts),
  autoinstallInstallGamePackage: (opts) => electron.ipcRenderer.invoke("autoinstall:install-game-package", opts),
  autoinstallConfigureXxmi: (opts) => electron.ipcRenderer.invoke("autoinstall:configure-xxmi", opts),
  autoinstallApplyPaths: (opts) => electron.ipcRenderer.invoke("autoinstall:apply-paths", opts),
  autoinstallImportMods: (opts) => electron.ipcRenderer.invoke("autoinstall:import-mods", opts),
  autoinstallUpdateXxmi: (opts) => electron.ipcRenderer.invoke("autoinstall:update-xxmi", opts),
  autoinstallUpdateGamePackage: (opts) => electron.ipcRenderer.invoke("autoinstall:update-game-package", opts),
  autoinstallDetectGamePath: (gameId) => electron.ipcRenderer.invoke("autoinstall:detect-game-path", gameId),
  onAutoinstallProgress: (cb) => {
    const handler = (_, data) => cb(data);
    electron.ipcRenderer.on("autoinstall:progress", handler);
    return () => electron.ipcRenderer.removeListener("autoinstall:progress", handler);
  },

};
if (process.contextIsolated) {
  try {
    electron.contextBridge.exposeInMainWorld("electron", preload.electronAPI);
    electron.contextBridge.exposeInMainWorld("api", api);
  } catch (error) {
    console.error(error);
  }
} else {
  window.electron = preload.electronAPI;
  window.api = api;
}
