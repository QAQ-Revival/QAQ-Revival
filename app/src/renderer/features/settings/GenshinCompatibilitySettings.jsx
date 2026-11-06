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
function getLevels() {
  return {
    error: t("settings.genshin.check.needsFix"),
    warning: t("settings.genshin.check.needsReview"),
    info: t("settings.genshin.check.information"),
    ok: t("settings.genshin.check.passed"),
  };
}
const LEVEL_BADGES = {
  error: "badge-danger",
  warning: "badge-warning",
  info: "badge-info",
  ok: "badge-success",
};
function CheckRow({ item }) {
  return (
    <div
      className="compatibility-check"
      data-check-id={item.id}
      data-level={item.level}
    >
      <span className={`badge ${LEVEL_BADGES[item.level] || ""}`.trim()}>
        {getLevels()[item.level]}
      </span>
      <div className="compatibility-check-copy">
        <strong>{item.title}</strong>
        <p>{item.message}</p>
        {item.path && <code title={item.path}>{item.path}</code>}
      </div>
    </div>
  );
}
function GenshinCompatibilitySettings({ onPathsChanged }) {
  const [data, setData] = React.useState(null),
    [selected, setSelected] = React.useState([]);
  const [args, setArgs] = React.useState(""),
    [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(""),
    [message, setMessage] = React.useState("");
  const alive = React.useRef(true),
    pending = React.useRef(false);
  async function run(action) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await action();
      if (result?.canceled) return;
      check(result);
      if (!alive.current) return;
      if (result.checks) {
        setData(result);
        setSelected(result.repairs.map((item) => item.id));
        setArgs(result.launchArgs || "");
      }
      if (result.message) setMessage(result.message);
      if (result.pathsChanged) onPathsChanged?.();
    } catch (e) {
      if (alive.current) setError(e.message);
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  }
  React.useEffect(() => {
    alive.current = true;
    run(() => window.api.genshinCheckEnvironment());
    return () => {
      alive.current = false;
    };
  }, []);
  const passed = data?.checks.filter((item) => item.level === "ok") || [];
  const flagged = data?.checks.filter((item) => item.level !== "ok") || [];
  return (
    <Section
      id="genshin-compatibility"
      title={t("settings.game.compatibility")}
      actions={
        <React.Fragment>
          <Button
            small={true}
            disabled={busy || !data}
            onClick={() => run(() => window.api.genshinExportCheck())}
          >
            {t("settings.genshin.check.exportReport")}
          </Button>
          <Button
            small={true}
            disabled={busy}
            onClick={() => run(() => window.api.genshinCheckEnvironment())}
          >
            {busy
              ? t("settings.updates.checking")
              : t("settings.genshin.check.recheck")}
          </Button>
        </React.Fragment>
      }
    >
      {error && (
        <Notice kind="danger" role="alert">
          {error}
        </Notice>
      )}
      {message && (
        <Notice kind="success" role="status">
          {message}
        </Notice>
      )}
      {data && (
        <React.Fragment>
          <p className="compatibility-summary" role="status">
            {t("settings.genshin.check.summary", {
              errors: data.summary.errors,
              warnings: data.summary.warnings,
              passed: data.summary.passed,
            })}
          </p>
          <div className="compatibility-checks">
            {flagged.map((item) => (
              <CheckRow key={item.id} item={item} />
            ))}
          </div>
          {passed.length > 0 && (
            <details className="settings-disclosure">
              <summary>
                <span>
                  {t("settings.genshin.check.passedGroup", {
                    count: passed.length,
                  })}
                </span>
              </summary>
              <div className="compatibility-checks">
                {passed.map((item) => (
                  <CheckRow key={item.id} item={item} />
                ))}
              </div>
            </details>
          )}
          {data.repairs.length > 0 && (
            <Row
              title={t("settings.genshin.check.repairablePaths")}
              description={t("settings.genshin.check.syncPathsHint")}
              stacked={true}
            >
              <div className="compatibility-repairs">
                {data.repairs.map((item) => (
                  <label key={item.id}>
                    <input
                      type="checkbox"
                      checked={selected.includes(item.id)}
                      disabled={busy}
                      onChange={(e) =>
                        setSelected((previous) =>
                          e.target.checked
                            ? [...previous, item.id]
                            : previous.filter((id) => id !== item.id),
                        )
                      }
                    />
                    <span>
                      <strong>{item.title}</strong>
                      <code>{item.before}</code>
                      <span aria-hidden={true}>{" → "}</span>
                      <code>{item.after}</code>
                    </span>
                  </label>
                ))}
              </div>
              <Button
                primary={true}
                disabled={busy || !selected.length}
                onClick={() =>
                  run(() =>
                    window.api.genshinRepairEnvironment({
                      revision: data.revision,
                      ids: selected,
                    }),
                  )
                }
              >
                {t("settings.genshin.check.backupAndSync")}
              </Button>
            </Row>
          )}
          <Row
            title={t("settings.genshin.check.restorePaths")}
            hint={t("settings.genshin.check.restoreHint")}
          >
            <Button
              disabled={busy || !data.canRestore}
              onClick={() =>
                run(() =>
                  window.api.genshinRestoreEnvironment({
                    revision: data.revision,
                  }),
                )
              }
            >
              {t("settings.genshin.check.restoreAction")}
            </Button>
          </Row>
          <Row
            title={t("settings.genshin.check.beforeLaunch")}
            hint={t("settings.genshin.check.beforeLaunchHint")}
          >
            <Switch
              label={t("settings.genshin.check.beforeLaunchLabel")}
              checked={data.preflightEnabled}
              disabled={busy}
              onChange={(enabled) =>
                run(() =>
                  window.api.genshinUpdateCheckSettings({
                    preflightEnabled: enabled,
                  }),
                )
              }
            />
          </Row>
          <details className="compatibility-advanced settings-disclosure">
            <summary>
              <span>{t("settings.genshin.check.launchArguments")}</span>
            </summary>
            <p className="settings-footnote">
              {t("settings.genshin.check.argumentsHint")}
            </p>
            <div className="path-control">
              <input
                className="input settings-mono-input"
                aria-label={t("settings.genshin.check.argumentsLabel")}
                value={args}
                maxLength={2048}
                disabled={busy}
                onChange={(e) => setArgs(e.target.value)}
              />
              <Button
                disabled={busy || args === data.launchArgs}
                onClick={() =>
                  run(() =>
                    window.api.genshinUpdateCheckSettings({
                      launchArgs: args,
                    }),
                  )
                }
              >
                {t("common.actions.save")}
              </Button>
            </div>
          </details>
          <details className="compatibility-logs settings-disclosure">
            <summary>
              <span>{t("settings.genshin.check.logClues")}</span>
            </summary>
            {!data.logs.length ? (
              <p className="settings-footnote">
                {t("settings.genshin.check.noLogs")}
              </p>
            ) : (
              data.logs.map((log) => (
                <div key={log.name} className="compatibility-log">
                  <strong>{log.name}</strong>
                  <p>
                    {t("settings.genshin.check.logModified", {
                      value: new Date(log.modifiedAt).toLocaleString(),
                      status: log.tailOnly
                        ? t("settings.genshin.check.logTailSuffix")
                        : "",
                    })}
                  </p>
                  {log.hints.length ? (
                    log.hints.map((hint) => (
                      <p key={hint.id}>
                        {t("settings.genshin.check.logFinding", {
                          title: hint.title,
                          count: hint.count,
                          advice: hint.advice,
                        })}
                      </p>
                    ))
                  ) : (
                    <p>{t("settings.genshin.check.noLogFindings")}</p>
                  )}
                </div>
              ))
            )}
          </details>
        </React.Fragment>
      )}
    </Section>
  );
}
export { GenshinCompatibilitySettings };
