import { r as React } from './index.js';
import { Button, Section, Row, check } from './SystemSettings.js';

const h = React.createElement;
const levels = { error: '需处理', warning: '待核对', info: '提示', ok: '通过' };
export function GenshinCompatibilitySettings({ onPathsChanged }) {
  const [data, setData] = React.useState(null), [selected, setSelected] = React.useState([]);
  const [args, setArgs] = React.useState(''), [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(''), [message, setMessage] = React.useState('');
  const alive = React.useRef(true), pending = React.useRef(false);
  async function run(action) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(''); setMessage('');
    try {
      const result = await action();
      if (result?.canceled) return;
      check(result);
      if (!alive.current) return;
      if (result.checks) { setData(result); setSelected(result.repairs.map(item => item.id)); setArgs(result.launchArgs || ''); }
      if (result.message) setMessage(result.message);
      if (result.pathsChanged) onPathsChanged?.();
    } catch (e) { if (alive.current) setError(e.message); }
    finally { pending.current = false; if (alive.current) setBusy(false); }
  }
  React.useEffect(() => { alive.current = true; run(() => window.api.genshinCheckEnvironment()); return () => { alive.current = false; }; }, []);
  return h(Section, { id: 'genshin-compatibility', title: '原神 · 兼容检查' },
    h(Row, { title: '启动环境检查', description: '在本机检查游戏、GIMI 组件和路径配置，帮助定位普通启动或加载问题。文件结构检查不代表已验证发行签名，也不能保证消除游戏错误码。', stacked: true },
      h('div', { className: 'compatibility-actions' }, h(Button, { primary: true, disabled: busy, onClick: () => run(() => window.api.genshinCheckEnvironment()) }, busy ? '检查中…' : '重新检查'),
        h(Button, { disabled: busy || !data, onClick: () => run(() => window.api.genshinExportCheck()) }, '导出检查报告'))),
    error && h('p', { className: 'system-notice', role: 'alert' }, error),
    message && h('p', { className: 'system-notice', role: 'status' }, message),
    data && h(React.Fragment, null,
      h('p', { className: 'compatibility-summary', role: 'status' }, `检查结果：${data.summary.errors} 项需处理，${data.summary.warnings} 项待核对，${data.summary.passed} 项通过。`),
      h('div', { className: 'compatibility-checks' }, data.checks.map(item => h('div', { key: item.id, className: 'compatibility-check', 'data-check-id': item.id, 'data-level': item.level },
        h('span', { className: `compatibility-level ${item.level}` }, levels[item.level]), h('div', null, h('strong', null, item.title), h('p', null, item.message), item.path && h('code', { title: item.path }, item.path))))),
      data.repairs.length > 0 && h(Row, { title: '可修复的路径配置', description: '所选路径已经检查有效。关闭原神与 XXMI 后，可备份并将这些路径同步到 XXMI；其他游戏配置会保留。', stacked: true },
        h('div', { className: 'compatibility-repairs' }, data.repairs.map(item => h('label', { key: item.id },
          h('input', { type: 'checkbox', checked: selected.includes(item.id), disabled: busy, onChange: e => setSelected(previous => e.target.checked ? [...previous, item.id] : previous.filter(id => id !== item.id)) }),
          h('span', null, h('strong', null, item.title), h('code', null, item.before), h('span', { 'aria-hidden': true }, ' → '), h('code', null, item.after))))),
        h(Button, { primary: true, disabled: busy || !selected.length, onClick: () => run(() => window.api.genshinRepairEnvironment({ revision: data.revision, ids: selected })) }, '备份并同步所选路径')),
      h(Row, { title: '恢复上次路径修复', description: '恢复前会核对文件是否随后发生变化，避免覆盖你或 XXMI 保存的新配置。' },
        h(Button, { disabled: busy || !data.canRestore, onClick: () => run(() => window.api.genshinRestoreEnvironment({ revision: data.revision })) }, '恢复上次路径修复')),
      h(Row, { title: '启动前检查', description: '开启后，“直接启动”会先检查原神环境；明确的配置或文件错误会阻止此次启动。仍可打开 XXMI 界面处理问题。' },
        h('input', { type: 'checkbox', role: 'switch', className: 'system-switch', 'aria-label': '原神启动前检查', checked: data.preflightEnabled, disabled: busy,
          onChange: e => { const enabled = e.target.checked; run(() => window.api.genshinUpdateCheckSettings({ preflightEnabled: enabled })); } })),
      h('details', { className: 'compatibility-advanced' }, h('summary', null, '启动附加参数'),
        h('p', null, '通常留空。这里的参数传给 XXMI；--xxmi / -x 会覆盖当前游戏选择。'),
        h('div', { className: 'system-path-control' }, h('input', { className: 'system-text-input', 'aria-label': '原神启动附加参数', value: args, maxLength: 2048, disabled: busy, onChange: e => setArgs(e.target.value) }),
          h(Button, { disabled: busy || args === data.launchArgs, onClick: () => run(() => window.api.genshinUpdateCheckSettings({ launchArgs: args })) }, '保存附加参数'))),
      h('details', { className: 'compatibility-logs' }, h('summary', null, '最近日志线索'), h('p', null, '只分析日志末尾的相关记录，可能来自历史启动；这些线索不会阻止启动。'),
        !data.logs.length ? h('p', null, '没有找到可读取的 XXMI / GIMI 日志。') : data.logs.map(log => h('div', { key: log.name }, h('strong', null, log.name),
          h('p', null, `最后修改：${new Date(log.modifiedAt).toLocaleString()}${log.tailOnly ? '（仅检查末尾）' : ''}`),
          log.hints.length ? log.hints.map(hint => h('p', { key: hint.id }, `${hint.title}（${hint.count} 条）。${hint.advice}`)) : h('p', null, '未在读取范围内发现相关错误线索。'))))));
}
