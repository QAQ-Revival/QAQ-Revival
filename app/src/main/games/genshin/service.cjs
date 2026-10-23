"use strict";

const i18n = require("../../../shared/i18n/core.cjs");
module.exports = {
  registerIpc,
  initialize,
  get genshinDiagnostics() {
    return genshinDiagnostics;
  },
  get genshinAntiCrash() {
    return genshinAntiCrash;
  }
};
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const child_process = require("child_process");
const configStore = require("../../config/store.cjs");
const desktopWindows = require("../../desktop/windows.cjs");
const gamesSettings = require("../settings.cjs");
const installPaths = require("../../install/paths.cjs");
const runtimePaths = require("../../runtime/paths.cjs");
const systemWindows = require("../../system/windows.cjs");
let genshinDiagnostics;
let genshinAntiCrash;
const GENSHIN_ANTI_CRASH_KEYS = ["twin", "manualStart", "injectMode", "networkBlock", "originalDll", "customDll", "customDllPath"];
function initialize() {
  genshinDiagnostics = require("./diagnostics.cjs").createGenshinDiagnostics({
    getGame: () => gamesSettings.getSettingsGame("genshin-impact"),
    resolveLauncherRoot: installPaths.resolveXxmiRootFromLauncherPath,
    tokenizeArgs: systemWindows.parseLaunchArgs,
    backupDir: path.join(electron.app.getPath("userData"), "game-settings-backups", "genshin-impact"),
    assertStopped: async state => {
      const literal = value => "'" + value.replace(/'/g, "''") + "'";
      const roots = [...new Set([state.gameDir, state.configuredGame].filter(Boolean))];
      const bin = path.join(state.root, "Resources", "Bin");
      const script = `$ErrorActionPreference='Stop'; $gameDirs=@(${roots.map(literal).join(",")}); $loaderDir=${literal(bin)}; $found=@(Get-Process | Where-Object { $_.Path -and ((($_.ProcessName -in @('YuanShen','GenshinImpact')) -and ([IO.Path]::GetDirectoryName($_.Path) -in $gameDirs)) -or [IO.Path]::GetDirectoryName($_.Path) -eq $loaderDir) }); Write-Output $found.Count`;
      await new Promise((resolve, reject) => child_process.execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")], {
        windowsHide: true,
        timeout: 8000
      }, (error, stdout) => {
        if (error) reject(new Error(i18n.t("backend.games.genshinServices.processStateUnknown")));else if (String(stdout).trim() !== "0") reject(new Error(i18n.t("backend.games.genshinServices.closeBeforePathRepair")));else resolve();
      }));
    }
  });
  genshinAntiCrash = require("./anticrash.cjs").createGenshinAntiCrashService({
    getGame: () => gamesSettings.getSettingsGame("genshin-impact"),
    defaultCustomDllPath: path.join(electron.app.isPackaged ? path.dirname(process.execPath) : path.resolve(runtimePaths.mainDir, "../../.."), "local-components", "d3d11-nocheck.dll"),
    resolveLauncherRoot: installPaths.resolveXxmiRootFromLauncherPath,
    stateDir: path.join(electron.app.getPath("userData"), "genshin-anticrash"),
    assertStopped: async state => {
      const literal = value => "'" + value.replace(/'/g, "''") + "'";
      const bin = path.join(state.root, "Resources", "Bin");
      const script = `$ErrorActionPreference='Stop'; $gameDir=${literal(state.gameDir + path.sep)}; $loaderDir=${literal(bin)}; $found=@(Get-Process | Where-Object { $_.Path -and ((($_.ProcessName -in @('YuanShen','GenshinImpact')) -and $_.Path.StartsWith($gameDir,[StringComparison]::OrdinalIgnoreCase)) -or [IO.Path]::GetDirectoryName($_.Path) -eq $loaderDir) }); Write-Output $found.Count`;
      await new Promise((resolve, reject) => child_process.execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")], {
        windowsHide: true,
        timeout: 8000
      }, (error, stdout) => {
        if (error) reject(new Error(i18n.t("backend.games.genshinServices.processStateUnknown")));else if (String(stdout).trim() !== "0") reject(new Error(i18n.t("backend.games.genshinServices.closeBeforeAntiCrash")));else resolve();
      }));
    },
    runNetsh: args => new Promise(resolve => child_process.execFile("netsh.exe", args, {
      windowsHide: true,
      timeout: 15000
    }, (error, stdout) => resolve({
      ok: !error,
      error: error?.message,
      stdout: String(stdout || "")
    }))),
    isFirewallRulePresent: name => new Promise((resolve, reject) => {
      const literal = "'" + name.replace(/'/g, "''") + "'";
      const script = `$ErrorActionPreference='Stop'; $rules=@(Get-NetFirewallRule -PolicyStore PersistentStore -ErrorAction Stop | Where-Object { $_.DisplayName -eq ${literal} }); Write-Output $rules.Count`;
      child_process.execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")], {
        windowsHide: true,
        timeout: 15000
      }, (error, stdout) => {
        const count = String(stdout).trim();
        if (error || !/^\d+$/.test(count)) reject(error || new Error(i18n.t("backend.games.genshinServices.firewallStateUnknown")));else resolve(Number(count) > 0);
      });
    }),
    isProcessNameRunning: systemWindows.isWindowsProcessRunning,
    isElevated: () => systemWindows.isProcessElevated()
  });
}
function registerIpc() {
  for (const [channel, action] of Object.entries({
    "genshin:check-environment": () => genshinDiagnostics.check(),
    "genshin:repair-environment": payload => genshinDiagnostics.apply(payload),
    "genshin:restore-environment": payload => genshinDiagnostics.restore(payload)
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
  electron.ipcMain.handle("genshin:update-check-settings", async (_, updates) => {
    try {
      if (!updates || typeof updates !== "object" || Array.isArray(updates) || !Object.keys(updates).length || Object.keys(updates).some(key => !["preflightEnabled", "launchArgs"].includes(key)) || updates.preflightEnabled !== undefined && typeof updates.preflightEnabled !== "boolean" || updates.launchArgs !== undefined && (typeof updates.launchArgs !== "string" || updates.launchArgs.length > 2048 || /[\0\r\n]/.test(updates.launchArgs))) {
        return {
          success: false,
          error: i18n.t("backend.games.genshinServices.invalidCheckSettings")
        };
      }
      const game = gamesSettings.getSettingsGame("genshin-impact");
      const updated = {
        ...game
      };
      if (updates.preflightEnabled !== undefined) updated.genshinPreflightEnabled = updates.preflightEnabled;
      if (updates.launchArgs !== undefined) updated.launchArgs = updates.launchArgs.trim();
      const next = {
        ...configStore.currentConfig,
        games: configStore.currentConfig.games.map(item => item.id === game.id ? updated : item)
      };
      if (!configStore.saveConfig(next)) throw Error(i18n.t("backend.games.genshinServices.saveSettingsFailed"));
      configStore.currentConfig = next;
      gamesSettings.notifyGamesChanged();
      return {
        ...genshinDiagnostics.check(),
        message: i18n.t("backend.games.genshinServices.checkSettingsSaved")
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("genshin:export-check", async () => {
    try {
      const report = genshinDiagnostics.exportReport();
      const selected = await electron.dialog.showSaveDialog(desktopWindows.mainWindowRef, {
        title: i18n.t("backend.games.genshinServices.exportCheckTitle"),
        defaultPath: "genshin-compatibility.json",
        filters: [{
          name: i18n.t("backend.games.genshinServices.reportFilter"),
          extensions: ["json"]
        }]
      });
      if (selected.canceled || !selected.filePath) return {
        success: false,
        canceled: true
      };
      if (!path.isAbsolute(selected.filePath) || path.extname(selected.filePath).toLowerCase() !== ".json") throw Error(i18n.t("backend.games.genshinServices.jsonReportRequired"));
      fs.writeFileSync(selected.filePath, JSON.stringify(report, null, 2) + "\n", "utf8");
      return {
        success: true,
        path: selected.filePath,
        message: i18n.t("backend.games.genshinServices.reportExported")
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  });
  for (const [channel, action] of Object.entries({
    "genshin:get-anticrash": () => genshinAntiCrash.get(),
    "genshin:update-anticrash": async settings => {
      const validPath = value => typeof value === "string" && value === "" || typeof value === "string" && path.isAbsolute(value) && path.extname(value).toLowerCase() === ".dll" && value.length <= 1024 && !/[\0\r\n]/.test(value);
      if (!settings || typeof settings !== "object" || Array.isArray(settings) || !Object.keys(settings).length || Object.keys(settings).some(key => !GENSHIN_ANTI_CRASH_KEYS.includes(key)) || ["twin", "manualStart", "networkBlock", "originalDll", "customDll"].some(key => settings[key] !== undefined && typeof settings[key] !== "boolean") || settings.injectMode !== undefined && !["default", "hook", "direct"].includes(settings.injectMode) || settings.customDllPath !== undefined && !validPath(settings.customDllPath)) {
        return {
          success: false,
          error: i18n.t("backend.games.genshinServices.invalidAntiCrashSettings")
        };
      }
      const game = gamesSettings.getSettingsGame("genshin-impact");
      const previousPath = typeof game.genshinAntiError?.customDllPath === "string" ? game.genshinAntiError.customDllPath : "";
      const nextPath = settings.customDllPath !== undefined ? settings.customDllPath.trim() : previousPath;
      game.genshinAntiError = genshinAntiCrash.normalizeSettings({
        ...(game.genshinAntiError || {}),
        ...settings
      });
      game.genshinAntiError.customDllPath = nextPath;
      if (!configStore.saveConfig(configStore.currentConfig)) return {
        success: false,
        error: i18n.t("backend.games.genshinServices.saveSettingsFailed")
      };
      gamesSettings.notifyGamesChanged();
      return {
        ...genshinAntiCrash.get(),
        message: i18n.t("backend.games.genshinServices.antiCrashSettingsSaved")
      };
    },
    "genshin:anticrash-cleanup": () => genshinAntiCrash.cleanup({
      force: false
    }),
    "genshin:select-custom-dll": async () => {
      const selected = await electron.dialog.showOpenDialog(desktopWindows.mainWindowRef, {
        title: i18n.t("backend.games.genshinServices.selectCustomDll"),
        properties: ["openFile"],
        filters: [{
          name: i18n.t("backend.games.genshinServices.graphicsLibraryFilter"),
          extensions: ["dll"]
        }]
      });
      if (selected.canceled || !selected.filePaths?.length) return {
        success: false,
        canceled: true
      };
      const file = selected.filePaths[0];
      if (path.extname(file).toLowerCase() !== ".dll") return {
        success: false,
        error: i18n.t("backend.games.genshinServices.dllRequired")
      };
      return {
        success: true,
        path: file
      };
    }
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
}
