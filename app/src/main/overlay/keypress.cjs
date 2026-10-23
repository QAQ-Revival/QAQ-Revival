"use strict";

module.exports = {
  ensureKeypressBridgeForActiveGame,
  setBackgroundKeypressEnabled,
  shouldEnableOverlayBackgroundKeypress
};
const path = require("path");
const fs = require("fs");
const configStore = require("../config/store.cjs");
const coreLogger = require("../core/logger.cjs");
const gamesEnvironment = require("../games/environment.cjs");
const overlayActivity = require("./activity.cjs");
const persistLayout = require("../persist/layout.cjs");
const persistMigration = require("../persist/migration.cjs");
const persistTracking = require("../persist/tracking.cjs");
async function ensureKeypressBridgeForActiveGame() {
  const env = gamesEnvironment.resolveActiveGameEnvRoot();
  if (!env) return;
  await overlayActivity.prepareOverlayActivity();
  const {
    root,
    d3dxPath
  } = env;
  persistMigration.ensurePersistBridgeMigrationForActiveGame(root);
  if (persistLayout.preparedKeypressRoots.has(root)) {
    const bridgeDir = persistLayout.getQaqmBridgeDir(root);
    const keypressFile = path.join(bridgeDir, persistLayout.QAQM_KEYPRESS_FILE);
    const includerFile = path.join(bridgeDir, persistLayout.QAQM_INCLUDER_FILE);
    const bridgeFilesExist = fs.existsSync(bridgeDir) && fs.existsSync(keypressFile) && fs.existsSync(includerFile);
    if (bridgeFilesExist) {
      let d3dxHasInclude = false;
      try {
        const d3dxContent = fs.readFileSync(d3dxPath, "utf-8");
        d3dxHasInclude = new RegExp(`^\\s*include\\s*=\\s*${persistLayout.escapeRegExp(persistLayout.QAQM_BRIDGE_DIR)}[/\\\\]${persistLayout.escapeRegExp(persistLayout.QAQM_INCLUDER_FILE)}\\s*$`, "im").test(d3dxContent);
      } catch (_) {
        d3dxHasInclude = true;
      }
      if (d3dxHasInclude) return;
      coreLogger.logger.info(`d3dx.ini lost qaqm include for ${root}, re-patching...`);
    } else {
      coreLogger.logger.info(`qaqm bridge files missing for ${root}, recreating...`);
    }
    persistLayout.preparedKeypressRoots.delete(root);
  }
  try {
    const keypressPath = persistLayout.getQaqmBridgeFilePath(root, persistLayout.QAQM_KEYPRESS_FILE);
    const includerPath = persistLayout.getQaqmBridgeFilePath(root, persistLayout.QAQM_INCLUDER_FILE);
    persistLayout.ensureQaqmBridgeDir(root);
    const keypressContent = "[System]\ncheck_foreground_window = 0\n";
    try {
      persistLayout.writeFileIfChanged(keypressPath, keypressContent);
      if (persistTracking.isPersistBridgeEnabled()) {
        persistTracking.rebuildActivePersistBridgeIncludes(root);
      }
      let existingIncluderContent = "";
      if (fs.existsSync(includerPath)) {
        try {
          existingIncluderContent = fs.readFileSync(includerPath, "utf-8");
        } catch (_) {}
      }
      let nextIncluderContent = persistLayout.ensureIncludeEntry(existingIncluderContent, "IncludeKeypress", persistLayout.QAQM_KEYPRESS_FILE);
      nextIncluderContent = persistLayout.ensureIncludeEntry(nextIncluderContent, "IncludePersistBridgeActive", persistLayout.PERSIST_ACTIVE_INCLUDE_FILE);
      if (existingIncluderContent.replace(/\r\n/g, "\n").trim() !== nextIncluderContent.trim()) {
        fs.writeFileSync(includerPath, nextIncluderContent, "utf-8");
      }
    } catch (e) {
      coreLogger.logger.warn("Failed to write keypress bridge ini files:", e?.message || e);
    }
    try {
      const original = fs.readFileSync(d3dxPath, "utf-8");
      let normalized = original.replace(/\r\n/g, "\n");
      const nextIncludeTarget = `${persistLayout.QAQM_BRIDGE_DIR}\\${persistLayout.QAQM_INCLUDER_FILE}`;
      const includeHeaderCount = (normalized.match(/^\[Include\]/gim) || []).length;
      if (includeHeaderCount > 1) {
        const backupPath = `${d3dxPath}.qaqmbak`;
        if (!fs.existsSync(backupPath)) {
          fs.copyFileSync(d3dxPath, backupPath);
        }
        const lines = normalized.split("\n");
        const sectionRanges = [];
        for (let i = 0; i < lines.length; i++) {
          if (/^\[Include\]\s*$/i.test(lines[i])) {
            let end = lines.length;
            for (let j = i + 1; j < lines.length; j++) {
              if (/^\[/.test(lines[j])) {
                end = j;
                break;
              }
            }
            sectionRanges.push({
              start: i,
              end
            });
          }
        }
        const uniqueIncludes = [];
        const seenIncludes = new Set();
        for (const {
          start,
          end
        } of sectionRanges) {
          for (let i = start + 1; i < end; i++) {
            const trimmed = lines[i].trim();
            if (/^include\s*=/i.test(trimmed)) {
              const key = trimmed.toLowerCase();
              if (!seenIncludes.has(key)) {
                seenIncludes.add(key);
                uniqueIncludes.push(trimmed);
              }
            }
          }
        }
        const removeSet = new Set();
        for (const {
          start,
          end
        } of sectionRanges) {
          for (let i = start; i < end; i++) removeSet.add(i);
        }
        const kept = lines.filter((_, i) => !removeSet.has(i));
        while (kept.length > 0 && kept[kept.length - 1].trim() === "") kept.pop();
        kept.push("", "[Include]", ...uniqueIncludes, "");
        normalized = kept.join("\n");
      }
      const alreadyPresent = new RegExp(`^\\s*include\\s*=\\s*${persistLayout.escapeRegExp(persistLayout.QAQM_BRIDGE_DIR)}[/\\\\]${persistLayout.escapeRegExp(persistLayout.QAQM_INCLUDER_FILE)}\\s*$`, "im").test(normalized);
      if (!alreadyPresent) {
        const backupPath = `${d3dxPath}.qaqmbak`;
        if (!fs.existsSync(backupPath)) {
          fs.copyFileSync(d3dxPath, backupPath);
        }
        const legacyReplaced = normalized.replace(/^(\s*include\s*=\s*)qaqm_includer\.ini(\s*)$/im, `$1${nextIncludeTarget}$2`);
        let next;
        if (legacyReplaced !== normalized) {
          next = legacyReplaced;
        } else if (/^\[Include\]/im.test(normalized)) {
          next = normalized.replace(/^(\[Include\])/im, `$1
include = ${nextIncludeTarget}`);
        } else {
          next = `${normalized.replace(/\s+$/, "")}

[Include]
include = ${nextIncludeTarget}
`;
        }
        fs.writeFileSync(d3dxPath, next, "utf-8");
      } else if (includeHeaderCount > 1) {
        fs.writeFileSync(d3dxPath, normalized, "utf-8");
      }
    } catch (e) {
      coreLogger.logger.warn("Failed to patch d3dx.ini for keypress bridge:", e?.message || e);
    }
    persistLayout.preparedKeypressRoots.add(root);
  } catch (e) {
    coreLogger.logger.warn("ensureKeypressBridgeForActiveGame error:", e?.message || e);
  }
}
function setBackgroundKeypressEnabled(enabled) {
  const env = gamesEnvironment.resolveActiveGameEnvRoot();
  if (!env) return;
  const {
    root
  } = env;
  const keypressPath = persistLayout.getQaqmBridgeFilePath(root, persistLayout.QAQM_KEYPRESS_FILE);
  try {
    // Window startup only updates this small option. Mod scanning and migration
    // remain in the explicit game-launch/import paths, before the loader starts.
    persistLayout.ensureQaqmBridgeDir(root);
    let content = "";
    if (fs.existsSync(keypressPath)) {
      content = fs.readFileSync(keypressPath, "utf-8");
    }
    let lines = content.split(/\r?\n/).filter(l => l.length > 0);
    if (lines.length === 0 || !/^\s*\[System\]/i.test(lines[0])) {
      lines = ["[System]", "check_foreground_window = 1"];
    }
    let hasSetting = false;
    lines = lines.map(line => {
      if (/^\s*check_foreground_window\s*=/.test(line)) {
        hasSetting = true;
        return `check_foreground_window = ${enabled ? 0 : 1}`;
      }
      return line;
    });
    if (!hasSetting) {
      lines.push(`check_foreground_window = ${enabled ? 0 : 1}`);
    }
    fs.writeFileSync(keypressPath, `${lines.join("\n")}
`, "utf-8");
  } catch (e) {
    coreLogger.logger.warn("Failed to toggle check_foreground_window in qaqm_keypress.ini:", e?.message || e);
  }
}
function shouldEnableOverlayBackgroundKeypress() {
  return !!configStore.currentConfig.overlayAutoReloadEnabled || !!configStore.currentConfig.overlayPresetAutoReloadEnabled;
}
