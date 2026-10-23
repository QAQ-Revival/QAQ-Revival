"use strict";

const electron = require("electron");
const path = require("path");
const utils = require("@electron-toolkit/utils");
const {
  COVER_SCHEME
} = require("../characters/image-cache.cjs");
const charactersCatalog = require("../characters/catalog.cjs");
const configStore = require("../config/store.cjs");
const coreLogger = require("../core/logger.cjs");
const desktopWindows = require("./windows.cjs");
const gamesGenshinServices = require("../games/genshin/service.cjs");
const gamesPathWarning = require("../games/path-warning.cjs");
const overlayKeypress = require("../overlay/keypress.cjs");
const overlayWindow = require("../overlay/window.cjs");
const runtimePaths = require("../runtime/paths.cjs");
function applyChromiumStabilityFlags() {
  electron.app.commandLine.appendSwitch("disable-features", "NetworkServiceInProcess2");
  electron.app.commandLine.appendSwitch("disable-gpu-sandbox");
  if (!configStore.isStrongCompatibilityModeEnabled()) return;
  electron.app.disableHardwareAcceleration();
  electron.app.commandLine.appendSwitch("disable-gpu");
  electron.app.commandLine.appendSwitch("disable-gpu-compositing");
  electron.app.commandLine.appendSwitch("disable-gpu-rasterization");
  electron.app.commandLine.appendSwitch("disable-accelerated-2d-canvas");
  electron.app.commandLine.appendSwitch("disable-zero-copy");
}
function start() {
  applyChromiumStabilityFlags();
  electron.app.whenReady().then(() => {
    electron.protocol.handle(COVER_SCHEME, request => charactersCatalog.characterImageCache.handle(request));
    utils.electronApp.setAppUserModelId(desktopWindows.runtimeIdentity.name || "com.qaqmanager.revival");
    electron.app.on("browser-window-created", (_, window) => {
      utils.optimizer.watchWindowShortcuts(window);
    });
    electron.app.on("child-process-gone", (_event, details) => {
      coreLogger.logger.error("Child process gone:", JSON.stringify(details));
      if (details.type === "Utility" || details.type === "GPU") {
        setTimeout(() => {
          const mainWin = desktopWindows.mainWindowRef;
          if (!mainWin || mainWin.isDestroyed()) return;
          const currentURL = mainWin.webContents.getURL();
          if (!currentURL || currentURL === "about:blank" || currentURL === "") {
            coreLogger.logger.info("Main window appears blank after child process crash — reloading...");
            if (utils.is.dev && process.env["ELECTRON_RENDERER_URL"]) {
              mainWin.loadURL(process.env["ELECTRON_RENDERER_URL"]);
            } else {
              mainWin.loadFile(path.join(runtimePaths.mainDir, "../renderer/index.html"));
            }
          }
        }, 2e3);
      }
    });
    electron.session.defaultSession.webRequest.onBeforeSendHeaders({
      urls: ["*://*.ngrok-free.dev/*", "*://*.ngrok.io/*"]
    }, (details, callback) => {
      details.requestHeaders["ngrok-skip-browser-warning"] = "true";
      callback({
        requestHeaders: details.requestHeaders
      });
    });
    const mainWindow = desktopWindows.createWindow();
    setTimeout(() => {
      gamesPathWarning.showDangerousManagedPathStartupWarning(mainWindow).catch(error => {
        coreLogger.logger.warn("Failed to show dangerous path warning:", error?.message || error);
      });
    }, 1e3);
    desktopWindows.createTray();
    if (!configStore.isCompatibilityModeEnabled()) {
      setTimeout(() => {
        overlayWindow.createOverlayWindow().catch(error => {
          coreLogger.logger.warn("Failed to prewarm overlay window:", error?.message || error);
        });
      }, overlayWindow.OVERLAY_PREWARM_DELAY_MS);
    } else {
      coreLogger.logger.info("Compatibility mode enabled; skipping overlay prewarm.");
    }
    overlayWindow.registerOverlayHotkey(configStore.currentConfig.overlayHotkey || "Alt+F");
    try {
      overlayKeypress.setBackgroundKeypressEnabled(overlayKeypress.shouldEnableOverlayBackgroundKeypress());
    } catch (e) {
      coreLogger.logger.warn("Failed to init background keypress mode:", e?.message || e);
    }
    electron.app.on("activate", desktopWindows.activateMainWindow);
  });
  electron.app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      electron.app.quit();
    }
  });
  electron.app.on("will-quit", () => {
    try {
      overlayKeypress.setBackgroundKeypressEnabled(false);
    } catch (e) {
      coreLogger.logger.warn("Failed to reset background keypress before quit:", e?.message || e);
    }
    electron.globalShortcut.unregisterAll();
    // Best effort: leftovers from an interrupted anti-error session are recovered on next start.
    gamesGenshinServices.genshinAntiCrash.cleanup({
      force: false,
      quiet: true
    }).catch(() => {});
  });
}
module.exports = {
  start
};
