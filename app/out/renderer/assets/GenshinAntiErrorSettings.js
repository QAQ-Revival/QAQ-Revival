import { r as React } from './index.js';
import { Button, Section, Row, check } from './SystemSettings.js';

const h = React.createElement;
const injectModes = [
  { value: 'default', label: '跟随 XXMI', desc: '不改写注入方式' },
  { value: 'hook', label: 'Hook', desc: '全局钩子加载' },
  { value: 'direct', label: 'Direct', desc: '直接写入加载' }
];
const primaryModes = [
  { value: 'twin', label: '双生启动', tag: '随机副本', description: '每次生成随机名游戏副本，由 XXMI 启动并注入；原名程序不启动。退出后删除副本。' },
  { value: 'custom', label: '外部定制组件', tag: '固定 Direct', description: '临时替换 GIMI 组件，开启免校验与 Direct 注入。双生不奏效时可尝试，退出后还原。' }
];
export function GenshinAntiErrorSettings({ onPathsChanged }) {
  const [data, setData] = React.useState(null);
  const [error, setError] = React.useState(''), [message, setMessage] = React.useState('');
  const [saveStatus, setSaveStatus] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [advancedOpen, setAdvancedOpen] = React.useState(false);
  const pending = React.useRef(false), alive = React.useRef(true);
  React.useEffect(() => {
    if (data?.session?.createdAt) { setMessage(''); setError(''); }
  }, [data?.session?.createdAt]);
  React.useEffect(() => {
    alive.current = true;
    run(() => window.api.genshinGetAntiCrash());
    // Sessions start from the launch card outside this panel; refresh quietly when state changes.
    const timer = setInterval(() => {
      if (pending.current) return;
      window.api.genshinGetAntiCrash().then(result => {
        if (!alive.current || !result?.settings) return;
        setData(previous => previous && previous.revision === result.revision ? previous : result);
      }).catch(() => {});
    }, 2500);
    return () => { alive.current = false; clearInterval(timer); };
  }, []);
  async function run(action, saving = false) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(''); setMessage('');
    if (saving) setSaveStatus('正在保存…');
    try {
      const result = await action();
      if (result?.canceled) return;
      check(result);
      if (!alive.current) return;
      if (result.settings) setData(result);
      if (saving) setSaveStatus('已保存 · 下次直接启动生效');
      if (!saving && result.message) setMessage(result.message);
      else if (result.notes?.length) setMessage(result.notes.join('；'));
      if (result.pathsChanged) onPathsChanged?.();
    } catch (e) { if (alive.current) { setError(e.message); if (saving) setSaveStatus(''); } }
    finally { pending.current = false; if (alive.current) setBusy(false); }
  }
  const save = updates => run(() => window.api.genshinUpdateAntiCrash(updates), true);
  const settings = data?.settings || { twin: false, manualStart: false, injectMode: 'default', networkBlock: false, originalDll: false, customDll: false };
  const conflicting = settings.twin && settings.customDll;
  const primaryMode = conflicting ? '' : settings.twin ? 'twin' : settings.customDll ? 'custom' : 'none';
  const selectPrimary = mode => save({ twin: mode === 'twin', customDll: mode === 'custom' });
  async function pickCustomDll() {
    if (busy) return;
    try {
      const selected = await window.api.genshinSelectCustomDll();
      if (selected?.canceled) return;
      check(selected);
      await save({ customDllPath: selected.path });
    } catch (e) { setError(e.message); }
  }
  const session = data?.session;
  const advancedSummary = [settings.customDll ? 'Direct（随主方案）' : injectModes.find(mode => mode.value === settings.injectMode)?.label,
    settings.manualStart ? '等待手动启动' : '', settings.networkBlock ? '网络屏蔽已开启' : '网络屏蔽关闭'].filter(Boolean).join(' · ');
  return h(Section, { id: 'genshin-anticrash', title: h('span', { className: 'anticrash-heading' },
    h('span', null, '原神 · 防报错'),
    h('span', { className: 'anticrash-save-status', role: 'status' }, saveStatus)) },
    !data && h('p', { className: 'system-state', role: 'status' }, '正在读取防报错配置…'),
    error && h('p', { className: 'system-notice', role: 'alert' }, error),
    message && h('p', { className: 'system-notice anticrash-feedback', role: 'status' }, message),
    data && h(React.Fragment, null,
      !data.ready && h('p', { className: 'system-notice', role: 'alert' }, '暂不可用：', data.blockers.join('；'), '。可到“兼容检查”处理。'),
      session && h('div', { className: 'anticrash-live', role: 'region', 'aria-label': '进行中的防报错会话' },
        h('div', { className: 'anticrash-live-heading' }, h('h4', null, '进行中的防报错会话'),
          h(Button, { disabled: busy, onClick: () => run(async () => {
            const result = await window.api.genshinAntiCrashCleanup();
            check(result);
            const fresh = await window.api.genshinGetAntiCrash();
            check(fresh);
            return { ...fresh, message: result.cleaned ? '防报错会话已清理。' : (result.notes?.join('；') || '未能完成清理，请稍后重试。') };
          }) }, '立即清理')),
        h('p', { className: 'anticrash-hint' }, `启动于 ${new Date(session.createdAt).toLocaleString()}。以下为本次会话；修改设置从下次直接启动生效。`),
        h('div', { className: 'anticrash-session', 'data-twin-ready': session.twinReady },
          h('p', null, '主方案：', session.dllSwap ? '外部定制组件' : session.twinName ? '双生启动' : '不启用',
            ' · 注入方式：', injectModes.find(mode => mode.value === session.injectMode)?.label || '跟随 XXMI',
            session.injectMode === 'default' && session.effectiveInjectMode ? `（${session.effectiveInjectMode === 'HOOK' ? 'Hook' : session.effectiveInjectMode === 'DIRECT' ? 'Direct' : session.effectiveInjectMode}）` : ''),
          session.launcherName && h('p', null, '随机名 XXMI：', h('code', null, session.launcherName), '（已同步 Hook 加载器名称）'),
          session.twinName && h('p', null, '随机名副本：', h('code', { title: session.twinPath }, session.twinName), session.twinReady ? '（已就绪）' : '（文件缺失或已变化）'),
          session.dllSwap && h('p', null, '外部定制组件生效中：', h('code', null, (session.dllSwap.source || '').split(/[\\/]/).pop() || 'd3d11.dll')),
          session.originalDll && h('p', null, '本地原版组件：', h('code', null, 'original_d3d11.dll'), session.originalDll.created ? '（本次创建，清理时删除）' : '（沿用已有文件，清理时保留）'),
          session.manualStart && h('p', null, '手动启动模式：注入准备完成后，请自行启动', session.twinName ? '上面的随机名副本。' : '游戏。'),
          session.networkBlock && h('p', null, `网络屏蔽中（${session.rules.length} 条规则）：游戏无法联网，包括登录。`)),
        h('p', { className: 'anticrash-hint' }, session.watcherActive
          ? '检测到游戏退出后自动清理；游戏未启动时也可立即清理，运行中需先退出游戏。'
          : '会话记录仍保留。请确认游戏已退出后重试清理；清理失败时会保留恢复记录。')),
      h('fieldset', { className: 'anticrash-primary', 'aria-describedby': 'anticrash-primary-hint' },
        h('legend', null, '主方案'),
        h('p', { id: 'anticrash-primary-hint', className: 'anticrash-hint' }, '两种方案互斥，选择时自动切换；也可不启用。仅在 QAQ「直接启动」时应用。'),
        conflicting && h('p', { className: 'system-notice', role: 'alert' }, '已有设置同时开启了两种主方案，请重新选择一项。'),
        h('label', { className: 'anticrash-none' },
          h('input', { type: 'radio', name: 'genshin-primary-mode', value: 'none', 'aria-label': '原神不启用主方案', checked: primaryMode === 'none', disabled: busy, onChange: () => selectPrimary('none') }),
          h('span', null, '不启用主方案', h('small', null, '附加项仍可单独使用'))),
        h('div', { className: 'anticrash-primary-options' }, primaryModes.map(mode =>
          h('label', { key: mode.value, className: 'anticrash-primary-option', 'data-selected': primaryMode === mode.value },
            h('input', { type: 'radio', name: 'genshin-primary-mode', value: mode.value, 'aria-label': `原神${mode.label}`, checked: primaryMode === mode.value, disabled: busy, onChange: () => selectPrimary(mode.value) }),
            h('span', { className: 'anticrash-primary-copy' },
              h('span', { className: 'anticrash-option-title' }, h('strong', null, mode.label), h('span', { className: 'anticrash-tag' }, mode.tag)),
              h('span', { className: 'anticrash-option-description' }, mode.description))))),
        settings.customDll && h('div', { className: 'anticrash-custom-config' },
          h('div', { className: 'system-path-control anticrash-component-picker' },
            h('span', null, '当前组件'),
            h('code', { className: 'anticrash-dll-path', title: data.customDllPath || '' }, data.customDllPath ? data.customDllPath.split(/[\\/]/).pop() : '未选择'),
            h(Button, { disabled: busy, onClick: pickCustomDll }, '选择组件…'),
            data.customDllPath && !data.customDllPathIsDefault && h(Button, { disabled: busy, onClick: () => save({ customDllPath: '' }) }, '恢复默认')),
          h('p', { className: 'anticrash-hint' }, data.customDllPath
            ? (data.customDllPathIsDefault ? '使用程序目录下 local-components/d3d11-nocheck.dll。' : '使用自行选择的组件文件。') + '本方案固定使用 Direct，切换方案后恢复原注入偏好。'
            : '请先选择定制 DLL，或放入程序目录下 local-components/d3d11-nocheck.dll 后再启动。'))),
      h('div', { className: 'anticrash-addons', role: 'group', 'aria-labelledby': 'anticrash-addons-heading' },
        h('h4', { id: 'anticrash-addons-heading' }, '附加项'),
        h('p', { className: 'anticrash-hint' }, '可与任一主方案搭配，也可单独开启；按需使用。'),
      h(Row, { title: '本地原版组件', description: '将系统渲染库复制为 GIMI 目录下的 original_d3d11.dll，供组件加载。退出后删除本次副本；已有文件保留。' },
        h('input', { type: 'checkbox', role: 'switch', className: 'system-switch', 'aria-label': '原神本地原版组件', checked: settings.originalDll, disabled: busy,
          onChange: e => save({ originalDll: e.target.checked }) })),
      h('details', { className: 'anticrash-advanced', open: advancedOpen, onToggle: e => setAdvancedOpen(e.currentTarget.open) },
        h('summary', null, h('span', null, '排障选项'), h('span', { className: `anticrash-advanced-summary${settings.networkBlock ? ' is-warning' : ''}` }, advancedSummary)),
        h(Row, { title: '等待手动启动', description: '仅用于自行控制游戏启动时机：XXMI 准备好后不自动启动游戏。双生开启时需自行启动随机名副本；通常保持关闭。' },
          h('input', { type: 'checkbox', role: 'switch', className: 'system-switch', 'aria-label': '原神等待手动启动', checked: settings.manualStart, disabled: busy,
            onChange: e => save({ manualStart: e.target.checked }) })),
        h(Row, { title: '注入方式', description: settings.customDll ? '外部定制组件固定使用 Direct；切换主方案后，此处恢复你之前的选择。' : '默认跟随 XXMI。仅在默认方式报错时尝试 Hook 或 Direct。' },
          h('select', { className: 'anticrash-inject-select', 'aria-label': '原神注入方式', value: settings.customDll ? 'direct' : settings.injectMode, disabled: busy || settings.customDll,
            title: settings.customDll ? '外部定制组件固定使用 Direct' : injectModes.find(mode => mode.value === settings.injectMode)?.desc,
            onChange: e => save({ injectMode: e.target.value }) }, injectModes.map(mode => h('option', { key: mode.value, value: mode.value }, mode.label)))),
        h(Row, { title: h(React.Fragment, null, '网络屏蔽', h('span', { className: 'anticrash-tag warning' }, '断网测试')),
          description: '阻止游戏程序对外连接，包括登录；退出后移除规则。需要管理员权限，仅在明确需要断网测试时开启。' },
          h('input', { type: 'checkbox', role: 'switch', className: 'system-switch', 'aria-label': '原神网络屏蔽', checked: settings.networkBlock, disabled: busy || !data.elevated && !settings.networkBlock,
            onChange: e => save({ networkBlock: e.target.checked }) })),
        !data.elevated && h('p', { className: 'anticrash-hint' }, '当前未以管理员身份运行，网络屏蔽不可开启。'))),
      h('p', { className: 'anticrash-footnote' }, '设置会保存，临时改动随会话清理。正常退出后还原 XXMI 配置与组件；异常时保留恢复记录，下次打开 QAQ 再尝试。实际效果以实机为准。')));
}
