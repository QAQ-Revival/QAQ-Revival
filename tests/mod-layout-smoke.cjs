const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

module.exports = async ({ electron, evaluate, waitFor, captureUI, window, mods, handlers, passed }) => {
  async function openContextRename(selector) {
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: innerWidth - 20, clientY: innerHeight - 20 }))`);
    await waitFor(`!!document.querySelector('.mod-context-menu')`, 'rename context menu');
    assert.ok(await evaluate(`document.querySelector('.mod-context-menu').getBoundingClientRect().bottom <= innerHeight`), 'Context menu stays inside the window');
    await evaluate(`[...document.querySelectorAll('.mod-context-menu button')].find(button => button.textContent.trim() === '重命名').click()`);
    await waitFor(`!!document.querySelector('.mod-rename-dialog input')`, 'context rename dialog');
  }
  async function setRenameDraft(name) {
    await evaluate(`(() => { const input = document.querySelector('.mod-rename-dialog input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(name)}); input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  }
  async function saveContextRename(name) {
    await setRenameDraft(name);
    await evaluate(`document.querySelector('.mod-rename-dialog').requestSubmit()`);
    await waitFor(`!document.querySelector('.mod-rename-dialog')`, 'context rename saved');
  }
  async function checkDetailControls(mode) {
    const selected = mode === 'list' ? '.mod-row.selected' : '.mod-gallery-card.selected';
    const name = await evaluate(`document.querySelector(${JSON.stringify(selected)}).dataset.modName`);
    await evaluate(`document.querySelector('.mod-gallery-splitter-handle').dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }))`);
    await waitFor(`document.querySelector('.mod-view-container').classList.contains('resizing-gallery')`, mode + ' resize begins');
    await evaluate(`(() => { const box = document.querySelector('.mod-view-container'); const r = box.getBoundingClientRect(); window.dispatchEvent(new MouseEvent('mousemove', { clientX: r.right - 550 * r.width / box.offsetWidth, bubbles: true })); })()`);
    await waitFor(`Math.abs(parseFloat(getComputedStyle(document.querySelector('.mod-detail-panel')).width) - 550) < 3`, mode + ' width follows drag');
    await evaluate(`window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))`);
    await waitFor(`!document.querySelector('.resizing-gallery')`, mode + ' resize ends');
    assert.ok(Math.abs(Number(await evaluate(`localStorage.getItem('modview-gallery-detail-width')`)) - 550) < 3, 'Shared width is saved');
    await evaluate(`document.querySelector('.mod-gallery-splitter-handle').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))`);
    await waitFor(`Math.abs(Number(document.querySelector('.mod-gallery-splitter-handle').getAttribute('aria-valuenow')) - 526) < 3`, mode + ' keyboard resize');
    await evaluate(`document.querySelector('.mod-gallery-splitter-handle').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))`);
    await waitFor(`document.querySelector('.mod-gallery-splitter-handle').getAttribute('aria-valuenow') === '380'`, mode + ' width reset');
    await evaluate(`document.querySelector('.mod-gallery-collapse-btn').click()`);
    await waitFor(`document.querySelector('.mod-detail-panel').getBoundingClientRect().width < 1`, mode + ' detail collapsed');
    assert.equal(await evaluate(`document.querySelector('.mod-detail-panel').hasAttribute('inert')`), true);
    assert.ok(await evaluate(`(() => { const outer = document.querySelector('.mod-view-container'); const main = outer.querySelector('.mod-list-panel, .mod-gallery-panel'); return Math.abs(outer.getBoundingClientRect().width - main.getBoundingClientRect().width) < 3; })()`), 'Collapsed detail leaves no empty gutter');
    await captureUI('mod-layout-' + mode + '-collapsed.png');
    await evaluate(`[...document.querySelectorAll(${JSON.stringify(mode === 'list' ? '.mod-row' : '.mod-gallery-card')})].find(item => item.dataset.modName === ${JSON.stringify(name)}).click()`);
    await waitFor(`!document.querySelector('.mod-detail-panel').classList.contains('collapsed') && document.querySelector('.mod-detail-panel').getBoundingClientRect().width > 350`, mode + ' selection expands details');
  }
  for (const name of ['日常穿搭', 'DISABLED_花火之夜', 'DISABLED_冬日来信 · 围巾与长外套 · 完整版本', 'DISABLED_Exce - Chisa']) {
    const folder = path.join(mods, '安可', name);
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, 'mod.ini'), '[KeyOutfit]\nkey = VK_DOWN\ntype = cycle\n$outfit = 0,1\n[KeyAccessory]\nkey = VK_UP\ntype = cycle\n$accessory = 0,1\n');
  }
  const section = await handlers.get('character-section:create')({}, { characterName: '安可', name: '冬日衣橱', nameEn: 'Winter collection' });
  assert.equal(section.success, true);
  await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === '刷新').click()`);
  await waitFor(`!!document.querySelector('.character-card[aria-label^="安可，"]')`, 'character fixture');
  await evaluate(`document.querySelector('.character-card[aria-label^="安可，"]').click()`);
  await waitFor(`!!document.querySelector('.mod-view-container')`, 'Mod workspace');
  if (await evaluate(`!!document.querySelector('.view-mode-gallery')`)) await evaluate(`document.querySelector('.view-mode-toggle').click()`);
  const row = `document.querySelector('.mod-row[data-mod-name="Exce - Chisa"]')`;
  await waitFor(`!!${row}`, 'fixture rows');
  await evaluate(`${row}.click()`);
  await waitFor(`document.querySelector('.mod-detail-heading')?.textContent.includes('Exce - Chisa') && document.querySelectorAll('.hotkey-row').length === 2`, 'detail loaded');
  await captureUI('mod-layout-desktop.png');
  assert.equal(await evaluate(`${row}.textContent.includes('DISABLED_')`), false, 'Redundant folder prefix is omitted');
  assert.equal(await evaluate(`getComputedStyle(${row}).opacity`), '1', 'Disabled rows remain readable');
  assert.ok(await evaluate(`document.querySelector('.mod-detail-header').getBoundingClientRect().bottom <= document.querySelector('.mod-detail-preview').getBoundingClientRect().top + 1`));
  assert.ok(await evaluate(`document.querySelector('.mod-detail-preview').getBoundingClientRect().height < 170`), 'Empty preview is compact');
  assert.ok(await evaluate(`document.querySelector('.hotkey-section').getBoundingClientRect().bottom < innerHeight`), 'Hotkeys visible without scrolling past empty preview');
  await checkDetailControls('list');

  await evaluate(`window.originalClipboardWriteText = navigator.clipboard.writeText; navigator.clipboard.writeText = async text => { window.copiedModPath = text; }; void 0;`);
  try {
    for (const [name, folder] of [['日常穿搭', '日常穿搭'], ['花火之夜', 'DISABLED_花火之夜']]) {
      await evaluate(`document.querySelector('.mod-row[data-mod-name="${name}"]').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: innerWidth - 20, clientY: innerHeight - 20 }))`);
      await waitFor(`!!document.querySelector('.mod-context-menu')`, 'copy path context menu');
      assert.ok(await evaluate(`document.querySelector('.mod-context-menu').getBoundingClientRect().bottom <= innerHeight`), 'Context menu with copy path stays inside the window');
      if (name === '日常穿搭') await captureUI('mod-context-copy-path.png');
      await evaluate(`[...document.querySelectorAll('.mod-context-menu button')].find(button => button.textContent.trim() === '复制路径').click()`);
      await waitFor(`!document.querySelector('.mod-context-menu') && document.querySelector('.toast-success')?.textContent === '路径已复制'`, 'path copied and menu closed');
      assert.equal(await evaluate('window.copiedModPath'), path.join(mods, '安可', folder), 'Copies the right-clicked Mod full path, including its disabled prefix');
    }
  } finally {
    await evaluate(`navigator.clipboard.writeText = window.originalClipboardWriteText; delete window.originalClipboardWriteText; delete window.copiedModPath;`);
  }
  passed('Mod context menu copies the actual full path of enabled and disabled Mods and shows confirmation');

  const beforeSearch = await evaluate(`document.querySelector('.mod-search-input').getBoundingClientRect().width`);
  await evaluate(`(() => { const input = document.querySelector('.mod-search-input'); input.focus(); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'Exce'); input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await waitFor(`document.querySelectorAll('.mod-row').length === 1`, 'search narrows rows');
  assert.equal(await evaluate(`document.querySelector('.mod-search-input').getBoundingClientRect().width`), beforeSearch);
  await evaluate(`document.querySelector('[aria-label="清除搜索"]').click()`);
  await waitFor(`document.querySelectorAll('.mod-row').length === 5`, 'search clears');
  await evaluate(`document.querySelectorAll('.mod-sort-options button')[1].click()`);
  await waitFor(`document.querySelector('.mod-sort-options .active')?.textContent === '状态'`, 'status sort selected');
  await evaluate(`${row}.querySelector('[role="switch"]').click()`);
  await waitFor(`document.querySelector('.mod-status-badge')?.textContent === '已启用'`, 'toggle and detail status');
  await waitFor(`document.querySelector('.mod-row').dataset.modName === 'Exce - Chisa'`, 'interaction sort updates');
  await evaluate(`document.querySelectorAll('.appearance-section-tab')[1].click()`);
  await waitFor(`!!document.querySelector('.appearance-section-empty-state')`, 'empty section');
  assert.ok(fs.existsSync(path.join(mods, '安可', 'Exce - Chisa')), 'Filtering does not disable the Mod');
  await evaluate(`document.querySelectorAll('.appearance-section-tab')[0].click()`);
  await waitFor(`!!${row}`, 'return to base');
  await evaluate(`${row}.click()`);
  await waitFor(`!!document.querySelector('.mod-detail-heading')`, 'selected detail');
  await evaluate(`document.querySelector('[title="重命名 Mod"]').click()`);
  await waitFor(`!!document.querySelector('.mod-detail-rename input')`, 'rename field');
  await evaluate(`document.querySelector('.mod-detail-rename input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
  await waitFor(`!!document.querySelector('.mod-detail-heading')`, 'rename cancelled');

  await evaluate(`document.querySelector('.mod-gallery-collapse-btn').click()`);
  await waitFor(`document.querySelector('.mod-detail-panel').classList.contains('collapsed')`, 'rename with details collapsed');
  await openContextRename('.mod-row[data-mod-name="花火之夜"]');
  assert.equal(await evaluate(`document.querySelector('.mod-rename-dialog input').value`), '花火之夜');
  assert.equal(await evaluate(`document.querySelector('.mod-row.selected').dataset.modName`), 'Exce - Chisa', 'Rename targets the right-clicked Mod rather than the selected Mod');
  assert.equal(await evaluate(`document.activeElement === document.querySelector('.mod-rename-dialog input')`), true);
  await captureUI('mod-context-rename.png');
  await setRenameDraft('   ');
  assert.equal(await evaluate(`document.querySelector('.mod-rename-dialog [type="submit"]').disabled`), true);
  for (const [name, error] of [['测试模组', '目标名称已存在'], ['bad/name', '包含不支持的路径字符']]) {
    await setRenameDraft(name);
    await evaluate(`document.querySelector('.mod-rename-dialog').requestSubmit()`);
    await waitFor(`document.querySelector('.toast-error')?.textContent.includes(${JSON.stringify(error)})`, 'rename validation');
    assert.ok(fs.existsSync(path.join(mods, '安可', 'DISABLED_花火之夜')));
    assert.ok(await evaluate(`!!document.querySelector('.mod-rename-dialog')`), 'Failed rename remains editable');
  }
  const originalIni = fs.readFileSync(path.join(mods, '安可', 'DISABLED_花火之夜', 'mod.ini'), 'utf8');
  await saveContextRename(' 花火改名 ');
  await waitFor(`!!document.querySelector('.mod-row[data-mod-name="花火改名"]')`, 'disabled Mod row renamed');
  assert.equal(fs.existsSync(path.join(mods, '安可', 'DISABLED_花火之夜')), false);
  assert.equal(fs.existsSync(path.join(mods, '安可', '花火改名')), false, 'Rename preserves the disabled state');
  assert.equal(fs.readFileSync(path.join(mods, '安可', 'DISABLED_花火改名', 'mod.ini'), 'utf8'), originalIni);
  await openContextRename('.mod-row[data-mod-name="花火改名"]');
  await saveContextRename('花火之夜');
  await evaluate(`${row}.click()`);
  await waitFor(`document.querySelector('.mod-detail-heading')?.textContent.includes('Exce - Chisa')`, 'details restored after rename');

  window.setMinimumSize(900, 600);
  window.setSize(1000, 700);
  await waitFor(`innerWidth <= 1000`, 'compact window');
  const measure = () => evaluate(`(() => { const main = document.querySelector('.main-content'); const detail = document.querySelector('.mod-detail-panel'); return { mainOverflow: main.scrollHeight - main.clientHeight, horizontalOverflow: main.scrollWidth - main.clientWidth, detailRight: detail.getBoundingClientRect().right, width: innerWidth }; })()`);
  let layout = await measure();
  assert.ok(layout.mainOverflow <= 2 && layout.horizontalOverflow <= 2 && layout.detailRight <= layout.width, JSON.stringify(layout));
  await captureUI('mod-layout-compact.png');
  await evaluate(`document.querySelector('.mod-detail-card').scrollTop = 10000`);
  const actionsBottom = await evaluate(`({ bottom: document.querySelector('.mod-detail-actions').getBoundingClientRect().bottom, height: innerHeight })`);
  assert.ok(actionsBottom.bottom <= actionsBottom.height + 1, 'Bottom actions are reachable: ' + JSON.stringify(actionsBottom));
  await evaluate(`document.querySelector('.view-mode-toggle').click()`);
  await waitFor(`!!document.querySelector('.view-mode-gallery .mod-gallery-card')`, 'gallery still works');
  await openContextRename('.mod-gallery-card[data-mod-name="Exce - Chisa"]');
  await setRenameDraft('取消的名称');
  await evaluate(`document.querySelector('.mod-rename-dialog input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
  await waitFor(`!document.querySelector('.mod-rename-dialog')`, 'context rename cancelled');
  assert.ok(fs.existsSync(path.join(mods, '安可', 'Exce - Chisa')));
  assert.equal(fs.existsSync(path.join(mods, '安可', '取消的名称')), false);
  await openContextRename('.mod-gallery-card[data-mod-name="Exce - Chisa"]');
  await saveContextRename('Exce - Chisa 改名');
  assert.ok(fs.existsSync(path.join(mods, '安可', 'Exce - Chisa 改名')), 'Gallery rename preserves the enabled state');
  await waitFor(`!!document.querySelector('.mod-gallery-card[data-mod-name="Exce - Chisa 改名"]')`, 'gallery Mod renamed');
  await openContextRename('.mod-gallery-card[data-mod-name="Exce - Chisa 改名"]');
  await saveContextRename('Exce - Chisa');
  await evaluate(`document.querySelector('.mod-gallery-card[data-mod-name="Exce - Chisa"]').click()`);
  await waitFor(`document.querySelector('.mod-detail-heading')?.textContent.includes('Exce - Chisa')`, 'gallery selection restored');
  await captureUI('mod-layout-gallery.png');
  window.setSize(1440, 960);
  await waitFor(`innerWidth === 1440`, 'desktop gallery');
  await checkDetailControls('gallery');
  await evaluate(`document.querySelector('.mod-gallery-collapse-btn').click()`);
  await waitFor(`document.querySelector('.mod-detail-panel').classList.contains('collapsed')`, 'gallery collapse');
  window.setSize(1440, 960);
  await evaluate(`document.querySelector('.view-mode-toggle').click()`);
  await waitFor(`!!${row}`, 'list restored');
  const portrait = electron.nativeImage.createFromBitmap(Buffer.alloc(480 * 800 * 4, 180), { width: 480, height: 800 }).toDataURL();
  assert.equal((await handlers.get('set-mod-preview-from-data')({}, { characterName: '安可', modName: 'Exce - Chisa', dataUrl: portrait })).success, true);
  await evaluate(`document.querySelector('.mod-row[data-mod-name="花火之夜"]').click()`);
  await waitFor(`document.querySelector('.mod-detail-heading')?.textContent.includes('花火之夜')`, 'switch detail');
  await evaluate(`${row}.click()`);
  await waitFor(`document.querySelector('.mod-detail-preview img')?.naturalHeight === 800`, 'portrait preview');
  assert.ok(await evaluate(`document.querySelector('.mod-detail-preview').getBoundingClientRect().height <= innerHeight * .43`), 'Portrait preview height is bounded');
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.mod-detail-preview img')).objectFit`), 'contain');
  await captureUI('mod-layout-preview.png');
  passed('Mod context rename works in list/gallery with collapsed details, targets the clicked Mod, preserves files and enabled state, rejects empty/duplicate/invalid names and supports cancellation');
  passed('Mod workspace: empty and portrait previews, readable rows, search/sort/toggle/filter/rename; both modes support drag/keyboard resizing, saved widths, reset, collapse without a gutter and click-to-reopen');
  await require('./collection-versions-smoke.cjs')({ electron, evaluate, waitFor, captureUI, window, mods, passed });
};
