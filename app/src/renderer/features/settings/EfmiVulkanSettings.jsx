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
  Section,
  Row,
  Switch,
  VersionRow,
  check,
} from "./SettingsControls.jsx";
const QAQR_FORK = "https://github.com/QAQ-Revival/XXMI-Libs-Vulkan";
const UPSTREAM = "https://github.com/myparsleycat/XXMI-Libs-Package-Forked";
function EfmiVulkanSettings() {
  const [data, setData] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const [confirming, setConfirming] = React.useState(false);
  const alive = React.useRef(true),
    inFlight = React.useRef(false);
  async function refresh() {
    const result = check(await window.api.efmiVulkanStatus());
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
        check(await action());
        if (alive.current && done) setNotice(done);
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
  function toggle(enabled, confirmed = false) {
    if (enabled && data?.confirmReplace && !confirmed) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    run(
      () => window.api.efmiVulkanSetEnabled({ enabled, confirmed }),
      t(enabled ? "settings.efmiVulkan.enabled" : "settings.efmiVulkan.disabled"),
    );
  }
  const updates = data?.updates;
  const channel = data?.enabled ? data.channel : "off";
  const fork = data?.sources.fork;
  const open = (url) => window.api.openExternalUrl(url);
  const choose = (target) =>
    run(
      () => window.api.efmiVulkanSetChannel(target),
      t(
        channel === "outdated" && target === "fork"
          ? "settings.versions.forkUpdated"
          : "settings.efmiVulkan.switched",
        { name: "XXMI-Libs", target: t(`settings.efmiVulkan.${target}`) },
      ),
    );
  const useButton = (target) =>
    channel !== target && (
      <Button
        small={true}
        data-action="use"
        disabled={busy || !data.enabled}
        aria-label={t("settings.versions.useNamed", {
          name: "XXMI-Libs",
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
        title="Vulkan Mod"
        description={t("settings.efmiVulkan.summary")}
        actions={
          <React.Fragment>
            <Button
              disabled={busy || !data}
              onClick={() => run(() => window.api.efmiVulkanCheckUpdates())}
            >
              {t("settings.efmiVulkan.checkUpdates")}
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
                disabled={busy || !data?.paths.mi}
                onClick={() => window.api.openPathInExplorer(data.paths.mi)}
              >
                {t("settings.efmiVulkan.openMiDirectory")}
              </MenuItem>
              <MenuItem
                icon={<Icon name="external" size={15} />}
                onClick={() => open(UPSTREAM)}
              >
                {t("settings.efmiVulkan.upstreamInfo")}
              </MenuItem>
            </Menu>
          </React.Fragment>
        }
      />
      <Section id="efmi-vulkan">
        <Row
          title={t("settings.efmiVulkan.toggle")}
          description={t("settings.efmiVulkan.description")}
        >
          <Switch
            label={t("settings.efmiVulkan.toggleLabel")}
            checked={!!data?.enabled}
            disabled={busy || !data}
            onChange={(enabled) => toggle(enabled)}
          />
        </Row>
        {data && (
          <Checks
            title={
              !data.enabled
                ? t("settings.efmiVulkan.disabledHint")
                : data.ready
                  ? t("settings.efmiVulkan.ready")
                  : t("settings.efmiVulkan.needsCheck")
            }
            items={data.checks}
            actions={
              <React.Fragment>
                {busy && (
                  <span className="settings-busy" role="status">
                    <span className="spinner" />
                    {t("settings.efmiVulkan.processing")}
                  </span>
                )}
                <Button
                  small={true}
                  ghost={true}
                  disabled={busy}
                  onClick={() => run()}
                >
                  {t("settings.efmiVulkan.detectAgain")}
                </Button>
              </React.Fragment>
            }
          />
        )}
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
        <p className="settings-footnote">{t("settings.efmiVulkan.limits")}</p>
      </Section>
      {data && (
        <Section
          id="efmi-vulkan-components"
          title={t("settings.versions.components")}
          plain
        >
          <ComponentCard
            data-vulkan-component="runtime"
            name="XXMI-Libs"
            tag={t("settings.efmiVulkan.runtimeTag")}
            description={t("settings.efmiVulkan.runtimeDescription")}
            badge={
              <span
                className={`badge ${data.enabled ? "badge-success" : ""}`.trim()}
              >
                {t(
                  data.enabled ? "common.status.enabled" : "settings.efmiVulkan.kinds.off",
                )}
              </span>
            }
            actions={
              <Button ghost={true} small={true} onClick={() => open(QAQR_FORK)}>
                <Icon name="external" size={13} />
                {t("settings.mi.fork.source")}
              </Button>
            }
            rows={
              <React.Fragment>
                {channel === "other" && (
                  <VersionRow
                    channel="other"
                    name={t("settings.efmiVulkan.kinds.other")}
                    inUse={true}
                    latest="—"
                  />
                )}
                <VersionRow
                  channel="official"
                  name={t("settings.mi.fork.kinds.official")}
                  inUse={channel === "official"}
                  local={data.sources.official.version}
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
                      {/* Nothing to update once the check found this version current */}
                      {(!updates?.available || updates.updateAvailable || updates.error) && <Button
                        small={true}
                        data-action="update"
                        primary={!!updates?.updateAvailable}
                        disabled={busy}
                        title={
                          channel === "fork"
                            ? t("settings.mi.fork.runtime.updateHint")
                            : undefined
                        }
                        aria-label={t("settings.efmiVulkan.updateAria")}
                        onClick={() =>
                          run(async () => {
                            const checked = check(
                              await window.api.efmiVulkanCheckUpdates(),
                            );
                            if (checked.updates?.error)
                              throw Error(checked.updates.error);
                            return checked.updates?.updateAvailable
                              ? window.api.efmiVulkanUpdate()
                              : checked;
                          })
                        }
                      >
                        {t("settings.mi.update")}
                      </Button>}
                    </React.Fragment>
                  }
                />
                {fork && (
                  <VersionRow
                    channel="fork"
                    name={t("settings.mi.fork.kinds.fork")}
                    inUse={["fork", "outdated"].includes(channel)}
                    local={
                      channel === "outdated"
                        ? t("settings.efmiVulkan.kinds.outdated")
                        : fork.version || fork.build
                    }
                    build={
                      channel === "outdated" || !fork.version ? undefined : fork.build
                    }
                    latest={fork.version || fork.build}
                    status={channel === "outdated" ? "update" : "current"}
                    actions={
                      channel === "outdated" ? (
                        <Button
                          small={true}
                          data-action="update"
                          primary={true}
                          disabled={busy}
                          title={t("settings.versions.updateForkHint")}
                          aria-label={t("settings.versions.updateNamedFork", {
                            name: "XXMI-Libs",
                          })}
                          onClick={() => choose("fork")}
                        >
                          {t("settings.mi.update")}
                        </Button>
                      ) : (
                        useButton("fork")
                      )
                    }
                  />
                )}
              </React.Fragment>
            }
          >
            {!fork && (
              <p className="settings-warning-text">
                {t("settings.efmiVulkan.forkMissing")}
              </p>
            )}
            {updates?.error && (
              <p className="settings-error" role="status">
                {updates.error}
              </p>
            )}
          </ComponentCard>
        </Section>
      )}
      {confirming && (
        <Dialog
          title={t("settings.efmiVulkan.confirmTitle")}
          description={t("settings.efmiVulkan.confirmDescription")}
          onClose={() => setConfirming(false)}
          actions={
            <React.Fragment>
              <Button onClick={() => setConfirming(false)}>
                {t("common.actions.cancel")}
              </Button>
              <Button danger={true} onClick={() => toggle(true, true)}>
                {t("settings.efmiVulkan.confirmAction")}
              </Button>
            </React.Fragment>
          }
        />
      )}
    </React.Fragment>
  );
}
export { EfmiVulkanSettings };
