import { renderModDetails, renderHotkeys } from "./details.js";
import { renderModCards } from "./mod-cards.js";
import { collectModTags } from "../lib/modPresentation.js";
import { collectionSelectionKey, readCollectionSelections, saveCollectionSelection } from "../lib/collectionSelection.js";
import { getAppearanceSectionStorageKey, getModViewPreferenceStorageKey, readModViewPreferences } from "../features/mods/model/modHelpers.js";
import { getSectionName, getSectionId } from "../features/mods/model/appearanceSections.js";
import { t } from "../../shared/i18n/index.mjs";
import "./overlay.css";
import "./controls.css";
import { renderLayout } from "./overlay-layout.js";
import { escapeHtml, encodeHotkeyPayload } from "./html.js";
import {
  cleanCollectionText,
  normalizeCollectionKey,
} from "../../shared/mod-collection-names.mjs";
import {
  getCollectionVariantLabel,
  buildOverlayCollectionView,
} from "./collections.js";
import { initializeRendererI18n } from "../../shared/i18n/renderer.mjs";
document.body.innerHTML = renderLayout();
initializeRendererI18n(window.overlayApi);
let selectedChar = null;
let selectedCharIndex = 0;
let characters = [];
let currentMods = [];
let appearanceSections = [];
let activeAppearanceSectionId = "base";
let overlayModSearch = "";
let selectedTags = new Set();
let confirmingConflicts = false;
let currentCharacterAliases = [];
let presets = [];
let toastTimer = null;
let isPinned = false;
let selectedModName = null;
let detailRequestId = 0;
let detailSideOpen = false;
let detailSideKey = null;
let modListRequestId = 0;
let overlaySortMethod = "name";
let activityMods = [];
let activitySignature = "";
let activitySampledAt = 0;
let overlayIsOpen = false;
let activityManualSelection = false;
let activityRefreshPromise = null;
let activityOpenRequest = 0;
let activityEpoch = 0;
let charactersGameId = null;
let overlayExclusive = false;
// Keep display preferences across game sessions.
let overlayViewMode = (() => {
  try {
    const v = localStorage.getItem("qaqm.overlay.viewMode");
    // Default to gallery if user has never set the preference
    if (v === "gallery" || v === "list") return v;
    return "gallery";
  } catch {
    return "gallery";
  }
})();
let overlayCharFilterModOnly = (() => {
  try {
    const v = localStorage.getItem("qaqm.overlay.charFilterModOnly");
    // Default to true so empty-character entries are hidden out of the box
    return v === "false" ? false : true;
  } catch {
    return true;
  }
})();
let overlayCollectionsEnabled = (() => {
  try {
    const v = localStorage.getItem("qaqm.overlay.collectionsEnabled");
    // Collections are enabled until the user turns them off.
    return v === "false" ? false : true;
  } catch {
    return true;
  }
})();
let overlayInteractionOrder = {};
let overlaySettings = {
  autoReloadEnabled: true,
  presetAutoReloadEnabled: true,
  clickableHotkeysEnabled: true,
  overlayScale: 1,
  persistBridgeEnabled: false,
  persistBridgeCacheSize: null,
  compatibilityMode: false,
};
let contextMenuModName = null;
let charContextMenuName = null;
let pendingFocusState = null;
let overlayLastLocalChangeAt = 0;
let overlayRefreshingForGameChange = false;
let enabledFocusCursor = -1;
let overlayCollectionSelections = {};
let openOverlayCollectionMenu = null;
let overlayCollectionGroupsByIdentity = new Map();
const OVERLAY_SCALE_MIN = 0.85;
const OVERLAY_SCALE_MAX = 1.45;
const OVERLAY_SCALE_STEP = 0.15;
function normalizeOverlayScale(value) {
  const scale = Number(value);
  if (!Number.isFinite(scale)) return 1;
  return Math.max(OVERLAY_SCALE_MIN, Math.min(OVERLAY_SCALE_MAX, scale));
}
function applyOverlayScale(scale) {
  overlaySettings.overlayScale = normalizeOverlayScale(scale);
  document.documentElement.style.setProperty(
    "--overlay-ui-scale",
    overlaySettings.overlayScale.toFixed(2),
  );
  syncOverlayScaleUI();
}
function syncOverlayScaleUI() {
  const label = document.getElementById("overlayScaleLabel");
  const zoomIn = document.getElementById("overlayZoomIn");
  const zoomOut = document.getElementById("overlayZoomOut");
  const scale = normalizeOverlayScale(overlaySettings.overlayScale);
  if (label) label.textContent = `${Math.round(scale * 100)}%`;
  if (zoomIn) zoomIn.disabled = scale >= OVERLAY_SCALE_MAX - 0.001;
  if (zoomOut) zoomOut.disabled = scale <= OVERLAY_SCALE_MIN + 0.001;
}
async function requestOverlayScale(nextScale) {
  const scale = normalizeOverlayScale(nextScale);
  applyOverlayScale(scale);
  try {
    const result = await window.overlayApi.resizeOverlay(scale);
    if (result?.success) {
      applyOverlayScale(result.scale);
    } else {
      showToast(result?.error || "Zoom failed");
    }
  } catch {
    showToast("Zoom failed");
  }
}
function syncSettingsUI() {
  applyOverlayScale(overlaySettings.overlayScale);
  document.documentElement.classList.toggle(
    "overlay-compat",
    !!overlaySettings.compatibilityMode,
  );
  document.getElementById("autoReloadToggle").checked =
    !!overlaySettings.autoReloadEnabled;
  document.getElementById("presetAutoReloadToggle").checked =
    !!overlaySettings.presetAutoReloadEnabled;
  document.getElementById("clickableHotkeysToggle").checked =
    !!overlaySettings.clickableHotkeysEnabled;
  document.getElementById("persistBridgeToggle").checked =
    !!overlaySettings.persistBridgeEnabled;
  document.getElementById("activityToggle").checked =
    overlaySettings.activityEnabled !== false;
  document.getElementById("autoLocateToggle").checked =
    overlaySettings.autoLocateEnabled !== false;
}
function showToast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.remove("show");
  void el.offsetWidth;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove("show");
  }, 2000);
}
function clearOverlaySelectionState() {
  detailRequestId++;
  selectedChar = null;
  selectedCharIndex = 0;
  selectedModName = null;
  currentMods = [];
  appearanceSections = [];
  document.getElementById("appearanceSections").innerHTML = "";
  document.getElementById("conflictConfirm").hidden = true;
  openOverlayCollectionMenu = null;
  enabledFocusCursor = -1;
  bubbleSideOpen = false;
  hideCuteContextMenu();
  document
    .querySelectorAll(".mod-item.selected, .mod-gallery-item.selected")
    .forEach((el) => el.classList.remove("selected"));
  document.getElementById("modCount").textContent = "0/0";
  document.getElementById("modList").innerHTML =
    `<div class="empty-state">${t("overlay.characters.empty")}</div>`;
  syncFocusEnabledUI();
}
function renderCharacterEmptyState(message) {
  document.getElementById("charList").innerHTML =
    `<div class="empty-state">${escapeHtml(message)}</div>`;
  clearOverlaySelectionState();
}
function findModRow(modName) {
  const container = document.getElementById("modList");
  if (!container || !modName) return null;
  // Match both list rows (.mod-item) and gallery cards (.mod-gallery-item)
  // since renderMods() now branches between them.
  if (typeof CSS !== "undefined" && CSS.escape) {
    const match = container.querySelector(
      `.mod-item[data-mod="${CSS.escape(modName)}"], .mod-gallery-item[data-mod="${CSS.escape(modName)}"]`,
    );
    if (match) return match;
  }
  return (
    Array.from(container.querySelectorAll(".mod-item, .mod-gallery-item")).find(
      (el) => el.dataset.mod === modName,
    ) || null
  );
}
function findOverlayCollectionIdentityForMod(modName) {
  if (!modName) return null;
  for (const [identity, group] of overlayCollectionGroupsByIdentity.entries()) {
    if (
      Array.isArray(group?.variants) &&
      group.variants.some((variant) => variant.name === modName)
    ) {
      return identity;
    }
  }
  const sorted = sortMods(currentMods);
  const displayMods = buildOverlayCollectionView(
    sorted,
    selectedChar,
    currentCharacterAliases,
    overlayCollectionSelections,
  );
  const direct = displayMods.find(
    (mod) => mod?.name === modName && mod?._collection?.identity,
  )?._collection?.identity;
  if (direct) return direct;
  for (const mod of displayMods) {
    const variants = mod?._collection?.variants;
    if (
      Array.isArray(variants) &&
      variants.some((variant) => variant.name === modName)
    ) {
      return mod._collection.identity;
    }
  }
  return null;
}
function prepareModFocusState(modName, options = {}) {
  const container = document.getElementById("modList");
  if (!modName || !container) return;
  const identity =
    options.collectionIdentity || findOverlayCollectionIdentityForMod(modName);
  if (identity) overlayCollectionSelections[identity] = modName;
  selectedModName = modName;
  pendingFocusState = {
    modName,
    scrollTop: Number.isFinite(Number(options.scrollTop))
      ? Number(options.scrollTop)
      : container.scrollTop,
    collectionIdentity: identity || null,
    center: options.center !== false,
  };
}
function applyOptimisticModState(modName, patch = {}) {
  let changed = false;
  currentMods = currentMods.map((mod) => {
    if (mod.name !== modName) return mod;
    changed = true;
    return {
      ...mod,
      ...patch,
    };
  });
  return changed;
}
function focusModRow(modName, options = {}) {
  const container = document.getElementById("modList");
  const target = findModRow(modName);
  if (!target || !container) return;
  target.classList.remove("focus-pulse");
  void target.offsetWidth;
  target.classList.add("focus-pulse");
  const firstVisibleRow = container.querySelector(
    ".mod-item, .mod-gallery-item",
  );
  const isFirstRow = firstVisibleRow === target;
  const targetOffsetTop = target.offsetTop;
  const targetHeight = target.offsetHeight || 0;
  const paddingTop =
    options.center === false
      ? Math.max(Math.min(container.clientHeight * 0.18, 56), 8)
      : overlaySortMethod === "status"
        ? 0
        : Math.max((container.clientHeight - targetHeight) / 2, 8);
  const nextScrollTop = isFirstRow
    ? 0
    : Math.max(
        0,
        Math.min(
          targetOffsetTop - paddingTop,
          Math.max(container.scrollHeight - container.clientHeight, 0),
        ),
      );
  container.scrollTo({
    top: nextScrollTop,
    behavior: "smooth",
  });
  clearTimeout(target._focusPulseTimer);
  target._focusPulseTimer = setTimeout(
    () => target.classList.remove("focus-pulse"),
    1200,
  );
}
function getEnabledModsInCurrentOrder() {
  return sortMods(getSectionMods()).filter((mod) => mod.enabled);
}
function syncFocusEnabledUI() {
  const btn = document.getElementById("focusEnabledBtn");
  if (!btn) return;
  const enabledCount = getSectionMods().filter((mod) => mod.enabled).length;
  btn.disabled = enabledCount === 0;
  btn.title =
    enabledCount > 0
      ? t("overlay.focus.enabledCount", {
          count: enabledCount,
        })
      : t("overlay.focus.noneEnabled");
}
function focusNextEnabledMod() {
  const enabledMods = getEnabledModsInCurrentOrder();
  if (enabledMods.length === 0) {
    enabledFocusCursor = -1;
    syncFocusEnabledUI();
    showToast(t("overlay.focus.noneEnabled"));
    return;
  }
  enabledFocusCursor = (enabledFocusCursor + 1) % enabledMods.length;
  const targetMod = enabledMods[enabledFocusCursor];
  document.querySelectorAll(".mod-item, .mod-gallery-item").forEach((el) => {
    el.classList.toggle("selected", el.dataset.mod === targetMod.name);
  });
  hideCuteContextMenu();
  focusModRow(targetMod.name);
  showToast(
    enabledMods.length > 1
      ? t("overlay.focus.position", {
          targetModName: targetMod.name,
          index: enabledFocusCursor + 1,
          count: enabledMods.length,
        })
      : t("overlay.focus.located", {
          targetModName: targetMod.name,
        }),
  );
}
function syncExclusiveUI() {
  document
    .getElementById("exclusiveBtn")
    .classList.toggle("active", !!overlayExclusive);
}
function syncOverlayCollectionsUI() {
  const btn = document.getElementById("overlayCollectionBtn");
  if (!btn) return;
  btn.classList.toggle("active", !!overlayCollectionsEnabled);
  btn.setAttribute(
    "aria-pressed",
    overlayCollectionsEnabled ? "true" : "false",
  );
  btn.title = overlayCollectionsEnabled
    ? t("overlay.collections.hide")
    : t("overlay.collections.description");
}
function toggleOverlayCollectionsEnabled() {
  const container = document.getElementById("modList");
  const focusName =
    selectedModName ||
    container?.querySelector(".mod-item.selected, .mod-gallery-item.selected")
      ?.dataset.mod ||
    null;
  const scrollTop = container ? container.scrollTop : 0;
  overlayCollectionsEnabled = !overlayCollectionsEnabled;
  try {
    localStorage.setItem(
      "qaqm.overlay.collectionsEnabled",
      String(overlayCollectionsEnabled),
    );
  } catch {}
  closeOverlayCollectionMenus();
  syncOverlayCollectionsUI();
  if (focusName && selectedChar) {
    prepareModFocusState(focusName, {
      scrollTop,
      center: false,
    });
  }
  if (selectedChar) renderMods();
  showToast(
    overlayCollectionsEnabled
      ? t("overlay.collections.enabled")
      : t("overlay.collections.disabled"),
  );
}

// Renders the small SVG icon + label inside the view-mode pill so the
// button always reflects the CURRENT mode (and its label hints at where
// a click will take you). Mirrors the manager's behaviour.
function syncViewModeUI() {
  const btn = document.getElementById("viewModeBtn");
  const iconSpan = document.getElementById("viewModeIcon");
  const labelSpan = document.getElementById("viewModeLabel");
  if (!btn || !iconSpan || !labelSpan) return;
  if (overlayViewMode === "gallery") {
    // currently gallery → clicking goes back to list
    iconSpan.innerHTML =
      '<svg width="10" height="10" viewBox="0 0 14 14"><rect x="1" y="2" width="12" height="2" rx="1" fill="currentColor"/><rect x="1" y="6" width="12" height="2" rx="1" fill="currentColor"/><rect x="1" y="10" width="12" height="2" rx="1" fill="currentColor"/></svg>';
    labelSpan.textContent = t("overlay.view.list");
  } else {
    iconSpan.innerHTML =
      '<svg width="10" height="10" viewBox="0 0 14 14"><rect x="1" y="1" width="5" height="5" rx="1" fill="currentColor"/><rect x="8" y="1" width="5" height="5" rx="1" fill="currentColor"/><rect x="1" y="8" width="5" height="5" rx="1" fill="currentColor"/><rect x="8" y="8" width="5" height="5" rx="1" fill="currentColor"/></svg>';
    labelSpan.textContent = t("overlay.view.gallery");
  }
}
function hideAllContextMenus() {
  document.getElementById("cuteContextMenu").classList.remove("show");
  document.getElementById("charContextMenu").classList.remove("show");
  closeOverlayCollectionMenus();
  contextMenuModName = null;
  charContextMenuName = null;
}
function hideOnlyCuteContextMenus() {
  document.getElementById("cuteContextMenu").classList.remove("show");
  document.getElementById("charContextMenu").classList.remove("show");
  contextMenuModName = null;
  charContextMenuName = null;
}
function closeOverlayCollectionMenus() {
  openOverlayCollectionMenu = null;
  document.querySelectorAll(".overlay-collection-menu").forEach((menu) => {
    menu.hidden = true;
  });
  const floatingMenu = document.getElementById("overlayCollectionFloatingMenu");
  if (floatingMenu) {
    floatingMenu.hidden = true;
    floatingMenu.innerHTML = "";
    floatingMenu.removeAttribute("data-collection");
  }
  document
    .querySelectorAll(".overlay-collection-dropdown")
    .forEach((dropdown) => {
      dropdown.classList.remove("menu-left", "menu-right");
    });
  document
    .querySelectorAll(".mod-gallery-item.collection-menu-open")
    .forEach((card) => {
      card.classList.remove("collection-menu-open");
    });
}
function selectOverlayCollectionVariant(identity, modName) {
  if (!identity || !currentMods.some(mod => mod.name === modName)) return;
  prepareModFocusState(modName, {
    collectionIdentity: identity,
    scrollTop: document.getElementById("modList").scrollTop,
  });
  closeOverlayCollectionMenus();
  saveCollectionSelection(charactersGameId, selectedChar, identity, modName);
  renderMods();
  requestAnimationFrame(() => focusModRow(modName));
  if (detailSideOpen && !bubbleSideOpen) openDetail(modName, { force: true, updateOnly: true });
}
function getOverlayCollectionForMod(modName) {
  const mod = currentMods.find(item => item.name === modName);
  if (!mod) return null;
  const sectionMods = currentMods.filter(item => (item.appearanceSectionId || "base") === (mod.appearanceSectionId || "base"));
  return buildOverlayCollectionView(sortMods(sectionMods), selectedChar, currentCharacterAliases, overlayCollectionSelections).find(item => item._collection?.variants.some(variant => variant.name === modName))?._collection || null;
}
function positionOverlayCollectionFloatingMenu(trigger, menu) {
  if (!trigger || !menu) return;
  const rect = trigger.getBoundingClientRect();
  const menuWidth = 150;
  const viewportWidth =
    window.innerWidth || document.documentElement.clientWidth || 0;
  const viewportHeight =
    window.innerHeight || document.documentElement.clientHeight || 0;
  const desiredTop = rect.bottom + 6;
  const measuredHeight = menu.offsetHeight || 154;
  let left = rect.right - menuWidth;
  let top = desiredTop;
  if (left < 8) left = rect.left;
  left = Math.max(8, Math.min(left, viewportWidth - menuWidth - 8));
  if (desiredTop + measuredHeight > viewportHeight - 8) {
    top = Math.max(8, rect.top - measuredHeight - 6);
  }
  menu.style.left = `${Math.round(left)}px`;
  menu.style.top = `${Math.round(top)}px`;
}
function showOverlayCollectionFloatingMenu(trigger, identity) {
  const menu = document.getElementById("overlayCollectionFloatingMenu");
  const group = overlayCollectionGroupsByIdentity.get(identity);
  if (!menu || !group || !Array.isArray(group.variants)) return;
  const currentName = trigger.closest("[data-mod]")?.dataset.mod || group.currentName;
  openOverlayCollectionMenu = identity;
  menu.dataset.collection = identity;
  menu.innerHTML = group.variants
    .map(
      (variant) => `
            <button class="overlay-collection-option ${variant.name === currentName ? "active" : ""}" data-collection-option="1" data-collection="${escapeHtml(identity)}" data-mod="${escapeHtml(variant.name)}" title="${escapeHtml(variant.name)}">
                <span>${escapeHtml(getCollectionVariantLabel(variant))}</span>
                <em>${variant.name === currentName ? "&#24403;&#21069;" : variant.enabled ? "&#21551;&#29992;" : ""}</em>
            </button>
        `,
    )
    .join("");
  menu.hidden = false;
  positionOverlayCollectionFloatingMenu(trigger, menu);
  menu.querySelectorAll('[data-collection-option="1"]').forEach((option) => {
    option.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    });
    option.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    });
    option.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      selectOverlayCollectionVariant(
        option.dataset.collection,
        option.dataset.mod,
      );
    });
  });
  document
    .querySelectorAll(".mod-gallery-item.collection-menu-open")
    .forEach((card) => {
      card.classList.remove("collection-menu-open");
    });
  trigger.closest(".mod-gallery-item")?.classList.add("collection-menu-open");
}
["pointerdown", "mousedown", "click"].forEach((eventName) => {
  document
    .getElementById("overlayCollectionFloatingMenu")
    ?.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    });
});
function hideCuteContextMenu() {
  hideAllContextMenus();
}
function getCurrentContextMenuMod() {
  if (!contextMenuModName) return null;
  return currentMods.find((mod) => mod.name === contextMenuModName) || null;
}
function showCuteContextMenu(event, modName) {
  hideAllContextMenus();
  const menu = document.getElementById("cuteContextMenu");
  const panel = document.getElementById("overlayPanel");
  const title = document.getElementById("cuteMenuTitle");
  const pinIcon = document.getElementById("cuteMenuPinIcon");
  const pinLabel = document.getElementById("cuteMenuPinLabel");
  const pinHint = document.getElementById("cuteMenuPinHint");
  const markIcon = document.getElementById("cuteMenuMarkIcon");
  const markLabel = document.getElementById("cuteMenuMarkLabel");
  const markHint = document.getElementById("cuteMenuMarkHint");
  const mod = currentMods.find((item) => item.name === modName);
  contextMenuModName = modName;
  title.textContent = modName;
  if (mod?.pinned) {
    pinIcon.textContent = "📍";
    pinLabel.textContent = t("overlay.pin.remove");
    pinHint.textContent = t("overlay.pin.removeHint");
  } else {
    pinIcon.textContent = "📌";
    pinLabel.textContent = t("overlay.pin.add");
    pinHint.textContent = t("overlay.pin.addHint");
  }
  if (mod?.marked) {
    markIcon.textContent = "🏷️";
    markLabel.textContent = t("overlay.mark.remove");
    markHint.textContent = t("overlay.mark.removeHint");
  } else {
    markIcon.textContent = "🔖";
    markLabel.textContent = t("overlay.mark.add");
    markHint.textContent = t("overlay.mark.addHint");
  }
  menu.style.left = "12px";
  menu.style.top = "12px";
  menu.classList.add("show");
  const panelRect = panel.getBoundingClientRect();
  const menuRect = menu.getBoundingClientRect();
  let left = event.clientX - panelRect.left + 6;
  let top = event.clientY - panelRect.top + 6;
  left = Math.max(12, Math.min(left, panelRect.width - menuRect.width - 12));
  top = Math.max(12, Math.min(top, panelRect.height - menuRect.height - 12));
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}
function showCharContextMenu(event, charName) {
  hideAllContextMenus();
  const menu = document.getElementById("charContextMenu");
  const panel = document.getElementById("overlayPanel");
  charContextMenuName = charName;
  document.getElementById("charMenuTitle").textContent = charName;
  menu.style.left = "12px";
  menu.style.top = "12px";
  menu.classList.add("show");
  const panelRect = panel.getBoundingClientRect();
  const menuRect = menu.getBoundingClientRect();
  let left = event.clientX - panelRect.left + 6;
  let top = event.clientY - panelRect.top + 6;
  left = Math.max(12, Math.min(left, panelRect.width - menuRect.width - 12));
  top = Math.max(12, Math.min(top, panelRect.height - menuRect.height - 12));
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}
async function handleCuteMenuAction(action) {
  if (!selectedChar || !contextMenuModName) {
    showToast(t("overlay.mods.notFound"));
    hideCuteContextMenu();
    return;
  }
  const modName = contextMenuModName;
  hideCuteContextMenu();
  try {
    let result = null;
    if (action === "open-folder") {
      result = await window.overlayApi.openModFolder(selectedChar, modName);
      showToast(
        result.success
          ? t("overlay.folder.opened", {
              modName: modName,
            })
          : result.error || t("overlay.folder.failed"),
      );
      return;
    }
    if (action === "open-manager") {
      result = await window.overlayApi.openManagerView(selectedChar, modName);
      showToast(
        result.success
          ? t("overlay.manager.opened", {
              modName: modName,
            })
          : result.error || t("overlay.manager.failed"),
      );
      return;
    }
    if (action === "pin-top") {
      const currentMod = currentMods.find((mod) => mod.name === modName);
      const nextPinned = !currentMod?.pinned;
      const container = document.getElementById("modList");
      prepareModFocusState(modName, {
        scrollTop: nextPinned ? 0 : container.scrollTop,
        center: false,
      });
      overlayLastLocalChangeAt = Date.now();
      result = await window.overlayApi.pinMod(
        selectedChar,
        modName,
        nextPinned,
      );
      if (result.success) {
        overlayLastLocalChangeAt = Date.now();
        applyOptimisticModState(modName, {
          pinned: nextPinned,
        });
        showToast(
          nextPinned
            ? t("overlay.pin.addedNamed", {
                modName: modName,
              })
            : t("overlay.pin.removedNamed", {
                modName: modName,
              }),
        );
      } else {
        pendingFocusState = null;
        showToast(result.error || t("overlay.pin.failed"));
      }
    }
    if (action === "mark-mod") {
      const currentMod = currentMods.find((mod) => mod.name === modName);
      const nextMarked = !currentMod?.marked;
      const container = document.getElementById("modList");
      prepareModFocusState(modName, {
        scrollTop: container.scrollTop,
        center: false,
      });
      overlayLastLocalChangeAt = Date.now();
      result = await window.overlayApi.setModMarked(
        selectedChar,
        modName,
        nextMarked,
      );
      if (result.success) {
        overlayLastLocalChangeAt = Date.now();
        applyOptimisticModState(modName, {
          marked: nextMarked,
        });
        renderMods();
        showToast(
          nextMarked
            ? t("overlay.mark.addedNamed", {
                modName: modName,
              })
            : t("overlay.mark.removedNamed", {
                modName: modName,
              }),
        );
      } else {
        pendingFocusState = null;
        showToast(result.error || t("overlay.mark.failed"));
      }
    }
    if (action === "fix-mod") {
      result = await window.overlayApi.fixRunMod(selectedChar, modName);
      if (!result?.canceled)
        showToast(
          result?.success
            ? t("overlay.fixer.opened")
            : result?.error || t("overlay.fixer.failed"),
        );
    }
    if (action === "reset-mod-ini") {
      result = await window.overlayApi.resetModIni(selectedChar, modName);
      if (result?.success) {
        const msg =
          result.restoredCount > 0
            ? t("overlay.ini.restored")
            : t("overlay.ini.processed");
        showToast(msg);
      } else {
        showToast(result?.error || t("overlay.ini.failed"));
      }
      return;
    }
  } catch (error) {
    pendingFocusState = null;
    showToast(error?.message || t("overlay.actions.failed"));
  }
}

// ===== Pin =====
document.getElementById("pinBtn").addEventListener("click", () => {
  isPinned = !isPinned;
  document.getElementById("pinBtn").classList.toggle("pin-active", isPinned);
  window.overlayApi.togglePin(isPinned);
});
document.getElementById("overlayZoomOut").addEventListener("click", () => {
  requestOverlayScale((overlaySettings.overlayScale || 1) - OVERLAY_SCALE_STEP);
});
document.getElementById("overlayZoomIn").addEventListener("click", () => {
  requestOverlayScale((overlaySettings.overlayScale || 1) + OVERLAY_SCALE_STEP);
});
document.getElementById("overlayScaleLabel").addEventListener("click", () => {
  requestOverlayScale(1);
});
document
  .getElementById("focusEnabledBtn")
  .addEventListener("click", focusNextEnabledMod);
document
  .getElementById("overlayCollectionBtn")
  .addEventListener("click", toggleOverlayCollectionsEnabled);
document
  .getElementById("closeBtn")
  .addEventListener("click", () => window.overlayApi.hideOverlay());
document
  .getElementById("cuteMenuOpenFolder")
  .addEventListener("click", () => handleCuteMenuAction("open-folder"));
document
  .getElementById("cuteMenuOpenManager")
  .addEventListener("click", () => handleCuteMenuAction("open-manager"));
document
  .getElementById("cuteMenuPinTop")
  .addEventListener("click", () => handleCuteMenuAction("pin-top"));
document
  .getElementById("cuteMenuMarkMod")
  .addEventListener("click", () => handleCuteMenuAction("mark-mod"));
document
  .getElementById("cuteMenuFixMod")
  .addEventListener("click", () => handleCuteMenuAction("fix-mod"));
document
  .getElementById("cuteMenuResetMod")
  .addEventListener("click", () => handleCuteMenuAction("reset-mod-ini"));
document
  .getElementById("charMenuResetIni")
  .addEventListener("click", async () => {
    if (!charContextMenuName) return;
    const charName = charContextMenuName;
    hideAllContextMenus();
    try {
      const result = await window.overlayApi.resetCharacterIni(charName);
      if (result?.success) {
        const msg =
          result.restoredCount > 0
            ? t("overlay.ini.characterRestored", {
                character: charName,
                restoredCount: result.restoredCount,
              })
            : t("overlay.ini.characterUnchanged", {
                character: charName,
              });
        showToast(msg);
      } else {
        showToast(result?.error || t("overlay.ini.failed"));
      }
    } catch {
      showToast(t("overlay.ini.failed"));
    }
  });
document.addEventListener("pointerdown", (e) => {
  const cuteMenu = document.getElementById("cuteContextMenu");
  const charMenu = document.getElementById("charContextMenu");
  if (!cuteMenu.contains(e.target) && !charMenu.contains(e.target)) {
    hideAllContextMenus();
  }
});

// Close context menus on right-click; if right-click lands ON the open menu, re-dispatch to underlying element
document.addEventListener(
  "contextmenu",
  (e) => {
    const cuteMenu = document.getElementById("cuteContextMenu");
    const charMenu = document.getElementById("charContextMenu");
    const menuWasOpen =
      cuteMenu.classList.contains("show") ||
      charMenu.classList.contains("show");
    if (!menuWasOpen) return;
    if (!cuteMenu.contains(e.target) && !charMenu.contains(e.target)) {
      hideAllContextMenus();
      return;
    }
    // Right-clicked ON the menu itself — close menu, find underlying element, re-dispatch
    e.preventDefault();
    e.stopImmediatePropagation();
    hideAllContextMenus();
    const underlying = document.elementFromPoint(e.clientX, e.clientY);
    if (underlying && underlying !== e.target) {
      const newEvent = new PointerEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX: e.clientX,
        clientY: e.clientY,
        button: 2,
      });
      underlying.dispatchEvent(newEvent);
    }
  },
  true,
);
document
  .getElementById("modList")
  .addEventListener("scroll", hideAllContextMenus);
document.addEventListener("keydown", (e) => {
  if (
    document.getElementById("cuteContextMenu").classList.contains("show") ||
    document.getElementById("charContextMenu").classList.contains("show")
  ) {
    hideAllContextMenus();
    if (e.key === "Escape") return;
  }
  if (e.key === "Escape") {
    if (
      document.getElementById("settingsPanel").classList.contains("visible")
    ) {
      document.getElementById("settingsPanel").classList.remove("visible");
      return;
    }
    // Hide side window if open
    window.overlayApi.hideSide();
    selectedModName = null;
    document
      .querySelectorAll(".mod-item.selected, .mod-gallery-item.selected")
      .forEach((el) => el.classList.remove("selected"));
    window.overlayApi.hideOverlay();
  }
});

// ===== Scroll wheel to switch characters =====
document.getElementById("charStrip").addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    const pool = getVisibleCharacters();
    if (pool.length <= 1) return;
    let idx = pool.findIndex((c) => c.name === selectedChar);
    if (idx < 0) idx = 0;
    if (e.deltaY > 0) idx = (idx + 1) % pool.length;
    else idx = (idx - 1 + pool.length) % pool.length;
    selectChar(pool[idx].name);
  },
  {
    passive: false,
  },
);
document.getElementById("charFilterBtn").addEventListener("click", () => {
  overlayCharFilterModOnly = !overlayCharFilterModOnly;
  try {
    localStorage.setItem(
      "qaqm.overlay.charFilterModOnly",
      String(overlayCharFilterModOnly),
    );
  } catch (_) {}
  syncCharFilterUI();
  renderCharChips();
  if (bubbleSideOpen) showCharacterBubbleSide();
  // If the current selection got filtered out, jump to the first visible.
  const pool = getVisibleCharacters();
  if (pool.length > 0 && !pool.some((c) => c.name === selectedChar)) {
    selectChar(pool[0].name);
  }
  showToast(
    overlayCharFilterModOnly
      ? t("overlay.characters.withModsSelected")
      : t("overlay.characters.allSelected"),
  );
});

// ===== Settings =====
document
  .getElementById("settingsBtn")
  .addEventListener("click", () =>
    document.getElementById("settingsPanel").classList.add("visible"),
  );
document
  .getElementById("settingsPanelClose")
  .addEventListener("click", () =>
    document.getElementById("settingsPanel").classList.remove("visible"),
  );
document
  .getElementById("autoReloadToggle")
  .addEventListener("change", async (e) => {
    const checked = e.target.checked;
    try {
      const result = await window.overlayApi.updateSettings({
        autoReloadEnabled: checked,
      });
      if (result.success && result.settings) {
        overlaySettings = {
          ...overlaySettings,
          ...result.settings,
        };
        syncSettingsUI();
        showToast(
          overlaySettings.autoReloadEnabled
            ? t("overlay.reload.enabled")
            : t("overlay.reload.disabled"),
        );
      } else {
        e.target.checked = !checked;
        showToast(result.error || t("overlay.settings.failed"));
      }
    } catch {
      e.target.checked = !checked;
      showToast(t("overlay.settings.failed"));
    }
  });
document
  .getElementById("presetAutoReloadToggle")
  .addEventListener("change", async (e) => {
    const checked = e.target.checked;
    try {
      const result = await window.overlayApi.updateSettings({
        presetAutoReloadEnabled: checked,
      });
      if (result.success && result.settings) {
        overlaySettings = {
          ...overlaySettings,
          ...result.settings,
        };
        syncSettingsUI();
        showToast(
          overlaySettings.presetAutoReloadEnabled
            ? t("overlay.presets.reloadEnabled")
            : t("overlay.presets.reloadDisabled"),
        );
      } else {
        e.target.checked = !checked;
        showToast(result.error || t("overlay.settings.failed"));
      }
    } catch {
      e.target.checked = !checked;
      showToast(t("overlay.settings.failed"));
    }
  });
document
  .getElementById("clickableHotkeysToggle")
  .addEventListener("change", async (e) => {
    const checked = e.target.checked;
    try {
      const result = await window.overlayApi.updateSettings({
        clickableHotkeysEnabled: checked,
      });
      if (result.success && result.settings) {
        overlaySettings = {
          ...overlaySettings,
          ...result.settings,
        };
        syncSettingsUI();
        showToast(
          overlaySettings.clickableHotkeysEnabled
            ? t("overlay.hotkeys.clickEnabled")
            : t("overlay.hotkeys.clickDisabled"),
        );
        if (selectedModName) {
          openDetail(selectedModName);
        }
      } else {
        e.target.checked = !checked;
        showToast(result.error || t("overlay.settings.failed"));
      }
    } catch {
      e.target.checked = !checked;
      showToast(t("overlay.settings.failed"));
    }
  });
document
  .getElementById("persistBridgeToggle")
  .addEventListener("change", async (e) => {
    const checked = e.target.checked;
    try {
      const result = await window.overlayApi.updateSettings({
        persistBridgeEnabled: checked,
      });
      if (result.success && result.settings) {
        overlaySettings = {
          ...overlaySettings,
          ...result.settings,
        };
        syncSettingsUI();
        showToast(
          checked
            ? t("overlay.persist.enabled")
            : t("overlay.persist.disabled"),
        );
      } else {
        e.target.checked = !checked;
        showToast(result.error || t("overlay.settings.failed"));
      }
    } catch {
      e.target.checked = !checked;
      showToast(t("overlay.settings.failed"));
    }
  });
document.getElementById("opacitySlider").addEventListener("input", (e) => {
  const val = e.target.value;
  document.getElementById("opacityValue").textContent = val + "%";
  document
    .querySelector(".overlay-panel")
    .style.setProperty("--panel-opacity", (val / 100).toFixed(2));
});

// Hotkey capture
const hotkeyInput = document.getElementById("hotkeyInput");
let capturingHotkey = false;
hotkeyInput.addEventListener("click", () => {
  capturingHotkey = true;
  hotkeyInput.value = t("overlay.hotkeys.capture");
});
hotkeyInput.addEventListener("keydown", async (e) => {
  if (!capturingHotkey) return;
  e.preventDefault();
  let parts = [];
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  const key = e.key.toUpperCase();
  if (!["CONTROL", "ALT", "SHIFT"].includes(key)) {
    parts.push(key.length === 1 ? key : e.key);
    const newHotkey = parts.join(" + ");
    hotkeyInput.value = newHotkey;
    capturingHotkey = false;
    try {
      const result = await window.overlayApi.changeHotkey(newHotkey);
      if (result.success) showToast(t("overlay.hotkeys.prefix") + newHotkey);
      else {
        showToast(result.error || t("overlay.settings.failed"));
        hotkeyInput.value = "Alt + F";
      }
    } catch {
      hotkeyInput.value = "Alt + F";
    }
  }
});
hotkeyInput.addEventListener("blur", () => {
  if (capturingHotkey) {
    capturingHotkey = false;
    hotkeyInput.value = "Alt + F";
  }
});

// ===== View-mode toggle =====
// Flips between list and gallery, persists choice in localStorage, and
// re-renders so the user sees the new layout immediately.
document.getElementById("viewModeBtn").addEventListener("click", () => {
  overlayViewMode = overlayViewMode === "gallery" ? "list" : "gallery";
  try {
    localStorage.setItem("qaqm.overlay.viewMode", overlayViewMode);
  } catch {}
  syncViewModeUI();
  if (selectedChar) renderMods();
});
syncViewModeUI();

// ===== Sort bar =====
document.querySelectorAll(".sort-btn[data-sort]").forEach((btn) => {
  if (btn.id === "exclusiveBtn") {
    btn.addEventListener("click", () => {
      overlayExclusive = !overlayExclusive;
      try {
        localStorage.setItem(
          getModViewPreferenceStorageKey(charactersGameId, selectedChar),
          JSON.stringify({ ...readModViewPreferences(getModViewPreferenceStorageKey(charactersGameId, selectedChar)), exclusiveMode: overlayExclusive, selectionModeVersion: 2 }),
        );
      } catch {}
      syncExclusiveUI();
      showToast(
        overlayExclusive
          ? t("overlay.selection.singleEnabled")
          : t("overlay.selection.multiple"),
      );
    });
  } else {
    btn.addEventListener("click", () => {
      overlaySortMethod = btn.dataset.sort;
      document
        .querySelectorAll(".sort-btn[data-sort]:not(#exclusiveBtn)")
        .forEach((b) => b.classList.toggle("active", b === btn));
      if (selectedChar) renderMods();
    });
  }
});
function getSectionMods() {
  return currentMods.filter(mod => (mod.appearanceSectionId || "base") === activeAppearanceSectionId);
}
function getFilteredMods() {
  const query = overlayModSearch.trim().toLowerCase();
  return getSectionMods().filter(mod => {
    if (query && ![mod.name, mod.notes, ...(mod.tags || [])].some(value => String(value || "").toLowerCase().includes(query))) return false;
    const tags = new Set((mod.tags || []).map(tag => String(tag).toLowerCase()));
    return [...selectedTags].every(tag => tags.has(tag));
  });
}
function renderAppearanceSections() {
  const container = document.getElementById("appearanceSections");
  container.innerHTML = appearanceSections.map(section => {
    const id = getSectionId(section), name = getSectionName(section), cover = section.coverUrl || section.imageUrl || section.image;
    const mods = currentMods.filter(mod => (mod.appearanceSectionId || "base") === id);
    return `<button type="button" class="overlay-appearance-tab ${id === activeAppearanceSectionId ? "active" : ""}" role="tab" aria-selected="${id === activeAppearanceSectionId}" data-section="${escapeHtml(id)}" title="${escapeHtml(name)}">${cover ? `<img src="${escapeHtml(cover)}" alt="" loading="lazy">` : '<span class="overlay-section-fallback">👗</span>'}<span><strong>${escapeHtml(name)}</strong><small>${mods.filter(mod => mod.enabled).length}/${mods.length}</small></span></button>`;
  }).join("");
  container.querySelectorAll("[data-section]").forEach(button => button.addEventListener("click", () => {
    activeAppearanceSectionId = button.dataset.section;
    try { localStorage.setItem(getAppearanceSectionStorageKey(charactersGameId, selectedChar), activeAppearanceSectionId); } catch {}
    selectedModName = null;
    enabledFocusCursor = -1;
    renderMods();
    document.getElementById("modList").scrollTop = 0;
  }));
}
function renderSelectionControls() {
  renderAppearanceSections();
  document.getElementById("overlayTagSummary").textContent = t("mods.library.selectTags") + (selectedTags.size ? ` (${selectedTags.size})` : "");
  const tagMenu = document.getElementById("overlayTagMenu");
  tagMenu.innerHTML = collectModTags(currentMods).map(([key, name]) => `<label><input type="checkbox" data-tag="${escapeHtml(key)}" ${selectedTags.has(key) ? "checked" : ""}><span>${escapeHtml(name)}</span></label>`).join("") || `<span>${t("mods.library.noTags")}</span>`;
  tagMenu.querySelectorAll("[data-tag]").forEach(input => input.addEventListener("change", () => {
    if (input.checked) selectedTags.add(input.dataset.tag); else selectedTags.delete(input.dataset.tag);
    renderMods();
  }));
  const pending = currentMods.filter(mod => mod.pendingEnabled);
  const confirm = document.getElementById("conflictConfirm");
  confirm.hidden = pending.length === 0;
  confirm.innerHTML = pending.length ? `<span>⚠️ ${t("mods.conflicts.pendingCount", { count: pending.length })}</span><button type="button" ${confirmingConflicts ? "disabled" : ""}>${t("mods.conflicts.confirmTogether")}</button><small>${t("mods.conflicts.pendingHint")}</small>` : "";
  confirm.querySelector("button")?.addEventListener("click", async () => {
    if (confirmingConflicts) return;
    const character = selectedChar;
    confirmingConflicts = true;
    renderSelectionControls();
    try {
      const result = await window.overlayApi.confirmModConflicts(character);
      showToast(result.reloadError ? t("arknights.reloadToggleFailed", { error: result.reloadError }) : result.success ? t("mods.conflicts.confirmed") : result.error || t("overlay.mods.toggleFailed"));
      if (selectedChar === character) await loadMods(character, { silent: true });
    } finally { confirmingConflicts = false; renderSelectionControls(); }
  });
}
document.getElementById("overlayModSearch").addEventListener("input", event => {
  overlayModSearch = event.target.value;
  renderMods();
});
document.getElementById("appearanceSections").addEventListener("wheel", event => {
  const strip = event.currentTarget;
  if (strip.scrollWidth <= strip.clientWidth || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
  event.preventDefault();
  strip.scrollLeft += event.deltaY;
}, { passive: false });
window.addEventListener("storage", event => {
  if (!selectedChar) return;
  if (event.key === getAppearanceSectionStorageKey(charactersGameId, selectedChar) && appearanceSections.some(section => getSectionId(section) === event.newValue)) {
    activeAppearanceSectionId = event.newValue;
    renderMods();
  }
  if (event.key === getModViewPreferenceStorageKey(charactersGameId, selectedChar)) {
    overlayExclusive = readModViewPreferences(event.key).exclusiveMode;
    syncExclusiveUI();
  }
  if (event.key === collectionSelectionKey(charactersGameId, selectedChar)) {
    overlayCollectionSelections = readCollectionSelections(charactersGameId, selectedChar);
    const group = getOverlayCollectionForMod(selectedModName);
    const nextName = overlayCollectionSelections[group?.identity];
    if (nextName && nextName !== selectedModName) selectOverlayCollectionVariant(group.identity, nextName);
    else renderMods();
  }
});
function sortMods(mods) {
  const pinned = mods
    .filter((mod) => mod.pinned)
    .sort((a, b) => {
      const diff =
        (a.pinnedIndex ?? Number.MAX_SAFE_INTEGER) -
        (b.pinnedIndex ?? Number.MAX_SAFE_INTEGER);
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name, "zh-CN");
    });
  const sorted = mods.filter((mod) => !mod.pinned);
  if (overlaySortMethod === "name") {
    sorted.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  } else if (overlaySortMethod === "time") {
    sorted.sort((a, b) => {
      const timeDiff = (b.addedAtMs || 0) - (a.addedAtMs || 0);
      if (timeDiff !== 0) return timeDiff;
      return a.name.localeCompare(b.name, "zh-CN");
    });
  } else if (overlaySortMethod === "status") {
    const order = overlayInteractionOrder[selectedChar] || [];
    sorted.sort((a, b) => {
      const aIdx = order.indexOf(a.name),
        bIdx = order.indexOf(b.name);
      const aI = aIdx !== -1,
        bI = bIdx !== -1;
      if (aI && !bI) return -1;
      if (!aI && bI) return 1;
      if (aI && bI) return aIdx - bIdx;
      return a.name.localeCompare(b.name, "zh-CN");
    });
  }
  return [...pinned, ...sorted].sort(
    (a, b) =>
      Number(isActiveMod(selectedChar, b.name)) -
      Number(isActiveMod(selectedChar, a.name)),
  );
}
function trackInteraction(charName, modName) {
  if (!overlayInteractionOrder[charName])
    overlayInteractionOrder[charName] = [];
  const arr = overlayInteractionOrder[charName];
  const idx = arr.indexOf(modName);
  if (idx !== -1) arr.splice(idx, 1);
  arr.unshift(modName);
}

// ===== Bubble Menu (side window) =====
let bubbleSideOpen = false;
function showCharacterBubbleSide() {
  const bubbleCharacters = getVisibleCharacters();
  const bubblesHtml =
    '<div class="bubble-grid">' +
    bubbleCharacters
      .map((c, i) => {
        const escapedName = escapeHtml(c.name);
        const initial = escapeHtml(c.name.substring(0, 1));
        return `<div class="bubble-avatar ${selectedChar === c.name ? "active" : ""}" data-name="${escapedName}" data-search="${escapeHtml(c.searchText || c.name)}" data-idx="${i}" title="${escapedName}">
                ${c.coverUrl ? `<img src="${c.coverUrl}" alt="">` : `<span>${initial}</span>`}
            </div>`;
      })
      .join("") +
    "</div>";
  window.overlayApi.showSide({
    content: {
      type: "characters",
      title: t("overlay.characters.chooseCount", {
        count: bubbleCharacters.length,
      }),
      html: bubblesHtml,
    },
  });
}
document.getElementById("bubbleToggleBtn").addEventListener("click", () => {
  if (bubbleSideOpen) {
    window.overlayApi.hideSide();
    bubbleSideOpen = false;
    return;
  }
  bubbleSideOpen = true;
  showCharacterBubbleSide();
});

// ===== Load characters =====
function getVisibleCharacters() {
  const visible = overlayCharFilterModOnly
    ? characters.filter((c) => (c?.modCount || 0) > 0)
    : [...characters];
  return visible.sort(
    (a, b) =>
      Number(isActiveCharacter(b.name)) - Number(isActiveCharacter(a.name)),
  );
}
function isActiveCharacter(name) {
  return (
    overlaySettings.activityEnabled !== false &&
    activityMods.some((mod) => mod.characterName === name)
  );
}
function isActiveMod(characterName, modName) {
  return (
    overlaySettings.activityEnabled !== false &&
    activityMods.some(
      (mod) => mod.characterName === characterName && mod.modName === modName,
    )
  );
}
function refreshActivity() {
  if (activityRefreshPromise) return activityRefreshPromise;
  if (
    overlayRefreshingForGameChange ||
    !charactersGameId ||
    !window.overlayApi.getActivity
  )
    return Promise.resolve();
  const epoch = activityEpoch;
  activityRefreshPromise = (async () => {
    try {
      const result = await window.overlayApi.getActivity();
      if (
        epoch !== activityEpoch ||
        result.gameId !== charactersGameId ||
        !result.success
      )
        return;
      const mods =
        overlaySettings.activityEnabled === false
          ? []
          : (result.mods || []).filter((mod) =>
              characters.some((c) => c.name === mod.characterName),
            );
      activitySampledAt = Number(result.sampledAt) || 0;
      const signature = JSON.stringify(mods);
      document.getElementById("activityStatus").textContent =
        overlaySettings.activityEnabled === false
          ? ""
          : result.status === "unsupported"
            ? t("overlay.activity.noMarkers")
            : result.status === "waiting"
              ? t("overlay.activity.waiting")
              : mods.length
                ? t("overlay.activity.detectedCount", {
                    size: new Set(mods.map((m) => m.characterName)).size,
                  })
                : t("overlay.activity.noneDetected");
      if (signature === activitySignature) return;
      activitySignature = signature;
      activityMods = mods;
      renderCharChips();
      if (selectedChar) renderMods();
    } catch {
      /* A temporary unavailable snapshot must not change the selection. */
    }
  })().finally(() => {
    activityRefreshPromise = null;
  });
  return activityRefreshPromise;
}

// Only an explicit overlay-open event may locate a Mod and open its menu.
// Polling keeps a fresh snapshot ready even while the overlay is hidden.
async function focusActivityOnOpen(request) {
  const epoch = activityEpoch;
  const openedAt = Date.now(),
    deadline = openedAt + 8000;
  const isCurrentOpen = () =>
    overlayIsOpen &&
    request === activityOpenRequest &&
    epoch === activityEpoch &&
    !activityManualSelection &&
    overlaySettings.autoLocateEnabled !== false &&
    overlaySettings.activityEnabled !== false &&
    !document.getElementById("settingsPanel").classList.contains("visible");
  // A hidden window can miss the first heartbeat. Give the game's next
  // save time to arrive instead of committing to the previous character.
  while (isCurrentOpen()) {
    await refreshActivity();
    if (!isCurrentOpen()) return;
    if (
      activityMods.length &&
      (activitySampledAt >= openedAt || Date.now() - openedAt >= 2600)
    )
      break;
    if (Date.now() >= deadline) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!isCurrentOpen() || !activityMods.length) return;
  const name = isActiveCharacter(selectedChar)
    ? selectedChar
    : getVisibleCharacters().find((c) => isActiveCharacter(c.name))?.name;
  if (!name) return;
  if (name !== selectedChar) await selectChar(name);
  if (!isCurrentOpen() || name !== selectedChar) return;
  const mod = sortMods(currentMods).find(
    (m) => m.enabled && isActiveMod(name, m.name),
  );
  if (mod) {
    prepareModFocusState(mod.name, {
      center: false,
      scrollTop: 0,
    });
    renderMods();
    await openDetail(mod.name, {
      force: true,
    });
  }
}

// Let the user browse freely until the next time they open the overlay.
document.addEventListener(
  "pointerdown",
  (event) => {
    if (
      event.target.closest(
        ".char-chip, .char-bubble-btn, .mod-item, .mod-gallery-item, #settingsBtn, #focusEnabledBtn, .auto-locate-control",
      )
    )
      activityManualSelection = true;
  },
  true,
);
document.addEventListener(
  "wheel",
  () => {
    activityManualSelection = true;
  },
  {
    passive: true,
  },
);
document.addEventListener("keydown", (event) => {
  if (
    ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter"].includes(
      event.key,
    )
  )
    activityManualSelection = true;
});
document
  .getElementById("activityToggle")
  .addEventListener("change", async (event) => {
    const result = await window.overlayApi.updateSettings({
      activityEnabled: event.target.checked,
    });
    if (result.success) {
      overlaySettings = {
        ...overlaySettings,
        ...result.settings,
      };
      activitySignature = "";
      await refreshActivity();
      showToast(t("overlay.settings.saved"));
    } else showToast(result.error || t("overlay.settings.failed"));
    syncSettingsUI();
  });
document
  .getElementById("autoLocateToggle")
  .addEventListener("change", async (event) => {
    const control = event.target;
    activityOpenRequest++;
    control.disabled = true;
    try {
      const result = await window.overlayApi.updateSettings({
        autoLocateEnabled: control.checked,
      });
      if (!result.success)
        throw Error(result.error || t("overlay.settings.failed"));
      overlaySettings = {
        ...overlaySettings,
        ...result.settings,
      };
      showToast(
        control.checked
          ? t("overlay.focus.autoEnabled")
          : t("overlay.focus.autoDisabled"),
      );
    } catch (error) {
      showToast(error.message || t("overlay.settings.failed"));
    } finally {
      control.disabled = false;
      syncSettingsUI();
    }
  });
setInterval(refreshActivity, 1000);
function syncCharFilterUI() {
  const btn = document.getElementById("charFilterBtn");
  if (!btn) return;
  btn.classList.toggle("active", !!overlayCharFilterModOnly);
  btn.textContent = overlayCharFilterModOnly ? "🎯" : "🌐";
  btn.title = overlayCharFilterModOnly
    ? t("overlay.characters.withModsToggle")
    : t("overlay.characters.allToggle");
}
async function loadCharacters({ reloadSelectedMods = true } = {}) {
  try {
    const result = await window.overlayApi.getCharacters();
    if (result.success) {
      const previousSelectedChar = selectedChar;
      characters = Array.isArray(result.characters) ? result.characters : [];
      charactersGameId = result.gameId;
      renderCharChips();
      if (characters.length === 0) {
        clearOverlaySelectionState();
        return;
      }
      const visible = getVisibleCharacters();
      const pool = visible.length > 0 ? visible : characters;
      const nextChar =
        pool.find((c) => c.name === previousSelectedChar)?.name || pool[0].name;
      if (!reloadSelectedMods && nextChar === previousSelectedChar) {
        selectedCharIndex = characters.findIndex((c) => c.name === nextChar);
      } else {
        await selectChar(nextChar);
      }
      if (bubbleSideOpen) showCharacterBubbleSide();
      await refreshActivity();
    } else {
      characters = [];
      renderCharacterEmptyState(
        result.error || t("overlay.characters.loadFailed"),
      );
      showToast(result.error || t("overlay.characters.loadFailed"));
    }
  } catch (e) {
    characters = [];
    renderCharacterEmptyState(t("overlay.characters.loadFailed"));
    showToast(t("overlay.characters.loadFailed"));
  }
}
function renderCharChips() {
  const container = document.getElementById("charList");
  syncCharFilterUI();
  if (characters.length === 0) {
    container.innerHTML = `<div class="empty-state">${t("overlay.characters.empty")}</div>`;
    return;
  }
  const visible = getVisibleCharacters();
  if (visible.length === 0) {
    container.innerHTML = `<div class="empty-state">${t("overlay.characters.noLoadedMods")}</div>`;
    return;
  }
  container.innerHTML = visible
    .map(
      (c, i) =>
        `<div class="char-chip ${selectedChar === c.name ? "active" : ""}" data-name="${escapeHtml(c.name)}" data-idx="${i}">${escapeHtml(c.name)}${isActiveCharacter(c.name) ? `<span class="char-chip-live">${t("overlay.activity.detected")}</span>` : ""}${(c.modCount || 0) > 0 ? `<span class="char-chip-count">${c.enabledCount || 0}/${c.modCount}</span>` : ""}</div>`,
    )
    .join("");
  container.querySelectorAll(".char-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      // Index now points into the visible pool, but selectChar resolves
      // by name + recomputes selectedCharIndex against the full list.
      selectChar(chip.dataset.name);
    });
    chip.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      showCharContextMenu(e, chip.dataset.name);
    });
  });
}
async function selectChar(name) {
  if (!name) {
    clearOverlaySelectionState();
    return;
  }
  if (selectedChar !== name) {
    overlayModSearch = "";
    selectedTags.clear();
    document.getElementById("overlayModSearch").value = "";
    try { activeAppearanceSectionId = localStorage.getItem(getAppearanceSectionStorageKey(charactersGameId, name)) || "base"; } catch { activeAppearanceSectionId = "base"; }
  }
  selectedChar = name;
  overlayCollectionSelections = readCollectionSelections(charactersGameId, name);
  overlayExclusive = readModViewPreferences(getModViewPreferenceStorageKey(charactersGameId, name)).exclusiveMode;
  syncExclusiveUI();
  selectedCharIndex = characters.findIndex((c) => c.name === name);
  renderCharChips();
  const active = document.querySelector(".char-chip.active");
  if (active)
    active.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  // Keep the character browser state in sync with the still-visible side window.
  // The side-panel selection callback explicitly clears this flag after main closes it.
  selectedModName = null;
  enabledFocusCursor = -1;
  hideCuteContextMenu();
  document
    .querySelectorAll(".mod-item.selected, .mod-gallery-item.selected")
    .forEach((el) => el.classList.remove("selected"));
  await loadMods(name);
}

// ===== Load & Render Mods =====
async function loadMods(characterName, options = {}) {
  const requestId = ++modListRequestId;
  const container = document.getElementById("modList");
  const silent = !!options.silent;
  const keepFocus = options.keepFocus !== false;
  if (!silent) {
    container.innerHTML = `<div class="loading">${t("overlay.loading.pending")}</div>`;
  } else {
    container.classList.add("soft-refreshing");
    if (keepFocus && options.focusModName) {
      prepareModFocusState(options.focusModName, {
        scrollTop: Number.isFinite(Number(options.scrollTop))
          ? Number(options.scrollTop)
          : container.scrollTop,
        center: options.center,
      });
    } else if (keepFocus && selectedModName && !pendingFocusState) {
      prepareModFocusState(selectedModName, {
        scrollTop: container.scrollTop,
        center: false,
      });
    }
  }
  try {
    const result = await window.overlayApi.getMods(characterName);
    if (requestId !== modListRequestId || selectedChar !== characterName)
      return;
    if (result.success) {
      const nextMods = Array.isArray(result.mods) ? result.mods : [];
      const nextAliases = Array.isArray(result.characterAliases)
        ? result.characterAliases
        : [];
      currentMods = nextMods;
      appearanceSections = Array.isArray(result.sections) ? result.sections : [];
      if (!appearanceSections.some(section => getSectionId(section) === activeAppearanceSectionId)) activeAppearanceSectionId = getSectionId(appearanceSections[0]);
      currentCharacterAliases = nextAliases;
      const names = new Set(currentMods.map((mod) => mod.name));
      Object.entries(overlayCollectionSelections).forEach(
        ([identity, modName]) => {
          if (!names.has(modName)) delete overlayCollectionSelections[identity];
        },
      );
      if (selectedModName && !names.has(selectedModName))
        selectedModName = null;
      renderMods();
    } else {
      currentCharacterAliases = [];
      pendingFocusState = null;
      if (!silent)
        container.innerHTML = `<div class="empty-state">${t("overlay.loading.failed")}</div>`;
      showToast(result.error || t("overlay.mods.loadFailed"));
    }
  } catch (e) {
    pendingFocusState = null;
    if (!silent)
      container.innerHTML = `<div class="empty-state">${t("overlay.loading.failed")}</div>`;
    showToast(t("overlay.mods.loadFailed"));
  } finally {
    container.classList.remove("soft-refreshing");
  }
}
function renderMods() {
  const container = document.getElementById("modList");
  hideOnlyCuteContextMenus();
  if (overlaySettings.compatibilityMode && overlayViewMode !== "list") {
    overlayViewMode = "list";
  }
  // Toggle the gallery class so CSS swaps to grid layout. List mode
  // keeps the original block-flow padding via the absence of this class.
  container.classList.toggle(
    "is-gallery",
    overlayViewMode === "gallery" && !overlaySettings.compatibilityMode,
  );
  renderSelectionControls();
  const sorted = sortMods(getFilteredMods());
  const collections = buildOverlayCollectionView(sorted, selectedChar, currentCharacterAliases, overlayCollectionSelections);
  overlayCollectionGroupsByIdentity = new Map();
  const collectionByName = new Map();
  collections.forEach((mod) => {
    if (mod?._collection?.identity) {
      overlayCollectionGroupsByIdentity.set(mod._collection.identity, {
        ...mod._collection,
        currentName: mod.name,
      });
      for (const variant of mod._collection.variants) collectionByName.set(variant.name, mod._collection);
    }
  });
  const displayMods = overlayCollectionsEnabled ? collections : sorted.map(mod => collectionByName.has(mod.name) ? { ...mod, _collection: collectionByName.get(mod.name) } : mod);
  const enabledCount = getSectionMods().filter((m) => m.enabled).length;
  document.getElementById("modCount").textContent =
    `${enabledCount}/${getSectionMods().length}`;
  if (displayMods.length === 0) {
    container.innerHTML = `<div class="empty-state">${t("overlay.mods.empty")}</div>`;
    syncFocusEnabledUI();
    return;
  }
  container.innerHTML = renderModCards(displayMods, {
    viewMode: overlayViewMode,
    selectedModName,
    openCollectionMenu: openOverlayCollectionMenu,
    compatibilityMode: overlaySettings.compatibilityMode,
  });
  container
    .querySelectorAll('[data-collection-trigger="1"]')
    .forEach((button) => {
      button.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      });
      button.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      });
      button.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        const identity = button.dataset.collection;
        if (!identity) return;
        if (openOverlayCollectionMenu === identity) {
          closeOverlayCollectionMenus();
          return;
        }
        showOverlayCollectionFloatingMenu(button, identity);
      });
    });
  container
    .querySelectorAll('[data-collection-option="1"]')
    .forEach((option) => {
      option.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      });
      option.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      });
      option.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        selectOverlayCollectionVariant(
          option.dataset.collection,
          option.dataset.mod,
        );
      });
    });

  // Single shared toggle handler — selects both list and gallery
  // switches via the data-toggle attribute.
  container.querySelectorAll('[data-toggle="1"]').forEach((toggle) => {
    toggle.addEventListener("click", async (e) => {
      e.stopPropagation();
      const modName = toggle.dataset.mod;
      const currentlyEnabled = toggle.dataset.enabled === "true" || currentMods.find(mod => mod.name === modName)?.pendingEnabled;
      try {
        hideCuteContextMenu();
        prepareModFocusState(modName, {
          scrollTop: container.scrollTop,
        });
        overlayLastLocalChangeAt = Date.now();
        if (overlayExclusive && !currentlyEnabled) {
          for (const m of currentMods) {
            if (m.name !== modName && m.enabled) {
              const disableResult = await window.overlayApi.toggleMod(
                selectedChar,
                m.name,
                false,
              );
              if (!disableResult.success) {
                pendingFocusState = null;
                showToast(
                  disableResult.error ||
                    t("overlay.mods.disableFailed", {
                      mName: m.name,
                    }),
                );
                return;
              }
            }
          }
        }
        const result = await window.overlayApi.toggleMod(
          selectedChar,
          modName,
          !currentlyEnabled,
        );
        if (result.pending) {
          pendingFocusState = null;
          showToast(t("mods.conflicts.confirmToast"));
          await loadMods(selectedChar, { silent: true });
        } else if (result.success) {
          trackInteraction(selectedChar, modName);
          overlayLastLocalChangeAt = Date.now();
          applyOptimisticModState(modName, {
            enabled: !currentlyEnabled,
          });
          if (overlayExclusive && !currentlyEnabled) {
            currentMods = currentMods.map((mod) =>
              mod.name === modName
                ? mod
                : {
                    ...mod,
                    enabled: false,
                  },
            );
          }
          renderMods();
          await loadMods(selectedChar, { silent: true, focusModName: modName });
          const actionLabel = !currentlyEnabled ? "✅" : "⬜";
          const reloadLabel = result.autoReloaded
            ? t("overlay.reload.completedSuffix")
            : "";
          const persistLabel = result.persistRestored
            ? t("overlay.persist.restoredSuffix")
            : "";
          showToast(result.reloadError ? t("arknights.reloadToggleFailed", { error: result.reloadError }) : result.refreshRequired ? t("arknights.reloaded", result) : `${modName} ${actionLabel}${reloadLabel}${persistLabel}`);
        } else {
          pendingFocusState = null;
          showToast(result.error || t("overlay.mods.toggleFailed"));
        }
      } catch (error) {
        pendingFocusState = null;
        showToast(error?.message || t("overlay.mods.toggleFailed"));
      }
    });
  });
  container.querySelectorAll('[data-mark-toggle="1"]').forEach((button) => {
    button.addEventListener("click", async (e) => {
      e.stopPropagation();
      const modName = button.dataset.mod;
      const currentlyMarked = button.dataset.marked === "true";
      try {
        hideCuteContextMenu();
        prepareModFocusState(modName, {
          scrollTop: container.scrollTop,
          center: false,
        });
        overlayLastLocalChangeAt = Date.now();
        const result = await window.overlayApi.setModMarked(
          selectedChar,
          modName,
          !currentlyMarked,
        );
        if (result.success) {
          overlayLastLocalChangeAt = Date.now();
          applyOptimisticModState(modName, {
            marked: !currentlyMarked,
          });
          renderMods();
          showToast(
            currentlyMarked
              ? t("overlay.mark.removedNamed", {
                  modName: modName,
                })
              : t("overlay.mark.addedNamed", {
                  modName: modName,
                }),
          );
        } else {
          pendingFocusState = null;
          showToast(result.error || t("overlay.mark.failed"));
        }
      } catch (error) {
        pendingFocusState = null;
        showToast(error?.message || t("overlay.mark.failed"));
      }
    });
  });
  container.querySelectorAll(".mod-item, .mod-gallery-item").forEach((item) => {
    item.addEventListener("click", (e) => {
      // Don't trigger detail-open when clicking the inline toggle/dot.
      if (e.target.closest('[data-toggle="1"]')) return;
      if (
        e.target.closest(
          '[data-collection-trigger="1"], [data-collection-option="1"], .overlay-collection-dropdown, .overlay-collection-variants',
        )
      )
        return;
      hideCuteContextMenu();
      openDetail(item.dataset.mod);
    });
    item.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      showCuteContextMenu(e, item.dataset.mod);
    });
  });
  if (pendingFocusState) {
    const focusState = pendingFocusState;
    pendingFocusState = null;
    container.scrollTop = focusState.scrollTop || 0;
    requestAnimationFrame(() =>
      focusModRow(focusState.modName, {
        center: focusState.center,
      }),
    );
  }
  syncFocusEnabledUI();
}

// ===== Detail Panel (side window) =====
async function openDetail(modName, { force = false, updateOnly = false } = {}) {
  if (updateOnly && !detailSideOpen) return;
  const requestId = ++detailRequestId;
  const detailCharacter = selectedChar;
  const isCurrentDetail = () =>
    requestId === detailRequestId &&
    selectedChar === detailCharacter &&
    selectedModName === modName;
  const mod = currentMods.find((m) => m.name === modName);
  if (!mod) {
    showToast(t("overlay.mods.changed"));
    return;
  }
  hideCuteContextMenu();

  // Toggle off if same mod
  if (selectedModName === modName && detailSideOpen && !force) {
    window.overlayApi.hideSide();
    detailSideOpen = false;
    selectedModName = null;
    bubbleSideOpen = false;
    document
      .querySelectorAll(".mod-item.selected, .mod-gallery-item.selected")
      .forEach((el) => el.classList.remove("selected"));
    return;
  }
  selectedModName = modName;
  bubbleSideOpen = false;
  const requestKey = updateOnly
    ? detailSideKey
    : `${charactersGameId}:${activityEpoch}:${requestId}`;
  detailSideKey = requestKey;
  const buildDetailHtml = (hotkeysHtml) =>
    renderModDetails({
      mod,
      character: selectedChar,
      hotkeysHtml,
      collection: getOverlayCollectionForMod(modName),
    });
  const loadingHotkeysHtml = `<div class="detail-loading">${t("overlay.hotkeys.loading")}</div>`;
  const content = {
    type: "detail",
    requestKey,
    title: mod.name,
    html: buildDetailHtml(loadingHotkeysHtml),
    charName: selectedChar,
    modName,
    modEnabled: mod.enabled,
    modPending: !!mod.pendingEnabled,
    modMarked: !!mod.marked,
    clickableHotkeysEnabled: !!overlaySettings.clickableHotkeysEnabled,
  };
  const sideResult = updateOnly
    ? await window.overlayApi.updateSide(content)
    : await window.overlayApi.showSide({ content });
  if (!isCurrentDetail()) {
    // A version can be picked as soon as the side content appears, before the
    // native show request finishes. Follow that choice once the panel is ready.
    if (requestId === detailRequestId && selectedChar === detailCharacter && sideResult?.success && selectedModName) {
      detailSideOpen = true;
      return openDetail(selectedModName, { force: true, updateOnly: true });
    }
    return;
  }
  if (!sideResult || !sideResult.success) {
    detailSideOpen = false;
    showToast(sideResult?.error || t("overlay.details.openFailed"));
    return;
  }
  detailSideOpen = true;
  document
    .querySelectorAll(".mod-item, .mod-gallery-item")
    .forEach((el) =>
      el.classList.toggle("selected", el.dataset.mod === modName),
    );
  try {
    const details = await window.overlayApi.getModDetails(
      detailCharacter,
      modName,
    );
    if (!isCurrentDetail()) return;
    const hkHtml = renderHotkeys(details, {
      modName,
      clickable: overlaySettings.clickableHotkeysEnabled,
    });
    if (!details.success)
      showToast(details.error || t("overlay.hotkeys.loadFailed"));
    window.overlayApi.updateSide({
      type: "detail",
      requestKey,
      title: mod.name,
      html: buildDetailHtml(hkHtml),
      charName: selectedChar,
      modName,
      modEnabled: mod.enabled,
      modPending: !!mod.pendingEnabled,
      modMarked: !!mod.marked,
      clickableHotkeysEnabled: !!overlaySettings.clickableHotkeysEnabled,
    });
  } catch (error) {
    if (!isCurrentDetail()) return;
    showToast(error?.message || t("overlay.hotkeys.loadFailed"));
    window.overlayApi.updateSide({
      type: "detail",
      requestKey,
      title: mod.name,
      html: buildDetailHtml(
        `<div class="detail-error">${t("overlay.hotkeys.loadRetry")}</div>`,
      ),
      charName: selectedChar,
      modName,
      modEnabled: mod.enabled,
      modPending: !!mod.pendingEnabled,
      modMarked: !!mod.marked,
      clickableHotkeysEnabled: !!overlaySettings.clickableHotkeysEnabled,
    });
  }
}

// ===== Presets =====
async function loadPresets() {
  const section = document.getElementById("presetSection");
  const container = document.getElementById("presetList");
  try {
    const result = await window.overlayApi.getPresets();
    if (!result.success) {
      presets = [];
      section.style.display = "none";
      container.innerHTML = "";
      return;
    }
    presets = Array.isArray(result.presets) ? result.presets : [];
    const activePresetId = result.activePresetId || null;
    if (presets.length === 0) {
      section.style.display = "none";
      container.innerHTML = "";
      return;
    }
    section.style.display = "";
    container.innerHTML = presets
      .map(
        (p) =>
          `<button class="preset-chip ${p.id === activePresetId ? "active" : ""}" data-name="${p.name}">${p.name}</button>`,
      )
      .join("");
    container.querySelectorAll(".preset-chip").forEach((chip) => {
      chip.addEventListener("click", async () => {
        try {
          const result = await window.overlayApi.activatePreset(
            chip.dataset.name,
          );
          if (result.success) {
            const reloadLabel = result.autoReloaded
              ? t("overlay.reload.completedSuffix")
              : "";
            showToast(
              t("overlay.presets.applied", {
                name: chip.dataset.name,
                reloadLabel: reloadLabel,
              }),
            );
            await loadCharacters();
            await loadPresets();
          } else {
            showToast(result.error || t("overlay.actions.applyFailed"));
          }
        } catch {
          showToast(t("overlay.actions.applyFailed"));
        }
      });
    });
  } catch {
    presets = [];
    section.style.display = "none";
    container.innerHTML = "";
  }
}
async function refreshOverlayForGameChange() {
  if (overlayRefreshingForGameChange) return;
  overlayRefreshingForGameChange = true;
  activityEpoch++;
  activityOpenRequest++;
  activityMods = [];
  activitySignature = "";
  activityManualSelection = false;
  charactersGameId = null;
  try {
    bubbleSideOpen = false;
    window.overlayApi.hideSide();
    clearOverlaySelectionState();
    await loadCharacters();
    await loadPresets();
  } finally {
    overlayRefreshingForGameChange = false;
  }
}

// Listen for character selection from side panel
window.overlayApi.onSelectChar((charName) => {
  activityManualSelection = true;
  const idx = characters.findIndex((c) => c.name === charName);
  if (idx !== -1) {
    selectedCharIndex = idx;
    selectChar(charName);
  }
  bubbleSideOpen = false;
});

// Listen for cover changes from main app
window.overlayApi.onCoversChanged(() => {
  loadCharacters();
});

// Reload mod list when main window toggles a mod for the current character
window.overlayApi.onModsChanged(async (data) => {
  if (data.characterName === "__all__" || data.fullRefresh) {
    await loadCharacters({
      reloadSelectedMods: false,
    });
  }
  if (
    selectedChar &&
    (data.characterName === selectedChar || data.characterName === "__all__")
  ) {
    if (data.reason !== "mod-selection" && Date.now() - overlayLastLocalChangeAt < 900) return;
    loadMods(selectedChar, {
      silent: true,
      focusModName: data?.modName || selectedModName,
      center: false,
    });
  }
});
window.overlayApi.onMarkedModsChanged((data) => {
  if (
    selectedChar &&
    (!data?.characterName ||
      data.characterName === selectedChar ||
      data.characterName === "__all__")
  ) {
    loadMods(selectedChar, {
      silent: true,
      focusModName: data?.modName || selectedModName,
      center: false,
    });
  }
});
window.overlayApi.onHotkeysChanged(async (data) => {
  if (data.gameId !== charactersGameId || !selectedModName || bubbleSideOpen)
    return;
  if (data.characterName !== "__all__" && data.characterName !== selectedChar)
    return;
  if (data.modName && data.modName !== selectedModName) return;
  await openDetail(selectedModName, {
    force: true,
    updateOnly: true,
  });
});

// Listen for preset changes from main app
window.overlayApi.onPresetsChanged(() => {
  loadPresets();
});
window.overlayApi.onGamesChanged(() => {
  refreshOverlayForGameChange();
});
window.overlayApi.onOverlayScaleChanged((data) => {
  if (data && data.scale) {
    applyOverlayScale(data.scale);
  }
});
window.overlayApi.onWindowHidden(() => {
  overlayIsOpen = false;
  detailSideOpen = false;
  detailSideKey = null;
  activityOpenRequest++;
  detailRequestId++;
});
window.overlayApi.onSideHidden?.((data) => {
  if (data?.requestKey && data.requestKey !== detailSideKey) return;
  detailSideOpen = false;
  detailSideKey = null;
  detailRequestId++;
});
window.overlayApi.onWindowShown(async () => {
  overlayIsOpen = true;
  const request = ++activityOpenRequest;
  activityManualSelection = false;
  syncExclusiveUI();
  hideCuteContextMenu();
  await overlayInitialization;
  if (request !== activityOpenRequest) return;
  await loadOverlaySettings();
  // Mod directories may have changed while the overlay was hidden.
  await loadCharacters();
  if (request === activityOpenRequest) await focusActivityOnOpen(request);
});

// Load current hotkey from config
async function loadCurrentHotkey() {
  try {
    const result = await window.overlayApi.getHotkey();
    if (result.success && result.hotkey) {
      document.getElementById("hotkeyInput").value = result.hotkey.replace(
        /\+/g,
        " + ",
      );
    }
  } catch (e) {}
}
async function loadOverlaySettings() {
  try {
    const result = await window.overlayApi.getSettings();
    if (result.success && result.settings) {
      overlaySettings = {
        ...overlaySettings,
        ...result.settings,
      };
    }
  } catch (e) {}
  syncSettingsUI();
}

// Init
const overlayInitialization = Promise.all([
  loadCharacters(),
  loadPresets(),
  loadCurrentHotkey(),
  loadOverlaySettings(),
]);
syncExclusiveUI();
syncOverlayCollectionsUI();
