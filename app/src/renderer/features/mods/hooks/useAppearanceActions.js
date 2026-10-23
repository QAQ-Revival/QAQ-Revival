import { t } from "../../../../shared/i18n/index.mjs";
import {
  getModAppearanceSectionId,
  callAppearanceSectionApi,
  ensureAppearanceApiResult,
} from "../model/modHelpers.js";
import {
  BASE_SECTION_ID,
  getSectionId,
  getSectionName,
} from "../model/appearanceSections.js";
export function useAppearanceActions({
  activeAppearanceSectionIdRef,
  setActiveAppearanceSectionId,
  appearanceSectionStorageKey,
  setAppearanceSectionBusy,
  characterName,
  loadMods,
  setToast,
  selectedMod,
  appearanceSectionsWithStats,
  pendingFocusRef,
  modsLoadVersion,
}) {
  function selectAppearanceSection(sectionId) {
    const nextSectionId = String(sectionId || BASE_SECTION_ID);
    activeAppearanceSectionIdRef.current = nextSectionId;
    setActiveAppearanceSectionId(nextSectionId);
    try {
      localStorage.setItem(appearanceSectionStorageKey, nextSectionId);
    } catch {}
  }
  async function handleSaveCustomAppearanceSection({
    section,
    name,
    nameEn,
    coverImagePath,
  }) {
    setAppearanceSectionBusy(true);
    try {
      let result;
      if (section) {
        result = ensureAppearanceApiResult(
          await callAppearanceSectionApi("update", {
            characterName,
            sectionId: getSectionId(section),
            name,
            nameEn,
          }),
          t("mods.sections.updateFailed"),
        );
        if (coverImagePath) {
          ensureAppearanceApiResult(
            await callAppearanceSectionApi("setCover", {
              characterName,
              sectionId: getSectionId(section),
              imagePath: coverImagePath,
            }),
            t("mods.sections.saveCoverFailed"),
          );
        }
      } else {
        result = ensureAppearanceApiResult(
          await callAppearanceSectionApi("create", {
            characterName,
            name,
            nameEn,
            coverImagePath,
          }),
          t("mods.sections.createFailed"),
        );
      }
      const savedSection = result?.section || result;
      const savedSectionId =
        savedSection?.sectionId ||
        savedSection?.id ||
        (section ? getSectionId(section) : "");
      if (savedSectionId) selectAppearanceSection(savedSectionId);
      await loadMods({
        refreshConflicts: false,
      });
      setToast({
        type: "success",
        message: section
          ? t("mods.sections.updated", {
              name,
            })
          : t("mods.sections.created", {
              name,
            }),
      });
      return result;
    } catch (error) {
      setToast({
        type: "error",
        message: error?.message || String(error),
      });
      throw error;
    } finally {
      setAppearanceSectionBusy(false);
    }
  }
  async function handleDeleteCustomAppearanceSection(section) {
    const sectionId = getSectionId(section);
    setAppearanceSectionBusy(true);
    try {
      const result = ensureAppearanceApiResult(
        await callAppearanceSectionApi("delete", {
          characterName,
          sectionId,
        }),
        t("mods.sections.deleteFailed"),
      );
      if (activeAppearanceSectionIdRef.current === sectionId)
        selectAppearanceSection(BASE_SECTION_ID);
      await loadMods({
        syncCharacterCache: true,
        conflictDelay: 900,
      });
      setToast({
        type: "success",
        message:
          Number(result?.reassignedCount || 0) > 0
            ? t("mods.sections.deletedAndReassigned", {
                reassignedCount: result.reassignedCount,
              })
            : t("mods.sections.deleted"),
      });
      return result;
    } catch (error) {
      setToast({
        type: "error",
        message: error?.message || String(error),
      });
      throw error;
    } finally {
      setAppearanceSectionBusy(false);
    }
  }
  async function handleAssignSelectedModAppearanceSection(sectionId) {
    if (!selectedMod || getModAppearanceSectionId(selectedMod) === sectionId)
      return;
    const targetSection = appearanceSectionsWithStats.find(
      (section) => getSectionId(section) === sectionId,
    );
    setAppearanceSectionBusy(true);
    try {
      ensureAppearanceApiResult(
        await callAppearanceSectionApi("assign", {
          characterName,
          modName: selectedMod.name,
          sectionId,
        }),
        t("mods.sections.moveModFailed"),
      );
      const movedModName = selectedMod.name;
      pendingFocusRef.current = {
        characterName,
        modName: movedModName,
        targetLoadVersion: modsLoadVersion + 1,
      };
      selectAppearanceSection(sectionId);
      await loadMods({
        syncCharacterCache: true,
        conflictDelay: 900,
      });
      setToast({
        type: "success",
        message: t("mods.sections.modMoved", {
          movedModName,
          sectionName: getSectionName(targetSection),
        }),
      });
    } catch (error) {
      setToast({
        type: "error",
        message: error?.message || String(error),
      });
    } finally {
      setAppearanceSectionBusy(false);
    }
  }
  return {
    selectAppearanceSection,
    handleSaveCustomAppearanceSection,
    handleDeleteCustomAppearanceSection,
    handleAssignSelectedModAppearanceSection,
  };
}
