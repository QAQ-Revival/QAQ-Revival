import { t } from "../../shared/i18n/index.mjs";
import React from "react";
import { Icon } from "./Icon.jsx";
import {
  isBatchFolderPlanItem,
  getBatchImportDisplayPath,
  getPlanSelectedMode,
  getBatchPlanModeLabel,
  getSelectedBatchPlanItems,
} from "../lib/batchImportPlan.js";
import {
  getManagedInstallOptions,
  normalizeInstallContentType,
} from "../lib/managedInstall.js";

// Shared presentation for the two import reviews (whole library and single character).
// Phase handling and state stay in the dialogs that own them.
const BUSY_PHASES = ["importing", "decrypting"];
const STEPS = ["stepSelect", "stepAnalyze", "stepConfirm", "stepInstall"];
const STEP_BY_PHASE = {
  scan: 0,
  decrypting: 1,
  classify: 2,
  importing: 3,
  done: 4,
};
// Scan types that do not fit the type column.
const SHORT_TYPES = {
  "integrated-package": "pkg",
  "pak-folder": "pak",
  "folder-plan": "folder",
};

export function isImportBusy(phase) {
  return BUSY_PHASES.includes(phase);
}

export function ImportFrame({ title, phase, onClose, className = "", children }) {
  const busy = isImportBusy(phase);
  const current = STEP_BY_PHASE[phase] ?? 0;
  React.useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape" && !event.defaultPrevented && !busy) onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [busy, onClose]);
  return (
    <div
      className="batch-import-overlay"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        className={`batch-import-card ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="batch-import-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="batch-import-header">
          <h2 id="batch-import-title" className="batch-import-title">
            {title}
          </h2>
          <ol className="batch-import-steps">
            {STEPS.map((step, index) => (
              <li
                className={
                  index === current ? "is-current" : index < current ? "is-done" : ""
                }
                key={step}
              >
                {t(`characters.import.${step}`)}
              </li>
            ))}
          </ol>
          <button
            type="button"
            className="icon-btn icon-btn-sm"
            aria-label={t("common.actions.close")}
            title={t("common.actions.close")}
            disabled={busy}
            onClick={onClose}
          >
            <Icon name="x" size={15} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

export function ImportFooter({ children }) {
  return <footer className="batch-import-footer">{children}</footer>;
}

// Tri-state checkbox that toggles every selectable row.
export function ImportSummary({ allChecked, someChecked, onToggleAll, text, aside, children }) {
  const inputRef = React.useRef(null);
  React.useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = someChecked && !allChecked;
  }, [allChecked, someChecked]);
  return (
    <div className="batch-import-summary">
      <label className="batch-import-summary-main">
        <input
          ref={inputRef}
          type="checkbox"
          checked={allChecked}
          onChange={(e) => onToggleAll(e.target.checked)}
          aria-label={t("common.actions.selectAll")}
        />
        <span>{text}</span>
      </label>
      {children}
      {aside && (
        <span className="batch-import-summary-aside" title={aside}>
          {aside}
        </span>
      )}
    </div>
  );
}

function findPlanOption(options, selectedId, defaultId) {
  const list = options || [];
  return (
    list.find((option) => option.id === selectedId) ||
    list.find((option) => option.id === defaultId) ||
    list[0]
  );
}

// How to read a scanned folder and at which depth. Hidden when only one reading exists.
function PlanControls({ item, onModeChange, onItemChange }) {
  const plan = item.importPlan;
  const mode = getPlanSelectedMode(item);
  const split = findPlanOption(
    plan.splitOptions,
    item.selectedSplitOptionId,
    plan.defaultSplitOptionId,
  );
  const integrated = findPlanOption(
    plan.integratedOptions,
    item.selectedIntegratedOptionId,
    plan.defaultIntegratedOptionId,
  );
  return (
    <span className="batch-import-plan-controls">
      {mode === "multiple" && split && (
        <select
          className="select batch-import-plan-level"
          aria-label={t("characters.import.level")}
          title={split.description}
          value={split.id}
          onChange={(e) => onItemChange({ selectedSplitOptionId: e.target.value })}
        >
          {(plan.splitOptions || []).map((option) => (
            <option value={option.id} key={option.id}>
              {t("characters.import.levelOption", {
                label: option.label,
                itemCount: option.itemCount,
                status: option.pathLabel ? ` · ${option.pathLabel}` : "",
              })}
            </option>
          ))}
        </select>
      )}
      {mode === "integrated" && integrated && (
        <select
          className="select batch-import-plan-level"
          aria-label={t("characters.import.integratedLevel")}
          title={integrated.description}
          value={integrated.id}
          onChange={(e) => onItemChange({ selectedIntegratedOptionId: e.target.value })}
        >
          {(plan.integratedOptions || []).map((option) => (
            <option value={option.id} key={option.id}>
              {option.label}
              {option.pathLabel ? ` · ${option.pathLabel}` : ""}
            </option>
          ))}
        </select>
      )}
      <select
        className="select batch-import-plan-mode"
        aria-label={t("characters.import.mode")}
        title={t("characters.import.detectedMode", {
          batchPlanModeLabel: getBatchPlanModeLabel(plan.defaultMode),
        })}
        value={mode}
        onChange={(e) => onModeChange(item, e.target.value)}
      >
        <option value="single">{t("characters.import.singleMod")}</option>
        <option value="multiple" disabled={!plan.splitOptions?.length}>
          {t("characters.import.multipleMods")}
        </option>
        <option value="integrated" disabled={!plan.integratedOptions?.length}>
          {t("characters.import.integratedPackage")}
        </option>
      </select>
    </span>
  );
}

function PreviewKind({ item }) {
  if (item.forceIntegratedPackage || item.integratedPackageCandidate) {
    return <span className="badge badge-info">{t("characters.import.integratedPackage")}</span>;
  }
  if (item.disguised) {
    return <span className="badge badge-info">{t("characters.import.encryptedMod")}</span>;
  }
  return null;
}

// Every source becomes one row. A folder read as several Mods becomes a heading and its rows.
export function ImportScanList({ items, gameId, onModeChange, onItemChange, onSelect }) {
  return items.map((source, sourceIdx) => {
    const previews = getSelectedBatchPlanItems(source);
    const plan = isBatchFolderPlanItem(source) ? source.importPlan : null;
    const hasChoices = !!(plan?.splitOptions?.length || plan?.integratedOptions?.length);
    const controls = hasChoices && (
      <PlanControls
        item={source}
        onModeChange={(item, mode) => onModeChange(sourceIdx, item, mode)}
        onItemChange={(patch) => onItemChange(sourceIdx, patch)}
      />
    );
    const isGroup = hasChoices && getPlanSelectedMode(source) === "multiple";
    return (
      <React.Fragment key={source.path || sourceIdx}>
        {isGroup && (
          <div className="batch-import-plan">
            <Icon name="folder" size={15} />
            <span className="batch-import-plan-name" title={plan.rootName || source.name}>
              {plan.rootName || source.name}
            </span>
            {controls}
          </div>
        )}
        {previews.map((item, index) => (
          <ImportPreviewRow
            item={item}
            gameId={gameId}
            nested={isGroup}
            controls={isGroup ? null : controls}
            onSelect={(checked) => onSelect(sourceIdx, item, checked)}
            onItemChange={(patch) => onItemChange(sourceIdx, patch)}
            key={`${index}-${item.path || item.name}`}
          />
        ))}
      </React.Fragment>
    );
  });
}

function managedContentPatch(item, value, gameId) {
  const keepsImporter =
    value === "game-package-update" &&
    item.suggestedContentType === "game-package-update";
  return {
    installContentType: value,
    targetGameId: keepsImporter ? item.targetGameId || gameId : gameId,
    importerName: keepsImporter ? item.importerName || "" : "",
    managedTargetPath: "",
    managedTargetLabel: "",
    managedTargetError: "",
  };
}

function ImportPreviewRow({ item, gameId, nested, controls, onSelect, onItemChange }) {
  const displayPath = getBatchImportDisplayPath(item);
  const selected = item.selected !== false;
  const managedNote = item.managedTargetError
    ? item.managedTargetError
    : item.managedTargetLabel
      ? t("characters.import.managedTarget", {
          managedTargetLabel: item.managedTargetLabel,
        })
      : "";
  return (
    <label
      className={`batch-import-item batch-import-preview ${nested ? "is-nested" : ""} ${selected ? "" : "is-off"}`}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={(e) => onSelect(e.target.checked)}
      />
      <span className="batch-import-item-type">{SHORT_TYPES[item.type] || item.type}</span>
      <span className="batch-import-item-main" title={displayPath}>
        <span className="batch-import-item-primary">{item.name}</span>
        {displayPath && displayPath !== item.name && (
          <span className="batch-import-item-path">{displayPath}</span>
        )}
        {managedNote && (
          <span
            className={`batch-import-item-path ${item.managedTargetError ? "is-error" : ""}`}
            title={item.managedTargetPath || item.managedTargetError}
          >
            {managedNote}
          </span>
        )}
      </span>
      <span className="batch-import-row-end">
        {item.suggestedContentType ? (
          <select
            className="select batch-import-content-type"
            value={normalizeInstallContentType(item.installContentType)}
            aria-label={t("characters.import.installModeForName", { name: item.name })}
            onChange={(e) =>
              onItemChange(managedContentPatch(item, e.target.value, gameId))
            }
          >
            {getManagedInstallOptions().map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          <PreviewKind item={item} />
        )}
        {controls}
      </span>
    </label>
  );
}

export function ImportModeSelect({ item, onChange }) {
  const integrated = !!item.installAsIntegratedPackage;
  const multiple = !integrated && !!item.installAsMultipleMods;
  return (
    <select
      className="select batch-import-mode-select"
      value={integrated ? "integrated" : multiple ? "multiple" : "single"}
      aria-label={t("characters.import.installMode")}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="single">{t("characters.import.singleShort")}</option>
      <option
        value="multiple"
        title={
          item.multiModCandidate
            ? t("characters.import.installMultiple")
            : t("characters.import.tryMultiple")
        }
      >
        {t("characters.import.multipleShort")}
      </option>
      <option value="integrated">{t("characters.import.integratedPackage")}</option>
    </select>
  );
}

export function ImportFailedRow({ item }) {
  return (
    <div className="batch-import-item batch-import-failed">
      <input type="checkbox" checked={false} disabled={true} aria-label={item.name} />
      <span className="batch-import-item-main">
        <span className="batch-import-item-primary">{item.name}</span>
        <span className="batch-import-item-error selectable">
          {t("characters.import.itemAnalysisFailed", {
            decryptError: item.decryptError,
          })}
        </span>
      </span>
    </div>
  );
}

function StatusIcon({ status }) {
  if (status === "running") return <span className="spinner" aria-hidden="true" />;
  if (status === "done") return <Icon name="check" size={15} className="is-success" />;
  if (status === "error") return <Icon name="x" size={15} className="is-danger" />;
  return <Icon name="minus" size={15} className="is-pending" />;
}

// Each source's analysis state. Pending, running, done and failed share one row shape.
export function ImportAnalysisPhase({ items }) {
  const list = items || [];
  const finished = list.filter((item) =>
    ["done", "error", "skipped"].includes(item.status),
  ).length;
  return (
    <React.Fragment>
      <ImportProgress
        label={t("characters.import.decrypting")}
        done={finished}
        total={list.length}
      />
      <div className="batch-import-body">
        {list.map((item, idx) => (
          <div className="batch-import-item batch-import-analysis" key={idx}>
            <StatusIcon status={item.status} />
            <span className="batch-import-item-main">
              <span className="batch-import-item-primary">{item.name}</span>
              {item.status === "error" ? (
                <span className="batch-import-item-error selectable">{item.error}</span>
              ) : (
                item.importDisplayPath &&
                item.importDisplayPath !== item.name && (
                  <span className="batch-import-item-path">{item.importDisplayPath}</span>
                )
              )}
            </span>
            {item.status === "running" && (
              <span className="batch-import-item-note">
                {item.message || t("common.status.processing")}
              </span>
            )}
            {item.status === "done" && item.realName && item.realName !== item.name && (
              <span className="batch-import-item-note" title={item.realName}>
                {item.realName}
              </span>
            )}
          </div>
        ))}
      </div>
    </React.Fragment>
  );
}

export function ImportProgress({ label, done, total, current }) {
  const width = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="batch-import-progress">
      <div className="batch-import-progress-head">
        <span>{label}</span>
        <span>
          {done}
          {" / "}
          {total}
        </span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${width}%` }} />
      </div>
      {current && (
        <div className="batch-import-progress-current" title={current}>
          {current}
        </div>
      )}
    </div>
  );
}

export function ImportResultsPhase({ results, fallbackCharacter = "", onClose }) {
  const list = results || [];
  const failedCount = list.filter((item) => !item.success).length;
  // Failures come first: they are the only rows that still need attention.
  const ordered = [...list].sort((a, b) => Number(!!a.success) - Number(!!b.success));
  return (
    <React.Fragment>
      <div className={`batch-import-done-summary ${failedCount ? "has-failures" : ""}`}>
        {t("characters.import.resultSummary", {
          filterCount: list.length - failedCount,
          otherFilterCount: failedCount,
        })}
      </div>
      <div className="batch-import-body">
        {ordered.map((item, index) => (
          <div
            className={`batch-import-result-item ${item.success ? "success" : "fail"}`}
            key={index}
          >
            <StatusIcon status={item.success ? "done" : "error"} />
            <span className="batch-import-item-main">
              <span className="batch-import-result-name">{item.modName}</span>
              {!item.success && (
                <span className="batch-import-item-error selectable">{item.error}</span>
              )}
            </span>
            <span className="batch-import-result-char">
              {item.integratedPackage
                ? t("characters.import.overwriteSummary", {
                    characterCount: item.characterCount || 0,
                    modCount: item.modCount || 0,
                  })
                : item.characterName || fallbackCharacter}
            </span>
          </div>
        ))}
      </div>
      <ImportFooter>
        <button type="button" className="btn btn-primary" onClick={onClose}>
          {t("common.actions.finish")}
        </button>
      </ImportFooter>
    </React.Fragment>
  );
}
