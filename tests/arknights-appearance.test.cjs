const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { classifyResources, inspectAppearance } = require('../app/src/main/games/arknights/appearance.cjs');
const files = require('../app/src/main/games/arknights/files.cjs');
const catalog = require('../runtime-resources/games/arknights/character-skins/catalog.json');

test('bound dynamic effects keep the outfit of their PC bundle', () => {
  const sections = catalog.characters.find(c => c.characterId === 'char_4080_lin').skins;
  const expected = sections.find(s => s.id.endsWith('.summer.19')).sectionId;
  assert.equal(classifyResources([{ bundle: 'arts/dynchars/char_4080_lin_summer#19.ab', target: 'char_4080_lin_summer#19__texture_dyn_portrait_char_4080_lin_nian#10.png' }], sections).sectionId, expected);
});

test('summon outfits use their owner outfit aliases and preserve base summons', () => {
  const sections = catalog.characters.find(c => c.characterId === 'char_179_cgbird').skins;
  for (const theme of ['witch#1', 'sightseer#1']) {
    const expected = sections.find(s => s.aliases.some(a => a.endsWith('_' + theme))).sectionId;
    assert.equal(classifyResources([{ bundle: 'skinpack/token_10003_cgbird_bird.ab', target: 'token_10003_cgbird_bird_' + theme + '.skel' }], sections).sectionId, expected);
  }
  assert.equal(classifyResources([{ bundle: 'skinpack/token_10003_cgbird_bird.ab', target: 'token_10003_cgbird_bird.skel' }], sections).sectionId, 'base');
  assert.equal(classifyResources([{ bundle: 'skinpack/token_10003_cgbird_bird.ab', target: 'token_10003_cgbird_bird_witch#11.skel' }], sections).sectionId, 'arknights:shared');
});

test('validated PC prefab reference aliases survive manifest loading and classify generic textures', t => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'qaqr-appearance-'));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(fixture)), path.resolve(os.tmpdir()));
    assert(path.basename(fixture).startsWith('qaqr-appearance-'));
    fs.rmSync(fixture, { recursive: true });
  });
  const sections = catalog.characters.find(c => c.characterId === 'char_101_sora').skins;
  const expected = sections.find(s => s.id.endsWith('.summer.1')).sectionId;
  const resource = { file: 'texture.png', bundle: 'skinpack/char_101_sora.ab', target: 'char_101_sora__texture_char_101_sora.png', appearanceAliases: ['char_101_sora_summer#1'] };
  fs.writeFileSync(path.join(fixture, resource.file), 'classification fixture');
  const write = () => fs.writeFileSync(path.join(fixture, files.RESOURCE_MANIFEST), JSON.stringify({ schemaVersion: 1, resources: [resource] }));
  write();
  assert.equal(inspectAppearance(fixture, sections).sectionId, expected);
  resource.appearanceAliases.push('char_101_sora_epoque#17');
  write();
  assert.equal(inspectAppearance(fixture, sections).sectionId, 'arknights:shared');
  resource.appearanceAliases = 'invalid manifest field';
  write();
  assert.throws(() => files.readBindings(fixture));
});

test('static illustrations with battle/base skeletons stay static while real dynamic portraits keep their type', t => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'qaqr-content-types-'));
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  const check = (name, resources, expected, binding) => {
    const root = path.join(fixture, name);
    fs.mkdirSync(root);
    for (const resource of resources) fs.writeFileSync(path.join(root, resource), 'type fixture');
    if (binding) fs.writeFileSync(path.join(root, files.RESOURCE_MANIFEST), JSON.stringify({ schemaVersion: 1, resources: [binding] }));
    assert.deepEqual(inspectAppearance(root, []).contentTypes, expected, name);
  };
  check('static-with-chibis', ['illust_char_103_angel_1.png', 'front_char_103_angel.skel', 'back_char_103_angel.skel', 'build_char_103_angel.skel'], ['static']);
  check('named-dynamic', ['dyn_illust_char_1041_angel2.skel', 'dyn_illust_char_1041_angel2.png'], ['dynamic']);
  check('bound-dynamic-texture', ['effect.png'], ['dynamic'], { file: 'effect.png', target: 'effect.png', bundle: 'arts/dynchars/char_1041_angel2_2.ab' });
  check('renamed-bound-portrait', ['texture.png'], ['dynamic'], { file: 'texture.png', target: 'sp_dyn_illust_char_1041_angel2.png', bundle: 'skinpack/char_1041_angel2.ab' });
  check('voice-with-chibi', ['voice.wav', 'build_char_103_angel.skel'], ['voice']);
});
