const assert = require('node:assert/strict');
module.exports = async ({ evaluate, waitFor, window, handlers, passed }) => {
  assert.deepEqual(window.getContentBounds(), window.getBounds(), 'native titlebar does not consume client space');
  await waitFor(`document.querySelectorAll('.window-control').length === 3`, 'custom window controls');
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.window-titlebar')).backgroundColor`), 'rgba(0, 0, 0, 0)');
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.window-drag-region')).webkitAppRegion`), 'drag');
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.window-controls')).webkitAppRegion`), 'no-drag');
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
