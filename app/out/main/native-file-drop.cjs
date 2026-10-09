const path = require('node:path');

const WM_DROPFILES = 0x0233;
const WM_COPYGLOBALDATA = 0x0049;

// A registered Chromium OLE target takes precedence over WM_DROPFILES, even when
// UIPI prevents Explorer from using it. Elevated windows must suspend that target
// for external drops and restore the same target during application-origin drags.
function enableNativeFileDrop(window, { ipcMain, preferLegacy = false, onDrop, onError = () => {} }) {
  if (process.platform !== 'win32') return;
  const koffi = require('koffi');
  const system = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32');
  const user32 = koffi.load(path.join(system, 'user32.dll'));
  const shell32 = koffi.load(path.join(system, 'shell32.dll'));
  const ole32 = koffi.load(path.join(system, 'ole32.dll'));
  const changeFilter = user32.func('int __stdcall ChangeWindowMessageFilterEx(void *hwnd, uint32_t message, uint32_t action, void *change)');
  const acceptFiles = shell32.func('void __stdcall DragAcceptFiles(void *hwnd, int accept)');
  const queryFile = shell32.func('uint32_t __stdcall DragQueryFileW(void *drop, uint32_t index, _Out_ uint16_t *name, uint32_t length)');
  const finish = shell32.func('void __stdcall DragFinish(void *drop)');
  const getProperty = user32.func('void * __stdcall GetPropW(void *hwnd, str16 name)');
  const revoke = ole32.func('int32_t __stdcall RevokeDragDrop(void *hwnd)');
  const register = ole32.func('int32_t __stdcall RegisterDragDrop(void *hwnd, void *target)');
  const refMethod = koffi.proto('__stdcall', 'uint32_t', ['void *']);
  const pointer = buffer => buffer.length === 8 ? buffer.readBigUInt64LE() : BigInt(buffer.readUInt32LE());
  const hwnd = pointer(window.getNativeWindowHandle());
  let target = null;
  let suspended = false;
  let hoverTimer = null;
  let dragThread = 0;
  let hovering = false;
  function setHover(value) {
    if (value === hovering) return;
    hovering = value;
    if (!window.webContents.isDestroyed()) window.webContents.send('files:native-drag-state', value);
  }
  function clearHover() { dragThread = 0; setHover(false); }
  function reference(index) {
    const table = koffi.decode(target, 'void *');
    const method = koffi.decode(table, index * koffi.sizeof('void *'), 'void *');
    return koffi.call(method, refMethod, target);
  }
  function setInternalDrag(active) {
    if (!preferLegacy || window.isDestroyed()) return;
    if (active) clearHover();
    if (!target) {
      target = getProperty(hwnd, 'OleDropTargetInterface');
      if (!target) return;
      reference(1); // Keep Chromium's IDropTarget alive while OLE registration is suspended.
    }
    if (active && suspended) {
      const result = register(hwnd, target);
      if (result < 0) throw Error(`Could not restore Chromium drop target (${result})`);
      suspended = false;
    } else if (!active && !suspended) {
      const result = revoke(hwnd);
      if (result < 0) throw Error(`Could not suspend Chromium drop target (${result})`);
      suspended = true;
    }
  }
  const allowed = [];
  try {
    for (const message of [WM_DROPFILES, WM_COPYGLOBALDATA]) {
      if (!changeFilter(hwnd, message, 1, null)) throw Error('Could not enable native file-drop message');
      allowed.push(message);
    }
    window.hookWindowMessage(WM_DROPFILES, wParam => {
      clearHover();
      const drop = pointer(wParam);
      try {
        const count = queryFile(drop, 0xffffffff, null, 0);
        if (!count || count > 4096) return;
        const paths = [];
        for (let i = 0; i < count; i++) {
          const length = queryFile(drop, i, null, 0);
          if (!length || length > 32767) continue;
          const name = Buffer.alloc((length + 1) * 2);
          if (queryFile(drop, i, name, length + 1) === length) {
            const file = name.toString('utf16le', 0, length * 2);
            if (path.isAbsolute(file)) paths.push(file);
          }
        }
        if (paths.length) onDrop({ paths: [...new Set(paths)] });
      } catch (error) {
        onError(error);
      } finally {
        finish(drop);
      }
    });
    acceptFiles(hwnd, 1);
    setInternalDrag(false);
  } catch (error) {
    for (const message of allowed) changeFilter(hwnd, message, 0, null);
    if (window.isWindowMessageHooked(WM_DROPFILES)) window.unhookWindowMessage(WM_DROPFILES);
    if (target) {
      if (suspended) register(hwnd, target);
      reference(2); target = null;
    }
    throw error;
  }
  const onInternalDrag = (event, active) => {
    if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) return;
    try { setInternalDrag(active === true); event.returnValue = true; }
    catch (error) { event.returnValue = false; onError(error); }
  };
  const reset = () => {
    try {
      clearHover();
      setInternalDrag(false);
      if (!window.webContents.isDestroyed()) window.webContents.send('files:native-drop-ready', preferLegacy && !!target);
    } catch (error) { onError(error); }
  };
  ipcMain?.on('files:internal-drag', onInternalDrag);
  window.webContents.on('did-finish-load', reset);
  window.webContents.on('render-process-gone', reset);
  if (preferLegacy) {
    // WM_DROPFILES has no enter/leave events. Observe the source's native OLE
    // mouse capture, then feed only hover state to the existing renderer overlay.
    // Ordinary mouse selection/window moves do not use these OLE capture classes.
    const keyState = user32.func('int16_t __stdcall GetAsyncKeyState(int key)');
    const guiInfo = user32.func('int __stdcall GetGUIThreadInfo(uint32_t thread, void *info)');
    const className = user32.func('int __stdcall GetClassNameW(void *hwnd, _Out_ uint16_t *name, int length)');
    const threadOf = user32.func('uint32_t __stdcall GetWindowThreadProcessId(void *hwnd, _Out_ uint32_t *pid)');
    const cursorPos = user32.func('int __stdcall GetCursorPos(_Out_ int32_t *point)');
    const atPoint = user32.func('void * __stdcall WindowFromPoint(int64_t point)');
    const ancestor = user32.func('void * __stdcall GetAncestor(void *hwnd, uint32_t flags)');
    const pointerSize = koffi.sizeof('void *');
    const info = Buffer.alloc(8 + pointerSize * 6 + 16);
    const name = Buffer.alloc(128);
    const point = Buffer.alloc(8);
    hoverTimer = setInterval(() => {
      try {
        if (!suspended || !window.isVisible() || window.isMinimized() || !(keyState(1) & 0x8000 || keyState(2) & 0x8000) || keyState(0x1b) & 0x8000) return clearHover();
        info.writeUInt32LE(info.length);
        if (!guiInfo(dragThread, info)) return clearHover();
        const capture = pointer(info.subarray(8 + pointerSize * 2, 8 + pointerSize * 3));
        if (!capture) return clearHover();
        const length = className(capture, name, name.length / 2);
        if (!/^(CLIPBRDWNDCLASS|DragDropTracker|OleDragDropTracker)$/i.test(name.toString('utf16le', 0, length * 2))) return clearHover();
        const pid = [0];
        dragThread = threadOf(capture, pid);
        if (!dragThread || pid[0] === process.pid || !cursorPos(point)) return clearHover();
        const underCursor = atPoint(point.readBigInt64LE());
        setHover(!!underCursor && ancestor(underCursor, 2) === hwnd);
      } catch (error) {
        clearHover();
        clearInterval(hoverTimer); hoverTimer = null;
        onError(error);
      }
    }, 80);
    hoverTimer.unref();
  }
  window.once('closed', () => {
    clearInterval(hoverTimer);
    ipcMain?.removeListener('files:internal-drag', onInternalDrag);
    if (target) { reference(2); target = null; }
  });
  return { setInternalDrag };
}

module.exports = { enableNativeFileDrop };
