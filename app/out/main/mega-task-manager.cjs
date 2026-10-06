'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn: nativeSpawn } = require('node:child_process');
const { parseMegaLink } = require('./mega-revival.cjs');
const { readJsonFileSync, writeJsonFileSync } = require('./json-store.cjs');

function createMegaTaskManager({ userData, getCacheDir, onProgress = () => {}, openDirectory = async () => '', spawn = nativeSpawn,
  onPersistenceError = error => console.error('MEGA 下载记录保存失败：', error.code || error.name),
  executable = path.resolve(__dirname, '../../resources/mega-worker/QAQMMegaWorker.exe') }) {
  const statePath = path.join(userData, 'mega-downloads.json');
  const tasks = new Map();
  const workers = new Map();
  const removing = new Set();
  let stopping = false;
  let saveTimer;
  let stateError = '';
  try {
    const saved = readJsonFileSync(statePath);
    if (!Array.isArray(saved)) throw new Error('Invalid task state');
    for (const task of saved) {
      if (!task.taskId?.startsWith('mega:') || typeof task.url !== 'string' || !path.isAbsolute(task.directory || '')) continue;
      if (['queued', 'checking', 'downloading'].includes(task.status)) task.status = 'paused';
      tasks.set(task.taskId, task);
    }
  } catch (error) { if (error.code !== 'ENOENT') stateError = 'MEGA 下载记录无法读取，原文件已保留：' + statePath; }
  const view = ({ url, directory, ...task }) => ({ ...task, provider: 'mega', archivePath: directory, retryPayload: { provider: 'mega' } });
  function save() {
    if (stateError) throw new Error(stateError);
    clearTimeout(saveTimer);
    writeJsonFileSync(statePath, [...tasks.values()]);
  }
  function saveInBackground() {
    try { save(); } catch (error) { onPersistenceError(error); }
  }
  function update(task, data, immediate = false) {
    if (!tasks.has(task.taskId) || removing.has(task.taskId)) return;
    Object.assign(task, data, { updatedAt: Date.now() });
    onProgress(view(task));
    if (immediate) save();
    else { clearTimeout(saveTimer); saveTimer = setTimeout(saveInBackground, 1000); }
  }
  function updateFromWorker(task, data, immediate = false) {
    try { update(task, data, immediate); } catch (error) { onPersistenceError(error); }
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
      fs.mkdirSync(task.directory, { recursive: true });
      child = spawn(executable, [], { cwd: path.dirname(executable), windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (error) { updateFromWorker(task, { status: 'error', error: error.message }, true); return; }
    workers.set(task.taskId, child);
    let buffer = '', ended = false, watchdog, cancelTimer;
    const resetWatchdog = () => {
      clearTimeout(watchdog);
      if (stopping || task.status === 'paused') return;
      watchdog = setTimeout(() => { updateFromWorker(task, { status: 'error', error: 'MEGA 工作进程长时间无响应，已保留断点，请重试' }, true); child.kill(); }, 180000);
    };
    const finish = (error) => {
      if (ended) return; ended = true;
      clearTimeout(watchdog); clearTimeout(cancelTimer);
      workers.delete(task.taskId);
      if (stopping) return;
      if (removing.has(task.taskId)) { tasks.delete(task.taskId); removing.delete(task.taskId); saveInBackground(); }
      else if (error || ['checking', 'downloading', 'queued'].includes(task.status)) updateFromWorker(task, { status: 'error', error: error?.message || 'MEGA 工作进程提前退出，已保留断点，请重试' }, true);
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
      if (buffer.length > 1024 * 1024) { finish(new Error('MEGA 工作进程返回了无效数据')); child.kill(); return; }
      let newline;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline).replace(/^\uFEFF/, '').trim(); buffer = buffer.slice(newline + 1);
        if (!line) continue;
        try {
          const data = JSON.parse(line);
          if (!['checking', 'downloading', 'paused', 'canceled', 'error', 'completed'].includes(data.status)) continue;
          if (task.status === 'canceled') continue;
          const safe = {};
          for (const key of ['status', 'downloaded', 'total', 'percent', 'speed', 'currentFile', 'filesCompleted', 'filesTotal', 'filesScanned', 'error', 'code']) if (data[key] !== undefined) safe[key] = data[key];
          if (safe.status === 'downloading' && task.status === 'paused') safe.status = 'paused';
          updateFromWorker(task, safe, ['completed', 'error', 'paused', 'canceled'].includes(safe.status)); resetWatchdog();
        } catch { /* Ignore non-protocol output; unexpected termination remains an error. */ }
      }
    });
    child.once('spawn', () => {
      if (stopping || task.status === 'canceled' || removing.has(task.taskId)) { child.kill(); return; }
      const paused = task.status === 'paused';
      updateFromWorker(task, { status: paused ? 'paused' : 'checking', error: '', code: '' }, true);
      child.stdin.write(JSON.stringify({ url: task.url, directory: task.directory }) + '\n'); resetWatchdog();
      if (paused) child.sendControl('pause');
    });
    child.sendControl = action => {
      if (!child.stdin.destroyed) child.stdin.write(JSON.stringify({ action }) + '\n');
      clearTimeout(cancelTimer);
      if (stopping) { clearTimeout(watchdog); return; }
      if (action === 'cancel') cancelTimer = setTimeout(() => child.kill(), 15000);
      resetWatchdog();
    };
  }
  async function download({ links, name = '' } = {}) {
    if (stateError) throw new Error(stateError);
    if (!fs.existsSync(executable)) throw new Error('MEGA 下载核心尚未构建，请运行构建脚本');
    if (!Array.isArray(links) || !links.length || links.length > 50) throw new Error('请选择 1 至 50 个 MEGA 链接');
    const urls = [...new Set(links.map(item => {
      const link = parseMegaLink(typeof item === 'string' ? item : item?.url, item?.key || '');
      if (link.needsKey) throw new Error('MEGA 链接缺少解密密钥，请先填写');
      if (link.type === 'encrypted' && /^mega:\/\/elc/i.test(link.url)) throw new Error('暂不支持 ELC 容器，请使用文件或文件夹分享链接');
      return link.url;
    }))];
    const base = path.resolve(getCacheDir(), 'MEGA'); fs.mkdirSync(base, { recursive: true });
    const queued = [];
    for (const url of urls) {
      const existing = [...tasks.values()].find(task => task.url === url && ['queued', 'checking', 'downloading', 'paused'].includes(task.status));
      if (existing) { queued.push(view(existing)); continue; }
      const id = crypto.randomUUID();
      const task = { taskId: 'mega:' + id, url, name: String(name || 'MEGA 下载').slice(0, 300), provider: 'mega',
        directory: path.join(base, id), status: 'queued', percent: 0, downloaded: 0, total: 0, speed: 0, createdAt: Date.now() };
      tasks.set(task.taskId, task); queued.push(view(task));
    }
    save();
    queued.forEach(onProgress); pump();
    return { count: queued.length, tasks: queued };
  }
  function control({ taskId, action } = {}) {
    const task = tasks.get(taskId);
    if (!task) throw new Error('下载任务不存在');
    const child = workers.get(taskId);
    if (action === 'pause' && ['queued', 'checking', 'downloading'].includes(task.status)) {
      update(task, { status: 'paused', speed: 0 }, true); child?.sendControl('pause');
    } else if (action === 'resume' && task.status === 'paused') {
      update(task, { status: child ? 'downloading' : 'queued', error: '' }, true); child?.sendControl('resume'); pump();
    } else if (action === 'cancel') {
      update(task, { status: 'canceled', speed: 0, error: '下载已取消，已保留断点' }, true); child?.sendControl('cancel');
    } else if (action === 'retry' && ['error', 'canceled'].includes(task.status)) {
      if (child) throw new Error('下载核心正在退出，请稍后重试');
      update(task, { status: 'queued', error: '', code: '' }, true); pump();
    } else if (action === 'delete') {
      if (child) { removing.add(taskId); child.sendControl('cancel'); }
      else { tasks.delete(taskId); save(); }
    } else throw new Error('当前任务状态不支持此操作');
    return {};
  }
  async function open({ taskId } = {}) {
    const task = tasks.get(taskId);
    if (!task || !fs.existsSync(task.directory)) throw new Error('下载目录尚未创建或已被移动');
    const error = await openDirectory(task.directory); if (error) throw new Error(error);
    return {};
  }
  function importPaths({ taskId } = {}) {
    const task = tasks.get(taskId);
    if (!task || task.status !== 'completed') throw new Error('请等待下载完成后再导入 Mod');
    if (!fs.existsSync(task.directory)) throw new Error('下载文件已被移动或删除');
    let count = 0;
    function checkEntry(target, depth = 0) {
      if (depth > 40 || ++count > 20000) throw new Error('下载目录过大，请从批量导入中选择所需文件');
      const stat = fs.lstatSync(target);
      if (stat.isSymbolicLink()) throw new Error('下载目录包含文件系统链接，请手动选择要导入的 Mod');
      if (stat.isDirectory()) for (const entry of fs.readdirSync(target)) checkEntry(path.join(target, entry), depth + 1);
    }
    checkEntry(task.directory);
    const paths = fs.readdirSync(task.directory, { withFileTypes: true }).filter(entry =>
      (entry.isDirectory() || entry.isFile()) && !/^\.resume-/.test(entry.name) && !/\.(part|tmp)$/i.test(entry.name)
    ).map(entry => path.join(task.directory, entry.name));
    if (!paths.length) throw new Error('下载目录中没有可导入的文件');
    // Passing a loose Mod root intact keeps its INI, textures and buffers together.
    return { paths: paths.some(file => /\.(ini|buf|ib|vb|dds)$/i.test(file)) ? [task.directory] : paths };
  }
  function shutdown() {
    if (stopping) return;
    stopping = true;
    clearTimeout(saveTimer);
    for (const id of removing) tasks.delete(id);
    removing.clear();
    for (const task of tasks.values()) {
      if (['queued', 'checking', 'downloading'].includes(task.status)) Object.assign(task, { status: 'paused', speed: 0 });
    }
    for (const child of workers.values()) {
      try { child.sendControl('cancel'); } catch { /* A worker may already have closed its input. */ }
    }
    if (!stateError) saveInBackground();
  }
  return { download, control, open, importPaths, list: () => { if (stateError) throw new Error(stateError); return { tasks: [...tasks.values()].map(view) }; }, shutdown };
}

function registerRevivalIpc({ ipcMain, app, BrowserWindow, shell, userData, getCacheDir, ...options }) {
  const manager = createMegaTaskManager({ userData, getCacheDir, ...options, openDirectory: folder => shell.openPath(folder),
    onProgress: task => { for (const window of BrowserWindow.getAllWindows()) if (!window.isDestroyed()) window.webContents.send('market:download-progress', task); } });
  for (const method of ['download', 'control', 'open', 'list', 'importPaths']) ipcMain.handle('mega:revival-' + method, async (_, payload) => {
    try { return { success: true, ...await manager[method](payload) }; }
    catch (error) { return { success: false, error: error.message }; }
  });
  app.on('before-quit', () => manager.shutdown());
  return manager;
}
module.exports = { createMegaTaskManager, registerRevivalIpc };
