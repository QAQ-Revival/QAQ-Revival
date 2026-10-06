import { r as React, ThemeContext } from './index.js';
import { e as evaluateXxmiImporterPathConsistency } from './xxmiPaths.js';
import { useGameOrder } from './useGameOrder.js';
import { SoftwareUpdateSettings } from './SoftwareUpdates.js';

const h = React.createElement;
const DEFAULT_SERVER = 'https://qaqm.top';
const CATEGORIES = [
  { id: 'general', icon: 'sliders', label: '通用', desc: '管理窗口行为和 Mod 状态保存。', items: [['window', '窗口行为'], ['persist', '预设与状态']] },
  { id: 'appearance', icon: 'palette', label: '外观与显示', desc: '调整主题、界面大小和显示效果。', items: [['theme', '界面主题'], ['scale', '界面大小'], ['compatibility', '显示兼容性']] },
  { id: 'games', icon: 'game', label: '游戏与路径', desc: '集中管理所有游戏的路径，每个游戏单独保存。', items: [] },
  { id: 'downloads', icon: 'download', label: '下载与网络', desc: '管理共用的下载目录和 Mod 市场连接。', items: [['cache', '下载存储'], ['server', '市场服务器']] },
  { id: 'shortcuts', icon: 'keyboard', label: '快捷键', desc: '设置游戏内 Mod 面板的呼出方式。', items: [['overlay', '局内面板']] },
  { id: 'maintenance', icon: 'tool', label: '维护工具', desc: '更新已有加载器，或排查 Mod 使用问题。', items: [['updates', '加载器更新'], ['help', '故障排查']] },
  { id: 'about', icon: 'info', label: '关于与更新', desc: '应用版本与 GitHub 更新检查。', items: [] }
];
const ICONS = {
  sliders: ['M4 7h16M4 17h16M8 4v6M16 14v6'],
  palette: ['M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1-3.7 1.5 1.5 0 0 1 1-2.8h2A4 4 0 0 0 21 10a9 9 0 0 0-9-7', 'M7 10h.01M10 6h.01M15 7h.01M6 14h.01'],
  game: ['M7 7h10a3 3 0 0 1 3 2l2 8a2 2 0 0 1-3.4 1.8L15 16H9l-3.6 2.8A2 2 0 0 1 2 17l2-8a3 3 0 0 1 3-2', 'M6 11h4M8 9v4M16 11h.01M18 13h.01'],
  download: ['M12 3v12m-4-4 4 4 4-4M4 15v5h16v-5'],
  keyboard: ['M3 5h18v14H3zM6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M8 16h8'],
  tool: ['M14 4a5 5 0 0 0-6 6L3 16a3 3 0 0 0 4 4l6-6a5 5 0 0 0 6-6l-3 3-3-3 3-3z'],
  info: ['M12 8h.01M12 11v6', 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0']
};
function Icon({ name }) {
  return h('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, (ICONS[name] || ICONS.info).map((d, i) => h('path', { key: i, d })));
}
function Button({ children, primary, ...props }) {
  return h('button', { type: 'button', className: `system-button${primary ? ' primary' : ''}`, ...props }, children);
}
function Section({ id, title, children }) {
  return h('section', { id: `settings-${id}`, className: 'system-section', 'aria-labelledby': `heading-${id}` }, h('h3', { id: `heading-${id}` }, title), h('div', { className: 'system-card' }, children));
}
function Row({ title, description, children, stacked = false }) {
  return h('div', { className: `system-row${stacked ? ' stacked' : ''}` }, h('div', { className: 'system-row-copy' }, h('div', { className: 'system-row-title' }, title), description && h('p', null, description)), children && h('div', { className: 'system-row-control' }, children));
}
function PathControl({ label, value, onSelect, disabled, children }) {
  return h('div', { className: 'system-path-control' },
    h('input', { className: 'system-path', readOnly: true, value: value || '', placeholder: '未设置', title: value || '未设置', 'aria-label': label }),
    value && h(Button, { disabled, onClick: () => window.api.openPathInExplorer(value), 'aria-label': `打开${label}所在位置` }, '打开位置'), children,
    onSelect && h(Button, { disabled, onClick: onSelect, 'aria-label': `选择${label}` }, '选择'));
}
function Choices({ label, value, options, onChange, disabled }) {
  return h('div', { className: 'system-choices', role: 'group', 'aria-label': label }, options.map(option => h('button', { key: option.value, type: 'button', className: 'system-choice', 'aria-pressed': value === option.value, onClick: () => onChange(option.value), disabled }, h('strong', null, option.label), option.desc && h('span', null, option.desc))));
}
function Range({ label, value, min, max, step = 1, onChange, suffix = '%', disabled }) {
  const [draft, setDraft] = React.useState(String(value));
  const saving = React.useRef(false);
  const hintId = React.useId();
  React.useEffect(() => { setDraft(String(value)); }, [value]);
  function valid(text) {
    if (!/^\d+(?:\.\d+)?$/.test(text)) return false;
    const number = Number(text);
    const steps = (number - min) / step;
    return Number.isFinite(number) && number >= min && number <= max && Math.abs(steps - Math.round(steps)) < 1e-8;
  }
  const isValid = valid(draft);
  async function commit(text) {
    if (disabled || saving.current || !valid(text) || Number(text) === value) return;
    saving.current = true;
    try { await onChange(Number(text)); } finally { saving.current = false; }
  }
  return h('div', { className: 'system-range' },
    h('input', { type: 'range', 'aria-label': label, min, max, step, value: isValid ? Number(draft) : value, disabled,
      onChange: e => setDraft(e.target.value), onPointerUp: e => commit(e.currentTarget.value),
      onKeyUp: e => commit(e.currentTarget.value), onBlur: e => commit(e.currentTarget.value),
      onPointerCancel: () => setDraft(String(value)) }),
    h('div', { className: 'system-range-editor' }, h('input', { type: 'text', inputMode: step % 1 === 0 ? 'numeric' : 'decimal', autoComplete: 'off', spellCheck: false,
      className: `system-range-number ${isValid ? 'is-valid' : 'is-invalid'}`, 'aria-label': `${label}数值`, 'aria-invalid': !isValid,
      'aria-describedby': !isValid ? hintId : undefined, title: '输入数值后按 Enter 或离开输入框保存', value: draft, disabled,
      onChange: e => setDraft(e.target.value), onBlur: e => commit(e.currentTarget.value), onKeyDown: e => {
        if (e.key === 'Enter') { e.preventDefault(); commit(e.currentTarget.value); }
        if (e.key === 'Escape') { e.preventDefault(); setDraft(String(value)); }
      } }), h('span', { className: 'system-range-unit' }, suffix.trim())),
    !isValid && h('small', { id: hintId, className: 'system-range-error', role: 'alert' }, `请输入 ${min}–${max} 范围内${step === 1 ? '的整数' : `、步长为 ${step} 的数值`}，当前输入未保存。`));
}
function check(result) { if (!result?.success) throw new Error(result?.error || '操作失败，请重试'); return result; }
function remembered(key, fallback) { try { return sessionStorage.getItem(key) || fallback; } catch { return fallback; } }
function remember(key, value) { try { sessionStorage.setItem(key, value); } catch {} }
function applyCompatibility(level) {
  for (const element of [document.documentElement, document.body]) {
    element.classList.toggle('qaqm-compat-mode', level > 0);
    for (let i = 1; i <= 3; i++) element.classList.toggle(`qaqm-compat-level-${i}`, level === i);
  }
  window.dispatchEvent(new CustomEvent('qaqm:compatibility-mode-changed', { detail: { enabled: level > 0, level } }));
}

function GameSettings({ gameId, notify }) {
  const [data, setData] = React.useState(null);
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [revision, setRevision] = React.useState(0);
  React.useEffect(() => {
    let canceled = false;
    setData(null); setError('');
    Promise.all([window.api.gameGetSettings(gameId), window.api.fixGetExePath(gameId), gameId === 'neverness-to-everness' ? window.api.nevernessDx12Status() : null])
      .then(([result, fixer, pak]) => { check(result); if (!canceled) setData({ ...result, fixer: fixer?.exePath || '', pak: pak?.success ? pak : null }); })
      .catch(e => { if (!canceled) setError(e.message); });
    return () => { canceled = true; };
  }, [gameId, revision]);
  async function act(action, message) {
    if (busy) return;
    setBusy(true);
    try {
      const result = await action();
      if (result?.canceled) return;
      check(result); setRevision(v => v + 1); notify('success', result.message || message || '设置已保存');
    } catch (e) { notify('error', e.message); }
    finally { setBusy(false); }
  }
  if (error) return h('div', { className: 'system-state', role: 'alert' }, error, h(Button, { onClick: () => setRevision(v => v + 1) }, '重新加载'));
  if (!data) return h('div', { className: 'system-state', role: 'status' }, '正在读取游戏配置…');
  const game = data.game, isNte = game.id === 'neverness-to-everness';
  const consistency = data.xxmiImporterInfo?.supported && game.modFolderPath && game.modLoaderPath ? evaluateXxmiImporterPathConsistency({ modsPath: game.modFolderPath, importerPath: data.xxmiImporterInfo.importerPath }) : null;
  const pathRow = (title, description, value, action, extra) => h(Row, { title, description, stacked: true }, h(PathControl, { label: title, value, disabled: busy, onSelect: action && (() => act(action)) }, extra));
  return h('div', { className: 'system-game-detail', 'data-game-id': game.id, 'aria-busy': busy },
    h('div', { className: 'system-game-heading' }, h('div', null, h('h3', null, game.name), h('p', null, '此处只编辑该游戏的配置，不会切换正在管理或启动的游戏。')), h(Button, { disabled: busy, onClick: () => act(() => window.api.autoDetectPaths(game.id)) }, '自动检测路径')),
    h(Section, { id: 'game-paths', title: '游戏路径' },
      pathRow('Mods 文件夹', `存放${game.name} Mod 的目录。选择加载器对应的 Mods 文件夹。`, game.modFolderPath, () => window.api.selectModsFolder(game.id)),
      pathRow('游戏程序', isNte ? '选择游戏根目录的 NTELauncher.exe。' : `选择 ${game.executableHint || '游戏主程序'}，用于定位游戏安装位置。`, game.gamePath, () => window.api.selectGamePath(game.id)),
      pathRow(isNte ? 'NEMI 加载器' : 'XXMI 启动器', isNte ? '选择 NEMI 的 Start.cmd 或 3DMigoto Loader.exe。' : '选择 XXMI Launcher.exe。「直接启动」加载该游戏的 Mod；「XXMI 启动」打开启动器界面。', game.modLoaderPath, () => window.api.selectXxmiPath(game.id)),
      consistency && consistency.status !== 'match' && h('div', { className: 'system-notice', role: 'status' }, consistency.status === 'unconfigured' ? '暂时无法读取 XXMI 的游戏包目录，请打开 XXMI 检查对应游戏的配置。' : 'Mods 文件夹与 XXMI 的游戏包目录不一致，请确认二者属于同一套安装。', data.xxmiImporterInfo.importerPath && h('p', null, `XXMI 游戏包目录：${data.xxmiImporterInfo.importerPath}`))),
    isNte && h(Section, { id: 'pak', title: '异环 · Pak 模式' },
      pathRow('Pak Mod 目录', '由异环游戏路径自动确定，用于存放启用的 Pak Mod。', data.pak?.paths?.pakModsDir),
      pathRow('停用 Mod 存储目录', '停用的 Pak Mod 会移到这里；重新启用时移回游戏目录。', data.pak?.paths?.disabledModsDir, () => window.api.nevernessDx12SelectDisabledModsDir(), h(Button, { disabled: busy, onClick: () => act(() => window.api.nevernessDx12ResetDisabledModsDir()) }, '恢复默认')),
      pathRow('Pak 启动器', '可指定 Game start.exe。清空自定义路径后使用内置加载器。', game.dx12LauncherPath || data.pak?.paths?.dx12LoaderExe,
        async () => { const r = await window.api.gameSelectExe('选择 Pak 启动器 Game start.exe'); if (r.canceled) return r; check(r); return window.api.gameUpdate(game.id, { dx12LauncherPath: r.path }); },
        game.dx12LauncherPath && h(Button, { disabled: busy, onClick: () => act(() => window.api.gameUpdate(game.id, { dx12LauncherPath: '' })) }, '使用内置')),
      h(Row, { title: '修复内置 Pak 启动器', description: '内置加载器丢失或损坏时，可从本地安装资源重新安装。' }, h(Button, { disabled: busy, onClick: () => act(() => window.api.nevernessDx12ReinstallLoader(), 'Pak 启动器已重新安装') }, '重新安装'))),
    h(Section, { id: 'fixer', title: '独立修复器与缓存' },
      pathRow('修复器程序', '保存该游戏使用的修复器。角色和 Mod 页面会共用此路径。', data.fixer, () => window.api.fixSelectCustomExe(game.id)),
      h(Row, { title: '清空此游戏的状态缓存', description: '配件切换或 Mod 按键异常时可尝试清空 Persist Bridge 缓存，然后重启该游戏。' },
        h(Button, { disabled: busy, onClick: () => act(() => window.api.clearPersistCache(game.id), '该游戏的状态缓存已清空，请重启游戏。') }, '清空缓存'))));
}

export default function SettingsView({ devMode = false }) {
  const [categoryId, setCategoryId] = React.useState(() => remembered('qaqm.settings.category', 'general'));
  const [selectedGame, setSelectedGame] = React.useState(() => remembered('qaqm.settings.game', 'wuthering-waves'));
  const [games, setGames] = React.useState([]);
  const [appVersion, setAppVersion] = React.useState('');
  const { items: orderedGames } = useGameOrder(games);
  const [config, setConfig] = React.useState(null);
  const [overlay, setOverlay] = React.useState({});
  const [download, setDownload] = React.useState(null);
  const [hotkey, setHotkey] = React.useState('');
  const [closeBehavior, setCloseBehavior] = React.useState('ask');
  const [server, setServer] = React.useState(DEFAULT_SERVER);
  const [loadError, setLoadError] = React.useState('');
  const [toast, setToast] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const busyRef = React.useRef(false);
  const [recording, setRecording] = React.useState(false);
  const [draftHotkey, setDraftHotkey] = React.useState('');
  const [updateResult, setUpdateResult] = React.useState(null);
  const [loadTick, setLoadTick] = React.useState(0);
  const pane = React.useRef(null);
  const theme = React.useContext(ThemeContext);
  const category = CATEGORIES.find(item => item.id === categoryId) || CATEGORIES[0];
  const notify = (type, message) => setToast({ type, message });
  React.useEffect(() => { window.api.getRuntimeInfo().then(info => setAppVersion(info.appVersion || '')).catch(() => {}); }, []);
  React.useEffect(() => {
    let canceled = false;
    setLoadError('');
    Promise.all([window.api.getConfig(), window.api.gameList(), window.api.overlayGetSettings(), window.api.marketGetDownloadSettings(), window.api.getOverlayHotkey(), window.api.getCloseBehavior()])
      .then(([c, g, o, d, k, b]) => {
        [c, g, o, d, k, b].forEach(check);
        if (canceled) return;
        setConfig(c.config); setGames(g.games || []); setOverlay(o.settings); setDownload(d); setHotkey(k.hotkey || 'Alt+F'); setCloseBehavior(b.closeBehavior === 'exit' ? 'quit' : b.closeBehavior || 'ask'); setServer(c.config.serverUrl || DEFAULT_SERVER);
        setSelectedGame(previous => g.games.some(game => game.id === previous) ? previous : g.games[0]?.id || '');
      }).catch(e => { if (!canceled) setLoadError(e.message); });
    return () => { canceled = true; };
  }, [loadTick]);
  React.useEffect(() => window.api.onGamesChanged(payload => {
    setGames(payload.games || []); setSelectedGame(previous => payload.games?.some(game => game.id === previous) ? previous : payload.games?.[0]?.id || '');
  }), []);
  React.useEffect(() => {
    const handle = event => { if (CATEGORIES.some(item => item.id === event.detail?.category)) chooseCategory(event.detail.category); };
    window.addEventListener('qaqm:settings-section', handle);
    return () => window.removeEventListener('qaqm:settings-section', handle);
  }, []);
  React.useEffect(() => { if (toast) { const timer = setTimeout(() => setToast(null), 5000); return () => clearTimeout(timer); } }, [toast]);
  React.useEffect(() => { pane.current?.scrollTo(0, 0); setRecording(false); }, [category.id, selectedGame]);
  function chooseCategory(id) { setCategoryId(id); remember('qaqm.settings.category', id); }
  function chooseGame(id) { setSelectedGame(id); remember('qaqm.settings.game', id); }
  async function run(action, message) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true);
    try { await action(); if (message) notify('success', message); }
    catch (e) { notify('error', e.message); }
    finally { busyRef.current = false; setBusy(false); }
  }
  async function updateConfig(key, value, save, apply) {
    await run(async () => { check(await save(value)); setConfig(previous => ({ ...previous, [key]: value })); apply?.(value); });
  }
  async function updateOverlay(key, value) {
    await run(async () => { check(await window.api.overlayUpdateSettings({ [key]: value })); setOverlay(previous => ({ ...previous, [key]: value })); }, key === 'persistBridgeEnabled' ? '已保存。请完全退出并重新打开管理器和游戏后生效。' : undefined);
  }
  async function updateLoader(kind) {
    await run(async () => {
      setUpdateResult(null);
      const name = kind === 'xxmi' ? 'XXMI 启动器' : '游戏加载组件';
      const source = await window.api.autoinstallSelectUpdateSource(`选择新版${name}的 ZIP 压缩包或已解压文件夹`);
      if (source.canceled) return;
      if (!source.path || source.error) throw new Error(source.error || '未选择更新文件');
      const target = await window.api.autoinstallSelectFolder(kind === 'xxmi' ? '选择已有 XXMI 的安装目录' : '选择已有游戏加载组件目录，如 WWMI');
      if (target.canceled) return; check(target);
      check(kind === 'xxmi' ? await window.api.autoinstallUpdateXxmi({ xxmiRootDir: target.path, updateSourcePath: source.path }) : await window.api.autoinstallUpdateGamePackage({ packageDir: target.path, updateSourcePath: source.path }));
      setUpdateResult(`${name}已更新：${target.path}`);
    });
  }
  const subitems = category.id === 'games' ? orderedGames.map(game => [game.id, game.name]) : category.items;
  const levelValue = Number(config?.compatibilityLevel);
  const level = Number.isFinite(levelValue) ? Math.max(0, Math.min(3, levelValue)) : config?.compatibilityMode ? 3 : 0;
  const marketScale = { small: 88, medium: 100, large: 122 }[config?.modMarketCardSize] || Number(config?.modMarketCardSize) || 100;
  let content;
  if (loadError) content = h('div', { className: 'system-state', role: 'alert' }, `无法读取设置：${loadError}`, h(Button, { onClick: () => setLoadTick(v => v + 1) }, '重新加载'));
  else if (!config) content = h('div', { className: 'system-state', role: 'status' }, '正在读取设置…');
  else if (category.id === 'general') content = h(React.Fragment, null,
    h(Section, { id: 'window', title: '窗口行为' }, h(Row, { title: '关闭主窗口时', description: '选择点击窗口右上角关闭按钮后的操作。', stacked: true },
      h(Choices, { label: '关闭主窗口时', value: closeBehavior, disabled: busy, onChange: value => run(async () => { check(await window.api.setCloseBehavior(value)); setCloseBehavior(value); }), options: [
        { value: 'ask', label: '每次询问', desc: '关闭前选择处理方式' }, { value: 'minimize', label: '最小化到托盘', desc: '继续运行，快捷键仍可用' }, { value: 'quit', label: '退出应用', desc: '结束管理器进程' }
      ] }))),
    h(Section, { id: 'persist', title: '预设与状态' },
      h(Row, { title: '由 QAQ 接管 Mod 持久化', description: '开启后由 QAQ 保存和恢复 Mod 的持久化状态，供切换 Mod 和应用预设时使用。更改后需重启管理器和游戏。' }, h('input', { type: 'checkbox', role: 'switch', className: 'system-switch', 'aria-label': '由 QAQ 接管 Mod 持久化', checked: !!overlay.persistBridgeEnabled, disabled: busy, onChange: e => updateOverlay('persistBridgeEnabled', e.target.checked) })),
      h(Row, { title: '保留最近使用的 Mod 状态', description: '0 表示只保留当前启用的 Mod；默认额外保留 50 个，最多 200 个。' }, h(Range, { label: '保留最近使用的 Mod 状态', value: overlay.persistBridgeCacheSize ?? 50, min: 0, max: 200, suffix: ' 个', disabled: busy, onChange: value => updateOverlay('persistBridgeCacheSize', value) }))));
  else if (category.id === 'appearance') content = h(React.Fragment, null,
    h(Section, { id: 'theme', title: '界面主题' }, h(Row, { title: '色彩主题', description: '内置主题可直接使用，选择后立即生效。', stacked: true }, h(Choices, { label: '色彩主题', disabled: busy || theme?.loadingSkins, value: theme?.activeSkinId || '', onChange: value => run(async () => { check(await theme.setActiveTheme(value || null)); }), options: [{ value: '', label: '默认', desc: '柔和浅色' }, ...(theme?.skins || []).map(skin => ({ value: skin.id, label: skin.name || skin.id, desc: skin.description }))] }))),
    h(Section, { id: 'scale', title: '界面大小' },
      h(Row, { title: '侧栏缩放', description: '调整主导航、游戏选择和启动按钮的大小。' }, h(Range, { label: '侧栏缩放', value: Math.round((config.uiZoom || 1) * 100), min: 70, max: 140, step: 5, disabled: busy, onChange: value => updateConfig('uiZoom', value / 100, window.api.setUiZoom, v => document.documentElement.style.setProperty('--ui-scale', v)) })),
      h(Row, { title: 'Mod 市场卡片', description: '调整市场列表的卡片大小，详情页保持原尺寸。' }, h(Range, { label: 'Mod 市场卡片', value: marketScale, min: 80, max: 140, disabled: busy, onChange: value => updateConfig('modMarketCardSize', value, window.api.setModMarketCardSize, size => window.dispatchEvent(new CustomEvent('qaqm:mod-market-card-size-changed', { detail: { size } }))) })),
      h(Row, { title: '恢复默认大小' }, h(Button, { disabled: busy, onClick: () => run(async () => {
        check(await window.api.setUiZoom(1)); check(await window.api.setModMarketCardSize(100)); setConfig(c => ({ ...c, uiZoom: 1, modMarketCardSize: 100 })); document.documentElement.style.setProperty('--ui-scale', '1'); window.dispatchEvent(new CustomEvent('qaqm:mod-market-card-size-changed', { detail: { size: 100 } }));
      }) }, '恢复 100%'))),
    h(Section, { id: 'compatibility', title: '显示兼容性' }, h(Row, { title: '兼容模式', description: '遇到闪烁、花屏或透明层异常时，可逐级减少视觉效果。极简模式需重启应用以停用硬件加速。', stacked: true }, h(Choices, { label: '兼容模式', value: level, disabled: busy, onChange: value => updateConfig('compatibilityLevel', value, window.api.setCompatibilityMode, applyCompatibility), options: [
      { value: 0, label: '关闭', desc: '完整视觉效果' }, { value: 1, label: '轻度', desc: '减少动画与模糊' }, { value: 2, label: '中度', desc: '进一步减少透明与阴影' }, { value: 3, label: '极简', desc: '不透明界面，需重启' }
    ] }))));
  else if (category.id === 'games') content = selectedGame ? h(GameSettings, { key: selectedGame, gameId: selectedGame, notify }) : h('div', { className: 'system-state' }, '暂无游戏配置');
  else if (category.id === 'downloads') content = h(React.Fragment, null,
    h(Section, { id: 'cache', title: '下载存储' }, h(Row, { title: '下载目录', description: 'Mod 市场、Pawchive、Kemono 和 MEGA 下载共用此目录。更改目录不会移动已有文件。', stacked: true }, h(PathControl, { label: '下载目录', value: download?.cacheDir, disabled: busy, onSelect: () => run(async () => { const r = await window.api.marketSelectDownloadCacheDir(); if (r.canceled) return; check(r); setDownload(r); }) }, h(Button, { disabled: busy, onClick: () => run(async () => { const r = check(await window.api.marketResetDownloadCacheDir()); setDownload(r); }) }, '恢复默认')))),
    h(Section, { id: 'server', title: '市场服务器' }, h(Row, { title: 'Mod 市场服务地址', description: `默认地址：${DEFAULT_SERVER}。仅用于 Mod 市场服务。`, stacked: true }, h('form', { className: 'system-path-control', onSubmit: event => { event.preventDefault(); run(async () => { const r = check(await window.api.setServerUrl(server.trim() || DEFAULT_SERVER, { devMode })); setServer(r.serverUrl || server.trim() || DEFAULT_SERVER); }, '服务器地址已保存'); } }, h('input', { className: 'system-text-input', type: 'url', 'aria-label': 'Mod 市场服务地址', value: server, onChange: e => setServer(e.target.value), placeholder: DEFAULT_SERVER }), h(Button, { disabled: busy, onClick: () => setServer(DEFAULT_SERVER) }, '填入默认'), h(Button, { primary: true, type: 'submit', disabled: busy }, '保存')))));
  else if (category.id === 'shortcuts') content = h(Section, { id: 'overlay', title: '局内面板' },
    h(Row, { title: '显示 / 隐藏局内面板', description: '在游戏中快速查看和切换当前游戏的 Mod。快捷键对所有游戏生效。' }, h('kbd', null, hotkey), h(Button, { disabled: busy, onClick: () => { setRecording(true); setDraftHotkey(''); } }, '修改快捷键')),
    recording && h(Row, { title: '录制快捷键', description: '聚焦输入框后按下组合键，再点击保存。Esc 取消，Tab 可移动焦点。', stacked: true }, h('div', { className: 'system-path-control' }, h('input', { autoFocus: true, readOnly: true, className: 'system-text-input', 'aria-label': '录制快捷键', value: draftHotkey, placeholder: '按下快捷键组合…', onKeyDown: event => {
      if (event.key === 'Tab') return;
      event.preventDefault(); event.stopPropagation();
      if (event.key === 'Escape') { setRecording(false); return; }
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) return;
      setDraftHotkey([event.ctrlKey && 'Ctrl', event.altKey && 'Alt', event.shiftKey && 'Shift', event.metaKey && 'Super', event.key === ' ' ? 'Space' : event.key.length === 1 ? event.key.toUpperCase() : event.key].filter(Boolean).join('+'));
    } }), h(Button, { primary: true, disabled: busy || !draftHotkey, onClick: () => run(async () => { const r = check(await window.api.setOverlayHotkey(draftHotkey)); setHotkey(r.hotkey); setRecording(false); }, '快捷键已保存') }, '保存'), h(Button, { onClick: () => setRecording(false) }, '取消'))),
    ...[
      ['autoReloadEnabled', '切换 Mod 后自动重载', '在局内面板切换 Mod 后，自动向游戏发送重载操作。'],
      ['presetAutoReloadEnabled', '应用预设后自动重载', '应用预设后自动让游戏重新加载 Mod。'],
      ['clickableHotkeysEnabled', '点击 Mod 快捷键', '允许点击面板中的 Mod 快捷键执行操作；需同时开启自动重载。']
    ].map(([key, title, description]) => h(Row, { key, title, description }, h('input', { type: 'checkbox', role: 'switch', className: 'system-switch', 'aria-label': title, checked: !!overlay[key], disabled: busy, onChange: e => updateOverlay(key, e.target.checked) }))),
    h(Row, { title: '预览局内面板', description: '最小化管理器主窗口，并显示或隐藏面板。' }, h(Button, { onClick: () => run(async () => { check(await window.api.toggleOverlayFromUI()); }) }, '打开 / 隐藏')));
  else if (category.id === 'maintenance') content = h(React.Fragment, null,
    h(Section, { id: 'updates', title: '加载器更新' }, h(Row, { title: '更新 XXMI 启动器', description: '先选择新版 ZIP 或已解压文件夹，再选择现有 XXMI 安装目录。更新 Resources 等启动器文件，保留 Mods。' }, h(Button, { disabled: busy, onClick: () => updateLoader('xxmi') }, busy ? '处理中…' : '选择更新包')), h(Row, { title: '更新游戏加载组件', description: '更新 WWMI、ZZMI、EFMI 等组件。选择新版包及对应组件目录，更新 Core、ShaderFixes 等文件，保留 Mods。' }, h(Button, { disabled: busy, onClick: () => updateLoader('game') }, busy ? '处理中…' : '选择组件包')), updateResult && h('div', { className: 'system-notice', role: 'status' }, updateResult)),
    h(Section, { id: 'help', title: '故障排查' }, h(Row, { title: 'Mod 失效自查', description: '打开帮助网页，检查加载器、路径和 Mod 的常见问题。' }, h(Button, { onClick: () => window.api.openExternalUrl('https://www.qaqm.top/faq') }, '查看帮助 ↗'))));
  else content = h(React.Fragment, null, h(Section, { id: 'about', title: '应用信息' }, h(Row, { title: 'QAQ-Revival', description: '本地 Mod 管理器' }, h('span', { className: 'system-version' }, appVersion))), h(SoftwareUpdateSettings));
  return h('div', { className: 'settings-view system-settings' },
    h('aside', { className: 'system-settings-nav' }, h('div', { className: 'system-settings-title' }, h('h1', null, '系统设置'), h('p', null, '偏好与配置')),
      h('nav', { 'aria-label': '设置分类' }, CATEGORIES.map(item => h(React.Fragment, { key: item.id },
        h('button', { type: 'button', className: 'system-category', 'data-category': item.id, 'aria-current': category.id === item.id ? 'page' : undefined, disabled: busy, onClick: () => chooseCategory(item.id) }, h(Icon, { name: item.icon }), h('span', null, item.label)),
        category.id === item.id && subitems.length > 0 && h('div', { className: 'system-subnav' }, subitems.map(([id, label]) => h('button', { key: id, type: 'button', 'data-subsection': id, disabled: busy, 'aria-current': category.id === 'games' && id === selectedGame ? 'true' : undefined, onClick: () => category.id === 'games' ? chooseGame(id) : document.getElementById(`settings-${id}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }) }, label)))))),
      h('p', { className: 'system-nav-footnote' }, '设置自动保存', h('span', null, '带「保存」按钮的项目需确认'))),
    h('div', { className: 'system-settings-pane', ref: pane }, h('header', { className: 'system-settings-header' }, h('div', null, h('div', { className: 'system-breadcrumb' }, '系统设置 / ', category.label), h('h2', null, category.label), h('p', null, category.desc)), h('span', { className: 'system-scope' }, category.id === 'games' ? '按游戏保存' : '全局设置')), h('div', { className: 'system-settings-body' }, content)),
    toast && h('div', { className: `system-toast ${toast.type}`, role: toast.type === 'error' ? 'alert' : 'status' }, toast.message));
}
