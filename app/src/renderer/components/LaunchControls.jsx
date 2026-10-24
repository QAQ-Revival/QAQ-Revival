import { t } from "../../shared/i18n/index.mjs";
import React from "react";

function LaunchIcon({ kind }) {
  const paths = {
    direct: "m9 5 10 7-10 7V5Z",
    xxmi: "M9 7V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-3M4 9h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1Z",
    official: "M14 3h7v7m0-7L11 13M10 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5",
    settings: "M21 7h-7M10 7H3M21 17h-3M14 17H3M10 4v6M18 14v6",
    loading: "M21 12a9 9 0 1 1-9-9",
  };
  return (
    <svg
      className={`launch-icon${kind === "loading" ? " launch-icon-loading" : ""}`}
      viewBox="0 0 24 24"
      fill={kind === "direct" ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[kind]} />
    </svg>
  );
}

function LaunchControls({
  activeGame,
  collapsed,
  settingsActive,
  onOpenSettings,
}) {
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
  return (
    <div
      className={`launch-actions ${collapsed ? "launch-actions-collapsed" : "launch-control-card"}`}
    >
      <button
        type="button"
        className="btn btn-primary launch-button launch-button-direct"
        aria-label={t(activeGame?.id === "arknights" ? "arknights.launchExperimental" : "games.launch.direct")}
        title={
          wuwaDx12 ? t("games.launch.dx12Hint") : t("games.launch.directHint")
        }
        disabled={!!launching || !activeGame?.id}
        onClick={() => launch("DIRECT")}
      >
        <LaunchIcon kind={launching === "DIRECT" ? "loading" : "direct"} />
        {!collapsed && (
          <span className="launch-button-label">
            {launching === "DIRECT"
              ? t("games.launch.launching")
              : wuwaDx12
                ? t("games.launch.directDx12")
                : t(activeGame?.id === "arknights" ? "arknights.launchExperimental" : "games.launch.direct")}
          </span>
        )}
      </button>
      {activeGame?.id !== "arknights" && <button
        type="button"
        className="btn btn-secondary launch-button"
        aria-label={t("games.launch.xxmi")}
        title={
          supportsXxmi ? t("games.launch.xxmiHint") : t("games.launch.nteHint")
        }
        disabled={!!launching || !activeGame?.id || !supportsXxmi}
        onClick={() => launch("XXMI")}
      >
        <LaunchIcon kind={launching === "XXMI" ? "loading" : "xxmi"} />
        {!collapsed && (
          <span className="launch-button-label">
            {launching === "XXMI"
              ? t("games.launch.launching")
              : t("games.launch.xxmiCompact")}
          </span>
        )}
      </button>}
      <button
        type="button"
        className="btn btn-secondary launch-button"
        aria-label={t("games.launch.official")}
        title={t("games.launch.officialHint")}
        disabled={!!launching || !activeGame?.id}
        onClick={() => launch("OFFICIAL")}
      >
        <LaunchIcon kind={launching === "OFFICIAL" ? "loading" : "official"} />
        {!collapsed && (
          <span className="launch-button-label">
            {launching === "OFFICIAL"
              ? t("games.launch.launching")
              : t("games.launch.officialCompact")}
          </span>
        )}
      </button>
      <button
        type="button"
        className={`game-settings-button${settingsActive ? " active" : ""}`}
        aria-label={t("navigation.gameSettings")}
        aria-current={settingsActive ? "page" : undefined}
        title={
          activeGame
            ? t("games.settingsLabel", {
                name: activeGame.name,
              })
            : t("navigation.gameSettings")
        }
        disabled={!activeGame?.id}
        onClick={onOpenSettings}
      >
        <LaunchIcon kind="settings" />
        {!collapsed && t("navigation.gameSettings")}
      </button>
      {error && (
        <div role="alert" className="launch-error" title={error}>
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="launch-notice" title={notice}>
          {notice}
        </div>
      )}
    </div>
  );
}
export { LaunchControls };
