import { t } from "../../../shared/i18n/index.mjs";
import React from "react";
import { Icon } from "../../components/Icon.jsx";
import { Menu, MenuItem } from "../../components/Menu.jsx";
import {
  Button,
  Choices,
  Dialog,
  Notice,
  Section,
  Row,
  Switch,
  check,
} from "./SettingsControls.jsx";
const QAQR_BRANCH =
  "https://github.com/QAQ-Revival/XXMI-Libs-Package/tree/vulkan";
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
  const open = (url) => window.api.openExternalUrl(url);
  return (
    <Section id="efmi-vulkan" title="Vulkan Mod">
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
        <div data-vulkan-component="runtime">
          <Row
            title={
              <React.Fragment>
                XXMI-Libs
                <span
                  className={`badge ${data.enabled ? "badge-success" : ""}`.trim()}
                >
                  {t(`settings.efmiVulkan.kinds.${channel}`)}
                </span>
              </React.Fragment>
            }
            description={
              <React.Fragment>
                {t("settings.efmiVulkan.runtimeDescription", {
                  official: data.sources.official.version,
                })}
                {data.sources.fork && ` · ${data.sources.fork.build}`}
                {updates?.available &&
                  ` · ${t("settings.efmiVulkan.availableVersion", {
                    version: updates.available,
                  })}`}
              </React.Fragment>
            }
            details={
              <React.Fragment>
                {!data.sources.fork && (
                  <p className="settings-warning-text">
                    {t("settings.efmiVulkan.forkMissing")}
                  </p>
                )}
                {updates?.error && (
                  <p className="settings-error" role="status">
                    {updates.error}
                  </p>
                )}
                {channel === "fork" && <p>{t("settings.mi.fork.runtime.updateHint")}</p>}
              </React.Fragment>
            }
          >
            <Choices
              label={t("settings.efmiVulkan.channelLabel")}
              value={channel}
              disabled={busy || !data.enabled}
              options={[
                { value: "official", label: t("settings.efmiVulkan.official") },
                {
                  value: "fork",
                  label: t("settings.efmiVulkan.fork"),
                  disabled: !data.sources.fork,
                },
              ]}
              onChange={(target) => {
                if (target === channel) return;
                run(
                  () => window.api.efmiVulkanSetChannel(target),
                  t("settings.efmiVulkan.switched", {
                    target: t(`settings.efmiVulkan.${target}`),
                  }),
                );
              }}
            />
            <Button
              disabled={busy || !data}
              aria-label={t("settings.efmiVulkan.updateAria")}
              onClick={() => run(async () => {
                const checked = check(await window.api.efmiVulkanCheckUpdates());
                if (checked.updates?.error) throw Error(checked.updates.error);
                return checked.updates?.updateAvailable ? window.api.efmiVulkanUpdate() : checked;
              })}
            >
              {t("settings.mi.fork.updateOfficial")}
            </Button>
          </Row>
        </div>
      )}
      {data && (
        <div className="settings-checks" role="status">
          <div className="settings-checks-title">
            {!data.enabled
              ? t("settings.efmiVulkan.disabledHint")
              : data.ready
                ? t("settings.efmiVulkan.ready")
                : t("settings.efmiVulkan.needsCheck")}
          </div>
          {data.checks.map((item) => (
            <div
              key={item.id}
              className={`settings-check ${item.ok ? "ready" : "missing"}`}
            >
              <Icon name={item.ok ? "check" : "minus"} size={13} />
              <span>{`${item.title}：${item.message}`}</span>
            </div>
          ))}
        </div>
      )}
      <p className="settings-footnote">{t("settings.efmiVulkan.limits")}</p>
      <div className="settings-actions">
        <Button
          disabled={busy || !data}
          onClick={() => run(() => window.api.efmiVulkanCheckUpdates())}
        >
          {t("settings.efmiVulkan.checkUpdates")}
        </Button>
        <Button ghost={true} disabled={busy} onClick={() => run()}>
          {t("settings.efmiVulkan.detectAgain")}
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
            onClick={() => open(QAQR_BRANCH)}
          >
            {t("settings.efmiVulkan.projectInfo")}
          </MenuItem>
          <MenuItem
            icon={<Icon name="external" size={15} />}
            onClick={() => open(UPSTREAM)}
          >
            {t("settings.efmiVulkan.upstreamInfo")}
          </MenuItem>
        </Menu>
      </div>
      {busy && (
        <p className="settings-footnote" role="status">
          {t("settings.efmiVulkan.processing")}
        </p>
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
    </Section>
  );
}
export { EfmiVulkanSettings };
