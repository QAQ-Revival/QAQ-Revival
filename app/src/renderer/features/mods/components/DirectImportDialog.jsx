import { t } from "../../../../shared/i18n/index.mjs";
import {
  isBatchFolderPlanItem,
  expandBatchPlanItems,
  getBatchImportDisplayPath,
  getPlanSelectedMode,
  getBatchPlanModeLabel,
  getSelectedBatchPlanItems,
} from "../../../lib/batchImportPlan.js";
import React from "react";
import ReactDOM from "react-dom";
import {
  isManagedInstallContentType,
  getManagedInstallOptions,
  normalizeInstallContentType,
  getInstallContentTypeLabel,
} from "../../../lib/managedInstall.js";
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
  return (
    directImportReview &&
    ReactDOM.createPortal(
      <div
        className="batch-import-overlay"
        onClick={() =>
          !["importing", "decrypting"].includes(directImportReview.phase) &&
          setDirectImportReview(null)
        }
      >
        <div
          className="batch-import-card direct-import-card"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="batch-import-header">
            <span className="batch-import-title">
              {directImportHasManagedInstall
                ? t("characters.import.installManagedPackage")
                : t("mods.import.installToSection", {
                    characterName,
                    directImportTargetSectionName,
                  })}
            </span>
            <button
              type="button"
              className="legacy-import-close"
              onClick={() => setDirectImportReview(null)}
              disabled={["importing", "decrypting"].includes(
                directImportReview.phase,
              )}
            >
              {"✕"}
            </button>
          </div>
          {directImportReview.phase === "scan" && (
            <React.Fragment>
              <div className="batch-import-hint">
                {directImportHasManagedInstall ? (
                  <React.Fragment>
                    {t("characters.import.managedPackageHint")}
                  </React.Fragment>
                ) : (
                  <React.Fragment>
                    {t("mods.import.sectionHint", {
                      characterName,
                      directImportTargetSectionName,
                    })}
                  </React.Fragment>
                )}
              </div>
              {directImportReview.items.some((item) =>
                isBatchFolderPlanItem(item),
              ) && (
                <div className="batch-import-plan-list">
                  {directImportReview.items.map((item, idx) => {
                    if (!isBatchFolderPlanItem(item)) return null;
                    const plan = item.importPlan;
                    const selectedMode = getPlanSelectedMode(item);
                    const selectedSplitOption =
                      (plan.splitOptions || []).find(
                        (option) => option.id === item.selectedSplitOptionId,
                      ) ||
                      (plan.splitOptions || []).find(
                        (option) => option.id === plan.defaultSplitOptionId,
                      ) ||
                      (plan.splitOptions || [])[0];
                    const selectedIntegratedOption =
                      (plan.integratedOptions || []).find(
                        (option) =>
                          option.id === item.selectedIntegratedOptionId,
                      ) ||
                      (plan.integratedOptions || []).find(
                        (option) =>
                          option.id === plan.defaultIntegratedOptionId,
                      ) ||
                      (plan.integratedOptions || [])[0];
                    return (
                      <div
                        className="batch-import-plan-card"
                        key={item.path || idx}
                      >
                        <div className="batch-import-plan-head">
                          <div>
                            <div className="batch-import-plan-name">
                              {plan.rootName || item.name}
                            </div>
                            <div className="batch-import-plan-desc">
                              {t("mods.import.detectedTarget", {
                                batchPlanModeLabel: getBatchPlanModeLabel(
                                  plan.defaultMode,
                                ),
                                characterName,
                                directImportTargetSectionName,
                              })}
                            </div>
                          </div>
                          <div
                            className="batch-import-plan-mode"
                            role="group"
                            aria-label={t("characters.import.mode")}
                          >
                            <button
                              type="button"
                              className={
                                selectedMode === "single" ? "active" : ""
                              }
                              onClick={() =>
                                setDirectImportPlanScanMode(idx, item, "single")
                              }
                            >
                              {t("characters.import.singleMod")}
                            </button>
                            <button
                              type="button"
                              className={
                                selectedMode === "multiple" ? "active" : ""
                              }
                              disabled={!plan.splitOptions?.length}
                              onClick={() =>
                                setDirectImportPlanScanMode(
                                  idx,
                                  item,
                                  "multiple",
                                )
                              }
                            >
                              {t("characters.import.multipleMods")}
                            </button>
                            <button
                              type="button"
                              className={
                                selectedMode === "integrated" ? "active" : ""
                              }
                              disabled={!plan.integratedOptions?.length}
                              onClick={() =>
                                setDirectImportPlanScanMode(
                                  idx,
                                  item,
                                  "integrated",
                                )
                              }
                            >
                              {t("characters.import.integratedPackage")}
                            </button>
                          </div>
                        </div>
                        {selectedMode === "multiple" && selectedSplitOption && (
                          <div className="batch-import-plan-row">
                            <span>{t("characters.import.level")}</span>
                            <select
                              value={selectedSplitOption.id}
                              onChange={(e) =>
                                updateDirectImportScanItem(idx, {
                                  selectedSplitOptionId: e.target.value,
                                })
                              }
                            >
                              {(plan.splitOptions || []).map((option) => (
                                <option value={option.id} key={option.id}>
                                  {t("characters.import.levelOption", {
                                    label: option.label,
                                    itemCount: option.itemCount,
                                    status: option.pathLabel
                                      ? ` · ${option.pathLabel}`
                                      : "",
                                  })}
                                </option>
                              ))}
                            </select>
                            <em>{selectedSplitOption.description}</em>
                          </div>
                        )}
                        {selectedMode === "integrated" &&
                          selectedIntegratedOption && (
                            <div className="batch-import-plan-row">
                              <span>
                                {t("characters.import.integratedLevel")}
                              </span>
                              <select
                                value={selectedIntegratedOption.id}
                                onChange={(e) =>
                                  updateDirectImportScanItem(idx, {
                                    selectedIntegratedOptionId: e.target.value,
                                  })
                                }
                              >
                                {(plan.integratedOptions || []).map(
                                  (option) => (
                                    <option value={option.id} key={option.id}>
                                      {option.label}
                                      {option.pathLabel
                                        ? ` · ${option.pathLabel}`
                                        : ""}
                                    </option>
                                  ),
                                )}
                              </select>
                              <em>{selectedIntegratedOption.description}</em>
                            </div>
                          )}
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="batch-import-list-header">
                <span className="direct-import-dialog-column" />
                <span className="direct-import-dialog-type-heading">
                  {t("common.fields.type")}
                </span>
                <span className="direct-import-dialog-content">
                  {t("characters.import.previewContents")}
                </span>
                <span className="direct-import-dialog-scan-mode-heading">
                  {t("characters.import.installMode")}
                </span>
              </div>
              <div className="batch-import-list">
                {directImportReview.items.flatMap((sourceItem, sourceIdx) =>
                  getSelectedBatchPlanItems(sourceItem).map(
                    (item, previewIdx) => (
                      <div
                        className="batch-import-item"
                        key={`${sourceIdx}-${previewIdx}-${item.path || item.name}`}
                      >
                        <input
                          type="checkbox"
                          checked={item.selected !== false}
                          onChange={(e) =>
                            setDirectImportPreviewItemSelected(
                              sourceIdx,
                              item,
                              e.target.checked,
                            )
                          }
                        />
                        <span className="batch-import-item-type">
                          {item.type}
                        </span>
                        <span
                          className="batch-import-item-main"
                          title={getBatchImportDisplayPath(item)}
                        >
                          <span className="batch-import-item-primary">
                            {item.name}
                          </span>
                          <span className="batch-import-item-path">
                            {getBatchImportDisplayPath(item)}
                          </span>
                          {(item.managedTargetLabel ||
                            item.managedTargetError) && (
                            <span
                              className="batch-import-item-path"
                              title={
                                item.managedTargetPath ||
                                item.managedTargetError
                              }
                            >
                              {item.managedTargetError ||
                                t("characters.import.managedTarget", {
                                  managedTargetLabel: item.managedTargetLabel,
                                })}
                            </span>
                          )}
                        </span>
                        {item.suggestedContentType ? (
                          <select
                            value={normalizeInstallContentType(
                              item.installContentType,
                            )}
                            onChange={(event) =>
                              updateDirectImportScanItem(sourceIdx, {
                                installContentType: event.target.value,
                                targetGameId:
                                  event.target.value ===
                                    "game-package-update" &&
                                  item.suggestedContentType ===
                                    "game-package-update"
                                    ? item.targetGameId || activeGameId
                                    : activeGameId,
                                importerName:
                                  event.target.value ===
                                    "game-package-update" &&
                                  item.suggestedContentType ===
                                    "game-package-update"
                                    ? item.importerName || ""
                                    : "",
                                managedTargetPath: "",
                                managedTargetLabel: "",
                                managedTargetError: "",
                              })
                            }
                            aria-label={t(
                              "characters.import.installModeForName",
                              {
                                name: item.name,
                              },
                            )}
                            className="direct-import-dialog-select-field"
                          >
                            {getManagedInstallOptions().map((option) => (
                              <option value={option.value} key={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="batch-import-fixed-target">
                            {item.forceIntegratedPackage ||
                            item.integratedPackageCandidate
                              ? t("characters.import.integratedPackage")
                              : `${characterName} / ${directImportTargetSectionName}`}
                          </span>
                        )}
                      </div>
                    ),
                  ),
                )}
              </div>
              <div className="batch-import-summary">
                {(() => {
                  const previewItems = expandBatchPlanItems(
                    directImportReview.items,
                  );
                  return t("mods.import.selectionSummary", {
                    previewItemsCount: previewItems.length,
                    filterCount: previewItems.filter((item) => item.selected)
                      .length,
                    characterName,
                    directImportTargetSectionName,
                  });
                })()}
              </div>
              <div className="batch-import-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setDirectImportReview(null)}
                >
                  {t("common.actions.cancel")}
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleStartDirectImportDecrypt}
                  disabled={
                    !expandBatchPlanItems(directImportReview.items).some(
                      (item) => item.selected,
                    )
                  }
                >
                  {t("characters.import.startAnalysis", {
                    filterCount: expandBatchPlanItems(
                      directImportReview.items,
                    ).filter((item) => item.selected).length,
                  })}
                </button>
              </div>
            </React.Fragment>
          )}
          {directImportReview.phase === "decrypting" && (
            <React.Fragment>
              <div className="batch-import-hint">
                {t("mods.import.analyzing")}
                {
                  (directImportReview.decryptProgress || []).filter((item) =>
                    ["done", "error", "skipped"].includes(item.status),
                  ).length
                }
                {" / "}
                {(directImportReview.decryptProgress || []).length}
              </div>
              <div className="batch-import-list">
                {(directImportReview.decryptProgress || []).map((item, idx) => (
                  <div
                    className="batch-import-item direct-import-dialog-batch-import-item-layout"
                    key={idx}
                  >
                    <span className="direct-import-dialog-centered-content">
                      {item.status === "pending" && (
                        <span className="direct-import-dialog-pending-icon">
                          {"⋯"}
                        </span>
                      )}
                      {item.status === "running" && (
                        <span className="direct-import-dialog-spinner">
                          {"⟳"}
                        </span>
                      )}
                      {item.status === "done" && (
                        <span className="direct-import-dialog-success-icon">
                          {"✓"}
                        </span>
                      )}
                      {item.status === "error" && (
                        <span className="direct-import-dialog-error-icon">
                          {"✗"}
                        </span>
                      )}
                    </span>
                    <span className="batch-import-item-main">
                      <span className="batch-import-item-primary">
                        {item.name}
                      </span>
                      {item.importDisplayPath && (
                        <span className="batch-import-item-path">
                          {item.importDisplayPath}
                        </span>
                      )}
                    </span>
                    {item.status === "running" && (
                      <span className="batch-import-inline-note">
                        {item.message || t("common.status.processing")}
                      </span>
                    )}
                    {item.status === "done" &&
                      item.realName &&
                      item.realName !== item.name && (
                        <span className="batch-import-inline-note success">
                          {"→ "}
                          {item.realName}
                        </span>
                      )}
                    {item.status === "error" && (
                      <span className="batch-import-inline-note error">
                        {item.error}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </React.Fragment>
          )}
          {directImportReview.phase === "classify" && (
            <React.Fragment>
              <div className="batch-import-hint">
                {t("mods.import.analyzedHint", {
                  characterName,
                  directImportTargetSectionName,
                })}
              </div>
              <div className="batch-import-list-header">
                <span className="direct-import-dialog-column" />
                <span className="direct-import-dialog-content">
                  {t("mods.import.nameAndLevel")}
                </span>
                <span className="direct-import-dialog-classify-mode-heading">
                  {t("characters.import.installMode")}
                </span>
              </div>
              <div className="batch-import-list batch-import-classify-list">
                {(directImportReview.classifyItems || []).map((item, idx) => {
                  const installAsIntegratedPackage =
                    !!item.installAsIntegratedPackage;
                  const installAsMultipleMods =
                    !installAsIntegratedPackage && !!item.installAsMultipleMods;
                  const isMatched =
                    isManagedInstallContentType(item.installContentType) ||
                    installAsIntegratedPackage ||
                    !!item.targetCharacter;
                  return (
                    <div
                      className={`batch-import-item ${item.decryptSuccess ? (installAsIntegratedPackage ? "integrated" : isMatched ? "matched" : "unmatched") : "fail"}`}
                      key={idx}
                    >
                      <input
                        type="checkbox"
                        checked={item.selected}
                        disabled={!item.decryptSuccess}
                        onChange={(e) =>
                          updateDirectClassifyItem(idx, {
                            selected: e.target.checked,
                          })
                        }
                      />
                      {item.decryptSuccess ? (
                        isManagedInstallContentType(item.installContentType) ? (
                          <React.Fragment>
                            <div className="batch-import-classify-main">
                              <div className="batch-import-item-name direct-import-dialog-batch-import-item-name-layout">
                                {getInstallContentTypeLabel(
                                  item.installContentType,
                                )}
                              </div>
                              <div
                                className="batch-import-classify-path"
                                title={item.filePath || item.path}
                              >
                                {item.realName || item.name}
                              </div>
                            </div>
                            <div className="batch-import-install-mode">
                              <div
                                className="batch-import-current-target"
                                title={
                                  item.managedTargetPath ||
                                  item.managedTargetError
                                }
                              >
                                {item.managedTargetError ||
                                  item.managedTargetLabel ||
                                  t("characters.import.recheckTarget")}
                              </div>
                            </div>
                          </React.Fragment>
                        ) : (
                          <React.Fragment>
                            <div className="batch-import-classify-main">
                              <input
                                className="batch-import-item-name"
                                value={item.modName}
                                readOnly={
                                  installAsIntegratedPackage ||
                                  installAsMultipleMods
                                }
                                onChange={(e) =>
                                  updateDirectClassifyItem(idx, {
                                    modName: e.target.value,
                                    singleModName: e.target.value,
                                  })
                                }
                              />
                              {item.importDisplayPath && (
                                <div
                                  className="batch-import-classify-path"
                                  title={item.importDisplayPath}
                                >
                                  {item.importDisplayPath}
                                </div>
                              )}
                            </div>
                            <div className="batch-import-install-mode">
                              <div
                                className="batch-import-mode-toggle three"
                                role="group"
                                aria-label={t("characters.import.installMode")}
                              >
                                <button
                                  type="button"
                                  className={
                                    !installAsIntegratedPackage &&
                                    !installAsMultipleMods
                                      ? "active"
                                      : ""
                                  }
                                  onClick={() =>
                                    setDirectClassifyInstallMode(
                                      idx,
                                      item,
                                      "single",
                                    )
                                  }
                                >
                                  {t("characters.import.singleShort")}
                                </button>
                                <button
                                  type="button"
                                  className={
                                    installAsMultipleMods ? "active" : ""
                                  }
                                  title={
                                    item.multiModCandidate
                                      ? t("characters.import.installMultiple")
                                      : t("characters.import.tryMultiple")
                                  }
                                  onClick={() =>
                                    setDirectClassifyInstallMode(
                                      idx,
                                      item,
                                      "multiple",
                                    )
                                  }
                                >
                                  {t("characters.import.multipleShort")}
                                </button>
                                <button
                                  type="button"
                                  className={
                                    installAsIntegratedPackage ? "active" : ""
                                  }
                                  onClick={() =>
                                    setDirectClassifyInstallMode(
                                      idx,
                                      item,
                                      "integrated",
                                    )
                                  }
                                >
                                  {t("characters.import.integratedPackage")}
                                </button>
                              </div>
                              <div
                                className={
                                  installAsIntegratedPackage
                                    ? "batch-import-integrated-target"
                                    : "batch-import-current-target"
                                }
                              >
                                {installAsIntegratedPackage
                                  ? t("characters.import.overwriteCurrentMods")
                                  : t("mods.import.target", {
                                      characterName,
                                      directImportTargetSectionName,
                                    })}
                              </div>
                            </div>
                          </React.Fragment>
                        )
                      ) : (
                        <span className="direct-import-dialog-hint">
                          {t("characters.import.itemAnalysisFailed", {
                            name: item.name,
                            decryptError: item.decryptError,
                          })}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="batch-import-summary">
                {(() => {
                  const all = directImportReview.classifyItems || [];
                  const ok = all.filter((item) => item.decryptSuccess);
                  const sel = ok.filter((item) => item.selected);
                  const managed = sel.filter((item) =>
                    isManagedInstallContentType(item.installContentType),
                  );
                  const integrated = sel.filter(
                    (item) => item.installAsIntegratedPackage,
                  );
                  const multiple = sel.filter(
                    (item) => item.installAsMultipleMods,
                  );
                  return t("mods.import.analysisSummary", {
                    allCount: all.length,
                    selCount: sel.length,
                    managedCount: managed.length,
                    integratedCount: integrated.length,
                  });
                })()}
              </div>
              <div className="batch-import-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setDirectImportReview(null)}
                >
                  {t("common.actions.cancel")}
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleStartDirectImportInstall}
                  disabled={
                    !(directImportReview.classifyItems || []).some(
                      (item) => item.selected && item.decryptSuccess,
                    )
                  }
                >
                  {t("characters.import.startInstallation", {
                    count: (directImportReview.classifyItems || []).filter(
                      (item) => item.selected && item.decryptSuccess,
                    ).length,
                  })}
                </button>
              </div>
            </React.Fragment>
          )}
          {directImportReview.phase === "importing" && (
            <div className="batch-import-progress-wrap">
              <div className="batch-import-progress-header">
                <span>{t("downloads.status.installing")}</span>
                <span>
                  {directImportReview.progress ?? 0}
                  {" / "}
                  {directImportReview.total ?? 0}
                </span>
              </div>
              <div className="batch-import-progress-bar-bg">
                <div
                  className="batch-import-progress-bar-fill"
                  style={{
                    width: `${directImportReview.total ? Math.round((directImportReview.progress / directImportReview.total) * 100) : 0}%`,
                  }}
                />
              </div>
              {directImportReview.currentMod && (
                <div className="batch-import-progress-current">
                  {directImportReview.currentMod}
                </div>
              )}
            </div>
          )}
          {directImportReview.phase === "done" && (
            <React.Fragment>
              <div className="batch-import-done-summary">
                {t("characters.import.resultSummary", {
                  filterCount: (directImportReview.results || []).filter(
                    (item) => item.success,
                  ).length,
                  otherFilterCount: (directImportReview.results || []).filter(
                    (item) => !item.success,
                  ).length,
                })}
              </div>
              <div className="batch-import-results">
                {(directImportReview.results || []).map((item, index) => (
                  <div
                    className={`batch-import-result-item ${item.success ? "success" : "fail"}`}
                    key={index}
                  >
                    <span className="batch-import-result-icon">
                      {item.success ? "✓" : "✗"}
                    </span>
                    <span className="batch-import-result-name">
                      {item.modName}
                    </span>
                    <span className="batch-import-result-char">
                      {item.integratedPackage
                        ? t("characters.import.overwriteSummary", {
                            characterCount: item.characterCount || 0,
                            modCount: item.modCount || 0,
                          })
                        : item.characterName || characterName}
                    </span>
                    {!item.success && (
                      <span className="batch-import-error">{item.error}</span>
                    )}
                  </div>
                ))}
              </div>
              <div className="batch-import-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setDirectImportReview(null)}
                >
                  {t("common.actions.finish")}
                </button>
              </div>
            </React.Fragment>
          )}
        </div>
      </div>,
      document.body,
    )
  );
}
