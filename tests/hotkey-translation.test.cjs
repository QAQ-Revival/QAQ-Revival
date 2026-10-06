const test = require('node:test');
const assert = require('node:assert/strict');
const { createHotkeyTranslator, registerHotkeyTranslation } = require('../app/out/main/hotkey-translation.cjs');
const reply = text => new Response(JSON.stringify([[[text, 'source', null, null]], null, 'en']));

test('Google request encodes labels, joins segments, preserves row order and caches duplicate names', async () => {
  const requests = [];
  const translate = createHotkeyTranslator({ fetch: async (address, options) => {
    const url = new URL(address);
    assert.equal(url.origin + url.pathname, 'https://translate.googleapis.com/translate_a/single');
    assert.equal(url.searchParams.get('client'), 'gtx');
    assert.equal(url.searchParams.get('sl'), 'auto');
    assert.equal(url.searchParams.get('tl'), 'zh-CN');
    assert.equal(options.credentials, 'omit');
    const name = url.searchParams.get('q');
    requests.push(name);
    await new Promise(resolve => setTimeout(resolve, name === 'belt' ? 15 : 1));
    return new Response(JSON.stringify([[[name === 'belt' ? '腰' : '帮助', name], ['带', '']], null, 'en']));
  } });
  assert.deepEqual(await translate(['belt', 'belt', 'swp_5a3faabb_help', '', '123']),
    { success: true, translations: ['腰带', '腰带', '帮助带', '', '123'] });
  assert.deepEqual(requests.sort(), ['belt', 'help']);
  await translate(['belt', 'swp_5a3faabb_help']);
  assert.equal(requests.length, 2);
  await translate(['a&b ? #衣服']);
  assert.equal(requests[2], 'a&b ? #衣服');
});

test('concurrent panels share in-flight translations and limit requests', async () => {
  let active = 0, peak = 0, count = 0;
  const translate = createHotkeyTranslator({ fetch: async () => {
    count++;
    peak = Math.max(peak, ++active);
    await new Promise(resolve => setTimeout(resolve, 10));
    active--;
    return reply('译文');
  } });
  await Promise.all([translate(['a', 'b', 'c', 'd']), translate(['a', 'b', 'c', 'd'])]);
  assert.equal(count, 4);
  assert.ok(peak <= 3);
});

test('failures are retriable and successful cached translations are retained', async () => {
  const requests = [];
  let fail = true;
  const translate = createHotkeyTranslator({ fetch: async address => {
    const name = new URL(address).searchParams.get('q');
    requests.push(name);
    if (fail && name === 'hat') return new Response('', { status: 429 });
    return reply(name === 'hat' ? '帽子' : '腰带');
  } });
  assert.match((await translate(['belt', 'hat'])).error, /限制请求/);
  fail = false;
  assert.deepEqual(await translate(['belt', 'hat']), { success: true, translations: ['腰带', '帽子'] });
  assert.deepEqual(requests, ['belt', 'hat', 'hat']);
});

test('bad responses, network errors and timeout are reported', async () => {
  for (const fetch of [async () => new Response('{}'), async () => new Response('not json'), async () => reply(''),
    async () => new Response('', { status: 503 }), async () => { throw Error('connection refused'); }]) {
    assert.equal((await createHotkeyTranslator({ fetch })(['belt'])).success, false);
  }
  const translate = createHotkeyTranslator({ timeoutMs: 5, fetch: (_, { signal }) => new Promise((_, reject) => {
    signal.addEventListener('abort', () => reject(Error('aborted')), { once: true });
  }) });
  assert.match((await translate(['belt'])).error, /超时/);
});

test('IPC rejects invalid input without network access and bounds the cache', async () => {
  let count = 0, handler;
  const fetch = async () => { count++; return reply('译文'); };
  registerHotkeyTranslation({ ipcMain: { handle: (channel, fn) => {
    assert.equal(channel, 'overlay-translate-hotkey-names'); handler = fn;
  } }, fetch });
  for (const input of [null, {}, ['a', 1], Array(201).fill('a'), ['a'.repeat(513)], Array(100).fill('a'.repeat(512))]) {
    assert.equal((await handler({}, input)).success, false);
  }
  assert.equal(count, 0);
  assert.deepEqual(await handler({}, []), { success: true, translations: [] });
  const translate = createHotkeyTranslator({ fetch, cacheLimit: 1 });
  await translate(['a']); await translate(['b']); await translate(['a']);
  assert.equal(count, 3);
});
