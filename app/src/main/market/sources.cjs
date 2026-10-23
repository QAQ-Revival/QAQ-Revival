"use strict";

const i18n = require("../../shared/i18n/core.cjs");
module.exports = {
  registerIpc,
  get pawchiveService() {
    return pawchiveService;
  },
  get kemonoService() {
    return kemonoService;
  },
  get siteSessions() {
    return siteSessions;
  },
  get modSiteContent() {
    return modSiteContent;
  }
};
const electron = require("electron");
const {
  registerPawchiveIpc
} = require("./pawchive.cjs");
const {
  registerRevivalIpc
} = require("./mega/task-manager.cjs");
const {
  registerSiteSessions
} = require("./sites/sessions.cjs");
const {
  createGameBananaService
} = require("./sites/gamebanana.cjs");
const {
  createSiteContent
} = require("./sites/content.cjs");
const {
  registerSoftwareUpdates
} = require("../runtime/software-updates.cjs");
const {
  registerHotkeyTranslation
} = require("../overlay/hotkey-translation.cjs");
const marketDownloads = require("./downloads.cjs");
const marketSettings = require("./settings.cjs");
let pawchiveService;
let kemonoService;
let siteSessions;
let gamebananaService;
let modSiteContent;
function registerIpc() {
  registerHotkeyTranslation({
    ipcMain: electron.ipcMain,
    fetch: (...args) => electron.net.fetch(...args)
  });
  pawchiveService = registerPawchiveIpc({
    ipcMain: electron.ipcMain,
    app: electron.app,
    BrowserWindow: electron.BrowserWindow,
    powerMonitor: electron.powerMonitor,
    userData: electron.app.getPath("userData"),
    fetch: (...args) => electron.net.fetch(...args)
  });
  kemonoService = registerPawchiveIpc({
    source: 'kemono',
    ipcMain: electron.ipcMain,
    app: electron.app,
    BrowserWindow: electron.BrowserWindow,
    powerMonitor: electron.powerMonitor,
    userData: electron.app.getPath("userData"),
    fetch: (...args) => electron.net.fetch(...args)
  });
  siteSessions = registerSiteSessions({
    ipcMain: electron.ipcMain,
    app: electron.app,
    session: electron.session,
    BrowserWindow: electron.BrowserWindow,
    BrowserView: electron.BrowserView,
    userData: electron.app.getPath("userData"),
    onDownload: payload => marketDownloads.archiveDownloadManager?.adoptBrowserDownload(payload) || false
  });
  gamebananaService = createGameBananaService({
    fetch: (...args) => siteSessions.fetch('gamebanana', ...args)
  });
  modSiteContent = createSiteContent({
    sessions: siteSessions,
    gamebanana: gamebananaService
  });
  for (const [channel, method] of [['list', 'list'], ['detail', 'getPost']]) {
    electron.ipcMain.handle('mod-sites:' + channel, async (_event, payload) => {
      try {
        return {
          success: true,
          ...(await modSiteContent[method](payload))
        };
      } catch (error) {
        return {
          success: false,
          error: error.message || i18n.t("backend.market.sources.siteContentFailed"),
          code: error.code,
          verifyUrl: error.verifyUrl
        };
      }
    });
  }
  for (const [channel, method] of [['list', 'list'], ['detail', 'getPost']]) {
    electron.ipcMain.handle('gamebanana:' + channel, async (_event, payload) => {
      try {
        return {
          success: true,
          ...(await gamebananaService[method](payload))
        };
      } catch (error) {
        return {
          success: false,
          error: error.message || i18n.t("backend.market.sources.gamebananaRequestFailed")
        };
      }
    });
  }
  registerRevivalIpc({
    ipcMain: electron.ipcMain,
    app: electron.app,
    BrowserWindow: electron.BrowserWindow,
    shell: electron.shell,
    userData: electron.app.getPath("userData"),
    getCacheDir: marketSettings.ensureMarketDownloadCacheDir
  });
  registerSoftwareUpdates({
    ipcMain: electron.ipcMain,
    app: electron.app,
    BrowserWindow: electron.BrowserWindow,
    powerMonitor: electron.powerMonitor,
    shell: electron.shell,
    userData: electron.app.getPath("userData"),
    fetch: (...args) => electron.net.fetch(...args)
  });
}
