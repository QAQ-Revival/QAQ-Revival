const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { EventEmitter } = require('node:events');

const main = path.resolve(__dirname, '../app/src/main');
const results = path.resolve(__dirname, '../test-results');
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
const fixtureMod = { id: 'fixture', name: 'Fixture', characterName: '安可', gameId: 'wuthering-waves', downloadUrl: 'https://market.test/mod.zip' };
const accepted = { success: true, mods: [fixtureMod], syncTimestamp: '2026-10-30T00:00:00.000Z', version: 'v1' };

let market;
let cleanup = () => {};

test.before(() => {
  fs.mkdirSync(results, { recursive: true });
  const profile = fs.mkdtempSync(path.join(results, 'market-catalog-'));
  const previousDataDir = process.env.QAQR_DATA_DIR;
  process.env.QAQR_DATA_DIR = path.join(profile, 'data');
  const handlers = new Map();
  let respond = () => { throw Error('No network response configured'); };
  const route = address => respond(new URL(address).pathname);
  const electron = {
    app: Object.assign(new EventEmitter(), { getPath: () => profile, getAppPath: () => profile, getVersion: () => '1.0.0', isPackaged: false }),
    ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) },
    net: { fetch: route },
    BrowserWindow: { getAllWindows: () => [] },
    shell: {}, dialog: {}, session: {}, screen: {}
  };
  const originalLoad = Module._load, originalFetch = global.fetch;
  Module._load = function (name, parent, isMain) {
    if (name === 'electron') return electron;
    if (name === '@electron-toolkit/utils') return { is: { dev: false } };
    return originalLoad.call(this, name, parent, isMain);
  };
  global.fetch = route;
  cleanup = () => {
    Module._load = originalLoad;
    global.fetch = originalFetch;
    if (previousDataDir === undefined) delete process.env.QAQR_DATA_DIR;
    else process.env.QAQR_DATA_DIR = previousDataDir;
    fs.rmSync(profile, { recursive: true, force: true });
  };
  const configStore = require(path.join(main, 'config/store.cjs'));
  configStore.initialize();
  configStore.currentConfig.serverUrl = 'https://market.test';
  require(path.join(main, 'market/catalog.cjs')).registerIpc();
  market = {
    sync: (options = {}) => handlers.get('sync-mod-market')({}, { serverUrl: 'https://market.test', gameId: 'wuthering-waves', ...options }),
    poll: () => handlers.get('market:poll')({}, {}),
    respondWith: handler => { respond = handler; }
  };
});
test.after(() => cleanup());

test('market sync and polling apply the server response instead of failing on it', async () => {
  market.respondWith(() => json(accepted));

  const synced = await market.sync();
  assert.equal(synced.error, undefined);
  assert.equal(synced.success, true);
  assert.deepEqual(synced.mods.map(mod => mod.id), ['fixture']);

  const polled = await market.poll();
  assert.equal(polled.error, undefined);
  assert.equal(polled.success, true);
  assert.deepEqual(polled.mods.map(mod => mod.id), ['fixture']);

  // An empty answer must not wipe a good snapshot.
  market.respondWith(() => json({ success: true, mods: [] }));
  const empty = await market.sync({ forceFullSync: true });
  assert.equal(empty.ignoredEmpty, true);
  assert.deepEqual(empty.mods.map(mod => mod.id), ['fixture']);
});

test('a denied market response hides the snapshot and reports why', async () => {
  market.respondWith(() => json(accepted));
  assert.equal((await market.sync({ forceFullSync: true })).success, true);

  market.respondWith(() => json({ success: false, code: 'LOGIN_REQUIRED' }, 401));
  const denied = await market.sync({ forceFullSync: true });
  assert.equal(denied.refreshBlocked, true);
  assert.deepEqual(denied.mods, []);
  assert.equal(denied.marketAccess.code, 'LOGIN_REQUIRED');

  const polled = await market.poll();
  assert.equal(polled.refreshBlocked, true);
  assert.deepEqual(polled.mods, []);
  assert.equal(polled.marketAccess.code, 'LOGIN_REQUIRED');
});
