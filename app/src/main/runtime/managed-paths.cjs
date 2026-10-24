"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
function readManagedPathMappings(dataRoot) {
  const destination = path.join(dataRoot, "XXMI");
  try {
    const marker = JSON.parse(fs.readFileSync(path.join(destination, ".qaqr-managed.json"), "utf8"));
    if (marker.protocol !== 1 || marker.owner !== "QAQ-Revival" || !path.win32.isAbsolute(marker.migratedFrom) || !fs.existsSync(path.join(destination, "Resources/Bin/XXMI Launcher.exe"))) return [];
    if (path.win32.resolve(marker.migratedFrom).toLowerCase() === path.win32.resolve(destination).toLowerCase()) return [];
    return [{ from: marker.migratedFrom, to: destination }];
  } catch { return []; }
}
function remapPath(value, mappings, key = false) {
  if (typeof value !== "string" || !path.win32.isAbsolute(value)) return value;
  const normalized = path.win32.normalize(value);
  for (const mapping of mappings) {
    const from = path.win32.resolve(mapping.from);
    const relative = path.win32.relative(from, normalized);
    if (relative === ".." || relative.startsWith("..\\") || path.win32.isAbsolute(relative)) continue;
    let next = path.win32.join(mapping.to, relative);
    if (/[\\/]$/.test(value) && !/[\\/]$/.test(next)) next += "\\";
    if (value.includes("/") && !value.includes("\\")) next = next.replace(/\\/g, "/");
    if (key && value === value.toLowerCase()) next = next.toLowerCase();
    return next;
  }
  return value;
}
function mergeExisting(existing, moved) {
  if (Array.isArray(existing) && Array.isArray(moved)) {
    const seen = new Set(existing.map(value => JSON.stringify(value)));
    for (const value of moved) if (!seen.has(JSON.stringify(value))) { existing.push(value); seen.add(JSON.stringify(value)); }
  } else if (existing && moved && typeof existing === "object" && typeof moved === "object" && !Array.isArray(existing) && !Array.isArray(moved)) {
    for (const [key, value] of Object.entries(moved)) {
      if (!Object.hasOwn(existing, key)) Object.defineProperty(existing, key, { value, enumerable: true, writable: true, configurable: true });
      else mergeExisting(existing[key], value);
    }
  }
  return existing;
}
function remapManagedPaths(value, mappings) {
  if (!mappings.length) return { value, changes: 0 };
  let changes = 0;
  function visit(item) {
    if (typeof item === "string") {
      const next = remapPath(item, mappings);
      if (next !== item) changes++;
      return next;
    }
    if (Array.isArray(item)) { item.forEach((value, index) => { item[index] = visit(value); }); return item; }
    if (!item || typeof item !== "object") return item;
    const moved = [];
    for (const [key, original] of Object.entries(item)) {
      const updated = visit(original);
      const nextKey = remapPath(key, mappings, true);
      if (nextKey !== key) { changes++; moved.push({ key, nextKey, value: updated }); }
      else item[key] = updated;
    }
    for (const { key, nextKey, value } of moved) {
      delete item[key];
      if (Object.hasOwn(item, nextKey)) mergeExisting(item[nextKey], value);
      else Object.defineProperty(item, nextKey, { value, enumerable: true, writable: true, configurable: true });
    }
    return item;
  }
  return { value: visit(value), changes };
}
function runtimeJsonFiles(profile, dataRoot) {
  const files = [];
  const optimizer = path.join(dataRoot, "XXMI/Resources/Cache/Ini Optimizer");
  if (fs.existsSync(optimizer)) for (const entry of fs.readdirSync(optimizer, { withFileTypes: true })) if (entry.isFile() && /\.json$/i.test(entry.name)) files.push(path.join(optimizer, entry.name));
  const fixerRoot = path.join(profile, "fix");
  function visit(dir, depth) {
    if (depth > 4 || !fs.existsSync(dir) || fs.lstatSync(dir).isSymbolicLink()) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(file, depth + 1);
      else if (/^settings\.json$/i.test(entry.name)) files.push(file);
    }
  }
  visit(fixerRoot, 0);
  return files;
}
function repairRuntimeJsonFile(file, mappings, { backupRoot } = {}) {
  const original = fs.readFileSync(file);
  const result = remapManagedPaths(JSON.parse(original.toString("utf8").replace(/^\uFEFF/, "")), mappings);
  if (!result.changes) return { changes: 0 };
  if (backupRoot) {
    fs.mkdirSync(backupRoot, { recursive: true });
    const name = crypto.createHash("sha256").update(path.resolve(file)).digest("hex").slice(0, 16) + ".json";
    const backup = path.join(backupRoot, name);
    fs.writeFileSync(backup, original, { flag: "wx" });
    if (!fs.readFileSync(backup).equals(original)) throw Error("Runtime configuration backup verification failed");
  }
  const temporary = `${file}.qaqr-migration-${crypto.randomUUID()}`;
  try {
    fs.writeFileSync(temporary, JSON.stringify(result.value, null, 2));
    if (!fs.readFileSync(file).equals(original)) throw Error("Runtime configuration changed during migration");
    fs.renameSync(temporary, file);
  } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  return { changes: result.changes };
}
function repairManagedRuntimeFiles(profile, dataRoot, mappings, options) {
  const updated = [], errors = [];
  if (!mappings.length) return { updated, errors };
  for (const file of runtimeJsonFiles(profile, dataRoot)) {
    try { const result = repairRuntimeJsonFile(file, mappings, options); if (result.changes) updated.push({ file, changes: result.changes }); }
    catch (error) { errors.push({ file, error: error.message }); }
  }
  return { updated, errors };
}
module.exports = { readManagedPathMappings, remapManagedPaths, runtimeJsonFiles, repairRuntimeJsonFile, repairManagedRuntimeFiles };
