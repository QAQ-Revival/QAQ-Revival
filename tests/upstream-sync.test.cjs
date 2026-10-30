const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { mergeUpstream, assertPublished } = require('../tools/sync-upstreams.cjs');
const { checkoutConfig } = require('../tools/github-app-client.cjs');

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
  t.after(() => { assert.equal(path.dirname(fs.realpathSync(directory)), temporary); fs.rmSync(directory, { recursive: true, force: true }); });
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
