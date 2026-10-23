"use strict";

const i18n = require("../../shared/i18n/core.cjs");
module.exports = {
  registerIpc
};
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const configStore = require("../config/store.cjs");
const marketAccess = require("./access.cjs");
const marketDownloads = require("./downloads.cjs");
const netErrors = require("../net/errors.cjs");
const netQaqm = require("../net/qaqm.cjs");
function withCandidateAuthorization(headers, authToken) {
  const next = {};
  if (headers && typeof headers.forEach === "function") {
    headers.forEach((value, key) => {
      if (String(key).toLowerCase() !== "authorization") next[key] = value;
    });
  } else {
    for (const [key, value] of Object.entries(headers || {})) {
      if (String(key).toLowerCase() !== "authorization") next[key] = value;
    }
  }
  if (authToken) next.Authorization = `Bearer ${authToken}`;
  return next;
}
async function fetchDirectInstallUrlWithFallback(serverUrl, modId, options, authContext = {}) {
  const requestPath = `/api/mods/${modId}/install-url`;
  let lastError = null;
  const rawAuthToken = String(authContext.authToken || "").trim();
  const candidates = netQaqm.getQaqmServerCandidates(serverUrl, {
    secureOnly: Boolean(rawAuthToken)
  });
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    try {
      console.log(`[QAQM Fallback][main] 尝试 install-url: ${candidate}${requestPath}`);
      const candidateAuthToken = marketAccess.resolveMarketAuthToken({
        authToken: rawAuthToken,
        authServerUrl: authContext.authServerUrl,
        targetServerUrl: candidate
      });
      const candidateOptions = {
        ...options,
        headers: withCandidateAuthorization(options?.headers, candidateAuthToken)
      };
      const timed = netQaqm.createTimedFetchOptions(candidateOptions);
      const prepared = netQaqm.prepareFallbackJsonRequest(candidate, requestPath, timed.options);
      const response = await netQaqm.fetchWithElectronNet(`${candidate}${requestPath}`, prepared).finally(timed.cleanup);
      if (response.status >= 500 && candidate !== netQaqm.BARE_FALLBACK_SERVER_URL) {
        lastError = new Error(i18n.t("backend.market.install.serverResponseError", {
          status: response.status
        }));
        console.warn(`[QAQM Fallback][main] ${candidate} 返回 ${response.status}，切换下一个候选`);
        continue;
      }
      console.log(`[QAQM Fallback][main] 命中 install-url 服务器: ${candidate}`);
      return {
        response,
        serverUrl: candidate
      };
    } catch (error) {
      if (options.signal?.aborted) throw error;
      lastError = error?.name === "AbortError" ? new Error(i18n.t("backend.market.install.requestTimedOut")) : error;
      console.warn(`[QAQM Fallback][main] ${candidate} 请求失败: ${error?.message || error}`);
    }
  }
  throw lastError || new Error(i18n.t("backend.market.install.allServersUnavailable"));
}
function registerIpc() {
  electron.ipcMain.handle("market:download-install-mod", async (event, payload = {}) => {
    const taskId = payload.taskId || crypto.randomUUID();
    let tempPath = null;
    const control = marketDownloads.createMarketDownloadControl(taskId, event.sender);
    try {
      const serverUrl = netQaqm.normalizeServerUrlInput(payload.serverUrl || configStore.currentConfig.serverUrl || netQaqm.DEFAULT_SERVER_URL).replace(/\/$/, "");
      const authToken = String(payload.authToken || "").trim();
      const authServerUrl = String(payload.authServerUrl || "").trim();
      const mod = payload.mod || {};
      if (!serverUrl || !mod.id) {
        marketDownloads.sendMarketDownloadProgress(event.sender, taskId, {
          status: "error",
          error: i18n.t("backend.market.install.downloadInfoMissing")
        }, control);
        return {
          success: false,
          taskId,
          code: "INVALID_MOD",
          error: i18n.t("backend.market.install.downloadInfoMissing")
        };
      }
      if (!authToken || !authServerUrl) {
        marketDownloads.sendMarketDownloadProgress(event.sender, taskId, {
          status: "error",
          error: i18n.t("backend.market.install.loginRequired")
        }, control);
        return {
          success: false,
          taskId,
          code: "LOGIN_REQUIRED",
          error: i18n.t("backend.market.install.loginRequired")
        };
      }
      marketDownloads.sendMarketDownloadProgress(event.sender, taskId, {
        status: "checking",
        modId: mod.id,
        name: mod.name,
        characterName: mod.characterName,
        gameId: mod.gameId
      }, control);
      control.abortController = new AbortController();
      const installUrlResult = await fetchDirectInstallUrlWithFallback(serverUrl, mod.id, {
        method: "POST",
        signal: control.abortController.signal,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          channel: "client",
          clientId: payload.clientId || null,
          source: "r2-direct-install",
          entry: "desktop_market",
          scene: payload.scene || "market_card",
          gameId: mod.gameId || null,
          modMode: mod.modMode || "d3d"
        })
      }, {
        authToken,
        authServerUrl
      });
      const installUrlRes = installUrlResult.response;
      control.abortController = null;
      if (control.canceled) {
        const canceledError = new Error(i18n.t("backend.archiveDownloads.downloadCanceled"));
        canceledError.code = "DOWNLOAD_CANCELED";
        throw canceledError;
      }
      const data = await installUrlRes.json().catch(() => ({}));
      if (!installUrlRes.ok || !data.success || !data.download?.url) {
        const code = data.code || (installUrlRes.status === 401 ? "LOGIN_REQUIRED" : "DOWNLOAD_DENIED");
        const errorMessage = marketDownloads.formatMarketDownloadError(code, data.error);
        marketDownloads.sendMarketDownloadProgress(event.sender, taskId, {
          status: "error",
          error: errorMessage
        }, control);
        return {
          success: false,
          taskId,
          code,
          error: errorMessage
        };
      }
      tempPath = await marketDownloads.downloadMarketFile(event, taskId, {
        ...data.download,
        modId: mod.id,
        authToken
      }, control);
      const installMod = {
        ...mod,
        ...(data.mod || {}),
        name: mod.name || data.mod?.name || path.basename(tempPath, path.extname(tempPath)),
        characterName: data.mod?.characterName || mod.characterName,
        gameId: data.mod?.gameId || mod.gameId || null
      };
      marketDownloads.sendMarketDownloadProgress(event.sender, taskId, {
        status: "installing",
        percent: 100,
        archivePath: tempPath,
        archiveFileName: path.basename(tempPath),
        mod: installMod
      }, control);
      const archivePath = tempPath;
      tempPath = null;
      let installResult = null;
      try {
        installResult = await marketDownloads.installMarketArchiveFromPath({
          archivePath,
          mod: installMod,
          taskId,
          sender: event.sender,
          control
        });
      } catch (installError) {
        const message = installError?.message || String(installError);
        marketDownloads.sendMarketDownloadProgress(event.sender, taskId, {
          status: "error",
          code: "INSTALL_FAILED",
          error: message,
          archivePath,
          archiveFileName: path.basename(archivePath),
          name: installMod.name,
          characterName: installMod.characterName || null,
          gameId: installMod.gameId || null,
          mod: installMod,
          percent: 100
        }, control);
        return {
          success: false,
          taskId,
          code: "INSTALL_FAILED",
          error: message,
          archivePath,
          archiveFileName: path.basename(archivePath),
          mod: installMod
        };
      }
      if (!installResult?.success) return installResult;
      marketDownloads.sendMarketDownloadProgress(event.sender, taskId, {
        status: "completed",
        percent: 100,
        modName: installResult.modName,
        characterName: installResult.characterName,
        gameId: data.mod?.gameId || mod.gameId || null,
        renamedDueToDuplicate: !!installResult.renamedDueToDuplicate,
        duplicateOf: installResult.duplicateOf || null,
        integratedPackage: !!installResult.integratedPackage,
        modMode: installResult.modMode || null,
        modCount: installResult.modCount || 0,
        characterCount: installResult.characterCount || 0,
        copiedFiles: installResult.copiedFiles || 0,
        targetModsDir: installResult.targetModsDir || null,
        appearanceSectionId: installResult.appearanceSectionId || null
      }, control);
      return {
        success: true,
        taskId,
        ...installResult
      };
    } catch (error) {
      if (tempPath) {
        try {
          fs.unlinkSync(tempPath);
        } catch (_) {}
      }
      if (control.canceled || error?.name === "AbortError" || error?.code === "DOWNLOAD_CANCELED") {
        marketDownloads.sendMarketDownloadProgress(event.sender, taskId, {
          status: "canceled",
          error: i18n.t("backend.archiveDownloads.downloadCanceled")
        }, control);
        return {
          success: false,
          taskId,
          code: "DOWNLOAD_CANCELED",
          canceled: true,
          error: i18n.t("backend.archiveDownloads.downloadCanceled")
        };
      }
      const message = error?.message || String(error);
      const code = netErrors.isNetworkDownloadFailure(error) ? "NETWORK_FETCH_FAILED" : error?.code || "DOWNLOAD_FAILED";
      marketDownloads.sendMarketDownloadProgress(event.sender, taskId, {
        status: "error",
        code,
        error: message
      }, control);
      return {
        success: false,
        taskId,
        code,
        error: message
      };
    } finally {
      marketDownloads.resumeMarketDownloadControl(control);
      marketDownloads.marketDownloadControls.delete(taskId);
    }
  });
  electron.ipcMain.handle("market:retry-install-downloaded-mod", async (event, payload = {}) => {
    const taskId = payload.taskId || crypto.randomUUID();
    const control = marketDownloads.createMarketDownloadControl(taskId, event.sender);
    try {
      const archivePath = String(payload.archivePath || "").trim();
      const mod = payload.mod || {};
      marketDownloads.sendMarketDownloadProgress(event.sender, taskId, {
        status: "installing",
        percent: 100,
        archivePath,
        archiveFileName: archivePath ? path.basename(archivePath) : "",
        name: mod.name || (archivePath ? path.basename(archivePath, path.extname(archivePath)) : i18n.t("backend.market.downloads.installTaskName")),
        characterName: mod.characterName || null,
        gameId: mod.gameId || null,
        mod
      }, control);
      const installResult = await marketDownloads.installMarketArchiveFromPath({
        archivePath,
        mod,
        taskId,
        sender: event.sender,
        control
      });
      if (!installResult?.success) return installResult;
      marketDownloads.sendMarketDownloadProgress(event.sender, taskId, {
        status: "completed",
        percent: 100,
        modName: installResult.modName,
        characterName: installResult.characterName,
        gameId: installResult.gameId || mod.gameId || null,
        renamedDueToDuplicate: !!installResult.renamedDueToDuplicate,
        duplicateOf: installResult.duplicateOf || null,
        integratedPackage: !!installResult.integratedPackage,
        modMode: installResult.modMode || null,
        modCount: installResult.modCount || 0,
        characterCount: installResult.characterCount || 0,
        copiedFiles: installResult.copiedFiles || 0,
        targetModsDir: installResult.targetModsDir || null,
        appearanceSectionId: installResult.appearanceSectionId || null
      }, control);
      return installResult;
    } catch (error) {
      const message = error?.message || String(error);
      marketDownloads.sendMarketDownloadProgress(event.sender, taskId, {
        status: "error",
        error: message
      }, control);
      return {
        success: false,
        taskId,
        error: message
      };
    } finally {
      marketDownloads.resumeMarketDownloadControl(control);
      marketDownloads.marketDownloadControls.delete(taskId);
    }
  });
}
