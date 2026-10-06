const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { createSoftwareUpdates, newerVersion, startUpdateChecks, API_URL } = require('../app/out/main/software-updates.cjs');
const release = (version='1.0.2') => ({ tag_name: 'v'+version, html_url: 'https://github.com/QAQ-Revival/QAQ-Revival/releases/tag/v'+version, published_at: '2026-10-06T00:00:00Z', body: '修复说明' });
function fixture(t) {
  const base = fs.realpathSync(os.tmpdir()), userData = fs.mkdtempSync(path.join(base, 'qaq-updates-'));
  t.after(()=>{ assert.equal(path.dirname(userData),base);fs.rmSync(userData,{recursive:true,force:true}); });
  let time = new Date(2026,9,6,23,59).getTime(), responder = () => new Response(JSON.stringify(release()),{headers:{etag:'"release-1"'}});
  const calls=[];
  const options={userData,version:'1.0.1',now:()=>time,fetch:async (url,options)=>{calls.push({url,options});return responder();}};
  return { userData,options,calls,service:createSoftwareUpdates(options),at:value=>time=value,response:value=>responder=value };
}
test('public GitHub check defaults to one local calendar day, including midnight and restart',async t=>{
  const f=fixture(t);assert.equal(f.service.getState().intervalDays,1);assert.equal(f.service.getState().enabled,true);
  assert.equal((await f.service.check()).updateAvailable,true);await f.service.check();assert.equal(f.calls.length,1);
  const again=createSoftwareUpdates(f.options);await again.check();assert.equal(f.calls.length,1);
  f.at(new Date(2026,9,7,0,1).getTime());await again.check();assert.equal(f.calls.length,2);
  for(const {url,options} of f.calls){assert.equal(url,API_URL);assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');assert.ok(!Object.keys(options.headers).some(key=>/authorization|cookie/i.test(key)));}
});
test('disabled automatic checking still allows manual checks; frequency persists and validates',async t=>{
  const f=fixture(t);f.service.configure({enabled:false,intervalDays:7});await f.service.check();assert.equal(f.calls.length,0);
  await f.service.check({manual:true});assert.equal(f.calls.length,1);
  f.service.configure({enabled:true,intervalDays:7});
  f.at(new Date(2026,9,12,20).getTime());await f.service.check();assert.equal(f.calls.length,1);
  f.at(new Date(2026,9,13,0,1).getTime());await f.service.check();assert.equal(f.calls.length,2);
  assert.equal(createSoftwareUpdates(f.options).getState().intervalDays,7);
  for(const intervalDays of [0,366,1.5,'7',null])assert.throws(()=>f.service.configure({enabled:true,intervalDays}));
  assert.equal(f.service.getState().intervalDays,7);
});
test('failed checks reserve the day; manual retry recovers without a restart',async t=>{
  const f=fixture(t);f.response(()=>{throw Error('offline')});assert.match((await f.service.check()).error,/offline/);
  await f.service.check();await createSoftwareUpdates(f.options).check();assert.equal(f.calls.length,1);
  f.response(()=>new Response(JSON.stringify(release())));assert.equal((await f.service.check({manual:true})).error,'');assert.equal(f.calls.length,2);
});
test('concurrent checks share one request and return settled state',async t=>{
  const f=fixture(t);let complete;f.response(()=>new Promise(resolve=>complete=resolve));
  const a=f.service.check(), b=f.service.check({manual:true});await Promise.resolve();assert.equal(f.calls.length,1);
  complete(new Response(JSON.stringify(release())));const results=await Promise.all([a,b]);assert.ok(results.every(r=>!r.checking&&r.updateAvailable));
});
test('ETag 304 reuses release details and dismissed notifications stay dismissed',async t=>{
  const f=fixture(t);await f.service.check();f.service.dismiss('1.0.2');f.response(()=>new Response(null,{status:304}));
  const result=await f.service.check({manual:true});assert.equal(f.calls[1].options.headers['If-None-Match'],'"release-1"');assert.equal(result.release.version,'1.0.2');assert.equal(result.dismissedVersion,'1.0.2');
  assert.equal(createSoftwareUpdates(f.options).getState().dismissedVersion,'1.0.2');
});
test('404, rate limiting and untrusted release URLs have distinct safe outcomes',async t=>{
  const f=fixture(t);f.response(()=>new Response('{}',{status:404}));assert.equal((await f.service.check()).noRelease,true);
  f.response(()=>new Response('{}',{status:429,headers:{'retry-after':'60'}}));assert.match((await f.service.check({manual:true})).error,/限制请求/);
  const count=f.calls.length;await f.service.check({manual:true});assert.equal(f.calls.length,count);
  f.at(new Date(2026,9,7,1).getTime());f.response(()=>new Response(JSON.stringify({...release(),html_url:'https://evil.test/download'})));
  assert.match((await f.service.check({manual:true})).error,/地址无效/);assert.equal(f.service.getState().release,null);
});
test('version comparisons are numeric and do not promote prereleases or downgrades',()=>{
  assert.equal(newerVersion('1.10.0','1.9.9'),true);assert.equal(newerVersion('1.0.0','1.0.1'),false);
  assert.equal(newerVersion('v2.0.0','1.0.1'),true);assert.equal(newerVersion('1.0.2-rc1','1.0.1'),false);assert.equal(newerVersion('1.0.1','1.0.1'),false);
});
test('scheduler checks on startup, calendar polling and resume, then cleans up',async()=>{
  let calls=0,tick,cleared=false;const powerMonitor=new EventEmitter();
  const stop=startUpdateChecks({check:async()=>{calls++}},{powerMonitor,setInterval:(callback,ms)=>{tick=callback;assert.equal(ms,60000);return{unref(){}}},clearInterval:()=>cleared=true});
  await Promise.resolve();powerMonitor.emit('resume');tick();assert.equal(calls,3);stop();tick();powerMonitor.emit('resume');assert.equal(calls,3);assert.ok(cleared);
});
test('damaged update preferences are preserved without automatic requests',async t=>{
  const f=fixture(t),file=path.join(f.userData,'software-updates.json');fs.writeFileSync(file,'broken');const service=createSoftwareUpdates(f.options);
  assert.match(service.getState().error,/原文件已保留/);await assert.rejects(service.check());assert.equal(f.calls.length,0);assert.equal(fs.readFileSync(file,'utf8'),'broken');
});
