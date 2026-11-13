const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

module.exports = async ({ electron, handlers, root, evaluate, waitFor, captureUI, passed }) => {
  const runtime = createRequire(path.join(process.resourcesPath, 'app/package.json'));
  const settings = runtime('./out/main/games/settings.cjs');
  const { createGameUpdates } = runtime('./out/main/games/updates.cjs');
  const call = (channel, payload) => handlers.get(channel)({}, payload);
  const gameId = 'wuthering-waves';
  const directory = path.join(root, 'update-game');
  fs.mkdirSync(directory, { recursive: true });
  const gamePath = path.join(directory, 'Wuthering Waves.exe');
  fs.writeFileSync(gamePath, 'Synthetic game, never executed');
  fs.writeFileSync(path.join(directory, 'launcherDownloadConfig.json'), JSON.stringify({ appId: '10003', version: '3.7.0' }));
  assert.equal((await call('game:update', { gameId, updates: { gamePath } })).success, true);
  let requests = 0, offline = false;
  const service = createGameUpdates({ userData: root, getGame: id => settings.getGameById(id), supportsMi: () => true,
    fetch: async url => {
      requests++;
      assert.match(url, /kurogame\.com\/launcher\/game\/10003_[^/]+\/G152\//);
      if (offline) throw Error('offline');
      return new Response(JSON.stringify({ resourcePacks: { common: { version: '3.7.1' } }, predownload: { resourcePacks: { common: { version: '3.8.0' } } } }));
    },
    checkMi: async () => ({ success: true, components: [
      { id: 'Launcher', installed: '2.4.9', latest: '2.5.0', updateAvailable: true },
      { id: 'XXMI', installed: '1.2.3', latest: '1.2.3', updateAvailable: false },
      { id: 'WWMI', installed: '1.1.0', latest: '1.1.0', updateAvailable: false },
    ] }),
    onChange: state => { for (const window of electron.BrowserWindow.getAllWindows()) window.webContents.send('game-updates:changed', state); },
  });
  for (const [name, callback] of [['state', id => service.state(id)], ['check', options => service.check(options)], ['configure', options => service.configure(options)]]) {
    electron.ipcMain.removeHandler('game-updates:' + name);
    electron.ipcMain.handle('game-updates:' + name, (_, payload) => callback(payload));
  }
  await call('game-updates:check', { gameId });
  await waitFor(`document.querySelector('.game-update-notice')?.textContent.includes('2 项更新')`, 'client and MI update badge');
  await evaluate(`document.querySelector('.game-update-notice').click()`);
  await waitFor(`document.querySelector('#settings-game-updates')?.textContent.includes('3.7.1')`, 'version details');
  const text = await evaluate(`document.querySelector('#settings-game-updates').textContent`);
  assert.match(text, /3\.7\.0/);
  assert.match(text, /3\.8\.0/);
  assert.match(text, /2\.5\.0/);
  assert.match(text, /XXMI Launcher/);
  assert.equal(requests, 1, 'opening details reuses the completed check');
  await evaluate(`document.querySelector('#settings-game-updates').scrollIntoView({ block: 'start' })`);
  await captureUI('game-updates.png');
  await evaluate(`document.querySelector('[aria-label="自动检查游戏与组件更新"]').click()`);
  await waitFor(`document.querySelector('[aria-label="自动检查游戏与组件更新"]').checked === false`, 'disable automatic checks');
  assert.equal(service.state(gameId).enabled, false);
  const checkButton = `[...document.querySelectorAll('#settings-game-updates button')].find(button => button.textContent === '检查游戏与组件更新')`;
  await evaluate(`${checkButton}.click()`);
  await waitFor(`${checkButton} && !${checkButton}.disabled && document.querySelector('.game-update-notice')?.textContent.includes('2 项更新')`, 'manual check while automatic checks are disabled');
  assert.equal(requests, 2);
  offline = true;
  await evaluate(`${checkButton}.click()`);
  await waitFor(`document.querySelector('#settings-game-updates')?.textContent.includes('无法连接官方版本来源')`, 'offline state is explicit');
  assert.equal(service.state(gameId).client.updateAvailable, false);
  assert.equal(service.state(gameId).components[0].updateAvailable, true, 'MI check is independent of client failure');
  passed('Game updates: client and MI badge, installed/latest versions, separate preload, persisted preferences, manual refresh and offline state');
};
