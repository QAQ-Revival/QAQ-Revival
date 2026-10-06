const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const runtimeRequire = createRequire(path.join(process.resourcesPath, 'app/package.json'));
const electron = runtimeRequire('electron');
const { app, BrowserWindow, ipcMain } = electron;
const results = process.env.QAQM_TEST_RESULTS;
const profile = process.env.QAQM_HIDDEN_RESTART_PROFILE;
if (!profile || !profile.includes(path.sep + 'test-results' + path.sep)) throw Error('A previous synthetic test profile is required');
process.env.QAQM_USER_DATA = profile;
app.setPath('userData', profile); app.setPath('sessionData', profile);
app.disableHardwareAcceleration();
const offscreen = Object.create(electron);
Object.defineProperty(offscreen, 'BrowserWindow', { value: new Proxy(BrowserWindow, {
  construct(Target, [options]) { return new Target({ ...options, show: false, webPreferences: { ...options.webPreferences, offscreen: true } }); }
}) });
runtimeRequire.cache[runtimeRequire.resolve('electron')].exports = offscreen;
BrowserWindow.prototype.show = function () {};
BrowserWindow.prototype.focus = function () {};
electron.net.fetch = global.fetch = async () => { throw Error('Restart test is offline'); };
const handlers = new Map();
const register = ipcMain.handle.bind(ipcMain);
ipcMain.handle = (name, fn) => { handlers.set(name, fn); register(name, fn); };
app.whenReady().then(async () => {
  electron.session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (_, callback) => callback({ cancel: true }));
  runtimeRequire('./out/main/index.js');
  const hidden = await handlers.get('character:list-hidden')({}, 'wuthering-waves');
  assert.ok(hidden.characters.some(item => item.name === '女主'));
  assert.ok(!(await handlers.get('get-characters')({})).characters.some(item => item.name === '女主'));
  assert.ok((await handlers.get('character:list-hidden')({}, 'endfield')).characters.some(item => item.name === '安可'));
  assert.ok(!(await handlers.get('character:list-hidden')({}, 'wuthering-waves')).characters.some(item => item.name === '安可'), 'Restored visibility also persists');
  assert.ok((await handlers.get('character:list-hidden')({}, 'neverness-to-everness')).characters.some(item => item.name === '薄荷'));
  fs.writeFileSync(path.join(results, 'report.json'), JSON.stringify({ success: true, checks: ['A new Electron process restores hidden and visible character settings independently for all three games, offline'] }, null, 2));
  app.exit(0);
}).catch(error => {
  fs.writeFileSync(path.join(results, 'report.json'), JSON.stringify({ success: false, error: error.stack }, null, 2)); app.exit(1);
});
