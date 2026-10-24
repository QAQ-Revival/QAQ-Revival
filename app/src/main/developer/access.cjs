"use strict";

const i18n = require("../../shared/i18n/core.cjs");
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const configStore = require("../config/store.cjs");
const DEV_MODE_PASSWORD_HASH = "b37eaacb1b884cad8748dccce485af6fb41d105a68813ab25a1c225aa87e0752";
const DEV_KIT_DIR_NAME = "QAQRDevKit";
let devModeSessionUnlocked = false;
function uniqueExistingStrings(values) {
  return [...new Set(values.filter(value => typeof value === "string" && value.trim()).map(value => value.trim()))];
}
function readDevKitConfig(rootPath) {
  const configPath = path.join(rootPath, "devkit.json");
  if (!fs.existsSync(configPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf-8")) || {};
  } catch {
    return {};
  }
}
function getDevKitCandidates() {
  const exeDir = path.dirname(process.execPath || "");
  const appPath = electron.app.getAppPath();
  const appDir = fs.existsSync(appPath) && fs.statSync(appPath).isDirectory() ? appPath : path.dirname(appPath);
  const cwd = process.cwd();
  const directories = [exeDir, path.dirname(exeDir), appDir, path.dirname(appDir), cwd, path.dirname(cwd)];
  return uniqueExistingStrings([
    configStore.currentConfig.developerKitPath,
    process.env.QAQR_DEVKIT_PATH,
    ...directories.map(directory => path.join(directory, DEV_KIT_DIR_NAME))
  ]);
}
function resolveDevKitScript(rootPath, config, keys, fallbackNames) {
  for (const key of keys) {
    const value = config[key];
    if (!value) continue;
    const resolved = path.isAbsolute(value) ? value : path.join(rootPath, value);
    if (fs.existsSync(resolved)) return resolved;
  }
  for (const name of fallbackNames) {
    const resolved = path.join(rootPath, name);
    if (fs.existsSync(resolved)) return resolved;
  }
  return "";
}
function resolveDevKitPath(rootPath, config, keys) {
  for (const key of keys) {
    const value = config[key];
    if (!value) continue;
    return path.isAbsolute(value) ? value : path.join(rootPath, value);
  }
  return "";
}
function getDevKitStatus() {
  for (const rootPath of getDevKitCandidates()) {
    try {
      if (!fs.existsSync(rootPath)) continue;
      const config = readDevKitConfig(rootPath);
      const publishScriptPath = resolveDevKitScript(rootPath, config, ["publishScriptPath", "scriptPath"], ["publish_mod_cli.py", path.join("scripts", "publish_mod_cli.py"), path.join("pachong_gamebanana", "publish_mod_cli.py")]);
      const batchScriptPath = resolveDevKitScript(rootPath, config, ["batchScriptPath"], ["batch_cloud_ops.py", path.join("scripts", "batch_cloud_ops.py"), path.join("pachong_gamebanana", "batch_cloud_ops.py")]);
      const fixDir = config.fixDir ? path.isAbsolute(config.fixDir) ? config.fixDir : path.join(rootPath, config.fixDir) : path.join(rootPath, "fix");
      const serverRootPath = resolveDevKitPath(rootPath, config, ["serverRootPath", "serverRoot", "serverPath"]);
      const markerPath = path.join(rootPath, "devkit.json");
      const available = fs.existsSync(markerPath) || !!publishScriptPath || !!batchScriptPath || fs.existsSync(fixDir);
      if (!available) continue;
      return {
        success: true,
        available: true,
        unlocked: devModeSessionUnlocked,
        rootPath,
        config,
        publishScriptPath,
        batchScriptPath,
        fixDir: fs.existsSync(fixDir) ? fixDir : "",
        serverRootPath: serverRootPath && fs.existsSync(serverRootPath) ? serverRootPath : ""
      };
    } catch (_) {}
  }
  return {
    success: true,
    available: false,
    unlocked: false,
    candidates: getDevKitCandidates()
  };
}
function getDefaultDevPublishConfig() {
  const status = getDevKitStatus();
  const cfg = status.config || {};
  return {
    pythonPath: cfg.pythonPath || "python",
    winrarPath: cfg.winrarPath || "C:\\Program Files\\WinRAR\\WinRAR.exe",
    scriptPath: status.publishScriptPath || cfg.scriptPath || ""
  };
}
function normalizeDevPublishConfig(config = {}) {
  const status = getDevKitStatus();
  const defaults = getDefaultDevPublishConfig();
  const saved = config || {};
  return {
    ...defaults,
    ...saved,
    scriptPath: status.publishScriptPath || defaults.scriptPath || ""
  };
}
function requireDevKitUnlocked() {
  const status = getDevKitStatus();
  if (!status.available) {
    return {
      success: false,
      error: i18n.t("backend.developer.access.developerKitMissingAdvice", {
        detail: DEV_KIT_DIR_NAME
      })
    };
  }
  if (!devModeSessionUnlocked) return {
    success: false,
    error: i18n.t("backend.developer.access.developerModeLocked")
  };
  return {
    success: true,
    status
  };
}
function isProtectedDeveloperIpc(channel) {
  if (channel === "dev:get-devkit-status" || channel === "dev:unlock" || channel === "dev:lock") return false;
  return channel.startsWith("dev:") || channel.startsWith("mark:") || channel === "export-marked-mods";
}
const originalIpcHandle = electron.ipcMain.handle.bind(electron.ipcMain);
function registerIpc() {
  electron.ipcMain.handle = (channel, listener) => originalIpcHandle(channel, async (...args) => {
    if (isProtectedDeveloperIpc(channel)) {
      const gate = requireDevKitUnlocked();
      if (!gate.success) return gate;
    }
    return listener(...args);
  });
  electron.ipcMain.handle("dev:get-devkit-status", async () => getDevKitStatus());
  electron.ipcMain.handle("dev:unlock", async (_, password) => {
    const status = getDevKitStatus();
    if (!status.available) {
      return {
        success: false,
        error: i18n.t("backend.developer.access.developerKitMissing", {
          detail: DEV_KIT_DIR_NAME
        })
      };
    }
    const hashHex = crypto.createHash("sha256").update(String(password || ""), "utf8").digest("hex");
    if (hashHex !== DEV_MODE_PASSWORD_HASH) return {
      success: false,
      error: i18n.t("backend.developer.access.wrongPassword")
    };
    devModeSessionUnlocked = true;
    return {
      success: true,
      status: getDevKitStatus(),
      config: getDefaultDevPublishConfig()
    };
  });
  electron.ipcMain.handle("dev:lock", async () => {
    devModeSessionUnlocked = false;
    return {
      success: true
    };
  });
}
module.exports = {
  registerIpc,
  normalizeDevPublishConfig,
  requireDevKitUnlocked
};
