import { t } from "../../../shared/i18n/index.mjs";
import React from "react";
import { Icon } from "../../components/Icon.jsx";
import { Menu, MenuItem } from "../../components/Menu.jsx";
import {
  Button,
  Checks,
  ComponentCard,
  Notice,
  PageHead,
  Section,
  Row,
  Switch,
  VersionRow,
  forkRelease,
  ForkUpdateButton,
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
const SOURCES = {
  reshade: "https://reshade.me/",
  addon: "https://github.com/lekarsenten/wwmi-dx12",
};
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
  // Asks upstream first, so one press both finds and installs what is newer.
  const update = (key) =>
    act(async () => {
      const checked = check(await window.api.wuwaDx12CheckUpdates());
      if (checked.updates?.errors[key]) throw Error(checked.updates.errors[key]);
      return checked.updates?.components[key]?.updateAvailable
        ? window.api.wuwaDx12UpdateComponent(key)
        : checked;
    });
  function card(key, name) {
    const source = data?.sources[key];
    const info = data?.updates?.components[key];
    const failed = data?.updates?.errors[key];
    const managed = source?.source === "managed";
    const fork = key === "addon" ? data?.channel?.fork : null;
    const onFork = !!fork && data.channel.current === "fork";
    const release = forkRelease(fork && data.channel.forkUpdates, fork?.version);
    const useButton = (target) => (
      <Button
        small={true}
        data-action="use"
        disabled={busy || !managed}
        aria-label={t("settings.versions.useNamed", {
          name,
          target: t(`settings.mi.fork.kinds.${target}`),
        })}
        onClick={() => act(() => window.api.wuwaDx12SetChannel(target))}
      >
        {t("settings.versions.use")}
      </Button>
    );
    const rows = [];
    if (source?.source === "user")
      rows.push(
        <VersionRow
          key="user"
          channel="user"
          name={t("settings.wuwaDx12.userSource")}
          inUse={true}
          local={t("settings.wuwaDx12.userComponentHint")}
          latest="—"
        />,
      );
    rows.push(
      <VersionRow
        key="official"
        channel="official"
        name={t(
          fork ? "settings.mi.fork.kinds.official" : "settings.versions.official",
        )}
        inUse={!!fork && managed && !onFork}
        local={
          (managed && !onFork ? source.version : info?.bundledVersion) ||
          source?.version
        }
        latest={info?.availableVersion}
        status={
          failed
            ? "error"
            : info?.updateAvailable
              ? "update"
              : info?.availableVersion
                ? "current"
                : undefined
        }
        actions={
          <React.Fragment>
            {onFork && useButton("official")}
            {/* Nothing to update once the check found this version current */}
            {(!info?.availableVersion || info.updateAvailable || failed) && (
              <Button
                small={true}
                data-action="update"
                primary={!!info?.updateAvailable}
                disabled={busy || !data}
                title={onFork ? t("settings.mi.fork.runtime.updateHint") : undefined}
                aria-label={t("settings.mi.fork.updateNamedOfficial", { name })}
                onClick={() => update(key)}
              >
                {t("settings.mi.update")}
              </Button>
            )}
          </React.Fragment>
        }
      />,
    );
    if (fork)
      rows.push(
        <VersionRow
          key="fork"
          channel="fork"
          name={t("settings.mi.fork.kinds.fork")}
          inUse={onFork}
          local={fork.version}
          build={fork.build}
          latest={release.latest}
          status={release.status}
          actions={
            <React.Fragment>
              {!onFork && useButton("fork")}
              {release.released && (
                <ForkUpdateButton
                  name={name}
                  disabled={busy}
                  onClick={() => act(() => window.api.wuwaDx12UpdateFork())}
                />
              )}
            </React.Fragment>
          }
        />,
      );
    return (
      <ComponentCard
        key={key}
        data-dx12-component={key}
        name={name}
        description={t(`settings.wuwaDx12.${key}Description`)}
        badge={
          <span className={`badge ${sourceBadge(source)}`.trim()}>
            {sourceLabel(source)}
          </span>
        }
        actions={
          <Button ghost={true} small={true} onClick={() => open(SOURCES[key])}>
            <Icon name="external" size={13} />
            {t(key === "addon" ? "settings.mi.fork.source" : "settings.mi.source")}
          </Button>
        }
        rows={rows}
      >
        {failed && (
          <p className="settings-error" role="status">
            {failed}
          </p>
        )}
      </ComponentCard>
    );
  }
  return (
    <React.Fragment>
      <PageHead
        title="DX12 Mod"
        description={t("settings.wuwaDx12.description")}
        actions={
          <React.Fragment>
            <Button
              disabled={busy || !data}
              onClick={() => act(() => window.api.wuwaDx12CheckUpdates())}
            >
              {t("settings.wuwaDx12.checkUpdates")}
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
            </Menu>
          </React.Fragment>
        }
      />
      <Section id="wuwa-dx12">
        <Row title={t("settings.wuwaDx12.toggle")}>
          <Switch
            label={t("settings.wuwaDx12.toggleLabel")}
            checked={!!data?.enabled}
            disabled={busy || !data}
            onChange={toggle}
          />
        </Row>
        {data && (
          <Checks
            title={
              !data.enabled
                ? t("settings.wuwaDx12.disabledHint")
                : data.ready
                  ? t("settings.wuwaDx12.ready")
                  : t("settings.wuwaDx12.needsCheck")
            }
            items={data.checks.map((item) => ({
              ...item,
              message:
                item.ok && ["wwmi", "addon"].includes(item.id)
                  ? t("settings.steam.detected")
                  : item.message,
            }))}
            actions={
              <React.Fragment>
                {busy && (
                  <span className="settings-busy" role="status">
                    <span className="spinner" />
                    {t("settings.wuwaDx12.processing")}
                  </span>
                )}
                {data.enabled && !data.ready && (
                  <Button
                    small={true}
                    disabled={busy}
                    onClick={() => toggle(true)}
                  >
                    {t("settings.wuwaDx12.installMissing")}
                  </Button>
                )}
                <Button small={true} ghost={true} disabled={busy} onClick={load}>
                  {t("settings.wuwaDx12.detectAgain")}
                </Button>
              </React.Fragment>
            }
          />
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
      <Section
        id="wuwa-dx12-components"
        title={t("settings.versions.components")}
        plain
      >
        {card("reshade", "ReShade")}
        {card("addon", "wwmi-dx12")}
      </Section>
    </React.Fragment>
  );
}
export { WuwaDx12Settings };
