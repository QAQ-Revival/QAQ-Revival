import { r as React } from './index.js';
import PostDialog, { Image } from './ModPostDialog.js';
import { RevivalDownload } from './PawchiveView.js';
const h = React.createElement;
const button = (label, onClick, props = {}) => h('button', { type: 'button', className: 'paw-button', onClick, ...props }, label);

function EmbeddedVerification({ source, gameId, url, onFinish, onCancel }) {
  const viewport = React.useRef(null), token = React.useRef(crypto.randomUUID());
  const [error, setError] = React.useState(''), [host, setHost] = React.useState(''), [status, setStatus] = React.useState(0);
  const [finishing, setFinishing] = React.useState(false);
  React.useEffect(() => {
    let disposed = false, opened = false, frame, last = '';
    const identity = { source, gameId, token: token.current };
    function geometry() {
      const rect = viewport.current.getBoundingClientRect();
      const x = Math.max(0, rect.left), y = Math.max(36, rect.top);
      return { x, y, width: Math.max(0, Math.min(window.innerWidth, rect.right) - x), height: Math.max(0, Math.min(window.innerHeight, rect.bottom) - y) };
    }
    function update() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (disposed || !opened) return;
        const visible = !document.querySelector('.mod-download-source-menu, .game-selector-menu, .qaqm-download-panel, .modal-backdrop');
        const bounds = geometry(), serialized = JSON.stringify({ visible, bounds });
        if (serialized === last) return; last = serialized;
        window.api.modSiteResize({ ...identity, bounds, visible });
      });
    }
    window.api.modSiteOpen({ ...identity, url, bounds: geometry() }).then(result => {
      if (disposed) { window.api.modSiteHide(identity); return; }
      if (!result.success) { setError(result.error); return; }
      opened = true; setHost(result.host); update();
    }).catch(error => { if (!disposed) setError(error.message); });
    const resize = new ResizeObserver(update); resize.observe(viewport.current);
    const mutations = new MutationObserver(update); mutations.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
    document.addEventListener('scroll', update, true); window.addEventListener('resize', update);
    const unsubscribe = window.api.onModSiteChanged(value => {
      if (value.source !== source) return;
      if (value.host) setHost(value.host);
      if (value.status) setStatus(value.status);
      if (value.error) setError(value.error);
    });
    return () => { disposed = true; cancelAnimationFrame(frame); resize.disconnect(); mutations.disconnect(); unsubscribe();
      document.removeEventListener('scroll', update, true); window.removeEventListener('resize', update); window.api.modSiteHide(identity); };
  }, [source, gameId, url]);
  async function finish() {
    if (finishing) return;
    setFinishing(true); setError('');
    try {
      const result = await window.api.modSiteFinish({ source, token: token.current });
      if (!result?.success) { setError(result?.error || '验证尚未完成'); return; }
      onFinish();
    } catch (error) { setError(error.message); }
    finally { setFinishing(false); }
  }
  return h('section', { className: 'mod-site-verification', 'aria-label': '站点页内验证' },
    h('div', { className: 'mod-site-verification-header' }, h('div', null, h('strong', null, '站点验证 / 登录'),
      h('p', { className: 'paw-muted' }, host || '正在载入…', status === 403 ? ' · HTTP 403，尚未通过站点验证' : '')),
      h('div', { className: 'mod-site-actions' }, button('刷新验证页', () => window.api.modSiteReload({ source, token: token.current })),
        button(finishing ? '正在确认…' : '完成验证，重新解析', finish, { className: 'paw-button paw-primary', disabled: finishing }), button('取消', onCancel))),
    error && h('p', { className: 'paw-alert', role: 'alert' }, error),
    h('div', { ref: viewport, className: 'mod-site-verification-viewport', 'aria-label': '嵌入的站点网页' }));
}

export default function ModSiteView({ source, gameId, isActive }) {
  const [state, setState] = React.useState(null), [result, setResult] = React.useState(null), [error, setError] = React.useState(null);
  const [loading, setLoading] = React.useState(false), [revision, setRevision] = React.useState(0);
  const [input, setInput] = React.useState(''), [query, setQuery] = React.useState(''), [page, setPage] = React.useState(1), [cursors, setCursors] = React.useState(['']);
  const [topic, setTopic] = React.useState(''), [selected, setSelected] = React.useState(null), [verification, setVerification] = React.useState(null);
  const [account, setAccount] = React.useState(false), [clearing, setClearing] = React.useState(false), [editing, setEditing] = React.useState(false), [url, setUrl] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [verificationCancelled, setVerificationCancelled] = React.useState(false);
  const site = state?.site, pageSearch = ['keke', 'loverslab'].includes(source);
  React.useEffect(() => {
    let cancelled = false;
    window.api.modSiteDescribe({ source, gameId }).then(value => {
      if (!cancelled) { if (value.success) setState(value); else setError(value); }
    });
    return () => { cancelled = true; };
  }, [source, gameId, revision]);
  const requireAccess = React.useCallback((value, post = null) => {
    setError(value); setSelected(null); setVerification({ url: value.verifyUrl || post?.url || '', post });
  }, []);
  React.useEffect(() => {
    if (!isActive || !site || verification || verificationCancelled) return;
    let cancelled = false; setLoading(true); setError(null); setResult(null);
    window.api.modSiteList({ source, gameId, query, page, cursor: cursors[page - 1] || '', topic }).then(value => {
      if (cancelled) return;
      if (!value.success) { setError(value); if (value.code === 'VERIFY_REQUIRED') requireAccess(value); }
      else setResult(value);
    }).catch(error => { if (!cancelled) setError({ error: error.message }); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [source, gameId, isActive, !!site, revision, query, page, topic, verification, verificationCancelled]);
  const loadPost = React.useCallback(post => window.api.modSiteGetPost({ source, gameId, id: post.id, url: post.url, topic }), [source, gameId, topic]);
  function openLink(target) { setVerification({ url: target, post: selected }); setSelected(null); }
  function finishVerification() {
    const post = verification?.post; setVerificationCancelled(false); setVerification(null); setError(null); setRevision(value => value + 1); if (post) setSelected(post);
  }
  async function configure(value) {
    setBusy(true);
    try {
      const response = await window.api.modSiteConfigure({ source, gameId, url: value });
      if (!response.success) throw Error(response.error);
      setState(response); setEditing(false); setPage(1); setCursors(['']); setRevision(value => value + 1);
    } catch (error) { setError({ error: error.message }); } finally { setBusy(false); }
  }
  async function clearSession() {
    setBusy(true);
    try {
      const response = await window.api.modSiteClear({ source, gameId });
      if (!response.success) throw Error(response.error);
      setVerification(null); setVerificationCancelled(false); setState(response); setClearing(false); setRevision(value => value + 1);
    } catch (error) { setError({ error: error.message }); } finally { setBusy(false); }
  }
  function search(event) { event.preventDefault(); setQuery(input.trim()); setPage(1); setCursors(['']); setRevision(value => value + 1); }
  function next() { setCursors(values => [...values.slice(0, page), result.nextUrl || '']); setPage(value => value + 1); }
  return h('section', { className: 'pawchive-view mod-site-view', 'aria-label': site?.label || 'Mod 来源' },
    h('header', { className: 'mod-site-toolbar' }, h('h2', null, site ? `${site.label} · ${site.gameName}` : '正在加载来源…'),
      h('div', { className: 'mod-site-actions' }, button('刷新', () => { setVerificationCancelled(false); setRevision(value => value + 1); }, { disabled: !!verification || loading }),
        button('账号', () => setAccount(!account), { 'aria-expanded': account }),
        button('分区设置', () => { setUrl(site?.url || ''); setEditing(!editing); }))),
    account && h('div', { className: 'mod-site-account' }, h('span', null, state?.hasSession ? '已保存站点会话，登录权限由原站决定' : '尚未建立站点会话'),
      button('登录 / 验证', () => { setVerification({ url: site?.url || '', post: null }); setSelected(null); }),
      button('清除登录状态', () => setClearing(true))),
    clearing && h('div', { className: 'paw-notice' }, h('p', null, '清除此站点的登录状态与浏览数据？'),
      button('确认清除', clearSession, { disabled: busy }), ' ', button('取消', () => setClearing(false))),
    editing && h('form', { className: 'mod-site-section-form', onSubmit: event => { event.preventDefault(); configure(url); } },
      h('label', null, '当前游戏的分区链接', h('input', { type: 'url', value: url, onChange: event => setUrl(event.target.value), maxLength: 2000, required: true })),
      h('div', { className: 'mod-site-actions' }, h('button', { className: 'paw-button', disabled: busy }, '保存分区'), button('恢复默认', () => configure(''), { disabled: busy }))),
    state?.warning && h('p', { className: 'paw-alert' }, state.warning),
    isActive && verification ? h(EmbeddedVerification, { key: verification.url, source, gameId, url: verification.url,
      onFinish: finishVerification, onCancel: () => { setVerificationCancelled(true); setVerification(null); setLoading(false); setError({ error: '验证已取消，点击重新加载可再次尝试。' }); } }) :
    h(React.Fragment, null,
      source === 'loverslab' && !!site?.extra?.length && h('div', { className: 'paw-toolbar' }, h('label', null, '主题 ',
        h('select', { value: topic || site.url, onChange: event => { setTopic(event.target.value); setPage(1); setCursors(['']); } },
          h('option', { value: site.url }, '主要主题'), ...site.extra.map(item => h('option', { key: item.url, value: item.url }, item.label))))),
      h('form', { className: 'paw-toolbar mod-site-search', onSubmit: search }, h('input', { value: input, onChange: event => setInput(event.target.value), maxLength: 100,
        placeholder: pageSearch ? '筛选本页内容' : '搜索当前游戏的 Mod', 'aria-label': '搜索 Mod' }), h('button', { className: 'paw-button', disabled: loading }, '搜索'),
        result && h('span', { className: 'paw-muted' }, `第 ${page} 页 · ${result.items.length} 条${pageSearch ? '（搜索仅筛选本页）' : ''}`)),
      error ? h('div', { className: 'paw-empty', role: 'alert' }, h('h2', null, error.code === 'VERIFY_REQUIRED' ? '需要验证或登录' : '无法解析此来源'),
        h('p', null, error.error || '未知错误'), button('重新加载', () => { setVerificationCancelled(false); setRevision(value => value + 1); }, { className: 'paw-button paw-primary' })) :
      loading ? h('div', { className: 'paw-grid', 'aria-busy': true }, ...Array.from({ length: 8 }, (_, key) => h('div', { className: 'paw-skeleton', key }, h('div'), h('span'), h('span')))) :
      result && !result.items.length ? h('div', { className: 'paw-empty' }, h('h2', null, '没有找到匹配内容')) :
      h('div', { className: 'paw-grid' }, ...(result?.items || []).map(post => h('article', { className: 'paw-post-card', key: post.id, tabIndex: 0, role: 'button',
        onClick: () => setSelected(post), onKeyDown: event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(post); } } },
        h('div', { className: 'paw-card-image' }, h(Image, { src: post.thumbnail, alt: post.title, mediaSource: source, gameId }), h('span', { className: 'paw-image-service' }, site?.label)),
        h('div', { className: 'paw-card-body' }, h('button', { className: 'paw-post-title', type: 'button', title: post.title }, post.title),
          h('span', { className: 'paw-card-author' }, post.creator.name),
          h('div', { className: 'paw-post-stats' }, post.published ? new Date(post.published).toLocaleDateString('zh-CN') : '查看详情'),
          h('div', { className: 'paw-card-actions' }, h('button', { className: 'paw-button', type: 'button' }, '详情 ↗')))))),
      result && !loading && h('div', { className: 'paw-pagination' }, button('上一页', () => setPage(value => value - 1), { disabled: page <= 1 }), button('下一页', next, { disabled: !result.hasMore }))),
    isActive && selected && !verification && h(PostDialog, { selected, posts: result?.items || [], source, sourceLabel: site?.label,
      onSelect: setSelected, onClose: () => setSelected(null), openExternal: openLink, loadPost, onAccessRequired: requireAccess, Download: RevivalDownload }));
}
