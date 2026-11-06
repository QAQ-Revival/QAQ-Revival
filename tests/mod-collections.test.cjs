const test = require('node:test');
const assert = require('node:assert/strict');

const models = Promise.all([
  import('../app/src/renderer/features/mods/model/localCollections.js'),
  import('../app/src/renderer/overlay/collections.js')
]);
const mod = (name, contentTypes) => ({ name, path: '/mods/' + name, enabled: false,
  ...(contentTypes ? { appearanceSectionId: 'skin:test', arknightsScope: { contentTypes, sectionIds: ['skin:test'] } } : {}) });

async function views(mods, character = '黍', aliases = [], selected = {}) {
  const [local, overlay] = await models;
  return [local.buildLocalCollectionView(mods, character, selected, aliases).displayMods,
    overlay.buildOverlayCollectionView(mods, character, aliases, selected)];
}

test('Arknights Mods sharing a title prefix or hyphenated title stay independent without explicit versions', async () => {
  const mods = [
    mod('黍 皮肤 动态 修复 (PC) [fcd4cb56]', ['dynamic']),
    mod('黍皮肤 - 黍皮肤（部分资源） (PC) [6cc1fe5a]', ['dynamic']),
    mod('黍皮肤开腿掰xue静态 - 黍皮肤开腿掰xue静态 (PC) [427c40bc]', ['static']),
    mod('黍皮肤小人 (PC) [d2ed3ada]', ['static']),
    mod('黍皮肤 - 另一套 (PC) [aabbccdd]', ['dynamic'])
  ];
  for (const view of await views(mods)) assert.deepEqual(view, mods);
});

test('Arknights versions require the same complete title, appearance and resource types in both windows', async () => {
  const first = mod('黍-夏日-连衣裙 V1.0 (PC) [1234abcd]', ['voice', 'dynamic']);
  const second = { ...mod('黍-夏日-连衣裙 V2.0 (PC) [abcd1234]', ['dynamic', 'voice']), enabled: true };
  const independent = [
    mod('黍-夏日-泳装 V3.0 (PC) [11112222]', ['dynamic', 'voice']),
    mod('黍-夏日-连衣裙 V3.0 (PC) [33334444]', ['static']),
    { ...mod('黍-夏日-连衣裙 V4.0 (PC) [55556666]', ['dynamic', 'voice']), appearanceSectionId: 'base' },
    mod('黍-夏日-连衣裙 (PC) [77778888]', ['dynamic', 'voice'])
  ];
  const result = await views([first, second, ...independent]);
  const identities = result.map(view => (view[0]._localCollection || view[0]._collection).identity);
  assert.equal(identities[0], identities[1]);
  for (const view of result) {
    assert.equal(view[0].name, second.name);
    const collection = view[0]._localCollection || view[0]._collection;
    assert.deepEqual(collection.variants.map(m => m.name), [second.name, first.name]);
    assert.deepEqual(view.slice(1), independent);
  }
  for (const view of await views([first, second], '黍', [], { [identities[0]]: first.name })) assert.equal(view[0].name, first.name);
});

test('ordinary version and explicitly separated variant groups still work without swallowing longer names', async () => {
  const mods = ['Encore-夏日 V1.0', '安可-夏日 V2.0', '安可-夏日长裙 V1.0', '夜莺皮肤动态-穿衣', '夜莺皮肤动态-清凉'].map(name => mod(name));
  for (const view of await views(mods, '安可', ['Encore'])) {
    assert.equal(view.length, 3);
    assert.equal((view[0]._localCollection || view[0]._collection).variants.length, 2);
    assert.equal(view[1], mods[2]);
    assert.equal((view[2]._localCollection || view[2]._collection).variants.length, 2);
  }
});
