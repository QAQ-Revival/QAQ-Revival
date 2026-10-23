"use strict";

const path = require("path");
const fs = require("node:fs");
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
const MANAGED_INSTALL_CONTENT_TYPES = new Set(["mod", "xxmi-update", "game-package-update", "fixer"]);
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
    const relativeSegments = path.relative(cursor, resolved).split(path.sep).filter(Boolean).map(segment => segment.toLowerCase());
    if (relativeSegments[0] === "resources" && relativeSegments[1] === "bin") return cursor;
    const parent = path.dirname(cursor);
    if (!parent || parent === cursor) break;
    cursor = parent;
  }
  return null;
}
function relativePathTouchesMods(relativePath) {
  return String(relativePath || "").replace(/\\/g, "/").split("/").filter(Boolean).some(segment => segment.toLowerCase() === "mods");
}
const BUNDLED_GAME_IMPORTERS = Object.freeze(["WWMI", "ZZMI", "EFMI", "SRMI", "GIMI"]);
function escapeRegExp(value) {
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
  const pattern = new RegExp(`^${escapeRegExp(name)}(?:-v?(\\d+(?:\\.\\d+)*))?\\.zip$`, "i");
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
  const candidates = (Array.isArray(files) ? files : []).map(file => parseBundledAutoinstallPackage(file, packageName)).filter(Boolean);
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
  if (!directory || !fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, {
    withFileTypes: true
  }).filter(entry => entry.isFile() && /\.zip$/i.test(entry.name)).map(entry => entry.name);
}
function resolveBundledGamePackage(files, importerName) {
  const importer = String(importerName || "").trim().toUpperCase();
  if (!BUNDLED_GAME_IMPORTERS.includes(importer)) return null;
  const candidates = [importer, `${importer}-PACKAGE`].map(name => resolveBundledAutoinstallPackage(files, name)).filter(Boolean);
  candidates.sort((a, b) => compareBundledPackageVersions(b.version, a.version) || compareCandidateFileNames(a, b));
  const selected = candidates[0];
  return selected ? {
    ...selected,
    importer
  } : null;
}
module.exports = {
  getWindowsPathLeaf,
  resolveNamedInstallDirectory,
  resolveXxmiRootFromLauncherPath,
  resolveGamePackageInstallDirectory,
  normalizeManagedInstallContentType,
  inferManagedInstallFromName,
  deriveGamePackageRootFromModsPath,
  deriveXxmiRootFromLoaderPath,
  relativePathTouchesMods,
  resolveBundledAutoinstallPackage,
  listBundledAutoinstallFiles,
  resolveBundledGamePackage,
  IMPORTER_GAME_IDS,
  BUNDLED_GAME_IMPORTERS
};
