"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const IMAGE = /\.(png|jpe?g|webp|gif|bmp)$/i;
const STATE_FILE = ".qaqr-preview.json";

function imagePath(root, id) {
  if (typeof id !== "string" || !IMAGE.test(id) || /[\\:\x00-\x1f]/.test(id)) return null;
  const parts = id.split("/");
  if (parts.some(part => !part || part.startsWith(".") || /[. ]$/.test(part))) return null;
  try {
    let file = root;
    if (fs.lstatSync(root).isSymbolicLink()) return null;
    for (const part of parts) {
      file = path.join(file, part);
      if (fs.lstatSync(file).isSymbolicLink()) return null;
    }
    return fs.statSync(file).isFile() ? file : null;
  } catch { return null; }
}
const statePath = (root, options) => options?.stateFile || path.join(root, STATE_FILE);
function selectedImage(root, options) {
  try {
    const state = JSON.parse(fs.readFileSync(statePath(root, options), "utf8"));
    return state.version === 1 ? imagePath(root, state.image) : null;
  } catch { return null; }
}
function entries(root) {
  try {
    return fs.readdirSync(root, { withFileTypes: true }).filter(entry => !entry.name.startsWith(".") && !entry.isSymbolicLink()).sort((a, b) =>
      Number(/^preview\./i.test(b.name)) - Number(/^preview\./i.test(a.name)) || a.name.localeCompare(b.name, "zh-CN", { numeric: true })
    );
  } catch { return []; }
}
// Library thumbnails only read the remembered choice or root images. Recursive
// enumeration is reserved for the one Mod whose detail panel is being opened.
function findPreviewImageFile(root, options) {
  if (!root) return null;
  return selectedImage(root, options) || entries(root).filter(entry => entry.isFile() && IMAGE.test(entry.name)).map(entry => imagePath(root, entry.name)).find(Boolean) || null;
}
async function listImages(root, options) {
  const images = [];
  const queue = [root];
  while (queue.length) {
    const dir = queue.shift();
    let children;
    try {
      if ((await fs.promises.lstat(dir)).isSymbolicLink()) continue;
      children = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch { continue; }
    children.sort((a, b) => Number(/^preview\./i.test(b.name)) - Number(/^preview\./i.test(a.name)) || a.name.localeCompare(b.name, "zh-CN", { numeric: true }));
    for (const child of children) {
      if (child.name.startsWith(".") || child.isSymbolicLink()) continue;
      const file = path.join(dir, child.name);
      if (child.isDirectory()) {
        if (!/^(?:logs|dump|node_modules|shadercache)$/i.test(child.name)) queue.push(file);
      } else if (child.isFile() && IMAGE.test(child.name)) images.push({ id: path.relative(root, file).split(path.sep).join("/"), path: file });
    }
  }
  const selected = selectedImage(root, options);
  return { images, selectedImageId: images.find(image => image.path === selected)?.id || images[0]?.id || null };
}
function selectImage(root, id, options) {
  const file = imagePath(root, id);
  if (!file) throw Error("Preview image is missing or outside the Mod folder");
  const target = statePath(root, options);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temp = path.join(path.dirname(target), `.qaqr-preview-${crypto.randomUUID()}.tmp`);
  try {
    fs.writeFileSync(temp, JSON.stringify({ version: 1, image: id }) + "\n", { flag: "wx" });
    fs.renameSync(temp, target);
  } finally {
    if (fs.existsSync(temp)) fs.unlinkSync(temp);
  }
  return file;
}

module.exports = { STATE_FILE, imagePath, findPreviewImageFile, listImages, selectImage };
