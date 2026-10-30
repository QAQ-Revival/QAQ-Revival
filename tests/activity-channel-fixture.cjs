const path = require('node:path');
const { createRequire } = require('node:module');
const koffi = createRequire(path.resolve(__dirname, '../app/package.json'))('koffi');

module.exports = function activityFixture(token, count) {
  const kernel = koffi.load(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32/kernel32.dll'));
  const create = kernel.func('void * __stdcall CreateFileMappingW(void * file, void * security, uint32_t protection, uint32_t high, uint32_t low, str16 name)');
  const map = kernel.func('void * __stdcall MapViewOfFile(void * file, uint32_t access, uint32_t high, uint32_t low, size_t bytes)');
  const unmap = kernel.func('int __stdcall UnmapViewOfFile(void * view)');
  const close = kernel.func('int __stdcall CloseHandle(void * file)');
  const size = (6 + count) * 4;
  const handle = create(-1n, null, 4, 0, size, `Local\\QAQR.Activity.v1.${token}`);
  if (!handle) throw Error('Could not create activity test channel');
  const view = map(handle, 2, 0, 0, size);
  if (!view) { close(handle); throw Error('Could not map activity test channel'); }
  let sequence = 0;
  return {
    write(tick, flags, { incomplete = false, wrongToken = false } = {}) {
      const bytes = Buffer.alloc(size);
      bytes.writeUInt32LE(0x31524151, 0);
      bytes.writeUInt32LE(1, 4);
      sequence += 2;
      bytes.writeUInt32LE(sequence + (incomplete ? 1 : 0), 8);
      bytes.writeUInt32LE(wrongToken ? token + 1 : token, 12);
      bytes.writeFloatLE(tick, 16);
      bytes.writeUInt32LE(count, 20);
      flags.forEach((v, i) => bytes.writeFloatLE(v, 24 + i * 4));
      koffi.encode(view, 'uint8_t', bytes, size);
    },
    close() { unmap(view); close(handle); }
  };
};
