"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const digest = file => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

// Copy and verify everything before removing any legacy file. Never follow game-folder links,
// overwrite a different Mod, or recursively delete a game directory.
function stageLegacyFiles(plugin, destinations) {
  const files = [], directories = new Map();
  function plain(file) {
    for (let current = path.resolve(file); current !== path.dirname(current); current = path.dirname(current)) {
      if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw Error(`Linked EFF data cannot be migrated: ${current}`);
    }
  }
  function visit(source, target) {
    if (!fs.existsSync(source)) return;
    plain(target);
    const stat = fs.lstatSync(source);
    if (stat.isSymbolicLink()) throw Error(`Linked EFF data cannot be migrated: ${source}`);
    if (stat.isDirectory()) {
      if (fs.existsSync(target) && !fs.statSync(target).isDirectory()) throw Error(`EFF directory conflicts with a file: ${target}`);
      directories.set(source, target);
      for (const name of fs.readdirSync(source)) visit(path.join(source, name), path.join(target, name));
    } else if (stat.isFile()) {
      const sha256 = digest(source);
      if (fs.existsSync(target) && (fs.lstatSync(target).isSymbolicLink() || !fs.statSync(target).isFile() || digest(target) !== sha256)) {
        throw Error(`EFF data conflicts with the managed directory: ${target}`);
      }
      files.push({ source, target, sha256 });
    } else throw Error(`Unsupported EFF data: ${source}`);
  }
  plain(plugin);
  for (const [name, destination] of Object.entries(destinations)) visit(path.join(plugin, name), destination);
  for (const target of directories.values()) fs.mkdirSync(target, { recursive: true });
  for (const file of files) {
    fs.mkdirSync(path.dirname(file.target), { recursive: true });
    if (!fs.existsSync(file.target)) fs.copyFileSync(file.source, file.target, fs.constants.COPYFILE_EXCL);
    if (digest(file.target) !== file.sha256) throw Error(`EFF migration verification failed: ${file.target}`);
  }
  return () => {
    // An editor or a second process may have changed a source while it was being copied.
    for (const file of files) if (digest(file.source) !== file.sha256 || digest(file.target) !== file.sha256) throw Error(`EFF data changed during migration: ${file.source}`);
    for (const file of files) fs.unlinkSync(file.source);
    for (const dir of [...directories.keys()].sort((a, b) => b.length - a.length)) if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
    if (fs.existsSync(plugin) && fs.readdirSync(plugin).length === 0) fs.rmdirSync(plugin);
  };
}

module.exports = { stageLegacyFiles };
