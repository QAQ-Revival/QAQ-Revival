import { t } from "../../shared/i18n/index.mjs";
import { icon } from "./icons.js";

const switchRow = (id, title, hint, attributes = "") => `
                <div class="settings-group">
                    <label class="settings-switch-row" for="${id}" ${attributes}>
                        <div class="settings-switch-copy">
                            <div class="settings-switch-title">${title}</div>
                            <div class="settings-switch-hint">${hint}</div>
                        </div>
                        <input type="checkbox" class="settings-switch-input" id="${id}">
                        <span class="settings-switch"></span>
                    </label>
                </div>`;

const menuItem = (id, iconName, label, labelId = "") => `
            <button type="button" class="overlay-menu-item" id="${id}">
                ${icon(iconName)}
                <span${labelId ? ` id="${labelId}"` : ""}>${label}</span>
            </button>`;

export function renderLayout() {
  return `<div class="overlay-root">
    <div class="overlay-panel" id="overlayPanel">

        <div class="overlay-header">
            <div class="overlay-title">${t("overlay.title")}</div>
            <div class="overlay-actions">
                <button type="button" class="icon-btn" id="settingsBtn" title="${t("overlay.settings.title")}">${icon("gear")}</button>
                <button type="button" class="icon-btn" id="pinBtn" title="${t("overlay.pin.window")}">${icon("pin")}</button>
                <button type="button" class="icon-btn" id="closeBtn" title="${t("overlay.actions.close")}">${icon("x")}</button>
            </div>
        </div>

        <div class="char-strip" id="charStrip">
            <button type="button" class="icon-btn char-bubble-btn" id="bubbleToggleBtn" title="${t("overlay.characters.menu")}">${icon("grid")}</button>
            <div class="char-strip-scroll" id="charList">
                <div class="loading overlay-loading-compact">${t("overlay.loading.pending")}</div>
            </div>
            <button type="button" class="icon-btn char-bubble-btn" id="charFilterBtn">${icon("filter")}</button>
        </div>

        <div class="overlay-appearance-sections" id="appearanceSections" role="tablist" aria-label="${t("mods.sections.title")}"></div>
        <div class="overlay-mod-filters">
            <div class="search-field">
                ${icon("search", 14)}
                <input type="search" id="overlayModSearch" placeholder="${t("mods.search.placeholder")}" aria-label="${t("mods.search.placeholder")}">
            </div>
            <details class="overlay-tag-filter">
                <summary class="btn"><span id="overlayTagSummary">${t("mods.library.selectTags")}</span>${icon("chevron-down", 14)}</summary>
                <div class="overlay-tag-menu" id="overlayTagMenu"></div>
            </details>
        </div>
        <div class="overlay-conflict-confirm" id="conflictConfirm" hidden></div>
        <div class="sort-bar">
            <div class="segmented" role="group" aria-label="${t("overlay.sort.title")}">
                <button type="button" class="sort-btn active" data-sort="name">${t("overlay.sort.name")}</button>
                <button type="button" class="sort-btn" data-sort="status">${t("overlay.sort.status")}</button>
                <button type="button" class="sort-btn" data-sort="time">${t("overlay.sort.time")}</button>
                <button type="button" class="sort-btn" data-sort="custom">${t("overlay.sort.custom")}</button>
            </div>
            <div class="toolbar-spacer"></div>
            <button type="button" class="icon-btn" id="focusEnabledBtn" title="${t("overlay.focus.enabledHint")}">${icon("target")}</button>
            <button type="button" class="icon-btn active" id="overlayCollectionBtn" title="${t("overlay.collections.hide")}" aria-pressed="true">${icon("layers")}</button>
            <button type="button" class="icon-btn sort-btn" id="exclusiveBtn" data-sort="exclusive" title="${t("overlay.selection.single")}">${icon("radio")}</button>
            <button type="button" class="icon-btn" id="viewModeBtn" title="${t("overlay.view.toggle")}">
                <span id="viewModeIcon"></span>
                <span class="sr-only" id="viewModeLabel">${t("overlay.view.gallery")}</span>
            </button>
        </div>

        <div class="mod-list" id="modList">
            <div class="empty-state">${t("overlay.characters.choose")}</div>
        </div>

        <div id="presetSection" hidden>
            <div id="presetList"></div>
        </div>

        <div class="overlay-footer">
            <label class="auto-locate-control" title="${t("overlay.focus.autoHint")}">
                <input type="checkbox" class="settings-switch-input" id="autoLocateToggle" checked>
                <span class="settings-switch"></span>
                ${t("overlay.focus.autoTitle")}
            </label>
            <span class="footer-hint" id="activityStatus" title="${t("overlay.activity.sortHint")}"></span>
            <span class="footer-count" id="modCount"></span>
        </div>


        <div class="internal-panel" id="settingsPanel">
            <div class="panel-header">
                <div class="panel-header-title">${t("overlay.settings.heading")}</div>
                <button type="button" class="icon-btn" id="settingsPanelClose" aria-label="${t("overlay.actions.close")}" title="${t("overlay.actions.close")}">${icon("x")}</button>
            </div>
            <div class="panel-body">
                ${switchRow("activityToggle", t("overlay.activity.title"), t("overlay.activity.description"))}
                <div class="settings-group">
                    <div class="settings-row">
                        <div class="settings-label">${t("overlay.appearance.opacity")}</div>
                        <div class="settings-slider-row">
                            <input type="range" class="settings-slider" id="opacitySlider" min="60" max="100" value="95" aria-label="${t("overlay.appearance.opacity")}">
                            <span class="settings-value" id="opacityValue">95%</span>
                        </div>
                    </div>
                </div>
                <div class="settings-group settings-zoom">
                    <div class="settings-row">
                        <div class="settings-label">${t("overlay.zoom.title")}</div>
                        <div class="settings-stepper">
                            <button type="button" class="icon-btn" id="overlayZoomOut" title="${t("overlay.zoom.out")}">${icon("minus")}</button>
                            <button type="button" class="btn btn-ghost btn-sm" id="overlayScaleLabel" title="${t("overlay.zoom.reset")}">100%</button>
                            <button type="button" class="icon-btn" id="overlayZoomIn" title="${t("overlay.zoom.in")}">${icon("plus")}</button>
                        </div>
                    </div>
                </div>
                <div class="settings-group">
                    <div class="settings-row">
                        <div class="settings-switch-copy">
                            <div class="settings-label">${t("overlay.hotkeys.showOverlay")}</div>
                            <div class="settings-hotkey-hint">${t("overlay.hotkeys.captureHint")}</div>
                        </div>
                        <input type="text" class="hotkey-input" id="hotkeyInput" value="Alt + F" readonly aria-label="${t("overlay.hotkeys.showOverlay")}">
                    </div>
                </div>
                ${switchRow("autoReloadToggle", t("overlay.reload.title"), t("overlay.reload.description"))}
                ${switchRow("presetAutoReloadToggle", t("overlay.presets.reloadTitle"), t("overlay.presets.reloadDescription"))}
                ${switchRow("clickableHotkeysToggle", t("overlay.hotkeys.clickTitle"), t("overlay.hotkeys.clickDescription"))}
                ${switchRow("persistBridgeToggle", t("overlay.persist.toggleTitle"), t("overlay.persist.restartHint"), `title="${t("overlay.persist.manageHint")}"`)}
            </div>
        </div>

        <div class="overlay-toast" id="toast"></div>
        <div class="overlay-menu" id="cuteContextMenu">
            <div class="overlay-menu-title" id="cuteMenuTitle">${t("overlay.mods.choose")}</div>
            ${menuItem("cuteMenuOpenFolder", "folder", t("overlay.folder.open"))}
            ${menuItem("cuteMenuOpenManager", "external", t("overlay.manager.open"))}
            ${menuItem("cuteMenuPinTop", "pin", t("overlay.pin.add"), "cuteMenuPinLabel")}
            ${menuItem("cuteMenuMarkMod", "bookmark", t("overlay.mark.add"), "cuteMenuMarkLabel")}
            ${menuItem("cuteMenuFixMod", "wrench", t("overlay.fixer.open"))}
            ${menuItem("cuteMenuResetMod", "refresh", t("overlay.ini.resetMod"))}
        </div>
        <div class="overlay-menu" id="charContextMenu">
            <div class="overlay-menu-title" id="charMenuTitle">${t("overlay.characters.actions")}</div>
            ${menuItem("charMenuResetIni", "refresh", t("overlay.ini.resetCharacter"))}
        </div>
    </div>
</div>
<div class="overlay-collection-floating-menu" id="overlayCollectionFloatingMenu" hidden></div>`;
}
