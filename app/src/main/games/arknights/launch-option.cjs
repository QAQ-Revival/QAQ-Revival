"use strict";

const fs = require("node:fs");
const path = require("node:path");
const files = require("./files.cjs");
const i18n = require("../../../shared/i18n/core.cjs");

// Switches the loader applies when QAQR starts the game. Each one is stored
// on the Arknights game entry and only needs the matching loader capability.
const OPTIONS = {
  window: { field: "arknightsResizableWindow", capability: "aspect-window-resize-v1", argument: "--resizable-window" },
  mouse: { field: "arknightsCoalesceMouse", capability: "raw-mouse-coalesce-v1", argument: "--coalesce-mouse" }
};

function createLaunchOption(name, { getGame, saveEnabled, component }) {
  const option = OPTIONS[name];
  if (!option) throw Error("Unknown Arknights launch option: " + name);
  function target() {
    const game = getGame();
    const gamePath = String(game?.gamePath || "").trim();
    if (!path.isAbsolute(gamePath) || !/^Arknights\.exe$/i.test(path.basename(gamePath)) || !fs.existsSync(gamePath)) throw Error(i18n.t("arknights.errors.gameMissing"));
    files.assertNoLinks(gamePath);
    return { gamePath: path.resolve(gamePath), enabled: game[option.field] === true };
  }
  function supported() {
    return component.packageInfo().manifest.capabilities?.includes(option.capability) === true;
  }
  async function status() {
    const selected = target();
    const available = supported();
    const result = await component.runNative(["--status"]);
    if (typeof result.running !== "boolean") throw Error(i18n.t("arknights.errors.componentInvalid"));
    return { success: true, ...selected, supported: available, gameRunning: result.running };
  }
  async function setEnabled({ enabled, gamePath } = {}) {
    if (typeof enabled !== "boolean") throw Error(i18n.t("arknights.errors.invalidPath"));
    const before = await status();
    const current = target();
    if (typeof gamePath !== "string" || !path.isAbsolute(gamePath) || path.resolve(gamePath).toLowerCase() !== before.gamePath.toLowerCase() || current.gamePath.toLowerCase() !== before.gamePath.toLowerCase()) throw Error(i18n.t("arknights.errors.changed"));
    if (before.gameRunning) throw Error(i18n.t(`arknights.${name}.gameRunning`));
    if (enabled && !before.supported) throw Error(i18n.t(`arknights.${name}.unsupported`));
    saveEnabled(enabled);
    return { ...before, enabled };
  }
  function launchArguments() {
    if (getGame()?.[option.field] !== true) return [];
    if (!supported()) throw Error(i18n.t(`arknights.${name}.unsupported`));
    return [option.argument];
  }
  return { status, setEnabled, launchArguments };
}

module.exports = { OPTIONS, createLaunchOption };
