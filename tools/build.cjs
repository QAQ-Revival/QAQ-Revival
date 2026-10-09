const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const { electronVersion } = require('./release-config.json');
const source = path.resolve(process.argv[2] || path.join(root, `.cache/electron-${electronVersion}-win32-x64`));
const appManifest = require('../app/package.json');
const target = path.resolve(process.env.QAQM_BUILD_DIR || path.join(root, 'build', 'QAQ-Revival-local'));
const buildRoot = path.join(root, 'build');
const relativeTarget = path.relative(buildRoot, target);
if (!relativeTarget || relativeTarget.startsWith('..') || path.isAbsolute(relativeTarget)) throw Error('Build target must be inside the workspace build directory');
const runtimeExe = 'electron.exe';
if (source === target || !fs.existsSync(path.join(source, runtimeExe))) throw Error('Run node tools/prepare-release.cjs to download the official Electron runtime');
const megaBuild = require('node:child_process').spawnSync(process.execPath, [path.join(root, 'tools/build-mega.cjs')], { stdio: 'inherit', windowsHide: true });
if (megaBuild.status !== 0) process.exit(megaBuild.status || 1);
if (fs.existsSync(target)) {
  const resolvedTarget = fs.realpathSync(target);
  const resolvedBuild = fs.realpathSync(buildRoot);
  const resolvedRelative = path.relative(resolvedBuild, resolvedTarget);
  if (!resolvedRelative || resolvedRelative.startsWith('..') || path.isAbsolute(resolvedRelative)) throw Error('Build target resolves outside the build directory');
  for (const name of ['user-data', 'QAQM_DownloadCache']) {
    if (fs.existsSync(path.join(target, name))) throw Error('Build directory contains user data; choose a fresh QAQM_BUILD_DIR');
  }
  fs.rmSync(target, { recursive: true, force: true });
}
fs.mkdirSync(target, { recursive: true });
function copyChanged(sourcePath, targetPath) {
  fs.cpSync(sourcePath, targetPath, { recursive: true, filter: (from, to) => {
    if (!fs.statSync(from).isFile() || !fs.existsSync(to)) return true;
    if (fs.statSync(from).size !== fs.statSync(to).size) return true;
    const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    return hash(from) !== hash(to);
  } });
}
for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
  if (entry.name === 'resources') continue;
  const destinationName = entry.name === runtimeExe ? 'QAQ-Revival.exe' : entry.name === 'LICENSE' ? 'LICENSE.electron.txt' : entry.name;
  copyChanged(path.join(source, entry.name), path.join(target, destinationName));
}
const versionResource = path.join(target, 'version-resource.bin');
fs.writeFileSync(versionResource, require('./version-resource.cjs').versionResource(appManifest.productName, appManifest.version));
const stamp = require('node:child_process').spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(root, 'tools/stamp-version.ps1'), '-Executable', path.join(target, 'QAQ-Revival.exe'), '-VersionResource', versionResource], { stdio: 'inherit', windowsHide: true });
if (stamp.status !== 0) process.exit(stamp.status || 1);
fs.unlinkSync(versionResource);
for (const [script, args] of [
  ['build-icon.ps1', []],
  ['stamp-icon.ps1', ['-Executable', path.join(target, 'QAQ-Revival.exe'), '-Icon', path.join(root, 'app/resources/icon.ico')]],
  ['stamp-manifest.ps1', ['-Executable', path.join(target, 'QAQ-Revival.exe')]]
]) {
  const result = require('node:child_process').spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(root, 'tools', script), ...args], { stdio: 'inherit', windowsHide: true });
  if (result.status !== 0) process.exit(result.status || 1);
}
const resources = path.join(target, 'resources');
fs.mkdirSync(resources, { recursive: true });
fs.cpSync(path.join(root, 'runtime-resources'), resources, { recursive: true });
// Replace generated application files so removed source modules do not survive a rebuild.
// User data lives outside resources/app and is preserved.
const appTarget = path.join(resources, 'app');
fs.rmSync(appTarget, { recursive: true, force: true });
fs.cpSync(path.join(root, 'app'), appTarget, { recursive: true });
require('./package-files.cjs').copyLocalComponents(root, target);
// Product name and version come from the application manifest.
const manifestPath = path.join(resources, 'app', 'package.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath));
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
fs.copyFileSync(path.join(root, 'LICENSE'), path.join(target, 'LICENSE'));
fs.copyFileSync(path.join(root, 'tools/start.ps1'), path.join(target, 'Start.ps1'));
fs.writeFileSync(path.join(target, 'Start.cmd'), '@echo off\r\npowershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start.ps1" -RuntimePath "%~dp0."\r\nif errorlevel 1 pause\r\n');
fs.writeFileSync(path.join(target, 'README.txt'), `${appManifest.productName} ${appManifest.version}\r\n\r\nStart: QAQ-Revival.exe or Start.cmd\r\nThe executable requests administrator consent when required.\r\nData: %APPDATA%\\QAQ-Revival\r\n`);
const staleManifest = path.join(target, 'release-manifest.json');
if (fs.existsSync(staleManifest)) fs.unlinkSync(staleManifest);
console.log(`Built ${target}`);
