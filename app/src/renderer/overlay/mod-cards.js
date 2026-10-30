import { t } from "../../shared/i18n/index.mjs";
import { cleanCollectionText } from "../../shared/mod-collection-names.mjs";
import { getCollectionVariantLabel } from "./collections.js";
import { escapeHtml } from "./html.js";
import { icon } from "./icons.js";
import { getModTypeLabels } from "../lib/modPresentation.js";
const renderTypes = mod => getModTypeLabels(mod).length ? `<span class="mod-type-badge">${escapeHtml(getModTypeLabels(mod).join(" · "))}</span>` : "";
const renderSwitch = (m) => {
  const on = m.enabled || m.pendingEnabled;
  return `<button type="button" role="switch" aria-checked="${!!on}" aria-label="${escapeHtml(m.name)}" class="mod-switch ${on ? "active" : ""} ${m.pendingEnabled ? "pending" : ""}" data-toggle="1" data-mod="${escapeHtml(m.name)}" data-enabled="${m.enabled}" title="${m.pendingEnabled ? t("mods.conflicts.cancelPending") : m.enabled ? t("overlay.mods.disableHint") : t("overlay.mods.enableHint")}"></button>`;
};
const hasVisibleConflict = (m) => m.hasConflict && (m.enabled || m.pendingEnabled);
export function renderModCards(
  displayMods,
  { viewMode, selectedModName, openCollectionMenu, compatibilityMode },
) {
  if (viewMode === "gallery") {
    // Gallery card mirrors the manager view: a preview plus a footer
    // row with the mod name and enable switch.
    return displayMods
      .map((m) => {
        const collection = m._collection;
        const collectionLabel = collection
          ? cleanCollectionText(m._collectionVersionLabel) ||
            getCollectionVariantLabel(m)
          : "";
        return `
                <div class="mod-gallery-item ${m.enabled ? "enabled" : ""} ${selectedModName === m.name ? "selected" : ""} ${collection && openCollectionMenu === collection.identity ? "collection-menu-open" : ""}" data-mod="${escapeHtml(m.name)}" data-enabled="${m.enabled}">
                    <div class="mod-gallery-image">
                        ${m.previewUrl ? `<img src="${m.previewUrl}" alt="" loading="lazy" onerror="this.style.display='none'">` : `<div class="mod-gallery-placeholder">${icon("box", 28)}</div>`}
                        ${m.pinned ? `<span class="mod-gallery-pin" title="${t("overlay.pin.added")}">${icon("pin", 14)}</span>` : ""}
                        <button type="button" class="mod-gallery-mark ${m.marked ? "active" : ""}" data-mark-toggle="1" data-mod="${escapeHtml(m.name)}" data-marked="${m.marked}" title="${m.marked ? t("overlay.mark.remove") : t("overlay.mark.add")}">${icon("bookmark", 14)}</button>
                        ${hasVisibleConflict(m) ? `<span class="mod-gallery-conflict" title="${t("overlay.mods.conflict")}">${icon("alert", 14)}</span>` : ""}
                        ${
                          collection
                            ? `
                            <div class="overlay-collection-dropdown" data-collection="${escapeHtml(collection.identity)}">
                                <button type="button" class="overlay-collection-trigger" data-collection-trigger="1" data-collection="${escapeHtml(collection.identity)}" title="${t(
                                  "overlay.collections.name",
                                  {
                                    collectionName: escapeHtml(collection.name),
                                  },
                                )}">
                                    <span>${escapeHtml(collectionLabel)}</span>
                                    ${icon("chevron-down", 12)}
                                </button>
                            </div>
                        `
                            : ""
                        }
                    </div>
                    <div class="mod-gallery-footer">
                        <button type="button" class="mod-gallery-name" title="${escapeHtml(m.name)}"><span class="mod-gallery-name-text">${renderTypes(m)}${escapeHtml(m.name)}${collection ? ` <span class="overlay-collection-badge">${collection.variants.length}</span>` : ""}</span></button>
                        ${renderSwitch(m)}
                    </div>
                </div>
            `;
      })
      .join("");
  } else {
    return displayMods
      .map((m) => {
        const collection = m._collection;
        return `
                <div class="mod-item ${m.enabled ? "enabled" : ""} ${selectedModName === m.name ? "selected" : ""}" data-mod="${escapeHtml(m.name)}" data-enabled="${m.enabled}">
                    <div class="mod-preview">
                        ${!compatibilityMode && m.previewUrl ? `<img src="${m.previewUrl}" alt="">` : icon("box", 18)}
                    </div>
                    <div class="mod-info" data-action="detail">
                        <button type="button" class="mod-name" title="${escapeHtml(m.name)}">${renderTypes(m)}${escapeHtml(m.name)}${
                          collection
                            ? ` <span class="overlay-collection-badge">${t(
                                "overlay.collections.count",
                                {
                                  count: collection.variants.length,
                                },
                              )}</span>`
                            : ""
                        }${m.pinned ? `<span class="mod-pin-icon" title="${t("overlay.pin.added")}">${icon("pin", 14)}</span>` : ""}${hasVisibleConflict(m) ? `<span class="mod-conflict-icon" title="${t("overlay.mods.conflict")}">${icon("alert", 14)}</span>` : ""}</button>
                        ${m.pendingEnabled ? `<div class="mod-status-text">${t("mods.conflicts.awaitingConfirmation")}</div>` : ""}
                        ${
                          collection
                            ? `
                            <div class="overlay-collection-variants">
                                ${collection.variants
                                  .map(
                                    (variant) => `
                                    <button type="button" class="overlay-collection-chip ${variant.name === m.name ? "active" : ""}" data-collection-option="1" data-collection="${escapeHtml(collection.identity)}" data-mod="${escapeHtml(variant.name)}" title="${escapeHtml(variant.name)}">
                                        ${escapeHtml(getCollectionVariantLabel(variant))}
                                    </button>
                                `,
                                  )
                                  .join("")}
                            </div>
                        `
                            : ""
                        }
                    </div>
                    <button type="button" class="icon-btn mod-mark-btn ${m.marked ? "active" : ""}" data-mark-toggle="1" data-mod="${escapeHtml(m.name)}" data-marked="${m.marked}" title="${m.marked ? t("overlay.mark.remove") : t("overlay.mark.add")}">${icon("bookmark")}</button>
                    ${renderSwitch(m)}
                </div>
            `;
      })
      .join("");
  }
}
