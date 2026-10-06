const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createIndependentFixer } = require('../app/out/main/independent-fixer.cjs');

function fixture(t, overrides = {}) {
  const base = fs.realpathSync(os.tmpdir());
  const dir = fs.mkdtempSync(path.join(base, 'qaqm-fixer-test-'));
  t.after(() => {
    assert.equal(path.dirname(fs.realpathSync(dir)), base);
    assert.ok(path.basename(dir).startsWith('qaqm-fixer-test-'));
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const exe = path.join(dir, "修复器 & Tester's tool.exe");
  fs.writeFileSync(exe, 'Synthetic executable; never run');
  const configPath = path.join(dir, 'preferences.json');
  fs.writeFileSync(configPath, '{}');
  const read = () => JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const calls = { selections: [], launches: [] };
  const dependencies = {
    getSavedPath: game => read()[game],
    savePath: (game, file) => fs.writeFileSync(configPath, JSON.stringify({ ...read(), [game]: file })),
    findExisting: () => null,
    selectFile: async game => { calls.selections.push(game); return { canceled: false, filePaths: [exe] }; },
    launch: async (file, cwd) => { calls.launches.push({ file, cwd }); return { success: true }; },
    ...overrides
  };
  return { dir, exe, read, calls, dependencies, service: createIndependentFixer(dependencies) };
}

test('missing fixer prompts, persists its original path, launches beside dependencies, and survives reload', async t => {
  const f = fixture(t);
  assert.equal((await f.service.open('wuwa')).success, true);
  assert.equal(f.read().wuwa, f.exe);
  assert.deepEqual(f.calls.launches, [{ file: f.exe, cwd: f.dir }]);
  const reloaded = createIndependentFixer(f.dependencies);
  assert.equal((await reloaded.open('wuwa')).success, true);
  assert.equal(f.calls.selections.length, 1);
  assert.equal(fs.readFileSync(f.exe, 'utf8'), 'Synthetic executable; never run');
});
test('detected standalone fixer launches without prompting or saving another path', async t => {
  const f = fixture(t);
  f.dependencies.findExisting = () => f.exe;
  assert.equal((await createIndependentFixer(f.dependencies).open('wuwa')).success, true);
  assert.equal(f.calls.selections.length, 0);
  assert.deepEqual(f.read(), {});
});
test('missing saved path prompts again instead of falling back to a different bundled tool', async t => {
  const f = fixture(t);
  f.dependencies.savePath('wuwa', path.join(f.dir, 'moved.exe'));
  f.dependencies.findExisting = () => assert.fail('Do not silently replace the chosen tool');
  assert.equal((await createIndependentFixer(f.dependencies).open('wuwa')).success, true);
  assert.equal(f.calls.selections.length, 1);
  assert.equal(f.read().wuwa, f.exe);
});
test('cancelling selection neither launches nor overwrites the saved path', async t => {
  const f = fixture(t, { selectFile: async () => ({ canceled: true, filePaths: [] }) });
  const missing = path.join(f.dir, 'missing.exe');
  f.dependencies.savePath('wuwa', missing);
  assert.deepEqual(await f.service.open('wuwa'), { success: false, canceled: true });
  assert.equal(f.read().wuwa, missing);
  assert.equal(f.calls.launches.length, 0);
});
test('each game remembers its own selection', async t => {
  const f = fixture(t);
  await f.service.open('wuwa');
  const second = path.join(f.dir, 'second.exe');
  fs.writeFileSync(second, 'Second fixture');
  f.dependencies.selectFile = async () => ({ filePaths: [second] });
  await createIndependentFixer(f.dependencies).open('zzz');
  assert.deepEqual(f.read(), { wuwa: f.exe, zzz: second });
});
test('directories and non-executables are rejected without saving or launching', async t => {
  const f = fixture(t);
  const directory = path.join(f.dir, 'directory.exe');
  fs.mkdirSync(directory);
  for (const invalid of [directory, path.join(f.dir, 'preferences.json'), path.join(f.dir, 'missing.exe')]) {
    const service = createIndependentFixer({ ...f.dependencies, selectFile: async () => ({ filePaths: [invalid] }) });
    assert.equal((await service.open('wuwa')).success, false);
  }
  assert.deepEqual(f.read(), {});
  assert.equal(f.calls.launches.length, 0);
});
test('save failures are reported without launching an unsaved selection', async t => {
  const f = fixture(t, { savePath: () => { throw Error('Unable to save'); } });
  assert.deepEqual(await f.service.open('wuwa'), { success: false, error: 'Unable to save' });
  assert.equal(f.calls.launches.length, 0);
});
test('launch failures are reported and allow another attempt', async t => {
  let attempts = 0;
  const f = fixture(t, { launch: async () => { attempts++; throw Error('Access denied'); } });
  assert.equal((await f.service.open('wuwa')).error, 'Access denied');
  assert.equal((await f.service.open('wuwa')).error, 'Access denied');
  assert.equal(attempts, 2);
  assert.equal(f.calls.selections.length, 1);
});
test('concurrent clicks share one file picker and one launch', async t => {
  const f = fixture(t);
  const [first, second] = await Promise.all([f.service.open('wuwa'), f.service.open('wuwa')]);
  assert.equal(first.success, true);
  assert.deepEqual(second, first);
  assert.equal(f.calls.selections.length, 1);
  assert.equal(f.calls.launches.length, 1);
});
test('changing a fixer saves the new file without launching it', async t => {
  const f = fixture(t);
  f.dependencies.savePath('wuwa', path.join(f.dir, 'old.exe'));
  assert.equal((await f.service.select('wuwa')).success, true);
  assert.equal(f.read().wuwa, f.exe);
  assert.equal(f.calls.launches.length, 0);
});
