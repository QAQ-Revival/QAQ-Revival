const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

const value = (namespace, number) => `namespace = ${namespace}\n\n[Constants]\nglobal persist $dress = ${number}\n`;
function prepare({ profile, mods, endfield }) {
  const configPath = path.join(profile, 'config.json');
  const config = JSON.parse(fs.readFileSync(configPath));
  config.persistBridgeEnabled = true;
  config.persistBridgeCacheSize = 2;
  fs.writeFileSync(configPath, JSON.stringify(config));
  for (const directory of [mods, endfield]) {
    const root = path.dirname(directory);
    fs.mkdirSync(path.join(root, 'qaqm/cache'), { recursive: true });
    fs.writeFileSync(path.join(root, 'd3dx.ini'), '[Include]\n');
  }
  const gameRoot = path.dirname(mods);
  for (let i = 0; i < 205; i++) fs.writeFileSync(path.join(gameRoot, 'qaqm/cache', `qaqm_state_fixture_${i}.ini`), value(`QAQM\\Persist\\Fixture${i}`, i));
  fs.mkdirSync(path.join(gameRoot, 'qaqm_cache'), { recursive: true });
  fs.writeFileSync(path.join(gameRoot, 'qaqm_cache/qaqm_state_old_cache.ini'), value('QAQM\\Persist\\OldCache', 800));
  fs.writeFileSync(path.join(gameRoot, 'qaqm_state_old_root.ini'), value('QAQM\\Persist\\OldRoot', 900));
  fs.writeFileSync(path.join(path.dirname(endfield), 'qaqm/cache/qaqm_state_other.ini'), value('QAQM\\Persist\\Other', 777));
  const relative = '安可\\DISABLED_测试模组\\mod.ini';
  const hash = crypto.createHash('sha1').update(relative.replace('DISABLED_', '').toLowerCase()).digest('hex').slice(0, 12);
  const ini = path.join(mods, '安可/DISABLED_测试模组/mod.ini');
  const ns = `QAQM\\Persist\\Bridge_${hash}`;
  fs.writeFileSync(ini + '.qaqm-persistbak', '[Constants]\nglobal persist $dress = 0\n');
  fs.writeFileSync(ini, `; Persisted state is hosted by qaqm_state_${hash}.ini\n[Present]\n$\\${ns}\\dress = 1\n`);
  fs.writeFileSync(path.join(gameRoot, 'qaqm/cache', `qaqm_state_${hash}.ini`), value(ns, 42));
  fs.writeFileSync(path.join(gameRoot, 'd3dx_user.ini'), `[Constants]\n$\\${ns}\\dress = 42\n$\\Keep\\value = 123\n`);
  fs.writeFileSync(path.join(profile, 'mod-persist-state.json'), JSON.stringify({ scopes: { 'game:wuthering-waves': { '安可/旧保存': { files: [{ relativeIniPath: 'mod.ini', variables: { hair: 9 } }] } } } }));
  // Reproduce the same-directory EXDEV failure observed on the real configuration.
  const rename = fs.renameSync;
  fs.renameSync = (from, to) => {
    if ([configPath, path.join(profile, 'mod-persist-state.json')].includes(to)) throw Object.assign(Error('Synthetic config EXDEV'), { code: 'EXDEV' });
    return rename(from, to);
  };
}

async function run({ evaluate, waitFor, captureUI, window, profile, mods, endfield, handlers, passed }) {
  const startup = module.exports.finishStartup?.();
  assert.equal(startup?.iniReads, 0, 'Opening the manager must not scan Mod INIs');
  passed(`Manager startup: no Mod INIs read before the UI is ready (${startup.elapsedMs} ms in the isolated test)`);
  const call = (name, ...args) => handlers.get(name)({ sender: window.webContents }, ...args);
  const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const config = (await call('get-config')).config;
  assert.equal(config.persistBridgeByGame['wuthering-waves'].enabled, true);
  assert.equal(config.persistBridgeByGame.endfield.enabled, true);
  assert.ok(fs.existsSync(path.join(profile, 'config.json.before-per-game-persist.bak')));
  let list = await call('persist-bridge-list', 'wuthering-waves');
  assert.equal(list.success, true);
  assert.equal(list.entries.length, 209);
  assert.ok(list.entries.some(entry => entry.variables.some(variable => variable.value === '42')));
  assert.ok(list.entries.some(entry => entry.kind === 'legacy' && entry.variables[0].value === '9'));
  assert.equal((await call('persist-bridge-list', 'endfield')).entries.length, 1);
  passed('Old global settings, 208 bridge files (including both old directories), and legacy JSON contents are inherited');
  // Launch preparation is intercepted by the existing smoke harness; no actual game runs.
  await click('[aria-label="XXMI 启动"]');
  await waitFor(`!document.querySelector('[aria-label="XXMI 启动"]').disabled`, 'bridge prepared');
  const include = path.join(path.dirname(mods), 'qaqm/qaqm_persist_active.ini');
  assert.equal((fs.readFileSync(include, 'utf8').match(/^include\s*=/gm) || []).length, 208);
  const stateDir = path.join(path.dirname(mods), 'qaqm/cache');
  const snapshot = () => Object.fromEntries(fs.readdirSync(stateDir).filter(name => name.endsWith('.ini')).map(name => [name, fs.readFileSync(path.join(stateDir, name), 'utf8')]));
  const saved = snapshot();
  assert.equal((await call('persist-bridge-set-enabled', { gameId: 'wuthering-waves', enabled: false })).success, true);
  assert.deepEqual(snapshot(), saved);
  assert.equal((await call('persist-bridge-list', 'endfield')).game.enabled, true);
  assert.equal(fs.readFileSync(include, 'utf8'), '');
  assert.equal((await call('persist-bridge-set-enabled', { gameId: 'wuthering-waves', enabled: true })).success, true);
  await click('[aria-label="XXMI 启动"]');
  await waitFor(`!document.querySelector('[aria-label="XXMI 启动"]').disabled`, 'bridge re-enabled');
  assert.deepEqual(snapshot(), saved);
  passed('All 208 states are included with no cap; disable and re-enable preserve every value and the other game’s switch');
  await click('.sidebar-settings');
  await waitFor(`!!document.querySelector('[data-category="persist"]')`, 'state management category');
  await click('[data-category="persist"]');
  await waitFor(`document.querySelectorAll('[data-persist-game]').length >= 2`, 'game state cards');
  await captureUI('persist-games.png');
  await click('[aria-label="管理鸣潮保存内容"]');
  await waitFor(`!!document.querySelector('[data-persist-character="安可"]')`, 'character hierarchy');
  assert.equal(await evaluate(`document.querySelectorAll('[data-persist-entry]').length`), 0, 'Game overview does not show a flat file list');
  await captureUI('persist-characters.png');
  await click('[data-persist-character="安可"]');
  await waitFor(`document.querySelectorAll('[data-persist-mod]').length === 2`, 'Mods within the selected character');
  await captureUI('persist-mods.png');
  await evaluate(`(() => { const input = document.querySelector('[aria-label="搜索保存内容"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '测试模组'); input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await waitFor(`document.querySelectorAll('[data-persist-mod]').length === 1`, 'search within character');
  await click('[data-persist-mod="测试模组"]');
  await waitFor(`document.querySelectorAll('[data-persist-entry]').length === 1`, 'Mod saved configuration');
  assert.ok(await evaluate(`document.querySelector('.persist-variables').textContent.includes('42')`));
  await captureUI('persist-details.png');
  // This request reads only the selected Mod, even with hundreds of other saves.
  const readFile = fs.readFileSync, readPaths = [];
  fs.readFileSync = (file, ...args) => { readPaths.push(String(file)); return readFile(file, ...args); };
  try { assert.equal((await call('persist-bridge-mod', { gameId: 'wuthering-waves', characterName: '安可', modName: '测试模组' })).entries.length, 1); }
  finally { fs.readFileSync = readFile; }
  assert.equal(readPaths.some(file => file.endsWith('qaqm_state_fixture_200.ini')), false);
  await call('game:switch', 'endfield');
  await waitFor(`document.querySelector('.game-selector-trigger')?.textContent.includes('终末地')`, 'different sidebar game before jump');
  await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent === '打开 Mod 详情').click()`);
  await waitFor(`document.querySelector('.mod-persist-summary')?.textContent.includes('1 份配置')`, 'linked Mod detail persistence summary');
  assert.ok(await evaluate(`document.querySelector('.game-selector-trigger').textContent.includes('鸣潮')`));
  await evaluate(`document.querySelector('.mod-persist-summary > details > summary').click()`);
  assert.ok(await evaluate(`document.querySelector('.mod-persist-summary .persist-variables').textContent.includes('42')`));
  await captureUI('mod-persist-summary.png');
  await evaluate(`[...document.querySelectorAll('.mod-persist-summary button')].find(b => b.textContent === '打开状态管理').click()`);
  await waitFor(`document.querySelector('[data-persist-level="mod"] .persist-variables')?.textContent.includes('42')`, 'return directly to selected Mod persistence');
  const targetId = await evaluate(`document.querySelector('[data-persist-entry]').dataset.persistEntry`);
  const otherFile = path.join(path.dirname(endfield), 'qaqm/cache/qaqm_state_other.ini');
  const otherSaved = fs.readFileSync(otherFile);
  assert.equal((await call('persist-bridge-delete', { gameId: 'endfield', ids: [targetId] })).success, false);
  await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent === '删除此项').click()`);
  assert.ok(fs.existsSync(path.join(stateDir, targetId.slice('bridge:'.length))), 'confirmation does not delete');
  await evaluate(`[...document.querySelectorAll('.persist-confirm button')].find(b => b.textContent === '确认删除').click()`);
  await waitFor(`!document.querySelector('.persist-confirm') && document.querySelector('.persist-manager')?.getAttribute('aria-busy') === 'false'`, 'manual deletion complete');
  assert.equal(fs.existsSync(path.join(stateDir, targetId.slice('bridge:'.length))), false);
  assert.ok(fs.readFileSync(otherFile).equals(otherSaved));
  const userConstants = fs.readFileSync(path.join(path.dirname(mods), 'd3dx_user.ini'), 'utf8');
  assert.ok(!userConstants.includes('Bridge_'));
  assert.ok(userConstants.includes('$\\Keep\\value = 123'));
  assert.ok(fs.readFileSync(path.join(mods, '安可/DISABLED_测试模组/mod.ini'), 'utf8').includes('global persist $dress = 0'));
  assert.ok(fs.readdirSync(path.join(profile, 'persist-state-backups')).length > 0);
  passed('Game → character → Mod navigation, scoped reads, and bidirectional detail links preserve the target across game switches; confirmed deletion stays scoped');
  assert.equal((await call('persist-bridge-clear-cache', 'wuthering-waves')).success, true);
  assert.equal((await call('persist-bridge-list', 'wuthering-waves')).entries.length, 0);
  assert.ok(fs.readFileSync(otherFile).equals(otherSaved));
  assert.equal((await call('persist-bridge-set-enabled', { gameId: 'wuthering-waves', enabled: false })).success, true);
  assert.equal((await call('persist-bridge-list', 'wuthering-waves')).entries.length, 0);
  await window.loadFile(path.join(process.resourcesPath, 'app/out/renderer/index.html'));
  await waitFor(`!!document.querySelector('.sidebar-settings')`, 'renderer reload');
  assert.equal((await call('persist-bridge-list', 'wuthering-waves')).game.enabled, false);
  assert.equal((await call('persist-bridge-list', 'endfield')).entries.length, 1);
  assert.equal(JSON.parse(fs.readFileSync(path.join(profile, 'config.json'))).persistBridgeByGame['wuthering-waves'].enabled, false);
  assert.equal(Object.keys(JSON.parse(fs.readFileSync(path.join(profile, 'mod-persist-state.json'))).scopes['game:wuthering-waves']).length, 0);
  passed('Manual clear removes only the selected game’s data; settings and legacy JSON save successfully despite EXDEV');
}
module.exports = run;
module.exports.prepare = prepare;
module.exports.watchStartup = mods => {
  const read = fs.readFileSync;
  let iniReads = 0;
  const started = performance.now();
  fs.readFileSync = (file, ...args) => {
    if (String(file).startsWith(mods + path.sep) && /\.ini(?:\.qaqm-persistbak)?$/i.test(String(file))) iniReads++;
    return read(file, ...args);
  };
  module.exports.finishStartup = () => { fs.readFileSync = read; return { iniReads, elapsedMs: Math.round(performance.now() - started) }; };
};
