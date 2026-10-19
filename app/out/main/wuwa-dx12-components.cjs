const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { readJsonFileSync, writeJsonFileSync } = require('./json-store.cjs');
const { samePath, peInfo } = require('./genshin-diagnostics.cjs');

const PACKAGES = {
  reshade: { version: '6.8.0', file: 'ReShade_Setup_6.8.0_Addon.exe',
    url: 'https://reshade.me/downloads/ReShade_Setup_6.8.0_Addon.exe', sha256: 'afe4c8f13048306307983b8b3d41d5bf00a86820440b0e57dea10950e1176445' },
  addon: { version: '2026.10.3', file: 'wwmi-dx12-2026.10.3.zip',
    url: 'https://github.com/lekarsenten/wwmi-dx12/releases/download/v2026.10.3/wwmi-dx12-2026.10.3.zip', sha256: '636e0111095b8fa27e509eb557de4333c124605dac18e53ca846f93d80cd4df7' }
};
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const exists = file => fs.existsSync(file);
const newer = (a, b) => {
  const left = a.split('.').map(Number), right = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return left[i] > right[i];
  return false;
};
function validatePackageInfo(kind, info) {
  if (!info || !/^\d+\.\d+\.\d+$/.test(info.version) || !info.file || path.basename(info.file) !== info.file) throw Error('组件版本信息无效');
  const url = new URL(info.url);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw Error('组件下载地址无效');
  if (kind === 'reshade') {
    if (url.host !== 'reshade.me' || url.pathname !== `/downloads/ReShade_Setup_${info.version}_Addon.exe` || info.file !== `ReShade_Setup_${info.version}_Addon.exe`) throw Error('ReShade 下载地址不是官方完整插件版');
  } else if (kind === 'addon') {
    if (url.host !== 'github.com' || url.pathname !== `/lekarsenten/wwmi-dx12/releases/download/v${info.version}/wwmi-dx12-${info.version}.zip` || info.file !== `wwmi-dx12-${info.version}.zip` || !/^[a-f0-9]{64}$/.test(info.sha256)) throw Error('wwmi-dx12 发布地址或校验值无效');
  } else throw Error('未知的 DX12 组件');
  if (info.sha256 != null && !/^[a-f0-9]{64}$/.test(info.sha256)) throw Error('组件校验值无效');
  return { version: info.version, file: info.file, url: url.href, sha256: info.sha256 || null };
}
function releasePackage(kind, data) {
  if (kind === 'reshade') {
    const matches = [...String(data).matchAll(/(?:https:\/\/reshade\.me)?\/downloads\/ReShade_Setup_(\d+\.\d+\.\d+)_Addon\.exe/g)];
    const version = matches.map(match => match[1]).sort((a, b) => newer(a, b) ? -1 : newer(b, a) ? 1 : 0)[0];
    if (!version) throw Error('ReShade 官网暂未提供可识别的完整插件版下载');
    const file = `ReShade_Setup_${version}_Addon.exe`;
    return validatePackageInfo(kind, { version, file, url: `https://reshade.me/downloads/${file}` });
  }
  if (!data || data.draft || data.prerelease || !/^v\d+\.\d+\.\d+$/.test(data.tag_name)) throw Error('wwmi-dx12 正式发布信息无效');
  const version = data.tag_name.slice(1), file = `wwmi-dx12-${version}.zip`;
  const asset = data.assets?.find(item => item.name === file);
  return validatePackageInfo(kind, { version, file, url: asset?.browser_download_url, sha256: asset?.digest?.replace(/^sha256:/, '') });
}
async function githubReleasePage(fetchImpl) {
  async function text(url) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetchImpl(url, { signal: controller.signal, headers: { Accept: 'text/html' } });
      if (!response.ok) throw Error(`GitHub 官方发布页读取失败（HTTP ${response.status}）`);
      return await response.text();
    } finally { clearTimeout(timer); }
  }
  const latest = await text('https://github.com/lekarsenten/wwmi-dx12/releases/latest');
  const version = /https:\/\/github\.com\/lekarsenten\/wwmi-dx12\/releases\/expanded_assets\/v(\d+\.\d+\.\d+)["']/.exec(latest)?.[1];
  if (!version) throw Error('GitHub 官方发布页中未找到有效版本');
  const assets = await text(`https://github.com/lekarsenten/wwmi-dx12/releases/expanded_assets/v${version}`);
  const file = `wwmi-dx12-${version}.zip`, relative = `/lekarsenten/wwmi-dx12/releases/download/v${version}/${file}`;
  const row = [...assets.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map(match => match[1]).find(html => html.includes(`href="${relative}"`) || html.includes(`href='${relative}'`));
  const digest = /sha256:([a-f0-9]{64})/i.exec(row || '')?.[1].toLowerCase();
  return validatePackageInfo('addon', { version, file, url: 'https://github.com' + relative, sha256: digest });
}
function fileHash(file) { return exists(file) && fs.statSync(file).isFile() ? hash(fs.readFileSync(file)) : null; }
function writablePath(file) {
  for (let cursor = path.resolve(file); path.dirname(cursor) !== cursor; cursor = path.dirname(cursor)) {
    if (exists(cursor) && fs.lstatSync(cursor).isSymbolicLink()) throw Error('组件安装目标包含链接，请使用真实游戏或插件目录');
  }
}
function extractPackage(kind, bytes) {
  const Zip = require('adm-zip');
  if (kind === 'reshade') {
    // The official setup stores a ZIP at a 512-byte boundary. Read it as data;
    // never execute the installer or its unrelated registry/shader operations.
    let start = -1;
    for (let i = 0; i + 30 <= bytes.length; i += 512) {
      if (bytes.readUInt32LE(i) === 0x04034b50 && bytes.subarray(i + 4, i + 30).some(value => value !== 0)) { start = i; break; }
    }
    if (start < 0) throw Error('ReShade 安装包中没有可识别的运行库');
    const dll = new Zip(bytes.subarray(start)).getEntry('ReShade64.dll');
    if (!dll || dll.header.size > 128 * 1024 * 1024) throw Error('ReShade 安装包缺少 x64 运行库');
    return new Map([['dxgi.dll', dll.getData()], ['wwmi_dx12/licenses/ReShade-LICENSE.md', fs.readFileSync(path.join(__dirname, 'licenses/ReShade-LICENSE.txt'))]]);
  }
  const entries = new Map();
  let total = 0;
  for (const entry of new Zip(bytes).getEntries()) {
    if (entry.isDirectory) continue;
    const name = entry.entryName.replace(/\\/g, '/');
    if (name !== 'wwmi_dx12.addon64' && !name.startsWith('wwmi_dx12/')) continue;
    if (name.split('/').some(part => !part || part === '..' || part === '.' || /[:\0]/.test(part)) || ++total > 256 || entry.header.size > 128 * 1024 * 1024) throw Error('DX12 安装包结构无效');
    entries.set(name, entry.getData());
  }
  for (const name of ['wwmi_dx12.addon64', 'wwmi_dx12/IbVbHash.cso', 'wwmi_dx12/BufCopy.cso', 'wwmi_dx12/dxc/dxcompiler.dll', 'wwmi_dx12/dxc/dxil.dll', 'wwmi_dx12/LICENSE']) {
    if (!entries.has(name)) throw Error(`DX12 安装包缺少 ${name}`);
  }
  return entries;
}
function createWuwaDx12Packages({ bundledDir, cacheDir, fetch: fetchImpl }) {
  const loaded = new Map();
  const catalogFile = path.join(cacheDir, 'versions.json');
  let catalog = { selected: {}, available: {}, errors: {}, checkedAt: null };
  try {
    const saved = readJsonFileSync(catalogFile);
    for (const kind of Object.keys(PACKAGES)) {
      if (saved.selected?.[kind]) catalog.selected[kind] = validatePackageInfo(kind, saved.selected[kind]);
      if (saved.available?.[kind]) catalog.available[kind] = validatePackageInfo(kind, saved.available[kind]);
    }
    catalog.checkedAt = saved.checkedAt || null;
  } catch (error) { if (error.code !== 'ENOENT') catalog.errors.storage = '组件版本记录无法读取，使用随附版本；请重新检查更新'; }
  const selected = kind => catalog.selected[kind] || PACKAGES[kind];
  async function getPackage(kind, candidate) {
    const info = validatePackageInfo(kind, candidate || selected(kind));
    const key = `${kind}:${info.version}:${info.sha256}`;
    if (loaded.has(key)) return loaded.get(key);
    let bytes;
    for (const dir of [bundledDir, cacheDir]) {
      const file = path.join(dir, info.file);
      if (info.sha256 && exists(file)) { const candidate = fs.readFileSync(file); if (hash(candidate) === info.sha256) { bytes = candidate; break; } }
    }
    if (!bytes) {
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 90000);
      try {
        const response = await fetchImpl(info.url, { signal: controller.signal });
        if (!response.ok) throw Error(`组件下载失败（HTTP ${response.status}）`);
        const chunks = []; let size = 0;
        for await (const chunk of response.body) {
          size += chunk.length;
          if (size > 128 * 1024 * 1024) throw Error('组件下载超出大小限制');
          chunks.push(Buffer.from(chunk));
        }
        bytes = Buffer.concat(chunks);
        if (info.sha256 && hash(bytes) !== info.sha256) throw Error('组件下载校验失败，未安装');
        fs.mkdirSync(cacheDir, { recursive: true });
        fs.writeFileSync(path.join(cacheDir, info.file), bytes);
      } finally { clearTimeout(timer); }
    }
    const extracted = extractPackage(kind, bytes);
    const verifyDir = path.join(cacheDir, 'verify', kind, info.version);
    fs.mkdirSync(verifyDir, { recursive: true });
    for (const [name, data] of extracted) {
      if (!/\.(dll|addon64)$/i.test(name)) continue;
      const file = path.join(verifyDir, path.basename(name));
      fs.writeFileSync(file, data);
      if (!peInfo(file).valid) throw Error('下载组件中的 x64 运行库校验失败，未安装');
    }
    if (kind === 'reshade') {
      const dll = path.join(verifyDir, 'dxgi.dll');
      const verified = await require('./wuwa-dx12.cjs').inspectReShade(dll);
      if (!verified.ok || verified.version !== info.version) throw Error('ReShade 运行库版本或完整插件支持校验失败');
    }
    extracted.version = info.version;
    extracted.info = { ...info, sha256: hash(bytes) };
    loaded.set(key, extracted);
    return extracted;
  }
  getPackage.info = selected;
  getPackage.state = (sources = {}) => ({ checkedAt: catalog.checkedAt, errors: { ...catalog.errors },
    components: Object.fromEntries(Object.keys(PACKAGES).map(kind => {
      const currentVersion = sources[kind]?.source === 'managed' ? sources[kind].version : selected(kind).version;
      const candidate = catalog.available[kind] && newer(catalog.available[kind].version, selected(kind).version) ? catalog.available[kind] : selected(kind);
      return [kind, { currentVersion, bundledVersion: selected(kind).version, availableVersion: catalog.available[kind]?.version || null,
        updateAvailable: newer(candidate.version, currentVersion) }];
    })) });
  getPackage.checkUpdates = async () => {
    const results = await Promise.allSettled(Object.keys(PACKAGES).map(async kind => {
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 20000);
      try {
        const response = await fetchImpl(kind === 'reshade' ? 'https://reshade.me/' : 'https://api.github.com/repos/lekarsenten/wwmi-dx12/releases/latest', { signal: controller.signal, headers: { Accept: kind === 'reshade' ? 'text/html' : 'application/vnd.github+json' } });
        if (!response.ok) throw Error(`官方更新检查失败（HTTP ${response.status}）`);
        return releasePackage(kind, kind === 'reshade' ? await response.text() : await response.json());
      } catch (error) {
        if (kind !== 'addon') throw error;
        clearTimeout(timer);
        return await githubReleasePage(fetchImpl);
      } finally { clearTimeout(timer); }
    }));
    const next = structuredClone(catalog); next.errors = {}; next.checkedAt = new Date().toISOString();
    Object.keys(PACKAGES).forEach((kind, index) => {
      if (results[index].status === 'fulfilled') next.available[kind] = results[index].value;
      else { next.errors[kind] = results[index].reason?.message || '检查失败'; delete next.available[kind]; }
    });
    writeJsonFileSync(catalogFile, next); catalog = next;
    return getPackage.state();
  };
  getPackage.prepareUpdate = async (kind, currentVersion = selected(kind)?.version) => {
    if (!Object.hasOwn(PACKAGES, kind)) throw Error('未知的 DX12 组件');
    const available = catalog.available[kind];
    const info = available && newer(available.version, selected(kind).version) ? available : selected(kind);
    if (!newer(info.version, currentVersion)) throw Error('QAQR 内置组件已经是当前检查到的版本');
    return getPackage(kind, info);
  };
  getPackage.commitUpdate = bundle => {
    const kind = bundle.info.file.startsWith('ReShade_') ? 'reshade' : 'addon';
    const next = structuredClone(catalog); next.selected[kind] = validatePackageInfo(kind, bundle.info);
    writeJsonFileSync(catalogFile, next); catalog = next;
  };
  return getPackage;
}

function createWuwaDx12Components({ stateDir, getPackage }) {
  function recordFor(paths) {
    const key = hash(Buffer.from(path.resolve(paths.gameRoot).toLowerCase()));
    const file = path.join(stateDir, key, 'ownership.json');
    let record;
    try { record = readJsonFileSync(file); }
    catch (error) { if (error.code !== 'ENOENT') throw Error('DX12 组件来源记录损坏，已保留现有文件'); }
    if (record && (!samePath(record.gameRoot, paths.gameRoot) || !Array.isArray(record.entries) || !record.entries.every(item =>
      typeof item.file === 'string' && path.isAbsolute(item.file) && /^[a-f0-9]{64}$/.test(item.sha256) && ['reshade', 'addon'].includes(item.role) &&
      (!item.activation || ['dxgi.dll', 'wwmi_dx12.addon64'].includes(path.basename(item.file).toLowerCase()))))) throw Error('DX12 组件来源记录不匹配');
    return { file, record: record || { gameRoot: paths.gameRoot, entries: [] } };
  }
  function describe(paths, role) {
    const target = paths.win64 ? path.join(role === 'reshade' ? paths.win64 : paths.addonDir || paths.win64, role === 'reshade' ? 'dxgi.dll' : 'wwmi_dx12.addon64') : '';
    const version = getPackage.info?.(role)?.version || PACKAGES[role].version;
    if (!paths.gameRoot) return { source: 'missing', active: false, path: target, version };
    const { record } = recordFor(paths), entry = record.entries.find(item => samePath(item.file, target));
    const active = !!target && exists(target);
    const owned = entry && (active ? fileHash(target) === entry.sha256 : fileHash(target + '.qaqr-disabled') === entry.sha256);
    return { source: owned ? 'managed' : active ? 'user' : 'missing', active, path: target, version: owned ? entry.version : version };
  }
  async function toggle(paths, enabled, { beforeApply = async () => {}, validate = async () => {}, commit = async () => {} } = {}) {
    if (!paths.gameRoot || !paths.win64) throw Error('请先设置有效的鸣潮游戏程序');
    const { file: recordFile, record } = recordFor(paths);
    const previous = structuredClone(record), operations = [], notes = [];
    const activeTargets = [path.join(paths.win64, 'dxgi.dll'), path.join(paths.addonDir || paths.win64, 'wwmi_dx12.addon64')];
    const add = (file, bytes, role, activation, version) => {
      if (exists(file) || operations.some(item => samePath(item.file, file))) return; // Existing files and shared license entries win.
      const entry = record.entries.find(item => samePath(item.file, file));
      const disabled = file + '.qaqr-disabled';
      if (entry && fileHash(disabled) === entry.sha256) operations.push({ kind: 'restore', file, disabled, sha256: entry.sha256 });
      else {
        if (activation && exists(disabled)) throw Error(`${path.basename(disabled)} 来源未知，已保留；请先检查该文件`);
        const next = { file, sha256: hash(bytes), role, activation, version: version || PACKAGES[role].version };
        record.entries = record.entries.filter(item => !samePath(item.file, file));
        record.entries.push(next);
        operations.push({ kind: 'create', file, bytes, sha256: next.sha256 });
      }
    };
    if (enabled) {
      if (!exists(activeTargets[0])) {
        const bundle = await getPackage('reshade');
        for (const [name, bytes] of bundle) add(path.join(paths.win64, name), bytes, 'reshade', name === 'dxgi.dll', bundle.version);
      }
      const bundleNeeded = !exists(activeTargets[1]) || ['IbVbHash.cso', 'BufCopy.cso', 'dxc/dxcompiler.dll', 'dxc/dxil.dll'].some(name => !exists(path.join(paths.win64, 'wwmi_dx12', name)));
      if (bundleNeeded) {
        const bundle = await getPackage('addon');
        for (const [name, bytes] of bundle) add(name === 'wwmi_dx12.addon64' ? activeTargets[1] : path.join(paths.win64, name), bytes, 'addon', name === 'wwmi_dx12.addon64', bundle.version);
      }
    }
    for (const entry of record.entries.filter(item => item.activation)) {
      if (enabled && activeTargets.some(target => samePath(target, entry.file))) continue;
      if (!exists(entry.file)) continue;
      if (fileHash(entry.file) !== entry.sha256) { notes.push(`${path.basename(entry.file)} 已由用户替换，按用户组件保留`); continue; }
      const disabled = entry.file + '.qaqr-disabled';
      if (exists(disabled)) throw Error(`${path.basename(disabled)} 已存在，未覆盖；请先检查该文件`);
      operations.push({ kind: 'disable', file: entry.file, disabled, sha256: entry.sha256 });
    }
    for (const operation of operations) { writablePath(operation.file); if (operation.disabled) writablePath(operation.disabled); }
    await beforeApply();
    fs.mkdirSync(path.dirname(recordFile), { recursive: true });
    const backupFile = path.join(path.dirname(recordFile), `ownership-before-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.json`);
    writeJsonFileSync(backupFile, previous);
    // Persist provenance before installing. An interrupted install can still identify
    // its own files without ever claiming a pre-existing user component.
    writeJsonFileSync(recordFile, record);
    const applied = [];
    try {
      for (const operation of operations) {
        const { file, disabled, kind } = operation;
        fs.mkdirSync(path.dirname(file), { recursive: true });
        if (kind === 'create') {
          const fd = fs.openSync(file, 'wx');
          applied.push(operation);
          try { fs.writeFileSync(fd, operation.bytes); } finally { fs.closeSync(fd); }
        } else {
          const from = kind === 'restore' ? disabled : file, to = kind === 'restore' ? file : disabled;
          if (exists(to) || fileHash(from) !== operation.sha256) throw Error('组件文件在切换期间发生变化，请重新读取');
          fs.renameSync(from, to);
          applied.push(operation);
        }
        if (fileHash(kind === 'disable' ? disabled : file) !== operation.sha256) throw Error('DX12 组件写入校验失败');
      }
      await validate();
      await commit();
      return { notes };
    } catch (error) {
      const failures = [];
      for (const operation of applied.reverse()) {
        try {
          if (operation.kind === 'create') {
            if (fileHash(operation.file) !== operation.sha256) throw Error('新文件已被修改，保留文件');
            fs.unlinkSync(operation.file);
          }
          else {
            const from = operation.kind === 'restore' ? operation.file : operation.disabled;
            const to = operation.kind === 'restore' ? operation.disabled : operation.file;
            if (exists(to) || fileHash(from) !== operation.sha256) throw Error('组件发生变化');
            fs.renameSync(from, to);
          }
        } catch { failures.push(path.basename(operation.file)); }
      }
      if (!failures.length) writeJsonFileSync(recordFile, previous);
      throw Error(`${error.message}${failures.length ? `；部分文件待恢复：${failures.join('、')}` : '；本次组件切换已还原'}`);
    }
  }
  async function update(paths, kind, bundle, { beforeApply = async () => {}, validate = async () => {}, commit = async () => {} } = {}) {
    if (!Object.hasOwn(PACKAGES, kind) || !/^\d+\.\d+\.\d+$/.test(bundle.version || '')) throw Error('组件更新信息无效');
    const source = describe(paths, kind);
    if (source.source !== 'managed') { await commit(); return { cached: true }; }
    const { file: recordFile, record } = recordFor(paths), previous = structuredClone(record), operations = [];
    for (const [name, bytes] of bundle) {
      const activation = name === 'dxgi.dll' || name === 'wwmi_dx12.addon64';
      const logical = name === 'wwmi_dx12.addon64' ? path.join(paths.addonDir || paths.win64, name) : path.join(paths.win64, name);
      const entry = record.entries.find(item => samePath(item.file, logical));
      const target = activation && !source.active ? logical + '.qaqr-disabled' : logical;
      const beforeHash = fileHash(target);
      if ((beforeHash && (!entry || entry.role !== kind || beforeHash !== entry.sha256)) || (entry && entry.role !== kind)) {
        if (activation) throw Error('组件已由用户替换，未覆盖');
        continue; // Retain all user-provided or user-modified resources.
      }
      writablePath(target);
      const next = { file: logical, sha256: hash(bytes), role: kind, activation, version: bundle.version };
      record.entries = record.entries.filter(item => !samePath(item.file, logical)); record.entries.push(next);
      if (beforeHash !== next.sha256) operations.push({ file: target, before: beforeHash ? fs.readFileSync(target) : null,
        beforeHash, mode: beforeHash ? fs.statSync(target).mode : null, bytes, sha256: next.sha256 });
    }
    await beforeApply();
    const backup = path.join(path.dirname(recordFile), `before-update-${kind}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`);
    fs.mkdirSync(backup, { recursive: true });
    writeJsonFileSync(path.join(backup, 'ownership.json'), previous);
    writeJsonFileSync(path.join(backup, 'files.json'), operations.map(({ file, beforeHash }) => ({ file, beforeHash })));
    operations.forEach((entry, i) => { if (entry.before) fs.writeFileSync(path.join(backup, `${i}.bin`), entry.before, { flag: 'wx' }); });
    writeJsonFileSync(recordFile, record);
    const applied = [];
    try {
      for (const operation of operations) {
        if (fileHash(operation.file) !== operation.beforeHash) throw Error('组件在更新期间发生变化，请重新检测');
        fs.mkdirSync(path.dirname(operation.file), { recursive: true });
        if (operation.mode !== null) fs.chmodSync(operation.file, operation.mode | 0o200);
        const fd = fs.openSync(operation.file, operation.before ? 'w' : 'wx');
        applied.push(operation);
        try { fs.writeFileSync(fd, operation.bytes); } finally { fs.closeSync(fd); }
        if (operation.mode !== null) fs.chmodSync(operation.file, operation.mode);
        if (fileHash(operation.file) !== operation.sha256) throw Error('更新文件校验失败');
        operation.complete = true;
      }
      await validate(); await commit();
      return { cached: false, backup };
    } catch (error) {
      const failures = [];
      for (const operation of applied.reverse()) {
        try {
          if (operation.complete && fileHash(operation.file) !== operation.sha256) throw Error('文件已被其他程序修改');
          if (exists(operation.file)) fs.chmodSync(operation.file, fs.statSync(operation.file).mode | 0o200);
          if (operation.before === null) fs.unlinkSync(operation.file);
          else { fs.writeFileSync(operation.file, operation.before); fs.chmodSync(operation.file, operation.mode); }
        } catch { failures.push(path.basename(operation.file)); }
      }
      if (!failures.length) writeJsonFileSync(recordFile, previous);
      throw Error(`${error.message}；${failures.length ? `待恢复：${failures.join('、')}` : '已还原更新前的组件'}。备份：${backup}`);
    }
  }
  return { describe, toggle, update };
}
module.exports = { PACKAGES, createWuwaDx12Packages, createWuwaDx12Components, extractPackage, releasePackage };
