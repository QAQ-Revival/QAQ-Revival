'use strict';
const path = require('node:path');
const { readJsonFileSync, writeJsonFileSync } = require('./json-store.cjs');
const API_URL = 'https://api.github.com/repos/QAQ-Revival/QAQ-Revival/releases/latest';
function versionParts(value) {
  const match = String(value || '').match(/^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
  if (!match) return null;
  const parts = match.slice(1).map(Number);
  return parts.every(Number.isSafeInteger) ? parts : null;
}
function newerVersion(candidate, current) {
  const next = versionParts(candidate), installed = versionParts(current);
  if (!next || !installed) return false;
  for (let i = 0; i < 3; i++) if (next[i] !== installed[i]) return next[i] > installed[i];
  return false;
}
function calendarDay(time) {
  const date = new Date(time);
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
}
function normalizeRelease(value) {
  if (!value || value.draft || value.prerelease || !versionParts(value.tag_name)) throw Error('GitHub 返回的正式版本信息无效');
  const url = new URL(value.html_url);
  if (url.origin !== 'https://github.com' || url.username || url.password || !url.pathname.startsWith('/QAQ-Revival/QAQ-Revival/releases/tag/')) throw Error('GitHub 返回的发布地址无效');
  return { version: value.tag_name.replace(/^v/, ''), url: url.href, publishedAt: value.published_at || null,
    notes: String(value.body || '').slice(0, 16000) };
}
function createSoftwareUpdates({ userData, version, fetch: fetchImpl = globalThis.fetch, now = Date.now, onChange = () => {} }) {
  const file = path.join(userData, 'software-updates.json');
  let state = { enabled: true, intervalDays: 1, lastAttemptDay: null, lastAttemptAt: 0, lastCheckedAt: 0, release: null, noRelease: false, etag: '', error: '', dismissedVersion: '', retryAfter: 0 };
  let storageError = '', checking = null;
  try {
    const saved = readJsonFileSync(file);
    if (typeof saved.enabled !== 'boolean' || !Number.isInteger(saved.intervalDays) || saved.intervalDays < 1 || saved.intervalDays > 365) throw Error('Invalid update preferences');
    state = { ...state, ...saved };
    if (state.release) state.release = normalizeRelease({ tag_name: state.release.version, html_url: state.release.url, published_at: state.release.publishedAt, body: state.release.notes });
  } catch (error) { if (error.code !== 'ENOENT') storageError = '更新设置无法读取，原文件已保留'; }
  function getState() {
    return { enabled: state.enabled, intervalDays: state.intervalDays, currentVersion: version, checking: !!checking,
      lastAttemptAt: state.lastAttemptAt, lastCheckedAt: state.lastCheckedAt, release: state.release, noRelease: state.noRelease,
      updateAvailable: !!state.release && newerVersion(state.release.version, version), dismissedVersion: state.dismissedVersion,
      error: storageError || state.error, retryAfter: state.retryAfter };
  }
  function save(next) {
    if (storageError) throw Error(storageError);
    writeJsonFileSync(file, next); state = next;
  }
  function publish() { onChange(getState()); }
  function configure(patch = {}) {
    if (typeof patch.enabled !== 'boolean' || !Number.isInteger(patch.intervalDays) || patch.intervalDays < 1 || patch.intervalDays > 365) throw Error('检查间隔须为 1 至 365 个自然天');
    save({ ...state, enabled: patch.enabled, intervalDays: patch.intervalDays }); publish(); return getState();
  }
  function due() {
    if (!state.enabled || storageError) return false;
    const today = calendarDay(now());
    return state.lastAttemptDay === null || today < state.lastAttemptDay || today - state.lastAttemptDay >= state.intervalDays;
  }
  async function check({ manual = false } = {}) {
    if (checking) { await checking; return getState(); }
    if (storageError) throw Error(storageError);
    if (!manual && !due()) return getState();
    if (state.retryAfter > now()) return getState();
    // Reserve the local calendar day before the request. A failed attempt is not retried all day.
    save({ ...state, lastAttemptDay: calendarDay(now()), lastAttemptAt: now(), error: '' });
    checking = Promise.resolve().then(async () => {
      const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
        if (state.etag) headers['If-None-Match'] = state.etag;
        // Public API only: never reuse the publishing bot or any personal credentials.
        const response = await fetchImpl(API_URL, { headers, credentials: 'omit', redirect: 'error', cache: 'no-store', signal: controller.signal });
        if (response.status === 304) {
          if (!state.release && !state.noRelease) { save({ ...state, etag: '' }); throw Error('更新缓存无效，请再次检查'); }
          save({ ...state, lastCheckedAt: now(), error: '', retryAfter: 0 });
        } else if (response.status === 404) {
          save({ ...state, release: null, noRelease: true, etag: '', lastCheckedAt: now(), error: '', retryAfter: 0 });
        } else {
          if ([403, 429].includes(response.status)) {
            const retrySeconds = Number(response.headers.get('retry-after'));
            const reset = Number(response.headers.get('x-ratelimit-reset')) * 1000;
            const retryAfter = Math.max(now() + (retrySeconds > 0 ? retrySeconds * 1000 : 60000), Number.isFinite(reset) ? reset : 0);
            save({ ...state, retryAfter });
            throw Error('GitHub API 暂时限制请求，请稍后再试');
          }
          if (!response.ok) throw Error(`GitHub 更新检查失败（HTTP ${response.status}）`);
          const release = normalizeRelease(await response.json());
          save({ ...state, release, noRelease: false, lastCheckedAt: now(), etag: response.headers.get('etag') || '', error: '', retryAfter: 0 });
        }
      } catch (error) {
        const message = controller.signal.aborted ? 'GitHub 更新检查超时，请稍后重试' : error.message || '无法连接 GitHub';
        save({ ...state, error: message });
      } finally { clearTimeout(timeout); }
      return getState();
    }).finally(() => { checking = null; publish(); });
    publish();
    await checking;
    return getState();
  }
  function dismiss(versionToDismiss) {
    if (versionToDismiss !== state.release?.version) throw Error('版本信息已变化，请刷新后重试');
    save({ ...state, dismissedVersion: versionToDismiss }); publish(); return getState();
  }
  return { getState, configure, check, dismiss, due };
}
function startUpdateChecks(service, { powerMonitor, setInterval: repeat = setInterval, clearInterval: clear = clearInterval } = {}) {
  let stopped = false;
  const tick = () => { if (!stopped) service.check().catch(() => {}); };
  const timer = repeat(tick, 60000); timer.unref?.(); powerMonitor?.on('resume', tick); tick();
  return () => { stopped = true; clear(timer); powerMonitor?.removeListener('resume', tick); };
}
function registerSoftwareUpdates({ ipcMain, app, BrowserWindow, powerMonitor, shell, ...options }) {
  const service = createSoftwareUpdates({ ...options, version: app.getVersion(), onChange: state => {
    for (const window of BrowserWindow.getAllWindows()) if (!window.isDestroyed()) window.webContents.send('software-update:changed', state);
  } });
  for (const [channel, invoke] of Object.entries({ state: () => service.getState(), configure: patch => service.configure(patch), check: () => service.check({ manual: true }), dismiss: version => service.dismiss(version),
    open: async () => { const state = service.getState(); if (!state.release) throw Error('尚无可打开的发布版本'); await shell.openExternal(state.release.url); return state; } })) {
    ipcMain.handle('software-update:' + channel, async (_event, value) => {
      try { return { success: true, state: await invoke(value) }; } catch (error) { return { success: false, error: error.message }; }
    });
  }
  let stop;
  app.whenReady().then(() => { stop = startUpdateChecks(service, { powerMonitor }); });
  app.on('before-quit', () => stop?.());
  return service;
}
module.exports = { createSoftwareUpdates, registerSoftwareUpdates, startUpdateChecks, newerVersion, calendarDay, API_URL };
