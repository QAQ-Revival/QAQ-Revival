"use strict";

const i18n = require("../../../shared/i18n/core.cjs");
module.exports = {
  registerIpc,
  isNevernessGame,
  setNevernessModMode,
  getNevernessDx12DisabledModsDir,
  isNevernessDx12Mode,
  inferNevernessGameRootFromPath,
  getNevernessDx12Paths,
  ensureNevernessDx12GamePaths,
  launchNevernessDx12Loader
};
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const AdmZip = require("adm-zip");
const archivesZip = require("../../archives/zip.cjs");
const charactersCatalog = require("../../characters/catalog.cjs");
const configStore = require("../../config/store.cjs");
const gamesNevernessLaunch = require("./paths.cjs");
const gamesSettings = require("../settings.cjs");
const marketSettings = require("../../market/settings.cjs");
const systemFiles = require("../../system/files.cjs");
const systemWindows = require("../../system/windows.cjs");
const NEVERNESS_GAME_ID = "neverness-to-everness";
const NEVERNESS_DX12_META_FILE = ".qaqm-dx12-pak.json";
const NEVERNESS_DX12_PAK_EXTS = [".pak", ".ucas", ".utoc", ".sig"];
const NEVERNESS_DX12_DEFAULT_PAK_DIR = "MOD";
const NEVERNESS_DX12_PAK_DIR_OPTIONS = ["MOD"];
const NEVERNESS_DX12_LOADER_DIR_NAME = "Neverness to Everness Mod Loader";
const NEVERNESS_DX12_LOADER_EXE_NAME = "Game start.exe";
const NEVERNESS_DX12_SIG_BYPASSER_PLUGIN_NAME = "UniversalSigBypasser.asi";
function isNevernessGame(gameId2 = gamesSettings.getActiveGameScopeId()) {
  return gameId2 === NEVERNESS_GAME_ID;
}
function getNevernessModMode() {
  return configStore.currentConfig.nevernessModMode === "dx12" ? "dx12" : "nemi";
}
function setNevernessModMode(mode) {
  configStore.currentConfig.nevernessModMode = mode === "dx12" ? "dx12" : "nemi";
  configStore.saveConfig(configStore.currentConfig);
  gamesSettings.notifyGamesChanged();
}
function getNevernessDx12PakDirName() {
  return NEVERNESS_DX12_DEFAULT_PAK_DIR;
}
function getNevernessDx12DisabledModsDir(gameId2 = NEVERNESS_GAME_ID) {
  const configured = String(gamesSettings.getGameById(gameId2)?.nevernessDx12DisabledModsDir || "").trim();
  if (configured) return configured;
  const gameRoot = getNevernessGameRoot(gameId2);
  const driveRoot = gameRoot ? path.parse(gameRoot).root : "";
  if (!driveRoot) return "";
  const disabledDir = path.join(driveRoot, "QAQR_Neverness_Disabled_Pak_Mods");
  const legacyDir = path.join(driveRoot, "QAQManager_Neverness_Disabled_Pak_Mods");
  return !fs.existsSync(disabledDir) && fs.existsSync(legacyDir) ? legacyDir : disabledDir;
}
function setNevernessDx12DisabledModsDir(dirPath) {
  const game = (configStore.currentConfig.games || []).find(item => item.id === NEVERNESS_GAME_ID);
  if (!game) throw new Error(i18n.t("backend.games.nevernessLoader.nevernessConfigMissing"));
  game.nevernessDx12DisabledModsDir = String(dirPath || "").trim();
  configStore.saveConfig(configStore.currentConfig);
  gamesSettings.notifyGamesChanged();
}
function isNevernessDx12Mode(gameId2 = gamesSettings.getActiveGameScopeId()) {
  return isNevernessGame(gameId2) && getNevernessModMode() === "dx12";
}
function findFileByNameRecursive(dirPath, fileName) {
  if (!dirPath || !fs.existsSync(dirPath)) return null;
  for (const entry of fs.readdirSync(dirPath, {
    withFileTypes: true
  })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isFile() && entry.name.toLowerCase() === String(fileName).toLowerCase()) return fullPath;
    if (entry.isDirectory()) {
      const found = findFileByNameRecursive(fullPath, fileName);
      if (found) return found;
    }
  }
  return null;
}
function findNevernessDx12Resource(...segments) {
  const exactCandidates = charactersCatalog.getBundledResourceCandidates("dx12", "异环", ...segments);
  for (const candidate of exactCandidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  const fileName = segments[segments.length - 1];
  if (fileName && path.extname(fileName)) {
    for (const resourceRoot of charactersCatalog.getBundledResourceCandidates("dx12", "异环")) {
      const found = findFileByNameRecursive(resourceRoot, fileName);
      if (found) return found;
    }
  }
  return null;
}
function getNevernessDx12BundledLoaderDir() {
  const loaderExe = findNevernessDx12Resource(NEVERNESS_DX12_LOADER_DIR_NAME, NEVERNESS_DX12_LOADER_EXE_NAME);
  return loaderExe ? path.dirname(loaderExe) : "";
}
function getNevernessDx12ConfiguredLoaderExe(gameId2 = NEVERNESS_GAME_ID) {
  return String(gamesSettings.getGameById(gameId2)?.dx12LauncherPath || "").trim();
}
function getNevernessDx12WritableLoaderDir(paths = getNevernessDx12Paths()) {
  const configuredLoaderExe = paths.configuredLoaderExe || "";
  if (configuredLoaderExe) {
    if (!fs.existsSync(configuredLoaderExe)) {
      throw new Error(i18n.t("backend.games.nevernessLoader.configuredLoaderMissing"));
    }
    const configuredLoaderDir = path.dirname(configuredLoaderExe);
    if (systemFiles.canWriteDirectory(configuredLoaderDir)) {
      return {
        loaderDir: configuredLoaderDir,
        loaderExe: configuredLoaderExe,
        copied: false,
        custom: true
      };
    }
    const runtimeDir2 = path.join(electron.app.getPath("userData"), "dx12", "neverness-loader");
    systemFiles.copyDirectoryRecursive(configuredLoaderDir, runtimeDir2);
    return {
      loaderDir: runtimeDir2,
      loaderExe: path.join(runtimeDir2, path.basename(configuredLoaderExe)),
      copied: true,
      custom: true
    };
  }
  const bundledLoaderDir = getNevernessDx12BundledLoaderDir();
  if (!bundledLoaderDir || !fs.existsSync(path.join(bundledLoaderDir, NEVERNESS_DX12_LOADER_EXE_NAME))) {
    throw new Error(i18n.t("backend.games.nevernessLoader.bundledLoaderMissing"));
  }
  if (systemFiles.canWriteDirectory(bundledLoaderDir)) {
    return {
      loaderDir: bundledLoaderDir,
      loaderExe: path.join(bundledLoaderDir, NEVERNESS_DX12_LOADER_EXE_NAME),
      copied: false,
      custom: false
    };
  }
  const runtimeDir = path.join(electron.app.getPath("userData"), "dx12", "neverness-loader");
  systemFiles.copyDirectoryRecursive(bundledLoaderDir, runtimeDir);
  return {
    loaderDir: runtimeDir,
    loaderExe: path.join(runtimeDir, NEVERNESS_DX12_LOADER_EXE_NAME),
    copied: true,
    custom: false
  };
}
function writeNevernessDx12LoaderConfig(paths, loaderDir) {
  const launcherPath = paths.officialLauncherPath || gamesNevernessLaunch.getNevernessOfficialLauncherPathFromRoot(paths.gameRoot);
  if (!launcherPath || !fs.existsSync(launcherPath)) {
    throw new Error(i18n.t("backend.games.nevernessLoader.officialLauncherMissing"));
  }
  const configPath = path.join(loaderDir, "config.ini");
  const content = ["[Settings]", "Lang=CN", `Launcher=${launcherPath}`, "WindowW=500", "WindowH=430", "Target=HTGame.exe", "DllName=MyCustomLoader.dll", ""].join("\r\n");
  fs.writeFileSync(configPath, content, "utf-8");
  return {
    configPath,
    launcherPath
  };
}
function findNevernessDx12SigBypasserSource(loaderDir) {
  const loaderPluginPath = loaderDir ? path.join(loaderDir, "plugins", NEVERNESS_DX12_SIG_BYPASSER_PLUGIN_NAME) : "";
  if (loaderPluginPath && fs.existsSync(loaderPluginPath)) return loaderPluginPath;
  const bundledPluginPath = findNevernessDx12Resource(NEVERNESS_DX12_LOADER_DIR_NAME, "plugins", NEVERNESS_DX12_SIG_BYPASSER_PLUGIN_NAME);
  if (bundledPluginPath && fs.existsSync(bundledPluginPath)) return bundledPluginPath;
  const resourcePluginPath = findNevernessDx12Resource("plugins", NEVERNESS_DX12_SIG_BYPASSER_PLUGIN_NAME);
  if (resourcePluginPath && fs.existsSync(resourcePluginPath)) return resourcePluginPath;
  return null;
}
function ensureNevernessDx12SigBypasserPlugin(paths, loaderDir) {
  if (!paths?.win64Dir || !fs.existsSync(paths.win64Dir)) throw new Error(i18n.t("backend.games.nevernessLoader.win64DirectoryMissing"));
  const targetPluginsDir = path.join(paths.win64Dir, "plugins");
  const targetPath = path.join(targetPluginsDir, NEVERNESS_DX12_SIG_BYPASSER_PLUGIN_NAME);
  if (fs.existsSync(targetPath)) return {
    copied: false,
    targetPath
  };
  const sourcePath = findNevernessDx12SigBypasserSource(loaderDir);
  if (!sourcePath) throw new Error(i18n.t("backend.games.nevernessLoader.requiredPluginMissing", {
    detail: NEVERNESS_DX12_SIG_BYPASSER_PLUGIN_NAME
  }));
  try {
    fs.mkdirSync(targetPluginsDir, {
      recursive: true
    });
    fs.copyFileSync(sourcePath, targetPath);
  } catch (error) {
    throw new Error(i18n.t("backend.games.nevernessLoader.pluginWriteFailed", {
      windowsFileOperationError: systemWindows.formatWindowsFileOperationError(error, {
        path: targetPath,
        operation: "copy"
      })
    }));
  }
  return {
    copied: true,
    sourcePath,
    targetPath
  };
}
function inferNevernessGameRootFromPath(inputPath) {
  if (!inputPath) return null;
  const normalized = path.normalize(inputPath);
  const statPath = fs.existsSync(normalized) ? normalized : null;
  const basePath = statPath && fs.statSync(statPath).isFile() ? path.dirname(statPath) : normalized;
  const lower = normalized.toLowerCase();
  const candidates = [];
  const addCandidate = candidate => {
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
  if (lower.endsWith(`${path.sep.toLowerCase()}client${path.sep.toLowerCase()}windowsnoeditor${path.sep.toLowerCase()}ht${path.sep.toLowerCase()}binaries${path.sep.toLowerCase()}win64${path.sep.toLowerCase()}htgame.exe`)) {
    addCandidate(path.resolve(path.dirname(normalized), "..", "..", "..", "..", ".."));
  }
  addCandidate(basePath);
  addCandidate(path.dirname(basePath));
  addCandidate(path.dirname(path.dirname(basePath)));
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, "Client", "WindowsNoEditor", "HT", "Content", "Paks")) || fs.existsSync(path.join(candidate, "Client", "WindowsNoEditor", "HT", "Binaries", "Win64", "HTGame.exe"))) {
      return candidate;
    }
  }
  for (const candidate of candidates) {
    if (gamesNevernessLaunch.getNevernessOfficialLauncherPathFromRoot(candidate)) return candidate;
  }
  const launcherPath = path.join(basePath, "NTELauncher.exe");
  if (fs.existsSync(launcherPath)) return basePath;
  return candidates[0] || basePath;
}
function getNevernessGameRoot(gameId2 = NEVERNESS_GAME_ID) {
  const targetGame = gamesSettings.getGameById(gameId2);
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
    officialLauncherPath: gamesNevernessLaunch.getNevernessOfficialLauncherPathFromRoot(gameRoot),
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
    pakModsDirsExist: Object.fromEntries(Object.entries(paths.pakModsDirs || {}).map(([name, dirPath]) => [name, !!dirPath && fs.existsSync(dirPath)])),
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
  const baseDir = path.join(marketSettings.getQaqInstallDir(), NEVERNESS_DX12_LOADER_DIR_NAME);
  if (isReusableEmptyDirectory(baseDir)) return baseDir;
  for (let i = 1; i <= 999; i++) {
    const candidate = path.join(marketSettings.getQaqInstallDir(), `${NEVERNESS_DX12_LOADER_DIR_NAME} (${i})`);
    if (isReusableEmptyDirectory(candidate)) return candidate;
  }
  return path.join(marketSettings.getQaqInstallDir(), `${NEVERNESS_DX12_LOADER_DIR_NAME} ${Date.now()}`);
}
function reinstallNevernessDx12Loader() {
  const targetDir = resolveNevernessDx12ReinstallTargetDir();
  fs.mkdirSync(targetDir, {
    recursive: true
  });
  const loaderZip = findNevernessDx12Resource(`${NEVERNESS_DX12_LOADER_DIR_NAME}.zip`);
  if (loaderZip && fs.existsSync(loaderZip)) {
    const zip = new AdmZip(loaderZip);
    for (const entry of zip.getEntries()) {
      archivesZip.extractZipEntryWithCjkSupport(entry, targetDir);
    }
  } else {
    const bundledLoaderDir = getNevernessDx12BundledLoaderDir();
    if (!bundledLoaderDir || !fs.existsSync(bundledLoaderDir)) {
      throw new Error(i18n.t("backend.games.nevernessLoader.bundledPackageMissing"));
    }
    systemFiles.copyDirectoryRecursive(bundledLoaderDir, targetDir);
  }
  const loaderExe = findFileByNameRecursive(targetDir, NEVERNESS_DX12_LOADER_EXE_NAME);
  if (!loaderExe || !fs.existsSync(loaderExe)) {
    throw new Error(i18n.t("backend.games.nevernessLoader.reinstallExecutableMissing", {
      detail: NEVERNESS_DX12_LOADER_EXE_NAME
    }));
  }
  const game = (configStore.currentConfig.games || []).find(item => item.id === NEVERNESS_GAME_ID);
  if (game) {
    game.dx12LauncherPath = loaderExe;
    game.launchMode = "DX12";
  }
  configStore.currentConfig.nevernessModMode = "dx12";
  configStore.saveConfig(configStore.currentConfig);
  gamesSettings.notifyGamesChanged();
  return {
    ...getNevernessDx12Status(),
    success: true,
    loaderExe,
    loaderDir: path.dirname(loaderExe)
  };
}
function ensureNevernessDx12GamePaths(gameId2 = NEVERNESS_GAME_ID) {
  const paths = getNevernessDx12Paths(gameId2);
  if (!paths.gameRoot || !fs.existsSync(paths.gameRoot)) throw new Error(i18n.t("backend.games.nevernessLoader.gameRootMissing"));
  if (!paths.win64Dir || !fs.existsSync(paths.win64Dir)) throw new Error(i18n.t("backend.games.nevernessLoader.win64DirectoryMissing"));
  if (!paths.paksDir || !fs.existsSync(paths.paksDir)) throw new Error(i18n.t("backend.games.nevernessLoader.paksDirectoryMissing"));
  systemWindows.probeWritableDirectory(paths.pakModsDir, i18n.t("backend.validation.nevernessPakDirectory"));
  if (paths.disabledModsDir) systemWindows.probeWritableDirectory(paths.disabledModsDir, i18n.t("backend.validation.disabledModsDirectory"));
  return paths;
}
async function launchNevernessDx12Loader() {
  const paths = ensureNevernessDx12GamePaths();
  const {
    loaderDir,
    loaderExe,
    copied,
    custom
  } = getNevernessDx12WritableLoaderDir(paths);
  const config = writeNevernessDx12LoaderConfig(paths, loaderDir);
  const sigBypasserPlugin = ensureNevernessDx12SigBypasserPlugin(paths, loaderDir);
  setNevernessModMode("dx12");
  const result = await systemWindows.launchElevated(loaderExe, loaderDir, []);
  if (!result.success) {
    return {
      success: false,
      error: result.error || i18n.t("backend.games.nevernessLoader.elevationFailed")
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
function registerIpc() {
  electron.ipcMain.handle("neverness:dx12-status", async () => {
    try {
      return getNevernessDx12Status();
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("neverness:dx12-set-mode", async (_, mode) => {
    try {
      setNevernessModMode(mode);
      return getNevernessDx12Status();
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("neverness:dx12-launch-loader", async () => {
    try {
      return await launchNevernessDx12Loader();
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("neverness:dx12-reinstall-loader", async () => {
    try {
      return reinstallNevernessDx12Loader();
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("neverness:dx12-open-pak-folder", async () => {
    try {
      const paths = ensureNevernessDx12GamePaths();
      const openError = await electron.shell.openPath(paths.pakModsDir);
      if (openError) return {
        success: false,
        error: openError
      };
      return {
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("neverness:dx12-select-disabled-mods-dir", async () => {
    try {
      const paths = getNevernessDx12Paths();
      const result = await electron.dialog.showOpenDialog({
        title: i18n.t("backend.games.nevernessLoader.chooseDisabledModsFolder"),
        defaultPath: paths.disabledModsDir || getNevernessDx12DisabledModsDir(),
        properties: ["openDirectory", "createDirectory"],
        buttonLabel: i18n.t("backend.games.nevernessLoader.saveHere")
      });
      if (result.canceled || !result.filePaths?.[0]) return {
        ...getNevernessDx12Status(),
        canceled: true
      };
      const dirPath = result.filePaths[0];
      systemWindows.probeWritableDirectory(dirPath, i18n.t("backend.validation.disabledModsDirectory"));
      setNevernessDx12DisabledModsDir(dirPath);
      return getNevernessDx12Status();
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("neverness:dx12-reset-disabled-mods-dir", async () => {
    try {
      setNevernessDx12DisabledModsDir("");
      const paths = getNevernessDx12Paths();
      if (paths.disabledModsDir) systemWindows.probeWritableDirectory(paths.disabledModsDir, i18n.t("backend.validation.disabledModsDirectory"));
      return getNevernessDx12Status();
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  });
}
Object.assign(module.exports, {
  NEVERNESS_GAME_ID,
  NEVERNESS_DX12_META_FILE,
  NEVERNESS_DX12_PAK_EXTS,
  NEVERNESS_DX12_DEFAULT_PAK_DIR
});
