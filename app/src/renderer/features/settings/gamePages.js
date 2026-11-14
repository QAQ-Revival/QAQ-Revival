import { t } from "../../../shared/i18n/index.mjs";

const XXMI_GAMES = [
  "endfield",
  "genshin-impact",
  "zzz",
  "wuthering-waves",
  "honkai-star-rail",
];
const usesXxmi = (gameId) => XXMI_GAMES.includes(gameId);

// The pages of one game's settings, in navigation order.
function getGamePages(gameId) {
  const when = (condition, ...pages) => (condition ? pages : []);
  return [
    ["game-paths", "folder", t("settings.game.pathAndLaunch")],
    usesXxmi(gameId)
      ? ["game-updates", "box", t("settings.game.versions")]
      : ["game-updates", "refresh", t("settings.game.gameUpdate")],
    ...when(gameId === "endfield", ["efmi-vulkan", "layers", "Vulkan Mod"]),
    ...when(
      gameId === "wuthering-waves",
      ["wuwa-dx12", "layers", "DX12 Mod"],
      ["wuwa-tuning", "monitor", t("settings.game.rendering")],
    ),
    ...when(
      gameId === "genshin-impact",
      ["genshin-anticrash", "shield", t("settings.game.antiError")],
      ["genshin-compatibility", "activity", t("settings.game.compatibility")],
    ),
    ...when(
      ["endfield", "wuthering-waves"].includes(gameId),
      ["steam-bridge", "link", t("settings.game.steamBridge")],
    ),
    ...when(gameId === "neverness-to-everness", [
      "pak",
      "archive",
      t("settings.game.pakMode"),
    ]),
    ...when(
      gameId === "arknights",
      ["arknights-input", "cursor", t("arknights.settings.input")],
      ["arknights-tools", "wrench", t("arknights.settings.title")],
    ),
  ].map(([id, icon, label]) => ({ id, icon, label }));
}

export { getGamePages, usesXxmi };
