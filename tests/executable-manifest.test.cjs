const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const runtime = path.resolve(process.env.QAQM_BUILD_DIR || path.join(root, 'build/QAQ-Revival-local'));
const executable = path.join(runtime, 'QAQ-Revival.exe');
fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });
function runScript(args) {
  const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(root, 'tools/stamp-manifest.ps1'), ...args], { encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  return JSON.parse(result.stdout);
}
function codeHash(file) {
  const data = fs.readFileSync(file), pe = data.readUInt32LE(0x3c);
  const first = pe + 24 + data.readUInt16LE(pe + 20), count = data.readUInt16LE(pe + 6);
  const hashes = {};
  for (let i = 0; i < count; i++) {
    const section = first + i * 40, name = data.subarray(section, section + 8).toString().replace(/\0.*$/, '');
    if (name === '.rsrc') continue;
    const start = data.readUInt32LE(section + 20), size = data.readUInt32LE(section + 16);
    hashes[name] = crypto.createHash('sha256').update(data.subarray(start, start + size)).digest('hex');
  }
  return hashes;
}
test('packaged EXE requests administrator in its real RT_MANIFEST resource', { skip: process.platform !== 'win32' }, () => {
  const manifests = runScript(['-Executable', executable, '-CheckOnly']);
  assert.ok(manifests.length > 0);
  for (const manifest of manifests) assert.equal(manifest.Level, 'requireAdministrator');
});
test('manifest stamping preserves application code and all other manifest declarations', { skip: process.platform !== 'win32' }, () => {
  const directory = fs.mkdtempSync(path.join(root, 'test-results/manifest-'));
  const copy = path.join(directory, 'fixture.exe');
  fs.copyFileSync(executable, copy);
  const before = runScript(['-Executable', copy, '-CheckOnly']);
  const codeBefore = codeHash(copy);
  const ordinary = runScript(['-Executable', copy, '-ExecutionLevel', 'asInvoker']);
  assert.equal(ordinary.length, before.length);
  for (let i = 0; i < before.length; i++) {
    assert.equal(ordinary[i].Xml.replace('level="asInvoker"', 'level="requireAdministrator"'), before[i].Xml);
  }
  const after = runScript(['-Executable', copy]);
  assert.deepEqual(after, before);
  assert.deepEqual(codeHash(copy), codeBefore);
});
test('Windows rejects non-elevated CreateProcess with ERROR_ELEVATION_REQUIRED', { skip: process.platform !== 'win32' }, t => {
  // UseShellExecute=false cannot display or approve UAC. The OS must reject startup.
  const literal = executable.replace(/'/g, "''");
  const testProfile = path.join(root, 'test-results/native-elevation-profile').replace(/'/g, "''");
  const script = `$p = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent()); if ($p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { 'ELEVATED_SKIP'; exit 0 }; $s = New-Object Diagnostics.ProcessStartInfo; $s.FileName = '${literal}'; $s.UseShellExecute = $false; $s.CreateNoWindow = $true; $s.EnvironmentVariables['QAQM_USER_DATA'] = '${testProfile}'; try { $child = [Diagnostics.Process]::Start($s); $child.Kill(); throw 'Unexpected ordinary launch' } catch { $e = $_.Exception; while ($e.InnerException) { $e = $e.InnerException }; if ($e -is [ComponentModel.Win32Exception] -and $e.NativeErrorCode -eq 740) { 'ERROR_ELEVATION_REQUIRED:740'; exit 0 }; throw }`;
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, result.stderr);
  if (result.stdout.includes('ELEVATED_SKIP')) return t.skip('CI shell already elevated; manifest is checked independently');
  assert.match(result.stdout, /ERROR_ELEVATION_REQUIRED:740/);
});
