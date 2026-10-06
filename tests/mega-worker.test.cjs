const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const worker = path.resolve(__dirname, '../build/mega-worker-test/QAQMMegaWorker.exe');

function aes(mode, key, iv, input) {
  const cipher = crypto.createCipheriv('aes-128-' + mode, key, iv); cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(input), cipher.final()]);
}
function xor(a, b) { return Buffer.from(a.map((byte, i) => byte ^ b[i])); }
function fixtureFile(id, name, size) {
  const plain = Buffer.alloc(size); for (let i = 0; i < size; i++) plain[i] = (i * 37) & 255;
  const key = Buffer.from('00112233445566778899aabbccddeeff', 'hex');
  const nonce = Buffer.from('0123456789abcdef', 'hex');
  let mac = Buffer.alloc(16), offset = 0, chunk = 131072;
  do {
    const data = plain.subarray(offset, offset + chunk);
    const padded = Buffer.alloc(Math.max(16, Math.ceil(data.length / 16) * 16)); data.copy(padded);
    const chunkMac = aes('cbc', key, Buffer.concat([nonce, nonce]), padded).subarray(-16);
    mac = aes('ecb', key, null, xor(mac, chunkMac)); offset += data.length; chunk = Math.min(1048576, chunk + 131072);
  } while (offset < plain.length);
  const condensed = Buffer.concat([xor(mac.subarray(0, 4), mac.subarray(4, 8)), xor(mac.subarray(8, 12), mac.subarray(12, 16))]);
  const rawKey = Buffer.concat([xor(key, Buffer.concat([nonce, condensed])), nonce, condensed]);
  return { id, name, plain, key, rawKey, encrypted: aes('ctr', key, Buffer.concat([nonce, Buffer.alloc(8)]), plain) };
}
function attributes(name, key) {
  const data = Buffer.from('MEGA' + JSON.stringify({ n: name }));
  const padded = Buffer.alloc(Math.ceil(data.length / 16) * 16); data.copy(padded);
  return aes('cbc', key, Buffer.alloc(16), padded).toString('base64url');
}
async function fixture(t, corrupt = false) {
  const base = fs.realpathSync(os.tmpdir()), root = fs.mkdtempSync(path.join(base, 'qaqm-mega-worker-'));
  t.after(() => { assert.equal(path.dirname(fs.realpathSync(root)), base); fs.rmSync(root, { recursive: true, force: true }); });
  const first = fixtureFile('File0001', '测试模组.zip', 3 * 1024 * 1024 + 5);
  const second = fixtureFile('File0002', '第二个模组.zip', 262177);
  const files = [first, second];
  const folderKey = Buffer.from('ffeeddccbbaa99887766554433221100', 'hex');
  const node = (id, parent, name) => ({ h: id, p: parent, t: 1, a: attributes(name, folderKey), k: 'Root0001:' + aes('ecb', folderKey, null, folderKey).toString('base64url') });
  const tree = [node('Root0001', '', '分享根目录'), node('Folder01', 'Root0001', 'SubA'), node('Folder02', 'Folder01', 'SubB'),
    ...files.map((file, i) => ({ h: file.id, p: i ? 'Root0001' : 'Folder02', t: 0, s: file.plain.length,
      a: attributes(file.name, file.key), k: 'Root0001:' + aes('ecb', folderKey, null, file.rawKey).toString('base64url') }))];
  const server = http.createServer(async (request, response) => {
    if (request.url.startsWith('/api')) {
      let text = ''; for await (const data of request) text += data;
      const action = JSON.parse(text)[0]; let result;
      if (action.a === 'f') result = { f: tree };
      else { const file = files.find(item => item.id === (action.n || action.p)); result = file ? { s: file.plain.length, at: attributes(file.name, file.key), g: `http://127.0.0.1:${server.address().port}/data/${file.id}` } : -9; }
      response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify([result])); return;
    }
    const file = files.find(item => request.url.endsWith('/' + item.id));
    if (!file) { response.writeHead(404); response.end(); return; }
    if (request.method === 'HEAD') { response.writeHead(200, { 'content-length': file.encrypted.length }); response.end(); return; }
    const range = /bytes=(\d+)-(\d+)/.exec(request.headers.range || '');
    const from = range ? +range[1] : 0, to = range ? +range[2] : file.encrypted.length - 1;
    const data = Buffer.from(file.encrypted.subarray(from, to + 1)); if (corrupt && from === 0) data[0] ^= 1;
    response.writeHead(range ? 206 : 200, { 'content-length': data.length, 'content-range': `bytes ${from}-${to}/${file.encrypted.length}` });
    let offset = 0;
    const timer = setInterval(() => { if (offset >= data.length) { clearInterval(timer); response.end(); } else { response.write(data.subarray(offset, offset + 16384)); offset += 16384; } }, 8);
    response.on('close', () => clearInterval(timer));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  return { root, files, api: `http://127.0.0.1:${server.address().port}/api`, url: `https://mega.nz/folder/Root0001#${folderKey.toString('base64url')}` };
}
function runWorker(f, url = f.url, onEvent = () => {}) {
  const child = spawn(worker, [], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, QAQM_MEGA_TEST_API: f.api } });
  const events = [], errors = []; let buffer = '';
  const completion = new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(new Error('Worker timeout: ' + JSON.stringify(events.slice(-3)))); }, 30000);
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.stderr.on('data', data => errors.push(data.toString()));
    child.stdout.setEncoding('utf8'); child.stdout.on('data', chunk => {
      buffer += chunk; let end;
      while ((end = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, end).replace(/^\uFEFF/, '').trim(); buffer = buffer.slice(end + 1);
        if (line) { const event = JSON.parse(line); events.push(event); onEvent(event, child); }
      }
    });
    child.on('exit', code => { clearTimeout(timer); resolve({ events, code, errors }); });
  });
  child.stdin.on('error', () => {});
  child.stdin.write(JSON.stringify({ url, directory: f.root }) + '\n');
  return completion;
}

test('actual Revival core downloads nested folders, verifies bytes, and pauses/resumes through stdin', { timeout: 40000 }, async t => {
  const f = await fixture(t); let paused = false;
  const result = await runWorker(f, f.url, (event, child) => {
    if (!paused && event.status === 'downloading' && event.downloaded > 0) { paused = true; child.stdin.write('{"action":"pause"}\n'); setTimeout(() => child.stdin.write('{"action":"resume"}\n'), 250); }
  });
  assert.equal(result.events.at(-1).status, 'completed', JSON.stringify(result));
  assert.ok(result.events.some(event => event.status === 'paused'));
  assert.deepEqual(fs.readFileSync(path.join(f.root, 'SubA/SubB', f.files[0].name)), f.files[0].plain);
  assert.deepEqual(fs.readFileSync(path.join(f.root, f.files[1].name)), f.files[1].plain);
});

test('actual Revival core detects corrupt encrypted bytes and never publishes a corrupt final file', { timeout: 40000 }, async t => {
  const f = await fixture(t, true);
  const result = await runWorker(f, f.url + '/file/File0001');
  assert.equal(result.events.at(-1).status, 'error', JSON.stringify(result));
  assert.match(result.events.at(-1).error, /MAC|integrity|verification/i);
  assert.ok(!fs.existsSync(path.join(f.root, 'SubA/SubB', f.files[0].name)));
});

test('actual Revival core keeps resumable chunks on cancel and finishes the selected folder file on retry', { timeout: 40000 }, async t => {
  const f = await fixture(t); let canceled = false;
  const url = f.url + '/file/File0001';
  const first = await runWorker(f, url, (event, child) => {
    if (!canceled && event.status === 'downloading' && event.downloaded > 200000) { canceled = true; child.stdin.write('{"action":"cancel"}\n'); }
  });
  assert.equal(first.events.at(-1).status, 'canceled', JSON.stringify(first));
  assert.ok(fs.readdirSync(f.root).some(name => name.startsWith('.resume-')));
  const second = await runWorker(f, url);
  assert.equal(second.events.at(-1).status, 'completed', JSON.stringify(second));
  assert.deepEqual(fs.readFileSync(path.join(f.root, 'SubA/SubB', f.files[0].name)), f.files[0].plain);
  assert.ok(!fs.existsSync(path.join(f.root, f.files[1].name)), 'selected-file link must not download other files');
});
