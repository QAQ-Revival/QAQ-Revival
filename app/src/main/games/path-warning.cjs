"use strict";

const i18n = require("../../shared/i18n/core.cjs");
const electron = require("electron");
const path = require("node:path");
const configStore = require("../config/store.cjs");
const desktopWindows = require("../desktop/windows.cjs");
const marketSettings = require("../market/settings.cjs");
const systemPaths = require("../system/paths.cjs");
const DANGEROUS_MANAGED_PATH_WARNING = i18n.t("backend.games.pathWarning.managedPathInsideInstallation");
function collectConfiguredManagedPaths() {
  const entries = [];
  function addEntry(label, targetPath, scope = "") {
    if (!targetPath || typeof targetPath !== "string" || !targetPath.trim()) return;
    entries.push({
      label,
      path: targetPath.trim(),
      scope
    });
  }
  addEntry(i18n.t("backend.games.pathWarning.modsPathLabel"), configStore.currentConfig.modsPath, i18n.t("backend.games.pathWarning.legacyConfig"));
  addEntry(i18n.t("backend.games.pathWarning.xxmiPathLabel"), configStore.currentConfig.xxmiPath, i18n.t("backend.games.pathWarning.legacyConfig"));
  addEntry(i18n.t("backend.games.pathWarning.efmiPathLabel"), configStore.currentConfig.efmiPath, i18n.t("backend.games.pathWarning.legacyConfig"));
  addEntry(i18n.t("backend.games.pathWarning.loaderPathLabel"), configStore.currentConfig.loaderPath, i18n.t("backend.games.pathWarning.legacyConfig"));
  for (const game of configStore.currentConfig.games || []) {
    const gameName = game?.name || game?.id || i18n.t("backend.games.pathWarning.gameConfig");
    addEntry(i18n.t("backend.games.pathWarning.modsPathLabel"), game?.modFolderPath, gameName);
    addEntry(i18n.t("backend.games.pathWarning.xxmiPathLabel"), game?.modLoaderPath, gameName);
  }
  const seen = new Set();
  return entries.filter(entry => {
    const key = `${entry.label}|${entry.scope}|${systemPaths.normalizeComparablePath(entry.path)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function getDangerousManagedPaths() {
  const installDir = marketSettings.getQaqInstallDir();
  const dangerousPaths = collectConfiguredManagedPaths().filter(entry => isDangerousManagedPath(entry.path, installDir));
  return {
    installDir,
    dangerousPaths
  };
}
function isDangerousManagedPath(target, installDir) {
  return systemPaths.isPathInsideDirectory(target, installDir) && !systemPaths.isPathInsideDirectory(target, path.join(installDir, "data"));
}
function formatDangerousManagedPathDetail(checkResult) {
  const dangerousPaths = checkResult?.dangerousPaths || [];
  const lines = [i18n.t("backend.games.pathWarning.installDirectoryDetail", {
    installDir: checkResult?.installDir || marketSettings.getQaqInstallDir()
  })];
  if (dangerousPaths.length > 0) {
    lines.push("", i18n.t("backend.games.pathWarning.dangerousPaths"));
    for (const item of dangerousPaths) {
      const scopePrefix = item.scope ? `${item.scope} - ` : "";
      lines.push(`- ${scopePrefix}${item.label}: ${item.path}`);
    }
  }
  return lines.join("\n");
}
function showMessageBoxWithOptionalOwner(ownerWindow, options) {
  if (ownerWindow && !ownerWindow.isDestroyed()) {
    return electron.dialog.showMessageBox(ownerWindow, options);
  }
  return electron.dialog.showMessageBox(options);
}
async function showDangerousManagedPathStartupWarning(ownerWindow = desktopWindows.mainWindowRef) {
  const checkResult = getDangerousManagedPaths();
  if (checkResult.dangerousPaths.length === 0) return {
    dangerous: false
  };
  await showMessageBoxWithOptionalOwner(ownerWindow, {
    type: "warning",
    title: i18n.t("backend.games.pathWarning.title"),
    message: DANGEROUS_MANAGED_PATH_WARNING,
    detail: formatDangerousManagedPathDetail(checkResult),
    buttons: [i18n.t("backend.games.pathWarning.acknowledge")],
    defaultId: 0,
    cancelId: 0,
    noLink: true
  });
  return {
    dangerous: true,
    ...checkResult
  };
}
module.exports = {
  isDangerousManagedPath,
  showDangerousManagedPathStartupWarning
};
