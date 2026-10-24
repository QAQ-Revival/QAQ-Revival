"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const electron = require("electron");
const i18n = require("../../shared/i18n/core.cjs");
const config = require("../config/store.cjs");
const settings = require("../games/settings.cjs");
const { getDataRoot, IMPORTERS } = require("../runtime/data-paths.cjs");
const installPaths = require("./paths.cjs");
const { isPathInsideDirectory } = require("../system/paths.cjs");
const cache = new Map();
let operation = null;
function plain(file) {
  for (let current = file; current !== path.dirname(current); current = path.dirname(current)) {
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw Error(i18n.t("settings.mi.invalidComponent"));
  }
}
function component() {
  const roots = [path.dirname(process.execPath), path.resolve(electron.app.getAppPath(), "../.."), path.resolve(electron.app.getAppPath(), "..")];
  const root = roots.map(root => path.join(root, "local-components/xxmi-installer")).find(root => fs.existsSync(path.join(root, "component.json")));
  if (!root) throw Error(i18n.t("settings.mi.componentMissing"));
  plain(root);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "component.json"), "utf8"));
  if (manifest.protocol !== 1 || manifest.source !== "https://github.com/SpectrumQT/XXMI-Launcher" || !manifest.files) throw Error(i18n.t("settings.mi.invalidComponent"));
  for (const [relative, hash] of Object.entries(manifest.files)) {
    const file = path.resolve(root, relative);
    if (!isPathInsideDirectory(file, root) || file === root) throw Error(i18n.t("settings.mi.invalidComponent"));
    plain(file);
    if (crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex") !== hash) throw Error(i18n.t("settings.mi.invalidComponent"));
  }
  return { executable: path.join(root, "XxmiInstaller/XxmiInstaller.exe"), sourceCommit: manifest.sourceCommit };
}
function paths(gameId) {
  const importer = IMPORTERS[gameId];
  const game = settings.getGameById(gameId);
  if (!importer || !game) throw Error(i18n.t("settings.mi.unsupported"));
  const root = installPaths.deriveXxmiRootFromLoaderPath(game.modLoaderPath) || config.currentConfig.managedXxmiRoot || path.join(getDataRoot(), "XXMI");
  return { root, workRoot: path.join(root, ".installer-work") };
}
function runWorker(payload, onProgress = () => {}) {
  const built = component();
  return new Promise((resolve, reject) => {
    const child = spawn(built.executable, [], { cwd: path.dirname(built.executable), windowsHide: true, shell: false, stdio: ["pipe", "pipe", "pipe"] });
    let buffer = "", size = 0, result = null, finished = false;
    const timeout = setTimeout(() => fail(Error(i18n.t("settings.mi.timeout"))), payload.action === "install" ? 30 * 60 * 1000 : 120000);
    function fail(error) {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      child.kill();
      reject(error);
    }
    child.on("error", fail);
    child.stdin.on("error", fail);
    child.stderr.on("data", () => {});
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", chunk => {
      size += Buffer.byteLength(chunk);
      if (size > 16 * 1024 * 1024) return fail(Error(i18n.t("settings.mi.invalidComponent")));
      buffer += chunk;
      let index;
      while ((index = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, index).trim();
        buffer = buffer.slice(index + 1);
        if (!line) continue;
        try {
          const message = JSON.parse(line);
          if (message.type === "progress") onProgress(message);
          if (message.type === "result") result = message;
        } catch { return fail(Error(i18n.t("settings.mi.invalidComponent"))); }
      }
    });
    child.on("close", code => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      if (result?.code === "RECOVERY_REQUIRED") reject(Error(i18n.t("settings.mi.recoveryRequired", { path: result.recoveryPath })));
      else if (code || !result?.success) reject(Error(result?.error || i18n.t("settings.mi.failed")));
      else resolve({ ...result, sourceCommit: built.sourceCommit });
    });
    child.stdin.end(JSON.stringify(payload));
  });
}
async function status(gameId, action = "status") {
  const resolved = paths(gameId);
  if (operation) return { success: true, ...resolved, ...cache.get(gameId), busy: true };
  const result = await runWorker({ ...resolved, action });
  cache.set(gameId, result);
  return { ...result, ...resolved, busy: false };
}
async function install({ gameId } = {}) {
  if (operation) throw Error(i18n.t("settings.mi.busy"));
  const resolved = paths(gameId);
  operation = { gameId };
  try {
    const result = await runWorker({ ...resolved, action: "install" }, progress => {
      for (const window of electron.BrowserWindow.getAllWindows()) if (!window.isDestroyed()) window.webContents.send("xxmi:progress", { ...progress, gameId });
    });
    const next = structuredClone(config.currentConfig);
    const game = next.games.find(game => game.id === gameId);
    game.modLoaderPath = path.join(resolved.root, "Resources/Bin/XXMI Launcher.exe");
    next.managedXxmiRoot = resolved.root;
    if (!config.saveConfig(next)) throw Error(i18n.t("settings.mi.saveFailed"));
    config.currentConfig = next;
    settings.notifyGamesChanged();
    cache.delete(gameId);
    return result;
  } finally {
    operation = null;
    cache.clear();
    for (const window of electron.BrowserWindow.getAllWindows()) if (!window.isDestroyed()) window.webContents.send("xxmi:changed", { gameId, root: resolved.root });
  }
}
function registerIpc() {
  for (const [channel, action] of [["xxmi:status", gameId => status(gameId)], ["xxmi:check", gameId => status(gameId, "check")], ["xxmi:install", install]]) {
    electron.ipcMain.handle(channel, async (_, payload) => {
      try { return await action(payload); }
      catch (error) { return { success: false, error: error.message }; }
    });
  }
}
module.exports = { registerIpc, paths, runWorker, status, install };
