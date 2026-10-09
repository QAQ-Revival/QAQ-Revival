'use strict';

// Runs in an isolated, blank Chromium document. Remote HTML is parsed, never executed.
function parseSiteDocument({ source, html, url, detail = false, id = '', status = 200 }) {
  const doc = new DOMParser().parseFromString(String(html || '').slice(0, 6000000), 'text/html');
  const text = (node) => (node?.textContent || '').replace(/\s+/g, ' ').trim();
  const link = value => {
    if (!value) return '';
    try { const u = new URL(value, url); return u.protocol === 'https:' && !u.username && !u.password ? u.href : ''; } catch { return ''; }
  };
  const title = text(doc.querySelector('title'));
  const challenge = /just a moment|attention required|verify you are human|security verification|access denied|403 forbidden|checking your browser/i.test(title) ||
    !!doc.querySelector('#challenge-form, #challenge-running, #cf-challenge-running, .cf-browser-verification, #password_protected_pass, input[name="password_protected_pwd"], .passster-form input[type="password"]');
  if (challenge || [401, 403].includes(status)) return { code: 'VERIFY_REQUIRED', error: status === 403 ? '站点返回 403，请先在页内完成验证或登录。' : '此站点需要先完成验证或输入入站密码。' };
  if (doc.querySelector('form[action*="login"] input[type="password"], #elLoginForm input[type="password"]') && !doc.querySelector('article, .article-content, .e-loop-item, [data-role="commentContent"]')) return { code: 'VERIFY_REQUIRED', error: '请先登录本站，再重新解析内容。' };
  if (status >= 400) return { code: 'HTTP_ERROR', error: `站点请求失败（HTTP ${status}）` };
  doc.querySelectorAll('script, style, iframe, object, embed, noscript, template, .advertisement').forEach(node => node.remove());
  // IPS wraps the entire topic in a moderation form. Keep its posts, discard only the wrapper.
  doc.querySelectorAll('form').forEach(node => node.replaceWith(...node.childNodes));
  function image(node) {
    return link(node?.getAttribute('data-src') || node?.getAttribute('data-lazy-src') || node?.getAttribute('data-original') || node?.getAttribute('src') || '');
  }
  function content(node) {
    if (!node) return { content: '', images: [], links: [], attachments: [] };
    const clone = node.cloneNode(true);
    clone.querySelectorAll('script, style, iframe, object, embed, form, button, input, textarea, select, .ipsQuote, .quote').forEach(n => n.remove());
    const links = [...clone.querySelectorAll('a[href]')].map(a => ({ url: link(a.getAttribute('href')), label: text(a) })).filter(a => a.url);
    const images = [...new Map([...clone.querySelectorAll('img')].map(img => {
      const value = image(img); return [value, { url: value, thumbnail: value, name: img.getAttribute('alt') || '' }];
    }).filter(([value]) => value)).values()];
    const attachments = links.filter(a => /\.(zip|rar|7z|ini|pak|mp4)(?:$|[?#])/i.test(a.url) || /\/attachment\.php\?/i.test(a.url)).map(a => ({
      url: a.url, path: a.url, name: a.label || decodeURIComponent(new URL(a.url).pathname.split('/').pop()), isImage: false
    }));
    clone.querySelectorAll('a').forEach(a => { const value = link(a.getAttribute('href')); if (value) a.setAttribute('href', value); else a.removeAttribute('href'); });
    clone.querySelectorAll('img').forEach(img => { const value = image(img); img.removeAttribute('srcset'); img.removeAttribute('data-src'); if (value) img.setAttribute('src', value); else img.remove(); });
    // HTML reaches only ModPostDialog's inert DOMParser, never dangerouslySetInnerHTML.
    return { content: clone.innerHTML.slice(0, 200000), images, links, attachments };
  }
  const unique = items => [...new Map(items.filter(item => item.id && item.url && item.title).map(item => [item.id, item])).values()];
  if (source === 'content') return content(doc.body);
  const nextLink = doc.querySelector('a[rel="next"], a.next.page-numbers, .ipsPagination_next:not(.ipsPagination_inactive) a');
  let nextUrl = nextLink ? link(nextLink.getAttribute('href')) : '';
  let items = [];
  if (source === 'keke') {
    if (detail) {
      const root = doc.querySelector('[data-elementor-type="product"], .product.type-product, article.product');
      if (!root) return { code: 'PARSE_ERROR', error: '未识别到可可站商品详情结构。' };
      const productTitle = root.querySelector('h1, .product_title, .elementor-widget-theme-post-title .elementor-heading-title');
      const body = root.cloneNode(true);
      body.querySelectorAll('.related, .upsells, .elementor-widget-woocommerce-product-related, .elementor-widget-woocommerce-product-add-to-cart, .elementor-widget-post-comments').forEach(n => n.remove());
      items = [{ id, url, title: text(productTitle) || title.replace(/\s*[–—-]\s*可可站.*$/, ''), ...content(body), author: '可可站' }];
    } else {
      const roots = [...doc.querySelectorAll('[data-elementor-type="loop-item"], li.product, .products article')];
      for (const root of roots) {
        const a = [...root.querySelectorAll('a[href]')].find(a => /\/product\/[^/?#]+\/?(?:[?#]|$)/.test(a.getAttribute('href')));
        if (!a) continue;
        const target = link(a.getAttribute('href'));
        const name = text(root.querySelector('h1,h2,h3,.woocommerce-loop-product__title,.elementor-heading-title')) || text(a);
        items.push({ id: target, url: target, title: name, thumbnail: image(root.querySelector('img')), author: '可可站' });
      }
      if (!nextUrl) {
        const current = doc.querySelector('.page-numbers.current');
        const number = Number(text(current)) || 1;
        const a = [...doc.querySelectorAll('a.page-numbers')].find(a => Number(text(a)) === number + 1);
        if (a) nextUrl = link(a.getAttribute('href'));
      }
    }
  } else if (source === 'arca') {
    if (detail) {
      const body = doc.querySelector('.article-content');
      if (!body) return { code: 'PARSE_ERROR', error: '未识别到韩网帖子正文，可能需要登录或当前版块结构已变化。' };
      const author = doc.querySelector('.article-head .nickname, .article-head .user-info, .article-head .author');
      items = [{ id, url, title: text(doc.querySelector('.article-head .title, .article-title, h1')) || title, author: text(author),
        published: doc.querySelector('.article-head time')?.getAttribute('datetime') || '', ...content(body) }];
    } else {
      for (const a of doc.querySelectorAll('a.vrow[href], .list-table a[href]')) {
        const target = link(a.getAttribute('href'));
        if (!/\/b\/[^/]+\/\d+/.test(target) || a.classList.contains('notice')) continue;
        const name = a.querySelector('.title'); if (!name) continue;
        const clone = name.cloneNode(true); clone.querySelectorAll('.comment-count,.badge,.category').forEach(n => n.remove());
        items.push({ id: target, url: target, title: text(clone), thumbnail: image(a.querySelector('img')),
          author: text(a.querySelector('.nickname, .user-info')), published: a.querySelector('time')?.getAttribute('datetime') || '' });
      }
      if (!nextUrl) {
        const current = doc.querySelector('.pagination .active');
        const number = Number(text(current)) || Number(new URL(url).searchParams.get('p')) || 1;
        const a = [...doc.querySelectorAll('.pagination a[href]')].find(a => Number(text(a)) === number + 1);
        if (a) nextUrl = link(a.getAttribute('href'));
      }
    }
  } else if (source === 'loverslab') {
    const topic = text(doc.querySelector('h1.ipsType_pageTitle, h1')) || title;
    for (const root of doc.querySelectorAll('article.ipsComment, [data-commentid]')) {
      const body = root.querySelector('[data-role="commentContent"], .ipsComment_content .ipsType_richText'); if (!body) continue;
      const commentId = root.getAttribute('data-commentid') || root.id.match(/(?:comment|elComment)_?(\d+)/)?.[1];
      if (!commentId) continue;
      const data = content(body), author = root.querySelector('h3 a, .ipsComment_author a, .cAuthorPane_author a');
      const target = new URL(url); target.hash = 'comment-' + commentId;
      const post = { id: commentId, url: target.href, title: topic + (text(author) ? ' · ' + text(author) : ''), author: text(author), authorUrl: link(author?.getAttribute('href') || ''),
        published: root.querySelector('time')?.getAttribute('datetime') || '', thumbnail: data.images[0]?.url || '', ...data };
      if (!detail || String(id) === String(commentId)) items.push(post);
    }
  }
  items = unique(items);
  if (!items.length && !doc.querySelector('.woocommerce-info, .no-results, .list-empty, .ipsType_light.ipsPad')) return { code: 'PARSE_ERROR', error: '页面已打开，但没有识别到可用的 Mod 内容。站点结构可能已变化。' };
  if (detail && !items.length) return { code: 'PARSE_ERROR', error: '没有找到该条目的完整内容，请刷新列表后重试。' };
  return { items, nextUrl, hasMore: !!nextUrl };
}
module.exports = { parseSiteDocument };
