import React from "react";
import { t } from "../../shared/i18n/index.mjs";

export function useGameUpdates(gameId) {
  const [state, setState] = React.useState(null);
  const [error, setError] = React.useState("");
  const current = React.useRef(gameId);
  current.current = gameId;
  const check = React.useCallback(
    async (manual = false) => {
      if (!gameId) return;
      try {
        const result = await window.api.gameUpdateCheck({ gameId, manual });
        if (!result?.success)
          throw Error(result?.error || t("games.updates.failed"));
        if (current.current === gameId) {
          setState(result);
          setError("");
        }
        return result;
      } catch (failure) {
        if (current.current === gameId) setError(failure.message);
      }
    },
    [gameId],
  );
  React.useEffect(() => {
    setState(null);
    setError("");
    if (!gameId) return;
    let canceled = false;
    const off = window.api.onGameUpdatesChanged((value) => {
      if (value.gameId === gameId) setState(value);
    });
    window.api
      .gameUpdateState(gameId)
      .then((value) => {
        if (!canceled && value.success) setState(value);
      })
      .catch(() => {});
    check();
    const timer = setInterval(() => check(), 10 * 60 * 1000);
    return () => {
      canceled = true;
      off();
      clearInterval(timer);
    };
  }, [gameId, check]);
  async function configure(patch) {
    try {
      const result = await window.api.gameUpdateConfigure({
        gameId,
        enabled: state?.enabled !== false,
        region: state?.region || "auto",
        ...patch,
      });
      if (!result?.success)
        throw Error(result?.error || t("games.updates.failed"));
      if (current.current === gameId) setState(result);
      if (result.enabled) await check();
    } catch (failure) {
      if (current.current === gameId) setError(failure.message);
    }
  }
  const clientCount = state?.client?.updateAvailable ? 1 : 0;
  const componentCount = (state?.components || []).filter(
    (item) => item.installed && item.updateAvailable,
  ).length;
  return { state, error, check, configure, count: clientCount + componentCount, clientCount, componentCount };
}
