"use strict";

const i18n = require("../../shared/i18n/core.cjs");
module.exports = {
  configureRuntime,
  registerIpc,
  activateMainWindow,
  createWindow,
  createTray,
  get runtimeIdentity() {
    return runtimeIdentity;
  },
  get mainWindowRef() {
    return mainWindowRef;
  }
};
const electron = require("electron");
const path = require("path");
const utils = require("@electron-toolkit/utils");
const {
  readWindowState,
  trackWindowState
} = require("./window-state.cjs");
const { createNativeTray } = require("./tray-host.cjs");
const {
  enableNativeFileDrop
} = require("./native-file-drop.cjs");
const configStore = require("../config/store.cjs");
const coreLogger = require("../core/logger.cjs");
const gamesGenshinServices = require("../games/genshin/service.cjs");
const overlayWindow = require("../overlay/window.cjs");
const runtimePaths = require("../runtime/paths.cjs");
const systemWindows = require("../system/windows.cjs");
let runtimeIdentity = {};
let mainWindowRef = null;
let tray = null;
let isQuitting = false;
function getMainWindowState() {
  return {
    success: true,
    maximized: mainWindowRef.isMaximized(),
    focused: mainWindowRef.isFocused()
  };
}
function isMainWindowSender(event) {
  return mainWindowRef && !mainWindowRef.isDestroyed() && event.sender === mainWindowRef.webContents;
}
function activateMainWindow() {
  if (isQuitting) return;
  const mainWindow = mainWindowRef && !mainWindowRef.isDestroyed() ? mainWindowRef : createWindow();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}
function createWindow() {
  const windowStatePath = path.join(electron.app.getPath("userData"), "window-state.json");
  const windowState = readWindowState(windowStatePath, electron.screen.getPrimaryDisplay().workArea);
  const mainWindow = new electron.BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    frame: false,
    show: false,
    backgroundColor: "#f6f1ea",
    autoHideMenuBar: true,
    title: runtimeIdentity.name || "QAQ-Revival",
    icon: path.join(runtimePaths.mainDir, "../../resources/icon.ico"),
    webPreferences: {
      preload: path.join(runtimePaths.mainDir, "../preload/index.js"),
      sandbox: false,
      webSecurity: false
    }
  });
  trackWindowState(mainWindow, windowStatePath, error => coreLogger.logger.warn("Failed to save window state:", error.message));
  try {
    enableNativeFileDrop(mainWindow, {
      ipcMain: electron.ipcMain,
      preferLegacy: systemWindows.isProcessElevated(),
      onDrop: drop => {
        coreLogger.logger.info(`Native file drop received: ${drop.paths.length} item(s)`);
        if (!mainWindow.webContents.isDestroyed()) mainWindow.webContents.send("files:native-drop", drop);
      },
      onError: error => coreLogger.logger.warn("Native file drop failed:", error.message)
    });
  } catch (error) {
    coreLogger.logger.warn("Native file drop unavailable:", error.message);
  }
  let hasShownMainWindow = false;
  if (runtimeIdentity.name) {
    mainWindow.on("page-title-updated", event => {
      event.preventDefault();
      mainWindow.setTitle(runtimeIdentity.name);
    });
  }
  for (const event of ["maximize", "unmaximize", "focus", "blur"]) {
    mainWindow.on(event, () => {
      if (mainWindowRef === mainWindow && !mainWindow.webContents.isDestroyed()) {
        mainWindow.webContents.send("window:state", getMainWindowState());
      }
    });
  }
  let pageDidLoad = false;
  const reloadMainWindow = () => {
    if (mainWindow.isDestroyed()) return;
    coreLogger.logger.info("Reloading main window...");
    if (utils.is.dev && process.env["ELECTRON_RENDERER_URL"]) {
      mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
    } else {
      mainWindow.loadFile(path.join(runtimePaths.mainDir, "../renderer/index.html"));
    }
  };
  const showMainWindow = reason => {
    if (hasShownMainWindow || mainWindow.isDestroyed()) return;
    hasShownMainWindow = true;
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (windowState.maximized) mainWindow.maximize();
    mainWindow.show();
    coreLogger.logger.info(`Main window shown via ${reason}`);
    if (reason === "startup-timeout" && !pageDidLoad) {
      coreLogger.logger.info("Page not loaded yet after timeout — scheduling reload...");
      setTimeout(() => {
        if (!pageDidLoad && !mainWindow.isDestroyed()) {
          reloadMainWindow();
        }
      }, 2e3);
    }
  };
  const mainWindowShowFallback = setTimeout(() => {
    showMainWindow("startup-timeout");
  }, 2500);
  mainWindow.once("ready-to-show", () => {
    clearTimeout(mainWindowShowFallback);
    showMainWindow("ready-to-show");
  });
  mainWindow.webContents.on("did-finish-load", () => {
    pageDidLoad = true;
    clearTimeout(mainWindowShowFallback);
    showMainWindow("did-finish-load");
    gamesGenshinServices.genshinAntiCrash.recoverOrphan().catch(e => coreLogger.logger.warn("[Genshin] Anti-error session recovery failed:", e?.message || e));
  });
  let loadRetryCount = 0;
  const MAX_LOAD_RETRIES = 3;
  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    coreLogger.logger.error("Main window failed to load:", `${errorCode} ${errorDescription}`, validatedURL || "unknown-url");
    if (loadRetryCount < MAX_LOAD_RETRIES && !mainWindow.isDestroyed()) {
      loadRetryCount++;
      const delay = loadRetryCount * 1e3;
      coreLogger.logger.info(`Retrying page load (attempt ${loadRetryCount}/${MAX_LOAD_RETRIES}) in ${delay}ms...`);
      setTimeout(() => {
        if (mainWindow.isDestroyed()) return;
        if (utils.is.dev && process.env["ELECTRON_RENDERER_URL"]) {
          mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
        } else {
          mainWindow.loadFile(path.join(runtimePaths.mainDir, "../renderer/index.html"));
        }
      }, delay);
    } else {
      clearTimeout(mainWindowShowFallback);
      showMainWindow("did-fail-load");
    }
  });
  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    coreLogger.logger.error("Main window render process gone:", details);
  });
  mainWindow.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    const levelName = ["debug", "info", "warn", "error"][level] || `level-${level}`;
    coreLogger.logger.info(`Renderer console [${levelName}] ${message}`, `${sourceId || "unknown"}:${line || 0}`);
  });
  mainWindow.webContents.on("preload-error", (_event, preloadPath, error) => {
    coreLogger.logger.error("Main window preload error:", preloadPath, error);
  });
  mainWindow.on("closed", () => {
    clearTimeout(mainWindowShowFallback);
    if (mainWindowRef === mainWindow) {
      mainWindowRef = null;
    }
  });
  mainWindow.webContents.setWindowOpenHandler(details => {
    electron.shell.openExternal(details.url);
    return {
      action: "deny"
    };
  });
  mainWindow.on("close", async e => {
    if (isQuitting) return;
    const behavior = configStore.currentConfig.closeBehavior || "ask";
    if (behavior === "minimize") {
      e.preventDefault();
      mainWindow.hide();
      return false;
    }
    if (behavior === "quit") {
      isQuitting = true;
      if (overlayWindow.overlayWindow && !overlayWindow.overlayWindow.isDestroyed()) overlayWindow.overlayWindow.close();
      if (overlayWindow.overlaySideWindow && !overlayWindow.overlaySideWindow.isDestroyed()) overlayWindow.overlaySideWindow.close();
      return;
    }
    e.preventDefault();
    const result = await electron.dialog.showMessageBox(mainWindow, {
      type: "question",
      title: i18n.t("backend.desktop.windows.closeTitle"),
      message: i18n.t("backend.desktop.windows.closePrompt"),
      buttons: [i18n.t("backend.desktop.windows.minimizeToTray"), i18n.t("backend.desktop.windows.quit"), i18n.t("backend.desktop.windows.cancel")],
      defaultId: 0,
      cancelId: 2,
      checkboxLabel: i18n.t("backend.desktop.windows.rememberCloseChoice"),
      checkboxChecked: false
    });
    if (result.response === 2) return;
    if (result.checkboxChecked) {
      configStore.currentConfig.closeBehavior = result.response === 0 ? "minimize" : "quit";
      configStore.saveConfig(configStore.currentConfig);
    }
    if (result.response === 0) {
      mainWindow.hide();
    } else {
      isQuitting = true;
      if (overlayWindow.overlayWindow && !overlayWindow.overlayWindow.isDestroyed()) overlayWindow.overlayWindow.close();
      if (overlayWindow.overlaySideWindow && !overlayWindow.overlaySideWindow.isDestroyed()) overlayWindow.overlaySideWindow.close();
      electron.app.quit();
    }
  });
  if (utils.is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(path.join(runtimePaths.mainDir, "../renderer/index.html"));
  }
  mainWindowRef = mainWindow;
  return mainWindow;
}
function createTray() {
  const iconPath = path.join(runtimePaths.mainDir, "../../resources/icon.ico");
  const quit = () => {
    isQuitting = true;
    if (overlayWindow.overlayWindow && !overlayWindow.overlayWindow.isDestroyed()) overlayWindow.overlayWindow.close();
    if (overlayWindow.overlaySideWindow && !overlayWindow.overlaySideWindow.isDestroyed()) overlayWindow.overlaySideWindow.close();
    electron.app.quit();
  };
  const contextMenu = electron.Menu.buildFromTemplate([{
    label: i18n.t("backend.desktop.windows.showWindow"),
    click: activateMainWindow
  }, {
    type: "separator"
  }, {
    label: i18n.t("backend.desktop.windows.quitApplication"),
    click: quit
  }]);
  const fallback = () => {
    tray = new electron.Tray(iconPath);
    tray.setToolTip("QAQ-Revival");
    tray.setContextMenu(contextMenu);
    tray.on("double-click", activateMainWindow);
  };
  if (!createNativeTray({
    app: electron.app, icon: iconPath,
    showLabel: i18n.t("backend.desktop.windows.showWindow"),
    quitLabel: i18n.t("backend.desktop.windows.quitApplication"),
    onShow: activateMainWindow, onQuit: quit, onFallback: fallback,
    onError: error => coreLogger.logger.warn("Native tray unavailable:", error.message)
  })) fallback();
}
function configureRuntime(identity) {
  runtimeIdentity = identity;
}
function registerIpc() {
  electron.ipcMain.handle("window:get-state", event => {
    if (!isMainWindowSender(event)) return {
      success: false,
      error: i18n.t("backend.desktop.windows.mainWindowUnavailable")
    };
    return getMainWindowState();
  });
  electron.ipcMain.handle("window:control", (event, action) => {
    if (!isMainWindowSender(event)) return {
      success: false,
      error: i18n.t("backend.desktop.windows.mainWindowUnavailable")
    };
    if (action === "minimize") mainWindowRef.minimize();else if (action === "maximize") {
      if (mainWindowRef.isMaximized()) mainWindowRef.unmaximize();else mainWindowRef.maximize();
    } else if (action === "close") mainWindowRef.close();else return {
      success: false,
      error: i18n.t("backend.desktop.windows.unknownWindowAction")
    };
    return {
      success: true
    };
  });
}
