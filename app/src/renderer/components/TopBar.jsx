import { t } from "../../shared/i18n/index.mjs";
import React from "react";
import { GameSelector } from "./GameSelector.jsx";
import { DownloadManagerButton } from "./DownloadManagerButton.jsx";
import { LaunchControls } from "./LaunchControls.jsx";
import { WindowControls } from "./WindowControls.jsx";
import { Icon } from "./Icon.jsx";
import { useSortableOrder } from "../hooks/useSortableOrder.js";

const SETTINGS_TABS = ["settings", "game-settings"];

const TopBar = React.memo(function TopBar({
  activeTab,
  setActiveTab,
  activeGame,
  games,
  onGameSwitch,
  onHome,
}) {
  const menuItems = [
    {
      id: "characters",
      label: t("navigation.charactersOverview"),
      icon: "users",
    },
    {
      id: "modmarket",
      label: t("navigation.modDownloads"),
      icon: "store",
    },
    {
      id: "presets",
      label: t("navigation.presetSettings"),
      icon: "layers",
    },
    ...(activeGame?.id === "wuthering-waves"
      ? [{ id: "gacha", label: t("gacha.title"), icon: "sparkles" }]
      : []),
  ];
  const sorting = useSortableOrder(menuItems, "qaqm.navigationOrder", true, void 0, "x");
  const settingsActive = SETTINGS_TABS.includes(activeTab);
  return (
    <header className="app-topbar">
      <div className="window-drag-region" aria-hidden={true} />
      <button
        type="button"
        className="logo"
        onClick={onHome}
        title={t("navigation.charactersOverview")}
      >
        {"Q"}
        <span className="logo-mouth">{"A"}</span>
        {"QR"}
      </button>
      <GameSelector
        games={games}
        activeGame={activeGame}
        onSwitch={async () => {
          await onGameSwitch();
          if (!["settings", "game-settings", "modmarket"].includes(activeTab))
            setActiveTab("characters");
        }}
      />
      <span className="topbar-divider" aria-hidden={true} />
      <nav className="nav-menu" aria-label={t("navigation.mainNavigation")}>
        {sorting.items.map((item) => (
          <button
            {...sorting.itemProps(item.id)}
            type="button"
            className={`nav-item ${activeTab === item.id ? "active" : ""}`}
            aria-label={item.label}
            aria-current={activeTab === item.id ? "page" : void 0}
            onClick={() => setActiveTab(item.id)}
            title={t("navigation.tabSortHint", { label: item.label })}
            key={item.id}
          >
            <Icon name={item.icon} className="nav-icon" />
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="sort-announcement sr-only" role="status">
        {sorting.announcement}
      </div>
      {sorting.error && (
        <div className="topbar-error" role="alert">
          {sorting.error}
        </div>
      )}
      <div className="topbar-actions">
        <DownloadManagerButton />
        <button
          type="button"
          className={`icon-btn topbar-settings ${settingsActive ? "is-active" : ""}`}
          aria-label={t("navigation.systemSettings")}
          aria-current={settingsActive ? "page" : void 0}
          title={t("navigation.systemSettings")}
          onClick={() => setActiveTab("settings")}
        >
          <Icon name="gear" size={18} />
        </button>
        <LaunchControls
          activeGame={activeGame}
          settingsActive={activeTab === "game-settings"}
          onOpenSettings={() => setActiveTab("game-settings")}
        />
      </div>
      <WindowControls />
    </header>
  );
});
export { TopBar };
