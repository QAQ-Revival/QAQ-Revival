'use strict';

const i18n = require("../../../shared/i18n/core.cjs");
const {
  GAMES
} = require("./definitions.cjs");
const {
  allowedFileUrl
} = require("../archive-media.cjs");
const SITE = 'https://gamebanana.com';
function id(value) {
  if (!/^[1-9]\d{0,11}$/.test(String(value))) throw Error(i18n.t("backend.gamebanana.invalidEntry"));
  return String(value);
}
function plain(value) {
  return String(value || '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<\/?(?:p|br|div|li|h[1-6])\b[^>]*>/gi, '\n').replace(/<[^>]*>/g, '').replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, entity => ({
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&nbsp;': ' '
  })[entity]).slice(0, 30000).trim();
}
function normalize(value) {
  const postId = id(value._idRow);
  const images = [];
  for (const image of value._aPreviewMedia?._aImages || []) {
    try {
      const url = new URL(`${image._sBaseUrl}/${image._sFile}`);
      const thumbnail = new URL(`${image._sBaseUrl}/${image._sFile530 || image._sFile220 || image._sFile}`);
      if (url.protocol === 'https:' && url.hostname === 'images.gamebanana.com' && !url.username && !url.password && thumbnail.hostname === url.hostname) images.push({
        url: url.href,
        thumbnail: thumbnail.href,
        name: plain(value._sName)
      });
    } catch {/* A missing preview must not break the list. */}
  }
  const files = Array.isArray(value._aFiles) ? value._aFiles : Object.values(value._aFiles || {});
  return {
    id: postId,
    service: 'gamebanana',
    user: String(value._aSubmitter?._idRow || ''),
    title: plain(value._sName) || i18n.t("backend.gamebanana.untitled"),
    author: plain(value._aSubmitter?._sName),
    images,
    thumbnail: images[0]?.thumbnail || '',
    creator: {
      id: String(value._aSubmitter?._idRow || ''),
      service: 'gamebanana',
      name: plain(value._aSubmitter?._sName) || i18n.t("backend.gamebanana.authorUnknown"),
      url: `${SITE}/members/${value._aSubmitter?._idRow || ''}`,
      avatar: ''
    },
    content: String(value._sText || value._sDescription || '').slice(0, 200000),
    url: `${SITE}/mods/${postId}`,
    published: Number(value._tsDateAdded || 0) * 1000,
    game: Number(value._aGame?._idRow),
    updated: Number(value._tsDateUpdated || value._tsDateModified || value._tsDateAdded || 0) * 1000,
    attachments: files.filter(file => !file._bIsArchived && allowedFileUrl(file._sDownloadUrl, 'gamebanana')).map(file => ({
      path: id(file._idRow),
      name: plain(file._sFile).slice(0, 180),
      url: file._sDownloadUrl,
      size: Number(file._nFilesize) || 0,
      description: plain(file._sDescription),
      isImage: false
    }))
  };
}
function createGameBananaService({
  fetch: fetchImpl
}) {
  async function request(endpoint, verifyUrl) {
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetchImpl(SITE + '/apiv11/' + endpoint, {
        credentials: 'include',
        cache: 'no-store',
        signal: controller.signal
      });
      if ([401, 403].includes(response.status)) throw Object.assign(Error(i18n.t("backend.gamebanana.verificationRequired")), {
        code: 'VERIFY_REQUIRED',
        verifyUrl
      });
      if (response.status === 429) throw Error(i18n.t("backend.gamebanana.rateLimited"));
      if (!response.ok) throw Error(i18n.t("backend.gamebanana.requestFailed", {
        status: response.status
      }));
      if (!(response.headers.get('content-type') || '').includes('json')) throw Object.assign(Error(i18n.t("backend.gamebanana.verificationPage")), {
        code: 'VERIFY_REQUIRED',
        verifyUrl
      });
      return await response.json();
    } catch (error) {
      if (controller.signal.aborted) throw Error(i18n.t("backend.gamebanana.requestTimedOut"));
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
  async function list({
    gameId,
    query = '',
    page = 1
  } = {}) {
    const game = GAMES[gameId];
    if (!game) throw Error(i18n.t("backend.gamebanana.gameSectionMissing"));
    page = Math.max(1, Math.min(10000, Math.floor(Number(page) || 1)));
    query = String(query).trim().slice(0, 100);
    const params = new URLSearchParams({
      _nPage: String(page),
      _nPerpage: '24'
    });
    let endpoint = 'Mod/Index';
    if (query) {
      endpoint = 'Util/Search/Results';
      params.set('_sSearchString', query);
      params.set('_sModelName', 'Mod');
      params.set('_idGameRow', String(game.banana));
    } else params.set('_aFilters[Generic_Game]', String(game.banana));
    const data = await request(endpoint + '?' + params, `${SITE}/mods/games/${game.banana}`);
    if (!Array.isArray(data._aRecords)) throw Error(i18n.t("backend.gamebanana.listFormatChanged"));
    const items = [];
    for (const value of data._aRecords) {
      if (Number(value._aGame?._idRow) !== game.banana || value._sModelName !== 'Mod') continue;
      try {
        items.push(normalize(value));
      } catch {/* Ignore malformed records. */}
    }
    const perPage = Number(data._aMetadata?._nPerpage) || 24,
      total = Number(data._aMetadata?._nRecordCount) || 0;
    return {
      items,
      page,
      total,
      hasMore: page * perPage < total
    };
  }
  async function getPost(ref = {}) {
    const data = await request(`Mod/${id(ref.id)}/ProfilePage`, `${SITE}/mods/${id(ref.id)}`);
    if (data._bIsPrivate || data._bIsWithheld || data._bIsTrashed) throw Object.assign(Error(i18n.t("backend.gamebanana.entryUnavailable")), {
      code: 'VERIFY_REQUIRED',
      verifyUrl: `${SITE}/mods/${id(ref.id)}`
    });
    const post = normalize(data);
    if (!GAMES[ref.gameId] || post.game !== GAMES[ref.gameId].banana) throw Error(i18n.t("backend.gamebanana.gameMismatch"));
    return {
      post: {
        ...post,
        gameId: ref.gameId
      }
    };
  }
  return {
    list,
    getPost
  };
}
module.exports = {
  createGameBananaService,
  normalize
};
