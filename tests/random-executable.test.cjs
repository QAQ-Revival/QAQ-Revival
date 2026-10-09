const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { prepareExecutable, readIdentity, releaseExecutable, cleanupExecutables, launchRandomExecutable, startRandomManager } = require('../app/out/main/random-executable.cjs');
const { readRandomLaunchSettings } = require('../app/out/main/random-executable.cjs');
const { executableNameFields } = require('../app/out/main/executable-name.cjs');
function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'qaq-runtime-'));
  t.after(() => { assert.equal(path.dirname(fs.realpathSync(directory)), fs.realpathSync(os.tmpdir())); fs.rmSync(directory, { recursive: true, force: true }); });
  const source = path.join(directory, 'QAQ-Revival.exe'); fs.writeFileSync(source, 'original executable bytes');
  return { source, directory };
}
test('random copies preserve exact bytes, use distinct names and leave original and unrelated files alone', t => {
  const { source, directory } = fixture(t);
  const a = prepareExecutable(source), b = prepareExecutable(source);
  assert.notEqual(a.executable, b.executable); assert.equal(path.dirname(a.executable), directory);
  assert.ok(fs.readFileSync(a.executable).equals(fs.readFileSync(source)));
  assert.ok(readIdentity(b.executable, source));
  const userFile = path.join(directory, 'r' + 'a'.repeat(24) + '.exe'); fs.writeFileSync(userFile, 'user-owned');
  fs.appendFileSync(b.executable, 'unexpected modification');
  assert.equal(releaseExecutable(b.executable, source), false);
  cleanupExecutables(source);
  assert.ok(fs.existsSync(a.executable), 'A child may still be starting');
  assert.equal(releaseExecutable(a.executable, source), true);
  assert.equal(fs.readFileSync(userFile, 'utf8'), 'user-owned');
  assert.equal(fs.readFileSync(source, 'utf8'), 'original executable bytes');
});
test('random launch preserves cwd and arguments, propagates cancellation and removes failed copies', async t => {
  const { source, directory } = fixture(t); let launched;
  const args = ['--nogui', '--xxmi', 'GIMI', 'with spaces'];
  const result = await launchRandomExecutable(source, directory, args, async (file, cwd, argv) => {
    launched = file; assert.notEqual(file, source); assert.equal(cwd, directory); assert.deepEqual(argv, args);
    return { success: false, error: 'UAC cancelled' };
  });
  assert.deepEqual(result, { success: false, error: 'UAC cancelled' }); assert.equal(fs.existsSync(launched), false);
  assert.equal((await launchRandomExecutable(path.join(directory, 'missing.exe'), directory, [], () => assert.fail('Must not launch'))).success, false);
});
test('manager handoff runs one random image, changes name again on a fresh launch, and honors replaced originals', t => {
  const { source, directory } = fixture(t);
  const manifestPath = path.join(directory, 'package.json'); fs.writeFileSync(manifestPath, JSON.stringify({ main: './out/main/index.js' }));
  const relaunches = [], exits = [];
  const app = { isPackaged: true, relaunch: options => relaunches.push(options), exit: code => exits.push(code) };
  const args = ['--some-option', 'with spaces'];
  assert.equal(startRandomManager(app, { execPath: source, args, manifestPath }).relaunched, true);
  const first = relaunches[0].execPath; assert.deepEqual(relaunches[0].args, args); assert.deepEqual(exits, [0]);
  assert.equal(startRandomManager(app, { execPath: first, args, manifestPath }).relaunched, false);
  assert.equal(startRandomManager(app, { execPath: first, args, manifestPath }).relaunched, true, 'A pinned old random executable must not reuse its session name');
  const second = relaunches.at(-1).execPath; assert.notEqual(second, first);
  fs.writeFileSync(source, 'updated executable bytes');
  assert.equal(startRandomManager(app, { execPath: second, args, manifestPath }).relaunched, true);
  assert.equal(fs.readFileSync(relaunches.at(-1).execPath, 'utf8'), 'updated executable bytes');
  fs.writeFileSync(manifestPath, JSON.stringify({ main: './smoke-entry.cjs' }));
  assert.equal(startRandomManager(app, { execPath: source, manifestPath }).name, null);
});
test('global opt-out reads the existing profile, recovers its backup, and returns an old random shortcut to the stable executable', t => {
  const { source, directory } = fixture(t);
  fs.writeFileSync(path.join(directory, 'config.json.bak'), JSON.stringify({ randomLaunch: { manager: false, xxmi: true } }));
  fs.writeFileSync(path.join(directory, 'config.json'), '{broken');
  assert.deepEqual(readRandomLaunchSettings(directory), { manager: false, xxmi: true });
  const manifestPath = path.join(directory, 'package.json'); fs.writeFileSync(manifestPath, JSON.stringify({ main: './out/main/index.js' }));
  let requested;
  const app = { isPackaged: true, relaunch: value => { requested = value; }, exit: () => {} };
  assert.equal(startRandomManager(app, { execPath: source, manifestPath, enabled: false }).relaunched, false);
  assert.equal(requested, undefined);
  const alias = prepareExecutable(source);
  assert.equal(startRandomManager(app, { execPath: alias.executable, manifestPath, enabled: false }).relaunched, true);
  assert.equal(requested.execPath, source);
});

test('QAQ and XXMI copies randomize Windows display names without changing code, version or appended launcher data', t => {
  const { source } = fixture(t);
  for (const product of ['QAQ-Revival', 'XXMI Launcher']) {
    const resource = require('../tools/version-resource.cjs').versionResource(product, '1.2.3');
    const original = Buffer.alloc(2048 + 29, 0);
    original.write('MZ'); original.writeUInt32LE(128, 60); original.write('PE\0\0', 128);
    original.writeUInt16LE(0x8664, 132); original.writeUInt16LE(1, 134); original.writeUInt16LE(240, 148);
    original.writeUInt16LE(0x20b, 152); original.writeUInt32LE(0x1000, 280); original.writeUInt32LE(1536, 284);
    original.write('.rsrc', 392); original.writeUInt32LE(0x1000, 404); original.writeUInt32LE(1536, 408); original.writeUInt32LE(512, 412);
    for (const [offset, id, target] of [[512, 16, 24], [536, 1, 48], [560, 1033, 72]]) {
      original.writeUInt16LE(1, offset + 14); original.writeUInt32LE(id, offset + 16);
      original.writeUInt32LE((target + (offset === 560 ? 0 : 0x80000000)) >>> 0, offset + 20);
    }
    original.writeUInt32LE(0x1000 + 96, 584); original.writeUInt32LE(resource.length, 588);
    resource.copy(original, 608); original.write('launcher payload must survive', 2048);
    if (product === 'XXMI Launcher') for (const field of executableNameFields(original)) {
      original.writeUInt16LE(original.readUInt16LE(field.header + 2) * 2, field.header + 2);
    }
    fs.writeFileSync(source, original);
    const prepared = prepareExecutable(source);
    const patched = fs.readFileSync(prepared.executable), fields = executableNameFields(patched);
    assert.equal(fields.length, 4);
    for (const field of fields) {
      const expected = prepared.name + (field.key === 'OriginalFilename' ? '.exe' : '');
      assert.equal(patched.toString('utf16le', field.value, field.value + field.length).replace(/\0.*$/s, ''), expected);
      // Mask exactly the four string payloads and their lengths before comparing.
      original.copy(patched, field.header + 2, field.header + 2, field.header + 4);
      original.copy(patched, field.value, field.value, field.value + field.length);
    }
    assert.deepEqual(patched, original);
    assert.deepEqual(fs.readFileSync(source), original);
    const identity = readIdentity(prepared.executable, source);
    assert.equal(identity.version, 2); assert.notEqual(identity.sha256, identity.sourceSha256);
    assert.equal(releaseExecutable(prepared.executable, source), true);
  }
});
