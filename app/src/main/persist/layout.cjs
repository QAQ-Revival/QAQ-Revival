"use strict";

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const coreLogger = require("../core/logger.cjs");
const preparedKeypressRoots = new Set();
const preparedPersistBridgeRoots = new Set();
const PERSIST_BRIDGE_STATE_FILE_REGEX = /^qaqm_state_.+\.ini$/i;
const PERSIST_ACTIVE_INCLUDE_FILE = "qaqm_persist_active.ini";
const QAQR_BRIDGE_DIR = "qaqm";
const QAQR_INCLUDER_FILE = "qaqm_includer.ini";
const QAQR_KEYPRESS_FILE = "qaqm_keypress.ini";
const PERSIST_BRIDGE_STATE_DIR = "cache";
const PERSIST_BRIDGE_SEED_FILES = [{
  filename: "qaqm_state_laevatain_2bfall.ini",
  content: ["namespace = QAQM\\Persist\\Laevatain2BFall", "", "[Constants]", "global persist $backSkirt = 0", "global persist $nudity = 0", "global persist $head = 0", "global persist $mask = 0", "global persist $panties = 0", "global persist $skirt = 0", ""].join("\n")
}];
function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function ensureIncludeEntry(content, sectionName, includeTarget) {
  const normalized = String(content || "").replace(/\r\n/g, "\n");
  const includePattern = new RegExp(`^\\s*include\\s*=\\s*${escapeRegExp(includeTarget)}\\s*$`, "im");
  if (includePattern.test(normalized)) {
    return normalized.endsWith("\n") ? normalized : `${normalized}
`;
  }
  const trimmed = normalized.replace(/\s+$/, "");
  const block = `[${sectionName}]
include = ${includeTarget}
`;
  return trimmed ? `${trimmed}

${block}` : block;
}
function getQaqmBridgeDir(root) {
  return path.join(root, QAQR_BRIDGE_DIR);
}
function ensureQaqmBridgeDir(root) {
  const bridgeDir = getQaqmBridgeDir(root);
  if (!fs.existsSync(bridgeDir)) {
    fs.mkdirSync(bridgeDir, {
      recursive: true
    });
  }
  return bridgeDir;
}
function getQaqmBridgeFilePath(root, fileName) {
  return path.join(getQaqmBridgeDir(root), fileName);
}
function getPersistBridgeStateDir(root) {
  return path.join(getQaqmBridgeDir(root), PERSIST_BRIDGE_STATE_DIR);
}
function ensurePersistBridgeStateDir(root) {
  const stateDir = getPersistBridgeStateDir(root);
  if (!fs.existsSync(stateDir)) {
    fs.mkdirSync(stateDir, {
      recursive: true
    });
  }
  return stateDir;
}
function extractPersistBridgeStateFileName(value) {
  const segments = String(value || "").replace(/[\/]+/g, "\\").split("\\").filter(Boolean);
  const fileName = segments.length > 0 ? segments[segments.length - 1] : "";
  return PERSIST_BRIDGE_STATE_FILE_REGEX.test(fileName) ? fileName : "";
}
function getPersistBridgeStateIncludeTarget(fileName) {
  const normalizedFileName = extractPersistBridgeStateFileName(fileName);
  if (!normalizedFileName) return "";
  return `${PERSIST_BRIDGE_STATE_DIR}\\${normalizedFileName}`;
}
function resolvePersistBridgeStatePath(root, fileName) {
  const normalizedFileName = extractPersistBridgeStateFileName(fileName);
  if (!root || !normalizedFileName) return "";
  return path.join(getPersistBridgeStateDir(root), normalizedFileName);
}
function migratePersistBridgeStateFile(sourcePath, targetPath) {
  if (!fs.existsSync(targetPath)) {
    fs.renameSync(sourcePath, targetPath);
    return;
  }
  const sourceContent = fs.readFileSync(sourcePath);
  const targetContent = fs.readFileSync(targetPath);
  if (!sourceContent.equals(targetContent)) {
    // A conflict must never silently discard either saved value set.
    const olderPath = fs.statSync(sourcePath).mtimeMs > fs.statSync(targetPath).mtimeMs ? targetPath : sourcePath;
    const olderContent = fs.readFileSync(olderPath);
    const stamp = crypto.createHash("sha256").update(olderContent).digest("hex").slice(0, 16);
    const backup = `${targetPath}.migration-${stamp}.bak`;
    if (!fs.existsSync(backup)) fs.writeFileSync(backup, olderContent);
    if (olderPath === targetPath) fs.writeFileSync(targetPath, sourceContent);
  }
  fs.unlinkSync(sourcePath);
}
function migratePersistBridgeStateFilesToCacheDir(root) {
  if (!root || !fs.existsSync(root)) return;
  const stateDir = ensurePersistBridgeStateDir(root);
  const rootEntries = fs.readdirSync(root, {
    withFileTypes: true
  });
  for (const entry of rootEntries) {
    if (!entry.isFile() || !PERSIST_BRIDGE_STATE_FILE_REGEX.test(entry.name)) continue;
    const sourcePath = path.join(root, entry.name);
    const targetPath = path.join(stateDir, entry.name);
    try {
      migratePersistBridgeStateFile(sourcePath, targetPath);
    } catch (e) {
      coreLogger.logger.warn(`Failed to migrate persist bridge state file ${entry.name}:`, e?.message || e);
    }
  }
}
function migrateQaqmBridgeFilesToBridgeDir(root) {
  if (!root || !fs.existsSync(root)) return;
  const bridgeDir = ensureQaqmBridgeDir(root);
  const legacyBridgeFiles = [QAQR_INCLUDER_FILE, QAQR_KEYPRESS_FILE, PERSIST_ACTIVE_INCLUDE_FILE];
  for (const fileName of legacyBridgeFiles) {
    const sourcePath = path.join(root, fileName);
    const targetPath = path.join(bridgeDir, fileName);
    if (!fs.existsSync(sourcePath)) continue;
    try {
      if (!fs.existsSync(targetPath)) {
        fs.renameSync(sourcePath, targetPath);
        continue;
      }
      const sourceContent = fs.readFileSync(sourcePath, "utf-8");
      const targetContent = fs.readFileSync(targetPath, "utf-8");
      if (sourceContent !== targetContent) {
        fs.writeFileSync(targetPath, sourceContent, "utf-8");
      }
      fs.unlinkSync(sourcePath);
    } catch (e) {
      coreLogger.logger.warn(`Failed to migrate QAQR bridge file ${fileName}:`, e?.message || e);
    }
  }
  const legacyCacheDir = path.join(root, "qaqm_cache");
  const nextCacheDir = getPersistBridgeStateDir(root);
  ensurePersistBridgeStateDir(root);
  if (fs.existsSync(legacyCacheDir) && legacyCacheDir !== nextCacheDir) {
    for (const entry of fs.readdirSync(legacyCacheDir, {
      withFileTypes: true
    })) {
      if (!entry.isFile() || !PERSIST_BRIDGE_STATE_FILE_REGEX.test(entry.name)) continue;
      const sourcePath = path.join(legacyCacheDir, entry.name);
      const targetPath = path.join(nextCacheDir, entry.name);
      try {
        migratePersistBridgeStateFile(sourcePath, targetPath);
      } catch (e) {
        coreLogger.logger.warn(`Failed to migrate QAQR cache file ${entry.name}:`, e?.message || e);
      }
    }
    try {
      if (fs.existsSync(legacyCacheDir) && fs.readdirSync(legacyCacheDir).length === 0) {
        fs.rmdirSync(legacyCacheDir);
      }
    } catch (_) {}
  }
}
function getStateBridgeIncludeSectionName(fileName) {
  return `IncludePersistBridge_${String(fileName || "").replace(/\.ini$/i, "").replace(/[^A-Za-z0-9]+/g, "_")}`;
}
function writeFileIfChanged(filePath, content) {
  const normalized = String(content || "").replace(/\r\n/g, "\n");
  if (fs.existsSync(filePath)) {
    try {
      const existing = fs.readFileSync(filePath, "utf-8").replace(/\r\n/g, "\n");
      if (existing === normalized) {
        return false;
      }
    } catch (_) {}
  }
  fs.writeFileSync(filePath, normalized, "utf-8");
  return true;
}
function ensureSeedPersistBridgeFiles(root) {
  const stateDir = ensurePersistBridgeStateDir(root);
  for (const bridgeFile of PERSIST_BRIDGE_SEED_FILES) {
    const bridgePath = path.join(stateDir, bridgeFile.filename);
    if (!fs.existsSync(bridgePath)) writeFileIfChanged(bridgePath, bridgeFile.content);
  }
}
function readPersistBridgeStateFilesFromInclude(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return [];
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.replace(/\r\n/g, "\n").split("\n");
    const stateFiles = [];
    for (const line of lines) {
      const match = line.match(/^\s*include\s*=\s*(.+?)\s*$/i);
      if (!match) continue;
      const fileName = extractPersistBridgeStateFileName(match[1]);
      if (!fileName) continue;
      if (!stateFiles.includes(fileName)) {
        stateFiles.push(fileName);
      }
    }
    return stateFiles;
  } catch (_) {
    return [];
  }
}
module.exports = {
  escapeRegExp,
  ensureIncludeEntry,
  getQaqmBridgeDir,
  ensureQaqmBridgeDir,
  getQaqmBridgeFilePath,
  getPersistBridgeStateDir,
  extractPersistBridgeStateFileName,
  getPersistBridgeStateIncludeTarget,
  resolvePersistBridgeStatePath,
  migratePersistBridgeStateFilesToCacheDir,
  migrateQaqmBridgeFilesToBridgeDir,
  getStateBridgeIncludeSectionName,
  writeFileIfChanged,
  readPersistBridgeStateFilesFromInclude,
  preparedKeypressRoots,
  preparedPersistBridgeRoots,
  PERSIST_BRIDGE_STATE_FILE_REGEX,
  PERSIST_ACTIVE_INCLUDE_FILE,
  QAQR_BRIDGE_DIR,
  QAQR_INCLUDER_FILE,
  QAQR_KEYPRESS_FILE
};
