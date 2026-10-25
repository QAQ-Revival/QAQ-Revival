import { t } from "../../shared/i18n/index.mjs";
import { escapeHtml, encodeHotkeyPayload } from "./html.js";
import { getCollectionVariantLabel } from "./collections.js";
export function renderModDetails({ mod, character, hotkeysHtml, collection }) {
  let detailHtml = "";
  if (collection?.variants.length > 1) {
    detailHtml += `<div class="detail-versions"><div class="detail-versions-title">${t("mods.collections.versionHeading")}</div><div class="detail-version-options">${collection.variants.map(variant => `<button type="button" class="detail-version-option ${variant.name === mod.name ? "active" : ""}" data-version-collection="${escapeHtml(collection.identity)}" data-version-mod="${escapeHtml(variant.name)}" aria-pressed="${variant.name === mod.name}">${escapeHtml(getCollectionVariantLabel(variant))}</button>`).join("")}</div></div>`;
  }
  if (mod.previewUrl) {
    detailHtml += `<img class="detail-preview-img" src="${mod.previewUrl}" alt="">`;
  }
  detailHtml += `<div class="detail-meta"><span class="detail-status">${t(
    "overlay.details.status",
    {
      status: mod.enabled
        ? t("overlay.mods.enabledStatus")
        : t("overlay.mods.disabledStatus"),
      character: escapeHtml(character),
    },
  )}</span><button type="button" class="detail-translate-btn" id="detailTranslateBtn" disabled aria-pressed="false" title="${t("overlay.translation.description")}">${t("overlay.translation.google")}</button></div><div class="detail-translate-status" id="detailTranslateStatus" role="status" aria-live="polite"></div>`;
  if (mod.hasConflict && (mod.enabled || mod.pendingEnabled)) {
    detailHtml += `<div class="detail-conflict">${t("overlay.mods.conflictNotice")}</div>`;
  }
  detailHtml += `<button class="detail-toggle-btn detail-mark-button ${mod.marked ? "is-marked" : ""}" id="detailMarkBtn" data-marked="${mod.marked ? "true" : "false"}">${mod.marked ? t("overlay.mark.removeAction") : t("overlay.mark.addAction")}</button>`;
  detailHtml += `<div class="detail-hotkey-toolbar"><span>${t("overlay.hotkeys.heading")}</span><button type="button" class="detail-translate-btn" id="detailRefreshHotkeysBtn" title="${t("overlay.hotkeys.refreshHint")}">${t("overlay.hotkeys.refresh")}</button></div><div class="detail-hotkey-section">${hotkeysHtml}</div>`;
  detailHtml += `<button class="detail-toggle-btn ${mod.enabled ? "disable" : "enable"}" id="detailToggleBtn">${mod.pendingEnabled ? t("mods.conflicts.cancelPending") : mod.enabled ? t("overlay.mods.disableAction") : t("overlay.mods.enableAction")}</button>`;
  if (mod.pendingEnabled) detailHtml += `<button type="button" class="detail-toggle-btn enable" id="detailConfirmBtn">${t("mods.conflicts.confirmTogether")}</button>`;
  return detailHtml;
}
export function renderHotkeys(details, { modName, clickable }) {
  let hkHtml = "";
  const hotkeyGroups = Array.isArray(details.hotkeyGroups)
    ? details.hotkeyGroups.filter(
        (group) => Array.isArray(group.hotkeys) && group.hotkeys.length > 0,
      )
    : [
        {
          name: modName,
          hotkeys: details.hotkeys || [],
        },
      ].filter((group) => group.hotkeys.length > 0);
  if (details.success && hotkeyGroups.length > 0) {
    let hotkeyIndex = 0;
    const renderHotkey = (hk) => {
      const index = hotkeyIndex++;
      const desc = escapeHtml(hk.description || hk.section || "");
      const alternatives =
        Array.isArray(hk.alternatives) && hk.alternatives.length > 0
          ? hk.alternatives
          : [
              {
                displayKeys: Array.isArray(hk.keys) ? hk.keys : [],
              },
            ];
      const encodedPayload = encodeHotkeyPayload(hk.applyPayload || null);
      const clickableClass = clickable ? " clickable" : "";
      const clickableTitle = hk.canApply
        ? t("overlay.hotkeys.applyHint")
        : t("overlay.hotkeys.unsupportedHint");
      const clickableAttr = clickable
        ? `role="button" tabindex="0" title="${clickableTitle}"`
        : "";
      const unsupportedHint = !hk.canApply
        ? `<span class="detail-hotkey-note">${t("overlay.hotkeys.manualHint")}</span>`
        : "";
      return `
                        <div class="detail-hotkey-row${clickableClass}" ${clickableAttr} data-hotkey-index="${index}" data-hotkey-desc="${desc}" data-hotkey-payload="${encodedPayload}">
                            <span class="detail-hotkey-desc"><span class="detail-hotkey-name">${desc}</span>${unsupportedHint}</span>
                            <span class="detail-hotkey-keys">${alternatives
                              .map((alt, altIndex) => {
                                const keys = Array.isArray(alt.displayKeys)
                                  ? alt.displayKeys
                                  : [];
                                return `<span class="detail-hotkey-alt">${keys.map((k) => `<span class="detail-kbd">${escapeHtml(k)}</span>`).join("")}</span>${altIndex < alternatives.length - 1 ? `<span class="detail-hotkey-or">${t("overlay.hotkeys.or")}</span>` : ""}`;
                              })
                              .join("")}</span>
                        </div>
                    `;
    };
    hkHtml = hotkeyGroups
      .map(
        (group) => `
                    <section class="detail-hotkey-group">
                        <h3 class="detail-hotkey-group-name" title="${escapeHtml(group.relativePath || group.name)}">${escapeHtml(group.name)}</h3>
                        ${group.hotkeys.map(renderHotkey).join("")}
                    </section>
                `,
      )
      .join("");
  } else if (details.success) {
    hkHtml = `<div class="detail-empty">${t("overlay.hotkeys.empty")}</div>`;
  } else {
    hkHtml = `<div class="detail-error">${t("overlay.hotkeys.loadRetry")}</div>`;
  }
  return hkHtml;
}
