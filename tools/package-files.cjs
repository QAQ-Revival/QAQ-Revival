const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
function copyLocalComponents(sourceRoot, stage) {
  const source = path.join(sourceRoot, 'local-components');
  if (!fs.existsSync(source)) return false;
  if (!fs.lstatSync(source).isDirectory()) throw Error('local-components must be a directory');
  fs.cpSync(source, path.join(stage, 'local-components'), {
    recursive: true,
    filter: file => {
      if (fs.lstatSync(file).isSymbolicLink()) throw Error('Refusing to package a link in local-components');
      return true;
    }
  });
  return true;
}
async function hash(file) {
  const digest = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) digest.update(chunk);
  return digest.digest('hex');
}
async function inventory(directory) {
  const entries = {};
  async function visit(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(dir, entry.name), relative = path.relative(directory, file).split(path.sep).join('/');
      if (entry.isSymbolicLink()) throw Error('Refusing to package a link: ' + relative);
      if (entry.isDirectory()) { entries[relative] = { directory: true }; await visit(file); }
      else entries[relative] = { size: fs.statSync(file).size, sha256: await hash(file) };
    }
  }
  await visit(directory);
  return entries;
}
module.exports = { hash, inventory, copyLocalComponents };
