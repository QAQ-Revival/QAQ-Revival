const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

module.exports = async ({ electron, evaluate, waitFor, captureUI, handlers, root, passed, selectNativeAction }) => {
  const call = (name, ...args) => handlers.get(name)({}, ...args);
  const library = path.join(root, 'data/Arknights/Mods');
  const png = electron.nativeImage.createFromBitmap(Buffer.from([0x70, 0x90, 0xe0, 0xff]), { width: 1, height: 1 }).toPNG();
  const cover = Buffer.concat([png, Buffer.alloc(64 * 1024)]);
  for (let index = 0; index < 600; index++) {
    const char = path.join(library, `Perf${String(index).padStart(3, '0')}`);
    fs.mkdirSync(path.join(char, 'DISABLED_fixture'), { recursive: true });
    fs.writeFileSync(path.join(char, '_cover.png'), cover);
  }
  const large = path.join(library, 'Perf000/DISABLED_fixture');
  const resources = Array.from({ length: 1200 }, (_, i) => {
    const file = `char_1001_amiya2_2__page${i}.png`;
    fs.writeFileSync(path.join(large, file), png);
    return { file, target: file, bundle: 'arts/dynchars/char_1001_amiya2_2.ab' };
  });
  fs.writeFileSync(path.join(large, '.qaqr-resources.json'), JSON.stringify({ schemaVersion: 1, resources }));
  const started = performance.now();
  const list = await call('character:refresh');
  const refreshMs = Math.round(performance.now() - started);
  assert(list.characters.length > 1000);
  assert(Buffer.byteLength(JSON.stringify(list)) < 1024 * 1024, 'Covers stay out of the IPC payload');
  const row = list.characters.find(c => c.name === 'Perf000');
  assert.match(row.coverUrl, /^file:/);
  let beats = 0;
  const timer = setInterval(() => beats++, 5);
  const detailStart = performance.now();
  const details = await call('get-mods', 'Perf000');
  clearInterval(timer);
  assert.equal(details.success, true, details.error);
  assert.equal(details.mods[0].appearanceSectionId, 'base');
  assert(beats > 0);
  const detailMs = Math.round(performance.now() - detailStart);
  await evaluate(`window.dispatchEvent(new CustomEvent('qaqm-navigate', { detail: { tab: 'characters' } }))`);
  await waitFor(`!!document.querySelector('.mod-view-back-btn')`, 'return to Mod view');
  await evaluate(`document.querySelector('.mod-view-back-btn').click()`);
  await waitFor(`!!document.querySelector('.character-card[aria-label^="Perf000，"]')`, 'large character list');
  assert.equal(await evaluate(`new Promise(resolve => { const image = new Image(); image.onload = () => resolve(image.naturalWidth); image.onerror = () => resolve(0); image.src = ${JSON.stringify(row.coverUrl)}; })`), 1);
  let reads = 0;
  const original = handlers.get('get-characters');
  electron.ipcMain.removeHandler('get-characters');
  electron.ipcMain.handle('get-characters', async (...args) => {
    reads++;
    await new Promise(resolve => setTimeout(resolve, 120));
    return original(...args);
  });
  selectNativeAction('hide');
  await evaluate(`document.querySelector('.character-card[aria-label^="Perf000，"] .character-more-btn').click()`);
  await waitFor(`!document.querySelector('.character-card[aria-label^="Perf000，"]')`, 'hide responds in a large list');
  await new Promise(resolve => setTimeout(resolve, 500));
  assert(reads <= 2, `${reads} list reads for one hide`);
  await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('隐藏角色 (')).click()`);
  await waitFor(`!!document.querySelector('[aria-label="恢复显示 Perf000"]')`, 'hidden dialog');
  await evaluate(`document.querySelector('[aria-label="恢复显示 Perf000"]').click()`);
  await waitFor(`!!document.querySelector('.character-card[aria-label^="Perf000，"]')`, 'restored in large list');
  await evaluate(`document.querySelector('[aria-label="关闭隐藏角色"]').click()`);
  await captureUI('library-performance.png');
  electron.ipcMain.removeHandler('get-characters');
  electron.ipcMain.handle('get-characters', original);
  await evaluate(`document.querySelector('.character-card[aria-label^="Perf000，"]').click()`);
  await waitFor(`!!document.querySelector('[data-mod-name="fixture"]')`, 'large Mod detail rendered');
  let modReads = 0;
  const originalMods = handlers.get('get-mods');
  electron.ipcMain.removeHandler('get-mods');
  electron.ipcMain.handle('get-mods', async (...args) => {
    modReads++;
    await new Promise(resolve => setTimeout(resolve, 120));
    return originalMods(...args);
  });
  for (let index = 0; index < 100; index++) for (const window of electron.BrowserWindow.getAllWindows()) {
    window.webContents.send('mods-changed', { gameId: 'arknights', characterName: 'Perf000' });
  }
  await new Promise(resolve => setTimeout(resolve, 1200));
  assert(modReads > 0 && modReads <= 2, `${modReads} scans for a burst of 100 notifications`);
  electron.ipcMain.removeHandler('get-mods');
  electron.ipcMain.handle('get-mods', originalMods);
  const metrics = { characters: list.characters.length, refreshMs, detailMs, ipcBytes: Buffer.byteLength(JSON.stringify(list)), beats, hideListReads: reads, burstModReads: modReads };
  fs.writeFileSync(path.join(root, 'library-performance.json'), JSON.stringify(metrics, null, 2));
  passed(`Large library: ${metrics.characters} characters, ${refreshMs} ms refresh, ${detailMs} ms detail, ${metrics.ipcBytes} byte payload; hide/restore and local covers render correctly`);

  // NPC resources all belong to the shared section, leaving the default empty.
  for (const name of ['npc-one', 'npc-two']) {
    const mod = path.join(library, 'NPC', `DISABLED_${name}`);
    fs.mkdirSync(mod, { recursive: true });
    fs.writeFileSync(path.join(mod, 'npc.ab'), 'UnityFS');
  }
  await call('character:refresh');
  await evaluate(`document.querySelector('.mod-view-back-btn').click()`);
  await waitFor(`!!document.querySelector('.character-card[aria-label^="NPC，"]')`, 'NPC card');
  let releaseRead, refreshStarted, npcReads = 0;
  const pendingRead = new Promise(resolve => { releaseRead = resolve; });
  const nextRefresh = new Promise(resolve => { refreshStarted = resolve; });
  electron.ipcMain.removeHandler('get-mods');
  electron.ipcMain.handle('get-mods', async (event, name) => {
    if (name === 'NPC') { if (++npcReads >= 2) refreshStarted(); await pendingRead; }
    return originalMods(event, name);
  });
  try {
    await evaluate(`document.querySelector('.character-card[aria-label^="NPC，"]').click()`);
    await waitFor(`!!document.querySelector('.appearance-section-loading')`, 'pending Mod read shows loading');
    assert.equal(await evaluate(`!!document.querySelector('.appearance-section-empty-state')`), false);
    await evaluate(`document.querySelector('.view-mode-toggle').click()`);
    assert.equal(await evaluate(`!!document.querySelector('.appearance-section-empty-state')`), false, 'Neither list nor gallery reports an empty library during loading');
    releaseRead();
    await waitFor(`document.querySelectorAll('[data-mod-name]').length === 2 && !document.querySelector('.appearance-section-loading')`, 'shared NPC Mods appear on entry');
    assert.match(await evaluate(`document.querySelector('.appearance-section-tab.active').textContent`), /跨皮肤/);
    await evaluate(`document.querySelector('.appearance-section-tab').click()`);
    for (const window of electron.BrowserWindow.getAllWindows()) window.webContents.send('mods-changed', { gameId: 'arknights', characterName: 'NPC' });
    await nextRefresh;
    await waitFor(`!!document.querySelector('.appearance-section-empty-state') && document.querySelector('.mod-library-panel')?.getAttribute('aria-busy') === 'false'`, 'refresh preserves a manually selected empty section');
    assert(npcReads >= 2);
    assert.match(await evaluate(`document.querySelector('.appearance-section-tab.active').textContent`), /原角色/);
    assert.equal(await evaluate(`document.querySelectorAll('[data-mod-name]').length`), 0);
    await captureUI('npc-sections.png');
  } finally {
    releaseRead();
    electron.ipcMain.removeHandler('get-mods');
    electron.ipcMain.handle('get-mods', originalMods);
  }
  passed('Pending reads show loading in list and gallery; NPC opens its populated shared section and refresh preserves a manually selected empty section');
};
