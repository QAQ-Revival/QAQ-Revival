const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { parseMegaLink, extractMegaLinks, unlockMegaLink } = require('../app/out/main/mega-revival.cjs');
const { createMegaTaskManager, registerRevivalIpc } = require('../app/out/main/mega-task-manager.cjs');
const file = 'https://mega.nz/file/AbcdEF12#' + 'a'.repeat(43);
const folder = 'https://mega.nz/folder/BbcdEF12#' + 'b'.repeat(22);
const tick = () => new Promise(resolve => setImmediate(resolve));
function protectedLink({ algorithm = 2, folder = false, password = '作者密码' } = {}) {
  const crypto = require('node:crypto');
  const salt = Buffer.from(Array.from({ length: 32 }, (_,i)=>i)), key = Buffer.alloc(folder ? 16 : 32, 7), handle = Buffer.from('AbcdEF12','base64url');
  const derived = crypto.pbkdf2Sync(password.trim(), salt, algorithm === 0 ? 1000 : 100000, 64, 'sha512');
  const encrypted = Buffer.from(key.map((value,i)=>value ^ derived[i]));
  const data = Buffer.concat([Buffer.from([algorithm,folder?0:1]),handle,salt,encrypted]);
  const mac = algorithm===1 ? crypto.createHmac('sha256',data).update(derived.subarray(32)).digest() : crypto.createHmac('sha256',derived.subarray(32)).update(data).digest();
  return { url:'https://mega.nz/#P!'+Buffer.concat([data,mac]).toString('base64url'), normal:`https://mega.nz/${folder?'folder':'file'}/AbcdEF12#${key.toString('base64url')}` };
}
test('MEGA #P! links in unlinked HTML text are recognized and decrypted with the supplied password', async () => {
  const real='https://mega.nz/#P!AgE8iEVIvoDc8tZGJHvIJI5iHHkfFrBZkIqrklYUUbfzuh7GaPVRsM1UyHmMDwTRFKtbFgA1y51ieinAtFSea4u-fI5Ecuje-Ig1gTduCZrkn4ay0ebDP5V11e4GAj9kEmKGqsUCkJI';
  assert.equal(extractMegaLinks('<p>'+real+'</p>')[0].needsPassword,true);
  for(const algorithm of [0,1,2]) for(const folder of [false,true]) {
    const fixture=protectedLink({algorithm,folder});
    assert.equal((await unlockMegaLink(fixture.url,' 作者密码 ')).url,fixture.normal);
    await assert.rejects(unlockMegaLink(fixture.url,'wrong'),/密码不正确/);
  }
  await assert.rejects(unlockMegaLink(real,''),/填写作者提供的密码/);
  assert.throws(()=>parseMegaLink('https://mega.nz/#P!short'));
});

test('recognizes HTML and plain MEGA links, legacy shares, missing keys and selected folder children', () => {
  const links = extractMegaLinks(`<a href="${file}">download</a> ${file} ${folder}/file/Child123 ${folder}/folder/Subdir12 https://mega.co.nz/#F!ZbcdEF12!${'c'.repeat(22)} https://mega.nz/#!AbcdEF12!${'a'.repeat(43)} mega://enc2?abcdefgh`);
  assert.equal(links.length, 5);
  assert.ok(links.some(link => link.url.endsWith('/file/Child123')));
  assert.ok(links.some(link => link.url.endsWith('/folder/Subdir12')));
  assert.equal(parseMegaLink('https://mega.nz/file/AbcdEF12').needsKey, true);
  assert.equal(parseMegaLink('https://mega.nz/file/AbcdEF12', 'a'.repeat(43)).url, file);
  for (const invalid of ['file:///C:/Windows/notepad.exe', 'https://mega.nz.evil/file/AbcdEF12#key', 'https://mega.nz/file/AbcdEF12#short', 'https://evil@mega.nz/file/AbcdEF12']) assert.throws(() => parseMegaLink(invalid));
});
function fixture(t, overrides = {}) {
  const base = fs.realpathSync(os.tmpdir());
  const userData = fs.mkdtempSync(path.join(base, 'qaqm-mega-manager-'));
  const executable = path.join(userData, 'mock-worker.exe'); fs.writeFileSync(executable, 'Not executed');
  const events = [], children = [];
  const options = { userData, executable, getCacheDir: () => path.join(userData, 'downloads'), onProgress: event => events.push(event),
    spawn: (file, args, options) => {
      const child = new EventEmitter(); child.stdin = new PassThrough(); child.stdout = new PassThrough(); child.stderr = new PassThrough();
      child.requests = []; child.stdin.on('data', bytes => child.requests.push(JSON.parse(bytes.toString())));
      child.progress = data => child.stdout.write(JSON.stringify(data) + '\n');
      child.kill = () => child.emit('close'); child.call = { file, args, options }; children.push(child);
      process.nextTick(() => child.emit('spawn')); return child;
    }, ...overrides };
  const manager = createMegaTaskManager(options);
  t.after(() => {
    manager.shutdown(); children.forEach(child => child.kill());
    assert.equal(path.dirname(fs.realpathSync(userData)), base); fs.rmSync(userData, { recursive: true, force: true });
  });
  return { manager, events, children, userData, options };
}
test('MEGA is queued in the shared download cache, progress and controls use the source worker, keys stay off argv/UI', async t => {
  const f = fixture(t);
  const result = await f.manager.download({ links: [file, file, folder], name: '模组测试' });
  await tick(); assert.equal(result.count, 2); assert.equal(f.children.length, 2);
  assert.deepEqual(f.children[0].call.args, []);
  assert.equal(f.children[0].call.options.shell, false);
  assert.equal(f.children[0].call.options.windowsHide, true);
  assert.equal(f.children[0].requests[0].url, file);
  assert.ok(f.children[0].requests[0].directory.startsWith(path.join(f.userData, 'downloads/MEGA')));
  assert.ok(!('url' in result.tasks[0]));
  const id = result.tasks[0].taskId;
  f.children[0].progress({ status: 'downloading', downloaded: 500, total: 1000, percent: 50 });
  assert.equal(f.manager.list().tasks[0].percent, 50);
  f.manager.control({ taskId: id, action: 'pause' });
  assert.deepEqual(f.children[0].requests.at(-1), { action: 'pause' });
  f.manager.control({ taskId: id, action: 'resume' });
  assert.deepEqual(f.children[0].requests.at(-1), { action: 'resume' });
  f.children[0].progress({ status: 'completed', percent: 100 }); f.children[0].kill();
  assert.equal(f.manager.list().tasks[0].status, 'completed');
  await assert.rejects(f.manager.download({ links: ['https://mega.nz/file/AbcdEF12'] }), /缺少/);
});
test('restarts retain resumable tasks; delete removes the task without deleting downloaded files', async t => {
  const f = fixture(t);
  const result = await f.manager.download({ links: [folder] }); await tick();
  const task = f.manager.list().tasks[0];
  fs.writeFileSync(path.join(task.archivePath, 'already-downloaded.txt'), 'preserve');
  f.manager.control({ taskId: task.taskId, action: 'pause' });
  const reloaded = createMegaTaskManager(f.options);
  assert.equal(reloaded.list().tasks[0].status, 'paused');
  f.manager.control({ taskId: task.taskId, action: 'delete' }); f.children[0].kill();
  assert.equal(f.manager.list().tasks.length, 0);
  assert.equal(fs.readFileSync(path.join(task.archivePath, 'already-downloaded.txt'), 'utf8'), 'preserve');
});
test('a corrupt queue cannot crash startup or be overwritten by a new task', async t => {
  const f = fixture(t);
  const state = path.join(f.userData, 'mega-downloads.json'); fs.writeFileSync(state, 'broken');
  const recovered = createMegaTaskManager(f.options);
  assert.throws(() => recovered.list(), /原文件已保留/);
  await assert.rejects(recovered.download({ links: [file] }), /原文件已保留/);
  recovered.shutdown();
  assert.equal(fs.readFileSync(state, 'utf8'), 'broken');
});
test('completed downloads can prepare archives or whole loose Mods for import without changing their files', async t => {
  const f = fixture(t);
  const { tasks: [task] } = await f.manager.download({ links: [folder] }); await tick();
  assert.throws(() => f.manager.importPaths({ taskId: task.taskId }), /等待下载完成/);
  fs.writeFileSync(path.join(task.archivePath, 'mod.zip'), 'archive fixture');
  fs.writeFileSync(path.join(task.archivePath, '.resume-test.json'), '{}');
  fs.writeFileSync(path.join(task.archivePath, 'partial.zip.part'), 'partial');
  f.children[0].progress({ status: 'completed', percent: 100 }); f.children[0].kill();
  assert.deepEqual(f.manager.importPaths({ taskId: task.taskId }).paths, [path.join(task.archivePath, 'mod.zip')]);
  assert.equal(fs.readFileSync(path.join(task.archivePath, 'mod.zip'), 'utf8'), 'archive fixture');
  fs.writeFileSync(path.join(task.archivePath, 'mod.ini'), '[TextureOverride]');
  assert.deepEqual(f.manager.importPaths({ taskId: task.taskId }).paths, [task.archivePath]);
});

test('EXDEV saves preserve resumable tasks through worker events and shutdown', async t => {
  const f = fixture(t);
  const state = path.join(f.userData, 'mega-downloads.json');
  const rename = fs.renameSync;
  t.mock.method(fs, 'renameSync', (from, to) => {
    if (to === state) throw Object.assign(Error('rename rejected'), { code: 'EXDEV' });
    return rename(from, to);
  });
  await f.manager.download({ links: [file, folder] }); await tick();
  f.children[0].progress({ status: 'completed', percent: 100 });
  f.children[1].progress({ status: 'downloading', percent: 50 });
  assert.doesNotThrow(() => f.manager.shutdown());
  f.children.forEach(child => child.kill());
  const restarted = createMegaTaskManager(f.options);
  assert.deepEqual(restarted.list().tasks.map(task => task.status), ['completed', 'paused']);
  assert.equal(restarted.list().tasks[1].percent, 50);
  assert.equal(fs.existsSync(state + '.tmp'), false);
  assert.doesNotThrow(() => f.manager.shutdown());
});

test('before-quit reports save failure without throwing or overwriting old tasks', async t => {
  const errors = [];
  const f = fixture(t, { onPersistenceError: error => errors.push(error.code) });
  const app = new EventEmitter();
  const manager = registerRevivalIpc({ ...f.options, app, ipcMain: { handle() {} },
    BrowserWindow: { getAllWindows: () => [] }, shell: { openPath: async () => '' } });
  await manager.download({ links: [file] }); await tick();
  const state = path.join(f.userData, 'mega-downloads.json');
  const saved = fs.readFileSync(state, 'utf8');
  const rename = fs.renameSync;
  const renameMock = t.mock.method(fs, 'renameSync', (from, to) => {
    if (to === state) throw Object.assign(Error('rename rejected'), { code: 'EXDEV' });
    return rename(from, to);
  });
  const copyMock = t.mock.method(fs, 'copyFileSync', (_, to) => { fs.writeFileSync(to, '{partial'); throw Object.assign(Error('disk full'), { code: 'ENOSPC' }); });
  assert.doesNotThrow(() => app.emit('before-quit'));
  assert.deepEqual(errors, ['ENOSPC']);
  assert.equal(fs.readFileSync(state, 'utf8'), saved);
  assert.equal(manager.list().tasks[0].status, 'paused');
  f.children.forEach(child => assert.doesNotThrow(() => child.kill()));
  assert.equal(manager.list().tasks[0].status, 'paused');
  copyMock.mock.restore(); renameMock.mock.restore();
});

test('worker spawn and exit callbacks report persistence errors instead of throwing', async t => {
  const errors = [];
  const f = fixture(t, { onPersistenceError: error => errors.push(error.code) });
  await f.manager.download({ links: [file] });
  const state = path.join(f.userData, 'mega-downloads.json');
  const rename = fs.renameSync;
  const mocked = t.mock.method(fs, 'renameSync', (from, to) => {
    if (to === state) throw Object.assign(Error('access denied'), { code: 'EACCES' });
    return rename(from, to);
  });
  await tick();
  assert.equal(f.children[0].requests[0].url, file);
  assert.doesNotThrow(() => f.children[0].kill());
  assert.equal(f.manager.list().tasks[0].status, 'error');
  assert.deepEqual(errors, ['EACCES', 'EACCES']);
  mocked.mock.restore();
});

test('shutdown finishes pending task deletion without removing downloaded files', async t => {
  const f = fixture(t);
  const { tasks: [task] } = await f.manager.download({ links: [file] }); await tick();
  const downloaded = path.join(task.archivePath, 'keep.txt');
  fs.writeFileSync(downloaded, 'downloaded data');
  f.manager.control({ taskId: task.taskId, action: 'delete' });
  f.manager.shutdown();
  f.children[0].kill();
  assert.deepEqual(createMegaTaskManager(f.options).list().tasks, []);
  assert.equal(fs.readFileSync(downloaded, 'utf8'), 'downloaded data');
});
