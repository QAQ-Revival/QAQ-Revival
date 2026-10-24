"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const i18n = require("../../../shared/i18n/core.cjs");

const BUNDLES = new Set([".ab", ".bundle", ".unity3d"]);
const RESOURCES = new Set([".png", ".skel", ".atlas", ".wav", ".txt", ".json", ".ini"]);
const DISABLED = /^(?:DISABLED_|DISABLE_)/i;
const RESOURCE_MANIFEST = ".qaqr-resources.json";
const ignored = name => /^\.|^(?:logs|dump)$/i.test(name) || /^(?:preview|_cover)(?:[._]|$)/i.test(name) || /^(?:tags|info)\.json$|^(?:readme|licen[cs]e|copying)(?:\.|$)|^desktop\.ini$/i.test(name);

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
function walk(root, { includeDisabled = false, maxBytes = 2 * 1024 * 1024 * 1024, maxFiles = 20000 } = {}) {
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
        if (stat.size > 512 * 1024 * 1024 || bytes > maxBytes) throw Error(i18n.t("arknights.errors.tooLarge"));
        files.push({ path: file, relative: path.relative(root, file), name: entry.name, ext: path.extname(entry.name).toLowerCase(), size: stat.size, mtimeMs: stat.mtimeMs });
      }
      if (files.length > maxFiles) throw Error(i18n.t("arknights.errors.tooLarge"));
    }
  }
  visit(root, 0);
  return files;
}
function resourceKey(name) {
  return name.toLowerCase().replace(/[\x23@]/g, "_").replace(/(?:\[alphe?\]|_alpha)(?=\.png$)/, "[alpha]").replace(/^illust_(?=char_)/, "");
}
function readBindings(root) {
  const bindings = new Map();
  const manifests = [];
  // A manifest can bind thousands of files in the same directory. Verify each
  // ancestor once per scan, while still checking every resource for links.
  assertNoLinks(root);
  const checkedDirectories = new Set([path.resolve(root)]);
  function checkedStat(file) {
    const parent = path.dirname(path.resolve(file));
    if (!checkedDirectories.has(parent)) {
      assertNoLinks(parent);
      checkedDirectories.add(parent);
    }
    try {
      const stat = fs.lstatSync(file);
      if (stat.isSymbolicLink()) throw Error(i18n.t("arknights.errors.link"));
      return stat;
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
  }
  const relativePath = value => {
    if (typeof value !== "string" || !value || /[\\:\x00-\x1f]/.test(value) || value.split("/").some(part => !part || part === "." || part === ".." || /[. ]$/.test(part))) throw Error(i18n.t("arknights.errors.invalidManifest"));
    return value;
  };
  function visit(directory, depth = 0) {
    if (depth > 24) throw Error(i18n.t("arknights.errors.tooLarge"));
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.name === RESOURCE_MANIFEST) {
        const stat = checkedStat(file);
        if (!entry.isFile() || !stat?.isFile() || stat.size > 8 * 1024 * 1024) throw Error(i18n.t("arknights.errors.invalidManifest"));
        const data = JSON.parse(fs.readFileSync(file, "utf8"));
        if (data.schemaVersion !== 1 || !Array.isArray(data.resources) || data.resources.length > 20000) throw Error(i18n.t("arknights.errors.invalidManifest"));
        for (const item of data.resources) {
          const resource = path.join(directory, relativePath(item.file));
          const bundle = relativePath(item.bundle).toLowerCase();
          const target = relativePath(item.target);
          if (!inside(resource, directory) || bindings.has(resource.toLowerCase()) || !bundle.endsWith(".ab") || target.includes("/") || !checkedStat(resource)?.isFile()) throw Error(i18n.t("arknights.errors.invalidManifest"));
          if (item.appearanceAliases != null && (!Array.isArray(item.appearanceAliases) || item.appearanceAliases.length > 32 || item.appearanceAliases.some(alias => typeof alias !== "string" || !alias || alias.length > 512 || /[\x00-\x1f]/.test(alias)))) throw Error(i18n.t("arknights.errors.invalidManifest"));
          bindings.set(resource.toLowerCase(), { bundle, target, ...(item.appearanceAliases ? { appearanceAliases: item.appearanceAliases } : {}) });
        }
        manifests.push({ path: file, relative: path.relative(root, file), size: stat.size, mtimeMs: stat.mtimeMs });
      } else if (entry.isDirectory() && !ignored(entry.name) && !DISABLED.test(entry.name)) {
        if (!checkedStat(file)?.isDirectory()) throw Error(i18n.t("arknights.errors.invalidManifest"));
        checkedDirectories.add(path.resolve(file));
        visit(file, depth + 1);
      }
    }
  }
  visit(root);
  return { bindings, manifests };
}
function inspect(root) {
  const files = walk(root);
  const { bindings, manifests } = readBindings(root);
  const bundles = files.filter(file => BUNDLES.has(file.ext));
  const resources = files.filter(file => RESOURCES.has(file.ext));
  const collisions = [];
  const seen = new Map();
  const audioKeys = new Map();
  const identities = [];
  for (const ini of resources.filter(file => file.name.toLowerCase() === "mod.ini")) {
    const content = fs.readFileSync(ini.path, "utf8");
    const character = content.match(/^\s*character\s*=\s*(char_\d+_[\w]+)/im)?.[1];
    const group = content.match(/^\s*voice_group\s*=\s*(\w+)/im)?.[1];
    if (character && group) audioKeys.set(path.dirname(ini.path), `${group}/${character}`.toLowerCase());
  }
  for (const file of resources) {
    if ([".ini", ".txt", ".json"].includes(file.ext) && !/^(?:sp_dyn_|dyn_|entry_|front_|back_|build_)/i.test(file.name)) continue;
    const scope = file.ext === ".wav" ? [...audioKeys].filter(([dir]) => inside(file.path, dir)).sort((a, b) => b[0].length - a[0].length)[0]?.[1] : "";
    const binding = bindings.get(file.path.toLowerCase());
    const key = (scope ? `audio:${scope}/` : "") + resourceKey(binding?.target || file.name);
    const bundle = binding?.bundle || "";
    const identity = `${bundle}::${key}`;
    if (seen.has(identity)) collisions.push({ key: identity, files: [seen.get(identity), file.relative] });
    else seen.set(identity, file.relative);
    identities.push({ key, bundle, path: file.path });
  }
  return { files, resources, bundles, collisions, identities, manifests, keys: [...seen.keys()], kind: bundles.length ? "bundle" : resources.length ? "m4a" : "unknown" };
}
function fingerprint(root, options = {}) {
  const digest = crypto.createHash("sha256");
  const buffer = Buffer.alloc(1024 * 1024);
  for (const file of [...walk(root, { ...options, includeDisabled: true }), ...readBindings(root).manifests].sort((a, b) => a.relative.localeCompare(b.relative))) {
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

module.exports = { BUNDLES, RESOURCES, DISABLED, RESOURCE_MANIFEST, ignored, inside, assertNoLinks, assertOutsideGame, walk, resourceKey, readBindings, inspect, fingerprint, assertLoadable, renameDirectory };
