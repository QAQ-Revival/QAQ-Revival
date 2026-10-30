import { t } from "../../shared/i18n/index.mjs";
import { icon } from "./icons.js";
export function renderLayout() {
  return `<div class="side-root">
    <div class="side-panel">
        <div class="side-header">
            <div class="side-title" id="sideTitle">${t("overlay.loading.pending")}</div>
            <button type="button" class="icon-btn" id="sideZoomOut" title="${t("overlay.zoom.out")}">${icon("minus")}</button>
            <button type="button" class="icon-btn" id="sideZoomIn" title="${t("overlay.zoom.in")}">${icon("plus")}</button>
            <button type="button" class="icon-btn" id="sideClose" aria-label="${t("overlay.actions.close")}" title="${t("overlay.actions.close")}">${icon("x")}</button>
        </div>
        <div class="side-character-search" id="sideCharacterSearchRow" hidden>
            <div class="search-field">
                ${icon("search", 14)}
                <input type="search" id="sideCharacterSearch" placeholder="${t("overlay.characters.search")}" aria-label="${t("overlay.characters.search")}">
            </div>
        </div>
        <div class="side-body" id="sideBody"></div>
        <div class="side-toast" id="sideToast"></div>
    </div>
</div>`;
}
