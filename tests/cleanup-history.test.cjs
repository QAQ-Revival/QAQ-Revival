const test = require('node:test');
const assert = require('node:assert/strict');
const { retentionPlan, cleanupHistory } = require('../tools/cleanup-history.cjs');
const release = (id, day, extra = {}) => ({ id, tag_name: 'v1.0.' + id, published_at: `2026-11-${day}T00:00:00Z`, draft: false, ...extra });
const run = (id, day, status = 'completed') => ({ id, created_at: `2026-11-${day}T00:00:00Z`, status });

test('keeps the newest publication and run, including prereleases, failed runs and skipped runs', () => {
  const plan = retentionPlan([release(1, '12'), release(2, '14', { prerelease: true }), release(3, '13')], [run(5, '12'), { ...run(7, '14'), conclusion: 'skipped' }, { ...run(6, '13'), conclusion: 'failure' }]);
  assert.equal(plan.latestRelease.id, 2);
  assert.equal(plan.latestRun.id, 7);
  assert.deepEqual(plan.releases.map(item => item.id), [1, 3]);
  assert.deepEqual(plan.runs.map(item => item.id), [5, 6]);
});
test('preserves unfinished work and an older current rerun; no publication means no release deletion', () => {
  const draft = release(1, '14', { draft: true, published_at: null });
  const plan = retentionPlan([draft], [run(1, '10'), run(2, '11', 'in_progress'), run(3, '12', 'queued'), run(4, '14')], '1');
  assert.equal(plan.latestRelease, null);
  assert.deepEqual(plan.releases, []);
  assert.deepEqual(plan.runs, []);
  assert.deepEqual(retentionPlan([], []).runs, []);
});
test('snapshots every page before deletion and rechecks runs that start again', async () => {
  const calls = [];
  const first = Array.from({ length: 100 }, (_, index) => run(index + 10, '12'));
  const result = await cleanupHistory({ repository: 'owner/repo', currentRunId: '500', log() {}, request: async (route, options = {}) => {
    calls.push([options.method || 'GET', route]);
    if (options.method === 'DELETE') return null;
    if (route.includes('/releases?')) return [release(1, '12'), release(2, '14')];
    if (route.includes('/actions/runs?')) return { workflow_runs: route.endsWith('page=1') ? first : [run(110, '13')] };
    if (route.endsWith('/500')) return run(500, '14', 'in_progress');
    const id = Number(route.split('/').pop());
    return run(id, '12', id === 10 ? 'in_progress' : 'completed');
  } });
  assert.deepEqual(result, { release: 'v1.0.2', run: 500, releasesDeleted: 1, runsDeleted: 100 });
  const firstDelete = calls.findIndex(([method]) => method === 'DELETE');
  assert(calls.findIndex(([, route]) => route.endsWith('page=2')) < firstDelete);
  assert(calls.findIndex(([, route]) => route.endsWith('/500')) < firstDelete);
  assert(!calls.some(([method, route]) => method === 'DELETE' && /\/(10|500)$/.test(route)));
  assert(!calls.some(([, route]) => route.includes('/git/')));
});
test('a failed listing cannot partially delete history', async () => {
  const removed = [];
  await assert.rejects(cleanupHistory({ repository: 'owner/repo', log() {}, request: async (route, options = {}) => {
    if (options.method === 'DELETE') removed.push(route);
    if (route.includes('/actions/')) throw Error('Permission denied');
    return [release(1, '12'), release(2, '14')];
  } }), /Permission denied/);
  assert.deepEqual(removed, []);
});
test('a failed publication can clean old runs without deleting the previous usable release', async () => {
  const removed = [];
  const result = await cleanupHistory({ repository: 'owner/repo', cleanupReleases: false, log() {}, request: async (route, options = {}) => {
    if (options.method === 'DELETE') { removed.push(route); return null; }
    if (route.includes('/releases?')) return [release(1, '12'), release(2, '14')];
    if (route.includes('/actions/runs?')) return { workflow_runs: [run(1, '12'), run(2, '14')] };
    return run(1, '12');
  } });
  assert.equal(result.releasesDeleted, 0);
  assert.equal(result.runsDeleted, 1);
  assert.deepEqual(removed, ['/repos/owner/repo/actions/runs/1']);
});
