const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

module.exports = async ({ electron, evaluate, waitFor, captureUI, window, root, profile, handlers, setSelection, passed }) => {
  const call = (channel, payload) => handlers.get(channel)({ sender: window.webContents }, payload);
  const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const button = text => evaluate(`[...document.querySelectorAll('.gacha-view button')].find(item => item.textContent.trim() === ${JSON.stringify(text)}).click()`);
  const url = 'https://aki-gm-resources.aki-game.com/aki/gacha/index.html?player_id=100000001&svr_id=fixture-server&record_id=smoke-only-token&resources_id=fixture-pool&lang=zh-Hans&svr_area=cn';
  const gameRoot = path.join(root, 'gacha-game'), logfile = path.join(gameRoot, 'Client/Saved/Logs/Client.log');
  fs.mkdirSync(path.dirname(logfile), { recursive: true });
  const plain = Buffer.from('a previous entry\n' + url.replace('smoke-only-token', 'older-token') + '\nnewest entry\n' + url + '\n');
  fs.writeFileSync(logfile, Buffer.from(plain.map(byte => byte ^ (byte & 1 ? 0xef : 0xa5))));
  const logOriginal = fs.readFileSync(logfile);
  const executable = path.join(gameRoot, 'Wuthering Waves.exe');
  fs.writeFileSync(executable, 'Synthetic game, never executed');
  await call('game:update', { gameId: 'wuthering-waves', updates: { gamePath: executable } });
  const requests = [];
  const copiedLinks = [];
  electron.clipboard.writeText = async value => { copiedLinks.push(value); };
  let mode = 'ok';
  const originalFetch = electron.net.fetch;
  const records = [
    { name: '鸣潮测试武器', qualityLevel: 3, count: 3, time: '2026-10-24 12:05:00', resourceType: '武器', cardPoolType: '1' },
    { name: '今汐', qualityLevel: 5, count: 1, time: '2026-10-24 12:04:00', resourceType: '角色', cardPoolType: '1' },
    { name: '鸣潮测试武器', qualityLevel: 3, count: 2, time: '2026-10-24 12:03:00', resourceType: '武器', cardPoolType: '1' },
    { name: '安可', qualityLevel: 5, count: 1, time: '2026-10-24 12:02:00', resourceType: '角色', cardPoolType: '1' },
    { name: '散华', qualityLevel: 4, count: 1, time: '2026-10-24 12:01:00', resourceType: '角色', cardPoolType: '1' },
    { name: '鸣潮测试武器', qualityLevel: 3, count: 2, time: '2026-10-24 12:00:00', resourceType: '武器', cardPoolType: '1' }
  ];
  electron.net.fetch = async (address, options) => {
    if (!String(address).includes('gmserver-api.aki-game2.')) return originalFetch(address, options);
    requests.push({ address, body: JSON.parse(options.body) });
    if (mode === 'wait') return new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true }));
    if (mode === 'expired') return Response.json({ code: -1, message: url });
    if (mode === 'partial' && JSON.parse(options.body).cardPoolType === 2) throw Error('offline');
    return Response.json({ code: 0, data: JSON.parse(options.body).cardPoolType === 1 ? records : [] });
  };
  await click('.nav-item[data-sort-id="gacha"]');
  await waitFor(`!!document.querySelector('.gacha-consent-check')`, 'consent page');
  assert.equal(await evaluate(`document.querySelector('.gacha-consent-check input').checked`), false);
  assert.equal(await evaluate(`document.querySelector('.gacha-primary').disabled`), true);
  assert.equal(await evaluate(`!!document.querySelector('#gacha-url')`), false);
  for (const channel of ['wuwa:gacha-extract', 'wuwa:gacha-choose-folder', 'wuwa:gacha-choose-log', 'wuwa:gacha-fetch', 'wuwa:gacha-copy', 'wuwa:gacha-export', 'wuwa:gacha-import']) assert.equal((await call(channel, { url })).success, false, channel);
  assert.equal((await call('wuwa:gacha-authorize', { accepted: false })).success, false);
  assert.equal(requests.length, 0); assert.equal(fs.existsSync(path.join(profile, 'wuwa-gacha')), false);
  await captureUI('wuwa-gacha-consent.png');
  await click('.gacha-consent-check input');
  await waitFor(`!document.querySelector('.gacha-primary').disabled`, 'checked confirmation');
  await button('确认并使用');
  await waitFor(`!!document.querySelector('#gacha-url')`, 'authorized tools');
  passed('Consent is unchecked by default; UI and every data IPC operation remain blocked until checked and confirmed, with no requests or cache writes');

  await button('从游戏日志提取');
  await waitFor(`document.querySelector('#gacha-url').value.includes('smoke-only-token') && !document.querySelector('#gacha-url').disabled`, 'encrypted log extraction');
  assert.deepEqual(fs.readFileSync(logfile), logOriginal);
  await button('复制链接');
  await waitFor(`document.querySelector('.gacha-notice')?.textContent.includes('已复制')`, 'link copy');
  assert.equal(copiedLinks.at(-1), url);
  let outputFile = path.join(root, 'wuwa_gacha_url.txt');
  electron.dialog.showSaveDialog = async () => ({ canceled: false, filePath: outputFile });
  await button('保存链接');
  await waitFor(`document.querySelector('.gacha-notice')?.textContent.includes('已导出')`, 'link saved');
  assert.equal(fs.readFileSync(outputFile, 'utf8'), url + '\n');
  await button('获取全部卡池记录');
  await waitFor(`document.querySelector('.gacha-stats')?.textContent.includes('20.00%') && !document.querySelector('#gacha-url').disabled`, 'all pools fetched');
  assert.equal(requests.length, 11);
  assert(requests.every(item => item.address === 'https://gmserver-api.aki-game2.com/gacha/record/query'));
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('.gacha-stats strong')].map(item => item.textContent)`), ['10', '2', '1', '20.00%']);
  assert.equal(await evaluate(`document.querySelectorAll('.gacha-results')[1].textContent.includes('至少 4')`), true);
  await captureUI('wuwa-gacha-records.png');
  await evaluate(`document.querySelectorAll('.gacha-results')[1].scrollIntoView({ block: 'start' })`);
  await captureUI('wuwa-gacha-details.png');
  outputFile = path.join(root, 'wuwa_gacha_records.json');
  await button('导出 JSON');
  await waitFor(`document.querySelector('.gacha-notice')?.textContent.includes('wuwa_gacha_records.json')`, 'JSON export');
  const exported = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
  assert.equal(exported.pools[1].length, 6); assert.equal(exported.complete, true);
  outputFile = path.join(root, 'wuwa_gacha_report.md');
  await button('导出统计报告');
  await waitFor(`document.querySelector('.gacha-notice')?.textContent.includes('wuwa_gacha_report.md')`, 'report export');
  assert.match(fs.readFileSync(outputFile, 'utf8'), /今汐/); assert(!fs.readFileSync(outputFile, 'utf8').includes('smoke-only-token'));
  passed('Encrypted log extraction preserves the log, copying and TXT/JSON/Markdown exports work, and all 11 pools yield correct totals, rates and 5-star details');

  mode = 'wait';
  await button('获取全部卡池记录');
  await waitFor(`!!document.querySelector('.gacha-progress')`, 'fetch progress');
  await button('取消获取');
  await waitFor(`!document.querySelector('#gacha-url').disabled && document.querySelector('.gacha-notice')?.textContent.includes('已取消')`, 'fetch canceled');
  assert.equal((await call('wuwa:gacha-state')).summary.total, 10);
  mode = 'partial';
  await button('获取全部卡池记录');
  await waitFor(`!document.querySelector('#gacha-url').disabled && !!document.querySelector('.gacha-notice.warning')`, 'partial result warning');
  assert.equal((await call('wuwa:gacha-state')).snapshot.complete, false);
  const complete = fs.readdirSync(path.join(profile, 'wuwa-gacha')).find(name => name.endsWith('-complete.json'));
  assert.equal(JSON.parse(fs.readFileSync(path.join(profile, 'wuwa-gacha', complete))).complete, true);
  mode = 'expired';
  await button('获取全部卡池记录');
  await waitFor(`!document.querySelector('#gacha-url').disabled && !!document.querySelector('.gacha-notice.error')`, 'expired link error');
  assert(!await evaluate(`document.querySelector('.gacha-notice.error').textContent.includes('smoke-only-token')`));
  const imported = path.join(root, 'upstream-records.json');
  fs.writeFileSync(imported, JSON.stringify({ url, params: exported.params, pools: { 1: records } }));
  setSelection({ canceled: false, filePaths: [imported] });
  await button('导入记录 JSON');
  await waitFor(`document.querySelector('.gacha-notice')?.textContent.includes('已导入')`, 'upstream import');
  await window.loadFile(path.join(process.resourcesPath, 'app/out/renderer/index.html'));
  await waitFor(`!!document.querySelector('.nav-item[data-sort-id="gacha"]')`, 'reload');
  await click('.nav-item[data-sort-id="gacha"]');
  await waitFor(`!!document.querySelector('.gacha-stats')`, 'persisted snapshot');
  assert.equal((await call('wuwa:gacha-state')).summary.total, 10);
  const stranger = { isDestroyed: () => false };
  assert.equal((await handlers.get('wuwa:gacha-state')({ sender: stranger })).authorized, false);
  assert.equal((await handlers.get('wuwa:gacha-fetch')({ sender: stranger }, { url })).success, false);
  window.setSize(1000, 760);
  await captureUI('wuwa-gacha-compact.png');
  assert.equal(await evaluate(`document.querySelector('.gacha-view').scrollWidth <= document.querySelector('.gacha-view').clientWidth + 1`), true);
  await click('.game-selector-trigger');
  await waitFor(`!!document.querySelector('.game-selector-option[data-sort-id="endfield"]')`, 'other game choice');
  await click('.game-selector-option[data-sort-id="endfield"]');
  await waitFor(`!document.querySelector('.nav-item[data-sort-id="gacha"]') && !document.querySelector('.gacha-view')`, 'WuWa-specific navigation');
  passed('Cancelation and expired links preserve records, partial results preserve complete snapshots, upstream JSON imports and reloads work, new windows need consent, and the page follows the selected game');
};
