"use strict";

const i18n = require("../../shared/i18n/core.cjs");
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const charactersDirectories = require("../characters/directories.cjs");
const gamesSettings = require("../games/settings.cjs");
const systemFiles = require("../system/files.cjs");
const systemPaths = require("../system/paths.cjs");
const MARKED_MODS_EXPORT_PATH = path.join(electron.app.getPath("userData"), "marked-mods-export.json");
function resolveMarkedModMoveSource(entry) {
  const candidates = [];
  if (entry?.path) candidates.push(entry.path);
  const gameId2 = entry?.gameId || gamesSettings.getActiveGameScopeId();
  if (entry?.characterName && entry?.name) candidates.push(charactersDirectories.resolveCharacterModPath(entry.characterName, entry.name, gameId2));
  if (entry?.characterName && entry?.originalName) candidates.push(charactersDirectories.resolveCharacterModPath(entry.characterName, entry.originalName.replace(/^DISABLED_/i, ""), gameId2));
  return candidates.find(candidate => candidate && fs.existsSync(candidate)) || null;
}
function resolveMarkedModMoveDestination(entry, destFolder, src) {
  const modFolderName = src ? path.basename(src) : path.basename(entry?.path || entry?.originalName || entry?.name || "");
  if (!modFolderName || !entry?.characterName) return null;
  return path.join(destFolder, entry.characterName, modFolderName);
}
function hashFileForIntegrity(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("data", chunk => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}
async function getDirectoryIntegrityManifest(dirPath) {
  const manifest = [];
  async function walk(currentPath, relativeRoot = "") {
    const items = fs.readdirSync(currentPath, {
      withFileTypes: true
    }).sort((a, b) => a.name.localeCompare(b.name));
    for (const item of items) {
      const itemPath = path.join(currentPath, item.name);
      const relativePath = path.join(relativeRoot, item.name).replace(/\\/g, "/");
      if (item.isDirectory()) {
        manifest.push({
          type: "dir",
          path: relativePath
        });
        await walk(itemPath, relativePath);
      } else if (item.isFile()) {
        const stat = fs.statSync(itemPath);
        const hash = await hashFileForIntegrity(itemPath);
        manifest.push({
          type: "file",
          path: relativePath,
          size: stat.size,
          hash
        });
      }
    }
  }
  await walk(dirPath);
  return manifest;
}
async function verifyDirectoriesIdentical(sourcePath, targetPath) {
  if (!fs.existsSync(sourcePath) || !fs.existsSync(targetPath)) return false;
  const sourceManifest = await getDirectoryIntegrityManifest(sourcePath);
  const targetManifest = await getDirectoryIntegrityManifest(targetPath);
  return JSON.stringify(sourceManifest) === JSON.stringify(targetManifest);
}
function assertSafeMarkedModMovePaths(sourcePath, targetPath) {
  const normalizedSource = systemPaths.normalizeComparablePath(sourcePath);
  const normalizedTarget = systemPaths.normalizeComparablePath(targetPath);
  if (!normalizedSource || !normalizedTarget) throw new Error(i18n.t("backend.developer.markedMove.unresolvedMovePaths"));
  if (normalizedSource === normalizedTarget) throw new Error(i18n.t("backend.developer.markedMove.sameMoveDestination"));
  if (systemPaths.isPathInsideDirectory(targetPath, sourcePath)) throw new Error(i18n.t("backend.developer.markedMove.destinationInsideSource"));
  if (systemPaths.isPathInsideDirectory(sourcePath, targetPath)) throw new Error(i18n.t("backend.developer.markedMove.sourceInsideDestination"));
}
async function removeDirectoryAfterVerifiedMove(sourcePath, targetPath) {
  assertSafeMarkedModMovePaths(sourcePath, targetPath);
  if (!(await verifyDirectoriesIdentical(sourcePath, targetPath))) {
    throw new Error(i18n.t("backend.developer.markedMove.destinationIntegrityFailed"));
  }
  await systemFiles.movePathToRecycleBin(sourcePath, "remove moved source after verified move");
  if (fs.existsSync(sourcePath)) {
    throw new Error(i18n.t("backend.developer.markedMove.sourceRemovalFailed"));
  }
}
async function moveDirectoryWithIntegrityCheck(sourcePath, targetPath) {
  assertSafeMarkedModMovePaths(sourcePath, targetPath);
  try {
    fs.renameSync(sourcePath, targetPath);
    return;
  } catch (error) {
    if (!error || !["EXDEV", "EPERM"].includes(error.code)) {
      throw error;
    }
  }
  const tempTargetPath = `${targetPath}.qaqm-moving-${Date.now()}-${crypto.randomUUID()}`;
  try {
    fs.cpSync(sourcePath, tempTargetPath, {
      recursive: true
    });
    if (!(await verifyDirectoriesIdentical(sourcePath, tempTargetPath))) {
      throw new Error(i18n.t("backend.developer.markedMove.temporaryIntegrityFailed"));
    }
    fs.renameSync(tempTargetPath, targetPath);
    await removeDirectoryAfterVerifiedMove(sourcePath, targetPath);
  } catch (error) {
    if (fs.existsSync(tempTargetPath)) {
      try {
        fs.rmSync(tempTargetPath, {
          recursive: true,
          force: true
        });
      } catch (_) {}
    }
    throw error;
  }
}
function registerIpc() {
  electron.ipcMain.handle("export-marked-mods", async (_, entries) => {
    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        count: entries.length,
        mods: entries
      };
      fs.writeFileSync(MARKED_MODS_EXPORT_PATH, JSON.stringify(payload, null, 2), "utf-8");
      return {
        success: true,
        path: MARKED_MODS_EXPORT_PATH
      };
    } catch (error) {
      console.error("export-marked-mods error:", error);
      return {
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("mark:select-dest-folder", async () => {
    try {
      const result = await electron.dialog.showOpenDialog({
        title: i18n.t("backend.developer.markedMove.chooseDestinationFolder"),
        properties: ["openDirectory"],
        buttonLabel: i18n.t("backend.developer.markedMove.useThisFolder")
      });
      if (result.canceled || !result.filePaths.length) return {
        canceled: true
      };
      return {
        success: true,
        folderPath: result.filePaths[0]
      };
    } catch (error) {
      return {
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("mark:move-mods", async (_, {
    entries,
    destFolder
  }) => {
    const results = [];
    for (const entry of entries) {
      const src = resolveMarkedModMoveSource(entry);
      if (!src) {
        const existingDst = resolveMarkedModMoveDestination(entry, destFolder, null);
        if (existingDst && fs.existsSync(existingDst)) {
          if (systemFiles.directoryHasAnyFile(existingDst)) {
            results.push({
              name: entry.name,
              characterName: entry.characterName,
              gameId: entry.gameId,
              markKey: entry.markKey,
              success: false,
              error: i18n.t("backend.developer.markedMove.missingSourceUnverifiedDestination", {
                existingDst
              })
            });
          } else {
            results.push({
              name: entry.name,
              characterName: entry.characterName,
              gameId: entry.gameId,
              markKey: entry.markKey,
              success: false,
              error: i18n.t("backend.developer.markedMove.missingSourceEmptyDestination", {
                existingDst
              })
            });
          }
        } else {
          results.push({
            name: entry.name,
            characterName: entry.characterName,
            gameId: entry.gameId,
            markKey: entry.markKey,
            success: false,
            error: i18n.t("backend.developer.markedMove.sourceFolderMissing")
          });
        }
        continue;
      }
      const dst = resolveMarkedModMoveDestination(entry, destFolder, src);
      if (!dst) {
        results.push({
          name: entry.name,
          characterName: entry.characterName,
          gameId: entry.gameId,
          markKey: entry.markKey,
          success: false,
          error: i18n.t("backend.developer.markedMove.unresolvedDestination")
        });
        continue;
      }
      try {
        assertSafeMarkedModMovePaths(src, dst);
      } catch (err) {
        results.push({
          name: entry.name,
          characterName: entry.characterName,
          gameId: entry.gameId,
          markKey: entry.markKey,
          success: false,
          error: err.message || i18n.t("backend.developer.markedMove.unsafeMovePaths")
        });
        continue;
      }
      if (fs.existsSync(dst)) {
        try {
          if (await verifyDirectoriesIdentical(src, dst)) {
            await removeDirectoryAfterVerifiedMove(src, dst);
            results.push({
              name: entry.name,
              characterName: entry.characterName,
              gameId: entry.gameId,
              markKey: entry.markKey,
              success: true,
              src,
              dst
            });
          } else {
            results.push({
              name: entry.name,
              characterName: entry.characterName,
              gameId: entry.gameId,
              markKey: entry.markKey,
              success: false,
              error: i18n.t("backend.developer.markedMove.destinationConflict", {
                dst
              })
            });
          }
        } catch (err) {
          results.push({
            name: entry.name,
            characterName: entry.characterName,
            gameId: entry.gameId,
            markKey: entry.markKey,
            success: false,
            error: err.message || i18n.t("backend.developer.markedMove.existingDestinationFailed")
          });
        }
        continue;
      }
      try {
        fs.mkdirSync(path.dirname(dst), {
          recursive: true
        });
        await moveDirectoryWithIntegrityCheck(src, dst);
        results.push({
          name: entry.name,
          characterName: entry.characterName,
          gameId: entry.gameId,
          markKey: entry.markKey,
          success: true,
          src,
          dst
        });
      } catch (err) {
        results.push({
          name: entry.name,
          characterName: entry.characterName,
          gameId: entry.gameId,
          markKey: entry.markKey,
          success: false,
          error: err.message || i18n.t("backend.developer.markedMove.moveFailed")
        });
      }
    }
    const record = {
      movedAt: new Date().toISOString(),
      destFolder,
      moves: results.filter(r => r.success).map(r => ({
        name: r.name,
        src: r.src,
        dst: r.dst
      }))
    };
    const recordPath = path.join(electron.app.getPath("userData"), "marked-mods-move-record.json");
    fs.writeFileSync(recordPath, JSON.stringify(record, null, 2), "utf-8");
    return {
      success: true,
      results,
      recordPath
    };
  });
  electron.ipcMain.handle("mark:restore-mods", async (_, {
    moves
  }) => {
    const results = [];
    for (const move of moves) {
      if (!fs.existsSync(move.dst)) {
        if (fs.existsSync(move.src)) {
          results.push({
            name: move.name,
            success: true,
            alreadyRestored: true
          });
        } else {
          results.push({
            name: move.name,
            success: false,
            error: i18n.t("backend.developer.markedMove.bothFoldersMissing")
          });
        }
        continue;
      }
      if (fs.existsSync(move.src)) {
        try {
          if (await verifyDirectoriesIdentical(move.dst, move.src)) {
            await removeDirectoryAfterVerifiedMove(move.dst, move.src);
            results.push({
              name: move.name,
              success: true
            });
          } else {
            results.push({
              name: move.name,
              success: false,
              error: i18n.t("backend.developer.markedMove.restoreDestinationConflict", {
                src: move.src
              })
            });
          }
        } catch (err) {
          results.push({
            name: move.name,
            success: false,
            error: err.message || i18n.t("backend.developer.markedMove.existingOriginalFailed")
          });
        }
        continue;
      }
      try {
        fs.mkdirSync(path.dirname(move.src), {
          recursive: true
        });
        await moveDirectoryWithIntegrityCheck(move.dst, move.src);
        results.push({
          name: move.name,
          success: true
        });
      } catch (err) {
        results.push({
          name: move.name,
          success: false,
          error: err.message || i18n.t("backend.developer.markedMove.restoreMoveFailed")
        });
      }
    }
    return {
      success: true,
      results
    };
  });
  electron.ipcMain.handle("mark:get-move-record", async () => {
    try {
      const recordPath = path.join(electron.app.getPath("userData"), "marked-mods-move-record.json");
      if (!fs.existsSync(recordPath)) return {
        success: true,
        record: null
      };
      const record = JSON.parse(fs.readFileSync(recordPath, "utf-8"));
      return {
        success: true,
        record
      };
    } catch (error) {
      return {
        error: error.message
      };
    }
  });
}
module.exports = {
  registerIpc,
  hashFileForIntegrity,
  moveDirectoryWithIntegrityCheck
};
