import { r as React } from './index.js';
import { Button, Section, Row, check } from './SystemSettings.js';

const h = React.createElement;
export function WuwaTuningSettings() {
  const [data, setData] = React.useState(null);
  const [selected, setSelected] = React.useState('');
  const [error, setError] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const alive = React.useRef(true);
  async function load() {
    setBusy(true); setError('');
    try { const result = check(await window.api.wuwaGetTuning()); if (alive.current) { setData(result); setSelected(result.preset); } }
    catch (e) { if (alive.current) setError(e.message); }
    finally { if (alive.current) setBusy(false); }
  }
  React.useEffect(() => { alive.current = true; load(); return () => { alive.current = false; }; }, []);
  async function act(action) {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await action();
      if (result?.canceled) return;
      check(result);
      if (alive.current) { setData(result); setSelected(result.preset); setMessage(result.message); }
    } catch (e) { if (alive.current) setError(e.message); }
    finally { if (alive.current) setBusy(false); }
  }
  const current = data?.presets.find(preset => preset.id === data.preset)?.name || (data?.preset === 'device-profile' ? '导入的 DeviceProfiles' : '当前自定义配置');
  return h(Section, { id: 'wuwa-tuning', title: '鸣潮 · 远景与纹理' },
    h(Row, { title: '远景 Mod 方案', description: '用于缓解远处恢复原版或贴图异常。不同游戏版本和 Mod 的效果可能不同；高模距离与完整贴图可能增加性能、显存开销。', stacked: true },
      data && h('div', { className: 'wuwa-tuning-options', role: 'group', 'aria-label': '鸣潮远景方案' }, data.presets.map(preset => h('button', {
        key: preset.id, type: 'button', className: 'system-choice', 'data-wuwa-preset': preset.id, 'aria-pressed': selected === preset.id,
        disabled: busy, onClick: () => setSelected(preset.id)
      }, h('strong', null, preset.name), h('span', null, preset.description))))),
    data && h('p', { className: 'system-notice' }, `当前：${current}。模型参数：${data.values.launcherFov}；纹理倍率：${data.values.hidden ?? '未额外设置'}。`),
    h('div', { className: 'wuwa-tuning-actions' },
      h(Button, { primary: true, disabled: busy || !data?.presets.some(preset => preset.id === selected), onClick: () => act(() => window.api.wuwaApplyTuning({ preset: selected, revision: data.revision })) }, busy ? '处理中…' : '备份并应用方案'),
      h(Button, { disabled: busy || !data?.canRestore, onClick: () => act(() => window.api.wuwaRestoreTuning({ revision: data.revision })) }, '恢复上次应用前'),
      h(Button, { disabled: busy, onClick: load }, '重新读取')),
    h(Row, { title: '3.1 · DeviceProfiles 文件方案', description: '原教程附件尚未核实，可导入你已有的有效配置文件。应用前自动备份，并清除本页其他方案的调优参数。', stacked: true },
      h(Button, { disabled: busy || !data, onClick: () => act(() => window.api.wuwaImportDeviceProfile({ revision: data.revision })) }, '选择文件并应用')),
    error && h('p', { className: 'system-notice', role: 'alert' }, error),
    message && h('p', { className: 'system-notice', role: 'status' }, message),
    h('p', { className: 'system-notice' }, '应用前请关闭鸣潮与 XXMI；保存后通过 XXMI 重启游戏。这里只调整配置参数，不能自动生成 Mod 缺失的远景模型。'));
}
