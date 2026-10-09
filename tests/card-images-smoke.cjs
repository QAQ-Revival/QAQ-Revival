const assert = require('node:assert/strict');
const path = require('node:path');

module.exports = async ({ evaluate, waitFor, window, captureUI, passed }) => {
  async function downloads() {
    await evaluate(`document.querySelector('.nav-item[aria-label="MOD下载"]').click()`);
    await waitFor(`!!document.querySelector('.mod-download-source-trigger')`, 'downloads');
    if (await evaluate(`document.querySelector('.mod-download-provider:not([hidden])')?.dataset.source !== 'pawchive'`)) {
      await evaluate(`document.querySelector('.mod-download-source-trigger').click()`);
      await waitFor(`!!document.querySelector('.mod-download-source-option[data-source="pawchive"]')`, 'source menu');
      await evaluate(`document.querySelector('.mod-download-source-option[data-source="pawchive"]').click()`);
    }
    await waitFor(`!!document.getElementById('pawchive-tab-posts')`, 'Pawchive');
    await evaluate(`document.getElementById('pawchive-tab-posts').click()`);
    await waitFor(`!!document.querySelector('.paw-card-image img')`, 'post images');
  }
  async function settings() {
    await evaluate(`document.querySelector('.sidebar-settings').click()`);
    await waitFor(`!!document.querySelector('[data-category="appearance"]')`, 'settings');
    await evaluate(`document.querySelector('[data-category="appearance"]').click()`);
    await waitFor(`!!document.querySelector('[aria-label="下载卡片封面比例"]')`, 'ratio control');
  }
  async function assertRatio(expected) {
    const ratio = await evaluate(`(() => { const r = document.querySelector('.paw-card-image').getBoundingClientRect(); return r.width / r.height; })()`);
    assert.ok(Math.abs(ratio - expected) < .01, 'Actual card dimensions follow selected ratio');
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('.paw-card-image img')).objectPosition`), '50% 0%');
  }
  await downloads();
  await assertRatio(4 / 3);
  assert.equal((await evaluate('window.api.getConfig()')).config.modDownloadImageRatio, '4:3');
  await evaluate(`document.querySelector('.paw-post-card').click()`);
  await waitFor(`!!document.querySelector('.paw-gallery-image img')`, 'detail gallery');
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.paw-gallery-image img')).objectFit`), 'contain');
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.paw-related-card img')).objectPosition`), '50% 0%');
  await evaluate(`document.querySelector('[aria-label="关闭内容详情"]').click()`);
  await captureUI('card-images-default.png');
  await settings();
  assert.equal(await evaluate(`document.querySelector('[aria-label="下载卡片封面比例"] [aria-pressed="true"] strong').textContent`), '4:3');
  await evaluate(`[...document.querySelectorAll('[aria-label="下载卡片封面比例"] button')].find(b => b.querySelector('strong').textContent === '1:1').click()`);
  await waitFor(`document.querySelector('[aria-label="下载卡片封面比例"] [aria-pressed="true"] strong').textContent === '1:1'`, 'ratio saved');
  assert.equal((await evaluate('window.api.getConfig()')).config.modDownloadImageRatio, '1:1');
  assert.equal((await evaluate(`window.api.setModDownloadImageRatio('invalid')`)).success, false);
  assert.equal((await evaluate('window.api.getConfig()')).config.modDownloadImageRatio, '1:1');
  await evaluate(`document.getElementById('settings-mod-cards').scrollIntoView({block:'center'})`);
  await captureUI('card-images-settings.png');
  await downloads(); await assertRatio(1);
  // Verify the market's adaptive/first-row rules cannot override the shared choice.
  const marketRatio = await evaluate(`(() => {
    const node = document.createElement('article'); node.className = 'mod-card mod-card-first-row'; node.style.width = '240px';
    node.innerHTML = '<div class="mod-card-image mod-card-image-adaptive"><div class="market-image-card" style="--natural-ratio: .5"></div></div>';
    document.querySelector('.mod-download-view').append(node);
    const value = getComputedStyle(node.querySelector('.market-image-card')).aspectRatio; node.remove(); return value;
  })()`);
  assert.equal(marketRatio, '1 / 1');
  await window.loadFile(path.join(process.resourcesPath, 'app/out/renderer/index.html'));
  await waitFor(`!!document.querySelector('.sidebar-settings')`, 'reload');
  await downloads(); await assertRatio(1);
  await settings();
  assert.equal(await evaluate(`document.querySelector('[aria-label="下载卡片封面比例"] [aria-pressed="true"] strong').textContent`), '1:1');
  passed('Download covers default to 4:3 with top cropping; ratio settings apply immediately across sources and survive reload, while detail images remain uncropped');
};
