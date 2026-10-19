const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'native/steam-bridge');
const output = path.join(root, 'app/resources/steam-bridge');
const compiler = path.join(process.env.WINDIR || 'C:/Windows', 'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
if (!fs.existsSync(compiler)) throw Error('Windows x64 with .NET Framework 4.8 is required to build the Steam bridge');
fs.mkdirSync(output, { recursive: true });
const sources = fs.readdirSync(path.join(source, 'src')).filter(file => file.endsWith('.cs')).sort().map(file => path.join(source, 'src', file));
const common = ['/nologo', '/platform:x64', '/optimize+', '/utf8output', '/codepage:65001', '/reference:System.Windows.Forms.dll', '/reference:System.Drawing.dll', '/reference:System.Web.Extensions.dll', '/reference:System.Management.dll'];
function compile(args) {
  const result = spawnSync(compiler, [...common, ...args, ...sources], { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw Error(result.stdout || result.stderr || 'Steam bridge build failed');
}
compile(['/target:winexe', '/main:EndfieldSteamBridge.Program', '/out:' + path.join(output, 'steam-bridge.exe')]);
for (const name of ['LICENSE', 'SOURCES.txt']) fs.copyFileSync(path.join(source, name), path.join(output, name));
fs.writeFileSync(path.join(output, 'steam-bridge.exe.config'), '<?xml version="1.0"?><configuration><startup><supportedRuntime version="v4.0" sku=".NETFramework,Version=v4.8"/></startup></configuration>');
console.log('Built the bundled Steam bridge');
if (process.argv.includes('--test')) {
  const tests = path.join(root, 'build/steam-bridge-tests');
  fs.mkdirSync(tests, { recursive: true });
  const executable = path.join(tests, 'CoreTests.exe');
  compile(['/target:exe', '/main:EndfieldSteamBridge.CoreTests', '/out:' + executable, path.join(source, 'tests/CoreTests.cs')]);
  const result = spawnSync(executable, [], { encoding: 'utf8', windowsHide: true, timeout: 90000 });
  process.stdout.write(result.stdout || '');
  if (result.status !== 0) throw Error(result.stderr || result.error?.message || 'Steam bridge tests failed');
}
