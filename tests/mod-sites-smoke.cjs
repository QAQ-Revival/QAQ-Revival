const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
module.exports = async ({ electron, evaluate, waitFor, captureUI, window, handlers, passed, attachmentBytes }) => {
  const { session, BrowserWindow, BrowserView, app } = electron;
  const sourceIds = ['gamebanana', 'arca', 'loverslab', 'huiyue', 'keke'], requests = [];
  let kekeBroken = false;
  const image = 'https://images.gamebanana.com/smoke/preview.png';
  const kekeList = '<div class="elementor-loop-container"><div data-elementor-type="loop-item"><a href="https://kekehxl.org/product/fixture/"><img src="'+image+'"><h2>Interface fixture</h2></a></div></div><nav><span class="page-numbers current">1</span><a class="next page-numbers" href="?e-page-test=2">Next</a></nav>';
  const kekeDetail = '<div data-elementor-type="product"><h1>Interface fixture</h1><img src="'+image+'"><p>Install instructions</p><a href="https://mega.nz/file/AbcdEF12#'+Buffer.alloc(32,1).toString('base64url')+'">Download</a><script>window.fixtureInjected=true</script></div>';
  const arcaList = '<div class="list-table"><a class="vrow" href="/b/thingzyoa/123"><span class="title">Arca fixture</span><span class="nickname">Author</span><img src="'+image+'"></a></div>';
  const arcaDetail = '<div class="article-head"><h1 class="title">Arca fixture</h1><span class="nickname">Author</span></div><div class="article-content"><img src="'+image+'"><p>Arca full instructions</p><a href="https://arca.live/mod.zip">Archive</a></div>';
  const ll = '<form action="/topic/moderation"><h1 class="ipsType_pageTitle">Thread fixture</h1><article class="ipsComment" id="elComment_42"><h3><a href="/profile/1/">Author</a></h3><div data-role="commentContent"><p>Forum instructions</p><img src="'+image+'"><a href="/applications/core/interface/file/attachment.php?id=7">forum.zip</a></div></article></form>';
  const fixture = (game = 20357) => ({ _idRow: game, _sModelName: 'Mod', _sName: game === 20357 ? 'Wuwa Interface' : 'Endfield Interface', _aGame: { _idRow: game },
    _aSubmitter: { _idRow: 8, _sName: 'Fixture author' }, _sText: '<p>Banana full instructions</p><script>window.fixtureInjected=true</script>',
    _aPreviewMedia:{_aImages:[{_sBaseUrl:'https://images.gamebanana.com/smoke',_sFile:'preview.png'},{_sBaseUrl:'https://images.gamebanana.com/smoke',_sFile:'second.png'}]},
    _aFiles: [{ _idRow: 99, _sFile: 'interface-fixture.zip', _nFilesize: attachmentBytes.length, _sDownloadUrl: 'https://gamebanana.com/dl/99' }] });
  for (const source of sourceIds) {
    const value = session.fromPartition('persist:mod-site-' + source);
    await value.protocol.handle('https', async request => {
      const url = new URL(request.url); requests.push({source,url:url.href,ua:request.headers.get('user-agent')});
      if(url.pathname.startsWith('/smoke/')) return new Response('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#edccd8"/><text x="100" y="300" font-size="36">Mod preview</text></svg>',{headers:{'Content-Type':'image/svg+xml'}});
      if (url.pathname === '/dl/99') return new Response(attachmentBytes, { headers: { 'Content-Type': 'application/zip', 'Content-Length': String(attachmentBytes.length) } });
      if (source === 'gamebanana') {
        const game = Number(url.searchParams.get('_aFilters[Generic_Game]') || url.searchParams.get('_idGameRow') || url.pathname.split('/')[3]);
        const data = url.pathname.endsWith('ProfilePage') ? fixture(game) : { _aMetadata: { _nRecordCount: 1, _nPerpage: 24 }, _aRecords: [fixture(game)] };
        return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
      }
      if (source === 'huiyue') {
        const data = url.pathname.includes('/api/catalog') ? {items:[{id:'a'.repeat(24),title:'Hui fixture',game:'终末地',image}],total:1,page:1,total_pages:1} :
          {id:'a'.repeat(24),title:'Hui fixture',game:'终末地',body:[{tag:'img',src:image},{tag:'p',children:[{tag:'text',text:'Hui instructions'}]}]};
        return new Response(JSON.stringify(data), {headers:{'Content-Type':'application/json'}});
      }
      if (source === 'keke' && !(await value.cookies.get({name:'fixture_gate'})).length) {
        return new Response('<!doctype html><title>Just a moment...</title><h1>Verify fixture</h1><p>Complete synthetic verification</p>', {status:403,headers:{'Content-Type':'text/html'}});
      }
      const html = source === 'keke' ? kekeBroken ? '<h1>Unknown new layout</h1>' : url.pathname.startsWith('/product/') ? kekeDetail : kekeList :
        source === 'arca' ? url.pathname.endsWith('/123') ? arcaDetail : arcaList : ll;
      return new Response('<!doctype html><title>Site fixture</title>'+html, {headers:{'Content-Type':'text/html'}});
    });
  }
  const active = '.mod-download-provider:not([hidden])';
  const countWindows = BrowserWindow.getAllWindows().length;
  async function select(source) {
    await evaluate(`document.querySelector('.mod-download-source-trigger').click()`);
    await waitFor(`!!document.querySelector('.mod-download-source-option[data-source="${source}"]')`, 'source option');
    await evaluate(`document.querySelector('.mod-download-source-option[data-source="${source}"]').click()`);
    await waitFor(`document.querySelector('${active}')?.dataset.source === '${source}'`, 'source active');
  }
  async function click(label) {
    await evaluate(`(() => { const button = [...document.querySelectorAll('${active} button')].find(b => b.textContent.trim() === ${JSON.stringify(label)}); if (!button || button.disabled) throw Error('Missing button '+${JSON.stringify(label)}); button.click(); })()`);
  }
  await evaluate(`document.querySelector('.nav-item[aria-label="MOD下载"]').click()`);
  await waitFor(`!!document.querySelector('.mod-download-source-trigger')`, 'downloads');
  await select('keke');
  await waitFor(`!!document.querySelector('${active} .mod-site-verification-viewport')`, '403 embeds verification');
  for(let i=0;i<50&&!window.getBrowserViews().length;i++)await new Promise(resolve=>setTimeout(resolve,100));
  assert.equal(window.getBrowserViews().length,1);
  const view=window.getBrowserViews()[0];
  assert.equal(BrowserWindow.getAllWindows().length,countWindows,'No standalone source window');
  assert.doesNotMatch(view.webContents.getUserAgent(),/Electron|QAQ/i);
  assert.match(view.webContents.getUserAgent(),/Chrome\/\d/);
  assert.ok(view.webContents.getUserAgent().includes('Chrome/'+process.versions.chrome), 'UA matches the actual Chromium engine');
  const hints = await view.webContents.executeJavaScript('navigator.userAgentData.getHighEntropyValues(["fullVersionList"])');
  assert.ok(hints.fullVersionList.some(item => item.version === process.versions.chrome), 'Client Hints match the real engine');
  assert.equal(await view.webContents.executeJavaScript('typeof window.api + ":" + typeof require'),'undefined:undefined');
  assert.match(await view.webContents.executeJavaScript('document.body.textContent'),/Verify fixture/);
  await captureUI('mod-sites-inline-verification.png');
  const pendingRequests = requests.filter(item => item.source === 'keke').length;
  await click('完成验证，重新解析');
  await waitFor(`document.querySelector('.mod-site-verification [role="alert"]')?.textContent.includes('验证尚未完成')`, 'unfinished challenge stays open');
  assert.equal(window.getBrowserViews()[0], view);
  assert.equal(requests.filter(item => item.source === 'keke').length, pendingRequests, 'Finishing too early must not reload the challenge or start background requests');
  await session.fromPartition('persist:mod-site-keke').cookies.set({url:'https://kekehxl.org',name:'fixture_gate',value:'ok',path:'/'});
  await view.webContents.loadURL(view.webContents.getURL());
  await click('完成验证，重新解析');
  await waitFor(`!!document.querySelector('${active} .paw-post-card')`, 'keke parsed after verification');
  assert.equal(window.getBrowserViews().length,0);
  assert.ok(requests.filter(r=>r.source==='keke').every(r=>r.ua&&!/Electron|QAQ/i.test(r.ua)),'Fetches use standard Chrome UA: '+JSON.stringify(requests.filter(r=>r.source==='keke').map(r=>r.ua)));
  await evaluate(`document.querySelector('${active} .paw-post-card').click()`);
  await waitFor(`document.querySelector('.paw-post-content')?.textContent.includes('Install instructions')`, 'keke shared detail');
  await waitFor(`document.querySelector('.paw-gallery-image img')?.getAttribute('src')?.startsWith('data:image/')`,'authenticated preview uses source session');
  assert.equal(await evaluate('!!window.fixtureInjected'),false);
  assert.ok(await evaluate(`document.querySelectorAll('.paw-content-links button').length > 0`));
  await captureUI('mod-sites-keke-detail.png');
  await evaluate(`document.querySelector('[aria-label="关闭内容详情"]').click()`);
  kekeBroken=true;await click('刷新');
  await waitFor(`document.querySelector('${active} [role="alert"]')?.textContent.includes('没有识别')`, 'parse error is visible');
  assert.equal(window.getBrowserViews().length,0,'Parse failure never opens a browser');
  passed('Keke HTTP 403 embeds a sandboxed view in the current window; standard Chrome UA and the same cookies are reused to parse into shared cards; unknown layouts show an error');
  await select('gamebanana');await waitFor(`!!document.querySelector('${active} .paw-post-card')`, 'banana list');
  await evaluate(`document.querySelector('${active} .paw-post-card').click()`);
  await waitFor(`document.querySelector('.paw-post-content')?.textContent.includes('Banana full')`, 'banana shared detail');
  assert.equal(await evaluate(`document.querySelectorAll('.paw-gallery-thumbs button').length`),2);
  await captureUI('mod-sites-banana-detail.png');
  await evaluate(`document.querySelector('.paw-file').click()`);
  await waitFor(`document.querySelector('.paw-files')?.textContent.includes('已加入下载管理')`, 'banana attachment queued');
  let downloaded;
  for(let i=0;i<50;i++){downloaded=(await handlers.get('attachment:list')({})).tasks.find(t=>t.source==='gamebanana'&&t.status==='completed');if(downloaded)break;await new Promise(resolve=>setTimeout(resolve,100));}
  assert.ok(downloaded);assert.equal(downloaded.gameId,'wuthering-waves');assert.deepEqual(fs.readFileSync(downloaded.archivePath),attachmentBytes);
  await evaluate(`document.querySelector('[aria-label="关闭内容详情"]').click(); [...document.querySelectorAll('.qaqm-download-panel button')].find(b=>b.textContent.trim()==='×')?.click(); document.querySelector('.game-selector-trigger').click()`);
  await waitFor(`[...document.querySelectorAll('.game-selector-option')].some(item=>item.textContent.includes('明日方舟终末地'))`,'game menu');
  await evaluate(`[...document.querySelectorAll('.game-selector-option')].find(item=>item.textContent.includes('明日方舟终末地')).click()`);
  await waitFor(`document.querySelector('${active} .paw-post-card')?.textContent.includes('Endfield')`,'game-scoped card list');
  passed('GameBanana uses the same image gallery, detail dialog and download buttons as Pawchive; game switching keeps the source and changes its content');
  for(const [source,text] of [['arca','Arca full'],['loverslab','Forum instructions'],['huiyue','Hui instructions']]){
    await select(source);await waitFor(`!!document.querySelector('${active} .paw-post-card')`,source+' parsed list');
    await evaluate(`document.querySelector('${active} .paw-post-card').click()`);
    await waitFor(`document.querySelector('.paw-post-content')?.textContent.includes(${JSON.stringify(text)})`,source+' parsed detail');
    await evaluate(`document.querySelector('[aria-label="关闭内容详情"]').click()`);
  }
  assert.equal(BrowserWindow.getAllWindows().filter(w=>/^https?:/.test(w.webContents.getURL())).length,0,'No source creates a standalone web window');
  passed('Arca, LoversLab and Hui adapters parse lists and full details into the same local card UI without standalone windows');
  const parser=require('../app/out/main/site-parsers.cjs').parseSiteDocument;
  const blank=new BrowserView({webPreferences:{sandbox:true,nodeIntegration:false,contextIsolation:true}});await blank.webContents.loadURL('about:blank');
  const sample=path.join(__dirname,'../test-results/mod-source-probe/keke-unlocked.html');
  if(fs.existsSync(sample)){
    const data=await blank.webContents.executeJavaScriptInIsolatedWorld(1001,[{code:'('+parser.toString()+')('+JSON.stringify({source:'keke',url:'https://kekehxl.org/product-category/endfield-mod/',html:fs.readFileSync(sample,'utf8')})+')'}]);
    assert.ok(data.items.length>=20,'Real Keke page contains parsed product cards');assert.ok(data.nextUrl,'Real Keke pagination parsed');
    const detail=await blank.webContents.executeJavaScriptInIsolatedWorld(1001,[{code:'('+parser.toString()+')('+JSON.stringify({source:'keke',url:data.items[0].url,id:data.items[0].id,detail:true,html:fs.readFileSync(path.join(__dirname,'../test-results/mod-source-probe/keke-detail.html'),'utf8')})+')'}]);
    assert.ok(detail.items[0].images.length>0);assert.ok(detail.items[0].links.some(x=>x.url.includes('mega.nz')));
    passed('Saved real Keke HTML verifies product lists, pagination, detail images and download links');
  }
  blank.webContents.destroy();
  for(const source of sourceIds)session.fromPartition('persist:mod-site-'+source).protocol.unhandle('https');
  for(const contents of electron.webContents.getAllWebContents()) if(contents.getType()==='browserView') contents.destroy();
};
