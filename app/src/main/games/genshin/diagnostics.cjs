const i18n = require("../../../shared/i18n/core.cjs");
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {
  writeJsonFileSync,
  readJsonFileSync
} = require("../../core/json-store.cjs");
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const absolute = value => typeof value === 'string' && path.isAbsolute(value) ? path.resolve(value) : '';
function samePath(a, b) {
  const key = value => {
    if (!value) return '';
    try {
      value = fs.realpathSync(value);
    } catch {
      value = path.resolve(value);
    }
    return process.platform === 'win32' ? value.toLowerCase() : value;
  };
  return !!a && !!b && key(a) === key(b);
}
function isDirectory(file) {
  try {
    return !!file && fs.statSync(file).isDirectory();
  } catch {
    return false;
  }
}
function smallFile(file, limit = 2 * 1024 * 1024) {
  const stat = fs.statSync(file);
  if (!stat.isFile() || stat.size > limit) throw Error(i18n.t("backend.genshinAnticrash.unsupportedFile"));
  return fs.readFileSync(file);
}
function peInfo(file) {
  let fd;
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile() || stat.size < 64) return {
      valid: false,
      reason: i18n.t("backend.genshinDiagnostics.programMissing")
    };
    fd = fs.openSync(file, 'r');
    const dos = Buffer.alloc(64);
    fs.readSync(fd, dos, 0, dos.length, 0);
    const offset = dos.readUInt32LE(60);
    if (dos.toString('ascii', 0, 2) !== 'MZ' || offset > stat.size - 24) return {
      valid: false,
      reason: i18n.t("backend.genshinDiagnostics.invalidProgramHeader")
    };
    const header = Buffer.alloc(24);
    fs.readSync(fd, header, 0, header.length, offset);
    const sections = header.readUInt16LE(6),
      optionalSize = header.readUInt16LE(20);
    if (header.toString('ascii', 0, 4) !== 'PE\0\0' || !sections || sections > 96 || optionalSize < 2 || optionalSize > 4096 || offset + 24 + optionalSize + sections * 40 > stat.size) return {
      valid: false,
      reason: i18n.t("backend.genshinDiagnostics.programIncomplete")
    };
    const optional = Buffer.alloc(2);
    fs.readSync(fd, optional, 0, 2, offset + 24);
    const x64 = header.readUInt16LE(4) === 0x8664 && optional.readUInt16LE(0) === 0x20b;
    const table = Buffer.alloc(sections * 40);
    fs.readSync(fd, table, 0, table.length, offset + 24 + optionalSize);
    for (let i = 0; i < sections; i++) if (table.readUInt32LE(i * 40 + 20) + table.readUInt32LE(i * 40 + 16) > stat.size) return {
      valid: false,
      reason: i18n.t("backend.genshinDiagnostics.programDataTruncated")
    };
    return {
      valid: x64,
      reason: x64 ? i18n.t("backend.genshinDiagnostics.validX64Program") : i18n.t("backend.genshinDiagnostics.architectureMismatch"),
      size: stat.size
    };
  } catch {
    return {
      valid: false,
      reason: i18n.t("backend.genshinDiagnostics.fileUnreadable")
    };
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}
function readLogHints(file, scoped) {
  let fd;
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile()) return null;
    const length = Math.min(stat.size, 256 * 1024),
      start = stat.size - length;
    fd = fs.openSync(file, 'r');
    const bytes = Buffer.alloc(length);
    fs.readSync(fd, bytes, 0, length, start);
    const lines = bytes.toString('utf8').split(/\r?\n/).slice(start ? 1 : 0);
    const rules = [['game-code', /\b(?:10612(?:[-\s]+4001)?|15[-\s]+4001)\b/i, i18n.t("backend.genshinDiagnostics.gameErrorLogTitle"), i18n.t("backend.genshinDiagnostics.gameErrorLogAdvice")], ['missing-file', /not found|no such file|file.*missing|找不到|不存在/i, i18n.t("backend.genshinDiagnostics.missingPathLogTitle"), i18n.t("backend.genshinDiagnostics.missingPathLogAdvice")], ['access', /access.*denied|permission.*denied|拒绝访问|权限不足/i, i18n.t("backend.genshinDiagnostics.permissionLogTitle"), i18n.t("backend.genshinDiagnostics.permissionLogAdvice")], ['library', /(?:failed|error|无法|失败).*(?:dll|library|component)|(?:dll|library).*(?:failed|error|失败)/i, i18n.t("backend.genshinDiagnostics.componentLogTitle"), i18n.t("backend.genshinDiagnostics.componentLogAdvice")]];
    const counts = new Map();
    for (const line of lines) {
      // XXMI's shared log includes other games. Only attribute explicitly Genshin-tagged lines.
      if (!scoped && !/GIMI|GenshinImpact|YuanShen|原神|10612|15[-\s]*4001/i.test(line)) continue;
      for (const [id, pattern, title, advice] of rules) if (pattern.test(line)) {
        const previous = counts.get(id);
        counts.set(id, {
          id,
          title,
          advice,
          count: (previous?.count || 0) + 1
        });
      }
    }
    return {
      name: path.basename(file),
      modifiedAt: stat.mtime.toISOString(),
      tailOnly: stat.size > length,
      hints: [...counts.values()]
    };
  } catch {
    return null;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}
function createGenshinDiagnostics({
  getGame,
  resolveLauncherRoot,
  tokenizeArgs,
  backupDir,
  assertStopped = async () => {}
}) {
  const latestPath = path.join(backupDir, 'latest.json');
  let busy = false;
  function snapshot(includeLogs = true) {
    const game = getGame();
    if (game?.id !== 'genshin-impact') throw Error(i18n.t("backend.genshinDiagnostics.genshinOnly"));
    const checks = [],
      repairs = [],
      stamps = [];
    const check = (id, title, level, message, file = '') => checks.push({
      id,
      title,
      level,
      message,
      path: file
    });
    const stamp = file => {
      try {
        const stat = fs.statSync(file);
        stamps.push([file, stat.size, stat.mtimeMs]);
      } catch {
        stamps.push([file, null]);
      }
    };
    const gameExe = absolute(game.gamePath),
      loader = absolute(game.modLoaderPath),
      mods = absolute(game.modFolderPath);
    const root = loader ? resolveLauncherRoot(loader) : '';
    const configPath = root ? path.join(root, 'XXMI Launcher Config.json') : '';
    const gameDir = gameExe ? path.dirname(gameExe) : '';
    const gameInfo = peInfo(gameExe),
      loaderInfo = peInfo(loader);
    const validGame = /^(YuanShen|GenshinImpact)\.exe$/i.test(path.basename(gameExe)) && gameInfo.valid;
    check('game', i18n.t("backend.genshinDiagnostics.gameExecutableTitle"), validGame ? 'ok' : 'error', validGame ? gameInfo.reason : i18n.t("backend.genshinDiagnostics.gameExecutableAdvice"), gameExe);
    check('launcher', i18n.t("backend.genshinDiagnostics.xxmiLauncherTitle"), root && loaderInfo.valid ? 'ok' : 'error', root && loaderInfo.valid ? loaderInfo.reason : i18n.t("backend.genshinDiagnostics.xxmiLauncherAdvice"), loader);
    const validMods = isDirectory(mods) && path.basename(mods).toLowerCase() === 'mods';
    check('mods', i18n.t("backend.genshinDiagnostics.modsDirectoryTitle"), validMods ? 'ok' : 'error', validMods ? i18n.t("backend.genshinDiagnostics.modsDirectoryExists") : i18n.t("backend.genshinDiagnostics.modsDirectoryAdvice"), mods);
    let config = null,
      bytes = null,
      configMessage = i18n.t("backend.genshinDiagnostics.xxmiConfigMissing");
    if (configPath) {
      try {
        bytes = smallFile(configPath);
        config = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
        if (!object(config) || !object(config.Importers?.GIMI?.Importer)) {
          config = null;
          configMessage = i18n.t("backend.genshinDiagnostics.gimiNotInitialized");
        }
      } catch {
        config = null;
        configMessage = i18n.t("backend.genshinDiagnostics.configUnavailable");
      }
    }
    check('config', i18n.t("backend.genshinDiagnostics.gimiConfigTitle"), config ? 'ok' : 'error', config ? i18n.t("backend.genshinDiagnostics.gimiConfigRead") : configMessage, configPath);
    const importer = config?.Importers.GIMI.Importer;
    const configuredImporter = root && typeof importer?.importer_folder === 'string' && importer.importer_folder.trim() ? path.resolve(root, importer.importer_folder) : '';
    const configuredGame = root && typeof importer?.game_folder === 'string' && importer.game_folder.trim() ? path.resolve(root, importer.game_folder) : '';
    const selectedImporter = validMods ? path.dirname(mods) : '';
    const importerRoot = configuredImporter || selectedImporter;
    const textComponent = file => {
      try {
        return smallFile(file).length > 0;
      } catch {
        return false;
      }
    };
    const selectedReady = !!selectedImporter && textComponent(path.join(selectedImporter, 'd3dx.ini')) && textComponent(path.join(selectedImporter, 'Core/GIMI/main.ini')) && peInfo(path.join(selectedImporter, 'd3d11.dll')).valid;
    if (config && validMods) {
      const match = !!configuredImporter && samePath(path.join(configuredImporter, 'Mods'), mods);
      check('importer-path', i18n.t("backend.genshinDiagnostics.gimiModsPathsTitle"), match ? 'ok' : 'error', match ? i18n.t("backend.genshinDiagnostics.gimiModsPathsMatch") : i18n.t("backend.genshinDiagnostics.gimiModsPathsDiffer"), configuredImporter);
      if (!match && selectedReady) repairs.push({
        id: 'importer-folder',
        field: 'importer_folder',
        title: i18n.t("backend.genshinDiagnostics.syncGimiPath"),
        before: configuredImporter || i18n.t("backend.common.notConfigured"),
        after: selectedImporter
      });
    }
    if (config && validGame) {
      const match = samePath(configuredGame, gameDir);
      check('game-path', i18n.t("backend.genshinDiagnostics.gameDirectoryTitle"), match ? 'ok' : 'error', match ? i18n.t("backend.genshinDiagnostics.gameDirectoryMatches") : i18n.t("backend.genshinDiagnostics.gameDirectoryDiffers"), configuredGame);
      if (!match) repairs.push({
        id: 'game-folder',
        field: 'game_folder',
        title: i18n.t("backend.genshinDiagnostics.syncGamePath"),
        before: configuredGame || i18n.t("backend.common.notConfigured"),
        after: gameDir
      });
    }
    if (importerRoot) {
      for (const [id, title, relative] of [['ini', i18n.t("backend.genshinDiagnostics.mainConfig"), 'd3dx.ini'], ['core', i18n.t("backend.genshinDiagnostics.coreConfig"), 'Core/GIMI/main.ini']]) {
        const file = path.join(importerRoot, relative);
        const exists = textComponent(file);
        stamp(file);
        check(id, title, exists ? 'ok' : 'error', exists ? i18n.t("backend.genshinDiagnostics.configReadable") : i18n.t("backend.genshinDiagnostics.componentMissing"), file);
      }
      const dll = path.join(importerRoot, 'd3d11.dll'),
        info = peInfo(dll);
      stamp(dll);
      check('dll', i18n.t("backend.genshinDiagnostics.graphicsComponentTitle"), info.valid ? 'ok' : 'error', info.valid ? i18n.t("backend.genshinDiagnostics.graphicsComponentValid") : info.reason + i18n.t("backend.genshinDiagnostics.graphicsComponentAdvice"), dll);
    } else check('gimi', i18n.t("backend.genshinDiagnostics.gimiDirectoryTitle"), 'error', i18n.t("backend.genshinDiagnostics.gimiDirectoryMissing"));
    const args = tokenizeArgs(String(game.launchArgs || ''));
    const importerChoices = args.flatMap((arg, index) => /^(?:--xxmi|-x)$/i.test(arg) ? [args[index + 1] || ''] : /^--xxmi=/i.test(arg) ? [arg.slice(7)] : /^-x.+/i.test(arg) ? [arg.slice(2)] : []);
    const overrides = importerChoices.some(value => value.toUpperCase() !== 'GIMI');
    check('args', i18n.t("backend.genshinDiagnostics.launchArgsTitle"), overrides ? 'error' : importerChoices.length ? 'warning' : 'ok', overrides ? i18n.t("backend.genshinDiagnostics.conflictingLaunchArgs") : importerChoices.length ? i18n.t("backend.genshinDiagnostics.redundantLaunchArgs") : i18n.t("backend.genshinDiagnostics.launchArgsValid"));
    const rendererArgs = [...args, ...tokenizeArgs(String(importer?.launch_options || ''))];
    if (rendererArgs.some(arg => /^(?:-force-d3d12|-dx12|--dx12|-d3d12|-vulkan|-force-vulkan)$/i.test(arg))) check('graphics-args', i18n.t("backend.genshinDiagnostics.graphicsApiTitle"), 'warning', i18n.t("backend.genshinDiagnostics.graphicsApiAdvice"));
    if (validGame) for (const name of ['d3d11.dll', 'dxgi.dll', 'dinput8.dll']) {
      const file = path.join(gameDir, name);
      if (fs.existsSync(file)) check('extra-' + name, i18n.t("backend.genshinDiagnostics.extraComponentTitlePrefix") + name, 'warning', i18n.t("backend.genshinDiagnostics.extraComponentAdvice"), file);
    }
    if (importer?.configure_game === false) check('graphics-config', i18n.t("backend.genshinDiagnostics.gameGraphicsTitle"), 'info', i18n.t("backend.genshinDiagnostics.dynamicResolutionAdvice"));
    [gameExe, loader, mods, selectedImporter && path.join(selectedImporter, 'd3dx.ini'), selectedImporter && path.join(selectedImporter, 'Core/GIMI/main.ini'), selectedImporter && path.join(selectedImporter, 'd3d11.dll')].filter(Boolean).forEach(stamp);
    const revision = hash(Buffer.from(JSON.stringify({
      game: [gameExe, loader, mods, game.launchArgs || ''],
      config: bytes && hash(bytes),
      stamps
    })));
    let record = null;
    try {
      record = readJsonFileSync(latestPath);
    } catch {}
    const canRestore = !!record && record.file === configPath && ['prepared', 'applied'].includes(record.status) && bytes && [record.after, ...(record.status === 'prepared' ? [record.before] : [])].includes(hash(bytes));
    const logs = includeLogs ? [root && readLogHints(path.join(root, 'XXMI Launcher Log.txt'), false), importerRoot && readLogHints(path.join(importerRoot, 'd3d11_log.txt'), true)].filter(Boolean) : [];
    return {
      game,
      config,
      bytes,
      configPath,
      gameDir,
      configuredGame,
      root,
      record,
      report: {
        success: true,
        checkedAt: new Date().toISOString(),
        revision,
        preflightEnabled: game.genshinPreflightEnabled === true,
        launchArgs: String(game.launchArgs || ''),
        checks,
        repairs,
        logs,
        canRestore: !!canRestore,
        summary: {
          errors: checks.filter(item => item.level === 'error').length,
          warnings: checks.filter(item => item.level === 'warning').length,
          passed: checks.filter(item => item.level === 'ok').length
        }
      }
    };
  }
  function ensureWritableTarget(file) {
    for (let current = file; path.dirname(current) !== current; current = path.dirname(current)) {
      if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw Error(i18n.t("backend.genshinDiagnostics.linkedConfigPath"));
    }
  }
  function writeAtomic(file, bytes) {
    const temporary = file + '.qaq-' + crypto.randomUUID();
    try {
      fs.writeFileSync(temporary, bytes, {
        flag: 'wx'
      });
      fs.renameSync(temporary, file);
    } finally {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
  }
  async function mutate(revision, action) {
    if (busy) throw Error(i18n.t("backend.genshinDiagnostics.operationInProgress"));
    busy = true;
    try {
      const s = snapshot(false);
      if (!revision || revision !== s.report.revision) throw Error(i18n.t("backend.genshinDiagnostics.checkExpired"));
      if (!s.config || !s.bytes) throw Error(i18n.t("backend.genshinDiagnostics.noRepairableConfig"));
      ensureWritableTarget(s.configPath);
      await assertStopped(s);
      if (snapshot(false).report.revision !== revision) throw Error(i18n.t("backend.genshinDiagnostics.configChangedDuringOperation"));
      return action(s);
    } finally {
      busy = false;
    }
  }
  function apply({
    revision,
    ids
  } = {}) {
    if (!Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length || ids.some(id => !['importer-folder', 'game-folder'].includes(id))) return Promise.reject(Error(i18n.t("backend.genshinDiagnostics.invalidRepairSelection")));
    return mutate(revision, s => {
      const selected = ids.map(id => s.report.repairs.find(item => item.id === id));
      if (selected.some(item => !item)) throw Error(i18n.t("backend.genshinDiagnostics.repairSelectionChanged"));
      const config = structuredClone(s.config);
      for (const item of selected) config.Importers.GIMI.Importer[item.field] = item.after.split(path.sep).join('/');
      const bom = s.bytes.subarray(0, 3).equals(Buffer.from([239, 187, 191])) ? '\ufeff' : '';
      const next = Buffer.from(bom + JSON.stringify(config, null, 4) + '\n');
      fs.mkdirSync(backupDir, {
        recursive: true
      });
      const id = crypto.randomUUID(),
        backup = path.join(backupDir, id + '.bak');
      fs.writeFileSync(backup, s.bytes, {
        flag: 'wx'
      });
      if (hash(smallFile(backup)) !== hash(s.bytes)) throw Error(i18n.t("backend.genshinDiagnostics.backupVerificationFailed"));
      const record = {
        version: 1,
        id,
        file: s.configPath,
        before: hash(s.bytes),
        after: hash(next),
        status: 'prepared'
      };
      const previous = fs.existsSync(latestPath) ? smallFile(latestPath) : null;
      writeJsonFileSync(latestPath, record);
      try {
        writeAtomic(s.configPath, next);
        if (hash(smallFile(s.configPath)) !== record.after) throw Error(i18n.t("backend.genshinDiagnostics.writeVerificationFailed"));
        record.status = 'applied';
        writeJsonFileSync(latestPath, record);
      } catch (error) {
        const currentHash = hash(smallFile(s.configPath));
        if (currentHash === record.after) writeAtomic(s.configPath, s.bytes);else if (currentHash !== record.before) throw Error(i18n.t("backend.genshinDiagnostics.externalConfigChange"));
        if (previous) writeAtomic(latestPath, previous);else fs.unlinkSync(latestPath);
        throw error;
      }
      return {
        ...snapshot().report,
        pathsChanged: true,
        message: i18n.t("backend.genshinDiagnostics.pathsApplied")
      };
    });
  }
  function restore({
    revision
  } = {}) {
    return mutate(revision, s => {
      const record = s.record;
      if (!s.report.canRestore || !record || !/^[a-f0-9-]{36}$/.test(record.id) || record.file !== s.configPath) throw Error(i18n.t("backend.genshinDiagnostics.restoreUnavailable"));
      const bytes = smallFile(path.join(backupDir, record.id + '.bak'));
      if (hash(bytes) !== record.before) throw Error(i18n.t("backend.genshinDiagnostics.restoreBackupInvalid"));
      writeAtomic(s.configPath, bytes);
      if (hash(smallFile(s.configPath)) !== record.before) throw Error(i18n.t("backend.genshinDiagnostics.restoreVerificationFailed"));
      record.status = 'restored';
      writeJsonFileSync(latestPath, record);
      return {
        ...snapshot().report,
        pathsChanged: true,
        message: i18n.t("backend.genshinDiagnostics.pathsRestored")
      };
    });
  }
  function exportReport() {
    const report = snapshot().report;
    return {
      schemaVersion: 1,
      game: 'genshin-impact',
      checkedAt: report.checkedAt,
      summary: report.summary,
      checks: report.checks.map(({
        id,
        title,
        level,
        message
      }) => ({
        id,
        title,
        level,
        message
      })),
      logs: report.logs,
      scope: 'Local path, file structure and configuration checks only. No raw logs, account details or absolute paths are included.'
    };
  }
  return {
    check: options => snapshot(options?.includeLogs !== false).report,
    apply,
    restore,
    exportReport
  };
}
module.exports = {
  createGenshinDiagnostics,
  peInfo,
  readLogHints,
  samePath
};
