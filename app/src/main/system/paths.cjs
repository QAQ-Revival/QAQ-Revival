"use strict";

const path = require("path");
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
module.exports = {
  normalizeComparablePath,
  isPathInsideDirectory,
  isSameResolvedPath
};
