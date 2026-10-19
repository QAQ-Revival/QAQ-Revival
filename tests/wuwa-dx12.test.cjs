const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createWuwaDx12Components, createWuwaDx12Packages, releasePackage } = require('../app/out/main/wuwa-dx12-components.cjs');
const { createWuwaDx12Service, resolveWuwaDx12Paths, buildWuwaDx12Args } = require('../app/out/main/wuwa-dx12.cjs');

function pe() {
  const b = Buffer.alloc(512); b.write('MZ'); b.writeUInt32LE(64, 60); b.write('PE\0\0', 64);
  b.writeUInt16LE(0x8664, 68); b.writeUInt16LE(1, 70); b.writeUInt16LE(240, 84); b.writeUInt16LE(0x20b, 88);
  return b;
}
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qaq-dx12-'));
  t.after(() => { t.mock.restoreAll(); assert.equal(path.dirname(fs.realpathSync(root)), fs.realpathSync(os.tmpdir())); fs.rmSync(root, { recursive: true, force: true }); });
  const write = (file, data) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, data); return file; };
  const gameRoot = path.join(root, '鸣潮 & Game'), win64 = path.join(gameRoot, 'Client/Binaries/Win64'), wwmi = path.join(root, 'XXMI/WWMI');
  write(path.join(gameRoot, 'Wuthering Waves.exe'), 'game'); write(path.join(win64, 'Client-Win64-Shipping.exe'), 'client');
  write(path.join(wwmi, 'd3dx.ini'), 'WWMI'); fs.mkdirSync(path.join(wwmi, 'Core/WWMI'), { recursive: true }); fs.mkdirSync(path.join(wwmi, 'Mods'));
  const paths = { gameRoot, win64, wwmi, modsPath: path.join(wwmi, 'Mods'), addonDir: win64, launcherPath: '' };
  const bundles = { reshade: new Map([['dxgi.dll', pe()], ['wwmi_dx12/licenses/ReShade-LICENSE.md', Buffer.from('BSD')]]), addon: new Map([
    ['wwmi_dx12.addon64', pe()], ['wwmi_dx12/IbVbHash.cso', Buffer.from('shader')], ['wwmi_dx12/BufCopy.cso', Buffer.from('copy')],
    ['wwmi_dx12/dxc/dxcompiler.dll', pe()], ['wwmi_dx12/dxc/dxil.dll', pe()], ['wwmi_dx12/LICENSE', Buffer.from('license')], ['wwmi_dx12/licenses/ReShade-LICENSE.md', Buffer.from('BSD')]
  ]) };
  const packages = [];
  const components = createWuwaDx12Components({ stateDir: path.join(root, 'state'), getPackage: async kind => { packages.push(kind); return bundles[kind]; } });
  let enabled = false, failure = false, running = false, launchResult = { success: true };
  const launches = [];
  const service = createWuwaDx12Service({ resolvePaths: () => ({ ...paths }), getEnabled: () => enabled, saveEnabled: value => { enabled = value; }, components,
    backupDir: path.join(root, 'backups'), stopped: async () => { if (running) throw Error('game running'); },
    inspect: async file => ({ ok: fs.existsSync(file), message: 'ReShade' }), waitForStart: async () => launchResult,
    launchProcess: async (...args) => { launches.push(args); return failure ? { success: false, error: 'launch failed' } : { success: true }; } });
  return { root, paths, write, components, service, packages, bundles, launches, fail: value => { failure = value; }, running: value => { running = value; }, result: value => { launchResult = value; } };
}
test('managed components install on enable, persist provenance across restart, and deactivate without losing settings or Mods', async t => {
  const f = fixture(t), { win64, wwmi } = f.paths;
  const mod = f.write(path.join(wwmi, 'Mods/角色/mod.ini'), 'user mod');
  const ini = f.write(path.join(win64, 'ReShade.ini'), '[GENERAL]\nPresetPath=user.ini\n');
  assert.equal((await f.service.status()).enabled, false); assert.equal(f.packages.length, 0);
  await f.service.setEnabled(true);
  assert.equal((await f.service.status()).ready, true);
  assert.equal((await f.service.status()).sources.reshade.source, 'managed');
  const restarted = createWuwaDx12Components({ stateDir: path.join(f.root, 'state'), getPackage: async () => assert.fail('unexpected download') });
  assert.equal(restarted.describe(f.paths, 'addon').source, 'managed');
  await f.service.setEnabled(false);
  for (const name of ['dxgi.dll', 'wwmi_dx12.addon64']) {
    assert.equal(fs.existsSync(path.join(win64, name)), false); assert.ok(fs.existsSync(path.join(win64, name + '.qaqr-disabled')));
  }
  assert.equal(fs.readFileSync(ini, 'utf8'), '[GENERAL]\nPresetPath=user.ini\n'); assert.equal(fs.readFileSync(mod, 'utf8'), 'user mod');
  assert.equal((await f.service.status()).sources.addon.active, false);
  await f.service.setEnabled(true);
  assert.equal((await f.service.status()).sources.addon.active, true);
});
test('user ReShade and a custom add-on folder take priority; turning off only disables QAQR files', async t => {
  const f = fixture(t), custom = path.join(f.root, 'Custom Addons');
  const userDll = f.write(path.join(f.paths.win64, 'dxgi.dll'), Buffer.concat([pe(), Buffer.from('user')]));
  f.write(path.join(f.paths.win64, 'ReShade.ini'), `[ADDON]\nAddonPath=${custom}\n`);
  await f.service.setEnabled(true);
  assert.equal((await f.service.status()).sources.reshade.source, 'user');
  assert.equal(fs.existsSync(path.join(custom, 'wwmi_dx12.addon64')), true);
  assert.deepEqual(f.packages, ['addon']);
  await f.service.setEnabled(false);
  assert.ok(fs.readFileSync(userDll).includes(Buffer.from('user')));
  assert.equal(fs.existsSync(path.join(custom, 'wwmi_dx12.addon64')), false);
  // A user replacement is no longer owned, even with an old ownership record.
  const userAddon = f.write(path.join(custom, 'wwmi_dx12.addon64'), Buffer.concat([pe(), Buffer.from('user addon')]));
  await f.service.setEnabled(true); await f.service.setEnabled(false);
  assert.ok(fs.readFileSync(userAddon).includes(Buffer.from('user addon')));
  assert.equal((await f.service.status()).sources.addon.source, 'user');
});
test('failed install validation and failed disable roll back component changes', async t => {
  const f = fixture(t);
  await assert.rejects(f.components.toggle(f.paths, true, { validate: async () => { throw Error('invalid dependency'); } }), /invalid dependency/);
  assert.equal(fs.existsSync(path.join(f.paths.win64, 'dxgi.dll')), false);
  assert.equal(f.components.describe(f.paths, 'reshade').source, 'missing');
  await f.service.setEnabled(true);
  const rename = fs.renameSync; let fail = true;
  t.mock.method(fs, 'renameSync', (from, to) => {
    if (fail && from.endsWith('wwmi_dx12.addon64')) { fail = false; throw Error('locked DLL'); }
    return rename(from, to);
  });
  await assert.rejects(f.service.setEnabled(false), /locked DLL/);
  assert.equal((await f.service.status()).enabled, true);
  assert.ok(fs.existsSync(path.join(f.paths.win64, 'dxgi.dll')));
  assert.ok(fs.existsSync(path.join(f.paths.win64, 'wwmi_dx12.addon64')));
});
test('DX12 launch backs up INIs, preserves user choices and paths, and rolls back a spawn failure', async t => {
  const f = fixture(t), { gameRoot, win64, wwmi } = f.paths;
  const addon = f.write(path.join(win64, 'wwmi_dx12.ini'), Buffer.from('\ufeff[wwmi-dx12]\r\nwwmi_dir = old\r\ndebug = 1\r\ndecensor = 1\r\n', 'utf16le'));
  const engine = f.write(path.join(gameRoot, 'Client/Saved/Config/WindowsNoEditor/Engine.ini'), '; note\n[SystemSettings]\nr.Other=7\nr.Streaming.Boost=2\n');
  const user = f.write(path.join(gameRoot, 'Client/Config/UserEngine.ini'), `[ConsoleVariables]\n${'r.Kuro.SkeletalMesh.DistanceLODBaseFOV'}=384\n`);
  await f.service.setEnabled(true);
  const original = [addon, engine, user].map(file => fs.readFileSync(file));
  f.fail(true); await assert.rejects(f.service.launch(), /launch failed/);
  [addon, engine, user].forEach((file, i) => assert.deepEqual(fs.readFileSync(file), original[i]));
  f.fail(false); const result = await f.service.launch(['-dx11', '-krqlv=sd', '-windowed']);
  assert.equal(result.success, true); assert.ok(fs.existsSync(path.join(result.backup, 'backup.json')));
  const text = fs.readFileSync(addon).toString('utf16le');
  assert.ok(text.includes(`wwmi_dir = ${wwmi}`)); assert.match(text, /debug = 1/); assert.match(text, /decensor = 1/);
  assert.match(fs.readFileSync(engine, 'utf8'), /r.Streaming.Boost=30/); assert.match(fs.readFileSync(engine, 'utf8'), /r.Other=7/);
  assert.deepEqual(fs.readFileSync(user), original[2]);
  const request = JSON.parse(fs.readFileSync(f.launches.at(-1)[2].at(-1)));
  assert.equal(request.arguments, '"-krqlv=sd" "-windowed" "-dx12"');
  assert.equal(request.gameRoot, gameRoot);
  f.result(null);
  await assert.rejects(f.service.launch(), /辅助程序未返回结果/);
});
test('invalid setup and running games do not install or start; paths resolve from the shipping executable', async t => {
  const f = fixture(t);
  f.running(true); await assert.rejects(f.service.setEnabled(true), /game running/);
  assert.equal(fs.existsSync(path.join(f.paths.win64, 'dxgi.dll')), false);
  f.running(false); f.paths.modsPath = path.join(f.root, 'unrelated Mods');
  await assert.rejects(f.service.setEnabled(true), /Mods/);
  assert.equal(f.launches.length, 0);
  const resolved = resolveWuwaDx12Paths({ gamePath: path.join(f.paths.win64, 'Client-Win64-Shipping.exe'), importerPath: f.paths.wwmi, modsPath: path.join(f.paths.wwmi, 'Mods') });
  assert.equal(resolved.gameRoot, f.paths.gameRoot); assert.equal(resolved.wwmi, f.paths.wwmi);
  assert.deepEqual(buildWuwaDx12Args(f.paths, ['-d3d11', '-dx12']), ['-krqlv=hd', '-dx12']);
  await assert.rejects(f.service.setEnabled('true'), /开关值/);
});

test('official update checks find new versions and verified downloads remain selected after restart', async t => {
  const f = fixture(t), Zip = require('../app/node_modules/adm-zip'), zip = new Zip();
  for (const [name, bytes] of f.bundles.addon) zip.addFile(name, bytes);
  const bytes = zip.toBuffer(), digest = require('node:crypto').createHash('sha256').update(bytes).digest('hex');
  const url = 'https://github.com/lekarsenten/wwmi-dx12/releases/download/v2026.11.1/wwmi-dx12-2026.11.1.zip';
  const release = { tag_name: 'v2026.11.1', assets: [{ name: 'wwmi-dx12-2026.11.1.zip', browser_download_url: url, digest: `sha256:${digest}` }] };
  let failReShade = false, failApi = false, downloads = 0;
  const options = { bundledDir: path.join(f.root, 'bundled'), cacheDir: path.join(f.root, 'packages'), fetch: async address => {
    if (address === 'https://reshade.me/') { if (failReShade) throw Error('offline'); return { ok: true, text: async () => '<a href="/downloads/ReShade_Setup_6.9.0_Addon.exe">Full add-on support</a>' }; }
    if (address === url) { downloads++; return { ok: true, body: [bytes] }; }
    if (address === 'https://github.com/lekarsenten/wwmi-dx12/releases/latest') return { ok: true, text: async () => '<include-fragment src="https://github.com/lekarsenten/wwmi-dx12/releases/expanded_assets/v2026.11.1">' };
    if (address.endsWith('/releases/expanded_assets/v2026.11.1')) return { ok: true, text: async () => `<li><a href="${new URL(url).pathname}">package</a><span>sha256:${digest}</span></li>` };
    assert.equal(address, 'https://api.github.com/repos/lekarsenten/wwmi-dx12/releases/latest'); return failApi ? { ok: false, status: 403 } : { ok: true, json: async () => release };
  } };
  const packages = createWuwaDx12Packages(options);
  const update = await packages.checkUpdates();
  assert.equal(update.components.reshade.availableVersion, '6.9.0'); assert.equal(update.components.addon.updateAvailable, true);
  const bundle = await packages.prepareUpdate('addon'); assert.equal(bundle.version, '2026.11.1'); assert.equal(downloads, 1);
  packages.commitUpdate(bundle);
  const restarted = createWuwaDx12Packages({ ...options, fetch: async () => assert.fail('cached package should work offline') });
  assert.equal(restarted.info('addon').version, '2026.11.1'); assert.equal((await restarted('addon')).version, '2026.11.1');
  assert.equal(restarted.state().components.addon.updateAvailable, false);
  failReShade = true; failApi = true; const partial = await packages.checkUpdates();
  assert.match(partial.errors.reshade, /offline/); assert.equal(partial.components.addon.availableVersion, '2026.11.1');
  assert.throws(() => releasePackage('addon', { ...release, assets: [{ ...release.assets[0], browser_download_url: 'https://example.com/package.zip' }] }), /发布地址/);
});

test('component upgrades preserve disabled state and user files, with a backup and rollback on failure', async t => {
  const f = fixture(t); await f.service.setEnabled(true); await f.service.setEnabled(false);
  const shader = f.write(path.join(f.paths.win64, 'wwmi_dx12/IbVbHash.cso'), 'user shader');
  const disabled = path.join(f.paths.win64, 'wwmi_dx12.addon64.qaqr-disabled');
  const newer = new Map(f.bundles.addon); newer.version = '2026.11.1'; newer.set('wwmi_dx12.addon64', Buffer.concat([pe(), Buffer.from('new version')]));
  const result = await f.components.update(f.paths, 'addon', newer);
  assert.ok(fs.existsSync(path.join(result.backup, 'ownership.json')));
  assert.ok(fs.readFileSync(disabled).includes(Buffer.from('new version')));
  assert.equal(fs.existsSync(path.join(f.paths.win64, 'wwmi_dx12.addon64')), false);
  assert.equal(f.components.describe(f.paths, 'addon').version, '2026.11.1');
  assert.equal(fs.readFileSync(shader, 'utf8'), 'user shader');
  const before = fs.readFileSync(disabled), failed = new Map(newer); failed.version = '2026.12.1'; failed.set('wwmi_dx12.addon64', Buffer.concat([pe(), Buffer.from('failed version')]));
  await assert.rejects(f.components.update(f.paths, 'addon', failed, { validate: async () => { throw Error('validation failed'); } }), /validation failed/);
  assert.deepEqual(fs.readFileSync(disabled), before); assert.equal(f.components.describe(f.paths, 'addon').version, '2026.11.1');
  const userDll = f.write(path.join(f.paths.win64, 'dxgi.dll'), Buffer.from('user supplied runtime'));
  const reshade = new Map(f.bundles.reshade); reshade.version = '6.9.0'; let cached = false;
  assert.equal((await f.components.update(f.paths, 'reshade', reshade, { commit: async () => { cached = true; } })).cached, true);
  assert.equal(cached, true); assert.equal(fs.readFileSync(userDll, 'utf8'), 'user supplied runtime');
});
