const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

module.exports = async ({ electron, root, mods, handlers, passed }) => {
  const gameRoot = path.dirname(mods);
  fs.writeFileSync(path.join(gameRoot, 'd3dx.ini'), '[Include]\ninclude_recursive = wuwa-mods\n[System]\nsettings_auto_save_interval = 60\n');
  const ini = '[Constants]\nglobal $object_detected = 0\n[Present]\npost $object_detected = 0\n[TextureOverrideBody]\nhash = 12345678\n$object_detected = 1\n[KeyColor]\nkey = K\ntype = cycle\n';
  const file = path.join(mods, '安可', '活动模组', 'mod.ini');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, 'namespace = ActivityTestA\n' + ini);
  const secondFile = path.join(mods, '洛瑟菈', '活动模组B', 'mod.ini');
  fs.mkdirSync(path.dirname(secondFile), { recursive: true });
  fs.writeFileSync(secondFile, 'namespace = ActivityTestB\n' + ini);
  const originalShowSide = handlers.get('overlay-show-side');
  let showRequests = 0;
  electron.ipcMain.removeHandler('overlay-show-side');
  electron.ipcMain.handle('overlay-show-side', (...args) => {
    showRequests++;
    return originalShowSide(...args);
  });
  const overlay = new electron.BrowserWindow({ show: false, width: 620, height: 900, webPreferences: {
    preload: path.join(process.resourcesPath, 'overlay-preload.js'), sandbox: false, contextIsolation: true, offscreen: true
  } });
  const evaluate = script => overlay.webContents.executeJavaScript(script, true);
  const wait = async (script, label = script) => {
    const start = Date.now();
    while (Date.now() - start < 12000) {
      if (await evaluate(script)) return;
      await new Promise(resolve => setTimeout(resolve, 75));
    }
    throw Error('Timed out: ' + label + '\n' + JSON.stringify(await evaluate("({ status: document.querySelector('#activityStatus')?.textContent, selected: document.querySelector('.char-chip.active')?.dataset.name, rows: [...document.querySelectorAll('.mod-item, .mod-gallery-item')].map(el => [el.className, el.dataset.mod]), gameId: charactersGameId, activity: activityMods, settings: overlaySettings })")));
  };
  try {
    await overlay.loadFile(path.join(process.resourcesPath, 'overlay.html'));
    // A hidden transparent Electron window may still report a visible document.
    // Detection must stay passive even in that case.
    await evaluate("Object.defineProperty(document, 'hidden', { get: () => false }); true");
    await wait("document.querySelectorAll('.char-chip').length > 0");
    await evaluate("selectChar('洛瑟菈')");
    const metadata = JSON.parse(fs.readFileSync(path.join(gameRoot, 'qaqm/qaqm_activity.json')));
    const snapshot = (tick, active = 1, second = 0) => fs.writeFileSync(path.join(gameRoot, 'd3dx_user.ini'),
      `[Constants]\n$\\QAQM\\Activity\\token = ${metadata.token}\n$\\QAQM\\Activity\\tick = ${tick}\n$\\QAQM\\Activity\\m0 = ${active}\n$\\QAQM\\Activity\\m1 = ${second}\n`);
    snapshot(1);
    await new Promise(resolve => setTimeout(resolve, 1200));
    assert.equal(await evaluate("document.querySelectorAll('.char-chip-live').length"), 0, 'one old snapshot is not a live signal');
    snapshot(2);
    await wait("document.querySelectorAll('.char-chip-live').length === 1");
    assert.equal(showRequests, 0, 'detecting a loaded Mod must not open a menu');
    assert.equal(await evaluate("selectedChar"), '洛瑟菈', 'polling does not change the selected character');
    overlay.webContents.send('overlay-window-shown');
    await wait("document.querySelector('.char-chip.active')?.dataset.name === '安可' && document.querySelector('.mod-item.selected, .mod-gallery-item.selected')?.dataset.mod === '活动模组'", 'active character and settings selected');
    assert.equal(showRequests, 1, 'opening the overlay locates the active Mod and opens its menu once');
    assert.equal(await evaluate("document.querySelector('.char-chip').dataset.name"), '安可');
    const side = electron.BrowserWindow.getAllWindows().find(w => w.webContents.getURL().endsWith('/side-panel.html'));
    assert.ok(side, 'active Mod opens the real settings side panel');
    for (let i = 0; i < 40 && !await side.webContents.executeJavaScript("!!document.querySelector('.detail-hotkey-row')"); i++) await new Promise(resolve => setTimeout(resolve, 75));
    assert.match(await side.webContents.executeJavaScript('document.body.innerText'), /K/);
    snapshot(3, 0, 1);
    await wait("isActiveCharacter('洛瑟菈')");
    assert.equal(await evaluate("selectedChar"), '安可', 'changing loaded characters while open does not navigate');
    assert.equal(showRequests, 1, 'changing loaded characters does not replace the open menu');
    overlay.webContents.send('overlay-window-hidden');
    await handlers.get('overlay-hide-side')({});
    snapshot(4);
    await wait("isActiveCharacter('安可')");
    assert.equal(showRequests, 1, 'loading another Mod while hidden does not reopen the menu');
    overlay.webContents.send('overlay-window-shown');
    for (let i = 0; i < 80 && showRequests < 2; i++) await new Promise(resolve => setTimeout(resolve, 50));
    await wait("document.querySelector('.mod-item.selected, .mod-gallery-item.selected')?.dataset.mod === '活动模组'");
    assert.equal(showRequests, 2, 'reopening expands the current Mod even when the detected state is unchanged');
    await evaluate("const chip = [...document.querySelectorAll('.char-chip')].find(c => c.dataset.name === '洛瑟菈'); chip.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); chip.click()");
    snapshot(5, 0);
    await wait("document.querySelectorAll('.char-chip-live').length === 0");
    snapshot(6);
    await wait("document.querySelectorAll('.char-chip-live').length === 1");
    assert.equal(await evaluate("document.querySelector('.char-chip.active').dataset.name"), '洛瑟菈', 'manual browsing is not interrupted');
    overlay.webContents.send('overlay-window-shown');
    await wait("document.querySelector('.char-chip.active')?.dataset.name === '安可'");
    fs.utimesSync(path.join(gameRoot, 'd3dx_user.ini'), new Date(0), new Date(0));
    await wait("document.querySelectorAll('.char-chip-live').length === 0", 'expired snapshot is cleared');
    assert.equal(await evaluate("document.querySelector('.char-chip.active').dataset.name"), '安可', 'missing telemetry does not jump to another character');
    // Reproduce manual menu A -> game -> reopen while B's first sample is late.
    await evaluate("openDetail('活动模组', { force: true })");
    const oldKey = await evaluate('detailSideKey');
    overlay.webContents.send('overlay-window-hidden');
    await handlers.get('overlay-hide-side')({});
    overlay.webContents.send('overlay-window-shown');
    const delayedSample = setTimeout(() => snapshot(7, 0, 1), 700);
    try {
      await wait("selectedChar === '洛瑟菈' && selectedModName === '活动模组B' && detailSideOpen", 'late activity locates B after a manual A menu');
    } finally { clearTimeout(delayedSample); }
    const stale = await handlers.get('overlay-update-side')({}, { type: 'detail', requestKey: oldKey, title: 'stale A', html: 'stale A' });
    assert.equal(stale.cancelled, true);
    assert.equal(await side.webContents.executeJavaScript("document.querySelector('#sideTitle').textContent"), '活动模组B');
    await evaluate("document.querySelector('#autoLocateToggle').click()");
    await wait("overlaySettings.autoLocateEnabled === false && !document.querySelector('#autoLocateToggle').disabled");
    assert.equal((await handlers.get('overlay-get-settings')({})).settings.autoLocateEnabled, false);
    overlay.webContents.send('overlay-window-hidden');
    await handlers.get('overlay-hide-side')({});
    snapshot(8);
    const disabledRequests = showRequests;
    overlay.webContents.send('overlay-window-shown');
    await new Promise(resolve => setTimeout(resolve, 1000));
    assert.equal(showRequests, disabledRequests, 'disabled auto-location never opens another menu');
    assert.equal(await evaluate('selectedChar'), '洛瑟菈');
    await evaluate("openDetail('活动模组B')");
    assert.equal(showRequests, disabledRequests + 1, 'a manual click can reopen the previously closed menu');
    passed('Visible auto-location switch persists; a delayed current-Mod sample replaces the previous session selection, and stale menu updates cannot replace the current shortcuts.');
    assert.equal(fs.readFileSync(file, 'utf8'), 'namespace = ActivityTestA\n' + ini);
    await evaluate("document.querySelector('#settingsBtn').click()");
    await wait("document.querySelector('#settingsPanel').classList.contains('visible')");
    await new Promise(resolve => setTimeout(resolve, 150));
    fs.writeFileSync(path.join(root, 'overlay-activity-settings.png'), (await overlay.webContents.capturePage()).toPNG());
    await handlers.get('overlay-update-settings')({}, { activityEnabled: false });
    assert.match(fs.readFileSync(path.join(gameRoot, 'd3dx.ini'), 'utf8'), /settings_auto_save_interval = 60/);
    passed('Activity polling never opens or replaces a menu; explicit overlay opening locates and expands the current Mod, including reopening unchanged activity. Manual browsing, expiry and disabled restoration verified.');
  } finally {
    overlay.destroy();
    electron.ipcMain.removeHandler('overlay-show-side');
    electron.ipcMain.handle('overlay-show-side', originalShowSide);
  }
};
