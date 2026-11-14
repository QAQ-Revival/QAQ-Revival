const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { releasePushArguments } = require('../tools/release-push.cjs');

function clearReadOnly(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) clearReadOnly(file);
    else if (!entry.isSymbolicLink()) fs.chmodSync(file, 0o666);
  }
}

function fixture(t) {
  const parent = path.resolve(__dirname, '../test-results');
  fs.mkdirSync(parent, { recursive: true });
  const root = fs.mkdtempSync(path.join(parent, 'qaqr-release-push-'));
  t.after(() => { assert.equal(path.dirname(fs.realpathSync(root)), fs.realpathSync(parent)); clearReadOnly(root); fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });
  const local = path.join(root, 'work'), remote = path.join(root, 'remote.git');
  fs.mkdirSync(local);
  const git = (args, { allowed = [0] } = {}) => {
    const result = spawnSync('git', ['-c', 'commit.gpgsign=false', '-c', 'tag.gpgsign=false', ...args], { cwd: local, encoding: 'utf8', windowsHide: true,
      env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null' } });
    assert(allowed.includes(result.status), result.stderr);
    return { status: result.status, stdout: result.stdout.trim(), stderr: result.stderr.trim() };
  };
  git(['init', '-b', 'main']); git(['init', '--bare', remote]);
  git(['config', 'user.name', 'qaq-revival-publisher[bot]']);
  git(['config', 'user.email', '338412940+qaq-revival-publisher[bot]@users.noreply.github.com']);
  git(['remote', 'add', 'origin', remote]);
  function commit(subject, version = '1.2.3') {
    for (const name of ['package.json', 'app/package.json', 'package-lock.json', 'app/package-lock.json']) {
      const file = path.join(local, name); fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify({ version, ...(name.endsWith('lock.json') ? { packages: { '': { version } } } : {}) }));
    }
    git(['add', '.']); git(['commit', '--allow-empty', '-m', subject]);
    return git(['rev-parse', 'HEAD']).stdout;
  }
  return { git, commit, local, push: args => git(releasePushArguments(args, git)) };
}
test('ordinary commits and non-main pushes create no release tags', t => {
  const f = fixture(t); f.commit('Change a preview');
  assert.deepEqual(releasePushArguments(['push', 'origin', 'main'], f.git), ['push', 'origin', 'main']);
  f.push(['push', 'origin', 'main']);
  assert.equal(f.git(['ls-remote', '--tags', 'origin']).stdout, '');
  f.commit('[P] Release v1.2.3.');
  assert.deepEqual(releasePushArguments(['push', 'origin', 'HEAD:other'], f.git), ['push', 'origin', 'HEAD:other']);
});
test('release pushes atomically publish main and the version from the committed manifests', t => {
  const f = fixture(t), head = f.commit('[P] Release v1.2.3.');
  fs.writeFileSync(path.join(f.local, 'app/package.json'), JSON.stringify({ version: '9.9.9' }));
  const args = releasePushArguments(['push', 'origin', '--set-upstream', 'main'], f.git);
  assert(args.includes('--atomic')); assert(args.includes(head + ':refs/tags/v1.2.3'));
  f.git(args);
  assert.equal(f.git(['rev-parse', 'v1.2.3']).stdout, head);
  const refs = f.git(['ls-remote', 'origin', 'refs/heads/main', 'refs/tags/v1.2.3']).stdout.split('\n');
  assert.equal(refs.length, 2); assert(refs.every(line => line.startsWith(head)));
  assert.deepEqual(releasePushArguments(['push', 'origin', 'main'], f.git), ['push', 'origin', 'main']);
});
test('an implicit main push includes main when adding a tag; dry runs change neither tag nor branch', t => {
  const f = fixture(t); f.commit('[P] Release v1.2.3.');
  const args = releasePushArguments(['push', 'origin', '--dry-run'], f.git);
  assert(args.includes('HEAD:refs/heads/main'));
  f.git(args);
  assert.equal(f.git(['tag', '--list']).stdout, '');
  assert.equal(f.git(['ls-remote', 'origin']).stdout, '');
});
test('a failed release rewrite requires the exact old main commit and moves its tag with a separate lease', t => {
  const f = fixture(t), old = f.commit('[P] Release v1.2.3.'); f.push(['push', 'origin', 'main']);
  const next = f.commit('[P] Release v1.2.3.');
  assert.throws(() => releasePushArguments(['push', 'origin', 'main'], f.git), /already points/);
  const args = releasePushArguments(['push', 'origin', `--force-with-lease=refs/heads/main:${old}`, 'main'], f.git);
  assert(args.includes(`--force-with-lease=refs/tags/v1.2.3:${old}`));
  f.git(args);
  assert(f.git(['ls-remote', 'origin', 'refs/heads/main', 'refs/tags/v1.2.3']).stdout.split('\n').every(line => line.startsWith(next)));
});
test('a tag collision never leaves the branch partially published', t => {
  const f = fixture(t), head = f.commit('[P] Release v1.2.3.');
  const args = releasePushArguments(['push', 'origin', 'main'], f.git);
  const other = f.commit('Another commit');
  f.git(['push', 'origin', other + ':refs/tags/v1.2.3']);
  assert.notEqual(f.git(args, { allowed: [1] }).status, 0);
  assert.equal(f.git(['ls-remote', 'origin', 'refs/heads/main']).stdout, '');
  assert.notEqual(head, other);
});
test('inconsistent versions and mistyped release messages stop before creating a tag', t => {
  const f = fixture(t); f.commit('[P] Release v1.2.3.');
  fs.writeFileSync(path.join(f.local, 'package-lock.json'), JSON.stringify({ version: '1.0.0' }));
  f.git(['add', '.']); f.git(['commit', '--amend', '--no-edit']);
  assert.throws(() => releasePushArguments(['push', 'origin', 'main'], f.git), /versions differ/);
  assert.equal(f.git(['tag', '--list']).stdout, '');
  f.commit('[P] Release v2.0.0.');
  assert.throws(() => releasePushArguments(['push', 'origin', 'main'], f.git), /Use the release commit/);
});
