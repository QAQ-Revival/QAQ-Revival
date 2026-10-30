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
  const runtimeBundle = path.join(path.dirname(process.execPath), 'local-components/xxmi-runtime/d3d11.dll');
  fs.copyFileSync(runtimeBundle, path.join(path.dirname(mods), 'd3d11.dll'));
  fs.writeFileSync(path.join(path.dirname(mods), 'd3dx.ini'), '[Constants]\n');
  fs.writeFileSync(path.join(xxmi, 'XXMI Launcher Config.json'), JSON.stringify({ Importers: { WWMI: { Importer: { importer_folder: path.dirname(mods) } } } }));
  assert.equal((await call('game:update', { gameId: 'wuthering-waves', updates: { modLoaderPath: loader, modFolderPath: mods } })).success, true);
  const state = await call('xxmi:status', 'wuthering-waves');
  assert.equal(state.success, true, JSON.stringify(state));
  assert.equal(state.root, xxmi);
  assert.equal(state.components.length, 1);
  assert.equal(state.components[0].id, 'Launcher');
  assert.ok(state.components[0].installed);
  assert.equal(state.fork.ready, true);
  assert.equal(state.fork.approval, false);
  assert.equal((await call('xxmi:status', 'arknights')).success, false);
  await evaluate(`document.querySelector('.game-settings-button').click()`);
  await waitFor(`document.querySelector('#settings-xxmi-installer')?.textContent.includes('打开 Launcher')`, 'Launcher settings renders its installed version and open action');
  assert.equal(await evaluate(`document.querySelector('#settings-xxmi-installer').textContent.includes('检查更新')`), true);
  await evaluate(`document.querySelector('#settings-xxmi-installer').scrollIntoView({ block: 'start' })`);
  await captureUI('xxmi-settings.png');
  await waitFor(`!![...document.querySelectorAll('#settings-xxmi-installer button')].find(button => button.textContent === '应用维护版本' && button.disabled)`, 'maintained runtime waits for Launcher consent');
  const crypto = require('node:crypto');
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'secp384r1' });
  const launcherConfig = path.join(xxmi, 'XXMI Launcher Config.json');
  const consent = JSON.parse(fs.readFileSync(launcherConfig, 'utf8'));
  consent.Importers.WWMI.Migoto = { unsafe_mode: true, unsafe_mode_signature: crypto.sign('sha256', Buffer.from(require('node:os').userInfo().username), privateKey).toString('base64') };
  fs.mkdirSync(path.join(xxmi, 'Resources/Security'), { recursive: true });
  fs.writeFileSync(path.join(xxmi, 'Resources/Security/public_key.der'), publicKey.export({ type: 'spki', format: 'der' }).toString('base64'));
  fs.writeFileSync(launcherConfig, JSON.stringify(consent));
  const preservedConfig = fs.readFileSync(launcherConfig);
  for (const window of electron.BrowserWindow.getAllWindows()) if (!window.isDestroyed()) window.webContents.send('xxmi:changed', { gameId: 'wuthering-waves' });
  await waitFor(`!![...document.querySelectorAll('#settings-xxmi-installer button')].find(button => button.textContent === '应用维护版本' && !button.disabled)`, 'saved Launcher consent enables the maintained build');
  await evaluate(`[...document.querySelectorAll('#settings-xxmi-installer button')].find(button => button.textContent === '应用维护版本').click()`);
  await waitFor(`document.querySelector('#settings-xxmi-installer')?.textContent.includes('已选用维护构建')`, 'maintained build activation is shown in the settings');
  assert.deepEqual(fs.readFileSync(launcherConfig), preservedConfig);
  await captureUI('xxmi-maintained.png');
  await evaluate(`[...document.querySelectorAll('#settings-xxmi-installer button')].find(button => button.textContent === '恢复切换前文件').click()`);
  await waitFor(`!![...document.querySelectorAll('#settings-xxmi-installer button')].find(button => button.textContent === '应用维护版本' && !button.disabled)`, 'previous MI files can be restored from the same UI');
  assert.deepEqual(fs.readFileSync(launcherConfig), preservedConfig);
  passed('Maintained MI controls require real public-key consent, apply the packaged runtime, restore its baseline, and keep Launcher preferences');
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
  passed('Launcher installation controls and maintained MI controls are separate; default Mods remain under data');
  passed('Leaving and reopening settings during an installation recovers enabled controls when the main process announces completion');

  const shared = path.join(root, 'shared-XXMI'), sharedLoader = path.join(shared, 'Resources/Bin/XXMI Launcher.exe'), sharedConfig = path.join(shared, 'XXMI Launcher Config.json');
  const write = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
  const setMods = async (gameId, modFolderPath) => assert.equal((await call('game:update', { gameId, updates: { modLoaderPath: sharedLoader, modFolderPath } })).success, true);
  const detect = async gameId => {
    const result = await call('auto-detect-paths', gameId);
    assert.equal(result.success, true, result.error);
    return (await call('game:get-settings', gameId)).game.modFolderPath;
  };
  const xxmiGames = [['endfield', 'EFMI', 'Rossi', '洛茜'], ['zzz', 'ZZMI', 'Sunna', '千夏'], ['wuthering-waves', 'WWMI', 'Aalto', '秋水'], ['honkai-star-rail', 'SRMI', 'Acheron', '黄泉']];
  const defaultMods = importer => path.join(process.env.QAQR_DATA_DIR, 'XXMI', importer, 'Mods');
  write(sharedLoader, 'Synthetic launcher, never executed');
  write(sharedConfig, JSON.stringify({ Importers: Object.fromEntries(xxmiGames.map(([, importer]) => [importer, { Importer: { importer_folder: 'custom-' + importer } }])) }));
  for (const [gameId, importer, alias, displayName] of xxmiGames) {
    const customMods = path.join(shared, 'custom-' + importer, 'Mods'), adopted = path.join(defaultMods(importer), 'Adopted');
    write(path.join(customMods, alias, 'Original/mod.ini'), '[TextureOverrideFixture]\nhash = 12345678\n');
    write(path.join(adopted, 'mod.ini'), 'fixture');
    await setMods(gameId, defaultMods(importer));
    assert.equal(await detect(gameId), defaultMods(importer), gameId + ' keeps a default folder that already holds Mods');
    fs.rmSync(adopted, { recursive: true });
    assert.equal(await detect(gameId), customMods, gameId + ' replaces an unused default folder');
    assert.equal(fs.existsSync(path.join(customMods, displayName)), false, gameId + ' reuses the existing alias folder');
    await call('game:switch', gameId);
    assert.equal((await call('get-characters')).characters.find(item => item.name === displayName)?.modCount, 1, gameId + ' lists the existing Mod under its display name');
    if (gameId === 'endfield') assert.equal(JSON.parse(fs.readFileSync(path.join(electron.app.getPath('userData'), 'config.json'), 'utf8')).modsPath, customMods, 'Legacy Endfield path follows detection');
    const chosen = path.join(root, 'chosen-' + importer, 'Mods');
    fs.mkdirSync(chosen, { recursive: true });
    await setMods(gameId, chosen);
    assert.equal(await detect(gameId), chosen, gameId + ' never replaces a chosen folder');
  }
  write(sharedConfig, '{}');
  for (const [gameId, importer] of xxmiGames) {
    const fallback = path.join(shared, importer, 'Mods');
    fs.mkdirSync(fallback, { recursive: true });
    await setMods(gameId, defaultMods(importer));
    assert.equal(await detect(gameId), fallback, gameId + ' falls back to the importer folder when the launcher config names none');
  }
  const nevernessMods = (await call('game:get-settings', 'neverness-to-everness')).game.modFolderPath;
  assert.equal(await detect('neverness-to-everness'), nevernessMods);
  passed('Every XXMI game detects its Mods from a custom root; default folders holding Mods and chosen folders are kept; aliases are reused; non-XXMI games are unaffected');
};
