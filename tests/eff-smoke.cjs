const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

module.exports = async ({ handlers, evaluate, waitFor, captureUI, passed }) => {
  const call = (name, ...args) => handlers.get(name)({}, ...args);
  const before = await call('eff:status');
  assert.equal(before.installed, false);
  const files = fs.readdirSync(before.paths.game);
  assert.equal((await call('eff:set-installed', true)).success, true);
  const state = await call('eff:status');
  assert.equal(state.channel, 'fork');
  assert.equal(state.paths.mods, path.join(process.env.QAQR_DATA_DIR, 'EFF/Mods'));
  assert.deepEqual(fs.readdirSync(state.paths.game), files);
  await evaluate(`document.querySelector('[data-section="eff"]').click()`);
  await waitFor(`!!document.querySelector('.settings-page[data-page="eff"]:not([hidden]) [aria-label="终末地 EFF"]')`, 'managed EFF settings');
  const toggle = `document.querySelector('[aria-label="终末地 EFF"]')`;
  await waitFor(`${toggle}.checked && !${toggle}.disabled`, 'EFF starts on the QAQR runtime');
  await evaluate(`${toggle}.click()`);
  await waitFor(`!${toggle}.checked && !${toggle}.disabled`, 'EFF can remain disabled in managed storage');
  assert.equal((await call('eff:status')).enabled, false);
  await captureUI('eff-managed-storage.png');
  assert.equal((await call('eff:set-installed', false)).success, true);
  assert.ok(fs.existsSync(state.paths.mods));
  assert.ok(fs.existsSync(path.join(state.paths.plugin, 'eff.ini')));
  assert.deepEqual(fs.readdirSync(state.paths.game), files);
  passed('EFF installs, toggles and uninstalls through real IPC using data/EFF; the synthetic game directory stays unchanged');
};
