import { t } from "../../shared/i18n/index.mjs";
import { pinyin } from "pinyin-pro";
import { saveCollectionSelection } from "../lib/collectionSelection.js";
import "./controls.css";
import "./side-panel.css";
import "./details.css";
import { renderLayout } from "./side-panel-layout.js";
import { initializeRendererI18n } from "../../shared/i18n/renderer.mjs";
document.body.innerHTML = renderLayout();
initializeRendererI18n(window.overlayApi);
let sideToastTimer = null;
let sideCompatibilityMode = false;
async function syncSideCompatibilityMode() {
  try {
    const result = await window.overlayApi.getSettings();
    sideCompatibilityMode = !!result?.settings?.compatibilityMode;
    document.documentElement.classList.toggle(
      "overlay-compat",
      sideCompatibilityMode,
    );
  } catch {
    sideCompatibilityMode = false;
  }
}
syncSideCompatibilityMode();
function showSideToast(message) {
  const el = document.getElementById("sideToast");
  el.textContent = message;
  el.classList.remove("show");
  void el.offsetWidth;
  el.classList.add("show");
  clearTimeout(sideToastTimer);
  sideToastTimer = setTimeout(() => {
    el.classList.remove("show");
  }, 1800);
}
function bindDetailConflictConfirmation(sideBody, data) {
  const button = sideBody.querySelector("#detailConfirmBtn");
  if (!button || button.dataset.bound) return;
  button.dataset.bound = "true";
  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      const result = await window.overlayApi.confirmModConflicts(data.charName);
      showSideToast(result.reloadError ? t("arknights.reloadToggleFailed", { error: result.reloadError }) : result.success ? t("mods.conflicts.confirmed") : result.error || t("overlay.mods.toggleFailed"));
      if (result.success) window.overlayApi.hideSide();
    } finally { button.disabled = false; }
  });
}
function parseHotkeyPayload(value) {
  if (!value) return null;
  try {
    return JSON.parse(decodeURIComponent(value));
  } catch {
    return null;
  }
}
function bindDetailTranslation(sideBody, data) {
  const button = sideBody.querySelector("#detailTranslateBtn");
  const status = sideBody.querySelector("#detailTranslateStatus");
  const labels = [...sideBody.querySelectorAll(".detail-hotkey-name")];
  if (!button || !status) return;
  const originals = labels.map((label) => label.textContent);
  const storageKey =
    "hotkey-translation:v1:" +
    JSON.stringify([data.gameId, data.charName, data.modName]);
  let translations = null;
  let translated = false;
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(storageKey));
  } catch {}
  if (
    JSON.stringify(saved?.originals) === JSON.stringify(originals) &&
    Array.isArray(saved?.translations) &&
    saved.translations.length === originals.length &&
    saved.translations.every((name) => typeof name === "string")
  ) {
    translations = saved.translations;
  }
  function renderTranslation(enabled, persist = true) {
    translated = enabled;
    labels.forEach((label, index) => {
      const name = translated ? translations[index] : originals[index];
      label.textContent = name;
      label.title = translated ? originals[index] : "";
      label.closest(".detail-hotkey-row").dataset.hotkeyDesc = name;
    });
    button.textContent = translated
      ? t("overlay.translation.showOriginal")
      : t("overlay.translation.google");
    button.setAttribute("aria-pressed", String(translated));
    status.textContent = translated ? t("overlay.translation.translated") : "";
    if (persist) {
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            enabled: translated,
            originals,
            translations,
          }),
        );
      } catch {
        status.textContent = t("overlay.translation.saveFailed");
      }
    }
  }
  button.disabled = !originals.some((name) => name.trim());
  button.addEventListener("click", async () => {
    if (button.disabled) return;
    if (!translations) {
      button.disabled = true;
      button.textContent = t("overlay.translation.pending");
      button.setAttribute("aria-busy", "true");
      status.classList.remove("error");
      status.textContent = t("overlay.translation.requesting");
      try {
        const result = await window.overlayApi.translateHotkeyNames(originals);
        // Content can change while the request is in flight.
        if (!button.isConnected) return;
        if (!result?.success)
          throw Error(result?.error || t("overlay.translation.failed"));
        if (
          !Array.isArray(result.translations) ||
          result.translations.length !== originals.length ||
          result.translations.some((name) => typeof name !== "string")
        )
          throw Error(t("overlay.translation.incomplete"));
        translations = result.translations;
      } catch (error) {
        if (!button.isConnected) return;
        status.textContent = error?.message || t("overlay.translation.failed");
        status.classList.add("error");
        button.textContent = t("overlay.translation.retry");
        return;
      } finally {
        button.disabled = false;
        button.setAttribute("aria-busy", "false");
      }
    }
    renderTranslation(!translated);
  });
  if (saved?.enabled && !button.disabled) {
    if (translations) renderTranslation(true, false);
    else button.click();
  }
}
async function applyDetailHotkey(row) {
  const hotkey = parseHotkeyPayload(row.dataset.hotkeyPayload);
  const description = row.dataset.hotkeyDesc || t("overlay.hotkeys.title");
  if (!hotkey) {
    showSideToast(t("overlay.hotkeys.noApplicable"));
    return;
  }
  try {
    const result = await window.overlayApi.applyHotkey({
      hotkey,
    });
    if (result.success) {
      showSideToast(
        t("overlay.hotkeys.applied", {
          description: description,
        }),
      );
    } else {
      showSideToast(result.error || t("overlay.actions.applyFailed"));
    }
  } catch {
    showSideToast(t("overlay.actions.applyFailed"));
  }
}
document.getElementById("sideClose").addEventListener("click", () => {
  window.overlayApi.hideSide();
});

// Zoom buttons
let currentWidth = parseInt(localStorage.getItem("side-panel-width") || "300");
document.getElementById("sideZoomIn").addEventListener("click", async () => {
  currentWidth = Math.min(550, currentWidth + 50);
  const result = await window.overlayApi.resizeSide(currentWidth);
  if (result.success)
    localStorage.setItem("side-panel-width", String(result.width));
});
document.getElementById("sideZoomOut").addEventListener("click", async () => {
  currentWidth = Math.max(200, currentWidth - 50);
  const result = await window.overlayApi.resizeSide(currentWidth);
  if (result.success)
    localStorage.setItem("side-panel-width", String(result.width));
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") window.overlayApi.hideSide();
});
const characterSearch = document.getElementById("sideCharacterSearch");
const normalizeSearch = value => String(value || "").toLowerCase().replace(/[\s\p{P}\p{S}]/gu, "");
function filterCharacterBubbles() {
  const query = normalizeSearch(characterSearch.value);
  let count = 0;
  document.querySelectorAll(".bubble-avatar").forEach(element => {
    element.hidden = !!query && !element.dataset.searchNormalized?.includes(query);
    if (!element.hidden) count++;
  });
  const empty = document.getElementById("sideCharacterEmpty");
  if (empty) empty.hidden = count !== 0;
}
characterSearch.addEventListener("input", filterCharacterBubbles);

// Listen for content updates from main process
window.overlayApi.onSideContent((data) => {
  // Sync currentWidth from main process to ensure zoom buttons work correctly
  if (data.currentWidth) {
    currentWidth = data.currentWidth;
  }
  if (data.title) document.getElementById("sideTitle").textContent = data.title;
  const sideBody = document.getElementById("sideBody");
  sideBody.classList.toggle("character-browser", data.type === "characters");
  document.getElementById("sideCharacterSearchRow").hidden = data.type !== "characters";
  if (data.html) {
    sideBody.innerHTML = data.html;
    sideBody.scrollTop = 0;
  }

  // Bind click events for character bubbles
  if (data.type === "characters") {
    document.querySelectorAll(".bubble-avatar").forEach((el) => {
      const text = el.dataset.search || el.dataset.name;
      el.dataset.searchNormalized = [text, pinyin(text, { toneType: "none", type: "array" }).join(""), pinyin(text, { pattern: "first", toneType: "none", type: "array" }).join("")].map(normalizeSearch).join(" ");
      el.addEventListener("click", () => {
        window.overlayApi.selectCharFromSide(el.dataset.name);
      });
    });
    sideBody.insertAdjacentHTML("beforeend", `<div class="side-character-empty" id="sideCharacterEmpty" hidden>${t("overlay.characters.noMatches")}</div>`);
    filterCharacterBubbles();
  }

  // Bind toggle button for detail view
  if (data.type === "detail") {
    sideBody.querySelectorAll("[data-version-mod]").forEach(button => button.addEventListener("click", () => {
      if (!saveCollectionSelection(data.gameId, data.charName, button.dataset.versionCollection, button.dataset.versionMod)) showSideToast(t("mods.collections.selectionFailed"));
    }));
    bindDetailTranslation(sideBody, data);
    const refreshBtn = document.getElementById("detailRefreshHotkeysBtn");
    if (refreshBtn)
      refreshBtn.addEventListener("click", async () => {
        refreshBtn.disabled = true;
        refreshBtn.textContent = t("overlay.hotkeys.refreshing");
        try {
          const result = await window.overlayApi.getModDetails(
            data.charName,
            data.modName,
            true,
          );
          if (refreshBtn.isConnected)
            showSideToast(
              result.success
                ? t("overlay.hotkeys.refreshed")
                : result.error || t("overlay.hotkeys.refreshFailed"),
            );
        } catch (error) {
          if (refreshBtn.isConnected)
            showSideToast(error.message || t("overlay.hotkeys.refreshFailed"));
        } finally {
          refreshBtn.disabled = false;
          refreshBtn.textContent = t("overlay.hotkeys.refresh");
        }
      });
    const toggleBtn = document.getElementById("detailToggleBtn");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", async () => {
        toggleBtn.disabled = true;
        const originalText = toggleBtn.textContent;
        toggleBtn.textContent = data.modEnabled
          ? t("overlay.mods.disabling")
          : t("overlay.mods.enabling");
        try {
          const result = await window.overlayApi.toggleMod(
            data.charName,
            data.modName,
            !(data.modEnabled || data.modPending),
          );
          if (result.pending) {
            data.modPending = true;
            showSideToast(t("mods.conflicts.confirmToast"));
            toggleBtn.textContent = t("mods.conflicts.cancelPending");
            toggleBtn.classList.replace("enable", "disable");
            if (!document.getElementById("detailConfirmBtn")) {
              toggleBtn.insertAdjacentHTML("afterend", `<button type="button" class="detail-toggle-btn enable" id="detailConfirmBtn">${t("mods.conflicts.confirmTogether")}</button>`);
              bindDetailConflictConfirmation(sideBody, data);
            }
          } else if (result.success) {
            showSideToast(
              !data.modEnabled
                ? t("overlay.mods.enabled")
                : t("overlay.mods.disabled"),
            );
            window.overlayApi.hideSide();
          } else {
            showSideToast(result?.error || t("overlay.mods.toggleFailed"));
          }
        } catch {
          showSideToast(t("overlay.mods.toggleFailed"));
        } finally {
          toggleBtn.disabled = false;
          toggleBtn.textContent = data.modPending ? t("mods.conflicts.cancelPending") : originalText;
        }
      });
    }
    bindDetailConflictConfirmation(sideBody, data);
    const markBtn = document.getElementById("detailMarkBtn");
    if (markBtn) {
      markBtn.addEventListener("click", async () => {
        const nextMarked = markBtn.dataset.marked !== "true";
        markBtn.disabled = true;
        try {
          const result = await window.overlayApi.setModMarked(
            data.charName,
            data.modName,
            nextMarked,
          );
          if (result?.success) {
            markBtn.dataset.marked = nextMarked ? "true" : "false";
            markBtn.textContent = nextMarked
              ? t("overlay.mark.removeAction")
              : t("overlay.mark.addAction");
            markBtn.classList.toggle("is-marked", nextMarked);
            showSideToast(
              nextMarked ? t("overlay.mark.added") : t("overlay.mark.removed"),
            );
          } else {
            showSideToast(result?.error || t("overlay.mark.failed"));
          }
        } catch {
          showSideToast(t("overlay.mark.failed"));
        } finally {
          markBtn.disabled = false;
        }
      });
    }
    if (data.clickableHotkeysEnabled) {
      document
        .querySelectorAll(".detail-hotkey-row.clickable")
        .forEach((row) => {
          row.addEventListener("click", () => {
            applyDetailHotkey(row);
          });
          row.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              applyDetailHotkey(row);
            }
          });
        });
    }
  }
});
