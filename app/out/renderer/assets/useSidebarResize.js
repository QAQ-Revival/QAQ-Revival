import { r as React } from './index.js';
import { GAME_MENU_WIDTH } from './sidebarLayout.js';

const MIN_WIDTH = 200;
const DEFAULT_WIDTH = 240;
const STORAGE_KEY = 'qaqm.sidebarWidth';
const clamp = value => Math.min(GAME_MENU_WIDTH, Math.max(MIN_WIDTH, value));
export function useSidebarResize(collapsed) {
  const [scale, setScale] = React.useState(1);
  React.useLayoutEffect(() => {
    const update = () => {
      const value = Number(getComputedStyle(document.documentElement).getPropertyValue('--ui-scale')) || 1;
      setScale(Math.min(1.4, Math.max(0.7, value)));
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
    return () => observer.disconnect();
  }, []);
  const [width, setWidth] = React.useState(() => {
    try { const saved = Number(localStorage.getItem(STORAGE_KEY)); if (Number.isFinite(saved) && saved > 0) return clamp(saved); } catch {}
    return DEFAULT_WIDTH;
  });
  const [resizing, setResizing] = React.useState(false);
  const drag = React.useRef(null);
  const minWidth = Math.min(GAME_MENU_WIDTH, Math.max(MIN_WIDTH, Math.round(MIN_WIDTH * scale)));
  const displayedWidth = Math.max(minWidth, width);
  const resizeWidth = value => Math.max(minWidth, clamp(value));
  function save(value) {
    const next = resizeWidth(Math.round(value));
    setWidth(next);
    try { localStorage.setItem(STORAGE_KEY, String(next)); } catch {}
  }
  function finish(event, cancel = false) {
    const current = drag.current;
    if (!current) return;
    drag.current = null;
    setResizing(false);
    save(cancel ? current.width : current.next);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  return {
    style: collapsed ? undefined : { width: displayedWidth / scale, transition: resizing ? 'none' : undefined },
    handle: {
      className: `sidebar-resize-handle${resizing ? ' resizing' : ''}`, role: 'separator', tabIndex: 0,
      'aria-label': '调整侧栏宽度', 'aria-orientation': 'vertical', 'aria-valuemin': minWidth, 'aria-valuemax': GAME_MENU_WIDTH, 'aria-valuenow': displayedWidth,
      title: '拖动调整侧栏宽度；双击恢复默认',
      onPointerDown: event => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.focus();
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { x: event.clientX, width: displayedWidth, next: displayedWidth };
        setResizing(true);
      },
      onPointerMove: event => {
        if (!drag.current) return;
        drag.current.next = resizeWidth(drag.current.width + event.clientX - drag.current.x);
        setWidth(drag.current.next);
      },
      onPointerUp: event => finish(event), onPointerCancel: event => finish(event, true), onLostPointerCapture: event => finish(event),
      onDoubleClick: () => save(DEFAULT_WIDTH),
      onKeyDown: event => {
        const next = { ArrowLeft: displayedWidth - 8, ArrowRight: displayedWidth + 8, Home: minWidth, End: GAME_MENU_WIDTH }[event.key];
        if (next !== undefined) { event.preventDefault(); save(next); }
      }
    }
  };
}
