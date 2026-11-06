const fs = require('node:fs');
const path = require('node:path');

function verifyDownstream(directory, name) {
  const read = file => fs.readFileSync(path.join(directory, file), 'utf8');
  const modules = path.join(directory, '.gitmodules');
  if (fs.existsSync(modules)) {
    for (const [, url] of read('.gitmodules').matchAll(/^\s*url\s*=\s*(\S+)/gm)) {
      if (!/^https:\/\/github\.com\/QAQ-Revival\/[\w.-]+\.git$/.test(url)) throw Error(`${name} introduces an unmanaged submodule; create and review its organization fork first`);
    }
  }
  if (name === 'UnityPy' && /AudioClipConverter/.test(read('UnityPy/export/__init__.py'))) throw Error('UnityPy audio exclusion needs review after the upstream merge');
  if (name === 'XXMI-Libs-Package') {
    const command = read('DirectX11/CommandList.cpp');
    if (!/MarkPersistentVariableDirty\(var\)/.test(command) || !/source_desc\.ByteWidth/.test(command) || !/legacy REF views/.test(command) || !read('DirectX11/QaqrRuntime.inc').includes('QAQR.Activity.v1.')) throw Error('XXMI downstream persistence, activity or compatibility changes need review');
  }
  if (name === 'EFMI-Package') {
    const ini = read('EFMI/Core/EFMI/MergedSkeleton.ini');
    const section = /\[ResourceConfigWithBones\]([^\[]*)/.exec(ini)?.[1] || '';
    if (!/^type\s*=\s*RWStructuredBuffer\s*$/m.test(section) || !/^stride\s*=\s*16\s*$/m.test(section) || !/^format\s*=\s*UNKNOWN\s*$/m.test(section) || !read('EFMI/Core/EFMI/Shaders/MergedSkeleton_InstanceConfigOverrider_ConstantBuffer.hlsl').includes('RWStructuredBuffer<uint4>')) throw Error('EFMI structured UAV repair needs review');
  }
}
module.exports = { verifyDownstream };
