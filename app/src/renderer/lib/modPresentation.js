import { t } from "../../shared/i18n/index.mjs";

export function getModTypeLabels(mod) {
  if (!mod.arknightsScope) return [];
  const labels = [];
  if (mod.appearanceSectionId === "base") labels.push(t("mods.types.base"));
  else if (mod.appearanceSectionId?.startsWith("skin:")) labels.push(t("mods.types.skin"));
  const translated = { static: t("mods.types.static"), dynamic: t("mods.types.dynamic"), voice: t("mods.types.voice") };
  for (const type of mod.arknightsScope.contentTypes || []) if (translated[type]) labels.push(translated[type]);
  return labels;
}

export function collectModTags(mods) {
  const tags = new Map();
  for (const mod of mods) for (const value of mod.tags || []) {
    const name = String(value).trim();
    if (name) tags.set(name.toLowerCase(), name);
  }
  return [...tags].sort((a, b) => a[1].localeCompare(b[1], "zh-CN"));
}
