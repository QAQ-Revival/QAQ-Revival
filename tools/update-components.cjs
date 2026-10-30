const path = require('node:path');
const fs = require('node:fs');
const { createAppClient } = require('./github-app-client.cjs');
const { syncUpstreams, assertPublished } = require('./sync-upstreams.cjs');
const { verifyDownstream } = require('./verify-downstream.cjs');
const components = require('./component-repositories.json');
const { forks } = require('./upstream-repositories.json');
const root = path.resolve(__dirname, '..');

async function updateComponents() {
  const client = await createAppClient();
  const git = args => client.git(root, args);
  verifyDownstream(root, 'QAQ-Revival');
  git(['submodule', 'foreach', '--recursive', 'changes=$(git status --porcelain --ignore-submodules=all) || exit $?; test -z "$changes" || { echo "Component has local changes; save or commit them before updating." >&2; printf "%s\\n" "$changes" >&2; exit 1; }']);
  const tracked = new Map([...Object.values(components).map(item => [item.source, item.branch]), ...forks.map(item => [item.path, item.branch])]);
  for (const [relative, branch] of tracked) {
    const directory = path.join(root, relative);
    if (!fs.existsSync(path.join(directory, '.git'))) continue;
    client.git(directory, ['fetch', '--no-tags', 'origin', `${branch}:refs/remotes/origin/${branch}`]);
    assertPublished(client.git, directory, 'origin/' + branch);
  }
  await syncUpstreams();
  git(['submodule', 'sync', '--recursive']);
  git(['submodule', 'update', '--init', '--recursive']);
  git(['submodule', 'foreach', '--recursive', 'git config --replace-all remote.origin.fetch "+refs/heads/*:refs/remotes/origin/*"']);
  git(['submodule', 'update', '--remote', '--recursive']);
  console.log(git(['submodule', 'status', '--recursive']).stdout);
}

if (require.main === module) updateComponents().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { updateComponents };
