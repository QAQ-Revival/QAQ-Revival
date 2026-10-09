const fs = require('node:fs');
const path = require('node:path');

function createPersistManager(api) {
  const statePattern = /^qaqm_state_.+\.ini$/i;
  const sourceCache = new Map();
  function context(gameId) {
    const game = api.getGame(gameId);
    const mods = api.getModsPath(game.id);
    // Saved data remains accessible even when a loader is temporarily missing.
    const root = mods ? path.dirname(mods) : null;
    return { game, mods, root, stateDir: root && path.join(root, 'qaqm', 'cache') };
  }
  function enabled(gameId) { return api.getConfig().persistBridgeByGame?.[gameId]?.enabled === true; }
  function files(ctx) {
    if (ctx.root && fs.existsSync(ctx.root)) api.migrateFiles(ctx.root);
    return ctx.stateDir && fs.existsSync(ctx.stateDir)
      ? fs.readdirSync(ctx.stateDir, { withFileTypes: true }).filter(e => e.isFile() && statePattern.test(e.name)).map(e => e.name) : [];
  }
  function legacyScopes(ctx) {
    return [`game:${ctx.game.id}`, ...(ctx.root ? [`root:${ctx.root.toLowerCase()}`, `mods:${ctx.mods.toLowerCase()}`] : []), ...(ctx.game.id === 'endfield' ? ['__default__'] : [])];
  }
  function legacyRecord(gameId, key) {
    for (const scope of legacyScopes(context(gameId))) {
      const record = api.getLegacy().scopes?.[scope]?.[key];
      if (record) return record;
    }
    return null;
  }
  function describe(ctx, ini) {
    return api.describeSource?.(ctx.game.id, ctx.mods, ini) || {};
  }
  function sourceIndex(ctx, names, modDir, refresh) {
    const cacheKey = `${ctx.game.id}|${ctx.mods}`;
    const cached = sourceCache.get(cacheKey);
    if (!modDir && !refresh && cached && Date.now() - cached.at < 30000 && cached.names === names.join('|')) return cached.sources;
    const sources = new Map();
    const add = (name, ini) => {
      if (!sources.has(name)) sources.set(name, []);
      if (!sources.get(name).includes(ini)) sources.get(name).push(ini);
    };
    const directory = modDir || ctx.mods;
    if (directory && fs.existsSync(directory)) {
      const iniFiles = api.getIniFiles(directory);
      // Normal bridge IDs are derived from paths; there is no need to read every
      // Mod INI (or stat every texture) to build the navigation hierarchy.
      for (const ini of iniFiles) {
        const descriptor = api.descriptor(ctx.mods, ini);
        add(descriptor.stateFileName, ini);
      }
      const unresolved = new Set(names.filter(name => !sources.has(name)));
      if (unresolved.size) for (const ini of iniFiles) {
        for (const name of api.hostedFiles(fs.readFileSync(ini, 'utf8'))) {
          if (unresolved.has(name)) add(name, ini);
        }
      }
    }
    if (!modDir) sourceCache.set(cacheKey, { at: Date.now(), names: names.join('|'), sources });
    return sources;
  }
  function readEntries(ctx, { metadataOnly = false, ids, modDir, characterName, modName, refresh = false } = {}) {
    const names = files(ctx);
    const sources = sourceIndex(ctx, names, modDir, refresh);
    const entries = names.filter(name => (!modDir || sources.has(name)) && (!ids || ids.includes(`bridge:${name}`))).map(name => {
      const file = path.join(ctx.stateDir, name);
      const content = metadataOnly ? '' : fs.readFileSync(file, 'utf8');
      const namespace = content.match(/^\s*namespace\s*=\s*(.+?)\s*$/im)?.[1] || '';
      const sourceFiles = sources.get(name) || [];
      const relativePaths = sourceFiles.map(ini => path.relative(ctx.mods, ini));
      const variables = api.parseDeclarations(content).map(value => ({ name: value.variableName, value: value.defaultValue }));
      const owner = sourceFiles[0] ? describe(ctx, sourceFiles[0]) : {};
      return { id: `bridge:${name}`, kind: 'bridge', name, title: relativePaths[0]?.replace(/(^|[\\/])DISABLED_/gi, '$1') || name,
        characterName: owner.characterName || '', modName: owner.modName || '', iniPath: owner.iniPath || name, modExists: !!owner.modName,
        active: relativePaths.some(relative => !relative.split(/[\\/]/).some(part => /^DISABLED_/i.test(part))),
        variables, namespace, sourceFiles, modifiedAt: metadataOnly ? null : fs.statSync(file).mtime.toISOString() };
    });
    for (const scope of legacyScopes(ctx)) {
      for (const [key, record] of Object.entries(api.getLegacy().scopes?.[scope] || {})) {
        const id = `legacy:${JSON.stringify([scope, key])}`;
        const [storedCharacter, ...parts] = key.split('/'), storedMod = parts.join('/');
        const displayCharacter = api.characterName?.(ctx.game.id, storedCharacter) || storedCharacter;
        if ((ids && !ids.includes(id)) || (characterName && displayCharacter !== characterName) || (modName && storedMod !== modName)) continue;
        const variables = metadataOnly ? [] : (record.files || []).flatMap(file => Object.entries(file.variables || {}).map(([name, value]) => ({ name: `${file.relativeIniPath || ''} / ${name}`, value: String(value) })));
        const resolved = api.resolveMod?.(ctx.game.id, displayCharacter, storedMod);
        entries.push({ id, kind: 'legacy', title: key, scope, key,
          characterName: displayCharacter, modName: storedMod, iniPath: '旧版状态', modExists: !!resolved?.modPath,
          variables, active: false, modifiedAt: record.updatedAt || record.savedAt || record.lastRestoredAt || null, bytes: Buffer.byteLength(JSON.stringify(record)) });
      }
    }
    return entries.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'));
  }
  function listGames() {
    return api.getConfig().games.map(game => {
      const ctx = context(game.id);
      const count = files(ctx).length + legacyScopes(ctx).reduce((sum, scope) => sum + Object.keys(api.getLegacy().scopes?.[scope] || {}).length, 0);
      return { id: game.id, name: game.name, enabled: enabled(game.id), count, configured: !!ctx.mods };
    });
  }
  function list(gameId, options = {}) {
    const ctx = context(gameId);
    return { success: true, game: { id: ctx.game.id, name: ctx.game.name, enabled: enabled(ctx.game.id), configured: !!ctx.mods },
      entries: readEntries(ctx, options).map(({ sourceFiles, scope, key, ...entry }) => entry) };
  }
  function mod(gameId, characterName, modName) {
    const ctx = context(gameId);
    const resolved = api.resolveMod(ctx.game.id, characterName, modName);
    // Missing Mods may still have legacy saves; no fallback to a full game scan.
    return { ...list(ctx.game.id, { modDir: resolved?.modPath || path.join(ctx.mods || '.', '.qaqm-missing-mod'), characterName, modName }),
      modExists: !!resolved?.modPath, characterName, modName };
  }
  function setEnabled(gameId, value) {
    if (typeof value !== 'boolean') throw Error('启用状态必须是布尔值');
    const ctx = context(gameId), config = api.getConfig();
    const previous = config.persistBridgeByGame[ctx.game.id];
    if (previous?.enabled === value) return;
    if (!value && ctx.mods && fs.existsSync(ctx.mods)) api.sync(ctx.mods, ctx.game.id);
    config.persistBridgeByGame[ctx.game.id] = { enabled: value };
    if (!api.saveConfig(config)) {
      config.persistBridgeByGame[ctx.game.id] = previous;
      throw Error('设置保存失败，请检查磁盘空间和写入权限');
    }
    if (ctx.root) {
      api.invalidate(ctx.root);
      if (!value) {
        if (ctx.mods && fs.existsSync(ctx.mods)) api.restoreBackups(ctx.mods);
        const include = path.join(ctx.root, 'qaqm', 'qaqm_persist_active.ini');
        if (fs.existsSync(include)) fs.writeFileSync(include, '', 'utf8');
      }
    }
  }
  function remove(gameId, ids) {
    const ctx = context(gameId), entries = readEntries(ctx);
    if (ids !== undefined && (!Array.isArray(ids) || !ids.length || ids.some(id => typeof id !== 'string' || !entries.some(entry => entry.id === id)))) {
      throw Error('保存项不存在，请刷新后重试');
    }
    const selected = ids === undefined ? entries : entries.filter(entry => ids.includes(entry.id));
    if (!selected.length) return { success: true, deletedCount: 0 };
    const stamp = `${Date.now()}-${require('node:crypto').randomBytes(4).toString('hex')}`;
    const backup = path.join(api.userData, 'persist-state-backups', stamp);
    fs.mkdirSync(backup, { recursive: true });
    // Complete recovery copies before touching any original file.
    fs.writeFileSync(path.join(backup, 'entries.json'), JSON.stringify(selected, null, 2));
    fs.writeFileSync(path.join(backup, 'legacy.json'), JSON.stringify(api.getLegacy(), null, 2));
    fs.writeFileSync(path.join(backup, 'tracking.json'), JSON.stringify(api.getConfig().persistBridgeTracking || {}, null, 2));
    const bridgeEntries = selected.filter(entry => entry.kind === 'bridge');
    const iniFiles = [...new Set(bridgeEntries.flatMap(entry => entry.sourceFiles))];
    for (const entry of bridgeEntries) fs.copyFileSync(path.join(ctx.stateDir, entry.name), path.join(backup, entry.name));
    for (let i = 0; i < iniFiles.length; i++) fs.copyFileSync(iniFiles[i], path.join(backup, `source-${i}.ini`));
    const userIni = ctx.root && path.join(ctx.root, 'd3dx_user.ini');
    const constants = userIni && fs.existsSync(userIni) ? api.readConstants(userIni) : null;
    if (constants) fs.copyFileSync(userIni, path.join(backup, 'd3dx_user.ini'));
    // Remove only the selected namespaces; otherwise a restart resurrects deleted values.
    if (constants) {
      const prefixes = bridgeEntries.filter(entry => entry.namespace).map(entry => `$\\${entry.namespace}\\`.toLowerCase());
      for (const key of constants.constantsMap.keys()) if (prefixes.some(prefix => key.startsWith(prefix))) constants.constantsMap.delete(key);
      api.writeConstants(userIni, constants.constantsMap, constants.prefixLines, constants.suffixLines);
    }
    // Restore source declarations so no dangling hosted-variable references are left.
    for (const ini of iniFiles) if (fs.existsSync(ini + '.qaqm-persistbak')) fs.copyFileSync(ini + '.qaqm-persistbak', ini);
    for (const entry of bridgeEntries) fs.unlinkSync(path.join(ctx.stateDir, entry.name));
    const legacyEntries = selected.filter(entry => entry.kind === 'legacy');
    for (const entry of legacyEntries) delete api.getLegacy().scopes[entry.scope][entry.key];
    if (legacyEntries.length) api.saveLegacy();
    if (ctx.root) {
      api.removeTracking(ctx.root, bridgeEntries.map(entry => entry.name));
      api.invalidate(ctx.root);
    }
    sourceCache.clear();
    return { success: true, deletedCount: selected.length, restartRequired: true };
  }
  return { listGames, list, mod, setEnabled, remove, legacyRecord };
}

module.exports = { createPersistManager };
