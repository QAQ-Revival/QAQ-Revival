const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const files = require('../app/src/main/games/arknights/files.cjs');
const { inspectAppearance, inspectAppearances } = require('../app/src/main/games/arknights/appearance.cjs');

function fixture(t, count = 1200) {
  const base = path.resolve(__dirname, '../test-results');
  fs.mkdirSync(base, { recursive: true });
  const root = fs.mkdtempSync(path.join(base, 'library-performance-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const resources = Array.from({ length: count }, (_, index) => {
    const name = `char_1001_amiya2_2__page${index}.png`;
    fs.writeFileSync(path.join(root, name), 'fixture');
    return { file: name, target: name, bundle: 'arts/dynchars/char_1001_amiya2_2.ab' };
  });
  const manifest = path.join(root, files.RESOURCE_MANIFEST);
  fs.writeFileSync(manifest, JSON.stringify({ schemaVersion: 1, resources }));
  return { root, manifest, resources };
}

test('large appearance manifests are read once and ancestor checks scale with files', t => {
  const f = fixture(t);
  const originalRead = fs.readFileSync, originalStat = fs.lstatSync;
  let reads = 0, stats = 0;
  fs.readFileSync = function(file, ...args) { if (file === f.manifest) reads++; return originalRead.call(this, file, ...args); };
  fs.lstatSync = function(...args) { stats++; return originalStat.apply(this, args); };
  try {
    assert.deepEqual(inspectAppearance(f.root, []), { sectionId: 'base', sectionIds: ['base'], uncertain: false });
    assert.equal(reads, 1);
    assert.ok(stats < f.resources.length + 50, `${stats} link checks for ${f.resources.length} files`);
  } finally { fs.readFileSync = originalRead; fs.lstatSync = originalStat; }
});

test('background scans keep the main event loop responsive and read changed manifests on refresh', async t => {
  const f = fixture(t);
  let ticks = 0;
  const timer = setInterval(() => ticks++, 5);
  let results;
  try { results = await Promise.all([inspectAppearances([f.root], []), inspectAppearances([f.root], [])]); }
  finally { clearInterval(timer); }
  assert.ok(ticks > 0, 'The event loop continues while resources are scanned');
  assert.equal(results[0][0].sectionId, 'base');
  assert.deepEqual(results[0], results[1]);
  fs.writeFileSync(f.manifest, JSON.stringify({ schemaVersion: 1, resources: f.resources.map((r, index) => ({ ...r, target: `effect${index}.png`, bundle: 'skinpack/char_1001_amiya2.ab' })) }));
  assert.equal((await inspectAppearances([f.root], []))[0].sectionId, 'arknights:shared');
  fs.writeFileSync(f.manifest, '{}');
  await assert.rejects(inspectAppearances([f.root], []));
  fs.writeFileSync(f.manifest, JSON.stringify({ schemaVersion: 1, resources: f.resources }));
  assert.equal((await inspectAppearances([f.root], []))[0].sectionId, 'base');
});

test('manifest validation rechecks replaced directories and still rejects linked resources', t => {
  const f = fixture(t, 1);
  const nested = path.join(f.root, 'nested');
  fs.mkdirSync(nested);
  fs.writeFileSync(path.join(nested, 'page.png'), 'fixture');
  fs.writeFileSync(f.manifest, JSON.stringify({ schemaVersion: 1, resources: [{ file: 'nested/page.png', target: 'page.png', bundle: 'skinpack/char_1001_amiya2.ab' }] }));
  assert.equal(files.readBindings(f.root).bindings.size, 1);
  const moved = path.join(f.root, 'original');
  fs.renameSync(nested, moved);
  fs.symlinkSync(moved, nested, 'junction');
  assert.throws(() => files.readBindings(f.root), /链接/);
});
