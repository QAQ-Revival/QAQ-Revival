"use strict";

const i18n = require("../../shared/i18n/core.cjs");
module.exports = {
  restorePersistBakFiles,
  listIniBackupsForMod,
  restoreIniBackupForMod
};
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const charactersDirectories = require("../characters/directories.cjs");
const coreLogger = require("../core/logger.cjs");
const { WUWA_FIX_GAME_ID } = require("../games/definitions.cjs");
const gamesSettings = require("../games/settings.cjs");
const systemPaths = require("../system/paths.cjs");
const QAQM_INI_BACKUP_MARKER = ".qaqm-inibak-";
const QAQM_INI_BACKUP_PATTERN = /\.qaqm-inibak-(\d{8}-\d{6}(?:-(?:\d{2}|\d{3}-[0-9a-f]{6}))?(?:-\d{2})?)$/i;
const WUWA_INDEPENDENT_BACKUP_PATTERN = /^(.*)_(\d{4}-\d{2}-\d{2} \d{2}-\d{2}-\d{2}(?:\.\d{3})?)\.BAK$/i;
const WUWA_INDEPENDENT_STAMP_PREFIX = "wuwa-independent:";
function qaqmStampSortKey(stamp) {
  const match = String(stamp || "").match(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})(.*)$/i);
  if (!match) return String(stamp || "");
  return `${match[1]}-${match[2]}-${match[3]} ${match[4]}-${match[5]}-${match[6]}${match[7]}`;
}
function formatQaqmBackupStamp(stamp) {
  const match = String(stamp || "").match(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})(?:-(\d{2})|-(\d{3})-[0-9a-f]{6})?(?:-\d{2})?$/i);
  if (!match) return String(stamp || i18n.t("backend.mods.backups.unknownTime"));
  const base = `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}:${match[6]}`;
  if (match[8]) return `${base}.${match[8]}`;
  if (match[7]) return i18n.t("backend.mods.backups.numberedBackup", {
    base,
    count: Number(match[7]) + 1
  });
  return base;
}
function parseFixBackupFileName(fileName, {
  includeWuwaIndependent = false
} = {}) {
  const name = String(fileName || "");
  const qaqmMatch = name.match(QAQM_INI_BACKUP_PATTERN);
  if (qaqmMatch) {
    return {
      format: "qaqm",
      stamp: qaqmMatch[1],
      groupKey: qaqmMatch[1],
      timestamp: qaqmMatch[1],
      sortKey: qaqmStampSortKey(qaqmMatch[1]),
      originalName: name.replace(QAQM_INI_BACKUP_PATTERN, "")
    };
  }
  if (!includeWuwaIndependent) return null;
  const independentMatch = name.match(WUWA_INDEPENDENT_BACKUP_PATTERN);
  if (!independentMatch || !independentMatch[1]) return null;
  const timestamp = independentMatch[2];
  const groupKey = timestamp.slice(0, 16);
  return {
    format: "wuwa-independent",
    stamp: `${WUWA_INDEPENDENT_STAMP_PREFIX}${groupKey}`,
    groupKey,
    timestamp,
    sortKey: timestamp,
    originalName: independentMatch[1]
  };
}
function formatFixBackupLabel(backup) {
  if (backup?.format === "wuwa-independent") {
    const match = String(backup.groupKey || "").match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2})-(\d{2})$/);
    if (match) return i18n.t("backend.mods.backups.independentBackupLabel", {
      datePart: match[1],
      datePart2: match[2],
      datePart3: match[3],
      datePart4: match[4],
      datePart5: match[5]
    });
  }
  return formatQaqmBackupStamp(backup?.stamp);
}
function normalizedOriginalPath(filePath) {
  const value = String(filePath || "");
  return process.platform === "win32" ? value.toLowerCase() : value;
}
function buildFixBackupRestorePlan(backups, selectedStamp) {
  const selected = backups.filter(backup => backup.stamp === selectedStamp);
  if (selected.length === 0) return null;
  const format = selected[0].format;
  if (format !== "wuwa-independent") {
    return {
      format,
      restoreBackups: selected,
      cleanupBackups: selected
    };
  }
  const targetGroupKey = selected[0].groupKey;
  const cleanupBackups = backups.filter(backup => backup.format === format && backup.groupKey >= targetGroupKey);
  const earliestByFile = new Map();
  for (const backup of cleanupBackups) {
    const key = normalizedOriginalPath(backup.originalPath);
    const current = earliestByFile.get(key);
    if (!current || backup.timestamp < current.timestamp) earliestByFile.set(key, backup);
  }
  return {
    format,
    restoreBackups: Array.from(earliestByFile.values()),
    cleanupBackups
  };
}
function restorePersistBakFiles(modDir) {
  let count = 0;
  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, {
        withFileTypes: true
      });
    } catch (_) {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".qaqm-persistbak")) {
        const originalPath = fullPath.slice(0, -".qaqm-persistbak".length);
        try {
          if (fs.existsSync(originalPath)) fs.unlinkSync(originalPath);
          fs.renameSync(fullPath, originalPath);
          count++;
        } catch (e) {
          coreLogger.logger.warn(`Failed to restore persist bak: ${fullPath} -> ${originalPath}: ${e?.message || e}`);
        }
      }
    }
  }
  walk(modDir);
  return count;
}
function createIniBackupStamp() {
  const now = new Date();
  const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
  const milliseconds = String(now.getMilliseconds()).padStart(3, "0");
  return `${timestamp}-${milliseconds}-${crypto.randomBytes(3).toString("hex")}`;
}
function isIniBackupLikeFile(fileName) {
  const name = String(fileName || "");
  return name.includes(QAQM_INI_BACKUP_MARKER) || name.endsWith(".qaqm-persistbak") || name.startsWith("DISABLED_BACKUP_") || name.startsWith("DISABLED ");
}
function copyIniBackupBesideFile(iniPath, stamp) {
  let backupPath = `${iniPath}${QAQM_INI_BACKUP_MARKER}${stamp}`;
  let suffix = 1;
  while (fs.existsSync(backupPath)) {
    backupPath = `${iniPath}${QAQM_INI_BACKUP_MARKER}${stamp}-${String(suffix).padStart(2, "0")}`;
    suffix++;
  }
  fs.copyFileSync(iniPath, backupPath);
  return backupPath;
}
function createIniBackupSnapshotForDirectory(rootDir) {
  const stamp = createIniBackupStamp();
  let count = 0;
  const errors = [];
  const backupPaths = [];
  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, {
        withFileTypes: true
      });
    } catch (error) {
      errors.push(`${dir}: ${error?.message || error}`);
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!entry.name.toLowerCase().endsWith(".ini")) continue;
      if (isIniBackupLikeFile(entry.name)) continue;
      try {
        backupPaths.push(copyIniBackupBesideFile(fullPath, stamp));
        count++;
      } catch (error) {
        errors.push(`${fullPath}: ${error?.message || error}`);
      }
    }
  }
  walk(rootDir);
  return {
    stamp,
    count,
    errors,
    backupPaths
  };
}
function summarizeIniBackupSnapshot(snapshot) {
  if (!snapshot) return null;
  const {
    backupPaths: _backupPaths,
    ...summary
  } = snapshot;
  return summary;
}
function resolveModDirectory(characterName, modName) {
  const gameId2 = gamesSettings.getActiveGameScopeId();
  const modsPath = gamesSettings.getModsPath(gameId2);
  if (!modsPath || !fs.existsSync(modsPath)) {
    throw new Error(i18n.t("backend.mods.backups.modsPathMissing"));
  }
  const resolved = charactersDirectories.resolveExistingStandardModDirectory(characterName, modName, gameId2);
  if (!resolved?.modPath || !fs.existsSync(resolved.modPath)) {
    throw new Error(i18n.t("backend.mods.backups.modDirectoryMissing", {
      modName
    }));
  }
  return resolved.modPath;
}
function collectFixBackupFilesForMod(modDir) {
  const backups = [];
  const errors = [];
  const includeWuwaIndependent = gamesSettings.getActiveGameScopeId() === WUWA_FIX_GAME_ID;
  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, {
        withFileTypes: true
      });
    } catch (error) {
      const relativeDir = path.relative(modDir, dir).replace(/\\/g, "/") || ".";
      errors.push(`${relativeDir}: ${error?.message || error}`);
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;
      const parsed = parseFixBackupFileName(entry.name, {
        includeWuwaIndependent
      });
      if (!parsed) continue;
      const originalPath = path.join(dir, parsed.originalName);
      if (!systemPaths.isPathInsideDirectory(originalPath, modDir) || !systemPaths.isPathInsideDirectory(fullPath, modDir)) continue;
      backups.push({
        ...parsed,
        backupPath: fullPath,
        originalPath,
        relativePath: path.relative(modDir, originalPath).replace(/\\/g, "/")
      });
    }
  }
  walk(modDir);
  return {
    backups,
    errors
  };
}
function listIniBackupsForMod(characterName, modName) {
  const modDir = resolveModDirectory(characterName, modName);
  const scan = collectFixBackupFilesForMod(modDir);
  if (scan.errors.length > 0) {
    throw new Error(i18n.t("backend.mods.backups.backupDirectoryReadFailed", {
      path: scan.errors.slice(0, 3).join("；")
    }));
  }
  const grouped = new Map();
  for (const backup of scan.backups) {
    if (!grouped.has(backup.stamp)) {
      grouped.set(backup.stamp, {
        stamp: backup.stamp,
        format: backup.format,
        sortKey: backup.sortKey,
        label: formatFixBackupLabel(backup),
        fileCount: 0
      });
    }
    grouped.get(backup.stamp).fileCount++;
  }
  return Array.from(grouped.values()).sort((a, b) => b.sortKey.localeCompare(a.sortKey));
}
function restoreIniBackupForMod(characterName, modName, stamp) {
  const modDir = resolveModDirectory(characterName, modName);
  const selectedStamp = String(stamp || "");
  const scan = collectFixBackupFilesForMod(modDir);
  if (scan.errors.length > 0) {
    throw new Error(i18n.t("backend.mods.backups.backupScanIncomplete", {
      path: scan.errors.slice(0, 3).join("；")
    }));
  }
  const plan = buildFixBackupRestorePlan(scan.backups, selectedStamp);
  if (!plan) throw new Error(i18n.t("backend.mods.backups.backupDateMissing"));
  const backups = plan.restoreBackups;
  const cleanupBackups = plan.cleanupBackups;
  let restoredCount = 0;
  const errors = [];
  for (const backup of backups) {
    try {
      fs.copyFileSync(backup.backupPath, backup.originalPath);
      restoredCount++;
    } catch (error) {
      errors.push(`${backup.relativePath}: ${error?.message || error}`);
    }
  }
  if (errors.length > 0) {
    coreLogger.logger.warn(`[FixBackup] Restore failed stamp=${selectedStamp} restored=${restoredCount}/${backups.length}; backups preserved`);
    return {
      success: false,
      restoreSucceeded: false,
      cleanupAttempted: false,
      cleanupSucceeded: false,
      snapshotDeleted: false,
      cleanupFailed: false,
      snapshotFileCount: backups.length,
      restoredCount,
      removedBackupCount: 0,
      errors,
      cleanupErrors: [],
      backupFormat: plan.format,
      error: i18n.t("backend.mods.backups.backupRestoreIncomplete", {
        count: errors.length
      })
    };
  }
  const cleanupErrors = [];
  let removedBackupCount = 0;
  for (const backup of cleanupBackups) {
    try {
      fs.unlinkSync(backup.backupPath);
      removedBackupCount++;
    } catch (error) {
      cleanupErrors.push(`${backup.relativePath}: ${error?.message || error}`);
    }
  }
  const cleanupSucceeded = cleanupErrors.length === 0;
  if (!cleanupSucceeded) {
    coreLogger.logger.warn(`[FixBackup] Restore completed but cleanup failed stamp=${selectedStamp} removed=${removedBackupCount}/${cleanupBackups.length}`);
  }
  return {
    success: cleanupSucceeded,
    restoreSucceeded: true,
    cleanupAttempted: true,
    cleanupSucceeded,
    snapshotDeleted: cleanupSucceeded,
    cleanupFailed: !cleanupSucceeded,
    snapshotFileCount: backups.length,
    restoredCount,
    removedBackupCount,
    backupFormat: plan.format,
    errors: [],
    cleanupErrors,
    error: cleanupSucceeded ? "" : i18n.t("backend.mods.backups.backupCleanupIncomplete", {
      count: cleanupErrors.length
    })
  };
}
