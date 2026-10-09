import { r as React, R as ReactDOM } from './index.js';

const h = React.createElement;
const postKey = post => `${post.service}:${post.user}:${post.id}`;
const date = value => value ? new Date(value).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '暂无时间';
function webUrl(value, base) {
  try {
    const url = new URL(value, base);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}

export function readableContent(content, base) {
  const doc = new DOMParser().parseFromString(content || '', 'text/html');
  doc.querySelectorAll('script, style, iframe, object, template').forEach(node => node.remove());
  const links = [...doc.querySelectorAll('a[href]')].flatMap(node => {
    const url = webUrl(node.getAttribute('href'), base);
    return url ? [{ url, label: node.textContent.trim() || new URL(url).hostname }] : [];
  });
  const images = [...doc.querySelectorAll('img[src], img[data-src]')].flatMap(node => {
    const url = webUrl(node.getAttribute('data-src') || node.getAttribute('src'), base);
    return url ? [{ url, name: node.getAttribute('alt') || '正文图片' }] : [];
  });
  doc.querySelectorAll('p, div, br, li, h1, h2, h3, tr').forEach(node => node.append('\n'));
  const text = doc.body.textContent.replace(/[\u200b\u200c\u200d\ufeff]/g, '').replace(/\n{3,}/g, '\n\n').trim();
  for (const match of text.match(/https?:\/\/[^\s<>"'，。；）)\]]+/gi) || []) {
    const url = webUrl(match.replace(/[.,;:!?]+$/, ''), base);
    if (url) links.push({ url, label: /mega\.(?:nz|co\.nz|io)\/#P!/i.test(url) ? 'MEGA 密码保护链接' : url });
  }
  return { text, links: [...new Map(links.map(link => [link.url, link])).values()], images };
}

export function postImages(post, inline = []) {
  const files = post.images || [post.file, ...(post.attachments || [])].filter(file => file?.thumbnail);
  const images = [...files.map(file => ({ ...file, url: file.url || file.thumbnail })), ...inline];
  if (!images.length && post.thumbnail) images.push({ url: post.thumbnail, name: post.title });
  const seen = new Set();
  return images.filter(item => {
    if (!webUrl(item.url)) return false;
    const url = new URL(item.url);
    const key = /(?:^|\.)((pawchive\.pw)|(kemono\.cr))$/.test(url.hostname) ? url.pathname.replace(/^\/thumbnail/, '') : url.href;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function Image({ src, fallback, alt = '', avatar = false, loading = 'lazy', mediaSource, gameId }) {
  const [failed, setFailed] = React.useState(0);
  const [resolved, setResolved] = React.useState('');
  React.useEffect(() => setFailed(0), [src, fallback]);
  const current = failed === 0 ? src : failed === 1 ? fallback : '';
  React.useEffect(() => {
    if (!mediaSource || !current) return;
    let cancelled = false; setResolved('');
    window.api.modSiteImage({ source: mediaSource, gameId, url: current }).then(result => {
      if (!cancelled) { if (result.success) setResolved(result.dataUrl); else setFailed(value => value + 1); }
    }).catch(() => { if (!cancelled) setFailed(value => value + 1); });
    return () => { cancelled = true; };
  }, [current, mediaSource, gameId]);
  const display = mediaSource ? current && resolved : current;
  return display ? h('img', { src: display, alt, loading, referrerPolicy: 'no-referrer', onError: () => setFailed(value => value + 1) }) :
    h('span', { className: 'paw-image-placeholder', 'aria-label': avatar ? '作者头像' : '暂无可用预览图' }, avatar ? '🐾' : '▧');
}

export default function PostDialog({ selected, posts, source, onSelect, onClose, openExternal, onAuthor, favoriteButton, onMarkRead, Download, loadPost, sourceLabel, onAccessRequired }) {
  const key = postKey(selected);
  const [detail, setDetail] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [retry, setRetry] = React.useState(0);
  const [imageIndex, setImageIndex] = React.useState(0);
  const [attachmentState, setAttachmentState] = React.useState({});
  const attachmentLocks = React.useRef(new Set());
  const dialog = React.useRef(null);
  const scroll = React.useRef(null);
  const post = detail?.key === key ? detail.post : selected;
  const label = sourceLabel || (source === 'kemono' ? 'Kemono' : 'Pawchive');
  const content = React.useMemo(() => readableContent(post.content, post.url), [post.content, post.url]);
  const images = React.useMemo(() => postImages(post, content.images), [post, content]);
  const index = Math.min(imageIndex, Math.max(0, images.length - 1));
  const current = images[index];
  const files = [...new Map([post.file, ...(post.attachments || [])].filter(file => file && !file.isImage && !file.thumbnail && !/\.(?:jpe?g|png|gif|webp|avif|bmp|apng|svg|ico|tiff?|heic|heif|jxl)(?:$|[?#])/i.test(file.path || file.name || '')).map(file => [file.path, file])).values()];
  async function downloadAttachment(file) {
    const stateKey = `${source}:${key}:${file.path}`;
    if (attachmentLocks.current.has(stateKey)) return;
    attachmentLocks.current.add(stateKey);
    setAttachmentState(state => ({ ...state, [stateKey]: { busy: true } }));
    try {
      const result = await window.api.attachmentDownload({ source, post: { service: post.service, user: post.user, id: post.id, gameId: post.gameId, url: post.url, topic: post.topic }, filePath: file.path });
      if (result?.code === 'VERIFY_REQUIRED') onAccessRequired?.(result, selected);
      if (!result?.success) throw new Error(result?.error || '无法添加附件下载');
      window.dispatchEvent(new CustomEvent('qaqm:download-task-queued', { detail: result.task }));
      window.dispatchEvent(new CustomEvent('qaqm:open-download-orb'));
      setAttachmentState(state => ({ ...state, [stateKey]: { message: '已加入下载管理' } }));
    } catch (error) {
      setAttachmentState(state => ({ ...state, [stateKey]: { error: error.message || '附件下载失败' } }));
    } finally { attachmentLocks.current.delete(stateKey); }
  }
  const related = posts.some(item => postKey(item) === key) ? posts : [selected, ...posts];
  function moveImage(delta) { if (images.length > 1) setImageIndex(value => (value + delta + images.length) % images.length); }

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    const fetchPost = loadPost || window.api[source + 'GetPost'];
    fetchPost(selected).then(result => {
      if (cancelled) return;
      if (result?.code === 'VERIFY_REQUIRED') onAccessRequired?.(result, selected);
      if (!result?.success) throw new Error(result?.error || '无法加载完整帖子');
      if (!cancelled) setDetail({ key, post: result.post });
    }).catch(error => { if (!cancelled) setError(error.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [key, source, retry, loadPost]);
  React.useEffect(() => {
    setImageIndex(0);
    scroll.current?.scrollTo(0, 0);
    dialog.current?.querySelector('.paw-related-card[aria-current="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [key]);
  React.useEffect(() => {
    const previous = document.activeElement;
    dialog.current?.focus();
    return () => { if (previous?.isConnected) previous.focus?.(); };
  }, []);
  React.useEffect(() => {
    function keyDown(event) {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
      if (!event.target.closest?.('input, textarea, select') && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault(); moveImage(event.key === 'ArrowLeft' ? -1 : 1);
      }
      if (event.key !== 'Tab') return;
      const controls = [...dialog.current.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex="0"]')].filter(node => node.getClientRects().length);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener('keydown', keyDown);
    return () => document.removeEventListener('keydown', keyDown);
  }, [onClose, images.length]);

  return ReactDOM.createPortal(h('div', { className: 'paw-modal-overlay', onClick: event => { if (event.target === event.currentTarget) onClose(); } },
    h('section', { className: 'paw-detail-layout', role: 'dialog', 'aria-modal': true, 'aria-labelledby': 'paw-post-title', tabIndex: -1, ref: dialog },
      h('nav', { className: 'paw-related-sidebar', 'aria-label': '快速切换帖子' },
        ...related.map(item => h('button', { key: postKey(item), className: 'paw-related-card', 'aria-current': postKey(item) === key ? 'true' : undefined,
          title: item.title, onClick: () => onSelect(item) }, h(Image, { src: item.thumbnail, alt: '', mediaSource: item.mediaSource, gameId: item.gameId }), h('span', null, item.title)))),
      h('div', { className: 'paw-modal' },
        h('div', { className: 'paw-gallery', 'aria-label': '帖子图片' },
          current && !post.mediaSource && h('div', { className: 'paw-gallery-backdrop', style: { backgroundImage: `url(${JSON.stringify(current.thumbnail || current.url)})` }, 'aria-hidden': true }),
          current ? h('div', { className: 'paw-gallery-image' }, h(Image, { key: current.url, src: current.url, fallback: current.thumbnail, alt: current.name || post.title, loading: 'eager', mediaSource: post.mediaSource, gameId: post.gameId })) :
            h('div', { className: 'paw-gallery-empty' }, h('span', null, '▧'), h('p', null, loading ? '正在加载图片…' : '这篇帖子没有预览图片')),
          images.length > 1 && h(React.Fragment, null,
            h('button', { className: 'paw-gallery-nav previous', onClick: () => moveImage(-1), 'aria-label': '上一张图片' }, '‹'),
            h('button', { className: 'paw-gallery-nav next', onClick: () => moveImage(1), 'aria-label': '下一张图片' }, '›'),
            h('span', { className: 'paw-gallery-counter', role: 'status' }, `${index + 1} / ${images.length}`),
            h('div', { className: 'paw-gallery-thumbs', 'aria-label': '选择图片' }, ...images.map((item, i) =>
              h('button', { key: item.url, className: i === index ? 'active' : '', 'aria-label': `第 ${i + 1} 张图片`, 'aria-pressed': i === index, onClick: () => setImageIndex(i) },
                h(Image, { src: item.thumbnail || item.url, alt: '', mediaSource: post.mediaSource, gameId: post.gameId }))))),
          current && h('button', { className: 'paw-gallery-original', onClick: () => openExternal(current.url) }, '查看图片 ↗')),
        h('div', { className: 'paw-detail-right' },
          h('header', { className: 'paw-detail-header' },
            h('div', { className: 'paw-modal-heading' }, h('span', { className: 'paw-eyebrow' }, `${label.toUpperCase()} / MOD详情`),
              h('button', { className: 'paw-icon-button', onClick: onClose, 'aria-label': '关闭内容详情' }, '✕')),
            h('h2', { id: 'paw-post-title' }, post.title),
            h('div', { className: 'paw-post-meta' },
              onAuthor ? h('button', { className: 'paw-text-button', onClick: () => { onClose(); onAuthor(post.creator); } }, post.creator?.name || '未标注作者') : h('span', null, post.creator?.name || '未标注作者'),
              h('span', { className: 'paw-service' }, post.service),
              h('time', null, 'Published: ', date(post.published)), h('time', null, 'Edited: ', date(post.edited)))),
          h('div', { className: 'paw-detail-scroll', ref: scroll },
            loading && h('p', { role: 'status', className: 'paw-muted' }, '正在加载完整内容…'),
            error && h('div', { role: 'alert', className: 'paw-alert' }, error, h('button', { className: 'paw-button', onClick: () => setRetry(value => value + 1) }, '重试')),
            post.previewOnly && h('p', { className: 'paw-notice' }, '此条目仅提供预览，可前往原帖查看完整内容。'),
            h('div', { className: 'paw-post-content' }, content.text || (loading ? '' : '作者未填写正文。')),
            content.links.length > 0 && h('div', { className: 'paw-content-links' }, h('h3', null, '正文链接'), ...content.links.map((link, i) =>
              h('button', { key: i, className: 'paw-text-button', title: link.url, onClick: () => openExternal(link.url) }, link.label, ' ↗'))),
            files.length > 0 && h('div', { className: 'paw-files' }, h('h3', null, `附件 · ${files.length}`), ...files.map(file => {
              const state = attachmentState[`${source}:${key}:${file.path}`] || {};
              return h('div', { key: file.path },
                h('button', { className: 'paw-file', disabled: state.busy || file.previewOnly, onClick: () => downloadAttachment(file), title: file.previewOnly ? '此附件仅提供预览' : '使用内置下载管理器下载', 'data-file-path': file.path },
                  '📎 ', file.name || '未命名附件', state.busy ? ' · 正在加入…' : file.previewOnly ? ' · 仅预览' : ' ↓'),
                state.error && h('p', { className: 'paw-alert', role: 'alert' }, state.error),
                state.message && h('p', { className: 'paw-notice', role: 'status' }, state.message));
            }))),
          h('footer', { className: 'paw-modal-footer' },
            favoriteButton?.(post.creator),
            selected.changeKind && h('button', { className: 'paw-button', onClick: () => onMarkRead(selected) }, '✓ 已读'),
            h('button', { className: 'paw-button', onClick: () => openExternal(post.url) }, '前往原帖 ↗'),
            Download && !!post.megaLinks?.length && h(Download, { key: key + post.megaLinks.map(link => link.url).join('|'), links: post.megaLinks, name: post.title })))))), document.body);
}
