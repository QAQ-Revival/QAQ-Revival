const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const AdmZip = require('../app/node_modules/adm-zip');
const { createEffService, loaderConfig, loaderDisabled, parseModIni, findMods, peVersion } = require('../app/src/main/games/endfield/eff.cjs');
const { readPackage, releaseInfo, newer, PROXY_MARK, PROXIES, PLUGIN_FILES, SETTINGS_FILE } = require('../app/src/main/games/endfield/eff-packages.cjs');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const proxy = name => Buffer.concat([Buffer.from(`${name} proxy `), PROXY_MARK]);
function releaseFiles(tag = 'one') {
  return new Map([
    ['d3dcompiler_47.dll', proxy('compiler ' + tag)],
    ['vulkan-1.dll', proxy('vulkan ' + tag)],
    ['plugin/eff.dll', Buffer.from('eff runtime ' + tag)],
    ['plugin/package-protocol.json', Buffer.from('{}')],
    ['plugin/LICENSE', Buffer.from('AGPL')],
    ['plugin/eff.ini', Buffer.from('[Hotkeys]\nreload=F10\n')]
  ]);
}
function fixture(t, { forkPackage } = {}) {
  const temporary = fs.realpathSync(os.tmpdir()), root = fs.mkdtempSync(path.join(temporary, 'qaqr-eff-'));
  t.after(() => { assert.equal(path.dirname(fs.realpathSync(root)), temporary); fs.rmSync(root, { recursive: true, force: true }); });
  const game = path.join(root, 'game'), state = path.join(root, 'state'), storage = path.join(root, 'data/EFF');
  const write = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, value); return file; };
  const gamePath = write(path.join(game, 'Endfield.exe'), 'Synthetic game, never executed');
  const original = write(path.join(game, 'd3dcompiler_47.dll'), 'the original compiler shipped with the game');
  let vulkan = false, running = false, files = releaseFiles(), trashed = [];
  const launches = [];
  const packages = {
    selected: () => ({ version: '2.0.12', sha256: 'a'.repeat(64) }),
    pending: () => null,
    ensure: async () => new Map(files),
    checkUpdates: async () => {},
    commit: () => {},
    state: () => ({ version: '2.0.12', available: null, updateAvailable: false, error: null })
  };
  const service = createEffService({
    resolveGame: () => ({ gamePath }),
    storageRoot: storage,
    startLoader: async info => launches.push(info),
    efmiVulkanActive: () => vulkan,
    packages,
    bundleRoots: [root],
    forkPackage: forkPackage?.(root),
    assertStopped: async () => { if (running) throw Error('game running'); },
    stateFile: path.join(state, 'state.json'),
    backupDir: path.join(state, 'backup'),
    trash: async target => { trashed.push(target); fs.rmSync(target, { recursive: true, force: true }); },
    extract: async (archive, target) => new AdmZip(archive).extractAllTo(target, true),
    systemRoot: 'C:\\Windows'
  });
  const f = {
    root, game, gamePath, storage, service, write, launches, original: fs.readFileSync(original),
    at: relative => path.join(storage, relative),
    gameAt: relative => path.join(game, relative),
    setVulkan: value => { vulkan = value; },
    setRunning: value => { running = value; },
    setFiles: value => { files = value; },
    trashed: () => trashed
  };
  writeForkBundle(f);
  return f;
}

test('the loader switch only moves the eff.dll line of [plugins]', () => {
  const text = '[general]\nlang=zh\n\n[plugins]\nhide_uid.dll=1\n';
  const off = loaderConfig(text, false);
  assert.equal(loaderDisabled(off), true);
  assert.match(off, /hide_uid\.dll=1/);
  assert.match(off, /\[plugins\]\r\neff\.dll=0\r\nhide_uid/);
  const on = loaderConfig(off, true);
  assert.equal(loaderDisabled(on), false);
  assert.doesNotMatch(on, /eff\.dll/i);
  assert.match(on, /lang=zh/);
  assert.equal(loaderConfig('', true), '');
  assert.equal(loaderDisabled(loaderConfig('', false)), true);
  // The proxies take only a literal 0 for off.
  assert.equal(loaderDisabled('[plugins]\nEFF.DLL = 0\n'), true);
  assert.equal(loaderDisabled('[other]\neff.dll=0\n[plugins]\neff.dll=1\n'), false);
});

test('Mods are found the way EFF finds them, with both disabled spellings', t => {
  const { root, write } = fixture(t);
  const mods = path.join(root, 'mods');
  write(path.join(mods, 'Laevatain/mod.ini'), '[Mod]\nformat=3\nid=Lae\nkey_switch_enabled=0\n\n[KeyStyle]\nkey=F7 ; cycle\n[KeyOther]\nkey=F7\n');
  write(path.join(mods, 'Laevatain/Hair/mod.ini.effmm-disabled'), '[Mod]\nformat=3\n');
  write(path.join(mods, 'Old/mod.ini.disable'), '[Mod]\nformat=2\n');
  write(path.join(mods, '.hidden/mod.ini'), '[Mod]\nformat=3\n');
  write(path.join(mods, 'NotAMod/readme.txt'), 'nothing');
  const found = findMods(mods);
  assert.deepEqual(found.map(mod => [mod.id, mod.enabled, mod.format]), [['Laevatain', true, '3'], ['Laevatain/Hair', false, '3'], ['Old', false, '2']]);
  assert.deepEqual(found[0].keys, ['F7']);
  assert.equal(found[0].keySwitch, false);
  assert.equal(found[0].modId, 'Lae');
  assert.deepEqual(parseModIni('\uFEFF[Mod]\r\nformat = 3\r\n'), { id: null, format: '3', keySwitch: true, keys: [] });
});

test('install, launch, toggle and uninstall keep all EFF files outside the game', async t => {
  const f = fixture(t);
  const before = fs.readdirSync(f.game);
  f.setRunning(true);
  await assert.rejects(f.service.setInstalled(true), /game running/);
  f.setRunning(false);
  await f.service.setInstalled(true);
  let state = await f.service.status();
  assert.equal(state.installed, true);
  assert.equal(state.channel, 'fork');
  assert.equal(state.ready, true);
  assert.equal(state.paths.mods, f.at('Mods'));
  assert.deepEqual(fs.readdirSync(f.game), before);
  assert.deepEqual(fs.readFileSync(f.gameAt('d3dcompiler_47.dll')), f.original);
  assert.ok(fs.existsSync(f.at('EFFLoader.exe')));
  assert.ok(fs.existsSync(f.at('eff.ini')));
  assert.equal((await f.service.prepareLaunch()).watching, true);
  assert.equal(f.launches[0].dll, f.at('eff.dll'));
  assert.equal(f.launches[0].gamePath, f.gamePath);
  assert.equal(fs.readFileSync(f.at('.launch-request'), 'utf8'), f.launches[0].request);
  await f.service.setEnabled(false);
  assert.equal(fs.existsSync(f.at('.launch-request')), false);
  await f.service.prepareLaunch();
  assert.equal(f.launches.length, 1);
  await f.service.setEnabled(true);
  f.setVulkan(true);
  await f.service.prepareLaunch();
  assert.equal(f.launches.length, 2, 'the external loader is independent of the EFMI backend');
  assert.deepEqual(fs.readdirSync(f.game), before);
  await f.service.setInstalled(false);
  assert.equal(fs.existsSync(f.at('eff.dll')), false);
  assert.equal(fs.existsSync(f.at('EFFLoader.exe')), false);
  assert.equal(fs.existsSync(f.at('eff.ini')), true);
  assert.equal(fs.existsSync(f.at('Mods')), true);
  assert.deepEqual(fs.readdirSync(f.game), before);
});

function legacyInstall(f, { backup = true } = {}) {
  for (const [name, bytes] of releaseFiles()) f.write(f.gameAt(name), bytes);
  f.write(f.gameAt('plugin/applepie_manager_config.txt'), '[plugins]\neff.dll=0\n');
  f.write(f.gameAt('plugin/mods/佩丽卡/礼服/mod.ini.disable'), '[Mod]\nformat=3\n');
  f.write(f.gameAt('plugin/mods/佩丽卡/礼服/body.effres'), 'mesh payload');
  const key = sha(Buffer.from(path.resolve(f.game).toLowerCase())).slice(0, 16);
  f.write(path.join(f.root, 'state/state.json'), JSON.stringify({ games: { [key]: { backups: { 'd3dcompiler_47.dll': sha(f.original) } } } }));
  if (backup) f.write(path.join(f.root, 'state/backup', key, 'd3dcompiler_47.dll'), f.original);
}

test('legacy Mods, settings and disabled state migrate and original game files are restored', async t => {
  const f = fixture(t);
  legacyInstall(f);
  assert.equal((await f.service.status()).migrationPending, true);
  f.setRunning(true);
  await assert.rejects(f.service.sync(), /game running/);
  assert.ok(fs.existsSync(f.gameAt('plugin/mods/佩丽卡/礼服/mod.ini.disable')));
  f.setRunning(false);
  await f.service.sync();
  const state = await f.service.status();
  assert.equal(state.enabled, false);
  assert.equal(state.installed, true);
  assert.equal(state.migrationPending, false);
  assert.deepEqual(fs.readdirSync(f.game).sort(), ['Endfield.exe', 'd3dcompiler_47.dll']);
  assert.deepEqual(fs.readFileSync(f.gameAt('d3dcompiler_47.dll')), f.original);
  assert.equal(fs.readFileSync(f.at('Mods/佩丽卡/礼服/body.effres'), 'utf8'), 'mesh payload');
  assert.equal(f.service.characterMods('佩丽卡')[0].enabled, false);
  assert.equal((await f.service.sync()).changed, false);
});

test('migration refuses conflicting Mods or invalid game-file backups before changing the game', async t => {
  for (const conflict of [false, true]) {
    const f = fixture(t);
    legacyInstall(f, { backup: conflict });
    if (conflict) f.write(f.at('Mods/佩丽卡/礼服/body.effres'), 'newer mesh');
    await assert.rejects(f.service.sync(), conflict ? /conflicts/ : /备份/);
    assert.ok(fs.existsSync(f.gameAt('plugin/mods/佩丽卡/礼服/mod.ini.disable')));
    assert.ok(fs.readFileSync(f.gameAt('d3dcompiler_47.dll')).includes(PROXY_MARK));
    assert.equal(fs.existsSync(f.at('eff.dll')), false);
    if (conflict) assert.equal(fs.readFileSync(f.at('Mods/佩丽卡/礼服/body.effres'), 'utf8'), 'newer mesh');
  }
});

test('shared third-party proxies are not silently removed during EFF migration', async t => {
  const f = fixture(t);
  legacyInstall(f);
  f.write(f.gameAt('plugin/other.dll'), 'another plugin');
  await assert.rejects(f.service.sync(), /other.dll/);
  assert.ok(fs.readFileSync(f.gameAt('d3dcompiler_47.dll')).includes(PROXY_MARK));
  assert.ok(fs.existsSync(f.gameAt('plugin/other.dll')));
});

test('incompatible upstream runtimes are refused without changing the managed installation', async t => {
  const f = fixture(t);
  await f.service.setInstalled(true);
  const before = fs.readFileSync(f.at('eff.dll'));
  await assert.rejects(f.service.setChannel('official'), /外部数据目录/);
  assert.deepEqual(fs.readFileSync(f.at('eff.dll')), before);
  f.write(f.at('eff.dll'), 'an unrecognized build');
  assert.equal((await f.service.status()).channel, 'other');
  assert.equal((await f.service.status()).checks.find(item => item.id === 'loader').ok, false);
  await f.service.setChannel('fork');
  assert.equal((await f.service.status()).channel, 'fork');
});

test('Mods are switched by renaming mod.ini, imported from folders and archives, and removed to the bin', async t => {
  const f = fixture(t);
  await f.service.setInstalled(true);
  const source = path.join(f.root, 'source/Perlica');
  f.write(path.join(source, 'mod.ini'), '[Mod]\nformat=3\n');
  f.write(path.join(source, 'meshes/body.effres'), 'mesh');
  assert.equal((await f.service.importMod(source)).id, 'Perlica');
  assert.equal((await f.service.importMod(source)).id, 'Perlica (2)');
  const zip = new AdmZip();
  zip.addFile('Wrapped/mod.ini', Buffer.from('[Mod]\nformat=3\n'));
  zip.addFile('Wrapped/textures/a.dds', Buffer.from('dds'));
  const archive = path.join(f.root, 'Wrapped.zip');
  zip.writeZip(archive);
  assert.equal((await f.service.importMod(archive)).id, 'Wrapped');
  const flat = new AdmZip();
  flat.addFile('mod.ini', Buffer.from('[Mod]\nformat=3\n'));
  const flatArchive = path.join(f.root, 'Flat Mod.zip');
  flat.writeZip(flatArchive);
  assert.equal((await f.service.importMod(flatArchive)).id, 'Flat Mod');
  const empty = new AdmZip();
  empty.addFile('readme.txt', Buffer.from('no mod'));
  const emptyArchive = path.join(f.root, 'empty.zip');
  empty.writeZip(emptyArchive);
  await assert.rejects(f.service.importMod(emptyArchive), /mod\.ini/);
  // Nothing of a failed import is left where EFF or the next import would see it.
  assert.deepEqual(fs.readdirSync(f.storage).filter(name => name.startsWith('.')), []);

  let list = f.service.listMods();
  assert.deepEqual(list.mods.map(mod => [mod.id, mod.enabled]), [['Flat Mod', true], ['Perlica', true], ['Perlica (2)', true], ['Wrapped', true]]);
  f.service.setModEnabled('Perlica', false);
  assert.ok(fs.existsSync(f.at('Mods/Perlica/mod.ini.effmm-disabled')));
  assert.equal(fs.existsSync(f.at('Mods/Perlica/mod.ini')), false);
  f.service.setModEnabled('Perlica', true);
  assert.ok(fs.existsSync(f.at('Mods/Perlica/mod.ini')));
  fs.renameSync(f.at('Mods/Wrapped/mod.ini'), f.at('Mods/Wrapped/mod.ini.disable'));
  assert.equal(f.service.listMods().mods.find(mod => mod.id === 'Wrapped').enabled, false);
  f.service.setModEnabled('Wrapped', true);
  assert.ok(fs.existsSync(f.at('Mods/Wrapped/mod.ini')));
  assert.throws(() => f.service.setModEnabled('../../Endfield.exe', false), /Mod/);
  assert.throws(() => f.service.setModEnabled('Missing', true), /Mod/);

  await f.service.removeMod('Perlica (2)');
  assert.deepEqual(f.trashed(), [f.at('Mods/Perlica (2)')]);
  list = f.service.listMods();
  assert.equal(list.mods.length, 3);
});

test('release packages are read from the documented files only', () => {
  const zip = new AdmZip();
  for (const [name, bytes] of releaseFiles()) zip.addFile(name, bytes);
  zip.addFile('plugin/mods/', Buffer.alloc(0));
  zip.addFile('extra/tool.exe', Buffer.from('not taken'));
  const files = readPackage(zip.toBuffer());
  assert.deepEqual([...files.keys()].sort(), ['d3dcompiler_47.dll', 'plugin/LICENSE', 'plugin/eff.dll', 'plugin/eff.ini', 'plugin/package-protocol.json', 'vulkan-1.dll']);
  const broken = new AdmZip();
  broken.addFile('plugin/eff.dll', Buffer.from('x'));
  broken.addFile('plugin/package-protocol.json', Buffer.from('{}'));
  broken.addFile('d3dcompiler_47.dll', Buffer.from('not a proxy'));
  broken.addFile('vulkan-1.dll', proxy('v'));
  assert.throws(() => readPackage(broken.toBuffer()));
  const digest = 'b'.repeat(64);
  assert.deepEqual(releaseInfo({ tag_name: 'v2.0.13', prerelease: true, assets: [{ name: 'EFF_v2.0.13_dll.zip', size: 10, digest: 'sha256:' + digest }] }), { version: '2.0.13', sha256: digest });
  assert.equal(releaseInfo({ tag_name: 'v2.0.13', assets: [{ name: 'EFF_Shared_Native_Tools_v2.0.13.zip', digest: 'sha256:' + digest }] }), null);
  assert.equal(releaseInfo({ tag_name: 'v2.0.12-hotfix.2', assets: [] }), null);
  assert.equal(newer('2.0.13', '2.0.12'), true);
  assert.equal(newer('2.0.12', '2.0.12'), false);
  assert.equal(sha(Buffer.from('')).length, 64);
});

// The fixed part of a version resource, which is all peVersion reads.
function versionResource(file, product = file) {
  const bytes = Buffer.alloc(24);
  bytes.writeUInt32LE(0xfeef04bd, 0);
  bytes.writeUInt32LE(0x00010000, 4);
  for (const [offset, [a, b, c, d]] of [[8, file], [16, product]]) {
    bytes.writeUInt32LE(((a << 16) | b) >>> 0, offset);
    bytes.writeUInt32LE(((c << 16) | d) >>> 0, offset + 4);
  }
  return bytes;
}
// What qaqr/build.cjs of QAQ-Revival/EFF writes to local-components/eff.
function writeForkBundle(f, { source = 'https://github.com/QAQ-Revival/EFF', commit = 'c'.repeat(40) } = {}) {
  const directory = path.join(f.root, 'local-components/eff');
  const files = releaseFiles('fork');
  files.set('plugin/eff.dll', Buffer.concat([Buffer.from('eff runtime fork EFF_ExternalData_v1 '), versionResource([2, 0, 12, 6])]));
  files.set('EFFLoader.exe', Buffer.from('synthetic external loader'));
  files.set('plugin/THIRD_PARTY_NOTICES', Buffer.from('notices'));
  const digests = {};
  for (const [relative, bytes] of files) {
    f.write(path.join(directory, relative), bytes);
    digests[relative] = sha(bytes);
  }
  f.write(path.join(directory, 'component.json'), JSON.stringify({ source, sourceCommit: commit, version: '2.0.12.6', files: digests }));
  return { directory, files };
}

test('the managed fork is validated, repairable and keeps player settings', async t => {
  const f = fixture(t), fork = writeForkBundle(f);
  assert.deepEqual((await f.service.status()).sources.fork, { version: '2.0.12.6', build: 'c'.repeat(12), localBuild: false });
  await f.service.setInstalled(true);
  f.write(f.at('eff.ini'), 'player settings');
  await f.service.setChannel('fork');
  assert.equal(fs.readFileSync(f.at('eff.ini'), 'utf8'), 'player settings');
  assert.equal((await f.service.status()).version, '2.0.12.6');
  fs.appendFileSync(path.join(fork.directory, 'plugin/eff.dll'), 'tampered');
  assert.equal((await f.service.status()).sources.fork, null);
  assert.equal((await f.service.status()).channel, 'fork');
  await assert.rejects(f.service.setChannel('fork'), /修复版/);
});

test('a fork bundle from another repository or without a full source commit is ignored', async t => {
  for (const options of [{ source: 'https://github.com/BakaMai/EFF-HotFix' }, { commit: 'c'.repeat(12) }]) {
    const f = fixture(t);
    writeForkBundle(f, options);
    assert.equal((await f.service.status()).sources.fork, null);
  }
});

test('the EFF version shows the QAQR revision as a fourth part only when there is one', () => {
  assert.equal(peVersion(Buffer.concat([Buffer.from('MZ'), versionResource([2, 0, 12, 6])])), '2.0.12.6');
  assert.equal(peVersion(versionResource([2, 0, 12, 0])), '2.0.12');
  assert.equal(peVersion(Buffer.from('no version resource')), null);
});

test('the fork build packages exactly the files QAQR installs', () => {
  const { LAYOUT } = require('../native/eff/qaqr/build.cjs');
  assert.deepEqual(Object.keys(LAYOUT).sort(), ['EFFLoader.exe', ...PROXIES, ...PLUGIN_FILES, SETTINGS_FILE].sort());
});

// A fix the fork released after this manager was built, and the service reading its package through it.
function withRelease(t) {
  const { loadBundleAt } = require('../app/src/main/install/mi-forks.cjs');
  const state = { directory: null, downloads: 0 }, version = '2.0.12.7';
  const f = fixture(t, { forkPackage: root => ({
    active: () => loadBundleAt(state.directory || path.join(root, 'local-components/eff'), 'EFF'), check: async () => {},
    state: held => ({ latest: version, updateAvailable: held !== version, error: null }),
    update: async () => { state.downloads++; state.directory = path.join(root, 'released'); return { version, sourceCommit: 'd'.repeat(40) }; }
  }) });
  const files = new Map(writeForkBundle(f).files), digests = {};
  files.set('plugin/eff.dll', Buffer.concat([Buffer.from('eff runtime next EFF_ExternalData_v1 '), versionResource([2, 0, 12, 7])]));
  for (const [relative, bytes] of files) { f.write(path.join(f.root, 'released', relative), bytes); digests[relative] = sha(bytes); }
  f.write(path.join(f.root, 'released/component.json'), JSON.stringify({ source: 'https://github.com/QAQ-Revival/EFF', sourceCommit: 'd'.repeat(40), version, files: digests }));
  return { f, state, version, next: files.get('plugin/eff.dll') };
}

test('a released EFF fix is kept for the next install when EFF is not installed', async t => {
  const { f, state, version } = withRelease(t);
  assert.equal((await f.service.status()).forkUpdates.updateAvailable, true);
  f.setRunning(true);
  const result = await f.service.updateFork();
  assert.deepEqual([result.updated, result.applied, result.restartRequired, state.downloads], [version, false, false, 1]);
  assert.equal(fs.existsSync(f.at('eff.dll')), false);
  assert.deepEqual([result.sources.fork.version, result.forkUpdates.updateAvailable, result.installed], [version, false, false]);
});

test('a released EFF fix replaces the installed one, and nothing is downloaded while the game is running', async t => {
  const { f, state, version, next } = withRelease(t);
  await f.service.setInstalled(true);
  f.write(f.at('eff.ini'), 'player settings');
  assert.deepEqual([(await f.service.status()).channel, (await f.service.status()).version], ['fork', '2.0.12.6']);
  f.setRunning(true);
  await assert.rejects(f.service.updateFork(), /game running/);
  assert.equal(state.downloads, 0);
  assert.equal((await f.service.status()).version, '2.0.12.6');
  f.setRunning(false);
  const result = await f.service.updateFork();
  assert.deepEqual([result.updated, result.applied, result.restartRequired, result.channel, result.version], [version, true, true, 'fork', version]);
  assert.deepEqual(fs.readFileSync(f.at('eff.dll')), next);
  assert.equal(fs.readFileSync(f.at('eff.ini'), 'utf8'), 'player settings');
});
