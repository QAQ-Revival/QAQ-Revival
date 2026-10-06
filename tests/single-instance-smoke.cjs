// Exercise the real packaged Electron singleton with an isolated profile.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { createRequire } = require('node:module');
const runtimeRequire = createRequire(path.join(process.resourcesPath, 'app/package.json'));
const electron = runtimeRequire('electron');
const { app, BrowserWindow } = electron;
const root = process.env.QAQM_TEST_RESULTS;
const profile = process.env.QAQM_USER_DATA;
const childId = process.env.QAQM_SINGLE_INSTANCE_CHILD;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

if (childId) {
  const report = { pid: process.pid, windows: 0, dialogs: 0, ipcHandlers: 0 };
  app.on('browser-window-created', () => { report.windows++; });
  electron.dialog.showMessageBox = async () => { report.dialogs++; return { response: 0 }; };
  const handle = electron.ipcMain.handle.bind(electron.ipcMain);
  electron.ipcMain.handle = (...args) => { report.ipcHandlers++; return handle(...args); };
  app.on('quit', () => fs.writeFileSync(path.join(root, `duplicate-${childId}.json`), JSON.stringify(report)));
  runtimeRequire('./out/main/index.js');
} else {
  fs.mkdirSync(profile, { recursive: true });
  fs.writeFileSync(path.join(profile, 'config.json'), JSON.stringify({
    compatibilityMode: true, compatibilityLevel: 3, persistBridgeEnabled: false,
    closeBehavior: 'minimize', serverUrl: 'http://127.0.0.1:9'
  }));
  // Keep test windows offscreen. Record activation calls without taking desktop focus.
  const offscreenElectron = Object.create(electron);
  Object.defineProperty(offscreenElectron, 'BrowserWindow', { value: new Proxy(BrowserWindow, {
    construct(Target, [options]) {
      return new Target({ ...options, show: false, webPreferences: { ...options.webPreferences, offscreen: true } });
    }
  }) });
  runtimeRequire.cache[runtimeRequire.resolve('electron')].exports = offscreenElectron;
  const activation = [];
  let minimized = false;
  BrowserWindow.prototype.show = function () { activation.push([this.id, 'show']); };
  BrowserWindow.prototype.focus = function () { activation.push([this.id, 'focus']); };
  BrowserWindow.prototype.isMinimized = function () { return minimized; };
  BrowserWindow.prototype.restore = function () { activation.push([this.id, 'restore']); minimized = false; };
  electron.dialog.showMessageBox = async () => ({ response: 2 });
  global.fetch = async () => { throw new Error('Singleton smoke test is offline'); };
  app.on('ready', () => {
    electron.session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (_, callback) => callback({ cancel: true }));
  });

  const checks = [];
  const children = new Set();
  let secondInstances = 0;
  app.on('second-instance', () => { secondInstances++; });
  function launchDuplicate(id) {
    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [], {
        cwd: path.dirname(process.execPath), windowsHide: true,
        env: { ...process.env, QAQM_SINGLE_INSTANCE_CHILD: id }, stdio: 'ignore'
      });
      children.add(child);
      const timeout = setTimeout(() => { child.kill(); reject(new Error(`Duplicate ${id} did not exit`)); }, 15000);
      child.once('error', error => { clearTimeout(timeout); children.delete(child); reject(error); });
      child.once('exit', code => {
        clearTimeout(timeout);
        children.delete(child);
        try {
          assert.equal(code, 0, `duplicate ${id} exits cleanly`);
          const report = JSON.parse(fs.readFileSync(path.join(root, `duplicate-${id}.json`)));
          assert.equal(report.windows, 0, 'duplicate creates no window');
          assert.equal(report.dialogs, 0, 'duplicate shows no warning');
          assert.equal(report.ipcHandlers, 0, 'duplicate initializes no services');
          resolve(report);
        } catch (error) { reject(error); }
      });
    });
  }
  async function waitFor(check, message) {
    for (let attempt = 0; attempt < 150; attempt++) {
      if (check()) return;
      await delay(100);
    }
    throw Error('Timeout: ' + message);
  }
  async function main() {
    runtimeRequire('./out/main/index.js');
    // Launch before ready to cover repeated clicks during initial startup as well.
    const startup = launchDuplicate('startup');
    await app.whenReady();
    await startup;
    await waitFor(() => BrowserWindow.getAllWindows().length === 1 && activation.some(([, action]) => action === 'focus'), 'startup activation');
    const window = BrowserWindow.getAllWindows()[0];
    const originalId = window.id;
    await waitFor(() => !window.webContents.isLoading(), 'renderer load');
    checks.push('Repeated launch during startup exits without a window/dialog/services and activates the first window');

    for (const state of ['visible', 'minimized', 'tray-hidden', 'burst']) {
      if (state === 'tray-hidden') window.close(); // Exercise the real close-to-tray handler.
      minimized = state === 'minimized';
      activation.length = 0;
      const before = secondInstances;
      const count = state === 'burst' ? 3 : 1;
      await Promise.all(Array.from({ length: count }, (_, i) => launchDuplicate(`${state}-${i}`)));
      await waitFor(() => secondInstances === before + count && activation.filter(([, action]) => action === 'focus').length === count, `${state} activation`);
      assert.deepEqual(BrowserWindow.getAllWindows().map(item => item.id), [originalId], 'same main window is reused');
      assert.equal(app.hasSingleInstanceLock(), true, 'first process still owns the singleton');
      const expected = state === 'minimized' ? ['restore', 'show', 'focus'] : ['show', 'focus'];
      assert.deepEqual(activation, Array.from({ length: count }, () => expected.map(action => [originalId, action])).flat());
      checks.push(`${state}: all duplicate processes exit; existing main window receives ${expected.join(', ')}`);
    }
    fs.writeFileSync(path.join(root, 'report.json'), JSON.stringify({ success: true, electron: process.versions.electron, pid: process.pid, checks }, null, 2));
    app.exit(0);
  }
  main().catch(error => {
    for (const child of children) child.kill();
    fs.writeFileSync(path.join(root, 'report.json'), JSON.stringify({ success: false, checks, error: error.stack }, null, 2));
    app.exit(1);
  });
}
