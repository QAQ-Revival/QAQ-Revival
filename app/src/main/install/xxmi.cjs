"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const electron = require("electron");
const i18n = require("../../shared/i18n/core.cjs");
const config = require("../config/store.cjs");
const settings = require("../games/settings.cjs");
const { getDataRoot, getLoaderDataRoot, IMPORTERS } = require("../runtime/data-paths.cjs");
const installPaths = require("./paths.cjs");
const { isPathInsideDirectory } = require("../system/paths.cjs");
const { createMiForksService } = require("./mi-forks.cjs");
const { createComponentPackages } = require("./component-packages.cjs");
const componentRoots = () => [path.dirname(process.execPath), path.resolve(electron.app.getAppPath(), "../.."), path.resolve(electron.app.getAppPath(), "..")];
function resolveInstallation(gameId) {
  const game = settings.getGameById(gameId);
  const launcher = game && (game.modLoaderPath || path.join(paths(gameId).root, "Resources/Bin/XXMI Launcher.exe"));
  const info = launcher && settings.readXxmiImporterPathInfo(launcher, gameId);
  return info?.status === "configured" ? { launcherRoot: info.xxmiRootDir, miRoot: info.importerPath } : null;
}
// Each fork releases every build of its component; a newer one than the bundled copy is kept under data.
const componentPackages = createComponentPackages({ roots: componentRoots, storeRoot: () => getLoaderDataRoot("Components"), fetch: (...args) => electron.net.fetch(...args) });
const runtimeUpdates = componentPackages("xxmi-runtime"), coreUpdates = componentPackages("efmi-core");
// The lines under Settings that a fork release can move, by the id the fork service gives them.
const forkUpdates = { runtime: runtimeUpdates, core: coreUpdates };
const maintained = createMiForksService({ bundleRoots: componentRoots, resolveInstallation, runtimeBundle: () => runtimeUpdates.active(), coreBundle: () => coreUpdates.active() });
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
  if (manifest.protocol !== 1 || !["https://github.com/SpectrumQT/XXMI-Launcher", "https://github.com/QAQ-Revival/XXMI-Launcher"].includes(manifest.source) || !manifest.files) throw Error(i18n.t("settings.mi.invalidComponent"));
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
  return { root, workRoot: path.join(root, ".installer-work"), importer };
}
function runWorker(payload, onProgress = () => {}) {
  const built = component();
  return new Promise((resolve, reject) => {
    const child = spawn(built.executable, [], { cwd: path.dirname(built.executable), windowsHide: true, shell: false, stdio: ["pipe", "pipe", "pipe"] });
    let buffer = "", size = 0, result = null, finished = false;
    const timeout = setTimeout(() => fail(Error(i18n.t("settings.mi.timeout"))), ["install", "update-component"].includes(payload.action) ? 30 * 60 * 1000 : 120000);
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
      else if (result?.code === "PROCESS_RUNNING") reject(Error(i18n.t("settings.mi.closeForUpdate")));
      else if (code || !result?.success) reject(Error(result?.error || i18n.t("settings.mi.failed")));
      else resolve({ ...result, sourceCommit: built.sourceCommit });
    });
    child.stdin.end(JSON.stringify(payload));
  });
}
async function status(gameId, action = "status") {
  const resolved = paths(gameId);
  if (operation) return { success: true, ...resolved, ...cache.get(gameId), busy: true };
  // In DX12 mode the game loads the ReShade add-on, so this DLL only applies once it is back on DX11.
  const fork = { ...maintained.status(gameId), runtimeInactive: settings.getGameById(gameId)?.wuwaDx12Enabled === true };
  const released = (fork.components || []).filter(item => forkUpdates[item.id] && item.switchable !== false);
  // The forks' releases are asked along with the official versions; offline, what is on disk goes on being used.
  const [worked] = await Promise.all([runWorker({ ...resolved, action }), ...(action === "check" ? released.map(item => forkUpdates[item.id].check()) : [])]);
  for (const item of released) item.forkUpdates = forkUpdates[item.id].state(item.fork?.version);
  const result = { ...worked, fork };
  if (action === "status") {
    // After a restart nothing has been checked in this run yet, so fall back to what the last saved check found.
    const previous = cache.get(gameId)?.components || require("../games/updates.cjs").checkedComponents(gameId);
    for (const component of result.components || []) {
      const checked = previous.find(item => item.id === component.id);
      if (checked?.latest) {
        component.latest = checked.latest;
        component.updateAvailable = !!component.installed && require("../games/update-versions.cjs").compareVersions(component.latest, component.installed) > 0;
        component.error = checked.error;
      }
    }
  }
  for (const component of fork.components || []) {
    const checked = result.components?.find(item => item.id === (component.id === "runtime" ? "XXMI" : resolved.importer));
    if (checked) component.updates = checked;
  }
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
    result.preferredForks = maintained.preferForks(gameId, { runtimeEnabled: game.wuwaDx12Enabled !== true });
    settings.notifyGamesChanged();
    cache.delete(gameId);
    return result;
  } finally {
    operation = null;
    cache.clear();
    require("../games/updates.cjs").invalidate(gameId);
    for (const window of electron.BrowserWindow.getAllWindows()) if (!window.isDestroyed()) window.webContents.send("xxmi:changed", { gameId, root: resolved.root });
  }
}
async function changeFork({ gameId, component, target, confirmed } = {}) {
  if (operation) throw Error(i18n.t("settings.mi.busy"));
  operation = { gameId };
  try { return maintained.change(gameId, component, target, { confirmed: confirmed === true }); }
  finally {
    operation = null;
    cache.clear();
    require("../games/updates.cjs").invalidate(gameId);
    for (const window of electron.BrowserWindow.getAllWindows()) if (!window.isDestroyed()) window.webContents.send("xxmi:changed", { gameId });
  }
}
// Takes the fix the fork released last. A fix that is in use is replaced with it; the official runtime is left in place.
async function updateFork({ gameId, component } = {}) {
  if (operation) throw Error(i18n.t("settings.mi.busy"));
  const state = maintained.status(gameId);
  const entry = state.components?.find(item => item.id === component);
  if (!state.ready || !forkUpdates[component] || !entry || entry.switchable === false) throw Error(state.error || i18n.t("settings.mi.unsupported"));
  operation = { gameId };
  const changed = () => {
    for (const window of electron.BrowserWindow.getAllWindows()) if (!window.isDestroyed()) window.webContents.send("xxmi:changed", { gameId });
  };
  changed();
  try {
    const installed = await forkUpdates[component].update(entry.fork?.version);
    let applied = false, pending = null;
    if (["fork", "outdated"].includes(entry.local.kind)) {
      try { applied = maintained.change(gameId, component, "fork").success === true; }
      catch (failure) { pending = failure.message; }
    }
    return { success: true, ...installed, applied, pending };
  } finally {
    operation = null;
    cache.clear();
    require("../games/updates.cjs").invalidate(gameId);
    changed();
  }
}
async function updateOfficial({ gameId, component } = {}) {
  if (operation) throw Error(i18n.t("settings.mi.busy"));
  const state = maintained.status(gameId);
  const entry = state.components?.find(item => item.id === component);
  if (!state.ready || !entry?.canUpdateOfficial) throw Error(state.error || i18n.t("settings.mi.unsupported"));
  const installation = resolveInstallation(gameId);
  operation = { gameId };
  const changed = () => {
    for (const window of electron.BrowserWindow.getAllWindows()) if (!window.isDestroyed()) window.webContents.send("xxmi:changed", { gameId });
  };
  changed();
  try {
    return await runWorker({ action: "update-component", root: installation.launcherRoot, miRoot: installation.miRoot,
      importer: state.importer, component, deployRuntime: component === "runtime" && entry.local.kind === "official" }, progress => {
      for (const window of electron.BrowserWindow.getAllWindows()) if (!window.isDestroyed()) window.webContents.send("xxmi:progress", { ...progress, gameId });
    });
  } finally {
    operation = null;
    cache.clear();
    require("../games/updates.cjs").invalidate(gameId);
    changed();
  }
}
function registerIpc() {
  for (const [channel, action] of [["xxmi:status", gameId => status(gameId)], ["xxmi:check", gameId => status(gameId, "check")], ["xxmi:install", install], ["xxmi:fork-switch", changeFork], ["xxmi:fork-update", updateFork], ["xxmi:update-official", updateOfficial]]) {
    electron.ipcMain.handle(channel, async (_, payload) => {
      try { return await action(payload); }
      catch (error) { return { success: false, error: error.message }; }
    });
  }
}
module.exports = { registerIpc, paths, runWorker, status, install, changeFork, updateFork, updateOfficial, resolveInstallation, componentRoots, componentPackages, miForks: maintained, runtimeUpdates, isBusy: () => !!operation };
