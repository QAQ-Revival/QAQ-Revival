const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { compareVersions, localClient, checkClient } = require('../app/src/main/games/update-versions.cjs');
const { createGameUpdates } = require('../app/src/main/games/updates.cjs');

function fixture(t) {
  const results = path.resolve(__dirname, '../test-results');
  fs.mkdirSync(results, { recursive: true });
  const root = fs.mkdtempSync(path.join(results, 'game-updates-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const write = (name, data) => {
    const file = path.join(root, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, data);
    return file;
  };
  return { root, write };
}
const reply = value => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
const branches = (tag = '7.2.0', preload = '7.3.0') => ({ retcode: 0, data: { game_branches: [{ game: { id: '1Z8W5NHUQb', biz: 'hk4e_cn' }, main: { tag }, pre_download: { tag: preload } }] } });

test('version comparisons reject unknown versions and compare numeric segments', () => {
  assert.equal(compareVersions('7.10.0', '7.9.0'), 1);
  assert.equal(compareVersions('1.2', '1.2.0'), 0);
  for (const value of ['', 'X.X.X', '1.2.0-beta', 'garbage']) assert.equal(compareVersions('1.2.0', value), null);
});

test('HoYoPlay uses live Sophon branches and keeps pre-downloads separate', async t => {
  const { write } = fixture(t);
  const game = { id: 'genshin-impact', gamePath: write('game/YuanShen.exe', 'synthetic') };
  write('game/config.ini', '[General]\ngame_version=7.1.0\nchannel=1\n');
  const local = localClient(game);
  assert.equal(local.region, 'cn');
  const calls = [];
  const result = await checkClient(game, local, async (url, options) => {
    calls.push({ url, options });
    return reply(branches());
  });
  assert.equal(result.state, 'available');
  assert.equal(result.latest, '7.2.0');
  assert.equal(result.preDownload, '7.3.0');
  assert.match(calls[0].url, /getGameBranches/);
  assert.doesNotMatch(calls[0].url, /getGamePackages/);
  assert.equal(calls[0].options.credentials, 'omit');
  assert.equal(calls[0].options.redirect, 'error');
  const current = await checkClient(game, { ...local, installed: '7.2.0' }, async () => reply(branches()));
  assert.equal(current.updateAvailable, false, 'pre-download is not a live update');
  assert.equal(current.state, 'current');
  assert.equal((await checkClient(game, { ...local, installed: '7.4.0' }, async () => reply(branches()))).state, 'ahead');
});

test('each HoYo game and server selects its own official branch', async () => {
  for (const [id, region, remoteId] of [['genshin-impact', 'global', 'gopR6Cufr3'], ['honkai-star-rail', 'cn', '64kMb5iAWu'], ['honkai-star-rail', 'global', '4ziysqXOQ8'], ['zzz', 'cn', 'x6znKlJ0xK'], ['zzz', 'global', 'U5hbdsT9W7']]) {
    const result = await checkClient({ id }, { state: 'unknown', installed: '1.0.0', region }, async url => {
      assert.equal(new URL(url).searchParams.get('game_ids[]'), remoteId);
      return reply({ retcode: 0, data: { game_branches: [{ game: { id: remoteId }, main: { tag: '2.0.0' } }] } });
    });
    assert.equal(result.state, 'available');
  }
});

test('WuWa reads installed common resources instead of the stale base version', async t => {
  const { write } = fixture(t);
  const game = { id: 'wuthering-waves', gamePath: write('wuwa/Client/Binaries/Win64/Client-Win64-Shipping.exe', 'synthetic') };
  write('wuwa/launcherDownloadConfig.json', JSON.stringify({ appId: '10003', version: '3.7.0', state: '', bundles: { UHD: { version: '3.7.1', state: '' } } }));
  write('wuwa/launcherDownloadConfig/common.json', JSON.stringify({ packName: 'common', version: '3.7.1' }));
  const local = localClient(game);
  assert.equal(local.installed, '3.7.1');
  assert.equal(local.region, 'cn');
  const result = await checkClient(game, local, async url => {
    assert.match(url, /\/10003_[^/]+\/G152\/official\//);
    return reply({ resourcePacks: { common: { version: '3.7.1' } }, predownload: { resourcePacks: { common: { version: '3.8.0' } } } });
  });
  assert.equal(result.state, 'current');
  write('wuwa/launcherDownloadConfig.json', JSON.stringify({ appId: '10003', version: '3.7.0', state: 'downloading' }));
  assert.equal(localClient(game).state, 'incomplete');
});

test('WuWa follows the selected launcher public metadata and rejects obsolete or foreign URLs', async t => {
  const { write } = fixture(t);
  const game = { id: 'wuthering-waves', gamePath: write('Kuro/Game/Wuthering Waves.exe', 'synthetic') };
  write('Kuro/Game/launcherDownloadConfig.json', JSON.stringify({ appId: '50004', version: '3.8.0' }));
  const source = 'https://prod-alicdn-gamestarter.kurogame.com/launcher/game/50004_PublicReleaseKey/G153/official/index.json';
  const setSource = url => {
    const bytes = Buffer.from(JSON.stringify({ games: [{ gameId: 'G153', resId: '50004', configUrl: url }] }));
    for (let index = 0; index < bytes.length; index++) bytes[index] ^= 0x63;
    write('Kuro/3.1.0.1/Assets/KRApp.conf', bytes.toString('base64'));
  };
  setSource(source);
  const local = localClient(game);
  assert.equal(local.source, source);
  assert.equal(local.region, 'global');
  assert.equal((await checkClient(game, local, async url => {
    assert.equal(url, source);
    return reply({ resourcePacks: { common: { version: '3.8.0' } } });
  })).state, 'current');
  for (const url of ['https://example.com/launcher/game/50004_Key/G153/official/index.json', 'https://prod-alicdn-gamestarter.kurogame.com/launcher/game/G153/50004_OldKey/index.json']) {
    setSource(url);
    assert.equal(localClient(game).source, undefined);
    assert.equal((await checkClient(game, localClient(game), () => assert.fail('must not use the obsolete global index'))).state, 'unsupported');
  }
});

test('Hypergryph verifies matching manifests and never calls a mismatch an upgrade', async t => {
  const { write } = fixture(t);
  const game = { id: 'endfield', gamePath: write('Hypergryph Launcher/games/Endfield/Endfield.exe', 'synthetic') };
  const manifest = 'official encrypted installation manifest';
  write('Hypergryph Launcher/games/Endfield/game_files', manifest);
  const hash = crypto.createHash('md5').update(manifest).digest('hex');
  const fetch = async (_, options) => {
    const request = JSON.parse(options.body).proxy_reqs[0].get_latest_game_req;
    assert.equal(request.appcode, '6LL0KJuqHBVz33WK');
    assert.equal(request.channel, '1');
    return reply({ proxy_rsps: [{ get_latest_game_rsp: { version: '1.6.4', pkg: { game_files_md5: hash } } }] });
  };
  const current = await checkClient(game, localClient(game), fetch);
  assert.equal(current.state, 'current');
  assert.equal(current.installed, '1.6.4');
  const mismatch = await checkClient(game, { ...localClient(game), manifestHash: 'a'.repeat(32) }, fetch);
  assert.equal(mismatch.state, 'verify');
  assert.equal(mismatch.updateAvailable, false);
  const ak = { id: 'arknights', gamePath: write('Arknights/Arknights.exe', 'synthetic') };
  write('Arknights/game_files', Buffer.alloc(16));
  assert.equal(localClient(ak).manifestHash, '', 'an encrypted empty manifest is not version evidence');
});

test('unknown regions, unsupported channels, invalid replies and offline checks stay explicit', async t => {
  const { write } = fixture(t);
  const game = { id: 'zzz', gamePath: write('game/ZenlessZoneZero.exe', 'synthetic') };
  const local = localClient(game);
  assert.equal(local.state, 'regionRequired');
  assert.equal((await checkClient(game, local, () => assert.fail('must not guess the server'))).state, 'regionRequired');
  const ready = { ...local, state: 'unknown', region: 'cn' };
  assert.equal((await checkClient(game, ready, async () => reply({}))).state, 'error');
  assert.equal((await checkClient(game, ready, async () => { throw Error('offline'); })).updateAvailable, false);
  assert.equal((await checkClient(game, { ...ready, region: 'bilibili' }, () => assert.fail('unsupported endpoint'))).state, 'unsupported');
});

test('checks coalesce, cache for one hour, persist preferences and isolate MI failures', async t => {
  const { root, write } = fixture(t);
  const game = { id: 'genshin-impact', gamePath: write('game/YuanShen.exe', 'synthetic'), modLoaderPath: 'XXMI Launcher.exe' };
  write('game/config.ini', '[General]\ngame_version=7.1.0\n');
  let requests = 0, miRequests = 0, time = 10000000;
  const options = { userData: root, getGame: id => id === game.id ? game : null, supportsMi: () => true, now: () => time,
    fetch: async () => { requests++; return reply(branches()); },
    checkMi: async () => { miRequests++; throw Error('offline'); } };
  const service = createGameUpdates(options);
  const states = await Promise.all([service.check({ gameId: game.id }), service.check({ gameId: game.id })]);
  assert.equal(requests, 1);
  assert.equal(miRequests, 1);
  assert.equal(states[0].client.updateAvailable, true);
  assert.equal(states[0].miError, 'checkFailed');
  await service.check({ gameId: game.id });
  assert.equal(requests, 1);
  await service.check({ gameId: game.id, manual: true });
  assert.equal(requests, 2);
  time += 3600000;
  await service.check({ gameId: game.id });
  assert.equal(requests, 3);
  service.configure({ gameId: game.id, enabled: false, region: 'cn' });
  const restarted = createGameUpdates(options);
  assert.equal(restarted.state(game.id).enabled, false);
  await restarted.check({ gameId: game.id });
  assert.equal(requests, 3);
  await restarted.check({ gameId: game.id, manual: true });
  assert.equal(requests, 4);
  write('game/config.ini', '[General]\ngame_version=7.2.0\n');
  assert.equal(restarted.state(game.id).client.latest, '', 'a changed installation invalidates old comparisons');
});

test('a region change during a check cannot publish the former server result', async t => {
  const { root, write } = fixture(t);
  const game = { id: 'genshin-impact', gamePath: write('game/YuanShen.exe', 'synthetic') };
  write('game/config.ini', '[General]\ngame_version=7.1.0\n');
  let resolve;
  const response = new Promise(done => { resolve = done; });
  const service = createGameUpdates({ userData: root, getGame: () => game, supportsMi: () => false, fetch: () => response });
  const pending = service.check({ gameId: game.id });
  service.configure({ gameId: game.id, region: 'global', enabled: false });
  resolve(reply(branches()));
  await pending;
  assert.equal(service.state(game.id).region, 'global');
  assert.equal(service.state(game.id).client.latest, '');
});
