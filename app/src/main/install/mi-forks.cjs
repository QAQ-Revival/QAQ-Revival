"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const os = require("node:os");
const i18n = require("../../shared/i18n/core.cjs");
const SUPPORTED = { endfield: "EFMI", "wuthering-waves": "WWMI", "genshin-impact": "GIMI", zzz: "ZZMI", "honkai-star-rail": "SRMI" };
const RUNTIME_FILE = "d3d11.dll";
const EFMI_FILES = ["Core/EFMI/MergedSkeleton.ini", "Core/EFMI/Shaders/MergedSkeleton_InstanceConfigOverrider_ConstantBuffer.hlsl", "Core/EFMI/Shaders/MergedSkeleton_InstanceConfigOverrider_ConstantBuffer.cs_5_0.8000.bin"];
// Every build of the fork carries this in its version resource, so older builds still identify themselves.
const FORK_MARK = Buffer.from("QAQ-Revival/XXMI-Libs-Package", "utf16le");
// Only builds with the Vulkan backend read this setting, whichever branch or release they came from.
const VULKAN_MARK = Buffer.from("extended_rendering", "utf16le");
const hash = value => crypto.createHash("sha256").update(value).digest("hex");
const fileHash = file => fs.existsSync(file) ? hash(fs.readFileSync(file)) : null;
const textHash = file => fs.existsSync(file) ? hash(fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n")) : null;
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
    const config = JSON.parse(fs.readFileSync(path.join(launcherRoot, "XXMI Launcher Config.json"), "utf8").replace(/^﻿/, ""));
    const settings = config.Importers?.[importer]?.Migoto;
    if (settings?.unsafe_mode !== true || typeof settings.unsafe_mode_signature !== "string") return false;
    // Verify the Launcher's saved consent with its public key; never read its private key.
    const publicKey = Buffer.from(fs.readFileSync(path.join(launcherRoot, "Resources/Security/public_key.der"), "utf8").trim(), "base64");
    return crypto.verify("sha256", Buffer.from(userName), { key: publicKey, type: "spki", format: "der" }, Buffer.from(settings.unsafe_mode_signature, "base64"));
  } catch { return false; }
}
function launcherVersion(launcherRoot, name) {
  try { return JSON.parse(fs.readFileSync(path.join(launcherRoot, "Resources/Packages", name, "Manifest.json"), "utf8").replace(/^﻿/, "")).version || null; }
  catch { return null; }
}
function coreVersion(ctx) {
  try {
    const main = fs.readFileSync(path.join(ctx.root, "Core", ctx.importer, ctx.importer === "WWMI" ? "WuWa-Model-Importer.ini" : "main.ini"), "utf8");
    const match = /^global\s+\$(?:wwmi_)?version\s*=\s*(\d+)\.(\d)(\d*)/m.exec(main);
    if (match) return `${match[1]}.${match[2]}.${match[3] || 0}`;
  } catch { /* Older packages can still report their manifest version. */ }
  return launcherVersion(ctx.launcherRoot, ctx.importer);
}
function peVersion(bytes) {
  const fixedInfo = bytes.indexOf(Buffer.from([0xbd, 0x04, 0xef, 0xfe]));
  if (fixedInfo < 0 || fixedInfo + 16 > bytes.length) return null;
  const high = bytes.readUInt32LE(fixedInfo + 8), low = bytes.readUInt32LE(fixedInfo + 12);
  return [high >>> 16, high & 0xffff, low >>> 16, low & 0xffff].join(".");
}
// In memory only: a crash mid-way leaves a mixed set, which status reports and either target repairs.
function replaceFiles(root, plans) {
  const written = [];
  try {
    for (const plan of plans) {
      const target = path.join(root, plan.relative), before = fs.existsSync(target) ? fs.readFileSync(target) : null;
      written.push({ target, before });
      writeAtomic(target, plan.bytes);
      if (fileHash(target) !== (plan.bytes === null ? null : hash(plan.bytes))) throw error("writeFailed");
    }
  } catch {
    for (const { target, before } of written.reverse()) { try { writeAtomic(target, before); } catch { /* status reports what is left */ } }
    throw error("writeFailed");
  }
  return { success: true, restartRequired: true };
}

function createMiForksService({ bundleRoots, resolveInstallation, userName } = {}) {
  const roots = () => typeof bundleRoots === "function" ? bundleRoots() : bundleRoots;
  function context(gameId) {
    const importer = SUPPORTED[gameId];
    if (!Object.hasOwn(SUPPORTED, gameId)) throw error("unsupported");
    const installation = resolveInstallation(gameId);
    if (!installation?.miRoot || !installation.launcherRoot) throw error("notInitialized");
    const root = path.resolve(installation.miRoot);
    plain(root);
    if (!fs.existsSync(path.join(root, "d3dx.ini")) || !fs.existsSync(path.join(root, RUNTIME_FILE))) throw error("notInitialized");
    return { importer, root, launcherRoot: installation.launcherRoot, approval: hasUnsafeApproval(installation.launcherRoot, importer, userName) };
  }
  function item({ id, name, source, local, official, fork, needsApproval, plans, blocked }) {
    const kind = local.kind;
    return {
      plans, blocked,
      view: {
        id, name, source, local, official, fork, needsApproval, canUpdateOfficial: true,
        canUseOfficial: kind !== "official" && !blocked.official,
        canUseFork: kind !== "fork" && !blocked.fork && !needsApproval,
        confirmReplace: kind === "other",
        reason: [kind !== "fork" && blocked.fork, kind !== "official" && blocked.official].find(Boolean)?.message || null
      }
    };
  }
  function runtimeSources(ctx) {
    const packaged = path.join(ctx.launcherRoot, "Resources/Packages/XXMI", RUNTIME_FILE);
    plain(packaged);
    const officialBytes = fs.existsSync(packaged) ? fs.readFileSync(packaged) : null;
    const official = officialBytes && { version: launcherVersion(ctx.launcherRoot, "XXMI") };
    let bundle = null, bundleFailure = null;
    try {
      bundle = loadBundle(roots(), "xxmi-runtime", "XXMI-Libs-Package");
      if (bundle.manifest.activityProtocol !== 1 || !bundle.files[RUNTIME_FILE] || !Array.isArray(bundle.manifest.compatibleRuntimeHashes)) throw error("invalidBundle");
    } catch (failure) { bundle = null; bundleFailure = failure; }
    const forkBytes = bundle && fs.readFileSync(bundle.files[RUNTIME_FILE]);
    const fork = bundle && { version: peVersion(forkBytes), build: bundle.manifest.sourceCommit.slice(0, 12) };
    return { officialBytes, official, bundle, bundleFailure, forkBytes, fork };
  }
  // The Launcher keeps the official DLL in its package cache, and the file in the MI folder identifies itself.
  function readRuntime(ctx) {
    const bytes = fs.readFileSync(path.join(ctx.root, RUNTIME_FILE)), current = hash(bytes);
    const { officialBytes, official, bundle, bundleFailure, forkBytes, fork } = runtimeSources(ctx);
    // The Vulkan runtime belongs to the Vulkan switch, which also moves the Launcher's renderer argument.
    if (bytes.includes(VULKAN_MARK)) {
      const active = error("vulkanActive");
      return item({
        id: "runtime", name: "XXMI-Libs", source: "https://github.com/QAQ-Revival/XXMI-Libs-Package",
        local: { kind: "vulkan", version: peVersion(bytes) }, official, fork, needsApproval: !ctx.approval,
        plans: {}, blocked: { official: active, fork: active }
      });
    }
    const local = officialBytes && hash(officialBytes) === current ? { kind: "official", version: official.version }
      : forkBytes && hash(forkBytes) === current ? { kind: "fork", ...fork }
      : bytes.includes(FORK_MARK) ? { kind: "outdated", version: peVersion(bytes) }
      : { kind: "other", version: peVersion(bytes) };
    const compatible = local.kind === "outdated" || !!bundle?.manifest.compatibleRuntimeHashes.includes(current);
    const blockedFork = bundleFailure || (compatible ? null : local.kind === "official" ? error("runtimeNotAdapted", { version: official.version }) : error("unknownRuntime"));
    return item({
      id: "runtime", name: "XXMI-Libs", source: "https://github.com/QAQ-Revival/XXMI-Libs-Package",
      local, official, fork, needsApproval: !ctx.approval,
      plans: { official: [{ relative: RUNTIME_FILE, bytes: officialBytes }], fork: [{ relative: RUNTIME_FILE, bytes: forkBytes }] },
      blocked: { official: officialBytes ? null : error("officialMissing"), fork: blockedFork }
    });
  }
  // The Launcher unpacks EFMI straight into the MI folder, so the official files travel with the fork's bundle.
  function readCore(ctx) {
    const base = { id: "core", name: "EFMI-Package", source: "https://github.com/QAQ-Revival/EFMI-Package", needsApproval: false };
    const installed = coreVersion(ctx);
    let bundle;
    try {
      bundle = loadBundle(roots(), "efmi-core", "EFMI-Package");
      const { official, compatibleFiles } = bundle.manifest;
      if (!official?.version || !Array.isArray(official.files) || !official.files.length || official.files.some(relative => !bundle.files[`official/${relative}`]) || EFMI_FILES.some(relative => !bundle.files[relative] || !Array.isArray(compatibleFiles?.[relative]))) throw error("invalidBundle");
    } catch (failure) {
      return item({ ...base, local: { kind: "other", version: installed }, official: null, fork: null, plans: {}, blocked: { official: failure, fork: failure } });
    }
    const { official: { version, files: identity }, compatibleFiles, sourceCommit } = bundle.manifest;
    const target = relative => path.join(ctx.root, relative), forkFile = relative => bundle.files[relative], officialFile = relative => bundle.files[`official/${relative}`];
    // The compiled shader is a cache the runtime rebuilds whenever its timestamp differs, so it says nothing about origin.
    const matches = source => identity.every(relative => textHash(target(relative)) === textHash(source(relative)));
    const known = identity.every(relative => {
      const text = textHash(target(relative));
      return compatibleFiles[relative].includes(text) || compatibleFiles[relative].includes(fileHash(target(relative))) || text === textHash(forkFile(relative)) || text === textHash(officialFile(relative));
    });
    const sameVersion = !installed || installed === version;
    const fork = { version, build: sourceCommit.slice(0, 12) };
    const local = matches(forkFile) ? sameVersion ? { kind: "fork", ...fork } : { kind: "outdated", version: installed }
      : matches(officialFile) ? { kind: "official", version: installed || version }
      : known ? { kind: "outdated", version: installed || version }
      : sameVersion ? { kind: "other", version: installed }
      : { kind: "official", version: installed };
    const mismatch = sameVersion ? null : error("coreMismatch", { fork: version, version: installed });
    return item({
      ...base, local, official: { version }, fork,
      plans: {
        official: EFMI_FILES.map(relative => ({ relative, bytes: identity.includes(relative) ? fs.readFileSync(officialFile(relative)) : null })),
        fork: EFMI_FILES.map(relative => ({ relative, bytes: fs.readFileSync(forkFile(relative)) }))
      },
      blocked: { official: mismatch, fork: mismatch || (local.kind === "other" ? error("unknownCore") : null) }
    });
  }
  function read(ctx) {
    const runtime = readRuntime(ctx);
    if (!["EFMI", "WWMI", "GIMI"].includes(ctx.importer)) {
      Object.assign(runtime.view, { switchable: false, canUseOfficial: false, canUseFork: false, fork: null, reason: null, needsApproval: false });
    }
    const core = ctx.importer === "EFMI" ? readCore(ctx) : { view: {
      id: "core", name: `${ctx.importer}-Package`, source: `https://github.com/SpectrumQT/${ctx.importer}-Package`,
      local: { kind: "official", version: coreVersion(ctx) }, official: { version: coreVersion(ctx) },
      fork: null, switchable: false, canUseOfficial: false, canUseFork: false, canUpdateOfficial: true
    } };
    return [runtime, core];
  }
  function status(gameId) {
    if (!Object.hasOwn(SUPPORTED, gameId)) return { supported: false };
    const importer = SUPPORTED[gameId];
    try {
      const ctx = context(gameId);
      return { supported: true, ready: true, importer, root: ctx.root, approval: ctx.approval, components: read(ctx).map(entry => entry.view) };
    } catch (failure) { return { supported: true, ready: false, importer, error: failure.message }; }
  }
  function change(gameId, component, target, { confirmed = false } = {}) {
    const ctx = context(gameId);
    const entry = read(ctx).find(entry => entry.view.id === component);
    if (!entry || entry.view.switchable === false || !["official", "fork"].includes(target)) throw error("unsupported");
    if (entry.view.local.kind === target) return { success: true, restartRequired: false };
    if (target === "fork" && entry.view.needsApproval) throw error("approvalRequired");
    if (entry.blocked[target]) throw entry.blocked[target];
    if (entry.view.confirmReplace && !confirmed) throw error("confirmRequired");
    return replaceFiles(ctx.root, entry.plans[target]);
  }
  // What the DX11 runtime of a channel is right now. A fork the Launcher's official DLL has moved past falls back.
  function dx11Runtime(gameId, channel) {
    const { officialBytes, bundle, forkBytes } = runtimeSources(context(gameId));
    const adapted = forkBytes && officialBytes && bundle.manifest.compatibleRuntimeHashes.includes(hash(officialBytes));
    if (channel === "fork" && adapted) return { channel: "fork", bytes: forkBytes };
    if (officialBytes) return { channel: "official", bytes: officialBytes };
    throw error("officialMissing");
  }
  return { status, change, dx11Runtime };
}

module.exports = { createMiForksService, hasUnsafeApproval, loadBundle, replaceFiles, FORK_MARK, VULKAN_MARK };
