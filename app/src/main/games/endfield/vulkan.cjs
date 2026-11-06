const i18n = require("../../../shared/i18n/core.cjs");
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');
const {
  hasUnsafeApproval,
  loadBundle,
  replaceFiles,
  FORK_MARK,
  VULKAN_MARK
} = require("../../install/mi-forks.cjs");
const RUNTIME = 'd3d11.dll';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const isFile = file => {
  try {
    return !!file && fs.statSync(file).isFile();
  } catch {
    return false;
  }
};
// The Launcher passes this field to the game. Other words in it stay; only the renderer choice moves.
function rendererArgument(value, vulkan) {
  const others = String(value ?? '').split(/\s+/).filter(word => word && !/^-force-(?:d3d11|d3d12|vulkan)$/i.test(word));
  return (vulkan ? others : ['-force-d3d11', ...others]).join(' ');
}
function createEfmiVulkanService({
  resolveInstallation,
  packages,
  miForks,
  bundleRoots,
  assertStopped,
  readPresent,
  notifyChanged = () => {},
  userName = os.userInfo().username
}) {
  let busy = false;
  const roots = () => typeof bundleRoots === 'function' ? bundleRoots() : bundleRoots;
  function forkBundle() {
    const bundle = loadBundle(roots(), 'xxmi-runtime-vulkan', 'XXMI-Libs-Package');
    if (!bundle.files[RUNTIME] || bundle.manifest.backend !== 'vulkan') throw Error(i18n.t("backend.efmiVulkan.invalidFork"));
    return bundle;
  }
  const tryFork = () => {
    try {
      return forkBundle();
    } catch {
      return null;
    }
  };
  function installation() {
    const found = resolveInstallation();
    if (!found?.miRoot || !found.launcherRoot) return { miRoot: '', launcherRoot: '', gamePath: found?.gamePath || '' };
    return found;
  }
  const configFile = root => path.join(root, 'XXMI Launcher Config.json');
  function readConfig(root) {
    return JSON.parse(fs.readFileSync(configFile(root), 'utf8').replace(/^﻿/, ''));
  }
  function writeArgument(root, vulkan) {
    const config = readConfig(root);
    if (!config.Importers?.EFMI?.Importer) throw Error(i18n.t("backend.efmiVulkan.launcherConfigMissing"));
    const next = rendererArgument(config.Importers.EFMI.Importer.d3d11_mode_cmd_args, vulkan);
    if (config.Importers.EFMI.Importer.d3d11_mode_cmd_args === next) return false;
    config.Importers.EFMI.Importer.d3d11_mode_cmd_args = next;
    const temporary = configFile(root) + '.qaqr-update-' + crypto.randomUUID();
    try {
      fs.writeFileSync(temporary, JSON.stringify(config, null, 4));
      fs.renameSync(temporary, configFile(root));
    } finally {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
    return true;
  }
  // The libraries the runtimes bring along. Only copies this manager recognises are removed again.
  function knownLibraries(fork) {
    const known = new Map();
    const add = (name, digest) => {
      if (name !== RUNTIME && /\.dll$/i.test(name)) known.set(name, [...(known.get(name) || []), digest]);
    };
    for (const info of [packages.selected(), packages.pending()]) if (info) for (const [name, digest] of Object.entries(info.files)) add(name, digest);
    if (fork) for (const [name, digest] of Object.entries(fork.manifest.files)) add(name, digest);
    return known;
  }
  // Local state comes from the file on disk; the channel of a running game is whatever it loaded from there.
  function readLocal(root, fork) {
    const file = path.join(root, RUNTIME);
    if (!isFile(file)) return { enabled: false, channel: null };
    const bytes = fs.readFileSync(file), current = hash(bytes);
    if (!bytes.includes(VULKAN_MARK)) return { enabled: false, channel: null };
    if (fork && fork.manifest.files[RUNTIME] === current) return { enabled: true, channel: 'fork' };
    if (packages.selected().files[RUNTIME] === current || packages.pending()?.files[RUNTIME] === current) return { enabled: true, channel: 'official' };
    return { enabled: true, channel: bytes.includes(FORK_MARK) ? 'outdated' : 'other' };
  }
  async function status() {
    const { miRoot, launcherRoot, gamePath } = installation();
    const checks = [];
    const check = (id, title, ok, message) => checks.push({ id, title, ok: !!ok, message });
    const fork = tryFork();
    const hasMi = !!miRoot && isFile(path.join(miRoot, 'd3dx.ini')) && isFile(path.join(miRoot, RUNTIME));
    const local = hasMi ? readLocal(miRoot, fork) : { enabled: false, channel: null };
    check('game', i18n.t("backend.efmiVulkan.gameTitle"), isFile(gamePath), gamePath || i18n.t("backend.efmiVulkan.gameRequired"));
    check('mi', i18n.t("backend.efmiVulkan.miTitle"), hasMi, miRoot || i18n.t("backend.efmiVulkan.miRequired"));
    const approval = hasMi && hasUnsafeApproval(launcherRoot, 'EFMI', userName);
    check('approval', 'Unsafe Mode', approval, i18n.t(approval ? "backend.efmiVulkan.approvalGranted" : "backend.efmiVulkan.approvalRequired"));
    if (hasMi && local.enabled) {
      let argument;
      try {
        argument = readConfig(launcherRoot).Importers?.EFMI?.Importer?.d3d11_mode_cmd_args;
      } catch {
        argument = null;
      }
      const cleared = !/-force-d3d11/i.test(argument ?? '-force-d3d11');
      check('argument', i18n.t("backend.efmiVulkan.argumentTitle"), cleared, i18n.t(cleared ? "backend.efmiVulkan.argumentCleared" : "backend.efmiVulkan.argumentPresent"));
    }
    const present = await readPresent();
    const presentKey = present.vendor !== 'nvidia' ? (present.vendor === 'other' ? 'presentOtherVendor' : 'presentUnknown') : present.value === 0 ? 'presentNative' : present.value === 1 ? 'presentLayered' : 'presentAuto';
    check('present', i18n.t("backend.efmiVulkan.presentTitle"), present.vendor === 'nvidia' && present.value !== 0, i18n.t(`backend.efmiVulkan.${presentKey}`));
    const dx11 = hasMi && !local.enabled ? miForks.status('endfield').components?.find(item => item.id === 'runtime') : null;
    return {
      success: true,
      enabled: local.enabled,
      channel: local.channel,
      ready: checks.every(item => item.ok),
      checks,
      confirmReplace: dx11?.confirmReplace === true,
      sources: {
        official: { version: packages.selected().version },
        fork: fork ? { version: fork.manifest.version || null, build: fork.manifest.sourceCommit.slice(0, 12) } : null
      },
      updates: packages.state(),
      paths: { mi: miRoot, game: gamePath, launcher: launcherRoot }
    };
  }
  async function locked(action) {
    if (busy) throw Error(i18n.t("backend.efmiVulkan.operationInProgress"));
    busy = true;
    try {
      const result = await action();
      notifyChanged();
      return result;
    } finally {
      busy = false;
    }
  }
  async function vulkanFiles(channel, fork, info) {
    if (channel === 'fork') {
      if (!fork) throw Error(i18n.t("backend.efmiVulkan.forkMissing"));
      return new Map(Object.keys(fork.manifest.files).filter(name => /\.dll$/i.test(name)).map(name => [name, fs.readFileSync(fork.files[name])]));
    }
    return packages.ensure(info);
  }
  function apply(root, launcherRoot, files, vulkan) {
    const relatives = [...files.keys()];
    const before = relatives.map(relative => ({
      relative,
      bytes: fs.existsSync(path.join(root, relative)) ? fs.readFileSync(path.join(root, relative)) : null
    }));
    replaceFiles(root, relatives.map(relative => ({ relative, bytes: files.get(relative) })));
    try {
      writeArgument(launcherRoot, vulkan);
    } catch (error) {
      replaceFiles(root, before);
      throw error;
    }
  }
  function requireReady(state, ids) {
    const blocked = state.checks.filter(item => ids.includes(item.id) && !item.ok);
    if (blocked.length) throw Error(blocked.map(item => `${item.title}：${item.message}`).join('\n'));
  }
  async function setEnabled(enabled, { confirmed = false } = {}) {
    if (typeof enabled !== 'boolean') throw Error(i18n.t("backend.efmiVulkan.invalidValue"));
    return locked(async () => {
      const state = await status();
      const { mi: root, launcher: launcherRoot } = state.paths;
      if (state.enabled === enabled) {
        if (root) writeArgument(launcherRoot, enabled);
        return { success: true, enabled };
      }
      const fork = tryFork();
      if (enabled) {
        requireReady(state, ['game', 'mi', 'approval']);
        if (state.confirmReplace && !confirmed) throw Error(i18n.t("backend.efmiVulkan.confirmRequired"));
        const dx11 = miForks.status('endfield').components?.find(item => item.id === 'runtime');
        const channel = dx11?.local.kind === 'fork' && fork ? 'fork' : 'official';
        const files = await vulkanFiles(channel, fork);
        await assertStopped(state.paths);
        apply(root, launcherRoot, files, true);
        return { success: true, enabled, channel, restartRequired: true };
      }
      requireReady(state, ['mi']);
      const target = miForks.dx11Runtime('endfield', state.channel === 'fork' ? 'fork' : 'official');
      const files = new Map([[RUNTIME, target.bytes]]);
      for (const [name, digests] of knownLibraries(fork)) {
        const file = path.join(root, name);
        if (isFile(file) && digests.includes(hash(fs.readFileSync(file)))) files.set(name, null);
      }
      await assertStopped(state.paths);
      apply(root, launcherRoot, files, false);
      return { success: true, enabled, channel: target.channel, restartRequired: true };
    });
  }
  async function setChannel(target) {
    if (!['official', 'fork'].includes(target)) throw Error(i18n.t("backend.efmiVulkan.invalidValue"));
    return locked(async () => {
      const state = await status();
      if (!state.enabled) throw Error(i18n.t("backend.efmiVulkan.notEnabled"));
      requireReady(state, ['approval']);
      if (state.channel === target) return { success: true, channel: target };
      const files = await vulkanFiles(target, tryFork());
      await assertStopped(state.paths);
      apply(state.paths.mi, state.paths.launcher, files, true);
      return { success: true, channel: target, restartRequired: true };
    });
  }
  async function checkUpdates() {
    return locked(async () => {
      await packages.checkUpdates();
      return status();
    });
  }
  async function update() {
    return locked(async () => {
      const state = await status();
      const info = packages.pending();
      if (!state.updates.updateAvailable || !info) throw Error(i18n.t("backend.efmiVulkan.alreadyCurrent"));
      const files = await packages.ensure(info);
      if (state.enabled && state.channel === 'official') {
        await assertStopped(state.paths);
        apply(state.paths.mi, state.paths.launcher, files, true);
      }
      packages.commit(info);
      return status();
    });
  }
  // The launch reads the DLL on disk, so the renderer the game is told to use can never disagree with it.
  async function prepareLaunch() {
    const { miRoot, launcherRoot } = installation();
    if (!miRoot || !isFile(path.join(miRoot, RUNTIME))) return { vulkan: false };
    const { enabled } = readLocal(miRoot, tryFork());
    if (enabled && !hasUnsafeApproval(launcherRoot, 'EFMI', userName)) throw Error(i18n.t("backend.efmiVulkan.approvalRequired"));
    try {
      writeArgument(launcherRoot, enabled);
    } catch (error) {
      // Without the field the Launcher defaults to DX11, which is only wrong for the Vulkan runtime.
      if (enabled) throw error;
    }
    return { vulkan: enabled };
  }
  return {
    status,
    setEnabled,
    setChannel,
    checkUpdates,
    update,
    prepareLaunch
  };
}
async function assertEndfieldStopped({ launcher }, run) {
  const bin = launcher ? path.join(launcher, 'Resources', 'Bin') : '';
  const literal = value => "'" + String(value).replace(/'/g, "''") + "'";
  const count = await run(`$ErrorActionPreference='Stop'; $bin=${literal(bin)}; @(Get-Process | Where-Object { $_.ProcessName -eq 'Endfield' -or ($bin -and $_.Path -and [IO.Path]::GetDirectoryName($_.Path) -eq $bin) }).Count`);
  if (String(count).trim() !== '0') throw Error(i18n.t("backend.efmiVulkan.closeGameFirst"));
}
module.exports = {
  createEfmiVulkanService,
  assertEndfieldStopped,
  rendererArgument
};
