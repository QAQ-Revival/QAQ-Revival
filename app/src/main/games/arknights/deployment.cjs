"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const files = require("./files.cjs");
const i18n = require("../../../shared/i18n/core.cjs");
const MARKER = ".qaqr-m4a.json";

function planDeployment(entries) {
  const keys = new Map();
  return entries.map(entry => {
    const report = files.assertLoadable(entry.path);
    for (const key of report.keys) {
      if (keys.has(key)) throw Error(i18n.t("arknights.errors.conflict", { name: key, mods: `${keys.get(key)} / ${entry.name}` }));
      keys.set(key, entry.name);
    }
    return { ...entry, resources: report.resources };
  });
}
function deploy({ entries, library, destination, gamePath, copy = fs.copyFileSync, rename = fs.renameSync }) {
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
  const stage = path.join(path.dirname(destination), `DISABLE_QAQR_stage_${crypto.randomUUID()}`);
  fs.mkdirSync(stage, { recursive: true });
  let moved = false;
  try {
    let count = 0;
    for (const entry of planned) {
      const id = crypto.createHash("sha256").update(entry.path).digest("hex").slice(0, 20);
      for (const file of entry.resources) {
        const target = path.join(stage, id, file.relative);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        copy(file.path, target);
        count++;
      }
    }
    const summary = { owner: "qaqr-arknights-v1", modCount: planned.length, fileCount: count, updatedAt: new Date().toISOString() };
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
