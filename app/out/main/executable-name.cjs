const NAME_FIELDS = new Set(['FileDescription', 'ProductName', 'InternalName', 'OriginalFilename']);
const align4 = value => Math.ceil(value / 4) * 4;

// Locate only RT_VERSION strings. Editing in place preserves PE section offsets,
// code, icons, manifests and the appended payload used by one-file launchers.
function executableNameFields(bytes) {
  if (bytes.length < 64 || bytes.toString('ascii', 0, 2) !== 'MZ') return [];
  const check = (offset, length, limit = bytes.length) => {
    if (offset < 0 || length < 0 || offset + length > limit) throw Error('启动程序版本资源损坏');
  };
  const pe = bytes.readUInt32LE(60);
  check(pe, 24);
  if (bytes.toString('ascii', pe, pe + 4) !== 'PE\0\0') throw Error('启动程序 PE 标头无效');
  const optional = pe + 24, optionalSize = bytes.readUInt16LE(pe + 20);
  check(optional, optionalSize);
  const magic = bytes.readUInt16LE(optional);
  if (magic !== 0x10b && magic !== 0x20b) throw Error('启动程序 PE 格式不支持');
  const directories = optional + (magic === 0x20b ? 112 : 96);
  check(directories, 24, optional + optionalSize);
  const resourceRva = bytes.readUInt32LE(directories + 16);
  const resourceSize = bytes.readUInt32LE(directories + 20);
  if (!resourceRva || !resourceSize) return [];
  const sections = [];
  for (let i = 0; i < bytes.readUInt16LE(pe + 6); i++) {
    const offset = optional + optionalSize + i * 40;
    check(offset, 40);
    sections.push({ rva: bytes.readUInt32LE(offset + 12), size: bytes.readUInt32LE(offset + 16), raw: bytes.readUInt32LE(offset + 20) });
  }
  function fileOffset(rva, length) {
    const section = sections.find(item => rva >= item.rva && rva - item.rva + length <= item.size);
    if (!section) throw Error('启动程序版本资源地址无效');
    const offset = section.raw + rva - section.rva;
    check(offset, length);
    return offset;
  }
  const base = fileOffset(resourceRva, resourceSize), limit = base + resourceSize;
  const fields = [];
  function visitVersion(start, end, depth = 0, ancestors = []) {
    check(start, 6, end);
    const size = bytes.readUInt16LE(start), valueLength = bytes.readUInt16LE(start + 2), type = bytes.readUInt16LE(start + 4);
    check(start, size, end);
    if (size < 8 || depth > 4) throw Error('启动程序版本资源结构无效');
    let cursor = start + 6;
    while (cursor + 2 <= start + size && bytes.readUInt16LE(cursor) !== 0) cursor += 2;
    check(cursor, 2, start + size);
    const key = bytes.toString('utf16le', start + 6, cursor);
    const value = align4(cursor + 2), valueBytes = valueLength * (type === 1 ? 2 : 1);
    // Some one-file launchers encode leaf string lengths in bytes. Windows
    // accepts them; use the enclosing block as the bound for those leaf values.
    check(value, depth === 3 && type === 1 ? valueLength : valueBytes, start + size);
    if (ancestors[1] === 'StringFileInfo' && depth === 3 && type === 1 && NAME_FIELDS.has(key)) {
      const capacity = Math.floor((start + size - value) / 2) - 1;
      fields.push({ key, header: start, value, length: start + size - value, capacity });
      return;
    }
    // String values are leaves; their trailing padding is not another block.
    if (depth >= 3) return;
    for (let child = align4(value + valueBytes); child + 6 <= start + size;) {
      const childSize = bytes.readUInt16LE(child);
      if (!childSize) break;
      visitVersion(child, start + size, depth + 1, [...ancestors, key]);
      child = align4(child + childSize);
    }
  }
  function visitDirectory(relative, depth = 0) {
    const directory = base + relative;
    check(directory, 16, limit);
    const count = bytes.readUInt16LE(directory + 12) + bytes.readUInt16LE(directory + 14);
    check(directory + 16, count * 8, limit);
    for (let i = 0; i < count; i++) {
      const entry = directory + 16 + i * 8;
      if (depth === 0 && bytes.readUInt32LE(entry) !== 16) continue;
      const target = bytes.readUInt32LE(entry + 4);
      if (target & 0x80000000) {
        if (depth >= 2) throw Error('启动程序版本资源目录无效');
        visitDirectory(target & 0x7fffffff, depth + 1);
      } else {
        if (depth !== 2) throw Error('启动程序版本资源目录层级无效');
        const data = base + target;
        check(data, 16, limit);
        const length = bytes.readUInt32LE(data + 4), start = fileOffset(bytes.readUInt32LE(data), length);
        visitVersion(start, start + length);
      }
    }
  }
  visitDirectory(0);
  return fields;
}

function executableNameLength(fields) {
  const length = Math.min(25, ...fields.map(field => field.capacity - (field.key === 'OriginalFilename' ? 4 : 0)));
  if (length < 9) throw Error('启动程序名称资源过短，无法安全生成随机名');
  return length;
}
function writeExecutableName(bytes, fields, name) {
  for (const field of fields) {
    const text = name + (field.key === 'OriginalFilename' ? '.exe' : '');
    if (text.length > field.capacity) throw Error('随机名超出启动程序版本资源空间');
    bytes.fill(0, field.value, field.value + field.length);
    bytes.write(text, field.value, 'utf16le');
    bytes.writeUInt16LE(text.length + 1, field.header + 2);
  }
  return bytes;
}
module.exports = { executableNameFields, executableNameLength, writeExecutableName };
