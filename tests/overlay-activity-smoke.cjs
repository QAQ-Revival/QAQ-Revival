const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

module.exports = async ({ electron, root, mods, handlers, passed }) => {
  const gameRoot = path.dirname(mods);
  fs.writeFileSync(path.join(gameRoot, 'd3dx.ini'), '[Include]\ninclude_recursive = wuwa-mods\n[System]\nsettings_auto_save_interval = 60\n');
  fs.writeFileSync(path.join(gameRoot, 'd3d11.dll'), Buffer.from('Local\\QAQR.Activity.v1.%u', 'utf16le'));
  const ini = '[Constants]\nglobal $object_detected = 0\n[Present]\npost $object_detected = 0\n[TextureOverrideBody]\nhash = 12345678\n$object_detected = 1\n[KeyColor]\nkey = K\ntype = cycle\n';
  const file = path.join(mods, '安可', '活动模组', 'mod.ini');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, 'namespace = ActivityTestA\n' + ini);
  const secondFile = path.join(mods, '洛瑟菈', '活动模组B', 'mod.ini');
  fs.mkdirSync(path.dirname(secondFile), { recursive: true });
  fs.writeFileSync(secondFile, 'namespace = ActivityTestB\n' + ini);
  const originalShowSide = handlers.get('overlay-show-side');
  let showRequests = 0;
  let lastSideRequest;
  electron.ipcMain.removeHandler('overlay-show-side');
  electron.ipcMain.handle('overlay-show-side', (...args) => {
    showRequests++;
    lastSideRequest = args[1]?.content;
    return originalShowSide(...args);
  });
  const overlay = new electron.BrowserWindow({ show: false, width: 620, height: 900, webPreferences: {
    preload: path.join(process.resourcesPath, 'app/out/preload/overlay.js'), sandbox: false, contextIsolation: true, offscreen: true
  } });
  const evaluate = script => overlay.webContents.executeJavaScript(script, true);
  const wait = async (script, label = script) => {
    const start = Date.now();
    while (Date.now() - start < 12000) {
      if (await evaluate(script)) return;
      await new Promise(resolve => setTimeout(resolve, 75));
    }
    throw Error('Timed out: ' + label + '\n' + JSON.stringify(await evaluate("({ status: document.querySelector('#activityStatus')?.textContent, selected: document.querySelector('.char-chip.active')?.dataset.name, rows: [...document.querySelectorAll('.mod-item, .mod-gallery-item')].map(el => [el.className, el.dataset.mod]) })")));
  };
  let channel;
  try {
    await overlay.loadFile(path.join(process.resourcesPath, 'app/out/renderer/overlay/index.html'));
    // A hidden transparent Electron window may still report a visible document.
    // Detection must stay passive even in that case.
    await evaluate("Object.defineProperty(document, 'hidden', { get: () => false }); true");
    await wait("document.querySelectorAll('.char-chip').length > 0");
    await evaluate(`document.querySelector('.char-chip[data-name="洛瑟菈"]').click()`);
    await wait(`document.querySelector('.char-chip.active')?.dataset.name === '洛瑟菈'`);
    const metadata = JSON.parse(fs.readFileSync(path.join(gameRoot, 'qaqm/qaqm_activity.json')));
    channel = require('./activity-channel-fixture.cjs')(metadata.token, 2);
    const snapshot = (tick, active = 1, second = 0) => channel.write(tick, [active, second]);
    snapshot(1);
    await new Promise(resolve => setTimeout(resolve, 1200));
    assert.equal(await evaluate("document.querySelectorAll('.char-chip-live').length"), 0, 'one old snapshot is not a live signal');
    snapshot(2);
    await wait("document.querySelectorAll('.char-chip-live').length === 1");
    assert.equal(showRequests, 0, 'detecting a loaded Mod must not open a menu');
    assert.equal(await evaluate("document.querySelector('.char-chip.active')?.dataset.name"), '洛瑟菈', 'polling does not change the selected character');
    overlay.webContents.send('overlay-window-shown');
    await wait("document.querySelector('.char-chip.active')?.dataset.name === '安可' && document.querySelector('.mod-item.selected, .mod-gallery-item.selected')?.dataset.mod === '活动模组'", 'active character and settings selected');
    assert.equal(showRequests, 1, 'opening the overlay locates the active Mod and opens its menu once');
    assert.equal(await evaluate("document.querySelector('.char-chip').dataset.name"), '安可');
    let side;
    for (let i = 0; i < 40; i++) {
      side = electron.BrowserWindow.getAllWindows().find(w => w.webContents.getURL().endsWith('/side-panel.html'));
      if (side) break;
      await new Promise(resolve => setTimeout(resolve, 75));
    }
    assert.ok(side, 'active Mod opens the real settings side panel');
    for (let i = 0; i < 40 && !await side.webContents.executeJavaScript("!!document.querySelector('.detail-hotkey-row')"); i++) await new Promise(resolve => setTimeout(resolve, 75));
    assert.match(await side.webContents.executeJavaScript('document.body.innerText'), /K/);
    snapshot(3, 0, 1);
    await wait(`!!document.querySelector('.char-chip[data-name="洛瑟菈"] .char-chip-live')`);
    assert.equal(await evaluate("document.querySelector('.char-chip.active')?.dataset.name"), '安可', 'changing loaded characters while open does not navigate');
    assert.equal(showRequests, 1, 'changing loaded characters does not replace the open menu');
    overlay.webContents.send('overlay-window-hidden');
    await handlers.get('overlay-hide-side')({});
    snapshot(4);
    await wait(`!!document.querySelector('.char-chip[data-name="安可"] .char-chip-live')`);
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
    // Stop advancing the memory clock, as happens when the game exits.
    await wait("document.querySelectorAll('.char-chip-live').length === 0", 'expired snapshot is cleared');
    assert.equal(await evaluate("document.querySelector('.char-chip.active').dataset.name"), '安可', 'missing telemetry does not jump to another character');
    // Reproduce manual menu A -> game -> reopen while B's first sample is late.
    if (await evaluate(`!!document.querySelector('.mod-item.selected[data-mod="活动模组"], .mod-gallery-item.selected[data-mod="活动模组"]')`)) {
      await evaluate(`document.querySelector('.mod-item.selected, .mod-gallery-item.selected').click()`);
      await wait(`!document.querySelector('.mod-item.selected, .mod-gallery-item.selected')`);
    }
    const beforeManualOpen = showRequests;
    await evaluate(`document.querySelector('.mod-item[data-mod="活动模组"], .mod-gallery-item[data-mod="活动模组"]').click()`);
    await wait(`!!document.querySelector('.mod-item.selected, .mod-gallery-item.selected')`);
    for (let i = 0; i < 40 && showRequests === beforeManualOpen; i++) await new Promise(resolve => setTimeout(resolve, 50));
    const oldKey = lastSideRequest.requestKey;
    overlay.webContents.send('overlay-window-hidden');
    await handlers.get('overlay-hide-side')({});
    overlay.webContents.send('overlay-window-shown');
    const delayedSample = setTimeout(() => snapshot(7, 0, 1), 700);
    try {
      await wait("document.querySelector('.char-chip.active')?.dataset.name === '洛瑟菈' && document.querySelector('.mod-item.selected, .mod-gallery-item.selected')?.dataset.mod === '活动模组B'", 'late activity locates B after a manual A menu');
    } finally { clearTimeout(delayedSample); }
    for (let i = 0; i < 40 && await side.webContents.executeJavaScript("document.querySelector('#sideTitle')?.textContent") !== '活动模组B'; i++) await new Promise(resolve => setTimeout(resolve, 50));
    const stale = await handlers.get('overlay-update-side')({}, { type: 'detail', requestKey: oldKey, title: 'stale A', html: 'stale A' });
    assert.equal(stale.cancelled, true);
    assert.equal(await side.webContents.executeJavaScript("document.querySelector('#sideTitle').textContent"), '活动模组B');
    await evaluate("document.querySelector('#autoLocateToggle').click()");
    await wait("!document.querySelector('#autoLocateToggle').checked && !document.querySelector('#autoLocateToggle').disabled");
    assert.equal((await handlers.get('overlay-get-settings')({})).settings.autoLocateEnabled, false);
    overlay.webContents.send('overlay-window-hidden');
    await handlers.get('overlay-hide-side')({});
    snapshot(8);
    const disabledRequests = showRequests;
    overlay.webContents.send('overlay-window-shown');
    await new Promise(resolve => setTimeout(resolve, 1000));
    assert.equal(showRequests, disabledRequests, 'disabled auto-location never opens another menu');
    assert.equal(await evaluate("document.querySelector('.char-chip.active')?.dataset.name"), '洛瑟菈');
    await evaluate(`document.querySelector('.mod-item[data-mod="活动模组B"], .mod-gallery-item[data-mod="活动模组B"]').click()`);
    for (let i = 0; i < 40 && showRequests === disabledRequests; i++) await new Promise(resolve => setTimeout(resolve, 50));
    assert.equal(showRequests, disabledRequests + 1, 'a manual click can reopen the previously closed menu');
    passed('Visible auto-location switch persists; a delayed current-Mod sample replaces the previous session selection, and stale menu updates cannot replace the current shortcuts.');
    assert.equal(fs.readFileSync(file, 'utf8'), 'namespace = ActivityTestA\n' + ini);
    await evaluate("document.querySelector('#settingsBtn').click()");
    await wait("document.querySelector('#settingsPanel').classList.contains('visible')");
    await wait("Number(getComputedStyle(document.querySelector('#settingsPanel')).opacity) === 1", 'settings transition finished');
    fs.writeFileSync(path.join(root, 'overlay-activity-settings.png'), (await overlay.webContents.capturePage()).toPNG());
    await handlers.get('overlay-update-settings')({}, { activityEnabled: false });
    assert.match(fs.readFileSync(path.join(gameRoot, 'd3dx.ini'), 'utf8'), /settings_auto_save_interval = 60/);
    passed('Activity polling never opens or replaces a menu; explicit overlay opening locates and expands the current Mod, including reopening unchanged activity. Manual browsing, expiry and disabled restoration verified.');
  } finally {
    channel?.close();
    overlay.destroy();
    electron.ipcMain.removeHandler('overlay-show-side');
    electron.ipcMain.handle('overlay-show-side', originalShowSide);
  }
};
