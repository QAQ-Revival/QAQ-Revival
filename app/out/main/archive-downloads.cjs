'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { readJsonFileSync, writeJsonFileSync } = require('./json-store.cjs');
const { allowedFileUrl } = require('./archive-media.cjs');

function createArchiveDownloads({ userData, services, transfer, controlTransfer, onProgress = () => {}, openFile = async () => {} }) {
  const stateFile = path.join(userData, 'attachment-downloads.json');
  const tasks = new Map(), running = new Set(), pending = new Map();
  let stopping = false, stateError = '', saveTimer;
  try {
    const saved = readJsonFileSync(stateFile);
    if (!Array.isArray(saved)) throw Error('Invalid attachment state');
    for (const task of saved) {
      if (!task.taskId?.startsWith('attachment:') || !allowedFileUrl(task.download?.url, task.source)) continue;
      if (['queued', 'checking', 'downloading'].includes(task.status)) task.status = 'paused';
      tasks.set(task.taskId, task);
    }
  } catch (error) { if (error.code !== 'ENOENT') stateError = '附件下载记录无法读取，原文件已保留'; }
  const view = ({ download, ref, ...task }) => ({ ...task, provider: 'archive', retryPayload: { provider: 'archive' }, canImport: /\.(zip|rar|7z|mp4|ini)$/i.test(task.name) });
  function save() { if (stateError) throw Error(stateError); clearTimeout(saveTimer); writeJsonFileSync(stateFile, [...tasks.values()]); }
  function update(task, change, immediate = false, explicitResume = false) {
    if (stopping || !tasks.has(task.taskId)) return;
    if (!explicitResume && task.status === 'paused' && change.status === 'downloading') change = { ...change, status: 'paused' };
    Object.assign(task, change, { updatedAt: Date.now() });
    onProgress(view(task));
    if (immediate) save();
    else { clearTimeout(saveTimer); saveTimer = setTimeout(() => { try { save(); } catch {} }, 500); }
  }
  function pump() {
    if (stopping) return;
    for (const task of tasks.values()) {
      if (running.size >= 2) return;
      if (task.status !== 'queued' || running.has(task.taskId)) continue;
      running.add(task.taskId);
      Promise.resolve().then(async () => {
        if (stopping || !tasks.has(task.taskId) || task.status !== 'queued') return;
        update(task, { status: 'checking', error: '' }, true);
        const archivePath = await transfer(task, progress => {
          // The shared HTTP engine's final downloaded event is followed by this manager's completion.
          update(task, progress.status === 'downloaded' ? { ...progress, status: 'downloading' } : progress);
        });
        update(task, { status: 'completed', archivePath, percent: 100, speed: 0 }, true);
      }).catch(error => {
        try { update(task, { status: error.code === 'DOWNLOAD_CANCELED' ? 'canceled' : 'error', error: error.message || '附件下载失败', speed: 0 }, true); } catch {}
      }).finally(() => { running.delete(task.taskId); pump(); });
    }
  }
  async function download(payload = {}) {
    if (stateError) throw Error(stateError);
    const { source, post, filePath } = payload;
    if (!Object.hasOwn(services, source) || typeof filePath !== 'string') throw Error('附件来源无效');
    const requestKey = JSON.stringify([source, post?.service, post?.user, post?.id, filePath]);
    if (pending.has(requestKey)) return pending.get(requestKey);
    const request = (async () => {
      const result = await services[source].getPost(post);
      const file = [result.post.file, ...result.post.attachments].find(item => item?.path === filePath);
      if (!file || file.previewOnly || file.isImage || !allowedFileUrl(file.url, source)) throw Error('此附件不可下载，请刷新帖子后重试');
      const existing = [...tasks.values()].find(task => task.download.url === file.url && !['error', 'canceled'].includes(task.status) && (task.status !== 'completed' || fs.existsSync(task.archivePath || '')));
      if (existing) return { task: view(existing) };
      const task = { taskId: 'attachment:' + crypto.randomUUID(), source, ref: { service: result.post.service, user: result.post.user, id: result.post.id },
        name: file.name, download: { url: file.url, fileName: file.name, rejectHtml: true }, status: 'queued', percent: 0, createdAt: Date.now() };
      tasks.set(task.taskId, task);
      try { save(); } catch (error) { tasks.delete(task.taskId); throw error; }
      onProgress(view(task)); pump(); return { task: view(task) };
    })().finally(() => pending.delete(requestKey));
    pending.set(requestKey, request); return request;
  }
  function control({ taskId, action } = {}) {
    const task = tasks.get(taskId);
    if (!task) throw Error('附件下载任务不存在');
    const active = running.has(taskId);
    if (action === 'delete') {
      if (active) controlTransfer(taskId, 'cancel');
      tasks.delete(taskId); save(); return {};
    }
    if (action === 'pause' && ['checking', 'queued', 'downloading'].includes(task.status)) {
      if (active) controlTransfer(taskId, 'pause'); update(task, { status: 'paused', speed: 0 }, true);
    } else if (action === 'resume' && task.status === 'paused') {
      if (active) controlTransfer(taskId, 'resume'); update(task, { status: active ? 'downloading' : 'queued', error: '' }, true, true); pump();
    } else if (action === 'cancel' && ['checking', 'queued', 'downloading', 'paused'].includes(task.status)) {
      if (active) controlTransfer(taskId, 'cancel'); update(task, { status: 'canceled', error: '下载已取消' }, true);
    } else if (action === 'retry' && ['error', 'canceled'].includes(task.status) && !active) {
      update(task, { status: 'queued', error: '' }, true); pump();
    } else throw Error('当前任务状态不支持此操作');
    return {};
  }
  function importPaths({ taskId } = {}) {
    const task = tasks.get(taskId);
    if (!task || task.status !== 'completed' || !view(task).canImport) throw Error('请等待可导入的附件下载完成');
    if (!fs.existsSync(task.archivePath)) throw Error('下载文件已被移动或删除');
    return { paths: [task.archivePath] };
  }
  async function open({ taskId } = {}) {
    const task = tasks.get(taskId);
    if (!task?.archivePath || !fs.existsSync(task.archivePath)) throw Error('下载文件尚未生成或已被移动');
    await openFile(task.archivePath); return {};
  }
  function shutdown() {
    stopping = true; clearTimeout(saveTimer);
    for (const task of tasks.values()) if (['checking', 'queued', 'downloading'].includes(task.status)) task.status = 'paused';
    if (!stateError) { try { save(); } catch {} }
  }
  return { download, control, importPaths, open, shutdown, list: () => { if (stateError) throw Error(stateError); return { tasks: [...tasks.values()].map(view) }; } };
}
function registerArchiveDownloads({ ipcMain, app, BrowserWindow, ...options }) {
  const manager = createArchiveDownloads({ ...options, onProgress: progress => {
    for (const window of BrowserWindow.getAllWindows()) if (!window.isDestroyed()) window.webContents.send('market:download-progress', progress);
  } });
  for (const [channel, method] of Object.entries({ download: 'download', list: 'list', control: 'control', open: 'open', importPaths: 'importPaths' })) {
    ipcMain.handle('attachment:' + channel, async (_event, payload) => {
      try { return { success: true, ...await manager[method](payload) }; }
      catch (error) { return { success: false, error: error.message || '附件下载操作失败' }; }
    });
  }
  app.on('before-quit', manager.shutdown);
  return manager;
}
module.exports = { createArchiveDownloads, registerArchiveDownloads };
