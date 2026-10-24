"use strict";

const node_crypto = require("node:crypto");
const ACCESS_DENIED_CODES = new Set(["LOGIN_REQUIRED", "SESSION_EXPIRED", "ACCOUNT_NOT_ELIGIBLE", "MARKET_ACCESS_DENIED", "WEB_GAME_HIDDEN"]);
function normalizeMarketAccessPayload(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const controlled = value.controlled === true;
  const allowed = value.allowed !== false;
  const code = String(value.code || (allowed ? "UNRESTRICTED" : "MARKET_ACCESS_DENIED")).trim().toUpperCase();
  return {
    controlled,
    allowed,
    code,
    clearExisting: value.clearExisting === true
  };
}
function isMarketRefreshBlocked(value) {
  const access = normalizeMarketAccessPayload(value);
  return Boolean(access && !access.allowed && (access.controlled || access.clearExisting || ACCESS_DENIED_CODES.has(access.code)));
}
function shouldPreserveMarketSnapshotOnEmptyResult(result, currentMods = []) {
  if (!Array.isArray(currentMods) || currentMods.length === 0) return false;
  if (result?.wasIncremental === true) return false;
  if (!Array.isArray(result?.mods)) return true;
  if (result.mods.length > 0) return false;
  return result?.marketAccess?.allowed !== true;
}
function preserveBlockedMarketSnapshot(cache, {
  marketAccess,
  authScope = "",
  accessCheckedAt = new Date().toISOString()
} = {}) {
  const current = cache && typeof cache === "object" && !Array.isArray(cache) ? cache : {};
  return {
    ...current,
    marketAccess: normalizeMarketAccessPayload(marketAccess),
    authScope: String(authScope || ""),
    accessCheckedAt
  };
}
function createLatestRequestTracker() {
  let nextId = 0;
  const latestByKey = new Map();
  return {
    begin(key) {
      const normalizedKey = String(key || "default");
      const ticket = {
        key: normalizedKey,
        id: ++nextId
      };
      latestByKey.set(normalizedKey, ticket.id);
      return ticket;
    },
    isCurrent(ticket) {
      return Boolean(ticket && latestByKey.get(ticket.key) === ticket.id);
    },
    invalidate(key) {
      const normalizedKey = String(key || "default");
      latestByKey.set(normalizedKey, ++nextId);
    },
    invalidateAll() {
      nextId += 1;
      latestByKey.clear();
    }
  };
}
const RETIRED_DIRECT_FALLBACK_HOST = "direct.qaqm.top";
const QAQR_HTTPS_HOSTS = new Set(["qaqm.top", "www.qaqm.top", RETIRED_DIRECT_FALLBACK_HOST]);
function normalizeAuthUrl(value) {
  const raw = String(value || "").trim().replace(/\/+$/, "");
  if (!raw) return "";
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(candidate);
    const host = parsed.hostname.toLowerCase();
    if (host === RETIRED_DIRECT_FALLBACK_HOST) return "https://qaqm.top";
    const pathname = parsed.pathname.replace(/\/+$/, "");
    return `${parsed.protocol.toLowerCase()}//${parsed.host.toLowerCase()}${pathname === "/" ? "" : pathname}`;
  } catch {
    return "";
  }
}
function isSecureMarketAuthUrl(value) {
  const normalized = normalizeAuthUrl(value);
  if (!normalized) return false;
  try {
    return new URL(normalized).protocol === "https:";
  } catch {
    return false;
  }
}
function areSameMarketAuthService(leftValue, rightValue) {
  const left = normalizeAuthUrl(leftValue);
  const right = normalizeAuthUrl(rightValue);
  if (!left || !right) return false;
  if (left === right) return true;
  try {
    const leftUrl = new URL(left);
    const rightUrl = new URL(right);
    return leftUrl.protocol === "https:" && rightUrl.protocol === "https:" && QAQR_HTTPS_HOSTS.has(leftUrl.hostname) && QAQR_HTTPS_HOSTS.has(rightUrl.hostname);
  } catch {
    return false;
  }
}
function resolveMarketAuthToken({
  authToken,
  authServerUrl,
  targetServerUrl
} = {}) {
  const token = String(authToken || "").trim();
  if (!token || !isSecureMarketAuthUrl(targetServerUrl)) return "";
  return areSameMarketAuthService(authServerUrl, targetServerUrl) ? token : "";
}
function createMarketAuthScope(authToken) {
  const token = String(authToken || "").trim();
  if (!token) return "anonymous";
  return `token:${node_crypto.createHash("sha256").update(token, "utf8").digest("hex").slice(0, 24)}`;
}
module.exports = {
  normalizeMarketAccessPayload,
  isMarketRefreshBlocked,
  shouldPreserveMarketSnapshotOnEmptyResult,
  preserveBlockedMarketSnapshot,
  createLatestRequestTracker,
  isSecureMarketAuthUrl,
  areSameMarketAuthService,
  resolveMarketAuthToken,
  createMarketAuthScope
};
