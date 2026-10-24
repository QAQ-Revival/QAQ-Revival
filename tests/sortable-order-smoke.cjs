const assert = require('node:assert/strict');

module.exports = async function testSortableOrder({ evaluate, waitFor, captureUI, window, passed }) {
  const nav = '.nav-item';
  const game = '.game-selector-option';
  const readOrder = selector => evaluate(`[...document.querySelectorAll(${JSON.stringify(selector)})].map(item => item.dataset.sortId)`);
  const activeTab = () => evaluate(`document.querySelector('.nav-item.active').dataset.sortId`);
  const activeGame = () => evaluate(`document.querySelector('.game-selector-option[aria-checked="true"]').dataset.sortId`);
  async function expectOrder(selector, ids) {
    await waitFor(`JSON.stringify([...document.querySelectorAll(${JSON.stringify(selector)})].map(item => item.dataset.sortId)) === ${JSON.stringify(JSON.stringify(ids))}`, 'reordered list');
  }
  async function startDrag(selector, from, to, edge = 'before') {
    await evaluate(`(() => {
      const items = [...document.querySelectorAll(${JSON.stringify(selector)})];
      const source = items.find(item => item.dataset.sortId === ${JSON.stringify(from)});
      const target = items.find(item => item.dataset.sortId === ${JSON.stringify(to)});
      const rect = target.getBoundingClientRect();
      const options = { bubbles: true, cancelable: true, dataTransfer: new DataTransfer(),
        clientX: rect.left + rect.width / 2, clientY: ${JSON.stringify(edge)} === 'before' ? rect.top + 2 : rect.bottom - 2 };
      source.dispatchEvent(new DragEvent('dragstart', options));
      target.dispatchEvent(new DragEvent('dragover', options));
      window.sortTestDrag = { source, target, options };
    })()`);
  }
  async function endDrag(commit = true) {
    await evaluate(`(() => {
      const { source, target, options } = window.sortTestDrag;
      if (${commit}) target.dispatchEvent(new DragEvent('drop', options));
      source.dispatchEvent(new DragEvent('dragend', options));
      // A click emitted after the drag must not navigate or switch games.
      source.click();
      delete window.sortTestDrag;
    })()`);
  }
  async function openGames() {
    await evaluate(`document.querySelector('.game-selector-trigger').click()`);
    await waitFor(`!!document.querySelector('#sidebar-game-menu')`, 'game menu opened');
  }
  async function closeGames() {
    await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
    await waitFor(`!document.querySelector('#sidebar-game-menu')`, 'game menu closed');
  }
  async function reload() {
    await window.loadFile(require('node:path').join(process.resourcesPath, 'app/out/renderer/index.html'));
    await waitFor(`document.querySelectorAll('.nav-item').length === 4 && document.querySelector('.game-selector-trigger')?.textContent.includes('鸣潮')`, 'reloaded UI');
  }

  const defaults = await readOrder(nav);
  const selectedTab = await activeTab();
  await startDrag(nav, defaults.at(-1), defaults[0]);
  await waitFor(`document.querySelector('.nav-item[data-sort-edge="before"]')?.dataset.sortId === ${JSON.stringify(defaults[0])}`, 'navigation drop indicator');
  await captureUI('navigation-reorder.png');
  await endDrag();
  const reorderedNav = [defaults.at(-1), ...defaults.slice(0, -1)];
  await expectOrder(nav, reorderedNav);
  assert.equal(await activeTab(), selectedTab);
  await startDrag(nav, reorderedNav[0], reorderedNav.at(-1), 'after');
  await endDrag(false);
  await expectOrder(nav, reorderedNav);
  assert.equal(await activeTab(), selectedTab);
  assert.equal(await evaluate(`!!document.querySelector('[data-sort-edge], [data-sort-dragging]')`), false);

  // Reordering works when labels are hidden, and from the keyboard without losing focus.
  await evaluate(`document.querySelector('.sidebar-toggle').click()`);
  await waitFor(`!!document.querySelector('.sidebar.collapsed')`, 'sidebar collapsed');
  await startDrag(nav, reorderedNav[0], reorderedNav.at(-1), 'after');
  await endDrag();
  await expectOrder(nav, defaults);
  await evaluate(`(() => { const item = document.querySelector('.nav-item'); item.focus(); item.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true, cancelable: true })); })()`);
  const keyboardNav = [defaults[1], defaults[0], ...defaults.slice(2)];
  await expectOrder(nav, keyboardNav);
  assert.equal(await evaluate(`document.activeElement.dataset.sortId`), defaults[0]);
  assert.equal(await activeTab(), selectedTab);
  await evaluate(`document.querySelector('.sidebar-header').click()`);
  await waitFor(`!document.querySelector('.sidebar.collapsed')`, 'sidebar expanded');
  passed('Navigation drag/drop supports both directions, cancellation, collapsed mode and keyboard reorder without switching pages');

  await openGames();
  const defaultGames = await readOrder(game);
  assert.ok(defaultGames.length >= 3, 'Games with explicit and default Mods directories are available');
  const selectedGame = await activeGame();
  const movedGame = defaultGames.at(-1);
  assert.ok(await evaluate(`document.querySelector('.game-selector-option:last-of-type').textContent.includes('已配置 Mod 目录')`));
  await startDrag(game, movedGame, defaultGames[0]);
  await waitFor(`!!document.querySelector('.game-selector-option[data-sort-edge="before"]')`, 'game drop indicator');
  await captureUI('game-reorder.png');
  await endDrag();
  let reorderedGames = [movedGame, ...defaultGames.slice(0, -1)];
  await expectOrder(game, reorderedGames);
  assert.equal(await activeGame(), selectedGame);
  assert.equal((await evaluate(`window.api.getConfig()`)).config.activeGameId, selectedGame);

  await evaluate(`(() => { const item = document.querySelector('.game-selector-option'); item.focus(); item.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true, cancelable: true })); })()`);
  reorderedGames = [defaultGames[0], movedGame, ...defaultGames.slice(1, -1)];
  await expectOrder(game, reorderedGames);
  assert.equal(await evaluate(`document.activeElement.dataset.sortId`), movedGame);
  // Ordinary arrow keys still navigate the menu without changing its order.
  await evaluate(`document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }))`);
  assert.equal(await evaluate(`document.activeElement.dataset.sortId`), reorderedGames[2]);
  await expectOrder(game, reorderedGames);

  await startDrag(game, movedGame, defaultGames.at(-2), 'after');
  await endDrag(false);
  await expectOrder(game, reorderedGames);
  await startDrag(nav, keyboardNav[0], keyboardNav[1]);
  await evaluate(`(() => { const target = document.querySelector('.game-selector-option'); target.dispatchEvent(new DragEvent('drop', window.sortTestDrag.options)); })()`);
  await endDrag(false);
  await expectOrder(game, reorderedGames);
  await expectOrder(nav, keyboardNav);
  await evaluate(`(() => { const target = document.querySelector('.game-selector-option'); const options = { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() }; options.dataTransfer.setData('text/plain', 'foreign item'); target.dispatchEvent(new DragEvent('dragover', options)); target.dispatchEvent(new DragEvent('drop', options)); })()`);
  await expectOrder(game, reorderedGames);
  await closeGames();
  await openGames();
  await expectOrder(game, reorderedGames);
  assert.equal(await activeGame(), selectedGame);
  // A subsequent deliberate click still switches the game normally.
  await evaluate(`(() => { const item = document.querySelector('.game-selector-option[data-sort-id="endfield"]'); item.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); item.click(); })()`);
  await waitFor(`!document.querySelector('#sidebar-game-menu') && document.querySelector('.game-selector-trigger')?.textContent.includes('明日方舟终末地')`, 'normal game click after sorting');
  await openGames();
  await expectOrder(game, reorderedGames);
  await evaluate(`document.querySelector('.game-selector-option[data-sort-id="wuthering-waves"]').click()`);
  await waitFor(`!document.querySelector('#sidebar-game-menu') && document.querySelector('.game-selector-trigger')?.textContent.includes('鸣潮')`, 'restore game');
  passed('Game ordering overrides configured-first defaults, preserves selection, rejects unrelated drops and retains normal switching and keyboard navigation');

  assert.deepEqual(await evaluate(`JSON.parse(localStorage.getItem('qaqm.navigationOrder'))`), keyboardNav);
  assert.deepEqual(await evaluate(`JSON.parse(localStorage.getItem('qaqm.gameOrder'))`), reorderedGames);
  await reload();
  await expectOrder(nav, keyboardNav);
  await openGames();
  await expectOrder(game, reorderedGames);
  assert.equal(await activeGame(), selectedGame);
  await closeGames();

  // Damaged/stale preferences must not hide items or prevent startup.
  await evaluate(`localStorage.setItem('qaqm.navigationOrder', '{broken'); localStorage.setItem('qaqm.gameOrder', JSON.stringify(['removed-game', ${JSON.stringify(movedGame)}, ${JSON.stringify(movedGame)}]));`);
  await reload();
  await expectOrder(nav, defaults);
  await openGames();
  await expectOrder(game, [movedGame, ...defaultGames.filter(id => id !== movedGame)]);
  await closeGames();
  await evaluate(`localStorage.setItem('qaqm.navigationOrder', JSON.stringify(${JSON.stringify(keyboardNav)})); localStorage.setItem('qaqm.gameOrder', JSON.stringify(${JSON.stringify(reorderedGames)}));`);
  await reload();
  passed('Both orders survive renderer reload; malformed preferences, removed IDs, duplicates and newly available items are handled safely');

  const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const persistOrder = () => evaluate(`[...document.querySelectorAll('[data-persist-game]')].map(item => item.dataset.persistGame)`);
  async function openSettings(category) {
    await click('.sidebar-settings');
    await waitFor(`!!document.querySelector('[data-category="${category}"]')`, 'settings loaded');
    await click(`[data-category="${category}"]`);
  }
  async function expectPersist(ids) {
    await waitFor(`JSON.stringify([...document.querySelectorAll('[data-persist-game]')].map(item => item.dataset.persistGame)) === ${JSON.stringify(JSON.stringify(ids))}`, 'shared Mod state game order');
    assert.deepEqual(await persistOrder(), ids);
  }
  await openSettings('persist');
  await expectPersist(reorderedGames);
  await openSettings('general');
  await waitFor(`document.querySelectorAll('[data-game-visibility]').length === ${reorderedGames.length}`, 'game visibility settings');
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('[data-game-visibility]')].map(item => item.dataset.gameVisibility)`), reorderedGames);
  await click(`[data-game-visibility="${selectedGame}"]`);
  const visible = reorderedGames.filter(id => id !== selectedGame);
  await waitFor(`document.querySelector('[data-game-visibility="${selectedGame}"]')?.checked === false`, 'active game hidden');
  await openSettings('persist');
  await expectPersist(visible);
  assert.equal((await evaluate('window.api.getConfig()')).config.activeGameId, visible[0]);
  assert.equal((await evaluate(`window.api.gameSwitch(${JSON.stringify(selectedGame)})`)).success, false);

  // Reordering the remaining games keeps the hidden game's slot for restoration.
  await openGames();
  await expectOrder(game, visible);
  assert.equal(await evaluate(`!!document.querySelector('.game-selector-hide')`), false);
  await captureUI('game-visibility-menu.png');
  await startDrag(game, visible.at(-1), visible[0]);
  await endDrag();
  const reorderedVisible = [visible.at(-1), ...visible.slice(0, -1)];
  await expectOrder(game, reorderedVisible);
  await expectPersist(reorderedVisible);
  await closeGames();
  const fullOrder = await evaluate(`JSON.parse(localStorage.getItem('qaqm.gameOrder'))`);
  assert.equal(fullOrder.indexOf(selectedGame), reorderedGames.indexOf(selectedGame));
  await openSettings('general');
  await waitFor(`document.querySelector('[data-game-visibility="${selectedGame}"]')?.checked === false`, 'hidden game recovery');
  await evaluate(`document.querySelector('#settings-game-visibility').scrollIntoView({ block: 'center' })`);
  await captureUI('game-visibility-settings.png');
  await evaluate(`localStorage.setItem('qaqm.downloadSource', 'qaqm')`);
  await window.loadFile(require('node:path').join(process.resourcesPath, 'app/out/renderer/index.html'));
  await waitFor(`!!document.querySelector('.game-selector-trigger')`, 'visibility reload');
  await openGames();
  await expectOrder(game, reorderedVisible);
  await closeGames();
  // The offline smoke suite uses a cache containing both visible and hidden games.
  const fs = require('node:fs'), path = require('node:path');
  const settings = require(path.join(process.resourcesPath, 'app/out/main/games/settings.cjs'));
  const cachePath = settings.getModCachePath(visible[0]);
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify({ schemaVersion: settings.CACHE_SCHEMA_VERSION,
    lastSyncTimestamp: new Date().toISOString(), mods: [
      { id: 'visible-game-fixture', name: 'Visible game fixture', gameId: visible[0], characterName: 'Fixture' },
      { id: 'hidden-game-fixture', name: 'Hidden game fixture', gameId: selectedGame, characterName: 'Fixture' }
    ] }));
  await click('.nav-item[data-sort-id="modmarket"]');
  await waitFor(`!!document.querySelector('.mod-market-select option[value="all"]')`, 'download game selector');
  const marketOrder = () => evaluate(`[...document.querySelector('.mod-market-select').options].map(item => item.value).filter(id => id !== 'all')`);
  assert.deepEqual(await marketOrder(), reorderedVisible);
  await evaluate(`(() => { const select = document.querySelector('.mod-market-select'); select.value = 'all'; select.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await waitFor(`document.body.innerText.includes('Visible game fixture')`, 'cached visible game mods');
  assert.equal(await evaluate(`document.body.innerText.includes('Hidden game fixture')`), false);

  await openSettings('general');
  await waitFor(`document.querySelector('[data-game-visibility="${selectedGame}"]')?.checked === false`, 'recovery survives reload');
  await click(`[data-game-visibility="${selectedGame}"]`);
  await waitFor(`document.querySelector('[data-game-visibility="${selectedGame}"]')?.checked === true`, 'game restored');
  await openGames();
  await expectOrder(game, fullOrder);
  await closeGames();
  await openSettings('persist');
  await expectPersist(fullOrder);
  await captureUI('persist-shared-game-order.png');
  await click(`[data-persist-game="${selectedGame}"] .system-button`);
  await waitFor(`!!document.querySelector('[data-persist-detail="${selectedGame}"]')`, 'saved state details');
  await evaluate(`window.api.gameSetHidden(${JSON.stringify(selectedGame)}, true)`);
  await expectPersist(reorderedVisible);
  await evaluate(`window.api.gameSetHidden(${JSON.stringify(selectedGame)}, false)`);
  await expectPersist(fullOrder);
  await click('.nav-item[data-sort-id="modmarket"]');
  await waitFor(`document.querySelector('.mod-market-select')?.options.length === ${fullOrder.length + 1}`, 'download options restored');
  assert.deepEqual(await marketOrder(), fullOrder);
  passed('Hiding the active game switches safely, removes open saved-state details and all game options, and survives reload; General restores the same shared order');

  await evaluate(`window.api.gameSwitch(${JSON.stringify(selectedGame)})`);
  await evaluate(`localStorage.setItem('qaqm.gameOrder', JSON.stringify(${JSON.stringify(reorderedGames)}))`);
  await reload();
};
