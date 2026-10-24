'use strict';

const i18n = require("../../../shared/i18n/core.cjs");
const fs = require('node:fs');
const path = require('node:path');
const { mainDir } = require('../../runtime/paths.cjs');
const crypto = require('node:crypto');
const {
  spawn: nativeSpawn
} = require('node:child_process');
const {
  parseMegaLink,
  unlockMegaLink
} = require("./links.cjs");
const {
  readJsonFileSync,
  writeJsonFileSync
} = require("../../core/json-store.cjs");
function createMegaTaskManager({
  userData,
  getCacheDir,
  onProgress = () => {},
  openDirectory = async () => '',
  spawn = nativeSpawn,
  onPersistenceError = error => console.error('MEGA 下载记录保存失败：', error.code || error.name),
  executable = path.resolve(mainDir, '../../resources/mega-worker/QAQRMegaWorker.exe')
}) {
  const statePath = path.join(userData, 'mega-downloads.json');
  const tasks = new Map();
  const workers = new Map();
  const removing = new Set();
  let stopping = false;
  let saveTimer;
  let stateError = '';
  try {
    const saved = readJsonFileSync(statePath);
    if (!Array.isArray(saved)) throw new Error(i18n.t("backend.megaTaskManager.invalidTaskState"));
    for (const task of saved) {
      if (!task.taskId?.startsWith('mega:') || typeof task.url !== 'string' || !path.isAbsolute(task.directory || '')) continue;
      if (['queued', 'checking', 'downloading'].includes(task.status)) task.status = 'paused';
      tasks.set(task.taskId, task);
    }
  } catch (error) {
    if (error.code !== 'ENOENT') stateError = i18n.t("backend.megaTaskManager.storageReadFailed", { path: statePath });
  }
  const view = ({
    url,
    directory,
    ...task
  }) => ({
    ...task,
    provider: 'mega',
    archivePath: directory,
    retryPayload: {
      provider: 'mega'
    }
  });
  function save() {
    if (stateError) throw new Error(stateError);
    clearTimeout(saveTimer);
    writeJsonFileSync(statePath, [...tasks.values()]);
  }
  function saveInBackground() {
    try {
      save();
    } catch (error) {
      onPersistenceError(error);
    }
  }
  function update(task, data, immediate = false) {
    if (!tasks.has(task.taskId) || removing.has(task.taskId)) return;
    Object.assign(task, data, {
      updatedAt: Date.now()
    });
    onProgress(view(task));
    if (immediate) save();else {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(saveInBackground, 1000);
    }
  }
  function updateFromWorker(task, data, immediate = false) {
    try {
      update(task, data, immediate);
    } catch (error) {
      onPersistenceError(error);
    }
  }
  function pump() {
    if (stopping) return;
    for (const task of tasks.values()) {
      if (workers.size >= 2) return;
      if (task.status === 'queued' && !workers.has(task.taskId)) startWorker(task);
    }
  }
  function startWorker(task) {
    let child;
    try {
      fs.mkdirSync(task.directory, {
        recursive: true
      });
      child = spawn(executable, [], {
        cwd: path.dirname(executable),
        windowsHide: true,
        shell: false,
        stdio: ['pipe', 'pipe', 'pipe']
      });
    } catch (error) {
      updateFromWorker(task, {
        status: 'error',
        error: error.message
      }, true);
      return;
    }
    workers.set(task.taskId, child);
    let buffer = '',
      ended = false,
      watchdog,
      cancelTimer;
    const resetWatchdog = () => {
      clearTimeout(watchdog);
      if (stopping || task.status === 'paused') return;
      watchdog = setTimeout(() => {
        updateFromWorker(task, {
          status: 'error',
          error: i18n.t("backend.megaTaskManager.workerUnresponsive")
        }, true);
        child.kill();
      }, 180000);
    };
    const finish = error => {
      if (ended) return;
      ended = true;
      clearTimeout(watchdog);
      clearTimeout(cancelTimer);
      workers.delete(task.taskId);
      if (stopping) return;
      if (removing.has(task.taskId)) {
        tasks.delete(task.taskId);
        removing.delete(task.taskId);
        saveInBackground();
      } else if (error || ['checking', 'downloading', 'queued'].includes(task.status)) updateFromWorker(task, {
        status: 'error',
        error: error?.message || i18n.t("backend.megaTaskManager.workerExitedEarly")
      }, true);
      pump();
    };
    child.on('error', finish);
    child.on('close', () => finish());
    child.stdin.on('error', () => {});
    child.stderr.on('data', () => {}); // Do not expose full public-link keys through logs.
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      if (stopping) return;
      buffer += chunk;
      if (buffer.length > 1024 * 1024) {
        finish(new Error(i18n.t("backend.megaTaskManager.invalidWorkerResponse")));
        child.kill();
        return;
      }
      let newline;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline).replace(/^\uFEFF/, '').trim();
        buffer = buffer.slice(newline + 1);
        if (!line) continue;
        try {
          const data = JSON.parse(line);
          if (!['checking', 'downloading', 'paused', 'canceled', 'error', 'completed'].includes(data.status)) continue;
          if (task.status === 'canceled') continue;
          const safe = {};
          for (const key of ['status', 'downloaded', 'total', 'percent', 'speed', 'currentFile', 'filesCompleted', 'filesTotal', 'filesScanned', 'error', 'code']) if (data[key] !== undefined) safe[key] = data[key];
          if (safe.status === 'downloading' && task.status === 'paused') safe.status = 'paused';
          updateFromWorker(task, safe, ['completed', 'error', 'paused', 'canceled'].includes(safe.status));
          resetWatchdog();
        } catch {/* Ignore non-protocol output; unexpected termination remains an error. */}
      }
    });
    child.once('spawn', () => {
      if (stopping || task.status === 'canceled' || removing.has(task.taskId)) {
        child.kill();
        return;
      }
      const paused = task.status === 'paused';
      updateFromWorker(task, {
        status: paused ? 'paused' : 'checking',
        error: '',
        code: ''
      }, true);
      child.stdin.write(JSON.stringify({
        url: task.url,
        directory: task.directory
      }) + '\n');
      resetWatchdog();
      if (paused) child.sendControl('pause');
    });
    child.sendControl = action => {
      if (!child.stdin.destroyed) child.stdin.write(JSON.stringify({
        action
      }) + '\n');
      clearTimeout(cancelTimer);
      if (stopping) {
        clearTimeout(watchdog);
        return;
      }
      if (action === 'cancel') cancelTimer = setTimeout(() => child.kill(), 15000);
      resetWatchdog();
    };
  }
  async function download({
    links,
    name = ''
  } = {}) {
    if (stateError) throw new Error(stateError);
    if (!fs.existsSync(executable)) throw new Error(i18n.t("backend.megaTaskManager.downloadCoreMissing"));
    if (!Array.isArray(links) || !links.length || links.length > 50) throw new Error(i18n.t("backend.megaTaskManager.invalidLinkCount"));
    const resolvedUrls = [];
    for (const item of links) {
      let link = parseMegaLink(typeof item === 'string' ? item : item?.url, item?.key || '');
      if (link.needsPassword) link = await unlockMegaLink(link.url, item?.password);
      if (link.needsKey) throw new Error(i18n.t("backend.megaTaskManager.decryptionKeyMissing"));
      if (link.type === 'encrypted' && /^mega:\/\/elc/i.test(link.url)) throw new Error(i18n.t("backend.megaTaskManager.containerUnsupported"));
      resolvedUrls.push(link.url);
    }
    const urls = [...new Set(resolvedUrls)];
    const base = path.resolve(getCacheDir(), 'MEGA');
    fs.mkdirSync(base, {
      recursive: true
    });
    const queued = [];
    for (const url of urls) {
      const existing = [...tasks.values()].find(task => task.url === url && ['queued', 'checking', 'downloading', 'paused'].includes(task.status));
      if (existing) {
        queued.push(view(existing));
        continue;
      }
      const id = crypto.randomUUID();
      const task = {
        taskId: 'mega:' + id,
        url,
        name: String(name || i18n.t("backend.megaTaskManager.downloadTaskName")).slice(0, 300),
        provider: 'mega',
        directory: path.join(base, id),
        status: 'queued',
        percent: 0,
        downloaded: 0,
        total: 0,
        speed: 0,
        createdAt: Date.now()
      };
      tasks.set(task.taskId, task);
      queued.push(view(task));
    }
    save();
    queued.forEach(onProgress);
    pump();
    return {
      count: queued.length,
      tasks: queued
    };
  }
  function control({
    taskId,
    action
  } = {}) {
    const task = tasks.get(taskId);
    if (!task) throw new Error(i18n.t("backend.megaTaskManager.taskMissing"));
    const child = workers.get(taskId);
    if (action === 'pause' && ['queued', 'checking', 'downloading'].includes(task.status)) {
      update(task, {
        status: 'paused',
        speed: 0
      }, true);
      child?.sendControl('pause');
    } else if (action === 'resume' && task.status === 'paused') {
      update(task, {
        status: child ? 'downloading' : 'queued',
        error: ''
      }, true);
      child?.sendControl('resume');
      pump();
    } else if (action === 'cancel') {
      update(task, {
        status: 'canceled',
        speed: 0,
        error: i18n.t("backend.megaTaskManager.canceledWithResume")
      }, true);
      child?.sendControl('cancel');
    } else if (action === 'retry' && ['error', 'canceled'].includes(task.status)) {
      if (child) throw new Error(i18n.t("backend.megaTaskManager.workerStopping"));
      update(task, {
        status: 'queued',
        error: '',
        code: ''
      }, true);
      pump();
    } else if (action === 'delete') {
      if (child) {
        removing.add(taskId);
        child.sendControl('cancel');
      } else {
        tasks.delete(taskId);
        save();
      }
    } else throw new Error(i18n.t("backend.archiveDownloads.operationUnavailable"));
    return {};
  }
  async function open({
    taskId
  } = {}) {
    const task = tasks.get(taskId);
    if (!task || !fs.existsSync(task.directory)) throw new Error(i18n.t("backend.megaTaskManager.downloadDirectoryMissing"));
    const error = await openDirectory(task.directory);
    if (error) throw new Error(error);
    return {};
  }
  function importPaths({
    taskId
  } = {}) {
    const task = tasks.get(taskId);
    if (!task || task.status !== 'completed') throw new Error(i18n.t("backend.megaTaskManager.waitForDownload"));
    if (!fs.existsSync(task.directory)) throw new Error(i18n.t("backend.archiveDownloads.downloadedFileMissing"));
    let count = 0;
    function checkEntry(target, depth = 0) {
      if (depth > 40 || ++count > 20000) throw new Error(i18n.t("backend.megaTaskManager.downloadDirectoryTooLarge"));
      const stat = fs.lstatSync(target);
      if (stat.isSymbolicLink()) throw new Error(i18n.t("backend.megaTaskManager.downloadDirectoryLinked"));
      if (stat.isDirectory()) for (const entry of fs.readdirSync(target)) checkEntry(path.join(target, entry), depth + 1);
    }
    checkEntry(task.directory);
    const paths = fs.readdirSync(task.directory, {
      withFileTypes: true
    }).filter(entry => (entry.isDirectory() || entry.isFile()) && !/^\.resume-/.test(entry.name) && !/\.(part|tmp)$/i.test(entry.name)).map(entry => path.join(task.directory, entry.name));
    if (!paths.length) throw new Error(i18n.t("backend.megaTaskManager.importableFilesMissing"));
    // Passing a loose Mod root intact keeps its INI, textures and buffers together.
    return {
      paths: paths.some(file => /\.(ini|buf|ib|vb|dds)$/i.test(file)) ? [task.directory] : paths
    };
  }
  function shutdown() {
    if (stopping) return;
    stopping = true;
    clearTimeout(saveTimer);
    for (const id of removing) tasks.delete(id);
    removing.clear();
    for (const task of tasks.values()) {
      if (['queued', 'checking', 'downloading'].includes(task.status)) Object.assign(task, {
        status: 'paused',
        speed: 0
      });
    }
    for (const child of workers.values()) {
      try {
        child.sendControl('cancel');
      } catch {/* A worker may already have closed its input. */}
    }
    if (!stateError) saveInBackground();
  }
  return {
    download,
    control,
    open,
    importPaths,
    list: () => {
      if (stateError) throw new Error(stateError);
      return {
        tasks: [...tasks.values()].map(view)
      };
    },
    shutdown
  };
}
function registerRevivalIpc({
  ipcMain,
  app,
  BrowserWindow,
  shell,
  userData,
  getCacheDir,
  ...options
}) {
  const manager = createMegaTaskManager({
    userData,
    getCacheDir,
    ...options,
    openDirectory: folder => shell.openPath(folder),
    onProgress: task => {
      for (const window of BrowserWindow.getAllWindows()) if (!window.isDestroyed()) window.webContents.send('market:download-progress', task);
    }
  });
  for (const method of ['download', 'control', 'open', 'list', 'importPaths']) ipcMain.handle('mega:revival-' + method, async (_, payload) => {
    try {
      return {
        success: true,
        ...(await manager[method](payload))
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  });
  app.on('before-quit', () => manager.shutdown());
  return manager;
}
module.exports = {
  createMegaTaskManager,
  registerRevivalIpc
};
