const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createCharacterImageCache, MAX_IMAGE_BYTES } = require('../app/out/main/character-image-cache.cjs');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
const source = 'https://api.encore.moe/portrait.png';
const response = () => new Response(png, { headers: { 'Content-Type': 'image/png' } });
function fixture(t) {
  const parent = fs.realpathSync(os.tmpdir());
  const dir = fs.mkdtempSync(path.join(parent, 'qaqm-character-images-'));
  t.after(() => { assert.equal(path.dirname(fs.realpathSync(dir)), parent); fs.rmSync(dir, { recursive: true, force: true }); });
  return dir;
}

test('first download is persisted, shared by concurrent callers, and reused offline after restart', async t => {
  const cacheDir = fixture(t);
  let calls = 0;
  const cache = createCharacterImageCache({ cacheDir, fetchFn: async () => { calls++; return response(); } });
  const images = await Promise.all(Array.from({ length: 16 }, () => cache.get(source)));
  assert.equal(calls, 1);
  for (const image of images) { assert.deepEqual(image.bytes, png); assert.equal(image.mime, 'image/png'); }
  assert.equal(fs.readdirSync(cacheDir).length, 1);
  await cache.get(source);
  const restarted = createCharacterImageCache({ cacheDir, fetchFn: () => { throw Error('offline'); } });
  assert.deepEqual((await restarted.get(source)).bytes, png);
  assert.equal(calls, 1);
  await cache.get(source + '?revision=2');
  assert.equal(calls, 2);
  assert.equal(fs.readdirSync(cacheDir).length, 2);
  assert.notEqual(cache.coverUrl(source), cache.coverUrl(source + '?revision=2'));
});

test('different downloads are limited to four at a time and queued requests complete', async t => {
  let active = 0, peak = 0, calls = 0;
  const cache = createCharacterImageCache({ cacheDir: fixture(t), fetchFn: async () => {
    calls++; peak = Math.max(peak, ++active);
    await new Promise(resolve => setTimeout(resolve, 10));
    active--; return response();
  } });
  await Promise.all(Array.from({ length: 13 }, (_, index) => cache.get(source + '?id=' + index)));
  assert.equal(calls, 13); assert.equal(peak, 4);
});

test('failed downloads leave no file and can retry when connectivity recovers', async t => {
  const cacheDir = fixture(t);
  let offline = true;
  const cache = createCharacterImageCache({ cacheDir, fetchFn: async () => { if (offline) throw Error('offline'); return response(); } });
  await assert.rejects(cache.get(source), /offline/);
  assert.deepEqual(fs.readdirSync(cacheDir), []);
  offline = false;
  assert.deepEqual((await cache.get(source)).bytes, png);
  assert.equal(fs.readdirSync(cacheDir).some(name => name.endsWith('.tmp')), false);
});

test('corrupt or truncated cache files are replaced by a complete image', async t => {
  const cacheDir = fixture(t);
  let calls = 0;
  const cache = createCharacterImageCache({ cacheDir, fetchFn: async () => { calls++; return response(); } });
  await cache.get(source);
  const file = path.join(cacheDir, fs.readdirSync(cacheDir)[0]);
  fs.writeFileSync(file, png.subarray(0, 40));
  assert.deepEqual((await cache.get(source)).bytes, png);
  assert.deepEqual(fs.readFileSync(file), png);
  assert.equal(calls, 2);
});

test('cache write failures still display downloaded images without overwriting unrelated files', async t => {
  const dir = fixture(t), cacheDir = path.join(dir, 'blocked');
  fs.writeFileSync(cacheDir, 'preserve');
  const errors = [];
  const cache = createCharacterImageCache({ cacheDir, fetchFn: async () => response(), onCacheError: error => errors.push(error) });
  assert.deepEqual((await cache.get(source)).bytes, png);
  assert.equal(fs.readFileSync(cacheDir, 'utf8'), 'preserve');
  assert.ok(errors.length > 0);
});

test('HTTP failures, HTML, truncated images and oversized bodies never become cached covers', async t => {
  const cacheDir = fixture(t);
  const responses = [
    () => new Response('unavailable', { status: 503 }),
    () => new Response('<html>not a cover</html>', { headers: { 'Content-Type': 'image/png' } }),
    () => new Response(png.subarray(0, 40)),
    () => new Response(png, { headers: { 'Content-Length': String(MAX_IMAGE_BYTES + 1) } }),
    () => new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(MAX_IMAGE_BYTES + 1)); controller.close(); } }))
  ];
  for (const fetchFn of responses) {
    const cache = createCharacterImageCache({ cacheDir, fetchFn });
    await assert.rejects(cache.get(source));
    assert.deepEqual(fs.readdirSync(cacheDir), []);
  }
});

test('only allowed HTTPS image sources and redirects can be fetched', async t => {
  const cacheDir = fixture(t), calls = [];
  const cache = createCharacterImageCache({ cacheDir, fetchFn: async url => {
    calls.push(url);
    return url === source ? new Response(null, { status: 302, headers: { Location: '/redirected.png' } }) : response();
  } });
  for (const url of ['file:///secret.png', 'http://localhost/image.png', 'https://other.test/image.png', 'https://user:pass@api.encore.moe/image.png']) {
    assert.equal(cache.coverUrl(url), null); await assert.rejects(cache.get(url));
  }
  assert.deepEqual(calls, []);
  await cache.get(source);
  assert.deepEqual(calls, [source, 'https://api.encore.moe/redirected.png']);
  const rejected = createCharacterImageCache({ cacheDir, fetchFn: async () => new Response(null, { status: 302, headers: { Location: 'http://127.0.0.1/private' } }) });
  await assert.rejects(rejected.get(source + '?unsafe'), /redirect/);
});

test('the image protocol serves bytes, rejects arbitrary paths, and does not cache errors', async t => {
  let offline = false, calls = 0;
  const cache = createCharacterImageCache({ cacheDir: fixture(t), fetchFn: async () => { calls++; if (offline) throw Error('offline'); return response(); } });
  const request = { method: 'GET', url: cache.coverUrl(source) };
  const result = await cache.handle(request);
  assert.equal(result.status, 200);
  assert.equal(result.headers.get('content-type'), 'image/png');
  assert.deepEqual(Buffer.from(await result.arrayBuffer()), png);
  assert.equal((await cache.handle({ ...request, method: 'POST' })).status, 400);
  assert.equal((await cache.handle({ ...request, url: 'qaq-character-cover://image/secret' })).status, 400);
  assert.equal(calls, 1);
  offline = true;
  const failed = await cache.handle({ ...request, url: cache.coverUrl(source + '?new') });
  assert.equal(failed.status, 502); assert.equal(failed.headers.get('cache-control'), 'no-store');
  assert.equal((await cache.handle(request)).status, 200);
});

test('an official fallback recovers a rejected image and stays available offline under the original cache key', async t => {
  const cacheDir = fixture(t), requests = [];
  const fallback = 'https://hw-media-cdn-mingchao.kurogame.com/object/outfit.jpg';
  const cache = createCharacterImageCache({ cacheDir, fetchFn: async url => {
    requests.push(url);
    return url === source ? new Response('Forbidden', { status: 403 }) : response();
  } });
  const url = cache.coverUrl(source, ['file:///private', fallback]);
  assert.equal(new URL(url).searchParams.getAll('fallback').length, 1);
  const result = await cache.handle({ method: 'GET', url });
  assert.equal(result.status, 200);
  assert.deepEqual(Buffer.from(await result.arrayBuffer()), png);
  assert.deepEqual(requests, [source, fallback]);
  const restarted = createCharacterImageCache({ cacheDir, fetchFn: () => { throw Error('offline'); } });
  assert.deepEqual((await restarted.get(source, [fallback])).bytes, png);
});
