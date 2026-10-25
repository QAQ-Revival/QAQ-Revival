export function collectionSelectionKey(gameId, characterName) {
  return "qaqm.collection-selection.v1:" + JSON.stringify([gameId || "default", characterName || ""]);
}

export function readCollectionSelections(gameId, characterName) {
  try {
    const value = JSON.parse(localStorage.getItem(collectionSelectionKey(gameId, characterName)) || "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([, name]) => typeof name === "string" && name));
  } catch { return {}; }
}

export function saveCollectionSelection(gameId, characterName, identity, modName) {
  if (!identity || !modName) return false;
  try {
    const selections = readCollectionSelections(gameId, characterName);
    if (selections[identity] === modName) return true;
    selections[identity] = modName;
    localStorage.setItem(collectionSelectionKey(gameId, characterName), JSON.stringify(selections));
    return true;
  } catch { return false; }
}
