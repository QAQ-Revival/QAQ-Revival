"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const files = require("./files.cjs");
const i18n = require("../../../shared/i18n/core.cjs");
const MARKER = ".qaqr-m4a.json";
const { modId } = require("./reload.cjs");

const digestCache = new Map();
function digest(file) {
  const stat = fs.statSync(file), signature = `${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}`;
  const cached = digestCache.get(file);
  if (cached?.signature === signature) return cached.hash;
  const hash = crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  if (digestCache.size > 10000) digestCache.clear();
  digestCache.set(file, { signature, hash });
  return hash;
}
function inspectEntries(entries) {
  const keys = new Map();
  const conflicts = [];
  const planned = entries.map(entry => {
    const report = files.assertLoadable(entry.path);
    for (const identity of report.identities) {
      const previous = keys.get(identity.key) || [];
      for (const other of previous) {
        if (identity.bundle && other.bundle && identity.bundle !== other.bundle) continue;
        if (other.name !== entry.name && digest(identity.path) !== digest(other.path)) {
          const sources = [[other.name, other.bundle || "", digest(other.path)], [entry.name, identity.bundle || "", digest(identity.path)]].sort((a, b) => a[0].localeCompare(b[0]));
          const id = crypto.createHash("sha256").update(JSON.stringify([identity.key, sources])).digest("hex");
          conflicts.push({ id, hash: identity.key, mods: [other.name, entry.name], files: [{ path: other.path, modPath: other.modPath, sha256: digest(other.path) }, { path: identity.path, modPath: entry.path, sha256: digest(identity.path) }] });
        }
      }
      previous.push({ ...identity, name: entry.name, modPath: entry.path });
      keys.set(identity.key, previous);
    }
    return { ...entry, resources: report.resources, manifests: report.manifests };
  });
  return { planned, conflicts };
}
function findConflicts(entries) { return inspectEntries(entries).conflicts; }
function validatePlan({ planned, conflicts }, approvedConflictIds) {
  const approved = new Set(approvedConflictIds);
  const blocked = conflicts.find(conflict => !approved.has(conflict.id));
  if (blocked) throw Error(i18n.t("arknights.errors.conflict", { name: blocked.hash, mods: blocked.mods.join(" / ") }));
  return planned;
}
function planDeployment(entries, { approvedConflictIds = [] } = {}) {
  return validatePlan(inspectEntries(entries), approvedConflictIds);
}
function deploy({ entries, library, destination, gamePath, changedModPath = "", approvedConflictIds = [], copy = fs.copyFileSync, rename = fs.renameSync }) {
  files.assertOutsideGame(destination, gamePath);
  files.assertOutsideGame(library, gamePath);
  if (files.inside(destination, library) || files.inside(library, destination)) throw Error(i18n.t("arknights.errors.overlap"));
  const inspected = inspectEntries(entries);
  const planned = validatePlan(inspected, approvedConflictIds);
  const approvedResourcePairs = inspected.conflicts.map(conflict => conflict.files.map(file => ({ file: path.join(modId(file.modPath), path.relative(file.modPath, file.path)).split(path.sep).join("/"), sha256: file.sha256 })));
  const previous = path.join(path.dirname(destination), "DISABLE_QAQR_previous");
  function owned(dir) {
    files.assertNoLinks(dir);
    try { return JSON.parse(fs.readFileSync(path.join(dir, MARKER), "utf8")).owner === "qaqr-arknights-v1"; } catch { return false; }
  }
  if (!fs.existsSync(destination) && fs.existsSync(previous) && owned(previous)) files.renameDirectory(previous, destination, rename);
  if (fs.existsSync(destination) && !owned(destination)) throw Error(i18n.t("arknights.errors.unowned"));
  if (fs.existsSync(previous) && !owned(previous)) throw Error(i18n.t("arknights.errors.unowned"));
  const oldSources = fs.existsSync(path.join(destination, MARKER)) ? JSON.parse(fs.readFileSync(path.join(destination, MARKER), "utf8")).sources || {} : {};
  const stage = path.join(path.dirname(destination), `DISABLE_QAQR_stage_${crypto.randomUUID()}`);
  fs.mkdirSync(stage, { recursive: true });
  let moved = false;
  try {
    let count = 0;
    const sources = {};
    function stageFile(entry, file, id) {
      const relative = path.join(id, file.relative), target = path.join(stage, relative);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      const signature = [file.path, file.size, file.mtimeMs];
      const existing = path.join(destination, relative);
      if (entry.path !== changedModPath && JSON.stringify(oldSources[relative]) === JSON.stringify(signature) && fs.existsSync(existing)) {
        files.assertNoLinks(existing);
        // Link only our immutable generated copy, never the user's Mod file.
        try { fs.linkSync(existing, target); }
        catch { copy(file.path, target); }
      } else copy(file.path, target);
      sources[relative] = signature;
    }
    for (const entry of planned) {
      const id = modId(entry.path);
      for (const file of entry.resources) {
        stageFile(entry, file, id);
        count++;
      }
      for (const file of entry.manifests) {
        stageFile(entry, file, id);
      }
    }
    const summary = { owner: "qaqr-arknights-v1", modCount: planned.length, fileCount: count, updatedAt: new Date().toISOString(), sources, approvedResourcePairs, modOrder: planned.map(entry => modId(entry.path)) };
    fs.writeFileSync(path.join(stage, MARKER), JSON.stringify(summary));
    if (fs.existsSync(previous)) fs.rmSync(previous, { recursive: true });
    if (fs.existsSync(destination)) { files.renameDirectory(destination, previous, rename); moved = true; }
    files.renameDirectory(stage, destination, rename);
    return summary;
  } catch (error) {
    if (moved && !fs.existsSync(destination)) files.renameDirectory(previous, destination, rename);
    throw error;
  } finally {
    if (fs.existsSync(stage)) fs.rmSync(stage, { recursive: true, force: true });
  }
}

module.exports = { planDeployment, findConflicts, deploy, MARKER };
