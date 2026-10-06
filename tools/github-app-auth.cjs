const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const REPOSITORY = 'QAQ-Revival/QAQ-Revival';
function settingsPath() {
  if (process.platform !== 'win32' || !process.env.LOCALAPPDATA) throw Error('Windows credential storage is required');
  return path.join(process.env.LOCALAPPDATA, 'QAQ-Revival', 'GitHubApp', 'auth.json');
}
function protect(value, decrypt = false) {
  const script = `Add-Type -AssemblyName System.Security; $inputValue = [Console]::In.ReadToEnd(); $entropy = [Text.Encoding]::UTF8.GetBytes('${REPOSITORY}'); ` + (decrypt
    ? '$plain = [Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String($inputValue), $entropy, [Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Write([Text.Encoding]::UTF8.GetString($plain));'
    : '$cipher = [Security.Cryptography.ProtectedData]::Protect([Text.Encoding]::UTF8.GetBytes($inputValue), $entropy, [Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Write([Convert]::ToBase64String($cipher));');
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { input: value, encoding: 'utf8', windowsHide: true });
  if (result.status !== 0 || !result.stdout) throw Error('Windows credential encryption failed');
  return result.stdout.trim();
}
function saveRegistration(app) {
  if (!app.id || !app.pem || !/^[a-z0-9-]+$/.test(app.slug || '')) throw Error('Invalid GitHub App registration');
  const file = settingsPath();
  if (fs.existsSync(file)) throw Error('GitHub App credentials already exist; inspect before replacing');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const record = { appId: app.id, slug: app.slug, repository: REPOSITORY, protectedKey: protect(app.pem) };
  fs.writeFileSync(file, JSON.stringify(record, null, 2));
  return { appId: record.appId, slug: record.slug };
}
function readRegistration() {
  let record;
  try { record = JSON.parse(fs.readFileSync(settingsPath(), 'utf8')); }
  catch { throw Error('Configure the project GitHub App before pushing'); }
  if (record.repository !== REPOSITORY) throw Error('GitHub App repository mismatch');
  return { id: record.appId, slug: record.slug, pem: protect(record.protectedKey, true) };
}
function createJwt(app, now = Date.now()) {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iat: Math.floor(now / 1000) - 60, exp: Math.floor(now / 1000) + 540, iss: String(app.id) })).toString('base64url');
  const unsigned = `${header}.${payload}`;
  return `${unsigned}.${crypto.sign('RSA-SHA256', Buffer.from(unsigned), app.pem).toString('base64url')}`;
}
async function installationToken(app, fetchFn = fetch) {
  const headers = { Accept: 'application/vnd.github+json', Authorization: `Bearer ${createJwt(app)}`, 'User-Agent': 'QAQ-Revival-publisher' };
  const info = await fetchFn(`https://api.github.com/repos/${REPOSITORY}/installation`, { headers, signal: AbortSignal.timeout(15000) });
  if (!info.ok) throw Error(`GitHub App is not installed on the project repository (HTTP ${info.status})`);
  const installation = await info.json();
  if (!Number.isSafeInteger(installation.id)) throw Error('Invalid installation response');
  const response = await fetchFn(`https://api.github.com/app/installations/${installation.id}/access_tokens`, {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000),
    body: JSON.stringify({ repositories: [REPOSITORY.split('/')[1]], permissions: { contents: 'write', workflows: 'write' } })
  });
  if (!response.ok) throw Error(`GitHub App token request failed (HTTP ${response.status})`);
  const result = await response.json();
  if (!result.token || result.permissions?.contents !== 'write' || result.permissions?.workflows !== 'write') throw Error('GitHub App does not have the required project permissions');
  return { token: result.token, expiresAt: result.expires_at, installationId: installation.id, slug: app.slug };
}
function matchesRepository(input) {
  return input.protocol === 'https' && input.host === 'github.com' && String(input.path || '').replace(/\.git$/, '').toLowerCase() === REPOSITORY.toLowerCase();
}
async function main() {
  if (process.argv[2] === 'status') {
    const result = await installationToken(readRegistration());
    console.log(JSON.stringify({ identity: `${result.slug}[bot]`, repository: REPOSITORY, installationId: result.installationId, expiresAt: result.expiresAt }));
    return;
  }
  if (process.argv[2] !== 'credential' || process.argv[3] !== 'get') return;
  const input = Object.fromEntries(fs.readFileSync(0, 'utf8').split(/\r?\n/).filter(line => line.includes('=')).map(line => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1)]; }));
  if (!matchesRepository(input)) return;
  const result = await installationToken(readRegistration());
  // This protocol output is consumed only by Git; never invoke it for display.
  process.stdout.write(`username=x-access-token\npassword=${result.token}\n\n`);
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { REPOSITORY, saveRegistration, readRegistration, createJwt, installationToken, matchesRepository };
