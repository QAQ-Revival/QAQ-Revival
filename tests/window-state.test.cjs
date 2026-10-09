const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { readWindowState, trackWindowState } = require('../app/out/main/window-state.cjs');
const workArea = { width: 1920, height: 1040 };
function fixture(t) {
  const parent = fs.realpathSync(os.tmpdir());
  const dir = fs.mkdtempSync(path.join(parent, 'qaqm-window-state-'));
  t.after(() => {
    assert.equal(path.dirname(fs.realpathSync(dir)), parent);
    fs.rmSync(dir, { recursive: true, force: true });
  });
  return path.join(dir, 'window-state.json');
}

test('missing/corrupt state falls back safely and saved dimensions fit the current screen', t => {
  const file = fixture(t);
  const defaults = { width: 1600, height: 900, maximized: false };
  assert.deepEqual(readWindowState(file, workArea), defaults);
  fs.writeFileSync(file, '{broken');
  assert.deepEqual(readWindowState(file, workArea), defaults);
  fs.writeFileSync(file, JSON.stringify({ width: -1, height: '700', maximized: 'true' }));
  assert.deepEqual(readWindowState(file, workArea), defaults);
  fs.writeFileSync(file, JSON.stringify({ width: 1500, height: 1000, maximized: true }));
  assert.deepEqual(readWindowState(file, { width: 1280, height: 720 }), { width: 1280, height: 720, maximized: true });
});

test('resize persists; quick close, maximization and minimization preserve the restore size', async t => {
  const file = fixture(t);
  const window = new EventEmitter();
  let maximized = false, minimized = false;
  let size = { width: 1240, height: 760 };
  Object.assign(window, {
    isDestroyed: () => false, isFullScreen: () => false,
    isMaximized: () => maximized, isMinimized: () => minimized,
    getNormalBounds: () => size
  });
  trackWindowState(window, file, error => { throw error; });
  t.after(() => window.emit('closed'));
  window.emit('resize');
  await new Promise(resolve => setTimeout(resolve, 350));
  assert.deepEqual(readWindowState(file, workArea), { ...size, maximized: false });
  size = { width: 1300, height: 800 };
  window.emit('resize');
  window.emit('close', { preventDefault() {} });
  assert.deepEqual(readWindowState(file, workArea), { ...size, maximized: false });
  maximized = true;
  window.emit('maximize');
  // Windows may report isMaximized() as false while minimized.
  minimized = true; maximized = false;
  window.emit('close');
  assert.deepEqual(readWindowState(file, workArea), { ...size, maximized: true });
  minimized = false;
  window.emit('unmaximize');
  window.emit('close');
  assert.deepEqual(readWindowState(file, workArea), { ...size, maximized: false });
});
