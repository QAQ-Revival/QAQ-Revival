import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
import {
  readAuthSession,
  getAuthSessionIdentity,
  subscribeAuthSession,
} from "../../../lib/authSession.js";
import {
  normalizeApiBaseUrl,
  runSyncFallbackChain,
} from "../../../lib/marketApi.js";
import {
  getMarketSessionCache,
  createMarketSyncStatus,
  createLoginRequiredMarketAccess,
  logMarketPerf,
} from "../model/marketSession.js";
import {
  shouldHideControlledMarketCache,
  createLatestRequestTracker,
  getMarketSnapshotSignature,
  shouldReplaceMarketSnapshot,
} from "../model/marketSnapshots.js";
export function useMarketSync({
  isActive,
  marketGameId,
  setInitialCacheReady,
  marketVisibleRef,
  setMods,
  setMarketDataGameId,
  setSyncStatus,
  serverUrl,
  setServerUrl,
  activeGameId,
  setSelectedGameId,
  setSyncing,
  setLoading,
  setError,
  mods,
  marketDataGameId,
  loadPopularityData,
  loadLikedMods,
  marketSyncStatusRef,
  setDetailMod,
  marketModsRef,
  setServerGameVersions,
}) {
  const marketInitCacheRequestRef = React.useRef({
    key: null,
    promise: null,
  });
  const marketInitConfigRequestRef = React.useRef(null);
  const marketInitSyncRequestRef = React.useRef({
    key: null,
    promise: null,
  });
  const marketSilentRefreshRef = React.useRef({
    key: null,
    promise: null,
  });
  const marketApplyRequestTrackerRef = React.useRef(
    createLatestRequestTracker(),
  );
  const marketAuthIdentityRef = React.useRef(
    getAuthSessionIdentity(readAuthSession()),
  );
  React.useEffect(() => {
    if (!isActive) return;
    let mounted = true;
    const delayedRequests = [];
    const warmSessionCache = getMarketSessionCache(marketGameId);
    const hasWarmSessionCache = Boolean(
      warmSessionCache?.mods?.length &&
      warmSessionCache.gameId === marketGameId,
    );
    if (!hasWarmSessionCache) {
      setInitialCacheReady(false);
    }
    function requestCachedMods(gameId) {
      const current = marketInitCacheRequestRef.current;
      if (current.key === gameId && current.promise) {
        return current.promise;
      }
      const promise = window.api.getCachedMods(gameId).finally(() => {
        if (marketInitCacheRequestRef.current.key === gameId) {
          marketInitCacheRequestRef.current = {
            key: null,
            promise: null,
          };
        }
      });
      marketInitCacheRequestRef.current = {
        key: gameId,
        promise,
      };
      return promise;
    }
    function requestConfig() {
      const current = marketInitConfigRequestRef.current;
      if (current?.promise) return current.promise;
      const promise = window.api.getConfig().finally(() => {
        if (marketInitConfigRequestRef.current?.promise === promise) {
          marketInitConfigRequestRef.current = null;
        }
      });
      marketInitConfigRequestRef.current = {
        promise,
      };
      return promise;
    }
    async function syncWithFallback(resolvedUrl, forceFullSync, hasCached) {
      const primaryUrl = normalizeApiBaseUrl(resolvedUrl);
      const storedSession = readAuthSession() || {};
      const authKey = storedSession.token || "anonymous";
      const syncKey = `${marketGameId}|${primaryUrl}|${"delta"}|${authKey}`;
      const currentSync = marketInitSyncRequestRef.current;
      let chainResult;
      if (currentSync.key === syncKey && currentSync.promise) {
        chainResult = await currentSync.promise;
      } else {
        const requestTicket =
          marketApplyRequestTrackerRef.current.begin(marketGameId);
        const promise = runSyncFallbackChain({
          userUrl: primaryUrl,
          secureOnly: Boolean(storedSession.token),
          syncOnce: (url) =>
            mounted && marketVisibleRef.current
              ? window.api.syncModMarket(
                  url,
                  forceFullSync,
                  marketGameId,
                  readAuthSession(url) || {},
                )
              : Promise.resolve({
                  success: true,
                  stale: true,
                }),
        })
          .then((result) =>
            marketApplyRequestTrackerRef.current.isCurrent(requestTicket)
              ? result
              : {
                  ...result,
                  stale: true,
                },
          )
          .finally(() => {
            if (marketInitSyncRequestRef.current.key === syncKey) {
              marketInitSyncRequestRef.current = {
                key: null,
                promise: null,
              };
            }
          });
        marketInitSyncRequestRef.current = {
          key: syncKey,
          promise,
        };
        chainResult = await promise;
      }
      if (chainResult.fallbackUrl && hasCached && chainResult.success) {
        return {
          ...chainResult,
          fromCache: false,
        };
      }
      return chainResult;
    }
    async function init() {
      try {
        let cacheResult = warmSessionCache?.mods?.length
          ? {
              success: true,
              mods: warmSessionCache.mods,
              marketAccess: warmSessionCache.syncStatus?.marketAccess,
              syncStatus: warmSessionCache.syncStatus,
              fromSession: true,
            }
          : null;
        if (!cacheResult) {
          const cacheStartedAt = performance.now();
          cacheResult = await requestCachedMods(marketGameId);
          logMarketPerf(
            "getCachedMods",
            cacheStartedAt,
            `${cacheResult?.mods?.length || 0} mods / ${marketGameId}`,
          );
        } else {
          logMarketPerf(
            "getCachedMods(session)",
            performance.now(),
            `${cacheResult.mods.length} mods / ${marketGameId}`,
          );
        }
        if (!mounted) return;
        const hasStoredCache = Boolean(
          cacheResult.success &&
          cacheResult.mods &&
          cacheResult.mods.length > 0,
        );
        const cachedMarketAccess =
          cacheResult.marketAccess ||
          cacheResult.syncStatus?.marketAccess ||
          null;
        const hideCachedForAnonymous = shouldHideControlledMarketCache(
          cachedMarketAccess,
          Boolean(readAuthSession()?.token),
        );
        const hasCached = hasStoredCache && !hideCachedForAnonymous;
        if (hideCachedForAnonymous) {
          setMods([]);
          setMarketDataGameId(marketGameId);
          setSyncStatus((prev) =>
            createMarketSyncStatus(
              {
                success: true,
                mods: [],
                refreshBlocked: true,
                marketAccess:
                  createLoginRequiredMarketAccess(cachedMarketAccess),
              },
              prev || cacheResult.syncStatus,
            ),
          );
          setInitialCacheReady(true);
        } else if (hasCached) {
          if (!cacheResult.fromSession) {
            setMods(cacheResult.mods);
            setMarketDataGameId(marketGameId);
            setSyncStatus(
              createMarketSyncStatus({
                ...cacheResult,
                fromCache: true,
              }),
            );
          }
          setInitialCacheReady(true);
        } else {
          setInitialCacheReady(false);
        }
        const configStartedAt = performance.now();
        const configResult = await requestConfig();
        logMarketPerf("getConfig", configStartedAt);
        let resolvedUrl = serverUrl;
        if (mounted && configResult.success && configResult.config.serverUrl) {
          resolvedUrl = configResult.config.serverUrl;
          setServerUrl(resolvedUrl);
        }
        if (
          mounted &&
          !activeGameId &&
          configResult.success &&
          configResult.config.activeGame?.id
        ) {
          setSelectedGameId(configResult.config.activeGame.id);
        }
        if (mounted && resolvedUrl) {
          if (hasCached && !hasWarmSessionCache) {
            setSyncing(true);
          } else if (!hasCached) {
            setLoading(true);
          }
          setError(null);
          let result = null;
          try {
            const syncStartedAt = performance.now();
            result = await syncWithFallback(resolvedUrl, false, hasCached);
            logMarketPerf(
              "syncModMarket",
              syncStartedAt,
              `${result?.mods?.length || 0} mods / cached=${hasCached}`,
            );
            if (!mounted) return;
            if (result.success) {
              if (!result.stale) {
                if (result.fallbackUrl) setServerUrl(result.fallbackUrl);
                const currentMods = cacheResult.mods || mods;
                const shouldReplaceMods = shouldReplaceMarketSnapshot(
                  result,
                  currentMods,
                );
                if (shouldReplaceMods) {
                  const nextMods = result.mods || [];
                  const nextSignature = getMarketSnapshotSignature(nextMods);
                  const currentSignature =
                    getMarketSnapshotSignature(currentMods);
                  if (
                    nextSignature !== currentSignature ||
                    marketDataGameId !== marketGameId
                  ) {
                    setMods(nextMods);
                    setMarketDataGameId(marketGameId);
                  }
                }
                setSyncStatus((prev) => createMarketSyncStatus(result, prev));
              }
              setInitialCacheReady(true);
            } else {
              setInitialCacheReady(true);
              setError(result.error || t("market.errors.syncFailed"));
            }
          } catch (e) {
            if (mounted) {
              setInitialCacheReady(true);
              setError(
                t("market.errors.connectServer", {
                  message: e.message,
                }),
              );
            }
          } finally {
            if (mounted) {
              setLoading(false);
              setSyncing(false);
            }
          }
          if (!mounted) return;
          delayedRequests.push(
            setTimeout(() => {
              loadPopularityData();
            }, 500),
          );
          delayedRequests.push(
            setTimeout(() => {
              loadLikedMods();
            }, 800),
          );
        }
      } catch (e) {
        console.error("Failed to init mod market:", e);
        if (mounted) {
          setInitialCacheReady(true);
          setLoading(false);
          setSyncing(false);
        }
      }
    }
    init();
    return () => {
      mounted = false;
      delayedRequests.forEach(clearTimeout);
      marketInitSyncRequestRef.current = {
        key: null,
        promise: null,
      };
      window.api.invalidateMarketRequests?.(marketGameId).catch(() => {});
    };
  }, [marketGameId, isActive]);
  async function syncModsFromUrl(baseUrl, forceFullSync = false) {
    const normalizedUrl = normalizeApiBaseUrl(baseUrl);
    const storedSession = readAuthSession() || {};
    const requestTicket =
      marketApplyRequestTrackerRef.current.begin(marketGameId);
    const result = await runSyncFallbackChain({
      userUrl: normalizedUrl,
      secureOnly: Boolean(storedSession.token),
      syncOnce: (url) =>
        marketVisibleRef.current
          ? window.api.syncModMarket(
              url,
              forceFullSync,
              marketGameId,
              readAuthSession(url) || {},
            )
          : Promise.resolve({
              success: true,
              stale: true,
            }),
    });
    return marketApplyRequestTrackerRef.current.isCurrent(requestTicket)
      ? result
      : {
          ...result,
          stale: true,
        };
  }
  async function silentlyRefreshMarket({
    reason = "active",
    forceFullSync = false,
  } = {}) {
    if (!marketVisibleRef.current || !serverUrl || !marketGameId) return null;
    const authKey = readAuthSession()?.token || "anonymous";
    const refreshKey = `${marketGameId}|${normalizeApiBaseUrl(serverUrl)}|${forceFullSync ? "full" : "delta"}|${authKey}`;
    if (
      marketSilentRefreshRef.current.key === refreshKey &&
      marketSilentRefreshRef.current.promise
    ) {
      return marketSilentRefreshRef.current.promise;
    }
    const promise = (async () => {
      try {
        const startedAt = performance.now();
        const result = await syncModsFromUrl(serverUrl, forceFullSync);
        logMarketPerf(
          `silentSyncModMarket:${reason}`,
          startedAt,
          `${result?.mods?.length || 0} mods`,
        );
        if (!result?.success) {
          setSyncStatus((prev) => ({
            ...(prev || {}),
            syncError: result?.error || t("market.errors.syncFailed"),
            primarySyncError: result?.primarySyncError || null,
            fallbackUrl: result?.fallbackUrl || null,
          }));
          return result;
        }
        if (result.stale) return result;
        if (result.fallbackUrl) setServerUrl(result.fallbackUrl);
        const nextMods = Array.isArray(result.mods) ? result.mods : [];
        const shouldReplaceMods = shouldReplaceMarketSnapshot(result, mods);
        if (shouldReplaceMods) {
          setMods(nextMods);
          setMarketDataGameId(marketGameId);
          setInitialCacheReady(true);
        }
        setSyncStatus((prev) => createMarketSyncStatus(result, prev));
        return result;
      } catch (e) {
        setSyncStatus((prev) => ({
          ...(prev || {}),
          syncError: e?.message || t("market.errors.backgroundSync"),
        }));
        return {
          success: false,
          error: e?.message || t("market.errors.backgroundSync"),
        };
      } finally {
        if (marketSilentRefreshRef.current.key === refreshKey) {
          marketSilentRefreshRef.current = {
            key: null,
            promise: null,
          };
        }
      }
    })();
    marketSilentRefreshRef.current = {
      key: refreshKey,
      promise,
    };
    return promise;
  }
  React.useEffect(() => {
    const unsubscribe = subscribeAuthSession((session) => {
      const nextIdentity = getAuthSessionIdentity(session);
      if (marketAuthIdentityRef.current === nextIdentity) return;
      marketAuthIdentityRef.current = nextIdentity;
      marketApplyRequestTrackerRef.current.invalidate(marketGameId);
      const invalidation = window.api.invalidateMarketRequests?.(marketGameId);
      invalidation?.catch?.(() => {});
      marketInitSyncRequestRef.current = {
        key: null,
        promise: null,
      };
      marketSilentRefreshRef.current = {
        key: null,
        promise: null,
      };
      const hasAuthToken = Boolean(session?.token);
      const currentMarketAccess = marketSyncStatusRef.current?.marketAccess;
      if (shouldHideControlledMarketCache(currentMarketAccess, hasAuthToken)) {
        setMods([]);
        setMarketDataGameId(marketGameId);
        setInitialCacheReady(true);
        setDetailMod(null);
        setSyncStatus((prev) =>
          createMarketSyncStatus(
            {
              refreshBlocked: true,
              marketAccess: createLoginRequiredMarketAccess(
                prev?.marketAccess || currentMarketAccess,
              ),
            },
            prev,
          ),
        );
      }
      if (!serverUrl) return;
      silentlyRefreshMarket({
        reason: "auth-change",
        forceFullSync: true,
      }).catch(() => {});
    });
    return unsubscribe;
  }, [marketGameId, serverUrl]);
  React.useEffect(() => {
    const handlePollResult = (event) => {
      const result = event?.detail;
      if (!result?.success || result.stale || result.gameId !== marketGameId)
        return;
      const currentMods = marketModsRef.current;
      if (shouldReplaceMarketSnapshot(result, currentMods)) {
        const nextMods = Array.isArray(result.mods) ? result.mods : [];
        setMods(nextMods);
        setMarketDataGameId(marketGameId);
        setInitialCacheReady(true);
      }
      setSyncStatus((prev) => createMarketSyncStatus(result, prev));
    };
    window.addEventListener("qaqm:market-poll-result", handlePollResult);
    return () =>
      window.removeEventListener("qaqm:market-poll-result", handlePollResult);
  }, [marketGameId]);
  React.useEffect(() => {
    if (!isActive || !serverUrl) return;
    let cancelled = false;
    const controller = new AbortController();
    async function fetchGameVersions() {
      try {
        const res = await fetch(`${serverUrl}/api/mods/game-versions`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await res.json();
        if (!cancelled && data.success) {
          setServerGameVersions(data.versions || []);
        }
      } catch {}
    }
    fetchGameVersions();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [serverUrl, isActive]);
  async function syncMods(forceFullSync = false) {
    if (!marketVisibleRef.current) return;
    if (!serverUrl) {
      setError(t("market.errors.serverRequired"));
      return;
    }
    if (mods.length === 0) {
      setLoading(true);
    } else {
      setSyncing(true);
    }
    setError(null);
    try {
      const result = await syncModsFromUrl(serverUrl, forceFullSync);
      if (result.success) {
        if (result.stale) return;
        if (result.fallbackUrl) setServerUrl(result.fallbackUrl);
        const syncedMods = result.mods || [];
        if (shouldReplaceMarketSnapshot(result, mods)) {
          setMods(syncedMods);
          setMarketDataGameId(marketGameId);
        }
        setInitialCacheReady(true);
        setSyncStatus((prev) => createMarketSyncStatus(result, prev));
        loadLikedMods();
      } else {
        setError(result.error || t("market.errors.syncFailed"));
      }
    } catch (e) {
      setError(
        t("market.errors.connectServer", {
          message: e.message,
        }),
      );
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }
  return {
    silentlyRefreshMarket,
    syncMods,
  };
}
