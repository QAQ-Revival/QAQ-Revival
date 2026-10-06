const LEGACY_KEY = "clientId";
let cachedClientId = null;
let inflightResolve = null;
async function readConfig() {
  try {
    const result = await window.api.getConfig();
    return result && (result.success ? result.config : result);
  } catch (e) {
    console.warn("[clientIdentity] getConfig failed:", e?.message || e);
    return null;
  }
}
function readLegacyLocalStorageId() {
  try {
    const value = localStorage.getItem(LEGACY_KEY);
    return value && typeof value === "string" ? value : null;
  } catch {
    return null;
  }
}
async function resolveOnce() {
  const cfg = await readConfig();
  const canonical = cfg && typeof cfg.clientId === "string" && cfg.clientId.trim() ? cfg.clientId : null;
  const legacy = readLegacyLocalStorageId();
  return canonical || legacy || null;
}
function getCanonicalClientId() {
  if (cachedClientId) return Promise.resolve(cachedClientId);
  if (inflightResolve) return inflightResolve;
  inflightResolve = resolveOnce().then((id) => {
    cachedClientId = id;
    return id;
  }).finally(() => {
    inflightResolve = null;
  });
  return inflightResolve;
}
function getCachedClientId() {
  return cachedClientId;
}
export {
  getCachedClientId as a,
  getCanonicalClientId as g
};
