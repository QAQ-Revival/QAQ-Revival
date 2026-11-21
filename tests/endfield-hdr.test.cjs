const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { createEndfieldHdrService, hasLibraryApproval } = require('../app/src/main/games/endfield/hdr.cjs');
const { autoHdrAllowed, withAutoHdr } = require('../app/src/main/games/endfield/hdr-windows.cjs');
const { VULKAN_MARK } = require('../app/src/main/install/mi-forks.cjs');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qaqr-hdr-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const write = (file, data) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, data); };
  const gamePath = path.join(root, 'game/Endfield.exe'), launcherRoot = path.join(root, 'XXMI'), miRoot = path.join(launcherRoot, 'EFMI');
  const configFile = path.join(launcherRoot, 'XXMI Launcher Config.json'), storageRoot = path.join(root, 'data/RenoDX/Endfield');
  write(gamePath, 'game'); write(path.join(miRoot, 'd3d11.dll'), 'DX11');
  const original = { extra_libraries: 'custom.dll', extra_libraries_enabled: false, extra_libraries_signature: 'saved-consent', xxmi_dll_inject_mode: 'HOOK', d3d11_mode_cmd_args: '-force-d3d11', launch_count: 42 };
  write(configFile, JSON.stringify({ Importers: { EFMI: { Importer: original }, WWMI: { untouched: true } }, Launcher: { keep: 99 } }));
  const files = { 'dxgi.dll': 'ReShade', 'renodx-endfield.addon64': 'RenoDX', 'licenses/ReShade.txt': 'license' };
  const manifest = { source: 'https://github.com/QAQ-Revival/renodx', sourceCommit: 'a'.repeat(40), version: '0.1.0.0', files: {} };
  for (const [name, bytes] of Object.entries(files)) {
    write(path.join(root, 'local-components/endfield-hdr', name), bytes);
    manifest.files[name] = crypto.createHash('sha256').update(bytes).digest('hex');
  }
  write(path.join(root, 'local-components/endfield-hdr/component.json'), JSON.stringify(manifest));
  const values = new Map([[gamePath, 'GpuPreference=2;SwapEffectUpgradeEnable=1;AutoHDREnable=2097;'], ['other-game.exe', 'AutoHDREnable=2097;']]);
  let running = false, failWrite = false;
  const preferences = {
    read: async game => ({ app: values.get(game) ?? null, global: 'AutoHDREnable=1;' }),
    write: async (game, value) => { if (failWrite) throw Error('Registry denied'); if (value === null) values.delete(game); else values.set(game, value); }
  };
  const service = createEndfieldHdrService({ storageRoot, bundleRoots: [root], resolveInstallation: () => ({ gamePath, launcherRoot, miRoot }), preferences, assertStopped: async () => { if (running) throw Error('Game running'); } });
  const config = () => JSON.parse(fs.readFileSync(configFile));
  return { root, gamePath, launcherRoot, miRoot, configFile, storageRoot, values, service, config, original, write, preferences,
    setRunning: value => { running = value; }, setFailWrite: value => { failWrite = value; } };
}

test('Auto HDR changes only its application flag and preserves other preferences and flag bits', () => {
  assert.equal(autoHdrAllowed(null, true), true);
  assert.equal(autoHdrAllowed('AutoHDREnable=2096;', true), false);
  assert.equal(autoHdrAllowed('AutoHDREnable=2097;'), true);
  assert.equal(withAutoHdr('GpuPreference=2;AutoHDREnable=2097;SwapEffectUpgradeEnable=1;', false), 'GpuPreference=2;SwapEffectUpgradeEnable=1;AutoHDREnable=2096;');
  assert.equal(withAutoHdr(null, true), 'AutoHDREnable=2097;');
  assert.equal(withAutoHdr('AutoHDREnable=2147483648;', true), 'AutoHDREnable=2147483649;');
});

test('opening the HDR page is read-only and reports inherited Auto HDR without claiming activation', async t => {
  const f = fixture(t); f.values.delete(f.gamePath);
  const before = fs.readFileSync(f.configFile);
  const result = await f.service.status();
  assert.equal(result.mode, 'auto'); assert.equal(result.installed, false); assert.equal(result.canUseNative, true);
  assert.equal(fs.existsSync(f.storageRoot), false);
  assert.deepEqual(fs.readFileSync(f.configFile), before);
  assert.equal(f.values.has(f.gamePath), false);
});

test('native and Auto HDR switch exclusively, keep game files clean, and restore the original injection settings', async t => {
  const f = fixture(t);
  const state = await f.service.setMode('native');
  assert.equal(state.mode, 'native'); assert.equal(state.auto, false); assert.equal(state.installed, true); assert.equal(state.needsApproval, true);
  const importer = f.config().Importers.EFMI.Importer;
  assert.deepEqual(importer.extra_libraries.split('\n'), [path.join(f.storageRoot, 'dxgi.dll'), path.join(f.miRoot, 'd3d11.dll')]);
  assert.equal(importer.xxmi_dll_inject_mode, 'DIRECT'); assert.equal(importer.extra_libraries_signature, undefined);
  assert.equal(importer.launch_count, 42); assert.equal(importer.d3d11_mode_cmd_args, '-force-d3d11');
  assert.equal(f.values.get('other-game.exe'), 'AutoHDREnable=2097;');
  assert.match(f.values.get(f.gamePath), /GpuPreference=2;SwapEffectUpgradeEnable=1;/);
  assert.deepEqual(fs.readdirSync(path.dirname(f.gamePath)), ['Endfield.exe']);
  assert.equal((await f.service.setMode('auto')).mode, 'auto');
  assert.deepEqual(f.config().Importers.EFMI.Importer, f.original);
  assert.deepEqual(f.config().Importers.WWMI, { untouched: true });
  assert.equal(f.config().Launcher.keep, 99);
  assert.equal((await f.service.setMode('off')).mode, 'off');
  assert.equal(autoHdrAllowed(f.values.get(f.gamePath)), false);
});

test('re-enabling native HDR keeps the original backup and preserves tuning when repairing components', async t => {
  const f = fixture(t);
  await f.service.setMode('native');
  f.write(path.join(f.storageRoot, 'ReShade.ini'), '[renodx]\nPeakNits=700\n');
  await f.service.setMode('native'); await f.service.install(); await f.service.setMode('off');
  assert.deepEqual(f.config().Importers.EFMI.Importer, f.original);
  assert.equal(fs.readFileSync(path.join(f.storageRoot, 'ReShade.ini'), 'utf8'), '[renodx]\nPeakNits=700\n');
});

test('disabling native HDR preserves libraries added by the user while it was enabled', async t => {
  const f = fixture(t); await f.service.setMode('native');
  const changed = f.config(); changed.Importers.EFMI.Importer.extra_libraries += '\nnew-user-addon.dll';
  f.write(f.configFile, JSON.stringify(changed));
  await f.service.setMode('auto');
  assert.equal(f.config().Importers.EFMI.Importer.extra_libraries, 'new-user-addon.dll');
  assert.equal(f.config().Importers.EFMI.Importer.extra_libraries_enabled, true);
  assert.equal(f.config().Importers.EFMI.Importer.extra_libraries_signature, undefined);
});

test('registry failure does not change the launcher or mode and state-write failure rolls both settings back', async t => {
  const f = fixture(t), before = fs.readFileSync(f.configFile), preference = f.values.get(f.gamePath);
  f.setFailWrite(true);
  await assert.rejects(f.service.setMode('native'), /Registry denied/);
  assert.deepEqual(fs.readFileSync(f.configFile), before); assert.equal(fs.existsSync(path.join(f.storageRoot, 'state.json')), false);
  f.setFailWrite(false);
  const rename = fs.renameSync;
  let fail = true;
  t.mock.method(fs, 'renameSync', (from, to) => {
    if (fail && to === path.join(f.storageRoot, 'state.json')) { fail = false; throw Error('Disk full'); }
    return rename(from, to);
  });
  await assert.rejects(f.service.setMode('native'));
  assert.deepEqual(fs.readFileSync(f.configFile), before); assert.equal(f.values.get(f.gamePath), preference);
});

test('a running game, Vulkan runtime and existing ReShade prevent native changes', async t => {
  const f = fixture(t), before = fs.readFileSync(f.configFile), preference = f.values.get(f.gamePath);
  f.setRunning(true); await assert.rejects(f.service.setMode('native'), /Game running/); f.setRunning(false);
  f.write(path.join(f.miRoot, 'd3d11.dll'), VULKAN_MARK);
  await assert.rejects(f.service.setMode('native'), /DX11/);
  assert.equal((await f.service.status()).canUseNative, false);
  f.write(path.join(f.miRoot, 'd3d11.dll'), 'DX11'); f.write(path.join(path.dirname(f.gamePath), 'd3d12.dll'), 'user ReShade');
  await assert.rejects(f.service.setMode('native'), /ReShade/);
  assert.deepEqual(fs.readFileSync(f.configFile), before); assert.equal(f.values.get(f.gamePath), preference);
  assert.equal(fs.existsSync(f.storageRoot), false);
});

test('a switch preserves concurrent Launcher edits and backs out if the library list changes', async t => {
  const f = fixture(t);
  const writePreference = f.preferences.write;
  let changeLibraries = false;
  f.preferences.write = async (...args) => {
    await writePreference(...args);
    const config = f.config();
    config.Launcher.keep = 101;
    if (changeLibraries) config.Importers.EFMI.Importer.extra_libraries = 'edited.dll';
    f.write(f.configFile, JSON.stringify(config));
  };
  await f.service.setMode('native');
  assert.equal(f.config().Launcher.keep, 101);
  changeLibraries = true;
  const before = f.values.get(f.gamePath);
  await assert.rejects(f.service.setMode('auto'));
  assert.equal(f.config().Importers.EFMI.Importer.extra_libraries, 'edited.dll');
  assert.equal(f.values.get(f.gamePath), before);
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.storageRoot, 'state.json'))).mode, 'native');
});

test('launch checks catch external HDR changes and broken native components', async t => {
  const f = fixture(t); await f.service.setMode('native'); await f.service.prepareLaunch('EFMI');
  await assert.rejects(f.service.prepareLaunch('VANILLA'), /EFMI/);
  f.values.set(f.gamePath, 'AutoHDREnable=2097;');
  await assert.rejects(f.service.prepareLaunch('EFMI'), /Auto HDR/);
  await f.service.setMode('native'); f.write(path.join(f.storageRoot, 'renodx-endfield.addon64'), 'modified');
  await assert.rejects(f.service.prepareLaunch('EFMI'));
  await f.service.install(); await f.service.prepareLaunch('EFMI');
});

test('native HDR can still be disabled after the game executable is removed', async t => {
  const f = fixture(t); await f.service.setMode('native'); fs.unlinkSync(f.gamePath);
  assert.equal((await f.service.setMode('off')).mode, 'off');
  assert.deepEqual(f.config().Importers.EFMI.Importer, f.original);
});

test('switching HDR modes reuses a previously approved list without signing or altering runtime components', async t => {
  const f = fixture(t); await f.service.setMode('native');
  const keys = crypto.generateKeyPairSync('ec', { namedCurve: 'secp384r1' });
  f.write(path.join(f.launcherRoot, 'Resources/Security/public_key.der'), keys.publicKey.export({ type: 'spki', format: 'der' }).toString('base64'));
  const accepted = f.config(), importer = accepted.Importers.EFMI.Importer;
  importer.extra_libraries = importer.extra_libraries.replaceAll('\\', '/').replaceAll('\n', '\r\n');
  importer.extra_libraries_signature = crypto.sign('sha256', Buffer.from(importer.extra_libraries), keys.privateKey).toString('base64');
  f.write(f.configFile, JSON.stringify(accepted));
  assert.equal((await f.service.status()).needsApproval, false);
  await f.service.setMode('auto');
  assert.deepEqual(f.config().Importers.EFMI.Importer, f.original, 'restore handles the same paths in the Launcher’s spelling');
  await f.service.setMode('off'); await f.service.setMode('native');
  const restored = f.config().Importers.EFMI.Importer;
  assert.equal(restored.extra_libraries, importer.extra_libraries);
  assert.equal(restored.extra_libraries_signature, importer.extra_libraries_signature);
  assert.equal(hasLibraryApproval(f.launcherRoot, restored), true);
  assert.equal((await f.service.status()).needsApproval, false);
  assert.equal(fs.readFileSync(path.join(f.miRoot, 'd3d11.dll'), 'utf8'), 'DX11');
  assert.equal(fs.existsSync(path.join(f.launcherRoot, 'Resources/Security/private_key.der')), false, 'QAQR never needs the private key');
});

test('a changed library list or signing key requires fresh Launcher approval', async t => {
  const f = fixture(t); await f.service.setMode('native');
  const keys = crypto.generateKeyPairSync('ec', { namedCurve: 'secp384r1' });
  f.write(path.join(f.launcherRoot, 'Resources/Security/public_key.der'), keys.publicKey.export({ type: 'spki', format: 'der' }).toString('base64'));
  const accepted = f.config(), importer = accepted.Importers.EFMI.Importer;
  importer.extra_libraries_signature = crypto.sign('sha256', Buffer.from(importer.extra_libraries), keys.privateKey).toString('base64');
  f.write(f.configFile, JSON.stringify(accepted));
  await f.service.setMode('auto');
  const changed = f.config();
  changed.Importers.EFMI.Importer.extra_libraries_enabled = true;
  changed.Importers.EFMI.Importer.extra_libraries = 'new-user-addon.dll';
  f.write(f.configFile, JSON.stringify(changed));
  assert.equal((await f.service.setMode('native')).needsApproval, true, 'old authorization cannot authorize another DLL');
  const approvedChange = f.config();
  approvedChange.Importers.EFMI.Importer.extra_libraries_signature = crypto.sign('sha256', Buffer.from(approvedChange.Importers.EFMI.Importer.extra_libraries), keys.privateKey).toString('base64');
  f.write(f.configFile, JSON.stringify(approvedChange));
  assert.equal((await f.service.status()).needsApproval, false);
  await f.service.setMode('auto');
  const replacement = crypto.generateKeyPairSync('ec', { namedCurve: 'secp384r1' });
  f.write(path.join(f.launcherRoot, 'Resources/Security/public_key.der'), replacement.publicKey.export({ type: 'spki', format: 'der' }).toString('base64'));
  assert.equal((await f.service.setMode('native')).needsApproval, true, 'key rotation invalidates saved authorization');
  assert.equal(f.config().Importers.EFMI.Importer.extra_libraries_signature, undefined);
});

test('a tampered saved authorization cannot suppress the Launcher prompt', async t => {
  const f = fixture(t); await f.service.setMode('native'); await f.service.setMode('off');
  const keys = crypto.generateKeyPairSync('ec', { namedCurve: 'secp384r1' });
  f.write(path.join(f.launcherRoot, 'Resources/Security/public_key.der'), keys.publicKey.export({ type: 'spki', format: 'der' }).toString('base64'));
  const stateFile = path.join(f.storageRoot, 'state.json');
  const state = JSON.parse(fs.readFileSync(stateFile));
  const extra_libraries = [path.join(f.storageRoot, 'dxgi.dll'), path.join(f.miRoot, 'd3d11.dll')].join('\n');
  state.libraryApproval = { extra_libraries, extra_libraries_signature: crypto.sign('sha256', Buffer.from(extra_libraries + '\nnot-approved.dll'), keys.privateKey).toString('base64') };
  f.write(stateFile, JSON.stringify(state));
  assert.equal((await f.service.setMode('native')).needsApproval, true);
  assert.equal(f.config().Importers.EFMI.Importer.extra_libraries_signature, undefined);
});

// A build the fork released after this manager was built, and the service reading its package through it.
function withRelease(t) {
  const f = fixture(t), { loadBundleAt } = require('../app/src/main/install/mi-forks.cjs');
  const released = path.join(f.root, 'released'), bundled = path.join(f.root, 'local-components/endfield-hdr');
  const contents = { 'dxgi.dll': 'ReShade next', 'renodx-endfield.addon64': 'RenoDX next', 'licenses/ReShade.txt': 'license' };
  for (const [name, bytes] of Object.entries(contents)) f.write(path.join(released, name), bytes);
  f.write(path.join(released, 'component.json'), JSON.stringify({ source: 'https://github.com/QAQ-Revival/renodx', sourceCommit: 'b'.repeat(40), version: '0.1.0.4',
    files: Object.fromEntries(Object.entries(contents).map(([name, bytes]) => [name, crypto.createHash('sha256').update(bytes).digest('hex')])) }));
  const state = { directory: bundled, downloads: 0, running: false };
  const forkPackage = {
    active: () => loadBundleAt(state.directory, 'renodx'), check: async () => {},
    state: version => ({ latest: '0.1.0.4', updateAvailable: version !== '0.1.0.4', error: null }),
    update: async () => { state.downloads++; state.directory = released; return { version: '0.1.0.4', sourceCommit: 'b'.repeat(40) }; }
  };
  const service = createEndfieldHdrService({ storageRoot: f.storageRoot, forkPackage, resolveInstallation: () => ({ gamePath: f.gamePath, launcherRoot: f.launcherRoot, miRoot: f.miRoot }),
    preferences: f.preferences, assertStopped: async () => { if (state.running) throw Error('Game running'); } });
  return { f, service, state };
}

test('a released HDR build is kept for the next install when nothing is installed yet', async t => {
  const { f, service, state } = withRelease(t);
  assert.deepEqual([(await service.status()).available.version, (await service.status()).forkUpdates.updateAvailable], ['0.1.0.0', true]);
  state.running = true;
  const result = await service.updateFork();
  assert.deepEqual([result.updated, result.applied, result.restartRequired, state.downloads], ['0.1.0.4', false, false, 1]);
  assert.equal(fs.existsSync(f.storageRoot), false);
  assert.deepEqual([result.available.version, result.forkUpdates.updateAvailable, result.installed], ['0.1.0.4', false, false]);
  state.running = false;
  await service.install();
  assert.equal(fs.readFileSync(path.join(f.storageRoot, 'dxgi.dll'), 'utf8'), 'ReShade next');
});

test('a released HDR build replaces the installed files, and nothing is downloaded while the game is running', async t => {
  const { f, service, state } = withRelease(t);
  await service.setMode('native');
  f.write(path.join(f.storageRoot, 'ReShade.ini'), 'player tuning');
  const launcher = fs.readFileSync(f.configFile);
  assert.equal((await service.status()).local.version, '0.1.0.0');
  state.running = true;
  await assert.rejects(service.updateFork(), /Game running/);
  assert.equal(state.downloads, 0);
  assert.equal(fs.readFileSync(path.join(f.storageRoot, 'dxgi.dll'), 'utf8'), 'ReShade');
  state.running = false;
  const result = await service.updateFork();
  assert.deepEqual([result.updated, result.applied, result.restartRequired, result.local.version, result.mode], ['0.1.0.4', true, true, '0.1.0.4', 'native']);
  assert.equal(fs.readFileSync(path.join(f.storageRoot, 'dxgi.dll'), 'utf8'), 'ReShade next');
  assert.equal(fs.readFileSync(path.join(f.storageRoot, 'renodx-endfield.addon64'), 'utf8'), 'RenoDX next');
  assert.equal(fs.readFileSync(path.join(f.storageRoot, 'ReShade.ini'), 'utf8'), 'player tuning');
  assert.deepEqual(fs.readFileSync(f.configFile), launcher);
});
