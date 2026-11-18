import { t } from "../../shared/i18n/index.mjs";

export function getModTypeLabels(mod) {
  if (mod.framework === "eff") return ["EFF"];
  if (!mod.arknightsScope) return [];
  const translated = {
    static: t("mods.types.static"),
    baseIllustration: t("mods.types.baseIllustration"),
    skinIllustration: t("mods.types.skinIllustration"),
    illustration: t("mods.types.illustration"),
    dynamic: t("mods.types.dynamicIllustration"),
    baseChibi: t("mods.types.baseChibi"),
    skinChibi: t("mods.types.skinChibi"),
    chibi: t("mods.types.chibi"),
    storyPortrait: t("mods.types.storyPortrait"),
    avatar: t("mods.types.avatar"),
    portrait: t("mods.types.portrait"),
    cg: t("mods.types.cg"),
    background: t("mods.types.background"),
    voice: t("mods.types.voice"),
    music: t("mods.types.music"),
    sound: t("mods.types.sound"),
    effect: t("mods.types.effect"),
    enemy: t("mods.types.enemy"),
    summon: t("mods.types.summon"),
    battleObject: t("mods.types.battleObject"),
    namecard: t("mods.types.namecard"),
    ui: t("mods.types.ui"),
    map: t("mods.types.map"),
    video: t("mods.types.video"),
    other: t("mods.types.other"),
  };
  return [...new Set((mod.arknightsScope.contentTypes || []).map(type => translated[type]).filter(Boolean))];
}

export function collectModTags(mods) {
  const tags = new Map();
  for (const mod of mods) for (const value of mod.tags || []) {
    const name = String(value).trim();
    if (name) tags.set(name.toLowerCase(), name);
  }
  return [...tags].sort((a, b) => a[1].localeCompare(b[1], "zh-CN"));
}
