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
function resolveGamePackageModsDirectory(baseDir, importerName) {
  const packageDir = resolveGamePackageInstallDirectory(baseDir, importerName);
  return packageDir ? joinWindowsPath(packageDir, "Mods") : "";
}
function normalizeComparableWindowsPath(value) {
  return normalizeDisplayPath(value).toLowerCase();
}
function evaluateXxmiImporterPathConsistency({ modsPath, importerPath } = {}) {
  const normalizedModsPath = normalizeDisplayPath(modsPath);
  const managerPackagePath = getWindowsPathLeaf(normalizedModsPath).toLowerCase() === "mods" ? getWindowsParentPath(normalizedModsPath) : "";
  const configuredPackagePath = normalizeDisplayPath(importerPath);
  if (!managerPackagePath) {
    return { status: "invalid-mods-path", managerPackagePath: "", configuredPackagePath };
  }
  if (!configuredPackagePath) {
    return { status: "unconfigured", managerPackagePath, configuredPackagePath: "" };
  }
  const matches = normalizeComparableWindowsPath(managerPackagePath) === normalizeComparableWindowsPath(configuredPackagePath);
  return {
    status: matches ? "match" : "mismatch",
    managerPackagePath,
    configuredPackagePath
  };
}
export {
  resolveGamePackageModsDirectory as a,
  resolveGamePackageInstallDirectory as b,
  resolveNamedInstallDirectory as c,
  evaluateXxmiImporterPathConsistency as e,
  getWindowsParentPath as g,
  resolveXxmiRootFromLauncherPath as r
};
