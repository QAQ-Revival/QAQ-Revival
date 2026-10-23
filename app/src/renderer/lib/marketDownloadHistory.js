const MARKET_DOWNLOAD_HISTORY_STORAGE_KEY = "qaqm.market.downloadedMods.v1";
const MARKET_DOWNLOAD_HISTORY_LIMIT = 1e3;
function getStorage() {
  if (typeof globalThis === "undefined") return null;
  return globalThis.localStorage || null;
}
function readMarketDownloadHistory() {
  const storage = getStorage();
  if (!storage) return {};
  try {
    const parsed = JSON.parse(
      storage.getItem(MARKET_DOWNLOAD_HISTORY_STORAGE_KEY) || "{}",
    );
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}
function getMarketDownloadHistoryKey(mod) {
  const modId = String(mod?.id ?? "").trim();
  if (!modId) return "";
  const gameId = String(mod?.gameId || "endfield").trim() || "endfield";
  return `${gameId}:${modId}`;
}
function getMarketDownloadedRecord(mod) {
  const key = getMarketDownloadHistoryKey(mod);
  if (!key) return null;
  const record = readMarketDownloadHistory()[key];
  return record && typeof record === "object" ? record : null;
}
function recordMarketModDownload(mod, downloadedAt = Date.now()) {
  const storage = getStorage();
  const key = getMarketDownloadHistoryKey(mod);
  if (!storage || !key) return false;
  const history = readMarketDownloadHistory();
  history[key] = {
    modId: String(mod.id),
    gameId: String(mod.gameId || "endfield"),
    name: String(mod.name || "Mod"),
    downloadedAt: Number(downloadedAt) || Date.now(),
  };
  const trimmedHistory = Object.fromEntries(
    Object.entries(history)
      .sort(
        ([, left], [, right]) =>
          Number(right?.downloadedAt || 0) - Number(left?.downloadedAt || 0),
      )
      .slice(0, MARKET_DOWNLOAD_HISTORY_LIMIT),
  );
  try {
    storage.setItem(
      MARKET_DOWNLOAD_HISTORY_STORAGE_KEY,
      JSON.stringify(trimmedHistory),
    );
    return true;
  } catch {
    return false;
  }
}
export { recordMarketModDownload, getMarketDownloadedRecord };
