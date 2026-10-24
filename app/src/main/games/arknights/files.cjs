"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const i18n = require("../../../shared/i18n/core.cjs");

const BUNDLES = new Set([".ab", ".bundle", ".unity3d"]);
const RESOURCES = new Set([".png", ".skel", ".atlas", ".wav", ".txt", ".json", ".ini"]);
const DISABLED = /^(?:DISABLED_|DISABLE_)/i;
const ignored = name => /^\.|^(?:logs|dump)$/i.test(name) || /^(?:preview|_cover)(?:[._]|$)/i.test(name) || /^(?:tags|info)\.json$|^readme(?:\.|$)|^desktop\.ini$/i.test(name);

function inside(file, root) {
  const relative = path.relative(path.resolve(root), path.resolve(file));
  return relative === "" || (!relative.startsWith(".." + path.sep) && relative !== ".." && !path.isAbsolute(relative));
}
function assertNoLinks(file) {
  let current = path.resolve(file);
  for (;;) {
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw Error(i18n.t("arknights.errors.link"));
    const parent = path.dirname(current);
    if (current === parent) break;
    current = parent;
  }
}
function assertOutsideGame(file, gamePath) {
  assertNoLinks(file);
  if (gamePath && inside(file, path.dirname(gamePath))) throw Error(i18n.t("arknights.errors.gameWrite"));
}
function walk(root, { includeDisabled = false } = {}) {
  assertNoLinks(root);
  const files = [];
  let bytes = 0;
  function visit(directory, depth) {
    if (depth > 24) throw Error(i18n.t("arknights.errors.tooLarge"));
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (ignored(entry.name) || (!includeDisabled && DISABLED.test(entry.name))) continue;
      if (entry.isSymbolicLink()) throw Error(i18n.t("arknights.errors.link"));
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file, depth + 1);
      else if (entry.isFile()) {
        const stat = fs.statSync(file);
        bytes += stat.size;
        if (stat.size > 512 * 1024 * 1024 || bytes > 2 * 1024 * 1024 * 1024) throw Error(i18n.t("arknights.errors.tooLarge"));
        files.push({ path: file, relative: path.relative(root, file), name: entry.name, ext: path.extname(entry.name).toLowerCase(), size: stat.size, mtimeMs: stat.mtimeMs });
      }
      if (files.length > 20000) throw Error(i18n.t("arknights.errors.tooLarge"));
    }
  }
  visit(root, 0);
  return files;
}
function resourceKey(name) {
  return name.toLowerCase().replace(/[\x23@]/g, "_").replace(/(?:\[alphe?\]|_alpha)(?=\.png$)/, "[alpha]").replace(/^illust_(?=char_)/, "");
}
function inspect(root) {
  const files = walk(root);
  const bundles = files.filter(file => BUNDLES.has(file.ext));
  const resources = files.filter(file => RESOURCES.has(file.ext));
  const collisions = [];
  const seen = new Map();
  const audioKeys = new Map();
  for (const ini of resources.filter(file => file.name.toLowerCase() === "mod.ini")) {
    const content = fs.readFileSync(ini.path, "utf8");
    const character = content.match(/^\s*character\s*=\s*(char_\d+_[\w]+)/im)?.[1];
    const group = content.match(/^\s*voice_group\s*=\s*(\w+)/im)?.[1];
    if (character && group) audioKeys.set(path.dirname(ini.path), `${group}/${character}`.toLowerCase());
  }
  for (const file of resources) {
    if ([".ini", ".txt", ".json"].includes(file.ext) && !/^(?:dyn_|entry_|front_|back_|build_)/i.test(file.name)) continue;
    const scope = file.ext === ".wav" ? [...audioKeys].filter(([dir]) => inside(file.path, dir)).sort((a, b) => b[0].length - a[0].length)[0]?.[1] : "";
    const key = (scope ? `audio:${scope}/` : "") + resourceKey(file.name);
    if (seen.has(key)) collisions.push({ key, files: [seen.get(key), file.relative] });
    else seen.set(key, file.relative);
  }
  return { files, resources, bundles, collisions, keys: [...seen.keys()], kind: bundles.length ? "bundle" : resources.length ? "m4a" : "unknown" };
}
function fingerprint(root) {
  const digest = crypto.createHash("sha256");
  const buffer = Buffer.alloc(1024 * 1024);
  for (const file of walk(root, { includeDisabled: true }).sort((a, b) => a.relative.localeCompare(b.relative))) {
    digest.update(file.relative);
    const fd = fs.openSync(file.path, "r");
    try { let size; while ((size = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) digest.update(buffer.subarray(0, size)); }
    finally { fs.closeSync(fd); }
  }
  return digest.digest("hex");
}
function assertLoadable(root) {
  const result = inspect(root);
  if (result.bundles.length) throw Error(i18n.t("arknights.errors.convertFirst"));
  if (!result.resources.length) throw Error(i18n.t("arknights.errors.noResources"));
  if (result.collisions.length) throw Error(i18n.t("arknights.errors.collision", { name: result.collisions[0].key }));
  return result;
}
function renameDirectory(from, to, rename = fs.renameSync) {
  for (let attempt = 0; ; attempt++) {
    try { rename(from, to); return; }
    catch (error) {
      if (attempt >= 5 || !["EPERM", "EACCES", "EBUSY"].includes(error.code)) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25 * (attempt + 1));
    }
  }
}

module.exports = { BUNDLES, RESOURCES, DISABLED, ignored, inside, assertNoLinks, assertOutsideGame, walk, resourceKey, inspect, fingerprint, assertLoadable, renameDirectory };
