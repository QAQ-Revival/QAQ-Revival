import { t } from "../../shared/i18n/index.mjs";
const PRIMARY_SERVER_URL = "https://qaqm.top";
const BARE_FALLBACK_SERVER_URL = "http://129.211.14.231:18080";
const RETIRED_DIRECT_FALLBACK_HOST = "direct.qaqm.top";
const QAQM_HOSTS = new Set([
  "qaqm.top",
  "www.qaqm.top",
  RETIRED_DIRECT_FALLBACK_HOST,
  "129.211.14.231",
]);
const FALLBACK_SHARED_SECRET = "qaqm-fallback-129.211.14.231-18080-v1";
function normalizeApiBaseUrl(value) {
  const raw = String(value || "")
    .trim()
    .replace(/\/+$/, "");
  return raw || PRIMARY_SERVER_URL;
}
function normalizeCandidateBaseUrl(value) {
  const normalized = normalizeApiBaseUrl(value);
  try {
    return new URL(normalized).hostname === RETIRED_DIRECT_FALLBACK_HOST
      ? PRIMARY_SERVER_URL
      : normalized;
  } catch {
    return normalized;
  }
}
function isQaqmServiceUrl(value) {
  try {
    const url = new URL(normalizeApiBaseUrl(value));
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      QAQM_HOSTS.has(url.hostname)
    );
  } catch {
    return false;
  }
}
function isSecureApiUrl(value) {
  try {
    return new URL(normalizeApiBaseUrl(value)).protocol === "https:";
  } catch {
    return false;
  }
}
function isBareFallbackUrl(value) {
  try {
    const url = new URL(normalizeApiBaseUrl(value));
    return (
      url.protocol === "http:" &&
      url.hostname === "129.211.14.231" &&
      url.port === "18080"
    );
  } catch {
    return false;
  }
}
function base64FromBytes(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
function hexFromBytes(bytes) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
async function fallbackCryptoKey(usage) {
  const raw = new TextEncoder().encode(FALLBACK_SHARED_SECRET);
  const keyData =
    usage === "encrypt" ? await crypto.subtle.digest("SHA-256", raw) : raw;
  return crypto.subtle.importKey(
    "raw",
    keyData,
    usage === "encrypt"
      ? "AES-GCM"
      : {
          name: "HMAC",
          hash: "SHA-256",
        },
    false,
    [usage],
  );
}
async function signFallbackRequest({ method, path, payload }) {
  const ts = String(Date.now());
  const nonceBytes = new Uint8Array(16);
  crypto.getRandomValues(nonceBytes);
  const nonce = base64FromBytes(nonceBytes).replace(/[+/=]/g, "");
  const key = await fallbackCryptoKey("sign");
  const data = `${ts}.${nonce}.${String(method || "GET").toUpperCase()}.${String(path || "").split("?")[0]}.${payload || ""}`;
  const signature = hexFromBytes(
    new Uint8Array(
      await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data)),
    ),
  );
  return {
    ts,
    nonce,
    signature,
  };
}
async function encryptFallbackJsonBody(body) {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const key = await fallbackCryptoKey("encrypt");
  const plain = new TextEncoder().encode(
    typeof body === "string" ? body : JSON.stringify(body || {}),
  );
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv,
      },
      key,
      plain,
    ),
  );
  return {
    _qaqmFallback: {
      v: 1,
      iv: base64FromBytes(iv),
      data: base64FromBytes(encrypted),
    },
  };
}
async function prepareFallbackFetchOptions(baseUrl, path, options = {}) {
  if (!isBareFallbackUrl(baseUrl)) return options;
  const next = {
    ...(options || {}),
  };
  const headers = new Headers(next.headers || {});
  const method = String(next.method || "GET").toUpperCase();
  let payloadForSignature = "";
  const contentType = String(
    headers.get("Content-Type") || headers.get("content-type") || "",
  ).toLowerCase();
  if (next.body && contentType.includes("application/json")) {
    const encrypted = await encryptFallbackJsonBody(next.body);
    next.body = JSON.stringify(encrypted);
    payloadForSignature = encrypted._qaqmFallback.data;
    headers.set("Content-Type", "application/json");
  }
  const signed = await signFallbackRequest({
    method,
    path,
    payload: payloadForSignature,
  });
  headers.set("x-qaqm-fallback-ts", signed.ts);
  headers.set("x-qaqm-fallback-nonce", signed.nonce);
  headers.set("x-qaqm-fallback-signature", signed.signature);
  next.headers = headers;
  return next;
}
function areSameQaqmServiceUrl(a, b) {
  const left = normalizeApiBaseUrl(a);
  const right = normalizeApiBaseUrl(b);
  if (left === right) return true;
  return isQaqmServiceUrl(left) && isQaqmServiceUrl(right);
}
function getQaqmSyncCandidates(userUrl, options = {}) {
  const secureOnly = options?.secureOnly === true;
  const seen2 = new Set();
  const candidates = [];
  const push = (url) => {
    if (!url) return;
    const normalized = normalizeCandidateBaseUrl(url);
    if (!normalized) return;
    if (secureOnly && !isSecureApiUrl(normalized)) return;
    if (seen2.has(normalized)) return;
    seen2.add(normalized);
    candidates.push(normalized);
  };
  push(userUrl);
  push(PRIMARY_SERVER_URL);
  push(BARE_FALLBACK_SERVER_URL);
  return candidates;
}
function getQaqmRequestCandidates(
  userUrl,
  { secureOnly = false, authenticationBound = false } = {},
) {
  const primaryUrl = normalizeApiBaseUrl(userUrl);
  const candidates = getQaqmSyncCandidates(primaryUrl, {
    secureOnly,
  });
  return authenticationBound
    ? candidates.filter((candidate) =>
        areSameQaqmServiceUrl(primaryUrl, candidate),
      )
    : candidates;
}
function shouldEscalateToNextCandidate(result) {
  if (!result) return true;
  if (result.error && !result.success) {
    const msg2 = String(result.error || "");
    return !/^服务器返回错误:\s*4\d\d/.test(msg2);
  }
  if (result.success && !result.syncError) return false;
  const msg = String(result.syncError || result.error || result.message || "");
  if (!msg) return true;
  return !/^服务器返回错误:\s*4\d\d/.test(msg);
}
async function runSyncFallbackChain({ userUrl, syncOnce, secureOnly = false }) {
  const candidates = getQaqmSyncCandidates(userUrl, {
    secureOnly,
  });
  let firstResult = null;
  for (let i = 0; i < candidates.length; i++) {
    const url = candidates[i];
    let result;
    try {
      console.log(`[QAQM Fallback][renderer] 尝试同步服务器: ${url}`);
      result = await syncOnce(url);
    } catch (err) {
      result = {
        error: err?.message || String(err),
      };
      console.warn(
        `[QAQM Fallback][renderer] ${url} 同步异常: ${result.error}`,
      );
    }
    if (i === 0) firstResult = result;
    if (!shouldEscalateToNextCandidate(result)) {
      console.log(`[QAQM Fallback][renderer] 命中同步服务器: ${url}`);
      return {
        ...result,
        usedUrl: url,
        attempts: i + 1,
        fallbackUrl: i > 0 ? url : null,
        exhausted: false,
      };
    }
    console.warn(
      `[QAQM Fallback][renderer] ${url} 同步失败，切换下一个候选: ${result?.syncError || result?.error || "unknown"}`,
    );
  }
  return {
    ...(firstResult || {
      error: t("market.errors.allServersUnavailable"),
    }),
    usedUrl: candidates[0] || null,
    attempts: candidates.length,
    fallbackUrl: null,
    exhausted: true,
  };
}
function isJsonLikeResponse(response) {
  const contentType = String(
    response?.headers?.get?.("content-type") || "",
  ).toLowerCase();
  return (
    contentType.includes("application/json") || contentType.includes("+json")
  );
}
async function fetchWithDirectFallback(baseUrl, path, options = {}) {
  const {
    expectJson = false,
    timeoutMs = 0,
    secureOnly: requestedSecureOnly = false,
    ...fetchOptions
  } = options || {};
  const primaryUrl = normalizeApiBaseUrl(baseUrl);
  const normalizedPath = String(path || "").startsWith("/")
    ? path
    : `/${path || ""}`;
  const requestHeaders = new Headers(fetchOptions.headers || {});
  const secureOnly =
    requestedSecureOnly ||
    requestHeaders.has("Authorization") ||
    /^\/api\/auth(?:\/|$)/i.test(normalizedPath);
  const authenticationBound =
    requestHeaders.has("Authorization") ||
    /^\/api\/auth(?:\/|$)/i.test(normalizedPath);
  const candidates = getQaqmRequestCandidates(primaryUrl, {
    secureOnly,
    authenticationBound,
  });
  let firstError = null;
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    let timeout = null;
    try {
      console.log(
        `[QAQM Fallback][renderer] 尝试请求: ${candidate}${normalizedPath}`,
      );
      const requestOptions = {
        ...fetchOptions,
      };
      if (Number(timeoutMs) > 0 && !requestOptions.signal) {
        const controller = new AbortController();
        timeout = setTimeout(() => controller.abort(), Number(timeoutMs));
        requestOptions.signal = controller.signal;
      }
      if (expectJson) {
        const headers = new Headers(requestOptions.headers || {});
        if (!headers.has("Accept")) headers.set("Accept", "application/json");
        requestOptions.headers = headers;
      }
      const preparedOptions = await prepareFallbackFetchOptions(
        candidate,
        normalizedPath,
        requestOptions,
      );
      const response = await fetch(
        `${candidate}${normalizedPath}`,
        preparedOptions,
      );
      if (response.status >= 500 && candidate !== BARE_FALLBACK_SERVER_URL) {
        firstError =
          firstError ||
          new Error(
            t("market.errors.serverResponse", {
              status: response.status,
            }),
          );
        console.warn(
          `[QAQM Fallback][renderer] ${candidate} 返回 ${response.status}，切换下一个候选`,
        );
        continue;
      }
      if (
        expectJson &&
        !isJsonLikeResponse(response) &&
        candidate !== BARE_FALLBACK_SERVER_URL
      ) {
        firstError =
          firstError ||
          new Error(
            t("market.errors.nonJsonResponse", {
              status: response.status,
            }),
          );
        console.warn(
          `[QAQM Fallback][renderer] ${candidate} 返回非 JSON 响应，切换下一个候选`,
        );
        continue;
      }
      console.log(`[QAQM Fallback][renderer] 命中请求服务器: ${candidate}`);
      return {
        response,
        serverUrl: candidate,
        usedFallback: i > 0,
        primaryError: firstError,
      };
    } catch (error) {
      if (!firstError) firstError = error;
      console.warn(
        `[QAQM Fallback][renderer] ${candidate} 请求失败: ${error?.message || error}`,
      );
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }
  throw firstError || new Error(t("market.errors.allServersUnavailable"));
}
export {
  normalizeApiBaseUrl,
  isSecureApiUrl,
  areSameQaqmServiceUrl,
  fetchWithDirectFallback,
  runSyncFallbackChain,
};
