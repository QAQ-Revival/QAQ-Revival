import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
import { getModAppearanceSectionId } from "../model/modHelpers.js";
export function useModOrdering({
  characterName,
  mods,
  activeAppearanceSectionId,
  setMods,
  setToast,
}) {
  const [modSearchQuery, setModSearchQuery] = React.useState("");
  const [selectedTagFilters, setSelectedTagFilters] = React.useState(
    () => new Set(),
  );
  const toggleTagFilter = React.useCallback((tag) => {
    const key = String(tag || "")
      .trim()
      .toLowerCase();
    if (!key) return;
    setSelectedTagFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);
  const clearTagFilters = React.useCallback(() => {
    setSelectedTagFilters((prev) => (prev.size === 0 ? prev : new Set()));
  }, []);
  const [sortMethod, setSortMethod] = React.useState(() => {
    return localStorage.getItem("modview-sort") || "name";
  });
  const [sortedMods, setSortedMods] = React.useState([]);
  const enabledOnEntryRef = React.useRef(new Map());
  const customOrderRef = React.useRef(new Map());
  const manuallyOrderedSectionsRef = React.useRef(new Set());
  const [draggedMod, setDraggedMod] = React.useState(null);
  const [dragOverMod, setDragOverMod] = React.useState(null);
  React.useEffect(() => {
    // Names survive the folder rename used to toggle a Mod. Refreshing its
    // status must not change its position during this visit to the page.
    for (const mod of mods) {
      if (!enabledOnEntryRef.current.has(mod.name)) {
        enabledOnEntryRef.current.set(mod.name, !!mod.enabled);
      }
      if (!customOrderRef.current.has(mod.name)) {
        customOrderRef.current.set(mod.name, customOrderRef.current.size);
      }
    }
    applySort(
      mods.filter(
        (mod) => getModAppearanceSectionId(mod) === activeAppearanceSectionId,
      ),
      sortMethod,
    );
    localStorage.setItem("modview-sort", sortMethod);
  }, [
    mods,
    sortMethod,
    modSearchQuery,
    selectedTagFilters,
    activeAppearanceSectionId,
  ]);
  function sortPinnedModsFirst(list, sortRest) {
    const pinned = list
      .filter((mod) => mod.pinned)
      .sort((a, b) => {
        const diff =
          (a.pinnedIndex ?? Number.MAX_SAFE_INTEGER) -
          (b.pinnedIndex ?? Number.MAX_SAFE_INTEGER);
        if (diff !== 0) return diff;
        return a.name.localeCompare(b.name, "zh-CN");
      });
    const normal = list.filter((mod) => !mod.pinned);
    if (typeof sortRest === "function") {
      normal.sort(sortRest);
    }
    return [...pinned, ...normal];
  }
  function applySort(list, method) {
    let filtered = list;
    if (modSearchQuery) {
      const q = modSearchQuery.toLowerCase();
      filtered = list.filter((m) => {
        if (m.name && m.name.toLowerCase().includes(q)) return true;
        if (
          Array.isArray(m.tags) &&
          m.tags.some((t) => String(t).toLowerCase().includes(q))
        )
          return true;
        if (m.notes && String(m.notes).toLowerCase().includes(q)) return true;
        return false;
      });
    }
    if (selectedTagFilters.size > 0) {
      filtered = filtered.filter((m) => {
        if (!Array.isArray(m.tags) || m.tags.length === 0) return false;
        const modTagKeys = new Set(m.tags.map((t) => String(t).toLowerCase()));
        for (const sel of selectedTagFilters) {
          if (!modTagKeys.has(sel)) return false;
        }
        return true;
      });
    }
    const groupEnabled =
      method !== "custom" ||
      !manuallyOrderedSectionsRef.current.has(activeAppearanceSectionId);
    const sorted = sortPinnedModsFirst(filtered, (a, b) => {
      if (groupEnabled) {
        const enabledDiff =
          Number(enabledOnEntryRef.current.get(b.name)) -
          Number(enabledOnEntryRef.current.get(a.name));
        if (enabledDiff) return enabledDiff;
      }
      if (method === "name" || method === "enabled") {
        return a.name.localeCompare(b.name, "zh-CN");
      } else if (method === "time") {
        const timeDiff = (b.addedAtMs || 0) - (a.addedAtMs || 0);
        if (timeDiff !== 0) return timeDiff;
        return a.name.localeCompare(b.name, "zh-CN");
      } else if (method === "custom") {
        return (
          customOrderRef.current.get(a.name) -
          customOrderRef.current.get(b.name)
        );
      }
      return 0;
    });
    setSortedMods(sorted);
  }
  function prioritizeEnabledMods() {
    const sectionMods = mods.filter(
      (mod) => getModAppearanceSectionId(mod) === activeAppearanceSectionId,
    );
    for (const mod of sectionMods) {
      enabledOnEntryRef.current.set(mod.name, !!mod.enabled);
    }
    manuallyOrderedSectionsRef.current.delete(activeAppearanceSectionId);
    applySort(sectionMods, sortMethod);
  }
  function handleModDragStart(e, mod) {
    setDraggedMod(mod);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", mod.name);
    setTimeout(() => {
      e.target.style.opacity = "0.5";
    }, 0);
  }
  function handleModDragEnd(e) {
    e.target.style.opacity = "1";
    setDraggedMod(null);
    setDragOverMod(null);
  }
  async function handleModDrop(e, targetMod) {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedMod || draggedMod.name === targetMod.name) {
      setDraggedMod(null);
      setDragOverMod(null);
      return;
    }
    const reorderedVisibleMods = [...sortedMods];
    const draggedIndex = reorderedVisibleMods.findIndex(
      (m) => m.name === draggedMod.name,
    );
    const targetIndex = reorderedVisibleMods.findIndex(
      (m) => m.name === targetMod.name,
    );
    if (draggedIndex !== -1 && targetIndex !== -1) {
      const [removed] = reorderedVisibleMods.splice(draggedIndex, 1);
      reorderedVisibleMods.splice(targetIndex, 0, removed);
      const reorderedNames = new Set(
        reorderedVisibleMods.map((mod) => mod.name),
      );
      const replacementQueue = [...reorderedVisibleMods];
      const mergedOrder = mods.map((mod) =>
        getModAppearanceSectionId(mod) === activeAppearanceSectionId &&
        reorderedNames.has(mod.name)
          ? replacementQueue.shift()
          : mod,
      );
      manuallyOrderedSectionsRef.current.add(activeAppearanceSectionId);
      mergedOrder.forEach((mod, index) =>
        customOrderRef.current.set(mod.name, index),
      );
      setSortedMods(reorderedVisibleMods);
      setMods(mergedOrder);
      setSortMethod("custom");
      try {
        const orderArray = mergedOrder.map((m) => m.name);
        await window.api.saveModOrder(characterName, orderArray);
        setToast({
          type: "success",
          message: t("mods.library.orderSaved"),
        });
      } catch (err) {
        console.error("Failed to save mod order:", err);
      }
    }
    setDraggedMod(null);
    setDragOverMod(null);
  }
  return {
    modSearchQuery,
    setModSearchQuery,
    selectedTagFilters,
    toggleTagFilter,
    clearTagFilters,
    sortMethod,
    setSortMethod,
    sortedMods,
    prioritizeEnabledMods,
    draggedMod,
    dragOverMod,
    setDragOverMod,
    handleModDragStart,
    handleModDragEnd,
    handleModDrop,
  };
}
