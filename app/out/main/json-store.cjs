'use strict';
const fs = require('node:fs');
const path = require('node:path');

function removeIfPresent(file) {
  try { fs.unlinkSync(file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
function cleanup(file) {
  try { removeIfPresent(file); } catch { /* Cleanup must not turn a committed save into a failure. */ }
}
function previousContents(file) {
  let snapshot;
  try { snapshot = JSON.parse(fs.readFileSync(file + '.backup', 'utf8')); }
  catch (cause) { throw new Error('JSON recovery snapshot is unreadable', { cause }); }
  if (!snapshot || (snapshot.previous !== null && typeof snapshot.previous !== 'string')) throw Error('Invalid JSON recovery snapshot');
  return snapshot.previous;
}
function restore(file) {
  if (!fs.existsSync(file + '.copying')) return;
  const previous = previousContents(file);
  if (previous === null) removeIfPresent(file);
  else fs.writeFileSync(file, previous, 'utf8');
  // Until this marker is removed, readers use the snapshot, never a partial copy.
  fs.unlinkSync(file + '.copying');
  cleanup(file + '.backup');
}
function readJsonFileSync(file) {
  if (fs.existsSync(file + '.copying')) {
    const previous = previousContents(file);
    if (previous === null) throw Object.assign(Error('JSON file has not been saved yet'), { code: 'ENOENT' });
    return JSON.parse(previous);
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function writeJsonFileSync(file, value) {
  const contents = JSON.stringify(value);
  if (contents === undefined) throw TypeError('Value is not JSON serializable');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  restore(file);
  const temporary = file + '.tmp';
  try {
    fs.writeFileSync(temporary, contents, 'utf8');
    try {
      fs.renameSync(temporary, file);
      return;
    } catch (error) {
      if (error.code !== 'EXDEV') throw error;
    }
    // Some Windows filesystems reject rename even within one directory. Copying
    // is not atomic: save a rollback snapshot before touching the destination.
    let previous;
    try { previous = fs.readFileSync(file, 'utf8'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; previous = null; }
    fs.writeFileSync(file + '.backup', JSON.stringify({ previous }), 'utf8');
    fs.writeFileSync(file + '.copying', '', { flag: 'wx' });
    try {
      fs.copyFileSync(temporary, file);
      fs.unlinkSync(file + '.copying');
    } catch (error) {
      try { restore(file); } catch { /* Keep the snapshot available to readers and the next save. */ }
      throw error;
    }
  } finally {
    cleanup(temporary);
    if (!fs.existsSync(file + '.copying')) cleanup(file + '.backup');
  }
}
module.exports = { readJsonFileSync, writeJsonFileSync };
