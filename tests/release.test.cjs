const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { releaseNames } = require('../tools/package-release.cjs');
const { versionResource } = require('../tools/version-resource.cjs');
test('product metadata and executable resources contain no personal attribution', () => {
  const manifest = require('../app/package.json');
  for (const field of ['author', 'contributors', 'maintainers']) assert.equal(Object.hasOwn(manifest, field), false);
  const resource = versionResource(manifest.productName, manifest.version);
  for (const field of ['LegalCopyright', 'CompanyName']) assert.equal(resource.includes(Buffer.from(field, 'utf16le')), false);
  for (const module of ['DisclaimerModal.js', 'StartupNoticeModal.js']) assert.equal(fs.existsSync(path.join(__dirname, '../app/out/renderer/assets', module)), false);
});
test('release names follow the application manifest and reject unsafe versions', () => {
  assert.deepEqual(releaseNames('1.0.0'), { version: '1.0.0', tag: 'v1.0.0', title: 'QAQ-Revival v1.0.0', archive: 'QAQ-Revival-1.0.0-win-x64-portable.rar' });
  for (const version of ['../1.0.0', '1.0.0\nother', '01.0.0', '65536.0.0', 'v1.0.0']) assert.throws(() => releaseNames(version));
});
test('distributed game metadata contains remote image references, never bundled game art', () => {
  function visit(directory) {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else assert.doesNotMatch(entry.name, /\.(png|jpe?g|webp|gif|bmp|ico|svg)$/i, file);
    }
  }
  for (const dir of ['app/resources/images', 'app/resources/pics', 'runtime-resources/games']) visit(path.join(__dirname, '..', dir));
  for (const game of fs.readdirSync(path.join(__dirname, '../runtime-resources/games'))) {
    const file = path.join(__dirname, '../runtime-resources/games', game, 'character-skins/catalog.json');
    if (!fs.existsSync(file)) continue;
    for (const character of JSON.parse(fs.readFileSync(file)).characters) for (const skin of character.skins) assert.match(skin.image, /^https:\/\//);
  }
});
