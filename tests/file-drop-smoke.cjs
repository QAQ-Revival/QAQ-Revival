const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

module.exports = async ({ electron, window, evaluate, waitFor, captureUI, root, passed }) => {
  const runtimeRequire = createRequire(path.join(process.resourcesPath, 'app/package.json'));
  // Do not mistake a successful injected WM_DROPFILES for Explorer compatibility:
  // an elevated Chromium OLE registration masks the legacy target before delivery.
  const koffi = runtimeRequire('koffi');
  const nativeUser = koffi.load('user32.dll');
  const getProperty = nativeUser.func('void * __stdcall GetPropW(void *hwnd, str16 name)');
  const getStyle = nativeUser.func('intptr_t __stdcall GetWindowLongPtrW(void *hwnd, int index)');
  const normalHandle = window.getNativeWindowHandle().readBigUInt64LE();
  assert.ok(getProperty(normalHandle, 'OleDropTargetInterface'), 'Normal-permission windows retain Chromium OLE');
  const isolated = new electron.BrowserWindow({ show: false, webPreferences: { preload: path.join(process.resourcesPath, 'app/out/preload/index.js'), sandbox: false } });
  const errors = [];
  const listenersBefore = electron.ipcMain.listenerCount('files:internal-drag');
  runtimeRequire('./out/main/native-file-drop.cjs').enableNativeFileDrop(isolated, { screen: electron.screen, ipcMain: electron.ipcMain, preferLegacy: true, onDrop() {}, onError: error => errors.push(error.message) });
  const isolatedHandle = isolated.getNativeWindowHandle().readBigUInt64LE();
  try {
    await isolated.loadURL('data:text/html,<p draggable="true">drag</p>');
    assert.equal(getProperty(isolatedHandle, 'OleDropTargetInterface'), null, 'Legacy reception must not be masked by OLE');
    assert.ok(Number(getStyle(isolatedHandle, -20)) & 0x10, 'WS_EX_ACCEPTFILES remains set');
    await isolated.webContents.executeJavaScript(`document.querySelector('p').dispatchEvent(new DragEvent('dragstart', { bubbles: true }))`);
    assert.ok(getProperty(isolatedHandle, 'OleDropTargetInterface'), 'Preload restores the original target before internal dragging');
    await isolated.webContents.executeJavaScript(`document.querySelector('p').dispatchEvent(new DragEvent('dragend', { bubbles: true }))`);
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.equal(getProperty(isolatedHandle, 'OleDropTargetInterface'), null, 'External reception resumes after internal drag');
    await isolated.webContents.executeJavaScript(`document.querySelector('p').dispatchEvent(new DragEvent('dragstart', { bubbles: true }))`);
    await isolated.loadURL('data:text/html,reloaded');
    assert.equal(getProperty(isolatedHandle, 'OleDropTargetInterface'), null, 'Reload cannot leave external drops blocked');
  } finally { isolated.destroy(); }
  assert.deepEqual(errors, []);
  assert.equal(electron.ipcMain.listenerCount('files:internal-drag'), listenersBefore, 'Closing releases the per-window listener');
  passed('Windows registration: external file target is unmasked; internal OLE drag and reload/close cleanup preserve the original target');
  window.webContents.send('files:native-drag-state', true);
  await waitFor(`!!document.querySelector('.app-container.dragging-files')`, 'native hover uses the original overlay');
  assert.match(await evaluate(`getComputedStyle(document.querySelector('.app-container'), '::after').content`), /整合包.*修复器/);
  window.webContents.send('files:native-drag-state', false);
  await waitFor(`!document.querySelector('.app-container.dragging-files')`, 'native leave clears the original overlay');
  passed('Native hover/leave reuse the existing Mod / package / fixer overlay');
  const folder = path.join(root, '拖入文件夹');
  const archive = path.join(root, '安可_拖入.zip');
  const bytes = '[TextureOverrideDropFixture]\nhash = deadbeef\n';
  fs.mkdirSync(folder);
  fs.writeFileSync(path.join(folder, 'mod.ini'), bytes);
  const zip = new (runtimeRequire('adm-zip'))();
  zip.addFile('mod.ini', Buffer.from(bytes));
  zip.writeZip(archive);
  const invalid = path.join(root, '不支持.txt');
  fs.writeFileSync(invalid, 'unsupported');
  const cover = path.join(root, 'cover.png');
  fs.writeFileSync(cover, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=', 'base64'));
  async function point(selector) {
    return evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
  }
  async function closePreview() {
    await evaluate(`[...document.querySelectorAll('.batch-import-overlay button')].find(b => b.textContent.trim() === '取消').click()`);
    await waitFor(`!document.querySelector('.batch-import-overlay')`, 'preview closed');
  }
  const count = () => evaluate(`document.querySelectorAll('.batch-import-item').length`);
  const target = '.character-toolbar-subtitle';
  window.webContents.debugger.attach('1.3');
  async function drag(files, selector = target, drop = true) {
    const position = await point(selector);
    const data = { items: [], files, dragOperationsMask: 1 };
    for (const type of ['dragEnter', 'dragOver']) await window.webContents.debugger.sendCommand('Input.dispatchDragEvent', { type, ...position, data });
    if (drop) await window.webContents.debugger.sendCommand('Input.dispatchDragEvent', { type: 'drop', ...position, data });
    return { ...position, data };
  }
  try {
    const hovering = await drag([folder, archive], target, false);
    await waitFor(`!!document.querySelector('.app-container.dragging-files')`, 'file hover hint');
    assert.equal(await evaluate(`!!document.querySelector('.character-import-drop-overlay')`), false, 'Only the existing global drop UI is used');
    await captureUI('file-drop-hover.png');
    await evaluate(`(() => { const data = new DataTransfer(); data.items.add(new File([], 'mod.zip')); document.querySelector('.app-container').dispatchEvent(new DragEvent('dragleave', { bubbles: true, relatedTarget: null, dataTransfer: data })); })()`);
    await waitFor(`!document.querySelector('.app-container.dragging-files')`, 'hover clears on leave');
    await window.webContents.debugger.sendCommand('Input.dispatchDragEvent', { type: 'dragCancel', ...hovering });
    await drag([folder, archive]);
    await waitFor(`!!document.querySelector('.batch-import-overlay')`, 'folder and archive preview');
    assert.equal(await count(), 2);
    await drag([archive]);
    assert.equal(await count(), 2, 'A second drop cannot replace an open import');
    await captureUI('file-drop-preview.png');
    await closePreview();
    await drag([invalid]);
    await waitFor(`document.body.innerText.includes('未识别到可导入的 Mod')`, 'unsupported-file feedback');
    assert.equal(await evaluate(`!!document.querySelector('.batch-import-overlay')`), false);
    await drag([archive, cover], '.character-card:not(.add-card)');
    await waitFor(`!!document.querySelector('.batch-import-overlay')`, 'mixed image/archive routes to import');
    assert.equal(await count(), 1);
    await closePreview();
    await evaluate(`(() => { const data = new DataTransfer(); data.items.add(new File([new Uint8Array(${JSON.stringify([...fs.readFileSync(cover)])})], 'cover.png', { type: 'image/png' })); document.querySelector('.character-card:not(.add-card)').dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: data })); })()`);
    await waitFor(`!!document.querySelector('.cropper-overlay')`, 'image drop still opens cover cropper');
    await evaluate(`[...document.querySelectorAll('.cropper-overlay button')].find(b => b.textContent.trim() === '取消').click()`);
    passed('Real Chromium file drags: folder + ZIP, hover cancellation, busy preview, invalid files, mixed images and cover cropping');
  } finally {
    window.webContents.debugger.detach();
  }

  // Exercise the actual Win32 HDROP decoding and preload route, not a mocked IPC.
  const kernel = koffi.load('kernel32.dll');
  const user = koffi.load('user32.dll');
  const alloc = kernel.func('void * __stdcall GlobalAlloc(uint32_t flags, size_t size)');
  const lock = kernel.func('void * __stdcall GlobalLock(void *handle)');
  const unlock = kernel.func('int __stdcall GlobalUnlock(void *handle)');
  const post = user.func('int __stdcall PostMessageW(void *hwnd, uint32_t message, uintptr_t wParam, intptr_t lParam)');
  const hwnd = window.getNativeWindowHandle().readBigUInt64LE();
  assert.ok(window.isWindowMessageHooked(0x233), 'Native drop handler is installed');
  const names = Buffer.from([folder, archive, ''].join('\0') + '\0', 'utf16le');
  const drop = Buffer.alloc(20 + names.length);
  drop.writeUInt32LE(20, 0);
  drop.writeInt32LE(20000, 4);
  drop.writeInt32LE(20000, 8);
  drop.writeInt32LE(1, 12); // fNC: shell/window coordinates must not gate the shared global import.
  drop.writeInt32LE(1, 16); // DROPFILES.fWide
  names.copy(drop, 20);
  const handle = alloc(0x42, drop.length);
  assert.ok(handle);
  const memory = lock(handle);
  koffi.encode(memory, 'uint8_t', [...drop], drop.length);
  unlock(handle);
  const query = koffi.load('shell32.dll').func('uint32_t __stdcall DragQueryFileW(void *drop, uint32_t index, void *name, uint32_t length)');
  assert.equal(query(handle, 0xffffffff, null, 0), 2);
  assert.ok(post(hwnd, 0x233, handle, 0)); // Receiver owns and frees HDROP, just as for an Explorer drop.
  await waitFor(`!!document.querySelector('.batch-import-overlay')`, 'native Windows drop reaches preview');
  assert.equal(await count(), 2);
  await evaluate(`[...document.querySelectorAll('.batch-import-overlay button')].find(b => b.textContent.includes('开始分析')).click()`);
  await waitFor(`document.querySelectorAll('[aria-label="导入目标分组"]').length === 2`, 'native drop analyzed');
  await evaluate(`[...document.querySelectorAll('.batch-import-overlay button')].find(b => b.textContent.includes('开始安装')).click()`);
  await waitFor(`!!document.querySelector('.batch-import-done-summary')`, 'native drop installed');
  assert.match(await evaluate(`document.querySelector('.batch-import-done-summary').textContent`), /2 个成功，0 个失败/);
  assert.equal(fs.readFileSync(path.join(root, 'wuwa-mods', '安可', '安可_拖入', 'mod.ini'), 'utf8'), bytes);
  assert.equal(fs.readFileSync(path.join(folder, 'mod.ini'), 'utf8'), bytes, 'Source folder remains intact');
  passed('Actual WM_DROPFILES → preload → batch preview → analysis → install succeeds with Unicode folder and ZIP paths');
};
