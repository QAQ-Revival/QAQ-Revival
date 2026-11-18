"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const i18n = require("../../../shared/i18n/core.cjs");
const { loadBundle, replaceFiles, VULKAN_MARK } = require("../../install/mi-forks.cjs");
const { autoHdrAllowed, withAutoHdr } = require("./hdr-windows.cjs");
const DLL = "dxgi.dll", ADDON = "renodx-endfield.addon64";
const MODES = ["off", "auto", "native"];
const fields = ["extra_libraries", "extra_libraries_enabled", "extra_libraries_signature", "xxmi_dll_inject_mode"];
const digest = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const identity = file => path.resolve(file).toLowerCase();
const same = (a, b) => identity(a) === identity(b);
const libraries = importer => String(importer?.extra_libraries || "").split(/\r?\n/).map(line => line.trim()).filter(Boolean);
function sameLibraries(first, second, launcherRoot) {
  const left = libraries({ extra_libraries: first }), right = libraries({ extra_libraries: second });
  return left.length === right.length && left.every((file, index) => same(path.resolve(launcherRoot, file), path.resolve(launcherRoot, right[index])));
}
const failure = key => Error(i18n.t(`backend.endfieldHdr.${key}`));
function hasLibraryApproval(launcherRoot, importer) {
  try {
    const key = Buffer.from(fs.readFileSync(path.join(launcherRoot, "Resources/Security/public_key.der"), "utf8").trim(), "base64");
    return crypto.verify("sha256", Buffer.from(importer.extra_libraries), { key, type: "spki", format: "der" }, Buffer.from(importer.extra_libraries_signature || "", "base64"));
  } catch { return false; }
}
function createEndfieldHdrService({ storageRoot, bundleRoots, resolveInstallation, preferences, assertStopped, notifyChanged = () => {} }) {
  let busy = false;
  const managedDll = path.join(storageRoot, DLL);
  const stateFile = path.join(storageRoot, "state.json");
  function context() {
    const found = resolveInstallation() || {};
    const configFile = found.launcherRoot && path.join(found.launcherRoot, "XXMI Launcher Config.json");
    const config = configFile && fs.existsSync(configFile) ? JSON.parse(fs.readFileSync(configFile, "utf8").replace(/^\uFEFF/, "")) : null;
    const importer = config?.Importers?.EFMI?.Importer;
    const runtime = found.miRoot && path.join(found.miRoot, "d3d11.dll");
    const vulkan = !!runtime && fs.existsSync(runtime) && fs.readFileSync(runtime).includes(VULKAN_MARK);
    const state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, "utf8")) : null;
    if (state && state.protocol !== 1) throw failure("invalidState");
    return { ...found, configFile, config, importer, runtime, vulkan, state };
  }
  function bundle() { return loadBundle(typeof bundleRoots === "function" ? bundleRoots() : bundleRoots, "endfield-hdr", "renodx"); }
  function installed() {
    try {
      const record = JSON.parse(fs.readFileSync(path.join(storageRoot, "component.json"), "utf8"));
      if (record.source !== "https://github.com/QAQ-Revival/renodx" || !/^[a-f0-9]{40}$/.test(record.sourceCommit)) return null;
      for (const file of [DLL, ADDON]) if (digest(fs.readFileSync(path.join(storageRoot, file))) !== record.files?.[file]) return null;
      return { version: record.version, build: record.sourceCommit.slice(0, 12) };
    } catch { return null; }
  }
  function active(ctx) {
    return ctx.importer?.extra_libraries_enabled === true && libraries(ctx.importer).some(file => same(path.resolve(ctx.launcherRoot, file), managedDll));
  }
  async function status() {
    const ctx = context();
    const prefs = ctx.gamePath ? await preferences.read(ctx.gamePath) : { app: null, global: null };
    const auto = autoHdrAllowed(prefs.app, autoHdrAllowed(prefs.global));
    const native = active(ctx);
    let available = null;
    try { const source = bundle().manifest; available = { version: source.version, build: source.sourceCommit.slice(0, 12) }; } catch { /* A partial installation can still use Windows Auto HDR. */ }
    const local = installed();
    const gameReady = !!ctx.gamePath && fs.existsSync(ctx.gamePath);
    const loaderReady = !!ctx.importer && !!ctx.runtime && fs.existsSync(ctx.runtime);
    return {
      success: true, mode: native ? "native" : auto ? "auto" : "off", native, auto,
      conflict: native && auto, installed: !!local, local, available,
      canUseNative: gameReady && loaderReady && !ctx.vulkan && !!(local || available),
      needsApproval: native && !hasLibraryApproval(ctx.launcherRoot, ctx.importer),
      checks: [
        { id: "game", title: i18n.t("backend.endfieldHdr.game"), ok: gameReady, message: ctx.gamePath || i18n.t("backend.endfieldHdr.gameRequired") },
        { id: "loader", title: "EFMI", ok: loaderReady, message: i18n.t(loaderReady ? "backend.endfieldHdr.loaderReady" : "backend.endfieldHdr.loaderRequired") },
        { id: "renderer", title: "DirectX 11", ok: loaderReady && !ctx.vulkan, message: i18n.t(ctx.vulkan ? "backend.endfieldHdr.dx11Required" : "backend.endfieldHdr.dx11Hint") }
      ],
      paths: { root: storageRoot, game: ctx.gamePath || "" }
    };
  }
  function installFiles() {
    const source = bundle();
    if (![DLL, ADDON].every(file => source.files[file])) throw failure("bundleMissing");
    const plans = [DLL, ADDON].map(relative => ({ relative, bytes: fs.readFileSync(source.files[relative]) }));
    for (const [relative, file] of Object.entries(source.files)) if (relative.startsWith("licenses/")) plans.push({ relative, bytes: fs.readFileSync(file) });
    plans.push({ relative: "component.json", bytes: JSON.stringify(source.manifest, null, 2) + "\n" });
    if (!fs.existsSync(path.join(storageRoot, "ReShade.ini"))) {
      plans.push({ relative: "ReShade.ini", bytes: "[ADDON]\nAddonPath=.\n\n[GENERAL]\nEffectSearchPaths=.\\shaders\nTextureSearchPaths=.\\textures\nPresetPath=.\\Preset.ini\n\n[SCREENSHOT]\nSavePath=.\\Screenshots\n\n[OVERLAY]\nTutorialProgress=4\n" });
    }
    replaceFiles(storageRoot, plans);
  }
  function restoreImporter(ctx) {
    if (!ctx.state?.previous || !ctx.importer) return;
    if (!same(ctx.state.launcherConfig, ctx.configFile)) throw failure("installationChanged");
    const exact = sameLibraries(ctx.importer.extra_libraries, ctx.state.applied.extra_libraries, ctx.launcherRoot);
    if (exact) {
      for (const key of ["extra_libraries", "extra_libraries_enabled", "extra_libraries_signature"]) {
        if (Object.hasOwn(ctx.state.previous, key)) ctx.importer[key] = ctx.state.previous[key];
        else delete ctx.importer[key];
      }
    } else {
      const previous = libraries(ctx.state.previous);
      ctx.importer.extra_libraries = libraries(ctx.importer).filter(file => {
        const resolved = path.resolve(ctx.launcherRoot, file);
        if (same(resolved, managedDll)) return false;
        return !same(resolved, ctx.runtime) || previous.some(item => same(path.resolve(ctx.launcherRoot, item), ctx.runtime));
      }).join("\n");
      if (!ctx.importer.extra_libraries) ctx.importer.extra_libraries_enabled = false;
      // A changed list goes through the Launcher's own confirmation again.
      delete ctx.importer.extra_libraries_signature;
    }
    if (ctx.importer.xxmi_dll_inject_mode === ctx.state.applied.xxmi_dll_inject_mode) {
      if (Object.hasOwn(ctx.state.previous, "xxmi_dll_inject_mode")) ctx.importer.xxmi_dll_inject_mode = ctx.state.previous.xxmi_dll_inject_mode;
      else delete ctx.importer.xxmi_dll_inject_mode;
    }
  }
  async function locked(action) {
    if (busy) throw failure("busy");
    busy = true;
    try { return await action(); } finally { busy = false; notifyChanged(); }
  }
  async function install() {
    return locked(async () => { const ctx = context(); await assertStopped(ctx); installFiles(); return status(); });
  }
  async function setMode(mode) {
    if (!MODES.includes(mode)) throw failure("invalidMode");
    return locked(async () => {
      const ctx = context();
      if (!ctx.gamePath || (mode === "native" && !fs.existsSync(ctx.gamePath))) throw failure("gameRequired");
      await assertStopped(ctx);
      if (ctx.state?.previous && (!ctx.importer || !same(ctx.state.launcherConfig, ctx.configFile) || !same(ctx.state.gamePath, ctx.gamePath))) throw failure("installationChanged");
      if (active(ctx) && !ctx.state?.previous) throw failure("unmanaged");
      if (mode === "native") {
        if (!ctx.importer || !ctx.runtime || !fs.existsSync(ctx.runtime)) throw failure("loaderRequired");
        if (ctx.vulkan) throw failure("dx11Required");
        const otherReshade = ctx.importer.extra_libraries_enabled && libraries(ctx.importer).some(file => !same(path.resolve(ctx.launcherRoot, file), managedDll) && /^(?:dxgi|d3d12|reshade\d*)\.dll$/i.test(path.basename(file)));
        const gameReshade = ["dxgi.dll", "d3d12.dll", "ReShade64.dll", "ReShade.ini", ADDON].some(file => fs.existsSync(path.join(path.dirname(ctx.gamePath), file)));
        if (otherReshade || gameReshade) throw failure("reshadeConflict");
        if (!installed()) installFiles();
      }
      const previousPrefs = await preferences.read(ctx.gamePath);
      const originalImporter = { ...ctx.importer };
      // Keep only an authorization already signed by XXMI and still valid under its current public key.
      const approved = active(ctx) && hasLibraryApproval(ctx.launcherRoot, ctx.importer) ? ctx.importer : ctx.state?.libraryApproval;
      const libraryApproval = approved && hasLibraryApproval(ctx.launcherRoot, approved) ? {
        extra_libraries: approved.extra_libraries,
        extra_libraries_signature: approved.extra_libraries_signature
      } : null;
      let nextState = { protocol: 1, mode, gamePath: ctx.gamePath };
      if (libraryApproval) nextState.libraryApproval = libraryApproval;
      if (mode === "native") {
        const previous = ctx.state?.previous || Object.fromEntries(fields.filter(key => Object.hasOwn(ctx.importer, key)).map(key => [key, ctx.importer[key]]));
        const other = ctx.importer.extra_libraries_enabled ? libraries(ctx.importer).filter(file => !same(path.resolve(ctx.launcherRoot, file), managedDll) && !same(path.resolve(ctx.launcherRoot, file), ctx.runtime)) : [];
        const applied = { extra_libraries: [managedDll, ctx.runtime, ...other].join("\n"), extra_libraries_enabled: true, xxmi_dll_inject_mode: "DIRECT" };
        if (libraryApproval && sameLibraries(applied.extra_libraries, libraryApproval.extra_libraries, ctx.launcherRoot)) {
          // The signature covers exact text, so retain the Launcher's approved path spelling and line endings.
          applied.extra_libraries = libraryApproval.extra_libraries;
          ctx.importer.extra_libraries_signature = libraryApproval.extra_libraries_signature;
        } else if (ctx.importer.extra_libraries !== applied.extra_libraries) delete ctx.importer.extra_libraries_signature;
        Object.assign(ctx.importer, applied);
        nextState = { ...nextState, launcherConfig: ctx.configFile, previous, applied };
      } else restoreImporter(ctx);
      let wrotePreferences = false;
      let rollbackConfig = null;
      try {
        // The application override controls only Endfield, including when the global toggle is off.
        await preferences.write(ctx.gamePath, withAutoHdr(previousPrefs.app, mode === "auto"));
        wrotePreferences = true;
        if (ctx.config && (mode === "native" || ctx.state?.previous)) {
          const currentBytes = fs.readFileSync(ctx.configFile);
          const current = JSON.parse(currentBytes.toString("utf8").replace(/^\uFEFF/, ""));
          const importer = current.Importers?.EFMI?.Importer;
          if (!importer || fields.some(key => importer[key] !== originalImporter[key])) throw failure("launcherChanged");
          for (const key of fields) {
            if (Object.hasOwn(ctx.importer, key)) importer[key] = ctx.importer[key];
            else delete importer[key];
          }
          replaceFiles(ctx.launcherRoot, [{ relative: "XXMI Launcher Config.json", bytes: JSON.stringify(current, null, 4) + "\n" }]);
          rollbackConfig = currentBytes;
        }
        replaceFiles(storageRoot, [{ relative: "state.json", bytes: JSON.stringify(nextState, null, 2) + "\n" }]);
      } catch (error) {
        const rollback = [];
        if (rollbackConfig) { try { replaceFiles(ctx.launcherRoot, [{ relative: "XXMI Launcher Config.json", bytes: rollbackConfig }]); } catch { rollback.push("launcher"); } }
        if (wrotePreferences) { try { await preferences.write(ctx.gamePath, previousPrefs.app ?? null); } catch { rollback.push("registry"); } }
        if (rollback.length) throw failure("rollbackFailed");
        throw error;
      }
      return { ...await status(), restartRequired: true };
    });
  }
  async function prepareLaunch(mode) {
    const ctx = context();
    if (!active(ctx) && ctx.state?.mode !== "native") return;
    if (!["EFMI", "XXMI"].includes(mode)) throw failure("useEfmi");
    if (!active(ctx) || !installed()) throw failure("repairRequired");
    if (ctx.vulkan) throw failure("dx11Required");
    const prefs = await preferences.read(ctx.gamePath);
    if (autoHdrAllowed(prefs.app, autoHdrAllowed(prefs.global))) throw failure("hdrConflict");
  }
  return { status, install, setMode, prepareLaunch };
}
module.exports = { createEndfieldHdrService, hasLibraryApproval };
