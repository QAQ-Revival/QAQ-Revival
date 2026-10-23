import { t } from "../../shared/i18n/index.mjs";
import { cleanCollectionText } from "../../shared/mod-collection-names.mjs";
import { getCollectionVariantLabel } from "./collections.js";
import { escapeHtml } from "./html.js";
export function renderModCards(
  displayMods,
  { viewMode, selectedModName, openCollectionMenu, compatibilityMode },
) {
  if (viewMode === "gallery") {
    // Gallery card mirrors the manager view: fixed 4:3 preview plus
    // a footer row with the mod name and enable switch.
    return displayMods
      .map((m) => {
        const collection = m._collection;
        const collectionLabel = collection
          ? cleanCollectionText(m._collectionVersionLabel) ||
            getCollectionVariantLabel(m)
          : "";
        return `
                <div class="mod-gallery-item ${m.enabled ? "enabled" : ""} ${selectedModName === m.name ? "selected" : ""} ${collection ? "has-collection" : ""} ${collection && openCollectionMenu === collection.identity ? "collection-menu-open" : ""}" data-mod="${m.name}" data-enabled="${m.enabled}">
                    <div class="mod-gallery-image">
                        ${m.previewUrl ? `<img src="${m.previewUrl}" alt="" loading="lazy" onerror="this.style.display='none'">` : '<div class="mod-gallery-placeholder">📦</div>'}
                        ${m.pinned ? `<span class="mod-gallery-pin" title="${t("overlay.pin.added")}">📌</span>` : ""}
                        <button class="mod-gallery-mark ${m.marked ? "active" : ""}" data-mark-toggle="1" data-mod="${m.name}" data-marked="${m.marked}" title="${m.marked ? t("overlay.mark.remove") : t("overlay.mark.add")}">🔖</button>
                        ${m.hasConflict && m.enabled ? `<span class="mod-gallery-conflict" title="${t("overlay.mods.conflict")}">⚠️</span>` : ""}
                        ${
                          collection
                            ? `
                            <div class="overlay-collection-dropdown" data-collection="${escapeHtml(collection.identity)}">
                                <button class="overlay-collection-trigger" data-collection-trigger="1" data-collection="${escapeHtml(collection.identity)}" title="${t(
                                  "overlay.collections.name",
                                  {
                                    collectionName: escapeHtml(collection.name),
                                  },
                                )}">
                                    <span>${escapeHtml(collectionLabel)}</span>
                                    <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                </button>
                            </div>
                        `
                            : ""
                        }
                    </div>
                    <div class="mod-gallery-footer">
                        <div class="mod-gallery-name" title="${escapeHtml(m.name)}">${escapeHtml(m.name)}${collection ? ` <span class="overlay-collection-badge">${collection.variants.length}</span>` : ""}</div>
                        <div class="mod-gallery-switch ${m.enabled ? "active" : ""}" data-toggle="1" data-mod="${m.name}" data-enabled="${m.enabled}" title="${m.enabled ? t("overlay.mods.disableHint") : t("overlay.mods.enableHint")}"></div>
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
                <div class="mod-item ${m.enabled ? "enabled" : ""} ${selectedModName === m.name ? "selected" : ""}" data-mod="${m.name}" data-enabled="${m.enabled}">
                    <div class="mod-preview">
                        ${!compatibilityMode && m.previewUrl ? `<img src="${m.previewUrl}" alt="">` : "📦"}
                    </div>
                    <div class="mod-info" data-action="detail">
                        <div class="mod-name">${escapeHtml(m.name)}${
                          collection
                            ? ` <span class="overlay-collection-badge">${t(
                                "overlay.collections.count",
                                {
                                  count: collection.variants.length,
                                },
                              )}</span>`
                            : ""
                        }${m.pinned ? ` <span class="mod-pin-icon" title="${t("overlay.pin.added")}">📌</span>` : ""}${m.hasConflict && m.enabled ? ' <span class="mod-conflict-icon">⚠️</span>' : ""}</div>
                        <div class="mod-status-text">${m.enabled ? t("overlay.mods.enabledStatus") : t("overlay.mods.disabledStatus")}</div>
                        ${
                          collection
                            ? `
                            <div class="overlay-collection-variants">
                                ${collection.variants
                                  .map(
                                    (variant) => `
                                    <button class="overlay-collection-chip ${variant.name === m.name ? "active" : ""}" data-collection-option="1" data-collection="${escapeHtml(collection.identity)}" data-mod="${escapeHtml(variant.name)}" title="${escapeHtml(variant.name)}">
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
                    <button class="mod-mark-btn ${m.marked ? "active" : ""}" data-mark-toggle="1" data-mod="${m.name}" data-marked="${m.marked}" title="${m.marked ? t("overlay.mark.remove") : t("overlay.mark.add")}">🔖</button>
                    <div class="toggle ${m.enabled ? "on" : ""}" data-toggle="1" data-mod="${m.name}" data-enabled="${m.enabled}"></div>
                </div>
            `;
      })
      .join("");
  }
}
