const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { inventory, hash } = require('./package-files.cjs');
const root = path.resolve(__dirname, '..');
const { version, productName } = require('../app/package.json');
function releaseNames(version) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version) || version.split('.').some(n => Number(n) > 65535)) {
    throw Error('app/package.json version must be a Windows-compatible major.minor.patch version');
  }
  return { version, tag: `v${version}`, title: `QAQ-Revival v${version}`, archive: `QAQ-Revival-${version}-win-x64-portable.rar` };
}
async function main() {
  const names = releaseNames(version);
  const stage = path.resolve(process.env.QAQM_BUILD_DIR || path.join(root, 'build/QAQ-Revival-local'));
  const output = path.join(root, 'release', names.archive);
  const rar = process.env.QAQM_RAR_EXE || path.join(root, '.cache/release-tools/winrar/Rar.exe');
  if (fs.existsSync(output)) throw Error('Release archive already exists: ' + names.archive);
  const manifest = JSON.parse(fs.readFileSync(path.join(stage, 'resources/app/package.json')));
  if (manifest.version !== version || productName !== 'QAQ-Revival' || manifest.productName !== productName || manifest.main !== './out/main/index.js') throw Error('Unexpected application manifest');
  const elevationCheck = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(root, 'tools/stamp-manifest.ps1'), '-Executable', path.join(stage, 'QAQ-Revival.exe'), '-CheckOnly'], { encoding: 'utf8', windowsHide: true });
  if (elevationCheck.error) throw elevationCheck.error;
  if (elevationCheck.status !== 0) throw Error('Release EXE must request administrator privileges: ' + elevationCheck.stderr);
  for (const name of ['LICENSE', 'LICENSE.electron.txt', 'QAQ-Revival.exe', 'Start.cmd', 'resources/overlay.html', 'resources/UnRAR.exe', 'resources/QaqmKeyHelper.exe', 'resources/app/resources/mega-worker/QAQMMegaWorker.exe']) {
    if (!fs.existsSync(path.join(stage, name))) throw Error('Required portable file missing: ' + name);
  }
  const files = await inventory(stage);
  for (const name of Object.keys(files)) {
    if (/(^|\/)(user-data|QAQM_DownloadCache|AppData|test-results|\.git|\.env)(\/|$)|(^|\/)smoke-entry\.cjs$|\.smoke\.exe$|\.log$/i.test(name)) {
      throw Error('Release contains personal data or test files: ' + name);
    }
  }
  fs.writeFileSync(path.join(stage, 'README.txt'), `${names.title}\r\n\r\nWindows x64 portable edition\r\nExtract the entire archive into a folder, then run QAQ-Revival.exe or Start.cmd.\r\nThe executable requests administrator consent when required.\r\nUser settings: %APPDATA%\\QAQ-Revival\r\nClose the application before replacing its files.\r\n`);
  delete files['release-manifest.json'];
  files['README.txt'] = { size: fs.statSync(path.join(stage, 'README.txt')).size, sha256: await hash(path.join(stage, 'README.txt')) };
  fs.writeFileSync(path.join(stage, 'release-manifest.json'), JSON.stringify({ product: productName, version, architecture: 'x64', files }, null, 2));
  fs.mkdirSync(path.dirname(output), { recursive: true });
  for (const args of [['a', '-ma5', '-m5', '-r', '-idq', output, '.\\*'], ['t', '-idq', output]]) {
    const result = spawnSync(rar, args, { cwd: stage, stdio: 'inherit', windowsHide: true });
    if (result.error) throw result.error;
    if (result.status !== 0) throw Error('RAR packaging/validation failed: ' + result.status);
  }
  const digest = await hash(output);
  fs.writeFileSync(output + '.sha256', digest + '  ' + names.archive + '\n');
  console.log(JSON.stringify({ release: names.archive, sha256: digest, bytes: fs.statSync(output).size }));
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { releaseNames };
