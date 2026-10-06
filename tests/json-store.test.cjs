const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readJsonFileSync, writeJsonFileSync } = require('../app/out/main/json-store.cjs');
const failure = code => Object.assign(new Error(code), { code });
function fixture(t, previous) {
  const parent = fs.realpathSync(os.tmpdir());
  const directory = fs.mkdtempSync(path.join(parent, 'qaqm-json-store-'));
  const file = path.join(directory, 'state.json');
  if (previous !== undefined) fs.writeFileSync(file, JSON.stringify(previous));
  t.after(() => {
    t.mock.restoreAll();
    assert.equal(path.dirname(fs.realpathSync(directory)), parent);
    fs.rmSync(directory, { recursive: true, force: true });
  });
  return { file, directory };
}
function rejectRename(t, file, code = 'EXDEV') {
  const rename = fs.renameSync;
  t.mock.method(fs, 'renameSync', (from, to) => { if (to === file) throw failure(code); return rename(from, to); });
}
test('normal JSON saves replace the old value and leave no temporary files', t => {
  const f = fixture(t, { old: true });
  writeJsonFileSync(f.file, { next: '角色资料' });
  assert.deepEqual(readJsonFileSync(f.file), { next: '角色资料' });
  assert.deepEqual(fs.readdirSync(f.directory), ['state.json']);
});
for (const previous of [undefined, { old: '保留资料' }]) {
  test(`EXDEV supports ${previous ? 'replacing an existing file' : 'the first save'}`, t => {
    const f = fixture(t, previous);
    rejectRename(t, f.file);
    writeJsonFileSync(f.file, { next: true });
    assert.deepEqual(JSON.parse(fs.readFileSync(f.file, 'utf8')), { next: true });
    assert.deepEqual(fs.readdirSync(f.directory), ['state.json']);
  });
}
test('unrelated rename failures are reported without copying over the old file', t => {
  const f = fixture(t, { old: true });
  rejectRename(t, f.file, 'EACCES');
  const copy = t.mock.method(fs, 'copyFileSync', () => assert.fail('Unexpected copy'));
  assert.throws(() => writeJsonFileSync(f.file, { next: true }), { code: 'EACCES' });
  assert.equal(copy.mock.callCount(), 0);
  assert.deepEqual(readJsonFileSync(f.file), { old: true });
  assert.deepEqual(fs.readdirSync(f.directory), ['state.json']);
});
test('a failed fallback copy restores the previous JSON even after truncating the destination', t => {
  const f = fixture(t, { old: true });
  rejectRename(t, f.file);
  t.mock.method(fs, 'copyFileSync', (_, to) => { fs.writeFileSync(to, '{partial'); throw failure('ENOSPC'); });
  assert.throws(() => writeJsonFileSync(f.file, { next: true }), { code: 'ENOSPC' });
  assert.deepEqual(JSON.parse(fs.readFileSync(f.file, 'utf8')), { old: true });
  assert.deepEqual(fs.readdirSync(f.directory), ['state.json']);
});
test('failed rollback keeps old JSON readable and a later save can recover', t => {
  const f = fixture(t, { old: true });
  rejectRename(t, f.file);
  const write = fs.writeFileSync;
  const writeMock = t.mock.method(fs, 'writeFileSync', (file, ...args) => {
    if (file === f.file) throw failure('EACCES');
    return write(file, ...args);
  });
  const copyMock = t.mock.method(fs, 'copyFileSync', (_, to) => { write(to, '{partial'); throw failure('ENOSPC'); });
  assert.throws(() => writeJsonFileSync(f.file, { next: true }), { code: 'ENOSPC' });
  assert.equal(fs.readFileSync(f.file, 'utf8'), '{partial');
  assert.deepEqual(readJsonFileSync(f.file), { old: true });
  writeMock.mock.restore(); copyMock.mock.restore();
  writeJsonFileSync(f.file, { recovered: true });
  assert.deepEqual(readJsonFileSync(f.file), { recovered: true });
  assert.deepEqual(fs.readdirSync(f.directory), ['state.json']);
});
test('a failed first save removes the incomplete file so startup can still use defaults', t => {
  const f = fixture(t);
  rejectRename(t, f.file);
  t.mock.method(fs, 'copyFileSync', (_, to) => { fs.writeFileSync(to, '{partial'); throw failure('ENOSPC'); });
  assert.throws(() => writeJsonFileSync(f.file, []), { code: 'ENOSPC' });
  assert.throws(() => readJsonFileSync(f.file), { code: 'ENOENT' });
  assert.deepEqual(fs.readdirSync(f.directory), []);
});
test('failure to prepare the rollback snapshot leaves the original file intact', t => {
  const f = fixture(t, { old: true });
  rejectRename(t, f.file);
  const write = fs.writeFileSync;
  t.mock.method(fs, 'writeFileSync', (file, ...args) => {
    if (file === f.file + '.backup') { write(file, '{partial'); throw failure('ENOSPC'); }
    return write(file, ...args);
  });
  assert.throws(() => writeJsonFileSync(f.file, { next: true }), { code: 'ENOSPC' });
  assert.deepEqual(readJsonFileSync(f.file), { old: true });
  assert.deepEqual(fs.readdirSync(f.directory), ['state.json']);
});
