const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { createComponentPackages, PACKAGES } = require('../app/src/main/install/component-packages.cjs');
const { FORK_MARK, VULKAN_MARK } = require('../app/src/main/install/mi-forks.cjs');
const { createZip } = require('../tools/publish-component.cjs');
const components = require('../tools/component-repositories.json');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

// The least each package holds to be taken for its component, with the number it ships under and a later one.
const SAMPLES = {
  'efmi-core': { files: { 'Core/EFMI/MergedSkeleton.ini': 'ini' }, extra: { official: { version: '1.5.0', files: [] }, compatibleFiles: {} }, versions: ['1.5.0.4', '1.5.0.5'] },
  'xxmi-runtime-vulkan': { files: { 'd3d11.dll': Buffer.concat([Buffer.from('vulkan runtime'), FORK_MARK, VULKAN_MARK]), 'dxcompiler.dll': 'dxc' }, extra: { backend: 'vulkan' }, versions: ['1.3.3-nhd.33.17', '1.3.3-nhd.34.2'] },
  'wwmi-dx12-qaqr': { files: { 'wwmi_dx12.addon64': 'add-on', 'wwmi_dx12/dxc/dxil.dll': 'dxil' }, extra: {}, versions: ['2026.11.2.5', '2026.11.3.1'] },
  eff: { files: { 'EFFLoader.exe': 'loader', 'plugin/eff.dll': 'eff', 'plugin/LICENSE': 'AGPL' }, extra: {}, versions: ['2.0.14.9', '2.0.15.1'] },
  'endfield-hdr': { files: { 'dxgi.dll': 'ReShade', 'renodx-endfield.addon64': 'RenoDX', 'licenses/ReShade.txt': 'license' }, extra: {}, versions: ['0.1.0.3', '0.1.0.4'] }
};

function pack(name, version, commit, { files = SAMPLES[name].files, source = 'https://github.com/' + PACKAGES[name].repository, omitVersion = false } = {}) {
  const contents = Object.fromEntries(Object.entries(files).map(([file, bytes]) => [file, Buffer.from(bytes)]));
  const manifest = Buffer.from(JSON.stringify({ source, sourceCommit: commit, ...(omitVersion ? {} : { version }), ...SAMPLES[name].extra,
    files: Object.fromEntries(Object.entries(contents).map(([file, bytes]) => [file, sha(bytes)])) }, null, 2));
  return { name, version, commit, contents, manifest, zip: createZip([{ name: 'component.json', bytes: manifest }, ...Object.entries(contents).map(([file, bytes]) => ({ name: file, bytes }))]) };
}

function fixture(t) {
  const temporary = fs.realpathSync(os.tmpdir()), root = fs.mkdtempSync(path.join(temporary, 'qaqr-component-packages-'));
  t.after(() => { assert.equal(path.dirname(fs.realpathSync(root)), temporary); fs.rmSync(root, { recursive: true, force: true }); });
  const app = path.join(root, 'app'), store = path.join(root, 'data/Components');
  function install(item) {
    const directory = path.join(app, 'local-components', item.name);
    fs.rmSync(directory, { recursive: true, force: true });
    for (const [file, bytes] of Object.entries({ ...item.contents, 'component.json': item.manifest })) {
      fs.mkdirSync(path.dirname(path.join(directory, file)), { recursive: true });
      fs.writeFileSync(path.join(directory, file), bytes);
    }
  }
  // GitHub as the manager sees it: one release per fork, and the two files it carries.
  const released = new Map();
  const release = item => released.set(PACKAGES[item.name].repository, item);
  async function fetchImpl(address) {
    const url = String(address), listed = /^https:\/\/api\.github\.com\/repos\/(.+)\/releases\?per_page=10$/.exec(url);
    if (listed) {
      const item = released.get(listed[1]);
      return Response.json(item ? [{ tag_name: `${item.name}-${item.version}`, draft: false, assets: [['component.json', item.manifest], [item.name + '.zip', item.zip]].map(([name, bytes]) => ({ name, size: bytes.length, digest: 'sha256:' + sha(bytes) })) }] : []);
    }
    const file = /^https:\/\/github\.com\/(.+)\/releases\/download\/[^/]+\/([^/]+)$/.exec(url), item = file && released.get(file[1]);
    if (!item || !/^(component\.json|[a-z0-9-]+\.zip)$/.test(file[2])) return new Response('missing', { status: 404 });
    return new Response(file[2] === 'component.json' ? item.manifest : item.zip);
  }
  const packages = createComponentPackages({ roots: () => [app], storeRoot: () => store, fetch: fetchImpl });
  return { root, app, store, install, release, packages };
}

test('every component a fork releases is one the manager knows how to take, and the other way round', () => {
  const published = Object.values(components).filter(item => item.release).map(item => [path.posix.basename(Object.values(item.targets)[0].output), item.repository]);
  assert.deepEqual(Object.fromEntries(published.sort()), Object.fromEntries(Object.entries(PACKAGES).map(([name, item]) => [name, item.repository]).sort()));
});

test('each component takes a later release of its fork and from then on reads it in place of the bundled copy', async t => {
  const f = fixture(t);
  for (const name of Object.keys(SAMPLES)) {
    const [held, next] = SAMPLES[name].versions, updates = f.packages(name);
    f.install(pack(name, held, 'a'.repeat(40)));
    assert.deepEqual([updates.active().origin, updates.active().manifest.version], ['bundled', held], name);
    f.release(pack(name, next, 'b'.repeat(40)));
    assert.equal((await updates.check({ force: true })).error, null, name);
    assert.deepEqual(updates.state(held), { ...updates.state(held), latest: next, build: 'b'.repeat(12), updateAvailable: true }, name);
    assert.deepEqual(await updates.update(held), { version: next, sourceCommit: 'b'.repeat(40) }, name);
    const active = updates.active();
    assert.deepEqual([active.origin, active.manifest.version], ['downloaded', next], name);
    assert(Object.values(active.files).every(file => file.startsWith(path.join(f.store, name, 'b'.repeat(40)) + path.sep)), name);
    assert.equal(updates.state(next).updateAvailable, false, name);
    assert.equal(f.packages(name), updates, 'one updater per component');
    // A manager update that ships the same build or a later one takes over again.
    f.install(pack(name, next, 'b'.repeat(40)));
    assert.equal(updates.active().origin, 'bundled', name);
  }
});

test('a download that is not the component it claims to be never replaces the bundled copy', async t => {
  const f = fixture(t);
  const refused = async (name, item, code) => {
    const [held] = SAMPLES[name].versions, updates = f.packages(name);
    f.install(pack(name, held, 'a'.repeat(40)));
    f.release(item);
    const checked = await updates.check({ force: true });
    if (checked.error) assert.equal(updates.state(held).updateAvailable, false, name);
    else await assert.rejects(updates.update(held), error => error.code === code, name);
    assert.deepEqual([updates.active().origin, updates.active().manifest.version], ['bundled', held], name);
    assert.deepEqual(fs.existsSync(path.join(f.store, name)) ? fs.readdirSync(path.join(f.store, name)).filter(entry => entry !== 'catalog.json') : [], [], name);
  };
  // A DX11 build under the Vulkan runtime's name, and one that is not a build of the fork at all.
  await refused('xxmi-runtime-vulkan', pack('xxmi-runtime-vulkan', '1.3.3-nhd.34.2', 'b'.repeat(40), { files: { 'd3d11.dll': Buffer.concat([Buffer.from('dx11'), FORK_MARK]) } }), 'invalidPackage');
  await refused('xxmi-runtime-vulkan', pack('xxmi-runtime-vulkan', '1.3.3-nhd.34.3', 'c'.repeat(40), { files: { 'd3d11.dll': Buffer.concat([Buffer.from('upstream'), VULKAN_MARK]) } }), 'invalidPackage');
  await refused('eff', pack('eff', '2.0.15.1', 'b'.repeat(40), { files: { 'plugin/eff.dll': 'eff alone' } }), 'invalidPackage');
  await refused('endfield-hdr', pack('endfield-hdr', '0.1.0.4', 'b'.repeat(40), { files: { 'dxgi.dll': 'ReShade alone' } }), 'invalidPackage');
  await refused('wwmi-dx12-qaqr', pack('wwmi-dx12-qaqr', '2026.11.3.1', 'b'.repeat(40), { source: 'https://github.com/someone/wwmi-dx12' }), 'invalidRelease');
  assert.throws(() => f.packages('arknights-tools'), /Unknown component package/);
});

test('a bundled copy from before packages were numbered still serves, and any release is newer than it', async t => {
  const f = fixture(t), updates = f.packages('eff');
  f.install(pack('eff', null, 'a'.repeat(40), { omitVersion: true }));
  assert.equal(updates.active().origin, 'bundled');
  f.release(pack('eff', '2.0.14.9', 'b'.repeat(40)));
  await updates.check({ force: true });
  assert.equal(updates.state(undefined).updateAvailable, true);
  await updates.update(undefined);
  assert.deepEqual([updates.active().origin, updates.active().manifest.version], ['downloaded', '2.0.14.9']);
});
