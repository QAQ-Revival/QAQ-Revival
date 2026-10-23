import {
  cleanCollectionText,
  filterVisibleMarketTags,
} from "./marketCollections.js";
import { normalizeMarketAccessPayload } from "./marketSnapshots.js";
const MARKET_SCROLL_RESTORE_MIN_TOP = 360;
const MARKET_SCROLL_STORAGE_PREFIX = "qaqm-mod-market-scroll:";
const MARKET_CHARACTER_PICKER_CACHE_PREFIX = "qaqm-market-character-picker:";
const MARKET_FIRST_PAINT_LIMIT = 24;
const MARKET_SESSION_CACHE_MAX_AGE_MS = 10 * 60 * 1e3;
const MARKET_SESSION_CACHE = new Map();
function getMarketSessionCache(gameId) {
  const key = cleanCollectionText(gameId || "default");
  if (!key) return null;
  const cached = MARKET_SESSION_CACHE.get(key);
  if (!cached) return null;
  if (
    Date.now() - Number(cached.savedAt || 0) >
    MARKET_SESSION_CACHE_MAX_AGE_MS
  ) {
    MARKET_SESSION_CACHE.delete(key);
    return null;
  }
  return cached;
}
function createMarketSyncStatus(result, previous = null) {
  return {
    ...(previous || {}),
    fromCache: result?.fromCache || false,
    wasIncremental: result?.wasIncremental || false,
    updatedCount: result?.updatedCount || 0,
    deletedCount: result?.deletedCount || 0,
    syncError: result?.syncError || null,
    fallbackUrl: result?.fallbackUrl || null,
    primarySyncError: result?.primarySyncError || null,
    marketAccess: normalizeMarketAccessPayload(result?.marketAccess),
    refreshBlocked: result?.refreshBlocked === true,
  };
}
function createLoginRequiredMarketAccess(marketAccess) {
  const current = normalizeMarketAccessPayload(marketAccess);
  return {
    ...(current || {}),
    controlled: true,
    allowed: false,
    code: "LOGIN_REQUIRED",
    clearExisting: false,
  };
}
function writeMarketSessionCache(gameId, patch) {
  const key = cleanCollectionText(gameId || "default");
  if (!key || !patch || typeof patch !== "object") return;
  const prev = MARKET_SESSION_CACHE.get(key) || {};
  MARKET_SESSION_CACHE.set(key, {
    ...prev,
    ...patch,
    gameId: key,
    savedAt: Date.now(),
  });
}
function clearMarketSessionCache(gameId) {
  const key = cleanCollectionText(gameId || "default");
  if (key) MARKET_SESSION_CACHE.delete(key);
}
function scheduleMarketWork(callback, { timeout = 1200, delay = 48 } = {}) {
  if (
    typeof window !== "undefined" &&
    typeof window.requestIdleCallback === "function"
  ) {
    return {
      type: "idle",
      id: window.requestIdleCallback(callback, {
        timeout,
      }),
    };
  }
  return {
    type: "timer",
    id: window.setTimeout(callback, delay),
  };
}
function cancelMarketWork(handle) {
  if (!handle) return;
  if (
    handle.type === "idle" &&
    typeof window !== "undefined" &&
    typeof window.cancelIdleCallback === "function"
  ) {
    window.cancelIdleCallback(handle.id);
    return;
  }
  window.clearTimeout(handle.id);
}
function logMarketPerf(label, startedAt, extra = "") {}
function getMarketScrollStorageKey(gameId) {
  return `${MARKET_SCROLL_STORAGE_PREFIX}${gameId || "default"}`;
}
function readMarketScrollState(storageKey) {
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const scrollTop = Number(parsed?.scrollTop || 0);
    if (
      !Number.isFinite(scrollTop) ||
      scrollTop < MARKET_SCROLL_RESTORE_MIN_TOP
    )
      return null;
    return {
      scrollTop,
      page: Math.max(1, Number(parsed?.page || 1)),
      savedAt: Number(parsed?.savedAt || 0),
      filters: normalizeMarketScrollFilters(parsed?.filters),
    };
  } catch {
    return null;
  }
}
function writeMarketScrollState(storageKey, payload) {
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(payload));
  } catch {}
}
function removeMarketScrollState(storageKey) {
  try {
    sessionStorage.removeItem(storageKey);
  } catch {}
}
function getMarketCharacterPickerCacheKey(gameId) {
  return `${MARKET_CHARACTER_PICKER_CACHE_PREFIX}${gameId || "default"}`;
}
function readMarketCharacterPickerCache(gameId) {
  try {
    const raw = localStorage.getItem(getMarketCharacterPickerCacheKey(gameId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return {
      roleOptions: Array.isArray(parsed.roleOptions) ? parsed.roleOptions : [],
      functionOptions: Array.isArray(parsed.functionOptions)
        ? parsed.functionOptions
        : [],
      covers:
        parsed.covers && typeof parsed.covers === "object" ? parsed.covers : {},
      characterDetails: Array.isArray(parsed.characterDetails)
        ? parsed.characterDetails
        : [],
    };
  } catch {
    return null;
  }
}
function writeMarketCharacterPickerCache(gameId, payload) {
  try {
    localStorage.setItem(
      getMarketCharacterPickerCacheKey(gameId),
      JSON.stringify({
        ...payload,
        savedAt: Date.now(),
      }),
    );
  } catch {}
}
function normalizeMarketCharacterDetails(details) {
  if (!Array.isArray(details)) return [];
  return details
    .map((item) => {
      const name = cleanCollectionText(
        item?.name || item?.zh || item?.displayName,
      );
      if (!name) return null;
      return {
        name,
        coverUrl: item?.coverUrl || null,
        aliases: Array.isArray(item.aliases)
          ? item.aliases.map(cleanCollectionText).filter(Boolean)
          : [],
      };
    })
    .filter(Boolean);
}
function areStringMapsEqual(a = {}, b = {}) {
  const aKeys = Object.keys(a || {});
  const bKeys = Object.keys(b || {});
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => a[key] === b[key]);
}
function areCharacterDetailsEqual(a = [], b = []) {
  if (a.length !== b.length) return false;
  return a.every((item, index) => {
    const other = b[index];
    if (!other || item.name !== other.name || item.coverUrl !== other.coverUrl)
      return false;
    const aliases = Array.isArray(item.aliases) ? item.aliases : [];
    const otherAliases = Array.isArray(other.aliases) ? other.aliases : [];
    return (
      aliases.length === otherAliases.length &&
      aliases.every((alias, aliasIndex) => alias === otherAliases[aliasIndex])
    );
  });
}
function normalizeMarketScrollFilters(filters) {
  if (!filters || typeof filters !== "object") return null;
  const selectedTags = filterVisibleMarketTags(
    Array.isArray(filters.selectedTags)
      ? filters.selectedTags
          .map((tag) => {
            const id = cleanCollectionText(tag?.id || tag);
            if (!id) return null;
            return {
              id,
              name: cleanCollectionText(tag?.name || tag?.label || id),
            };
          })
          .filter(Boolean)
      : [],
  );
  return {
    selectedGameId: cleanCollectionText(
      filters.selectedGameId || filters.gameId || "all",
    ),
    searchQuery: String(filters.searchQuery || ""),
    selectedCharacter: cleanCollectionText(filters.selectedCharacter || "all"),
    selectedGameVersion: cleanCollectionText(
      filters.selectedGameVersion || "all",
    ),
    selectedModMode: cleanCollectionText(filters.selectedModMode || "all"),
    likedOnly: filters.likedOnly === true,
    showHotSection: filters.showHotSection !== false,
    sortBy: cleanCollectionText(filters.sortBy || "newest"),
    selectedTags,
  };
}
function getMarketScrollFilterKey(filters) {
  const normalized = normalizeMarketScrollFilters(filters);
  if (!normalized) return "";
  return JSON.stringify({
    selectedGameId: normalized.selectedGameId,
    searchQuery: normalized.searchQuery,
    selectedCharacter: normalized.selectedCharacter,
    selectedGameVersion: normalized.selectedGameVersion,
    selectedModMode: normalized.selectedModMode,
    likedOnly: normalized.likedOnly,
    showHotSection: normalized.showHotSection,
    sortBy: normalized.sortBy,
    selectedTags: normalized.selectedTags.map((tag) => tag.id).sort(),
  });
}
export {
  getMarketSessionCache,
  createMarketSyncStatus,
  createLoginRequiredMarketAccess,
  readMarketCharacterPickerCache,
  normalizeMarketCharacterDetails,
  areStringMapsEqual,
  areCharacterDetailsEqual,
  getMarketScrollStorageKey,
  normalizeMarketScrollFilters,
  getMarketScrollFilterKey,
  readMarketScrollState,
  MARKET_FIRST_PAINT_LIMIT,
  cancelMarketWork,
  scheduleMarketWork,
  logMarketPerf,
  clearMarketSessionCache,
  writeMarketSessionCache,
  writeMarketCharacterPickerCache,
  MARKET_SCROLL_RESTORE_MIN_TOP,
  removeMarketScrollState,
  writeMarketScrollState,
};
