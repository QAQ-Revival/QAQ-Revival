const i18n = require("../../../shared/i18n/core.cjs");
const fs = require('node:fs');
const path = require('node:path');
const {
  execFile
} = require('node:child_process');
const GAMES = Object.freeze({
  endfield: {
    name: '终末地',
    appId: 4732690
  },
  'wuthering-waves': {
    name: '鸣潮',
    appId: 3513350
  }
});
function gameInfo(id) {
  if (!Object.hasOwn(GAMES, id)) throw Error(i18n.t("backend.steamBridge.unsupportedGame"));
  return GAMES[id];
}
function validateOptions(options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options) || Object.keys(options).some(key => !['launchMethod', 'channelId', 'launcher', 'qaqrSteamManaged', 'autoSync'].includes(key))) throw Error(i18n.t("backend.steamBridge.invalidOptions"));
  if (options.launchMethod !== undefined && !['official', 'qaqr'].includes(options.launchMethod)) throw Error(i18n.t("backend.steamBridge.invalidLaunchMode"));
  if (options.channelId !== undefined && !['official', 'bilibili'].includes(options.channelId)) throw Error(i18n.t("backend.steamBridge.invalidServer"));
  if (options.qaqrSteamManaged !== undefined && typeof options.qaqrSteamManaged !== 'boolean') throw Error(i18n.t("backend.steamBridge.invalidManagementOptions"));
  if (options.autoSync !== undefined && typeof options.autoSync !== 'boolean') throw Error(i18n.t("backend.steamBridge.invalidAutoSync"));
  if (options.launcher !== undefined && (typeof options.launcher !== 'string' || options.launcher.length > 4096 || /[\0\r\n]/.test(options.launcher) || options.launcher && (!path.win32.isAbsolute(options.launcher) || !/\.exe$/i.test(options.launcher)))) throw Error(i18n.t("backend.steamBridge.launcherPathRequired"));
  return options;
}
function createNativeClient({
  executable,
  userData,
  execute = execFile
}) {
  return async request => {
    if (!fs.existsSync(executable)) throw Error(i18n.t("backend.steamBridge.componentMissing"));
    const base = path.join(userData, 'steam-bridge-requests');
    fs.mkdirSync(base, {
      recursive: true
    });
    const directory = fs.mkdtempSync(path.join(base, 'request-'));
    const input = path.join(directory, 'request.json'),
      output = path.join(directory, 'result.json');
    fs.writeFileSync(input, JSON.stringify(request));
    const env = {
      ...process.env,
      QAQR_USER_DATA: userData
    };
    delete env.ELECTRON_RUN_AS_NODE;
    try {
      return await new Promise((resolve, reject) => {
        // Never kill an installation while it is committing or restoring its backup.
        execute(executable, ['--api', input, output], {
          env,
          windowsHide: true,
          shell: false,
          timeout: request.Action === 'status' ? 45000 : 0,
          maxBuffer: 1024 * 1024
        }, error => {
          try {
            if (!fs.existsSync(output) || fs.statSync(output).size > 1024 * 1024) throw Error(error?.message || i18n.t("backend.steamBridge.resultMissing"));
            const result = JSON.parse(fs.readFileSync(output, 'utf8'));
            if (result.success !== true && !result.error) throw Error(error?.message || result.progress || i18n.t("backend.steamBridge.operationIncomplete"));
            if (error && result.success === true) throw Error(i18n.t("backend.steamBridge.processFailed"));
            resolve(result);
          } catch (failure) {
            reject(failure);
          }
        });
      });
    } finally {
      const relative = path.relative(base, directory);
      if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) fs.rmSync(directory, {
        recursive: true,
        force: true
      });
    }
  };
}
function createSteamBridgeService({
  getGame,
  userData,
  executable,
  managerExecutable,
  confirm = async () => false,
  runNative = createNativeClient({
    executable,
    userData
  })
}) {
  let mutating = false,
    lastAuto = null,
    nextAuto = 0;
  function parameters(gameId, options = {}) {
    gameInfo(gameId);
    validateOptions(options);
    const game = getGame(gameId);
    return {
      GameId: gameId,
      Game: game.gamePath || null,
      QaqrPath: managerExecutable,
      QaqrUserData: userData,
      LaunchMethod: options.launchMethod ?? null,
      ChannelId: gameId === 'wuthering-waves' ? 'official' : options.channelId ?? null,
      Launcher: options.launcher || null,
      QaqrSteamManaged: options.qaqrSteamManaged ?? null,
      AutoSync: options.autoSync ?? null
    };
  }
  async function status({
    gameId,
    options
  } = {}) {
    if (mutating) return {
      success: false,
      error: i18n.t("backend.steamBridge.checkInProgress")
    };
    return {
      ...(await runNative({
        Action: 'status',
        Games: [parameters(gameId, options)]
      })),
      automation: lastAuto
    };
  }
  async function change(action, {
    gameId,
    options,
    all = false
  } = {}) {
    if (mutating) throw Error(i18n.t("backend.steamBridge.operationInProgress"));
    if (typeof all !== 'boolean' || action === 'restore' && all) throw Error(i18n.t("backend.steamBridge.invalidScope"));
    gameInfo(gameId);
    validateOptions(options);
    const ids = all ? Object.keys(GAMES) : [gameId];
    const games = action === 'restore' ? [{
      GameId: gameId
    }] : ids.map(id => parameters(id, id === gameId ? options : {}));
    mutating = true;
    try {
      if (!(await confirm({
        action,
        games: ids.map(id => GAMES[id].name)
      }))) return {
        success: false,
        canceled: true
      };
      return await runNative({
        Action: action,
        Games: games
      });
    } finally {
      mutating = false;
    }
  }
  async function autoSync() {
    if (mutating || Date.now() < nextAuto) return null;
    mutating = true;
    try {
      const result = await runNative({
        Action: 'auto-sync',
        Games: Object.keys(GAMES).map(GameId => ({
          GameId,
          QaqrUserData: userData
        }))
      });
      if (!result.success || result.changed) nextAuto = Date.now() + 300000;
      if (!result.success || result.changed || result.deferred || result.warnings?.length) lastAuto = {
        ...result,
        checkedAt: Date.now()
      };else if (!lastAuto?.changed) lastAuto = null;
      return result;
    } catch (error) {
      nextAuto = Date.now() + 300000;
      lastAuto = {
        success: false,
        error: error.message
      };
      return lastAuto;
    } finally {
      mutating = false;
    }
  }
  return {
    status,
    autoSync,
    apply: payload => change('apply', payload),
    restore: payload => change('restore', payload)
  };
}
function registerSteamBridgeIpc({
  ipcMain,
  dialog,
  shell,
  getWindow,
  getGame,
  userData,
  managerExecutable,
  executable,
  runNative,
  schedule = true
}) {
  const service = createSteamBridgeService({
    getGame,
    userData,
    managerExecutable,
    executable,
    runNative,
    confirm: async ({
      action,
      games
    }) => {
      const result = await dialog.showMessageBox(getWindow(), {
        type: 'question',
        title: i18n.t("backend.steamBridge.title"),
        message: i18n.t("backend.steamBridge.confirmOperation", {
          label: action === 'restore' ? i18n.t("backend.steamBridge.restoreAction") : i18n.t("backend.steamBridge.applyAction"),
          path: games.join('、')
        }),
        detail: i18n.t("backend.steamBridge.confirmationDetail"),
        buttons: [i18n.t("backend.desktop.windows.cancel"), i18n.t("backend.steamBridge.continue")],
        defaultId: 0,
        cancelId: 0,
        noLink: true
      });
      return result.response === 1;
    }
  });
  const actions = {
    status: payload => service.status(payload),
    apply: payload => service.apply(payload),
    restore: payload => service.restore(payload),
    'select-launcher': async ({
      gameId
    } = {}) => {
      gameInfo(gameId);
      const result = await dialog.showOpenDialog(getWindow(), {
        title: i18n.t("backend.steamBridge.chooseOfficialLauncher"),
        properties: ['openFile'],
        filters: [{
          name: i18n.t("backend.steamBridge.launcherFilter"),
          extensions: ['exe']
        }]
      });
      if (result.canceled || !result.filePaths?.length) return {
        success: false,
        canceled: true
      };
      validateOptions({
        launcher: result.filePaths[0]
      });
      return {
        success: true,
        launcher: result.filePaths[0]
      };
    },
    'open-library': async ({
      gameId
    } = {}) => {
      const game = gameInfo(gameId);
      await shell.openExternal(`steam://nav/games/details/${game.appId}`);
      return {
        success: true
      };
    }
  };
  for (const [name, action] of Object.entries(actions)) ipcMain.handle('steam-bridge:' + name, async (_event, payload) => {
    try {
      return await action(payload);
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  });
  let timer,
    disposed = false;
  async function tick() {
    await service.autoSync();
    if (!disposed) {
      timer = setTimeout(tick, 60000);
      timer.unref?.();
    }
  }
  if (schedule) {
    timer = setTimeout(tick, 20000);
    timer.unref?.();
  }
  return {
    ...service,
    dispose() {
      disposed = true;
      clearTimeout(timer);
    }
  };
}
module.exports = {
  GAMES,
  validateOptions,
  createNativeClient,
  createSteamBridgeService,
  registerSteamBridgeIpc
};
