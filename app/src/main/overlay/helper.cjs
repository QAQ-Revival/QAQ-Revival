"use strict";

const i18n = require("../../shared/i18n/core.cjs");
module.exports = {
  triggerOverlayReload,
  applyOverlayHotkey
};
const fs = require("fs");
const child_process = require("child_process");
const configStore = require("../config/store.cjs");
const coreLogger = require("../core/logger.cjs");
const overlayActivity = require("./activity.cjs");
const overlayHelperPaths = require("./helper-paths.cjs");
const overlayHotkeyExpression = require("./hotkey-expression.cjs");
function runBundledHelperProcess(command, args = []) {
  return new Promise((resolve, reject) => {
    const child = child_process.spawn(command, args, {
      windowsHide: true,
      stdio: ["ignore", "ignore", "pipe"]
    });
    let stderr = "";
    child.stderr?.on("data", chunk => {
      stderr += chunk.toString();
    });
    child.on("error", error => reject(error));
    child.on("close", code => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || i18n.t("backend.overlay.helper.helperExitedWithCode", {
        code
      })));
    });
  });
}
async function runManagedOverlayHelper(kind, hotkeyBase64 = "") {
  let lastError = null;
  const helperExePath = overlayHelperPaths.resolveBundledHelperPath("QaqrKeyHelper.exe");
  if (helperExePath && /qaqrkeyhelper\.exe$/i.test(helperExePath) && fs.existsSync(helperExePath)) {
    const args = kind === "reload" ? ["f10"] : ["hotkey", hotkeyBase64];
    try {
      await runBundledHelperProcess(helperExePath, args);
      return true;
    } catch (error) {
      lastError = error;
    }
  }
  const scriptPath = overlayHelperPaths.resolveBundledHelperPath(kind === "reload" ? "press_f10.ps1" : "press_hotkey.ps1");
  if (scriptPath && /\.ps1$/i.test(scriptPath) && fs.existsSync(scriptPath)) {
    const args = ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", scriptPath];
    if (kind !== "reload") {
      args.push(hotkeyBase64);
    }
    try {
      await runBundledHelperProcess("powershell.exe", args);
      return true;
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError) throw lastError;
  return false;
}
async function triggerOverlayReload() {
  overlayActivity.overlayActivity.invalidate();
  await overlayActivity.prepareOverlayActivity();
  const cmd = (configStore.currentConfig.overlayAutoReloadCommand || "").trim();
  if (!cmd) return;
  if (overlayHelperPaths.isManagedOverlayHelperCommand(cmd, "press_f10")) {
    const handled = await runManagedOverlayHelper("reload");
    if (handled) return;
  }
  return new Promise(resolve => {
    child_process.exec(cmd, error => {
      if (error) {
        coreLogger.logger.warn("Auto reload command failed:", error.message || error);
      }
      resolve();
    });
  });
}
async function applyOverlayHotkey(hotkey) {
  const payload = overlayHotkeyExpression.resolveHotkeyApplyPayload(hotkey);
  if (!payload) {
    throw new Error(overlayHotkeyExpression.getApplyHotkeyUnsupportedMessage(hotkey));
  }
  if (!overlayHotkeyExpression.canAutoApplyHotkeyPayload(payload)) {
    throw new Error(overlayHotkeyExpression.getApplyHotkeyUnsupportedMessage(payload));
  }
  const template = (configStore.currentConfig.overlayHotkeyCommandTemplate || "").trim();
  if (!template) {
    throw new Error(i18n.t("backend.overlay.helper.hotkeyScriptMissing"));
  }
  const serialized = overlayHotkeyExpression.serializeHotkeyForCommand(payload);
  const display = Array.isArray(payload.displayKeys) && payload.displayKeys.length > 0 ? payload.displayKeys.join(" + ") : serialized;
  const original = payload.original || display || serialized;
  const hotkeyBase64 = Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
  if (overlayHelperPaths.isManagedOverlayHelperCommand(template, "press_hotkey")) {
    const handled = await runManagedOverlayHelper("hotkey", hotkeyBase64);
    if (handled) return;
  }
  const replacements = {
    keys: serialized,
    display,
    raw: original,
    rawEncoded: encodeURIComponent(original),
    displayEncoded: encodeURIComponent(display),
    hotkeyBase64,
    keysBase64: hotkeyBase64
  };
  let cmd = template;
  Object.entries(replacements).forEach(([name, value]) => {
    cmd = cmd.replace(new RegExp(`\\{${name}\\}`, "g"), value);
  });
  return new Promise((resolve, reject) => {
    child_process.exec(cmd, error => {
      if (error) {
        coreLogger.logger.warn("Hotkey command failed:", error.message || error);
        return reject(error);
      }
      resolve();
    });
  });
}
