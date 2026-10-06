import { r as React, R as ReactDOM } from './index.js';
const h = React.createElement;

export default function HiddenCharactersDialog({ gameId, gameName, onClose, onRestored }) {
  const [characters, setCharacters] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState('');
  const [error, setError] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [revision, setRevision] = React.useState(0);
  const dialogRef = React.useRef(null);
  const live = React.useRef(true);
  React.useEffect(() => {
    live.current = true;
    return () => { live.current = false; };
  }, []);
  React.useEffect(() => {
    let canceled = false;
    setLoading(true);
    setError('');
    window.api.getHiddenCharacters(gameId).then(result => {
      if (canceled) return;
      if (!result?.success) throw Error(result?.error || '读取隐藏角色失败');
      setCharacters(result.characters);
    }).catch(error => { if (!canceled) setError(error.message); })
      .finally(() => { if (!canceled) setLoading(false); });
    return () => { canceled = true; };
  }, [gameId, revision]);
  React.useEffect(() => {
    const previous = document.activeElement;
    dialogRef.current?.querySelector('input')?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);

  async function restore(name) {
    if (busy) return;
    setBusy(name);
    setError('');
    try {
      const result = await window.api.setCharacterHidden(name, false, gameId);
      if (!live.current) return;
      if (!result?.success) throw Error(result?.error || '恢复显示失败');
      setCharacters(items => items.filter(item => item.name !== name));
      onRestored?.(name);
    } catch (error) { if (live.current) setError(error.message); }
    finally { if (live.current) setBusy(''); }
  }
  function onKeyDown(event) {
    if (event.key === 'Escape') { event.stopPropagation(); if (!busy) onClose(); }
    if (event.key !== 'Tab') return;
    const controls = [...dialogRef.current.querySelectorAll('button:not(:disabled), input')];
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  const filtered = characters.filter(item => item.name.toLowerCase().includes(query.trim().toLowerCase()));
  return ReactDOM.createPortal(h('div', { className: 'modal-backdrop', onClick: event => { if (event.target === event.currentTarget && !busy) onClose(); } },
    h('section', { ref: dialogRef, className: 'modal-content hidden-characters-dialog', role: 'dialog', 'aria-modal': true, 'aria-labelledby': 'hidden-characters-title', onKeyDown },
      h('div', { className: 'hidden-characters-header' },
        h('h2', { id: 'hidden-characters-title', className: 'text-h2' }, '隐藏角色'),
        h('button', { type: 'button', className: 'btn btn-secondary', 'aria-label': '关闭隐藏角色', disabled: !!busy, onClick: onClose }, '关闭')),
      h('p', { className: 'hidden-characters-description' }, `${gameName || '当前游戏'} · 隐藏的角色不会出现在角色列表和游戏内浮窗中。恢复显示后，Mod 仍保持禁用。`),
      h('input', { className: 'input', value: query, onChange: event => setQuery(event.target.value), 'aria-label': '搜索隐藏角色', placeholder: '搜索隐藏角色…' }),
      error && h('div', { className: 'hidden-characters-error', role: 'alert' }, error, !busy && h('button', { className: 'btn btn-secondary', onClick: () => setRevision(value => value + 1) }, '重新加载')),
      h('div', { className: 'hidden-characters-list', 'aria-busy': loading || !!busy },
        loading ? h('p', null, '正在读取隐藏角色…') : filtered.length ? filtered.map(item => h('div', { key: item.name, className: 'hidden-character-row' },
          item.coverUrl && h('img', { src: item.coverUrl, alt: '' }),
          h('span', { className: 'hidden-character-name' }, item.name),
          h('button', { type: 'button', className: 'btn btn-secondary', disabled: !!busy, onClick: () => restore(item.name), 'aria-label': `恢复显示 ${item.name}` }, busy === item.name ? '恢复中…' : '恢复显示')))
          : h('p', { className: 'hidden-characters-empty' }, query.trim() ? '没有匹配的隐藏角色' : '暂无隐藏角色。可在角色卡片的右键菜单中隐藏角色。')),
      h('p', { className: 'hidden-characters-description', role: 'status' }, `共 ${characters.length} 个隐藏角色`)
    )), document.body);
}
