"use strict";

const i18n = require("../../shared/i18n/core.cjs");
module.exports = {
  initialize,
  isCharacterHidden,
  assertCharacterVisible,
  get hiddenCharacters() {
    return hiddenCharacters;
  }
};
const {
  createHiddenCharactersStore
} = require("./hidden-store.cjs");
const charactersCatalog = require("./catalog.cjs");
const configStore = require("../config/store.cjs");
const gamesSettings = require("../games/settings.cjs");
let hiddenCharacters;
function isCharacterHidden(name, gameId = gamesSettings.getActiveGameScopeId()) {
  return hiddenCharacters.has(gameId, charactersCatalog.getCharacterMappingEntry(name, gameId)?.displayName || name);
}
function assertCharacterVisible(name, gameId = gamesSettings.getActiveGameScopeId()) {
  if (isCharacterHidden(name, gameId)) throw new Error(i18n.t("backend.characters.hidden.characterHidden"));
}
function initialize() {
  hiddenCharacters = createHiddenCharactersStore({
    read: () => configStore.currentConfig.hiddenCharactersByGame,
    write: next => {
      const previous = configStore.currentConfig.hiddenCharactersByGame;
      configStore.currentConfig.hiddenCharactersByGame = next;
      if (!configStore.saveConfig(configStore.currentConfig)) {
        configStore.currentConfig.hiddenCharactersByGame = previous;
        throw new Error(i18n.t("backend.characters.hidden.saveHiddenFailed"));
      }
    },
    normalize: charactersCatalog.normalizeCharacterFolderKey
  });
}
