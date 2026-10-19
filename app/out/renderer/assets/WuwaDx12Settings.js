import { r as React } from './index.js';
import { Button, Section, Row, check } from './SystemSettings.js';

const h = React.createElement;
const sourceLabel = item => item?.source === 'user' ? '用户安装 · 手动管理' : item?.source === 'managed' ? `QAQR 内置 · ${item.active ? '已启用' : '已停用'}` : '未安装 · 开启时由 QAQR 安装';
export function WuwaDx12Settings() {
  const [data, setData] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const alive = React.useRef(true), inFlight = React.useRef(false);
  async function load() {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try { const result = check(await window.api.wuwaDx12Status()); if (alive.current) setData(result); }
    catch (e) { if (alive.current) setError(e.message); }
    finally { inFlight.current = false; if (alive.current) setBusy(false); }
  }
  React.useEffect(() => { alive.current = true; load(); return () => { alive.current = false; }; }, []);
  const toggle = enabled => act(() => window.api.wuwaDx12SetEnabled(enabled), enabled);
  async function act(action, enabled) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try {
      const result = check(await action());
      if (alive.current) setData(previous => result.paths ? result : { ...previous, enabled: enabled ?? previous.enabled });
    } catch (e) { if (alive.current) setError(e.message); }
    finally {
      try { const result = check(await window.api.wuwaDx12Status()); if (alive.current) setData(result); }
      catch (e) { if (alive.current) setError(e.message); }
      inFlight.current = false; if (alive.current) setBusy(false);
    }
  }
  const open = url => window.api.openExternalUrl(url);
  return h(Section, { id: 'wuwa-dx12', title: '鸣潮 · DX12 Mod' },
    h(Row, { title: '使用 DX12 加载 Mod', description: '开启后「直接启动」使用 wwmi-dx12，复用当前 WWMI 和 Mods。优先使用用户组件，缺少时自动安装 QAQR 内置组件。' },
      h('input', { type: 'checkbox', role: 'switch', className: 'system-switch', 'aria-label': '鸣潮 DX12 Mod', checked: !!data?.enabled, disabled: busy || !data,
        onChange: e => toggle(e.target.checked) })),
    h(Row, { title: '组件来源', description: 'QAQR 内置组件随此开关启停；用户安装的组件由用户自行管理。', stacked: true },
      ...[['reshade', 'ReShade'], ['addon', 'wwmi-dx12']].map(([key, name]) => h('div', { key, className: 'wuwa-dx12-component', 'data-dx12-component': key },
        h('div', null, h('strong', null, name), h('span', { className: `wuwa-dx12-source ${data?.sources[key]?.source || 'missing'}` }, sourceLabel(data?.sources[key]))),
        h('p', null, data?.sources[key]?.source === 'user' ? '保留现有文件，关闭 DX12 也不会停用或覆盖。更新按钮只更新 QAQR 的备用包。' : `内置版本 ${data?.sources[key]?.version || (key === 'reshade' ? '6.8.0' : '2026.10.3')}；配置和缓存保留。`),
        h('div', { className: 'wuwa-dx12-update' }, h('span', null, `QAQR 内置包 ${data?.updates?.components[key]?.bundledVersion || '待检测'}${data?.updates?.components[key]?.availableVersion ? ` · 官方版本 ${data.updates.components[key].availableVersion}` : ' · 尚未检查更新'}`),
          h(Button, { disabled: busy || !data?.updates?.components[key]?.updateAvailable, 'aria-label': `${name} 更新内置组件`, onClick: () => act(() => window.api.wuwaDx12UpdateComponent(key)) }, '更新内置组件')),
        data?.updates?.errors[key] && h('p', { role: 'status' }, data.updates.errors[key])))),
    data && h('div', { className: 'wuwa-dx12-checks', role: 'status' },
      h('strong', null, !data.enabled ? 'DX12 已关闭 · 开启时自动安装或恢复内置组件' : data.ready ? 'DX12 环境已就绪' : 'DX12 环境待检查'),
      data.checks.map(item => h('div', { key: item.id, className: item.ok ? 'ready' : 'missing' }, h('span', { 'aria-hidden': true }, item.ok ? '✓ ' : '· '),
        `${item.title}：${item.ok && ['wwmi', 'addon'].includes(item.id) ? '已检测到' : item.message}`))),
    h('div', { className: 'wuwa-tuning-actions' },
      h(Button, { disabled: busy || !data?.enabled, onClick: () => toggle(true) }, '补齐内置组件'),
      h(Button, { disabled: busy || !data, onClick: () => act(() => window.api.wuwaDx12CheckUpdates()) }, '检查组件更新'),
      h(Button, { disabled: busy, onClick: load }, '重新检测'),
      h(Button, { disabled: busy || !data?.paths.win64, onClick: () => window.api.openPathInExplorer(data.paths.win64) }, '打开游戏目录'),
      h(Button, { onClick: () => open('https://github.com/lekarsenten/wwmi-dx12') }, '项目说明'),
      h(Button, { onClick: () => open('https://reshade.me/') }, 'ReShade 官网')),
    busy && h('p', { className: 'system-notice', role: 'status' }, '正在检测、安装或更新组件，请稍候；下载可能需要一些时间。'),
    data?.updates?.errors.storage && h('p', { className: 'system-notice', role: 'alert' }, data.updates.errors.storage),
    error && h('p', { className: 'system-notice', role: 'alert', style: { whiteSpace: 'pre-line' } }, error));
}
