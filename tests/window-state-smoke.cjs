const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const runtimeRequire = createRequire(path.join(process.resourcesPath, 'app/package.json'));
const electron = runtimeRequire('electron');
const { app, BrowserWindow } = electron;
const results = process.env.QAQM_TEST_RESULTS;
const profile = process.env.QAQM_WINDOW_STATE_PROFILE;
const phase = process.env.QAQM_WINDOW_STATE_PHASE;
if (!profile || !profile.includes(path.sep + 'test-results' + path.sep)) throw Error('Synthetic window-state profile required');
process.env.QAQM_USER_DATA = profile;
fs.mkdirSync(profile, { recursive: true });
app.setPath('userData', profile); app.setPath('sessionData', profile);
app.disableHardwareAcceleration();
const stateFile = path.join(profile, 'window-state.json');
if (phase === 'resize') {
  fs.writeFileSync(path.join(profile, 'config.json'), JSON.stringify({
    compatibilityMode: true, compatibilityLevel: 3, persistBridgeEnabled: false,
    closeBehavior: 'quit', serverUrl: 'http://127.0.0.1:9'
  }));
}
// Real native windows and events, with offscreen rendering to avoid stealing focus.
const offscreen = Object.create(electron);
Object.defineProperty(offscreen, 'BrowserWindow', { value: new Proxy(BrowserWindow, {
  construct(Target, [options]) { return new Target({ ...options, webPreferences: { ...options.webPreferences, offscreen: true } }); }
}) });
runtimeRequire.cache[runtimeRequire.resolve('electron')].exports = offscreen;
BrowserWindow.prototype.show = function () {};
BrowserWindow.prototype.focus = function () {};
electron.net.fetch = global.fetch = async () => { throw Error('Window-state test is offline'); };
electron.dialog.showMessageBox = async () => ({ response: 2 });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(check) {
  for (let i = 0; i < 100; i++) { if (check()) return; await delay(100); }
  throw Error('Timed out waiting for native window state');
}
app.on('ready', () => {
  electron.session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (_, callback) => callback({ cancel: true }));
});
runtimeRequire('./out/main/index.js');
app.whenReady().then(async () => {
  await waitFor(() => BrowserWindow.getAllWindows().length === 1);
  const window = BrowserWindow.getAllWindows()[0];
  await waitFor(() => window.webContents.getURL() && !window.webContents.isLoading());
  const expected = phase === 'resize' ? { width: 1180, height: 720 } : JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  const assertSize = ({ width, height }) => {
    // Fractional Windows display scales can round native bounds by one DIP.
    assert.ok(Math.abs(width - expected.width) <= 1 && Math.abs(height - expected.height) <= 1, JSON.stringify({ width, height }));
  };
  if (phase === 'resize') {
    window.setSize(expected.width, expected.height);
  } else {
    const { width, height } = window.getNormalBounds();
    assertSize({ width, height });
    if (phase === 'maximize') {
      assert.equal(window.isMaximized(), false);
      window.maximize();
      await waitFor(() => window.isMaximized());
    } else {
      await waitFor(() => window.isMaximized());
      window.unmaximize();
      await waitFor(() => !window.isMaximized());
      const [width, height] = window.getSize(); assertSize({ width, height });
    }
  }
  // Close immediately: the debounced resize save must be flushed synchronously.
  const { width, height } = window.getNormalBounds();
  assertSize({ width, height });
  window.close();
  assert.deepEqual(JSON.parse(fs.readFileSync(stateFile, 'utf8')), { width, height, maximized: phase === 'maximize' });
  fs.writeFileSync(path.join(results, 'report.json'), JSON.stringify({ success: true, checks: [`Window state ${phase}: native close/restart persistence verified`] }, null, 2));
  app.exit(0);
}).catch(error => {
  fs.writeFileSync(path.join(results, 'report.json'), JSON.stringify({ success: false, error: error.stack }, null, 2));
  app.exit(1);
});
