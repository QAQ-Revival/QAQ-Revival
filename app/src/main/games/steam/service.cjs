"use strict";

const electron = require("electron");
const path = require("path");
const desktopWindows = require("../../desktop/windows.cjs");
const gamesSettings = require("../settings.cjs");
const runtimePaths = require("../../runtime/paths.cjs");
let steamBridgeService;
function registerIpc() {
  steamBridgeService = require("./bridge.cjs").registerSteamBridgeIpc({
    ipcMain: electron.ipcMain,
    dialog: electron.dialog,
    shell: electron.shell,
    getWindow: () => desktopWindows.mainWindowRef,
    userData: electron.app.getPath("userData"),
    managerExecutable: path.join(path.dirname(process.execPath), "QAQ-Revival.exe"),
    executable: path.resolve(runtimePaths.mainDir, "../../resources/steam-bridge/steam-bridge.exe"),
    getGame: gameId => ({
      ...gamesSettings.getSettingsGame(gameId),
      gamePath: gamesSettings.getResolvedGamePaths(gameId).gamePath
    })
  });
  electron.app.on("will-quit", () => steamBridgeService.dispose());
}
module.exports = {
  registerIpc
};
