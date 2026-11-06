'use strict';

const fs = require('node:fs');
const path = require('node:path');
const MARKER = Buffer.from('Local\\QAQR.Activity.v1.%u', 'utf16le');
const MAX_SENSORS = 4096;
const capabilities = new Map();
let native;

function supportsActivityChannel(root) {
  const file = path.join(root, 'd3d11.dll');
  try {
    const stat = fs.statSync(file);
    const fingerprint = `${stat.ino}:${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}`;
    if (capabilities.get(file)?.fingerprint !== fingerprint) {
      capabilities.set(file, { fingerprint, supported: stat.size <= 32 * 1024 * 1024 && fs.readFileSync(file).includes(MARKER) });
    }
    return capabilities.get(file).supported;
  } catch { return false; }
}

function getNative() {
  if (native) return native;
  if (process.platform !== 'win32') return null;
  const koffi = require('koffi');
  const kernel = koffi.load(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'kernel32.dll'));
  native = {
    koffi,
    open: kernel.func('void * __stdcall OpenFileMappingW(uint32_t access, int inherit, str16 name)'),
    map: kernel.func('void * __stdcall MapViewOfFile(void * handle, uint32_t access, uint32_t high, uint32_t low, size_t bytes)'),
    unmap: kernel.func('int __stdcall UnmapViewOfFile(void * address)'),
    close: kernel.func('int __stdcall CloseHandle(void * handle)')
  };
  return native;
}

function createActivityChannel() {
  let handle, view, openedToken, openedCount;
  function close() {
    if (view) native.unmap(view);
    if (handle) native.close(handle);
    handle = view = openedToken = openedCount = null;
  }
  function read(token, count) {
    if (!Number.isInteger(token) || token < 1 || token > 0xffffff || !Number.isInteger(count) || count < 1 || count > MAX_SENSORS) return null;
    try {
      const api = getNative();
      if (!api) return null;
      if (openedToken !== token || openedCount !== count) close();
      const size = (6 + count) * 4;
      if (!view) {
        handle = api.open(4, 0, `Local\\QAQR.Activity.v1.${token}`);
        if (!handle) return null;
        view = api.map(handle, 4, 0, 0, size);
        if (!view) { close(); return null; }
        openedToken = token;
        openedCount = count;
      }
      for (let attempt = 0; attempt < 3; attempt++) {
        const before = api.koffi.decode(view, 8, 'uint32_t');
        if (before % 2) continue;
        const bytes = Buffer.from(api.koffi.decode(view, 'uint8_t', size));
        const after = api.koffi.decode(view, 8, 'uint32_t');
        if (before !== after || bytes.readUInt32LE(8) !== before) continue;
        if (bytes.readUInt32LE(0) !== 0x31524151 || bytes.readUInt32LE(4) !== 1 || bytes.readUInt32LE(12) !== token || bytes.readUInt32LE(20) !== count) return null;
        const tick = bytes.readFloatLE(16);
        if (!Number.isFinite(tick) || tick < 0) return null;
        return { token, tick, flags: Array.from({ length: count }, (_, i) => bytes.readFloatLE(24 + i * 4)) };
      }
    } catch { close(); }
    return null;
  }
  return { read, close };
}

module.exports = { createActivityChannel, supportsActivityChannel, MAX_SENSORS };
