const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

module.exports = async ({ electron, root, profile, mods, handlers, passed, runOverlay, side, evaluate, wait, manager }) => {
  const fixtures = new Map();
  const write = (relative, contents) => {
    const file = path.join(mods, '安可', relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, contents);
    fixtures.set(file, contents);
  };
  const key = (name, binding) => `[Key${name}]\ncondition = $object_detected && $mod_enabled\nkey = ${binding}\ntype = cycle\n$${name} = 0,1\n`;
  write('GroupedMod/Form A/mod.ini', key('pads', 'no_modifiers 8') + key('shoe', 'no_modifiers 0'));
  write('GroupedMod/Form A/extra.ini', key('pads', 'no_modifiers 8'));
  write('GroupedMod/Wrapper/Form B & 附件/mod.ini', key('sleeve', 'no_modifiers 8') + key('barefeet', 'no_modifiers 0') + key('menu', 'Q'));
  write('GroupedMod/mod.ini', key('global', 'F1'));
  write('GroupedMod/Textures/info.ini', '[ResourceInfo]\ntype = Buffer\n');
  const details = (modName, refresh = false) => handlers.get('get-mod-details')({}, { characterName: '安可', modName, refresh });
  const result = await details('GroupedMod');
  assert.equal(result.success, true);
  assert.deepEqual(result.hotkeyGroups.map(group => [group.name, group.hotkeys.length]), [['GroupedMod', 1], ['Form A', 2], ['Form B & 附件', 3]]);
  assert.equal(result.hotkeys.length, 4, 'Legacy manager list stays compatible');
  assert.equal(result.hotkeyGroups[2].hotkeys[0].isMenu, true, 'Menu sorting remains inside its own group');
  assert.deepEqual((await details('GroupedMod')).hotkeyGroups, result.hotkeyGroups, 'Repeated reads preserve groups');
  const saved = JSON.parse(fs.readFileSync(path.join(profile, 'hotkeys.json'), 'utf8'))['安可/GroupedMod'];
  assert.equal(saved.version, 9, 'Old merged cache is rescanned automatically');
  assert.deepEqual(saved.hotkeyGroups, result.hotkeyGroups);
  assert.ok(result.hotkeyGroups.every(group => !path.isAbsolute(group.relativePath)));

  await runOverlay(`selectedChar = '安可'; currentMods = [{ name: 'GroupedMod', enabled: true }]; selectedModName = null; openDetail('GroupedMod')`);
  await wait(`document.querySelectorAll('.detail-hotkey-group').length === 3`);
  const groups = () => evaluate(`[...document.querySelectorAll('.detail-hotkey-group')].map(group => ({ name: group.querySelector('h3').textContent, labels: [...group.querySelectorAll('.detail-hotkey-name')].map(label => label.textContent), bindings: [...group.querySelectorAll('.detail-hotkey-row')].map(row => row.dataset.hotkeyPayload) }))`);
  const before = await groups();
  assert.deepEqual(before.map(group => [group.name, group.labels]), [['GroupedMod', ['global']], ['Form A', ['pads', 'shoe']], ['Form B & 附件', ['菜单', 'sleeve', 'barefeet']]]);
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('.detail-hotkey-row')].map(row => row.dataset.hotkeyIndex)`), ['0', '1', '2', '3', '4', '5']);
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('.detail-hotkey-group')].map(group => parseFloat(getComputedStyle(group).borderTopWidth) > 0)`), [false, true, true]);

  const applied = [];
  const originalApply = handlers.get('overlay-apply-hotkey');
  electron.ipcMain.removeHandler('overlay-apply-hotkey');
  electron.ipcMain.handle('overlay-apply-hotkey', (_event, payload) => { applied.push(payload.hotkey); return { success: true }; });
  try {
    await evaluate(`document.querySelectorAll('.detail-hotkey-row')[1].click(); document.querySelectorAll('.detail-hotkey-row')[4].click(); document.querySelectorAll('.detail-hotkey-row')[0].click()`);
    await wait(`document.querySelector('.side-toast').textContent.includes('已应用')`);
    assert.deepEqual(applied, [result.hotkeyGroups[1].hotkeys[0].applyPayload, result.hotkeyGroups[2].hotkeys[1].applyPayload, result.hotkeyGroups[0].hotkeys[0].applyPayload]);
  } finally {
    electron.ipcMain.removeHandler('overlay-apply-hotkey');
    electron.ipcMain.handle('overlay-apply-hotkey', originalApply);
  }
  await evaluate(`document.querySelector('#detailTranslateBtn').click()`);
  await wait(`document.querySelector('#detailTranslateBtn').getAttribute('aria-pressed') === 'true'`);
  const translated = await groups();
  assert.deepEqual(translated.map(group => [group.name, group.bindings]), before.map(group => [group.name, group.bindings]), 'Translation preserves group names and every binding');
  assert.ok(translated[0].labels.every(label => label === '译文'));
  assert.ok(translated[1].labels.every(label => label === '译文'));
  assert.ok(translated[2].labels.every(label => label === '译文' || label === '菜单'));
  await evaluate(`document.querySelector('#detailTranslateBtn').click(); document.querySelector('#sideBody').scrollTop = 0`);
  side.setResizable(true);
  for (const width of [200, 300, 550]) {
    side.setSize(width, 950);
    await wait(`Math.abs(window.innerWidth - ${width}) <= 1`).catch(async error => {
      throw Error(error.message + ': ' + JSON.stringify({ bounds: side.getBounds(), innerWidth: await evaluate('window.innerWidth') }));
    });
    assert.equal(await evaluate(`document.querySelector('#sideBody').scrollWidth <= document.querySelector('#sideBody').clientWidth`), true, 'Grouped list fits width ' + width);
  }
  side.setSize(300, 950);
  await wait('Math.abs(window.innerWidth - 300) <= 1');
  side.setResizable(false);
  await new Promise(resolve => setTimeout(resolve, 100));
  fs.writeFileSync(path.join(root, 'hotkey-groups.png'), (await side.webContents.capturePage()).toPNG());

  write('SameNames/A/Common/mod.ini', key('first', '8'));
  write('SameNames/B/Common/mod.ini', key('second', '8'));
  assert.deepEqual((await details('SameNames')).hotkeyGroups.map(group => group.name), ['A/Common', 'B/Common']);
  write('EmptyGroup/Part/mod.ini', '[TextureOverrideTest]\nhash = 12345678\n');
  assert.deepEqual((await details('EmptyGroup')).hotkeyGroups, []);
  for (const [file, contents] of fixtures) assert.equal(fs.readFileSync(file, 'utf8'), contents, 'Mod INI is unchanged');
  passed('Nested Mod groups retain shared keys, dedupe only within directories, refresh old cache, separate names with rules, preserve translation/click targets and fit 200–550 px');

  // A new INI beside mod.ini must be found without an explicit cache refresh.
  write('GroupedMod/TedomScaleControls.ini', key('world_toggle', 'no_ctrl no_alt SHIFT VK_F3') + key('preview_toggle', 'no_ctrl no_alt SHIFT VK_F4'));
  const fresh = await details('GroupedMod');
  assert.deepEqual(fresh.hotkeyGroups[0].hotkeys.filter(h => /toggle/.test(h.section)).map(h => h.keys), [['Shift', 'F3'], ['Shift', 'F4']]);
  await runOverlay(`openDetail('GroupedMod', { force: true })`);
  await wait(`document.querySelector('.detail-hotkey-section').textContent.includes('F3')`);
  const sameSizeFile = path.join(mods, '安可', 'GroupedMod', 'TedomScaleControls.ini');
  const oldStat = fs.statSync(sameSizeFile);
  write('GroupedMod/TedomScaleControls.ini', key('world_toggle', 'no_ctrl no_alt SHIFT VK_F5') + key('preview_toggle', 'no_ctrl no_alt SHIFT VK_F4'));
  fs.utimesSync(sameSizeFile, oldStat.atime, oldStat.mtime);
  await evaluate(`document.querySelector('#detailRefreshHotkeysBtn').click()`);
  await wait(`document.querySelector('.detail-hotkey-section').textContent.includes('F5') && !document.querySelector('.detail-hotkey-section').textContent.includes('F3')`);

  const m = manager;
  await m.evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === '刷新').click()`);
  await m.waitFor(`!!document.querySelector('.character-card[aria-label^="安可，"]')`, 'character ready');
  await m.evaluate(`document.querySelector('.character-card[aria-label^="安可，"]').click()`);
  await m.waitFor(`!!document.querySelector('.mod-row[data-mod-name="GroupedMod"]')`, 'grouped Mod row');
  await m.evaluate(`document.querySelector('.mod-row[data-mod-name="GroupedMod"]').click()`);
  await m.waitFor(`document.querySelectorAll('.hotkey-group').length === 3`, 'manager groups');
  assert.deepEqual(await m.evaluate(`[...document.querySelectorAll('.hotkey-group-name')].map(el => el.textContent)`), fresh.hotkeyGroups.map(g => g.name));
  assert.equal(await m.evaluate(`document.querySelectorAll('.hotkey-row').length`), 8, 'Manager preserves repeated keys across groups');
  assert.ok(await m.evaluate(`document.querySelector('.hotkey-section').textContent.includes('F5')`));

  write('GroupedMod/TedomScaleControls.ini', key('world_toggle', 'no_ctrl no_alt SHIFT VK_F3') + key('preview_toggle', 'no_ctrl no_alt SHIFT VK_F4'));
  await m.evaluate(`document.querySelector('[title="刷新快捷键 (强制重新扫描)"]').click()`);
  await m.waitFor(`document.querySelector('.hotkey-section').textContent.includes('F3')`, 'manager manual refresh');
  await wait(`document.querySelector('.detail-hotkey-section').textContent.includes('F3')`, 'manager refresh updates overlay');
  await m.captureUI('hotkey-manager-groups.png');
  m.window.setMinimumSize(900, 600);
  m.window.setSize(1000, 700);
  await m.waitFor('innerWidth <= 1000', 'compact manager');
  assert.ok(await m.evaluate(`document.querySelector('.hotkey-section').scrollWidth <= document.querySelector('.hotkey-section').clientWidth`));
  await m.captureUI('hotkey-manager-compact.png');
  m.window.setSize(1440, 960);

  for (const [channel, binding] of [['character:refresh', 'F6'], ['character:update-catalog', 'F7']]) {
    write('GroupedMod/TedomScaleControls.ini', key('world_toggle', 'SHIFT ' + binding));
    await handlers.get(channel)({}, 'wuthering-waves');
    await m.waitFor(`document.querySelector('.hotkey-section').textContent.includes('${binding}')`, channel + ' updates manager');
    await wait(`document.querySelector('.detail-hotkey-section').textContent.includes('${binding}')`);
  }
  fs.unlinkSync(sameSizeFile);
  assert.equal((await details('GroupedMod')).hotkeyGroups[0].hotkeys.length, 1, 'Deleted INI disappears on next read');
  write('ScopedEdit/A/mod.ini', key('same', 'F1'));
  write('ScopedEdit/B/mod.ini', key('same', 'F2') + '[CommandListOther]\nkey = untouched\n');
  assert.equal((await handlers.get('save-hotkey')({}, { characterName: '安可', modName: 'ScopedEdit', sectionName: 'same', newKey: 'F8', relativePath: 'B' })).success, true);
  assert.match(fs.readFileSync(path.join(mods, '安可/ScopedEdit/A/mod.ini'), 'utf8'), /key = F1/);
  assert.match(fs.readFileSync(path.join(mods, '安可/ScopedEdit/B/mod.ini'), 'utf8'), /key = F8[\s\S]*key = untouched/);
  passed('New Shift+F3/F4 INI, same-size edits, deletion, grouped manager layout, both refresh buttons, character refresh/update propagation and scoped editing');
};
