const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { deploy, planDeployment, MARKER } = require('../app/src/main/games/arknights/deployment.cjs');
const files = require('../app/src/main/games/arknights/files.cjs');
const root = path.resolve(__dirname, '../test-results');
fs.mkdirSync(root, { recursive: true });
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(root, 'arknights-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const library = path.join(dir, 'library'), mod = path.join(library, 'operator', 'mod');
  fs.mkdirSync(mod, { recursive: true });
  fs.writeFileSync(path.join(mod, 'illust_char_4215_buddy_mh#2.png'), 'image');
  return { dir, library, mod, destination: path.join(dir, 'runtime', 'M4A-Mods'), entries: [{ name: 'operator/mod', path: mod }] };
}
test('M4A deployment excludes metadata and nested disabled resources, removes disabled Mods and rolls back copy failures', t => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.mod, 'preview.png'), 'preview');
  fs.writeFileSync(path.join(f.mod, 'tags.json'), '{}');
  fs.mkdirSync(path.join(f.mod, 'DISABLED_variant'));
  fs.writeFileSync(path.join(f.mod, 'DISABLED_variant', 'old.ab'), 'old bundle');
  let renameAttempts = 0;
  assert.equal(deploy({ ...f, rename(from, to) {
    if (renameAttempts++ === 0) throw Object.assign(Error('temporary Windows sharing violation'), { code: 'EPERM' });
    fs.renameSync(from, to);
  } }).fileCount, 1);
  assert.equal(renameAttempts, 2);
  const old = fs.readFileSync(path.join(f.destination, MARKER), 'utf8');
  fs.writeFileSync(path.join(f.mod, 'new.png'), 'new');
  assert.throws(() => deploy({ ...f, copy() { throw Error('disk full'); } }), /disk full/);
  assert.equal(fs.readFileSync(path.join(f.destination, MARKER), 'utf8'), old);
  assert.equal(deploy({ ...f, entries: [] }).modCount, 0);
  assert.deepEqual(fs.readdirSync(f.destination), [MARKER]);
  assert.equal(fs.readFileSync(path.join(f.mod, 'preview.png'), 'utf8'), 'preview');
});
test('resource keys detect cross-Mod aliases, preserve front/back identities and block raw bundles', t => {
  const f = fixture(t), second = path.join(f.library, 'operator', 'second');
  fs.mkdirSync(second);
  fs.writeFileSync(path.join(second, 'char_4215_buddy_mh_2.png'), 'duplicate');
  assert.throws(() => planDeployment([...f.entries, { name: 'second', path: second }]));
  assert.notEqual(files.resourceKey('front_char_4215_buddy.png'), files.resourceKey('back_char_4215_buddy.png'));
  assert.equal(files.resourceKey('illust_char_4215_buddy[alphe].png'), files.resourceKey('char_4215_buddy_alpha.png'));
  fs.writeFileSync(path.join(f.mod, 'char_4215_buddy.ab'), 'UnityFS');
  assert.throws(() => files.assertLoadable(f.mod));
});
test('deployment refuses game writes, overlapping libraries, junctions and unowned destinations', t => {
  const f = fixture(t);
  assert.throws(() => deploy({ ...f, gamePath: path.join(f.dir, 'Arknights.exe') }));
  assert.throws(() => deploy({ ...f, destination: path.join(f.library, 'output') }));
  fs.mkdirSync(f.destination, { recursive: true });
  fs.writeFileSync(path.join(f.destination, 'existing.png'), 'user file');
  assert.throws(() => deploy(f));
  assert.equal(fs.readFileSync(path.join(f.destination, 'existing.png'), 'utf8'), 'user file');
  const link = path.join(f.dir, 'linked');
  fs.symlinkSync(f.mod, link, 'junction');
  assert.throws(() => files.walk(link));
});
test('Arknights appearances keep safe section IDs and exact legacy resource aliases', () => {
  const catalog = require('../runtime-resources/games/arknights/character-skins/catalog.json');
  require('../app/src/main/characters/skin-catalog-source.cjs').validateCatalog(catalog, 'arknights');
  const buddy = catalog.characters.find(character => character.characterId === 'char_4215_buddy');
  const skin = buddy.skins.find(skin => skin.nameZh === '露营时间喵！');
  assert(skin.aliases.includes('illust_char_4215_buddy_mh#2'));
  assert(skin.aliases.includes('illust_char_4215_buddy_mh_2'));
  assert.equal(skin.sectionId, 'skin:' + skin.id);
});
