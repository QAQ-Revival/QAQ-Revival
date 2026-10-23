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
  const previousProfile = process.env.QAQM_USER_DATA;
  const paths = {};
  let quit = false;
  process.env.QAQM_USER_DATA = profile;
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
    if (previousProfile === undefined) delete process.env.QAQM_USER_DATA;
    else process.env.QAQM_USER_DATA = previousProfile;
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
    assert(initial.config.games.some(game => game.id === 'wuthering-waves'));
    assert.equal((await invoke('settings:update-random-launch', { manager: false })).success, true);
    assert.equal((await invoke('get-config')).config.randomLaunch.manager, false);
    assert.equal((await invoke('game:get-settings', 'wuthering-waves')).game.id, 'wuthering-waves');
    assert.equal((await invoke('i18n:set-language', 'zh-CN')).success, true);
    assert.equal((await invoke('i18n:get-language')).language, 'zh-CN');
    assert.equal(JSON.parse(fs.readFileSync(path.join(profile, 'config.json'), 'utf8')).language, 'zh-CN');
    assert.equal((await invoke('dev:save-publish-config', {})).success, false);

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
