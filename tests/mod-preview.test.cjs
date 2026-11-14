const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const previews = require('../app/src/main/mods/preview-gallery.cjs');

function fixture(t) {
  const parent = fs.realpathSync(os.tmpdir());
  const root = fs.mkdtempSync(path.join(parent, 'qaqr-preview-'));
  t.after(() => { assert.equal(path.dirname(fs.realpathSync(root)), parent); fs.rmSync(root, { recursive: true, force: true }); });
  const mod = path.join(root, 'DISABLED_多图 Mod');
  const write = (name, content = name) => { const file = path.join(mod, name); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); return file; };
  write('preview.png'); write('图2.jpg'); write('图10.jpg'); write('gallery/选中的 # 图.webp');
  write('.history/old.png'); write('dump/capture.png'); write('Textures/normal.dds');
  return { root, mod, write };
}
test('a nested choice survives reloading, toggling, renaming and moving without replacing source images', async t => {
  const f = fixture(t);
  assert.deepEqual((await previews.listImages(f.mod)).images.map(image => image.id), ['preview.png', '图2.jpg', '图10.jpg', 'gallery/选中的 # 图.webp']);
  const chosen = 'gallery/选中的 # 图.webp';
  const original = fs.readFileSync(path.join(f.mod, 'preview.png'));
  previews.selectImage(f.mod, chosen);
  assert.equal(previews.findPreviewImageFile(f.mod), path.join(f.mod, chosen));
  const renamed = path.join(f.root, '新名称');
  assert.equal(path.dirname(f.mod), f.root); assert.equal(path.dirname(renamed), f.root);
  fs.renameSync(f.mod, renamed);
  const freshlyLoaded = require('../app/src/main/mods/preview-gallery.cjs');
  assert.equal((await freshlyLoaded.listImages(renamed)).selectedImageId, chosen);
  assert.deepEqual(fs.readFileSync(path.join(renamed, 'preview.png')), original);
  assert.equal(fs.readFileSync(path.join(renamed, chosen), 'utf8'), chosen);
  assert.equal(fs.readFileSync(path.join(renamed, previews.STATE_FILE), 'utf8').includes(f.mod), false);
});
test('a deleted choice falls back and a new custom cover can become the default', async t => {
  const f = fixture(t);
  previews.selectImage(f.mod, '图2.jpg');
  fs.unlinkSync(path.join(f.mod, '图2.jpg'));
  assert.equal((await previews.listImages(f.mod)).selectedImageId, 'preview.png');
  assert.equal(previews.findPreviewImageFile(f.mod), path.join(f.mod, 'preview.png'));
  f.write('preview.gif');
  previews.selectImage(f.mod, 'preview.gif');
  assert.equal((await previews.listImages(f.mod)).selectedImageId, 'preview.gif');
});
test('selection rejects paths outside the Mod, non-images, directories and hidden files', async t => {
  const f = fixture(t);
  f.write('folder.png/inside.jpg');
  for (const id of ['../outside.png', 'C:/outside.png', '/outside.png', 'gallery/../preview.png', 'gallery\\选中的 # 图.webp', 'Textures/normal.dds', 'folder.png', '.history/old.png', 'missing.png']) {
    assert.throws(() => previews.selectImage(f.mod, id));
  }
  assert.equal(fs.existsSync(path.join(f.mod, previews.STATE_FILE)), false);
  const gallery = await previews.listImages(f.mod);
  assert(gallery.images.every(image => image.id !== 'folder.png'));
});
test('linked image directories are neither scanned nor selectable', async t => {
  const f = fixture(t);
  const outside = path.join(f.root, 'outside'); fs.mkdirSync(outside); fs.writeFileSync(path.join(outside, 'secret.png'), 'outside');
  try { fs.symlinkSync(outside, path.join(f.mod, 'linked'), 'junction'); }
  catch (error) { if (error.code === 'EPERM') return t.skip('Junctions are unavailable'); throw error; }
  assert(!(await previews.listImages(f.mod)).images.some(image => image.id.startsWith('linked/')));
  assert.throws(() => previews.selectImage(f.mod, 'linked/secret.png'));
});
test('EFF can remember a choice outside its validated resource folder', async t => {
  const f = fixture(t);
  const options = { stateFile: path.join(f.root, 'preferences', 'eff.json') };
  previews.selectImage(f.mod, '图10.jpg', options);
  assert.equal(fs.existsSync(path.join(f.mod, previews.STATE_FILE)), false);
  assert.equal((await previews.listImages(f.mod, options)).selectedImageId, '图10.jpg');
  assert.equal(previews.findPreviewImageFile(f.mod, options), path.join(f.mod, '图10.jpg'));
});
