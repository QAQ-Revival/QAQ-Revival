"use strict";

const i18n = require("../../shared/i18n/core.cjs");
const electron = require("electron");
const fs = require("fs");
const utils = require("@electron-toolkit/utils");
const configStore = require("../config/store.cjs");
const gamesSettings = require("../games/settings.cjs");
const marketAccess = require("./access.cjs");
const marketSettings = require("./settings.cjs");
const netQaqm = require("../net/qaqm.cjs");
const MAX_INCREMENTAL_AGE_MS = 7 * 24 * 60 * 60 * 1e3;
function isStaleIncrementalCache(cache) {
  if (!cache || !cache.lastSyncTimestamp) return false;
  const ts = Date.parse(cache.lastSyncTimestamp);
  if (!Number.isFinite(ts)) return true;
  return Date.now() - ts > MAX_INCREMENTAL_AGE_MS;
}
const MARKET_SYNC_REQUESTS = marketAccess.createLatestRequestTracker();
async function isCurrentMarketRequestAfterIpcTurn(requestTicket) {
  await new Promise(resolve => setImmediate(resolve));
  return MARKET_SYNC_REQUESTS.isCurrent(requestTicket);
}
function marketRequestHeaders(authToken = "", authServerUrl = "", targetServerUrl = "") {
  const token = marketAccess.resolveMarketAuthToken({
    authToken,
    authServerUrl,
    targetServerUrl
  });
  return {
    "ngrok-skip-browser-warning": "true",
    ...(token ? {
      Authorization: `Bearer ${token}`
    } : {})
  };
}
function resolveMarketAccessDecision(data, status = 200) {
  const access = marketAccess.normalizeMarketAccessPayload(data?.marketAccess);
  if (access) return access;
  const code = String(data?.code || "").trim().toUpperCase();
  if (["LOGIN_REQUIRED", "SESSION_EXPIRED", "ACCOUNT_NOT_ELIGIBLE", "MARKET_ACCESS_DENIED"].includes(code) || status === 401 || status === 403) {
    return {
      controlled: true,
      allowed: false,
      code: code || (status === 401 ? "LOGIN_REQUIRED" : "MARKET_ACCESS_DENIED"),
      clearExisting: false
    };
  }
  return null;
}
function loadModCache(gameId2 = gamesSettings.getActiveGameScopeId()) {
  const cachePath = gamesSettings.getModCachePath(gameId2);
  const marketGameId = gamesSettings.normalizeMarketGameId(gamesSettings.getMarketGameId(gameId2));
  try {
    if (fs.existsSync(cachePath)) {
      const data = fs.readFileSync(cachePath, "utf-8");
      return gamesSettings.normalizeCachePayload(JSON.parse(data));
    }
    if (marketGameId === "endfield" && cachePath !== marketSettings.LEGACY_MOD_CACHE_PATH && fs.existsSync(marketSettings.LEGACY_MOD_CACHE_PATH)) {
      const legacyData = fs.readFileSync(marketSettings.LEGACY_MOD_CACHE_PATH, "utf-8");
      return gamesSettings.normalizeCachePayload(JSON.parse(legacyData));
    }
  } catch (e) {
    console.error("Failed to load mod cache:", e);
  }
  return gamesSettings.normalizeCachePayload();
}
function saveModCache(cache, gameId2 = gamesSettings.getActiveGameScopeId()) {
  const cachePath = gamesSettings.getModCachePath(gameId2);
  try {
    const payload = {
      ...gamesSettings.normalizeCachePayload(cache),
      schemaVersion: gamesSettings.CACHE_SCHEMA_VERSION
    };
    fs.writeFileSync(cachePath, JSON.stringify(payload, null, 2));
  } catch (e) {
    console.error("Failed to save mod cache:", e);
  }
}
function getMarketModCacheKey(modOrId) {
  const rawId = typeof modOrId === "object" && modOrId !== null ? modOrId.id : modOrId;
  return rawId == null ? null : String(rawId);
}
function sortMarketMods(mods) {
  return [...mods].sort((a, b) => {
    const pinnedDiff = (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
    if (pinnedDiff !== 0) return pinnedDiff;
    const orderDiff = (a.sortOrder || 0) - (b.sortOrder || 0);
    if (orderDiff !== 0) return orderDiff;
    return (b.updatedAt || "").localeCompare(a.updatedAt || "");
  });
}
function normalizeMarketModsForDisplay(mods, gameId2 = gamesSettings.getActiveGameScopeId()) {
  return Array.isArray(mods) ? mods : [];
}
function mergeMarketMods(cacheMods, updatedMods = [], deletedIds = []) {
  const localMap = new Map();
  for (const mod of cacheMods || []) {
    const key = getMarketModCacheKey(mod);
    if (key) localMap.set(key, mod);
  }
  for (const id of deletedIds || []) {
    const key = getMarketModCacheKey(id);
    if (key) localMap.delete(key);
  }
  for (const mod of updatedMods || []) {
    const key = getMarketModCacheKey(mod);
    if (key) localMap.set(key, mod);
  }
  return sortMarketMods(normalizeMarketModsForDisplay(Array.from(localMap.values())));
}
function preserveBlockedMarketCache(cache, gameId2, access, authToken) {
  const preserved = marketAccess.preserveBlockedMarketSnapshot(cache, {
    marketAccess: access,
    authScope: marketAccess.createMarketAuthScope(authToken)
  });
  saveModCache(preserved, gameId2);
  return gamesSettings.normalizeCachePayload({
    ...preserved,
    schemaVersion: gamesSettings.CACHE_SCHEMA_VERSION
  });
}
function buildMarketCacheResult(cache, gameId2, options = {}) {
  const hideCachedMods = options.hideCachedMods === true;
  return {
    success: true,
    mods: hideCachedMods ? [] : normalizeMarketModsForDisplay(cache.mods, gameId2),
    lastSyncTimestamp: cache.lastSyncTimestamp,
    gameId: gamesSettings.getMarketGameId(gameId2),
    marketAccess: marketAccess.normalizeMarketAccessPayload(options.marketAccess || cache.marketAccess),
    fromCache: !hideCachedMods,
    refreshBlocked: options.refreshBlocked === true,
    stale: options.stale === true,
    ignoredEmpty: options.ignoredEmpty === true,
    syncError: options.syncError || null,
    wasIncremental: false,
    updatedCount: 0,
    deletedCount: 0
  };
}
function cacheNeedsMarketAuthRefresh(cache, authToken) {
  const access = marketAccess.normalizeMarketAccessPayload(cache?.marketAccess);
  if (marketAccess.isMarketRefreshBlocked(access)) return true;
  if (!access?.controlled) return false;
  return String(cache?.authScope || "") !== marketAccess.createMarketAuthScope(authToken);
}
function registerIpc() {
  electron.ipcMain.handle("market:invalidate-requests", async (_, {
    gameId: gameId2
  } = {}) => {
    if (gameId2) MARKET_SYNC_REQUESTS.invalidate(gamesSettings.getMarketGameId(gameId2));else MARKET_SYNC_REQUESTS.invalidateAll();
    return {
      success: true
    };
  });
  electron.ipcMain.handle("get-cached-mods", async (_, {
    gameId: gameId2
  } = {}) => {
    try {
      const startedAt = Date.now();
      const marketGameId = gamesSettings.getMarketGameId(gameId2);
      const cachePath = gamesSettings.getModCachePath(gameId2);
      const cache = loadModCache(gameId2);
      if (utils.is.dev) {
        let cacheSize = 0;
        try {
          cacheSize = fs.existsSync(cachePath) ? fs.statSync(cachePath).size : 0;
        } catch (_2) {}
        console.log(`[ModMarketPerf][main] get-cached-mods ${marketGameId}: ${Date.now() - startedAt}ms, ${cache.mods.length} mods, ${(cacheSize / 1024 / 1024).toFixed(2)} MB`);
      }
      return {
        success: true,
        mods: normalizeMarketModsForDisplay(cache.mods, gameId2),
        lastSyncTimestamp: cache.lastSyncTimestamp,
        gameId: marketGameId,
        marketAccess: marketAccess.normalizeMarketAccessPayload(cache.marketAccess),
        refreshBlocked: marketAccess.isMarketRefreshBlocked(cache.marketAccess)
      };
    } catch (error) {
      return {
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("sync-mod-market", async (_, {
    serverUrl,
    forceFullSync,
    gameId: gameId2,
    authToken = "",
    authServerUrl = ""
  } = {}) => {
    if (!serverUrl) return {
      error: i18n.t("backend.market.catalog.serverNotConfigured")
    };
    const marketGameId = gamesSettings.getMarketGameId(gameId2);
    const requestTicket = MARKET_SYNC_REQUESTS.begin(marketGameId);
    const baseUrl = netQaqm.normalizeServerUrlInput(serverUrl).replace(/\/$/, "");
    const requestAuthToken = marketAccess.resolveMarketAuthToken({
      authToken,
      authServerUrl,
      targetServerUrl: baseUrl
    });
    try {
      const cache = loadModCache(gameId2);
      const stale = isStaleIncrementalCache(cache);
      const needsSchemaHeal = (cache.schemaVersion || 0) < gamesSettings.CACHE_SCHEMA_VERSION;
      const needsAuthRefresh = cacheNeedsMarketAuthRefresh(cache, requestAuthToken);
      const canIncremental = !forceFullSync && !stale && !needsSchemaHeal && !needsAuthRefresh && cache.lastSyncTimestamp && cache.mods.length > 0;
      const params = new URLSearchParams({
        gameId: marketGameId,
        channel: "client"
      });
      if (canIncremental) {
        params.set("since", cache.lastSyncTimestamp);
      } else if (needsSchemaHeal) {
        console.log(`[ModCache:${marketGameId}] Cache schemaVersion=${cache.schemaVersion || 0} < current ${gamesSettings.CACHE_SCHEMA_VERSION}, forcing one-time full sync`);
      } else if (stale) {
        console.log(`[ModCache:${marketGameId}] Cache stale (>${MAX_INCREMENTAL_AGE_MS / 864e5}d), forcing full sync`);
      }
      const url = `${baseUrl}/api/mods?${params.toString()}`;
      const response = await fetch(url, {
        headers: marketRequestHeaders(authToken, authServerUrl, baseUrl)
      });
      const data = await response.json().catch(() => ({}));
      const responseAccess = resolveMarketAccessDecision(data, response.status);
      if (!(await isCurrentMarketRequestAfterIpcTurn(requestTicket))) {
        return buildMarketCacheResult(loadModCache(gameId2), gameId2, {
          stale: true
        });
      }
      if (marketAccess.isMarketRefreshBlocked(responseAccess)) {
        const preserved = preserveBlockedMarketCache(cache, gameId2, responseAccess, requestAuthToken);
        return buildMarketCacheResult(preserved, gameId2, {
          refreshBlocked: true,
          hideCachedMods: true,
          marketAccess: responseAccess
        });
      }
      if (!response.ok) {
        throw new Error(i18n.t("backend.market.catalog.serverResponseError", {
          status: response.status,
          label: data.error ? ` - ${data.error}` : ""
        }));
      }
      if (!data.success) return {
        error: data.error || i18n.t("backend.market.catalog.syncFailed")
      };
      const rawUpdatedMods = Array.isArray(data.mods) ? data.mods : null;
      if (marketAccess.shouldPreserveMarketSnapshotOnEmptyResult({
        success: true,
        mods: rawUpdatedMods,
        wasIncremental: data.isIncremental === true,
        marketAccess: responseAccess
      }, cache.mods)) {
        return buildMarketCacheResult(cache, gameId2, {
          ignoredEmpty: true,
          marketAccess: responseAccess
        });
      }
      const updatedMods = rawUpdatedMods || [];
      const deletedIds = Array.isArray(data.deletedIds) ? data.deletedIds : [];
      let finalMods;
      if (data.isIncremental) {
        finalMods = mergeMarketMods(cache.mods, updatedMods, deletedIds);
        console.log(`[ModCache:${marketGameId}] Incremental sync: +${updatedMods.length} updated, -${deletedIds.length} deleted | url=${url} | cacheSince=${cache.lastSyncTimestamp} | serverSyncTs=${data.syncTimestamp}`);
      } else {
        finalMods = sortMarketMods(normalizeMarketModsForDisplay(updatedMods, gameId2));
        console.log(`[ModCache:${marketGameId}] Full sync: ${finalMods.length} mods`);
      }
      const normalizedAccess = marketAccess.normalizeMarketAccessPayload(responseAccess);
      const newCache = {
        mods: finalMods,
        lastSyncTimestamp: data.syncTimestamp,
        marketVersion: data.marketVersion || cache.marketVersion || null,
        responseRevision: Number(data.responseRevision || cache.responseRevision || 0),
        marketAccess: normalizedAccess,
        authScope: marketAccess.createMarketAuthScope(requestAuthToken),
        accessCheckedAt: new Date().toISOString()
      };
      saveModCache(newCache, gameId2);
      return {
        success: true,
        mods: finalMods,
        lastSyncTimestamp: data.syncTimestamp,
        gameId: marketGameId,
        marketAccess: normalizedAccess,
        wasIncremental: !!data.isIncremental,
        updatedCount: data.isIncremental ? updatedMods.length : finalMods.length,
        deletedCount: data.isIncremental ? deletedIds.length : 0
      };
    } catch (error) {
      console.error("sync-mod-market error:", error);
      if (!(await isCurrentMarketRequestAfterIpcTurn(requestTicket))) {
        return buildMarketCacheResult(loadModCache(gameId2), gameId2, {
          stale: true
        });
      }
      const cache = loadModCache(gameId2);
      if (cache.mods.length > 0) {
        return buildMarketCacheResult(cache, gameId2, {
          syncError: error.message
        });
      }
      return {
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("market:poll", async (_, {
    authToken = "",
    authServerUrl = ""
  } = {}) => {
    const serverUrl = configStore.currentConfig.serverUrl;
    if (!serverUrl) return {
      success: false,
      mods: []
    };
    const gameId2 = gamesSettings.getActiveGameScopeId();
    const marketGameId = gamesSettings.getMarketGameId(gameId2);
    const requestTicket = MARKET_SYNC_REQUESTS.begin(marketGameId);
    const headersForCandidate = candidate => marketRequestHeaders(authToken, authServerUrl, candidate);
    try {
      const cache = loadModCache(gameId2);
      const stale = isStaleIncrementalCache(cache);
      const needsSchemaHeal = (cache.schemaVersion || 0) < gamesSettings.CACHE_SCHEMA_VERSION;
      let versionProbe = null;
      try {
        const versionParams = new URLSearchParams({
          gameId: marketGameId,
          channel: "client"
        });
        const versionResult = await netQaqm.fetchQaqmWithFallback(serverUrl, `/api/mods/sync-version?${versionParams.toString()}`, {
          expectJson: true,
          secureOnly: Boolean(String(authToken || "").trim()),
          isCurrent: () => isCurrentMarketRequestAfterIpcTurn(requestTicket),
          headersForCandidate
        });
        const versionData = await versionResult.response.json().catch(() => ({}));
        if (versionResult.response.ok && versionData?.success && versionData.version) {
          versionProbe = {
            ...versionData,
            serverUrl: versionResult.serverUrl
          };
        }
      } catch (error) {
        console.warn(`[ModCache:${marketGameId}] Version probe unavailable: ${error?.message || error}`);
      }
      if (!(await isCurrentMarketRequestAfterIpcTurn(requestTicket))) {
        return buildMarketCacheResult(loadModCache(gameId2), gameId2, {
          stale: true
        });
      }
      const versionAccess = resolveMarketAccessDecision(versionProbe, 200);
      const versionAuthToken = marketAccess.resolveMarketAuthToken({
        authToken,
        authServerUrl,
        targetServerUrl: versionProbe?.serverUrl || serverUrl
      });
      if (marketAccess.isMarketRefreshBlocked(versionAccess)) {
        const preserved = preserveBlockedMarketCache(cache, gameId2, versionAccess, versionAuthToken);
        return buildMarketCacheResult(preserved, gameId2, {
          refreshBlocked: true,
          hideCachedMods: true,
          marketAccess: versionAccess
        });
      }
      const revisionChanged = Boolean(versionProbe && Number(versionProbe.responseRevision || 0) !== Number(cache.responseRevision || 0));
      const cacheReady = !stale && !needsSchemaHeal && !cacheNeedsMarketAuthRefresh(cache, versionAuthToken) && !revisionChanged && cache.lastSyncTimestamp && cache.mods.length > 0;
      if (cacheReady && versionProbe && cache.marketVersion === versionProbe.version) {
        return {
          ...buildMarketCacheResult(cache, gameId2, {
            marketAccess: versionAccess
          }),
          fromCache: false,
          unchanged: true,
          wasIncremental: true
        };
      }
      const params = new URLSearchParams({
        gameId: marketGameId,
        channel: "client"
      });
      if (cacheReady) params.set("since", cache.lastSyncTimestamp);
      const syncResult = await netQaqm.fetchQaqmWithFallback(versionProbe?.serverUrl || serverUrl, `/api/mods?${params.toString()}`, {
        expectJson: true,
        secureOnly: Boolean(String(authToken || "").trim()),
        isCurrent: () => isCurrentMarketRequestAfterIpcTurn(requestTicket),
        headersForCandidate
      });
      const response = syncResult.response;
      const data = await response.json().catch(() => ({}));
      const responseAccess = resolveMarketAccessDecision(data, response.status);
      if (!(await isCurrentMarketRequestAfterIpcTurn(requestTicket))) {
        return buildMarketCacheResult(loadModCache(gameId2), gameId2, {
          stale: true
        });
      }
      const responseAuthToken = marketAccess.resolveMarketAuthToken({
        authToken,
        authServerUrl,
        targetServerUrl: syncResult.serverUrl
      });
      if (marketAccess.isMarketRefreshBlocked(responseAccess)) {
        const preserved = preserveBlockedMarketCache(cache, gameId2, responseAccess, responseAuthToken);
        return buildMarketCacheResult(preserved, gameId2, {
          refreshBlocked: true,
          hideCachedMods: true,
          marketAccess: responseAccess
        });
      }
      if (!response.ok) {
        throw new Error(i18n.t("backend.market.catalog.serverResponseError", {
          status: response.status,
          label: data.error ? ` - ${data.error}` : ""
        }));
      }
      if (!data.success) throw new Error(data.error || i18n.t("backend.market.catalog.syncFailed"));
      const rawUpdatedMods = Array.isArray(data.mods) ? data.mods : null;
      if (marketAccess.shouldPreserveMarketSnapshotOnEmptyResult({
        success: true,
        mods: rawUpdatedMods,
        wasIncremental: data.isIncremental === true,
        marketAccess: responseAccess
      }, cache.mods)) {
        return buildMarketCacheResult(cache, gameId2, {
          ignoredEmpty: true,
          marketAccess: responseAccess
        });
      }
      const updatedMods = rawUpdatedMods || [];
      const deletedIds = Array.isArray(data.deletedIds) ? data.deletedIds : [];
      const finalMods = data.isIncremental ? mergeMarketMods(cache.mods, updatedMods, deletedIds) : sortMarketMods(normalizeMarketModsForDisplay(updatedMods, gameId2));
      const normalizedAccess = marketAccess.normalizeMarketAccessPayload(responseAccess);
      saveModCache({
        mods: finalMods,
        lastSyncTimestamp: data.syncTimestamp,
        marketVersion: data.marketVersion || versionProbe?.version || cache.marketVersion || null,
        responseRevision: Number(data.responseRevision || versionProbe?.responseRevision || cache.responseRevision || 0),
        marketAccess: normalizedAccess,
        authScope: marketAccess.createMarketAuthScope(responseAuthToken),
        accessCheckedAt: new Date().toISOString()
      }, gameId2);
      return {
        success: true,
        mods: finalMods,
        gameId: marketGameId,
        marketAccess: normalizedAccess,
        wasIncremental: !!data.isIncremental,
        updatedCount: data.isIncremental ? updatedMods.length : finalMods.length,
        deletedCount: data.isIncremental ? deletedIds.length : 0
      };
    } catch (error) {
      if (!(await isCurrentMarketRequestAfterIpcTurn(requestTicket))) {
        return buildMarketCacheResult(loadModCache(gameId2), gameId2, {
          stale: true
        });
      }
      const cache = loadModCache(gameId2);
      if (cache.mods.length > 0) {
        return buildMarketCacheResult(cache, gameId2, {
          syncError: error.message
        });
      }
      return {
        success: false,
        mods: [],
        gameId: marketGameId,
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("fetch-my-feedback", async (event, {
    serverUrl,
    clientId
  }) => {
    try {
      if (!serverUrl || !clientId) return {
        success: false,
        feedbacks: []
      };
      const url = `${serverUrl}/api/mod-feedback/my?clientId=${encodeURIComponent(clientId)}`;
      const res = await fetch(url, {
        headers: {
          "ngrok-skip-browser-warning": "true"
        }
      });
      const data = await res.json();
      return data;
    } catch (e) {
      console.error("fetch-my-feedback error:", e);
      return {
        success: false,
        feedbacks: [],
        error: e.message
      };
    }
  });
}
module.exports = {
  registerIpc
};
