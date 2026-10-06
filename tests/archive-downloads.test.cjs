const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { mediaFile, mergeDetailFiles, allowedFileUrl } = require('../app/out/main/archive-media.cjs');
const { createPawchiveService } = require('../app/out/main/pawchive.cjs');
const { createArchiveDownloads } = require('../app/out/main/archive-downloads.cjs');
const attachment = { name: 'monson-LynaeSkinModToggle.zip', path: '/45/ff/45ffcae94a334e341101cf96c9b55b47d4f5671d7de6e85505f0d5bbde24f1fc.zip' };
test('Pawchive uses the actual file host and preserves the original filename query', () => {
  assert.equal(mediaFile(attachment, 'pawchive').url, 'https://file.pawchive.pw/data' + attachment.path + '?f=monson-LynaeSkinModToggle.zip');
  const file = mediaFile({ ...attachment, name: '中文 模组 & v2.zip' }, 'pawchive');
  assert.equal(new URL(file.url).searchParams.get('f'), '中文 模组 & v2.zip');
  assert.equal(file.isImage, false);
  for (const name of ['photo.PNG', 'photo.avif', 'photo.SVG', 'photo.heic']) assert.equal(mediaFile({ name, path: '/aa/' + name }, 'pawchive').isImage, true);
  for (const url of ['file:///C:/test.zip', 'https://kemono.cr.evil.test/data/a.zip', 'https://user@kemono.cr/data/a.zip', 'http://kemono.cr/data/a.zip']) assert.equal(allowedFileUrl(url, 'kemono'), false);
});
test('Kemono detail metadata enriches raw files with CDN servers without dropping images', async () => {
  const raw = { id: '1', user: '2', service: 'patreon', file: { name: 'cover.png', path: '/aa/cover.png' }, attachments: [attachment] };
  const detail = { post: raw, attachments: [{ ...attachment, server: 'https://n3.kemono.cr' }], previews: [{ ...raw.file, server: 'https://n1.kemono.cr' }] };
  const enriched = mergeDetailFiles(raw, detail);
  assert.equal(mediaFile(enriched.attachments[0], 'kemono').url, 'https://n3.kemono.cr/data' + attachment.path + '?f=' + attachment.name);
  const service = createPawchiveService({ userData: os.tmpdir(), source: 'kemono', fetch: async () => new Response(JSON.stringify(detail), { headers: { 'content-type': 'text/css' } }) });
  const { post } = await service.getPost({ id: '1', user: '2', service: 'patreon' });
  assert.equal(post.images.length, 1);
  assert.equal(new URL(post.images[0].url).hostname, 'n1.kemono.cr');
  assert.equal(new URL(post.attachments[0].url).hostname, 'n3.kemono.cr');
  assert.equal(new URL(mediaFile({ ...attachment, server: 'https://evil.test' }, 'kemono').url).hostname, 'kemono.cr');
});
function fixture(t) {
  const base = fs.realpathSync(os.tmpdir()), userData = fs.mkdtempSync(path.join(base, 'qaq-attachments-'));
  const events = [], runs = [], controls = [], opened = []; let fetches = 0;
  const post = { id: '1', user: '2', service: 'patreon', file: mediaFile({ name: 'cover.png', path: '/aa/cover.png' }, 'pawchive'), attachments: [mediaFile(attachment, 'pawchive')] };
  const options = { userData, services: { pawchive: { getPost: async () => { fetches++; return { post }; } } }, onProgress: value => events.push(value),
    openFile: async file => opened.push(file), controlTransfer: (id, action) => controls.push([id, action]),
    transfer: (task, progress) => new Promise((resolve, reject) => runs.push({ task, progress, resolve, reject })) };
  const manager = createArchiveDownloads(options);
  t.after(() => { manager.shutdown(); assert.equal(path.dirname(userData), base); fs.rmSync(userData, { recursive: true, force: true }); });
  return { userData, events, runs, controls, opened, post, options, manager, fetches: () => fetches, payload: { source: 'pawchive', post: { id: '1', user: '2', service: 'patreon' }, filePath: attachment.path } };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
test('attachment click revalidates the post, deduplicates clicks, uses shared controls and keeps downloaded bytes', async t => {
  const f = fixture(t);
  const [a,b] = await Promise.all([f.manager.download(f.payload), f.manager.download(f.payload)]); await tick();
  assert.equal(a.task.taskId, b.task.taskId); assert.equal(f.fetches(), 1); assert.equal(f.runs.length, 1);
  const id = a.task.taskId;
  assert.equal(f.runs[0].task.download.url, mediaFile(attachment, 'pawchive').url);
  assert.equal(f.runs[0].task.download.rejectHtml, true);
  f.runs[0].progress({ status: 'downloading', downloaded: 50, total: 100, percent: 50 });
  f.manager.control({ taskId: id, action: 'pause' });
  f.runs[0].progress({ status: 'downloading', percent: 60 });
  assert.equal(f.manager.list().tasks[0].status, 'paused');
  f.manager.control({ taskId: id, action: 'resume' });
  assert.equal(f.manager.list().tasks[0].status, 'downloading');
  assert.deepEqual(f.controls.map(x=>x[1]), ['pause','resume']);
  const target = path.join(f.userData, 'mod.zip'); fs.writeFileSync(target, 'bytes stay intact');
  f.runs[0].resolve(target); await tick();
  assert.equal(f.manager.list().tasks[0].status, 'completed');
  assert.deepEqual(f.manager.importPaths({ taskId: id }), { paths: [target] });
  await f.manager.open({ taskId: id }); assert.deepEqual(f.opened, [target]);
  const reloaded = createArchiveDownloads(f.options); assert.equal(reloaded.list().tasks[0].status, 'completed'); reloaded.shutdown();
  f.manager.control({ taskId: id, action: 'delete' });
  assert.equal(fs.readFileSync(target,'utf8'), 'bytes stay intact');
  assert.ok(f.events.every(event=>event.provider==='archive'));
});
test('failures remain retryable and unfinished attachment downloads restore paused', async t => {
  const f=fixture(t), {task}=await f.manager.download(f.payload); await tick();
  f.runs[0].reject(Error('HTTP 503')); await tick();
  assert.equal(f.manager.list().tasks[0].status,'error');
  f.manager.control({taskId:task.taskId,action:'retry'}); await tick();
  assert.equal(f.runs.length,2);
  const reloaded=createArchiveDownloads(f.options);assert.equal(reloaded.list().tasks[0].status,'paused');reloaded.shutdown();
});
test('images, preview-only files, unknown files and arbitrary URLs never start downloads', async t => {
  const f=fixture(t);
  for(const payload of [{...f.payload,filePath:f.post.file.path},{...f.payload,filePath:'/unknown.zip'},{...f.payload,source:'unknown'}]) await assert.rejects(f.manager.download(payload));
  f.post.attachments[0].previewOnly=true;await assert.rejects(f.manager.download(f.payload));
  f.post.attachments[0].previewOnly=false;f.post.attachments[0].url='https://evil.test/data/mod.zip';await assert.rejects(f.manager.download(f.payload));
  assert.equal(f.runs.length,0);
});
test('corrupt persisted records are preserved and cannot be overwritten', async t => {
  const f=fixture(t),state=path.join(f.userData,'attachment-downloads.json');fs.writeFileSync(state,'broken');
  const manager=createArchiveDownloads(f.options);assert.throws(()=>manager.list(),/原文件已保留/);await assert.rejects(manager.download(f.payload));manager.shutdown();
  assert.equal(fs.readFileSync(state,'utf8'),'broken');fs.unlinkSync(state);
});
