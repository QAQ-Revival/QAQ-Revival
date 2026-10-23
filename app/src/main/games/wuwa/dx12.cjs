const i18n = require("../../../shared/i18n/core.cjs");
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const childProcess = require('node:child_process');
const {
  peInfo,
  samePath
} = require("../genshin/diagnostics.cjs");
const {
  editIni,
  iniValue
} = require("./tuning.cjs");
const {
  quoteWindowsArgument
} = require("../../system/launch.cjs");
const FOV = 'r.Kuro.SkeletalMesh.DistanceLODBaseFOV';
// Upstream launch requirements: https://github.com/lekarsenten/wwmi-dx12
const TEXTURES = {
  'r.TextureStreaming': 1,
  'r.Streaming.FullyLoadUsedTextures': 1,
  'r.Streaming.Boost': 30,
  'r.Streaming.MinBoost': 30,
  'r.Streaming.HLODStrategy': 2,
  'r.MipMapLODBias': -1
};
const powershell = () => path.join(process.env.SystemRoot || 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
const literal = value => "'" + String(value).replace(/'/g, "''") + "'";
const isFile = file => {
  try {
    return !!file && fs.statSync(file).isFile();
  } catch {
    return false;
  }
};
const isDir = file => {
  try {
    return !!file && fs.statSync(file).isDirectory();
  } catch {
    return false;
  }
};
function read(file) {
  try {
    if (fs.statSync(file).size > 2 * 1024 * 1024) throw Error(i18n.t("backend.wuwaDx12.configTooLarge"));
    return fs.readFileSync(file);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}
function decode(bytes) {
  if (!bytes) return {
    text: '',
    encode: value => Buffer.from(value)
  };
  const wide = bytes[0] === 255 && bytes[1] === 254;
  const bom = wide ? bytes.subarray(0, 2) : bytes.subarray(0, 3).equals(Buffer.from([239, 187, 191])) ? bytes.subarray(0, 3) : Buffer.alloc(0);
  const encoding = wide ? 'utf16le' : 'utf8',
    text = bytes.subarray(bom.length).toString(encoding);
  if (text.includes('\ufffd') || text.includes('\0')) throw Error(i18n.t("backend.wuwaDx12.unknownConfigEncoding"));
  return {
    text,
    encode: value => Buffer.concat([bom, Buffer.from(value, encoding)])
  };
}
function iniSetting(text, section, key) {
  let current = '',
    result = '';
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
  if (index >= 0) lines.splice(index + 1, 0, `wwmi_dir = ${directory}`);else lines.push('', '[wwmi-dx12]', `wwmi_dir = ${directory}`, '');
  // GetPrivateProfileStringW needs a Unicode INI for non-ASCII installation paths.
  return Buffer.from('\ufeff' + lines.join(newline), 'utf16le');
}
function runPowerShell(script) {
  return new Promise((resolve, reject) => childProcess.execFile(powershell(), ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], {
    windowsHide: true,
    timeout: 8000,
    maxBuffer: 1024 * 1024
  }, (error, stdout) => error ? reject(Error(i18n.t("backend.wuwaDx12.systemStateUnavailable"))) : resolve(String(stdout).trim())));
}
async function inspectReShade(file) {
  if (!peInfo(file).valid) return {
    ok: false,
    message: i18n.t("backend.wuwaDx12.reShadeX64Required")
  };
  const info = JSON.parse(await runPowerShell(`$ErrorActionPreference='Stop'; $v=[Diagnostics.FileVersionInfo]::GetVersionInfo(${literal(file)}); @{name=$v.ProductName; major=$v.FileMajorPart; minor=$v.FileMinorPart; build=$v.FileBuildPart} | ConvertTo-Json -Compress`));
  if (!/ReShade/i.test(info.name || '')) return {
    ok: false,
    message: i18n.t("backend.wuwaDx12.conflictingDxgiLibrary")
  };
  const version = `${info.major}.${info.minor}.${info.build}`;
  if (info.major < 6 || info.major === 6 && info.minor < 8) return {
    ok: false,
    message: i18n.t("backend.wuwaDx12.reShadeOutdated", {
      version
    })
  };
  if (fs.statSync(file).size > 128 * 1024 * 1024) return {
    ok: false,
    message: i18n.t("backend.wuwaDx12.reShadeFileInvalid")
  };
  const bytes = fs.readFileSync(file);
  // Official standard builds contain this diagnostic and refuse external add-ons.
  const limited = bytes.includes(Buffer.from('only limited add-on functionality'));
  const exportsAddon = bytes.includes(Buffer.from('ReShadeRegisterAddon\0'));
  return {
    ok: exportsAddon && !limited,
    version,
    message: exportsAddon && !limited ? i18n.t("backend.wuwaDx12.reShadeFullSupport", {
      version
    }) : i18n.t("backend.wuwaDx12.reShadeFullSupportRequired")
  };
}
async function assertStopped(paths) {
  const launcherBin = paths.launcherPath ? path.dirname(paths.launcherPath) : '';
  const result = await runPowerShell(`$ErrorActionPreference='Stop'; $bin=${literal(launcherBin)}; @(Get-Process | Where-Object { $_.ProcessName -in @('Client-Win64-Shipping','Wuthering Waves') -or ($bin -and $_.Path -and [IO.Path]::GetDirectoryName($_.Path) -eq $bin) }).Count`);
  if (result !== '0') throw Error(i18n.t("backend.wuwaDx12.closeGameBeforeDx12"));
}
function resolveWuwaDx12Paths({
  gamePath,
  gameFolder,
  importerPath,
  modsPath,
  launcherPath
}) {
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
  return {
    gameRoot: root,
    win64,
    wwmi,
    modsPath: modsPath || '',
    launcherPath: launcherPath || ''
  };
}
function buildWuwaDx12Args(paths, args = []) {
  const result = args.filter(arg => !/^-{1,2}(?:dx11|d3d11|dx12|d3d12|vulkan|force-d3d11|force-d3d12)$/i.test(arg));
  if (!result.some(arg => /^-krqlv(?:=|$)/i.test(arg))) result.push(`-krqlv=${['uhd', 'hd', 'sd'].find(tier => isDir(path.join(paths.gameRoot, 'Client/Content', tier.toUpperCase()))) || 'hd'}`);
  return [...result, '-dx12'];
}
function createWuwaDx12Service({
  resolvePaths,
  getEnabled,
  saveEnabled,
  backupDir,
  launchProcess,
  components,
  packages,
  inspect = inspectReShade,
  stopped = assertStopped,
  waitForStart = waitForLaunchResult
}) {
  let busy = false;
  async function status() {
    const paths = resolvePaths(),
      checks = [];
    const check = (id, title, ok, message) => checks.push({
      id,
      title,
      ok: !!ok,
      message
    });
    check('game', i18n.t("backend.wuwaDx12.gameDirectoryTitle"), paths.gameRoot && isFile(path.join(paths.win64, 'Client-Win64-Shipping.exe')), paths.win64 || i18n.t("backend.wuwaDx12Components.gameExecutableRequired"));
    check('wwmi', i18n.t("backend.wuwaDx12.modsDirectoryTitle"), paths.wwmi && isFile(path.join(paths.wwmi, 'd3dx.ini')) && isDir(path.join(paths.wwmi, 'Core/WWMI')) && isDir(path.join(paths.wwmi, 'Mods')) && samePath(paths.modsPath, path.join(paths.wwmi, 'Mods')), paths.wwmi ? i18n.t("backend.wuwaDx12.modsStructureRequired") : i18n.t("backend.wuwaDx12.modsConfigurationRequired"));
    if (paths.wwmi.length >= 248 || /[\r\n\0]/.test(paths.wwmi)) check('path', i18n.t("backend.wuwaDx12.wwmiPathTitle"), false, i18n.t("backend.wuwaDx12.wwmiPathTooLong"));
    let reshade;
    try {
      reshade = paths.win64 ? await inspect(path.join(paths.win64, 'dxgi.dll')) : {
        ok: false,
        message: i18n.t("backend.wuwaDx12.gameDirectoryRequired")
      };
    } catch (error) {
      reshade = {
        ok: false,
        message: error.message
      };
    }
    check('reshade', 'ReShade', reshade.ok, reshade.message);
    let addonDir = paths.win64;
    try {
      const ini = paths.win64 ? decode(read(path.join(paths.win64, 'ReShade.ini'))).text : '';
      const configured = iniSetting(ini, 'ADDON', 'AddonPath');
      if (configured) addonDir = path.resolve(paths.win64, configured);
      if (/wwmi[-_]dx12/i.test(iniSetting(ini, 'ADDON', 'DisabledAddons'))) check('disabled', i18n.t("backend.wuwaDx12.addonStatusTitle"), false, i18n.t("backend.wuwaDx12.addonDisabled"));
    } catch (error) {
      check('reshade-config', i18n.t("backend.wuwaDx12.reShadeConfigTitle"), false, error.message);
    }
    paths.addonDir = addonDir;
    check('addon', i18n.t("backend.wuwaDx12.addonTitle"), addonDir && peInfo(path.join(addonDir, 'wwmi_dx12.addon64')).valid, addonDir ? i18n.t("backend.wuwaDx12.addonInstallPath", {
      addonDir
    }) : i18n.t("backend.wuwaDx12.addonPackageRequired"));
    const required = ['wwmi_dx12/IbVbHash.cso', 'wwmi_dx12/BufCopy.cso', 'wwmi_dx12/dxc/dxcompiler.dll', 'wwmi_dx12/dxc/dxil.dll'];
    const missing = required.filter(file => !paths.win64 || !isFile(path.join(paths.win64, file)));
    check('resources', i18n.t("backend.wuwaDx12.runtimeResourcesTitle"), !missing.length, missing.length ? i18n.t("backend.wuwaDx12.missingResources", {
      path: missing.join('、')
    }) : i18n.t("backend.wuwaDx12.runtimeResourcesComplete"));
    const sources = components ? {
      reshade: components.describe(paths, 'reshade'),
      addon: components.describe(paths, 'addon')
    } : {};
    for (const key of ['reshade', 'addon']) {
      if (sources[key]?.source === 'managed' && !sources[key].active) checks.find(item => item.id === key).message = i18n.t("backend.wuwaDx12.bundledComponentDisabled");else if (sources[key]?.source === 'missing' && paths.gameRoot) checks.find(item => item.id === key).message = i18n.t("backend.wuwaDx12.bundledComponentMissing");
    }
    const updates = packages?.state(sources);
    return {
      success: true,
      enabled: getEnabled() === true,
      ready: checks.every(item => item.ok),
      checks,
      paths,
      sources,
      updates
    };
  }
  async function locked(action) {
    if (busy) throw Error(i18n.t("backend.wuwaDx12.operationInProgress"));
    busy = true;
    try {
      return await action();
    } finally {
      busy = false;
    }
  }
  async function setEnabled(enabled) {
    if (typeof enabled !== 'boolean') throw Error(i18n.t("backend.wuwaDx12.invalidEnabledValue"));
    return locked(async () => {
      const state = await status();
      if (enabled) {
        const blocked = state.checks.filter(item => !item.ok && (!components || !['reshade', 'addon', 'resources'].includes(item.id) || item.id === 'reshade' && state.sources.reshade.active || item.id === 'addon' && state.sources.addon.active));
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
      return {
        success: true,
        enabled,
        message: (enabled ? i18n.t("backend.wuwaDx12.enabledNotice") : i18n.t("backend.wuwaDx12.disabledNotice")) + (notes.length ? ` ${notes.join('；')}` : '')
      };
    });
  }
  async function launch(args = []) {
    return locked(async () => {
      const state = await status();
      if (!state.enabled) throw Error(i18n.t("backend.wuwaDx12.dx12Disabled"));
      if (!state.ready) throw Error(i18n.t("backend.wuwaDx12.environmentNotReadyPrefix") + state.checks.filter(item => !item.ok).map(item => `${item.title}：${item.message}`).join('\n'));
      const paths = state.paths;
      await stopped(paths);
      const targets = [path.join(paths.win64, 'wwmi_dx12.ini'), path.join(paths.gameRoot, 'Client/Saved/Config/WindowsNoEditor/Engine.ini'), path.join(paths.gameRoot, 'Client/Config/UserEngine.ini')];
      const entries = targets.map(file => ({
        file,
        before: read(file),
        mode: isFile(file) ? fs.statSync(file).mode : null
      }));
      const [addon, engine, user] = entries.map(item => decode(item.before));
      entries[0].after = setWwmiDirectory(addon.text, paths.wwmi);
      entries[1].after = engine.encode(editIni(engine.text, {
        SystemSettings: TEXTURES
      }));
      // Keep an existing distance preset, including the manager's 384 preset.
      entries[2].after = user.encode(iniValue(user.text, FOV) === null ? editIni(user.text, {
        ConsoleVariables: {
          [FOV]: 165
        }
      }) : user.text);
      const backup = path.join(backupDir, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`);
      fs.mkdirSync(backup, {
        recursive: true
      });
      entries.forEach((entry, i) => {
        if (entry.before !== null) fs.writeFileSync(path.join(backup, `${i}.ini`), entry.before, {
          flag: 'wx'
        });
      });
      fs.writeFileSync(path.join(backup, 'backup.json'), JSON.stringify(entries.map(({
        file,
        before,
        mode
      }) => ({
        file,
        existed: before !== null,
        mode
      })), null, 2));
      const request = path.join(backup, 'launch.json'),
        resultFile = path.join(backup, 'result.json');
      fs.writeFileSync(request, JSON.stringify({
        gameRoot: paths.gameRoot,
        engine: targets[1],
        resultFile,
        arguments: buildWuwaDx12Args(paths, args).map(quoteWindowsArgument).join(' '),
        engineReadOnly: entries[1].mode !== null && !(entries[1].mode & 0o200)
      }));
      const written = [];
      let mayHaveStarted = false;
      try {
        for (const entry of entries) {
          if (entry.before?.equals(entry.after)) continue;
          fs.mkdirSync(path.dirname(entry.file), {
            recursive: true
          });
          written.push(entry);
          if (entry.mode !== null) fs.chmodSync(entry.file, entry.mode | 0o200);
          fs.writeFileSync(entry.file, entry.after);
          if (!fs.readFileSync(entry.file).equals(entry.after)) throw Error(i18n.t("backend.wuwaDx12.writeVerificationFailed"));
          if (entry.mode !== null) fs.chmodSync(entry.file, entry.mode);
        }
        const result = await launchProcess(powershell(), __dirname, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'wuwa-dx12-launch.ps1'), '-RequestFile', request]);
        if (!result?.success) throw Error(result?.error || i18n.t("backend.wuwaDx12.launchFailed"));
        mayHaveStarted = true;
        // The independent helper owns the temporary read-only flag even if QAQ exits.
        const started = await waitForStart(resultFile);
        if (!started) throw Error(i18n.t("backend.wuwaDx12.helperResultMissing"));
        if (started?.success === false) {
          mayHaveStarted = started.started !== false;
          throw Error(i18n.t("backend.wuwaDx12.launchError", {
            error: started.error
          }));
        }
        return {
          success: true,
          notice: i18n.t("backend.wuwaDx12.launchRequested"),
          backup
        };
      } catch (error) {
        if (mayHaveStarted) throw Error(i18n.t("backend.wuwaDx12.backupDetail", {
          reason: error.message,
          backup
        }));
        const failures = [];
        for (const entry of written.reverse()) {
          try {
            if (isFile(entry.file)) fs.chmodSync(entry.file, fs.statSync(entry.file).mode | 0o200);
            if (entry.before === null) {
              if (isFile(entry.file)) fs.unlinkSync(entry.file);
            } else {
              fs.writeFileSync(entry.file, entry.before);
              fs.chmodSync(entry.file, entry.mode);
            }
          } catch {
            failures.push(path.basename(entry.file));
          }
        }
        throw Error(`${error.message}${failures.length ? i18n.t("backend.wuwaDx12.restoreFailedSuffix", {
          path: failures.join('、'),
          backup
        }) : i18n.t("backend.wuwaDx12.configRestoredSuffix")}`);
      }
    });
  }
  async function checkUpdates() {
    return locked(async () => {
      const result = await packages.checkUpdates();
      return {
        ...(await status()),
        message: Object.keys(result.errors).length ? i18n.t("backend.wuwaDx12.componentChecksFailed") : i18n.t("backend.wuwaDx12.componentChecksComplete")
      };
    });
  }
  async function updateComponent(kind) {
    if (!['reshade', 'addon'].includes(kind)) throw Error(i18n.t("backend.wuwaDx12Components.unknownComponent"));
    return locked(async () => {
      const state = await status();
      const bundle = await packages.prepareUpdate(kind, state.sources[kind].version);
      const result = await components.update(state.paths, kind, bundle, {
        beforeApply: () => stopped(state.paths),
        validate: async () => {
          if (state.enabled && !(await status()).ready) throw Error(i18n.t("backend.wuwaDx12.updatedEnvironmentInvalid"));
        },
        commit: () => packages.commitUpdate(bundle)
      });
      return {
        ...(await status()),
        message: i18n.t("backend.wuwaDx12.componentUpdated", {
          label: kind === 'reshade' ? 'ReShade' : 'wwmi-dx12',
          version: bundle.version,
          label2: result.cached ? state.sources[kind].source === 'user' ? i18n.t("backend.wuwaDx12.cachedUpdateNotice") : i18n.t("backend.wuwaDx12.installOnEnableNotice") : state.sources[kind].active ? i18n.t("backend.wuwaDx12.enabledUpdateNotice") : i18n.t("backend.wuwaDx12.disabledUpdateNotice")
        })
      };
    });
  }
  return {
    status,
    setEnabled,
    launch,
    checkUpdates,
    updateComponent
  };
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
module.exports = {
  createWuwaDx12Service,
  resolveWuwaDx12Paths,
  buildWuwaDx12Args,
  inspectReShade
};
