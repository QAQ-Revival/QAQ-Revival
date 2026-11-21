const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { createMiForksService } = require('../app/src/main/install/mi-forks.cjs');
const { createEfmiVulkanService, rendererArgument } = require('../app/src/main/games/endfield/vulkan.cjs');
const { releaseFiles } = require('../app/src/main/games/endfield/vulkan-packages.cjs');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const vulkanMark = Buffer.from('extended_rendering', 'utf16le');
const forkMark = Buffer.from('QAQ-Revival/XXMI-Libs-Package', 'utf16le');
const dll = (name, ...marks) => Buffer.concat([Buffer.from(name), ...marks]);
function fixture(t, { present = { vendor: 'nvidia', value: null }, argument = '-force-d3d11' } = {}) {
  const temporary = fs.realpathSync(os.tmpdir()), root = fs.mkdtempSync(path.join(temporary, 'qaqr-efmi-vulkan-'));
  t.after(() => { assert.equal(path.dirname(fs.realpathSync(root)), temporary); fs.rmSync(root, { recursive: true, force: true }); });
  const launcherRoot = path.join(root, 'launcher'), miRoot = path.join(launcherRoot, 'EFMI'), app = path.join(root, 'app');
  const write = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, value); return file; };
  const official = dll('official'), dx11Fork = dll('dx11 fork', forkMark);
  write(path.join(miRoot, 'd3dx.ini'), '[Constants]\n');
  write(path.join(miRoot, 'd3d11.dll'), official);
  write(path.join(miRoot, 'Mods/kept.ini'), 'keep mod');
  write(path.join(launcherRoot, 'Resources/Packages/XXMI/d3d11.dll'), official);
  write(path.join(launcherRoot, 'Resources/Packages/XXMI/Manifest.json'), JSON.stringify({ version: '1.2.2' }));
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'secp384r1' });
  const userName = 'qaqr-fixture', signature = crypto.sign('sha256', Buffer.from(userName), privateKey).toString('base64');
  const configFile = write(path.join(launcherRoot, 'XXMI Launcher Config.json'), JSON.stringify({
    Launcher: { customPreference: 'keep' },
    Importers: {
      EFMI: { Importer: { d3d11_mode_cmd_args: argument, launch_count: 7 }, Migoto: { unsafe_mode: true, unsafe_mode_signature: signature } },
      WWMI: { Importer: { d3d11_mode_cmd_args: '-dx11' } }
    }
  }));
  write(path.join(launcherRoot, 'Resources/Security/public_key.der'), publicKey.export({ type: 'spki', format: 'der' }).toString('base64'));
  const gamePath = write(path.join(root, 'game/Endfield.exe'), 'Synthetic game, never executed');
  function bundle(name, contents, extra) {
    const directory = path.join(app, 'local-components', name), files = {};
    for (const [relative, bytes] of Object.entries(contents)) { write(path.join(directory, relative), bytes); files[relative] = sha(bytes); }
    const repository = extra.backend === 'vulkan' ? 'XXMI-Libs-Vulkan' : 'XXMI-Libs-Package';
    write(path.join(directory, 'component.json'), JSON.stringify({ source: 'https://github.com/QAQ-Revival/' + repository, sourceCommit: 'a'.repeat(40), files, ...extra }));
  }
  bundle('xxmi-runtime', { 'd3d11.dll': dx11Fork }, { activityProtocol: 1, compatibleRuntimeHashes: [sha(official)] });
  const forkDll = dll('vulkan fork', vulkanMark, forkMark), upstreamDll = dll('vulkan upstream', vulkanMark);
  bundle('xxmi-runtime-vulkan', { 'd3d11.dll': forkDll, 'dxcompiler.dll': 'fork dxc', 'SPIRV-Tools-shared.dll': 'fork spirv', 'COPYING.txt': 'license' }, { backend: 'vulkan' });
  const upstreamFiles = { 'd3d11.dll': upstreamDll, 'dxcompiler.dll': 'upstream dxc', 'SPIRV-Tools-shared.dll': 'upstream spirv' };
  const info = { version: '1.2.2-nhd.27', files: Object.fromEntries(Object.entries(upstreamFiles).map(([name, bytes]) => [name, sha(bytes)])) };
  let downloads = 0, pending = null, selected = info;
  const packages = {
    selected: () => selected,
    pending: () => pending,
    ensure: async (target = selected) => { downloads++; return new Map(Object.entries(target.version === info.version ? upstreamFiles : { ...upstreamFiles, 'd3d11.dll': dll('vulkan next', vulkanMark) }).map(([name, bytes]) => [name, Buffer.from(bytes)])); },
    checkUpdates: async () => {},
    commit: next => { selected = next; pending = null; },
    state: () => ({ version: selected.version, available: pending?.version || null, updateAvailable: !!pending, error: null })
  };
  let running = false, presentState = present;
  const resolveInstallation = () => ({ launcherRoot, miRoot, gamePath });
  const miForks = createMiForksService({ bundleRoots: [app], resolveInstallation, userName });
  const service = createEfmiVulkanService({
    resolveInstallation, packages, miForks, userName, bundleRoots: [app],
    readPresent: async () => presentState,
    assertStopped: async () => { if (running) throw Error('game running'); }
  });
  const runtime = () => miForks.status('endfield').components.find(item => item.id === 'runtime');
  const onDisk = () => fs.readFileSync(path.join(miRoot, 'd3d11.dll'));
  const launcher = () => JSON.parse(fs.readFileSync(configFile, 'utf8'));
  const argumentNow = () => launcher().Importers.EFMI.Importer.d3d11_mode_cmd_args;
  return { root, miRoot, launcherRoot, configFile, service, miForks, packages, write, runtime, onDisk, launcher, argumentNow, official, dx11Fork, forkDll, upstreamDll, info,
    downloads: () => downloads, setRunning: value => { running = value; }, setPresent: value => { presentState = value; }, setPending: value => { pending = value; } };
}

test('the renderer argument moves alone and keeps whatever else the field holds', () => {
  assert.equal(rendererArgument('-force-d3d11', true), '');
  assert.equal(rendererArgument('', false), '-force-d3d11');
  assert.equal(rendererArgument('-force-d3d11 -popupwindow', true), '-popupwindow');
  assert.equal(rendererArgument('-popupwindow', false), '-force-d3d11 -popupwindow');
  assert.equal(rendererArgument(undefined, false), '-force-d3d11');
});

test('turning Vulkan on and off follows the channel, touches only its files, and keeps settings and Mods', async t => {
  const f = fixture(t);
  assert.equal((await f.service.status()).enabled, false);
  assert.equal(f.downloads(), 0, 'reading the state never downloads');

  await f.service.setEnabled(true);
  assert.deepEqual(f.onDisk(), f.forkDll, 'enabling Vulkan prefers the available QAQR build');
  assert.equal(f.argumentNow(), '');
  let state = await f.service.status();
  assert.equal(state.enabled, true); assert.equal(state.channel, 'fork');
  assert.equal(fs.readFileSync(path.join(f.miRoot, 'dxcompiler.dll'), 'utf8'), 'fork dxc');
  assert.equal(f.launcher().Launcher.customPreference, 'keep');
  assert.equal(f.launcher().Importers.EFMI.Importer.launch_count, 7);
  assert.equal(f.launcher().Importers.WWMI.Importer.d3d11_mode_cmd_args, '-dx11');

  await f.service.setChannel('official');
  assert.deepEqual(f.onDisk(), f.upstreamDll, 'an explicit official selection remains available');
  await f.service.setChannel('fork');
  assert.deepEqual(f.onDisk(), f.forkDll);
  assert.equal((await f.service.status()).channel, 'fork');
  assert.equal(fs.readFileSync(path.join(f.miRoot, 'dxcompiler.dll'), 'utf8'), 'fork dxc');
  assert.equal(fs.existsSync(path.join(f.miRoot, 'COPYING.txt')), false, 'licenses stay with the bundle');

  await f.service.setEnabled(false);
  assert.deepEqual(f.onDisk(), f.dx11Fork, 'the fixed channel survives the backend change');
  assert.equal(f.argumentNow(), '-force-d3d11');
  assert.equal(fs.existsSync(path.join(f.miRoot, 'dxcompiler.dll')), false);
  assert.equal(fs.existsSync(path.join(f.miRoot, 'SPIRV-Tools-shared.dll')), false);
  assert.equal(fs.readFileSync(path.join(f.miRoot, 'Mods/kept.ini'), 'utf8'), 'keep mod');
  assert.equal(f.runtime().local.kind, 'fork');

  await f.service.setEnabled(true);
  assert.deepEqual(f.onDisk(), f.forkDll, 'and the way back too');
  assert.deepEqual(fs.readdirSync(f.root).sort(), ['app', 'game', 'launcher']);
  assert(!fs.readdirSync(f.miRoot, { recursive: true }).some(name => name.includes('.qaqr-update-')));
  assert(!fs.readdirSync(f.launcherRoot).some(name => name.includes('.qaqr-update-')));
});

test('the DX11 switch hands over to the Vulkan switch instead of leaving the argument behind', async t => {
  const f = fixture(t);
  await f.service.setEnabled(true);
  assert.equal(f.runtime().local.kind, 'vulkan');
  assert.equal(f.runtime().canUseOfficial, false);
  assert.equal(f.runtime().canUseFork, false);
  assert.throws(() => f.miForks.change('endfield', 'runtime', 'official'), { code: 'vulkanActive' });
  assert.deepEqual(f.onDisk(), f.forkDll);
});

test('Unsafe Mode, a running game and an unknown DLL all stop the switch before anything changes', async t => {
  const f = fixture(t);
  f.setRunning(true);
  await assert.rejects(f.service.setEnabled(true), /game running/);
  assert.deepEqual(f.onDisk(), f.official); assert.equal(f.argumentNow(), '-force-d3d11');
  f.setRunning(false);

  const custom = f.write(path.join(f.miRoot, 'd3d11.dll'), dll('hand placed'));
  assert.equal((await f.service.status()).confirmReplace, true);
  await assert.rejects(f.service.setEnabled(true));
  assert.equal(fs.readFileSync(custom, 'utf8'), 'hand placed');
  await f.service.setEnabled(true, { confirmed: true });
  assert.deepEqual(f.onDisk(), f.forkDll);
  await f.service.setEnabled(false);

  const config = f.launcher();
  config.Importers.EFMI.Migoto.unsafe_mode = false;
  f.write(f.configFile, JSON.stringify(config));
  await assert.rejects(f.service.setEnabled(true), /Unsafe Mode/);
  assert.deepEqual(f.onDisk(), f.dx11Fork);
  assert.equal((await f.service.status()).checks.find(item => item.id === 'approval').ok, false);
});

test('a launch corrects the renderer from the DLL on disk, and refuses Vulkan without consent', async t => {
  const f = fixture(t);
  f.write(f.configFile, JSON.stringify({ ...f.launcher(), Importers: { ...f.launcher().Importers, EFMI: { ...f.launcher().Importers.EFMI, Importer: { d3d11_mode_cmd_args: '' } } } }));
  assert.deepEqual(await f.service.prepareLaunch(), { vulkan: false });
  assert.equal(f.argumentNow(), '-force-d3d11', 'a DX11 DLL must not run under the game default renderer');

  await f.service.setEnabled(true);
  const config = f.launcher();
  config.Importers.EFMI.Importer.d3d11_mode_cmd_args = '-force-d3d11';
  f.write(f.configFile, JSON.stringify(config));
  assert.deepEqual(await f.service.prepareLaunch(), { vulkan: true });
  assert.equal(f.argumentNow(), '');

  const revoked = f.launcher();
  revoked.Importers.EFMI.Migoto.unsafe_mode = false;
  f.write(f.configFile, JSON.stringify(revoked));
  await assert.rejects(f.service.prepareLaunch(), /Unsafe Mode/);
});

test('the driver check explains itself and never blocks the switch', async t => {
  const f = fixture(t, { present: { vendor: 'nvidia', value: 0 } });
  let state = await f.service.status();
  assert.equal(state.checks.find(item => item.id === 'present').ok, false);
  assert.equal(state.ready, false);
  await f.service.setEnabled(true);
  assert.equal((await f.service.status()).enabled, true);
  for (const [present, ok] of [[{ vendor: 'nvidia', value: 1 }, true], [{ vendor: 'nvidia', value: 2 }, true], [{ vendor: 'nvidia', value: null }, true], [{ vendor: 'other' }, false], [{ vendor: 'unknown' }, false]]) {
    f.setPresent(present);
    assert.equal((await f.service.status()).checks.find(item => item.id === 'present').ok, ok, JSON.stringify(present));
  }
});

test('an upstream update replaces the runtime only on the upstream channel', async t => {
  const f = fixture(t);
  await f.service.setEnabled(true);
  await f.service.setChannel('fork');
  const next = { version: '1.2.2-nhd.28', files: { ...f.info.files, 'd3d11.dll': sha(dll('vulkan next', vulkanMark)) } };
  f.setPending(next);
  await f.service.update();
  assert.deepEqual(f.onDisk(), f.forkDll);
  assert.equal(f.packages.selected().version, '1.2.2-nhd.28');
  await f.service.setChannel('official');
  assert.deepEqual(f.onDisk(), dll('vulkan next', vulkanMark));
  assert.equal((await f.service.status()).channel, 'official');
});

test('a release is read per the runtime dependency contract', () => {
  const digest = '1'.repeat(64);
  const assets = ['d3d11.dll', 'dxcompiler.dll', 'dxil.dll', 'SPIRV-Tools-shared.dll', 'unrelated.zip'].map(name => ({ name, size: 10, digest: 'sha256:' + digest }));
  const release = { tag_name: 'v1.2.2-nhd.28', assets };
  const manifest = { schema: 1, files: [{ name: 'SPIRV-Tools-shared.dll' }] };
  assert.deepEqual(Object.keys(releaseFiles(release, manifest).files), ['d3d11.dll', 'SPIRV-Tools-shared.dll']);
  assert.deepEqual(Object.keys(releaseFiles(release, {}).files), ['d3d11.dll', 'dxcompiler.dll', 'dxil.dll'], 'without a manifest the older contract applies');
  assert.equal(releaseFiles({ ...release, prerelease: true }, manifest).version, '1.2.2-nhd.28', 'a pre-release counts as the latest');
  assert.throws(() => releaseFiles({ ...release, draft: true }, manifest));
  assert.throws(() => releaseFiles({ ...release, tag_name: 'latest' }, manifest));
  assert.throws(() => releaseFiles(release, { schema: 1, files: [{ name: 'missing.dll' }] }));
  assert.throws(() => releaseFiles(release, { schema: 1, files: [{ name: '..\\evil.dll' }] }));
});

test('a rate-limited API falls back to the release page for the same assets and digests', async () => {
  const { releasePage } = require('../app/src/main/games/endfield/vulkan-packages.cjs');
  const repository = 'myparsleycat/XXMI-Libs-Package-Forked', tag = 'v1.2.2-nhd.31';
  const row = (name, digest) => `<li class="Box-row"><a href="/${repository}/releases/download/${tag}/${name}">${name}</a><span>sha256:${digest}</span></li>`;
  const pages = {
    [`https://github.com/${repository}/releases`]: `<include-fragment src="https://github.com/${repository}/releases/expanded_assets/${tag}"></include-fragment><include-fragment src="https://github.com/${repository}/releases/expanded_assets/v1.2.2-nhd.30"></include-fragment>`,
    [`https://github.com/${repository}/releases/expanded_assets/${tag}`]: row('d3d11.dll', 'a'.repeat(64)) + row('dxcompiler.dll', 'b'.repeat(64)) + row('dxil.dll', 'c'.repeat(64))
      + `<li class="Box-row"><a href="/someone/else/releases/download/${tag}/d3d11.dll">d3d11.dll</a><span>sha256:${'f'.repeat(64)}</span></li>`
  };
  const release = await releasePage(async url => pages[url] ? new Response(pages[url]) : new Response('', { status: 404 }));
  assert.deepEqual(releaseFiles(release, {}), { version: '1.2.2-nhd.31', files: { 'd3d11.dll': 'a'.repeat(64), 'dxcompiler.dll': 'b'.repeat(64), 'dxil.dll': 'c'.repeat(64) } });
  await assert.rejects(releasePage(async () => new Response('', { status: 503 })));
});

// A fix the fork released after this manager was built, and the service reading its package through it.
function withRelease(t) {
  const f = fixture(t), { loadBundleAt } = require('../app/src/main/install/mi-forks.cjs');
  const version = '1.3.3-nhd.33.18', released = path.join(f.root, 'released'), bundled = path.join(f.root, 'app/local-components/xxmi-runtime-vulkan');
  const contents = { 'd3d11.dll': dll('vulkan fork next', vulkanMark, forkMark), 'dxcompiler.dll': Buffer.from('next dxc'), 'SPIRV-Tools-shared.dll': Buffer.from('fork spirv') };
  for (const [name, bytes] of Object.entries(contents)) f.write(path.join(released, name), bytes);
  f.write(path.join(released, 'component.json'), JSON.stringify({ source: 'https://github.com/QAQ-Revival/XXMI-Libs-Vulkan', sourceCommit: 'b'.repeat(40), version, backend: 'vulkan',
    files: Object.fromEntries(Object.entries(contents).map(([name, bytes]) => [name, sha(bytes)])) }));
  const state = { directory: bundled, downloads: 0, running: false };
  const forkPackage = {
    active: () => loadBundleAt(state.directory, 'XXMI-Libs-Vulkan'), check: async () => {},
    state: () => ({ latest: version, updateAvailable: state.directory === bundled, error: null }),
    update: async () => { state.downloads++; state.directory = released; return { version, sourceCommit: 'b'.repeat(40) }; }
  };
  const service = createEfmiVulkanService({
    resolveInstallation: () => ({ launcherRoot: f.launcherRoot, miRoot: f.miRoot, gamePath: path.join(f.root, 'game/Endfield.exe') }),
    packages: f.packages, miForks: f.miForks, userName: 'qaqr-fixture', forkPackage,
    readPresent: async () => ({ vendor: 'nvidia', value: null }), assertStopped: async () => { if (state.running) throw Error('game running'); }
  });
  return { f, service, state, version, next: contents['d3d11.dll'] };
}

test('a released Vulkan fix is only kept ready while the game runs on another runtime', async t => {
  const { f, service, state, version } = withRelease(t);
  assert.equal((await service.status()).forkUpdates.updateAvailable, true);
  state.running = true;
  const result = await service.updateFork();
  assert.deepEqual([result.updated, result.applied, result.restartRequired, state.downloads], [version, false, false, 1]);
  assert.deepEqual(f.onDisk(), f.official);
  assert.equal(f.argumentNow(), '-force-d3d11');
  assert.deepEqual([result.sources.fork.version, result.forkUpdates.updateAvailable], [version, false]);
});

test('a released Vulkan fix replaces the one in use, and nothing is downloaded while the game is running', async t => {
  const { f, service, state, version, next } = withRelease(t);
  await service.setEnabled(true);
  assert.deepEqual(f.onDisk(), f.forkDll);
  state.running = true;
  await assert.rejects(service.updateFork(), /game running/);
  assert.equal(state.downloads, 0);
  assert.deepEqual(f.onDisk(), f.forkDll);
  state.running = false;
  const result = await service.updateFork();
  assert.deepEqual([result.updated, result.applied, result.restartRequired, result.channel], [version, true, true, 'fork']);
  assert.deepEqual(f.onDisk(), next);
  assert.equal(fs.readFileSync(path.join(f.miRoot, 'dxcompiler.dll'), 'utf8'), 'next dxc');
  assert.equal(f.argumentNow(), '');
  assert.equal(fs.readFileSync(path.join(f.miRoot, 'Mods/kept.ini'), 'utf8'), 'keep mod');
});
