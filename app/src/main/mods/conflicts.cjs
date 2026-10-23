"use strict";

module.exports = {
  registerIpc,
  clearConflictCache,
  detectConflictsForCharacter
};
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const charactersDirectories = require("../characters/directories.cjs");
const charactersOrganization = require("../characters/organization.cjs");
const coreLogger = require("../core/logger.cjs");
const gamesSettings = require("../games/settings.cjs");
const modsIniFiles = require("./ini-files.cjs");
function extractHashesFromIni(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split(/\r?\n/);
    const hashes = [];
    const hashRegex = /^hash\s*=\s*([a-fA-F0-9]+)/i;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith(";")) continue;
      const match = trimmed.match(hashRegex);
      if (match) {
        hashes.push(match[1].toLowerCase());
      }
    }
    return hashes;
  } catch (e) {
    return [];
  }
}
const conflictCache = new Map();
function clearConflictCache(characterName = null, gameId2 = gamesSettings.getActiveGameScopeId()) {
  if (!characterName) {
    conflictCache.clear();
    return;
  }
  const resolvedPath = charactersDirectories.resolveCharacterPath(characterName, gameId2);
  if (resolvedPath) {
    conflictCache.delete(resolvedPath);
    return;
  }
  const modsPath = gamesSettings.getModsPath();
  if (!modsPath) return;
  conflictCache.delete(path.join(modsPath, characterName));
}
function getConflictCacheSignature(charPath) {
  try {
    const modDirs = fs.readdirSync(charPath, {
      withFileTypes: true
    }).filter(d => d.isDirectory() && !d.name.startsWith("DISABLED_")).map(d => {
      const modPath = path.join(charPath, d.name);
      let mtimeMs = 0;
      try {
        mtimeMs = Math.floor(fs.statSync(modPath).mtimeMs || 0);
      } catch (_) {}
      return `${d.name}:${mtimeMs}`;
    }).sort((a, b) => a.localeCompare(b, "zh-CN"));
    return modDirs.join("|");
  } catch (_) {
    return "";
  }
}
function detectConflictsForCharacter(charPath) {
  const signature = getConflictCacheSignature(charPath);
  const cached = conflictCache.get(charPath);
  if (cached && cached.signature === signature) {
    return cached.conflicts;
  }
  const modDirs = fs.readdirSync(charPath, {
    withFileTypes: true
  }).filter(d => d.isDirectory() && !d.name.startsWith("DISABLED_"));
  const hashMap = new Map();
  for (const mod of modDirs) {
    const modPath = path.join(charPath, mod.name);
    const iniFiles = modsIniFiles.getIniFiles(modPath);
    for (const iniPath of iniFiles) {
      const hashes = extractHashesFromIni(iniPath);
      for (const hash of hashes) {
        if (!hashMap.has(hash)) {
          hashMap.set(hash, new Set());
        }
        hashMap.get(hash).add(mod.name);
      }
    }
  }
  const conflicts = [];
  for (const [hash, mods] of hashMap) {
    if (mods.size > 1) {
      conflicts.push({
        hash,
        mods: Array.from(mods)
      });
    }
  }
  conflictCache.set(charPath, {
    signature,
    conflicts
  });
  return conflicts;
}
function registerIpc() {
  electron.ipcMain.handle("detect-mod-conflicts", async (_, characterName) => {
    try {
      const modsPath = gamesSettings.getModsPath();
      const gameId2 = gamesSettings.getActiveGameScopeId();
      if (!modsPath || !fs.existsSync(modsPath)) {
        return {
          success: true,
          conflicts: []
        };
      }
      charactersOrganization.organizeLegacyCharacterFoldersIfNeeded(gameId2);
      if (characterName) {
        const resolvedEntry = charactersDirectories.resolveCharacterEntry(characterName, gameId2);
        if (!resolvedEntry?.characterRootPath || !fs.existsSync(resolvedEntry.characterRootPath)) {
          return {
            success: true,
            conflicts: []
          };
        }
        const conflicts = detectConflictsForCharacter(resolvedEntry.characterRootPath);
        return {
          success: true,
          conflicts,
          characterName: resolvedEntry.displayName
        };
      }
      const allConflicts = {};
      const characterEntries = charactersDirectories.listCharacterDirectories(modsPath, gameId2);
      for (const entry of characterEntries) {
        const conflicts = detectConflictsForCharacter(entry.characterRootPath);
        if (conflicts.length > 0) {
          allConflicts[entry.displayName] = conflicts;
        }
      }
      return {
        success: true,
        conflicts: allConflicts
      };
    } catch (error) {
      coreLogger.logger.error("detect-mod-conflicts error:", error);
      return {
        error: error.message
      };
    }
  });
}
