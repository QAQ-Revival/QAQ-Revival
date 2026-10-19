const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createSteamBridgeService, createNativeClient, validateOptions } = require('../app/out/main/steam-bridge.cjs');
function host(extra = {}) {
  return createSteamBridgeService({ userData: 'D:/fixture/profile', managerExecutable: 'D:/fixture/QAQ-Revival.exe', executable: 'D:/fixture/steam-bridge.exe',
    getGame: id => ({ gamePath: `D:/fixture/${id}/game.exe` }), confirm: async () => true, ...extra });
}
test('cancellation and invalid options cannot modify Steam; double submissions are excluded', async () => {
  const requests = []; let resolveConfirm;
  const service = host({ confirm: () => new Promise(resolve => { resolveConfirm = resolve; }), runNative: async request => { requests.push(request); return { success: true }; } });
  assert.throws(() => validateOptions({ command: 'unexpected' }), /无效/);
  assert.throws(() => validateOptions({ autoSync: 'true' }), /无效/);
  const pending = service.apply({ gameId: 'endfield' });
  await assert.rejects(service.restore({ gameId: 'endfield' }), /重复/);
  assert.equal(await service.autoSync(), null);
  resolveConfirm(false); assert.equal((await pending).canceled, true); assert.equal(requests.length, 0);
});
test('batch settings use current game draft and preserve the other game saved mode', async () => {
  const requests = [], service = host({ runNative: async request => { requests.push(request); return { success: true }; } });
  await service.apply({ gameId: 'endfield', all: true, options: { launchMethod: 'qaqr', channelId: 'bilibili', qaqrSteamManaged: true, autoSync: true } });
  const [endfield, wuwa] = requests[0].Games;
  assert.equal(endfield.GameId, 'endfield'); assert.equal(endfield.ChannelId, 'bilibili'); assert.equal(endfield.AutoSync, true);
  assert.equal(wuwa.LaunchMethod, null); assert.equal(wuwa.QaqrSteamManaged, null);
  assert.equal(endfield.QaqrPath, 'D:/fixture/QAQ-Revival.exe');
  await service.restore({ gameId: 'wuthering-waves' });
  assert.deepEqual(requests[1], { Action: 'restore', Games: [{ GameId: 'wuthering-waves' }] });
});
test('automatic sync only requests existing saved configurations and avoids restart loops', async () => {
  const requests = [], service = host({ confirm: async () => { throw Error('background must not open a dialog'); }, runNative: async request => { requests.push(request); return { success: true, changed: true }; } });
  await service.autoSync(); await service.autoSync();
  assert.deepEqual(requests, [{ Action: 'auto-sync', Games: [{ GameId: 'endfield', QaqrUserData: 'D:/fixture/profile' }, { GameId: 'wuthering-waves', QaqrUserData: 'D:/fixture/profile' }] }]);
});
test('real bundled native JSON transport rejects unsupported requests before accessing Steam', async () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'qaqr-steam-bridge-test-'));
  try {
    const execute = createNativeClient({ executable: path.resolve(__dirname, '../app/resources/steam-bridge/steam-bridge.exe'), userData: temporary });
    const result = await execute({ Action: 'apply', Games: [{ GameId: 'unsupported' }] });
    assert.equal(result.success, false); assert.match(result.error, /请求无效/);
    assert.deepEqual(fs.readdirSync(path.join(temporary, 'steam-bridge-requests')), []);
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
});
