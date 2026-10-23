"use strict";

const i18n = require("../../shared/i18n/core.cjs");
module.exports = {
  registerIpc,
  createMarketDownloadControl,
  sendMarketDownloadProgress,
  resumeMarketDownloadControl,
  downloadMarketFile,
  formatMarketDownloadError,
  installMarketArchiveFromPath,
  get archiveDownloadManager() {
    return archiveDownloadManager;
  }
};
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const {
  registerArchiveDownloads
} = require("./archive-downloads.cjs");
const crypto = require("crypto");
const desktopWindows = require("../desktop/windows.cjs");
const developerMarkedMove = require("../developer/marked-move.cjs");
const importsLocal = require("../imports/local.cjs");
const marketSettings = require("./settings.cjs");
const marketSources = require("./sources.cjs");
const modsAppearance = require("../mods/appearance.cjs");
const netQaqm = require("../net/qaqm.cjs");
const systemWindows = require("../system/windows.cjs");
let archiveDownloadManager;
function sanitizeDownloadFileName(value, fallback = "market-mod.7z") {
  const raw = String(value || "").trim() || fallback;
  return raw.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").slice(0, 180) || fallback;
}
const marketDownloadControls = new Map();
function createMarketDownloadControl(taskId, sender) {
  const control = {
    taskId,
    sender,
    paused: false,
    canceled: false,
    abortController: null,
    waiters: [],
    lastProgress: null,
    lastActiveStatus: "downloading"
  };
  marketDownloadControls.set(taskId, control);
  return control;
}
function sendMarketDownloadProgress(sender, taskId, payload = {}, control = null) {
  const progress = {
    taskId,
    ...payload
  };
  if (control) {
    control.sender = sender;
    control.lastProgress = {
      ...(control.lastProgress || {}),
      ...progress
    };
    if (progress.status && progress.status !== "paused") control.lastActiveStatus = progress.status;
  }
  sender.send("market:download-progress", progress);
}
async function waitForMarketDownloadResume(control) {
  while (control?.paused) {
    await new Promise(resolve => control.waiters.push(resolve));
  }
  if (control?.canceled) {
    const error = new Error(i18n.t("backend.archiveDownloads.downloadCanceled"));
    error.code = "DOWNLOAD_CANCELED";
    throw error;
  }
}
function resumeMarketDownloadControl(control) {
  if (!control) return;
  control.paused = false;
  const waiters = control.waiters.splice(0);
  waiters.forEach(resolve => resolve());
}
async function revealDownloadedArchive(archivePath) {
  const targetPath = String(archivePath || "").trim();
  if (!targetPath) return {
    success: false,
    error: i18n.t("backend.market.downloads.archivePathEmpty")
  };
  if (!fs.existsSync(targetPath)) return {
    success: false,
    error: i18n.t("backend.market.downloads.archiveMissing")
  };
  const stat = fs.statSync(targetPath);
  if (stat.isFile()) {
    electron.shell.showItemInFolder(targetPath);
    return {
      success: true
    };
  }
  const openError = await electron.shell.openPath(targetPath);
  if (openError) return {
    success: false,
    error: openError
  };
  return {
    success: true
  };
}
async function fetchMarketDownloadResponse(url, abortController2, options = {}) {
  const requestOptions = {
    signal: abortController2.signal,
    headers: options.headers || {}
  };
  return (options.fetch || netQaqm.fetchWithElectronNet)(url, requestOptions);
}
function getMarketDownloadResumePath(downloadDir, fileName, download = {}) {
  const identity = String(download.sha256 || download.objectKey || download.modId || download.url || fileName);
  const key = crypto.createHash("sha256").update(identity).digest("hex").slice(0, 16);
  return path.join(downloadDir, `${key}-${fileName}`);
}
function parseContentRangeTotal(value) {
  const match = String(value || "").match(/\/(\d+|\*)\s*$/);
  if (!match || match[1] === "*") return 0;
  const total = Number(match[1]);
  return Number.isFinite(total) ? total : 0;
}
const MARKET_DOWNLOAD_STALL_TIMEOUT_MS = 15 * 1e3;
function readMarketDownloadChunk(reader, abortController2) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        abortController2.abort();
      } catch (_) {}
      const error = new Error(i18n.t("backend.market.downloads.transferStalled"));
      error.code = "DOWNLOAD_STALLED";
      reject(error);
    }, MARKET_DOWNLOAD_STALL_TIMEOUT_MS);
    reader.read().then(result => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    }, error => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
  });
}
async function downloadMarketFile(event, taskId, download, control = null, fetchImpl = netQaqm.fetchWithElectronNet) {
  const fileName = sanitizeDownloadFileName(download?.fileName);
  const downloadDir = marketSettings.ensureMarketDownloadCacheDir();
  fs.mkdirSync(downloadDir, {
    recursive: true
  });
  const targetPath = getMarketDownloadResumePath(downloadDir, fileName, download);
  const abortController2 = new AbortController();
  if (control) control.abortController = abortController2;
  let writer = null;
  let reader = null;
  try {
    await waitForMarketDownloadResume(control);
    let existingSize = 0;
    try {
      if (fs.existsSync(targetPath)) {
        const stat = fs.statSync(targetPath);
        if (stat.isFile()) existingSize = stat.size;
      }
    } catch (_) {
      existingSize = 0;
    }
    const expectedTotal = Number(download.fileSize || 0) || 0;
    if (expectedTotal > 0 && existingSize > expectedTotal) {
      try {
        fs.unlinkSync(targetPath);
      } catch (_) {}
      existingSize = 0;
    }
    const headers = existingSize > 0 ? {
      Range: `bytes=${existingSize}-`
    } : {};
    let response = await fetchMarketDownloadResponse(download.url, abortController2, {
      headers,
      fetch: fetchImpl
    });
    const rangeSatisfiedTotal = parseContentRangeTotal(response.headers.get("content-range"));
    const completedTotal = expectedTotal || rangeSatisfiedTotal;
    if (response.status === 416 && existingSize > 0 && completedTotal > 0 && existingSize >= completedTotal) {
      const existingHash = download.sha256 ? await developerMarkedMove.hashFileForIntegrity(targetPath) : "";
      if (!download.sha256 || existingHash.toLowerCase() === String(download.sha256).toLowerCase()) {
        sendMarketDownloadProgress(event.sender, taskId, {
          status: "downloaded",
          downloaded: existingSize,
          total: completedTotal,
          percent: 100,
          speed: 0,
          fileName,
          archivePath: targetPath,
          resumedBytes: existingSize
        }, control);
        return targetPath;
      }
      fs.unlinkSync(targetPath);
      existingSize = 0;
      response = await fetchMarketDownloadResponse(download.url, abortController2, {
        headers: {},
        fetch: fetchImpl
      });
    }
    if (existingSize > 0 && response.status !== 206) {
      try {
        await response.body?.cancel?.();
      } catch (_) {}
      try {
        fs.unlinkSync(targetPath);
      } catch (_) {}
      existingSize = 0;
      response = await fetchMarketDownloadResponse(download.url, abortController2, {
        headers: {},
        fetch: fetchImpl
      });
    }
    if (!response.ok || !response.body) {
      throw new Error(i18n.t("backend.market.downloads.downloadHttpError", {
        status: response.status
      }));
    }
    if (download.rejectHtml && /text\/html|application\/xhtml/i.test(response.headers.get('content-type') || '')) {
      await response.body.cancel();
      throw new Error(i18n.t("backend.market.downloads.downloadReturnedPage"));
    }
    const contentLength = Number(response.headers.get("content-length") || 0) || 0;
    const rangeTotal = parseContentRangeTotal(response.headers.get("content-range"));
    const total = expectedTotal || rangeTotal || existingSize + contentLength || 0;
    const append = existingSize > 0 && response.status === 206;
    writer = fs.createWriteStream(targetPath, {
      flags: append ? "a" : "w",
      highWaterMark: 4 * 1024 * 1024
    });
    const finished = new Promise((resolve, reject) => {
      writer.once("finish", resolve);
      writer.once("error", reject);
    });
    reader = response.body.getReader();
    let downloaded = existingSize;
    let sessionDownloaded = 0;
    let lastEmit = 0;
    const startedAt = Date.now();
    const emit = (extra = {}) => {
      sendMarketDownloadProgress(event.sender, taskId, {
        status: "downloading",
        downloaded,
        total,
        percent: total > 0 ? Math.min(100, Math.round(downloaded / total * 100)) : 0,
        speed: sessionDownloaded / Math.max(1, (Date.now() - startedAt) / 1e3),
        downloadMode: "direct",
        limited: download.limited === true,
        resumedBytes: existingSize,
        ...extra
      }, control);
    };
    emit({
      fileName
    });
    while (true) {
      await waitForMarketDownloadResume(control);
      const {
        done,
        value
      } = await reader.read();
      if (done) break;
      const chunk = Buffer.from(value);
      downloaded += chunk.length;
      sessionDownloaded += chunk.length;
      if (!writer.write(chunk)) {
        await new Promise(resolve => writer.once("drain", resolve));
      }
      const now = Date.now();
      if (now - lastEmit > 350) {
        lastEmit = now;
        emit();
      }
    }
    writer.end();
    await finished;
    const sha256 = download.sha256 ? await developerMarkedMove.hashFileForIntegrity(targetPath) : "";
    if (download.sha256 && sha256.toLowerCase() !== String(download.sha256).toLowerCase()) {
      try {
        fs.unlinkSync(targetPath);
      } catch (_) {}
      throw new Error(i18n.t("backend.market.downloads.downloadIntegrityFailed"));
    }
    sendMarketDownloadProgress(event.sender, taskId, {
      status: "downloaded",
      downloaded,
      total: total || downloaded,
      percent: 100,
      speed: sessionDownloaded / Math.max(1, (Date.now() - startedAt) / 1e3),
      downloadMode: "direct",
      limited: download.limited === true,
      fileName,
      archivePath: targetPath,
      resumedBytes: existingSize
    }, control);
    return targetPath;
  } catch (error) {
    try {
      await reader?.cancel?.();
    } catch (_) {}
    try {
      writer?.destroy?.();
    } catch (_) {}
    if (control?.canceled || error?.name === "AbortError" || error?.code === "DOWNLOAD_CANCELED") {
      try {
        if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
      } catch (_) {}
      const canceledError = new Error(i18n.t("backend.archiveDownloads.downloadCanceled"));
      canceledError.code = "DOWNLOAD_CANCELED";
      throw canceledError;
    }
    throw error;
  } finally {
    if (control?.abortController === abortController2) control.abortController = null;
  }
}
function formatMarketDownloadError(code, message) {
  const raw = String(message || "").trim();
  if (code === "LOGIN_REQUIRED" || code === "SESSION_EXPIRED") {
    return i18n.t("backend.market.downloads.externalLoginRequired");
  }
  if (code === "DIRECT_DOWNLOAD_REQUIRED" || code === "SPONSOR_REQUIRED" || /全部档|最高档|高速下载|直链下载|赞助|QAQM Plus/.test(raw)) {
    return i18n.t("backend.market.downloads.externalSourceUnavailable");
  }
  return raw || i18n.t("backend.market.downloads.downloadUrlMissing");
}
function marketModHasIntegratedPackageTag(mod = {}) {
  const values = [];
  const collect = value => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(collect);
      return;
    }
    if (typeof value === "object") {
      collect(value.name || value.label || value.title || value.value);
      return;
    }
    values.push(String(value).trim().toLowerCase());
  };
  collect(mod.tags);
  collect(mod.tagNames);
  collect(mod.tagList);
  collect(mod.categories);
  return values.some(value => /整合包|合集|integrated[\s_-]*package|mod[\s_-]*pack/.test(value));
}
function shouldInstallMarketModAsIntegratedPackage(mod = {}) {
  return !!(mod.integratedPackage || mod.isIntegratedPackage || mod.installAsIntegratedPackage || mod.modMode === "integrated" || mod.installMode === "integrated" || marketModHasIntegratedPackageTag(mod));
}
async function installMarketArchiveFromPath({
  archivePath,
  mod,
  taskId,
  sender,
  control = null
}) {
  const sourcePath = String(archivePath || "").trim();
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    const message = i18n.t("backend.market.downloads.downloadedArchiveMissing");
    sendMarketDownloadProgress(sender, taskId, {
      status: "error",
      code: "ARCHIVE_MISSING",
      error: message,
      archivePath: sourcePath || null,
      name: mod?.name || i18n.t("backend.market.downloads.installTaskName"),
      characterName: mod?.characterName || null,
      gameId: mod?.gameId || null,
      mod,
      percent: 100
    }, control);
    return {
      success: false,
      code: "ARCHIVE_MISSING",
      taskId,
      error: message,
      archivePath: sourcePath || null,
      mod
    };
  }
  const appearanceTarget = modsAppearance.extractRequestedAppearanceTarget(mod);
  const installResult = await importsLocal.importModFromLocalPath({
    characterName: mod?.characterName,
    filePath: sourcePath,
    modInfo: {
      ...mod,
      name: mod?.name || path.basename(sourcePath, path.extname(sourcePath))
    },
    gameIdOverride: mod?.gameId || null,
    allowDuplicateRename: true,
    installAsIntegratedPackage: shouldInstallMarketModAsIntegratedPackage(mod),
    appearanceSectionId: appearanceTarget.sectionId || null,
    characterSkinId: appearanceTarget.skinId || null
  });
  if (!installResult?.success) {
    const message = installResult?.error || i18n.t("backend.market.downloads.installationFailed");
    sendMarketDownloadProgress(sender, taskId, {
      status: "error",
      code: "INSTALL_FAILED",
      error: message,
      archivePath: sourcePath,
      archiveFileName: path.basename(sourcePath),
      name: mod?.name || path.basename(sourcePath, path.extname(sourcePath)),
      characterName: mod?.characterName || null,
      gameId: mod?.gameId || null,
      mod,
      percent: 100
    }, control);
    return {
      success: false,
      code: "INSTALL_FAILED",
      taskId,
      error: message,
      archivePath: sourcePath,
      archiveFileName: path.basename(sourcePath),
      mod
    };
  }
  try {
    fs.unlinkSync(sourcePath);
  } catch (_) {}
  return {
    success: true,
    taskId,
    ...installResult
  };
}
function registerIpc() {
  electron.ipcMain.handle("market:get-download-settings", async () => {
    try {
      return marketSettings.getMarketDownloadSettingsForRenderer();
    } catch (error) {
      return {
        success: false,
        error: error?.message || String(error)
      };
    }
  });
  electron.ipcMain.handle("market:select-download-cache-dir", async () => {
    try {
      const currentDir = marketSettings.getMarketDownloadCacheDir();
      const options = {
        title: i18n.t("backend.market.downloads.chooseDownloadCache"),
        defaultPath: currentDir,
        properties: ["openDirectory", "createDirectory"]
      };
      const result = desktopWindows.mainWindowRef && !desktopWindows.mainWindowRef.isDestroyed() ? await electron.dialog.showOpenDialog(desktopWindows.mainWindowRef, options) : await electron.dialog.showOpenDialog(options);
      if (result.canceled || !result.filePaths?.[0]) {
        return {
          ...marketSettings.getMarketDownloadSettingsForRenderer(),
          canceled: true
        };
      }
      const cacheDir = result.filePaths[0];
      systemWindows.probeWritableDirectory(cacheDir, i18n.t("backend.validation.downloadCacheDirectory"));
      marketSettings.saveMarketDownloadSettings({
        ...marketSettings.loadMarketDownloadSettings(),
        cacheDir
      });
      return marketSettings.getMarketDownloadSettingsForRenderer();
    } catch (error) {
      return {
        success: false,
        error: error?.message || String(error)
      };
    }
  });
  electron.ipcMain.handle("market:reset-download-cache-dir", async () => {
    try {
      const settings = marketSettings.loadMarketDownloadSettings();
      delete settings.cacheDir;
      marketSettings.saveMarketDownloadSettings(settings);
      return marketSettings.getMarketDownloadSettingsForRenderer();
    } catch (error) {
      return {
        success: false,
        error: error?.message || String(error)
      };
    }
  });
  electron.ipcMain.handle("market:download-control", async (event, payload = {}) => {
    try {
      const taskId = String(payload.taskId || "");
      const action = String(payload.action || "");
      const control = marketDownloadControls.get(taskId);
      if (!taskId || !control) {
        return {
          success: false,
          error: i18n.t("backend.market.downloads.taskAlreadyEnded")
        };
      }
      if (action === "pause") {
        control.paused = true;
        sendMarketDownloadProgress(event.sender, taskId, {
          ...(control.lastProgress || {}),
          status: "paused"
        }, control);
        return {
          success: true,
          paused: true
        };
      }
      if (action === "resume") {
        resumeMarketDownloadControl(control);
        sendMarketDownloadProgress(event.sender, taskId, {
          ...(control.lastProgress || {}),
          status: control.lastActiveStatus === "paused" ? "downloading" : control.lastActiveStatus
        }, control);
        return {
          success: true,
          paused: false
        };
      }
      if (action === "cancel") {
        control.canceled = true;
        resumeMarketDownloadControl(control);
        try {
          control.abortController?.abort();
        } catch (_) {}
        sendMarketDownloadProgress(event.sender, taskId, {
          ...(control.lastProgress || {}),
          status: "canceled",
          error: i18n.t("backend.archiveDownloads.downloadCanceled")
        }, control);
        return {
          success: true,
          canceled: true
        };
      }
      return {
        success: false,
        error: i18n.t("backend.market.downloads.unknownDownloadAction")
      };
    } catch (error) {
      return {
        success: false,
        error: error?.message || String(error)
      };
    }
  });
  electron.ipcMain.handle("market:open-downloaded-archive-folder", async (_, payload = {}) => {
    try {
      return await revealDownloadedArchive(payload.archivePath);
    } catch (error) {
      return {
        success: false,
        error: error?.message || String(error)
      };
    }
  });
  archiveDownloadManager = registerArchiveDownloads({
    ipcMain: electron.ipcMain,
    app: electron.app,
    BrowserWindow: electron.BrowserWindow,
    userData: electron.app.getPath("userData"),
    services: {
      pawchive: marketSources.pawchiveService,
      kemono: marketSources.kemonoService,
      ...Object.fromEntries(['gamebanana', 'arca', 'loverslab', 'huiyue', 'keke'].map(source => [source, {
        getPost: ref => marketSources.modSiteContent.getPost({
          ...ref,
          source
        })
      }]))
    },
    getCacheDir: marketSettings.ensureMarketDownloadCacheDir,
    openSource: () => {
      throw Error(i18n.t("backend.market.downloads.reopenSourceDetail"));
    },
    transfer: async (task, onProgress) => {
      const sender = {
        send: (_channel, progress) => onProgress(progress)
      };
      const control = createMarketDownloadControl(task.taskId, sender);
      try {
        return await downloadMarketFile({
          sender
        }, task.taskId, task.download, control, ['gamebanana', 'arca', 'loverslab', 'huiyue', 'keke'].includes(task.source) ? (...args) => marketSources.siteSessions.fetch(task.source, ...args) : netQaqm.fetchWithElectronNet);
      } finally {
        marketDownloadControls.delete(task.taskId);
      }
    },
    controlTransfer: (taskId, action) => {
      const control = marketDownloadControls.get(taskId);
      if (!control) return;
      if (action === 'pause') control.paused = true;
      if (action === 'resume') resumeMarketDownloadControl(control);
      if (action === 'cancel') {
        control.canceled = true;
        resumeMarketDownloadControl(control);
        control.abortController?.abort();
      }
    },
    openFile: file => electron.shell.showItemInFolder(file)
  });
}
Object.assign(module.exports, {
  marketDownloadControls
});
