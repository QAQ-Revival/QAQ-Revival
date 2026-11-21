import { t } from "../../../shared/i18n/index.mjs";
import React from "react";
import { Icon } from "../../components/Icon.jsx";
import { Menu, MenuItem } from "../../components/Menu.jsx";
import {
  Button,
  Checks,
  ComponentCard,
  Dialog,
  Notice,
  PageHead,
  PathControl,
  Section,
  Row,
  Switch,
  VersionRow,
  forkRelease,
  ForkUpdateButton,
  forkUpdateNotice,
  check,
} from "./SettingsControls.jsx";
const UPSTREAM = "https://github.com/ssice-a/EFF";
const QAQR_FORK = "https://github.com/QAQ-Revival/EFF";
const MOD_MANAGER = "https://github.com/ssice-a/EFF-Mod-Manager";
// The EFF module of Endfield's settings. `overview` installs and switches it, `components` holds its versions;
// its Mods are on the Mods page with the character they belong to.
function EffSettings({ part = "overview" }) {
  const [data, setData] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const [uninstalling, setUninstalling] = React.useState(false);
  const alive = React.useRef(true),
    inFlight = React.useRef(false);
  async function refresh() {
    const result = check(await window.api.effStatus());
    if (alive.current) setData(result);
  }
  // Every action ends on what the disk says, including one that failed part way.
  async function run(action, done) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (action) {
        const result = check(await action());
        if (alive.current && done) setNotice(typeof done === "function" ? done(result) : done);
      }
    } catch (e) {
      if (alive.current) setError(e.message);
    } finally {
      try {
        await refresh();
      } catch (e) {
        if (alive.current) setError(e.message);
      }
      inFlight.current = false;
      if (alive.current) setBusy(false);
    }
  }
  React.useEffect(() => {
    alive.current = true;
    run();
    const off = window.api.onXxmiChanged(() => {
      if (!inFlight.current) refresh().catch(() => {});
    });
    return () => {
      alive.current = false;
      off();
    };
  }, []);
  const open = (url) => window.api.openExternalUrl(url);
  const messages = (
    <React.Fragment>
      {notice && (
        <Notice kind="success" role="status">
          {notice}
        </Notice>
      )}
      {error && (
        <Notice kind="danger" role="alert">
          {error}
        </Notice>
      )}
    </React.Fragment>
  );
  if (part === "components") {
    const updates = data?.updates;
    const channel = data?.installed ? data.channel : "off";
    const fork = data?.sources.fork;
    const release = forkRelease(data?.forkUpdates, fork?.version || fork?.build);
    const choose = (target) =>
      run(
        () => window.api.effSetChannel(target),
        t("settings.eff.switched", { target: t(`settings.mi.fork.kinds.${target}`) }),
      );
    const useButton = (target) =>
      data?.installed &&
      (target !== "official" || data.sources.official.externalData) &&
      channel !== target && (
        <Button
          small={true}
          data-action="use"
          disabled={busy}
          aria-label={t("settings.versions.useNamed", {
            name: "EFF",
            target: t(`settings.mi.fork.kinds.${target}`),
          })}
          onClick={() => choose(target)}
        >
          {t("settings.versions.use")}
        </Button>
      );
    return (
      <React.Fragment>
        <PageHead
          title={t("settings.game.componentsTitle", { name: "EFF" })}
          actions={
            <Button disabled={busy || !data} onClick={() => run(() => window.api.effCheckUpdates())}>
              {t("settings.eff.checkUpdates")}
            </Button>
          }
        />
        {data && (
          <Section id="eff-components" plain>
            <ComponentCard
              data-eff-component="runtime"
              name="EFF"
              tag={t("settings.eff.runtimeTag")}
              description={t("settings.eff.runtimeDescription")}
              badge={
                <span className={`badge ${data.enabled ? "badge-success" : ""}`.trim()}>
                  {t(
                    !data.installed
                      ? "settings.mi.notInstalled"
                      : data.enabled
                        ? "common.status.enabled"
                        : "settings.eff.kinds.off",
                  )}
                </span>
              }
              actions={
                <Button ghost={true} small={true} onClick={() => open(fork ? QAQR_FORK : UPSTREAM)}>
                  <Icon name="external" size={13} />
                  {t("settings.mi.fork.source")}
                </Button>
              }
              rows={
                <React.Fragment>
                  {channel === "other" && (
                    <VersionRow
                      channel="other"
                      name={t("settings.eff.kinds.other")}
                      inUse={true}
                      local={data.version}
                      latest="—"
                    />
                  )}
                  <VersionRow
                    channel="official"
                    name={t("settings.mi.fork.kinds.official")}
                    inUse={channel === "official"}
                    local={channel === "official" ? data.version : data.sources.official.version}
                    latest={updates?.available}
                    status={
                      updates?.error
                        ? "error"
                        : updates?.updateAvailable
                          ? "update"
                          : updates?.available
                            ? "current"
                            : undefined
                    }
                    actions={
                      <React.Fragment>
                        {useButton("official")}
                        {(!updates?.available || updates.updateAvailable || updates.error) && (
                          <Button
                            small={true}
                            data-action="update"
                            primary={!!updates?.updateAvailable}
                            disabled={busy}
                            aria-label={t("settings.eff.updateAria")}
                            onClick={() =>
                              run(async () => {
                                const checked = check(await window.api.effCheckUpdates());
                                if (checked.updates?.error) throw Error(checked.updates.error);
                                return checked.updates?.updateAvailable ? window.api.effUpdate() : checked;
                              })
                            }
                          >
                            {t("settings.mi.update")}
                          </Button>
                        )}
                      </React.Fragment>
                    }
                  />
                  {fork && (
                    <VersionRow
                      channel="fork"
                      name={t("settings.mi.fork.kinds.fork")}
                      inUse={channel === "fork"}
                      local={fork.version || fork.build}
                      build={fork.version ? fork.build : undefined}
                      latest={release.latest}
                      status={release.status}
                      actions={
                        <React.Fragment>
                          {useButton("fork")}
                          {release.released && (
                            <ForkUpdateButton
                              name="EFF"
                              disabled={busy}
                              onClick={() =>
                                run(
                                  () => window.api.effUpdateFork(),
                                  (result) => forkUpdateNotice("EFF", result),
                                )
                              }
                            />
                          )}
                        </React.Fragment>
                      }
                    />
                  )}
                </React.Fragment>
              }
            >
              {!data.sources.official.externalData && <p className="settings-footnote">{t("settings.eff.externalRequired")}</p>}
              {!fork && <p className="settings-warning-text">{t("settings.eff.forkMissing")}</p>}
              {updates?.error && (
                <p className="settings-error" role="status">
                  {updates.error}
                </p>
              )}
            </ComponentCard>
            {messages}
          </Section>
        )}
      </React.Fragment>
    );
  }
  const unassigned = data?.unassignedMods || [];
  return (
    <React.Fragment>
      <PageHead
        title="EFF"
        description={t("settings.eff.summary")}
        actions={
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
              disabled={busy || !data?.paths.plugin}
              onClick={() => window.api.openPathInExplorer(data.paths.plugin)}
            >
              {t("settings.eff.openGameDirectory")}
            </MenuItem>
            <MenuItem icon={<Icon name="external" size={15} />} onClick={() => open(UPSTREAM)}>
              {t("settings.eff.upstreamInfo")}
            </MenuItem>
            <MenuItem icon={<Icon name="external" size={15} />} onClick={() => open(MOD_MANAGER)}>
              {t("settings.eff.modManager")}
            </MenuItem>
            <MenuItem
              icon={<Icon name="trash" size={15} />}
              disabled={busy || !data?.installed}
              onClick={() => setUninstalling(true)}
            >
              {t("settings.eff.uninstall")}
            </MenuItem>
          </Menu>
        }
      />
      <Section id="eff">
        {data?.installed ? (
          <Row title={t("settings.eff.toggle")} description={t("settings.eff.description")}>
            <Switch
              label={t("settings.eff.toggleLabel")}
              checked={!!data.enabled}
              disabled={busy}
              onChange={(enabled) =>
                run(
                  () => window.api.effSetEnabled(enabled),
                  t(enabled ? "settings.eff.enabled" : "settings.eff.disabled"),
                )
              }
            />
          </Row>
        ) : (
          <Row title={t("settings.eff.install")} description={t("settings.eff.installDescription")}>
            <Button
              primary={true}
              data-action="install"
              disabled={busy || !data || !data.paths.game}
              onClick={() => run(() => window.api.effSetInstalled(true), t("settings.eff.installed"))}
            >
              {t("settings.eff.installAction")}
            </Button>
          </Row>
        )}
        {data && (
          <Checks
            title={
              !data.installed
                ? t("settings.eff.notInstalledHint")
                : !data.enabled
                  ? t("settings.eff.disabledHint")
                  : data.ready
                    ? t("settings.eff.ready")
                    : t("settings.eff.needsCheck")
            }
            items={data.checks}
            actions={
              <React.Fragment>
                {busy && (
                  <span className="settings-busy" role="status">
                    <span className="spinner" />
                    {t("settings.eff.processing")}
                  </span>
                )}
                <Button small={true} ghost={true} disabled={busy} onClick={() => run()}>
                  {t("settings.eff.detectAgain")}
                </Button>
              </React.Fragment>
            }
          />
        )}
        {messages}
        <p className="settings-footnote">{t("settings.eff.limits")}</p>
      </Section>
      {data && (
        <Section id="eff-paths" title={t("settings.eff.pathsTitle")}>
          <Row title={t("settings.eff.modsFolder")} hint={t("settings.eff.modsFolderHint")} path={true}>
            <PathControl label={t("settings.eff.modsFolder")} value={data.paths.mods} disabled={busy} />
          </Row>
          {unassigned.length > 0 && (
            <Notice kind="warning" role="status">
              {t("settings.eff.unassigned", { count: unassigned.length, names: unassigned.join("、") })}
            </Notice>
          )}
        </Section>
      )}
      {uninstalling && (
        <Dialog
          title={t("settings.eff.uninstallTitle")}
          description={t("settings.eff.uninstallDescription")}
          onClose={() => setUninstalling(false)}
          actions={
            <React.Fragment>
              <Button onClick={() => setUninstalling(false)}>{t("common.actions.cancel")}</Button>
              <Button
                danger={true}
                onClick={() => {
                  setUninstalling(false);
                  run(() => window.api.effSetInstalled(false), t("settings.eff.uninstalled"));
                }}
              >
                {t("settings.eff.uninstall")}
              </Button>
            </React.Fragment>
          }
        >
          {data?.otherPlugins.length > 0 && (
            <p className="settings-warning-text">
              {t("settings.eff.uninstallOthers", { names: data.otherPlugins.join("、") })}
            </p>
          )}
        </Dialog>
      )}
    </React.Fragment>
  );
}
export { EffSettings };
