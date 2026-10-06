import { r as React } from './index.js';
const h = (...args) => React.createElement(...args);
function useUpdateState() {
  const [state, setState] = React.useState(null), [error, setError] = React.useState('');
  React.useEffect(() => {
    let current = true;
    window.api.softwareUpdateState().then(result => {
      if (!current) return;
      if (result.success) setState(result.state); else setError(result.error);
    }).catch(error => { if (current) setError(error.message); });
    const off = window.api.onSoftwareUpdateState(next => { if (current) setState(next); });
    return () => { current = false; off?.(); };
  }, []);
  return { state, setState, error, setError };
}
export function SoftwareUpdateSettings() {
  const { state, setState, error, setError } = useUpdateState();
  const [busy, setBusy] = React.useState(false), [days, setDays] = React.useState('1');
  React.useEffect(() => { if (state) setDays(String(state.intervalDays)); }, [state?.intervalDays]);
  const validDays = /^\d+$/.test(days) && Number(days) >= 1 && Number(days) <= 365;
  async function request(method, value) {
    setBusy(true); setError('');
    try {
      const result = await window.api[method](value);
      if (!result?.success) throw Error(result?.error || '更新操作失败');
      setState(result.state);
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  const configure = enabled => request('softwareUpdateConfigure', { enabled, intervalDays: Number(days) });
  function saveDays() { if (state && validDays && Number(days) !== state.intervalDays && !busy) configure(state.enabled); }
  return h('section', { className: 'system-section', id: 'settings-software-update', 'aria-labelledby': 'software-update-title' },
    h('h3', { id: 'software-update-title' }, '应用更新'),
    h('div', { className: 'system-card' }, !state ? h('p', null, error || '正在读取更新设置…') : h(React.Fragment, null,
      h('div', { className: 'system-row' }, h('div', { className: 'system-row-copy' }, h('div', { className: 'system-row-title' }, '自动检查更新'),
        h('p', null, '从 GitHub 公开发布页检查正式版本，按本地自然日计算。')),
        h('input', { type: 'checkbox', role: 'switch', className: 'system-switch', 'aria-label': '自动检查 GitHub 更新', checked: state.enabled, disabled: busy,
          onChange: event => request('softwareUpdateConfigure', { enabled: event.target.checked, intervalDays: state.intervalDays }) })),
      h('div', { className: 'system-row' }, h('div', { className: 'system-row-copy' }, h('div', { className: 'system-row-title' }, '检查频率'), h('p', null, '每个检查日最多自动检查一次；可随时手动检查。')),
        h('label', { className: 'software-update-frequency' }, '每隔 ', h('input', { type: 'text', inputMode: 'numeric', 'aria-label': '更新检查间隔天数', 'aria-invalid': !validDays,
          value: days, disabled: busy || !state.enabled, onChange: event => setDays(event.target.value), onBlur: saveDays,
          onKeyDown: event => { if (event.key === 'Enter') saveDays(); if (event.key === 'Escape') setDays(String(state.intervalDays)); } }), ' 个自然天')),
      !validDays && h('p', { className: 'system-range-error', role: 'alert' }, '请输入 1–365 的整数，当前输入未保存。'),
      h('div', { className: 'system-row stacked' },
        h('p', { className: 'software-update-summary', role: 'status' }, state.checking ? '正在检查 GitHub…' : state.updateAvailable ? `发现新版本 ${state.release.version}（当前 ${state.currentVersion}）` : state.noRelease ? 'GitHub 暂无正式发布版本' : state.lastCheckedAt ? `当前版本 ${state.currentVersion}，未发现更新` : `当前版本 ${state.currentVersion}，尚未检查`),
        h('small', null, state.lastCheckedAt ? `上次成功检查：${new Date(state.lastCheckedAt).toLocaleString('zh-CN')}` : ''),
        (error || state.error) && h('p', { className: 'system-range-error', role: 'alert' }, error || state.error),
        h('div', { className: 'software-update-actions' },
          h('button', { type: 'button', className: 'system-button primary', disabled: busy || state.checking, onClick: () => request('softwareUpdateCheck') }, state.checking ? '检查中…' : '立即检查'),
          state.release && h('button', { type: 'button', className: 'system-button', onClick: () => request('softwareUpdateOpenRelease') }, '查看 GitHub 发布页'))))));
}
export function SoftwareUpdateNotice() {
  const { state, setState } = useUpdateState();
  if (!state?.updateAvailable || state.release.version === state.dismissedVersion) return null;
  return h('div', { className: 'software-update-notice', role: 'status' },
    h('span', null, `QAQ-Revival ${state.release.version} 已发布`),
    h('button', { type: 'button', onClick: () => window.api.softwareUpdateOpenRelease() }, '查看更新'),
    h('button', { type: 'button', 'aria-label': '不再提醒此版本', onClick: async () => {
      const result = await window.api.softwareUpdateDismiss(state.release.version); if (result.success) setState(result.state);
    } }, '×'));
}
