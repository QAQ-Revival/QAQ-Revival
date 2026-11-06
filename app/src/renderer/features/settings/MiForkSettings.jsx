import React from "react";
import { t } from "../../../shared/i18n/index.mjs";
import {
  Button,
  Choices,
  Dialog,
  Notice,
  PathControl,
  Row,
  Section,
  check,
} from "./SettingsControls.jsx";

function versionLabel(kind, version) {
  return [t(`settings.mi.fork.kinds.${kind}`), version].filter(Boolean).join(" ");
}

// Reads the state of one component: what is on disk now, and what the other side would be.
function ComponentRow({ component, locked, onChoose, onUpdate }) {
  const { id, name, local, official, fork } = component;
  const isFork = local.kind === "fork";
  // A missing Launcher consent is one step away, so the fix stays listed; other blocks explain themselves.
  const forkReachable =
    !isFork &&
    (component.canUseFork || (component.needsApproval && !component.reason));
  const others = [
    component.canUseOfficial && versionLabel("official", official.version),
    forkReachable && `${versionLabel("fork", fork.version)} · ${fork.build}`,
  ].filter(Boolean);
  const unavailable = (target, allowed) =>
    locked || (local.kind !== target && !allowed);
  return (
    <Row
      title={
        <React.Fragment>
          {name}
          <span className="badge">{t(`settings.mi.fork.${id}.tag`)}</span>
        </React.Fragment>
      }
      description={t(component.switchable === false ? `settings.mi.fork.${id}.officialDescription` : `settings.mi.fork.${id}.description`)}
      details={
        <React.Fragment>
          <p className="mi-fork-local">
            {t("settings.mi.fork.local")}{" "}
            <strong>{versionLabel(local.kind, local.version)}</strong>
            {local.build && ` · ${local.build}`}
          </p>
          {others.length > 0 && (
            <p>
              {t("settings.mi.fork.switchTo")} {others.join("，")}
            </p>
          )}
          {component.reason && (
            <p className="settings-warning-text">{component.reason}</p>
          )}
          {component.canUpdateOfficial && (
            <p>{t(`settings.mi.fork.${id}.${component.switchable === false && id === "core" ? "officialUpdateHint" : "updateHint"}`)}</p>
          )}
        </React.Fragment>
      }
    >
      {component.canUpdateOfficial && (
        <Button disabled={locked} onClick={() => onUpdate(component)}
          aria-label={t("settings.mi.fork.updateNamedOfficial", { name })}>
          {t("settings.mi.fork.updateOfficial")}
        </Button>
      )}
      {component.switchable !== false && <Choices
        label={name}
        value={local.kind}
        options={[
          {
            value: "official",
            label: t("settings.mi.fork.official"),
            disabled: unavailable("official", component.canUseOfficial),
          },
          {
            value: "fork",
            label: t("settings.mi.fork.fork"),
            disabled: unavailable("fork", component.canUseFork),
          },
        ]}
        onChange={(target) => onChoose(component, target)}
      />}
      <Button
        ghost={true}
        onClick={() => window.api.openExternalUrl(component.source)}
      >
        {t("settings.mi.fork.source")}
      </Button>
    </Row>
  );
}

export function MiForkSettings({
  state,
  gameId,
  busy,
  notify,
  onChanged,
  onOpenLauncher,
}) {
  const [working, setWorking] = React.useState(false);
  const [error, setError] = React.useState("");
  const [confirming, setConfirming] = React.useState(null);
  if (!state?.supported) return null;
  const locked = busy || working;
  async function change({ component, target }, confirmed = false) {
    setConfirming(null);
    setWorking(true);
    setError("");
    try {
      check(
        await window.api.xxmiForkSwitch({
          gameId,
          component: component.id,
          target,
          confirmed,
        }),
      );
      await onChanged();
      notify(
        "success",
        t("settings.mi.fork.switched", {
          name: component.name,
          target: t(`settings.mi.fork.${target}`),
        }),
      );
    } catch (failure) {
      setError(failure.message);
    } finally {
      setWorking(false);
    }
  }
  async function update(component) {
    if (locked) return;
    setWorking(true);
    setError("");
    try {
      const result = check(await window.api.xxmiUpdateOfficial({ gameId, component: component.id }));
      notify("success", t("settings.mi.fork.officialUpdated", { name: component.name, version: result.version }));
    } catch (failure) {
      setError(failure.message);
    } finally {
      try { await onChanged(); } catch (failure) { setError(failure.message); }
      setWorking(false);
    }
  }
  function choose(component, target) {
    if (locked || component.local.kind === target) return;
    if (component.confirmReplace) setConfirming({ component, target });
    else change({ component, target });
  }
  return (
    <Section
      id="mi-forks"
      title={t("settings.mi.fork.title", { importer: state.importer })}
    >
      <p className="settings-section-note">{t("settings.mi.fork.scope")}</p>
      {state.runtimeInactive && (
        <p className="settings-section-note">
          {t("settings.mi.fork.runtime.inactiveOnDx12")}
        </p>
      )}
      {error && (
        <Notice kind="danger" role="alert">
          {error}
        </Notice>
      )}
      {state.error && <Notice kind="warning">{state.error}</Notice>}
      {(state.components || []).map((component) => (
        <React.Fragment key={component.id}>
          <ComponentRow
            component={component}
            locked={locked}
            onChoose={choose}
            onUpdate={update}
          />
          {component.needsApproval && (
            <Notice kind="warning">
              <p>{t("settings.mi.fork.approvalHint")}</p>
              <Button disabled={locked} onClick={onOpenLauncher}>
                {t("settings.mi.open")}
              </Button>
            </Notice>
          )}
        </React.Fragment>
      ))}
      {state.root && (
        <Row
          title={t("settings.mi.fork.directory", { importer: state.importer })}
          path={true}
        >
          <PathControl
            label={t("settings.mi.fork.directory", {
              importer: state.importer,
            })}
            value={state.root}
            disabled={locked}
          />
        </Row>
      )}
      {confirming && (
        <Dialog
          title={t("settings.mi.fork.confirmTitle")}
          description={t("settings.mi.fork.confirmDescription", {
            name: confirming.component.name,
            target: t(`settings.mi.fork.${confirming.target}`),
          })}
          onClose={() => setConfirming(null)}
          actions={
            <React.Fragment>
              <Button onClick={() => setConfirming(null)}>
                {t("common.actions.cancel")}
              </Button>
              <Button
                danger={true}
                onClick={() => change(confirming, true)}
              >
                {t("settings.mi.fork.confirmAction")}
              </Button>
            </React.Fragment>
          }
        />
      )}
    </Section>
  );
}
