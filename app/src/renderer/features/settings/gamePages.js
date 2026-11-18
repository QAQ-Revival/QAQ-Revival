import { t } from "../../../shared/i18n/index.mjs";

const XXMI_IMPORTERS = {
  endfield: "EFMI",
  "genshin-impact": "GIMI",
  zzz: "ZZMI",
  "wuthering-waves": "WWMI",
  "honkai-star-rail": "SRMI",
};
const usesXxmi = (gameId) => !!XXMI_IMPORTERS[gameId];
// The Mod loader a game's second module is named after.
function loaderName(gameId) {
  if (usesXxmi(gameId)) return XXMI_IMPORTERS[gameId];
  if (gameId === "neverness-to-everness") return "NEMI";
  if (gameId === "arknights") return "Arknights Loader";
  return t("settings.game.loaderModule");
}

// A game's settings as peer modules: the game itself, its Mod loader and, for Endfield, EFF.
// Page ids are stable; other views and tests open pages by them.
function getGameModules(gameId) {
  const when = (condition, ...pages) => (condition ? pages : []);
  const page = ([id, icon, label]) => ({ id, icon, label });
  return [
    {
      id: "game",
      label: t("settings.game.gameModule"),
      pages: [
        ["game-paths", "folder", t("settings.game.pathAndLaunch")],
        ["game-updates", "refresh", t("settings.game.gameUpdate")],
        ...when(gameId === "endfield", ["endfield-hdr", "monitor", "HDR"]),
        ...when(gameId === "wuthering-waves", ["wuwa-tuning", "monitor", t("settings.game.rendering")]),
        ...when(["endfield", "wuthering-waves"].includes(gameId), ["steam-bridge", "link", t("settings.game.steamBridge")]),
      ].map(page),
    },
    {
      id: "loader",
      label: loaderName(gameId),
      pages: [
        ["loader-overview", "grid", t("settings.game.overview")],
        ...when(usesXxmi(gameId), ["loader-components", "box", t("settings.game.components")]),
        ...when(gameId === "endfield", ["efmi-vulkan", "layers", "Vulkan"]),
        ...when(gameId === "wuthering-waves", ["wuwa-dx12", "layers", "DX12"]),
        ...when(
          gameId === "genshin-impact",
          ["genshin-anticrash", "shield", t("settings.game.antiError")],
          ["genshin-compatibility", "activity", t("settings.game.compatibility")],
        ),
        ...when(gameId === "neverness-to-everness", ["pak", "archive", t("settings.game.pakMode")]),
        ...when(
          gameId === "arknights",
          ["arknights-input", "cursor", t("arknights.settings.input")],
          ["arknights-tools", "wrench", t("arknights.settings.title")],
        ),
      ].map(page),
    },
    ...when(gameId === "endfield", {
      id: "eff",
      label: "EFF",
      pages: [
        ["eff", "grid", t("settings.game.overview")],
        ["eff-components", "box", t("settings.game.components")],
      ].map(page),
    }),
  ];
}

// The pages of one game's settings, in navigation order.
const getGamePages = (gameId) => getGameModules(gameId).flatMap((module) => module.pages);

export { getGameModules, getGamePages, loaderName, usesXxmi };
