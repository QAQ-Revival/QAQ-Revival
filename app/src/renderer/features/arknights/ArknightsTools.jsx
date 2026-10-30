import React from "react";
import ReactDOM from "react-dom";
import { t } from "../../../shared/i18n/index.mjs";
import { Icon } from "../../components/Icon.jsx";
import {
  Button,
  Notice,
  Row,
  PathControl,
  Section,
  check,
} from "../settings/SettingsControls.jsx";
import { ArknightsCursorSettings } from "./ArknightsCursorSettings.jsx";

export function ArknightsSettings({ notify, gamePath }) {
  const [state, setState] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    window.api.arknightsStatus().then(setState);
  }, [gamePath]);
  async function act(action, message) {
    if (busy) return;
    setBusy(true);
    try {
      const result = await action();
      if (result?.canceled) return;
      check(result);
      setState(await window.api.arknightsStatus());
      notify("success", message ? t(message, result) : t("common.status.saved"));
    } catch (error) {
      notify("error", error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <ArknightsCursorSettings key={gamePath || ""} notify={notify} />
      <Section id="arknights-tools" title={t("arknights.settings.title")}>
        {state?.migrationError && (
          <Notice kind="warning" role="alert">
            {t("settings.mi.legacyMigrationDeferred", {
              error: state.migrationError,
            })}
          </Notice>
        )}
        <Row
          title={t("arknights.settings.loader")}
          hint={t("arknights.settings.loaderHint")}
          path={true}
        >
          <PathControl
            label={t("arknights.settings.loader")}
            value={state?.loader}
            disabled={busy}
          >
            <Button
              disabled={busy}
              onClick={() =>
                act(
                  () => window.api.arknightsPrepareLoader(),
                  "arknights.settings.prepared",
                )
              }
            >
              {t("arknights.settings.prepare")}
            </Button>
          </PathControl>
        </Row>
        <Row
          title={t("arknights.settings.destination")}
          hint={t("arknights.settings.destinationHint")}
          path={true}
        >
          <PathControl
            label={t("arknights.settings.destination")}
            value={state?.destination}
            disabled={busy}
          >
            <Button
              disabled={busy}
              onClick={() =>
                act(() => window.api.arknightsSync(), "arknights.settings.synced")
              }
            >
              {t("arknights.settings.sync")}
            </Button>
          </PathControl>
        </Row>
        <Row
          title={t("arknights.settings.source")}
          hint={t("arknights.settings.sourceHint")}
        >
          <Button
            onClick={() =>
              window.api.openExternalUrl(
                "https://github.com/QAQ-Revival/Arknights-Mod-Tools",
              )
            }
          >
            {t("arknights.settings.viewSource")}
          </Button>
        </Row>
        {state && !state.workerReady && (
          <Notice kind="warning">{t("arknights.settings.workerMissing")}</Notice>
        )}
        {state?.componentError && (
          <Notice kind="danger" role="alert">
            {state.componentError}
          </Notice>
        )}
        {state?.sync?.error && (
          <Notice kind="danger" role="alert">
            {t("arknights.syncFailed", { error: state.sync.error })}
          </Notice>
        )}
        <p className="settings-footnote">{t("arknights.settings.readOnly")}</p>
      </Section>
    </>
  );
}

export function ArknightsLibraryNotice() {
  const [error, setError] = React.useState("");
  const [dismissed, setDismissed] = React.useState(false);
  React.useEffect(() => {
    let canceled = false;
    const refresh = () =>
      window.api.arknightsStatus().then((state) => {
        if (!canceled) setError(state.sync?.error || "");
      });
    refresh();
    const off = window.api.onModsChanged?.(refresh);
    return () => {
      canceled = true;
      off?.();
    };
  }, []);
  if (dismissed && !error) return null;
  return (
    <div
      className={`notice ${error ? "notice-danger" : ""} arknights-library-notice${error ? " is-error" : ""}`}
      role={error ? "alert" : "note"}
    >
      <Icon name={error ? "alert" : "info"} size={14} />
      <span>
        {error ? t("arknights.syncFailed", { error }) : t("arknights.libraryHint")}
      </span>
      {!error && (
        <button
          type="button"
          className="icon-btn icon-btn-sm"
          title={t("common.actions.dismissNotice")}
          aria-label={t("common.actions.dismissNotice")}
          onClick={() => setDismissed(true)}
        >
          <Icon name="x" size={14} />
        </button>
      )}
    </div>
  );
}

export function ArknightsToolsDialog({ characterName, mod, onClose, onCreated }) {
  const [report, setReport] = React.useState(null);
  const [busy, setBusy] = React.useState("analyze");
  const [error, setError] = React.useState("");
  const [created, setCreated] = React.useState(null);
  const [revision, setRevision] = React.useState(0);
  const [selected, setSelected] = React.useState(new Set());
  const closeRef = React.useRef(null);
  React.useEffect(() => {
    const previous = document.activeElement;
    closeRef.current?.focus();
    return () => previous?.focus?.();
  }, []);
  React.useEffect(() => {
    let canceled = false;
    setBusy("analyze");
    setError("");
    setReport(null);
    window.api
      .arknightsAnalyze({ characterName, modName: mod.name })
      .then((result) => {
        check(result);
        if (!canceled) {
          setReport(result);
          const scopes = new Set(
            result.plans.map((plan) => plan.appearanceSectionId),
          );
          setSelected(
            new Set(
              result.plans
                .filter(
                  (plan) =>
                    result.kind !== "bundle" ||
                    (scopes.size === 1 &&
                      plan.matched &&
                      plan.comparison !== "identical" &&
                      !plan.extraTexture),
                )
                .map((plan) => plan.id),
            ),
          );
        }
      })
      .catch((e) => {
        if (!canceled) setError(e.message);
      })
      .finally(() => {
        if (!canceled) setBusy("");
      });
    return () => {
      canceled = true;
    };
  }, [characterName, mod.name, revision]);
  async function create() {
    if (busy || !report) return;
    setBusy("create");
    setError("");
    try {
      const result = await window.api.arknightsCreateCopy({
        token: report.token,
        selectedIds: [...selected],
      });
      check(result);
      setCreated(result);
      onCreated?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  const groups = report
    ? report.sections.filter((section) =>
        report.plans.some((plan) => plan.appearanceSectionId === section.id),
      )
    : [];
  function selectPlans(plans, enabled) {
    setSelected((previous) => {
      const next = new Set(previous);
      for (const plan of plans) {
        if (enabled) next.add(plan.id);
        else next.delete(plan.id);
      }
      return next;
    });
  }
  return ReactDOM.createPortal(
    <div
      className="modal-backdrop"
      onKeyDown={(e) => {
        if (e.key === "Escape" && !busy) onClose();
        if (e.key === "Tab") {
          const buttons = [
            ...e.currentTarget.querySelectorAll(
              "button:not(:disabled), input:not(:disabled)",
            ),
          ];
          const first = buttons[0],
            last = buttons.at(-1);
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      }}
    >
      <div
        className="modal-content arknights-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="arknights-tools-title"
        aria-busy={!!busy}
      >
        <div className="arknights-dialog-heading">
          <div className="arknights-dialog-title">
            <div id="arknights-tools-title" className="dialog-title">
              {t("arknights.tools")}
            </div>
            <div className="dialog-desc">
              {characterName} · {mod.name}
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="icon-btn"
            title={t("common.actions.close")}
            aria-label={t("common.actions.close")}
            disabled={busy === "create"}
            onClick={onClose}
          >
            <Icon name="x" size={16} />
          </button>
        </div>
        <p className="arknights-hint">{t("arknights.copyHint")}</p>
        {busy && (
          <p className="arknights-status" role="status">
            <span className="spinner" />
            {t(busy === "analyze" ? "arknights.analyzing" : "arknights.creating")}
          </p>
        )}
        {error && (
          <div className="notice notice-danger arknights-error" role="alert">
            <Icon name="alert" size={14} />
            <span>{error}</span>
          </div>
        )}
        {created && (
          <div className="notice notice-success arknights-result" role="status">
            <Icon name="check" size={14} />
            <span>
              {t("arknights.created", {
                name: created.modName,
                count: created.count,
              })}
            </span>
          </div>
        )}
        {report && (
          <>
            <p className="arknights-summary">
              {t("arknights.summary", {
                count: report.plans.length,
                matched: report.matched,
                renamed: report.renamed,
              })}
            </p>
            {report.kind === "bundle" && (
              <p className="arknights-hint">{t("arknights.selectionHint")}</p>
            )}
            <div className="arknights-resource-groups">
              {groups.map((group) => {
                const plans = report.plans.filter(
                  (plan) => plan.appearanceSectionId === group.id,
                );
                return (
                  <label key={group.id}>
                    <input
                      type="checkbox"
                      disabled={!!busy || !!created}
                      checked={plans.every((plan) => selected.has(plan.id))}
                      onChange={(event) =>
                        selectPlans(plans, event.target.checked)
                      }
                    />
                    {group.name} ({plans.length})
                  </label>
                );
              })}
            </div>
            <div className="arknights-selection-actions">
              <button
                type="button"
                className="btn btn-sm"
                disabled={!!busy || !!created}
                onClick={() =>
                  setSelected(
                    new Set(
                      report.plans
                        .filter((plan) => plan.comparison !== "identical")
                        .map((plan) => plan.id),
                    ),
                  )
                }
              >
                {t("arknights.selectDifferences")}
              </button>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                disabled={!!busy || !!created}
                onClick={() => setSelected(new Set())}
              >
                {t("arknights.clearSelection")}
              </button>
              <span>{t("arknights.selectedCount", { count: selected.size })}</span>
            </div>
            {report.warnings.length > 0 && (
              <div className="notice notice-warning arknights-warnings">
                <Icon name="alert" size={14} />
                <ul>
                  {report.warnings.map((warning, index) => (
                    <li key={index}>
                      {t(`arknights.warnings.${warning.code}`)}
                      {warning.file ? ` · ${warning.file}` : ""}
                      {warning.asset ? ` · ${warning.asset}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="arknights-plan">
              <table>
                <thead>
                  <tr>
                    <th>{t("arknights.include")}</th>
                    <th>{t("arknights.source")}</th>
                    <th>{t("arknights.target")}</th>
                    <th>{t("arknights.comparisonTitle")}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.plans.map((plan) => (
                    <tr key={plan.id}>
                      <td className="arknights-select-cell">
                        <input
                          type="checkbox"
                          aria-label={t("arknights.selectResource", {
                            name: plan.resource || plan.target,
                          })}
                          disabled={!!busy || !!created}
                          checked={selected.has(plan.id)}
                          onChange={(event) =>
                            selectPlans([plan], event.target.checked)
                          }
                        />
                      </td>
                      <td>
                        {plan.asset}
                        <small>
                          {
                            report.sections.find(
                              (section) =>
                                section.id === plan.appearanceSectionId,
                            )?.name
                          }
                        </small>
                      </td>
                      <td>
                        {plan.resource || plan.target}
                        {plan.bundle && <small>{plan.bundle}</small>}
                      </td>
                      <td>
                        {t(`arknights.comparison.${plan.comparison || "unknown"}`)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <div className="dialog-actions">
          <button
            type="button"
            className="btn"
            disabled={!!busy}
            onClick={() => {
              setCreated(null);
              setRevision((v) => v + 1);
            }}
          >
            {t("arknights.analyzeAgain")}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={
              !!busy ||
              !report ||
              !selected.size ||
              !!created ||
              !!report.collisions?.length
            }
            onClick={create}
          >
            {t(report?.kind === "bundle" ? "arknights.convert" : "arknights.repair")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
