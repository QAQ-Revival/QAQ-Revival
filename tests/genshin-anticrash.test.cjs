const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { TWIN_EXE, normalizeSettings, anyEnabled, firewallRuleName, createGenshinAntiCrashService } = require('../app/out/main/genshin-anticrash.cjs');

const pe = Buffer.alloc(1024);
pe.write('MZ'); pe.writeUInt32LE(128, 60); pe.write('PE\0\0', 128); pe.writeUInt16LE(0x8664, 132); pe.writeUInt16LE(1, 134);
pe.writeUInt16LE(240, 148); pe.writeUInt16LE(0x20b, 152); pe.write('.text', 392); pe.writeUInt32LE(512, 408); pe.writeUInt32LE(512, 412);

function fixture(t, { running = () => false, assertStopped, settings = {}, runNetsh, isFirewallRulePresent } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qaq-genshin-anticrash-'));
  t.after(() => { assert.equal(path.dirname(fs.realpathSync(root)), fs.realpathSync(os.tmpdir())); fs.rmSync(root, { recursive: true, force: true }); });
  const gameDir = path.join(root, 'GI'), gameExe = path.join(gameDir, 'YuanShen.exe');
  fs.mkdirSync(gameDir, { recursive: true });
  fs.writeFileSync(gameExe, pe);
  const dataDir = path.join(gameDir, 'YuanShen_Data');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'data.marker'), 'game-data');
  const modsPath = path.join(root, 'GI-GIMI', 'Mods');
  fs.mkdirSync(modsPath, { recursive: true });
  fs.writeFileSync(path.join(path.dirname(modsPath), 'd3d11.dll'), pe);
  const xxmiRoot = path.join(root, 'XXMI'), loader = path.join(xxmiRoot, 'Resources', 'Bin', 'XXMI Launcher.exe');
  fs.mkdirSync(path.dirname(loader), { recursive: true });
  fs.writeFileSync(loader, pe);
  const configPath = path.join(xxmiRoot, 'XXMI Launcher Config.json');
  fs.writeFileSync(configPath, JSON.stringify({
    Launcher: { keep: true },
    Importers: {
      GIMI: { Importer: { importer_folder: 'GIMI/', game_folder: gameDir.split(path.sep).join('/'), launch_options: '', xxmi_dll_inject_mode: 'HOOK' } },
      WWMI: { Importer: { untouched: true } }
    }
  }, null, 4));
  const netshCalls = [];
  const serviceOptions = {
    getGame: () => ({ id: 'genshin-impact', gamePath: gameExe, modLoaderPath: loader, modFolderPath: modsPath, genshinAntiError: settings }),
    defaultCustomDllPath: path.join(root, 'local-components', 'd3d11-nocheck.dll'),
    resolveLauncherRoot: loaderPath => path.resolve(path.dirname(loaderPath), '..', '..'),
    stateDir: path.join(root, 'anticrash-state'),
    assertStopped: assertStopped || (async () => {}),
    runNetsh: async args => { netshCalls.push(args); return runNetsh ? runNetsh(args) : { ok: true }; },
    isFirewallRulePresent,
    isProcessNameRunning: async name => running(name),
    isElevated: () => true
  };
  const service = createGenshinAntiCrashService(serviceOptions);
  return { root, gameDir, gameExe, dataDir, modsPath, configPath, service, serviceOptions, netshCalls };
}

test('failed firewall cleanup keeps recovery state, blocks replacement sessions and can be retried', async t => {
  let deleteAllowed = false;
  const f = fixture(t, { runNetsh: async args => ({ ok: !args.includes('delete') || deleteAllowed }) });
  await f.service.prepareLaunch({ networkBlock: true });
  const sessionPath = path.join(f.serviceOptions.stateDir, 'session.json');
  const session = fs.readFileSync(sessionPath);
  assert.equal((await f.service.cleanup()).cleaned, false);
  assert.equal(f.service.get().session.networkBlock, true);
  await assert.rejects(f.service.prepareLaunch({ manualStart: true }), /尚未清理完成/);
  assert.ok(fs.readFileSync(sessionPath).equals(session), 'pending recovery cannot be overwritten by another launch');
  deleteAllowed = true;
  assert.equal((await f.service.cleanup()).cleaned, true);
  assert.equal(f.service.get().session, null);
});

test('cleanup retries accept a DLL already restored before a temporary config failure', async t => {
  const f = fixture(t), customDllPath = path.join(f.root, 'custom.dll');
  fs.writeFileSync(customDllPath, Buffer.concat([pe, Buffer.from('-custom-')]));
  const original = fs.readFileSync(f.configPath);
  await f.service.prepareLaunch({ customDll: true, customDllPath });
  const applied = fs.readFileSync(f.configPath);
  fs.writeFileSync(f.configPath, '{unreadable');
  assert.equal((await f.service.cleanup()).cleaned, false);
  assert.ok(fs.readFileSync(path.join(path.dirname(f.modsPath), 'd3d11.dll')).equals(pe));
  fs.writeFileSync(f.configPath, applied);
  assert.equal((await f.service.cleanup()).cleaned, true);
  assert.ok(fs.readFileSync(f.configPath).equals(original));
  assert.equal(f.service.get().session, null);
});

test('interrupted preparation is recoverable before a firewall add finishes or even executes', async t => {
  let reachedAdd;
  const reached = new Promise(resolve => { reachedAdd = resolve; });
  const f = fixture(t, { runNetsh: args => {
    assert.ok(args.includes('add'));
    const saved = JSON.parse(fs.readFileSync(path.join(f.serviceOptions.stateDir, 'session.json')));
    assert.equal(saved.rules.length, 1, 'the attempted firewall change is journaled before execution');
    reachedAdd();
    return new Promise(() => {}); // Simulate the preparing process disappearing at this boundary.
  } });
  const original = fs.readFileSync(f.configPath), customDllPath = path.join(f.root, 'custom.dll');
  fs.writeFileSync(customDllPath, Buffer.concat([pe, Buffer.from('-custom-')]));
  const rename = fs.renameSync;
  let checkedBeforeWrite = false;
  t.mock.method(fs, 'renameSync', (from, to) => {
    if (to === f.configPath && !checkedBeforeWrite) {
      const saved = JSON.parse(fs.readFileSync(path.join(f.serviceOptions.stateDir, 'session.json')));
      assert.ok(saved.dllSwap?.backup && saved.originalDll?.created);
      assert.ok(fs.readFileSync(saved.dllSwap.backup).equals(pe));
      assert.ok(fs.readFileSync(f.configPath).equals(original));
      checkedBeforeWrite = true;
    }
    return rename(from, to);
  });
  f.service.prepareLaunch({ customDll: true, customDllPath, originalDll: true, networkBlock: true }).catch(reachedAdd);
  await reached;
  assert.equal(checkedBeforeWrite, true);
  const recover = createGenshinAntiCrashService({ ...f.serviceOptions,
    runNetsh: async () => ({ ok: false }), isFirewallRulePresent: async () => false });
  await recover.recoverOrphan();
  assert.ok(fs.readFileSync(f.configPath).equals(original));
  assert.ok(fs.readFileSync(path.join(path.dirname(f.modsPath), 'd3d11.dll')).equals(pe));
  assert.equal(fs.existsSync(path.join(path.dirname(f.modsPath), 'original_d3d11.dll')), false);
  assert.equal(recover.get().session, null);
});

test('bundled custom DLL is the portable default while a manual path keeps precedence', async t => {
  const settings = { customDll: true };
  const f = fixture(t, { settings });
  assert.equal(f.service.get().customDllPath, '');
  const bundled = path.join(f.root, 'local-components', 'd3d11-nocheck.dll');
  fs.mkdirSync(path.dirname(bundled));
  const bundledBytes = Buffer.concat([pe, Buffer.from('-bundled-')]);
  fs.writeFileSync(bundled, bundledBytes);
  assert.equal(f.service.get().customDllPath, bundled);
  assert.equal(f.service.get().customDllPathIsDefault, true);
  const importerDll = path.join(path.dirname(f.modsPath), 'd3d11.dll');
  const original = fs.readFileSync(importerDll);
  await f.service.prepareLaunch(settings);
  assert.ok(fs.readFileSync(importerDll).equals(bundledBytes));
  await f.service.cleanup();
  assert.ok(fs.readFileSync(importerDll).equals(original));
  const manual = path.join(f.root, 'manual.dll');
  fs.writeFileSync(manual, pe);
  settings.customDllPath = manual;
  assert.equal(f.service.get().customDllPath, manual);
  assert.equal(f.service.get().customDllPathIsDefault, false);
  await f.service.prepareLaunch(settings);
  assert.equal(f.service.get().session.dllSwap.source, manual);
  await f.service.cleanup();
  fs.unlinkSync(manual);
  await assert.rejects(f.service.prepareLaunch(settings), /不是有效的 x64 DLL/);
  settings.customDllPath = '';
  assert.equal(f.service.get().customDllPath, bundled);
  assert.equal(Object.hasOwn(settings, 'defaultCustomDllPath'), false);
});

test('normalizeSettings and rule naming stay conservative and identity-free', () => {
  assert.deepEqual(normalizeSettings(null), { twin: false, manualStart: false, injectMode: 'default', networkBlock: false, originalDll: false, customDll: false });
  assert.equal(normalizeSettings({ twin: 1, injectMode: 'nope' }).twin, false);
  assert.equal(normalizeSettings({ twin: true, injectMode: 'direct' }).injectMode, 'direct');
  assert.equal(anyEnabled(normalizeSettings({})), false);
  assert.equal(anyEnabled(normalizeSettings({ injectMode: 'hook' })), true);
  assert.equal(anyEnabled(normalizeSettings({ originalDll: true })), true);
  assert.equal(anyEnabled(normalizeSettings({ customDll: true }), ''), false);
  assert.equal(anyEnabled(normalizeSettings({ customDll: true }), 'D:\\x\\y.dll'), true);
  const name = firewallRuleName('D:\\Games\\GI\\g0123456789abcdef.exe');
  assert.match(name, /^Block g0123456789abcdef-[a-f0-9]{6}\.exe$/);
  assert.equal(/qaq|revival/i.test(name), false);
});

test('twin preparation creates a verified random copy and rewrites only XXMI GIMI launch fields', async t => {
  const f = fixture(t);
  const original = fs.readFileSync(f.configPath);
  const report = f.service.get();
  assert.equal(report.ready, true);
  assert.deepEqual(report.settings, { twin: false, manualStart: false, injectMode: 'default', networkBlock: false, originalDll: false, customDll: false });
  const prepared = await f.service.prepareLaunch({ twin: true });
  assert.equal(prepared.prepared, true);
  assert.match(prepared.twinName, TWIN_EXE);
  const twinPath = path.join(f.gameDir, prepared.twinName);
  const twinData = path.join(f.gameDir, path.basename(prepared.twinName, '.exe') + '_Data');
  assert.ok(fs.existsSync(twinPath));
  assert.ok(fs.readFileSync(twinPath).equals(pe), 'twin is a byte copy of the game executable');
  assert.ok(fs.existsSync(twinData), 'twin gets a matching <twin>_Data junction');
  assert.equal(fs.readFileSync(path.join(twinData, 'data.marker'), 'utf8'), 'game-data', 'junction resolves to the original data folder');
  const config = JSON.parse(fs.readFileSync(f.configPath, 'utf8'));
  assert.deepEqual(config.Importers.GIMI.Importer.process_exe_names, [prepared.twinName]);
  assert.equal(config.Importers.GIMI.Importer.xxmi_dll_inject_mode, 'HOOK', 'existing value untouched');
  assert.equal(config.Importers.GIMI.Importer.game_launch, undefined, 'launch mode untouched');
  assert.equal(config.Importers.WWMI.Importer.untouched, true);
  assert.equal(f.netshCalls.length, 0, 'no firewall changes without networkBlock');
  const session = f.service.get();
  assert.equal(session.session.twinName, prepared.twinName);
  assert.equal(session.session.twinReady, true);
  const cleaned = await f.service.cleanup({ force: false });
  assert.equal(cleaned.cleaned, true);
  assert.equal(fs.existsSync(twinPath), false);
  assert.equal(fs.existsSync(twinData), false, 'junction removed with the session');
  assert.ok(fs.existsSync(path.join(f.dataDir, 'data.marker')), 'original data folder untouched');
  assert.ok(fs.readFileSync(f.configPath).equals(original), 'cleanup restores the exact original config bytes');
  assert.equal(f.service.get().session, null);
});

test('dangling twin data junction cleanup keeps recovery state until removal succeeds', async t => {
  const f = fixture(t);
  const original = fs.readFileSync(f.configPath);
  const prepared = await f.service.prepareLaunch({ twin: true });
  const twinData = path.join(f.gameDir, path.basename(prepared.twinName, '.exe') + '_Data');
  const movedData = path.join(f.gameDir, 'Moved_Data');
  for (const file of [f.dataDir, movedData]) assert.ok(path.resolve(file).startsWith(path.resolve(f.root) + path.sep));
  fs.renameSync(f.dataDir, movedData);
  assert.equal(fs.existsSync(twinData), false, 'a dangling junction has no reachable target');
  assert.equal(fs.lstatSync(twinData).isSymbolicLink(), true, 'the junction itself still exists');
  const rmdir = fs.rmdirSync;
  const blocked = t.mock.method(fs, 'rmdirSync', (file, ...args) => {
    if (file === twinData) throw Object.assign(new Error('junction busy'), { code: 'EBUSY' });
    return rmdir(file, ...args);
  });
  const result = await f.service.cleanup();
  assert.equal(result.cleaned, false);
  assert.ok(result.notes.some(note => note.includes('数据联接未能删除')));
  assert.equal(fs.lstatSync(twinData).isSymbolicLink(), true);
  assert.equal(f.service.get().session.twinName, prepared.twinName, 'failed removal retains recovery state');
  blocked.mock.restore();

  const recovered = createGenshinAntiCrashService(f.serviceOptions);
  await recovered.recoverOrphan();
  assert.equal(fs.lstatSync(twinData, { throwIfNoEntry: false }), undefined, 'recovery removes the dangling junction');
  assert.equal(recovered.get().session, null, 'recovery state is removed only after successful cleanup');
  assert.ok(fs.readFileSync(f.configPath).equals(original));
  assert.equal(fs.readFileSync(path.join(movedData, 'data.marker'), 'utf8'), 'game-data');
});

test('a twin without a matching data folder is refused before any write', async t => {
  const f = fixture(t);
  fs.renameSync(f.dataDir, path.join(f.gameDir, 'Renamed_Data'));
  const original = fs.readFileSync(f.configPath);
  await assert.rejects(f.service.prepareLaunch({ twin: true }), /未找到游戏数据目录 YuanShen_Data/);
  assert.deepEqual(fs.readdirSync(f.gameDir).filter(name => TWIN_EXE.test(name)), [], 'no twin left behind');
  assert.ok(fs.readFileSync(f.configPath).equals(original));
  assert.equal(f.service.get().session, null);
});

test('manual start, direct injection and network blocking apply together and survive XXMI rewrites', async t => {
  const f = fixture(t);
  const prepared = await f.service.prepareLaunch({ twin: true, manualStart: true, injectMode: 'direct', networkBlock: true });
  assert.match(prepared.notice, /等待你手动启动游戏/);
  assert.match(prepared.notice, /无法联网/);
  let config = JSON.parse(fs.readFileSync(f.configPath, 'utf8'));
  assert.equal(config.Importers.GIMI.Importer.game_launch, 'MANUAL');
  assert.equal(config.Importers.GIMI.Importer.xxmi_dll_inject_mode, 'DIRECT');
  const adds = f.netshCalls.filter(args => args.includes('add'));
  assert.equal(adds.length, 2, 'rules cover the twin and the original executable');
  assert.ok(adds.every(args => args.includes('dir=out') && args.includes('action=block') && args.includes('profile=any')));
  assert.ok(adds.some(args => args.some(a => a.endsWith(prepared.twinName))));
  assert.ok(adds.some(args => args.some(a => a.endsWith('YuanShen.exe'))));
  // Simulate XXMI saving unrelated state after our prepare while keeping our fields.
  config.Launcher.keep = false;
  config.Launcher.launch_count = 3;
  fs.writeFileSync(f.configPath, JSON.stringify(config, null, 4) + '\n');
  const cleaned = await f.service.cleanup({ force: false });
  assert.equal(cleaned.cleaned, true);
  config = JSON.parse(fs.readFileSync(f.configPath, 'utf8'));
  assert.equal(config.Importers.GIMI.Importer.process_exe_names, undefined, 'our field removed because it was absent before');
  assert.equal(config.Importers.GIMI.Importer.game_launch, undefined);
  assert.equal(config.Importers.GIMI.Importer.xxmi_dll_inject_mode, 'HOOK', 'restored to the value recorded before prepare');
  assert.equal(config.Launcher.launch_count, 3, 'unrelated XXMI change preserved');
  assert.equal(config.Launcher.keep, false);
  const deletes = f.netshCalls.filter(args => args.includes('delete'));
  assert.equal(deletes.length, 2);
  assert.equal(fs.existsSync(path.join(f.gameDir, prepared.twinName)), false);
});

test('random XXMI Hook sessions match the loader name and restore only their own config and INI fields', async t => {
  const f = fixture(t);
  const iniPath = path.join(path.dirname(f.modsPath), 'd3dx.ini');
  const originalIni = '[Loader]\r\nloader = XXMI Launcher.exe\r\ntarget = YuanShen.exe\r\n[Rendering]\r\nkeep = 1\r\n';
  fs.writeFileSync(iniPath, originalIni);
  const originalConfig = fs.readFileSync(f.configPath);
  const prep = await f.service.prepareLaunch({ twin: true }, { randomLauncher: true });
  const launcherName = path.basename(prep.launcherPath);
  assert.match(launcherName, /^r[a-f0-9]{24}\.exe$/);
  let config = JSON.parse(fs.readFileSync(f.configPath));
  assert.equal(config.Importers.GIMI.Importer.d3dx_ini.core.Loader.loader, launcherName);
  assert.equal(config.Importers.GIMI.Importer.xxmi_dll_inject_mode, 'HOOK');
  assert.equal(f.service.get().session.launcherName, launcherName);
  // XXMI writes the configured Loader identity into d3dx.ini before HookLibrary.
  fs.writeFileSync(iniPath, originalIni.replace('XXMI Launcher.exe', launcherName).replace('YuanShen.exe', prep.twinName));
  assert.equal((await f.service.cleanup()).cleaned, true);
  assert.equal(fs.existsSync(prep.launcherPath), false);
  assert.ok(fs.readFileSync(f.configPath).equals(originalConfig));
  assert.equal(fs.readFileSync(iniPath, 'utf8'), originalIni);

  // The repair is also needed with no optional anti-error switches enabled.
  const next = await f.service.prepareLaunch({}, { randomLauncher: true });
  config = JSON.parse(fs.readFileSync(f.configPath));
  config.Launcher.keep = false;
  config.Importers.GIMI.Importer.d3dx_ini.core.Loader.keep = 'user edit';
  fs.writeFileSync(f.configPath, JSON.stringify(config));
  fs.writeFileSync(iniPath, originalIni.replace('XXMI Launcher.exe', path.basename(next.launcherPath)).replace('keep = 1', 'keep = 2'));
  assert.equal((await f.service.cleanup()).cleaned, true);
  config = JSON.parse(fs.readFileSync(f.configPath));
  assert.equal(config.Launcher.keep, false);
  assert.equal(config.Importers.GIMI.Importer.d3dx_ini.core.Loader.loader, undefined);
  assert.equal(config.Importers.GIMI.Importer.d3dx_ini.core.Loader.keep, 'user edit');
  assert.equal(fs.readFileSync(iniPath, 'utf8'), originalIni.replace('keep = 1', 'keep = 2'));
});

test('firewall failures roll the whole preparation back', async t => {
  const f = fixture(t);
  const original = fs.readFileSync(f.configPath);
  const service = createGenshinAntiCrashService({
    getGame: () => ({ id: 'genshin-impact', gamePath: f.gameExe, modLoaderPath: path.join(f.root, 'XXMI', 'Resources', 'Bin', 'XXMI Launcher.exe') }),
    resolveLauncherRoot: loaderPath => path.resolve(path.dirname(loaderPath), '..', '..'),
    stateDir: path.join(f.root, 'anticrash-state-rollback'),
    runNetsh: async args => ({ ok: !args.includes('add'), error: '拒绝访问' }),
    isProcessNameRunning: async () => false
  });
  await assert.rejects(service.prepareLaunch({ twin: true, networkBlock: true }), /添加防火墙规则失败/);
  assert.ok(fs.readFileSync(f.configPath).equals(original), 'config untouched after rollback');
  assert.deepEqual(fs.readdirSync(f.gameDir).filter(name => name !== 'YuanShen.exe' && name !== 'YuanShen_Data'), [], 'twin removed after rollback');
  assert.equal(service.get().session, null, 'no session left behind');
});

test('a running twin session blocks re-preparation until the game exits', async t => {
  let running = false;
  const f = fixture(t, { running: () => running });
  const first = await f.service.prepareLaunch({ twin: true });
  running = true;
  await assert.rejects(f.service.prepareLaunch({ twin: true }), /仍在运行/);
  assert.deepEqual((await f.service.cleanup({ force: false })).notes, ['游戏仍在运行，结束后会自动清理']);
  assert.ok(fs.existsSync(path.join(f.gameDir, first.twinName)));
  running = false;
  const second = await f.service.prepareLaunch({ twin: true });
  assert.notEqual(second.twinName, first.twinName, 'each launch session uses a fresh random name');
  assert.equal(fs.existsSync(path.join(f.gameDir, first.twinName)), false, 'previous twin cleaned up');
  const config = JSON.parse(fs.readFileSync(f.configPath, 'utf8'));
  assert.deepEqual(config.Importers.GIMI.Importer.process_exe_names, [second.twinName]);
});

test('manual-only and disabled configurations do not create twins or rules', async t => {
  const f = fixture(t);
  const manualOnly = await f.service.prepareLaunch({ manualStart: true });
  assert.equal(manualOnly.twinName, '');
  assert.equal(manualOnly.notice.includes('随机名副本'), false);
  assert.deepEqual(fs.readdirSync(f.gameDir), ['YuanShen.exe', 'YuanShen_Data']);
  assert.equal(JSON.parse(fs.readFileSync(f.configPath, 'utf8')).Importers.GIMI.Importer.process_exe_names, undefined);
  await f.service.cleanup({ force: false });
  const disabled = await f.service.prepareLaunch({});
  assert.equal(disabled.prepared, false);
  assert.equal(JSON.parse(fs.readFileSync(f.configPath, 'utf8')).Importers.GIMI.Importer.game_launch, undefined);
  assert.equal(f.netshCalls.length, 0);
});

test('environment blockers stop preparation before any write', async t => {
  const f = fixture(t);
  const gameDir2 = path.join(f.root, 'Elsewhere');
  fs.mkdirSync(gameDir2, { recursive: true });
  fs.copyFileSync(f.gameExe, path.join(gameDir2, 'Other.exe'));
  const service = createGenshinAntiCrashService({
    getGame: () => ({ id: 'genshin-impact', gamePath: path.join(gameDir2, 'Other.exe'), modLoaderPath: '' }),
    resolveLauncherRoot: () => '',
    stateDir: path.join(f.root, 'anticrash-state-blocked')
  });
  const report = service.get();
  assert.equal(report.ready, false);
  assert.ok(report.blockers.length >= 2);
  await assert.rejects(service.prepareLaunch({ twin: true }), /YuanShen\.exe 或 GenshinImpact\.exe/);
});

test('original_d3d11 deployment uses the system runtime copy and is removed with the session', async t => {
  const f = fixture(t);
  const importerDir = path.dirname(f.modsPath);
  const systemDll = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'd3d11.dll');
  const systemBytes = fs.readFileSync(systemDll);
  const prepared = await f.service.prepareLaunch({ originalDll: true });
  assert.equal(prepared.prepared, true);
  const deployed = path.join(importerDir, 'original_d3d11.dll');
  assert.ok(fs.existsSync(deployed), 'local runtime copy deployed into the GIMI folder');
  assert.ok(fs.readFileSync(deployed).equals(systemBytes), 'copy is byte-identical to the system runtime');
  assert.equal(fs.readdirSync(importerDir).includes('d3d11.dll'), true, 'XXMI component untouched');
  assert.equal(f.service.get().session.originalDll.created, true);
  const cleaned = await f.service.cleanup({ force: false });
  assert.equal(cleaned.cleaned, true);
  assert.equal(fs.existsSync(deployed), false, 'deployment removed on cleanup');
  // A foreign or user-modified original_d3d11.dll is left alone, not clobbered.
  fs.writeFileSync(deployed, 'user-managed copy');
  const second = await f.service.prepareLaunch({ originalDll: true, manualStart: true });
  assert.ok(fs.readFileSync(deployed).equals(Buffer.from('user-managed copy')), 'existing foreign copy preserved');
  assert.equal(second.prepared, true);
  assert.match(second.notice, /沿用现有文件/);
  await f.service.cleanup({ force: false });
  assert.ok(fs.existsSync(deployed), 'user-managed copy still there after cleanup');
  fs.unlinkSync(deployed);
});

test('custom DLL swap (mantle method) replaces the importer component safely and restores it exactly', async t => {
  const f = fixture(t);
  const importerDir = path.dirname(f.modsPath);
  const dllPath = path.join(importerDir, 'd3d11.dll');
  const originalDllBytes = fs.readFileSync(dllPath);
  const customDll = path.join(f.root, 'custom', 'my-custom-build.dll');
  fs.mkdirSync(path.dirname(customDll), { recursive: true });
  const customBytes = Buffer.concat([pe, Buffer.from('-custom-build-')]);
  fs.writeFileSync(customDll, customBytes);
  // Twin and the custom component are mutually exclusive by design.
  await assert.rejects(f.service.prepareLaunch({ twin: true, customDll: true, customDllPath: customDll }), /互斥/);
  await assert.rejects(f.service.prepareLaunch({ customDll: true, customDllPath: '' }), /请先在游戏设置中选择定制组件文件|不是有效的 x64 DLL|文件/);
  const original = fs.readFileSync(f.configPath);
  const prepared = await f.service.prepareLaunch({ customDll: true, customDllPath: customDll });
  assert.equal(prepared.prepared, true);
  assert.match(prepared.notice, /替换 GIMI 图形组件/);
  assert.ok(fs.readFileSync(dllPath).equals(customBytes), 'importer component swapped for the local custom build');
  const config = JSON.parse(fs.readFileSync(f.configPath, 'utf8'));
  assert.equal(config.Importers.GIMI.Importer.xxmi_dll_inject_mode, 'DIRECT', 'injection forced to Direct for substitutes');
  assert.equal(config.Importers.GIMI.Migoto.unsafe_mode, true, 'XXMI signature enforcement paused for the session');
  assert.equal(config.Importers.GIMI.Importer.process_exe_names, undefined, 'no twin redirect while mantle is active');
  const cleaned = await f.service.cleanup({ force: false });
  assert.equal(cleaned.cleaned, true);
  assert.ok(fs.readFileSync(dllPath).equals(originalDllBytes), 'original component restored byte-exact');
  assert.ok(fs.readFileSync(f.configPath).equals(original), 'config restored byte-exact');
  assert.equal(fs.existsSync(path.join(importerDir, 'original_d3d11.dll')), false);
});

test('a missing custom DLL file fails preparation without touching anything', async t => {
  const f = fixture(t);
  const original = fs.readFileSync(f.configPath);
  const dllPath = path.join(f.root, 'custom', 'd3d11.dll');
  await assert.rejects(f.service.prepareLaunch({ customDll: true, customDllPath: dllPath }), /不是有效的 x64 DLL|文件/);
  assert.ok(fs.readFileSync(f.configPath).equals(original));
  assert.equal(f.service.get().session, null);
});
