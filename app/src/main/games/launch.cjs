"use strict";

const i18n = require("../../shared/i18n/core.cjs");
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const {
  launchRandomExecutable,
  getRandomLaunchSettings
} = require("../runtime/random-executable.cjs");
const {
  getDirectLaunchMode
} = require("../system/launch.cjs");
const configStore = require("../config/store.cjs");
const coreLogger = require("../core/logger.cjs");
const gamesGenshinServices = require("./genshin/service.cjs");
const gamesNevernessLaunch = require("./neverness/paths.cjs");
const gamesNevernessLoader = require("./neverness/loader.cjs");
const gamesSettings = require("./settings.cjs");
const { resolveOfficialLauncherPath } = require("./official-launcher.cjs");
const gamesWuwaServices = require("./wuwa/service.cjs");
const installAdvice = require("../install/advice.cjs");
const installPaths = require("../install/paths.cjs");
const overlayKeypress = require("../overlay/keypress.cjs");
const systemWindows = require("../system/windows.cjs");
let gameLaunchInProgress = false;
function registerIpc() {
  electron.ipcMain.handle("launch-game", async (_, {
    launchMode,
    gameId
  } = {}) => {
    if (gameLaunchInProgress) return {
      success: false,
      error: i18n.t("backend.games.launch.launchInProgress")
    };
    gameLaunchInProgress = true;
    let genshinPreparation = null,
      genshinLaunched = false;
    try {
      const activeGame = gamesSettings.getActiveGame();
      const {
        gamePath,
        modLoaderPath
      } = gamesSettings.getResolvedActiveGamePaths();
      if (gameId && gameId !== activeGame?.id) return {
        success: false,
        error: i18n.t("backend.games.launch.gameChanged")
      };
      if (launchMode === "OFFICIAL") {
        const launcherPath = resolveOfficialLauncherPath(activeGame, { gamePath });
        if (!launcherPath) return {
          success: false,
          error: i18n.t("backend.games.launch.officialLauncherMissing")
        };
        // Official launch never prepares injectors, hotkey bridges, random copies or Mod arguments.
        return await systemWindows.windowsLauncher.launch(launcherPath, path.dirname(launcherPath), [], { requireElevation: false });
      }
      const resolvedLaunchMode = launchMode === "DIRECT" || launchMode === void 0 && activeGame?.id === "wuthering-waves" && activeGame.wuwaDx12Enabled === true ? getDirectLaunchMode(activeGame) : launchMode === void 0 ? activeGame?.launchMode || "VANILLA" : launchMode || "VANILLA";
      if (!resolvedLaunchMode) return {
        success: false,
        error: i18n.t("backend.games.launch.quickLaunchUnsupported")
      };
      if (activeGame?.id === "genshin-impact" && resolvedLaunchMode === "GIMI" && activeGame.genshinPreflightEnabled === true) {
        const report = gamesGenshinServices.genshinDiagnostics.check({
          includeLogs: false
        });
        if (report.summary.errors) return {
          success: false,
          error: i18n.t("backend.games.launch.genshinPreflightFailed", {
            path: report.checks.filter(item => item.level === "error").slice(0, 3).map(item => item.title).join("、")
          })
        };
      }
      let genshinLaunchNotice = "";
      if (activeGame?.id === "genshin-impact" && resolvedLaunchMode === "GIMI") {
        const prepared = await gamesGenshinServices.genshinAntiCrash.prepareLaunch(activeGame.genshinAntiError, {
          randomLauncher: getRandomLaunchSettings(configStore.currentConfig).xxmi
        });
        if (prepared.prepared) {
          genshinPreparation = prepared;
          genshinLaunchNotice = prepared.notice || "";
        }
      }
      const customLaunchArgs = String(activeGame?.launchArgs || "").trim();
      if (activeGame?.id === "arknights") {
        if (resolvedLaunchMode !== "ARKNIGHTS") return { success: false, error: i18n.t("arknights.errors.launchMode") };
        return await require("./arknights/service.cjs").launch();
      }
      if (resolvedLaunchMode === "WWMI-DX12") {
        if (activeGame?.id !== "wuthering-waves") return {
          success: false,
          error: i18n.t("backend.games.launch.wuwaDx12Only")
        };
        return await gamesWuwaServices.wuwaDx12Service.launch(systemWindows.parseLaunchArgs(customLaunchArgs));
      }
      if (resolvedLaunchMode !== "DX12") await overlayKeypress.ensureKeypressBridgeForActiveGame();
      if (resolvedLaunchMode === "VANILLA") {
        if (!gamePath || !fs.existsSync(gamePath)) {
          return {
            error: i18n.t("backend.games.launch.gamePathNotSetOrInvalid")
          };
        }
        let vanillaGamePath = gamePath;
        if (activeGame?.id === "neverness-to-everness") {
          vanillaGamePath = gamesNevernessLaunch.normalizeNevernessLaunchPath(gamePath);
          if (vanillaGamePath !== gamePath) gamesSettings.updateActiveGameConfig({
            gamePath: vanillaGamePath
          });
          if (gamesNevernessLaunch.isNevernessProtectedClientExecutable(vanillaGamePath)) {
            return {
              error: i18n.t("backend.games.launch.nevernessInternalClient")
            };
          }
        }
        coreLogger.logger.info("Launching Game (Vanilla):", vanillaGamePath);
        systemWindows.launchWindowsExecutableViaStart(vanillaGamePath);
        return {
          success: true
        };
      }
      if ([...installPaths.BUNDLED_GAME_IMPORTERS, "XXMI"].includes(resolvedLaunchMode)) {
        if (resolvedLaunchMode !== "XXMI" && getDirectLaunchMode(activeGame) !== resolvedLaunchMode) {
          return {
            success: false,
            error: i18n.t("backend.games.launch.gameLaunchModeUnsupported", {
              name: activeGame?.name || i18n.t("backend.games.launch.unknownGame"),
              resolvedLaunchMode
            })
          };
        }
        if (resolvedLaunchMode === "XXMI" && activeGame?.id === "neverness-to-everness") {
          return {
            success: false,
            error: i18n.t("backend.games.launch.nevernessDirectLaunchRequired")
          };
        }
        if (!modLoaderPath || !fs.existsSync(modLoaderPath)) {
          return {
            success: false,
            error: installAdvice.buildMissingXxmiLauncherLaunchError(resolvedLaunchMode, modLoaderPath)
          };
        }
        const args = resolvedLaunchMode === "XXMI" ? [] : ["--nogui", "--xxmi", resolvedLaunchMode];
        args.push(...systemWindows.parseLaunchArgs(customLaunchArgs));
        coreLogger.logger.info("Launching Mod loader:", modLoaderPath, resolvedLaunchMode);
        const launchResult = await (genshinPreparation?.launcherPath ? systemWindows.launchElevated(genshinPreparation.launcherPath, path.dirname(modLoaderPath), args) : getRandomLaunchSettings(configStore.currentConfig).xxmi ? launchRandomExecutable(modLoaderPath, path.dirname(modLoaderPath), args, systemWindows.launchElevated) : systemWindows.launchElevated(modLoaderPath, path.dirname(modLoaderPath), args));
        if (launchResult?.success && genshinPreparation) {
          genshinLaunched = true;
          gamesGenshinServices.genshinAntiCrash.watchGameExit(genshinPreparation);
        }
        return launchResult?.success && genshinLaunchNotice ? {
          ...launchResult,
          notice: genshinLaunchNotice
        } : launchResult;
      }
      if (resolvedLaunchMode === "DX12") {
        if (activeGame?.id && activeGame.id !== "neverness-to-everness") {
          return {
            error: i18n.t("backend.games.launch.pakModeUnsupported")
          };
        }
        return await gamesNevernessLoader.launchNevernessDx12Loader();
      }
      if (resolvedLaunchMode === "NEMI") {
        if (activeGame?.id && activeGame.id !== "neverness-to-everness") {
          return {
            error: i18n.t("backend.games.launch.nemiModeUnsupported", {
              name: activeGame.name
            })
          };
        }
        if (!modLoaderPath || !fs.existsSync(modLoaderPath)) {
          return {
            error: i18n.t("backend.games.launch.nemiPathMissing")
          };
        }
        let launchGamePath = gamesNevernessLaunch.normalizeNevernessLaunchPath(gamePath);
        if (launchGamePath !== gamePath) gamesSettings.updateActiveGameConfig({
          gamePath: launchGamePath
        });
        if (gamesNevernessLaunch.isNevernessInnerGameExecutable(launchGamePath)) {
          const officialLaunchPath = gamesNevernessLaunch.resolveNevernessOfficialLaunchPath(launchGamePath);
          if (officialLaunchPath) {
            launchGamePath = officialLaunchPath;
            gamesSettings.updateActiveGameConfig({
              gamePath: officialLaunchPath
            });
          }
        }
        if (!launchGamePath || !fs.existsSync(launchGamePath)) {
          return {
            error: i18n.t("backend.games.launch.nevernessLauncherMissing")
          };
        }
        if (gamesNevernessLaunch.isNevernessProtectedClientExecutable(launchGamePath)) {
          return {
            error: i18n.t("backend.games.launch.nevernessInternalClient")
          };
        }
        let loaderExe = modLoaderPath;
        const loaderExt = path.extname(modLoaderPath).toLowerCase();
        if (loaderExt === ".cmd" || loaderExt === ".bat") {
          const sibling = path.join(path.dirname(modLoaderPath), "3DMigoto Loader.exe");
          if (!fs.existsSync(sibling)) {
            return {
              error: i18n.t("backend.games.launch.nemiLoaderMissing", {
                fileName: path.basename(modLoaderPath)
              })
            };
          }
          loaderExe = sibling;
        }
        const loaderDir = path.dirname(loaderExe);
        coreLogger.logger.info("[NEMI] Loader exe resolved:", loaderExe);
        const loaderAlreadyRunning = await systemWindows.isWindowsProcessRunning("3DMigoto Loader.exe");
        if (!loaderAlreadyRunning) {
          coreLogger.logger.info("[NEMI] Starting Loader with existing administrator privileges when available");
          const elevateResult = await systemWindows.launchElevated(loaderExe, loaderDir, []);
          if (!elevateResult.success) {
            return {
              error: i18n.t("backend.games.launch.nemiElevationFailed", {
                error: elevateResult.error || i18n.t("backend.games.launch.elevationCanceled")
              })
            };
          }
        } else {
          coreLogger.logger.info("[NEMI] Loader already running, skipping launch");
        }
        const loaderReady = await systemWindows.waitForWindowsProcess("3DMigoto Loader.exe", 6e4, 500);
        if (!loaderReady) {
          return {
            error: i18n.t("backend.games.launch.nemiStartTimedOut")
          };
        }
        coreLogger.logger.info("[NEMI] Loader ready, launching game:", launchGamePath);
        const gameArgs = gamesNevernessLaunch.getNevernessOfficialLaunchArgs(launchGamePath, customLaunchArgs);
        systemWindows.launchWindowsExecutableViaStart(launchGamePath, gameArgs);
        setImmediate(async () => {
          try {
            const gameStarted = await systemWindows.waitForWindowsProcess("HTGame.exe", 5 * 60 * 1e3, 1e3);
            if (gameStarted) {
              coreLogger.logger.info("[NEMI] HTGame.exe detected — DLL injection should occur shortly");
            } else {
              coreLogger.logger.warn("[NEMI] HTGame.exe not detected within 5 minutes — user may not have started the game in NTELauncher");
            }
          } catch (e) {
            coreLogger.logger.error("[NEMI] HTGame monitor error:", e);
          }
        });
        return {
          success: true
        };
      }
      return {
        error: i18n.t("backend.games.launch.unknownLaunchMode")
      };
    } catch (error) {
      coreLogger.logger.error("Launch error:", error);
      return {
        success: false,
        error: error.message
      };
    } finally {
      if (genshinPreparation && !genshinLaunched) {
        try {
          const result = await gamesGenshinServices.genshinAntiCrash.cleanup({
            force: false
          });
          if (!result.cleaned) coreLogger.logger.warn("[Genshin] Launch failed; recovery remains pending:", result.notes);
        } catch (error) {
          coreLogger.logger.warn("[Genshin] Launch failure cleanup failed:", error.message);
        }
      }
      gameLaunchInProgress = false;
    }
  });
}
module.exports = {
  registerIpc
};
