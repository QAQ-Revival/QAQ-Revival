const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { findActivityFlags, patchConfig, readSnapshot, createActivityTracker } = require('../app/src/main/overlay/activity-tracker.cjs');
const modIni = '[Constants]\nglobal $object_detected = 0\nglobal $mod_enabled = 0\n[Present]\npost $object_detected = 0\n[TextureOverrideBody]\nhash = 12345678\n$object_detected = 1\n';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qaqm-activity-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const d3dxPath = path.join(root, 'd3dx.ini');
  fs.writeFileSync(d3dxPath, '[Include]\ninclude_recursive = Mods\n[System]\nsettings_auto_save_interval = 60\nkeep_setting = 1\n');
  fs.writeFileSync(path.join(root, 'd3d11.dll'), Buffer.from('Local\\QAQR.Activity.v1.%u', 'utf16le'));
  return { root, d3dxPath };
}

test('requires a draw-time activity flag with a post-present reset', () => {
  assert.deepEqual(findActivityFlags(modIni), ['object_detected']);
  assert.deepEqual(findActivityFlags(modIni.replaceAll('object_detected', 'active0')), ['active0']);
  assert.deepEqual(findActivityFlags(modIni.replace('post $object_detected', '$object_detected')), []);
  assert.deepEqual(findActivityFlags(modIni.replace('$object_detected = 1', '; $object_detected = 1')), []);
  assert.deepEqual(findActivityFlags(modIni.replace('TextureOverrideBody', 'KeyToggle')), []);
  assert.deepEqual(findActivityFlags('[Constants]\nglobal $active = 1\nglobal persist $enabled = 1'), []);
});

test('bridge setup preserves Mod files, excludes disabled Mods and restores loader settings', async t => {
  const env = fixture(t);
  const char = path.join(env.root, 'Mods', '角色');
  for (const name of ['当前', 'DISABLED_停用']) {
    fs.mkdirSync(path.join(char, name), { recursive: true });
    fs.writeFileSync(path.join(char, name, 'mod.ini'), modIni);
  }
  const chars = [{ characterRootPath: char, displayName: '角色' }];
  const tracker = createActivityTracker();
  const state = await tracker.prepare(env, chars);
  assert.deepEqual(state.mods, [{ characterName: '角色', modName: '当前' }]);
  assert.equal(fs.readFileSync(path.join(char, '当前', 'mod.ini'), 'utf8'), modIni);
  const bridgePath = path.join(env.root, 'qaqm/qaqm_activity.ini');
  const bridge = fs.readFileSync(bridgePath, 'utf8');
  const observerDir = path.join(env.root, 'qaqm/activity_probes');
  const observer = fs.readFileSync(path.join(observerDir, fs.readdirSync(observerDir)[0]), 'utf8');
  assert.match(observer, /namespace = Mods\\角色\\当前\\mod.ini/);
  assert.ok(observer.includes('if ($object_detected > 0) && $mod_enabled > 0'));
  assert.ok(observer.includes('$\\QAQM\\Activity\\m0 = 1'));
  tracker.invalidate();
  assert.equal((await tracker.prepare(env, chars)).token, state.token, 'unchanged probes survive refresh without requiring another F10');
  assert.equal((await createActivityTracker().prepare(env, chars)).token, state.token, 'unchanged probes survive app restart');
  assert.equal(fs.readFileSync(bridgePath, 'utf8'), bridge);
  const config = fs.readFileSync(env.d3dxPath, 'utf8');
  assert.equal((config.match(/\[IncludeQAQMActivity\]/g) || []).length, 1);
  assert.match(config, /settings_auto_save_interval = 60\nkeep_setting = 1/);
  assert.doesNotMatch(bridge, /global persist|\$tick = time/);
  assert.equal(fs.existsSync(env.d3dxPath + '.qaqm-activity.bak'), false);
  await tracker.prepare(env, chars, false);
  assert.match(fs.readFileSync(env.d3dxPath, 'utf8'), /settings_auto_save_interval = 60/);
  assert.doesNotMatch(fs.readFileSync(env.d3dxPath, 'utf8'), /IncludeQAQMActivity/);
  assert.deepEqual(tracker.read(env).mods, []);
  fs.writeFileSync(env.d3dxPath, fs.readFileSync(env.d3dxPath, 'utf8').replace('interval = 60', 'interval = 30'));
  await tracker.prepare(env, chars, true);
  await tracker.prepare(env, chars, false);
  assert.match(fs.readFileSync(env.d3dxPath, 'utf8'), /settings_auto_save_interval = 30/, 'a user change while disabled becomes the new restore value');
});

test('snapshots need a matching bridge, an advancing game clock and fresh data', t => {
  const env = fixture(t);
  const state = { token: 123, preparedAt: 0, mods: [{ characterName: 'A', modName: 'M' }, { characterName: 'B', modName: 'N' }] };
  const now = Date.now();
  let sample;
  state.channel = { read: () => sample, close() {} };
  function save(tick, token = 123, a = 1, b = 0) {
    sample = { token, tick, flags: [a, b] };
  }
  save(1);
  assert.equal(readSnapshot(env, state, now).status, 'waiting');
  save(2);
  assert.deepEqual(readSnapshot(env, state, now + 1000).mods, [state.mods[0]]);
  save(3, 123, 0, 1);
  assert.deepEqual(readSnapshot(env, state, now + 2000).mods, [state.mods[1]]);
  assert.deepEqual(readSnapshot(env, state, now + 9000).mods, [], 'stale game snapshot expires');
  save(4, 999);
  assert.deepEqual(readSnapshot(env, state, now).mods, [], 'old bridge cannot map to new Mods');
  save(4, 123, 0, 0);
  const empty = readSnapshot(env, state, now + 11000);
  assert.equal(empty.status, 'live'); assert.deepEqual(empty.mods, []); assert.equal(empty.sampledAt, now + 11000);
  assert.equal(fs.existsSync(path.join(env.root, 'd3dx_user.ini')), false, 'telemetry never accesses the settings file');
});

test('activity never shortens the save interval and migration preserves later user changes', () => {
  assert.match(patchConfig('[System]\nfoo = 1\n', true), /IncludeQAQMActivity/);
  const changed = '[System]\nsettings_auto_save_interval = 30\n\n[IncludeQAQMActivity]\ninclude = qaqm\\qaqm_activity.ini\n\n[Other]\nvalue = 5\n';
  assert.equal(patchConfig(changed, false, '60'), '[System]\nsettings_auto_save_interval = 30\n\n[Other]\nvalue = 5\n');
});

test('legacy activity migrates once, unchanged probes cause no reads or writes, and stale observers are removed', async t => {
  const env = fixture(t), dir = path.join(env.root, 'Mods/Character/Mod');
  fs.mkdirSync(dir, { recursive: true });
  const mod = path.join(dir, 'mod.ini');
  fs.writeFileSync(mod, modIni);
  const bridgeDir = path.join(env.root, 'qaqm');
  fs.mkdirSync(path.join(bridgeDir, 'activity_probes'), { recursive: true });
  fs.writeFileSync(path.join(bridgeDir, 'qaqm_activity.json'), JSON.stringify({ enabled: true, previousInterval: '45' }));
  fs.writeFileSync(env.d3dxPath, '[System]\nsettings_auto_save_interval = 2\n[IncludeQAQMActivity]\ninclude = qaqm\\qaqm_activity.ini\n');
  const stale = path.join(bridgeDir, 'activity_probes/00000000000000000000.ini');
  fs.writeFileSync(stale, 'obsolete');
  const chars = [{ characterRootPath: path.dirname(dir), displayName: 'Character' }];
  const tracker = createActivityTracker();
  await tracker.prepare(env, chars);
  assert.match(fs.readFileSync(env.d3dxPath, 'utf8'), /interval = 45/);
  assert.equal(fs.existsSync(stale), false);
  let modReads = 0, writes = 0;
  const read = fs.promises.readFile, write = fs.promises.writeFile;
  fs.promises.readFile = async (file, ...args) => { if (file === mod) modReads++; return read.call(fs.promises, file, ...args); };
  fs.promises.writeFile = async (...args) => { writes++; return write.apply(fs.promises, args); };
  try { tracker.invalidate(); await tracker.prepare(env, chars); }
  finally { fs.promises.readFile = read; fs.promises.writeFile = write; }
  assert.equal(modReads, 0);
  assert.equal(writes, 0);
  fs.writeFileSync(path.join(env.root, 'd3d11.dll'), 'stock runtime');
  tracker.invalidate();
  await tracker.prepare(env, chars);
  assert.equal(tracker.read(env).status, 'unsupported');
  assert.doesNotMatch(fs.readFileSync(env.d3dxPath, 'utf8'), /IncludeQAQMActivity/);
  assert.match(fs.readFileSync(env.d3dxPath, 'utf8'), /interval = 45/);
});

test('native activity reader validates shared memory without opening the settings file', { skip: process.platform !== 'win32' }, t => {
  const token = 1 + require('node:crypto').randomInt(0xfffffe);
  const fixture = require('./activity-channel-fixture.cjs')(token, 2);
  const channel = require('../app/src/main/overlay/activity-channel.cjs').createActivityChannel();
  t.after(() => { channel.close(); fixture.close(); });
  fixture.write(1, [1, 0]);
  assert.deepEqual(channel.read(token, 2), { token, tick: 1, flags: [1, 0] });
  fixture.write(2, [0, 1], { incomplete: true });
  assert.equal(channel.read(token, 2), null);
  fixture.write(2, [0, 1], { wrongToken: true });
  assert.equal(channel.read(token, 2), null);
  fixture.write(3, [0, 1]);
  assert.deepEqual(channel.read(token, 2), { token, tick: 3, flags: [0, 1] });
  assert.equal(channel.read(token, 4097), null);
});
