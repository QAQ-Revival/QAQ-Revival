// Opt-in live regression check: uses isolated smoke data and only the reported public image sources.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

module.exports = async ({ electron, liveImageFetch, evaluate, waitFor, captureUI, mods, profile, handlers, passed }) => {
  const hosts = new Set(['static.wikia.nocookie.net', 'hw-media-cdn-mingchao.kurogame.com']);
  electron.protocol.unhandle('https');
  electron.session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (request, callback) => callback({ cancel: !hosts.has(new URL(request.url).hostname) }));
  const mockedFetch = electron.net.fetch, requests = [];
  electron.net.fetch = async (address, options) => {
    if (!hosts.has(new URL(address).hostname)) return mockedFetch(address, options);
    const response = await liveImageFetch(address, options);
    requests.push({ host: new URL(address).hostname, status: response.status });
    return response;
  };
  fs.mkdirSync(path.join(mods, '千咲'), { recursive: true });
  await evaluate(`[...document.querySelectorAll('button')].find(button => button.textContent.trim() === '刷新').click()`);
  await waitFor(`!!document.querySelector('.character-card[aria-label^="千咲，"]')`, 'Chisa card');
  await evaluate(`document.querySelector('.character-card[aria-label^="千咲，"]').click()`);
  await waitFor(`!!document.querySelector('.appearance-section-tab[title*="蜜桃冰"]') || [...document.querySelectorAll('.appearance-section-tab')].some(tab => tab.textContent.includes('蜜桃冰'))`, 'Peach Parfait section');
  await evaluate(`[...document.querySelectorAll('.appearance-section-tab')].find(tab => tab.textContent.includes('蜜桃冰')).click()`);
  await waitFor(`document.querySelector('.appearance-section-empty-cover img')?.naturalWidth === 1080`, 'real outfit image downloaded and decoded', 45000);
  assert.ok(await evaluate(`[...document.querySelectorAll('.appearance-section-tab')].find(tab => tab.textContent.includes('蜜桃冰')).querySelector('img')?.naturalHeight === 1920`));
  const sections = await handlers.get('character-section:list')({}, { characterName: '千咲' });
  const skin = sections.sections.find(section => section.name === '蜜桃冰');
  const url = new URL(skin.coverUrl);
  assert.match(url.searchParams.get('fallback'), /^https:\/\/hw-media-cdn-mingchao\.kurogame\.com\//);
  const { createCharacterImageCache } = require('../app/out/main/character-image-cache.cjs');
  const offlineCache = createCharacterImageCache({ cacheDir: path.join(profile, 'character-image-cache'), fetchFn: () => { throw Error('offline'); } });
  const saved = await offlineCache.get(url.searchParams.get('url'));
  assert.equal(electron.nativeImage.createFromBuffer(saved.bytes).getSize().width, 1080);
  await captureUI('peach-parfait-live.png');
  passed('Real Peach Parfait artwork renders in the section tab and empty state, and is readable from disk offline: ' + JSON.stringify(requests));
  await evaluate(`document.querySelector('.appearance-section-empty-cover img').dispatchEvent(new Event('error'))`);
  await waitFor(`!document.querySelector('.appearance-section-empty-cover img') && document.querySelector('.appearance-section-empty-cover').textContent.includes('👗')`, 'failed image shows placeholder instead of broken image');
  passed('The empty-state cover uses a clean placeholder when image decoding fails');
};
