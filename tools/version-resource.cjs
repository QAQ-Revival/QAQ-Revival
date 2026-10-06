// Encode the documented VS_VERSION_INFO format. No third-party binary patcher required.
const fs = require('node:fs');
const pad = buffer => Buffer.concat([buffer, Buffer.alloc((4 - buffer.length % 4) % 4)]);
function block(key, value = Buffer.alloc(0), children = [], text = false) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(text ? value.length / 2 : value.length, 2);
  header.writeUInt16LE(text ? 1 : 0, 4);
  const result = Buffer.concat([pad(Buffer.concat([header, Buffer.from(key + '\0', 'utf16le')])), pad(value), ...children.map(pad)]);
  result.writeUInt16LE(result.length, 0);
  return result;
}
function versionResource(name, version) {
  const numbers = version.split('.').map(Number);
  while (numbers.length < 4) numbers.push(0);
  if (numbers.length !== 4 || numbers.some(n => !Number.isInteger(n) || n < 0 || n > 65535)) throw Error('Invalid Windows version');
  const high = numbers[0] * 65536 + numbers[1], low = numbers[2] * 65536 + numbers[3];
  const fixed = Buffer.alloc(52);
  [0xfeef04bd, 0x10000, high, low, high, low, 0x3f, 0, 0x40004, 1, 0, 0, 0].forEach((v,i) => fixed.writeUInt32LE(v, i * 4));
  const values = { FileDescription: name, FileVersion: version, ProductName: name, ProductVersion: version,
    InternalName: name, OriginalFilename: name + '.exe' };
  const strings = Object.entries(values).map(([k,v]) => block(k, Buffer.from(v + '\0', 'utf16le'), [], true));
  return block('VS_VERSION_INFO', fixed, [block('StringFileInfo', undefined, [block('040904B0', undefined, strings, true)], true),
    block('VarFileInfo', undefined, [block('Translation', Buffer.from([9,4,0xb0,4]))], true)]);
}
if (require.main === module) fs.writeFileSync(process.argv[2], versionResource('QAQ-Revival', '1.0.0'));
module.exports = { versionResource };
