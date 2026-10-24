"use strict";

const fs = require("node:fs");
const path = require("node:path");

const HOYO_GAMES = new Set(["genshin-impact", "zzz", "honkai-star-rail"]);
const LAUNCHER_FOLDERS = {
  arknights: ["Hypergryph Launcher"],
  endfield: ["Hypergryph Launcher", "GRYPHLINE Launcher"],
  "wuthering-waves": ["Wuthering Waves", "Kuro Games/Wuthering Waves", "KRInstall/Wuthering Waves"],
  "neverness-to-everness": ["Neverness To Everness", "Hotta/Neverness To Everness", "Perfect World Games/Neverness To Everness"]
};

function getLauncherNames(game) {
  if (game.id === "neverness-to-everness") return ["NTELauncher.exe"];
  return HOYO_GAMES.has(game.id) ? ["launcher.exe", "HoYoPlay.exe"] : ["launcher.exe"];
}

function isOfficialLauncherPath(game, filePath) {
  if (!game || typeof filePath !== "string" || !path.isAbsolute(filePath) || /[\0\r\n]/.test(filePath)) return false;
  const name = path.basename(filePath).toLowerCase();
  if (!getLauncherNames(game).some(candidate => candidate.toLowerCase() === name) || filePath.toLowerCase() === String(game.modLoaderPath || "").toLowerCase()) return false;
  try { return fs.statSync(filePath).isFile(); } catch { return false; }
}

function resolveOfficialLauncherPath(game, { gamePath = game?.gamePath, roots } = {}) {
  if (!game) return "";
  // An explicit selection takes priority; a stale selection must be corrected by the user.
  if (game.officialLauncherPath) return isOfficialLauncherPath(game, game.officialLauncherPath) ? game.officialLauncherPath : "";
  const candidates = [];
  const names = getLauncherNames(game);
  if (game.id === "neverness-to-everness") names.push("NTELauncher/NTELauncher.exe");
  if (gamePath) {
    let directory = path.dirname(gamePath);
    for (let depth = 0; depth < 6; depth++) {
      candidates.push(...names.map(name => path.join(directory, name)));
      const parent = path.dirname(directory);
      if (parent === directory) break;
      directory = parent;
    }
  }
  const folders = HOYO_GAMES.has(game.id) ? ["miHoYo Launcher", "HoYoPlay"] : LAUNCHER_FOLDERS[game.id] || [];
  const searchRoots = roots || [...new Set([
    ...(gamePath ? [path.parse(gamePath).root] : []),
    process.env.ProgramFiles, process.env["ProgramFiles(x86)"],
    ...["C", "D", "E", "F", "G"].map(drive => `${drive}:\\`)
  ].filter(Boolean))];
  for (const root of searchRoots) {
    for (const folder of folders) {
      candidates.push(...names.map(name => path.join(root, folder, name)));
    }
  }
  return candidates.find(candidate => isOfficialLauncherPath(game, candidate)) || "";
}

module.exports = { isOfficialLauncherPath, resolveOfficialLauncherPath };
