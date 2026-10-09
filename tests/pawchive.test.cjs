const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createPawchiveService, startDailyChecks, localDayKey, timestamp } = require('../app/out/main/pawchive.cjs');

function fixture(t) {
  const base = fs.realpathSync(os.tmpdir());
  const userData = fs.mkdtempSync(path.join(base, 'qaqm-pawchive-'));
  t.after(() => { assert.equal(path.dirname(fs.realpathSync(userData)), base); fs.rmSync(userData, { recursive: true, force: true }); });
  const authors = [
    { id: '123', service: 'patreon', name: '测试作者', updated: 1786440000 },
    { id: '123', service: 'fanbox', name: '另一平台', updated: 1786440000 }
  ];
  const posts = Array.from({ length: 52 }, (_, i) => ({ id: String(1000 - i), user: '123', service: 'patreon', title: `历史帖子 ${i}`,
    content: '<p>Original</p>', published: '2026-08-11T00:25:35', edited: '2026-08-11T00:25:35', attachments: [] }));
  const calls = [], progress = [], states = [];
  let fail = '', now = Date.parse('2026-09-01T00:00:00Z');
  const options = { userData, now: () => now, onProgress: value => progress.push(value), onStateChanged: value => states.push(value), fetch: async url => {
    const parsed = new URL(url), endpoint = parsed.pathname.replace('/api/v1', ''); calls.push(endpoint + parsed.search);
    if (fail && (fail === 'all' || (fail === 'page2' && parsed.searchParams.get('o') === '50'))) return new Response('{}', { status: 503, headers: { 'content-type': 'application/json' } });
    let data;
    if (endpoint === '/creators') data = authors;
    else if (endpoint.endsWith('/profile')) data = authors.find(a => endpoint.startsWith('/' + a.service));
    else if (endpoint.includes('/post/')) data = posts.find(p => endpoint.endsWith('/' + p.id));
    else data = endpoint.startsWith('/fanbox') ? [] : posts.slice(Number(parsed.searchParams.get('o') || 0), Number(parsed.searchParams.get('o') || 0) + 50);
    return new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
  } };
  return { userData, authors, posts, calls, progress, states, options, service: createPawchiveService(options), fail: value => { fail = value; }, advance: () => { now += 3600000; }, setTime: value => { now = value; } };
}
const creator = { id: '123', service: 'patreon' };

test('UTC timestamps preserve the Published / Edited distinction', () => {
  assert.equal(timestamp('2026-08-11T00:25:35'), Date.parse('2026-08-11T00:25:35Z'));
  assert.equal(timestamp('2026-09-11T15:15:06'), Date.parse('2026-09-11T15:15:06Z'));
  assert.equal(timestamp(1786440000), 1786440000000);
});

test('Pawchive repairs legacy avatar URLs in favorites and offline caches without rewriting saved data', async t => {
  const f = fixture(t);
  await f.service.listCreators();
  await f.service.setFavorite({ creator, favorite: true });
  const files = ['pawchive-favorites.json', 'pawchive-creators-cache.json'].map(name => path.join(f.userData, name));
  for (const file of files) {
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const author of saved.favorites || saved.creators) author.avatar = `https://img.pawchive.pw/icons/${author.service}/${author.id}`;
    fs.writeFileSync(file, JSON.stringify(saved));
  }
  const before = files.map(file => fs.readFileSync(file, 'utf8'));
  f.fail('all'); f.advance();
  const reopened = createPawchiveService(f.options);
  const avatar = 'https://pawchive.pw/icons/patreon/123';
  assert.equal(reopened.getState().favorites[0].avatar, avatar);
  assert.equal((await reopened.listCreators({ favoritesOnly: true })).items[0].avatar, avatar);
  const cached = await reopened.listCreators();
  assert.equal(cached.stale, true);
  assert.equal(cached.items.find(author => author.service === 'patreon').avatar, avatar);
  assert.deepEqual(files.map(file => fs.readFileSync(file, 'utf8')), before, 'loading preserves favorites, update baselines and cache bytes');
});

test('favorites establish all-page baseline, then detect new IDs and old-page edits independently', async t => {
  const f = fixture(t);
  await f.service.setFavorite({ creator, favorite: true });
  assert.ok(f.calls.includes('/patreon/user/123?o=50'));
  assert.equal(f.service.getState().postUpdateCount, 0);
  // The author directory's updated field deliberately remains unchanged.
  f.posts[51].edited = '2026-09-11T15:15:06';
  f.posts.unshift({ ...f.posts[0], id: 'new-post', title: '新增模组', published: '2026-09-12T12:00:00' });
  f.advance();
  const result = await f.service.checkUpdates();
  assert.equal(result.checked, 1);
  assert.equal(result.postUpdateCount, 2);
  const updates = f.service.getUpdates().items;
  assert.equal(updates.find(post => post.id === 'new-post').changeKind, 'new');
  assert.equal(updates.find(post => post.id === '949').changeKind, 'edited');
  assert.equal(updates.find(post => post.id === '949').published, timestamp('2026-08-11T00:25:35'));
  assert.equal(updates.find(post => post.id === '949').edited, timestamp('2026-09-11T15:15:06'));
  assert.equal((await f.service.checkUpdates()).postUpdateCount, 2, 'checking does not consume unread updates');
  const reopened = createPawchiveService(f.options);
  assert.equal(reopened.getState().postUpdateCount, 2, 'unread updates survive a process restart');
  const oldToken = reopened.getState().favorites[0].readToken;
  f.posts[52].edited = '2026-09-12T15:15:06';
  await reopened.checkUpdates();
  assert.equal(reopened.markRead({ creator, token: oldToken }).postUpdateCount, 2, 'stale acknowledgement cannot hide a newer edit');
  const current = reopened.getUpdates().items.find(item => item.changeKind === 'edited');
  assert.equal(reopened.markRead({ creator, postId: current.id, token: current.changeToken }).postUpdateCount, 1);
  assert.equal(reopened.markRead({ creator, token: reopened.getState().favorites[0].readToken }).postUpdateCount, 0);
  assert.equal((await reopened.checkUpdates()).postUpdateCount, 0, 'acknowledged revisions do not reappear');
});

test('changed body or attachment is found even if Edited was not updated upstream', async t => {
  const f = fixture(t);
  await f.service.setFavorite({ creator, favorite: true });
  f.posts[50].content = '<p>Replacement download link</p>';
  f.posts[51].attachments = [{ name: 'new.zip', path: '/aa/bb/new.zip' }];
  await f.service.checkUpdates();
  assert.equal(f.service.getUpdates().items.filter(item => item.changeKind === 'edited').length, 2);
});

test('failed later pages preserve the full baseline and never report a complete check', async t => {
  const f = fixture(t);
  await f.service.setFavorite({ creator, favorite: true });
  await f.service.setFavorite({ creator: { id: '123', service: 'fanbox' }, favorite: true });
  const before = JSON.parse(fs.readFileSync(path.join(f.userData, 'pawchive-favorites.json')));
  f.posts[0].edited = '2026-09-11T15:15:06'; f.fail('page2');
  const result = await f.service.checkUpdates();
  assert.equal(result.checked, 1);
  assert.equal(result.failures.length, 1);
  assert.equal(result.lastCheckedAt, 0);
  assert.equal(result.postUpdateCount, 0);
  const after = JSON.parse(fs.readFileSync(path.join(f.userData, 'pawchive-favorites.json')));
  assert.deepEqual(after.favorites[0], before.favorites[0]);
  f.fail('');
  assert.equal((await f.service.checkUpdates()).postUpdateCount, 1);
});

test('service + creator ID identities, explicit unfavorite, cache fallback, and corrupt-state protection', async t => {
  const f = fixture(t);
  await f.service.listCreators();
  await f.service.setFavorite({ creator, favorite: true });
  await f.service.setFavorite({ creator: { id: '123', service: 'fanbox' }, favorite: true });
  assert.equal(f.service.getState().favorites.length, 2);
  await f.service.setFavorite({ creator, favorite: false });
  assert.deepEqual(f.service.getState().favorites.map(item => item.service), ['fanbox']);
  f.fail('all'); f.advance();
  const cached = await f.service.listCreators({ force: true });
  assert.equal(cached.stale, true); assert.equal(cached.total, 2);
  fs.writeFileSync(path.join(f.userData, 'pawchive-favorites.json'), 'broken');
  assert.throws(() => createPawchiveService(f.options).getState(), /原文件已保留/);
  assert.equal(fs.readFileSync(path.join(f.userData, 'pawchive-favorites.json'), 'utf8'), 'broken');
});

test('repeated full pages fail instead of looping or dropping the baseline', async t => {
  const f = fixture(t);
  const service = createPawchiveService({ ...f.options, fetch: async url => new Response(JSON.stringify(url.endsWith('/profile') ? f.authors[0] : f.posts.slice(0, 50)), { headers: { 'content-type': 'application/json' } }) });
  await assert.rejects(service.setFavorite({ creator, favorite: true }), /重复分页/);
  assert.equal(service.getState().favorites.length, 0);
});

test('input validation and coalesced update checks prevent duplicate scans', async t => {
  const f = fixture(t);
  await assert.rejects(f.service.listPosts({ creator: { service: 'patreon', id: '../bad' } }), /信息无效/);
  await assert.rejects(f.service.listPosts({ query: 'a' }), /3 个字符/);
  await f.service.setFavorite({ creator, favorite: true });
  f.calls.length = 0;
  await Promise.all([f.service.checkUpdates(), f.service.checkUpdates()]);
  assert.equal(f.calls.filter(item => item === '/patreon/user/123?o=0').length, 1);
});

test('daily checks use local calendar days across midnight and persist the reservation across restart', async t => {
  const f = fixture(t);
  f.setTime(new Date(2026, 9, 5, 23, 59).getTime());
  assert.equal(localDayKey(f.options.now()), '2026-10-05');
  await f.service.setFavorite({ creator, favorite: true }); f.calls.length = 0;
  await Promise.all([f.service.checkDaily(), f.service.checkDaily()]);
  assert.equal(f.calls.filter(url => url.endsWith('?o=0')).length, 1);
  assert.equal(f.service.getState().lastAutoCheckDay, '2026-10-05');
  assert.equal((await createPawchiveService(f.options).checkDaily()).skipped, 'already-checked');
  f.setTime(new Date(2026, 9, 6, 0, 1).getTime());
  await createPawchiveService(f.options).checkDaily();
  assert.equal(f.calls.filter(url => url.endsWith('?o=0')).length, 2, 'midnight triggers without waiting 24 hours');
  assert.ok(f.states.some(state => state.checking));
  assert.equal(f.states.at(-1).checking, false);
});

test('failed automatic checks do not retry repeatedly that day, while manual retry remains available', async t => {
  const f = fixture(t); await f.service.setFavorite({ creator, favorite: true });
  f.fail('all'); f.calls.length = 0;
  const result = await f.service.checkDaily();
  assert.equal(result.failures.length, 1);
  assert.match(f.service.getState().autoCheckError, /自动检查未完成/);
  const reopened = createPawchiveService(f.options);
  assert.equal((await reopened.checkDaily()).skipped, 'already-checked');
  assert.equal(f.calls.length, 1);
  f.fail('');
  assert.equal((await reopened.checkUpdates()).failures.length, 0);
  assert.equal(reopened.getState().autoCheckError, '');
});

test('empty favorites do not consume a day; a successful manual check satisfies the daily check', async t => {
  const f = fixture(t);
  assert.equal((await f.service.checkDaily()).skipped, 'no-favorites');
  await f.service.setFavorite({ creator, favorite: true });
  await f.service.checkUpdates(); f.calls.length = 0;
  assert.equal((await f.service.checkDaily()).skipped, 'already-checked');
  assert.equal(f.calls.length, 0);
});

test('background scheduler checks at startup and on wake, and stops cleanly', async () => {
  const { EventEmitter } = require('node:events');
  const powerMonitor = new EventEmitter();
  let calls = 0, callback, cleared = false;
  const stop = startDailyChecks({ checkDaily: async () => { calls++; } }, { powerMonitor,
    setInterval: (fn, period) => { assert.equal(period, 60000); callback = fn; return { unref() {} }; },
    clearInterval: () => { cleared = true; } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 1);
  powerMonitor.emit('resume'); await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 2);
  stop(); await callback(); powerMonitor.emit('resume');
  assert.equal(calls, 2); assert.equal(cleared, true); assert.equal(powerMonitor.listenerCount('resume'), 0);
});

test('all images survive normalization, duplicate files are removed and previews stay previews', async t => {
  const f = fixture(t);
  f.posts[0].file = { name: 'cover.jpg', path: '/aa/bb/cover.jpg' };
  f.posts[0].attachments = [f.posts[0].file, { name: 'second.PNG', path: '/aa/bb/second.PNG' },
    { name: 'preview.webp', path: '/aa/bb/preview.webp', preview_only: true },
    { name: 'mod.zip', path: '/aa/bb/mod.zip' }, { name: 'bad.png', path: '/../bad.png' }];
  const { post } = await f.service.getPost({ service: 'patreon', user: '123', id: '1000' });
  assert.equal(post.images.length, 3);
  assert.equal(post.images[0].url, 'https://file.pawchive.pw/data/aa/bb/cover.jpg?f=cover.jpg');
  assert.equal(post.creator.avatar, 'https://pawchive.pw/icons/patreon/123');
  assert.equal(post.images[1].thumbnail, 'https://img.pawchive.pw/thumbnail/data/aa/bb/second.PNG');
  assert.equal(post.images[2].url, post.images[2].thumbnail);
  assert.equal(post.attachments.some(file => file.path.includes('..')), false);
});

test('Kemono documented endpoints, text/css JSON, wrapped responses, paging and source isolation', async t => {
  const f = fixture(t), requests = [];
  const kemono = createPawchiveService({ userData: f.userData, source: 'kemono', fetch: async (address, options) => {
    const url = new URL(address); requests.push(url.pathname + url.search);
    assert.equal(url.origin, 'https://kemono.cr');
    assert.equal(options.headers.Accept, 'text/css');
    const offset = Number(url.searchParams.get('o') || 0);
    let result;
    if (url.pathname.endsWith('/creators')) result = f.authors;
    else if (url.pathname.endsWith('/profile')) result = f.authors[0];
    else if (url.pathname.includes('/post/')) result = { post: { ...f.posts[0], file: { name: 'cover.png', path: '/aa/bb/cover.png' } } };
    else if (url.pathname.includes('/user/')) result = { props: { count: f.posts.length }, results: f.posts.slice(offset, offset + 50) };
    else result = { count: f.posts.length, posts: f.posts.slice(offset, offset + 50) };
    return new Response(JSON.stringify(result), { headers: { 'content-type': 'text/css; charset=utf-8' } });
  } });
  assert.equal((await kemono.listCreators()).total, 2);
  assert.equal((await kemono.listPosts()).items.length, 50);
  assert.equal((await kemono.listPosts({ creator, offset: 50 })).items.length, 2);
  await kemono.setFavorite({ creator, favorite: true });
  assert.ok(requests.includes('/api/v1/patreon/user/123/posts?o=50'));
  assert.equal(f.service.getState().favorites.length, 0);
  assert.equal(kemono.getState().favorites.length, 1);
  f.posts[51].content = 'Edited on Kemono';
  assert.equal((await kemono.checkUpdates()).postUpdateCount, 1);
  assert.equal(f.service.getState().postUpdateCount, 0);
  const { post } = await kemono.getPost({ service: 'patreon', user: '123', id: '1000' });
  assert.equal(post.url, 'https://kemono.cr/patreon/user/123/post/1000');
  assert.equal(post.creator.avatar, 'https://img.kemono.cr/icons/patreon/123');
  assert.equal(post.images[0].thumbnail, 'https://img.kemono.cr/thumbnail/data/aa/bb/cover.png');
  assert.equal(post.images[0].url, 'https://kemono.cr/data/aa/bb/cover.png?f=cover.png');
  assert.ok(fs.existsSync(path.join(f.userData, 'kemono-favorites.json')));
});
