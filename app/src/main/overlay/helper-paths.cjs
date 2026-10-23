"use strict";

const electron = require("electron");
const path = require("path");
const fs = require("fs");
function resolveBundledHelperPath(fileNames) {
  const names = Array.isArray(fileNames) ? fileNames : [fileNames];
  const candidates = [];
  for (const fileName of names.filter(Boolean)) {
    candidates.push(path.join(process.resourcesPath || "", fileName), path.join(electron.app.getAppPath(), "resources", fileName), path.join(path.dirname(electron.app.getAppPath()), fileName));
  }
  for (const candidate of candidates.filter(Boolean)) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch (_) {}
  }
  return candidates.find(Boolean) || names.find(Boolean) || "";
}
function isManagedOverlayHelperCommand(command, fileBaseName) {
  const normalized = String(command || "").trim().toLowerCase();
  if (!normalized) return true;
  return normalized.includes(`${fileBaseName}.py`) || normalized.includes(`${fileBaseName}.ps1`) || normalized.includes("qaqmkeyhelper.exe");
}
function getAutoOverlayCommandDefaults() {
  const helperExePath = resolveBundledHelperPath("QaqmKeyHelper.exe");
  const f10ScriptPath = resolveBundledHelperPath("press_f10.ps1");
  const hotkeyScriptPath = resolveBundledHelperPath("press_hotkey.ps1");
  if (helperExePath && /qaqmkeyhelper\.exe$/i.test(helperExePath)) {
    return {
      overlayAutoReloadCommand: `"${helperExePath}" f10`,
      overlayHotkeyCommandTemplate: `"${helperExePath}" hotkey "{hotkeyBase64}"`
    };
  }
  return {
    overlayAutoReloadCommand: `powershell -NoProfile -ExecutionPolicy Bypass -File "${f10ScriptPath}"`,
    overlayHotkeyCommandTemplate: `powershell -NoProfile -ExecutionPolicy Bypass -File "${hotkeyScriptPath}" "{hotkeyBase64}"`
  };
}
module.exports = {
  resolveBundledHelperPath,
  isManagedOverlayHelperCommand,
  getAutoOverlayCommandDefaults
};
