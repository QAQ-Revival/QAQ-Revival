import { t } from "../../../shared/i18n/index.mjs";
import React from "react";
import { Button, Section, Row, check } from "./SettingsControls.jsx";
const h = React.createElement;
const sourceLabel = (item) =>
  item?.source === "user"
    ? t("settings.wuwaDx12.userSource")
    : item?.source === "managed"
      ? t("settings.wuwaDx12.bundledSource", {
          status: item.active
            ? t("common.status.enabled")
            : t("common.status.disabled"),
        })
      : t("settings.wuwaDx12.missingSource");
function WuwaDx12Settings() {
  const [data, setData] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const alive = React.useRef(true),
    inFlight = React.useRef(false);
  async function load() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const result = check(await window.api.wuwaDx12Status());
      if (alive.current) setData(result);
    } catch (e) {
      if (alive.current) setError(e.message);
    } finally {
      inFlight.current = false;
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
  const toggle = (enabled) =>
    act(() => window.api.wuwaDx12SetEnabled(enabled), enabled);
  async function act(action, enabled) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const result = check(await action());
      if (alive.current)
        setData((previous) =>
          result.paths
            ? result
            : {
                ...previous,
                enabled: enabled ?? previous.enabled,
              },
        );
    } catch (e) {
      if (alive.current) setError(e.message);
    } finally {
      try {
        const result = check(await window.api.wuwaDx12Status());
        if (alive.current) setData(result);
      } catch (e) {
        if (alive.current) setError(e.message);
      }
      inFlight.current = false;
      if (alive.current) setBusy(false);
    }
  }
  const open = (url) => window.api.openExternalUrl(url);
  return (
    <Section id="wuwa-dx12" title={t("settings.wuwaDx12.title")}>
      <Row
        title={t("settings.wuwaDx12.toggle")}
        description={t("settings.wuwaDx12.description")}
      >
        <input
          type="checkbox"
          role="switch"
          className="system-switch"
          aria-label={t("settings.wuwaDx12.toggleLabel")}
          checked={!!data?.enabled}
          disabled={busy || !data}
          onChange={(e) => toggle(e.target.checked)}
        />
      </Row>
      {h(
        Row,
        {
          title: t("settings.wuwaDx12.componentSource"),
          description: t("settings.wuwaDx12.componentSourceHint"),
          stacked: true,
        },
        ...[
          ["reshade", "ReShade"],
          ["addon", "wwmi-dx12"],
        ].map(([key, name]) => (
          <div
            key={key}
            className="wuwa-dx12-component"
            data-dx12-component={key}
          >
            <div>
              <strong>{name}</strong>
              <span
                className={`wuwa-dx12-source ${data?.sources[key]?.source || "missing"}`}
              >
                {sourceLabel(data?.sources[key])}
              </span>
            </div>
            <p>
              {data?.sources[key]?.source === "user"
                ? t("settings.wuwaDx12.userComponentHint")
                : t("settings.wuwaDx12.bundledVersionHint", {
                    version:
                      data?.sources[key]?.version ||
                      (key === "reshade" ? "6.8.0" : "2026.10.3"),
                  })}
            </p>
            <div className="wuwa-dx12-update">
              <span>
                {t("settings.wuwaDx12.componentVersion", {
                  bundledVersion:
                    data?.updates?.components[key]?.bundledVersion ||
                    t("settings.wuwaDx12.awaitingCheck"),
                  status: data?.updates?.components[key]?.availableVersion
                    ? t("settings.wuwaDx12.officialVersionSuffix", {
                        availableVersion:
                          data.updates.components[key].availableVersion,
                      })
                    : t("settings.wuwaDx12.uncheckedSuffix"),
                })}
              </span>
              <Button
                disabled={
                  busy || !data?.updates?.components[key]?.updateAvailable
                }
                aria-label={t("settings.wuwaDx12.updateNamedComponent", {
                  name,
                })}
                onClick={() =>
                  act(() => window.api.wuwaDx12UpdateComponent(key))
                }
              >
                {t("settings.wuwaDx12.updateComponent")}
              </Button>
            </div>
            {data?.updates?.errors[key] && (
              <p role="status">{data.updates.errors[key]}</p>
            )}
          </div>
        )),
      )}
      {data && (
        <div className="wuwa-dx12-checks" role="status">
          <strong>
            {!data.enabled
              ? t("settings.wuwaDx12.disabledHint")
              : data.ready
                ? t("settings.wuwaDx12.ready")
                : t("settings.wuwaDx12.needsCheck")}
          </strong>
          {data.checks.map((item) => (
            <div key={item.id} className={item.ok ? "ready" : "missing"}>
              <span aria-hidden={true}>{item.ok ? "✓ " : "· "}</span>
              {`${item.title}：${item.ok && ["wwmi", "addon"].includes(item.id) ? t("settings.steam.detected") : item.message}`}
            </div>
          ))}
        </div>
      )}
      <div className="wuwa-tuning-actions">
        <Button disabled={busy || !data?.enabled} onClick={() => toggle(true)}>
          {t("settings.wuwaDx12.installMissing")}
        </Button>
        <Button
          disabled={busy || !data}
          onClick={() => act(() => window.api.wuwaDx12CheckUpdates())}
        >
          {t("settings.wuwaDx12.checkUpdates")}
        </Button>
        <Button disabled={busy} onClick={load}>
          {t("settings.wuwaDx12.detectAgain")}
        </Button>
        <Button
          disabled={busy || !data?.paths.win64}
          onClick={() => window.api.openPathInExplorer(data.paths.win64)}
        >
          {t("settings.wuwaDx12.openGameDirectory")}
        </Button>
        <Button
          onClick={() => open("https://github.com/lekarsenten/wwmi-dx12")}
        >
          {t("settings.wuwaDx12.projectInfo")}
        </Button>
        <Button onClick={() => open("https://reshade.me/")}>
          {t("settings.wuwaDx12.reshadeWebsite")}
        </Button>
      </div>
      {busy && (
        <p className="system-notice" role="status">
          {t("settings.wuwaDx12.processing")}
        </p>
      )}
      {data?.updates?.errors.storage && (
        <p className="system-notice" role="alert">
          {data.updates.errors.storage}
        </p>
      )}
      {error && (
        <p
          className="system-notice wuwa-dx12-settings-system-notice-layout"
          role="alert"
        >
          {error}
        </p>
      )}
    </Section>
  );
}
export { WuwaDx12Settings };
