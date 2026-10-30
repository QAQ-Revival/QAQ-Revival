const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createAppClient } = require('./github-app-client.cjs');
const { verifyDownstream } = require('./verify-downstream.cjs');
const { owner, forks } = require('./upstream-repositories.json');
const root = path.resolve(__dirname, '..');

function assertPublished(git, directory, remoteRef) {
  if (git(directory, ['merge-base', '--is-ancestor', 'HEAD', remoteRef], { allowed: [0, 1] }).status !== 0) throw Error('Unpublished or divergent component commits must be preserved and pushed before updating: ' + directory);
}

function mergeUpstream(git, directory, upstreamRef, verify = () => {}) {
  if (git(directory, ['merge-base', '--is-ancestor', upstreamRef, 'HEAD'], { allowed: [0, 1] }).status === 0) { verify(false); return false; }
  const result = git(directory, ['merge', '--no-commit', upstreamRef], { allowed: [0, 1] });
  if (result.status) throw Error('Upstream merge conflict; the review checkout is preserved at ' + directory);
  git(directory, ['diff', '--check']);
  verify(true);
  if (git(directory, ['rev-parse', '-q', '--verify', 'MERGE_HEAD'], { allowed: [0, 1, 128] }).status === 0) git(directory, ['commit', '--no-gpg-sign', '-m', '[P] update']);
  return true;
}

async function syncUpstreams({ client } = {}) {
  client ||= await createAppClient({ permissions: { contents: 'write', workflows: 'write' }, names: forks.map(item => item.name) });
  const base = path.join(root, '.cache/upstream-sync');
  fs.mkdirSync(base, { recursive: true });
  const report = [];
  for (const item of forks) {
    const directory = path.join(base, item.name), origin = `https://github.com/${owner}/${item.name}.git`;
    if (!fs.existsSync(directory)) client.git(root, ['clone', '--single-branch', '--branch', item.branch, origin, directory], { skipLfs: true });
    const git = (cwd, args, options) => client.git(cwd, args, { ...options, skipLfs: true });
    if (git(directory, ['remote', 'get-url', 'origin']).stdout !== origin) throw Error('Unexpected synchronization checkout');
    if (git(directory, ['status', '--porcelain', '--ignore-submodules=all']).stdout) throw Error('Review pending changes in ' + directory + ' before syncing');
    git(directory, ['fetch', '--no-tags', 'origin', `${item.branch}:refs/remotes/origin/${item.branch}`]);
    assertPublished(git, directory, 'origin/' + item.branch);
    git(directory, ['checkout', '--detach', 'origin/' + item.branch]);
    const upstream = `https://github.com/${item.upstream}.git`;
    if (git(directory, ['remote']).stdout.split(/\r?\n/).includes('upstream')) git(directory, ['remote', 'set-url', 'upstream', upstream]);
    else git(directory, ['remote', 'add', 'upstream', upstream]);
    git(directory, ['remote', 'set-url', '--push', 'upstream', 'disabled://upstream-read-only']);
    git(directory, ['fetch', '--no-tags', 'upstream', `${item.branch}:refs/remotes/upstream/${item.branch}`]);
    const previous = git(directory, ['rev-parse', 'HEAD']).stdout;
    const changed = mergeUpstream(git, directory, 'upstream/' + item.branch, changed => {
      verifyDownstream(directory, item.name);
      if (changed && ['XXMI-Libs-Package', 'EFMI-Package'].includes(item.name)) {
        const env = { ...process.env };
        delete env.QAQR_GITHUB_APP_PRIVATE_KEY;
        console.log('Validating repaired native paths before pushing ' + item.name);
        const validation = spawnSync(process.execPath, [path.join(directory, 'qaqr/build.cjs'), '--verify-only'], { cwd: directory, env, stdio: 'inherit', windowsHide: true });
        if (validation.error || validation.status) throw validation.error || Error('Native fork validation failed; no upstream sync was pushed');
      }
    });
    const revision = git(directory, ['rev-parse', 'HEAD']).stdout;
    if (changed) {
      if (item.lfs) {
        git(directory, ['lfs', 'fetch', 'upstream', 'upstream/' + item.branch]);
        git(directory, ['lfs', 'push', 'origin', 'HEAD']);
      }
      git(directory, ['push', 'origin', `HEAD:refs/heads/${item.branch}`]);
    }
    report.push({ repository: `${owner}/${item.name}`, upstream: item.upstream, branch: item.branch, previous, revision });
    console.log(`${owner}/${item.name}: ${changed ? 'merged upstream' : 'up to date'} (${revision.slice(0, 12)})`);
  }
  fs.writeFileSync(path.join(base, 'last-sync.json'), JSON.stringify(report, null, 2) + '\n');
  return report;
}

if (require.main === module) syncUpstreams().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { syncUpstreams, mergeUpstream, assertPublished };
