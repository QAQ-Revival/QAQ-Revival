import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
import { Icon } from "../../../components/Icon.jsx";
import { Menu, MenuItem } from "../../../components/Menu.jsx";
function LayoutOption({ checked, hint, onToggle, children }) {
  return (
    <MenuItem
      role="menuitemcheckbox"
      aria-checked={checked}
      title={hint}
      icon={
        <Icon
          name="check"
          size={14}
          className={checked ? "" : "menu-check-off"}
        />
      }
      onClick={onToggle}
    >
      {children}
    </MenuItem>
  );
}
export function MarketHeader({
  sourceTabs,
  syncing,
  syncStatus,
  infiniteScroll,
  setInfiniteScroll,
  setCurrentPage,
  equalRowHeight,
  setEqualRowHeight,
  showHotSection,
  setShowHotSection,
  loading,
  serverUrl,
  syncMods,
}) {
  return (
    <header className="page-header mod-market-header">
      <h2 className="mod-market-title sr-only">{"QAQR"}</h2>
      {sourceTabs}
      <div className="page-actions">
        {syncing && (
          <span className="toolbar-label market-sync-indicator">
            <span className="spinner" />
            {t("common.status.syncing")}
          </span>
        )}
        {!syncing && syncStatus?.fromCache && syncStatus?.syncError && (
          <span className="badge badge-warning" title={syncStatus.syncError}>
            {t("market.header.offline")}
          </span>
        )}
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() =>
            window.api.openExternalUrl("https://www.qaqm.top/market")
          }
          title={t("market.header.openWebsite")}
        >
          <Icon name="external" size={14} />
          {t("market.header.website")}
        </button>
        <Menu
          label={t("market.header.layout")}
          closeOnSelect={false}
          trigger={({ props }) => (
            <button type="button" className="btn btn-ghost" {...props}>
              {t("market.header.layout")}
              <Icon name="chevron-down" size={14} />
            </button>
          )}
        >
          <LayoutOption
            checked={infiniteScroll}
            hint={t("market.header.waterfallHint")}
            onToggle={() => {
              const val = !infiniteScroll;
              setInfiniteScroll(val);
              localStorage.setItem("modmarket-infinite-scroll", String(val));
              setCurrentPage(1);
            }}
          >
            {t("market.header.waterfall")}
          </LayoutOption>
          <LayoutOption
            checked={equalRowHeight}
            hint={t("market.header.equalHeightHint")}
            onToggle={() => {
              const val = !equalRowHeight;
              setEqualRowHeight(val);
              localStorage.setItem("modmarket-equal-row-height", String(val));
            }}
          >
            {t("market.header.equalHeight")}
          </LayoutOption>
          <LayoutOption
            checked={showHotSection}
            hint={t("market.header.popularSectionHint")}
            onToggle={() => {
              const val = !showHotSection;
              setShowHotSection(val);
              localStorage.setItem("modmarket-show-hot-section", String(val));
              setCurrentPage(1);
            }}
          >
            {t("market.header.popularSection")}
          </LayoutOption>
        </Menu>
        <Menu
          label={t("common.actions.refresh")}
          trigger={({ props }) => (
            <button
              type="button"
              className="btn"
              disabled={loading || syncing || !serverUrl}
              {...props}
            >
              {loading
                ? t("common.status.loading")
                : t("common.actions.refresh")}
              <Icon name="chevron-down" size={14} />
            </button>
          )}
        >
          <MenuItem
            hint={t("market.header.incrementalRefreshHint")}
            onClick={() => syncMods(false)}
          >
            {t("market.header.incrementalRefresh")}
          </MenuItem>
          <MenuItem
            hint={t("market.header.fullRefreshHint")}
            onClick={() => syncMods(true)}
          >
            {t("market.header.fullRefresh")}
          </MenuItem>
        </Menu>
      </div>
    </header>
  );
}
