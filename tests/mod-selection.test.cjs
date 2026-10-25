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
