import { t } from "../../shared/i18n/index.mjs";
export function renderLayout() {
  return `<div class="side-root">
    <div class="side-panel">
        <div class="side-header">
            <div class="side-title" id="sideTitle">${t("overlay.loading.pending")}</div>
            <button class="side-close" id="sideZoomOut" title="${t("overlay.zoom.out")}">➖</button>
            <button class="side-close" id="sideZoomIn" title="${t("overlay.zoom.in")}">➕</button>
            <button class="side-close" id="sideClose" aria-label="${t("overlay.actions.close")}">✕</button>
        </div>
        <div class="side-body" id="sideBody"></div>
        <div class="side-toast" id="sideToast"></div>
    </div>
</div>`;
}
