import React from "react";
import { t } from "../../../shared/i18n/index.mjs";
import { Icon } from "../../components/Icon.jsx";
import {
  Button,
  ComponentCard,
  Dialog,
  Notice,
  Section,
  VersionRow,
  check,
} from "./SettingsControls.jsx";

// One component, one line per variant: both stay listed with their own version whichever is in use.
function MiComponentCard({ component, locked, onChoose, onUpdate, onUpdateFork, onOpenLauncher }) {
  const { id, name, local, official, fork, updates, forkUpdates } = component;
  const switchable = component.switchable !== false;
  const outdated = local.kind === "outdated";
  // The fork released a later fix than the one QAQR holds, bundled or downloaded.
  const released = !!forkUpdates?.updateAvailable;
  // Once a check found the official version current there is nothing for Update to do.
  const current = !!updates?.latest && !updates.updateAvailable && !updates.error;
  const useButton = (target, allowed) =>
    local.kind !== target && (
      <Button
        small={true}
        data-action="use"
        disabled={locked || !allowed}
        aria-label={t("settings.versions.useNamed", {
          name,
          target: t(`settings.mi.fork.kinds.${target}`),
        })}
        onClick={() => onChoose(component, target)}
      >
        {t("settings.versions.use")}
      </Button>
    );
  const rows = [];
  // A file that is neither variant still gets its own line, so what is on disk is never hidden.
  if (["other", "vulkan"].includes(local.kind))
    rows.push(
      <VersionRow
        key="local"
        channel={local.kind}
        name={t(`settings.mi.fork.kinds.${local.kind}`)}
        inUse={true}
        local={local.version}
        latest="—"
      />,
    );
  rows.push(
    <VersionRow
      key="official"
      channel="official"
      name={t("settings.mi.fork.kinds.official")}
      inUse={switchable && local.kind === "official"}
      local={local.kind === "official" ? local.version : official?.version}
      latest={updates?.latest}
      status={
        updates?.error
          ? "error"
          : updates?.updateAvailable
            ? "update"
            : updates?.latest
              ? "current"
              : undefined
      }
      actions={
        <React.Fragment>
          {switchable && useButton("official", component.canUseOfficial)}
          {component.canUpdateOfficial && !current && (
            <Button
              small={true}
              data-action="update"
              primary={!!updates?.updateAvailable}
              disabled={locked}
              title={t(
                `settings.mi.fork.${id}.${switchable ? "updateHint" : "officialUpdateHint"}`,
              )}
              aria-label={t("settings.mi.fork.updateNamedOfficial", { name })}
              onClick={() => onUpdate(component)}
            >
              {t("settings.mi.update")}
            </Button>
          )}
        </React.Fragment>
      }
    />,
  );
  if (switchable)
    rows.push(
      <VersionRow
        key="fork"
        channel="fork"
        name={t("settings.mi.fork.kinds.fork")}
        inUse={local.kind === "fork" || outdated}
        local={outdated ? local.version : fork?.version}
        build={outdated ? undefined : fork?.build}
        latest={released ? forkUpdates.latest : fork?.version || "—"}
        status={
          released || (fork && outdated)
            ? "update"
            : !fork
              ? undefined
              : forkUpdates?.error
                ? "error"
                : "current"
        }
        actions={
          released ? (
            // Downloads the released fix. One in use is replaced with it; the official variant stays as it is.
            <React.Fragment>
              {!outdated && useButton("fork", component.canUseFork)}
              <Button
                small={true}
                data-action="update"
                primary={true}
                disabled={locked}
                title={t("settings.versions.downloadForkHint")}
                aria-label={t("settings.versions.updateNamedFork", { name })}
                onClick={() => onUpdateFork(component)}
              >
                {t("settings.mi.update")}
              </Button>
            </React.Fragment>
          ) : // An old fix on a Core the bundle does not match is brought up to date through the official line instead.
          outdated ? (
            component.canUseFork && <Button
              small={true}
              data-action="update"
              primary={true}
              disabled={locked}
              title={t("settings.versions.updateForkHint")}
              aria-label={t("settings.versions.updateNamedFork", { name })}
              onClick={() => onChoose(component, "fork")}
            >
              {t("settings.mi.update")}
            </Button>
          ) : (
            useButton("fork", component.canUseFork)
          )
        }
      />,
    );
  return (
    <ComponentCard
      data-component={id}
      name={name}
      tag={t(`settings.mi.fork.${id}.tag`)}
      description={t(
        `settings.mi.fork.${id}.${switchable ? "description" : "officialDescription"}`,
      )}
      actions={
        <Button
          ghost={true}
          small={true}
          onClick={() => window.api.openExternalUrl(component.source)}
        >
          <Icon name="external" size={13} />
          {t("settings.mi.fork.source")}
        </Button>
      }
      rows={rows}
    >
      {component.reason && (
        <p className="settings-warning-text">{component.reason}</p>
      )}
      {updates?.error && (
        <p className="settings-error">{t("games.updates.failed")}</p>
      )}
      {component.needsApproval && (
        <Notice kind="warning">
          <p>{t("settings.mi.fork.approvalHint")}</p>
          <Button small={true} disabled={locked} onClick={onOpenLauncher}>
            {t("settings.mi.open")}
          </Button>
        </Notice>
      )}
    </ComponentCard>
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
        t(
          component.local.kind === "outdated"
            ? "settings.versions.forkUpdated"
            : "settings.mi.fork.switched",
          {
            name: component.name,
            target: t(`settings.mi.fork.${target}`),
          },
        ),
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
  async function updateFork(component) {
    if (locked) return;
    setWorking(true);
    setError("");
    try {
      const result = check(await window.api.xxmiForkUpdate({ gameId, component: component.id }));
      notify(
        "success",
        t(result.applied ? "settings.versions.forkUpdated" : "settings.versions.forkDownloaded", {
          name: component.name,
          version: result.version,
        }),
      );
      // Downloaded, but the copy in use could not be replaced: Unsafe Mode is off, or the game holds the file.
      if (result.pending) setError(result.pending);
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
      description={t("settings.mi.fork.scope")}
      plain
    >
      {state.runtimeInactive && (
        <Notice kind="info">
          {t("settings.mi.fork.runtime.inactiveOnDx12")}
        </Notice>
      )}
      {error && (
        <Notice kind="danger" role="alert">
          {error}
        </Notice>
      )}
      {state.error && <Notice kind="warning">{state.error}</Notice>}
      {(state.components || []).map((component) => (
        <MiComponentCard
          key={component.id}
          component={component}
          locked={locked}
          onChoose={choose}
          onUpdate={update}
          onUpdateFork={updateFork}
          onOpenLauncher={onOpenLauncher}
        />
      ))}
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
