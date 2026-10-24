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

test('bundle-scoped resources keep distinct objects separate, share identical files and preserve bindings during deployment', t => {
  const f = fixture(t), second = path.join(f.library, 'operator', 'second');
  fs.mkdirSync(second);
  const filename = 'illust_char_4215_buddy_mh#2.png';
  const manifest = (root, bundle) => fs.writeFileSync(path.join(root, files.RESOURCE_MANIFEST), JSON.stringify({ schemaVersion: 1, resources: [{ file: filename, target: filename, bundle }] }));
  manifest(f.mod, 'skinpack/char_4215_buddy.ab');
  fs.writeFileSync(path.join(second, filename), 'other object');
  manifest(second, 'arts/dynchars/char_4215_buddy_mh#2.ab');
  const entries = [...f.entries, { path: second, name: 'second' }];
  assert.equal(planDeployment(entries).length, 2);
  assert.equal(deploy({ ...f, entries }).fileCount, 2);
  assert.equal(files.readBindings(f.destination).bindings.size, 2);
  manifest(second, 'skinpack/char_4215_buddy.ab');
  assert.throws(() => planDeployment(entries));
  fs.writeFileSync(path.join(second, filename), 'image');
  assert.equal(planDeployment(entries).length, 2);
  const before = files.fingerprint(f.mod);
  manifest(f.mod, 'chararts/char_4215_buddy.ab');
  assert.notEqual(files.fingerprint(f.mod), before);
  fs.writeFileSync(path.join(f.mod, files.RESOURCE_MANIFEST), JSON.stringify({ schemaVersion: 1, resources: [{ file: '../outside.png', target: filename, bundle: 'skinpack/char_4215_buddy.ab' }] }));
  assert.throws(() => files.inspect(f.mod));
});

test('Arknights appearance inference separates base, individual skins, shared files and multi-skin bundles', () => {
  const { classifyResources, SHARED_SECTION } = require('../app/src/main/games/arknights/appearance.cjs');
  const catalog = require('../runtime-resources/games/arknights/character-skins/catalog.json');
  const sections = catalog.characters.find(item => item.characterId === 'char_2025_shu').skins;
  const spring = sections.find(item => item.id.endsWith('.nian.11')).sectionId;
  assert.equal(classifyResources(['dyn_illust_char_2025_shu.png'], sections).sectionId, 'base');
  assert.equal(classifyResources([{ resource: 'char_2025_shu_2__texture_effect.png', bundle: 'arts/dynchars/char_2025_shu_2.ab' }], sections).sectionId, 'base');
  assert.equal(classifyResources(['illust_char_2025_shu_nian#11.png', 'dyn_portrait_char_2025_shu_nian_11.skel'], sections).sectionId, spring);
  assert.equal(classifyResources(['illust_char_2025_shu_nian#11.png', 'illust_char_2025_shu_nlc#1.png'], sections).sectionId, SHARED_SECTION);
  assert.equal(classifyResources(['illust_char_2025_shu_nian#11.png', 'build_char_2025_shu.png'], sections).sectionId, SHARED_SECTION);
  assert.equal(classifyResources(['char_2025_shu.ab'], sections).sectionId, SHARED_SECTION);
});
