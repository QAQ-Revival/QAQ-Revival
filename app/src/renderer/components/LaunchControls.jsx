import { t } from "../../shared/i18n/index.mjs";
import React from "react";
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
  const supportsXxmi = activeGame?.id !== "neverness-to-everness";
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
      className={`launch-actions ${collapsed ? "launch-actions-collapsed" : "card launch-control-card"}`}
    >
      <button
        type="button"
        className="btn btn-primary"
        aria-label={t("games.launch.direct")}
        title={
          wuwaDx12 ? t("games.launch.dx12Hint") : t("games.launch.directHint")
        }
        disabled={!!launching || !activeGame?.id}
        onClick={() => launch("DIRECT")}
      >
        {collapsed
          ? launching === "DIRECT"
            ? "…"
            : "▶"
          : launching === "DIRECT"
            ? t("games.launch.launching")
            : wuwaDx12
              ? t("games.launch.directDx12")
              : t("games.launch.direct")}
      </button>
      <button
        type="button"
        className="btn btn-secondary"
        aria-label={t("games.launch.xxmi")}
        title={
          supportsXxmi ? t("games.launch.xxmiHint") : t("games.launch.nteHint")
        }
        disabled={!!launching || !activeGame?.id || !supportsXxmi}
        onClick={() => launch("XXMI")}
      >
        {collapsed
          ? launching === "XXMI"
            ? "…"
            : "XX"
          : launching === "XXMI"
            ? t("games.launch.launching")
            : t("games.launch.xxmi")}
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
        <span aria-hidden={true}>{"⚙"}</span>
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
