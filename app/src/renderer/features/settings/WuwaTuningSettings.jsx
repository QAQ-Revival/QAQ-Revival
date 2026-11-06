import { t } from "../../../shared/i18n/index.mjs";
import React from "react";
import { Button, Notice, Section, Row, check } from "./SettingsControls.jsx";
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
      {data && (
        <div
          className="settings-options"
          role="group"
          aria-label={t("settings.wuwaTuning.planLabel")}
        >
          {data.presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="settings-option"
              data-wuwa-preset={preset.id}
              aria-pressed={selected === preset.id}
              disabled={busy}
              onClick={() => setSelected(preset.id)}
            >
              <span className="settings-option-mark" aria-hidden={true} />
              <span className="settings-option-copy">
                <strong>{preset.name}</strong>
                <span>{preset.description}</span>
              </span>
            </button>
          ))}
        </div>
      )}
      {data && (
        <p className="settings-footnote">
          {t("settings.wuwaTuning.currentParameters", {
            current,
            launcherFov: data.values.launcherFov,
            hidden: data.values.hidden ?? t("settings.wuwaTuning.unconfigured"),
          })}
        </p>
      )}
      <div className="settings-actions">
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
        <Button ghost={true} disabled={busy} onClick={load}>
          {t("settings.wuwaTuning.reload")}
        </Button>
      </div>
      <Row
        title={t("settings.wuwaTuning.profilesPlan")}
        hint={t("settings.wuwaTuning.profilesDescription")}
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
        <Notice kind="danger" role="alert">
          {error}
        </Notice>
      )}
      {message && (
        <Notice kind="success" role="status">
          {message}
        </Notice>
      )}
      <p className="settings-footnote">{t("settings.wuwaTuning.restartHint")}</p>
    </Section>
  );
}
export { WuwaTuningSettings };
