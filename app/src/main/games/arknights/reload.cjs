"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const files = require("./files.cjs");
const i18n = require("../../../shared/i18n/core.cjs");

const modId = directory => crypto.createHash("sha256").update(directory).digest("hex").slice(0, 20);
const samePath = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();

// `mods` puts several Mods into one patch; that needs a worker with the
// multi-mod-reload-v1 capability. `synced` skips a deployment the caller just ran.
function createModReloader({ paths, resolveMod, characterIds, sync, runNative, runWorker }) {
  return async function reloadMod({ characterName, modName, mods, optional = false, synced = false }) {
    const targets = mods || [{ characterName, modName }];
    if (!targets.length) throw Error(i18n.t("arknights.errors.modMissing"));
    const p = paths();
    const running = await runNative(["--status"]);
    if (!running.running) {
      if (optional) return { success: true, autoReloaded: false };
      throw Error(i18n.t("arknights.errors.reloadNotRunning"));
    }
    const manifest = path.join(p.bundleRoot, "manifest.tsv");
    files.assertOutsideGame(p.bundleRoot, p.gamePath);
    if (!fs.existsSync(path.join(p.bundleRoot, ".qaqr-generated")) || !fs.existsSync(manifest)) throw Error(i18n.t("arknights.errors.reloadUnavailable"));
    let runtime;
    try { runtime = await runNative(["--runtime-status", "--manifest", manifest]); }
    catch { throw Error(i18n.t("arknights.errors.reloadUnavailable")); }
    if (runtime.protocol === 1) throw Error(i18n.t("arknights.errors.reloadUnsupported"));
    if (runtime.protocol !== 2 || !Number.isSafeInteger(runtime.pid) || runtime.pid < 1 || !samePath(runtime.manifest, manifest)) throw Error(i18n.t("arknights.errors.reloadUnavailable"));
    const reloadRoot = path.join(p.bundleRoot, "reloads");
    let indexDirectory = p.bundleRoot;
    if (runtime.lastPatch) {
      if (!files.inside(runtime.lastPatch, reloadRoot) || path.basename(runtime.lastPatch) !== "manifest.tsv") throw Error(i18n.t("arknights.errors.invalidManifest"));
      indexDirectory = path.dirname(runtime.lastPatch);
    }
    files.assertNoLinks(indexDirectory);
    const index = JSON.parse(fs.readFileSync(path.join(indexDirectory, "bundle-index.json"), "utf8"));
    if (index.schemaVersion !== 1 || !Array.isArray(index.bundles) || index.bundles.length > 200) throw Error(i18n.t("arknights.errors.reloadUnavailable"));
    const scopes = targets.map(target => {
      const source = resolveMod(target.characterName, target.modName);
      return { source, id: modId(path.join(path.dirname(source), path.basename(source).replace(files.DISABLED, ""))), fingerprint: files.fingerprint(source), characterIds: characterIds(target.characterName) };
    });
    const affectedBundles = index.bundles.filter(bundle => bundle.inputs?.some(input => scopes.some(scope => input.startsWith(scope.id + "/")))).map(bundle => bundle.logical);
    if (!synced) sync({ changedModPath: scopes.length === 1 ? scopes[0].source : "" });
    const output = path.join(reloadRoot, crypto.randomUUID());
    files.assertOutsideGame(output, p.gamePath);
    let sent = false;
    try {
      const scope = scopes.length === 1 ? { scopeSource: scopes[0].source } : { scopeSources: scopes.map(item => item.source) };
      const built = await runWorker({ action: "build-bundles", source: p.destination, gamePath: p.gamePath, output, ...scope, affectedBundles, characterIds: [...new Set(scopes.flatMap(item => item.characterIds))] });
      if (scopes.some(item => files.fingerprint(item.source) !== item.fingerprint) || !samePath(paths().bundleRoot, p.bundleRoot) || paths().gamePath !== p.gamePath || paths().library !== p.library) throw Error(i18n.t("arknights.errors.changed"));
      const touched = new Set([...built.bundles, ...built.removedBundles].map(bundle => bundle.logical.toLowerCase()));
      const next = { schemaVersion: 1, bundles: [...index.bundles.filter(bundle => !touched.has(bundle.logical.toLowerCase())), ...built.bundles] };
      fs.writeFileSync(path.join(output, "bundle-index.json"), JSON.stringify(next));
      const patch = path.join(output, "manifest.tsv");
      let accepted;
      sent = true;
      try { accepted = await runNative(["--reload", "--manifest", patch, "--pid", String(runtime.pid)]); }
      catch (error) {
        // A lost reply is recoverable: the live runtime identifies its last
        // accepted immutable patch, including the corresponding resource index.
        const check = await runNative(["--runtime-status", "--manifest", manifest]).catch(() => null);
        if (check?.pid !== runtime.pid || !check.lastPatch || !samePath(check.lastPatch, patch)) throw error;
        accepted = check;
      }
      if (accepted.protocol !== 2 || accepted.pid !== runtime.pid || !accepted.lastPatch || !samePath(accepted.lastPatch, patch)) throw Error(i18n.t("arknights.errors.reloadUnavailable"));
      return { success: true, autoReloaded: true, bundleCount: touched.size, refreshRequired: true };
    } catch (error) {
      if (sent) error.patchSent = true;
      throw error;
    } finally {
      // Once sent, a patch may be live even if its reply was lost. Keep its
      // immutable files until the next launch prepares a fresh bundle tree.
      if (!sent && fs.existsSync(output)) {
        files.assertNoLinks(output);
        if (!files.inside(output, reloadRoot) || samePath(output, reloadRoot)) throw Error(i18n.t("arknights.errors.invalidPath"));
        fs.rmSync(output, { recursive: true, force: true });
      }
    }
  };
}

module.exports = { createModReloader, modId };
