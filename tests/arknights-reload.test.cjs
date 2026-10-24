const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createModReloader, modId } = require('../app/src/main/games/arknights/reload.cjs');
const { deploy } = require('../app/src/main/games/arknights/deployment.cjs');

function fixture(t) {
  const base = path.resolve(__dirname, '../test-results'); fs.mkdirSync(base, { recursive: true });
  const root = fs.mkdtempSync(path.join(base, 'ark-reload-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const p = { library: path.join(root, 'Mods'), destination: path.join(root, 'Resources'), bundleRoot: path.join(root, 'PC-Bundles'), gamePath: path.join(root, 'game/Arknights.exe') };
  const mod = path.join(p.library, 'operator', 'sample');
  fs.mkdirSync(mod, { recursive: true }); fs.mkdirSync(p.bundleRoot); fs.mkdirSync(path.dirname(p.gamePath));
  fs.writeFileSync(p.gamePath, 'fixture'); fs.writeFileSync(path.join(mod, 'char_001_demo.png'), 'image');
  fs.writeFileSync(path.join(p.bundleRoot, '.qaqr-generated'), 'arknights-bundles-v1');
  fs.writeFileSync(path.join(p.bundleRoot, 'manifest.tsv'), 'fixture');
  const active = { logical: 'skinpack/a.ab', inputs: [modId(mod) + '/char_001_demo.png'] };
  const other = { logical: 'skinpack/b.ab', inputs: ['unrelated/b.png'] };
  fs.writeFileSync(path.join(p.bundleRoot, 'bundle-index.json'), JSON.stringify({ schemaVersion: 1, bundles: [active, other] }));
  const runtime = { protocol: 2, pid: 42, manifest: path.join(p.bundleRoot, 'manifest.tsv'), lastPatch: '' };
  const requests = [], workers = [];
  let running = true, replyLost = false, mutate = false, remove = false;
  const reload = createModReloader({ paths: () => p, resolveMod: () => mod, characterIds: () => ['char_001_demo'], sync() {},
    async runNative(args) {
      requests.push(args);
      if (args[0] === '--status') return { success: true, running };
      if (args[0] === '--runtime-status') return { success: true, ...runtime };
      assert.equal(args[0], '--reload'); assert.deepEqual(args.slice(-2), ['--pid', '42']);
      runtime.lastPatch = args[2];
      if (replyLost) throw Error('lost reply');
      return { success: true, ...runtime };
    },
    async runWorker(payload) {
      workers.push(payload);
      fs.mkdirSync(payload.output, { recursive: true }); fs.writeFileSync(path.join(payload.output, 'manifest.tsv'), 'fixture');
      if (mutate) fs.writeFileSync(path.join(mod, 'char_001_demo.png'), 'changed while building');
      return { bundles: remove ? [] : [active], removedBundles: remove ? [active] : [] };
    }
  });
  return { p, mod, reload, runtime, requests, workers, other, configure(options) { ({ running = running, replyLost = replyLost, mutate = mutate, remove = remove } = options); } };
}

test('single-Mod reload preserves unrelated routes, recovers a lost reply, and uses the live index for disabling', async t => {
  const f = fixture(t); f.configure({ replyLost: true });
  const first = await f.reload({ characterName: 'operator', modName: 'sample' });
  assert.equal(first.autoReloaded, true); assert.equal(first.bundleCount, 1);
  assert.deepEqual(f.workers[0].affectedBundles, ['skinpack/a.ab']);
  const accepted = f.runtime.lastPatch;
  assert(fs.existsSync(accepted), 'Accepted patch must remain available to the runtime');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(path.dirname(accepted), 'bundle-index.json'))).bundles.find(b => b.logical === 'skinpack/b.ab'), f.other);
  f.configure({ remove: true, replyLost: false });
  await f.reload({ characterName: 'operator', modName: 'sample' });
  assert.deepEqual(f.workers[1].affectedBundles, ['skinpack/a.ab']);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(path.dirname(f.runtime.lastPatch), 'bundle-index.json'))).bundles, [f.other]);
  assert(f.requests.every(args => !['--launch', '--check'].includes(args[0])));
});

test('changed inputs, stopped games and legacy runtimes do not send reload patches', async t => {
  const f = fixture(t); f.configure({ running: false });
  assert.equal((await f.reload({ optional: true })).autoReloaded, false);
  await assert.rejects(f.reload({}), /QAQR/);
  assert.equal(f.workers.length, 0);
  f.configure({ running: true }); f.runtime.protocol = 1;
  await assert.rejects(f.reload({}), /接口|interfaces/); assert.equal(f.workers.length, 0);
  f.runtime.protocol = 2; f.configure({ mutate: true });
  await assert.rejects(f.reload({ characterName: 'operator', modName: 'sample' }), /变化|changed/i);
  assert.equal(f.requests.some(args => args[0] === '--reload'), false);
  assert.equal(fs.existsSync(f.workers[0].output), false);
});

test('resource sync reuses unrelated generated copies but force-refreshes the selected Mod', t => {
  const f = fixture(t), other = path.join(f.p.library, 'operator', 'other');
  fs.mkdirSync(other); fs.writeFileSync(path.join(other, 'other.png'), 'unrelated');
  const entries = [{ name: 'sample', path: f.mod }, { name: 'other', path: other }];
  const options = { ...f.p, entries };
  deploy(options);
  const source = path.join(f.mod, 'char_001_demo.png'), before = fs.statSync(source);
  fs.writeFileSync(source, 'new!!'); fs.utimesSync(source, before.atime, before.mtime);
  const copied = [];
  deploy({ ...options, changedModPath: f.mod, copy(from, to) { copied.push(from); fs.copyFileSync(from, to); } });
  assert.deepEqual(copied, [source]);
  assert.equal(fs.readFileSync(path.join(f.p.destination, modId(f.mod), 'char_001_demo.png'), 'utf8'), 'new!!');
  assert.equal(fs.readFileSync(path.join(f.p.destination, modId(other), 'other.png'), 'utf8'), 'unrelated');
});
