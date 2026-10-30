const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { REPOSITORY, readRegistration, createJwt } = require('./github-app-auth.cjs');
const { owner, forks } = require('./upstream-repositories.json');
const components = require('./component-repositories.json');
const repositories = [...new Set([REPOSITORY, ...Object.values(components).map(item => item.repository), ...forks.map(item => `${owner}/${item.name}`)])];

function checkoutConfig(directory) {
  // Keep the checkout's line-ending rules when isolating Git from personal credentials.
  const result = spawnSync('git', ['config', '--null', '--get-regexp', '^core\\.(autocrlf|eol)$'], {
    cwd: directory, encoding: 'utf8', windowsHide: true
  });
  if (result.error || ![0, 1].includes(result.status)) throw Error('Cannot read Git checkout settings');
  return (result.stdout || '').split('\0').filter(Boolean).flatMap(entry => {
    const separator = entry.indexOf('\n');
    return ['-c', entry.slice(0, separator) + '=' + entry.slice(separator + 1)];
  });
}

function registration() {
  const id = process.env.QAQR_GITHUB_APP_ID, pem = process.env.QAQR_GITHUB_APP_PRIVATE_KEY;
  if (!id && !pem) return readRegistration();
  if (!/^\d+$/.test(id || '') || !pem) throw Error('Set both QAQR GitHub App build secrets');
  return { id: Number(id), pem, slug: 'qaq-revival-publisher' };
}

async function createAppClient({ permissions = { contents: 'read' }, names = repositories.map(item => item.split('/')[1]) } = {}) {
  if (names.some(name => !repositories.includes(`${owner}/${name}`))) throw Error('Unregistered component repository');
  const app = registration();
  const baseHeaders = { Accept: 'application/vnd.github+json', 'User-Agent': 'QAQ-Revival-components', 'X-GitHub-Api-Version': '2022-11-28' };
  async function request(route, access, { method = 'GET', body, allowed = [] } = {}) {
    const response = await fetch('https://api.github.com' + route, {
      method, headers: { ...baseHeaders, Authorization: `Bearer ${access}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000)
    });
    if (allowed.includes(response.status)) return { status: response.status };
    if (!response.ok) throw Error(`GitHub App request failed (${response.status}) at ${route}`);
    return response.status === 204 ? null : response.json();
  }
  const jwt = createJwt(app);
  const installation = await request(`/repos/${REPOSITORY}/installation`, jwt);
  if (installation.account?.login !== owner) throw Error('Unexpected GitHub App installation owner');
  const access = await request(`/app/installations/${installation.id}/access_tokens`, jwt, { method: 'POST', body: { repositories: names, permissions } });
  if (!access.token) throw Error('GitHub App installation token is missing');
  const identity = await request('/users/' + encodeURIComponent(app.slug + '[bot]'), access.token);
  if (identity.type !== 'Bot' || identity.login !== app.slug + '[bot]' || !Number.isSafeInteger(identity.id)) throw Error('GitHub App bot identity verification failed');
  const email = `${identity.id}+${identity.login}@users.noreply.github.com`;
  const authorization = 'Authorization: Basic ' + Buffer.from('x-access-token:' + access.token).toString('base64');
  const env = { ...process.env, GIT_AUTHOR_NAME: identity.login, GIT_AUTHOR_EMAIL: email, GIT_COMMITTER_NAME: identity.login, GIT_COMMITTER_EMAIL: email,
    GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null', GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never',
    GIT_TRACE: '0', GIT_TRACE_CURL: '0', GIT_TRACE_PACKET: '0', GIT_CURL_VERBOSE: '0',
    GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: `http.https://github.com/${owner}/.extraheader`, GIT_CONFIG_VALUE_0: authorization };
  delete env.QAQR_GITHUB_APP_PRIVATE_KEY;
  for (const name of ['GIT_TRACE', 'GIT_TRACE_CURL', 'GIT_TRACE_PACKET', 'GIT_CURL_VERBOSE', 'GIT_TRACE2', 'GIT_TRACE2_EVENT', 'GIT_TRACE2_PERF']) delete env[name];
  env.GIT_TRACE_REDACT = '1';
  const emptyHooks = path.resolve(__dirname, '../.cache/no-git-hooks');
  fs.mkdirSync(emptyHooks, { recursive: true });
  const config = [...checkoutConfig(path.resolve(__dirname, '..')), '-c', `user.name=${identity.login}`, '-c', `user.email=${email}`, '-c', 'user.useConfigOnly=true',
    '-c', 'credential.helper=', '-c', 'credential.https://github.com.helper=', '-c', 'http.https://github.com/.extraheader=',
    '-c', 'core.hooksPath=' + emptyHooks, '-c', 'commit.gpgsign=false', '-c', 'tag.gpgsign=false',
    '-c', 'filter.lfs.clean=git-lfs clean -- %f', '-c', 'filter.lfs.smudge=git-lfs smudge -- %f',
    '-c', 'filter.lfs.process=git-lfs filter-process', '-c', 'filter.lfs.required=true'];
  function git(directory, args, { allowed = [0], skipLfs = false } = {}) {
    if (args[0] === 'push' || (args[0] === 'lfs' && args[1] === 'push')) {
      if (args[args[0] === 'lfs' ? 2 : 1] !== 'origin' || args.some(arg => /^--force|^\+/.test(arg))) throw Error('Only non-forced pushes to a registered organization origin are allowed');
      const remote = git(directory, ['remote', 'get-url', '--push', 'origin']).stdout;
      if (!repositories.some(repository => remote.replace(/\.git$/, '') === `https://github.com/${repository}`)) throw Error('Refusing to push to upstream or an unregistered repository');
    }
    let result;
    const retryable = ['fetch', 'clone'].includes(args[0]) || (args[0] === 'submodule' && args[1] === 'update');
    for (let attempt = 0; attempt < 3; attempt++) {
      result = spawnSync('git', [...config, ...args], { cwd: directory, env: { ...env, ...(skipLfs ? { GIT_LFS_SKIP_SMUDGE: '1' } : {}) },
        encoding: 'utf8', windowsHide: true, timeout: 300000, maxBuffer: 16 * 1024 * 1024 });
      if (allowed.includes(result.status) || !retryable || !/schannel|TLS|connection.*reset|could not resolve|timed out|failed to connect|unexpected disconnect/i.test(result.stderr || '')) break;
    }
    if (result.error || !allowed.includes(result.status)) {
      const detail = [result.stdout, result.stderr, result.error?.message].filter(Boolean).join('\n').replaceAll(access.token, '[redacted]').replaceAll(authorization, '[redacted]');
      throw Error('Git ' + args[0] + ' failed: ' + detail.trim().slice(-1800));
    }
    return { status: result.status, stdout: (result.stdout || '').trim(), stderr: (result.stderr || '').trim() };
  }
  return { identity: { name: identity.login, email }, git, api: (route, options) => request(route, access.token, options) };
}

module.exports = { createAppClient, repositories, checkoutConfig };
