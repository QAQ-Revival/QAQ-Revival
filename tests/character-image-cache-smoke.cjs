const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

module.exports = async ({ electron, evaluate, waitFor, profile, handlers, passed, requests, imageBytes, setOffline }) => {
  const details = () => handlers.get('get-default-characters')({}, { gameId: 'wuthering-waves' });
  const load = url => evaluate(`new Promise(resolve => {
    const img = new Image();
    const timeout = setTimeout(() => resolve(0), 10000);
    img.onload = () => { clearTimeout(timeout); resolve(img.naturalWidth); };
    img.onerror = () => { clearTimeout(timeout); resolve(0); };
    img.src = ${JSON.stringify(url)};
  })`);
  await waitFor(`Array.from(document.querySelectorAll('.card-image img')).some(img => img.src.startsWith('qaq-character-cover:') && img.naturalWidth === 1)`, 'real character card uses downloaded cover');
  const character = (await details()).characterDetails.find(item => item.name === '安可');
  assert.match(character.coverUrl, /^qaq-character-cover:/);
  assert.equal(await load(character.coverUrl), 1);
  const source = new URL(character.coverUrl).searchParams.get('url');
  const count = () => requests.filter(url => url === source).length;
  assert.equal(count(), 1);
  await electron.session.defaultSession.clearCache();
  assert.equal(await load(character.coverUrl), 1);
  assert.equal(count(), 1);
  passed('Real character cards decode cached cover URLs; clearing Chromium cache does not download the image again');

  // Local user art still wins over an already downloaded remote cover.
  const localDir = path.join(profile, 'images', 'wuthering-waves', '安可');
  fs.mkdirSync(localDir, { recursive: true });
  const localCover = path.join(localDir, '_cover.png');
  fs.writeFileSync(localCover, imageBytes);
  const local = (await details()).characterDetails.find(item => item.name === '安可');
  assert.equal(local.coverUrl, 'data:image/png;base64,' + imageBytes.toString('base64'));
  assert.equal(await load(local.coverUrl), 1);
  assert.equal(count(), 1);
  fs.unlinkSync(localCover);
  passed('A local _cover overrides cached remote art and removing it restores the cached cover');

  // Clear browser cache and take the image source offline: the application cache must suffice.
  setOffline(true);
  await electron.session.defaultSession.clearCache();
  const restored = (await details()).characterDetails.find(item => item.name === '安可');
  assert.equal(restored.coverUrl, character.coverUrl);
  assert.equal(await load(restored.coverUrl), 1);
  assert.equal(count(), 1);
  assert.equal(fs.readdirSync(path.join(profile, 'character-image-cache')).some(name => name.endsWith('.tmp')), false);
  passed('Cached covers render offline from disk after Chromium cache is cleared, without new network requests');
};
