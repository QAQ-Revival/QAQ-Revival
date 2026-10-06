import { r as React, j as jsx } from './index.js';

export function LaunchControls({ activeGame, collapsed }) {
  const [launching, setLaunching] = React.useState(null);
  const [error, setError] = React.useState('');
  const inFlight = React.useRef(false);
  const gameId = React.useRef(activeGame?.id);
  gameId.current = activeGame?.id;
  const supportsXxmi = activeGame?.id !== 'neverness-to-everness';
  React.useEffect(() => { setError(''); }, [activeGame?.id]);
  async function launch(mode) {
    if (inFlight.current) return;
    const requestedGameId = activeGame?.id;
    inFlight.current = true;
    setLaunching(mode);
    setError('');
    try {
      const result = await window.api.launchGame({ launchMode: mode, gameId: requestedGameId });
      if (!result?.success) throw new Error(result?.error || '启动失败，请检查游戏和加载器路径');
    } catch (err) {
      if (gameId.current === requestedGameId) setError(err.message || '启动失败');
    } finally {
      inFlight.current = false;
      setLaunching(null);
    }
  }
  return jsx.jsxs('div', { className: `launch-actions ${collapsed ? 'launch-actions-collapsed' : 'card launch-control-card'}`, children: [
    jsx.jsx('button', {
      type: 'button', className: 'btn btn-primary', 'aria-label': '直接启动',
      title: '加载当前游戏的 Mod，跳过 XXMI 界面直接启动',
      disabled: !!launching || !activeGame?.id, onClick: () => launch('DIRECT'),
      children: collapsed ? (launching === 'DIRECT' ? '…' : '▶') : launching === 'DIRECT' ? '启动中…' : '直接启动'
    }),
    jsx.jsx('button', {
      type: 'button', className: 'btn btn-secondary', 'aria-label': 'XXMI 启动',
      title: supportsXxmi ? '打开 XXMI 启动器界面' : '异环使用 NEMI / Pak 加载器，请使用直接启动',
      disabled: !!launching || !activeGame?.id || !supportsXxmi, onClick: () => launch('XXMI'),
      children: collapsed ? (launching === 'XXMI' ? '…' : 'XX') : launching === 'XXMI' ? '启动中…' : 'XXMI 启动'
    }),
    error && jsx.jsx('div', { role: 'alert', className: 'launch-error', title: error, children: error })
  ] });
}
