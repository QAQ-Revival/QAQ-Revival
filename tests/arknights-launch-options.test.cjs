const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { OPTIONS, createLaunchOption } = require('../app/src/main/games/arknights/launch-option.cjs');

function fixture(t, name) {
  const base = path.resolve(__dirname, '../test-results');
  fs.mkdirSync(base, { recursive: true });
  const root = fs.mkdtempSync(path.join(base, `arknights-${name}-`));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const gamePath = path.join(root, 'Arknights.exe');
  fs.writeFileSync(gamePath, 'not executed');
  const game = { gamePath, favorite: 'preserve me' };
  const flags = { capabilities: Object.values(OPTIONS).map(option => option.capability), running: false };
  const component = {
    packageInfo: () => ({ manifest: { capabilities: flags.capabilities } }),
    runNative: async args => { assert.deepEqual(args, ['--status']); return { success: true, running: flags.running }; }
  };
  const create = option => createLaunchOption(option, { getGame: () => game, saveEnabled: enabled => { game[OPTIONS[option].field] = enabled; }, component });
  return { game, gamePath, flags, service: OPTIONS[name] ? create(name) : null, create };
}

for (const [name, argument, field] of [['window', '--resizable-window', 'arknightsResizableWindow'], ['mouse', '--coalesce-mouse', 'arknightsCoalesceMouse']]) {
  test(`${name} switch defaults off, persists only its field and reaches the launch arguments`, async t => {
    const { service, game, gamePath } = fixture(t, name);
    assert.equal((await service.status()).enabled, false);
    assert.deepEqual(service.launchArguments(), []);
    assert.equal((await service.setEnabled({ enabled: true, gamePath })).enabled, true);
    assert.equal(game[field], true);
    assert.deepEqual(service.launchArguments(), [argument]);
    assert.equal((await service.status()).enabled, true);
    await service.setEnabled({ enabled: false, gamePath });
    assert.deepEqual(service.launchArguments(), []);
    assert.equal(game.favorite, 'preserve me');
    assert.deepEqual(Object.keys(game).sort(), ['favorite', 'gamePath', field].sort());
  });

  test(`${name} switch rejects running games, stale paths and incompatible loaders; old loaders still allow turning it off`, async t => {
    const { service, flags, game, gamePath } = fixture(t, name);
    flags.running = true;
    await assert.rejects(service.setEnabled({ enabled: true, gamePath }), /退出|Close/);
    flags.running = false;
    await assert.rejects(service.setEnabled({ enabled: true, gamePath: gamePath + '.other' }), /变化|changed/);
    await assert.rejects(service.setEnabled({ enabled: 'true', gamePath }), /路径|path/);
    flags.capabilities = flags.capabilities.filter(capability => capability !== OPTIONS[name].capability);
    await assert.rejects(service.setEnabled({ enabled: true, gamePath }), /组件|component/);
    game[field] = true;
    assert.throws(() => service.launchArguments(), /组件|component/);
    await service.setEnabled({ enabled: false, gamePath });
    assert.deepEqual(service.launchArguments(), []);
  });
}

test('launch options are independent and combine into one loader command', async t => {
  const { gamePath, create, game, flags } = fixture(t, 'combined');
  const window = create('window'), mouse = create('mouse');
  await mouse.setEnabled({ enabled: true, gamePath });
  assert.deepEqual([...window.launchArguments(), ...mouse.launchArguments()], ['--coalesce-mouse']);
  await window.setEnabled({ enabled: true, gamePath });
  assert.deepEqual([...window.launchArguments(), ...mouse.launchArguments()], ['--resizable-window', '--coalesce-mouse']);
  // A loader that only knows window resizing keeps that switch working.
  flags.capabilities = [OPTIONS.window.capability];
  assert.deepEqual(window.launchArguments(), ['--resizable-window']);
  assert.throws(() => mouse.launchArguments(), /组件|component/);
  assert.equal((await mouse.status()).supported, false);
  assert.equal(game.arknightsResizableWindow, true);
  assert.throws(() => createLaunchOption('unknown', { getGame: () => game, saveEnabled() {}, component: {} }), /Unknown/);
});
