const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCharacters, parseOutfits, buildGamePathCandidates } = require('../app/out/main/genshin.cjs');
const { mergeSkinCatalog, validateCatalog } = require('../app/out/main/character-skin-catalog.cjs');
const { normalizeRecords } = require('../app/out/main/character-catalog.cjs');

test('Genshin identities distinguish Travelers, collapse elements, and exclude test avatars', () => {
  const zh = [
    { id: 10000005, name: '空', images: { filename_icon: 'UI_AvatarIcon_PlayerBoy' } },
    { id: 10000007, name: '荧', images: { filename_icon: 'UI_AvatarIcon_PlayerGirl' } },
    { id: 10000005, name: '空·火' }, { id: 10000901, name: '试用角色' },
    { id: 10000052, name: '雷电将军' }, { id: 10000002, name: '神里绫华' },
    { id: 10000046, name: '胡桃', images: { filename_icon: '../../secret' } }
  ];
  const en = [{ id: 10000052, name: 'Raiden Shogun' }, { id: 10000002, name: 'Kamisato Ayaka' }, { id: 10000046, name: 'Hu Tao' }];
  const records = normalizeRecords(parseCharacters(zh, en));
  assert.deepEqual(records.map(item => item.name), ['空', '荧', '雷电将军', '神里绫华', '胡桃']);
  assert.equal(records[0].en, 'Aether'); assert.equal(records[1].en, 'Lumine');
  assert.ok(records[2].aliases.includes('Raiden')); assert.ok(records[3].aliases.includes('Ayaka'));
  assert.equal(records[4].image, null);
});

test('Outfits exclude defaults and retain stable assignments when translated names change', () => {
  const outfit = { id: 200201, characterId: 10000002, characterName: '神里绫华', name: '花时来信', isDefault: false,
    images: { filename_splash: 'UI_Costume_AyakaCostumeFruhling' } };
  const incoming = parseOutfits([{ ...outfit, id: 200200, isDefault: true }, outfit, outfit], [{ ...outfit, name: 'Springbloom Missive', characterName: 'Kamisato Ayaka' }]);
  validateCatalog(incoming, 'genshin-impact');
  assert.equal(incoming.characters[0].skins.length, 1);
  const previous = structuredClone(incoming); previous.characters[0].skins[0].nameZh = '旧译名';
  const merged = mergeSkinCatalog(previous, incoming);
  assert.equal(merged.characters[0].skins.length, 1);
  assert.equal(merged.characters[0].skins[0].sectionId, 'skin:genshin-outfit-200201');
  assert.ok(merged.characters[0].skins[0].aliases.includes('旧译名'));
  assert.throws(() => parseOutfits([{ ...outfit, images: {} }], []), /不完整/);
});

test('Detection supports both clients, custom XXMI folders, HoYoPlay and registry installs', () => {
  const candidates = buildGamePathCandidates(key => key.endsWith('hk4e_cn') ? 'Z:\\自定义\\原神' : null, ['Y:\\Games & Mods\\GI']);
  for (const exe of ['YuanShen.exe', 'GenshinImpact.exe']) {
    assert.ok(candidates.includes('Z:\\自定义\\原神\\' + exe));
    assert.ok(candidates.includes('Y:\\Games & Mods\\GI\\' + exe));
    assert.ok(candidates.includes('D:\\HoYoPlay\\games\\Genshin Impact Game\\' + exe));
  }
  assert.equal(candidates.length, new Set(candidates).size);
});
