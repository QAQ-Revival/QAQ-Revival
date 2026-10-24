const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const upstream = path.join(root, 'native/xxmi-launcher');
const adapter = path.join(root, 'bridges/xxmi-installer');
const work = path.join(root, 'build/xxmi-installer');
const packages = path.join(root, '.cache/xxmi-installer-python');
function run(executable, args, options = {}) {
  const result = spawnSync(executable, args, { cwd: root, windowsHide: true, stdio: 'inherit', ...options });
  if (result.error || result.status) throw result.error || Error('XXMI component build failed');
  return result.stdout?.trim();
}
function build({ output = path.join(root, 'local-components/xxmi-installer'), test = false } = {}) {
  if (path.resolve(output) !== path.join(root, 'local-components/xxmi-installer')) throw Error('Invalid XXMI component output');
  const python = process.env.QAQR_PYTHON || 'python';
  const revision = run('git', ['-C', upstream, 'rev-parse', 'HEAD'], { stdio: 'pipe', encoding: 'utf8' });
  if (!revision || run('git', ['-C', upstream, 'status', '--porcelain'], { stdio: 'pipe', encoding: 'utf8' })) throw Error('XXMI upstream checkout must be clean');
  fs.mkdirSync(work, { recursive: true });
  fs.mkdirSync(packages, { recursive: true });
  const required = new Set(['attrs', 'cattrs', 'certifi', 'cffi', 'charset-normalizer', 'cryptography', 'customtkinter', 'dacite', 'darkdetect', 'idna', 'mslex', 'packaging', 'pefile', 'pillow', 'psutil', 'pycparser', 'pywin32', 'requests', 'typing_extensions', 'urllib3', 'vdf', 'winshell', 'PySocks'].map(name => name.toLowerCase()));
  const requirements = fs.readFileSync(path.join(upstream, 'requirements.txt'), 'utf8').split(/\r?\n/).filter(line => required.has(line.split('==')[0].toLowerCase()));
  if (requirements.length !== required.size) throw Error('Review updated XXMI installer dependencies');
  // PyInstaller excludes upstream's pefile release because of a parser regression.
  // The adapter only uses the stable version-resource API shared by both releases.
  requirements.splice(requirements.findIndex(line => line.startsWith('pefile==')), 1, 'pefile==2023.2.7');
  requirements.push('pyinstaller==6.16.0');
  const requirementFile = path.join(work, 'requirements.txt');
  fs.writeFileSync(requirementFile, requirements.join('\n') + '\n');
  const fingerprint = crypto.createHash('sha256').update(requirements.join('\n')).digest('hex');
  const fingerprintFile = path.join(packages, '.qaqr-requirements');
  if (!fs.existsSync(fingerprintFile) || fs.readFileSync(fingerprintFile, 'utf8') !== fingerprint) {
    run(python, ['-m', 'pip', 'install', '--disable-pip-version-check', '--upgrade', '--target', packages, '-r', requirementFile]);
    fs.writeFileSync(fingerprintFile, fingerprint);
  }
  const bootstrap = path.join(work, 'bootstrap');
  fs.mkdirSync(bootstrap, { recursive: true });
  fs.writeFileSync(path.join(bootstrap, 'sitecustomize.py'), `import os, site\nsite.addsitedir(${JSON.stringify(packages)})\n_dll_directory = os.add_dll_directory(${JSON.stringify(path.join(packages, 'pywin32_system32'))})\n`);
  const env = { ...process.env, PYTHONPATH: [bootstrap, path.join(upstream, 'src/xxmi_launcher'), packages, path.join(packages, 'win32'), path.join(packages, 'win32/lib'), path.join(packages, 'Pythonwin')].join(path.delimiter), PYTHONUTF8: '1', PYINSTALLER_CONFIG_DIR: path.join(work, 'pyinstaller-cache') };
  if (test) run(python, [path.join(adapter, 'test_installer.py')], { env });
  run(python, ['-m', 'PyInstaller', '--noconfirm', '--clean', '--onedir', '--name', 'XxmiInstaller', '--distpath', path.join(work, 'dist'), '--workpath', path.join(work, 'freeze'), '--specpath', work, '--paths', path.join(upstream, 'src/xxmi_launcher'), '--paths', packages, '--collect-data', 'customtkinter', '--exclude-module', 'av', '--exclude-module', 'tkinterweb', path.join(adapter, 'worker.py')], { env });
  // This fixed output is generated program code, never the managed XXMI install.
  for (let current = output; current !== path.dirname(current); current = path.dirname(current)) if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw Error('Linked component output');
  if (fs.existsSync(output)) {
    for (const name of ['data', 'Mods', 'user-data']) if (fs.existsSync(path.join(output, name))) throw Error('Generated component output contains user data');
    fs.rmSync(output, { recursive: true, force: true });
  }
  fs.mkdirSync(output, { recursive: true });
  fs.cpSync(path.join(work, 'dist/XxmiInstaller'), path.join(output, 'XxmiInstaller'), { recursive: true });
  const licenses = path.join(output, 'licenses');
  fs.mkdirSync(licenses, { recursive: true });
  fs.copyFileSync(path.join(upstream, 'LICENSE'), path.join(licenses, 'XXMI-Launcher-LICENSE.txt'));
  // Ship the pinned corresponding source, including our adapter, with the GPL component.
  fs.cpSync(path.join(upstream, 'src/xxmi_launcher/core'), path.join(output, 'source/core'), { recursive: true });
  fs.mkdirSync(path.join(output, 'source/gui'), { recursive: true });
  fs.copyFileSync(path.join(upstream, 'src/xxmi_launcher/gui/enums.py'), path.join(output, 'source/gui/enums.py'));
  fs.copyFileSync(__filename, path.join(output, 'source/build-xxmi.cjs'));
  fs.cpSync(adapter, path.join(output, 'source/qaqr'), { recursive: true, filter: file => !file.includes('__pycache__') });
  fs.copyFileSync(path.join(upstream, 'requirements.txt'), path.join(output, 'source/upstream-requirements.txt'));
  for (const name of fs.readdirSync(packages).filter(name => name.endsWith('.dist-info'))) {
    for (const item of fs.readdirSync(path.join(packages, name)).filter(item => /licen[cs]e|copying|notice/i.test(item))) fs.cpSync(path.join(packages, name, item), path.join(licenses, name, item), { recursive: true });
  }
  const files = {};
  for (const entry of fs.readdirSync(output, { recursive: true, withFileTypes: true })) if (entry.isFile() && entry.name !== 'component.json') {
    const file = path.join(entry.parentPath, entry.name);
    files[path.relative(output, file).split(path.sep).join('/')] = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  }
  fs.writeFileSync(path.join(output, 'component.json'), JSON.stringify({ protocol: 1, source: 'https://github.com/SpectrumQT/XXMI-Launcher', sourceCommit: revision, files }, null, 2));
  console.log('Built embedded XXMI installer from pinned upstream submodule ' + revision);
  return output;
}
if (require.main === module) build({ test: process.argv.includes('--test') });
module.exports = { build };
