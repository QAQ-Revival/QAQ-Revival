const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

module.exports = async ({ electron, evaluate, waitFor, profile, mods, handlers, passed }) => {
  const originalFetch = electron.net.fetch;
  let offline = false;
  const text = '{{Outfit Infobox\n|character = Encore\n|type = Signature\n|image = Fixture Outfit.png\n}}\n{{Other Languages\n|en = Fixture Outfit\n|zhs = 在线测试外观\n}}';
  electron.net.fetch = async (address, options) => {
    const url = new URL(address);
    if (url.hostname !== 'wutheringwaves.fandom.com') return originalFetch(address, options);
    if (offline) throw Error('Synthetic outfit source offline');
    return new Response(JSON.stringify({ query: { pages: url.searchParams.has('generator')
      ? [{ pageid: 900001, title: 'Fixture Outfit', revisions: [{ slots: { main: { content: text } } }] }]
      : [{ title: 'File:Fixture Outfit.png', imageinfo: [{ url: 'https://static.wikia.nocookie.net/smoke/outfit.png' }] }] } }));
  };
  const call = (name, args) => handlers.get(name)({}, args);
  const custom = await call('character-section:create', { characterName: '安可', name: '保留的自定义外观' });
  assert.equal(custom.success, true);
  const modFile = path.join(mods, '安可', 'DISABLED_测试模组', 'mod.ini');
  const originalMod = fs.readFileSync(modFile, 'utf8');
  await evaluate(`Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === '更新角色').click()`);
  await waitFor(`document.body.innerText.includes('外观目录已更新，新增 1 款')`, 'combined role and outfit update result');
  const updated = await call('get-mods', '安可');
  const official = updated.sections.find(section => section.name === '在线测试外观');
  assert.ok(official?.official);
  assert.match(official.coverUrl, /^qaq-character-cover:/);
  assert.ok(updated.sections.some(section => section.name === '保留的自定义外观'));
  assert.equal(await evaluate(`new Promise(resolve => { const image = new Image(); image.onload = () => resolve(image.naturalWidth); image.onerror = () => resolve(0); image.src = ${JSON.stringify(official.coverUrl)}; })`), 1);
  const assigned = await call('character-section:assign-mod', { characterName: '安可', modName: '测试模组', sectionId: official.sectionId });
  assert.equal(assigned.success, true);
  passed('Update Characters downloads outfit metadata, refreshes live sections, keeps custom sections and displays cached outfit art');
  const repeated = await call('character:update-catalog', 'wuthering-waves');
  assert.equal(repeated.skins.added, 0);
  offline = true;
  const failed = await call('character:update-catalog', 'wuthering-waves');
  assert.equal(failed.success, true);
  assert.equal(failed.skins.success, false);
  assert.match(failed.message, /已保留原有目录/);
  const retained = await call('get-mods', '安可');
  assert.equal(retained.mods.find(mod => mod.name === '测试模组').appearanceSectionId, official.sectionId);
  assert.equal(retained.sections.filter(section => section.sectionId === official.sectionId).length, 1);
  assert.equal(fs.readFileSync(modFile, 'utf8'), originalMod);
  assert.ok(fs.existsSync(path.join(profile, 'character-skin-catalogs', 'wuthering-waves.json')));
  passed('Repeated and failed outfit updates preserve section IDs, assigned Mods, local files and the last saved catalog');
};
