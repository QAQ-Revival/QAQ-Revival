const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');

const Module = require('node:module'), originalLoad = Module._load;
Module._load = function(request, ...args) {
  if (request !== 'electron') return originalLoad.call(this, request, ...args);
  return { app: { getPath: () => os.tmpdir(), getAppPath: () => path.resolve(__dirname, '..'), isPackaged: false } };
};
const persistIni = require('../app/src/main/persist/ini.cjs');
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
