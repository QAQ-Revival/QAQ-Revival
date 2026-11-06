const test = require('node:test');
const assert = require('node:assert/strict');
const { createSelectionController } = require('../app/src/main/mods/selection.cjs');

function fixture(fail = '') {
  const enabled = new Set(['body']), writes = [], notifications = [];
  const context = { characterName: 'operator', gameId: 'game' };
  const controller = createSelectionController({
    scope: c => c.gameId + '/' + c.characterName,
    conflicts: (_, selected) => [...enabled, ...selected].includes('body') ? selected.filter(name => name.startsWith('skin')).map(name => ({ id: name, hash: '12345678', mods: ['body', name] })) : [],
    apply: async c => {
      if (c.enable && c.modName === fail) return { success: false, error: 'disk full' };
      writes.push({ name: c.modName, enable: c.enable, approved: c.confirmedConflictIds });
      if (c.enable) enabled.add(c.modName); else enabled.delete(c.modName);
      return { success: true };
    },
    notify: c => notifications.push(c.characterName)
  });
  return { controller, context, enabled, writes, notifications };
}

test('independent Mods apply immediately; conflicts stay pending across window snapshots and can be cancelled', async () => {
  const f = fixture(), request = (name, enable) => f.controller.request({ ...f.context, modName: name, enable });
  assert.equal((await request('voice', true)).success, true);
  assert.equal((await request('skinA', true)).pending, true);
  assert.deepEqual([...f.enabled], ['body', 'voice']);
  const rows = [{ name: 'body', enabled: true }, { name: 'skinA', enabled: false }];
  const main = await f.controller.snapshot(f.context, rows), overlay = await f.controller.snapshot(f.context, rows);
  assert.deepEqual(main, overlay);
  assert.equal(main[1].pendingEnabled, true);
  assert.equal(main[1].hasConflict, true);
  assert.equal((await request('skinA', false)).cancelledPending, true);
  assert.equal((await f.controller.snapshot(f.context, rows))[1].pendingEnabled, false);
  assert.equal(f.writes.length, 1);
  await request('skinA', true);
  assert.equal((await request('body', false)).success, true);
  assert.deepEqual([...f.enabled], ['voice', 'skinA']);
  assert.equal((await f.controller.snapshot(f.context, [{ name: 'skinA', enabled: true }]))[0].pendingEnabled, false);
});

test('inactive snapshots avoid conflict scans while enabled and pending Mods still report conflicts', async () => {
  const context = { characterName: 'operator', gameId: 'arknights' };
  let scans = 0;
  const controller = createSelectionController({
    scope: c => c.gameId + '/' + c.characterName,
    conflicts: () => { scans++; return [{ id: 'shared', hash: '12345678', mods: ['one', 'two'] }]; },
    apply: async () => ({ success: true }),
    notify: () => {}
  });
  const disabled = [{ name: 'one', enabled: false }, { name: 'two', enabled: false }];
  const inactive = await controller.snapshot(context, disabled);
  assert.equal(scans, 0);
  assert(inactive.every(mod => !mod.hasConflict && !mod.pendingEnabled));
  const active = await controller.snapshot(context, disabled.map(mod => ({ ...mod, enabled: true })));
  assert.equal(scans, 1);
  assert(active.every(mod => mod.hasConflict));
  assert.equal((await controller.request({ ...context, modName: 'one', enable: true })).pending, true);
  const before = scans;
  const pending = await controller.snapshot(context, disabled);
  assert.equal(scans, before + 1);
  assert.equal(pending[0].pendingEnabled, true);
  assert.equal(pending[0].hasConflict, true);
});

test('only explicit confirmation applies pending Mods, and failed batches restore the prior enabled set', async () => {
  for (const fail of ['', 'skinB']) {
    const f = fixture(fail);
    await Promise.all(['skinA', 'skinB'].map(modName => f.controller.request({ ...f.context, modName, enable: true })));
    assert.equal(f.writes.length, 0);
    const otherGame = { ...f.context, gameId: 'other' };
    assert.equal((await f.controller.confirm(otherGame)).success, true);
    assert.equal(f.writes.length, 0);
    const result = await f.controller.confirm(f.context);
    assert.equal(result.success, !fail);
    assert.deepEqual([...f.enabled], fail ? ['body'] : ['body', 'skinA', 'skinB']);
    assert.deepEqual(f.writes[0].approved, ['skinA', 'skinB']);
  }
});

test('requests made while a batch runs are applied together, and a queued Mod refuses a second request', async () => {
  const applied = [], commits = [], events = [];
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const context = { characterName: 'operator', gameId: 'game' };
  const controller = createSelectionController({
    scope: c => c.gameId + '/' + c.characterName,
    conflicts: () => [],
    apply: async (c, session) => {
      if (c.modName === 'first') await gate;
      applied.push(c.modName + (c.enable ? '+' : '-'));
      (session.names ||= []).push(c.modName);
      return { success: true };
    },
    commit: async session => commits.push(session.names || []),
    notify: () => {},
    publishQueue: (_, state) => events.push(state)
  });
  const request = (modName, enable) => controller.request({ ...context, modName, enable });
  const first = request('first', true);
  await new Promise(setImmediate);
  const later = [request('weapon', true), request('outfit', false), request('hair', true)];
  assert.equal((await request('weapon', false)).busy, true);
  assert.deepEqual(controller.queueState(context).items.map(item => item.modName).sort(), ['first', 'hair', 'outfit', 'weapon']);
  release();
  assert.equal((await first).success, true);
  assert.deepEqual((await Promise.all(later)).map(result => result.success), [true, true, true]);
  assert.deepEqual(commits, [['first'], ['outfit', 'weapon', 'hair']], 'disables go first and the waiting requests share one commit');
  assert.deepEqual(applied, ['first+', 'outfit-', 'weapon+', 'hair+']);
  assert.deepEqual(controller.queueState(context).items, []);
  assert.deepEqual(events.at(-1).applied, [{ modName: 'weapon', enabled: true }, { modName: 'outfit', enabled: false }, { modName: 'hair', enabled: true }]);
  assert.equal((await request('weapon', false)).success, true, 'a Mod accepts a new request once its batch is done');
});

test('a failed commit reports every Mod in its batch as failed', async () => {
  const context = { characterName: 'operator', gameId: 'game' };
  const controller = createSelectionController({
    scope: c => c.gameId + '/' + c.characterName,
    conflicts: () => [],
    apply: async () => ({ success: true }),
    commit: async session => { if (session.renamed.size) throw Error('deploy failed'); },
    notify: () => {}
  });
  const results = await Promise.all(['a', 'b'].map(modName => controller.request({ ...context, modName, enable: true })));
  assert.deepEqual(results.map(result => result.error), ['deploy failed', 'deploy failed']);
  assert.deepEqual(controller.queueState(context).items, []);
});
