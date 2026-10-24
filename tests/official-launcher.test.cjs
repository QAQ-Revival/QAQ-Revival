const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { isOfficialLauncherPath, resolveOfficialLauncherPath } = require('../app/src/main/games/official-launcher.cjs');

function fixture(t) {
  const directory = path.resolve(__dirname, '../test-results');
  fs.mkdirSync(directory, { recursive: true });
  const root = fs.mkdtempSync(path.join(directory, 'official-launcher-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const write = relative => {
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, 'Synthetic executable, never executed');
    return file;
  };
  return { root, write };
}

test('official launcher detection uses the game installation and preserves explicit selections', t => {
  const { root, write } = fixture(t);
  const nearby = write('miHoYo Launcher/launcher.exe');
  const selected = write('custom/launcher.exe');
  const game = { id: 'genshin-impact', gamePath: write('miHoYo Launcher/games/Genshin Impact Game/YuanShen.exe') };
  assert.equal(resolveOfficialLauncherPath(game, { roots: [root] }), nearby);
  game.officialLauncherPath = selected;
  assert.equal(resolveOfficialLauncherPath(game, { roots: [root] }), selected);
  fs.unlinkSync(selected);
  assert.equal(resolveOfficialLauncherPath(game, { roots: [root] }), '', 'a removed selection must not open another installation');
  assert.equal(isOfficialLauncherPath(game, game.gamePath), false, 'the game client is not the official launcher');
  assert.equal(isOfficialLauncherPath(game, write('XXMI Launcher.exe')), false);
  game.modLoaderPath = nearby;
  assert.equal(isOfficialLauncherPath(game, nearby), false, 'never open the configured Mod loader');
});

test('official detection handles a separate launcher and the nested NTE client', t => {
  const { root, write } = fixture(t);
  const shared = write('HoYoPlay/launcher.exe');
  for (const id of ['genshin-impact', 'zzz', 'honkai-star-rail']) {
    assert.equal(resolveOfficialLauncherPath({ id }, { roots: [root] }), shared);
  }
  fs.unlinkSync(shared);
  const hoyoplay = write('HoYoPlay/HoYoPlay.exe');
  assert.equal(resolveOfficialLauncherPath({ id: 'genshin-impact' }, { roots: [root] }), hoyoplay);
  assert.equal(isOfficialLauncherPath({ id: 'endfield' }, hoyoplay), false);
  const launcher = write('Neverness To Everness/NTELauncher/NTELauncher.exe');
  const game = { id: 'neverness-to-everness', gamePath: write('Neverness To Everness/Client/WindowsNoEditor/HT/Binaries/Win64/HTGame.exe') };
  assert.equal(resolveOfficialLauncherPath(game, { roots: [root] }), launcher);
  assert.equal(isOfficialLauncherPath(game, shared), false);
});

test('OFFICIAL opens only the official launcher without arguments or any Mod preparation', async t => {
  const { write } = fixture(t);
  const launcher = write('official/launcher.exe');
  const nteLauncher = write('official/NTELauncher.exe');
  let activeGame;
  let launchResult = { success: true };
  const requests = [];
  let handler;
  const unexpected = () => assert.fail('Official launch must not prepare or start a Mod component');
  const dependencies = {
    electron: { ipcMain: { handle: (channel, callback) => { assert.equal(channel, 'launch-game'); handler = callback; } } },
    '../../shared/i18n/core.cjs': { t: key => key },
    '../runtime/random-executable.cjs': { launchRandomExecutable: unexpected, getRandomLaunchSettings: unexpected },
    '../system/launch.cjs': { getDirectLaunchMode: unexpected },
    '../core/logger.cjs': { logger: { error() {}, warn() {}, info() {} } },
    './official-launcher.cjs': { resolveOfficialLauncherPath },
    './settings.cjs': { getActiveGame: () => activeGame, getResolvedActiveGamePaths: () => ({ gamePath: activeGame?.gamePath }) },
    '../system/windows.cjs': { windowsLauncher: { launch: async (file, cwd, args, options) => { requests.push({ file, cwd, args: Array.from(args), options }); return launchResult; } } }
  };
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../app/src/main/games/launch.cjs'), 'utf8'), {
    module, require: name => name === 'path' || name === 'fs' ? require(name) : dependencies[name] || new Proxy({}, { get: unexpected })
  });
  module.exports.registerIpc();
  for (const id of ['genshin-impact', 'endfield', 'zzz', 'wuthering-waves', 'honkai-star-rail', 'neverness-to-everness']) {
    activeGame = { id, officialLauncherPath: id === 'neverness-to-everness' ? nteLauncher : launcher,
      launchArgs: '--mod-only -dx11', wuwaDx12Enabled: true, genshinPreflightEnabled: true };
    assert.equal((await handler({}, { launchMode: 'OFFICIAL', gameId: id })).success, true);
    const request = requests.at(-1);
    assert.equal(request.file, activeGame.officialLauncherPath);
    assert.equal(request.cwd, path.dirname(request.file));
    assert.deepEqual(request.args, []);
    assert.equal(request.options.requireElevation, false);
  }
  const count = requests.length;
  assert.equal((await handler({}, { launchMode: 'OFFICIAL', gameId: 'endfield' })).success, false, 'reject stale game requests');
  assert.equal(requests.length, count);
  activeGame.officialLauncherPath = launcher;
  assert.equal((await handler({}, { launchMode: 'OFFICIAL' })).success, false, 'NTE must not use another game launcher');
  assert.equal(requests.length, count);
  activeGame = { id: 'endfield', officialLauncherPath: launcher };
  launchResult = { success: false, error: 'Launch rejected by the OS' };
  assert.equal((await handler({}, { launchMode: 'OFFICIAL' })).error, launchResult.error);
  launchResult = { success: true };
  assert.equal((await handler({}, { launchMode: 'OFFICIAL' })).success, true, 'release the launch lock after failure');
});
