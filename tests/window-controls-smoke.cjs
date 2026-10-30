const assert = require('node:assert/strict');
module.exports = async ({ evaluate, waitFor, window, handlers, passed }) => {
  const contentBounds = window.getContentBounds(), bounds = window.getBounds();
  // Recent Chromium rounds frameless DWM edges by one DIP on scaled Windows displays.
  for (const key of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(contentBounds[key] - bounds[key]) <= 1, 'native titlebar does not consume client space: ' + key);
  await waitFor(`document.querySelectorAll('.window-control').length === 3`, 'custom window controls');
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.window-titlebar')).backgroundColor`), 'rgba(0, 0, 0, 0)');
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.window-drag-region')).webkitAppRegion`), 'drag');
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.window-controls')).webkitAppRegion`), 'no-drag');
  const layout = await evaluate(`(() => {
    const rect = selector => document.querySelector(selector).getBoundingClientRect();
    const bar = rect('.app-topbar'), main = rect('.main-content'), controls = rect('.window-controls');
    return { top: bar.top, barBottom: bar.bottom, mainTop: main.top, mainBottom: main.bottom, height: innerHeight,
      controlsRight: controls.right, width: innerWidth, controlsTop: controls.top };
  })()`);
  assert.equal(layout.top, 0, 'top bar reaches the window edge');
  assert.ok(layout.mainTop >= layout.barBottom, 'top bar does not cover the page');
  assert.ok(Math.abs(layout.mainBottom - layout.height) < 1, 'page fills the remaining height');
  assert.ok(Math.abs(layout.controlsRight - layout.width) < 1 && layout.controlsTop === 0, 'window buttons sit in the corner');
  assert.equal((await handlers.get('window:control')({ sender: {} }, 'close')).success, false);
  assert.equal((await evaluate(`window.api.controlWindow('invalid')`)).success, false);
  const originals = Object.fromEntries(['isMaximized', 'maximize', 'unmaximize', 'minimize', 'close'].map(key => [key, window[key]]));
  let maximized = false, minimized = 0, closed = 0;
  window.isMaximized = () => maximized;
  window.maximize = () => { maximized = true; window.emit('maximize'); };
  window.unmaximize = () => { maximized = false; window.emit('unmaximize'); };
  window.minimize = () => { minimized++; };
  window.close = () => { closed++; };
  try {
    await evaluate(`document.querySelector('[aria-label="最大化窗口"]').click()`);
    await waitFor(`!!document.querySelector('[aria-label="还原窗口"]')`, 'maximize updates titlebar');
    assert.equal(maximized, true);
    await evaluate(`document.querySelector('[aria-label="还原窗口"]').click()`);
    await waitFor(`!!document.querySelector('[aria-label="最大化窗口"]')`, 'restore updates titlebar');
    assert.equal(maximized, false);
    await evaluate(`document.querySelector('[aria-label="最小化窗口"]').click()`);
    await evaluate(`document.querySelector('[aria-label="关闭窗口"]').click()`);
    await evaluate(`window.api.getWindowState()`); // Wait for preceding IPC calls.
    assert.equal(minimized, 1);
    assert.equal(closed, 1);
    window.maximize(); // Also follows native changes such as dragging/double-clicking the title area.
    await waitFor(`!!document.querySelector('[aria-label="还原窗口"]')`, 'native maximize event');
    window.unmaximize();
    await waitFor(`!!document.querySelector('[aria-label="最大化窗口"]')`, 'native restore event');
  } finally { Object.assign(window, originals); }
  passed('Frameless main window: custom controls call the correct native operations, synchronize native state and isolate other senders');
};
