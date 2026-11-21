const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { createComponentUpdates, compareVersions, releaseInfo } = require('../app/src/main/install/component-updates.cjs');
const { createMiForksService, loadBundle, runtimePackage, FORK_MARK, VULKAN_MARK } = require('../app/src/main/install/mi-forks.cjs');
const { createZip } = require('../tools/publish-component.cjs');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const REPOSITORY = 'QAQ-Revival/XXMI-Libs-Package';

// Enough of a DLL for QAQR to identify: the fork's repository and a version resource. Never loaded.
function dll(version, { mark = FORK_MARK, salt = '' } = {}) {
  const [major, minor, revision, build] = version.split('.').map(Number), info = Buffer.alloc(16);
  info.writeUInt32LE(0xfeef04bd, 0);
  info.writeUInt32LE(major * 65536 + minor, 8);
  info.writeUInt32LE(revision * 65536 + build, 12);
  return Buffer.concat([Buffer.from('MZ runtime fixture ' + salt), mark, info]);
}
// A package as the fork's build writes it, and the two files its release carries.
function build(version, commit, { runtime = dll(version), source = 'https://github.com/' + REPOSITORY, hashes = [], manifestVersion = version, extra = {} } = {}) {
  const contents = { 'd3d11.dll': runtime, 'LICENSE.GPL.txt': Buffer.from('license'), 'source.zip': Buffer.from('source of ' + commit) };
  const manifest = Buffer.from(JSON.stringify({ source, sourceCommit: commit, activityProtocol: 1, compatibleRuntimeHashes: hashes, version: manifestVersion,
    files: Object.fromEntries(Object.entries(contents).map(([name, bytes]) => [name, sha(bytes)])), ...extra }, null, 2));
  return { version, commit, contents, manifest, zip: createZip([{ name: 'component.json', bytes: manifest }, ...Object.entries(contents).map(([name, bytes]) => ({ name, bytes }))]) };
}
function fixture(t, { bundledVersion = '1.3.3.14' } = {}) {
  const temporary = fs.realpathSync(os.tmpdir()), root = fs.mkdtempSync(path.join(temporary, 'qaqr-component-updates-'));
  t.after(() => { assert.equal(path.dirname(fs.realpathSync(root)), temporary); fs.rmSync(root, { recursive: true, force: true }); });
  const app = path.join(root, 'app'), store = path.join(root, 'data/Components/xxmi-runtime');
  const write = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, value); };
  function install(pack, directory = path.join(app, 'local-components/xxmi-runtime')) {
    fs.rmSync(directory, { recursive: true, force: true });
    for (const [name, bytes] of Object.entries(pack.contents)) write(path.join(directory, name), bytes);
    write(path.join(directory, 'component.json'), pack.manifest);
  }
  const bundled = build(bundledVersion, 'a'.repeat(40), { hashes: [sha('official')] });
  install(bundled);
  // GitHub as the manager sees it: the release list, the release page, and the assets.
  const network = { releases: [], api: true, page: true, assets: true, requests: [], tamper: null };
  const asset = (name, bytes) => ({ name, size: bytes.length, digest: 'sha256:' + sha(bytes) });
  const release = (pack, overrides = {}) => ({ tag_name: 'xxmi-runtime-' + pack.version, draft: false, prerelease: false, pack,
    assets: [asset('component.json', pack.manifest), asset('xxmi-runtime.zip', pack.zip)], ...overrides });
  async function fetchImpl(address) {
    const url = String(address);
    network.requests.push(url);
    if (url === `https://api.github.com/repos/${REPOSITORY}/releases?per_page=10`) {
      if (!network.api) return new Response('rate limited', { status: 403 });
      return Response.json(network.releases.map(({ pack, ...rest }) => rest));
    }
    if (url === `https://github.com/${REPOSITORY}/releases`) {
      if (!network.page) throw Error('offline');
      return new Response(network.releases.map(item => `<a href="/${REPOSITORY}/releases/expanded_assets/${item.tag_name}">`).join('\n'));
    }
    const listing = /\/releases\/expanded_assets\/(.+)$/.exec(url);
    if (listing) {
      const found = network.releases.find(item => item.tag_name === listing[1]);
      return new Response(found.assets.map(item => `<li><a href="/${REPOSITORY}/releases/download/${found.tag_name}/${item.name}">${item.name}</a><span>${item.digest}</span></li>`).join('\n'));
    }
    const file = /\/releases\/download\/([^/]+)\/([^/]+)$/.exec(url);
    const found = file && network.releases.find(item => item.tag_name === file[1]);
    if (!found || !network.assets) return new Response('missing', { status: 404 });
    const bytes = file[2] === 'component.json' ? found.pack.manifest : found.pack.zip;
    return new Response(network.tamper?.[file[2]] || bytes);
  }
  let clock = Date.parse('2026-11-21T12:00:00Z');
  const create = () => createComponentUpdates({
    name: 'xxmi-runtime', repository: REPOSITORY, storeDir: store,
    bundled: () => loadBundle([app], 'xxmi-runtime', 'XXMI-Libs-Package'),
    load: runtimePackage.load, versionOf: runtimePackage.version, fetch: fetchImpl, now: () => clock
  });
  const updates = create();
  const version = () => runtimePackage.version(updates.active());
  const stored = () => fs.existsSync(store) ? fs.readdirSync(store).sort() : [];
  return { root, app, store, write, install, bundled, network, release, create, updates, version, stored, advance: ms => { clock += ms; } };
}

test('versions compare by their numbers, upstream suffixes included', () => {
  assert.equal(compareVersions('1.3.3.15', '1.3.3.14'), 1);
  assert.equal(compareVersions('1.3.4.2', '1.3.3.40'), 1);
  assert.equal(compareVersions('1.3.3.9', '1.3.3.10'), -1);
  assert.equal(compareVersions('1.2.2-nhd.31.1', '1.2.2-nhd.30.13'), 1);
  assert.equal(compareVersions('1.3.3.14', '1.3.3.14'), 0);
});

test('a release counts only with both files, their published digests and the package tag', () => {
  const digest = 'sha256:' + 'a'.repeat(64), assets = [{ name: 'component.json', size: 900, digest }, { name: 'xxmi-runtime.zip', size: 9000, digest }];
  assert.equal(releaseInfo({ tag_name: 'xxmi-runtime-1.3.3.15', assets }, 'xxmi-runtime').version, '1.3.3.15');
  assert.equal(releaseInfo({ tag_name: 'xxmi-runtime-1.3.3.15', draft: true, assets }, 'xxmi-runtime'), null);
  assert.equal(releaseInfo({ tag_name: 'v1.3.4', assets }, 'xxmi-runtime'), null, 'an upstream-style release in the fork is not a package');
  assert.equal(releaseInfo({ tag_name: 'xxmi-runtime-vulkan-1.2.2', assets }, 'xxmi-runtime'), null);
  assert.equal(releaseInfo({ tag_name: 'xxmi-runtime-1.3.3.15', assets: assets.slice(0, 1) }, 'xxmi-runtime'), null);
  assert.equal(releaseInfo({ tag_name: 'xxmi-runtime-1.3.3.15', assets: [assets[0], { ...assets[1], digest: null }] }, 'xxmi-runtime'), null);
  assert.equal(releaseInfo({ tag_name: 'xxmi-runtime-1.3.3.15', assets: [assets[0], { ...assets[1], size: 200 * 1024 * 1024 }] }, 'xxmi-runtime'), null);
});

test('a newer release is found, downloaded, verified and used in place of the bundled copy', async t => {
  const f = fixture(t), next = build('1.3.3.15', 'b'.repeat(40), { hashes: [sha('official'), sha('official next')] });
  assert.deepEqual(f.updates.state(f.version()), { checkedAt: null, error: null, latest: null, build: null, updateAvailable: false });
  // Pre-releases and unrelated releases sit in the same list.
  f.network.releases = [{ tag_name: 'v1.3.4', draft: false, assets: [] }, f.release(next, { prerelease: true }), f.release(f.bundled)];
  await f.updates.check();
  const found = f.updates.state(f.version());
  assert.deepEqual({ latest: found.latest, build: found.build, updateAvailable: found.updateAvailable, error: found.error }, { latest: '1.3.3.15', build: 'b'.repeat(12), updateAvailable: true, error: null });
  assert.equal(f.version(), '1.3.3.14', 'finding a release changes nothing on disk');
  assert.deepEqual(f.stored(), ['catalog.json']);

  assert.deepEqual(await f.updates.update(f.version()), { version: '1.3.3.15', sourceCommit: 'b'.repeat(40) });
  const active = f.updates.active();
  assert.equal(active.origin, 'downloaded');
  assert.equal(f.version(), '1.3.3.15');
  assert.deepEqual(fs.readFileSync(active.files['d3d11.dll']), next.contents['d3d11.dll']);
  assert.deepEqual(active.manifest.compatibleRuntimeHashes, [sha('official'), sha('official next')], 'newly accepted official runtimes arrive with the package');
  assert.deepEqual(f.stored(), ['b'.repeat(40), 'catalog.json']);
  assert.deepEqual(fs.readFileSync(path.join(f.app, 'local-components/xxmi-runtime/d3d11.dll')), f.bundled.contents['d3d11.dll'], 'the installation is never written');
  assert.equal(f.updates.state(f.version()).updateAvailable, false);
  await assert.rejects(f.updates.update(f.version()), { code: 'nothingNew' });

  // What was found and what was downloaded both survive a restart.
  const restarted = f.create();
  assert.equal(runtimePackage.version(restarted.active()), '1.3.3.15');
  assert.equal(restarted.state('1.3.3.15').latest, '1.3.3.15');

  // The next release replaces the downloaded package; one is kept.
  const later = build('1.3.3.16', 'c'.repeat(40));
  f.network.releases.unshift(f.release(later));
  f.advance(5 * 60 * 1000);
  await f.updates.check();
  await f.updates.update(f.version());
  assert.equal(f.version(), '1.3.3.16');
  assert.deepEqual(f.stored(), ['catalog.json', 'c'.repeat(40)]);
});

test('a manager update that ships the same or a later build takes over again', async t => {
  const f = fixture(t), next = build('1.3.3.15', 'b'.repeat(40));
  f.network.releases = [f.release(next)];
  await f.updates.check();
  await f.updates.update(f.version());
  assert.equal(f.updates.active().origin, 'downloaded');
  f.install(build('1.3.3.15', 'b'.repeat(40)));
  assert.equal(f.updates.active().origin, 'bundled', 'the same build is read from the installation');
  f.install(build('1.3.4.1', 'd'.repeat(40)));
  assert.equal(f.updates.active().origin, 'bundled');
  assert.equal(f.version(), '1.3.4.1');
  assert.equal(f.updates.state(f.version()).updateAvailable, false, 'an older release is never offered');
});

test('without the API the release page gives the same answer; without a network nothing changes', async t => {
  const f = fixture(t), next = build('1.3.3.15', 'b'.repeat(40));
  f.network.releases = [f.release(next)];
  f.network.api = false;
  await f.updates.check();
  assert.deepEqual([f.updates.state(f.version()).latest, f.updates.state(f.version()).error], ['1.3.3.15', null]);
  assert(f.network.requests.some(url => url.endsWith('/releases/expanded_assets/xxmi-runtime-1.3.3.15')));

  f.network.page = false;
  f.advance(5 * 60 * 1000);
  const offline = await f.updates.check();
  assert.match(offline.error, /检查修复版更新失败/);
  const state = f.updates.state(f.version());
  assert.equal(state.latest, '1.3.3.15', 'what the last check found is kept');
  assert.equal(f.updates.active().origin, 'bundled');

  f.network.assets = false;
  await assert.rejects(f.updates.update(f.version()), { code: 'downloadFailed' });
  assert.deepEqual(f.stored(), ['catalog.json']);
  assert.equal(f.version(), '1.3.3.14');
});

test('checks made close together share one request', async t => {
  const f = fixture(t);
  f.network.releases = [f.release(build('1.3.3.15', 'b'.repeat(40)))];
  await Promise.all([f.updates.check(), f.updates.check()]);
  await f.updates.check();
  const listed = () => f.network.requests.filter(url => url.startsWith('https://api.github.com/')).length;
  assert.equal(listed(), 1);
  f.advance(61 * 1000);
  await f.updates.check();
  assert.equal(listed(), 2);
  await f.updates.check({ force: true });
  assert.equal(listed(), 3);
});

test('a package that does not hold up is refused and leaves nothing behind', async t => {
  const good = build('1.3.3.15', 'b'.repeat(40));
  const cases = {
    'an archive that differs from its published digest': { pack: good, tamper: { 'xxmi-runtime.zip': Buffer.concat([good.zip, Buffer.from('x')]) }, code: 'checksumFailed' },
    'a manifest that differs from its published digest': { pack: good, tamper: { 'component.json': Buffer.from(good.manifest.toString().replace('1.3.3.15', '1.3.3.99')) }, code: 'checksumFailed' },
    'a DLL that is not a build of the fork': { pack: build('1.3.3.15', 'b'.repeat(40), { runtime: dll('1.3.3.15', { mark: Buffer.from('someone else') }) }), code: 'invalidPackage' },
    'a Vulkan runtime under the DX11 name': { pack: build('1.3.3.15', 'b'.repeat(40), { runtime: Buffer.concat([dll('1.3.3.15'), VULKAN_MARK]) }), code: 'invalidPackage' },
    'a DLL numbered differently from its manifest': { pack: build('1.3.3.15', 'b'.repeat(40), { runtime: dll('1.3.3.12') }), code: 'invalidPackage' },
    'a package without the activity protocol QAQR speaks': { pack: build('1.3.3.15', 'b'.repeat(40), { extra: { activityProtocol: 2 } }), code: 'invalidPackage' }
  };
  for (const [label, { pack, tamper, code }] of Object.entries(cases)) {
    const f = fixture(t);
    f.network.releases = [f.release(pack)];
    await f.updates.check();
    assert.equal(f.updates.state(f.version()).updateAvailable, true, label);
    f.network.tamper = tamper || null;
    await assert.rejects(f.updates.update(f.version()), { code }, label);
    assert.deepEqual(f.stored(), ['catalog.json'], label);
    assert.equal(f.updates.active().origin, 'bundled', label);
  }

  // An archive whose contents differ from the manifest, with digests that are all correctly published.
  const f = fixture(t), swapped = build('1.3.3.15', 'b'.repeat(40));
  swapped.zip = createZip([{ name: 'component.json', bytes: swapped.manifest }, { name: 'd3d11.dll', bytes: dll('1.3.3.15', { salt: 'other' }) },
    { name: 'LICENSE.GPL.txt', bytes: swapped.contents['LICENSE.GPL.txt'] }, { name: 'source.zip', bytes: swapped.contents['source.zip'] }]);
  f.network.releases = [f.release(swapped)];
  await f.updates.check();
  await assert.rejects(f.updates.update(f.version()), { code: 'checksumFailed' });
  assert.deepEqual(f.stored(), ['catalog.json']);
});

test('a release whose manifest names another source, or files outside the package, is not offered', async t => {
  for (const pack of [
    build('1.3.3.15', 'b'.repeat(40), { source: 'https://github.com/someone/XXMI-Libs-Package' }),
    build('1.3.3.15', 'b'.repeat(40), { extra: { files: { '../d3d11.dll': 'a'.repeat(64) } } }),
    build('1.3.3.15', 'b'.repeat(40), { extra: { files: { 'C:/Windows/d3d11.dll': 'a'.repeat(64) } } }),
    build('1.3.3.15', 'b'.repeat(40), { manifestVersion: '1.3.3.16' })
  ]) {
    const f = fixture(t);
    f.network.releases = [f.release(pack)];
    const result = await f.updates.check();
    assert.match(result.error, /清单不完整/);
    assert.equal(f.updates.state(f.version()).updateAvailable, false);
  }
});

test('a downloaded package that was changed afterwards is ignored', async t => {
  const f = fixture(t), next = build('1.3.3.15', 'b'.repeat(40));
  f.network.releases = [f.release(next)];
  await f.updates.check();
  await f.updates.update(f.version());
  fs.appendFileSync(path.join(f.store, 'b'.repeat(40), 'd3d11.dll'), 'edited');
  assert.equal(f.updates.active().origin, 'bundled');
  assert.equal(f.version(), '1.3.3.14');
  assert.equal(f.updates.state(f.version()).updateAvailable, true, 'and the release is offered again');
  await f.updates.update(f.version());
  assert.equal(f.version(), '1.3.3.15');
});

test('a missing bundled copy is replaced by a downloaded one, and reported when there is neither', async t => {
  const f = fixture(t);
  fs.rmSync(path.join(f.app, 'local-components/xxmi-runtime'), { recursive: true });
  assert.throws(() => f.updates.active(), { code: 'bundleMissing' });
  f.network.releases = [f.release(build('1.3.3.15', 'b'.repeat(40)))];
  await f.updates.check();
  assert.equal(f.updates.state(null).updateAvailable, true);
  await f.updates.update(null);
  assert.equal(f.version(), '1.3.3.15');
});

test('the switch between the official runtime and the fix follows the downloaded package', async t => {
  const f = fixture(t), launcherRoot = path.join(f.root, 'launcher'), miRoot = path.join(launcherRoot, 'WWMI');
  f.write(path.join(miRoot, 'd3dx.ini'), '[Constants]\n');
  f.write(path.join(miRoot, 'd3d11.dll'), 'official');
  f.write(path.join(launcherRoot, 'Resources/Packages/XXMI/d3d11.dll'), 'official');
  f.write(path.join(launcherRoot, 'Resources/Packages/XXMI/Manifest.json'), JSON.stringify({ version: '1.3.3' }));
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'secp384r1' }), userName = 'qaqr-fixture';
  const configuration = { Importers: { WWMI: { Migoto: { unsafe_mode: true, unsafe_mode_signature: crypto.sign('sha256', Buffer.from(userName), privateKey).toString('base64') } } } };
  const configFile = path.join(launcherRoot, 'XXMI Launcher Config.json');
  f.write(configFile, JSON.stringify(configuration));
  f.write(path.join(launcherRoot, 'Resources/Security/public_key.der'), publicKey.export({ type: 'spki', format: 'der' }).toString('base64'));
  const service = createMiForksService({ bundleRoots: [f.app], resolveInstallation: () => ({ launcherRoot, miRoot }), userName, runtimeBundle: () => f.updates.active() });
  const runtime = () => service.status('wuthering-waves').components.find(item => item.id === 'runtime');
  const onDisk = () => fs.readFileSync(path.join(miRoot, 'd3d11.dll'));

  service.change('wuthering-waves', 'runtime', 'fork');
  assert.deepEqual(runtime().local, { kind: 'fork', version: '1.3.3.14', build: 'a'.repeat(12) });

  // The Launcher moved to an official build the bundled fix does not know; the released one does.
  const next = build('1.3.3.15', 'b'.repeat(40), { hashes: [sha('official'), sha('official next')] });
  f.network.releases = [f.release(next)];
  await f.updates.check();
  await f.updates.update(runtime().fork.version);
  assert.deepEqual(runtime().local, { kind: 'outdated', version: '1.3.3.14' }, 'the fix in the game folder is now an older build');
  assert.deepEqual(runtime().fork, { version: '1.3.3.15', build: 'b'.repeat(12) });
  assert.deepEqual(onDisk(), f.bundled.contents['d3d11.dll'], 'downloading replaces nothing in the game folder');
  service.change('wuthering-waves', 'runtime', 'fork');
  assert.deepEqual(onDisk(), next.contents['d3d11.dll']);
  assert.equal(runtime().local.kind, 'fork');

  f.write(path.join(launcherRoot, 'Resources/Packages/XXMI/d3d11.dll'), 'official next');
  service.change('wuthering-waves', 'runtime', 'official');
  assert.equal(runtime().canUseFork, true, 'the hash the release accepted lets the fix back in');
  service.change('wuthering-waves', 'runtime', 'fork');
  assert.deepEqual(onDisk(), next.contents['d3d11.dll']);

  // Consent stays the Launcher's: without it the download still lands, and the DLL in the game folder is left alone.
  service.change('wuthering-waves', 'runtime', 'official');
  configuration.Importers.WWMI.Migoto.unsafe_mode = false;
  f.write(configFile, JSON.stringify(configuration));
  assert.throws(() => service.change('wuthering-waves', 'runtime', 'fork'), { code: 'approvalRequired' });
  assert.equal(onDisk().toString(), 'official next');
  assert.deepEqual(JSON.parse(fs.readFileSync(configFile, 'utf8')), configuration, 'QAQR wrote nothing to the Launcher configuration');
});
