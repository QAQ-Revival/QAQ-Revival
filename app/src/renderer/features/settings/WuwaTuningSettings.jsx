import { t } from "../../../shared/i18n/index.mjs";
import React from "react";
import { Button, Section, Row, check } from "./SettingsControls.jsx";
function WuwaTuningSettings() {
  const [data, setData] = React.useState(null);
  const [selected, setSelected] = React.useState("");
  const [error, setError] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const alive = React.useRef(true);
  async function load() {
    setBusy(true);
    setError("");
    try {
      const result = check(await window.api.wuwaGetTuning());
      if (alive.current) {
        setData(result);
        setSelected(result.preset);
      }
    } catch (e) {
      if (alive.current) setError(e.message);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  React.useEffect(() => {
    alive.current = true;
    load();
    return () => {
      alive.current = false;
    };
  }, []);
  async function act(action) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await action();
      if (result?.canceled) return;
      check(result);
      if (alive.current) {
        setData(result);
        setSelected(result.preset);
        setMessage(result.message);
      }
    } catch (e) {
      if (alive.current) setError(e.message);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  const current =
    data?.presets.find((preset) => preset.id === data.preset)?.name ||
    (data?.preset === "device-profile"
      ? t("settings.wuwaTuning.importedProfiles")
      : t("settings.wuwaTuning.customConfiguration"));
  return (
    <Section id="wuwa-tuning" title={t("settings.wuwaTuning.title")}>
      <Row
        title={t("settings.wuwaTuning.plan")}
        description={t("settings.wuwaTuning.description")}
        stacked={true}
      >
        {data && (
          <div
            className="wuwa-tuning-options"
            role="group"
            aria-label={t("settings.wuwaTuning.planLabel")}
          >
            {data.presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="system-choice"
                data-wuwa-preset={preset.id}
                aria-pressed={selected === preset.id}
                disabled={busy}
                onClick={() => setSelected(preset.id)}
              >
                <strong>{preset.name}</strong>
                <span>{preset.description}</span>
              </button>
            ))}
          </div>
        )}
      </Row>
      {data && (
        <p className="system-notice">
          {t("settings.wuwaTuning.currentParameters", {
            current,
            launcherFov: data.values.launcherFov,
            hidden: data.values.hidden ?? t("settings.wuwaTuning.unconfigured"),
          })}
        </p>
      )}
      <div className="wuwa-tuning-actions">
        <Button
          primary={true}
          disabled={
            busy || !data?.presets.some((preset) => preset.id === selected)
          }
          onClick={() =>
            act(() =>
              window.api.wuwaApplyTuning({
                preset: selected,
                revision: data.revision,
              }),
            )
          }
        >
          {busy
            ? t("common.status.processing")
            : t("settings.wuwaTuning.backupAndApply")}
        </Button>
        <Button
          disabled={busy || !data?.canRestore}
          onClick={() =>
            act(() =>
              window.api.wuwaRestoreTuning({
                revision: data.revision,
              }),
            )
          }
        >
          {t("settings.wuwaTuning.restorePrevious")}
        </Button>
        <Button disabled={busy} onClick={load}>
          {t("settings.wuwaTuning.reload")}
        </Button>
      </div>
      <Row
        title={t("settings.wuwaTuning.profilesPlan")}
        description={t("settings.wuwaTuning.profilesDescription")}
        stacked={true}
      >
        <Button
          disabled={busy || !data}
          onClick={() =>
            act(() =>
              window.api.wuwaImportDeviceProfile({
                revision: data.revision,
              }),
            )
          }
        >
          {t("settings.wuwaTuning.selectAndApply")}
        </Button>
      </Row>
      {error && (
        <p className="system-notice" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="system-notice" role="status">
          {message}
        </p>
      )}
      <p className="system-notice">{t("settings.wuwaTuning.restartHint")}</p>
    </Section>
  );
}
export { WuwaTuningSettings };
