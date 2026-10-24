import { t } from "../../shared/i18n/index.mjs";
import React from "react";
import ReactDOM from "react-dom";
import { useGameOrder } from "../hooks/useGameOrder.js";
import { GAME_MENU_WIDTH } from "../lib/sidebarLayout.js";
function GameSelector({ games = [], activeGame, collapsed, onSwitch }) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [position, setPosition] = React.useState({});
  const trigger = React.useRef(null);
  const menu = React.useRef(null);
  const switching = React.useRef(false);
  const sorting = useGameOrder(games, open && !busy);
  const close = (focus = false) => {
    setOpen(false);
    if (focus) trigger.current?.focus();
  };
  React.useEffect(() => {
    if (!open) return;
    const rect = trigger.current.getBoundingClientRect();
    const width = Math.min(GAME_MENU_WIDTH, window.innerWidth - 24);
    setPosition({
      left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
      top: rect.bottom + 8,
      width,
      maxHeight: Math.max(120, window.innerHeight - rect.bottom - 24),
    });
    const dismiss = (event) => {
      if (
        !trigger.current?.contains(event.target) &&
        !menu.current?.contains(event.target)
      )
        close();
    };
    const escape = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close(true);
      }
    };
    const resize = () => close();
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    window.addEventListener("resize", resize);
    const frame = requestAnimationFrame(() =>
      menu.current
        ?.querySelector('[aria-checked="true"], [role="menuitemradio"]')
        ?.focus(),
    );
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(frame);
    };
  }, [open]);
  React.useEffect(() => {
    setOpen(false);
  }, [collapsed]);
  async function select(game) {
    if (switching.current) return;
    if (game.id === activeGame?.id) {
      close(true);
      return;
    }
    switching.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await window.api.gameSwitch(game.id);
      if (!result?.success)
        throw new Error(result?.error || t("navigation.switchGameFailed"));
      await onSwitch?.(game.id);
      close(true);
    } catch (err) {
      setError(err.message || t("navigation.switchGameRetry"));
    } finally {
      switching.current = false;
      setBusy(false);
    }
  }
  function navigate(event) {
    if (event.defaultPrevented) return;
    const items = Array.from(
      menu.current.querySelectorAll('[role="menuitemradio"]:not(:disabled)'),
    );
    if (!items.length) return;
    const index = items.indexOf(document.activeElement);
    let next;
    if (event.key === "ArrowDown") next = (index + 1) % items.length;
    if (event.key === "ArrowUp")
      next = (index - 1 + items.length) % items.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = items.length - 1;
    if (next !== undefined) {
      event.preventDefault();
      items[next].focus();
    }
    if (event.key === "Tab") close();
  }
  return (
    <div className="sidebar-game-selector">
      <button
        ref={trigger}
        type="button"
        className="game-selector-trigger"
        disabled={busy}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? "sidebar-game-menu" : undefined}
        aria-label={t("navigation.switchGameLabel", {
          name: activeGame?.name || t("common.status.unselected"),
        })}
        title={
          collapsed ? activeGame?.name || t("navigation.switchGame") : undefined
        }
        onClick={() => {
          setError("");
          setOpen(!open);
        }}
        onKeyDown={(event) => {
          if (["ArrowDown", "ArrowUp"].includes(event.key)) {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span className="game-selector-icon" aria-hidden={true}>
          {"🎮"}
        </span>
        {!collapsed && (
          <span className="game-selector-copy">
            <span className="game-selector-label">
              {t("navigation.currentGame")}
            </span>
            <strong>
              {busy
                ? t("navigation.switchingGame")
                : activeGame?.name || t("navigation.chooseGame")}
            </strong>
          </span>
        )}
        {!collapsed && (
          <span className="game-selector-chevron" aria-hidden={true}>
            <svg
              viewBox="0 0 24 24"
              width={18}
              height={18}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              focusable="false"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
        )}
      </button>
      {error && !open && (
        <div role="alert" className="game-selector-error">
          {error}
        </div>
      )}
      {open &&
        ReactDOM.createPortal(
          <div
            ref={menu}
            id="sidebar-game-menu"
            className="game-selector-menu"
            role="menu"
            aria-label={t("navigation.switchGame")}
            aria-busy={busy}
            style={position}
            onKeyDown={navigate}
          >
            {sorting.items.map((game) => (
              <button
                {...sorting.itemProps(game.id)}
                type="button"
                className="game-selector-option"
                role="menuitemradio"
                title={t("navigation.gameSortHint", {
                  name: game.name,
                })}
                aria-checked={game.id === activeGame?.id}
                disabled={busy}
                onClick={() => select(game)}
                key={game.id}
              >
                <span className="game-selector-copy">
                  <strong>{game.name}</strong>
                  <span className="game-selector-description">
                    {game.modFolderPath
                      ? t("navigation.modsConfigured")
                      : t("navigation.independentGameSettings")}
                  </span>
                </span>
                <span className="game-selector-check" aria-hidden={true}>
                  {game.id === activeGame?.id ? "✓" : ""}
                </span>
                <span className="sort-grip" aria-hidden={true} />
              </button>
            ))}
            <div className="sort-announcement" role="status">
              {sorting.announcement}
            </div>
            {sorting.error && (
              <div role="alert" className="game-selector-error">
                {sorting.error}
              </div>
            )}
            {!sorting.items.length && (
              <div className="game-selector-error">
                {t("navigation.noGames")}
              </div>
            )}
            {error && (
              <div role="alert" className="game-selector-error">
                {error}
              </div>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
export { GameSelector };
