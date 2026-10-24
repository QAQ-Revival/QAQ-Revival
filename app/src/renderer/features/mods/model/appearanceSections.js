import { t } from "../../../../shared/i18n/index.mjs";
const BASE_SECTION_ID = "base";
function getSectionId(section) {
  return String(section?.sectionId || section?.id || BASE_SECTION_ID);
}
function isBaseSection(section) {
  return getSectionId(section) === BASE_SECTION_ID || section?.kind === "base";
}
function isCustomSection(section) {
  return (
    section?.kind === "custom" || getSectionId(section).startsWith("custom:")
  );
}
function getSectionName(section) {
  if (isBaseSection(section))
    return (
      section?.nameZh || section?.name || t("mods.sections.originalCharacter")
    );
  return (
    section?.nameZh ||
    section?.name ||
    section?.title ||
    t("mods.sections.unnamed")
  );
}
function getSectionSubtitle(section) {
  if (isBaseSection(section)) return section?.nameEn || "Default";
  if (section?.kind === "shared") return t("arknights.sharedSubtitle");
  return (
    section?.nameEn ||
    (isCustomSection(section) ? t("mods.sections.custom") : "Official Outfit")
  );
}
export {
  isBaseSection,
  isCustomSection,
  getSectionName,
  getSectionId,
  BASE_SECTION_ID,
  getSectionSubtitle,
};
