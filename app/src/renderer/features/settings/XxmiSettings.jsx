import React from "react";
import { MiForkSettings } from "./MiForkSettings.jsx";
import { t } from "../../../shared/i18n/index.mjs";
import {
  Button,
  Notice,
  Row,
  PathControl,
  Section,
  check,
} from "./SettingsControls.jsx";

export function XxmiSettings({ gameId, notify, onPathsChanged }) {
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
  async function act(install) {
    if (busy) return;
    setBusy(true);
    setError("");
    setProgress(null);
    try {
      const result = install
        ? await window.api.xxmiInstall({ gameId })
        : await window.api.xxmiCheck(gameId);
      check(result);
      if (install) {
        const refreshed = await window.api.xxmiStatus(gameId);
        check(refreshed);
        setState(refreshed);
        onPathsChanged();
        notify("success", t("settings.mi.completed"));
      } else setState(result);
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }
  async function changeFork(restore) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      check(await (restore ? window.api.xxmiForkRestore({ gameId }) : window.api.xxmiForkApply({ gameId })));
      const next = await window.api.xxmiStatus(gameId);
      check(next);
      setState(next);
      notify("success", t(restore ? "settings.mi.fork.restored" : "settings.mi.fork.applied"));
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
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
  return (
    <Section
      id="xxmi-installer"
      title={t("settings.mi.title")}
      actions={
        <Button
          small={true}
          disabled={busy || state?.busy}
          onClick={() => act()}
        >
          {t(busy ? "settings.mi.working" : "settings.mi.check")}
        </Button>
      }
    >
      {error && (
        <Notice kind="danger" role="alert">
          {error}
        </Notice>
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
      {state && (
        <React.Fragment>
          {(state.components || []).map((component) => (
            <Row
              key={component.id}
              title={
                component.installed
                  ? t("settings.mi.installed", { version: component.installed })
                  : t("settings.mi.notInstalled")
              }
              details={
                <React.Fragment>
                  {component.latest && (
                    <p>
                      {t(
                        component.updateAvailable
                          ? "settings.mi.available"
                          : "settings.mi.latest",
                        { version: component.latest },
                      )}
                    </p>
                  )}
                  {component.error && (
                    <p className="settings-error" role="alert">
                      {component.error}
                    </p>
                  )}
                </React.Fragment>
              }
            >
              {component.installed && (
                <Button disabled={busy || state.busy} onClick={openLauncher}>
                  {t("settings.mi.open")}
                </Button>
              )}
              <Button
                disabled={
                  busy ||
                  state.busy ||
                  (!!component.installed &&
                    !!component.latest &&
                    !component.updateAvailable)
                }
                primary={!component.installed || component.updateAvailable}
                onClick={() => act(true)}
              >
                {t(
                  component.installed
                    ? "settings.mi.update"
                    : "settings.mi.install",
                )}
              </Button>
              <Button
                ghost={true}
                disabled={busy}
                onClick={() => window.api.openExternalUrl(component.source)}
              >
                {t("settings.mi.source")}
              </Button>
            </Row>
          ))}
          <MiForkSettings state={state.fork} busy={busy || state.busy} onApply={() => changeFork(false)} onRestore={() => changeFork(true)} onOpenLauncher={openLauncher} />
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
        </React.Fragment>
      )}
    </Section>
  );
}
