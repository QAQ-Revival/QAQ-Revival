const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { mergeUpstream, mergeOptional, assertPublished, fetchVersionTags, publishVersionTags } = require('../tools/sync-upstreams.cjs');
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
  const commit = () => { run(['add', '--all']); run(['commit', '-m', '[P] update']); return run(['rev-parse', 'HEAD']); };
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
  assert.equal(f.run(['show', '-s', '--format=%an|%cn|%s']), 'qaq-revival-publisher[bot]|qaq-revival-publisher[bot]|[P] update');
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

test('branch refresh refuses to detach an unpublished local repair commit', t => {
  const f = fixture(t);
  const base = f.run(['rev-parse', 'HEAD']);
  f.run(['update-ref', 'refs/remotes/origin/main', base]);
  f.save('local-fix.txt', 'reviewed but not yet pushed\n');
  const repaired = f.commit();
  assert.throws(() => assertPublished(f.git, f.directory, 'origin/main'), /Unpublished/);
  assert.equal(f.run(['rev-parse', 'HEAD']), repaired);
  f.run(['update-ref', 'refs/remotes/origin/main', repaired]);
  assert.doesNotThrow(() => assertPublished(f.git, f.directory, 'origin/main'));
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
