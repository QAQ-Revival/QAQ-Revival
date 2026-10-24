"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const files = require("./files.cjs");
const i18n = require("../../../shared/i18n/core.cjs");
const MARKER = ".qaqr-m4a.json";
const { modId } = require("./reload.cjs");

function planDeployment(entries) {
  const keys = new Map();
  return entries.map(entry => {
    const report = files.assertLoadable(entry.path);
    for (const identity of report.identities) {
      const previous = keys.get(identity.key) || [];
      for (const other of previous) {
        if (identity.bundle && other.bundle && identity.bundle !== other.bundle) continue;
        const hash = file => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
        if (hash(identity.path) !== hash(other.path)) throw Error(i18n.t("arknights.errors.conflict", { name: identity.key, mods: `${other.name} / ${entry.name}` }));
      }
      previous.push({ ...identity, name: entry.name });
      keys.set(identity.key, previous);
    }
    return { ...entry, resources: report.resources, manifests: report.manifests };
  });
}
function deploy({ entries, library, destination, gamePath, changedModPath = "", copy = fs.copyFileSync, rename = fs.renameSync }) {
  files.assertOutsideGame(destination, gamePath);
  files.assertOutsideGame(library, gamePath);
  if (files.inside(destination, library) || files.inside(library, destination)) throw Error(i18n.t("arknights.errors.overlap"));
  const planned = planDeployment(entries);
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
    const summary = { owner: "qaqr-arknights-v1", modCount: planned.length, fileCount: count, updatedAt: new Date().toISOString(), sources };
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

module.exports = { planDeployment, deploy, MARKER };
