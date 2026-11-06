import { t } from "../../shared/i18n/index.mjs";
import React from "react";
import { Icon } from "./Icon.jsx";
import { Menu, MenuItem } from "./Menu.jsx";

function LaunchIcon({ kind, launching }) {
  if (launching) return <span className="spinner launch-spinner" aria-hidden="true" />;
  return <Icon name={kind} size={15} />;
}

function LaunchControls({ activeGame, settingsActive, onOpenSettings }) {
  const [launching, setLaunching] = React.useState(null);
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const inFlight = React.useRef(false);
  const gameId = React.useRef(activeGame?.id);
  gameId.current = activeGame?.id;
  const supportsXxmi = !["neverness-to-everness", "arknights"].includes(activeGame?.id);
  const wuwaDx12 =
    activeGame?.id === "wuthering-waves" && activeGame.wuwaDx12Enabled === true;
  React.useEffect(() => {
    setError("");
    setNotice("");
  }, [activeGame?.id]);
  async function launch(mode) {
    if (inFlight.current) return;
    const requestedGameId = activeGame?.id;
    inFlight.current = true;
    setLaunching(mode);
    setError("");
    setNotice("");
    try {
      const result = await window.api.launchGame({
        launchMode: mode,
        gameId: requestedGameId,
      });
      if (!result?.success)
        throw new Error(result?.error || t("games.launch.checkPaths"));
      if (result.notice && gameId.current === requestedGameId)
        setNotice(result.notice);
    } catch (err) {
      if (gameId.current === requestedGameId)
        setError(err.message || t("native.startup.failed"));
    } finally {
      inFlight.current = false;
      setLaunching(null);
    }
  }
  const busy = !!launching || !activeGame?.id;
  return (
    <div className="launch-actions">
      <div className="launch-split">
        <button
          type="button"
          className="btn btn-primary launch-button launch-button-direct"
          aria-label={t("games.launch.direct")}
          title={
            wuwaDx12 ? t("games.launch.dx12Hint") : t("games.launch.directHint")
          }
          disabled={busy}
          onClick={() => launch("DIRECT")}
        >
          <LaunchIcon kind="play" launching={launching === "DIRECT"} />
          <span className="launch-button-label">
            {launching === "DIRECT"
              ? t("games.launch.launching")
              : wuwaDx12
                ? t("games.launch.directDx12")
                : t("games.launch.direct")}
          </span>
        </button>
        <Menu
          label={t("games.launch.moreOptions")}
          minWidth={260}
          trigger={({ props }) => (
            <button
              type="button"
              className="btn btn-primary launch-menu-trigger"
              aria-label={t("games.launch.moreOptions")}
              title={t("games.launch.moreOptions")}
              {...props}
            >
              <Icon name="chevron-down" size={14} />
            </button>
          )}
        >
          {activeGame?.id !== "arknights" && (
            <MenuItem
              className="launch-button"
              aria-label={t("games.launch.xxmi")}
              icon={<LaunchIcon kind="layers" launching={launching === "XXMI"} />}
              hint={
                supportsXxmi ? t("games.launch.xxmiHint") : t("games.launch.nteHint")
              }
              disabled={busy || !supportsXxmi}
              onClick={() => launch("XXMI")}
            >
              {launching === "XXMI"
                ? t("games.launch.launching")
                : t("games.launch.xxmiCompact")}
            </MenuItem>
          )}
          <MenuItem
            className="launch-button"
            aria-label={t("games.launch.official")}
            icon={<LaunchIcon kind="external" launching={launching === "OFFICIAL"} />}
            hint={t("games.launch.officialHint")}
            disabled={busy}
            onClick={() => launch("OFFICIAL")}
          >
            {launching === "OFFICIAL"
              ? t("games.launch.launching")
              : t("games.launch.officialCompact")}
          </MenuItem>
          <div className="menu-sep" />
          <MenuItem
            className={`game-settings-button${settingsActive ? " active" : ""}`}
            aria-label={t("navigation.gameSettings")}
            aria-current={settingsActive ? "page" : void 0}
            icon={<Icon name="sliders" />}
            disabled={!activeGame?.id}
            onClick={onOpenSettings}
          >
            {activeGame
              ? t("games.settingsLabel", { name: activeGame.name })
              : t("navigation.gameSettings")}
          </MenuItem>
        </Menu>
      </div>
      {(error || notice) && (
        <div
          className={`launch-popover ${error ? "launch-error" : "launch-notice"}`}
          role={error ? "alert" : "status"}
        >
          <Icon name={error ? "alert" : "info"} size={15} />
          <span>{error || notice}</span>
          <button
            type="button"
            className="icon-btn icon-btn-sm"
            aria-label={t("common.actions.close")}
            onClick={() => {
              setError("");
              setNotice("");
            }}
          >
            <Icon name="x" size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
export { LaunchControls };
