"use strict";

const electron = require("electron");
const fs = require("fs");
const path = require("path");
const crypto = require("node:crypto");
const previews = require("./preview-gallery.cjs");
// EFF validates the files beside mod.ini; keep manager preferences outside it.
function previewOptions(mod) {
  const key = crypto.createHash("sha256").update(path.resolve(mod.path).toLowerCase()).digest("hex");
  return { stateFile: path.join(electron.app.getPath("userData"), "mod-previews", "eff", key + ".json") };
}
function movePreviewSelection(from, to) {
  const source = previewOptions({ path: from }).stateFile;
  if (fs.existsSync(source)) fs.renameSync(source, previewOptions({ path: to }).stateFile);
}
// An EFF Mod named like an EFMI Mod of the same character is listed with this suffix.
const EFF_SUFFIX = " (EFF)";
function service() {
  try {
    return require("../games/endfield/service.cjs").effService || null;
  } catch {
    return null;
  }
}
const efmiHas = (characterPath, name) => !!characterPath && [name, `DISABLED_${name}`].some(folder => fs.existsSync(path.join(characterPath, folder)));
// An EFMI Mod of that name wins, so every existing Mods page action keeps its target.
function route(gameId, characterName, modName, efmiCharacterPath) {
  if (gameId !== "endfield") return null;
  const eff = service();
  if (!eff || efmiHas(efmiCharacterPath, modName)) return null;
  try {
    const mod = eff.resolveCharacterMod(characterName, modName, EFF_SUFFIX);
    return mod ? { eff, mod } : null;
  } catch {
    return null;
  }
}
// The Mods page entries of a character's EFF Mods, in the shape the EFMI entries have.
function entries({ gameId, characterName, efmiCharacterPath, taken, addedAtAccessor, pinnedState, imageUrl }) {
  if (gameId !== "endfield") return [];
  const eff = service();
  if (!eff) return [];
  let mods;
  try {
    mods = eff.characterMods(characterName);
  } catch {
    return [];
  }
  const names = new Set(taken);
  const listed = mods.map(mod => {
    const name = names.has(mod.folder) || efmiHas(efmiCharacterPath, mod.folder) ? mod.folder + EFF_SUFFIX : mod.folder;
    names.add(name);
    return { mod, name };
  });
  const pins = pinnedState(listed.map(item => ({ name: item.name })));
  return listed.map(({ mod, name }, index) => {
    const { addedAt, addedAtMs } = addedAtAccessor.get(characterName, name, mod.path);
    const preview = previews.findPreviewImageFile(mod.path, previewOptions(mod));
    return {
      name,
      originalName: name,
      enabled: mod.enabled,
      path: mod.path,
      previewUrl: preview ? imageUrl(preview) : null,
      addedAt,
      addedAtMs,
      tags: [],
      notes: "",
      hotkeyAliases: {},
      pinned: pins[index].pinned,
      pinnedIndex: pins[index].pinnedIndex,
      appearanceSectionId: "base",
      framework: "eff",
      eff: { id: mod.modId, format: mod.format, keys: mod.keys, keySwitch: mod.keySwitch }
    };
  });
}
// The game reads only .png beside an EFF Mod's resources, so any picture is stored as one.
function pngBytes(bytes) {
  const image = electron.nativeImage.createFromBuffer(bytes);
  if (image.isEmpty()) throw Error("Unsupported image");
  return image.toPNG();
}
module.exports = { EFF_SUFFIX, route, entries, pngBytes, previewOptions, movePreviewSelection };
