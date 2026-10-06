import { r as React } from './index.js';

const ORDER_CHANGED = 'qaqm:order-changed';
function readSavedOrder(storageKey) {
  try { return JSON.parse(localStorage.getItem(storageKey) || 'null'); }
  catch { return null; }
}

// Persist IDs only: removed items are ignored and new items keep their default order.
export function applySavedOrder(items, saved) {
  const remaining = new Map(items.map(item => [item.id, item]));
  const result = [];
  for (const id of Array.isArray(saved) ? saved : []) {
    if (!remaining.has(id)) continue;
    result.push(remaining.get(id));
    remaining.delete(id);
  }
  return [...result, ...remaining.values()];
}

export function useSortableOrder(items, storageKey, enabled = true) {
  const [order, setOrder] = React.useState(() => readSavedOrder(storageKey));
  const [dragged, setDragged] = React.useState(null);
  const [target, setTarget] = React.useState(null);
  const [announcement, setAnnouncement] = React.useState('');
  const [error, setError] = React.useState('');
  const source = React.useRef(null);
  const suppressClickUntil = React.useRef(0);
  const orderedItems = applySavedOrder(items, order);

  function finish() {
    if (source.current !== null) suppressClickUntil.current = Date.now() + 250;
    source.current = null;
    setDragged(null);
    setTarget(null);
  }

  React.useEffect(() => { if (!enabled) finish(); }, [enabled]);
  React.useEffect(() => {
    const changed = event => {
      if (event.detail?.storageKey === storageKey) setOrder(event.detail.order);
    };
    const stored = event => {
      if (event.storageArea === localStorage && (event.key === storageKey || event.key === null)) {
        setOrder(readSavedOrder(storageKey));
      }
    };
    window.addEventListener(ORDER_CHANGED, changed);
    window.addEventListener('storage', stored);
    return () => {
      window.removeEventListener(ORDER_CHANGED, changed);
      window.removeEventListener('storage', stored);
    };
  }, [storageKey]);

  function move(id, targetId, edge) {
    if (id === targetId || !orderedItems.some(item => item.id === id)) return;
    const next = orderedItems.filter(item => item.id !== id).map(item => item.id);
    const index = next.indexOf(targetId);
    if (index < 0) return;
    next.splice(index + (edge === 'after' ? 1 : 0), 0, id);
    if (next.every((value, i) => value === orderedItems[i].id)) return;
    setOrder(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      setError('');
    } catch {
      setError('顺序已调整，但无法保存，重启后可能恢复。');
    }
    window.dispatchEvent(new CustomEvent(ORDER_CHANGED, { detail: { storageKey, order: next } }));
    const item = orderedItems.find(item => item.id === id);
    setAnnouncement(`${item.label || item.name}已移至第 ${next.indexOf(id) + 1} 项，共 ${next.length} 项`);
  }

  function edgeAt(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    return event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
  }

  function itemProps(id) {
    return {
      draggable: enabled && orderedItems.length > 1,
      'data-sort-id': id,
      'data-sort-dragging': dragged === id ? 'true' : undefined,
      'data-sort-edge': target?.id === id ? target.edge : undefined,
      'aria-keyshortcuts': 'Alt+ArrowUp Alt+ArrowDown',
      onPointerDown: () => { suppressClickUntil.current = 0; },
      onClickCapture: event => {
        if (Date.now() >= suppressClickUntil.current) return;
        event.preventDefault();
        event.stopPropagation();
      },
      onDragStart: event => {
        if (!enabled || orderedItems.length < 2) { event.preventDefault(); return; }
        event.stopPropagation();
        source.current = id;
        suppressClickUntil.current = Infinity;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('application/x-qaqm-order', storageKey);
        setDragged(id);
      },
      onDragOver: event => {
        // Only accept a drag originating from this list, never files or another list.
        if (!enabled || source.current === null) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = 'move';
        const edge = edgeAt(event);
        setTarget(previous => id === source.current ? null :
          previous?.id === id && previous.edge === edge ? previous : { id, edge });
      },
      onDragLeave: event => {
        if (event.currentTarget.contains(event.relatedTarget)) return;
        setTarget(previous => previous?.id === id ? null : previous);
      },
      onDrop: event => {
        if (!enabled || source.current === null) return;
        event.preventDefault();
        event.stopPropagation();
        move(source.current, id, edgeAt(event));
        finish();
      },
      onDragEnd: event => { event.stopPropagation(); finish(); },
      onKeyDown: event => {
        if (event.key === 'Enter' || event.key === ' ') suppressClickUntil.current = 0;
        if (!enabled || !event.altKey || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault();
        event.stopPropagation();
        const index = orderedItems.findIndex(item => item.id === id);
        const adjacent = orderedItems[index + (event.key === 'ArrowUp' ? -1 : 1)];
        if (adjacent) move(id, adjacent.id, event.key === 'ArrowUp' ? 'before' : 'after');
      }
    };
  }

  return { items: orderedItems, itemProps, announcement, error };
}
