const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { resolveSite, siteUrl, GAMES } = require('../app/out/main/mod-sites.cjs');
const { createGameBananaService } = require('../app/out/main/gamebanana.cjs');
const { createArchiveDownloads } = require('../app/out/main/archive-downloads.cjs');
const { standardChromeUserAgent } = require('../app/out/main/site-sessions.cjs');
const { createSiteContent, huiPost } = require('../app/out/main/site-content.cjs');
const { canFinishVerification, sameDocument } = require('../app/out/main/site-verification.cjs');

test('game routes share sources while unknown sections never fall back to Endfield', () => {
  for (const game of Object.keys(GAMES)) assert.ok(resolveSite('gamebanana', game).hasSection);
  assert.match(resolveSite('arca', 'endfield').url, /category=enFielMd/);
  assert.equal(resolveSite('arca', 'wuthering-waves').url, 'https://arca.live/b/thingzyoa');
  assert.match(resolveSite('keke', 'wuthering-waves').url, /wutheringwaves-mod/);
  assert.equal(resolveSite('huiyue', 'genshin-impact').hasSection, false);
  assert.equal(resolveSite('loverslab', 'zzz').url, 'https://www.loverslab.com/');
  assert.equal(resolveSite('loverslab', 'endfield').extra.length, 1);
  assert.equal(resolveSite('loverslab', 'wuthering-waves').url, 'https://www.loverslab.com/topic/231084-req-wuthering-waves');
  for (const url of ['file:///C:/a', 'https://gamebanana.com.evil.test/a', 'https://user@gamebanana.com/a', 'https://gamebanana.com:123/a']) assert.equal(siteUrl(url, 'gamebanana'), false);
  assert.throws(() => resolveSite('__proto__', 'endfield'));
});
const mod = (overrides = {}) => ({ _idRow: 42, _sName: 'Interface Mod', _sModelName: 'Mod', _aGame: { _idRow: 21842 },
  _aSubmitter: { _idRow: 8, _sName: 'Author' }, _sText: '<p>Instructions</p>',
  _aFiles: [{ _idRow: 99, _sFile: 'interface.zip', _sDownloadUrl: 'https://gamebanana.com/dl/99', _nFilesize: 12 }], ...overrides });
test('GameBanana search scopes the game, honors server pagination and revalidates download membership', async () => {
  const requests = [];
  const service = createGameBananaService({ fetch: async (url, options) => {
    requests.push({ url: new URL(url), options });
    const data = url.includes('ProfilePage') ? mod() : { _aMetadata: { _nRecordCount: 31, _nPerpage: 15 }, _aRecords: [mod(), mod({ _aGame: { _idRow: 8552 } })] };
    return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
  } });
  const list = await service.list({ gameId: 'endfield', query: 'UI', page: 2 });
  assert.equal(list.items.length, 1); assert.equal(list.hasMore, true);
  assert.equal(requests[0].url.searchParams.get('_idGameRow'), '21842');
  assert.equal(requests[0].url.pathname, '/apiv11/Util/Search/Results');
  assert.equal(requests[0].options.credentials, 'include');
  assert.equal((await service.getPost({ id: 42, gameId: 'endfield' })).post.attachments[0].path, '99');
  await assert.rejects(service.getPost({ id: 42, gameId: 'zzz' }), /不属于当前游戏/);
  await assert.rejects(service.getPost({ id: '../42', gameId: 'endfield' }));
  await assert.rejects(service.list({ gameId: 'unknown' }));
});
test('site access restrictions request embedded verification without suppressing accessible metadata', async () => {
  const service = createGameBananaService({ fetch: async () => new Response(JSON.stringify(mod({ _sInitialVisibility: 'hide' })), { headers: { 'Content-Type': 'application/json' } }) });
  const { post } = await service.getPost({ id: 42, gameId: 'endfield' });
  assert.equal(post.attachments.length, 1); assert.match(post.content, /Instructions/);
  const denied = createGameBananaService({ fetch: async () => new Response(JSON.stringify(mod({ _bIsPrivate: true })), { headers: { 'Content-Type': 'application/json' } }) });
  await assert.rejects(denied.getPost({id:42,gameId:'endfield'}), error => error.code === 'VERIFY_REQUIRED');
  for (const response of [new Response('', { status: 403 }), new Response('<html>Challenge</html>', { headers: { 'Content-Type': 'text/html' } })]) {
    await assert.rejects(createGameBananaService({ fetch: async () => response }).list({ gameId: 'endfield' }), /登录|验证/);
  }
});
function temporary(t) {
  const base = fs.realpathSync(os.tmpdir()), directory = fs.mkdtempSync(path.join(base, 'qaq-sites-'));
  t.after(() => { assert.equal(path.dirname(directory), base); fs.rmSync(directory, { recursive: true, force: true }); });
  return directory;
}
test('standard Chrome UA removes all app tokens while preserving the actual Chromium version', () => {
  const ua=standardChromeUserAgent('Mozilla/5.0 Chrome/120.0.6099.291 QAQ-Revival/1.0.2 Electron/28.3.3 Safari/537.36');
  assert.equal(ua,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.291 Safari/537.36');
  assert.throws(()=>standardChromeUserAgent('unknown browser'));
  assert.match(standardChromeUserAgent('Chrome/120.0.6099.291 Electron/28.3.3','154.0.8037.98'), /Chrome\/120\.0\.6099\.291/, 'Never borrow another browser version');
});
test('verification cannot finish during a challenge or redirect and snapshots stay scoped to the same page', () => {
  assert.equal(canFinishVerification({ ready:true, challenge:true, status:200 }),false);
  assert.equal(canFinishVerification({ ready:false, challenge:false, status:200 }),false);
  assert.equal(canFinishVerification({ ready:true, challenge:false, status:403 }),false);
  assert.equal(canFinishVerification({ ready:true, challenge:false, status:200 }),true);
  assert.equal(sameDocument('https://www.loverslab.com/topic/231084-req-wuthering-waves#comment-1','https://www.loverslab.com/topic/231084-req-wuthering-waves'),true);
  assert.equal(sameDocument('https://www.loverslab.com/topic/231084-req-wuthering-waves','https://www.loverslab.com/login/'),false);
});
test('HTTP denial requests verification, parse failures stay errors and Hui structured content preserves media and links', async () => {
  const sessions={describe:async()=>({site:resolveSite('keke','endfield')}),rememberLinks:()=>{},fetch:async()=>new Response('denied',{status:403}),
    page:async()=>({html:'challenge',url:'https://kekehxl.org/',status:403}),parse:async()=>({code:'VERIFY_REQUIRED',error:'Verify'})};
  const service=createSiteContent({sessions});
  await assert.rejects(service.list({source:'keke',gameId:'endfield'}),e=>e.code==='VERIFY_REQUIRED');
  sessions.fetch=async()=>new Response('<html>unknown</html>');sessions.parse=async()=>({code:'PARSE_ERROR',error:'Unknown structure'});
  await assert.rejects(service.list({source:'keke',gameId:'endfield'}),e=>e.code==='PARSE_ERROR');
  const post=huiPost({id:'a'.repeat(24),title:'Fixture',body:[{tag:'img',src:'/media/a.png'},{tag:'a',href:'https://pan.quark.cn/s/fixture',children:[{tag:'text',text:'Download'}]}]},'endfield');
  assert.equal(post.images[0].url,'https://huiyue.org/media/a.png');assert.equal(post.links[0].url,'https://pan.quark.cn/s/fixture');assert.match(post.content,/Download/);
});
test('browser downloads join the existing manager, preserve game identity and restore safely', async t => {
  const userData = temporary(t), progress = [], links = [];
  const options = { userData, services: {}, transfer: async () => { throw Error('Browser item must not use HTTP queue'); },
    controlTransfer: () => {}, getCacheDir: () => userData, openSource: async payload => { links.push(payload); return {}; }, onProgress: item => progress.push(item) };
  const manager = createArchiveDownloads(options);
  t.after(() => manager.shutdown());
  function downloadItem() {
    const item = new EventEmitter();
    Object.assign(item, { getFilename: () => '../fixture.zip', getMimeType: () => 'application/zip', getTotalBytes: () => 100,
      getReceivedBytes: () => 60, setSavePath: value => { item.path = value; }, isPaused: () => !!item.paused,
      pause: () => { item.paused = true; }, resume: () => { item.paused = false; }, canResume: () => true, cancel: () => item.emit('done', {}, 'cancelled') });
    return item;
  }
  const item = downloadItem();
  assert.equal(manager.adoptBrowserDownload({ source: 'arca', gameId: 'endfield', sourceUrl: resolveSite('arca', 'endfield').url, item }), true);
  const task = manager.list().tasks[0];
  assert.equal(task.gameId, 'endfield'); assert.equal(task.provider, 'archive');
  assert.ok(item.path.startsWith(path.join(userData, 'sites') + path.sep));
  item.emit('updated', {}, 'progressing');
  manager.control({ taskId: task.taskId, action: 'pause' }); assert.equal(item.paused, true);
  manager.control({ taskId: task.taskId, action: 'resume' }); assert.equal(item.paused, false);
  fs.writeFileSync(item.path, 'fixture'); item.emit('done', {}, 'completed');
  assert.deepEqual(manager.importPaths({ taskId: task.taskId }), { paths: [item.path] });
  manager.adoptBrowserDownload({ source: 'arca', gameId: 'zzz', sourceUrl: 'https://arca.live/', item: downloadItem() });
  manager.shutdown();
  const restored = createArchiveDownloads(options); t.after(() => restored.shutdown());
  const failed = restored.list().tasks.find(item => item.status === 'error'); assert.equal(failed.gameId, 'zzz');
  await restored.control({ taskId: failed.taskId, action: 'retry' }); assert.equal(links[0].source, 'arca');
  restored.control({ taskId: task.taskId, action: 'delete' }); assert.equal(fs.readFileSync(item.path, 'utf8'), 'fixture');
  restored.shutdown();
});
