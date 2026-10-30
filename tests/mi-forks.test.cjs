const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { createMiForksService, hasUnsafeApproval } = require('../app/src/main/install/mi-forks.cjs');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const files = ['Core/EFMI/MergedSkeleton.ini', 'Core/EFMI/Shaders/MergedSkeleton_InstanceConfigOverrider_ConstantBuffer.hlsl', 'Core/EFMI/Shaders/MergedSkeleton_InstanceConfigOverrider_ConstantBuffer.cs_5_0.8000.bin'];
function fixture(t) {
  const temporary = fs.realpathSync(os.tmpdir()), root = fs.mkdtempSync(path.join(temporary, 'qaqr-mi-forks-'));
  t.after(() => { assert.equal(path.dirname(fs.realpathSync(root)), temporary); fs.rmSync(root, { recursive: true, force: true }); });
  const launcherRoot = path.join(root, 'launcher'), miRoot = path.join(launcherRoot, 'EFMI'), app = path.join(root, 'app');
  const write = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, value); };
  write(path.join(miRoot, 'd3dx.ini'), '[Constants]\n');
  write(path.join(miRoot, 'd3d11.dll'), 'official');
  write(path.join(miRoot, 'd3dx_user.ini'), 'persistent-state');
  write(path.join(miRoot, 'Mods/kept.ini'), 'keep mod');
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
    compatibleFiles[relative] = [index === 2 ? null : sha('original core ' + index)];
    if (index !== 2) write(path.join(miRoot, relative), 'original core ' + index);
  }
  bundle('efmi-core', 'EFMI-Package', core, { compatibleFiles });
  const service = createMiForksService({ bundleRoots: [app], resolveInstallation: () => ({ launcherRoot, miRoot }), backupRoot: path.join(root, 'repairs'), userName });
  return { root, app, launcherRoot, miRoot, service, configFile, configuration, write };
}

test('maintained MI activation requires the Launcher user consent and never creates it', t => {
  const f = fixture(t);
  assert.equal(hasUnsafeApproval(f.launcherRoot, 'EFMI', 'different-user'), false);
  f.configuration.Importers.EFMI.Migoto.unsafe_mode = false;
  f.write(f.configFile, JSON.stringify(f.configuration));
  const before = fs.readFileSync(f.configFile);
  assert.throws(() => f.service.apply('endfield'), { code: 'approvalRequired' });
  assert.deepEqual(fs.readFileSync(f.configFile), before);
  assert.equal(fs.readFileSync(path.join(f.miRoot, 'd3d11.dll'), 'utf8'), 'official');
  assert.equal(fs.existsSync(path.join(f.root, 'repairs')), false);
});

test('runtime and EFMI files install and restore together while keeping settings and Mods', t => {
  const f = fixture(t), configuration = fs.readFileSync(f.configFile);
  const result = f.service.apply('endfield');
  assert(result.backup.startsWith(path.join(f.root, 'repairs')));
  assert.equal(f.service.status('endfield').managed, true);
  assert.equal(fs.readFileSync(path.join(f.miRoot, 'd3d11.dll'), 'utf8'), 'maintained runtime');
  for (const [index, relative] of files.entries()) assert.equal(fs.readFileSync(path.join(f.miRoot, relative), 'utf8'), 'repaired core ' + index);
  assert.deepEqual(fs.readFileSync(f.configFile), configuration);
  assert.equal(fs.readFileSync(path.join(f.miRoot, 'd3dx_user.ini'), 'utf8'), 'persistent-state');
  assert.equal(fs.readFileSync(path.join(f.miRoot, 'Mods/kept.ini'), 'utf8'), 'keep mod');
  f.service.restore('endfield');
  assert.equal(fs.readFileSync(path.join(f.miRoot, 'd3d11.dll'), 'utf8'), 'official');
  assert.equal(fs.existsSync(path.join(f.miRoot, files[2])), false);
  assert.equal(f.service.status('endfield').managed, false);
  assert(!fs.readdirSync(f.miRoot, { recursive: true }).some(name => name.includes('.qaqr-update-')));
});

test('unknown runtime changes are not overwritten by install or restore', t => {
  const f = fixture(t);
  f.write(path.join(f.miRoot, 'd3d11.dll'), 'unknown runtime');
  assert.throws(() => f.service.apply('endfield'), { code: 'unknownRuntime' });
  f.write(path.join(f.miRoot, 'd3d11.dll'), 'official');
  f.service.apply('endfield');
  f.write(path.join(f.miRoot, files[0]), 'external update');
  assert.equal(f.service.status('endfield').modified, true);
  assert.throws(() => f.service.restore('endfield'), { code: 'modified' });
  assert.equal(fs.readFileSync(path.join(f.miRoot, files[0]), 'utf8'), 'external update');
});

test('a mid-install failure rolls back written files and preserves the original configuration', t => {
  const f = fixture(t), originalRename = fs.renameSync;
  let failed = false;
  fs.renameSync = (from, to) => {
    if (!failed && to === path.join(f.miRoot, files[0])) { failed = true; throw Object.assign(Error('test sharing violation'), { code: 'EBUSY' }); }
    return originalRename(from, to);
  };
  try { assert.throws(() => f.service.apply('endfield'), /sharing violation/); }
  finally { fs.renameSync = originalRename; }
  assert.equal(fs.readFileSync(path.join(f.miRoot, 'd3d11.dll'), 'utf8'), 'official');
  assert.equal(fs.readFileSync(path.join(f.miRoot, files[0]), 'utf8'), 'original core 0');
  assert.equal(f.service.status('endfield').managed, false);
  assert.equal(f.service.status('endfield').recoveryRequired, false);
});
