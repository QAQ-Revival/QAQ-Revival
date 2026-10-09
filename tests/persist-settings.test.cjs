const test = require('node:test');
const assert = require('node:assert/strict');
const { migratePersistSettings } = require('../app/out/main/persist-settings.cjs');

test('migrate the legacy switch to every existing game without discarding tracking or overrides', () => {
  for (const enabled of [true, false]) {
    const config = { persistBridgeEnabled: enabled, persistBridgeCacheSize: 30, games: [{ id: 'a' }, { id: 'b' }],
      persistBridgeTracking: { existing: { recentStateFiles: ['saved.ini'] } }, persistBridgeByGame: { b: { enabled: !enabled } } };
    const tracking = JSON.stringify(config.persistBridgeTracking);
    assert.equal(migratePersistSettings(config), true);
    assert.equal(config.persistBridgeByGame.a.enabled, enabled);
    assert.equal(config.persistBridgeByGame.b.enabled, !enabled);
    assert.equal(JSON.stringify(config.persistBridgeTracking), tracking);
    assert.equal(migratePersistSettings(config), false);
    config.games.push({ id: 'new-game' });
    migratePersistSettings(config);
    assert.equal(config.persistBridgeByGame['new-game'].enabled, false);
  }
});
