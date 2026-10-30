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

// Search-as-you-type target: the row's input filters, the portaled list picks.
function CharacterPicker({
  item,
  idx,
  options,
  position,
  characters,
  pinnedCharacters,
  characterUsageMap,
  updateItem,
  updatePosition,
  setPosition,
  selectCharacter,
}) {
  const query = item.charQuery?.trim();
  return (
    <div className="batch-import-character-picker">
      <Icon name="search" size={13} />
      <input
        className="batch-import-char-input"
        value={item.charQuery ?? (item.targetCharacter === "其他" ? "" : item.targetCharacter || "")}
        placeholder={t("characters.import.groupSearchPlaceholder")}
        aria-label={t("characters.import.targetGroup")}
        onFocus={(e) => {
          updatePosition(e.currentTarget);
          updateItem(idx, { charPickerOpen: true });
        }}
        onBlur={() =>
          setTimeout(() => {
            updateItem(idx, { charPickerOpen: false });
            setPosition(null);
          }, 120)
        }
        onChange={(e) => {
          updatePosition(e.currentTarget);
          updateItem(idx, {
            charQuery: e.target.value,
            targetCharacter: e.target.value.trim() || "其他",
            charPickerOpen: true,
          });
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) {
            e.preventDefault();
            selectCharacter(idx, e.currentTarget.value.trim() || "其他");
          }
          if (e.key === "Escape" && item.charPickerOpen) {
            // Close the list first; a second Escape reaches the dialog.
            e.preventDefault();
            updateItem(idx, { charPickerOpen: false });
            setPosition(null);
          }
        }}
      />
      {item.charPickerOpen &&
        position &&
        ReactDOM.createPortal(
          <div
            className="batch-import-character-options"
            style={{
              top: position.top,
              left: position.left,
              width: position.width,
              maxHeight: position.maxHeight,
            }}
          >
            <button
              type="button"
              className="batch-import-character-option is-muted"
              onMouseDown={(e) => {
                e.preventDefault();
                selectCharacter(idx, "其他");
              }}
            >
              {t("characters.import.unmatchedGroup")}
            </button>
            {query && !characters.some((character) => character.name === query) && (
              <button
                type="button"
                className="batch-import-character-option"
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectCharacter(idx, query);
                }}
              >
                <Icon name="plus" size={13} />
                {t("characters.import.useNewGroup", { charQuery: query })}
              </button>
            )}
            {options.map((c) => (
              <button
                type="button"
                className={`batch-import-character-option ${item.targetCharacter === c.name ? "active" : ""}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectCharacter(idx, c.name);
                }}
                key={c.name}
              >
                <span>{c.name}</span>
                {pinnedCharacters.has(c.name) ? (
                  <em>{t("characters.actions.pinShort")}</em>
                ) : (
                  Number(characterUsageMap?.[c.name] || 0) > 0 && (
                    <em>{t("characters.sort.usage")}</em>
                  )
                )}
              </button>
            ))}
            {options.length === 0 && (
              <div className="batch-import-character-empty">
                {t("characters.search.noMatchingCharacter")}
              </div>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

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
  const close = () => setBatchImport(null);
  const { phase } = batchImport;
  return (
    <ImportFrame title={batchImportTitle} phase={phase} onClose={close}>
      {phase === "scan" && (
        <ScanPhase
          batchImport={batchImport}
          hasManagedInstall={batchImportHasManagedInstall}
          isIntegratedEntry={batchImportIsIntegratedEntry}
          setPlanMode={setBatchPlanScanMode}
          updateScanItem={updateBatchScanItem}
          setPreviewSelected={setBatchPlanPreviewItemSelected}
          gameId={activeGame?.id}
          onCancel={close}
          onStart={handleStartDecrypt}
        />
      )}
      {phase === "decrypting" && <ImportAnalysisPhase items={batchImport.decryptProgress} />}
      {phase === "classify" && (
        <ClassifyPhase
          batchImport={batchImport}
          setBatchImport={setBatchImport}
          pickerProps={{
            position: batchCharacterPickerPosition,
            characters,
            pinnedCharacters,
            characterUsageMap,
            updateItem: updateBatchClassifyItem,
            updatePosition: updateBatchCharacterPickerPosition,
            setPosition: setBatchCharacterPickerPosition,
            selectCharacter: selectBatchCharacter,
          }}
          getCharacterOptions={getBatchCharacterOptions}
          setInstallMode={setClassifyInstallMode}
          onCancel={close}
          onStart={handleStartBatchImport}
        />
      )}
      {phase === "importing" && (
        <ImportProgress
          label={t("characters.import.importing")}
          done={batchImport.progress ?? 0}
          total={batchImport.total ?? 0}
          current={batchImport.currentMod}
        />
      )}
      {phase === "done" && <ImportResultsPhase results={batchImport.results} onClose={close} />}
    </ImportFrame>
  );
}

function ScanPhase({
  batchImport,
  hasManagedInstall,
  isIntegratedEntry,
  setPlanMode,
  updateScanItem,
  setPreviewSelected,
  gameId,
  onCancel,
  onStart,
}) {
  const previewItems = expandBatchPlanItems(batchImport.items);
  const selectedCount = previewItems.filter((item) => item.selected).length;
  const rows = batchImport.items.flatMap((sourceItem, sourceIdx) =>
    getSelectedBatchPlanItems(sourceItem).map((item) => ({ item, sourceIdx })),
  );
  const hint = hasManagedInstall
    ? t("characters.import.managedPackageHint")
    : isIntegratedEntry
      ? t("characters.import.integratedScanHint")
      : "";
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
        aside={batchImport.folderPath}
      />
      <div className="batch-import-body">
        {hint && (
          <div className="notice notice-info batch-import-notice">
            <Icon name="info" size={14} />
            <span>{hint}</span>
          </div>
        )}
        <ImportScanList
          items={batchImport.items}
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

function ClassifyPhase({
  batchImport,
  setBatchImport,
  pickerProps,
  getCharacterOptions,
  setInstallMode,
  onCancel,
  onStart,
}) {
  const all = batchImport.classifyItems || [];
  const ok = all.filter((item) => item.decryptSuccess);
  const selected = ok.filter((item) => item.selected);
  const managedCount = selected.filter((item) =>
    isManagedInstallContentType(item.installContentType),
  ).length;
  const integratedCount = selected.filter((item) => item.installAsIntegratedPackage).length;
  const unmatchedCount = selected.filter(
    (item) =>
      !isManagedInstallContentType(item.installContentType) &&
      !item.installAsIntegratedPackage &&
      (!item.targetCharacter || item.targetCharacter === "其他"),
  ).length;
  const candidateCount = all.filter((item) => item.integratedPackageCandidate).length;
  const failedCount = all.length - ok.length;
  function patchItem(idx, patch) {
    setBatchImport((prev) => ({
      ...prev,
      classifyItems: prev.classifyItems.map((it, i) =>
        i === idx ? { ...it, ...patch(it) } : it,
      ),
    }));
  }
  return (
    <React.Fragment>
      <ImportSummary
        allChecked={ok.length > 0 && selected.length === ok.length}
        someChecked={selected.length > 0}
        onToggleAll={(checked) =>
          setBatchImport((prev) => ({
            ...prev,
            classifyItems: prev.classifyItems.map((it) =>
              it.decryptSuccess ? { ...it, selected: checked } : it,
            ),
          }))
        }
        text={t("characters.import.previewSummary", {
          previewItemsCount: all.length,
          filterCount: selected.length,
        })}
      >
        {unmatchedCount > 0 && (
          <span className="badge badge-warning" title={t("characters.import.unmatchedHint")}>
            {t("characters.import.summaryUnmatched", { count: unmatchedCount })}
          </span>
        )}
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
      <div
        className="batch-import-body"
        onScroll={() => {
          // The list is anchored to its input and cannot follow the scroll.
          if (pickerProps.position) document.activeElement?.blur?.();
        }}
      >
        {candidateCount > 0 && (
          <div className="notice notice-warning batch-import-notice">
            <Icon name="alert" size={14} />
            <span>
              {t("characters.import.integratedCandidates", {
                integratedCount: candidateCount,
              })}
            </span>
          </div>
        )}
        <div className="batch-import-columns batch-import-classify">
          <span />
          <span>{t("mods.fields.name")}</span>
          <span>{t("characters.import.installMode")}</span>
          <span>{t("characters.import.installLocation")}</span>
          <span />
        </div>
        {all.map((item, idx) => {
          if (!item.decryptSuccess) return <ImportFailedRow item={item} key={idx} />;
          const selectBox = (
            <input
              type="checkbox"
              checked={item.selected}
              aria-label={item.modName || item.name}
              onChange={(e) => patchItem(idx, () => ({ selected: e.target.checked }))}
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
          const isMatched =
            integrated || (item.targetCharacter && item.targetCharacter !== "其他");
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
                    patchItem(idx, (it) => ({
                      modName: e.target.value,
                      singleModName: it.installAsIntegratedPackage
                        ? it.singleModName
                        : e.target.value,
                    }))
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
              {integrated ? (
                <span className="batch-import-target-note is-warning">
                  {t("characters.import.overwriteCurrentMods")}
                </span>
              ) : (
                <CharacterPicker
                  item={item}
                  idx={idx}
                  options={getCharacterOptions(item.charQuery ?? "")}
                  {...pickerProps}
                />
              )}
              <span className="batch-import-row-status">
                {!isMatched && (
                  <span
                    className="badge badge-warning"
                    title={t("characters.import.unmatchedHint")}
                  >
                    {t("characters.import.unmatchedBadge")}
                  </span>
                )}
              </span>
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
