import { r as React } from './index.js';
import { openPersistManager, PersistVariables } from './PersistStateBrowser.js';
const h = React.createElement;
export default function ModPersistSummary({ gameId, characterName, modName }) {
  const [data, setData] = React.useState(null), [error, setError] = React.useState('');
  React.useEffect(() => {
    let canceled = false;
    setData(null); setError('');
    window.api.persistBridgeMod(gameId, characterName, modName).then(result => {
      if (!result?.success) throw Error(result?.error || '无法读取持久化配置');
      if (!canceled) setData(result);
    }).catch(e => { if (!canceled) setError(e.message); });
    return () => { canceled = true; };
  }, [gameId, characterName, modName]);
  return h('section', { className: 'mod-persist-summary', 'aria-label': 'Mod 持久化配置' },
    h('div', { className: 'persist-detail-heading' }, h('strong', null, '持久化配置'), h('button', { type: 'button', className: 'system-button', onClick: () => openPersistManager(gameId, characterName, modName) }, '打开状态管理')),
    error ? h('p', { role: 'alert' }, error) : !data ? h('p', { role: 'status' }, '正在读取…') : h(React.Fragment, null,
      h('p', null, `${data.game.enabled ? '此游戏已开启状态保存' : '此游戏未开启状态保存'} · ${data.entries.length} 份配置`),
      data.entries.length ? h('details', null, h('summary', null, '查看已保存的变量'), h(PersistVariables, { entries: data.entries })) : h('p', null, '此 Mod 暂无保存配置')));
}
