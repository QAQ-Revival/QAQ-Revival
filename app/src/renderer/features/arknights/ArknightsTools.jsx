import React from "react";
import ReactDOM from "react-dom";
import { t } from "../../../shared/i18n/index.mjs";
import { Button, Row, PathControl, Section, check } from "../settings/SettingsControls.jsx";

export function ArknightsSettings({ notify }) {
  const [state, setState] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => { window.api.arknightsStatus().then(setState); }, []);
  async function act(action, message) {
    if (busy) return;
    setBusy(true);
    try {
      const result = await action();
      if (result?.canceled) return;
      check(result);
      setState(await window.api.arknightsStatus());
      notify("success", message ? t(message, result) : t("common.status.saved"));
    } catch (error) { notify("error", error.message); }
    finally { setBusy(false); }
  }
  return <Section id="arknights-tools" title={t("arknights.settings.title")}>
    {state?.migrationError && <p className="system-notice" role="alert">{t("settings.mi.legacyMigrationDeferred", { error: state.migrationError })}</p>}
    <Row title={t("arknights.settings.loader")} description={t("arknights.settings.loaderHint")} stacked>
      <PathControl label={t("arknights.settings.loader")} value={state?.loader} disabled={busy}>
        <Button disabled={busy} onClick={() => act(() => window.api.arknightsPrepareLoader(), "arknights.settings.prepared")}>{t("arknights.settings.prepare")}</Button>
      </PathControl>
    </Row>
    <Row title={t("arknights.settings.source")} description={t("arknights.settings.sourceHint")}>
      <Button onClick={() => window.api.openExternalUrl("https://github.com/QAQ-Revival/Arknights-Mod-Tools")}>{t("arknights.settings.viewSource")}</Button>
    </Row>
    <Row title={t("arknights.settings.destination")} description={t("arknights.settings.destinationHint")} stacked>
      <PathControl label={t("arknights.settings.destination")} value={state?.destination} disabled>
        <Button disabled={busy} onClick={() => act(() => window.api.arknightsSync(), "arknights.settings.synced")}>{t("arknights.settings.sync")}</Button>
      </PathControl>
    </Row>
    <p className="system-notice">{t(state?.workerReady ? "arknights.settings.workerReady" : "arknights.settings.workerMissing")}</p>
    <p className="system-notice">{t("arknights.settings.readOnly")}</p>
    <p className="system-notice" role="note">{t("arknights.settings.experimental")}</p>
    {state?.componentError && <p role="alert">{state.componentError}</p>}
    {state?.sync?.error && <p role="alert">{t("arknights.syncFailed", { error: state.sync.error })}</p>}
  </Section>;
}

export function ArknightsLibraryNotice() {
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    let canceled = false;
    const refresh = () => window.api.arknightsStatus().then(state => { if (!canceled) setError(state.sync?.error || ""); });
    refresh();
    const off = window.api.onModsChanged?.(refresh);
    return () => { canceled = true; off?.(); };
  }, []);
  return <div className={`arknights-library-notice${error ? " is-error" : ""}`} role={error ? "alert" : "note"}>{error ? t("arknights.syncFailed", { error }) : t("arknights.libraryHint")}</div>;
}

export function ArknightsToolsDialog({ characterName, mod, onClose, onCreated }) {
  const [report, setReport] = React.useState(null);
  const [busy, setBusy] = React.useState("analyze");
  const [error, setError] = React.useState("");
  const [created, setCreated] = React.useState(null);
  const [revision, setRevision] = React.useState(0);
  const closeRef = React.useRef(null);
  React.useEffect(() => {
    const previous = document.activeElement;
    closeRef.current?.focus();
    return () => previous?.focus?.();
  }, []);
  React.useEffect(() => {
    let canceled = false;
    setBusy("analyze"); setError(""); setReport(null);
    window.api.arknightsAnalyze({ characterName, modName: mod.name }).then(result => {
      check(result);
      if (!canceled) setReport(result);
    }).catch(e => { if (!canceled) setError(e.message); }).finally(() => { if (!canceled) setBusy(""); });
    return () => { canceled = true; };
  }, [characterName, mod.name, revision]);
  async function create() {
    if (busy || !report) return;
    setBusy("create"); setError("");
    try {
      const result = await window.api.arknightsCreateCopy({ token: report.token });
      check(result); setCreated(result); onCreated?.();
    } catch (e) { setError(e.message); }
    finally { setBusy(""); }
  }
  return ReactDOM.createPortal(<div className="arknights-dialog-backdrop" onKeyDown={e => {
    if (e.key === "Escape" && !busy) onClose();
    if (e.key === "Tab") {
      const buttons = [...e.currentTarget.querySelectorAll("button:not(:disabled)")];
      const first = buttons[0], last = buttons.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }
  }}>
    <div className="arknights-dialog" role="dialog" aria-modal="true" aria-labelledby="arknights-tools-title" aria-busy={!!busy}>
      <div className="arknights-dialog-heading"><div><h2 id="arknights-tools-title">{t("arknights.tools")}</h2><p>{characterName} · {mod.name}</p></div><button ref={closeRef} className="btn btn-secondary" disabled={busy === "create"} onClick={onClose}>{t("common.actions.close")}</button></div>
      <p>{t("arknights.copyHint")}</p>
      {busy && <p role="status">{t(busy === "analyze" ? "arknights.analyzing" : "arknights.creating")}</p>}
      {error && <p className="arknights-error" role="alert">{error}</p>}
      {created && <p role="status" className="arknights-result">{t("arknights.created", { name: created.modName, count: created.count })}</p>}
      {report && <>
        <p className="arknights-summary">{t("arknights.summary", { count: report.plans.length, matched: report.matched, renamed: report.renamed })}</p>
        {report.warnings.length > 0 && <ul className="arknights-warnings">{report.warnings.map((warning, index) => <li key={index}>{t(`arknights.warnings.${warning.code}`)}{warning.file ? ` · ${warning.file}` : ""}{warning.asset ? ` · ${warning.asset}` : ""}</li>)}</ul>}
        <div className="arknights-plan"><table><thead><tr><th>{t("arknights.source")}</th><th>{t("arknights.target")}</th><th>{t("arknights.matched")}</th></tr></thead><tbody>{report.plans.map((plan, index) => <tr key={index}><td>{plan.asset}</td><td>{plan.target}</td><td>{t(plan.matched ? "arknights.matched" : "arknights.unverified")}</td></tr>)}</tbody></table></div>
      </>}
      <div className="arknights-dialog-actions">
        <button className="btn btn-secondary" disabled={!!busy} onClick={() => { setCreated(null); setRevision(v => v + 1); }}>{t("arknights.analyzeAgain")}</button>
        <button className="btn btn-primary" disabled={!!busy || !report || !!created || !!report.collisions?.length} onClick={create}>{t(report?.kind === "bundle" ? "arknights.convert" : "arknights.repair")}</button>
      </div>
    </div>
  </div>, document.body);
}
