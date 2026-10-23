'use strict';

const i18n = require("../../../shared/i18n/core.cjs");
const path = require('node:path');
const {
  readJsonFileSync,
  writeJsonFileSync
} = require("../../core/json-store.cjs");
const {
  siteDefinition,
  siteUrl,
  safeWebUrl,
  resolveSite
} = require("./definitions.cjs");
const {
  parseSiteDocument,
  createParserMessages
} = require("./parsers.cjs");
const {
  allowedFileUrl
} = require("../archive-media.cjs");
const {
  inspectVerificationDocument,
  canFinishVerification,
  sameDocument
} = require("./verification.cjs");
function standardChromeUserAgent(value) {
  const version = String(value).match(/Chrome\/([\d.]+)/)?.[1];
  if (!version) throw Error(i18n.t("backend.siteSessions.chromiumVersionUnknown"));
  return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36`;
}
function createSiteSessions({
  app,
  session,
  BrowserView,
  userData,
  onDownload = () => false,
  onChanged = () => {}
}) {
  const settingsFile = path.join(userData, 'mod-site-sections.json');
  const runtimeFile = path.join(userData, 'mod-site-runtime.json');
  const sessions = new Map(),
    views = new Map(),
    allowedLinks = new Map(),
    queues = new Map(),
    mediaCache = new Map();
  const sessionReady = new Map();
  let runtimeVersions = {};
  try {
    runtimeVersions = readJsonFileSync(runtimeFile);
  } catch {/* Disposable compatibility marker, no account data. */}
  if (!runtimeVersions || typeof runtimeVersions !== 'object' || Array.isArray(runtimeVersions)) runtimeVersions = {};
  let overrides = {},
    settingsError = '',
    parserView,
    embedded;
  try {
    overrides = readJsonFileSync(settingsFile);
    if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) throw Error(i18n.t("backend.siteSessions.invalidSections"));
  } catch (error) {
    if (error.code !== 'ENOENT') settingsError = i18n.t("backend.siteSessions.settingsReadFailed");
    overrides = {};
  }
  function getSession(source) {
    siteDefinition(source);
    if (sessions.has(source)) return sessions.get(source);
    const value = session.fromPartition('persist:mod-site-' + source);
    // Report this runtime's Chromium version, never the version of another installed browser.
    value.setUserAgent(standardChromeUserAgent(value.getUserAgent()));
    const version = value.getUserAgent().match(/Chrome\/([\d.]+)/)[1];
    const ready = (async () => {
      if (runtimeVersions[source] === version) return;
      // Clearance from a different UA/runtime is invalid. Preserve every account cookie.
      for (const name of ['cf_clearance', '__cf_bm']) for (const cookie of await value.cookies.get({
        name
      })) {
        await value.cookies.remove(`https://${cookie.domain.replace(/^\./, '')}${cookie.path || '/'}`, name);
      }
      runtimeVersions[source] = version;
      writeJsonFileSync(runtimeFile, runtimeVersions);
    })();
    sessionReady.set(source, ready);
    ready.catch(() => {});
    value.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    value.setPermissionCheckHandler(() => false);
    value.cookies.on('changed', () => onChanged({
      source
    }));
    value.on('will-download', (event, item, contents) => {
      const entry = views.get(source);
      if (contents !== entry?.view.webContents || !/\.(zip|rar|7z|ini|pak|mp4)$/i.test(item.getFilename())) {
        event.preventDefault();
        return;
      }
      try {
        if (!onDownload({
          source,
          gameId: entry.gameId,
          sourceUrl: resolveSite(source, entry.gameId, overrides).url,
          item
        })) event.preventDefault();
      } catch {
        event.preventDefault();
        onChanged({
          source,
          error: i18n.t("backend.siteSessions.createDownloadFailed")
        });
      }
    });
    sessions.set(source, value);
    return value;
  }
  function preferences(source) {
    return {
      ...(source ? {
        session: getSession(source)
      } : {
        partition: 'mod-site-parser'
      }),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      webviewTag: false,
      allowRunningInsecureContent: false,
      navigateOnDragDrop: false,
      safeDialogs: true,
      backgroundThrottling: false
    };
  }
  function getView(source) {
    let entry = views.get(source);
    if (entry && !entry.view.webContents.isDestroyed()) return entry;
    const view = new BrowserView({
      webPreferences: preferences(source)
    });
    view.setBounds({
      x: 0,
      y: 0,
      width: 1100,
      height: 760
    });
    entry = {
      source,
      view,
      gameId: '',
      status: 0
    };
    views.set(source, entry);
    const contents = view.webContents;
    contents.setUserAgent(getSession(source).getUserAgent());
    const navigation = (event, url) => {
      if (!safeWebUrl(url)) event.preventDefault();
    };
    contents.on('will-navigate', navigation);
    contents.on('will-redirect', navigation);
    contents.on('will-attach-webview', event => event.preventDefault());
    contents.setWindowOpenHandler(({
      url
    }) => {
      if (safeWebUrl(url)) contents.loadURL(url).catch(() => {});
      return {
        action: 'deny'
      };
    });
    contents.on('did-navigate', (_event, url, status) => {
      entry.status = status;
      onChanged({
        source,
        navigation: true,
        host: safeWebUrl(url) ? new URL(url).host : '',
        status
      });
    });
    contents.on('did-finish-load', async () => {
      try {
        const state = await contents.executeJavaScriptInIsolatedWorld(1001, [{
          code: `(${inspectVerificationDocument.toString()})()`
        }]);
        onChanged({
          source,
          loaded: true,
          status: entry.status,
          challenge: state.challenge
        });
      } catch {/* A challenge may navigate before the inspection finishes. */}
    });
    contents.on('did-fail-load', (_event, code, _description, _url, isMainFrame) => {
      if (isMainFrame && code !== -3 && embedded?.source === source) onChanged({
        source,
        error: i18n.t("backend.siteSessions.verificationLoadFailed")
      });
    });
    return entry;
  }
  function rememberLinks(source, gameId, urls) {
    const key = source + ':' + gameId,
      links = allowedLinks.get(key) || new Set();
    for (const url of urls) if (safeWebUrl(url)) links.add(url);
    while (links.size > 2000) links.delete(links.values().next().value);
    allowedLinks.set(key, links);
  }
  async function describe({
    source,
    gameId
  } = {}) {
    await app.whenReady();
    const value = getSession(source);
    await sessionReady.get(source);
    const cookies = await value.cookies.get({});
    return {
      site: resolveSite(source, gameId, overrides),
      hasSession: cookies.length > 0,
      warning: settingsError
    };
  }
  function detach() {
    if (!embedded) return;
    if (!embedded.owner.isDestroyed()) embedded.owner.removeBrowserView(embedded.view);
    embedded = null;
  }
  async function open({
    source,
    gameId,
    url,
    token,
    bounds
  }, owner) {
    await app.whenReady();
    getSession(source);
    await sessionReady.get(source);
    const target = url || resolveSite(source, gameId, overrides).url;
    if (!siteUrl(target, source) && !allowedLinks.get(source + ':' + gameId)?.has(target)) throw Error(i18n.t("backend.siteSessions.unknownContentLink"));
    if (!owner || owner.isDestroyed() || !token) throw Error(i18n.t("backend.siteSessions.verifyInDownloadPage"));
    const entry = getView(source);
    entry.gameId = gameId;
    detach();
    embedded = {
      source,
      gameId,
      token,
      owner,
      view: entry.view
    };
    resize({
      source,
      token,
      bounds
    }, owner);
    if (!entry.view.webContents.getURL() || entry.requestedUrl !== target && entry.view.webContents.getURL() !== target) {
      entry.requestedUrl = target;
      entry.view.webContents.loadURL(target).catch(() => {});
    }
    return {
      host: new URL(target).host
    };
  }
  function resize({
    source,
    token,
    bounds,
    visible = true
  }, owner) {
    if (!embedded || embedded.source !== source || embedded.token !== token || embedded.owner !== owner) return {};
    const {
        view
      } = embedded,
      size = owner.getContentSize(),
      scale = owner.webContents.getZoomFactor();
    const numbers = ['x', 'y', 'width', 'height'].map(key => Number(bounds?.[key]));
    if (!visible || !numbers.every(Number.isFinite)) {
      owner.removeBrowserView(view);
      return {};
    }
    const x = Math.max(0, Math.min(size[0], Math.round(numbers[0] * scale)));
    const y = Math.max(0, Math.min(size[1], Math.round(numbers[1] * scale)));
    const width = Math.max(0, Math.min(size[0] - x, Math.round(numbers[2] * scale)));
    const height = Math.max(0, Math.min(size[1] - y, Math.round(numbers[3] * scale)));
    if (!width || !height) owner.removeBrowserView(view);else {
      if (!owner.getBrowserViews().includes(view)) owner.addBrowserView(view);
      view.setBounds({
        x,
        y,
        width,
        height
      });
    }
    return {};
  }
  function hide({
    token
  } = {}, owner) {
    if (embedded && embedded.token === token && embedded.owner === owner) detach();
    return {};
  }
  async function reload({
    source,
    token
  }, owner) {
    if (embedded?.token !== token || embedded.owner !== owner || embedded.source !== source) throw Error(i18n.t("backend.siteSessions.verificationWindowClosed"));
    embedded.view.webContents.reload();
    return {};
  }
  async function finish({
    source,
    token
  }, owner) {
    if (!embedded || embedded.source !== source || embedded.token !== token || embedded.owner !== owner) throw Error(i18n.t("backend.siteSessions.verificationWindowClosed"));
    const entry = views.get(source),
      contents = entry.view.webContents;
    let state;
    try {
      state = await contents.executeJavaScriptInIsolatedWorld(1001, [{
        code: `(${inspectVerificationDocument.toString()})()`
      }]);
    } catch {
      throw Error(i18n.t("backend.siteSessions.verificationNavigating"));
    }
    if (!canFinishVerification({
      ...state,
      status: entry.status
    })) throw Error(i18n.t("backend.siteSessions.verificationIncomplete"));
    entry.verified = {
      requestedUrl: entry.requestedUrl,
      html: state.html,
      url: contents.getURL(),
      status: entry.status,
      at: Date.now()
    };
    await getSession(source).cookies.flushStore();
    detach();
    return {};
  }
  function verifiedPage(source, url) {
    const entry = views.get(source),
      saved = entry?.verified;
    if (!saved || Date.now() - saved.at > 30000 || !siteUrl(saved.url, source) || !sameDocument(saved.requestedUrl, url) || !sameDocument(saved.url, url)) return null;
    entry.verified = null;
    return {
      html: saved.html,
      url: saved.url,
      status: saved.status
    };
  }
  async function page(source, url, gameId) {
    if (!siteUrl(url, source)) throw Error(i18n.t("backend.siteSessions.invalidPageUrl"));
    await app.whenReady();
    getSession(source);
    await sessionReady.get(source);
    const verified = verifiedPage(source, url);
    if (verified) return verified;
    const previous = queues.get(source) || Promise.resolve();
    const operation = previous.catch(() => {}).then(async () => {
      if (embedded?.source === source) throw Object.assign(Error(i18n.t("backend.siteSessions.completeVerificationFirst")), {
        code: 'VERIFY_REQUIRED',
        verifyUrl: url
      });
      const entry = getView(source);
      entry.gameId = gameId;
      entry.requestedUrl = url;
      let timer;
      try {
        await Promise.race([entry.view.webContents.loadURL(url), new Promise((_, reject) => {
          timer = setTimeout(() => {
            entry.view.webContents.stop();
            reject(Error(i18n.t("backend.siteSessions.pageTimedOut")));
          }, 25000);
        })]);
      } finally {
        clearTimeout(timer);
      }
      const html = await entry.view.webContents.executeJavaScriptInIsolatedWorld(1001, [{
        code: 'document.documentElement.outerHTML.slice(0, 6000000)'
      }]);
      return {
        html,
        url: entry.view.webContents.getURL(),
        status: entry.status
      };
    });
    queues.set(source, operation);
    return operation;
  }
  async function parse(payload) {
    await app.whenReady();
    if (!parserView || parserView.webContents.isDestroyed()) {
      parserView = new BrowserView({
        webPreferences: preferences()
      });
      await parserView.webContents.loadURL('about:blank');
    }
    return parserView.webContents.executeJavaScriptInIsolatedWorld(1001, [{
      code: `(${parseSiteDocument.toString()})(${JSON.stringify({ ...payload, messages: createParserMessages(payload.status) })})`
    }]);
  }
  async function clear({
    source,
    gameId
  } = {}) {
    await app.whenReady();
    if (embedded?.source === source) detach();
    for (const key of mediaCache.keys()) if (key.startsWith(source + ':')) mediaCache.delete(key);
    const entry = views.get(source);
    if (entry) {
      entry.view.webContents.destroy();
      views.delete(source);
    }
    const value = getSession(source);
    await value.clearStorageData();
    await value.clearCache();
    await value.clearAuthCache();
    value.flushStorageData();
    onChanged({
      source
    });
    return describe({
      source,
      gameId
    });
  }
  async function configure({
    source,
    gameId,
    url
  } = {}) {
    if (settingsError) throw Error(settingsError);
    siteDefinition(source);
    if (typeof gameId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(gameId) || ['__proto__', 'constructor', 'prototype'].includes(gameId)) throw Error(i18n.t("backend.siteSessions.invalidGameId"));
    url = String(url || '').trim();
    if (url && (!siteUrl(url, source) || url.length > 2000)) throw Error(i18n.t("backend.siteSessions.httpsSectionRequired"));
    const next = {
      ...overrides,
      [source]: {
        ...overrides[source]
      }
    };
    if (url) next[source][gameId] = url;else delete next[source][gameId];
    writeJsonFileSync(settingsFile, next);
    overrides = next;
    return describe({
      source,
      gameId
    });
  }
  async function fetch(source, url, options) {
    await app.whenReady();
    if (!siteUrl(url, source) && !allowedFileUrl(url, source)) throw Error(i18n.t("backend.siteSessions.invalidDownloadUrl"));
    const value = getSession(source),
      headers = new Headers(options?.headers || {});
    await sessionReady.get(source);
    if (embedded?.source === source) throw Object.assign(Error(i18n.t("backend.siteSessions.verifyCurrentPageFirst")), {
      code: 'VERIFY_REQUIRED',
      verifyUrl: url
    });
    headers.set('User-Agent', value.getUserAgent());
    return value.fetch(url, {
      ...options,
      headers,
      credentials: 'include'
    });
  }
  async function media({
    source,
    gameId,
    url
  }) {
    if (!allowedLinks.get(source + ':' + gameId)?.has(url)) throw Error(i18n.t("backend.siteSessions.unknownImage"));
    const key = source + ':' + url;
    if (!mediaCache.has(key)) {
      const promise = (async () => {
        const value = getSession(source),
          controller = new AbortController(),
          timer = setTimeout(() => controller.abort(), 25000);
        try {
          await sessionReady.get(source);
          if (embedded?.source === source) throw Error(i18n.t("backend.siteSessions.imageVerificationPending"));
          const response = await value.fetch(url, {
            credentials: 'include',
            signal: controller.signal,
            headers: {
              'User-Agent': value.getUserAgent(),
              Referer: siteDefinition(source).home
            }
          });
          const mime = (response.headers.get('content-type') || '').split(';')[0];
          if (!response.ok || !/^image\/(png|jpeg|gif|webp|avif|bmp|svg\+xml)$/i.test(mime)) throw Error(i18n.t("backend.siteSessions.imageUnavailable"));
          const reader = response.body.getReader(),
            chunks = [];
          let total = 0;
          while (true) {
            const part = await reader.read();
            if (part.done) break;
            total += part.value.length;
            if (total > 8 * 1024 * 1024) {
              await reader.cancel();
              throw Error(i18n.t("backend.siteSessions.imageTooLarge"));
            }
            chunks.push(Buffer.from(part.value));
          }
          return {
            dataUrl: `data:${mime};base64,${Buffer.concat(chunks).toString('base64')}`
          };
        } finally {
          clearTimeout(timer);
        }
      })();
      mediaCache.set(key, promise);
      promise.catch(() => mediaCache.delete(key));
      while (mediaCache.size > 24) mediaCache.delete(mediaCache.keys().next().value);
    }
    return mediaCache.get(key);
  }
  const setGame = async () => detach();
  app.on('before-quit', () => {
    detach();
    for (const entry of views.values()) if (!entry.view.webContents.isDestroyed()) entry.view.webContents.destroy();
    if (parserView && !parserView.webContents.isDestroyed()) parserView.webContents.destroy();
  });
  return {
    describe,
    open,
    resize,
    hide,
    reload,
    finish,
    verifiedPage,
    setContext: describe,
    setGame,
    clear,
    configure,
    fetch,
    page,
    parse,
    media,
    rememberLinks
  };
}
function registerSiteSessions({
  ipcMain,
  BrowserWindow,
  ...options
}) {
  const service = createSiteSessions({
    ...options,
    onChanged: payload => {
      for (const window of BrowserWindow.getAllWindows()) if (!window.isDestroyed()) window.webContents.send('mod-sites:changed', payload);
    }
  });
  for (const method of ['describe', 'open', 'resize', 'hide', 'reload', 'finish', 'setContext', 'clear', 'configure', 'media']) ipcMain.handle('mod-sites:' + method, async (event, payload) => {
    try {
      const owner = BrowserWindow.fromWebContents(event.sender);
      if (!owner || !event.sender.getURL().startsWith('file:')) throw Error(i18n.t("backend.siteSessions.invalidSource"));
      return {
        success: true,
        ...(await service[method](payload, owner))
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || i18n.t("backend.siteSessions.operationFailed")
      };
    }
  });
  return service;
}
module.exports = {
  createSiteSessions,
  registerSiteSessions,
  standardChromeUserAgent
};
