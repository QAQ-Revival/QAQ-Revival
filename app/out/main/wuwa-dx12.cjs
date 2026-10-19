const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const childProcess = require('node:child_process');
const { peInfo, samePath } = require('./genshin-diagnostics.cjs');
const { editIni, iniValue } = require('./wuwa-tuning.cjs');
const { quoteWindowsArgument } = require('./windows-launch.cjs');

const FOV = 'r.Kuro.SkeletalMesh.DistanceLODBaseFOV';
// Upstream launch requirements: https://github.com/lekarsenten/wwmi-dx12
const TEXTURES = { 'r.TextureStreaming': 1, 'r.Streaming.FullyLoadUsedTextures': 1,
  'r.Streaming.Boost': 30, 'r.Streaming.MinBoost': 30, 'r.Streaming.HLODStrategy': 2, 'r.MipMapLODBias': -1 };
const powershell = () => path.join(process.env.SystemRoot || 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
const literal = value => "'" + String(value).replace(/'/g, "''") + "'";
const isFile = file => { try { return !!file && fs.statSync(file).isFile(); } catch { return false; } };
const isDir = file => { try { return !!file && fs.statSync(file).isDirectory(); } catch { return false; } };
function read(file) {
  try {
    if (fs.statSync(file).size > 2 * 1024 * 1024) throw Error('配置文件过大，已保留原文件');
    return fs.readFileSync(file);
  } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
function decode(bytes) {
  if (!bytes) return { text: '', encode: value => Buffer.from(value) };
  const wide = bytes[0] === 255 && bytes[1] === 254;
  const bom = wide ? bytes.subarray(0, 2) : bytes.subarray(0, 3).equals(Buffer.from([239, 187, 191])) ? bytes.subarray(0, 3) : Buffer.alloc(0);
  const encoding = wide ? 'utf16le' : 'utf8', text = bytes.subarray(bom.length).toString(encoding);
  if (text.includes('\ufffd') || text.includes('\0')) throw Error('配置编码无法识别，已保留原文件');
  return { text, encode: value => Buffer.concat([bom, Buffer.from(value, encoding)]) };
}
function iniSetting(text, section, key) {
  let current = '', result = '';
  for (const line of text.split(/\r?\n/)) {
    const header = /^\s*\[([^\]]+)\]/.exec(line);
    if (header) current = header[1].toLowerCase();
    const entry = /^\s*([^;#=]+?)\s*=\s*(.*)$/.exec(line);
    if (current === section.toLowerCase() && entry?.[1].trim().toLowerCase() === key.toLowerCase()) result = entry[2].trim();
  }
  return result;
}
function setWwmiDirectory(text, directory) {
  const newline = text.includes('\r\n') ? '\r\n' : '\n';
  let inSection = false;
  const lines = text.split(/\r?\n/).filter(line => {
    const header = /^\s*\[([^\]]+)\]/.exec(line);
    if (header) inSection = header[1].toLowerCase() === 'wwmi-dx12';
    return !(inSection && /^\s*wwmi_dir\s*=/i.test(line));
  });
  const index = lines.findIndex(line => /^\s*\[wwmi-dx12\]/i.test(line));
  if (index >= 0) lines.splice(index + 1, 0, `wwmi_dir = ${directory}`);
  else lines.push('', '[wwmi-dx12]', `wwmi_dir = ${directory}`, '');
  // GetPrivateProfileStringW needs a Unicode INI for non-ASCII installation paths.
  return Buffer.from('\ufeff' + lines.join(newline), 'utf16le');
}
function runPowerShell(script) {
  return new Promise((resolve, reject) => childProcess.execFile(powershell(), ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')],
    { windowsHide: true, timeout: 8000, maxBuffer: 1024 * 1024 }, (error, stdout) => error ? reject(Error('无法读取 Windows 组件或进程状态，请重试')) : resolve(String(stdout).trim())));
}
async function inspectReShade(file) {
  if (!peInfo(file).valid) return { ok: false, message: '未安装有效的 x64 ReShade，请安装 6.8.0 或更新的完整插件版' };
  const info = JSON.parse(await runPowerShell(`$ErrorActionPreference='Stop'; $v=[Diagnostics.FileVersionInfo]::GetVersionInfo(${literal(file)}); @{name=$v.ProductName; major=$v.FileMajorPart; minor=$v.FileMinorPart; build=$v.FileBuildPart} | ConvertTo-Json -Compress`));
  if (!/ReShade/i.test(info.name || '')) return { ok: false, message: '游戏目录的 dxgi.dll 不是 ReShade，请先处理冲突；不会覆盖此文件' };
  const version = `${info.major}.${info.minor}.${info.build}`;
  if (info.major < 6 || (info.major === 6 && info.minor < 8)) return { ok: false, message: `ReShade ${version} 过旧，需要 6.8.0 或更新版本` };
  if (fs.statSync(file).size > 128 * 1024 * 1024) return { ok: false, message: 'ReShade 文件异常，请重新安装完整插件版' };
  const bytes = fs.readFileSync(file);
  // Official standard builds contain this diagnostic and refuse external add-ons.
  const limited = bytes.includes(Buffer.from('only limited add-on functionality'));
  const exportsAddon = bytes.includes(Buffer.from('ReShadeRegisterAddon\0'));
  return { ok: exportsAddon && !limited, version, message: exportsAddon && !limited ? `ReShade ${version}（完整插件版）` : '当前 ReShade 不支持完整插件，请重新安装 full add-on support 版本' };
}
async function assertStopped(paths) {
  const launcherBin = paths.launcherPath ? path.dirname(paths.launcherPath) : '';
  const result = await runPowerShell(`$ErrorActionPreference='Stop'; $bin=${literal(launcherBin)}; @(Get-Process | Where-Object { $_.ProcessName -in @('Client-Win64-Shipping','Wuthering Waves') -or ($bin -and $_.Path -and [IO.Path]::GetDirectoryName($_.Path) -eq $bin) }).Count`);
  if (result !== '0') throw Error('请先完全关闭鸣潮与 XXMI，再切换或启动 DX12');
}
function resolveWuwaDx12Paths({ gamePath, gameFolder, importerPath, modsPath, launcherPath }) {
  let root = gamePath ? path.dirname(gamePath) : gameFolder || '';
  for (let level = 0; root && level < 6; level++) {
    if (isFile(path.join(root, 'Wuthering Waves.exe'))) break;
    const parent = path.dirname(root);
    root = parent === root ? '' : parent;
  }
  if (!root || !isFile(path.join(root, 'Wuthering Waves.exe'))) root = '';
  const modsParent = modsPath ? path.dirname(modsPath) : '';
  const validWwmi = dir => !!dir && isFile(path.join(dir, 'd3dx.ini')) && isDir(path.join(dir, 'Core/WWMI'));
  const wwmi = [modsParent, importerPath].find(validWwmi) || importerPath || modsParent || '';
  const win64 = root ? path.join(root, 'Client/Binaries/Win64') : '';
  return { gameRoot: root, win64, wwmi, modsPath: modsPath || '', launcherPath: launcherPath || '' };
}
function buildWuwaDx12Args(paths, args = []) {
  const result = args.filter(arg => !/^-{1,2}(?:dx11|d3d11|dx12|d3d12|vulkan|force-d3d11|force-d3d12)$/i.test(arg));
  if (!result.some(arg => /^-krqlv(?:=|$)/i.test(arg))) result.push(`-krqlv=${['uhd', 'hd', 'sd'].find(tier => isDir(path.join(paths.gameRoot, 'Client/Content', tier.toUpperCase()))) || 'hd'}`);
  return [...result, '-dx12'];
}

function createWuwaDx12Service({ resolvePaths, getEnabled, saveEnabled, backupDir, launchProcess, components, packages,
  inspect = inspectReShade, stopped = assertStopped, waitForStart = waitForLaunchResult }) {
  let busy = false;
  async function status() {
    const paths = resolvePaths(), checks = [];
    const check = (id, title, ok, message) => checks.push({ id, title, ok: !!ok, message });
    check('game', '游戏目录', paths.gameRoot && isFile(path.join(paths.win64, 'Client-Win64-Shipping.exe')), paths.win64 || '请先设置有效的鸣潮游戏程序');
    check('wwmi', 'WWMI 与 Mods', paths.wwmi && isFile(path.join(paths.wwmi, 'd3dx.ini')) && isDir(path.join(paths.wwmi, 'Core/WWMI')) &&
      isDir(path.join(paths.wwmi, 'Mods')) && samePath(paths.modsPath, path.join(paths.wwmi, 'Mods')), paths.wwmi ? '需要 d3dx.ini、Core/WWMI，且与管理器选择的 Mods 目录一致' : '请先配置鸣潮的 WWMI 和 Mods 目录');
    if (paths.wwmi.length >= 248 || /[\r\n\0]/.test(paths.wwmi)) check('path', 'WWMI 路径', false, 'WWMI 路径需少于 248 个字符且不含换行');
    let reshade;
    try { reshade = paths.win64 ? await inspect(path.join(paths.win64, 'dxgi.dll')) : { ok: false, message: '请先设置游戏目录，再安装 ReShade 完整插件版' }; }
    catch (error) { reshade = { ok: false, message: error.message }; }
    check('reshade', 'ReShade', reshade.ok, reshade.message);
    let addonDir = paths.win64;
    try {
      const ini = paths.win64 ? decode(read(path.join(paths.win64, 'ReShade.ini'))).text : '';
      const configured = iniSetting(ini, 'ADDON', 'AddonPath');
      if (configured) addonDir = path.resolve(paths.win64, configured);
      if (/wwmi[-_]dx12/i.test(iniSetting(ini, 'ADDON', 'DisabledAddons'))) check('disabled', 'ReShade 插件状态', false, 'wwmi-dx12 已在 ReShade 中停用，请先在 ReShade 中启用');
    } catch (error) { check('reshade-config', 'ReShade 配置', false, error.message); }
    paths.addonDir = addonDir;
    check('addon', 'wwmi-dx12 插件', addonDir && peInfo(path.join(addonDir, 'wwmi_dx12.addon64')).valid,
      addonDir ? `将发布包中的 wwmi_dx12.addon64 放入 ${addonDir}` : '请安装 wwmi-dx12 发布包');
    const required = ['wwmi_dx12/IbVbHash.cso', 'wwmi_dx12/BufCopy.cso', 'wwmi_dx12/dxc/dxcompiler.dll', 'wwmi_dx12/dxc/dxil.dll'];
    const missing = required.filter(file => !paths.win64 || !isFile(path.join(paths.win64, file)));
    check('resources', 'DX12 运行资源', !missing.length, missing.length ? `缺少：${missing.join('、')}` : '着色器与 DXC 文件齐全');
    const sources = components ? { reshade: components.describe(paths, 'reshade'), addon: components.describe(paths, 'addon') } : {};
    for (const key of ['reshade', 'addon']) {
      if (sources[key]?.source === 'managed' && !sources[key].active) checks.find(item => item.id === key).message = 'QAQR 内置组件已停用，重新开启时自动恢复';
      else if (sources[key]?.source === 'missing' && paths.gameRoot) checks.find(item => item.id === key).message = '尚未安装，开启时由 QAQR 自动安装';
    }
    const updates = packages?.state(sources);
    return { success: true, enabled: getEnabled() === true, ready: checks.every(item => item.ok), checks, paths, sources, updates };
  }
  async function locked(action) {
    if (busy) throw Error('正在处理 DX12，请稍候');
    busy = true;
    try { return await action(); } finally { busy = false; }
  }
  async function setEnabled(enabled) {
    if (typeof enabled !== 'boolean') throw Error('DX12 开关值无效');
    return locked(async () => {
      const state = await status();
      if (enabled) {
        const blocked = state.checks.filter(item => !item.ok && (!components || !['reshade', 'addon', 'resources'].includes(item.id) ||
          (item.id === 'reshade' && state.sources.reshade.active) || (item.id === 'addon' && state.sources.addon.active)));
        if (blocked.length) throw Error(blocked.map(item => `${item.title}：${item.message}`).join('\n'));
      }
      let notes = [];
      if (components && state.paths.gameRoot) {
        const result = await components.toggle(state.paths, enabled, {
          beforeApply: () => stopped(state.paths),
          validate: async () => {
            if (!enabled) return;
            const checked = await status();
            if (!checked.ready) throw Error(checked.checks.filter(item => !item.ok).map(item => `${item.title}：${item.message}`).join('\n'));
          },
          commit: () => saveEnabled(enabled)
        });
        notes = result.notes;
      } else {
        if (enabled) await stopped(state.paths);
        await saveEnabled(enabled);
      }
      return { success: true, enabled, message: (enabled ? '已开启，下次「直接启动」使用 DX12。用户组件保持原样，缺少的组件由 QAQR 补齐。' : '已关闭，QAQR 内置组件已停用；用户组件保持原样。下次「直接启动」使用原有 WWMI。') + (notes.length ? ` ${notes.join('；')}` : '') };
    });
  }
  async function launch(args = []) {
    return locked(async () => {
      const state = await status();
      if (!state.enabled) throw Error('鸣潮 DX12 开关尚未开启');
      if (!state.ready) throw Error('DX12 环境未就绪，请到游戏设置 → DX12 Mod 查看：\n' + state.checks.filter(item => !item.ok).map(item => `${item.title}：${item.message}`).join('\n'));
      const paths = state.paths;
      await stopped(paths);
      const targets = [path.join(paths.win64, 'wwmi_dx12.ini'), path.join(paths.gameRoot, 'Client/Saved/Config/WindowsNoEditor/Engine.ini'), path.join(paths.gameRoot, 'Client/Config/UserEngine.ini')];
      const entries = targets.map(file => ({ file, before: read(file), mode: isFile(file) ? fs.statSync(file).mode : null }));
      const [addon, engine, user] = entries.map(item => decode(item.before));
      entries[0].after = setWwmiDirectory(addon.text, paths.wwmi);
      entries[1].after = engine.encode(editIni(engine.text, { SystemSettings: TEXTURES }));
      // Keep an existing distance preset, including the manager's 384 preset.
      entries[2].after = user.encode(iniValue(user.text, FOV) === null ? editIni(user.text, { ConsoleVariables: { [FOV]: 165 } }) : user.text);
      const backup = path.join(backupDir, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`);
      fs.mkdirSync(backup, { recursive: true });
      entries.forEach((entry, i) => { if (entry.before !== null) fs.writeFileSync(path.join(backup, `${i}.ini`), entry.before, { flag: 'wx' }); });
      fs.writeFileSync(path.join(backup, 'backup.json'), JSON.stringify(entries.map(({ file, before, mode }) => ({ file, existed: before !== null, mode })), null, 2));
      const request = path.join(backup, 'launch.json'), resultFile = path.join(backup, 'result.json');
      fs.writeFileSync(request, JSON.stringify({ gameRoot: paths.gameRoot, engine: targets[1], resultFile,
        arguments: buildWuwaDx12Args(paths, args).map(quoteWindowsArgument).join(' '), engineReadOnly: entries[1].mode !== null && !(entries[1].mode & 0o200) }));
      const written = [];
      let mayHaveStarted = false;
      try {
        for (const entry of entries) {
          if (entry.before?.equals(entry.after)) continue;
          fs.mkdirSync(path.dirname(entry.file), { recursive: true });
          written.push(entry);
          if (entry.mode !== null) fs.chmodSync(entry.file, entry.mode | 0o200);
          fs.writeFileSync(entry.file, entry.after);
          if (!fs.readFileSync(entry.file).equals(entry.after)) throw Error('DX12 配置写入校验失败');
          if (entry.mode !== null) fs.chmodSync(entry.file, entry.mode);
        }
        const result = await launchProcess(powershell(), __dirname, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'wuwa-dx12-launch.ps1'), '-RequestFile', request]);
        if (!result?.success) throw Error(result?.error || 'DX12 启动失败');
        mayHaveStarted = true;
        // The independent helper owns the temporary read-only flag even if QAQ exits.
        const started = await waitForStart(resultFile);
        if (!started) throw Error('DX12 启动辅助程序未返回结果，无法确认游戏已启动。请重试；若仍失败，请检查 PowerShell 是否被拦截');
        if (started?.success === false) {
          mayHaveStarted = started.started !== false;
          throw Error(`DX12 启动失败：${started.error}`);
        }
        return { success: true, notice: '已发送 DX12 游戏启动请求。', backup };
      } catch (error) {
        if (mayHaveStarted) throw Error(`${error.message}。配置备份：${backup}`);
        const failures = [];
        for (const entry of written.reverse()) {
          try {
            if (isFile(entry.file)) fs.chmodSync(entry.file, fs.statSync(entry.file).mode | 0o200);
            if (entry.before === null) { if (isFile(entry.file)) fs.unlinkSync(entry.file); }
            else { fs.writeFileSync(entry.file, entry.before); fs.chmodSync(entry.file, entry.mode); }
          } catch { failures.push(path.basename(entry.file)); }
        }
        throw Error(`${error.message}${failures.length ? `；恢复失败：${failures.join('、')}，备份位于 ${backup}` : '；已还原本次配置修改'}`);
      }
    });
  }
  async function checkUpdates() {
    return locked(async () => {
      const result = await packages.checkUpdates();
      return { ...await status(), message: Object.keys(result.errors).length ? '部分组件检查失败，请查看对应提示后重试。' : '已检查两个组件的官方发布版本。' };
    });
  }
  async function updateComponent(kind) {
    if (!['reshade', 'addon'].includes(kind)) throw Error('未知的 DX12 组件');
    return locked(async () => {
      const state = await status();
      const bundle = await packages.prepareUpdate(kind, state.sources[kind].version);
      const result = await components.update(state.paths, kind, bundle, {
        beforeApply: () => stopped(state.paths),
        validate: async () => {
          if (state.enabled && !(await status()).ready) throw Error('更新后的 DX12 环境检查未通过');
        },
        commit: () => packages.commitUpdate(bundle)
      });
      return { ...await status(), message: `${kind === 'reshade' ? 'ReShade' : 'wwmi-dx12'} 内置组件已更新至 ${bundle.version}。${result.cached ? state.sources[kind].source === 'user' ? '仅更新备用包，用户组件保持原样。' : '开启 DX12 时安装。' : state.sources[kind].active ? '原文件已备份，DX12 保持开启。' : '原文件已备份，组件仍保持停用。'}` };
    });
  }
  return { status, setEnabled, launch, checkUpdates, updateComponent };
}
async function waitForLaunchResult(file) {
  for (let i = 0; i < 50; i++) {
    try {
      const result = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\ufeff/, ''));
      if (typeof result?.success === 'boolean') return result;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  return null;
}
module.exports = { createWuwaDx12Service, resolveWuwaDx12Paths, buildWuwaDx12Args, inspectReShade };
