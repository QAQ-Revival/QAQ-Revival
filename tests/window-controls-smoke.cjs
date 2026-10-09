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
    const sidebar = rect('.sidebar'), header = rect('.sidebar-header'), titlebar = rect('.window-titlebar');
    const download = rect('.sidebar-download-button'), toggle = rect('.sidebar-toggle');
    return { top: sidebar.top, bottom: sidebar.bottom, height: innerHeight, headerTop: header.top,
      titlebarBottom: titlebar.bottom, mainTop: rect('.main-content').top,
      buttonsAligned: Math.abs(download.top - toggle.top) < 1 && Math.abs(download.height - toggle.height) < 1 };
  })()`);
  assert.equal(layout.top, 0, 'sidebar background reaches the top edge without a separate strip');
  assert.ok(Math.abs(layout.bottom - layout.height) < 1, 'sidebar fills the window height');
  assert.ok(layout.headerTop >= layout.titlebarBottom && layout.mainTop >= layout.titlebarBottom, 'titlebar does not cover content controls');
  assert.ok(layout.buttonsAligned, 'sidebar header actions share the same size and alignment');
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
