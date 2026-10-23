const INTEGRATED_PACKAGE_DOWNLOAD_URL = "https://www.qaqm.top/download";
const INTEGRATED_PACKAGE_EXTRACTOR_URL = "https://pan.quark.cn/s/64155f7ee7ea";
function normalizeLegacyPreview(preview) {
  return {
    token: preview?.token || "",
    hasCandidates: !!preview?.hasCandidates,
    categoryCount: Number(preview?.categoryCount || 0),
    modCount: Number(preview?.modCount || 0),
    sourceRoots: Array.isArray(preview?.sourceRoots) ? preview.sourceRoots : [],
    targetCharacters: Array.isArray(preview?.targetCharacters)
      ? preview.targetCharacters
      : [],
    previewMoves: Array.isArray(preview?.previewMoves)
      ? preview.previewMoves
      : [],
  };
}
function isSameLegacyPreview(left, right) {
  return (
    JSON.stringify(normalizeLegacyPreview(left)) ===
    JSON.stringify(normalizeLegacyPreview(right))
  );
}
function normalizeSearchValue(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\s·.。・'"“”‘’`~!@#$%^&*()_+=\-/{},.:;<>?\\|\[\]]+/g, "")
    .trim();
}
function getCharacterSkinCount(character) {
  return Number(character?.skinCount ?? character?.officialSkinCount ?? 0) || 0;
}
function getCharacterPinnedStorageKey(gameId) {
  return `charview-pinned-${gameId || "default"}`;
}
function readCharacterPinnedSet(gameId) {
  try {
    const raw = localStorage.getItem(getCharacterPinnedStorageKey(gameId));
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}
function writeCharacterPinnedSet(gameId, pinnedSet) {
  try {
    localStorage.setItem(
      getCharacterPinnedStorageKey(gameId),
      JSON.stringify(Array.from(pinnedSet)),
    );
  } catch {}
}
function getCharacterCustomOrderKey(gameId) {
  return `charview-custom-order-${gameId || "default"}`;
}
function getCharacterShowAllStorageKey(gameId) {
  return `charview-show-all-characters-${gameId || "default"}`;
}
function readCharacterShowAll(gameId) {
  try {
    const raw = localStorage.getItem(getCharacterShowAllStorageKey(gameId));
    return raw === null ? true : raw !== "false";
  } catch {
    return true;
  }
}
function isCoverImageFile(file) {
  if (!file) return false;
  const type = String(file.type || "");
  const name = String(file.name || file.path || "");
  return (
    type.startsWith("image/") || /\.(png|jpg|jpeg|webp|gif|bmp)$/i.test(name)
  );
}
function dataTransferIncludesCoverImage(dataTransfer) {
  if (!dataTransfer) return false;
  if (dataTransfer.items && dataTransfer.items.length > 0) {
    return Array.from(dataTransfer.items).every((item) => {
      const type = String(item.type || "");
      if (type.startsWith("image/")) return true;
      const file =
        typeof item.getAsFile === "function" ? item.getAsFile() : null;
      return isCoverImageFile(file);
    });
  }
  if (dataTransfer.files && dataTransfer.files.length > 0) {
    return Array.from(dataTransfer.files).every(isCoverImageFile);
  }
  return false;
}
function readNevernessModeFallback(activeGame) {
  if (activeGame?.id !== "neverness-to-everness") return null;
  try {
    const cachedMode = localStorage.getItem("neverness-mod-mode");
    if (cachedMode === "dx12" || cachedMode === "nemi") return cachedMode;
  } catch {}
  return activeGame?.launchMode === "DX12" ? "dx12" : "nemi";
}
export {
  getCharacterCustomOrderKey,
  readNevernessModeFallback,
  readCharacterPinnedSet,
  getCharacterPinnedStorageKey,
  getCharacterShowAllStorageKey,
  readCharacterShowAll,
  normalizeSearchValue,
  getCharacterSkinCount,
  writeCharacterPinnedSet,
  normalizeLegacyPreview,
  INTEGRATED_PACKAGE_DOWNLOAD_URL,
  INTEGRATED_PACKAGE_EXTRACTOR_URL,
  isCoverImageFile,
  dataTransferIncludesCoverImage,
};
