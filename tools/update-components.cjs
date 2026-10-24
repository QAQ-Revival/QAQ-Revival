// Dependency reads are public and never fall back to a developer's Git credentials.
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');

function updateComponents() {
  const env = { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never', GIT_AUTHOR_NAME: 'qaq-revival-publisher[bot]', GIT_AUTHOR_EMAIL: '338412940+qaq-revival-publisher[bot]@users.noreply.github.com', GIT_COMMITTER_NAME: 'qaq-revival-publisher[bot]', GIT_COMMITTER_EMAIL: '338412940+qaq-revival-publisher[bot]@users.noreply.github.com' };
  const config = ['-c', 'credential.helper=', '-c', 'credential.interactive=false', '-c', 'core.askPass=', '-c', 'http.https://github.com/.extraheader='];
  function git(args) {
    const result = spawnSync('git', [...config, ...args], { cwd: root, env, stdio: 'inherit', windowsHide: true });
    if (result.error || result.status !== 0) throw result.error || Error('Component update stopped; resolve the reported submodule problem before retrying');
  }
  // Include untracked source files and nested modules; never force away local work.
  git(['submodule', 'foreach', '--recursive', 'test -z "$(git status --porcelain --ignore-submodules=all)" || { echo "Component has local changes; commit or save them before updating."; exit 1; }']);
  git(['submodule', 'sync', '--recursive']);
  git(['submodule', 'update', '--init', '--recursive']);
  git(['submodule', 'foreach', '--recursive', 'git config --replace-all remote.origin.fetch "+refs/heads/*:refs/remotes/origin/*"']);
  git(['submodule', 'update', '--remote', '--recursive']);
  git(['submodule', 'status', '--recursive']);
}

if (require.main === module) {
  try { updateComponents(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { updateComponents };
