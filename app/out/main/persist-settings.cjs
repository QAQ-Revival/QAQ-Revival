// The old switch applied to every game. Copy it once; newly added games start off.
function migratePersistSettings(config) {
  let changed = false;
  if (!config.persistBridgeByGame || typeof config.persistBridgeByGame !== 'object' || Array.isArray(config.persistBridgeByGame)) {
    config.persistBridgeByGame = {};
    changed = true;
  }
  const legacyEnabled = config.persistBridgeSettingsVersion !== 1 && config.persistBridgeEnabled === true;
  for (const game of config.games || []) {
    if (typeof config.persistBridgeByGame[game.id]?.enabled !== 'boolean') {
      Object.defineProperty(config.persistBridgeByGame, game.id, { value: { enabled: legacyEnabled }, writable: true, enumerable: true, configurable: true });
      changed = true;
    }
  }
  if (config.persistBridgeSettingsVersion !== 1) {
    config.persistBridgeSettingsVersion = 1;
    changed = true;
  }
  return changed;
}

module.exports = { migratePersistSettings };
