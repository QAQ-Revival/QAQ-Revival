import React from "react";
import { t } from "../../../shared/i18n/index.mjs";
import {
  Button,
  Checks,
  ComponentCard,
  Notice,
  PageHead,
  Row,
  Section,
  Switch,
  VersionRow,
  check,
} from "./SettingsControls.jsx";

function EndfieldHdrSettings() {
  const [data, setData] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const alive = React.useRef(true),
    inFlight = React.useRef(false);
  async function refresh() {
    const result = check(await window.api.endfieldHdrStatus());
    if (alive.current) setData(result);
  }
  async function run(action) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (action) {
        check(await action());
        if (alive.current) setNotice(t("settings.endfieldHdr.saved"));
      }
    } catch (failure) {
      if (alive.current) setError(failure.message);
    } finally {
      try {
        await refresh();
      } catch (failure) {
        if (alive.current) setError(failure.message);
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
  const choose = (mode) => run(() => window.api.endfieldHdrSetMode(mode));
  return (
    <React.Fragment>
      <PageHead
        title="HDR"
        description={t("settings.endfieldHdr.summary")}
        actions={
          <Button disabled={busy} onClick={() => run()}>
            {t("settings.endfieldHdr.refresh")}
          </Button>
        }
      />
      <Section id="endfield-hdr">
        <Row
          title="Windows Auto HDR"
          description={t("settings.endfieldHdr.autoDescription")}
        >
          <Switch
            label="Windows Auto HDR"
            checked={!!data?.auto && !data?.native}
            disabled={busy || !data?.paths.game}
            onChange={(enabled) => choose(enabled ? "auto" : "off")}
          />
        </Row>
        <Row
          title={t("settings.endfieldHdr.nativeTitle")}
          description={t("settings.endfieldHdr.nativeDescription")}
        >
          <Switch
            label={t("settings.endfieldHdr.nativeTitle")}
            checked={!!data?.native}
            disabled={busy || !data || (!data.native && !data.canUseNative)}
            onChange={(enabled) => choose(enabled ? "native" : "off")}
          />
        </Row>
        <p className="settings-footnote">
          {t("settings.endfieldHdr.exclusive")}
        </p>
        <Notice>{t("settings.endfieldHdr.displayHint")}</Notice>
        {data?.conflict && (
          <Notice kind="danger">{t("settings.endfieldHdr.conflict")}</Notice>
        )}
        {data?.needsApproval && (
          <Notice>{t("settings.endfieldHdr.approval")}</Notice>
        )}
        {data?.mode === "auto" && (
          <p className="settings-footnote">
            {t("settings.endfieldHdr.autoHint")}
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
        {busy && (
          <span className="settings-busy" role="status">
            <span className="spinner" />
            {t("settings.endfieldHdr.processing")}
          </span>
        )}
      </Section>
      {data && (
        <Section
          id="endfield-hdr-components"
          title={t("settings.endfieldHdr.components")}
          plain
        >
          <ComponentCard
            name="RenoDX + ReShade"
            description={t("settings.endfieldHdr.componentDescription")}
            actions={
              <Button
                disabled={busy || !data.available}
                onClick={() => run(() => window.api.endfieldHdrInstall())}
              >
                {t(
                  data.installed
                    ? "settings.endfieldHdr.reinstall"
                    : "settings.endfieldHdr.install",
                )}
              </Button>
            }
            rows={
              <VersionRow
                name={t("settings.endfieldHdr.bundled")}
                channel="fork"
                local={data.local?.version}
                build={data.local?.build}
                latest={data.available?.version}
                inUse={data.native && data.installed}
              />
            }
          >
            {!data.available && (
              <p className="settings-warning-text">
                {t("settings.endfieldHdr.bundleMissing")}
              </p>
            )}
          </ComponentCard>
          <Checks
            title={t("settings.endfieldHdr.requirements")}
            items={data.checks}
          />
          <p className="settings-footnote">
            {t("settings.endfieldHdr.tuning")}
          </p>
          <Button
            small
            ghost
            disabled={busy || !data.installed}
            onClick={() => window.api.openPathInExplorer(data.paths.root)}
          >
            {t("settings.endfieldHdr.openFolder")}
          </Button>
          <Button
            small
            ghost
            onClick={() =>
              window.api.openExternalUrl(
                "https://github.com/QAQ-Revival/renodx",
              )
            }
          >
            {t("settings.endfieldHdr.source")}
          </Button>
        </Section>
      )}
    </React.Fragment>
  );
}
export { EndfieldHdrSettings };
