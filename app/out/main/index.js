"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
const electron = require("electron");
const path = require("path");
const fs = require("fs");
// Resolve the shared profile before taking its lock, including when launched directly.
const localProfile = process.env.QAQM_USER_DATA || path.join(electron.app.getPath("appData"), "QAQ-Revival");
fs.mkdirSync(localProfile, { recursive: true });
electron.app.setPath("userData", localProfile);
electron.app.setPath("sessionData", localProfile);
electron.app.setName("QAQ-Revival");
if (!electron.app.requestSingleInstanceLock()) {
  // quit() alone does not stop this module from initializing another window/services.
  electron.app.quit();
  return;
}
const { startRandomManager, launchRandomExecutable, getRandomLaunchSettings, readRandomLaunchSettings } = require("./random-executable.cjs");
let runtimeIdentity;
try {
  runtimeIdentity = startRandomManager(electron.app, { enabled: readRandomLaunchSettings(localProfile).manager });
  if (runtimeIdentity.relaunched) return;
  if (runtimeIdentity.name) electron.app.setName(runtimeIdentity.name);
} catch (error) {
  electron.dialog.showErrorBox("启动失败", `${error.message}\n请确认程序目录可写后重试。`);
  electron.app.exit(1);
  return;
}
electron.app.on("second-instance", () => {
  // Defer until the normal ready handler has created the main window.
  electron.app.whenReady().then(activateMainWindow);
});
const utils = require("@electron-toolkit/utils");
const overlayActivity = require('./overlay-activity.cjs').createActivityTracker();
const AdmZip = require("adm-zip");
const child_process = require("child_process");
const { createWindowsLauncher, getDirectLaunchMode } = require("./windows-launch.cjs");
const { createIndependentFixer } = require("./independent-fixer.cjs");
const { createCharacterCatalogService } = require("./character-catalog.cjs");
const { COVER_SCHEME, createCharacterImageCache } = require("./character-image-cache.cjs");
const { createCharacterSkinCatalogService } = require("./character-skin-catalog.cjs");
const { registerPawchiveIpc } = require("./pawchive.cjs");
const { registerRevivalIpc } = require("./mega-task-manager.cjs");
const { registerArchiveDownloads } = require("./archive-downloads.cjs");
const { registerSiteSessions } = require("./site-sessions.cjs");
const { createGameBananaService } = require("./gamebanana.cjs");
const { createSiteContent } = require("./site-content.cjs");
const { registerSoftwareUpdates } = require("./software-updates.cjs");
const { registerHotkeyTranslation } = require("./hotkey-translation.cjs");
const { createHiddenCharactersStore, applyDisablePlan } = require("./hidden-characters.cjs");
const { readWindowState, trackWindowState } = require("./window-state.cjs");
const { enableNativeFileDrop } = require("./native-file-drop.cjs");
const { migratePersistSettings } = require("./persist-settings.cjs");
const { createPersistManager } = require("./persist-manager.cjs");
const { readJsonFileSync, writeJsonFileSync } = require("./json-store.cjs");
registerHotkeyTranslation({ ipcMain: electron.ipcMain, fetch: (...args) => electron.net.fetch(...args) });
const windowsLauncher = createWindowsLauncher({ isElevated: isProcessElevated });
const crypto = require("crypto");
const pathTo7zip = require("7zip-bin");
const iconv = require("iconv-lite");
const node_crypto = require("node:crypto");
const fs$1 = require("node:fs");
const pawchiveService = registerPawchiveIpc({ ipcMain: electron.ipcMain, app: electron.app, BrowserWindow: electron.BrowserWindow, powerMonitor: electron.powerMonitor, userData: localProfile, fetch: (...args) => electron.net.fetch(...args) });
const kemonoService = registerPawchiveIpc({ source: 'kemono', ipcMain: electron.ipcMain, app: electron.app, BrowserWindow: electron.BrowserWindow, powerMonitor: electron.powerMonitor, userData: localProfile, fetch: (...args) => electron.net.fetch(...args) });
let archiveDownloadManager;
const siteSessions = registerSiteSessions({ ipcMain: electron.ipcMain, app: electron.app, session: electron.session,
  BrowserWindow: electron.BrowserWindow, BrowserView: electron.BrowserView, userData: localProfile,
  onDownload: payload => archiveDownloadManager?.adoptBrowserDownload(payload) || false });
const gamebananaService = createGameBananaService({ fetch: (...args) => siteSessions.fetch('gamebanana', ...args) });
const modSiteContent = createSiteContent({ sessions: siteSessions, gamebanana: gamebananaService });
for (const [channel, method] of [['list', 'list'], ['detail', 'getPost']]) {
  electron.ipcMain.handle('mod-sites:' + channel, async (_event, payload) => {
    try { return { success: true, ...await modSiteContent[method](payload) }; }
    catch (error) { return { success: false, error: error.message || '站点内容解析失败', code: error.code, verifyUrl: error.verifyUrl }; }
  });
}
for (const [channel, method] of [['list', 'list'], ['detail', 'getPost']]) {
  electron.ipcMain.handle('gamebanana:' + channel, async (_event, payload) => {
    try { return { success: true, ...await gamebananaService[method](payload) }; }
    catch (error) { return { success: false, error: error.message || '香蕉网请求失败' }; }
  });
}
registerRevivalIpc({ ipcMain: electron.ipcMain, app: electron.app, BrowserWindow: electron.BrowserWindow, shell: electron.shell, userData: localProfile, getCacheDir: ensureMarketDownloadCacheDir });
registerSoftwareUpdates({ ipcMain: electron.ipcMain, app: electron.app, BrowserWindow: electron.BrowserWindow, powerMonitor: electron.powerMonitor,
  shell: electron.shell, userData: localProfile, fetch: (...args) => electron.net.fetch(...args) });
const LOGS_DIR = path.join(electron.app.getPath("userData"), "logs");
if (!fs.existsSync(LOGS_DIR)) {
  try {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
    console.log(`[Logger] Created logs directory at: ${LOGS_DIR}`);
  } catch (e) {
    console.error("[Logger] Failed to create logs directory:", e);
  }
}
function getLogFileName() {
  const now = /* @__PURE__ */ new Date();
  const dateStr = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
  return `manager-${dateStr}.log`;
}
function formatMessage(level, message, ...args) {
  const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace("T", " ").split(".")[0];
  let formattedArgs = args.map((arg) => {
    if (arg instanceof Error) return arg.stack || arg.message;
    if (typeof arg === "object") return JSON.stringify(arg);
    return String(arg);
  }).join(" ");
  if (formattedArgs) {
    return `[${timestamp}] [${level}] ${message} ${formattedArgs}`;
  }
  return `[${timestamp}] [${level}] ${message}`;
}
function writeToFile(text) {
  try {
    const filePath = path.join(LOGS_DIR, getLogFileName());
    fs.appendFileSync(filePath, text + "\n", "utf8");
  } catch (e) {
    console.error("Write log failed:", e);
  }
}
const logger = {
  info(message, ...args) {
    const text = formatMessage("INFO", message, ...args);
    console.log(text);
    writeToFile(text);
  },
  error(message, ...args) {
    const text = formatMessage("ERROR", message, ...args);
    console.error(text);
    writeToFile(text);
  },
  warn(message, ...args) {
    const text = formatMessage("WARN", message, ...args);
    console.warn(text);
    writeToFile(text);
  },
  getLogsPath() {
    return LOGS_DIR;
  }
};
const QAQM_INI_BACKUP_MARKER = ".qaqm-inibak-";
const QAQM_INI_BACKUP_PATTERN = /\.qaqm-inibak-(\d{8}-\d{6}(?:-(?:\d{2}|\d{3}-[0-9a-f]{6}))?(?:-\d{2})?)$/i;
const WUWA_INDEPENDENT_BACKUP_PATTERN = /^(.*)_(\d{4}-\d{2}-\d{2} \d{2}-\d{2}-\d{2}(?:\.\d{3})?)\.BAK$/i;
const WUWA_INDEPENDENT_STAMP_PREFIX = "wuwa-independent:";
function qaqmStampSortKey(stamp) {
  const match = String(stamp || "").match(
    /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})(.*)$/i
  );
  if (!match) return String(stamp || "");
  return `${match[1]}-${match[2]}-${match[3]} ${match[4]}-${match[5]}-${match[6]}${match[7]}`;
}
function formatQaqmBackupStamp(stamp) {
  const match = String(stamp || "").match(
    /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})(?:-(\d{2})|-(\d{3})-[0-9a-f]{6})?(?:-\d{2})?$/i
  );
  if (!match) return String(stamp || "未知时间");
  const base = `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}:${match[6]}`;
  if (match[8]) return `${base}.${match[8]}`;
  if (match[7]) return `${base} · 第 ${Number(match[7]) + 1} 次`;
  return base;
}
function parseFixBackupFileName(fileName, { includeWuwaIndependent = false } = {}) {
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
    const match = String(backup.groupKey || "").match(
      /^(\d{4})-(\d{2})-(\d{2}) (\d{2})-(\d{2})$/
    );
    if (match) return `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]} · 独立修复器`;
  }
  return formatQaqmBackupStamp(backup?.stamp);
}
function normalizedOriginalPath(filePath) {
  const value = String(filePath || "");
  return process.platform === "win32" ? value.toLowerCase() : value;
}
function buildFixBackupRestorePlan(backups, selectedStamp) {
  const selected = backups.filter((backup) => backup.stamp === selectedStamp);
  if (selected.length === 0) return null;
  const format = selected[0].format;
  if (format !== "wuwa-independent") {
    return { format, restoreBackups: selected, cleanupBackups: selected };
  }
  const targetGroupKey = selected[0].groupKey;
  const cleanupBackups = backups.filter(
    (backup) => backup.format === format && backup.groupKey >= targetGroupKey
  );
  const earliestByFile = /* @__PURE__ */ new Map();
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
function normalizeDisplayPath(value) {
  const normalized = String(value || "").trim().replace(/\//g, "\\");
  if (!normalized) return "";
  if (/^[a-z]:\\+$/i.test(normalized)) return `${normalized.slice(0, 2)}\\`;
  return normalized.replace(/\\+$/, "");
}
function getWindowsPathLeaf(value) {
  const normalized = normalizeDisplayPath(value);
  if (!normalized || /^[a-z]:\\$/i.test(normalized)) return "";
  const index = normalized.lastIndexOf("\\");
  return index >= 0 ? normalized.slice(index + 1) : normalized;
}
function getWindowsParentPath(value) {
  const normalized = normalizeDisplayPath(value);
  if (!normalized || /^[a-z]:\\$/i.test(normalized)) return "";
  const index = normalized.lastIndexOf("\\");
  if (index < 0) return "";
  if (index === 2 && /^[a-z]:/i.test(normalized)) return normalized.slice(0, 3);
  return normalizeDisplayPath(normalized.slice(0, index));
}
function joinWindowsPath(baseDir, childName) {
  const base = normalizeDisplayPath(baseDir);
  const child = String(childName || "").trim().replace(/^[\\/]+|[\\/]+$/g, "");
  if (!base) return child;
  if (!child) return base;
  return `${base}${base.endsWith("\\") ? "" : "\\"}${child}`;
}
function resolveNamedInstallDirectory(baseDir, folderName) {
  const base = normalizeDisplayPath(baseDir);
  const folder = String(folderName).trim();
  if (!base || !folder) return "";
  return getWindowsPathLeaf(base).toLowerCase() === folder.toLowerCase() ? base : joinWindowsPath(base, folder);
}
function resolveXxmiRootFromLauncherPath(launcherPath) {
  const launcher = normalizeDisplayPath(launcherPath);
  if (getWindowsPathLeaf(launcher).toLowerCase() !== "xxmi launcher.exe") return "";
  const binDir = getWindowsParentPath(launcher);
  if (getWindowsPathLeaf(binDir).toLowerCase() !== "bin") return "";
  const resourcesDir = getWindowsParentPath(binDir);
  if (getWindowsPathLeaf(resourcesDir).toLowerCase() !== "resources") return "";
  return getWindowsParentPath(resourcesDir);
}
function resolveGamePackageInstallDirectory(baseDir, importerName) {
  const base = normalizeDisplayPath(baseDir);
  const importer = String(importerName || "").trim();
  if (!base || !importer) return "";
  const leaf = getWindowsPathLeaf(base).toLowerCase();
  if (leaf === importer.toLowerCase()) return base;
  if (leaf === "xxmi") {
    return joinWindowsPath(getWindowsParentPath(base), importer);
  }
  return joinWindowsPath(base, importer);
}
const MANAGED_INSTALL_CONTENT_TYPES = /* @__PURE__ */ new Set([
  "mod",
  "xxmi-update",
  "game-package-update",
  "fixer"
]);
const IMPORTER_GAME_IDS = Object.freeze({
  GIMI: "genshin-impact",
  EFMI: "endfield",
  ZZMI: "zzz",
  WWMI: "wuthering-waves",
  SRMI: "honkai-star-rail",
  NEMI: "neverness-to-everness"
});
function normalizeManagedInstallContentType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return MANAGED_INSTALL_CONTENT_TYPES.has(normalized) ? normalized : "mod";
}
function containsNameToken(value, token) {
  const escaped = String(token).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[\\s._-])${escaped}(?=$|[\\s._-])`, "i").test(value);
}
function inferManagedInstallFromName(sourcePath, activeGameId = "") {
  const fileName = path.basename(String(sourcePath || ""));
  const stem = fileName.replace(/\.(zip|rar|7z|exe)$/i, "");
  const fixerLike = /(^|[\s._-])fix(?:er|tool)?(?=$|[\s._-])/i.test(stem) || /修复(?:器|工具)?/i.test(stem);
  if (fixerLike) {
    return {
      contentType: "fixer",
      targetGameId: String(activeGameId || ""),
      importerName: ""
    };
  }
  if (containsNameToken(stem, "XXMI")) {
    return {
      contentType: "xxmi-update",
      targetGameId: String(activeGameId || ""),
      importerName: "XXMI"
    };
  }
  for (const [importerName, gameId] of Object.entries(IMPORTER_GAME_IDS)) {
    if (!containsNameToken(stem, importerName)) continue;
    return {
      contentType: "game-package-update",
      targetGameId: gameId,
      importerName
    };
  }
  return {
    contentType: "mod",
    targetGameId: String(activeGameId || ""),
    importerName: ""
  };
}
function deriveGamePackageRootFromModsPath(modsPath) {
  const value = String(modsPath || "").trim();
  if (!value) return null;
  const resolved = path.resolve(value);
  if (path.basename(resolved).toLowerCase() !== "mods") return null;
  const parent = path.dirname(resolved);
  return parent && parent !== resolved ? parent : null;
}
function deriveXxmiRootFromLoaderPath(loaderPath) {
  const value = String(loaderPath || "").trim();
  if (!value) return null;
  const resolved = path.resolve(value);
  let cursor = path.extname(resolved) ? path.dirname(resolved) : resolved;
  for (let depth = 0; depth < 8; depth += 1) {
    if (path.basename(cursor).toLowerCase() === "xxmi") return cursor;
    const relativeSegments = path.relative(cursor, resolved).split(path.sep).filter(Boolean).map((segment) => segment.toLowerCase());
    if (relativeSegments[0] === "resources" && relativeSegments[1] === "bin") return cursor;
    const parent = path.dirname(cursor);
    if (!parent || parent === cursor) break;
    cursor = parent;
  }
  return null;
}
function relativePathTouchesMods(relativePath) {
  return String(relativePath || "").replace(/\\/g, "/").split("/").filter(Boolean).some((segment) => segment.toLowerCase() === "mods");
}
const BUNDLED_GAME_IMPORTERS = Object.freeze(["WWMI", "ZZMI", "EFMI", "SRMI", "GIMI"]);
function escapeRegExp$1(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function normalizeVersionPart(part) {
  const normalized = String(part || "0").replace(/^0+(?=\d)/, "");
  return normalized || "0";
}
function compareBundledPackageVersions(a, b) {
  const aParts = String(a || "").replace(/^v/i, "").split(".").map(normalizeVersionPart);
  const bParts = String(b || "").replace(/^v/i, "").split(".").map(normalizeVersionPart);
  const count = Math.max(aParts.length, bParts.length);
  for (let index = 0; index < count; index += 1) {
    const aPart = aParts[index] || "0";
    const bPart = bParts[index] || "0";
    if (aPart.length !== bPart.length) return aPart.length > bPart.length ? 1 : -1;
    if (aPart !== bPart) return aPart > bPart ? 1 : -1;
  }
  return 0;
}
function parseBundledAutoinstallPackage(fileName, packageName) {
  const file = String(fileName || "");
  const name = String(packageName || "").trim();
  if (!file || file !== file.trim() || !name) return null;
  const pattern = new RegExp(`^${escapeRegExp$1(name)}(?:-v?(\\d+(?:\\.\\d+)*))?\\.zip$`, "i");
  const match = pattern.exec(file);
  if (!match) return null;
  return {
    file,
    packageName: name,
    version: match[1] || null
  };
}
function compareCandidateFileNames(a, b) {
  const aLower = a.file.toLowerCase();
  const bLower = b.file.toLowerCase();
  if (aLower !== bLower) return aLower < bLower ? -1 : 1;
  if (a.file === b.file) return 0;
  return a.file < b.file ? -1 : 1;
}
function resolveBundledAutoinstallPackage(files, packageName) {
  const candidates = (Array.isArray(files) ? files : []).map((file) => parseBundledAutoinstallPackage(file, packageName)).filter(Boolean);
  candidates.sort((a, b) => {
    if (a.version && !b.version) return -1;
    if (!a.version && b.version) return 1;
    if (a.version && b.version) {
      const versionOrder = compareBundledPackageVersions(a.version, b.version);
      if (versionOrder !== 0) return -versionOrder;
    }
    return compareCandidateFileNames(a, b);
  });
  return candidates[0] || null;
}
function listBundledAutoinstallFiles(directory) {
  if (!directory || !fs$1.existsSync(directory)) return [];
  return fs$1.readdirSync(directory, { withFileTypes: true }).filter((entry) => entry.isFile() && /\.zip$/i.test(entry.name)).map((entry) => entry.name);
}
function resolveBundledGamePackage(files, importerName) {
  const importer = String(importerName || "").trim().toUpperCase();
  if (!BUNDLED_GAME_IMPORTERS.includes(importer)) return null;
  const candidates = [importer, `${importer}-PACKAGE`].map(name => resolveBundledAutoinstallPackage(files, name)).filter(Boolean);
  candidates.sort((a, b) => compareBundledPackageVersions(b.version, a.version) || compareCandidateFileNames(a, b));
  const selected = candidates[0];
  return selected ? { ...selected, importer } : null;
}
const ACCESS_DENIED_CODES = /* @__PURE__ */ new Set([
  "LOGIN_REQUIRED",
  "SESSION_EXPIRED",
  "ACCOUNT_NOT_ELIGIBLE",
  "MARKET_ACCESS_DENIED",
  "WEB_GAME_HIDDEN"
]);
function normalizeMarketAccessPayload(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const controlled = value.controlled === true;
  const allowed = value.allowed !== false;
  const code = String(value.code || (allowed ? "UNRESTRICTED" : "MARKET_ACCESS_DENIED")).trim().toUpperCase();
  return {
    controlled,
    allowed,
    code,
    clearExisting: value.clearExisting === true
  };
}
function isMarketRefreshBlocked(value) {
  const access = normalizeMarketAccessPayload(value);
  return Boolean(
    access && !access.allowed && (access.controlled || access.clearExisting || ACCESS_DENIED_CODES.has(access.code))
  );
}
function shouldPreserveMarketSnapshotOnEmptyResult(result, currentMods = []) {
  if (!Array.isArray(currentMods) || currentMods.length === 0) return false;
  if (result?.wasIncremental === true) return false;
  if (!Array.isArray(result?.mods)) return true;
  if (result.mods.length > 0) return false;
  return result?.marketAccess?.allowed !== true;
}
function preserveBlockedMarketSnapshot(cache, { marketAccess, authScope = "", accessCheckedAt = (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  const current = cache && typeof cache === "object" && !Array.isArray(cache) ? cache : {};
  return {
    ...current,
    marketAccess: normalizeMarketAccessPayload(marketAccess),
    authScope: String(authScope || ""),
    accessCheckedAt
  };
}
function createLatestRequestTracker() {
  let nextId = 0;
  const latestByKey = /* @__PURE__ */ new Map();
  return {
    begin(key) {
      const normalizedKey = String(key || "default");
      const ticket = { key: normalizedKey, id: ++nextId };
      latestByKey.set(normalizedKey, ticket.id);
      return ticket;
    },
    isCurrent(ticket) {
      return Boolean(ticket && latestByKey.get(ticket.key) === ticket.id);
    },
    invalidate(key) {
      const normalizedKey = String(key || "default");
      latestByKey.set(normalizedKey, ++nextId);
    },
    invalidateAll() {
      nextId += 1;
      latestByKey.clear();
    }
  };
}
function collectErrorDetails(error, code = "") {
  if (typeof error === "string") return `${code} ${error}`.trim();
  return [
    code,
    error?.code,
    error?.name,
    error?.message,
    error?.cause?.code,
    error?.cause?.name,
    error?.cause?.message
  ].filter(Boolean).join(" ");
}
function isNetworkDownloadFailure(error, code = "") {
  const details = collectErrorDetails(error, code);
  return String(code || error?.code || "").toUpperCase() === "NETWORK_FETCH_FAILED" || /fetch failed|network|socket|terminated|ECONNRESET|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|UND_ERR|ERR_/i.test(
    details
  );
}
const RETIRED_DIRECT_FALLBACK_HOST$1 = "direct.qaqm.top";
const QAQM_HTTPS_HOSTS = /* @__PURE__ */ new Set(["qaqm.top", "www.qaqm.top", RETIRED_DIRECT_FALLBACK_HOST$1]);
function normalizeAuthUrl(value) {
  const raw = String(value || "").trim().replace(/\/+$/, "");
  if (!raw) return "";
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(candidate);
    const host = parsed.hostname.toLowerCase();
    if (host === RETIRED_DIRECT_FALLBACK_HOST$1) return "https://qaqm.top";
    const path2 = parsed.pathname.replace(/\/+$/, "");
    return `${parsed.protocol.toLowerCase()}//${parsed.host.toLowerCase()}${path2 === "/" ? "" : path2}`;
  } catch {
    return "";
  }
}
function isSecureMarketAuthUrl(value) {
  const normalized = normalizeAuthUrl(value);
  if (!normalized) return false;
  try {
    return new URL(normalized).protocol === "https:";
  } catch {
    return false;
  }
}
function areSameMarketAuthService(leftValue, rightValue) {
  const left = normalizeAuthUrl(leftValue);
  const right = normalizeAuthUrl(rightValue);
  if (!left || !right) return false;
  if (left === right) return true;
  try {
    const leftUrl = new URL(left);
    const rightUrl = new URL(right);
    return leftUrl.protocol === "https:" && rightUrl.protocol === "https:" && QAQM_HTTPS_HOSTS.has(leftUrl.hostname) && QAQM_HTTPS_HOSTS.has(rightUrl.hostname);
  } catch {
    return false;
  }
}
function resolveMarketAuthToken({ authToken, authServerUrl, targetServerUrl } = {}) {
  const token = String(authToken || "").trim();
  if (!token || !isSecureMarketAuthUrl(targetServerUrl)) return "";
  return areSameMarketAuthService(authServerUrl, targetServerUrl) ? token : "";
}
function createMarketAuthScope(authToken) {
  const token = String(authToken || "").trim();
  if (!token) return "anonymous";
  return `token:${node_crypto.createHash("sha256").update(token, "utf8").digest("hex").slice(0, 24)}`;
}
function buildLocalPublishKey(modFolder, gameId2, characterName, modName) {
  const identity = [
    String(gameId2 || "").trim().toLowerCase(),
    String(characterName || "").trim(),
    String(modName || "").trim(),
    String(path.resolve(modFolder || "")).replace(/\\/g, "/").toLowerCase()
  ].join("|");
  const digest = crypto.createHash("sha256").update(identity, "utf8").digest("hex").slice(0, 24);
  return `local-client:${gameId2 || "endfield"}:${digest}`;
}
function get7zaPath() {
  return pathTo7zip.path7za.replace("app.asar" + path.sep, "app.asar.unpacked" + path.sep);
}
function decodeZipEntryName(entry) {
  if (!entry) return "";
  const raw = entry.rawEntryName;
  const fallback = entry.entryName || "";
  if (!raw || !Buffer.isBuffer(raw)) return fallback;
  let hasHighByte = false;
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] >= 128) {
      hasHighByte = true;
      break;
    }
  }
  if (!hasHighByte) return fallback;
  const flags = entry.header && typeof entry.header.flags === "number" ? entry.header.flags : 0;
  if (flags & 2048) return fallback;
  try {
    const gbk = iconv.decode(raw, "gbk");
    if (gbk && !gbk.includes("�")) return gbk;
  } catch (_) {
  }
  return fallback;
}
function extractZipEntryWithCjkSupport(entry, targetDir) {
  if (!entry) return null;
  const decoded = decodeZipEntryName(entry);
  if (!decoded) return null;
  const normalized = decoded.replace(/\\/g, "/").replace(/\/+/g, "/");
  const segments = normalized.split("/").filter((seg) => seg && seg !== "." && seg !== "..");
  if (segments.length === 0) return null;
  const outPath = path.join(targetDir, ...segments);
  const resolvedTarget = path.resolve(targetDir);
  const resolvedOut = path.resolve(outPath);
  if (resolvedOut !== resolvedTarget && !resolvedOut.startsWith(resolvedTarget + path.sep)) {
    return null;
  }
  if (entry.isDirectory) {
    fs.mkdirSync(outPath, { recursive: true });
  } else {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    const data = entry.getData();
    fs.writeFileSync(outPath, data);
  }
  return { outPath, displayName: normalized };
}
function isProcessElevated() {
  if (process.platform !== "win32") return false;
  try {
    child_process.execFileSync("fltmc.exe", [], { stdio: "ignore", timeout: 1500, windowsHide: true });
    return true;
  } catch (_) {
    return false;
  }
}
function mergeCharacterDirectoryStats(primaryStats, secondaryStats) {
  return {
    modCount: Number(primaryStats?.modCount || 0) + Number(secondaryStats?.modCount || 0),
    enabledCount: Number(primaryStats?.enabledCount || 0),
    fileCount: Number(primaryStats?.fileCount || 0) + Number(secondaryStats?.fileCount || 0),
    hasInfoJson: !!primaryStats?.hasInfoJson || !!secondaryStats?.hasInfoJson
  };
}
function isWindowsProtectedPath(targetPath) {
  if (process.platform !== "win32" || !targetPath) return false;
  const normalized = path.resolve(targetPath).toLowerCase();
  const protectedRoots = [
    process.env.ProgramFiles,
    process.env["ProgramFiles(x86)"],
    process.env.ProgramW6432,
    process.env.SystemRoot
  ].filter(Boolean).map((item) => path.resolve(item).toLowerCase());
  return protectedRoots.some(
    (root) => normalized === root || normalized.startsWith(root + path.sep)
  );
}
function formatWindowsFileOperationError(error, context = {}) {
  const message = String(error?.message || error || "");
  const code = error?.code || "";
  const syscall = error?.syscall || context.operation || "";
  const targetPath = error?.path || context.path || "";
  const protectedPath = isWindowsProtectedPath(targetPath);
  const targetSuffix = targetPath ? `
目标路径：${targetPath}` : "";
  if (["EPERM", "EACCES"].includes(code) || /operation not permitted|permission denied/i.test(message)) {
    const advice = protectedPath ? "该路径位于 Program Files/Windows 等受保护目录，普通权限通常不能写入。建议把游戏或 Mod/加载器安装到非系统目录（如 D:\\Games、D:\\QAQMods），或用管理员权限运行管理器后重试。" : "当前路径没有写入权限，或目标文件正被游戏、启动器、杀毒软件/安全软件占用。请关闭游戏/加载器/资源管理器预览窗口后重试，必要时以管理员权限运行管理器。";
    return `文件写入被 Windows 拒绝（${code || "权限不足"}，${syscall || "文件操作"}）。${advice}${targetSuffix}`;
  }
  if (code === "EBUSY" || /resource busy|locked|being used by another process/i.test(message)) {
    return `文件正在被其它程序占用，暂时无法写入或覆盖。请关闭游戏、启动器、解压软件、资源管理器预览窗口，等待几秒后重试。${targetSuffix}`;
  }
  if (code === "EXDEV") {
    return `源路径和目标路径位于不同磁盘，直接移动失败；管理器会尽量改用复制后校验的方式处理。如仍失败，请确认目标磁盘空间充足并可写。${targetSuffix}`;
  }
  return message;
}
function isZipChecksumError(error) {
  const message = String(error?.message || error || "");
  return /crc32 checksum failed|checksum failed|invalid checksum|corrupt|unexpected end|invalid zip/i.test(
    message
  );
}
function getFileSizeLabel(filePath) {
  try {
    const size = fs.statSync(filePath).size;
    if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
    if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${size} B`;
  } catch (_) {
    return "无法读取";
  }
}
function getFileSha256(filePath) {
  try {
    return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").toUpperCase();
  } catch (_) {
    return "无法计算";
  }
}
function formatAutoinstallArchiveError(error, archivePath, packageLabel, context = {}) {
  const detail = formatWindowsFileOperationError(error, {
    path: context.path || archivePath,
    operation: context.operation || "extract-archive"
  });
  if (!isZipChecksumError(error)) return detail;
  return [
    `${packageLabel}安装包校验失败，内置压缩包可能已损坏、下载不完整，或被安全软件拦截/隔离了部分文件。`,
    `安装包：${archivePath}`,
    `大小：${getFileSizeLabel(archivePath)}`,
    `SHA256：${getFileSha256(archivePath)}`,
    "请从发布页重新下载完整安装包，校验文件完整性后再试。"
  ].join("\n");
}
function probeWritableDirectory(targetDir, label = "目标目录") {
  if (!targetDir) throw new Error(`${label}为空，无法写入`);
  try {
    fs.mkdirSync(targetDir, { recursive: true });
    const probePath = path.join(targetDir, `.qaqm-write-test-${process.pid}-${Date.now()}`);
    fs.writeFileSync(probePath, "ok");
    fs.unlinkSync(probePath);
  } catch (error) {
    throw new Error(
      `${label}不可写：${formatWindowsFileOperationError(error, { path: targetDir, operation: "write-test" })}`
    );
  }
}
function resolveNamedAutoinstallDir(baseDir, folderName) {
  const resolvedDir = resolveNamedInstallDirectory(baseDir, folderName);
  return resolvedDir ? path.resolve(resolvedDir) : "";
}
function resolveGamePackageAutoinstallDir(baseDir, importerName) {
  const resolvedDir = resolveGamePackageInstallDirectory(baseDir, importerName);
  return resolvedDir ? path.resolve(resolvedDir) : "";
}
function buildXxmiLauncherMissingAdvice(expectedLauncherExe) {
  return [
    "XXMI 启动器安装不完整，未找到 XXMI Launcher.exe。",
    `请打开对应文件夹检查是否存在：${expectedLauncherExe}`,
    "如果文件不存在，请通过 XXMI 官方安装程序重新安装，并在游戏设置 → 路径与启动中选择启动器。"
  ].join("\n");
}
function buildGamePackageMissingAdvice(importerName, expectedModsDir) {
  return [
    `${importerName} 游戏包安装不完整，未找到 Mods 文件夹。`,
    `请打开对应文件夹检查是否存在：${expectedModsDir}`,
    "如果文件夹不存在，请在 XXMI 中安装对应游戏的加载组件，再到游戏设置 → 路径与启动选择 Mods 文件夹。"
  ].join("\n");
}
function buildMissingXxmiLauncherLaunchError(importerName, configuredPath) {
  const label = importerName || "XXMI";
  if (!configuredPath) {
    return [
      `启动失败：${label} 启动所需的 XXMI Launcher.exe 路径还没有设置。`,
      "请到游戏设置 → 路径与启动，选择该游戏的 XXMI Launcher.exe。",
      "标准位置通常是：你选择的安装总目录\\XXMI\\Resources\\Bin\\XXMI Launcher.exe。",
      "如果尚未安装 XXMI，请先通过 XXMI 官方安装程序安装。"
    ].join("\n");
  }
  return [
    `启动失败：没有在已设置路径找到 XXMI Launcher.exe。`,
    `当前路径：${configuredPath}`,
    "请到游戏设置 → 路径与启动，点击“打开位置”检查文件是否存在。",
    "如果文件已移动，请重新选择路径；如果文件丢失，请通过 XXMI 官方安装程序修复。"
  ].join("\n");
}
async function movePathToRecycleBin(targetPath, context = "delete") {
  if (!targetPath || !fs.existsSync(targetPath)) {
    return { success: true, skipped: true, path: targetPath || "" };
  }
  const resolvedPath = path.resolve(targetPath);
  try {
    await electron.shell.trashItem(resolvedPath);
    logger.info(`[RecycleBin] ${context}: ${resolvedPath}`);
    return { success: true, recycled: true, path: resolvedPath };
  } catch (error) {
    throw new Error(
      `${context} failed to move to Recycle Bin: ${formatWindowsFileOperationError(error, {
        path: resolvedPath,
        operation: "trash"
      })}`
    );
  }
}
let mainWindowRef = null;
const CONFIG_PATH = path.join(electron.app.getPath("userData"), "config.json");
const MOD_CACHE_PATH = path.join(electron.app.getPath("userData"), "mod-market-cache.json");
const LEGACY_MOD_CACHE_PATH = MOD_CACHE_PATH;
const MARKET_DOWNLOAD_SETTINGS_PATH = path.join(electron.app.getPath("userData"), "market-download-settings.json");
const SKIN_CONFIG_PATH = path.join(electron.app.getPath("userData"), "skin-config.json");
const BUILTIN_GAMES = [
  {
    id: "genshin-impact",
    name: "原神",
    shortName: "原神",
    description: "原神国服与国际服的独立 Mod 配置，使用 XXMI / GIMI 加载。",
    imageFile: "原神.png",
    defaultLaunchMode: "GIMI",
    supportedLaunchModes: ["GIMI", "XXMI"],
    modLoaderLabel: "XXMI / GIMI 启动器",
    executableHint: "YuanShen.exe / GenshinImpact.exe",
    marketGameId: "genshin-impact"
  },
  {
    id: "endfield",
    name: "明日方舟终末地",
    shortName: "终末地",
    description: "Hypergryph 的 3D 工业科幻 RPG Mod 环境。",
    imageFile: "明日方舟终末地.png",
    defaultLaunchMode: "EFMI",
    supportedLaunchModes: ["EFMI", "XXMI"],
    modLoaderLabel: "XXMI / EFMI 启动器",
    executableHint: "Endfield.exe",
    marketGameId: "endfield"
  },
  {
    id: "zzz",
    name: "绝区零",
    shortName: "绝区零",
    description: "米哈游都市动作游戏的独立 Mod 配置。",
    imageFile: "绝区零.png",
    defaultLaunchMode: "ZZMI",
    supportedLaunchModes: ["ZZMI", "XXMI"],
    modLoaderLabel: "XXMI / ZZMI 启动器",
    executableHint: "ZenlessZoneZero.exe",
    marketGameId: "zzz"
  },
  {
    id: "wuthering-waves",
    name: "鸣潮",
    shortName: "鸣潮",
    description: "库洛开放世界动作游戏的独立 Mod 配置。",
    imageFile: "鸣潮.png",
    defaultLaunchMode: "WWMI",
    supportedLaunchModes: ["WWMI", "XXMI"],
    modLoaderLabel: "XXMI / WWMI 启动器",
    executableHint: "Wuthering Waves.exe",
    marketGameId: "wuthering-waves"
  },
  {
    id: "neverness-to-everness",
    name: "异环",
    shortName: "异环",
    description: "Hotta Studio 超自然都市开放世界 RPG 的独立 Mod 配置。",
    imageFile: "异环.webp",
    defaultLaunchMode: "NEMI",
    supportedLaunchModes: ["NEMI", "DX12"],
    modLoaderLabel: "NEMI / 3DMigoto 加载器",
    executableHint: "NTELauncher.exe",
    defaultLaunchArgs: "-dx11",
    marketGameId: "neverness-to-everness"
  },
  {
    id: "honkai-star-rail",
    name: "崩坏：星穹铁道",
    shortName: "星穹铁道",
    description: "米哈游银河冒险 RPG 的独立 Mod 配置。",
    imageFile: "崩坏星穹铁道.png",
    defaultLaunchMode: "SRMI",
    supportedLaunchModes: ["SRMI", "XXMI"],
    modLoaderLabel: "XXMI / SRMI 启动器",
    executableHint: "StarRail.exe",
    marketGameId: "honkai-star-rail"
  }
];
const BUILTIN_GAME_MAP = new Map(BUILTIN_GAMES.map((game) => [game.id, game]));
function resolveBundledHelperPath(fileNames) {
  const names = Array.isArray(fileNames) ? fileNames : [fileNames];
  const candidates = [];
  for (const fileName of names.filter(Boolean)) {
    candidates.push(
      path.join(process.resourcesPath || "", fileName),
      path.join(electron.app.getAppPath(), "resources", fileName),
      path.join(path.dirname(electron.app.getAppPath()), fileName)
    );
  }
  for (const candidate of candidates.filter(Boolean)) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch (_) {
    }
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
const DEFAULT_SERVER_URL = "https://qaqm.top";
const BARE_FALLBACK_SERVER_URL = "http://129.211.14.231:18080";
const RETIRED_DIRECT_FALLBACK_HOST = "direct.qaqm.top";
const QAQM_REQUEST_ATTEMPT_TIMEOUT_MS = 8e3;
const LEGACY_DIRECT_SERVER_URL = "http://129.211.14.231:3000";
const LEGACY_DIRECT_HOSTS = /* @__PURE__ */ new Set(["129.211.14.231"]);
const FALLBACK_SHARED_SECRET = "qaqm-fallback-129.211.14.231-18080-v1";
function isBareFallbackServerUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    return url.protocol === "http:" && url.hostname === "129.211.14.231" && url.port === "18080";
  } catch (_) {
    return false;
  }
}
function getQaqmServerCandidates(value, options = {}) {
  const secureOnly = options?.secureOnly === true;
  const seen = /* @__PURE__ */ new Set();
  const candidates = [];
  const push = (url) => {
    let normalized = String(url || "").trim().replace(/\/+$/, "");
    try {
      if (new URL(normalized).hostname === RETIRED_DIRECT_FALLBACK_HOST) {
        normalized = DEFAULT_SERVER_URL;
      }
    } catch (_) {
    }
    if (!normalized || seen.has(normalized)) return;
    if (secureOnly && !isSecureMarketAuthUrl(normalized)) return;
    seen.add(normalized);
    candidates.push(normalized);
  };
  push(value);
  push(DEFAULT_SERVER_URL);
  push(BARE_FALLBACK_SERVER_URL);
  return candidates;
}
function encryptFallbackJsonBody(rawBody) {
  const key = crypto.createHash("sha256").update(FALLBACK_SHARED_SECRET).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(String(rawBody || "{}"), "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    _qaqmFallback: {
      v: 1,
      iv: iv.toString("base64"),
      data: Buffer.concat([encrypted, authTag]).toString("base64")
    }
  };
}
function signFallbackRequest({ method, path: requestPath, payload }) {
  const ts = String(Date.now());
  const nonce = crypto.randomBytes(16).toString("base64url");
  const cleanPath = String(requestPath || "").split("?")[0];
  const signature = crypto.createHmac("sha256", FALLBACK_SHARED_SECRET).update(`${ts}.${nonce}.${String(method).toUpperCase()}.${cleanPath}.${payload || ""}`).digest("hex");
  return { ts, nonce, signature };
}
function prepareFallbackJsonRequest(baseUrl, requestPath, options = {}) {
  if (!isBareFallbackServerUrl(baseUrl)) return options;
  const next = { ...options || {} };
  const headers = { ...next.headers || {} };
  let payloadForSignature = "";
  const contentType = String(headers["Content-Type"] || headers["content-type"] || "").toLowerCase();
  if (next.body && contentType.includes("application/json")) {
    const encrypted = encryptFallbackJsonBody(next.body);
    next.body = JSON.stringify(encrypted);
    payloadForSignature = encrypted._qaqmFallback.data;
    headers["Content-Type"] = "application/json";
  }
  const signed = signFallbackRequest({ method: next.method || "GET", path: requestPath, payload: payloadForSignature });
  headers["x-qaqm-fallback-ts"] = signed.ts;
  headers["x-qaqm-fallback-nonce"] = signed.nonce;
  headers["x-qaqm-fallback-signature"] = signed.signature;
  next.headers = headers;
  return next;
}
function isJsonLikeResponse(response) {
  const contentType = String(response?.headers?.get?.("content-type") || "").toLowerCase();
  return contentType.includes("application/json") || contentType.includes("+json");
}
function createTimedFetchOptions(options = {}, timeoutMs = QAQM_REQUEST_ATTEMPT_TIMEOUT_MS) {
  const requestOptions = { ...options || {} };
  const parentSignal = requestOptions.signal;
  if (!timeoutMs && !parentSignal) {
    return { options: requestOptions, cleanup: () => {
    }, timedOut: () => false };
  }
  const controller = new AbortController();
  let didTimeout = false;
  let timer = null;
  const abortFromParent = () => controller.abort();
  if (parentSignal) {
    if (parentSignal.aborted) {
      controller.abort();
    } else {
      parentSignal.addEventListener("abort", abortFromParent, { once: true });
    }
  }
  if (timeoutMs > 0) {
    timer = setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, timeoutMs);
  }
  requestOptions.signal = controller.signal;
  return {
    options: requestOptions,
    cleanup: () => {
      if (timer) clearTimeout(timer);
      if (parentSignal) parentSignal.removeEventListener("abort", abortFromParent);
    },
    timedOut: () => didTimeout
  };
}
async function fetchWithElectronNet(url, requestOptions = {}) {
  if (electron.net && typeof electron.net.fetch === "function") {
    try {
      return await electron.net.fetch(url, requestOptions);
    } catch (error) {
      if (error?.name === "AbortError") throw error;
    }
  }
  return fetch(url, requestOptions);
}
async function fetchQaqmWithFallback(serverUrl, requestPath, options = {}) {
  const {
    expectJson = false,
    secureOnly = false,
    authenticationBound = false,
    headersForCandidate = null,
    isCurrent = null,
    ...fetchOptions
  } = options || {};
  const staticHeaders = fetchOptions.headers;
  const hasAuthorizationHeader = typeof staticHeaders?.has === "function" ? staticHeaders.has("Authorization") || staticHeaders.has("authorization") : Object.keys(staticHeaders || {}).some(
    (key) => String(key).toLowerCase() === "authorization"
  );
  const requestRequiresHttps = secureOnly || hasAuthorizationHeader || /^\/api\/auth(?:\/|$)/i.test(String(requestPath || ""));
  let lastError = null;
  const authenticationBoundRequest = authenticationBound || hasAuthorizationHeader || /^\/api\/auth(?:\/|$)/i.test(String(requestPath || ""));
  const candidates = getQaqmServerCandidates(serverUrl, {
    secureOnly: requestRequiresHttps
  }).filter(
    (candidate) => !authenticationBoundRequest || areSameMarketAuthService(serverUrl, candidate)
  );
  for (let i = 0; i < candidates.length; i++) {
    if (isCurrent && !await isCurrent()) throw new Error("市场请求已停止");
    const candidate = candidates[i];
    try {
      console.log(`[QAQM Fallback][main] 尝试请求: ${candidate}${requestPath}`);
      const requestOptions = { ...fetchOptions };
      if (typeof headersForCandidate === "function") {
        requestOptions.headers = headersForCandidate(candidate, fetchOptions.headers || {});
      }
      if (expectJson) {
        const headers = { ...requestOptions.headers || {} };
        if (!headers.Accept && !headers.accept) headers.Accept = "application/json";
        requestOptions.headers = headers;
      }
      const timed = createTimedFetchOptions(requestOptions);
      const prepared = prepareFallbackJsonRequest(candidate, requestPath, timed.options);
      const response = await fetchWithElectronNet(`${candidate}${requestPath}`, prepared).finally(
        timed.cleanup
      );
      if (response.status >= 500 && candidate !== BARE_FALLBACK_SERVER_URL) {
        lastError = new Error(`服务器返回错误: ${response.status}`);
        console.warn(`[QAQM Fallback][main] ${candidate} 返回 ${response.status}，切换下一个候选`);
        continue;
      }
      if (expectJson && !isJsonLikeResponse(response) && candidate !== BARE_FALLBACK_SERVER_URL) {
        lastError = new Error(`服务器返回非 JSON 响应: ${response.status}`);
        console.warn(`[QAQM Fallback][main] ${candidate} 返回非 JSON 响应，切换下一个候选`);
        continue;
      }
      console.log(`[QAQM Fallback][main] 命中请求服务器: ${candidate}`);
      return { response, serverUrl: candidate, usedFallback: i > 0 };
    } catch (error) {
      if (fetchOptions.signal?.aborted) throw error;
      lastError = error?.name === "AbortError" ? new Error("请求超时") : error;
      console.warn(`[QAQM Fallback][main] ${candidate} 请求失败: ${error?.message || error}`);
    }
  }
  throw lastError || new Error("所有候选服务器均不可达");
}
function normalizeServerUrlInput(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(candidate);
    const host = parsed.hostname.toLowerCase();
    const path2 = parsed.pathname.replace(/\/+$/, "");
    const isKnownQaqmHost = host === "qaqm.top" || host === "www.qaqm.top";
    if (isKnownQaqmHost) {
      return DEFAULT_SERVER_URL;
    }
    return `${parsed.protocol}//${parsed.host}${path2 === "/" ? "" : path2}`.replace(/\/+$/, "");
  } catch {
    return raw.replace(/\/+$/, "");
  }
}
function normalizePersistedServerUrlInput(value) {
  const normalized = normalizeServerUrlInput(value);
  if (!normalized) return "";
  try {
    const parsed = new URL(normalized);
    const host = parsed.hostname.toLowerCase();
    const origin = `${parsed.protocol}//${parsed.host}`.replace(/\/+$/, "");
    const isDirectFallbackHost = host === RETIRED_DIRECT_FALLBACK_HOST || LEGACY_DIRECT_HOSTS.has(host) || origin === LEGACY_DIRECT_SERVER_URL;
    return isDirectFallbackHost ? DEFAULT_SERVER_URL : normalized;
  } catch {
    return normalized;
  }
}
function normalizeDeveloperServerUrlInput(value) {
  return normalizeServerUrlInput(value) || DEFAULT_SERVER_URL;
}
const BASE_DEFAULT_CONFIG = {
  modsPath: "",
  gamePath: "",
  loaderPath: "",
  efmiPath: "",
  xxmiPath: "",
  serverUrl: DEFAULT_SERVER_URL,
  characterUsage: {},
  // Map of characterName -> timestamp
  pinnedMods: {},
  characterSectionsByGame: {},
  characterSkinCatalogIdentityByGame: {},
  activeSkinId: null,
  // Currently active skin ID
  // Multi-game support
  games: [],
  // Array of game configs
  activeGameId: null,
  // Currently selected game ID
  // Close behavior: 'ask' | 'minimize' | 'quit'
  closeBehavior: "ask",
  uiZoom: 1,
  modMarketCardSize: 100,
  modDownloadImageRatio: "4:3",
  compatibilityMode: false,
  compatibilityLevel: 0,
  overlayAutoReloadEnabled: true,
  overlayPresetAutoReloadEnabled: true,
  overlayClickableHotkeysEnabled: true,
  overlayHotkey: "Alt+F",
  overlayWindowScale: 1,
  persistBridgeEnabled: false,
  persistBridgeTracking: {}
};
function createDefaultConfig() {
  return {
    ...BASE_DEFAULT_CONFIG,
    ...getAutoOverlayCommandDefaults()
  };
}
const CONFIG_BAK_PATH = CONFIG_PATH + ".bak";
const CONFIG_TMP_PATH = CONFIG_PATH + ".tmp";
function applyConfigFieldDefaults(parsed, defaults) {
  const normalizedServerUrl = normalizePersistedServerUrlInput(parsed.serverUrl);
  if (!normalizedServerUrl) {
    delete parsed.serverUrl;
  } else {
    parsed.serverUrl = normalizedServerUrl;
  }
  if (!parsed.overlayAutoReloadCommand || !parsed.overlayAutoReloadCommand.trim()) {
    parsed.overlayAutoReloadCommand = defaults.overlayAutoReloadCommand;
  } else if (isManagedOverlayHelperCommand(parsed.overlayAutoReloadCommand, "press_f10")) {
    parsed.overlayAutoReloadCommand = defaults.overlayAutoReloadCommand;
  }
  if (!parsed.overlayHotkeyCommandTemplate || !parsed.overlayHotkeyCommandTemplate.trim()) {
    parsed.overlayHotkeyCommandTemplate = defaults.overlayHotkeyCommandTemplate;
  } else if (isManagedOverlayHelperCommand(parsed.overlayHotkeyCommandTemplate, "press_hotkey")) {
    parsed.overlayHotkeyCommandTemplate = defaults.overlayHotkeyCommandTemplate;
  }
  return parsed;
}
function tryReadConfigFile(filePath) {
  if (fs.existsSync(filePath + ".copying")) {
    try { return readJsonFileSync(filePath); } catch (_) { return null; }
  }
  try {
    if (!fs.existsSync(filePath)) return null;
    const data = fs.readFileSync(filePath, "utf-8");
    if (!data || !data.trim()) return null;
    return JSON.parse(data);
  } catch (e) {
    console.error(`Failed to parse config at ${filePath}:`, e?.message || e);
    return null;
  }
}
function quarantineCorruptConfig(filePath) {
  try {
    if (!fs.existsSync(filePath)) return;
    const ts = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
    const dest = `${filePath}.corrupt-${ts}`;
    fs.copyFileSync(filePath, dest);
    console.warn(`[Config] Quarantined corrupt config to ${dest}`);
  } catch (_) {
  }
}
function loadConfig() {
  const defaults = createDefaultConfig();
  const primary = tryReadConfigFile(CONFIG_PATH);
  if (primary && typeof primary === "object" && !Array.isArray(primary)) {
    return { ...defaults, ...applyConfigFieldDefaults(primary, defaults) };
  }
  if (fs.existsSync(CONFIG_PATH)) {
    quarantineCorruptConfig(CONFIG_PATH);
  }
  const backup = tryReadConfigFile(CONFIG_BAK_PATH);
  if (backup && typeof backup === "object" && !Array.isArray(backup)) {
    console.warn("[Config] Primary config unreadable, recovered from .bak");
    try {
      fs.copyFileSync(CONFIG_BAK_PATH, CONFIG_PATH);
    } catch (_) {
    }
    return { ...defaults, ...applyConfigFieldDefaults(backup, defaults) };
  }
  return defaults;
}
function saveConfig(config) {
  try {
    const payload = JSON.stringify(config, null, 2);
    const fd = fs.openSync(CONFIG_TMP_PATH, "w");
    try {
      fs.writeSync(fd, payload, 0, "utf-8");
      try {
        fs.fsyncSync(fd);
      } catch (_) {
      }
    } finally {
      fs.closeSync(fd);
    }
    if (fs.existsSync(CONFIG_PATH)) {
      try {
        const current = fs.readFileSync(CONFIG_PATH, "utf-8");
        JSON.parse(current);
        fs.copyFileSync(CONFIG_PATH, CONFIG_BAK_PATH);
      } catch (_) {
      }
    }
    try {
      fs.renameSync(CONFIG_TMP_PATH, CONFIG_PATH);
    } catch (error) {
      if (error.code !== "EXDEV") throw error;
      writeJsonFileSync(CONFIG_PATH, config);
    }
    return true;
  } catch (e) {
    console.error("Failed to save config:", e);
    try {
      if (fs.existsSync(CONFIG_TMP_PATH)) fs.unlinkSync(CONFIG_TMP_PATH);
    } catch (_) {
    }
    return false;
  }
}
function migrateFromV3() {
  const v4UserData = electron.app.getPath("userData");
  const v3UserData = path.join(path.dirname(v4UserData), "modmanager");
  const v3ConfigPath = path.join(v3UserData, "config.json");
  const v4ConfigPath = CONFIG_PATH;
  const migrationFlag = path.join(v4UserData, ".v3-migrated");
  if (fs.existsSync(migrationFlag)) return;
  if (!fs.existsSync(v3ConfigPath)) return;
  if (fs.existsSync(v4ConfigPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(v4ConfigPath, "utf-8"));
      if (existing.modsPath && existing.modsPath.trim() !== "") {
        fs.writeFileSync(migrationFlag, (/* @__PURE__ */ new Date()).toISOString());
        return;
      }
    } catch (e) {
    }
  }
  console.log("[Migration] Detected v3 data, migrating to v4...");
  try {
    const v3Config = fs.readFileSync(v3ConfigPath, "utf-8");
    fs.writeFileSync(v4ConfigPath, v3Config);
    console.log("[Migration] config.json migrated");
    const filesToCopy = [
      "presets.json",
      "hotkeys.json",
      "skin-config.json",
      "mod-market-cache.json"
    ];
    for (const file of filesToCopy) {
      const src = path.join(v3UserData, file);
      const dst = path.join(v4UserData, file);
      if (fs.existsSync(src) && !fs.existsSync(dst)) {
        fs.copyFileSync(src, dst);
        console.log(`[Migration] ${file} migrated`);
      }
    }
    const v3Images = path.join(v3UserData, "images");
    const v4Images = path.join(v4UserData, "images");
    if (fs.existsSync(v3Images)) {
      if (!fs.existsSync(v4Images)) fs.mkdirSync(v4Images, { recursive: true });
      const imageFiles = fs.readdirSync(v3Images);
      for (const file of imageFiles) {
        const src = path.join(v3Images, file);
        const dst = path.join(v4Images, file);
        if (!fs.existsSync(dst) && fs.statSync(src).isFile()) {
          fs.copyFileSync(src, dst);
        }
      }
      console.log(`[Migration] images/ migrated (${imageFiles.length} files)`);
    }
    const v3Bg = path.join(v3UserData, "cloud-backgrounds");
    const v4Bg = path.join(v4UserData, "cloud-backgrounds");
    if (fs.existsSync(v3Bg)) {
      if (!fs.existsSync(v4Bg)) fs.mkdirSync(v4Bg, { recursive: true });
      const bgFiles = fs.readdirSync(v3Bg);
      for (const file of bgFiles) {
        const src = path.join(v3Bg, file);
        const dst = path.join(v4Bg, file);
        if (!fs.existsSync(dst) && fs.statSync(src).isFile()) {
          fs.copyFileSync(src, dst);
        }
      }
      console.log(`[Migration] cloud-backgrounds/ migrated`);
    }
    fs.writeFileSync(migrationFlag, (/* @__PURE__ */ new Date()).toISOString());
    console.log("[Migration] V3 → V4 migration complete!");
  } catch (e) {
    console.error("[Migration] Error during migration:", e);
    try {
      fs.writeFileSync(migrationFlag, `error: ${e.message}`);
    } catch (_) {
    }
  }
}
migrateFromV3();
let currentConfig = loadConfig();
if (currentConfig.persistBridgeSettingsVersion !== 1 && fs.existsSync(CONFIG_PATH)) {
  const migrationBackup = CONFIG_PATH + ".before-per-game-persist.bak";
  if (!fs.existsSync(migrationBackup)) fs.copyFileSync(CONFIG_PATH, migrationBackup);
}
const hiddenCharacters = createHiddenCharactersStore({
  read: () => currentConfig.hiddenCharactersByGame,
  write: (next) => {
    const previous = currentConfig.hiddenCharactersByGame;
    currentConfig.hiddenCharactersByGame = next;
    if (!saveConfig(currentConfig)) {
      currentConfig.hiddenCharactersByGame = previous;
      throw new Error("隐藏角色设置保存失败，请检查磁盘空间和写入权限");
    }
  },
  normalize: normalizeCharacterFolderKey
});
function isCharacterHidden(name, gameId = getActiveGameScopeId()) {
  return hiddenCharacters.has(gameId, getCharacterMappingEntry(name, gameId)?.displayName || name);
}
function assertCharacterVisible(name, gameId = getActiveGameScopeId()) {
  if (isCharacterHidden(name, gameId)) throw new Error("该角色已隐藏，请先在「隐藏角色」中恢复显示");
}
// Keep a stable local identity for anonymous market comments and favorites.
if (!currentConfig.clientId) {
  currentConfig.clientId = crypto.randomUUID();
  saveConfig(currentConfig);
}
const DEV_MODE_PASSWORD_HASH = "b37eaacb1b884cad8748dccce485af6fb41d105a68813ab25a1c225aa87e0752";
const DEV_KIT_DIR_NAME = "QAQManagerDevKit";
let devModeSessionUnlocked = false;
function uniqueExistingStrings(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim()))];
}
function readDevKitConfig(rootPath) {
  const configPath = path.join(rootPath, "devkit.json");
  if (!fs.existsSync(configPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf-8")) || {};
  } catch {
    return {};
  }
}
function getDevKitCandidates() {
  const exeDir = path.dirname(process.execPath || "");
  const appPath = electron.app.getAppPath();
  const appDir = fs.existsSync(appPath) && fs.statSync(appPath).isDirectory() ? appPath : path.dirname(appPath);
  const cwd = process.cwd();
  return uniqueExistingStrings([
    currentConfig.developerKitPath,
    process.env.QAQM_DEVKIT_PATH,
    path.join(exeDir, DEV_KIT_DIR_NAME),
    path.join(path.dirname(exeDir), DEV_KIT_DIR_NAME),
    path.join(appDir, DEV_KIT_DIR_NAME),
    path.join(path.dirname(appDir), DEV_KIT_DIR_NAME),
    path.join(cwd, DEV_KIT_DIR_NAME),
    path.join(path.dirname(cwd), DEV_KIT_DIR_NAME)
  ]);
}
function resolveDevKitScript(rootPath, config, keys, fallbackNames) {
  for (const key of keys) {
    const value = config[key];
    if (!value) continue;
    const resolved = path.isAbsolute(value) ? value : path.join(rootPath, value);
    if (fs.existsSync(resolved)) return resolved;
  }
  for (const name of fallbackNames) {
    const resolved = path.join(rootPath, name);
    if (fs.existsSync(resolved)) return resolved;
  }
  return "";
}
function resolveDevKitPath(rootPath, config, keys) {
  for (const key of keys) {
    const value = config[key];
    if (!value) continue;
    return path.isAbsolute(value) ? value : path.join(rootPath, value);
  }
  return "";
}
function getDevKitStatus() {
  for (const rootPath of getDevKitCandidates()) {
    try {
      if (!fs.existsSync(rootPath)) continue;
      const config = readDevKitConfig(rootPath);
      const publishScriptPath = resolveDevKitScript(
        rootPath,
        config,
        ["publishScriptPath", "scriptPath"],
        ["publish_mod_cli.py", path.join("scripts", "publish_mod_cli.py"), path.join("pachong_gamebanana", "publish_mod_cli.py")]
      );
      const batchScriptPath = resolveDevKitScript(
        rootPath,
        config,
        ["batchScriptPath"],
        ["batch_cloud_ops.py", path.join("scripts", "batch_cloud_ops.py"), path.join("pachong_gamebanana", "batch_cloud_ops.py")]
      );
      const fixDir = config.fixDir ? path.isAbsolute(config.fixDir) ? config.fixDir : path.join(rootPath, config.fixDir) : path.join(rootPath, "fix");
      const serverRootPath = resolveDevKitPath(rootPath, config, ["serverRootPath", "serverRoot", "serverPath"]);
      const markerPath = path.join(rootPath, "devkit.json");
      const available = fs.existsSync(markerPath) || !!publishScriptPath || !!batchScriptPath || fs.existsSync(fixDir);
      if (!available) continue;
      return {
        success: true,
        available: true,
        unlocked: devModeSessionUnlocked,
        rootPath,
        config,
        publishScriptPath,
        batchScriptPath,
        fixDir: fs.existsSync(fixDir) ? fixDir : "",
        serverRootPath: serverRootPath && fs.existsSync(serverRootPath) ? serverRootPath : ""
      };
    } catch (_) {
    }
  }
  return {
    success: true,
    available: false,
    unlocked: false,
    candidates: getDevKitCandidates()
  };
}
function getDefaultDevPublishConfig() {
  const status = getDevKitStatus();
  const cfg = status.config || {};
  return {
    pythonPath: cfg.pythonPath || "python",
    winrarPath: cfg.winrarPath || "C:\\Program Files\\WinRAR\\WinRAR.exe",
    scriptPath: status.publishScriptPath || cfg.scriptPath || ""
  };
}
function normalizeDevPublishConfig(config = {}) {
  const status = getDevKitStatus();
  const defaults = getDefaultDevPublishConfig();
  const saved = config || {};
  return {
    ...defaults,
    ...saved,
    scriptPath: status.publishScriptPath || defaults.scriptPath || ""
  };
}
function requireDevKitUnlocked() {
  const status = getDevKitStatus();
  if (!status.available) {
    return { success: false, error: `未找到外部开发者包，请将 ${DEV_KIT_DIR_NAME} 放到管理器安装目录旁或设置 QAQM_DEVKIT_PATH` };
  }
  if (!devModeSessionUnlocked) return { success: false, error: "开发者模式未解锁" };
  return { success: true, status };
}
function isProtectedDeveloperIpc(channel) {
  if (channel === "dev:get-devkit-status" || channel === "dev:unlock" || channel === "dev:lock") return false;
  return channel.startsWith("dev:") || channel.startsWith("mark:") || channel === "export-marked-mods";
}
const originalIpcHandle = electron.ipcMain.handle.bind(electron.ipcMain);
electron.ipcMain.handle = (channel, listener) => originalIpcHandle(channel, async (...args) => {
  if (isProtectedDeveloperIpc(channel)) {
    const gate = requireDevKitUnlocked();
    if (!gate.success) return gate;
  }
  return listener(...args);
});
electron.ipcMain.handle("dev:get-devkit-status", async () => getDevKitStatus());
electron.ipcMain.handle("dev:unlock", async (_, password) => {
  const status = getDevKitStatus();
  if (!status.available) {
    return { success: false, error: `未找到外部开发者包：${DEV_KIT_DIR_NAME}` };
  }
  const hashHex = crypto.createHash("sha256").update(String(password || ""), "utf8").digest("hex");
  if (hashHex !== DEV_MODE_PASSWORD_HASH) return { success: false, error: "密码错误" };
  devModeSessionUnlocked = true;
  return { success: true, status: getDevKitStatus(), config: getDefaultDevPublishConfig() };
});
electron.ipcMain.handle("dev:lock", async () => {
  devModeSessionUnlocked = false;
  return { success: true };
});
function normalizeCompatibilityLevel(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(3, Math.max(0, Math.round(number)));
}
function getCompatibilityLevel() {
  if (currentConfig.compatibilityLevel !== void 0) {
    return normalizeCompatibilityLevel(currentConfig.compatibilityLevel);
  }
  return currentConfig.compatibilityMode ? 3 : 0;
}
function isCompatibilityModeEnabled() {
  return getCompatibilityLevel() > 0;
}
function isStrongCompatibilityModeEnabled() {
  return getCompatibilityLevel() >= 3;
}
function getBuiltInGameDefinition(gameId2) {
  return BUILTIN_GAME_MAP.get(gameId2) || null;
}
function getBuiltInGameImagePath(fileName) {
  const candidates = [
    path.join(electron.app.getAppPath(), "resources", "pics", "games", fileName),
    path.join(process.resourcesPath || "", "pics", "games", fileName)
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch (_) {
    }
  }
  return null;
}
function getImageDataUrl(filePath) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return null;
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp"
    }[ext] || "image/png";
    return `data:${mimeType};base64,${fs.readFileSync(filePath).toString("base64")}`;
  } catch (_) {
    return null;
  }
}
function createBuiltInGameConfig(definition, overrides = {}) {
  return {
    id: definition.id,
    name: definition.name,
    shortName: definition.shortName,
    description: definition.description,
    gamePath: "",
    modLoaderPath: "",
    dx12LauncherPath: "",
    modFolderPath: "",
    launchMode: definition.defaultLaunchMode,
    supportedLaunchModes: definition.supportedLaunchModes || ["XXMI"],
    launchArgs: definition.defaultLaunchArgs || "",
    icon: definition.imageFile,
    marketGameId: definition.marketGameId,
    isBuiltIn: true,
    ...overrides
  };
}
function ensureBuiltInGamesConfigured() {
  let changed = false;
  if (!Array.isArray(currentConfig.games)) {
    currentConfig.games = [];
    changed = true;
  }
  const legacyEndfieldOverrides = {
    modFolderPath: currentConfig.modsPath || "",
    gamePath: currentConfig.gamePath || "",
    modLoaderPath: currentConfig.xxmiPath || currentConfig.efmiPath || currentConfig.loaderPath || ""
  };
  for (const definition of BUILTIN_GAMES) {
    let game = currentConfig.games.find(
      (item) => item.id === definition.id || item.name === definition.name
    );
    if (!game) {
      game = createBuiltInGameConfig(
        definition,
        definition.id === "endfield" ? legacyEndfieldOverrides : {}
      );
      currentConfig.games.push(game);
      changed = true;
      continue;
    }
    const normalizedGame = createBuiltInGameConfig(definition, game);
    const keys = Object.keys(normalizedGame);
    for (const key of keys) {
      if (game[key] !== normalizedGame[key]) {
        game[key] = normalizedGame[key];
        changed = true;
      }
    }
    const expectedSupportedLaunchModes = definition.supportedLaunchModes || ["XXMI"];
    if (JSON.stringify(game.supportedLaunchModes || []) !== JSON.stringify(expectedSupportedLaunchModes)) {
      game.supportedLaunchModes = [...expectedSupportedLaunchModes];
      changed = true;
    }
    if (game.launchMode && !expectedSupportedLaunchModes.includes(game.launchMode)) {
      game.launchMode = definition.defaultLaunchMode;
      changed = true;
    }
    if (definition.defaultLaunchArgs && !String(game.launchArgs || "").trim()) {
      game.launchArgs = definition.defaultLaunchArgs;
      changed = true;
    }
    if (game.dx12LauncherPath === void 0) {
      game.dx12LauncherPath = "";
      changed = true;
    }
    if (game.nevernessDx12DisabledModsDir === void 0) {
      game.nevernessDx12DisabledModsDir = "";
      changed = true;
    }
    if (game.icon !== definition.imageFile && !getBuiltInGameImagePath(game.icon || "")) {
      game.icon = definition.imageFile;
      changed = true;
    }
    if (definition.id === "endfield") {
      if (!game.modFolderPath && legacyEndfieldOverrides.modFolderPath) {
        game.modFolderPath = legacyEndfieldOverrides.modFolderPath;
        changed = true;
      }
      if (!game.gamePath && legacyEndfieldOverrides.gamePath) {
        game.gamePath = legacyEndfieldOverrides.gamePath;
        changed = true;
      }
      if (!game.modLoaderPath && legacyEndfieldOverrides.modLoaderPath) {
        game.modLoaderPath = legacyEndfieldOverrides.modLoaderPath;
        changed = true;
      }
    }
  }
  if (migratePersistSettings(currentConfig)) changed = true;
  const validIds = new Set(currentConfig.games.map((game) => game.id));
  if (!currentConfig.activeGameId || !validIds.has(currentConfig.activeGameId)) {
    currentConfig.activeGameId = "endfield";
    changed = true;
  }
  if (changed) {
    saveConfig(currentConfig);
  }
}
function serializeGameForRenderer(game) {
  const definition = getBuiltInGameDefinition(game.id);
  const iconPath = getBuiltInGameImagePath(game.icon || "") || getBuiltInGameImagePath(definition?.imageFile || "");
  return {
    ...game,
    description: game.description || definition?.description || "",
    shortName: game.shortName || definition?.shortName || game.name,
    marketGameId: game.marketGameId || definition?.marketGameId || game.id,
    supportedLaunchModes: definition?.supportedLaunchModes || game.supportedLaunchModes || ["XXMI"],
    modLoaderLabel: definition?.modLoaderLabel || "Mod 加载器",
    executableHint: definition?.executableHint || "游戏程序",
    coverUrl: getImageDataUrl(iconPath)
  };
}
function getResolvedGamePaths(gameId2 = getActiveGameScopeId()) {
  const targetGame = getGameById(gameId2);
  if (targetGame) {
    const allowLegacyFallback = targetGame.id === "endfield";
    return {
      activeGame: targetGame,
      modsPath: targetGame.modFolderPath || (allowLegacyFallback ? currentConfig.modsPath || "" : ""),
      gamePath: targetGame.gamePath || (allowLegacyFallback ? currentConfig.gamePath || "" : ""),
      modLoaderPath: targetGame.modLoaderPath || (allowLegacyFallback ? currentConfig.xxmiPath || currentConfig.efmiPath || currentConfig.loaderPath || "" : "")
    };
  }
  const activeGame = getActiveGame();
  if (String(gameId2 || "").trim() && activeGame?.id && activeGame.id !== gameId2) {
    return { activeGame: null, modsPath: "", gamePath: "", modLoaderPath: "" };
  }
  return {
    activeGame,
    modsPath: currentConfig.modsPath || "",
    gamePath: currentConfig.gamePath || "",
    modLoaderPath: currentConfig.xxmiPath || currentConfig.efmiPath || currentConfig.loaderPath || ""
  };
}
function getSettingsGame(gameId) {
  const game = gameId === undefined ? getActiveGame() : getGameById(gameId);
  if (!game) throw new Error("游戏配置不存在，请重新选择游戏");
  return game;
}
function updateActiveGameConfig(updates, gameId) {
  const activeGame = gameId === undefined ? getActiveGame() : getSettingsGame(gameId);
  if (activeGame) {
    Object.entries(updates || {}).forEach(([key, value]) => {
      activeGame[key] = value;
    });
    if (activeGame.id === "endfield") {
      if (updates.modFolderPath !== void 0) currentConfig.modsPath = updates.modFolderPath;
      if (updates.gamePath !== void 0) currentConfig.gamePath = updates.gamePath;
      if (updates.modLoaderPath !== void 0) {
        currentConfig.xxmiPath = updates.modLoaderPath;
        currentConfig.efmiPath = updates.modLoaderPath;
        currentConfig.loaderPath = updates.modLoaderPath;
      }
    }
    saveConfig(currentConfig);
    notifyGamesChanged();
    return activeGame;
  }
  if (updates.modFolderPath !== void 0) currentConfig.modsPath = updates.modFolderPath;
  if (updates.gamePath !== void 0) currentConfig.gamePath = updates.gamePath;
  if (updates.modLoaderPath !== void 0) {
    currentConfig.xxmiPath = updates.modLoaderPath;
    currentConfig.efmiPath = updates.modLoaderPath;
    currentConfig.loaderPath = updates.modLoaderPath;
  }
  saveConfig(currentConfig);
  notifyGamesChanged();
  return null;
}
const KNOWN_IMPORTER_MODS_DIRS = ["WWMI", "SRMI", "ZZMI", "EFMI", "GIMI", "NEMI", "XXMI"];
function normalizeResolvedPathKey(targetPath) {
  const resolved = path.resolve(targetPath || "");
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}
function isExistingDirectory(targetPath) {
  try {
    return !!targetPath && fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory();
  } catch (_) {
    return false;
  }
}
function isModsFolderName(folderName) {
  return String(folderName || "").toLowerCase() === "mods";
}
function getPreferredImporterNamesForGame(gameId2 = getActiveGameScopeId()) {
  const definition = getBuiltInGameDefinition(gameId2);
  const preferred = [];
  const add = (name) => {
    if (!name || !KNOWN_IMPORTER_MODS_DIRS.includes(name) || preferred.includes(name)) return;
    preferred.push(name);
  };
  add(definition?.defaultLaunchMode);
  (definition?.supportedLaunchModes || []).forEach(add);
  KNOWN_IMPORTER_MODS_DIRS.forEach(add);
  return preferred;
}
function addModsFolderCandidate(candidates, candidatePath, rank, label) {
  if (!isExistingDirectory(candidatePath) || !isModsFolderName(path.basename(candidatePath))) return;
  const resolvedPath = path.resolve(candidatePath);
  const key = normalizeResolvedPathKey(resolvedPath);
  const existing = candidates.get(key);
  if (!existing || rank < existing.rank) {
    candidates.set(key, { path: resolvedPath, rank, label });
  }
}
function resolveSelectedModsFolder(selectedPath, { gameId: gameId2 = getActiveGameScopeId() } = {}) {
  if (!isExistingDirectory(selectedPath)) {
    return { ok: false, error: "请选择一个已经存在的文件夹。" };
  }
  const basePath = path.resolve(selectedPath);
  const candidates = /* @__PURE__ */ new Map();
  let current = basePath;
  for (let depth = 0; depth < 6; depth++) {
    addModsFolderCandidate(candidates, current, depth, depth === 0 ? "当前文件夹" : "上级 Mods 文件夹");
    const parent2 = path.dirname(current);
    if (!parent2 || parent2 === current) break;
    current = parent2;
  }
  addModsFolderCandidate(candidates, path.join(basePath, "Mods"), 20, "子级 Mods 文件夹");
  const preferredImporters = getPreferredImporterNamesForGame(gameId2);
  preferredImporters.forEach((importerName, index) => {
    const rank = index === 0 ? 30 : 40 + index;
    addModsFolderCandidate(
      candidates,
      path.join(basePath, importerName, "Mods"),
      rank,
      `${importerName} Mods 文件夹`
    );
  });
  try {
    const entries = fs.readdirSync(basePath, { withFileTypes: true });
    entries.filter((entry) => entry.isDirectory()).forEach((entry) => {
      const importerIndex = preferredImporters.indexOf(entry.name);
      const rank = importerIndex >= 0 ? 40 + importerIndex : 80;
      addModsFolderCandidate(
        candidates,
        path.join(basePath, entry.name, "Mods"),
        rank,
        `${entry.name} Mods 文件夹`
      );
      preferredImporters.forEach((importerName, index) => {
        addModsFolderCandidate(
          candidates,
          path.join(basePath, entry.name, importerName, "Mods"),
          120 + index,
          `${entry.name}\\${importerName} Mods 文件夹`
        );
      });
    });
  } catch (_) {
  }
  let parent = path.dirname(basePath);
  for (let level = 0; level < 2; level++) {
    if (!parent || parent === basePath) break;
    addModsFolderCandidate(candidates, path.join(parent, "Mods"), 90 + level * 20, "同级 Mods 文件夹");
    preferredImporters.forEach((importerName, index) => {
      addModsFolderCandidate(
        candidates,
        path.join(parent, importerName, "Mods"),
        100 + level * 20 + index,
        `${importerName} Mods 文件夹`
      );
    });
    const nextParent = path.dirname(parent);
    if (!nextParent || nextParent === parent) break;
    parent = nextParent;
  }
  const sortedCandidates = Array.from(candidates.values()).sort((left, right) => {
    if (left.rank !== right.rank) return left.rank - right.rank;
    return left.path.length - right.path.length;
  });
  if (sortedCandidates.length === 0) {
    return {
      ok: false,
      error: "没有找到真正的 Mods 文件夹。请选择 Mods 本身，或者选择包含 GIMI/WWMI/SRMI/ZZMI/EFMI/NEMI\\Mods 的上级目录。"
    };
  }
  const best = sortedCandidates[0];
  const tied = sortedCandidates.filter((candidate) => candidate.rank === best.rank);
  if (tied.length > 1) {
    return {
      ok: false,
      error: "检测到多个可用的 Mods 文件夹，请直接选择要使用的那个 Mods 文件夹。",
      candidates: tied.map((candidate) => candidate.path)
    };
  }
  return {
    ok: true,
    path: best.path,
    modsPath: best.path,
    originalPath: basePath,
    adjusted: !isSameResolvedPath(best.path, basePath),
    label: best.label
  };
}
function shouldResolveFolderSelectionAsMods(title, options = {}) {
  if (options?.modsFolder) return true;
  return /\bmods\b/i.test(String(title || ""));
}
function readXxmiImporterPathInfo(modLoaderPath, gameId2) {
  const importerName = getBuiltInGameDefinition(gameId2)?.defaultLaunchMode || "";
  const supported = BUNDLED_GAME_IMPORTERS.includes(importerName);
  if (!supported) {
    return { supported: false, importerName, status: "unsupported", importerPath: "" };
  }
  const xxmiRootDir = resolveXxmiRootFromLauncherPath(modLoaderPath);
  if (!xxmiRootDir) {
    return { supported: true, importerName, status: "launcher-path-invalid", importerPath: "" };
  }
  const configPath = path.join(xxmiRootDir, "XXMI Launcher Config.json");
  if (!fs.existsSync(configPath)) {
    return {
      supported: true,
      importerName,
      status: "config-missing",
      xxmiRootDir,
      configPath,
      importerPath: ""
    };
  }
  try {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const configuredPath = String(
      config?.Importers?.[importerName]?.Importer?.importer_folder || ""
    ).trim();
    if (!configuredPath) {
      return {
        supported: true,
        importerName,
        status: "importer-unconfigured",
        xxmiRootDir,
        configPath,
        importerPath: ""
      };
    }
    return {
      supported: true,
      importerName,
      status: "configured",
      xxmiRootDir,
      configPath,
      gameFolder: String(config?.Importers?.[importerName]?.Importer?.game_folder || "").trim(),
      importerPath: path.resolve(xxmiRootDir, configuredPath)
    };
  } catch (error) {
    logger.warn(`Failed to read XXMI importer path from ${configPath}:`, error?.message || error);
    return {
      supported: true,
      importerName,
      status: "config-invalid",
      xxmiRootDir,
      configPath,
      importerPath: ""
    };
  }
}
function buildRendererConfig() {
  ensureBuiltInGamesConfigured();
  const { activeGame, modsPath, gamePath, modLoaderPath } = getResolvedActiveGamePaths();
  const xxmiImporterInfo = readXxmiImporterPathInfo(modLoaderPath, activeGame?.id);
  return {
    ...currentConfig,
    randomLaunch: getRandomLaunchSettings(currentConfig),
    compatibilityMode: isCompatibilityModeEnabled(),
    compatibilityLevel: getCompatibilityLevel(),
    activeGame: activeGame ? serializeGameForRenderer(activeGame) : null,
    modsPath,
    gamePath,
    xxmiPath: modLoaderPath,
    modLoaderPath,
    xxmiImporterInfo,
    games: (currentConfig.games || []).map(serializeGameForRenderer)
  };
}
function notifyGamesChanged() {
  const payload = {
    activeGameId: currentConfig.activeGameId,
    activeGame: getActiveGame() ? serializeGameForRenderer(getActiveGame()) : null,
    games: (currentConfig.games || []).map(serializeGameForRenderer)
  };
  electron.BrowserWindow.getAllWindows().forEach((window) => {
    if (!window.isDestroyed()) {
      window.webContents.send("games-changed", payload);
    }
  });
}
const DANGEROUS_MANAGED_PATH_WARNING = "当前 Mod/XXMI 路径位于 QAQ 管理器安装目录内，更新程序时可能被清理。\n请迁移到独立文件夹后再继续使用。";
function getQaqInstallDir() {
  if (electron.app.isPackaged) return path.dirname(process.execPath);
  return path.resolve(electron.app.getAppPath());
}
function getDefaultMarketDownloadCacheDir() {
  return path.join(getQaqInstallDir(), "QAQM_DownloadCache");
}
function loadMarketDownloadSettings() {
  try {
    if (!fs.existsSync(MARKET_DOWNLOAD_SETTINGS_PATH)) return {};
    const parsed = JSON.parse(fs.readFileSync(MARKET_DOWNLOAD_SETTINGS_PATH, "utf-8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    logger.warn("Failed to load market download settings:", error?.message || error);
    return {};
  }
}
function saveMarketDownloadSettings(settings = {}) {
  fs.writeFileSync(MARKET_DOWNLOAD_SETTINGS_PATH, JSON.stringify(settings, null, 2));
}
function getMarketDownloadCacheDir() {
  const settings = loadMarketDownloadSettings();
  const customDir = String(settings.cacheDir || "").trim();
  return customDir || getDefaultMarketDownloadCacheDir();
}
function getMarketDownloadSettingsForRenderer() {
  const cacheDir = getMarketDownloadCacheDir();
  const defaultCacheDir = getDefaultMarketDownloadCacheDir();
  return {
    success: true,
    cacheDir,
    defaultCacheDir,
    isDefault: normalizeComparablePath(cacheDir) === normalizeComparablePath(defaultCacheDir)
  };
}
function ensureMarketDownloadCacheDir() {
  const cacheDir = getMarketDownloadCacheDir();
  probeWritableDirectory(cacheDir, "下载缓存目录");
  return cacheDir;
}
function normalizeComparablePath(targetPath) {
  if (!targetPath || typeof targetPath !== "string") return "";
  const trimmed = targetPath.trim();
  if (!trimmed) return "";
  try {
    const resolved = path.resolve(trimmed);
    return process.platform === "win32" ? resolved.toLowerCase() : resolved;
  } catch (_) {
    return "";
  }
}
function isPathInsideDirectory(targetPath, parentDir) {
  const normalizedTarget = normalizeComparablePath(targetPath);
  const normalizedParent = normalizeComparablePath(parentDir);
  if (!normalizedTarget || !normalizedParent) return false;
  if (normalizedTarget === normalizedParent) return true;
  const relativePath = path.relative(normalizedParent, normalizedTarget);
  return !!relativePath && relativePath !== ".." && !relativePath.startsWith(`..${path.sep}`) && !path.isAbsolute(relativePath);
}
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
  addEntry("Mod 路径", currentConfig.modsPath, "旧版配置");
  addEntry("XXMI 路径", currentConfig.xxmiPath, "旧版配置");
  addEntry("EFMI 路径", currentConfig.efmiPath, "旧版配置");
  addEntry("加载器路径", currentConfig.loaderPath, "旧版配置");
  for (const game of currentConfig.games || []) {
    const gameName = game?.name || game?.id || "游戏配置";
    addEntry("Mod 路径", game?.modFolderPath, gameName);
    addEntry("XXMI 路径", game?.modLoaderPath, gameName);
  }
  const seen = /* @__PURE__ */ new Set();
  return entries.filter((entry) => {
    const key = `${entry.label}|${entry.scope}|${normalizeComparablePath(entry.path)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function getDangerousManagedPaths() {
  const installDir = getQaqInstallDir();
  const dangerousPaths = collectConfiguredManagedPaths().filter(
    (entry) => isPathInsideDirectory(entry.path, installDir)
  );
  return {
    installDir,
    dangerousPaths
  };
}
function formatDangerousManagedPathDetail(checkResult) {
  const dangerousPaths = checkResult?.dangerousPaths || [];
  const lines = [`安装目录: ${checkResult?.installDir || getQaqInstallDir()}`];
  if (dangerousPaths.length > 0) {
    lines.push("", "危险路径:");
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
async function showDangerousManagedPathStartupWarning(ownerWindow = mainWindowRef) {
  const checkResult = getDangerousManagedPaths();
  if (checkResult.dangerousPaths.length === 0) return { dangerous: false };
  await showMessageBoxWithOptionalOwner(ownerWindow, {
    type: "warning",
    title: "路径风险提醒",
    message: DANGEROUS_MANAGED_PATH_WARNING,
    detail: formatDangerousManagedPathDetail(checkResult),
    buttons: ["知道了"],
    defaultId: 0,
    cancelId: 0,
    noLink: true
  });
  return { dangerous: true, ...checkResult };
}
ensureBuiltInGamesConfigured();
function runPowershell(script) {
  return new Promise((resolve, reject) => {
    const encoded = Buffer.from(script, "utf16le").toString("base64");
    child_process.exec(
      `powershell -NoProfile -NonInteractive -EncodedCommand ${encoded}`,
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr?.trim() || stdout?.trim() || error.message));
          return;
        }
        resolve({ stdout, stderr });
      }
    );
  });
}
function getResolvedActiveGamePaths() {
  return getResolvedGamePaths(getActiveGameScopeId());
}
function isWindowsProcessRunning(imageName) {
  return new Promise((resolve) => {
    child_process.exec(
      `tasklist /FI "IMAGENAME eq ${imageName}" /FO CSV /NH`,
      { windowsHide: true },
      (_error, stdout) => {
        resolve(
          String(stdout || "").toLowerCase().includes(imageName.toLowerCase())
        );
      }
    );
  });
}
async function waitForWindowsProcess(imageName, timeoutMs = 3e4, intervalMs = 500) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await isWindowsProcessRunning(imageName)) return true;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return false;
}
function parseLaunchArgs(argsText) {
  return String(argsText || "").match(/"[^"]*"|'[^']*'|\S+/g)?.map((arg) => arg.replace(/^["']|["']$/g, "")) || [];
}
function isNevernessInnerGameExecutable(filePath) {
  const normalized = String(filePath || "").replace(/\//g, "\\").toLowerCase();
  return normalized.endsWith("\\ht\\binaries\\win64\\htgame.exe");
}
function isNevernessProtectedClientExecutable(filePath) {
  const executableName = path.basename(filePath || "").toLowerCase();
  return isNevernessInnerGameExecutable(filePath) || executableName === "ntegame.exe";
}
function resolveNevernessOfficialLaunchPath(filePath) {
  if (!filePath) return null;
  const gameRoot = inferNevernessGameRootFromPath(filePath);
  const launcherFromRoot = getNevernessOfficialLauncherPathFromRoot(gameRoot);
  if (launcherFromRoot) return launcherFromRoot;
  const normalized = String(filePath).replace(/\//g, "\\");
  const marker = "\\Client\\WindowsNoEditor\\HT\\Binaries\\Win64\\HTGame.exe";
  const markerIndex = normalized.toLowerCase().lastIndexOf(marker.toLowerCase());
  const roots = [];
  if (markerIndex >= 0) {
    roots.push(normalized.slice(0, markerIndex));
  }
  if (path.basename(normalized).toLowerCase() === "ntelauncher.exe") {
    roots.push(path.dirname(normalized));
  }
  if (path.basename(normalized).toLowerCase() === "ntegame.exe") {
    roots.push(path.dirname(path.dirname(normalized)));
  }
  for (const root of roots) {
    const candidates = [path.join(root, "NTELauncher.exe")];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return null;
}
function getNevernessOfficialLauncherPathFromRoot(gameRoot) {
  if (!gameRoot) return "";
  const candidates = [
    path.join(gameRoot, "NTELauncher", "NTELauncher.exe"),
    path.join(gameRoot, "NTELauncher.exe")
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || "";
}
function buildNevernessGamePathCandidates() {
  const roots = [];
  const addRoot = (rootPath) => {
    if (rootPath && !roots.includes(rootPath)) roots.push(rootPath);
  };
  addRoot("F:\\Neverness To Everness");
  for (const drive of ["F", "G", "C", "D", "E"]) {
    addRoot(`${drive}:\\Neverness To Everness`);
    addRoot(`${drive}:\\Hotta\\Neverness To Everness`);
    addRoot(`${drive}:\\Perfect World Games\\Neverness To Everness`);
    addRoot(`${drive}:\\PWGame\\Neverness To Everness`);
  }
  const candidates = [];
  for (const root of roots) {
    candidates.push(path.join(root, "NTELauncher.exe"));
    candidates.push(path.join(root, "NTELauncher", "NTELauncher.exe"));
    candidates.push(
      path.join(root, "Client", "WindowsNoEditor", "HT", "Binaries", "Win64", "HTGame.exe")
    );
  }
  return candidates;
}
function resolveNevernessDetectedGamePath(candidatePath) {
  if (!candidatePath || !fs.existsSync(candidatePath)) return "";
  const officialLaunchPath = resolveNevernessOfficialLaunchPath(candidatePath);
  if (officialLaunchPath) return officialLaunchPath;
  if (!isNevernessProtectedClientExecutable(candidatePath)) return candidatePath;
  return "";
}
function normalizeNevernessLaunchPath(filePath) {
  if (!filePath) return filePath;
  if (!isNevernessProtectedClientExecutable(filePath)) return filePath;
  return resolveNevernessOfficialLaunchPath(filePath) || filePath;
}
function getNevernessOfficialLaunchArgs(gamePath, customLaunchArgs) {
  const args = parseLaunchArgs(customLaunchArgs);
  const executableName = path.basename(gamePath || "").toLowerCase();
  if (executableName === "ntelauncher.exe") {
    return [];
  }
  return args;
}
function quoteWindowsCommandArg(arg) {
  return `"${String(arg).replace(/"/g, '\\"')}"`;
}
function launchWindowsExecutableViaStart(executablePath, args = []) {
  const cwd = path.dirname(executablePath);
  const commandArgs = args.length ? ` ${args.map(quoteWindowsCommandArg).join(" ")}` : "";
  return child_process.exec(`start "" /D "${cwd}" "${executablePath}"${commandArgs}`, (error) => {
    if (error) logger.error("Failed to launch executable via start:", error);
  });
}
function launchElevated(executablePath, workingDir, args = []) {
  return windowsLauncher.launch(executablePath, workingDir, args);
}
const preparedKeypressRoots = /* @__PURE__ */ new Set();
const preparedPersistBridgeRoots = /* @__PURE__ */ new Set();
const PERSIST_BRIDGE_STATE_FILE_REGEX = /^qaqm_state_.+\.ini$/i;
const PERSIST_ACTIVE_INCLUDE_FILE = "qaqm_persist_active.ini";
const QAQM_BRIDGE_DIR = "qaqm";
const QAQM_INCLUDER_FILE = "qaqm_includer.ini";
const QAQM_KEYPRESS_FILE = "qaqm_keypress.ini";
const PERSIST_BRIDGE_STATE_DIR = "cache";
const PERSIST_BRIDGE_SEED_FILES = [
  {
    filename: "qaqm_state_laevatain_2bfall.ini",
    content: [
      "namespace = QAQM\\Persist\\Laevatain2BFall",
      "",
      "[Constants]",
      "global persist $backSkirt = 0",
      "global persist $nudity = 0",
      "global persist $head = 0",
      "global persist $mask = 0",
      "global persist $panties = 0",
      "global persist $skirt = 0",
      ""
    ].join("\n")
  }
];
function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function ensureIncludeEntry(content, sectionName, includeTarget) {
  const normalized = String(content || "").replace(/\r\n/g, "\n");
  const includePattern = new RegExp(
    `^\\s*include\\s*=\\s*${escapeRegExp(includeTarget)}\\s*$`,
    "im"
  );
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
  return path.join(root, QAQM_BRIDGE_DIR);
}
function ensureQaqmBridgeDir(root) {
  const bridgeDir = getQaqmBridgeDir(root);
  if (!fs.existsSync(bridgeDir)) {
    fs.mkdirSync(bridgeDir, { recursive: true });
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
    fs.mkdirSync(stateDir, { recursive: true });
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
  const rootEntries = fs.readdirSync(root, { withFileTypes: true });
  for (const entry of rootEntries) {
    if (!entry.isFile() || !PERSIST_BRIDGE_STATE_FILE_REGEX.test(entry.name)) continue;
    const sourcePath = path.join(root, entry.name);
    const targetPath = path.join(stateDir, entry.name);
    try {
      migratePersistBridgeStateFile(sourcePath, targetPath);
    } catch (e) {
      logger.warn(`Failed to migrate persist bridge state file ${entry.name}:`, e?.message || e);
    }
  }
}
function migrateQaqmBridgeFilesToBridgeDir(root) {
  if (!root || !fs.existsSync(root)) return;
  const bridgeDir = ensureQaqmBridgeDir(root);
  const legacyBridgeFiles = [QAQM_INCLUDER_FILE, QAQM_KEYPRESS_FILE, PERSIST_ACTIVE_INCLUDE_FILE];
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
      logger.warn(`Failed to migrate QAQM bridge file ${fileName}:`, e?.message || e);
    }
  }
  const legacyCacheDir = path.join(root, "qaqm_cache");
  const nextCacheDir = getPersistBridgeStateDir(root);
  ensurePersistBridgeStateDir(root);
  if (fs.existsSync(legacyCacheDir) && legacyCacheDir !== nextCacheDir) {
    for (const entry of fs.readdirSync(legacyCacheDir, { withFileTypes: true })) {
      if (!entry.isFile() || !PERSIST_BRIDGE_STATE_FILE_REGEX.test(entry.name)) continue;
      const sourcePath = path.join(legacyCacheDir, entry.name);
      const targetPath = path.join(nextCacheDir, entry.name);
      try {
        migratePersistBridgeStateFile(sourcePath, targetPath);
      } catch (e) {
        logger.warn(`Failed to migrate QAQM cache file ${entry.name}:`, e?.message || e);
      }
    }
    try {
      if (fs.existsSync(legacyCacheDir) && fs.readdirSync(legacyCacheDir).length === 0) {
        fs.rmdirSync(legacyCacheDir);
      }
    } catch (_) {
    }
  }
}
function resolveActiveGameEnvRoot(gameId2 = getActiveGameScopeId()) {
  try {
    const modsPath = getModsPath(gameId2);
    if (!modsPath || !fs.existsSync(modsPath)) return null;
    const root = path.dirname(modsPath);
    const d3dxPath = path.join(root, "d3dx.ini");
    if (!fs.existsSync(d3dxPath)) return null;
    return { root, d3dxPath };
  } catch (e) {
    logger.warn("Failed to resolve active game env root for keypress bridge:", e?.message || e);
    return null;
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
    } catch (_) {
    }
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
function isPersistBridgeEnabled(gameId = getActiveGameScopeId()) {
  return currentConfig.persistBridgeByGame?.[gameId]?.enabled === true;
}
function getPersistBridgeGameIdForRoot(root) {
  const resolvedRoot = path.resolve(root).toLowerCase();
  return currentConfig.games.find(game => {
    const mods = getModsPath(game.id);
    return mods && path.dirname(path.resolve(mods)).toLowerCase() === resolvedRoot;
  })?.id;
}
function getPersistBridgeTrackingKey(root) {
  return String(root || "").trim().toLowerCase();
}
function normalizePersistBridgeStateFileList(list) {
  const stateFiles = Array.isArray(list) ? list : [];
  const normalized = [];
  const seen = /* @__PURE__ */ new Set();
  for (const item of stateFiles) {
    const fileName = extractPersistBridgeStateFileName(item);
    if (!fileName) continue;
    if (seen.has(fileName)) continue;
    seen.add(fileName);
    normalized.push(fileName);
  }
  return normalized;
}
function ensurePersistBridgeTrackingStore() {
  if (!currentConfig.persistBridgeTracking || typeof currentConfig.persistBridgeTracking !== "object") {
    currentConfig.persistBridgeTracking = {};
  }
  return currentConfig.persistBridgeTracking;
}
function getPersistBridgeTrackingState(root) {
  const trackingStore = ensurePersistBridgeTrackingStore();
  const trackingKey = getPersistBridgeTrackingKey(root);
  const storedState = trackingStore[trackingKey] || {};
  const enabledStateFiles = normalizePersistBridgeStateFileList(storedState.enabledStateFiles);
  const enabledSet = new Set(enabledStateFiles);
  const recentStateFiles = normalizePersistBridgeStateFileList(storedState.recentStateFiles).filter(
    (stateFile) => !enabledSet.has(stateFile)
  );
  return { enabledStateFiles, recentStateFiles };
}
function setPersistBridgeTrackingState(root, state, save = true) {
  if (!root) return { enabledStateFiles: [], recentStateFiles: [] };
  const trackingStore = ensurePersistBridgeTrackingStore();
  const trackingKey = getPersistBridgeTrackingKey(root);
  const normalizedState = getPersistBridgeTrackingStateFromValue(state);
  const existingState = getPersistBridgeTrackingState(root);
  const changed = existingState.enabledStateFiles.length !== normalizedState.enabledStateFiles.length || existingState.recentStateFiles.length !== normalizedState.recentStateFiles.length || existingState.enabledStateFiles.some(
    (item, index) => item !== normalizedState.enabledStateFiles[index]
  ) || existingState.recentStateFiles.some(
    (item, index) => item !== normalizedState.recentStateFiles[index]
  );
  trackingStore[trackingKey] = normalizedState;
  if (changed && save) {
    saveConfig(currentConfig);
  }
  return normalizedState;
}
function getPersistBridgeTrackingStateFromValue(state) {
  const enabledStateFiles = normalizePersistBridgeStateFileList(state?.enabledStateFiles);
  const enabledSet = new Set(enabledStateFiles);
  const recentStateFiles = normalizePersistBridgeStateFileList(state?.recentStateFiles).filter(
    (stateFile) => !enabledSet.has(stateFile)
  );
  return { enabledStateFiles, recentStateFiles };
}
function writeActivePersistBridgeIncludeFromState(root, state, saveTracking = true) {
  if (!root) return [];
  ensureQaqmBridgeDir(root);
  const normalizedState = setPersistBridgeTrackingState(root, state, saveTracking);
  const finalStateFiles = isPersistBridgeEnabled(getPersistBridgeGameIdForRoot(root))
    ? [...normalizedState.enabledStateFiles, ...normalizedState.recentStateFiles].filter(name => fs.existsSync(resolvePersistBridgeStatePath(root, name))) : [];
  let content = "";
  for (const stateFile of finalStateFiles) {
    const includeTarget = getPersistBridgeStateIncludeTarget(stateFile);
    if (!includeTarget) continue;
    content = ensureIncludeEntry(
      content,
      getStateBridgeIncludeSectionName(stateFile),
      includeTarget
    );
  }
  writeFileIfChanged(getQaqmBridgeFilePath(root, PERSIST_ACTIVE_INCLUDE_FILE), content);
  return finalStateFiles;
}
function ensurePersistBridgeTrackingState(root) {
  if (!root) return { enabledStateFiles: [], recentStateFiles: [] };
  const trackingKey = getPersistBridgeTrackingKey(root);
  const trackingStore = ensurePersistBridgeTrackingStore();
  if (!trackingStore[trackingKey]) {
    rebuildActivePersistBridgeIncludes(root);
  }
  return getPersistBridgeTrackingState(root);
}
function updateActivePersistBridgeIncludesIncremental(root, updates = {}) {
  if (!root) return [];
  const currentState = ensurePersistBridgeTrackingState(root);
  const enableStateFiles = normalizePersistBridgeStateFileList(updates.enableStateFiles);
  const disableStateFiles = normalizePersistBridgeStateFileList(updates.disableStateFiles);
  const removeStateFiles = normalizePersistBridgeStateFileList(updates.removeStateFiles);
  const enableSet = new Set(enableStateFiles);
  const disableSet = new Set(disableStateFiles);
  const removeSet = new Set(removeStateFiles);
  const nextEnabledStateFiles = [
    ...enableStateFiles,
    ...currentState.enabledStateFiles.filter(
      (stateFile) => !enableSet.has(stateFile) && !disableSet.has(stateFile) && !removeSet.has(stateFile)
    )
  ];
  let nextRecentStateFiles = currentState.recentStateFiles.filter(
    (stateFile) => !enableSet.has(stateFile) && !disableSet.has(stateFile) && !removeSet.has(stateFile)
  );
  if (disableStateFiles.length > 0) {
    nextRecentStateFiles = [...nextRecentStateFiles, ...disableStateFiles];
  }
  return writeActivePersistBridgeIncludeFromState(root, {
    enabledStateFiles: nextEnabledStateFiles,
    recentStateFiles: nextRecentStateFiles
  });
}
function extractHostedPersistStateFilesFromContent(content) {
  const matches = String(content || "").matchAll(
    /^[ \t]*;[ \t]*Persisted state is hosted by[ \t]+([^\r\n;]+)$/gim
  );
  const stateFiles = /* @__PURE__ */ new Set();
  for (const match of matches) {
    const fileName = extractPersistBridgeStateFileName(match[1]);
    if (fileName) {
      stateFiles.add(fileName);
    }
  }
  return Array.from(stateFiles);
}
function collectHostedPersistStateFilesForModDir(modDirPath) {
  const stateFiles = /* @__PURE__ */ new Set();
  if (!modDirPath || !fs.existsSync(modDirPath)) return [];
  const iniFiles = getIniFiles(modDirPath);
  for (const iniPath of iniFiles) {
    try {
      const content = fs.readFileSync(iniPath, "utf-8");
      for (const stateFile of extractHostedPersistStateFilesFromContent(content)) {
        stateFiles.add(stateFile);
      }
    } catch (_) {
    }
  }
  return Array.from(stateFiles).sort((left, right) => left.localeCompare(right));
}
function rebuildActivePersistBridgeIncludes(root) {
  if (!root) return [];
  const enabledStateFiles = /* @__PURE__ */ new Set();
  const modsRoot = getModsPath(getPersistBridgeGameIdForRoot(root)) || path.join(root, "Mods");
  if (fs.existsSync(modsRoot)) {
    try {
      const characterDirs = fs.readdirSync(modsRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory());
      for (const characterDir of characterDirs) {
        const charPath = path.join(modsRoot, characterDir.name);
        const modDirs = fs.readdirSync(charPath, { withFileTypes: true }).filter((entry) => entry.isDirectory() && !entry.name.startsWith("DISABLED_"));
        for (const modDir of modDirs) {
          for (const stateFile of collectHostedPersistStateFilesForModDir(
            path.join(charPath, modDir.name)
          )) {
            enabledStateFiles.add(stateFile);
          }
        }
      }
    } catch (e) {
      logger.warn("Failed to rebuild active persist bridge set:", e?.message || e);
    }
  }
  const activeIncludePath = getQaqmBridgeFilePath(root, PERSIST_ACTIVE_INCLUDE_FILE);
  const existingStateFiles = readPersistBridgeStateFilesFromInclude(activeIncludePath);
  const existingCachedStateFiles = existingStateFiles.filter(
    (stateFile) => !enabledStateFiles.has(stateFile)
  );
  const trackedState = getPersistBridgeTrackingState(root);
  const stateDir = getPersistBridgeStateDir(root);
  const savedFiles = fs.existsSync(stateDir) ? fs.readdirSync(stateDir).filter(name => PERSIST_BRIDGE_STATE_FILE_REGEX.test(name)) : [];
  const recentStateFiles = normalizePersistBridgeStateFileList([
    ...trackedState.recentStateFiles, ...trackedState.enabledStateFiles, ...existingCachedStateFiles, ...savedFiles
  ]).filter(name => !enabledStateFiles.has(name) && fs.existsSync(resolvePersistBridgeStatePath(root, name)));
  return writeActivePersistBridgeIncludeFromState(root, {
    enabledStateFiles: Array.from(enabledStateFiles).sort(
      (left, right) => left.localeCompare(right)
    ),
    recentStateFiles
  });
}
function syncPersistBridgeStateForModDir(modDirPath, gameId = getActiveGameScopeId()) {
  if (!isPersistBridgeEnabled(gameId)) return { synced: false, fileCount: 0 };
  const env = resolveActiveGameEnvRoot(gameId);
  const d3dxUserPath = env && path.join(env.root, "d3dx_user.ini");
  if (!env || !d3dxUserPath || !fs.existsSync(d3dxUserPath) || !modDirPath || !fs.existsSync(modDirPath)) {
    return { synced: false, fileCount: 0 };
  }
  const stateFiles = collectHostedPersistStateFilesForModDir(modDirPath);
  if (stateFiles.length === 0) {
    return { synced: false, fileCount: 0 };
  }
  const { constantsMap } = readD3dxUserConstants(d3dxUserPath);
  let updatedFiles = 0;
  for (const stateFile of stateFiles) {
    const statePath = resolvePersistBridgeStatePath(env.root, stateFile);
    if (!fs.existsSync(statePath)) continue;
    try {
      const originalContent = fs.readFileSync(statePath, "utf-8");
      const lines = originalContent.replace(/\r\n/g, "\n").split("\n");
      const namespaceLine = lines.find((line) => /^\s*namespace\s*=/.test(line));
      const namespaceMatch = namespaceLine?.match(/^\s*namespace\s*=\s*(.+?)\s*$/i);
      const namespace = namespaceMatch?.[1]?.trim();
      if (!namespace) continue;
      let changed = false;
      const nextLines = lines.map((line) => {
        const persistMatch = line.match(
          /^\s*global\s+persist\s+\$([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/
        );
        if (!persistMatch) return line;
        const variableName = persistMatch[1];
        const rawKey = `$\\${namespace}\\${variableName}`;
        const currentEntry = constantsMap.get(normalizeD3dxUserKey(rawKey));
        if (!currentEntry) return line;
        const nextLine = `global persist $${variableName} = ${currentEntry.value}`;
        if (nextLine !== line.trim()) {
          changed = true;
        }
        return nextLine;
      });
      if (changed) {
        fs.writeFileSync(statePath, `${nextLines.join("\n").replace(/\n+$/, "")}
`, "utf-8");
        updatedFiles += 1;
      }
    } catch (e) {
      logger.warn(`Failed to sync persist bridge state file ${stateFile}:`, e?.message || e);
    }
  }
  return { synced: updatedFiles > 0, fileCount: updatedFiles };
}
function normalizePersistBridgeRelativePath(value) {
  return String(value || "").replace(/[\/]+/g, "\\").split("\\").filter(Boolean).map((segment) => segment.replace(/^DISABLED_/i, "")).join("\\");
}
function parseLocalPersistDeclarations(content) {
  const declarations = [];
  const seen = /* @__PURE__ */ new Set();
  const lines = String(content || "").replace(/\r\n/g, "\n").split("\n");
  for (const line of lines) {
    const match = line.match(/^\s*global\s+persist\s+\$([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    const variableName = match[1];
    const normalizedName = variableName.toLowerCase();
    if (seen.has(normalizedName)) continue;
    seen.add(normalizedName);
    declarations.push({
      variableName,
      normalizedName,
      defaultValue: match[2]
    });
  }
  return declarations;
}
function buildPersistBridgeDescriptor(modsRoot, iniPath) {
  const canonicalRelativePath = normalizePersistBridgeRelativePath(path.relative(modsRoot, iniPath));
  const hash = crypto.createHash("sha1").update(canonicalRelativePath.toLowerCase()).digest("hex").slice(0, 12);
  return {
    hash,
    canonicalRelativePath,
    stateFileName: `qaqm_state_${hash}.ini`,
    namespace: `QAQM\\Persist\\Bridge_${hash}`
  };
}
function buildPersistBridgeStateContent(descriptor, declarations, existingValues = /* @__PURE__ */ new Map()) {
  return [
    `namespace = ${descriptor.namespace}`,
    "",
    "[Constants]",
    ...declarations.map((declaration) => {
      const existingValue = existingValues.get(declaration.normalizedName);
      const value = existingValue !== void 0 ? existingValue : declaration.defaultValue;
      return `global persist $${declaration.variableName} = ${value}`;
    }),
    ""
  ].join("\n");
}
function applyPersistBridgeToIniContent(content, descriptor, declarations) {
  const persistNames = new Set(declarations.map((declaration) => declaration.normalizedName));
  const lines = String(content || "").replace(/\r\n/g, "\n").split("\n");
  const nextLines = [];
  let insertedBridgeComment = false;
  const replacements = declarations.map((declaration) => ({
    regex: new RegExp(`(?<![A-Za-z0-9_\\\\])\\$${escapeRegExp(declaration.variableName)}\\b`, "gi"),
    replacement: `$\\${descriptor.namespace}\\${declaration.variableName}`
  }));
  for (const line of lines) {
    const persistMatch = line.match(
      /^\s*global\s+persist\s+\$([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/
    );
    if (persistMatch && persistNames.has(persistMatch[1].toLowerCase())) {
      if (!insertedBridgeComment) {
        nextLines.push(`; Persisted state is hosted by ${descriptor.stateFileName}`);
        insertedBridgeComment = true;
      }
      continue;
    }
    if (/^\s*\[/.test(line)) {
      nextLines.push(line);
      continue;
    }
    let nextLine = line;
    for (const { regex, replacement } of replacements) {
      nextLine = nextLine.replace(regex, () => replacement);
    }
    nextLines.push(nextLine);
  }
  return nextLines.join("\n");
}
function parseIniNamespace(content) {
  const match = String(content || "").match(/^\s*namespace\s*=\s*(.+?)\s*$/im);
  return match ? match[1].trim() : null;
}
function applyExternalBridgeRefsToIniContent(content, externalMappings) {
  if (!externalMappings || externalMappings.length === 0) return content;
  let result = String(content || "");
  for (const { originalNamespace, bridgeNamespace, varNames } of externalMappings) {
    if (!originalNamespace || !varNames || varNames.length === 0) continue;
    const escapedNs = escapeRegExp(originalNamespace);
    const varNameMap = new Map(varNames.map((v) => [v.toLowerCase(), v]));
    const varNamesPattern = varNames.map(escapeRegExp).join("|");
    const regex = new RegExp(`\\$\\\\${escapedNs}\\\\(${varNamesPattern})\\b`, "gi");
    result = result.replace(regex, (_match, capturedVarName) => {
      const canonicalVarName = varNameMap.get(capturedVarName.toLowerCase()) || capturedVarName;
      return `$\\${bridgeNamespace}\\${canonicalVarName}`;
    });
  }
  return result;
}
function ensurePersistBridgeMigrationForActiveGame(root) {
  if (!root || preparedPersistBridgeRoots.has(root)) return;
  if (!isPersistBridgeEnabled(getPersistBridgeGameIdForRoot(root))) {
    try {
      const activeIncludePath = getQaqmBridgeFilePath(root, PERSIST_ACTIVE_INCLUDE_FILE);
      if (fs.existsSync(activeIncludePath)) writeFileIfChanged(activeIncludePath, "");
      const modsRoot = getModsPath(getPersistBridgeGameIdForRoot(root)) || path.join(root, "Mods");
      if (fs.existsSync(modsRoot)) {
        const restoredCount = restorePersistBakFiles(modsRoot);
        if (restoredCount > 0) {
          logger.info(
            `Persist OFF startup cleanup: restored ${restoredCount} .qaqm-persistbak file(s) in ${modsRoot}`
          );
        }
      }
    } catch (e) {
      logger.warn("Failed to restore persist bak files on startup:", e?.message || e);
    }
    preparedPersistBridgeRoots.add(root);
    return;
  }
  try {
    migrateQaqmBridgeFilesToBridgeDir(root);
    migratePersistBridgeStateFilesToCacheDir(root);
    const modsRoot = getModsPath(getPersistBridgeGameIdForRoot(root)) || path.join(root, "Mods");
    if (!fs.existsSync(modsRoot)) {
      preparedPersistBridgeRoots.add(root);
      return;
    }
    let migratedIniCount = 0;
    let generatedStateCount = 0;
    const iniFiles = getIniFiles(modsRoot);
    const bridgeMappings = [];
    const d3dxUserPath = path.join(root, "d3dx_user.ini");
    const { constantsMap: d3dxUserConstants } = d3dxUserPath && fs.existsSync(d3dxUserPath) ? readD3dxUserConstants(d3dxUserPath) : { constantsMap: /* @__PURE__ */ new Map() };
    for (const iniPath of iniFiles) {
      const backupPath = `${iniPath}.qaqm-persistbak`;
      if (fs.existsSync(backupPath)) {
        try {
          const currentRaw = fs.readFileSync(iniPath, "utf-8");
          const hasQaqmRefs = currentRaw.includes("\\QAQM\\Persist\\Bridge_");
          if (hasQaqmRefs) {
            const bakContent = fs.readFileSync(backupPath, "utf-8");
            const bakDeclarations = parseLocalPersistDeclarations(bakContent);
            if (bakDeclarations.length > 0) {
              const descriptor2 = buildPersistBridgeDescriptor(modsRoot, iniPath);
              const statePath2 = resolvePersistBridgeStatePath(root, descriptor2.stateFileName);
              if (!fs.existsSync(statePath2)) {
                const existingStateValues2 = /* @__PURE__ */ new Map();
                for (const declaration of bakDeclarations) {
                  const rawKey = `$\\${descriptor2.namespace}\\${declaration.variableName}`;
                  const entry = d3dxUserConstants.get(normalizeD3dxUserKey(rawKey));
                  if (entry) existingStateValues2.set(declaration.normalizedName, entry.value);
                }
                const stateContent2 = buildPersistBridgeStateContent(
                  descriptor2,
                  bakDeclarations,
                  existingStateValues2
                );
                if (writeFileIfChanged(statePath2, stateContent2)) {
                  generatedStateCount += 1;
                }
              }
              const originalNamespace2 = parseIniNamespace(bakContent);
              if (originalNamespace2) {
                bridgeMappings.push({
                  originalNamespace: originalNamespace2,
                  bridgeNamespace: descriptor2.namespace,
                  varNames: bakDeclarations.map((d) => d.variableName)
                });
              }
            }
            continue;
          } else {
            fs.unlinkSync(backupPath);
          }
        } catch (e) {
          logger.warn(`Failed to handle persist bak for ${iniPath}:`, e?.message || e);
          continue;
        }
      }
      let content = "";
      try {
        content = fs.readFileSync(iniPath, "utf-8");
      } catch (_) {
        continue;
      }
      const declarations = parseLocalPersistDeclarations(content);
      if (declarations.length === 0) continue;
      const descriptor = buildPersistBridgeDescriptor(modsRoot, iniPath);
      const statePath = resolvePersistBridgeStatePath(root, descriptor.stateFileName);
      const existingStateValues = /* @__PURE__ */ new Map();
      if (fs.existsSync(statePath)) {
        try {
          const existingStateContent = fs.readFileSync(statePath, "utf-8");
          for (const line of existingStateContent.replace(/\r\n/g, "\n").split("\n")) {
            const m = line.match(
              /^\s*global\s+persist\s+\$([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/
            );
            if (m) existingStateValues.set(m[1].toLowerCase(), m[2]);
          }
        } catch (_) {
        }
      }
      for (const declaration of declarations) {
        const rawKey = `$\\${descriptor.namespace}\\${declaration.variableName}`;
        const entry = d3dxUserConstants.get(normalizeD3dxUserKey(rawKey));
        if (entry) existingStateValues.set(declaration.normalizedName, entry.value);
      }
      const stateContent = buildPersistBridgeStateContent(
        descriptor,
        declarations,
        existingStateValues
      );
      if (writeFileIfChanged(statePath, stateContent)) {
        generatedStateCount += 1;
      }
      const originalNamespace = parseIniNamespace(content);
      if (originalNamespace) {
        bridgeMappings.push({
          originalNamespace,
          bridgeNamespace: descriptor.namespace,
          varNames: declarations.map((d) => d.variableName)
        });
      }
      const nextContent = applyPersistBridgeToIniContent(content, descriptor, declarations);
      if (nextContent === content) continue;
      if (!fs.existsSync(backupPath)) {
        fs.writeFileSync(backupPath, content, "utf-8");
      }
      fs.writeFileSync(iniPath, nextContent, "utf-8");
      migratedIniCount += 1;
    }
    if (bridgeMappings.length > 0) {
      for (const iniPath of iniFiles) {
        let currentContent = "";
        try {
          currentContent = fs.readFileSync(iniPath, "utf-8");
        } catch (_) {
          continue;
        }
        const updatedContent = applyExternalBridgeRefsToIniContent(currentContent, bridgeMappings);
        if (updatedContent === currentContent) continue;
        const backupPath = `${iniPath}.qaqm-persistbak`;
        if (!fs.existsSync(backupPath)) {
          fs.writeFileSync(backupPath, currentContent, "utf-8");
        }
        fs.writeFileSync(iniPath, updatedContent, "utf-8");
        migratedIniCount += 1;
      }
    }
    for (const iniPath of iniFiles) {
      let content = "";
      try {
        content = fs.readFileSync(iniPath, "utf-8");
      } catch (_) {
        continue;
      }
      const hostedStateFiles = extractHostedPersistStateFilesFromContent(content);
      for (const stateFileName of hostedStateFiles) {
        const statePath = resolvePersistBridgeStatePath(root, stateFileName);
        if (fs.existsSync(statePath)) continue;
        const hashMatch = stateFileName.match(/^qaqm_state_([a-f0-9]+)\.ini$/i);
        if (!hashMatch) continue;
        const hash = hashMatch[1];
        const namespace = `QAQM\\Persist\\Bridge_${hash}`;
        const varPattern = new RegExp(
          `\\$\\\\${escapeRegExp(namespace)}\\\\([A-Za-z_][A-Za-z0-9_]*)`,
          "gi"
        );
        const variableNames = /* @__PURE__ */ new Set();
        let varMatch;
        while ((varMatch = varPattern.exec(content)) !== null) {
          variableNames.add(varMatch[1]);
        }
        if (variableNames.size === 0) continue;
        const stateLines = Array.from(variableNames).map((name) => {
          const rawKey = `$\\${namespace}\\${name}`;
          const entry = d3dxUserConstants.get(normalizeD3dxUserKey(rawKey));
          const value = entry ? entry.value : "0";
          return `global persist $${name} = ${value}`;
        });
        const stateContent = [
          `namespace = ${namespace}`,
          "",
          "[Constants]",
          ...stateLines,
          ""
        ].join("\n");
        if (writeFileIfChanged(statePath, stateContent)) {
          generatedStateCount += 1;
          logger.info(`Recreated missing persist bridge state file: ${stateFileName}`);
        }
      }
    }
    if (migratedIniCount > 0 || generatedStateCount > 0) {
      logger.info(
        `Persist bridge migration completed for ${root}: ${migratedIniCount} ini files, ${generatedStateCount} state files`
      );
      if (generatedStateCount > 0) {
        try {
          rebuildActivePersistBridgeIncludes(root);
        } catch (e) {
          logger.warn(
            "Failed to rebuild active includes after state file recreation:",
            e?.message || e
          );
        }
      }
    }
  } catch (e) {
    logger.warn("Failed to migrate persist bridge files:", e?.message || e);
  } finally {
    preparedPersistBridgeRoots.add(root);
  }
}
function ensurePersistBridgeMigrationForModDir(root, modDir) {
  if (!isPersistBridgeEnabled(getPersistBridgeGameIdForRoot(root))) return;
  try {
    const modsRoot = getModsPath(getPersistBridgeGameIdForRoot(root)) || path.join(root, "Mods");
    const iniFiles = getIniFiles(modDir);
    let generatedStateCount = 0;
    const bridgeMappings = [];
    const d3dxUserPath = path.join(root, "d3dx_user.ini");
    const { constantsMap: d3dxUserConstants } = d3dxUserPath && fs.existsSync(d3dxUserPath) ? readD3dxUserConstants(d3dxUserPath) : { constantsMap: /* @__PURE__ */ new Map() };
    for (const iniPath of iniFiles) {
      const backupPath = `${iniPath}.qaqm-persistbak`;
      if (fs.existsSync(backupPath)) {
        try {
          const currentRaw = fs.readFileSync(iniPath, "utf-8");
          const hasQaqmRefs = currentRaw.includes("\\QAQM\\Persist\\Bridge_");
          if (hasQaqmRefs) {
            const bakContent = fs.readFileSync(backupPath, "utf-8");
            fs.writeFileSync(iniPath, bakContent, "utf-8");
          } else {
            fs.unlinkSync(backupPath);
          }
        } catch (e) {
          logger.warn(`Failed to handle persist bak for ${iniPath}:`, e?.message || e);
          continue;
        }
      }
      let content = "";
      try {
        content = fs.readFileSync(iniPath, "utf-8");
      } catch (_) {
        continue;
      }
      const declarations = parseLocalPersistDeclarations(content);
      if (declarations.length === 0) continue;
      const descriptor = buildPersistBridgeDescriptor(modsRoot, iniPath);
      const statePath = resolvePersistBridgeStatePath(root, descriptor.stateFileName);
      const existingStateValues = /* @__PURE__ */ new Map();
      if (fs.existsSync(statePath)) {
        try {
          const existingStateContent = fs.readFileSync(statePath, "utf-8");
          for (const line of existingStateContent.replace(/\r\n/g, "\n").split("\n")) {
            const m = line.match(
              /^\s*global\s+persist\s+\$([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/
            );
            if (m) existingStateValues.set(m[1].toLowerCase(), m[2]);
          }
        } catch (_) {
        }
      }
      for (const declaration of declarations) {
        const rawKey = `$\\${descriptor.namespace}\\${declaration.variableName}`;
        const entry = d3dxUserConstants.get(normalizeD3dxUserKey(rawKey));
        if (entry) existingStateValues.set(declaration.normalizedName, entry.value);
      }
      const stateContent = buildPersistBridgeStateContent(
        descriptor,
        declarations,
        existingStateValues
      );
      if (writeFileIfChanged(statePath, stateContent)) {
        generatedStateCount += 1;
      }
      const originalNamespace = parseIniNamespace(content);
      if (originalNamespace) {
        bridgeMappings.push({
          originalNamespace,
          bridgeNamespace: descriptor.namespace,
          varNames: declarations.map((d) => d.variableName)
        });
      }
      const nextContent = applyPersistBridgeToIniContent(content, descriptor, declarations);
      if (nextContent === content) continue;
      if (!fs.existsSync(backupPath)) {
        fs.writeFileSync(backupPath, content, "utf-8");
      }
      fs.writeFileSync(iniPath, nextContent, "utf-8");
    }
    if (bridgeMappings.length > 0) {
      for (const iniPath of iniFiles) {
        let currentContent = "";
        try {
          currentContent = fs.readFileSync(iniPath, "utf-8");
        } catch (_) {
          continue;
        }
        const updatedContent = applyExternalBridgeRefsToIniContent(currentContent, bridgeMappings);
        if (updatedContent === currentContent) continue;
        const backupPath = `${iniPath}.qaqm-persistbak`;
        if (!fs.existsSync(backupPath)) {
          fs.writeFileSync(backupPath, currentContent, "utf-8");
        }
        fs.writeFileSync(iniPath, updatedContent, "utf-8");
      }
    }
    if (generatedStateCount > 0) {
      try {
        rebuildActivePersistBridgeIncludes(root);
      } catch (e) {
        logger.warn("Failed to rebuild active includes after mod reset:", e?.message || e);
      }
    }
  } catch (e) {
    logger.warn("Failed to migrate persist bridge for mod dir:", e?.message || e);
  }
}
async function ensureKeypressBridgeForActiveGame() {
  const env = resolveActiveGameEnvRoot();
  if (!env) return;
  await prepareOverlayActivity();
  const { root, d3dxPath } = env;
  ensurePersistBridgeMigrationForActiveGame(root);
  if (preparedKeypressRoots.has(root)) {
    const bridgeDir = getQaqmBridgeDir(root);
    const keypressFile = path.join(bridgeDir, QAQM_KEYPRESS_FILE);
    const includerFile = path.join(bridgeDir, QAQM_INCLUDER_FILE);
    const bridgeFilesExist = fs.existsSync(bridgeDir) && fs.existsSync(keypressFile) && fs.existsSync(includerFile);
    if (bridgeFilesExist) {
      let d3dxHasInclude = false;
      try {
        const d3dxContent = fs.readFileSync(d3dxPath, "utf-8");
        d3dxHasInclude = new RegExp(
          `^\\s*include\\s*=\\s*${escapeRegExp(QAQM_BRIDGE_DIR)}[/\\\\]${escapeRegExp(QAQM_INCLUDER_FILE)}\\s*$`,
          "im"
        ).test(d3dxContent);
      } catch (_) {
        d3dxHasInclude = true;
      }
      if (d3dxHasInclude) return;
      logger.info(`d3dx.ini lost qaqm include for ${root}, re-patching...`);
    } else {
      logger.info(`qaqm bridge files missing for ${root}, recreating...`);
    }
    preparedKeypressRoots.delete(root);
  }
  try {
    const keypressPath = getQaqmBridgeFilePath(root, QAQM_KEYPRESS_FILE);
    const includerPath = getQaqmBridgeFilePath(root, QAQM_INCLUDER_FILE);
    ensureQaqmBridgeDir(root);
    const keypressContent = "[System]\ncheck_foreground_window = 0\n";
    try {
      writeFileIfChanged(keypressPath, keypressContent);
      if (isPersistBridgeEnabled()) {
        rebuildActivePersistBridgeIncludes(root);
      }
      let existingIncluderContent = "";
      if (fs.existsSync(includerPath)) {
        try {
          existingIncluderContent = fs.readFileSync(includerPath, "utf-8");
        } catch (_) {
        }
      }
      let nextIncluderContent = ensureIncludeEntry(
        existingIncluderContent,
        "IncludeKeypress",
        QAQM_KEYPRESS_FILE
      );
      nextIncluderContent = ensureIncludeEntry(
        nextIncluderContent,
        "IncludePersistBridgeActive",
        PERSIST_ACTIVE_INCLUDE_FILE
      );
      if (existingIncluderContent.replace(/\r\n/g, "\n").trim() !== nextIncluderContent.trim()) {
        fs.writeFileSync(includerPath, nextIncluderContent, "utf-8");
      }
    } catch (e) {
      logger.warn("Failed to write keypress bridge ini files:", e?.message || e);
    }
    try {
      const original = fs.readFileSync(d3dxPath, "utf-8");
      let normalized = original.replace(/\r\n/g, "\n");
      const nextIncludeTarget = `${QAQM_BRIDGE_DIR}\\${QAQM_INCLUDER_FILE}`;
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
            sectionRanges.push({ start: i, end });
          }
        }
        const uniqueIncludes = [];
        const seenIncludes = /* @__PURE__ */ new Set();
        for (const { start, end } of sectionRanges) {
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
        const removeSet = /* @__PURE__ */ new Set();
        for (const { start, end } of sectionRanges) {
          for (let i = start; i < end; i++) removeSet.add(i);
        }
        const kept = lines.filter((_, i) => !removeSet.has(i));
        while (kept.length > 0 && kept[kept.length - 1].trim() === "") kept.pop();
        kept.push("", "[Include]", ...uniqueIncludes, "");
        normalized = kept.join("\n");
      }
      const alreadyPresent = new RegExp(
        `^\\s*include\\s*=\\s*${escapeRegExp(QAQM_BRIDGE_DIR)}[/\\\\]${escapeRegExp(QAQM_INCLUDER_FILE)}\\s*$`,
        "im"
      ).test(normalized);
      if (!alreadyPresent) {
        const backupPath = `${d3dxPath}.qaqmbak`;
        if (!fs.existsSync(backupPath)) {
          fs.copyFileSync(d3dxPath, backupPath);
        }
        const legacyReplaced = normalized.replace(
          /^(\s*include\s*=\s*)qaqm_includer\.ini(\s*)$/im,
          `$1${nextIncludeTarget}$2`
        );
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
      logger.warn("Failed to patch d3dx.ini for keypress bridge:", e?.message || e);
    }
    preparedKeypressRoots.add(root);
  } catch (e) {
    logger.warn("ensureKeypressBridgeForActiveGame error:", e?.message || e);
  }
}
function setBackgroundKeypressEnabled(enabled) {
  const env = resolveActiveGameEnvRoot();
  if (!env) return;
  const { root } = env;
  const keypressPath = getQaqmBridgeFilePath(root, QAQM_KEYPRESS_FILE);
  try {
    // Window startup only updates this small option. Mod scanning and migration
    // remain in the explicit game-launch/import paths, before the loader starts.
    ensureQaqmBridgeDir(root);
    let content = "";
    if (fs.existsSync(keypressPath)) {
      content = fs.readFileSync(keypressPath, "utf-8");
    }
    let lines = content.split(/\r?\n/).filter((l) => l.length > 0);
    if (lines.length === 0 || !/^\s*\[System\]/i.test(lines[0])) {
      lines = ["[System]", "check_foreground_window = 1"];
    }
    let hasSetting = false;
    lines = lines.map((line) => {
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
    logger.warn("Failed to toggle check_foreground_window in qaqm_keypress.ini:", e?.message || e);
  }
}
function shouldEnableOverlayBackgroundKeypress() {
  return !!currentConfig.overlayAutoReloadEnabled || !!currentConfig.overlayPresetAutoReloadEnabled;
}
const HOTKEY_NO_MODIFIER_CODES = ["VK_CONTROL", "VK_SHIFT", "VK_MENU", "VK_LWIN", "VK_RWIN"];
function createHotkeyTokenDefinition(code, display, options = {}) {
  return {
    code,
    display,
    device: options.device || "keyboard",
    isModifier: !!options.isModifier,
    commandToken: options.commandToken || display,
    implicitCodes: Array.isArray(options.implicitCodes) ? [...options.implicitCodes] : []
  };
}
const HOTKEY_TOKEN_ALIASES = {
  CTRL: createHotkeyTokenDefinition("VK_CONTROL", "Ctrl", { isModifier: true }),
  CONTROL: createHotkeyTokenDefinition("VK_CONTROL", "Ctrl", { isModifier: true }),
  VK_CONTROL: createHotkeyTokenDefinition("VK_CONTROL", "Ctrl", { isModifier: true }),
  VK_LCONTROL: createHotkeyTokenDefinition("VK_LCONTROL", "LCtrl", {
    isModifier: true,
    commandToken: "LCtrl"
  }),
  VK_RCONTROL: createHotkeyTokenDefinition("VK_RCONTROL", "RCtrl", {
    isModifier: true,
    commandToken: "RCtrl"
  }),
  ALT: createHotkeyTokenDefinition("VK_MENU", "Alt", { isModifier: true }),
  MENU: createHotkeyTokenDefinition("VK_MENU", "Alt", { isModifier: true }),
  VK_MENU: createHotkeyTokenDefinition("VK_MENU", "Alt", { isModifier: true }),
  VK_LMENU: createHotkeyTokenDefinition("VK_LMENU", "LAlt", {
    isModifier: true,
    commandToken: "LAlt"
  }),
  VK_RMENU: createHotkeyTokenDefinition("VK_RMENU", "RAlt", {
    isModifier: true,
    commandToken: "RAlt"
  }),
  SHIFT: createHotkeyTokenDefinition("VK_SHIFT", "Shift", { isModifier: true }),
  VK_SHIFT: createHotkeyTokenDefinition("VK_SHIFT", "Shift", { isModifier: true }),
  VK_LSHIFT: createHotkeyTokenDefinition("VK_LSHIFT", "LShift", {
    isModifier: true,
    commandToken: "LShift"
  }),
  VK_RSHIFT: createHotkeyTokenDefinition("VK_RSHIFT", "RShift", {
    isModifier: true,
    commandToken: "RShift"
  }),
  LWIN: createHotkeyTokenDefinition("VK_LWIN", "LWin", { isModifier: true }),
  RWIN: createHotkeyTokenDefinition("VK_RWIN", "RWin", { isModifier: true }),
  VK_LWIN: createHotkeyTokenDefinition("VK_LWIN", "LWin", { isModifier: true }),
  VK_RWIN: createHotkeyTokenDefinition("VK_RWIN", "RWin", { isModifier: true }),
  UP: createHotkeyTokenDefinition("VK_UP", "Up"),
  DOWN: createHotkeyTokenDefinition("VK_DOWN", "Down"),
  LEFT: createHotkeyTokenDefinition("VK_LEFT", "Left"),
  RIGHT: createHotkeyTokenDefinition("VK_RIGHT", "Right"),
  VK_UP: createHotkeyTokenDefinition("VK_UP", "Up"),
  VK_DOWN: createHotkeyTokenDefinition("VK_DOWN", "Down"),
  VK_LEFT: createHotkeyTokenDefinition("VK_LEFT", "Left"),
  VK_RIGHT: createHotkeyTokenDefinition("VK_RIGHT", "Right"),
  ENTER: createHotkeyTokenDefinition("VK_RETURN", "Enter"),
  RETURN: createHotkeyTokenDefinition("VK_RETURN", "Enter"),
  VK_RETURN: createHotkeyTokenDefinition("VK_RETURN", "Enter"),
  ESC: createHotkeyTokenDefinition("VK_ESCAPE", "Esc", { commandToken: "Esc" }),
  ESCAPE: createHotkeyTokenDefinition("VK_ESCAPE", "Esc", { commandToken: "Esc" }),
  VK_ESCAPE: createHotkeyTokenDefinition("VK_ESCAPE", "Esc", { commandToken: "Esc" }),
  TAB: createHotkeyTokenDefinition("VK_TAB", "Tab"),
  VK_TAB: createHotkeyTokenDefinition("VK_TAB", "Tab"),
  BACK: createHotkeyTokenDefinition("VK_BACK", "Backspace", { commandToken: "Backspace" }),
  BACKSPACE: createHotkeyTokenDefinition("VK_BACK", "Backspace", { commandToken: "Backspace" }),
  VK_BACK: createHotkeyTokenDefinition("VK_BACK", "Backspace", { commandToken: "Backspace" }),
  DELETE: createHotkeyTokenDefinition("VK_DELETE", "Delete"),
  DEL: createHotkeyTokenDefinition("VK_DELETE", "Delete"),
  VK_DELETE: createHotkeyTokenDefinition("VK_DELETE", "Delete"),
  INSERT: createHotkeyTokenDefinition("VK_INSERT", "Insert"),
  INS: createHotkeyTokenDefinition("VK_INSERT", "Insert"),
  VK_INSERT: createHotkeyTokenDefinition("VK_INSERT", "Insert"),
  HOME: createHotkeyTokenDefinition("VK_HOME", "Home"),
  VK_HOME: createHotkeyTokenDefinition("VK_HOME", "Home"),
  END: createHotkeyTokenDefinition("VK_END", "End"),
  VK_END: createHotkeyTokenDefinition("VK_END", "End"),
  PAGEUP: createHotkeyTokenDefinition("VK_PRIOR", "PageUp", { commandToken: "PageUp" }),
  PGUP: createHotkeyTokenDefinition("VK_PRIOR", "PageUp", { commandToken: "PageUp" }),
  PRIOR: createHotkeyTokenDefinition("VK_PRIOR", "PageUp", { commandToken: "PageUp" }),
  VK_PRIOR: createHotkeyTokenDefinition("VK_PRIOR", "PageUp", { commandToken: "PageUp" }),
  PAGEDOWN: createHotkeyTokenDefinition("VK_NEXT", "PageDown", { commandToken: "PageDown" }),
  PGDN: createHotkeyTokenDefinition("VK_NEXT", "PageDown", { commandToken: "PageDown" }),
  NEXT: createHotkeyTokenDefinition("VK_NEXT", "PageDown", { commandToken: "PageDown" }),
  VK_NEXT: createHotkeyTokenDefinition("VK_NEXT", "PageDown", { commandToken: "PageDown" }),
  SPACE: createHotkeyTokenDefinition("VK_SPACE", "Space"),
  SPACEBAR: createHotkeyTokenDefinition("VK_SPACE", "Space"),
  VK_SPACE: createHotkeyTokenDefinition("VK_SPACE", "Space"),
  VK_LBUTTON: createHotkeyTokenDefinition("VK_LBUTTON", "鼠标左键", {
    device: "mouse",
    commandToken: "MouseLeft"
  }),
  VK_RBUTTON: createHotkeyTokenDefinition("VK_RBUTTON", "鼠标右键", {
    device: "mouse",
    commandToken: "MouseRight"
  }),
  VK_MBUTTON: createHotkeyTokenDefinition("VK_MBUTTON", "鼠标中键", {
    device: "mouse",
    commandToken: "MouseMiddle"
  }),
  VK_XBUTTON1: createHotkeyTokenDefinition("VK_XBUTTON1", "鼠标侧键1", {
    device: "mouse",
    commandToken: "MouseX1"
  }),
  VK_XBUTTON2: createHotkeyTokenDefinition("VK_XBUTTON2", "鼠标侧键2", {
    device: "mouse",
    commandToken: "MouseX2"
  }),
  LBUTTON: createHotkeyTokenDefinition("VK_LBUTTON", "鼠标左键", {
    device: "mouse",
    commandToken: "MouseLeft"
  }),
  RBUTTON: createHotkeyTokenDefinition("VK_RBUTTON", "鼠标右键", {
    device: "mouse",
    commandToken: "MouseRight"
  }),
  MBUTTON: createHotkeyTokenDefinition("VK_MBUTTON", "鼠标中键", {
    device: "mouse",
    commandToken: "MouseMiddle"
  }),
  XBUTTON1: createHotkeyTokenDefinition("VK_XBUTTON1", "鼠标侧键1", {
    device: "mouse",
    commandToken: "MouseX1"
  }),
  XBUTTON2: createHotkeyTokenDefinition("VK_XBUTTON2", "鼠标侧键2", {
    device: "mouse",
    commandToken: "MouseX2"
  }),
  VK_OEM_MINUS: createHotkeyTokenDefinition("VK_OEM_MINUS", "-", { commandToken: "-" }),
  VK_OEM_PLUS: createHotkeyTokenDefinition("VK_OEM_PLUS", "=", { commandToken: "=" }),
  VK_OEM_COMMA: createHotkeyTokenDefinition("VK_OEM_COMMA", ",", { commandToken: "," }),
  VK_OEM_PERIOD: createHotkeyTokenDefinition("VK_OEM_PERIOD", ".", { commandToken: "." }),
  VK_OEM_1: createHotkeyTokenDefinition("VK_OEM_1", ";", { commandToken: ";" }),
  VK_OEM_2: createHotkeyTokenDefinition("VK_OEM_2", "/", { commandToken: "/" }),
  VK_OEM_3: createHotkeyTokenDefinition("VK_OEM_3", "`", { commandToken: "`" }),
  VK_OEM_4: createHotkeyTokenDefinition("VK_OEM_4", "[", { commandToken: "[" }),
  VK_OEM_5: createHotkeyTokenDefinition("VK_OEM_5", "\\", { commandToken: "\\" }),
  VK_OEM_6: createHotkeyTokenDefinition("VK_OEM_6", "]", { commandToken: "]" }),
  VK_OEM_7: createHotkeyTokenDefinition("VK_OEM_7", "'", { commandToken: "'" }),
  VK_DECIMAL: createHotkeyTokenDefinition("VK_DECIMAL", "NumPad.", {
    commandToken: "NumPadDecimal"
  }),
  VK_ADD: createHotkeyTokenDefinition("VK_ADD", "NumPad+", { commandToken: "NumPadAdd" }),
  VK_SUBTRACT: createHotkeyTokenDefinition("VK_SUBTRACT", "NumPad-", {
    commandToken: "NumPadSubtract"
  }),
  VK_MULTIPLY: createHotkeyTokenDefinition("VK_MULTIPLY", "NumPad*", {
    commandToken: "NumPadMultiply"
  }),
  VK_DIVIDE: createHotkeyTokenDefinition("VK_DIVIDE", "NumPad/", { commandToken: "NumPadDivide" })
};
const HOTKEY_PUNCTUATION_TOKENS = {
  "[": createHotkeyTokenDefinition("VK_OEM_4", "[", { commandToken: "[" }),
  "]": createHotkeyTokenDefinition("VK_OEM_6", "]", { commandToken: "]" }),
  ";": createHotkeyTokenDefinition("VK_OEM_1", ";", { commandToken: ";" }),
  "'": createHotkeyTokenDefinition("VK_OEM_7", "'", { commandToken: "'" }),
  ",": createHotkeyTokenDefinition("VK_OEM_COMMA", ",", { commandToken: "," }),
  ".": createHotkeyTokenDefinition("VK_OEM_PERIOD", ".", { commandToken: "." }),
  "/": createHotkeyTokenDefinition("VK_OEM_2", "/", { commandToken: "/" }),
  "\\": createHotkeyTokenDefinition("VK_OEM_5", "\\", { commandToken: "\\" }),
  "-": createHotkeyTokenDefinition("VK_OEM_MINUS", "-", { commandToken: "-" }),
  "=": createHotkeyTokenDefinition("VK_OEM_PLUS", "=", { commandToken: "=" }),
  "`": createHotkeyTokenDefinition("VK_OEM_3", "`", { commandToken: "`" }),
  "<": createHotkeyTokenDefinition("VK_OEM_COMMA", "<", {
    commandToken: "<",
    implicitCodes: ["VK_SHIFT"]
  }),
  ">": createHotkeyTokenDefinition("VK_OEM_PERIOD", ">", {
    commandToken: ">",
    implicitCodes: ["VK_SHIFT"]
  }),
  _: createHotkeyTokenDefinition("VK_OEM_MINUS", "_", {
    commandToken: "_",
    implicitCodes: ["VK_SHIFT"]
  }),
  "+": createHotkeyTokenDefinition("VK_OEM_PLUS", "+", {
    commandToken: "+",
    implicitCodes: ["VK_SHIFT"]
  }),
  "~": createHotkeyTokenDefinition("VK_OEM_3", "~", {
    commandToken: "~",
    implicitCodes: ["VK_SHIFT"]
  }),
  ":": createHotkeyTokenDefinition("VK_OEM_1", ":", {
    commandToken: ":",
    implicitCodes: ["VK_SHIFT"]
  }),
  '"': createHotkeyTokenDefinition("VK_OEM_7", '"', {
    commandToken: '"',
    implicitCodes: ["VK_SHIFT"]
  }),
  "?": createHotkeyTokenDefinition("VK_OEM_2", "?", {
    commandToken: "?",
    implicitCodes: ["VK_SHIFT"]
  }),
  "|": createHotkeyTokenDefinition("VK_OEM_5", "|", {
    commandToken: "|",
    implicitCodes: ["VK_SHIFT"]
  }),
  "{": createHotkeyTokenDefinition("VK_OEM_4", "{", {
    commandToken: "{",
    implicitCodes: ["VK_SHIFT"]
  }),
  "}": createHotkeyTokenDefinition("VK_OEM_6", "}", {
    commandToken: "}",
    implicitCodes: ["VK_SHIFT"]
  })
};
function cloneHotkeyTokenDefinition(token) {
  if (!token) return null;
  return {
    code: token.code,
    display: token.display,
    device: token.device,
    isModifier: token.isModifier,
    commandToken: token.commandToken,
    implicitCodes: Array.isArray(token.implicitCodes) ? [...token.implicitCodes] : []
  };
}
function normalizeHotkeyTokenDefinition(token) {
  if (!token) return null;
  const raw = String(token).trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (HOTKEY_PUNCTUATION_TOKENS[raw]) {
    return cloneHotkeyTokenDefinition(HOTKEY_PUNCTUATION_TOKENS[raw]);
  }
  if (HOTKEY_TOKEN_ALIASES[upper]) {
    return cloneHotkeyTokenDefinition(HOTKEY_TOKEN_ALIASES[upper]);
  }
  if (/^0X[0-9A-F]+$/.test(upper)) {
    return createHotkeyTokenDefinition(upper, upper, { commandToken: upper });
  }
  if (/^[A-Z]$/.test(upper)) {
    return createHotkeyTokenDefinition(`VK_${upper}`, upper, { commandToken: upper });
  }
  if (/^[0-9]$/.test(upper)) {
    return createHotkeyTokenDefinition(`VK_${upper}`, upper, { commandToken: upper });
  }
  if (/^F([1-9]|1\d|2[0-4])$/.test(upper)) {
    return createHotkeyTokenDefinition(`VK_${upper}`, upper, { commandToken: upper });
  }
  if (/^VK_F([1-9]|1\d|2[0-4])$/.test(upper)) {
    return createHotkeyTokenDefinition(upper, upper.replace(/^VK_/, ""), {
      commandToken: upper.replace(/^VK_/, "")
    });
  }
  if (/^NUMPAD[0-9]$/.test(upper)) {
    const suffix = upper.replace(/^NUMPAD/, "");
    return createHotkeyTokenDefinition(`VK_NUMPAD${suffix}`, `NumPad${suffix}`, {
      commandToken: `NumPad${suffix}`
    });
  }
  if (/^VK_NUMPAD[0-9]$/.test(upper)) {
    const suffix = upper.replace(/^VK_NUMPAD/, "");
    return createHotkeyTokenDefinition(upper, `NumPad${suffix}`, {
      commandToken: `NumPad${suffix}`
    });
  }
  if (/^XB(\d+)?_[A-Z0-9_]+$/.test(upper)) {
    const pretty = upper.replace(/^XB\d*_?/, "").replace(/^XB_/, "").replace(/_/g, " ");
    return createHotkeyTokenDefinition(upper, pretty, { device: "xinput", commandToken: upper });
  }
  return null;
}
function dedupeHotkeyTokens(tokens) {
  const seen = /* @__PURE__ */ new Set();
  return tokens.filter((token) => {
    if (!token || !token.code) return false;
    const key = `${token.device}:${token.code}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function sortHotkeyTokens(tokens) {
  const modifierOrder = {
    VK_CONTROL: 0,
    VK_LCONTROL: 0,
    VK_RCONTROL: 0,
    VK_SHIFT: 1,
    VK_LSHIFT: 1,
    VK_RSHIFT: 1,
    VK_MENU: 2,
    VK_LMENU: 2,
    VK_RMENU: 2,
    VK_LWIN: 3,
    VK_RWIN: 3
  };
  return [...tokens].sort((a, b) => {
    const aWeight = a.isModifier ? modifierOrder[a.code] ?? 9 : 100;
    const bWeight = b.isModifier ? modifierOrder[b.code] ?? 9 : 100;
    if (aWeight !== bWeight) return aWeight - bWeight;
    return 0;
  });
}
function serializeHotkeyTokens(tokens) {
  return tokens.map((token) => ({
    code: token.code,
    display: token.display,
    device: token.device,
    isModifier: !!token.isModifier,
    commandToken: token.commandToken
  }));
}
function parseHotkeyExpression(expression) {
  const original = String(expression || "").trim();
  if (!original) {
    return {
      original: "",
      pressed: [],
      released: [],
      displayKeys: [],
      commandKeys: [],
      unsupportedTokens: [],
      devices: [],
      hasPositive: false,
      canAutoApply: false,
      usesMouse: false,
      usesXInput: false,
      displayLabel: ""
    };
  }
  const sourceTokens = original.split(/\s+/).filter(Boolean);
  const explicitPressed = [];
  const pressed = [];
  const released = [];
  const unsupportedTokens = [];
  const addToken = (tokenList, tokenDef) => {
    const cloned = cloneHotkeyTokenDefinition(tokenDef);
    if (cloned) tokenList.push(cloned);
  };
  sourceTokens.forEach((sourceToken) => {
    const upper = sourceToken.toUpperCase();
    if (upper === "NO_MODIFIERS") {
      HOTKEY_NO_MODIFIER_CODES.forEach((code) => {
        const tokenDef2 = normalizeHotkeyTokenDefinition(code);
        addToken(released, tokenDef2);
      });
      return;
    }
    let negative = false;
    let baseToken = sourceToken;
    if (/^NO_/i.test(sourceToken)) {
      negative = true;
      baseToken = sourceToken.replace(/^NO_/i, "");
    }
    const tokenDef = normalizeHotkeyTokenDefinition(baseToken);
    if (!tokenDef) {
      unsupportedTokens.push(sourceToken);
      return;
    }
    if (negative) {
      addToken(released, tokenDef);
      return;
    }
    explicitPressed.push(cloneHotkeyTokenDefinition(tokenDef));
    (tokenDef.implicitCodes || []).forEach((implicitCode) => {
      const implicitToken = normalizeHotkeyTokenDefinition(implicitCode);
      addToken(pressed, implicitToken);
    });
    addToken(pressed, tokenDef);
  });
  const dedupedPressed = dedupeHotkeyTokens(pressed);
  const dedupedExplicitPressed = dedupeHotkeyTokens(explicitPressed);
  const dedupedReleased = dedupeHotkeyTokens(released);
  const sortedPressed = sortHotkeyTokens(dedupedPressed);
  const sortedExplicitPressed = sortHotkeyTokens(dedupedExplicitPressed);
  const sortedReleased = sortHotkeyTokens(dedupedReleased);
  const devices = [...new Set(sortedPressed.map((token) => token.device))];
  const usesMouse = devices.includes("mouse");
  const usesXInput = devices.includes("xinput");
  const hasPositive = sortedPressed.length > 0;
  const canAutoApply = hasPositive && unsupportedTokens.length === 0 && sortedPressed.every((token) => token.device === "keyboard");
  const displayKeys = sortedExplicitPressed.map((token) => token.display);
  const commandKeys = sortedPressed.map((token) => token.commandToken);
  return {
    original,
    pressed: serializeHotkeyTokens(sortedPressed),
    released: serializeHotkeyTokens(sortedReleased),
    displayKeys,
    commandKeys,
    unsupportedTokens,
    devices,
    hasPositive,
    canAutoApply,
    usesMouse,
    usesXInput,
    displayLabel: displayKeys.length > 0 ? displayKeys.join(" + ") : original
  };
}
function getHotkeyAlternativeRank(alternative) {
  if (!alternative) return 999;
  if (alternative.canAutoApply) return 0;
  if (alternative.hasPositive && alternative.usesMouse) return 1;
  if (alternative.hasPositive && alternative.usesXInput) return 2;
  if (alternative.hasPositive) return 3;
  return 4;
}
function pickPreferredHotkeyAlternative(alternatives) {
  if (!Array.isArray(alternatives) || alternatives.length === 0) return null;
  return [...alternatives].sort(
    (a, b) => getHotkeyAlternativeRank(a) - getHotkeyAlternativeRank(b)
  )[0] || null;
}
function buildHotkeyApplyPayloadFromAlternative(alternative) {
  if (!alternative) return null;
  return {
    original: alternative.original,
    pressed: Array.isArray(alternative.pressed) ? [...alternative.pressed] : [],
    released: Array.isArray(alternative.released) ? [...alternative.released] : [],
    displayKeys: Array.isArray(alternative.displayKeys) ? [...alternative.displayKeys] : [],
    commandKeys: Array.isArray(alternative.commandKeys) ? [...alternative.commandKeys] : [],
    devices: Array.isArray(alternative.devices) ? [...alternative.devices] : [],
    canAutoApply: !!alternative.canAutoApply
  };
}
function buildHotkeyApplyPayloadFromKeys(keys) {
  if (!Array.isArray(keys) || keys.length === 0) return null;
  const parsed = parseHotkeyExpression(keys.join(" "));
  return buildHotkeyApplyPayloadFromAlternative(parsed);
}
function resolveHotkeyApplyPayload(input) {
  if (!input) return null;
  if (Array.isArray(input)) {
    return buildHotkeyApplyPayloadFromKeys(input);
  }
  if (typeof input === "object") {
    if (Array.isArray(input.pressed) || typeof input.original === "string") {
      return {
        original: typeof input.original === "string" ? input.original : "",
        pressed: Array.isArray(input.pressed) ? [...input.pressed] : [],
        released: Array.isArray(input.released) ? [...input.released] : [],
        displayKeys: Array.isArray(input.displayKeys) ? [...input.displayKeys] : [],
        commandKeys: Array.isArray(input.commandKeys) ? [...input.commandKeys] : [],
        devices: Array.isArray(input.devices) ? [...input.devices] : [],
        canAutoApply: !!input.canAutoApply
      };
    }
    if (Array.isArray(input.keys)) {
      return buildHotkeyApplyPayloadFromKeys(input.keys);
    }
  }
  return null;
}
function canAutoApplyHotkeyPayload(payload) {
  const declaredCanAutoApply = typeof payload?.canAutoApply === "boolean" ? payload.canAutoApply : null;
  return !!(payload && Array.isArray(payload.pressed) && payload.pressed.length > 0 && payload.pressed.every((token) => token.device === "keyboard") && declaredCanAutoApply !== false);
}
function getApplyHotkeyUnsupportedMessage(input) {
  const payload = resolveHotkeyApplyPayload(input);
  if (!payload) return "未找到可应用的快捷键";
  if (!Array.isArray(payload.pressed) || payload.pressed.length === 0) {
    return "未找到可应用的快捷键";
  }
  if (payload.pressed.some((token) => token.device === "mouse")) {
    return "当前快捷键为鼠标类按键，出于安全考虑请手动在游戏中操作";
  }
  if (payload.pressed.some((token) => token.device === "xinput")) {
    return "当前快捷键为手柄类按键，暂不支持自动应用";
  }
  return "当前快捷键暂不支持自动应用";
}
function serializeHotkeyForCommand(payload) {
  if (!payload) return "";
  const commandKeys = Array.isArray(payload.commandKeys) ? payload.commandKeys.filter(Boolean) : [];
  if (commandKeys.length > 0) return commandKeys.join("+");
  const displayKeys = Array.isArray(payload.displayKeys) ? payload.displayKeys.filter(Boolean) : [];
  return displayKeys.join("+");
}
function runBundledHelperProcess(command, args = []) {
  return new Promise((resolve, reject) => {
    const child = child_process.spawn(command, args, {
      windowsHide: true,
      stdio: ["ignore", "ignore", "pipe"]
    });
    let stderr = "";
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || `helper exited with code ${code}`));
    });
  });
}
async function runManagedOverlayHelper(kind, hotkeyBase64 = "") {
  let lastError = null;
  const helperExePath = resolveBundledHelperPath("QaqmKeyHelper.exe");
  if (helperExePath && /qaqmkeyhelper\.exe$/i.test(helperExePath) && fs.existsSync(helperExePath)) {
    const args = kind === "reload" ? ["f10"] : ["hotkey", hotkeyBase64];
    try {
      await runBundledHelperProcess(helperExePath, args);
      return true;
    } catch (error) {
      lastError = error;
    }
  }
  const scriptPath = resolveBundledHelperPath(
    kind === "reload" ? "press_f10.ps1" : "press_hotkey.ps1"
  );
  if (scriptPath && /\.ps1$/i.test(scriptPath) && fs.existsSync(scriptPath)) {
    const args = [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      scriptPath
    ];
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
  overlayActivity.invalidate();
  await prepareOverlayActivity();
  const cmd = (currentConfig.overlayAutoReloadCommand || "").trim();
  if (!cmd) return;
  if (isManagedOverlayHelperCommand(cmd, "press_f10")) {
    const handled = await runManagedOverlayHelper("reload");
    if (handled) return;
  }
  return new Promise((resolve) => {
    child_process.exec(cmd, (error) => {
      if (error) {
        logger.warn("Auto reload command failed:", error.message || error);
      }
      resolve();
    });
  });
}
async function applyOverlayHotkey(hotkey) {
  const payload = resolveHotkeyApplyPayload(hotkey);
  if (!payload) {
    throw new Error(getApplyHotkeyUnsupportedMessage(hotkey));
  }
  if (!canAutoApplyHotkeyPayload(payload)) {
    throw new Error(getApplyHotkeyUnsupportedMessage(payload));
  }
  const template = (currentConfig.overlayHotkeyCommandTemplate || "").trim();
  if (!template) {
    throw new Error("未配置快捷键应用脚本，请先在配置中设置 overlayHotkeyCommandTemplate");
  }
  const serialized = serializeHotkeyForCommand(payload);
  const display = Array.isArray(payload.displayKeys) && payload.displayKeys.length > 0 ? payload.displayKeys.join(" + ") : serialized;
  const original = payload.original || display || serialized;
  const hotkeyBase64 = Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
  if (isManagedOverlayHelperCommand(template, "press_hotkey")) {
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
    child_process.exec(cmd, (error) => {
      if (error) {
        logger.warn("Hotkey command failed:", error.message || error);
        return reject(error);
      }
      resolve();
    });
  });
}
function getActiveGame() {
  if (currentConfig.activeGameId && currentConfig.games && currentConfig.games.length > 0) {
    return currentConfig.games.find((g) => g.id === currentConfig.activeGameId) || null;
  }
  return null;
}
function getGameById(gameId2 = getActiveGameScopeId()) {
  const normalizedGameId = String(gameId2 || "").trim();
  if (!normalizedGameId || !Array.isArray(currentConfig.games)) return null;
  return currentConfig.games.find((game) => game.id === normalizedGameId) || null;
}
function getActiveGameScopeId() {
  return getActiveGame()?.id || currentConfig.activeGameId || "endfield";
}
function normalizeMarketGameId(gameId2) {
  const normalized = String(gameId2 || "").trim();
  if (!normalized) {
    return "endfield";
  }
  return normalized;
}
function getMarketGameId(gameId2 = getActiveGameScopeId()) {
  const normalizedGameId = normalizeMarketGameId(gameId2);
  const game = currentConfig.games?.find((entry) => entry.id === normalizedGameId);
  return game?.marketGameId || getBuiltInGameDefinition(normalizedGameId)?.marketGameId || normalizedGameId;
}
function getModCachePath(gameId2 = getActiveGameScopeId()) {
  const marketGameId = normalizeMarketGameId(getMarketGameId(gameId2));
  if (marketGameId === "endfield") {
    return LEGACY_MOD_CACHE_PATH;
  }
  return path.join(electron.app.getPath("userData"), `mod-market-cache-${marketGameId}.json`);
}
const CACHE_SCHEMA_VERSION = 5;
function normalizeCachePayload(cache) {
  return {
    mods: Array.isArray(cache?.mods) ? cache.mods : [],
    lastSyncTimestamp: cache?.lastSyncTimestamp || null,
    marketVersion: cache?.marketVersion || null,
    responseRevision: Number.isFinite(cache?.responseRevision) ? cache.responseRevision : 0,
    marketAccess: normalizeMarketAccessPayload(cache?.marketAccess),
    authScope: String(cache?.authScope || ""),
    accessCheckedAt: cache?.accessCheckedAt || null,
    schemaVersion: Number.isFinite(cache?.schemaVersion) ? cache.schemaVersion : 0
  };
}
function getScopedCharacterOrder() {
  const gameId2 = getActiveGameScopeId();
  if (Array.isArray(currentConfig.characterOrdersByGame?.[gameId2])) {
    return currentConfig.characterOrdersByGame[gameId2];
  }
  if (gameId2 === "endfield" && Array.isArray(currentConfig.characterOrder)) {
    return currentConfig.characterOrder;
  }
  return [];
}
function setScopedCharacterOrder(characterOrder) {
  const gameId2 = getActiveGameScopeId();
  if (!currentConfig.characterOrdersByGame || typeof currentConfig.characterOrdersByGame !== "object") {
    currentConfig.characterOrdersByGame = {};
  }
  currentConfig.characterOrdersByGame[gameId2] = Array.isArray(characterOrder) ? characterOrder : [];
  if (gameId2 === "endfield") {
    currentConfig.characterOrder = currentConfig.characterOrdersByGame[gameId2];
  }
  saveConfig(currentConfig);
}
function getModsPath(gameId2 = getActiveGameScopeId()) {
  return getResolvedGamePaths(gameId2).modsPath || "";
}
function getModsPathStatus({ requireExisting = true, gameId: gameId2 = getActiveGameScopeId() } = {}) {
  const modsPath = getModsPath(gameId2);
  if (!modsPath) {
    return {
      ok: false,
      code: "MODS_PATH_NOT_SET",
      error: "当前游戏未设置 Mods 文件夹，请先到游戏设置中配置。"
    };
  }
  if (requireExisting && !fs.existsSync(modsPath)) {
    return {
      ok: false,
      code: "MODS_PATH_NOT_FOUND",
      error: "当前游戏的 Mods 文件夹不存在，请重新到系统设置中选择。"
    };
  }
  return { ok: true, modsPath };
}
function getModAddedAtScopeKey() {
  const activeGame = getActiveGame();
  if (activeGame?.id) return `game:${activeGame.id}`;
  const modsPath = getModsPath();
  if (modsPath) return `mods:${modsPath}`;
  return "__default__";
}
function getDirectoryBirthtimeMs(dirPath) {
  try {
    const stats = fs.statSync(dirPath);
    if (Number.isFinite(stats.birthtimeMs) && stats.birthtimeMs > 0) {
      return Math.round(stats.birthtimeMs);
    }
    if (Number.isFinite(stats.mtimeMs) && stats.mtimeMs > 0) {
      return Math.round(stats.mtimeMs);
    }
  } catch (_) {
  }
  return Date.now();
}
function createModAddedAtAccessor() {
  if (!currentConfig.modAddedAt || typeof currentConfig.modAddedAt !== "object") {
    currentConfig.modAddedAt = {};
  }
  const scopeKey = getModAddedAtScopeKey();
  if (!currentConfig.modAddedAt[scopeKey] || typeof currentConfig.modAddedAt[scopeKey] !== "object") {
    currentConfig.modAddedAt[scopeKey] = {};
  }
  const scopeStore = currentConfig.modAddedAt[scopeKey];
  let dirty = false;
  return {
    get(characterName, modName, modDirPath) {
      const key = `${characterName}/${modName}`;
      if (!Number.isFinite(scopeStore[key])) {
        scopeStore[key] = getDirectoryBirthtimeMs(modDirPath);
        dirty = true;
      }
      const addedAtMs = scopeStore[key];
      return {
        addedAtMs,
        addedAt: new Date(addedAtMs).toISOString()
      };
    },
    saveIfDirty() {
      if (dirty) {
        saveConfig(currentConfig);
      }
    }
  };
}
const IMAGES_PATH = path.join(electron.app.getPath("userData"), "images");
if (!fs.existsSync(IMAGES_PATH)) {
  fs.mkdirSync(IMAGES_PATH, { recursive: true });
}
const FALLBACK_DEFAULT_CHARACTERS_BY_GAME = {
  endfield: [
    "汤汤",
    "洛茜",
    "男主",
    "女主",
    "佩丽卡",
    "陈千语",
    "莱万汀",
    "伊冯",
    "洁尔佩塔",
    "艾尔黛拉",
    "余烬",
    "别礼",
    "黎风",
    "骏卫",
    "阿列什",
    "弧光",
    "艾维文娜",
    "大潘",
    "昼雪",
    "狼卫",
    "赛希",
    "秋栗",
    "安塔尔",
    "卡契尔",
    "埃特拉",
    "萤石",
    "诀",
    "梨诺",
    "NPC",
    "大世界",
    "UI",
    "功能",
    "武器"
  ],
  zzz: [
    "男主",
    "女主",
    "安比",
    "零号·安比",
    "安东",
    "本",
    "比利",
    "可琳",
    "格莉丝",
    "珂蕾妲",
    "猫又",
    "妮可",
    "艾莲",
    "苍角",
    "莱卡恩",
    "丽娜",
    "11号",
    "朱鸢",
    "青衣",
    "简",
    "赛斯",
    "露西",
    "派派",
    "凯撒",
    "柏妮思",
    "耀嘉音",
    "雅",
    "悠真",
    "伊芙琳",
    "仪玄",
    "橘福福",
    "扳机",
    "薇薇安",
    "雨果",
    "柚叶",
    "爱丽丝",
    "席德",
    "奥菲丝&鬼火",
    "潘引壶",
    "真斗",
    "卢西娅",
    "伊德海莉",
    "般岳",
    "叶瞬光",
    "照",
    "爱芮",
    "千夏",
    "南宫羽",
    "希希芙",
    "普罗米娅",
    "维琳娜",
    "诺姆",
    "柳",
    "波可娜",
    "琉音",
    "莱特",
    "佩洛伊斯",
    "NPC",
    "UI",
    "功能",
    "大世界",
    "武器"
  ],
  "wuthering-waves": [
    "男主",
    "女主",
    "秋水",
    "爱弥斯",
    "奥古斯塔",
    "白芷",
    "布兰特",
    "卜灵",
    "卡卡罗",
    "椿",
    "坎特蕾拉",
    "珂莱塔",
    "卡提希娅",
    "长离",
    "千咲",
    "炽霞",
    "夏空",
    "丹瑾",
    "安可",
    "嘉贝莉娜",
    "绯雪",
    "尤诺",
    "鉴心",
    "今汐",
    "忌炎",
    "凌阳",
    "洛瑟菈",
    "灯灯",
    "露帕",
    "陆·赫斯",
    "琳奈",
    "莫宁",
    "莫特斐",
    "菲比",
    "弗洛洛",
    "仇远",
    "洛可可",
    "散华",
    "守岸人",
    "希格莉卡",
    "桃祈",
    "维里奈",
    "相里要",
    "秧秧",
    "吟霖",
    "釉瑚",
    "渊武",
    "赞妮",
    "折枝",
    "穗穗",
    "秧秧·玄翎",
    "其他",
    "武器",
    "滑翔翼",
    "载具",
    "UI",
    "功能",
    "大世界",
    "NPC"
  ]
};
const FALLBACK_MANUAL_CHARACTER_MAPPINGS_BY_GAME = {
  endfield: {
    endministratormale: { displayName: "男主", canonicalEnName: "EndministratorMale" },
    endministratorfemale: { displayName: "女主", canonicalEnName: "EndministratorFemale" },
    others: { displayName: "其他", canonicalEnName: "Others" },
    weapons: { displayName: "武器", canonicalEnName: "Weapons" },
    陈: { displayName: "陈千语", canonicalEnName: "ChenQianyu" },
    chen: { displayName: "陈千语", canonicalEnName: "ChenQianyu" },
    "chen qianyu": { displayName: "陈千语", canonicalEnName: "ChenQianyu" },
    chenqianyu: { displayName: "陈千语", canonicalEnName: "ChenQianyu" },
    lastrite: { displayName: "别礼", canonicalEnName: "LastRite" },
    "last rite": { displayName: "别礼", canonicalEnName: "LastRite" },
    dapan: { displayName: "大潘", canonicalEnName: "DaPan" },
    "da pan": { displayName: "大潘", canonicalEnName: "DaPan" },
    openworld: { displayName: "大世界", canonicalEnName: "OpenWorld" },
    "open world": { displayName: "大世界", canonicalEnName: "OpenWorld" },
    function: { displayName: "功能", canonicalEnName: "Function" },
    functions: { displayName: "功能", canonicalEnName: "Function" },
    arcane: { displayName: "诀", canonicalEnName: "Arcane" },
    "オクギ": { displayName: "诀", canonicalEnName: "Arcane" },
    liino: { displayName: "梨诺", canonicalEnName: "Liino" },
    "リーノ": { displayName: "梨诺", canonicalEnName: "Liino" },
    管理员: { displayName: "管理员", canonicalEnName: "Endministrator" }
  },
  zzz: {
    wise: { displayName: "男主", canonicalEnName: "Wise" },
    哲: { displayName: "男主", canonicalEnName: "Wise" },
    belle: { displayName: "女主", canonicalEnName: "Belle" },
    铃: { displayName: "女主", canonicalEnName: "Belle" },
    玲: { displayName: "女主", canonicalEnName: "Belle" },
    ssanby: { displayName: "零号·安比", canonicalEnName: "SSAnby" },
    "soldier 0 - anby": { displayName: "零号·安比", canonicalEnName: "SSAnby" },
    jane: { displayName: "简", canonicalEnName: "Jane" },
    "jane doe": { displayName: "简", canonicalEnName: "Jane" },
    astra: { displayName: "耀嘉音", canonicalEnName: "Astra" },
    "astra yao": { displayName: "耀嘉音", canonicalEnName: "Astra" },
    harumasa: { displayName: "悠真", canonicalEnName: "Harumasa" },
    "asaba harumasa": { displayName: "悠真", canonicalEnName: "Harumasa" },
    miyabi: { displayName: "雅", canonicalEnName: "Miyabi" },
    "hoshimi miyabi": { displayName: "雅", canonicalEnName: "Miyabi" },
    lycaon: { displayName: "莱卡恩", canonicalEnName: "Lycaon" },
    "von lycaon": { displayName: "莱卡恩", canonicalEnName: "Lycaon" },
    rina: { displayName: "丽娜", canonicalEnName: "Rina" },
    "alexandrina sebastian": { displayName: "丽娜", canonicalEnName: "Rina" },
    nekomata: { displayName: "猫又", canonicalEnName: "Nekomata" },
    "nekomiya mana": { displayName: "猫又", canonicalEnName: "Nekomata" },
    yanagi: { displayName: "柳", canonicalEnName: "Yanagi" },
    "tsukishiro yanagi": { displayName: "柳", canonicalEnName: "Yanagi" },
    panyinhu: { displayName: "潘引壶", canonicalEnName: "PanYinhu" },
    "pan yinhu": { displayName: "潘引壶", canonicalEnName: "PanYinhu" },
    orphiemagnusson: { displayName: "奥菲丝&鬼火", canonicalEnName: "OrphieMagnusson" },
    "orphie magnusson & magus": { displayName: "奥菲丝&鬼火", canonicalEnName: "OrphieMagnusson" },
    character_others: { displayName: "其他", canonicalEnName: "Character_Others" },
    weapons: { displayName: "武器", canonicalEnName: "Weapons" },
    nangongyu: { displayName: "南宫羽", canonicalEnName: "NangongYu" },
    "nangong yu": { displayName: "南宫羽", canonicalEnName: "NangongYu" },
    南宫羽: { displayName: "南宫羽", canonicalEnName: "NangongYu" },
    南宫玉: { displayName: "南宫羽", canonicalEnName: "NangongYu" },
    cissia: { displayName: "希希芙", canonicalEnName: "Cissia" },
    希希芙: { displayName: "希希芙", canonicalEnName: "Cissia" },
    茜茜娅: { displayName: "希希芙", canonicalEnName: "Cissia" },
    "11号": { displayName: "11号", canonicalEnName: "Soldier11" },
    soldier11: { displayName: "11号", canonicalEnName: "Soldier11" },
    "soldier 11": { displayName: "11号", canonicalEnName: "Soldier11" },
    "「11号」": { displayName: "11号", canonicalEnName: "Soldier11" },
    扳机: { displayName: "扳机", canonicalEnName: "Trigger" },
    "「扳机」": { displayName: "扳机", canonicalEnName: "Trigger" },
    席德: { displayName: "席德", canonicalEnName: "Seed" },
    "「席德」": { displayName: "席德", canonicalEnName: "Seed" },
    "奥菲丝&鬼火": { displayName: "奥菲丝&鬼火", canonicalEnName: "OrphieMagnusson" },
    "奥菲丝&「鬼火」": { displayName: "奥菲丝&鬼火", canonicalEnName: "OrphieMagnusson" },
    openworld: { displayName: "大世界", canonicalEnName: "OpenWorld" },
    "open world": { displayName: "大世界", canonicalEnName: "OpenWorld" },
    function: { displayName: "功能", canonicalEnName: "Function" },
    functions: { displayName: "功能", canonicalEnName: "Function" },
    pyrois: { displayName: "佩洛伊斯", canonicalEnName: "Pyrois" },
    佩洛伊斯: { displayName: "佩洛伊斯", canonicalEnName: "Pyrois" }
  },
  "wuthering-waves": {
    rover: { displayName: "漂泊者", canonicalEnName: "Rover" },
    shorekeeper: { displayName: "守岸人", canonicalEnName: "Shorekeeper" },
    "the shorekeeper": { displayName: "守岸人", canonicalEnName: "Shorekeeper" },
    luuk: { displayName: "陆·赫斯", canonicalEnName: "Luuk" },
    "luuk herssen": { displayName: "陆·赫斯", canonicalEnName: "Luuk" },
    lumi: { displayName: "灯灯", canonicalEnName: "LUMI" },
    xiangliyao: { displayName: "相里要", canonicalEnName: "Xiangliyao" },
    "xiangli yao": { displayName: "相里要", canonicalEnName: "Xiangliyao" },
    others: { displayName: "其他", canonicalEnName: "Others" },
    weapons: { displayName: "武器", canonicalEnName: "Weapons" },
    gliders: { displayName: "滑翔翼", canonicalEnName: "Gliders" },
    vehicles: { displayName: "载具", canonicalEnName: "Vehicles" },
    vehicle: { displayName: "载具", canonicalEnName: "Vehicles" },
    lucilla: { displayName: "洛瑟菈", canonicalEnName: "Lucilla" },
    sigrika: { displayName: "希格莉卡", canonicalEnName: "Sigrika" },
    hiyuki: { displayName: "绯雪", canonicalEnName: "Hiyuki" },
    feixue: { displayName: "绯雪", canonicalEnName: "Hiyuki" },
    suisui: { displayName: "穗穗", canonicalEnName: "Suisui" },
    "穂穂": { displayName: "穗穗", canonicalEnName: "Suisui" },
    "yangyang: xuanling": {
      displayName: "秧秧·玄翎",
      canonicalEnName: "YangyangXuanling"
    },
    "yangyang xuanling": {
      displayName: "秧秧·玄翎",
      canonicalEnName: "YangyangXuanling"
    },
    yangyangxuanling: {
      displayName: "秧秧·玄翎",
      canonicalEnName: "YangyangXuanling"
    },
    "秧秧・玄翎": { displayName: "秧秧·玄翎", canonicalEnName: "YangyangXuanling" },
    露琪拉: { displayName: "洛瑟菈", canonicalEnName: "Lucilla" },
    露西拉: { displayName: "洛瑟菈", canonicalEnName: "Lucilla" },
    希格丽卡: { displayName: "希格莉卡", canonicalEnName: "Sigrika" },
    openworld: { displayName: "大世界", canonicalEnName: "OpenWorld" },
    "open world": { displayName: "大世界", canonicalEnName: "OpenWorld" },
    function: { displayName: "功能", canonicalEnName: "Function" },
    functions: { displayName: "功能", canonicalEnName: "Function" }
  }
};
const CHARACTER_NAME_LOOKUP_CACHE = /* @__PURE__ */ new Map();
const CHARACTER_DIRECTORY_STATS_CACHE = /* @__PURE__ */ new Map();
const characterImageCache = createCharacterImageCache({
  cacheDir: path.join(electron.app.getPath("userData"), "character-image-cache"),
  fetchFn: (...args) => electron.net.fetch(...args),
  onCacheError: (error) => logger.warn("Character image cache unavailable:", error.code || error.message)
});
const characterCatalogService = createCharacterCatalogService({
  cacheDir: path.join(electron.app.getPath("userData"), "character-catalogs"),
  fetchFn: (...args) => electron.net.fetch(...args),
  onUpdate: () => CHARACTER_NAME_LOOKUP_CACHE.clear()
});
function getGameCharacterResourceDir(gameId2 = getActiveGameScopeId()) {
  return {
    "genshin-impact": "genshin-impact",
    endfield: "endfield",
    zzz: "zzz",
    "wuthering-waves": "wuwa",
    "neverness-to-everness": "neverness-to-everness",
    "honkai-star-rail": "honkai-star-rail"
  }[gameId2] || null;
}
function getCharacterConfigForGame(gameId2 = getActiveGameScopeId()) {
  const cacheKey = `config:${gameId2}`;
  if (CHARACTER_NAME_LOOKUP_CACHE.has(cacheKey)) {
    return CHARACTER_NAME_LOOKUP_CACHE.get(cacheKey);
  }
  const fallbackConfig = {
    defaultCharacters: FALLBACK_DEFAULT_CHARACTERS_BY_GAME[gameId2] || [],
    manualMappings: FALLBACK_MANUAL_CHARACTER_MAPPINGS_BY_GAME[gameId2] || {},
    characterNameMap: {
      pairs: []
    }
  };
  const resourceDir = getGameCharacterResourceDir(gameId2);
  if (!resourceDir) {
    CHARACTER_NAME_LOOKUP_CACHE.set(cacheKey, fallbackConfig);
    return fallbackConfig;
  }
  const candidates = [
    ...getBundledResourceCandidates("games", resourceDir, "character-config.json"),
    ...getBundledResourceCandidates(resourceDir, "character-config.json")
  ];
  for (const candidate of candidates) {
    try {
      if (!candidate || !fs.existsSync(candidate)) continue;
      const parsed = JSON.parse(fs.readFileSync(candidate, "utf-8"));
      const config = characterCatalogService.merge(gameId2, {
        defaultCharacters: Array.isArray(parsed?.defaultCharacters) ? parsed.defaultCharacters.map((item) => String(item || "").trim()).filter(Boolean) : fallbackConfig.defaultCharacters,
        manualMappings: parsed?.manualMappings && typeof parsed.manualMappings === "object" ? parsed.manualMappings : fallbackConfig.manualMappings,
        characterNameMap: parsed?.characterNameMap && typeof parsed.characterNameMap === "object" ? parsed.characterNameMap : fallbackConfig.characterNameMap,
        characterImages: parsed?.characterImages || {}
      });
      CHARACTER_NAME_LOOKUP_CACHE.set(cacheKey, config);
      return config;
    } catch (error) {
      logger.warn(`Failed to load character config from ${candidate}:`, error?.message || error);
    }
  }
  CHARACTER_NAME_LOOKUP_CACHE.set(cacheKey, fallbackConfig);
  return fallbackConfig;
}
function getDefaultCharactersForGame(gameId2) {
  return getCharacterConfigForGame(gameId2).defaultCharacters || [];
}
const BASE_APPEARANCE_SECTION_ID = "base";
const CHARACTER_SKIN_CATALOG_CACHE = /* @__PURE__ */ new Map();
const characterSkinCatalogService = createCharacterSkinCatalogService({
  cacheDir: path.join(electron.app.getPath("userData"), "character-skin-catalogs"),
  fetchFn: (...args) => electron.net.fetch(...args),
  onUpdate: (gameId) => CHARACTER_SKIN_CATALOG_CACHE.delete(gameId)
});
function isSafeAppearancePathSegment(value) {
  const normalized = String(value || "").trim();
  const windowsStem = normalized.split(".")[0].toUpperCase();
  return !!normalized && normalized !== "." && normalized !== ".." && !normalized.includes("\0") && !/[<>:"/\\|?*\x00-\x1F]/.test(normalized) && !/[. ]$/.test(normalized) && !/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/.test(windowsStem);
}
function assertSafeAppearancePathSegment(value, label) {
  const normalized = String(value || "").trim();
  if (!isSafeAppearancePathSegment(normalized)) {
    throw new Error(`${label || "名称"}包含不支持的路径字符`);
  }
  return normalized;
}
function getCharacterSkinCatalogIdentityGameStore(gameId2 = getActiveGameScopeId(), { ensure = false } = {}) {
  if (!currentConfig.characterSkinCatalogIdentityByGame || typeof currentConfig.characterSkinCatalogIdentityByGame !== "object" || Array.isArray(currentConfig.characterSkinCatalogIdentityByGame)) {
    if (!ensure) return {};
    currentConfig.characterSkinCatalogIdentityByGame = {};
  }
  const stores = currentConfig.characterSkinCatalogIdentityByGame;
  if (!stores[gameId2] || typeof stores[gameId2] !== "object" || Array.isArray(stores[gameId2])) {
    if (!ensure) return {};
    stores[gameId2] = {};
  }
  return stores[gameId2];
}
function getPersistedCharacterSkinCatalogIdentity(characterName, gameId2 = getActiveGameScopeId()) {
  const store = getCharacterSkinCatalogIdentityGameStore(gameId2);
  const normalizedName = normalizeCharacterFolderKey(characterName);
  if (!normalizedName) return "";
  const matchedKey = Object.keys(store).find(
    (key) => normalizeCharacterFolderKey(key) === normalizedName
  );
  return matchedKey ? String(store[matchedKey] || "").trim() : "";
}
function setPersistedCharacterSkinCatalogIdentity(characterName, identity, gameId2 = getActiveGameScopeId()) {
  const safeCharacterName = assertSafeAppearancePathSegment(characterName, "角色名称");
  const store = getCharacterSkinCatalogIdentityGameStore(gameId2, { ensure: true });
  const normalizedName = normalizeCharacterFolderKey(safeCharacterName);
  for (const key of Object.keys(store)) {
    if (normalizeCharacterFolderKey(key) === normalizedName && key !== safeCharacterName) {
      delete store[key];
    }
  }
  const normalizedIdentity = String(identity || "").trim();
  if (normalizedIdentity) store[safeCharacterName] = normalizedIdentity;
  else delete store[safeCharacterName];
}
function deletePersistedCharacterSkinCatalogIdentity(characterName, gameId2 = getActiveGameScopeId()) {
  const store = getCharacterSkinCatalogIdentityGameStore(gameId2);
  const normalizedName = normalizeCharacterFolderKey(characterName);
  for (const key of Object.keys(store)) {
    if (normalizeCharacterFolderKey(key) === normalizedName) delete store[key];
  }
}
function normalizeAppearanceSectionId(value) {
  return String(value || "").trim().slice(0, 180);
}
function isCustomAppearanceSectionId(sectionId) {
  return normalizeAppearanceSectionId(sectionId).startsWith("custom:");
}
function toLocalFileUrl(filePath) {
  if (!filePath) return null;
  return encodeURI(`file:///${String(filePath).replace(/\\/g, "/")}`);
}
function resolveCharacterSkinImage(catalogPath, imageValue, fallbackImageUrl) {
  const value = String(imageValue || "").trim();
  if (!value) return { imagePath: null, coverUrl: null };
  const cachedCoverUrl = characterImageCache.coverUrl(value, [fallbackImageUrl]);
  if (cachedCoverUrl) return { imagePath: null, coverUrl: cachedCoverUrl };
  if (/^(data:|https?:\/\/|file:\/\/)/i.test(value)) {
    return { imagePath: null, coverUrl: value };
  }
  const imagePath = path.isAbsolute(value) ? value : path.resolve(path.dirname(catalogPath), value);
  return {
    imagePath,
    coverUrl: fs.existsSync(imagePath) ? toLocalFileUrl(imagePath) : null
  };
}
function normalizeCharacterSkinCatalog(parsed, catalogPath, gameId2) {
  const characters = Array.isArray(parsed?.characters) ? parsed.characters : [];
  return {
    schemaVersion: Number(parsed?.schemaVersion || 1),
    gameId: parsed?.gameId || gameId2,
    catalogPath,
    characters: characters.map((character) => {
      const nameZh = String(
        character?.nameZh || character?.characterName || character?.zh || character?.name || ""
      ).trim();
      const nameEn = String(character?.nameEn || character?.characterNameEn || character?.en || "").trim();
      const characterId = String(character?.characterId || "").trim();
      const aliases = Array.isArray(character?.aliases) ? character.aliases.map((alias) => String(alias || "").trim()).filter(Boolean) : [];
      const skins = (Array.isArray(character?.skins) ? character.skins : []).map((skin) => {
        const skinId = String(skin?.id || skin?.skinId || "").trim();
        const sectionId = normalizeAppearanceSectionId(
          skin?.sectionId || (skinId ? `skin:${skinId}` : "")
        );
        if (!skinId || !sectionId) return null;
        const skinAliases = Array.isArray(skin?.aliases) ? skin.aliases.map((alias) => String(alias || "").trim()).filter(Boolean) : [];
        const image = resolveCharacterSkinImage(catalogPath, skin?.sourceImageUrl || skin?.image, skin?.fallbackImageUrl);
        return {
          id: skinId,
          skinId,
          sectionId,
          kind: "official-skin",
          official: true,
          name: String(skin?.nameZh || skin?.nameEn || skinId).trim(),
          nameZh: String(skin?.nameZh || "").trim(),
          nameEn: String(skin?.nameEn || "").trim(),
          aliases: skinAliases,
          image: skin?.image || "",
          imagePath: image.imagePath,
          coverUrl: image.coverUrl,
          sourcePageUrl: skin?.sourcePageUrl || null,
          sourceImageUrl: skin?.sourceImageUrl || skin?.imageSourceUrl || null,
          type: Array.isArray(skin?.type) ? skin.type : skin?.type ? [skin.type] : [],
          genderVariant: skin?.genderVariant || null
        };
      }).filter(Boolean);
      if (!nameZh && !nameEn && !characterId) return null;
      return {
        characterId,
        nameZh,
        nameEn,
        aliases,
        skins
      };
    }).filter(Boolean)
  };
}
function readBundledCharacterSkinCatalog(gameId2 = getActiveGameScopeId()) {
  const resourceDir = getGameCharacterResourceDir(gameId2);
  const emptyCatalog = { schemaVersion: 1, gameId: gameId2, catalogPath: null, characters: [] };
  if (!resourceDir) return emptyCatalog;
  const candidates = [
    ...getBundledResourceCandidates("games", resourceDir, "character-skins", "catalog.json"),
    ...getBundledResourceCandidates(resourceDir, "character-skins", "catalog.json")
  ];
  for (const candidate of candidates) {
    try {
      if (!candidate || !fs.existsSync(candidate)) continue;
      const parsed = JSON.parse(fs.readFileSync(candidate, "utf-8"));
      return { ...parsed, catalogPath: candidate };
    } catch (error) {
      logger.warn(`Failed to load character skin catalog from ${candidate}:`, error?.message || error);
    }
  }
  return emptyCatalog;
}
function getCharacterSkinCatalog(gameId2 = getActiveGameScopeId()) {
  const cacheKey = String(gameId2 || "default");
  if (!CHARACTER_SKIN_CATALOG_CACHE.has(cacheKey)) {
    const bundled = readBundledCharacterSkinCatalog(gameId2);
    const merged = characterSkinCatalogService.merge(gameId2, bundled);
    CHARACTER_SKIN_CATALOG_CACHE.set(cacheKey, normalizeCharacterSkinCatalog(merged, bundled.catalogPath, gameId2));
  }
  return CHARACTER_SKIN_CATALOG_CACHE.get(cacheKey);
}
function getCharacterSkinCatalogEntry(characterName, gameId2 = getActiveGameScopeId()) {
  const aliases = [
    ...getCharacterAliasCandidates(characterName, gameId2),
    getPersistedCharacterSkinCatalogIdentity(characterName, gameId2)
  ].filter(Boolean);
  const aliasKeys = new Set(aliases.map((alias) => normalizeCharacterFolderKey(alias)).filter(Boolean));
  const catalog = getCharacterSkinCatalog(gameId2);
  return catalog.characters.find((character) => {
    const candidates = [
      character.nameZh,
      character.nameEn,
      character.characterId,
      ...Array.isArray(character.aliases) ? character.aliases : []
    ];
    return candidates.some((candidate) => aliasKeys.has(normalizeCharacterFolderKey(candidate)));
  }) || null;
}
function getOfficialAppearanceSections(characterName, gameId2 = getActiveGameScopeId()) {
  const catalogEntry = getCharacterSkinCatalogEntry(characterName, gameId2);
  return (catalogEntry?.skins || []).map((skin) => ({ ...skin }));
}
function getCharacterOfficialSkinCount(characterName, gameId2 = getActiveGameScopeId()) {
  return getOfficialAppearanceSections(characterName, gameId2).length;
}
function ensureCharacterSectionsByGameStore() {
  if (!currentConfig.characterSectionsByGame || typeof currentConfig.characterSectionsByGame !== "object" || Array.isArray(currentConfig.characterSectionsByGame)) {
    currentConfig.characterSectionsByGame = {};
  }
  return currentConfig.characterSectionsByGame;
}
function getCharacterSectionGameStore(gameId2 = getActiveGameScopeId(), { ensure = false } = {}) {
  const allStores = ensure ? ensureCharacterSectionsByGameStore() : currentConfig.characterSectionsByGame;
  if (!allStores || typeof allStores !== "object" || Array.isArray(allStores)) return {};
  if (!allStores[gameId2] || typeof allStores[gameId2] !== "object" || Array.isArray(allStores[gameId2])) {
    if (!ensure) return {};
    allStores[gameId2] = {};
  }
  return allStores[gameId2];
}
function normalizeCustomAppearanceSections(value) {
  const sections = Array.isArray(value) ? value : [];
  const seen = /* @__PURE__ */ new Set();
  return sections.map((section) => {
    const id = normalizeAppearanceSectionId(section?.id || section?.sectionId);
    const name = String(section?.name || section?.nameZh || "").trim().slice(0, 60);
    if (!id || !isCustomAppearanceSectionId(id) || !name || seen.has(id)) return null;
    seen.add(id);
    return {
      id,
      sectionId: id,
      kind: "custom",
      official: false,
      name,
      nameZh: name,
      nameEn: String(section?.nameEn || "").trim().slice(0, 80),
      createdAt: section?.createdAt || null,
      updatedAt: section?.updatedAt || null
    };
  }).filter(Boolean);
}
function getCustomAppearanceSections(characterName, gameId2 = getActiveGameScopeId()) {
  const store = getCharacterSectionGameStore(gameId2);
  const { value } = getCharacterConfigStoreValue(store, characterName, [], gameId2);
  return normalizeCustomAppearanceSections(value);
}
function setCustomAppearanceSections(characterName, sections, gameId2 = getActiveGameScopeId()) {
  const store = getCharacterSectionGameStore(gameId2, { ensure: true });
  const canonicalCharacterName = getCanonicalCharacterConfigKey(characterName, gameId2);
  const normalized = normalizeCustomAppearanceSections(sections);
  if (normalized.length > 0) store[canonicalCharacterName] = normalized;
  else delete store[canonicalCharacterName];
  saveConfig(currentConfig);
  return normalized;
}
function getAppearanceSectionImagesDir(characterName, sectionId, gameId2 = getActiveGameScopeId()) {
  const safeCharacterName = assertSafeAppearancePathSegment(characterName, "角色名称");
  const sectionKey = crypto.createHash("sha256").update(normalizeAppearanceSectionId(sectionId), "utf8").digest("hex").slice(0, 24);
  const characterImagesDir = getScopedCharacterImagesDir(safeCharacterName, gameId2);
  const sectionImagesDir = path.join(characterImagesDir, "sections", sectionKey);
  if (!isPathInsideDirectory(sectionImagesDir, characterImagesDir)) {
    throw new Error("分区封面路径无效");
  }
  return sectionImagesDir;
}
function getAppearanceSectionCoverUrl(characterName, sectionId, gameId2 = getActiveGameScopeId()) {
  const coverPath = findImageFileInDir(
    getAppearanceSectionImagesDir(characterName, sectionId, gameId2),
    { requireCoverPrefix: true }
  );
  return coverPath ? toLocalFileUrl(coverPath) : null;
}
function saveAppearanceSectionCoverImage(characterName, sectionId, imagePath, gameId2 = getActiveGameScopeId()) {
  const targetDir = getAppearanceSectionImagesDir(characterName, sectionId, gameId2);
  fs.mkdirSync(targetDir, { recursive: true });
  const operationId = crypto.randomUUID();
  let ext = "";
  let sourcePath = null;
  let imageBuffer = null;
  if (String(imagePath || "").startsWith("data:")) {
    const matches = String(imagePath).match(/^data:([A-Za-z0-9.+/-]+);base64,(.+)$/);
    if (!matches) throw new Error("Invalid cover data URL");
    const mimeType = matches[1].toLowerCase();
    ext = mimeType === "image/jpeg" ? ".jpg" : mimeType === "image/gif" ? ".gif" : mimeType === "image/webp" ? ".webp" : mimeType === "image/bmp" ? ".bmp" : mimeType === "image/png" ? ".png" : "";
    if (!ext) throw new Error("Unsupported cover image format");
    imageBuffer = Buffer.from(matches[2], "base64");
    if (imageBuffer.length === 0) throw new Error("Cover image is empty");
  } else {
    sourcePath = String(imagePath || "").trim();
    if (!sourcePath || !fs.existsSync(sourcePath)) throw new Error("Cover image not found");
    ext = path.extname(sourcePath).toLowerCase();
    if (![".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"].includes(ext)) {
      throw new Error("Unsupported cover image format");
    }
  }
  const targetPath = path.join(targetDir, `_cover${ext}`);
  const tempPath = path.join(targetDir, `._cover-${operationId}${ext}`);
  if (imageBuffer) fs.writeFileSync(tempPath, imageBuffer);
  else fs.copyFileSync(sourcePath, tempPath);
  if (!fs.existsSync(tempPath) || fs.statSync(tempPath).size <= 0) {
    fs.rmSync(tempPath, { force: true });
    throw new Error("Cover image could not be prepared");
  }
  const previousCovers = fs.readdirSync(targetDir).filter((fileName) => /^_cover\.(png|jpg|jpeg|webp|gif|bmp)$/i.test(fileName)).map((fileName) => ({
    originalPath: path.join(targetDir, fileName),
    backupPath: path.join(targetDir, `.${fileName}.backup-${operationId}`)
  }));
  const movedBackups = [];
  try {
    for (const cover of previousCovers) {
      fs.renameSync(cover.originalPath, cover.backupPath);
      movedBackups.push(cover);
    }
    fs.renameSync(tempPath, targetPath);
  } catch (error) {
    try {
      fs.rmSync(tempPath, { force: true });
      fs.rmSync(targetPath, { force: true });
    } catch (_) {
    }
    for (const cover of movedBackups.reverse()) {
      try {
        if (fs.existsSync(cover.backupPath)) {
          fs.renameSync(cover.backupPath, cover.originalPath);
        }
      } catch (_) {
      }
    }
    throw error;
  }
  for (const cover of movedBackups) {
    try {
      fs.rmSync(cover.backupPath, { force: true });
    } catch (_) {
    }
  }
  return { targetPath, coverUrl: toLocalFileUrl(targetPath) };
}
function getMergedAppearanceSectionDefinitions(characterName, gameId2 = getActiveGameScopeId()) {
  const baseSection = {
    id: BASE_APPEARANCE_SECTION_ID,
    sectionId: BASE_APPEARANCE_SECTION_ID,
    kind: "base",
    official: true,
    name: "原角色",
    nameZh: "原角色",
    nameEn: "Original",
    aliases: [],
    coverUrl: getCharacterCoverUrl(characterName, gameId2)
  };
  const officialSections = getOfficialAppearanceSections(characterName, gameId2);
  const customSections = getCustomAppearanceSections(characterName, gameId2).map((section) => ({
    ...section,
    coverUrl: getAppearanceSectionCoverUrl(characterName, section.sectionId, gameId2)
  }));
  return [baseSection, ...officialSections, ...customSections];
}
function getAppearanceSectionDefinition(characterName, sectionId, gameId2 = getActiveGameScopeId()) {
  const normalized = normalizeAppearanceSectionId(sectionId) || BASE_APPEARANCE_SECTION_ID;
  return getMergedAppearanceSectionDefinitions(characterName, gameId2).find(
    (section) => section.sectionId === normalized
  ) || null;
}
function getAppearanceSectionIdForSkinId(characterName, skinId, gameId2 = getActiveGameScopeId()) {
  const normalizedSkinId = String(skinId || "").trim();
  if (!normalizedSkinId) return null;
  const section = getOfficialAppearanceSections(characterName, gameId2).find(
    (item) => item.skinId === normalizedSkinId || item.id === normalizedSkinId || item.sectionId === normalizedSkinId || item.sectionId === `skin:${normalizedSkinId}`
  );
  return section?.sectionId || null;
}
function resolveKnownAppearanceSectionId(characterName, sectionId, gameId2 = getActiveGameScopeId()) {
  const normalized = normalizeAppearanceSectionId(sectionId);
  if (!normalized || normalized === BASE_APPEARANCE_SECTION_ID) return BASE_APPEARANCE_SECTION_ID;
  return getAppearanceSectionDefinition(characterName, normalized, gameId2) ? normalized : BASE_APPEARANCE_SECTION_ID;
}
function buildAppearanceSectionsWithStats(characterName, mods, gameId2 = getActiveGameScopeId()) {
  const definitions = getMergedAppearanceSectionDefinitions(characterName, gameId2);
  const stats = new Map(
    definitions.map((section) => [section.sectionId, { modCount: 0, enabledCount: 0 }])
  );
  for (const mod of Array.isArray(mods) ? mods : []) {
    const sectionId = stats.has(mod?.appearanceSectionId) ? mod.appearanceSectionId : BASE_APPEARANCE_SECTION_ID;
    const current = stats.get(sectionId) || { modCount: 0, enabledCount: 0 };
    current.modCount += 1;
    if (mod?.enabled) current.enabledCount += 1;
    stats.set(sectionId, current);
  }
  return definitions.map((section) => ({
    ...section,
    ...stats.get(section.sectionId) || { modCount: 0, enabledCount: 0 }
  }));
}
function normalizeCharacterFolderKey(name) {
  return String(name || "").trim().toLowerCase();
}
function getBundledResourceCandidates(...segments) {
  return [
    path.join(electron.app.getAppPath(), "resources", ...segments),
    path.join(process.resourcesPath || "", ...segments),
    path.join(path.dirname(electron.app.getAppPath()), "resources", ...segments)
  ];
}
const NEVERNESS_GAME_ID = "neverness-to-everness";
const NEVERNESS_DX12_META_FILE = ".qaqm-dx12-pak.json";
const NEVERNESS_DX12_PAK_EXTS = [".pak", ".ucas", ".utoc", ".sig"];
const NEVERNESS_DX12_DEFAULT_PAK_DIR = "MOD";
const NEVERNESS_DX12_PAK_DIR_OPTIONS = ["MOD"];
const NEVERNESS_DX12_LOADER_DIR_NAME = "Neverness to Everness Mod Loader";
const NEVERNESS_DX12_LOADER_EXE_NAME = "Game start.exe";
const NEVERNESS_DX12_SIG_BYPASSER_PLUGIN_NAME = "UniversalSigBypasser.asi";
function isNevernessGame(gameId2 = getActiveGameScopeId()) {
  return gameId2 === NEVERNESS_GAME_ID;
}
function getNevernessModMode() {
  return currentConfig.nevernessModMode === "dx12" ? "dx12" : "nemi";
}
function setNevernessModMode(mode) {
  currentConfig.nevernessModMode = mode === "dx12" ? "dx12" : "nemi";
  saveConfig(currentConfig);
  notifyGamesChanged();
}
function getNevernessDx12PakDirName() {
  return NEVERNESS_DX12_DEFAULT_PAK_DIR;
}
function getNevernessDx12DisabledModsDir(gameId2 = NEVERNESS_GAME_ID) {
  const configured = String(getGameById(gameId2)?.nevernessDx12DisabledModsDir || "").trim();
  if (configured) return configured;
  const gameRoot = getNevernessGameRoot(gameId2);
  const driveRoot = gameRoot ? path.parse(gameRoot).root : "";
  return driveRoot ? path.join(driveRoot, "QAQManager_Neverness_Disabled_Pak_Mods") : "";
}
function setNevernessDx12DisabledModsDir(dirPath) {
  const game = (currentConfig.games || []).find((item) => item.id === NEVERNESS_GAME_ID);
  if (!game) throw new Error("未找到异环配置");
  game.nevernessDx12DisabledModsDir = String(dirPath || "").trim();
  saveConfig(currentConfig);
  notifyGamesChanged();
}
function isNevernessDx12Mode(gameId2 = getActiveGameScopeId()) {
  return isNevernessGame(gameId2) && getNevernessModMode() === "dx12";
}
function findFileByNameRecursive(dirPath, fileName) {
  if (!dirPath || !fs.existsSync(dirPath)) return null;
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isFile() && entry.name.toLowerCase() === String(fileName).toLowerCase())
      return fullPath;
    if (entry.isDirectory()) {
      const found = findFileByNameRecursive(fullPath, fileName);
      if (found) return found;
    }
  }
  return null;
}
function findNevernessDx12Resource(...segments) {
  const exactCandidates = getBundledResourceCandidates("dx12", "异环", ...segments);
  for (const candidate of exactCandidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  const fileName = segments[segments.length - 1];
  if (fileName && path.extname(fileName)) {
    for (const resourceRoot of getBundledResourceCandidates("dx12", "异环")) {
      const found = findFileByNameRecursive(resourceRoot, fileName);
      if (found) return found;
    }
  }
  return null;
}
function getNevernessDx12BundledLoaderDir() {
  const loaderExe = findNevernessDx12Resource(
    NEVERNESS_DX12_LOADER_DIR_NAME,
    NEVERNESS_DX12_LOADER_EXE_NAME
  );
  return loaderExe ? path.dirname(loaderExe) : "";
}
function getNevernessDx12ConfiguredLoaderExe(gameId2 = NEVERNESS_GAME_ID) {
  return String(getGameById(gameId2)?.dx12LauncherPath || "").trim();
}
function copyDirectoryRecursive(sourceDir, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
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
    fs.rmSync(testPath, { force: true });
    return true;
  } catch (_) {
    try {
      fs.rmSync(testPath, { force: true });
    } catch (_2) {
    }
    return false;
  }
}
function getNevernessDx12WritableLoaderDir(paths = getNevernessDx12Paths()) {
  const configuredLoaderExe = paths.configuredLoaderExe || "";
  if (configuredLoaderExe) {
    if (!fs.existsSync(configuredLoaderExe)) {
      throw new Error("设置的 Pak 启动器不存在，请在设置中重新选择 Game start.exe");
    }
    const configuredLoaderDir = path.dirname(configuredLoaderExe);
    if (canWriteDirectory(configuredLoaderDir)) {
      return {
        loaderDir: configuredLoaderDir,
        loaderExe: configuredLoaderExe,
        copied: false,
        custom: true
      };
    }
    const runtimeDir2 = path.join(electron.app.getPath("userData"), "dx12", "neverness-loader");
    copyDirectoryRecursive(configuredLoaderDir, runtimeDir2);
    return {
      loaderDir: runtimeDir2,
      loaderExe: path.join(runtimeDir2, path.basename(configuredLoaderExe)),
      copied: true,
      custom: true
    };
  }
  const bundledLoaderDir = getNevernessDx12BundledLoaderDir();
  if (!bundledLoaderDir || !fs.existsSync(path.join(bundledLoaderDir, NEVERNESS_DX12_LOADER_EXE_NAME))) {
    throw new Error("缺少内置 Pak Loader：Game start.exe");
  }
  if (canWriteDirectory(bundledLoaderDir)) {
    return {
      loaderDir: bundledLoaderDir,
      loaderExe: path.join(bundledLoaderDir, NEVERNESS_DX12_LOADER_EXE_NAME),
      copied: false,
      custom: false
    };
  }
  const runtimeDir = path.join(electron.app.getPath("userData"), "dx12", "neverness-loader");
  copyDirectoryRecursive(bundledLoaderDir, runtimeDir);
  return {
    loaderDir: runtimeDir,
    loaderExe: path.join(runtimeDir, NEVERNESS_DX12_LOADER_EXE_NAME),
    copied: true,
    custom: false
  };
}
function writeNevernessDx12LoaderConfig(paths, loaderDir) {
  const launcherPath = paths.officialLauncherPath || getNevernessOfficialLauncherPathFromRoot(paths.gameRoot);
  if (!launcherPath || !fs.existsSync(launcherPath)) {
    throw new Error("未找到异环官方启动器 NTELauncher.exe，请先在设置中选择正确的游戏路径");
  }
  const configPath = path.join(loaderDir, "config.ini");
  const content = [
    "[Settings]",
    "Lang=CN",
    `Launcher=${launcherPath}`,
    "WindowW=500",
    "WindowH=430",
    "Target=HTGame.exe",
    "DllName=MyCustomLoader.dll",
    ""
  ].join("\r\n");
  fs.writeFileSync(configPath, content, "utf-8");
  return { configPath, launcherPath };
}
function findNevernessDx12SigBypasserSource(loaderDir) {
  const loaderPluginPath = loaderDir ? path.join(loaderDir, "plugins", NEVERNESS_DX12_SIG_BYPASSER_PLUGIN_NAME) : "";
  if (loaderPluginPath && fs.existsSync(loaderPluginPath)) return loaderPluginPath;
  const bundledPluginPath = findNevernessDx12Resource(
    NEVERNESS_DX12_LOADER_DIR_NAME,
    "plugins",
    NEVERNESS_DX12_SIG_BYPASSER_PLUGIN_NAME
  );
  if (bundledPluginPath && fs.existsSync(bundledPluginPath)) return bundledPluginPath;
  const resourcePluginPath = findNevernessDx12Resource(
    "plugins",
    NEVERNESS_DX12_SIG_BYPASSER_PLUGIN_NAME
  );
  if (resourcePluginPath && fs.existsSync(resourcePluginPath)) return resourcePluginPath;
  return null;
}
function ensureNevernessDx12SigBypasserPlugin(paths, loaderDir) {
  if (!paths?.win64Dir || !fs.existsSync(paths.win64Dir))
    throw new Error("未找到异环 Win64 目录，请确认游戏目录是否正确。");
  const targetPluginsDir = path.join(paths.win64Dir, "plugins");
  const targetPath = path.join(targetPluginsDir, NEVERNESS_DX12_SIG_BYPASSER_PLUGIN_NAME);
  if (fs.existsSync(targetPath)) return { copied: false, targetPath };
  const sourcePath = findNevernessDx12SigBypasserSource(loaderDir);
  if (!sourcePath) throw new Error(`缺少 Pak 必需插件：${NEVERNESS_DX12_SIG_BYPASSER_PLUGIN_NAME}`);
  try {
    fs.mkdirSync(targetPluginsDir, { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
  } catch (error) {
    throw new Error(
      `写入异环 Pak 插件失败：${formatWindowsFileOperationError(error, { path: targetPath, operation: "copy" })}`
    );
  }
  return { copied: true, sourcePath, targetPath };
}
function inferNevernessGameRootFromPath(inputPath) {
  if (!inputPath) return null;
  const normalized = path.normalize(inputPath);
  const statPath = fs.existsSync(normalized) ? normalized : null;
  const basePath = statPath && fs.statSync(statPath).isFile() ? path.dirname(statPath) : normalized;
  const lower = normalized.toLowerCase();
  const candidates = [];
  const addCandidate = (candidate) => {
    if (candidate && !candidates.includes(candidate)) candidates.push(candidate);
  };
  if (lower.endsWith(`${path.sep.toLowerCase()}ntelauncher.exe`)) {
    const launcherDir = path.dirname(normalized);
    if (path.basename(launcherDir).toLowerCase() === "ntelauncher") {
      addCandidate(path.dirname(launcherDir));
    }
    addCandidate(launcherDir);
  }
  if (lower.endsWith(`${path.sep.toLowerCase()}ntelauncher${path.sep.toLowerCase()}ntegame.exe`)) {
    addCandidate(path.dirname(path.dirname(normalized)));
  }
  if (lower.endsWith(
    `${path.sep.toLowerCase()}client${path.sep.toLowerCase()}windowsnoeditor${path.sep.toLowerCase()}ht${path.sep.toLowerCase()}binaries${path.sep.toLowerCase()}win64${path.sep.toLowerCase()}htgame.exe`
  )) {
    addCandidate(path.resolve(path.dirname(normalized), "..", "..", "..", "..", ".."));
  }
  addCandidate(basePath);
  addCandidate(path.dirname(basePath));
  addCandidate(path.dirname(path.dirname(basePath)));
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, "Client", "WindowsNoEditor", "HT", "Content", "Paks")) || fs.existsSync(
      path.join(candidate, "Client", "WindowsNoEditor", "HT", "Binaries", "Win64", "HTGame.exe")
    )) {
      return candidate;
    }
  }
  for (const candidate of candidates) {
    if (getNevernessOfficialLauncherPathFromRoot(candidate)) return candidate;
  }
  const launcherPath = path.join(basePath, "NTELauncher.exe");
  if (fs.existsSync(launcherPath)) return basePath;
  return candidates[0] || basePath;
}
function getNevernessGameRoot(gameId2 = NEVERNESS_GAME_ID) {
  const targetGame = getGameById(gameId2);
  const candidates = [inferNevernessGameRootFromPath(targetGame?.gamePath)].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, "NTELauncher.exe"))) return candidate;
  }
  return candidates[0] || "";
}
function getNevernessDx12Paths(gameId2 = NEVERNESS_GAME_ID) {
  const gameRoot = getNevernessGameRoot(gameId2);
  const configuredLoaderExe = getNevernessDx12ConfiguredLoaderExe(gameId2);
  const clientDir = gameRoot ? path.join(gameRoot, "Client") : "";
  const win64Dir = gameRoot ? path.join(gameRoot, "Client", "WindowsNoEditor", "HT", "Binaries", "Win64") : "";
  const paksDir = gameRoot ? path.join(gameRoot, "Client", "WindowsNoEditor", "HT", "Content", "Paks") : "";
  const disabledModsDir = getNevernessDx12DisabledModsDir(gameId2);
  const pakDirName = getNevernessDx12PakDirName();
  const pakModsDirs = {};
  for (const option of NEVERNESS_DX12_PAK_DIR_OPTIONS) {
    pakModsDirs[option] = paksDir ? path.join(paksDir, option) : "";
  }
  const bundledLoaderDir = getNevernessDx12BundledLoaderDir();
  const effectiveLoaderExe = configuredLoaderExe || (bundledLoaderDir ? path.join(bundledLoaderDir, NEVERNESS_DX12_LOADER_EXE_NAME) : "");
  const effectiveLoaderDir = effectiveLoaderExe ? path.dirname(effectiveLoaderExe) : "";
  return {
    gameRoot,
    clientDir,
    officialLauncherPath: getNevernessOfficialLauncherPathFromRoot(gameRoot),
    nteGlobalDir: gameRoot ? path.join(gameRoot, "NTEGlobal") : "",
    win64Dir,
    paksDir,
    disabledModsDir,
    pakDirName,
    pakDirOptions: [NEVERNESS_DX12_DEFAULT_PAK_DIR],
    pakModsDirs,
    pakModsDir: pakModsDirs[pakDirName] || "",
    configuredLoaderExe,
    dx12LauncherPath: configuredLoaderExe,
    dx12LoaderExe: effectiveLoaderExe,
    dx12LoaderDir: effectiveLoaderDir,
    bundledLoaderDir,
    bundledLoaderExe: bundledLoaderDir ? path.join(bundledLoaderDir, NEVERNESS_DX12_LOADER_EXE_NAME) : "",
    bundledLoaderConfig: bundledLoaderDir ? path.join(bundledLoaderDir, "config.ini") : "",
    dx12LoaderConfig: effectiveLoaderDir ? path.join(effectiveLoaderDir, "config.ini") : ""
  };
}
function getNevernessDx12Status() {
  const paths = getNevernessDx12Paths();
  const bundledLoaderAvailable = !!paths.bundledLoaderExe && fs.existsSync(paths.bundledLoaderExe);
  const dx12LoaderAvailable = !!paths.dx12LoaderExe && fs.existsSync(paths.dx12LoaderExe);
  const officialLauncherExists = !!paths.officialLauncherPath && fs.existsSync(paths.officialLauncherPath);
  return {
    success: true,
    mode: getNevernessModMode(),
    paths,
    gameRootExists: !!paths.gameRoot && fs.existsSync(paths.gameRoot),
    launcherExists: officialLauncherExists,
    win64Exists: !!paths.win64Dir && fs.existsSync(paths.win64Dir),
    paksDirExists: !!paths.paksDir && fs.existsSync(paths.paksDir),
    pakModsDirExists: !!paths.pakModsDir && fs.existsSync(paths.pakModsDir),
    pakModsDirsExist: Object.fromEntries(
      Object.entries(paths.pakModsDirs || {}).map(([name, dirPath]) => [
        name,
        !!dirPath && fs.existsSync(dirPath)
      ])
    ),
    resources: {
      bundledLoader: bundledLoaderAvailable,
      dx12Loader: dx12LoaderAvailable
    },
    loader: {
      bundledLoaderAvailable,
      dx12LoaderAvailable,
      loaderAvailable: dx12LoaderAvailable,
      officialLauncherExists
    }
  };
}
function isReusableEmptyDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) return true;
  const stat = fs.statSync(dirPath);
  return stat.isDirectory() && fs.readdirSync(dirPath).length === 0;
}
function resolveNevernessDx12ReinstallTargetDir() {
  const baseDir = path.join(getQaqInstallDir(), NEVERNESS_DX12_LOADER_DIR_NAME);
  if (isReusableEmptyDirectory(baseDir)) return baseDir;
  for (let i = 1; i <= 999; i++) {
    const candidate = path.join(getQaqInstallDir(), `${NEVERNESS_DX12_LOADER_DIR_NAME} (${i})`);
    if (isReusableEmptyDirectory(candidate)) return candidate;
  }
  return path.join(getQaqInstallDir(), `${NEVERNESS_DX12_LOADER_DIR_NAME} ${Date.now()}`);
}
function reinstallNevernessDx12Loader() {
  const targetDir = resolveNevernessDx12ReinstallTargetDir();
  fs.mkdirSync(targetDir, { recursive: true });
  const loaderZip = findNevernessDx12Resource(`${NEVERNESS_DX12_LOADER_DIR_NAME}.zip`);
  if (loaderZip && fs.existsSync(loaderZip)) {
    const zip = new AdmZip(loaderZip);
    for (const entry of zip.getEntries()) {
      extractZipEntryWithCjkSupport(entry, targetDir);
    }
  } else {
    const bundledLoaderDir = getNevernessDx12BundledLoaderDir();
    if (!bundledLoaderDir || !fs.existsSync(bundledLoaderDir)) {
      throw new Error("未找到内置 Pak Loader 安装包");
    }
    copyDirectoryRecursive(bundledLoaderDir, targetDir);
  }
  const loaderExe = findFileByNameRecursive(targetDir, NEVERNESS_DX12_LOADER_EXE_NAME);
  if (!loaderExe || !fs.existsSync(loaderExe)) {
    throw new Error(`重装失败，未找到 ${NEVERNESS_DX12_LOADER_EXE_NAME}`);
  }
  const game = (currentConfig.games || []).find((item) => item.id === NEVERNESS_GAME_ID);
  if (game) {
    game.dx12LauncherPath = loaderExe;
    game.launchMode = "DX12";
  }
  currentConfig.nevernessModMode = "dx12";
  saveConfig(currentConfig);
  notifyGamesChanged();
  return {
    ...getNevernessDx12Status(),
    success: true,
    loaderExe,
    loaderDir: path.dirname(loaderExe)
  };
}
function ensureNevernessDx12GamePaths(gameId2 = NEVERNESS_GAME_ID) {
  const paths = getNevernessDx12Paths(gameId2);
  if (!paths.gameRoot || !fs.existsSync(paths.gameRoot))
    throw new Error("未找到异环游戏根目录，请先在设置中选择游戏路径。");
  if (!paths.win64Dir || !fs.existsSync(paths.win64Dir))
    throw new Error("未找到异环 Win64 目录，请确认游戏目录是否正确。");
  if (!paths.paksDir || !fs.existsSync(paths.paksDir))
    throw new Error("未找到异环 Paks 目录，请确认游戏目录是否正确。");
  probeWritableDirectory(paths.pakModsDir, "异环 Pak MOD 目录");
  if (paths.disabledModsDir) probeWritableDirectory(paths.disabledModsDir, "异环关闭 Mod 保存目录");
  return paths;
}
async function launchNevernessDx12Loader() {
  const paths = ensureNevernessDx12GamePaths();
  const { loaderDir, loaderExe, copied, custom } = getNevernessDx12WritableLoaderDir(paths);
  const config = writeNevernessDx12LoaderConfig(paths, loaderDir);
  const sigBypasserPlugin = ensureNevernessDx12SigBypasserPlugin(paths, loaderDir);
  setNevernessModMode("dx12");
  const result = await launchElevated(loaderExe, loaderDir, []);
  if (!result.success) {
    return {
      success: false,
      error: result.error || "请求管理员权限启动 Pak Loader 失败"
    };
  }
  return {
    ...getNevernessDx12Status(),
    success: true,
    launched: true,
    loaderDir,
    loaderExe,
    configPath: config.configPath,
    launcherPath: config.launcherPath,
    sigBypasserPlugin,
    usedCustomLoader: custom,
    usedRuntimeCopy: copied
  };
}
function normalizeNevernessPakFileName(fileName) {
  return String(fileName || "").replace(/\.disabled$/i, "");
}
function getNevernessPakExt(fileName) {
  const normalized = normalizeNevernessPakFileName(fileName).toLowerCase();
  return NEVERNESS_DX12_PAK_EXTS.find((ext) => normalized.endsWith(ext)) || "";
}
function getNevernessPakBaseName(fileName) {
  const ext = getNevernessPakExt(fileName);
  if (!ext) return "";
  const normalized = normalizeNevernessPakFileName(fileName);
  return normalized.slice(0, -ext.length);
}
function walkFiles(dirPath, visitor) {
  if (!dirPath || !fs.existsSync(dirPath)) return;
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) walkFiles(fullPath, visitor);
    else if (entry.isFile()) visitor(fullPath, entry.name);
  }
}
function scanNevernessPakGroups(sourceDir) {
  const groups = /* @__PURE__ */ new Map();
  walkFiles(sourceDir, (filePath, fileName) => {
    const ext = getNevernessPakExt(fileName);
    const baseName = getNevernessPakBaseName(fileName);
    if (!ext || !baseName) return;
    if (!groups.has(baseName)) groups.set(baseName, { baseName, files: {}, sourceFiles: {} });
    const group = groups.get(baseName);
    group.files[ext.slice(1)] = normalizeNevernessPakFileName(fileName);
    group.sourceFiles[ext.slice(1)] = filePath;
  });
  return Array.from(groups.values()).filter(
    (group) => group.sourceFiles.pak && group.sourceFiles.ucas && group.sourceFiles.utoc
  );
}
function hasShallowNevernessPakGroup(sourceDir) {
  if (!sourceDir || !fs.existsSync(sourceDir)) return false;
  if (fs.existsSync(path.join(sourceDir, NEVERNESS_DX12_META_FILE))) return true;
  const groups = /* @__PURE__ */ new Map();
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const ext = getNevernessPakExt(entry.name);
    const baseName = getNevernessPakBaseName(entry.name);
    if (!ext || !baseName) continue;
    if (!groups.has(baseName)) groups.set(baseName, /* @__PURE__ */ new Set());
    groups.get(baseName).add(ext);
  }
  return Array.from(groups.values()).some((exts) => exts.has(".pak") && exts.has(".ucas") && exts.has(".utoc"));
}
async function prepareNevernessDx12PakDetectionSource(filePath) {
  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) return { sourceDir: filePath, cleanup: null };
  const ext = path.extname(filePath).toLowerCase();
  const tempDir = fs.mkdtempSync(path.join(electron.app.getPath("temp"), "qaqm-nte-pak-detect-"));
  const cleanup = () => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_) {
    }
  };
  if (stat.isFile() && isDisguisedMp4(filePath)) {
    await extractDisguisedMp4(filePath, tempDir);
  } else if (ext === ".zip") {
    const zip = new AdmZip(filePath);
    zip.extractAllTo(tempDir, true);
  } else if (ext === ".rar" || ext === ".7z" || ext === ".exe") {
    await extract7zOrRar(filePath, tempDir);
  } else {
    fs.copyFileSync(filePath, path.join(tempDir, path.basename(filePath)));
  }
  return { sourceDir: tempDir, cleanup };
}
async function detectNevernessDx12PakSource(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return { isPak: false, groups: [] };
  let prepared = null;
  try {
    prepared = await prepareNevernessDx12PakDetectionSource(filePath);
    const groups = scanNevernessPakGroups(prepared.sourceDir);
    return { isPak: groups.length > 0, groups };
  } catch (error) {
    logger.warn(`[PakDetect] Failed to inspect ${filePath}: ${error.message}`);
    return { isPak: false, groups: [] };
  } finally {
    prepared?.cleanup?.();
  }
}
function extractNevernessDx12Source(filePath) {
  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) return { sourceDir: filePath, cleanup: null };
  const ext = path.extname(filePath).toLowerCase();
  const tempDir = fs.mkdtempSync(path.join(electron.app.getPath("temp"), "qaqm-nte-dx12-"));
  const cleanup = () => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_) {
    }
  };
  if (ext === ".zip") {
    const zip = new AdmZip(filePath);
    zip.extractAllTo(tempDir, true);
    return { sourceDir: tempDir, cleanup };
  }
  if (ext === ".rar" || ext === ".7z" || ext === ".exe") {
    return { sourceDir: tempDir, cleanup, archive: true };
  }
  const fileName = path.basename(filePath);
  const target = path.join(tempDir, fileName);
  fs.copyFileSync(filePath, target);
  return { sourceDir: tempDir, cleanup };
}
function readNevernessDx12Meta(metaDir) {
  const metaPath = path.join(metaDir, NEVERNESS_DX12_META_FILE);
  if (!fs.existsSync(metaPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(metaPath, "utf-8"));
  } catch (_) {
    return null;
  }
}
function normalizeNevernessDx12PakGroup(group, paths) {
  const files = Array.isArray(group?.files) ? group.files : Object.values(group?.files || {}).filter(Boolean);
  return {
    baseName: group?.baseName || "",
    files,
    pakDirName: group?.pakDirName || paths?.pakDirName || NEVERNESS_DX12_DEFAULT_PAK_DIR
  };
}
function getNevernessDx12ModDirectoryInfo(modDir, paths = getNevernessDx12Paths()) {
  const meta = readNevernessDx12Meta(modDir);
  if (meta?.type === "neverness-dx12-pak") {
    return {
      source: "meta",
      meta,
      groups: (meta.groups || []).map((group) => normalizeNevernessDx12PakGroup(group, paths))
    };
  }
  const groups = scanNevernessPakGroups(modDir);
  if (!groups.length) return null;
  return {
    source: "folder",
    meta: null,
    groups: groups.map((group) => normalizeNevernessDx12PakGroup(group, paths))
  };
}
function isNevernessDx12ModDir(dirPath) {
  return !!dirPath && !!getNevernessDx12ModDirectoryInfo(dirPath);
}
function writeNevernessDx12Meta(metaDir, meta) {
  fs.mkdirSync(metaDir, { recursive: true });
  fs.writeFileSync(path.join(metaDir, NEVERNESS_DX12_META_FILE), JSON.stringify(meta, null, 2));
}
function getNevernessDx12CharacterBasePath({
  ensure = false,
  gameId: gameId2 = NEVERNESS_GAME_ID
} = {}) {
  const paths = ensure ? ensureNevernessDx12GamePaths(gameId2) : getNevernessDx12Paths(gameId2);
  if (ensure && paths.pakModsDir) probeWritableDirectory(paths.pakModsDir, "异环 Pak MOD 目录");
  return paths.pakModsDir || "";
}
function getCharacterDirectoryBasePath(modsPath, gameId2 = getActiveGameScopeId(), { ensure = false } = {}) {
  if (isNevernessDx12Mode(gameId2)) {
    return getNevernessDx12CharacterBasePath({ ensure, gameId: gameId2 });
  }
  if (ensure && modsPath && !fs.existsSync(modsPath)) fs.mkdirSync(modsPath, { recursive: true });
  return modsPath || "";
}
function getNevernessDx12CharacterPath(characterName, { ensure = false, gameId: gameId2 = NEVERNESS_GAME_ID } = {}) {
  const safeCharacterName = assertSafeAppearancePathSegment(characterName, "角色名称");
  const basePath = getNevernessDx12CharacterBasePath({ ensure, gameId: gameId2 });
  if (!basePath) return "";
  const charPath = path.join(basePath, safeCharacterName);
  if (!isPathInsideDirectory(charPath, basePath)) throw new Error("异环角色目录路径无效");
  if (ensure) probeWritableDirectory(charPath, `异环角色目录「${safeCharacterName}」`);
  return charPath;
}
function getNevernessDx12DisabledCharacterPath(characterName, paths = null, { ensure = false, gameId: gameId2 = NEVERNESS_GAME_ID } = {}) {
  const safeCharacterName = assertSafeAppearancePathSegment(characterName, "角色名称");
  const resolvedPaths = paths || getNevernessDx12Paths(gameId2);
  const basePath = resolvedPaths?.disabledModsDir || getNevernessDx12DisabledModsDir(gameId2);
  if (!basePath) return "";
  const charPath = path.join(basePath, safeCharacterName);
  if (!isPathInsideDirectory(charPath, basePath)) throw new Error("异环关闭 Mod 角色目录路径无效");
  if (ensure) probeWritableDirectory(charPath, `异环关闭 Mod 角色目录「${safeCharacterName}」`);
  return charPath;
}
function sendNevernessPakToggleProgress(payload) {
  electron.BrowserWindow.getAllWindows().forEach((window) => {
    if (!window.isDestroyed()) window.webContents.send("neverness:pak-toggle-progress", payload);
  });
}
function toggleNevernessDx12PakFilesInDirectory(modDir, enable) {
  walkFiles(modDir, (filePath, fileName) => {
    const ext = getNevernessPakExt(fileName);
    if (!ext) return;
    const shouldBeDisabled = fileName.toLowerCase().endsWith(".disabled");
    if (shouldBeDisabled) {
      fs.renameSync(filePath, filePath.replace(/\.disabled$/i, ""));
    }
  });
}
function normalizeNevernessDx12PakFilesInDirectory(modDir) {
  toggleNevernessDx12PakFilesInDirectory(modDir);
}
function hasDisabledNevernessDx12PakFile(modDir) {
  let found = false;
  walkFiles(modDir, (_filePath, fileName) => {
    if (found) return;
    if (String(fileName || "").toLowerCase().endsWith(".disabled") && getNevernessPakExt(fileName)) {
      found = true;
    }
  });
  return found;
}
function normalizeNevernessDx12DisabledStorage(disabledCharPath, paths, progressContext = null) {
  if (!disabledCharPath || !fs.existsSync(disabledCharPath)) return { normalized: 0, skipped: 0 };
  let normalized = 0;
  let skipped = 0;
  const entries = fs.readdirSync(disabledCharPath, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const sourcePath = path.join(disabledCharPath, entry.name);
    let targetPath = sourcePath;
    if (entry.name.startsWith("DISABLED_")) {
      const cleanModName = entry.name.replace(/^DISABLED_/i, "").trim();
      if (!cleanModName || !getNevernessDx12ModDirectoryInfo(sourcePath, paths)) {
        skipped += 1;
        continue;
      }
      targetPath = path.join(disabledCharPath, cleanModName);
      if (fs.existsSync(targetPath)) {
        skipped += 1;
        continue;
      }
      if (progressContext) {
        sendNevernessPakToggleProgress({
          ...progressContext,
          current: progressContext.current,
          message: `正在整理旧关闭 Mod：${cleanModName}`
        });
      }
      moveDirectoryWithFallback(sourcePath, targetPath);
      normalized += 1;
    }
    if (hasDisabledNevernessDx12PakFile(targetPath) && getNevernessDx12ModDirectoryInfo(targetPath, paths)) {
      normalizeNevernessDx12PakFilesInDirectory(targetPath);
      normalized += 1;
    }
  }
  return { normalized, skipped };
}
function prepareNevernessDx12ActiveDirectoryForEnable(characterName, targetModName, paths = getNevernessDx12Paths()) {
  const activeCharPath = getNevernessDx12CharacterPath(characterName);
  const disabledCharPath = getNevernessDx12DisabledCharacterPath(characterName, paths, { ensure: true });
  const targetCleanName = String(targetModName || "").replace(/^DISABLED_/i, "").trim();
  const activeEntries = activeCharPath && fs.existsSync(activeCharPath) ? fs.readdirSync(activeCharPath, { withFileTypes: true }).filter((entry) => entry.isDirectory()) : [];
  const moveEntries = activeEntries.filter((entry) => {
    const cleanName = entry.name.replace(/^DISABLED_/i, "").trim();
    return entry.name.startsWith("DISABLED_") && cleanName && cleanName !== targetCleanName;
  });
  const total = Math.max(1, moveEntries.length + 1);
  let migrated = 0;
  let skipped = 0;
  normalizeNevernessDx12DisabledStorage(disabledCharPath, paths, {
    status: "running",
    phase: "prepare",
    characterName,
    modName: targetCleanName,
    enable: true,
    current: 0,
    total
  });
  for (const entry of moveEntries) {
    const sourcePath = path.join(activeCharPath, entry.name);
    const cleanModName = entry.name.replace(/^DISABLED_/i, "").trim();
    if (!cleanModName || !getNevernessDx12ModDirectoryInfo(sourcePath, paths)) {
      skipped += 1;
      continue;
    }
    const targetPath = path.join(disabledCharPath, cleanModName);
    if (fs.existsSync(targetPath)) {
      skipped += 1;
      continue;
    }
    sendNevernessPakToggleProgress({
      status: "running",
      phase: "prepare",
      characterName,
      modName: targetCleanName,
      enable: true,
      current: migrated + 1,
      total,
      message: `正在将其它 Pak Mod 移到未启动目录：${cleanModName}`
    });
    normalizeNevernessDx12PakFilesInDirectory(sourcePath);
    moveDirectoryWithFallback(sourcePath, targetPath);
    migrated += 1;
  }
  if (migrated > 0) clearConflictCache(characterName, getActiveGameScopeId());
  return { migrated, skipped };
}
function findNevernessSigTemplate(paths) {
  try {
    if (!paths?.paksDir || !fs.existsSync(paths.paksDir)) return null;
    const files = fs.readdirSync(paths.paksDir);
    const sig = files.find((file) => file.toLowerCase().endsWith(".sig"));
    return sig ? path.join(paths.paksDir, sig) : null;
  } catch (_) {
    return null;
  }
}
function findNevernessImportPaksFolder(sourceDir) {
  if (!sourceDir || !fs.existsSync(sourceDir)) return "";
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^paks?$/i.test(entry.name)) continue;
    const candidate = path.join(sourceDir, entry.name);
    if (scanNevernessPakGroups(candidate).length > 0) return candidate;
  }
  return "";
}
function resolveNevernessDx12ImportRoot(sourceDir) {
  if (!sourceDir || !fs.existsSync(sourceDir)) return sourceDir;
  if (findNevernessImportPaksFolder(sourceDir) || scanNevernessPakGroups(sourceDir).length > 0)
    return sourceDir;
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
  const directories = entries.filter((entry) => entry.isDirectory());
  if (entries.length === 1 && directories.length === 1) {
    const nestedDir = path.join(sourceDir, directories[0].name);
    if (findNevernessImportPaksFolder(nestedDir) || scanNevernessPakGroups(nestedDir).length > 0)
      return nestedDir;
  }
  return sourceDir;
}
function copyNevernessDx12ImportContent(sourceDir, targetDir) {
  probeWritableDirectory(targetDir, "Pak Mod 目标目录");
  const paksFolder = findNevernessImportPaksFolder(sourceDir);
  if (!paksFolder) {
    copyDirectoryRecursive(sourceDir, targetDir);
    return;
  }
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    if (sourcePath === paksFolder) {
      copyDirectoryRecursive(sourcePath, targetDir);
      continue;
    }
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      copyDirectoryRecursive(sourcePath, targetPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}
function findNevernessDx12ManagedPakFilePath(modDir, charPath, fileName, enabled) {
  const diskName = enabled ? fileName : `${fileName}.disabled`;
  const candidates = [path.join(modDir, diskName), path.join(charPath, diskName)];
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
}
function findNevernessDx12ModDirectory(characterName, modName, enable, paths) {
  const activeCharPath = getNevernessDx12CharacterPath(characterName, { ensure: enable });
  const disabledCharPath = getNevernessDx12DisabledCharacterPath(characterName, paths, { ensure: !enable });
  const candidates = enable ? [
    path.join(disabledCharPath, modName),
    path.join(activeCharPath, `DISABLED_${modName}`),
    path.join(activeCharPath, modName)
  ] : [
    path.join(activeCharPath, modName),
    path.join(activeCharPath, `DISABLED_${modName}`),
    path.join(disabledCharPath, modName)
  ];
  return candidates.find((candidate) => candidate && fs.existsSync(candidate)) || candidates[0];
}
async function importNevernessDx12PakMod(characterName, filePath, modInfo = {}, options = {}) {
  const gameId2 = options.gameId || modInfo.gameId || getActiveGameScopeId();
  characterName = assertSafeAppearancePathSegment(characterName, "角色名称");
  assertCharacterVisible(characterName, gameId2);
  let charPath = getNevernessDx12CharacterPath(characterName, { ensure: true, gameId: gameId2 }) || resolveCharacterPath(characterName, gameId2);
  if (!charPath) return { error: "Character folder not found" };
  const paths = ensureNevernessDx12GamePaths(gameId2);
  const cleanModName = assertSafeAppearancePathSegment(
    String(modInfo.name || path.basename(filePath, path.extname(filePath)) || "Pak Mod").replace(/^DISABLED_/i, "").trim(),
    "Mod 名称"
  );
  const allowDuplicateRename = !!options.allowDuplicateRename || !!modInfo.allowDuplicateRename;
  const availableTarget = getAvailableModFolderName(charPath, cleanModName);
  const metaDir = allowDuplicateRename ? availableTarget.path : path.join(charPath, cleanModName);
  const finalModName = allowDuplicateRename ? availableTarget.name : cleanModName;
  const disabledMetaDir = path.join(charPath, `DISABLED_${cleanModName}`);
  if (!allowDuplicateRename && (fs.existsSync(metaDir) || fs.existsSync(disabledMetaDir)))
    return { error: "Mod with this name already exists" };
  let extracted = null;
  try {
    extracted = extractNevernessDx12Source(filePath);
    if (extracted.archive) {
      await extract7zOrRar(filePath, extracted.sourceDir);
    }
    const importRoot = resolveNevernessDx12ImportRoot(extracted.sourceDir);
    const groups = scanNevernessPakGroups(importRoot);
    if (!groups.length) throw new Error("未找到完整的 Pak Mod 三件套（.pak/.ucas/.utoc）。");
    copyNevernessDx12ImportContent(importRoot, metaDir);
    const importedGroups = scanNevernessPakGroups(metaDir);
    if (!importedGroups.length)
      throw new Error("导入后未找到完整的 Pak Mod 三件套（.pak/.ucas/.utoc）。");
    const copiedGroups = [];
    for (const group of importedGroups) {
      const copiedFiles = Object.values(group.files || {}).filter(Boolean);
      if (!group.sourceFiles.sig) {
        const sigTemplate = findNevernessSigTemplate(paths);
        if (sigTemplate) {
          const sigFileName = `${group.baseName}.sig`;
          const sigTargetPath = path.join(metaDir, sigFileName);
          if (!fs.existsSync(sigTargetPath) && !fs.existsSync(`${sigTargetPath}.disabled`)) {
            fs.copyFileSync(sigTemplate, sigTargetPath);
            copiedFiles.push(sigFileName);
          }
        }
      }
      copiedGroups.push({
        baseName: group.baseName,
        files: copiedFiles,
        pakDirName: paths.pakDirName
      });
    }
    writeNevernessDx12Meta(metaDir, {
      type: "neverness-dx12-pak",
      name: finalModName,
      characterName,
      pakDirName: paths.pakDirName,
      groups: copiedGroups,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    const appearance = assignInstalledModAppearance({
      characterName,
      modName: finalModName,
      modDir: metaDir,
      requested: modInfo,
      gameId: gameId2,
      source: extractRequestedAppearanceTarget(modInfo).sectionId || extractRequestedAppearanceTarget(modInfo).skinId ? "explicit-install" : "name-match"
    });
    clearConflictCache(characterName, gameId2);
    if (options.notify !== false) {
      notifyCharacterListChanged(characterName, {
        modName: finalModName,
        reason: "neverness-import"
      });
    }
    return {
      success: true,
      modMode: "pak",
      characterName,
      modName: finalModName,
      targetPath: metaDir,
      appearanceSectionId: appearance.sectionId,
      renamedDueToDuplicate: allowDuplicateRename && !!availableTarget.duplicate,
      duplicateOf: availableTarget.duplicate ? availableTarget.duplicateOf : null
    };
  } catch (error) {
    try {
      fs.rmSync(metaDir, { recursive: true, force: true });
    } catch (_) {
    }
    return {
      error: formatWindowsFileOperationError(error, { path: metaDir, operation: "import-pak" })
    };
  } finally {
    extracted?.cleanup?.();
  }
}
function getNevernessDx12Mods(characterName) {
  const gameId2 = getActiveGameScopeId();
  const charPath = getNevernessDx12CharacterPath(characterName, { ensure: true }) || resolveCharacterPath(characterName, gameId2);
  if (!charPath || !fs.existsSync(charPath)) return { error: "Character not found" };
  const paths = getNevernessDx12Paths();
  const disabledCharPath = getNevernessDx12DisabledCharacterPath(characterName, paths);
  const addedAtAccessor = createModAddedAtAccessor();
  const sourceDirs = [
    { dirPath: charPath, enabled: true },
    { dirPath: disabledCharPath, enabled: false }
  ].filter((source) => source.dirPath && fs.existsSync(source.dirPath));
  const mods = sourceDirs.flatMap((source) => fs.readdirSync(source.dirPath, { withFileTypes: true }).map((entry) => ({ entry, source }))).filter((item) => item.entry.isDirectory()).map(({ entry, source }) => {
    const originalName = entry.name;
    const metaDir = path.join(source.dirPath, originalName);
    const modInfo = getNevernessDx12ModDirectoryInfo(metaDir, paths);
    if (!modInfo) return null;
    const isDisabled = originalName.startsWith("DISABLED_");
    const displayName = isDisabled ? originalName.replace("DISABLED_", "") : originalName;
    const { addedAt, addedAtMs } = addedAtAccessor.get(characterName, displayName, metaDir);
    const previewImagePath = findModPreviewImageFile(metaDir);
    let notes = "";
    let tags = [];
    let tagMeta = {};
    try {
      const tagsFile = path.join(metaDir, "tags.json");
      if (fs.existsSync(tagsFile)) {
        tagMeta = JSON.parse(fs.readFileSync(tagsFile, "utf-8")) || {};
        notes = typeof tagMeta.notes === "string" ? tagMeta.notes : "";
        tags = Array.isArray(tagMeta.tags) ? tagMeta.tags.map((t) => typeof t === "string" ? t : t?.name || "").filter(Boolean) : [];
      }
    } catch (_) {
    }
    return {
      name: displayName,
      originalName,
      enabled: source.enabled && !isDisabled,
      path: metaDir,
      previewUrl: previewImagePath ? "file:///" + previewImagePath.replace(/\\/g, "/") : null,
      addedAt,
      addedAtMs,
      tags,
      notes,
      hotkeyAliases: {},
      appearanceSectionId: resolveModAppearanceSectionId({
        characterName,
        modName: displayName,
        modDir: metaDir,
        meta: tagMeta,
        gameId: gameId2
      }),
      modType: "dx12-pak",
      pakModsDir: paths.pakModsDir,
      pakGroups: modInfo.groups || []
    };
  }).filter(Boolean);
  const orderedMods = movePinnedModsToTop(applyPinnedStateToMods(characterName, mods));
  const sections = buildAppearanceSectionsWithStats(characterName, orderedMods, gameId2);
  addedAtAccessor.saveIfDirty();
  return {
    success: true,
    mods: orderedMods,
    sections,
    enabledSectionIds: sections.filter((section) => section.enabledCount > 0).map((section) => section.sectionId),
    characterAliases: getCharacterAliasCandidates(characterName, gameId2)
  };
}
function toggleNevernessDx12PakMod(characterName, modName, enable) {
  const gameId2 = getActiveGameScopeId();
  if (enable && isCharacterHidden(characterName, gameId2)) return { error: "该角色已隐藏，请先恢复显示" };
  const charPath = getNevernessDx12CharacterPath(characterName, { ensure: true }) || resolveCharacterPath(characterName, gameId2);
  if (!charPath) return { error: "Character folder not found" };
  const paths = getNevernessDx12Paths();
  const currentPath = findNevernessDx12ModDirectory(characterName, modName, enable, paths);
  const targetCharPath = enable ? getNevernessDx12CharacterPath(characterName, { ensure: true }) : getNevernessDx12DisabledCharacterPath(characterName, paths, { ensure: true });
  const cleanModName = path.basename(currentPath).replace(/^DISABLED_/i, "");
  const newPath = path.join(targetCharPath, cleanModName);
  const modInfo = getNevernessDx12ModDirectoryInfo(currentPath, paths);
  if (!modInfo) return { error: "Pak Mod not found" };
  if (path.resolve(currentPath) === path.resolve(newPath)) return { success: true, persistRestored: false, autoReloaded: false };
  if (fs.existsSync(newPath)) return { error: `目标目录已存在：${newPath}` };
  if (enable) prepareNevernessDx12ActiveDirectoryForEnable(characterName, modName, paths);
  sendNevernessPakToggleProgress({ status: "running", characterName, modName, enable, current: 0, total: 1, message: enable ? "正在启用 Pak Mod..." : "正在关闭 Pak Mod..." });
  if (!modInfo.meta || hasDisabledNevernessDx12PakFile(currentPath)) {
    normalizeNevernessDx12PakFilesInDirectory(currentPath);
  }
  moveDirectoryWithFallback(currentPath, newPath);
  clearConflictCache(characterName, gameId2);
  sendNevernessPakToggleProgress({ status: "done", characterName, modName, enable, current: 1, total: 1, message: enable ? "Pak Mod 已放入生效目录" : "Pak Mod 已移动到关闭保存目录" });
  notifyCharacterListChanged(characterName, {
    modName,
    reason: "neverness-toggle"
  });
  return { success: true, persistRestored: false, autoReloaded: false };
}
async function deleteNevernessDx12PakMod(characterName, modName) {
  const gameId2 = getActiveGameScopeId();
  const charPath = getNevernessDx12CharacterPath(characterName, { ensure: true }) || resolveCharacterPath(characterName, gameId2);
  if (!charPath) return { error: "Character folder not found" };
  const paths = getNevernessDx12Paths();
  const disabledCharPath = getNevernessDx12DisabledCharacterPath(characterName, paths);
  let metaDir = path.join(charPath, modName);
  if (!fs.existsSync(metaDir)) metaDir = path.join(charPath, `DISABLED_${modName}`);
  if (!fs.existsSync(metaDir) && disabledCharPath) metaDir = path.join(disabledCharPath, modName);
  if (!fs.existsSync(metaDir) && disabledCharPath) metaDir = path.join(disabledCharPath, `DISABLED_${modName}`);
  const modInfo = getNevernessDx12ModDirectoryInfo(metaDir, paths);
  if (!modInfo) return { error: "Pak Mod not found" };
  if (modInfo.source === "meta") {
    for (const group of modInfo.groups || []) {
      for (const fileName of group.files || []) {
        for (const enabled of [true, false]) {
          await movePathToRecycleBin(
            findNevernessDx12ManagedPakFilePath(metaDir, charPath, fileName, enabled),
            "delete Neverness managed Pak file"
          );
        }
      }
    }
  }
  await movePathToRecycleBin(metaDir, "delete Neverness Pak mod");
  clearConflictCache(characterName, gameId2);
  notifyCharacterListChanged(characterName, {
    modName,
    reason: "neverness-delete"
  });
  return { success: true, recycled: true };
}
function getScopedCharacterImagesDir(characterName, gameId2 = getActiveGameScopeId()) {
  const safeGameId = assertSafeAppearancePathSegment(gameId2 || "default", "游戏 ID");
  const safeCharacterName = assertSafeAppearancePathSegment(characterName, "角色名称");
  return path.join(IMAGES_PATH, safeGameId, safeCharacterName);
}
function findImageFileInDir(dirPath, { requireCoverPrefix = false } = {}) {
  if (!dirPath || !fs.existsSync(dirPath)) return null;
  const files = fs.readdirSync(dirPath);
  const targetFile = files.find((fileName) => {
    if (!/\.(png|jpg|jpeg|webp|gif|bmp)$/i.test(fileName)) return false;
    if (requireCoverPrefix && !fileName.startsWith("_cover")) return false;
    return true;
  });
  return targetFile ? path.join(dirPath, targetFile) : null;
}
function findModPreviewImageFile(dirPath) {
  if (!dirPath || !fs.existsSync(dirPath)) return null;
  const files = fs.readdirSync(dirPath);
  let imageFile = files.find(
    (fileName) => fileName.startsWith("preview.") && /\.(png|jpg|jpeg|webp|gif|bmp)$/i.test(fileName)
  );
  if (!imageFile) {
    imageFile = files.find((fileName) => /\.(png|jpg|jpeg|webp|gif|bmp)$/i.test(fileName));
  }
  return imageFile ? path.join(dirPath, imageFile) : null;
}
function getImageMimeTypeFromExt(ext) {
  return {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".tiff": "image/tiff",
    ".tif": "image/tiff"
  }[String(ext || "").toLowerCase()] || "image/jpeg";
}
function readImageAsDataUrl(imagePath) {
  if (!imagePath || !fs.existsSync(imagePath)) return null;
  const ext = path.extname(imagePath).toLowerCase();
  const imageBuffer = fs.readFileSync(imagePath);
  return `data:${getImageMimeTypeFromExt(ext)};base64,${imageBuffer.toString("base64")}`;
}
function findImageFileInChildDirs(dirPath) {
  if (!dirPath || !fs.existsSync(dirPath)) return null;
  const childDirs = fs.readdirSync(dirPath, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  for (const childDir of childDirs) {
    const imagePath = findImageFileInDir(path.join(dirPath, childDir.name));
    if (imagePath) return imagePath;
  }
  return null;
}
function findCharacterCoverFilePath(characterName, gameId2 = getActiveGameScopeId(), modsPath = getModsPath(gameId2)) {
  const resolvedEntry = resolveCharacterEntry(characterName, gameId2);
  const aliases = getCharacterAliasCandidates(characterName, gameId2, resolvedEntry);
  const pathAliases = aliases.filter(isSafeAppearancePathSegment);
  for (const alias of pathAliases) {
    const scopedCoverPath = findImageFileInDir(getScopedCharacterImagesDir(alias, gameId2), {
      requireCoverPrefix: true
    });
    if (scopedCoverPath) return scopedCoverPath;
  }
  for (const alias of pathAliases) {
    const legacyCoverPath = findImageFileInDir(path.join(IMAGES_PATH, alias), {
      requireCoverPrefix: true
    });
    if (legacyCoverPath) return legacyCoverPath;
  }
  if (modsPath) {
    if (isNevernessDx12Mode(gameId2)) {
      for (const alias of pathAliases) {
        const paths = getNevernessDx12Paths(gameId2);
        const dx12CharacterPaths = [
          path.join(modsPath, alias),
          getNevernessDx12DisabledCharacterPath(alias, paths, { gameId: gameId2 })
        ].filter(Boolean);
        for (const dx12CharacterPath of dx12CharacterPaths) {
          const dx12RootCoverPath = findImageFileInDir(dx12CharacterPath);
          if (dx12RootCoverPath) return dx12RootCoverPath;
          const dx12ModCoverPath = findImageFileInChildDirs(dx12CharacterPath);
          if (dx12ModCoverPath) return dx12ModCoverPath;
        }
      }
    }
    for (const alias of pathAliases) {
      const modCoverPath = findImageFileInDir(path.join(modsPath, alias), {
        requireCoverPrefix: true
      });
      if (modCoverPath) return modCoverPath;
    }
  }
  return null;
}
function getCharacterNameMapForGame(gameId2 = getActiveGameScopeId()) {
  const cacheKey = `map:${gameId2}`;
  if (CHARACTER_NAME_LOOKUP_CACHE.has(cacheKey)) {
    return CHARACTER_NAME_LOOKUP_CACHE.get(cacheKey);
  }
  const characterNameMap = getCharacterConfigForGame(gameId2).characterNameMap;
  const pairs = Array.isArray(characterNameMap?.pairs) ? characterNameMap.pairs : [];
  CHARACTER_NAME_LOOKUP_CACHE.set(cacheKey, pairs);
  return pairs;
}
function buildCharacterNameLookup(gameId2 = getActiveGameScopeId()) {
  const cacheKey = `lookup:${gameId2}`;
  if (CHARACTER_NAME_LOOKUP_CACHE.has(cacheKey)) {
    return CHARACTER_NAME_LOOKUP_CACHE.get(cacheKey);
  }
  const byDisplayKey = /* @__PURE__ */ new Map();
  const byDiskKey = /* @__PURE__ */ new Map();
  const pairs = getCharacterNameMapForGame(gameId2);
  pairs.forEach((pair) => {
    const displayName = String(pair?.zh || "").trim();
    const canonicalEnName = String(pair?.en || "").trim();
    const jasmName = String(pair?.jasmName || "").trim();
    const aliases = Array.isArray(pair?.aliases) ? pair.aliases.map((alias) => String(alias || "").trim()).filter(Boolean) : [];
    if (!displayName || !canonicalEnName) return;
    const entry = {
      gameId: gameId2,
      displayName,
      canonicalEnName,
      jasmName: jasmName || null,
      displayKey: normalizeCharacterFolderKey(displayName),
      canonicalEnKey: normalizeCharacterFolderKey(canonicalEnName),
      aliases
    };
    byDisplayKey.set(entry.displayKey, entry);
    byDiskKey.set(entry.canonicalEnKey, entry);
    if (jasmName) {
      byDiskKey.set(normalizeCharacterFolderKey(jasmName), entry);
    }
    entry.aliases.forEach((alias) => {
      byDiskKey.set(normalizeCharacterFolderKey(alias), entry);
    });
  });
  const lookup = { byDisplayKey, byDiskKey };
  CHARACTER_NAME_LOOKUP_CACHE.set(cacheKey, lookup);
  return lookup;
}
function getManualCharacterMappingEntry(name, gameId2 = getActiveGameScopeId()) {
  const normalizedKey = normalizeCharacterFolderKey(name);
  if (!normalizedKey) return null;
  const manualEntry = getCharacterConfigForGame(gameId2).manualMappings?.[normalizedKey];
  if (!manualEntry) return null;
  return {
    gameId: gameId2,
    displayName: manualEntry.displayName,
    canonicalEnName: manualEntry.canonicalEnName,
    displayKey: normalizeCharacterFolderKey(manualEntry.displayName),
    canonicalEnKey: normalizeCharacterFolderKey(manualEntry.canonicalEnName),
    aliases: []
  };
}
function mergeCharacterMappingAliases(entry, gameId2 = getActiveGameScopeId()) {
  if (!entry?.displayName && !entry?.canonicalEnName) return entry;
  const lookup = buildCharacterNameLookup(gameId2);
  const candidates = [
    entry.displayName,
    entry.canonicalEnName,
    entry.jasmName,
    ...Array.isArray(entry.aliases) ? entry.aliases : []
  ];
  const mergedAliases = new Set(
    Array.isArray(entry.aliases) ? entry.aliases.filter(Boolean) : []
  );
  let mappedJasmName = entry.jasmName || null;
  for (const candidate of candidates) {
    const key = normalizeCharacterFolderKey(candidate);
    if (!key) continue;
    const mapped = lookup.byDisplayKey.get(key) || lookup.byDiskKey.get(key);
    if (!mapped) continue;
    if (!mappedJasmName && mapped.jasmName) mappedJasmName = mapped.jasmName;
    [mapped.displayName, mapped.canonicalEnName, mapped.jasmName].forEach((alias) => {
      if (alias) mergedAliases.add(alias);
    });
    if (Array.isArray(mapped.aliases)) {
      mapped.aliases.forEach((alias) => {
        if (alias) mergedAliases.add(alias);
      });
    }
  }
  return {
    ...entry,
    jasmName: mappedJasmName,
    aliases: Array.from(mergedAliases)
  };
}
function getCharacterMappingEntry(name, gameId2 = getActiveGameScopeId()) {
  const normalizedKey = normalizeCharacterFolderKey(name);
  if (!normalizedKey) return null;
  const manualEntry = getManualCharacterMappingEntry(name, gameId2);
  if (manualEntry) return mergeCharacterMappingAliases(manualEntry, gameId2);
  const lookup = buildCharacterNameLookup(gameId2);
  const mappedEntry = lookup.byDisplayKey.get(normalizedKey) || lookup.byDiskKey.get(normalizedKey) || null;
  return mappedEntry ? mergeCharacterMappingAliases(mappedEntry, gameId2) : null;
}
function getCharacterAliasCandidates(characterName, gameId2 = getActiveGameScopeId(), resolvedEntry = null) {
  const aliases = [];
  const addAlias = (value) => {
    const normalized = String(value || "").trim();
    if (!normalized || aliases.includes(normalized)) return;
    aliases.push(normalized);
  };
  addAlias(characterName);
  addAlias(getPersistedCharacterSkinCatalogIdentity(characterName, gameId2));
  const mappingEntry = getCharacterMappingEntry(characterName, gameId2);
  if (mappingEntry) {
    addAlias(mappingEntry.displayName);
    addAlias(mappingEntry.canonicalEnName);
    if (mappingEntry.jasmName) addAlias(mappingEntry.jasmName);
    if (Array.isArray(mappingEntry.aliases)) {
      mappingEntry.aliases.forEach(addAlias);
    }
  }
  if (resolvedEntry) {
    addAlias(resolvedEntry.displayName);
    addAlias(resolvedEntry.diskName);
    addAlias(resolvedEntry.canonicalEnName);
  }
  return aliases;
}
function getCharacterDirectoryStats(characterRootPath) {
  try {
    const entries = fs.readdirSync(characterRootPath, { withFileTypes: true });
    const stat = fs.statSync(characterRootPath);
    const cacheKey = `${getActiveGameScopeId()}|${characterRootPath}|${stat.mtimeMs}|${entries.length}|${isNevernessDx12Mode() ? "dx12" : "std"}`;
    if (CHARACTER_DIRECTORY_STATS_CACHE.has(cacheKey)) return CHARACTER_DIRECTORY_STATS_CACHE.get(cacheKey);
    const modDirs = entries.filter((entry) => {
      if (!entry.isDirectory()) return false;
      if (isNevernessDx12Mode()) {
        if (entry.name.startsWith(".")) return false;
        return hasShallowNevernessPakGroup(path.join(characterRootPath, entry.name));
      }
      return true;
    });
    const stats = {
      modCount: modDirs.length,
      enabledCount: modDirs.filter((entry) => !entry.name.startsWith("DISABLED_")).length,
      fileCount: entries.length,
      hasInfoJson: entries.some((entry) => entry.isFile() && /^info\.json$/i.test(entry.name))
    };
    CHARACTER_DIRECTORY_STATS_CACHE.set(cacheKey, stats);
    if (CHARACTER_DIRECTORY_STATS_CACHE.size > 800) CHARACTER_DIRECTORY_STATS_CACHE.clear();
    return stats;
  } catch (_) {
    return {
      modCount: 0,
      enabledCount: 0,
      fileCount: 0,
      hasInfoJson: false
    };
  }
}
function compareCharacterDirectoryEntries(left, right) {
  const score = (entry) => {
    const hasModsBonus = entry.modCount > 0 ? 1e5 : 0;
    const mappedBonus = entry.mapped ? 1e3 : 0;
    const infoBonus = entry.hasInfoJson ? 100 : 0;
    const fileBonus = entry.fileCount > 0 ? 10 : 0;
    return hasModsBonus + mappedBonus + infoBonus + fileBonus + entry.modCount;
  };
  const scoreDiff = score(left) - score(right);
  if (scoreDiff !== 0) return scoreDiff;
  if (left.enabledCount !== right.enabledCount) {
    return left.enabledCount - right.enabledCount;
  }
  const leftKey = normalizeCharacterFolderKey(left.diskName);
  const rightKey = normalizeCharacterFolderKey(right.diskName);
  return rightKey.localeCompare(leftKey);
}
const LEGACY_CHARACTER_CONTAINER_NAMES = /* @__PURE__ */ new Set(["character", "characters"]);
function readDirectoryEntriesSafe(dirPath) {
  try {
    return fs.readdirSync(dirPath, { withFileTypes: true });
  } catch (_) {
    return [];
  }
}
function getDefaultCharacterDisplayName(name, gameId2 = getActiveGameScopeId()) {
  const normalizedKey = normalizeCharacterFolderKey(name);
  if (!normalizedKey) return null;
  const defaultCharacters = getDefaultCharactersForGame(gameId2);
  return defaultCharacters.find((entry) => normalizeCharacterFolderKey(entry) === normalizedKey) || null;
}
function getKnownCharacterDisplayName(name, gameId2 = getActiveGameScopeId()) {
  const mappingEntry = getCharacterMappingEntry(name, gameId2);
  if (mappingEntry?.displayName) {
    return mappingEntry.displayName;
  }
  return getDefaultCharacterDisplayName(name, gameId2);
}
function isLegacyCharacterContainerName(name) {
  return LEGACY_CHARACTER_CONTAINER_NAMES.has(normalizeCharacterFolderKey(name));
}
function classifyFolderImportRole(folderName, sourceRootPath, modsPath, gameId2 = getActiveGameScopeId()) {
  const displayName = getKnownCharacterDisplayName(folderName, gameId2);
  if (!displayName) return null;
  const sourceRootResolved = path.resolve(sourceRootPath);
  const modsPathResolved = path.resolve(modsPath);
  const inNestedContainer = sourceRootResolved !== modsPathResolved;
  const isCanonicalRootFolder = normalizeCharacterFolderKey(folderName) === normalizeCharacterFolderKey(displayName);
  const needsMigration = inNestedContainer || !isCanonicalRootFolder;
  return {
    displayName,
    sourceName: folderName,
    sourceRootPath,
    inNestedContainer,
    isCanonicalRootFolder,
    needsMigration
  };
}
function listDirectModChildren(categoryDir) {
  return readDirectoryEntriesSafe(categoryDir).filter((entry) => entry.isDirectory() && !entry.name.startsWith(".")).map((entry) => ({
    name: entry.name,
    path: path.join(categoryDir, entry.name)
  }));
}
function analyzeImportSourceDirectory(sourceRootPath, modsPath, gameId2 = getActiveGameScopeId()) {
  const categories = [];
  readDirectoryEntriesSafe(sourceRootPath).filter((entry) => entry.isDirectory() && !entry.name.startsWith(".")).forEach((entry) => {
    const role = classifyFolderImportRole(entry.name, sourceRootPath, modsPath, gameId2);
    if (!role) return;
    const sourceCategoryPath = path.join(sourceRootPath, entry.name);
    const modChildren = listDirectModChildren(sourceCategoryPath);
    if (modChildren.length === 0) return;
    categories.push({
      ...role,
      sourceCategoryPath,
      modChildren,
      modCount: modChildren.length
    });
  });
  return {
    sourceRootPath,
    relativeRoot: path.relative(modsPath, sourceRootPath) || ".",
    categories,
    actionableCategories: categories.filter((category) => category.needsMigration)
  };
}
function scanImportCandidates(modsPath, gameId2 = getActiveGameScopeId()) {
  if (!modsPath || !fs.existsSync(modsPath)) {
    return {
      modsPath,
      gameId: gameId2,
      hasCandidates: false,
      analyses: [],
      categories: [],
      existingCategories: [],
      sourceRoots: []
    };
  }
  const rootCandidates = [modsPath];
  for (const containerName of LEGACY_CHARACTER_CONTAINER_NAMES) {
    const candidate = path.join(modsPath, containerName);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      rootCandidates.push(candidate);
    }
  }
  const uniqueRoots = Array.from(new Set(rootCandidates.map((entry) => path.resolve(entry))));
  const analyses = uniqueRoots.map(
    (rootPath) => analyzeImportSourceDirectory(rootPath, modsPath, gameId2)
  );
  const categories = analyses.flatMap((analysis) => analysis.actionableCategories);
  const existingCategories = analyses.flatMap(
    (analysis) => analysis.categories.filter((category) => !category.needsMigration)
  );
  return {
    modsPath,
    gameId: gameId2,
    hasCandidates: categories.length > 0,
    analyses,
    categories,
    existingCategories,
    sourceRoots: Array.from(
      new Set(
        categories.map(
          (category) => category.relativeRoot || path.relative(modsPath, category.sourceRootPath) || "."
        )
      )
    )
  };
}
function shouldDeferDefaultCharacterBootstrap(modsPath, gameId2 = getActiveGameScopeId()) {
  return scanImportCandidates(modsPath, gameId2).hasCandidates;
}
function buildImportMovePlan(scanResult, modsPath, gameId2 = getActiveGameScopeId()) {
  const plan = {
    modsPath,
    gameId: gameId2,
    moves: [],
    sourceCategoryPaths: [],
    sourceRootPaths: [],
    categoryCount: scanResult?.categories?.length || 0,
    modCount: 0
  };
  for (const category of scanResult?.categories || []) {
    plan.sourceCategoryPaths.push(category.sourceCategoryPath);
    plan.sourceRootPaths.push(category.sourceRootPath);
    for (const modChild of category.modChildren) {
      plan.moves.push({
        sourceRootPath: category.sourceRootPath,
        sourceCategoryPath: category.sourceCategoryPath,
        sourceCategoryName: category.sourceName,
        targetDisplayName: category.displayName,
        sourceModName: modChild.name,
        sourceModPath: modChild.path,
        targetCategoryPath: path.join(modsPath, category.displayName),
        targetModPath: path.join(modsPath, category.displayName, modChild.name)
      });
      plan.modCount += 1;
    }
  }
  plan.sourceCategoryPaths = Array.from(new Set(plan.sourceCategoryPaths));
  plan.sourceRootPaths = Array.from(new Set(plan.sourceRootPaths));
  return plan;
}
function ensureCharacterCategoryDir(modsPath, displayName) {
  const categoryDir = path.join(modsPath, displayName);
  if (!fs.existsSync(categoryDir)) {
    fs.mkdirSync(categoryDir, { recursive: true });
  }
  return categoryDir;
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
  fs.cpSync(sourcePath, targetPath, { recursive: true });
  fs.rmSync(sourcePath, { recursive: true, force: true });
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
function executeImportMovePlan(movePlan) {
  const movedCategories = /* @__PURE__ */ new Set();
  const sourceRoots = /* @__PURE__ */ new Set();
  const moved = [];
  const skippedConflicts = [];
  for (const move of movePlan.moves) {
    sourceRoots.add(path.relative(movePlan.modsPath, move.sourceRootPath) || ".");
    if (!fs.existsSync(move.sourceModPath)) {
      continue;
    }
    ensureCharacterCategoryDir(movePlan.modsPath, move.targetDisplayName);
    if (fs.existsSync(move.targetModPath)) {
      skippedConflicts.push({
        characterName: move.targetDisplayName,
        modName: move.sourceModName,
        sourcePath: move.sourceModPath,
        targetPath: move.targetModPath
      });
      continue;
    }
    moveDirectoryWithFallback(move.sourceModPath, move.targetModPath);
    moved.push({
      characterName: move.targetDisplayName,
      modName: move.sourceModName,
      sourcePath: move.sourceModPath,
      targetPath: move.targetModPath
    });
    movedCategories.add(move.targetDisplayName);
  }
  const cleanupTargets = [
    ...movePlan.sourceCategoryPaths.slice().sort((left, right) => right.length - left.length),
    ...movePlan.sourceRootPaths.filter((rootPath) => path.resolve(rootPath) !== path.resolve(movePlan.modsPath)).sort((left, right) => right.length - left.length)
  ];
  cleanupTargets.forEach(removeDirectoryIfEmpty);
  const summary = {
    migratedCategoryCount: movedCategories.size,
    migratedModCount: moved.length,
    skippedConflicts,
    sourceRoots: Array.from(sourceRoots),
    moved
  };
  logger.info(
    `[ModsImport] scanned=${movePlan.categoryCount} categories, planned=${movePlan.modCount} mods, migrated=${summary.migratedModCount}, conflicts=${skippedConflicts.length}`
  );
  return summary;
}
const LEGACY_ORGANIZE_SCAN_CACHE_TTL_MS = 8e3;
const legacyOrganizeScanCache = /* @__PURE__ */ new Map();
function getLegacyOrganizeScanCacheKey(modsPath, gameId2) {
  return `${gameId2 || ""}::${path.resolve(modsPath || "")}`;
}
function clearLegacyOrganizeScanCache(gameId2 = null) {
  if (!gameId2) {
    legacyOrganizeScanCache.clear();
    return;
  }
  for (const key of Array.from(legacyOrganizeScanCache.keys())) {
    if (key.startsWith(`${gameId2}::`)) legacyOrganizeScanCache.delete(key);
  }
}
function organizeLegacyCharacterFoldersIfNeeded() {
  // Legacy callers include read-only views. Organization is now explicitly previewed
  // and confirmed through legacy-import:migrate; opening a view must never move Mods.
  return null;
}
const organizationTokens = new Map();
function organizationToken(scan, modsPath, gameId2) {
  return crypto.createHash("sha256").update(JSON.stringify(buildImportMovePlan(scan, modsPath, gameId2))).digest("hex");
}
function previewOrganization(modsPath, gameId2) {
  const scan = scanImportCandidates(modsPath, gameId2);
  const token = organizationToken(scan, modsPath, gameId2);
  organizationTokens.set(gameId2, token);
  return { ...buildImportPreview(scan, modsPath), token };
}
const LOOSE_ROOT_IGNORE_KEYS = /* @__PURE__ */ new Set([
  "character",
  "characters",
  "shaderfixes",
  "shaderfix",
  "buffer",
  "buffers",
  "resources",
  "resource",
  "qaqm",
  "mods",
  "npc",
  "ui",
  "功能",
  "大世界",
  "world",
  "openworld",
  "overworld",
  "weapon",
  "weapons",
  "武器",
  "vehicle",
  "vehicles",
  "载具",
  "lightcone",
  "lightcones",
  "光椎",
  "光锥"
]);
const LOOSE_CHARACTER_RESOURCE_DIR_KEYS = /* @__PURE__ */ new Set([
  "mesh",
  "meshes",
  "texture",
  "textures",
  "resource",
  "resources",
  "shader",
  "shaders",
  "shaderfix",
  "shaderfixes",
  "buffer",
  "buffers",
  "buf",
  "paks",
  "pak"
]);
function isIgnoredLooseCharacterFile(fileName) {
  const normalized = String(fileName || "").trim().toLowerCase();
  if (!normalized || normalized.startsWith(".")) return true;
  if (normalized === "desktop.ini" || normalized === "thumbs.db") return true;
  if (/^_cover\.(png|jpg|jpeg|webp|gif|bmp)$/i.test(fileName)) return true;
  if (/^\.qaqm-/i.test(fileName)) return true;
  return false;
}
function isLooseCharacterFile(fileName) {
  if (isIgnoredLooseCharacterFile(fileName)) return false;
  const normalized = String(fileName || "").trim().toLowerCase();
  const ext = path.extname(normalized);
  if (normalized === "tags.json" || normalized === "meta.json" || normalized === "mod.json") return true;
  if (normalized === "preview.png" || normalized === "preview.jpg" || normalized === "preview.jpeg") return true;
  if (normalized.endsWith(".ini") || /\.ini_.*\.bak$/i.test(fileName)) return true;
  return [".dds", ".buf", ".ib", ".vb", ".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif"].includes(ext);
}
function isLooseCharacterResourceDir(dirName) {
  const key = normalizeCharacterFolderKey(String(dirName || "").replace(/^DISABLED_/i, ""));
  return !!key && LOOSE_CHARACTER_RESOURCE_DIR_KEYS.has(key);
}
function containsChineseCharacter(value) {
  return /[\u3400-\u9fff\uf900-\ufaff]/.test(String(value || ""));
}
function isGeneratedLooseQuarantineDir(dirName) {
  return /^DISABLED_loose-(root|files)-/i.test(String(dirName || ""));
}
function createLooseItemId(scope, type, name, prefix = "") {
  return [scope, prefix, type, name].filter(Boolean).join(":");
}
function normalizeLooseAliasText(value) {
  return String(value || "").replace(/^DISABLED_/i, "").normalize("NFKC").trim().toLowerCase();
}
function compactLooseAliasText(value) {
  return normalizeLooseAliasText(value).replace(/[\s_\-.'"`·•()[\]{}【】（）<>《》:：|\\/]+/g, "");
}
function getLooseFolderNamePrefixCandidates(value) {
  const normalized = normalizeLooseAliasText(value);
  const candidates = [normalized];
  const prefix = normalized.split(/[\s_\-.'"`·•()[\]{}【】（）<>《》:：|\\/]+/)[0];
  if (prefix && prefix !== normalized) candidates.push(prefix);
  return Array.from(new Set(candidates.map(compactLooseAliasText).filter(Boolean)));
}
function getCharacterMoveAliasEntries(gameId2 = getActiveGameScopeId()) {
  const entries = [];
  const seen = /* @__PURE__ */ new Set();
  for (const characterName of getDefaultCharactersForGame(gameId2)) {
    const mappingEntry = getCharacterMappingEntry(characterName, gameId2);
    const displayName = mappingEntry?.displayName || characterName;
    if (!displayName || displayName === "其他") continue;
    for (const alias of getCharacterAliasCandidates(characterName, gameId2)) {
      const normalizedAlias = normalizeLooseAliasText(alias);
      const compactAlias = compactLooseAliasText(alias);
      if (!compactAlias) continue;
      if (!containsChineseCharacter(alias) && compactAlias.length < 3) continue;
      const key = `${displayName}:${compactAlias}`;
      if (seen.has(key)) continue;
      seen.add(key);
      entries.push({
        characterName: displayName,
        alias,
        normalizedAlias,
        compactAlias,
        hasChinese: containsChineseCharacter(alias),
        score: compactAlias.length
      });
    }
  }
  return entries.sort((left, right) => right.score - left.score);
}
function isAliasLikelyInFolderName(folderName, aliasEntry) {
  const compactPrefixes = getLooseFolderNamePrefixCandidates(folderName);
  if (!compactPrefixes.length || !aliasEntry?.compactAlias) return false;
  if (aliasEntry.hasChinese) {
    if (aliasEntry.compactAlias.length === 1) {
      return compactPrefixes.some((prefix) => prefix === aliasEntry.compactAlias);
    }
    return compactPrefixes.some((prefix) => prefix.startsWith(aliasEntry.compactAlias));
  }
  return compactPrefixes.some((prefix) => prefix.startsWith(aliasEntry.compactAlias));
}
function detectMisplacedModTarget(folderName, sourceCharacterName = "", gameId2 = getActiveGameScopeId()) {
  const sourceDisplayName = sourceCharacterName ? getKnownCharacterDisplayName(sourceCharacterName, gameId2) || sourceCharacterName : "";
  const sourceKey = normalizeCharacterFolderKey(sourceDisplayName);
  const matches = getCharacterMoveAliasEntries(gameId2).filter(
    (aliasEntry) => isAliasLikelyInFolderName(folderName, aliasEntry)
  );
  if (!matches.length) return null;
  const target = matches.find(
    (match) => normalizeCharacterFolderKey(match.characterName) !== sourceKey
  );
  if (!target) return null;
  return {
    characterName: target.characterName,
    matchedAlias: target.alias
  };
}
function createMisplacedItemId(sourceCharacterName, targetCharacterName, name) {
  return createLooseItemId(
    "misplaced",
    "directory",
    name,
    `${sourceCharacterName || "Mods 根目录"}>${targetCharacterName}`
  );
}
function scanLooseCharacterEntries(characterPath, characterName = "", gameId2 = getActiveGameScopeId()) {
  const entries = [];
  try {
    for (const entry of fs.readdirSync(characterPath, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const fullPath = path.join(characterPath, entry.name);
      if (entry.isFile()) {
        if (isLooseCharacterFile(entry.name)) {
          entries.push({
            id: createLooseItemId("character", "file", entry.name, characterName),
            name: entry.name,
            path: fullPath,
            relativePath: entry.name,
            type: "file",
            reason: "loose-file",
            defaultSelected: true
          });
        }
        continue;
      }
      if (!entry.isDirectory() || isGeneratedLooseQuarantineDir(entry.name)) continue;
      if (!directoryHasAnyFile(fullPath)) continue;
      if (isLooseCharacterResourceDir(entry.name)) {
        entries.push({
          id: createLooseItemId("character", "directory", entry.name, characterName),
          name: entry.name,
          path: fullPath,
          relativePath: entry.name,
          type: "directory",
          reason: "resource-directory",
          defaultSelected: true
        });
        continue;
      }
      if (detectMisplacedModTarget(entry.name, characterName, gameId2)) continue;
      if (!containsChineseCharacter(entry.name)) {
        entries.push({
          id: createLooseItemId("character", "directory", entry.name, characterName),
          name: entry.name,
          path: fullPath,
          relativePath: entry.name,
          type: "directory",
          reason: "non-chinese-folder",
          defaultSelected: true
        });
      }
    }
  } catch (_) {
  }
  return entries;
}
function getKnownCharacterPrefixDisplayName(folderName, gameId2 = getActiveGameScopeId()) {
  const normalizedName = normalizeCharacterFolderKey(String(folderName || "").replace(/^DISABLED_/i, ""));
  if (!normalizedName) return null;
  for (const characterName of getDefaultCharactersForGame(gameId2)) {
    const aliases = getCharacterAliasCandidates(characterName, gameId2);
    for (const alias of aliases) {
      const aliasKey = normalizeCharacterFolderKey(alias);
      if (aliasKey && normalizedName.startsWith(aliasKey) && normalizedName !== aliasKey) {
        return getCanonicalCharacterConfigKey(characterName, gameId2);
      }
    }
  }
  return null;
}
function scanLooseRootModFolders(modsPath, gameId2 = getActiveGameScopeId()) {
  const result = {
    success: true,
    hasLooseFolders: false,
    count: 0,
    folders: [],
    rootFolders: [],
    rootFiles: [],
    rootFolderCount: 0,
    rootLooseFileCount: 0,
    characterGroups: [],
    characterLooseItemCount: 0,
    targetCharacterName: getCanonicalCharacterConfigKey("其他", gameId2)
  };
  if (!modsPath || !fs.existsSync(modsPath)) return result;
  let entries = [];
  try {
    entries = fs.readdirSync(modsPath, { withFileTypes: true });
  } catch (error) {
    return { ...result, success: false, error: error?.message || String(error) };
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (entry.isFile()) {
      if (isLooseCharacterFile(entry.name)) {
        result.rootFiles.push({
          id: createLooseItemId("root", "file", entry.name),
          name: entry.name,
          path: path.join(modsPath, entry.name),
          relativePath: entry.name,
          type: "file",
          reason: "root-file",
          defaultSelected: true
        });
      }
      continue;
    }
    if (!entry.isDirectory()) continue;
    const key = normalizeCharacterFolderKey(entry.name);
    if (!key || LOOSE_ROOT_IGNORE_KEYS.has(key)) continue;
    if (isLegacyCharacterContainerName(entry.name)) continue;
    const fullPath = path.join(modsPath, entry.name);
    const knownCharacterName = getKnownCharacterDisplayName(entry.name, gameId2);
    if (knownCharacterName) {
      const looseEntries = scanLooseCharacterEntries(fullPath, knownCharacterName, gameId2);
      if (looseEntries.length > 0) {
        result.characterGroups.push({
          characterName: knownCharacterName,
          path: fullPath,
          relativePath: entry.name,
          itemCount: looseEntries.length,
          items: looseEntries
        });
        result.characterLooseItemCount += looseEntries.length;
      }
      continue;
    }
    if (!directoryHasAnyFile(fullPath)) continue;
    const suggestedCharacterName = getKnownCharacterPrefixDisplayName(entry.name, gameId2);
    const rootItem = {
      id: createLooseItemId("root", "directory", entry.name),
      name: entry.name,
      path: fullPath,
      relativePath: entry.name,
      type: "directory",
      reason: "root-folder",
      suggestedCharacterName,
      defaultSelected: true
    };
    result.rootFolders.push(rootItem);
    result.folders.push(rootItem);
  }
  result.rootFolderCount = result.rootFolders.length;
  result.rootLooseFileCount = result.rootFiles.length;
  result.count = result.rootFolderCount + result.rootLooseFileCount + result.characterLooseItemCount;
  result.hasLooseFolders = result.count > 0;
  return result;
}
function scanMisplacedModFolders(modsPath, gameId2 = getActiveGameScopeId()) {
  const result = {
    success: true,
    hasMisplacedFolders: false,
    count: 0,
    rootCount: 0,
    characterCount: 0,
    groups: []
  };
  if (!modsPath || !fs.existsSync(modsPath)) return result;
  const groupsByTarget = /* @__PURE__ */ new Map();
  const addItem = (target, item) => {
    if (!target?.characterName || !item?.path) return;
    const targetName = target.characterName;
    if (!groupsByTarget.has(targetName)) {
      groupsByTarget.set(targetName, {
        targetCharacterName: targetName,
        itemCount: 0,
        items: []
      });
    }
    const group = groupsByTarget.get(targetName);
    group.items.push({
      ...item,
      id: createMisplacedItemId(item.sourceCharacterName, targetName, item.name),
      targetCharacterName: targetName,
      matchedAlias: target.matchedAlias,
      defaultSelected: true
    });
    group.itemCount += 1;
    result.count += 1;
    if (item.sourceCharacterName) result.characterCount += 1;
    else result.rootCount += 1;
  };
  let entries = [];
  try {
    entries = fs.readdirSync(modsPath, { withFileTypes: true });
  } catch (error) {
    return { ...result, success: false, error: error?.message || String(error) };
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".") || isGeneratedLooseQuarantineDir(entry.name)) {
      continue;
    }
    const key = normalizeCharacterFolderKey(entry.name);
    if (!key || LOOSE_ROOT_IGNORE_KEYS.has(key) || isLegacyCharacterContainerName(entry.name)) {
      continue;
    }
    const fullPath = path.join(modsPath, entry.name);
    const knownCharacterName = getKnownCharacterDisplayName(entry.name, gameId2);
    if (knownCharacterName) {
      let childEntries = [];
      try {
        childEntries = fs.readdirSync(fullPath, { withFileTypes: true });
      } catch (_) {
        childEntries = [];
      }
      for (const child of childEntries) {
        if (!child.isDirectory() || child.name.startsWith(".") || isGeneratedLooseQuarantineDir(child.name)) {
          continue;
        }
        if (isLooseCharacterResourceDir(child.name)) continue;
        const childPath = path.join(fullPath, child.name);
        if (!directoryHasAnyFile(childPath)) continue;
        const target = detectMisplacedModTarget(child.name, knownCharacterName, gameId2);
        if (!target) continue;
        addItem(target, {
          name: child.name,
          path: childPath,
          relativePath: path.join(entry.name, child.name),
          sourceCharacterName: knownCharacterName,
          sourceLabel: knownCharacterName,
          type: "directory",
          reason: "wrong-character-folder"
        });
      }
      continue;
    }
  }
  result.groups = Array.from(groupsByTarget.values());
  result.hasMisplacedFolders = result.count > 0;
  return result;
}
function createLooseRootQuarantineName() {
  const now = /* @__PURE__ */ new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
  return `DISABLED_loose-root-${stamp}`;
}
function createLooseCharacterQuarantineName() {
  const now = /* @__PURE__ */ new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
  return `DISABLED_loose-files-${stamp}`;
}
function getAvailableDirectoryPath(parentDir, preferredName) {
  const baseName = String(preferredName || "Folder").trim() || "Folder";
  for (let index = 0; index < 1e3; index++) {
    const candidateName = index === 0 ? baseName : `${baseName} (${index})`;
    const candidatePath = path.join(parentDir, candidateName);
    if (!fs.existsSync(candidatePath)) return candidatePath;
  }
  throw new Error(`Too many duplicate folders for ${baseName}`);
}
function moveLooseEntryWithFallback(sourcePath, targetPath, isDirectory) {
  try {
    fs.renameSync(sourcePath, targetPath);
    return;
  } catch (error) {
    if (!error || !["EXDEV", "EPERM"].includes(error.code)) {
      throw error;
    }
  }
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  if (isDirectory) {
    fs.cpSync(sourcePath, targetPath, { recursive: true });
    fs.rmSync(sourcePath, { recursive: true, force: true });
  } else {
    fs.copyFileSync(sourcePath, targetPath);
    fs.unlinkSync(sourcePath);
  }
}
function quarantineLooseRootModFolders(gameId2 = getActiveGameScopeId(), options = {}) {
  const modsPath = getModsPath(gameId2);
  const scan = scanLooseRootModFolders(modsPath, gameId2);
  if (!scan.hasLooseFolders) return { success: true, scan, moved: [], movedCount: 0, targets: [] };
  const selectedIds = Array.isArray(options?.selectedIds) ? new Set(options.selectedIds) : null;
  const shouldMoveItem = (item) => !selectedIds || selectedIds.has(item?.id);
  const targets = [];
  const moved = [];
  const rootFolders = (scan.rootFolders || scan.folders || []).filter(shouldMoveItem);
  const rootFiles = (scan.rootFiles || []).filter(shouldMoveItem);
  if (rootFolders.length > 0 || rootFiles.length > 0) {
    const target = resolveCanonicalCharacterInstallTarget(scan.targetCharacterName || "其他", gameId2);
    if (!target.characterPath) throw new Error("Unable to resolve quarantine character folder");
    const quarantineRoot = getAvailableDirectoryPath(target.characterPath, createLooseRootQuarantineName());
    fs.mkdirSync(quarantineRoot, { recursive: true });
    targets.push({
      type: "root",
      label: "Mods 根目录杂项",
      characterName: target.characterName,
      path: quarantineRoot
    });
    for (const folder of rootFolders) {
      const sourcePath = folder.path || path.join(modsPath, folder.name);
      if (!fs.existsSync(sourcePath)) continue;
      const targetPath = getAvailableDirectoryPath(quarantineRoot, folder.name);
      moveDirectoryWithFallback(sourcePath, targetPath);
      moved.push({ type: "root-folder", name: folder.name, sourcePath, targetPath });
    }
    for (const file of rootFiles) {
      const sourcePath = file.path || path.join(modsPath, file.name);
      if (!fs.existsSync(sourcePath)) continue;
      const targetPath = getAvailableDirectoryPath(quarantineRoot, file.name);
      moveLooseEntryWithFallback(sourcePath, targetPath, false);
      moved.push({ type: "root-file", name: file.name, sourcePath, targetPath });
    }
  }
  for (const group of scan.characterGroups || []) {
    if (!group?.path || !fs.existsSync(group.path)) continue;
    const selectedItems = (group.items || []).filter(shouldMoveItem);
    if (!selectedItems.length) continue;
    const quarantineRoot = getAvailableDirectoryPath(group.path, createLooseCharacterQuarantineName());
    fs.mkdirSync(quarantineRoot, { recursive: true });
    targets.push({
      type: "character",
      label: `${group.characterName} 目录散落文件`,
      characterName: group.characterName,
      path: quarantineRoot
    });
    for (const item of selectedItems) {
      const sourcePath = item.path;
      if (!sourcePath || !fs.existsSync(sourcePath)) continue;
      const targetPath = getAvailableDirectoryPath(quarantineRoot, item.name);
      moveLooseEntryWithFallback(sourcePath, targetPath, item.type === "directory");
      moved.push({
        type: `character-${item.type || "entry"}`,
        characterName: group.characterName,
        name: item.name,
        sourcePath,
        targetPath
      });
    }
  }
  clearConflictCache(null, gameId2);
  notifyAllModWindowsChanged("__all__");
  logger.info(`[LooseRoot] quarantined=${moved.length}, targets=${targets.map((item) => item.path).join("; ")}`);
  return {
    success: true,
    scan,
    moved,
    movedCount: moved.length,
    requestedCount: selectedIds ? selectedIds.size : scan.count,
    targets,
    targetSummary: targets.map((item) => `${item.label} -> ${item.path}`)
  };
}
function moveMisplacedModFolders(gameId2 = getActiveGameScopeId(), options = {}) {
  const modsPath = getModsPath(gameId2);
  const scan = scanMisplacedModFolders(modsPath, gameId2);
  if (!scan.hasMisplacedFolders) {
    return { success: true, scan, moved: [], movedCount: 0, targets: [] };
  }
  const selectedIds = Array.isArray(options?.selectedIds) ? new Set(options.selectedIds) : null;
  const shouldMoveItem = (item) => !selectedIds || selectedIds.has(item?.id);
  const moved = [];
  const targets = [];
  for (const group of scan.groups || []) {
    const selectedItems = (group.items || []).filter(shouldMoveItem);
    if (!selectedItems.length) continue;
    const target = resolveCanonicalCharacterInstallTarget(group.targetCharacterName, gameId2);
    if (!target.characterPath) throw new Error(`Unable to resolve target character folder: ${group.targetCharacterName}`);
    targets.push({
      characterName: target.characterName,
      path: target.characterPath
    });
    for (const item of selectedItems) {
      const sourcePath = item.path;
      if (!sourcePath || !fs.existsSync(sourcePath)) continue;
      const targetPath = getAvailableDirectoryPath(target.characterPath, item.name);
      moveDirectoryWithFallback(sourcePath, targetPath);
      moved.push({
        characterName: target.characterName,
        name: item.name,
        matchedAlias: item.matchedAlias,
        sourceCharacterName: item.sourceCharacterName || "",
        sourcePath,
        targetPath
      });
    }
  }
  clearConflictCache(null, gameId2);
  notifyAllModWindowsChanged("__all__");
  logger.info(`[MisplacedMods] moved=${moved.length}, targets=${targets.map((item) => item.path).join("; ")}`);
  return {
    success: true,
    scan,
    moved,
    movedCount: moved.length,
    requestedCount: selectedIds ? selectedIds.size : scan.count,
    targets,
    targetSummary: moved.slice(0, 5).map((item) => `${item.name} -> ${item.characterName}`)
  };
}
function buildImportPreview(scanResult, modsPath) {
  if (!scanResult?.hasCandidates) {
    return {
      hasCandidates: false,
      categoryCount: 0,
      modCount: 0,
      sourceRoots: [],
      targetCharacters: [],
      previewMoves: []
    };
  }
  const movePlan = buildImportMovePlan(scanResult, modsPath, scanResult.gameId);
  const targetCharacters = Array.from(
    /* @__PURE__ */ new Set([
      ...movePlan.moves.map((move) => move.targetDisplayName)
    ])
  );
  return {
    hasCandidates: movePlan.moves.length > 0,
    categoryCount: movePlan.categoryCount,
    modCount: movePlan.modCount,
    sourceRoots: scanResult.sourceRoots,
    targetCharacters,
    previewMoves: movePlan.moves.slice(0, 8).map((move) => ({
      sourceCategoryName: move.sourceCategoryName,
      targetDisplayName: move.targetDisplayName,
      modName: move.sourceModName
    }))
  };
}
function listCharacterDirectories(modsPath, gameId2 = getActiveGameScopeId()) {
  const characterBasePath = getCharacterDirectoryBasePath(modsPath, gameId2);
  if (!characterBasePath || !fs.existsSync(characterBasePath)) return [];
  const entries = fs.readdirSync(characterBasePath, { withFileTypes: true });
  const deduped = /* @__PURE__ */ new Map();
  entries.filter(
    (entry) => entry.isDirectory() && !entry.name.startsWith(".") && !isLegacyCharacterContainerName(entry.name) && !shouldHideForeignDefaultCharacterFolder(characterBasePath, entry.name, gameId2)
  ).forEach((entry) => {
    const mappingEntry = getCharacterMappingEntry(entry.name, gameId2);
    const characterRootPath = path.join(characterBasePath, entry.name);
    const nevernessDx12Paths = isNevernessDx12Mode(gameId2) ? getNevernessDx12Paths(gameId2) : null;
    const disabledCharacterPath = isNevernessDx12Mode(gameId2) ? getNevernessDx12DisabledCharacterPath(
      mappingEntry?.displayName || entry.name,
      nevernessDx12Paths,
      { gameId: gameId2 }
    ) : "";
    const stats = disabledCharacterPath && fs.existsSync(disabledCharacterPath) ? mergeCharacterDirectoryStats(
      getCharacterDirectoryStats(characterRootPath),
      getCharacterDirectoryStats(disabledCharacterPath)
    ) : getCharacterDirectoryStats(characterRootPath);
    const characterEntry = {
      displayName: mappingEntry?.displayName || entry.name,
      diskName: entry.name,
      canonicalEnName: mappingEntry?.canonicalEnName || null,
      mapped: !!mappingEntry,
      characterRootPath,
      ...stats
    };
    const existing = deduped.get(characterEntry.displayName);
    if (!existing || compareCharacterDirectoryEntries(characterEntry, existing) > 0) {
      deduped.set(characterEntry.displayName, characterEntry);
    }
  });
  return Array.from(deduped.values());
}
function sortCharacterEntries(entries, gameId2 = getActiveGameScopeId()) {
  const customOrder = Array.isArray(currentConfig.characterOrdersByGame?.[gameId2]) ? currentConfig.characterOrdersByGame[gameId2] : gameId2 === "endfield" && Array.isArray(currentConfig.characterOrder) ? currentConfig.characterOrder : [];
  const orderIndex = new Map(
    customOrder.map((name, index) => [normalizeCharacterFolderKey(name), index])
  );
  return [...entries].sort((left, right) => {
    const leftIndex = orderIndex.get(normalizeCharacterFolderKey(left.displayName));
    const rightIndex = orderIndex.get(normalizeCharacterFolderKey(right.displayName));
    const hasLeftIndex = Number.isInteger(leftIndex);
    const hasRightIndex = Number.isInteger(rightIndex);
    if (hasLeftIndex && hasRightIndex && leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }
    if (hasLeftIndex !== hasRightIndex) {
      return hasLeftIndex ? -1 : 1;
    }
    if (right.modCount !== left.modCount) return right.modCount - left.modCount;
    return left.displayName.localeCompare(right.displayName, "zh");
  });
}
function resolveCharacterEntryDirect(characterName, gameId2 = getActiveGameScopeId()) {
  if (!isSafeAppearancePathSegment(characterName)) return null;
  const modsPath = getModsPath(gameId2);
  const characterBasePath = getCharacterDirectoryBasePath(modsPath, gameId2);
  if (!characterBasePath || !fs.existsSync(characterBasePath)) return null;
  const mappingEntry = getCharacterMappingEntry(characterName, gameId2);
  const candidates = [
    characterName,
    mappingEntry?.displayName,
    mappingEntry?.canonicalEnName,
    mappingEntry?.jasmName,
    ...Array.isArray(mappingEntry?.aliases) ? mappingEntry.aliases : []
  ].map((name) => String(name || "").trim()).filter(isSafeAppearancePathSegment);
  const seen = /* @__PURE__ */ new Set();
  for (const candidateName of candidates) {
    const key = normalizeCharacterFolderKey(candidateName);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const candidatePath = path.join(characterBasePath, candidateName);
    try {
      if (!fs.existsSync(candidatePath) || !fs.statSync(candidatePath).isDirectory()) continue;
    } catch (_) {
      continue;
    }
    const candidateMapping = getCharacterMappingEntry(candidateName, gameId2) || mappingEntry;
    return {
      displayName: candidateMapping?.displayName || candidateName,
      diskName: candidateName,
      canonicalEnName: candidateMapping?.canonicalEnName || null,
      mapped: !!candidateMapping,
      characterRootPath: candidatePath,
      ...getCharacterDirectoryStats(candidatePath)
    };
  }
  return null;
}
function resolveCharacterEntry(characterName, gameId2 = getActiveGameScopeId()) {
  if (!isSafeAppearancePathSegment(characterName)) return null;
  const modsPath = getModsPath(gameId2);
  const characterBasePath = getCharacterDirectoryBasePath(modsPath, gameId2);
  if (!characterBasePath || !fs.existsSync(characterBasePath)) return null;
  const directResolved = resolveCharacterEntryDirect(characterName, gameId2);
  if (directResolved) return directResolved;
  const aliases = getCharacterAliasCandidates(characterName, gameId2);
  const aliasKeys = new Set(aliases.map((alias) => normalizeCharacterFolderKey(alias)));
  const entries = listCharacterDirectories(modsPath, gameId2);
  const resolved = entries.find(
    (entry) => aliasKeys.has(normalizeCharacterFolderKey(entry.displayName)) || aliasKeys.has(normalizeCharacterFolderKey(entry.diskName))
  );
  if (resolved) return resolved;
  const directPath = path.join(characterBasePath, characterName);
  if (fs.existsSync(directPath)) {
    const mappingEntry = getCharacterMappingEntry(characterName, gameId2);
    return {
      displayName: mappingEntry?.displayName || characterName,
      diskName: characterName,
      canonicalEnName: mappingEntry?.canonicalEnName || null,
      mapped: !!mappingEntry,
      characterRootPath: directPath,
      ...getCharacterDirectoryStats(directPath)
    };
  }
  return null;
}
function resolveCharacterPath(characterName, gameId2 = getActiveGameScopeId()) {
  return resolveCharacterEntry(characterName, gameId2)?.characterRootPath || null;
}
function resolveCanonicalCharacterInstallTarget(characterName, gameId2 = getActiveGameScopeId(), { ensure = true } = {}) {
  const rawName = assertSafeAppearancePathSegment(characterName, "角色名称");
  if (ensure) assertCharacterVisible(rawName, gameId2);
  if (!rawName) return { characterName: "", characterPath: null };
  const canonicalCharacterName = assertSafeAppearancePathSegment(
    getCanonicalCharacterConfigKey(rawName, gameId2),
    "规范角色名称"
  );
  if (isNevernessDx12Mode(gameId2)) {
    return {
      characterName: canonicalCharacterName,
      characterPath: getNevernessDx12CharacterPath(canonicalCharacterName, { ensure, gameId: gameId2 })
    };
  }
  const modsPath = getModsPath(gameId2);
  const characterBasePath = getCharacterDirectoryBasePath(modsPath, gameId2, { ensure });
  if (!characterBasePath) {
    return { characterName: canonicalCharacterName, characterPath: null };
  }
  // GIMI collections commonly use aliases such as Ayaka or Raiden. Keep all
  // imports in the existing directory so detail/actions see the same Mods.
  const characterPath = (gameId2 === "genshin-impact" ? resolveCharacterPath(rawName, gameId2) : null)
    || path.join(characterBasePath, canonicalCharacterName);
  if (!isPathInsideDirectory(characterPath, characterBasePath)) {
    throw new Error("角色目录路径无效");
  }
  if (ensure) {
    probeWritableDirectory(characterPath, `角色目录「${canonicalCharacterName}」`);
  }
  return { characterName: canonicalCharacterName, characterPath };
}
function resolveCharacterModPath(characterName, modName, gameId2 = getActiveGameScopeId()) {
  const safeModName = assertSafeAppearancePathSegment(modName, "Mod 名称");
  const charPath = resolveCharacterPath(characterName, gameId2);
  if (!charPath) return null;
  const candidates = [
    path.join(charPath, safeModName),
    path.join(charPath, `DISABLED_${safeModName}`)
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
}
function resolveExistingStandardModDirectory(characterName, modName, gameId2 = getActiveGameScopeId()) {
  const safeModName = assertSafeAppearancePathSegment(modName, "Mod 名称");
  organizeLegacyCharacterFoldersIfNeeded(gameId2);
  const charPath = resolveCharacterPath(characterName, gameId2);
  if (!charPath) return null;
  const enabledPath = path.join(charPath, safeModName);
  if (fs.existsSync(enabledPath)) {
    return { charPath, modPath: enabledPath, folderName: safeModName, enabled: true };
  }
  const disabledFolderName = `DISABLED_${safeModName}`;
  const disabledPath = path.join(charPath, disabledFolderName);
  if (fs.existsSync(disabledPath)) {
    return { charPath, modPath: disabledPath, folderName: disabledFolderName, enabled: false };
  }
  return null;
}
function getCanonicalCharacterConfigKey(characterName, gameId2 = getActiveGameScopeId()) {
  const resolvedEntry = resolveCharacterEntry(characterName, gameId2);
  if (resolvedEntry?.displayName) return resolvedEntry.displayName;
  return getCharacterMappingEntry(characterName, gameId2)?.displayName || characterName;
}
function getCharacterStoreEntry(store, characterName, gameId2 = getActiveGameScopeId()) {
  if (!store || typeof store !== "object") {
    return { key: getCanonicalCharacterConfigKey(characterName, gameId2), value: void 0 };
  }
  const resolvedEntry = resolveCharacterEntry(characterName, gameId2);
  const canonicalKey = getCanonicalCharacterConfigKey(characterName, gameId2);
  const aliases = getCharacterAliasCandidates(characterName, gameId2, resolvedEntry);
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(store, alias)) {
      return { key: alias, value: store[alias], canonicalKey };
    }
  }
  const normalizedAliasKeys = new Set(aliases.map((alias) => normalizeCharacterFolderKey(alias)));
  for (const key of Object.keys(store)) {
    if (normalizedAliasKeys.has(normalizeCharacterFolderKey(key))) {
      return { key, value: store[key], canonicalKey };
    }
  }
  return { key: canonicalKey, value: void 0, canonicalKey };
}
function moveCharacterStoreValueToCanonicalKey(store, characterName, gameId2 = getActiveGameScopeId()) {
  if (!store || typeof store !== "object")
    return { key: getCanonicalCharacterConfigKey(characterName, gameId2), value: void 0 };
  const { key, value, canonicalKey } = getCharacterStoreEntry(store, characterName, gameId2);
  if (key && canonicalKey && key !== canonicalKey && value !== void 0) {
    store[canonicalKey] = value;
    delete store[key];
    saveConfig(currentConfig);
    return { key: canonicalKey, value, canonicalKey };
  }
  return { key: canonicalKey || key, value, canonicalKey: canonicalKey || key };
}
function getCharacterConfigStoreValue(store, characterName, fallbackValue, gameId2 = getActiveGameScopeId()) {
  const { key, value, canonicalKey } = moveCharacterStoreValueToCanonicalKey(
    store,
    characterName,
    gameId2
  );
  return {
    key: canonicalKey || key,
    value: value !== void 0 ? value : fallbackValue
  };
}
function getCharacterModCacheKeys(characterName, modName, gameId2 = getActiveGameScopeId()) {
  return getCharacterAliasCandidates(
    characterName,
    gameId2,
    resolveCharacterEntry(characterName, gameId2)
  ).map((alias) => `${gameId2 === "genshin-impact" ? "genshin-impact/" : ""}${alias}/${modName}`);
}
function clearHotkeysCacheForMod(characterName, modName, gameId2 = getActiveGameScopeId()) {
  const cacheKeys = getCharacterModCacheKeys(characterName, modName, gameId2);
  let changed = false;
  cacheKeys.forEach((cacheKey) => {
    if (Object.prototype.hasOwnProperty.call(hotkeysCache, cacheKey)) {
      delete hotkeysCache[cacheKey];
      changed = true;
    }
  });
  if (changed) {
    saveHotkeysCache();
  }
}
function getPrimaryHotkeysCacheKey(characterName, modName, gameId2 = getActiveGameScopeId()) {
  const canonicalCharacterName = getCanonicalCharacterConfigKey(characterName, gameId2);
  return `${gameId2 === "genshin-impact" ? "genshin-impact/" : ""}${canonicalCharacterName}/${modName}`;
}
function invalidateHotkeysForGame(gameId = getActiveGameScopeId()) {
  // Older games share the unprefixed cache; invalidate that whole legacy scope.
  for (const key of Object.keys(hotkeysCache)) {
    if (key.startsWith("genshin-impact/") === (gameId === "genshin-impact")) delete hotkeysCache[key];
  }
  saveHotkeysCache();
  notifyHotkeysChanged("__all__", null, gameId);
}
function notifyHotkeysChanged(characterName, modName, gameId = getActiveGameScopeId(), senderId) {
  for (const window of electron.BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed() && window.webContents.id !== senderId) window.webContents.send("hotkeys-changed", { gameId, characterName, modName });
  }
}
function trackCharacterUsage(characterName, gameId2 = getActiveGameScopeId()) {
  if (!currentConfig.characterUsage) currentConfig.characterUsage = {};
  const canonicalCharacterName = getCanonicalCharacterConfigKey(characterName, gameId2);
  currentConfig.characterUsage[canonicalCharacterName] = Date.now();
  saveConfig(currentConfig);
  return canonicalCharacterName;
}
function getForeignDefaultCharacters(gameId2) {
  const ownDefaults = new Set(getDefaultCharactersForGame(gameId2));
  const foreignDefaults = /* @__PURE__ */ new Set();
  Object.entries(FALLBACK_DEFAULT_CHARACTERS_BY_GAME).forEach(([targetGameId]) => {
    const characters = getDefaultCharactersForGame(targetGameId);
    if (targetGameId === gameId2) return;
    characters.forEach((characterName) => {
      if (!ownDefaults.has(characterName)) {
        foreignDefaults.add(characterName);
      }
    });
  });
  return foreignDefaults;
}
function shouldHideForeignDefaultCharacterFolder(modsPath, characterName, gameId2 = getActiveGameScopeId()) {
  const foreignDefaults = getForeignDefaultCharacters(gameId2);
  if (!foreignDefaults.has(characterName)) return false;
  const charDir = path.join(modsPath, characterName);
  if (!fs.existsSync(charDir)) return false;
  try {
    const entries = fs.readdirSync(charDir, { withFileTypes: true });
    const hasNestedFolders = entries.some((entry) => entry.isDirectory());
    if (hasNestedFolders) return false;
    const hasInfoJson = entries.some((entry) => entry.isFile() && /^info\.json$/i.test(entry.name));
    if (hasInfoJson) return false;
    return true;
  } catch (_) {
    return false;
  }
}
function ensureDefaultCharacterFolders(modsPath, gameId2 = getActiveGameScopeId()) {
  const characterBasePath = getCharacterDirectoryBasePath(modsPath, gameId2, { ensure: true });
  if (!characterBasePath) return { createdCount: 0, copiedCoverCount: 0 };
  if (!fs.existsSync(characterBasePath)) fs.mkdirSync(characterBasePath, { recursive: true });
  const existingEntries = listCharacterDirectories(modsPath, gameId2);
  const existingByKey = /* @__PURE__ */ new Map();
  existingEntries.forEach((entry) => {
    getCharacterAliasCandidates(entry.displayName, gameId2, entry).forEach((alias) => {
      existingByKey.set(normalizeCharacterFolderKey(alias), entry);
    });
    existingByKey.set(normalizeCharacterFolderKey(entry.diskName), entry);
  });
  let createdCount = 0;
  let copiedCoverCount = 0;
  getDefaultCharactersForGame(gameId2).forEach((charName) => {
    if (isCharacterHidden(charName, gameId2)) return;
    const existingEntry = existingByKey.get(normalizeCharacterFolderKey(charName));
    const charDir = existingEntry?.characterRootPath || path.join(characterBasePath, charName);
    if (!fs.existsSync(charDir)) {
      fs.mkdirSync(charDir, { recursive: true });
      createdCount += 1;
    }
  });
  return { createdCount, copiedCoverCount };
}
function bootstrapDefaultCharacterFoldersIfSafe(modsPath, gameId2 = getActiveGameScopeId()) {
  const characterBasePath = getCharacterDirectoryBasePath(modsPath, gameId2, {
    ensure: isNevernessDx12Mode(gameId2)
  });
  if (!characterBasePath || !fs.existsSync(characterBasePath)) {
    return { bootstrapped: false, createdCharacters: [] };
  }
  const beforeNames = new Set(
    listCharacterDirectories(modsPath, gameId2).map((entry) => entry.displayName)
  );
  if (!isNevernessDx12Mode(gameId2) && shouldDeferDefaultCharacterBootstrap(modsPath, gameId2)) {
    return { bootstrapped: false, createdCharacters: [] };
  }
  ensureDefaultCharacterFolders(modsPath, gameId2);
  const afterNames = listCharacterDirectories(modsPath, gameId2).map((entry) => entry.displayName);
  const createdCharacters = afterNames.filter((name) => !beforeNames.has(name));
  return { bootstrapped: true, createdCharacters };
}
function getCharacterListResponse(modsPath, gameId2 = getActiveGameScopeId(), { ensureDefaults = false } = {}) {
  if (ensureDefaults && isNevernessDx12Mode(gameId2)) ensureDefaultCharacterFolders(modsPath, gameId2);
  const characters = sortCharacterEntries(listCharacterDirectories(modsPath, gameId2), gameId2).map(
    (entry) => ({
      name: entry.displayName,
      modCount: entry.modCount,
      enabledCount: entry.enabledCount,
      skinCount: getCharacterOfficialSkinCount(entry.displayName, gameId2),
      coverUrl: getCharacterCoverUrl(entry.displayName),
      searchTerms: getCharacterAliasCandidates(entry.displayName, gameId2, entry)
    })
  );
  return { characters: characters.filter(character => !isCharacterHidden(character.name, gameId2)), hiddenCount: hiddenCharacters.list(gameId2).length };
}
function buildLegacyImportResponse(modsPath, gameId2 = getActiveGameScopeId()) {
  return buildImportPreview(scanImportCandidates(modsPath, gameId2), modsPath);
}
function buildCharacterRefreshResponse(modsPath, gameId2 = getActiveGameScopeId()) {
  // Force a disk read, including nested Pak state whose parent mtime may not change.
  CHARACTER_DIRECTORY_STATS_CACHE.clear();
  return getCharacterListResponse(modsPath, gameId2, { ensureDefaults: false });
}
function buildCharacterOrganizePreview(modsPath, gameId2 = getActiveGameScopeId()) {
  return {
    legacyImport: previewOrganization(modsPath, gameId2),
    looseRootFolders: scanLooseRootModFolders(modsPath, gameId2),
    misplacedModFolders: scanMisplacedModFolders(modsPath, gameId2)
  };
}
let tray = null;
let isQuitting = false;
function getMainWindowState() {
  return { success: true, maximized: mainWindowRef.isMaximized(), focused: mainWindowRef.isFocused() };
}
function isMainWindowSender(event) {
  return mainWindowRef && !mainWindowRef.isDestroyed() && event.sender === mainWindowRef.webContents;
}
electron.ipcMain.handle("window:get-state", (event) => {
  if (!isMainWindowSender(event)) return { success: false, error: "主窗口不可用" };
  return getMainWindowState();
});
electron.ipcMain.handle("window:control", (event, action) => {
  if (!isMainWindowSender(event)) return { success: false, error: "主窗口不可用" };
  if (action === "minimize") mainWindowRef.minimize();
  else if (action === "maximize") {
    if (mainWindowRef.isMaximized()) mainWindowRef.unmaximize();
    else mainWindowRef.maximize();
  } else if (action === "close") mainWindowRef.close();
  else return { success: false, error: "未知窗口操作" };
  return { success: true };
});
function activateMainWindow() {
  if (isQuitting) return;
  const mainWindow = mainWindowRef && !mainWindowRef.isDestroyed() ? mainWindowRef : createWindow();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}
function createWindow() {
  const windowStatePath = path.join(localProfile, "window-state.json");
  const windowState = readWindowState(windowStatePath, electron.screen.getPrimaryDisplay().workArea);
  const mainWindow = new electron.BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    frame: false,
    show: false,
    backgroundColor: "#f6f1ea",
    autoHideMenuBar: true,
    title: runtimeIdentity.name || "QAQ-Revival",
    icon: path.join(__dirname, "../../resources/icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false,
      webSecurity: false
    }
  });
  trackWindowState(mainWindow, windowStatePath, error => logger.warn("Failed to save window state:", error.message));
  try {
    enableNativeFileDrop(mainWindow, {
      ipcMain: electron.ipcMain,
      preferLegacy: isProcessElevated(),
      onDrop: (drop) => {
        logger.info(`Native file drop received: ${drop.paths.length} item(s)`);
        if (!mainWindow.webContents.isDestroyed()) mainWindow.webContents.send("files:native-drop", drop);
      },
      onError: (error) => logger.warn("Native file drop failed:", error.message)
    });
  } catch (error) {
    logger.warn("Native file drop unavailable:", error.message);
  }
  let hasShownMainWindow = false;
  if (runtimeIdentity.name) {
    mainWindow.on("page-title-updated", event => {
      event.preventDefault();
      mainWindow.setTitle(runtimeIdentity.name);
    });
  }
  for (const event of ["maximize", "unmaximize", "focus", "blur"]) {
    mainWindow.on(event, () => {
      if (mainWindowRef === mainWindow && !mainWindow.webContents.isDestroyed()) {
        mainWindow.webContents.send("window:state", getMainWindowState());
      }
    });
  }
  let pageDidLoad = false;
  const reloadMainWindow = () => {
    if (mainWindow.isDestroyed()) return;
    logger.info("Reloading main window...");
    if (utils.is.dev && process.env["ELECTRON_RENDERER_URL"]) {
      mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
    } else {
      mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
    }
  };
  const showMainWindow = (reason) => {
    if (hasShownMainWindow || mainWindow.isDestroyed()) return;
    hasShownMainWindow = true;
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (windowState.maximized) mainWindow.maximize();
    mainWindow.show();
    logger.info(`Main window shown via ${reason}`);
    if (reason === "startup-timeout" && !pageDidLoad) {
      logger.info("Page not loaded yet after timeout — scheduling reload...");
      setTimeout(() => {
        if (!pageDidLoad && !mainWindow.isDestroyed()) {
          reloadMainWindow();
        }
      }, 2e3);
    }
  };
  const mainWindowShowFallback = setTimeout(() => {
    showMainWindow("startup-timeout");
  }, 2500);
  mainWindow.once("ready-to-show", () => {
    clearTimeout(mainWindowShowFallback);
    showMainWindow("ready-to-show");
  });
  mainWindow.webContents.on("did-finish-load", () => {
    pageDidLoad = true;
    clearTimeout(mainWindowShowFallback);
    showMainWindow("did-finish-load");
    genshinAntiCrash.recoverOrphan().catch(e => logger.warn("[Genshin] Anti-error session recovery failed:", e?.message || e));
  });
  let loadRetryCount = 0;
  const MAX_LOAD_RETRIES = 3;
  mainWindow.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL) => {
      logger.error(
        "Main window failed to load:",
        `${errorCode} ${errorDescription}`,
        validatedURL || "unknown-url"
      );
      if (loadRetryCount < MAX_LOAD_RETRIES && !mainWindow.isDestroyed()) {
        loadRetryCount++;
        const delay = loadRetryCount * 1e3;
        logger.info(
          `Retrying page load (attempt ${loadRetryCount}/${MAX_LOAD_RETRIES}) in ${delay}ms...`
        );
        setTimeout(() => {
          if (mainWindow.isDestroyed()) return;
          if (utils.is.dev && process.env["ELECTRON_RENDERER_URL"]) {
            mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
          } else {
            mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
          }
        }, delay);
      } else {
        clearTimeout(mainWindowShowFallback);
        showMainWindow("did-fail-load");
      }
    }
  );
  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    logger.error("Main window render process gone:", details);
  });
  mainWindow.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    const levelName = ["debug", "info", "warn", "error"][level] || `level-${level}`;
    logger.info(
      `Renderer console [${levelName}] ${message}`,
      `${sourceId || "unknown"}:${line || 0}`
    );
  });
  mainWindow.webContents.on("preload-error", (_event, preloadPath, error) => {
    logger.error("Main window preload error:", preloadPath, error);
  });
  mainWindow.on("closed", () => {
    clearTimeout(mainWindowShowFallback);
    if (mainWindowRef === mainWindow) {
      mainWindowRef = null;
    }
  });
  mainWindow.webContents.setWindowOpenHandler((details) => {
    electron.shell.openExternal(details.url);
    return { action: "deny" };
  });
  mainWindow.on("close", async (e) => {
    if (isQuitting) return;
    const behavior = currentConfig.closeBehavior || "ask";
    if (behavior === "minimize") {
      e.preventDefault();
      mainWindow.hide();
      return false;
    }
    if (behavior === "quit") {
      isQuitting = true;
      if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.close();
      if (overlaySideWindow && !overlaySideWindow.isDestroyed()) overlaySideWindow.close();
      return;
    }
    e.preventDefault();
    const result = await electron.dialog.showMessageBox(mainWindow, {
      type: "question",
      title: "关闭窗口",
      message: "请选择关闭方式：",
      buttons: ["最小化到托盘", "彻底退出", "取消"],
      defaultId: 0,
      cancelId: 2,
      checkboxLabel: "记住我的选择，不再提示",
      checkboxChecked: false
    });
    if (result.response === 2) return;
    if (result.checkboxChecked) {
      currentConfig.closeBehavior = result.response === 0 ? "minimize" : "quit";
      saveConfig(currentConfig);
    }
    if (result.response === 0) {
      mainWindow.hide();
    } else {
      isQuitting = true;
      if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.close();
      if (overlaySideWindow && !overlaySideWindow.isDestroyed()) overlaySideWindow.close();
      electron.app.quit();
    }
  });
  if (utils.is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
  mainWindowRef = mainWindow;
  return mainWindow;
}
function createTray() {
  const iconPath = path.join(__dirname, "../../resources/icon.ico");
  tray = new electron.Tray(iconPath);
  const contextMenu = electron.Menu.buildFromTemplate([
    {
      label: "显示窗口",
      click: activateMainWindow
    },
    { type: "separator" },
    {
      label: "完全退出",
      click: () => {
        isQuitting = true;
        if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.close();
        if (overlaySideWindow && !overlaySideWindow.isDestroyed()) overlaySideWindow.close();
        electron.app.quit();
      }
    }
  ]);
  tray.setToolTip("QAQ-Revival");
  tray.setContextMenu(contextMenu);
  tray.on("double-click", activateMainWindow);
}
function applyChromiumStabilityFlags() {
  electron.app.commandLine.appendSwitch("disable-features", "NetworkServiceInProcess2");
  electron.app.commandLine.appendSwitch("disable-gpu-sandbox");
  if (!isStrongCompatibilityModeEnabled()) return;
  electron.app.disableHardwareAcceleration();
  electron.app.commandLine.appendSwitch("disable-gpu");
  electron.app.commandLine.appendSwitch("disable-gpu-compositing");
  electron.app.commandLine.appendSwitch("disable-gpu-rasterization");
  electron.app.commandLine.appendSwitch("disable-accelerated-2d-canvas");
  electron.app.commandLine.appendSwitch("disable-zero-copy");
}
applyChromiumStabilityFlags();
electron.app.whenReady().then(() => {
  electron.protocol.handle(COVER_SCHEME, (request) => characterImageCache.handle(request));
  utils.electronApp.setAppUserModelId(runtimeIdentity.name || "com.qaqmanager.revival");
  electron.app.on("browser-window-created", (_, window) => {
    utils.optimizer.watchWindowShortcuts(window);
  });
  electron.app.on("child-process-gone", (_event, details) => {
    logger.error("Child process gone:", JSON.stringify(details));
    if (details.type === "Utility" || details.type === "GPU") {
      setTimeout(() => {
        const mainWin = mainWindowRef;
        if (!mainWin || mainWin.isDestroyed()) return;
        const currentURL = mainWin.webContents.getURL();
        if (!currentURL || currentURL === "about:blank" || currentURL === "") {
          logger.info("Main window appears blank after child process crash — reloading...");
          if (utils.is.dev && process.env["ELECTRON_RENDERER_URL"]) {
            mainWin.loadURL(process.env["ELECTRON_RENDERER_URL"]);
          } else {
            mainWin.loadFile(path.join(__dirname, "../renderer/index.html"));
          }
        }
      }, 2e3);
    }
  });
  electron.session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ["*://*.ngrok-free.dev/*", "*://*.ngrok.io/*"] },
    (details, callback) => {
      details.requestHeaders["ngrok-skip-browser-warning"] = "true";
      callback({ requestHeaders: details.requestHeaders });
    }
  );
  const mainWindow = createWindow();
  setTimeout(() => {
    showDangerousManagedPathStartupWarning(mainWindow).catch((error) => {
      logger.warn("Failed to show dangerous path warning:", error?.message || error);
    });
  }, 1e3);
  createTray();
  if (!isCompatibilityModeEnabled()) {
    setTimeout(() => {
      createOverlayWindow().catch((error) => {
        logger.warn("Failed to prewarm overlay window:", error?.message || error);
      });
    }, OVERLAY_PREWARM_DELAY_MS);
  } else {
    logger.info("Compatibility mode enabled; skipping overlay prewarm.");
  }
  registerOverlayHotkey(currentConfig.overlayHotkey || "Alt+F");
  try {
    setBackgroundKeypressEnabled(shouldEnableOverlayBackgroundKeypress());
  } catch (e) {
    logger.warn("Failed to init background keypress mode:", e?.message || e);
  }
  electron.app.on("activate", activateMainWindow);
});
const OVERLAY_WINDOW_WIDTH = 420;
const OVERLAY_WINDOW_HEIGHT = 720;
const OVERLAY_WINDOW_MIN_SCALE = 0.85;
const OVERLAY_WINDOW_MAX_SCALE = 1.45;
const OVERLAY_WINDOW_TOP_MARGIN = 20;
const OVERLAY_WINDOW_RIGHT_MARGIN = 10;
const OVERLAY_SIDE_GAP = 8;
const OVERLAY_TOGGLE_COOLDOWN_MS = 320;
const OVERLAY_RECENT_SHOW_GUARD_MS = 750;
const OVERLAY_BLUR_SUPPRESS_MS = 1e3;
const OVERLAY_PREWARM_DELAY_MS = 1200;
let overlayWindow = null;
let overlaySideWindow = null;
let overlayPinned = false;
let sideClosingIntentionally = false;
let overlayToggleCooldownUntil = 0;
let overlaySuppressBlurUntil = 0;
let overlayLastShownAt = 0;
let overlayReadyPromise = null;
let overlaySideRequestId = 0;
let overlaySideContentKey = null;
function normalizeOverlayWindowScale(value) {
  const scale = Number(value);
  if (!Number.isFinite(scale)) return 1;
  return Math.max(OVERLAY_WINDOW_MIN_SCALE, Math.min(OVERLAY_WINDOW_MAX_SCALE, scale));
}
function getOverlayWindowScale() {
  return normalizeOverlayWindowScale(currentConfig.overlayWindowScale);
}
function getOverlayTargetBounds(scale = getOverlayWindowScale()) {
  const cursorPoint = electron.screen.getCursorScreenPoint();
  const targetDisplay = electron.screen.getDisplayNearestPoint(cursorPoint);
  const workArea = targetDisplay?.workArea || electron.screen.getPrimaryDisplay().workArea;
  const windowScale = normalizeOverlayWindowScale(scale);
  const width = Math.round(OVERLAY_WINDOW_WIDTH * windowScale);
  const height = Math.round(OVERLAY_WINDOW_HEIGHT * windowScale);
  return {
    x: workArea.x + Math.max(workArea.width - width - OVERLAY_WINDOW_RIGHT_MARGIN, 0),
    y: workArea.y + OVERLAY_WINDOW_TOP_MARGIN,
    width,
    height
  };
}
function syncOverlayScaleToRenderer() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send("overlay-scale-changed", {
      scale: getOverlayWindowScale()
    });
  }
}
function applyOverlayWindowScale(nextScale) {
  const scale = normalizeOverlayWindowScale(nextScale);
  currentConfig.overlayWindowScale = scale;
  saveConfig(currentConfig);
  const bounds = getOverlayTargetBounds(scale);
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.setBounds(bounds, false);
    syncOverlayScaleToRenderer();
  }
  if (overlayWindow && !overlayWindow.isDestroyed() && overlaySideWindow && !overlaySideWindow.isDestroyed()) {
    const mainBounds = overlayWindow.getBounds();
    const sideBounds = overlaySideWindow.getBounds();
    overlaySideWindow.setBounds({
      x: mainBounds.x - sideBounds.width - OVERLAY_SIDE_GAP,
      y: mainBounds.y,
      width: sideBounds.width,
      height: mainBounds.height
    });
  }
  return {
    success: true,
    scale,
    width: bounds.width,
    height: bounds.height
  };
}
function hideOverlayWindow({ intentionalSideClose = false, resetPin = false } = {}) {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.setOpacity(0);
    overlayWindow.hide();
    overlayWindow.setAlwaysOnTop(false);
  }
  hideSideWindow(intentionalSideClose);
  if (resetPin) overlayPinned = false;
}
function resetOverlayWindowsForModeChange() {
  try {
    if (overlaySideWindow && !overlaySideWindow.isDestroyed()) overlaySideWindow.destroy();
  } catch (_) {
  }
  try {
    if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.destroy();
  } catch (_) {
  }
  overlaySideWindow = null;
  overlayWindow = null;
  overlayReadyPromise = null;
  overlayPinned = false;
}
function createOverlayWindow() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    return overlayReadyPromise || Promise.resolve(overlayWindow);
  }
  const overlayPreloadPath = utils.is.dev ? path.join(__dirname, "../../src/overlay/preload.js") : path.join(process.resourcesPath, "overlay-preload.js");
  const overlayHtmlPath = utils.is.dev ? path.join(__dirname, "../../src/overlay/overlay.html") : path.join(process.resourcesPath, "overlay.html");
  const initialBounds = getOverlayTargetBounds();
  const compatibilityMode = isStrongCompatibilityModeEnabled();
  overlayWindow = new electron.BrowserWindow({
    x: initialBounds.x,
    y: initialBounds.y,
    width: initialBounds.width,
    height: initialBounds.height,
    show: false,
    frame: false,
    transparent: !compatibilityMode,
    backgroundColor: compatibilityMode ? "#f8fafc" : "#00000000",
    alwaysOnTop: false,
    skipTaskbar: true,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    focusable: true,
    fullscreenable: false,
    hasShadow: compatibilityMode,
    paintWhenInitiallyHidden: true,
    webPreferences: {
      preload: overlayPreloadPath,
      sandbox: false,
      webSecurity: false,
      backgroundThrottling: false,
      contextIsolation: true
    }
  });
  overlayReadyPromise = new Promise((resolve) => {
    let resolved = false;
    const markReady = () => {
      if (resolved) return;
      resolved = true;
      overlayReadyPromise = null;
      resolve(overlayWindow);
    };
    overlayWindow.once("ready-to-show", markReady);
    overlayWindow.webContents.once("did-finish-load", markReady);
  });
  overlayWindow.loadFile(overlayHtmlPath);
  overlayWindow.on("hide", () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.webContents.send("overlay-window-hidden");
  });
  overlayWindow.on("blur", () => {
    setTimeout(() => {
      if (sideClosingIntentionally) return;
      if (Date.now() < overlaySuppressBlurUntil) return;
      if (Date.now() - overlayLastShownAt < OVERLAY_RECENT_SHOW_GUARD_MS) return;
      if (overlayWindow && overlayWindow.isVisible() && !overlayPinned) {
        if (overlaySideWindow && !overlaySideWindow.isDestroyed() && overlaySideWindow.isFocused())
          return;
        if (overlayWindow.isFocused()) return;
        hideOverlayWindow();
      }
    }, 200);
  });
  overlayWindow.on("closed", () => {
    overlayWindow = null;
    overlayReadyPromise = null;
    hideSideWindow();
  });
  return overlayReadyPromise;
}
function createSideWindow(contentUrl, width) {
  const overlayPreloadPath = utils.is.dev ? path.join(__dirname, "../../src/overlay/preload.js") : path.join(process.resourcesPath, "overlay-preload.js");
  const sideHtmlPath = utils.is.dev ? path.join(__dirname, "../../src/overlay/side-panel.html") : path.join(process.resourcesPath, "side-panel.html");
  if (overlaySideWindow && !overlaySideWindow.isDestroyed()) {
    overlaySideWindow.destroy();
  }
  const mainBounds = overlayWindow ? overlayWindow.getBounds() : getOverlayTargetBounds();
  const sideWidth = width;
  const sideX = mainBounds.x - sideWidth - OVERLAY_SIDE_GAP;
  const sideY = mainBounds.y;
  const compatibilityMode = isStrongCompatibilityModeEnabled();
  overlaySideWindow = new electron.BrowserWindow({
    width: sideWidth,
    height: mainBounds.height,
    x: sideX,
    y: sideY,
    show: false,
    frame: false,
    transparent: !compatibilityMode,
    backgroundColor: compatibilityMode ? "#f8fafc" : "#00000000",
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    focusable: true,
    hasShadow: compatibilityMode,
    webPreferences: {
      preload: overlayPreloadPath,
      sandbox: false,
      webSecurity: false,
      contextIsolation: true
    }
  });
  overlaySideWindow.loadFile(sideHtmlPath);
  overlaySideWindow.on("blur", () => {
    setTimeout(() => {
      if (sideClosingIntentionally) return;
      if (overlaySideWindow && overlaySideWindow.isVisible()) {
        if (overlayWindow && overlayWindow.isFocused()) return;
        if (!overlayPinned) {
          hideOverlayWindow();
        }
      }
    }, 150);
  });
  overlaySideWindow.on("closed", () => {
    overlaySideWindow = null;
  });
  return overlaySideWindow;
}
function hideSideWindow(intentional) {
  overlaySideRequestId++;
  const requestKey = overlaySideContentKey;
  overlaySideContentKey = null;
  if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.webContents.send("overlay-side-hidden", { requestKey });
  if (intentional) {
    sideClosingIntentionally = true;
    setTimeout(() => {
      sideClosingIntentionally = false;
    }, 300);
  }
  if (overlaySideWindow && !overlaySideWindow.isDestroyed()) {
    overlaySideWindow.setOpacity(0);
    overlaySideWindow.hide();
  }
}
let currentOverlayHotkey = "Alt+F";
function registerOverlayHotkey(hotkey) {
  electron.globalShortcut.unregisterAll();
  const accelerator = hotkey.replace(/\s*\+\s*/g, "+");
  const success = electron.globalShortcut.register(accelerator, () => {
    toggleOverlay();
  });
  if (success) {
    currentOverlayHotkey = accelerator;
    console.log(`[Overlay] Hotkey registered: ${accelerator}`);
  } else {
    console.log(`[Overlay] Failed to register ${accelerator}, trying Ctrl+Shift+M`);
    const fallback = electron.globalShortcut.register("Ctrl+Shift+M", () => {
      toggleOverlay();
    });
    currentOverlayHotkey = fallback ? "Ctrl+Shift+M" : hotkey;
    if (fallback) console.log("[Overlay] Fallback Ctrl+Shift+M registered");
  }
  return success;
}
function toggleOverlay() {
  const now = Date.now();
  if (now < overlayToggleCooldownUntil) return;
  if (overlayWindow && !overlayWindow.isDestroyed() && overlayWindow.isVisible() && now - overlayLastShownAt < OVERLAY_RECENT_SHOW_GUARD_MS) {
    return;
  }
  overlayToggleCooldownUntil = now + OVERLAY_TOGGLE_COOLDOWN_MS;
  if (!overlayWindow) {
    createOverlayWindow()?.then(() => {
      if (overlayWindow && !overlayWindow.isDestroyed() && !overlayWindow.isVisible()) {
        showOverlay();
      }
    });
    return;
  }
  if (overlayReadyPromise) {
    overlayReadyPromise.then(() => {
      if (!overlayWindow || overlayWindow.isDestroyed()) return;
      if (overlayWindow.isVisible()) hideOverlayWindow();
      else showOverlay();
    });
    return;
  }
  if (overlayWindow.isVisible()) {
    hideOverlayWindow();
  } else {
    showOverlay();
  }
}
function showOverlay() {
  if (!overlayWindow) return;
  const bounds = getOverlayTargetBounds();
  overlayLastShownAt = Date.now();
  overlaySuppressBlurUntil = overlayLastShownAt + OVERLAY_BLUR_SUPPRESS_MS;
  const compatibilityMode = isStrongCompatibilityModeEnabled();
  overlayWindow.setOpacity(compatibilityMode ? 1 : 0);
  overlayWindow.setBounds(bounds, false);
  overlayWindow.setAlwaysOnTop(true, "screen-saver");
  overlayWindow.show();
  overlayWindow.focus();
  if (compatibilityMode) {
    try {
      overlayWindow.webContents.invalidate();
    } catch (_) {
    }
  } else {
    setTimeout(() => {
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.setOpacity(1);
      }
    }, 30);
  }
  if (!overlayWindow.webContents.isLoading()) {
    syncOverlayScaleToRenderer();
    overlayWindow.webContents.send("overlay-window-shown");
  } else {
    overlayWindow.webContents.once("did-finish-load", () => {
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        syncOverlayScaleToRenderer();
        overlayWindow.webContents.send("overlay-window-shown");
      }
    });
  }
}
function getCharacterCoverUrl(characterName, gameId2 = getActiveGameScopeId()) {
  try {
    const resolvedEntry = resolveCharacterEntry(characterName, gameId2);
    const canonicalCharacterName = resolvedEntry?.displayName || getCanonicalCharacterConfigKey(characterName, gameId2);
    const coverFilePath = findCharacterCoverFilePath(canonicalCharacterName, gameId2);
    if (coverFilePath && fs.existsSync(coverFilePath)) {
      const ext = path.extname(coverFilePath).toLowerCase();
      const mime = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp"
      }[ext] || "image/jpeg";
      return `data:${mime};base64,${fs.readFileSync(coverFilePath).toString("base64")}`;
    }
    return characterImageCache.coverUrl(getCharacterConfigForGame(gameId2).characterImages?.[canonicalCharacterName]);
  } catch (e) {
  }
  return null;
}
async function prepareOverlayActivity() {
  const gameId = getActiveGameScopeId();
  const env = resolveActiveGameEnvRoot(gameId);
  if (!env || isNevernessDx12Mode(gameId)) return;
  try {
    await overlayActivity.prepare(env, listCharacterDirectories(getModsPath(gameId), gameId)
      .filter(entry => !isCharacterHidden(entry.displayName, gameId)), currentConfig.overlayActivityEnabled !== false);
  } catch (error) {
    logger.warn('Could not prepare overlay activity detection:', error.message);
  }
}
electron.ipcMain.handle('overlay-get-activity', () => ({
  success: true, gameId: getActiveGameScopeId(),
  ...overlayActivity.read(resolveActiveGameEnvRoot())
}));
electron.ipcMain.handle("overlay-get-characters", async () => {
  try {
    const modsPathStatus = getModsPathStatus();
    if (!modsPathStatus.ok) {
      return { success: false, error: modsPathStatus.error, code: modsPathStatus.code };
    }
    const { modsPath } = modsPathStatus;
    const gameId2 = getActiveGameScopeId();
    await prepareOverlayActivity();
    const characters = sortCharacterEntries(listCharacterDirectories(modsPath, gameId2), gameId2).map(
      (entry) => ({
        name: entry.displayName,
        modCount: entry.modCount,
        enabledCount: entry.enabledCount,
        coverUrl: getCharacterCoverUrl(entry.displayName)
      })
    );
    return { success: true, gameId: gameId2, characters: characters.filter(character => !isCharacterHidden(character.name, gameId2)) };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
electron.ipcMain.handle("overlay-get-mods", async (_, characterName) => {
  try {
    const gameId2 = getActiveGameScopeId();
    organizeLegacyCharacterFoldersIfNeeded(gameId2);
    const charPath = resolveCharacterPath(characterName, gameId2);
    if (!charPath || !fs.existsSync(charPath)) return { success: false, error: "角色文件夹不存在" };
    const entries = fs.readdirSync(charPath, { withFileTypes: true });
    const addedAtAccessor = createModAddedAtAccessor();
    let mods = entries.filter((e) => e.isDirectory()).map((e) => {
      const isDisabled = e.name.startsWith("DISABLED_");
      const displayName = isDisabled ? e.name.replace(/^DISABLED_/, "") : e.name;
      const modDir = path.join(charPath, e.name);
      const { addedAt, addedAtMs } = addedAtAccessor.get(characterName, displayName, modDir);
      let previewUrl = null;
      const previewNames = ["preview.png", "preview.jpg", "preview.jpeg", "preview.webp"];
      for (const pn of previewNames) {
        const pp = path.join(modDir, pn);
        if (fs.existsSync(pp)) {
          previewUrl = "file:///" + pp.replace(/\\/g, "/");
          break;
        }
      }
      return {
        name: displayName,
        fullName: e.name,
        enabled: !isDisabled,
        previewUrl,
        marked: isModMarked(gameId2, characterName, displayName),
        addedAt,
        addedAtMs
      };
    }).sort((a, b) => {
      if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    const modOrders = currentConfig.modOrders || {};
    const { value: customOrder } = getCharacterConfigStoreValue(
      modOrders,
      characterName,
      [],
      gameId2
    );
    if (customOrder.length > 0) {
      const orderedMods = [];
      const unorderedMods = [];
      for (const mod of mods) {
        if (customOrder.includes(mod.name)) {
          orderedMods.push(mod);
        } else {
          unorderedMods.push(mod);
        }
      }
      orderedMods.sort((a, b) => customOrder.indexOf(a.name) - customOrder.indexOf(b.name));
      unorderedMods.sort((a, b) => a.name.localeCompare(b.name, "zh"));
      mods = [...orderedMods, ...unorderedMods];
    }
    mods = movePinnedModsToTop(applyPinnedStateToMods(characterName, mods));
    addedAtAccessor.saveIfDirty();
    let conflictModNames = /* @__PURE__ */ new Set();
    try {
      const conflicts = detectConflictsForCharacter(charPath);
      for (const c of conflicts) {
        for (const modName of c.mods) conflictModNames.add(modName);
      }
    } catch (e) {
    }
    for (const mod of mods) {
      mod.hasConflict = conflictModNames.has(mod.name);
    }
    return {
      success: true,
      mods,
      characterAliases: getCharacterAliasCandidates(characterName, gameId2)
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
electron.ipcMain.handle("overlay-set-mod-marked", async (_, { characterName, modName, marked }) => {
  try {
    const gameId2 = getActiveGameScopeId();
    organizeLegacyCharacterFoldersIfNeeded(gameId2);
    const charPath = resolveCharacterPath(characterName, gameId2);
    if (!charPath) return { success: false, error: "角色文件夹不存在" };
    let modDir = path.join(charPath, modName);
    if (!fs.existsSync(modDir)) {
      const disabledModDir = path.join(charPath, `DISABLED_${modName}`);
      if (fs.existsSync(disabledModDir)) modDir = disabledModDir;
    }
    if (!fs.existsSync(modDir)) return { success: false, error: "Mod 文件夹不存在" };
    const nextMarked = !!marked;
    if (nextMarked) {
      setMarkedModForConfig(gameId2, characterName, modName, {
        name: modName,
        characterName,
        gameId: gameId2,
        path: modDir,
        originalPath: modDir,
        markedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    } else {
      deleteMarkedModFromConfig(gameId2, characterName, modName);
    }
    notifyMarkedModsChanged(gameId2, characterName, { modName, reason: "overlay-mark" });
    return { success: true, marked: nextMarked };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
electron.ipcMain.handle("overlay-toggle-mod", async (_, { characterName, modName, enabled }) => {
  try {
    const gameId2 = getActiveGameScopeId();
    if (enabled) assertCharacterVisible(characterName, gameId2);
    if (isNevernessDx12Mode(gameId2)) {
      const result = toggleNevernessDx12PakMod(characterName, modName, enabled);
      if (!result?.success) return { success: false, error: result?.error || "切换 Pak Mod 失败" };
      return result;
    }
    organizeLegacyCharacterFoldersIfNeeded(gameId2);
    const env = resolveActiveGameEnvRoot(gameId2);
    const charPath = resolveCharacterPath(characterName, gameId2);
    if (!charPath) {
      return { success: false, error: "角色文件夹不存在" };
    }
    const currentName = enabled ? `DISABLED_${modName}` : modName;
    const newName = enabled ? modName : `DISABLED_${modName}`;
    const oldPath = path.join(charPath, currentName);
    const newPath = path.join(charPath, newName);
    if (!fs.existsSync(oldPath)) {
      const altOld = path.join(charPath, enabled ? modName : `DISABLED_${modName}`);
      if (fs.existsSync(altOld)) {
        return { success: true };
      }
      return { success: false, error: `找不到 Mod 文件夹: ${currentName}` };
    }
    if (!enabled && isPersistBridgeEnabled(gameId2)) {
      if (usesManagedPersistBridge(characterName, modName, gameId2)) {
        syncPersistBridgeStateForModDir(oldPath, gameId2);
      }
    }
    const renameResult = await renameModDirectoryWithRetry(oldPath, newPath);
    if (!renameResult.success) {
      return { success: false, error: renameResult.error || "切换 Mod 失败" };
    }
    if (env?.root && isPersistBridgeEnabled(gameId2)) {
      const stateFiles = collectHostedPersistStateFilesForModDir(newPath);
      updateActivePersistBridgeIncludesIncremental(
        env.root,
        enabled ? { enableStateFiles: stateFiles } : { disableStateFiles: stateFiles }
      );
    }
    clearConflictCache(characterName, gameId2);
    let persistRestored = false;
    if (enabled) {
      if (currentConfig.overlayAutoReloadEnabled) {
        await triggerOverlayReload();
      }
    }
    notifyCharacterListChanged(characterName, { modName, reason: "overlay-toggle" });
    return {
      success: true,
      autoReloaded: !!(enabled && currentConfig.overlayAutoReloadEnabled),
      persistRestored
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
electron.ipcMain.handle("overlay-trigger-reload", async () => {
  try {
    await triggerOverlayReload();
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
electron.ipcMain.handle("overlay-get-settings", async () => {
  return {
    success: true,
    settings: {
      autoReloadEnabled: !!currentConfig.overlayAutoReloadEnabled,
      presetAutoReloadEnabled: !!currentConfig.overlayPresetAutoReloadEnabled,
      clickableHotkeysEnabled: !!currentConfig.overlayClickableHotkeysEnabled,
      activityEnabled: currentConfig.overlayActivityEnabled !== false,
      autoLocateEnabled: currentConfig.overlayAutoLocateEnabled !== false,
      overlayScale: getOverlayWindowScale(),
      compatibilityMode: isStrongCompatibilityModeEnabled(),
      compatibilityLevel: getCompatibilityLevel(),
      persistBridgeEnabled: !!isPersistBridgeEnabled(),
      persistBridgeCacheSize: null
    }
  };
});
electron.ipcMain.handle("overlay-update-settings", async (_, updates = {}) => {
  const previousAutoLocate = currentConfig.overlayAutoLocateEnabled;
  if (updates.autoLocateEnabled !== undefined && typeof updates.autoLocateEnabled !== "boolean") return { success: false, error: "自动定位开关无效" };
  if (typeof updates.activityEnabled === 'boolean') {
    currentConfig.overlayActivityEnabled = updates.activityEnabled;
    if (!updates.activityEnabled) {
      for (const game of currentConfig.games || []) {
        const env = resolveActiveGameEnvRoot(game.id);
        if (env) {
          try { await overlayActivity.prepare(env, [], false); }
          catch (error) { logger.warn('Could not disable overlay activity detection:', error.message); }
        }
      }
    }
    await prepareOverlayActivity();
  }
  if (updates.persistBridgeCacheSize !== undefined && updates.persistBridgeCacheSize !== null) {
    return { success: false, error: "Mod 状态现为不限数量保存，请在状态管理页删除不需要的内容" };
  }
  if (updates.persistBridgeEnabled !== undefined) {
    try { persistManager.setEnabled(updates.gameId, updates.persistBridgeEnabled); }
    catch (error) { return { success: false, error: error.message }; }
  }
  let keypressModeChanged = false;
  if (typeof updates.autoReloadEnabled === "boolean") {
    keypressModeChanged = keypressModeChanged || currentConfig.overlayAutoReloadEnabled !== updates.autoReloadEnabled;
    currentConfig.overlayAutoReloadEnabled = updates.autoReloadEnabled;
  }
  if (typeof updates.presetAutoReloadEnabled === "boolean") {
    keypressModeChanged = keypressModeChanged || currentConfig.overlayPresetAutoReloadEnabled !== updates.presetAutoReloadEnabled;
    currentConfig.overlayPresetAutoReloadEnabled = updates.presetAutoReloadEnabled;
  }
  if (typeof updates.clickableHotkeysEnabled === "boolean") {
    currentConfig.overlayClickableHotkeysEnabled = updates.clickableHotkeysEnabled;
  }
  if (updates.autoLocateEnabled !== undefined) currentConfig.overlayAutoLocateEnabled = updates.autoLocateEnabled;
  if (!saveConfig(currentConfig)) {
    currentConfig.overlayAutoLocateEnabled = previousAutoLocate;
    return { success: false, error: "设置保存失败，请重试" };
  }
  if (keypressModeChanged) {
    try {
      setBackgroundKeypressEnabled(shouldEnableOverlayBackgroundKeypress());
    } catch (e) {
      logger.warn("Failed to toggle background keypress from overlay settings:", e?.message || e);
    }
  }
  return {
    success: true,
    settings: {
      autoReloadEnabled: !!currentConfig.overlayAutoReloadEnabled,
      presetAutoReloadEnabled: !!currentConfig.overlayPresetAutoReloadEnabled,
      clickableHotkeysEnabled: !!currentConfig.overlayClickableHotkeysEnabled,
      activityEnabled: currentConfig.overlayActivityEnabled !== false,
      autoLocateEnabled: currentConfig.overlayAutoLocateEnabled !== false,
      overlayScale: getOverlayWindowScale(),
      compatibilityMode: isStrongCompatibilityModeEnabled(),
      compatibilityLevel: getCompatibilityLevel(),
      persistBridgeEnabled: !!isPersistBridgeEnabled(),
      persistBridgeCacheSize: null
    }
  };
});
electron.ipcMain.handle("overlay-resize-window", async (_, nextScale) => {
  try {
    return applyOverlayWindowScale(nextScale);
  } catch (e) {
    return { success: false, error: e.message };
  }
});
electron.ipcMain.handle("persist-bridge-clear-cache", async (_, gameId) => {
  try { return persistManager.remove(gameId); }
  catch (error) { return { success: false, error: error.message }; }
});
electron.ipcMain.handle("persist-bridge-games", async () => {
  try { return { success: true, games: persistManager.listGames() }; }
  catch (error) { return { success: false, error: error.message }; }
});
electron.ipcMain.handle("persist-bridge-list", async (_, gameId, options = {}) => {
  try { return persistManager.list(gameId, { metadataOnly: options.metadataOnly === true, ids: Array.isArray(options.ids) ? options.ids.filter(id => typeof id === "string") : undefined, refresh: options.refresh === true }); }
  catch (error) { return { success: false, error: error.message }; }
});
electron.ipcMain.handle("persist-bridge-mod", async (_, { gameId, characterName, modName } = {}) => {
  try {
    characterName = assertSafeAppearancePathSegment(characterName, "角色名称");
    modName = assertSafeAppearancePathSegment(modName, "Mod 名称");
    return persistManager.mod(getSettingsGame(gameId).id, characterName, modName);
  } catch (error) { return { success: false, error: error.message }; }
});
electron.ipcMain.handle("persist-bridge-set-enabled", async (_, { gameId, enabled } = {}) => {
  try {
    getSettingsGame(gameId);
    persistManager.setEnabled(gameId, enabled);
    return { success: true, restartRequired: true };
  } catch (error) { return { success: false, error: error.message }; }
});
electron.ipcMain.handle("persist-bridge-delete", async (_, { gameId, ids } = {}) => {
  try {
    if (!Array.isArray(ids)) throw new Error("请选择要删除的保存项");
    return persistManager.remove(gameId, ids);
  } catch (error) { return { success: false, error: error.message }; }
});
electron.ipcMain.handle("overlay-apply-hotkey", async (_, { keys, hotkey } = {}) => {
  if (!currentConfig.overlayAutoReloadEnabled) {
    return {
      success: false,
      error: "请先在设置里开启自动装载，再使用快捷键点击应用"
    };
  }
  try {
    await applyOverlayHotkey(hotkey || keys);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
let lastSideWidths = currentConfig.sidePanelWidths || { detail: 300, characters: 220 };
let currentSidePanelType = "detail";
electron.ipcMain.handle("overlay-show-side", async (event, { width, content }) => {
  const requestId = ++overlaySideRequestId;
  const gameId = getActiveGameScopeId();
  const owner = overlayWindow && event.sender === overlayWindow.webContents ? overlayWindow : null;
  const openedAt = overlayLastShownAt;
  const canShowSide = () => requestId === overlaySideRequestId && gameId === getActiveGameScopeId() && (!owner || (!owner.isDestroyed() && owner === overlayWindow && owner.isVisible() && openedAt === overlayLastShownAt));
  if (!canShowSide()) return { success: false, cancelled: true };
  try {
    const panelType = content && content.type || "detail";
    currentSidePanelType = panelType;
    const useWidth = width || lastSideWidths[panelType] || 300;
    if (!overlaySideWindow || overlaySideWindow.isDestroyed()) {
      createSideWindow(null, useWidth);
    }
    if (!overlaySideWindow || overlaySideWindow.isDestroyed()) {
      return { success: false, error: "Failed to create side window" };
    }
    const alreadyVisible = overlaySideWindow.isVisible() && overlaySideWindow.getOpacity() > 0;
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      const mainBounds = overlayWindow.getBounds();
      const sideX = mainBounds.x - useWidth - OVERLAY_SIDE_GAP;
      overlaySideWindow.setBounds({
        x: sideX,
        y: mainBounds.y,
        width: useWidth,
        height: mainBounds.height
      });
    }
    const sendContent = () => {
      if (canShowSide() && overlaySideWindow && !overlaySideWindow.isDestroyed()) {
        overlaySideContentKey = content?.requestKey || null;
        overlaySideWindow.webContents.send("side-panel-content", {
          ...content || {},
          gameId,
          currentWidth: useWidth
        });
      }
    };
    if (overlaySideWindow.webContents.isLoading()) {
      await new Promise((resolve) => {
        overlaySideWindow.webContents.once("did-finish-load", () => {
          sendContent();
          resolve();
        });
      });
    } else {
      sendContent();
    }
    if (!alreadyVisible) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      if (!canShowSide()) return { success: false, cancelled: true };
      const compatibilityMode = isStrongCompatibilityModeEnabled();
      overlaySideWindow.setOpacity(compatibilityMode ? 1 : 0);
      overlaySideWindow.setAlwaysOnTop(true, "screen-saver");
      overlaySideWindow.showInactive();
      if (!compatibilityMode) {
        setTimeout(() => {
          if (overlaySideWindow && !overlaySideWindow.isDestroyed()) {
            overlaySideWindow.setOpacity(1);
          }
        }, 30);
      }
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
electron.ipcMain.handle("overlay-hide-side", async () => {
  hideSideWindow(true);
  return { success: true };
});
electron.ipcMain.handle("overlay-open-manager-view", async (_, { characterName, modName } = {}) => {
  try {
    const mainWin = mainWindowRef || electron.BrowserWindow.getAllWindows().find((w) => w !== overlayWindow && w !== overlaySideWindow);
    if (!mainWin || mainWin.isDestroyed()) {
      return { success: false, error: "未找到主窗口" };
    }
    hideOverlayWindow({ intentionalSideClose: true });
    if (mainWin.isMinimized()) mainWin.restore();
    mainWin.show();
    mainWin.focus();
    mainWin.webContents.send("open-manager-target", {
      characterName,
      modName,
      timestamp: Date.now()
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
electron.ipcMain.handle("overlay-resize-side", async (_, newWidth) => {
  if (!overlaySideWindow || overlaySideWindow.isDestroyed() || !overlayWindow)
    return { success: false };
  const w = Math.max(200, Math.min(550, newWidth));
  lastSideWidths[currentSidePanelType] = w;
  currentConfig.sidePanelWidths = lastSideWidths;
  saveConfig(currentConfig);
  const mainBounds = overlayWindow.getBounds();
  const sideX = mainBounds.x - w - OVERLAY_SIDE_GAP;
  overlaySideWindow.setBounds({ x: sideX, y: mainBounds.y, width: w, height: mainBounds.height });
  return { success: true, width: w };
});
electron.ipcMain.handle("overlay-update-side", async (_, content) => {
  if ((content?.requestKey || null) !== overlaySideContentKey) return { success: false, cancelled: true };
  if (overlaySideWindow && !overlaySideWindow.isDestroyed()) {
    overlaySideWindow.webContents.send("side-panel-content", { ...content, gameId: getActiveGameScopeId() });
  }
  return { success: true };
});
electron.ipcMain.handle("overlay-select-char-from-side", async (_, charName) => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.focus();
  }
  hideSideWindow(true);
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send("overlay-char-selected", charName);
  }
  return { success: true };
});
electron.ipcMain.handle("overlay-hide", async () => {
  hideOverlayWindow({ resetPin: true });
  return { success: true };
});
electron.ipcMain.handle("overlay-toggle-pin", async (_, pinned) => {
  overlayPinned = !!pinned;
  return { success: true };
});
electron.ipcMain.handle("overlay-change-hotkey", async (_, newHotkey) => {
  try {
    const accelerator = newHotkey.replace(/\s*\+\s*/g, "+");
    const success = registerOverlayHotkey(accelerator);
    if (success) {
      currentConfig.overlayHotkey = accelerator;
      saveConfig(currentConfig);
      return { success: true, hotkey: accelerator };
    } else {
      return {
        success: false,
        error: `快捷键 ${accelerator} 注册失败（可能被其他程序占用），已使用备用快捷键 ${currentOverlayHotkey}`
      };
    }
  } catch (e) {
    return { success: false, error: e.message };
  }
});
electron.ipcMain.handle("get-overlay-hotkey", async () => {
  return {
    success: true,
    hotkey: currentOverlayHotkey,
    configured: currentConfig.overlayHotkey || "Alt+F"
  };
});
electron.ipcMain.handle("set-overlay-hotkey", async (_, newHotkey) => {
  try {
    const accelerator = newHotkey.replace(/\s*\+\s*/g, "+");
    const success = registerOverlayHotkey(accelerator);
    if (success) {
      currentConfig.overlayHotkey = accelerator;
      saveConfig(currentConfig);
      return { success: true, hotkey: accelerator };
    } else {
      return {
        success: false,
        error: `快捷键 ${accelerator} 注册失败（可能被其他程序占用），当前使用: ${currentOverlayHotkey}`,
        hotkey: currentOverlayHotkey
      };
    }
  } catch (e) {
    return { success: false, error: e.message };
  }
});
electron.ipcMain.handle("toggle-overlay-from-ui", async () => {
  try {
    const mainWin = electron.BrowserWindow.getAllWindows().find(
      (w) => w !== overlayWindow && w !== overlaySideWindow
    );
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.minimize();
    }
    toggleOverlay();
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
electron.ipcMain.handle("overlay-get-presets", async () => {
  try {
    const data = loadPresets();
    return {
      success: true,
      presets: withBuiltinPresets(data.presets || []),
      activePresetId: data.activePresetId
    };
  } catch (e) {
    return { success: true, presets: withBuiltinPresets([]) };
  }
});
electron.ipcMain.handle("overlay-activate-preset", async (_, presetName) => {
  try {
    const gameId2 = getActiveGameScopeId();
    const presetsData = loadPresets();
    const preset = findPresetByName(presetsData, presetName);
    if (!preset) return { success: false, error: "预设不存在" };
    const applyResult = await applyPresetModsForGame(preset, gameId2);
    if (!applyResult?.success) {
      return { success: false, error: applyResult?.error || "应用预设失败" };
    }
    if (currentConfig.overlayPresetAutoReloadEnabled) {
      await triggerOverlayReload();
    }
    const localPresetData = loadPresets();
    localPresetData.activePresetId = preset.id;
    savePresets(localPresetData);
    notifyPresetApplicationChanged();
    return {
      success: true,
      autoReloaded: !!currentConfig.overlayPresetAutoReloadEnabled,
      results: applyResult.results
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
electron.app.on("will-quit", () => {
  try {
    setBackgroundKeypressEnabled(false);
  } catch (e) {
    logger.warn("Failed to reset background keypress before quit:", e?.message || e);
  }
  electron.globalShortcut.unregisterAll();
  // Best effort: leftovers from an interrupted anti-error session are recovered on next start.
  genshinAntiCrash.cleanup({ force: false, quiet: true }).catch(() => {});
});
electron.ipcMain.handle("get-config", async () => {
  return {
    success: true,
    config: buildRendererConfig()
  };
});
electron.ipcMain.handle("settings:update-random-launch", async (_, updates) => {
  if (!updates || typeof updates !== "object" || Array.isArray(updates) || !Object.keys(updates).length ||
      Object.entries(updates).some(([key, value]) => !["manager", "xxmi"].includes(key) || typeof value !== "boolean")) {
    return { success: false, error: "随机名设置无效" };
  }
  const randomLaunch = { ...getRandomLaunchSettings(currentConfig), ...updates };
  const next = { ...currentConfig, randomLaunch };
  if (!saveConfig(next)) return { success: false, error: "保存设置失败，请重试" };
  currentConfig = next;
  return { success: true, settings: randomLaunch, restartRequired: Object.hasOwn(updates, "manager") };
});
electron.ipcMain.handle("game:get-settings", async (_, gameId) => {
  try {
    const game = getSettingsGame(gameId);
    const paths = getResolvedGamePaths(game.id);
    return {
      success: true,
      game: { ...serializeGameForRenderer(game), modFolderPath: paths.modsPath, gamePath: paths.gamePath, modLoaderPath: paths.modLoaderPath },
      xxmiImporterInfo: readXxmiImporterPathInfo(paths.modLoaderPath, game.id)
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
const genshinDiagnostics = require("./genshin-diagnostics.cjs").createGenshinDiagnostics({
  getGame: () => getSettingsGame("genshin-impact"),
  resolveLauncherRoot: resolveXxmiRootFromLauncherPath,
  tokenizeArgs: parseLaunchArgs,
  backupDir: path.join(electron.app.getPath("userData"), "game-settings-backups", "genshin-impact"),
  assertStopped: async state => {
    const literal = value => "'" + value.replace(/'/g, "''") + "'";
    const roots = [...new Set([state.gameDir, state.configuredGame].filter(Boolean))];
    const bin = path.join(state.root, "Resources", "Bin");
    const script = `$ErrorActionPreference='Stop'; $gameDirs=@(${roots.map(literal).join(",")}); $loaderDir=${literal(bin)}; $found=@(Get-Process | Where-Object { $_.Path -and ((($_.ProcessName -in @('YuanShen','GenshinImpact')) -and ([IO.Path]::GetDirectoryName($_.Path) -in $gameDirs)) -or [IO.Path]::GetDirectoryName($_.Path) -eq $loaderDir) }); Write-Output $found.Count`;
    await new Promise((resolve, reject) => child_process.execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")], { windowsHide: true, timeout: 8000 }, (error, stdout) => {
      if (error) reject(new Error("无法确认运行状态，请关闭原神与 XXMI 后重试"));
      else if (String(stdout).trim() !== "0") reject(new Error("请先完全关闭原神与 XXMI，再修复或恢复路径配置"));
      else resolve();
    }));
  }
});
for (const [channel, action] of Object.entries({
  "genshin:check-environment": () => genshinDiagnostics.check(),
  "genshin:repair-environment": payload => genshinDiagnostics.apply(payload),
  "genshin:restore-environment": payload => genshinDiagnostics.restore(payload)
})) {
  electron.ipcMain.handle(channel, async (_, payload) => {
    try { return await action(payload); } catch (error) { return { success: false, error: error.message }; }
  });
}
electron.ipcMain.handle("genshin:update-check-settings", async (_, updates) => {
  try {
    if (!updates || typeof updates !== "object" || Array.isArray(updates) || !Object.keys(updates).length ||
        Object.keys(updates).some(key => !["preflightEnabled", "launchArgs"].includes(key)) ||
        (updates.preflightEnabled !== undefined && typeof updates.preflightEnabled !== "boolean") ||
        (updates.launchArgs !== undefined && (typeof updates.launchArgs !== "string" || updates.launchArgs.length > 2048 || /[\0\r\n]/.test(updates.launchArgs)))) {
      return { success: false, error: "原神检查设置无效" };
    }
    const game = getSettingsGame("genshin-impact");
    const updated = { ...game };
    if (updates.preflightEnabled !== undefined) updated.genshinPreflightEnabled = updates.preflightEnabled;
    if (updates.launchArgs !== undefined) updated.launchArgs = updates.launchArgs.trim();
    const next = { ...currentConfig, games: currentConfig.games.map(item => item.id === game.id ? updated : item) };
    if (!saveConfig(next)) throw Error("设置保存失败，请重试");
    currentConfig = next; notifyGamesChanged();
    return { ...genshinDiagnostics.check(), message: "原神检查设置已保存" };
  } catch (error) { return { success: false, error: error.message }; }
});
electron.ipcMain.handle("genshin:export-check", async () => {
  try {
    const report = genshinDiagnostics.exportReport();
    const selected = await electron.dialog.showSaveDialog(mainWindowRef, { title: "导出原神兼容检查报告", defaultPath: "genshin-compatibility.json", filters: [{ name: "检查报告", extensions: ["json"] }] });
    if (selected.canceled || !selected.filePath) return { success: false, canceled: true };
    if (!path.isAbsolute(selected.filePath) || path.extname(selected.filePath).toLowerCase() !== ".json") throw Error("请选择 JSON 报告文件");
    fs.writeFileSync(selected.filePath, JSON.stringify(report, null, 2) + "\n", "utf8");
    return { success: true, path: selected.filePath, message: "检查报告已导出；不包含绝对路径、账号资料或原始日志。" };
  } catch (error) { return { success: false, error: error.message }; }
});
const genshinAntiCrash = require("./genshin-anticrash.cjs").createGenshinAntiCrashService({
  getGame: () => getSettingsGame("genshin-impact"),
  defaultCustomDllPath: path.join(electron.app.isPackaged ? path.dirname(process.execPath) : path.resolve(__dirname, "../../.."), "local-components", "d3d11-nocheck.dll"),
  resolveLauncherRoot: resolveXxmiRootFromLauncherPath,
  stateDir: path.join(electron.app.getPath("userData"), "genshin-anticrash"),
  assertStopped: async state => {
    const literal = value => "'" + value.replace(/'/g, "''") + "'";
    const bin = path.join(state.root, "Resources", "Bin");
    const script = `$ErrorActionPreference='Stop'; $gameDir=${literal(state.gameDir + path.sep)}; $loaderDir=${literal(bin)}; $found=@(Get-Process | Where-Object { $_.Path -and ((($_.ProcessName -in @('YuanShen','GenshinImpact')) -and $_.Path.StartsWith($gameDir,[StringComparison]::OrdinalIgnoreCase)) -or [IO.Path]::GetDirectoryName($_.Path) -eq $loaderDir) }); Write-Output $found.Count`;
    await new Promise((resolve, reject) => child_process.execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")], { windowsHide: true, timeout: 8000 }, (error, stdout) => {
      if (error) reject(new Error("无法确认运行状态，请关闭原神与 XXMI 后重试"));
      else if (String(stdout).trim() !== "0") reject(new Error("请先完全关闭原神与 XXMI，再应用防报错启动"));
      else resolve();
    }));
  },
  runNetsh: args => new Promise(resolve => child_process.execFile("netsh.exe", args, { windowsHide: true, timeout: 15000 }, (error, stdout) => resolve({ ok: !error, error: error?.message, stdout: String(stdout || "") }))),
  isFirewallRulePresent: name => new Promise((resolve, reject) => {
    const literal = "'" + name.replace(/'/g, "''") + "'";
    const script = `$ErrorActionPreference='Stop'; $rules=@(Get-NetFirewallRule -PolicyStore PersistentStore -ErrorAction Stop | Where-Object { $_.DisplayName -eq ${literal} }); Write-Output $rules.Count`;
    child_process.execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")], { windowsHide: true, timeout: 15000 }, (error, stdout) => {
      const count = String(stdout).trim();
      if (error || !/^\d+$/.test(count)) reject(error || new Error("无法确认防火墙规则状态"));
      else resolve(Number(count) > 0);
    });
  }),
  isProcessNameRunning: isWindowsProcessRunning,
  isElevated: () => isProcessElevated()
});
const GENSHIN_ANTI_CRASH_KEYS = ["twin", "manualStart", "injectMode", "networkBlock", "originalDll", "customDll", "customDllPath"];
for (const [channel, action] of Object.entries({
  "genshin:get-anticrash": () => genshinAntiCrash.get(),
  "genshin:update-anticrash": async settings => {
    const validPath = value => typeof value === "string" && value === "" || typeof value === "string" && path.isAbsolute(value) &&
      path.extname(value).toLowerCase() === ".dll" && value.length <= 1024 && !/[\0\r\n]/.test(value);
    if (!settings || typeof settings !== "object" || Array.isArray(settings) || !Object.keys(settings).length ||
        Object.keys(settings).some(key => !GENSHIN_ANTI_CRASH_KEYS.includes(key)) ||
        ["twin", "manualStart", "networkBlock", "originalDll", "customDll"].some(key => settings[key] !== undefined && typeof settings[key] !== "boolean") ||
        (settings.injectMode !== undefined && !["default", "hook", "direct"].includes(settings.injectMode)) ||
        (settings.customDllPath !== undefined && !validPath(settings.customDllPath))) {
      return { success: false, error: "原神防报错设置无效" };
    }
    const game = getSettingsGame("genshin-impact");
    const previousPath = typeof game.genshinAntiError?.customDllPath === "string" ? game.genshinAntiError.customDllPath : "";
    const nextPath = settings.customDllPath !== undefined ? settings.customDllPath.trim() : previousPath;
    game.genshinAntiError = genshinAntiCrash.normalizeSettings({ ...(game.genshinAntiError || {}), ...settings });
    game.genshinAntiError.customDllPath = nextPath;
    if (!saveConfig(currentConfig)) return { success: false, error: "设置保存失败，请重试" };
    notifyGamesChanged();
    return { ...genshinAntiCrash.get(), message: "原神防报错设置已保存，下次通过 QAQ 直接启动时生效。" };
  },
  "genshin:anticrash-cleanup": () => genshinAntiCrash.cleanup({ force: false }),
  "genshin:select-custom-dll": async () => {
    const selected = await electron.dialog.showOpenDialog(mainWindowRef, { title: "选择外部定制组件 d3d11.dll", properties: ["openFile"], filters: [{ name: "图形组件", extensions: ["dll"] }] });
    if (selected.canceled || !selected.filePaths?.length) return { success: false, canceled: true };
    const file = selected.filePaths[0];
    if (path.extname(file).toLowerCase() !== ".dll") return { success: false, error: "请选择 DLL 文件" };
    return { success: true, path: file };
  }
})) {
  electron.ipcMain.handle(channel, async (_, payload) => {
    try { return await action(payload); } catch (error) { return { success: false, error: error.message }; }
  });
}
const wuwaTuningService = require("./wuwa-tuning.cjs").createWuwaTuningService({
  backupDir: path.join(electron.app.getPath("userData"), "game-settings-backups", "wuthering-waves"),
  resolvePaths: () => {
    const game = getSettingsGame("wuthering-waves");
    const launcherRoot = resolveXxmiRootFromLauncherPath(game.modLoaderPath);
    const info = readXxmiImporterPathInfo(game.modLoaderPath, game.id);
    let gameRoot = game.gamePath ? path.dirname(game.gamePath) : info.gameFolder ? path.resolve(launcherRoot, info.gameFolder) : "";
    for (let level = 0; gameRoot && level < 6; level++) {
      if (fs.existsSync(path.join(gameRoot, "Wuthering Waves.exe"))) break;
      const parent = path.dirname(gameRoot);
      if (parent === gameRoot) { gameRoot = ""; break; }
      gameRoot = parent;
    }
    return { gameRoot, launcherConfig: launcherRoot ? path.join(launcherRoot, "XXMI Launcher Config.json") : "" };
  },
  assertStopped: async files => {
    const gameRoot = path.resolve(path.dirname(files.user.file), "../..");
    const launcherBin = path.join(path.dirname(files.launcher.file), "Resources", "Bin");
    const literal = value => "'" + value.replace(/'/g, "''") + "'";
    const script = `$ErrorActionPreference='Stop'; $gameRoot=${literal(gameRoot + path.sep)}; $launcherBin=${literal(launcherBin)}; $found=@(Get-Process | Where-Object { $_.Path -and (($_.ProcessName -in @('Client-Win64-Shipping','Wuthering Waves') -and $_.Path.StartsWith($gameRoot,[StringComparison]::OrdinalIgnoreCase)) -or [IO.Path]::GetDirectoryName($_.Path) -eq $launcherBin) }); Write-Output $found.Count`;
    await new Promise((resolve, reject) => child_process.execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")], { windowsHide: true, timeout: 8000 }, (error, stdout) => {
      if (error) reject(new Error("无法确认游戏运行状态，请关闭鸣潮与 XXMI 后重试"));
      else if (String(stdout).trim() !== "0") reject(new Error("请先完全关闭鸣潮与 XXMI，再应用或恢复游戏配置"));
      else resolve();
    }));
  }
});
for (const [channel, action] of Object.entries({ "wuwa:get-tuning": () => wuwaTuningService.get(), "wuwa:apply-tuning": payload => wuwaTuningService.apply(payload), "wuwa:restore-tuning": payload => wuwaTuningService.restore(payload) })) {
  electron.ipcMain.handle(channel, async (_, payload) => {
    try { return await action(payload); } catch (error) { return { success: false, error: error.message }; }
  });
}
electron.ipcMain.handle("wuwa:import-device-profile", async (_, { revision } = {}) => {
  try {
    const selected = await electron.dialog.showOpenDialog(mainWindowRef, { title: "选择鸣潮 DeviceProfiles.ini", properties: ["openFile"], filters: [{ name: "DeviceProfiles 配置", extensions: ["ini"] }] });
    if (selected.canceled || !selected.filePaths?.length) return { success: false, canceled: true };
    return await wuwaTuningService.apply({ preset: "device-profile", revision, deviceProfilePath: selected.filePaths[0] });
  } catch (error) { return { success: false, error: error.message }; }
});
electron.ipcMain.handle("get-runtime-info", async () => {
  return {
    appName: electron.app.getName(),
    appVersion: electron.app.getVersion(),
    platform: process.platform,
    elevated: isProcessElevated(),
    isDev: utils.is.dev,
    isPackaged: electron.app.isPackaged
  };
});
electron.ipcMain.handle("neverness:dx12-status", async () => {
  try {
    return getNevernessDx12Status();
  } catch (error) {
    return { success: false, error: error.message };
  }
});
electron.ipcMain.handle("neverness:dx12-set-mode", async (_, mode) => {
  try {
    setNevernessModMode(mode);
    return getNevernessDx12Status();
  } catch (error) {
    return { success: false, error: error.message };
  }
});
electron.ipcMain.handle("neverness:dx12-launch-loader", async () => {
  try {
    return await launchNevernessDx12Loader();
  } catch (error) {
    return { success: false, error: error.message };
  }
});
electron.ipcMain.handle("neverness:dx12-reinstall-loader", async () => {
  try {
    return reinstallNevernessDx12Loader();
  } catch (error) {
    return { success: false, error: error.message };
  }
});
electron.ipcMain.handle("neverness:dx12-open-pak-folder", async () => {
  try {
    const paths = ensureNevernessDx12GamePaths();
    const openError = await electron.shell.openPath(paths.pakModsDir);
    if (openError) return { success: false, error: openError };
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
electron.ipcMain.handle("neverness:dx12-select-disabled-mods-dir", async () => {
  try {
    const paths = getNevernessDx12Paths();
    const result = await electron.dialog.showOpenDialog({
      title: "选择异环关闭 Mod 保存目录",
      defaultPath: paths.disabledModsDir || getNevernessDx12DisabledModsDir(),
      properties: ["openDirectory", "createDirectory"],
      buttonLabel: "保存到这里"
    });
    if (result.canceled || !result.filePaths?.[0]) return { ...getNevernessDx12Status(), canceled: true };
    const dirPath = result.filePaths[0];
    probeWritableDirectory(dirPath, "异环关闭 Mod 保存目录");
    setNevernessDx12DisabledModsDir(dirPath);
    return getNevernessDx12Status();
  } catch (error) {
    return { success: false, error: error.message };
  }
});
electron.ipcMain.handle("neverness:dx12-reset-disabled-mods-dir", async () => {
  try {
    setNevernessDx12DisabledModsDir("");
    const paths = getNevernessDx12Paths();
    if (paths.disabledModsDir) probeWritableDirectory(paths.disabledModsDir, "异环关闭 Mod 保存目录");
    return getNevernessDx12Status();
  } catch (error) {
    return { success: false, error: error.message };
  }
});
electron.ipcMain.handle("game:list", async () => {
  ensureBuiltInGamesConfigured();
  return {
    success: true,
    games: (currentConfig.games || []).map(serializeGameForRenderer),
    activeGameId: currentConfig.activeGameId
  };
});
electron.ipcMain.handle("game:add", async (_, game) => {
  try {
    if (!game.name || !game.name.trim()) return { error: "游戏名称不能为空" };
    if (!game.modFolderPath) return { error: "Mod 文件夹路径不能为空" };
    const id = game.id || game.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const modsFolderResult = resolveSelectedModsFolder(game.modFolderPath, { gameId: id });
    if (!modsFolderResult.ok) return { error: modsFolderResult.error };
    if (!currentConfig.games) currentConfig.games = [];
    if (currentConfig.games.find((g) => g.id === id)) {
      return { error: "该游戏已存在" };
    }
    const newGame = createBuiltInGameConfig(
      {
        id,
        name: game.name.trim(),
        shortName: game.name.trim(),
        description: game.description || "",
        imageFile: game.icon || "",
        defaultLaunchMode: game.launchMode || "XXMI",
        marketGameId: game.marketGameId || id
      },
      {
        id,
        name: game.name.trim(),
        shortName: game.shortName || game.name.trim(),
        description: game.description || "",
        gamePath: game.gamePath || "",
        modLoaderPath: game.modLoaderPath || "",
        modFolderPath: modsFolderResult.path,
        launchMode: game.launchMode || "XXMI",
        launchArgs: game.launchArgs || "",
        icon: game.icon || null,
        marketGameId: game.marketGameId || id,
        isBuiltIn: !!game.isBuiltIn
      }
    );
    currentConfig.games.push(newGame);
    if (!currentConfig.activeGameId) {
      currentConfig.activeGameId = id;
    }
    saveConfig(currentConfig);
    notifyGamesChanged();
    return { success: true, game: serializeGameForRenderer(newGame) };
  } catch (error) {
    return { error: error.message };
  }
});
electron.ipcMain.handle("game:update", async (_, { gameId: gameId2, updates }) => {
  try {
    if (!currentConfig.games) return { error: "没有游戏配置" };
    const game = currentConfig.games.find((g) => g.id === gameId2);
    if (!game) return { error: "游戏不存在" };
    let resolvedModFolderPath = null;
    if (updates.modFolderPath !== void 0) {
      if (!updates.modFolderPath) {
        resolvedModFolderPath = "";
      } else {
        const modsFolderResult = resolveSelectedModsFolder(updates.modFolderPath, { gameId: gameId2 });
        if (!modsFolderResult.ok) return { error: modsFolderResult.error };
        resolvedModFolderPath = modsFolderResult.path;
      }
    }
    if (updates.name !== void 0) game.name = updates.name.trim();
    if (updates.gamePath !== void 0) game.gamePath = updates.gamePath;
    if (updates.modLoaderPath !== void 0) game.modLoaderPath = updates.modLoaderPath;
    if (updates.dx12LauncherPath !== void 0) game.dx12LauncherPath = updates.dx12LauncherPath;
    if (updates.modFolderPath !== void 0) game.modFolderPath = resolvedModFolderPath;
    if (updates.launchMode !== void 0) game.launchMode = updates.launchMode;
    if (updates.launchArgs !== void 0) game.launchArgs = updates.launchArgs;
    if (updates.icon !== void 0) game.icon = updates.icon;
    saveConfig(currentConfig);
    notifyGamesChanged();
    return { success: true, game: serializeGameForRenderer(game) };
  } catch (error) {
    return { error: error.message };
  }
});
electron.ipcMain.handle("game:delete", async (_, gameId2) => {
  try {
    if (!currentConfig.games) return { error: "没有游戏配置" };
    const idx = currentConfig.games.findIndex((g) => g.id === gameId2);
    if (idx === -1) return { error: "游戏不存在" };
    if (getBuiltInGameDefinition(currentConfig.games[idx].id)) {
      return { error: "内置游戏不可删除" };
    }
    currentConfig.games.splice(idx, 1);
    if (currentConfig.activeGameId === gameId2) {
      currentConfig.activeGameId = currentConfig.games.length > 0 ? currentConfig.games[0].id : null;
    }
    saveConfig(currentConfig);
    notifyGamesChanged();
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
});
electron.ipcMain.handle("game:switch", async (_, gameId2) => {
  try {
    if (!currentConfig.games) return { error: "没有游戏配置" };
    const game = currentConfig.games.find((g) => g.id === gameId2);
    if (!game) return { error: "游戏不存在" };
    currentConfig.activeGameId = gameId2;
    saveConfig(currentConfig);
    notifyGamesChanged();
    siteSessions.setGame(gameId2).catch(() => {});
    return { success: true, game: serializeGameForRenderer(game) };
  } catch (error) {
    return { error: error.message };
  }
});
electron.ipcMain.handle("game:select-folder", async (_, title, options = {}) => {
  try {
    const result = await electron.dialog.showOpenDialog({
      title: title || "选择文件夹",
      properties: ["openDirectory"],
      buttonLabel: "选择"
    });
    if (!result.canceled && result.filePaths.length > 0) {
      const selectedPath = result.filePaths[0];
      if (shouldResolveFolderSelectionAsMods(title, options)) {
        const resolved = resolveSelectedModsFolder(selectedPath, { gameId: options?.gameId });
        if (!resolved.ok) return { success: false, error: resolved.error, candidates: resolved.candidates || [] };
        return { success: true, ...resolved, path: resolved.path };
      }
      return { success: true, path: selectedPath };
    }
    return { success: false, canceled: true };
  } catch (error) {
    return { error: error.message };
  }
});
electron.ipcMain.handle("game:select-exe", async (_, title) => {
  try {
    const result = await electron.dialog.showOpenDialog({
      title: title || "选择程序",
      properties: ["openFile"],
      filters: [{ name: "Executables", extensions: ["exe"] }],
      buttonLabel: "选择"
    });
    if (!result.canceled && result.filePaths.length > 0) {
      return { success: true, path: result.filePaths[0] };
    }
    return { success: false, canceled: true };
  } catch (error) {
    return { error: error.message };
  }
});
electron.ipcMain.handle("select-file", async (_, options) => {
  try {
    const dialogOpts = {
      title: options?.title || "选择文件",
      properties: ["openFile"],
      buttonLabel: "选择"
    };
    if (options?.filters) {
      dialogOpts.filters = options.filters;
    }
    const result = await electron.dialog.showOpenDialog(dialogOpts);
    if (!result.canceled && result.filePaths.length > 0) {
      return { success: true, filePath: result.filePaths[0] };
    }
    return { success: false, canceled: true };
  } catch (error) {
    return { error: error.message };
  }
});
electron.ipcMain.handle("select-mods-folder", async (_, gameId) => {
  try {
    const targetGame = getSettingsGame(gameId);
    const result = await electron.dialog.showOpenDialog({
      title: "Select Mods Folder",
      properties: ["openDirectory"],
      buttonLabel: "Select"
    });
    if (!result.canceled && result.filePaths.length > 0) {
      const selectedPath = result.filePaths[0];
      const resolved = resolveSelectedModsFolder(selectedPath, { gameId: targetGame.id });
      if (resolved.ok) {
        const modsPath = resolved.path;
        updateActiveGameConfig({ modFolderPath: modsPath }, targetGame.id);
        const gameId2 = targetGame.id;
        const scanResult = scanImportCandidates(modsPath, gameId2);
        let importSummary = {
          migratedCategoryCount: 0,
          migratedModCount: 0,
          skippedConflicts: [],
          sourceRoots: []
        };
        if (scanResult.hasCandidates) {
          const movePlan = buildImportMovePlan(scanResult, modsPath, gameId2);
          const previewTargets = Array.from(
            new Set(movePlan.moves.map((move) => move.targetDisplayName))
          ).slice(0, 8);
          const previewText = previewTargets.length > 0 ? `

目标中文分类：${previewTargets.join("、")}` : "";
          const importPrompt = await electron.dialog.showMessageBox(mainWindowRef, {
            type: "question",
            title: "检测到旧目录结构",
            message: `检测到 ${movePlan.categoryCount} 个旧分类目录，准备把 ${movePlan.modCount} 个真实 Mod 文件夹迁移到对应中文分类目录。`,
            detail: `此操作只会移动分类目录里的真实 Mod 文件夹，不会删除 Mod 内容，也不会覆盖已存在的同名目录。${previewText}`,
            buttons: ["确认迁移", "暂不处理"],
            defaultId: 0,
            cancelId: 1,
            noLink: true
          });
          if (importPrompt.response === 0) {
            importSummary = executeImportMovePlan(movePlan);
            ensureDefaultCharacterFolders(modsPath, gameId2);
          } else {
            importSummary = {
              ...importSummary,
              sourceRoots: scanResult.sourceRoots,
              deferred: true
            };
          }
        } else {
          ensureDefaultCharacterFolders(modsPath, gameId2);
        }
        return { success: true, ...resolved, path: modsPath, importSummary };
      }
      return { success: false, error: resolved.error, candidates: resolved.candidates || [] };
    }
    return { success: false, canceled: true };
  } catch (error) {
    return { error: error.message };
  }
});
electron.ipcMain.handle("legacy-import:scan", async () => {
  try {
    const modsPathStatus = getModsPathStatus();
    if (!modsPathStatus.ok) {
      return { success: false, error: modsPathStatus.error, code: modsPathStatus.code };
    }
    const { modsPath } = modsPathStatus;
    const gameId2 = getActiveGameScopeId();
    return {
      success: true,
      modsPath,
      preview: previewOrganization(modsPath, gameId2)
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
electron.ipcMain.handle("legacy-import:migrate", async (_, options) => {
  try {
    const modsPathStatus = getModsPathStatus();
    if (!modsPathStatus.ok) {
      return { success: false, error: modsPathStatus.error, code: modsPathStatus.code };
    }
    const { modsPath } = modsPathStatus;
    const gameId2 = getActiveGameScopeId();
    const scanResult = scanImportCandidates(modsPath, gameId2);
    const token = organizationToken(scanResult, modsPath, gameId2);
    if (!options?.token || options.token !== organizationTokens.get(gameId2) || options.token !== token) {
      return { success: false, error: "目录或游戏已变化，请重新点击整理并确认扫描结果。" };
    }
    organizationTokens.delete(gameId2);
    if (!scanResult.hasCandidates) {
      return {
        success: true,
        summary: {
          migratedCategoryCount: 0,
          migratedModCount: 0,
          skippedConflicts: [],
          sourceRoots: []
        },
        preview: buildImportPreview(scanResult, modsPath)
      };
    }
    const summary = executeImportMovePlan(buildImportMovePlan(scanResult, modsPath, gameId2));
    CHARACTER_DIRECTORY_STATS_CACHE.clear();
    return {
      success: true,
      summary,
      preview: buildLegacyImportResponse(modsPath, gameId2)
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
electron.ipcMain.handle("mods-root:scan-loose-folders", async () => {
  try {
    const modsPathStatus = getModsPathStatus();
    if (!modsPathStatus.ok) {
      return { success: false, error: modsPathStatus.error, code: modsPathStatus.code };
    }
    return scanLooseRootModFolders(modsPathStatus.modsPath, getActiveGameScopeId());
  } catch (error) {
    return { success: false, error: error.message };
  }
});
electron.ipcMain.handle("mods-root:quarantine-loose-folders", async (_, options = {}) => {
  try {
    return quarantineLooseRootModFolders(getActiveGameScopeId(), options || {});
  } catch (error) {
    return { success: false, error: error.message };
  }
});
electron.ipcMain.handle("mods-root:move-misplaced-folders", async (_, options = {}) => {
  try {
    return moveMisplacedModFolders(getActiveGameScopeId(), options || {});
  } catch (error) {
    return { success: false, error: error.message };
  }
});
electron.ipcMain.handle("select-game-path", async (_, gameId) => {
  try {
    const activeGame = getSettingsGame(gameId);
    const result = await electron.dialog.showOpenDialog({
      title: `Select Game Executable (${activeGame?.executableHint || "Game.exe"})`,
      properties: ["openFile"],
      filters: [{ name: "Executables", extensions: ["exe"] }],
      buttonLabel: "Select"
    });
    if (!result.canceled && result.filePaths.length > 0) {
      let selectedPath = result.filePaths[0];
      if (activeGame?.id === "neverness-to-everness" && isNevernessProtectedClientExecutable(selectedPath)) {
        const officialLaunchPath = resolveNevernessOfficialLaunchPath(selectedPath);
        if (!officialLaunchPath) {
          return {
            error: "已选择的是异环内部客户端程序，不能直接启动。请改选根目录 NTELauncher.exe。"
          };
        }
        selectedPath = officialLaunchPath;
      }
      updateActiveGameConfig({ gamePath: selectedPath }, activeGame.id);
      return { success: true, path: selectedPath };
    }
    return { success: false, canceled: true };
  } catch (error) {
    return { error: error.message };
  }
});
electron.ipcMain.handle("select-loader-path", async () => {
  try {
    const activeGame = getActiveGame();
    const result = await electron.dialog.showOpenDialog({
      title: `Select ${activeGame?.modLoaderLabel || "Loader"} Executable`,
      properties: ["openFile"],
      filters: [{ name: "Executables", extensions: ["exe"] }],
      buttonLabel: "Select"
    });
    if (!result.canceled && result.filePaths.length > 0) {
      const selectedPath = result.filePaths[0];
      updateActiveGameConfig({ modLoaderPath: selectedPath });
      return { success: true, path: selectedPath };
    }
    return { success: false, canceled: true };
  } catch (error) {
    return { error: error.message };
  }
});
function readRegistryValue(keyPath, valueName) {
  try {
    const { execSync } = require("child_process");
    const output = execSync(`reg query "${keyPath}" /v "${valueName}"`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"]
    });
    const match = output.match(/REG_SZ\s+(.+)/);
    return match ? match[1].trim() : null;
  } catch {
    return null;
  }
}
function buildHonkaiStarRailGamePathCandidates() {
  const candidates = [];
  const addCandidate = (candidate) => {
    const normalized = String(candidate || "").trim();
    if (normalized && !candidates.includes(normalized)) candidates.push(normalized);
  };
  const registryKeys = [
    "HKCU\\SOFTWARE\\miHoYo\\HYP\\1_1\\hkrpg_cn",
    "HKCU\\SOFTWARE\\miHoYo\\HYP\\1_1\\hkrpg_global",
    "HKCU\\SOFTWARE\\Cognosphere\\HYP\\1_1\\hkrpg_global",
    "HKCU\\SOFTWARE\\Cognosphere\\HYP\\1_1\\hkrpg_os"
  ];
  registryKeys.forEach((registryKey) => {
    const regInstall = readRegistryValue(registryKey, "GameInstallPath");
    if (regInstall) addCandidate(path.join(regInstall, "StarRail.exe"));
  });
  for (const drive of ["G", "C", "D", "E", "F"]) {
    addCandidate(`${drive}:\\miHoYo Launcher\\games\\Star Rail Game\\StarRail.exe`);
    addCandidate(`${drive}:\\miHoYo Launcher\\games\\Star Rail Games\\StarRail.exe`);
    addCandidate(`${drive}:\\miHoYo Launcher\\games\\Honkai Star Rail Game\\StarRail.exe`);
    addCandidate(`${drive}:\\miHoYo Launcher\\games\\Honkai Star Rail Games\\StarRail.exe`);
    addCandidate(`${drive}:\\HoYoPlay\\games\\Star Rail Game\\StarRail.exe`);
    addCandidate(`${drive}:\\HoYoPlay\\games\\Star Rail Games\\StarRail.exe`);
    addCandidate(`${drive}:\\HoYoPlay\\games\\Honkai Star Rail Game\\StarRail.exe`);
    addCandidate(`${drive}:\\HoYoPlay\\games\\Honkai Star Rail Games\\StarRail.exe`);
    addCandidate(`${drive}:\\Honkai Star Rail\\Games\\StarRail.exe`);
    addCandidate(`${drive}:\\Star Rail\\Games\\StarRail.exe`);
    addCandidate(`${drive}:\\Star Rail Game\\StarRail.exe`);
    addCandidate(`${drive}:\\Star Rail Games\\StarRail.exe`);
    addCandidate(`${drive}:\\Honkai Star Rail Game\\StarRail.exe`);
    addCandidate(`${drive}:\\Honkai Star Rail Games\\StarRail.exe`);
    addCandidate(`${drive}:\\崩坏星穹铁道\\StarRail.exe`);
    addCandidate(`${drive}:\\崩坏：星穹铁道\\StarRail.exe`);
  }
  addCandidate("C:\\Program Files\\HoYoPlay\\games\\Star Rail Game\\StarRail.exe");
  addCandidate("C:\\Program Files\\HoYoPlay\\games\\Star Rail Games\\StarRail.exe");
  addCandidate("C:\\Program Files\\HoYoPlay\\games\\Honkai Star Rail Game\\StarRail.exe");
  addCandidate("C:\\Program Files\\HoYoPlay\\games\\Honkai Star Rail Games\\StarRail.exe");
  addCandidate("C:\\Program Files (x86)\\HoYoPlay\\games\\Star Rail Game\\StarRail.exe");
  addCandidate("C:\\Program Files (x86)\\HoYoPlay\\games\\Star Rail Games\\StarRail.exe");
  addCandidate("C:\\Program Files (x86)\\HoYoPlay\\games\\Honkai Star Rail Game\\StarRail.exe");
  addCandidate("C:\\Program Files (x86)\\HoYoPlay\\games\\Honkai Star Rail Games\\StarRail.exe");
  return candidates;
}
function getGenshinLauncherCandidates() {
  const preferred = getGameById("genshin-impact")?.modLoaderPath;
  const candidates = [preferred, ...(currentConfig.games || []).map(game => game.modLoaderPath)].filter(
    loader => getWindowsPathLeaf(loader || "").toLowerCase() === "xxmi launcher.exe"
  );
  for (const root of [electron.app.getPath("appData"), process.env.LOCALAPPDATA].filter(Boolean)) {
    candidates.push(path.join(root, "XXMI Launcher", "Resources", "Bin", "XXMI Launcher.exe"));
  }
  for (const drive of ["C", "D", "E", "F", "G"]) {
    for (const folder of ["XXMI", "XXMI Launcher", "mod\\xxmi"]) {
      candidates.push(path.join(`${drive}:\\`, folder, "Resources", "Bin", "XXMI Launcher.exe"));
    }
  }
  const available = [...new Set(candidates)].filter(candidate => fs.existsSync(candidate));
  const score = candidate => {
    if (candidate === preferred) return 2;
    const info = readXxmiImporterPathInfo(candidate, "genshin-impact");
    return info.importerPath && isExistingDirectory(path.join(info.importerPath, "Mods")) ? 1 : 0;
  };
  return available.sort((a, b) => score(b) - score(a));
}
function buildGenshinGamePathCandidates() {
  const folders = getGenshinLauncherCandidates().map(loader => {
    const info = readXxmiImporterPathInfo(loader, "genshin-impact");
    return info.gameFolder ? path.resolve(info.xxmiRootDir, info.gameFolder) : "";
  }).filter(Boolean);
  return require("./genshin.cjs").buildGamePathCandidates(readRegistryValue, folders);
}
electron.ipcMain.handle("auto-detect-paths", async (_, gameId) => {
  try {
    const activeGame = getSettingsGame(gameId);
    const gameId2 = activeGame?.id || "endfield";
    const xxmiCandidates = [];
    for (const drive of ["C", "D", "E", "F", "G"]) {
      xxmiCandidates.push(`${drive}:\\XXMI\\Resources\\Bin\\XXMI Launcher.exe`);
      xxmiCandidates.push(`${drive}:\\mod\\xxmi\\Resources\\Bin\\XXMI Launcher.exe`);
      xxmiCandidates.push(`${drive}:\\XXMI Launcher\\Resources\\Bin\\XXMI Launcher.exe`);
    }
    const gameDetection = {
      "genshin-impact": {
        gameExeCandidates: buildGenshinGamePathCandidates(),
        loaderCandidates: getGenshinLauncherCandidates()
      },
      endfield: {
        gameExeCandidates: (() => {
          const candidates = [];
          const regPath = readRegistryValue("HKCU\\SOFTWARE\\Hypergryph\\Launcher", "InstallPath");
          if (regPath) candidates.push(path.join(regPath, "games", "Endfield Game", "Endfield.exe"));
          for (const drive of ["G", "C", "D", "E", "F"]) {
            candidates.push(`${drive}:\\Hypergryph Launcher\\games\\Endfield Game\\Endfield.exe`);
          }
          return candidates;
        })()
      },
      zzz: {
        gameExeCandidates: (() => {
          const candidates = [];
          const regInstall = readRegistryValue(
            "HKCU\\SOFTWARE\\miHoYo\\HYP\\1_1\\nap_cn",
            "GameInstallPath"
          );
          if (regInstall) candidates.push(path.join(regInstall, "ZenlessZoneZero.exe"));
          for (const drive of ["G", "C", "D", "E", "F"]) {
            candidates.push(
              `${drive}:\\miHoYo Launcher\\games\\ZenlessZoneZero Game\\ZenlessZoneZero.exe`
            );
            candidates.push(`${drive}:\\ZenlessZoneZero Game\\ZenlessZoneZero.exe`);
          }
          return candidates;
        })()
      },
      "wuthering-waves": {
        gameExeCandidates: (() => {
          const candidates = [];
          for (const drive of ["F", "G", "C", "D", "E"]) {
            candidates.push(`${drive}:\\Wuthering Waves\\Wuthering Waves Game\\Wuthering Waves.exe`);
            candidates.push(
              `${drive}:\\Kuro Games\\Wuthering Waves\\Wuthering Waves Game\\Wuthering Waves.exe`
            );
            candidates.push(
              `${drive}:\\KRInstall\\Wuthering Waves\\Wuthering Waves Game\\Wuthering Waves.exe`
            );
          }
          return candidates;
        })()
      },
      "neverness-to-everness": {
        gameExeCandidates: buildNevernessGamePathCandidates(),
        loaderCandidates: (() => {
          const candidates = [];
          for (const drive of ["F", "G", "C", "D", "E"]) {
            candidates.push(`${drive}:\\NEMI\\Start.cmd`);
            candidates.push(`${drive}:\\NEMI-main\\Start.cmd`);
            candidates.push(`${drive}:\\mod\\yihuan\\NEMI-main\\Start.cmd`);
            candidates.push(`${drive}:\\mod\\NEMI\\Start.cmd`);
          }
          return candidates;
        })()
      },
      "honkai-star-rail": {
        gameExeCandidates: buildHonkaiStarRailGamePathCandidates()
      }
    };
    const detection = gameDetection[gameId2];
    if (!detection) {
      return {
        success: true,
        config: buildRendererConfig(),
        message: `暂未为「${activeGame?.name || gameId2}」提供自动检测，请手动配置路径。`
      };
    }
    let updatedFields = [];
    if (!activeGame?.gamePath || !fs.existsSync(activeGame.gamePath) || gameId2 === "neverness-to-everness" && isNevernessProtectedClientExecutable(activeGame.gamePath)) {
      for (const p of detection.gameExeCandidates) {
        if (p && fs.existsSync(p)) {
          const detectedGamePath = gameId2 === "neverness-to-everness" ? resolveNevernessDetectedGamePath(p) : p;
          if (!detectedGamePath) continue;
          updateActiveGameConfig({ gamePath: detectedGamePath }, activeGame.id);
          updatedFields.push("游戏路径");
          break;
        }
      }
    }
    if (!activeGame?.modLoaderPath || !fs.existsSync(activeGame.modLoaderPath)) {
      const loaderCandidates = detection.loaderCandidates || xxmiCandidates;
      for (const p of loaderCandidates) {
        if (p && fs.existsSync(p)) {
          updateActiveGameConfig({ modLoaderPath: p }, activeGame.id);
          updatedFields.push("加载器路径");
          break;
        }
      }
    }
    if (gameId2 === "genshin-impact" && (!activeGame.modFolderPath || !isExistingDirectory(activeGame.modFolderPath))) {
      const info = readXxmiImporterPathInfo(activeGame.modLoaderPath, gameId2);
      const root = resolveXxmiRootFromLauncherPath(activeGame.modLoaderPath);
      const importerPath = info.importerPath || (root ? path.join(root, "GIMI") : "");
      const modsPath = importerPath ? path.join(importerPath, "Mods") : "";
      if (activeGame.modLoaderPath && isExistingDirectory(modsPath)) {
        updateActiveGameConfig({ modFolderPath: modsPath }, activeGame.id);
        ensureDefaultCharacterFolders(modsPath, gameId2);
        updatedFields.push("Mods 路径");
      }
    }
    const message = updatedFields.length > 0 ? `已自动检测到：${updatedFields.join("、")}` : "未检测到新路径，请手动选择。";
    return {
      success: true,
      config: buildRendererConfig(),
      message
    };
  } catch (error) {
    return { error: error.message };
  }
});
electron.ipcMain.handle("select-efmi-path", async () => {
  try {
    const result = await electron.dialog.showOpenDialog({
      title: "Select EFMI Quick Start.exe",
      properties: ["openFile"],
      filters: [{ name: "Executables", extensions: ["exe"] }],
      buttonLabel: "Select"
    });
    if (!result.canceled && result.filePaths.length > 0) {
      const selectedPath = result.filePaths[0];
      updateActiveGameConfig({ modLoaderPath: selectedPath });
      return { success: true, path: selectedPath };
    }
    return { success: false, canceled: true };
  } catch (error) {
    return { error: error.message };
  }
});
electron.ipcMain.handle("select-xxmi-path", async (_, gameId) => {
  try {
    const activeGame = getSettingsGame(gameId);
    const isNevernessToEverness = activeGame?.id === "neverness-to-everness";
    const result = await electron.dialog.showOpenDialog({
      title: isNevernessToEverness ? "Select NEMI Start.cmd or 3DMigoto Loader.exe" : "Select XXMI Launcher.exe",
      properties: ["openFile"],
      filters: isNevernessToEverness ? [{ name: "NEMI Loader", extensions: ["cmd", "bat", "exe"] }] : [{ name: "Executables", extensions: ["exe"] }],
      buttonLabel: "Select"
    });
    if (!result.canceled && result.filePaths.length > 0) {
      const selectedPath = result.filePaths[0];
      updateActiveGameConfig({ modLoaderPath: selectedPath }, activeGame.id);
      return { success: true, path: selectedPath };
    }
    return { success: false, canceled: true };
  } catch (error) {
    return { error: error.message };
  }
});
let gameLaunchInProgress = false;
electron.ipcMain.handle("launch-game", async (_, { launchMode, gameId } = {}) => {
  if (gameLaunchInProgress) return { success: false, error: "正在启动，请稍候。" };
  gameLaunchInProgress = true;
  let genshinPreparation = null, genshinLaunched = false;
  try {
    const activeGame = getActiveGame();
    const { gamePath, modLoaderPath } = getResolvedActiveGamePaths();
    if (gameId && gameId !== activeGame?.id) return { success: false, error: "当前游戏已切换，请重新点击启动。" };
    const resolvedLaunchMode = launchMode === "DIRECT" ? getDirectLaunchMode(activeGame) : launchMode === void 0 ? activeGame?.launchMode || "VANILLA" : launchMode || "VANILLA";
    if (!resolvedLaunchMode) return { success: false, error: "当前游戏尚未支持快捷启动，请使用 XXMI 启动。" };
    if (activeGame?.id === "genshin-impact" && resolvedLaunchMode === "GIMI" && activeGame.genshinPreflightEnabled === true) {
      const report = genshinDiagnostics.check({ includeLogs: false });
      if (report.summary.errors) return { success: false, error: `原神启动前检查未通过：${report.checks.filter(item => item.level === "error").slice(0, 3).map(item => item.title).join("、")}。请到游戏设置 → 兼容检查查看详情。` };
    }
    let genshinLaunchNotice = "";
    if (activeGame?.id === "genshin-impact" && resolvedLaunchMode === "GIMI") {
      const prepared = await genshinAntiCrash.prepareLaunch(activeGame.genshinAntiError, { randomLauncher: getRandomLaunchSettings(currentConfig).xxmi });
      if (prepared.prepared) {
        genshinPreparation = prepared;
        genshinLaunchNotice = prepared.notice || "";
      }
    }
    const customLaunchArgs = String(activeGame?.launchArgs || "").trim();
    if (resolvedLaunchMode !== "DX12") await ensureKeypressBridgeForActiveGame();
    if (resolvedLaunchMode === "VANILLA") {
      if (!gamePath || !fs.existsSync(gamePath)) {
        return { error: "Game path not set or invalid." };
      }
      let vanillaGamePath = gamePath;
      if (activeGame?.id === "neverness-to-everness") {
        vanillaGamePath = normalizeNevernessLaunchPath(gamePath);
        if (vanillaGamePath !== gamePath) updateActiveGameConfig({ gamePath: vanillaGamePath });
        if (isNevernessProtectedClientExecutable(vanillaGamePath)) {
          return {
            error: "当前选择的是异环内部客户端程序，不能直接启动。请将异环游戏路径改为根目录 NTELauncher.exe。"
          };
        }
      }
      logger.info("Launching Game (Vanilla):", vanillaGamePath);
      launchWindowsExecutableViaStart(vanillaGamePath);
      return { success: true };
    }
    if ([...BUNDLED_GAME_IMPORTERS, "XXMI"].includes(resolvedLaunchMode)) {
      if (resolvedLaunchMode !== "XXMI" && getDirectLaunchMode(activeGame) !== resolvedLaunchMode) {
        return { success: false, error: `当前游戏「${activeGame?.name || "未知"}」不支持 ${resolvedLaunchMode} 快捷启动。` };
      }
      if (resolvedLaunchMode === "XXMI" && activeGame?.id === "neverness-to-everness") {
        return { success: false, error: "异环使用 NEMI / Pak 加载器，请使用直接启动。" };
      }
      if (!modLoaderPath || !fs.existsSync(modLoaderPath)) {
        return { success: false, error: buildMissingXxmiLauncherLaunchError(resolvedLaunchMode, modLoaderPath) };
      }
      const args = resolvedLaunchMode === "XXMI" ? [] : ["--nogui", "--xxmi", resolvedLaunchMode];
      args.push(...parseLaunchArgs(customLaunchArgs));
      logger.info("Launching Mod loader:", modLoaderPath, resolvedLaunchMode);
      const launchResult = await (genshinPreparation?.launcherPath
        ? launchElevated(genshinPreparation.launcherPath, path.dirname(modLoaderPath), args)
        : getRandomLaunchSettings(currentConfig).xxmi
        ? launchRandomExecutable(modLoaderPath, path.dirname(modLoaderPath), args, launchElevated)
        : launchElevated(modLoaderPath, path.dirname(modLoaderPath), args));
      if (launchResult?.success && genshinPreparation) {
        genshinLaunched = true;
        genshinAntiCrash.watchGameExit(genshinPreparation);
      }
      return launchResult?.success && genshinLaunchNotice ? { ...launchResult, notice: genshinLaunchNotice } : launchResult;
    }
    if (resolvedLaunchMode === "DX12") {
      if (activeGame?.id && activeGame.id !== "neverness-to-everness") {
        return { error: "当前游戏不支持 Pak 启动模式。" };
      }
      return await launchNevernessDx12Loader();
    }
    if (resolvedLaunchMode === "NEMI") {
      if (activeGame?.id && activeGame.id !== "neverness-to-everness") {
        return { error: `当前游戏「${activeGame.name}」不支持 NEMI 启动模式。` };
      }
      if (!modLoaderPath || !fs.existsSync(modLoaderPath)) {
        return { error: "NEMI 路径未设置，请在设置中选择 NEMI 的 Start.cmd 或 3DMigoto Loader.exe" };
      }
      let launchGamePath = normalizeNevernessLaunchPath(gamePath);
      if (launchGamePath !== gamePath) updateActiveGameConfig({ gamePath: launchGamePath });
      if (isNevernessInnerGameExecutable(launchGamePath)) {
        const officialLaunchPath = resolveNevernessOfficialLaunchPath(launchGamePath);
        if (officialLaunchPath) {
          launchGamePath = officialLaunchPath;
          updateActiveGameConfig({ gamePath: officialLaunchPath });
        }
      }
      if (!launchGamePath || !fs.existsSync(launchGamePath)) {
        return { error: "异环官方启动入口未设置，请在设置中选择根目录 NTELauncher.exe" };
      }
      if (isNevernessProtectedClientExecutable(launchGamePath)) {
        return {
          error: "当前选择的是异环内部客户端程序，不能直接启动。请将异环游戏路径改为根目录 NTELauncher.exe。"
        };
      }
      let loaderExe = modLoaderPath;
      const loaderExt = path.extname(modLoaderPath).toLowerCase();
      if (loaderExt === ".cmd" || loaderExt === ".bat") {
        const sibling = path.join(path.dirname(modLoaderPath), "3DMigoto Loader.exe");
        if (!fs.existsSync(sibling)) {
          return {
            error: `未在 NEMI 目录找到 3DMigoto Loader.exe（应与 ${path.basename(modLoaderPath)} 同目录）。`
          };
        }
        loaderExe = sibling;
      }
      const loaderDir = path.dirname(loaderExe);
      logger.info("[NEMI] Loader exe resolved:", loaderExe);
      const loaderAlreadyRunning = await isWindowsProcessRunning("3DMigoto Loader.exe");
      if (!loaderAlreadyRunning) {
        logger.info("[NEMI] Starting Loader with existing administrator privileges when available");
        const elevateResult = await launchElevated(loaderExe, loaderDir, []);
        if (!elevateResult.success) {
          return {
            error: `请求管理员权限启动 NEMI Loader 失败：${elevateResult.error || "用户取消或被拦截"}`
          };
        }
      } else {
        logger.info("[NEMI] Loader already running, skipping launch");
      }
      const loaderReady = await waitForWindowsProcess("3DMigoto Loader.exe", 6e4, 500);
      if (!loaderReady) {
        return { error: "NEMI Loader 未在 60 秒内启动。请确认已同意 UAC 弹窗后重试。" };
      }
      logger.info("[NEMI] Loader ready, launching game:", launchGamePath);
      const gameArgs = getNevernessOfficialLaunchArgs(launchGamePath, customLaunchArgs);
      launchWindowsExecutableViaStart(launchGamePath, gameArgs);
      setImmediate(async () => {
        try {
          const gameStarted = await waitForWindowsProcess("HTGame.exe", 5 * 60 * 1e3, 1e3);
          if (gameStarted) {
            logger.info("[NEMI] HTGame.exe detected — DLL injection should occur shortly");
          } else {
            logger.warn(
              "[NEMI] HTGame.exe not detected within 5 minutes — user may not have started the game in NTELauncher"
            );
          }
        } catch (e) {
          logger.error("[NEMI] HTGame monitor error:", e);
        }
      });
      return { success: true };
    }
    return { error: "Unknown launch mode" };
  } catch (error) {
    logger.error("Launch error:", error);
    return { success: false, error: error.message };
  } finally {
    if (genshinPreparation && !genshinLaunched) {
      try {
        const result = await genshinAntiCrash.cleanup({ force: false });
        if (!result.cleaned) logger.warn("[Genshin] Launch failed; recovery remains pending:", result.notes);
      } catch (error) { logger.warn("[Genshin] Launch failure cleanup failed:", error.message); }
    }
    gameLaunchInProgress = false;
  }
});
electron.ipcMain.handle("open-path-in-explorer", async (_, targetPath) => {
  try {
    if (!targetPath) return { error: "路径为空" };
    if (fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) {
      electron.shell.showItemInFolder(targetPath);
    } else if (fs.existsSync(targetPath)) {
      const openError = await electron.shell.openPath(targetPath);
      if (openError) return { error: openError };
    } else {
      return { error: "路径不存在: " + targetPath };
    }
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
});
electron.ipcMain.handle("open-external-url", async (_, url) => {
  try {
    await electron.shell.openExternal(url);
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
});
electron.ipcMain.handle("open-character-folder", async (_, characterName) => {
  try {
    const gameId2 = getActiveGameScopeId();
    const charPath = isNevernessDx12Mode(gameId2) ? getNevernessDx12CharacterPath(characterName, { ensure: true }) : resolveCharacterPath(characterName, gameId2);
    if (charPath && fs.existsSync(charPath)) {
      const openError = await electron.shell.openPath(charPath);
      if (openError) {
        return { error: openError };
      }
      trackCharacterUsage(characterName, gameId2);
      return { success: true };
    }
    return { error: "Folder not found" };
  } catch (error) {
    return { error: error.message };
  }
});
electron.ipcMain.handle("open-mod-folder", async (_, { characterName, modName }) => {
  try {
    const gameId2 = getActiveGameScopeId();
    if (isNevernessDx12Mode(gameId2)) {
      const charPath2 = getNevernessDx12CharacterPath(characterName, { ensure: true });
      if (!charPath2) return { error: "Character folder not found" };
      const paths = getNevernessDx12Paths();
      const disabledCharPath = getNevernessDx12DisabledCharacterPath(characterName, paths);
      const candidates = [
        path.join(charPath2, modName),
        path.join(charPath2, `DISABLED_${modName}`),
        disabledCharPath ? path.join(disabledCharPath, modName) : "",
        disabledCharPath ? path.join(disabledCharPath, `DISABLED_${modName}`) : ""
      ].filter(Boolean);
      const modPath2 = candidates.find((candidate) => fs.existsSync(candidate));
      if (!modPath2) return { error: "Mod folder not found" };
      const openError = await electron.shell.openPath(modPath2);
      if (openError) return { error: openError };
      trackCharacterUsage(characterName, gameId2);
      return { success: true };
    }
    organizeLegacyCharacterFoldersIfNeeded(gameId2);
    const charPath = resolveCharacterPath(characterName, gameId2);
    if (!charPath) {
      return { error: "Folder not found" };
    }
    trackCharacterUsage(characterName, gameId2);
    let modPath = path.join(charPath, modName);
    if (!fs.existsSync(modPath)) {
      const disabledPath = path.join(charPath, `DISABLED_${modName}`);
      if (fs.existsSync(disabledPath)) {
        modPath = disabledPath;
      }
    }
    if (fs.existsSync(modPath)) {
      const openError = await electron.shell.openPath(modPath);
      if (openError) {
        return { error: openError };
      }
      return { success: true };
    }
    return { error: "Folder not found" };
  } catch (error) {
    return { error: error.message };
  }
});
function readCharacterDirectoryStatus(gameId2) {
  if (!isNevernessDx12Mode(gameId2)) return getModsPathStatus();
  const modsPath = getNevernessDx12Paths(gameId2).pakModsDir;
  if (!modsPath) return { ok: false, code: "MODS_PATH_NOT_SET", error: "尚未设置异环游戏目录" };
  // An absent Pak directory is an empty list, not a reason to create folders.
  return { ok: true, modsPath };
}
async function readCurrentCharacters() {
  try {
    const gameId2 = getActiveGameScopeId();
    const status = readCharacterDirectoryStatus(gameId2);
    if (!status.ok) return { success: false, error: status.error, code: status.code };
    return { success: true, ...buildCharacterRefreshResponse(status.modsPath, gameId2) };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
electron.ipcMain.handle("character:refresh", async () => {
  invalidateHotkeysForGame();
  return readCurrentCharacters();
});
function buildCharacterDisablePlan(characterName, gameId) {
  const canonical = getCharacterMappingEntry(characterName, gameId)?.displayName || characterName;
  const aliases = new Set(getCharacterAliasCandidates(canonical, gameId).map(normalizeCharacterFolderKey));
  const plan = [];
  const seen = new Set();
  const scanRoot = (root, pakPaths = null) => {
    if (!root || !fs.existsSync(root)) return;
    if (fs.lstatSync(root).isSymbolicLink()) throw new Error(`请先处理链接目录：${root}`);
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!aliases.has(normalizeCharacterFolderKey(entry.name))) continue;
      if (entry.isSymbolicLink()) throw new Error(`请先处理链接目录：${entry.name}`);
      if (!entry.isDirectory()) continue;
      const charPath = path.join(root, entry.name);
      for (const mod of fs.readdirSync(charPath, { withFileTypes: true })) {
        if (!pakPaths && /^DISABLED_/i.test(mod.name)) continue;
        if (mod.isSymbolicLink()) throw new Error(`请先处理链接 Mod：${mod.name}`);
        if (!mod.isDirectory()) continue;
        const from = path.join(charPath, mod.name);
        if (pakPaths && !getNevernessDx12ModDirectoryInfo(from, pakPaths)) continue;
        const key = path.resolve(from).toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        const to = pakPaths ? path.join(getNevernessDx12DisabledCharacterPath(canonical, pakPaths, { gameId }), mod.name.replace(/^DISABLED_/i, "")) : path.join(charPath, `DISABLED_${mod.name}`);
        plan.push({ from, to, pak: !!pakPaths });
      }
    }
  };
  const modsPath = getModsPath(gameId);
  const pakPaths = gameId === NEVERNESS_GAME_ID ? getNevernessDx12Paths(gameId) : null;
  const pakRoots = new Set(Object.values(pakPaths?.pakModsDirs || {}).filter(Boolean).map(root => path.resolve(root).toLowerCase()));
  if (modsPath && !pakRoots.has(path.resolve(modsPath).toLowerCase())) {
    scanRoot(modsPath);
    for (const container of LEGACY_CHARACTER_CONTAINER_NAMES) scanRoot(path.join(modsPath, container));
  }
  if (pakPaths) for (const root of Object.values(pakPaths.pakModsDirs)) scanRoot(root, pakPaths);
  return plan;
}
electron.ipcMain.handle("character:context-menu", require("./character-context-menu.cjs").showCharacterContextMenu);
electron.ipcMain.handle("character:list-hidden", async (_, requestedGameId) => {
  try {
    const gameId = getSettingsGame(requestedGameId)?.id;
    if (!gameId) throw new Error("游戏不存在");
    return { success: true, gameId, characters: hiddenCharacters.list(gameId).map(name => ({ name, coverUrl: getCharacterCoverUrl(name, gameId) })) };
  } catch (error) { return { success: false, error: error.message }; }
});
electron.ipcMain.handle("character:set-hidden", async (_, { characterName, hidden, gameId: requestedGameId } = {}) => {
  try {
    const gameId = getSettingsGame(requestedGameId)?.id;
    if (!gameId) throw new Error("游戏不存在");
    if (typeof hidden !== "boolean") throw new Error("隐藏状态无效");
    characterName = assertSafeAppearancePathSegment(characterName, "角色名称");
    characterName = getCharacterMappingEntry(characterName, gameId)?.displayName || characterName;
    const plan = hidden ? buildCharacterDisablePlan(characterName, gameId) : [];
    const stateFiles = [];
    if (isPersistBridgeEnabled(gameId)) for (const item of plan.filter(item => !item.pak)) {
      if (dirUsesManagedPersistBridge(item.from)) syncPersistBridgeStateForModDir(item.from, gameId);
      stateFiles.push(...collectHostedPersistStateFilesForModDir(item.from));
    }
    const disabledCount = applyDisablePlan(plan, () => hiddenCharacters.set(gameId, characterName, hidden), moveDirectoryWithFallback);
    if (stateFiles.length) {
      const env = resolveActiveGameEnvRoot(gameId);
      if (env?.root) updateActivePersistBridgeIncludesIncremental(env.root, { disableStateFiles: stateFiles });
    }
    clearConflictCache(characterName, gameId);
    notifyCharacterListChanged(characterName, { gameId, reason: hidden ? "character-hidden" : "character-restored" });
    if (hidden && gameId === getActiveGameScopeId()) hideSideWindow();
    return { success: true, gameId, hidden, disabledCount };
  } catch (error) { return { success: false, error: error.message }; }
});
electron.ipcMain.handle("get-characters", readCurrentCharacters);
electron.ipcMain.handle("character:update-catalog", async (_, requestedGameId) => {
  const gameId = requestedGameId || getActiveGameScopeId();
  invalidateHotkeysForGame(gameId);
  const result = await characterCatalogService.refresh(gameId, true);
  const skins = await characterSkinCatalogService.refresh(gameId, readBundledCharacterSkinCatalog(gameId), getCharacterConfigForGame(gameId));
  const messages = [];
  if (result.success) messages.push("角色资料已更新");
  else messages.push(result.error);
  if (skins.success) messages.push(`外观目录已更新，新增 ${skins.added} 款，共 ${skins.count} 款`);
  else messages.push(skins.error);
  if (!result.success && !skins.success) return { success: false, gameId, error: messages.join("；"), skins };
  try {
    const modsPath = isNevernessDx12Mode(gameId) ? getNevernessDx12Paths(gameId).pakModsDir : getModsPath(gameId);
    const added = result.success && modsPath && fs.existsSync(modsPath) ? ensureDefaultCharacterFolders(modsPath, gameId).createdCount : 0;
    notifyCharacterListChanged("__all__", { gameId, reason: "character-catalog-updated" });
    return { ...result, success: true, gameId, added, skins, message: messages.join("；") };
  } catch (error) {
    return { success: false, gameId, error: `角色资料已同步，但补充空分类失败：${error.message}` };
  }
});
electron.ipcMain.handle("character:organize-preview", async () => {
  try {
    const gameId2 = getActiveGameScopeId();
    const status = readCharacterDirectoryStatus(gameId2);
    if (!status.ok) return { success: false, error: status.error, code: status.code };
    if (isNevernessDx12Mode(gameId2)) {
      return { success: true, legacyImport: { hasCandidates: false }, looseRootFolders: null, misplacedModFolders: null };
    }
    return { success: true, ...buildCharacterOrganizePreview(status.modsPath, gameId2) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
electron.ipcMain.handle("dev:list-local-mods", async (_, { characters } = {}) => {
  try {
    const modsPathStatus = getModsPathStatus();
    if (!modsPathStatus.ok) return { success: false, error: modsPathStatus.error };
    const { modsPath } = modsPathStatus;
    const charFilter = characters && characters.length > 0 ? new Set(characters) : null;
    const result = [];
    const charDirs = fs.readdirSync(modsPath, { withFileTypes: true }).filter((d) => d.isDirectory() && (!charFilter || charFilter.has(d.name)));
    for (const charDir of charDirs) {
      const charPath = path.join(modsPath, charDir.name);
      const modDirs = fs.readdirSync(charPath, { withFileTypes: true }).filter((d) => d.isDirectory());
      for (const modDir of modDirs) {
        const cleanName = modDir.name.replace(/^DISABLED_/, "");
        const idFile = path.join(charPath, modDir.name, ".qaqmod_id");
        let modId = null;
        try {
          modId = parseInt(fs.readFileSync(idFile, "utf-8").trim()) || null;
        } catch (_2) {
        }
        result.push({ char: charDir.name, modName: cleanName, folderName: modDir.name, modId });
      }
    }
    return { success: true, mods: result };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
electron.ipcMain.handle("get-default-characters", async (_, { gameId: gameId2 } = {}) => {
  try {
    const targetGameId = gameId2 || getActiveGameScopeId();
    const characters = getDefaultCharactersForGame(targetGameId);
    const characterDetails = characters.map((name) => ({
      name,
      coverUrl: getCharacterCoverUrl(name, targetGameId),
      aliases: getCharacterAliasCandidates(name, targetGameId).filter((alias) => alias && alias !== name)
    }));
    return { success: true, characters, characterDetails };
  } catch (error) {
    return { error: error.message };
  }
});
electron.ipcMain.handle("save-character-order", async (_, characterOrder) => {
  try {
    setScopedCharacterOrder(characterOrder);
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
});
electron.ipcMain.handle("save-mod-order", async (_, { characterName, modOrder }) => {
  try {
    if (!currentConfig.modOrders) {
      currentConfig.modOrders = {};
    }
    const canonicalCharacterName = getCanonicalCharacterConfigKey(characterName);
    currentConfig.modOrders[canonicalCharacterName] = modOrder;
    saveConfig(currentConfig);
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
});
function normalizePinnedModNames(value, availableNames = null) {
  const list = Array.isArray(value) ? value : [];
  const seen = /* @__PURE__ */ new Set();
  const availableSet = Array.isArray(availableNames) ? new Set(availableNames) : null;
  const normalized = [];
  for (const item of list) {
    const name = String(item || "").trim();
    if (!name || seen.has(name)) continue;
    if (availableSet && !availableSet.has(name)) continue;
    seen.add(name);
    normalized.push(name);
  }
  return normalized;
}
function getPinnedModsForCharacter(characterName, availableNames = null) {
  if (!currentConfig.pinnedMods) currentConfig.pinnedMods = {};
  const { key, value } = getCharacterConfigStoreValue(currentConfig.pinnedMods, characterName, []);
  const normalized = normalizePinnedModNames(value, availableNames);
  const existing = Array.isArray(value) ? value : [];
  if (existing.length !== normalized.length || existing.some((name, index) => name !== normalized[index])) {
    if (normalized.length > 0) {
      currentConfig.pinnedMods[key] = normalized;
    } else {
      delete currentConfig.pinnedMods[key];
    }
    saveConfig(currentConfig);
  }
  return normalized;
}
function setPinnedModsForCharacter(characterName, pinnedMods) {
  const normalized = normalizePinnedModNames(pinnedMods);
  if (!currentConfig.pinnedMods) currentConfig.pinnedMods = {};
  const { key, value } = getCharacterConfigStoreValue(currentConfig.pinnedMods, characterName, []);
  const existing = Array.isArray(value) ? value : [];
  const changed = existing.length !== normalized.length || existing.some((name, index) => name !== normalized[index]);
  if (!changed) return normalized;
  if (normalized.length > 0) {
    currentConfig.pinnedMods[key] = normalized;
  } else {
    delete currentConfig.pinnedMods[key];
  }
  saveConfig(currentConfig);
  return normalized;
}
function applyPinnedStateToMods(characterName, mods) {
  const pinnedNames = getPinnedModsForCharacter(
    characterName,
    mods.map((mod) => mod.name)
  );
  const pinnedIndexMap = new Map(pinnedNames.map((name, index) => [name, index]));
  return mods.map((mod) => ({
    ...mod,
    pinned: pinnedIndexMap.has(mod.name),
    pinnedIndex: pinnedIndexMap.has(mod.name) ? pinnedIndexMap.get(mod.name) : -1
  }));
}
function movePinnedModsToTop(mods) {
  const pinned = [];
  const normal = [];
  for (const mod of mods) {
    if (mod.pinned) pinned.push(mod);
    else normal.push(mod);
  }
  pinned.sort((a, b) => {
    const indexDiff = (a.pinnedIndex ?? Number.MAX_SAFE_INTEGER) - (b.pinnedIndex ?? Number.MAX_SAFE_INTEGER);
    if (indexDiff !== 0) return indexDiff;
    return a.name.localeCompare(b.name, "zh-CN");
  });
  return [...pinned, ...normal];
}
function getMarkedModsForGame(gameId2 = getActiveGameScopeId()) {
  return currentConfig.markedMods?.[gameId2] || {};
}
function isModMarked(gameId2, characterName, modName) {
  const markedForCharacter = currentConfig.markedMods?.[gameId2]?.[characterName];
  if (!markedForCharacter) return false;
  if (markedForCharacter[modName]) return true;
  return Object.entries(markedForCharacter).some(([key, value]) => {
    const item = value && typeof value === "object" ? value : {};
    return key === modName || item.name === modName || item.originalName === modName;
  });
}
function setMarkedModForConfig(gameId2, characterName, modName, payload = {}) {
  if (!currentConfig.markedMods) currentConfig.markedMods = {};
  if (!currentConfig.markedMods[gameId2]) currentConfig.markedMods[gameId2] = {};
  if (!currentConfig.markedMods[gameId2][characterName])
    currentConfig.markedMods[gameId2][characterName] = {};
  currentConfig.markedMods[gameId2][characterName][modName] = payload;
  saveConfig(currentConfig);
}
function deleteMarkedModFromConfig(gameId2, characterName, modName) {
  if (!currentConfig.markedMods?.[gameId2]?.[characterName]) return;
  for (const [key, value] of Object.entries(currentConfig.markedMods[gameId2][characterName])) {
    const item = value && typeof value === "object" ? value : {};
    if (key === modName || item.name === modName || item.originalName === modName) {
      delete currentConfig.markedMods[gameId2][characterName][key];
    }
  }
  if (Object.keys(currentConfig.markedMods[gameId2][characterName]).length === 0) {
    delete currentConfig.markedMods[gameId2][characterName];
  }
  if (Object.keys(currentConfig.markedMods[gameId2]).length === 0) {
    delete currentConfig.markedMods[gameId2];
  }
  saveConfig(currentConfig);
}
function normalizeModTags(tags) {
  return Array.isArray(tags) ? tags.map((tag) => typeof tag === "string" ? tag : tag && tag.name ? String(tag.name) : "").filter(Boolean) : [];
}
function readModTagsFromDir(modDir) {
  try {
    const tagsFile = path.join(modDir, "tags.json");
    if (!fs.existsSync(tagsFile)) return [];
    const data = JSON.parse(fs.readFileSync(tagsFile, "utf-8")) || {};
    return normalizeModTags(data.tags);
  } catch (_) {
    return [];
  }
}
function writeModTagsToDir(modDir, tags) {
  const tagsFile = path.join(modDir, "tags.json");
  let existing = {};
  if (fs.existsSync(tagsFile)) {
    try {
      existing = JSON.parse(fs.readFileSync(tagsFile, "utf-8")) || {};
    } catch (_) {
      existing = {};
    }
  }
  const payload = { ...existing, tags: normalizeModTags(tags) };
  fs.writeFileSync(tagsFile, JSON.stringify(payload, null, 2), "utf-8");
  return payload.tags;
}
function readModMetadataFromDir(modDir) {
  try {
    const tagsFile = path.join(modDir, "tags.json");
    if (!fs.existsSync(tagsFile)) return {};
    const parsed = JSON.parse(fs.readFileSync(tagsFile, "utf-8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (_) {
    return {};
  }
}
function getStoredModAppearanceSectionId(meta) {
  return normalizeAppearanceSectionId(
    meta?.qaqm?.appearanceSectionId || meta?.appearanceSectionId || ""
  );
}
function extractRequestedAppearanceTarget(payload = {}) {
  const sectionId = normalizeAppearanceSectionId(
    payload?.appearanceSectionId || payload?.sectionId || payload?.targetSectionId || payload?.qaqm?.appearanceSectionId || ""
  );
  const skinId = String(
    payload?.characterSkinId || payload?.skinId || payload?.outfitId || payload?.characterSkin?.id || ""
  ).trim();
  return { sectionId, skinId };
}
function normalizeAppearanceMatchText(value) {
  return String(value || "").normalize("NFKC").trim().toLowerCase().replace(/[\s_\-－–—·•.'"`()\[\]{}【】（）<>《》:：|\\/]+/g, "");
}
function isUsefulAppearanceAlias(value) {
  const compact = normalizeAppearanceMatchText(value);
  if (!compact) return false;
  if (containsChineseCharacter(value)) return compact.length >= 2;
  return compact.length >= 4;
}
function inferOfficialAppearanceSectionId(characterName, candidateValues, gameId2 = getActiveGameScopeId()) {
  const haystacks = (Array.isArray(candidateValues) ? candidateValues : [candidateValues]).map(normalizeAppearanceMatchText).filter(Boolean);
  if (haystacks.length === 0) return BASE_APPEARANCE_SECTION_ID;
  const matchedSectionIds = /* @__PURE__ */ new Set();
  for (const section of getOfficialAppearanceSections(characterName, gameId2)) {
    const aliases = [section.nameZh, section.nameEn, ...section.aliases || []].filter(isUsefulAppearanceAlias).map(normalizeAppearanceMatchText).filter(Boolean);
    if (aliases.some(
      (alias) => haystacks.some((candidate) => candidate === alias || candidate.includes(alias))
    )) {
      matchedSectionIds.add(section.sectionId);
    }
  }
  return matchedSectionIds.size === 1 ? Array.from(matchedSectionIds)[0] : BASE_APPEARANCE_SECTION_ID;
}
function resolveRequestedAppearanceSectionId(characterName, payload = {}, gameId2 = getActiveGameScopeId()) {
  const target = extractRequestedAppearanceTarget(payload);
  if (target.sectionId) {
    const direct = getAppearanceSectionDefinition(characterName, target.sectionId, gameId2);
    if (direct) return direct.sectionId;
    const sectionSkinId = target.sectionId.startsWith("skin:") ? target.sectionId.slice("skin:".length) : target.sectionId;
    const mapped = getAppearanceSectionIdForSkinId(characterName, sectionSkinId, gameId2);
    return mapped || BASE_APPEARANCE_SECTION_ID;
  }
  if (target.skinId) {
    return getAppearanceSectionIdForSkinId(characterName, target.skinId, gameId2) || BASE_APPEARANCE_SECTION_ID;
  }
  return null;
}
function resolveModAppearanceSectionId({
  characterName,
  modName,
  modDir,
  meta = null,
  requested = null,
  gameId: gameId2 = getActiveGameScopeId(),
  ignoreStored = false
}) {
  const explicitSectionId = requested ? resolveRequestedAppearanceSectionId(characterName, requested, gameId2) : null;
  if (explicitSectionId) return explicitSectionId;
  const resolvedMeta = meta || readModMetadataFromDir(modDir);
  if (!ignoreStored) {
    const storedSectionId = getStoredModAppearanceSectionId(resolvedMeta);
    const classificationSource = String(
      resolvedMeta?.qaqm?.classificationSource || resolvedMeta?.classificationSource || ""
    ).trim();
    if (storedSectionId) {
      const storedDefinition = getAppearanceSectionDefinition(
        characterName,
        storedSectionId,
        gameId2
      );
      const shouldReinferFallback = storedSectionId === BASE_APPEARANCE_SECTION_ID && classificationSource === "base-fallback";
      if (storedDefinition && !shouldReinferFallback) return storedDefinition.sectionId;
    }
    const storedSkinId = String(
      resolvedMeta?.qaqm?.characterSkinId || resolvedMeta?.characterSkinId || ""
    ).trim();
    if (storedSkinId) {
      const storedSkinSectionId = getAppearanceSectionIdForSkinId(
        characterName,
        storedSkinId,
        gameId2
      );
      if (storedSkinSectionId) return storedSkinSectionId;
    }
  }
  const tags = Array.isArray(resolvedMeta?.tags) ? resolvedMeta.tags.map((tag) => typeof tag === "string" ? tag : tag?.name || "").filter(Boolean) : [];
  return inferOfficialAppearanceSectionId(characterName, [modName, ...tags], gameId2);
}
function writeModAppearanceSectionMetadata(modDir, characterName, sectionId, { gameId: gameId2 = getActiveGameScopeId(), source = "user" } = {}) {
  if (!modDir || !fs.existsSync(modDir)) throw new Error("Mod folder not found");
  const resolvedSectionId = resolveKnownAppearanceSectionId(characterName, sectionId, gameId2);
  const definition = getAppearanceSectionDefinition(characterName, resolvedSectionId, gameId2);
  const tagsFile = path.join(modDir, "tags.json");
  const existing = readModMetadataFromDir(modDir);
  const qaqm = existing.qaqm && typeof existing.qaqm === "object" && !Array.isArray(existing.qaqm) ? { ...existing.qaqm } : {};
  qaqm.appearanceSectionId = resolvedSectionId;
  qaqm.classificationSource = String(source || "user").slice(0, 40);
  qaqm.appearanceAssignedAt = (/* @__PURE__ */ new Date()).toISOString();
  if (definition?.kind === "official-skin" && definition.skinId) {
    qaqm.characterSkinId = definition.skinId;
  } else {
    delete qaqm.characterSkinId;
  }
  fs.writeFileSync(tagsFile, JSON.stringify({ ...existing, qaqm }, null, 2), "utf-8");
  return { sectionId: resolvedSectionId, skinId: qaqm.characterSkinId || null };
}
function assignInstalledModAppearance({
  characterName,
  modName,
  modDir,
  requested = null,
  gameId: gameId2 = getActiveGameScopeId(),
  source = "auto",
  ignoreStored = false
}) {
  const meta = readModMetadataFromDir(modDir);
  const requestedTarget = requested ? extractRequestedAppearanceTarget(requested) : null;
  const sectionId = resolveModAppearanceSectionId({
    characterName,
    modName,
    modDir,
    meta,
    requested,
    gameId: gameId2,
    ignoreStored
  });
  return writeModAppearanceSectionMetadata(modDir, characterName, sectionId, {
    gameId: gameId2,
    source: requestedTarget?.sectionId || requestedTarget?.skinId ? source : sectionId === BASE_APPEARANCE_SECTION_ID ? "base-fallback" : source
  });
}
function resolveExistingModDirectoryAnyMode(characterName, modName, gameId2 = getActiveGameScopeId()) {
  const safeModName = assertSafeAppearancePathSegment(modName, "Mod 名称");
  if (!isNevernessDx12Mode(gameId2)) {
    const resolved = resolveExistingStandardModDirectory(characterName, safeModName, gameId2);
    if (!resolved?.modPath || !isPathInsideDirectory(resolved.modPath, resolved.charPath)) return null;
    return resolved;
  }
  const paths = getNevernessDx12Paths(gameId2);
  const activeCharPath = getNevernessDx12CharacterPath(characterName, {
    ensure: true,
    gameId: gameId2
  });
  const disabledCharPath = getNevernessDx12DisabledCharacterPath(characterName, paths, {
    gameId: gameId2
  });
  const candidates = [
    activeCharPath ? path.join(activeCharPath, safeModName) : "",
    activeCharPath ? path.join(activeCharPath, `DISABLED_${safeModName}`) : "",
    disabledCharPath ? path.join(disabledCharPath, safeModName) : "",
    disabledCharPath ? path.join(disabledCharPath, `DISABLED_${safeModName}`) : ""
  ].filter(Boolean);
  const allowedRoots = [activeCharPath, disabledCharPath].filter(Boolean);
  const modPath = candidates.find(
    (candidate) => allowedRoots.some((root) => isPathInsideDirectory(candidate, root)) && fs.existsSync(candidate)
  );
  if (!modPath) return null;
  const folderName = path.basename(modPath);
  return {
    charPath: path.dirname(modPath),
    modPath,
    folderName,
    enabled: !!activeCharPath && isPathInsideDirectory(modPath, activeCharPath) && !folderName.startsWith("DISABLED_")
  };
}
function resolveAppearanceCharacterContext(characterName, gameId2 = getActiveGameScopeId()) {
  const safeCharacterName = assertSafeAppearancePathSegment(characterName, "角色名称");
  const resolvedEntry = resolveCharacterEntry(safeCharacterName, gameId2);
  if (!resolvedEntry?.characterRootPath || !fs.existsSync(resolvedEntry.characterRootPath)) {
    throw new Error("角色不存在");
  }
  const resolvedCharacterName = assertSafeAppearancePathSegment(
    resolvedEntry.displayName || safeCharacterName,
    "角色名称"
  );
  return {
    characterName: resolvedCharacterName,
    characterPath: resolvedEntry.characterRootPath,
    entry: resolvedEntry
  };
}
function listModDirectoryRecordsForCharacter(characterName, gameId2 = getActiveGameScopeId()) {
  if (isNevernessDx12Mode(gameId2)) {
    const paths = getNevernessDx12Paths(gameId2);
    const activeCharPath = getNevernessDx12CharacterPath(characterName, {
      ensure: true,
      gameId: gameId2
    });
    const disabledCharPath = getNevernessDx12DisabledCharacterPath(characterName, paths, {
      gameId: gameId2
    });
    return [activeCharPath, disabledCharPath].filter((dirPath) => dirPath && fs.existsSync(dirPath)).flatMap(
      (dirPath) => fs.readdirSync(dirPath, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => ({
        modName: entry.name.replace(/^DISABLED_/i, ""),
        modDir: path.join(dirPath, entry.name)
      }))
    ).filter((entry) => isNevernessDx12ModDir(entry.modDir));
  }
  const charPath = resolveCharacterPath(characterName, gameId2);
  if (!charPath || !fs.existsSync(charPath)) return [];
  return fs.readdirSync(charPath, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => ({
    modName: entry.name.replace(/^DISABLED_/i, ""),
    modDir: path.join(charPath, entry.name)
  }));
}
function notifyAllModWindowsChanged(characterName = "__all__", meta = {}) {
  CHARACTER_DIRECTORY_STATS_CACHE.clear();
  const payload = { characterName, ...meta && typeof meta === "object" ? meta : {} };
  electron.BrowserWindow.getAllWindows().forEach((window) => {
    if (!window.isDestroyed()) {
      window.webContents.send("mods-changed", payload);
    }
  });
}
function notifyCharacterListChanged(characterName = "__all__", meta = {}) {
  overlayActivity.invalidate();
  const changedCharacterName = String(characterName || "").trim() || "__all__";
  const safeMeta = meta && typeof meta === "object" ? meta : {};
  notifyAllModWindowsChanged("__all__", {
    ...safeMeta,
    fullRefresh: true,
    changedCharacterName
  });
}
function notifyMarkedModsChanged(gameId2 = getActiveGameScopeId(), characterName = "__all__", meta = {}) {
  const payload = { gameId: gameId2, characterName, ...meta && typeof meta === "object" ? meta : {} };
  electron.BrowserWindow.getAllWindows().forEach((window) => {
    if (!window.isDestroyed()) {
      window.webContents.send("marked-mods-changed", payload);
    }
  });
}
electron.ipcMain.handle("pin-mod", async (_, { characterName, modName, pinned }) => {
  try {
    organizeLegacyCharacterFoldersIfNeeded(getActiveGameScopeId());
    const currentPinned = getPinnedModsForCharacter(characterName);
    const alreadyPinned = currentPinned.includes(modName);
    const nextPinned = typeof pinned === "boolean" ? pinned : !alreadyPinned;
    const nextPinnedMods = nextPinned ? [modName, ...currentPinned.filter((name) => name !== modName)] : currentPinned.filter((name) => name !== modName);
    setPinnedModsForCharacter(characterName, nextPinnedMods);
    notifyAllModWindowsChanged(characterName, { modName, reason: "pin" });
    return { success: true, pinned: nextPinned };
  } catch (error) {
    return { error: error.message };
  }
});
electron.ipcMain.handle("save-hotkey", async (_, { characterName, modName, sectionName, newKey, relativePath }) => {
  try {
    const gameId2 = getActiveGameScopeId();
    organizeLegacyCharacterFoldersIfNeeded(gameId2);
    const charPath = resolveCharacterPath(characterName, gameId2);
    if (!charPath) {
      return { error: "Character folder not found" };
    }
    let modPath = path.join(charPath, modName);
    if (!fs.existsSync(modPath)) {
      const disabledModPath = path.join(charPath, `DISABLED_${modName}`);
      if (fs.existsSync(disabledModPath)) {
        modPath = disabledModPath;
      } else {
        return { error: "Mod folder not found" };
      }
    }
    const iniFiles = getIniFiles(modPath).filter(file => relativePath === undefined || path.relative(modPath, path.dirname(file)).split(path.sep).join("/") === relativePath);
    if (iniFiles.length === 0) {
      return { error: "No INI files found in mod folder" };
    }
    let updated = false;
    for (const iniPath of iniFiles) {
      const content = fs.readFileSync(iniPath, "utf-8");
      const lines = content.split(/\r?\n/);
      let newLines = [];
      let inTargetSection = false;
      let keyUpdated = false;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();
        const sectionMatch = trimmedLine.match(/^\[Key(.*?)\]$/i);
        if (/^\[.*\]$/.test(trimmedLine)) {
          if (inTargetSection && !keyUpdated) {
            newLines.push(`key = ${newKey}`);
            keyUpdated = true;
            updated = true;
          }
          if (sectionMatch && sectionMatch[1] === sectionName) {
            inTargetSection = true;
          } else {
            inTargetSection = false;
          }
          newLines.push(line);
        } else if (inTargetSection && trimmedLine.match(/^key\s*=/i)) {
          newLines.push(`key = ${newKey}`);
          keyUpdated = true;
          updated = true;
        } else {
          newLines.push(line);
        }
      }
      if (inTargetSection && !keyUpdated) {
        newLines.push(`key = ${newKey}`);
        updated = true;
      }
      if (updated) {
        fs.writeFileSync(iniPath, newLines.join("\r\n"), "utf-8");
        clearHotkeysCacheForMod(characterName, modName, gameId2);
        notifyHotkeysChanged(characterName, modName, gameId2, _?.sender?.id);
        return { success: true };
      }
    }
    return { error: `Section [Key${sectionName}] not found in any INI file` };
  } catch (error) {
    console.error("save-hotkey error:", error);
    return { error: error.message };
  }
});
electron.ipcMain.handle("get-mods", async (_, characterName) => {
  try {
    const gameId2 = getActiveGameScopeId();
    if (isNevernessDx12Mode(gameId2)) {
      return getNevernessDx12Mods(characterName);
    }
    organizeLegacyCharacterFoldersIfNeeded(gameId2);
    const charPath = resolveCharacterPath(characterName, gameId2);
    if (!charPath || !fs.existsSync(charPath)) {
      return { error: "Character not found" };
    }
    const files = fs.readdirSync(charPath, { withFileTypes: true });
    const addedAtAccessor = createModAddedAtAccessor();
    let mods = files.filter((dirent) => dirent.isDirectory()).map((dirent) => {
      const originalName = dirent.name;
      const isDisabled = originalName.startsWith("DISABLED_");
      const displayName = isDisabled ? originalName.replace("DISABLED_", "") : originalName;
      const modPath = path.join(charPath, originalName);
      const { addedAt, addedAtMs } = addedAtAccessor.get(characterName, displayName, modPath);
      let tags = [];
      let notes = "";
      let hotkeyAliases = {};
      let modMeta = {};
      try {
        const tagsFile = path.join(modPath, "tags.json");
        if (fs.existsSync(tagsFile)) {
          const meta = JSON.parse(fs.readFileSync(tagsFile, "utf-8"));
          modMeta = meta && typeof meta === "object" ? meta : {};
          if (Array.isArray(modMeta.tags)) {
            tags = modMeta.tags.map((t) => typeof t === "string" ? t : t && t.name ? String(t.name) : "").filter(Boolean);
          }
          if (typeof modMeta.notes === "string") notes = modMeta.notes;
          if (modMeta.hotkeyAliases && typeof modMeta.hotkeyAliases === "object" && !Array.isArray(modMeta.hotkeyAliases)) {
            for (const [section, alias] of Object.entries(modMeta.hotkeyAliases)) {
              if (typeof alias === "string" && alias.trim()) hotkeyAliases[section] = alias;
            }
          }
        }
      } catch (_2) {
      }
      let previewUrl = null;
      try {
        const previewImagePath = findModPreviewImageFile(modPath);
        if (previewImagePath) previewUrl = "file:///" + previewImagePath.replace(/\\/g, "/");
      } catch (_2) {
      }
      return {
        name: displayName,
        originalName,
        enabled: !isDisabled,
        path: modPath,
        previewUrl,
        addedAt,
        addedAtMs,
        tags,
        notes,
        hotkeyAliases,
        appearanceSectionId: resolveModAppearanceSectionId({
          characterName,
          modName: displayName,
          modDir: modPath,
          meta: modMeta,
          gameId: gameId2
        })
      };
    });
    const modOrders = currentConfig.modOrders || {};
    const { value: customOrder } = getCharacterConfigStoreValue(
      modOrders,
      characterName,
      [],
      gameId2
    );
    if (customOrder.length > 0) {
      const orderedMods = [];
      const unorderedMods = [];
      for (const mod of mods) {
        if (customOrder.includes(mod.name)) {
          orderedMods.push(mod);
        } else {
          unorderedMods.push(mod);
        }
      }
      orderedMods.sort((a, b) => customOrder.indexOf(a.name) - customOrder.indexOf(b.name));
      unorderedMods.sort((a, b) => a.name.localeCompare(b.name, "zh"));
      mods = [...orderedMods, ...unorderedMods];
    }
    mods = movePinnedModsToTop(applyPinnedStateToMods(characterName, mods));
    const sections = buildAppearanceSectionsWithStats(characterName, mods, gameId2);
    addedAtAccessor.saveIfDirty();
    return {
      success: true,
      mods,
      sections,
      enabledSectionIds: sections.filter((section) => section.enabledCount > 0).map((section) => section.sectionId),
      characterAliases: getCharacterAliasCandidates(characterName, gameId2)
    };
  } catch (error) {
    return { error: error.message };
  }
});
electron.ipcMain.handle("character-section:list", async (_, { characterName } = {}) => {
  try {
    const gameId2 = getActiveGameScopeId();
    const { characterName: name } = resolveAppearanceCharacterContext(characterName, gameId2);
    return {
      success: true,
      sections: getMergedAppearanceSectionDefinitions(name, gameId2)
    };
  } catch (error) {
    return { error: error.message };
  }
});
electron.ipcMain.handle(
  "character-section:create",
  async (_, { characterName, name, nameEn = "", coverImagePath = null } = {}) => {
    let createdCoverDir = null;
    try {
      const gameId2 = getActiveGameScopeId();
      const { characterName: targetCharacterName } = resolveAppearanceCharacterContext(
        characterName,
        gameId2
      );
      const sectionName = String(name || "").trim().slice(0, 60);
      if (!sectionName) return { error: "分区名称不能为空" };
      const existingNames = new Set(
        getMergedAppearanceSectionDefinitions(targetCharacterName, gameId2).map(
          (section) => String(section.name || "").trim().toLowerCase()
        )
      );
      if (existingNames.has(sectionName.toLowerCase())) return { error: "同名分区已存在" };
      const sectionId = `custom:${crypto.randomUUID()}`;
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const customSections = getCustomAppearanceSections(targetCharacterName, gameId2);
      const created = {
        id: sectionId,
        sectionId,
        kind: "custom",
        official: false,
        name: sectionName,
        nameZh: sectionName,
        nameEn: String(nameEn || "").trim().slice(0, 80),
        createdAt: now,
        updatedAt: now
      };
      let coverUrl = null;
      if (coverImagePath) {
        createdCoverDir = getAppearanceSectionImagesDir(
          targetCharacterName,
          sectionId,
          gameId2
        );
        coverUrl = saveAppearanceSectionCoverImage(
          targetCharacterName,
          sectionId,
          coverImagePath,
          gameId2
        ).coverUrl;
      }
      setCustomAppearanceSections(targetCharacterName, [...customSections, created], gameId2);
      createdCoverDir = null;
      notifyAllModWindowsChanged(targetCharacterName, { reason: "appearance-section-created" });
      return { success: true, section: { ...created, coverUrl } };
    } catch (error) {
      if (createdCoverDir) {
        try {
          fs.rmSync(createdCoverDir, { recursive: true, force: true });
        } catch (_2) {
        }
      }
      return { error: error.message };
    }
  }
);
electron.ipcMain.handle(
  "character-section:update",
  async (_, { characterName, sectionId, name, nameEn } = {}) => {
    try {
      const gameId2 = getActiveGameScopeId();
      const { characterName: targetCharacterName } = resolveAppearanceCharacterContext(
        characterName,
        gameId2
      );
      const normalizedSectionId = normalizeAppearanceSectionId(sectionId);
      if (!normalizedSectionId) return { error: "缺少分区 ID" };
      if (!isCustomAppearanceSectionId(normalizedSectionId)) return { error: "官方分区不能修改" };
      const customSections = getCustomAppearanceSections(targetCharacterName, gameId2);
      const index = customSections.findIndex((section2) => section2.sectionId === normalizedSectionId);
      if (index < 0) return { error: "自定义分区不存在" };
      const nextName = name === void 0 ? customSections[index].name : String(name || "").trim().slice(0, 60);
      if (!nextName) return { error: "分区名称不能为空" };
      const duplicate = getMergedAppearanceSectionDefinitions(targetCharacterName, gameId2).some(
        (section2) => section2.sectionId !== normalizedSectionId && String(section2.name || "").trim().toLowerCase() === nextName.toLowerCase()
      );
      if (duplicate) return { error: "同名分区已存在" };
      customSections[index] = {
        ...customSections[index],
        name: nextName,
        nameZh: nextName,
        ...nameEn !== void 0 ? { nameEn: String(nameEn || "").trim().slice(0, 80) } : {},
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      const saved = setCustomAppearanceSections(targetCharacterName, customSections, gameId2);
      const section = saved.find((item) => item.sectionId === normalizedSectionId);
      notifyAllModWindowsChanged(targetCharacterName, { reason: "appearance-section-updated" });
      return {
        success: true,
        section: {
          ...section,
          coverUrl: getAppearanceSectionCoverUrl(targetCharacterName, normalizedSectionId, gameId2)
        }
      };
    } catch (error) {
      return { error: error.message };
    }
  }
);
electron.ipcMain.handle(
  "character-section:delete",
  async (_, { characterName, sectionId } = {}) => {
    try {
      const gameId2 = getActiveGameScopeId();
      const { characterName: targetCharacterName } = resolveAppearanceCharacterContext(
        characterName,
        gameId2
      );
      const normalizedSectionId = normalizeAppearanceSectionId(sectionId);
      if (!normalizedSectionId) return { error: "缺少分区 ID" };
      if (!isCustomAppearanceSectionId(normalizedSectionId)) return { error: "官方分区不能删除" };
      const customSections = getCustomAppearanceSections(targetCharacterName, gameId2);
      if (!customSections.some((section) => section.sectionId === normalizedSectionId)) {
        return { error: "自定义分区不存在" };
      }
      const targetRecords = listModDirectoryRecordsForCharacter(targetCharacterName, gameId2).filter((record) => {
        const meta = readModMetadataFromDir(record.modDir);
        return getStoredModAppearanceSectionId(meta) === normalizedSectionId;
      });
      const snapshots = [];
      try {
        for (const record of targetRecords) {
          const tagsFile = path.join(record.modDir, "tags.json");
          snapshots.push({
            tagsFile,
            existed: fs.existsSync(tagsFile),
            content: fs.existsSync(tagsFile) ? fs.readFileSync(tagsFile) : null
          });
          writeModAppearanceSectionMetadata(
            record.modDir,
            targetCharacterName,
            BASE_APPEARANCE_SECTION_ID,
            { gameId: gameId2, source: "section-deleted" }
          );
        }
        setCustomAppearanceSections(
          targetCharacterName,
          customSections.filter((section) => section.sectionId !== normalizedSectionId),
          gameId2
        );
      } catch (error) {
        const rollbackErrors = [];
        for (const snapshot of snapshots.reverse()) {
          try {
            if (snapshot.existed) fs.writeFileSync(snapshot.tagsFile, snapshot.content);
            else fs.rmSync(snapshot.tagsFile, { force: true });
          } catch (rollbackError) {
            rollbackErrors.push(rollbackError?.message || String(rollbackError));
          }
        }
        try {
          setCustomAppearanceSections(targetCharacterName, customSections, gameId2);
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError?.message || String(rollbackError));
        }
        return {
          error: `分区删除失败，已回滚 Mod 归类：${error?.message || error}`,
          reassignedCount: 0,
          rollbackErrors
        };
      }
      try {
        fs.rmSync(getAppearanceSectionImagesDir(targetCharacterName, normalizedSectionId, gameId2), {
          recursive: true,
          force: true
        });
      } catch (_2) {
      }
      notifyAllModWindowsChanged(targetCharacterName, { reason: "appearance-section-deleted" });
      return {
        success: true,
        reassignedCount: targetRecords.length,
        fallbackSectionId: BASE_APPEARANCE_SECTION_ID
      };
    } catch (error) {
      return { error: error.message };
    }
  }
);
electron.ipcMain.handle(
  "character-section:set-cover",
  async (_, { characterName, sectionId, imagePath } = {}) => {
    try {
      const gameId2 = getActiveGameScopeId();
      const { characterName: targetCharacterName } = resolveAppearanceCharacterContext(
        characterName,
        gameId2
      );
      const normalizedSectionId = normalizeAppearanceSectionId(sectionId);
      if (!normalizedSectionId || !imagePath) {
        return { error: "缺少分区 ID 或封面" };
      }
      if (!getCustomAppearanceSections(targetCharacterName, gameId2).some(
        (section) => section.sectionId === normalizedSectionId
      )) {
        return { error: "只有自定义分区可以设置封面" };
      }
      const result = saveAppearanceSectionCoverImage(
        targetCharacterName,
        normalizedSectionId,
        imagePath,
        gameId2
      );
      notifyAllModWindowsChanged(targetCharacterName, { reason: "appearance-section-cover" });
      return { success: true, coverUrl: result.coverUrl };
    } catch (error) {
      return { error: error.message };
    }
  }
);
electron.ipcMain.handle(
  "character-section:assign-mod",
  async (_, { characterName, modName, sectionId } = {}) => {
    try {
      const gameId2 = getActiveGameScopeId();
      const { characterName: targetCharacterName } = resolveAppearanceCharacterContext(
        characterName,
        gameId2
      );
      const targetModName = assertSafeAppearancePathSegment(modName, "Mod 名称");
      const normalizedSectionId = normalizeAppearanceSectionId(sectionId) || BASE_APPEARANCE_SECTION_ID;
      if (!getAppearanceSectionDefinition(targetCharacterName, normalizedSectionId, gameId2)) {
        return { error: "目标分区不存在" };
      }
      const resolved = resolveExistingModDirectoryAnyMode(
        targetCharacterName,
        targetModName,
        gameId2
      );
      if (!resolved?.modPath) return { error: "Mod 文件夹不存在" };
      const appearance = writeModAppearanceSectionMetadata(
        resolved.modPath,
        targetCharacterName,
        normalizedSectionId,
        { gameId: gameId2, source: "user" }
      );
      notifyAllModWindowsChanged(targetCharacterName, {
        modName: targetModName,
        sectionId: appearance.sectionId,
        reason: "appearance-section-assigned"
      });
      return { success: true, appearanceSectionId: appearance.sectionId };
    } catch (error) {
      return { error: error.message };
    }
  }
);
electron.ipcMain.handle("toggle-mod", async (_, { characterName, modName, enable }) => {
  try {
    const gameId2 = getActiveGameScopeId();
    characterName = assertSafeAppearancePathSegment(characterName, "角色名称");
    modName = assertSafeAppearancePathSegment(modName, "Mod 名称");
    if (enable) assertCharacterVisible(characterName, gameId2);
    if (isNevernessDx12Mode(gameId2)) {
      return toggleNevernessDx12PakMod(characterName, modName, enable);
    }
    organizeLegacyCharacterFoldersIfNeeded(gameId2);
    const env = resolveActiveGameEnvRoot(gameId2);
    const charPath = resolveCharacterPath(characterName, gameId2);
    if (!charPath) {
      return { error: "Character folder not found" };
    }
    const currentName = enable ? `DISABLED_${modName}` : modName;
    const newName = enable ? modName : `DISABLED_${modName}`;
    const currentPath = path.join(charPath, currentName);
    const newPath = path.join(charPath, newName);
    if (!fs.existsSync(currentPath)) {
      return { error: "Mod folder not found" };
    }
    if (!enable && isPersistBridgeEnabled(gameId2)) {
      if (usesManagedPersistBridge(characterName, modName, gameId2)) {
        syncPersistBridgeStateForModDir(currentPath, gameId2);
      }
    }
    const renameResult = await renameModDirectoryWithRetry(currentPath, newPath);
    if (!renameResult.success) {
      return { error: renameResult.error || "Rename failed after retries" };
    }
    if (env?.root && isPersistBridgeEnabled(gameId2)) {
      const stateFiles = collectHostedPersistStateFilesForModDir(newPath);
      updateActivePersistBridgeIncludesIncremental(
        env.root,
        enable ? { enableStateFiles: stateFiles } : { disableStateFiles: stateFiles }
      );
    }
    clearConflictCache(characterName, gameId2);
    if (enable && isPersistBridgeEnabled(gameId2)) {
      restorePersistStateForMod(characterName, modName, newPath, gameId2);
    }
    notifyCharacterListChanged(characterName, { modName, reason: "manager-toggle" });
    return { success: true, persistRestored: false, autoReloaded: false };
  } catch (error) {
    return { error: error.message };
  }
});
electron.ipcMain.on("notify-overlay-mods-changed", (_, { characterName }) => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send("mods-changed", { characterName });
  }
});
const BANDIZIP_PATH = "C:\\Program Files\\Bandizip\\bz.exe";
function getUnrarPath() {
  const bundled = resolveBundledHelperPath("UnRAR.exe");
  if (bundled && fs.existsSync(bundled)) return bundled;
  const systemPaths = [
    "C:\\Program Files\\WinRAR\\UnRAR.exe",
    "C:\\Program Files (x86)\\WinRAR\\UnRAR.exe"
  ];
  return systemPaths.find((p) => fs.existsSync(p)) || null;
}
function isBandizipAvailable() {
  return fs.existsSync(BANDIZIP_PATH);
}
function flattenSingleSubfolder(targetPath) {
  try {
    const extracted = fs.readdirSync(targetPath);
    if (extracted.length === 1) {
      if (String(extracted[0] || "").toLowerCase() === "mods") {
        logger.info("Skipped flattening Mods root for integrated package");
        return;
      }
      const singleItem = path.join(targetPath, extracted[0]);
      if (findIntegratedModsDir(singleItem, 1)) {
        logger.info("Skipped flattening integrated package wrapper");
        return;
      }
      if (fs.statSync(singleItem).isDirectory()) {
        const innerFiles = fs.readdirSync(singleItem);
        for (const file of innerFiles) {
          fs.renameSync(path.join(singleItem, file), path.join(targetPath, file));
        }
        fs.rmdirSync(singleItem);
        logger.info("Flattened single subfolder");
      }
    }
  } catch (_) {
  }
}
function directoryHasAnyFile(dirPath) {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isFile()) return true;
      if (entry.isDirectory() && directoryHasAnyFile(fullPath)) return true;
    }
  } catch (_) {
  }
  return false;
}
function assertDirectoryHasAnyFile(dirPath, context = "archive") {
  if (!directoryHasAnyFile(dirPath)) {
    throw new Error(`${context} extracted no files; the package may be incomplete or corrupted.`);
  }
}
function countFilesInPath(targetPath) {
  try {
    const stat = fs.statSync(targetPath);
    if (stat.isFile()) return 1;
    if (!stat.isDirectory()) return 0;
    let count = 0;
    const entries = fs.readdirSync(targetPath, { withFileTypes: true });
    for (const entry of entries) {
      count += countFilesInPath(path.join(targetPath, entry.name));
    }
    return count;
  } catch (_) {
    return 0;
  }
}
function spawnExtract(exePath, args) {
  return new Promise((resolve, reject) => {
    const child = child_process.spawn(exePath, args, { windowsHide: true });
    const stdoutChunks = [];
    const stderrChunks = [];
    child.stdout.on("data", (d) => {
      stdoutChunks.push(d);
    });
    child.stderr.on("data", (d) => {
      stderrChunks.push(d);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      const stdout = iconv.decode(Buffer.concat(stdoutChunks), "gbk");
      const stderr = iconv.decode(Buffer.concat(stderrChunks), "gbk");
      if (stdout) logger.info(`stdout: ${stdout}`);
      if (stderr) logger.error(`stderr: ${stderr}`);
      resolve({ code, stdout, stderr });
    });
  });
}
function restorePersistBakFiles(modDir) {
  let count = 0;
  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
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
          logger.warn(
            `Failed to restore persist bak: ${fullPath} -> ${originalPath}: ${e?.message || e}`
          );
        }
      }
    }
  }
  walk(modDir);
  return count;
}
function createIniBackupStamp() {
  const now = /* @__PURE__ */ new Date();
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
      entries = fs.readdirSync(dir, { withFileTypes: true });
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
  return { stamp, count, errors, backupPaths };
}
function summarizeIniBackupSnapshot(snapshot) {
  if (!snapshot) return null;
  const { backupPaths: _backupPaths, ...summary } = snapshot;
  return summary;
}
function resolveModDirectory(characterName, modName) {
  const gameId2 = getActiveGameScopeId();
  const modsPath = getModsPath(gameId2);
  if (!modsPath || !fs.existsSync(modsPath)) {
    throw new Error("Mods 路径未设置或不存在");
  }
  const resolved = resolveExistingStandardModDirectory(characterName, modName, gameId2);
  if (!resolved?.modPath || !fs.existsSync(resolved.modPath)) {
    throw new Error(`Mod 目录不存在: ${modName}`);
  }
  return resolved.modPath;
}
function collectFixBackupFilesForMod(modDir) {
  const backups = [];
  const errors = [];
  const includeWuwaIndependent = getActiveGameScopeId() === WUWA_FIX_GAME_ID;
  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
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
      const parsed = parseFixBackupFileName(entry.name, { includeWuwaIndependent });
      if (!parsed) continue;
      const originalPath = path.join(dir, parsed.originalName);
      if (!isPathInsideDirectory(originalPath, modDir) || !isPathInsideDirectory(fullPath, modDir)) continue;
      backups.push({
        ...parsed,
        backupPath: fullPath,
        originalPath,
        relativePath: path.relative(modDir, originalPath).replace(/\\/g, "/")
      });
    }
  }
  walk(modDir);
  return { backups, errors };
}
function listIniBackupsForMod(characterName, modName) {
  const modDir = resolveModDirectory(characterName, modName);
  const scan = collectFixBackupFilesForMod(modDir);
  if (scan.errors.length > 0) {
    throw new Error(`读取备份目录失败：${scan.errors.slice(0, 3).join("；")}`);
  }
  const grouped = /* @__PURE__ */ new Map();
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
    throw new Error(`备份扫描不完整，未执行回滚：${scan.errors.slice(0, 3).join("；")}`);
  }
  const plan = buildFixBackupRestorePlan(scan.backups, selectedStamp);
  if (!plan) throw new Error("没有找到这个日期的修复备份");
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
    logger.warn(
      `[FixBackup] Restore failed stamp=${selectedStamp} restored=${restoredCount}/${backups.length}; backups preserved`
    );
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
      error: `回滚未完成：${errors.length} 个文件恢复失败，相关备份已保留`
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
    logger.warn(
      `[FixBackup] Restore completed but cleanup failed stamp=${selectedStamp} removed=${removedBackupCount}/${cleanupBackups.length}`
    );
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
    error: cleanupSucceeded ? "" : `回滚已完成，但 ${cleanupErrors.length} 个所选备份文件删除失败`
  };
}
function isSameResolvedPath(left, right) {
  if (!left || !right) return false;
  try {
    const resolvedLeft = path.resolve(left);
    const resolvedRight = path.resolve(right);
    return process.platform === "win32" ? resolvedLeft.toLowerCase() === resolvedRight.toLowerCase() : resolvedLeft === resolvedRight;
  } catch (_) {
    return false;
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
    await fs.promises.rm(targetPath, { force: true });
  } else if (!sourceIsDirectory && stat.isDirectory()) {
    await fs.promises.rm(targetPath, { recursive: true, force: true });
  }
}
async function copyDirectoryContentsOverlay(sourceDir, targetDir) {
  await fs.promises.mkdir(targetDir, { recursive: true });
  let copiedFiles = 0;
  const entries = await fs.promises.readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      await removePathForOverlayCopy(targetPath, true);
      copiedFiles += await copyDirectoryContentsOverlay(sourcePath, targetPath);
    } else if (entry.isFile()) {
      await removePathForOverlayCopy(targetPath, false);
      await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
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
  await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.promises.copyFile(sourcePath, targetPath);
  return 1;
}
async function movePathWithFallbackAsync(sourcePath, targetPath, sourceIsDirectory, { onReadyToRemoveSource = null } = {}) {
  const movedFiles = countFilesInPath(sourcePath);
  await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
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
    await fs.promises.rm(sourcePath, { recursive: true, force: true });
  } catch (cleanupError) {
    logger.warn(`[IntegratedPackage] Failed to remove moved source ${sourcePath}: ${cleanupError?.message || cleanupError}`);
  }
  return movedFiles || fallbackCopiedFiles;
}
function isLikelyIntegratedModsRoot(modsDir, { allowNamelessRoot = true, gameId: gameId2 = getActiveGameScopeId() } = {}) {
  if (!modsDir || !fs.existsSync(modsDir)) return false;
  try {
    if (!fs.statSync(modsDir).isDirectory()) return false;
    const characterDirs = fs.readdirSync(modsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory() && !entry.name.startsWith("."));
    if (characterDirs.length === 0) return false;
    for (const characterDir of characterDirs) {
      if (allowNamelessRoot && !getKnownCharacterDisplayName(characterDir.name, gameId2)) {
        continue;
      }
      const characterPath = path.join(modsDir, characterDir.name);
      const modDirs = fs.readdirSync(characterPath, { withFileTypes: true }).filter((entry) => entry.isDirectory() && !entry.name.startsWith("."));
      if (modDirs.some((entry) => directoryHasAnyFile(path.join(characterPath, entry.name)))) {
        return true;
      }
    }
  } catch (_) {
    return false;
  }
  return false;
}
function findIntegratedModsDir(sourceRoot, maxDepth = 3) {
  if (!sourceRoot || !fs.existsSync(sourceRoot)) return null;
  if (isLikelyIntegratedModsRoot(sourceRoot, { allowNamelessRoot: true })) return sourceRoot;
  const queue = [{ dirPath: sourceRoot, depth: 0 }];
  const visited = /* @__PURE__ */ new Set();
  while (queue.length > 0) {
    const current = queue.shift();
    let resolved;
    try {
      resolved = path.resolve(current.dirPath);
      const key = process.platform === "win32" ? resolved.toLowerCase() : resolved;
      if (visited.has(key)) continue;
      visited.add(key);
      if (!fs.statSync(resolved).isDirectory()) continue;
    } catch (_) {
      continue;
    }
    if (path.basename(resolved).toLowerCase() === "mods" && isLikelyIntegratedModsRoot(resolved, { allowNamelessRoot: false })) {
      return resolved;
    }
    if (current.depth >= maxDepth) continue;
    let children = [];
    try {
      children = fs.readdirSync(resolved, { withFileTypes: true }).filter((entry) => entry.isDirectory() && !entry.name.startsWith("."));
    } catch (_) {
      continue;
    }
    children.sort((left, right) => {
      const leftIsMods = left.name.toLowerCase() === "mods";
      const rightIsMods = right.name.toLowerCase() === "mods";
      if (leftIsMods !== rightIsMods) return leftIsMods ? -1 : 1;
      return left.name.localeCompare(right.name, "zh");
    });
    for (const child of children) {
      queue.push({ dirPath: path.join(resolved, child.name), depth: current.depth + 1 });
    }
  }
  return null;
}
function getIntegratedModsPackageStats(sourceRoot) {
  const sourceModsDir = findIntegratedModsDir(sourceRoot);
  if (!sourceModsDir) return null;
  try {
    const characterDirs = fs.readdirSync(sourceModsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory() && !entry.name.startsWith("."));
    let modCount = 0;
    let totalItems = 0;
    const affectedCharacters = [];
    for (const characterDir of characterDirs) {
      const sourceCharacterDir = path.join(sourceModsDir, characterDir.name);
      const childEntries = fs.readdirSync(sourceCharacterDir, { withFileTypes: true });
      let characterHasContent = false;
      for (const entry of childEntries) {
        if (entry.name.startsWith(".")) continue;
        const sourcePath = path.join(sourceCharacterDir, entry.name);
        if (entry.isDirectory() && directoryHasAnyFile(sourcePath)) {
          modCount++;
          totalItems++;
          characterHasContent = true;
        } else if (entry.isFile()) {
          totalItems++;
          characterHasContent = true;
        }
      }
      if (characterHasContent) affectedCharacters.push(characterDir.name);
    }
    return {
      sourceModsDir,
      characterCount: affectedCharacters.length,
      modCount,
      totalItems: Math.max(totalItems, modCount),
      affectedCharacters
    };
  } catch (_) {
    return null;
  }
}
async function pathExistsAsync(targetPath) {
  try {
    await fs.promises.access(targetPath);
    return true;
  } catch (_) {
    return false;
  }
}
function getIntegratedInstallSuffix(artifactName, prefix) {
  return artifactName.startsWith(prefix) ? artifactName.slice(prefix.length) : "";
}
function getIntegratedTempMetaPath(tempRoot) {
  return path.join(tempRoot, ".qaqm-install.json");
}
function getIntegratedTempReadyPath(tempRoot) {
  return path.join(tempRoot, ".qaqm-ready");
}
async function readIntegratedTempMeta(tempRoot) {
  try {
    return JSON.parse(await fs.promises.readFile(getIntegratedTempMetaPath(tempRoot), "utf8"));
  } catch (_) {
    return null;
  }
}
async function removeDirectoryIfEmptyAsync(dirPath) {
  try {
    const entries = await fs.promises.readdir(dirPath);
    if (entries.length === 0) {
      await fs.promises.rmdir(dirPath);
      return true;
    }
  } catch (_) {
  }
  return false;
}
async function recoverIntegratedInstallingRoot(tempRoot, characterPath) {
  const meta = await readIntegratedTempMeta(tempRoot);
  const ready = await pathExistsAsync(getIntegratedTempReadyPath(tempRoot));
  const sourceStillExists = meta?.sourcePath ? await pathExistsAsync(meta.sourcePath) : false;
  let tempEntries = [];
  try {
    tempEntries = (await fs.promises.readdir(tempRoot, { withFileTypes: true })).filter(
      (entry) => !entry.name.startsWith(".qaqm-")
    );
  } catch (_) {
    return;
  }
  if (tempEntries.length === 0) {
    try {
      await fs.promises.rm(tempRoot, { recursive: true, force: true });
    } catch (_) {
    }
    return;
  }
  if (!ready && sourceStillExists) {
    try {
      await fs.promises.rm(tempRoot, { recursive: true, force: true });
    } catch (_) {
    }
    return;
  }
  const suffix = getIntegratedInstallSuffix(path.basename(tempRoot), ".qaqm-installing-");
  const backupRoot = path.join(characterPath, `.qaqm-replacebak-${suffix}`);
  for (const entry of tempEntries) {
    const tempPath = path.join(tempRoot, entry.name);
    const targetPath = path.join(characterPath, entry.name);
    const backupPath = path.join(backupRoot, entry.name);
    let hasBackup = false;
    try {
      if (await pathExistsAsync(targetPath)) {
        await fs.promises.mkdir(backupRoot, { recursive: true });
        await movePathToRecycleBin(backupPath, "discard stale integrated backup");
        await fs.promises.rename(targetPath, backupPath);
        hasBackup = true;
      }
      await fs.promises.rename(tempPath, targetPath);
      try {
        await movePathToRecycleBin(backupPath, "cleanup recovered integrated backup");
        await removeDirectoryIfEmptyAsync(backupRoot);
      } catch (cleanupError) {
        logger.warn(`[IntegratedPackage] Failed to cleanup recovered backup ${backupPath}: ${cleanupError?.message || cleanupError}`);
      }
    } catch (error) {
      try {
        if (!await pathExistsAsync(targetPath) && hasBackup && await pathExistsAsync(backupPath)) {
          await fs.promises.rename(backupPath, targetPath);
        }
      } catch (restoreError) {
        logger.warn(`[IntegratedPackage] Failed to restore backup ${backupPath}: ${restoreError?.message || restoreError}`);
      }
      logger.warn(`[IntegratedPackage] Failed to recover installing artifact ${tempPath}: ${error?.message || error}`);
      return;
    }
  }
  try {
    await fs.promises.rm(tempRoot, { recursive: true, force: true });
  } catch (_) {
  }
}
async function recoverIntegratedBackupRoot(backupRoot, characterPath) {
  try {
    const backupEntries = await fs.promises.readdir(backupRoot, { withFileTypes: true });
    for (const backupEntry of backupEntries) {
      const backupPath = path.join(backupRoot, backupEntry.name);
      const targetPath = path.join(characterPath, backupEntry.name);
      if (await pathExistsAsync(targetPath)) {
        await movePathToRecycleBin(backupPath, "cleanup recovered integrated backup");
      } else {
        await fs.promises.rename(backupPath, targetPath);
      }
    }
    await removeDirectoryIfEmptyAsync(backupRoot);
  } catch (error) {
    logger.warn(`[IntegratedPackage] Failed to recover backup artifact ${backupRoot}: ${error?.message || error}`);
  }
}
async function recoverIntegratedInstallArtifacts(targetModsDir) {
  let characterDirs = [];
  try {
    characterDirs = await fs.promises.readdir(targetModsDir, { withFileTypes: true });
  } catch (_) {
    return;
  }
  for (const characterDir of characterDirs) {
    if (!characterDir.isDirectory() || characterDir.name.startsWith(".")) continue;
    const characterPath = path.join(targetModsDir, characterDir.name);
    let entries = [];
    try {
      entries = await fs.promises.readdir(characterPath, { withFileTypes: true });
    } catch (_) {
      continue;
    }
    for (const entry of entries) {
      const artifactPath = path.join(characterPath, entry.name);
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith(".qaqm-installing-")) {
        await recoverIntegratedInstallingRoot(artifactPath, characterPath);
      }
    }
    try {
      entries = await fs.promises.readdir(characterPath, { withFileTypes: true });
    } catch (_) {
      continue;
    }
    for (const entry of entries) {
      const artifactPath = path.join(characterPath, entry.name);
      if (entry.isDirectory() && entry.name.startsWith(".qaqm-replacebak-")) {
        await recoverIntegratedBackupRoot(artifactPath, characterPath);
      }
    }
  }
}
async function buildIntegratedCopyPlan(sourceModsDir, targetModsDir, gameId2 = getActiveGameScopeId()) {
  const sourceEntries = await fs.promises.readdir(sourceModsDir, { withFileTypes: true });
  const characterDirs = sourceEntries.filter((entry) => entry.isDirectory() && !entry.name.startsWith("."));
  const plan = [];
  const affectedCharacters = /* @__PURE__ */ new Set();
  for (const characterDir of characterDirs) {
    const canonicalCharacterName = getCanonicalCharacterConfigKey(characterDir.name, gameId2);
    const sourceCharacterDir = path.join(sourceModsDir, characterDir.name);
    const targetCharacterDir = path.join(targetModsDir, canonicalCharacterName);
    const childEntries = await fs.promises.readdir(sourceCharacterDir, { withFileTypes: true });
    let characterHasContent = false;
    for (const entry of childEntries) {
      if (entry.name.startsWith(".")) continue;
      const sourcePath = path.join(sourceCharacterDir, entry.name);
      const targetName = entry.isDirectory() && isCharacterHidden(canonicalCharacterName, gameId2) && !/^DISABLED_/i.test(entry.name) ? `DISABLED_${entry.name}` : entry.name;
      const targetPath = path.join(targetCharacterDir, targetName);
      const label = canonicalCharacterName === characterDir.name ? `${canonicalCharacterName} / ${entry.name}` : `${characterDir.name} -> ${canonicalCharacterName} / ${entry.name}`;
      if (entry.isDirectory()) {
        if (!directoryHasAnyFile(sourcePath)) continue;
        plan.push({
          characterName: canonicalCharacterName,
          modName: entry.name,
          label,
          sourcePath,
          targetPath,
          sourceIsDirectory: true,
          countsAsMod: true
        });
        characterHasContent = true;
      } else if (entry.isFile()) {
        plan.push({
          characterName: canonicalCharacterName,
          modName: entry.name,
          label,
          sourcePath,
          targetPath,
          sourceIsDirectory: false,
          countsAsMod: false
        });
        characterHasContent = true;
      }
    }
    if (characterHasContent) affectedCharacters.add(canonicalCharacterName);
  }
  return { plan, affectedCharacters: Array.from(affectedCharacters) };
}
async function writeIntegratedTempMeta(tempRoot, meta) {
  await fs.promises.mkdir(tempRoot, { recursive: true });
  await fs.promises.writeFile(getIntegratedTempMetaPath(tempRoot), JSON.stringify(meta, null, 2), "utf8");
}
async function markIntegratedTempReady(tempRoot) {
  await fs.promises.writeFile(getIntegratedTempReadyPath(tempRoot), String(Date.now()), "utf8");
}
async function movePathToInstallTemp(sourcePath, tempPath, sourceIsDirectory, meta) {
  const tempRoot = path.dirname(tempPath);
  await fs.promises.mkdir(tempRoot, { recursive: true });
  await fs.promises.rm(tempPath, { recursive: true, force: true });
  await writeIntegratedTempMeta(tempRoot, meta);
  let readyMarked = false;
  const movedFiles = await movePathWithFallbackAsync(sourcePath, tempPath, sourceIsDirectory, {
    onReadyToRemoveSource: async () => {
      await markIntegratedTempReady(tempRoot);
      readyMarked = true;
    }
  });
  if (!readyMarked) {
    await markIntegratedTempReady(tempRoot);
  }
  return movedFiles;
}
async function movePathWithReplaceSafety(sourcePath, targetPath, sourceIsDirectory, installId) {
  const parentDir = path.dirname(targetPath);
  const entryName = path.basename(targetPath);
  const tempRoot = path.join(parentDir, `.qaqm-installing-${installId}`);
  const backupRoot = path.join(parentDir, `.qaqm-replacebak-${installId}`);
  const tempPath = path.join(tempRoot, entryName);
  const backupPath = path.join(backupRoot, entryName);
  const meta = {
    sourcePath,
    targetPath,
    entryName,
    sourceIsDirectory,
    createdAt: Date.now()
  };
  let movedFiles = 0;
  try {
    movedFiles = await movePathToInstallTemp(sourcePath, tempPath, sourceIsDirectory, meta);
  } catch (error) {
    if (await pathExistsAsync(sourcePath)) {
      try {
        await fs.promises.rm(tempRoot, { recursive: true, force: true });
      } catch (_) {
      }
    }
    throw error;
  }
  let hasBackup = false;
  try {
    if (await pathExistsAsync(targetPath)) {
      await fs.promises.mkdir(backupRoot, { recursive: true });
      await movePathToRecycleBin(backupPath, "discard stale integrated backup");
      await fs.promises.rename(targetPath, backupPath);
      hasBackup = true;
    }
    await fs.promises.rename(tempPath, targetPath);
    try {
      await fs.promises.rm(tempRoot, { recursive: true, force: true });
    } catch (cleanupError) {
      logger.warn(`[IntegratedPackage] Failed to cleanup install temp ${tempRoot}: ${cleanupError?.message || cleanupError}`);
    }
    try {
      await movePathToRecycleBin(backupRoot, "cleanup replaced integrated backup");
    } catch (cleanupError) {
      logger.warn(`[IntegratedPackage] Failed to cleanup replace backup ${backupRoot}: ${cleanupError?.message || cleanupError}`);
    }
  } catch (error) {
    try {
      if (!await pathExistsAsync(targetPath) && hasBackup && await pathExistsAsync(backupPath)) {
        await fs.promises.rename(backupPath, targetPath);
      }
    } catch (restoreError) {
      logger.warn(`[IntegratedPackage] Failed to restore backup ${backupPath}: ${restoreError?.message || restoreError}`);
    }
    try {
      if (!await pathExistsAsync(sourcePath) && await pathExistsAsync(tempPath)) {
        await movePathWithFallbackAsync(tempPath, sourcePath, sourceIsDirectory);
      }
      if (await pathExistsAsync(sourcePath)) {
        await fs.promises.rm(tempRoot, { recursive: true, force: true });
      }
    } catch (_) {
    }
    throw error;
  }
  return movedFiles;
}
async function moveIntegratedModsToCurrentMods(sourceModsDir, targetModsDir, {
  onProgress = null,
  gameId: gameId2 = getActiveGameScopeId(),
  appearanceRequest = null,
  appearanceCharacterName = ""
} = {}) {
  const installId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  await recoverIntegratedInstallArtifacts(targetModsDir);
  const { plan, affectedCharacters } = await buildIntegratedCopyPlan(sourceModsDir, targetModsDir, gameId2);
  let movedFiles = 0;
  let modCount = 0;
  const installedModDirs = [];
  const totalItems = Math.max(1, plan.length);
  const requestedCharacterKey = appearanceCharacterName ? normalizeCharacterFolderKey(
    getCanonicalCharacterConfigKey(appearanceCharacterName, gameId2)
  ) : "";
  if (onProgress) {
    onProgress({ current: 0, total: totalItems, modName: "准备整合包...", integratedPackage: true });
  }
  for (let index = 0; index < plan.length; index++) {
    const item = plan[index];
    if (onProgress) {
      onProgress({
        current: index,
        total: totalItems,
        modName: item.label,
        integratedPackage: true
      });
    }
    await fs.promises.mkdir(path.dirname(item.targetPath), { recursive: true });
    movedFiles += await movePathWithReplaceSafety(
      item.sourcePath,
      item.targetPath,
      item.sourceIsDirectory,
      installId
    );
    if (item.countsAsMod && directoryHasAnyFile(item.targetPath)) {
      try {
        const useRequestedAppearance = !!appearanceRequest && !!requestedCharacterKey && normalizeCharacterFolderKey(item.characterName) === requestedCharacterKey;
        assignInstalledModAppearance({
          characterName: item.characterName,
          modName: item.modName.replace(/^DISABLED_/i, ""),
          modDir: item.targetPath,
          requested: useRequestedAppearance ? appearanceRequest : null,
          gameId: gameId2,
          source: useRequestedAppearance ? "explicit-integrated" : "integrated-import"
        });
      } catch (error) {
        logger.warn(
          `[IntegratedPackage] Failed to classify ${item.label}: ${error?.message || error}`
        );
      }
      installedModDirs.push(item.targetPath);
      modCount++;
    }
    if (onProgress) {
      onProgress({
        current: index + 1,
        total: totalItems,
        modName: item.label,
        integratedPackage: true
      });
    }
  }
  return {
    movedFiles,
    copiedFiles: movedFiles,
    modCount,
    characterCount: affectedCharacters.length,
    affectedCharacters,
    installedModDirs,
    totalItems
  };
}
async function installIntegratedModsPackageIfPresent(sourceRoot, {
  cleanupSource = false,
  onProgress = null,
  gameId: gameId2 = getActiveGameScopeId(),
  appearanceRequest = null,
  appearanceCharacterName = ""
} = {}) {
  const sourceModsDir = findIntegratedModsDir(sourceRoot);
  if (!sourceModsDir) return null;
  const modsPathStatus = getModsPathStatus({ requireExisting: false, gameId: gameId2 });
  if (!modsPathStatus.ok) {
    throw new Error(modsPathStatus.error || "Mods 路径未设置");
  }
  const targetModsDir = modsPathStatus.modsPath;
  if (isSameResolvedPath(sourceModsDir, targetModsDir)) {
    return {
      success: true,
      integratedPackage: true,
      skippedSelfCopy: true,
      sourceModsDir,
      targetModsDir,
      modMode: "integrated",
      modName: "整合包",
      characterName: "__all__",
      characterCount: 0,
      modCount: 0,
      movedFiles: 0,
      copiedFiles: 0,
      totalItems: 0,
      installedModDirs: []
    };
  }
  probeWritableDirectory(targetModsDir, "Mods 目录");
  assertDirectoryHasAnyFile(sourceModsDir, "Integrated Mods package");
  const moveResult = await moveIntegratedModsToCurrentMods(sourceModsDir, targetModsDir, {
    onProgress,
    gameId: gameId2,
    appearanceRequest,
    appearanceCharacterName
  });
  if (moveResult.modCount <= 0 || moveResult.movedFiles <= 0) {
    throw new Error("整合包内的 Mods 文件夹没有可安装的角色 Mod 内容");
  }
  let restoredBakCount = 0;
  for (const modDir of moveResult.installedModDirs) {
    restoredBakCount += restorePersistBakFiles(modDir);
  }
  clearConflictCache();
  notifyAllModWindowsChanged("__all__");
  if (cleanupSource && sourceRoot && fs.existsSync(sourceRoot) && !isSameResolvedPath(sourceRoot, targetModsDir)) {
    try {
      fs.rmSync(sourceRoot, { recursive: true, force: true });
    } catch (_) {
    }
  }
  logger.info(
    `[IntegratedPackage] Installed Mods package: source=${sourceModsDir}, target=${targetModsDir}, characters=${moveResult.characterCount}, mods=${moveResult.modCount}, movedFiles=${moveResult.movedFiles}`
  );
  return {
    success: true,
    integratedPackage: true,
    modMode: "integrated",
    modName: "整合包",
    characterName: "__all__",
    sourceModsDir,
    targetModsDir,
    restoredBakCount,
    ...moveResult
  };
}
const DISGUISE_PASSWORD = "qsl";
const DISGUISE_XOR_KEY = Buffer.from([
  165,
  163,
  127,
  209,
  142,
  66,
  185,
  106,
  240,
  29,
  83,
  200,
  116,
  43,
  230,
  145
]);
const DISGUISE_MAGIC = Buffer.from("QAQM0002", "ascii");
const EXPORT_ENCRYPT_VIDEO_DIR = path.join(electron.app.getPath("videos"), "QAQ-Revival");
const EXPORT_ENCRYPT_LONG_VIDEO_DIR = path.join(EXPORT_ENCRYPT_VIDEO_DIR, "长视频");
const EXPORT_ENCRYPT_LONG_VIDEO_THRESHOLD = 512 * 1024 * 1024;
const EXPORT_ENCRYPT_DIRECT_7Z_THRESHOLD = 1024 * 1024 * 1024;
function findDisguiseMagic(filePath) {
  try {
    const fd = fs.openSync(filePath, "r");
    const stat = fs.fstatSync(fd);
    if (!stat.isFile()) {
      fs.closeSync(fd);
      return -1;
    }
    const fileSize = stat.size;
    const chunkSize = 4 * 1024 * 1024;
    const overlap = DISGUISE_MAGIC.length - 1;
    let pos = fileSize;
    let carry = Buffer.alloc(0);
    while (pos > 0) {
      const readLen = Math.min(chunkSize, pos);
      pos -= readLen;
      const chunk = Buffer.alloc(readLen + carry.length);
      fs.readSync(fd, chunk, 0, readLen, pos);
      carry.copy(chunk, readLen);
      const idx = chunk.lastIndexOf(DISGUISE_MAGIC);
      if (idx !== -1) {
        fs.closeSync(fd);
        return pos + idx;
      }
      carry = chunk.subarray(0, Math.min(overlap, chunk.length));
    }
    fs.closeSync(fd);
  } catch (_) {
  }
  return -1;
}
function decodeV2ToTempZip(filePath, tempDir = electron.app.getPath("temp")) {
  const magicOffset = findDisguiseMagic(filePath);
  if (magicOffset < 0) return null;
  const dataOffset = magicOffset + DISGUISE_MAGIC.length;
  const stat = fs.statSync(filePath);
  const dataLen = stat.size - dataOffset;
  if (dataLen <= 0) return null;
  fs.mkdirSync(tempDir, { recursive: true });
  const tmpZip = path.join(tempDir, `qaqm-xor-${Date.now()}.zip`);
  const inFd = fs.openSync(filePath, "r");
  const outFd = fs.openSync(tmpZip, "w");
  const chunkSize = 4 * 1024 * 1024;
  let remaining = dataLen;
  let readOffset = dataOffset;
  let keyOffset = 0;
  try {
    while (remaining > 0) {
      const readLen = Math.min(chunkSize, remaining);
      const chunk = Buffer.alloc(readLen);
      const bytesRead = fs.readSync(inFd, chunk, 0, readLen, readOffset);
      if (bytesRead <= 0) throw new Error("Unexpected EOF while decoding disguised mod");
      for (let i = 0; i < bytesRead; i++) {
        chunk[i] = chunk[i] ^ DISGUISE_XOR_KEY[(keyOffset + i) % DISGUISE_XOR_KEY.length];
      }
      fs.writeSync(outFd, chunk, 0, bytesRead);
      readOffset += bytesRead;
      keyOffset += bytesRead;
      remaining -= bytesRead;
    }
  } finally {
    fs.closeSync(inFd);
    fs.closeSync(outFd);
  }
  return tmpZip;
}
function emitDisguiseProgress(onProgress, payload = {}) {
  if (typeof onProgress !== "function") return;
  try {
    onProgress(payload);
  } catch (_) {
  }
}
function getPercentLabel(done, total) {
  if (!Number.isFinite(done) || !Number.isFinite(total) || total <= 0) return "";
  return `${Math.max(0, Math.min(100, done / total * 100)).toFixed(1)}%`;
}
function yieldToEventLoop() {
  return new Promise((resolve) => setImmediate(resolve));
}
async function decodeV2ToTempZipAsync(filePath, tempDir = electron.app.getPath("temp"), onProgress = null) {
  const magicOffset = findDisguiseMagic(filePath);
  if (magicOffset < 0) return null;
  const dataOffset = magicOffset + DISGUISE_MAGIC.length;
  const stat = await fs.promises.stat(filePath);
  const dataLen = stat.size - dataOffset;
  if (dataLen <= 0) return null;
  await fs.promises.mkdir(tempDir, { recursive: true });
  const tmpZip = path.join(tempDir, `qaqm-xor-${Date.now()}.zip`);
  const inHandle = await fs.promises.open(filePath, "r");
  const outHandle = await fs.promises.open(tmpZip, "w");
  const chunkSize = 4 * 1024 * 1024;
  let remaining = dataLen;
  let readOffset = dataOffset;
  let keyOffset = 0;
  let copied = 0;
  let lastProgressAt = 0;
  try {
    while (remaining > 0) {
      const readLen = Math.min(chunkSize, remaining);
      const chunk = Buffer.alloc(readLen);
      const { bytesRead } = await inHandle.read(chunk, 0, readLen, readOffset);
      if (bytesRead <= 0) throw new Error("Unexpected EOF while decoding disguised mod");
      for (let i = 0; i < bytesRead; i++) {
        chunk[i] = chunk[i] ^ DISGUISE_XOR_KEY[(keyOffset + i) % DISGUISE_XOR_KEY.length];
      }
      await outHandle.write(chunk, 0, bytesRead);
      readOffset += bytesRead;
      keyOffset += bytesRead;
      copied += bytesRead;
      remaining -= bytesRead;
      if (copied - lastProgressAt >= 32 * 1024 * 1024 || remaining === 0) {
        lastProgressAt = copied;
        emitDisguiseProgress(onProgress, {
          status: "running",
          stage: "decode",
          message: `正在解码 MP4 数据 ${getPercentLabel(copied, dataLen)}`,
          currentBytes: copied,
          totalBytes: dataLen
        });
      }
      await yieldToEventLoop();
    }
  } finally {
    await inHandle.close().catch(() => {
    });
    await outHandle.close().catch(() => {
    });
  }
  return tmpZip;
}
function getTempExtractFallbackBase(anchorPath) {
  try {
    const resolved = anchorPath ? path.resolve(anchorPath) : "";
    const driveRoot = resolved ? path.parse(resolved).root : "";
    if (!driveRoot) return "";
    return path.join(driveRoot, "QAQM_TempExtractCache");
  } catch (_) {
    return "";
  }
}
function ensureTempRootNearPath(anchorPath, folderName) {
  const candidates = [
    path.join(getMarketDownloadCacheDir(), "QAQM_TempExtract"),
    getTempExtractFallbackBase(anchorPath),
    path.join(electron.app.getPath("temp"), "QAQM_TempExtract")
  ].filter(Boolean);
  let lastError = null;
  for (const baseDir of candidates) {
    try {
      probeWritableDirectory(baseDir, "QAQM temp extract cache");
      cleanupTempExtractCache(baseDir);
      const tempRoot = path.join(baseDir, folderName);
      fs.mkdirSync(tempRoot, { recursive: true });
      return tempRoot;
    } catch (error) {
      lastError = error;
      logger.warn(`[TempExtract] Cannot use ${baseDir}: ${error?.message || error}`);
    }
  }
  throw lastError || new Error("No writable temp extract directory available");
}
function cleanupTempExtractCache(baseDir, maxAgeMs = 24 * 60 * 60 * 1e3) {
  try {
    if (!baseDir || !fs.existsSync(baseDir)) return;
    const now = Date.now();
    for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || !/^\.qaqm-/i.test(entry.name)) continue;
      const fullPath = path.join(baseDir, entry.name);
      const stat = fs.statSync(fullPath);
      if (now - stat.mtimeMs > maxAgeMs) {
        fs.rmSync(fullPath, { recursive: true, force: true });
      }
    }
  } catch (_) {
  }
}
function isDiskSpaceError(resultOrMessage) {
  const message = typeof resultOrMessage === "string" ? resultOrMessage : `${resultOrMessage?.stderr || ""}
${resultOrMessage?.stdout || ""}`;
  return /磁盘空间不足|空间不足|not enough space|There is not enough space/i.test(message);
}
function parse7zSltPaths(output) {
  const paths = [];
  let inItems = false;
  for (const line of String(output || "").split(/\r?\n/)) {
    if (line.startsWith("----------")) {
      inItems = true;
      continue;
    }
    if (inItems && line.startsWith("Path = ")) {
      const itemPath = line.slice("Path = ".length).trim();
      if (itemPath) paths.push(itemPath);
    }
  }
  return paths;
}
function decodeXorRangeFromFileSync(filePath, fileOffset, length, keyOffset) {
  const fd = fs.openSync(filePath, "r");
  const buffer = Buffer.alloc(length);
  try {
    const bytesRead = fs.readSync(fd, buffer, 0, length, fileOffset);
    if (bytesRead !== length) throw new Error("Unexpected EOF while reading disguised payload");
    for (let i = 0; i < bytesRead; i++) {
      buffer[i] = buffer[i] ^ DISGUISE_XOR_KEY[(keyOffset + i) % DISGUISE_XOR_KEY.length];
    }
    return buffer;
  } finally {
    fs.closeSync(fd);
  }
}
function readZip64SizeFromExtra(extraBuffer, compressedSize) {
  let offset = 0;
  while (offset + 4 <= extraBuffer.length) {
    const headerId = extraBuffer.readUInt16LE(offset);
    const dataSize = extraBuffer.readUInt16LE(offset + 2);
    const dataStart = offset + 4;
    if (headerId === 1 && dataStart + dataSize <= extraBuffer.length) {
      if (compressedSize === 4294967295 && dataSize >= 16) {
        return Number(extraBuffer.readBigUInt64LE(dataStart + 8));
      }
      if (compressedSize === 4294967295 && dataSize >= 8) {
        return Number(extraBuffer.readBigUInt64LE(dataStart));
      }
    }
    offset = dataStart + dataSize;
  }
  return compressedSize;
}
function peekStoredOuterZipEntryNameFromDisguise(mp4Path) {
  const magicOffset = findDisguiseMagic(mp4Path);
  if (magicOffset < 0) return null;
  const dataOffset = magicOffset + DISGUISE_MAGIC.length;
  const header = decodeXorRangeFromFileSync(mp4Path, dataOffset, 30, 0);
  if (header.readUInt32LE(0) !== 67324752) return null;
  const method = header.readUInt16LE(8);
  if (method !== 0) return null;
  const nameLength = header.readUInt16LE(26);
  if (nameLength <= 0 || nameLength > 4096) return null;
  const nameBuffer = decodeXorRangeFromFileSync(mp4Path, dataOffset + 30, nameLength, 30);
  return nameBuffer.toString("utf-8").replace(/\\/g, "/");
}
async function tryExtractStoredOuterZipEntryFromDisguiseAsync(mp4Path, tempDir, onProgress = null) {
  const magicOffset = findDisguiseMagic(mp4Path);
  if (magicOffset < 0) return null;
  const dataOffset = magicOffset + DISGUISE_MAGIC.length;
  const header = decodeXorRangeFromFileSync(mp4Path, dataOffset, 30, 0);
  if (header.readUInt32LE(0) !== 67324752) return null;
  const flags = header.readUInt16LE(6);
  const method = header.readUInt16LE(8);
  if (method !== 0 || flags & 8) return null;
  let compressedSize = header.readUInt32LE(18);
  const nameLength = header.readUInt16LE(26);
  const extraLength = header.readUInt16LE(28);
  if (nameLength <= 0 || nameLength > 4096 || extraLength > 4096) return null;
  const nameBuffer = decodeXorRangeFromFileSync(mp4Path, dataOffset + 30, nameLength, 30);
  const entryName = nameBuffer.toString("utf-8").replace(/\\/g, "/");
  if (!entryName.toLowerCase().endsWith(".7z")) return null;
  const extraBuffer = extraLength > 0 ? decodeXorRangeFromFileSync(
    mp4Path,
    dataOffset + 30 + nameLength,
    extraLength,
    30 + nameLength
  ) : Buffer.alloc(0);
  compressedSize = readZip64SizeFromExtra(extraBuffer, compressedSize);
  if (!Number.isSafeInteger(compressedSize) || compressedSize <= 0) return null;
  const safeName = path.basename(entryName) || `qaqm-${Date.now()}.7z`;
  const sevenzPath = path.join(tempDir, safeName);
  const payloadOffset = 30 + nameLength + extraLength;
  const fileDataOffset = dataOffset + payloadOffset;
  const inHandle = await fs.promises.open(mp4Path, "r");
  const outHandle = await fs.promises.open(sevenzPath, "w");
  const buffer = Buffer.alloc(4 * 1024 * 1024);
  let copied = 0;
  let lastProgressAt = 0;
  try {
    while (copied < compressedSize) {
      const readLen = Math.min(buffer.length, compressedSize - copied);
      const { bytesRead } = await inHandle.read(buffer, 0, readLen, fileDataOffset + copied);
      if (bytesRead <= 0) throw new Error("Unexpected EOF while extracting outer ZIP entry");
      for (let i = 0; i < bytesRead; i++) {
        buffer[i] = buffer[i] ^ DISGUISE_XOR_KEY[(payloadOffset + copied + i) % DISGUISE_XOR_KEY.length];
      }
      await outHandle.write(buffer, 0, bytesRead);
      copied += bytesRead;
      if (copied - lastProgressAt >= 32 * 1024 * 1024 || copied >= compressedSize) {
        lastProgressAt = copied;
        emitDisguiseProgress(onProgress, {
          status: "running",
          stage: "extract-outer-entry",
          message: `正在提取加密数据 ${getPercentLabel(copied, compressedSize)}`,
          currentBytes: copied,
          totalBytes: compressedSize
        });
      }
      await yieldToEventLoop();
    }
  } finally {
    await inHandle.close().catch(() => {
    });
    await outHandle.close().catch(() => {
    });
  }
  return { sevenzPath, sevenzName: safeName };
}
function writeFileToFdSync(sourcePath, outFd) {
  const inFd = fs.openSync(sourcePath, "r");
  const buffer = Buffer.alloc(4 * 1024 * 1024);
  let total = 0;
  try {
    while (true) {
      const bytesRead = fs.readSync(inFd, buffer, 0, buffer.length, null);
      if (bytesRead <= 0) break;
      fs.writeSync(outFd, buffer, 0, bytesRead);
      total += bytesRead;
    }
  } finally {
    fs.closeSync(inFd);
  }
  return total;
}
function writeXorFileToFdSync(sourcePath, outFd, key) {
  const inFd = fs.openSync(sourcePath, "r");
  const buffer = Buffer.alloc(4 * 1024 * 1024);
  let total = 0;
  try {
    while (true) {
      const bytesRead = fs.readSync(inFd, buffer, 0, buffer.length, null);
      if (bytesRead <= 0) break;
      for (let i = 0; i < bytesRead; i++) {
        buffer[i] = buffer[i] ^ key[(total + i) % key.length];
      }
      fs.writeSync(outFd, buffer, 0, bytesRead);
      total += bytesRead;
    }
  } finally {
    fs.closeSync(inFd);
  }
  return total;
}
let crc32Table = null;
function getCrc32Table() {
  if (crc32Table) return crc32Table;
  crc32Table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
    }
    crc32Table[i] = c >>> 0;
  }
  return crc32Table;
}
function getDosDateTime(date = /* @__PURE__ */ new Date()) {
  const year = Math.max(date.getFullYear(), 1980);
  const dosTime = date.getHours() << 11 | date.getMinutes() << 5 | Math.floor(date.getSeconds() / 2);
  const dosDate = year - 1980 << 9 | date.getMonth() + 1 << 5 | date.getDate();
  return { dosTime, dosDate };
}
function computeFileCrc32Sync(filePath) {
  const table = getCrc32Table();
  const inFd = fs.openSync(filePath, "r");
  const buffer = Buffer.alloc(4 * 1024 * 1024);
  let crc = 4294967295;
  try {
    while (true) {
      const bytesRead = fs.readSync(inFd, buffer, 0, buffer.length, null);
      if (bytesRead <= 0) break;
      for (let i = 0; i < bytesRead; i++) {
        crc = table[(crc ^ buffer[i]) & 255] ^ crc >>> 8;
      }
    }
  } finally {
    fs.closeSync(inFd);
  }
  return (crc ^ 4294967295) >>> 0;
}
function writeXorBufferToFdSync(buffer, outFd, key, keyOffset) {
  const out = Buffer.from(buffer);
  for (let i = 0; i < out.length; i++) {
    out[i] = out[i] ^ key[(keyOffset + i) % key.length];
  }
  fs.writeSync(outFd, out);
  return out.length;
}
function createZip64SizeExtra(fileSize) {
  const extra = Buffer.alloc(20);
  extra.writeUInt16LE(1, 0);
  extra.writeUInt16LE(16, 2);
  extra.writeBigUInt64LE(BigInt(fileSize), 4);
  extra.writeBigUInt64LE(BigInt(fileSize), 12);
  return extra;
}
function writeXorSingleFileZipToFdSync(sourcePath, zipEntryName, outFd, key) {
  const stat = fs.statSync(sourcePath);
  const fileSize = stat.size;
  const crc = computeFileCrc32Sync(sourcePath);
  const nameBuffer = Buffer.from(zipEntryName, "utf-8");
  const zip64Extra = createZip64SizeExtra(fileSize);
  const { dosTime, dosDate } = getDosDateTime(stat.mtime);
  let total = 0;
  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(67324752, 0);
  localHeader.writeUInt16LE(45, 4);
  localHeader.writeUInt16LE(2048, 6);
  localHeader.writeUInt16LE(0, 8);
  localHeader.writeUInt16LE(dosTime, 10);
  localHeader.writeUInt16LE(dosDate, 12);
  localHeader.writeUInt32LE(crc, 14);
  localHeader.writeUInt32LE(4294967295, 18);
  localHeader.writeUInt32LE(4294967295, 22);
  localHeader.writeUInt16LE(nameBuffer.length, 26);
  localHeader.writeUInt16LE(zip64Extra.length, 28);
  total += writeXorBufferToFdSync(localHeader, outFd, key, total);
  total += writeXorBufferToFdSync(nameBuffer, outFd, key, total);
  total += writeXorBufferToFdSync(zip64Extra, outFd, key, total);
  const inFd = fs.openSync(sourcePath, "r");
  const fileBuffer = Buffer.alloc(4 * 1024 * 1024);
  try {
    while (true) {
      const bytesRead = fs.readSync(inFd, fileBuffer, 0, fileBuffer.length, null);
      if (bytesRead <= 0) break;
      const chunk = Buffer.from(fileBuffer.subarray(0, bytesRead));
      total += writeXorBufferToFdSync(chunk, outFd, key, total);
    }
  } finally {
    fs.closeSync(inFd);
  }
  const centralDirOffset = total;
  const centralHeader = Buffer.alloc(46);
  centralHeader.writeUInt32LE(33639248, 0);
  centralHeader.writeUInt16LE(45, 4);
  centralHeader.writeUInt16LE(45, 6);
  centralHeader.writeUInt16LE(2048, 8);
  centralHeader.writeUInt16LE(0, 10);
  centralHeader.writeUInt16LE(dosTime, 12);
  centralHeader.writeUInt16LE(dosDate, 14);
  centralHeader.writeUInt32LE(crc, 16);
  centralHeader.writeUInt32LE(4294967295, 20);
  centralHeader.writeUInt32LE(4294967295, 24);
  centralHeader.writeUInt16LE(nameBuffer.length, 28);
  centralHeader.writeUInt16LE(zip64Extra.length, 30);
  centralHeader.writeUInt16LE(0, 32);
  centralHeader.writeUInt16LE(0, 34);
  centralHeader.writeUInt16LE(0, 36);
  centralHeader.writeUInt32LE(32, 38);
  centralHeader.writeUInt32LE(0, 42);
  total += writeXorBufferToFdSync(centralHeader, outFd, key, total);
  total += writeXorBufferToFdSync(nameBuffer, outFd, key, total);
  total += writeXorBufferToFdSync(zip64Extra, outFd, key, total);
  const centralDirSize = total - centralDirOffset;
  const zip64EocdOffset = total;
  const zip64Eocd = Buffer.alloc(56);
  zip64Eocd.writeUInt32LE(101075792, 0);
  zip64Eocd.writeBigUInt64LE(BigInt(44), 4);
  zip64Eocd.writeUInt16LE(45, 12);
  zip64Eocd.writeUInt16LE(45, 14);
  zip64Eocd.writeUInt32LE(0, 16);
  zip64Eocd.writeUInt32LE(0, 20);
  zip64Eocd.writeBigUInt64LE(BigInt(1), 24);
  zip64Eocd.writeBigUInt64LE(BigInt(1), 32);
  zip64Eocd.writeBigUInt64LE(BigInt(centralDirSize), 40);
  zip64Eocd.writeBigUInt64LE(BigInt(centralDirOffset), 48);
  total += writeXorBufferToFdSync(zip64Eocd, outFd, key, total);
  const zip64Locator = Buffer.alloc(20);
  zip64Locator.writeUInt32LE(117853008, 0);
  zip64Locator.writeUInt32LE(0, 4);
  zip64Locator.writeBigUInt64LE(BigInt(zip64EocdOffset), 8);
  zip64Locator.writeUInt32LE(1, 16);
  total += writeXorBufferToFdSync(zip64Locator, outFd, key, total);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(101010256, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(Math.min(centralDirSize, 4294967295), 12);
  eocd.writeUInt32LE(centralDirOffset > 4294967295 ? 4294967295 : centralDirOffset, 16);
  eocd.writeUInt16LE(0, 20);
  total += writeXorBufferToFdSync(eocd, outFd, key, total);
  return total;
}
function getDirectoryStatsSync(dirPath) {
  const stack = [dirPath];
  let size = 0;
  let files = 0;
  while (stack.length) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch (_) {
      continue;
    }
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      try {
        if (entry.isDirectory()) {
          stack.push(fullPath);
        } else if (entry.isFile()) {
          const stat = fs.statSync(fullPath);
          size += stat.size;
          files += 1;
        }
      } catch (_) {
      }
    }
  }
  return { size, files };
}
function getMp4FilesFromDir(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  return fs.readdirSync(dirPath).filter((fileName) => fileName.toLowerCase().endsWith(".mp4")).map((fileName) => path.join(dirPath, fileName));
}
function pickExportEncryptVideo(modStats) {
  const useLongVideo = (modStats?.size || 0) >= EXPORT_ENCRYPT_LONG_VIDEO_THRESHOLD;
  const preferredDir = useLongVideo ? EXPORT_ENCRYPT_LONG_VIDEO_DIR : EXPORT_ENCRYPT_VIDEO_DIR;
  let videos = getMp4FilesFromDir(preferredDir);
  let selectedDir = preferredDir;
  if (!videos.length && useLongVideo) {
    videos = getMp4FilesFromDir(EXPORT_ENCRYPT_VIDEO_DIR);
    selectedDir = EXPORT_ENCRYPT_VIDEO_DIR;
  }
  if (!videos.length) return { videoPath: null, useLongVideo, selectedDir: null };
  return {
    videoPath: videos[Math.floor(Math.random() * videos.length)],
    useLongVideo,
    selectedDir
  };
}
function run7zSync(sevenZipPath, args, timeout = 30 * 60 * 1e3, cwd = void 0) {
  try {
    child_process.execFileSync(sevenZipPath, args, {
      cwd,
      timeout,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"]
    });
  } catch (error) {
    const stderr = error.stderr ? iconv.decode(error.stderr, "gbk").trim() : "";
    const stdout = error.stdout ? iconv.decode(error.stdout, "gbk").trim() : "";
    throw new Error(`7-Zip 打包失败: ${stderr || stdout || error.message}`);
  }
}
function getEncryptedExportArchiveSource(modPath) {
  const baseName = path.basename(modPath);
  if (baseName.toLowerCase() === "mods") {
    return {
      cwd: path.dirname(modPath),
      include: baseName,
      preserveRoot: true
    };
  }
  return {
    cwd: modPath,
    include: "*",
    preserveRoot: false
  };
}
function isDisguisedMp4(filePath) {
  try {
    if (findDisguiseMagic(filePath) >= 0) return true;
    try {
      const zip = new AdmZip(filePath);
      const entries = zip.getEntries();
      if (entries.some((e) => e.entryName.endsWith(".7z"))) return true;
    } catch (_) {
    }
    try {
      const sevenZipPath = get7zaPath();
      const output = child_process.execFileSync(sevenZipPath, ["l", "-slt", filePath], {
        timeout: 1e4,
        encoding: "utf-8",
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"]
      });
      // Only archive entries count; the listing header contains the input filename.
      return parse7zSltPaths(output).some((entry) => entry.endsWith(".7z"));
    } catch (_) {
      return false;
    }
  } catch (_) {
    return false;
  }
}
function peekDisguisedModName(filePath) {
  try {
    const sevenZipPath = get7zaPath();
    const { execSync } = require("child_process");
    let workFile = filePath;
    let tmpXorZip = null;
    let tmpDir = null;
    const magicOff = findDisguiseMagic(filePath);
    if (magicOff >= 0) {
      const storedEntryName = peekStoredOuterZipEntryNameFromDisguise(filePath);
      if (storedEntryName?.toLowerCase().endsWith(".7z")) {
        return path.basename(storedEntryName).replace(/\.7z$/i, "");
      }
      tmpDir = ensureTempRootNearPath(filePath, `.qaqm-peek-${Date.now()}`);
      tmpXorZip = decodeV2ToTempZip(filePath, tmpDir);
      if (!tmpXorZip) return null;
      workFile = tmpXorZip;
    }
    const outerOutput = execSync(`"${sevenZipPath}" l "${workFile}"`, {
      timeout: 1e4,
      encoding: "utf-8",
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"]
    });
    if (!tmpDir) tmpDir = ensureTempRootNearPath(filePath, `.qaqm-peek-${Date.now()}`);
    try {
      execSync(`"${sevenZipPath}" x "${workFile}" -o"${tmpDir}" -y -aoa`, {
        timeout: 15e3,
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"]
      });
      const files = fs.readdirSync(tmpDir);
      const sevenzFile = files.find((f) => f.endsWith(".7z"));
      if (!sevenzFile) return null;
      const sevenzPath = path.join(tmpDir, sevenzFile);
      const innerOutput = execSync(`"${sevenZipPath}" l "${sevenzPath}" -p${DISGUISE_PASSWORD}`, {
        timeout: 1e4,
        encoding: "utf-8",
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"]
      });
      const zipMatch = innerOutput.match(/(\S+\.zip)\s*$/m);
      if (zipMatch) {
        const realName = zipMatch[1].replace(/\.zip$/i, "");
        logger.info(
          `[Disguise] Peeked real mod name: "${realName}" from ${path.basename(filePath)}`
        );
        return realName;
      }
    } finally {
      if (tmpDir)
        try {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch (_) {
        }
      if (tmpXorZip)
        try {
          fs.unlinkSync(tmpXorZip);
        } catch (_) {
        }
    }
  } catch (e) {
    logger.warn(`[Disguise] peekDisguisedModName failed: ${e.message}`);
  }
  return null;
}
async function extractDisguisedMp4(mp4Path, targetPath, { onProgress = null } = {}) {
  const sevenZipPath = get7zaPath();
  logger.info(`[Disguise] Extracting disguised MP4: ${mp4Path}`);
  emitDisguiseProgress(onProgress, {
    status: "running",
    stage: "prepare",
    message: "正在准备解密缓存..."
  });
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
  }
  const tmpDir = ensureTempRootNearPath(targetPath, `.qaqm-disguise-${Date.now()}`);
  let workFile = mp4Path;
  let tmpXorZip = null;
  let sevenzPath = null;
  let sevenzName = null;
  const magicOff = findDisguiseMagic(mp4Path);
  if (magicOff >= 0) {
    logger.info(`[Disguise] Detected v2 XOR format (magic at offset ${magicOff}), decoding...`);
    emitDisguiseProgress(onProgress, {
      status: "running",
      stage: "detect",
      message: "已识别加密 MP4，正在读取外层数据..."
    });
    const directOuterEntry = await tryExtractStoredOuterZipEntryFromDisguiseAsync(mp4Path, tmpDir, onProgress);
    if (directOuterEntry) {
      sevenzPath = directOuterEntry.sevenzPath;
      sevenzName = directOuterEntry.sevenzName;
      logger.info(`[Disguise] Extracted outer ZIP entry directly: ${sevenzPath}`);
    } else {
      tmpXorZip = await decodeV2ToTempZipAsync(mp4Path, tmpDir, onProgress);
      if (!tmpXorZip) throw new Error("v2 XOR 解码失败");
      workFile = tmpXorZip;
      logger.info(`[Disguise] XOR decoded to: ${tmpXorZip}`);
    }
  }
  try {
    if (!sevenzPath) {
      logger.info("[Disguise] Step 1: Extract outer ZIP layer with 7z");
      emitDisguiseProgress(onProgress, {
        status: "running",
        stage: "extract-outer",
        message: "正在解压外层数据..."
      });
      const outerArgs = ["x", workFile, `-o${tmpDir}`, "-y", "-aoa"];
      const outerResult = await spawnExtract(sevenZipPath, outerArgs);
      if (outerResult.code !== 0) {
        if (isDiskSpaceError(outerResult)) {
          throw new Error(
            `外层 ZIP 解压失败：磁盘空间不足。请将导入缓存/Mods 目录放到剩余空间更大的磁盘，或释放当前磁盘空间。7z(code ${outerResult.code})`
          );
        }
        if (magicOff >= 0) {
          logger.info("[Disguise] Outer ZIP layer not found, trying direct encrypted 7z payload");
          sevenzPath = workFile;
          sevenzName = path.basename(workFile);
        } else {
          logger.info("[Disguise] 7z failed for outer layer, trying AdmZip fallback");
          try {
            const outerZip = new AdmZip(workFile);
            outerZip.extractAllTo(tmpDir, true);
          } catch (admErr) {
            throw new Error(
              `外层 ZIP 解压失败: 7z(code ${outerResult.code}), AdmZip(${admErr.message})`
            );
          }
        }
      } else if (tmpXorZip) {
        try {
          fs.unlinkSync(tmpXorZip);
        } catch (_) {
        }
        tmpXorZip = null;
      }
    }
    if (!sevenzPath) {
      const tmpFiles = fs.readdirSync(tmpDir);
      sevenzName = tmpFiles.find((f) => f.endsWith(".7z"));
      if (!sevenzName) {
        throw new Error(`伪装文件中未找到 .7z 文件 (解压得到: ${tmpFiles.join(", ")})`);
      }
      sevenzPath = path.join(tmpDir, sevenzName);
    }
    logger.info(`[Disguise] Found encrypted: ${sevenzName}`);
    emitDisguiseProgress(onProgress, {
      status: "running",
      stage: "list-inner",
      message: "正在检查加密包内容..."
    });
    const listResult = await spawnExtract(sevenZipPath, [
      "l",
      "-slt",
      sevenzPath,
      `-p${DISGUISE_PASSWORD}`
    ]);
    if (listResult.code !== 0) {
      throw new Error(
        `7z 列表读取失败 (code ${listResult.code}): ${listResult.stderr || listResult.stdout}`
      );
    }
    const listedPaths = parse7zSltPaths(listResult.stdout);
    const innerZipPathInArchive = listedPaths.find((f) => f.toLowerCase().endsWith(".zip"));
    const innerDir = innerZipPathInArchive ? path.join(tmpDir, "_inner") : targetPath;
    fs.mkdirSync(innerDir, { recursive: true });
    logger.info("[Disguise] Step 2: Decrypt 7z with password");
    emitDisguiseProgress(onProgress, {
      status: "running",
      stage: "decrypt-7z",
      message: "正在解密 7z 内容，大文件可能需要等待..."
    });
    const args7z = ["x", sevenzPath, `-o${innerDir}`, `-p${DISGUISE_PASSWORD}`, "-y", "-aoa"];
    const result7z = await spawnExtract(sevenZipPath, args7z);
    if (result7z.code !== 0) {
      throw new Error(`7z 解密失败 (code ${result7z.code}): ${result7z.stderr || result7z.stdout}`);
    }
    if (!innerZipPathInArchive) {
      logger.info("[Disguise] Step 3: No inner ZIP, extracted files directly");
      flattenSingleSubfolder(targetPath);
      emitDisguiseProgress(onProgress, {
        status: "running",
        stage: "detect-package",
        message: "正在检测是否为整合包..."
      });
      const fileCount2 = fs.readdirSync(targetPath).length;
      logger.info(`[Disguise] Extraction complete: ${fileCount2} items in ${targetPath}`);
      assertDirectoryHasAnyFile(targetPath, "Disguised mod");
      emitDisguiseProgress(onProgress, {
        status: "done",
        stage: "done",
        message: "解密完成"
      });
      return null;
    }
    const innerFiles = fs.readdirSync(innerDir);
    const innerZipName = innerFiles.find((f) => f.endsWith(".zip"));
    if (innerZipName) {
      logger.info(`[Disguise] Step 3: Extract inner ZIP: ${innerZipName}`);
      emitDisguiseProgress(onProgress, {
        status: "running",
        stage: "extract-inner",
        message: `正在解压内层文件：${innerZipName}`
      });
      const innerZipPath = path.join(innerDir, innerZipName);
      const innerArgs = ["x", innerZipPath, `-o${targetPath}`, "-y", "-aoa"];
      const innerResult = await spawnExtract(sevenZipPath, innerArgs);
      if (innerResult.code !== 0) {
        try {
          const innerZip = new AdmZip(innerZipPath);
          innerZip.extractAllTo(targetPath, true);
        } catch (e) {
          throw new Error(`内层 ZIP 解压失败: ${e.message}`);
        }
      }
    } else {
      logger.info("[Disguise] Step 3: No inner ZIP, copying files directly");
      for (const item of innerFiles) {
        const src = path.join(innerDir, item);
        const dest = path.join(targetPath, item);
        if (fs.statSync(src).isDirectory()) {
          fs.cpSync(src, dest, { recursive: true });
        } else {
          fs.copyFileSync(src, dest);
        }
      }
    }
    flattenSingleSubfolder(targetPath);
    emitDisguiseProgress(onProgress, {
      status: "running",
      stage: "detect-package",
      message: "正在检测是否为整合包..."
    });
    const fileCount = fs.readdirSync(targetPath).length;
    logger.info(`[Disguise] Extraction complete: ${fileCount} items in ${targetPath}`);
    assertDirectoryHasAnyFile(targetPath, "Disguised mod");
    emitDisguiseProgress(onProgress, {
      status: "done",
      stage: "done",
      message: "解密完成"
    });
    return innerZipName ? innerZipName.replace(/\.zip$/i, "") : null;
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (_) {
    }
    if (tmpXorZip)
      try {
        fs.unlinkSync(tmpXorZip);
      } catch (_) {
      }
  }
}
async function extractArchiveWithExternalTool(archivePath, targetPath) {
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
  }
  const sevenZipPath = get7zaPath();
  const ext = path.extname(archivePath).toLowerCase();
  logger.info(`Extracting archive: ${archivePath}`);
  logger.info(`Target path: ${targetPath}`);
  if (ext === ".exe") {
    const unrarExe = getUnrarPath();
    if (unrarExe) {
      logger.info(`EXE SFX detected, using UnRAR: ${unrarExe}`);
      const argsUnrar = ["x", "-y", archivePath, targetPath + path.sep];
      const resultUnrar = await spawnExtract(unrarExe, argsUnrar);
      logger.info(`UnRAR exit code: ${resultUnrar.code}`);
      if (resultUnrar.code === 0) {
        flattenSingleSubfolder(targetPath);
        return;
      }
      throw new Error(
        `UnRAR 解压失败 (code ${resultUnrar.code}): ${resultUnrar.stderr || resultUnrar.stdout}`
      );
    }
    throw new Error("无法解压 EXE 自解压包：未找到 UnRAR.exe（应随客户端一并安装）");
  }
  const args7z = ["x", archivePath, `-o${targetPath}`, "-y", "-aoa"];
  logger.info(`Trying 7zip: ${sevenZipPath}`);
  const result7z = await spawnExtract(sevenZipPath, args7z);
  logger.info(`7z exit code: ${result7z.code}`);
  if (result7z.code === 0) {
    flattenSingleSubfolder(targetPath);
    return;
  }
  if (isBandizipAvailable()) {
    logger.info(`7zip failed (code ${result7z.code}), trying Bandizip fallback`);
    const argsBz = ["x", archivePath, `-o:${targetPath}`, "-y", "-aoa"];
    const resultBz = await spawnExtract(BANDIZIP_PATH, argsBz);
    logger.info(`Bandizip exit code: ${resultBz.code}`);
    if (resultBz.code === 0) {
      flattenSingleSubfolder(targetPath);
      return;
    }
    throw new Error(
      `解压失败：7zip(code ${result7z.code}) 和 Bandizip(code ${resultBz.code}) 均无法处理此文件`
    );
  }
  throw new Error(`7z exited with code ${result7z.code}: ${result7z.stderr || result7z.stdout}`);
}
async function extract7zOrRar(archivePath, targetPath) {
  return extractArchiveWithExternalTool(archivePath, targetPath);
}
function getAvailableModFolderName(characterPath, preferredName) {
  const baseName = assertSafeAppearancePathSegment(
    String(preferredName || "Mod").trim() || "Mod",
    "Mod 名称"
  );
  for (let index = 0; index < 1e3; index++) {
    const candidateName = index === 0 ? baseName : `${baseName} (${index})`;
    const enabledPath = path.join(characterPath, candidateName);
    const disabledPath = path.join(characterPath, `DISABLED_${candidateName}`);
    if (!fs.existsSync(enabledPath) && !fs.existsSync(disabledPath)) {
      return {
        name: candidateName,
        path: enabledPath,
        duplicate: index > 0,
        duplicateOf: baseName
      };
    }
  }
  throw new Error(`同名 Mod 过多，无法为「${baseName}」生成可用名称`);
}
function listMultiModChildren(sourceRoot) {
  const stats = getMultiModPackageStats(sourceRoot);
  if (!stats.candidate) return [];
  try {
    return fs.readdirSync(sourceRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory() && !entry.name.startsWith(".")).map((entry) => ({
      name: entry.name.replace(/^DISABLED_/i, "") || "Mod",
      sourcePath: path.join(sourceRoot, entry.name)
    })).filter((entry) => directoryHasAnyFile(entry.sourcePath));
  } catch (_) {
    return [];
  }
}
function installMultipleModsFromRoot(sourceRoot, characterPath, { moveSource = false } = {}) {
  const children = listMultiModChildren(sourceRoot);
  if (children.length < 2) {
    throw new Error("Multiple Mod install requires at least two non-empty folders");
  }
  const installed = [];
  for (const child of children) {
    const availableTarget = getAvailableModFolderName(characterPath, child.name);
    if (moveSource) {
      moveDirectoryWithFallback(child.sourcePath, availableTarget.path);
    } else {
      fs.cpSync(child.sourcePath, availableTarget.path, { recursive: true });
    }
    installed.push({
      modName: path.basename(availableTarget.path),
      sourcePath: child.sourcePath,
      targetPath: availableTarget.path,
      duplicate: availableTarget.duplicate,
      duplicateOf: availableTarget.duplicateOf
    });
  }
  return installed;
}
async function importModFromLocalPath({
  characterName,
  filePath,
  modInfo = {},
  gameIdOverride = null,
  allowDuplicateRename = false,
  installAsIntegratedPackage = false,
  appearanceSectionId = null,
  characterSkinId = null
}) {
  let targetPath = null;
  try {
    const gameId2 = gameIdOverride || getActiveGameScopeId();
    const appearanceRequest = {
      ...modInfo,
      ...appearanceSectionId ? { appearanceSectionId } : {},
      ...characterSkinId ? { characterSkinId } : {}
    };
    if (isNevernessGame(gameId2)) {
      const pakDetection = await detectNevernessDx12PakSource(filePath);
      if (pakDetection.isPak) {
        setNevernessModMode("dx12");
        return await importNevernessDx12PakMod(characterName, filePath, appearanceRequest, {
          allowDuplicateRename,
          gameId: gameId2
        });
      }
      setNevernessModMode("nemi");
    }
    organizeLegacyCharacterFoldersIfNeeded(gameId2);
    const installTarget = resolveCanonicalCharacterInstallTarget(characterName, gameId2);
    const canonicalCharacterName = installTarget.characterName || characterName;
    const charPath = installTarget.characterPath;
    if (!charPath) {
      return { error: "Character folder not found" };
    }
    const cleanModName = assertSafeAppearancePathSegment(
      String(modInfo.name || path.basename(filePath, path.extname(filePath))).trim().replace(/^DISABLED_/i, ""),
      "Mod 名称"
    );
    const availableTarget = getAvailableModFolderName(charPath, cleanModName);
    targetPath = availableTarget.path;
    const disabledPath = path.join(charPath, `DISABLED_${cleanModName}`);
    if (!allowDuplicateRename && (fs.existsSync(path.join(charPath, cleanModName)) || fs.existsSync(disabledPath))) {
      return { error: "Mod with this name already exists" };
    }
    logger.info(`Adding mod: ${availableTarget.name} to ${canonicalCharacterName}`);
    logger.info(`Source file: ${filePath}`);
    const ext = path.extname(filePath).toLowerCase();
    const sourceStat = fs.statSync(filePath);
    const disguised = sourceStat.isFile() && isDisguisedMp4(filePath);
    if (disguised) {
      logger.info("[Disguise] Detected disguised MP4 mod, extracting with decryption...");
      const realModName = await extractDisguisedMp4(filePath, targetPath);
      logger.info(
        `[Disguise] realModName="${realModName}", cleanModName="${availableTarget.name}", targetPath="${targetPath}"`
      );
      if (realModName && realModName !== path.basename(targetPath)) {
        const realTarget = getAvailableModFolderName(charPath, realModName);
        const realTargetPath = realTarget.path;
        const realDisabledPath = path.join(charPath, `DISABLED_${realModName}`);
        logger.info(
          `[Disguise] Checking rename: realTargetPath="${realTargetPath}" exists=${fs.existsSync(realTargetPath)}, disabledExists=${fs.existsSync(realDisabledPath)}`
        );
        if (allowDuplicateRename || !fs.existsSync(realTargetPath) && !fs.existsSync(realDisabledPath)) {
          try {
            fs.renameSync(targetPath, realTargetPath);
            targetPath = realTargetPath;
            logger.info(`[Disguise] ✅ Renamed "${availableTarget.name}" → "${realTarget.name}"`);
            availableTarget.name = realTarget.name;
            availableTarget.path = realTarget.path;
            availableTarget.duplicate = realTarget.duplicate;
            availableTarget.duplicateOf = realTarget.duplicateOf;
          } catch (renameErr) {
            logger.warn(`[Disguise] Could not rename to ${realModName}: ${renameErr.message}`);
          }
        } else {
          logger.info(
            `[Disguise] Real name "${realModName}" already exists, keeping "${cleanModName}"`
          );
        }
      } else if (!realModName) {
        logger.warn(
          "[Disguise] No real mod name detected from inner ZIP — folder will keep numeric name"
        );
      }
    } else if (ext === ".zip") {
      logger.info("Extracting ZIP file with external archive tool");
      await extractArchiveWithExternalTool(filePath, targetPath);
    } else if (ext === ".rar" || ext === ".7z") {
      logger.info(`Extracting ${ext.toUpperCase()} file with 7zip`);
      await extractArchiveWithExternalTool(filePath, targetPath);
    } else if (ext === ".mp4") {
      return { error: "此 MP4 文件不是伪装的 Mod 压缩包" };
    } else if (sourceStat.isDirectory()) {
      logger.info("Copying directory");
      fs.cpSync(filePath, targetPath, { recursive: true });
    } else {
      return { error: "Unsupported file format. Please use Zip, Rar, 7z, or disguised MP4." };
    }
    if (installAsIntegratedPackage) {
      const integratedResult = await installIntegratedModsPackageIfPresent(targetPath, {
        cleanupSource: true,
        gameId: gameId2,
        appearanceRequest,
        appearanceCharacterName: canonicalCharacterName
      });
      if (integratedResult?.success) {
        targetPath = null;
        try {
          const env = resolveActiveGameEnvRoot(gameId2);
          if (env?.root && isPersistBridgeEnabled(gameId2)) {
            for (const modDir of integratedResult.installedModDirs || []) {
              ensurePersistBridgeMigrationForModDir(env.root, modDir);
            }
          }
          if (gameId2 === getActiveGameScopeId()) await ensureKeypressBridgeForActiveGame();
        } catch (e) {
          logger.warn("Failed to refresh persist bridge after adding integrated package:", e?.message || e);
        }
        return {
          ...integratedResult,
          gameId: gameId2
        };
      }
    }
    assertDirectoryHasAnyFile(targetPath, "Mod import");
    logger.info(`Mod added successfully: ${targetPath}`);
    const restoredBakCount = restorePersistBakFiles(targetPath);
    if (restoredBakCount > 0) {
      logger.info(`Restored ${restoredBakCount} .qaqm-persistbak file(s) in ${targetPath}`);
    }
    try {
      const env = resolveActiveGameEnvRoot(gameId2);
      if (env?.root && isPersistBridgeEnabled(gameId2))
        ensurePersistBridgeMigrationForModDir(env.root, targetPath);
      if (gameId2 === getActiveGameScopeId()) await ensureKeypressBridgeForActiveGame();
    } catch (e) {
      logger.warn("Failed to refresh persist bridge after adding mod:", e?.message || e);
    }
    const appearance = assignInstalledModAppearance({
      characterName: canonicalCharacterName,
      modName: path.basename(targetPath),
      modDir: targetPath,
      requested: appearanceRequest,
      gameId: gameId2,
      source: extractRequestedAppearanceTarget(appearanceRequest).sectionId || extractRequestedAppearanceTarget(appearanceRequest).skinId ? "explicit-install" : "name-match"
    });
    clearConflictCache(canonicalCharacterName, gameId2);
    notifyCharacterListChanged(canonicalCharacterName, {
      modName: path.basename(targetPath),
      reason: "mod-import"
    });
    return {
      success: true,
      modMode: "d3d",
      characterName: canonicalCharacterName,
      modName: path.basename(targetPath),
      targetPath,
      appearanceSectionId: appearance.sectionId,
      renamedDueToDuplicate: availableTarget.duplicate,
      duplicateOf: availableTarget.duplicate ? availableTarget.duplicateOf : null
    };
  } catch (error) {
    logger.error("add-mod error:", error);
    if (targetPath) {
      try {
        fs.rmSync(targetPath, { recursive: true, force: true });
      } catch (_) {
      }
    }
    return {
      error: formatWindowsFileOperationError(error, { path: targetPath, operation: "add-mod" })
    };
  }
}
electron.ipcMain.handle("add-mod", async (_, payload) => importModFromLocalPath(payload || {}));
function sanitizeDownloadFileName(value, fallback = "market-mod.7z") {
  const raw = String(value || "").trim() || fallback;
  return raw.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").slice(0, 180) || fallback;
}
const marketDownloadControls = /* @__PURE__ */ new Map();
function createMarketDownloadControl(taskId, sender) {
  const control = {
    taskId,
    sender,
    paused: false,
    canceled: false,
    abortController: null,
    waiters: [],
    lastProgress: null,
    lastActiveStatus: "downloading"
  };
  marketDownloadControls.set(taskId, control);
  return control;
}
function sendMarketDownloadProgress(sender, taskId, payload = {}, control = null) {
  const progress = { taskId, ...payload };
  if (control) {
    control.sender = sender;
    control.lastProgress = { ...control.lastProgress || {}, ...progress };
    if (progress.status && progress.status !== "paused") control.lastActiveStatus = progress.status;
  }
  sender.send("market:download-progress", progress);
}
async function waitForMarketDownloadResume(control) {
  while (control?.paused) {
    await new Promise((resolve) => control.waiters.push(resolve));
  }
  if (control?.canceled) {
    const error = new Error("下载已取消");
    error.code = "DOWNLOAD_CANCELED";
    throw error;
  }
}
function resumeMarketDownloadControl(control) {
  if (!control) return;
  control.paused = false;
  const waiters = control.waiters.splice(0);
  waiters.forEach((resolve) => resolve());
}
async function revealDownloadedArchive(archivePath) {
  const targetPath = String(archivePath || "").trim();
  if (!targetPath) return { success: false, error: "压缩包路径为空" };
  if (!fs.existsSync(targetPath)) return { success: false, error: "压缩包不存在或已被移动" };
  const stat = fs.statSync(targetPath);
  if (stat.isFile()) {
    electron.shell.showItemInFolder(targetPath);
    return { success: true };
  }
  const openError = await electron.shell.openPath(targetPath);
  if (openError) return { success: false, error: openError };
  return { success: true };
}
electron.ipcMain.handle("market:get-download-settings", async () => {
  try {
    return getMarketDownloadSettingsForRenderer();
  } catch (error) {
    return { success: false, error: error?.message || String(error) };
  }
});
electron.ipcMain.handle("market:select-download-cache-dir", async () => {
  try {
    const currentDir = getMarketDownloadCacheDir();
    const options = {
      title: "选择下载缓存目录",
      defaultPath: currentDir,
      properties: ["openDirectory", "createDirectory"]
    };
    const result = mainWindowRef && !mainWindowRef.isDestroyed() ? await electron.dialog.showOpenDialog(mainWindowRef, options) : await electron.dialog.showOpenDialog(options);
    if (result.canceled || !result.filePaths?.[0]) {
      return { ...getMarketDownloadSettingsForRenderer(), canceled: true };
    }
    const cacheDir = result.filePaths[0];
    probeWritableDirectory(cacheDir, "下载缓存目录");
    saveMarketDownloadSettings({ ...loadMarketDownloadSettings(), cacheDir });
    return getMarketDownloadSettingsForRenderer();
  } catch (error) {
    return { success: false, error: error?.message || String(error) };
  }
});
electron.ipcMain.handle("market:reset-download-cache-dir", async () => {
  try {
    const settings = loadMarketDownloadSettings();
    delete settings.cacheDir;
    saveMarketDownloadSettings(settings);
    return getMarketDownloadSettingsForRenderer();
  } catch (error) {
    return { success: false, error: error?.message || String(error) };
  }
});
electron.ipcMain.handle("market:download-control", async (event, payload = {}) => {
  try {
    const taskId = String(payload.taskId || "");
    const action = String(payload.action || "");
    const control = marketDownloadControls.get(taskId);
    if (!taskId || !control) {
      return { success: false, error: "任务已结束，无法控制" };
    }
    if (action === "pause") {
      control.paused = true;
      sendMarketDownloadProgress(
        event.sender,
        taskId,
        { ...control.lastProgress || {}, status: "paused" },
        control
      );
      return { success: true, paused: true };
    }
    if (action === "resume") {
      resumeMarketDownloadControl(control);
      sendMarketDownloadProgress(
        event.sender,
        taskId,
        {
          ...control.lastProgress || {},
          status: control.lastActiveStatus === "paused" ? "downloading" : control.lastActiveStatus
        },
        control
      );
      return { success: true, paused: false };
    }
    if (action === "cancel") {
      control.canceled = true;
      resumeMarketDownloadControl(control);
      try {
        control.abortController?.abort();
      } catch (_) {
      }
      sendMarketDownloadProgress(
        event.sender,
        taskId,
        { ...control.lastProgress || {}, status: "canceled", error: "下载已取消" },
        control
      );
      return { success: true, canceled: true };
    }
    return { success: false, error: "未知下载控制指令" };
  } catch (error) {
    return { success: false, error: error?.message || String(error) };
  }
});
electron.ipcMain.handle("market:open-downloaded-archive-folder", async (_, payload = {}) => {
  try {
    return await revealDownloadedArchive(payload.archivePath);
  } catch (error) {
    return { success: false, error: error?.message || String(error) };
  }
});
async function fetchMarketDownloadResponse(url, abortController2, options = {}) {
  const requestOptions = {
    signal: abortController2.signal,
    headers: options.headers || {}
  };
  return (options.fetch || fetchWithElectronNet)(url, requestOptions);
}
function getMarketDownloadResumePath(downloadDir, fileName, download = {}) {
  const identity = String(download.sha256 || download.objectKey || download.modId || download.url || fileName);
  const key = crypto.createHash("sha256").update(identity).digest("hex").slice(0, 16);
  return path.join(downloadDir, `${key}-${fileName}`);
}
function parseContentRangeTotal(value) {
  const match = String(value || "").match(/\/(\d+|\*)\s*$/);
  if (!match || match[1] === "*") return 0;
  const total = Number(match[1]);
  return Number.isFinite(total) ? total : 0;
}
const MARKET_DOWNLOAD_STALL_TIMEOUT_MS = 15 * 1e3;
function readMarketDownloadChunk(reader, abortController2) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        abortController2.abort();
      } catch (_) {
      }
      const error = new Error("默认通道长时间没有收到数据");
      error.code = "DOWNLOAD_STALLED";
      reject(error);
    }, MARKET_DOWNLOAD_STALL_TIMEOUT_MS);
    reader.read().then(
      (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(result);
      },
      (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}
async function downloadMarketFile(event, taskId, download, control = null, fetchImpl = fetchWithElectronNet) {
  const fileName = sanitizeDownloadFileName(download?.fileName);
  const downloadDir = ensureMarketDownloadCacheDir();
  fs.mkdirSync(downloadDir, { recursive: true });
  const targetPath = getMarketDownloadResumePath(downloadDir, fileName, download);
  const abortController2 = new AbortController();
  if (control) control.abortController = abortController2;
  let writer = null;
  let reader = null;
  try {
    await waitForMarketDownloadResume(control);
    let existingSize = 0;
    try {
      if (fs.existsSync(targetPath)) {
        const stat = fs.statSync(targetPath);
        if (stat.isFile()) existingSize = stat.size;
      }
    } catch (_) {
      existingSize = 0;
    }
    const expectedTotal = Number(download.fileSize || 0) || 0;
    if (expectedTotal > 0 && existingSize > expectedTotal) {
      try {
        fs.unlinkSync(targetPath);
      } catch (_) {
      }
      existingSize = 0;
    }
    const headers = existingSize > 0 ? { Range: `bytes=${existingSize}-` } : {};
    let response = await fetchMarketDownloadResponse(download.url, abortController2, { headers, fetch: fetchImpl });
    const rangeSatisfiedTotal = parseContentRangeTotal(response.headers.get("content-range"));
    const completedTotal = expectedTotal || rangeSatisfiedTotal;
    if (response.status === 416 && existingSize > 0 && completedTotal > 0 && existingSize >= completedTotal) {
      const existingHash = download.sha256 ? await hashFileForIntegrity(targetPath) : "";
      if (!download.sha256 || existingHash.toLowerCase() === String(download.sha256).toLowerCase()) {
        sendMarketDownloadProgress(
          event.sender,
          taskId,
          {
            status: "downloaded",
            downloaded: existingSize,
            total: completedTotal,
            percent: 100,
            speed: 0,
            fileName,
            archivePath: targetPath,
            resumedBytes: existingSize
          },
          control
        );
        return targetPath;
      }
      fs.unlinkSync(targetPath);
      existingSize = 0;
      response = await fetchMarketDownloadResponse(download.url, abortController2, { headers: {}, fetch: fetchImpl });
    }
    if (existingSize > 0 && response.status !== 206) {
      try {
        await response.body?.cancel?.();
      } catch (_) {
      }
      try {
        fs.unlinkSync(targetPath);
      } catch (_) {
      }
      existingSize = 0;
      response = await fetchMarketDownloadResponse(download.url, abortController2, { headers: {}, fetch: fetchImpl });
    }
    if (!response.ok || !response.body) {
      throw new Error(`下载失败：HTTP ${response.status}`);
    }
    if (download.rejectHtml && /text\/html|application\/xhtml/i.test(response.headers.get('content-type') || '')) {
      await response.body.cancel();
      throw new Error('文件服务器返回了网页，附件未下载，请稍后重试');
    }
    const contentLength = Number(response.headers.get("content-length") || 0) || 0;
    const rangeTotal = parseContentRangeTotal(response.headers.get("content-range"));
    const total = expectedTotal || rangeTotal || existingSize + contentLength || 0;
    const append = existingSize > 0 && response.status === 206;
    writer = fs.createWriteStream(targetPath, {
      flags: append ? "a" : "w",
      highWaterMark: 4 * 1024 * 1024
    });
    const finished = new Promise((resolve, reject) => {
      writer.once("finish", resolve);
      writer.once("error", reject);
    });
    reader = response.body.getReader();
    let downloaded = existingSize;
    let sessionDownloaded = 0;
    let lastEmit = 0;
    const startedAt = Date.now();
    const emit = (extra = {}) => {
      sendMarketDownloadProgress(
        event.sender,
        taskId,
        {
          status: "downloading",
          downloaded,
          total,
          percent: total > 0 ? Math.min(100, Math.round(downloaded / total * 100)) : 0,
          speed: sessionDownloaded / Math.max(1, (Date.now() - startedAt) / 1e3),
          downloadMode: "direct",
          limited: download.limited === true,
          resumedBytes: existingSize,
          ...extra
        },
        control
      );
    };
    emit({ fileName });
    while (true) {
      await waitForMarketDownloadResume(control);
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = Buffer.from(value);
      downloaded += chunk.length;
      sessionDownloaded += chunk.length;
      if (!writer.write(chunk)) {
        await new Promise((resolve) => writer.once("drain", resolve));
      }
      const now = Date.now();
      if (now - lastEmit > 350) {
        lastEmit = now;
        emit();
      }
    }
    writer.end();
    await finished;
    const sha256 = download.sha256 ? await hashFileForIntegrity(targetPath) : "";
    if (download.sha256 && sha256.toLowerCase() !== String(download.sha256).toLowerCase()) {
      try {
        fs.unlinkSync(targetPath);
      } catch (_) {
      }
      throw new Error("文件校验失败，请稍后重试");
    }
    sendMarketDownloadProgress(
      event.sender,
      taskId,
      {
        status: "downloaded",
        downloaded,
        total: total || downloaded,
        percent: 100,
        speed: sessionDownloaded / Math.max(1, (Date.now() - startedAt) / 1e3),
        downloadMode: "direct",
        limited: download.limited === true,
        fileName,
        archivePath: targetPath,
        resumedBytes: existingSize
      },
      control
    );
    return targetPath;
  } catch (error) {
    try {
      await reader?.cancel?.();
    } catch (_) {
    }
    try {
      writer?.destroy?.();
    } catch (_) {
    }
    if (control?.canceled || error?.name === "AbortError" || error?.code === "DOWNLOAD_CANCELED") {
      try {
        if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
      } catch (_) {
      }
      const canceledError = new Error("下载已取消");
      canceledError.code = "DOWNLOAD_CANCELED";
      throw canceledError;
    }
    throw error;
  } finally {
    if (control?.abortController === abortController2) control.abortController = null;
  }
}
archiveDownloadManager = registerArchiveDownloads({
  ipcMain: electron.ipcMain, app: electron.app, BrowserWindow: electron.BrowserWindow,
  userData: localProfile, services: { pawchive: pawchiveService, kemono: kemonoService,
    ...Object.fromEntries(['gamebanana', 'arca', 'loverslab', 'huiyue', 'keke'].map(source => [source, { getPost: ref => modSiteContent.getPost({ ...ref, source }) }])) },
  getCacheDir: ensureMarketDownloadCacheDir, openSource: () => { throw Error('请回到该来源的详情卡片重新下载；需要登录时将在页面内验证。'); },
  transfer: async (task, onProgress) => {
    const sender = { send: (_channel, progress) => onProgress(progress) };
    const control = createMarketDownloadControl(task.taskId, sender);
    try { return await downloadMarketFile({ sender }, task.taskId, task.download, control,
      ['gamebanana', 'arca', 'loverslab', 'huiyue', 'keke'].includes(task.source) ? (...args) => siteSessions.fetch(task.source, ...args) : fetchWithElectronNet); }
    finally { marketDownloadControls.delete(task.taskId); }
  },
  controlTransfer: (taskId, action) => {
    const control = marketDownloadControls.get(taskId);
    if (!control) return;
    if (action === 'pause') control.paused = true;
    if (action === 'resume') resumeMarketDownloadControl(control);
    if (action === 'cancel') { control.canceled = true; resumeMarketDownloadControl(control); control.abortController?.abort(); }
  },
  openFile: file => electron.shell.showItemInFolder(file)
});
function formatMarketDownloadError(code, message) {
  const raw = String(message || "").trim();
  if (code === "LOGIN_REQUIRED" || code === "SESSION_EXPIRED") {
    return "该下载源需要账号登录，当前版本未提供登录入口。请使用 Mod 提供的外部下载链接。";
  }
  if (code === "DIRECT_DOWNLOAD_REQUIRED" || code === "SPONSOR_REQUIRED" || /全部档|最高档|高速下载|直链下载|赞助|QAQM Plus/.test(raw)) {
    return "该下载源暂不可用。请使用 Mod 提供的外部下载链接。";
  }
  return raw || "无法获取下载链接";
}
async function installMarketArchiveFromPath({ archivePath, mod, taskId, sender, control = null }) {
  const sourcePath = String(archivePath || "").trim();
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    const message = "已下载压缩包不存在或已被移动";
    sendMarketDownloadProgress(
      sender,
      taskId,
      {
        status: "error",
        code: "ARCHIVE_MISSING",
        error: message,
        archivePath: sourcePath || null,
        name: mod?.name || "Mod 安装",
        characterName: mod?.characterName || null,
        gameId: mod?.gameId || null,
        mod,
        percent: 100
      },
      control
    );
    return { success: false, code: "ARCHIVE_MISSING", taskId, error: message, archivePath: sourcePath || null, mod };
  }
  const appearanceTarget = extractRequestedAppearanceTarget(mod);
  const installResult = await importModFromLocalPath({
    characterName: mod?.characterName,
    filePath: sourcePath,
    modInfo: {
      ...mod,
      name: mod?.name || path.basename(sourcePath, path.extname(sourcePath))
    },
    gameIdOverride: mod?.gameId || null,
    allowDuplicateRename: true,
    installAsIntegratedPackage: shouldInstallMarketModAsIntegratedPackage(mod),
    appearanceSectionId: appearanceTarget.sectionId || null,
    characterSkinId: appearanceTarget.skinId || null
  });
  if (!installResult?.success) {
    const message = installResult?.error || "安装失败";
    sendMarketDownloadProgress(
      sender,
      taskId,
      {
        status: "error",
        code: "INSTALL_FAILED",
        error: message,
        archivePath: sourcePath,
        archiveFileName: path.basename(sourcePath),
        name: mod?.name || path.basename(sourcePath, path.extname(sourcePath)),
        characterName: mod?.characterName || null,
        gameId: mod?.gameId || null,
        mod,
        percent: 100
      },
      control
    );
    return {
      success: false,
      code: "INSTALL_FAILED",
      taskId,
      error: message,
      archivePath: sourcePath,
      archiveFileName: path.basename(sourcePath),
      mod
    };
  }
  try {
    fs.unlinkSync(sourcePath);
  } catch (_) {
  }
  return { success: true, taskId, ...installResult };
}
function marketModHasIntegratedPackageTag(mod = {}) {
  const values = [];
  const collect = (value) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(collect);
      return;
    }
    if (typeof value === "object") {
      collect(value.name || value.label || value.title || value.value);
      return;
    }
    values.push(String(value).trim().toLowerCase());
  };
  collect(mod.tags);
  collect(mod.tagNames);
  collect(mod.tagList);
  collect(mod.categories);
  return values.some(
    (value) => /整合包|合集|integrated[\s_-]*package|mod[\s_-]*pack/.test(value)
  );
}
function shouldInstallMarketModAsIntegratedPackage(mod = {}) {
  return !!(mod.integratedPackage || mod.isIntegratedPackage || mod.installAsIntegratedPackage || mod.modMode === "integrated" || mod.installMode === "integrated" || marketModHasIntegratedPackageTag(mod));
}
function withCandidateAuthorization(headers, authToken) {
  const next = {};
  if (headers && typeof headers.forEach === "function") {
    headers.forEach((value, key) => {
      if (String(key).toLowerCase() !== "authorization") next[key] = value;
    });
  } else {
    for (const [key, value] of Object.entries(headers || {})) {
      if (String(key).toLowerCase() !== "authorization") next[key] = value;
    }
  }
  if (authToken) next.Authorization = `Bearer ${authToken}`;
  return next;
}
async function fetchDirectInstallUrlWithFallback(serverUrl, modId, options, authContext = {}) {
  const requestPath = `/api/mods/${modId}/install-url`;
  let lastError = null;
  const rawAuthToken = String(authContext.authToken || "").trim();
  const candidates = getQaqmServerCandidates(serverUrl, { secureOnly: Boolean(rawAuthToken) });
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    try {
      console.log(`[QAQM Fallback][main] 尝试 install-url: ${candidate}${requestPath}`);
      const candidateAuthToken = resolveMarketAuthToken({
        authToken: rawAuthToken,
        authServerUrl: authContext.authServerUrl,
        targetServerUrl: candidate
      });
      const candidateOptions = {
        ...options,
        headers: withCandidateAuthorization(options?.headers, candidateAuthToken)
      };
      const timed = createTimedFetchOptions(candidateOptions);
      const prepared = prepareFallbackJsonRequest(candidate, requestPath, timed.options);
      const response = await fetchWithElectronNet(`${candidate}${requestPath}`, prepared).finally(
        timed.cleanup
      );
      if (response.status >= 500 && candidate !== BARE_FALLBACK_SERVER_URL) {
        lastError = new Error(`服务器返回错误: ${response.status}`);
        console.warn(`[QAQM Fallback][main] ${candidate} 返回 ${response.status}，切换下一个候选`);
        continue;
      }
      console.log(`[QAQM Fallback][main] 命中 install-url 服务器: ${candidate}`);
      return { response, serverUrl: candidate };
    } catch (error) {
      if (options.signal?.aborted) throw error;
      lastError = error?.name === "AbortError" ? new Error("请求超时") : error;
      console.warn(`[QAQM Fallback][main] ${candidate} 请求失败: ${error?.message || error}`);
    }
  }
  throw lastError || new Error("所有候选服务器均不可达");
}
electron.ipcMain.handle("market:download-install-mod", async (event, payload = {}) => {
  const taskId = payload.taskId || crypto.randomUUID();
  let tempPath = null;
  const control = createMarketDownloadControl(taskId, event.sender);
  try {
    const serverUrl = normalizeServerUrlInput(
      payload.serverUrl || currentConfig.serverUrl || DEFAULT_SERVER_URL
    ).replace(/\/$/, "");
    const authToken = String(payload.authToken || "").trim();
    const authServerUrl = String(payload.authServerUrl || "").trim();
    const mod = payload.mod || {};
    if (!serverUrl || !mod.id) {
      sendMarketDownloadProgress(
        event.sender,
        taskId,
        { status: "error", error: "缺少 Mod 下载信息" },
        control
      );
      return { success: false, taskId, code: "INVALID_MOD", error: "缺少 Mod 下载信息" };
    }
    if (!authToken || !authServerUrl) {
      sendMarketDownloadProgress(
        event.sender,
        taskId,
        { status: "error", error: "请先登录 QAQ 账号" },
        control
      );
      return { success: false, taskId, code: "LOGIN_REQUIRED", error: "请先登录 QAQ 账号" };
    }
    sendMarketDownloadProgress(
      event.sender,
      taskId,
      {
        status: "checking",
        modId: mod.id,
        name: mod.name,
        characterName: mod.characterName,
        gameId: mod.gameId
      },
      control
    );
    control.abortController = new AbortController();
    const installUrlResult = await fetchDirectInstallUrlWithFallback(serverUrl, mod.id, {
      method: "POST",
      signal: control.abortController.signal,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        channel: "client",
        clientId: payload.clientId || null,
        source: "r2-direct-install",
        entry: "desktop_market",
        scene: payload.scene || "market_card",
        gameId: mod.gameId || null,
        modMode: mod.modMode || "d3d"
      })
    }, { authToken, authServerUrl });
    const installUrlRes = installUrlResult.response;
    control.abortController = null;
    if (control.canceled) {
      const canceledError = new Error("下载已取消");
      canceledError.code = "DOWNLOAD_CANCELED";
      throw canceledError;
    }
    const data = await installUrlRes.json().catch(() => ({}));
    if (!installUrlRes.ok || !data.success || !data.download?.url) {
      const code = data.code || (installUrlRes.status === 401 ? "LOGIN_REQUIRED" : "DOWNLOAD_DENIED");
      const errorMessage = formatMarketDownloadError(code, data.error);
      sendMarketDownloadProgress(event.sender, taskId, { status: "error", error: errorMessage }, control);
      return {
        success: false,
        taskId,
        code,
        error: errorMessage
      };
    }
    tempPath = await downloadMarketFile(
      event,
      taskId,
      { ...data.download, modId: mod.id, authToken },
      control
    );
    const installMod = {
      ...mod,
      ...data.mod || {},
      name: mod.name || data.mod?.name || path.basename(tempPath, path.extname(tempPath)),
      characterName: data.mod?.characterName || mod.characterName,
      gameId: data.mod?.gameId || mod.gameId || null
    };
    sendMarketDownloadProgress(
      event.sender,
      taskId,
      {
        status: "installing",
        percent: 100,
        archivePath: tempPath,
        archiveFileName: path.basename(tempPath),
        mod: installMod
      },
      control
    );
    const archivePath = tempPath;
    tempPath = null;
    let installResult = null;
    try {
      installResult = await installMarketArchiveFromPath({
        archivePath,
        mod: installMod,
        taskId,
        sender: event.sender,
        control
      });
    } catch (installError) {
      const message = installError?.message || String(installError);
      sendMarketDownloadProgress(
        event.sender,
        taskId,
        {
          status: "error",
          code: "INSTALL_FAILED",
          error: message,
          archivePath,
          archiveFileName: path.basename(archivePath),
          name: installMod.name,
          characterName: installMod.characterName || null,
          gameId: installMod.gameId || null,
          mod: installMod,
          percent: 100
        },
        control
      );
      return {
        success: false,
        taskId,
        code: "INSTALL_FAILED",
        error: message,
        archivePath,
        archiveFileName: path.basename(archivePath),
        mod: installMod
      };
    }
    if (!installResult?.success) return installResult;
    sendMarketDownloadProgress(
      event.sender,
      taskId,
      {
        status: "completed",
        percent: 100,
        modName: installResult.modName,
        characterName: installResult.characterName,
        gameId: data.mod?.gameId || mod.gameId || null,
        renamedDueToDuplicate: !!installResult.renamedDueToDuplicate,
        duplicateOf: installResult.duplicateOf || null,
        integratedPackage: !!installResult.integratedPackage,
        modMode: installResult.modMode || null,
        modCount: installResult.modCount || 0,
        characterCount: installResult.characterCount || 0,
        copiedFiles: installResult.copiedFiles || 0,
        targetModsDir: installResult.targetModsDir || null,
        appearanceSectionId: installResult.appearanceSectionId || null
      },
      control
    );
    return { success: true, taskId, ...installResult };
  } catch (error) {
    if (tempPath) {
      try {
        fs.unlinkSync(tempPath);
      } catch (_) {
      }
    }
    if (control.canceled || error?.name === "AbortError" || error?.code === "DOWNLOAD_CANCELED") {
      sendMarketDownloadProgress(
        event.sender,
        taskId,
        { status: "canceled", error: "下载已取消" },
        control
      );
      return {
        success: false,
        taskId,
        code: "DOWNLOAD_CANCELED",
        canceled: true,
        error: "下载已取消"
      };
    }
    const message = error?.message || String(error);
    const code = isNetworkDownloadFailure(error) ? "NETWORK_FETCH_FAILED" : error?.code || "DOWNLOAD_FAILED";
    sendMarketDownloadProgress(
      event.sender,
      taskId,
      { status: "error", code, error: message },
      control
    );
    return { success: false, taskId, code, error: message };
  } finally {
    resumeMarketDownloadControl(control);
    marketDownloadControls.delete(taskId);
  }
});
electron.ipcMain.handle("market:retry-install-downloaded-mod", async (event, payload = {}) => {
  const taskId = payload.taskId || crypto.randomUUID();
  const control = createMarketDownloadControl(taskId, event.sender);
  try {
    const archivePath = String(payload.archivePath || "").trim();
    const mod = payload.mod || {};
    sendMarketDownloadProgress(
      event.sender,
      taskId,
      {
        status: "installing",
        percent: 100,
        archivePath,
        archiveFileName: archivePath ? path.basename(archivePath) : "",
        name: mod.name || (archivePath ? path.basename(archivePath, path.extname(archivePath)) : "Mod 安装"),
        characterName: mod.characterName || null,
        gameId: mod.gameId || null,
        mod
      },
      control
    );
    const installResult = await installMarketArchiveFromPath({
      archivePath,
      mod,
      taskId,
      sender: event.sender,
      control
    });
    if (!installResult?.success) return installResult;
    sendMarketDownloadProgress(
      event.sender,
      taskId,
      {
        status: "completed",
        percent: 100,
        modName: installResult.modName,
        characterName: installResult.characterName,
        gameId: installResult.gameId || mod.gameId || null,
        renamedDueToDuplicate: !!installResult.renamedDueToDuplicate,
        duplicateOf: installResult.duplicateOf || null,
        integratedPackage: !!installResult.integratedPackage,
        modMode: installResult.modMode || null,
        modCount: installResult.modCount || 0,
        characterCount: installResult.characterCount || 0,
        copiedFiles: installResult.copiedFiles || 0,
        targetModsDir: installResult.targetModsDir || null,
        appearanceSectionId: installResult.appearanceSectionId || null
      },
      control
    );
    return installResult;
  } catch (error) {
    const message = error?.message || String(error);
    sendMarketDownloadProgress(event.sender, taskId, { status: "error", error: message }, control);
    return { success: false, taskId, error: message };
  } finally {
    resumeMarketDownloadControl(control);
    marketDownloadControls.delete(taskId);
  }
});
electron.ipcMain.handle("add-character", async (_, { name, coverImagePath }) => {
  try {
    const gameId2 = getActiveGameScopeId();
    name = assertSafeAppearancePathSegment(name, "角色名称");
    let charPath;
    if (isNevernessDx12Mode(gameId2)) {
      ensureNevernessDx12GamePaths(gameId2);
      charPath = getNevernessDx12CharacterPath(name, { gameId: gameId2 });
    } else {
      const modsPathStatus = getModsPathStatus({ gameId: gameId2 });
      if (!modsPathStatus.ok) return { error: modsPathStatus.error, code: modsPathStatus.code };
      charPath = path.join(modsPathStatus.modsPath, name);
      if (!isPathInsideDirectory(charPath, modsPathStatus.modsPath)) {
        return { error: "角色目录路径无效" };
      }
    }
    if (resolveCharacterEntry(name, gameId2) || fs.existsSync(charPath)) {
      return { error: "Character already exists." };
    }
    fs.mkdirSync(charPath, { recursive: true });
    const infoPath = path.join(charPath, "info.json");
    const info = {
      name,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      description: ""
    };
    fs.writeFileSync(infoPath, JSON.stringify(info, null, 2));
    if (coverImagePath) {
      if (coverImagePath.startsWith("data:")) {
        const matches = coverImagePath.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const type = matches[1];
          const buffer = Buffer.from(matches[2], "base64");
          let ext = ".png";
          if (type === "image/jpeg") ext = ".jpg";
          else if (type === "image/gif") ext = ".gif";
          const targetCover = path.join(charPath, `_cover${ext}`);
          fs.writeFileSync(targetCover, buffer);
        }
      } else {
        const ext = path.extname(coverImagePath);
        const targetCover = path.join(charPath, `_cover${ext}`);
        fs.copyFileSync(coverImagePath, targetCover);
      }
    }
    clearConflictCache(name, gameId2);
    notifyCharacterListChanged(name, { reason: "character-created" });
    return { success: true };
  } catch (error) {
    console.error("add-character error:", error);
    return { error: error.message };
  }
});
electron.ipcMain.handle("delete-character", async (_, characterName) => {
  try {
    const gameId2 = getActiveGameScopeId();
    characterName = assertSafeAppearancePathSegment(characterName, "角色名称");
    let characterPaths = [];
    if (isNevernessDx12Mode(gameId2)) {
      const paths = getNevernessDx12Paths(gameId2);
      characterPaths = [
        getNevernessDx12CharacterPath(characterName, { gameId: gameId2 }),
        getNevernessDx12DisabledCharacterPath(characterName, paths, { gameId: gameId2 })
      ];
    } else {
      const modsPathStatus = getModsPathStatus({ gameId: gameId2 });
      if (!modsPathStatus.ok) {
        return { error: modsPathStatus.error, code: modsPathStatus.code };
      }
      characterPaths = [
        resolveCharacterPath(characterName, gameId2) || path.join(modsPathStatus.modsPath, characterName)
      ];
    }
    characterPaths = Array.from(new Set(characterPaths.filter(Boolean))).filter(
      (targetPath) => fs.existsSync(targetPath)
    );
    if (characterPaths.length === 0) {
      return { error: "Character not found" };
    }
    for (const targetPath of characterPaths) {
      await movePathToRecycleBin(targetPath, "delete character");
    }
    const scopedCharacterOrder = getScopedCharacterOrder();
    if (scopedCharacterOrder.includes(characterName)) {
      setScopedCharacterOrder(scopedCharacterOrder.filter((name) => name !== characterName));
    }
    if (currentConfig.pinnedMods) {
      const { key, value } = getCharacterConfigStoreValue(
        currentConfig.pinnedMods,
        characterName,
        [],
        gameId2
      );
      if (Array.isArray(value) && value.length > 0) {
        delete currentConfig.pinnedMods[key];
        saveConfig(currentConfig);
      }
    }
    if (getCustomAppearanceSections(characterName, gameId2).length > 0) {
      setCustomAppearanceSections(characterName, [], gameId2);
    }
    deletePersistedCharacterSkinCatalogIdentity(characterName, gameId2);
    const scopedCharacterImagesDir = getScopedCharacterImagesDir(characterName, gameId2);
    if (fs.existsSync(scopedCharacterImagesDir)) {
      try {
        await movePathToRecycleBin(scopedCharacterImagesDir, "delete character appearance covers");
      } catch (error) {
        logger.warn(
          `Failed to recycle character appearance covers for ${characterName}: ${error?.message || error}`
        );
      }
    }
    saveConfig(currentConfig);
    clearConflictCache(characterName, gameId2);
    notifyCharacterListChanged(characterName, { reason: "character-deleted" });
    logger.info(`Deleted character to Recycle Bin: ${characterName}`);
    return { success: true, recycled: true, recycledCount: characterPaths.length };
  } catch (error) {
    console.error("delete-character error:", error);
    return { error: error.message };
  }
});
electron.ipcMain.handle("rename-character", async (_, { oldName, newName }) => {
  try {
    if (!newName || !newName.trim()) return { error: "名称不能为空" };
    const gameId2 = getActiveGameScopeId();
    oldName = assertSafeAppearancePathSegment(oldName, "原角色名称");
    const trimmed = assertSafeAppearancePathSegment(newName, "新角色名称");
    if (trimmed === oldName) return { success: true };
    const previousCatalogEntry = getCharacterSkinCatalogEntry(oldName, gameId2);
    const previousCatalogIdentity = getPersistedCharacterSkinCatalogIdentity(oldName, gameId2) || previousCatalogEntry?.nameZh || previousCatalogEntry?.nameEn || previousCatalogEntry?.characterId || "";
    const resolvedEntry = resolveCharacterEntry(oldName, gameId2);
    const mappingEntry = getCharacterMappingEntry(oldName, gameId2);
    if (gameId2 === "wuthering-waves" && resolvedEntry?.diskName && mappingEntry) {
      return { error: "鸣潮映射角色不支持直接重命名目录，请保持 WWMI 英文角色目录结构。" };
    }
    let renamePairs = [];
    if (isNevernessDx12Mode(gameId2)) {
      const paths = getNevernessDx12Paths(gameId2);
      renamePairs = [
        {
          oldPath: getNevernessDx12CharacterPath(oldName, { gameId: gameId2 }),
          newPath: getNevernessDx12CharacterPath(trimmed, { gameId: gameId2 })
        },
        {
          oldPath: getNevernessDx12DisabledCharacterPath(oldName, paths, { gameId: gameId2 }),
          newPath: getNevernessDx12DisabledCharacterPath(trimmed, paths, { gameId: gameId2 })
        }
      ].filter((pair) => pair.oldPath && fs.existsSync(pair.oldPath));
    } else {
      const modsPathStatus = getModsPathStatus({ gameId: gameId2 });
      if (!modsPathStatus.ok) {
        return { error: modsPathStatus.error, code: modsPathStatus.code };
      }
      const { modsPath } = modsPathStatus;
      renamePairs = [
        {
          oldPath: resolveCharacterPath(oldName, gameId2) || path.join(modsPath, oldName),
          newPath: path.join(modsPath, trimmed)
        }
      ].filter((pair) => pair.oldPath && fs.existsSync(pair.oldPath));
    }
    if (renamePairs.length === 0) return { error: "角色不存在" };
    const conflictingPair = renamePairs.find((pair) => fs.existsSync(pair.newPath));
    if (conflictingPair) return { error: `角色 "${trimmed}" 已存在` };
    const characterSectionStore = getCharacterSectionGameStore(gameId2);
    const oldCharacterSectionEntry = getCharacterStoreEntry(
      characterSectionStore,
      oldName,
      gameId2
    );
    const renamedPairs = [];
    try {
      for (const pair of renamePairs) {
        fs.mkdirSync(path.dirname(pair.newPath), { recursive: true });
        fs.renameSync(pair.oldPath, pair.newPath);
        renamedPairs.push(pair);
      }
    } catch (error) {
      for (const pair of renamedPairs.reverse()) {
        try {
          if (fs.existsSync(pair.newPath) && !fs.existsSync(pair.oldPath)) {
            fs.renameSync(pair.newPath, pair.oldPath);
          }
        } catch (rollbackError) {
          logger.warn(
            `Failed to rollback character rename ${pair.newPath}: ${rollbackError?.message || rollbackError}`
          );
        }
      }
      throw error;
    }
    const scopedCharacterOrder = getScopedCharacterOrder();
    if (scopedCharacterOrder.length > 0) {
      if (!currentConfig.characterOrdersByGame || typeof currentConfig.characterOrdersByGame !== "object") {
        currentConfig.characterOrdersByGame = {};
      }
      currentConfig.characterOrdersByGame[gameId2] = scopedCharacterOrder.map(
        (c) => c === oldName ? trimmed : c
      );
      if (gameId2 === "endfield") {
        currentConfig.characterOrder = currentConfig.characterOrdersByGame[gameId2];
      }
    }
    if (currentConfig.modOrders) {
      const oldModOrder = getCharacterConfigStoreValue(
        currentConfig.modOrders,
        oldName,
        [],
        gameId2
      ).value;
      if (Array.isArray(oldModOrder) && oldModOrder.length > 0) {
        currentConfig.modOrders[trimmed] = oldModOrder;
        const oldModOrderEntry = getCharacterStoreEntry(currentConfig.modOrders, oldName, gameId2);
        delete currentConfig.modOrders[oldModOrderEntry.key];
      }
    }
    if (currentConfig.pinnedMods) {
      const oldPinnedMods = getCharacterConfigStoreValue(
        currentConfig.pinnedMods,
        oldName,
        [],
        gameId2
      ).value;
      if (Array.isArray(oldPinnedMods) && oldPinnedMods.length > 0) {
        currentConfig.pinnedMods[trimmed] = oldPinnedMods;
        const oldPinnedEntry = getCharacterStoreEntry(currentConfig.pinnedMods, oldName, gameId2);
        delete currentConfig.pinnedMods[oldPinnedEntry.key];
      }
    }
    if (currentConfig.characterUsage) {
      const oldUsageEntry = getCharacterStoreEntry(currentConfig.characterUsage, oldName, gameId2);
      if (oldUsageEntry.value !== void 0) {
        currentConfig.characterUsage[trimmed] = oldUsageEntry.value;
        delete currentConfig.characterUsage[oldUsageEntry.key];
      }
    }
    if (Array.isArray(oldCharacterSectionEntry.value)) {
      const writableSectionStore = getCharacterSectionGameStore(gameId2, { ensure: true });
      writableSectionStore[trimmed] = oldCharacterSectionEntry.value;
      if (oldCharacterSectionEntry.key && oldCharacterSectionEntry.key !== trimmed) {
        delete writableSectionStore[oldCharacterSectionEntry.key];
      }
    }
    const scopedOldImgDir = getScopedCharacterImagesDir(oldName, gameId2);
    const scopedNewImgDir = getScopedCharacterImagesDir(trimmed, gameId2);
    if (fs.existsSync(scopedOldImgDir) && !fs.existsSync(scopedNewImgDir)) {
      fs.mkdirSync(path.dirname(scopedNewImgDir), { recursive: true });
      fs.renameSync(scopedOldImgDir, scopedNewImgDir);
    }
    const legacyOldImgDir = path.join(IMAGES_PATH, oldName);
    const legacyNewImgDir = path.join(IMAGES_PATH, trimmed);
    if (fs.existsSync(legacyOldImgDir) && !fs.existsSync(legacyNewImgDir)) {
      fs.renameSync(legacyOldImgDir, legacyNewImgDir);
    }
    deletePersistedCharacterSkinCatalogIdentity(oldName, gameId2);
    if (previousCatalogIdentity) {
      setPersistedCharacterSkinCatalogIdentity(trimmed, previousCatalogIdentity, gameId2);
    }
    saveConfig(currentConfig);
    clearConflictCache(oldName, gameId2);
    clearConflictCache(trimmed, gameId2);
    notifyCharacterListChanged(trimmed, {
      reason: "character-renamed",
      previousCharacterName: oldName
    });
    console.log(`Renamed character: ${oldName} -> ${trimmed}`);
    return { success: true };
  } catch (error) {
    console.error("rename-character error:", error);
    return { error: error.message };
  }
});
electron.ipcMain.handle("set-character-cover", async (_, { characterName, imagePath }) => {
  try {
    const charImagesPath = getScopedCharacterImagesDir(characterName, getActiveGameScopeId());
    if (!fs.existsSync(charImagesPath)) {
      fs.mkdirSync(charImagesPath, { recursive: true });
    }
    let targetPath;
    let mimeType;
    let buffer;
    if (imagePath.startsWith("data:")) {
      const matches = imagePath.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        return { error: "Invalid data URL" };
      }
      mimeType = matches[1];
      buffer = Buffer.from(matches[2], "base64");
      let ext = ".png";
      if (mimeType === "image/jpeg") ext = ".jpg";
      else if (mimeType === "image/gif") ext = ".gif";
      else if (mimeType === "image/webp") ext = ".webp";
      targetPath = path.join(charImagesPath, `_cover${ext}`);
      fs.writeFileSync(targetPath, buffer);
    } else {
      if (!fs.existsSync(imagePath)) {
        return { error: "Image file not found" };
      }
      const ext = path.extname(imagePath).toLowerCase();
      targetPath = path.join(charImagesPath, `_cover${ext}`);
      buffer = fs.readFileSync(imagePath);
      fs.writeFileSync(targetPath, buffer);
      mimeType = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp"
      }[ext] || "image/jpeg";
    }
    console.log(`Character cover saved: ${targetPath}`);
    const base64 = buffer.toString("base64");
    const coverUrl = `data:${mimeType};base64,${base64}`;
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.webContents.send("covers-changed");
    }
    return { success: true, coverUrl };
  } catch (error) {
    console.error("set-character-cover error:", error);
    return { error: error.message };
  }
});
electron.ipcMain.handle("get-character-cover", async (_, characterName) => {
  try {
    const coverPath = findCharacterCoverFilePath(
      characterName,
      getActiveGameScopeId(),
      getModsPath()
    );
    if (coverPath && fs.existsSync(coverPath)) {
      const ext = path.extname(coverPath).toLowerCase();
      const mimeType = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp"
      }[ext] || "image/jpeg";
      const imageBuffer = fs.readFileSync(coverPath);
      const base64 = imageBuffer.toString("base64");
      const coverUrl = `data:${mimeType};base64,${base64}`;
      return { success: true, coverUrl };
    }
    return { success: true, coverUrl: null };
  } catch (error) {
    console.error("get-character-cover error:", error);
    return { error: error.message };
  }
});
const HOTKEYS_CACHE_PATH = path.join(electron.app.getPath("userData"), "hotkeys.json");
const MOD_PERSIST_STATE_PATH = path.join(electron.app.getPath("userData"), "mod-persist-state.json");
const MANAGED_PERSIST_BRIDGE_MODS = /* @__PURE__ */ new Set(["莱万汀/莱万汀-2B落体切换"]);
let hotkeysCache = {};
let modPersistState = { scopes: {} };
function loadModPersistState() {
  try {
    if (fs.existsSync(MOD_PERSIST_STATE_PATH)) {
      const data = fs.existsSync(MOD_PERSIST_STATE_PATH + ".copying")
        ? JSON.stringify(readJsonFileSync(MOD_PERSIST_STATE_PATH)) : fs.readFileSync(MOD_PERSIST_STATE_PATH, "utf-8");
      if (!data.trim()) {
        modPersistState = { scopes: {} };
        return;
      }
      const parsed = JSON.parse(data);
      modPersistState = parsed && typeof parsed === "object" ? parsed : { scopes: {} };
      if (!modPersistState.scopes || typeof modPersistState.scopes !== "object") {
        modPersistState.scopes = {};
      }
    }
  } catch (e) {
    console.error("Failed to load mod persist state:", e);
    modPersistState = { scopes: {} };
  }
}
loadModPersistState();
const persistManager = createPersistManager({
  userData: electron.app.getPath("userData"),
  getConfig: () => currentConfig, saveConfig, getGame: getSettingsGame, getModsPath,
  getLegacy: () => modPersistState, saveLegacy: saveModPersistState,
  migrateFiles: root => { migrateQaqmBridgeFilesToBridgeDir(root); migratePersistBridgeStateFilesToCacheDir(root); },
  getIniFiles, descriptor: buildPersistBridgeDescriptor, hostedFiles: extractHostedPersistStateFilesFromContent,
  resolveMod: (gameId, characterName, modName) => resolveExistingStandardModDirectory(characterName, modName, gameId),
  characterName: (gameId, name) => getCharacterMappingEntry(name, gameId)?.displayName || name,
  describeSource: (gameId, mods, ini) => {
    const parts = path.relative(mods, ini).split(path.sep);
    if (isLegacyCharacterContainerName(parts[0])) parts.shift();
    if (parts.length < 3) return {};
    return { characterName: getCharacterMappingEntry(parts[0], gameId)?.displayName || parts[0], modName: parts[1].replace(/^DISABLED_/i, ""), iniPath: parts.slice(2).join("/") };
  },
  parseDeclarations: parseLocalPersistDeclarations, sync: syncPersistBridgeStateForModDir,
  restoreBackups: restorePersistBakFiles, readConstants: readD3dxUserConstants, writeConstants: writeD3dxUserConstants,
  removeTracking: (root, names) => updateActivePersistBridgeIncludesIncremental(root, { removeStateFiles: names }),
  invalidate: root => { preparedPersistBridgeRoots.delete(root); preparedKeypressRoots.delete(root); }
});
function saveModPersistState() {
  try {
    writeJsonFileSync(MOD_PERSIST_STATE_PATH, modPersistState);
    return true;
  } catch (e) {
    console.error("Failed to save mod persist state:", e);
    throw e;
  }
}
function getModPersistScopeKey(gameId = getActiveGameScopeId()) {
  const activeGame = getGameById(gameId);
  if (activeGame?.id) return `game:${activeGame.id}`;
  const env = resolveActiveGameEnvRoot();
  if (env?.root) return `root:${env.root.toLowerCase()}`;
  const modsPath = getModsPath();
  if (modsPath) return `mods:${modsPath.toLowerCase()}`;
  return "__default__";
}
function getModPersistRecordKey(characterName, modName) {
  return `${characterName}/${modName}`;
}
function dirUsesManagedPersistBridge(modDirPath) {
  if (!modDirPath || !fs.existsSync(modDirPath)) return false;
  try {
    const iniFiles = getIniFiles(modDirPath);
    for (const iniPath of iniFiles) {
      try {
        const content = fs.readFileSync(iniPath, "utf-8");
        if (content.includes("$\\QAQM\\Persist\\") || /Persisted state is hosted by qaqm_state_/i.test(content)) {
          return true;
        }
      } catch (_) {
      }
    }
  } catch (_) {
  }
  return false;
}
function usesManagedPersistBridge(characterName, modName, gameId = getActiveGameScopeId()) {
  if (MANAGED_PERSIST_BRIDGE_MODS.has(getModPersistRecordKey(characterName, modName))) {
    return true;
  }
  const charPath = resolveCharacterPath(characterName, gameId);
  if (!charPath || !fs.existsSync(charPath)) return false;
  const candidatePaths = [path.join(charPath, modName), path.join(charPath, `DISABLED_${modName}`)];
  return candidatePaths.some((candidatePath) => dirUsesManagedPersistBridge(candidatePath));
}
function normalizeWindowsRelativePath(value) {
  return String(value || "").replace(/[\/]+/g, "\\").replace(/^\\+/, "");
}
function normalizeD3dxUserKey(value) {
  return normalizeWindowsRelativePath(value).toLowerCase();
}
function getD3dxUserIniPath() {
  const env = resolveActiveGameEnvRoot();
  if (!env) return null;
  return path.join(env.root, "d3dx_user.ini");
}
function readD3dxUserConstants(d3dxUserPath) {
  const defaultPrefixLines = [
    "; AUTOMATICALLY GENERATED FILE - DO NOT EDIT",
    ";",
    "; 3DMigoto will overwrite this file whenever any persistent settings are",
    '; altered by hot key or command list. Tag global variables with the "persist"',
    "; keyword to save them in this file. Use the post keyword in the [Constants]",
    "; command list if you need to do any intialisation after this file is loaded.",
    ";"
  ];
  if (!d3dxUserPath || !fs.existsSync(d3dxUserPath)) {
    return { prefixLines: defaultPrefixLines, constantsMap: /* @__PURE__ */ new Map(), suffixLines: [] };
  }
  const lines = fs.readFileSync(d3dxUserPath, "utf-8").split(/\r?\n/);
  const prefixLines = [];
  const suffixLines = [];
  const constantsMap = /* @__PURE__ */ new Map();
  let sawConstants = false;
  let inConstants = false;
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (/^\[Constants\]$/i.test(trimmed)) {
      sawConstants = true;
      inConstants = true;
      return;
    }
    if (inConstants && /^\[[^\]]+\]$/.test(trimmed)) {
      inConstants = false;
      suffixLines.push(line);
      return;
    }
    if (!sawConstants) {
      prefixLines.push(line);
      return;
    }
    if (inConstants) {
      if (!trimmed || trimmed.startsWith(";")) return;
      const assignmentMatch = line.match(/^\s*([^=]+?)\s*=\s*(.*?)\s*$/);
      if (!assignmentMatch) return;
      const rawKey = assignmentMatch[1].trim();
      const rawValue = assignmentMatch[2].trim();
      constantsMap.set(normalizeD3dxUserKey(rawKey), { key: rawKey, value: rawValue });
      return;
    }
    suffixLines.push(line);
  });
  return {
    prefixLines: prefixLines.length > 0 ? prefixLines : defaultPrefixLines,
    constantsMap,
    suffixLines
  };
}
function writeD3dxUserConstants(d3dxUserPath, constantsMap, prefixLines = [], suffixLines = []) {
  const lines = [];
  const cleanedPrefix = Array.isArray(prefixLines) ? prefixLines : [];
  const cleanedSuffix = Array.isArray(suffixLines) ? suffixLines : [];
  if (cleanedPrefix.length > 0) {
    lines.push(...cleanedPrefix);
  }
  if (lines.length > 0 && lines[lines.length - 1] !== "") {
    lines.push("");
  }
  lines.push("[Constants]");
  for (const entry of constantsMap.values()) {
    lines.push(`${entry.key} = ${entry.value}`);
  }
  if (cleanedSuffix.length > 0) {
    if (lines[lines.length - 1] !== "") {
      lines.push("");
    }
    lines.push(...cleanedSuffix);
  }
  const tempPath = `${d3dxUserPath}.tmp`;
  fs.writeFileSync(tempPath, `${lines.join("\n").replace(/\n+$/, "")}
`, "utf-8");
  if (fs.existsSync(d3dxUserPath)) {
    fs.unlinkSync(d3dxUserPath);
  }
  fs.renameSync(tempPath, d3dxUserPath);
}
function buildD3dxUserVariableKey(envRoot, iniPath, variableName) {
  const relPath = normalizeWindowsRelativePath(path.relative(envRoot, iniPath)).toLowerCase();
  const normalizedVarName = String(variableName || "").replace(/^\$/u, "").trim().toLowerCase();
  return normalizedVarName ? `$\\${relPath}\\${normalizedVarName}` : `$\\${relPath}`;
}
function restorePersistStateForMod(characterName, modName, modDirPath, gameId = getActiveGameScopeId()) {
  try {
    if (usesManagedPersistBridge(characterName, modName, gameId)) {
      return { restored: false, managed: true };
    }
    const env = resolveActiveGameEnvRoot(gameId);
    const d3dxUserPath = env && path.join(env.root, "d3dx_user.ini");
    if (!env || !d3dxUserPath || !fs.existsSync(modDirPath)) {
      return { restored: false };
    }
    const record = persistManager.legacyRecord(gameId, getModPersistRecordKey(characterName, modName));
    if (!record || !Array.isArray(record.files) || record.files.length === 0) {
      return { restored: false };
    }
    const { prefixLines, constantsMap, suffixLines } = readD3dxUserConstants(d3dxUserPath);
    let updated = false;
    record.files.forEach((fileRecord) => {
      if (!fileRecord?.relativeIniPath || !fileRecord.variables || typeof fileRecord.variables !== "object")
        return;
      const iniPath = path.join(modDirPath, fileRecord.relativeIniPath);
      if (!fs.existsSync(iniPath)) return;
      Object.entries(fileRecord.variables).forEach(([variableName, value]) => {
        const rawKey = buildD3dxUserVariableKey(env.root, iniPath, variableName);
        constantsMap.set(normalizeD3dxUserKey(rawKey), { key: rawKey, value: String(value) });
        updated = true;
      });
    });
    if (!updated) {
      return { restored: false };
    }
    writeD3dxUserConstants(d3dxUserPath, constantsMap, prefixLines, suffixLines);
    record.lastRestoredAt = (/* @__PURE__ */ new Date()).toISOString();
    saveModPersistState();
    return { restored: true };
  } catch (e) {
    logger.warn("Failed to restore mod persist state:", e?.message || e);
    return { restored: false, error: e?.message || String(e) };
  }
}
async function renameModDirectoryWithRetry(currentPath, newPath) {
  let lastError = null;
  const retryableCodes = /* @__PURE__ */ new Set(["EPERM", "EACCES", "EBUSY", "ENOTEMPTY"]);
  const retryDelays = [120, 220, 350, 500, 800, 1200, 1600, 2200];
  for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
    try {
      if (!fs.existsSync(currentPath) && fs.existsSync(newPath)) {
        return { success: true };
      }
      fs.renameSync(currentPath, newPath);
      return { success: true };
    } catch (e) {
      lastError = e;
      if (!retryableCodes.has(e?.code)) {
        throw e;
      }
      if (!fs.existsSync(currentPath) && fs.existsSync(newPath)) {
        return { success: true };
      }
      if (attempt < retryDelays.length) {
        await new Promise((resolve) => setTimeout(resolve, retryDelays[attempt]));
        continue;
      }
    }
  }
  const reason = lastError?.message || "Rename failed after retries";
  return {
    success: false,
    error: `文件夹当前可能被资源管理器、预览缩略图或其它进程占用，已自动重试多次仍失败。请关闭打开中的相关文件夹窗口后再试。原始错误：${reason}`
  };
}
function loadHotkeysCache() {
  try {
    if (fs.existsSync(HOTKEYS_CACHE_PATH)) {
      const data = fs.readFileSync(HOTKEYS_CACHE_PATH, "utf-8");
      if (!data.trim()) {
        hotkeysCache = {};
        saveHotkeysCache();
        return;
      }
      hotkeysCache = JSON.parse(data);
    }
  } catch (e) {
    console.error("Failed to load hotkeys cache:", e);
    hotkeysCache = {};
    try {
      saveHotkeysCache();
    } catch (_) {
    }
  }
}
loadHotkeysCache();
function saveHotkeysCache() {
  try {
    const tempPath = `${HOTKEYS_CACHE_PATH}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(hotkeysCache, null, 2));
    if (fs.existsSync(HOTKEYS_CACHE_PATH)) {
      fs.unlinkSync(HOTKEYS_CACHE_PATH);
    }
    fs.renameSync(tempPath, HOTKEYS_CACHE_PATH);
  } catch (e) {
    console.error("Failed to save hotkeys cache:", e);
  }
}
function getIniFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  files.forEach((entry) => {
    const filePath = path.join(dir, entry.name);
    const isDirectory = entry.isDirectory() || (entry.isSymbolicLink() && fs.statSync(filePath).isDirectory());
    if (isDirectory) {
      getIniFiles(filePath, fileList);
    } else {
      if (path.extname(entry.name).toLowerCase() === ".ini") {
        fileList.push(filePath);
      }
    }
  });
  return fileList;
}
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
const conflictCache = /* @__PURE__ */ new Map();
function clearConflictCache(characterName = null, gameId2 = getActiveGameScopeId()) {
  if (!characterName) {
    conflictCache.clear();
    return;
  }
  const resolvedPath = resolveCharacterPath(characterName, gameId2);
  if (resolvedPath) {
    conflictCache.delete(resolvedPath);
    return;
  }
  const modsPath = getModsPath();
  if (!modsPath) return;
  conflictCache.delete(path.join(modsPath, characterName));
}
function getConflictCacheSignature(charPath) {
  try {
    const modDirs = fs.readdirSync(charPath, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith("DISABLED_")).map((d) => {
      const modPath = path.join(charPath, d.name);
      let mtimeMs = 0;
      try {
        mtimeMs = Math.floor(fs.statSync(modPath).mtimeMs || 0);
      } catch (_) {
      }
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
  const modDirs = fs.readdirSync(charPath, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith("DISABLED_"));
  const hashMap = /* @__PURE__ */ new Map();
  for (const mod of modDirs) {
    const modPath = path.join(charPath, mod.name);
    const iniFiles = getIniFiles(modPath);
    for (const iniPath of iniFiles) {
      const hashes = extractHashesFromIni(iniPath);
      for (const hash of hashes) {
        if (!hashMap.has(hash)) {
          hashMap.set(hash, /* @__PURE__ */ new Set());
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
  conflictCache.set(charPath, { signature, conflicts });
  return conflicts;
}
electron.ipcMain.handle("detect-mod-conflicts", async (_, characterName) => {
  try {
    const modsPath = getModsPath();
    const gameId2 = getActiveGameScopeId();
    if (!modsPath || !fs.existsSync(modsPath)) {
      return { success: true, conflicts: [] };
    }
    organizeLegacyCharacterFoldersIfNeeded(gameId2);
    if (characterName) {
      const resolvedEntry = resolveCharacterEntry(characterName, gameId2);
      if (!resolvedEntry?.characterRootPath || !fs.existsSync(resolvedEntry.characterRootPath)) {
        return { success: true, conflicts: [] };
      }
      const conflicts = detectConflictsForCharacter(resolvedEntry.characterRootPath);
      return { success: true, conflicts, characterName: resolvedEntry.displayName };
    }
    const allConflicts = {};
    const characterEntries = listCharacterDirectories(modsPath, gameId2);
    for (const entry of characterEntries) {
      const conflicts = detectConflictsForCharacter(entry.characterRootPath);
      if (conflicts.length > 0) {
        allConflicts[entry.displayName] = conflicts;
      }
    }
    return { success: true, conflicts: allConflicts };
  } catch (error) {
    logger.error("detect-mod-conflicts error:", error);
    return { error: error.message };
  }
});
const HOTKEYS_CACHE_VERSION = 9;
function getHotkeyExpressionSemanticKey(expression) {
  const parsed = parseHotkeyExpression(expression);
  const normalizeTokens = (tokens) => (Array.isArray(tokens) ? tokens : []).map((token) => `${String(token?.device || "")}:${String(token?.code || "")}`).filter((token) => token !== ":").sort();
  return JSON.stringify({
    pressed: normalizeTokens(parsed.pressed),
    released: normalizeTokens(parsed.released),
    unsupported: (Array.isArray(parsed.unsupportedTokens) ? parsed.unsupportedTokens : []).map((token) => String(token || "").trim().replace(/\s+/g, " ").toUpperCase()).filter(Boolean).sort()
  });
}
function getHotkeySemanticKey(hotkey) {
  const expressions = Array.isArray(hotkey?.rawKeys) ? hotkey.rawKeys : [];
  return [
    ...new Set(
      expressions.map((expression) => getHotkeyExpressionSemanticKey(expression)).filter(Boolean)
    )
  ].sort().join("|");
}
function dedupeHotkeysBySemanticBinding(hotkeys) {
  const deduped = [];
  const seen = /* @__PURE__ */ new Map();
  for (const hotkey of Array.isArray(hotkeys) ? hotkeys : []) {
    const semanticKey = getHotkeySemanticKey(hotkey);
    if (!semanticKey) {
      deduped.push(hotkey);
      continue;
    }
    const existing = seen.get(semanticKey);
    if (!existing) {
      const first = {
        ...hotkey,
        duplicateCount: 1,
        sections: hotkey?.section ? [hotkey.section] : [],
        descriptions: hotkey?.description ? [hotkey.description] : []
      };
      seen.set(semanticKey, first);
      deduped.push(first);
      continue;
    }
    existing.duplicateCount += 1;
    if (hotkey?.section && !existing.sections.includes(hotkey.section)) {
      existing.sections.push(hotkey.section);
    }
    if (hotkey?.description && !existing.descriptions.includes(hotkey.description)) {
      existing.descriptions.push(hotkey.description);
    }
    if (hotkey?.isMenu && !existing.isMenu) {
      existing.section = hotkey.section;
      existing.keys = hotkey.keys;
      existing.rawKeys = hotkey.rawKeys;
      existing.description = hotkey.description;
      existing.isMenu = true;
      existing.canApply = hotkey.canApply;
      existing.applyPayload = hotkey.applyPayload;
      existing.alternatives = hotkey.alternatives;
    }
  }
  return deduped;
}
function parseIniForHotkeys(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split(/\r?\n/);
  const hotkeys = [];
  let currentSection = null;
  let currentKeyExpressions = [];
  let currentDesc = null;
  let isKeySection = false;
  const sectionRegex = /^\[Key(.*?)\]$/i;
  const anySectionRegex = /^\[(.*?)\]$/;
  const keyRegex = /^key\s*=\s*(.*)$/i;
  const varRegex = /\$(\w+)\s*=/;
  const flushCurrentSection = () => {
    if (!isKeySection || currentKeyExpressions.length === 0) return;
    const expressions = [];
    const seenExpressions = /* @__PURE__ */ new Set();
    for (const item of currentKeyExpressions) {
      const expression = String(item || "").trim();
      if (!expression) continue;
      const semanticKey = getHotkeyExpressionSemanticKey(expression);
      if (seenExpressions.has(semanticKey)) continue;
      seenExpressions.add(semanticKey);
      expressions.push(expression);
    }
    if (expressions.length === 0) return;
    const alternatives = expressions.map(parseHotkeyExpression).filter(Boolean);
    const preferred = pickPreferredHotkeyAlternative(alternatives);
    const preferredIndex = preferred ? alternatives.findIndex((item) => item === preferred) : -1;
    const descriptionBase = currentDesc || currentSection;
    const descLower = String(descriptionBase || "").toLowerCase();
    const isMenu = descLower === "menu";
    hotkeys.push({
      section: currentSection,
      keys: preferred && preferred.displayKeys.length > 0 ? [...preferred.displayKeys] : [],
      rawKeys: expressions,
      description: isMenu ? "菜单" : descriptionBase,
      isMenu,
      canApply: !!(preferred && preferred.canAutoApply),
      applyPayload: preferred ? buildHotkeyApplyPayloadFromAlternative(preferred) : null,
      alternatives: alternatives.map((alternative, index) => ({
        original: alternative.original,
        displayKeys: alternative.displayKeys.length > 0 ? [...alternative.displayKeys] : [alternative.original],
        label: alternative.displayLabel,
        canApply: !!alternative.canAutoApply,
        isPreferred: index === preferredIndex
      }))
    });
  };
  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line || line.startsWith(";")) return;
    const anySectionMatch = line.match(anySectionRegex);
    if (anySectionMatch) {
      flushCurrentSection();
      const sectionMatch = line.match(sectionRegex);
      if (!sectionMatch) {
        isKeySection = false;
        currentSection = null;
        currentKeyExpressions = [];
        currentDesc = null;
        return;
      }
      const fullSectionName = sectionMatch[1];
      currentSection = fullSectionName;
      isKeySection = true;
      currentKeyExpressions = [];
      let niceName = fullSectionName;
      if (niceName.startsWith("_")) niceName = niceName.substring(1);
      currentDesc = niceName;
      return;
    }
    if (!isKeySection) return;
    const keyMatch = line.match(keyRegex);
    if (keyMatch) {
      const keyExpression = keyMatch[1].trim();
      if (keyExpression) currentKeyExpressions.push(keyExpression);
    }
    const varMatch = line.match(varRegex);
    if (varMatch) {
      const varName = varMatch[1];
      if (!["active", "active0", "active1", "pressed", "hold"].includes(varName.toLowerCase())) {
        currentDesc = varName;
      }
    }
  });
  flushCurrentSection();
  return hotkeys;
}
electron.ipcMain.handle("get-mod-details", async (_, { characterName, modName, refresh = false }) => {
  try {
    const gameId2 = getActiveGameScopeId();
    if (isNevernessDx12Mode(gameId2)) {
      const paths = getNevernessDx12Paths();
      const charPath2 = getNevernessDx12CharacterPath(characterName, { ensure: true }) || resolveCharacterPath(characterName, gameId2);
      if (!charPath2) return { error: "Character folder not found" };
      const disabledCharPath = getNevernessDx12DisabledCharacterPath(characterName, paths);
      const candidates = [
        path.join(charPath2, modName),
        path.join(charPath2, `DISABLED_${modName}`),
        disabledCharPath ? path.join(disabledCharPath, modName) : "",
        disabledCharPath ? path.join(disabledCharPath, `DISABLED_${modName}`) : ""
      ].filter(Boolean);
      const modPath2 = candidates.find((candidate) => fs.existsSync(candidate));
      let imagePath2 = null;
      if (modPath2 && fs.existsSync(modPath2)) {
        imagePath2 = findModPreviewImageFile(modPath2);
      }
      let previewUrl2 = null;
      if (imagePath2 && fs.existsSync(imagePath2)) {
        const ext = path.extname(imagePath2).toLowerCase();
        const mimeType = {
          ".jpg": "image/jpeg",
          ".jpeg": "image/jpeg",
          ".png": "image/png",
          ".gif": "image/gif",
          ".webp": "image/webp"
        }[ext] || "image/jpeg";
        const imageBuffer = fs.readFileSync(imagePath2);
        previewUrl2 = `data:${mimeType};base64,${imageBuffer.toString("base64")}`;
      }
      return { success: true, previewUrl: previewUrl2, hotkeys: [], hotkeyGroups: [] };
    }
    organizeLegacyCharacterFoldersIfNeeded(gameId2);
    let actualModName = modName;
    const charPath = resolveCharacterPath(characterName, gameId2);
    if (!charPath) {
      return { error: "Character folder not found" };
    }
    let modPath = path.join(charPath, modName);
    if (!fs.existsSync(modPath)) {
      if (fs.existsSync(path.join(charPath, `DISABLED_${modName}`))) {
        actualModName = `DISABLED_${modName}`;
        modPath = path.join(charPath, actualModName);
      }
    }
    let imagePath = null;
    const canonicalCharacterName = getCanonicalCharacterConfigKey(characterName, gameId2);
    const charImagesPath = path.join(IMAGES_PATH, canonicalCharacterName);
    if (fs.existsSync(charImagesPath)) {
      const imageFiles = fs.readdirSync(charImagesPath);
      const sanitizedModName = modName.replace(/[<>:"/\\|?*]/g, "_");
      const previewFile = imageFiles.find(
        (f) => f.startsWith(`${sanitizedModName}_preview`) && /\.(png|jpg|jpeg|webp|gif)$/i.test(f)
      );
      if (previewFile) {
        imagePath = path.join(charImagesPath, previewFile);
      }
    }
    if (!imagePath && fs.existsSync(modPath)) {
      const files = fs.readdirSync(modPath);
      let imageFile = files.find(
        (f) => f.startsWith("preview.") && /\.(png|jpg|jpeg|webp|gif)$/i.test(f)
      );
      if (!imageFile) {
        imageFile = files.find((f) => /\.(png|jpg|jpeg|webp|gif)$/i.test(f));
      }
      if (imageFile) {
        imagePath = path.join(modPath, imageFile);
      }
    }
    let previewUrl = null;
    if (imagePath && fs.existsSync(imagePath)) {
      const ext = path.extname(imagePath).toLowerCase();
      const mimeType = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp"
      }[ext] || "image/jpeg";
      const imageBuffer = fs.readFileSync(imagePath);
      const base64 = imageBuffer.toString("base64");
      previewUrl = `data:${mimeType};base64,${base64}`;
    }
    const cacheKey = getPrimaryHotkeysCacheKey(characterName, modName, gameId2);
    const iniFiles = fs.existsSync(modPath) ? getIniFiles(modPath) : [];
    let hotkeys = [];
    let hotkeyGroups = [];
    // Always read the current INI files when a detail panel is opened or refreshed.
    if (fs.existsSync(modPath)) {
      try {
        const allHotkeys = [];
        const groupsByDirectory = new Map();
        iniFiles.forEach((iniPath) => {
          const fileHotkeys = parseIniForHotkeys(iniPath);
          if (fileHotkeys.length > 0) {
            allHotkeys.push(...fileHotkeys);
            const directory = path.dirname(iniPath);
            const relativePath = path.relative(modPath, directory).split(path.sep).join("/");
            if (!groupsByDirectory.has(relativePath)) {
              groupsByDirectory.set(relativePath, {
                name: relativePath ? path.basename(directory) : modName,
                relativePath,
                hotkeys: []
              });
            }
            groupsByDirectory.get(relativePath).hotkeys.push(...fileHotkeys);
          }
        });
        const menuFirst = (a, b) => {
          if (a.isMenu && !b.isMenu) return -1;
          if (!a.isMenu && b.isMenu) return 1;
          return 0;
        };
        const groups = Array.from(groupsByDirectory.values()).sort((a, b) => a.relativePath.localeCompare(b.relativePath));
        hotkeyGroups = groups.map((group) => ({
          ...group,
          name: groups.some((other) => other !== group && other.name === group.name)
            ? group.relativePath || `${group.name}（根目录）` : group.name,
          hotkeys: dedupeHotkeysBySemanticBinding(group.hotkeys).sort(menuFirst)
        }));
        // Keep the flat list for older consumers; both detail views use directory groups.
        hotkeys = dedupeHotkeysBySemanticBinding(allHotkeys).sort(menuFirst);
        hotkeysCache[cacheKey] = {
          scanned: true,
          hotkeys,
          hotkeyGroups,
          timestamp: Date.now(),
          version: HOTKEYS_CACHE_VERSION
        };
        saveHotkeysCache();
      } catch (err) {
        console.error("Error scanning hotkeys:", err);
        delete hotkeysCache[cacheKey];
        saveHotkeysCache();
        return { success: false, error: err.message };
      }
    }
    if (refresh) notifyHotkeysChanged(characterName, modName, gameId2, _?.sender?.id);
    return { success: true, previewUrl, hotkeys, hotkeyGroups };
  } catch (error) {
    console.error("get-mod-details error:", error);
    return { error: error.message };
  }
});
electron.ipcMain.handle("set-mod-preview", async (_, { characterName, modName, imagePath }) => {
  try {
    if (!fs.existsSync(imagePath)) {
      return { error: `Source image not found: ${imagePath}` };
    }
    const gameId2 = getActiveGameScopeId();
    organizeLegacyCharacterFoldersIfNeeded(gameId2);
    let actualModName = modName;
    const charPath = isNevernessDx12Mode(gameId2) ? getNevernessDx12CharacterPath(characterName, { ensure: true }) : resolveCharacterPath(characterName, gameId2);
    if (!charPath) {
      return { error: "Character folder not found" };
    }
    const modPathEnabled = path.join(charPath, modName);
    const modPathDisabled = path.join(charPath, `DISABLED_${modName}`);
    let targetModPath = null;
    if (fs.existsSync(modPathEnabled)) {
      targetModPath = modPathEnabled;
    } else if (fs.existsSync(modPathDisabled)) {
      targetModPath = modPathDisabled;
      actualModName = `DISABLED_${modName}`;
    } else {
      return { error: "Mod folder not found" };
    }
    const ext = path.extname(imagePath).toLowerCase();
    const targetFilename = `preview${ext}`;
    const targetPath = path.join(targetModPath, targetFilename);
    const files = fs.readdirSync(targetModPath);
    for (const file of files) {
      if (file.startsWith("preview.") && /\.(png|jpg|jpeg|webp|gif|bmp|svg|ico|tiff|tif)$/i.test(file)) {
        try {
          fs.unlinkSync(path.join(targetModPath, file));
        } catch (e) {
          console.error("Failed to delete old preview:", e);
        }
      }
    }
    const sourceBuffer = fs.readFileSync(imagePath);
    fs.writeFileSync(targetPath, sourceBuffer);
    console.log(`Image saved to: ${targetPath}`);
    const targetExt = path.extname(targetPath).toLowerCase();
    const mimeType = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".bmp": "image/bmp",
      ".svg": "image/svg+xml",
      ".ico": "image/x-icon",
      ".tiff": "image/tiff",
      ".tif": "image/tiff"
    }[targetExt] || "image/jpeg";
    const imageBuffer = fs.readFileSync(targetPath);
    const base64 = imageBuffer.toString("base64");
    const previewUrl = `data:${mimeType};base64,${base64}`;
    return { success: true, newPath: targetPath, previewUrl };
  } catch (error) {
    console.error("set-mod-preview error:", error);
    return { error: error.message };
  }
});
electron.ipcMain.handle("set-mod-preview-from-data", async (_, { characterName, modName, dataUrl }) => {
  try {
    if (!dataUrl || typeof dataUrl !== "string") {
      return { error: "无效的图片数据" };
    }
    const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
    if (!match) return { error: "不支持的图片格式" };
    const mime = match[1].toLowerCase();
    const base64 = match[2];
    const extMap = {
      "image/png": ".png",
      "image/jpeg": ".jpg",
      "image/jpg": ".jpg",
      "image/webp": ".webp",
      "image/gif": ".gif",
      "image/bmp": ".bmp"
    };
    const ext = extMap[mime] || ".png";
    const gameId2 = getActiveGameScopeId();
    organizeLegacyCharacterFoldersIfNeeded(gameId2);
    const charPath = isNevernessDx12Mode(gameId2) ? getNevernessDx12CharacterPath(characterName, { ensure: true }) : resolveCharacterPath(characterName, gameId2);
    if (!charPath) return { error: "Character folder not found" };
    const modPathEnabled = path.join(charPath, modName);
    const modPathDisabled = path.join(charPath, `DISABLED_${modName}`);
    let targetModPath = null;
    if (fs.existsSync(modPathEnabled)) targetModPath = modPathEnabled;
    else if (fs.existsSync(modPathDisabled)) targetModPath = modPathDisabled;
    else return { error: "Mod folder not found" };
    const files = fs.readdirSync(targetModPath);
    for (const file of files) {
      if (file.startsWith("preview.") && /\.(png|jpg|jpeg|webp|gif|bmp|svg|ico|tiff|tif)$/i.test(file)) {
        try {
          fs.unlinkSync(path.join(targetModPath, file));
        } catch (_2) {
        }
      }
    }
    const targetPath = path.join(targetModPath, `preview${ext}`);
    fs.writeFileSync(targetPath, Buffer.from(base64, "base64"));
    const imageBuffer = fs.readFileSync(targetPath);
    const previewUrl = `data:${mime};base64,${imageBuffer.toString("base64")}`;
    return { success: true, newPath: targetPath, previewUrl };
  } catch (error) {
    console.error("set-mod-preview-from-data error:", error);
    return { error: error.message };
  }
});
electron.ipcMain.handle("rename-mod", async (_, { characterName, oldName, newName }) => {
  try {
    const gameId2 = getActiveGameScopeId();
    characterName = assertSafeAppearancePathSegment(characterName, "角色名称");
    oldName = assertSafeAppearancePathSegment(oldName, "原 Mod 名称");
    newName = assertSafeAppearancePathSegment(newName, "新 Mod 名称");
    organizeLegacyCharacterFoldersIfNeeded(gameId2);
    const charPath = resolveCharacterPath(characterName, gameId2);
    if (!charPath) return { error: "Character folder not found" };
    let oldPath = path.join(charPath, oldName);
    let isDisabled = false;
    if (!fs.existsSync(oldPath)) {
      const disabledPath = path.join(charPath, `DISABLED_${oldName}`);
      if (fs.existsSync(disabledPath)) {
        oldPath = disabledPath;
        isDisabled = true;
      } else {
        return { error: "Mod folder not found" };
      }
    }
    const newFolderName = isDisabled ? `DISABLED_${newName}` : newName;
    const newPath = path.join(charPath, newFolderName);
    if (fs.existsSync(newPath)) {
      return { error: `目标名称已存在: ${newName}` };
    }
    fs.renameSync(oldPath, newPath);
    const currentPinned = getPinnedModsForCharacter(characterName);
    if (currentPinned.includes(oldName)) {
      setPinnedModsForCharacter(
        characterName,
        currentPinned.map((name) => name === oldName ? newName : name)
      );
    }
    clearConflictCache(characterName, gameId2);
    notifyCharacterListChanged(characterName, {
      modName: newName,
      previousModName: oldName,
      reason: "mod-renamed"
    });
    logger.info(`Renamed mod: ${oldPath} -> ${newPath}`);
    return { success: true, newName, newPath };
  } catch (error) {
    return { error: error.message };
  }
});
electron.ipcMain.handle(
  "move-mod-to-character",
  async (_, {
    sourceCharacterName,
    modName,
    targetCharacterName,
    targetAppearanceSectionId = null,
    targetCharacterSkinId = null
  }) => {
    try {
      const gameId2 = getActiveGameScopeId();
      const sourceContext = resolveAppearanceCharacterContext(sourceCharacterName, gameId2);
      const targetContext = resolveAppearanceCharacterContext(targetCharacterName, gameId2);
      const sourceName = sourceContext.characterName;
      const targetName = targetContext.characterName;
      assertCharacterVisible(targetName, gameId2);
      const cleanModName = assertSafeAppearancePathSegment(modName, "Mod 名称");
      if (sourceName === targetName) return { error: "目标分类与当前分类相同" };
      organizeLegacyCharacterFoldersIfNeeded(gameId2);
      const source = resolveExistingModDirectoryAnyMode(sourceName, cleanModName, gameId2);
      if (!source || !source.modPath || !fs.existsSync(source.modPath)) return { error: "源 Mod 文件夹不存在" };
      if (resolveExistingModDirectoryAnyMode(targetName, cleanModName, gameId2)) {
        return { error: `目标分类已存在同名 Mod：${cleanModName}` };
      }
      let targetCharPath = targetContext.characterPath;
      if (isNevernessDx12Mode(gameId2)) {
        targetCharPath = source.enabled ? getNevernessDx12CharacterPath(targetName, { ensure: true, gameId: gameId2 }) : getNevernessDx12DisabledCharacterPath(
          targetName,
          getNevernessDx12Paths(gameId2),
          { ensure: true, gameId: gameId2 }
        );
      }
      if (!targetCharPath) return { error: "目标分类不存在" };
      fs.mkdirSync(targetCharPath, { recursive: true });
      const targetPath = path.join(targetCharPath, source.folderName);
      if (!isPathInsideDirectory(targetPath, targetCharPath)) {
        return { error: "目标 Mod 路径无效" };
      }
      await moveDirectoryWithIntegrityCheck(source.modPath, targetPath);
      const requestedAppearance = targetAppearanceSectionId || targetCharacterSkinId ? {
        appearanceSectionId: targetAppearanceSectionId,
        characterSkinId: targetCharacterSkinId
      } : null;
      let appearanceSectionId = BASE_APPEARANCE_SECTION_ID;
      try {
        appearanceSectionId = assignInstalledModAppearance({
          characterName: targetName,
          modName: cleanModName,
          modDir: targetPath,
          requested: requestedAppearance,
          gameId: gameId2,
          source: requestedAppearance ? "explicit-move" : "move-reclassify",
          ignoreStored: true
        }).sectionId;
      } catch (error) {
        logger.warn(
          `Failed to reclassify moved mod ${targetName}/${cleanModName}: ${error?.message || error}`
        );
        try {
          await moveDirectoryWithIntegrityCheck(targetPath, source.modPath);
        } catch (rollbackError) {
          return {
            error: `Mod 已移动，但分区归类失败且无法回滚：${error?.message || error}`,
            rollbackError: rollbackError?.message || String(rollbackError),
            partial: true
          };
        }
        return { error: `分区归类失败，Mod 移动已回滚：${error?.message || error}` };
      }
      const currentPinned = getPinnedModsForCharacter(sourceName);
      if (currentPinned.includes(cleanModName)) {
        setPinnedModsForCharacter(sourceName, currentPinned.filter((name) => name !== cleanModName));
      }
      clearConflictCache(sourceName, gameId2);
      clearConflictCache(targetName, gameId2);
      notifyCharacterListChanged(targetName, {
        reason: "mod-moved",
        sourceCharacterName: sourceName,
        modName: cleanModName
      });
      return {
        success: true,
        sourceCharacterName: sourceName,
        targetCharacterName: targetName,
        modName: cleanModName,
        appearanceSectionId,
        newPath: targetPath
      };
    } catch (error) {
      return { error: error.message };
    }
  }
);
electron.ipcMain.handle("delete-mod", async (_, { characterName, modName }) => {
  try {
    const gameId2 = getActiveGameScopeId();
    characterName = assertSafeAppearancePathSegment(characterName, "角色名称");
    modName = assertSafeAppearancePathSegment(modName, "Mod 名称");
    if (isNevernessDx12Mode(gameId2)) {
      return await deleteNevernessDx12PakMod(characterName, modName);
    }
    organizeLegacyCharacterFoldersIfNeeded(gameId2);
    const env = resolveActiveGameEnvRoot(gameId2);
    const charPath = resolveCharacterPath(characterName, gameId2);
    if (!charPath) {
      return { error: "Character folder not found" };
    }
    let modPath = path.join(charPath, modName);
    if (!fs.existsSync(modPath)) {
      const disabledPath = path.join(charPath, `DISABLED_${modName}`);
      if (fs.existsSync(disabledPath)) {
        modPath = disabledPath;
      } else {
        return { error: "Mod folder not found" };
      }
    }
    let hostedStateFiles = [];
    if (isPersistBridgeEnabled(gameId2)) {
      hostedStateFiles = collectHostedPersistStateFilesForModDir(modPath);
    }
    await movePathToRecycleBin(modPath, "delete mod");
    if (env?.root && isPersistBridgeEnabled(gameId2) && hostedStateFiles.length > 0) {
      updateActivePersistBridgeIncludesIncremental(env.root, { removeStateFiles: hostedStateFiles });
    }
    const currentPinned = getPinnedModsForCharacter(characterName);
    if (currentPinned.includes(modName)) {
      setPinnedModsForCharacter(
        characterName,
        currentPinned.filter((name) => name !== modName)
      );
    }
    clearConflictCache(characterName, gameId2);
    notifyCharacterListChanged(characterName, {
      modName,
      reason: "mod-deleted"
    });
    logger.info(`Deleted mod to Recycle Bin: ${modPath}`);
    return { success: true, recycled: true };
  } catch (error) {
    console.error("delete-mod error:", error);
    return { error: error.message };
  }
});
const PRESETS_PATH = path.join(electron.app.getPath("userData"), "presets.json");
const BUILTIN_NO_MOD_PRESET_ID = "__builtin_no_mod__";
function createBuiltinNoModPreset() {
  return {
    id: BUILTIN_NO_MOD_PRESET_ID,
    name: "无mod",
    description: "系统预设：禁用当前游戏下的全部 Mod",
    mods: [],
    createdAt: null,
    updatedAt: null,
    isBuiltIn: true
  };
}
function withBuiltinPresets(presets) {
  const builtin = createBuiltinNoModPreset();
  const normalized = Array.isArray(presets) ? presets : [];
  const filtered = normalized.filter(
    (preset) => preset && preset.id !== BUILTIN_NO_MOD_PRESET_ID && preset.name !== builtin.name
  );
  return [builtin, ...filtered];
}
function findPresetById(data, presetId) {
  if (presetId === BUILTIN_NO_MOD_PRESET_ID) return createBuiltinNoModPreset();
  return (data.presets || []).find((preset) => preset.id === presetId) || null;
}
function findPresetByName(data, presetName) {
  if (presetName === "无mod") return createBuiltinNoModPreset();
  return (data.presets || []).find((preset) => preset.name === presetName) || null;
}
function createEmptyPresetScope() {
  return { presets: [], activePresetId: null };
}
function normalizePresetModEntry(mod, gameId2 = getActiveGameScopeId()) {
  if (!mod || typeof mod !== "object") return null;
  const characterName = mod.characterName || mod.character;
  const modName = mod.modName || mod.mod;
  if (!characterName || !modName) return null;
  return {
    ...mod,
    characterName: getCanonicalCharacterConfigKey(characterName, gameId2),
    modName,
    enabled: mod.enabled !== false
  };
}
function normalizePresetMods(mods, gameId2 = getActiveGameScopeId()) {
  if (!Array.isArray(mods)) return [];
  return mods.map((mod) => normalizePresetModEntry(mod, gameId2)).filter(Boolean);
}
function snapshotEnabledPresetMods(gameId2 = getActiveGameScopeId()) {
  const presetMods = [];
  if (isNevernessDx12Mode(gameId2)) {
    const paths = ensureNevernessDx12GamePaths();
    const modsPath2 = paths.pakModsDir;
    if (!modsPath2 || !fs.existsSync(modsPath2)) return [];
    const characterEntries2 = listCharacterDirectories(modsPath2, gameId2);
    for (const entry of characterEntries2) {
      const result = getNevernessDx12Mods(entry.displayName);
      if (!result?.success || !Array.isArray(result.mods)) continue;
      for (const mod of result.mods) {
        if (mod.enabled) {
          presetMods.push({
            characterName: entry.displayName,
            modName: mod.name,
            enabled: true
          });
        }
      }
    }
    return presetMods;
  }
  const modsPath = getModsPath(gameId2);
  if (!modsPath || !fs.existsSync(modsPath)) return [];
  const characterEntries = listCharacterDirectories(modsPath, gameId2);
  for (const entry of characterEntries) {
    const modDirs = fs.readdirSync(entry.characterRootPath, { withFileTypes: true }).filter((dirent) => dirent.isDirectory());
    for (const mod of modDirs) {
      if (!mod.name.startsWith("DISABLED_")) {
        presetMods.push({
          characterName: entry.displayName,
          modName: mod.name,
          enabled: true
        });
      }
    }
  }
  return presetMods;
}
async function applyPresetModsForGame(preset, gameId2 = getActiveGameScopeId()) {
  const enableSet = new Set(
    normalizePresetMods(preset.mods, gameId2).filter((mod) => mod.enabled !== false && !isCharacterHidden(mod.characterName, gameId2)).map((mod) => `${mod.characterName}/${mod.modName}`)
  );
  const results = { enabled: 0, disabled: 0, missing: 0, errors: [] };
  if (isNevernessDx12Mode(gameId2)) {
    const paths = ensureNevernessDx12GamePaths();
    const modsPath2 = paths.pakModsDir;
    if (!modsPath2 || !fs.existsSync(modsPath2)) {
      return { error: "异环 Pak MOD 目录未设置或不存在" };
    }
    const characterEntries2 = listCharacterDirectories(modsPath2, gameId2);
    for (const entry of characterEntries2) {
      const current = getNevernessDx12Mods(entry.displayName);
      if (!current?.success || !Array.isArray(current.mods)) continue;
      for (const mod of current.mods) {
        const key = `${entry.displayName}/${mod.name}`;
        const shouldEnable = enableSet.has(key);
        if (!!mod.enabled === shouldEnable) continue;
        const toggleResult = toggleNevernessDx12PakMod(entry.displayName, mod.name, shouldEnable);
        if (toggleResult?.success) {
          if (shouldEnable) results.enabled += 1;
          else results.disabled += 1;
        } else {
          results.errors.push(`${key}: ${toggleResult?.error || "切换 Pak Mod 失败"}`);
        }
      }
    }
    for (const mod of normalizePresetMods(preset.mods, gameId2)) {
      if (mod.enabled === false) continue;
      const found = characterEntries2.some((entry) => {
        if (entry.displayName !== mod.characterName) return false;
        const current = getNevernessDx12Mods(entry.displayName);
        return current?.success && current.mods?.some((item) => item.name === mod.modName);
      });
      if (!found) results.missing += 1;
    }
    clearConflictCache();
    return { success: true, results };
  }
  const modsPath = getModsPath(gameId2);
  const env = resolveActiveGameEnvRoot(gameId2);
  if (!modsPath || !fs.existsSync(modsPath)) {
    return { error: "Mods 文件夹未设置或不存在" };
  }
  const enabledStateFiles = [];
  const disabledStateFiles = [];
  const characterEntries = listCharacterDirectories(modsPath, gameId2);
  for (const entry of characterEntries) {
    const charPath = entry.characterRootPath;
    const modDirs = fs.readdirSync(charPath, { withFileTypes: true }).filter((dirent) => dirent.isDirectory());
    for (const mod of modDirs) {
      const isDisabled = mod.name.startsWith("DISABLED_");
      const cleanName = isDisabled ? mod.name.replace("DISABLED_", "") : mod.name;
      const key = `${entry.displayName}/${cleanName}`;
      const shouldEnable = enableSet.has(key);
      const currentModPath = path.join(charPath, mod.name);
      try {
        if (shouldEnable && isDisabled) {
          if (isPersistBridgeEnabled(gameId2)) {
            const stateFiles = collectHostedPersistStateFilesForModDir(currentModPath);
            enabledStateFiles.push(...stateFiles);
          }
          const renameResult = await renameModDirectoryWithRetry(
            currentModPath,
            path.join(charPath, cleanName)
          );
          if (!renameResult.success) {
            throw new Error(renameResult.error || "启用 Mod 失败");
          }
          results.enabled++;
        } else if (!shouldEnable && !isDisabled) {
          if (isPersistBridgeEnabled(gameId2)) {
            const stateFiles = collectHostedPersistStateFilesForModDir(currentModPath);
            if (dirUsesManagedPersistBridge(currentModPath)) {
              syncPersistBridgeStateForModDir(currentModPath, gameId2);
            }
            disabledStateFiles.push(...stateFiles);
          }
          const renameResult = await renameModDirectoryWithRetry(
            currentModPath,
            path.join(charPath, `DISABLED_${mod.name}`)
          );
          if (!renameResult.success) {
            throw new Error(renameResult.error || "禁用 Mod 失败");
          }
          results.disabled++;
        }
      } catch (e) {
        results.errors.push(`${key}: ${e.message}`);
      }
    }
  }
  if (env?.root && isPersistBridgeEnabled(gameId2)) {
    updateActivePersistBridgeIncludesIncremental(env.root, {
      enableStateFiles: enabledStateFiles,
      disableStateFiles: disabledStateFiles
    });
  }
  clearConflictCache();
  for (const mod of normalizePresetMods(preset.mods, gameId2)) {
    if (mod.enabled === false) continue;
    const charPath = resolveCharacterPath(mod.characterName, gameId2);
    if (!charPath || !fs.existsSync(charPath)) {
      results.missing++;
      continue;
    }
    const modPath = path.join(charPath, mod.modName);
    const disabledPath = path.join(charPath, `DISABLED_${mod.modName}`);
    if (!fs.existsSync(modPath) && !fs.existsSync(disabledPath)) {
      results.missing++;
    }
  }
  return { success: true, results };
}
function notifyPresetApplicationChanged(gameId2 = getActiveGameScopeId()) {
  CHARACTER_DIRECTORY_STATS_CACHE.clear();
  electron.BrowserWindow.getAllWindows().forEach((w) => {
    if (!w.isDestroyed()) {
      w.webContents.send("mods-changed", {
        characterName: "__all__",
        gameId: gameId2,
        reason: "preset-applied",
        fullRefresh: true
      });
      w.webContents.send("presets-changed");
    }
  });
}
function normalizePresetScope(data) {
  const emptyScope = createEmptyPresetScope();
  const gameId2 = getActiveGameScopeId();
  if (Array.isArray(data)) {
    return {
      ...emptyScope,
      presets: data.map((preset) => ({
        ...preset,
        mods: normalizePresetMods(preset?.mods, gameId2)
      }))
    };
  }
  return {
    ...emptyScope,
    presets: Array.isArray(data?.presets) ? data.presets.map((preset) => ({
      ...preset,
      mods: normalizePresetMods(preset?.mods, gameId2)
    })) : [],
    activePresetId: data?.activePresetId || null
  };
}
function loadPresetStore() {
  try {
    if (fs.existsSync(PRESETS_PATH)) {
      const data = fs.readFileSync(PRESETS_PATH, "utf-8");
      const parsed = JSON.parse(data);
      if (parsed?.presetsByGame && typeof parsed.presetsByGame === "object") {
        const presetsByGame = {};
        Object.entries(parsed.presetsByGame).forEach(([gameId2, scope]) => {
          presetsByGame[gameId2] = normalizePresetScope(scope);
        });
        return { presetsByGame };
      }
      return {
        presetsByGame: {
          endfield: normalizePresetScope(parsed)
        }
      };
    }
  } catch (e) {
    console.error("Failed to load presets:", e);
  }
  return { presetsByGame: {} };
}
function savePresetStore(store) {
  try {
    fs.writeFileSync(PRESETS_PATH, JSON.stringify(store, null, 2));
  } catch (e) {
    console.error("Failed to save presets:", e);
  }
}
function tryLoadLegacyPresetScope(gameId2 = getActiveGameScopeId()) {
  try {
    const targetGame = (currentConfig.games || []).find((game) => game.id === gameId2);
    const modsPath = targetGame?.modFolderPath || (gameId2 === "endfield" ? currentConfig.modsPath || "" : "");
    if (!modsPath) return null;
    const legacyPath = path.join(path.dirname(modsPath), "presets.json");
    if (!legacyPath || legacyPath === PRESETS_PATH || !fs.existsSync(legacyPath)) return null;
    const parsed = JSON.parse(fs.readFileSync(legacyPath, "utf-8"));
    return normalizePresetScope(parsed);
  } catch (_) {
    return null;
  }
}
function loadPresets(gameId2 = getActiveGameScopeId()) {
  const store = loadPresetStore();
  let scope = normalizePresetScope(store.presetsByGame?.[gameId2]);
  if (scope.presets.length === 0 && !scope.activePresetId) {
    const legacyScope = tryLoadLegacyPresetScope(gameId2);
    if (legacyScope && (legacyScope.presets.length > 0 || legacyScope.activePresetId)) {
      store.presetsByGame[gameId2] = legacyScope;
      savePresetStore(store);
      scope = legacyScope;
    }
  }
  return scope;
}
function savePresets(data, gameId2 = getActiveGameScopeId()) {
  const store = loadPresetStore();
  store.presetsByGame[gameId2] = normalizePresetScope(data);
  savePresetStore(store);
}
electron.ipcMain.handle("preset:list", async () => {
  try {
    const data = loadPresets();
    return {
      success: true,
      presets: withBuiltinPresets(data.presets),
      activePresetId: data.activePresetId
    };
  } catch (error) {
    return { error: error.message };
  }
});
electron.ipcMain.handle("preset:create", async (_, { name, description, mods }) => {
  try {
    if (!name || !name.trim()) {
      return { error: "预设名称不能为空" };
    }
    if (name.trim() === "无mod") {
      return { error: "“无mod” 是系统内置预设，请使用其它名称" };
    }
    const data = loadPresets();
    if ((data.presets || []).some((preset2) => preset2.name === name.trim())) {
      return { error: "已存在同名预设" };
    }
    const id = crypto.randomUUID();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    let presetMods = mods;
    if (!presetMods) {
      presetMods = snapshotEnabledPresetMods(getActiveGameScopeId());
    } else {
      presetMods = normalizePresetMods(presetMods, getActiveGameScopeId());
    }
    const preset = {
      id,
      name: name.trim(),
      description: description || "",
      mods: presetMods,
      createdAt: now,
      updatedAt: now
    };
    data.presets.push(preset);
    savePresets(data);
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.webContents.send("presets-changed");
    }
    return { success: true, preset };
  } catch (error) {
    return { error: error.message };
  }
});
electron.ipcMain.handle("preset:delete", async (_, presetId) => {
  try {
    if (presetId === BUILTIN_NO_MOD_PRESET_ID) {
      return { error: "系统内置预设不可删除" };
    }
    const data = loadPresets();
    const idx = data.presets.findIndex((p) => p.id === presetId);
    if (idx === -1) return { error: "预设不存在" };
    data.presets.splice(idx, 1);
    if (data.activePresetId === presetId) {
      data.activePresetId = null;
    }
    savePresets(data);
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.webContents.send("presets-changed");
    }
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
});
electron.ipcMain.handle("preset:update", async (_, { presetId, name, description, mods }) => {
  try {
    if (presetId === BUILTIN_NO_MOD_PRESET_ID) {
      return { error: "系统内置预设不可编辑" };
    }
    const data = loadPresets();
    const preset = findPresetById(data, presetId);
    if (!preset) return { error: "预设不存在" };
    if (name !== void 0) {
      const trimmedName = name.trim();
      if (!trimmedName) return { error: "预设名称不能为空" };
      if (trimmedName === "无mod") return { error: "“无mod” 是系统内置预设，请使用其它名称" };
      if ((data.presets || []).some((item) => item.id !== presetId && item.name === trimmedName)) {
        return { error: "已存在同名预设" };
      }
      preset.name = trimmedName;
    }
    if (description !== void 0) preset.description = description;
    if (mods !== void 0) preset.mods = normalizePresetMods(mods, getActiveGameScopeId());
    preset.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    savePresets(data);
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.webContents.send("presets-changed");
    }
    return { success: true, preset };
  } catch (error) {
    return { error: error.message };
  }
});
electron.ipcMain.handle("preset:activate", async (_, presetId) => {
  try {
    const gameId2 = getActiveGameScopeId();
    const data = loadPresets();
    const preset = findPresetById(data, presetId);
    if (!preset) return { error: "预设不存在" };
    const applyResult = await applyPresetModsForGame(preset, gameId2);
    if (!applyResult?.success) {
      return { error: applyResult?.error || "应用预设失败" };
    }
    const results = applyResult.results || { enabled: 0, disabled: 0, missing: 0, errors: [] };
    data.activePresetId = presetId;
    savePresets(data);
    logger.info(
      `[Preset] Activated "${preset.name}": enabled=${results.enabled}, disabled=${results.disabled}, missing=${results.missing}`
    );
    notifyPresetApplicationChanged(gameId2);
    return { success: true, results };
  } catch (error) {
    logger.error("preset:activate error:", error);
    return { error: error.message };
  }
});
electron.ipcMain.handle("preset:deactivate", async () => {
  try {
    const data = loadPresets();
    data.activePresetId = null;
    savePresets(data);
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
});
electron.ipcMain.handle("preset:snapshot", async (_, presetId) => {
  try {
    if (presetId === BUILTIN_NO_MOD_PRESET_ID) {
      return { error: "系统内置预设不可更新快照" };
    }
    const modsPath = getModsPath();
    if (!modsPath || !fs.existsSync(modsPath)) {
      return { error: "Mods 文件夹未设置" };
    }
    const data = loadPresets();
    const preset = data.presets.find((p) => p.id === presetId);
    if (!preset) return { error: "预设不存在" };
    const currentMods = snapshotEnabledPresetMods(getActiveGameScopeId());
    preset.mods = currentMods;
    preset.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    savePresets(data);
    return { success: true, preset };
  } catch (error) {
    return { error: error.message };
  }
});
const MAX_INCREMENTAL_AGE_MS = 7 * 24 * 60 * 60 * 1e3;
function isStaleIncrementalCache(cache) {
  if (!cache || !cache.lastSyncTimestamp) return false;
  const ts = Date.parse(cache.lastSyncTimestamp);
  if (!Number.isFinite(ts)) return true;
  return Date.now() - ts > MAX_INCREMENTAL_AGE_MS;
}
const MARKET_SYNC_REQUESTS = createLatestRequestTracker();
async function isCurrentMarketRequestAfterIpcTurn(requestTicket) {
  await new Promise((resolve) => setImmediate(resolve));
  return MARKET_SYNC_REQUESTS.isCurrent(requestTicket);
}
electron.ipcMain.handle("market:invalidate-requests", async (_, { gameId: gameId2 } = {}) => {
  if (gameId2) MARKET_SYNC_REQUESTS.invalidate(getMarketGameId(gameId2));
  else MARKET_SYNC_REQUESTS.invalidateAll();
  return { success: true };
});
function marketRequestHeaders(authToken = "", authServerUrl = "", targetServerUrl = "") {
  const token = resolveMarketAuthToken({ authToken, authServerUrl, targetServerUrl });
  return {
    "ngrok-skip-browser-warning": "true",
    ...token ? { Authorization: `Bearer ${token}` } : {}
  };
}
function resolveMarketAccessDecision(data, status = 200) {
  const access = normalizeMarketAccessPayload(data?.marketAccess);
  if (access) return access;
  const code = String(data?.code || "").trim().toUpperCase();
  if (["LOGIN_REQUIRED", "SESSION_EXPIRED", "ACCOUNT_NOT_ELIGIBLE", "MARKET_ACCESS_DENIED"].includes(
    code
  ) || status === 401 || status === 403) {
    return {
      controlled: true,
      allowed: false,
      code: code || (status === 401 ? "LOGIN_REQUIRED" : "MARKET_ACCESS_DENIED"),
      clearExisting: false
    };
  }
  return null;
}
function loadModCache(gameId2 = getActiveGameScopeId()) {
  const cachePath = getModCachePath(gameId2);
  const marketGameId = normalizeMarketGameId(getMarketGameId(gameId2));
  try {
    if (fs.existsSync(cachePath)) {
      const data = fs.readFileSync(cachePath, "utf-8");
      return normalizeCachePayload(JSON.parse(data));
    }
    if (marketGameId === "endfield" && cachePath !== LEGACY_MOD_CACHE_PATH && fs.existsSync(LEGACY_MOD_CACHE_PATH)) {
      const legacyData = fs.readFileSync(LEGACY_MOD_CACHE_PATH, "utf-8");
      return normalizeCachePayload(JSON.parse(legacyData));
    }
  } catch (e) {
    console.error("Failed to load mod cache:", e);
  }
  return normalizeCachePayload();
}
function saveModCache(cache, gameId2 = getActiveGameScopeId()) {
  const cachePath = getModCachePath(gameId2);
  try {
    const payload = {
      ...normalizeCachePayload(cache),
      schemaVersion: CACHE_SCHEMA_VERSION
    };
    fs.writeFileSync(cachePath, JSON.stringify(payload, null, 2));
  } catch (e) {
    console.error("Failed to save mod cache:", e);
  }
}
function getMarketModCacheKey(modOrId) {
  const rawId = typeof modOrId === "object" && modOrId !== null ? modOrId.id : modOrId;
  return rawId == null ? null : String(rawId);
}
function sortMarketMods(mods) {
  return [...mods].sort((a, b) => {
    const pinnedDiff = (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
    if (pinnedDiff !== 0) return pinnedDiff;
    const orderDiff = (a.sortOrder || 0) - (b.sortOrder || 0);
    if (orderDiff !== 0) return orderDiff;
    return (b.updatedAt || "").localeCompare(a.updatedAt || "");
  });
}
function normalizeMarketModsForDisplay(mods, gameId2 = getActiveGameScopeId()) {
  return Array.isArray(mods) ? mods : [];
}
function mergeMarketMods(cacheMods, updatedMods = [], deletedIds = []) {
  const localMap = /* @__PURE__ */ new Map();
  for (const mod of cacheMods || []) {
    const key = getMarketModCacheKey(mod);
    if (key) localMap.set(key, mod);
  }
  for (const id of deletedIds || []) {
    const key = getMarketModCacheKey(id);
    if (key) localMap.delete(key);
  }
  for (const mod of updatedMods || []) {
    const key = getMarketModCacheKey(mod);
    if (key) localMap.set(key, mod);
  }
  return sortMarketMods(normalizeMarketModsForDisplay(Array.from(localMap.values())));
}
electron.ipcMain.handle("get-cached-mods", async (_, { gameId: gameId2 } = {}) => {
  try {
    const startedAt = Date.now();
    const marketGameId = getMarketGameId(gameId2);
    const cachePath = getModCachePath(gameId2);
    const cache = loadModCache(gameId2);
    if (utils.is.dev) {
      let cacheSize = 0;
      try {
        cacheSize = fs.existsSync(cachePath) ? fs.statSync(cachePath).size : 0;
      } catch (_2) {
      }
      console.log(
        `[ModMarketPerf][main] get-cached-mods ${marketGameId}: ${Date.now() - startedAt}ms, ${cache.mods.length} mods, ${(cacheSize / 1024 / 1024).toFixed(2)} MB`
      );
    }
    return {
      success: true,
      mods: normalizeMarketModsForDisplay(cache.mods, gameId2),
      lastSyncTimestamp: cache.lastSyncTimestamp,
      gameId: marketGameId,
      marketAccess: normalizeMarketAccessPayload(cache.marketAccess),
      refreshBlocked: isMarketRefreshBlocked(cache.marketAccess)
    };
  } catch (error) {
    return { error: error.message };
  }
});
electron.ipcMain.handle(
  "sync-mod-market",
  async (_, { serverUrl, forceFullSync, gameId: gameId2, authToken = "", authServerUrl = "" } = {}) => {
    if (!serverUrl) return { error: "服务器地址未配置" };
    const marketGameId = getMarketGameId(gameId2);
    const requestTicket = MARKET_SYNC_REQUESTS.begin(marketGameId);
    const baseUrl = normalizeServerUrlInput(serverUrl).replace(/\/$/, "");
    const requestAuthToken = resolveMarketAuthToken({
      authToken,
      authServerUrl,
      targetServerUrl: baseUrl
    });
    try {
      const cache = loadModCache(gameId2);
      const stale = isStaleIncrementalCache(cache);
      const needsSchemaHeal = (cache.schemaVersion || 0) < CACHE_SCHEMA_VERSION;
      const needsAuthRefresh = cacheNeedsMarketAuthRefresh(cache, requestAuthToken);
      const canIncremental = !forceFullSync && !stale && !needsSchemaHeal && !needsAuthRefresh && cache.lastSyncTimestamp && cache.mods.length > 0;
      const params = new URLSearchParams({ gameId: marketGameId, channel: "client" });
      if (canIncremental) {
        params.set("since", cache.lastSyncTimestamp);
      } else if (needsSchemaHeal) {
        console.log(
          `[ModCache:${marketGameId}] Cache schemaVersion=${cache.schemaVersion || 0} < current ${CACHE_SCHEMA_VERSION}, forcing one-time full sync`
        );
      } else if (stale) {
        console.log(
          `[ModCache:${marketGameId}] Cache stale (>${MAX_INCREMENTAL_AGE_MS / 864e5}d), forcing full sync`
        );
      }
      const url = `${baseUrl}/api/mods?${params.toString()}`;
      const response = await fetch(url, {
        headers: marketRequestHeaders(authToken, authServerUrl, baseUrl)
      });
      const data = await response.json().catch(() => ({}));
      const marketAccess = resolveMarketAccessDecision(data, response.status);
      if (!await isCurrentMarketRequestAfterIpcTurn(requestTicket)) {
        return buildMarketCacheResult(loadModCache(gameId2), gameId2, { stale: true });
      }
      if (isMarketRefreshBlocked(marketAccess)) {
        const preserved = preserveBlockedMarketCache(cache, gameId2, marketAccess, requestAuthToken);
        return buildMarketCacheResult(preserved, gameId2, {
          refreshBlocked: true,
          hideCachedMods: true,
          marketAccess
        });
      }
      if (!response.ok) {
        throw new Error(
          `服务器返回错误: ${response.status}${data.error ? ` - ${data.error}` : ""}`
        );
      }
      if (!data.success) return { error: data.error || "同步失败" };
      const rawUpdatedMods = Array.isArray(data.mods) ? data.mods : null;
      if (shouldPreserveMarketSnapshotOnEmptyResult(
        {
          success: true,
          mods: rawUpdatedMods,
          wasIncremental: data.isIncremental === true,
          marketAccess
        },
        cache.mods
      )) {
        return buildMarketCacheResult(cache, gameId2, {
          ignoredEmpty: true,
          marketAccess
        });
      }
      const updatedMods = rawUpdatedMods || [];
      const deletedIds = Array.isArray(data.deletedIds) ? data.deletedIds : [];
      let finalMods;
      if (data.isIncremental) {
        finalMods = mergeMarketMods(cache.mods, updatedMods, deletedIds);
        console.log(
          `[ModCache:${marketGameId}] Incremental sync: +${updatedMods.length} updated, -${deletedIds.length} deleted | url=${url} | cacheSince=${cache.lastSyncTimestamp} | serverSyncTs=${data.syncTimestamp}`
        );
      } else {
        finalMods = sortMarketMods(normalizeMarketModsForDisplay(updatedMods, gameId2));
        console.log(`[ModCache:${marketGameId}] Full sync: ${finalMods.length} mods`);
      }
      const normalizedAccess = normalizeMarketAccessPayload(marketAccess);
      const newCache = {
        mods: finalMods,
        lastSyncTimestamp: data.syncTimestamp,
        marketVersion: data.marketVersion || cache.marketVersion || null,
        responseRevision: Number(data.responseRevision || cache.responseRevision || 0),
        marketAccess: normalizedAccess,
        authScope: createMarketAuthScope(requestAuthToken),
        accessCheckedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      saveModCache(newCache, gameId2);
      return {
        success: true,
        mods: finalMods,
        lastSyncTimestamp: data.syncTimestamp,
        gameId: marketGameId,
        marketAccess: normalizedAccess,
        wasIncremental: !!data.isIncremental,
        updatedCount: data.isIncremental ? updatedMods.length : finalMods.length,
        deletedCount: data.isIncremental ? deletedIds.length : 0
      };
    } catch (error) {
      console.error("sync-mod-market error:", error);
      if (!await isCurrentMarketRequestAfterIpcTurn(requestTicket)) {
        return buildMarketCacheResult(loadModCache(gameId2), gameId2, { stale: true });
      }
      const cache = loadModCache(gameId2);
      if (cache.mods.length > 0) {
        return buildMarketCacheResult(cache, gameId2, { syncError: error.message });
      }
      return { error: error.message };
    }
  }
);
electron.ipcMain.handle(
  "market:poll",
  async (_, { authToken = "", authServerUrl = "" } = {}) => {
    const serverUrl = currentConfig.serverUrl;
    if (!serverUrl) return { success: false, mods: [] };
    const gameId2 = getActiveGameScopeId();
    const marketGameId = getMarketGameId(gameId2);
    const requestTicket = MARKET_SYNC_REQUESTS.begin(marketGameId);
    const headersForCandidate = (candidate) => marketRequestHeaders(authToken, authServerUrl, candidate);
    try {
      const cache = loadModCache(gameId2);
      const stale = isStaleIncrementalCache(cache);
      const needsSchemaHeal = (cache.schemaVersion || 0) < CACHE_SCHEMA_VERSION;
      let versionProbe = null;
      try {
        const versionParams = new URLSearchParams({ gameId: marketGameId, channel: "client" });
        const versionResult = await fetchQaqmWithFallback(
          serverUrl,
          `/api/mods/sync-version?${versionParams.toString()}`,
          {
            expectJson: true,
            secureOnly: Boolean(String(authToken || "").trim()),
            isCurrent: () => isCurrentMarketRequestAfterIpcTurn(requestTicket),
            headersForCandidate
          }
        );
        const versionData = await versionResult.response.json().catch(() => ({}));
        if (versionResult.response.ok && versionData?.success && versionData.version) {
          versionProbe = { ...versionData, serverUrl: versionResult.serverUrl };
        }
      } catch (error) {
        console.warn(`[ModCache:${marketGameId}] Version probe unavailable: ${error?.message || error}`);
      }
      if (!await isCurrentMarketRequestAfterIpcTurn(requestTicket)) {
        return buildMarketCacheResult(loadModCache(gameId2), gameId2, { stale: true });
      }
      const versionAccess = resolveMarketAccessDecision(versionProbe, 200);
      const versionAuthToken = resolveMarketAuthToken({
        authToken,
        authServerUrl,
        targetServerUrl: versionProbe?.serverUrl || serverUrl
      });
      if (isMarketRefreshBlocked(versionAccess)) {
        const preserved = preserveBlockedMarketCache(cache, gameId2, versionAccess, versionAuthToken);
        return buildMarketCacheResult(preserved, gameId2, {
          refreshBlocked: true,
          hideCachedMods: true,
          marketAccess: versionAccess
        });
      }
      const revisionChanged = Boolean(
        versionProbe && Number(versionProbe.responseRevision || 0) !== Number(cache.responseRevision || 0)
      );
      const cacheReady = !stale && !needsSchemaHeal && !cacheNeedsMarketAuthRefresh(cache, versionAuthToken) && !revisionChanged && cache.lastSyncTimestamp && cache.mods.length > 0;
      if (cacheReady && versionProbe && cache.marketVersion === versionProbe.version) {
        return {
          ...buildMarketCacheResult(cache, gameId2, { marketAccess: versionAccess }),
          fromCache: false,
          unchanged: true,
          wasIncremental: true
        };
      }
      const params = new URLSearchParams({ gameId: marketGameId, channel: "client" });
      if (cacheReady) params.set("since", cache.lastSyncTimestamp);
      const syncResult = await fetchQaqmWithFallback(
        versionProbe?.serverUrl || serverUrl,
        `/api/mods?${params.toString()}`,
        {
          expectJson: true,
          secureOnly: Boolean(String(authToken || "").trim()),
          isCurrent: () => isCurrentMarketRequestAfterIpcTurn(requestTicket),
          headersForCandidate
        }
      );
      const response = syncResult.response;
      const data = await response.json().catch(() => ({}));
      const marketAccess = resolveMarketAccessDecision(data, response.status);
      if (!await isCurrentMarketRequestAfterIpcTurn(requestTicket)) {
        return buildMarketCacheResult(loadModCache(gameId2), gameId2, { stale: true });
      }
      const responseAuthToken = resolveMarketAuthToken({
        authToken,
        authServerUrl,
        targetServerUrl: syncResult.serverUrl
      });
      if (isMarketRefreshBlocked(marketAccess)) {
        const preserved = preserveBlockedMarketCache(cache, gameId2, marketAccess, responseAuthToken);
        return buildMarketCacheResult(preserved, gameId2, {
          refreshBlocked: true,
          hideCachedMods: true,
          marketAccess
        });
      }
      if (!response.ok) {
        throw new Error(
          `服务器返回错误: ${response.status}${data.error ? ` - ${data.error}` : ""}`
        );
      }
      if (!data.success) throw new Error(data.error || "同步失败");
      const rawUpdatedMods = Array.isArray(data.mods) ? data.mods : null;
      if (shouldPreserveMarketSnapshotOnEmptyResult(
        {
          success: true,
          mods: rawUpdatedMods,
          wasIncremental: data.isIncremental === true,
          marketAccess
        },
        cache.mods
      )) {
        return buildMarketCacheResult(cache, gameId2, {
          ignoredEmpty: true,
          marketAccess
        });
      }
      const updatedMods = rawUpdatedMods || [];
      const deletedIds = Array.isArray(data.deletedIds) ? data.deletedIds : [];
      const finalMods = data.isIncremental ? mergeMarketMods(cache.mods, updatedMods, deletedIds) : sortMarketMods(normalizeMarketModsForDisplay(updatedMods, gameId2));
      const normalizedAccess = normalizeMarketAccessPayload(marketAccess);
      saveModCache(
        {
          mods: finalMods,
          lastSyncTimestamp: data.syncTimestamp,
          marketVersion: data.marketVersion || versionProbe?.version || cache.marketVersion || null,
          responseRevision: Number(
            data.responseRevision || versionProbe?.responseRevision || cache.responseRevision || 0
          ),
          marketAccess: normalizedAccess,
          authScope: createMarketAuthScope(responseAuthToken),
          accessCheckedAt: (/* @__PURE__ */ new Date()).toISOString()
        },
        gameId2
      );
      return {
        success: true,
        mods: finalMods,
        gameId: marketGameId,
        marketAccess: normalizedAccess,
        wasIncremental: !!data.isIncremental,
        updatedCount: data.isIncremental ? updatedMods.length : finalMods.length,
        deletedCount: data.isIncremental ? deletedIds.length : 0
      };
    } catch (error) {
      if (!await isCurrentMarketRequestAfterIpcTurn(requestTicket)) {
        return buildMarketCacheResult(loadModCache(gameId2), gameId2, { stale: true });
      }
      const cache = loadModCache(gameId2);
      if (cache.mods.length > 0) {
        return buildMarketCacheResult(cache, gameId2, { syncError: error.message });
      }
      return { success: false, mods: [], gameId: marketGameId, error: error.message };
    }
  }
);
electron.ipcMain.handle("config:export", async () => {
  try {
    const activeGame = getActiveGame();
    const result = await electron.dialog.showSaveDialog({
      title: "导出预设",
      defaultPath: `QAQ-Revival_presets_${activeGame?.id || "default"}_${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.json`,
      filters: [{ name: "JSON", extensions: ["json"] }]
    });
    if (result.canceled || !result.filePath) return { success: false, canceled: true };
    const exportData = {
      version: electron.app.getVersion(),
      exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
      gameId: activeGame?.id || "endfield",
      gameName: activeGame?.name || "明日方舟终末地",
      presets: loadPresets()
    };
    fs.writeFileSync(result.filePath, JSON.stringify(exportData, null, 2));
    return { success: true, path: result.filePath };
  } catch (error) {
    return { error: error.message };
  }
});
electron.ipcMain.handle("config:import", async () => {
  try {
    const result = await electron.dialog.showOpenDialog({
      title: "导入预设",
      filters: [{ name: "JSON", extensions: ["json"] }],
      properties: ["openFile"]
    });
    if (result.canceled || !result.filePaths.length) return { success: false, canceled: true };
    const data = JSON.parse(fs.readFileSync(result.filePaths[0], "utf-8"));
    if (!data.presets) return { error: "无效的预设文件" };
    const existing = loadPresets();
    const existingIds = new Set((existing.presets || []).map((p) => p.id));
    let importedScope = null;
    if (data.presets?.presetsByGame && typeof data.presets.presetsByGame === "object") {
      const currentGameId = getActiveGameScopeId();
      importedScope = normalizePresetScope(
        data.presets.presetsByGame[currentGameId] || data.presets.presetsByGame[data.gameId] || Object.values(data.presets.presetsByGame)[0]
      );
    } else {
      importedScope = normalizePresetScope(data.presets);
    }
    const newPresets = importedScope.presets || [];
    let importedCount = 0;
    for (const preset of newPresets) {
      if (!existingIds.has(preset.id)) {
        existing.presets = existing.presets || [];
        existing.presets.push(preset);
        importedCount++;
      }
    }
    savePresets(existing);
    return { success: true, message: `预设导入成功，新增 ${importedCount} 个预设` };
  } catch (error) {
    return { error: error.message };
  }
});
// Keep the existing ID so saved selections continue to use the bundled Aurora CSS.
const BUILTIN_SKINS = [{
  id: "aurora-premium",
  name: "星辰薄荷",
  description: "浅色渐变、玻璃质感与薄荷色高光"
}];
function loadSkinConfig() {
  try {
    if (fs.existsSync(SKIN_CONFIG_PATH)) {
      const data = fs.readFileSync(SKIN_CONFIG_PATH, "utf-8");
      const config = JSON.parse(data);
      return { activeSkinId: BUILTIN_SKINS.some((skin) => skin.id === config?.activeSkinId) ? config.activeSkinId : null };
    }
  } catch (e) {
    console.error("Failed to load skin config:", e);
  }
  return { activeSkinId: null };
}
function saveSkinConfig(config) {
  try {
    fs.writeFileSync(SKIN_CONFIG_PATH, JSON.stringify(config, null, 2));
  } catch (e) {
    console.error("Failed to save skin config:", e);
    throw e;
  }
}
electron.ipcMain.handle("get-skins", async () => {
  try {
    const skinConfig = loadSkinConfig();
    const skins = BUILTIN_SKINS.map((skin) => ({ ...skin, isActive: skin.id === skinConfig.activeSkinId }));
    return { success: true, skins, activeSkinId: skinConfig.activeSkinId };
  } catch (error) {
    return { error: error.message };
  }
});
electron.ipcMain.handle("set-active-skin", async (_, skinId) => {
  try {
    if (skinId !== null && !BUILTIN_SKINS.some((skin) => skin.id === skinId)) {
      return { success: false, error: "该主题不可用，请选择内置主题" };
    }
    const skinConfig = loadSkinConfig();
    skinConfig.activeSkinId = skinId;
    saveSkinConfig(skinConfig);
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
});
electron.ipcMain.handle("get-active-skin", async () => {
  try {
    const skinConfig = loadSkinConfig();
    if (!skinConfig.activeSkinId) {
      return { success: true, skin: null };
    }
    return { success: true, skin: BUILTIN_SKINS.find((skin) => skin.id === skinConfig.activeSkinId) || null };
  } catch (error) {
    return { error: error.message };
  }
});
electron.ipcMain.handle("get-close-behavior", async () => {
  return { success: true, closeBehavior: currentConfig.closeBehavior || "ask" };
});
electron.ipcMain.handle("set-close-behavior", async (_, behavior) => {
  try {
    currentConfig.closeBehavior = behavior;
    saveConfig(currentConfig);
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
});
electron.ipcMain.handle("set-server-url", async (_, url, options = {}) => {
  try {
    const devMode = !!options?.devMode;
    currentConfig.serverUrl = devMode ? normalizeDeveloperServerUrlInput(url) : normalizePersistedServerUrlInput(url) || DEFAULT_SERVER_URL;
    saveConfig(currentConfig);
    console.log(`[QAQM ServerUrl] 保存服务器地址: ${currentConfig.serverUrl}${devMode ? " (developer mode)" : ""}`);
    return { success: true, serverUrl: currentConfig.serverUrl };
  } catch (error) {
    return { error: error.message };
  }
});
electron.ipcMain.handle("set-ui-zoom", async (_, zoom) => {
  try {
    const clamped = Math.min(1.5, Math.max(0.7, Number(zoom) || 1));
    currentConfig.uiZoom = clamped;
    saveConfig(currentConfig);
    return { success: true, uiZoom: clamped };
  } catch (error) {
    return { error: error.message };
  }
});
electron.ipcMain.handle("set-mod-market-card-size", async (_, size) => {
  try {
    const legacyMap = { small: 88, medium: 100, large: 122 };
    const raw = legacyMap[size] || Number(size);
    const normalized = Math.min(140, Math.max(80, Math.round(Number.isFinite(raw) ? raw : 100)));
    currentConfig.modMarketCardSize = normalized;
    saveConfig(currentConfig);
    return { success: true, modMarketCardSize: normalized };
  } catch (error) {
    return { error: error.message };
  }
});
electron.ipcMain.handle("set-mod-download-image-ratio", async (_, ratio) => {
  try {
    if (!["4:3", "16:9", "16:10", "1:1", "3:4"].includes(ratio)) throw new Error("不支持的封面比例");
    currentConfig.modDownloadImageRatio = ratio;
    saveConfig(currentConfig);
    return { success: true, modDownloadImageRatio: ratio };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
electron.ipcMain.handle("set-compatibility-mode", async (_, enabled) => {
  try {
    const previousLevel = getCompatibilityLevel();
    const nextLevel = typeof enabled === "boolean" ? enabled ? 3 : 0 : normalizeCompatibilityLevel(enabled?.level ?? enabled);
    currentConfig.compatibilityLevel = nextLevel;
    currentConfig.compatibilityMode = nextLevel > 0;
    saveConfig(currentConfig);
    resetOverlayWindowsForModeChange();
    return {
      success: true,
      compatibilityMode: currentConfig.compatibilityMode,
      compatibilityLevel: nextLevel,
      requiresRestart: previousLevel >= 3 || nextLevel >= 3
    };
  } catch (error) {
    return { error: error.message };
  }
});
const MARKED_MODS_EXPORT_PATH = path.join(electron.app.getPath("userData"), "marked-mods-export.json");
electron.ipcMain.handle("export-marked-mods", async (_, entries) => {
  try {
    const payload = {
      exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
      count: entries.length,
      mods: entries
    };
    fs.writeFileSync(MARKED_MODS_EXPORT_PATH, JSON.stringify(payload, null, 2), "utf-8");
    return { success: true, path: MARKED_MODS_EXPORT_PATH };
  } catch (error) {
    console.error("export-marked-mods error:", error);
    return { error: error.message };
  }
});
electron.ipcMain.handle("mark:select-dest-folder", async () => {
  try {
    const result = await electron.dialog.showOpenDialog({
      title: "选择目标文件夹",
      properties: ["openDirectory"],
      buttonLabel: "选择此文件夹"
    });
    if (result.canceled || !result.filePaths.length) return { canceled: true };
    return { success: true, folderPath: result.filePaths[0] };
  } catch (error) {
    return { error: error.message };
  }
});
function resolveMarkedModMoveSource(entry) {
  const candidates = [];
  if (entry?.path) candidates.push(entry.path);
  const gameId2 = entry?.gameId || getActiveGameScopeId();
  if (entry?.characterName && entry?.name)
    candidates.push(resolveCharacterModPath(entry.characterName, entry.name, gameId2));
  if (entry?.characterName && entry?.originalName)
    candidates.push(
      resolveCharacterModPath(
        entry.characterName,
        entry.originalName.replace(/^DISABLED_/i, ""),
        gameId2
      )
    );
  return candidates.find((candidate) => candidate && fs.existsSync(candidate)) || null;
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
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}
async function getDirectoryIntegrityManifest(dirPath) {
  const manifest = [];
  async function walk(currentPath, relativeRoot = "") {
    const items = fs.readdirSync(currentPath, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const item of items) {
      const itemPath = path.join(currentPath, item.name);
      const relativePath = path.join(relativeRoot, item.name).replace(/\\/g, "/");
      if (item.isDirectory()) {
        manifest.push({ type: "dir", path: relativePath });
        await walk(itemPath, relativePath);
      } else if (item.isFile()) {
        const stat = fs.statSync(itemPath);
        const hash = await hashFileForIntegrity(itemPath);
        manifest.push({ type: "file", path: relativePath, size: stat.size, hash });
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
  const normalizedSource = normalizeComparablePath(sourcePath);
  const normalizedTarget = normalizeComparablePath(targetPath);
  if (!normalizedSource || !normalizedTarget) throw new Error("无法解析源路径或目标路径");
  if (normalizedSource === normalizedTarget) throw new Error("目标文件夹与源文件夹相同，已取消移动");
  if (isPathInsideDirectory(targetPath, sourcePath))
    throw new Error("目标文件夹不能位于源 Mod 文件夹内部，已取消移动");
  if (isPathInsideDirectory(sourcePath, targetPath))
    throw new Error("源 Mod 文件夹不能位于目标文件夹内部，已取消移动");
}
async function removeDirectoryAfterVerifiedMove(sourcePath, targetPath) {
  assertSafeMarkedModMovePaths(sourcePath, targetPath);
  if (!await verifyDirectoriesIdentical(sourcePath, targetPath)) {
    throw new Error("目标文件夹完整性校验失败，已保留源文件夹，未执行删除");
  }
  await movePathToRecycleBin(sourcePath, "remove moved source after verified move");
  if (fs.existsSync(sourcePath)) {
    throw new Error("目标已完整复制，但源文件夹删除失败，请检查文件占用或权限");
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
    fs.cpSync(sourcePath, tempTargetPath, { recursive: true });
    if (!await verifyDirectoriesIdentical(sourcePath, tempTargetPath)) {
      throw new Error("临时目标文件夹完整性校验失败，已保留源文件夹，未执行删除");
    }
    fs.renameSync(tempTargetPath, targetPath);
    await removeDirectoryAfterVerifiedMove(sourcePath, targetPath);
  } catch (error) {
    if (fs.existsSync(tempTargetPath)) {
      try {
        fs.rmSync(tempTargetPath, { recursive: true, force: true });
      } catch (_) {
      }
    }
    throw error;
  }
}
electron.ipcMain.handle("mark:move-mods", async (_, { entries, destFolder }) => {
  const results = [];
  for (const entry of entries) {
    const src = resolveMarkedModMoveSource(entry);
    if (!src) {
      const existingDst = resolveMarkedModMoveDestination(entry, destFolder, null);
      if (existingDst && fs.existsSync(existingDst)) {
        if (directoryHasAnyFile(existingDst)) {
          results.push({
            name: entry.name,
            characterName: entry.characterName,
            gameId: entry.gameId,
            markKey: entry.markKey,
            success: false,
            error: `源文件夹不存在，目标位置已有文件夹但无法校验完整性，请手动确认：${existingDst}`
          });
        } else {
          results.push({
            name: entry.name,
            characterName: entry.characterName,
            gameId: entry.gameId,
            markKey: entry.markKey,
            success: false,
            error: `源文件夹不存在，目标位置只存在空目录，未视为移动成功：${existingDst}`
          });
        }
      } else {
        results.push({
          name: entry.name,
          characterName: entry.characterName,
          gameId: entry.gameId,
          markKey: entry.markKey,
          success: false,
          error: "源文件夹不存在，可能已被移动、删除，或启用/禁用状态已改变"
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
        error: "无法解析目标文件夹路径"
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
        error: err.message || "源路径和目标路径不安全"
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
            error: `目标位置已存在同名文件夹且内容不完全一致，已保留源文件夹：${dst}`
          });
        }
      } catch (err) {
        results.push({
          name: entry.name,
          characterName: entry.characterName,
          gameId: entry.gameId,
          markKey: entry.markKey,
          success: false,
          error: err.message || "处理已存在目标文件夹失败"
        });
      }
      continue;
    }
    try {
      fs.mkdirSync(path.dirname(dst), { recursive: true });
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
        error: err.message || "移动失败"
      });
    }
  }
  const record = {
    movedAt: (/* @__PURE__ */ new Date()).toISOString(),
    destFolder,
    moves: results.filter((r) => r.success).map((r) => ({ name: r.name, src: r.src, dst: r.dst }))
  };
  const recordPath = path.join(electron.app.getPath("userData"), "marked-mods-move-record.json");
  fs.writeFileSync(recordPath, JSON.stringify(record, null, 2), "utf-8");
  return { success: true, results, recordPath };
});
electron.ipcMain.handle("mark:restore-mods", async (_, { moves }) => {
  const results = [];
  for (const move of moves) {
    if (!fs.existsSync(move.dst)) {
      if (fs.existsSync(move.src)) {
        results.push({ name: move.name, success: true, alreadyRestored: true });
      } else {
        results.push({
          name: move.name,
          success: false,
          error: "当前位置和原始位置都找不到 Mod 文件夹"
        });
      }
      continue;
    }
    if (fs.existsSync(move.src)) {
      try {
        if (await verifyDirectoriesIdentical(move.dst, move.src)) {
          await removeDirectoryAfterVerifiedMove(move.dst, move.src);
          results.push({ name: move.name, success: true });
        } else {
          results.push({
            name: move.name,
            success: false,
            error: `原始位置已存在同名文件夹且内容不完全一致，已保留当前位置：${move.src}`
          });
        }
      } catch (err) {
        results.push({
          name: move.name,
          success: false,
          error: err.message || "处理已存在原始文件夹失败"
        });
      }
      continue;
    }
    try {
      fs.mkdirSync(path.dirname(move.src), { recursive: true });
      await moveDirectoryWithIntegrityCheck(move.dst, move.src);
      results.push({ name: move.name, success: true });
    } catch (err) {
      results.push({ name: move.name, success: false, error: err.message || "移回失败" });
    }
  }
  return { success: true, results };
});
electron.ipcMain.handle("mark:get-move-record", async () => {
  try {
    const recordPath = path.join(electron.app.getPath("userData"), "marked-mods-move-record.json");
    if (!fs.existsSync(recordPath)) return { success: true, record: null };
    const record = JSON.parse(fs.readFileSync(recordPath, "utf-8"));
    return { success: true, record };
  } catch (error) {
    return { error: error.message };
  }
});
const BATCH_ARCHIVE_EXTS = /* @__PURE__ */ new Set([".zip", ".rar", ".7z", ".exe", ".mp4"]);
const BATCH_IMAGE_EXTS = /* @__PURE__ */ new Set([".png", ".jpg", ".jpeg", ".dds", ".webp", ".bmp", ".gif"]);
const EXTERNAL_EXTRACT_ARCHIVE_EXTS = /* @__PURE__ */ new Set([".zip", ".rar", ".7z", ".exe"]);
const LARGE_ARCHIVE_EXTERNAL_EXTRACT_BYTES = 10 * 1024 * 1024 * 1024;
const MANAGED_UPDATE_ARCHIVE_EXTS = /* @__PURE__ */ new Set([".zip", ".rar", ".7z", ".exe"]);
function getManagedTargetGameId(requestedGameId, importerName = "") {
  const importerGameId = IMPORTER_GAME_IDS[String(importerName || "").toUpperCase()];
  const candidate = String(importerGameId || requestedGameId || getActiveGameScopeId()).trim();
  if (candidate && (getGameById(candidate) || getBuiltInGameDefinition(candidate))) return candidate;
  return getActiveGameScopeId();
}
function getImporterNameForGame(gameId2) {
  return Object.entries(IMPORTER_GAME_IDS).find(([, mappedGameId]) => mappedGameId === gameId2)?.[0] || "";
}
function resolveConfiguredXxmiRoot(gameId2) {
  const candidateLoaders = [];
  const requested = getResolvedGamePaths(gameId2)?.modLoaderPath;
  if (requested) candidateLoaders.push(requested);
  for (const game of currentConfig.games || []) {
    if (game?.modLoaderPath) candidateLoaders.push(game.modLoaderPath);
  }
  for (const legacyPath of [currentConfig.xxmiPath, currentConfig.loaderPath, currentConfig.efmiPath]) {
    if (legacyPath) candidateLoaders.push(legacyPath);
  }
  const seen = /* @__PURE__ */ new Set();
  for (const loaderPath of candidateLoaders) {
    const key = normalizeComparablePath(loaderPath);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const root = deriveXxmiRootFromLoaderPath(loaderPath);
    if (!root) continue;
    const resourcesDir = path.join(root, "Resources");
    if (!fs.existsSync(resourcesDir) || !fs.statSync(resourcesDir).isDirectory()) continue;
    return { root, resourcesDir, loaderPath };
  }
  return null;
}
function describeManagedInstallTarget(contentType, requestedGameId, importerName = "") {
  const normalizedType = normalizeManagedInstallContentType(contentType);
  const gameId2 = getManagedTargetGameId(requestedGameId, importerName);
  if (normalizedType === "fixer") {
    return {
      ok: true,
      contentType: normalizedType,
      gameId: gameId2,
      importerName: getImporterNameForGame(gameId2),
      targetPath: path.join(electron.app.getPath("userData"), "fix", gameId2, "user"),
      label: `${getGameById(gameId2)?.name || getBuiltInGameDefinition(gameId2)?.name || gameId2}独立修复器`
    };
  }
  if (normalizedType === "xxmi-update") {
    const resolved = resolveConfiguredXxmiRoot(gameId2);
    if (!resolved) {
      return {
        ok: false,
        contentType: normalizedType,
        gameId: gameId2,
        importerName: "XXMI",
        error: "无法从已保存的 XXMI Launcher 路径推导 XXMI 根目录，请先在设置中配置加载器路径"
      };
    }
    return {
      ok: true,
      contentType: normalizedType,
      gameId: gameId2,
      importerName: "XXMI",
      targetPath: resolved.resourcesDir,
      rootPath: resolved.root,
      label: `XXMI Resources · ${resolved.root}`
    };
  }
  if (normalizedType === "game-package-update") {
    const resolvedPaths = getResolvedGamePaths(gameId2);
    const packageRoot = deriveGamePackageRootFromModsPath(resolvedPaths?.modsPath);
    const modsPathExists = (() => {
      try {
        return !!resolvedPaths?.modsPath && fs.statSync(resolvedPaths.modsPath).isDirectory();
      } catch (_) {
        return false;
      }
    })();
    const packageRootExists = (() => {
      try {
        return !!packageRoot && fs.statSync(packageRoot).isDirectory();
      } catch (_) {
        return false;
      }
    })();
    if (!packageRoot || !modsPathExists || !packageRootExists) {
      return {
        ok: false,
        contentType: normalizedType,
        gameId: gameId2,
        importerName: String(importerName || getImporterNameForGame(gameId2)).toUpperCase(),
        error: "管理器 Mods 路径必须真实存在且以 Mods 结尾，才能安全推导游戏包根目录"
      };
    }
    return {
      ok: true,
      contentType: normalizedType,
      gameId: gameId2,
      importerName: String(importerName || getImporterNameForGame(gameId2)).toUpperCase(),
      targetPath: packageRoot,
      modsPath: path.resolve(resolvedPaths.modsPath),
      label: `${path.basename(packageRoot)} 游戏包 · ${packageRoot}`
    };
  }
  return { ok: true, contentType: "mod", gameId: gameId2, importerName: "", targetPath: "" };
}
function buildManagedDropScanItem(sourcePath, requestedGameId = getActiveGameScopeId()) {
  const inferred = inferManagedInstallFromName(sourcePath, requestedGameId);
  if (inferred.contentType === "mod") return null;
  let stat;
  try {
    stat = fs.statSync(sourcePath);
  } catch (_) {
    return null;
  }
  const ext = stat.isFile() ? path.extname(sourcePath).toLowerCase() : "";
  if (stat.isFile() && !MANAGED_UPDATE_ARCHIVE_EXTS.has(ext)) return null;
  const target = describeManagedInstallTarget(
    inferred.contentType,
    inferred.targetGameId,
    inferred.importerName
  );
  return {
    name: stat.isFile() && ext ? path.basename(sourcePath, ext) : path.basename(sourcePath),
    path: sourcePath,
    type: stat.isDirectory() ? "folder" : ext ? ext.slice(1) : "file",
    installContentType: inferred.contentType,
    suggestedContentType: inferred.contentType,
    targetGameId: target.gameId,
    importerName: inferred.importerName,
    managedTargetPath: target.targetPath || "",
    managedTargetLabel: target.label || "",
    managedTargetError: target.error || ""
  };
}
function preserveBlockedMarketCache(cache, gameId2, marketAccess, authToken) {
  const preserved = preserveBlockedMarketSnapshot(cache, {
    marketAccess,
    authScope: createMarketAuthScope(authToken)
  });
  saveModCache(preserved, gameId2);
  return normalizeCachePayload({ ...preserved, schemaVersion: CACHE_SCHEMA_VERSION });
}
function buildMarketCacheResult(cache, gameId2, options = {}) {
  const hideCachedMods = options.hideCachedMods === true;
  return {
    success: true,
    mods: hideCachedMods ? [] : normalizeMarketModsForDisplay(cache.mods, gameId2),
    lastSyncTimestamp: cache.lastSyncTimestamp,
    gameId: getMarketGameId(gameId2),
    marketAccess: normalizeMarketAccessPayload(options.marketAccess || cache.marketAccess),
    fromCache: !hideCachedMods,
    refreshBlocked: options.refreshBlocked === true,
    stale: options.stale === true,
    ignoredEmpty: options.ignoredEmpty === true,
    syncError: options.syncError || null,
    wasIncremental: false,
    updatedCount: 0,
    deletedCount: 0
  };
}
function cacheNeedsMarketAuthRefresh(cache, authToken) {
  const access = normalizeMarketAccessPayload(cache?.marketAccess);
  if (isMarketRefreshBlocked(access)) return true;
  if (!access?.controlled) return false;
  return String(cache?.authScope || "") !== createMarketAuthScope(authToken);
}
function isExternalExtractArchivePath(filePath) {
  return EXTERNAL_EXTRACT_ARCHIVE_EXTS.has(path.extname(filePath || "").toLowerCase());
}
function isLargeArchiveForExternalExtraction(filePath, stat = null) {
  if (!isExternalExtractArchivePath(filePath)) return false;
  try {
    const fileStat = stat || fs.statSync(filePath);
    return fileStat.isFile() && fileStat.size > LARGE_ARCHIVE_EXTERNAL_EXTRACT_BYTES;
  } catch (_) {
    return false;
  }
}
function formatLargeArchiveExternalExtractMessage(filePath) {
  return [
    `检测到大型压缩包：${path.basename(filePath || "") || filePath}`,
    `大小：${getFileSizeLabel(filePath)}`,
    "超过 10GB 的 zip/rar/7z/exe 压缩包请先在外部使用 7-Zip、Bandizip 或 WinRAR 解压，再把解压好的文件夹拖进管理器。MP4 伪装 Mod 不受此限制。"
  ].join("\n");
}
function batchLoosePakItem(filePath) {
  const ext = getNevernessPakExt(path.basename(filePath));
  if (!ext || ext === ".sig") return null;
  const baseName = getNevernessPakBaseName(path.basename(filePath));
  const dirPath = path.dirname(filePath);
  const group = scanNevernessPakGroups(dirPath).find((candidate) => candidate.baseName === baseName);
  if (!group) return null;
  return {
    name: baseName,
    path: dirPath,
    type: "pak-folder"
  };
}
function pushBatchItem(items, item) {
  if (!item) return false;
  const key = `${item.type || ""}
${item.path || ""}
${item.name || ""}`;
  if (items.some(
    (existing) => `${existing.type || ""}
${existing.path || ""}
${existing.name || ""}` === key
  ))
    return false;
  items.push(item);
  return true;
}
function createBatchFolderItem(dirPath, extras = {}) {
  return {
    name: path.basename(dirPath) || "Mod",
    path: dirPath,
    type: "folder",
    ...extras
  };
}
function getVisibleDirectoryEntries(dirPath) {
  try {
    return fs.readdirSync(dirPath, { withFileTypes: true }).filter((entry) => entry.isDirectory() && !entry.name.startsWith("."));
  } catch (_) {
    return [];
  }
}
function commonParentPath(paths) {
  const normalized = (paths || []).filter(Boolean).map((p) => path.resolve(p));
  if (!normalized.length) return null;
  const firstParent = path.dirname(normalized[0]);
  return normalized.every((p) => isSameResolvedPath(path.dirname(p), firstParent)) ? firstParent : null;
}
function getBatchPlanOptionSample(names, limit = 3) {
  const values = (names || []).filter(Boolean);
  if (!values.length) return "";
  const shown = values.slice(0, limit).join("、");
  return values.length > limit ? `${shown} 等 ${values.length} 项` : shown;
}
function formatBatchImportDisplayPath(value) {
  return String(value || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}
function getBatchPlanLayerPathLabel(rootPath, rootName, parentDirs, depth) {
  if (depth === 0) return rootName;
  const parents = Array.isArray(parentDirs) ? parentDirs.filter((entry) => entry?.path) : [];
  if (parents.length === 1) {
    return formatBatchImportDisplayPath(
      [rootName, path.relative(rootPath, parents[0].path)].filter(Boolean).join("/")
    ) || rootName;
  }
  const commonParent = commonParentPath(parents.map((entry) => entry.path));
  const commonRelative = commonParent ? path.relative(rootPath, commonParent) : "";
  return formatBatchImportDisplayPath(
    [rootName, commonRelative, "多个同层文件夹"].filter(Boolean).join("/")
  ) || `${rootName}/多个同层文件夹`;
}
function looksLikeNamedModFolder(folderName) {
  const value = String(folderName || "");
  return /[-_—－]/.test(value) && !/^(mods?|resources?|textures?|body|head|lightmap|materialmap|toggles)$/i.test(value);
}
function buildBatchDirectoryImportPlan(dirPath) {
  try {
    if (!dirPath || !fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) return null;
  } catch (_) {
    return null;
  }
  const rootPath = path.resolve(dirPath);
  const rootName = path.basename(rootPath) || "Mod";
  const rootIntegratedStats = getIntegratedModsPackageStats(rootPath);
  const rootIntegratedAmbiguous = !!(rootIntegratedStats && isAmbiguousIntegratedModsSource(rootPath, rootIntegratedStats.sourceModsDir));
  const rootMultiStats = getMultiModPackageStats(rootPath);
  const wholeItem = createBatchFolderItem(rootPath, {
    importMode: "single",
    importPlanRoot: rootPath
  });
  const splitOptions = [];
  const integratedOptions = [];
  let parentDirs = [{ path: rootPath, name: rootName, depth: 0 }];
  for (let depth = 0; depth <= 4; depth++) {
    const childItems = [];
    for (const parent of parentDirs) {
      const children = getVisibleDirectoryEntries(parent.path);
      for (const child of children) {
        const childPath = path.join(parent.path, child.name);
        if (!directoryHasAnyFile(childPath)) continue;
        childItems.push(
          createBatchFolderItem(childPath, {
            importMode: "single",
            importPlanRoot: rootPath,
            importLayerDepth: depth + 1,
            importParentPath: parent.path,
            importParentName: parent.name,
            importRelativePath: path.relative(rootPath, childPath)
          })
        );
      }
    }
    if (childItems.length > 0) {
      const parentNames = parentDirs.map((entry) => entry.name);
      const optionId = `children-depth-${depth}`;
      splitOptions.push({
        id: optionId,
        mode: "multiple",
        depth,
        label: depth === 0 ? `拆分当前文件夹下的内容` : `拆分「${getBatchPlanOptionSample(parentNames)}」下的内容`,
        pathLabel: getBatchPlanLayerPathLabel(rootPath, rootName, parentDirs, depth),
        description: `将显示 ${childItems.length} 个文件夹，可逐个勾选并选择角色分类。`,
        itemCount: childItems.length,
        sampleNames: childItems.slice(0, 6).map((item) => item.name),
        items: childItems
      });
      const integratedSource = parentDirs.length === 1 ? parentDirs[0].path : commonParentPath(parentDirs.map((entry) => entry.path));
      if (integratedSource && directoryHasAnyFile(integratedSource)) {
        const integratedStats = getIntegratedModsPackageStats(integratedSource);
        integratedOptions.push({
          id: `integrated-depth-${depth}`,
          mode: "integrated",
          depth,
          label: depth === 0 ? `从当前文件夹识别整合包` : `从「${getBatchPlanOptionSample(parentNames)}」这一层识别整合包`,
          pathLabel: formatBatchImportDisplayPath(
            [rootName, path.relative(rootPath, integratedSource)].filter(Boolean).join("/")
          ) || rootName,
          description: integratedStats ? `${integratedStats.characterCount || 0} 个角色分类，${integratedStats.modCount || 0} 个 Mod。` : `会按这一层尝试识别 Mods/角色/具体 Mod 结构。`,
          itemCount: 1,
          item: {
            name: path.basename(integratedSource) || "整合包",
            path: integratedSource,
            type: "integrated-package",
            importMode: "integrated",
            importPlanRoot: rootPath,
            importRelativePath: path.relative(rootPath, integratedSource),
            expectedIntegratedPackage: true,
            forceIntegratedPackage: true,
            integratedPackageCandidate: true,
            integratedPackageAmbiguous: false,
            integratedPackageTotalItems: integratedStats?.totalItems || 0,
            integratedPackageModCount: integratedStats?.modCount || 0,
            integratedPackageCharacterCount: integratedStats?.characterCount || 0
          }
        });
      }
    }
    parentDirs = childItems.map((item) => ({
      path: item.path,
      name: item.name,
      depth: depth + 1
    }));
    if (!parentDirs.length) break;
  }
  const defaultMode = (() => {
    if (rootIntegratedStats && !rootIntegratedAmbiguous) return "integrated";
    if (looksLikeNamedModFolder(rootName) || batchDirectoryLooksLikeModRoot(rootPath)) return "single";
    if (rootMultiStats.candidate || splitOptions.some((option) => option.itemCount > 1)) return "multiple";
    return "single";
  })();
  const defaultSplitOption = splitOptions.find((option) => option.itemCount === rootMultiStats.count) || splitOptions.find((option) => option.itemCount > 1) || splitOptions[0] || null;
  const defaultIntegratedOption = integratedOptions.find((option) => option.item.path === rootIntegratedStats?.sourceModsDir) || integratedOptions[0] || null;
  return {
    rootPath,
    rootName,
    wholeItem,
    defaultMode,
    defaultSplitOptionId: defaultSplitOption?.id || null,
    defaultIntegratedOptionId: defaultIntegratedOption?.id || null,
    rootIntegratedCandidate: !!rootIntegratedStats,
    rootIntegratedAmbiguous,
    rootIntegratedStats: rootIntegratedStats ? {
      sourceModsDir: rootIntegratedStats.sourceModsDir,
      characterCount: rootIntegratedStats.characterCount || 0,
      modCount: rootIntegratedStats.modCount || 0,
      totalItems: rootIntegratedStats.totalItems || 0,
      affectedCharacters: rootIntegratedStats.affectedCharacters || []
    } : null,
    rootMultiCandidate: !!rootMultiStats.candidate,
    rootMultiStats,
    splitOptions,
    integratedOptions
  };
}
function getDefaultItemsFromBatchImportPlan(plan, preferredMode = null) {
  if (!plan) return [];
  const mode = preferredMode || plan.defaultMode || "single";
  if (mode === "integrated") {
    const option = plan.integratedOptions?.find((item) => item.id === plan.defaultIntegratedOptionId) || plan.integratedOptions?.[0];
    return option?.item ? [option.item] : [plan.wholeItem];
  }
  if (mode === "multiple") {
    const option = plan.splitOptions?.find((item) => item.id === plan.defaultSplitOptionId) || plan.splitOptions?.[0];
    return option?.items?.length ? option.items : [plan.wholeItem];
  }
  return [plan.wholeItem];
}
function batchIsModFolder(dirPath) {
  try {
    const children = fs.readdirSync(dirPath, { withFileTypes: true });
    const visibleDirs = children.filter((c) => c.isDirectory() && !c.name.startsWith("."));
    let hasLeafImage = false;
    return children.some((c) => {
      if (c.isDirectory() && /^paks?$/i.test(c.name)) {
        return scanNevernessPakGroups(path.join(dirPath, c.name)).length > 0;
      }
      if (c.isFile() && BATCH_IMAGE_EXTS.has(path.extname(c.name).toLowerCase())) {
        hasLeafImage = true;
      }
      return c.isFile() && (c.name.toLowerCase().endsWith(".ini") || !!getNevernessPakExt(c.name));
    }) || visibleDirs.length === 0 && hasLeafImage;
  } catch {
    return false;
  }
}
function batchArchiveItem(filePath, allowExtensionlessDisguised = false) {
  const ext = path.extname(filePath).toLowerCase();
  const shouldProbeDisguised = ext === ".mp4" || ext === ".zip" || allowExtensionlessDisguised && !ext;
  const disguised = shouldProbeDisguised && isDisguisedMp4(filePath);
  if (!BATCH_ARCHIVE_EXTS.has(ext) && !disguised) return null;
  let fileSize = 0;
  try {
    fileSize = fs.statSync(filePath).size;
  } catch (_) {
    fileSize = 0;
  }
  return {
    name: ext ? path.basename(filePath, ext) : path.basename(filePath),
    path: filePath,
    type: ext ? ext.slice(1) : "disguised",
    disguised,
    fileSize,
    largeArchive: isLargeArchiveForExternalExtraction(filePath, fileSize ? { isFile: () => true, size: fileSize } : null)
  };
}
function batchDirectoryLooksLikeModRoot(dirPath) {
  if (batchIsModFolder(dirPath)) return true;
  try {
    const children = fs.readdirSync(dirPath, { withFileTypes: true });
    const visibleDirs = children.filter((entry) => entry.isDirectory() && !entry.name.startsWith("."));
    if (!visibleDirs.length) return false;
    const modLikeChildCount = visibleDirs.filter((entry) => {
      const childPath = path.join(dirPath, entry.name);
      if (batchIsModFolder(childPath)) return true;
      try {
        return fs.readdirSync(childPath, { withFileTypes: true }).some(
          (child) => child.isDirectory() && !child.name.startsWith(".") && /^(meshes|textures|resources?|shaderfixes|shaders?|buf|buffers?)$/i.test(child.name)
        );
      } catch (_) {
        return false;
      }
    }).length;
    return modLikeChildCount > 0 && modLikeChildCount === visibleDirs.length;
  } catch (_) {
    return false;
  }
}
function getMultiModPackageStats(dirPath) {
  try {
    if (!dirPath || !fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
      return { candidate: false, count: 0, names: [] };
    }
    const children = fs.readdirSync(dirPath, { withFileTypes: true });
    const visibleDirs = children.filter((entry) => entry.isDirectory() && !entry.name.startsWith("."));
    const visibleFiles = children.filter((entry) => entry.isFile() && !entry.name.startsWith("."));
    const rootHasModFile = visibleFiles.some((entry) => {
      return entry.name.toLowerCase().endsWith(".ini") || !!getNevernessPakExt(entry.name);
    });
    if (visibleDirs.length < 2 || rootHasModFile) {
      return { candidate: false, count: 0, names: [] };
    }
    const modDirs = visibleDirs.filter((entry) => directoryHasAnyFile(path.join(dirPath, entry.name)));
    if (modDirs.length < 2) {
      return { candidate: false, count: 0, names: [] };
    }
    return {
      candidate: true,
      count: modDirs.length,
      names: modDirs.map((entry) => entry.name)
    };
  } catch (_) {
    return { candidate: false, count: 0, names: [] };
  }
}
function isAmbiguousIntegratedModsSource(sourceRoot, sourceModsDir = null) {
  const modsDir = sourceModsDir || findIntegratedModsDir(sourceRoot);
  if (!sourceRoot || !modsDir) return false;
  try {
    if (path.basename(path.resolve(modsDir)).toLowerCase() === "mods") return false;
    if (path.basename(path.resolve(sourceRoot)).toLowerCase() === "mods") return false;
  } catch (_) {
    return false;
  }
  return batchDirectoryLooksLikeModRoot(sourceRoot);
}
function batchIntegratedPackageItem(dirPath) {
  const modsDir = findIntegratedModsDir(dirPath);
  if (!modsDir) return null;
  return {
    name: path.basename(dirPath) || "整合包",
    path: dirPath,
    type: "integrated-package",
    integratedPackageCandidate: true,
    integratedPackageAmbiguous: isAmbiguousIntegratedModsSource(dirPath, modsDir)
  };
}
function batchDirectoryPlanItem(dirPath, preferredMode = null) {
  const plan = buildBatchDirectoryImportPlan(dirPath);
  if (!plan) return null;
  if (!plan.rootIntegratedCandidate && !plan.rootMultiCandidate && !plan.splitOptions?.length && !batchIsModFolder(dirPath) && !batchDirectoryLooksLikeModRoot(dirPath) && !looksLikeNamedModFolder(path.basename(dirPath))) {
    return null;
  }
  return {
    ...createBatchFolderItem(dirPath),
    type: "folder-plan",
    importPlan: plan,
    selectedImportMode: preferredMode || plan.defaultMode || "single",
    selectedSplitOptionId: plan.defaultSplitOptionId,
    selectedIntegratedOptionId: plan.defaultIntegratedOptionId,
    defaultItems: getDefaultItemsFromBatchImportPlan(plan, preferredMode),
    integratedPackageCandidate: !!plan.rootIntegratedCandidate,
    integratedPackageAmbiguous: !!plan.rootIntegratedAmbiguous,
    multiModCandidate: !!plan.rootMultiCandidate,
    multiModCount: plan.rootMultiStats?.count || 0,
    multiModNames: plan.rootMultiStats?.names || []
  };
}
function batchScanDir(dirPath, items, maxDepth = 5) {
  if (maxDepth <= 0) return false;
  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return false;
  }
  let found = false;
  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);
    const managedItem = buildManagedDropScanItem(entryPath);
    if (managedItem) {
      pushBatchItem(items, managedItem);
      found = true;
      continue;
    }
    if (entry.isDirectory()) {
      const integratedPackageItem = batchIntegratedPackageItem(entryPath);
      if (integratedPackageItem) {
        pushBatchItem(items, integratedPackageItem);
        found = true;
      } else if (batchIsModFolder(entryPath)) {
        pushBatchItem(items, batchDirectoryPlanItem(entryPath) || createBatchFolderItem(entryPath));
        found = true;
      } else {
        const foundInner = batchScanDir(entryPath, items, maxDepth - 1);
        if (foundInner) found = true;
      }
    } else if (entry.isFile()) {
      const item = batchArchiveItem(entryPath, false);
      const loosePakItem = item ? null : batchLoosePakItem(entryPath);
      if (item || loosePakItem) {
        pushBatchItem(items, item || loosePakItem);
        found = true;
      }
    }
  }
  return found;
}
function scanBatchPaths(paths) {
  const items = [];
  if (!Array.isArray(paths) || paths.length === 0) return items;
  for (const p of paths) {
    let stat;
    try {
      stat = fs.statSync(p);
    } catch {
      continue;
    }
    const managedItem = buildManagedDropScanItem(p);
    if (managedItem) {
      pushBatchItem(items, managedItem);
      continue;
    }
    if (stat.isDirectory()) {
      const name = path.basename(p);
      const planItem = batchDirectoryPlanItem(p);
      if (planItem) {
        pushBatchItem(items, planItem);
      } else {
        const innerItems = [];
        const foundInner = batchScanDir(p, innerItems);
        if (foundInner) {
          items.push(...innerItems);
        } else {
          items.push(createBatchFolderItem(p, { name }));
        }
      }
    } else if (stat.isFile()) {
      const item = batchArchiveItem(p, true);
      const loosePakItem = item ? null : batchLoosePakItem(p);
      pushBatchItem(items, item || loosePakItem);
    }
  }
  return items;
}
electron.ipcMain.handle("batch:scan-folder", async () => {
  try {
    const result = await electron.dialog.showOpenDialog(mainWindowRef, {
      title: "选择包含 Mod 的文件夹",
      properties: ["openDirectory"]
    });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    const folderPath = result.filePaths[0];
    const rootPlanItem = batchDirectoryPlanItem(folderPath);
    if (rootPlanItem) {
      return { folderPath, items: [rootPlanItem] };
    }
    const items = [];
    const entries = fs.readdirSync(folderPath, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(folderPath, entry.name);
      const managedItem = buildManagedDropScanItem(entryPath);
      if (managedItem) {
        pushBatchItem(items, managedItem);
        continue;
      }
      if (entry.isDirectory()) {
        const integratedPackageItem = batchIntegratedPackageItem(entryPath);
        if (integratedPackageItem) {
          pushBatchItem(items, integratedPackageItem);
        } else if (batchIsModFolder(entryPath)) {
          pushBatchItem(items, batchDirectoryPlanItem(entryPath) || createBatchFolderItem(entryPath));
        } else {
          const innerItems = [];
          const foundInner = batchScanDir(entryPath, innerItems);
          if (foundInner) {
            items.push(...innerItems);
          } else {
            items.push(createBatchFolderItem(entryPath));
          }
        }
      } else if (entry.isFile()) {
        const item = batchArchiveItem(entryPath, true);
        const loosePakItem = item ? null : batchLoosePakItem(entryPath);
        pushBatchItem(items, item || loosePakItem);
      }
    }
    return { folderPath, items };
  } catch (error) {
    return { error: error.message };
  }
});
electron.ipcMain.handle("batch:select-files", async (_, options = {}) => {
  try {
    const title = typeof options?.title === "string" && options.title.trim() ? options.title.trim() : "选择要批量导入的 Mod 文件";
    const buttonLabel = typeof options?.buttonLabel === "string" && options.buttonLabel.trim() ? options.buttonLabel.trim() : "选择";
    const filterName = typeof options?.filterName === "string" && options.filterName.trim() ? options.filterName.trim() : "Mod 文件";
    const result = await electron.dialog.showOpenDialog(mainWindowRef, {
      title,
      properties: ["openFile", "multiSelections"],
      filters: [
        { name: filterName, extensions: ["zip", "rar", "7z", "exe", "mp4"] },
        { name: "All Files", extensions: ["*"] }
      ],
      buttonLabel
    });
    if (result.canceled || !result.filePaths.length) return { canceled: true };
    return { filePaths: result.filePaths, items: scanBatchPaths(result.filePaths) };
  } catch (error) {
    return { error: error.message, items: [] };
  }
});
electron.ipcMain.handle("batch:scan-paths", async (_, { paths }) => {
  try {
    return { items: scanBatchPaths(paths) };
  } catch (error) {
    return { error: error.message, items: [] };
  }
});
electron.ipcMain.handle("batch:decrypt-all", async (event, { items }) => {
  const results = [];
  const total = Array.isArray(items) ? items.length : 0;
  for (let idx = 0; idx < total; idx++) {
    const item = items[idx];
    let tmpDir = null;
    try {
      const filePath = item.path;
      const ext = path.extname(filePath).toLowerCase();
      const sourceStat = fs.statSync(filePath);
      const installContentType = normalizeManagedInstallContentType(item.installContentType);
      if (installContentType !== "mod") {
        const target = describeManagedInstallTarget(
          installContentType,
          item.targetGameId,
          item.importerName
        );
        const managedResult = {
          originalPath: filePath,
          tempPath: null,
          realName: item.name || path.basename(filePath, ext),
          success: true,
          installContentType,
          targetGameId: target.gameId,
          importerName: item.importerName || target.importerName || "",
          managedTargetPath: target.targetPath || "",
          managedTargetLabel: target.label || "",
          managedTargetError: target.error || ""
        };
        event.sender.send("batch:decrypt-progress", {
          idx,
          total,
          status: "done",
          realName: managedResult.realName,
          installContentType,
          managedTargetLabel: managedResult.managedTargetLabel,
          managedTargetError: managedResult.managedTargetError
        });
        results.push(managedResult);
        continue;
      }
      const disguised = sourceStat.isFile() && isDisguisedMp4(filePath);
      let realName = null;
      if (sourceStat.isFile() && isLargeArchiveForExternalExtraction(filePath, sourceStat)) {
        const message = formatLargeArchiveExternalExtractMessage(filePath);
        logger.info(`[batch:decrypt-all] Large archive requires external extraction: ${filePath}`);
        event.sender.send("batch:decrypt-progress", {
          idx,
          total,
          status: "error",
          code: "LARGE_ARCHIVE_EXTERNAL_EXTRACT",
          error: message
        });
        results.push({
          originalPath: filePath,
          tempPath: null,
          realName: item.name,
          success: false,
          code: "LARGE_ARCHIVE_EXTERNAL_EXTRACT",
          largeArchive: true,
          error: message
        });
        continue;
      }
      if (sourceStat.isDirectory()) {
        const integratedStats2 = getIntegratedModsPackageStats(filePath);
        const forcedIntegratedPackage2 = !!(item.forceIntegratedPackage || item.expectedIntegratedPackage || item.installAsIntegratedPackage || item.importMode === "integrated");
        const integratedPackageCandidate2 = forcedIntegratedPackage2 || !!item.integratedPackageCandidate || !!integratedStats2;
        const integratedPackageAmbiguous2 = !!(!forcedIntegratedPackage2 && (item.integratedPackageAmbiguous || integratedStats2 && isAmbiguousIntegratedModsSource(filePath, integratedStats2.sourceModsDir)));
        const multiModStats2 = integratedPackageCandidate2 ? { candidate: false, count: 0, names: [] } : getMultiModPackageStats(filePath);
        event.sender.send("batch:decrypt-progress", {
          idx,
          total,
          status: "done",
          realName: item.name,
          integratedPackageCandidate: integratedPackageCandidate2,
          integratedPackageAmbiguous: integratedPackageAmbiguous2,
          forceIntegratedPackage: forcedIntegratedPackage2,
          integratedPackageTotalItems: integratedStats2?.totalItems || 0,
          integratedPackageModCount: integratedStats2?.modCount || 0,
          integratedPackageCharacterCount: integratedStats2?.characterCount || 0,
          multiModCandidate: !!multiModStats2.candidate,
          multiModCount: multiModStats2.count || 0,
          multiModNames: multiModStats2.names || [],
          skippedDirectoryCopy: true
        });
        results.push({
          originalPath: filePath,
          tempPath: null,
          realName: item.name,
          success: true,
          integratedPackageCandidate: integratedPackageCandidate2,
          integratedPackageAmbiguous: integratedPackageAmbiguous2,
          forceIntegratedPackage: forcedIntegratedPackage2,
          integratedPackageTotalItems: integratedStats2?.totalItems || 0,
          integratedPackageModCount: integratedStats2?.modCount || 0,
          integratedPackageCharacterCount: integratedStats2?.characterCount || 0,
          multiModCandidate: !!multiModStats2.candidate,
          multiModCount: multiModStats2.count || 0,
          multiModNames: multiModStats2.names || [],
          skippedDirectoryCopy: true
        });
        continue;
      }
      tmpDir = ensureTempRootNearPath(filePath, `.qaqm-batch-${Date.now()}-${idx}`);
      if (disguised) {
        event.sender.send("batch:decrypt-progress", {
          idx,
          total,
          status: "running",
          stage: "prepare",
          message: "准备解密 MP4..."
        });
        const innerZipName = await extractDisguisedMp4(filePath, tmpDir, {
          onProgress: (progress) => {
            event.sender.send("batch:decrypt-progress", {
              idx,
              total,
              status: progress?.status === "done" ? "running" : progress?.status || "running",
              stage: progress?.stage || "",
              message: progress?.message || "正在解密...",
              currentBytes: progress?.currentBytes || 0,
              totalBytes: progress?.totalBytes || 0
            });
          }
        });
        realName = innerZipName || null;
      } else if (sourceStat.isFile() && ext === ".mp4") {
        logger.info(`[batch:decrypt-all] Skipped plain MP4: ${filePath}`);
        if (tmpDir)
          try {
            fs.rmSync(tmpDir, { recursive: true, force: true });
          } catch (_) {
          }
        event.sender.send("batch:decrypt-progress", {
          idx,
          total,
          status: "skipped",
          reason: "plain-mp4"
        });
        results.push({
          originalPath: filePath,
          tempPath: null,
          realName: item.name,
          success: false,
          skipped: true,
          reason: "plain-mp4"
        });
        continue;
      } else if (ext === ".zip") {
        event.sender.send("batch:decrypt-progress", {
          idx,
          total,
          status: "running",
          stage: "extract-zip",
          message: "正在解压 ZIP..."
        });
        await extractArchiveWithExternalTool(filePath, tmpDir);
      } else if ([".rar", ".7z", ".exe"].includes(ext)) {
        event.sender.send("batch:decrypt-progress", {
          idx,
          total,
          status: "running",
          stage: "extract-archive",
          message: "正在解压压缩包..."
        });
        await extract7zOrRar(filePath, tmpDir);
      } else {
        throw new Error("Unsupported file format");
      }
      assertDirectoryHasAnyFile(tmpDir, "Batch decrypt");
      const integratedStats = getIntegratedModsPackageStats(tmpDir);
      const forcedIntegratedPackage = !!(item.forceIntegratedPackage || item.expectedIntegratedPackage || item.installAsIntegratedPackage || item.importMode === "integrated");
      const integratedPackageCandidate = forcedIntegratedPackage || !!integratedStats;
      const integratedPackageAmbiguous = !!(!forcedIntegratedPackage && (item.integratedPackageAmbiguous || integratedStats && isAmbiguousIntegratedModsSource(tmpDir, integratedStats.sourceModsDir)));
      const multiModStats = integratedPackageCandidate ? { candidate: false, count: 0, names: [] } : getMultiModPackageStats(tmpDir);
      if (!realName) {
        const extracted = fs.readdirSync(tmpDir);
        if (extracted.length === 1 && fs.statSync(path.join(tmpDir, extracted[0])).isDirectory()) {
          realName = extracted[0];
        } else {
          realName = item.name;
        }
      }
      event.sender.send("batch:decrypt-progress", {
        idx,
        total,
        status: "done",
        realName,
        integratedPackageCandidate,
        integratedPackageAmbiguous,
        forceIntegratedPackage: forcedIntegratedPackage,
        integratedPackageTotalItems: integratedStats?.totalItems || 0,
        integratedPackageModCount: integratedStats?.modCount || 0,
        integratedPackageCharacterCount: integratedStats?.characterCount || 0,
        multiModCandidate: !!multiModStats.candidate,
        multiModCount: multiModStats.count || 0,
        multiModNames: multiModStats.names || []
      });
      results.push({
        originalPath: filePath,
        tempPath: tmpDir,
        realName,
        success: true,
        integratedPackageCandidate: integratedPackageCandidate || !!item.integratedPackageCandidate,
        integratedPackageAmbiguous,
        forceIntegratedPackage: forcedIntegratedPackage,
        integratedPackageTotalItems: integratedStats?.totalItems || 0,
        integratedPackageModCount: integratedStats?.modCount || 0,
        integratedPackageCharacterCount: integratedStats?.characterCount || 0,
        multiModCandidate: !!multiModStats.candidate,
        multiModCount: multiModStats.count || 0,
        multiModNames: multiModStats.names || []
      });
    } catch (e) {
      logger.warn(`[batch:decrypt-all] Failed for ${item.path}: ${e.message}`);
      if (tmpDir)
        try {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch (_) {
        }
      event.sender.send("batch:decrypt-progress", { idx, total, status: "error", error: e.message });
      results.push({
        originalPath: item.path,
        tempPath: null,
        realName: item.name,
        success: false,
        error: e.message
      });
    }
  }
  return { results };
});
electron.ipcMain.handle("batch:add-mods", async (event, { items }) => {
  const results = [];
  const installedPaths = [];
  const gameId2 = getActiveGameScopeId();
  organizeLegacyCharacterFoldersIfNeeded(gameId2);
  const batchItems = Array.isArray(items) ? items : [];
  const total = batchItems.length;
  const progressWeights = batchItems.map((item) => {
    const integratedTotal = Number(item?.integratedPackageTotalItems || item?.integratedPackageModCount || 0);
    const multiModTotal = Number(item?.multiModCount || 0);
    if (item?.installAsMultipleMods && Number.isFinite(multiModTotal) && multiModTotal > 1) {
      return multiModTotal;
    }
    return item?.expectedIntegratedPackage && Number.isFinite(integratedTotal) && integratedTotal > 0 ? integratedTotal : 1;
  });
  let overallProgressTotal = progressWeights.reduce((sum, weight) => sum + weight, 0);
  let completedProgress = 0;
  function setBatchItemProgressWeight(idx, nextWeight) {
    const safeWeight = Number.isFinite(Number(nextWeight)) && Number(nextWeight) > 0 ? Number(nextWeight) : 1;
    if (safeWeight > progressWeights[idx]) {
      overallProgressTotal += safeWeight - progressWeights[idx];
      progressWeights[idx] = safeWeight;
    }
    return progressWeights[idx] || 1;
  }
  function sendBatchProgress(current, payload = {}) {
    const safeTotal = Math.max(1, overallProgressTotal || total || 1);
    const safeCurrent = Math.max(0, Math.min(Number(current) || 0, safeTotal));
    event.sender.send("batch:progress", {
      ...payload,
      current: safeCurrent,
      total: safeTotal
    });
  }
  function sendBatchItemProgress(idx, itemCurrent, itemTotal, payload = {}) {
    const itemWeight = setBatchItemProgressWeight(idx, itemTotal || progressWeights[idx]);
    const safeItemCurrent = Math.max(0, Math.min(Number(itemCurrent) || 0, itemWeight));
    sendBatchProgress(completedProgress + safeItemCurrent, payload);
  }
  function completeBatchItem(idx, payload = {}, itemTotal = null) {
    const itemWeight = setBatchItemProgressWeight(idx, itemTotal || progressWeights[idx]);
    completedProgress += itemWeight;
    sendBatchProgress(completedProgress, payload);
  }
  for (let idx = 0; idx < total; idx++) {
    const item = batchItems[idx];
    const { filePath } = item;
    let characterName = String(item.characterName || "").trim();
    let modName = String(item.modName || (item.expectedIntegratedPackage ? "整合包" : "")).replace(/^DISABLED_/i, "").trim();
    let targetPath = null;
    try {
      const installTarget = resolveCanonicalCharacterInstallTarget(characterName, gameId2, {
        ensure: false
      });
      characterName = installTarget.characterName || characterName;
      modName = assertSafeAppearancePathSegment(modName || "Mod", "Mod 名称");
      if (isNevernessGame(gameId2)) {
        const pakDetection = await detectNevernessDx12PakSource(item.tempPath || filePath);
        if (pakDetection.isPak) {
          setNevernessModMode("dx12");
          const result = await importNevernessDx12PakMod(characterName, item.tempPath || filePath, {
            ...item,
            name: modName
          }, { gameId: gameId2, notify: false });
          if (item.tempPath && fs.existsSync(item.tempPath)) {
            try {
              fs.rmSync(item.tempPath, { recursive: true, force: true });
            } catch (_) {
            }
          }
          results.push({
            modName,
            characterName,
            modMode: "pak",
            appearanceSectionId: result?.appearanceSectionId || BASE_APPEARANCE_SECTION_ID,
            success: !!result?.success,
            error: result?.error
          });
          completeBatchItem(idx, {
            modName,
            success: !!result?.success
          });
          continue;
        }
        setNevernessModMode("nemi");
      }
      const preparedPath = item.tempPath && fs.existsSync(item.tempPath) ? item.tempPath : null;
      const shouldInstallIntegrated = !!(item.installAsIntegratedPackage || item.expectedIntegratedPackage);
      const integratedSourcePath = shouldInstallIntegrated ? preparedPath || (item.expectedIntegratedPackage && filePath && fs.existsSync(filePath) ? filePath : null) : null;
      if (integratedSourcePath) {
        const integratedResult = await installIntegratedModsPackageIfPresent(integratedSourcePath, {
          cleanupSource: !!preparedPath,
          gameId: gameId2,
          appearanceRequest: item,
          appearanceCharacterName: characterName,
          onProgress: (progress) => {
            sendBatchItemProgress(idx, progress.current, progress.total, {
              ...progress,
              success: null,
              integratedPackage: true
            });
          }
        });
        if (integratedResult?.success) {
          installedPaths.push(...integratedResult.installedModDirs || []);
          results.push({
            ...integratedResult,
            modName: modName || "整合包",
            success: true
          });
          completeBatchItem(idx, {
            modName: "整合包安装完成",
            success: true,
            integratedPackage: true
          }, integratedResult.totalItems || integratedResult.modCount || null);
          continue;
        }
      }
      if (shouldInstallIntegrated) {
        if (preparedPath && fs.existsSync(preparedPath)) {
          try {
            fs.rmSync(preparedPath, { recursive: true, force: true });
          } catch (_) {
          }
        }
        results.push({
          modName: modName || "整合包",
          characterName: "__all__",
          expectedIntegratedPackage: true,
          success: false,
          error: "未检测到整合包结构：需要包含 Mods\\角色\\具体mod"
        });
        completeBatchItem(idx, {
          modName: "整合包",
          success: false,
          expectedIntegratedPackage: true
        });
        continue;
      }
      if (item.installAsMultipleMods) {
        const multipleSourcePath = preparedPath || (filePath && fs.existsSync(filePath) && fs.statSync(filePath).isDirectory() ? filePath : null);
        const multipleCharPath = resolveCanonicalCharacterInstallTarget(characterName, gameId2).characterPath;
        if (!multipleSourcePath || !multipleCharPath) {
          results.push({ modName, characterName, success: false, error: "Multiple Mod source not found" });
          completeBatchItem(idx, { modName, success: false });
          continue;
        }
        const installed = installMultipleModsFromRoot(multipleSourcePath, multipleCharPath, {
          moveSource: !!preparedPath
        });
        installed.forEach((entry) => {
          restorePersistBakFiles(entry.targetPath);
          const appearance2 = assignInstalledModAppearance({
            characterName,
            modName: entry.modName,
            modDir: entry.targetPath,
            requested: item,
            gameId: gameId2,
            source: extractRequestedAppearanceTarget(item).sectionId || extractRequestedAppearanceTarget(item).skinId ? "explicit-batch" : "name-match"
          });
          entry.appearanceSectionId = appearance2.sectionId;
          clearConflictCache(characterName, gameId2);
          installedPaths.push(entry.targetPath);
        });
        if (preparedPath && fs.existsSync(preparedPath)) {
          try {
            fs.rmSync(preparedPath, { recursive: true, force: true });
          } catch (_) {
          }
        }
        results.push({
          modName: modName || `${installed.length} Mods`,
          characterName,
          modMode: "d3d",
          success: true,
          multipleMods: true,
          modCount: installed.length,
          installedMods: installed.map((entry) => entry.modName),
          installedModDetails: installed.map((entry) => ({
            modName: entry.modName,
            appearanceSectionId: entry.appearanceSectionId
          }))
        });
        completeBatchItem(
          idx,
          { modName: `${installed.length} Mods`, success: true, multipleMods: true },
          installed.length
        );
        continue;
      }
      const charPath = resolveCanonicalCharacterInstallTarget(characterName, gameId2).characterPath;
      if (!charPath) {
        results.push({ modName, characterName, success: false, error: "无法确定 Mods 目录" });
        completeBatchItem(idx, { modName, success: false });
        continue;
      }
      targetPath = path.join(charPath, modName);
      const disabledTargetPath = path.join(charPath, `DISABLED_${modName}`);
      if (fs.existsSync(targetPath) || fs.existsSync(disabledTargetPath)) {
        results.push({ modName, characterName, success: false, error: "同名 Mod 已存在" });
        completeBatchItem(idx, { modName, success: false });
        continue;
      }
      const tempPath = item.tempPath || null;
      if (tempPath && fs.existsSync(tempPath)) {
        assertDirectoryHasAnyFile(tempPath, "Prepared mod import");
        moveDirectoryWithFallback(tempPath, targetPath);
      } else {
        const ext = path.extname(filePath).toLowerCase();
        const sourceStat = fs.statSync(filePath);
        const disguised = sourceStat.isFile() && isDisguisedMp4(filePath);
        if (disguised) {
          await extractDisguisedMp4(filePath, targetPath);
        } else if (ext === ".zip") {
          await extractArchiveWithExternalTool(filePath, targetPath);
        } else if ([".rar", ".7z", ".exe"].includes(ext)) {
          await extractArchiveWithExternalTool(filePath, targetPath);
        } else if (ext === ".mp4") {
          results.push({ modName, characterName, success: false, error: "此 MP4 不是伪装 Mod" });
          completeBatchItem(idx, { modName, success: false });
          continue;
        } else if (sourceStat.isDirectory()) {
          fs.cpSync(filePath, targetPath, { recursive: true });
        } else {
          results.push({ modName, characterName, success: false, error: "不支持的格式" });
          completeBatchItem(idx, { modName, success: false });
          continue;
        }
      }
      if (shouldInstallIntegrated) {
        const integratedResult = await installIntegratedModsPackageIfPresent(targetPath, {
          cleanupSource: true,
          gameId: gameId2,
          appearanceRequest: item,
          appearanceCharacterName: characterName,
          onProgress: (progress) => {
            sendBatchItemProgress(idx, progress.current, progress.total, {
              ...progress,
              success: null,
              integratedPackage: true
            });
          }
        });
        if (integratedResult?.success) {
          targetPath = null;
          installedPaths.push(...integratedResult.installedModDirs || []);
          results.push({
            ...integratedResult,
            modName: modName || "整合包",
            success: true
          });
          completeBatchItem(idx, {
            modName: "整合包安装完成",
            success: true,
            integratedPackage: true
          }, integratedResult.totalItems || integratedResult.modCount || null);
          continue;
        }
      }
      assertDirectoryHasAnyFile(targetPath, "Mod import");
      clearConflictCache(characterName, gameId2);
      const batchRestoredCount = restorePersistBakFiles(targetPath);
      if (batchRestoredCount > 0) {
        logger.info(`Restored ${batchRestoredCount} .qaqm-persistbak file(s) in ${targetPath}`);
      }
      const appearance = assignInstalledModAppearance({
        characterName,
        modName,
        modDir: targetPath,
        requested: item,
        gameId: gameId2,
        source: extractRequestedAppearanceTarget(item).sectionId || extractRequestedAppearanceTarget(item).skinId ? "explicit-batch" : "name-match"
      });
      installedPaths.push(targetPath);
      results.push({
        modName,
        characterName,
        modMode: "d3d",
        appearanceSectionId: appearance.sectionId,
        success: true
      });
      completeBatchItem(idx, { modName, success: true });
    } catch (e) {
      if (targetPath) {
        try {
          fs.rmSync(targetPath, { recursive: true, force: true });
        } catch (_) {
        }
      }
      results.push({
        modName,
        characterName,
        success: false,
        error: formatWindowsFileOperationError(e, {
          path: targetPath || filePath,
          operation: "batch-add-mod"
        })
      });
      completeBatchItem(idx, { modName, success: false });
    }
  }
  if (isNevernessGame(gameId2) && results.some((item) => item.success && item.modMode === "pak")) {
    setNevernessModMode("dx12");
  }
  try {
    const env = resolveActiveGameEnvRoot(gameId2);
    if (env?.root && isPersistBridgeEnabled(gameId2)) {
      for (const p of installedPaths) {
        ensurePersistBridgeMigrationForModDir(env.root, p);
      }
    }
    if (gameId2 === getActiveGameScopeId()) await ensureKeypressBridgeForActiveGame();
  } catch (_) {
  }
  const successfulResults = results.filter((item) => item?.success);
  if (successfulResults.length > 0) {
    notifyCharacterListChanged("__all__", {
      reason: "batch-import",
      changedCharacterNames: Array.from(
        new Set(successfulResults.map((item) => item?.characterName).filter(Boolean))
      )
    });
  }
  return { results };
});
async function extractManagedUpdateArchive(archivePath, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
  const ext = path.extname(archivePath).toLowerCase();
  if (ext === ".exe") {
    const unrarExe = getUnrarPath();
    if (!unrarExe) throw new Error("无法解压 EXE 更新包：未找到 UnRAR.exe");
    const result = await spawnExtract(unrarExe, ["x", "-y", archivePath, targetDir + path.sep]);
    if (result.code !== 0) {
      throw new Error(`UnRAR 解压更新包失败 (code ${result.code}): ${result.stderr || result.stdout}`);
    }
    return;
  }
  const sevenZipResult = await spawnExtract(get7zaPath(), [
    "x",
    archivePath,
    `-o${targetDir}`,
    "-y",
    "-aoa"
  ]);
  if (sevenZipResult.code === 0) return;
  if (isBandizipAvailable()) {
    const bandizipResult = await spawnExtract(BANDIZIP_PATH, [
      "x",
      archivePath,
      `-o:${targetDir}`,
      "-y",
      "-aoa"
    ]);
    if (bandizipResult.code === 0) return;
    throw new Error(
      `更新包解压失败：7zip(code ${sevenZipResult.code}) 和 Bandizip(code ${bandizipResult.code}) 均失败`
    );
  }
  throw new Error(
    `7zip 解压更新包失败 (code ${sevenZipResult.code}): ${sevenZipResult.stderr || sevenZipResult.stdout}`
  );
}
async function prepareManagedUpdateSource(sourcePath) {
  const resolvedSource = path.resolve(String(sourcePath || ""));
  const stat = fs.statSync(resolvedSource);
  if (stat.isDirectory()) return { sourceDir: resolvedSource, cleanup: null };
  const ext = path.extname(resolvedSource).toLowerCase();
  if (!MANAGED_UPDATE_ARCHIVE_EXTS.has(ext)) {
    throw new Error("组件更新仅支持文件夹、zip、rar、7z 或 exe 自解压包");
  }
  const tempDir = fs.mkdtempSync(path.join(electron.app.getPath("temp"), "qaqm-managed-update-"));
  try {
    await extractManagedUpdateArchive(resolvedSource, tempDir);
    assertDirectoryHasAnyFile(tempDir, "Managed update package");
    return {
      sourceDir: tempDir,
      cleanup: () => {
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (_) {
        }
      }
    };
  } catch (error) {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_) {
    }
    throw error;
  }
}
function collectManagedUpdateFiles(sourceDir) {
  const files = [];
  let totalBytes = 0;
  const visit = (dirPath, relativeDir = "") => {
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      const relativePath = path.join(relativeDir, entry.name);
      if (relativePathTouchesMods(relativePath)) continue;
      const sourcePath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        visit(sourcePath, relativePath);
        continue;
      }
      if (!entry.isFile()) continue;
      const size = fs.statSync(sourcePath).size;
      totalBytes += size;
      if (files.length >= 2e4 || totalBytes > 4 * 1024 * 1024 * 1024) {
        throw new Error("更新包展开后的文件数量或总大小超过安全上限");
      }
      files.push({ sourcePath, relativePath, size });
    }
  };
  visit(sourceDir);
  return { files, totalBytes };
}
function resolveRealPathForPotentialWrite(targetPath) {
  let cursor = path.resolve(targetPath);
  const missingSegments = [];
  while (!fs.existsSync(cursor)) {
    const parent = path.dirname(cursor);
    if (!parent || parent === cursor) {
      throw new Error(`无法解析组件更新目标路径: ${targetPath}`);
    }
    missingSegments.unshift(path.basename(cursor));
    cursor = parent;
  }
  const realExistingPath = fs.realpathSync.native ? fs.realpathSync.native(cursor) : fs.realpathSync(cursor);
  return path.resolve(realExistingPath, ...missingSegments);
}
function copyManagedUpdateFiles(sourceDir, targetDir, protectedModsPath = "") {
  const sourceRoot = path.resolve(sourceDir);
  const targetRoot = path.resolve(targetDir);
  if (isSameResolvedPath(sourceRoot, targetRoot)) {
    throw new Error("更新来源与目标目录相同，未执行覆盖");
  }
  if (!fs.existsSync(targetRoot) || !fs.statSync(targetRoot).isDirectory()) {
    throw new Error(`组件更新目标目录不存在: ${targetRoot}`);
  }
  const probePath = path.join(targetRoot, `.qaqm-managed-update-test-${process.pid}-${Date.now()}`);
  try {
    fs.writeFileSync(probePath, "ok");
    fs.rmSync(probePath, { force: true });
  } catch (error) {
    try {
      if (fs.existsSync(probePath)) fs.rmSync(probePath, { force: true });
    } catch (_) {
    }
    throw new Error(
      `组件更新目标目录不可写：${formatWindowsFileOperationError(error, {
        path: targetRoot,
        operation: "write-test"
      })}`
    );
  }
  const { files, totalBytes } = collectManagedUpdateFiles(sourceRoot);
  if (!files.length) throw new Error("更新包中没有可覆盖的文件（Mods 内容会被强制忽略）");
  const protectedRoot = protectedModsPath ? path.resolve(protectedModsPath) : "";
  const targetRootReal = resolveRealPathForPotentialWrite(targetRoot);
  const protectedRootReal = protectedRoot ? resolveRealPathForPotentialWrite(protectedRoot) : "";
  let copiedFiles = 0;
  for (const file of files) {
    const destination = path.resolve(targetRoot, file.relativePath);
    if (!isPathInsideDirectory(destination, targetRoot)) {
      throw new Error(`更新包包含越界路径: ${file.relativePath}`);
    }
    if (protectedRoot && (normalizeComparablePath(destination) === normalizeComparablePath(protectedRoot) || isPathInsideDirectory(destination, protectedRoot))) {
      throw new Error(`安全检查阻止写入 Mods: ${file.relativePath}`);
    }
    const realDestination = resolveRealPathForPotentialWrite(destination);
    if (normalizeComparablePath(realDestination) !== normalizeComparablePath(targetRootReal) && !isPathInsideDirectory(realDestination, targetRootReal)) {
      throw new Error(`安全检查阻止通过链接写出游戏包目录: ${file.relativePath}`);
    }
    if (protectedRootReal && (normalizeComparablePath(realDestination) === normalizeComparablePath(protectedRootReal) || isPathInsideDirectory(realDestination, protectedRootReal))) {
      throw new Error(`安全检查阻止通过链接写入 Mods: ${file.relativePath}`);
    }
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(file.sourcePath, destination);
    copiedFiles += 1;
  }
  return { copiedFiles, totalBytes };
}
async function installManagedComponentUpdate(sourcePath, target) {
  const prepared = await prepareManagedUpdateSource(sourcePath);
  try {
    let sourceDir = prepared.sourceDir;
    if (target.contentType === "xxmi-update") {
      sourceDir = resolveXxmiUpdateSourceDir(sourceDir);
    } else {
      sourceDir = resolveGamePackageUpdateSourceDir(sourceDir, target.targetPath);
    }
    if (!sourceDir || !fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) {
      throw new Error("无法识别更新包的有效内容目录");
    }
    if (path.basename(sourceDir).toLowerCase() === "mods") {
      throw new Error("更新来源指向 Mods，已阻止安装以避免污染 Mod 源文件");
    }
    const copied = copyManagedUpdateFiles(sourceDir, target.targetPath, target.modsPath || "");
    return {
      success: true,
      managedInstall: true,
      installContentType: target.contentType,
      targetGameId: target.gameId,
      importerName: target.importerName,
      targetPath: target.targetPath,
      copiedFiles: copied.copiedFiles,
      copiedBytes: copied.totalBytes,
      modName: target.contentType === "xxmi-update" ? "XXMI 更新" : `${target.importerName || path.basename(target.targetPath)} 游戏包更新`
    };
  } finally {
    prepared.cleanup?.();
  }
}
electron.ipcMain.handle("managed-package:install", async (_, payload = {}) => {
  try {
    const rawSourcePath = String(payload.sourcePath || "").trim();
    if (!rawSourcePath) return { success: false, error: "安装来源为空" };
    const sourcePath = path.resolve(rawSourcePath);
    if (!fs.existsSync(sourcePath)) {
      return { success: false, error: `安装来源不存在: ${payload.sourcePath || ""}` };
    }
    const contentType = normalizeManagedInstallContentType(payload.installContentType);
    if (contentType === "mod") {
      return { success: false, error: "Mod 内容必须使用现有 Mod 安装流程" };
    }
    const inferred = inferManagedInstallFromName(sourcePath, payload.gameId);
    const inferredGamePackage = inferred.contentType === "game-package-update";
    const importerName = contentType === "game-package-update" ? String(payload.importerName || (inferredGamePackage ? inferred.importerName : "") || "").toUpperCase() : "";
    const requestedGameId = contentType === "game-package-update" && inferredGamePackage && inferred.importerName ? inferred.targetGameId : payload.gameId;
    const target = describeManagedInstallTarget(contentType, requestedGameId, importerName);
    if (!target.ok) return { success: false, error: target.error, installContentType: contentType };
    if (contentType === "fixer") {
      return await installManagedFixerFromSource(sourcePath, target.gameId);
    }
    return await installManagedComponentUpdate(sourcePath, target);
  } catch (error) {
    logger.error(`[ManagedInstall] Failed: ${error?.stack || error}`);
    return {
      success: false,
      error: formatWindowsFileOperationError(error, {
        path: payload?.sourcePath,
        operation: "managed-package-install"
      })
    };
  }
});
electron.ipcMain.handle("fetch-my-feedback", async (event, { serverUrl, clientId }) => {
  try {
    if (!serverUrl || !clientId) return { success: false, feedbacks: [] };
    const url = `${serverUrl}/api/mod-feedback/my?clientId=${encodeURIComponent(clientId)}`;
    const res = await fetch(url, {
      headers: { "ngrok-skip-browser-warning": "true" }
    });
    const data = await res.json();
    return data;
  } catch (e) {
    console.error("fetch-my-feedback error:", e);
    return { success: false, feedbacks: [], error: e.message };
  }
});
let devCopiedModInfo = null;
function getDevModInfoClipboardDir() {
  const dir = path.join(electron.app.getPath("userData"), "DevModInfoClipboard");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
function cleanupPreviousDevCopiedPreview() {
  try {
    const previewPath = devCopiedModInfo?.cachedPreviewPath;
    const cacheDir = getDevModInfoClipboardDir();
    if (previewPath && fs.existsSync(previewPath) && path.dirname(previewPath).toLowerCase() === cacheDir.toLowerCase()) {
      fs.unlinkSync(previewPath);
    }
  } catch (_) {
  }
}
function removeExistingModPreviewImages(modDir) {
  if (!modDir || !fs.existsSync(modDir)) return;
  const files = fs.readdirSync(modDir);
  for (const file of files) {
    if (!/^(preview|cover)\./i.test(file)) continue;
    if (!/\.(png|jpg|jpeg|webp|gif|bmp|svg|ico|tiff|tif)$/i.test(file)) continue;
    try {
      fs.unlinkSync(path.join(modDir, file));
    } catch (e) {
      logger.warn(`[DevModInfo] Failed to delete old preview ${file}: ${e.message}`);
    }
  }
}
function validateDevModDirectory(modPath) {
  if (!modPath || typeof modPath !== "string") return "Mod 文件夹不存在";
  if (!fs.existsSync(modPath)) return `Mod 文件夹不存在: ${modPath}`;
  if (!fs.statSync(modPath).isDirectory()) return `不是有效的 Mod 文件夹: ${modPath}`;
  return null;
}
electron.ipcMain.handle("dev:get-mod-tags", async (_, { modPath }) => {
  try {
    return { success: true, tags: readModTagsFromDir(modPath) };
  } catch (e) {
    return { success: false, tags: [], error: e.message };
  }
});
electron.ipcMain.handle("dev:set-mod-tags", async (_, { modPath, tags }) => {
  try {
    writeModTagsToDir(modPath, tags);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
electron.ipcMain.handle("dev:copy-mod-info", async (_, { modPath, modName, characterName, gameId: gameId2 } = {}) => {
  try {
    const validationError = validateDevModDirectory(modPath);
    if (validationError) return { success: false, error: validationError };
    const tags = readModTagsFromDir(modPath);
    const previewPath = findModPreviewImageFile(modPath);
    cleanupPreviousDevCopiedPreview();
    let cachedPreviewPath = null;
    if (previewPath && fs.existsSync(previewPath)) {
      const ext = path.extname(previewPath).toLowerCase() || ".png";
      cachedPreviewPath = path.join(getDevModInfoClipboardDir(), `${crypto.randomUUID()}${ext}`);
      fs.copyFileSync(previewPath, cachedPreviewPath);
    }
    const sourceModName = modName || path.basename(modPath);
    devCopiedModInfo = {
      sourceModPath: modPath,
      sourceModName,
      characterName: characterName || "",
      gameId: gameId2 || getActiveGameScopeId(),
      tags,
      cachedPreviewPath,
      copiedAt: Date.now()
    };
    await electron.clipboard.writeText(
      [
        "QAQ Mod 信息已复制",
        `Mod: ${sourceModName}`,
        characterName ? `角色: ${characterName}` : "",
        `Tags: ${tags.join(", ") || "无"}`,
        cachedPreviewPath ? `封面: ${path.basename(cachedPreviewPath)}` : "封面: 无"
      ].filter(Boolean).join("\n")
    );
    return {
      success: true,
      sourceModName,
      tagCount: tags.length,
      tags,
      hasPreview: !!cachedPreviewPath,
      copiedAt: devCopiedModInfo.copiedAt
    };
  } catch (e) {
    logger.error(`[DevModInfo] copy failed: ${e.message}`);
    return { success: false, error: e.message };
  }
});
electron.ipcMain.handle("dev:import-mod-info", async (_, { modPath } = {}) => {
  try {
    if (!devCopiedModInfo) return { success: false, error: "请先复制一个 Mod 的 tag 和封面" };
    const validationError = validateDevModDirectory(modPath);
    if (validationError) return { success: false, error: validationError };
    const tags = writeModTagsToDir(modPath, devCopiedModInfo.tags || []);
    let previewUrl = null;
    let copiedImage = false;
    let newPreviewPath = null;
    const sourcePreviewPath = devCopiedModInfo.cachedPreviewPath;
    if (sourcePreviewPath && fs.existsSync(sourcePreviewPath)) {
      removeExistingModPreviewImages(modPath);
      const ext = path.extname(sourcePreviewPath).toLowerCase() || ".png";
      newPreviewPath = path.join(modPath, `preview${ext}`);
      fs.copyFileSync(sourcePreviewPath, newPreviewPath);
      previewUrl = readImageAsDataUrl(newPreviewPath);
      copiedImage = true;
    }
    return {
      success: true,
      sourceModName: devCopiedModInfo.sourceModName,
      tagCount: tags.length,
      tags,
      copiedImage,
      newPreviewPath,
      previewUrl
    };
  } catch (e) {
    logger.error(`[DevModInfo] import failed: ${e.message}`);
    return { success: false, error: e.message };
  }
});
electron.ipcMain.handle("mod:get-meta", async (_, { modPath }) => {
  try {
    if (!modPath)
      return { success: false, tags: [], notes: "", hotkeyAliases: {}, error: "modPath required" };
    const tagsFile = path.join(modPath, "tags.json");
    if (!fs.existsSync(tagsFile)) return { success: true, tags: [], notes: "", hotkeyAliases: {} };
    const meta = JSON.parse(fs.readFileSync(tagsFile, "utf-8")) || {};
    const tags = Array.isArray(meta.tags) ? meta.tags.map((t) => typeof t === "string" ? t : t && t.name ? String(t.name) : "").filter(Boolean) : [];
    const notes = typeof meta.notes === "string" ? meta.notes : "";
    const hotkeyAliases = {};
    if (meta.hotkeyAliases && typeof meta.hotkeyAliases === "object" && !Array.isArray(meta.hotkeyAliases)) {
      for (const [section, alias] of Object.entries(meta.hotkeyAliases)) {
        if (typeof alias === "string" && alias.trim()) hotkeyAliases[section] = alias;
      }
    }
    return { success: true, tags, notes, hotkeyAliases };
  } catch (e) {
    return { success: false, tags: [], notes: "", hotkeyAliases: {}, error: e.message };
  }
});
electron.ipcMain.handle("mod:set-meta", async (_, { modPath, tags, notes, hotkeyAliases }) => {
  try {
    if (!modPath) return { success: false, error: "modPath required" };
    const tagsFile = path.join(modPath, "tags.json");
    let existing = {};
    if (fs.existsSync(tagsFile)) {
      try {
        existing = JSON.parse(fs.readFileSync(tagsFile, "utf-8")) || {};
      } catch (_2) {
        existing = {};
      }
    }
    const next = { ...existing };
    if (Array.isArray(tags)) {
      next.tags = tags.map((t) => typeof t === "string" ? t : t && t.name ? String(t.name) : "").filter(Boolean);
    }
    if (typeof notes === "string") next.notes = notes;
    if (hotkeyAliases && typeof hotkeyAliases === "object" && !Array.isArray(hotkeyAliases)) {
      const prior = existing.hotkeyAliases && typeof existing.hotkeyAliases === "object" && !Array.isArray(existing.hotkeyAliases) ? { ...existing.hotkeyAliases } : {};
      for (const [section, alias] of Object.entries(hotkeyAliases)) {
        if (typeof alias !== "string" || !alias.trim()) {
          delete prior[section];
        } else {
          prior[section] = alias.trim().slice(0, 80);
        }
      }
      next.hotkeyAliases = prior;
    }
    fs.writeFileSync(tagsFile, JSON.stringify(next, null, 2), "utf-8");
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
electron.ipcMain.handle("dev:mark-mod", async (_, { gameId: gameId2, characterName, modName, modPath }) => {
  try {
    setMarkedModForConfig(gameId2, characterName, modName, {
      name: modName,
      characterName,
      gameId: gameId2,
      path: modPath,
      originalPath: modPath,
      markedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    notifyMarkedModsChanged(gameId2, characterName);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
electron.ipcMain.handle("dev:unmark-mod", async (_, { gameId: gameId2, characterName, modName }) => {
  try {
    deleteMarkedModFromConfig(gameId2, characterName, modName);
    notifyMarkedModsChanged(gameId2, characterName);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
electron.ipcMain.handle("dev:get-marked-mods", async (_, { gameId: gameId2 }) => {
  try {
    const marked = getMarkedModsForGame(gameId2);
    return { success: true, marked };
  } catch (e) {
    return { success: false, marked: {}, error: e.message };
  }
});
electron.ipcMain.handle("dev:select-migrate-dest", async () => {
  try {
    const { dialog: dialog2 } = require("electron");
    const defaultPath = currentConfig.lastMigrateTarget || electron.app.getPath("desktop");
    const result = await dialog2.showOpenDialog({
      title: "选择迁移目标文件夹",
      defaultPath,
      properties: ["openDirectory", "createDirectory"]
    });
    if (result.canceled || !result.filePaths.length) return { success: false, canceled: true };
    const dest = result.filePaths[0];
    currentConfig.lastMigrateTarget = dest;
    saveConfig(currentConfig);
    return { success: true, dest };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
electron.ipcMain.handle("dev:migrate-mods", async (_, { gameId: gameId2, destFolder }) => {
  try {
    const marked = currentConfig.markedMods?.[gameId2] || {};
    if (!currentConfig.migratedMods) currentConfig.migratedMods = [];
    const results = [];
    for (const [charName, mods] of Object.entries(marked)) {
      for (const [modName, info] of Object.entries(mods)) {
        const src = info.originalPath;
        if (!src || !fs.existsSync(src)) {
          results.push({ modName, success: false, error: "源路径不存在" });
          continue;
        }
        const dest = path.join(destFolder, path.basename(src));
        try {
          fs.renameSync(src, dest);
          currentConfig.migratedMods.push({
            gameId: gameId2,
            characterName: charName,
            modName,
            originalPath: src,
            currentPath: dest
          });
          results.push({ modName, success: true, dest });
        } catch (e) {
          results.push({ modName, success: false, error: e.message });
        }
      }
    }
    if (currentConfig.markedMods) delete currentConfig.markedMods[gameId2];
    saveConfig(currentConfig);
    return { success: true, results };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
electron.ipcMain.handle("dev:migrate-mods-back", async (_, { gameId: gameId2 }) => {
  try {
    if (!currentConfig.migratedMods?.length) return { success: true, results: [] };
    const toRestore = gameId2 ? currentConfig.migratedMods.filter((m) => m.gameId === gameId2) : currentConfig.migratedMods;
    const results = [];
    for (const entry of toRestore) {
      if (!fs.existsSync(entry.currentPath)) {
        results.push({ modName: entry.modName, success: false, error: "当前路径不存在" });
        continue;
      }
      const originalDir = path.dirname(entry.originalPath);
      if (!fs.existsSync(originalDir)) fs.mkdirSync(originalDir, { recursive: true });
      try {
        fs.renameSync(entry.currentPath, entry.originalPath);
        results.push({ modName: entry.modName, success: true });
      } catch (e) {
        results.push({ modName: entry.modName, success: false, error: e.message });
      }
    }
    const restoredPaths = new Set(results.filter((r) => r.success).map((r) => r.modName));
    currentConfig.migratedMods = currentConfig.migratedMods.filter(
      (m) => !(m.gameId === gameId2 && restoredPaths.has(m.modName))
    );
    saveConfig(currentConfig);
    return { success: true, results };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
electron.ipcMain.handle("dev:get-migrated-mods", async (_, { gameId: gameId2 }) => {
  try {
    const all = currentConfig.migratedMods || [];
    const filtered = gameId2 ? all.filter((m) => m.gameId === gameId2) : all;
    return { success: true, migratedMods: filtered };
  } catch (e) {
    return { success: false, migratedMods: [], error: e.message };
  }
});
const WUWA_FIX_GAME_ID = "wuthering-waves";
const WUWA_INDEPENDENT_CONFIG_NAME = "config.json";
const MANAGED_FIXER_MANIFEST_NAME = "active-fixer.json";
const MANAGED_FIXER_RUNTIME_DIR = "runtimes";
const MANAGED_FIXER_MAX_FILES = 1e4;
const MANAGED_FIXER_MAX_BYTES = 1024 * 1024 * 1024;
function resolveFixRequestGameId(requestedGameId) {
  const gameId2 = String(requestedGameId || getActiveGameScopeId()).trim();
  if (!gameId2 || !getGameById(gameId2) && !getBuiltInGameDefinition(gameId2)) {
    throw new Error(`修复请求的游戏无效: ${gameId2 || "空"}`);
  }
  return gameId2;
}
function getManagedFixerUserDir(gameId2) {
  const safeGameId = assertSafeAppearancePathSegment(gameId2, "游戏 ID");
  return path.join(electron.app.getPath("userData"), "fix", safeGameId, "user");
}
function getManagedFixerManifestPath(gameId2) {
  return path.join(getManagedFixerUserDir(gameId2), MANAGED_FIXER_MANIFEST_NAME);
}
function promoteManagedFixerFallbackManifest(gameId2) {
  const manifestPath = getManagedFixerManifestPath(gameId2);
  const active = resolveManagedFixerForGame(gameId2);
  if (!active || isSameResolvedPath(active.manifestPath, manifestPath)) return false;
  const tempPath = `${manifestPath}.recover-${process.pid}-${Date.now()}`;
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(tempPath, JSON.stringify(active.manifest, null, 2) + "\n", "utf8");
  try {
    if (fs.existsSync(manifestPath)) fs.rmSync(manifestPath, { force: true });
    fs.renameSync(tempPath, manifestPath);
    logger.info(`[Fix] Promoted valid fallback fixer manifest before update: ${active.manifestPath}`);
    return true;
  } catch (error) {
    try {
      if (fs.existsSync(tempPath)) fs.rmSync(tempPath, { force: true });
    } catch (_) {
    }
    throw error;
  }
}
function writeManagedFixerManifest(gameId2, manifest) {
  const manifestPath = getManagedFixerManifestPath(gameId2);
  const dirPath = path.dirname(manifestPath);
  const tempPath = `${manifestPath}.tmp-${process.pid}-${Date.now()}`;
  const backupPath = `${manifestPath}.bak`;
  promoteManagedFixerFallbackManifest(gameId2);
  fs.mkdirSync(dirPath, { recursive: true });
  fs.writeFileSync(tempPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  try {
    if (fs.existsSync(manifestPath)) {
      if (fs.existsSync(backupPath)) fs.rmSync(backupPath, { force: true });
      fs.renameSync(manifestPath, backupPath);
    }
    fs.renameSync(tempPath, manifestPath);
  } catch (error) {
    try {
      if (!fs.existsSync(manifestPath) && fs.existsSync(backupPath)) {
        fs.renameSync(backupPath, manifestPath);
      }
    } catch (_) {
    }
    try {
      if (fs.existsSync(tempPath)) fs.rmSync(tempPath, { force: true });
    } catch (_) {
    }
    throw error;
  }
  return manifestPath;
}
function readManagedFixerManifestCandidates(gameId2) {
  const candidates = [];
  for (const manifestPath of [
    getManagedFixerManifestPath(gameId2),
    `${getManagedFixerManifestPath(gameId2)}.bak`
  ]) {
    try {
      if (!fs.existsSync(manifestPath)) continue;
      const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      if (parsed && typeof parsed === "object" && parsed.schemaVersion === 1) {
        candidates.push({ manifestPath, manifest: parsed });
      }
    } catch (error) {
      logger.warn(`[Fix] Ignoring invalid managed fixer manifest ${manifestPath}: ${error?.message || error}`);
    }
  }
  return candidates;
}
function resolveManagedFixerForGame(gameId2) {
  const baseDir = getManagedFixerUserDir(gameId2);
  for (const loaded of readManagedFixerManifestCandidates(gameId2)) {
    const relativeExe = String(loaded.manifest.executable || "");
    const exePath = path.resolve(baseDir, relativeExe);
    if (!relativeExe || !isPathInsideDirectory(exePath, baseDir) || !fs.existsSync(exePath)) {
      logger.warn(
        `[Fix] Managed fixer manifest points to a missing or unsafe path (${loaded.manifestPath}): ${relativeExe}`
      );
      continue;
    }
    let actualSha256 = "";
    try {
      actualSha256 = hashFileSha256(exePath);
    } catch (_) {
      continue;
    }
    const expectedSha256 = String(loaded.manifest.sha256 || "").toLowerCase();
    if (!expectedSha256 || actualSha256.toLowerCase() !== expectedSha256) {
      logger.warn(`[Fix] Managed fixer hash mismatch (${loaded.manifestPath}): ${exePath}`);
      continue;
    }
    const relativeRuntimeRoot = String(loaded.manifest.runtimeRoot || "");
    const runtimeDir = relativeRuntimeRoot ? path.resolve(baseDir, relativeRuntimeRoot) : path.dirname(exePath);
    if (!isPathInsideDirectory(runtimeDir, baseDir) || !fs.existsSync(runtimeDir)) {
      logger.warn(`[Fix] Managed fixer runtime root is missing or unsafe: ${runtimeDir}`);
      continue;
    }
    if (gameId2 === WUWA_FIX_GAME_ID) {
      const configPath = path.join(runtimeDir, WUWA_INDEPENDENT_CONFIG_NAME);
      const expectedConfigSha256 = String(loaded.manifest.configSha256 || "").toLowerCase();
      try {
        if (!expectedConfigSha256 || !fs.existsSync(configPath) || hashFileSha256(configPath).toLowerCase() !== expectedConfigSha256) {
          logger.warn(`[Fix] Managed Wuwa fixer config hash mismatch: ${configPath}`);
          continue;
        }
        inspectWuwaIndependentConfig(configPath, { expectedVersion: "" });
      } catch (error) {
        logger.warn(`[Fix] Managed Wuwa fixer config is invalid: ${error?.message || error}`);
        continue;
      }
    }
    return {
      ...loaded,
      exePath,
      runtimeDir,
      sha256: actualSha256,
      originalName: loaded.manifest.originalName || path.basename(exePath)
    };
  }
  return null;
}
function listFixerExeCandidates(rootDir, maxDepth = 5) {
  const candidates = [];
  const visit = (dirPath, depth) => {
    if (depth > maxDepth) return;
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      const entryPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        visit(entryPath, depth + 1);
      } else if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".exe") {
        candidates.push({ path: entryPath, depth });
      }
    }
  };
  visit(rootDir, 0);
  return candidates;
}
function chooseFixerExecutable(rootDir, sourceName = "") {
  const candidates = listFixerExeCandidates(rootDir);
  if (!candidates.length) throw new Error("修复器包中没有找到 exe 文件");
  const sourceStem = path.basename(sourceName, path.extname(sourceName)).toLowerCase();
  const scored = candidates.map((candidate) => {
    const stem = path.basename(candidate.path, ".exe").toLowerCase();
    let score = -candidate.depth * 4;
    if (/(^|[\s._-])fix(?:er|tool)?(?=$|[\s._-])/i.test(stem) || /修复/.test(stem)) score += 100;
    if (/^(unins|uninstall|setup|update|crash)/i.test(stem)) score -= 200;
    if (sourceStem && (sourceStem.includes(stem) || stem.includes(sourceStem))) score += 20;
    return { ...candidate, score };
  });
  scored.sort((left, right) => right.score - left.score || left.path.localeCompare(right.path));
  if (scored.length > 1 && scored[0].score === scored[1].score) {
    throw new Error("修复器包包含多个 exe，无法确定主程序；请将修复器单独打包后重试");
  }
  return scored[0].path;
}
function findFixerRuntimeRoot(sourceExe, packageRoot, gameId2) {
  const exeDir = path.dirname(sourceExe);
  if (gameId2 !== WUWA_FIX_GAME_ID) return exeDir;
  const boundary = path.resolve(packageRoot);
  let cursor = path.resolve(exeDir);
  while (isSameResolvedPath(cursor, boundary) || isPathInsideDirectory(cursor, boundary)) {
    const configPath = path.join(cursor, WUWA_INDEPENDENT_CONFIG_NAME);
    if (fs.existsSync(configPath) && fs.statSync(configPath).isFile()) {
      inspectWuwaIndependentConfig(configPath, { expectedVersion: "" });
      return cursor;
    }
    if (isSameResolvedPath(cursor, boundary)) break;
    const parent = path.dirname(cursor);
    if (!parent || parent === cursor) break;
    cursor = parent;
  }
  throw new Error("鸣潮独立修复器缺少有效的 config.json，未替换当前修复器");
}
function copyDirectFixerSidecars(sourceExe, targetDir) {
  const sourceDir = path.dirname(sourceExe);
  const knownFiles = /* @__PURE__ */ new Set(["config.json", "translations.json", "language.json", "lang.json"]);
  const knownDirs = /* @__PURE__ */ new Set(["lang", "locales"]);
  fs.copyFileSync(sourceExe, path.join(targetDir, path.basename(sourceExe)));
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const lowerName = entry.name.toLowerCase();
    if (entry.isFile() && knownFiles.has(lowerName)) {
      fs.copyFileSync(path.join(sourceDir, entry.name), path.join(targetDir, entry.name));
    } else if (entry.isDirectory() && knownDirs.has(lowerName)) {
      fs.cpSync(path.join(sourceDir, entry.name), path.join(targetDir, entry.name), {
        recursive: true,
        dereference: false
      });
    }
  }
}
async function prepareFixerInstallSource(sourcePath) {
  const resolvedSource = path.resolve(sourcePath);
  const stat = fs.statSync(resolvedSource);
  if (stat.isDirectory()) {
    return { rootDir: resolvedSource, cleanup: null, sourceName: path.basename(resolvedSource) };
  }
  const ext = path.extname(resolvedSource).toLowerCase();
  const tempDir = fs.mkdtempSync(path.join(electron.app.getPath("temp"), "qaqm-fixer-install-"));
  try {
    if (ext === ".exe") {
      copyDirectFixerSidecars(resolvedSource, tempDir);
    } else if ([".zip", ".rar", ".7z"].includes(ext)) {
      await extractArchiveWithExternalTool(resolvedSource, tempDir);
    } else {
      throw new Error("修复器仅支持 exe、文件夹、zip、rar 或 7z");
    }
    assertDirectoryHasAnyFile(tempDir, "Fixer package");
    return {
      rootDir: tempDir,
      cleanup: () => {
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (_) {
        }
      },
      sourceName: path.basename(resolvedSource)
    };
  } catch (error) {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_) {
    }
    throw error;
  }
}
function collectFixerRuntimeFiles(runtimeRoot) {
  const files = [];
  let totalBytes = 0;
  const visit = (dirPath, relativeDir = "") => {
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      const relativePath = path.join(relativeDir, entry.name);
      const sourcePath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        visit(sourcePath, relativePath);
        continue;
      }
      if (!entry.isFile() || entry.name.toLowerCase() === "settings.json") continue;
      totalBytes += fs.statSync(sourcePath).size;
      if (files.length >= MANAGED_FIXER_MAX_FILES || totalBytes > MANAGED_FIXER_MAX_BYTES) {
        throw new Error("修复器运行包的文件数量或总大小超过安全上限");
      }
      files.push({ sourcePath, relativePath });
    }
  };
  visit(runtimeRoot);
  return { files, totalBytes };
}
async function installManagedFixerFromSource(sourcePath, requestedGameId) {
  const gameId2 = getManagedTargetGameId(requestedGameId);
  const prepared = await prepareFixerInstallSource(sourcePath);
  let runtimeDir = "";
  let manifestWritten = false;
  try {
    const sourceExe = chooseFixerExecutable(prepared.rootDir, prepared.sourceName);
    const runtimeRoot = findFixerRuntimeRoot(sourceExe, prepared.rootDir, gameId2);
    const sourceExeRelativePath = path.relative(runtimeRoot, sourceExe);
    const sourceConfigPath = gameId2 === WUWA_FIX_GAME_ID ? path.join(runtimeRoot, WUWA_INDEPENDENT_CONFIG_NAME) : "";
    const sourceConfigSha256 = sourceConfigPath ? hashFileSha256(sourceConfigPath) : "";
    const { files, totalBytes } = collectFixerRuntimeFiles(runtimeRoot);
    const sourceSha256 = hashFileSha256(sourceExe);
    const installId = `${sourceSha256.slice(0, 16)}-${Date.now().toString(36)}`;
    const userDir = getManagedFixerUserDir(gameId2);
    runtimeDir = path.join(userDir, MANAGED_FIXER_RUNTIME_DIR, installId);
    fs.mkdirSync(runtimeDir, { recursive: true });
    for (const file of files) {
      const destination = path.resolve(runtimeDir, file.relativePath);
      if (!isPathInsideDirectory(destination, runtimeDir)) {
        throw new Error(`修复器包包含越界路径: ${file.relativePath}`);
      }
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(file.sourcePath, destination);
    }
    const copiedExe = path.resolve(runtimeDir, sourceExeRelativePath);
    if (!fs.existsSync(copiedExe) || hashFileSha256(copiedExe) !== sourceSha256) {
      throw new Error("修复器复制后 SHA-256 校验失败");
    }
    let configMetadata = null;
    let configSha256 = "";
    if (gameId2 === WUWA_FIX_GAME_ID) {
      const copiedConfig = path.join(runtimeDir, WUWA_INDEPENDENT_CONFIG_NAME);
      configMetadata = inspectWuwaIndependentConfig(copiedConfig, { expectedVersion: "" });
      configSha256 = hashFileSha256(copiedConfig);
      if (configSha256 !== sourceConfigSha256) {
        throw new Error("鸣潮独立修复器 config.json 复制后校验失败");
      }
    }
    const relativeExe = path.relative(userDir, copiedExe);
    const manifest = {
      schemaVersion: 1,
      gameId: gameId2,
      executable: relativeExe,
      runtimeRoot: path.relative(userDir, runtimeDir),
      originalName: path.basename(sourceExe),
      sha256: sourceSha256,
      configVersion: configMetadata?.currentVersion || "",
      configSha256,
      installedAt: (/* @__PURE__ */ new Date()).toISOString(),
      fileCount: files.length,
      totalBytes
    };
    writeManagedFixerManifest(gameId2, manifest);
    manifestWritten = true;
    const active = resolveManagedFixerForGame(gameId2);
    if (!active || !isSameResolvedPath(active.exePath, copiedExe) || active.sha256 !== sourceSha256) {
      throw new Error("修复器已复制，但活动版本解析校验失败");
    }
    logger.info(`[Fix] Managed fixer installed game=${gameId2} exe=${active.exePath} sha256=${active.sha256}`);
    return {
      success: true,
      managedInstall: true,
      installContentType: "fixer",
      targetGameId: gameId2,
      targetPath: runtimeDir,
      resolvedExePath: active.exePath,
      sha256: active.sha256,
      fileName: active.originalName,
      fileCount: files.length,
      modName: `${getGameById(gameId2)?.name || getBuiltInGameDefinition(gameId2)?.name || gameId2}独立修复器`
    };
  } catch (error) {
    if (manifestWritten) {
      const manifestPath = getManagedFixerManifestPath(gameId2);
      const backupPath = `${manifestPath}.bak`;
      try {
        if (fs.existsSync(manifestPath)) fs.rmSync(manifestPath, { force: true });
        if (fs.existsSync(backupPath)) fs.renameSync(backupPath, manifestPath);
      } catch (_) {
      }
    }
    if (runtimeDir) {
      try {
        fs.rmSync(runtimeDir, { recursive: true, force: true });
      } catch (_) {
      }
    }
    throw error;
  } finally {
    prepared.cleanup?.();
  }
}
function resolveFixExePath(gameId2) {
  const managed = resolveManagedFixerForGame(gameId2);
  if (managed) {
    logger.info(`[Fix] Using managed user fixer: ${managed.exePath} sha256=${managed.sha256}`);
    return managed.exePath;
  }
  const overrideDir = path.join(electron.app.getPath("userData"), "fix", gameId2);
  const userOverride = path.join(overrideDir, "_override.exe");
  try {
    if (fs.existsSync(userOverride)) {
      if (gameId2 === WUWA_FIX_GAME_ID && !fs.existsSync(path.join(overrideDir, WUWA_INDEPENDENT_CONFIG_NAME))) {
        logger.warn("[WuwaFix] Ignoring legacy override without config.json");
      } else {
        logger.info(`[Fix] Using legacy override: ${userOverride}`);
        return userOverride;
      }
    }
  } catch (_) {
  }
  return null;
}
function hashFileSha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}
function inspectWuwaIndependentConfig(configPath, { expectedVersion = "" } = {}) {
  let config;
  try {
    config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (error) {
    throw new Error(`独立修复器配置无效：${error?.message || error}`);
  }
  const currentVersion = String(config?.version?.current_version || "").trim();
  if (!currentVersion) {
    throw new Error("独立修复器配置缺少 version.current_version");
  }
  if (expectedVersion && currentVersion !== expectedVersion) {
    throw new Error(
      `独立修复器配置版本错误：需要 ${expectedVersion}，实际 ${currentVersion || "空"}`
    );
  }
  for (const key of ["start_processing", "process_file_start", "no_need_fix"]) {
    const translation = config?.lang?.[key]?.zh;
    if (typeof translation !== "string" || !translation.trim()) {
      throw new Error(`独立修复器配置缺少中文日志：${key}`);
    }
  }
  const characters = config?.characters;
  const characterCount = characters && typeof characters === "object" && !Array.isArray(characters) ? Object.keys(characters).length : 0;
  if (characterCount === 0) throw new Error("独立修复器配置不包含角色修复规则");
  return { currentVersion, characterCount };
}
const independentFixer = createIndependentFixer({
  getSavedPath: (gameId) => currentConfig.independentFixerPaths?.[gameId],
  savePath: (gameId, exePath) => {
    const next = {
      ...currentConfig,
      independentFixerPaths: { ...currentConfig.independentFixerPaths, [gameId]: exePath }
    };
    if (!saveConfig(next)) throw new Error("保存修复器路径失败，请重试");
    currentConfig = next;
  },
  findExisting: resolveFixExePath,
  selectFile: (gameId) => electron.dialog.showOpenDialog(mainWindowRef, {
    title: "选择" + (getGameById(gameId)?.name || getBuiltInGameDefinition(gameId)?.name || "当前游戏") + "的独立修复器",
    buttonLabel: "选择修复器",
    filters: [{ name: "修复器程序", extensions: ["exe"] }],
    properties: ["openFile"]
  }),
  launch: (exePath, workingDir) => windowsLauncher.launch(exePath, workingDir, [], { requireElevation: false })
});
electron.ipcMain.handle("fix:get-exe-path", async (_, options = {}) => {
  const gameId2 = resolveFixRequestGameId(options?.gameId);
  const exePath = independentFixer.resolve(gameId2);
  return { engine: "external", gameId: gameId2, exePath };
});
electron.ipcMain.handle("fix:run-all", async (_, options = {}) => {
  try {
    const gameId2 = resolveFixRequestGameId(options?.gameId);
    return await independentFixer.open(gameId2);
  } catch (e) {
    return { success: false, error: e.message };
  }
});
electron.ipcMain.handle("fix:run-character", async (_, payload = {}) => {
  try {
    const { gameId: requestedGameId } = payload || {};
    const gameId2 = resolveFixRequestGameId(requestedGameId);
    return await independentFixer.open(gameId2);
  } catch (e) {
    return { success: false, error: e.message };
  }
});
electron.ipcMain.handle("fix:run-mod", async (_, payload = {}) => {
  try {
    const { gameId: requestedGameId } = payload || {};
    const gameId2 = resolveFixRequestGameId(requestedGameId);
    return await independentFixer.open(gameId2);
  } catch (e) {
    return { success: false, error: e.message };
  }
});
electron.ipcMain.handle("persist-bridge-reset-mod", async (_, { characterName, modName }) => {
  try {
    const gameId2 = getActiveGameScopeId();
    const modsPath = getModsPath();
    if (!modsPath || !fs.existsSync(modsPath)) {
      return { success: false, error: "Mods 路径未设置或不存在" };
    }
    const resolved = resolveExistingStandardModDirectory(characterName, modName, gameId2);
    if (!resolved?.modPath || !fs.existsSync(resolved.modPath)) {
      return { success: false, error: `Mod 目录不存在: ${modName}` };
    }
    const restoredCount = restorePersistBakFiles(resolved.modPath);
    const root = path.dirname(modsPath);
    ensurePersistBridgeMigrationForModDir(root, resolved.modPath);
    return { success: true, restoredCount };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
electron.ipcMain.handle("persist-bridge-reset-character", async (_, characterName) => {
  try {
    const modsPath = getModsPath();
    if (!modsPath || !fs.existsSync(modsPath)) {
      return { success: false, error: "Mods 路径未设置或不存在" };
    }
    const charDir = path.join(modsPath, characterName);
    if (!fs.existsSync(charDir))
      return { success: false, error: `角色目录不存在: ${characterName}` };
    let totalRestored = 0;
    const modDirs = fs.readdirSync(charDir, { withFileTypes: true }).filter((e) => e.isDirectory());
    for (const modEntry of modDirs) {
      const modDir = path.join(charDir, modEntry.name);
      totalRestored += restorePersistBakFiles(modDir);
    }
    const root = path.dirname(modsPath);
    if (isPersistBridgeEnabled()) {
      for (const modEntry of modDirs) {
        const modDir = path.join(charDir, modEntry.name);
        ensurePersistBridgeMigrationForModDir(root, modDir);
      }
    }
    return { success: true, restoredCount: totalRestored };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
electron.ipcMain.handle("ini-backup:list-mod", async (_, { characterName, modName }) => {
  try {
    const backups = listIniBackupsForMod(characterName, modName);
    return {
      success: true,
      backups
    };
  } catch (e) {
    return { success: false, backups: [], error: e.message };
  }
});
electron.ipcMain.handle("ini-backup:restore-mod", async (_, { characterName, modName, stamp }) => {
  try {
    const result = restoreIniBackupForMod(characterName, modName, stamp);
    return result;
  } catch (e) {
    return {
      success: false,
      restoreSucceeded: false,
      cleanupAttempted: false,
      cleanupSucceeded: false,
      snapshotDeleted: false,
      cleanupFailed: false,
      snapshotFileCount: 0,
      restoredCount: 0,
      removedBackupCount: 0,
      errors: [e.message],
      cleanupErrors: [],
      error: e.message
    };
  }
});
electron.ipcMain.handle("fix:select-custom-exe", async (_, options = {}) => {
  try {
    const gameId2 = resolveFixRequestGameId(options?.gameId);
    return await independentFixer.select(gameId2);
  } catch (e) {
    logger.error(`[Fix] select-custom-exe failed: ${e.message}`);
    return { success: false, error: e.message };
  }
});
electron.ipcMain.handle("dev:get-publish-config", async () => {
  return { success: true, config: normalizeDevPublishConfig(currentConfig.devPublishConfig || {}) };
});
electron.ipcMain.handle("dev:save-publish-config", async (_, cfg) => {
  try {
    currentConfig.devPublishConfig = normalizeDevPublishConfig(cfg);
    saveConfig(currentConfig);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
electron.ipcMain.handle("dev:get-mod-preview", async (_, { modFolderPath }) => {
  try {
    if (!modFolderPath || !fs.existsSync(modFolderPath)) {
      return { success: false, error: "Mod 文件夹不存在" };
    }
    const previewNames = [
      "preview.png",
      "preview.jpg",
      "preview.jpeg",
      "preview.webp",
      "preview.gif",
      "Cover.png",
      "Cover.jpg",
      "Cover.jpeg",
      "Cover.webp",
      "Cover.gif",
      "cover.png",
      "cover.jpg",
      "cover.jpeg",
      "cover.webp",
      "cover.gif"
    ];
    let previewPath = null;
    for (const name of previewNames) {
      const p = path.join(modFolderPath, name);
      if (fs.existsSync(p)) {
        previewPath = p;
        break;
      }
    }
    if (!previewPath) {
      try {
        const files = fs.readdirSync(modFolderPath);
        const imgFile = files.find((f) => /\.(png|jpg|jpeg|webp|gif)$/i.test(f));
        if (imgFile) previewPath = path.join(modFolderPath, imgFile);
      } catch (_2) {
      }
    }
    let previewDataUrl = null;
    if (previewPath) {
      const ext = path.extname(previewPath).toLowerCase();
      const mime = getImageMimeTypeFromExt(ext);
      previewDataUrl = `data:${mime};base64,${fs.readFileSync(previewPath).toString("base64")}`;
    }
    return { success: true, previewDataUrl };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
electron.ipcMain.handle("dev:get-market-publish-key", async (_, { modId, gameId: gameId2, characterName, modName }) => {
  try {
    const numericModId = Number(modId);
    if (!Number.isInteger(numericModId) || numericModId <= 0) {
      return { success: false, error: "无效的市场 Mod ID" };
    }
    const modsPathStatus = getModsPathStatus();
    if (!modsPathStatus.ok) return { success: false, error: modsPathStatus.error };
    const { modsPath } = modsPathStatus;
    for (const charDir of fs.readdirSync(modsPath, { withFileTypes: true }).filter((d) => d.isDirectory())) {
      const charPath = path.join(modsPath, charDir.name);
      for (const modDir of fs.readdirSync(charPath, { withFileTypes: true }).filter((d) => d.isDirectory())) {
        const modFolder = path.join(charPath, modDir.name);
        const idFile = path.join(modFolder, ".qaqmod_id");
        try {
          const localId = parseInt(fs.readFileSync(idFile, "utf-8").trim());
          if (localId !== numericModId) continue;
          const publishKeys = [
            buildLocalPublishKey(
              modFolder,
              gameId2 || getActiveGameScopeId(),
              characterName || charDir.name,
              modName || modDir.name
            ),
            buildLocalPublishKey(modFolder, gameId2 || getActiveGameScopeId(), charDir.name, modDir.name)
          ].filter((value, index, list) => value && list.indexOf(value) === index);
          return {
            success: true,
            publishKey: publishKeys[0] || null,
            publishKeys,
            modFolder
          };
        } catch {
        }
      }
    }
    return { success: true, publishKey: null };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
const devPublishProcesses = /* @__PURE__ */ new Map();
electron.ipcMain.handle("dev:cancel-publish", async (_, params = {}) => {
  const taskId = String(params.taskId || "");
  if (!taskId) return { success: false, error: "缺少发布任务 ID" };
  const proc = devPublishProcesses.get(taskId);
  if (!proc) return { success: false, error: "发布任务不存在或已结束" };
  try {
    if (process.platform === "win32") {
      child_process.spawn("taskkill", ["/pid", String(proc.pid), "/T", "/F"], { windowsHide: true });
    } else {
      proc.kill("SIGTERM");
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
electron.ipcMain.handle("dev:publish-mod", async (event, params) => {
  try {
    const {
      modFolder,
      charName,
      modName,
      version,
      gameVersion,
      gameId: gameId2,
      modMode,
      description,
      author,
      sourceUrl,
      isNsfw,
      useAdultImageHost,
      tagIds,
      pythonPath,
      winrarPath,
      mode,
      modId,
      providers,
      baiduLink,
      quarkLink,
      taskId
    } = params;
    const publishTaskId = taskId || `publish-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const sendPublishProgress = (data) => event.sender.send("dev:publish-progress", { taskId: publishTaskId, data });
    const sendPublishDone = (data) => event.sender.send("dev:publish-done", { taskId: publishTaskId, ...data });
    const gate = requireDevKitUnlocked();
    if (!gate.success) return gate;
    const devKitScriptPath = gate.status.publishScriptPath;
    if (!devKitScriptPath || !fs.existsSync(devKitScriptPath)) {
      return { success: false, error: `开发者包内发布脚本不存在: ${devKitScriptPath}` };
    }
    const explicitModFolder = String(modFolder || "").trim();
    const fallbackModFolder = !explicitModFolder && charName && modName ? resolveCharacterModPath(charName, modName, gameId2 || getActiveGameScopeId()) : null;
    const resolvedModFolder = explicitModFolder || fallbackModFolder;
    if (!resolvedModFolder || !fs.existsSync(resolvedModFolder)) {
      return { success: false, error: `Mod 文件夹不存在: ${resolvedModFolder || modFolder || ""}` };
    }
    if (!fs.statSync(resolvedModFolder).isDirectory()) {
      return { success: false, error: `Mod 发布源不是文件夹: ${resolvedModFolder}` };
    }
    console.log(
      `[DevPublish] mod source explicit="${explicitModFolder}" fallback="${fallbackModFolder || ""}" selected="${resolvedModFolder}"`
    );
    const args = [
      devKitScriptPath,
      "--mod-folder",
      resolvedModFolder,
      "--char",
      charName,
      "--mod-name",
      modName,
      "--version",
      gameVersion || version || "v1.0"
    ];
    if (mode) args.push("--mode", mode);
    if (modId) args.push("--mod-id", String(modId));
    if (providers) args.push("--providers", String(providers));
    if (baiduLink) args.push("--baidu-link", String(baiduLink));
    if (quarkLink) args.push("--quark-link", String(quarkLink));
    if (gameVersion) args.push("--game-version", gameVersion);
    if (gameId2) args.push("--game-id", gameId2);
    if (modMode) args.push("--mod-mode", modMode);
    if (description) args.push("--description", description);
    if (author) args.push("--author", author);
    if (sourceUrl) args.push("--source-url", sourceUrl);
    if (isNsfw) args.push("--nsfw");
    args.push(useAdultImageHost === false ? "--no-adult-image-host" : "--adult-image-host");
    if (tagIds && tagIds.length > 0) args.push("--tags", tagIds.join(","));
    if (winrarPath) args.push("--winrar", winrarPath);
    const python = pythonPath || "python";
    const scriptDir = path.dirname(devKitScriptPath);
    const childEnv = {
      ...process.env,
      PYTHONIOENCODING: "utf-8",
      PYTHONUNBUFFERED: "1"
    };
    if (gate.status.serverRootPath) childEnv.QAQM_SERVER_ROOT = gate.status.serverRootPath;
    console.log(`[DevPublish] Spawning: ${python} ${args.join(" ")}`);
    if (gate.status.serverRootPath) console.log(`[DevPublish] QAQM_SERVER_ROOT=${gate.status.serverRootPath}`);
    const proc = child_process.spawn(python, args, {
      cwd: scriptDir,
      env: childEnv
    });
    devPublishProcesses.set(publishTaskId, proc);
    proc.stdout.on("data", (chunk) => {
      sendPublishProgress(chunk.toString("utf-8"));
    });
    proc.stderr.on("data", (chunk) => {
      const line = chunk.toString("utf-8").trim();
      if (line)
        sendPublishProgress(
          JSON.stringify({ type: "log", message: `[stderr] ${line}`, level: "warn" }) + "\n"
        );
    });
    proc.on("close", (code) => {
      console.log(`[DevPublish] Process exited code=${code}`);
      if (devPublishProcesses.get(publishTaskId) === proc) devPublishProcesses.delete(publishTaskId);
      sendPublishDone({ exitCode: code });
    });
    proc.on("error", (err) => {
      if (devPublishProcesses.get(publishTaskId) === proc) devPublishProcesses.delete(publishTaskId);
      sendPublishProgress(JSON.stringify({ type: "error", message: `Startup failed: ${err.message}` }) + "\n");
      sendPublishDone({ exitCode: -1 });
    });
    return { success: true, pid: proc.pid, taskId: publishTaskId };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
electron.ipcMain.handle("peek-disguised-mod-name", async (_, { filePath }) => {
  try {
    if (!filePath || !fs.existsSync(filePath)) return { name: null };
    if (!isDisguisedMp4(filePath)) return { name: null };
    const realName = peekDisguisedModName(filePath);
    return { name: realName };
  } catch (_2) {
    return { name: null };
  }
});
electron.ipcMain.handle("dev:export-encrypted-mod", async (event, { modPath, characterName, modName }) => {
  try {
    const sevenZipPath = get7zaPath();
    if (!sevenZipPath) return { success: false, error: "未找到 7-Zip" };
    if (!modPath || !fs.existsSync(modPath)) return { success: false, error: "Mod 文件夹不存在" };
    const modStats = getDirectoryStatsSync(modPath);
    const videoPick = pickExportEncryptVideo(modStats);
    const videoPath = videoPick.videoPath;
    const useDirect7z = modStats.size >= EXPORT_ENCRYPT_DIRECT_7Z_THRESHOLD;
    const archiveSource = getEncryptedExportArchiveSource(modPath);
    logger.info(
      `[ExportEncrypt] Mod stats: ${(modStats.size / 1024 / 1024).toFixed(1)} MB, ${modStats.files} files`
    );
    if (archiveSource.preserveRoot) {
      logger.info(`[ExportEncrypt] Preserving package root folder: ${archiveSource.include}`);
    }
    if (useDirect7z) {
      logger.info("[ExportEncrypt] Large mod mode: direct encrypted 7z without inner ZIP");
    }
    if (videoPath) {
      logger.info(
        `[ExportEncrypt] Video source: ${videoPick.useLongVideo ? "long" : "normal"} (${videoPick.selectedDir})`
      );
    } else {
      logger.warn("[ExportEncrypt] No MP4 video素材 found, exporting with magic marker only");
    }
    const defaultName = `${modName || path.basename(modPath)}.mp4`;
    const { dialog: dialog2 } = require("electron");
    const result = await dialog2.showSaveDialog(mainWindowRef, {
      title: "导出加密 Mod",
      defaultPath: path.join(electron.app.getPath("desktop"), defaultName),
      filters: [{ name: "MP4 伪装文件", extensions: ["mp4"] }]
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    const outputPath = result.filePath;
    const outputDir = path.dirname(outputPath);
    const tmpDir = path.join(outputDir, `.qaqm-export-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    try {
      let innerZipPath = null;
      const innerZipName = `${modName || path.basename(modPath)}.zip`;
      if (useDirect7z) {
        logger.info(`[ExportEncrypt] Step 1: Skipping inner ZIP for large mod ${modName}`);
      } else {
        logger.info(`[ExportEncrypt] Step 1: Creating inner ZIP for ${modName} with 7-Zip`);
        innerZipPath = path.join(tmpDir, innerZipName);
        run7zSync(
          sevenZipPath,
          ["a", "-tzip", innerZipPath, archiveSource.include, "-r", "-mx=0"],
          30 * 60 * 1e3,
          archiveSource.cwd
        );
      }
      logger.info("[ExportEncrypt] Step 2: Creating encrypted 7z");
      const enc7zName = `${modName || path.basename(modPath)}.7z`;
      const enc7zPath = path.join(tmpDir, enc7zName);
      if (useDirect7z) {
        run7zSync(
          sevenZipPath,
          ["a", enc7zPath, archiveSource.include, "-r", `-p${DISGUISE_PASSWORD}`, "-mhe=on", "-mx=0"],
          30 * 60 * 1e3,
          archiveSource.cwd
        );
      } else {
        run7zSync(sevenZipPath, [
          "a",
          enc7zPath,
          innerZipPath,
          `-p${DISGUISE_PASSWORD}`,
          "-mhe=on",
          "-mx=0"
        ]);
        try {
          fs.unlinkSync(innerZipPath);
        } catch (_) {
        }
      }
      logger.info("[ExportEncrypt] Step 3: Creating outer ZIP");
      let payloadPath = null;
      if (useDirect7z) {
        logger.info("[ExportEncrypt] Step 3: Streaming outer ZIP for large mod compatibility");
      } else {
        const outerZipPath = path.join(tmpDir, "outer.zip");
        run7zSync(
          sevenZipPath,
          ["a", "-tzip", outerZipPath, enc7zName, "-mx=0"],
          30 * 60 * 1e3,
          tmpDir
        );
        try {
          fs.unlinkSync(enc7zPath);
        } catch (_) {
        }
        payloadPath = outerZipPath;
      }
      logger.info("[ExportEncrypt] Step 4: XOR obfuscation + concatenation");
      const outFd = fs.openSync(outputPath, "w");
      if (videoPath) {
        const videoBytes = writeFileToFdSync(videoPath, outFd);
        logger.info(
          `[ExportEncrypt] Video: ${path.basename(videoPath)} (${(videoBytes / 1024 / 1024).toFixed(1)} MB)`
        );
      }
      fs.writeSync(outFd, DISGUISE_MAGIC);
      const xorBytes = useDirect7z ? writeXorSingleFileZipToFdSync(enc7zPath, enc7zName, outFd, DISGUISE_XOR_KEY) : writeXorFileToFdSync(payloadPath, outFd, DISGUISE_XOR_KEY);
      fs.closeSync(outFd);
      const totalSize = fs.statSync(outputPath).size;
      const expectedMinSize = (videoPath ? fs.statSync(videoPath).size : 0) + DISGUISE_MAGIC.length + xorBytes;
      if (totalSize !== expectedMinSize) {
        throw new Error("Encrypted export size verification failed");
      }
      logger.info(
        `[ExportEncrypt] Done: ${outputPath} (${(totalSize / 1024 / 1024).toFixed(1)} MB)`
      );
      return { success: true, outputPath, size: totalSize };
    } finally {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch (_) {
      }
    }
  } catch (e) {
    logger.error(`[ExportEncrypt] Failed: ${e.message}`);
    return { success: false, error: e.message };
  }
});
electron.ipcMain.handle("dev:save-log", async (_, { category, modName, content }) => {
  try {
    const logsDir = path.join(electron.app.getPath("userData"), "logs", category || "general");
    fs.mkdirSync(logsDir, { recursive: true });
    const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const safeName = (modName || "unknown").replace(/[<>:"/\\|?*]/g, "_").slice(0, 80);
    const filename = `${timestamp}_${safeName}.log`;
    const logPath = path.join(logsDir, filename);
    fs.writeFileSync(logPath, content, "utf-8");
    return { success: true, path: logPath };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
electron.ipcMain.handle("dev:open-logs-folder", async () => {
  try {
    const logsDir = path.join(electron.app.getPath("userData"), "logs");
    fs.mkdirSync(logsDir, { recursive: true });
    require("electron").shell.openPath(logsDir);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
function normalizeAiBaseUrl(value) {
  const raw = String(value || "").trim().replace(/\/+$/, "");
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    if (!parsed.pathname || parsed.pathname === "/") parsed.pathname = "/v1";
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return raw;
  }
}
function buildAiProviderConfigs(config = {}) {
  const primaryModel = config.model || config.AI_MODEL || "gpt-4o";
  const definitions = [
    {
      label: "primary",
      baseURL: config.baseURL || config.AI_API_BASE,
      apiKEY: config.apiKEY || config.AI_API_KEY,
      model: primaryModel
    },
    {
      label: "secondary",
      baseURL: config.baseURL_2 || config.AI_API_BASE_2,
      apiKEY: config.apiKEY_2 || config.AI_API_KEY_2,
      model: config.model_2 || config.AI_MODEL_2 || primaryModel
    }
  ];
  return definitions.map((provider) => ({ ...provider, baseURL: normalizeAiBaseUrl(provider.baseURL) })).filter((provider) => provider.baseURL && provider.apiKEY);
}
function loadAiEnvConfig() {
  const candidates = [
    path.join(electron.app.getAppPath(), "..", ".env"),
    path.join(electron.app.getAppPath(), ".env"),
    path.join(electron.app.getAppPath(), "..", "..", ".env")
  ];
  for (const envPath of candidates) {
    try {
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, "utf-8");
        const config = {};
        for (const line of content.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;
          const eqIdx = trimmed.indexOf("=");
          if (eqIdx > 0) {
            const key = trimmed.slice(0, eqIdx).trim().replace(/^\uFEFF/, "");
            config[key] = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, "");
          }
        }
        const providers = buildAiProviderConfigs(config);
        if (providers.length > 0) {
          logger.info(`AI config loaded from: ${envPath} (providers=${providers.length})`);
          return config;
        }
      }
    } catch (_) {
    }
  }
  return null;
}
function parseOpenAiAiContent(raw) {
  const extractText = (value) => {
    if (typeof value === "string") return value;
    if (!Array.isArray(value)) return "";
    return value.map((part) => part?.text || part?.content || "").join("");
  };
  let content = "";
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data: ") || trimmed === "data: [DONE]") continue;
    try {
      const chunk = JSON.parse(trimmed.slice(6));
      const choice = chunk.choices?.[0];
      const chunkContent = extractText(choice?.delta?.content) || extractText(choice?.message?.content) || extractText(choice?.text);
      if (chunkContent) content += chunkContent;
    } catch {
    }
  }
  if (!content) {
    try {
      const data = JSON.parse(raw);
      content = extractText(data.choices?.[0]?.message?.content) || extractText(data.choices?.[0]?.text);
    } catch {
    }
  }
  return content;
}
const AI_IMAGE_MIME_ALIASES = {
  "image/jpg": "image/jpeg"
};
const OPENAI_AI_IMAGE_TYPES = /* @__PURE__ */ new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const ANTHROPIC_AI_IMAGE_TYPES = /* @__PURE__ */ new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
function normalizeAiImageUrl(url) {
  const rawUrl = String(url || "").trim();
  if (!rawUrl) return null;
  if (/^https?:\/\//i.test(rawUrl)) return { url: rawUrl, mediaType: "" };
  const match = rawUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const mediaType = AI_IMAGE_MIME_ALIASES[match[1].toLowerCase()] || match[1].toLowerCase();
  const data = match[2];
  if (!mediaType || !data) return null;
  return { url: `data:${mediaType};base64,${data}`, mediaType, data };
}
function hasAiImageContent(messages) {
  return Array.isArray(messages) && messages.some((message) => Array.isArray(message?.content) && message.content.some((part) => part?.type === "image_url" || part?.type === "image"));
}
function toOpenAiAiContent(content, { dropImages = false } = {}) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return String(content || "");
  const parts = [];
  for (const part of content) {
    if (part?.type === "text") {
      const text = String(part.text || "");
      if (text) parts.push({ type: "text", text });
      continue;
    }
    if (dropImages || part?.type !== "image_url") continue;
    const image = normalizeAiImageUrl(part.image_url?.url || part.url);
    if (!image) continue;
    if (image.mediaType && !OPENAI_AI_IMAGE_TYPES.has(image.mediaType)) continue;
    parts.push({ type: "image_url", image_url: { url: image.url } });
  }
  const hasImage = parts.some((part) => part.type === "image_url");
  if (hasImage) return parts;
  return parts.map((part) => part.text || "").filter(Boolean).join("\n");
}
function normalizeOpenAiAiMessages(messages, options = {}) {
  return (Array.isArray(messages) ? messages : []).map((message) => {
    const role = message?.role === "system" || message?.role === "assistant" ? message.role : "user";
    const content = toOpenAiAiContent(message?.content, options);
    return { role, content };
  }).filter((message) => typeof message.content === "string" ? message.content.trim() : Array.isArray(message.content) && message.content.length > 0);
}
function toAnthropicAiContent(content, { dropImages = false } = {}) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return String(content || "");
  const parts = [];
  for (const part of content) {
    if (part?.type === "text") {
      const text = String(part.text || "");
      if (text) parts.push({ type: "text", text });
      continue;
    }
    if (dropImages) continue;
    if (part?.type === "image_url") {
      const image = normalizeAiImageUrl(part.image_url?.url || part.url);
      if (image?.data && ANTHROPIC_AI_IMAGE_TYPES.has(image.mediaType)) {
        parts.push({
          type: "image",
          source: { type: "base64", media_type: image.mediaType, data: image.data }
        });
      }
    }
  }
  const hasImage = parts.some((part) => part.type === "image");
  if (hasImage) return parts;
  return parts.map((part) => part.text || "").filter(Boolean).join("\n");
}
function buildAnthropicAiPayload(messages, model, maxTokens, options = {}) {
  const anthropicMessages = [];
  const system = [];
  for (const message of messages) {
    if (message?.role === "system") {
      if (typeof message.content === "string") system.push(message.content);
      continue;
    }
    const content = toAnthropicAiContent(message?.content, options);
    if (typeof content === "string" ? !content.trim() : !Array.isArray(content) || content.length === 0) {
      continue;
    }
    anthropicMessages.push({
      role: message?.role === "assistant" ? "assistant" : "user",
      content
    });
  }
  const numericMaxTokens = Number(maxTokens);
  return {
    model,
    messages: anthropicMessages,
    max_tokens: Number.isFinite(numericMaxTokens) && numericMaxTokens > 0 ? numericMaxTokens : 1e3,
    ...system.length ? { system: system.join("\n") } : {}
  };
}
const DEV_AI_SUGGEST_TIMEOUT_MS = 12e4;
const DEV_AI_PROVIDER_TIMEOUT_MS = 6e4;
const DEV_AI_COMPATIBILITY_STATUSES = /* @__PURE__ */ new Set([400, 404, 405, 415, 422]);
let devAiSuggestRequestSequence = 0;
function createDevAiError(message, { code = "", status = 0, compatibilityRetry = false } = {}) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  error.compatibilityRetry = compatibilityRetry;
  return error;
}
function summarizeDevAiUpstreamBody(raw, maxLength = 200) {
  const text = String(raw || "").trim();
  if (/<!doctype\s+html|<html[\s>]/i.test(text)) return "HTML error page";
  return text.slice(0, maxLength);
}
function formatDevAiUserError(error) {
  if (error?.code === "AI_TIMEOUT") {
    return "AI 服务响应超时（60 秒）。请稍后重试，或在 .env 中更换响应更快的模型。";
  }
  const status = Number(error?.status || 0);
  if (status === 524 || status === 504) return "AI 服务商上游响应超时，请稍后重试。";
  if (status === 429) return "AI 服务请求过于频繁，请稍后重试。";
  if (status >= 500) return `AI 服务暂时不可用（HTTP ${status}），请稍后重试。`;
  if (/fetch failed|network|socket|connect/i.test(String(error?.message || ""))) {
    return "无法连接 AI 服务，请检查网络或稍后重试。";
  }
  return error?.message || String(error);
}
async function fetchDevAiText(url, options, timeoutMs) {
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1e3) {
    throw createDevAiError("AI request deadline exceeded", { code: "AI_TIMEOUT" });
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return { response, raw: await response.text() };
  } catch (error) {
    if (controller.signal.aborted) {
      throw createDevAiError(`AI request timed out after ${Math.ceil(timeoutMs / 1e3)}s`, { code: "AI_TIMEOUT" });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
async function requestOpenAiDevAiSuggest({
  requestId,
  attemptLabel,
  normalizedBaseUrl,
  apiKEY,
  model,
  messages,
  maxTokens,
  responseFormat,
  temperature,
  dropImages = false,
  tokenParam = "max_tokens",
  timeoutMs
}) {
  const url = `${normalizedBaseUrl}/chat/completions`;
  const numericTemperature = Number(temperature);
  const normalizedMessages = normalizeOpenAiAiMessages(messages, { dropImages });
  if (normalizedMessages.length === 0) {
    throw new Error("OpenAI-compatible request has no usable messages");
  }
  const body = {
    model,
    messages: normalizedMessages,
    stream: true,
    ...responseFormat ? { response_format: responseFormat } : {},
    ...Number.isFinite(numericTemperature) ? { temperature: numericTemperature } : {}
  };
  if (Number.isFinite(Number(maxTokens)) && Number(maxTokens) > 0) {
    body[tokenParam] = Number(maxTokens);
  }
  const serializedBody = JSON.stringify(body);
  const startedAt = Date.now();
  logger.info(
    `[AI suggest ${requestId}] OpenAI attempt=${attemptLabel} start model=${model} timeout=${Math.ceil(timeoutMs / 1e3)}s image=${!dropImages && hasAiImageContent(messages)} payload=${Buffer.byteLength(serializedBody, "utf8")}B tokenParam=${tokenParam}`
  );
  const { response, raw } = await fetchDevAiText(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKEY}`
    },
    body: serializedBody
  }, timeoutMs);
  const contentType = response.headers?.get?.("content-type") || "";
  if (response.ok && /text\/html/i.test(contentType)) {
    throw createDevAiError("OpenAI-compatible returned HTML instead of an API response", {
      code: "AI_INVALID_RESPONSE"
    });
  }
  if (!response.ok) {
    throw createDevAiError(`OpenAI-compatible ${response.status}: ${summarizeDevAiUpstreamBody(raw)}`, {
      status: response.status,
      compatibilityRetry: DEV_AI_COMPATIBILITY_STATUSES.has(response.status)
    });
  }
  const content = parseOpenAiAiContent(raw).trim();
  if (!content) {
    throw createDevAiError("OpenAI-compatible returned empty content", {
      code: "AI_EMPTY_RESPONSE",
      compatibilityRetry: true
    });
  }
  logger.info(
    `[AI suggest ${requestId}] OpenAI attempt=${attemptLabel} success elapsed=${Date.now() - startedAt}ms response=${Buffer.byteLength(raw, "utf8")}B content=${content.length} chars`
  );
  return content;
}
async function requestAnthropicDevAiSuggest({
  requestId,
  attemptLabel,
  normalizedBaseUrl,
  apiKEY,
  model,
  messages,
  maxTokens,
  dropImages = false,
  timeoutMs
}) {
  const url = `${normalizedBaseUrl}/messages`;
  const body = buildAnthropicAiPayload(messages, model, maxTokens, { dropImages });
  const serializedBody = JSON.stringify(body);
  const startedAt = Date.now();
  logger.info(
    `[AI suggest ${requestId}] Anthropic attempt=${attemptLabel} start model=${model} timeout=${Math.ceil(timeoutMs / 1e3)}s image=${!dropImages && hasAiImageContent(messages)} payload=${Buffer.byteLength(serializedBody, "utf8")}B`
  );
  const { response, raw } = await fetchDevAiText(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKEY,
      "anthropic-version": "2023-06-01",
      "User-Agent": "Mozilla/5.0"
    },
    body: serializedBody
  }, timeoutMs);
  if (!response.ok) {
    throw createDevAiError(`Anthropic Messages ${response.status}: ${summarizeDevAiUpstreamBody(raw)}`, {
      status: response.status,
      compatibilityRetry: DEV_AI_COMPATIBILITY_STATUSES.has(response.status)
    });
  }
  let data = null;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`Anthropic Messages returned invalid JSON: ${summarizeDevAiUpstreamBody(raw, 120)}`);
  }
  const content = (Array.isArray(data.content) ? data.content.map((part) => part?.text || "").join("") : String(data.content || "")).trim();
  if (!content) {
    throw createDevAiError("Anthropic Messages returned empty content", {
      code: "AI_EMPTY_RESPONSE",
      compatibilityRetry: true
    });
  }
  logger.info(
    `[AI suggest ${requestId}] Anthropic attempt=${attemptLabel} success elapsed=${Date.now() - startedAt}ms response=${Buffer.byteLength(raw, "utf8")}B content=${content.length} chars`
  );
  return content;
}
electron.ipcMain.handle(
  "dev:ai-suggest",
  async (_, { messages, max_tokens = 1e3, response_format, temperature } = {}) => {
    const requestId = `${Date.now().toString(36)}-${++devAiSuggestRequestSequence}`;
    const requestStartedAt = Date.now();
    const requestDeadline = requestStartedAt + DEV_AI_SUGGEST_TIMEOUT_MS;
    try {
      logger.info(`[AI suggest ${requestId}] received messages=${Array.isArray(messages) ? messages.length : 0}`);
      const envCfg = loadAiEnvConfig();
      if (!envCfg) {
        return {
          success: false,
          error: "AI 配置未找到。请在项目根目录创建 .env 文件，包含 baseURL, apiKEY, model"
        };
      }
      if (!Array.isArray(messages) || messages.length === 0) {
        return { success: false, error: "messages 不能为空" };
      }
      const providers = buildAiProviderConfigs(envCfg);
      if (providers.length === 0) {
        return { success: false, error: ".env 中缺少有效的 baseURL/apiKEY 配置" };
      }
      const responseFormat = response_format && typeof response_format === "object" ? response_format : null;
      const failures = [];
      const containsImage = hasAiImageContent(messages);
      logger.info(
        `[AI suggest ${requestId}] prepared providers=${providers.length} image=${containsImage} responseFormat=${!!responseFormat} budget=${DEV_AI_SUGGEST_TIMEOUT_MS}ms`
      );
      for (const provider of providers) {
        const providerDeadline = Math.min(
          requestDeadline,
          Date.now() + DEV_AI_PROVIDER_TIMEOUT_MS
        );
        const remainingProviderTimeout = () => Math.max(0, providerDeadline - Date.now());
        const resolvedModel = provider.model;
        const isGpt5Model = String(resolvedModel).toLowerCase().startsWith("gpt-5");
        const defaultTokenParam = isGpt5Model ? "max_completion_tokens" : "max_tokens";
        const openAiAttempts = [
          {
            label: "primary",
            dropImages: false,
            responseFormat,
            tokenParam: defaultTokenParam
          },
          ...responseFormat ? [{
            label: "without response_format",
            dropImages: false,
            responseFormat: null,
            tokenParam: defaultTokenParam
          }] : [],
          ...containsImage ? [{
            label: "text only",
            dropImages: true,
            responseFormat: null,
            tokenParam: defaultTokenParam
          }] : []
        ];
        let tryAnthropic = true;
        logger.info(
          `[AI suggest ${requestId}] provider=${provider.label} start model=${resolvedModel} base=${provider.baseURL} attempts=${openAiAttempts.length}`
        );
        for (const attempt of openAiAttempts) {
          try {
            const content = await requestOpenAiDevAiSuggest({
              requestId,
              attemptLabel: `${provider.label}/${attempt.label}`,
              normalizedBaseUrl: provider.baseURL,
              apiKEY: provider.apiKEY,
              model: resolvedModel,
              messages,
              maxTokens: max_tokens,
              responseFormat: attempt.responseFormat,
              temperature,
              dropImages: attempt.dropImages,
              tokenParam: attempt.tokenParam,
              timeoutMs: remainingProviderTimeout()
            });
            const elapsedMs = Date.now() - requestStartedAt;
            const completedAttempt = `${provider.label}/${attempt.label}`;
            logger.info(`[AI suggest ${requestId}] completed attempt=${completedAttempt} elapsed=${elapsedMs}ms`);
            return {
              success: true,
              content,
              requestId,
              provider: provider.label,
              attempt: completedAttempt,
              elapsedMs
            };
          } catch (error) {
            const message = error?.message || String(error);
            failures.push(`${provider.label} OpenAI-compatible ${attempt.label}: ${message}`);
            logger.warn(
              `[AI suggest ${requestId}] provider=${provider.label} OpenAI attempt=${attempt.label} failed: ${message}`
            );
            if (!error?.compatibilityRetry || remainingProviderTimeout() < 1e3) {
              tryAnthropic = false;
              break;
            }
          }
        }
        if (!tryAnthropic || remainingProviderTimeout() < 1e3) {
          logger.warn(`[AI suggest ${requestId}] switching after provider=${provider.label} OpenAI failure`);
          continue;
        }
        try {
          const content = await requestAnthropicDevAiSuggest({
            requestId,
            attemptLabel: `${provider.label}/primary`,
            normalizedBaseUrl: provider.baseURL,
            apiKEY: provider.apiKEY,
            model: resolvedModel,
            messages,
            maxTokens: max_tokens,
            dropImages: false,
            timeoutMs: remainingProviderTimeout()
          });
          const elapsedMs = Date.now() - requestStartedAt;
          const completedAttempt = `${provider.label}/anthropic-primary`;
          logger.info(`[AI suggest ${requestId}] completed attempt=${completedAttempt} elapsed=${elapsedMs}ms`);
          return {
            success: true,
            content,
            requestId,
            provider: provider.label,
            attempt: completedAttempt,
            elapsedMs
          };
        } catch (error) {
          const message = error?.message || String(error);
          failures.push(`${provider.label} Anthropic Messages primary: ${message}`);
          logger.warn(
            `[AI suggest ${requestId}] provider=${provider.label} Anthropic attempt=primary failed: ${message}`
          );
        }
        if (containsImage && remainingProviderTimeout() >= 1e3) {
          try {
            const content = await requestAnthropicDevAiSuggest({
              requestId,
              attemptLabel: `${provider.label}/text-only`,
              normalizedBaseUrl: provider.baseURL,
              apiKEY: provider.apiKEY,
              model: resolvedModel,
              messages,
              maxTokens: max_tokens,
              dropImages: true,
              timeoutMs: remainingProviderTimeout()
            });
            const elapsedMs = Date.now() - requestStartedAt;
            const completedAttempt = `${provider.label}/anthropic-text-only`;
            logger.info(`[AI suggest ${requestId}] completed attempt=${completedAttempt} elapsed=${elapsedMs}ms`);
            return {
              success: true,
              content,
              requestId,
              provider: provider.label,
              attempt: completedAttempt,
              elapsedMs
            };
          } catch (error) {
            const message = error?.message || String(error);
            failures.push(`${provider.label} Anthropic Messages text only: ${message}`);
            logger.warn(
              `[AI suggest ${requestId}] provider=${provider.label} Anthropic attempt=text-only failed: ${message}`
            );
          }
        }
        logger.warn(`[AI suggest ${requestId}] exhausted provider=${provider.label}; switching provider`);
      }
      logger.error(`[AI suggest ${requestId}] exhausted elapsed=${Date.now() - requestStartedAt}ms failures=${failures.length}`);
      return { success: false, error: `AI 请求失败: ${failures.join("; ").slice(0, 500)}` };
    } catch (e) {
      const elapsedMs = Date.now() - requestStartedAt;
      logger.error(`[AI suggest ${requestId}] failed elapsed=${elapsedMs}ms:`, e);
      return { success: false, error: formatDevAiUserError(e), requestId, elapsedMs };
    }
  }
);
const AI_SUGGEST_CACHE_PATH = path.join(electron.app.getPath("userData"), "ai-suggest-cache.json");
let _aiSuggestDiskCache = null;
function loadAiSuggestCache() {
  if (_aiSuggestDiskCache) return _aiSuggestDiskCache;
  try {
    if (fs.existsSync(AI_SUGGEST_CACHE_PATH)) {
      _aiSuggestDiskCache = JSON.parse(fs.readFileSync(AI_SUGGEST_CACHE_PATH, "utf-8"));
    } else {
      _aiSuggestDiskCache = {};
    }
  } catch {
    _aiSuggestDiskCache = {};
  }
  return _aiSuggestDiskCache;
}
function saveAiSuggestCache() {
  try {
    fs.writeFileSync(
      AI_SUGGEST_CACHE_PATH,
      JSON.stringify(_aiSuggestDiskCache || {}, null, 2),
      "utf-8"
    );
  } catch (e) {
    logger.error("Save AI suggest cache error:", e);
  }
}
electron.ipcMain.handle("dev:save-ai-suggest-cache", async (_, { modPath, result }) => {
  try {
    const cache = loadAiSuggestCache();
    cache[modPath] = { ...result, savedAt: (/* @__PURE__ */ new Date()).toISOString() };
    saveAiSuggestCache();
    return { success: true };
  } catch (e) {
    return { error: e.message };
  }
});
electron.ipcMain.handle("dev:load-ai-suggest-cache", async (_, { modPath }) => {
  try {
    const cache = loadAiSuggestCache();
    if (modPath) return { success: true, result: cache[modPath] || null };
    return { success: true, result: cache };
  } catch (e) {
    return { success: true, result: null };
  }
});
electron.ipcMain.handle("dev:load-ai-tags", async (_, { gameId: gameId2 }) => {
  try {
    const tagsDir = path.join(__dirname, "..", "..", "..", "..", "docs", "tags");
    const absTagsDir = fs.existsSync(tagsDir) ? tagsDir : path.join(electron.app.getPath("userData"), "dev", "tags");
    const filePath = path.join(absTagsDir, "ai-tag-suggestions.json");
    if (!fs.existsSync(filePath)) return { success: true, data: {} };
    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return { success: true, data: raw[gameId2] || {} };
  } catch (e) {
    return { success: true, data: {} };
  }
});
electron.ipcMain.handle(
  "dev:save-ai-tags",
  async (_, { modName, characterName, gameId: gameId2, allTags, poolTags, newTags, timestamp }) => {
    try {
      const tagsDir = path.join(__dirname, "..", "..", "..", "..", "docs", "tags");
      const absTagsDir = fs.existsSync(tagsDir) ? tagsDir : path.join(electron.app.getPath("userData"), "dev", "tags");
      if (!fs.existsSync(absTagsDir)) {
        fs.mkdirSync(absTagsDir, { recursive: true });
      }
      const filePath = path.join(absTagsDir, "ai-tag-suggestions.json");
      let data = {};
      try {
        if (fs.existsSync(filePath)) {
          data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        }
      } catch {
      }
      if (!data[gameId2]) data[gameId2] = {};
      if (!data[gameId2][characterName]) data[gameId2][characterName] = {};
      data[gameId2][characterName][modName] = {
        allTags,
        poolTags,
        newTags,
        timestamp
      };
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
      logger.info(`AI tags saved to ${filePath} for ${gameId2}/${characterName}/${modName}`);
      return { success: true };
    } catch (e) {
      logger.error("Save AI tags error:", e);
      return { error: e.message };
    }
  }
);
electron.ipcMain.handle("dev:batch-cloud-op", async (event, params) => {
  try {
    const {
      mode,
      gameId: gameId2,
      modsDir,
      characters,
      password,
      force,
      pythonPath,
      modIds,
      modNames
    } = params;
    const gate = requireDevKitUnlocked();
    if (!gate.success) return gate;
    const batchScript = gate.status.batchScriptPath;
    if (!fs.existsSync(batchScript)) {
      return { success: false, error: `开发者包内批量操作脚本不存在: ${batchScript}` };
    }
    const args = [batchScript, "--mode", mode, "--game-id", gameId2 || "endfield"];
    const resolvedModsDir = modsDir || getResolvedActiveGamePaths().modsPath || "";
    if (resolvedModsDir) args.push("--mods-dir", resolvedModsDir);
    if (characters) args.push("--characters", characters);
    if (password) args.push("--password", password);
    if (force) args.push("--force");
    if (modIds) args.push("--mod-ids", modIds);
    if (modNames) args.push("--mod-names", modNames);
    const python = pythonPath || "python";
    const scriptDir = path.dirname(batchScript);
    console.log(`[DevBatch] Spawning: ${python} ${args.join(" ")}`);
    const proc = child_process.spawn(python, args, {
      cwd: scriptDir,
      env: {
        ...process.env,
        PYTHONIOENCODING: "utf-8",
        PYTHONUNBUFFERED: "1"
      }
    });
    proc.stdout.on("data", (chunk) => {
      event.sender.send("dev:batch-progress", chunk.toString("utf-8"));
    });
    proc.stderr.on("data", (chunk) => {
      const line = chunk.toString("utf-8").trim();
      if (line)
        event.sender.send(
          "dev:batch-progress",
          JSON.stringify({ type: "log", message: `[stderr] ${line}`, level: "warn" }) + "\n"
        );
    });
    proc.on("close", (code) => {
      console.log(`[DevBatch] Process exited code=${code}`);
      event.sender.send("dev:batch-done", { exitCode: code });
    });
    proc.on("error", (err) => {
      event.sender.send(
        "dev:batch-progress",
        JSON.stringify({ type: "error", message: `启动失败: ${err.message}` }) + "\n"
      );
      event.sender.send("dev:batch-done", { exitCode: -1 });
    });
    return { success: true, pid: proc.pid };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
electron.ipcMain.handle("dev:fill-missing-images", async (_, { adminKey, serverUrl }) => {
  try {
    const baseUrl = (serverUrl || DEFAULT_SERVER_URL).replace(/\/$/, "");
    const modsPathStatus = getModsPathStatus();
    if (!modsPathStatus.ok) return { success: false, error: modsPathStatus.error };
    const { modsPath } = modsPathStatus;
    const modIdToPath = {};
    for (const charDir of fs.readdirSync(modsPath, { withFileTypes: true }).filter((d) => d.isDirectory())) {
      const charPath = path.join(modsPath, charDir.name);
      for (const modDir of fs.readdirSync(charPath, { withFileTypes: true }).filter((d) => d.isDirectory())) {
        const idFile = path.join(charPath, modDir.name, ".qaqmod_id");
        try {
          const id = parseInt(fs.readFileSync(idFile, "utf-8").trim());
          if (id) modIdToPath[id] = path.join(charPath, modDir.name);
        } catch {
        }
      }
    }
    const resp = await fetch(`${baseUrl}/api/mods`);
    if (!resp.ok) return { success: false, error: `获取 mod 列表失败: HTTP ${resp.status}` };
    const data = await resp.json();
    const allMods = data.mods || (Array.isArray(data) ? data : []);
    const modsWithoutImage = allMods.filter((m) => !m.imageUrl);
    if (modsWithoutImage.length === 0) {
      return {
        success: true,
        total: 0,
        filled: 0,
        skipped: 0,
        errors: [],
        message: "所有 mod 都已有图片"
      };
    }
    const filled = [];
    const skipped = [];
    const errors = [];
    const previewNames = [
      "preview.png",
      "preview.jpg",
      "preview.jpeg",
      "preview.webp",
      "preview.gif",
      "Cover.png",
      "Cover.jpg",
      "Cover.jpeg",
      "Cover.webp",
      "Cover.gif",
      "cover.png",
      "cover.jpg",
      "cover.jpeg",
      "cover.webp",
      "cover.gif"
    ];
    for (const mod of modsWithoutImage) {
      const folderPath = modIdToPath[mod.id];
      if (!folderPath) {
        skipped.push({ id: mod.id, name: mod.name, reason: "本地无对应文件夹" });
        continue;
      }
      let previewPath = null;
      for (const name of previewNames) {
        const p = path.join(folderPath, name);
        if (fs.existsSync(p)) {
          previewPath = p;
          break;
        }
      }
      if (!previewPath) {
        try {
          const imgFile = fs.readdirSync(folderPath).find((f) => /\.(png|jpg|jpeg|webp|gif)$/i.test(f));
          if (imgFile) previewPath = path.join(folderPath, imgFile);
        } catch {
        }
      }
      if (!previewPath) {
        skipped.push({ id: mod.id, name: mod.name, reason: "本地无预览图" });
        continue;
      }
      try {
        const imageBuffer = fs.readFileSync(previewPath);
        const filename = path.basename(previewPath);
        const mimeType = getImageMimeTypeFromExt(path.extname(filename));
        const formData = new FormData();
        formData.append("image", new Blob([imageBuffer], { type: mimeType }), filename);
        const uploadResp = await fetch(`${baseUrl}/api/mods/${mod.id}/upload-image`, {
          method: "POST",
          headers: { "x-admin-key": adminKey },
          body: formData
        });
        if (!uploadResp.ok) {
          const err = await uploadResp.json().catch(() => ({}));
          errors.push({
            id: mod.id,
            name: mod.name,
            error: err.error || `HTTP ${uploadResp.status}`
          });
        } else {
          filled.push({ id: mod.id, name: mod.name });
        }
      } catch (e) {
        errors.push({ id: mod.id, name: mod.name, error: e.message });
      }
    }
    return {
      success: true,
      total: modsWithoutImage.length,
      filled: filled.length,
      skipped: skipped.length,
      errorCount: errors.length,
      filledList: filled,
      skippedList: skipped,
      errors
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
function getAutoinstallDir() {
  const isDev = !electron.app.isPackaged;
  if (isDev) {
    return path.join(electron.app.getAppPath(), "resources", "autoinstall");
  }
  return path.join(process.resourcesPath, "autoinstall");
}
function sendSetupProgress(step, message, progress) {
  electron.BrowserWindow.getAllWindows().forEach((w) => {
    if (!w.isDestroyed()) {
      w.webContents.send("autoinstall:progress", { step, message, progress });
    }
  });
}
function collectDirectoryFilesForUpdate(src, shouldSkipRelPath = null) {
  const allFiles = [];
  function collectFiles(dir, rel) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const relPath = path.join(rel, entry.name);
      const normalizedRel = relPath.replace(/\\/g, "/");
      if (shouldSkipRelPath?.(normalizedRel, entry)) continue;
      const srcPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        collectFiles(srcPath, relPath);
      } else {
        allFiles.push({ srcPath, relPath: normalizedRel });
      }
    }
  }
  collectFiles(src, "");
  return allFiles;
}
function copyDirectoryUpdateSource({ sourceDir, targetDir, step, messagePrefix, shouldSkipRelPath }) {
  const files = collectDirectoryFilesForUpdate(sourceDir, shouldSkipRelPath);
  if (files.length === 0) {
    return { copied: 0 };
  }
  let copied = 0;
  for (const file of files) {
    const destPath = path.join(targetDir, file.relPath);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(file.srcPath, destPath);
    copied += 1;
    if (copied % 10 === 0 || copied === files.length) {
      sendSetupProgress(
        step,
        `${messagePrefix}: ${file.relPath}`,
        Math.round(10 + copied / files.length * 85)
      );
    }
  }
  return { copied };
}
function resolveXxmiUpdateSourceDir(sourcePath) {
  if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isDirectory()) return null;
  if (path.basename(sourcePath).toLowerCase() === "resources") return sourcePath;
  const nestedResources = path.join(sourcePath, "Resources");
  if (fs.existsSync(nestedResources) && fs.statSync(nestedResources).isDirectory()) {
    return nestedResources;
  }
  const singleChild = getSingleDirectoryChild(sourcePath);
  if (singleChild) {
    const childResources = path.join(singleChild.path, "Resources");
    if (fs.existsSync(childResources) && fs.statSync(childResources).isDirectory()) {
      return childResources;
    }
  }
  return sourcePath;
}
function isTopLevelModsRelPath(normalizedRelPath) {
  const value = String(normalizedRelPath || "").replace(/\\/g, "/");
  return value === "Mods" || value.startsWith("Mods/");
}
function getSingleDirectoryChild(dirPath) {
  try {
    const dirs = fs.readdirSync(dirPath, { withFileTypes: true }).filter((entry2) => entry2.isDirectory());
    if (dirs.length !== 1) return null;
    const entry = dirs[0];
    return { name: entry.name, path: path.join(dirPath, entry.name) };
  } catch (_) {
    return null;
  }
}
function looksLikeGamePackageDir(dirPath) {
  const markers = ["Core", "ShaderFixes", "Mods", "d3dx.ini", "3DMigoto Loader.exe"];
  return markers.some((name) => fs.existsSync(path.join(dirPath, name)));
}
function resolveGamePackageUpdateSourceDir(sourcePath, packageDir) {
  if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isDirectory()) return null;
  const packageName = path.basename(packageDir);
  if (path.basename(sourcePath).toLowerCase() === packageName.toLowerCase()) return sourcePath;
  const directPackageDir = path.join(sourcePath, packageName);
  if (fs.existsSync(directPackageDir) && fs.statSync(directPackageDir).isDirectory()) {
    return directPackageDir;
  }
  const singleChild = getSingleDirectoryChild(sourcePath);
  if (singleChild) {
    const reservedNames = /* @__PURE__ */ new Set(["core", "shaderfixes", "mods", "resources", "bin"]);
    if (!reservedNames.has(singleChild.name.toLowerCase()) && looksLikeGamePackageDir(singleChild.path)) {
      return singleChild.path;
    }
  }
  return sourcePath;
}
electron.ipcMain.handle("autoinstall:get-bundled-packages", async () => {
  try {
    const dir = getAutoinstallDir();
    if (!fs.existsSync(dir)) return { packages: [] };
    const files = listBundledAutoinstallFiles(dir);
    const packages = [];
    const xxmiBasePackage = resolveBundledAutoinstallPackage(files, "xxmi-base");
    if (xxmiBasePackage)
      packages.push({
        type: "xxmi-base",
        file: xxmiBasePackage.file,
        version: xxmiBasePackage.version,
        label: "XXMI 启动器"
      });
    const nemiPackage = resolveBundledAutoinstallPackage(files, "NEMI");
    if (nemiPackage) {
      packages.push({
        type: "nemi",
        file: nemiPackage.file,
        version: nemiPackage.version,
        label: "异环 NEMI 加载器"
      });
    }
    for (const importerName of BUNDLED_GAME_IMPORTERS) {
      const bundledPackage = resolveBundledGamePackage(files, importerName);
      if (bundledPackage) {
        const gameLabels = { WWMI: "鸣潮", ZZMI: "绝区零", EFMI: "终末地", SRMI: "星穹铁道", GIMI: "原神" };
        packages.push({
          type: "game-package",
          file: bundledPackage.file,
          version: bundledPackage.version,
          importer: importerName,
          label: `${gameLabels[importerName] || importerName} 游戏包`
        });
      }
    }
    return { packages };
  } catch (e) {
    return { packages: [], error: e.message };
  }
});
electron.ipcMain.handle("autoinstall:select-folder", async (_, title, options = {}) => {
  const result = await electron.dialog.showOpenDialog({
    title: title || "选择文件夹",
    properties: ["openDirectory"]
  });
  if (result.canceled || !result.filePaths.length) return { canceled: true };
  const selectedPath = result.filePaths[0];
  if (shouldResolveFolderSelectionAsMods(title, options)) {
    const resolved = resolveSelectedModsFolder(selectedPath, { gameId: options?.gameId });
    if (!resolved.ok) {
      return {
        canceled: false,
        success: false,
        error: resolved.error,
        candidates: resolved.candidates || []
      };
    }
    return { canceled: false, success: true, ...resolved, path: resolved.path };
  }
  return { canceled: false, success: true, path: selectedPath };
});
electron.ipcMain.handle("autoinstall:select-zip", async (_, title) => {
  const result = await electron.dialog.showOpenDialog({
    title: title || "选择压缩包",
    properties: ["openFile"],
    filters: [{ name: "压缩包", extensions: ["zip"] }]
  });
  if (result.canceled || !result.filePaths.length) return { canceled: true };
  return { canceled: false, path: result.filePaths[0] };
});
electron.ipcMain.handle("autoinstall:select-update-source", async (_, title) => {
  const result = await electron.dialog.showOpenDialog({
    title: title || "Select update package or extracted folder",
    properties: ["openFile", "openDirectory"],
    filters: [{ name: "ZIP package", extensions: ["zip"] }]
  });
  if (result.canceled || !result.filePaths.length) return { canceled: true };
  const selectedPath = result.filePaths[0];
  const sourceType = fs.existsSync(selectedPath) && fs.statSync(selectedPath).isDirectory() ? "folder" : "zip";
  return { canceled: false, path: selectedPath, sourceType };
});
electron.ipcMain.handle("autoinstall:select-mod-source", async (_, title) => {
  const result = await electron.dialog.showOpenDialog({
    title: title || "选择要导入的 Mod 来源",
    properties: ["openFile", "openDirectory"],
    filters: [
      { name: "Mod 来源（文件夹 / MP4 / 压缩包）", extensions: ["mp4", "zip", "rar", "7z", "exe"] },
      { name: "所有文件", extensions: ["*"] }
    ]
  });
  if (result.canceled || !result.filePaths.length) return { canceled: true };
  const selectedPath = result.filePaths[0];
  const sourceType = fs.existsSync(selectedPath) && fs.statSync(selectedPath).isDirectory() ? "folder" : "file";
  return { canceled: false, success: true, path: selectedPath, sourceType };
});
electron.ipcMain.handle("autoinstall:install-xxmi", async (_, { installPath }) => {
  const finalInstallPath = resolveNamedAutoinstallDir(installPath, "XXMI");
  let baseZip = path.join(getAutoinstallDir(), "xxmi-base.zip");
  try {
    const autoDir = getAutoinstallDir();
    const files = listBundledAutoinstallFiles(autoDir);
    const bundledPackage = resolveBundledAutoinstallPackage(files, "xxmi-base");
    if (bundledPackage) baseZip = path.join(autoDir, bundledPackage.file);
    if (!fs.existsSync(baseZip)) {
      return {
        error: "未找到内置的 XXMI 安装包（支持 xxmi-base.zip 或 xxmi-base-版本号.zip），请将安装包放入 resources/autoinstall 目录"
      };
    }
    probeWritableDirectory(finalInstallPath, "XXMI 安装目录");
    sendSetupProgress("xxmi", "正在解压 XXMI 启动器...", 10);
    const zip = new AdmZip(baseZip);
    const entries = zip.getEntries();
    const totalEntries = entries.length;
    let extracted = 0;
    for (const entry of entries) {
      const result = extractZipEntryWithCjkSupport(entry, finalInstallPath);
      const displayName = result?.displayName || decodeZipEntryName(entry);
      extracted++;
      const pct = Math.round(10 + extracted / totalEntries * 50);
      if (extracted % 20 === 0 || extracted === totalEntries) {
        sendSetupProgress("xxmi", `正在解压: ${displayName}`, pct);
      }
    }
    const launcherExe = path.join(finalInstallPath, "Resources", "Bin", "XXMI Launcher.exe");
    const launcherExists = fs.existsSync(launcherExe);
    if (!launcherExists) {
      return {
        error: buildXxmiLauncherMissingAdvice(launcherExe),
        installPath: finalInstallPath,
        launcherExe: null
      };
    }
    sendSetupProgress("xxmi", "XXMI 安装完成！", 100);
    logger.info("Autoinstall: XXMI installed to", finalInstallPath);
    return {
      success: true,
      installPath: finalInstallPath,
      baseDir: path.dirname(finalInstallPath),
      launcherExe
    };
  } catch (e) {
    logger.error("Autoinstall XXMI error:", e);
    return {
      error: `安装 XXMI 失败: ${formatAutoinstallArchiveError(
        e,
        baseZip,
        "XXMI",
        { path: finalInstallPath || installPath, operation: "install-xxmi" }
      )}`
    };
  }
});
electron.ipcMain.handle("autoinstall:install-nemi", async (_, { installPath, gamePath, sourceZip }) => {
  try {
    let zipPath = sourceZip;
    if (!zipPath) {
      const autoDir = getAutoinstallDir();
      const files = listBundledAutoinstallFiles(autoDir);
      const bundledPackage = resolveBundledAutoinstallPackage(files, "NEMI");
      zipPath = bundledPackage ? path.join(autoDir, bundledPackage.file) : path.join(autoDir, "NEMI.zip");
    }
    if (!fs.existsSync(zipPath)) {
      return { error: `未找到内置的 NEMI 安装包: ${zipPath}` };
    }
    probeWritableDirectory(installPath, "NEMI 安装目录");
    sendSetupProgress("nemi", "正在解压 NEMI 加载器...", 10);
    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();
    let extracted = 0;
    for (const entry of entries) {
      const result = extractZipEntryWithCjkSupport(entry, installPath);
      const displayName = result?.displayName || decodeZipEntryName(entry);
      extracted++;
      const pct = Math.round(10 + extracted / entries.length * 80);
      if (extracted % 20 === 0 || extracted === entries.length) {
        sendSetupProgress("nemi", `正在解压: ${displayName}`, pct);
      }
    }
    const directStartCmd = path.join(installPath, "Start.cmd");
    const nestedRoot = path.join(installPath, "NEMI-main");
    const nemiRoot = fs.existsSync(directStartCmd) ? installPath : nestedRoot;
    const startCmd = path.join(nemiRoot, "Start.cmd");
    const loaderExe = path.join(nemiRoot, "3DMigoto Loader.exe");
    const modsDir = path.join(nemiRoot, "Mods");
    if (!fs.existsSync(startCmd) && !fs.existsSync(loaderExe)) {
      return { error: "NEMI 安装包结构不正确，未找到 Start.cmd 或 3DMigoto Loader.exe" };
    }
    probeWritableDirectory(modsDir, "NEMI Mods 目录");
    const updates = {
      modFolderPath: modsDir,
      modLoaderPath: fs.existsSync(startCmd) ? startCmd : loaderExe,
      launchMode: "NEMI",
      launchArgs: "-dx11"
    };
    if (gamePath) {
      if (isNevernessProtectedClientExecutable(gamePath)) {
        const officialLaunchPath = resolveNevernessOfficialLaunchPath(gamePath);
        if (!officialLaunchPath) {
          return {
            error: "已选择的是异环内部客户端程序，不能直接启动。请改选根目录 NTELauncher.exe。"
          };
        }
        updates.gamePath = officialLaunchPath;
      } else {
        updates.gamePath = gamePath;
      }
    }
    if (currentConfig.activeGameId !== "neverness-to-everness") {
      currentConfig.activeGameId = "neverness-to-everness";
    }
    updateActiveGameConfig(updates);
    const defaults = ensureDefaultCharacterFolders(modsDir, "neverness-to-everness");
    electron.BrowserWindow.getAllWindows().forEach((w) => {
      if (!w.isDestroyed()) {
        w.webContents.send("mods-changed", { characterName: "__all__" });
      }
    });
    sendSetupProgress("nemi", "NEMI 安装完成！", 100);
    logger.info("Autoinstall: NEMI installed to", nemiRoot);
    return {
      success: true,
      installPath: nemiRoot,
      startCmd: fs.existsSync(startCmd) ? startCmd : null,
      loaderExe: fs.existsSync(loaderExe) ? loaderExe : null,
      modsDir,
      gamePath: updates.gamePath || "",
      defaults
    };
  } catch (e) {
    logger.error("Autoinstall NEMI error:", e);
    return {
      error: `安装 NEMI 失败: ${formatWindowsFileOperationError(e, { path: installPath, operation: "install-nemi" })}`
    };
  }
});
electron.ipcMain.handle(
  "autoinstall:install-game-package",
  async (_, { importerName, targetDir, sourceZip }) => {
    const normalizedImporterName = String(importerName || "").trim().toUpperCase();
    if (!BUNDLED_GAME_IMPORTERS.includes(normalizedImporterName)) {
      return { error: `不支持的游戏包类型: ${importerName || "未指定"}` };
    }
    const packageDir = resolveGamePackageAutoinstallDir(targetDir, normalizedImporterName);
    try {
      let zipPath = sourceZip;
      if (!zipPath) {
        const autoDir = getAutoinstallDir();
        const files = listBundledAutoinstallFiles(autoDir);
        const bundledPackage = resolveBundledGamePackage(files, normalizedImporterName);
        zipPath = bundledPackage ? path.join(autoDir, bundledPackage.file) : path.join(autoDir, `${normalizedImporterName}.zip`);
      }
      if (!fs.existsSync(zipPath)) {
        return { error: `未找到游戏包: ${zipPath}` };
      }
      probeWritableDirectory(packageDir, `${normalizedImporterName} 游戏包目录`);
      sendSetupProgress("game-package", `正在解压 ${normalizedImporterName} 游戏包...`, 10);
      const zip = new AdmZip(zipPath);
      const entries = zip.getEntries();
      const totalEntries = entries.length;
      let extracted = 0;
      for (const entry of entries) {
        const result = extractZipEntryWithCjkSupport(entry, packageDir);
        const displayName = result?.displayName || decodeZipEntryName(entry);
        extracted++;
        const pct = Math.round(10 + extracted / totalEntries * 80);
        if (extracted % 20 === 0 || extracted === totalEntries) {
          sendSetupProgress("game-package", `正在解压: ${displayName}`, pct);
        }
      }
      const modsDir = path.join(packageDir, "Mods");
      probeWritableDirectory(modsDir, `${normalizedImporterName} Mods 目录`);
      if (!fs.existsSync(modsDir)) {
        return {
          error: buildGamePackageMissingAdvice(normalizedImporterName, modsDir),
          packageDir,
          modsDir
        };
      }
      sendSetupProgress("game-package", `${normalizedImporterName} 游戏包安装完成！`, 100);
      logger.info(`Autoinstall: ${normalizedImporterName} game package installed to`, packageDir);
      return {
        success: true,
        packageDir,
        modsDir
      };
    } catch (e) {
      logger.error("Autoinstall game package error:", e);
      return {
        error: `安装游戏包失败: ${formatWindowsFileOperationError(e, { path: packageDir || targetDir, operation: "install-game-package" })}`
      };
    }
  }
);
electron.ipcMain.handle(
  "autoinstall:configure-xxmi",
  async (_, { xxmiRootDir, importerName, packageDir, gamePath }) => {
    try {
      const configPath = path.join(xxmiRootDir, "XXMI Launcher Config.json");
      let config = {};
      if (fs.existsSync(configPath)) {
        try {
          config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        } catch (_2) {
          config = {};
        }
      }
      if (!config.Importers) config.Importers = {};
      if (!config.Importers[importerName]) {
        config.Importers[importerName] = { Importer: {}, Migoto: {} };
      }
      if (!config.Importers[importerName].Importer) {
        config.Importers[importerName].Importer = {};
      }
      config.Importers[importerName].Importer.importer_folder = packageDir.replace(/\\/g, "/");
      if (gamePath) {
        const gameDir = path.dirname(gamePath);
        config.Importers[importerName].Importer.game_folder = gameDir.replace(/\\/g, "/");
      }
      if (!config.Launcher) {
        config.Launcher = { auto_update: false, locale: "CN" };
      }
      if (!config.Launcher.enabled_importers) {
        config.Launcher.enabled_importers = [];
      }
      if (!config.Launcher.enabled_importers.includes(importerName)) {
        config.Launcher.enabled_importers.push(importerName);
      }
      fs.writeFileSync(configPath, JSON.stringify(config, null, 4), "utf-8");
      logger.info(`Autoinstall: XXMI config updated for ${importerName}, packageDir=${packageDir}`);
      return { success: true, configPath };
    } catch (e) {
      logger.error("Autoinstall configure XXMI error:", e);
      return { error: `配置 XXMI 失败: ${e.message}` };
    }
  }
);
electron.ipcMain.handle(
  "autoinstall:apply-paths",
  async (_, { gameId: gameId2, modFolderPath, modLoaderPath, gamePath, launchMode, launchArgs }) => {
    try {
      const targetGame = (currentConfig.games || []).find((g) => g.id === gameId2);
      if (!targetGame) {
        return { error: `未找到游戏配置: ${gameId2}` };
      }
      const updates = {};
      if (modFolderPath) {
        const resolved = resolveSelectedModsFolder(modFolderPath, { gameId: gameId2 });
        if (!resolved.ok) return { error: resolved.error };
        updates.modFolderPath = resolved.path;
      }
      if (modLoaderPath) {
        if (!fs.existsSync(modLoaderPath)) {
          return { error: buildMissingXxmiLauncherLaunchError("XXMI", modLoaderPath) };
        }
        updates.modLoaderPath = modLoaderPath;
      }
      if (gamePath) updates.gamePath = gamePath;
      if (launchMode) updates.launchMode = launchMode;
      if (launchArgs !== void 0) updates.launchArgs = launchArgs;
      if (currentConfig.activeGameId !== gameId2) {
        currentConfig.activeGameId = gameId2;
      }
      updateActiveGameConfig(updates);
      let defaults = null;
      if (updates.modFolderPath) {
        defaults = ensureDefaultCharacterFolders(updates.modFolderPath, gameId2);
        electron.BrowserWindow.getAllWindows().forEach((w) => {
          if (!w.isDestroyed()) {
            w.webContents.send("mods-changed", { characterName: "__all__" });
          }
        });
      }
      return { success: true, config: buildRendererConfig(), defaults };
    } catch (e) {
      return { error: e.message };
    }
  }
);
function formatSetupSourceSameAsTargetMessage(targetModsDir) {
  return [
    "你选择的来源就是当前目标 Mods 目录，不能把目标目录再导入到自己里面。",
    `当前目标：${targetModsDir}`,
    "请改选“待移动/待导入”的 Mods 文件夹，例如从其它管理器、旧目录或压缩包里解压出来的 Mods 文件夹，而不是 QAQ 当前正在使用的目标 Mods。",
    "如果分不清该选哪个文件夹，建议先跳过向导导入，直接去 Mod 市场下载单独 Mod 使用。"
  ].join("\n");
}
function formatSetupArchiveExternalExtractMessage(filePath) {
  if (isLargeArchiveForExternalExtraction(filePath)) return formatLargeArchiveExternalExtractMessage(filePath);
  return [
    `检测到压缩包：${path.basename(filePath || "") || filePath}`,
    "此导入入口不直接解压 zip/rar/7z/exe 文件。请先解压，再导入文件夹。",
    "如果不确定压缩包里面是什么结构，建议直接去 Mod 市场下载单独 Mod 使用。"
  ].join("\n");
}
function isSetupIntegratedModsRoot(modsDir, gameId2 = getActiveGameScopeId()) {
  if (!isLikelyIntegratedModsRoot(modsDir, { allowNamelessRoot: true, gameId: gameId2 })) return false;
  if (path.basename(modsDir).toLowerCase() === "mods") return true;
  try {
    return fs.readdirSync(modsDir, { withFileTypes: true }).some(
      (entry) => entry.isDirectory() && !entry.name.startsWith(".") && !!getKnownCharacterDisplayName(entry.name, gameId2)
    );
  } catch (_) {
    return false;
  }
}
function findSetupIntegratedModsDirUnder(rootDir, maxDepth, gameId2) {
  const queue = [{ dirPath: rootDir, depth: 0 }];
  const visited = /* @__PURE__ */ new Set();
  while (queue.length > 0) {
    const current = queue.shift();
    let resolved;
    try {
      resolved = path.resolve(current.dirPath);
      const key = normalizeComparablePath(resolved);
      if (!resolved || visited.has(key)) continue;
      visited.add(key);
      if (!fs.statSync(resolved).isDirectory()) continue;
    } catch (_) {
      continue;
    }
    if (isSetupIntegratedModsRoot(resolved, gameId2)) return resolved;
    if (current.depth >= maxDepth) continue;
    let children = [];
    try {
      children = fs.readdirSync(resolved, { withFileTypes: true }).filter((entry) => entry.isDirectory() && !entry.name.startsWith("."));
    } catch (_) {
      continue;
    }
    children.sort((left, right) => {
      const leftIsMods = left.name.toLowerCase() === "mods";
      const rightIsMods = right.name.toLowerCase() === "mods";
      if (leftIsMods !== rightIsMods) return leftIsMods ? -1 : 1;
      return left.name.localeCompare(right.name, "zh");
    });
    for (const child of children) {
      queue.push({ dirPath: path.join(resolved, child.name), depth: current.depth + 1 });
    }
  }
  return null;
}
function findSetupIntegratedModsDir(sourceRoot, targetModsDir, gameId2 = getActiveGameScopeId()) {
  if (!sourceRoot || !fs.existsSync(sourceRoot) || !fs.statSync(sourceRoot).isDirectory()) return null;
  const candidates = [];
  const addCandidateRoot = (dirPath, label, depth = 3) => {
    if (!dirPath || !fs.existsSync(dirPath)) return;
    try {
      if (!fs.statSync(dirPath).isDirectory()) return;
    } catch (_) {
      return;
    }
    const modsDir = findSetupIntegratedModsDirUnder(dirPath, depth, gameId2);
    if (!modsDir) return;
    const normalized = normalizeComparablePath(modsDir);
    if (candidates.some((item) => normalizeComparablePath(item.modsDir) === normalized)) return;
    candidates.push({ modsDir, label });
  };
  addCandidateRoot(sourceRoot, "当前文件夹", 3);
  const parent = path.dirname(sourceRoot);
  if (parent && parent !== sourceRoot) {
    addCandidateRoot(parent, "上一级文件夹", 2);
    const grandParent = path.dirname(parent);
    if (grandParent && grandParent !== parent) {
      addCandidateRoot(grandParent, "上两级文件夹", 1);
    }
  }
  const usable = candidates.find((item) => !isSameResolvedPath(item.modsDir, targetModsDir));
  return usable || candidates[0] || null;
}
async function importSetupIntegratedModsDir(sourceModsDir, modsDir, gameId2) {
  if (isSameResolvedPath(sourceModsDir, modsDir)) {
    return { error: formatSetupSourceSameAsTargetMessage(modsDir), code: "SOURCE_EQUALS_TARGET" };
  }
  probeWritableDirectory(modsDir, "目标 Mods 目录");
  assertDirectoryHasAnyFile(sourceModsDir, "Setup wizard Mods source");
  const result = await moveIntegratedModsToCurrentMods(sourceModsDir, modsDir, {
    gameId: gameId2 || getActiveGameScopeId(),
    onProgress: (progress) => {
      sendSetupProgress(
        "import-mods",
        progress?.modName ? `正在导入: ${progress.modName}` : "正在导入整合包 Mods...",
        Math.round(5 + (progress?.current || 0) / Math.max(1, progress?.total || 1) * 90)
      );
    }
  });
  if (result.modCount <= 0 || result.movedFiles <= 0) {
    return { error: "所选 Mods 分层里没有可导入的角色 Mod。" };
  }
  clearConflictCache(null, gameId2 || getActiveGameScopeId());
  notifyAllModWindowsChanged("__all__");
  return {
    success: true,
    integratedPackage: true,
    sourceModsDir,
    targetModsDir: modsDir,
    copiedDirs: result.modCount,
    totalFilesCopied: result.movedFiles,
    copiedFiles: result.copiedFiles || result.movedFiles,
    movedFiles: result.movedFiles,
    modCount: result.modCount,
    characterCount: result.characterCount,
    affectedCharacters: result.affectedCharacters || []
  };
}
electron.ipcMain.handle("autoinstall:import-mods", async (_, { sourceDir, modsDir, gameId: gameId2 }) => {
  let tempDir = null;
  try {
    if (!sourceDir || !fs.existsSync(sourceDir)) {
      return { error: `Mod 来源不存在: ${sourceDir || ""}` };
    }
    if (!modsDir) {
      return { error: "目标 Mods 目录为空，请先选择正确的目标 Mods 文件夹。" };
    }
    if (!fs.existsSync(modsDir)) {
      fs.mkdirSync(modsDir, { recursive: true });
    }
    sendSetupProgress("import-mods", "正在检查 Mod 来源...", 5);
    const sourcePath = path.resolve(sourceDir);
    const targetModsDir = path.resolve(modsDir);
    const sourceStat = fs.statSync(sourcePath);
    if (sourceStat.isFile()) {
      const ext = path.extname(sourcePath).toLowerCase();
      if (ext === ".mp4") {
        if (!isDisguisedMp4(sourcePath)) {
          return { error: "这个 MP4 不是 QAQ 伪装 Mod 文件。请拖入伪装 MP4，或先解压后拖入文件夹。" };
        }
        tempDir = ensureTempRootNearPath(sourcePath, `.qaqm-setup-mp4-${Date.now()}-${crypto.randomUUID()}`);
        sendSetupProgress("import-mods", "正在解密 MP4 伪装 Mod...", 10);
        await extractDisguisedMp4(sourcePath, tempDir, {
          onProgress: (progress) => {
            sendSetupProgress(
              "import-mods",
              progress?.message || "正在解密 MP4 伪装 Mod...",
              Math.min(85, Math.round(10 + Number(progress?.percent || 0) * 0.65))
            );
          }
        });
        const detected2 = findSetupIntegratedModsDir(tempDir, targetModsDir, gameId2);
        if (!detected2 || !detected2.modsDir) {
          return {
            error: "MP4 已解密，但里面不是 Mods/角色分类/具体 Mod 的整合包结构。此入口用于导入整合包或旧 Mods 文件夹；单独 Mod 请进入对应角色页安装。"
          };
        }
        const result2 = await importSetupIntegratedModsDir(detected2.modsDir, targetModsDir, gameId2);
        if (result2.success) {
          result2.sourceType = "mp4";
          result2.detectedFrom = detected2.label;
          sendSetupProgress("import-mods", `Mod 导入完成！共导入 ${result2.modCount || 0} 个 Mod`, 100);
          logger.info(`Autoinstall: imported MP4 integrated Mods from ${detected2.modsDir} to ${targetModsDir}`);
        }
        return result2;
      }
      if (isExternalExtractArchivePath(sourcePath)) {
        return { error: formatSetupArchiveExternalExtractMessage(sourcePath), code: "EXTERNAL_EXTRACT_REQUIRED" };
      }
      return { error: "此入口支持文件夹、QAQ 伪装 MP4，或已解压后的整合包内容。其它文件请先解压后再导入。" };
    }
    if (!sourceStat.isDirectory()) {
      return { error: `不支持的来源类型: ${sourcePath}` };
    }
    const detected = findSetupIntegratedModsDir(sourcePath, targetModsDir, gameId2);
    if (!detected || !detected.modsDir) {
      return {
        error: "没有找到 Mods/角色分类/具体 Mod 的整合包分层。请拖入旧管理器的 Mods 文件夹，或拖入包含 Mods 文件夹的上级目录；如果不确定结构，建议直接去 Mod 市场下载单独 Mod 使用。"
      };
    }
    if (isSameResolvedPath(detected.modsDir, targetModsDir)) {
      return { error: formatSetupSourceSameAsTargetMessage(targetModsDir), code: "SOURCE_EQUALS_TARGET" };
    }
    const result = await importSetupIntegratedModsDir(detected.modsDir, targetModsDir, gameId2);
    if (result.success) {
      result.sourceType = "folder";
      result.detectedFrom = detected.label;
    }
    sendSetupProgress("import-mods", `Mod 导入完成！共导入 ${result.modCount || 0} 个 Mod`, 100);
    logger.info(`Autoinstall: imported integrated Mods from ${detected.modsDir} to ${targetModsDir}`);
    return result;
  } catch (e) {
    logger.error("Autoinstall import mods error:", e);
    return { error: `导入 Mod 失败: ${e.message}` };
  } finally {
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (_2) {
      }
    }
  }
});
electron.ipcMain.handle("autoinstall:update-xxmi", async (_, { xxmiRootDir, updateZipPath, updateSourcePath }) => {
  try {
    const sourcePath = updateSourcePath || updateZipPath;
    if (!sourcePath || !fs.existsSync(sourcePath)) {
      return { error: `未找到更新来源: ${sourcePath || ""}` };
    }
    const resourcesDir = path.join(xxmiRootDir, "Resources");
    if (!fs.existsSync(resourcesDir)) {
      return { error: `XXMI Resources 目录不存在: ${resourcesDir}` };
    }
    const sourceStat = fs.statSync(sourcePath);
    if (sourceStat.isDirectory()) {
      const sourceDir = resolveXxmiUpdateSourceDir(sourcePath);
      if (!sourceDir || !fs.existsSync(sourceDir)) {
        return { error: `Invalid XXMI update folder: ${sourcePath}` };
      }
      sendSetupProgress("update-xxmi", "Copying XXMI update folder...", 10);
      copyDirectoryUpdateSource({
        sourceDir,
        targetDir: resourcesDir,
        step: "update-xxmi",
        messagePrefix: "Updating"
      });
    } else {
      sendSetupProgress("update-xxmi", "Extracting XXMI update package...", 10);
      const zip = new AdmZip(sourcePath);
      const entries = zip.getEntries();
      let extracted = 0;
      for (const entry of entries) {
        const result = extractZipEntryWithCjkSupport(entry, resourcesDir);
        const displayName = result?.displayName || decodeZipEntryName(entry);
        extracted++;
        if (extracted % 10 === 0 || extracted === entries.length) {
          sendSetupProgress(
            "update-xxmi",
            `Updating: ${displayName}`,
            Math.round(10 + extracted / entries.length * 85)
          );
        }
      }
    }
    sendSetupProgress("update-xxmi", "XXMI update complete!", 100);
    logger.info("Autoinstall: XXMI updated from", sourcePath);
    return { success: true };
  } catch (e) {
    logger.error("Autoinstall update XXMI error:", e);
    return { error: `Update XXMI failed: ${e.message}` };
  }
});
electron.ipcMain.handle(
  "autoinstall:update-game-package",
  async (_, { packageDir, updateZipPath, updateSourcePath }) => {
    try {
      const sourcePath = updateSourcePath || updateZipPath;
      if (!sourcePath || !fs.existsSync(sourcePath)) {
        return { error: `Update source not found: ${sourcePath || ""}` };
      }
      if (!fs.existsSync(packageDir)) {
        return { error: `Game package directory not found: ${packageDir}` };
      }
      const sourceStat = fs.statSync(sourcePath);
      if (sourceStat.isDirectory()) {
        const sourceDir = resolveGamePackageUpdateSourceDir(sourcePath, packageDir);
        if (!sourceDir || !fs.existsSync(sourceDir)) {
          return { error: `Invalid game package update folder: ${sourcePath}` };
        }
        sendSetupProgress("update-game-package", "Copying game package update folder...", 10);
        copyDirectoryUpdateSource({
          sourceDir,
          targetDir: packageDir,
          step: "update-game-package",
          messagePrefix: "Updating",
          shouldSkipRelPath: (normalizedRel, entry) => entry.isDirectory() && isTopLevelModsRelPath(normalizedRel)
        });
      } else {
        sendSetupProgress("update-game-package", "Extracting game package update...", 10);
        const zip = new AdmZip(sourcePath);
        const entries = zip.getEntries();
        let extracted = 0;
        for (const entry of entries) {
          const decodedName = decodeZipEntryName(entry);
          const normalizedName = decodedName.replace(/\\/g, "/");
          if (isTopLevelModsRelPath(normalizedName)) {
            continue;
          }
          const result = extractZipEntryWithCjkSupport(entry, packageDir);
          const displayName = result?.displayName || decodedName;
          extracted++;
          if (extracted % 10 === 0 || extracted === entries.length) {
            sendSetupProgress(
              "update-game-package",
              `Updating: ${displayName}`,
              Math.round(10 + extracted / entries.length * 85)
            );
          }
        }
      }
      sendSetupProgress("update-game-package", "Game package update complete! Mods folder preserved.", 100);
      logger.info("Autoinstall: game package updated at", packageDir, "from", sourcePath);
      return { success: true };
    } catch (e) {
      logger.error("Autoinstall update game package error:", e);
      return { error: `Update game package failed: ${e.message}` };
    }
  }
);
electron.ipcMain.handle("autoinstall:detect-game-path", async (_, gameId2) => {
  try {
    const gameDetection = {
      endfield: (() => {
        const candidates2 = [];
        const regPath = readRegistryValue("HKCU\\SOFTWARE\\Hypergryph\\Launcher", "InstallPath");
        if (regPath) candidates2.push(path.join(regPath, "games", "Endfield Game", "Endfield.exe"));
        for (const drive of ["G", "C", "D", "E", "F"]) {
          candidates2.push(`${drive}:\\Hypergryph Launcher\\games\\Endfield Game\\Endfield.exe`);
        }
        return candidates2;
      })(),
      zzz: (() => {
        const candidates2 = [];
        const regInstall = readRegistryValue(
          "HKCU\\SOFTWARE\\miHoYo\\HYP\\1_1\\nap_cn",
          "GameInstallPath"
        );
        if (regInstall) candidates2.push(path.join(regInstall, "ZenlessZoneZero.exe"));
        for (const drive of ["G", "C", "D", "E", "F"]) {
          candidates2.push(
            `${drive}:\\miHoYo Launcher\\games\\ZenlessZoneZero Game\\ZenlessZoneZero.exe`
          );
          candidates2.push(`${drive}:\\ZenlessZoneZero Game\\ZenlessZoneZero.exe`);
        }
        return candidates2;
      })(),
      "wuthering-waves": (() => {
        const candidates2 = [];
        for (const drive of ["F", "G", "C", "D", "E"]) {
          candidates2.push(`${drive}:\\Wuthering Waves\\Wuthering Waves Game\\Wuthering Waves.exe`);
          candidates2.push(
            `${drive}:\\Kuro Games\\Wuthering Waves\\Wuthering Waves Game\\Wuthering Waves.exe`
          );
          candidates2.push(
            `${drive}:\\KRInstall\\Wuthering Waves\\Wuthering Waves Game\\Wuthering Waves.exe`
          );
        }
        return candidates2;
      })(),
      "neverness-to-everness": buildNevernessGamePathCandidates(),
      "honkai-star-rail": buildHonkaiStarRailGamePathCandidates(),
      "genshin-impact": buildGenshinGamePathCandidates()
    };
    const candidates = gameDetection[gameId2] || [];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        const gamePath = gameId2 === "neverness-to-everness" ? resolveNevernessDetectedGamePath(p) : p;
        if (!gamePath) continue;
        return { found: true, gamePath, gameDir: path.dirname(gamePath) };
      }
    }
    return { found: false };
  } catch (e) {
    return { found: false, error: e.message };
  }
});
