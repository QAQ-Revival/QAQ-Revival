const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createEffService } = require('../app/src/main/games/endfield/eff.cjs');
function fixture(t, { installed = true } = {}) {
  const temporary = fs.realpathSync(os.tmpdir()), root = fs.mkdtempSync(path.join(temporary, 'qaqr-eff-mods-'));
  t.after(() => { assert.equal(path.dirname(fs.realpathSync(root)), temporary); fs.rmSync(root, { recursive: true, force: true }); });
  const write = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, value); return file; };
  const game = path.join(root, 'game'), storage = path.join(root, 'data/EFF');
  const gamePath = write(path.join(game, 'Endfield.exe'), 'Synthetic game, never executed');
  if (installed) {
    write(path.join(storage, 'eff.dll'), 'eff runtime EFF_ExternalData_v1');
  }
  const trashed = [];
  const service = createEffService({
    resolveGame: () => ({ gamePath }),
    storageRoot: storage,
    packages: { selected: () => ({ version: '2.0.12', sha256: 'a'.repeat(64) }), pending: () => null, state: () => ({}) },
    assertStopped: async () => {},
    stateFile: path.join(root, 'state/state.json'),
    backupDir: path.join(root, 'state/backup'),
    trash: async target => { trashed.push(target); fs.rmSync(target, { recursive: true, force: true }); },
    extract: async () => {},
    systemRoot: 'C:\\Windows'
  });
  return { root, game, write, service, trashed, mods: path.join(storage, 'Mods') };
}

test('an unused EFF service does not block the normal launcher before the game is configured', async t => {
  const f = fixture(t, { installed: false });
  fs.unlinkSync(path.join(f.game, 'Endfield.exe'));
  assert.deepEqual(await f.service.prepareLaunch(), { changed: false });
});

test('a character lists the EFF Mods in its own folder of data/EFF/Mods', t => {
  const f = fixture(t);
  f.write(path.join(f.mods, '佩丽卡/泳装/mod.ini'), '[Mod]\nformat=3\nid=Swim\n[KeyStyle]\nkey=F7\n');
  f.write(path.join(f.mods, '佩丽卡/泳装/preview.png'), 'png');
  f.write(path.join(f.mods, '佩丽卡/礼服/mod.ini.disable'), '[Mod]\nformat=3\n');
  f.write(path.join(f.mods, '佩丽卡/说明/readme.txt'), 'not a Mod');
  f.write(path.join(f.mods, '佩丽卡/.staging/mod.ini'), '[Mod]\nformat=3\n');
  f.write(path.join(f.mods, '管理员/默认/mod.ini'), '[Mod]\nformat=3\n');
  f.write(path.join(f.mods, 'Loose/mod.ini'), '[Mod]\nformat=3\n');
  const mods = f.service.characterMods('佩丽卡');
  assert.deepEqual(mods.map(mod => [mod.folder, mod.enabled]).sort(), [['泳装', true], ['礼服', false]]);
  const swim = mods.find(mod => mod.folder === '泳装');
  assert.deepEqual(swim.keys, ['F7']);
  assert.equal(swim.preview, path.join(f.mods, '佩丽卡/泳装/preview.png'));
  assert.deepEqual(f.service.characterMods('没有的角色'), []);
  assert.throws(() => f.service.characterMods('../plugin'));
  assert.deepEqual(f.service.unassignedMods().map(mod => mod.id), ['Loose']);
  // A name listed with the collision suffix still resolves to its folder.
  assert.equal(f.service.resolveCharacterMod('佩丽卡', '泳装 (EFF)', ' (EFF)').folder, '泳装');
  assert.equal(f.service.resolveCharacterMod('佩丽卡', '..', ' (EFF)'), null);
  assert.equal(f.service.resolveCharacterMod('佩丽卡', '说明'), null);
});

test('EFF Mods of a character switch, rename, take a PNG preview and go to the bin', async t => {
  const f = fixture(t);
  f.write(path.join(f.mods, '佩丽卡/泳装/mod.ini'), '[Mod]\nformat=3\n');
  let mod = f.service.resolveCharacterMod('佩丽卡', '泳装');
  f.service.setCharacterModEnabled(mod, false);
  assert.ok(fs.existsSync(path.join(f.mods, '佩丽卡/泳装/mod.ini.effmm-disabled')));
  mod = f.service.resolveCharacterMod('佩丽卡', '泳装');
  assert.equal(mod.enabled, false);
  f.service.setCharacterModEnabled(mod, true);
  assert.ok(fs.existsSync(path.join(f.mods, '佩丽卡/泳装/mod.ini')));
  f.write(path.join(f.mods, '佩丽卡/礼服/mod.ini'), '[Mod]\nformat=3\n');
  assert.throws(() => f.service.renameCharacterMod(mod, '礼服'));
  assert.throws(() => f.service.renameCharacterMod(mod, '../逃出'));
  const renamed = f.service.renameCharacterMod(mod, '夏日泳装');
  assert.equal(renamed.path, path.join(f.mods, '佩丽卡/夏日泳装'));
  mod = f.service.resolveCharacterMod('佩丽卡', '夏日泳装');
  f.write(path.join(mod.path, 'Preview.PNG'), 'old');
  const preview = f.service.setCharacterModPreview(mod, Buffer.from('new png'));
  assert.equal(preview, path.join(mod.path, 'preview.png'));
  assert.deepEqual(fs.readdirSync(mod.path).filter(name => /png$/i.test(name)), ['preview.png']);
  await f.service.removeCharacterMod(mod);
  assert.deepEqual(f.trashed, [mod.path]);
});

test('an import holding an EFF Mod moves to that character, and needs EFF installed', t => {
  const f = fixture(t);
  const efmi = f.write(path.join(f.root, 'efmi/Mods/佩丽卡/新 Mod/mod.ini'), '[TextureOverrideBody]\nhash = 12345678\n');
  assert.equal(f.service.adoptImported('佩丽卡', path.dirname(efmi), '新 Mod'), null, 'an EFMI Mod stays where the importer put it');
  const eff = path.dirname(f.write(path.join(f.root, 'efmi/Mods/佩丽卡/泳装/mod.ini'), '[Mod]\nformat=3\n'));
  f.write(path.join(eff, 'meshes/body.effres'), 'mesh');
  f.write(path.join(f.mods, '佩丽卡/泳装/mod.ini'), '[Mod]\nformat=3\n');
  const adopted = f.service.adoptImported('佩丽卡', eff, '泳装');
  assert.deepEqual(adopted, { name: '泳装 (2)', path: path.join(f.mods, '佩丽卡/泳装 (2)') });
  assert.equal(fs.existsSync(eff), false);
  assert.ok(fs.existsSync(path.join(adopted.path, 'meshes/body.effres')));
  // A pack of EFF Mods without a mod.ini of its own is still recognised.
  const pack = path.join(f.root, 'efmi/Mods/佩丽卡/合集');
  f.write(path.join(pack, 'A/mod.ini'), '[Mod]\nformat=3\n');
  assert.equal(f.service.isEffModDir(pack), true);

  const bare = fixture(t, { installed: false });
  const dir = path.dirname(bare.write(path.join(bare.root, 'import/mod.ini'), '[Mod]\nformat=3\n'));
  assert.throws(() => bare.service.adoptImported('佩丽卡', dir, 'x'), /EFF/);
  assert.ok(fs.existsSync(dir), 'nothing moves when EFF is missing');
  assert.deepEqual(bare.service.characterMods('佩丽卡'), []);
});
