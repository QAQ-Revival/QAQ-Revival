'use strict';
const { GAMES, siteUrl, safeWebUrl } = require('./mod-sites.cjs');
const { extractMegaLinks } = require('./mega-revival.cjs');

const escape = text => String(text || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const web = (value, base) => { if (!value) return ''; try { const url = new URL(value, base).href; return safeWebUrl(url) ? url : ''; } catch { return ''; } };
function failure(code, message, verifyUrl) { return Object.assign(Error(message), { code, verifyUrl }); }
function normalizePost(source, gameId, value) {
  const content = String(value.content || '').slice(0, 200000);
  const images = (value.images || []).filter(file => safeWebUrl(file.url));
  const user = String(value.creator?.id || value.authorUrl || source);
  return { ...value, gameId, service: source, mediaSource: source, user, content, images, thumbnail: value.thumbnail || images[0]?.thumbnail || images[0]?.url || '',
    creator: value.creator || { id: user, service: source, name: value.author || '未标注作者', url: value.authorUrl || value.url, avatar: '' },
    published: typeof value.published === 'number' ? value.published : Date.parse(value.published) || 0,
    edited: value.edited || value.updated || 0, attachments: value.attachments || [],
    megaLinks: extractMegaLinks([content, ...(value.links || []).map(link => link.url)].join('\n')) };
}
function huiPost(value, gameId) {
  const base = 'https://huiyue.org/';
  const links = [], images = [];
  function nodes(items, depth = 0) {
    if (!Array.isArray(items) || depth > 24) return '';
    return items.slice(0, 3000).map(node => {
      if (node.tag === 'text') return escape(node.text);
      if (node.tag === 'img') {
        const url = web(node.src, base); if (!url) return '';
        images.push({ url, thumbnail: url, name: node.alt || '' }); return '';
      }
      const body = nodes(node.children, depth + 1);
      if (node.tag === 'a') {
        const url = web(node.href, base); if (!url) return body;
        links.push({ url, label: body.replace(/<[^>]*>/g, '') }); return `<a href="${escape(url)}">${body}</a>`;
      }
      return ['p', 'div', 'br', 'strong', 'span', 'ul', 'li', 'h2', 'h3', 'pre', 'code'].includes(node.tag) ? `<${node.tag}>${body}</${node.tag}>` : body;
    }).join('');
  }
  let content = nodes(value.body);
  for (const version of value.resource_versions || []) for (const item of version.downloads || version.links || []) {
    const url = web(item.url, base); if (!url || item.enabled === false) continue;
    links.push({ url, label: item.label || version.name || '下载链接' });
    content += `<p><a href="${escape(url)}">${escape(item.label || version.name || '下载链接')}</a>${item.code ? ' 提取码：' + escape(item.code) : ''}</p>`;
  }
  const cover = web(value.cover || value.image_url || value.image || value.preview_image, base);
  if (cover && !images.some(item => item.url === cover)) images.unshift({ url: cover, thumbnail: cover, name: value.title });
  const profile = value.publisher_profile;
  return normalizePost('huiyue', gameId, { id: String(value.id), url: `${base}#page=${value.id}`, title: String(value.title || '无标题'), content, links, images,
    thumbnail: cover, author: profile?.display_name || value.author || '', authorUrl: web(profile?.url, base), published: value.published_date || value.date,
    attachments: links.filter(link => /\.(zip|rar|7z|ini|mp4)(?:$|[?#])/i.test(link.url) && siteUrl(link.url, 'huiyue')).map(link => ({ path: link.url, url: link.url, name: link.label || 'Mod.zip' })) });
}
function createSiteContent({ sessions, gamebanana }) {
  async function request(source, url, gameId, json = false, verifyUrl = url) {
    if (!json) { const verified = sessions.verifiedPage?.(source, url); if (verified) return verified; }
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 25000);
    try {
      const response = await sessions.fetch(source, url, { cache: 'no-store', signal: controller.signal });
      if (json) {
        const type = response.headers.get('content-type') || '';
        if ([401, 403].includes(response.status) || !type.includes('json')) throw failure('VERIFY_REQUIRED', '站点需要验证或登录，请在页内完成后重试。', verifyUrl);
        const data = await response.json();
        if (data.admission_required || data.restricted || response.status === 401) throw failure('VERIFY_REQUIRED', data.message || '请先完成站点访问验证。', verifyUrl);
        if (!response.ok) throw failure('HTTP_ERROR', data.message || `请求失败（HTTP ${response.status}）`);
        return data;
      }
      const page = { html: await response.text(), url: response.url || url, status: response.status };
      // Start challenges only after the visible embedded page has been attached.
      if ([401, 403].includes(response.status)) {
        throw failure('VERIFY_REQUIRED', `站点返回 ${response.status}，请在页内完成验证或登录。`, verifyUrl);
      }
      return page;
    } catch (error) {
      if (controller.signal.aborted) throw failure('NETWORK_ERROR', '站点请求超时，请检查网络后重试。');
      throw error;
    } finally { clearTimeout(timer); }
  }
  function remember(source, gameId, posts) {
    sessions.rememberLinks(source, gameId, posts.flatMap(post => [post.url, post.creator?.url, post.thumbnail, ...post.images.flatMap(image => [image.url, image.thumbnail]), ...(post.links || []).map(link => link.url)]).filter(Boolean));
  }
  async function parsePage(source, gameId, url, options = {}) {
    const fetched = await request(source, url, gameId);
    let parsed = await sessions.parse({ source, ...fetched, ...options });
    if (parsed.code === 'PARSE_ERROR') {
      // Elementor and forum widgets can finish their markup in the browser.
      // Try the rendered DOM once; unknown layouts still report an error.
      try {
        const rendered = await sessions.page(source, url, gameId);
        parsed = await sessions.parse({ source, ...rendered, ...options });
      } catch (error) { if (error.code === 'VERIFY_REQUIRED') throw error; }
    }
    if (parsed.code) throw failure(parsed.code, parsed.error, url);
    return parsed;
  }
  async function section(source, gameId, topic) {
    const { site } = await sessions.describe({ source, gameId });
    if (!site.hasSection) throw failure('NO_SECTION', '尚未配置当前游戏分区，请在“分区设置”中补充对应链接。');
    if (topic && source === 'loverslab') {
      if (!site.extra.some(item => item.url === topic) && topic !== site.url) throw Error('主题入口无效');
      return { ...site, url: topic };
    }
    return site;
  }
  async function list({ source, gameId, query = '', page = 1, cursor = '', topic = '' } = {}) {
    const site = await section(source, gameId, topic);
    page = Math.max(1, Math.min(10000, Math.floor(Number(page) || 1)));
    query = String(query).trim().slice(0, 100);
    if (source === 'gamebanana') {
      const result = await gamebanana.list({ gameId, query, page });
      result.items = result.items.map(item => normalizePost(source, gameId, item)); remember(source, gameId, result.items); return result;
    }
    if (source === 'huiyue') {
      const params = new URLSearchParams({ q: query, game: GAMES[gameId]?.name || '', page: String(page) });
      const data = await request(source, 'https://huiyue.org/api/catalog/?' + params, gameId, true, site.url);
      if (!Array.isArray(data.items)) throw failure('PARSE_ERROR', '辉站列表格式已变化，未能解析内容。');
      const items = data.items.filter(item => !item.game || item.game === GAMES[gameId]?.name).map(item => huiPost(item, gameId));
      remember(source, gameId, items); return { items, page: Number(data.page) || page, total: data.total, hasMore: page < data.total_pages };
    }
    let url = site.url;
    if (cursor) {
      const next = new URL(cursor), original = new URL(site.url);
      if (!siteUrl(cursor, source) || next.pathname.replace(/\/page\/\d+\/?$/, '/') !== original.pathname.replace(/\/page\/\d+\/?$/, '/')) throw Error('翻页链接不属于当前分区');
      url = cursor;
    } else if (source === 'arca' && query) {
      const next = new URL(url); next.searchParams.set('target', 'all'); next.searchParams.set('keyword', query); url = next.href;
    }
    const parsed = await parsePage(source, gameId, url);
    let items = parsed.items.map(value => normalizePost(source, gameId, value));
    // Sites without a verified search endpoint explicitly filter the loaded page only.
    if (query && source !== 'arca') items = items.filter(item => (item.title + ' ' + item.content).toLowerCase().includes(query.toLowerCase()));
    remember(source, gameId, items);
    return { items, page, total: null, hasMore: !!parsed.nextUrl, nextUrl: parsed.nextUrl, pageSearch: source !== 'arca' };
  }
  async function getPost({ source, ...ref } = {}) {
    const site = await section(source, ref.gameId, ref.topic);
    let post;
    if (source === 'gamebanana') {
      post = normalizePost(source, ref.gameId, (await gamebanana.getPost(ref)).post);
      const body = await sessions.parse({ source: 'content', html: post.content, url: post.url });
      post.content = body.content; post.links = body.links; post.images.push(...body.images);
      post.megaLinks = extractMegaLinks(post.content);
    }
    else if (source === 'huiyue') {
      if (!/^[a-f0-9]{24}$/.test(String(ref.id))) throw Error('辉站内容标识无效');
      const data = await request(source, `https://huiyue.org/api/content/${ref.id}/`, ref.gameId, true, site.url);
      if (data.game && data.game !== GAMES[ref.gameId]?.name) throw Error('此条目不属于当前游戏');
      if (!Array.isArray(data.body) || !data.title) throw failure('PARSE_ERROR', '辉站详情格式已变化，未能解析正文。');
      post = huiPost(data, ref.gameId);
    } else {
      const url = String(ref.url || ref.id || '');
      if (!siteUrl(url, source)) throw Error('帖子地址无效，请刷新列表');
      const parsed = await parsePage(source, ref.gameId, url, { detail: true, id: String(ref.id) });
      post = normalizePost(source, ref.gameId, parsed.items[0]);
    }
    remember(source, ref.gameId, [post]); return { post };
  }
  return { list, getPost };
}
module.exports = { createSiteContent, normalizePost, huiPost, failure };
