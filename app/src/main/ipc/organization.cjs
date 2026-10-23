"use strict";

const i18n = require("../../shared/i18n/core.cjs");
const electron = require("electron");
const charactersCleanup = require("../characters/cleanup.cjs");
const charactersDirectories = require("../characters/directories.cjs");
const charactersOrganization = require("../characters/organization.cjs");
const gamesSettings = require("../games/settings.cjs");
function registerIpc() {
  electron.ipcMain.handle("legacy-import:scan", async () => {
    try {
      const modsPathStatus = gamesSettings.getModsPathStatus();
      if (!modsPathStatus.ok) {
        return {
          success: false,
          error: modsPathStatus.error,
          code: modsPathStatus.code
        };
      }
      const {
        modsPath
      } = modsPathStatus;
      const gameId2 = gamesSettings.getActiveGameScopeId();
      return {
        success: true,
        modsPath,
        preview: charactersOrganization.previewOrganization(modsPath, gameId2)
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("legacy-import:migrate", async (_, options) => {
    try {
      const modsPathStatus = gamesSettings.getModsPathStatus();
      if (!modsPathStatus.ok) {
        return {
          success: false,
          error: modsPathStatus.error,
          code: modsPathStatus.code
        };
      }
      const {
        modsPath
      } = modsPathStatus;
      const gameId2 = gamesSettings.getActiveGameScopeId();
      const scanResult = charactersOrganization.scanImportCandidates(modsPath, gameId2);
      const token = charactersOrganization.organizationToken(scanResult, modsPath, gameId2);
      if (!options?.token || options.token !== charactersOrganization.organizationTokens.get(gameId2) || options.token !== token) {
        return {
          success: false,
          error: i18n.t("backend.ipc.organization.scanExpired")
        };
      }
      charactersOrganization.organizationTokens.delete(gameId2);
      if (!scanResult.hasCandidates) {
        return {
          success: true,
          summary: {
            migratedCategoryCount: 0,
            migratedModCount: 0,
            skippedConflicts: [],
            sourceRoots: []
          },
          preview: charactersOrganization.buildImportPreview(scanResult, modsPath)
        };
      }
      const summary = charactersOrganization.executeImportMovePlan(charactersOrganization.buildImportMovePlan(scanResult, modsPath, gameId2));
      charactersDirectories.CHARACTER_DIRECTORY_STATS_CACHE.clear();
      return {
        success: true,
        summary,
        preview: charactersDirectories.buildLegacyImportResponse(modsPath, gameId2)
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("mods-root:scan-loose-folders", async () => {
    try {
      const modsPathStatus = gamesSettings.getModsPathStatus();
      if (!modsPathStatus.ok) {
        return {
          success: false,
          error: modsPathStatus.error,
          code: modsPathStatus.code
        };
      }
      return charactersCleanup.scanLooseRootModFolders(modsPathStatus.modsPath, gamesSettings.getActiveGameScopeId());
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("mods-root:quarantine-loose-folders", async (_, options = {}) => {
    try {
      return charactersCleanup.quarantineLooseRootModFolders(gamesSettings.getActiveGameScopeId(), options || {});
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("mods-root:move-misplaced-folders", async (_, options = {}) => {
    try {
      return charactersCleanup.moveMisplacedModFolders(gamesSettings.getActiveGameScopeId(), options || {});
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  });
}
module.exports = {
  registerIpc
};
