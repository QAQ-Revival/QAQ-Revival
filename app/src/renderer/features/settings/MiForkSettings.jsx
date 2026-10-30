import React from "react";
import { t } from "../../../shared/i18n/index.mjs";
import { Button, Notice, Row } from "./SettingsControls.jsx";

export function MiForkSettings({ state, busy, onApply, onRestore, onOpenLauncher }) {
  if (!state?.supported) return null;
  return (
    <React.Fragment>
      <Row
        title={t("settings.mi.fork.title")}
        description={t(state.coreVersion ? "settings.mi.fork.efmiDescription" : "settings.mi.fork.runtimeDescription")}
        details={
          <React.Fragment>
            {state.version && <p>{t(state.managed ? "settings.mi.fork.selected" : "settings.mi.fork.available", { version: state.managed ? state.installedVersion : state.version })}</p>}
            {state.updateAvailable && <p>{t("settings.mi.fork.available", { version: state.version })}</p>}
            {state.root && <p className="settings-path">{state.root}</p>}
          </React.Fragment>
        }
      >
        <Button primary={true} disabled={busy || !state.ready || !state.approval || state.modified || state.recoveryRequired || (state.managed && !state.updateAvailable)} onClick={onApply}>
          {t(state.managed ? "settings.mi.fork.update" : "settings.mi.fork.apply")}
        </Button>
        {(state.managed || state.recoveryRequired) && <Button disabled={busy || state.modified} onClick={onRestore}>{t(state.recoveryRequired ? "settings.mi.fork.recover" : "settings.mi.fork.restore")}</Button>}
        <Button ghost={true} disabled={busy} onClick={() => window.api.openExternalUrl("https://github.com/QAQ-Revival/XXMI-Libs-Package")}>{t("settings.mi.fork.source")}</Button>
      </Row>
      {state.error && <Notice kind="danger">{state.error}</Notice>}
      {state.modified && <Notice kind="danger">{t("settings.mi.fork.modified")}</Notice>}
      {state.recoveryRequired && <Notice kind="danger">{t("settings.mi.fork.recoveryRequired", { path: state.backup })}</Notice>}
      {state.ready && !state.approval && <Notice kind="warning">
        <p>{t("settings.mi.fork.approvalHint")}</p>
        <Button disabled={busy} onClick={onOpenLauncher}>{t("settings.mi.open")}</Button>
      </Notice>}
      {state.managed && <Notice kind="info">{t("settings.mi.fork.restartHint")}</Notice>}
    </React.Fragment>
  );
}
