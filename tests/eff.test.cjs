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
function fixture(t) {
  const temporary = fs.realpathSync(os.tmpdir()), root = fs.mkdtempSync(path.join(temporary, 'qaqr-eff-'));
  t.after(() => { assert.equal(path.dirname(fs.realpathSync(root)), temporary); fs.rmSync(root, { recursive: true, force: true }); });
  const game = path.join(root, 'game'), state = path.join(root, 'state');
  const write = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, value); return file; };
  const gamePath = write(path.join(game, 'Endfield.exe'), 'Synthetic game, never executed');
  const original = write(path.join(game, 'd3dcompiler_47.dll'), 'the original compiler shipped with the game');
  let vulkan = false, running = false, files = releaseFiles(), trashed = [];
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
    efmiVulkanActive: () => vulkan,
    packages,
    bundleRoots: [root],
    assertStopped: async () => { if (running) throw Error('game running'); },
    stateFile: path.join(state, 'state.json'),
    backupDir: path.join(state, 'backup'),
    trash: async target => { trashed.push(target); fs.rmSync(target, { recursive: true, force: true }); },
    extract: async (archive, target) => new AdmZip(archive).extractAllTo(target, true),
    systemRoot: 'C:\\Windows'
  });
  return {
    root, game, gamePath, service, write, original: fs.readFileSync(original),
    at: relative => path.join(game, relative),
    setVulkan: value => { vulkan = value; },
    setRunning: value => { running = value; },
    setFiles: value => { files = value; },
    trashed: () => trashed
  };
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

test('installing backs up the game compiler, keeps the player settings and follows the EFMI backend', async t => {
  const f = fixture(t);
  f.write(f.at('plugin/eff.ini'), 'player settings');
  f.write(f.at('plugin/hide_uid.dll'), 'another plugin');
  let state = await f.service.status();
  assert.equal(state.installed, false);
  assert.deepEqual(state.checks.map(item => [item.id, item.ok]), [['game', true], ['system', true]]);
  f.setRunning(true);
  await assert.rejects(f.service.setInstalled(true), /game running/);
  assert.deepEqual(fs.readFileSync(f.at('d3dcompiler_47.dll')), f.original);
  f.setRunning(false);
  assert.equal((await f.service.setInstalled(true)).success, true);
  assert.ok(fs.readFileSync(f.at('d3dcompiler_47.dll')).includes(PROXY_MARK));
  assert.ok(fs.readFileSync(f.at('vulkan-1.dll')).includes(PROXY_MARK));
  assert.equal(fs.readFileSync(f.at('plugin/eff.ini'), 'utf8'), 'player settings');
  assert.ok(fs.statSync(f.at('plugin/mods')).isDirectory());
  state = await f.service.status();
  assert.equal(state.installed, true);
  assert.equal(state.enabled, true);
  assert.equal(state.channel, 'official');
  assert.equal(state.ready, true);
  assert.deepEqual(state.otherPlugins, ['hide_uid.dll']);

  // With the Vulkan runtime of EFMI, only the compiler proxy may stay.
  f.setVulkan(true);
  state = await f.service.status();
  assert.equal(state.checks.find(item => item.id === 'loader').ok, false);
  assert.equal((await f.service.prepareLaunch()).changed, true);
  assert.equal(fs.existsSync(f.at('vulkan-1.dll')), false);
  assert.ok(fs.readFileSync(f.at('d3dcompiler_47.dll')).includes(PROXY_MARK));
  state = await f.service.status();
  assert.equal(state.checks.find(item => item.id === 'loader').ok, true);
  assert.equal(state.checks.find(item => item.id === 'backend').ok, false);
  assert.equal((await f.service.prepareLaunch()).changed, false);

  // A game update that put the original back is repaired before launch, and the newer original is the one kept.
  f.setVulkan(false);
  f.write(f.at('d3dcompiler_47.dll'), 'a newer original compiler');
  assert.equal((await f.service.prepareLaunch()).changed, true);
  assert.ok(fs.existsSync(f.at('vulkan-1.dll')));
  assert.ok(fs.readFileSync(f.at('d3dcompiler_47.dll')).includes(PROXY_MARK));

  assert.equal((await f.service.setEnabled(false)).success, true);
  assert.equal(loaderDisabled(fs.readFileSync(f.at('plugin/applepie_manager_config.txt'), 'utf8')), true);
  assert.equal((await f.service.status()).enabled, false);
  await f.service.setEnabled(true);
  assert.equal(fs.existsSync(f.at('plugin/applepie_manager_config.txt')), false);

  await f.service.setInstalled(false);
  assert.equal(fs.readFileSync(f.at('d3dcompiler_47.dll'), 'utf8'), 'a newer original compiler');
  assert.equal(fs.existsSync(f.at('vulkan-1.dll')), false);
  assert.equal(fs.existsSync(f.at('plugin/eff.dll')), false);
  assert.equal(fs.readFileSync(f.at('plugin/eff.ini'), 'utf8'), 'player settings');
  assert.equal(fs.readFileSync(f.at('plugin/hide_uid.dll'), 'utf8'), 'another plugin');
  assert.ok(fs.existsSync(f.at('plugin/mods')));
  assert.equal((await f.service.status()).installed, false);
});

test('a build installed elsewhere is reported as unrecognized and the missing settings file is written', async t => {
  const f = fixture(t);
  await f.service.setInstalled(true);
  assert.equal(fs.readFileSync(f.at('plugin/eff.ini'), 'utf8'), '[Hotkeys]\nreload=F10\n');
  f.write(f.at('plugin/eff.dll'), 'a hotfix dropped in by hand');
  assert.equal((await f.service.status()).channel, 'other');
  // Reinstalling the official build brings the recognized runtime back.
  await f.service.setChannel('official');
  assert.equal((await f.service.status()).channel, 'official');
  await assert.rejects(f.service.setChannel('fork'), /修复版/);
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
  assert.deepEqual(fs.readdirSync(f.at('plugin')).filter(name => name.startsWith('.')), []);

  let list = f.service.listMods();
  assert.deepEqual(list.mods.map(mod => [mod.id, mod.enabled]), [['Flat Mod', true], ['Perlica', true], ['Perlica (2)', true], ['Wrapped', true]]);
  f.service.setModEnabled('Perlica', false);
  assert.ok(fs.existsSync(f.at('plugin/mods/Perlica/mod.ini.effmm-disabled')));
  assert.equal(fs.existsSync(f.at('plugin/mods/Perlica/mod.ini')), false);
  f.service.setModEnabled('Perlica', true);
  assert.ok(fs.existsSync(f.at('plugin/mods/Perlica/mod.ini')));
  fs.renameSync(f.at('plugin/mods/Wrapped/mod.ini'), f.at('plugin/mods/Wrapped/mod.ini.disable'));
  assert.equal(f.service.listMods().mods.find(mod => mod.id === 'Wrapped').enabled, false);
  f.service.setModEnabled('Wrapped', true);
  assert.ok(fs.existsSync(f.at('plugin/mods/Wrapped/mod.ini')));
  assert.throws(() => f.service.setModEnabled('../../Endfield.exe', false), /Mod/);
  assert.throws(() => f.service.setModEnabled('Missing', true), /Mod/);

  await f.service.removeMod('Perlica (2)');
  assert.deepEqual(f.trashed(), [f.at('plugin/mods/Perlica (2)')]);
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
  files.set('plugin/eff.dll', Buffer.concat([Buffer.from('eff runtime fork '), versionResource([2, 0, 12, 6])]));
  files.set('plugin/THIRD_PARTY_NOTICES', Buffer.from('notices'));
  const digests = {};
  for (const [relative, bytes] of files) {
    f.write(path.join(directory, relative), bytes);
    digests[relative] = sha(bytes);
  }
  f.write(path.join(directory, 'component.json'), JSON.stringify({ source, sourceCommit: commit, version: '2.0.12.6', files: digests }));
  return { directory, files };
}

test('the QAQR fork build is offered from its bundle and switched to and from, keeping the player settings', async t => {
  const f = fixture(t);
  const fork = writeForkBundle(f);
  let state = await f.service.status();
  assert.deepEqual(state.sources.fork, { version: '2.0.12.6', build: 'c'.repeat(12) });
  await f.service.setInstalled(true);
  f.write(f.at('plugin/eff.ini'), 'player settings');
  assert.equal((await f.service.status()).channel, 'official');

  assert.equal((await f.service.setChannel('fork')).channel, 'fork');
  state = await f.service.status();
  assert.equal(state.channel, 'fork');
  assert.equal(state.version, '2.0.12.6');
  for (const relative of ['d3dcompiler_47.dll', 'vulkan-1.dll', 'plugin/eff.dll', 'plugin/THIRD_PARTY_NOTICES']) assert.deepEqual(fs.readFileSync(f.at(relative)), fork.files.get(relative));
  assert.equal(fs.readFileSync(f.at('plugin/eff.ini'), 'utf8'), 'player settings');

  // The proxies follow the EFMI backend from the fork's own files.
  f.setVulkan(true);
  assert.equal((await f.service.prepareLaunch()).changed, true);
  assert.equal(fs.existsSync(f.at('vulkan-1.dll')), false);
  f.setVulkan(false);
  assert.equal((await f.service.prepareLaunch()).changed, true);
  assert.deepEqual(fs.readFileSync(f.at('vulkan-1.dll')), fork.files.get('vulkan-1.dll'));
  assert.equal((await f.service.status()).channel, 'fork');

  await f.service.setChannel('official');
  state = await f.service.status();
  assert.equal(state.channel, 'official');
  assert.deepEqual(fs.readFileSync(f.at('plugin/eff.dll')), releaseFiles().get('plugin/eff.dll'));
  assert.equal(fs.readFileSync(f.at('plugin/eff.ini'), 'utf8'), 'player settings');

  // A bundle whose files no longer match its manifest is not offered, and what it installed is still known.
  await f.service.setChannel('fork');
  fs.appendFileSync(path.join(fork.directory, 'plugin/eff.dll'), 'tampered');
  state = await f.service.status();
  assert.equal(state.sources.fork, null);
  assert.equal(state.channel, 'fork');
  await f.service.setChannel('official');
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
  assert.deepEqual(Object.keys(LAYOUT).sort(), [...PROXIES, ...PLUGIN_FILES, SETTINGS_FILE].sort());
});
