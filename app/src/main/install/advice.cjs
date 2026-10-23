"use strict";

const i18n = require("../../shared/i18n/core.cjs");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const installPaths = require("./paths.cjs");
const systemWindows = require("../system/windows.cjs");
function isZipChecksumError(error) {
  const message = String(error?.message || error || "");
  return /crc32 checksum failed|checksum failed|invalid checksum|corrupt|unexpected end|invalid zip/i.test(message);
}
function getFileSizeLabel(filePath) {
  try {
    const size = fs.statSync(filePath).size;
    if (size >= 1024 * 1024) return i18n.t("backend.install.advice.mB", {
      progress: (size / 1024 / 1024).toFixed(1)
    });
    if (size >= 1024) return i18n.t("backend.install.advice.kB", {
      progress: (size / 1024).toFixed(1)
    });
    return i18n.t("backend.install.advice.b", {
      size
    });
  } catch (_) {
    return i18n.t("backend.install.advice.sizeUnavailable");
  }
}
function getFileSha256(filePath) {
  try {
    return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").toUpperCase();
  } catch (_) {
    return i18n.t("backend.install.advice.hashUnavailable");
  }
}
function formatAutoinstallArchiveError(error, archivePath, packageLabel, context = {}) {
  const detail = systemWindows.formatWindowsFileOperationError(error, {
    path: context.path || archivePath,
    operation: context.operation || "extract-archive"
  });
  if (!isZipChecksumError(error)) return detail;
  return [i18n.t("backend.install.advice.packageIntegrityFailed", {
    packageLabel
  }), i18n.t("backend.install.advice.packagePathDetail", {
    archivePath
  }), i18n.t("backend.imports.batchScan.archiveSize", {
    fileSizeLabel: getFileSizeLabel(archivePath)
  }), `SHA256：${getFileSha256(archivePath)}`, i18n.t("backend.install.advice.downloadPackageAgain")].join("\n");
}
function resolveNamedAutoinstallDir(baseDir, folderName) {
  const resolvedDir = installPaths.resolveNamedInstallDirectory(baseDir, folderName);
  return resolvedDir ? path.resolve(resolvedDir) : "";
}
function resolveGamePackageAutoinstallDir(baseDir, importerName) {
  const resolvedDir = installPaths.resolveGamePackageInstallDirectory(baseDir, importerName);
  return resolvedDir ? path.resolve(resolvedDir) : "";
}
function buildXxmiLauncherMissingAdvice(expectedLauncherExe) {
  return [i18n.t("backend.install.advice.xxmiLauncherIncomplete"), i18n.t("backend.install.advice.checkExpectedPath", {
    expectedLauncherExe
  }), i18n.t("backend.install.advice.installXxmiAdvice")].join("\n");
}
function buildGamePackageMissingAdvice(importerName, expectedModsDir) {
  return [i18n.t("backend.install.advice.gamePackageIncomplete", {
    importerName
  }), i18n.t("backend.install.advice.checkExpectedPath", {
    expectedLauncherExe: expectedModsDir
  }), i18n.t("backend.install.advice.installGamePackageAdvice")].join("\n");
}
function buildMissingXxmiLauncherLaunchError(importerName, configuredPath) {
  const label = importerName || "XXMI";
  if (!configuredPath) {
    return [i18n.t("backend.install.advice.xxmiPathNotConfigured", {
      label
    }), i18n.t("backend.install.advice.selectXxmiPathAdvice"), i18n.t("backend.install.advice.standardXxmiPathAdvice"), i18n.t("backend.install.advice.installXxmiFirstAdvice")].join("\n");
  }
  return [i18n.t("backend.install.advice.configuredXxmiMissing"), i18n.t("backend.install.advice.configuredPathDetail", {
    configuredPath
  }), i18n.t("backend.install.advice.revealConfiguredPathAdvice"), i18n.t("backend.install.advice.repairConfiguredPathAdvice")].join("\n");
}
module.exports = {
  getFileSizeLabel,
  formatAutoinstallArchiveError,
  resolveNamedAutoinstallDir,
  resolveGamePackageAutoinstallDir,
  buildXxmiLauncherMissingAdvice,
  buildGamePackageMissingAdvice,
  buildMissingXxmiLauncherLaunchError
};
