const MARK_STORAGE_KEY = "qaqm-marked-mods";
function readMarkedMods() {
  try {
    return JSON.parse(localStorage.getItem(MARK_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}
function writeMarkedMods(map) {
  try {
    localStorage.setItem(MARK_STORAGE_KEY, JSON.stringify(map));
  } catch {}
}
function flattenMarkedMods(marked, gameId) {
  const result = {};
  for (const [entryCharacterName, mods] of Object.entries(marked || {})) {
    if (!mods || typeof mods !== "object") continue;
    for (const [modName, value] of Object.entries(mods)) {
      const item = value && typeof value === "object" ? value : {};
      const itemPath = item.path || item.originalPath;
      if (!itemPath) continue;
      result[itemPath] = {
        name: item.name || modName,
        originalName: item.originalName,
        characterName: item.characterName || entryCharacterName,
        gameId: item.gameId || gameId,
        path: itemPath,
        markedAt: item.markedAt,
      };
    }
  }
  return result;
}
function findMarkedModKey(markedMods, mod, characterName, gameId) {
  if (!mod) return null;
  if (markedMods?.[mod.path]) return mod.path;
  return (
    Object.entries(markedMods || {}).find(
      ([, item]) =>
        item?.name === mod.name &&
        item?.characterName === characterName &&
        (!item?.gameId || item.gameId === gameId),
    )?.[0] || null
  );
}
function isMarkedModEntry(markedMods, mod, characterName, gameId) {
  return !!findMarkedModKey(markedMods, mod, characterName, gameId);
}
export {
  readMarkedMods,
  flattenMarkedMods,
  writeMarkedMods,
  findMarkedModKey,
  isMarkedModEntry,
};
