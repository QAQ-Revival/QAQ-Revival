import { t } from "../../../shared/i18n/index.mjs";
import React from "react";
import { Icon } from "../../components/Icon.jsx";
import { GameTile } from "../../components/GameSelector.jsx";
import { useGameUpdates } from "../../hooks/useGameUpdates.js";
import { GameSettingsPanel } from "./GameSettingsPanel.jsx";
import { GeneralSettings, getCategories } from "./SystemSettings.jsx";
import { getGamePages } from "./gamePages.js";
import {
  CATEGORY_KEY,
  GAME_PAGE_KEY,
  remembered,
  remember,
} from "./settingsPreferences.js";

// One settings surface: the current game's pages and the general ones share a navigation.
// `scope` comes from the tab that opened it and decides which group is showing.
function SettingsView({ scope, activeGame, devMode = false, games = [], allGames = [] }) {
  const gameId = activeGame?.id;
  const isGame = scope === "game";
  const categories = getCategories();
  const pages = gameId ? getGamePages(gameId) : [];
  const [categoryId, setCategoryId] = React.useState(() =>
    remembered(CATEGORY_KEY, "general"),
  );
  const [pageId, setPageId] = React.useState(() =>
    remembered(GAME_PAGE_KEY, "game-paths"),
  );
  const [toast, setToast] = React.useState(null);
  const [generalBusy, setGeneralBusy] = React.useState(false);
  const pane = React.useRef(null);
  // Each group loads the first time it is shown and then stays, so switching groups keeps its state.
  const opened = React.useRef({});
  opened.current[isGame ? "game" : "general"] = true;
  const updates = useGameUpdates(gameId);
  const category =
    categories.find((item) => item.id === categoryId) || categories[0];
  const page = pages.find((item) => item.id === pageId) || pages[0];
  const notify = React.useCallback(
    (type, message) => setToast({ type, message }),
    [],
  );
  React.useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast]);
  React.useEffect(() => {
    const handle = (event) => {
      const { category: nextCategory, section } = event.detail || {};
      if (nextCategory) setCategoryId(nextCategory);
      if (section) setPageId(section);
    };
    window.addEventListener("qaqm:settings-section", handle);
    return () => window.removeEventListener("qaqm:settings-section", handle);
  }, []);
  const current = isGame ? `game:${gameId}:${page?.id}` : `general:${category.id}`;
  React.useEffect(() => {
    pane.current?.scrollTo(0, 0);
  }, [current]);
  function open(tab) {
    if ((tab === "game-settings") === isGame) return;
    window.dispatchEvent(new CustomEvent("qaqm-navigate", { detail: { tab } }));
  }
  function choosePage(id) {
    setPageId(id);
    remember(GAME_PAGE_KEY, id);
    open("game-settings");
  }
  function chooseCategory(id) {
    setCategoryId(id);
    remember(CATEGORY_KEY, id);
    open("settings");
  }
  return (
    <div
      className={`settings-view${isGame ? " game-settings-view" : ""}`}
      data-game-id={isGame ? gameId : undefined}
    >
      <aside className="settings-nav">
        {gameId && (
          <nav
            className="settings-nav-group"
            aria-label={t("settings.game.categoryNavigation")}
          >
            <div className="settings-nav-head" title={activeGame.name}>
              <GameTile game={activeGame} />
              <span>{activeGame.name}</span>
            </div>
            <div className="settings-categories">
              {pages.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="settings-category"
                  data-section={item.id}
                  aria-current={isGame && page.id === item.id ? "page" : undefined}
                  onClick={() => choosePage(item.id)}
                >
                  <Icon name={item.icon} size={15} />
                  <span>{item.label}</span>
                  {item.id === "game-updates" && updates.count > 0 && (
                    <span
                      className="settings-category-count"
                      title={t("games.updates.availableCount", {
                        count: updates.count,
                      })}
                    >
                      {updates.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </nav>
        )}
        <nav
          className="settings-nav-group"
          aria-label={t("settings.about.categoryNavigation")}
        >
          <div className="settings-nav-head">{t("settings.scope.general")}</div>
          <div className="settings-categories">
            {categories.map((item) => (
              <button
                key={item.id}
                type="button"
                className="settings-category"
                data-category={item.id}
                aria-current={!isGame && category.id === item.id ? "page" : undefined}
                disabled={generalBusy}
                onClick={() => chooseCategory(item.id)}
              >
                <Icon name={item.icon} size={15} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </nav>
      </aside>
      <div className="system-settings-pane" ref={pane}>
        {opened.current.game && (
          <div className="settings-content" hidden={!isGame}>
            {gameId ? (
              <GameSettingsPanel
                key={gameId}
                gameId={gameId}
                page={page.id}
                active={isGame}
                updates={updates}
                notify={notify}
              />
            ) : (
              <div className="settings-state">{t("settings.game.chooseFirst")}</div>
            )}
          </div>
        )}
        {opened.current.general && (
          <div className="settings-content" hidden={isGame}>
            <GeneralSettings
              category={category}
              active={!isGame}
              devMode={devMode}
              games={games}
              allGames={allGames}
              notify={notify}
              onBusyChange={setGeneralBusy}
            />
          </div>
        )}
      </div>
      {toast && (
        <div
          className={`toast toast-${toast.type}`}
          role={toast.type === "error" ? "alert" : "status"}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
export { SettingsView as default };
