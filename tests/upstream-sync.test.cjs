const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { createPlan, synchronize, deploy, mergeUpstream, mergeOptional, fetchVersionTags, publishVersionTags } = require('../tools/sync.cjs');
const { checkoutConfig } = require('../tools/github-app-client.cjs');

// Git keeps its objects read-only, and fs.rmSync on Windows does not remove those by itself.
function clearReadOnly(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) clearReadOnly(file);
    else fs.chmodSync(file, 0o666);
  }
}

function fixture(t) {
  const temporary = fs.realpathSync(os.tmpdir());
  const directory = fs.mkdtempSync(path.join(temporary, 'qaqr-upstream-sync-'));
  const env = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
    GIT_AUTHOR_NAME: 'qaq-revival-publisher[bot]', GIT_COMMITTER_NAME: 'qaq-revival-publisher[bot]',
    GIT_AUTHOR_EMAIL: '338412940+qaq-revival-publisher[bot]@users.noreply.github.com', GIT_COMMITTER_EMAIL: '338412940+qaq-revival-publisher[bot]@users.noreply.github.com' };
  const git = (cwd, args, { allowed = [0] } = {}) => {
    const result = spawnSync('git', ['-c', 'credential.helper=', '-c', 'commit.gpgsign=false', ...args], { cwd, env, encoding: 'utf8', windowsHide: true });
    assert(allowed.includes(result.status), result.stderr);
    return { status: result.status, stdout: result.stdout.trim(), stderr: result.stderr.trim() };
  };
  const run = args => git(directory, args).stdout;
  const save = (file, text) => fs.writeFileSync(path.join(directory, file), text);
  const commit = () => { run(['add', '--all']); run(['commit', '-m', 'Add fixture state']); return run(['rev-parse', 'HEAD']); };
  run(['init', '--initial-branch=main']);
  save('shared.txt', 'original\n'); commit(); run(['branch', 'upstream']);
  t.after(() => { assert.equal(path.dirname(fs.realpathSync(directory)), temporary); clearReadOnly(directory); fs.rmSync(directory, { recursive: true, force: true }); });
  return { directory, git, run, save, commit };
}

test('upstream synchronization merges new work and retains downstream fix history', t => {
  const f = fixture(t);
  f.save('downstream.txt', 'local repair\n'); const repair = f.commit();
  f.run(['checkout', 'upstream']); f.save('upstream.txt', 'new feature\n'); f.commit(); f.run(['checkout', 'main']);
  assert.equal(mergeUpstream(f.git, f.directory, 'upstream'), true);
  f.run(['merge-base', '--is-ancestor', repair, 'HEAD']);
  f.run(['merge-base', '--is-ancestor', 'upstream', 'HEAD']);
  assert.equal(fs.readFileSync(path.join(f.directory, 'downstream.txt'), 'utf8'), 'local repair\n');
  assert.equal(f.run(['show', '-s', '--format=%an|%cn|%s']), 'qaq-revival-publisher[bot]|qaq-revival-publisher[bot]|Merge upstream');
  assert.equal(mergeUpstream(f.git, f.directory, 'upstream'), false);
});

test('a release tag added after its code was merged updates the build version without moving HEAD', t => {
  const f = fixture(t);
  f.run(['tag', 'v1.2.2']);
  f.save('upstream.txt', 'already merged release changes'); const head = f.commit();
  const upstream = path.join(f.directory, 'upstream.git'), origin = path.join(f.directory, 'origin.git');
  f.run(['clone', '--bare', '--no-hardlinks', f.directory, upstream]);
  f.run(['clone', '--bare', '--no-hardlinks', f.directory, origin]);
  f.run(['remote', 'add', 'upstream', upstream]); f.run(['remote', 'add', 'origin', origin]);
  f.git(upstream, ['tag', 'v1.2.3', head]);
  assert.equal(f.run(['describe', '--tags', '--abbrev=0']), 'v1.2.2');
  const refs = fetchVersionTags(f.git, f.directory, 'upstream');
  assert.equal(f.run(['describe', '--tags', '--abbrev=0']), 'v1.2.3');
  assert.equal(f.run(['rev-parse', 'HEAD']), head);
  publishVersionTags(f.git, f.directory, refs);
  assert.equal(f.git(origin, ['rev-parse', 'v1.2.3']).stdout, head);
  assert.doesNotThrow(() => publishVersionTags(f.git, f.directory, fetchVersionTags(f.git, f.directory, 'upstream')));
  f.git(upstream, ['tag', 'v1.2.3-nhd.32', head]);
  const vulkan = fetchVersionTags(f.git, f.directory, 'upstream', 'XXMI-Libs-Vulkan');
  assert.deepEqual(vulkan, [[head, 'refs/tags/v1.2.3-nhd.32']]);
  publishVersionTags(f.git, f.directory, vulkan);
  assert.equal(f.git(origin, ['rev-parse', 'v1.2.3-nhd.32']).stdout, head);
});

test('version tag synchronization rejects a different existing tag instead of replacing it', t => {
  const f = fixture(t);
  f.run(['tag', 'v1.2.2']);
  f.save('next.txt', 'next'); const head = f.commit();
  const upstream = path.join(f.directory, 'upstream.git');
  f.run(['clone', '--bare', '--no-hardlinks', f.directory, upstream]);
  f.run(['remote', 'add', 'upstream', upstream]);
  f.git(upstream, ['update-ref', 'refs/tags/v1.2.2', head]);
  const old = f.run(['rev-parse', 'v1.2.2']);
  assert.throws(() => fetchVersionTags(f.git, f.directory, 'upstream'), /Version tag differs/);
  assert.equal(f.run(['rev-parse', 'v1.2.2']), old);
});

test('a conflicting upstream edit stops without replacing the downstream commit', t => {
  const f = fixture(t);
  f.save('shared.txt', 'local repair\n'); const before = f.commit();
  f.run(['checkout', 'upstream']); f.save('shared.txt', 'upstream change\n'); f.commit(); f.run(['checkout', 'main']);
  assert.throws(() => mergeUpstream(f.git, f.directory, 'upstream'), /merge conflict/);
  assert.equal(f.run(['rev-parse', 'HEAD']), before);
  assert.match(fs.readFileSync(path.join(f.directory, 'shared.txt'), 'utf8'), /<<<<<<< HEAD/);
});

test('isolated bot Git preserves a Windows checkout and still detects real changes', t => {
  const f = fixture(t);
  f.run(['config', 'core.autocrlf', 'true']);
  const config = checkoutConfig(f.directory);
  const checkout = path.join(f.directory, 'windows-checkout');
  f.run([...config, 'clone', '--no-hardlinks', f.directory, checkout]);
  const run = args => f.git(checkout, args).stdout;
  assert.match(run(['status', '--porcelain']), /shared\.txt/);
  assert.equal(run([...config, 'status', '--porcelain']), '');
  fs.writeFileSync(path.join(checkout, 'shared.txt'), 'real edit\r\n');
  assert.match(run([...config, 'status', '--porcelain']), /shared\.txt/);
});

test('a fork allowed to fall behind is held back on a conflict or a failed check, with nothing left half merged', t => {
  const f = fixture(t);
  f.save('shared.txt', 'local repair\n'); const before = f.commit();
  f.run(['checkout', 'upstream']); f.save('shared.txt', 'upstream edit\n'); f.commit(); f.run(['checkout', 'main']);
  const conflict = mergeOptional(f.git, f.directory, 'upstream', () => {});
  assert.equal(conflict.changed, false);
  assert.match(conflict.skipped, /conflict/i);
  assert.equal(f.run(['rev-parse', 'HEAD']), before);
  assert.equal(f.run(['status', '--porcelain']), '');
  assert.equal(fs.readFileSync(path.join(f.directory, 'shared.txt'), 'utf8'), 'local repair\n');

  f.run(['branch', 'clean-upstream', before]);
  f.run(['checkout', 'clean-upstream']); f.save('other.txt', 'upstream feature\n'); f.commit(); f.run(['checkout', 'main']);
  const failed = mergeOptional(f.git, f.directory, 'clean-upstream', changed => { if (changed) throw Error('native validation failed'); });
  assert.equal(failed.changed, false);
  assert.equal(failed.skipped, 'native validation failed');
  assert.equal(f.run(['rev-parse', 'HEAD']), before);
  assert.equal(f.run(['status', '--porcelain']), '');
  assert.equal(mergeOptional(f.git, f.directory, 'clean-upstream', () => {}).changed, true);
});


test('a dependency is referenced where it is published, over HTTPS from GitHub, unless it is never checked out', t => {
  const { verifyDownstream } = require('../tools/verify-downstream.cjs');
  const directory = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'qaqr-downstream-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const modules = body => fs.writeFileSync(path.join(directory, '.gitmodules'), body.replace(/\n/g, '\r\n'));
  const fork = '[submodule "deps/a"]\n\tpath = deps/a\n\turl = https://github.com/QAQ-Revival/a.git\n';
  const upstream = '[submodule "deps/b"]\n\tpath = deps/b\n\turl = https://github.com/crosire/reshade\n';
  const elsewhere = '[submodule "deps/c"]\n\tpath = deps/c\n\turl = https://example.org/c.git\n';
  modules(fork + upstream);
  verifyDownstream(directory, 'EFF');
  modules(fork + elsewhere);
  assert.throws(() => verifyDownstream(directory, 'EFF'), /outside GitHub/);
  modules(fork + elsewhere.replace('c.git\n', 'c.git\n\tupdate = none\n'));
  verifyDownstream(directory, 'EFF');
  modules(fork + upstream.replace('https://github.com/', 'git@github.com:'));
  assert.throws(() => verifyDownstream(directory, 'EFF'), /outside GitHub/);
});

test('a disagreement over a submodule the sync sets itself is settled, any other conflict still stops the merge', t => {
  const f = fixture(t);
  const pin = revision => { f.run(['update-index', '--add', '--cacheinfo', `160000,${revision},engine`]); f.run(['commit', '-m', 'Pin the engine']); };
  fs.mkdirSync(path.join(f.directory, 'engine'));
  pin('1'.repeat(40));
  f.run(['branch', '-f', 'upstream']);
  pin('2'.repeat(40));
  f.run(['checkout', 'upstream']); pin('3'.repeat(40)); f.save('upstream.txt', 'new feature\n'); f.run(['add', 'upstream.txt']); f.run(['commit', '-m', 'Add a feature']); f.run(['checkout', 'main']);
  const before = f.run(['rev-parse', 'HEAD']);
  assert.throws(() => mergeUpstream(f.git, f.directory, 'upstream'), /merge conflict in engine/);
  f.run(['merge', '--abort']);
  assert.equal(f.run(['rev-parse', 'HEAD']), before);
  assert.equal(mergeUpstream(f.git, f.directory, 'upstream', undefined, 'Merge upstream', ['engine']), true);
  assert.equal(f.run(['rev-parse', 'HEAD:engine']), '2'.repeat(40));
  assert.equal(fs.readFileSync(path.join(f.directory, 'upstream.txt'), 'utf8'), 'new feature\n');
});

test('the plan handles children before parents, a fork before its copies and before a fork that merges it', () => {
  const plan = createPlan(require('../tools/upstream-repositories.json'));
  const position = node => plan.indexOf(node);
  assert.equal(plan.at(-1).kind, 'root');
  for (const node of plan) {
    if (node.parent) assert(position(node) < position(node.parent), node.path);
    if (node.source) assert(position(node.source) < position(node), node.path);
    for (const source of node.sources) assert(position(source) < position(node), node.path);
    if (node.kind !== 'root') assert(node.parent, node.path);
  }
  const engine = plan.find(node => node.kind === 'copy');
  assert.equal(engine.parent.name, 'wwmi-dx12');
  assert.equal(engine.source.name, 'XXMI-Libs-Package');
  assert.deepEqual(plan.find(node => node.name === 'XXMI-Libs-Vulkan').sources.map(node => node.name), ['XXMI-Libs-Package']);
});

// A root repository holding one organization fork and one unmodified dependency. Every remote is a bare repository on disk.
function tree(t) {
  const temporary = fs.realpathSync(os.tmpdir());
  const base = fs.mkdtempSync(path.join(temporary, 'qaqr-sync-tree-'));
  t.after(() => { assert.equal(path.dirname(fs.realpathSync(base)), temporary); clearReadOnly(base); fs.rmSync(base, { recursive: true, force: true }); });
  const env = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
    GIT_AUTHOR_NAME: 'qaq-revival-publisher[bot]', GIT_COMMITTER_NAME: 'qaq-revival-publisher[bot]',
    GIT_AUTHOR_EMAIL: '338412940+qaq-revival-publisher[bot]@users.noreply.github.com', GIT_COMMITTER_EMAIL: '338412940+qaq-revival-publisher[bot]@users.noreply.github.com' };
  const git = (cwd, args, { allowed = [0] } = {}) => {
    const result = spawnSync('git', ['-c', 'credential.helper=', '-c', 'commit.gpgsign=false', '-c', 'protocol.file.allow=always', '-c', 'core.autocrlf=false', ...args], { cwd, env, encoding: 'utf8', windowsHide: true });
    assert(allowed.includes(result.status), `git ${args.join(' ')}\n${result.stderr}`);
    return { status: result.status, stdout: result.stdout.trim(), stderr: result.stderr.trim() };
  };
  const at = (...parts) => path.join(base, ...parts).split(path.sep).join('/');
  const url = repository => at('remotes', repository + '.git');
  const commit = (directory, file, text) => { fs.writeFileSync(path.join(directory, file), text); git(directory, ['add', '--all']); git(directory, ['commit', '-m', 'Add fixture state']); return git(directory, ['rev-parse', 'HEAD']).stdout; };
  const publish = directory => git(directory, ['push', 'origin', 'HEAD:refs/heads/main']);
  const author = (repository, file) => {
    const directory = at('authors', repository);
    fs.mkdirSync(directory, { recursive: true });
    fs.mkdirSync(path.dirname(url(repository)), { recursive: true });
    git(directory, ['init', '--initial-branch=main']);
    commit(directory, file, 'original\n');
    git(base, ['clone', '--bare', '--no-hardlinks', directory, url(repository)]);
    git(directory, ['remote', 'add', 'origin', url(repository)]);
    return directory;
  };
  const upstream = author('up/lib', 'lib.txt'), dependency = author('up/dep', 'dep.txt');
  fs.mkdirSync(at('remotes/Org'), { recursive: true });
  git(base, ['clone', '--bare', '--no-hardlinks', url('up/lib'), url('Org/lib')]);
  git(base, ['init', '--bare', '--initial-branch=main', url('Org/Root')]);
  const root = at('work');
  fs.mkdirSync(root);
  git(root, ['init', '--initial-branch=main']);
  git(root, ['submodule', 'add', '-b', 'main', url('Org/lib'), 'forks/lib']);
  git(root, ['submodule', 'add', '-b', 'main', url('up/dep'), 'deps/dep']);
  git(root, ['commit', '-m', 'Add components']);
  git(root, ['remote', 'add', 'origin', url('Org/Root')]);
  publish(root);
  const manifest = { owner: 'Org', root: 'Root', forks: [{ name: 'lib', upstream: 'up/lib', branch: 'main', path: 'forks/lib', verify: ['check.cjs'] }], tracked: [{ upstream: 'up/dep', branch: 'main', path: 'deps/dep' }] };
  const remote = (repository, args) => git(url(repository), args).stdout;
  const recorded = entry => remote('Org/Root', ['ls-tree', 'main', entry]).split(/\s+/)[2];
  const run = options => synchronize({ plan: createPlan(manifest, root, url), git, log: () => {}, verify: () => {}, check: () => {}, ...options });
  return { git, commit, publish, upstream, dependency, root, lib: at('work/forks/lib'), remote, recorded, run };
}

test('a run merges the fork, advances the unmodified dependency, records both in the root and publishes all of it', async t => {
  const f = tree(t);
  const repair = f.commit(f.lib, 'fix.txt', 'local repair\n');
  f.publish(f.lib);
  f.git(f.root, ['commit', '-am', 'Record the repair']);
  f.publish(f.root);
  const feature = f.commit(f.upstream, 'feature.txt', 'new feature\n'); f.publish(f.upstream);
  const moved = f.commit(f.dependency, 'dep.txt', 'newer\n'); f.publish(f.dependency);
  const checked = [];
  const report = await f.run({ verify: node => checked.push(node.name) });
  assert.deepEqual(report.filter(row => row.held), []);
  assert.deepEqual(checked, ['lib']);
  const published = f.remote('Org/lib', ['rev-parse', 'main']);
  f.remote('Org/lib', ['merge-base', '--is-ancestor', repair, published]);
  f.remote('Org/lib', ['merge-base', '--is-ancestor', feature, published]);
  assert.equal(f.remote('Org/lib', ['show', '-s', '--format=%an|%s', published]), 'qaq-revival-publisher[bot]|Merge upstream up/lib into main');
  assert.equal(f.recorded('forks/lib'), published);
  assert.equal(f.recorded('deps/dep'), moved);
  assert.equal(f.remote('Org/Root', ['show', '-s', '--format=%s', 'main']), 'Update lib and dep');
  assert.deepEqual(report.filter(row => row.changed).map(row => [row.name, row.published]), [['lib', true], ['dep', false], ['Root', true]]);
  const again = await f.run({ verify: node => checked.push(node.name) });
  assert.deepEqual(again.filter(row => row.held || row.changed), []);
  assert.deepEqual(checked, ['lib']);
});

test('a fork whose check fails is left as it was while the rest of the run is recorded and published', async t => {
  const f = tree(t);
  const before = f.git(f.lib, ['rev-parse', 'HEAD']).stdout;
  f.commit(f.upstream, 'feature.txt', 'new feature\n'); f.publish(f.upstream);
  const moved = f.commit(f.dependency, 'dep.txt', 'newer\n'); f.publish(f.dependency);
  const report = await f.run({ verify: () => { throw Error('native validation failed'); } });
  assert.equal(report.find(row => row.name === 'lib').held, 'native validation failed');
  assert.equal(f.git(f.lib, ['rev-parse', 'HEAD']).stdout, before);
  assert.equal(f.git(f.lib, ['status', '--porcelain']).stdout, '');
  assert.equal(f.remote('Org/lib', ['rev-parse', 'main']), before);
  assert.equal(f.recorded('forks/lib'), before);
  assert.equal(f.recorded('deps/dep'), moved);
  assert.equal(f.remote('Org/Root', ['show', '-s', '--format=%s', 'main']), 'Update dep');
});

test('a conflicting fork is held back with a clean checkout, and a merge settled by hand is published by the next run', async t => {
  const f = tree(t);
  f.commit(f.lib, 'lib.txt', 'local repair\n');
  f.publish(f.lib);
  f.git(f.root, ['commit', '-am', 'Record the repair']);
  f.publish(f.root);
  const published = f.remote('Org/lib', ['rev-parse', 'main']);
  const edit = f.commit(f.upstream, 'lib.txt', 'upstream edit\n'); f.publish(f.upstream);
  const report = await f.run();
  assert.match(report.find(row => row.name === 'lib').held, /merge conflict in lib\.txt/);
  assert.equal(f.git(f.lib, ['status', '--porcelain']).stdout, '');
  assert.equal(f.git(f.lib, ['rev-parse', '-q', '--verify', 'MERGE_HEAD'], { allowed: [1] }).stdout, '');
  assert.equal(f.remote('Org/lib', ['rev-parse', 'main']), published);
  assert.equal(f.remote('Org/Root', ['show', '-s', '--format=%s', 'main']), 'Record the repair');

  f.git(f.lib, ['merge', '--no-commit', 'upstream/main'], { allowed: [1] });
  const settled = f.commit(f.lib, 'lib.txt', 'local repair on the upstream edit\n');
  const next = await f.run();
  assert.deepEqual(next.filter(row => row.held), []);
  assert.equal(f.remote('Org/lib', ['rev-parse', 'main']), settled);
  f.remote('Org/lib', ['merge-base', '--is-ancestor', edit, settled]);
  assert.equal(f.recorded('forks/lib'), settled);
});

test('deployment rebuilds only a package whose source moved and replaces every copy or none', t => {
  const temporary = fs.realpathSync(os.tmpdir());
  const base = fs.mkdtempSync(path.join(temporary, 'qaqr-deploy-'));
  t.after(() => { assert.equal(path.dirname(fs.realpathSync(base)), temporary); clearReadOnly(base); fs.rmSync(base, { recursive: true, force: true }); });
  const source = path.join(base, 'native/part'), portable = path.join(base, 'build/QAQ-Revival-local'), installed = path.join(base, 'installed');
  const git = args => {
    const result = spawnSync('git', ['-c', 'user.name=qaq-revival-publisher[bot]', '-c', 'user.email=338412940+qaq-revival-publisher[bot]@users.noreply.github.com', '-c', 'commit.gpgsign=false', ...args], { cwd: source, encoding: 'utf8', windowsHide: true });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  const revise = text => { fs.writeFileSync(path.join(source, 'part.txt'), text); git(['add', '--all']); git(['commit', '-m', 'Add fixture state']); };
  fs.mkdirSync(source, { recursive: true });
  git(['init', '--initial-branch=main']);
  revise('one');
  fs.mkdirSync(path.join(base, 'local-components'));
  for (const application of [portable, installed]) {
    fs.mkdirSync(path.join(application, 'resources/app'), { recursive: true });
    fs.writeFileSync(path.join(application, 'resources/app/package.json'), '{}');
    fs.mkdirSync(path.join(application, 'local-components'));
  }
  let builds = 0;
  const build = (target, { output }) => {
    builds++;
    const bytes = fs.readFileSync(path.join(source, 'part.txt'));
    fs.mkdirSync(output, { recursive: true });
    fs.writeFileSync(path.join(output, 'part.bin'), bytes);
    fs.writeFileSync(path.join(output, 'component.json'), JSON.stringify({ sourceCommit: git(['rev-parse', 'HEAD']), files: { 'part.bin': require('node:crypto').createHash('sha256').update(bytes).digest('hex') } }));
  };
  const run = () => deploy({ base, install: installed, log: () => {}, build, components: { part: { source: 'native/part', targets: { part: { output: 'local-components/part' } } } } });
  const copies = () => [base, portable, installed].map(directory => fs.readFileSync(path.join(directory, 'local-components/part/part.bin'), 'utf8'));
  assert.equal(run().length, 3);
  assert.deepEqual(copies(), ['one', 'one', 'one']);
  assert.equal(run().length, 0);
  assert.equal(builds, 1);
  revise('two');
  assert.equal(run().length, 3);
  assert.deepEqual([copies(), builds], [['two', 'two', 'two'], 2]);
  if (process.platform !== 'win32') return;
  // Windows refuses to move a directory while a file inside it is open, as it does for a running application.
  revise('three');
  const open = fs.openSync(path.join(installed, 'local-components/part/part.bin'), 'r');
  try { assert.throws(run, /Nothing was deployed/); } finally { fs.closeSync(open); }
  assert.deepEqual(copies(), ['two', 'two', 'two']);
  assert.equal(run().length, 3);
  assert.deepEqual(copies(), ['three', 'three', 'three']);
});