import { t } from "../../../../shared/i18n/index.mjs";
import {
  BASE_SECTION_ID,
  getSectionId,
  getSectionName,
} from "./appearanceSections.js";
const DEFAULT_PREVIEW_ASPECT_RATIO = 4 / 3;
function getAppearanceSectionStorageKey(gameId, characterName) {
  return `modview-appearance-section-${gameId || "default"}-${characterName || "unknown"}`;
}
function getModAppearanceSectionId(mod) {
  return String(mod?.appearanceSectionId || mod?.sectionId || BASE_SECTION_ID);
}
function getExplicitImportAppearanceSectionId(sectionId) {
  const normalized = String(sectionId || BASE_SECTION_ID);
  return normalized === BASE_SECTION_ID ? null : normalized;
}
function getAppearanceImportTargetName(section) {
  return getSectionId(section) === BASE_SECTION_ID
    ? t("mods.import.detectAppearanceFallback")
    : getSectionName(section);
}
function ensureAppearanceApiResult(result, fallbackMessage) {
  if (result?.success === false || result?.error) {
    throw new Error(result?.error || fallbackMessage);
  }
  return (
    result || {
      success: true,
    }
  );
}
async function callAppearanceSectionApi(action, payload) {
  const api = window.api || {};
  const { characterName, sectionId, modName, ...rest } = payload || {};
  if (action === "list") {
    if (api.getCharacterSections)
      return api.getCharacterSections(characterName);
    if (api.getAppearanceSections)
      return api.getAppearanceSections(characterName);
  }
  if (action === "create") {
    if (api.createCharacterSection) {
      return api.createCharacterSection(
        characterName,
        rest.name,
        rest.coverImagePath || null,
        {
          nameEn: rest.nameEn || "",
        },
      );
    }
    if (api.createAppearanceSection)
      return api.createAppearanceSection({
        characterName,
        ...rest,
      });
  }
  if (action === "update") {
    if (api.updateCharacterSection)
      return api.updateCharacterSection(characterName, sectionId, rest);
    if (api.updateAppearanceSection)
      return api.updateAppearanceSection({
        characterName,
        sectionId,
        ...rest,
      });
  }
  if (action === "delete") {
    if (api.deleteCharacterSection)
      return api.deleteCharacterSection(characterName, sectionId);
    if (api.deleteAppearanceSection)
      return api.deleteAppearanceSection({
        characterName,
        sectionId,
      });
  }
  if (action === "setCover") {
    if (api.setCharacterSectionCover)
      return api.setCharacterSectionCover(
        characterName,
        sectionId,
        rest.imagePath,
      );
    if (api.setAppearanceSectionCover)
      return api.setAppearanceSectionCover({
        characterName,
        sectionId,
        imagePath: rest.imagePath,
      });
  }
  if (action === "assign") {
    if (api.assignModAppearanceSection)
      return api.assignModAppearanceSection(characterName, modName, sectionId);
    if (api.assignModToCharacterSection)
      return api.assignModToCharacterSection(characterName, modName, sectionId);
    if (api.setModAppearanceSection)
      return api.setModAppearanceSection({
        characterName,
        modName,
        sectionId,
      });
  }
  throw new Error(t("mods.sections.unavailable"));
}
function getPreviewAspectRatioStyle(ratio) {
  const numericRatio = Number(ratio);
  if (!Number.isFinite(numericRatio) || numericRatio <= 0) return "4 / 3";
  const boundedRatio = Math.min(Math.max(numericRatio, 0.75), 1.85);
  return `${boundedRatio} / 1`;
}
const aiSuggestionCache = new Map();
const previewAspectRatioCache = new Map();
function getModViewStateStorageKey(gameId, characterName) {
  return `modview-state-${gameId || "default"}-${characterName || "unknown"}`;
}
function getModViewPreferenceStorageKey(gameId, characterName) {
  return `modview-prefs-${gameId || "default"}-${characterName || "unknown"}`;
}
function readModViewState(storageKey) {
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw)
      return {
        scrollTop: 0,
        selectedModName: null,
      };
    const parsed = JSON.parse(raw);
    return {
      scrollTop: Number.isFinite(Number(parsed?.scrollTop))
        ? Number(parsed.scrollTop)
        : 0,
      selectedModName: parsed?.selectedModName
        ? String(parsed.selectedModName)
        : null,
    };
  } catch {
    return {
      scrollTop: 0,
      selectedModName: null,
    };
  }
}
function readModViewPreferences(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw)
      return {
        localCollectionsEnabled: false,
        exclusiveMode: true,
      };
    const parsed = JSON.parse(raw);
    return {
      localCollectionsEnabled: parsed?.localCollectionsEnabled === true,
      exclusiveMode: parsed?.exclusiveMode !== false,
    };
  } catch {
    return {
      localCollectionsEnabled: false,
      exclusiveMode: true,
    };
  }
}
function dataTransferIncludesImage(dataTransfer) {
  if (!dataTransfer) return false;
  if (dataTransfer.items && dataTransfer.items.length > 0) {
    return Array.from(dataTransfer.items).some((item) =>
      item.type.startsWith("image/"),
    );
  }
  if (dataTransfer.files && dataTransfer.files.length > 0) {
    return Array.from(dataTransfer.files).some(
      (file) =>
        file.type.startsWith("image/") ||
        /\.(png|jpg|jpeg|webp|gif|bmp)$/i.test(file.name || ""),
    );
  }
  return false;
}
function notifyPakImported(detail = {}) {
  try {
    window.dispatchEvent(
      new CustomEvent("qaqm-pak-imported", {
        detail,
      }),
    );
  } catch {}
}
export {
  getModViewStateStorageKey,
  getModViewPreferenceStorageKey,
  getAppearanceSectionStorageKey,
  readModViewState,
  readModViewPreferences,
  DEFAULT_PREVIEW_ASPECT_RATIO,
  getModAppearanceSectionId,
  getAppearanceImportTargetName,
  previewAspectRatioCache,
  aiSuggestionCache,
  callAppearanceSectionApi,
  ensureAppearanceApiResult,
  getExplicitImportAppearanceSectionId,
  notifyPakImported,
  getPreviewAspectRatioStyle,
  dataTransferIncludesImage,
};
