"use strict";

const electron = require("electron");
const path = require("path");
const fs = require("fs");
const configStore = require("../config/store.cjs");
const gamesSettings = require("./settings.cjs");
const installPaths = require("../install/paths.cjs");
function readRegistryValue(keyPath, valueName) {
  try {
    const {
      execSync
    } = require("child_process");
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
  const addCandidate = candidate => {
    const normalized = String(candidate || "").trim();
    if (normalized && !candidates.includes(normalized)) candidates.push(normalized);
  };
  const registryKeys = ["HKCU\\SOFTWARE\\miHoYo\\HYP\\1_1\\hkrpg_cn", "HKCU\\SOFTWARE\\miHoYo\\HYP\\1_1\\hkrpg_global", "HKCU\\SOFTWARE\\Cognosphere\\HYP\\1_1\\hkrpg_global", "HKCU\\SOFTWARE\\Cognosphere\\HYP\\1_1\\hkrpg_os"];
  registryKeys.forEach(registryKey => {
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
  const preferred = gamesSettings.getGameById("genshin-impact")?.modLoaderPath;
  const candidates = [preferred, ...(configStore.currentConfig.games || []).map(game => game.modLoaderPath)].filter(loader => installPaths.getWindowsPathLeaf(loader || "").toLowerCase() === "xxmi launcher.exe");
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
    const info = gamesSettings.readXxmiImporterPathInfo(candidate, "genshin-impact");
    return info.importerPath && gamesSettings.isExistingDirectory(path.join(info.importerPath, "Mods")) ? 1 : 0;
  };
  return available.sort((a, b) => score(b) - score(a));
}
function buildGenshinGamePathCandidates() {
  const folders = getGenshinLauncherCandidates().map(loader => {
    const info = gamesSettings.readXxmiImporterPathInfo(loader, "genshin-impact");
    return info.gameFolder ? path.resolve(info.xxmiRootDir, info.gameFolder) : "";
  }).filter(Boolean);
  return require("./genshin/catalog.cjs").buildGamePathCandidates(readRegistryValue, folders);
}
module.exports = {
  readRegistryValue,
  buildHonkaiStarRailGamePathCandidates,
  getGenshinLauncherCandidates,
  buildGenshinGamePathCandidates
};
