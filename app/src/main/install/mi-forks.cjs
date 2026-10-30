"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const os = require("node:os");
const i18n = require("../../shared/i18n/core.cjs");
const SUPPORTED = { endfield: "EFMI", "wuthering-waves": "WWMI", "genshin-impact": "GIMI" };
const EFMI_FILES = ["Core/EFMI/MergedSkeleton.ini", "Core/EFMI/Shaders/MergedSkeleton_InstanceConfigOverrider_ConstantBuffer.hlsl", "Core/EFMI/Shaders/MergedSkeleton_InstanceConfigOverrider_ConstantBuffer.cs_5_0.8000.bin"];
const hash = value => crypto.createHash("sha256").update(value).digest("hex");
const fileHash = file => fs.existsSync(file) ? hash(fs.readFileSync(file)) : null;
const error = (code, values) => Object.assign(Error(i18n.t(`settings.mi.fork.${code}`, values)), { code });
function plain(file) {
  for (let current = path.resolve(file); current !== path.dirname(current); current = path.dirname(current)) if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw error("invalidBundle");
}
function writeAtomic(file, bytes) {
  plain(file);
  if (bytes === null) { if (fs.existsSync(file)) fs.unlinkSync(file); return; }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = file + ".qaqr-update-" + crypto.randomUUID();
  try { fs.writeFileSync(temporary, bytes); fs.renameSync(temporary, file); }
  finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}
function json(file, value) { writeAtomic(file, value === null ? null : Buffer.from(JSON.stringify(value, null, 2) + "\n")); }
function loadBundle(roots, name, repository) {
  const directory = roots.map(root => path.join(root, "local-components", name)).find(root => fs.existsSync(path.join(root, "component.json")));
  if (!directory) throw error("bundleMissing");
  plain(directory);
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, "component.json"), "utf8"));
  if (manifest.source !== `https://github.com/QAQ-Revival/${repository}` || !/^[a-f0-9]{40}$/.test(manifest.sourceCommit || "") || !manifest.files) throw error("invalidBundle");
  const files = {};
  for (const [relative, digest] of Object.entries(manifest.files)) {
    const file = path.resolve(directory, relative);
    if (!file.startsWith(directory + path.sep) || !/^[a-f0-9]{64}$/.test(digest)) throw error("invalidBundle");
    plain(file);
    if (fileHash(file) !== digest) throw error("invalidBundle");
    files[relative] = file;
  }
  return { manifest, files };
}
function hasUnsafeApproval(launcherRoot, importer, userName = os.userInfo().username) {
  try {
    const config = JSON.parse(fs.readFileSync(path.join(launcherRoot, "XXMI Launcher Config.json"), "utf8").replace(/^\uFEFF/, ""));
    const settings = config.Importers?.[importer]?.Migoto;
    if (settings?.unsafe_mode !== true || typeof settings.unsafe_mode_signature !== "string") return false;
    // Verify the Launcher's saved consent with its public key; never read its private key.
    const publicKey = Buffer.from(fs.readFileSync(path.join(launcherRoot, "Resources/Security/public_key.der"), "utf8").trim(), "base64");
    return crypto.verify("sha256", Buffer.from(userName), { key: publicKey, type: "spki", format: "der" }, Buffer.from(settings.unsafe_mode_signature, "base64"));
  } catch { return false; }
}

function createMiForksService({ bundleRoots, resolveInstallation, backupRoot, userName } = {}) {
  function context(gameId) {
    const importer = SUPPORTED[gameId];
    if (!Object.hasOwn(SUPPORTED, gameId)) throw error("unsupported");
    const installation = resolveInstallation(gameId);
    if (!installation?.miRoot || !installation.launcherRoot) throw error("notInitialized");
    const root = path.resolve(installation.miRoot);
    plain(root);
    if (!fs.existsSync(path.join(root, "d3dx.ini")) || !fs.existsSync(path.join(root, "d3d11.dll"))) throw error("notInitialized");
    const directory = path.resolve(typeof backupRoot === "function" ? backupRoot() : backupRoot, importer + "-" + hash(root.toLowerCase()).slice(0, 16));
    if (directory === root || directory.startsWith(root + path.sep)) throw error("invalidBundle");
    plain(directory);
    return { gameId, importer, root, launcherRoot: installation.launcherRoot, directory, stateFile: path.join(directory, "state.json"), pendingFile: path.join(directory, "pending.json"), allowed: new Set(["d3d11.dll", ...(importer === "EFMI" ? EFMI_FILES : [])]) };
  }
  function readState(ctx, pending = false) {
    const file = pending ? ctx.pendingFile : ctx.stateFile;
    if (!fs.existsSync(file)) return null;
    const value = JSON.parse(fs.readFileSync(file, "utf8"));
    if (value.schema !== 1 || value.root !== ctx.root || value.gameId !== ctx.gameId || !Array.isArray(value.files) || value.files.length < 1 || value.files.length > 4 || new Set(value.files.map(file => file.relative)).size !== value.files.length || value.files.some(file => !ctx.allowed.has(file.relative))) throw error("invalidBackup");
    return value;
  }
  function savedFile(ctx, reference) {
    if (!reference || !/^[a-f0-9-]{36}$/.test(reference.operation) || !/^[0-3]\.bin$/.test(reference.file)) throw error("invalidBackup");
    const file = path.join(ctx.directory, "operations", reference.operation, reference.file);
    plain(file);
    return file;
  }
  function readBackup(ctx, reference, digest) {
    if (digest === null) return null;
    if (!/^[a-f0-9]{64}$/.test(digest)) throw error("invalidBackup");
    const bytes = fs.readFileSync(savedFile(ctx, reference));
    if (hash(bytes) !== digest) throw error("invalidBackup");
    return bytes;
  }
  function recover(ctx) {
    const pending = readState(ctx, true);
    if (!pending) return false;
    const files = pending.files.map(file => ({ ...file, target: path.join(ctx.root, file.relative), bytes: readBackup(ctx, file.before, file.beforeHash) }));
    for (const file of files) if (![file.beforeHash, file.afterHash].includes(fileHash(file.target))) throw error("modified");
    for (const file of files.reverse()) if (fileHash(file.target) !== file.beforeHash) { writeAtomic(file.target, file.bytes); if (fileHash(file.target) !== file.beforeHash) throw error("recoveryRequired", { path: ctx.directory }); }
    json(ctx.stateFile, pending.previousState);
    fs.unlinkSync(ctx.pendingFile);
    return true;
  }
  function transaction(ctx, plans, previousState, makeState) {
    if (fs.existsSync(ctx.pendingFile)) throw error("recoveryRequired", { path: ctx.directory });
    const operation = crypto.randomUUID();
    const operationRoot = path.join(ctx.directory, "operations", operation);
    fs.mkdirSync(operationRoot, { recursive: true });
    const files = plans.map((plan, index) => {
      const target = path.join(ctx.root, plan.relative);
      plain(target);
      const beforeHash = fileHash(target);
      if (beforeHash !== plan.expected) throw error("modified");
      const before = { operation, file: index + ".bin" };
      if (beforeHash !== null) {
        fs.copyFileSync(target, savedFile(ctx, before));
        if (fileHash(savedFile(ctx, before)) !== beforeHash) throw error("invalidBackup");
      }
      return { relative: plan.relative, before, beforeHash, afterHash: plan.bytes === null ? null : hash(plan.bytes) };
    });
    json(ctx.pendingFile, { schema: 1, root: ctx.root, gameId: ctx.gameId, files, previousState });
    try {
      for (let index = 0; index < plans.length; index++) {
        const file = files[index], target = path.join(ctx.root, file.relative);
        if (fileHash(target) !== file.beforeHash) throw error("modified");
        if (file.beforeHash !== file.afterHash) writeAtomic(target, plans[index].bytes);
        if (fileHash(target) !== file.afterHash) throw error("writeFailed");
      }
      json(ctx.stateFile, makeState(files));
      fs.unlinkSync(ctx.pendingFile);
    } catch (failure) {
      try { recover(ctx); } catch { throw error("recoveryRequired", { path: ctx.directory }); }
      throw failure;
    }
    return { success: true, backup: ctx.directory, restartRequired: true };
  }
  function candidates(ctx) {
    const roots = typeof bundleRoots === "function" ? bundleRoots() : bundleRoots;
    const runtime = loadBundle(roots, "xxmi-runtime", "XXMI-Libs-Package");
    if (runtime.manifest.activityProtocol !== 1 || !runtime.files["d3d11.dll"] || !Array.isArray(runtime.manifest.compatibleRuntimeHashes)) throw error("invalidBundle");
    const result = [{ relative: "d3d11.dll", source: runtime.files["d3d11.dll"], accepted: runtime.manifest.compatibleRuntimeHashes }];
    let core;
    if (ctx.importer === "EFMI") {
      core = loadBundle(roots, "efmi-core", "EFMI-Package");
      for (const relative of EFMI_FILES) {
        if (!core.files[relative] || !Array.isArray(core.manifest.compatibleFiles?.[relative])) throw error("invalidBundle");
        result.push({ relative, source: core.files[relative], accepted: core.manifest.compatibleFiles[relative] });
      }
    }
    return { files: result, runtime: runtime.manifest.sourceCommit, core: core?.manifest.sourceCommit || null };
  }
  function status(gameId) {
    if (!Object.hasOwn(SUPPORTED, gameId)) return { supported: false };
    try {
      const ctx = context(gameId), state = readState(ctx), pending = readState(ctx, true);
      const modified = !pending && !!state?.files.some(file => fileHash(path.join(ctx.root, file.relative)) !== file.installedHash);
      const current = { supported: true, root: ctx.root, approval: hasUnsafeApproval(ctx.launcherRoot, ctx.importer, userName), managed: !!state, modified, recoveryRequired: !!pending, backup: state || pending ? ctx.directory : null };
      try {
        const bundle = candidates(ctx);
        return { ...current, ready: true, available: true, version: bundle.runtime.slice(0, 12), installedVersion: state?.runtime?.slice(0, 12), coreVersion: bundle.core?.slice(0, 12), updateAvailable: !!state && (state.runtime !== bundle.runtime || state.core !== bundle.core) };
      } catch (failure) { return { ...current, ready: false, available: false, error: failure.message }; }
    } catch (failure) { return { supported: true, ready: false, error: failure.message }; }
  }
  function apply(gameId) {
    const ctx = context(gameId);
    if (!hasUnsafeApproval(ctx.launcherRoot, ctx.importer, userName)) throw error("approvalRequired");
    const state = readState(ctx), bundle = candidates(ctx);
    const plans = bundle.files.map(file => {
      const target = path.join(ctx.root, file.relative), expected = fileHash(target), previous = state?.files.find(item => item.relative === file.relative);
      if (state && (!previous || previous.installedHash !== expected)) throw error("modified");
      const bytes = fs.readFileSync(file.source);
      let compatible = file.accepted.includes(expected) || expected === hash(bytes);
      if (!compatible && expected && /\.(ini|hlsl)$/.test(file.relative)) compatible = file.accepted.includes(hash(fs.readFileSync(target, "utf8").replace(/\r\n/g, "\n")));
      if (!state && !compatible) throw error(file.relative === "d3d11.dll" ? "unknownRuntime" : "unknownCore");
      return { relative: file.relative, expected, bytes };
    });
    return transaction(ctx, plans, state, files => ({ schema: 1, root: ctx.root, gameId, runtime: bundle.runtime, core: bundle.core,
      files: files.map(file => { const original = state?.files.find(item => item.relative === file.relative); return { relative: file.relative, original: original?.original || file.before, originalHash: original ? original.originalHash : file.beforeHash, installedHash: file.afterHash }; }) }));
  }
  function restore(gameId) {
    const ctx = context(gameId);
    if (recover(ctx)) return { success: true, backup: ctx.directory, restartRequired: true };
    const state = readState(ctx);
    if (!state) throw error("noBackup");
    const plans = state.files.map(file => ({ relative: file.relative, expected: file.installedHash, bytes: readBackup(ctx, file.original, file.originalHash) }));
    return transaction(ctx, plans, state, () => null);
  }
  return { status, apply, restore };
}

module.exports = { createMiForksService, hasUnsafeApproval };
