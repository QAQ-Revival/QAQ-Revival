import { t } from "../../shared/i18n/index.mjs";
import { GameSelector } from "./GameSelector.jsx";
import { DownloadManagerButton } from "./DownloadManagerButton.jsx";
import { LaunchControls } from "./LaunchControls.jsx";
import { useSortableOrder } from "../hooks/useSortableOrder.js";
import { useSidebarResize } from "../hooks/useSidebarResize.js";
import React from "react";
const QAQ_OFFICIAL_WEBSITE_URL = "https://github.com/QAQ-Revival/QAQ-Revival";
const Sidebar = React.memo(function Sidebar({
  activeTab,
  setActiveTab,
  activeGame,
  games,
  onGameSwitch,
  collapsed,
  onToggleCollapse,
}) {
  const resize = useSidebarResize(collapsed);
  const menuItems = [
    {
      id: "characters",
      label: t("navigation.charactersOverview"),
      icon: "🎭",
    },
    {
      id: "modmarket",
      label: t("navigation.modDownloads"),
      icon: "↓",
    },
    {
      id: "presets",
      label: t("navigation.presetSettings"),
      icon: "⚙️",
    },
    ...(activeGame?.id === "wuthering-waves"
      ? [{ id: "gacha", label: t("gacha.title"), icon: "✦" }]
      : []),
  ];
  const sorting = useSortableOrder(menuItems, "qaqm.navigationOrder");
  function handleLogoClick(e) {
    e.stopPropagation();
    window.api.openExternalUrl(QAQ_OFFICIAL_WEBSITE_URL);
  }
  return (
    <div
      className={`sidebar ${collapsed ? "collapsed" : ""}`}
      style={resize.style}
    >
      {!collapsed && <div {...resize.handle} />}
      <div
        className="sidebar-header"
        onClick={collapsed ? onToggleCollapse : void 0}
        style={
          collapsed
            ? {
                cursor: "pointer",
              }
            : void 0
        }
      >
        <div
          className="logo"
          onClick={collapsed ? void 0 : handleLogoClick}
          title={collapsed ? void 0 : t("navigation.projectHomepage")}
          style={
            collapsed
              ? void 0
              : {
                  cursor: "pointer",
                }
          }
        >
          {collapsed ? "Q" : "QAQR"}
        </div>
        {!collapsed && <DownloadManagerButton />}
        {!collapsed && (
          <button
            className="sidebar-toggle"
            onClick={onToggleCollapse}
            title={t("navigation.collapseMenu")}
            aria-label={t("navigation.collapseMenu")}
          >
            <span className="sidebar-toggle-icon">{"‹"}</span>
          </button>
        )}
      </div>
      {collapsed && <DownloadManagerButton />}
      <GameSelector
        games={games}
        activeGame={activeGame}
        collapsed={collapsed}
        onSwitch={async () => {
          await onGameSwitch();
          if (!["settings", "game-settings", "modmarket"].includes(activeTab))
            setActiveTab("characters");
        }}
      />
      <nav className="nav-menu" aria-label={t("navigation.mainNavigation")}>
        {sorting.items.map((item) => (
          <button
            {...sorting.itemProps(item.id)}
            type="button"
            className={`nav-item ${activeTab === item.id ? "active" : ""}`}
            aria-label={item.label}
            aria-current={activeTab === item.id ? "page" : void 0}
            onClick={() => setActiveTab(item.id)}
            title={t("navigation.tabSortHint", {
              label: item.label,
            })}
            key={item.id}
          >
            <span className="nav-icon" aria-hidden={true}>
              {item.icon}
            </span>
            {!collapsed && <span className="nav-label">{item.label}</span>}
            {!collapsed && <span className="sort-grip" aria-hidden={true} />}
          </button>
        ))}
      </nav>
      <div className="sort-announcement" role="status">
        {sorting.announcement}
      </div>
      {sorting.error && (
        <div className="game-selector-error" role="alert">
          {sorting.error}
        </div>
      )}
      <div className="sidebar-footer">
        <LaunchControls
          activeGame={activeGame}
          collapsed={collapsed}
          settingsActive={activeTab === "game-settings"}
          onOpenSettings={() => setActiveTab("game-settings")}
        />
        <button
          type="button"
          className={`sidebar-settings ${activeTab === "settings" ? "active" : ""}`}
          aria-label={t("navigation.systemSettings")}
          aria-current={activeTab === "settings" ? "page" : void 0}
          title={t("navigation.systemSettings")}
          onClick={() => setActiveTab("settings")}
        >
          <span aria-hidden={true}>{"⚙"}</span>
          {!collapsed && t("navigation.systemSettings")}
        </button>
      </div>
    </div>
  );
});
export { Sidebar };
