import { r as React } from './index.js';
import { Button, Section, Row, Choices, check } from './SystemSettings.js';

const h = React.createElement;
export function SteamBridgeSettings({ gameId }) {
  const [data, setData] = React.useState(null), [options, setOptions] = React.useState(null);
  const [busy, setBusy] = React.useState(false), [error, setError] = React.useState(''), [message, setMessage] = React.useState('');
  const alive = React.useRef(true), inFlight = React.useRef(false);
  async function refresh(draft) {
    const result = check(await window.api.steamBridgeStatus({ gameId, ...(draft ? { options: draft } : {}) }));
    if (alive.current) { setData({ ...result.games[0], automation: result.automation }); setOptions(result.games[0].options); }
  }
  async function act(action) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(''); setMessage('');
    try { await action(); } catch (failure) { if (alive.current) setError(failure.message); }
    finally { inFlight.current = false; if (alive.current) setBusy(false); }
  }
  React.useEffect(() => { alive.current = true; act(() => refresh()); return () => { alive.current = false; }; }, [gameId]);
  const edit = (key, value) => setOptions(previous => ({ ...previous, [key]: value }));
  const apply = all => act(async () => {
    const result = await window.api.steamBridgeApply({ gameId, options, all });
    if (result?.canceled) return;
    try { check(result); if (alive.current) setMessage(result.message); } finally { await refresh(); }
  });
  const restore = () => act(async () => {
    const result = await window.api.steamBridgeRestore({ gameId });
    if (result?.canceled) return;
    try { check(result); if (alive.current) setMessage(result.message); } finally { await refresh(); }
  });
  const pathValue = (label, value) => h('input', { className: 'system-path', readOnly: true, 'aria-label': label, value: value || '', title: value || '未检测到', placeholder: '未检测到' });
  const checks = data && [
    ['Steam', !!data.steamRoot, data.steamRoot ? '已检测到' : '请安装并登录 Steam'],
    ['游戏库', data.accountKnown && data.owned, data.accountKnown ? data.owned ? '当前账号已拥有游戏' : '请先将游戏免费添加到库' : data.accountError || '等待登录 Steam'],
    ['客户端', data.clientReady, data.clientStatus || '请配置上方的游戏程序路径'],
    ['Steam 版本', data.metadataReady, data.metadataReady ? '本机缓存可用' : '请在 Steam 打开游戏库页面刷新元数据']
  ];
  return h(Section, { id: 'steam-bridge', title: 'Steam 桥接' },
    h(Row, { title: data?.installed ? data.phase === 'enabled' ? '已设置 Steam 桥接' : '上次操作未完成，可先撤回' : '从 Steam 官方游戏条目启动国服',
      description: '复用当前游戏路径，可在 Steam 统计游玩时长。首次设置自动备份原记录，应用和撤回会重启 Steam。' },
      h(Button, { disabled: busy, onClick: () => act(async () => check(await window.api.steamBridgeOpenLibrary({ gameId }))) }, '打开 Steam 游戏库')),
    options && h(React.Fragment, null,
      h(Row, { title: '启动方式', description: '从 Steam 唤起 QAQR 后，手动选择该游戏并点击「直接启动」加载 Mod。更改选项后点击「设置 / 同步当前游戏」保存。', stacked: true },
        h(Choices, { label: 'Steam 桥接启动方式', disabled: busy, value: options.launchMethod, onChange: value => edit('launchMethod', value), options: [
          { value: 'qaqr', label: 'QAQR', desc: '使用当前管理器和配置' }, { value: 'official', label: '官方启动器', desc: '在官方启动器中手动开始' }
        ] })),
      gameId === 'endfield' && h(Row, { title: '终末地服务器' }, h(Choices, { label: 'Steam 桥接服务器', disabled: busy, value: options.channelId, onChange: value => edit('channelId', value),
        options: [{ value: 'official', label: '官服' }, { value: 'bilibili', label: 'Bilibili 服' }] })),
      h(Row, { title: '官方启动器', description: '自动检测已安装的启动器。鸣潮的 Steam 默认入口为 launcher.exe 时，QAQR 模式也需要此路径。', stacked: true },
        h('div', { className: 'system-path-control' }, pathValue('Steam 桥接官方启动器', options.launcher), h(Button, { disabled: busy, onClick: () => act(async () => {
          const result = await window.api.steamBridgeSelectLauncher({ gameId }); if (result?.canceled) return; check(result); if (alive.current) edit('launcher', result.launcher);
        }) }, '选择启动器'))),
      h(Row, { title: '游戏程序', description: '优先使用上方「游戏路径」中的配置；未配置时尝试自动检测。', stacked: true }, pathValue('Steam 桥接游戏程序', data.gamePath)),
      options.launchMethod === 'qaqr' && h(Row, { title: '由 Steam 管理本次 QAQR',
        description: options.qaqrSteamManaged ? '开始前需完全退出 QAQR，并以管理员身份打开 Steam。Steam 停止会结束本次 QAQR 和它启动的游戏；QAQR 未退出时会继续计时。' : 'QAQR 可以保持打开；游戏退出后结束计时。此模式不传递 Steam 原生叠加层，Steam 停止只结束计时。' },
        h('input', { type: 'checkbox', role: 'switch', className: 'system-switch', 'aria-label': 'Steam 管理 QAQR', disabled: busy, checked: !!options.qaqrSteamManaged, onChange: event => edit('qaqrSteamManaged', event.target.checked) })),
      h(Row, { title: 'Steam 更新后自动同步', description: 'QAQR 打开时和桥接进程启动时都会检查本机 Steam 版本。沿用已保存配置，保留首次备份；游戏或下载忙碌时延后。独立辅助进程修复后会从 Steam 重新启动游戏条目。' },
        h('input', { type: 'checkbox', role: 'switch', className: 'system-switch', 'aria-label': 'Steam 更新后自动同步', disabled: busy, checked: options.autoSync !== false, onChange: event => edit('autoSync', event.target.checked) }))),
    checks && h('div', { className: 'steam-bridge-checks', role: 'status' }, checks.map(([label, ready, detail]) => h('div', { key: label, className: ready ? 'ready' : 'missing' },
      h('span', { 'aria-hidden': true }, ready ? '✓ ' : '· '), h('strong', null, label + '：'), detail))),
    h('div', { className: 'wuwa-tuning-actions steam-bridge-actions' },
      h(Button, { primary: true, disabled: busy || !options, onClick: () => apply(false) }, '设置 / 同步当前游戏'),
      h(Button, { disabled: busy || !options, onClick: () => apply(true) }, '一键设置 / 同步两款'),
      h(Button, { disabled: busy || !data?.installed, onClick: restore }, '撤回当前游戏'),
      h(Button, { disabled: busy, onClick: () => act(() => refresh(options)) }, '重新检测 Steam')),
    busy && h('p', { className: 'system-notice', role: 'status' }, '正在处理 Steam 桥接，请稍候…'),
    message && h('p', { className: 'system-notice', role: 'status' }, message),
    data?.automation?.message && h('p', { className: 'system-notice', role: 'status' }, data.automation.message),
    data?.automation?.warnings?.length > 0 && h('p', { className: 'system-notice', role: 'status' }, data.automation.warnings.join('；')),
    (error || data?.error || data?.automation?.error) && h('p', { className: 'system-notice', role: 'alert' }, error || data.error || data.automation.error));
}
