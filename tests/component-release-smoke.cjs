const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { createZip } = require('../tools/publish-component.cjs');

// The fork releases a later build of the XXMI-Libs fix than the one this QAQR ships. The release is
// synthetic and served from memory: the bundled DLL with a later number in its version resource,
// packed the way the fork's workflow packs it. Nothing is fetched and the DLL is never loaded.
module.exports = async ({ electron, runtimeRequire, handlers, xxmi, runtimeBundle, launcherConfig, evaluate, waitFor, captureUI, passed }) => {
  const call = (name, ...args) => handlers.get(name)({}, ...args);
  const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
  const { runtimeUpdates } = runtimeRequire('./out/main/install/xxmi.cjs');
  const repository = 'QAQ-Revival/XXMI-Libs-Package', bundleDir = path.dirname(runtimeBundle), mi = path.join(xxmi, 'WWMI');
  const store = path.join(process.env.QAQR_DATA_DIR, 'Components/xxmi-runtime'), security = path.join(xxmi, 'Resources/Security');
  const onDisk = () => fs.readFileSync(path.join(mi, 'd3d11.dll'));
  const bundledManifest = JSON.parse(fs.readFileSync(path.join(bundleDir, 'component.json'), 'utf8')), bundledDll = fs.readFileSync(runtimeBundle);
  const resource = bundledDll.indexOf(Buffer.from([0xbd, 0x04, 0xef, 0xfe]));
  assert(resource > 0, 'the bundled runtime carries a version resource');
  const versionOf = bytes => [bytes.readUInt16LE(resource + 10), bytes.readUInt16LE(resource + 8), bytes.readUInt16LE(resource + 14), bytes.readUInt16LE(resource + 12)].join('.');
  const nextDll = Buffer.from(bundledDll);
  nextDll.writeUInt16LE(bundledDll.readUInt16LE(resource + 12) + 1000, resource + 12);
  const bundledVersion = versionOf(bundledDll), nextVersion = versionOf(nextDll);
  function release(version, commit, runtime) {
    const files = { ...bundledManifest.files, 'd3d11.dll': sha(runtime) };
    const manifest = Buffer.from(JSON.stringify({ ...bundledManifest, sourceCommit: commit, version, files }, null, 2));
    const zip = createZip([{ name: 'component.json', bytes: manifest }, ...Object.keys(files).map(name => ({ name, bytes: name === 'd3d11.dll' ? runtime : fs.readFileSync(path.join(bundleDir, name)) }))]);
    const asset = (name, bytes) => ({ name, size: bytes.length, digest: 'sha256:' + sha(bytes) });
    return { tag_name: 'xxmi-runtime-' + version, draft: false, prerelease: false, manifest, zip, assets: [asset('component.json', manifest), asset('xxmi-runtime.zip', zip)] };
  }
  const releases = { next: release(nextVersion, 'c'.repeat(40), nextDll), same: release(bundledVersion, bundledManifest.sourceCommit, bundledDll) };
  const outside = electron.net.fetch, requests = [];
  let published = null;
  electron.net.fetch = async (address, options) => {
    const url = String(address);
    if (!url.includes(repository)) return outside(address, options);
    requests.push(url);
    if (!published) throw Error('Synthetic GitHub offline');
    if (url === `https://api.github.com/repos/${repository}/releases?per_page=10`) return Response.json([{ tag_name: 'v9.9.9', draft: false, assets: [] }, { ...published, manifest: undefined, zip: undefined }]);
    if (url === `https://github.com/${repository}/releases/download/${published.tag_name}/component.json`) return new Response(published.manifest);
    if (url === `https://github.com/${repository}/releases/download/${published.tag_name}/xxmi-runtime.zip`) return new Response(published.zip);
    return new Response('missing', { status: 404 });
  };
  const row = `document.querySelector('#settings-mi-forks [data-component="runtime"] [data-channel="fork"]')`;
  const shown = `${row}?.querySelector('.version-local .version-number').textContent`, latest = `${row}?.querySelector('.version-latest .version-number')?.textContent`;
  const update = `document.querySelector('[aria-label="更新 XXMI-Libs 修复版"]')`;
  const refresh = () => { for (const window of electron.BrowserWindow.getAllWindows()) if (!window.isDestroyed()) window.webContents.send('xxmi:changed', { gameId: 'wuthering-waves' }); };
  const runtime = async () => (await call('xxmi:status', 'wuthering-waves')).fork.components.find(item => item.id === 'runtime');
  const preservedConfig = fs.readFileSync(launcherConfig);
  try {
    await runtimeUpdates.check({ force: true });
    refresh();
    await waitFor(`${row}?.dataset.status === 'error' && ${row}.classList.contains('is-active') && ${shown} === '${bundledVersion}'`, 'an unreachable GitHub is reported on the row and the bundled fix stays in use');
    assert.equal((await runtime()).forkUpdates.updateAvailable, false);
    assert.equal(fs.existsSync(path.join(store, 'c'.repeat(40))), false);

    published = releases.next;
    await runtimeUpdates.check({ force: true });
    refresh();
    await waitFor(`${row}.dataset.status === 'update' && ${latest} === '${nextVersion}' && ${shown} === '${bundledVersion}' && !!${update} && !${update}.disabled`, 'the released fix is offered next to the one in use');
    assert.deepEqual(onDisk(), bundledDll, 'finding a release changes nothing');
    await evaluate(`${row}.scrollIntoView({ block: 'center' })`);
    await captureUI('xxmi-fork-release.png');

    // Unsafe Mode is off in this Launcher, so the download lands and the DLL in the game folder stays.
    await evaluate(`${update}.click()`);
    await waitFor(`document.querySelector('#settings-mi-forks [role="alert"]')?.textContent.includes('Unsafe Mode') && ${row}.dataset.status === 'update' && ${shown} === '${bundledVersion}' && ${latest} === '${nextVersion}'`, 'without Launcher consent the fix is downloaded but not put in the game folder');
    assert.deepEqual(onDisk(), bundledDll);
    assert.deepEqual(fs.readFileSync(path.join(store, 'c'.repeat(40), 'd3d11.dll')), nextDll);
    assert.deepEqual(fs.readdirSync(store).sort(), ['catalog.json', 'c'.repeat(40)], 'one verified package and what the check found, nothing temporary');
    assert.deepEqual(fs.readFileSync(runtimeBundle), bundledDll, 'the installation is not written');
    assert.deepEqual(fs.readFileSync(launcherConfig), preservedConfig, 'QAQR does not grant itself consent');
    assert.deepEqual({ kind: (await runtime()).local.kind, fork: (await runtime()).fork.version }, { kind: 'outdated', fork: nextVersion });

    // The player turns Unsafe Mode on in the Launcher, which signs their user name with its own key.
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'secp384r1' }), configuration = JSON.parse(preservedConfig.toString('utf8'));
    configuration.Importers.WWMI.Migoto = { unsafe_mode: true, unsafe_mode_signature: crypto.sign('sha256', Buffer.from(os.userInfo().username), privateKey).toString('base64') };
    fs.mkdirSync(security, { recursive: true });
    fs.writeFileSync(path.join(security, 'public_key.der'), publicKey.export({ type: 'spki', format: 'der' }).toString('base64'));
    fs.writeFileSync(launcherConfig, JSON.stringify(configuration));
    refresh();
    await waitFor(`!!${update} && !${update}.disabled && !document.querySelector('#settings-mi-forks').textContent.includes('需要 Unsafe Mode')`, 'with consent the older fix in the game folder can be brought up to date');
    await evaluate(`${update}.click()`);
    await waitFor(`${row}.classList.contains('is-active') && ${row}.dataset.status === 'current' && ${shown} === '${nextVersion}' && !${update}`, 'the released fix is in use and nothing further is offered');
    assert.deepEqual(onDisk(), nextDll);
    await evaluate(`${row}.scrollIntoView({ block: 'center' })`);
    await captureUI('xxmi-fork-updated.png');
    passed('A fix the fork released is found, verified and installed under data without touching the installation; the DLL in the game folder is replaced only with Launcher consent');

    // A manager that already ships what the fork released has nothing to offer.
    fs.rmSync(store, { recursive: true, force: true });
    fs.copyFileSync(runtimeBundle, path.join(mi, 'd3d11.dll'));
    published = releases.same;
    await runtimeUpdates.check({ force: true });
    refresh();
    await waitFor(`${row}.classList.contains('is-active') && ${row}.dataset.status === 'current' && ${shown} === '${bundledVersion}' && ${latest} === '${bundledVersion}' && !${update}`, 'the bundled fix is current when the fork released the same build');
    assert.equal(requests.some(url => url.endsWith('/xxmi-runtime.zip') && url.includes(releases.same.tag_name)), false, 'a release that is not newer is never downloaded');
    passed('Offline checks and releases that are not newer leave the bundled fix in use');
  } finally {
    electron.net.fetch = outside;
    fs.rmSync(store, { recursive: true, force: true });
    fs.rmSync(security, { recursive: true, force: true });
    fs.writeFileSync(launcherConfig, preservedConfig);
    fs.copyFileSync(runtimeBundle, path.join(mi, 'd3d11.dll'));
    refresh();
  }
  await waitFor(`${row}.classList.contains('is-active') && document.querySelector('#settings-mi-forks').textContent.includes('Unsafe Mode')`, 'the fixture is back to the bundled fix without consent');
};
