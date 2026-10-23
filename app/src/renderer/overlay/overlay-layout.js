import { t } from "../../shared/i18n/index.mjs";
export function renderLayout() {
  return `<div class="overlay-root">
    <div class="overlay-panel" id="overlayPanel">

        <div class="overlay-header">
            <div class="overlay-title">
                <span>🎮</span>
                <span>${t("overlay.title")}</span>
            </div>
            <div class="overlay-actions">
                <button class="overlay-btn compact" id="overlayZoomOut" title="${t("overlay.zoom.out")}">A-</button>
                <button class="overlay-scale-label" id="overlayScaleLabel" title="${t("overlay.zoom.reset")}">100%</button>
                <button class="overlay-btn compact" id="overlayZoomIn" title="${t("overlay.zoom.in")}">A+</button>
                <button class="overlay-btn" id="settingsBtn" title="${t("overlay.settings.title")}">⚙️</button>
                <button class="overlay-btn" id="pinBtn" title="${t("overlay.pin.window")}">📌</button>
                <button class="overlay-btn danger" id="closeBtn" title="${t("overlay.actions.close")}">✕</button>
            </div>
        </div>

        <div class="char-strip" id="charStrip">
            <button type="button" class="char-bubble-btn" id="bubbleToggleBtn" title="${t("overlay.characters.menu")}">☰</button>
            <div class="char-strip-scroll" id="charList">
                <div class="loading overlay-loading-compact">${t("overlay.loading.pending")}</div>
            </div>
            <button class="char-bubble-btn" id="charFilterBtn" title="${t("overlay.characters.withMods")}">🎯</button>
        </div>

        <div class="sort-bar">
            <span class="sort-bar-label">${t("overlay.sort.title")}</span>
            <button class="sort-btn active" data-sort="name">${t("overlay.sort.name")}</button>
            <button class="sort-btn" data-sort="status">${t("overlay.sort.status")}</button>
            <button class="sort-btn" data-sort="time">${t("overlay.sort.time")}</button>
            <button class="sort-btn" data-sort="custom">${t("overlay.sort.custom")}</button>
            <div class="toolbar-spacer"></div>
            <button class="sort-btn" id="focusEnabledBtn" title="${t("overlay.focus.enabledHint")}">${t("overlay.focus.action")}</button>
            <button class="sort-btn active" id="overlayCollectionBtn" title="${t("overlay.collections.hide")}" aria-pressed="true">${t("overlay.collections.title")}</button>
            <button class="sort-btn active" id="exclusiveBtn" data-sort="exclusive">${t("overlay.selection.single")}</button>
            <button class="view-mode-toggle-overlay" id="viewModeBtn" title="${t("overlay.view.toggle")}">
                <span id="viewModeIcon"></span>
                <span id="viewModeLabel">${t("overlay.view.gallery")}</span>
            </button>
        </div>

        <div class="mod-list" id="modList">
            <div class="empty-state">${t("overlay.characters.choose")}</div>
        </div>

        <div class="preset-section" id="presetSection">
            <div class="preset-section-title">${t("overlay.presets.title")}</div>
            <div class="preset-list" id="presetList"></div>
        </div>

        <div class="overlay-footer">
            <label class="auto-locate-control" title="${t("overlay.focus.autoHint")}"><input type="checkbox" id="autoLocateToggle" checked>${t("overlay.focus.autoTitle")}</label>
            <span class="footer-hint" id="activityStatus" title="${t("overlay.activity.sortHint")}"></span>
            <span class="footer-hint" id="modCount"></span>
        </div>


        <div class="internal-panel" id="settingsPanel">
            <div class="panel-header">
                <div class="panel-header-title">${t("overlay.settings.heading")}</div>
                <button class="panel-close" id="settingsPanelClose" aria-label="${t("overlay.actions.close")}">✕</button>
            </div>
            <div class="panel-body">
                <div class="settings-group">
                    <label class="settings-switch-row" for="activityToggle">
                        <div class="settings-switch-copy">
                            <div class="settings-switch-title">${t("overlay.activity.title")}</div>
                            <div class="settings-switch-hint">${t("overlay.activity.description")}</div>
                        </div>
                        <input type="checkbox" class="settings-switch-input" id="activityToggle" checked>
                        <span class="settings-switch"></span>
                    </label>
                </div>
                <div class="settings-group">
                    <div class="settings-label">${t("overlay.appearance.opacity")}</div>
                    <div class="settings-slider-row">
                        <span class="settings-caption">${t("overlay.appearance.transparent")}</span>
                        <input type="range" class="settings-slider" id="opacitySlider" min="20" max="100" value="88">
                        <span class="settings-caption">${t("overlay.appearance.opaque")}</span>
                        <span class="settings-value" id="opacityValue">88%</span>
                    </div>
                </div>
                <div class="settings-group">
                    <div class="settings-label">${t("overlay.hotkeys.showOverlay")}</div>
                    <input type="text" class="hotkey-input" id="hotkeyInput" value="Alt + F" readonly>
                    <div class="settings-hotkey-hint">${t("overlay.hotkeys.captureHint")}</div>
                </div>
                <div class="settings-group">
                    <label class="settings-switch-row" for="autoReloadToggle">
                        <div class="settings-switch-copy">
                            <div class="settings-switch-title">${t("overlay.reload.title")}</div>
                            <div class="settings-switch-hint">
                                ${t("overlay.reload.description")}
                            </div>
                        </div>
                        <input type="checkbox" class="settings-switch-input" id="autoReloadToggle">
                        <span class="settings-switch"></span>
                    </label>
                </div>
                <div class="settings-group">
                    <label class="settings-switch-row" for="presetAutoReloadToggle">
                        <div class="settings-switch-copy">
                            <div class="settings-switch-title">${t("overlay.presets.reloadTitle")}</div>
                            <div class="settings-switch-hint">
                                ${t("overlay.presets.reloadDescription")}
                            </div>
                        </div>
                        <input type="checkbox" class="settings-switch-input" id="presetAutoReloadToggle">
                        <span class="settings-switch"></span>
                    </label>
                </div>
                <div class="settings-group">
                    <label class="settings-switch-row" for="clickableHotkeysToggle">
                        <div class="settings-switch-copy">
                            <div class="settings-switch-title">${t("overlay.hotkeys.clickTitle")}</div>
                            <div class="settings-switch-hint">
                                ${t("overlay.hotkeys.clickDescription")}
                            </div>
                        </div>
                        <input type="checkbox" class="settings-switch-input" id="clickableHotkeysToggle">
                        <span class="settings-switch"></span>
                    </label>
                </div>
                <div class="settings-group">
                    <div class="settings-label">${t("overlay.persist.title")}</div>
                    <div class="settings-description">${t("overlay.persist.manageHint")}</div>
                </div>
                <div class="settings-group">
                    <label class="settings-switch-row" for="persistBridgeToggle">
                        <div class="settings-switch-copy">
                            <div class="settings-switch-title">${t("overlay.persist.toggleTitle")}</div>
                            <div class="settings-switch-hint">
                                <div>${t("overlay.persist.description")}</div>
                                <div class="settings-restart-hint">${t("overlay.persist.restartHint")}</div>
                            </div>
                        </div>
                        <input type="checkbox" class="settings-switch-input" id="persistBridgeToggle">
                        <span class="settings-switch"></span>
                    </label>
                </div>
            </div>
        </div>

        <div class="overlay-toast" id="toast"></div>
        <div class="cute-context-menu" id="cuteContextMenu">
            <div class="cute-menu-header">
                <div class="cute-menu-title" id="cuteMenuTitle">${t("overlay.mods.choose")}</div>

            </div>
            <button class="cute-menu-item" id="cuteMenuOpenFolder">
                <span class="cute-menu-item-icon">📂</span>
                <span class="cute-menu-item-copy">
                    <span class="cute-menu-item-label">${t("overlay.folder.open")}</span>

                </span>
            </button>
            <button class="cute-menu-item" id="cuteMenuOpenManager">
                <span class="cute-menu-item-icon">🪄</span>
                <span class="cute-menu-item-copy">
                    <span class="cute-menu-item-label">${t("overlay.manager.open")}</span>

                </span>
            </button>
            <button class="cute-menu-item" id="cuteMenuPinTop">
                <span class="cute-menu-item-icon" id="cuteMenuPinIcon">📌</span>
                <span class="cute-menu-item-copy">
                    <span class="cute-menu-item-label" id="cuteMenuPinLabel">${t("overlay.pin.add")}</span>
                    <span class="cute-menu-item-hint" id="cuteMenuPinHint">${t("overlay.pin.addHint")}</span>
                </span>
            </button>
            <button class="cute-menu-item" id="cuteMenuMarkMod">
                <span class="cute-menu-item-icon" id="cuteMenuMarkIcon">🔖</span>
                <span class="cute-menu-item-copy">
                    <span class="cute-menu-item-label" id="cuteMenuMarkLabel">${t("overlay.mark.add")}</span>
                    <span class="cute-menu-item-hint" id="cuteMenuMarkHint">${t("overlay.mark.addHint")}</span>
                </span>
            </button>
            <button class="cute-menu-item" id="cuteMenuFixMod">
                <span class="cute-menu-item-icon">🔧</span>
                <span class="cute-menu-item-copy">
                    <span class="cute-menu-item-label">${t("overlay.fixer.open")}</span>

                </span>
            </button>
            <button class="cute-menu-item" id="cuteMenuResetMod">
                <span class="cute-menu-item-icon">🔄</span>
                <span class="cute-menu-item-copy">
                    <span class="cute-menu-item-label">${t("overlay.ini.resetMod")}</span>

                </span>
            </button>
        </div>
        <div class="cute-context-menu" id="charContextMenu">
            <div class="cute-menu-header">
                <div class="cute-menu-title" id="charMenuTitle">${t("overlay.characters.actions")}</div>

            </div>
            <button class="cute-menu-item" id="charMenuResetIni">
                <span class="cute-menu-item-icon">🔄</span>
                <span class="cute-menu-item-copy">
                    <span class="cute-menu-item-label">${t("overlay.ini.resetCharacter")}</span>

                </span>
            </button>
        </div>
    </div>
</div>
<div class="overlay-collection-floating-menu" id="overlayCollectionFloatingMenu" hidden></div>`;
}
