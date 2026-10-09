import { r as React } from './index.js';
const h = React.createElement;
const check = result => { if (!result?.success) throw Error(result?.error || '操作失败'); return result; };
const button = (text, props = {}) => h('button', { type: 'button', className: 'system-button', ...props }, text);
const UNKNOWN = '__unlinked__';

export function openPersistManager(gameId, characterName, modName) {
  sessionStorage.setItem('qaqm.persist.target', JSON.stringify({ gameId, characterName, modName }));
  sessionStorage.setItem('qaqm.settings.category', 'persist');
  window.dispatchEvent(new CustomEvent('qaqm:settings-section', { detail: { category: 'persist' } }));
  window.dispatchEvent(new CustomEvent('qaqm-navigate', { detail: { tab: 'settings' } }));
}
function initialLocation(gameId) {
  if (gameId) return { gameId };
  try {
    const saved = sessionStorage.getItem('qaqm.persist.target');
    sessionStorage.removeItem('qaqm.persist.target');
    return saved ? JSON.parse(saved) : {};
  } catch { return {}; }
}
export function PersistVariables({ entries }) {
  return h('div', { className: 'persist-entries' }, entries.map(entry => h('details', { key: entry.id, className: 'persist-file', open: entries.length === 1, 'data-persist-entry': entry.id },
    h('summary', null, entry.iniPath || entry.title, h('span', null, ` · ${entry.variables.length} 个变量`)),
    entry.modifiedAt && h('p', { className: 'persist-meta' }, `更新时间：${new Date(entry.modifiedAt).toLocaleString()}`),
    h('table', { className: 'persist-variables' }, h('thead', null, h('tr', null, h('th', null, '变量'), h('th', null, '保存值'))),
      h('tbody', null, entry.variables.map((variable, index) => h('tr', { key: index }, h('td', null, variable.name), h('td', null, variable.value))))))));
}
export default function PersistStateBrowser({ gameId = null }) {
  const [at, setAt] = React.useState(() => initialLocation(gameId));
  const [data, setData] = React.useState(null), [error, setError] = React.useState(''), [message, setMessage] = React.useState('');
  const [busy, setBusy] = React.useState(false), [revision, setRevision] = React.useState(0);
  const [search, setSearch] = React.useState(''), [page, setPage] = React.useState(0), [confirm, setConfirm] = React.useState(null);
  const lock = React.useRef(false), isMod = !!at.modName;
  React.useEffect(() => {
    let canceled = false;
    setData(null); setError('');
    const request = !at.gameId ? window.api.persistBridgeGames()
      : isMod && at.characterName !== UNKNOWN ? window.api.persistBridgeMod(at.gameId, at.characterName, at.modName)
      : window.api.persistBridgeList(at.gameId, { metadataOnly: !isMod, ids: isMod ? at.ids : undefined, refresh: revision > 0 });
    request.then(check).then(result => { if (!canceled) setData(result); }).catch(e => { if (!canceled) setError(e.message); });
    return () => { canceled = true; };
  }, [at, revision]);
  function navigate(target) { if (!busy) { setData(null); setAt(target); setPage(0); setSearch(''); setConfirm(null); setMessage(''); } }
  async function act(action, success) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setMessage('');
    try { check(await action()); setConfirm(null); setMessage(success); setRevision(value => value + 1); }
    catch (e) { setError(e.message); }
    finally { lock.current = false; setBusy(false); }
  }
  const toggle = game => h('input', { type: 'checkbox', role: 'switch', className: 'system-switch', checked: game.enabled, disabled: busy,
    'aria-label': `${game.name} Mod 状态保存`, onChange: event => { const value = event.target.checked; act(() => window.api.persistBridgeSetEnabled(game.id, value), '设置已保存，请重启管理器和该游戏。已有保存内容会保留。'); } });
  const notices = h(React.Fragment, null,
    error && h('div', { className: 'system-notice persist-error', role: 'alert' }, error, button('重试', { onClick: () => setRevision(value => value + 1) })),
    message && h('div', { className: 'system-notice', role: 'status' }, message),
    !data && !error && h('div', { className: 'system-state', role: 'status' }, '正在读取保存内容…'));
  if (!at.gameId) return h('div', { className: 'persist-manager', 'aria-busy': busy },
    h('p', { className: 'system-notice' }, '按「游戏 → 角色 → Mod」管理保存内容，保存数量无上限。关闭开关不会删除数据。'), notices,
    data?.games && h('div', { className: 'persist-game-grid' }, data.games.map(game => h('article', { key: game.id, className: 'system-card persist-game-card', 'data-persist-game': game.id },
      h('div', { className: 'persist-game-heading' }, h('h3', null, game.name), toggle(game)), h('p', null, `${game.enabled ? '已启用' : '未启用'} · ${game.count} 份配置`),
      !game.configured && h('small', null, '尚未配置 Mods 目录'), button('查看角色', { disabled: busy, 'aria-label': `管理${game.name}保存内容`, onClick: () => navigate({ gameId: game.id }) })))));
  const entries = data?.entries || [], groups = new Map(), query = search.trim().toLowerCase();
  if (!isMod) for (const entry of entries) {
    const character = entry.characterName || UNKNOWN;
    if (at.characterName && character !== at.characterName) continue;
    const name = at.characterName ? entry.modName || entry.name || entry.id : character;
    if (!groups.has(name)) groups.set(name, { name, title: name === UNKNOWN ? '未关联内容' : name, entries: [], mods: new Set() });
    const group = groups.get(name); group.entries.push(entry); group.mods.add(entry.modName || entry.id);
  }
  const items = (isMod ? entries : [...groups.values()].sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'))).filter(item =>
    !query || (isMod ? [item.iniPath, ...item.variables.flatMap(variable => [variable.name, variable.value])] : [item.title, ...item.mods]).some(value => value?.toLowerCase().includes(query)));
  const pageCount = Math.max(1, Math.ceil(items.length / 36)), currentPage = Math.min(page, pageCount - 1), visible = items.slice(currentPage * 36, (currentPage + 1) * 36);
  const title = at.modName || (at.characterName === UNKNOWN ? '未关联内容' : at.characterName) || data?.game?.name;
  const deleteIds = (ids, label) => setConfirm({ ids, label, count: ids?.length ?? entries.length });
  return h('div', { className: 'persist-manager', 'data-persist-detail': at.gameId, 'data-persist-level': isMod ? 'mod' : at.characterName ? 'character' : 'game', 'aria-busy': busy },
    h('nav', { className: 'persist-breadcrumbs', 'aria-label': '状态管理路径' },
      !gameId && button('所有游戏', { disabled: busy, onClick: () => navigate({}) }),
      button(data?.game?.name || '游戏', { disabled: busy || !at.characterName, onClick: () => navigate({ gameId: at.gameId }) }),
      at.characterName && button(at.characterName === UNKNOWN ? '未关联内容' : at.characterName, { disabled: busy || !isMod, onClick: () => navigate({ gameId: at.gameId, characterName: at.characterName }) }),
      isMod && h('span', { 'aria-current': 'page' }, at.modName)), notices,
    data?.game && h(React.Fragment, null,
      h('div', { className: 'persist-detail-heading' }, h('div', null, h('h3', null, title), h('p', null, isMod ? `${entries.length} 份配置 · ${entries.reduce((sum, entry) => sum + entry.variables.length, 0)} 个变量` : `${groups.size} 个${at.characterName ? ' Mod' : '角色 / 分类'}`)),
        !at.characterName ? toggle(data.game) : isMod && data.modExists && button('打开 Mod 详情', { disabled: busy, onClick: () => window.dispatchEvent(new CustomEvent('qaqm-open-manager-target', { detail: at })) })),
      !at.characterName && h('p', { className: 'system-notice' }, '选择角色后查看对应 Mod。关闭只停止接管，保存内容仅由你手动删除。'),
      at.characterName === UNKNOWN && h('p', { className: 'system-notice' }, '这些保存内容暂时找不到对应的本地 Mod，数据仍完整保留。'),
      h('div', { className: 'persist-toolbar' }, h('input', { type: 'search', className: 'system-text-input', 'aria-label': '搜索保存内容', placeholder: isMod ? '搜索变量或配置…' : at.characterName ? '搜索 Mod…' : '搜索角色或 Mod…', value: search, onChange: e => { setSearch(e.target.value); setPage(0); } }),
        button('刷新', { disabled: busy, onClick: () => setRevision(value => value + 1) }),
        !at.characterName && button('清空此游戏', { disabled: busy || !entries.length, onClick: () => deleteIds(null, data.game.name) }),
        isMod && button('删除此 Mod 保存', { disabled: busy || !entries.length, onClick: () => deleteIds(entries.map(entry => entry.id), at.modName) })),
      confirm && h('div', { className: 'persist-confirm', role: 'alert' }, h('p', null, `确认删除「${confirm.label}」的 ${confirm.count} 份保存配置？其他保存内容会保留。删除后请重启管理器和游戏。`),
        button('确认删除', { disabled: busy, onClick: () => act(() => confirm.ids ? window.api.persistBridgeDelete(at.gameId, confirm.ids) : window.api.clearPersistCache(at.gameId), '保存内容已删除，请重启管理器和该游戏。') }), button('取消', { disabled: busy, onClick: () => setConfirm(null) })),
      !items.length && h('div', { className: 'system-state' }, query ? '没有匹配的内容' : isMod ? '此 Mod 暂无保存配置' : '暂无保存内容'),
      !isMod && h('div', { className: 'persist-group-grid' }, visible.map(group => h('button', { key: group.name, type: 'button', className: 'system-card persist-group-card', disabled: busy,
        'data-persist-character': !at.characterName ? group.name : undefined, 'data-persist-mod': at.characterName ? group.name : undefined,
        onClick: () => navigate(at.characterName ? { gameId: at.gameId, characterName: at.characterName, modName: group.name, ids: group.entries.map(entry => entry.id) } : { gameId: at.gameId, characterName: group.name }) },
        h('span', { className: 'persist-group-avatar', 'aria-hidden': true }, (group.name === UNKNOWN ? '?' : group.title).slice(0, 1)), h('span', null, h('strong', null, group.title),
          h('small', null, at.characterName ? `${group.entries.length} 份配置${group.entries.some(entry => entry.active) ? ' · Mod 已启用' : ''}` : `${group.mods.size} 个 Mod · ${group.entries.length} 份配置`)), h('span', { 'aria-hidden': true }, '›')))),
      isMod && h('div', { className: 'persist-entries' }, visible.map(entry => h('article', { key: entry.id, className: 'system-card persist-entry' }, h('div', { className: 'persist-entry-content' },
        h(PersistVariables, { entries: [entry] }), button('删除此项', { disabled: busy, onClick: () => deleteIds([entry.id], entry.iniPath) }))))),
      pageCount > 1 && h('div', { className: 'persist-pagination' }, button('上一页', { disabled: busy || currentPage === 0, onClick: () => setPage(currentPage - 1) }), h('span', null, `${currentPage + 1} / ${pageCount}`), button('下一页', { disabled: busy || currentPage + 1 >= pageCount, onClick: () => setPage(currentPage + 1) }))));
}
