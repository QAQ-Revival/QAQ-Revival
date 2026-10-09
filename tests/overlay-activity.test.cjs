const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { findActivityFlags, patchConfig, readSnapshot, createActivityTracker } = require('../app/out/main/overlay-activity.cjs');
const modIni = '[Constants]\nglobal $object_detected = 0\nglobal $mod_enabled = 0\n[Present]\npost $object_detected = 0\n[TextureOverrideBody]\nhash = 12345678\n$object_detected = 1\n';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qaqm-activity-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const d3dxPath = path.join(root, 'd3dx.ini');
  fs.writeFileSync(d3dxPath, '[Include]\ninclude_recursive = Mods\n[System]\nsettings_auto_save_interval = 60\nkeep_setting = 1\n');
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
  assert.match(config, /settings_auto_save_interval = 2\nkeep_setting = 1/);
  assert.ok(fs.existsSync(env.d3dxPath + '.qaqm-activity.bak'));
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
  function save(tick, token = 123, a = 1, b = 0) {
    const file = path.join(env.root, 'd3dx_user.ini');
    fs.writeFileSync(file, `[Constants]\n$\\qaqm\\activity\\token = ${token}\n$\\qaqm\\activity\\tick = ${tick}\n$\\qaqm\\activity\\m0 = ${a}\n$\\qaqm\\activity\\m1 = ${b}\n`);
    fs.utimesSync(file, new Date(now), new Date(now));
  }
  save(1);
  assert.equal(readSnapshot(env, state, now).status, 'waiting');
  save(2);
  assert.deepEqual(readSnapshot(env, state, now + 1000).mods, [state.mods[0]]);
  save(3, 123, 0, 1);
  assert.deepEqual(readSnapshot(env, state, now + 2000).mods, [state.mods[1]]);
  assert.deepEqual(readSnapshot(env, state, now + 8000).mods, [], 'stale game snapshot expires');
  save(4, 999);
  assert.deepEqual(readSnapshot(env, state, now).mods, [], 'old bridge cannot map to new Mods');
  save(4, 123, 0, 0);
  const empty = readSnapshot(env, state, now + 3000);
  assert.equal(empty.status, 'live'); assert.deepEqual(empty.mods, []); assert.ok(Math.abs(empty.sampledAt - now) < 1);
});

test('old loaders are left untouched and disabling does not overwrite a later user change', () => {
  assert.equal(patchConfig('[System]\nfoo = 1\n', true), null);
  const changed = '[System]\nsettings_auto_save_interval = 30\n\n[IncludeQAQMActivity]\ninclude = qaqm\\qaqm_activity.ini\n\n[Other]\nvalue = 5\n';
  assert.equal(patchConfig(changed, false, '60'), '[System]\nsettings_auto_save_interval = 30\n\n[Other]\nvalue = 5\n');
});
