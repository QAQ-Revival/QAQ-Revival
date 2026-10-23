import {
  normalizeApiBaseUrl,
  isSecureApiUrl,
  areSameQaqmServiceUrl,
} from "./marketApi.js";
const AUTH_STORAGE_KEY = "qaqm-auth-session";
let memoryCache = null;
const subscribers = new Set();
function readFromStorage() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}
memoryCache = readFromStorage();
function getCachedAuthSession() {
  return memoryCache;
}
function getAuthSessionIdentity(session = memoryCache) {
  const token = String(session?.token || "").trim();
  const serverUrl = token ? normalizeApiBaseUrl(session?.serverUrl || "") : "";
  return token ? `${serverUrl}|${token}` : "anonymous";
}
function subscribeAuthSession(listener) {
  subscribers.add(listener);
  return () => subscribers.delete(listener);
}
function readAuthSession(currentServerUrl) {
  const saved = memoryCache || readFromStorage();
  if (!saved?.token) return null;
  if (!isSecureApiUrl(saved.serverUrl)) return null;
  if (currentServerUrl && !isSecureApiUrl(currentServerUrl)) return null;
  if (
    currentServerUrl &&
    saved.serverUrl &&
    !areSameQaqmServiceUrl(saved.serverUrl, currentServerUrl)
  )
    return null;
  return saved;
}
export {
  getAuthSessionIdentity,
  readAuthSession,
  subscribeAuthSession,
  getCachedAuthSession,
};
