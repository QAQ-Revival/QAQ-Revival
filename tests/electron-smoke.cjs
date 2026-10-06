const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const runtimeRequire = createRequire(path.join(process.resourcesPath, 'app/package.json'));
const electron = runtimeRequire('electron');
const { app, BrowserWindow, ipcMain } = electron;
const root = process.env.QAQM_TEST_RESULTS;
const profile = process.env.QAQM_USER_DATA;
const mods = path.join(root, 'wuwa-mods');
const endfield = path.join(root, 'endfield-mods');
const loader = path.join(root, 'XXMI Launcher.exe');
const fixerExe = path.join(root, "独立修复器 & Tester's tool.exe");
const replacementFixerExe = path.join(root, '另一个修复器.exe');
const attachmentRequests = [], externalLinks = [];
const softwareUpdateRequests = [];
let softwareReleaseVersion = require('../app/package.json').version;
const attachmentZip = new (runtimeRequire('adm-zip'))();
attachmentZip.addFile('FixtureMod/mod.ini', Buffer.from('[TextureOverrideFixture]\nhash = 12345678\n'));
const attachmentBytes = attachmentZip.toBuffer();
const protectedNormal = 'https://mega.nz/folder/AbcdEF12#' + Buffer.alloc(16, 7).toString('base64url');
const protectedSalt = Buffer.alloc(32, 3), protectedDerived = crypto.pbkdf2Sync('smoke-password', protectedSalt, 100000, 64, 'sha512');
const protectedData = Buffer.concat([Buffer.from([2, 0]), Buffer.from('AbcdEF12', 'base64url'), protectedSalt, Buffer.from(Buffer.alloc(16, 7).map((b,i)=>b ^ protectedDerived[i]))]);
const protectedLink = 'https://mega.nz/#P!' + Buffer.concat([protectedData, crypto.createHmac('sha256', protectedDerived.subarray(32)).update(protectedData).digest()]).toString('base64url');
fs.mkdirSync(profile, { recursive: true });
fs.writeFileSync(loader, 'Synthetic test fixture, never executed');
fs.writeFileSync(fixerExe, 'Synthetic fixer, never executed');
fs.writeFileSync(replacementFixerExe, 'Synthetic replacement fixer, never executed');
app.setPath('userData', profile);
app.setPath('sessionData', profile);
app.disableHardwareAcceleration();
function fixture(relative, contents = '[TextureOverrideTest]\nhash = 12345678\n') {
  const file = path.join(mods, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}
fixture('安可/DISABLED_测试模组/mod.ini');
fixture('洛瑟菈/已有模组/mod.ini');
fs.mkdirSync(path.join(mods, '女主'), { recursive: true });
fs.mkdirSync(path.join(endfield, '佩丽卡/测试模组'), { recursive: true });
fs.writeFileSync(path.join(endfield, '佩丽卡/测试模组/mod.ini'), '[TextureOverrideTest]\nhash = 12345678\n');
fs.writeFileSync(path.join(profile, 'config.json'), JSON.stringify({
  activeGameId: 'wuthering-waves', modsPath: mods, compatibilityMode: true, compatibilityLevel: 'strong',
  persistBridgeEnabled: false, closeBehavior: 'exit', serverUrl: 'http://127.0.0.1:9',
  independentFixerPaths: { 'wuthering-waves': path.join(root, 'missing-fixer.exe'), endfield: path.join(root, 'missing-endfield-fixer.exe') },
  games: [
    { id: 'wuthering-waves', name: '鸣潮', shortName: '鸣潮', modFolderPath: mods, modLoaderPath: loader, launchMode: 'WWMI', supportedLaunchModes: ['WWMI', 'XXMI'] },
    { id: 'endfield', name: '明日方舟终末地', shortName: '终末地', modFolderPath: endfield, modLoaderPath: loader, launchMode: 'EFMI', supportedLaunchModes: ['EFMI', 'XXMI'] },
    ...(process.env.QAQM_SMOKE_SCOPE === 'hidden-characters' ? [{ id: 'neverness-to-everness', name: '异环', shortName: '异环',
      gamePath: path.join(root, 'nte-game', 'NTELauncher.exe'), modFolderPath: path.join(root, 'nte-mods'), nevernessDx12DisabledModsDir: path.join(root, 'nte-disabled'),
      launchMode: 'NEMI', supportedLaunchModes: ['NEMI', 'XXMI'] }] : [])
  ]
}));
fs.writeFileSync(path.join(profile, 'skin-config.json'), JSON.stringify({ activeSkinId: 'supporter', activatedSkins: [{ skinId: 'supporter', skinName: '旧功能包', cssVariables: { '--color-accent-primary': '#000000' } }] }));
// This smoke test exercises the real Electron main, preload, React DOM and filesystem
// with synthetic data. Keep windows hidden and external network calls offline.
const offscreenElectron = Object.create(electron);
Object.defineProperty(offscreenElectron, 'BrowserWindow', { value: new Proxy(BrowserWindow, {
  construct(Target, [options]) {
    return new Target({ ...options, show: false, webPreferences: { ...options.webPreferences, offscreen: true, backgroundThrottling: false } });
  }
}) });
runtimeRequire.cache[runtimeRequire.resolve('electron')].exports = offscreenElectron;
BrowserWindow.prototype.show = function () {};
BrowserWindow.prototype.focus = function () {};
app.on('browser-window-created', (_, createdWindow) => createdWindow.webContents.setBackgroundThrottling(false));
electron.dialog.showMessageBox = async () => ({ response: 1 });
electron.dialog.showErrorBox = (title, content) => console.error(title, content);
electron.shell.openExternal = async url => { externalLinks.push(url); };
const fixerSelections = [];
let nextFixerSelection = { canceled: false, filePaths: [fixerExe] };
electron.dialog.showOpenDialog = async (_window, options) => {
  fixerSelections.push(options);
  return nextFixerSelection;
};
const { EventEmitter } = require('node:events');
const retiredMainRequests = [];
global.fetch = async address => {
  if (/\/api\/(heartbeat|skins|features|server-support|games\/tutorial-urls)(\/|$)/.test(new URL(address).pathname)) retiredMainRequests.push(address);
  throw new Error('Smoke test is offline');
};
const pawMegaFolder = 'https://mega.nz/folder/AbcdEF12#' + 'a'.repeat(22);
const pawCreators = [{ id: '123', service: 'patreon', name: 'Moonholder · 测试作者', updated: 1786440000, favorited: 1234 },
  { id: '123', service: 'fanbox', name: 'Moonholder · 测试作者', updated: 1786440000, favorited: 500 },
  ...Array.from({ length: 26 }, (_, i) => ({ id: String(200 + i), service: i % 2 ? 'fanbox' : 'patreon', name: `创作者 ${i + 1}`, updated: 1786400000 - i * 86400, favorited: 560 - i * 10 }))];
const pawPosts = Array.from({ length: 51 }, (_, i) => ({ id: String(1000 - i), user: '123', service: 'patreon',
  title: `历史模组 ${i}`, content: '<p>用于界面验证的测试内容。</p>', published: '2026-08-11T00:25:35', edited: '2026-08-11T00:25:35', attachments: [] }));
pawPosts[0].file = { name: '晨光预览.png', path: '/smoke/cover.png' };
pawPosts[0].attachments = [pawPosts[0].file, { name: '细节预览.png', path: '/smoke/detail.png' }, { name: 'mod.zip', path: '/smoke/mod.zip' }];
pawPosts[0].content = '<p>用于界面验证的测试内容。</p><img src="/data/smoke/inline.png"><img src="javascript:window.pawXss=true"><p>' + protectedLink + '</p>';
const kemonoPosts = [{ ...pawPosts[0], title: 'Kemono 测试 MOD' }];
let pawOffline = false;
let delayedPost = '';
let catalogRequests = 0, catalogOffline = false;
electron.net.fetch = async (address, options = {}) => {
  const url = new URL(address);
  if (url.href === 'https://api.github.com/repos/QAQ-Revival/QAQ-Revival/releases/latest') {
    softwareUpdateRequests.push(options);
    return new Response(JSON.stringify({ tag_name: 'v' + softwareReleaseVersion, html_url: 'https://github.com/QAQ-Revival/QAQ-Revival/releases/tag/v' + softwareReleaseVersion,
      published_at: '2026-10-06T00:00:00Z', draft: false, prerelease: false, body: 'Smoke update fixture' }), { headers: { 'content-type': 'application/json' } });
  }
  if (['file.pawchive.pw', 'n3.kemono.cr'].includes(url.hostname) && url.pathname === '/data/smoke/mod.zip') {
    attachmentRequests.push(url.href);
    return new Response(attachmentBytes, { headers: { 'content-type': 'application/zip', 'content-length': String(attachmentBytes.length) } });
  }
  if (url.origin === 'https://api.encore.moe') {
    catalogRequests++;
    if (catalogOffline) throw Error('Synthetic catalog offline');
    return new Response(JSON.stringify({ roleList: ['安可', '今汐', '吟霖', '散华', '在线新增角色'].map((Name, index) => ({ Id: index, Name, RoleHeadIcon: 'https://api.encore.moe/example.webp' })) }), { headers: { 'content-type': 'application/json' } });
  }
  if (!['https://pawchive.pw', 'https://kemono.cr'].includes(url.origin)) throw new Error('Smoke test is offline');
  if (url.origin === 'https://kemono.cr') {
    let data;
    if (url.pathname.endsWith('/creators')) data = [{ ...pawCreators[0], name: 'Kemono 测试作者' }];
    else if (url.pathname.endsWith('/profile')) data = { ...pawCreators[0], name: 'Kemono 测试作者' };
    else if (url.pathname.includes('/post/')) data = { post: kemonoPosts[0], attachments: kemonoPosts[0].attachments.map(file => ({ ...file, server: 'https://n3.kemono.cr' })) };
    else data = url.pathname.includes('/user/') ? { results: kemonoPosts, props: { count: 1 } } : { posts: kemonoPosts, count: 1 };
    return new Response(JSON.stringify(data), { headers: { 'content-type': 'text/css; charset=utf-8' } });
  }
  if (pawOffline) return new Response('{}', { status: 503, headers: { 'content-type': 'application/json' } });
  const endpoint = url.pathname.replace('/api/v1', '');
  let data;
  if (endpoint === '/creators') data = pawCreators;
  else if (endpoint.endsWith('/profile')) data = pawCreators.find(author => endpoint === `/${author.service}/user/${author.id}/profile`);
  else if (endpoint.includes('/post/')) {
    data = pawPosts.find(post => endpoint.endsWith('/' + post.id));
    if (data?.id === delayedPost) await new Promise(resolve => setTimeout(resolve, 350));
  }
  else {
    const identity = /^\/([^/]+)\/user\/([^/]+)$/.exec(endpoint);
    data = pawPosts.slice(Number(url.searchParams.get('o') || 0), Number(url.searchParams.get('o') || 0) + 50)
      .map(post => identity ? { ...post, service: identity[1], user: identity[2] } : post);
  }
  return new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
};
for (const module of ['node:http', 'node:https']) {
  const network = require(module);
  network.request = () => {
    const request = new EventEmitter();
    request.write = () => true;
    request.end = () => process.nextTick(() => request.emit('error', new Error('Smoke test is offline')));
    request.setTimeout = () => request;
    request.setHeader = () => {};
    request.destroy = () => {};
    return request;
  };
  network.get = (...args) => { const req = network.request(...args); req.end(); return req; };
}
const handlers = new Map();
const register = ipcMain.handle.bind(ipcMain);
ipcMain.handle = (name, fn) => { handlers.set(name, fn); register(name, fn); };
const checks = [];
const launchRequests = [];
const revivalRequests = [];
const revivalChildren = [];
fs.writeFileSync(path.join(profile, 'market-download-settings.json'), JSON.stringify({ cacheDir: path.join(root, 'download-cache') }));
const revivalModulePath = runtimeRequire.resolve('./out/main/mega-task-manager.cjs');
const revivalModule = runtimeRequire(revivalModulePath);
runtimeRequire.cache[revivalModulePath].exports = { ...revivalModule,
  registerRevivalIpc: options => revivalModule.registerRevivalIpc({ ...options,
    spawn: (file, args, options) => {
      const { PassThrough } = require('node:stream');
      const child = new EventEmitter(); child.stdin = new PassThrough(); child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.requests = [];
      child.progress = data => child.stdout.write(JSON.stringify(data) + '\n'); child.kill = () => child.emit('close');
      child.stdin.on('data', bytes => {
        const request = JSON.parse(bytes.toString());
        child.requests.push(request);
        if (request.url) { revivalRequests.push({ file, args, options, ...request }); child.progress({ status: 'downloading', downloaded: 1048576, total: 5242880, percent: 20, currentFile: 'SubA/测试模组.zip', filesCompleted: 0, filesTotal: 2 }); }
        else if (request.action === 'pause') child.progress({ status: 'paused' });
        else if (request.action === 'resume') child.progress({ status: 'downloading', percent: 40 });
        else if (request.action === 'cancel') { child.progress({ status: 'canceled' }); child.kill(); }
      });
      revivalChildren.push(child);
      process.nextTick(() => child.emit('spawn')); return child;
    } })
};
let launchFailure = false;
let fixerLaunchFailure = false;
const launchModulePath = runtimeRequire.resolve('./out/main/windows-launch.cjs');
const launchModule = runtimeRequire(launchModulePath);
runtimeRequire.cache[launchModulePath].exports = {
  ...launchModule,
  createWindowsLauncher: () => ({ launch: async (file, cwd, args, options) => {
    launchRequests.push({ file, cwd, args, options });
    if (fixerLaunchFailure && file !== loader) return { success: false, error: '模拟：修复器启动失败' };
    return launchFailure ? { success: false, error: '模拟：用户取消管理员授权' } : { success: true };
  } })
};
function passed(name) {
  checks.push(name);
  fs.writeFileSync(path.join(root, 'progress.json'), JSON.stringify({ checks }, null, 2));
}
function snapshot(directory) {
  const result = [];
  function visit(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name))) {
      const full = path.join(dir, entry.name), rel = path.relative(directory, full);
      result.push(entry.isDirectory() ? [rel, 'dir'] : [rel, crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex')]);
      if (entry.isDirectory()) visit(full);
    }
  }
  visit(directory);
  return JSON.stringify(result);
}
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let window;
const evaluate = async code => {
  try { return await window.webContents.executeJavaScript(code, true); }
  catch (error) { throw new Error(error.message + '\nEvaluated: ' + code); }
};
async function captureUI(name) {
  await evaluate(`(() => { let style = document.getElementById('smoke-still-frame'); if (!style) { style = document.createElement('style'); style.id = 'smoke-still-frame'; style.textContent = '*, *::before, *::after { animation: none !important; transition: none !important; }'; document.head.append(style); } return true; })()`);
  // Offscreen/minimized windows may stop animation frames; do not hang the suite.
  await evaluate('Promise.race([new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)))), new Promise(resolve => setTimeout(() => resolve(false), 300))])');
  const pixels = await new Promise((resolve, reject) => {
    const listener = (_event, _rect, pixels) => { clearTimeout(timer); resolve(pixels); };
    const timer = setTimeout(async () => {
      window.webContents.removeListener('paint', listener);
      try { resolve(await window.webContents.capturePage()); } catch (error) { reject(error); }
    }, 2000);
    window.webContents.once('paint', listener); window.webContents.startPainting(); window.webContents.invalidate();
  });
  fs.writeFileSync(path.join(root, name), pixels.toPNG());
  const layout = await evaluate(`JSON.stringify({ sidebar: document.querySelector('.sidebar').className, sidebarWidth: document.querySelector('.sidebar').getBoundingClientRect().width, active: document.querySelector('.nav-item.active')?.textContent, authors: document.querySelectorAll('.paw-creator-card').length, posts: document.querySelectorAll('.paw-post-card').length, panel: !!document.querySelector('.qaqm-download-panel') })`);
  fs.appendFileSync(path.join(root, 'ui-layouts.jsonl'), JSON.stringify({ name, layout: JSON.parse(layout) }) + '\n');
}
async function waitFor(code, message, timeout = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(code)) return;
    await delay(100);
  }
  throw Error('Timeout: ' + message + '\n' + await evaluate('document.body.innerText.slice(0, 3000)'));
}
async function clickText(text) {
  await waitFor(`Array.from(document.querySelectorAll('button')).some(x => x.textContent.trim() === ${JSON.stringify(text)} && !x.disabled)`, 'button ' + text);
  const found = await evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === ${JSON.stringify(text)}); if (!b || b.disabled) return false; b.click(); return true; })()`);
  assert.ok(found, 'Button enabled: ' + text);
}
async function main() {
  await app.whenReady();
  electron.session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (request, callback) => callback({ cancel: !new URL(request.url).pathname.includes('/smoke/') }));
  electron.session.defaultSession.protocol.handle('https', request => {
    const second = request.url.includes('detail'), third = request.url.includes('inline');
    const color = second ? '#ada1d3' : third ? '#a3ccd0' : '#e8abc0';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200"><defs><linearGradient id="g" x2=".8" y2="1"><stop stop-color="${color}"/><stop offset="1" stop-color="#4c536c"/></linearGradient></defs><rect width="900" height="1200" fill="url(#g)"/><circle cx="600" cy="370" r="210" fill="#fff" opacity=".25"/><path d="M0 910L380 510L900 1000V1200H0Z" fill="#fff" opacity=".18"/><text x="65" y="1050" fill="white" font-family="sans-serif" font-size="66">MOD PREVIEW ${second ? 2 : third ? 3 : 1}</text></svg>`;
    return new Response(svg, { headers: { 'content-type': 'image/svg+xml' } });
  });
  const initial = snapshot(mods);
  // Exercise production's default AppData/QAQ-Revival resolution without using real data.
  app.setPath('appData', path.dirname(profile));
  delete process.env.QAQM_USER_DATA;
  runtimeRequire('./out/main/index.js');
  assert.equal(app.getPath('userData'), profile);
  assert.equal(app.getPath('sessionData'), profile);
  await delay(800);
  window = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('renderer/index.html')) || BrowserWindow.getAllWindows()[0];
  assert.ok(window, 'Real app window created');
  window.setSize(1440, 960);
  await waitFor(`!!document.querySelector('.game-selector-trigger') && [...document.querySelectorAll('button')].some(b => b.textContent.trim() === '刷新')`, 'main UI');
  assert.equal(await evaluate(`!!document.querySelector('.disclaimer-overlay, .startup-notice-overlay')`), false);
  assert.equal(await evaluate(`localStorage.getItem('hideDisclaimer_v3')`), null);
  assert.ok(await evaluate(`!('getDisclaimerDismissed' in window.api) && !('setDisclaimerDismissed' in window.api)`));
  if (process.env.QAQM_SMOKE_SCOPE === 'translation') {
    await require('./hotkey-translation-smoke.cjs')({ electron, root, mods, passed });
    fs.writeFileSync(path.join(root, 'report.json'), JSON.stringify({ success: true, electron: process.versions.electron, checks }, null, 2));
    app.exit(0); return;
  }
  if (process.env.QAQM_SMOKE_SCOPE === 'hidden-characters') {
    await require('./hidden-characters-smoke.cjs')({ electron, evaluate, waitFor, captureUI, window, root, profile, mods, handlers, passed });
    fs.writeFileSync(path.join(root, 'report.json'), JSON.stringify({ success: true, electron: process.versions.electron, checks }, null, 2));
    app.exit(0); return;
  }
  assert.equal(handlers.has('get-disclaimer-dismissed') || handlers.has('set-disclaimer-dismissed'), false);
  passed('Fresh profile opens directly without a disclaimer, author popup, or dismissal APIs');
  assert.deepEqual(retiredMainRequests, []);
  for (const channel of ['get-tutorial-url', 'get-announcements']) assert.equal(handlers.has(channel), false);
  assert.equal(await evaluate(`'getTutorialUrl' in window.api || 'getAnnouncements' in window.api`), false);
  await require('./window-controls-smoke.cjs')({ evaluate, waitFor, window, handlers, passed });
  await require('./sidebar-width-smoke.cjs')({ evaluate, waitFor, window, passed });
  if (process.env.QAQM_SMOKE_SCOPE === 'post-links') {
    await require('./post-links-smoke.cjs')({ evaluate, waitFor, captureUI, window, root, passed, handlers, attachmentRequests, attachmentBytes, externalLinks, protectedLink, protectedNormal, revivalChildren, setSelection: result => { nextFixerSelection = result; } });
    fs.writeFileSync(path.join(root, 'report.json'), JSON.stringify({ success: true, electron: process.versions.electron, checks }, null, 2));
    app.exit(0); return;
  }
  if (process.env.QAQM_SMOKE_SCOPE === 'market-scope') {
    await require('./market-request-scope-smoke.cjs')({ evaluate, waitFor, window, passed });
    fs.writeFileSync(path.join(root, 'report.json'), JSON.stringify({ success: true, electron: process.versions.electron, checks }, null, 2));
    app.exit(0);
    return;
  }
  if (process.env.QAQM_SMOKE_SCOPE === 'imports') {
    await require('./import-group-smoke.cjs')({ evaluate, waitFor, captureUI, root, passed, setSelection: result => { nextFixerSelection = result; } });
    fs.writeFileSync(path.join(root, 'report.json'), JSON.stringify({ success: true, electron: process.versions.electron, checks }, null, 2));
    app.exit(0);
    return;
  }
  if (process.env.QAQM_SMOKE_SCOPE === 'sources') {
    await require('./source-preferences-smoke.cjs')({ evaluate, waitFor, captureUI, window, passed });
    fs.writeFileSync(path.join(root, 'report.json'), JSON.stringify({ success: true, electron: process.versions.electron, checks }, null, 2));
    app.exit(0);
    return;
  }
  if (process.env.QAQM_SMOKE_SCOPE === 'sorting') {
    await require('./sortable-order-smoke.cjs')({ evaluate, waitFor, captureUI, window, passed });
    fs.writeFileSync(path.join(root, 'report.json'), JSON.stringify({ success: true, electron: process.versions.electron, checks }, null, 2));
    app.exit(0);
    return;
  }
  if (process.env.QAQM_SMOKE_SCOPE === 'settings') {
    await require('./settings-smoke.cjs')({ evaluate, waitFor, captureUI, window, passed, handlers, root, setSelection: result => { nextFixerSelection = result; } });
    fs.writeFileSync(path.join(root, 'report.json'), JSON.stringify({ success: true, electron: process.versions.electron, checks }, null, 2));
    app.exit(0);
    return;
  }
  const navigation = await evaluate(`Array.from(document.querySelectorAll('.nav-item')).map(item => item.textContent)`);
  assert.equal(navigation.length, 3, JSON.stringify(navigation));
  assert.match(navigation[1], /MOD下载/);
  assert.ok(navigation.every(label => !/支持主包|个性化/.test(label)));
  for (const tab of ['support', 'personalization']) {
    await evaluate(`window.dispatchEvent(new CustomEvent('qaqm-navigate', { detail: { tab: ${JSON.stringify(tab)} } }))`);
    await delay(150);
    assert.ok(await evaluate(`Array.from(document.querySelectorAll('button')).some(button => button.textContent.trim() === '刷新')`), 'Removed routes must preserve the current page');
  }
  const removedApis = ['getAuthorAvatar', 'getMemes', 'getDeviceFingerprint', 'activateSkinCode', 'getCloudBackgrounds', 'downloadCloudBackground', 'getCloudBackgroundData', 'deleteCloudBackground'];
  assert.ok(await evaluate(`${JSON.stringify(removedApis)}.every(name => !(name in window.api))`));
  for (const name of ['get-author-avatar', 'get-memes', 'get-device-fingerprint', 'activate-skin-code', 'get-cloud-backgrounds', 'download-cloud-background', 'get-cloud-background-data', 'delete-cloud-background']) {
    assert.ok(!handlers.has(name), 'Removed IPC handler: ' + name);
  }
  const assetsPath = path.join(process.resourcesPath, 'app/out/renderer/assets');
  // Parse the authored module in Electron's V8 for actionable syntax locations.
  new (require('node:vm').Script)(fs.readFileSync(path.join(assetsPath, 'ModPostDialog.js'), 'utf8')
    .replace(/^import .*$/mg, '').replaceAll('export default ', '').replaceAll('export ', ''), { filename: 'ModPostDialog.js' });
  for (const file of ['SupportView-CinAzyNM.js', 'PersonalizationView-C63jzEOP.js']) {
    assert.ok(!fs.existsSync(path.join(assetsPath, file)), 'Removed module must not survive packaging: ' + file);
  }
  for (const file of fs.readdirSync(assetsPath).filter(name => name.endsWith('.js'))) {
    const source = fs.readFileSync(path.join(assetsPath, file), 'utf8');
    for (const match of source.matchAll(/["'](\.\/[\w.-]+\.(?:js|css))["']/g)) {
      assert.ok(fs.existsSync(path.join(assetsPath, match[1])), `${file} refers to missing asset ${match[1]}`);
    }
  }
  for (const file of ['SettingsView.js', 'PresetView.js', 'ModMarketView.js', 'ModView.js', 'ModPostDialog.js', 'PawchiveView.js', 'ModDownloadView.js']) {
    await evaluate(`import(new URL('./assets/' + ${JSON.stringify(file)}, location.href).href).then(() => true)`);
  }
  passed('Removed pages, IPC and bundles are absent; stale navigation preserves the current page and remaining modules load');
  // Suppress the import tutorial in this isolated test profile.
  await evaluate(`localStorage.setItem('batch-import-guide-dismissed', 'true');`);
  assert.equal(snapshot(mods), initial, 'startup should not alter synthetic Mods');
  const read = await handlers.get('character:refresh')({}, { organize: true, bootstrap: true });
  assert.equal(read.success, true);
  assert.equal(snapshot(mods), initial);
  assert.equal(read.characters.find(c => c.name === '安可')?.modCount, 1);
  assert.equal(read.characters.find(c => c.name === '安可')?.enabledCount, 0);
  assert.ok(read.characters.find(c => c.name === '女主')?.skinCount > 0, 'Fixture exercises official skins');
  passed('Real refresh IPC ignores legacy organize/bootstrap flags and leaves files unchanged');
  assert.equal(catalogRequests, 0, 'Refresh must not fetch character metadata');
  const beforeCatalogUpdate = snapshot(mods);
  await clickText('更新角色');
  await waitFor(`document.body.innerText.includes('角色资料已更新')`, 'online character metadata update');
  assert.ok((await evaluate('window.api.getCharacters()')).characters.some(character => character.name === '在线新增角色'));
  const afterCatalogUpdate = snapshot(mods);
  const updatedEntries = new Map(JSON.parse(afterCatalogUpdate));
  for (const [file, digest] of JSON.parse(beforeCatalogUpdate)) assert.equal(updatedEntries.get(file), digest, 'Preserve existing directories and Mod bytes: ' + file);
  for (const [file, digest] of JSON.parse(afterCatalogUpdate)) {
    if (!new Map(JSON.parse(beforeCatalogUpdate)).has(file)) assert.equal(digest, 'dir', 'Only empty character folders may be added');
  }
  assert.equal(await evaluate(`!!document.querySelector('.modal-backdrop')`), false);
  assert.equal(catalogRequests, 2);
  catalogOffline = true;
  await clickText('更新角色');
  await waitFor(`document.body.innerText.includes('已保留原有资料')`, 'offline catalog fallback');
  assert.ok((await evaluate('window.api.getCharacters()')).characters.some(character => character.name === '在线新增角色'));
  assert.equal(snapshot(mods), afterCatalogUpdate);
  catalogOffline = false;
  await captureUI('character-actions.png');
  passed('Refresh, Update Characters and Organize are separate; online metadata updates and failures never move or edit Mods');
  await waitFor(`document.body.innerText.includes('安可')`, 'character data loaded');
  const beforeFixer = snapshot(mods);
  await clickText('🔧 修复器');
  await waitFor(`document.body.innerText.includes('独立修复器已打开')`, 'fixer opened');
  assert.equal(fixerSelections.length, 1);
  assert.ok(fixerSelections[0].title.includes('鸣潮'));
  assert.deepEqual(fixerSelections[0].filters[0].extensions, ['exe']);
  assert.equal(launchRequests.at(-1).file, fixerExe);
  assert.equal(launchRequests.at(-1).cwd, root);
  assert.deepEqual(launchRequests.at(-1).options, { requireElevation: false });
  assert.equal(JSON.parse(fs.readFileSync(path.join(profile, 'config.json'))).independentFixerPaths['wuthering-waves'], fixerExe);
  assert.equal(await evaluate(`!!document.querySelector('.wuwa-fix-confirm-backdrop, .wuwa-fix-result-backdrop')`), false);
  assert.equal(await evaluate(`document.body.innerText.includes('内置修复')`), false);
  assert.equal(snapshot(mods), beforeFixer);
  // Hidden/offscreen windows may leave the page entrance animation at its first frame.
  const captureStyle = await window.webContents.insertCSS('.page-transition-enter { animation: none !important; opacity: 1 !important; transform: none !important; }');
  await delay(700);
  await window.webContents.capturePage().then(img => fs.writeFileSync(path.join(root, 'independent-fixer.png'), img.toPNG()));
  await window.webContents.removeInsertedCSS(captureStyle);
  passed('Fixer button selects a missing standalone tool, saves its path and opens directly without a repair modal or Mod writes');
  for (const channel of ['fix:run-all', 'fix:run-character', 'fix:run-mod']) {
    const result = await handlers.get(channel)({}, { gameId: 'wuthering-waves', mode: 'builtin', characterName: '安可', modName: 'DISABLED_测试模组' });
    assert.equal(result.success, true);
    assert.equal(result.exePath, fixerExe);
  }
  assert.equal(fixerSelections.length, 1);
  assert.equal(snapshot(mods), beforeFixer);
  assert.ok(!handlers.has('fix:update-wuwa-rules'));
  assert.equal(await evaluate(`typeof window.api.fixUpdateWuwaRules`), 'undefined');
  assert.equal((await handlers.get('fix:get-exe-path')({}, { gameId: 'wuthering-waves' })).engine, 'external');
  passed('All IPC repair scopes reuse the saved standalone path, including legacy builtin requests; built-in updates are unavailable');
  fs.unlinkSync(fixerExe);
  nextFixerSelection = { canceled: true, filePaths: [] };
  const beforeCancel = launchRequests.length;
  await clickText('🔧 修复器');
  await waitFor(`Array.from(document.querySelectorAll('button')).some(b => b.textContent.trim() === '🔧 修复器' && !b.disabled)`, 'selection cancelled');
  assert.equal(fixerSelections.length, 2);
  assert.equal(launchRequests.length, beforeCancel);
  assert.equal(JSON.parse(fs.readFileSync(path.join(profile, 'config.json'))).independentFixerPaths['wuthering-waves'], fixerExe);
  nextFixerSelection = { canceled: false, filePaths: [replacementFixerExe] };
  await clickText('🔧 修复器');
  await waitFor(`Array.from(document.querySelectorAll('button')).some(b => b.textContent.trim() === '🔧 修复器' && !b.disabled)`, 'replacement opened');
  assert.equal(fixerSelections.length, 3);
  assert.equal(launchRequests.at(-1).file, replacementFixerExe);
  assert.equal(JSON.parse(fs.readFileSync(path.join(profile, 'config.json'))).independentFixerPaths['wuthering-waves'], replacementFixerExe);
  passed('Deleted saved fixer prompts again; cancelling is harmless and a replacement path is persisted');
  fixerLaunchFailure = true;
  await clickText('🔧 修复器');
  await waitFor(`document.body.innerText.includes('修复器启动失败')`, 'fixer error shown');
  assert.equal(fixerSelections.length, 3);
  fixerLaunchFailure = false;
  await evaluate(`Array.from(document.querySelectorAll('.character-card')).find(x => (x.getAttribute('aria-label') || x.innerText).includes('安可')).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 450, clientY: 320 }))`);
  await waitFor(`!!document.querySelector('.character-context-menu')`, 'character context menu');
  assert.equal(await evaluate(`Array.from(document.querySelectorAll('.character-context-menu button')).filter(b => b.textContent.trim() === '🔧 修复器').length`), 1);
  assert.ok(await evaluate(`document.querySelector('.character-context-menu').innerText.includes('更换修复器')`));
  await evaluate(`Array.from(document.querySelectorAll('.character-context-menu button')).find(b => b.textContent.trim() === '🔧 修复器').click()`);
  await waitFor(`!document.querySelector('.character-context-menu')`, 'character fixer opened');
  assert.equal(snapshot(mods), beforeFixer);
  passed('Launch failures are visible; character context menu has one fixer action and allows changing the saved tool');
  await clickText('有内容');
  await delay(200);
  const names = await evaluate(`Array.from(document.querySelectorAll('.character-card')).map(x => x.getAttribute('aria-label') || x.innerText)`);
  assert.ok(names.some(n => n.includes('安可')), JSON.stringify(names));
  assert.ok(!names.some(n => n.includes('女主')), JSON.stringify(names));
  passed('Has-content filter excludes skin-only characters and includes disabled Mods');
  await clickText('全部角色');
  await delay(150);
  assert.ok(await evaluate(`Array.from(document.querySelectorAll('.character-card')).some(x => (x.getAttribute('aria-label') || x.innerText).includes('女主'))`));
  passed('All-characters filter still shows skin-only characters');
  fixture('安可/新增模组/mod.ini');
  const beforeRefresh = snapshot(mods);
  await clickText('刷新');
  await waitFor(`document.body.innerText.includes('已重新读取本地角色和 Mod')`, 'refresh completion');
  assert.equal(snapshot(mods), beforeRefresh);
  assert.equal((await handlers.get('get-characters')({})).characters.find(c => c.name === '安可').modCount, 2);
  passed('Refresh button sees an externally added Mod without moving files or opening a dialog');
  fixture('Character/Jinhsi/旧结构模组/mod.ini');
  const beforeScan = snapshot(mods);
  await clickText('整理');
  await waitFor(`!!document.querySelector('.legacy-import-overlay')`, 'organization preview');
  assert.equal(snapshot(mods), beforeScan);
  await clickText('先不处理');
  assert.equal(snapshot(mods), beforeScan);
  passed('Organization scan and cancellation preserve every directory and file hash');
  const preview = await handlers.get('character:organize-preview')({});
  assert.equal(preview.legacyImport.hasCandidates, true);
  const denied = await handlers.get('legacy-import:migrate')({}, {});
  assert.equal(denied.success, false);
  fixture('Character/Jinhsi/后来加入的模组/mod.ini');
  const stale = await handlers.get('legacy-import:migrate')({}, { token: preview.legacyImport.token });
  assert.equal(stale.success, false);
  passed('Unconfirmed or stale organization plans cannot move files');
  await clickText('整理');
  await waitFor(`!!document.querySelector('.legacy-import-overlay')`, 'new organization preview');
  await clickText('确认整理');
  await waitFor(`!document.querySelector('.legacy-import-overlay')`, 'organization completion');
  assert.ok(fs.existsSync(path.join(mods, '今汐/旧结构模组/mod.ini')));
  assert.ok(fs.existsSync(path.join(mods, '今汐/后来加入的模组/mod.ini')));
  assert.equal(fs.readFileSync(path.join(mods, '今汐/旧结构模组/mod.ini'), 'utf8'), '[TextureOverrideTest]\nhash = 12345678\n');
  assert.ok(!fs.existsSync(path.join(mods, 'Character/Jinhsi/旧结构模组')));
  passed('Confirmed organization uses built-in Jinhsi → 今汐 rules and preserves Mod bytes');
  // Refresh closes any remaining scan state before testing the selector.
  await evaluate(`window.api.refreshCharacters()`);
  await evaluate(`document.querySelector('.game-selector-trigger').click()`);
  await waitFor(`!!document.querySelector('#sidebar-game-menu')`, 'game menu');
  await delay(700);
  await window.webContents.capturePage().then(img => fs.writeFileSync(path.join(root, 'game-selector.png'), img.toPNG()));
  assert.ok(!await evaluate(`Array.from(document.querySelectorAll('.nav-item')).some(x => x.textContent.includes('切换游戏'))`));
  const activeCount = await evaluate(`document.querySelectorAll('[role="menuitemradio"][aria-checked="true"]').length`);
  assert.equal(activeCount, 1);
  await evaluate(`Array.from(document.querySelectorAll('[role="menuitemradio"]')).find(x => x.textContent.includes('明日方舟终末地')).click()`);
  await waitFor(`document.querySelector('.game-selector-trigger')?.textContent.includes('明日方舟终末地') && document.body.innerText.includes('佩丽卡')`, 'game switched');
  assert.ok(!await evaluate(`Array.from(document.querySelectorAll('.character-card')).some(x => (x.getAttribute('aria-label') || x.innerText).includes('安可'))`));
  passed('Sidebar switch updates active game, character data and launch modes without a switch page');
  fs.writeFileSync(fixerExe, 'Synthetic Endfield fixer, never executed');
  nextFixerSelection = { canceled: false, filePaths: [fixerExe] };
  await clickText('🔧 修复器');
  await waitFor(`document.body.innerText.includes('独立修复器已打开')`, 'Endfield fixer opened');
  assert.equal(fixerSelections.length, 4);
  assert.ok(fixerSelections.at(-1).title.includes('终末地'));
  const persistedFixers = JSON.parse(fs.readFileSync(path.join(profile, 'config.json'))).independentFixerPaths;
  assert.equal(persistedFixers.endfield, fixerExe);
  assert.equal(persistedFixers['wuthering-waves'], replacementFixerExe);
  passed('Game switching keeps standalone fixer selections separate');
  // Keyboard close + collapsed sidebar access.
  await evaluate(`document.querySelector('.game-selector-trigger').click()`);
  await waitFor(`!!document.querySelector('#sidebar-game-menu')`, 'reopened menu');
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
  await waitFor(`!document.querySelector('#sidebar-game-menu')`, 'escape closes menu');
  await evaluate(`document.querySelector('.sidebar-toggle').click()`);
  await delay(150);
  await evaluate(`document.querySelector('.game-selector-trigger').click()`);
  await waitFor(`!!document.querySelector('#sidebar-game-menu')`, 'collapsed selector');
  passed('Game dropdown supports Escape and remains usable with the sidebar collapsed');
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); document.querySelector('.sidebar-header').click()`);
  await waitFor(`!document.querySelector('.sidebar.collapsed')`, 'sidebar expanded');
  assert.equal(await evaluate(`document.querySelectorAll('.launch-actions button').length`), 2);
  assert.equal(await evaluate(`document.querySelector('.sidebar').innerText.includes('观看使用教程')`), false);
  assert.equal(await evaluate(`document.querySelectorAll('.sidebar .mode-btn').length`), 0);
  await clickText('直接启动');
  await waitFor(`!document.querySelector('[aria-label="直接启动"]').disabled`, 'direct launch completed');
  assert.deepEqual(launchRequests.at(-1).args, ['--nogui', '--xxmi', 'EFMI']);
  assert.equal(launchRequests.at(-1).file, loader);
  await clickText('XXMI 启动');
  await waitFor(`!document.querySelector('[aria-label="XXMI 启动"]').disabled`, 'XXMI launch completed');
  assert.deepEqual(launchRequests.at(-1).args, []);
  passed('Two launch buttons replace tutorial/mode selection: direct uses EFMI, XXMI opens GUI');
  await handlers.get('game:switch')({}, 'wuthering-waves');
  await waitFor(`document.querySelector('.game-selector-trigger')?.textContent.includes('鸣潮')`, 'switched back to Wuwa');
  await clickText('直接启动');
  await waitFor(`!document.querySelector('[aria-label="直接启动"]').disabled`, 'Wuwa launch completed');
  assert.deepEqual(launchRequests.at(-1).args, ['--nogui', '--xxmi', 'WWMI']);
  const requestCount = launchRequests.length;
  assert.equal((await handlers.get('launch-game')({}, { launchMode: 'DIRECT', gameId: 'endfield' })).success, false);
  assert.equal(launchRequests.length, requestCount);
  passed('Direct launch follows the active game; stale game launch requests are rejected');
  launchFailure = true;
  await clickText('XXMI 启动');
  await waitFor(`document.querySelector('.launch-error')?.innerText.includes('用户取消管理员授权')`, 'launch failure shown');
  assert.equal(await evaluate(`document.querySelector('[aria-label="直接启动"]').disabled`), false);
  passed('Launch errors are visible and both buttons become usable after cancellation');
  await evaluate(`Array.from(document.querySelectorAll('.nav-item')).find(item => item.textContent.includes('MOD下载')).click()`);
  await waitFor(`document.querySelector('.mod-download-source-name')?.textContent === 'QAQM'`, 'default download source is QAQM');
  await evaluate(`document.querySelector('.mod-download-source-trigger').click()`);
  await waitFor(`document.querySelectorAll('.mod-download-source-option').length === 3`, 'download source menu');
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('.mod-download-source-option')].map(el => el.dataset.source)`), ['qaqm', 'kemono', 'pawchive']);
  assert.equal(await evaluate(`!!document.querySelector('.mod-market-header .btn-publish, .mod-market-header .btn-download-orb')`), false);
  await evaluate(`document.querySelector('.mod-download-source-option[data-source="pawchive"]').click()`);
  await waitFor(`!!document.querySelector('.paw-fixed-tabs')`, 'Pawchive tabs');
  assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('.paw-fixed-tabs button')).map(button => button.textContent)`), ['有更新 0', '我的收藏 0', '作者', '最新内容']);
  assert.equal(await evaluate(`document.querySelector('.paw-fixed-tabs [aria-selected="true"]').textContent`), '有更新 0');
  await clickText('最新内容');
  await waitFor(`document.querySelectorAll('.paw-post-card').length === 50`, 'Pawchive recent posts');
  await evaluate(`document.querySelector('.paw-post-card .paw-post-stats').click()`);
  await waitFor(`!!document.querySelector('.paw-modal')`, 'whole post card opens detail');
  await evaluate(`document.querySelector('[aria-label="关闭内容详情"]').click()`);
  assert.equal(await evaluate(`document.querySelector('.pawchive-view').scrollWidth > document.querySelector('.pawchive-view').clientWidth + 1`), false);
  await clickText('下一页 →');
  await waitFor(`document.querySelectorAll('.paw-post-card').length === 1 && document.querySelector('.paw-post-title').textContent === '历史模组 50'`, 'Pawchive post pagination');
  await clickText('作者');
  await waitFor(`document.querySelectorAll('.paw-creator-card').length === 24`, 'Pawchive authors');
  await captureUI('pawchive-authors.png');
  await evaluate(`document.querySelector('.paw-creator-card[data-author-id="123"] .paw-favorite').click()`);
  await waitFor(`document.querySelector('.paw-creator-card[data-author-id="123"] .paw-favorite')?.textContent.includes('已收藏')`, 'author favorite saved');
  const savedFavorite = JSON.parse(fs.readFileSync(path.join(profile, 'pawchive-favorites.json')));
  assert.equal(await evaluate(`document.querySelectorAll('.paw-author-tab').length`), 0, 'favorite must not trigger the card action');
  await evaluate(`document.querySelector('.paw-creator-card[data-author-id="123"][data-author-service="patreon"] .paw-creator-stats').click()`);
  await waitFor(`document.querySelectorAll('.paw-author-tab').length === 1 && document.querySelectorAll('.paw-post-card').length === 50`, 'whole author card opens its own tab');
  await clickText('下一页 →');
  await waitFor(`document.querySelectorAll('.paw-post-card').length === 1`, 'author page two');
  await evaluate(`(() => { const input = document.querySelector('.paw-search input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'saved draft'); input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  for (const [service, id] of [['fanbox', '123'], ['patreon', '200'], ['fanbox', '201'], ['patreon', '202'], ['fanbox', '203']]) {
    await clickText('作者');
    await waitFor(`document.querySelectorAll('.paw-creator-card').length === 24`, 'author list restored');
    await evaluate(`document.querySelector('.paw-creator-card[data-author-id="${id}"][data-author-service="${service}"]').click()`);
    await waitFor(`document.querySelectorAll('.paw-post-card').length === 50`, 'another author content');
  }
  assert.equal(await evaluate(`document.querySelectorAll('.paw-author-tab').length`), 6);
  assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('.paw-author-tab .paw-service')).slice(0, 2).map(node => node.textContent)`), ['patreon', 'fanbox']);
  await clickText('作者'); await waitFor(`document.querySelectorAll('.paw-creator-card').length === 24`, 'author list');
  await evaluate(`document.querySelector('.paw-creator-card[data-author-id="123"][data-author-service="patreon"]').click()`);
  await waitFor(`document.querySelectorAll('.paw-post-card').length === 1`, 'existing author tab retains page');
  assert.equal(await evaluate(`document.querySelectorAll('.paw-author-tab').length`), 6, 'opening existing author activates instead of duplicating');
  assert.equal(await evaluate(`document.querySelector('.paw-search input').value`), 'saved draft');
  await captureUI('pawchive-author-tabs.png');
  await evaluate(`document.querySelectorAll('.paw-author-tab .paw-tab-close')[3].click()`);
  assert.equal(await evaluate(`document.querySelector('.paw-author-tab.active [role="tab"]').getAttribute('aria-label')`), '[patreon] Moonholder · 测试作者');
  await evaluate(`document.querySelector('.paw-author-tab.active .paw-tab-close').click()`);
  await waitFor(`document.querySelectorAll('.paw-author-tab').length === 4 && document.querySelectorAll('.paw-post-card').length === 50`, 'closing active author selects a remaining tab');
  await clickText('作者'); await waitFor(`document.querySelectorAll('.paw-creator-card').length === 24`, 'fixed author tab after multiple authors');
  assert.equal(savedFavorite.favorites[0].snapshot.length, 51);
  assert.equal(savedFavorite.favorites[0].changes.length, 0);
  pawPosts[50].edited = '2026-09-11T15:15:06';
  pawPosts[50].content = `<p>历史帖子更新了下载链接。</p><a href="${pawMegaFolder}">MEGA 文件夹</a><script>window.pawXss=true</script>`;
  pawPosts.unshift({ ...pawPosts[0], id: 'new-post', title: '新发布的模组', published: '2026-09-12T00:00:00' });
  await clickText('↻ 检查更新');
  await waitFor(`document.querySelector('.paw-summary')?.textContent.includes('2 条未读更新')`, 'new and edited post detection');
  await clickText('有更新 2');
  await waitFor(`document.querySelectorAll('.paw-post-card').length === 2`, 'updates feed');
  assert.equal(await evaluate(`document.querySelectorAll('.paw-change-kind.new').length`), 1);
  assert.equal(await evaluate(`document.querySelectorAll('.paw-change-kind.edited').length`), 1);
  await captureUI('pawchive-updates.png');
  await evaluate(`Array.from(document.querySelectorAll('.paw-post-card')).find(card => card.querySelector('.paw-post-title').textContent === '历史模组 50').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))`);
  await waitFor(`!!document.querySelector('.paw-download-button')`, 'MEGA folder link recognized in detail');
  assert.equal(await evaluate(`window.pawXss === true`), false);
  assert.ok(await evaluate(`document.querySelector('.paw-post-meta').textContent.includes('Published:') && document.querySelector('.paw-post-meta').textContent.includes('Edited:')`));
  await captureUI('pawchive-post.png');
  await clickText('↓ 下载');
  await waitFor(`document.querySelector('.paw-mega-download')?.textContent.includes('已添加 1 个下载任务')`, 'source worker queue feedback');
  assert.deepEqual(revivalRequests[0].args, []);
  assert.equal(revivalRequests[0].url, pawMegaFolder);
  assert.equal(revivalRequests[0].options.shell, false);
  assert.ok(revivalRequests[0].file.endsWith('resources\\mega-worker\\QAQMMegaWorker.exe'));
  await waitFor(`document.querySelector('.qaqm-download-item')?.textContent.includes('20%')`, 'MEGA progress in built-in manager');
  assert.equal(await evaluate(`Array.from(document.querySelectorAll('.qaqm-download-task-actions button')).some(button => button.textContent === '导入 Mod')`), false);
  assert.equal(await evaluate(`document.querySelectorAll('.qaqm-download-orb').length`), 0);
  assert.ok(await evaluate(`!!document.querySelector('.sidebar-header .sidebar-download-button')`));
  await clickText('暂停'); await waitFor(`document.querySelector('.qaqm-download-item')?.textContent.includes('已暂停')`, 'MEGA pause');
  await clickText('继续'); await waitFor(`document.querySelector('.qaqm-download-item')?.textContent.includes('40%')`, 'MEGA resume');
  await evaluate(`document.querySelector('[aria-label="关闭内容详情"]').click()`);
  await captureUI('download-manager-expanded.png');
  await evaluate(`document.querySelector('.qaqm-download-panel-head [aria-label="关闭"]').click()`);
  await evaluate(`document.querySelector('.sidebar-toggle').click()`);
  await waitFor(`!!document.querySelector('.sidebar.collapsed > .sidebar-download-button')`, 'collapsed sidebar download button');
  await evaluate(`document.querySelector('.sidebar-download-button').click()`);
  await waitFor(`!!document.querySelector('.qaqm-download-panel')`, 'collapsed download manager opens');
  await captureUI('download-manager-collapsed.png');
  const downloadedArchive = path.join(revivalRequests[0].directory, 'SubA', '测试模组.zip');
  fs.mkdirSync(path.dirname(downloadedArchive), { recursive: true });
  const zip = new (runtimeRequire('adm-zip'))(); zip.addFile('mod.ini', Buffer.from('[TextureOverrideTest]\nhash = 12345678\n')); zip.writeZip(downloadedArchive);
  const downloadedHash = crypto.createHash('sha256').update(fs.readFileSync(downloadedArchive)).digest('hex');
  const modsBeforeImport = snapshot(mods);
  revivalChildren[0].progress({ status: 'completed', percent: 100, downloaded: 5242880, filesCompleted: 2 }); revivalChildren[0].kill();
  await waitFor(`document.querySelector('.qaqm-download-item')?.textContent.includes('已完成')`, 'completion in common manager');
  await clickText('导入 Mod');
  await waitFor(`!!document.querySelector('.batch-import-overlay')`, 'download task opens existing import review');
  const importPreview = await evaluate(`({ text: document.querySelector('.batch-import-overlay').textContent, type: document.querySelector('.batch-import-item-type')?.textContent.trim().toUpperCase() })`);
  assert.match(importPreview.text, /测试模组/);
  assert.equal(importPreview.type, 'ZIP');
  await captureUI('download-import-review.png');
  assert.equal(snapshot(mods), modsBeforeImport, 'preparing import does not alter Mods');
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(downloadedArchive)).digest('hex'), downloadedHash);
  await evaluate(`Array.from(document.querySelectorAll('.batch-import-overlay button')).find(button => button.textContent.trim() === '取消').click()`);
  await waitFor(`!document.querySelector('.batch-import-overlay')`, 'cancel import review');
  assert.equal(snapshot(mods), modsBeforeImport);
  await evaluate(`Array.from(document.querySelectorAll('.nav-item')).find(item => item.dataset.sortId === 'modmarket').click()`);
  await waitFor(`!!document.querySelector('.paw-post-card:has(.paw-change-kind.edited)')`, 'return to updates after import');
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
  await evaluate(`document.querySelector('.sidebar-header').click()`);
  await waitFor(`!document.querySelector('.sidebar.collapsed')`, 'sidebar restored');
  await evaluate(`document.querySelector('.paw-post-card:has(.paw-change-kind.edited) .paw-read-button').click()`);
  await waitFor(`document.querySelector('.paw-summary')?.textContent.includes('1 条未读更新')`, 'mark a single revision read');
  await clickText('↻ 检查更新');
  await waitFor(`!Array.from(document.querySelectorAll('button')).some(button => button.textContent === '正在检查…')`, 'repeat check finished');
  assert.ok(await evaluate(`document.querySelector('.paw-summary').textContent.includes('1 条未读更新')`));
  pawOffline = true;
  await clickText('↻ 检查更新');
  await waitFor(`document.querySelector('.paw-alert')?.textContent.includes('失败作者的上次记录已保留')`, 'partial failure remains visible');
  assert.equal((await handlers.get('pawchive:get-state')({})).postUpdateCount, 1);
  pawOffline = false;
  await evaluate(`Array.from(document.querySelectorAll('.nav-item')).find(item => item.textContent.includes('角色一览')).click()`);
  await evaluate(`Array.from(document.querySelectorAll('.nav-item')).find(item => item.textContent.includes('MOD下载')).click()`);
  assert.ok(await evaluate(`document.querySelector('.paw-summary').textContent.includes('1 条未读更新')`));
  passed('Pawchive real IPC/React: pagination, persistent favorites, old-page Edited changes, new IDs, unread state, failure reporting and sanitized detail');
  passed('MEGA folder becomes a source-worker task in the built-in manager; progress, pause, resume, completion and expanded/collapsed sidebar entry work');
  passed('Pawchive fixed tab order, multiple author tabs, same-author deduplication, per-tab page/draft state, card click/keyboard and import-from-download review');
  await require('./mod-download-smoke.cjs')({ evaluate, waitFor, captureUI, window, passed, setDelayedPost: value => { delayedPost = value; } });
  await evaluate(`Array.from(document.querySelectorAll('.nav-item')).find(item => item.textContent.includes('角色一览')).click()`);
  await waitFor(`document.querySelectorAll('.character-card').length > 0`, 'return to characters');
  launchFailure = false;
  const beforeModFixer = snapshot(mods);
  await evaluate(`Array.from(document.querySelectorAll('.character-card')).find(x => (x.getAttribute('aria-label') || x.innerText).includes('安可')).click()`);
  await waitFor(`!!document.querySelector('[data-mod-name]')`, 'Mod view loaded');
  await evaluate(`document.querySelector('[data-mod-name]').click()`);
  await clickText('🔧 修复器');
  await waitFor(`document.body.innerText.includes('独立修复器已打开')`, 'Mod detail fixer opened');
  assert.equal(launchRequests.at(-1).file, replacementFixerExe);
  await evaluate(`document.querySelector('[data-mod-name]').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 450, clientY: 320 }))`);
  await waitFor(`!!document.querySelector('.mod-context-menu')`, 'Mod context menu');
  assert.equal(await evaluate(`Array.from(document.querySelectorAll('.mod-context-menu button')).filter(b => b.textContent.trim() === '🔧 修复器').length`), 1);
  assert.equal(await evaluate(`document.body.innerText.includes('内置修复')`), false);
  await evaluate(`Array.from(document.querySelectorAll('.mod-context-menu button')).find(b => b.textContent.trim() === '🔧 修复器').click()`);
  await waitFor(`!document.querySelector('.mod-context-menu')`, 'Mod context fixer opened');
  assert.equal(launchRequests.at(-1).file, replacementFixerExe);
  assert.equal(fixerSelections.length, 4);
  assert.equal(snapshot(mods), beforeModFixer);
  passed('Mod detail and context actions open the saved standalone fixer without a second picker or Mod writes');
  await require('./sortable-order-smoke.cjs')({ evaluate, waitFor, captureUI, window, passed });
  assert.equal(app.getVersion(), require('../app/package.json').version);
  assert.equal(app.getName(), 'QAQ-Revival');
  assert.equal(window.getTitle(), 'QAQ-Revival');
  assert.equal(await evaluate('document.title'), 'QAQ-Revival');
  assert.equal(await evaluate(`document.querySelector('.sidebar .logo')?.textContent.trim()`), 'QAQR');
  assert.equal([...handlers.keys()].some(name => name.startsWith('updater:') || ['check-for-updates', 'download-update'].includes(name)), false);
  assert.equal(await evaluate(`Object.keys(window.api).some(key => /^updater/.test(key) || ['checkForUpdates', 'downloadUpdate', 'onUpdateAvailable', 'onUpdateDownloaded'].includes(key))`), false);
  await require('./settings-smoke.cjs')({ evaluate, waitFor, captureUI, window, passed, handlers, root, setSelection: result => { nextFixerSelection = result; } });
  await waitFor(`document.querySelector('.settings-view')?.textContent.includes('QAQ-Revival')`, 'release about section');
  assert.equal(await evaluate(`document.querySelector('.settings-view').textContent.includes('软件更新')`), false);
  await captureUI('revival-settings.png');
  passed('Release identity, manifest version, window title, removed software updater IPC/API and settings verified');
  await window.loadFile(path.join(process.resourcesPath, 'app/out/renderer/index.html'));
  await waitFor(`!!document.querySelector('.batch-import-trigger-btn')`, 'import regression starts on character list');
  const [surfaceWidth, surfaceHeight] = window.getSize();
  window.setSize(surfaceWidth + 1, surfaceHeight);
  window.setSize(surfaceWidth, surfaceHeight);
  await require('./import-group-smoke.cjs')({ evaluate, waitFor, captureUI, root, passed, setSelection: result => { nextFixerSelection = result; } });
  await require('./post-links-smoke.cjs')({ evaluate, waitFor, captureUI, window, root, passed, handlers, attachmentRequests, attachmentBytes, externalLinks, protectedLink, protectedNormal, revivalChildren, setSelection: result => { nextFixerSelection = result; } });
  await require('./software-updates-smoke.cjs')({ evaluate, waitFor, window, passed, requests: softwareUpdateRequests, externalLinks, setRelease: version => { softwareReleaseVersion = version; } });
  fs.writeFileSync(path.join(root, 'report.json'), JSON.stringify({ success: true, electron: process.versions.electron, checks }, null, 2));
  app.exit(0);
}
main().catch(async error => {
  fs.writeFileSync(path.join(root, 'report.json'), JSON.stringify({ success: false, checks, error: error.stack }, null, 2));
  try {
    if (window) await Promise.race([
      window.webContents.capturePage().then(image => fs.writeFileSync(path.join(root, 'failure.png'), image.toPNG())),
      delay(2000)
    ]);
  } catch {}
  app.exit(1);
});
