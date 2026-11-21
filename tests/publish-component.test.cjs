const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const AdmZip = require('../app/node_modules/adm-zip');
const { plan, createZip, readPackage, publish } = require('../tools/publish-component.cjs');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const REPOSITORY = 'QAQ-Revival/XXMI-Libs-Package';

function packageAt(t, { version = '1.3.3.15', commit = 'b'.repeat(40), extra = {} } = {}) {
  const temporary = fs.realpathSync(os.tmpdir()), root = fs.mkdtempSync(path.join(temporary, 'qaqr-publish-component-'));
  t.after(() => { assert.equal(path.dirname(fs.realpathSync(root)), temporary); fs.rmSync(root, { recursive: true, force: true }); });
  const contents = { 'd3d11.dll': Buffer.from('runtime ' + version), 'Core/EFMI/nested.ini': Buffer.from('[Constants]\r\n'), 'source.zip': crypto.randomBytes(4096) };
  for (const [name, bytes] of Object.entries(contents)) { fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true }); fs.writeFileSync(path.join(root, name), bytes); }
  const manifest = { source: 'https://github.com/' + REPOSITORY, sourceCommit: commit, version, files: Object.fromEntries(Object.entries(contents).map(([name, bytes]) => [name, sha(bytes)])), ...extra };
  fs.writeFileSync(path.join(root, 'component.json'), JSON.stringify(manifest, null, 2));
  return { root, contents, manifest };
}
// The releases, tags and branch head of a fork, changed the way the REST API changes them.
function github({ head = 'b'.repeat(40), releases = [] } = {}) {
  const state = { head, releases: releases.map((release, index) => ({ id: index + 1, draft: false, assets: [{ name: 'component.json' }, { name: 'xxmi-runtime.zip' }], ...release })), tags: new Set(releases.map(release => release.tag_name)), calls: [], uploads: [] };
  let next = 100;
  async function api(method, route, body) {
    state.calls.push(`${method} ${route.replace(`/repos/${REPOSITORY}`, '')}`);
    if (method === 'GET' && route.endsWith('/git/ref/heads/master')) return { object: { sha: state.head } };
    if (method === 'GET' && route.includes('/releases?')) return structuredClone(state.releases);
    if (method === 'POST' && route.endsWith('/releases')) { const release = { id: next++, assets: [], upload_url: `https://uploads.github.com/repos/${REPOSITORY}/releases/${next}/assets{?name,label}`, ...body }; state.releases.unshift(release); return release; }
    const id = Number(/\/releases\/(\d+)$/.exec(route)?.[1]), release = state.releases.find(item => item.id === id);
    if (method === 'PATCH' && release) { Object.assign(release, body); if (!release.draft) state.tags.add(release.tag_name); return release; }
    if (method === 'DELETE' && release) { state.releases.splice(state.releases.indexOf(release), 1); return null; }
    if (method === 'DELETE' && route.includes('/git/refs/tags/')) { state.tags.delete(route.split('/git/refs/tags/')[1]); return null; }
    throw Error('Unexpected request: ' + method + ' ' + route);
  }
  async function upload(release, name, bytes, type) {
    state.uploads.push({ name, type, bytes });
    state.releases.find(item => item.id === release.id).assets.push({ name });
  }
  return { state, api, upload };
}

test('a repository publishes only the component marked for release, from its own branch or a version tag', () => {
  assert.deepEqual(plan({ repository: REPOSITORY, ref: 'refs/heads/master' }), { publish: true, component: 'xxmi-runtime', branch: 'master', build: 'qaqr/build.cjs' });
  assert.equal(plan({ repository: REPOSITORY, ref: 'refs/tags/v1.3.4' }).publish, true, 'an upstream version tag renumbers the branch head');
  assert.equal(plan({ repository: REPOSITORY, ref: 'refs/heads/main' }).publish, false);
  assert.equal(plan({ repository: REPOSITORY, ref: 'refs/tags/xxmi-runtime-1.3.3.15' }).publish, false, 'its own release tag does not start another build');
  // The Vulkan fork merges this fork's workflow file along with everything else, and publishes its own package with it.
  assert.deepEqual(plan({ repository: 'QAQ-Revival/XXMI-Libs-Vulkan', ref: 'refs/heads/master' }), { publish: true, component: 'xxmi-runtime-vulkan', branch: 'master', build: 'qaqr/build.cjs' });
  // The same workflow file in a fork whose component still ships only inside the manager does nothing.
  assert.equal(plan({ repository: 'QAQ-Revival/XXMI-Launcher', ref: 'refs/heads/main' }).publish, false);
  assert.equal(plan({ repository: 'SpectrumQT/XXMI-Libs-Package', ref: 'refs/heads/master' }).publish, false);
  const components = { demo: { repository: 'QAQ-Revival/Demo', branch: 'main', build: 'qaqr/build.cjs', release: true, targets: { 'wwmi-dx12': { output: 'local-components/wwmi-dx12-qaqr' } } } };
  assert.equal(plan({ repository: 'QAQ-Revival/Demo', ref: 'refs/heads/main', components }).component, 'wwmi-dx12-qaqr', 'named after the package directory the manager reads');
});

test('the archive holds the package as it lies on disk, the same bytes every time', t => {
  const f = packageAt(t), first = readPackage(f.root, { component: 'xxmi-runtime', repository: REPOSITORY });
  assert.equal(first.tag, 'xxmi-runtime-1.3.3.15');
  assert.deepEqual(readPackage(f.root, { component: 'xxmi-runtime', repository: REPOSITORY }).zip, first.zip);
  const entries = new AdmZip(first.zip).getEntries();
  assert.deepEqual(entries.map(entry => entry.entryName), ['component.json', 'Core/EFMI/nested.ini', 'd3d11.dll', 'source.zip']);
  for (const entry of entries.slice(1)) assert.deepEqual(entry.getData(), f.contents[entry.entryName]);
  assert.deepEqual(entries[0].getData(), fs.readFileSync(path.join(f.root, 'component.json')));
  assert.deepEqual(new AdmZip(createZip([{ name: 'empty.txt', bytes: Buffer.alloc(0) }])).getEntries()[0].getData(), Buffer.alloc(0));
});

test('a package that is not what its manifest says is not published', t => {
  const options = { component: 'xxmi-runtime', repository: REPOSITORY };
  const extra = packageAt(t);
  fs.writeFileSync(path.join(extra.root, 'stray.dll'), 'not listed');
  assert.throws(() => readPackage(extra.root, options), /stray\.dll/);
  const changed = packageAt(t);
  fs.appendFileSync(path.join(changed.root, 'd3d11.dll'), 'edited');
  assert.throws(() => readPackage(changed.root, options), /d3d11\.dll/);
  const missing = packageAt(t);
  fs.unlinkSync(path.join(missing.root, 'source.zip'));
  assert.throws(() => readPackage(missing.root, options), /does not hold/);
  assert.throws(() => readPackage(packageAt(t, { extra: { version: undefined } }).root, options), /no version/);
  assert.throws(() => readPackage(packageAt(t, { extra: { sourceDirty: true } }).root, options), /commit/);
  assert.throws(() => readPackage(packageAt(t).root, { component: 'xxmi-runtime', repository: 'QAQ-Revival/XXMI-Libs-Vulkan' }), /another source/);
});

test('publishing lists the release only once both files are up, and keeps just the newest', async t => {
  const f = packageAt(t), hub = github({ releases: [
    { tag_name: 'xxmi-runtime-1.3.3.14', target_commitish: 'a'.repeat(40) },
    { tag_name: 'xxmi-runtime-1.3.3.13', target_commitish: '9'.repeat(40) },
    { tag_name: 'v1.3.3', target_commitish: 'e'.repeat(40) }
  ] });
  const result = await publish({ directory: f.root, component: 'xxmi-runtime', repository: REPOSITORY, branch: 'master', api: hub.api, upload: hub.upload, log: () => {} });
  assert.equal(result.published, true);
  assert.deepEqual(hub.state.releases.map(release => [release.tag_name, release.draft]), [['xxmi-runtime-1.3.3.15', false], ['v1.3.3', false]], 'releases that are not packages are left alone');
  assert.deepEqual([...hub.state.tags].sort(), ['v1.3.3', 'xxmi-runtime-1.3.3.15']);
  assert.equal(hub.state.releases[0].target_commitish, 'b'.repeat(40));
  assert.deepEqual(hub.state.uploads.map(item => [item.name, item.type]), [['component.json', 'application/json'], ['xxmi-runtime.zip', 'application/zip']]);
  assert.deepEqual(hub.state.uploads[0].bytes, fs.readFileSync(path.join(f.root, 'component.json')));
  const order = hub.state.calls.filter(call => !call.startsWith('GET'));
  assert.deepEqual(order.slice(0, 2), ['POST /releases', 'PATCH /releases/100'], 'created as a draft, published after the uploads');

  // The same build again, as when a version tag arrives without changing the number.
  const before = hub.state.calls.length;
  await publish({ directory: f.root, component: 'xxmi-runtime', repository: REPOSITORY, branch: 'master', api: hub.api, upload: hub.upload, log: () => {} });
  assert.deepEqual(hub.state.calls.slice(before).filter(call => !call.startsWith('GET')), []);
  assert.equal(hub.state.uploads.length, 2);
});

test('a build the branch has moved past is left to the run behind it', async t => {
  const f = packageAt(t), hub = github({ head: 'c'.repeat(40), releases: [{ tag_name: 'xxmi-runtime-1.3.3.14', target_commitish: 'a'.repeat(40) }] });
  const result = await publish({ directory: f.root, component: 'xxmi-runtime', repository: REPOSITORY, branch: 'master', api: hub.api, upload: hub.upload, log: () => {} });
  assert.equal(result.published, false);
  assert.deepEqual(hub.state.releases.map(release => release.tag_name), ['xxmi-runtime-1.3.3.14']);
  assert.equal(hub.state.uploads.length, 0);
});

test('the same number on rewritten history, and a draft left by an interrupted run, are replaced', async t => {
  const f = packageAt(t), hub = github({ releases: [
    { tag_name: 'xxmi-runtime-1.3.3.15', target_commitish: 'd'.repeat(40) },
    { tag_name: 'xxmi-runtime-1.3.3.15', target_commitish: 'b'.repeat(40), draft: true, assets: [{ name: 'component.json' }] }
  ] });
  await publish({ directory: f.root, component: 'xxmi-runtime', repository: REPOSITORY, branch: 'master', api: hub.api, upload: hub.upload, log: () => {} });
  assert.deepEqual(hub.state.releases.map(release => [release.tag_name, release.target_commitish, release.draft, release.assets.length]), [['xxmi-runtime-1.3.3.15', 'b'.repeat(40), false, 2]]);
});
