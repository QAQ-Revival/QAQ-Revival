function normalizeMarketAccessPayload(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const controlled = value.controlled === true;
  const allowed = value.allowed !== false;
  const code = String(
    value.code || (allowed ? "UNRESTRICTED" : "MARKET_ACCESS_DENIED"),
  )
    .trim()
    .toUpperCase();
  return {
    controlled,
    allowed,
    code,
    clearExisting: value.clearExisting === true,
  };
}
function shouldHideControlledMarketCache(marketAccess, hasAuthToken = false) {
  const access = normalizeMarketAccessPayload(marketAccess);
  return Boolean(access?.controlled && !hasAuthToken);
}
function getMarketSnapshotSignature(mods = []) {
  if (!Array.isArray(mods) || mods.length === 0) return "0";
  return mods
    .map((mod) =>
      [
        mod?.id,
        mod?.updatedAt || mod?.updated_at || "",
        mod?.downloadCount || mod?.downloads || 0,
        mod?.pinned ? 1 : 0,
        mod?.hot || mod?.isHot || mod?.marketHot ? 1 : 0,
        mod?.sortOrder || 0,
      ].join(":"),
    )
    .join("|");
}
function shouldPreserveMarketSnapshotOnEmptyResult(result, currentMods = []) {
  if (!Array.isArray(currentMods) || currentMods.length === 0) return false;
  if (result?.wasIncremental === true) return false;
  if (!Array.isArray(result?.mods)) return true;
  if (result.mods.length > 0) return false;
  return result?.marketAccess?.allowed !== true;
}
function shouldReplaceMarketSnapshot(result, currentMods = []) {
  if (
    !result?.success ||
    result.stale === true ||
    result.ignoredEmpty === true
  ) {
    return false;
  }
  if (!Array.isArray(result.mods)) return false;
  if (result.fromCache && result.syncError) return false;
  if (result.refreshBlocked === true) return result.mods.length === 0;
  if (shouldPreserveMarketSnapshotOnEmptyResult(result, currentMods))
    return false;
  if (result.wasIncremental !== true) return true;
  if (!Array.isArray(currentMods) || currentMods.length === 0) return true;
  if (
    Number(result.updatedCount || 0) > 0 ||
    Number(result.deletedCount || 0) > 0
  )
    return true;
  return (
    getMarketSnapshotSignature(result.mods) !==
    getMarketSnapshotSignature(currentMods)
  );
}
function createLatestRequestTracker() {
  let nextId = 0;
  const latestByKey = new Map();
  return {
    begin(key) {
      const normalizedKey = String(key || "default");
      const ticket = {
        key: normalizedKey,
        id: ++nextId,
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
    },
  };
}
export {
  normalizeMarketAccessPayload,
  shouldHideControlledMarketCache,
  createLatestRequestTracker,
  getMarketSnapshotSignature,
  shouldReplaceMarketSnapshot,
};
