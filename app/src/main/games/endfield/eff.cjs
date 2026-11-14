"use strict";

const i18n = require("../../../shared/i18n/core.cjs");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { readJsonFileSync, writeJsonFileSync } = require("../../core/json-store.cjs");
const { loadBundle, replaceFiles } = require("../../install/mi-forks.cjs");
const { PROXIES, PLUGIN_FILES, SETTINGS_FILE, PROXY_MARK } = require("./eff-packages.cjs");
const [COMPILER_PROXY, VULKAN_PROXY] = PROXIES;
const RUNTIME = "plugin/eff.dll";
const LOADER_CONFIG = "plugin/applepie_manager_config.txt";
const MODS = "plugin/mods";
const MOD_FILE = "mod.ini";
// EFF Mod Manager's suffix, written by QAQR too; the community's ".disable" is read as disabled as well.
const DISABLED_SUFFIXES = [".effmm-disabled", ".disable"];
const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const fail = (key, values) => Error(i18n.t(`backend.eff.${key}`, values));
const isFile = file => {
  try {
    return !!file && fs.statSync(file).isFile();
  } catch {
    return false;
  }
};
const read = file => isFile(file) ? fs.readFileSync(file) : null;
const isProxy = bytes => !!bytes && bytes.includes(PROXY_MARK);
function peVersion(bytes) {
  const fixed = bytes ? bytes.indexOf(Buffer.from([0xbd, 0x04, 0xef, 0xfe])) : -1;
  if (fixed < 0 || fixed + 24 > bytes.length) return null;
  const high = bytes.readUInt32LE(fixed + 16), low = bytes.readUInt32LE(fixed + 20);
  const parts = [high >>> 16, high & 0xffff, low >>> 16, low & 0xffff];
  // EFF numbers releases with three parts and leaves the fourth at zero.
  return (parts[3] ? parts : parts.slice(0, 3)).join(".");
}
// The proxies skip eff.dll when the [plugins] section of their configuration says eff.dll=0.
function loaderDisabled(text) {
  let section = false;
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith("[")) {
      section = line.toLowerCase() === "[plugins]";
      continue;
    }
    const at = line.indexOf("=");
    if (section && at > 0 && line.slice(0, at).trim().toLowerCase() === "eff.dll" && line.slice(at + 1).trim() === "0") return true;
  }
  return false;
}
// Other plugins and sections of the file stay as they are; only the eff.dll line moves.
function loaderConfig(text, enabled) {
  const lines = String(text || "").split(/\r?\n/);
  let section = false, start = -1;
  const kept = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith("[")) {
      section = line.toLowerCase() === "[plugins]";
      if (section && start < 0) start = kept.length;
    } else if (section) {
      const at = line.indexOf("=");
      if (at > 0 && line.slice(0, at).trim().toLowerCase() === "eff.dll") continue;
    }
    kept.push(raw);
  }
  while (kept.length && !kept[kept.length - 1].trim()) kept.pop();
  // A file that held nothing but this switch goes away with it.
  if (enabled && kept.every(line => !line.trim() || line.trim().toLowerCase() === "[plugins]")) return "";
  if (!enabled) {
    if (start < 0) kept.push(...(kept.length ? [""] : []), "[plugins]", "eff.dll=0");
    else kept.splice(start + 1, 0, "eff.dll=0");
  }
  return kept.length ? kept.join("\r\n") + "\r\n" : "";
}
function parseModIni(text) {
  const info = { id: null, format: null, keySwitch: true, keys: [] };
  let section = "";
  for (const raw of String(text || "").replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const line = raw.replace(/[;#].*$/, "").trim();
    if (!line) continue;
    const header = /^\[(.+)\]$/.exec(line);
    if (header) {
      section = header[1].trim();
      continue;
    }
    const at = line.indexOf("=");
    if (at < 0) continue;
    const key = line.slice(0, at).trim().toLowerCase(), value = line.slice(at + 1).trim();
    if (section.toLowerCase() === "mod") {
      if (key === "id") info.id = value;
      else if (key === "format") info.format = value;
      else if (key === "key_switch_enabled") info.keySwitch = value !== "0";
    } else if (/^key/i.test(section) && key === "key" && value && info.keys.length < 32) info.keys.push(value);
  }
  return info;
}
// EFF finds a Mod by the mod.ini in its folder and skips links, reparse points and names starting with a dot.
function findMods(modsDir) {
  const mods = [];
  const walk = (dir, depth) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      const full = path.join(dir, entry.name);
      if (fs.lstatSync(full).isSymbolicLink()) continue;
      const enabledFile = path.join(full, MOD_FILE);
      const disabledFile = DISABLED_SUFFIXES.map(suffix => enabledFile + suffix).find(isFile);
      if (isFile(enabledFile) || disabledFile) {
        const ini = isFile(enabledFile) ? enabledFile : disabledFile;
        const info = parseModIni(fs.readFileSync(ini, "utf8"));
        mods.push({
          id: path.relative(modsDir, full).split(path.sep).join("/"),
          name: entry.name,
          path: full,
          enabled: ini === enabledFile,
          conflict: ini === enabledFile && !!disabledFile,
          modId: info.id,
          format: info.format,
          keySwitch: info.keySwitch,
          keys: [...new Set(info.keys)]
        });
      }
      // A Mod may hold child Mods, which EFF loads on their own.
      if (depth < 6) walk(full, depth + 1);
    }
  };
  walk(modsDir, 0);
  return mods.sort((a, b) => a.id.localeCompare(b.id, "zh-CN"));
}
function createEffService({
  resolveGame,
  efmiVulkanActive = () => false,
  packages,
  bundleRoots = [],
  assertStopped,
  stateFile,
  backupDir,
  trash,
  extract,
  notifyChanged = () => {},
  systemRoot = process.env.SystemRoot || "C:\\Windows"
}) {
  let busy = false;
  const roots = () => typeof bundleRoots === "function" ? bundleRoots() : bundleRoots;
  const tryFork = () => {
    try {
      const bundle = loadBundle(roots(), "eff", "EFF");
      return bundle.files[RUNTIME] && PROXIES.every(name => bundle.files[name]) ? bundle : null;
    } catch {
      return null;
    }
  };
  function readState() {
    try {
      const saved = readJsonFileSync(stateFile);
      return saved && typeof saved.games === "object" ? saved : { games: {} };
    } catch {
      return { games: {} };
    }
  }
  const gameKey = root => hash(Buffer.from(path.resolve(root).toLowerCase())).slice(0, 16);
  function record(root, change) {
    const state = readState(), key = gameKey(root);
    state.games[key] = change({ ...(state.games[key] || {}), root });
    writeJsonFileSync(stateFile, state);
  }
  function gameRoot() {
    const gamePath = resolveGame()?.gamePath || "";
    return { gamePath, root: isFile(gamePath) ? path.dirname(gamePath) : "" };
  }
  function inspect(root) {
    const at = relative => path.join(root, relative);
    const runtime = read(at(RUNTIME));
    const proxies = Object.fromEntries(PROXIES.map(name => {
      const bytes = read(at(name));
      return [name, !bytes ? "missing" : isProxy(bytes) ? "eff" : "original"];
    }));
    const saved = readState().games[gameKey(root)] || {};
    const fork = tryFork();
    const current = runtime ? hash(runtime) : null;
    const channel = !runtime ? null : fork && hash(fs.readFileSync(fork.files[RUNTIME])) === current ? "fork"
      : saved.installed?.sha256 === current ? saved.installed.channel : "other";
    const pluginDir = at("plugin");
    let others = [];
    try {
      others = fs.readdirSync(pluginDir).filter(name => /\.dll$/i.test(name) && name.toLowerCase() !== "eff.dll");
    } catch { /* no plugin directory yet */ }
    return {
      installed: !!runtime,
      enabled: !!runtime && !loaderDisabled(read(at(LOADER_CONFIG))?.toString("utf8")),
      version: runtime ? peVersion(runtime) : null,
      channel,
      proxies,
      others,
      saved,
      fork
    };
  }
  // With the Vulkan runtime of EFMI, a vulkan-1.dll proxy hides the real loader from its export hooks;
  // its d3d11.dll imports d3dcompiler_47.dll, which then brings EFF in on its own.
  const wantVulkanProxy = () => !efmiVulkanActive();
  function proxiesInPlace(local) {
    return local.proxies[COMPILER_PROXY] === "eff" && (local.proxies[VULKAN_PROXY] === "eff") === wantVulkanProxy();
  }
  async function status() {
    const { gamePath, root } = gameRoot();
    const checks = [];
    const check = (id, title, ok, message) => checks.push({ id, title, ok: !!ok, message });
    check("game", i18n.t("backend.eff.gameTitle"), !!root, root ? gamePath : i18n.t("backend.eff.gameRequired"));
    const systemOk = path.resolve(systemRoot).toLowerCase() === "c:\\windows";
    check("system", i18n.t("backend.eff.systemTitle"), systemOk, i18n.t(systemOk ? "backend.eff.systemOk" : "backend.eff.systemUnsupported", { path: systemRoot }));
    const local = root ? inspect(root) : null;
    const vulkan = efmiVulkanActive();
    if (local?.installed) {
      check("loader", i18n.t("backend.eff.loaderTitle"), proxiesInPlace(local), i18n.t(proxiesInPlace(local) ? (vulkan ? "backend.eff.loaderCompilerOnly" : "backend.eff.loaderBoth") : "backend.eff.loaderRepair"));
      check("backend", i18n.t("backend.eff.backendTitle"), !vulkan, i18n.t(vulkan ? "backend.eff.backendVulkan" : "backend.eff.backendDx11"));
      if (local.others.some(name => name.toLowerCase() === "applepie_manager.dll")) check("applepie", "ApplePie Manager", false, i18n.t("backend.eff.applepieOld"));
    }
    const fork = local?.fork || tryFork();
    return {
      success: true,
      installed: !!local?.installed,
      enabled: !!local?.enabled,
      version: local?.version || null,
      channel: local?.channel || null,
      ready: checks.every(item => item.ok),
      checks,
      otherPlugins: local?.others || [],
      // Mods outside a character folder load in game but have no place on the Mods page.
      unassignedMods: local?.installed ? unassignedMods().map(mod => mod.id) : [],
      sources: {
        official: { version: packages.selected().version },
        fork: fork ? { version: fork.manifest.version || null, build: fork.manifest.sourceCommit.slice(0, 12) } : null
      },
      updates: packages.state(),
      paths: { game: root, plugin: root ? path.join(root, "plugin") : "", mods: root ? path.join(root, MODS) : "" }
    };
  }
  async function locked(action) {
    if (busy) throw fail("operationInProgress");
    busy = true;
    try {
      const result = await action();
      notifyChanged();
      return result;
    } finally {
      busy = false;
    }
  }
  function requireReady(state, ids) {
    const blocked = state.checks.filter(item => ids.includes(item.id) && !item.ok);
    if (blocked.length) throw Error(blocked.map(item => `${item.title}：${item.message}`).join("\n"));
  }
  async function sourceFiles(channel, info) {
    if (channel === "fork") {
      const fork = tryFork();
      if (!fork) throw fail("forkMissing");
      return new Map(Object.keys(fork.files).map(relative => [relative.replace(/\\/g, "/"), fs.readFileSync(fork.files[relative])]));
    }
    return packages.ensure(info);
  }
  function backupFile(root, name) {
    return path.join(backupDir, gameKey(root), name);
  }
  // A file EFF did not put there is kept aside before the first proxy replaces it, and put back when the proxy goes.
  function proxyPlans(root, files, local, backups) {
    const plans = [];
    for (const name of PROXIES) {
      const want = name === COMPILER_PROXY || wantVulkanProxy();
      const current = read(path.join(root, name));
      if (want) {
        // A game update may have put a newer original back since the last backup.
        if (current && !isProxy(current) && backups[name] !== hash(current)) {
          fs.mkdirSync(path.dirname(backupFile(root, name)), { recursive: true });
          fs.writeFileSync(backupFile(root, name), current);
          backups[name] = hash(current);
        }
        if (!current || !current.equals(files.get(name))) plans.push({ relative: name, bytes: files.get(name) });
      } else if (local.proxies[name] === "eff") {
        plans.push({ relative: name, bytes: restored(root, name, backups) });
      }
    }
    return plans;
  }
  function restored(root, name, backups) {
    if (!backups[name]) return null;
    const bytes = read(backupFile(root, name));
    if (!bytes || hash(bytes) !== backups[name]) throw fail("backupInvalid", { name });
    return bytes;
  }
  function commit(root, plans, installed, backups) {
    fs.mkdirSync(path.join(root, MODS), { recursive: true });
    if (plans.length) replaceFiles(root, plans);
    record(root, saved => ({ ...saved, backups, ...(installed ? { installed } : {}) }));
  }
  async function install(channel = "official", info) {
    const state = await status();
    requireReady(state, ["game", "system"]);
    const root = state.paths.game, local = inspect(root);
    const files = await sourceFiles(channel, info);
    await assertStopped();
    const backups = { ...(local.saved.backups || {}) };
    const plans = proxyPlans(root, files, local, backups);
    for (const relative of PLUGIN_FILES) if (files.has(relative)) plans.push({ relative, bytes: files.get(relative) });
    if (files.has(SETTINGS_FILE) && !isFile(path.join(root, SETTINGS_FILE))) plans.push({ relative: SETTINGS_FILE, bytes: files.get(SETTINGS_FILE) });
    const version = channel === "fork" ? tryFork()?.manifest.version || null : (info || packages.selected()).version;
    commit(root, plans, { sha256: hash(files.get(RUNTIME)), channel, version }, backups);
    return { success: true, channel, restartRequired: true };
  }
  async function uninstall() {
    const state = await status();
    requireReady(state, ["game"]);
    const root = state.paths.game, local = inspect(root);
    if (!local.installed && PROXIES.every(name => local.proxies[name] !== "eff")) return { success: true };
    await assertStopped();
    const backups = { ...(local.saved.backups || {}) };
    const plans = PROXIES.filter(name => local.proxies[name] === "eff").map(name => ({ relative: name, bytes: restored(root, name, backups) }));
    for (const relative of PLUGIN_FILES) if (isFile(path.join(root, relative))) plans.push({ relative, bytes: null });
    replaceFiles(root, plans);
    for (const name of PROXIES) if (plans.some(plan => plan.relative === name)) {
      delete backups[name];
      fs.rmSync(backupFile(root, name), { force: true });
    }
    record(root, saved => ({ root, backups }));
    return { success: true, restartRequired: true };
  }
  // The proxies follow the EFMI runtime on disk, and come back after a game update put the original files back.
  async function syncLoaders() {
    const { root } = gameRoot();
    if (!root) return { changed: false };
    const local = inspect(root);
    if (!local.installed || proxiesInPlace(local)) return { changed: false };
    const channel = local.channel === "fork" && local.fork ? "fork" : "official";
    const files = await sourceFiles(channel);
    await assertStopped();
    const backups = { ...(local.saved.backups || {}) };
    const plans = proxyPlans(root, files, local, backups);
    commit(root, plans, null, backups);
    return { changed: plans.length > 0 };
  }
  async function setEnabled(enabled) {
    if (typeof enabled !== "boolean") throw fail("invalidValue");
    return locked(async () => {
      const state = await status();
      requireReady(state, ["game"]);
      if (!state.installed) throw fail("notInstalled");
      const file = path.join(state.paths.game, LOADER_CONFIG);
      const before = read(file)?.toString("utf8") || "";
      const next = loaderConfig(before, enabled);
      if (next !== before) {
        if (next) replaceFiles(state.paths.game, [{ relative: LOADER_CONFIG, bytes: Buffer.from(next, "utf8") }]);
        else fs.rmSync(file, { force: true });
      }
      return { success: true, enabled, restartRequired: true };
    });
  }
  const setInstalled = installed => locked(() => installed ? install() : uninstall());
  async function setChannel(target) {
    if (!["official", "fork"].includes(target)) throw fail("invalidValue");
    return locked(async () => {
      const state = await status();
      if (!state.installed) throw fail("notInstalled");
      if (state.channel === target) return { success: true, channel: target };
      return install(target);
    });
  }
  const checkUpdates = () => locked(async () => {
    await packages.checkUpdates();
    return status();
  });
  const update = () => locked(async () => {
    const state = await status();
    const info = packages.pending();
    if (!state.updates.updateAvailable || !info) throw fail("alreadyCurrent");
    await packages.ensure(info);
    if (state.installed && state.channel === "official") await install("official", info);
    packages.commit(info);
    return status();
  });
  const sync = () => locked(syncLoaders);
  async function prepareLaunch() {
    if (busy) return { changed: false };
    return sync();
  }
  // Mods are addressed by their path under plugin/mods, which never leaves it.
  function modsDir() {
    const { root } = gameRoot();
    if (!root) throw fail("gameRequired");
    return path.join(root, MODS);
  }
  function modPath(id) {
    const base = modsDir(), full = path.resolve(base, String(id || ""));
    if (!id || !full.startsWith(base + path.sep)) throw fail("modMissing");
    return full;
  }
  function listMods() {
    const dir = modsDir();
    return { success: true, path: dir, mods: fs.existsSync(dir) ? findMods(dir) : [] };
  }
  function setModEnabled(id, enabled) {
    if (typeof enabled !== "boolean") throw fail("invalidValue");
    const dir = modPath(id), enabledFile = path.join(dir, MOD_FILE);
    const disabledFile = DISABLED_SUFFIXES.map(suffix => enabledFile + suffix).find(isFile);
    if (enabled) {
      if (isFile(enabledFile)) return { success: true, enabled };
      if (!disabledFile) throw fail("modMissing");
      fs.renameSync(disabledFile, enabledFile);
    } else {
      if (!isFile(enabledFile)) {
        if (disabledFile) return { success: true, enabled };
        throw fail("modMissing");
      }
      const target = enabledFile + DISABLED_SUFFIXES[0];
      if (isFile(target)) throw fail("modConflict");
      fs.renameSync(enabledFile, target);
    }
    notifyChanged();
    return { success: true, enabled };
  }
  function uniqueName(dir, name) {
    const clean = String(name || "").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").replace(/[. ]+$/, "").replace(/^\.+/, "") || "EFF Mod";
    let candidate = clean;
    for (let i = 2; fs.existsSync(path.join(dir, candidate)); i++) candidate = `${clean} (${i})`;
    return candidate;
  }
  const hasMod = dir => isFile(path.join(dir, MOD_FILE)) || findMods(dir).length > 0;
  // A folder or an archive is staged inside plugin under a dot name, which EFF never reads, and moved in once it holds a Mod.
  async function importMod(source) {
    const dir = modsDir();
    if (!source || !fs.existsSync(source)) throw fail("importMissing");
    fs.mkdirSync(dir, { recursive: true });
    const stage = path.join(path.dirname(dir), `.qaqr-import-${crypto.randomUUID()}`);
    try {
      const isDir = fs.statSync(source).isDirectory();
      if (isDir) fs.cpSync(source, stage, { recursive: true, verbatimSymlinks: true, filter: item => !fs.lstatSync(item).isSymbolicLink() });
      else await extract(source, stage);
      if (!fs.existsSync(stage)) throw fail("importNoMod");
      // An archive holding just one folder is that Mod or that set of Mods.
      let top = stage;
      const entries = fs.readdirSync(stage, { withFileTypes: true });
      if (!isFile(path.join(stage, MOD_FILE)) && entries.length === 1 && entries[0].isDirectory()) top = path.join(stage, entries[0].name);
      if (!hasMod(top)) throw fail("importNoMod");
      const base = isDir ? path.basename(source) : top === stage ? path.parse(source).name : path.basename(top);
      const name = uniqueName(dir, base);
      fs.renameSync(top, path.join(dir, name));
      notifyChanged();
      return { success: true, id: name };
    } finally {
      fs.rmSync(stage, { recursive: true, force: true });
    }
  }
  async function removeMod(id) {
    const dir = modPath(id);
    if (!hasMod(dir) && !DISABLED_SUFFIXES.some(suffix => isFile(path.join(dir, MOD_FILE + suffix)))) throw fail("modMissing");
    await trash(dir);
    notifyChanged();
    return { success: true };
  }
  // The Mods page keeps EFF Mods per character as plugin/mods/<character>/<Mod>, as EFMI keeps Mods/<character>/<Mod>;
  // EFF finds them there on its own.
  const SEGMENT = /^(?!\.)[^<>:"/\\|?*\u0000-\u001f]+(?<![. ])$/;
  function characterDir(characterName) {
    if (!SEGMENT.test(String(characterName || ""))) throw fail("modMissing");
    return path.join(modsDir(), characterName);
  }
  function installed() {
    const { root } = gameRoot();
    return !!root && isFile(path.join(root, RUNTIME));
  }
  function readCharacterMod(dir) {
    const enabledFile = path.join(dir, MOD_FILE);
    const disabledFile = DISABLED_SUFFIXES.map(suffix => enabledFile + suffix).find(isFile);
    const ini = isFile(enabledFile) ? enabledFile : disabledFile;
    if (!ini) return null;
    const info = parseModIni(fs.readFileSync(ini, "utf8"));
    let preview = null;
    try {
      const png = fs.readdirSync(dir).filter(name => /\.png$/i.test(name));
      preview = png.find(name => /^preview\./i.test(name)) || png[0] || null;
    } catch { /* unreadable folder */ }
    return {
      folder: path.basename(dir),
      path: dir,
      enabled: ini === enabledFile,
      modId: info.id,
      format: info.format,
      keySwitch: info.keySwitch,
      keys: [...new Set(info.keys)],
      preview: preview ? path.join(dir, preview) : null
    };
  }
  function characterMods(characterName) {
    if (!installed()) return [];
    const dir = characterDir(characterName);
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return [];
    }
    return entries.filter(entry => entry.isDirectory() && !entry.name.startsWith(".") && !fs.lstatSync(path.join(dir, entry.name)).isSymbolicLink())
      .map(entry => readCharacterMod(path.join(dir, entry.name))).filter(Boolean);
  }
  function resolveCharacterMod(characterName, name, suffix = "") {
    if (!installed() || !SEGMENT.test(String(name || ""))) return null;
    const dir = characterDir(characterName);
    for (const folder of [name, suffix && name.endsWith(suffix) ? name.slice(0, -suffix.length) : null]) {
      if (!folder || !SEGMENT.test(folder)) continue;
      const mod = isFile(path.join(dir, folder, MOD_FILE)) || DISABLED_SUFFIXES.some(item => isFile(path.join(dir, folder, MOD_FILE + item))) ? readCharacterMod(path.join(dir, folder)) : null;
      if (mod) return mod;
    }
    return null;
  }
  const relativeId = mod => path.relative(modsDir(), mod.path).split(path.sep).join("/");
  function renameCharacterMod(mod, nextName) {
    if (!SEGMENT.test(String(nextName || ""))) throw fail("invalidValue");
    const target = path.join(path.dirname(mod.path), nextName);
    if (fs.existsSync(target)) throw fail("modExists", { name: nextName });
    fs.renameSync(mod.path, target);
    notifyChanged();
    return { success: true, name: nextName, path: target };
  }
  // EFF accepts .png beside a Mod's resources and rejects other files it was not told about.
  function setCharacterModPreview(mod, pngBytes) {
    for (const name of fs.readdirSync(mod.path)) if (/^preview\.png$/i.test(name)) fs.rmSync(path.join(mod.path, name), { force: true });
    const file = path.join(mod.path, "preview.png");
    fs.writeFileSync(file, pngBytes);
    return file;
  }
  function isEffModDir(dir) {
    const own = path.join(dir, MOD_FILE);
    const ini = [own, ...DISABLED_SUFFIXES.map(suffix => own + suffix)].find(isFile);
    if (ini) return parseModIni(fs.readFileSync(ini, "utf8")).format !== null;
    return findMods(dir).some(mod => mod.format !== null);
  }
  // A Mod the importer extracted for EFMI moves to EFF's folder of that character when it is an EFF Mod.
  function adoptImported(characterName, dir, name) {
    if (!dir || !fs.existsSync(dir) || !isEffModDir(dir)) return null;
    if (!installed()) throw fail("importNeedsEff");
    const target = characterDir(characterName);
    fs.mkdirSync(target, { recursive: true });
    const folder = uniqueName(target, name || path.basename(dir));
    const destination = path.join(target, folder);
    try {
      fs.renameSync(dir, destination);
    } catch (error) {
      if (error.code !== "EXDEV") throw error;
      fs.cpSync(dir, destination, { recursive: true });
      fs.rmSync(dir, { recursive: true, force: true });
    }
    notifyChanged();
    return { name: folder, path: destination };
  }
  function unassignedMods() {
    if (!installed()) return [];
    const dir = modsDir();
    return fs.existsSync(dir) ? findMods(dir).filter(mod => !mod.id.includes("/")) : [];
  }
  return {
    characterMods,
    resolveCharacterMod,
    setCharacterModEnabled: (mod, enabled) => setModEnabled(relativeId(mod), enabled),
    removeCharacterMod: mod => removeMod(relativeId(mod)),
    renameCharacterMod,
    setCharacterModPreview,
    isEffModDir,
    adoptImported,
    unassignedMods,
    status,
    setInstalled,
    setEnabled,
    setChannel,
    checkUpdates,
    update,
    sync,
    prepareLaunch,
    listMods,
    setModEnabled,
    importMod,
    removeMod
  };
}
module.exports = {
  createEffService,
  loaderConfig,
  loaderDisabled,
  parseModIni,
  findMods,
  peVersion
};
