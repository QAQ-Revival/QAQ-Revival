"use strict";

module.exports = {
  isNevernessInnerGameExecutable,
  isNevernessProtectedClientExecutable,
  resolveNevernessOfficialLaunchPath,
  getNevernessOfficialLauncherPathFromRoot,
  buildNevernessGamePathCandidates,
  resolveNevernessDetectedGamePath,
  normalizeNevernessLaunchPath,
  getNevernessOfficialLaunchArgs
};
const path = require("path");
const fs = require("fs");
const gamesNevernessLoader = require("./loader.cjs");
const systemWindows = require("../../system/windows.cjs");
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
  const gameRoot = gamesNevernessLoader.inferNevernessGameRootFromPath(filePath);
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
  const candidates = [path.join(gameRoot, "NTELauncher", "NTELauncher.exe"), path.join(gameRoot, "NTELauncher.exe")];
  return candidates.find(candidate => fs.existsSync(candidate)) || "";
}
function buildNevernessGamePathCandidates() {
  const roots = [];
  const addRoot = rootPath => {
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
    candidates.push(path.join(root, "Client", "WindowsNoEditor", "HT", "Binaries", "Win64", "HTGame.exe"));
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
  const args = systemWindows.parseLaunchArgs(customLaunchArgs);
  const executableName = path.basename(gamePath || "").toLowerCase();
  if (executableName === "ntelauncher.exe") {
    return [];
  }
  return args;
}
