const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');

const Module = require('node:module'), originalLoad = Module._load;
const fs = require('node:fs');
const testUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'qaqr-persist-test-'));
fs.mkdirSync(path.join(testUserData, 'logs'), { recursive: true });
process.on('exit', () => fs.rmSync(testUserData, { recursive: true, force: true }));
Module._load = function(request, ...args) {
  if (request !== 'electron') return originalLoad.call(this, request, ...args);
  return {
    app: { getPath: () => testUserData, getAppPath: () => path.resolve(__dirname, '..'), isPackaged: false },
    ipcMain: { handle() {}, on() {} },
    BrowserWindow: { getAllWindows: () => [] }
  };
};
const configStore = require('../app/src/main/config/store.cjs');
const persistIni = require('../app/src/main/persist/ini.cjs');
const persistLayout = require('../app/src/main/persist/layout.cjs');
const persistMigration = require('../app/src/main/persist/migration.cjs');
const persistTracking = require('../app/src/main/persist/tracking.cjs');
Module._load = originalLoad;

const declared = state => new Map(persistIni.parseLocalPersistDeclarations(state).map(d => [d.normalizedName, d.defaultValue]));
function migrateStateFor(iniContent, previousState, allIniContents) {
  const descriptor = { namespace: 'QAQM\\Persist\\Bridge_abc123', stateFileName: 'qaqm_state_abc123.ini' };
  const declarations = persistIni.parseLocalPersistDeclarations(iniContent);
  const references = persistIni.collectBridgeReferences(allIniContents);
  const merged = persistIni.mergeHostedPersistDeclarations(declarations, previousState, references, descriptor.namespace);
  const values = declared(previousState);
  return { descriptor, declarations, state: persistIni.buildPersistBridgeStateContent(descriptor, merged, values) };
}

test('re-migrating an INI that gained a new persist variable keeps the variables migrated earlier', () => {
  // Stage 1 of a staged mod repair: three persist variables, one later dropped from the mod.
  const v0 = 'namespace = Local\\Mod\\Feat\n[Constants]\nglobal persist $Tan = 0\nglobal persist $Glow = 20\nglobal persist $Gone = 1\n[Present]\nif $Tan == 1 && $Glow > 0 && $Gone\nendif\n';
  const first = migrateStateFor(v0, '', [v0]);
  const migrated = persistIni.applyPersistBridgeToIniContent(v0, first.descriptor, first.declarations);
  assert.match(migrated, /\$\\QAQM\\Persist\\Bridge_abc123\\Tan/);
  assert.deepEqual([...declared(first.state).keys()], ['tan', 'glow', 'gone']);

  // The player changed Glow; stage 2 then adds $Suit to the migrated INI (the backup was replaced)
  // and stops using $Gone. A menu INI elsewhere in the mod still references $Tan.
  const savedState = first.state.replace('$Glow = 20', '$Glow = 35');
  const stage2 = migrated.replace('[Constants]\n', '[Constants]\nglobal persist $Suit = 0\n').replace(' && $\\QAQM\\Persist\\Bridge_abc123\\Gone', '');
  const menu = '[CommandListClear]\n$\\QAQM\\Persist\\Bridge_abc123\\Tan = 0\n';
  const second = migrateStateFor(stage2, savedState, [stage2, menu]);
  const state = declared(second.state);
  assert.deepEqual(second.declarations.map(d => d.variableName), ['Suit']);
  assert.equal(state.get('tan'), '0', 'earlier declaration survives');
  assert.equal(state.get('glow'), '35', 'earlier value survives');
  assert.equal(state.get('suit'), '0', 'new declaration added');
  assert.equal(state.has('gone'), false, 'declarations nothing references are still pruned');
});

test('a backup without earlier declarations still yields a state file for every referenced variable', () => {
  const bak = '[Constants]\nglobal persist $Suit = 2\n';
  const current = '[Present]\nif $\\QAQM\\Persist\\Bridge_abc123\\Tan == 1 && $\\qaqm\\persist\\bridge_ABC123\\Suit\nendif\n';
  const references = persistIni.collectBridgeReferences([current]);
  const merged = persistIni.mergeHostedPersistDeclarations(persistIni.parseLocalPersistDeclarations(bak), '', references, 'QAQM\\Persist\\Bridge_abc123');
  assert.deepEqual(merged.map(d => [d.variableName, d.defaultValue]), [['Suit', '2'], ['Tan', '0']]);
});

test('without references the merge is the INI declarations unchanged', () => {
  const declarations = persistIni.parseLocalPersistDeclarations('[Constants]\nglobal persist $A = 1\n');
  const merged = persistIni.mergeHostedPersistDeclarations(declarations, 'global persist $Old = 3\n', new Map(), 'QAQM\\Persist\\Bridge_abc123');
  assert.deepEqual(merged, declarations);
});

test('external bridge reference rewriting matches regex semantics across large mapping sets without O(N*M) slowdown', () => {
  const mappings = [
    { originalNamespace: 'Author\\Shared', bridgeNamespace: 'QAQM\\Persist\\Bridge_111111', varNames: ['ColorMode', 'Alpha'] },
    { originalNamespace: 'Author\\Shared\\Sub', bridgeNamespace: 'QAQM\\Persist\\Bridge_222222', varNames: ['Toggle', 'Alpha'] },
    { originalNamespace: 'Author\\Shared', bridgeNamespace: 'QAQM\\Persist\\Bridge_333333', varNames: ['ColorMode', 'ExtraVar'] },
    { originalNamespace: 'X', bridgeNamespace: 'QAQM\\Persist\\Bridge_444444', varNames: ['SingleCharNs'] }
  ];
  for (let i = 0; i < 1500; i++) {
    mappings.push({
      originalNamespace: `ModPack\\Character${i}\\Menu_${i}`,
      bridgeNamespace: `QAQM\\Persist\\Bridge_${String(i).padStart(6, '0')}`,
      varNames: [`VarA_${i}`, `VarB_${i}`, 'CommonToggle']
    });
  }
  const sample = [
    '[Present]',
    'if $\\author\\shared\\colormode == 1 && $\\AUTHOR\\SHARED\\SUB\\alpha > 0',
    '  $\\Author\\Shared\\ExtraVar = $\\x\\singlecharns + $\\author\\shared\\colormode_suffix',
    '  $\\QAQM\\Persist\\Bridge_existing\\keep = $\\ModPack\\Character1499\\Menu_1499\\commonToggle',
    'endif',
    ''
  ].join('\n');
  const rewritten = persistIni.applyExternalBridgeRefsToIniContent(sample, mappings);
  assert.equal(
    rewritten,
    [
      '[Present]',
      'if $\\QAQM\\Persist\\Bridge_111111\\ColorMode == 1 && $\\QAQM\\Persist\\Bridge_222222\\Alpha > 0',
      '  $\\QAQM\\Persist\\Bridge_333333\\ExtraVar = $\\QAQM\\Persist\\Bridge_444444\\SingleCharNs + $\\author\\shared\\colormode_suffix',
      '  $\\QAQM\\Persist\\Bridge_existing\\keep = $\\QAQM\\Persist\\Bridge_001499\\CommonToggle',
      'endif',
      ''
    ].join('\n')
  );

  // Verify scaling across 500 large already-migrated INI files with 1,500 mappings.
  const migratedIni = Array.from({ length: 400 }, (_, i) => `$\\QAQM\\Persist\\Bridge_abcdef123456\\var_${i} = ${i}`).join('\n');
  const started = performance.now();
  for (let i = 0; i < 500; i++) {
    assert.equal(persistIni.applyExternalBridgeRefsToIniContent(migratedIni, mappings), migratedIni);
  }
  const elapsedMs = performance.now() - started;
  assert.ok(elapsedMs < 1500, `Expected fast indexed scan, took ${Math.round(elapsedMs)} ms`);
});

test('async persist migration keeps the event loop responsive and migrates cross-mod references and active includes', async t => {
  const base = path.resolve(__dirname, '../test-results');
  fs.mkdirSync(base, { recursive: true });
  const root = fs.mkdtempSync(path.join(base, 'persist-async-migration-'));
  const modsRoot = path.join(root, 'Mods');
  t.after(() => {
    persistLayout.preparedPersistBridgeRoots.delete(root);
    fs.rmSync(root, { recursive: true, force: true });
  });

  const previousConfig = configStore.currentConfig;
  const originalSave = configStore.saveConfig;
  configStore.saveConfig = () => true;
  configStore.currentConfig = {
    activeGameId: 'endfield',
    games: [{ id: 'endfield', name: 'Endfield', modFolderPath: modsRoot }],
    persistBridgeByGame: { endfield: { enabled: true } },
    persistBridgeTracking: {}
  };
  t.after(() => {
    configStore.currentConfig = previousConfig;
    configStore.saveConfig = originalSave;
  });

  // Create 80 already-migrated mods with .qaqm-persistbak namespaces plus one newly imported mod and one consumer mod.
  for (let i = 0; i < 80; i++) {
    const dir = path.join(modsRoot, '小刻', `ExistingMod_${i}`);
    fs.mkdirSync(dir, { recursive: true });
    const iniPath = path.join(dir, 'mod.ini');
    const desc = persistIni.buildPersistBridgeDescriptor(modsRoot, iniPath);
    const bak = `namespace = Pack\\Existing_${i}\n[Constants]\nglobal persist $toggle = 1\n[Present]\nif $toggle == 1\nendif\n`;
    const migrated = persistIni.applyPersistBridgeToIniContent(bak, desc, persistIni.parseLocalPersistDeclarations(bak));
    fs.writeFileSync(iniPath + '.qaqm-persistbak', bak, 'utf8');
    fs.writeFileSync(iniPath, migrated, 'utf8');
    const statePath = persistLayout.resolvePersistBridgeStatePath(root, desc.stateFileName);
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(statePath, persistIni.buildPersistBridgeStateContent(desc, persistIni.parseLocalPersistDeclarations(bak)), 'utf8');
  }

  const importedDir = path.join(modsRoot, '小刻', 'Kay_sportswear_full_V1.1');
  fs.mkdirSync(importedDir, { recursive: true });
  const importedIni = path.join(importedDir, 'Kay.ini');
  fs.writeFileSync(importedIni, 'namespace = Kay\\Sportswear\n[Constants]\nglobal persist $Jacket = 1\n[Present]\nif $Jacket == 1\nendif\n', 'utf8');

  const consumerDir = path.join(modsRoot, '小刻', 'AddonConsumer');
  fs.mkdirSync(consumerDir, { recursive: true });
  const consumerIni = path.join(consumerDir, 'Addon.ini');
  fs.writeFileSync(consumerIni, '[Present]\nif $\\kay\\sportswear\\jacket == 1 && $\\pack\\existing_42\\toggle == 1\nendif\n', 'utf8');

  let ticks = 0;
  const timer = setInterval(() => ticks++, 5);
  try {
    await persistMigration.ensurePersistBridgeMigrationForModDirsAsync(root, [importedDir]);
    await persistMigration.ensurePersistBridgeMigrationForActiveGameAsync(root);
    await persistTracking.rebuildActivePersistBridgeIncludesAsync(root);
  } finally {
    clearInterval(timer);
  }

  assert.ok(ticks > 0, 'Event loop continued ticking during async persist migration');
  const importedDesc = persistIni.buildPersistBridgeDescriptor(modsRoot, importedIni);
  const existing42Desc = persistIni.buildPersistBridgeDescriptor(modsRoot, path.join(modsRoot, '小刻', 'ExistingMod_42', 'mod.ini'));
  const migratedImported = fs.readFileSync(importedIni, 'utf8');
  const migratedConsumer = fs.readFileSync(consumerIni, 'utf8');
  assert.match(migratedImported, new RegExp(`\\$\\\\QAQM\\\\Persist\\\\Bridge_${importedDesc.hash}\\\\Jacket`));
  assert.match(migratedConsumer, new RegExp(`\\$\\\\QAQM\\\\Persist\\\\Bridge_${importedDesc.hash}\\\\Jacket`));
  assert.match(migratedConsumer, new RegExp(`\\$\\\\QAQM\\\\Persist\\\\Bridge_${existing42Desc.hash}\\\\toggle`));

  const activeInclude = fs.readFileSync(persistLayout.getQaqmBridgeFilePath(root, persistLayout.PERSIST_ACTIVE_INCLUDE_FILE), 'utf8');
  assert.equal((activeInclude.match(/^include\s*=/gm) || []).length, 81);
});
