"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const electron = require("electron");
const i18n = require("../../../shared/i18n/core.cjs");
const files = require("./files.cjs");
const deployment = require("./deployment.cjs");
const settings = require("../settings.cjs");
const directories = require("../../characters/directories.cjs");
const hidden = require("../../characters/hidden.cjs");
const sourceComponent = require("./component.cjs");
const { getDataRoot } = require("../../runtime/data-paths.cjs");
const configStore = require("../../config/store.cjs");

const GAME = "arknights";
const BUILD_STATE = ".qaqr-build-state.json";
let lastSync = null;
let processing = false;
let pendingSync = false;
let lastSignature = "";
const reports = new Map();
const initializedLibraries = new Set();

function paths() {
  const game = settings.getGameById(GAME);
  const root = configStore.currentConfig.arknightsLegacyDataRoot || path.join(getDataRoot(), "Arknights");
  return { root, library: game?.modFolderPath || path.join(root, "Mods"), destination: path.join(root, "Resources"), bundleRoot: path.join(root, "PC-Bundles"), gamePath: game?.gamePath || "" };
}
function workerPath() { return sourceComponent.resolveFile("ArknightsTools/ArknightsTools.exe"); }
function characterIds(characterName) {
  const aliases = require("../../characters/catalog.cjs").getCharacterAliasCandidates(characterName, GAME);
  return [...new Set(aliases.flatMap(alias => String(alias).match(/char_\d+_[a-z0-9]+/gi) || []))];
}
function validateLibrary(library, gamePath = paths().gamePath) {
  if (!library || !path.isAbsolute(library)) throw Error(i18n.t("arknights.errors.invalidPath"));
  files.assertOutsideGame(library, gamePath);
  if (gamePath && files.inside(path.dirname(gamePath), library)) throw Error(i18n.t("arknights.errors.gameWrite"));
  const { destination, bundleRoot } = paths();
  if ([destination, bundleRoot].some(dir => files.inside(library, dir) || files.inside(dir, library))) throw Error(i18n.t("arknights.errors.overlap"));
  return library;
}
function initialize() {
  const p = paths();
  try {
    validateLibrary(p.library);
    fs.mkdirSync(p.library, { recursive: true });
    if (!initializedLibraries.has(p.library)) {
      directories.ensureDefaultCharacterFolders(p.library, GAME);
      initializedLibraries.add(p.library);
    }
  } catch (error) { lastSync = { success: false, error: error.message }; }
}
function enabledEntries(extra = null) {
  const p = paths();
  validateLibrary(p.library);
  if (!fs.existsSync(p.library)) return [];
  const entries = [];
  for (const character of directories.listCharacterDirectories(p.library, GAME)) {
    if (hidden.isCharacterHidden(character.displayName, GAME)) continue;
    files.assertNoLinks(character.characterRootPath);
    for (const mod of fs.readdirSync(character.characterRootPath, { withFileTypes: true })) {
      if (!mod.isDirectory() || files.DISABLED.test(mod.name) || mod.name.startsWith(".")) continue;
      entries.push({ path: path.join(character.characterRootPath, mod.name), name: `${character.displayName}/${mod.name}`, characterIds: characterIds(character.displayName) });
    }
  }
  if (extra && !entries.some(entry => entry.path === extra.path)) entries.push(extra);
  return entries.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
}
function conflictApprovals(extra = []) {
  const key = crypto.createHash("sha256").update(path.resolve(paths().library).toLowerCase()).digest("hex");
  const stored = configStore.currentConfig.arknightsConflictApprovals?.[key];
  return { key, ids: [...new Set([...(Array.isArray(stored) ? stored : []), ...extra])] };
}
function sync({ force = false, changedModPath = "", confirmedConflictIds = [] } = {}) {
  const p = paths();
  initialize();
  try {
    const entries = enabledEntries();
    const approvedConflictIds = conflictApprovals(confirmedConflictIds).ids;
    const planned = deployment.planDeployment(entries, { approvedConflictIds });
    const signature = JSON.stringify([p.library, p.destination, ...planned.map(entry => [entry.path, ...[...entry.resources, ...entry.manifests].map(file => [file.relative, file.size, file.mtimeMs])])]);
    if (!force && !changedModPath && lastSync?.success && signature === lastSignature && fs.existsSync(p.destination)) return lastSync;
    const { sources: _sources, approvedResourcePairs: _pairs, modOrder: _order, ...summary } = deployment.deploy({ ...p, entries, changedModPath, approvedConflictIds });
    lastSync = { success: true, ...summary };
    lastSignature = signature;
  } catch (error) {
    lastSync = { success: false, error: error.message };
    throw error;
  }
  return lastSync;
}
function onModsChanged(gameId) {
  if (gameId !== GAME) return null;
  if (processing) { pendingSync = true; return lastSync; }
  try { return sync(); } catch { return lastSync; }
}
function assertCanEnable(modPath, { characterName = "", confirmedConflictIds = [] } = {}) {
  characterName = directories.resolveCharacterEntry(characterName, GAME)?.displayName || characterName;
  deployment.planDeployment(enabledEntries({ path: modPath, name: (characterName ? characterName + "/" : "") + path.basename(modPath).replace(files.DISABLED, "") }), { approvedConflictIds: conflictApprovals(confirmedConflictIds).ids });
}
function prepareImportedMod(modPath) {
  const p = paths();
  validateLibrary(p.library);
  if (!files.inside(modPath, p.library)) throw Error(i18n.t("arknights.errors.invalidPath"));
  const report = files.inspect(modPath);
  if (report.kind === "unknown") throw Error(i18n.t("arknights.errors.noResources"));
  // Import into the normal QAQR library; only explicit enabling deploys resources.
  const destination = path.join(path.dirname(modPath), `DISABLED_${path.basename(modPath).replace(files.DISABLED, "")}`);
  if (destination !== modPath) files.renameDirectory(modPath, destination);
  // Nested archive wrappers are common. Give QAQR an ordinary preview file.
  const preview = report.resources.find(file => file.ext === ".png" && /(?:illust_|char_)/i.test(file.name));
  if (preview && !fs.existsSync(path.join(destination, "preview.png"))) fs.copyFileSync(path.join(destination, preview.relative), path.join(destination, "preview.png"));
  return destination;
}
function status() {
  const p = paths();
  return { success: true, ...p, ...sourceComponent.state(), sync: lastSync, migrationError: configStore.currentConfig.arknightsMigrationError || "" };
}
function generatedFingerprint(root) {
  return files.fingerprint(root, { maxBytes: 64 * 1024 * 1024 * 1024, maxFiles: 100000 });
}
function componentFingerprint() {
  return crypto.createHash("sha256").update(JSON.stringify(sourceComponent.packageInfo().manifest)).digest("hex");
}
async function prepareLoader() {
  const p = paths();
  if (!p.gamePath || !/^Arknights\.exe$/i.test(path.basename(p.gamePath)) || !fs.existsSync(p.gamePath)) throw Error(i18n.t("arknights.errors.gameMissing"));
  if ((await sourceComponent.runNative(["--status"])).running) throw Error(i18n.t("arknights.errors.gameRunning"));
  sync();
  const fingerprint = generatedFingerprint(p.destination);
  const componentHash = componentFingerprint();
  const stage = path.join(p.root, `bundle-build-${crypto.randomUUID()}`);
  const previous = path.join(p.root, "PC-Bundles.previous");
  files.assertOutsideGame(stage, p.gamePath);
  files.assertOutsideGame(p.bundleRoot, p.gamePath);
  files.assertOutsideGame(previous, p.gamePath);
  for (const dir of [p.bundleRoot, previous]) if (fs.existsSync(dir) && !fs.existsSync(path.join(dir, ".qaqr-generated"))) throw Error(i18n.t("arknights.errors.unowned"));
  const cacheFile = path.join(p.bundleRoot, BUILD_STATE);
  if (fs.existsSync(cacheFile)) {
    try {
      files.assertNoLinks(cacheFile);
      const cached = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
      if (cached.schemaVersion === 1 && cached.resourceFingerprint === fingerprint && cached.componentFingerprint === componentHash && cached.gamePath === p.gamePath) {
        const manifest = path.join(p.bundleRoot, "manifest.tsv");
        await sourceComponent.runNative(["--check", "--manifest", manifest]);
        return { success: true, path: sourceComponent.resolveFile("loader/ArkLoader.exe"), manifest, bundleCount: cached.bundleCount, resourceCount: cached.resourceCount, experimental: true, cached: true };
      }
    } catch { /* A stale cache is rebuilt from current PC originals. */ }
  }
  let moved = false;
  try {
    const built = await runWorker({ action: "build-bundles", source: p.destination, gamePath: p.gamePath, output: stage, characterIds: [...new Set(enabledEntries().flatMap(entry => entry.characterIds || []))] });
    if (generatedFingerprint(p.destination) !== fingerprint) throw Error(i18n.t("arknights.errors.changed"));
    await sourceComponent.runNative(["--check", "--manifest", path.join(stage, "manifest.tsv")]);
    fs.writeFileSync(path.join(stage, "bundle-index.json"), JSON.stringify({ schemaVersion: 1, bundles: built.bundles }));
    fs.writeFileSync(path.join(stage, ".qaqr-generated"), "arknights-bundles-v1");
    fs.writeFileSync(path.join(stage, BUILD_STATE), JSON.stringify({ schemaVersion: 1, resourceFingerprint: fingerprint, componentFingerprint: componentHash, gamePath: p.gamePath, bundleCount: built.bundleCount, resourceCount: built.resourceCount }));
    if (fs.existsSync(previous)) fs.rmSync(previous, { recursive: true });
    if (fs.existsSync(p.bundleRoot)) { files.renameDirectory(p.bundleRoot, previous); moved = true; }
    files.renameDirectory(stage, p.bundleRoot);
    return { success: true, path: sourceComponent.resolveFile("loader/ArkLoader.exe"), manifest: path.join(p.bundleRoot, "manifest.tsv"), bundleCount: built.bundleCount, resourceCount: built.resourceCount, experimental: true };
  } catch (error) {
    if (moved && !fs.existsSync(p.bundleRoot)) files.renameDirectory(previous, p.bundleRoot);
    throw error;
  } finally {
    if (fs.existsSync(stage)) fs.rmSync(stage, { recursive: true, force: true });
  }
}
async function launch() {
  if (processing) throw Error(i18n.t("arknights.errors.busy"));
  processing = true;
  try {
    const prepared = await prepareLoader();
    const result = await sourceComponent.runNative(["--launch", "--manifest", prepared.manifest]);
    return result;
  } finally { finishProcessing(); }
}
function runWorker(payload) {
  const executable = workerPath();
  if (!executable) return Promise.reject(Error(i18n.t("arknights.errors.workerMissing")));
  return new Promise((resolve, reject) => {
    const child = spawn(executable, [], { windowsHide: true, shell: false, cwd: path.dirname(executable), stdio: ["pipe", "pipe", "pipe"] });
    const chunks = [];
    let stderr = "";
    let size = 0;
    let failed = false;
    const fail = error => { if (!failed) { failed = true; clearTimeout(timeout); child.kill(); reject(error); } };
    const timeout = setTimeout(() => fail(Error(i18n.t("arknights.errors.timeout"))), payload.action === "build-bundles" ? 60 * 60 * 1000 : 180000);
    child.on("error", fail);
    child.stdin.on("error", fail);
    child.stderr.on("data", chunk => { stderr = (stderr + chunk.toString("utf8")).slice(-16384); });
    child.stdout.on("data", chunk => { size += chunk.length; if (size > 8 * 1024 * 1024) fail(Error(i18n.t("arknights.errors.tooLarge"))); else chunks.push(chunk); });
    child.on("close", code => {
      clearTimeout(timeout);
      if (failed) return;
      try {
        const output = Buffer.concat(chunks).toString("utf8");
        if (!output.trim()) {
          const missing = stderr.match(/ModuleNotFoundError: No module named ['"]([^'"]+)['"]/);
          throw Error(missing ? i18n.t("arknights.errors.workerDependencyMissing", { name: missing[1] }) : i18n.t("arknights.errors.workerExited", { code: code ?? "?" }));
        }
        const result = JSON.parse(output);
        if (code || !result.success) throw Error(result.error || i18n.t("arknights.errors.workerFailed"));
        resolve(result);
      } catch (error) { reject(error); }
    });
    child.stdin.end(JSON.stringify(payload));
  });
}
function resolveMod(characterName, modName) {
  const skins = require("../../characters/skins.cjs");
  characterName = skins.assertSafeAppearancePathSegment(characterName, i18n.t("backend.validation.characterName"));
  modName = skins.assertSafeAppearancePathSegment(modName, i18n.t("backend.validation.modName"));
  const modPath = directories.resolveExistingStandardModDirectory(characterName, modName, GAME);
  const resolved = typeof modPath === "string" ? modPath : modPath?.modPath || modPath?.path;
  if (!resolved || !fs.existsSync(resolved) || !files.inside(resolved, paths().library)) throw Error(i18n.t("arknights.errors.modMissing"));
  files.assertOutsideGame(resolved, paths().gamePath);
  return resolved;
}
const reloadMod = require("./reload.cjs").createModReloader({ paths, resolveMod, characterIds, sync, runNative: args => sourceComponent.runNative(args), runWorker });
const cursorService = require("./cursor.cjs").createCursorService({ getGamePath: () => paths().gamePath, getStateRoot: () => path.join(paths().root, "SystemCursor") });
async function toggleMod({ characterName, modName, enable, autoReload = true, confirmedConflictIds = [] }) {
  if (processing) return { success: false, error: i18n.t("arknights.errors.busy") };
  processing = true;
  try {
    if (typeof enable !== "boolean") throw Error(i18n.t("arknights.errors.invalidPath"));
    const current = resolveMod(characterName, modName);
    if (enable) hidden.assertCharacterVisible(characterName, GAME);
    const cleanName = path.basename(current).replace(files.DISABLED, "");
    const target = path.join(path.dirname(current), enable ? cleanName : "DISABLED_" + cleanName);
    if (current === target) return { success: true, autoReloaded: false, alreadyInState: true };
    if (fs.existsSync(target)) throw Error(i18n.t("arknights.errors.invalidPath"));
    if (enable) assertCanEnable(current, { characterName, confirmedConflictIds });
    files.renameDirectory(current, target);
    const previousApprovals = configStore.currentConfig.arknightsConflictApprovals;
    try {
      sync({ confirmedConflictIds });
      if (enable && confirmedConflictIds.length) {
        const approvals = conflictApprovals(confirmedConflictIds);
        configStore.currentConfig.arknightsConflictApprovals = { ...previousApprovals, [approvals.key]: approvals.ids };
        if (!configStore.saveConfig(configStore.currentConfig)) throw Error(i18n.t("arknights.errors.approvalSave"));
      }
    } catch (error) {
      if (previousApprovals === undefined) delete configStore.currentConfig.arknightsConflictApprovals;
      else configStore.currentConfig.arknightsConflictApprovals = previousApprovals;
      files.renameDirectory(target, current);
      try { sync(); } catch { /* Preserve the original error and the user's library state. */ }
      throw error;
    }
    let reload;
    try { reload = autoReload ? await reloadMod({ characterName, modName: cleanName, optional: true }) : { autoReloaded: false }; }
    catch (error) { reload = { autoReloaded: false, reloadError: error.message }; }
    require("../../mods/conflicts.cjs").clearConflictCache(characterName, GAME);
    require("../../desktop/notifications.cjs").notifyCharacterListChanged(characterName, { gameId: GAME, modName: cleanName, reason: "toggle", resourcesChanged: false });
    return { success: true, persistRestored: false, ...reload };
  } catch (error) { return { success: false, error: error.message }; }
  finally { finishProcessing(); }
}
function finishProcessing() {
  processing = false;
  if (pendingSync) { pendingSync = false; onModsChanged(GAME); }
}
async function analyze({ characterName, modName }) {
  const source = resolveMod(characterName, modName);
  const fingerprint = files.fingerprint(source);
  const ids = characterIds(characterName);
  const result = await runWorker({ source, gamePath: paths().gamePath, characterIds: ids });
  if (files.fingerprint(source) !== fingerprint) throw Error(i18n.t("arknights.errors.changed"));
  const token = crypto.randomUUID();
  if (reports.size >= 16) reports.delete(reports.keys().next().value);
  reports.set(token, { source, fingerprint, characterName, modName, characterIds: ids, gamePath: paths().gamePath, at: Date.now(), result });
  const sections = require("../../characters/skins.cjs").getMergedAppearanceSectionDefinitions(characterName, GAME);
  const classify = require("./appearance.cjs").classifyResources;
  return { ...result, plans: result.plans.map(plan => ({ ...plan, appearanceSectionId: classify([plan], sections).sectionId })), sections: sections.map(section => ({ id: section.sectionId, name: section.nameZh || section.name })), token, collisions: files.inspect(source).collisions };
}
async function createCopy({ token, selectedIds }) {
  const report = reports.get(token);
  if (!report || Date.now() - report.at > 30 * 60 * 1000) throw Error(i18n.t("arknights.errors.changed"));
  if (report.result.kind === "bundle" && !Array.isArray(selectedIds)) throw Error(i18n.t("arknights.errors.selectionRequired"));
  if (selectedIds !== undefined && (!Array.isArray(selectedIds) || !selectedIds.length || selectedIds.some(id => !report.result.plans.some(plan => plan.id === id)))) throw Error(i18n.t("arknights.errors.selectionRequired"));
  const source = resolveMod(report.characterName, report.modName);
  if (source !== report.source || paths().gamePath !== report.gamePath || files.fingerprint(source) !== report.fingerprint) throw Error(i18n.t("arknights.errors.changed"));
  hidden.assertCharacterVisible(report.characterName, GAME);
  const suffix = report.result.kind === "bundle" ? "PC" : "Repaired";
  let target;
  for (let index = 0; index < 1000; index++) {
    const name = `${report.modName} (${suffix}${index ? ` ${index + 1}` : ""})`;
    const enabled = path.join(path.dirname(source), name);
    const disabled = path.join(path.dirname(source), `DISABLED_${name}`);
    if (!fs.existsSync(enabled) && !fs.existsSync(disabled)) { target = disabled; break; }
  }
  if (!target) throw Error(i18n.t("arknights.errors.tooLarge"));
  const stage = path.join(paths().root, `conversion-${crypto.randomUUID()}`);
  files.assertOutsideGame(stage, paths().gamePath);
  try {
    const result = await runWorker({ source, gamePath: report.gamePath, output: stage, selectedIds, characterIds: report.characterIds });
    if (files.fingerprint(source) !== report.fingerprint) throw Error(i18n.t("arknights.errors.changed"));
    if (result.baselineFingerprint !== report.result.baselineFingerprint || JSON.stringify(result.plans) !== JSON.stringify(report.result.plans)) throw Error(i18n.t("arknights.errors.changed"));
    files.assertLoadable(stage);
    for (const name of ["tags.json", "preview.png", "preview.jpg", "preview.webp"]) if (fs.existsSync(path.join(source, name))) {
      files.assertNoLinks(path.join(source, name));
      fs.copyFileSync(path.join(source, name), path.join(stage, name));
    }
    // Keep author notes and licenses with the copy, outside deployed resources.
    for (const entry of fs.readdirSync(source, { recursive: true, withFileTypes: true })) {
      if (!entry.isFile() || !/^(?:readme|licen[cs]e|copying)(?:\.|$)/i.test(entry.name)) continue;
      const from = path.join(entry.parentPath, entry.name);
      files.assertNoLinks(from);
      const to = path.join(stage, ".qaqr-original-docs", path.relative(source, from));
      fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(from, to);
    }
    const selected = result.plans.filter(plan => !selectedIds || selectedIds.includes(plan.id));
    fs.writeFileSync(path.join(stage, ".qaqr-conversion.json"), JSON.stringify({ schemaVersion: 1, kind: result.kind, plans: selected, warnings: result.warnings, sourceSha256: report.fingerprint }, null, 2));
    const appearances = require("../../characters/skins.cjs").getOfficialAppearanceSections(report.characterName, GAME);
    const scope = require("./appearance.cjs").classifyResources(selected, appearances);
    require("../../mods/appearance.cjs").writeModAppearanceSectionMetadata(stage, report.characterName, scope.sectionId, { gameId: GAME, source: "arknights-resources" });
    require("../../system/files.cjs").moveDirectoryWithFallback(stage, target);
    reports.delete(token);
    require("../../desktop/notifications.cjs").notifyCharacterListChanged(report.characterName, { gameId: GAME, reason: "arknights-copy" });
    return { success: true, modName: path.basename(target).replace(/^DISABLED_/, ""), path: target, count: result.written, scope, warnings: result.warnings };
  } finally {
    if (fs.existsSync(stage)) fs.rmSync(stage, { recursive: true, force: true });
  }
}
function registerIpc() {
  electron.ipcMain.handle("arknights:cursor-status", async () => {
    try { return await cursorService.status(); }
    catch (error) { return { success: false, error: error.message }; }
  });
  for (const [channel, action] of Object.entries({
    "arknights:status": status,
    "arknights:sync": () => sync({ force: true }),
    "arknights:prepare-loader": prepareLoader,
    "arknights:reload-mod": reloadMod,
    "arknights:set-system-cursor": args => cursorService.setEnabled(args),
    "arknights:analyze": analyze,
    "arknights:create-copy": createCopy
  })) electron.ipcMain.handle(channel, async (_, args) => {
    if (channel === "arknights:status") return status();
    if (processing) return { success: false, error: i18n.t("arknights.errors.busy") };
    processing = true;
    try { return await action(args || {}); }
    catch (error) { return { success: false, error: error.message }; }
    finally { finishProcessing(); }
  });
}

module.exports = { GAME, paths, enabledEntries, generatedFingerprint, componentFingerprint, validateLibrary, initialize, status, sync, onModsChanged, assertCanEnable, prepareImportedMod, prepareLoader, launch, runWorker, toggleMod, registerIpc };
