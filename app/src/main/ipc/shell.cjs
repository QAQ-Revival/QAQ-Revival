"use strict";

const i18n = require("../../shared/i18n/core.cjs");
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const charactersDirectories = require("../characters/directories.cjs");
const charactersOrganization = require("../characters/organization.cjs");
const gamesNevernessLoader = require("../games/neverness/loader.cjs");
const gamesSettings = require("../games/settings.cjs");
const modsNevernessPaks = require("../games/neverness/paks.cjs");
function registerIpc() {
  electron.ipcMain.handle("open-path-in-explorer", async (_, targetPath) => {
    try {
      if (!targetPath) return {
        error: i18n.t("backend.ipc.shell.emptyPath")
      };
      if (fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) {
        electron.shell.showItemInFolder(targetPath);
      } else if (fs.existsSync(targetPath)) {
        const openError = await electron.shell.openPath(targetPath);
        if (openError) return {
          error: openError
        };
      } else {
        return {
          error: i18n.t("backend.ipc.shell.pathMissingPrefix") + targetPath
        };
      }
      return {
        success: true
      };
    } catch (error) {
      return {
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("open-external-url", async (_, url) => {
    try {
      await electron.shell.openExternal(url);
      return {
        success: true
      };
    } catch (error) {
      return {
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("open-character-folder", async (_, characterName) => {
    try {
      const gameId2 = gamesSettings.getActiveGameScopeId();
      const charPath = gamesNevernessLoader.isNevernessDx12Mode(gameId2) ? modsNevernessPaks.getNevernessDx12CharacterPath(characterName, {
        ensure: true
      }) : charactersDirectories.resolveCharacterPath(characterName, gameId2);
      if (charPath && fs.existsSync(charPath)) {
        const openError = await electron.shell.openPath(charPath);
        if (openError) {
          return {
            error: openError
          };
        }
        charactersDirectories.trackCharacterUsage(characterName, gameId2);
        return {
          success: true
        };
      }
      return {
        error: i18n.t("backend.ipc.shell.folderNotFound")
      };
    } catch (error) {
      return {
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("open-mod-folder", async (_, {
    characterName,
    modName
  }) => {
    try {
      const gameId2 = gamesSettings.getActiveGameScopeId();
      if (gamesNevernessLoader.isNevernessDx12Mode(gameId2)) {
        const charPath2 = modsNevernessPaks.getNevernessDx12CharacterPath(characterName, {
          ensure: true
        });
        if (!charPath2) return {
          error: i18n.t("backend.imports.local.characterFolderNotFound")
        };
        const paths = gamesNevernessLoader.getNevernessDx12Paths();
        const disabledCharPath = modsNevernessPaks.getNevernessDx12DisabledCharacterPath(characterName, paths);
        const candidates = [path.join(charPath2, modName), path.join(charPath2, `DISABLED_${modName}`), disabledCharPath ? path.join(disabledCharPath, modName) : "", disabledCharPath ? path.join(disabledCharPath, `DISABLED_${modName}`) : ""].filter(Boolean);
        const modPath2 = candidates.find(candidate => fs.existsSync(candidate));
        if (!modPath2) return {
          error: i18n.t("backend.ipc.mods.modFolderNotFound")
        };
        const openError = await electron.shell.openPath(modPath2);
        if (openError) return {
          error: openError
        };
        charactersDirectories.trackCharacterUsage(characterName, gameId2);
        return {
          success: true
        };
      }
      charactersOrganization.organizeLegacyCharacterFoldersIfNeeded(gameId2);
      const charPath = charactersDirectories.resolveCharacterPath(characterName, gameId2);
      if (!charPath) {
        return {
          error: i18n.t("backend.ipc.shell.folderNotFound")
        };
      }
      charactersDirectories.trackCharacterUsage(characterName, gameId2);
      let modPath = path.join(charPath, modName);
      if (!fs.existsSync(modPath)) {
        const disabledPath = path.join(charPath, `DISABLED_${modName}`);
        if (fs.existsSync(disabledPath)) {
          modPath = disabledPath;
        }
      }
      if (fs.existsSync(modPath)) {
        const openError = await electron.shell.openPath(modPath);
        if (openError) {
          return {
            error: openError
          };
        }
        return {
          success: true
        };
      }
      return {
        error: i18n.t("backend.ipc.shell.folderNotFound")
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
