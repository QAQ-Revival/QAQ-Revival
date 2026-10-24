const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

module.exports = async ({ electron, handlers, root, evaluate, waitFor, captureUI, passed }) => {
  const call = (name, ...args) => handlers.get(name)({}, ...args);
  const xxmi = path.join(root, 'managed-XXMI');
  const loader = path.join(xxmi, 'Resources/Bin/XXMI Launcher.exe');
  const mods = path.join(xxmi, 'WWMI/Mods');
  fs.mkdirSync(path.dirname(loader), { recursive: true });
  // A real PE version resource is needed, but this copy is never launched.
  fs.copyFileSync(process.execPath, loader);
  fs.mkdirSync(mods, { recursive: true });
  fs.writeFileSync(path.join(xxmi, 'XXMI Launcher Config.json'), JSON.stringify({ Importers: { WWMI: { Importer: { importer_folder: path.dirname(mods) } } } }));
  assert.equal((await call('game:update', { gameId: 'wuthering-waves', updates: { modLoaderPath: loader, modFolderPath: mods } })).success, true);
  const state = await call('xxmi:status', 'wuthering-waves');
  assert.equal(state.success, true, JSON.stringify(state));
  assert.equal(state.root, xxmi);
  assert.equal(state.components.length, 1);
  assert.equal(state.components[0].id, 'Launcher');
  assert.ok(state.components[0].installed);
  assert.equal((await call('xxmi:status', 'arknights')).success, false);
  await evaluate(`document.querySelector('.game-settings-button').click()`);
  await waitFor(`document.querySelector('#settings-xxmi-installer')?.textContent.includes('打开 Launcher')`, 'Launcher settings renders its installed version and open action');
  assert.equal(await evaluate(`document.querySelector('#settings-xxmi-installer').textContent.includes('检查更新')`), true);
  await evaluate(`document.querySelector('#settings-xxmi-installer').scrollIntoView({ block: 'start' })`);
  await captureUI('xxmi-settings.png');
  const originalStatus = handlers.get('xxmi:status');
  let installing = true;
  electron.ipcMain.removeHandler('xxmi:status');
  electron.ipcMain.handle('xxmi:status', async () => ({ ...state, busy: installing }));
  try {
    await evaluate(`window.dispatchEvent(new CustomEvent('qaqm-navigate', { detail: { tab: 'characters' } }))`);
    await waitFor(`!document.querySelector('#settings-xxmi-installer')`, 'leave the installer settings');
    await evaluate(`document.querySelector('.game-settings-button').click()`);
    await waitFor(`!![...document.querySelectorAll('#settings-xxmi-installer button')].find(button => button.textContent === '检查更新' && button.disabled)`, 'return during an active installation');
    installing = false;
    for (const window of electron.BrowserWindow.getAllWindows()) if (!window.isDestroyed()) window.webContents.send('xxmi:changed', { gameId: 'wuthering-waves', root: xxmi });
    await waitFor(`!![...document.querySelectorAll('#settings-xxmi-installer button')].find(button => button.textContent === '检查更新' && !button.disabled)`, 'installation completion refreshes the remounted page');
  } finally {
    electron.ipcMain.removeHandler('xxmi:status');
    electron.ipcMain.handle('xxmi:status', originalStatus);
  }
  const games = (await call('game:list')).games;
  assert.equal(games.find(game => game.id === 'arknights').modFolderPath, path.join(root, 'data/Arknights/Mods'));
  assert.equal((await call('xxmi:status', 'neverness-to-everness')).success, false);
  passed('QAQR manages only XXMI Launcher installation, update and opening; MI components have no duplicate controls; default Mods remain under data');
  passed('Leaving and reopening settings during an installation recovers enabled controls when the main process announces completion');
};
