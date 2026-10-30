import { t } from "../../../shared/i18n/index.mjs";
import React from "react";
import { Icon } from "../../components/Icon.jsx";
import { Menu, MenuItem } from "../../components/Menu.jsx";
import {
  Button,
  Notice,
  Section,
  Row,
  Switch,
  check,
} from "./SettingsControls.jsx";
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
const sourceBadge = (item) =>
  item?.source === "user"
    ? "badge-info"
    : item?.source === "managed" && item.active
      ? "badge-success"
      : "";
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
    <Section id="wuwa-dx12" title="DX12 Mod">
      <Row
        title={t("settings.wuwaDx12.toggle")}
        description={t("settings.wuwaDx12.description")}
      >
        <Switch
          label={t("settings.wuwaDx12.toggleLabel")}
          checked={!!data?.enabled}
          disabled={busy || !data}
          onChange={toggle}
        />
      </Row>
      {[
        ["reshade", "ReShade"],
        ["addon", "wwmi-dx12"],
      ].map(([key, name]) => {
        const source = data?.sources[key];
        const update = data?.updates?.components[key];
        return (
          <div key={key} data-dx12-component={key}>
            <Row
              title={
                <React.Fragment>
                  {name}
                  <span className={`badge ${sourceBadge(source)}`.trim()}>
                    {sourceLabel(source)}
                  </span>
                </React.Fragment>
              }
              description={
                <React.Fragment>
                  {source?.source === "user"
                    ? t("settings.wuwaDx12.userComponentHint")
                    : t("settings.wuwaDx12.bundledVersionHint", {
                        version:
                          source?.version ||
                          (key === "reshade" ? "6.8.0" : "2026.10.3"),
                      })}
                  {" · "}
                  {t("settings.wuwaDx12.componentVersion", {
                    bundledVersion:
                      update?.bundledVersion ||
                      t("settings.wuwaDx12.awaitingCheck"),
                    status: update?.availableVersion
                      ? t("settings.wuwaDx12.officialVersionSuffix", {
                          availableVersion: update.availableVersion,
                        })
                      : t("settings.wuwaDx12.uncheckedSuffix"),
                  })}
                </React.Fragment>
              }
              details={
                data?.updates?.errors[key] && (
                  <p className="settings-error" role="status">
                    {data.updates.errors[key]}
                  </p>
                )
              }
            >
              <Button
                disabled={busy || !update?.updateAvailable}
                aria-label={t("settings.wuwaDx12.updateNamedComponent", {
                  name,
                })}
                onClick={() =>
                  act(() => window.api.wuwaDx12UpdateComponent(key))
                }
              >
                {t("settings.wuwaDx12.updateComponent")}
              </Button>
            </Row>
          </div>
        );
      })}
      {data && (
        <div className="settings-checks" role="status">
          <div className="settings-checks-title">
            {!data.enabled
              ? t("settings.wuwaDx12.disabledHint")
              : data.ready
                ? t("settings.wuwaDx12.ready")
                : t("settings.wuwaDx12.needsCheck")}
          </div>
          {data.checks.map((item) => (
            <div
              key={item.id}
              className={`settings-check ${item.ok ? "ready" : "missing"}`}
            >
              <Icon name={item.ok ? "check" : "minus"} size={13} />
              <span>
                {`${item.title}：${item.ok && ["wwmi", "addon"].includes(item.id) ? t("settings.steam.detected") : item.message}`}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="settings-actions">
        <Button disabled={busy || !data?.enabled} onClick={() => toggle(true)}>
          {t("settings.wuwaDx12.installMissing")}
        </Button>
        <Button
          disabled={busy || !data}
          onClick={() => act(() => window.api.wuwaDx12CheckUpdates())}
        >
          {t("settings.wuwaDx12.checkUpdates")}
        </Button>
        <Button ghost={true} disabled={busy} onClick={load}>
          {t("settings.wuwaDx12.detectAgain")}
        </Button>
        <Menu
          label={t("common.actions.more")}
          trigger={({ props }) => (
            <button
              type="button"
              className="icon-btn"
              title={t("common.actions.more")}
              aria-label={t("common.actions.more")}
              {...props}
            >
              <Icon name="more" size={16} strokeWidth={2.4} />
            </button>
          )}
        >
          <MenuItem
            icon={<Icon name="folder" size={15} />}
            disabled={busy || !data?.paths.win64}
            onClick={() => window.api.openPathInExplorer(data.paths.win64)}
          >
            {t("settings.wuwaDx12.openGameDirectory")}
          </MenuItem>
          <MenuItem
            icon={<Icon name="external" size={15} />}
            onClick={() => open("https://github.com/lekarsenten/wwmi-dx12")}
          >
            {t("settings.wuwaDx12.projectInfo")}
          </MenuItem>
          <MenuItem
            icon={<Icon name="external" size={15} />}
            onClick={() => open("https://reshade.me/")}
          >
            {t("settings.wuwaDx12.reshadeWebsite")}
          </MenuItem>
        </Menu>
      </div>
      {busy && (
        <p className="settings-footnote" role="status">
          {t("settings.wuwaDx12.processing")}
        </p>
      )}
      {data?.updates?.errors.storage && (
        <Notice kind="danger" role="alert">
          {data.updates.errors.storage}
        </Notice>
      )}
      {error && (
        <Notice kind="danger" role="alert">
          {error}
        </Notice>
      )}
    </Section>
  );
}
export { WuwaDx12Settings };
