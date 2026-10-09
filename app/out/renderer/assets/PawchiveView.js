import { r as React } from './index.js';
import PostDialog, { Image } from './ModPostDialog.js';

const h = React.createElement;
const authorKey = author => `${author.service}:${author.id}`;
const date = value => value ? new Date(value).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '暂无时间';
const number = value => new Intl.NumberFormat('zh-CN', { notation: 'compact' }).format(value || 0);

async function call(method, payload) {
  const result = await window.api[method](payload);
  if (!result?.success) throw new Error(result?.error || '操作失败，请重试');
  return result;
}


export function RevivalDownload({ links, name }) {
  const [expanded, setExpanded] = React.useState(false);
  const [selected, setSelected] = React.useState(() => links.map(link => link.url));
  const [keys, setKeys] = React.useState({});
  const [passwords, setPasswords] = React.useState({});
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');
  const lock = React.useRef(false);
  async function send() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setMessage('');
    try {
      const result = await call('megaRevivalDownload', { links: selected.map(url => ({ url, key: keys[url] || '', password: passwords[url] || '' })), name });
      setPasswords({});
      setMessage(`已添加 ${result.count} 个下载任务，可在侧栏的下载管理中查看进度。`);
      window.dispatchEvent(new CustomEvent('qaqm:open-download-orb'));
    } catch (error) { setError(error.message); }
    finally { lock.current = false; setBusy(false); }
  }
  return h('div', { className: 'paw-mega-download' },
    expanded && h('div', { className: 'paw-mega-selection' },
      h('h3', null, '选择 MEGA 下载链接'),
      ...links.map((link, index) => h('div', { className: 'paw-mega-link', key: link.url },
        h('label', null, h('input', { type: 'checkbox', checked: selected.includes(link.url), disabled: busy,
          onChange: event => setSelected(values => event.target.checked ? [...values, link.url] : values.filter(value => value !== link.url)) }),
        `${link.needsPassword ? '🔒 密码保护链接' : link.type === 'folder' ? '📁 文件夹' : link.type === 'encrypted' ? '🔗 加密分享' : '📄 文件'} ${index + 1}`, link.id ? ` · ${link.id}` : ''),
        link.needsPassword && h('input', { type: 'password', placeholder: '填写作者提供的链接密码', autoComplete: 'off', value: passwords[link.url] || '', 'aria-label': `链接 ${index + 1} 的密码`,
          onChange: event => setPasswords(value => ({ ...value, [link.url]: event.target.value })), disabled: busy, maxLength: 1024 }),
        link.needsKey && h('input', { type: 'text', placeholder: '填写作者提供的解密密钥', value: keys[link.url] || '', 'aria-label': `链接 ${index + 1} 的解密密钥`,
          onChange: event => setKeys(value => ({ ...value, [link.url]: event.target.value })), disabled: busy, maxLength: 43 }))),
      h('p', { className: 'paw-muted' }, '保存到下载管理中设置的目录，文件夹会保留子目录结构。')),
    error && h('p', { className: 'paw-alert', role: 'alert' }, error),
    message && h('p', { className: 'paw-notice', role: 'status' }, message),
    h('button', { className: 'paw-button paw-primary paw-download-button', disabled: busy || (expanded && !selected.length), onClick: () => {
      if (!expanded && (links.length > 1 || links.some(link => link.needsKey || link.needsPassword))) setExpanded(true); else send();
    } }, busy ? '正在打开…' : expanded ? `↓ 下载所选 (${selected.length})` : '↓ 下载'));
}


export default function PawchiveView({ isActive = true, source = 'pawchive' }) {
  const label = source === 'kemono' ? 'Kemono' : 'Pawchive';
  const site = source === 'kemono' ? 'https://kemono.cr' : 'https://pawchive.pw';
  const sourceCall = React.useCallback((method, payload) => call(source + method, payload), [source]);
  const [view, setView] = React.useState('updates');
  const [creator, setCreator] = React.useState(null);
  const [authorTabs, setAuthorTabs] = React.useState([]);
  const [input, setInput] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [service, setService] = React.useState('');
  const [sort, setSort] = React.useState('updated');
  const [offset, setOffset] = React.useState(0);
  const [result, setResult] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [actionError, setActionError] = React.useState('');
  const [notice, setNotice] = React.useState('');
  const [saved, setSaved] = React.useState({ favorites: [], updateCount: 0, postUpdateCount: 0, lastCheckedAt: 0 });
  const [stateReady, setStateReady] = React.useState(false);
  const [checking, setChecking] = React.useState(false);
  const [busy, setBusy] = React.useState({});
  const [refresh, setRefresh] = React.useState(0);
  const [selected, setSelected] = React.useState(null);
  const [progress, setProgress] = React.useState(null);
  const request = React.useRef(0);
  const checkLock = React.useRef(false);
  const favoriteLocks = React.useRef(new Set());
  const forceRefresh = React.useRef(false);
  const pageStates = React.useRef(new Map());
  const lastFixedView = React.useRef('updates');
  const stateVersion = React.useRef(0);
  const observedCheck = React.useRef(false);
  const section = React.useRef(null);
  const favorites = React.useMemo(() => new Map(saved.favorites.map(item => [authorKey(item), item])), [saved]);
  const postsMode = view === 'posts' || !!creator;
  const updatesMode = view === 'updates' && !creator;
  const contentMode = postsMode || updatesMode;
  const activeTab = creator ? 'author:' + authorKey(creator) : view;
  const tabId = key => source + '-tab-' + encodeURIComponent(key);
  const panelId = source + '-page-content';
  const isChecking = checking || saved.checking;

  React.useEffect(() => window.api['on' + label + 'Progress'](setProgress), [source]);
  React.useEffect(() => window.api['on' + label + 'StateChanged'](value => {
    stateVersion.current++;
    if (value.error) { setActionError(value.error); return; }
    const finished = observedCheck.current && !value.checking;
    observedCheck.current = !!value.checking;
    setSaved(value); setStateReady(true);
    if (!value.checking) setProgress(null);
    if (finished) setRefresh(tick => tick + 1);
  }), [source]);
  React.useEffect(() => {
    if (!isActive) return;
    const tab = document.getElementById(tabId(activeTab));
    const strip = tab?.closest('.paw-author-tabs');
    if (!strip || !tab) return;
    function reveal() {
      const tabRect = tab.parentElement.getBoundingClientRect(), stripRect = strip.getBoundingClientRect();
      if (tabRect.left < stripRect.left) strip.scrollLeft += tabRect.left - stripRect.left;
      else if (tabRect.right > stripRect.right) strip.scrollLeft += tabRect.right - stripRect.right;
    }
    reveal();
    const observer = new ResizeObserver(reveal);
    observer.observe(strip);
    return () => observer.disconnect();
  }, [activeTab, isActive, authorTabs]);

  React.useEffect(() => {
    let cancelled = false;
    const version = stateVersion.current;
    sourceCall('GetState').then(value => { if (!cancelled && version === stateVersion.current) { setSaved(value); setStateReady(true); observedCheck.current = !!value.checking; } })
      .catch(error => { if (!cancelled) setActionError(error.message); });
    return () => { cancelled = true; };
  }, [refresh]);

  React.useEffect(() => {
    const current = ++request.current;
    setLoading(true);
    setError('');
    setResult(null);
    const options = { query, offset, service, sort, creator, favoritesOnly: view === 'favorites' || view === 'updates', unreadOnly: view === 'updates', force: forceRefresh.current };
    forceRefresh.current = false;
    sourceCall(updatesMode ? 'GetUpdates' : postsMode ? 'ListPosts' : 'ListCreators', options).then(value => {
      if (request.current !== current) return;
      setResult(value);
      if (value.offset !== offset) setOffset(value.offset);
    }).catch(error => { if (request.current === current) setError(error.message); })
      .finally(() => { if (request.current === current) setLoading(false); });
    return () => { request.current++; };
  }, [view, creator, query, service, sort, offset, refresh, postsMode, updatesMode]);

  function switchPage(nextView, nextCreator = null) {
    const nextTab = nextCreator ? 'author:' + authorKey(nextCreator) : nextView;
    setSelected(null);
    if (nextTab === activeTab) return;
    pageStates.current.set(activeTab, { input, query, service, sort, offset });
    const previous = pageStates.current.get(nextTab) || { input: '', query: '', service: '', sort: 'updated', offset: 0 };
    request.current++;
    setResult(null); setLoading(true); setError(''); setNotice('');
    setView(nextView); setCreator(nextCreator);
    setInput(previous.input); setQuery(previous.query); setService(previous.service); setSort(previous.sort); setOffset(previous.offset);
  }
  function navigate(nextView) {
    lastFixedView.current = nextView;
    switchPage(nextView);
  }
  function openAuthor(author) {
    const key = authorKey(author);
    const existing = authorTabs.find(item => authorKey(item) === key);
    const next = existing || author;
    if (!existing) setAuthorTabs(tabs => tabs.some(item => authorKey(item) === key) ? tabs : [...tabs, author]);
    switchPage(view, next);
  }
  function back() {
    navigate(lastFixedView.current);
  }
  function closeAuthor(author) {
    const key = authorKey(author);
    const index = authorTabs.findIndex(item => authorKey(item) === key);
    if (index < 0) return;
    const remaining = authorTabs.filter(item => authorKey(item) !== key);
    setAuthorTabs(remaining);
    if (creator && authorKey(creator) === key) {
      const next = remaining[Math.min(index, remaining.length - 1)];
      if (next) switchPage(view, next); else navigate(lastFixedView.current);
      requestAnimationFrame(() => document.getElementById(tabId(next ? 'author:' + authorKey(next) : lastFixedView.current))?.focus());
    }
    pageStates.current.delete('author:' + key);
  }
  function tabKeyboard(event) {
    if (event.target.getAttribute('role') !== 'tab') return;
    if (event.key === 'Delete' && creator) { event.preventDefault(); closeAuthor(creator); return; }
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const tabs = [...event.currentTarget.querySelectorAll('[role="tab"]')];
    const index = tabs.indexOf(event.target);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[next]?.click(); tabs[next]?.focus();
  }
  function cardAction(open, label) {
    return { tabIndex: 0, 'aria-label': label,
      onClick: event => { if (!event.target.closest('button, a, input, select, textarea') && !window.getSelection()?.toString()) open(); },
      onKeyDown: event => { if (event.target === event.currentTarget && ['Enter', ' '].includes(event.key)) { event.preventDefault(); open(); } } };
  }
  async function openExternal(url) {
    try {
      if (!['https:', 'http:'].includes(new URL(url).protocol)) throw new Error('链接地址无效');
      const result = await window.api.openExternalUrl(url);
      if (result?.error) throw new Error(result.error);
    } catch (error) { setActionError(error.message); }
  }
  async function toggleFavorite(author) {
    const key = authorKey(author);
    if (!stateReady || favoriteLocks.current.has(key)) return;
    favoriteLocks.current.add(key); setBusy(value => ({ ...value, [key]: true })); setActionError('');
    try {
      const favorite = !favorites.has(key);
      setSaved(await sourceCall('SetFavorite', { creator: author, favorite }));
      setNotice(favorite ? `已收藏 ${author.name}，可检查后续更新` : `已取消收藏 ${author.name}`);
      if (!postsMode) setRefresh(value => value + 1);
    } catch (error) { setActionError(error.message); }
    finally { favoriteLocks.current.delete(key); setBusy(value => ({ ...value, [key]: false })); setProgress(null); }
  }
  async function checkUpdates() {
    if (checkLock.current) return;
    checkLock.current = true; setChecking(true); setActionError(''); setNotice('');
    try {
      const value = await sourceCall('CheckUpdates');
      setSaved(value);
      setNotice(`${value.failures.length ? '部分检查完成' : '检查完成'}：${value.checked} / ${value.total} 位作者，${value.postUpdateCount} 条未读更新。${value.baselines ? ` 已为 ${value.baselines} 位作者建立首次记录。` : ''}`);
      if (value.failures.length) setActionError(value.failures.map(item => `${item.creator.name}：${item.error}`).join('；') + '。失败作者的上次记录已保留。');
      if (!postsMode) setRefresh(tick => tick + 1);
    } catch (error) { setActionError(`检查更新失败：${error.message}。上次检查结果已保留。`); }
    finally { checkLock.current = false; setChecking(false); setProgress(null); }
  }
  async function markRead(author) {
    setActionError('');
    try {
      setSaved(await sourceCall('MarkRead', { creator: author, token: author.readToken }));
      if (!postsMode) setRefresh(value => value + 1);
    } catch (error) { setActionError(error.message); }
  }
  function reload() {
    forceRefresh.current = true; setActionError(''); setRefresh(value => value + 1);
  }
  async function markPostRead(post) {
    try {
      setSaved(await sourceCall('MarkRead', { creator: post.creator, postId: post.id, token: post.changeToken }));
      setRefresh(value => value + 1);
    } catch (error) { setActionError(error.message); }
  }
  function search(event) {
    event.preventDefault();
    const next = input.trim();
    if (postsMode && next && [...next].length < 3) { setActionError('内容搜索需要至少 3 个字符；作者名称搜索不受此限制。'); return; }
    setActionError(''); setQuery(next); setOffset(0);
    if (next === query) setRefresh(value => value + 1);
  }
  const closeDialog = React.useCallback(() => setSelected(null), []);
  function favoriteButton(author) {
    const key = authorKey(author), favorite = favorites.has(key);
    return h('button', { className: `paw-button paw-favorite ${favorite ? 'is-favorite' : ''}`, disabled: !stateReady || !!busy[key],
      onClick: () => toggleFavorite(author), 'aria-pressed': favorite, title: favorite ? `取消收藏 ${author.name}` : `收藏作者 ${author.name}` },
    busy[key] ? '保存中…' : favorite ? '★ 已收藏' : '☆ 收藏作者');
  }
  function creatorCard(author) {
    const favorite = favorites.get(authorKey(author));
    return h('article', { className: 'paw-creator-card', key: authorKey(author), 'data-author-id': author.id, 'data-author-service': author.service,
      ...cardAction(() => openAuthor(author), `打开 [${author.service}] ${author.name} 的内容`) },
      h('div', { className: 'paw-creator-top' }, h('div', { className: 'paw-avatar' }, h(Image, { src: author.avatar, avatar: true })),
        h('span', { className: 'paw-service' }, author.service), favorite?.unread && h('span', { className: 'paw-update-badge' }, `${favorite.changesCount} 条更新`)),
      h('button', { className: 'paw-creator-name', onClick: () => openAuthor(author), title: author.name }, author.name),
      h('div', { className: 'paw-muted paw-author-id' }, `ID: ${author.id}`),
      h('div', { className: 'paw-creator-stats' }, h('span', null, `♡ ${number(author.favorited)} 人收藏`), h('span', null, '更新 ', date(author.updated))),
      author.missing && h('p', { className: 'paw-notice' }, '作者暂未收录，收藏已保留'),
      h('div', { className: 'paw-card-actions' }, h('button', { className: 'paw-button', onClick: () => openAuthor(author) }, '查看内容'), favoriteButton(author)),
      favorite?.unread && h('button', { className: 'paw-text-button paw-read-button', onClick: () => markRead(favorite) }, '✓ 标记已读'));
  }
  function postCard(post) {
    return h('article', { className: 'paw-post-card', key: `${post.service}:${post.user}:${post.id}`,
      ...cardAction(() => setSelected(post), `查看 ${post.title} 的详情`) },
      h('button', { className: 'paw-card-image', onClick: () => setSelected(post), 'aria-label': `查看 ${post.title}` },
        h(Image, { src: post.thumbnail, alt: post.title }), h('span', { className: 'paw-image-service' }, post.service),
        post.previewOnly && h('span', { className: 'paw-preview-badge' }, '预览')),
      h('div', { className: 'paw-card-body' },
        post.changeKind && h('span', { className: `paw-change-kind ${post.changeKind}` }, post.changeKind === 'new' ? '新增内容' : '旧帖更新'),
        h('button', { className: 'paw-post-title', onClick: () => setSelected(post), title: post.title }, post.title),
        h('button', { className: 'paw-card-author', onClick: () => openAuthor(post.creator), title: '查看作者内容' }, '🐾 ', post.creator.name),
        h('div', { className: 'paw-post-stats' }, h('time', null, '发布 ', date(post.published)), !post.changeKind && h('span', null, `${post.attachments.length + (post.file ? 1 : 0)} 个附件`)),
        post.edited > 0 && h('div', { className: 'paw-post-stats' }, h('time', null, '编辑 ', date(post.edited))),
        h('div', { className: 'paw-card-actions' }, favoriteButton(post.creator), h('button', { className: 'paw-button', onClick: () => setSelected(post) }, '详情 ↗')),
        post.changeKind && h('button', { className: 'paw-text-button paw-read-button', onClick: () => markPostRead(post) }, '✓ 标记已读')));
  }

  const activeAuthor = creator && (favorites.get(authorKey(creator)) || creator);
  const searchField = h('form', { className: creator ? 'paw-author-search' : 'paw-search-form', onSubmit: search },
    h('div', { className: 'paw-search' }, h('span', { 'aria-hidden': true }, '⌕'),
      h('input', { type: 'search', value: input, onChange: event => setInput(event.target.value), 'aria-label': contentMode ? '搜索内容' : '搜索作者',
        placeholder: postsMode ? (creator ? '搜索这位作者的内容（至少 3 个字符）' : '搜索内容、角色或 Mod（至少 3 个字符）') : updatesMode ? '搜索更新标题或作者…' : '搜索作者名称或 ID…', maxLength: 200 }),
      input && h('button', { type: 'button', className: 'paw-search-clear', 'aria-label': '清空搜索', onClick: () => { setInput(''); setQuery(''); setOffset(0); setActionError(''); } }, '✕')),
    h('button', { className: 'paw-button', type: 'submit' }, '搜索'));
  return h('section', { className: 'pawchive-view', ref: section, 'aria-label': label },
    h('header', { className: 'paw-header' }, h('div', null,
      h('h2', null, label)),
      h('div', { className: 'paw-header-actions' },
        h('button', { className: 'paw-button', onClick: () => openExternal(site) }, '打开网站 ↗'),
        h('button', { className: 'paw-button', onClick: reload, disabled: loading }, loading ? '加载中…' : '↻ 刷新'),
        h('button', { className: 'paw-button paw-primary', onClick: checkUpdates, disabled: isChecking || !stateReady || !saved.favorites.length,
          title: saved.favorites.length ? '检查收藏作者的新增内容和旧帖编辑' : '收藏作者后即可检查更新' }, isChecking ? '正在检查…' : '↻ 检查更新'))),
    h('div', { className: 'paw-summary' },
      h('span', null, '已收藏 ', h('strong', null, saved.favorites.length), ' 位作者'),
      h('span', { className: saved.postUpdateCount ? 'paw-unread-count' : '' }, h('strong', null, saved.postUpdateCount), ' 条未读更新'),
      h('span', { className: 'paw-last-check' }, saved.lastCheckedAt ? `上次检查 ${date(saved.lastCheckedAt)}` : '收藏保存在本机 · 尚未检查更新')),
    h('nav', { className: 'paw-tabs', role: 'tablist', 'aria-label': label + ' 标签页', onKeyDown: tabKeyboard },
      h('div', { className: 'paw-fixed-tabs' }, ...[
        ['updates', `有更新 ${saved.postUpdateCount}`], ['favorites', `我的收藏 ${saved.favorites.length}`], ['creators', '作者'], ['posts', '最新内容']
      ].map(([id, title]) => h('button', { key: id, id: tabId(id), className: activeTab === id ? 'active' : '', role: 'tab',
        'aria-selected': activeTab === id, 'aria-controls': panelId, tabIndex: activeTab === id ? 0 : -1, onClick: () => navigate(id) }, title))),
      !!authorTabs.length && h('div', { className: 'paw-tab-divider', 'aria-hidden': true }),
      !!authorTabs.length && h('div', { className: 'paw-author-tabs', onWheel: event => {
        if (!event.deltaX && event.currentTarget.scrollWidth > event.currentTarget.clientWidth) event.currentTarget.scrollLeft += event.deltaY;
      } }, ...authorTabs.map(author => {
        const key = 'author:' + authorKey(author), selected = activeTab === key;
        const title = `[${author.service}] ${author.name}`;
        return h('div', { key, className: `paw-author-tab ${selected ? 'active' : ''}` },
          h('button', { id: tabId(key), role: 'tab', 'aria-label': title, title, 'aria-selected': selected, 'aria-controls': panelId,
            tabIndex: selected ? 0 : -1, onClick: () => switchPage(view, author) },
            h('span', { className: 'paw-service' }, author.service), h('span', { className: 'paw-tab-name' }, author.name)),
          h('button', { className: 'paw-tab-close', onClick: () => closeAuthor(author), title: '关闭标签页', 'aria-label': `关闭 ${title} 标签页`, tabIndex: selected ? 0 : -1 }, '✕'));
      }))),
    h('div', { id: panelId, role: 'tabpanel', 'aria-labelledby': tabId(activeTab) },
    creator && h('div', { className: 'paw-author-banner' },
      h('button', { className: 'paw-button', onClick: back }, '← 返回'),
      h('div', { className: 'paw-avatar' }, h(Image, { src: creator.avatar, avatar: true })),
      h('div', { className: 'paw-author-heading' }, h('h2', null, activeAuthor.name), h('span', { className: 'paw-muted' }, `${creator.service} · ${creator.id}`)),
      searchField,
      activeAuthor.unread && h('button', { className: 'paw-button', onClick: () => markRead(activeAuthor) }, '✓ 标记已读'), favoriteButton(creator),
      h('button', { className: 'paw-button', onClick: () => openExternal(creator.url) }, '作者主页 ↗')),
    !creator && h('div', { className: 'paw-toolbar' }, searchField,
      !postsMode && h('select', { value: service, onChange: event => { setService(event.target.value); setOffset(0); }, 'aria-label': '筛选来源平台' },
        h('option', { value: '' }, '全部平台'), ...(result?.services || (service ? [service] : [])).map(item => h('option', { value: item, key: item }, item))),
      !contentMode && h('select', { value: sort, onChange: event => { setSort(event.target.value); setOffset(0); }, 'aria-label': '排序方式' },
        h('option', { value: 'updated' }, '最近更新'), h('option', { value: 'popular' }, '最多收藏'), h('option', { value: 'name' }, '名称排序')),
      h('span', { className: 'paw-result-count' }, loading ? '正在获取…' : result ? contentMode ? `本页 ${result.items.length} 条内容` : `共 ${number(result.total)} 位作者` : '')),
    progress && h('div', { className: 'paw-notice', role: 'status' },
      `${progress.operation === 'favorite' ? '正在建立收藏记录' : '检查进度'} · ${progress.completedAuthors} / ${progress.totalAuthors} 位作者 · ${progress.author}${progress.done ? ' 完成' : ` · 第 ${progress.pages} 页，${progress.posts} 条内容`}`),
    actionError && h('div', { className: 'paw-alert', role: 'alert' }, h('span', null, actionError),
      h('button', { className: 'paw-icon-button', 'aria-label': '关闭提示', onClick: () => setActionError('') }, '✕')),
    notice && h('div', { className: 'paw-notice', role: 'status' }, notice),
    saved.autoCheckError && h('div', { className: 'paw-alert', role: 'alert' }, saved.autoCheckError),
    result?.warning && h('div', { className: 'paw-notice', role: 'status' }, result.warning, result.cachedAt ? `（缓存时间 ${date(result.cachedAt)}）` : ''),
    error ? h('div', { className: 'paw-empty', role: 'alert' }, h('div', { className: 'paw-empty-icon' }, '☁'), h('h2', null, '暂时无法加载'),
      h('p', null, error), h('button', { className: 'paw-button paw-primary', onClick: reload }, '重新加载')) :
    loading ? h('div', { className: 'paw-grid', 'aria-busy': true, 'aria-label': `正在加载 ${label} 内容` },
      ...Array.from({ length: 8 }, (_, index) => h('div', { className: 'paw-skeleton', key: index }, h('div'), h('span'), h('span')))) :
    !result?.items.length ? h('div', { className: 'paw-empty' }, h('div', { className: 'paw-empty-icon' }, view === 'updates' ? '✓' : '🐾'),
      h('h2', null, query || service ? '没有找到匹配的内容' : updatesMode ? '暂无未读更新' : !creator && view === 'favorites' ? '还没有收藏作者' : '这里暂时没有内容'),
      h('p', null, query || service ? '试试其他关键词，或清空筛选条件。' : updatesMode ? '每天自动检查一次，也可以点击“检查更新”立即检查。' : !creator && view === 'favorites' ? '在作者或内容卡片上点击“收藏作者”，下次就能在这里找到。' : '稍后刷新，或前往网站看看。'),
      !creator && view === 'favorites' && !query && h('button', { className: 'paw-button paw-primary', onClick: () => navigate('creators') }, '发现作者')) :
    h('div', { className: `paw-grid ${contentMode ? '' : 'paw-creators-grid'}` }, ...result.items.map(contentMode ? postCard : creatorCard)),
    result && !loading && (offset > 0 || result.hasMore) && h('div', { className: 'paw-pagination' },
      h('button', { className: 'paw-button', disabled: offset === 0, onClick: () => { setOffset(Math.max(0, offset - result.pageSize)); section.current?.scrollIntoView({ block: 'start' }); } }, '← 上一页'),
      h('span', null, `第 ${Math.floor(offset / result.pageSize) + 1} 页${result.total != null ? ` / ${Math.max(1, Math.ceil(result.total / result.pageSize))}` : ''}`),
      h('button', { className: 'paw-button', disabled: !result.hasMore, onClick: () => { setOffset(offset + result.pageSize); section.current?.scrollIntoView({ block: 'start' }); } }, '下一页 →')),
    h('p', { className: 'paw-footnote' }, '应用运行时按本机日期每天自动检查一次；当天首次启动补查，同时关注新增内容与旧帖编辑。')),
    selected && isActive && h(PostDialog, { selected, posts: result?.items || [], source, onSelect: setSelected,
      onClose: closeDialog, openExternal, onAuthor: openAuthor, favoriteButton, onMarkRead: markPostRead, Download: RevivalDownload }));
}
