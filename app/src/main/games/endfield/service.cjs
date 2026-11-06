"use strict";

const i18n = require("../../../shared/i18n/core.cjs");
const electron = require("electron");
const path = require("path");
const childProcess = require("child_process");
const { createEfmiVulkanPackages } = require("./vulkan-packages.cjs");
const { createEfmiVulkanService, assertEndfieldStopped } = require("./vulkan.cjs");
const { readPresentMethod } = require("./present-method.cjs");
const gamesSettings = require("../settings.cjs");
const installXxmi = require("../../install/xxmi.cjs");
const runtimePaths = require("../../runtime/paths.cjs");
let efmiVulkanService;
function runPowerShell(script) {
  const powershell = path.join(process.env.SystemRoot || "C:\\Windows", "System32/WindowsPowerShell/v1.0/powershell.exe");
  return new Promise((resolve, reject) => childProcess.execFile(powershell, ["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")], {
    windowsHide: true,
    timeout: 8000
  }, (error, stdout) => error ? reject(new Error(i18n.t("backend.efmiVulkan.processStateUnknown"))) : resolve(String(stdout))));
}
function initialize() {
  const installRoot = electron.app.isPackaged ? path.dirname(process.execPath) : path.resolve(runtimePaths.mainDir, "../../..");
  efmiVulkanService = createEfmiVulkanService({
    packages: createEfmiVulkanPackages({
      bundledDir: path.join(installRoot, "local-components", "efmi-vulkan"),
      cacheDir: path.join(electron.app.getPath("userData"), "efmi-vulkan", "packages"),
      fetch: (...args) => electron.net.fetch(...args)
    }),
    miForks: installXxmi.miForks,
    bundleRoots: installXxmi.componentRoots,
    readPresent: readPresentMethod,
    assertStopped: paths => assertEndfieldStopped(paths, runPowerShell),
    resolveInstallation: () => {
      const game = gamesSettings.getSettingsGame("endfield");
      const installation = installXxmi.resolveInstallation("endfield");
      return { ...installation, gamePath: game.gamePath };
    },
    notifyChanged: () => {
      for (const window of electron.BrowserWindow.getAllWindows()) if (!window.isDestroyed()) window.webContents.send("xxmi:changed", { gameId: "endfield" });
    }
  });
}
function registerIpc() {
  for (const [channel, action] of Object.entries({
    "efmi:vulkan-status": () => efmiVulkanService.status(),
    "efmi:vulkan-set-enabled": ({ enabled, confirmed } = {}) => efmiVulkanService.setEnabled(enabled, { confirmed: confirmed === true }),
    "efmi:vulkan-set-channel": target => efmiVulkanService.setChannel(target),
    "efmi:vulkan-check-updates": () => efmiVulkanService.checkUpdates(),
    "efmi:vulkan-update": () => efmiVulkanService.update()
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
  }
};
