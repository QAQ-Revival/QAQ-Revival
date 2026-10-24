const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { EventEmitter } = require('node:events');

const main = path.resolve(__dirname, '../app/src/main');
const results = path.resolve(__dirname, '../test-results');
fs.mkdirSync(results, { recursive: true });

test('a duplicate launch returns before loading application or translation services', () => {
  const profile = fs.mkdtempSync(path.join(results, 'main-duplicate-'));
  const entry = path.join(main, 'index.js');
  const originalLoad = Module._load;
  const previousProfile = process.env.QAQR_USER_DATA;
  const paths = {};
  let quit = false;
  process.env.QAQR_USER_DATA = profile;
  Module._load = function (name, parent, isMain) {
    if (parent?.filename === entry) {
      if (name === 'electron') return { app: {
        setPath: (key, value) => { paths[key] = value; },
        setName() {},
        requestSingleInstanceLock() {
          assert.equal(paths.userData, profile);
          assert.equal(paths.sessionData, profile);
          return false;
        },
        quit() { quit = true; }
      } };
      assert(['path', 'fs'].includes(name), `Secondary process loaded ${name}`);
    }
    return originalLoad.call(this, name, parent, isMain);
  };
  try {
    require(entry);
    assert.equal(quit, true);
  } finally {
    Module._load = originalLoad;
    delete require.cache[entry];
    if (previousProfile === undefined) delete process.env.QAQR_USER_DATA;
    else process.env.QAQR_USER_DATA = previousProfile;
    fs.rmSync(profile, { recursive: true, force: true });
  }
});

test('application services share current settings and preserve ordinary RAR extraction', async () => {
  const profile = fs.mkdtempSync(path.join(results, 'main-services-'));
  const originalLoad = Module._load;
  const childProcess = require('node:child_process');
  const originalSpawn = childProcess.spawn;
  const handlers = new Map();
  const ipcMain = new EventEmitter();
  ipcMain.handle = (channel, handler) => {
    assert(!handlers.has(channel), `Duplicate IPC channel: ${channel}`);
    handlers.set(channel, handler);
  };
  const app = Object.assign(new EventEmitter(), {
    getPath: () => profile,
    getAppPath: () => profile,
    getVersion: () => '1.0.4',
    isPackaged: false,
    whenReady: () => new Promise(() => {}),
    commandLine: { appendSwitch() {} },
    disableHardwareAcceleration() {}
  });
  const electron = {
    app, ipcMain,
    BrowserWindow: { getAllWindows: () => [] },
    powerMonitor: new EventEmitter(),
    net: { fetch: () => { throw Error('Unexpected network request during initialization'); } },
    protocol: { registerSchemesAsPrivileged() {} },
    shell: {}, dialog: {}, session: {}, screen: {},
    globalShortcut: { unregisterAll() {} }
  };
  Module._load = function (name, parent, isMain) {
    if (name === 'electron') return electron;
    if (name === '@electron-toolkit/utils') return { is: { dev: false }, electronApp: {}, optimizer: {} };
    return originalLoad.call(this, name, parent, isMain);
  };
  try {
    for (const [relative, text] of [['arknights/Mods/MigrationConflict/mod.txt', 'legacy'], ['data/Arknights/Mods/MigrationConflict/mod.txt', 'different destination']]) {
      const file = path.join(profile, relative);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, text);
    }
    require(path.join(main, 'application.cjs')).startApplication({ name: 'QAQ-Revival' });
    const bridgeSource = fs.readFileSync(path.resolve(main, '../preload/index.js'), 'utf8');
    for (const [, channel] of bridgeSource.matchAll(/\.invoke\(["']([^"']+)["']/g)) {
      assert(handlers.has(channel), `Preload invokes an unregistered IPC channel: ${channel}`);
    }
    const invoke = (channel, payload) => {
      assert.equal(typeof handlers.get(channel), 'function', `Missing IPC channel: ${channel}`);
      return handlers.get(channel)({}, payload);
    };
    const initial = await invoke('get-config');
    assert.equal(initial.success, true);
    const arknightsState = await invoke('arknights:status');
    assert.equal(arknightsState.root, path.join(profile, 'arknights'));
    assert.match(arknightsState.migrationError, /conflicts/);
    const warning = require(path.join(main, 'games/path-warning.cjs'));
    const installRoot = path.join(profile, 'installed');
    for (const gameDirectory of ['XXMI/EFMI/Mods', 'Arknights/Mods', 'NEMI/Mods']) assert.equal(warning.isDangerousManagedPath(path.join(installRoot, 'data', gameDirectory), installRoot), false);
    assert.equal(warning.isDangerousManagedPath(path.join(installRoot, 'resources/Mods'), installRoot), true);
    assert.equal(warning.isDangerousManagedPath(path.join(installRoot, 'data-old/Mods'), installRoot), true);
    assert(initial.config.games.some(game => game.id === 'wuthering-waves'));
    // Visibility changes are atomic, retain game settings, and cannot strand selection.
    const configStore = require(path.join(main, 'config/store.cjs'));
    const originalConfig = configStore.currentConfig;
    const saveConfig = configStore.saveConfig;
    const hide = (gameId, hidden = true, nextGameId) => invoke('game:set-hidden', { gameId, hidden, nextGameId });
    assert.equal((await hide('missing-game')).success, false);
    assert.equal((await hide('endfield', 'true')).success, false);
    configStore.saveConfig = () => false;
    assert.equal((await hide('endfield')).success, false);
    assert.equal(configStore.currentConfig, originalConfig);
    configStore.saveConfig = saveConfig;
    assert.equal((await hide('endfield', true, 'wuthering-waves')).activeGameId, 'wuthering-waves');
    assert.equal((await invoke('game:switch', 'endfield')).success, false);
    assert.equal((await invoke('game:list')).games.some(game => game.id === 'endfield'), false);
    assert.equal((await invoke('persist-bridge-games')).games.some(game => game.id === 'endfield'), false);
    const savedHidden = JSON.parse(fs.readFileSync(path.join(profile, 'config.json'), 'utf8'));
    assert.deepEqual(savedHidden.games.find(game => game.id === 'endfield'), {
      ...originalConfig.games.find(game => game.id === 'endfield'), hidden: true
    });
    for (const game of originalConfig.games.filter(game => !['endfield', 'wuthering-waves'].includes(game.id))) {
      assert.equal((await hide(game.id)).success, true);
    }
    assert.equal((await hide('wuthering-waves')).success, false);
    assert.equal(configStore.currentConfig.activeGameId, 'wuthering-waves');
    assert.equal((await hide('endfield', false)).success, true);
    assert.equal((await invoke('game:list')).games.some(game => game.id === 'endfield'), true);
    configStore.currentConfig = originalConfig;
    saveConfig(originalConfig);
    assert.equal((await invoke('settings:update-random-launch', { manager: false })).success, true);
    assert.equal((await invoke('get-config')).config.randomLaunch.manager, false);
    assert.equal((await invoke('game:get-settings', 'wuthering-waves')).game.id, 'wuthering-waves');
    assert.equal((await invoke('i18n:set-language', 'zh-CN')).success, true);
    assert.equal((await invoke('i18n:get-language')).language, 'zh-CN');
    assert.equal(JSON.parse(fs.readFileSync(path.join(profile, 'config.json'), 'utf8')).language, 'zh-CN');
    assert.equal((await invoke('dev:save-publish-config', {})).success, false);

    const marketSettings = require(path.join(main, 'market/settings.cjs'));
    assert.equal(marketSettings.getMarketDownloadCacheDir(), path.join(profile, 'QAQR_DownloadCache'));
    const legacyCache = path.join(profile, 'QAQM_DownloadCache');
    fs.mkdirSync(legacyCache);
    fs.writeFileSync(path.join(legacyCache, 'saved.zip'), 'existing download');
    assert.equal(marketSettings.getMarketDownloadCacheDir(), legacyCache);
    fs.mkdirSync(path.join(profile, 'QAQR_DownloadCache'));
    assert.equal(marketSettings.getMarketDownloadCacheDir(), path.join(profile, 'QAQR_DownloadCache'));
    assert.equal(fs.readFileSync(path.join(legacyCache, 'saved.zip'), 'utf8'), 'existing download');

    const batchScan = require(path.join(main, 'imports/batch-scan.cjs'));
    const customCache = path.join(profile, 'custom-downloads');
    marketSettings.saveMarketDownloadSettings({ cacheDir: customCache });
    const cachePrefix = '12a84b2a1e56a294-';
    for (const cache of [legacyCache, path.join(profile, 'QAQR_DownloadCache'), customCache]) {
      assert.equal(batchScan.batchArchiveItem(path.join(cache, cachePrefix + '中文 Mod v1.2.7z')).name, '中文 Mod v1.2');
      assert.equal(batchScan.batchArchiveItem(path.join(cache, cachePrefix + cachePrefix + 'Mod.7z')).name, cachePrefix + 'Mod');
    }
    assert.equal(batchScan.batchArchiveItem(path.join(profile, cachePrefix + 'Mod.7z')).name, cachePrefix + 'Mod');
    assert.equal(batchScan.batchArchiveItem(path.join(customCache, '普通 Mod.7z')).name, '普通 Mod');

    const helperPaths = require(path.join(main, 'overlay/helper-paths.cjs'));
    const helper = path.join(profile, 'resources', 'QaqrKeyHelper.exe');
    fs.mkdirSync(path.dirname(helper), { recursive: true });
    fs.writeFileSync(helper, 'test helper');
    assert.equal(helperPaths.getAutoOverlayCommandDefaults().overlayAutoReloadCommand, `"${helper}" f10`);
    for (const name of ['QaqrKeyHelper.exe', 'QaqmKeyHelper.exe']) {
      assert.equal(helperPaths.isManagedOverlayHelperCommand(`"D:\\fixture\\${name}" f10`, 'press_f10'), true);
    }

    const unrar = path.join(profile, 'resources', 'UnRAR.exe');
    fs.mkdirSync(path.dirname(unrar), { recursive: true });
    fs.writeFileSync(unrar, 'test extractor');
    const archive = path.join(profile, '安可 Normal.RAR');
    const destination = path.join(profile, 'extracted');
    fs.writeFileSync(archive, 'test archive');
    fs.mkdirSync(destination);
    let exitCode = 0;
    childProcess.spawn = (file, args, options) => {
      assert.equal(path.resolve(file), unrar);
      assert(args.includes(archive));
      assert.equal(options.windowsHide, true);
      const child = Object.assign(new EventEmitter(), { stdout: new EventEmitter(), stderr: new EventEmitter() });
      process.nextTick(() => {
        if (!exitCode) fs.writeFileSync(path.join(destination, 'mod.ini'), '[TextureOverride]\nhash = deadbeef\n');
        else child.stderr.emit('data', Buffer.from('CRC Error'));
        child.emit('close', exitCode);
      });
      return child;
    };
    const { extractArchiveWithExternalTool } = require(path.join(main, 'archives/extract.cjs'));
    await extractArchiveWithExternalTool(archive, destination);
    assert.match(fs.readFileSync(path.join(destination, 'mod.ini'), 'utf8'), /deadbeef/);
    exitCode = 3;
    await assert.rejects(extractArchiveWithExternalTool(archive, destination), /UnRAR 解压失败.*CRC Error/);
  } finally {
    childProcess.spawn = originalSpawn;
    Module._load = originalLoad;
    for (const filename of Object.keys(require.cache)) {
      if (filename.startsWith(main + path.sep)) delete require.cache[filename];
    }
    fs.rmSync(profile, { recursive: true, force: true });
  }
});
