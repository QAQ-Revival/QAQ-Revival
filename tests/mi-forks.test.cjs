const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { createMiForksService, hasUnsafeApproval } = require('../app/src/main/install/mi-forks.cjs');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const files = ['Core/EFMI/MergedSkeleton.ini', 'Core/EFMI/Shaders/MergedSkeleton_InstanceConfigOverrider_ConstantBuffer.hlsl', 'Core/EFMI/Shaders/MergedSkeleton_InstanceConfigOverrider_ConstantBuffer.cs_5_0.8000.bin'];
const crlf = index => 'official core ' + index + '\r\n';
function fixture(t) {
  const temporary = fs.realpathSync(os.tmpdir()), root = fs.mkdtempSync(path.join(temporary, 'qaqr-mi-forks-'));
  t.after(() => { assert.equal(path.dirname(fs.realpathSync(root)), temporary); fs.rmSync(root, { recursive: true, force: true }); });
  const launcherRoot = path.join(root, 'launcher'), miRoot = path.join(launcherRoot, 'EFMI'), app = path.join(root, 'app');
  const write = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, value); };
  write(path.join(miRoot, 'd3dx.ini'), '[Constants]\n');
  write(path.join(miRoot, 'd3d11.dll'), 'official');
  write(path.join(miRoot, 'd3dx_user.ini'), 'persistent-state');
  write(path.join(miRoot, 'Mods/kept.ini'), 'keep mod');
  write(path.join(launcherRoot, 'Resources/Packages/XXMI/d3d11.dll'), 'official');
  write(path.join(launcherRoot, 'Resources/Packages/XXMI/Manifest.json'), JSON.stringify({ version: '1.2.2' }));
  write(path.join(launcherRoot, 'Resources/Packages/EFMI/Manifest.json'), JSON.stringify({ version: '1.4.8' }));
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'secp384r1' });
  const userName = 'qaqr-fixture';
  const signature = crypto.sign('sha256', Buffer.from(userName), privateKey).toString('base64');
  const configuration = { Importers: { EFMI: { Migoto: { unsafe_mode: true, unsafe_mode_signature: signature } } }, Launcher: { active_importer: 'EFMI', customPreference: 'keep' } };
  const configFile = path.join(launcherRoot, 'XXMI Launcher Config.json');
  write(configFile, JSON.stringify(configuration));
  write(path.join(launcherRoot, 'Resources/Security/public_key.der'), publicKey.export({ type: 'spki', format: 'der' }).toString('base64'));
  function bundle(name, repository, contents, extra) {
    const directory = path.join(app, 'local-components', name), hashes = {};
    for (const [relative, bytes] of Object.entries(contents)) { write(path.join(directory, relative), bytes); hashes[relative] = sha(bytes); }
    write(path.join(directory, 'component.json'), JSON.stringify({ source: 'https://github.com/QAQ-Revival/' + repository, sourceCommit: 'a'.repeat(40), files: hashes, ...extra }));
  }
  bundle('xxmi-runtime', 'XXMI-Libs-Package', { 'd3d11.dll': 'maintained runtime' }, { activityProtocol: 1, compatibleRuntimeHashes: [sha('official')] });
  const core = {}, compatibleFiles = {};
  for (const [index, relative] of files.entries()) {
    core[relative] = 'repaired core ' + index;
    compatibleFiles[relative] = [sha('earlier fix ' + index), null];
    if (index !== 2) { core['official/' + relative] = crlf(index); write(path.join(miRoot, relative), crlf(index)); }
  }
  bundle('efmi-core', 'EFMI-Package', core, { compatibleFiles, official: { version: '1.4.8', commit: 'b'.repeat(40), files: files.slice(0, 2) } });
  const service = createMiForksService({ bundleRoots: [app], resolveInstallation: () => ({ launcherRoot, miRoot }), userName });
  const component = (id, gameId = 'endfield') => service.status(gameId).components.find(item => item.id === id);
  return { root, app, launcherRoot, miRoot, service, component, configFile, configuration, write };
}

test('only the custom DLL needs Launcher consent, and QAQR never creates it', t => {
  const f = fixture(t);
  assert.equal(hasUnsafeApproval(f.launcherRoot, 'EFMI', 'different-user'), false);
  f.configuration.Importers.EFMI.Migoto.unsafe_mode = false;
  f.write(f.configFile, JSON.stringify(f.configuration));
  const before = fs.readFileSync(f.configFile);
  assert.throws(() => f.service.change('endfield', 'runtime', 'fork'), { code: 'approvalRequired' });
  assert.equal(fs.readFileSync(path.join(f.miRoot, 'd3d11.dll'), 'utf8'), 'official');
  assert.equal(f.component('core').needsApproval, false);
  f.service.change('endfield', 'core', 'fork');
  assert.equal(f.component('core').local.kind, 'fork');
  assert.deepEqual(fs.readFileSync(f.configFile), before);
});

test('the two forks switch independently, keep settings and Mods, and leave no backups behind', t => {
  const f = fixture(t), configuration = fs.readFileSync(f.configFile);
  assert.deepEqual(f.component('runtime').local, { kind: 'official', version: '1.2.2' });
  assert.deepEqual(f.component('core').local, { kind: 'official', version: '1.4.8' });

  f.service.change('endfield', 'runtime', 'fork');
  assert.equal(f.component('runtime').local.kind, 'fork');
  assert.equal(f.component('core').local.kind, 'official');
  assert.equal(fs.readFileSync(path.join(f.miRoot, files[0]), 'utf8'), crlf(0));

  f.service.change('endfield', 'core', 'fork');
  assert.equal(f.component('core').local.build, 'a'.repeat(12));
  for (const [index, relative] of files.entries()) assert.equal(fs.readFileSync(path.join(f.miRoot, relative), 'utf8'), 'repaired core ' + index);

  f.service.change('endfield', 'runtime', 'official');
  assert.equal(fs.readFileSync(path.join(f.miRoot, 'd3d11.dll'), 'utf8'), 'official');
  assert.equal(f.component('core').local.kind, 'fork');

  f.service.change('endfield', 'core', 'official');
  assert.equal(fs.readFileSync(path.join(f.miRoot, files[0]), 'utf8'), crlf(0));
  assert.equal(fs.existsSync(path.join(f.miRoot, files[2])), false);

  assert.deepEqual(fs.readFileSync(f.configFile), configuration);
  assert.equal(fs.readFileSync(path.join(f.miRoot, 'd3dx_user.ini'), 'utf8'), 'persistent-state');
  assert.equal(fs.readFileSync(path.join(f.miRoot, 'Mods/kept.ini'), 'utf8'), 'keep mod');
  assert.deepEqual(fs.readdirSync(f.root).sort(), ['app', 'launcher']);
  assert(!fs.readdirSync(f.miRoot, { recursive: true }).some(name => name.includes('.qaqr-update-')));
});

test('a Launcher update is read from disk instead of leaving a stale state behind', t => {
  const f = fixture(t);
  f.service.change('endfield', 'runtime', 'fork');
  f.service.change('endfield', 'core', 'fork');

  // A new XXMI package lands in the cache; with Unsafe Mode the Launcher leaves the custom DLL alone.
  f.write(path.join(f.launcherRoot, 'Resources/Packages/XXMI/d3d11.dll'), 'official next');
  f.write(path.join(f.launcherRoot, 'Resources/Packages/XXMI/Manifest.json'), JSON.stringify({ version: '1.2.3' }));
  assert.equal(f.component('runtime').local.kind, 'fork');
  assert.equal(f.component('runtime').official.version, '1.2.3');
  f.service.change('endfield', 'runtime', 'official');
  assert.equal(fs.readFileSync(path.join(f.miRoot, 'd3d11.dll'), 'utf8'), 'official next');
  assert.deepEqual(f.component('runtime').local, { kind: 'official', version: '1.2.3' });
  assert.equal(f.component('runtime').canUseFork, false);
  assert.match(f.component('runtime').reason, /1\.2\.3/);

  // A new EFMI package overwrites Core; the fix targets the old version, so nothing is switched over it.
  f.write(path.join(f.miRoot, files[0]), 'official next ini');
  f.write(path.join(f.miRoot, files[1]), 'official next hlsl');
  f.write(path.join(f.launcherRoot, 'Resources/Packages/EFMI/Manifest.json'), JSON.stringify({ version: '1.4.9' }));
  const core = f.component('core');
  assert.deepEqual(core.local, { kind: 'official', version: '1.4.9' });
  assert.equal(core.canUseFork, false);
  assert.throws(() => f.service.change('endfield', 'core', 'fork'), { code: 'coreMismatch' });
  assert.equal(fs.readFileSync(path.join(f.miRoot, files[0]), 'utf8'), 'official next ini');
});

test('identical fix files do not disguise an older Core as the bundled version', t => {
  const f = fixture(t);
  f.service.change('endfield', 'core', 'fork');
  f.write(path.join(f.miRoot, 'Core/EFMI/main.ini'), '[Constants]\nglobal $version = 1.47\n');
  const core = f.component('core');
  assert.deepEqual(core.local, { kind: 'outdated', version: '1.4.7' });
  assert.equal(core.canUpdateOfficial, true);
  assert.equal(core.canUseFork, false);
  assert.equal(core.canUseOfficial, false);
  assert.match(core.reason, /1\.4\.7/);
});

test('all supported MI games expose official runtime and Core updates', t => {
  const f = fixture(t);
  for (const [game, importer] of [['endfield', 'EFMI'], ['wuthering-waves', 'WWMI'], ['genshin-impact', 'GIMI'], ['zzz', 'ZZMI'], ['honkai-star-rail', 'SRMI']]) {
    f.write(path.join(f.miRoot, 'Core', importer, importer === 'WWMI' ? 'WuWa-Model-Importer.ini' : 'main.ini'), `global $${importer === 'WWMI' ? 'wwmi_' : ''}version = 1.48\n`);
    const state = f.service.status(game);
    assert.equal(state.components.length, 2);
    assert.equal(state.components.every(item => item.canUpdateOfficial), true);
    assert.equal(state.components[1].local.version, '1.4.8');
    if (importer !== 'EFMI') {
      assert.equal(state.components[1].switchable, false);
      assert.throws(() => f.service.change(game, 'core', 'fork'), { code: 'unsupported' });
    }
  }
});

test('older fixes can move either way, and unknown files are only replaced after confirmation', t => {
  const f = fixture(t);
  f.write(path.join(f.miRoot, files[0]), 'earlier fix 0');
  f.write(path.join(f.miRoot, files[1]), 'earlier fix 1');
  assert.equal(f.component('core').local.kind, 'outdated');
  assert.equal(f.component('core').canUseFork, true);
  assert.equal(f.component('core').canUseOfficial, true);
  f.service.change('endfield', 'core', 'fork');
  assert.equal(f.component('core').local.kind, 'fork');

  f.write(path.join(f.miRoot, files[0]), 'hand edit');
  assert.equal(f.component('core').local.kind, 'other');
  assert.throws(() => f.service.change('endfield', 'core', 'fork'), { code: 'unknownCore' });
  assert.throws(() => f.service.change('endfield', 'core', 'official'), { code: 'confirmRequired' });
  assert.equal(fs.readFileSync(path.join(f.miRoot, files[0]), 'utf8'), 'hand edit');
  f.service.change('endfield', 'core', 'official', { confirmed: true });
  assert.equal(f.component('core').local.kind, 'official');

  f.write(path.join(f.miRoot, 'd3d11.dll'), 'unknown runtime');
  assert.equal(f.component('runtime').local.kind, 'other');
  assert.throws(() => f.service.change('endfield', 'runtime', 'fork'), { code: 'unknownRuntime' });
  assert.throws(() => f.service.change('endfield', 'runtime', 'official'), { code: 'confirmRequired' });
  assert.equal(fs.readFileSync(path.join(f.miRoot, 'd3d11.dll'), 'utf8'), 'unknown runtime');

  // A build outside official and the fork, but on the compatible list, still asks before it is replaced.
  f.write(path.join(f.app, 'local-components/xxmi-runtime/component.json'), JSON.stringify({ ...JSON.parse(fs.readFileSync(path.join(f.app, 'local-components/xxmi-runtime/component.json'), 'utf8')), compatibleRuntimeHashes: [sha('official'), sha('unknown runtime')] }));
  assert.equal(f.component('runtime').canUseFork, true);
  assert.throws(() => f.service.change('endfield', 'runtime', 'fork'), { code: 'confirmRequired' });
  f.service.change('endfield', 'runtime', 'fork', { confirmed: true });
  assert.equal(f.component('runtime').local.kind, 'fork');
});

test('a failed switch rolls back the files it already wrote', t => {
  const f = fixture(t), originalRename = fs.renameSync;
  let failed = false;
  fs.renameSync = (from, to) => {
    if (!failed && to === path.join(f.miRoot, files[1])) { failed = true; throw Object.assign(Error('test sharing violation'), { code: 'EBUSY' }); }
    return originalRename(from, to);
  };
  try { assert.throws(() => f.service.change('endfield', 'core', 'fork'), { code: 'writeFailed' }); }
  finally { fs.renameSync = originalRename; }
  assert.equal(fs.readFileSync(path.join(f.miRoot, files[0]), 'utf8'), crlf(0));
  assert.equal(f.component('core').local.kind, 'official');
});
