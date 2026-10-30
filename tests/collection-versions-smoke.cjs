const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

module.exports = async ({ electron, evaluate, waitFor, captureUI, window, mods, passed }) => {
  const first = '夜莺皮肤动态 - 穿衣 (部分资源) (PC) [52d594e3]';
  const second = '夜莺皮肤动态 - 清凉 (部分资源) (PC) [c4e922d7]';
  const row = name => `[data-mod-name=${JSON.stringify(name)}]`;
  const item = name => `.mod-gallery-item[data-mod=${JSON.stringify(name)}], .mod-item[data-mod=${JSON.stringify(name)}]`;
  for (const [name, enabled, key, pixel] of [[first, true, 'K', 80], [second, false, 'L', 180]]) {
    const folder = path.join(mods, '安可', (enabled ? '' : 'DISABLED_') + name);
    fs.mkdirSync(folder);
    fs.writeFileSync(path.join(folder, 'mod.ini'), `[KeyVersion]\nkey = ${key}\ntype = cycle\n$version = 0,1\n`);
    fs.writeFileSync(path.join(folder, 'preview.png'), electron.nativeImage.createFromBitmap(Buffer.alloc(16, pixel), { width: 2, height: 2 }).toPNG());
  }
  // Reopen with a saved old selection so a refresh can reproduce snapping back.
  await evaluate(`document.querySelector('.mod-view-back-btn').click()`);
  await waitFor(`!!document.querySelector('.character-card[aria-label^="安可，"]')`, 'version fixture character');
  await evaluate(`localStorage.setItem('modview-state-wuthering-waves-安可', JSON.stringify({selectedModName:${JSON.stringify(first)}})); document.querySelector('.character-card[aria-label^="安可，"]').closest('.character-card').click()`);
  await waitFor(`!!document.querySelector(${JSON.stringify(row(first) + ' .local-collection-gallery-trigger')})`, 'ungrouped list version menu');
  await evaluate(`document.querySelector(${JSON.stringify(row(first) + ' .local-collection-gallery-trigger')}).click()`);
  assert.equal(await evaluate(`document.querySelectorAll('.local-collection-gallery-menu').length`), 1);
  await evaluate(`[...document.querySelectorAll('.local-collection-gallery-option')].find(button => button.title === ${JSON.stringify(second)}).click()`);
  await waitFor(`document.querySelector('.mod-row.selected')?.dataset.modName === ${JSON.stringify(second)}`, 'list selects the other version');
  window.webContents.send('mods-changed', { characterName: '安可', reason: 'test-refresh' });
  await new Promise(resolve => setTimeout(resolve, 350));
  await waitFor(`!document.querySelector('.mod-library-panel[aria-busy="true"]') && document.querySelector('.mod-row.selected')?.dataset.modName === ${JSON.stringify(second)}`, 'refresh preserves the selected version');
  assert.equal(await evaluate(`document.querySelector('.mod-detail-heading').textContent.includes(${JSON.stringify(second)})`), true);
  await waitFor(`document.querySelector('.mod-detail-preview img')?.src.includes('c4e922d7')`, 'selected version preview');
  window.webContents.startPainting();
  window.webContents.invalidate();
  await new Promise(resolve => setTimeout(resolve, 200));
  await captureUI('collection-list-versions.png');
  await evaluate(`document.querySelector('.local-collection-toggle').click(); document.querySelector('.view-mode-toggle').click()`);
  await waitFor(`!!document.querySelector(${JSON.stringify('.mod-gallery-card' + row(second))})`, 'grouped gallery keeps selected version');
  assert(fs.existsSync(path.join(mods, '安可', first)) && fs.existsSync(path.join(mods, '安可', 'DISABLED_' + second)), 'Choosing a version preserves its enable state');

  const overlay = new electron.BrowserWindow({ width: 480, height: 760, show: false, webPreferences: { preload: path.join(process.resourcesPath, 'app/out/preload/overlay.js'), sandbox: false, contextIsolation: true, offscreen: true } });
  const run = code => overlay.webContents.executeJavaScript(code, true);
  // Strong compatibility mode renders inline version chips instead of a gallery dropdown.
  const openVersions = name => run(`document.querySelector(${JSON.stringify(item(name))})?.querySelector('[data-collection-trigger]')?.click()`);
  const versionOptions = '#overlayCollectionFloatingMenu [data-collection-option], .overlay-collection-chip';
  async function until(code, runInWindow = run) {
    for (let attempt = 0; attempt < 120; attempt++) { if (await runInWindow(code)) return; await new Promise(resolve => setTimeout(resolve, 50)); }
    throw Error('Version UI timeout: ' + code + '\n' + await runInWindow('document.body.innerText.slice(0, 1200)'));
  }
  try {
    await overlay.loadFile(path.join(process.resourcesPath, 'app/out/renderer/overlay/index.html'));
    await until(`!!document.querySelector('.char-chip[data-name="安可"]')`);
    await run(`document.querySelector('.char-chip[data-name="安可"]').click()`);
    await until(`!!document.querySelector(${JSON.stringify(item(second))})`);
    await run(`document.querySelector(${JSON.stringify(item(second))}).click()`);
    let side;
    for (let attempt = 0; attempt < 120; attempt++) {
      side = electron.BrowserWindow.getAllWindows().find(win => win.webContents.getURL().endsWith('/side-panel.html'));
      if (side && await side.webContents.executeJavaScript(`!!document.querySelector('[data-version-mod]')`)) break;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.ok(side);
    const runSide = code => side.webContents.executeJavaScript(code, true);
    await runSide(`[...document.querySelectorAll('[data-version-mod]')].find(button => button.dataset.versionMod === ${JSON.stringify(first)}).click()`);
    await until(`!!document.querySelector(${JSON.stringify(item(first))})`);
    await until(`document.querySelector('[data-version-mod].active')?.dataset.versionMod === ${JSON.stringify(first)} && document.querySelector('#detailToggleBtn')?.textContent.includes('禁用')`, runSide);
    await waitFor(`!!document.querySelector(${JSON.stringify('.mod-gallery-card' + row(first))})`, 'detail selection synchronizes with manager');
    await openVersions(first);
    await run(`[...document.querySelectorAll(${JSON.stringify(versionOptions)})].find(button => button.dataset.mod === ${JSON.stringify(second)}).click()`);
    await until(`!!document.querySelector(${JSON.stringify(item(second))})`);
    await until(`document.querySelector('[data-version-mod].active')?.dataset.versionMod === ${JSON.stringify(second)} && document.querySelector('#detailToggleBtn')?.textContent.includes('启用') && document.querySelector('.detail-hotkey-section')?.textContent.includes('L')`, runSide);
    assert.equal(await runSide(`document.querySelector('.detail-preview-img').src.includes('c4e922d7')`), true);
    overlay.webContents.send('mods-changed', { characterName: '安可', reason: 'mod-selection' });
    await new Promise(resolve => setTimeout(resolve, 350));
    await until(`!!document.querySelector(${JSON.stringify(item(second))})`);
    await openVersions(second);
    assert.equal(await run(`[...document.querySelectorAll(${JSON.stringify(versionOptions)})].find(button => button.classList.contains('active'))?.dataset.mod`), second);
    await waitFor(`!!document.querySelector(${JSON.stringify('.mod-gallery-card' + row(second))})`, 'gallery selection synchronizes with manager');
    await new Promise(resolve => setTimeout(resolve, 150));
    const root = process.env.QAQR_TEST_RESULTS;
    fs.writeFileSync(path.join(root, 'collection-overlay-versions.png'), (await overlay.webContents.capturePage()).toPNG());
    fs.writeFileSync(path.join(root, 'collection-detail-versions.png'), (await side.webContents.capturePage()).toPNG());
    await runSide(`window.overlayApi.updateSettings({autoReloadEnabled:false})`);
    await runSide(`document.querySelector('#detailToggleBtn').click()`);
    await until(`window.overlayApi.getMods('安可').then(result => result.mods.find(mod => mod.name === ${JSON.stringify(second)})?.enabled)`);
    assert(fs.existsSync(path.join(mods, '安可', second)) && fs.existsSync(path.join(mods, '安可', first)), 'The detail action targets the selected version and preserves multi-select');
    side.hide();
    passed('Collection versions switch in ungrouped lists, galleries and floating details; selections survive refresh and synchronize previews, names, hotkeys and enable controls');
  } finally { overlay.destroy(); }
};
