const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { executableNameFields, executableNameLength, writeExecutableName } = require('./executable-name.cjs');

const RANDOM_EXE = /^[a-z][a-f0-9]{8,24}\.exe$/;
const markerPath = executable => path.join(path.dirname(executable), '.' + path.basename(executable) + '.runtime.json');
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const ordinaryFile = file => { try { const stat = fs.lstatSync(file); return stat.isFile() && !stat.isSymbolicLink(); } catch { return false; } };
function getRandomLaunchSettings(config = {}) {
  return { manager: config.randomLaunch?.manager !== false, xxmi: config.randomLaunch?.xxmi !== false };
}
function readRandomLaunchSettings(profile) {
  for (const name of ['config.json', 'config.json.bak']) {
    try {
      const config = JSON.parse(fs.readFileSync(path.join(profile, name), 'utf8').replace(/^\uFEFF/, ''));
      if (config && typeof config === 'object' && !Array.isArray(config)) return getRandomLaunchSettings(config);
    } catch { /* Match main-process configuration recovery before services initialize. */ }
  }
  return getRandomLaunchSettings();
}
function readIdentity(executable, source) {
  if (!RANDOM_EXE.test(path.basename(executable)) || path.dirname(executable) !== path.dirname(source)) return null;
  const marker = markerPath(executable);
  if (!ordinaryFile(executable) || !ordinaryFile(marker)) return null;
  try {
    const identity = JSON.parse(fs.readFileSync(marker, 'utf8'));
    if (![1, 2].includes(identity.version) || identity.source !== path.basename(source) || identity.executable !== path.basename(executable) || !/^[a-f0-9]{64}$/.test(identity.sha256)) return null;
    if (identity.version === 2 && !/^[a-f0-9]{64}$/.test(identity.sourceSha256)) return null;
    return digest(executable) === identity.sha256 ? identity : null;
  } catch { return null; }
}
function releaseExecutable(executable, source) {
  if (!readIdentity(executable, source)) return false;
  try {
    // Windows denies deleting a running image. Never terminate a process to clean up.
    fs.unlinkSync(executable);
    fs.unlinkSync(markerPath(executable));
    return true;
  } catch { return false; }
}
function cleanupExecutables(source, except = process.execPath) {
  for (const name of fs.readdirSync(path.dirname(source))) {
    const match = /^\.([a-z][a-f0-9]{8,24}\.exe)\.runtime\.json$/.exec(name);
    if (!match) continue;
    const executable = path.join(path.dirname(source), match[1]);
    const identity = readIdentity(executable, source);
    // A just-prepared image may not have been opened by its child process yet.
    if (identity && !identity.activated && Date.now() - identity.createdAt < 60000) continue;
    if (executable.toLowerCase() !== except.toLowerCase()) releaseExecutable(executable, source);
  }
}
function prepareExecutable(sourcePath, { cleanup = true } = {}) {
  const source = path.resolve(sourcePath);
  if (!ordinaryFile(source) || path.extname(source).toLowerCase() !== '.exe') throw Error('启动程序不存在或不是普通 EXE 文件');
  if (cleanup) cleanupExecutables(source);
  const bytes = fs.readFileSync(source);
  const sourceSha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  const fields = executableNameFields(bytes);
  const name = 'r' + crypto.randomBytes(12).toString('hex').slice(0, executableNameLength(fields) - 1);
  const executable = path.join(path.dirname(source), name + '.exe');
  let copied = false;
  try {
    writeExecutableName(bytes, fields, name);
    const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    fs.writeFileSync(executable, bytes, { flag: 'wx', mode: fs.statSync(source).mode });
    copied = true;
    if (digest(executable) !== sha256 || digest(source) !== sourceSha256) throw Error('启动程序复制校验失败，请等待更新结束后重试');
    fs.writeFileSync(markerPath(executable), JSON.stringify({ version: 2, source: path.basename(source), executable: path.basename(executable), sourceSha256, sha256, createdAt: Date.now(), activated: false }), { flag: 'wx' });
    return { source, executable, name: path.basename(executable, '.exe'), sha256 };
  } catch (error) {
    if (copied) { try { fs.unlinkSync(executable); } catch {} }
    throw Error('无法创建随机名启动副本：' + error.message);
  }
}
async function launchRandomExecutable(source, workingDir, args, launch) {
  let prepared;
  try {
    prepared = prepareExecutable(source);
    const result = await launch(prepared.executable, workingDir, args);
    if (!result?.success) releaseExecutable(prepared.executable, prepared.source);
    return result;
  } catch (error) {
    if (prepared) releaseExecutable(prepared.executable, prepared.source);
    return { success: false, error: error.message || String(error) };
  }
}
function startRandomManager(app, { execPath = process.execPath, args = process.argv.slice(1), manifestPath = path.join(process.resourcesPath || '', 'app/package.json'), enabled = true } = {}) {
  if (process.platform !== 'win32' || !app.isPackaged) return { relaunched: false, name: null };
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  // Development and dedicated test entries own their process lifecycle.
  if (manifest.main !== './out/main/index.js') return { relaunched: false, name: null };
  const source = path.join(path.dirname(execPath), 'QAQ-Revival.exe');
  const identity = readIdentity(execPath, source);
  if (!enabled) {
    if (identity && ordinaryFile(source)) {
      app.relaunch({ execPath: source, args });
      app.exit(0);
      return { relaunched: true, name: null };
    }
    cleanupExecutables(source);
    return { relaunched: false, name: null };
  }
  if (identity?.version === 2 && identity.activated === false && ordinaryFile(source) && identity.sourceSha256 === digest(source)) {
    fs.writeFileSync(markerPath(execPath), JSON.stringify({ ...identity, activated: true }));
    return { relaunched: false, name: path.basename(execPath, '.exe') };
  }
  const prepared = prepareExecutable(source);
  try {
    // Electron starts the child after this process exits and releases its profile lock.
    app.relaunch({ execPath: prepared.executable, args });
    app.exit(0);
    return { relaunched: true, name: prepared.name };
  } catch (error) {
    releaseExecutable(prepared.executable, prepared.source);
    throw error;
  }
}
module.exports = { RANDOM_EXE, digest, readIdentity, prepareExecutable, releaseExecutable, cleanupExecutables, launchRandomExecutable, startRandomManager, getRandomLaunchSettings, readRandomLaunchSettings };
