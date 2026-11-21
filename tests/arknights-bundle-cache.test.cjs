const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildGeneration, evaluate, record, leftoverBuilds, discard } = require('../app/src/main/games/arknights/bundle-cache.cjs');

const manifest = (sourceCommit, capabilities = ['current-pc-bundle-rebuild', 'incremental-bundle-build-v1']) => ({ protocol: 1, sourceCommit, capabilities, files: { 'loader/ArkLoader.exe': sourceCommit } });
const gamePath = 'D:\\Games\\Arknights\\Arknights.exe';
const current = (commit, capabilities) => ({ generation: buildGeneration(manifest(commit, capabilities)), gamePath, resourceFingerprint: 'resources' });

test('a rebuilt tools package keeps the bundle cache', () => {
  const state = record(current('aaaa'), { bundleCount: 2409, resourceCount: 28458 });
  assert.deepEqual(evaluate(state, current('bbbb')), { reusable: true, unchanged: true });
  assert.deepEqual([state.bundleCount, state.resourceCount], [2409, 28458]);
});

test('changed resources rebuild from the cache instead of from nothing', () => {
  const state = record(current('aaaa'), { bundleCount: 1, resourceCount: 1 });
  assert.deepEqual(evaluate(state, { ...current('bbbb'), resourceFingerprint: 'edited' }), { reusable: true, unchanged: false });
});

test('only a new build generation discards the cache; a moved game rebuilds from it', () => {
  const state = record(current('aaaa'), { bundleCount: 1, resourceCount: 1 });
  assert.deepEqual(evaluate(state, current('aaaa', ['incremental-bundle-build-v2'])), { reusable: false, unchanged: false });
  assert.deepEqual(evaluate(state, { ...current('aaaa'), gamePath: 'E:\\Arknights.exe' }), { reusable: true, unchanged: false });
});

test('leftover builds are found by their exact names and removed without following links', t => {
  const base = path.resolve(__dirname, '../test-results'); fs.mkdirSync(base, { recursive: true });
  const root = fs.mkdtempSync(path.join(base, 'ark-cache-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const stopped = path.join(root, '.qaqr-bundles-s0e9ne2l'), finished = path.join(root, 'bundle-build-0f8fad5b-d9cb-469f-a165-70867728950e');
  const kept = ['PC-Bundles', 'PC-Bundles.previous', 'Resources', 'bundle-build-notes', '.qaqr-bundles-', 'conversion-0f8fad5b-d9cb-469f-a165-70867728950e'].map(name => path.join(root, name));
  for (const directory of [stopped, finished, ...kept]) { fs.mkdirSync(path.join(directory, 'bundles'), { recursive: true }); fs.writeFileSync(path.join(directory, 'bundles/a.ab'), 'bundle'); }
  fs.writeFileSync(path.join(root, '.qaqr-bundles-aaaaaaaa'), 'a file, not a build');
  const outside = path.join(root, 'Resources'), link = path.join(root, '.qaqr-bundles-linked00');
  fs.symlinkSync(outside, link, 'junction');
  assert.deepEqual(leftoverBuilds(root), [stopped, finished].sort());
  assert.deepEqual(leftoverBuilds(path.join(root, 'missing')), []);
  discard([...leftoverBuilds(root), path.join(root, 'missing')]);
  assert.deepEqual(leftoverBuilds(root), []);
  for (const directory of kept) assert.equal(fs.readFileSync(path.join(directory, 'bundles/a.ab'), 'utf8'), 'bundle');
});

test('builds recorded with the package hash carry over as generation 1', () => {
  const state = { schemaVersion: 2, resourceFingerprint: 'resources', componentFingerprint: 'c'.repeat(64), gamePath, bundleCount: 1, resourceCount: 1 };
  assert.deepEqual(evaluate(state, current('bbbb')), { reusable: true, unchanged: true });
  assert.deepEqual(evaluate(state, current('bbbb', ['incremental-bundle-build-v2'])), { reusable: false, unchanged: false });
  assert.deepEqual(evaluate({ ...state, schemaVersion: 1 }, current('bbbb')), { reusable: false, unchanged: false });
});

test('a package without a build generation is keyed by its whole manifest', () => {
  const state = record(current('aaaa', []), { bundleCount: 1, resourceCount: 1 });
  assert.deepEqual(evaluate(state, current('aaaa', [])), { reusable: true, unchanged: true });
  assert.deepEqual(evaluate(state, current('bbbb', [])), { reusable: false, unchanged: false });
  assert.deepEqual(evaluate(null, current('aaaa')), { reusable: false, unchanged: false });
});
