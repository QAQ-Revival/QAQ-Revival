"use strict";

const i18n = require("../../shared/i18n/core.cjs");
const WUWA_FIX_GAME_ID = "wuthering-waves";
const BUILTIN_GAMES = [{
  id: "arknights",
  name: "明日方舟",
  shortName: "明日方舟",
  description: i18n.t("arknights.description"),
  imageFile: "arknights.png",
  defaultLaunchMode: "ARKNIGHTS",
  supportedLaunchModes: ["ARKNIGHTS"],
  modLoaderLabel: "QAQR Arknights Loader",
  executableHint: "Arknights.exe",
  marketGameId: "arknights"
}, {
  id: "genshin-impact",
  name: "原神",
  shortName: "原神",
  description: i18n.t("backend.games.definitions.genshinDescription"),
  imageFile: "原神.png",
  defaultLaunchMode: "GIMI",
  supportedLaunchModes: ["GIMI", "XXMI"],
  modLoaderLabel: i18n.t("backend.games.definitions.gimiLoader"),
  executableHint: "YuanShen.exe / GenshinImpact.exe",
  marketGameId: "genshin-impact"
}, {
  id: "endfield",
  name: "明日方舟终末地",
  shortName: "终末地",
  description: i18n.t("backend.games.definitions.endfieldDescription"),
  imageFile: "明日方舟终末地.png",
  defaultLaunchMode: "EFMI",
  supportedLaunchModes: ["EFMI", "XXMI"],
  modLoaderLabel: i18n.t("backend.games.definitions.efmiLoader"),
  executableHint: "Endfield.exe",
  marketGameId: "endfield"
}, {
  id: "zzz",
  name: "绝区零",
  shortName: "绝区零",
  description: i18n.t("backend.games.definitions.zzzDescription"),
  imageFile: "绝区零.png",
  defaultLaunchMode: "ZZMI",
  supportedLaunchModes: ["ZZMI", "XXMI"],
  modLoaderLabel: i18n.t("backend.games.definitions.zzmiLoader"),
  executableHint: "ZenlessZoneZero.exe",
  marketGameId: "zzz"
}, {
  id: "wuthering-waves",
  name: "鸣潮",
  shortName: "鸣潮",
  description: i18n.t("backend.games.definitions.wuwaDescription"),
  imageFile: "鸣潮.png",
  defaultLaunchMode: "WWMI",
  supportedLaunchModes: ["WWMI", "XXMI"],
  modLoaderLabel: i18n.t("backend.games.definitions.wwmiLoader"),
  executableHint: "Wuthering Waves.exe",
  marketGameId: "wuthering-waves"
}, {
  id: "neverness-to-everness",
  name: "异环",
  shortName: "异环",
  description: i18n.t("backend.games.definitions.nevernessDescription"),
  imageFile: "异环.webp",
  defaultLaunchMode: "NEMI",
  supportedLaunchModes: ["NEMI", "DX12"],
  modLoaderLabel: i18n.t("backend.games.definitions.nemiLoader"),
  executableHint: "NTELauncher.exe",
  defaultLaunchArgs: "-dx11",
  marketGameId: "neverness-to-everness"
}, {
  id: "honkai-star-rail",
  name: "崩坏：星穹铁道",
  shortName: "星穹铁道",
  description: i18n.t("backend.games.definitions.starRailDescription"),
  imageFile: "崩坏星穹铁道.png",
  defaultLaunchMode: "SRMI",
  supportedLaunchModes: ["SRMI", "XXMI"],
  modLoaderLabel: i18n.t("backend.games.definitions.srmiLoader"),
  executableHint: "StarRail.exe",
  marketGameId: "honkai-star-rail"
}];
const BUILTIN_GAME_MAP = new Map(BUILTIN_GAMES.map(game => [game.id, game]));
module.exports = {
  WUWA_FIX_GAME_ID,
  BUILTIN_GAMES,
  BUILTIN_GAME_MAP
};
