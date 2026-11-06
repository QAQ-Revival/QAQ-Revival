import React from "react";
import { t } from "../../../shared/i18n/index.mjs";
import { Button, Row, Switch, check } from "../settings/SettingsControls.jsx";

// Loader switches applied when QAQR starts the game; copy lives under arknights.<name>.
const OPTIONS = {
  window: { status: () => window.api.arknightsWindowStatus(), save: (payload) => window.api.arknightsSetResizableWindow(payload) },
  mouse: { status: () => window.api.arknightsMouseStatus(), save: (payload) => window.api.arknightsSetMouseCoalescing(payload) },
};

export function ArknightsLaunchOption({ name, notify }) {
  const option = OPTIONS[name];
  const [state, setState] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const request = React.useRef(0);
  const operation = React.useRef(false);
  const mounted = React.useRef(true);

  const refresh = React.useCallback(async () => {
    if (operation.current) return;
    const ticket = ++request.current;
    setLoading(true);
    setError("");
    try {
      const result = await option.status();
      check(result);
      if (mounted.current && ticket === request.current) setState(result);
    } catch (failure) {
      if (mounted.current && ticket === request.current) {
        setState(null);
        setError(failure.message);
      }
    } finally {
      if (mounted.current && ticket === request.current) setLoading(false);
    }
  }, [option]);

  React.useEffect(() => {
    mounted.current = true;
    refresh();
    window.addEventListener("focus", refresh);
    return () => {
      mounted.current = false;
      ++request.current;
      window.removeEventListener("focus", refresh);
    };
  }, [refresh]);

  async function toggle(enabled) {
    if (operation.current || !state || state.gameRunning) return;
    operation.current = true;
    ++request.current;
    setLoading(false);
    setSaving(true);
    setError("");
    try {
      const result = await option.save({ enabled, gamePath: state.gamePath });
      check(result);
      if (mounted.current) {
        setState(result);
        notify("success", t(`arknights.${name}.${enabled ? "enabled" : "disabled"}`));
      }
    } catch (failure) {
      if (mounted.current) {
        setError(failure.message);
        notify("error", failure.message);
      }
    } finally {
      operation.current = false;
      if (mounted.current) {
        setSaving(false);
        await refresh();
      }
    }
  }

  return (
    <Row title={t(`arknights.${name}.label`)} description={t(`arknights.${name}.hint`)} details={
      <>
        {loading && <p role="status">{t("arknights.launchOption.checking")}</p>}
        {!loading && state?.gameRunning && <p className="settings-warning-text" role="status">{t(`arknights.${name}.gameRunning`)}</p>}
        {!loading && state && !state.supported && <p className="settings-warning-text" role="status">{t(`arknights.${name}.unsupported`)}</p>}
        {error && <p className="settings-error" role="alert">{error}</p>}
      </>
    }>
      <Button ghost={true} small={true} disabled={loading || saving} onClick={refresh}>{t("arknights.launchOption.refresh")}</Button>
      <Switch label={t(`arknights.${name}.label`)} checked={state?.enabled === true} disabled={loading || saving || !state || (!state.supported && !state.enabled) || state.gameRunning} onChange={toggle} />
    </Row>
  );
}
