"use strict";

const i18n = require("../../shared/i18n/core.cjs");
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const charactersDirectories = require("../characters/directories.cjs");
const charactersOrganization = require("../characters/organization.cjs");
const configStore = require("../config/store.cjs");
const desktopWindows = require("../desktop/windows.cjs");
const gamesDetection = require("../games/detection.cjs");
const gamesNevernessLaunch = require("../games/neverness/paths.cjs");
const gamesSettings = require("../games/settings.cjs");
const { isOfficialLauncherPath, resolveOfficialLauncherPath } = require("../games/official-launcher.cjs");
const installPaths = require("../install/paths.cjs");
const marketSources = require("../market/sources.cjs");
const dataPaths = require("../runtime/data-paths.cjs");
const systemPaths = require("../system/paths.cjs");
function registerIpc() {
  electron.ipcMain.handle("game:get-settings", async (_, gameId) => {
    try {
      const game = gamesSettings.getSettingsGame(gameId);
      const paths = gamesSettings.getResolvedGamePaths(game.id);
      require("../runtime/path-report.cjs").writeRuntimePathReport(electron.app, configStore.currentConfig, configStore.configPath);
      return {
        success: true,
        game: {
          ...gamesSettings.serializeGameForRenderer(game),
          modFolderPath: paths.modsPath,
          gamePath: paths.gamePath,
          officialLauncherPath: resolveOfficialLauncherPath(game, { gamePath: paths.gamePath }),
          modLoaderPath: paths.modLoaderPath
        },
        xxmiImporterInfo: gamesSettings.readXxmiImporterPathInfo(paths.modLoaderPath, game.id)
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("game:list", async () => {
    gamesSettings.ensureBuiltInGamesConfigured();
    return {
      success: true,
      games: (configStore.currentConfig.games || []).filter(game => game.hidden !== true).map(gamesSettings.serializeGameForRenderer),
      activeGameId: configStore.currentConfig.activeGameId
    };
  });
  electron.ipcMain.handle("game:add", async (_, game) => {
    try {
      if (!game.name || !game.name.trim()) return {
        error: i18n.t("backend.ipc.games.gameNameEmpty")
      };
      if (!game.modFolderPath) return {
        error: i18n.t("backend.ipc.games.modsPathEmpty")
      };
      const id = game.id || game.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const modsFolderResult = gamesSettings.resolveSelectedModsFolder(game.modFolderPath, {
        gameId: id
      });
      if (!modsFolderResult.ok) return {
        error: modsFolderResult.error
      };
      if (!configStore.currentConfig.games) configStore.currentConfig.games = [];
      if (configStore.currentConfig.games.find(g => g.id === id)) {
        return {
          error: i18n.t("backend.ipc.games.gameAlreadyExists")
        };
      }
      const newGame = gamesSettings.createBuiltInGameConfig({
        id,
        name: game.name.trim(),
        shortName: game.name.trim(),
        description: game.description || "",
        imageFile: game.icon || "",
        defaultLaunchMode: game.launchMode || "XXMI",
        marketGameId: game.marketGameId || id
      }, {
        id,
        name: game.name.trim(),
        shortName: game.shortName || game.name.trim(),
        description: game.description || "",
        gamePath: game.gamePath || "",
        officialLauncherPath: game.officialLauncherPath || "",
        modLoaderPath: game.modLoaderPath || "",
        modFolderPath: modsFolderResult.path,
        launchMode: game.launchMode || "XXMI",
        launchArgs: game.launchArgs || "",
        icon: game.icon || null,
        marketGameId: game.marketGameId || id,
        isBuiltIn: !!game.isBuiltIn
      });
      configStore.currentConfig.games.push(newGame);
      if (!configStore.currentConfig.activeGameId) {
        configStore.currentConfig.activeGameId = id;
      }
      configStore.saveConfig(configStore.currentConfig);
      gamesSettings.notifyGamesChanged();
      return {
        success: true,
        game: gamesSettings.serializeGameForRenderer(newGame)
      };
    } catch (error) {
      return {
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("game:update", async (_, {
    gameId: gameId2,
    updates
  }) => {
    try {
      if (!configStore.currentConfig.games) return {
        error: i18n.t("backend.ipc.games.gameConfigMissing")
      };
      const game = configStore.currentConfig.games.find(g => g.id === gameId2);
      if (!game) return {
        error: i18n.t("backend.ipc.characters.gameMissing")
      };
      let resolvedModFolderPath = null;
      if (updates.modFolderPath !== void 0) {
        if (!updates.modFolderPath) {
          resolvedModFolderPath = "";
        } else {
          const modsFolderResult = gamesSettings.resolveSelectedModsFolder(updates.modFolderPath, {
            gameId: gameId2
          });
          if (!modsFolderResult.ok) return {
            error: modsFolderResult.error
          };
          resolvedModFolderPath = modsFolderResult.path;
        }
      }
      if (updates.officialLauncherPath && !isOfficialLauncherPath(game, updates.officialLauncherPath)) return {
        success: false,
        error: i18n.t("backend.games.launch.officialLauncherInvalid")
      };
      if (game.id === "arknights") require("../games/arknights/service.cjs").validateLibrary(resolvedModFolderPath || game.modFolderPath, updates.gamePath || game.gamePath);
      if (updates.name !== void 0) game.name = updates.name.trim();
      if (updates.gamePath !== void 0) game.gamePath = updates.gamePath;
      if (updates.officialLauncherPath !== void 0) game.officialLauncherPath = updates.officialLauncherPath;
      if (updates.modLoaderPath !== void 0) game.modLoaderPath = updates.modLoaderPath;
      if (updates.dx12LauncherPath !== void 0) game.dx12LauncherPath = updates.dx12LauncherPath;
      if (updates.modFolderPath !== void 0) game.modFolderPath = resolvedModFolderPath;
      if (updates.launchMode !== void 0) game.launchMode = updates.launchMode;
      if (updates.launchArgs !== void 0) game.launchArgs = updates.launchArgs;
      if (updates.icon !== void 0) game.icon = updates.icon;
      configStore.saveConfig(configStore.currentConfig);
      gamesSettings.notifyGamesChanged();
      return {
        success: true,
        game: gamesSettings.serializeGameForRenderer(game)
      };
    } catch (error) {
      return {
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("game:delete", async (_, gameId2) => {
    try {
      if (!configStore.currentConfig.games) return {
        error: i18n.t("backend.ipc.games.gameConfigMissing")
      };
      const idx = configStore.currentConfig.games.findIndex(g => g.id === gameId2);
      if (idx === -1) return {
        error: i18n.t("backend.ipc.characters.gameMissing")
      };
      if (gamesSettings.getBuiltInGameDefinition(configStore.currentConfig.games[idx].id)) {
        return {
          error: i18n.t("backend.ipc.games.builtInGameCannotDelete")
        };
      }
      const nextVisible = configStore.currentConfig.games.find(game => game.id !== gameId2 && game.hidden !== true);
      if (configStore.currentConfig.activeGameId === gameId2 && !nextVisible) return {
        error: i18n.t("backend.ipc.games.keepVisibleGame")
      };
      configStore.currentConfig.games.splice(idx, 1);
      if (configStore.currentConfig.activeGameId === gameId2) {
        configStore.currentConfig.activeGameId = nextVisible.id;
      }
      configStore.saveConfig(configStore.currentConfig);
      gamesSettings.notifyGamesChanged();
      return {
        success: true
      };
    } catch (error) {
      return {
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("game:set-hidden", async (_, { gameId, hidden, nextGameId } = {}) => {
    try {
      const config = configStore.currentConfig;
      const game = config.games?.find(item => item.id === gameId);
      if (!game) throw new Error(i18n.t("backend.ipc.characters.gameMissing"));
      if (typeof hidden !== "boolean") throw new Error(i18n.t("backend.ipc.games.invalidVisibility"));
      const remaining = config.games.filter(item => item.id !== gameId && item.hidden !== true);
      if (hidden && !remaining.length) throw new Error(i18n.t("backend.ipc.games.keepVisibleGame"));
      const activeGameId = hidden && config.activeGameId === gameId
        ? (remaining.find(item => item.id === nextGameId) || remaining[0]).id
        : config.activeGameId;
      const next = {
        ...config,
        activeGameId,
        games: config.games.map(item => item.id === gameId ? { ...item, hidden } : item)
      };
      if (!configStore.saveConfig(next)) throw new Error(i18n.t("backend.ipc.settings.saveSettingsFailed"));
      configStore.currentConfig = next;
      gamesSettings.notifyGamesChanged();
      if (activeGameId !== config.activeGameId) marketSources.siteSessions.setGame(activeGameId).catch(() => {});
      return { success: true, activeGameId };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  electron.ipcMain.handle("game:switch", async (_, gameId2) => {
    try {
      if (!configStore.currentConfig.games) return {
        error: i18n.t("backend.ipc.games.gameConfigMissing")
      };
      const game = configStore.currentConfig.games.find(g => g.id === gameId2);
      if (!game) return {
        error: i18n.t("backend.ipc.characters.gameMissing")
      };
      if (game.hidden === true) return {
        success: false,
        error: i18n.t("backend.ipc.games.gameHidden")
      };
      configStore.currentConfig.activeGameId = gameId2;
      configStore.saveConfig(configStore.currentConfig);
      gamesSettings.notifyGamesChanged();
      marketSources.siteSessions.setGame(gameId2).catch(() => {});
      return {
        success: true,
        game: gamesSettings.serializeGameForRenderer(game)
      };
    } catch (error) {
      return {
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("game:select-folder", async (_, title, options = {}) => {
    try {
      const result = await electron.dialog.showOpenDialog({
        title: title || i18n.t("backend.install.setup.chooseFolder"),
        properties: ["openDirectory"],
        buttonLabel: i18n.t("backend.fixes.service.selectPrefix")
      });
      if (!result.canceled && result.filePaths.length > 0) {
        const selectedPath = result.filePaths[0];
        if (gamesSettings.shouldResolveFolderSelectionAsMods(title, options)) {
          const resolved = gamesSettings.resolveSelectedModsFolder(selectedPath, {
            gameId: options?.gameId
          });
          if (!resolved.ok) return {
            success: false,
            error: resolved.error,
            candidates: resolved.candidates || []
          };
          return {
            success: true,
            ...resolved,
            path: resolved.path
          };
        }
        return {
          success: true,
          path: selectedPath
        };
      }
      return {
        success: false,
        canceled: true
      };
    } catch (error) {
      return {
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("game:select-exe", async (_, title) => {
    try {
      const result = await electron.dialog.showOpenDialog({
        title: title || i18n.t("backend.ipc.games.chooseExecutable"),
        properties: ["openFile"],
        filters: [{
          name: "Executables",
          extensions: ["exe"]
        }],
        buttonLabel: i18n.t("backend.fixes.service.selectPrefix")
      });
      if (!result.canceled && result.filePaths.length > 0) {
        return {
          success: true,
          path: result.filePaths[0]
        };
      }
      return {
        success: false,
        canceled: true
      };
    } catch (error) {
      return {
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("select-file", async (_, options) => {
    try {
      const dialogOpts = {
        title: options?.title || i18n.t("backend.ipc.games.chooseFile"),
        properties: ["openFile"],
        buttonLabel: i18n.t("backend.fixes.service.selectPrefix")
      };
      if (options?.filters) {
        dialogOpts.filters = options.filters;
      }
      const result = await electron.dialog.showOpenDialog(dialogOpts);
      if (!result.canceled && result.filePaths.length > 0) {
        return {
          success: true,
          filePath: result.filePaths[0]
        };
      }
      return {
        success: false,
        canceled: true
      };
    } catch (error) {
      return {
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("select-mods-folder", async (_, gameId) => {
    try {
      const targetGame = gamesSettings.getSettingsGame(gameId);
      const result = await electron.dialog.showOpenDialog({
        title: i18n.t("backend.ipc.games.selectModsFolder"),
        properties: ["openDirectory"],
        buttonLabel: "Select"
      });
      if (!result.canceled && result.filePaths.length > 0) {
        const selectedPath = result.filePaths[0];
        const resolved = gamesSettings.resolveSelectedModsFolder(selectedPath, {
          gameId: targetGame.id
        });
        if (resolved.ok) {
          const modsPath = resolved.path;
          gamesSettings.updateActiveGameConfig({
            modFolderPath: modsPath
          }, targetGame.id);
          const gameId2 = targetGame.id;
          const scanResult = charactersOrganization.scanImportCandidates(modsPath, gameId2);
          let importSummary = {
            migratedCategoryCount: 0,
            migratedModCount: 0,
            skippedConflicts: [],
            sourceRoots: []
          };
          if (scanResult.hasCandidates) {
            const movePlan = charactersOrganization.buildImportMovePlan(scanResult, modsPath, gameId2);
            const previewTargets = Array.from(new Set(movePlan.moves.map(move => move.targetDisplayName))).slice(0, 8);
            const previewText = previewTargets.length > 0 ? i18n.t("backend.ipc.games.organizationTargets", {
              path: previewTargets.join("、")
            }) : "";
            const importPrompt = await electron.dialog.showMessageBox(desktopWindows.mainWindowRef, {
              type: "question",
              title: i18n.t("backend.ipc.games.legacyFoldersDetected"),
              message: i18n.t("backend.ipc.games.legacyFoldersPlan", {
                categoryCount: movePlan.categoryCount,
                modCount: movePlan.modCount
              }),
              detail: i18n.t("backend.ipc.games.legacyFoldersDetail", {
                previewText
              }),
              buttons: [i18n.t("backend.ipc.games.confirmOrganization"), i18n.t("backend.ipc.games.deferOrganization")],
              defaultId: 0,
              cancelId: 1,
              noLink: true
            });
            if (importPrompt.response === 0) {
              importSummary = charactersOrganization.executeImportMovePlan(movePlan);
              charactersDirectories.ensureDefaultCharacterFolders(modsPath, gameId2);
            } else {
              importSummary = {
                ...importSummary,
                sourceRoots: scanResult.sourceRoots,
                deferred: true
              };
            }
          } else {
            charactersDirectories.ensureDefaultCharacterFolders(modsPath, gameId2);
          }
          return {
            success: true,
            ...resolved,
            path: modsPath,
            importSummary
          };
        }
        return {
          success: false,
          error: resolved.error,
          candidates: resolved.candidates || []
        };
      }
      return {
        success: false,
        canceled: true
      };
    } catch (error) {
      return {
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("select-game-path", async (_, gameId) => {
    try {
      const activeGame = gamesSettings.getSettingsGame(gameId);
      const result = await electron.dialog.showOpenDialog({
        title: i18n.t("backend.ipc.games.selectGameExecutable", {
          executableHint: activeGame?.executableHint || "Game.exe"
        }),
        properties: ["openFile"],
        filters: [{
          name: "Executables",
          extensions: ["exe"]
        }],
        buttonLabel: "Select"
      });
      if (!result.canceled && result.filePaths.length > 0) {
        let selectedPath = result.filePaths[0];
        if (activeGame?.id === "neverness-to-everness" && gamesNevernessLaunch.isNevernessProtectedClientExecutable(selectedPath)) {
          const officialLaunchPath = gamesNevernessLaunch.resolveNevernessOfficialLaunchPath(selectedPath);
          if (!officialLaunchPath) {
            return {
              error: i18n.t("backend.install.setup.nevernessInternalClientSelected")
            };
          }
          selectedPath = officialLaunchPath;
        }
        gamesSettings.updateActiveGameConfig({
          gamePath: selectedPath
        }, activeGame.id);
        return {
          success: true,
          path: selectedPath
        };
      }
      return {
        success: false,
        canceled: true
      };
    } catch (error) {
      return {
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("select-official-launcher-path", async (_, gameId) => {
    try {
      const game = gamesSettings.getSettingsGame(gameId);
      const result = await electron.dialog.showOpenDialog({
        title: i18n.t("backend.ipc.games.selectOfficialLauncher"),
        properties: ["openFile"],
        filters: [{ name: "Executables", extensions: ["exe"] }],
        defaultPath: resolveOfficialLauncherPath(game) || undefined
      });
      if (result.canceled || !result.filePaths.length) return { success: false, canceled: true };
      const selectedPath = result.filePaths[0];
      if (!isOfficialLauncherPath(game, selectedPath)) return {
        success: false,
        error: i18n.t("backend.games.launch.officialLauncherInvalid")
      };
      gamesSettings.updateActiveGameConfig({ officialLauncherPath: selectedPath }, game.id);
      return { success: true, path: selectedPath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  electron.ipcMain.handle("select-loader-path", async () => {
    try {
      const activeGame = gamesSettings.getActiveGame();
      const result = await electron.dialog.showOpenDialog({
        title: i18n.t("backend.ipc.games.selectExecutable", {
          modLoaderLabel: activeGame?.modLoaderLabel || "Loader"
        }),
        properties: ["openFile"],
        filters: [{
          name: "Executables",
          extensions: ["exe"]
        }],
        buttonLabel: "Select"
      });
      if (!result.canceled && result.filePaths.length > 0) {
        const selectedPath = result.filePaths[0];
        gamesSettings.updateActiveGameConfig({
          modLoaderPath: selectedPath
        });
        return {
          success: true,
          path: selectedPath
        };
      }
      return {
        success: false,
        canceled: true
      };
    } catch (error) {
      return {
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("auto-detect-paths", async (_, gameId) => {
    try {
      const activeGame = gamesSettings.getSettingsGame(gameId);
      const gameId2 = activeGame?.id || "endfield";
      if (gameId2 === "arknights") {
        const candidates = ["C", "D", "E", "F", "G"].flatMap(drive => ["Arknights", "Arknights Game"].map(folder => path.join(`${drive}:\\`, "Hypergryph Launcher", "games", folder, "Arknights.exe")));
        if (!activeGame.gamePath || !fs.existsSync(activeGame.gamePath)) {
          const found = candidates.find(file => fs.existsSync(file));
          if (found) gamesSettings.updateActiveGameConfig({ gamePath: found }, gameId2);
        }
        require("../games/arknights/service.cjs").initialize();
        return { success: true, config: gamesSettings.buildRendererConfig() };
      }
      const xxmiCandidates = [];
      for (const drive of ["C", "D", "E", "F", "G"]) {
        xxmiCandidates.push(`${drive}:\\XXMI\\Resources\\Bin\\XXMI Launcher.exe`);
        xxmiCandidates.push(`${drive}:\\mod\\xxmi\\Resources\\Bin\\XXMI Launcher.exe`);
        xxmiCandidates.push(`${drive}:\\XXMI Launcher\\Resources\\Bin\\XXMI Launcher.exe`);
      }
      const gameDetection = {
        "genshin-impact": {
          gameExeCandidates: gamesDetection.buildGenshinGamePathCandidates(),
          loaderCandidates: gamesDetection.getGenshinLauncherCandidates()
        },
        endfield: {
          gameExeCandidates: (() => {
            const candidates = [];
            const regPath = gamesDetection.readRegistryValue("HKCU\\SOFTWARE\\Hypergryph\\Launcher", "InstallPath");
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
            const regInstall = gamesDetection.readRegistryValue("HKCU\\SOFTWARE\\miHoYo\\HYP\\1_1\\nap_cn", "GameInstallPath");
            if (regInstall) candidates.push(path.join(regInstall, "ZenlessZoneZero.exe"));
            for (const drive of ["G", "C", "D", "E", "F"]) {
              candidates.push(`${drive}:\\miHoYo Launcher\\games\\ZenlessZoneZero Game\\ZenlessZoneZero.exe`);
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
              candidates.push(`${drive}:\\Kuro Games\\Wuthering Waves\\Wuthering Waves Game\\Wuthering Waves.exe`);
              candidates.push(`${drive}:\\KRInstall\\Wuthering Waves\\Wuthering Waves Game\\Wuthering Waves.exe`);
            }
            return candidates;
          })()
        },
        "neverness-to-everness": {
          gameExeCandidates: gamesNevernessLaunch.buildNevernessGamePathCandidates(),
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
          gameExeCandidates: gamesDetection.buildHonkaiStarRailGamePathCandidates()
        }
      };
      const detection = gameDetection[gameId2];
      if (!detection) {
        return {
          success: true,
          config: gamesSettings.buildRendererConfig(),
          message: i18n.t("backend.ipc.games.gameDetectionUnsupported", {
            name: activeGame?.name || gameId2
          })
        };
      }
      let updatedFields = [];
      if (!activeGame?.gamePath || !fs.existsSync(activeGame.gamePath) || gameId2 === "neverness-to-everness" && gamesNevernessLaunch.isNevernessProtectedClientExecutable(activeGame.gamePath)) {
        for (const p of detection.gameExeCandidates) {
          if (p && fs.existsSync(p)) {
            const detectedGamePath = gameId2 === "neverness-to-everness" ? gamesNevernessLaunch.resolveNevernessDetectedGamePath(p) : p;
            if (!detectedGamePath) continue;
            gamesSettings.updateActiveGameConfig({
              gamePath: detectedGamePath
            }, activeGame.id);
            updatedFields.push(i18n.t("backend.games.pathWarning.gamePathLabel"));
            break;
          }
        }
      }
      if (!activeGame?.modLoaderPath || !fs.existsSync(activeGame.modLoaderPath)) {
        const loaderCandidates = detection.loaderCandidates || xxmiCandidates;
        for (const p of loaderCandidates) {
          if (p && fs.existsSync(p)) {
            gamesSettings.updateActiveGameConfig({
              modLoaderPath: p
            }, activeGame.id);
            updatedFields.push(i18n.t("backend.paths.loader"));
            break;
          }
        }
      }
      const importer = dataPaths.IMPORTERS[gameId2];
      if (importer && (!activeGame.modFolderPath || !gamesSettings.isExistingDirectory(activeGame.modFolderPath) || dataPaths.isUnusedDefaultModsPath(activeGame.modFolderPath, gameId2))) {
        const info = gamesSettings.readXxmiImporterPathInfo(activeGame.modLoaderPath, gameId2);
        const root = installPaths.resolveXxmiRootFromLauncherPath(activeGame.modLoaderPath);
        const importerPath = info.importerPath || (root ? path.join(root, importer) : "");
        const modsPath = importerPath ? path.join(importerPath, "Mods") : "";
        if (activeGame.modLoaderPath && gamesSettings.isExistingDirectory(modsPath) && !systemPaths.isSameResolvedPath(activeGame.modFolderPath, modsPath)) {
          gamesSettings.updateActiveGameConfig({
            modFolderPath: modsPath
          }, activeGame.id);
          charactersDirectories.ensureDefaultCharacterFolders(modsPath, gameId2);
          updatedFields.push(i18n.t("backend.paths.mods"));
        }
      }
      const message = updatedFields.length > 0 ? i18n.t("backend.ipc.games.pathsDetected", {
        path: updatedFields.join("、")
      }) : i18n.t("backend.ipc.games.pathsNotDetected");
      return {
        success: true,
        config: gamesSettings.buildRendererConfig(),
        message
      };
    } catch (error) {
      return {
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("select-efmi-path", async () => {
    try {
      const result = await electron.dialog.showOpenDialog({
        title: i18n.t("backend.ipc.games.selectEFMIQuickStartExe"),
        properties: ["openFile"],
        filters: [{
          name: "Executables",
          extensions: ["exe"]
        }],
        buttonLabel: "Select"
      });
      if (!result.canceled && result.filePaths.length > 0) {
        const selectedPath = result.filePaths[0];
        gamesSettings.updateActiveGameConfig({
          modLoaderPath: selectedPath
        });
        return {
          success: true,
          path: selectedPath
        };
      }
      return {
        success: false,
        canceled: true
      };
    } catch (error) {
      return {
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("select-xxmi-path", async (_, gameId) => {
    try {
      const activeGame = gamesSettings.getSettingsGame(gameId);
      const isNevernessToEverness = activeGame?.id === "neverness-to-everness";
      const result = await electron.dialog.showOpenDialog({
        title: isNevernessToEverness ? i18n.t("backend.ipc.games.selectNEMIStartCmdOr3DMigotoLoaderExe") : i18n.t("backend.ipc.games.selectXXMILauncherExe"),
        properties: ["openFile"],
        filters: isNevernessToEverness ? [{
          name: i18n.t("backend.ipc.games.nEMILoader"),
          extensions: ["cmd", "bat", "exe"]
        }] : [{
          name: "Executables",
          extensions: ["exe"]
        }],
        buttonLabel: "Select"
      });
      if (!result.canceled && result.filePaths.length > 0) {
        const selectedPath = result.filePaths[0];
        gamesSettings.updateActiveGameConfig({
          modLoaderPath: selectedPath
        }, activeGame.id);
        return {
          success: true,
          path: selectedPath
        };
      }
      return {
        success: false,
        canceled: true
      };
    } catch (error) {
      return {
        error: error.message
      };
    }
  });
}
module.exports = {
  registerIpc
};
