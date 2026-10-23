// Temporarily substitute the portable entry point, then restore it even on failure.
const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const runtime = path.resolve(process.env.QAQM_BUILD_DIR || path.join(root, 'build/QAQ-Revival-local'));
const manifestPath = path.join(runtime, 'resources/app/package.json');
const original = fs.readFileSync(manifestPath, 'utf8');
const manifest = JSON.parse(original);
const entry = path.join(runtime, 'resources/app/smoke-entry.cjs');
const results = path.join(root, 'test-results', 'smoke-' + Date.now());
fs.mkdirSync(results, { recursive: true });
// Do not automate UAC consent. Use a temporary, non-elevated copy for UI/IPC tests;
// the distributed executable retains requireAdministrator and is verified separately.
const testExecutable = path.join(runtime, 'QAQ-Revival.smoke.exe');
if (fs.existsSync(testExecutable)) throw Error('Previous smoke executable still exists; inspect it before retrying');
fs.copyFileSync(path.join(runtime, 'QAQ-Revival.exe'), testExecutable);
const prepareRunner = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(root, 'tools/stamp-manifest.ps1'), '-Executable', testExecutable, '-ExecutionLevel', 'asInvoker'], { encoding: 'utf8', windowsHide: true });
if (prepareRunner.error || prepareRunner.status !== 0) {
  fs.unlinkSync(testExecutable);
  throw prepareRunner.error || Error(prepareRunner.stderr || 'Could not prepare the smoke runner');
}
const testEntry = process.argv.includes('--window-state') ? 'window-state-smoke.cjs' : process.argv.includes('--single-instance') ? 'single-instance-smoke.cjs' : process.argv.includes('--hidden-characters-restart') ? 'hidden-characters-restart.cjs' : 'electron-smoke.cjs';
fs.writeFileSync(entry, `require(${JSON.stringify(path.join(root, 'tests', testEntry))});`);
manifest.main = './smoke-entry.cjs';
fs.writeFileSync(manifestPath, JSON.stringify(manifest));
const env = { ...process.env, QAQM_TEST_RESULTS: results, QAQM_USER_DATA: path.join(results, 'AppData/QAQ-Revival') };
const scopes = [
  'translation', 'genshin', 'genshin-check', 'genshin-anticrash', 'game-settings',
  'steam-bridge', 'hidden-characters', 'character-images', 'character-skins',
  'skin-cover-live', 'file-drop', 'persist', 'mod-sites', 'card-images',
  'overlay-activity', 'mod-layout', 'window-layout', 'post-links', 'market-scope',
  'imports', 'sources', 'sorting', 'settings'
];
const scope = scopes.find(name => process.argv.includes('--' + name));
if (scope) env.QAQM_SMOKE_SCOPE = scope;
delete env.ELECTRON_RUN_AS_NODE;
const log = fs.openSync(path.join(results, 'electron.log'), 'w');
const child = spawn(testExecutable, [], { cwd: runtime, env, windowsHide: true, stdio: ['ignore', log, log] });
const timeout = setTimeout(() => child.kill(), 180000);
let restored = false;
async function restore() {
  if (restored) return;
  restored = true;
  clearTimeout(timeout); fs.writeFileSync(manifestPath, original); fs.closeSync(log);
  fs.unlinkSync(entry);
  // Windows can retain the executable briefly while Electron's child processes exit.
  for (let attempt = 0; ; attempt++) {
    try { await fs.promises.unlink(testExecutable); break; }
    catch (error) {
      if (error.code !== 'EPERM' || attempt === 4) throw error;
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
}
child.on('error', async err => { await restore(); console.error(err); process.exitCode = 1; });
child.on('exit', async code => {
  await restore();
  const report = path.join(results, 'report.json');
  if (fs.existsSync(report)) console.log(fs.readFileSync(report, 'utf8'));
  else console.error('No test report; see ' + path.join(results, 'electron.log'));
  console.log('Results: ' + results);
  process.exitCode = code || (fs.existsSync(report) ? 0 : 1);
});
