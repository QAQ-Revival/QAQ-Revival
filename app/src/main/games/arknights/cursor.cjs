"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFile } = require("node:child_process");
const files = require("./files.cjs");
const i18n = require("../../../shared/i18n/core.cjs");
const SOURCE = "https://github.com/assfafa/arknights-system-cursor";

function resolveCursorCli() {
  const { app } = require("electron");
  const candidates = [path.dirname(process.execPath), path.resolve(app.getAppPath(), "../.."), path.resolve(app.getAppPath(), "..")].map(root => path.join(root, "local-components/arknights-cursor"));
  const root = candidates.find(directory => fs.existsSync(path.join(directory, "component.json")));
  if (!root) throw Error(i18n.t("arknights.cursor.componentMissing"));
  files.assertNoLinks(root);
  const component = JSON.parse(fs.readFileSync(path.join(root, "component.json"), "utf8"));
  const name = "ArknightsSystemCursor.Cli.exe";
  const executable = path.join(root, name);
  if (component.protocol !== 1 || component.source !== SOURCE || !component.files?.[name] || !fs.existsSync(executable)) throw Error(i18n.t("arknights.cursor.componentInvalid"));
  for (const relative of [name, name + ".config"]) {
    const file = path.join(root, relative);
    files.assertNoLinks(file);
    if (!component.files[relative] || !fs.existsSync(file) || crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex") !== component.files[relative]) throw Error(i18n.t("arknights.cursor.componentInvalid"));
  }
  return executable;
}

function createCursorService({ getGamePath, getStateRoot, resolveExecutable = resolveCursorCli, execute = execFile }) {
  const pendingReads = new Map();
  function target() {
    const configuredPath = String(getGamePath() || "").trim();
    if (!path.isAbsolute(configuredPath)) throw Error(i18n.t("arknights.errors.gameMissing"));
    const gamePath = path.resolve(configuredPath);
    if (!/^Arknights\.exe$/i.test(path.basename(gamePath)) || !fs.existsSync(gamePath)) throw Error(i18n.t("arknights.errors.gameMissing"));
    files.assertNoLinks(gamePath);
    const gameDirectory = path.dirname(gamePath);
    const stateRoot = path.resolve(getStateRoot());
    files.assertOutsideGame(stateRoot, gamePath);
    return { gamePath, gameDirectory, stateRoot };
  }
  function command(action, selected) {
    const executable = resolveExecutable();
    return new Promise((resolve, reject) => {
      execute(executable, [action, "--game-dir", selected.gameDirectory, "--state-dir", selected.stateRoot, "--json"], { windowsHide: true, encoding: "utf8", timeout: 120000, maxBuffer: 1024 * 1024, cwd: path.dirname(executable) }, (error, stdout) => {
        try {
          const result = JSON.parse(String(stdout || "").replace(/^\uFEFF/, ""));
          if (error || !result.Success) throw Error(result.Error || i18n.t("arknights.cursor.operationFailed"));
          resolve(result);
        } catch (parseError) { reject(parseError instanceof SyntaxError ? Error(i18n.t("arknights.cursor.operationFailed")) : parseError); }
      });
    });
  }
  function normalize(status, selected) {
    if (!status || !["game", "system", "missing", "unsupported"].includes(status.Mode) || typeof status.GameRunning !== "boolean" || typeof status.GameDirectory !== "string" || path.resolve(status.GameDirectory).toLowerCase() !== selected.gameDirectory.toLowerCase()) throw Error(i18n.t("arknights.cursor.componentInvalid"));
    return { success: true, gamePath: selected.gamePath, mode: status.Mode, enabled: status.Mode === "system" || status.Mode === "missing", supported: status.Mode !== "unsupported", gameRunning: status.GameRunning, resourceCount: status.Resources?.length || 0, backupDirectory: status.StateDirectory || "" };
  }
  async function inspect(selected) {
    const key = selected.gamePath.toLowerCase() + "\n" + selected.stateRoot.toLowerCase();
    if (pendingReads.has(key)) return pendingReads.get(key);
    const read = command("status", selected).then(result => normalize(result.Status, selected)).finally(() => pendingReads.delete(key));
    pendingReads.set(key, read);
    return read;
  }
  async function status() {
    return inspect(target());
  }
  async function setEnabled({ enabled, gamePath } = {}) {
    if (typeof enabled !== "boolean") throw Error(i18n.t("arknights.errors.invalidPath"));
    const selected = target();
    if (typeof gamePath !== "string" || path.resolve(gamePath).toLowerCase() !== selected.gamePath.toLowerCase()) throw Error(i18n.t("arknights.errors.changed"));
    const before = await inspect(selected);
    if (before.gameRunning) throw Error(i18n.t("arknights.cursor.gameRunning"));
    if (!before.supported) throw Error(i18n.t("arknights.cursor.unsupported"));
    const result = await command(enabled ? "enable" : "restore", selected);
    return { ...normalize(result.Status, selected), changedFiles: result.ChangedFiles || 0 };
  }
  return { status, setEnabled };
}

module.exports = { createCursorService, resolveCursorCli };
