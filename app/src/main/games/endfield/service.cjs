"use strict";

const i18n = require("../../../shared/i18n/core.cjs");
const electron = require("electron");
const path = require("path");
const childProcess = require("child_process");
const { createEfmiVulkanPackages } = require("./vulkan-packages.cjs");
const { createEfmiVulkanService, assertEndfieldStopped } = require("./vulkan.cjs");
const { readPresentMethod } = require("./present-method.cjs");
const { createEffPackages } = require("./eff-packages.cjs");
const { createEffService } = require("./eff.cjs");
const { VULKAN_MARK } = require("../../install/mi-forks.cjs");
const archivesExtract = require("../../archives/extract.cjs");
const systemFiles = require("../../system/files.cjs");
const fs = require("fs");
const gamesSettings = require("../settings.cjs");
const installXxmi = require("../../install/xxmi.cjs");
const runtimePaths = require("../../runtime/paths.cjs");
let efmiVulkanService, effService;
function runPowerShell(script) {
  const powershell = path.join(process.env.SystemRoot || "C:\\Windows", "System32/WindowsPowerShell/v1.0/powershell.exe");
  return new Promise((resolve, reject) => childProcess.execFile(powershell, ["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")], {
    windowsHide: true,
    timeout: 8000
  }, (error, stdout) => error ? reject(new Error(i18n.t("backend.efmiVulkan.processStateUnknown"))) : resolve(String(stdout))));
}
function initialize() {
  const installRoot = electron.app.isPackaged ? path.dirname(process.execPath) : path.resolve(runtimePaths.mainDir, "../../..");
  const notify = () => {
    for (const window of electron.BrowserWindow.getAllWindows()) if (!window.isDestroyed()) window.webContents.send("xxmi:changed", { gameId: "endfield" });
  };
  const resolveInstallation = () => {
    const game = gamesSettings.getSettingsGame("endfield");
    const installation = installXxmi.resolveInstallation("endfield");
    return { ...installation, gamePath: game.gamePath };
  };
  const assertStopped = paths => assertEndfieldStopped(paths, runPowerShell);
  efmiVulkanService = createEfmiVulkanService({
    packages: createEfmiVulkanPackages({
      bundledDir: path.join(installRoot, "local-components", "efmi-vulkan"),
      cacheDir: path.join(electron.app.getPath("userData"), "efmi-vulkan", "packages"),
      fetch: (...args) => electron.net.fetch(...args)
    }),
    miForks: installXxmi.miForks,
    bundleRoots: installXxmi.componentRoots,
    readPresent: readPresentMethod,
    assertStopped,
    resolveInstallation,
    notifyChanged: notify
  });
  const effRoot = path.join(electron.app.getPath("userData"), "eff");
  effService = createEffService({
    packages: createEffPackages({
      cacheDir: path.join(effRoot, "packages"),
      fetch: (...args) => electron.net.fetch(...args)
    }),
    bundleRoots: installXxmi.componentRoots,
    resolveGame: resolveInstallation,
    // The runtime on disk decides, as it is what the next launch loads.
    efmiVulkanActive: () => {
      const { miRoot } = installXxmi.resolveInstallation("endfield") || {};
      try {
        return !!miRoot && fs.readFileSync(path.join(miRoot, "d3d11.dll")).includes(VULKAN_MARK);
      } catch {
        return false;
      }
    },
    assertStopped: () => assertStopped({ launcher: resolveInstallation().launcherRoot }),
    stateFile: path.join(effRoot, "state.json"),
    backupDir: path.join(effRoot, "backup"),
    trash: target => systemFiles.movePathToRecycleBin(target, "eff-mod"),
    extract: (archive, target) => archivesExtract.extractArchiveWithExternalTool(archive, target, { flatten: false }),
    notifyChanged: notify
  });
}
function registerIpc() {
  for (const [channel, action] of Object.entries({
    "efmi:vulkan-status": () => efmiVulkanService.status(),
    "efmi:vulkan-set-enabled": async ({ enabled, confirmed } = {}) => {
      const result = await efmiVulkanService.setEnabled(enabled, { confirmed: confirmed === true });
      // The EFF loaders follow the runtime; a failure here is repaired before the next launch.
      await effService.sync().catch(() => {});
      return result;
    },
    "efmi:vulkan-set-channel": target => efmiVulkanService.setChannel(target),
    "efmi:vulkan-check-updates": () => efmiVulkanService.checkUpdates(),
    "efmi:vulkan-update": () => efmiVulkanService.update(),
    "eff:status": () => effService.status(),
    "eff:set-installed": installed => effService.setInstalled(installed === true),
    "eff:set-enabled": enabled => effService.setEnabled(enabled),
    "eff:set-channel": target => effService.setChannel(target),
    "eff:check-updates": () => effService.checkUpdates(),
    "eff:update": () => effService.update()
  })) {
    electron.ipcMain.handle(channel, async (_, payload) => {
      try {
        if (installXxmi.isBusy()) throw new Error(i18n.t("settings.mi.busy"));
        return await action(payload);
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });
  }
}
module.exports = {
  registerIpc,
  initialize,
  get efmiVulkanService() {
    return efmiVulkanService;
  },
  get effService() {
    return effService;
  }
};
