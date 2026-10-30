import { t } from "../../../shared/i18n/index.mjs";
import React from "react";
import {
  Button,
  Notice,
  Section,
  Row,
  Switch,
  check,
} from "./SettingsControls.jsx";
function getInjectModes() {
  return [
    {
      value: "default",
      label: t("settings.genshin.injection.followXxmi"),
      desc: t("settings.genshin.injection.unchanged"),
    },
    {
      value: "hook",
      label: "Hook",
      desc: t("settings.genshin.injection.globalHook"),
    },
    {
      value: "direct",
      label: "Direct",
      desc: t("settings.genshin.injection.direct"),
    },
  ];
}
function getPrimaryModes() {
  return [
    {
      value: "twin",
      label: t("settings.genshin.plan.twin"),
      tag: t("settings.genshin.plan.randomCopy"),
      description: t("settings.genshin.plan.twinDescription"),
    },
    {
      value: "custom",
      label: t("settings.genshin.plan.customComponent"),
      tag: t("settings.genshin.plan.fixedDirect"),
      description: t("settings.genshin.plan.customDescription"),
    },
  ];
}
function GenshinAntiErrorSettings({ onPathsChanged }) {
  const [data, setData] = React.useState(null);
  const [error, setError] = React.useState(""),
    [message, setMessage] = React.useState("");
  const [saveStatus, setSaveStatus] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [advancedOpen, setAdvancedOpen] = React.useState(false);
  const pending = React.useRef(false),
    alive = React.useRef(true);
  React.useEffect(() => {
    if (data?.session?.createdAt) {
      setMessage("");
      setError("");
    }
  }, [data?.session?.createdAt]);
  React.useEffect(() => {
    alive.current = true;
    run(() => window.api.genshinGetAntiCrash());
    // Sessions start from the launch card outside this panel; refresh quietly when state changes.
    const timer = setInterval(() => {
      if (pending.current) return;
      window.api
        .genshinGetAntiCrash()
        .then((result) => {
          if (!alive.current || !result?.settings) return;
          setData((previous) =>
            previous && previous.revision === result.revision
              ? previous
              : result,
          );
        })
        .catch(() => {});
    }, 2500);
    return () => {
      alive.current = false;
      clearInterval(timer);
    };
  }, []);
  async function run(action, saving = false) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    if (saving) setSaveStatus(t("common.status.saving"));
    try {
      const result = await action();
      if (result?.canceled) return;
      check(result);
      if (!alive.current) return;
      if (result.settings) setData(result);
      if (saving) setSaveStatus(t("settings.genshin.savedForNextLaunch"));
      if (!saving && result.message) setMessage(result.message);
      else if (result.notes?.length) setMessage(result.notes.join("；"));
      if (result.pathsChanged) onPathsChanged?.();
    } catch (e) {
      if (alive.current) {
        setError(e.message);
        if (saving) setSaveStatus("");
      }
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  }
  const save = (updates) =>
    run(() => window.api.genshinUpdateAntiCrash(updates), true);
  const settings = data?.settings || {
    twin: false,
    manualStart: false,
    injectMode: "default",
    networkBlock: false,
    originalDll: false,
    customDll: false,
  };
  const conflicting = settings.twin && settings.customDll;
  const primaryMode = conflicting
    ? ""
    : settings.twin
      ? "twin"
      : settings.customDll
        ? "custom"
        : "none";
  const selectPrimary = (mode) =>
    save({
      twin: mode === "twin",
      customDll: mode === "custom",
    });
  async function pickCustomDll() {
    if (busy) return;
    try {
      const selected = await window.api.genshinSelectCustomDll();
      if (selected?.canceled) return;
      check(selected);
      await save({
        customDllPath: selected.path,
      });
    } catch (e) {
      setError(e.message);
    }
  }
  const session = data?.session;
  const advancedSummary = [
    settings.customDll
      ? t("settings.genshin.injection.fixedByPlan")
      : getInjectModes().find((mode) => mode.value === settings.injectMode)
          ?.label,
    settings.manualStart ? t("settings.genshin.manual.waiting") : "",
    settings.networkBlock
      ? t("settings.genshin.network.enabled")
      : t("settings.genshin.network.disabled"),
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Section
      id="genshin-anticrash"
      title={
        <React.Fragment>
          {t("settings.game.antiError")}
          <span className="settings-save-status" role="status">
            {saveStatus}
          </span>
        </React.Fragment>
      }
    >
      {!data && (
        <div className="settings-state" role="status">
          <span className="spinner" />
          {t("settings.genshin.loading")}
        </div>
      )}
      {error && (
        <Notice kind="danger" role="alert">
          {error}
        </Notice>
      )}
      {message && (
        <Notice className="anticrash-feedback" role="status">
          {message}
        </Notice>
      )}
      {data && (
        <React.Fragment>
          {!data.ready && (
            <Notice kind="warning" role="alert">
              {t("settings.genshin.blockedHint", {
                blockers: data.blockers.join("；"),
              })}
            </Notice>
          )}
          {session && (
            <div
              className="anticrash-live"
              role="region"
              aria-label={t("settings.genshin.session.title")}
            >
              <div className="anticrash-live-heading">
                <strong>{t("settings.genshin.session.title")}</strong>
                <span className="anticrash-hint">
                  {t("settings.genshin.session.startedAt", {
                    value: new Date(session.createdAt).toLocaleString(),
                  })}
                </span>
                <Button
                  small={true}
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const result = await window.api.genshinAntiCrashCleanup();
                      check(result);
                      const fresh = await window.api.genshinGetAntiCrash();
                      check(fresh);
                      return {
                        ...fresh,
                        message: result.cleaned
                          ? t("settings.genshin.session.cleaned")
                          : result.notes?.join("；") ||
                            t("settings.genshin.session.cleanupFailed"),
                      };
                    })
                  }
                >
                  {t("settings.genshin.session.cleanNow")}
                </Button>
              </div>
              <div
                className="anticrash-session"
                data-twin-ready={session.twinReady}
              >
                <p>
                  {t("settings.genshin.session.planSummary", {
                    status: session.dllSwap
                      ? t("settings.genshin.plan.customComponent")
                      : session.twinName
                        ? t("settings.genshin.plan.twin")
                        : t("settings.genshin.plan.disabled"),
                    label:
                      getInjectModes().find(
                        (mode) => mode.value === session.injectMode,
                      )?.label || t("settings.genshin.injection.followXxmi"),
                    otherStatus:
                      session.injectMode === "default" &&
                      session.effectiveInjectMode
                        ? `（${session.effectiveInjectMode === "HOOK" ? "Hook" : session.effectiveInjectMode === "DIRECT" ? "Direct" : session.effectiveInjectMode}）`
                        : "",
                  })}
                </p>
                {session.launcherName && (
                  <p>
                    {t("settings.genshin.session.randomLauncherPrefix")}
                    <code>{session.launcherName}</code>
                    {t("settings.genshin.session.hookNameSynced")}
                  </p>
                )}
                {session.twinName && (
                  <p>
                    {t("settings.genshin.session.randomCopyPrefix")}
                    <code title={session.twinPath}>{session.twinName}</code>
                    {session.twinReady
                      ? t("settings.genshin.session.readySuffix")
                      : t("settings.genshin.session.fileChangedSuffix")}
                  </p>
                )}
                {session.dllSwap && (
                  <p>
                    {t("settings.genshin.session.customComponentPrefix")}
                    <code>
                      {(session.dllSwap.source || "").split(/[\\/]/).pop() ||
                        "d3d11.dll"}
                    </code>
                  </p>
                )}
                {session.originalDll && (
                  <p>
                    {t("settings.genshin.session.originalComponentPrefix")}
                    <code>{"original_d3d11.dll"}</code>
                    {session.originalDll.created
                      ? t("settings.genshin.session.temporaryCopySuffix")
                      : t("settings.genshin.session.existingFileSuffix")}
                  </p>
                )}
                {session.manualStart && (
                  <p>
                    {t("settings.genshin.session.manualLaunchHint", {
                      status: session.twinName
                        ? t("settings.genshin.session.randomCopyTarget")
                        : t("settings.genshin.session.gameTarget"),
                    })}
                  </p>
                )}
                {session.networkBlock && (
                  <p>
                    {t("settings.genshin.session.networkBlocked", {
                      rulesCount: session.rules.length,
                    })}
                  </p>
                )}
              </div>
              <p className="anticrash-hint">
                {session.watcherActive
                  ? t("settings.genshin.session.autoCleanupHint")
                  : t("settings.genshin.session.recoveryKeptHint")}
              </p>
            </div>
          )}
          <fieldset className="anticrash-primary">
            <legend title={t("settings.genshin.plan.description")}>
              {t("settings.genshin.plan.title")}
            </legend>
            {conflicting && (
              <Notice kind="warning" role="alert">
                {t("settings.genshin.plan.conflictingSettings")}
              </Notice>
            )}
            <div className="settings-options">
              <label
                className="settings-option"
                data-selected={primaryMode === "none"}
              >
                <input
                  type="radio"
                  name="genshin-primary-mode"
                  value="none"
                  aria-label={t("settings.genshin.plan.disabledLabel")}
                  checked={primaryMode === "none"}
                  disabled={busy}
                  onChange={() => selectPrimary("none")}
                />
                <span className="settings-option-copy">
                  <strong>{t("settings.genshin.plan.disable")}</strong>
                </span>
              </label>
              {getPrimaryModes().map((mode) => (
                <label
                  key={mode.value}
                  className="settings-option"
                  data-selected={primaryMode === mode.value}
                >
                  <input
                    type="radio"
                    name="genshin-primary-mode"
                    value={mode.value}
                    aria-label={t("settings.genshin.plan.namedLabel", {
                      label: mode.label,
                    })}
                    checked={primaryMode === mode.value}
                    disabled={busy}
                    onChange={() => selectPrimary(mode.value)}
                  />
                  <span className="settings-option-copy">
                    <strong>
                      {mode.label}
                      <span className="badge">{mode.tag}</span>
                    </strong>
                    <span>{mode.description}</span>
                  </span>
                </label>
              ))}
            </div>
            {settings.customDll && (
              <Row
                title={t("settings.genshin.custom.currentComponent")}
                description={
                  data.customDllPath
                    ? t("settings.genshin.custom.directHint", {
                        status: data.customDllPathIsDefault
                          ? t("settings.genshin.custom.bundledComponentHint")
                          : t("settings.genshin.custom.selectedComponentHint"),
                      })
                    : t("settings.genshin.custom.componentRequired")
                }
              >
                <code
                  className="settings-mono-value"
                  title={data.customDllPath || ""}
                >
                  {data.customDllPath
                    ? data.customDllPath.split(/[\\/]/).pop()
                    : t("common.status.unselected")}
                </code>
                <Button disabled={busy} onClick={pickCustomDll}>
                  {t("settings.genshin.custom.selectComponent")}
                </Button>
                {data.customDllPath && !data.customDllPathIsDefault && (
                  <Button
                    disabled={busy}
                    onClick={() =>
                      save({
                        customDllPath: "",
                      })
                    }
                  >
                    {t("common.actions.restoreDefault")}
                  </Button>
                )}
              </Row>
            )}
          </fieldset>
          <div
            className="anticrash-addons"
            role="group"
            aria-label={t("settings.genshin.extras.title")}
          >
            <Row
              title={t("settings.genshin.original.title")}
              description={t("settings.genshin.original.description")}
            >
              <Switch
                label={t("settings.genshin.original.label")}
                checked={settings.originalDll}
                disabled={busy}
                onChange={(value) =>
                  save({
                    originalDll: value,
                  })
                }
              />
            </Row>
            <details
              className="anticrash-advanced settings-disclosure"
              open={advancedOpen}
              onToggle={(e) => setAdvancedOpen(e.currentTarget.open)}
            >
              <summary>
                <span>{t("settings.genshin.manual.title")}</span>
                <span className="settings-disclosure-summary">
                  {advancedSummary}
                </span>
              </summary>
              <Row
                title={t("settings.genshin.manual.waiting")}
                description={t("settings.genshin.manual.description")}
              >
                <Switch
                  label={t("settings.genshin.manual.label")}
                  checked={settings.manualStart}
                  disabled={busy}
                  onChange={(value) =>
                    save({
                      manualStart: value,
                    })
                  }
                />
              </Row>
              <Row
                title={t("settings.genshin.injection.title")}
                description={
                  settings.customDll
                    ? t("settings.genshin.injection.customFixedHint")
                    : t("settings.genshin.injection.description")
                }
              >
                <select
                  className="select settings-compact-select"
                  aria-label={t("settings.genshin.injection.label")}
                  value={settings.customDll ? "direct" : settings.injectMode}
                  disabled={busy || settings.customDll}
                  title={
                    settings.customDll
                      ? t("settings.genshin.injection.customFixedLabel")
                      : getInjectModes().find(
                          (mode) => mode.value === settings.injectMode,
                        )?.desc
                  }
                  onChange={(e) =>
                    save({
                      injectMode: e.target.value,
                    })
                  }
                >
                  {getInjectModes().map((mode) => (
                    <option key={mode.value} value={mode.value}>
                      {mode.label}
                    </option>
                  ))}
                </select>
              </Row>
              <Row
                title={
                  <React.Fragment>
                    {t("settings.genshin.network.title")}
                    <span className="badge badge-warning">
                      {t("settings.genshin.network.testLabel")}
                    </span>
                  </React.Fragment>
                }
                description={
                  data.elevated
                    ? t("settings.genshin.network.description")
                    : t("settings.genshin.network.adminRequired")
                }
              >
                <Switch
                  label={t("settings.genshin.network.label")}
                  checked={settings.networkBlock}
                  disabled={busy || (!data.elevated && !settings.networkBlock)}
                  onChange={(value) =>
                    save({
                      networkBlock: value,
                    })
                  }
                />
              </Row>
              {settings.networkBlock && (
                <Notice kind="warning">
                  {t("settings.genshin.network.activeWarning")}
                </Notice>
              )}
            </details>
          </div>
          <p className="settings-footnote">
            {t("settings.genshin.session.restoreHint")}
          </p>
        </React.Fragment>
      )}
    </Section>
  );
}
export { GenshinAntiErrorSettings };
