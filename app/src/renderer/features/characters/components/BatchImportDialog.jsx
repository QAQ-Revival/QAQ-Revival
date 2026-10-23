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
export function BatchImportDialog({
  batchImport,
  setBatchImport,
  batchImportTitle,
  batchImportHasManagedInstall,
  batchImportIsIntegratedEntry,
  setBatchPlanScanMode,
  updateBatchScanItem,
  setBatchPlanPreviewItemSelected,
  activeGame,
  handleStartDecrypt,
  getBatchCharacterOptions,
  setClassifyInstallMode,
  updateBatchCharacterPickerPosition,
  updateBatchClassifyItem,
  setBatchCharacterPickerPosition,
  selectBatchCharacter,
  batchCharacterPickerPosition,
  characters,
  pinnedCharacters,
  characterUsageMap,
  handleStartBatchImport,
}) {
  return (
    <div
      className="batch-import-overlay"
      onClick={() =>
        !["importing", "decrypting"].includes(batchImport.phase) &&
        setBatchImport(null)
      }
    >
      <div className="batch-import-card" onClick={(e) => e.stopPropagation()}>
        <div className="batch-import-header">
          <span className="batch-import-title">{batchImportTitle}</span>
          <button
            type="button"
            className="legacy-import-close"
            onClick={() => setBatchImport(null)}
            disabled={["importing", "decrypting"].includes(batchImport.phase)}
          >
            {"✕"}
          </button>
        </div>
        {batchImport.phase === "scan" && (
          <React.Fragment>
            {batchImport.folderPath && (
              <div className="batch-import-path">{batchImport.folderPath}</div>
            )}
            <div className="batch-import-hint">
              {batchImportHasManagedInstall ? (
                <React.Fragment>
                  {t("characters.import.managedPackageHint")}
                </React.Fragment>
              ) : batchImportIsIntegratedEntry ? (
                <React.Fragment>
                  {t("characters.import.integratedScanHint", {
                    itemsCount: batchImport.items.length,
                  })}
                </React.Fragment>
              ) : (
                <React.Fragment>
                  {t("characters.import.encryptedScanHint", {
                    itemsCount: batchImport.items.length,
                  })}
                </React.Fragment>
              )}
            </div>
            {batchImport.items.some((item) => isBatchFolderPlanItem(item)) && (
              <div className="batch-import-plan-list">
                {batchImport.items.map((item, idx) => {
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
                      (option) => option.id === item.selectedIntegratedOptionId,
                    ) ||
                    (plan.integratedOptions || []).find(
                      (option) => option.id === plan.defaultIntegratedOptionId,
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
                            {t("characters.import.detectedMode", {
                              batchPlanModeLabel: getBatchPlanModeLabel(
                                plan.defaultMode,
                              ),
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
                              setBatchPlanScanMode(idx, item, "single")
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
                              setBatchPlanScanMode(idx, item, "multiple")
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
                              setBatchPlanScanMode(idx, item, "integrated")
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
                              updateBatchScanItem(idx, {
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
                                updateBatchScanItem(idx, {
                                  selectedIntegratedOptionId: e.target.value,
                                })
                              }
                            >
                              {(plan.integratedOptions || []).map((option) => (
                                <option value={option.id} key={option.id}>
                                  {option.label}
                                  {option.pathLabel
                                    ? ` · ${option.pathLabel}`
                                    : ""}
                                </option>
                              ))}
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
              <span className="batch-import-dialog-column" />
              <span className="batch-import-dialog-type-heading">
                {t("common.fields.type")}
              </span>
              <span className="add-character-dialog-btn-layout">
                {t("characters.import.previewContents")}
              </span>
              <span className="batch-import-dialog-hint">
                {t("characters.import.installMode")}
              </span>
            </div>
            <div className="batch-import-list">
              {batchImport.items.flatMap((sourceItem, sourceIdx) =>
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
                          setBatchPlanPreviewItemSelected(
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
                              item.managedTargetPath || item.managedTargetError
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
                            updateBatchScanItem(sourceIdx, {
                              installContentType: event.target.value,
                              targetGameId:
                                event.target.value === "game-package-update" &&
                                item.suggestedContentType ===
                                  "game-package-update"
                                  ? item.targetGameId || activeGame?.id
                                  : activeGame?.id,
                              importerName:
                                event.target.value === "game-package-update" &&
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
                          className="batch-import-dialog-select-field"
                        >
                          {getManagedInstallOptions().map((option) => (
                            <option value={option.value} key={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span
                          style={{
                            color:
                              item.forceIntegratedPackage ||
                              item.integratedPackageCandidate
                                ? "#059669"
                                : item.disguised
                                  ? "#e67e22"
                                  : "var(--color-text-tertiary)",
                          }}
                          className="batch-import-dialog-item-type"
                        >
                          {item.forceIntegratedPackage ||
                          item.integratedPackageCandidate
                            ? t("characters.import.integratedPackage")
                            : item.disguised
                              ? t("characters.import.encryptedMod")
                              : item.importMode === "single"
                                ? t("characters.import.singleMod")
                                : "Mod"}
                        </span>
                      )}
                    </div>
                  ),
                ),
              )}
            </div>
            <div className="batch-import-summary">
              {(() => {
                const previewItems = expandBatchPlanItems(batchImport.items);
                return t("characters.import.previewSummary", {
                  previewItemsCount: previewItems.length,
                  filterCount: previewItems.filter((i) => i.selected).length,
                });
              })()}
            </div>
            <div className="batch-import-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setBatchImport(null)}
              >
                {t("common.actions.cancel")}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleStartDecrypt}
                disabled={
                  !expandBatchPlanItems(batchImport.items).some(
                    (i) => i.selected,
                  )
                }
              >
                {t("characters.import.startAnalysis", {
                  filterCount: expandBatchPlanItems(batchImport.items).filter(
                    (i) => i.selected,
                  ).length,
                })}
              </button>
            </div>
          </React.Fragment>
        )}
        {batchImport.phase === "decrypting" && (
          <React.Fragment>
            <div className="batch-import-hint">
              {t("characters.import.decrypting")}
              {
                (batchImport.decryptProgress || []).filter((i) =>
                  ["done", "error", "skipped"].includes(i.status),
                ).length
              }
              {" / "}
              {(batchImport.decryptProgress || []).length}
            </div>
            <div className="batch-import-list">
              {(batchImport.decryptProgress || []).map((item, idx) => (
                <div
                  className="batch-import-item batch-import-dialog-batch-import-item-layout"
                  key={idx}
                >
                  <span className="batch-import-dialog-centered-content">
                    {item.status === "pending" && (
                      <span className="batch-import-dialog-content">{"⋯"}</span>
                    )}
                    {item.status === "running" && (
                      <span className="batch-import-dialog-spinner">{"⟳"}</span>
                    )}
                    {item.status === "done" && (
                      <span className="batch-import-dialog-success-icon">
                        {"✓"}
                      </span>
                    )}
                    {item.status === "error" && (
                      <span className="batch-import-dialog-error-icon">
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
                    <span className="batch-import-dialog-truncated-text">
                      {item.message || t("common.status.processing")}
                    </span>
                  )}
                  {item.status === "done" &&
                    item.realName &&
                    item.realName !== item.name && (
                      <span className="batch-import-dialog-extracted-name">
                        {"→ "}
                        {item.realName}
                      </span>
                    )}
                  {item.status === "error" && (
                    <span className="batch-import-dialog-item-error">
                      {item.error}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </React.Fragment>
        )}
        {batchImport.phase === "classify" && (
          <React.Fragment>
            <div className="batch-import-hint">
              {(() => {
                const integratedCount = (
                  batchImport.classifyItems || []
                ).filter((item) => item.integratedPackageCandidate).length;
                return integratedCount > 0 ? (
                  <React.Fragment>
                    {t("characters.import.integratedCandidates", {
                      integratedCount,
                    })}
                  </React.Fragment>
                ) : (
                  <React.Fragment>
                    {t("characters.import.chooseGroupHint")}
                    <span className="batch-import-hint-matched">
                      {t("characters.import.assignedColor")}
                    </span>
                    {t("characters.import.assignedColorDescription")}
                    <span className="batch-import-hint-unmatched">
                      {t("characters.import.unassignedColor")}
                    </span>
                    {t("characters.import.unassignedColorDescription")}
                  </React.Fragment>
                );
              })()}
            </div>
            <div className="batch-import-list-header">
              <span className="batch-import-dialog-column" />
              <span className="add-character-dialog-btn-layout">
                {t("mods.fields.name")}
              </span>
              <span className="batch-import-dialog-destination-heading">
                {t("characters.import.installLocation")}
              </span>
            </div>
            <div className="batch-import-list batch-import-classify-list">
              {(batchImport.classifyItems || []).map((item, idx) => {
                const installAsIntegratedPackage =
                  !!item.installAsIntegratedPackage;
                const installAsMultipleMods =
                  !installAsIntegratedPackage && !!item.installAsMultipleMods;
                const isMultiModCandidate = !!item.multiModCandidate;
                const isMatched =
                  isManagedInstallContentType(item.installContentType) ||
                  installAsIntegratedPackage ||
                  (item.targetCharacter && item.targetCharacter !== "其他");
                const characterOptions = getBatchCharacterOptions(
                  item.charQuery ?? "",
                );
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
                        setBatchImport((prev) => ({
                          ...prev,
                          classifyItems: prev.classifyItems.map((it, i) =>
                            i === idx
                              ? {
                                  ...it,
                                  selected: e.target.checked,
                                }
                              : it,
                          ),
                        }))
                      }
                    />
                    {item.decryptSuccess ? (
                      isManagedInstallContentType(item.installContentType) ? (
                        <React.Fragment>
                          <div className="batch-import-classify-main">
                            <div className="batch-import-item-name batch-import-dialog-batch-import-item-name-layout">
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
                                setBatchImport((prev) => ({
                                  ...prev,
                                  classifyItems: prev.classifyItems.map(
                                    (it, i) =>
                                      i === idx
                                        ? {
                                            ...it,
                                            modName: e.target.value,
                                            singleModName:
                                              it.installAsIntegratedPackage
                                                ? it.singleModName
                                                : e.target.value,
                                          }
                                        : it,
                                  ),
                                }))
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
                                  setClassifyInstallMode(idx, item, "single")
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
                                  isMultiModCandidate
                                    ? t("characters.import.installMultiple")
                                    : t("characters.import.tryMultiple")
                                }
                                onClick={() =>
                                  setClassifyInstallMode(idx, item, "multiple")
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
                                  setClassifyInstallMode(
                                    idx,
                                    item,
                                    "integrated",
                                  )
                                }
                              >
                                {t("characters.import.integratedPackage")}
                              </button>
                            </div>
                            {installAsIntegratedPackage ? (
                              <div className="batch-import-integrated-target">
                                {t("characters.import.overwriteCurrentMods")}
                              </div>
                            ) : (
                              <div className="batch-import-character-picker">
                                <input
                                  className={`batch-import-char-search-inline ${isMatched ? "matched" : "unmatched"}`}
                                  value={
                                    item.charQuery ??
                                    (item.targetCharacter === "其他"
                                      ? ""
                                      : item.targetCharacter || "")
                                  }
                                  placeholder={t(
                                    "characters.import.groupSearchPlaceholder",
                                  )}
                                  aria-label={t(
                                    "characters.import.targetGroup",
                                  )}
                                  onFocus={(e) => {
                                    updateBatchCharacterPickerPosition(
                                      e.currentTarget,
                                    );
                                    updateBatchClassifyItem(idx, {
                                      charPickerOpen: true,
                                    });
                                  }}
                                  onBlur={() =>
                                    setTimeout(() => {
                                      updateBatchClassifyItem(idx, {
                                        charPickerOpen: false,
                                      });
                                      setBatchCharacterPickerPosition(null);
                                    }, 120)
                                  }
                                  onChange={(e) => {
                                    updateBatchCharacterPickerPosition(
                                      e.currentTarget,
                                    );
                                    updateBatchClassifyItem(idx, {
                                      charQuery: e.target.value,
                                      targetCharacter:
                                        e.target.value.trim() || "其他",
                                      charPickerOpen: true,
                                    });
                                  }}
                                  onKeyDown={(e) => {
                                    if (
                                      e.key === "Enter" &&
                                      !e.nativeEvent.isComposing &&
                                      e.keyCode !== 229
                                    ) {
                                      e.preventDefault();
                                      selectBatchCharacter(
                                        idx,
                                        e.currentTarget.value.trim() || "其他",
                                      );
                                    }
                                    if (e.key === "Escape") {
                                      updateBatchClassifyItem(idx, {
                                        charPickerOpen: false,
                                      });
                                      setBatchCharacterPickerPosition(null);
                                    }
                                  }}
                                />
                                {item.charPickerOpen &&
                                  batchCharacterPickerPosition &&
                                  ReactDOM.createPortal(
                                    <div
                                      className="batch-import-character-options batch-import-character-options-portal"
                                      style={{
                                        top: batchCharacterPickerPosition.top,
                                        left: batchCharacterPickerPosition.left,
                                        width:
                                          batchCharacterPickerPosition.width,
                                        maxHeight:
                                          batchCharacterPickerPosition.maxHeight,
                                      }}
                                    >
                                      <button
                                        type="button"
                                        className="batch-import-character-option other"
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          selectBatchCharacter(idx, "其他");
                                        }}
                                      >
                                        {t("characters.import.unmatchedGroup")}
                                      </button>
                                      {item.charQuery?.trim() &&
                                        !characters.some(
                                          (character) =>
                                            character.name ===
                                            item.charQuery.trim(),
                                        ) && (
                                          <button
                                            type="button"
                                            className="batch-import-character-option"
                                            onMouseDown={(e) => {
                                              e.preventDefault();
                                              selectBatchCharacter(
                                                idx,
                                                item.charQuery.trim(),
                                              );
                                            }}
                                          >
                                            {t(
                                              "characters.import.useNewGroup",
                                              {
                                                charQuery:
                                                  item.charQuery.trim(),
                                              },
                                            )}
                                          </button>
                                        )}
                                      {characterOptions.map((c) => (
                                        <button
                                          type="button"
                                          className={`batch-import-character-option ${item.targetCharacter === c.name ? "active" : ""}`}
                                          onMouseDown={(e) => {
                                            e.preventDefault();
                                            selectBatchCharacter(idx, c.name);
                                          }}
                                          key={c.name}
                                        >
                                          <span>{c.name}</span>
                                          {pinnedCharacters.has(c.name) && (
                                            <span className="batch-import-character-badge">
                                              {t("characters.actions.pinShort")}
                                            </span>
                                          )}
                                          {!pinnedCharacters.has(c.name) &&
                                            Number(
                                              characterUsageMap?.[c.name] || 0,
                                            ) > 0 && (
                                              <span className="batch-import-character-badge">
                                                {t("characters.sort.usage")}
                                              </span>
                                            )}
                                        </button>
                                      ))}
                                      {characterOptions.length === 0 && (
                                        <div className="batch-import-character-empty">
                                          {t(
                                            "characters.search.noMatchingCharacter",
                                          )}
                                        </div>
                                      )}
                                    </div>,
                                    document.body,
                                  )}
                              </div>
                            )}
                          </div>
                        </React.Fragment>
                      )
                    ) : (
                      <span className="batch-import-dialog-classification-error">
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
                const all = batchImport.classifyItems || [];
                const ok = all.filter((i) => i.decryptSuccess);
                const sel = ok.filter((i) => i.selected);
                const managed = sel.filter((i) =>
                  isManagedInstallContentType(i.installContentType),
                );
                const integrated = sel.filter(
                  (i) => i.installAsIntegratedPackage,
                );
                const matched = sel.filter(
                  (i) =>
                    !isManagedInstallContentType(i.installContentType) &&
                    !i.installAsIntegratedPackage &&
                    i.targetCharacter !== "其他",
                );
                return t("characters.import.analysisSummary", {
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
                onClick={() => setBatchImport(null)}
              >
                {t("common.actions.cancel")}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleStartBatchImport}
                disabled={
                  !(batchImport.classifyItems || []).some(
                    (i) => i.selected && i.decryptSuccess,
                  )
                }
              >
                {t("characters.import.startInstallation", {
                  count: (batchImport.classifyItems || []).filter(
                    (i) => i.selected && i.decryptSuccess,
                  ).length,
                })}
              </button>
            </div>
          </React.Fragment>
        )}
        {batchImport.phase === "importing" && (
          <div className="batch-import-progress-wrap">
            <div className="batch-import-progress-header">
              <span>{t("characters.import.importing")}</span>
              <span>
                {batchImport.progress ?? 0}
                {" / "}
                {batchImport.total ?? 0}
              </span>
            </div>
            <div className="batch-import-progress-bar-bg">
              <div
                className="batch-import-progress-bar-fill"
                style={{
                  width: `${batchImport.total ? Math.round((batchImport.progress / batchImport.total) * 100) : 0}%`,
                }}
              />
            </div>
            {batchImport.currentMod && (
              <div className="batch-import-progress-current">
                {batchImport.currentMod}
              </div>
            )}
          </div>
        )}
        {batchImport.phase === "done" && (
          <React.Fragment>
            <div className="batch-import-done-summary">
              {t("characters.import.resultSummary", {
                filterCount: batchImport.results.filter((r) => r.success)
                  .length,
                otherFilterCount: batchImport.results.filter((r) => !r.success)
                  .length,
              })}
            </div>
            <div className="batch-import-results">
              {batchImport.results.map((r, i) => (
                <div
                  className={`batch-import-result-item ${r.success ? "success" : "fail"}`}
                  key={i}
                >
                  <span className="batch-import-result-icon">
                    {r.success ? "✓" : "✗"}
                  </span>
                  <span className="batch-import-result-name">{r.modName}</span>
                  <span className="batch-import-result-char">
                    {r.integratedPackage
                      ? t("characters.import.overwriteSummary", {
                          characterCount: r.characterCount || 0,
                          modCount: r.modCount || 0,
                        })
                      : r.characterName}
                  </span>
                  {!r.success && (
                    <span className="batch-import-error">{r.error}</span>
                  )}
                </div>
              ))}
            </div>
            <div className="batch-import-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setBatchImport(null)}
              >
                {t("common.actions.finish")}
              </button>
            </div>
          </React.Fragment>
        )}
      </div>
    </div>
  );
}
