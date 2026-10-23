"use strict";

const i18n = require("../../shared/i18n/core.cjs");
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const coreLogger = require("../core/logger.cjs");
const systemWindows = require("./windows.cjs");
async function movePathToRecycleBin(targetPath, context = "delete") {
  if (!targetPath || !fs.existsSync(targetPath)) {
    return {
      success: true,
      skipped: true,
      path: targetPath || ""
    };
  }
  const resolvedPath = path.resolve(targetPath);
  try {
    await electron.shell.trashItem(resolvedPath);
    coreLogger.logger.info(`[RecycleBin] ${context}: ${resolvedPath}`);
    return {
      success: true,
      recycled: true,
      path: resolvedPath
    };
  } catch (error) {
    throw new Error(i18n.t("backend.system.files.failedToMoveToRecycleBin", {
      context,
      windowsFileOperationError: systemWindows.formatWindowsFileOperationError(error, {
        path: resolvedPath,
        operation: "trash"
      })
    }));
  }
}
function copyDirectoryRecursive(sourceDir, targetDir) {
  fs.mkdirSync(targetDir, {
    recursive: true
  });
  for (const entry of fs.readdirSync(sourceDir, {
    withFileTypes: true
  })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      copyDirectoryRecursive(sourcePath, targetPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}
function canWriteDirectory(dirPath) {
  if (!dirPath || !fs.existsSync(dirPath)) return false;
  const testPath = path.join(dirPath, ".qaqm-write-test");
  try {
    fs.writeFileSync(testPath, "ok");
    fs.rmSync(testPath, {
      force: true
    });
    return true;
  } catch (_) {
    try {
      fs.rmSync(testPath, {
        force: true
      });
    } catch (_2) {}
    return false;
  }
}
function moveDirectoryWithFallback(sourcePath, targetPath) {
  try {
    fs.renameSync(sourcePath, targetPath);
    return;
  } catch (error) {
    if (!error || !["EXDEV", "EPERM"].includes(error.code)) {
      throw error;
    }
  }
  fs.cpSync(sourcePath, targetPath, {
    recursive: true
  });
  fs.rmSync(sourcePath, {
    recursive: true,
    force: true
  });
}
function removeDirectoryIfEmpty(dirPath) {
  if (!dirPath || !fs.existsSync(dirPath)) return false;
  try {
    if (fs.readdirSync(dirPath).length > 0) return false;
    fs.rmdirSync(dirPath);
    return true;
  } catch (_) {
    return false;
  }
}
function directoryHasAnyFile(dirPath) {
  try {
    const entries = fs.readdirSync(dirPath, {
      withFileTypes: true
    });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isFile()) return true;
      if (entry.isDirectory() && directoryHasAnyFile(fullPath)) return true;
    }
  } catch (_) {}
  return false;
}
function assertDirectoryHasAnyFile(dirPath, context = "archive") {
  if (!directoryHasAnyFile(dirPath)) {
    throw new Error(i18n.t("backend.system.files.extractedNoFilesThePackageMayBeIncompleteOrCorrupted", {
      context
    }));
  }
}
function countFilesInPath(targetPath) {
  try {
    const stat = fs.statSync(targetPath);
    if (stat.isFile()) return 1;
    if (!stat.isDirectory()) return 0;
    let count = 0;
    const entries = fs.readdirSync(targetPath, {
      withFileTypes: true
    });
    for (const entry of entries) {
      count += countFilesInPath(path.join(targetPath, entry.name));
    }
    return count;
  } catch (_) {
    return 0;
  }
}
async function removePathForOverlayCopy(targetPath, sourceIsDirectory) {
  let stat = null;
  try {
    stat = await fs.promises.stat(targetPath);
  } catch (_) {
    return;
  }
  if (sourceIsDirectory && !stat.isDirectory()) {
    await fs.promises.rm(targetPath, {
      force: true
    });
  } else if (!sourceIsDirectory && stat.isDirectory()) {
    await fs.promises.rm(targetPath, {
      recursive: true,
      force: true
    });
  }
}
async function copyDirectoryContentsOverlay(sourceDir, targetDir) {
  await fs.promises.mkdir(targetDir, {
    recursive: true
  });
  let copiedFiles = 0;
  const entries = await fs.promises.readdir(sourceDir, {
    withFileTypes: true
  });
  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      await removePathForOverlayCopy(targetPath, true);
      copiedFiles += await copyDirectoryContentsOverlay(sourcePath, targetPath);
    } else if (entry.isFile()) {
      await removePathForOverlayCopy(targetPath, false);
      await fs.promises.mkdir(path.dirname(targetPath), {
        recursive: true
      });
      await fs.promises.copyFile(sourcePath, targetPath);
      copiedFiles++;
    }
  }
  return copiedFiles;
}
async function copyPathForMoveFallback(sourcePath, targetPath, sourceIsDirectory) {
  if (sourceIsDirectory) {
    return copyDirectoryContentsOverlay(sourcePath, targetPath);
  }
  await fs.promises.mkdir(path.dirname(targetPath), {
    recursive: true
  });
  await fs.promises.copyFile(sourcePath, targetPath);
  return 1;
}
async function movePathWithFallbackAsync(sourcePath, targetPath, sourceIsDirectory, {
  onReadyToRemoveSource = null
} = {}) {
  const movedFiles = countFilesInPath(sourcePath);
  await fs.promises.mkdir(path.dirname(targetPath), {
    recursive: true
  });
  try {
    await fs.promises.rename(sourcePath, targetPath);
    return movedFiles;
  } catch (error) {
    if (!error || !["EXDEV", "EPERM"].includes(error.code)) {
      throw error;
    }
  }
  const fallbackCopiedFiles = await copyPathForMoveFallback(sourcePath, targetPath, sourceIsDirectory);
  if (onReadyToRemoveSource) await onReadyToRemoveSource();
  try {
    await fs.promises.rm(sourcePath, {
      recursive: true,
      force: true
    });
  } catch (cleanupError) {
    coreLogger.logger.warn(`[IntegratedPackage] Failed to remove moved source ${sourcePath}: ${cleanupError?.message || cleanupError}`);
  }
  return movedFiles || fallbackCopiedFiles;
}
async function renameModDirectoryWithRetry(currentPath, newPath) {
  let lastError = null;
  const retryableCodes = new Set(["EPERM", "EACCES", "EBUSY", "ENOTEMPTY"]);
  const retryDelays = [120, 220, 350, 500, 800, 1200, 1600, 2200];
  for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
    try {
      if (!fs.existsSync(currentPath) && fs.existsSync(newPath)) {
        return {
          success: true
        };
      }
      fs.renameSync(currentPath, newPath);
      return {
        success: true
      };
    } catch (e) {
      lastError = e;
      if (!retryableCodes.has(e?.code)) {
        throw e;
      }
      if (!fs.existsSync(currentPath) && fs.existsSync(newPath)) {
        return {
          success: true
        };
      }
      if (attempt < retryDelays.length) {
        await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]));
        continue;
      }
    }
  }
  const reason = lastError?.message || i18n.t("backend.ipc.mods.renameFailedAfterRetries");
  return {
    success: false,
    error: i18n.t("backend.system.files.renameRetriesExhausted", {
      reason
    })
  };
}
module.exports = {
  movePathToRecycleBin,
  copyDirectoryRecursive,
  canWriteDirectory,
  moveDirectoryWithFallback,
  removeDirectoryIfEmpty,
  directoryHasAnyFile,
  assertDirectoryHasAnyFile,
  movePathWithFallbackAsync,
  renameModDirectoryWithRetry
};
