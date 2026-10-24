const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { POOL_IDS, API, parseGachaUrl, decryptLog, extractGachaUrl, analyzePool, markdownReport, createGachaService } = require('../app/src/main/games/wuwa/gacha.cjs');

const link = (region = 'cn', credential = 'fixture-token') => `https://aki-gm-resources${region === 'global' ? '-oversea' : ''}.aki-game.${region === 'global' ? 'net' : 'com'}/aki/gacha/index.html?player_id=100000001&svr_id=fixture-server&record_id=${credential}&resources_id=fixture-pool&lang=zh-Hans&svr_area=${region}`;
const record = (qualityLevel, count, time, name = '测试记录') => ({ qualityLevel, count, time, name, resourceType: '角色', cardPoolType: '1' });
const records = [record(3, 3, '2026-10-24 12:05:00'), record(5, 1, '2026-10-24 12:04:00', '第二个五星'), record(3, 2, '2026-10-24 12:03:00'), record(5, 1, '2026-10-24 12:02:00', '第一个五星'), record(4, 1, '2026-10-24 12:01:00'), record(3, 2, '2026-10-24 12:00:00')];
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qaqr-gacha-'));
  t.after(() => {
    assert.equal(path.dirname(fs.realpathSync(root)), fs.realpathSync(os.tmpdir()));
    fs.rmSync(root, { recursive: true, force: true });
  });
  return root;
}
const write = (root, relative, value) => {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, value); return file;
};
// Independent inverse of the documented byte-value decoder, not an offset XOR.
const encrypt = data => Buffer.from(data.map(byte => byte ^ (byte & 1 ? 0xef : 0xa5)));
const response = data => Response.json({ code: 0, data });

test('game links support index.html, decoded parameters and both regions while rejecting unrelated hosts', () => {
  assert.equal(parseGachaUrl(link()).region, 'cn');
  assert.equal(parseGachaUrl(link('global')).region, 'global');
  assert.equal(parseGachaUrl(link().replace('fixture-token', 'a%2Bb%3Dc').replace(/&/g, '&amp;')).params.record_id, 'a+b=c');
  assert.equal(parseGachaUrl(link().replace('aki-game.com', 'aki-game.net')).region, 'global');
  for (const value of [link().replace('https:', 'http:'), link().replace('aki-game.com', 'aki-game.com.example.com'), link().replace('player_id=', 'missing='), 'not a link']) assert.throws(() => parseGachaUrl(value), /有效/);
});

test('extractor decodes by byte value, picks the last link in the newest matching log, and handles chunk boundaries without modifying logs', async t => {
  const root = fixture(t);
  const allBytes = Buffer.from(Array.from({ length: 256 }, (_, index) => index));
  assert.deepEqual(decryptLog(encrypt(allBytes)), allBytes);
  const folder = 'Wuthering Waves Game/Client/Saved/Logs';
  const old = write(root, folder + '/Client-backup.log', encrypt(Buffer.from(link('cn', 'old-token') + '\n')));
  fs.utimesSync(old, new Date(1000), new Date(1000));
  const text = Buffer.from('old ' + link('cn', 'first-token') + '\n' + ' '.repeat(1024 * 1024 - 350) + link('cn', 'latest-token') + '\n');
  const latest = write(root, folder + '/Client.log', encrypt(text));
  const original = fs.readFileSync(latest);
  assert.equal((await extractGachaUrl(root)).params.record_id, 'latest-token');
  assert.equal((await extractGachaUrl(latest)).sourcePath, latest);
  const executable = write(root, 'Wuthering Waves Game/Client/Binaries/Win64/Client-Win64-Shipping.exe', 'fixture');
  assert.equal((await extractGachaUrl(executable)).params.record_id, 'latest-token');
  assert.deepEqual(fs.readFileSync(latest), original);
  fs.writeFileSync(latest, 'new log without a link');
  assert.equal((await extractGachaUrl(root)).params.record_id, 'old-token');
  fs.writeFileSync(latest, link('global') + '\n');
  assert.equal((await extractGachaUrl(latest)).region, 'global');
  await assert.rejects(extractGachaUrl(path.join(root, 'missing')), /没有找到/);
});

test('statistics count multi-pulls, retain chronological order and mark incomplete history instead of inventing pity', () => {
  const pool = analyzePool(1, records);
  assert.equal(pool.total, 10); assert.equal(pool.four, 1); assert.equal(pool.five.length, 2); assert.equal(pool.rate, 20); assert.equal(pool.pity, 3);
  assert.deepEqual(pool.five.map(item => [item.name, item.pity, item.lowerBound]), [['第一个五星', 4, true], ['第二个五星', 3, false]]);
  const noFive = analyzePool(2, [record('4', '2', '2026-10-24')]);
  assert.equal(noFive.total, 2); assert.equal(noFive.pityLowerBound, true);
  assert.deepEqual(analyzePool(1, [record(5, 2, '2026-10-24')]).five.map(item => item.pity), [1, 1]);
  assert.throws(() => analyzePool(1, [record(5, -3, '2026-10-24')]), /无法识别/);
  const report = markdownReport({ url: link(), pools: { 1: [{ ...records[0], name: '<bad>|line\nname', qualityLevel: 5 }] }, complete: true, fetchedAt: '2026-10-24' });
  assert.match(report, /bad\\\|line name/); assert.match(report, /至少/); assert(!report.includes('fixture-token')); assert(!report.includes('<bad>'));
});

test('fetching requires explicit consent and sends only official request fields to the correct regional endpoint', async t => {
  const root = fixture(t);
  for (const region of ['cn', 'global']) {
    const requests = [], progress = [];
    const stateDir = path.join(root, region);
    const service = createGachaService({ stateDir, onProgress: value => progress.push(value), fetch: async (address, options) => {
      requests.push({ address, options });
      return response(JSON.parse(options.body).cardPoolType === 1 ? records : []);
    } });
    await assert.rejects(service.fetchAll({ url: link(region), consent: false }), /勾选/);
    assert.equal(requests.length, 0); assert(!fs.existsSync(stateDir));
    const result = await service.fetchAll({ url: link(region), consent: true });
    assert.equal(result.success, true); assert.equal(result.busy, false); assert.equal(result.snapshot.complete, true); assert.equal(result.summary.total, 10);
    assert.deepEqual(requests.map(request => JSON.parse(request.options.body).cardPoolType), POOL_IDS);
    for (const { address, options } of requests) {
      assert.equal(address, API[region]); assert.equal(options.method, 'POST'); assert.equal(options.redirect, 'error'); assert.equal(options.credentials, 'omit');
      assert.deepEqual(Object.keys(JSON.parse(options.body)).sort(), ['cardPoolId', 'cardPoolType', 'languageCode', 'playerId', 'recordId', 'serverId']);
      assert.equal(JSON.parse(options.body).recordId, 'fixture-token');
    }
    assert.equal(progress.at(-1).busy, false);
    const loaded = createGachaService({ stateDir }).state();
    assert.deepEqual(loaded.summary, result.summary);
    assert.equal(JSON.parse(service.exportContents('json')).url, link(region));
    assert.match(service.exportContents('report'), /角色活动唤取/);
  }
});

test('partial, expired and empty results preserve complete snapshots and keep credentials out of error messages', async t => {
  const root = fixture(t); let mode = 'ok', calls = 0;
  const service = createGachaService({ stateDir: root, fetch: async (_address, options) => {
    calls++;
    if (mode === 'expired') return Response.json({ code: -1, message: link() });
    if (mode === 'partial' && JSON.parse(options.body).cardPoolType === 2) throw Error('Failed fetching secret ' + link());
    return response(mode === 'empty' ? [] : JSON.parse(options.body).cardPoolType === 1 ? records : []);
  } });
  await service.fetchAll({ url: link(), consent: true });
  const completeFile = fs.readdirSync(root).find(name => /-complete\.json$/.test(name)), original = fs.readFileSync(path.join(root, completeFile));
  mode = 'partial';
  const partial = await service.fetchAll({ consent: true });
  assert.equal(partial.success, true); assert.equal(partial.snapshot.complete, false); assert.equal(partial.snapshot.failedPools.length, 1);
  assert(!partial.snapshot.failedPools[0].error.includes('fixture-token'));
  assert.deepEqual(fs.readFileSync(path.join(root, completeFile)), original);
  const partialExport = service.exportContents('json');
  mode = 'expired'; calls = 0;
  assert.equal((await service.fetchAll({ consent: true })).success, false); assert.equal(calls, 1);
  assert.equal(service.exportContents('json'), partialExport);
  mode = 'empty';
  assert.equal((await service.fetchAll({ consent: true })).success, false);
  assert.equal(service.exportContents('json'), partialExport);
  assert.deepEqual(fs.readFileSync(path.join(root, completeFile)), original);
});

test('canceling in flight leaves saved records intact and rejects concurrent requests', async t => {
  const root = fixture(t);
  const service = createGachaService({ stateDir: root, fetch: async (_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true })) });
  service.saveSnapshot({ url: link(), pools: { 1: records } });
  const before = service.exportContents('json');
  const request = service.fetchAll({ consent: true });
  assert.equal(service.state().busy, true);
  await assert.rejects(service.fetchAll({ consent: true }), /正在获取/);
  service.cancel();
  const result = await request;
  assert.equal(result.canceled, true); assert.equal(result.busy, false);
  assert.equal(service.exportContents('json'), before);
});

test('upstream JSON imports round trip, and malformed imports or corrupt cache files do not replace saved data', t => {
  const root = fixture(t), service = createGachaService({ stateDir: root });
  const result = service.saveSnapshot({ url: link(), params: { player_id: 'wrong-params' }, pools: { 1: records } });
  assert.equal(result.snapshot.params.player_id, '100000001');
  const original = service.exportContents('json');
  assert.throws(() => service.saveSnapshot({ url: link(), pools: { 1: { length: 1 } } }), /无法识别/);
  assert.equal(service.exportContents('json'), original);
  fs.writeFileSync(path.join(root, 'latest.json'), 'corrupt');
  const broken = createGachaService({ stateDir: root }).state();
  assert.match(broken.warning, /无法读取/); assert.equal(broken.snapshot, null);
  assert.equal(fs.readFileSync(path.join(root, 'latest.json'), 'utf8'), 'corrupt');
});
