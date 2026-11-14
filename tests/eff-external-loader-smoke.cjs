// Real native loader + DLL, with harmless hosts and all data in a temporary workspace directory.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const base = path.resolve(__dirname, '../test-results');
fs.mkdirSync(base, { recursive: true });
const root = fs.mkdtempSync(path.join(base, 'eff-external-'));
const data = path.join(root, 'data/EFF'), game = path.join(root, '游戏 目录'), other = path.join(root, '另一份游戏');
for (const dir of [data, game, other]) fs.mkdirSync(dir, { recursive: true });
const built = path.resolve(__dirname, '../local-components/eff');
fs.copyFileSync(path.join(built, 'plugin/eff.dll'), path.join(data, 'eff.dll'));
fs.copyFileSync(path.join(built, 'EFFLoader.exe'), path.join(data, 'EFFLoader.exe'));
const host = path.resolve(__dirname, '../native/eff/bin/external-loader-smoke/EFFTestHost.exe');
for (const dir of [game, other]) fs.copyFileSync(host, path.join(dir, 'EFFTestHost.exe'));
const children = [];
function start(executable, args) {
  const child = spawn(executable, args, { cwd: root, windowsHide: true, stdio: 'ignore' });
  children.push(child);
  const done = new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', (code, signal) => resolve({ code, signal })); });
  return { child, done };
}
async function waitFor(predicate) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw Error('Native smoke timed out');
}
const readStatus = () => { try { return JSON.parse(fs.readFileSync(path.join(data, 'loader-status.json'), 'utf8')); } catch { return {}; } };
(async () => {
  const request = crypto.randomUUID();
  fs.writeFileSync(path.join(data, '.launch-request'), request);
  const wrongHost = start(path.join(other, 'EFFTestHost.exe'), ['--expect-absent']);
  const loader = start(path.join(data, 'EFFLoader.exe'), ['--game', path.join(game, 'EFFTestHost.exe'), '--dll', path.join(data, 'eff.dll'), '--request', request]);
  await waitFor(() => readStatus().request === request && readStatus().state === 'waiting');
  const target = start(path.join(game, 'EFFTestHost.exe'), []);
  assert.equal((await loader.done).code, 0, JSON.stringify(readStatus()));
  assert.equal(readStatus().state, 'loaded');
  assert.equal((await target.done).code, 0, 'production DLL must start and write settings/logs externally');
  assert.equal((await wrongHost.done).code, 0, 'a same-named process in a different directory must stay untouched');
  for (const dir of [game, other]) assert.deepEqual(fs.readdirSync(dir), ['EFFTestHost.exe']);
  assert.match(fs.readFileSync(path.join(data, 'eff_log.txt'), 'utf8'), /\[BUILD\] resource-directory-entry/);
  assert.ok(fs.existsSync(path.join(data, 'eff.ini')));
  const cancelled = crypto.randomUUID();
  fs.writeFileSync(path.join(data, '.launch-request'), cancelled);
  const watcher = start(path.join(data, 'EFFLoader.exe'), ['--game', path.join(game, 'EFFTestHost.exe'), '--dll', path.join(data, 'eff.dll'), '--request', cancelled]);
  await waitFor(() => readStatus().request === cancelled);
  fs.unlinkSync(path.join(data, '.launch-request'));
  assert.equal((await watcher.done).code, 0, 'cancelled watchers must exit before a later official launch');
  console.log(JSON.stringify({ success: true, externalInjection: true, gameUnchanged: true, unicodePaths: true, otherProcessUntouched: true, cancellation: true, artifacts: root }));
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { for (const child of children) if (child.exitCode === null) child.kill(); });
