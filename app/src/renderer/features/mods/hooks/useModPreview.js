import React from "react";
import { t } from "../../../../shared/i18n/index.mjs";
import { previewAspectRatioCache } from "../model/modHelpers.js";

export function useModPreview({ activeGameId, characterName, selectedMod, selectedModRef, setMods, setPreviewImage, loadModDetails, setToast }) {
  const key = `${activeGameId}\0${characterName}\0${selectedMod?.name || ""}`;
  const context = React.useRef(key);
  const revision = React.useRef(0);
  const pending = React.useRef(null);
  const stateRef = React.useRef({ key, images: [], id: null });
  const [state, setState] = React.useState(stateRef.current);
  if (context.current !== key) {
    context.current = key;
    revision.current++;
    pending.current = null;
  }
  function update(next) {
    stateRef.current = next;
    setState(next);
  }
  function updateIcon(name, previewUrl) {
    setMods(mods => mods.some(mod => mod.name === name && mod.previewUrl !== previewUrl)
      ? mods.map(mod => mod.name === name ? { ...mod, previewUrl } : mod)
      : mods);
  }
  function acceptDetails(result, expectedRevision) {
    if (revision.current !== expectedRevision || context.current !== key) return;
    update({ key, images: result.previewImages || [], id: result.previewImageId });
    setPreviewImage(result.previewUrl);
    if (selectedModRef.current) updateIcon(selectedModRef.current.name, result.previewUrl);
  }
  function onPreviewChanged(data) {
    const inFlight = pending.current;
    if (inFlight?.name === data.modName && inFlight.key === key && inFlight.id !== data.previewImageId) return;
    updateIcon(data.modName, data.previewUrl);
    if (selectedModRef.current?.name !== data.modName) return;
    if (!inFlight) revision.current++;
    setPreviewImage(data.previewUrl);
    previewAspectRatioCache.delete(selectedModRef.current.path || data.modName);
    const current = stateRef.current;
    if (current.key === key && current.images.some(image => image.id === data.previewImageId) && !data.galleryChanged) {
      update({ ...current, id: data.previewImageId, images: current.images.map(image => image.id === data.previewImageId ? { ...image, url: data.previewUrl } : image) });
    } else {
      update({ key, images: [], id: null });
      loadModDetails(data.modName);
    }
  }
  async function changePreview(direction) {
    const current = stateRef.current;
    const mod = selectedModRef.current;
    if (!mod || current.key !== key || current.images.length < 2) return;
    const index = Math.max(0, current.images.findIndex(image => image.id === current.id));
    const image = current.images[(index + direction + current.images.length) % current.images.length];
    const request = { key, name: mod.name, id: image.id, revision: ++revision.current };
    pending.current = request;
    update({ ...current, id: image.id });
    setPreviewImage(image.url);
    updateIcon(mod.name, image.url);
    previewAspectRatioCache.delete(mod.path || mod.name);
    try {
      const result = await window.api.selectModPreview(characterName, mod.name, image.id, activeGameId);
      if (context.current !== key || revision.current !== request.revision) return;
      if (!result?.success) throw Error(result?.error || t("common.errors.unknown"));
      setPreviewImage(result.previewUrl);
      updateIcon(mod.name, result.previewUrl);
    } catch (error) {
      if (context.current !== key || revision.current !== request.revision) return;
      setToast({ type: "error", message: t("mods.preview.saveFailed", { error: error.message }) });
      loadModDetails(mod.name);
    } finally {
      if (pending.current === request) pending.current = null;
    }
  }
  const images = state.key === key ? state.images : [];
  return { images, index: Math.max(0, images.findIndex(image => image.id === state.id)), changePreview, acceptDetails, onPreviewChanged, revision };
}
