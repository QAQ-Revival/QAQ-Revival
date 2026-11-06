const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

module.exports = async ({ electron, handlers, root, evaluate, waitFor, captureUI, passed }) => {
  const launcher = path.join(root, 'vulkan-XXMI'), mi = path.join(launcher, 'EFMI');
  const bundle = path.join(path.dirname(process.execPath), 'local-components/efmi-core');
  const manifest = JSON.parse(fs.readFileSync(path.join(bundle, 'component.json')));
  // Keep this fixture older than whichever Core version was built for the run.
  const older = manifest.official.version.split('.').map(Number);
  assert(older.length === 3 && older.every(Number.isSafeInteger));
  const changedPart = older.findLastIndex(value => value > 0);
  assert(changedPart >= 0);
  older[changedPart]--;
  const oldVersion = older.join('.');
  const write = (file, bytes) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, bytes); };
  const coreManifest = path.join(launcher, 'Resources/Packages/EFMI/Manifest.json');
  for (const relative of manifest.official.files) write(path.join(mi, relative), fs.readFileSync(path.join(bundle, relative)));
  write(path.join(mi, 'Core/EFMI/main.ini'), 'global $version = ' + oldVersion.replace(/\.(\d+)$/, '$1') + '\n');
  write(coreManifest, JSON.stringify({ version: oldVersion }));
  for (const window of electron.BrowserWindow.getAllWindows()) if (!window.isDestroyed()) window.webContents.send('xxmi:changed', { gameId: 'endfield' });
  const coreButton = '[aria-label="更新 EFMI-Package 本地原版"]';
  await waitFor(`document.querySelector('#settings-mi-forks')?.textContent.includes('旧版修复 ${oldVersion}') && !!document.querySelector('${coreButton}') && !document.querySelector('${coreButton}').disabled`, 'old Core shows its actual version and an enabled official updater');
  await evaluate(`document.querySelector('#settings-mi-forks').scrollIntoView({ block: 'start' })`);
  await captureUI('mi-official-update-before.png');
  const original = handlers.get('xxmi:update-official'), requests = [];
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  electron.ipcMain.removeHandler('xxmi:update-official');
  electron.ipcMain.handle('xxmi:update-official', async (_, payload) => {
    requests.push(payload);
    await pending;
    if (payload.component === 'core') {
      for (const relative of manifest.official.files) write(path.join(mi, relative), fs.readFileSync(path.join(bundle, 'official', relative)));
      write(path.join(mi, 'Core/EFMI/main.ini'), 'global $version = ' + manifest.official.version.replace(/\.(\d+)$/, '$1') + '\n');
      write(coreManifest, JSON.stringify({ version: manifest.official.version }));
    }
    return { success: true, version: manifest.official.version };
  });
  try {
    await evaluate(`document.querySelector('${coreButton}').click()`);
    await waitFor(`document.querySelector('${coreButton}').disabled`, 'the update action is locked while applying');
    assert.deepEqual(requests, [{ gameId: 'endfield', component: 'core' }]);
    finish();
    await waitFor(`!document.querySelector('${coreButton}').disabled && document.querySelector('#settings-mi-forks').textContent.includes('官方原版 ${manifest.official.version}') && !document.querySelector('#settings-mi-forks').textContent.includes('本地是 ${oldVersion}')`, 'successful update refreshes disk state and removes the mismatch warning');
    const state = await handlers.get('xxmi:status')({}, 'endfield');
    assert.equal(state.fork.components.find(item => item.id === 'core').canUseFork, true);
    await captureUI('mi-official-update-after.png');
    await evaluate(`document.querySelector('[aria-label="更新 XXMI-Libs 本地原版"]').click()`);
    await waitFor(`!document.querySelector('[aria-label="更新 XXMI-Libs 本地原版"]').disabled`, 'runtime update finishes');
    assert.deepEqual(requests.at(-1), { gameId: 'endfield', component: 'runtime' });
  } finally {
    finish();
    electron.ipcMain.removeHandler('xxmi:update-official');
    electron.ipcMain.handle('xxmi:update-official', original);
  }
  passed('Component rows update Core and runtime independently; older Core reports its real version, and completion refreshes state and restores the compatible fix option');
};
