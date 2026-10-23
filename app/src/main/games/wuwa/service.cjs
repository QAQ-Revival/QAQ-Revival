"use strict";

const i18n = require("../../../shared/i18n/core.cjs");
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const child_process = require("child_process");
const {
  createWuwaDx12Packages,
  createWuwaDx12Components
} = require("./dx12-components.cjs");
const {
  createWuwaDx12Service,
  resolveWuwaDx12Paths
} = require("./dx12.cjs");
const configStore = require("../../config/store.cjs");
const desktopWindows = require("../../desktop/windows.cjs");
const gamesSettings = require("../settings.cjs");
const installPaths = require("../../install/paths.cjs");
const runtimePaths = require("../../runtime/paths.cjs");
const systemWindows = require("../../system/windows.cjs");
const wuwaDx12StateDir = path.join(electron.app.getPath("userData"), "wuwa-dx12");
let wuwaDx12Packages;
let wuwaDx12Components;
let wuwaDx12Service;
let wuwaTuningService;
function initialize() {
  wuwaDx12Packages = createWuwaDx12Packages({
    bundledDir: path.join(electron.app.isPackaged ? path.dirname(process.execPath) : path.resolve(runtimePaths.mainDir, "../../.."), "local-components", "wwmi-dx12"),
    cacheDir: path.join(wuwaDx12StateDir, "packages"),
    fetch: (...args) => electron.net.fetch(...args)
  });
  wuwaDx12Components = createWuwaDx12Components({
    stateDir: path.join(wuwaDx12StateDir, "components"),
    getPackage: wuwaDx12Packages
  });
  wuwaDx12Service = createWuwaDx12Service({
    components: wuwaDx12Components,
    packages: wuwaDx12Packages,
    backupDir: path.join(wuwaDx12StateDir, "config-backups"),
    resolvePaths: () => {
      const game = gamesSettings.getSettingsGame("wuthering-waves");
      const info = gamesSettings.readXxmiImporterPathInfo(game.modLoaderPath, game.id);
      return resolveWuwaDx12Paths({
        gamePath: game.gamePath,
        gameFolder: info.gameFolder && info.xxmiRootDir ? path.resolve(info.xxmiRootDir, info.gameFolder) : "",
        importerPath: info.importerPath,
        modsPath: game.modFolderPath,
        launcherPath: game.modLoaderPath
      });
    },
    getEnabled: () => gamesSettings.getSettingsGame("wuthering-waves").wuwaDx12Enabled,
    saveEnabled: enabled => {
      const game = gamesSettings.getSettingsGame("wuthering-waves"),
        previous = game.wuwaDx12Enabled;
      game.wuwaDx12Enabled = enabled;
      try {
        if (!configStore.saveConfig(configStore.currentConfig)) throw Error(i18n.t("backend.games.wuwaServices.saveDx12Failed"));
      } catch (error) {
        game.wuwaDx12Enabled = previous;
        throw error;
      }
      gamesSettings.notifyGamesChanged();
    },
    launchProcess: (file, cwd, args) => systemWindows.windowsLauncher.launch(file, cwd, args, {
      requireElevation: false
    })
  });
  wuwaTuningService = require("./tuning.cjs").createWuwaTuningService({
    backupDir: path.join(electron.app.getPath("userData"), "game-settings-backups", "wuthering-waves"),
    resolvePaths: () => {
      const game = gamesSettings.getSettingsGame("wuthering-waves");
      const launcherRoot = installPaths.resolveXxmiRootFromLauncherPath(game.modLoaderPath);
      const info = gamesSettings.readXxmiImporterPathInfo(game.modLoaderPath, game.id);
      let gameRoot = game.gamePath ? path.dirname(game.gamePath) : info.gameFolder ? path.resolve(launcherRoot, info.gameFolder) : "";
      for (let level = 0; gameRoot && level < 6; level++) {
        if (fs.existsSync(path.join(gameRoot, "Wuthering Waves.exe"))) break;
        const parent = path.dirname(gameRoot);
        if (parent === gameRoot) {
          gameRoot = "";
          break;
        }
        gameRoot = parent;
      }
      return {
        gameRoot,
        launcherConfig: launcherRoot ? path.join(launcherRoot, "XXMI Launcher Config.json") : ""
      };
    },
    assertStopped: async files => {
      const gameRoot = path.resolve(path.dirname(files.user.file), "../..");
      const launcherBin = path.join(path.dirname(files.launcher.file), "Resources", "Bin");
      const literal = value => "'" + value.replace(/'/g, "''") + "'";
      const script = `$ErrorActionPreference='Stop'; $gameRoot=${literal(gameRoot + path.sep)}; $launcherBin=${literal(launcherBin)}; $found=@(Get-Process | Where-Object { $_.Path -and (($_.ProcessName -in @('Client-Win64-Shipping','Wuthering Waves') -and $_.Path.StartsWith($gameRoot,[StringComparison]::OrdinalIgnoreCase)) -or [IO.Path]::GetDirectoryName($_.Path) -eq $launcherBin) }); Write-Output $found.Count`;
      await new Promise((resolve, reject) => child_process.execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")], {
        windowsHide: true,
        timeout: 8000
      }, (error, stdout) => {
        if (error) reject(new Error(i18n.t("backend.games.wuwaServices.processStateUnknown")));else if (String(stdout).trim() !== "0") reject(new Error(i18n.t("backend.games.wuwaServices.closeBeforeTuning")));else resolve();
      }));
    }
  });
}
function registerIpc() {
  for (const [channel, action] of Object.entries({
    "wuwa:dx12-status": () => wuwaDx12Service.status(),
    "wuwa:dx12-set-enabled": enabled => wuwaDx12Service.setEnabled(enabled),
    "wuwa:dx12-check-updates": () => wuwaDx12Service.checkUpdates(),
    "wuwa:dx12-update-component": kind => wuwaDx12Service.updateComponent(kind)
  })) {
    electron.ipcMain.handle(channel, async (_, payload) => {
      try {
        return await action(payload);
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });
  }
  for (const [channel, action] of Object.entries({
    "wuwa:get-tuning": () => wuwaTuningService.get(),
    "wuwa:apply-tuning": payload => wuwaTuningService.apply(payload),
    "wuwa:restore-tuning": payload => wuwaTuningService.restore(payload)
  })) {
    electron.ipcMain.handle(channel, async (_, payload) => {
      try {
        return await action(payload);
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });
  }
  electron.ipcMain.handle("wuwa:import-device-profile", async (_, {
    revision
  } = {}) => {
    try {
      const selected = await electron.dialog.showOpenDialog(desktopWindows.mainWindowRef, {
        title: i18n.t("backend.games.wuwaServices.chooseDeviceProfile"),
        properties: ["openFile"],
        filters: [{
          name: i18n.t("backend.games.wuwaServices.deviceProfileFilter"),
          extensions: ["ini"]
        }]
      });
      if (selected.canceled || !selected.filePaths?.length) return {
        success: false,
        canceled: true
      };
      return await wuwaTuningService.apply({
        preset: "device-profile",
        revision,
        deviceProfilePath: selected.filePaths[0]
      });
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  });
}
module.exports = {
  registerIpc,
  initialize,
  get wuwaDx12Service() {
    return wuwaDx12Service;
  }
};
