'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { extractMegaLinks } = require('./mega-revival.cjs');
const { mediaFile: normalizeMediaFile, mergeDetailFiles } = require('./archive-media.cjs');
const SOURCES = {
  pawchive: { id: 'pawchive', label: 'Pawchive', site: 'https://pawchive.pw', media: 'https://img.pawchive.pw', accept: 'application/json' },
  kemono: { id: 'kemono', label: 'Kemono', site: 'https://kemono.cr', media: 'https://img.kemono.cr', accept: 'text/css' }
};
const CACHE_TTL = 30 * 60 * 1000;
const PAGE_SIZE = 50;

function localDayKey(value) {
  if (!value) return '';
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function timestamp(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number' || /^\d+(\.\d+)?$/.test(String(value))) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? (number < 1e12 ? number * 1000 : number) : 0;
  }
  const text = String(value);
  // The API's naive ISO datetimes are UTC, not the user's local timezone.
  const parsed = Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text) ? text : text + 'Z');
  return Number.isFinite(parsed) ? parsed : 0;
}

function identity(value) {
  const service = String(value?.service || '').toLowerCase();
  const id = String(value?.id ?? value?.user ?? '');
  if (!/^[a-z0-9_-]{1,40}$/.test(service) || !id || id.length > 200 || /[\x00-\x20/\\?#]/.test(id) || ['.', '..'].includes(id)) {
    throw new Error('作者信息无效，请刷新后重试');
  }
  return { service, id };
}
const keyOf = value => { const { service, id } = identity(value); return JSON.stringify([service, id]); };
const creatorPath = value => { const { service, id } = identity(value); return `/${service}/user/${encodeURIComponent(id)}`; };

function normalizeArchiveCreator(value, source) {
  const ref = identity(value);
  return { ...ref, name: String(value.name || ref.id).slice(0, 300), updated: timestamp(value.updated),
    indexed: timestamp(value.indexed), favorited: Math.max(0, Number(value.favorited) || 0),
    url: source.site + creatorPath(ref), avatar: `${source.media}/icons/${ref.service}/${encodeURIComponent(ref.id)}` };
}

function mediaFile(value, source) {
  return normalizeMediaFile(value, source.id);
}

function normalizeArchivePost(value, directory, source) {
  const ref = identity({ service: value.service, id: value.user });
  const postId = identity({ service: ref.service, id: value.id }).id;
  const creator = directory.get(keyOf(ref)) || normalizeArchiveCreator(ref, source);
  const file = mediaFile(value.file, source);
  const attachments = Array.isArray(value.attachments) ? value.attachments.map(item => mediaFile(item, source)).filter(Boolean) : [];
  const images = [...new Map([file, ...attachments].filter(item => item?.thumbnail).map(item => [item.path, item])).values()];
  return { id: postId, user: ref.id, service: ref.service, creator,
    title: String(value.title || '无标题').slice(0, 1000), content: String(value.content || value.substring || '').slice(0, 200000),
    published: timestamp(value.published), edited: timestamp(value.edited), added: timestamp(value.added),
    file, attachments, images, thumbnail: images[0]?.thumbnail || '',
    megaLinks: extractMegaLinks([value.content, value.substring, value.embed?.url].filter(Boolean).join('\n')),
    previewOnly: value.has_full === false || value.preview_state === 'preview',
    url: source.site + creatorPath(ref) + '/post/' + encodeURIComponent(postId) };
}

function createPawchiveService({ userData, source: sourceId = 'pawchive', fetch: fetchImpl = globalThis.fetch, now = Date.now, onProgress = () => {}, onStateChanged = () => {} }) {
  if (!Object.hasOwn(SOURCES, sourceId)) throw new Error('不支持的 MOD 来源');
  const source = SOURCES[sourceId];
  const SITE = source.site, API = SITE + '/api/v1';
  const normalizeCreator = value => normalizeArchiveCreator(value, source);
  const normalizePost = (value, directory) => normalizeArchivePost(value, directory, source);
  const stateFile = path.join(userData, sourceId + '-favorites.json');
  const cacheFile = path.join(userData, sourceId + '-creators-cache.json');
  let state;
  let directory;
  let directoryTime = 0;
  let directoryRequest;
  let checking;
  const favoriteRequests = new Map();

  function readState() {
    if (state) return state;
    if (!fs.existsSync(stateFile)) return state = { version: 2, favorites: [], lastCheckedAt: 0 };
    try {
      const saved = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
      if (![1, 2].includes(saved.version) || !Array.isArray(saved.favorites)) throw new Error('Invalid state');
      const seen = new Set();
      const favorites = saved.favorites.map(item => {
        const author = normalizeCreator(item);
        const key = keyOf(author);
        if (seen.has(key)) throw new Error('Duplicate author');
        seen.add(key);
        if (saved.version === 2 && (!Array.isArray(item.snapshot) || !Array.isArray(item.changes))) throw new Error('Invalid snapshot');
        return { ...author, addedAt: timestamp(item.addedAt), checkedAt: timestamp(item.checkedAt),
          snapshot: item.snapshot || [], changes: item.changes || [], snapshotReady: item.snapshotReady === true, missing: item.missing === true };
      });
      return state = { version: 2, favorites, lastCheckedAt: timestamp(saved.lastCheckedAt),
        lastAutoCheckDay: String(saved.lastAutoCheckDay || ''), lastAutoCheckAt: timestamp(saved.lastAutoCheckAt),
        autoCheckError: String(saved.autoCheckError || '') };
    } catch {
      throw new Error(`${source.label} 收藏文件无法读取，原文件已保留：` + stateFile);
    }
  }

  function atomicWrite(file, value) {
    fs.mkdirSync(userData, { recursive: true });
    const temporary = file + '.tmp';
    try {
      fs.writeFileSync(temporary, JSON.stringify(value));
      fs.renameSync(temporary, file);
    } finally {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
  }

  function save(next) {
    atomicWrite(stateFile, next);
    state = next;
  }

  function getState() {
    const saved = readState();
    const favorites = saved.favorites.map(({ snapshot, changes, ...item }) => ({ ...item, unread: changes.length > 0,
      changesCount: changes.length, newCount: changes.filter(change => change.changeKind === 'new').length,
      editedCount: changes.filter(change => change.changeKind === 'edited').length, readToken: readToken(changes) }));
    return { favorites, lastCheckedAt: saved.lastCheckedAt, updateCount: favorites.filter(item => item.unread).length,
      postUpdateCount: favorites.reduce((count, item) => count + item.changesCount, 0), checking: !!checking,
      lastAutoCheckDay: saved.lastAutoCheckDay || '', lastAutoCheckAt: saved.lastAutoCheckAt || 0, autoCheckError: saved.autoCheckError || '' };
  }
  function publishState() { onStateChanged(getState()); }

  const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
  const readToken = changes => digest(changes.map(item => [item.id, item.changeToken]));

  async function request(endpoint) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetchImpl(API + endpoint, { headers: { Accept: source.accept },
        signal: controller.signal, cache: 'no-store', credentials: 'omit', redirect: 'error' });
      if (!response.ok) {
        const messages = { 401: `此内容需要在 ${source.label} 网站登录后查看`, 403: `${source.label} 暂时拒绝访问，请稍后重试或打开网站`,
          404: `${source.label} 上未找到该作者或内容`, 429: `${source.label} 请求过于频繁，请稍后重试` };
        const error = new Error(messages[response.status] || `${source.label} 请求失败（HTTP ${response.status}）`);
        error.status = response.status;
        throw error;
      }
      const contentType = response.headers.get('content-type') || '';
      // Kemono's official frontend requests and receives JSON as text/css.
      if (!contentType.includes('json') && !(sourceId === 'kemono' && contentType.includes('text/css'))) throw new Error(`${source.label} 返回了非 JSON 内容，请稍后重试`);
      const data = await response.json();
      if (!data || typeof data !== 'object') throw new Error(`${source.label} 数据格式不正确`);
      return data;
    } catch (error) {
      if (controller.signal.aborted) throw new Error(`${source.label} 请求超时，请检查网络后重试`);
      if (/fetch failed|net::|Failed to fetch|NetworkError/i.test(error.message)) throw new Error(`无法连接 ${source.label}，请检查网络后重试`);
      throw error;
    } finally { clearTimeout(timer); }
  }

  function makeDirectory(items) {
    if (!Array.isArray(items) || items.length === 0) throw new Error(`${source.label} 作者列表为空或格式不正确，请稍后重试`);
    const result = new Map();
    for (const item of items) {
      try { const creator = normalizeCreator(item); result.set(keyOf(creator), creator); } catch { /* Skip invalid API entries. */ }
    }
    if (!result.size) throw new Error(`${source.label} 作者列表格式不正确`);
    return result;
  }

  function loadDirectoryCache() {
    if (directory) return;
    try {
      const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      directory = makeDirectory(cache.creators);
      directoryTime = timestamp(cache.savedAt);
    } catch { /* Disposable cache; the favorites file is handled separately. */ }
  }

  async function creators(force = false, allowStale = true) {
    loadDirectoryCache();
    if (!force && directory && now() - directoryTime < CACHE_TTL) return { items: directory, cachedAt: directoryTime };
    if (!directoryRequest) {
      directoryRequest = (async () => {
        // The current Kemono frontend uses /creators; the documented .txt alias returns 404.
        const items = makeDirectory(await request('/creators'));
        const savedAt = now();
        // Cache writes may fail on a read-only disk without discarding a valid API response.
        let warning = '';
        try { atomicWrite(cacheFile, { savedAt, creators: [...items.values()] }); }
        catch { warning = '作者列表已加载，但无法保存离线缓存'; }
        directory = items;
        directoryTime = savedAt;
        return { items, cachedAt: savedAt, warning };
      })().finally(() => { directoryRequest = null; });
    }
    try { return await directoryRequest; }
    catch (error) {
      if (allowStale && directory) return { items: directory, cachedAt: directoryTime, stale: true, warning: error.message + '；当前显示本地缓存' };
      throw error;
    }
  }

  async function listCreators(options = {}) {
    const query = String(options.query || '').trim().toLocaleLowerCase();
    const saved = getState();
    let result = { items: new Map(saved.favorites.map(item => [keyOf(item), item])) };
    if (!options.favoritesOnly) result = await creators(options.force === true);
    const favorites = new Map(saved.favorites.map(item => [keyOf(item), item]));
    let items = [...result.items.values()].map(item => ({ ...item, favorite: favorites.has(keyOf(item)),
      unread: favorites.get(keyOf(item))?.unread || false, missing: favorites.get(keyOf(item))?.missing || false }));
    const services = [...new Set(items.map(item => item.service))].sort();
    items = items.filter(item => (!query || `${item.name} ${item.id}`.toLocaleLowerCase().includes(query)) &&
      (!options.service || item.service === options.service) && (!options.unreadOnly || item.unread));
    items.sort(options.sort === 'name' ? (a, b) => a.name.localeCompare(b.name, 'zh') :
      options.sort === 'popular' ? (a, b) => b.favorited - a.favorited || b.updated - a.updated :
      (a, b) => b.updated - a.updated || a.name.localeCompare(b.name));
    const requested = Math.max(0, Math.floor(Number(options.offset) || 0));
    const offset = Math.min(requested, Math.max(0, Math.ceil(items.length / 24) - 1) * 24);
    return { items: items.slice(offset, offset + 24), total: items.length, offset, pageSize: 24,
      hasMore: offset + 24 < items.length, services, stale: !!result.stale, warning: result.warning || '', cachedAt: result.cachedAt || 0 };
  }

  async function listPosts(options = {}) {
    const offset = Math.max(0, Math.floor((Number(options.offset) || 0) / PAGE_SIZE) * PAGE_SIZE);
    const query = String(options.query || '').trim().slice(0, 200);
    if (query && [...query].length < 3) throw new Error('内容搜索需要至少 3 个字符；可切换到“作者”按名称搜索');
    const params = new URLSearchParams({ o: String(offset) });
    if (query) params.set('q', query);
    const endpoint = options.creator ? creatorPath(options.creator) + (sourceId === 'kemono' ? '/posts' : '') : '/posts';
    const [data, authorsResult] = await Promise.all([request(endpoint + '?' + params), creators().catch(error => ({ warning: error.message }))]);
    const posts = Array.isArray(data) ? data : data.posts || data.results;
    if (!Array.isArray(posts)) throw new Error(`${source.label} 内容列表格式不正确`);
    loadDirectoryCache();
    const authors = directory || new Map(readState().favorites.map(item => [keyOf(item), item]));
    return { items: posts.map(item => normalizePost(item, authors)), offset, pageSize: PAGE_SIZE, hasMore: posts.length === PAGE_SIZE,
      warning: authorsResult.warning || '', cachedAt: authorsResult.cachedAt || 0 };
  }

  async function getPost(ref) {
    const creator = identity({ service: ref?.service, id: ref?.user });
    const id = identity({ service: creator.service, id: ref?.id }).id;
    const data = await request(creatorPath(creator) + '/post/' + encodeURIComponent(id));
    const post = data.post ? mergeDetailFiles(data.post, data) : data;
    loadDirectoryCache();
    return { post: normalizePost(post, directory || new Map()) };
  }

  async function setFavorite(payload) {
    const ref = identity(payload?.creator);
    const key = keyOf(ref);
    if (typeof payload.favorite !== 'boolean') throw new Error('收藏操作无效');
    if (favoriteRequests.has(key)) throw new Error('正在保存该作者的收藏，请稍后再试');
    const operation = (async () => {
      const current = readState();
      const existing = current.favorites.find(item => keyOf(item) === key);
      if (payload.favorite && !existing) {
        loadDirectoryCache();
        const author = directory?.get(key) || normalizeCreator(await request(creatorPath(ref) + '/profile'));
        if (keyOf(author) !== key) throw new Error(`${source.label} 返回了不匹配的作者信息`);
        // Establish a complete baseline at favorite time, so old posts are not reported as new.
        const snapshot = await scanPosts(author, { operation: 'favorite', completedAuthors: 0, totalAuthors: 1 });
        const latest = readState();
        save({ ...latest, favorites: [...latest.favorites, { ...author, snapshot, changes: [], snapshotReady: true, addedAt: now(), checkedAt: now(), missing: false }] });
      } else if (!payload.favorite && existing) {
        save({ ...current, favorites: current.favorites.filter(item => keyOf(item) !== key) });
      }
      return getState();
    })();
    favoriteRequests.set(key, operation);
    try { return await operation; } finally { favoriteRequests.delete(key); }
  }

  function markRead(payload) {
    const key = keyOf(payload?.creator);
    const saved = readState();
    // A stale UI can acknowledge only the changes it actually displayed.
    save({ ...saved, favorites: saved.favorites.map(item => {
      if (keyOf(item) !== key) return item;
      const changes = payload.postId ? item.changes.filter(change => change.id !== payload.postId || change.changeToken !== payload.token) :
        payload.token === readToken(item.changes) ? [] : item.changes;
      return { ...item, changes };
    }) });
    return getState();
  }

  async function scanPosts(author, progress) {
    const posts = new Map();
    // Scan every page: an edited old post need not move to the first page.
    for (let page = 0; page < 2000; page++) {
      const response = await request(creatorPath(author) + (sourceId === 'kemono' ? '/posts' : '') + '?o=' + page * PAGE_SIZE);
      const data = Array.isArray(response) ? response : response.posts || response.results;
      if (!Array.isArray(data)) throw new Error(`${source.label} 内容列表格式不正确`);
      const size = posts.size;
      for (const raw of data) {
        const post = normalizePost(raw, new Map([[keyOf(author), author]]));
        if (post.service !== author.service || post.user !== author.id) throw new Error(`${source.label} 返回了不匹配的作者内容`);
        const revision = digest([String(raw.title || ''), String(raw.content || raw.substring || ''), post.file?.path, post.file?.name,
          post.attachments.map(file => [file.path, file.name]).sort((a, b) => a[0].localeCompare(b[0]))]);
        posts.set(post.id, { id: post.id, title: post.title, published: post.published, edited: post.edited,
          added: post.added, revision, thumbnail: post.thumbnail, previewOnly: post.previewOnly });
      }
      onProgress({ ...progress, author: author.name, pages: page + 1, posts: posts.size });
      if (data.length < PAGE_SIZE) return [...posts.values()];
      if (posts.size === size) throw new Error(`${source.label} 返回了重复分页，本次检查未完成，请稍后重试`);
    }
    throw new Error('作者内容超过单次检查上限，本次未完成，已保留上次记录');
  }

  function getUpdates(options = {}) {
    const query = String(options.query || '').trim().toLocaleLowerCase();
    const all = readState().favorites.flatMap(author => author.changes.map(change => ({ ...change,
      creator: normalizeCreator(author), user: author.id, service: author.service, content: '', attachments: [], file: null,
      url: SITE + creatorPath(author) + '/post/' + encodeURIComponent(change.id) })));
    const services = [...new Set(all.map(post => post.service))].sort();
    const items = all.filter(post => (!query || `${post.title} ${post.creator.name}`.toLocaleLowerCase().includes(query)) &&
      (!options.service || options.service === post.service)).sort((a, b) => b.detectedAt - a.detectedAt || b.edited - a.edited || b.published - a.published);
    const offset = Math.min(Math.max(0, Math.floor(Number(options.offset) || 0)), Math.max(0, Math.ceil(items.length / 24) - 1) * 24);
    return { items: items.slice(offset, offset + 24), total: items.length, offset, pageSize: 24, hasMore: offset + 24 < items.length, services };
  }

  async function checkUpdates() {
    if (checking) return checking;
    if (!readState().favorites.length) return { ...getState(), checked: 0, total: 0, failures: [], baselines: 0 };
    checking = (async () => {
      const targets = [...readState().favorites];
      const failures = [];
      let checked = 0, baselines = 0, next = 0, completed = 0;
      async function worker() {
        while (next < targets.length) {
          const target = targets[next++];
          const key = keyOf(target);
          try {
            const snapshot = await scanPosts(target, { operation: 'check', completedAuthors: completed, totalAuthors: targets.length });
            const current = readState();
            const author = current.favorites.find(item => keyOf(item) === key);
            // Do not restore an author removed (or removed and re-added) during the check.
            if (!author || author.addedAt !== target.addedAt) continue;
            const known = new Map(author.snapshot.map(item => [item.id, item]));
            const changes = new Map(author.changes.map(item => [item.id, item]));
            const checkedAt = now();
            for (const post of snapshot) {
              const previous = known.get(post.id);
              const kind = !previous ? 'new' : post.edited > previous.edited || post.revision !== previous.revision ? 'edited' : '';
              if (author.snapshotReady && kind) {
                const existing = changes.get(post.id);
                changes.set(post.id, { ...post, changeKind: existing?.changeKind === 'new' ? 'new' : kind,
                  detectedAt: checkedAt, changeToken: digest([post.id, post.edited, post.revision]) });
              }
              known.set(post.id, post);
            }
            if (!author.snapshotReady) baselines++;
            const updated = snapshot.reduce((value, post) => Math.max(value, post.added, post.edited, post.published), author.updated);
            const replacement = { ...author, snapshot: [...known.values()], changes: [...changes.values()], snapshotReady: true,
              updated, checkedAt, missing: false };
            save({ ...current, favorites: current.favorites.map(item => keyOf(item) === key ? replacement : item) });
            checked++;
          } catch (error) { failures.push({ creator: normalizeCreator(target), error: error.message }); }
          finally { completed++; onProgress({ operation: 'check', completedAuthors: completed, totalAuthors: targets.length, author: target.name, done: true }); }
        }
      }
      await Promise.all([worker(), worker()]);
      if (!failures.length) save({ ...readState(), lastCheckedAt: now(), autoCheckError: '' });
      return { ...getState(), checking: false, checked, total: targets.length, failures, baselines };
    })().finally(() => { checking = null; publishState(); });
    publishState();
    return checking;
  }

  async function checkDaily() {
    const saved = readState();
    if (!saved.favorites.length) return { skipped: 'no-favorites' };
    const day = localDayKey(now());
    if (saved.lastAutoCheckDay === day || localDayKey(saved.lastCheckedAt) === day) return { skipped: 'already-checked' };
    if (checking) return { skipped: 'checking' };
    // Reserve the local calendar date before I/O; restarts and failed requests do not repeat it.
    save({ ...saved, lastAutoCheckDay: day, lastAutoCheckAt: now(), autoCheckError: '' });
    try {
      const result = await checkUpdates();
      if (result.failures.length) {
        save({ ...readState(), autoCheckError: `今日自动检查未完成：${result.failures.map(item => `${item.creator.name}：${item.error}`).join('；')}。可手动重试，上次记录已保留。` });
      }
      return result;
    } catch (error) {
      save({ ...readState(), autoCheckError: '今日自动检查失败：' + error.message + '。可手动重试，上次记录已保留。' });
      throw error;
    } finally { publishState(); }
  }

  return { getState, listCreators, listPosts, getPost, setFavorite, markRead, checkUpdates, checkDaily, getUpdates };
}

function startDailyChecks(service, { powerMonitor, setInterval: repeat = setInterval, clearInterval: clear = clearInterval, onError = () => {} } = {}) {
  let stopped = false, busy = false;
  async function tick() {
    if (stopped || busy) return;
    busy = true;
    try { await service.checkDaily(); } catch (error) { onError(error); } finally { busy = false; }
  }
  // Rechecking the local date handles midnight, sleep/wake and timezone/clock changes.
  const timer = repeat(tick, 60000);
  timer.unref?.();
  powerMonitor?.on('resume', tick);
  tick();
  return () => { stopped = true; clear(timer); powerMonitor?.removeListener('resume', tick); };
}

function registerPawchiveIpc({ ipcMain, app, BrowserWindow, powerMonitor, source = 'pawchive', ...options }) {
  const subscribers = new Map();
  function broadcast(channel, value) {
    const senders = new Set([...subscribers.keys(), ...(BrowserWindow?.getAllWindows() || []).filter(window => !window.isDestroyed()).map(window => window.webContents)]);
    for (const sender of senders) if (!sender.isDestroyed()) sender.send(channel, value);
  }
  const service = createPawchiveService({ ...options, source, onProgress: progress => broadcast(source + ':progress', progress),
    onStateChanged: state => broadcast(source + ':state-changed', state) });
  const methods = { 'get-state': 'getState', 'list-creators': 'listCreators', 'list-posts': 'listPosts',
    'get-post': 'getPost', 'set-favorite': 'setFavorite', 'mark-read': 'markRead', 'check-updates': 'checkUpdates', 'get-updates': 'getUpdates' };
  for (const [channel, method] of Object.entries(methods)) {
    ipcMain.handle(source + ':' + channel, async (event, payload) => {
      if (event.sender) subscribers.set(event.sender, (subscribers.get(event.sender) || 0) + 1);
      try { return { success: true, ...await service[method](payload) }; }
      catch (error) { return { success: false, error: error.message || SOURCES[source].label + ' 操作失败，请重试' }; }
      finally {
        if (event.sender) {
          const remaining = (subscribers.get(event.sender) || 1) - 1;
          if (remaining) subscribers.set(event.sender, remaining); else subscribers.delete(event.sender);
        }
      }
    });
  }
  if (app) {
    let stop;
    app.whenReady().then(() => { stop = startDailyChecks(service, { powerMonitor, onError: error => broadcast(source + ':state-changed', { error: error.message }) }); });
    app.on('before-quit', () => stop?.());
  }
  return service;
}

module.exports = { createPawchiveService, registerPawchiveIpc, startDailyChecks, localDayKey, timestamp };
