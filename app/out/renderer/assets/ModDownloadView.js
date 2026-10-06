import { r as React, R as ReactDOM } from './index.js';
import PawchiveView from './PawchiveView.js';
import ModMarketView from './ModMarketView.js';

const h = React.createElement;
const sources = [['qaqm', 'QAQM'], ['kemono', 'Kemono'], ['pawchive', 'Pawchive']];
function rememberedSource() {
  try {
    const saved = localStorage.getItem('qaqm.downloadSource');
    if (sources.some(([id]) => id === saved)) return saved;
  } catch { /* Storage is optional. */ }
  return 'qaqm';
}

function SourceSelector({ value, onChange, isActive }) {
  const [open, setOpen] = React.useState(false);
  const [position, setPosition] = React.useState({});
  const trigger = React.useRef(null);
  const menu = React.useRef(null);
  const menuId = React.useId();
  function close(focus = false) {
    setOpen(false);
    if (focus) trigger.current?.focus({ preventScroll: true });
  }
  React.useEffect(() => { if (!isActive) close(); }, [isActive]);
  React.useLayoutEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const rect = trigger.current.getBoundingClientRect();
      const width = Math.min(Math.max(rect.width, 224), window.innerWidth - 24);
      setPosition({
        left: Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12)),
        top: rect.bottom + 8, width, maxHeight: Math.max(80, window.innerHeight - rect.bottom - 20)
      });
    };
    updatePosition();
    const dismiss = event => {
      if (!trigger.current?.contains(event.target) && !menu.current?.contains(event.target)) close();
    };
    const escape = event => {
      if (event.key === 'Escape') { event.preventDefault(); close(true); }
    };
    const reposition = event => { if (!menu.current?.contains(event.target)) updatePosition(); };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    document.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    menu.current?.querySelector('[aria-checked="true"]')?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
      document.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open]);
  function navigate(event) {
    const items = Array.from(menu.current.querySelectorAll('[role="menuitemradio"]'));
    const index = items.indexOf(document.activeElement);
    let next;
    if (event.key === 'ArrowDown') next = (index + 1) % items.length;
    if (event.key === 'ArrowUp') next = (index - 1 + items.length) % items.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = items.length - 1;
    if (next !== undefined) { event.preventDefault(); items[next].focus(); }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      items[index]?.click();
    }
    if (event.key === 'Tab') {
      // Restore the trigger first so native Tab continues in the page's tab order.
      close(true);
    }
  }
  return h('div', { className: 'mod-download-source' },
    h('span', null, '内容来源'),
    h('button', {
      ref: trigger, type: 'button', className: 'mod-download-source-trigger',
      'aria-label': 'MOD下载来源', 'aria-haspopup': 'menu', 'aria-expanded': open,
      'aria-controls': open ? menuId : undefined,
      onClick: () => setOpen(!open),
      onKeyDown: event => {
        if (['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); setOpen(true); }
      }
    }, h('strong', { className: 'mod-download-source-name' }, sources.find(([id]) => id === value)?.[1]),
    h('span', { className: 'game-selector-chevron', 'aria-hidden': true },
      h('svg', { viewBox: '0 0 24 24', width: 18, height: 18, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', focusable: 'false' }, h('path', { d: 'm6 9 6 6 6-6' })))),
    open && ReactDOM.createPortal(h('div', {
      ref: menu, id: menuId, className: 'mod-download-source-menu', role: 'menu',
      'aria-label': 'MOD下载来源', style: position, onKeyDown: navigate
    }, sources.map(([id, label]) => h('button', {
      key: id, type: 'button', className: 'mod-download-source-option', role: 'menuitemradio',
      'aria-checked': value === id, 'data-source': id,
      onClick: () => { onChange(id); close(true); }
    }, h('strong', { className: 'mod-download-source-name' }, label),
    h('span', { className: 'game-selector-check', 'aria-hidden': true }, value === id ? '✓' : '')))), document.body));
}

export default function ModDownloadView({ isActive = true, marketKey, onQaqmActiveChange, ...marketProps }) {
  const [source, setSource] = React.useState(rememberedSource);
  const [visited, setVisited] = React.useState(() => new Set([source]));
  const current = marketProps.pendingDetailMod ? 'qaqm' : source;
  React.useEffect(() => {
    onQaqmActiveChange?.(isActive && current === 'qaqm');
    return () => onQaqmActiveChange?.(false);
  }, [isActive, current, onQaqmActiveChange]);
  function selectSource(value) {
    setSource(value);
    setVisited(items => new Set([...items, value]));
    try { localStorage.setItem('qaqm.downloadSource', value); } catch { /* Keep the session selection. */ }
  }
  React.useEffect(() => {
    if (marketProps.pendingDetailMod) selectSource('qaqm');
  }, [marketProps.pendingDetailMod]);
  return h('section', { className: 'mod-download-view', 'aria-label': 'MOD下载' },
    h('header', { className: 'mod-download-header' },
      h('div', null, h('h1', null, h('span', { className: 'mod-download-icon', 'aria-hidden': true }, '↓'), 'MOD下载'),
        h('p', null, '发现喜欢的 MOD，收藏作者，追踪更新。')),
      h(SourceSelector, { value: current, onChange: selectSource, isActive })),
    ...sources.filter(([id]) => visited.has(id) || id === current).map(([id]) =>
      h('div', { key: id, className: 'mod-download-provider', hidden: current !== id, 'data-source': id },
        id === 'qaqm' ? h(ModMarketView, { ...marketProps, key: marketKey, isActive: isActive && current === id }) :
          h(PawchiveView, { source: id, isActive: isActive && current === id }))));
}
