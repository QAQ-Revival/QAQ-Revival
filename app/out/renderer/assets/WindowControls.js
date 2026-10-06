import { r as React, R as ReactDOM } from './index.js';

export function WindowControls() {
  const h = React.createElement;
  const [state, setState] = React.useState({ maximized: false, focused: true });
  const [error, setError] = React.useState('');
  React.useEffect(() => {
    let active = true;
    const update = value => { if (active && value?.success) setState(value); };
    const unsubscribe = window.api.onWindowState(update);
    window.api.getWindowState().then(update).catch(() => {});
    return () => { active = false; unsubscribe(); };
  }, []);
  async function control(action) {
    try {
      const result = await window.api.controlWindow(action);
      if (!result?.success) throw new Error(result?.error || '窗口操作失败');
      setError('');
    } catch (failure) { setError(failure.message); }
  }
  function button(action, label, paths) {
    return h('button', { type: 'button', className: `window-control window-${action}`, title: label, 'aria-label': label, onClick: () => control(action) },
      h('svg', { width: 12, height: 12, viewBox: '0 0 12 12', fill: 'none', stroke: 'currentColor', strokeWidth: 1, 'aria-hidden': true }, paths.map((d, i) => h('path', { key: i, d }))));
  }
  return ReactDOM.createPortal(h('header', { className: 'window-titlebar', 'data-focused': state.focused },
    h('div', { className: 'window-drag-region', 'aria-hidden': true }),
    error && h('span', { className: 'window-control-error', role: 'alert' }, error),
    h('div', { className: 'window-controls', role: 'group', 'aria-label': '窗口控制' },
      button('minimize', '最小化窗口', ['M1 6.5h10']),
      button('maximize', state.maximized ? '还原窗口' : '最大化窗口', state.maximized ? ['M3.5 3.5v-2h7v7h-2', 'M1.5 3.5h7v7h-7z'] : ['M1.5 1.5h9v9h-9z']),
      button('close', '关闭窗口', ['M1.5 1.5l9 9m0-9-9 9']))), document.body);
}
