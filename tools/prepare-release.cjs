// Download build tools from their publishers; never inspect an installed application.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const config = require('./release-config.json');
const root = path.resolve(__dirname, '..');
const cache = path.join(root, '.cache/release-tools');
function run(file, args) {
  const result = spawnSync(file, args, { stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw Error(`${path.basename(file)} failed (${result.status})`);
}
async function download(url, file, expected) {
  if (fs.existsSync(file) && digest(file) === expected) return;
  const response = await fetch(url);
  if (!response.ok) throw Error(`Download failed: ${url} (${response.status})`);
  await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(file));
  if (digest(file) !== expected) throw Error('Checksum mismatch: ' + path.basename(file));
}
function digest(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
async function main() {
  if (process.platform !== 'win32') throw Error('Windows is required for the portable build');
  fs.mkdirSync(cache, { recursive: true });
  const archive = `electron-v${config.electronVersion}-win32-x64.zip`;
  const base = `https://github.com/electron/electron/releases/download/v${config.electronVersion}`;
  const sums = await fetch(`${base}/SHASUMS256.txt`);
  if (!sums.ok) throw Error('Could not read Electron checksums');
  const expected = (await sums.text()).split('\n').map(line => line.trim().split(/\s+/))
    .find(parts => parts[1]?.replace(/^\*/, '') === archive)?.[0];
  if (!/^[a-f0-9]{64}$/.test(expected || '')) throw Error('Electron checksum missing');
  await download(`${base}/${archive}`, path.join(cache, archive), expected);
  const runtime = path.join(root, `.cache/electron-${config.electronVersion}-win32-x64`);
  run(path.join(root, 'app/node_modules/7zip-bin/win/x64/7za.exe'), ['x', '-y', '-bso0', '-bsp0', `-o${runtime}`, path.join(cache, archive)]);
  const rarInstaller = path.join(cache, 'winrar.exe');
  await download(config.rarInstallerUrl, rarInstaller, config.rarInstallerSha256);
  const rarDir = path.join(cache, 'winrar');
  fs.mkdirSync(rarDir, { recursive: true });
  run(path.join(root, 'runtime-resources/UnRAR.exe'), ['x', '-o+', '-idq', rarInstaller, rarDir + path.sep]);
  if (!fs.existsSync(path.join(rarDir, 'Rar.exe'))) throw Error('RAR command line tool missing');
  console.log('Verified Electron runtime and RAR packager are ready.');
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
