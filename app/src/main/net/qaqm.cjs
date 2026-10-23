"use strict";

const i18n = require("../../shared/i18n/core.cjs");
const electron = require("electron");
const crypto = require("crypto");
const marketAccess = require("../market/access.cjs");
const DEFAULT_SERVER_URL = "https://qaqm.top";
const BARE_FALLBACK_SERVER_URL = "http://129.211.14.231:18080";
const RETIRED_DIRECT_FALLBACK_HOST = "direct.qaqm.top";
const QAQM_REQUEST_ATTEMPT_TIMEOUT_MS = 8e3;
const LEGACY_DIRECT_SERVER_URL = "http://129.211.14.231:3000";
const LEGACY_DIRECT_HOSTS = new Set(["129.211.14.231"]);
const FALLBACK_SHARED_SECRET = "qaqm-fallback-129.211.14.231-18080-v1";
function isBareFallbackServerUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    return url.protocol === "http:" && url.hostname === "129.211.14.231" && url.port === "18080";
  } catch (_) {
    return false;
  }
}
function getQaqmServerCandidates(value, options = {}) {
  const secureOnly = options?.secureOnly === true;
  const seen = new Set();
  const candidates = [];
  const push = url => {
    let normalized = String(url || "").trim().replace(/\/+$/, "");
    try {
      if (new URL(normalized).hostname === RETIRED_DIRECT_FALLBACK_HOST) {
        normalized = DEFAULT_SERVER_URL;
      }
    } catch (_) {}
    if (!normalized || seen.has(normalized)) return;
    if (secureOnly && !marketAccess.isSecureMarketAuthUrl(normalized)) return;
    seen.add(normalized);
    candidates.push(normalized);
  };
  push(value);
  push(DEFAULT_SERVER_URL);
  push(BARE_FALLBACK_SERVER_URL);
  return candidates;
}
function encryptFallbackJsonBody(rawBody) {
  const key = crypto.createHash("sha256").update(FALLBACK_SHARED_SECRET).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(String(rawBody || "{}"), "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    _qaqmFallback: {
      v: 1,
      iv: iv.toString("base64"),
      data: Buffer.concat([encrypted, authTag]).toString("base64")
    }
  };
}
function signFallbackRequest({
  method,
  path: requestPath,
  payload
}) {
  const ts = String(Date.now());
  const nonce = crypto.randomBytes(16).toString("base64url");
  const cleanPath = String(requestPath || "").split("?")[0];
  const signature = crypto.createHmac("sha256", FALLBACK_SHARED_SECRET).update(`${ts}.${nonce}.${String(method).toUpperCase()}.${cleanPath}.${payload || ""}`).digest("hex");
  return {
    ts,
    nonce,
    signature
  };
}
function prepareFallbackJsonRequest(baseUrl, requestPath, options = {}) {
  if (!isBareFallbackServerUrl(baseUrl)) return options;
  const next = {
    ...(options || {})
  };
  const headers = {
    ...(next.headers || {})
  };
  let payloadForSignature = "";
  const contentType = String(headers["Content-Type"] || headers["content-type"] || "").toLowerCase();
  if (next.body && contentType.includes("application/json")) {
    const encrypted = encryptFallbackJsonBody(next.body);
    next.body = JSON.stringify(encrypted);
    payloadForSignature = encrypted._qaqmFallback.data;
    headers["Content-Type"] = "application/json";
  }
  const signed = signFallbackRequest({
    method: next.method || "GET",
    path: requestPath,
    payload: payloadForSignature
  });
  headers["x-qaqm-fallback-ts"] = signed.ts;
  headers["x-qaqm-fallback-nonce"] = signed.nonce;
  headers["x-qaqm-fallback-signature"] = signed.signature;
  next.headers = headers;
  return next;
}
function isJsonLikeResponse(response) {
  const contentType = String(response?.headers?.get?.("content-type") || "").toLowerCase();
  return contentType.includes("application/json") || contentType.includes("+json");
}
function createTimedFetchOptions(options = {}, timeoutMs = QAQM_REQUEST_ATTEMPT_TIMEOUT_MS) {
  const requestOptions = {
    ...(options || {})
  };
  const parentSignal = requestOptions.signal;
  if (!timeoutMs && !parentSignal) {
    return {
      options: requestOptions,
      cleanup: () => {},
      timedOut: () => false
    };
  }
  const controller = new AbortController();
  let didTimeout = false;
  let timer = null;
  const abortFromParent = () => controller.abort();
  if (parentSignal) {
    if (parentSignal.aborted) {
      controller.abort();
    } else {
      parentSignal.addEventListener("abort", abortFromParent, {
        once: true
      });
    }
  }
  if (timeoutMs > 0) {
    timer = setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, timeoutMs);
  }
  requestOptions.signal = controller.signal;
  return {
    options: requestOptions,
    cleanup: () => {
      if (timer) clearTimeout(timer);
      if (parentSignal) parentSignal.removeEventListener("abort", abortFromParent);
    },
    timedOut: () => didTimeout
  };
}
async function fetchWithElectronNet(url, requestOptions = {}) {
  if (electron.net && typeof electron.net.fetch === "function") {
    try {
      return await electron.net.fetch(url, requestOptions);
    } catch (error) {
      if (error?.name === "AbortError") throw error;
    }
  }
  return fetch(url, requestOptions);
}
async function fetchQaqmWithFallback(serverUrl, requestPath, options = {}) {
  const {
    expectJson = false,
    secureOnly = false,
    authenticationBound = false,
    headersForCandidate = null,
    isCurrent = null,
    ...fetchOptions
  } = options || {};
  const staticHeaders = fetchOptions.headers;
  const hasAuthorizationHeader = typeof staticHeaders?.has === "function" ? staticHeaders.has("Authorization") || staticHeaders.has("authorization") : Object.keys(staticHeaders || {}).some(key => String(key).toLowerCase() === "authorization");
  const requestRequiresHttps = secureOnly || hasAuthorizationHeader || /^\/api\/auth(?:\/|$)/i.test(String(requestPath || ""));
  let lastError = null;
  const authenticationBoundRequest = authenticationBound || hasAuthorizationHeader || /^\/api\/auth(?:\/|$)/i.test(String(requestPath || ""));
  const candidates = getQaqmServerCandidates(serverUrl, {
    secureOnly: requestRequiresHttps
  }).filter(candidate => !authenticationBoundRequest || marketAccess.areSameMarketAuthService(serverUrl, candidate));
  for (let i = 0; i < candidates.length; i++) {
    if (isCurrent && !(await isCurrent())) throw new Error(i18n.t("backend.net.qaqm.requestStopped"));
    const candidate = candidates[i];
    try {
      console.log(`[QAQM Fallback][main] 尝试请求: ${candidate}${requestPath}`);
      const requestOptions = {
        ...fetchOptions
      };
      if (typeof headersForCandidate === "function") {
        requestOptions.headers = headersForCandidate(candidate, fetchOptions.headers || {});
      }
      if (expectJson) {
        const headers = {
          ...(requestOptions.headers || {})
        };
        if (!headers.Accept && !headers.accept) headers.Accept = "application/json";
        requestOptions.headers = headers;
      }
      const timed = createTimedFetchOptions(requestOptions);
      const prepared = prepareFallbackJsonRequest(candidate, requestPath, timed.options);
      const response = await fetchWithElectronNet(`${candidate}${requestPath}`, prepared).finally(timed.cleanup);
      if (response.status >= 500 && candidate !== BARE_FALLBACK_SERVER_URL) {
        lastError = new Error(i18n.t("backend.market.install.serverResponseError", {
          status: response.status
        }));
        console.warn(`[QAQM Fallback][main] ${candidate} 返回 ${response.status}，切换下一个候选`);
        continue;
      }
      if (expectJson && !isJsonLikeResponse(response) && candidate !== BARE_FALLBACK_SERVER_URL) {
        lastError = new Error(i18n.t("backend.net.qaqm.nonJsonResponse", {
          status: response.status
        }));
        console.warn(`[QAQM Fallback][main] ${candidate} 返回非 JSON 响应，切换下一个候选`);
        continue;
      }
      console.log(`[QAQM Fallback][main] 命中请求服务器: ${candidate}`);
      return {
        response,
        serverUrl: candidate,
        usedFallback: i > 0
      };
    } catch (error) {
      if (fetchOptions.signal?.aborted) throw error;
      lastError = error?.name === "AbortError" ? new Error(i18n.t("backend.market.install.requestTimedOut")) : error;
      console.warn(`[QAQM Fallback][main] ${candidate} 请求失败: ${error?.message || error}`);
    }
  }
  throw lastError || new Error(i18n.t("backend.market.install.allServersUnavailable"));
}
function normalizeServerUrlInput(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(candidate);
    const host = parsed.hostname.toLowerCase();
    const path2 = parsed.pathname.replace(/\/+$/, "");
    const isKnownQaqmHost = host === "qaqm.top" || host === "www.qaqm.top";
    if (isKnownQaqmHost) {
      return DEFAULT_SERVER_URL;
    }
    return `${parsed.protocol}//${parsed.host}${path2 === "/" ? "" : path2}`.replace(/\/+$/, "");
  } catch {
    return raw.replace(/\/+$/, "");
  }
}
function normalizePersistedServerUrlInput(value) {
  const normalized = normalizeServerUrlInput(value);
  if (!normalized) return "";
  try {
    const parsed = new URL(normalized);
    const host = parsed.hostname.toLowerCase();
    const origin = `${parsed.protocol}//${parsed.host}`.replace(/\/+$/, "");
    const isDirectFallbackHost = host === RETIRED_DIRECT_FALLBACK_HOST || LEGACY_DIRECT_HOSTS.has(host) || origin === LEGACY_DIRECT_SERVER_URL;
    return isDirectFallbackHost ? DEFAULT_SERVER_URL : normalized;
  } catch {
    return normalized;
  }
}
function normalizeDeveloperServerUrlInput(value) {
  return normalizeServerUrlInput(value) || DEFAULT_SERVER_URL;
}
module.exports = {
  getQaqmServerCandidates,
  prepareFallbackJsonRequest,
  createTimedFetchOptions,
  fetchWithElectronNet,
  fetchQaqmWithFallback,
  normalizeServerUrlInput,
  normalizePersistedServerUrlInput,
  normalizeDeveloperServerUrlInput,
  DEFAULT_SERVER_URL,
  BARE_FALLBACK_SERVER_URL
};
