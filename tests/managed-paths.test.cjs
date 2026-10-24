const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { remapManagedPaths, readManagedPathMappings, repairManagedRuntimeFiles } = require('../app/src/main/runtime/managed-paths.cjs');

test('migrated roots update live game references, path-keyed state and fixer paths while keeping custom directories', () => {
  const game = { modFolderPath: 'D:\\XXMI\\WWMI\\Mods', modLoaderPath: 'd:/xxmi/Resources/Bin/XXMI Launcher.exe' };
  const config = { games: [game], persistBridgeTracking: {
    'd:\\xxmi\\efmi': { enabledStateFiles: ['old.ini'], recentStateFiles: ['keep.ini'] },
    'd:\\qaq-revival\\data\\xxmi\\efmi': { enabledStateFiles: ['new.ini'], recentStateFiles: ['keep.ini'] }
  }, last_folder: 'D:\\XXMI', custom: 'E:\\User Mods', unrelated: 'D:\\XXMI-other\\Mods', outside: 'D:\\XXMI\\..\\Another' };
  const mappings = [{ from: 'D:\\XXMI', to: 'D:\\QAQ-Revival\\data\\XXMI' }];
  assert.ok(remapManagedPaths(config, mappings).changes > 0);
  assert.equal(config.games[0], game, 'existing main-process game references must remain current');
  assert.equal(game.modFolderPath, 'D:\\QAQ-Revival\\data\\XXMI\\WWMI\\Mods');
  assert.equal(game.modLoaderPath, 'D:/QAQ-Revival/data/XXMI/Resources/Bin/XXMI Launcher.exe');
  assert.deepEqual(config.persistBridgeTracking['d:\\qaq-revival\\data\\xxmi\\efmi'].enabledStateFiles, ['new.ini', 'old.ini']);
  assert.deepEqual(config.persistBridgeTracking['d:\\qaq-revival\\data\\xxmi\\efmi'].recentStateFiles, ['keep.ini']);
  assert.equal(config.last_folder, 'D:\\QAQ-Revival\\data\\XXMI');
  assert.equal(config.custom, 'E:\\User Mods');
  assert.equal(config.unrelated, 'D:\\XXMI-other\\Mods');
  assert.equal(config.outside, 'D:\\XXMI\\..\\Another');
  assert.equal(remapManagedPaths(config, mappings).changes, 0);
});

test('only a verified managed installation enables persistent and runtime JSON migration', t => {
  const base = path.resolve('test-results'); fs.mkdirSync(base, { recursive: true });
  const root = fs.mkdtempSync(path.join(base, 'managed-paths-'));
  t.after(() => { assert.equal(path.dirname(root), base); fs.rmSync(root, { recursive: true, force: true }); });
  const dataRoot = path.join(root, 'installed/data'), profile = path.join(root, 'installed-profile');
  const write = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value)); };
  const marker = path.join(dataRoot, 'XXMI/.qaqr-managed.json');
  write(marker, { protocol: 1, owner: 'QAQ-Revival', migratedFrom: 'D:\\XXMI' });
  assert.deepEqual(readManagedPathMappings(dataRoot), [], 'a marker without the migrated executable is insufficient');
  write(path.join(dataRoot, 'XXMI/Resources/Bin/XXMI Launcher.exe'), 'fixture, never executed');
  const fixer = path.join(profile, 'fix/wuthering-waves/independent/settings.json');
  const cache = path.join(dataRoot, 'XXMI/Resources/Cache/Ini Optimizer/WWMI.json');
  const history = path.join(profile, 'persist-state-backups/example/entries.json');
  write(fixer, { last_folder: 'D:\\XXMI\\WWMI\\Mods', otherPreference: true });
  write(cache, { 'D:\\XXMI\\WWMI\\Mods\\test.ini': 123 });
  write(history, { source: 'D:\\XXMI\\WWMI\\Mods\\old.ini' });
  const result = repairManagedRuntimeFiles(profile, dataRoot, readManagedPathMappings(dataRoot), { backupRoot: path.join(root, 'small-config-backup') });
  assert.equal(result.errors.length, 0);
  assert.equal(result.updated.length, 2);
  const newRoot = path.win32.join(dataRoot, 'XXMI');
  assert.equal(JSON.parse(fs.readFileSync(fixer)).last_folder, path.win32.join(newRoot, 'WWMI/Mods'));
  assert.deepEqual(JSON.parse(fs.readFileSync(cache)), { [path.win32.join(newRoot, 'WWMI/Mods/test.ini')]: 123 });
  assert.equal(JSON.parse(fs.readFileSync(history)).source, 'D:\\XXMI\\WWMI\\Mods\\old.ini');
  assert.equal(repairManagedRuntimeFiles(profile, dataRoot, readManagedPathMappings(dataRoot)).updated.length, 0);
});
