'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { readJsonFileSync, writeJsonFileSync } = require('./json-store.cjs');
const { allowedFileUrl } = require('./archive-media.cjs');
const { SITES, siteUrl } = require('./mod-sites.cjs');

function createArchiveDownloads({ userData, services, transfer, controlTransfer, getCacheDir, openSource, onProgress = () => {}, openFile = async () => {} }) {
  const stateFile = path.join(userData, 'attachment-downloads.json');
  const tasks = new Map(), running = new Set(), pending = new Map();
  const browserItems = new Map();
  let stopping = false, stateError = '', saveTimer;
  try {
    const saved = readJsonFileSync(stateFile);
    if (!Array.isArray(saved)) throw Error('Invalid attachment state');
    for (const task of saved) {
      if (!task.taskId?.startsWith('attachment:')) continue;
      if (task.browser) {
        if (!Object.hasOwn(SITES, task.source) || !siteUrl(task.sourceUrl, task.source)) continue;
        if (!['completed', 'canceled', 'error'].includes(task.status)) {
          task.status = 'error'; task.error = '网页下载在重启时中断，请点击重试回到原站重新下载。';
        }
      } else {
        if (!allowedFileUrl(task.download?.url, task.source)) continue;
        if (['queued', 'checking', 'downloading'].includes(task.status)) task.status = 'paused';
      }
      tasks.set(task.taskId, task);
    }
  } catch (error) { if (error.code !== 'ENOENT') stateError = '附件下载记录无法读取，原文件已保留'; }
  const view = ({ download, ref, sourceUrl, ...task }) => ({ ...task, provider: 'archive', retryPayload: { provider: 'archive' }, canImport: /\.(zip|rar|7z|mp4|ini)$/i.test(task.name) });
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
      if (task.browser || task.status !== 'queued' || running.has(task.taskId)) continue;
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
    const requestKey = JSON.stringify([source, post?.service, post?.user, post?.id, post?.gameId, filePath]);
    if (pending.has(requestKey)) return pending.get(requestKey);
    const request = (async () => {
      const result = await services[source].getPost(post);
      const file = [result.post.file, ...result.post.attachments].find(item => item?.path === filePath);
      if (!file || file.previewOnly || file.isImage || !allowedFileUrl(file.url, source)) throw Error('此附件不可下载，请刷新帖子后重试');
      const existing = [...tasks.values()].find(task => task.download?.url === file.url && !['error', 'canceled'].includes(task.status) && (task.status !== 'completed' || fs.existsSync(task.archivePath || '')));
      if (existing) return { task: view(existing) };
      const task = { taskId: 'attachment:' + crypto.randomUUID(), source, gameId: result.post.gameId,
        ref: { service: result.post.service, user: result.post.user, id: result.post.id, gameId: result.post.gameId },
        name: file.name, download: { url: file.url, fileName: file.name, fileSize: file.size, rejectHtml: true }, status: 'queued', percent: 0, createdAt: Date.now() };
      tasks.set(task.taskId, task);
      try { save(); } catch (error) { tasks.delete(task.taskId); throw error; }
      onProgress(view(task)); pump(); return { task: view(task) };
    })().finally(() => pending.delete(requestKey));
    pending.set(requestKey, request); return request;
  }
  function adoptBrowserDownload({ source, gameId, sourceUrl, item }) {
    if (stateError) throw Error(stateError);
    if (!Object.hasOwn(SITES, source) || !siteUrl(sourceUrl, source) || !getCacheDir) return false;
    const filename = String(item.getFilename()).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(-180);
    if (!/\.(zip|rar|7z|ini|pak|mp4)$/i.test(filename) || /text\/html/i.test(item.getMimeType())) return false;
    const taskId = 'attachment:' + crypto.randomUUID();
    const folder = path.join(getCacheDir(), 'sites', taskId.slice(11));
    fs.mkdirSync(folder, { recursive: true });
    const archivePath = path.join(folder, filename);
    item.setSavePath(archivePath);
    const task = { taskId, source, gameId, sourceUrl, browser: true, name: filename, status: 'downloading',
      percent: 0, downloaded: 0, total: item.getTotalBytes(), createdAt: Date.now() };
    tasks.set(taskId, task);
    try { save(); } catch (error) { tasks.delete(taskId); throw error; }
    browserItems.set(taskId, item); onProgress(view(task));
    let previousBytes = 0, previousTime = Date.now();
    item.on('updated', (_event, state) => {
      const downloaded = item.getReceivedBytes(), total = item.getTotalBytes(), now = Date.now();
      const status = state === 'interrupted' ? 'error' : item.isPaused() ? 'paused' : 'downloading';
      try { update(task, { status, downloaded, total, percent: total > 0 ? downloaded / total * 100 : 0,
        speed: status === 'downloading' ? (downloaded - previousBytes) * 1000 / Math.max(1, now - previousTime) : 0,
        error: state === 'interrupted' ? '网页下载中断，请重试或返回原站。' : '' }); } catch {}
      previousBytes = downloaded; previousTime = now;
    });
    item.once('done', (_event, state) => {
      browserItems.delete(taskId);
      try { update(task, { status: state === 'completed' ? 'completed' : state === 'cancelled' ? 'canceled' : 'error',
        ...(state === 'completed' ? { archivePath, percent: 100 } : {}), speed: 0,
        error: state === 'completed' ? '' : '网页下载未完成，请点击重试返回原站。' }, true); } catch {}
    });
    return true;
  }
  function control({ taskId, action } = {}) {
    const task = tasks.get(taskId);
    if (!task) throw Error('附件下载任务不存在');
    if (task.browser) {
      const item = browserItems.get(taskId);
      if (action === 'delete') { if (item) item.cancel(); browserItems.delete(taskId); tasks.delete(taskId); save(); }
      else if (action === 'pause' && item && task.status === 'downloading') { item.pause(); update(task, { status: 'paused', speed: 0 }, true); }
      else if (['resume', 'retry'].includes(action) && item && item.canResume()) { item.resume(); update(task, { status: 'downloading', error: '' }, true, true); }
      else if (['resume', 'retry'].includes(action) && ['error', 'canceled', 'paused'].includes(task.status)) {
        if (!openSource) throw Error('请返回原站重新下载');
        return openSource({ source: task.source, gameId: task.gameId, url: task.sourceUrl });
      } else if (action === 'cancel' && item) { item.cancel(); update(task, { status: 'canceled', speed: 0 }, true); }
      else throw Error('当前网页下载不支持此操作');
      return {};
    }
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
    if (stopping) return;
    stopping = true; clearTimeout(saveTimer);
    for (const task of tasks.values()) if (['checking', 'queued', 'downloading'].includes(task.status)) task.status = 'paused';
    if (!stateError) { try { save(); } catch {} }
  }
  return { download, adoptBrowserDownload, control, importPaths, open, shutdown, list: () => { if (stateError) throw Error(stateError); return { tasks: [...tasks.values()].map(view) }; } };
}
function registerArchiveDownloads({ ipcMain, app, BrowserWindow, ...options }) {
  const manager = createArchiveDownloads({ ...options, onProgress: progress => {
    for (const window of BrowserWindow.getAllWindows()) if (!window.isDestroyed()) window.webContents.send('market:download-progress', progress);
  } });
  for (const [channel, method] of Object.entries({ download: 'download', list: 'list', control: 'control', open: 'open', importPaths: 'importPaths' })) {
    ipcMain.handle('attachment:' + channel, async (_event, payload) => {
      try { return { success: true, ...await manager[method](payload) }; }
      catch (error) { return { success: false, error: error.message || '附件下载操作失败', code: error.code, verifyUrl: error.verifyUrl }; }
    });
  }
  app.on('before-quit', manager.shutdown);
  return manager;
}
module.exports = { createArchiveDownloads, registerArchiveDownloads };
