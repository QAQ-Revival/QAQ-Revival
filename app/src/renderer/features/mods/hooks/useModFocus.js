import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
import { saveCollectionSelection } from "../../../lib/collectionSelection.js";
export function useModFocus({
  modsListRef,
  setFocusPulseModName,
  focusPulseTimerRef,
  setOpenLocalCollectionGalleryMenu,
  setSelectedLocalCollectionVariants,
  viewMode,
  selectedMod,
  setSelectedMod,
  setDetailCollapsed,
  displayMods,
  enabledFocusCursorRef,
  setToast,
  pendingFocusRef,
  characterName,
  activeGameId,
  modsLoadVersion,
  sortMethod,
  galleryAnchorRef,
  detailCollapsed,
  managerTarget,
  mods,
  handledManagerTargetRef,
}) {
  function findModElementInList(modName) {
    const container = modsListRef.current;
    if (!container || !modName) return null;
    if (typeof CSS !== "undefined" && CSS.escape) {
      const escaped = CSS.escape(modName);
      const targetEl = container.querySelector(`[data-mod-name="${escaped}"]`);
      if (targetEl) return targetEl;
    }
    return (
      Array.from(container.querySelectorAll("[data-mod-name]")).find(
        (el) => el.dataset.modName === modName,
      ) || null
    );
  }
  function pulseMod(modName) {
    setFocusPulseModName(null);
    requestAnimationFrame(() => setFocusPulseModName(modName));
    clearTimeout(focusPulseTimerRef.current);
    focusPulseTimerRef.current = setTimeout(
      () => setFocusPulseModName(null),
      1200,
    );
  }
  function scrollToMod(modName, align = "center") {
    requestAnimationFrame(() => {
      const container = modsListRef.current;
      const targetEl = findModElementInList(modName);
      if (!container || !targetEl) return;
      const containerRect = container.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();
      const topEdge = containerRect.top + 16;
      const bottomEdge = containerRect.bottom - 16;
      let nextScrollTop = container.scrollTop;
      if (align === "top") {
        nextScrollTop += targetRect.top - topEdge;
      } else if (align === "center") {
        const visibleCenter = (topEdge + bottomEdge) / 2;
        nextScrollTop += targetRect.top + targetRect.height / 2 - visibleCenter;
      } else if (targetRect.top < topEdge) {
        nextScrollTop += targetRect.top - topEdge;
      } else if (targetRect.bottom > bottomEdge) {
        nextScrollTop += targetRect.bottom - bottomEdge;
      }
      const maxScrollTop = Math.max(
        container.scrollHeight - container.clientHeight,
        0,
      );
      nextScrollTop = Math.max(0, Math.min(nextScrollTop, maxScrollTop));
      container.scrollTo({
        top: nextScrollTop,
        behavior: "smooth",
      });
      pulseMod(modName);
    });
  }
  function selectLocalCollectionVariant(identity, variant) {
    if (!identity || !variant) return;
    setOpenLocalCollectionGalleryMenu(null);
    setSelectedLocalCollectionVariants((prev) => ({
      ...prev,
      [identity]: variant.name,
    }));
    saveCollectionSelection(activeGameId, characterName, identity, variant.name);
    if (viewMode === "gallery" && selectedMod?.name) {
      captureGalleryAnchor(selectedMod.name);
    }
    setSelectedMod(variant);
    setDetailCollapsed(false);
    scrollToMod(variant.name, "nearest");
  }
  function focusNextEnabledMod() {
    const enabledMods = displayMods.filter((mod) => mod.enabled);
    if (enabledMods.length === 0) {
      enabledFocusCursorRef.current = -1;
      setToast({
        type: "error",
        message: t("mods.library.noEnabledMods"),
      });
      return;
    }
    enabledFocusCursorRef.current =
      (enabledFocusCursorRef.current + 1) % enabledMods.length;
    const targetMod = enabledMods[enabledFocusCursorRef.current];
    if (viewMode === "gallery") {
      if (selectedMod?.name) captureGalleryAnchor(selectedMod.name);
    }
    setDetailCollapsed(false);
    setSelectedMod(targetMod);
    scrollToMod(targetMod.name);
    setToast({
      type: "success",
      message:
        enabledMods.length > 1
          ? t("mods.library.locatedProgress", {
              name: targetMod.name,
              count: enabledFocusCursorRef.current + 1,
              enabledModsCount: enabledMods.length,
            })
          : t("mods.library.located", {
              name: targetMod.name,
            }),
    });
  }
  React.useEffect(() => {
    const pending = pendingFocusRef.current;
    if (
      !pending ||
      pending.characterName !== characterName ||
      displayMods.length === 0 ||
      !modsListRef.current ||
      modsLoadVersion < (pending.targetLoadVersion || 0)
    ) {
      return;
    }
    const targetMod =
      displayMods.find((mod) => mod.name === pending.modName) ||
      (pending.forceTop && pending.preferTopAfterSort ? displayMods[0] : null);
    pendingFocusRef.current = null;
    if (!targetMod) return;
    const container = modsListRef.current;
    setSelectedMod(targetMod);
    requestAnimationFrame(() => {
      let targetEl = null;
      if (typeof CSS !== "undefined" && CSS.escape) {
        targetEl = container.querySelector(
          `[data-mod-name="${CSS.escape(targetMod.name)}"]`,
        );
      }
      if (!targetEl) {
        targetEl = Array.from(
          container.querySelectorAll("[data-mod-name]"),
        ).find((el) => el.dataset.modName === targetMod.name);
      }
      if (!targetEl) return;
      const containerRect = container.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();
      const topEdge = containerRect.top + 16;
      const bottomEdge = containerRect.bottom - 16;
      const shouldStickToTop = pending.forceTop || pending.preferTopAfterSort;
      let nextScrollTop = container.scrollTop;
      if (shouldStickToTop || targetRect.top < topEdge) {
        nextScrollTop += targetRect.top - topEdge;
      } else if (targetRect.bottom > bottomEdge) {
        nextScrollTop += targetRect.bottom - bottomEdge;
      }
      nextScrollTop = Math.max(
        0,
        Math.min(
          nextScrollTop,
          Math.max(container.scrollHeight - container.clientHeight, 0),
        ),
      );
      container.scrollTo({
        top: nextScrollTop,
        behavior: "smooth",
      });
      setFocusPulseModName(null);
      requestAnimationFrame(() => setFocusPulseModName(targetMod.name));
      clearTimeout(focusPulseTimerRef.current);
      focusPulseTimerRef.current = setTimeout(
        () => setFocusPulseModName(null),
        1200,
      );
    });
  }, [displayMods, sortMethod, characterName, modsLoadVersion]);
  const captureGalleryAnchor = (modName) => {
    if (viewMode !== "gallery") return;
    const container = modsListRef.current;
    if (!container || !modName) {
      galleryAnchorRef.current = null;
      return;
    }
    let el = null;
    if (typeof CSS !== "undefined" && CSS.escape) {
      el = container.querySelector(`[data-mod-name="${CSS.escape(modName)}"]`);
    }
    if (!el) {
      el = Array.from(container.querySelectorAll("[data-mod-name]")).find(
        (node) => node.dataset.modName === modName,
      );
    }
    if (!el) {
      galleryAnchorRef.current = null;
      return;
    }
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    galleryAnchorRef.current = {
      modName,
      offsetFromTop: elRect.top - containerRect.top,
    };
  };
  React.useEffect(() => {
    if (viewMode !== "gallery") return;
    const anchor = galleryAnchorRef.current;
    if (!anchor) return;
    const container = modsListRef.current;
    if (!container) return;
    let canceled = false;
    const startTime = performance.now();
    const duration = 560;
    const step = (now) => {
      if (canceled) return;
      let el = null;
      if (typeof CSS !== "undefined" && CSS.escape) {
        el = container.querySelector(
          `[data-mod-name="${CSS.escape(anchor.modName)}"]`,
        );
      }
      if (!el) {
        el = Array.from(container.querySelectorAll("[data-mod-name]")).find(
          (node) => node.dataset.modName === anchor.modName,
        );
      }
      if (el) {
        const currentOffset =
          el.getBoundingClientRect().top -
          container.getBoundingClientRect().top;
        const delta = currentOffset - anchor.offsetFromTop;
        if (Math.abs(delta) > 0.5) container.scrollTop += delta;
      }
      if (now - startTime < duration) {
        requestAnimationFrame(step);
      } else {
        galleryAnchorRef.current = null;
      }
    };
    requestAnimationFrame(step);
    return () => {
      canceled = true;
    };
  }, [detailCollapsed, viewMode]);
  React.useEffect(() => {
    if (
      !managerTarget ||
      managerTarget.characterName !== characterName ||
      !managerTarget.modName ||
      mods.length === 0
    ) {
      return;
    }
    if (
      managerTarget.requestId &&
      handledManagerTargetRef.current === managerTarget.requestId
    ) {
      return;
    }
    const targetMod = mods.find((mod) => mod.name === managerTarget.modName);
    if (!targetMod) {
      handledManagerTargetRef.current =
        managerTarget.requestId || managerTarget.modName;
      setToast({
        type: "error",
        message: t("mods.library.notFound", {
          modName: managerTarget.modName,
        }),
      });
      return;
    }
    handledManagerTargetRef.current = managerTarget.requestId || targetMod.name;
    setSelectedMod(targetMod);
    scrollToMod(targetMod.name, "center");
  }, [managerTarget, mods, characterName]);
  return {
    selectLocalCollectionVariant,
    focusNextEnabledMod,
    captureGalleryAnchor,
  };
}
