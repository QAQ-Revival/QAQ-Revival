const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createAppClient } = require('./github-app-client.cjs');
const { verifyDownstream } = require('./verify-downstream.cjs');
const { owner, forks } = require('./upstream-repositories.json');
const root = path.resolve(__dirname, '..');

function fetchVersionTags(git, directory, remote) {
  const refs = git(directory, ['ls-remote', '--tags', '--refs', remote]).stdout.split(/\r?\n/)
    .map(line => line.split(/\s+/)).filter(([, ref]) => /^refs\/tags\/v\d+\.\d+\.\d+(?:\.\d+)?$/.test(ref || ''));
  const missing = [];
  for (const [object, ref] of refs) {
    const local = git(directory, ['rev-parse', '--verify', ref], { allowed: [0, 1, 128] });
    if (local.status === 0 && local.stdout !== object) throw Error('Version tag differs from its source: ' + ref);
    if (local.status !== 0) missing.push(`${ref}:${ref}`);
  }
  if (missing.length) git(directory, ['fetch', '--no-tags', remote, ...missing]);
  return refs;
}

function publishVersionTags(git, directory, refs) {
  const origin = new Map(git(directory, ['ls-remote', '--tags', '--refs', 'origin']).stdout.split(/\r?\n/).map(line => {
    const [object, ref] = line.split(/\s+/); return [ref, object];
  }));
  const missing = [];
  for (const [object, ref] of refs) {
    if (git(directory, ['merge-base', '--is-ancestor', `${ref}^{commit}`, 'HEAD'], { allowed: [0, 1] }).status) continue;
    if (origin.has(ref) && origin.get(ref) !== object) throw Error('Organization version tag already has a different target: ' + ref);
    if (!origin.has(ref)) missing.push(`${ref}:${ref}`);
  }
  if (missing.length) git(directory, ['push', 'origin', ...missing]);
}

function assertPublished(git, directory, remoteRef) {
  if (git(directory, ['merge-base', '--is-ancestor', 'HEAD', remoteRef], { allowed: [0, 1] }).status !== 0) throw Error('Unpublished or divergent component commits must be preserved and pushed before updating: ' + directory);
}

// A fork that moves faster than the rest stays where it is when a merge does not go through,
// so one conflict cannot hold up every other component and the release.
function mergeOptional(git, directory, upstreamRef, verify, message) {
  const before = git(directory, ['rev-parse', 'HEAD']).stdout;
  try {
    return { changed: mergeUpstream(git, directory, upstreamRef, verify, message) };
  } catch (error) {
    git(directory, ['merge', '--abort'], { allowed: [0, 128] });
    // A fast-forward has already moved HEAD by the time its check fails.
    git(directory, ['reset', '--hard', before]);
    return { changed: false, skipped: error.message };
  }
}

function mergeUpstream(git, directory, upstreamRef, verify = () => {}, message = 'Merge ' + upstreamRef) {
  if (git(directory, ['merge-base', '--is-ancestor', upstreamRef, 'HEAD'], { allowed: [0, 1] }).status === 0) { verify(false); return false; }
  const result = git(directory, ['merge', '--no-commit', upstreamRef], { allowed: [0, 1] });
  if (result.status) throw Error('Upstream merge conflict; the review checkout is preserved at ' + directory);
  git(directory, ['diff', '--check']);
  verify(true);
  if (git(directory, ['rev-parse', '-q', '--verify', 'MERGE_HEAD'], { allowed: [0, 1, 128] }).status === 0) git(directory, ['commit', '--no-gpg-sign', '-m', message]);
  return true;
}

async function syncUpstreams({ client } = {}) {
  client ||= await createAppClient({ permissions: { contents: 'write', workflows: 'write' }, names: [...new Set(forks.map(item => item.name))] });
  const base = path.join(root, '.cache/upstream-sync');
  fs.mkdirSync(base, { recursive: true });
  const report = [];
  for (const item of forks) {
    // Branches held at a reviewed commit move by hand, not with their upstream.
    if (item.pinned) continue;
    const upstreamBranch = item.upstreamBranch || item.branch;
    const directory = path.join(base, item.upstreamBranch ? `${item.name}@${item.branch}` : item.name), origin = `https://github.com/${owner}/${item.name}.git`;
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
    git(directory, ['fetch', '--no-tags', 'upstream', `${upstreamBranch}:refs/remotes/upstream/${upstreamBranch}`]);
    // The runtime generates its PE version with git describe. A release can
    // add a tag to a commit that was already merged, without changing the branch.
    const versionTags = item.versionTags ? fetchVersionTags(git, directory, item.versionTags) : [];
    const previous = git(directory, ['rev-parse', 'HEAD']).stdout;
    const verify = changed => {
      verifyDownstream(directory, item.name);
      if (changed && ['XXMI-Libs-Package', 'EFMI-Package', 'wwmi-dx12'].includes(item.name)) {
        // wwmi-dx12 builds its engine and SDK from submodules, all in the organization by now.
        if (fs.existsSync(path.join(directory, '.gitmodules'))) git(directory, ['submodule', 'update', '--init', '--recursive']);
        const env = { ...process.env };
        delete env.QAQR_GITHUB_APP_PRIVATE_KEY;
        console.log('Validating repaired native paths before pushing ' + item.name);
        const validation = spawnSync(process.execPath, [path.join(directory, 'qaqr/build.cjs'), '--verify-only'], { cwd: directory, env, stdio: 'inherit', windowsHide: true });
        if (validation.error || validation.status) throw validation.error || Error('Native fork validation failed; no upstream sync was pushed');
      }
    };
    let changed = false, skipped = null;
    for (const ref of [`upstream/${upstreamBranch}`, ...(item.also || []).map(branch => `origin/${branch}`)]) {
      if (ref.startsWith('origin/')) git(directory, ['fetch', '--no-tags', 'origin', `${ref.slice(7)}:refs/remotes/${ref}`]);
      const message = ref.startsWith('origin/') ? `Merge ${ref.slice(7)} into ${item.branch}` : `Merge upstream ${item.upstream} into ${item.branch}`;
      if (!item.optional) { changed = mergeUpstream(git, directory, ref, verify, message) || changed; continue; }
      const result = mergeOptional(git, directory, ref, verify, message);
      changed = result.changed || changed;
      skipped ||= result.skipped;
    }
    const revision = git(directory, ['rev-parse', 'HEAD']).stdout;
    if (changed) {
      if (item.lfs) {
        git(directory, ['lfs', 'fetch', 'upstream', 'upstream/' + item.branch]);
        git(directory, ['lfs', 'push', 'origin', 'HEAD']);
      }
      git(directory, ['push', 'origin', `HEAD:refs/heads/${item.branch}`]);
    }
    if (item.versionTags === 'upstream') publishVersionTags(git, directory, versionTags);
    report.push({ repository: `${owner}/${item.name}`, upstream: item.upstream, branch: item.branch, previous, revision, skipped });
    console.log(`${owner}/${item.name}@${item.branch}: ${skipped ? 'held back: ' + skipped : changed ? 'merged upstream' : 'up to date'} (${revision.slice(0, 12)})`);
  }
  fs.writeFileSync(path.join(base, 'last-sync.json'), JSON.stringify(report, null, 2) + '\n');
  return report;
}

if (require.main === module) syncUpstreams().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { syncUpstreams, mergeUpstream, mergeOptional, assertPublished, fetchVersionTags, publishVersionTags };
