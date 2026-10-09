const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { parseWikiPage, parseNteSkins } = require('../app/out/main/character-skin-sources.cjs');
const { createCharacterSkinCatalogService, mergeSkinCatalog } = require('../app/out/main/character-skin-catalog.cjs');
const image = 'https://static.wikia.nocookie.net/example/skin.png';
const skin = (id, extra = {}) => ({ id, sectionId: 'skin:' + id, nameZh: id, nameEn: id, image, ...extra });
const page = text => ({ pageid: 42, title: 'New Outfit', revisions: [{ slots: { main: { content: text } } }] });

test('wiki outfits split protagonist genders and accept image comments without mixing character identities', () => {
  const text = '{{Outfit Infobox\n|character = Rover\n|type = Signature\n|image = <!-- old.png --> Combined.png\n}}\n<gallery>\nOutfit Male Rover Splash Art.png|Male\nOutfit Female Rover Splash Art.png|Female\n</gallery>\n{{Other Languages\n|en = New Outfit\n|zhs = 新外观\n}}';
  const records = parseWikiPage('wuthering-waves', page(text), { characters: [] }, {});
  assert.deepEqual(records.map(item => item.character.nameZh), ['男主', '女主']);
  assert.equal(records[0].skin.sourceImageFile, 'Outfit Male Rover Splash Art.png');
  assert.equal(records[1].skin.sourceImageFile, 'Outfit Female Rover Splash Art.png');
  assert.notEqual(records[0].skin.id, records[1].skin.id);
  const single = parseWikiPage('wuthering-waves', page(text.replace('Rover\n', 'Encore\n')), { characters: [] }, { manualMappings: { encore: { displayName: '安可', canonicalEnName: 'Encore' } } });
  assert.equal(single[0].skin.sourceImageFile, 'Combined.png');
  assert.equal(single[0].character.nameZh, '安可');
});

test('NTE excludes default, hidden and incomplete rows and keeps distinct outfits sharing the same data-table URL', () => {
  const row = { AppearanceType: 'EAppearanceType::Fashion', CharacterID: '1051', IsDefault: false, IsCharacterShow: true,
    Name: { SourceString: '新外观', LocalizedString: 'New outfit' }, AppearanceData: { PlayerAppearanceAsset: { AssetPathName: '/Game/Characters/model' } }, PortraitImg: { AssetPathName: '/Game/UI/UI/Appearance/skin.skin' } };
  const base = { gameId: 'neverness-to-everness', characters: [{ nameZh: '男主', nameEn: 'Zero (Male)', skins: [skin('nte-fashion-first', { sourceFashionId: 'Fashion_first', sourceCharacterId: '1051' })] }] };
  const incoming = parseNteSkins([{ Rows: {
    Fashion_first: row, Fashion_second: { ...row, Name: { SourceString: '另一套' } },
    Fashion_default: { ...row, IsDefault: true }, Fashion_default_table: row,
    Fashion_hidden: { ...row, IsCharacterShow: false }, Fashion_incomplete: { ...row, AppearanceData: {} }
  } }], [{ Rows: { '1051': { ItemName: { SourceString: '零', LocalizedString: 'Zero' } } } }], [{ Rows: { '1051': { DefaultFashionID: 'Fashion_default_table' } } }], 'a'.repeat(40), base, {});
  assert.equal(incoming.characters[0].nameZh, '男主');
  assert.equal(incoming.characters[0].skins.length, 2);
  const merged = mergeSkinCatalog(base, incoming);
  assert.equal(merged.characters[0].skins.length, 2);
  assert.equal(merged.characters[0].skins[0].id, 'nte-fashion-first');
});

test('updates preserve section IDs and omitted skins, survive restart, and keep the last catalog on failure', async t => {
  const parent = fs.realpathSync(os.tmpdir()), dir = fs.mkdtempSync(path.join(parent, 'qaqm-skins-'));
  t.after(() => { assert.equal(path.dirname(fs.realpathSync(dir)), parent); fs.rmSync(dir, { recursive: true, force: true }); });
  const gameId = 'zzz', sourcePageUrl = 'https://zenless-zone-zero.fandom.com/wiki/An_Outfit';
  const base = { gameId, characters: [{ nameZh: '安比', nameEn: 'Anby', skins: [skin('old-id', { sourcePageUrl }), skin('retained')] }] };
  let calls = 0, failure = false, invalid = false;
  const service = createCharacterSkinCatalogService({ cacheDir: dir, fetchCatalog: async () => {
    calls++;
    if (failure) throw Error('offline');
    return { gameId, characters: [{ nameZh: '安比', nameEn: 'Anby', skins: [skin('new-generated-id', { sourcePageUrl, nameZh: '更新后的名称' }), skin('new-skin', { image: invalid ? 'file:///private' : image })] }] };
  } });
  const [a, b] = await Promise.all([service.refresh(gameId, base, {}), service.refresh(gameId, base, {})]);
  assert.deepEqual(a, b); assert.equal(calls, 1); assert.equal(a.added, 1);
  const merged = service.merge(gameId, base);
  assert.deepEqual(merged.characters[0].skins.map(item => item.id), ['old-id', 'retained', 'new-skin']);
  assert.equal(merged.characters[0].skins[0].sectionId, 'skin:old-id');
  assert.equal(merged.characters[0].skins[0].nameZh, '更新后的名称');
  const saved = fs.readFileSync(path.join(dir, gameId + '.json'), 'utf8');
  failure = true;
  assert.equal((await service.refresh(gameId, base, {})).success, false);
  failure = false; invalid = true;
  assert.equal((await service.refresh(gameId, base, {})).success, false);
  assert.equal(fs.readFileSync(path.join(dir, gameId + '.json'), 'utf8'), saved);
  const restarted = createCharacterSkinCatalogService({ cacheDir: dir });
  assert.deepEqual(restarted.merge(gameId, base), merged);
  assert.equal((await service.refresh('endfield', {}, {})).unsupported, true);
});
