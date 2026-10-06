const assert = require('node:assert/strict');
const path = require('node:path');
module.exports = async ({ evaluate, waitFor, captureUI, window, passed }) => {
  const retired = [];
  window.webContents.session.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (request, callback) => {
    if (/\/api\/(features|skins|supporters|server-support|announcements|blocks)(\/|$)/.test(new URL(request.url).pathname)) retired.push(request.url);
    callback({ cancel: true });
  });
  await evaluate(`localStorage.setItem('clientId', 'legacy-client-for-test')`);
  const canonical = await evaluate(`import(new URL('./assets/clientIdentity.js', location.href).href).then(m => m.g())`);
  assert.equal(canonical, (await evaluate('window.api.getConfig()')).config.clientId);
  const openDownloads = async expected => {
    await waitFor(`!!document.querySelector('.nav-item[aria-label="MOD下载"]')`, 'download navigation');
    await evaluate(`document.querySelector('.nav-item[aria-label="MOD下载"]').click()`);
    await waitFor(`document.querySelector('.mod-download-provider:not([hidden])')?.dataset.source === ${JSON.stringify(expected)}`, 'remembered source ' + expected);
  };
  await openDownloads('qaqm');
  await waitFor(`!!document.querySelector('.mod-market-header')`, 'QAQM header');
  await captureUI('window-titlebar-integrated.png');
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('.mod-market-header button')].map(el => el.textContent.trim())`), ['网页版', '布局▾', '🔄 刷新▾']);
  await evaluate(`document.querySelector('.mod-download-source-trigger').click()`);
  await waitFor(`document.querySelectorAll('.mod-download-source-option').length === 3`, 'source menu');
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('.mod-download-source-option')].map(el => el.dataset.source)`), ['qaqm', 'kemono', 'pawchive']);
  await evaluate(`document.querySelector('[data-source="kemono"].mod-download-source-option').click()`);
  await waitFor(`localStorage.getItem('qaqm.downloadSource') === 'kemono'`, 'source selection saved');
  await window.loadFile(path.join(process.resourcesPath, 'app/out/renderer/index.html'));
  await openDownloads('kemono');
  for (const [taskId, task] of Object.entries({
    slow: { status: 'downloading', limited: true, downloadMode: 'standard', speed: 1024, elapsedMs: 20000 },
    denied: { status: 'error', code: 'SPONSOR_REQUIRED', error: '赞助获取高速下载' },
    offline: { status: 'error', code: 'DOWNLOAD_STALLED', error: '下载超时' }
  })) {
    await evaluate(`window.dispatchEvent(new CustomEvent('qaqm:download-task-queued', { detail: ${JSON.stringify({ taskId, name: taskId, ...task })} }))`);
  }
  await waitFor(`document.querySelectorAll('.qaqm-download-item').length === 3`, 'download status UI');
  const downloadText = await evaluate(`document.querySelector('.qaqm-download-list').textContent`);
  assert.doesNotMatch(downloadText, /赞助|高速通道|权益|Plus|支持服务器/);
  assert.match(downloadText, /下载速度较慢/);
  assert.match(downloadText, /该下载源暂不可用/);
  assert.match(downloadText, /检查网络/);
  assert.deepEqual(retired, []);
  passed('Sources default to QAQM, use the requested order and remember selection after restart; removed header actions and retired service requests stay absent, download errors have actionable neutral guidance');
};
