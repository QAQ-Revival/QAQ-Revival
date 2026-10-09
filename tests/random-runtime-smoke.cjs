const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

if (process.versions.electron) {
  const { createRequire } = require('node:module');
  const runtimeRequire = createRequire(path.join(process.resourcesPath, 'app/package.json'));
  const electron = runtimeRequire('electron');
  const { app, BrowserWindow } = electron;
  const resultRoot = process.env.QAQM_RUNTIME_PROBE;
  app.disableHardwareAcceleration();
  BrowserWindow.prototype.show = function () {};
  BrowserWindow.prototype.focus = function () {};
  electron.dialog.showMessageBox = async () => ({ response: 1 });
  global.fetch = electron.net.fetch = async () => { throw Error('Runtime smoke is offline'); };
  app.on('ready', () => electron.session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (_, cb) => cb({ cancel: true })));
  app.on('second-instance', () => fs.writeFileSync(path.join(resultRoot, 'activated'), String(process.pid)));
  app.on('browser-window-created', (_, window) => {
    window.webContents.once('did-finish-load', () => setTimeout(() => {
      fs.writeFileSync(path.join(resultRoot, 'ready.json'), JSON.stringify({ pid: process.pid, executable: process.execPath,
        profile: app.getPath('userData'), title: window.getTitle(), windows: BrowserWindow.getAllWindows().length,
        appName: app.getName(), processIds: app.getAppMetrics().map(item => item.pid) }));
    }, 200));
  });
  const close = setInterval(() => {
    if (fs.existsSync(path.join(resultRoot, 'stop'))) { clearInterval(close); app.exit(0); }
  }, 100);
  runtimeRequire('./out/main/runtime-probe-main.cjs');
} else {
  const root = path.resolve(__dirname, '..');
  const stage = path.resolve(process.env.QAQM_BUILD_DIR || path.join(root, 'build/random-launch-local'));
  const executable = path.join(stage, 'QAQ-Revival.exe');
  const entry = path.join(stage, 'resources/app/out/main/index.js');
  const savedEntry = path.join(stage, 'resources/app/out/main/runtime-probe-main.cjs');
  const resultRoot = path.join(root, 'test-results', 'random-runtime-' + Date.now());
  const profile = path.join(resultRoot, 'profile');
  fs.mkdirSync(profile, { recursive: true });
  const originalExe = fs.readFileSync(executable), originalEntry = fs.readFileSync(entry);
  const children = new Set(); let activePid;
  const env = { ...process.env, QAQM_RUNTIME_PROBE: resultRoot, QAQM_USER_DATA: profile };
  delete env.ELECTRON_RUN_AS_NODE;
  async function wait(check, label) {
    for (let i = 0; i < 300; i++) { if (await check()) return; await delay(100); }
    throw Error('Timeout: ' + label);
  }
  const running = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
  const launch = () => {
    const child = spawn(executable, [], { cwd: stage, env, windowsHide: true, stdio: 'ignore' });
    children.add(child); child.once('exit', () => children.delete(child));
    return new Promise((resolve, reject) => { child.once('exit', code => code === 0 ? resolve() : reject(Error('Bootstrap exit ' + code))); child.once('error', reject); });
  };
  async function stop() {
    fs.writeFileSync(path.join(resultRoot, 'stop'), 'stop');
    await wait(() => !activePid || !running(activePid), 'test process stopped'); activePid = null;
    fs.unlinkSync(path.join(resultRoot, 'stop'));
  }
  (async () => {
    const checks = [];
    try {
      const stamp = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(root, 'tools/stamp-manifest.ps1'), '-Executable', executable, '-ExecutionLevel', 'asInvoker'], { encoding: 'utf8', windowsHide: true });
      assert.equal(stamp.status, 0, stamp.stderr);
      fs.copyFileSync(entry, savedEntry);
      fs.writeFileSync(entry, `require(${JSON.stringify(__filename)});`);
      fs.writeFileSync(path.join(profile, 'config.json'), JSON.stringify({ closeBehavior: 'exit', persistBridgeEnabled: false, softwareUpdateChecksEnabled: false }));
      await launch();
      await wait(() => fs.existsSync(path.join(resultRoot, 'ready.json')), 'random child ready');
      const first = JSON.parse(fs.readFileSync(path.join(resultRoot, 'ready.json'))); activePid = first.pid;
      assert.match(path.basename(first.executable), /^r[a-f0-9]{8,24}\.exe$/);
      assert.equal(first.profile, profile); assert.equal(first.title, path.basename(first.executable, '.exe')); assert.equal(first.windows, 1);
      checks.push('Real application switches from its stable entry to a random EXE and native title with the same profile');
      assert.equal(first.appName, first.title);
      assert.ok(first.processIds.length > 1, 'Inspect actual renderer/GPU/utility processes as well as the browser');
      const command = `Get-Process -Id ${first.processIds.join(',')} -ErrorAction Stop | ForEach-Object { [pscustomobject]@{ pid=$_.Id; name=$_.ProcessName; file=$_.Path; description=$_.MainModule.FileVersionInfo.FileDescription; product=$_.MainModule.FileVersionInfo.ProductName } } | ConvertTo-Json -Compress`;
      const inspect = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(command, 'utf16le').toString('base64')], { encoding: 'utf8', windowsHide: true });
      assert.equal(inspect.status, 0, inspect.stderr);
      const processes = JSON.parse(inspect.stdout);
      for (const item of processes) {
        assert.equal(item.name, first.title); assert.equal(item.file.toLowerCase(), first.executable.toLowerCase());
        assert.equal(item.description, first.title); assert.equal(item.product, first.title);
      }
      checks.push('All live application processes use the random image name, FileDescription and ProductName reported by Windows');
      await launch();
      await wait(() => fs.existsSync(path.join(resultRoot, 'activated')), 'duplicate activated first instance');
      assert.equal(Number(fs.readFileSync(path.join(resultRoot, 'activated'), 'utf8')), first.pid);
      checks.push('Repeated stable-entry launches activate the existing random process without starting another manager');
      await stop(); fs.unlinkSync(path.join(resultRoot, 'ready.json'));
      await launch();
      await wait(() => fs.existsSync(path.join(resultRoot, 'ready.json')), 'second session ready');
      const second = JSON.parse(fs.readFileSync(path.join(resultRoot, 'ready.json'))); activePid = second.pid;
      assert.notEqual(second.executable, first.executable); assert.equal(second.profile, first.profile);
      await stop();
      // Renderer/GPU processes can briefly retain the image after the main process exits.
      const { cleanupExecutables } = require('../app/out/main/random-executable.cjs');
      await wait(() => { cleanupExecutables(executable); return !fs.existsSync(first.executable); }, 'old child-process image unlocked and cleaned');
      checks.push('A new session gets another random name; closed copies are removed once Windows releases their images');
      fs.unlinkSync(path.join(resultRoot, 'ready.json'));
      const configFile = path.join(profile, 'config.json');
      const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
      config.randomLaunch = { manager: false, xxmi: true };
      fs.writeFileSync(configFile, JSON.stringify(config));
      const directSession = launch();
      await wait(() => fs.existsSync(path.join(resultRoot, 'ready.json')), 'disabled random startup ready');
      const direct = JSON.parse(fs.readFileSync(path.join(resultRoot, 'ready.json'))); activePid = direct.pid;
      assert.equal(direct.executable, executable); assert.equal(direct.title, 'QAQ-Revival'); assert.equal(direct.profile, profile);
      await stop(); await directSession;
      checks.push('Disabling the global manager option starts the original executable and title on the next session without changing its profile');
      fs.writeFileSync(path.join(resultRoot, 'report.json'), JSON.stringify({ success: true, checks }, null, 2));
      console.log(JSON.stringify({ success: true, checks, resultRoot }, null, 2));
    } catch (error) {
      fs.writeFileSync(path.join(resultRoot, 'report.json'), JSON.stringify({ success: false, checks, error: error.stack }, null, 2));
      console.error(error); process.exitCode = 1;
    } finally {
      if (activePid) await stop().catch(() => { if (running(activePid)) process.kill(activePid); });
      for (const child of children) child.kill();
      fs.writeFileSync(entry, originalEntry); fs.writeFileSync(executable, originalExe);
      if (fs.existsSync(savedEntry)) fs.unlinkSync(savedEntry);
      const { cleanupExecutables } = require('../app/out/main/random-executable.cjs'); cleanupExecutables(executable);
    }
  })();
}
