"use strict";

const i18n = require("../../../shared/i18n/core.cjs");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { readJsonFileSync, writeJsonFileSync } = require("../../core/json-store.cjs");
const { loadBundle, replaceFiles } = require("../../install/mi-forks.cjs");
const { PROXIES, PLUGIN_FILES, SETTINGS_FILE, PROXY_MARK } = require("./eff-packages.cjs");
const { stageLegacyFiles } = require("./eff-storage.cjs");
const { getLoaderDataRoot } = require("../../runtime/data-paths.cjs");
const EXTERNAL_MARK = Buffer.from("EFF_ExternalData_v1");
const LOADER = "EFFLoader.exe";
const RUNTIME = "plugin/eff.dll";
const LOADER_CONFIG = "plugin/applepie_manager_config.txt";
const LEGACY_MODS = "plugin/mods";
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
  storageRoot = getLoaderDataRoot("EFF"),
  stateFile = path.join(storageRoot, "state.json"),
  legacyStateFile,
  backupDir = path.join(storageRoot, "backup"),
  legacyBackupDir,
  startLoader,
  trash,
  extract,
  notifyChanged = () => {}
}) {
  storageRoot = path.resolve(storageRoot);
  let busy = false;
  const at = name => path.join(storageRoot, name);
  const roots = () => typeof bundleRoots === "function" ? bundleRoots() : bundleRoots;
  const tryFork = () => {
    try {
      const bundle = loadBundle(roots(), "eff", "EFF");
      return bundle.files[RUNTIME] && bundle.files[LOADER] && read(bundle.files[RUNTIME])?.includes(EXTERNAL_MARK) ? bundle : null;
    } catch { return null; }
  };
  function readState() {
    for (const file of [stateFile, legacyStateFile].filter(Boolean)) {
      try {
        const saved = readJsonFileSync(file);
        if (saved && typeof saved.games === "object") return saved;
      } catch { /* No saved installation yet. */ }
    }
    return { games: {} };
  }
  const gameKey = root => hash(Buffer.from(path.resolve(root).toLowerCase())).slice(0, 16);
  function record(root, change) {
    const state = readState(), key = gameKey(root);
    state.games[key] = change({ ...(state.games[key] || {}), root });
    writeJsonFileSync(stateFile, state);
  }
  function gameRoot() {
    const gamePath = resolveGame()?.gamePath || "";
    const root = isFile(gamePath) ? path.dirname(gamePath) : "";
    if (root && (storageRoot.toLowerCase() === root.toLowerCase() || storageRoot.toLowerCase().startsWith(root.toLowerCase() + path.sep))) throw fail("dataInsideGame");
    return { gamePath, root };
  }
  function legacy(root) {
    if (!root) return false;
    return [RUNTIME, LEGACY_MODS, SETTINGS_FILE, ...PROXIES].some(name => {
      const file = path.join(root, name);
      return PROXIES.includes(name) ? isProxy(read(file)) : fs.existsSync(file);
    });
  }
  function inspect(root) {
    const runtime = read(at("eff.dll")), fork = tryFork();
    const saved = root ? readState().games[gameKey(root)] || {} : {};
    const current = runtime ? hash(runtime) : null;
    const channel = !runtime ? null : fork && hash(read(fork.files[RUNTIME])) === current ? "fork"
      : saved.installed?.sha256 === current ? saved.installed.channel : "other";
    return { installed: !!runtime, enabled: !!runtime && !fs.existsSync(at("disabled")),
      external: !!runtime?.includes(EXTERNAL_MARK), version: peVersion(runtime), channel, saved, fork };
  }
  async function status() {
    const { gamePath, root } = gameRoot(), local = inspect(root), pending = legacy(root);
    const checks = [];
    const check = (id, title, ok, message) => checks.push({ id, title, ok: !!ok, message });
    check("game", i18n.t("backend.eff.gameTitle"), !!root, root ? gamePath : i18n.t("backend.eff.gameRequired"));
    check("storage", i18n.t("backend.eff.storageTitle"), !pending, i18n.t(pending ? "backend.eff.migrationPending" : "backend.eff.storageReady", { path: storageRoot }));
    if (local.installed) {
      check("loader", i18n.t("backend.eff.loaderTitle"), local.external && isFile(at(LOADER)), i18n.t(local.external && isFile(at(LOADER)) ? "backend.eff.externalLoader" : "backend.eff.externalRequired"));
      if (efmiVulkanActive()) check("backend", i18n.t("backend.eff.backendTitle"), false, i18n.t("backend.eff.backendVulkan"));
    }
    let loaderStatus = null;
    try { loaderStatus = readJsonFileSync(at("loader-status.json")); } catch { /* No launch yet. */ }
    if (local.enabled && ["error", "timeout"].includes(loaderStatus?.state)) check("lastLaunch", i18n.t("backend.eff.loaderTitle"), false, i18n.t("backend.eff.loaderFailed", { code: loaderStatus.error }));
    return { success: true, installed: local.installed, enabled: local.enabled, version: local.version,
      channel: local.channel, ready: checks.every(item => item.ok), checks, migrationPending: pending,
      otherPlugins: [], unassignedMods: local.installed ? unassignedMods().map(mod => mod.id) : [],
      sources: { official: { version: packages.selected().version, externalData: false },
        fork: local.fork ? { version: local.fork.manifest.version || null, build: local.fork.manifest.sourceCommit.slice(0, 12), localBuild: !!local.fork.manifest.localBuild } : null },
      updates: packages.state(), paths: { game: root, plugin: storageRoot, mods: modsDir() }, loaderStatus };
  }
  async function locked(action) {
    if (busy) throw fail("operationInProgress");
    busy = true;
    try { const result = await action(); notifyChanged(); return result; }
    finally { busy = false; }
  }
  function requireGame() {
    const { root } = gameRoot();
    if (!root) throw fail("gameRequired");
    return root;
  }
  function restoreProxy(root, name, backups) {
    // A compiler shipped with the game must never disappear just because its backup is missing.
    if (!backups[name]) {
      if (name === PROXIES[0]) throw fail("backupInvalid", { name });
      return null;
    }
    for (const directory of [backupDir, legacyBackupDir].filter(Boolean)) {
      const file = path.join(directory, gameKey(root), name), bytes = read(file);
      if (bytes && hash(bytes) === backups[name]) return bytes;
    }
    throw fail("backupInvalid", { name });
  }
  function migration(root) {
    if (!legacy(root)) return () => {};
    const plugin = path.join(root, "plugin"), saved = readState().games[gameKey(root)] || {};
    const backups = saved.backups || {};
    const plans = PROXIES.filter(name => isProxy(read(path.join(root, name)))).map(name => ({ relative: name, bytes: restoreProxy(root, name, backups) }));
    const others = fs.existsSync(plugin) ? fs.readdirSync(plugin).filter(name => /\.dll$/i.test(name) && name.toLowerCase() !== "eff.dll") : [];
    if (others.length && plans.length) throw fail("legacyOtherPlugins", { names: others.join(", ") });
    const archive = path.join(storageRoot, "Legacy", gameKey(root));
    const destinations = { mods: modsDir(), "eff.ini": at("eff.ini"), "eff_log.txt": at("eff_log.txt") };
    for (const name of ["resource-input-diagnostics", "resource-adaptation-probe", "resource-reload-cache", "resource-export-staging", "catalog-survey.json"]) destinations[name] = at(name);
    for (const name of PLUGIN_FILES) destinations[path.basename(name)] = path.join(archive, path.basename(name));
    const loader = path.join(root, LOADER_CONFIG), before = read(loader)?.toString("utf8");
    if (before !== undefined) destinations[path.basename(LOADER_CONFIG)] = path.join(archive, path.basename(LOADER_CONFIG));
    const clean = stageLegacyFiles(plugin, destinations);
    return () => {
      replaceFiles(root, plans);
      clean();
      // A shared configuration belongs to the remaining plugins. Only the EFF switch is removed.
      const remaining = before === undefined ? "" : loaderConfig(before, true);
      if (remaining) replaceFiles(root, [{ relative: LOADER_CONFIG, bytes: Buffer.from(remaining) }]);
    };
  }
  function enabledMarker(enabled) {
    fs.mkdirSync(storageRoot, { recursive: true });
    if (enabled) fs.rmSync(at("disabled"), { force: true });
    else fs.writeFileSync(at("disabled"), "EFF is disabled by QAQR.\n");
  }
  function cancelLaunch() { fs.rmSync(at(".launch-request"), { force: true }); }
  async function install(channel = "fork", info) {
    const root = requireGame(), local = inspect(root);
    const fork = tryFork();
    if (!fork) throw fail("forkMissing");
    const files = channel === "fork" ? new Map(Object.keys(fork.files).map(name => [name, read(fork.files[name])])) : await packages.ensure(info);
    if (!files.get(RUNTIME)?.includes(EXTERNAL_MARK)) throw fail("externalRequired");
    await assertStopped();
    cancelLaunch();
    const enabled = local.installed ? local.enabled : !loaderDisabled(read(path.join(root, LOADER_CONFIG))?.toString("utf8"));
    const clean = migration(root);
    fs.mkdirSync(modsDir(), { recursive: true });
    const plans = PLUGIN_FILES.filter(name => files.has(name)).map(name => ({ relative: path.basename(name), bytes: files.get(name) }));
    plans.push({ relative: LOADER, bytes: read(fork.files[LOADER]) });
    if (files.has(SETTINGS_FILE) && !isFile(at("eff.ini"))) plans.push({ relative: "eff.ini", bytes: files.get(SETTINGS_FILE) });
    replaceFiles(storageRoot, plans);
    enabledMarker(enabled);
    const version = channel === "fork" ? fork.manifest.version : (info || packages.selected()).version;
    record(root, saved => ({ ...saved, installed: { sha256: hash(files.get(RUNTIME)), channel, version } }));
    clean();
    return { success: true, channel, restartRequired: true };
  }
  async function uninstall() {
    const root = requireGame();
    await assertStopped();
    cancelLaunch();
    const clean = migration(root);
    clean();
    replaceFiles(storageRoot, [...PLUGIN_FILES.map(name => path.basename(name)), LOADER].filter(name => isFile(at(name))).map(relative => ({ relative, bytes: null })));
    record(root, saved => { delete saved.installed; return saved; });
    return { success: true, restartRequired: true };
  }
  async function syncStorage() {
    const { root } = gameRoot();
    if (!root || !legacy(root)) return { changed: false };
    // Legacy EFF cannot run outside the game, so migration installs the compatible fork.
    if (isFile(path.join(root, RUNTIME)) || installed()) await install("fork");
    else { await assertStopped(); migration(root)(); }
    return { changed: true };
  }
  const sync = () => locked(syncStorage);
  const setInstalled = installed => locked(() => installed ? install() : uninstall());
  const setEnabled = enabled => locked(async () => {
    if (typeof enabled !== "boolean") throw fail("invalidValue");
    await syncStorage();
    if (!installed()) throw fail("notInstalled");
    cancelLaunch();
    enabledMarker(enabled);
    return { success: true, enabled, restartRequired: true };
  });
  const setChannel = target => locked(async () => {
    if (!["official", "fork"].includes(target)) throw fail("invalidValue");
    if (!installed() && !legacy(requireGame())) throw fail("notInstalled");
    return install(target);
  });
  const checkUpdates = () => locked(async () => { await packages.checkUpdates(); return status(); });
  const update = () => locked(async () => {
    const info = packages.pending();
    if (!packages.state().updateAvailable || !info) throw fail("alreadyCurrent");
    await packages.ensure(info);
    if (inspect(gameRoot().root).channel === "official") await install("official", info);
    packages.commit(info);
    return status();
  });
  async function prepareLaunch() {
    return locked(async () => {
      const result = await syncStorage();
      const { root } = gameRoot(), local = inspect(root);
      if (!local.enabled) return result;
      requireGame();
      if (!local.external || !isFile(at(LOADER)) || !startLoader) throw fail("externalRequired");
      await assertStopped();
      const request = crypto.randomUUID();
      fs.writeFileSync(at(".launch-request"), request);
      try { await startLoader({ executable: at(LOADER), gamePath: gameRoot().gamePath, dll: at("eff.dll"), request, storageRoot }); }
      catch (error) { cancelLaunch(); throw error; }
      return { ...result, watching: true };
    });
  }
  function modsDir() { return at("Mods"); }
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
  // Imports are staged beside Mods under data/EFF, then published once validated.
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
  // The Mods page keeps EFF Mods per character as data/EFF/Mods/<character>/<Mod>, as EFMI keeps Mods/<character>/<Mod>;
  // EFF finds them there on its own.
  const SEGMENT = /^(?!\.)[^<>:"/\\|?*\u0000-\u001f]+(?<![. ])$/;
  function characterDir(characterName) {
    if (!SEGMENT.test(String(characterName || ""))) throw fail("modMissing");
    return path.join(modsDir(), characterName);
  }
  function installed() {
    return isFile(at("eff.dll"));
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
    cancelLaunch,
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
