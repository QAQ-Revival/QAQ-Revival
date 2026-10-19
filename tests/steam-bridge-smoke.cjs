const assert = require('node:assert/strict');
exports.fixture = root => {
  const requests = [], states = new Map();
  return { requests, states, runNative: async request => {
    requests.push(request);
    if (request.Action === 'status') return { success: true, games: request.Games.map(game => {
      const saved = states.get(game.GameId), previous = saved?.options || { launchMethod: game.GameId === 'endfield' ? 'official' : 'qaqr', channelId: game.GameId === 'endfield' ? 'bilibili' : 'official', launcher: root + '/launcher.exe', qaqrSteamManaged: false, autoSync: true };
      const options = { ...previous };
      for (const [key, native] of Object.entries({ launchMethod: 'LaunchMethod', channelId: 'ChannelId', launcher: 'Launcher', qaqrSteamManaged: 'QaqrSteamManaged', autoSync: 'AutoSync' })) if (game[native] != null) options[key] = game[native];
      return { gameId: game.GameId, installed: saved?.installed ?? game.GameId === 'endfield', phase: 'enabled', options,
        gamePath: root + '/Game/client.exe', steamRoot: root + '/Steam', clientReady: true, clientStatus: '客户端就绪', accountKnown: true, owned: true, metadataReady: true };
    }) };
    if (request.Action === 'apply') for (const game of request.Games) states.set(game.GameId, { installed: true, options: {
      launchMethod: game.LaunchMethod || 'official', channelId: game.ChannelId || 'bilibili', launcher: game.Launcher || root + '/launcher.exe', qaqrSteamManaged: game.QaqrSteamManaged || false, autoSync: game.AutoSync !== false } });
    if (request.Action === 'restore') states.set(request.Games[0].GameId, { ...states.get(request.Games[0].GameId), installed: false });
    return { success: true, message: request.Action === 'restore' ? '已撤回 Steam 桥接' : '已设置 / 同步 Steam 桥接' };
  } };
};
exports.run = async ({ electron, evaluate, waitFor, captureUI, passed, fixture }) => {
  const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const button = text => evaluate(`[...document.querySelectorAll('#settings-steam-bridge button')].find(b => b.textContent.trim() === ${JSON.stringify(text)}).click()`);
  await click('[aria-label="游戏设置"]');
  await waitFor(`!!document.querySelector('[aria-label="Steam 更新后自动同步"]') && !document.querySelector('#settings-steam-bridge').textContent.includes('正在处理')`, 'Steam bridge settings ready');
  assert.equal(fixture.requests.every(r => r.Action === 'status'), true);
  await click('[aria-label="Steam 桥接启动方式"] button:nth-child(2)');
  assert.equal(fixture.requests.every(r => r.Action === 'status'), true);
  electron.dialog.showMessageBox = async () => ({ response: 0 });
  await button('设置 / 同步当前游戏');
  await waitFor(`!document.querySelector('#settings-steam-bridge').textContent.includes('正在处理')`, 'canceled Steam apply');
  assert.equal(fixture.requests.every(r => r.Action === 'status'), true);
  electron.dialog.showMessageBox = async () => ({ response: 1 });
  await button('一键设置 / 同步两款');
  await waitFor(`document.querySelector('#settings-steam-bridge').textContent.includes('已设置 Steam 桥接') && !document.querySelector('#settings-steam-bridge').textContent.includes('正在处理')`, 'batch configured');
  const apply = fixture.requests.find(r => r.Action === 'apply');
  assert.equal(apply.Games.length, 2); assert.equal(apply.Games.find(g => g.GameId === 'endfield').LaunchMethod, null);
  assert.equal(apply.Games.find(g => g.GameId === 'wuthering-waves').LaunchMethod, 'official');
  await evaluate(`document.querySelector('#settings-steam-bridge').scrollIntoView({block:'start'})`);
  await captureUI('steam-bridge-settings.png');
  await button('撤回当前游戏');
  await waitFor(`document.querySelector('#settings-steam-bridge').textContent.includes('已撤回 Steam 桥接') && !document.querySelector('#settings-steam-bridge').textContent.includes('正在处理')`, 'current game restored');
  assert.equal(fixture.states.get('endfield').installed, true);
  assert.equal(fixture.states.get('wuthering-waves').installed, false);
  passed('Steam bridge uses real UI/IPC: read-only detection, canceled mutations, preserved batch modes, per-game restore and automatic-sync controls');
};
