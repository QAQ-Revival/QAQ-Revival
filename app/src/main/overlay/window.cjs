"use strict";

const i18n = require("../../shared/i18n/core.cjs");
module.exports = {
  registerIpc,
  initialize,
  resetOverlayWindowsForModeChange,
  createOverlayWindow,
  hideSideWindow,
  registerOverlayHotkey,
  get overlayWindow() {
    return overlayWindow;
  },
  get overlaySideWindow() {
    return overlaySideWindow;
  }
};
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const utils = require("@electron-toolkit/utils");
const charactersCatalog = require("../characters/catalog.cjs");
const charactersDirectories = require("../characters/directories.cjs");
const charactersHidden = require("../characters/hidden.cjs");
const charactersImages = require("../characters/images.cjs");
const charactersOrganization = require("../characters/organization.cjs");
const configStore = require("../config/store.cjs");
const coreLogger = require("../core/logger.cjs");
const desktopNotifications = require("../desktop/notifications.cjs");
const desktopWindows = require("../desktop/windows.cjs");
const developerMarked = require("../developer/marked.cjs");
const gamesEnvironment = require("../games/environment.cjs");
const gamesNevernessLoader = require("../games/neverness/loader.cjs");
const gamesSettings = require("../games/settings.cjs");
const modsConflicts = require("../mods/conflicts.cjs");
const modsMetadata = require("../mods/metadata.cjs");
const modsNevernessPaks = require("../games/neverness/paks.cjs");
const overlayActivity = require("./activity.cjs");
const overlayHelper = require("./helper.cjs");
const overlayKeypress = require("./keypress.cjs");
const persistService = require("../persist/service.cjs");
const persistTracking = require("../persist/tracking.cjs");
const presetsService = require("../presets/service.cjs");
const runtimePaths = require("../runtime/paths.cjs");
const systemFiles = require("../system/files.cjs");
const OVERLAY_WINDOW_WIDTH = 420;
const OVERLAY_WINDOW_HEIGHT = 720;
const OVERLAY_WINDOW_MIN_SCALE = 0.85;
const OVERLAY_WINDOW_MAX_SCALE = 1.45;
const OVERLAY_WINDOW_TOP_MARGIN = 20;
const OVERLAY_WINDOW_RIGHT_MARGIN = 10;
const OVERLAY_SIDE_GAP = 8;
const OVERLAY_TOGGLE_COOLDOWN_MS = 320;
const OVERLAY_RECENT_SHOW_GUARD_MS = 750;
const OVERLAY_BLUR_SUPPRESS_MS = 1e3;
const OVERLAY_PREWARM_DELAY_MS = 1200;
let overlayWindow = null;
let overlaySideWindow = null;
let overlayPinned = false;
let sideClosingIntentionally = false;
let overlayToggleCooldownUntil = 0;
let overlaySuppressBlurUntil = 0;
let overlayLastShownAt = 0;
let overlayReadyPromise = null;
let overlaySideRequestId = 0;
let overlaySideContentKey = null;
function normalizeOverlayWindowScale(value) {
  const scale = Number(value);
  if (!Number.isFinite(scale)) return 1;
  return Math.max(OVERLAY_WINDOW_MIN_SCALE, Math.min(OVERLAY_WINDOW_MAX_SCALE, scale));
}
function getOverlayWindowScale() {
  return normalizeOverlayWindowScale(configStore.currentConfig.overlayWindowScale);
}
function getOverlayTargetBounds(scale = getOverlayWindowScale()) {
  const cursorPoint = electron.screen.getCursorScreenPoint();
  const targetDisplay = electron.screen.getDisplayNearestPoint(cursorPoint);
  const workArea = targetDisplay?.workArea || electron.screen.getPrimaryDisplay().workArea;
  const windowScale = normalizeOverlayWindowScale(scale);
  const width = Math.round(OVERLAY_WINDOW_WIDTH * windowScale);
  const height = Math.round(OVERLAY_WINDOW_HEIGHT * windowScale);
  return {
    x: workArea.x + Math.max(workArea.width - width - OVERLAY_WINDOW_RIGHT_MARGIN, 0),
    y: workArea.y + OVERLAY_WINDOW_TOP_MARGIN,
    width,
    height
  };
}
function syncOverlayScaleToRenderer() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send("overlay-scale-changed", {
      scale: getOverlayWindowScale()
    });
  }
}
function applyOverlayWindowScale(nextScale) {
  const scale = normalizeOverlayWindowScale(nextScale);
  configStore.currentConfig.overlayWindowScale = scale;
  configStore.saveConfig(configStore.currentConfig);
  const bounds = getOverlayTargetBounds(scale);
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.setBounds(bounds, false);
    syncOverlayScaleToRenderer();
  }
  if (overlayWindow && !overlayWindow.isDestroyed() && overlaySideWindow && !overlaySideWindow.isDestroyed()) {
    const mainBounds = overlayWindow.getBounds();
    const sideBounds = overlaySideWindow.getBounds();
    overlaySideWindow.setBounds({
      x: mainBounds.x - sideBounds.width - OVERLAY_SIDE_GAP,
      y: mainBounds.y,
      width: sideBounds.width,
      height: mainBounds.height
    });
  }
  return {
    success: true,
    scale,
    width: bounds.width,
    height: bounds.height
  };
}
function hideOverlayWindow({
  intentionalSideClose = false,
  resetPin = false
} = {}) {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.setOpacity(0);
    overlayWindow.hide();
    overlayWindow.setAlwaysOnTop(false);
  }
  hideSideWindow(intentionalSideClose);
  if (resetPin) overlayPinned = false;
}
function resetOverlayWindowsForModeChange() {
  try {
    if (overlaySideWindow && !overlaySideWindow.isDestroyed()) overlaySideWindow.destroy();
  } catch (_) {}
  try {
    if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.destroy();
  } catch (_) {}
  overlaySideWindow = null;
  overlayWindow = null;
  overlayReadyPromise = null;
  overlayPinned = false;
}
function loadOverlayPage(window, page) {
  const rendererUrl = process.env.ELECTRON_RENDERER_URL;
  if (utils.is.dev && rendererUrl) {
    return window.loadURL(`${rendererUrl.replace(/\/$/, "")}/overlay/${page}`);
  }
  return window.loadFile(path.join(runtimePaths.mainDir, "../renderer/overlay", page));
}
function createOverlayWindow() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    return overlayReadyPromise || Promise.resolve(overlayWindow);
  }
  const overlayPreloadPath = path.join(runtimePaths.mainDir, "../preload/overlay.js");
  const initialBounds = getOverlayTargetBounds();
  const compatibilityMode = configStore.isStrongCompatibilityModeEnabled();
  overlayWindow = new electron.BrowserWindow({
    x: initialBounds.x,
    y: initialBounds.y,
    width: initialBounds.width,
    height: initialBounds.height,
    show: false,
    frame: false,
    transparent: !compatibilityMode,
    backgroundColor: compatibilityMode ? "#f8fafc" : "#00000000",
    alwaysOnTop: false,
    skipTaskbar: true,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    focusable: true,
    fullscreenable: false,
    hasShadow: compatibilityMode,
    paintWhenInitiallyHidden: true,
    webPreferences: {
      preload: overlayPreloadPath,
      sandbox: false,
      webSecurity: false,
      backgroundThrottling: false,
      contextIsolation: true
    }
  });
  overlayReadyPromise = new Promise(resolve => {
    let resolved = false;
    const markReady = () => {
      if (resolved) return;
      resolved = true;
      overlayReadyPromise = null;
      resolve(overlayWindow);
    };
    overlayWindow.once("ready-to-show", markReady);
    overlayWindow.webContents.once("did-finish-load", markReady);
  });
  loadOverlayPage(overlayWindow, "index.html");
  overlayWindow.on("hide", () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.webContents.send("overlay-window-hidden");
  });
  overlayWindow.on("blur", () => {
    setTimeout(() => {
      if (sideClosingIntentionally) return;
      if (Date.now() < overlaySuppressBlurUntil) return;
      if (Date.now() - overlayLastShownAt < OVERLAY_RECENT_SHOW_GUARD_MS) return;
      if (overlayWindow && overlayWindow.isVisible() && !overlayPinned) {
        if (overlaySideWindow && !overlaySideWindow.isDestroyed() && overlaySideWindow.isFocused()) return;
        if (overlayWindow.isFocused()) return;
        hideOverlayWindow();
      }
    }, 200);
  });
  overlayWindow.on("closed", () => {
    overlayWindow = null;
    overlayReadyPromise = null;
    hideSideWindow();
  });
  return overlayReadyPromise;
}
function createSideWindow(contentUrl, width) {
  const overlayPreloadPath = path.join(runtimePaths.mainDir, "../preload/overlay.js");
  if (overlaySideWindow && !overlaySideWindow.isDestroyed()) {
    overlaySideWindow.destroy();
  }
  const mainBounds = overlayWindow ? overlayWindow.getBounds() : getOverlayTargetBounds();
  const sideWidth = width;
  const sideX = mainBounds.x - sideWidth - OVERLAY_SIDE_GAP;
  const sideY = mainBounds.y;
  const compatibilityMode = configStore.isStrongCompatibilityModeEnabled();
  overlaySideWindow = new electron.BrowserWindow({
    width: sideWidth,
    height: mainBounds.height,
    x: sideX,
    y: sideY,
    show: false,
    frame: false,
    transparent: !compatibilityMode,
    backgroundColor: compatibilityMode ? "#f8fafc" : "#00000000",
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    focusable: true,
    hasShadow: compatibilityMode,
    webPreferences: {
      preload: overlayPreloadPath,
      sandbox: false,
      webSecurity: false,
      contextIsolation: true
    }
  });
  loadOverlayPage(overlaySideWindow, "side-panel.html");
  overlaySideWindow.on("blur", () => {
    setTimeout(() => {
      if (sideClosingIntentionally) return;
      if (overlaySideWindow && overlaySideWindow.isVisible()) {
        if (overlayWindow && overlayWindow.isFocused()) return;
        if (!overlayPinned) {
          hideOverlayWindow();
        }
      }
    }, 150);
  });
  overlaySideWindow.on("closed", () => {
    overlaySideWindow = null;
  });
  return overlaySideWindow;
}
function hideSideWindow(intentional) {
  overlaySideRequestId++;
  const requestKey = overlaySideContentKey;
  overlaySideContentKey = null;
  if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.webContents.send("overlay-side-hidden", {
    requestKey
  });
  if (intentional) {
    sideClosingIntentionally = true;
    setTimeout(() => {
      sideClosingIntentionally = false;
    }, 300);
  }
  if (overlaySideWindow && !overlaySideWindow.isDestroyed()) {
    overlaySideWindow.setOpacity(0);
    overlaySideWindow.hide();
  }
}
let currentOverlayHotkey = "Alt+F";
function registerOverlayHotkey(hotkey) {
  electron.globalShortcut.unregisterAll();
  const accelerator = hotkey.replace(/\s*\+\s*/g, "+");
  const success = electron.globalShortcut.register(accelerator, () => {
    toggleOverlay();
  });
  if (success) {
    currentOverlayHotkey = accelerator;
    console.log(`[Overlay] Hotkey registered: ${accelerator}`);
  } else {
    console.log(`[Overlay] Failed to register ${accelerator}, trying Ctrl+Shift+M`);
    const fallback = electron.globalShortcut.register("Ctrl+Shift+M", () => {
      toggleOverlay();
    });
    currentOverlayHotkey = fallback ? "Ctrl+Shift+M" : hotkey;
    if (fallback) console.log("[Overlay] Fallback Ctrl+Shift+M registered");
  }
  return success;
}
function toggleOverlay() {
  const now = Date.now();
  if (now < overlayToggleCooldownUntil) return;
  if (overlayWindow && !overlayWindow.isDestroyed() && overlayWindow.isVisible() && now - overlayLastShownAt < OVERLAY_RECENT_SHOW_GUARD_MS) {
    return;
  }
  overlayToggleCooldownUntil = now + OVERLAY_TOGGLE_COOLDOWN_MS;
  if (!overlayWindow) {
    createOverlayWindow()?.then(() => {
      if (overlayWindow && !overlayWindow.isDestroyed() && !overlayWindow.isVisible()) {
        showOverlay();
      }
    });
    return;
  }
  if (overlayReadyPromise) {
    overlayReadyPromise.then(() => {
      if (!overlayWindow || overlayWindow.isDestroyed()) return;
      if (overlayWindow.isVisible()) hideOverlayWindow();else showOverlay();
    });
    return;
  }
  if (overlayWindow.isVisible()) {
    hideOverlayWindow();
  } else {
    showOverlay();
  }
}
function showOverlay() {
  if (!overlayWindow) return;
  const bounds = getOverlayTargetBounds();
  overlayLastShownAt = Date.now();
  overlaySuppressBlurUntil = overlayLastShownAt + OVERLAY_BLUR_SUPPRESS_MS;
  const compatibilityMode = configStore.isStrongCompatibilityModeEnabled();
  overlayWindow.setOpacity(compatibilityMode ? 1 : 0);
  overlayWindow.setBounds(bounds, false);
  overlayWindow.setAlwaysOnTop(true, "screen-saver");
  overlayWindow.show();
  overlayWindow.focus();
  if (compatibilityMode) {
    try {
      overlayWindow.webContents.invalidate();
    } catch (_) {}
  } else {
    setTimeout(() => {
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.setOpacity(1);
      }
    }, 30);
  }
  if (!overlayWindow.webContents.isLoading()) {
    syncOverlayScaleToRenderer();
    overlayWindow.webContents.send("overlay-window-shown");
  } else {
    overlayWindow.webContents.once("did-finish-load", () => {
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        syncOverlayScaleToRenderer();
        overlayWindow.webContents.send("overlay-window-shown");
      }
    });
  }
}
let lastSideWidths;
let currentSidePanelType = "detail";
function initialize() {
  lastSideWidths = configStore.currentConfig.sidePanelWidths || {
    detail: 300,
    characters: 220
  };
}
function registerIpc() {
  electron.ipcMain.handle('overlay-get-activity', () => ({
    success: true,
    gameId: gamesSettings.getActiveGameScopeId(),
    ...overlayActivity.overlayActivity.read(gamesEnvironment.resolveActiveGameEnvRoot())
  }));
  electron.ipcMain.handle("overlay-get-characters", async () => {
    try {
      const modsPathStatus = gamesSettings.getModsPathStatus();
      if (!modsPathStatus.ok) {
        return {
          success: false,
          error: modsPathStatus.error,
          code: modsPathStatus.code
        };
      }
      const {
        modsPath
      } = modsPathStatus;
      const gameId2 = gamesSettings.getActiveGameScopeId();
      await overlayActivity.prepareOverlayActivity();
      const characters = charactersDirectories.sortCharacterEntries(charactersDirectories.listCharacterDirectories(modsPath, gameId2), gameId2).map(entry => ({
        name: entry.displayName,
        modCount: entry.modCount,
        enabledCount: entry.enabledCount,
        coverUrl: charactersImages.getCharacterCoverUrl(entry.displayName)
      }));
      return {
        success: true,
        gameId: gameId2,
        characters: characters.filter(character => !charactersHidden.isCharacterHidden(character.name, gameId2))
      };
    } catch (e) {
      return {
        success: false,
        error: e.message
      };
    }
  });
  electron.ipcMain.handle("overlay-get-mods", async (_, characterName) => {
    try {
      const gameId2 = gamesSettings.getActiveGameScopeId();
      charactersOrganization.organizeLegacyCharacterFoldersIfNeeded(gameId2);
      const charPath = charactersDirectories.resolveCharacterPath(characterName, gameId2);
      if (!charPath || !fs.existsSync(charPath)) return {
        success: false,
        error: i18n.t("backend.overlay.window.characterFolderMissing")
      };
      const entries = fs.readdirSync(charPath, {
        withFileTypes: true
      });
      const addedAtAccessor = gamesSettings.createModAddedAtAccessor();
      let mods = entries.filter(e => e.isDirectory()).map(e => {
        const isDisabled = e.name.startsWith("DISABLED_");
        const displayName = isDisabled ? e.name.replace(/^DISABLED_/, "") : e.name;
        const modDir = path.join(charPath, e.name);
        const {
          addedAt,
          addedAtMs
        } = addedAtAccessor.get(characterName, displayName, modDir);
        let previewUrl = null;
        const previewNames = ["preview.png", "preview.jpg", "preview.jpeg", "preview.webp"];
        for (const pn of previewNames) {
          const pp = path.join(modDir, pn);
          if (fs.existsSync(pp)) {
            previewUrl = "file:///" + pp.replace(/\\/g, "/");
            break;
          }
        }
        return {
          name: displayName,
          fullName: e.name,
          enabled: !isDisabled,
          previewUrl,
          marked: developerMarked.isModMarked(gameId2, characterName, displayName),
          addedAt,
          addedAtMs
        };
      }).sort((a, b) => {
        if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      const modOrders = configStore.currentConfig.modOrders || {};
      const {
        value: customOrder
      } = charactersDirectories.getCharacterConfigStoreValue(modOrders, characterName, [], gameId2);
      if (customOrder.length > 0) {
        const orderedMods = [];
        const unorderedMods = [];
        for (const mod of mods) {
          if (customOrder.includes(mod.name)) {
            orderedMods.push(mod);
          } else {
            unorderedMods.push(mod);
          }
        }
        orderedMods.sort((a, b) => customOrder.indexOf(a.name) - customOrder.indexOf(b.name));
        unorderedMods.sort((a, b) => a.name.localeCompare(b.name, "zh"));
        mods = [...orderedMods, ...unorderedMods];
      }
      mods = modsMetadata.movePinnedModsToTop(modsMetadata.applyPinnedStateToMods(characterName, mods));
      addedAtAccessor.saveIfDirty();
      let conflictModNames = new Set();
      try {
        const conflicts = modsConflicts.detectConflictsForCharacter(charPath);
        for (const c of conflicts) {
          for (const modName of c.mods) conflictModNames.add(modName);
        }
      } catch (e) {}
      for (const mod of mods) {
        mod.hasConflict = conflictModNames.has(mod.name);
      }
      return {
        success: true,
        mods,
        characterAliases: charactersCatalog.getCharacterAliasCandidates(characterName, gameId2)
      };
    } catch (e) {
      return {
        success: false,
        error: e.message
      };
    }
  });
  electron.ipcMain.handle("overlay-set-mod-marked", async (_, {
    characterName,
    modName,
    marked
  }) => {
    try {
      const gameId2 = gamesSettings.getActiveGameScopeId();
      charactersOrganization.organizeLegacyCharacterFoldersIfNeeded(gameId2);
      const charPath = charactersDirectories.resolveCharacterPath(characterName, gameId2);
      if (!charPath) return {
        success: false,
        error: i18n.t("backend.overlay.window.characterFolderMissing")
      };
      let modDir = path.join(charPath, modName);
      if (!fs.existsSync(modDir)) {
        const disabledModDir = path.join(charPath, `DISABLED_${modName}`);
        if (fs.existsSync(disabledModDir)) modDir = disabledModDir;
      }
      if (!fs.existsSync(modDir)) return {
        success: false,
        error: i18n.t("backend.developer.export.modFolderMissing")
      };
      const nextMarked = !!marked;
      if (nextMarked) {
        developerMarked.setMarkedModForConfig(gameId2, characterName, modName, {
          name: modName,
          characterName,
          gameId: gameId2,
          path: modDir,
          originalPath: modDir,
          markedAt: new Date().toISOString()
        });
      } else {
        developerMarked.deleteMarkedModFromConfig(gameId2, characterName, modName);
      }
      desktopNotifications.notifyMarkedModsChanged(gameId2, characterName, {
        modName,
        reason: "overlay-mark"
      });
      return {
        success: true,
        marked: nextMarked
      };
    } catch (e) {
      return {
        success: false,
        error: e.message
      };
    }
  });
  electron.ipcMain.handle("overlay-toggle-mod", async (_, {
    characterName,
    modName,
    enabled
  }) => {
    try {
      const gameId2 = gamesSettings.getActiveGameScopeId();
      if (gameId2 === "arknights") return require("../games/arknights/service.cjs").toggleMod({ characterName, modName, enable: enabled, autoReload: !!configStore.currentConfig.overlayAutoReloadEnabled });
      if (enabled) charactersHidden.assertCharacterVisible(characterName, gameId2);
      if (gamesNevernessLoader.isNevernessDx12Mode(gameId2)) {
        const result = modsNevernessPaks.toggleNevernessDx12PakMod(characterName, modName, enabled);
        if (!result?.success) return {
          success: false,
          error: result?.error || i18n.t("backend.overlay.window.pakToggleFailed")
        };
        return result;
      }
      charactersOrganization.organizeLegacyCharacterFoldersIfNeeded(gameId2);
      const env = gamesEnvironment.resolveActiveGameEnvRoot(gameId2);
      const charPath = charactersDirectories.resolveCharacterPath(characterName, gameId2);
      if (!charPath) {
        return {
          success: false,
          error: i18n.t("backend.overlay.window.characterFolderMissing")
        };
      }
      const currentName = enabled ? `DISABLED_${modName}` : modName;
      const newName = enabled ? modName : `DISABLED_${modName}`;
      const oldPath = path.join(charPath, currentName);
      const newPath = path.join(charPath, newName);
      if (!fs.existsSync(oldPath)) {
        const altOld = path.join(charPath, enabled ? modName : `DISABLED_${modName}`);
        if (fs.existsSync(altOld)) {
          return {
            success: true
          };
        }
        return {
          success: false,
          error: i18n.t("backend.overlay.window.modFolderMissing", {
            currentName
          })
        };
      }
      if (!enabled && persistTracking.isPersistBridgeEnabled(gameId2)) {
        if (persistService.usesManagedPersistBridge(characterName, modName, gameId2)) {
          persistTracking.syncPersistBridgeStateForModDir(oldPath, gameId2);
        }
      }
      const renameResult = await systemFiles.renameModDirectoryWithRetry(oldPath, newPath);
      if (!renameResult.success) {
        return {
          success: false,
          error: renameResult.error || i18n.t("backend.overlay.window.modToggleFailed")
        };
      }
      if (env?.root && persistTracking.isPersistBridgeEnabled(gameId2)) {
        const stateFiles = persistTracking.collectHostedPersistStateFilesForModDir(newPath);
        persistTracking.updateActivePersistBridgeIncludesIncremental(env.root, enabled ? {
          enableStateFiles: stateFiles
        } : {
          disableStateFiles: stateFiles
        });
      }
      modsConflicts.clearConflictCache(characterName, gameId2);
      let persistRestored = false;
      if (enabled) {
        if (configStore.currentConfig.overlayAutoReloadEnabled) {
          await overlayHelper.triggerOverlayReload();
        }
      }
      desktopNotifications.notifyCharacterListChanged(characterName, {
        modName,
        reason: "overlay-toggle"
      });
      return {
        success: true,
        autoReloaded: !!(enabled && configStore.currentConfig.overlayAutoReloadEnabled),
        persistRestored
      };
    } catch (e) {
      return {
        success: false,
        error: e.message
      };
    }
  });
  electron.ipcMain.handle("overlay-trigger-reload", async () => {
    try {
      await overlayHelper.triggerOverlayReload();
      return {
        success: true
      };
    } catch (e) {
      return {
        success: false,
        error: e.message
      };
    }
  });
  electron.ipcMain.handle("overlay-get-settings", async () => {
    return {
      success: true,
      settings: {
        autoReloadEnabled: !!configStore.currentConfig.overlayAutoReloadEnabled,
        presetAutoReloadEnabled: !!configStore.currentConfig.overlayPresetAutoReloadEnabled,
        clickableHotkeysEnabled: !!configStore.currentConfig.overlayClickableHotkeysEnabled,
        activityEnabled: configStore.currentConfig.overlayActivityEnabled !== false,
        autoLocateEnabled: configStore.currentConfig.overlayAutoLocateEnabled !== false,
        overlayScale: getOverlayWindowScale(),
        compatibilityMode: configStore.isStrongCompatibilityModeEnabled(),
        compatibilityLevel: configStore.getCompatibilityLevel(),
        persistBridgeEnabled: !!persistTracking.isPersistBridgeEnabled(),
        persistBridgeCacheSize: null
      }
    };
  });
  electron.ipcMain.handle("overlay-update-settings", async (_, updates = {}) => {
    const previousAutoLocate = configStore.currentConfig.overlayAutoLocateEnabled;
    if (updates.autoLocateEnabled !== undefined && typeof updates.autoLocateEnabled !== "boolean") return {
      success: false,
      error: i18n.t("backend.overlay.window.invalidAutoLocateSetting")
    };
    if (typeof updates.activityEnabled === 'boolean') {
      configStore.currentConfig.overlayActivityEnabled = updates.activityEnabled;
      if (!updates.activityEnabled) {
        for (const game of configStore.currentConfig.games || []) {
          const env = gamesEnvironment.resolveActiveGameEnvRoot(game.id);
          if (env) {
            try {
              await overlayActivity.overlayActivity.prepare(env, [], false);
            } catch (error) {
              coreLogger.logger.warn('Could not disable overlay activity detection:', error.message);
            }
          }
        }
      }
      await overlayActivity.prepareOverlayActivity();
    }
    if (updates.persistBridgeCacheSize !== undefined && updates.persistBridgeCacheSize !== null) {
      return {
        success: false,
        error: i18n.t("backend.overlay.window.persistLimitRemoved")
      };
    }
    if (updates.persistBridgeEnabled !== undefined) {
      try {
        persistService.persistManager.setEnabled(updates.gameId, updates.persistBridgeEnabled);
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    }
    let keypressModeChanged = false;
    if (typeof updates.autoReloadEnabled === "boolean") {
      keypressModeChanged = keypressModeChanged || configStore.currentConfig.overlayAutoReloadEnabled !== updates.autoReloadEnabled;
      configStore.currentConfig.overlayAutoReloadEnabled = updates.autoReloadEnabled;
    }
    if (typeof updates.presetAutoReloadEnabled === "boolean") {
      keypressModeChanged = keypressModeChanged || configStore.currentConfig.overlayPresetAutoReloadEnabled !== updates.presetAutoReloadEnabled;
      configStore.currentConfig.overlayPresetAutoReloadEnabled = updates.presetAutoReloadEnabled;
    }
    if (typeof updates.clickableHotkeysEnabled === "boolean") {
      configStore.currentConfig.overlayClickableHotkeysEnabled = updates.clickableHotkeysEnabled;
    }
    if (updates.autoLocateEnabled !== undefined) configStore.currentConfig.overlayAutoLocateEnabled = updates.autoLocateEnabled;
    if (!configStore.saveConfig(configStore.currentConfig)) {
      configStore.currentConfig.overlayAutoLocateEnabled = previousAutoLocate;
      return {
        success: false,
        error: i18n.t("backend.games.genshinServices.saveSettingsFailed")
      };
    }
    if (keypressModeChanged) {
      try {
        overlayKeypress.setBackgroundKeypressEnabled(overlayKeypress.shouldEnableOverlayBackgroundKeypress());
      } catch (e) {
        coreLogger.logger.warn("Failed to toggle background keypress from overlay settings:", e?.message || e);
      }
    }
    return {
      success: true,
      settings: {
        autoReloadEnabled: !!configStore.currentConfig.overlayAutoReloadEnabled,
        presetAutoReloadEnabled: !!configStore.currentConfig.overlayPresetAutoReloadEnabled,
        clickableHotkeysEnabled: !!configStore.currentConfig.overlayClickableHotkeysEnabled,
        activityEnabled: configStore.currentConfig.overlayActivityEnabled !== false,
        autoLocateEnabled: configStore.currentConfig.overlayAutoLocateEnabled !== false,
        overlayScale: getOverlayWindowScale(),
        compatibilityMode: configStore.isStrongCompatibilityModeEnabled(),
        compatibilityLevel: configStore.getCompatibilityLevel(),
        persistBridgeEnabled: !!persistTracking.isPersistBridgeEnabled(),
        persistBridgeCacheSize: null
      }
    };
  });
  electron.ipcMain.handle("overlay-resize-window", async (_, nextScale) => {
    try {
      return applyOverlayWindowScale(nextScale);
    } catch (e) {
      return {
        success: false,
        error: e.message
      };
    }
  });
  electron.ipcMain.handle("overlay-apply-hotkey", async (_, {
    keys,
    hotkey
  } = {}) => {
    if (!configStore.currentConfig.overlayAutoReloadEnabled) {
      return {
        success: false,
        error: i18n.t("backend.overlay.window.autoReloadRequired")
      };
    }
    try {
      await overlayHelper.applyOverlayHotkey(hotkey || keys);
      return {
        success: true
      };
    } catch (e) {
      return {
        success: false,
        error: e.message
      };
    }
  });
  electron.ipcMain.handle("overlay-show-side", async (event, {
    width,
    content
  }) => {
    const requestId = ++overlaySideRequestId;
    const gameId = gamesSettings.getActiveGameScopeId();
    const owner = overlayWindow && event.sender === overlayWindow.webContents ? overlayWindow : null;
    const openedAt = overlayLastShownAt;
    const canShowSide = () => requestId === overlaySideRequestId && gameId === gamesSettings.getActiveGameScopeId() && (!owner || !owner.isDestroyed() && owner === overlayWindow && owner.isVisible() && openedAt === overlayLastShownAt);
    if (!canShowSide()) return {
      success: false,
      cancelled: true
    };
    try {
      const panelType = content && content.type || "detail";
      currentSidePanelType = panelType;
      const useWidth = width || lastSideWidths[panelType] || 300;
      if (!overlaySideWindow || overlaySideWindow.isDestroyed()) {
        createSideWindow(null, useWidth);
      }
      if (!overlaySideWindow || overlaySideWindow.isDestroyed()) {
        return {
          success: false,
          error: i18n.t("backend.overlay.window.failedToCreateSideWindow")
        };
      }
      const alreadyVisible = overlaySideWindow.isVisible() && overlaySideWindow.getOpacity() > 0;
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        const mainBounds = overlayWindow.getBounds();
        const sideX = mainBounds.x - useWidth - OVERLAY_SIDE_GAP;
        overlaySideWindow.setBounds({
          x: sideX,
          y: mainBounds.y,
          width: useWidth,
          height: mainBounds.height
        });
      }
      const sendContent = () => {
        if (canShowSide() && overlaySideWindow && !overlaySideWindow.isDestroyed()) {
          overlaySideContentKey = content?.requestKey || null;
          overlaySideWindow.webContents.send("side-panel-content", {
            ...(content || {}),
            gameId,
            currentWidth: useWidth
          });
        }
      };
      if (overlaySideWindow.webContents.isLoading()) {
        await new Promise(resolve => {
          overlaySideWindow.webContents.once("did-finish-load", () => {
            sendContent();
            resolve();
          });
        });
      } else {
        sendContent();
      }
      if (!alreadyVisible) {
        await new Promise(resolve => setTimeout(resolve, 20));
        if (!canShowSide()) return {
          success: false,
          cancelled: true
        };
        const compatibilityMode = configStore.isStrongCompatibilityModeEnabled();
        overlaySideWindow.setOpacity(compatibilityMode ? 1 : 0);
        overlaySideWindow.setAlwaysOnTop(true, "screen-saver");
        overlaySideWindow.showInactive();
        if (!compatibilityMode) {
          setTimeout(() => {
            if (overlaySideWindow && !overlaySideWindow.isDestroyed()) {
              overlaySideWindow.setOpacity(1);
            }
          }, 30);
        }
      }
      return {
        success: true
      };
    } catch (e) {
      return {
        success: false,
        error: e.message
      };
    }
  });
  electron.ipcMain.handle("overlay-hide-side", async () => {
    hideSideWindow(true);
    return {
      success: true
    };
  });
  electron.ipcMain.handle("overlay-open-manager-view", async (_, {
    characterName,
    modName
  } = {}) => {
    try {
      const mainWin = desktopWindows.mainWindowRef || electron.BrowserWindow.getAllWindows().find(w => w !== overlayWindow && w !== overlaySideWindow);
      if (!mainWin || mainWin.isDestroyed()) {
        return {
          success: false,
          error: i18n.t("backend.overlay.window.mainWindowMissing")
        };
      }
      hideOverlayWindow({
        intentionalSideClose: true
      });
      if (mainWin.isMinimized()) mainWin.restore();
      mainWin.show();
      mainWin.focus();
      mainWin.webContents.send("open-manager-target", {
        characterName,
        modName,
        timestamp: Date.now()
      });
      return {
        success: true
      };
    } catch (e) {
      return {
        success: false,
        error: e.message
      };
    }
  });
  electron.ipcMain.handle("overlay-resize-side", async (_, newWidth) => {
    if (!overlaySideWindow || overlaySideWindow.isDestroyed() || !overlayWindow) return {
      success: false
    };
    const w = Math.max(200, Math.min(550, newWidth));
    lastSideWidths[currentSidePanelType] = w;
    configStore.currentConfig.sidePanelWidths = lastSideWidths;
    configStore.saveConfig(configStore.currentConfig);
    const mainBounds = overlayWindow.getBounds();
    const sideX = mainBounds.x - w - OVERLAY_SIDE_GAP;
    overlaySideWindow.setBounds({
      x: sideX,
      y: mainBounds.y,
      width: w,
      height: mainBounds.height
    });
    return {
      success: true,
      width: w
    };
  });
  electron.ipcMain.handle("overlay-update-side", async (_, content) => {
    if ((content?.requestKey || null) !== overlaySideContentKey) return {
      success: false,
      cancelled: true
    };
    if (overlaySideWindow && !overlaySideWindow.isDestroyed()) {
      overlaySideWindow.webContents.send("side-panel-content", {
        ...content,
        gameId: gamesSettings.getActiveGameScopeId()
      });
    }
    return {
      success: true
    };
  });
  electron.ipcMain.handle("overlay-select-char-from-side", async (_, charName) => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.focus();
    }
    hideSideWindow(true);
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.webContents.send("overlay-char-selected", charName);
    }
    return {
      success: true
    };
  });
  electron.ipcMain.handle("overlay-hide", async () => {
    hideOverlayWindow({
      resetPin: true
    });
    return {
      success: true
    };
  });
  electron.ipcMain.handle("overlay-toggle-pin", async (_, pinned) => {
    overlayPinned = !!pinned;
    return {
      success: true
    };
  });
  electron.ipcMain.handle("overlay-change-hotkey", async (_, newHotkey) => {
    try {
      const accelerator = newHotkey.replace(/\s*\+\s*/g, "+");
      const success = registerOverlayHotkey(accelerator);
      if (success) {
        configStore.currentConfig.overlayHotkey = accelerator;
        configStore.saveConfig(configStore.currentConfig);
        return {
          success: true,
          hotkey: accelerator
        };
      } else {
        return {
          success: false,
          error: i18n.t("backend.overlay.window.hotkeyFallbackRegistered", {
            accelerator,
            currentOverlayHotkey
          })
        };
      }
    } catch (e) {
      return {
        success: false,
        error: e.message
      };
    }
  });
  electron.ipcMain.handle("get-overlay-hotkey", async () => {
    return {
      success: true,
      hotkey: currentOverlayHotkey,
      configured: configStore.currentConfig.overlayHotkey || "Alt+F"
    };
  });
  electron.ipcMain.handle("set-overlay-hotkey", async (_, newHotkey) => {
    try {
      const accelerator = newHotkey.replace(/\s*\+\s*/g, "+");
      const success = registerOverlayHotkey(accelerator);
      if (success) {
        configStore.currentConfig.overlayHotkey = accelerator;
        configStore.saveConfig(configStore.currentConfig);
        return {
          success: true,
          hotkey: accelerator
        };
      } else {
        return {
          success: false,
          error: i18n.t("backend.overlay.window.hotkeyRegistrationFailed", {
            accelerator,
            currentOverlayHotkey
          }),
          hotkey: currentOverlayHotkey
        };
      }
    } catch (e) {
      return {
        success: false,
        error: e.message
      };
    }
  });
  electron.ipcMain.handle("toggle-overlay-from-ui", async () => {
    try {
      const mainWin = electron.BrowserWindow.getAllWindows().find(w => w !== overlayWindow && w !== overlaySideWindow);
      if (mainWin && !mainWin.isDestroyed()) {
        mainWin.minimize();
      }
      toggleOverlay();
      return {
        success: true
      };
    } catch (e) {
      return {
        success: false,
        error: e.message
      };
    }
  });
  electron.ipcMain.handle("overlay-get-presets", async () => {
    try {
      const data = presetsService.loadPresets();
      return {
        success: true,
        presets: presetsService.withBuiltinPresets(data.presets || []),
        activePresetId: data.activePresetId
      };
    } catch (e) {
      return {
        success: true,
        presets: presetsService.withBuiltinPresets([])
      };
    }
  });
  electron.ipcMain.handle("overlay-activate-preset", async (_, presetName) => {
    try {
      const gameId2 = gamesSettings.getActiveGameScopeId();
      const presetsData = presetsService.loadPresets();
      const preset = presetsService.findPresetByName(presetsData, presetName);
      if (!preset) return {
        success: false,
        error: i18n.t("backend.overlay.window.presetMissing")
      };
      const applyResult = await presetsService.applyPresetModsForGame(preset, gameId2);
      if (!applyResult?.success) {
        return {
          success: false,
          error: applyResult?.error || i18n.t("backend.overlay.window.presetApplyFailed")
        };
      }
      if (configStore.currentConfig.overlayPresetAutoReloadEnabled) {
        await overlayHelper.triggerOverlayReload();
      }
      const localPresetData = presetsService.loadPresets();
      localPresetData.activePresetId = preset.id;
      presetsService.savePresets(localPresetData);
      presetsService.notifyPresetApplicationChanged();
      return {
        success: true,
        autoReloaded: !!configStore.currentConfig.overlayPresetAutoReloadEnabled,
        results: applyResult.results
      };
    } catch (e) {
      return {
        success: false,
        error: e.message
      };
    }
  });
}
Object.assign(module.exports, {
  OVERLAY_PREWARM_DELAY_MS
});
