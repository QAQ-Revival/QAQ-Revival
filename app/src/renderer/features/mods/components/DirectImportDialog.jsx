import { t } from "../../../../shared/i18n/index.mjs";
import {
  expandBatchPlanItems,
  getSelectedBatchPlanItems,
} from "../../../lib/batchImportPlan.js";
import React from "react";
import ReactDOM from "react-dom";
import {
  isManagedInstallContentType,
  getInstallContentTypeLabel,
} from "../../../lib/managedInstall.js";
import { Icon } from "../../../components/Icon.jsx";
import {
  ImportAnalysisPhase,
  ImportFailedRow,
  ImportFooter,
  ImportFrame,
  ImportModeSelect,
  ImportProgress,
  ImportResultsPhase,
  ImportScanList,
  ImportSummary,
} from "../../../components/ImportReview.jsx";

export function DirectImportDialog({
  directImportReview,
  setDirectImportReview,
  directImportHasManagedInstall,
  characterName,
  directImportTargetSectionName,
  setDirectImportPlanScanMode,
  updateDirectImportScanItem,
  setDirectImportPreviewItemSelected,
  activeGameId,
  handleStartDirectImportDecrypt,
  updateDirectClassifyItem,
  setDirectClassifyInstallMode,
  handleStartDirectImportInstall,
}) {
  if (!directImportReview) return null;
  const close = () => setDirectImportReview(null);
  const { phase } = directImportReview;
  return ReactDOM.createPortal(
    <ImportFrame
      className="direct-import-card"
      title={
        directImportHasManagedInstall
          ? t("characters.import.installManagedPackage")
          : t("mods.import.installToSection", {
              characterName,
              directImportTargetSectionName,
            })
      }
      phase={phase}
      onClose={close}
    >
      {phase === "scan" && (
        <ScanPhase
          review={directImportReview}
          hasManagedInstall={directImportHasManagedInstall}
          setPlanMode={setDirectImportPlanScanMode}
          updateScanItem={updateDirectImportScanItem}
          setPreviewSelected={setDirectImportPreviewItemSelected}
          gameId={activeGameId}
          onCancel={close}
          onStart={handleStartDirectImportDecrypt}
        />
      )}
      {phase === "decrypting" && (
        <ImportAnalysisPhase items={directImportReview.decryptProgress} />
      )}
      {phase === "classify" && (
        <ClassifyPhase
          review={directImportReview}
          updateItem={updateDirectClassifyItem}
          setInstallMode={setDirectClassifyInstallMode}
          onCancel={close}
          onStart={handleStartDirectImportInstall}
        />
      )}
      {phase === "importing" && (
        <ImportProgress
          label={t("downloads.status.installing")}
          done={directImportReview.progress ?? 0}
          total={directImportReview.total ?? 0}
          current={directImportReview.currentMod}
        />
      )}
      {phase === "done" && (
        <ImportResultsPhase
          results={directImportReview.results}
          fallbackCharacter={characterName}
          onClose={close}
        />
      )}
    </ImportFrame>,
    document.body,
  );
}

function ScanPhase({
  review,
  hasManagedInstall,
  setPlanMode,
  updateScanItem,
  setPreviewSelected,
  gameId,
  onCancel,
  onStart,
}) {
  const previewItems = expandBatchPlanItems(review.items);
  const selectedCount = previewItems.filter((item) => item.selected).length;
  const rows = review.items.flatMap((sourceItem, sourceIdx) =>
    getSelectedBatchPlanItems(sourceItem).map((item) => ({ item, sourceIdx })),
  );
  return (
    <React.Fragment>
      <ImportSummary
        allChecked={previewItems.length > 0 && selectedCount === previewItems.length}
        someChecked={selectedCount > 0}
        onToggleAll={(checked) =>
          rows.forEach(({ item, sourceIdx }) =>
            setPreviewSelected(sourceIdx, item, checked),
          )
        }
        text={t("characters.import.previewSummary", {
          previewItemsCount: previewItems.length,
          filterCount: selectedCount,
        })}
      />
      <div className="batch-import-body">
        {hasManagedInstall && (
          <div className="notice notice-info batch-import-notice">
            <Icon name="info" size={14} />
            <span>{t("characters.import.managedPackageHint")}</span>
          </div>
        )}
        <ImportScanList
          items={review.items}
          gameId={gameId}
          onModeChange={setPlanMode}
          onItemChange={updateScanItem}
          onSelect={setPreviewSelected}
        />
      </div>
      <ImportFooter>
        <button type="button" className="btn" onClick={onCancel}>
          {t("common.actions.cancel")}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={onStart}
          disabled={selectedCount === 0}
        >
          {t("characters.import.startAnalysis", { filterCount: selectedCount })}
        </button>
      </ImportFooter>
    </React.Fragment>
  );
}

function ClassifyPhase({ review, updateItem, setInstallMode, onCancel, onStart }) {
  const all = review.classifyItems || [];
  const ok = all.filter((item) => item.decryptSuccess);
  const selected = ok.filter((item) => item.selected);
  const managedCount = selected.filter((item) =>
    isManagedInstallContentType(item.installContentType),
  ).length;
  const integratedCount = selected.filter((item) => item.installAsIntegratedPackage).length;
  const failedCount = all.length - ok.length;
  return (
    <React.Fragment>
      <ImportSummary
        allChecked={ok.length > 0 && selected.length === ok.length}
        someChecked={selected.length > 0}
        onToggleAll={(checked) =>
          all.forEach((item, idx) => {
            if (item.decryptSuccess) updateItem(idx, { selected: checked });
          })
        }
        text={t("characters.import.previewSummary", {
          previewItemsCount: all.length,
          filterCount: selected.length,
        })}
      >
        {failedCount > 0 && (
          <span className="badge badge-danger">
            {t("characters.import.summaryFailed", { count: failedCount })}
          </span>
        )}
        {managedCount > 0 && (
          <span className="badge">
            {t("characters.import.summaryManaged", { count: managedCount })}
          </span>
        )}
        {integratedCount > 0 && (
          <span className="badge badge-warning">
            {t("characters.import.summaryIntegrated", { count: integratedCount })}
          </span>
        )}
      </ImportSummary>
      <div className="batch-import-body">
        {all.map((item, idx) => {
          if (!item.decryptSuccess) return <ImportFailedRow item={item} key={idx} />;
          const selectBox = (
            <input
              type="checkbox"
              checked={item.selected}
              aria-label={item.modName || item.name}
              onChange={(e) => updateItem(idx, { selected: e.target.checked })}
            />
          );
          if (isManagedInstallContentType(item.installContentType)) {
            return (
              <div
                className={`batch-import-item batch-import-classify is-managed ${item.selected ? "" : "is-off"}`}
                key={idx}
              >
                {selectBox}
                <span className="batch-import-item-main" title={item.filePath || item.path}>
                  <span className="batch-import-item-primary">
                    {getInstallContentTypeLabel(item.installContentType)}
                  </span>
                  <span className="batch-import-item-path">{item.realName || item.name}</span>
                </span>
                <span
                  className={`batch-import-target-note ${item.managedTargetError ? "is-error" : ""}`}
                  title={item.managedTargetPath || item.managedTargetError}
                >
                  {item.managedTargetError ||
                    item.managedTargetLabel ||
                    t("characters.import.recheckTarget")}
                </span>
              </div>
            );
          }
          const integrated = !!item.installAsIntegratedPackage;
          const multiple = !integrated && !!item.installAsMultipleMods;
          return (
            <div
              className={`batch-import-item batch-import-classify ${item.selected ? "" : "is-off"}`}
              key={idx}
            >
              {selectBox}
              <div className="batch-import-item-main">
                <input
                  className="batch-import-item-name"
                  value={item.modName}
                  readOnly={integrated || multiple}
                  aria-label={t("mods.fields.name")}
                  onChange={(e) =>
                    updateItem(idx, {
                      modName: e.target.value,
                      singleModName: e.target.value,
                    })
                  }
                />
                {item.importDisplayPath && item.importDisplayPath !== item.name && (
                  <span className="batch-import-item-path" title={item.importDisplayPath}>
                    {item.importDisplayPath}
                  </span>
                )}
              </div>
              <ImportModeSelect
                item={item}
                onChange={(mode) => setInstallMode(idx, item, mode)}
              />
              {integrated && (
                <span className="batch-import-target-note is-warning">
                  {t("characters.import.overwriteCurrentMods")}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <ImportFooter>
        <button type="button" className="btn" onClick={onCancel}>
          {t("common.actions.cancel")}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={onStart}
          disabled={selected.length === 0}
        >
          {t("characters.import.startInstallation", { count: selected.length })}
        </button>
      </ImportFooter>
    </React.Fragment>
  );
}
