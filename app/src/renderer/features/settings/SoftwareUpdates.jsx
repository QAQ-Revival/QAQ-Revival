import { t } from "../../../shared/i18n/index.mjs";
import React from "react";
import { Icon } from "../../components/Icon.jsx";
import { Button, Row, Section, Switch } from "./SettingsControls.jsx";
function useUpdateState() {
  const [state, setState] = React.useState(null),
    [error, setError] = React.useState("");
  React.useEffect(() => {
    let current = true;
    window.api
      .softwareUpdateState()
      .then((result) => {
        if (!current) return;
        if (result.success) setState(result.state);
        else setError(result.error);
      })
      .catch((error) => {
        if (current) setError(error.message);
      });
    const off = window.api.onSoftwareUpdateState((next) => {
      if (current) setState(next);
    });
    return () => {
      current = false;
      off?.();
    };
  }, []);
  return {
    state,
    setState,
    error,
    setError,
  };
}
function SoftwareUpdateSettings() {
  const { state, setState, error, setError } = useUpdateState();
  const [busy, setBusy] = React.useState(false),
    [days, setDays] = React.useState("1");
  React.useEffect(() => {
    if (state) setDays(String(state.intervalDays));
  }, [state?.intervalDays]);
  const validDays =
    /^\d+$/.test(days) && Number(days) >= 1 && Number(days) <= 365;
  async function request(method, value) {
    setBusy(true);
    setError("");
    try {
      const result = await window.api[method](value);
      if (!result?.success)
        throw Error(result?.error || t("settings.updates.failed"));
      setState(result.state);
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  const configure = (enabled) =>
    request("softwareUpdateConfigure", {
      enabled,
      intervalDays: Number(days),
    });
  function saveDays() {
    if (state && validDays && Number(days) !== state.intervalDays && !busy)
      configure(state.enabled);
  }
  return (
    <Section id="software-update" title={t("settings.updates.title")}>
      {!state ? (
        <div className="settings-state" role={error ? "alert" : "status"}>
          {error || t("settings.updates.loading")}
        </div>
      ) : (
        <React.Fragment>
          <Row
            title={
              <span className="software-update-summary" role="status">
                {state.checking
                  ? t("settings.updates.checkingGitHub")
                  : state.updateAvailable
                    ? t("settings.updates.available", {
                        version: state.release.version,
                        currentVersion: state.currentVersion,
                      })
                    : state.noRelease
                      ? t("settings.updates.noReleases")
                      : state.lastCheckedAt
                        ? t("settings.updates.currentVersion", {
                            currentVersion: state.currentVersion,
                          })
                        : t("settings.updates.uncheckedVersion", {
                            currentVersion: state.currentVersion,
                          })}
              </span>
            }
            description={
              state.lastCheckedAt
                ? t("settings.updates.lastChecked", {
                    value: new Date(state.lastCheckedAt).toLocaleString(
                      "zh-CN",
                    ),
                  })
                : ""
            }
            details={
              (error || state.error) && (
                <p className="settings-error" role="alert">
                  {error || state.error}
                </p>
              )
            }
          >
            {state.release && (
              <Button onClick={() => request("softwareUpdateOpenRelease")}>
                {t("settings.updates.openRelease")}
              </Button>
            )}
            <Button
              primary={true}
              disabled={busy || state.checking}
              onClick={() => request("softwareUpdateCheck")}
            >
              {state.checking
                ? t("settings.updates.checking")
                : t("settings.updates.checkNow")}
            </Button>
          </Row>
          <Row
            title={t("settings.updates.automatic")}
            hint={t("settings.updates.automaticDescription")}
          >
            <Switch
              label={t("settings.updates.automaticLabel")}
              checked={state.enabled}
              disabled={busy}
              onChange={(value) =>
                request("softwareUpdateConfigure", {
                  enabled: value,
                  intervalDays: state.intervalDays,
                })
              }
            />
          </Row>
          <Row
            title={t("settings.updates.frequency")}
            details={
              !validDays && (
                <p className="settings-error" role="alert">
                  {t("settings.updates.intervalInvalid")}
                </p>
              )
            }
          >
            <label className="software-update-frequency">
              {t("settings.updates.everyPrefix")}
              <input
                type="text"
                inputMode="numeric"
                className="input"
                aria-label={t("settings.updates.intervalLabel")}
                aria-invalid={!validDays}
                value={days}
                disabled={busy || !state.enabled}
                onChange={(event) => setDays(event.target.value)}
                onBlur={saveDays}
                onKeyDown={(event) => {
                  if (event.key === "Enter") saveDays();
                  if (event.key === "Escape")
                    setDays(String(state.intervalDays));
                }}
              />
              {t("settings.updates.daysSuffix")}
            </label>
          </Row>
        </React.Fragment>
      )}
    </Section>
  );
}
function SoftwareUpdateNotice() {
  const { state, setState } = useUpdateState();
  if (
    !state?.updateAvailable ||
    state.release.version === state.dismissedVersion
  )
    return null;
  return (
    <div className="software-update-notice" role="status">
      <span className="software-update-notice-text">
        {t("settings.updates.notice", {
          version: state.release.version,
        })}
      </span>
      <button
        type="button"
        className="btn btn-sm"
        onClick={() => window.api.softwareUpdateOpenRelease()}
      >
        {t("settings.updates.viewUpdate")}
      </button>
      <button
        type="button"
        className="icon-btn icon-btn-sm"
        title={t("settings.updates.dismissVersion")}
        aria-label={t("settings.updates.dismissVersion")}
        onClick={async () => {
          const result = await window.api.softwareUpdateDismiss(
            state.release.version,
          );
          if (result.success) setState(result.state);
        }}
      >
        <Icon name="x" size={14} />
      </button>
    </div>
  );
}
export { SoftwareUpdateSettings, SoftwareUpdateNotice };
