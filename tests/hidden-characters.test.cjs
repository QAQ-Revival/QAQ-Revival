const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHiddenCharactersStore, applyDisablePlan } = require('../app/out/main/hidden-characters.cjs');

function fixture(t) {
  const parent = fs.realpathSync(os.tmpdir());
  const root = fs.mkdtempSync(path.join(parent, 'qaq-hidden-'));
  t.after(() => { assert.equal(path.dirname(fs.realpathSync(root)), parent); fs.rmSync(root, { recursive: true, force: true }); });
  const plan = ['ModA', 'ModB'].map(name => ({ from: path.join(root, name), to: path.join(root, 'DISABLED_' + name) }));
  for (const item of plan) { fs.mkdirSync(item.from); fs.writeFileSync(path.join(item.from, 'mod.ini'), item.from); }
  return { root, plan };
}
test('hidden characters persist independently by game and restore without affecting other entries', () => {
  let saved;
  const store = () => createHiddenCharactersStore({ read: () => saved && JSON.parse(saved), write: next => { saved = JSON.stringify(next); } });
  store().set('wuwa', 'Encore', true);
  store().set('wuwa', 'Jinhsi', true);
  assert.equal(store().has('wuwa', 'encore'), true);
  assert.equal(store().has('zzz', 'Encore'), false);
  store().set('wuwa', 'ENCORE', true);
  assert.equal(store().list('wuwa').length, 2);
  store().set('wuwa', 'Encore', false);
  assert.deepEqual(store().list('wuwa'), ['Jinhsi']);
});
test('hiding disables all planned Mods before persisting and preserves their bytes', t => {
  const { plan } = fixture(t);
  let committed = false;
  assert.equal(applyDisablePlan(plan, () => {
    assert.ok(plan.every(item => !fs.existsSync(item.from) && fs.existsSync(item.to)));
    committed = true;
  }), 2);
  assert.equal(committed, true);
  for (const item of plan) assert.equal(fs.readFileSync(path.join(item.to, 'mod.ini'), 'utf8'), item.from);
});
test('destination conflicts are checked before changing any Mod', t => {
  const { plan } = fixture(t);
  fs.mkdirSync(plan[1].to);
  assert.throws(() => applyDisablePlan(plan, () => assert.fail('must not save')), /目标已存在/);
  assert.ok(plan.every(item => fs.existsSync(item.from)));
  assert.equal(fs.existsSync(plan[0].to), false);
});
test('save failures and a later rename failure restore earlier Mods', t => {
  const { plan } = fixture(t);
  assert.throws(() => applyDisablePlan(plan, () => { throw Error('disk full'); }), /disk full/);
  assert.ok(plan.every(item => fs.existsSync(item.from) && !fs.existsSync(item.to)));
  assert.throws(() => applyDisablePlan(plan, () => assert.fail('must not save'), (from, to) => {
    if (from === plan[1].from) throw Error('file locked');
    fs.renameSync(from, to);
  }), /file locked/);
  for (const item of plan) assert.equal(fs.readFileSync(path.join(item.from, 'mod.ini'), 'utf8'), item.from);
});
