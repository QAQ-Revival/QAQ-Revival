const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { REPOSITORY, readRegistration, installationToken } = require('./github-app-auth.cjs');
const root = path.resolve(__dirname, '..');
function git(args, acceptMissing = false) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true });
  if (result.status !== 0 && !(acceptMissing && result.status === 5)) throw Error('Could not configure repository authentication');
  return result.stdout.trim();
}
const quote = value => "'" + value.replace(/\\/g, '/').replace(/'/g, "'\\''") + "'";
async function main() {
  const remote = git(['remote', 'get-url', 'origin']);
  if (remote.replace(/\.git$/, '').toLowerCase() !== `https://github.com/${REPOSITORY}`.toLowerCase()) throw Error('Unexpected origin; refusing to change credentials');
  const app = readRegistration();
  await installationToken(app);
  const helper = `!${quote(process.execPath)} ${quote(path.join(__dirname, 'github-app-auth.cjs'))} credential`;
  git(['config', '--local', '--unset-all', 'credential.https://github.com.helper'], true);
  git(['config', '--local', '--add', 'credential.https://github.com.helper', '']);
  git(['config', '--local', '--add', 'credential.https://github.com.helper', helper]);
  git(['config', '--local', 'credential.useHttpPath', 'true']);
  git(['config', '--local', '--replace-all', 'http.https://github.com/.extraheader', '']);
  git(['config', '--local', 'user.name', 'Anonymous']);
  git(['config', '--local', 'user.email', 'lol@icu.io']);
  const credential = spawnSync('git', ['credential', 'fill'], {
    cwd: root, input: `protocol=https\nhost=github.com\npath=${REPOSITORY}.git\n\n`, encoding: 'utf8', windowsHide: true,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never', GIT_TRACE: '0', GIT_TRACE_CURL: '0', GIT_CURL_VERBOSE: '0' }
  });
  if (credential.status !== 0) throw Error('App credential helper failed; personal authentication is not used as a fallback');
  const fields = Object.fromEntries(credential.stdout.split(/\r?\n/).filter(line => line.includes('=')).map(line => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1)]; }));
  if (fields.username !== 'x-access-token' || !fields.password) throw Error('Git did not use the App credential helper');
  const response = await fetch('https://api.github.com/installation/repositories', { headers: { Authorization: `Bearer ${fields.password}`, Accept: 'application/vnd.github+json', 'User-Agent': 'QAQ-Revival-publisher' }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw Error('The configured Git credential is not an installation token');
  const data = await response.json();
  if (data.total_count !== 1 || data.repositories?.[0]?.full_name?.toLowerCase() !== REPOSITORY.toLowerCase()) throw Error('GitHub App token is not restricted to the expected repository');
  console.log(`Configured ${app.slug}[bot] for ${REPOSITORY}; commit identity remains Anonymous.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
