"use strict";

module.exports = {
  prepareOverlayActivity
};
const charactersDirectories = require("../characters/directories.cjs");
const charactersHidden = require("../characters/hidden.cjs");
const configStore = require("../config/store.cjs");
const coreLogger = require("../core/logger.cjs");
const gamesEnvironment = require("../games/environment.cjs");
const gamesNevernessLoader = require("../games/neverness/loader.cjs");
const gamesSettings = require("../games/settings.cjs");
const overlayActivity = require("./activity-tracker.cjs").createActivityTracker();
async function prepareOverlayActivity() {
  const gameId = gamesSettings.getActiveGameScopeId();
  const env = gamesEnvironment.resolveActiveGameEnvRoot(gameId);
  if (!env || gamesNevernessLoader.isNevernessDx12Mode(gameId)) return;
  try {
    await overlayActivity.prepare(env, charactersDirectories.listCharacterDirectories(gamesSettings.getModsPath(gameId), gameId).filter(entry => !charactersHidden.isCharacterHidden(entry.displayName, gameId)), configStore.currentConfig.overlayActivityEnabled !== false);
  } catch (error) {
    coreLogger.logger.warn('Could not prepare overlay activity detection:', error.message);
  }
}
Object.assign(module.exports, {
  overlayActivity
});
