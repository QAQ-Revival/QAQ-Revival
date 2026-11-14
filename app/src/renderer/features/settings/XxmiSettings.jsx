import React from "react";
import { MiForkSettings } from "./MiForkSettings.jsx";
import { Icon } from "../../components/Icon.jsx";
import { t } from "../../../shared/i18n/index.mjs";
import {
  Button,
  ComponentCard,
  Notice,
  Row,
  PathControl,
  Section,
  VersionRow,
  check,
} from "./SettingsControls.jsx";

// The Launcher, the MI components it installs for this game, and where they live.
// `checkedTick` moves when the user asks for a check and `checkedAt` when any check, automatic ones included,
// has finished; `checkFailed` says that check left MI out.
export function XxmiSettings({
  gameId,
  notify,
  onPathsChanged,
  checkedTick = 0,
  checkedAt = 0,
  checkFailed = false,
}) {
  const [state, setState] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [progress, setProgress] = React.useState(null);
  const refreshSequence = React.useRef(0);
  React.useEffect(() => {
    let canceled = false;
    function refresh() {
      const sequence = ++refreshSequence.current;
      window.api
        .xxmiStatus(gameId)
        .then((result) => {
          check(result);
          if (!canceled && sequence === refreshSequence.current) {
            setState(result);
            setProgress(null);
          }
        })
        .catch((error) => {
          if (!canceled && sequence === refreshSequence.current)
            setError(error.message);
        });
    }
    const offChanged = window.api.onXxmiChanged(refresh);
    refresh();
    const off = window.api.onXxmiProgress((value) => {
      if (value.gameId === gameId) setProgress(value);
    });
    return () => {
      canceled = true;
      off();
      offChanged();
    };
  }, [gameId]);
  // A finished check has new versions to show. It covers MI when the Launcher is configured;
  // when the user asked and it did not, ask upstream here.
  const seenTick = React.useRef(0);
  React.useEffect(() => {
    if (!checkedTick && !checkedAt) return;
    const asked = checkedTick !== seenTick.current;
    seenTick.current = checkedTick;
    let canceled = false;
    if (asked) setError("");
    (async () => {
      try {
        let next = check(await window.api.xxmiStatus(gameId));
        if (asked && !next.components?.some((component) => component.latest))
          next = check(await window.api.xxmiCheck(gameId));
        if (!canceled) setState(next);
      } catch (failure) {
        if (!canceled && asked) setError(failure.message);
      }
    })();
    return () => {
      canceled = true;
    };
  }, [checkedTick, checkedAt, gameId]);
  async function install() {
    if (busy) return;
    setBusy(true);
    setError("");
    setProgress(null);
    try {
      check(await window.api.xxmiInstall({ gameId }));
      const refreshed = await window.api.xxmiStatus(gameId);
      check(refreshed);
      setState(refreshed);
      onPathsChanged();
      notify("success", t("settings.mi.completed"));
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }
  async function reload() {
    const next = await window.api.xxmiStatus(gameId);
    check(next);
    setState(next);
  }
  async function openLauncher() {
    setBusy(true);
    setError("");
    try {
      check(await window.api.launchGame({ gameId, launchMode: "XXMI" }));
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  const locked = busy || !!state?.busy;
  const launcher = (state?.components || []).find(
    (component) => component.id === "Launcher",
  );
  const upToDate =
    !!launcher?.installed && !!launcher.latest && !launcher.updateAvailable;
  return (
    <React.Fragment>
      <Section id="xxmi-installer" title={t("settings.mi.section")} plain>
        {error && (
          <Notice kind="danger" role="alert">
            {error}
          </Notice>
        )}
        {checkFailed && !error && (
          <Notice kind="warning">{t("games.updates.miFailed")}</Notice>
        )}
        {progress && (
          <Notice kind="info" role="status">
            {t(`settings.mi.progress.${progress.stage}`, {
              name: progress.package,
            })}
            {progress.total > 0
              ? ` · ${Math.round((progress.downloaded / progress.total) * 100)}%`
              : ""}
          </Notice>
        )}
        {!state && !error && (
          <div className="settings-state" role="status">
            <span className="spinner" />
            {t("settings.mi.loading")}
          </div>
        )}
        {launcher && (
          <ComponentCard
            data-component="launcher"
            name="XXMI Launcher"
            description={t("settings.mi.launcherDescription")}
            actions={
              <Button
                ghost={true}
                small={true}
                onClick={() => window.api.openExternalUrl(launcher.source)}
              >
                <Icon name="external" size={13} />
                {t("settings.mi.source")}
              </Button>
            }
            rows={
              <VersionRow
                channel="official"
                name={t("settings.versions.official")}
                local={launcher.installed || t("settings.mi.notInstalled")}
                latest={launcher.latest}
                status={
                  launcher.error
                    ? "error"
                    : launcher.updateAvailable
                      ? "update"
                      : upToDate
                        ? "current"
                        : undefined
                }
                actions={
                  <React.Fragment>
                    {launcher.installed && (
                      <Button small={true} disabled={locked} onClick={openLauncher}>
                        {t("settings.mi.open")}
                      </Button>
                    )}
                    {/* Nothing to update once the check found this version current */}
                    {!upToDate && (
                      <Button
                        small={true}
                        data-action="update"
                        disabled={locked}
                        primary={!launcher.installed || launcher.updateAvailable}
                        onClick={install}
                      >
                        {t(
                          busy
                            ? "settings.mi.working"
                            : launcher.installed
                              ? "settings.mi.update"
                              : "settings.mi.install",
                        )}
                      </Button>
                    )}
                  </React.Fragment>
                }
              />
            }
          >
            {launcher.error && (
              <p className="settings-error" role="alert">
                {launcher.error}
              </p>
            )}
          </ComponentCard>
        )}
      </Section>
      {state && (
        <MiForkSettings
          state={state.fork}
          gameId={gameId}
          busy={locked}
          notify={notify}
          onChanged={reload}
          onOpenLauncher={openLauncher}
        />
      )}
      {state && (
        <Section id="xxmi-directories" title={t("settings.mi.directories")}>
          <Row
            title={t("settings.mi.directory")}
            hint={t("settings.mi.directoryHint")}
            path={true}
          >
            <PathControl
              label={t("settings.mi.directory")}
              value={state.root}
              disabled={busy}
            />
          </Row>
          {state.fork?.root && (
            <Row
              title={t("settings.mi.fork.directory", {
                importer: state.fork.importer,
              })}
              path={true}
            >
              <PathControl
                label={t("settings.mi.fork.directory", {
                  importer: state.fork.importer,
                })}
                value={state.fork.root}
                disabled={busy}
              />
            </Row>
          )}
        </Section>
      )}
    </React.Fragment>
  );
}
