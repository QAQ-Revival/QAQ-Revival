import React from "react";
import { t } from "../../../shared/i18n/index.mjs";
import { Button, Row, Section, Switch, check } from "../settings/SettingsControls.jsx";

export function ArknightsCursorSettings({ notify }) {
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
      const result = await window.api.arknightsCursorStatus();
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
  }, []);

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
    if (operation.current || !state?.supported || state.gameRunning) return;
    operation.current = true;
    ++request.current;
    setLoading(false);
    setSaving(true);
    setError("");
    try {
      const result = await window.api.arknightsSetSystemCursor({ enabled, gamePath: state.gamePath });
      check(result);
      if (mounted.current) {
        setState(result);
        notify("success", t(enabled ? "arknights.cursor.enabled" : "arknights.cursor.restored"));
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
    <Section id="arknights-cursor" title={t("arknights.cursor.title")}>
      <Row
        title={t("arknights.cursor.useSystem")}
        description={t("arknights.cursor.hint")}
        details={
          <React.Fragment>
            {loading && <p role="status">{t("arknights.cursor.checking")}</p>}
            {!loading && state?.gameRunning && (
              <p className="settings-warning-text" role="status">{t("arknights.cursor.gameRunning")}</p>
            )}
            {!loading && state?.mode === "unsupported" && (
              <p className="settings-warning-text" role="status">{t("arknights.cursor.unsupported")}</p>
            )}
            {!loading && state?.mode === "missing" && (
              <p className="settings-warning-text" role="status">{t("arknights.cursor.missing")}</p>
            )}
            {error && (
              <p className="settings-error" role="alert">
                {error}
              </p>
            )}
          </React.Fragment>
        }
      >
        <Button ghost={true} small={true} disabled={loading || saving} onClick={refresh}>
          {t("arknights.cursor.refresh")}
        </Button>
        <Switch
          label={t("arknights.cursor.useSystem")}
          checked={state?.enabled === true}
          disabled={loading || saving || !state?.supported || state.gameRunning}
          onChange={toggle}
        />
      </Row>
    </Section>
  );
}
