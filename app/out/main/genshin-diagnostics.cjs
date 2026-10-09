const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { writeJsonFileSync, readJsonFileSync } = require('./json-store.cjs');

const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const absolute = value => typeof value === 'string' && path.isAbsolute(value) ? path.resolve(value) : '';
function samePath(a, b) {
  const key = value => {
    if (!value) return '';
    try { value = fs.realpathSync(value); } catch { value = path.resolve(value); }
    return process.platform === 'win32' ? value.toLowerCase() : value;
  };
  return !!a && !!b && key(a) === key(b);
}
function isDirectory(file) { try { return !!file && fs.statSync(file).isDirectory(); } catch { return false; } }
function smallFile(file, limit = 2 * 1024 * 1024) {
  const stat = fs.statSync(file);
  if (!stat.isFile() || stat.size > limit) throw Error('文件类型或大小不受支持');
  return fs.readFileSync(file);
}
function peInfo(file) {
  let fd;
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile() || stat.size < 64) return { valid: false, reason: '文件不存在、为空或不是有效程序' };
    fd = fs.openSync(file, 'r');
    const dos = Buffer.alloc(64); fs.readSync(fd, dos, 0, dos.length, 0);
    const offset = dos.readUInt32LE(60);
    if (dos.toString('ascii', 0, 2) !== 'MZ' || offset > stat.size - 24) return { valid: false, reason: '无法识别 Windows 程序头' };
    const header = Buffer.alloc(24); fs.readSync(fd, header, 0, header.length, offset);
    const sections = header.readUInt16LE(6), optionalSize = header.readUInt16LE(20);
    if (header.toString('ascii', 0, 4) !== 'PE\0\0' || !sections || sections > 96 || optionalSize < 2 || optionalSize > 4096 || offset + 24 + optionalSize + sections * 40 > stat.size) return { valid: false, reason: '程序结构不完整' };
    const optional = Buffer.alloc(2); fs.readSync(fd, optional, 0, 2, offset + 24);
    const x64 = header.readUInt16LE(4) === 0x8664 && optional.readUInt16LE(0) === 0x20b;
    const table = Buffer.alloc(sections * 40); fs.readSync(fd, table, 0, table.length, offset + 24 + optionalSize);
    for (let i = 0; i < sections; i++) if (table.readUInt32LE(i * 40 + 20) + table.readUInt32LE(i * 40 + 16) > stat.size) return { valid: false, reason: '程序数据段被截断' };
    return { valid: x64, reason: x64 ? '文件可读取，x64 程序结构正常' : '文件架构不是 x64', size: stat.size };
  } catch { return { valid: false, reason: '文件缺失或无法读取' }; }
  finally { if (fd !== undefined) fs.closeSync(fd); }
}
function readLogHints(file, scoped) {
  let fd;
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile()) return null;
    const length = Math.min(stat.size, 256 * 1024), start = stat.size - length;
    fd = fs.openSync(file, 'r'); const bytes = Buffer.alloc(length); fs.readSync(fd, bytes, 0, length, start);
    const lines = bytes.toString('utf8').split(/\r?\n/).slice(start ? 1 : 0);
    const rules = [
      ['game-code', /\b(?:10612(?:[-\s]+4001)?|15[-\s]+4001)\b/i, '历史日志包含游戏错误码', '先用官方启动器验证基础游戏能否正常运行，再按官方错误提示排查。'],
      ['missing-file', /not found|no such file|file.*missing|找不到|不存在/i, '历史日志包含文件或路径缺失', '核对本页路径及组件检查结果。'],
      ['access', /access.*denied|permission.*denied|拒绝访问|权限不足/i, '历史日志包含权限错误', '核对安装目录权限和系统拦截记录。'],
      ['library', /(?:failed|error|无法|失败).*(?:dll|library|component)|(?:dll|library).*(?:failed|error|失败)/i, '历史日志包含组件加载错误', '使用 XXMI 自带的组件更新或修复功能核对 GIMI。']
    ];
    const counts = new Map();
    for (const line of lines) {
      // XXMI's shared log includes other games. Only attribute explicitly Genshin-tagged lines.
      if (!scoped && !/GIMI|GenshinImpact|YuanShen|原神|10612|15[-\s]*4001/i.test(line)) continue;
      for (const [id, pattern, title, advice] of rules) if (pattern.test(line)) {
        const previous = counts.get(id); counts.set(id, { id, title, advice, count: (previous?.count || 0) + 1 });
      }
    }
    return { name: path.basename(file), modifiedAt: stat.mtime.toISOString(), tailOnly: stat.size > length, hints: [...counts.values()] };
  } catch { return null; }
  finally { if (fd !== undefined) fs.closeSync(fd); }
}
function createGenshinDiagnostics({ getGame, resolveLauncherRoot, tokenizeArgs, backupDir, assertStopped = async () => {} }) {
  const latestPath = path.join(backupDir, 'latest.json');
  let busy = false;
  function snapshot(includeLogs = true) {
    const game = getGame();
    if (game?.id !== 'genshin-impact') throw Error('原神检查只能用于原神配置');
    const checks = [], repairs = [], stamps = [];
    const check = (id, title, level, message, file = '') => checks.push({ id, title, level, message, path: file });
    const stamp = file => { try { const stat = fs.statSync(file); stamps.push([file, stat.size, stat.mtimeMs]); } catch { stamps.push([file, null]); } };
    const gameExe = absolute(game.gamePath), loader = absolute(game.modLoaderPath), mods = absolute(game.modFolderPath);
    const root = loader ? resolveLauncherRoot(loader) : '';
    const configPath = root ? path.join(root, 'XXMI Launcher Config.json') : '';
    const gameDir = gameExe ? path.dirname(gameExe) : '';
    const gameInfo = peInfo(gameExe), loaderInfo = peInfo(loader);
    const validGame = /^(YuanShen|GenshinImpact)\.exe$/i.test(path.basename(gameExe)) && gameInfo.valid;
    check('game', '原神程序', validGame ? 'ok' : 'error', validGame ? gameInfo.reason : '请选择有效的 YuanShen.exe 或 GenshinImpact.exe（Windows x64）。', gameExe);
    check('launcher', 'XXMI 启动器', root && loaderInfo.valid ? 'ok' : 'error', root && loaderInfo.valid ? loaderInfo.reason : '请选择安装目录 Resources/Bin 下完整的 XXMI Launcher.exe。', loader);
    const validMods = isDirectory(mods) && path.basename(mods).toLowerCase() === 'mods';
    check('mods', 'Mods 目录', validMods ? 'ok' : 'error', validMods ? '所选 Mods 目录存在' : '请选择原神 GIMI 对应的 Mods 文件夹。', mods);
    let config = null, bytes = null, configMessage = '未找到 XXMI 配置，请先在 XXMI 中初始化原神 GIMI。';
    if (configPath) {
      try {
        bytes = smallFile(configPath); config = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
        if (!object(config) || !object(config.Importers?.GIMI?.Importer)) { config = null; configMessage = 'XXMI 尚未配置原神 GIMI，请先通过 XXMI 初始化。'; }
      } catch { config = null; configMessage = 'XXMI 配置缺失、不可读取或格式无效，原文件保持不变。'; }
    }
    check('config', 'XXMI 原神配置', config ? 'ok' : 'error', config ? '已读取 GIMI 配置' : configMessage, configPath);
    const importer = config?.Importers.GIMI.Importer;
    const configuredImporter = root && typeof importer?.importer_folder === 'string' && importer.importer_folder.trim() ? path.resolve(root, importer.importer_folder) : '';
    const configuredGame = root && typeof importer?.game_folder === 'string' && importer.game_folder.trim() ? path.resolve(root, importer.game_folder) : '';
    const selectedImporter = validMods ? path.dirname(mods) : '';
    const importerRoot = configuredImporter || selectedImporter;
    const textComponent = file => { try { return smallFile(file).length > 0; } catch { return false; } };
    const selectedReady = !!selectedImporter && textComponent(path.join(selectedImporter, 'd3dx.ini')) && textComponent(path.join(selectedImporter, 'Core/GIMI/main.ini')) && peInfo(path.join(selectedImporter, 'd3d11.dll')).valid;
    if (config && validMods) {
      const match = !!configuredImporter && samePath(path.join(configuredImporter, 'Mods'), mods);
      check('importer-path', 'GIMI 与 Mods 路径', match ? 'ok' : 'error', match ? 'XXMI 与 QAQ 使用同一套 GIMI Mods' : 'XXMI 的 GIMI 路径与 QAQ 选择的 Mods 不一致。', configuredImporter);
      if (!match && selectedReady) repairs.push({ id: 'importer-folder', field: 'importer_folder', title: '同步 GIMI 目录', before: configuredImporter || '未设置', after: selectedImporter });
    }
    if (config && validGame) {
      const match = samePath(configuredGame, gameDir);
      check('game-path', '原神目录一致性', match ? 'ok' : 'error', match ? 'XXMI 与 QAQ 指向同一游戏目录' : 'XXMI 的原神目录与 QAQ 选择的游戏程序不一致。', configuredGame);
      if (!match) repairs.push({ id: 'game-folder', field: 'game_folder', title: '同步原神目录', before: configuredGame || '未设置', after: gameDir });
    }
    if (importerRoot) {
      for (const [id, title, relative] of [['ini', 'GIMI 主配置', 'd3dx.ini'], ['core', 'GIMI 核心配置', 'Core/GIMI/main.ini']]) {
        const file = path.join(importerRoot, relative); const exists = textComponent(file); stamp(file);
        check(id, title, exists ? 'ok' : 'error', exists ? '配置文件存在且可读取' : '组件缺失或为空，请通过 XXMI 修复 GIMI。', file);
      }
      const dll = path.join(importerRoot, 'd3d11.dll'), info = peInfo(dll); stamp(dll);
      check('dll', 'GIMI 图形组件', info.valid ? 'ok' : 'error', info.valid ? 'x64 PE 结构正常；此项不代表已验证发行签名或游戏版本兼容性。' : info.reason + '，请通过 XXMI 核对或更新 GIMI 组件。', dll);
    } else check('gimi', 'GIMI 组件目录', 'error', '尚无可检查的 GIMI 目录，请先配置原神加载组件。');
    const args = tokenizeArgs(String(game.launchArgs || ''));
    const importerChoices = args.flatMap((arg, index) => /^(?:--xxmi|-x)$/i.test(arg) ? [args[index + 1] || ''] : /^--xxmi=/i.test(arg) ? [arg.slice(7)] : /^-x.+/i.test(arg) ? [arg.slice(2)] : []);
    const overrides = importerChoices.some(value => value.toUpperCase() !== 'GIMI');
    check('args', 'QAQ 启动附加参数', overrides ? 'error' : importerChoices.length ? 'warning' : 'ok', overrides ? '附加参数指定了其他导入器或缺少值，可能覆盖原神的 GIMI。请在下方移除 --xxmi / -x 及对应值。' : importerChoices.length ? '重复指定了 GIMI，通常可移除此附加参数。' : '没有发现会覆盖 GIMI 选择的附加参数');
    const rendererArgs = [...args, ...tokenizeArgs(String(importer?.launch_options || ''))];
    if (rendererArgs.some(arg => /^(?:-force-d3d12|-dx12|--dx12|-d3d12|-vulkan|-force-vulkan)$/i.test(arg))) check('graphics-args', '图形接口参数', 'warning', '发现 DX12 / Vulkan 参数。请核对 GIMI 所需的 DX11 环境，并在对应启动器中确认参数用途。');
    if (validGame) for (const name of ['d3d11.dll', 'dxgi.dll', 'dinput8.dll']) {
      const file = path.join(gameDir, name);
      if (fs.existsSync(file)) check('extra-' + name, '游戏目录中的 ' + name, 'warning', '存在额外组件，可能属于 ReShade、图形转换层或其他工具。仅提示人工核对，不会删除或替换。', file);
    }
    if (importer?.configure_game === false) check('graphics-config', '游戏画面配置', 'info', 'XXMI 自动配置游戏已关闭。请在原神图形设置中确认“动态角色分辨率”为关闭。');
    [gameExe, loader, mods, selectedImporter && path.join(selectedImporter, 'd3dx.ini'), selectedImporter && path.join(selectedImporter, 'Core/GIMI/main.ini'), selectedImporter && path.join(selectedImporter, 'd3d11.dll')].filter(Boolean).forEach(stamp);
    const revision = hash(Buffer.from(JSON.stringify({ game: [gameExe, loader, mods, game.launchArgs || ''], config: bytes && hash(bytes), stamps })));
    let record = null;
    try { record = readJsonFileSync(latestPath); } catch {}
    const canRestore = !!record && record.file === configPath && ['prepared', 'applied'].includes(record.status) && bytes && [record.after, ...(record.status === 'prepared' ? [record.before] : [])].includes(hash(bytes));
    const logs = includeLogs ? [root && readLogHints(path.join(root, 'XXMI Launcher Log.txt'), false), importerRoot && readLogHints(path.join(importerRoot, 'd3d11_log.txt'), true)].filter(Boolean) : [];
    return { game, config, bytes, configPath, gameDir, configuredGame, root, record,
      report: { success: true, checkedAt: new Date().toISOString(), revision, preflightEnabled: game.genshinPreflightEnabled === true,
        launchArgs: String(game.launchArgs || ''), checks, repairs, logs, canRestore: !!canRestore,
        summary: { errors: checks.filter(item => item.level === 'error').length, warnings: checks.filter(item => item.level === 'warning').length, passed: checks.filter(item => item.level === 'ok').length } } };
  }
  function ensureWritableTarget(file) {
    for (let current = file; path.dirname(current) !== current; current = path.dirname(current)) {
      if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw Error('配置路径包含链接，请先核对真实 XXMI 目录');
    }
  }
  function writeAtomic(file, bytes) {
    const temporary = file + '.qaq-' + crypto.randomUUID();
    try { fs.writeFileSync(temporary, bytes, { flag: 'wx' }); fs.renameSync(temporary, file); }
    finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  }
  async function mutate(revision, action) {
    if (busy) throw Error('正在处理原神配置，请稍候');
    busy = true;
    try {
      const s = snapshot(false);
      if (!revision || revision !== s.report.revision) throw Error('检查结果已过期，请重新检查');
      if (!s.config || !s.bytes) throw Error('没有可安全修改的 XXMI 原神配置');
      ensureWritableTarget(s.configPath);
      await assertStopped(s);
      if (snapshot(false).report.revision !== revision) throw Error('配置在处理期间已变化，请重新检查');
      return action(s);
    } finally { busy = false; }
  }
  function apply({ revision, ids } = {}) {
    if (!Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length || ids.some(id => !['importer-folder','game-folder'].includes(id))) return Promise.reject(Error('请选择有效的路径修复项'));
    return mutate(revision, s => {
      const selected = ids.map(id => s.report.repairs.find(item => item.id === id));
      if (selected.some(item => !item)) throw Error('可修复项目已变化，请重新检查');
      const config = structuredClone(s.config);
      for (const item of selected) config.Importers.GIMI.Importer[item.field] = item.after.split(path.sep).join('/');
      const bom = s.bytes.subarray(0, 3).equals(Buffer.from([239,187,191])) ? '\ufeff' : '';
      const next = Buffer.from(bom + JSON.stringify(config, null, 4) + '\n');
      fs.mkdirSync(backupDir, { recursive: true });
      const id = crypto.randomUUID(), backup = path.join(backupDir, id + '.bak');
      fs.writeFileSync(backup, s.bytes, { flag: 'wx' });
      if (hash(smallFile(backup)) !== hash(s.bytes)) throw Error('备份校验失败，原配置未修改');
      const record = { version: 1, id, file: s.configPath, before: hash(s.bytes), after: hash(next), status: 'prepared' };
      const previous = fs.existsSync(latestPath) ? smallFile(latestPath) : null;
      writeJsonFileSync(latestPath, record);
      try {
        writeAtomic(s.configPath, next);
        if (hash(smallFile(s.configPath)) !== record.after) throw Error('配置写入校验失败');
        record.status = 'applied'; writeJsonFileSync(latestPath, record);
      } catch (error) {
        const currentHash = hash(smallFile(s.configPath));
        if (currentHash === record.after) writeAtomic(s.configPath, s.bytes);
        else if (currentHash !== record.before) throw Error('修复时配置被外部修改，已保留现场与备份，请手动核对');
        if (previous) writeAtomic(latestPath, previous); else fs.unlinkSync(latestPath);
        throw error;
      }
      return { ...snapshot().report, pathsChanged: true, message: '已备份并同步所选路径。下次通过 XXMI 启动原神时生效。' };
    });
  }
  function restore({ revision } = {}) {
    return mutate(revision, s => {
      const record = s.record;
      if (!s.report.canRestore || !record || !/^[a-f0-9-]{36}$/.test(record.id) || record.file !== s.configPath) throw Error('没有可恢复的备份，或配置在修复后已变化');
      const bytes = smallFile(path.join(backupDir, record.id + '.bak'));
      if (hash(bytes) !== record.before) throw Error('备份校验失败，未修改当前配置');
      writeAtomic(s.configPath, bytes);
      if (hash(smallFile(s.configPath)) !== record.before) throw Error('恢复校验失败，请保留备份并重试');
      record.status = 'restored'; writeJsonFileSync(latestPath, record);
      return { ...snapshot().report, pathsChanged: true, message: '已恢复上次路径修复前的 XXMI 配置。' };
    });
  }
  function exportReport() {
    const report = snapshot().report;
    return { schemaVersion: 1, game: 'genshin-impact', checkedAt: report.checkedAt, summary: report.summary,
      checks: report.checks.map(({ id, title, level, message }) => ({ id, title, level, message })), logs: report.logs,
      scope: 'Local path, file structure and configuration checks only. No raw logs, account details or absolute paths are included.' };
  }
  return { check: options => snapshot(options?.includeLogs !== false).report, apply, restore, exportReport };
}
module.exports = { createGenshinDiagnostics, peInfo, readLogHints, samePath };
