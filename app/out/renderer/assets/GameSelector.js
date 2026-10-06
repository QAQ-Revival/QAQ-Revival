import { r as React, j as jsx, R as ReactDOM } from './index.js';
import { useGameOrder } from './useGameOrder.js';
import { GAME_MENU_WIDTH } from './sidebarLayout.js';

// Sidebar game selection and persisted ordering.
export function GameSelector({ games = [], activeGame, collapsed, onSwitch }) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [position, setPosition] = React.useState({});
  const trigger = React.useRef(null);
  const menu = React.useRef(null);
  const switching = React.useRef(false);
  const sorting = useGameOrder(games, open && !busy);
  const close = (focus = false) => {
    setOpen(false);
    if (focus) trigger.current?.focus();
  };
  React.useEffect(() => {
    if (!open) return;
    const rect = trigger.current.getBoundingClientRect();
    const width = Math.min(GAME_MENU_WIDTH, window.innerWidth - 24);
    setPosition({ left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)), top: rect.bottom + 8, width, maxHeight: Math.max(120, window.innerHeight - rect.bottom - 24) });
    const dismiss = (event) => {
      if (!trigger.current?.contains(event.target) && !menu.current?.contains(event.target)) close();
    };
    const escape = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); close(true); }
    };
    const resize = () => close();
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    window.addEventListener('resize', resize);
    const frame = requestAnimationFrame(() => menu.current?.querySelector('[aria-checked="true"], [role="menuitemradio"]')?.focus());
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(frame);
    };
  }, [open]);
  React.useEffect(() => { setOpen(false); }, [collapsed]);
  async function select(game) {
    if (switching.current) return;
    if (game.id === activeGame?.id) { close(true); return; }
    switching.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await window.api.gameSwitch(game.id);
      if (!result?.success) throw new Error(result?.error || '切换游戏失败');
      await onSwitch?.(game.id);
      close(true);
    } catch (err) {
      setError(err.message || '切换游戏失败，请重试');
    } finally {
      switching.current = false;
      setBusy(false);
    }
  }
  function navigate(event) {
    if (event.defaultPrevented) return;
    const items = Array.from(menu.current.querySelectorAll('[role="menuitemradio"]:not(:disabled)'));
    if (!items.length) return;
    const index = items.indexOf(document.activeElement);
    let next;
    if (event.key === 'ArrowDown') next = (index + 1) % items.length;
    if (event.key === 'ArrowUp') next = (index - 1 + items.length) % items.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = items.length - 1;
    if (next !== undefined) { event.preventDefault(); items[next].focus(); }
    if (event.key === 'Tab') close();
  }
  return jsx.jsxs('div', { className: 'sidebar-game-selector', children: [
    jsx.jsxs('button', {
      ref: trigger, type: 'button', className: 'game-selector-trigger', disabled: busy,
      'aria-haspopup': 'menu', 'aria-expanded': open, 'aria-controls': open ? 'sidebar-game-menu' : undefined,
      'aria-label': `切换游戏，当前：${activeGame?.name || '未选择'}`, title: collapsed ? activeGame?.name || '切换游戏' : undefined,
      onClick: () => { setError(''); setOpen(!open); },
      onKeyDown: (event) => { if (['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); setOpen(true); } },
      children: [
        jsx.jsx('span', { className: 'game-selector-icon', 'aria-hidden': true, children: '🎮' }),
        !collapsed && jsx.jsxs('span', { className: 'game-selector-copy', children: [
          jsx.jsx('span', { className: 'game-selector-label', children: '当前游戏' }),
          jsx.jsx('strong', { children: busy ? '切换中…' : activeGame?.name || '选择游戏' })
        ] }),
        !collapsed && jsx.jsx('span', {
          className: 'game-selector-chevron', 'aria-hidden': true,
          children: jsx.jsx('svg', {
            viewBox: '0 0 24 24', width: 18, height: 18, fill: 'none', stroke: 'currentColor',
            strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', focusable: 'false',
            children: jsx.jsx('path', { d: 'm6 9 6 6 6-6' })
          })
        })
      ]
    }),
    error && !open && jsx.jsx('div', { role: 'alert', className: 'game-selector-error', children: error }),
    open && ReactDOM.createPortal(jsx.jsxs('div', {
      ref: menu, id: 'sidebar-game-menu', className: 'game-selector-menu', role: 'menu',
      'aria-label': '切换游戏', 'aria-busy': busy, style: position, onKeyDown: navigate,
      children: [
        ...sorting.items.map(game => jsx.jsxs('button', {
          ...sorting.itemProps(game.id),
          type: 'button', className: 'game-selector-option', role: 'menuitemradio',
          title: `${game.name}（拖动排序，或按 Alt + ↑ / ↓）`,
          'aria-checked': game.id === activeGame?.id, disabled: busy, onClick: () => select(game),
          children: [
            jsx.jsxs('span', { className: 'game-selector-copy', children: [
              jsx.jsx('strong', { children: game.name }),
              jsx.jsx('span', { className: 'game-selector-description', children: game.modFolderPath ? '已配置 Mod 目录' : '独立游戏配置' })
            ] }),
            jsx.jsx('span', { className: 'game-selector-check', 'aria-hidden': true, children: game.id === activeGame?.id ? '✓' : '' }),
            jsx.jsx('span', { className: 'sort-grip', 'aria-hidden': true })
          ]
        }, game.id)),
        jsx.jsx('div', { className: 'sort-announcement', role: 'status', children: sorting.announcement }),
        sorting.error && jsx.jsx('div', { role: 'alert', className: 'game-selector-error', children: sorting.error }),
        !games.length && jsx.jsx('div', { className: 'game-selector-error', children: '暂无游戏，请在系统设置中配置。' }),
        error && jsx.jsx('div', { role: 'alert', className: 'game-selector-error', children: error })
      ]
    }), document.body)
  ] });
}
