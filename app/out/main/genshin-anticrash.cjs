const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { peInfo, samePath } = require('./genshin-diagnostics.cjs');
const { prepareExecutable, releaseExecutable } = require('./random-executable.cjs');

const GAME_ID = 'genshin-impact';
const TWIN_EXE = /^[a-z][a-f0-9]{16}\.exe$/;
const ABSENT = '\u0000qaq-absent\u0000';
// XXMI Launcher Config.json fields consumed by its launch flow:
// Importer.process_exe_names picks the executable it launches and injects into,
// Importer.game_launch defers the game start to the user,
// Importer.xxmi_dll_inject_mode selects its DLL loading path (enum name strings),
// Migoto.unsafe_mode stops XXMI from re-verifying and redeploying its own d3d11.dll,
// which is what allows a locally chosen substitute to stay in place.
const MANAGED_NODES = {
  importer: ['process_exe_names', 'game_launch', 'xxmi_dll_inject_mode', 'd3dx_ini'],
  migoto: ['unsafe_mode']
};
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const shaPath = value => sha(Buffer.from(String(value).toLowerCase(), 'utf8'));

function loaderIniLines(bytes) {
  const lines = bytes.toString('utf8').split(/(?<=\n)/);
  let inLoader = false;
  const entries = {};
  lines.forEach((line, index) => {
    const section = /^\s*\[([^\]]+)\]/.exec(line.replace(/^\uFEFF/, ''));
    if (section) inLoader = section[1].toLowerCase() === 'loader';
    if (!inLoader) return;
    const entry = /^\s*(loader|target)\s*=\s*([^;\r\n]*)/i.exec(line);
    if (entry) entries[entry[1].toLowerCase()] = { index, value: entry[2].trim(), line };
  });
  return { lines, entries };
}
function restoreLoaderIni(record, notes) {
  try {
    const currentBytes = smallFile(record.path);
    const current = loaderIniLines(currentBytes), before = loaderIniLines(Buffer.from(record.beforeBytes, 'base64'));
    for (const [key, value] of Object.entries(record.applied)) {
      const entry = current.entries[key];
      if (entry?.value === value) current.lines[entry.index] = before.entries[key]?.line || '';
    }
    const restored = Buffer.from(current.lines.join(''), 'utf8');
    if (!restored.equals(currentBytes)) writeAtomic(record.path, restored);
    return true;
  } catch (error) { notes.push('GIMI Loader 配置还原失败：' + error.message); return false; }
}
function restoreLoaderConfig(target, applied, before) {
  if (target.d3dx_ini?.core?.Loader?.loader !== applied.core?.Loader?.loader) return false;
  const previous = before === ABSENT ? undefined : before;
  const oldLoader = previous?.core?.Loader;
  if (oldLoader && Object.hasOwn(oldLoader, 'loader')) target.d3dx_ini.core.Loader.loader = oldLoader.loader;
  else delete target.d3dx_ini.core.Loader.loader;
  for (const [parent, key, existed] of [
    [target.d3dx_ini.core, 'Loader', oldLoader !== undefined],
    [target.d3dx_ini, 'core', previous?.core !== undefined],
    [target, 'd3dx_ini', previous !== undefined]
  ]) if (!existed && parent[key] && !Object.keys(parent[key]).length) delete parent[key];
  return true;
}

function normalizeSettings(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    twin: source.twin === true,
    manualStart: source.manualStart === true,
    injectMode: ['default', 'hook', 'direct'].includes(source.injectMode) ? source.injectMode : 'default',
    networkBlock: source.networkBlock === true,
    originalDll: source.originalDll === true,
    customDll: source.customDll === true
  };
}
function anyEnabled(settings, customDllPath) {
  return !!(settings.twin || settings.manualStart || settings.injectMode !== 'default' || settings.networkBlock || settings.originalDll ||
    (settings.customDll && typeof customDllPath === 'string' && customDllPath.trim()));
}
function smallFile(file, limit = 2 * 1024 * 1024) {
  const stat = fs.statSync(file);
  if (!stat.isFile() || stat.size > limit) throw Error('文件类型或大小不受支持');
  return fs.readFileSync(file);
}
function isDirectory(file) { try { return !!file && fs.statSync(file).isDirectory(); } catch { return false; } }
function parseConfig(bytes, file) {
  let config;
  try { config = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, '')); } catch { throw Error('XXMI 配置不可读取，未做任何修改'); }
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw Error('XXMI 配置格式无效，未做任何修改');
  return config;
}
function writeAtomic(file, bytes) {
  const temporary = file + '.qaq-' + crypto.randomUUID();
  try {
    fs.writeFileSync(temporary, bytes, { flag: 'wx' });
    // Status polls can hold the destination open for a few milliseconds; Windows then
    // rejects renaming over it with EPERM. Brief synchronous retries close that window.
    const buffer = new Int32Array(new SharedArrayBuffer(4));
    for (let attempt = 0; ; attempt++) {
      try { fs.renameSync(temporary, file); return; }
      catch (error) {
        if (!['EPERM', 'EACCES', 'EBUSY'].includes(error.code) || attempt >= 5) throw error;
        Atomics.wait(buffer, 0, 0, 50);
      }
    }
  } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}
function randomTwinName(taken) {
  for (let attempt = 0; attempt < 32; attempt++) {
    const name = 'g' + crypto.randomBytes(8).toString('hex') + '.exe';
    if (TWIN_EXE.test(name) && !taken.includes(name.toLowerCase())) return name;
  }
  throw Error('无法生成可用的随机名');
}
function firewallRuleName(executable) {
  return 'Block ' + path.basename(executable, path.extname(executable)) + '-' + shaPath(executable).slice(0, 6) + path.extname(executable);
}
function createGenshinAntiCrashService({
  getGame, resolveLauncherRoot, stateDir, assertStopped = async () => {},
  defaultCustomDllPath = '',
  runNetsh = async () => ({ ok: false, error: '防火墙命令不可用' }),
  isFirewallRulePresent = async () => true,
  isProcessNameRunning = async () => false, isElevated = () => true
}) {
  const sessionPath = path.join(stateDir, 'session.json');
  const backupRoot = path.join(stateDir, 'backups');
  let busy = false, watcher = null;

  function resolveCustomDllPath(settings) {
    const selected = typeof settings?.customDllPath === 'string' ? settings.customDllPath.trim() : '';
    if (selected) return selected;
    try { if (defaultCustomDllPath && fs.statSync(defaultCustomDllPath).isFile()) return defaultCustomDllPath; } catch {}
    return '';
  }

  function readSession() {
    try {
      const session = JSON.parse(smallFile(sessionPath, 4 * 1024 * 1024).toString('utf8'));
      if (session?.version !== 1 || typeof session.twinName === 'undefined') return null;
      return session;
    } catch { return null; }
  }
  function writeSession(session) {
    fs.mkdirSync(stateDir, { recursive: true });
    writeAtomic(sessionPath, Buffer.from(JSON.stringify(session, null, 2) + '\n', 'utf8'));
  }

  function resolveEnvironment() {
    const game = getGame();
    if (game?.id !== GAME_ID) throw Error('原神防报错只能用于原神配置');
    const gameExe = path.resolve(game.gamePath || '');
    const loader = path.resolve(game.modLoaderPath || '');
    const blockers = [];
    if (!/^(YuanShen|GenshinImpact)\.exe$/i.test(path.basename(gameExe)) || !peInfo(gameExe).valid) blockers.push('请先在游戏设置中选择有效的 YuanShen.exe 或 GenshinImpact.exe');
    const root = loader ? resolveLauncherRoot(loader) : '';
    const configPath = root ? path.join(root, 'XXMI Launcher Config.json') : '';
    let config = null, bytes = null;
    if (configPath) {
      try {
        bytes = smallFile(configPath);
        config = parseConfig(bytes, configPath);
        if (!config.Importers?.GIMI?.Importer) { config = null; blockers.push('XXMI 尚未配置原神 GIMI，请先通过 XXMI 初始化'); }
      } catch (error) { blockers.push(error.message); }
    } else blockers.push('请先在游戏设置中选择 XXMI Launcher.exe');
    const gameDir = path.dirname(gameExe);
    const importer = config?.Importers?.GIMI?.Importer;
    const configuredGame = root && typeof importer?.game_folder === 'string' && importer.game_folder.trim() ? path.resolve(root, importer.game_folder) : '';
    if (config && !samePath(configuredGame, gameDir)) blockers.push('XXMI 记录的原神目录与所选游戏程序不一致，请先到兼容检查同步路径');
    const modsDir = path.resolve(game.modFolderPath || '');
    const importerDir = path.basename(modsDir).toLowerCase() === 'mods' ? path.dirname(modsDir) : '';
    return { game, gameExe, gameDir, gameExeName: path.basename(gameExe), loader, root, configPath, config, bytes, importerDir, blockers: [...new Set(blockers)] };
  }

  function snapshot() {
    const env = resolveEnvironment();
    const settings = normalizeSettings(env.game.genshinAntiError);
    const customDllPath = resolveCustomDllPath(env.game.genshinAntiError);
    const session = readSession();
    const twinPath = session?.twinName ? path.join(env.gameDir, session.twinName) : '';
    const twinReady = !!session?.twinName && (() => { try { return sha(smallFile(twinPath, 1024 * 1024 * 1024)) === session.twinSha256; } catch { return false; } })();
    const revision = sha(Buffer.from(JSON.stringify({
      paths: [env.gameExe, env.loader], settings, customDllPath,
      config: env.bytes === null ? null : sha(env.bytes),
      session: session && { twinName: session.twinName, createdAt: session.createdAt, rules: session.rules, twinReady, watcherActive: !!watcher }
    })));
    return {
      env, settings, session, revision,
      report: {
        success: true, revision, settings,
        customDllPath,
        customDllPathIsDefault: !!customDllPath && !(typeof env.game.genshinAntiError?.customDllPath === 'string' && env.game.genshinAntiError.customDllPath.trim()),
        ready: env.blockers.length === 0, blockers: env.blockers,
        elevated: isElevated(),
        environment: { gameExe: env.gameExe, gameExeName: env.gameExeName, gameDir: env.gameDir, configPath: env.configPath },
        session: session && {
          createdAt: session.createdAt, twinName: session.twinName || '', twinPath,
          twinReady, manualStart: session.applied?.importer?.game_launch === 'MANUAL',
          injectMode: ({ DIRECT: 'direct', HOOK: 'hook' })[session.applied?.importer?.xxmi_dll_inject_mode] || 'default',
          effectiveInjectMode: session.effectiveInjectMode || '',
          launcherName: session.launcher ? path.basename(session.launcher.executable) : '',
          networkBlock: (session.rules?.length || 0) > 0, rules: session.rules || [],
          originalDll: session.originalDll ? { path: session.originalDll.path, created: session.originalDll.created } : null,
          dllSwap: session.dllSwap ? { path: session.dllSwap.path, source: session.dllSwap.source } : null,
          watcherActive: !!watcher
        }
      }
    };
  }

  function plannedFields(settings, twinName, customDll) {
    const applied = { importer: {}, migoto: {} };
    if (twinName) applied.importer.process_exe_names = [twinName];
    if (settings.manualStart) applied.importer.game_launch = 'MANUAL';
    if (customDll) {
      // Substitute DLLs (e.g. the GIML custom build without CBTProc) cannot be loaded
      // through the SetWindowsHookEx path, and XXMI must not redeploy its own signed DLL.
      applied.importer.xxmi_dll_inject_mode = 'DIRECT';
      applied.migoto.unsafe_mode = true;
    } else if (settings.injectMode !== 'default') {
      applied.importer.xxmi_dll_inject_mode = settings.injectMode === 'direct' ? 'DIRECT' : 'HOOK';
    }
    return applied;
  }
  function captureFieldBefore(config, node, keys) {
    const source = node === 'migoto' ? config.Importers.GIMI.Migoto : config.Importers.GIMI.Importer;
    const before = {};
    for (const key of keys) before[key] = source && typeof source === 'object' && Object.hasOwn(source, key) ? structuredClone(source[key]) : ABSENT;
    return before;
  }
  // Swaps the importer's d3d11.dll for a locally chosen substitute.
  // Use the user's selected file or the optional private component shipped beside the executable.
  function planImporterDll(env, customDllPath, backupDir) {
    if (!env.importerDir) throw Error('外部定制组件需要有效的 GIMI Mods 目录，请先在游戏设置中配置');
    const source = path.resolve(customDllPath);
    if (!peInfo(source).valid) throw Error('定制组件不是有效的 x64 DLL，未做修改');
    const bytes = smallFile(source, 64 * 1024 * 1024);
    const target = path.join(env.importerDir, 'd3d11.dll');
    const current = smallFile(target, 64 * 1024 * 1024);
    const backup = path.join(backupDir, 'd3d11.dll.bak');
    fs.writeFileSync(backup, current, { flag: 'wx' });
    if (sha(smallFile(backup, 64 * 1024 * 1024)) !== sha(current)) throw Error('原组件备份校验失败，未替换');
    return { bytes, record: { path: target, beforeSha256: sha(current), afterSha256: sha(bytes), backup, source } };
  }
  function restoreImporterDll(record, notes) {
    try {
      const current = smallFile(record.path, 64 * 1024 * 1024);
      const currentSha = sha(current);
      if (currentSha === record.beforeSha256) return true;
      if (currentSha !== record.afterSha256) { notes.push('d3d11.dll 在会话期间被外部修改，保留现场：' + record.path); return false; }
      const backup = smallFile(record.backup, 64 * 1024 * 1024);
      if (sha(backup) !== record.beforeSha256) { notes.push('原组件备份校验失败，未还原 ' + record.path); return false; }
      writeAtomic(record.path, backup);
      return sha(smallFile(record.path, 64 * 1024 * 1024)) === record.beforeSha256;
    } catch (error) { notes.push('原组件还原失败：' + error.message); return false; }
  }
  // XXMI's d3d11.dll (3DMigoto lineage) loads the real D3D11 runtime from a local
  // "original_d3d11.dll" when one sits next to it, instead of resolving System32.
  // We rebuild that local twin from the user's own System32 file.
  function planOriginalDll(env) {
    if (!env.importerDir) throw Error('本地原版组件需要有效的 GIMI Mods 目录，请先在游戏设置中配置');
    if (!peInfo(path.join(env.importerDir, 'd3d11.dll')).valid) throw Error('GIMI 目录缺少有效的 d3d11.dll，请先通过 XXMI 修复组件');
    const source = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'd3d11.dll');
    const bytes = smallFile(source, 64 * 1024 * 1024);
    if (!peInfo(source).valid) throw Error('系统 d3d11.dll 无法读取，未部署本地原版组件');
    const target = path.join(env.importerDir, 'original_d3d11.dll');
    try {
      // An existing copy is left exactly as found: never overwrite or later delete a
      // file we did not create ourselves, even if it differs from the system runtime.
      const existing = smallFile(target, 64 * 1024 * 1024);
      return { record: { path: target, sha256: sha(existing), created: false, foreign: sha(existing) !== sha(bytes) } };
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    return { bytes, record: { path: target, sha256: sha(bytes), created: true } };
  }

  async function sessionRunning(session) {
    for (const name of [...new Set([session.twinName, session.gameExeName].filter(Boolean))]) {
      try { if (await isProcessNameRunning(name)) return true; } catch { return true; }
    }
    return false;
  }
  function removeOriginalDll(record, notes) {
    try {
      const current = smallFile(record.path, 64 * 1024 * 1024);
      if (sha(current) !== record.sha256) { notes.push('original_d3d11.dll 已被外部修改，保留现场：' + record.path); return false; }
      fs.unlinkSync(record.path);
      return true;
    } catch (error) {
      if (error.code !== 'ENOENT') { notes.push('本地原版组件未能删除：' + error.message); return false; }
      return true;
    }
  }

  async function prepareLaunch(rawSettings, { randomLauncher = false } = {}) {
    if (busy) throw Error('正在处理原神防报错，请稍候');
    busy = true;
    let launcher = null;
    try {
      const settings = normalizeSettings(rawSettings);
      const customDllPath = resolveCustomDllPath(rawSettings);
      const existing = readSession();
      if (existing) {
        if (await sessionRunning(existing)) throw Error('上一次防报错会话的游戏仍在运行，请等游戏退出后再启动，或先在游戏设置中清理');
        const cleaned = await performCleanup({ force: true, quiet: true });
        if (!cleaned.cleaned) throw Error('上一次防报错会话尚未清理完成：' + cleaned.notes.join('；'));
      }
      if (settings.customDll && !customDllPath) throw Error('已启用外部定制组件，请先在游戏设置中选择定制组件文件');
      if (!anyEnabled(settings, customDllPath) && !randomLauncher) return { prepared: false };
      if (settings.twin && settings.customDll) throw Error('外部定制组件与双生启动互斥，请只启用其中一个');
      const env = resolveEnvironment();
      if (env.blockers.length) throw Error(env.blockers[0]);
      await assertStopped(env);

      let twinName = '', twinPath = '', twinSha = '', twinDataPath = '', twinDataTarget = '';
      if (settings.twin) {
        const taken = fs.readdirSync(env.gameDir).map(name => name.toLowerCase());
        twinName = randomTwinName(taken);
        twinPath = path.join(env.gameDir, twinName);
        twinSha = sha(smallFile(env.gameExe, 1024 * 1024 * 1024));
        // The game resolves its data folder from its own executable name (<exe>_Data).
        // A renamed twin would abort with "Data folder not found" unless a matching
        // junction points back at the original data folder.
        twinDataTarget = path.join(env.gameDir, path.basename(env.gameExe, path.extname(env.gameExe)) + '_Data');
        if (!isDirectory(twinDataTarget)) throw Error('未找到游戏数据目录 ' + path.basename(twinDataTarget) + '，无法创建双生副本');
        twinDataPath = path.join(env.gameDir, path.basename(twinName, path.extname(twinName)) + '_Data');
      }

      const applied = plannedFields(settings, twinName, settings.customDll);
      const effectiveInjectMode = applied.importer.xxmi_dll_inject_mode || env.config.Importers.GIMI.Importer.xxmi_dll_inject_mode || 'HOOK';
      if (!anyEnabled(settings, customDllPath) && effectiveInjectMode !== 'HOOK') return { prepared: false };
      let loaderIni = null;
      if (randomLauncher && effectiveInjectMode === 'HOOK') {
        if (!env.importerDir) throw Error('随机名 Hook 启动需要有效的 GIMI Mods 目录');
        const iniPath = path.join(env.importerDir, 'd3dx.ini');
        const iniBytes = smallFile(iniPath);
        launcher = prepareExecutable(env.loader);
        const launcherName = path.basename(launcher.executable);
        const d3dx = structuredClone(env.config.Importers.GIMI.Importer.d3dx_ini || {});
        d3dx.core ||= {};
        d3dx.core.Loader = { ...(d3dx.core.Loader || {}), loader: launcherName };
        applied.importer.d3dx_ini = d3dx;
        loaderIni = { path: iniPath, beforeBytes: iniBytes.toString('base64'), applied: { loader: launcherName, ...(twinName ? { target: twinName } : {}) } };
      }
      const fieldBefore = {};
      for (const node of Object.keys(MANAGED_NODES)) {
        if (!Object.keys(applied[node]).length) continue;
        fieldBefore[node] = captureFieldBefore(env.config, node, MANAGED_NODES[node]);
      }
      for (const [node, values] of Object.entries(applied)) {
        if (node === 'migoto' && !env.config.Importers.GIMI.Migoto) env.config.Importers.GIMI.Migoto = {};
        const target = node === 'migoto' ? env.config.Importers.GIMI.Migoto : env.config.Importers.GIMI.Importer;
        for (const [key, value] of Object.entries(values)) target[key] = value;
      }
      const bom = env.bytes.subarray(0, 3).equals(Buffer.from([239, 187, 191])) ? '\ufeff' : '';
      const nextBytes = Buffer.from(bom + JSON.stringify(env.config, null, 4) + '\n', 'utf8');

      const id = crypto.randomUUID();
      const sessionBackupDir = path.join(backupRoot, id);
      fs.mkdirSync(sessionBackupDir, { recursive: true });
      fs.writeFileSync(path.join(sessionBackupDir, 'config.bak'), env.bytes, { flag: 'wx' });
      const dllPlan = settings.customDll ? planImporterDll(env, customDllPath, sessionBackupDir) : null;
      const originalPlan = settings.originalDll ? planOriginalDll(env) : null;
      const session = {
        version: 1, id, createdAt: new Date().toISOString(),
        gameExe: env.gameExe, gameDir: env.gameDir, gameExeName: env.gameExeName,
        twinName, twinPath, twinSha256: twinSha, twinDataPath, twinDataTarget,
        originalDll: originalPlan?.record || null, dllSwap: dllPlan?.record || null,
        launcher, loaderIni, effectiveInjectMode,
        configPath: env.configPath, configBeforeHash: sha(env.bytes), configAfterHash: sha(nextBytes),
        configBeforeBytes: env.bytes.toString('base64'),
        fieldBefore, applied, rules: []
      };

      // Persist recovery information before the first change outside our backup directory.
      writeSession(session);
      try {
        if (twinPath) {
          fs.copyFileSync(env.gameExe, twinPath, fs.constants.COPYFILE_EXCL);
          if (sha(smallFile(twinPath, 1024 * 1024 * 1024)) !== twinSha) throw Error('游戏副本校验失败，未继续启动');
        }
        if (twinDataPath) {
          // Directory junctions need no elevation and make <twin>_Data resolve to the original data folder.
          fs.symlinkSync(twinDataTarget, twinDataPath, 'junction');
          if (!isDirectory(twinDataPath)) throw Error('游戏数据联接创建失败，未继续启动');
        }
        if (sha(smallFile(env.configPath)) !== session.configBeforeHash) throw Error('XXMI 配置已变化，请重新启动');
        writeAtomic(env.configPath, nextBytes);
        if (sha(smallFile(env.configPath)) !== session.configAfterHash) throw Error('XXMI 配置写入校验失败');
        if (dllPlan) {
          if (sha(smallFile(session.dllSwap.path, 64 * 1024 * 1024)) !== session.dllSwap.beforeSha256) throw Error('GIMI 组件已变化，未替换');
          writeAtomic(session.dllSwap.path, dllPlan.bytes);
          if (sha(smallFile(session.dllSwap.path, 64 * 1024 * 1024)) !== session.dllSwap.afterSha256) throw Error('定制组件替换校验失败');
        }
        if (originalPlan?.record.created) {
          fs.writeFileSync(session.originalDll.path, originalPlan.bytes, { flag: 'wx' });
          if (sha(smallFile(session.originalDll.path, 64 * 1024 * 1024)) !== session.originalDll.sha256) throw Error('本地原版组件复制校验失败');
        }
        if (settings.networkBlock) {
          for (const executable of [...new Set([twinPath, env.gameExe].filter(Boolean))]) {
            const rule = { name: firewallRuleName(executable), program: executable };
            session.rules.push(rule);
            writeSession(session);
            const result = await runNetsh(['advfirewall', 'firewall', 'add', 'rule', 'name=' + rule.name,
              'dir=out', 'action=block', 'program=' + executable, 'enable=yes', 'profile=any']);
            if (!result.ok) throw Error('添加防火墙规则失败（需要管理员权限）：' + (result.error || rule.name));
          }
        }
      } catch (error) {
        const { notes } = await performCleanup({ force: true, quiet: true });
        throw Error(error.message + (notes.length ? '；' + notes.join('；') : ''));
      }
      const notices = [];
      if (settings.manualStart) notices.push('XXMI 将等待你手动启动游戏：注入准备完成后请自行启动' + (twinName ? `随机名副本 ${twinName}` : env.gameExeName) + '。');
      if (settings.networkBlock) notices.push('网络屏蔽已开启：游戏退出前将无法联网（包括登录）。');
      if (session.originalDll?.foreign) notices.push('GIMI 目录已有 original_d3d11.dll，沿用现有文件，未覆盖。');
      if (session.dllSwap) notices.push('已替换 GIMI 图形组件为外部定制文件（注入方式自动切换为 Direct），游戏退出后还原。');
      return { prepared: true, twinName, gameExeName: env.gameExeName, launcherPath: launcher?.executable || '', rules: session.rules, notice: notices.join('') };
    } catch (error) {
      if (launcher) releaseExecutable(launcher.executable, launcher.source);
      throw error;
    } finally { busy = false; }
  }

  async function cleanup({ force = false, quiet = false } = {}) {
    if (busy) return { success: true, cleaned: false, notes: ['正在处理原神防报错，请稍候'] };
    busy = true;
    try { return await performCleanup({ force, quiet }); }
    finally { busy = false; }
  }
  async function performCleanup({ force = false, quiet = false } = {}) {
    const session = readSession();
    if (!session) return { success: true, cleaned: true, notes: [] };
    const notes = [];
    const gameDir = session.gameDir;
    const twinPath = session.twinName && gameDir ? path.join(gameDir, session.twinName) : '';
    if (!force && await sessionRunning(session)) return { success: true, cleaned: false, running: true, notes: ['游戏仍在运行，结束后会自动清理'] };
    stopWatcher();

    let twinRemoved = true;
    if (session.twinName && !twinPath) { twinRemoved = false; notes.push('会话缺少游戏目录信息，未能删除随机名副本 ' + session.twinName); }
    if (twinPath && fs.existsSync(twinPath)) {
      try { fs.unlinkSync(twinPath); } catch { twinRemoved = false; notes.push('随机名副本仍在使用，未能删除：' + twinPath); }
    }
    if (session.twinDataPath) {
      try {
        // Inspect the link itself: existsSync follows its target and misses dangling junctions.
        const link = fs.lstatSync(session.twinDataPath, { throwIfNoEntry: false });
        if (link) {
          // rmdir on a junction deletes the link, never its target.
          if (!link.isSymbolicLink() || !session.twinDataTarget || !samePath(fs.readlinkSync(session.twinDataPath), session.twinDataTarget)) {
            twinRemoved = false; notes.push('数据联接已被外部修改，保留现场：' + session.twinDataPath);
          } else fs.rmdirSync(session.twinDataPath);
        }
      } catch (error) { twinRemoved = false; notes.push('数据联接未能删除：' + error.message); }
    }
    let dllRemoved = true;
    if (session.originalDll?.created) dllRemoved = removeOriginalDll(session.originalDll, notes);
    if (session.dllSwap) dllRemoved = restoreImporterDll(session.dllSwap, notes) && dllRemoved;
    const remainingRules = [];
    for (const rule of session.rules || []) {
      let removed = false;
      try {
        removed = (await runNetsh(['advfirewall', 'firewall', 'delete', 'rule', 'name=' + rule.name])).ok;
        // A crash can leave a journaled add unexecuted, or a completed delete unrecorded.
        if (!removed) removed = await isFirewallRulePresent(rule.name) === false;
      } catch {}
      if (!removed) {
        remainingRules.push(rule);
        notes.push('防火墙规则 ' + rule.name + ' 未能移除，请手动检查');
      }
    }
    session.rules = remainingRules;
    let configRestored = true;
    try {
      const current = smallFile(session.configPath);
      const currentHash = sha(current);
      if (currentHash === session.configAfterHash) {
        writeAtomic(session.configPath, Buffer.from(session.configBeforeBytes, 'base64'));
      } else if (currentHash !== session.configBeforeHash) {
        const config = parseConfig(current, session.configPath);
        if (!config.Importers?.GIMI?.Importer) { configRestored = false; notes.push('XXMI 配置结构已变化，防报错字段未还原，请手动核对'); }
        else {
          let touched = false;
          for (const [node, values] of Object.entries(session.applied || {})) {
            const target = node === 'migoto' ? config.Importers.GIMI.Migoto : config.Importers.GIMI.Importer;
            if (!target || typeof target !== 'object') continue;
            for (const [key, applied] of Object.entries(values)) {
              if (node === 'importer' && key === 'd3dx_ini' && JSON.stringify(target[key]) !== JSON.stringify(applied)) {
                touched = restoreLoaderConfig(target, applied, session.fieldBefore?.importer?.d3dx_ini) || touched;
                continue;
              }
              if (JSON.stringify(target[key]) === JSON.stringify(applied)) {
                const before = session.fieldBefore?.[node]?.[key];
                if (before === ABSENT || before === undefined) { if (Object.hasOwn(target, key)) { delete target[key]; touched = true; } }
                else if (JSON.stringify(target[key]) !== JSON.stringify(before)) { target[key] = before; touched = true; }
              }
            }
          }
          if (touched) writeAtomic(session.configPath, Buffer.from(JSON.stringify(config, null, 4) + '\n', 'utf8'));
        }
      }
    } catch (error) { configRestored = false; notes.push('XXMI 配置还原失败：' + error.message); }
    if (session.loaderIni) configRestored = restoreLoaderIni(session.loaderIni, notes) && configRestored;
    // Running launcher copies are left to the existing random-executable cleanup.
    if (session.launcher) releaseExecutable(session.launcher.executable, session.launcher.source);
    let cleaned = twinRemoved && dllRemoved && configRestored && remainingRules.length === 0;
    try {
      if (cleaned) fs.unlinkSync(sessionPath);
      else writeSession(session);
    } catch (error) { cleaned = false; notes.push('防报错恢复记录更新失败：' + error.message); }
    if (!quiet && notes.length) notes.push('未完成的部分会在下次启动 QAQ 时再次尝试清理');
    return { success: true, cleaned, notes };
  }

  function stopWatcher() {
    if (!watcher) return;
    watcher.stopped = true;
    if (watcher.timer) clearTimeout(watcher.timer);
    watcher = null;
  }
  function watchGameExit(prep) {
    stopWatcher();
    const state = { stopped: false, timer: null, seen: false };
    watcher = state;
    const poll = async () => {
      if (state.stopped) return;
      let running = false;
      try { running = await isProcessNameRunning(prep.twinName || prep.gameExeName); } catch { running = state.seen; }
      if (state.stopped) return;
      if (!running && state.seen) { watcher = null; await cleanup({ force: false }); return; }
      if (running) state.seen = true;
      state.timer = setTimeout(poll, 5000);
      state.timer.unref?.();
    };
    state.timer = setTimeout(poll, 10000);
    state.timer.unref?.();
  }
  async function recoverOrphan() {
    const session = readSession();
    if (!session) return;
    let watcherActive = false;
    try { watcherActive = !!snapshot().report.session?.watcherActive; } catch { watcherActive = false; }
    if (watcherActive) return;
    if (await sessionRunning(session)) watchGameExit({ twinName: session.twinName || '', gameExeName: session.gameExeName });
    else await cleanup({ force: false, quiet: true });
  }
  return { get: () => snapshot().report, normalizeSettings, prepareLaunch, cleanup, watchGameExit, recoverOrphan, stopWatcher };
}
module.exports = { GAME_ID, TWIN_EXE, ABSENT, MANAGED_NODES, normalizeSettings, anyEnabled, randomTwinName, firewallRuleName, createGenshinAntiCrashService };
