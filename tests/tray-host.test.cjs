const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter, once } = require('node:events');
const { PassThrough } = require('node:stream');
const { spawn, spawnSync } = require('node:child_process');
const { createNativeTray } = require('../app/src/main/desktop/tray-host.cjs');

function fixture(t) {
  fs.mkdirSync(path.resolve('test-results'), { recursive: true });
  const directory = fs.mkdtempSync(path.resolve('test-results/tray-host-'));
  const executable = path.join(directory, 'QaqrTrayHost.exe');
  fs.writeFileSync(executable, 'fixture');
  t.after(() => {
    assert.equal(path.dirname(fs.realpathSync(directory)), fs.realpathSync(path.resolve('test-results')));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  return executable;
}
function options(executable, extra = {}) {
  return { app: Object.assign(new EventEmitter(), { isPackaged: true }), executable,
    icon: path.resolve('app/resources/icon.ico'), showLabel: '显示窗口', quitLabel: '退出程序',
    onShow() {}, onQuit() {}, onFallback() { assert.fail('Unexpected fallback'); }, ...extra };
}
function mockChild() {
  return Object.assign(new EventEmitter(), { stdin: new PassThrough(), stdout: new PassThrough(), kill() { this.killed = true; } });
}

test('native tray forwards actions, keeps its private pipe open, and closes it on application quit', t => {
  const child = mockChild();
  let ready = 0, shown = 0, quit = 0;
  const opts = options(fixture(t), { launch: () => child,
    onReady: () => ready++, onShow: () => shown++, onQuit: () => quit++ });
  assert.equal(createNativeTray(opts), true);
  const request = JSON.parse(child.stdin.read().toString());
  assert.equal(request.show, '显示窗口'); assert.equal(request.quit, '退出程序');
  assert.equal(child.stdin.writableEnded, false);
  for (const type of ['ready', 'show', 'quit']) child.stdout.write(JSON.stringify({ type }) + '\n');
  assert.deepEqual([ready, shown, quit], [1, 1, 1]);
  opts.app.emit('will-quit');
  assert.equal(child.stdin.writableEnded, true);
  child.emit('exit', 0);
  assert.equal(child.killed, undefined);
});

test('startup failure and unexpected exit fall back once; missing helpers keep the Electron tray', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const executable = fixture(t);
  for (const failure of ['error', 'exit', 'timeout']) {
    const child = mockChild(); let fallback = 0, errors = 0;
    const opts = options(executable, { launch: () => child, onFallback: () => fallback++, onError: () => errors++ });
    assert.equal(createNativeTray(opts), true);
    if (failure === 'timeout') t.mock.timers.tick(5000);
    else child.emit(failure, Error('fixture failure'));
    child.emit('exit', 1);
    assert.equal(fallback, 1); assert.equal(errors, 1); assert.equal(child.killed, true);
    assert.equal(opts.app.listenerCount('will-quit'), 0);
  }
  assert.equal(createNativeTray(options(executable + '.missing')), false);
});

test('real tray sessions reuse the Windows icon identity and exit when their owner pipe closes', { skip: process.platform !== 'win32' }, async t => {
  const executable = fixture(t);
  fs.copyFileSync(path.resolve('app/resources/tray-host/QaqrTrayHost.exe'), executable);
  const snapshot = () => {
    const literal = executable.replace(/'/g, "''");
    const script = `$r='HKCU:\\Control Panel\\NotifyIconSettings';if(Test-Path -LiteralPath $r){$icons=@(Get-ChildItem -LiteralPath $r|ForEach-Object{$p=Get-ItemProperty -LiteralPath $_.PSPath;if($p.ExecutablePath -eq '${literal}'){[pscustomobject]@{key=$_.PSChildName;uid=$p.UID;promoted=$p.IsPromoted}}});[pscustomobject]@{supported=$true;icons=$icons}|ConvertTo-Json -Depth 4 -Compress}else{'{"supported":false}'}`;
    const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { encoding: 'utf8', windowsHide: true });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };
  let first;
  for (const phase of ['quit', 'lost-pipe']) {
    let child, fallback = 0;
    let resolveReady;
    const ready = new Promise(resolve => { resolveReady = resolve; });
    const opts = options(executable, { launch: (...args) => (child = spawn(...args)), onReady: resolveReady,
      onFallback: () => fallback++, onError() {} });
    assert.equal(createNativeTray(opts), true);
    const exited = once(child, 'exit');
    const timeout = setTimeout(() => child.kill(), 10000);
    try {
      await Promise.race([ready, exited.then(() => { throw Error('Native tray exited before readiness'); })]);
      const identity = snapshot();
      if (identity.supported) assert.equal(identity.icons.length, 1, 'Windows registers exactly one stable tray identity');
      if (phase === 'quit') first = identity;
      else assert.deepEqual(identity, first, 'Windows sees the same icon and visibility preference in the next session');
      if (phase === 'quit') opts.app.emit('will-quit');
      else child.stdin.destroy();
      const [code] = await exited;
      assert.equal(code, 0);
      assert.equal(fallback, phase === 'quit' ? 0 : 1);
    } finally {
      clearTimeout(timeout);
      if (child.exitCode === null) { child.kill(); await exited; }
    }
  }
});
