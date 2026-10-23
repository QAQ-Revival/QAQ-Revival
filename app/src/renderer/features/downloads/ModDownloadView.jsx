import { t } from "../../../shared/i18n/index.mjs";
import React from "react";
import ReactDOM from "react-dom";
import PawchiveView from "./PawchiveView.jsx";
import ModMarketView from "../market/ModMarketView.jsx";
import ModSiteView from "./ModSiteView.jsx";
const h = React.createElement;
function getSources() {
  return [
    ["qaqm", "QAQM"],
    ["kemono", "Kemono"],
    ["pawchive", "Pawchive"],
    ["gamebanana", t("downloads.sources.gamebanana")],
    ["arca", t("downloads.sources.arca")],
    ["loverslab", "LoversLab"],
    ["huiyue", t("downloads.sources.hui")],
    ["keke", t("downloads.sources.cocoa")],
  ];
}
function rememberedSource() {
  try {
    const saved = localStorage.getItem("qaqm.downloadSource");
    if (getSources().some(([id]) => id === saved)) return saved;
  } catch {
    /* Storage is optional. */
  }
  return "qaqm";
}
function SourceSelector({ value, onChange, isActive }) {
  const [open, setOpen] = React.useState(false);
  const [position, setPosition] = React.useState({});
  const trigger = React.useRef(null);
  const menu = React.useRef(null);
  const menuId = React.useId();
  function close(focus = false) {
    setOpen(false);
    if (focus)
      trigger.current?.focus({
        preventScroll: true,
      });
  }
  React.useEffect(() => {
    if (!isActive) close();
  }, [isActive]);
  React.useLayoutEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const rect = trigger.current.getBoundingClientRect();
      const width = Math.min(Math.max(rect.width, 224), window.innerWidth - 24);
      setPosition({
        left: Math.max(
          12,
          Math.min(rect.right - width, window.innerWidth - width - 12),
        ),
        top: rect.bottom + 8,
        width,
        maxHeight: Math.max(80, window.innerHeight - rect.bottom - 20),
      });
    };
    updatePosition();
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
    const reposition = (event) => {
      if (!menu.current?.contains(event.target)) updatePosition();
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    document.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    menu.current?.querySelector('[aria-checked="true"]')?.focus({
      preventScroll: true,
    });
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
      document.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open]);
  function navigate(event) {
    const items = Array.from(
      menu.current.querySelectorAll('[role="menuitemradio"]'),
    );
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
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      items[index]?.click();
    }
    if (event.key === "Tab") {
      // Restore the trigger first so native Tab continues in the page's tab order.
      close(true);
    }
  }
  return (
    <div className="mod-download-source">
      <span>{t("downloads.sources.content")}</span>
      <button
        ref={trigger}
        type="button"
        className="mod-download-source-trigger"
        aria-label={t("downloads.sources.title")}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => {
          if (["ArrowDown", "ArrowUp"].includes(event.key)) {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <strong className="mod-download-source-name">
          {getSources().find(([id]) => id === value)?.[1]}
        </strong>
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
      </button>
      {open &&
        ReactDOM.createPortal(
          <div
            ref={menu}
            id={menuId}
            className="mod-download-source-menu"
            role="menu"
            aria-label={t("downloads.sources.title")}
            style={position}
            onKeyDown={navigate}
          >
            {getSources().map(([id, label]) => (
              <button
                key={id}
                type="button"
                className="mod-download-source-option"
                role="menuitemradio"
                aria-checked={value === id}
                data-source={id}
                onClick={() => {
                  onChange(id);
                  close(true);
                }}
              >
                <strong className="mod-download-source-name">{label}</strong>
                <span className="game-selector-check" aria-hidden={true}>
                  {value === id ? "✓" : ""}
                </span>
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
function ModDownloadView({
  isActive = true,
  marketKey,
  onQaqmActiveChange,
  ...marketProps
}) {
  const [source, setSource] = React.useState(rememberedSource);
  const [visited, setVisited] = React.useState(() => new Set([source]));
  const current = marketProps.pendingDetailMod ? "qaqm" : source;
  React.useEffect(() => {
    onQaqmActiveChange?.(isActive && current === "qaqm");
    return () => onQaqmActiveChange?.(false);
  }, [isActive, current, onQaqmActiveChange]);
  function selectSource(value) {
    setSource(value);
    setVisited((items) => new Set([...items, value]));
    try {
      localStorage.setItem("qaqm.downloadSource", value);
    } catch {
      /* Keep the session selection. */
    }
  }
  React.useEffect(() => {
    if (marketProps.pendingDetailMod) selectSource("qaqm");
  }, [marketProps.pendingDetailMod]);
  return h(
    "section",
    {
      className: "mod-download-view",
      "aria-label": t("navigation.modDownloads"),
    },
    <header className="mod-download-header">
      <div>
        <h1>
          <span className="mod-download-icon" aria-hidden={true}>
            {"↓"}
          </span>
          {t("navigation.modDownloads")}
        </h1>
        <p>{t("downloads.sources.description")}</p>
      </div>
      <SourceSelector
        value={current}
        onChange={selectSource}
        isActive={isActive}
      />
    </header>,
    ...getSources()
      .filter(([id]) => visited.has(id) || id === current)
      .map(([id]) => (
        <div
          key={id}
          className="mod-download-provider"
          hidden={current !== id}
          data-source={id}
        >
          {id === "qaqm" ? (
            <ModMarketView
              {...marketProps}
              key={marketKey}
              isActive={isActive && current === id}
            />
          ) : ["kemono", "pawchive"].includes(id) ? (
            <PawchiveView source={id} isActive={isActive && current === id} />
          ) : (
            <ModSiteView
              key={`${id}:${marketProps.activeGameId}`}
              source={id}
              gameId={marketProps.activeGameId}
              isActive={isActive && current === id}
            />
          )}
        </div>
      )),
  );
}
export { ModDownloadView as default };
