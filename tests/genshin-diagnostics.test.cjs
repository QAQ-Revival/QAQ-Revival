const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createGenshinDiagnostics, peInfo } = require('../app/out/main/genshin-diagnostics.cjs');

function peFixture(machine = 0x8664) {
  const b = Buffer.alloc(1024); b.write('MZ'); b.writeUInt32LE(128, 60); b.write('PE\0\0', 128);
  b.writeUInt16LE(machine, 132); b.writeUInt16LE(1, 134); b.writeUInt16LE(240, 148);
  b.writeUInt16LE(machine === 0x8664 ? 0x20b : 0x10b, 152); b.write('.text', 392);
  b.writeUInt32LE(512, 408); b.writeUInt32LE(512, 412); return b;
}
function fixture(t, assertStopped = async () => {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qaq-genshin-check-'));
  t.after(() => { t.mock.restoreAll(); assert.equal(path.dirname(fs.realpathSync(root)), fs.realpathSync(os.tmpdir())); fs.rmSync(root, { recursive: true, force: true }); });
  const write = (relative, bytes) => { const file = path.join(root, relative); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, bytes); return file; };
  const game = { id: 'genshin-impact', gamePath: write('Game/YuanShen.exe', peFixture()), modLoaderPath: write('XXMI/Resources/Bin/XXMI Launcher.exe', peFixture()), modFolderPath: path.join(root, 'GIMI/Mods'), launchArgs: '' };
  fs.mkdirSync(game.modFolderPath, { recursive: true });
  write('GIMI/d3d11.dll', peFixture()); write('GIMI/d3dx.ini', '[Loader]\n'); write('GIMI/Core/GIMI/main.ini', '; GIMI core fixture');
  const configPath = write('XXMI/XXMI Launcher Config.json', JSON.stringify({ Launcher: { keep: true }, Importers: { GIMI: { Importer: { importer_folder: 'old-GIMI', game_folder: 'old-game', configure_game: true } }, WWMI: { untouched: true } } }));
  const service = createGenshinDiagnostics({ getGame: () => game, resolveLauncherRoot: () => path.join(root, 'XXMI'), tokenizeArgs: text => text.match(/(?:[^\s"]+|"[^"]*")+/g) || [], backupDir: path.join(root, 'backups'), assertStopped });
  return { root, write, game, configPath, service };
}
test('read-only checks propose verified path repairs, preserve other settings, and restore exact configuration bytes', async t => {
  const f = fixture(t), before = fs.readFileSync(f.configPath);
  const report = f.service.check(); assert.equal(report.repairs.length, 2); assert.ok(report.summary.errors > 0);
  assert.ok(fs.readFileSync(f.configPath).equals(before));
  const repaired = await f.service.apply({ revision: report.revision, ids: report.repairs.map(item => item.id) });
  assert.equal(repaired.summary.errors, 0); assert.equal(repaired.canRestore, true);
  const config = JSON.parse(fs.readFileSync(f.configPath)); assert.equal(config.Importers.WWMI.untouched, true); assert.equal(config.Launcher.keep, true);
  await f.service.restore({ revision: repaired.revision }); assert.ok(fs.readFileSync(f.configPath).equals(before));
});
test('stale state, running programs, failed writes and newer configuration are never silently overwritten', async t => {
  let running = false; const f = fixture(t, async () => { if (running) throw Error('running'); });
  let report = f.service.check(); fs.appendFileSync(f.configPath, ' ');
  await assert.rejects(f.service.apply({ revision: report.revision, ids: ['game-folder'] }), /过期/);
  report = f.service.check(); running = true;
  await assert.rejects(f.service.apply({ revision: report.revision, ids: ['game-folder'] }), /running/); running = false;
  const before = fs.readFileSync(f.configPath), rename = fs.renameSync; let fail = true;
  t.mock.method(fs, 'renameSync', (from, to) => { if (fail && to === f.configPath) { fail = false; throw Error('write failed'); } return rename(from, to); });
  await assert.rejects(f.service.apply({ revision: report.revision, ids: ['game-folder'] }), /write failed/);
  assert.ok(fs.readFileSync(f.configPath).equals(before));
  const fixed = await f.service.apply({ revision: report.revision, ids: ['game-folder'] });
  fs.appendFileSync(f.configPath, ' ');
  await assert.rejects(f.service.restore({ revision: fixed.revision }), /过期/);
  await assert.rejects(f.service.restore({ revision: f.service.check().revision }), /变化/);
});
test('PE checks identify wrong architectures and truncation; argument overrides block while extra DLLs remain untouched', async t => {
  const f = fixture(t); const badDll = f.write('GIMI/d3d11.dll', peFixture(0x14c));
  assert.equal(peInfo(badDll).valid, false);
  assert.equal(f.service.check().repairs.some(item => item.id === 'importer-folder'), false);
  f.write('GIMI/d3d11.dll', peFixture());
  let report = f.service.check(); await f.service.apply({ revision: report.revision, ids: report.repairs.map(item => item.id) });
  f.game.launchArgs = '--xxmi WWMI'; const extra = f.write('Game/dxgi.dll', 'user graphics component');
  report = f.service.check(); assert.equal(report.checks.find(item => item.id === 'args').level, 'error');
  assert.equal(report.checks.find(item => item.id === 'extra-dxgi.dll').level, 'warning'); assert.equal(fs.readFileSync(extra, 'utf8'), 'user graphics component');
  f.game.launchArgs = '-xWWMI'; assert.equal(f.service.check().checks.find(item => item.id === 'args').level, 'error');
  f.game.launchArgs = '--xxmi=GIMI'; assert.equal(f.service.check().checks.find(item => item.id === 'args').level, 'warning');
  f.write('GIMI/d3d11.dll', peFixture().subarray(0, 800)); assert.equal(peInfo(badDll).valid, false);
});
test('shared logs are scoped to Genshin and exported reports omit raw logs, launch arguments and absolute paths', t => {
  const f = fixture(t);
  f.write('XXMI/XXMI Launcher Log.txt', 'WWMI Error DLL not found\nGIMI Error DLL not found uid=secret-user token=private-token\nGIMI uid=10612345\nGIMI game error 10612-4001\n');
  f.game.launchArgs = '--custom-secret sensitive';
  const report = f.service.exportReport(), text = JSON.stringify(report);
  assert.equal(report.logs[0].hints.find(item => item.id === 'missing-file').count, 1);
  assert.equal(report.logs[0].hints.find(item => item.id === 'game-code').count, 1);
  for (const secret of [path.basename(f.root), 'secret-user', 'private-token', 'sensitive']) assert.equal(text.includes(secret), false);
});
