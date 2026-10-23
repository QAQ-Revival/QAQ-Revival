import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
export function MarketHeader({
  syncing,
  syncStatus,
  layoutMenuRef,
  setShowLayoutMenu,
  showLayoutMenu,
  infiniteScroll,
  setInfiniteScroll,
  setCurrentPage,
  equalRowHeight,
  setEqualRowHeight,
  showHotSection,
  setShowHotSection,
  refreshMenuRef,
  setShowRefreshMenu,
  loading,
  serverUrl,
  showRefreshMenu,
  syncMods,
}) {
  return (
    <div className="mod-market-header">
      <div className="header-left">
        <h2 className="mod-market-title">{"QAQM"}</h2>
        <button
          type="button"
          className="btn-market-web"
          onClick={() =>
            window.api.openExternalUrl("https://www.qaqm.top/market")
          }
          title={t("market.header.openWebsite")}
        >
          {t("market.header.website")}
        </button>
        {syncing && (
          <span className="sync-indicator">
            <span className="sync-spinner" />
            {t("common.status.syncing")}
          </span>
        )}
        {!syncing &&
          syncStatus &&
          syncStatus.fromCache &&
          syncStatus.syncError && (
            <span className="sync-indicator market-header-sync-indicator-layout">
              {t("market.header.offline")}
            </span>
          )}
      </div>
      <div className="header-right">
        <div className="btn-refresh-wrap" ref={layoutMenuRef}>
          <button
            className="btn-refresh"
            onClick={() => setShowLayoutMenu((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={showLayoutMenu}
          >
            {t("market.header.layout")}
            <span className="btn-refresh-caret">{"▾"}</span>
          </button>
          {showLayoutMenu && (
            <div className="refresh-menu layout-menu" role="menu">
              <button
                className={`refresh-menu-item layout-menu-toggle ${infiniteScroll ? "active" : ""}`}
                role="menuitemcheckbox"
                aria-checked={infiniteScroll}
                onClick={() => {
                  const val = !infiniteScroll;
                  setInfiniteScroll(val);
                  localStorage.setItem(
                    "modmarket-infinite-scroll",
                    String(val),
                  );
                  setCurrentPage(1);
                }}
              >
                <span className="refresh-menu-item-title">
                  <span className="layout-toggle-mark">
                    {infiniteScroll ? "✓" : ""}
                  </span>
                  {t("market.header.waterfall")}
                </span>
                <span className="refresh-menu-item-desc">
                  {t("market.header.waterfallHint")}
                </span>
              </button>
              <button
                className={`refresh-menu-item layout-menu-toggle ${equalRowHeight ? "active" : ""}`}
                role="menuitemcheckbox"
                aria-checked={equalRowHeight}
                onClick={() => {
                  const val = !equalRowHeight;
                  setEqualRowHeight(val);
                  localStorage.setItem(
                    "modmarket-equal-row-height",
                    String(val),
                  );
                }}
              >
                <span className="refresh-menu-item-title">
                  <span className="layout-toggle-mark">
                    {equalRowHeight ? "✓" : ""}
                  </span>
                  {t("market.header.equalHeight")}
                </span>
                <span className="refresh-menu-item-desc">
                  {t("market.header.equalHeightHint")}
                </span>
              </button>
              <button
                className={`refresh-menu-item layout-menu-toggle ${showHotSection ? "active" : ""}`}
                role="menuitemcheckbox"
                aria-checked={showHotSection}
                onClick={() => {
                  const val = !showHotSection;
                  setShowHotSection(val);
                  localStorage.setItem(
                    "modmarket-show-hot-section",
                    String(val),
                  );
                  setCurrentPage(1);
                }}
              >
                <span className="refresh-menu-item-title">
                  <span className="layout-toggle-mark">
                    {showHotSection ? "✓" : ""}
                  </span>
                  {t("market.header.popularSection")}
                </span>
                <span className="refresh-menu-item-desc">
                  {t("market.header.popularSectionHint")}
                </span>
              </button>
            </div>
          )}
        </div>
        <div className="btn-refresh-wrap" ref={refreshMenuRef}>
          <button
            className="btn-refresh"
            onClick={() => setShowRefreshMenu((v) => !v)}
            disabled={loading || syncing || !serverUrl}
            aria-haspopup="menu"
            aria-expanded={showRefreshMenu}
          >
            {loading ? t("common.status.loading") : t("common.actions.refresh")}
            <span className="btn-refresh-caret">{"▾"}</span>
          </button>
          {showRefreshMenu && (
            <div className="refresh-menu" role="menu">
              <button
                className="refresh-menu-item"
                role="menuitem"
                onClick={() => {
                  setShowRefreshMenu(false);
                  syncMods(false);
                }}
              >
                <span className="refresh-menu-item-title">
                  {t("market.header.incrementalRefresh")}
                </span>
                <span className="refresh-menu-item-desc">
                  {t("market.header.incrementalRefreshHint")}
                </span>
              </button>
              <button
                className="refresh-menu-item"
                role="menuitem"
                onClick={() => {
                  setShowRefreshMenu(false);
                  syncMods(true);
                }}
              >
                <span className="refresh-menu-item-title">
                  {t("market.header.fullRefresh")}
                </span>
                <span className="refresh-menu-item-desc">
                  {t("market.header.fullRefreshHint")}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
