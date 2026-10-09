const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createWuwaTuningService } = require('../app/out/main/wuwa-tuning.cjs');
function fixture(t, assertStopped) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qaq-wuwa-tuning-'));
  t.after(() => { t.mock.restoreAll(); assert.equal(path.dirname(fs.realpathSync(root)), fs.realpathSync(os.tmpdir())); fs.rmSync(root, { recursive: true, force: true }); });
  const gameRoot = path.join(root, 'Game'), launcherConfig = path.join(root, 'XXMI Launcher Config.json');
  const write = (relative, text) => { const file = path.join(gameRoot, relative); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); return file; };
  write('Wuthering Waves.exe', 'fixture');
  const user = write('Client/Config/UserEngine.ini', '; keep user note\r\n[ConsoleVariables]\r\nr.Kuro.SkeletalMesh.DistanceLODBaseFOV=384\r\nr.Other=7\r\n');
  const engine = write('Client/Saved/Config/WindowsNoEditor/Engine.ini', '[Core.System]\nPaths=custom-path\n[SystemSettings]\nr.Streaming.HiddenPrimitiveScale=50\nr.Streaming.FramesForFullUpdate=0\nr.Other=9\n');
  fs.writeFileSync(launcherConfig, JSON.stringify({ Launcher: { auto_update: true }, Importers: { WWMI: { Importer: { mesh_lod_distance_lod_base_fov: 384, unlock_fps: true } }, GIMI: { untouched: true } } }));
  const service = createWuwaTuningService({ resolvePaths: () => ({ gameRoot, launcherConfig }), backupDir: path.join(root, 'backups'), assertStopped });
  return { root, gameRoot, launcherConfig, user, engine, service, write };
}
test('switching WuWa presets synchronizes XXMI and INIs, removes competing keys and restores exact original bytes', async t => {
  const f = fixture(t); const original = [f.launcherConfig, f.user, f.engine].map(file => fs.readFileSync(file));
  assert.equal(f.service.get().preset, 'community36');
  let result = await f.service.apply({ preset: 'legacy2024', revision: f.service.get().revision });
  assert.equal(result.preset, 'legacy2024');
  assert.equal(result.values.launcherFov, 165); assert.equal(result.values.fov, 165);
  assert.equal(result.values.hidden, null); assert.equal(result.values.frames, null);
  assert.match(fs.readFileSync(f.engine, 'utf8'), /Paths=custom-path/); assert.match(fs.readFileSync(f.user, 'utf8'), /r.Other=7\r\n/);
  const updated = JSON.parse(fs.readFileSync(f.launcherConfig)); assert.equal(updated.Importers.WWMI.Importer.unlock_fps, true); assert.equal(updated.Importers.GIMI.untouched, true);
  await f.service.restore({ revision: result.revision });
  [f.launcherConfig, f.user, f.engine].forEach((file, i) => assert.ok(fs.readFileSync(file).equals(original[i])));
  result = await f.service.apply({ preset: 'stable-textures', revision: f.service.get().revision });
  assert.equal(result.values.hidden, 40); assert.equal(result.values.launcherFov, 384); assert.equal(result.values.frames, null);
});
test('stale changes, running programs and a mid-write failure preserve all files', async t => {
  let running = false; const f = fixture(t, async () => { if (running) throw Error('running'); });
  const revision = f.service.get().revision; fs.appendFileSync(f.engine, '; external edit\n');
  await assert.rejects(f.service.apply({ preset: 'default', revision }), /变化/);
  running = true; await assert.rejects(f.service.apply({ preset: 'default', revision: f.service.get().revision }), /running/); running = false;
  const original = [f.launcherConfig, f.user, f.engine].map(file => fs.readFileSync(file));
  const rename = fs.renameSync; let fail = true;
  t.mock.method(fs, 'renameSync', (from, to) => { if (fail && to === f.engine) { fail = false; throw Error('simulated write failure'); } return rename(from, to); });
  await assert.rejects(f.service.apply({ preset: 'default', revision: f.service.get().revision }), /simulated/);
  [f.launcherConfig, f.user, f.engine].forEach((file, i) => assert.ok(fs.readFileSync(file).equals(original[i])));
  const applied = await f.service.apply({ preset: 'default', revision: f.service.get().revision });
  fs.appendFileSync(f.user, '; newer user setting\n');
  await assert.rejects(f.service.restore({ revision: applied.revision }), /变化/);
  await assert.rejects(f.service.restore({ revision: f.service.get().revision }), /修改/);
});
test('DeviceProfiles imports are validated, backed up, and removed when switching back to an INI scheme', async t => {
  const f = fixture(t);
  const input = f.write('example.ini', '[Windows DeviceProfile]\n+CVars=r.SkeletalMeshLODBias=-1\n');
  const invalid = f.write('bad.ini', '[Other]\nanything=1\n');
  await assert.rejects(f.service.apply({ preset: 'device-profile', revision: f.service.get().revision, deviceProfilePath: invalid }), /有效配置/);
  const state = await f.service.apply({ preset: 'device-profile', revision: f.service.get().revision, deviceProfilePath: input });
  assert.equal(state.preset, 'device-profile'); assert.ok(fs.readFileSync(state.paths.device).equals(fs.readFileSync(input)));
  assert.equal(state.values.hidden, null); assert.equal(state.values.launcherFov, 165);
  const switched = await f.service.apply({ preset: 'community36', revision: state.revision });
  assert.equal(switched.preset, 'community36'); assert.equal(fs.existsSync(state.paths.device), false);
});

test('repeated DeviceProfiles imports and undo retain the baseline from before the first import', async t => {
  for (const original of [null, Buffer.from('; original user profile\r\n[Windows DeviceProfile]\r\n+CVars=r.User=7\r\n')]) {
    const f = fixture(t);
    const device = path.join(f.gameRoot, 'Client/Saved/Config/WindowsNoEditor/DeviceProfiles.ini');
    if (original) fs.writeFileSync(device, original);
    const a = f.write('a.ini', '[Windows DeviceProfile]\n+CVars=r.Foo=1\n');
    const b = f.write('b.ini', '[Windows DeviceProfile]\n+CVars=r.Foo=2\n');
    const apply = preset => f.service.apply({ preset, revision: f.service.get().revision });
    const importFile = deviceProfilePath => f.service.apply({ preset: 'device-profile', revision: f.service.get().revision, deviceProfilePath });
    await importFile(a);
    await importFile(b);
    await f.service.restore({ revision: f.service.get().revision });
    assert.ok(fs.readFileSync(device).equals(fs.readFileSync(a)), 'undo restores just the previous import');
    assert.equal(f.service.get().preset, 'device-profile');
    await importFile(b);
    await apply('default');
    if (original) assert.ok(fs.readFileSync(device).equals(original));
    else assert.equal(fs.existsSync(device), false);
    await f.service.restore({ revision: f.service.get().revision });
    assert.ok(fs.readFileSync(device).equals(fs.readFileSync(b)), 'undoing the switch restores the managed profile');
    await apply('community36');
    if (original) assert.ok(fs.readFileSync(device).equals(original));
    else assert.equal(fs.existsSync(device), false);
  }
});
