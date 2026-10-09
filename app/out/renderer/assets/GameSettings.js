import { r as React } from './index.js';
import { GameSettingsPanel, Icon } from './SystemSettings.js';

const h = React.createElement;
export default function GameSettingsView({ activeGame }) {
  const [toast, setToast] = React.useState(null);
  React.useEffect(() => { if (toast) { const timer = setTimeout(() => setToast(null), 6000); return () => clearTimeout(timer); } }, [toast]);
  const sections = [['game-paths', '路径与启动'],
    ...(activeGame?.id === 'genshin-impact' ? [['genshin-anticrash', '防报错'], ['genshin-compatibility', '兼容检查']] : []),
    ...(activeGame?.id === 'wuthering-waves' ? [['wuwa-tuning', '远景与纹理']] : []),
    ...(activeGame?.id === 'neverness-to-everness' ? [['pak', 'Pak 模式']] : []), ['fixer', '独立修复器'], ['game-persist', 'Mod 状态管理']];
  return h('div', { className: 'settings-view system-settings game-settings-view', 'data-game-id': activeGame?.id },
    h('aside', { className: 'system-settings-nav' },
      h('div', { className: 'system-settings-title' }, h('h1', null, '游戏设置'), h('p', null, activeGame?.name || '当前游戏')),
      h('nav', { 'aria-label': '游戏设置分类' }, sections.map(([id, label]) => h('button', { key: id, type: 'button', className: 'system-category',
        onClick: () => document.getElementById(`settings-${id}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }) }, h(Icon, { name: id === 'fixer' ? 'tool' : 'game' }), h('span', null, label)))),
      h('p', { className: 'system-nav-footnote' }, '跟随左侧当前游戏', h('span', null, '各游戏设置独立保存'))),
    h('div', { className: 'system-settings-pane' },
      h('header', { className: 'system-settings-header' }, h('div', null, h('div', { className: 'system-breadcrumb' }, '游戏设置 / ', activeGame?.name),
        h('h2', null, activeGame?.name || '游戏设置'), h('p', null, '配置当前游戏的启动环境与专属功能。')), h('span', { className: 'system-scope' }, '仅当前游戏')),
      h('div', { className: 'system-settings-body' }, activeGame?.id
        ? h(GameSettingsPanel, { key: activeGame.id, gameId: activeGame.id, notify: (type, message) => setToast({ type, message }) })
        : h('div', { className: 'system-state' }, '请先选择游戏'))),
    toast && h('div', { className: `system-toast ${toast.type}`, role: toast.type === 'error' ? 'alert' : 'status' }, toast.message));
}
