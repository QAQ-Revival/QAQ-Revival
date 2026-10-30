import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
import { Icon } from "../../../components/Icon.jsx";
import { isMarkedModEntry } from "../model/markedMods.js";
import {
  CharacterSectionNavigator,
  SectionCover,
} from "./CharacterSectionNavigator.jsx";
import {
  LocalCollectionGalleryDropdown,
} from "./LocalCollectionVariants.jsx";
import { collectModTags, getModTypeLabels } from "../../../lib/modPresentation.js";

function ModThumb({ mod, className = "mod-row-thumb" }) {
  const [failedUrl, setFailedUrl] = React.useState(null);
  return (
    <span className={className}>
      {mod.previewUrl && failedUrl !== mod.previewUrl ? (
        <img
          src={mod.previewUrl}
          alt=""
          loading="lazy"
          draggable={false}
          onError={() => setFailedUrl(mod.previewUrl)}
        />
      ) : (
        <Icon name="image" size={16} />
      )}
    </span>
  );
}

function ImportDropZone({
  className,
  isDragging,
  setIsDragging,
  handleDirectImportDropFiles,
  newModFile,
  newModName,
  setNewModName,
  handleAddMod,
  setNewModFile,
  children,
}) {
  return (
    <div
      className={`drop-zone mod-import-zone ${isDragging ? "active" : ""} ${className}`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        handleDirectImportDropFiles(e.dataTransfer.files);
      }}
    >
      {newModFile ? (
        <div className="mod-import-pending">
          <div className="mod-import-pending-name">
            <Icon name="box" size={15} />
            {newModFile.name}
          </div>
          <input
            type="text"
            placeholder={t("mods.library.namePlaceholder")}
            value={newModName}
            onChange={(e) => setNewModName(e.target.value)}
            className="input"
          />
          <div className="mod-import-pending-actions">
            <button onClick={() => setNewModFile(null)} className="btn">
              {t("common.actions.cancel")}
            </button>
            <button onClick={handleAddMod} className="btn btn-primary">
              {t("mods.library.saveMod")}
            </button>
          </div>
        </div>
      ) : (
        children
      )}
    </div>
  );
}

export function ModLibraryPanel({
  mods,
  collectionByPath,
  confirmingConflicts,
  confirmConflictSelection,
  viewMode,
  characterName,
  activeAppearanceSectionName,
  exclusiveMode,
  toggleExclusiveMode,
  localCollectionsEnabled,
  toggleLocalCollectionsEnabled,
  toggleViewMode,
  appearanceSectionsWithStats,
  activeAppearanceSectionId,
  appearanceSectionBusy,
  selectAppearanceSection,
  handleSaveCustomAppearanceSection,
  handleDeleteCustomAppearanceSection,
  modsLoadError,
  modsLoading,
  loadMods,
  modSearchQuery,
  setModSearchQuery,
  sortMethod,
  setSortMethod,
  focusNextEnabledMod,
  sortedMods,
  displayMods,
  selectedTagFilters,
  toggleTagFilter,
  clearTagFilters,
  batchMode,
  selectedMods,
  selectAllMods,
  deselectAllMods,
  batchToggle,
  batchDelete,
  modsListRef,
  scrollRafRef,
  persistModViewState,
  setShowScrollTop,
  activeAppearanceSection,
  appearanceFilterHasNoMatches,
  activeAppearanceEmptyHint,
  openLocalCollectionGalleryMenu,
  selectedMod,
  detailCollapsed,
  focusPulseModName,
  captureGalleryAnchor,
  setSelectedMod,
  setDetailCollapsed,
  openModContextMenu,
  setOpenLocalCollectionGalleryMenu,
  selectLocalCollectionVariant,
  markModeUnlocked,
  markedMods,
  activeGameId,
  handleMarkMod,
  handleToggle,
  isDragging,
  setIsDragging,
  handleDirectImportDropFiles,
  newModFile,
  newModName,
  setNewModName,
  handleAddMod,
  setNewModFile,
  activeAppearanceImportTargetName,
  draggedMod,
  dragOverMod,
  toggleBatchSelect,
  handleModDragStart,
  handleModDragEnd,
  setDragOverMod,
  handleModDrop,
  conflictMap,
  setShowConflictDetail,
  showConflictDetail,
}) {
  const availableTags = collectModTags(mods);
  const pendingMods = mods.filter((mod) => mod.pendingEnabled);
  const enabledTotal = displayMods.filter((mod) => mod.enabled).length;
  const isMarked = (mod) =>
    isMarkedModEntry(markedMods, mod, characterName, activeGameId);
  function renderVersionMenu(mod, inline = false) {
    const collection = mod._localCollection || collectionByPath.get(mod.path);
    if (!collection) return null;
    return (
      <LocalCollectionGalleryDropdown
        collection={collection}
        currentPath={mod.path}
        inline={inline}
        isOpen={openLocalCollectionGalleryMenu === mod.path}
        onToggle={(_identity, forceOpen = false) =>
          setOpenLocalCollectionGalleryMenu((current) =>
            forceOpen || current !== mod.path ? mod.path : null,
          )
        }
        onClose={() => setOpenLocalCollectionGalleryMenu(null)}
        onSelect={selectLocalCollectionVariant}
      />
    );
  }
  function handleListScroll(event) {
    const scrollTop = event.target.scrollTop;
    if (scrollRafRef.current) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      persistModViewState({ scrollTop });
      setShowScrollTop(scrollTop > 300);
    });
  }
  function handleListKeys(event) {
    if (event.target.closest("input, textarea, select, button, summary")) return;
    if (event.key === " " && selectedMod) {
      event.preventDefault();
      handleToggle(selectedMod.name, selectedMod.enabled, event);
      return;
    }
    if (!["ArrowDown", "ArrowUp"].includes(event.key) || !displayMods.length)
      return;
    event.preventDefault();
    const index = displayMods.findIndex((mod) => mod.path === selectedMod?.path);
    const next =
      event.key === "ArrowDown"
        ? Math.min(displayMods.length - 1, index + 1)
        : Math.max(0, index - 1);
    const mod = displayMods[next];
    setSelectedMod(mod);
    setDetailCollapsed(false);
    modsListRef.current
      ?.querySelector(`[data-mod-name="${CSS.escape(mod.name)}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }
  const emptyState = displayMods.length === 0 && !modsLoading && !modsLoadError && (
    <div className="appearance-section-empty-state empty-state">
      <SectionCover
        section={activeAppearanceSection}
        className="appearance-section-empty-cover"
        decorative={true}
      />
      <div className="empty-title">
        {appearanceFilterHasNoMatches
          ? t("mods.library.noMatchingMods")
          : t("mods.library.emptySection", {
              activeAppearanceSectionName,
            })}
      </div>
      <div className="empty-text">
        {appearanceFilterHasNoMatches
          ? t("mods.library.clearFiltersHint")
          : activeAppearanceEmptyHint}
      </div>
      {appearanceFilterHasNoMatches && (
        <button
          type="button"
          className="btn appearance-section-empty-clear"
          onClick={() => {
            setModSearchQuery("");
            clearTagFilters();
          }}
        >
          {t("mods.library.clearFilters")}
        </button>
      )}
    </div>
  );
  const dropZoneProps = {
    isDragging,
    setIsDragging,
    handleDirectImportDropFiles,
    newModFile,
    newModName,
    setNewModName,
    handleAddMod,
    setNewModFile,
  };
  return (
    <div
      className={`${viewMode === "gallery" ? "mod-gallery-panel" : "mod-list-panel"} mod-library-panel`}
      aria-busy={modsLoading}
    >
      <div className="mod-view-titlebar">
        <h1 className="mod-view-title">
          <span>{characterName}</span>
        </h1>
        <span className="mod-view-count" title={t("mods.library.enabledCount", { filterCount: enabledTotal })}>
          <strong className={enabledTotal > 0 ? "is-lit" : ""}>{enabledTotal}</strong>
          {" / "}
          {displayMods.length}
          {" "}
          {t("common.status.enabled")}
        </span>
        <div className="mod-view-titlebar-actions">
          <button
            className={`chip sort-option ${exclusiveMode ? "active" : ""}`}
            onClick={toggleExclusiveMode}
            aria-pressed={exclusiveMode}
            title={t("mods.library.singleSelectHint")}
          >
            {t("mods.library.singleSelect")}
          </button>
          <button
            className={`chip sort-option local-collection-toggle ${localCollectionsEnabled ? "active" : ""}`}
            onClick={toggleLocalCollectionsEnabled}
            title={
              localCollectionsEnabled
                ? t("mods.library.disableCollections")
                : t("mods.library.collectionHint")
            }
            aria-pressed={localCollectionsEnabled}
          >
            {t("market.collections.title")}
          </button>
          <button
            className={`view-mode-toggle ${viewMode === "gallery" ? "is-gallery" : "is-list"}`}
            onClick={toggleViewMode}
            title={
              viewMode === "gallery"
                ? t("mods.library.listView")
                : t("mods.library.galleryHint")
            }
            aria-label={
              viewMode === "gallery"
                ? t("mods.library.switchToList")
                : t("mods.library.switchToGallery")
            }
          >
            <span className={viewMode === "list" ? "is-current" : ""}>
              <Icon name="list" size={15} />
            </span>
            <span className={viewMode === "gallery" ? "is-current" : ""}>
              <Icon name="grid" size={15} />
            </span>
          </button>
        </div>
      </div>
      <CharacterSectionNavigator
        characterName={characterName}
        sections={appearanceSectionsWithStats}
        activeSectionId={activeAppearanceSectionId}
        busy={appearanceSectionBusy}
        onSelect={selectAppearanceSection}
        onSaveCustomSection={handleSaveCustomAppearanceSection}
        onDeleteCustomSection={handleDeleteCustomAppearanceSection}
      />
      <div className="mod-sort-bar">
        <div className="search-field mod-search-field">
          <Icon name="search" size={15} />
          <input
            type="text"
            placeholder={t("mods.library.searchPlaceholder")}
            aria-label={t("mods.library.searchLabel")}
            value={modSearchQuery}
            onChange={(e) => setModSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setModSearchQuery("");
            }}
            className="mod-search-input"
          />
          {modSearchQuery && (
            <button
              onClick={() => setModSearchQuery("")}
              aria-label={t("common.actions.clearSearch")}
              className="icon-btn search-clear"
            >
              <Icon name="x" size={14} />
            </button>
          )}
        </div>
        <details className="mod-tag-filter">
          <summary
            className={`chip ${selectedTagFilters.size > 0 ? "active" : ""}`}
            aria-label={t("mods.library.selectTags")}
          >
            <Icon name="tag" size={13} />
            {t("mods.library.selectTags")}
            {selectedTagFilters.size > 0
              ? " (" + selectedTagFilters.size + ")"
              : ""}
          </summary>
          <div className="mod-tag-filter-menu">
            {availableTags.length === 0 && (
              <span className="mod-tag-filter-empty">
                {t("mods.library.noTags")}
              </span>
            )}
            {availableTags.map(([key, name]) => (
              <label key={key}>
                <input
                  type="checkbox"
                  checked={selectedTagFilters.has(key)}
                  onChange={() => toggleTagFilter(key)}
                />
                <span>{name}</span>
              </label>
            ))}
            {selectedTagFilters.size > 0 && (
              <button type="button" className="link-btn" onClick={clearTagFilters}>
                {t("common.actions.clear")}
              </button>
            )}
          </div>
        </details>
        <div
          className="segmented mod-sort-options"
          role="group"
          aria-label={t("mods.library.sortLabel")}
        >
          <button
            className={`sort-option ${sortMethod === "name" ? "active" : ""}`}
            onClick={() => setSortMethod("name")}
          >
            {t("common.fields.name")}
          </button>
          <button
            className={`sort-option ${sortMethod === "enabled" ? "active" : ""}`}
            onClick={() => setSortMethod("enabled")}
          >
            {t("common.fields.status")}
          </button>
          <button
            className={`sort-option ${sortMethod === "time" ? "active" : ""}`}
            onClick={() => setSortMethod("time")}
            title={t("mods.library.sortTimeHint")}
          >
            {t("mods.library.sortTime")}
          </button>
          <button
            className={`sort-option ${sortMethod === "custom" ? "active" : ""}`}
            onClick={() => setSortMethod("custom")}
            title={t("mods.library.sortCustomHint")}
          >
            {t("mods.library.sortCustom")}
          </button>
        </div>
        <button
          className="icon-btn mod-focus-enabled-btn"
          onClick={focusNextEnabledMod}
          disabled={!sortedMods.some((mod) => mod.enabled)}
          aria-label={t("mods.library.locateEnabled")}
          title={
            sortedMods.some((mod) => mod.enabled)
              ? t("mods.library.locateEnabledHint", {
                  filterCount: enabledTotal,
                })
              : t("mods.library.noEnabledMods")
          }
        >
          <Icon name="zap" size={16} />
        </button>
      </div>
      {modsLoading && (
        <div className="appearance-section-loading" role="status">
          <span className="spinner" aria-hidden="true" />
          {t("common.status.loading")}
        </div>
      )}
      {!modsLoading && modsLoadError && (
        <div className="notice notice-danger appearance-section-load-error" role="alert">
          <Icon name="alert" size={14} />
          <span>
            {t("mods.library.loadFailed", {
              modsLoadError,
            })}
          </span>
          <button type="button" className="btn btn-sm" onClick={() => loadMods()}>
            {t("common.actions.retry")}
          </button>
        </div>
      )}
      {selectedTagFilters.size > 0 && (
        <div className="mod-active-filters">
          <span className="toolbar-label">
            {t("mods.library.tagFilterHeading")}
          </span>
          {Array.from(selectedTagFilters).map((tagKey) => (
            <button
              type="button"
              className="chip active"
              key={`filter-chip-${tagKey}`}
              onClick={() => toggleTagFilter(tagKey)}
              title={t("mods.library.removeTagFilter", {
                tagKey,
              })}
            >
              {"#"}
              {tagKey}
              <Icon name="x" size={12} />
            </button>
          ))}
          <button
            onClick={clearTagFilters}
            title={t("mods.library.clearTagFilters")}
            className="link-btn"
          >
            {t("common.actions.clear")}
          </button>
          <span className="mod-active-filters-count">
            {t("mods.library.matchedCountPrefix")}
            <strong>{displayMods.length}</strong>
            {t("mods.library.modCountSuffix")}
          </span>
        </div>
      )}
      {pendingMods.length > 0 && (
        <div className="notice notice-warning mod-conflict-confirm" role="status">
          <Icon name="alert" size={14} />
          <span>{t("mods.conflicts.pendingCount", { count: pendingMods.length })}</span>
          <span className="mod-conflict-confirm-hint">
            {t("mods.conflicts.pendingHint")}
          </span>
          <button
            type="button"
            className="btn btn-sm"
            disabled={confirmingConflicts}
            onClick={confirmConflictSelection}
          >
            {confirmingConflicts
              ? t("common.status.loading")
              : t("mods.conflicts.confirmTogether")}
          </button>
        </div>
      )}
      {batchMode && (
        <div className="mod-batch-toolbar">
          <span className="mod-batch-summary">
            {t("mods.library.selectedCountPrefix")}
            <strong>{selectedMods.size}</strong>
            {t("common.count.itemsSuffix")}
          </span>
          <button onClick={selectAllMods} className="btn btn-sm btn-ghost">
            {t("common.actions.selectAll")}
          </button>
          <button onClick={deselectAllMods} className="btn btn-sm btn-ghost">
            {t("common.actions.clearSelection")}
          </button>
          <span className="mod-batch-spacer" />
          <button
            onClick={() => batchToggle(true)}
            disabled={selectedMods.size === 0}
            className="btn btn-sm"
          >
            {t("mods.library.enableSelected")}
          </button>
          <button
            onClick={() => batchToggle(false)}
            disabled={selectedMods.size === 0}
            className="btn btn-sm"
          >
            {t("mods.library.disableSelected")}
          </button>
          <button
            onClick={batchDelete}
            disabled={selectedMods.size === 0}
            className="btn btn-sm btn-danger"
          >
            {t("mods.library.deleteSelected")}
          </button>
        </div>
      )}
      {viewMode === "gallery" ? (
        <div
          ref={modsListRef}
          className="mod-gallery-grid-wrap"
          onScroll={handleListScroll}
        >
          {emptyState}
          <div className="mod-gallery-grid">
            {displayMods.map((mod) => {
              const lit = mod.enabled || mod.pendingEnabled;
              return (
                <div
                  data-mod-name={mod.name}
                  className={`mod-gallery-card ${lit ? "is-lit" : "is-off"} ${mod._localCollection ? "local-collection-card" : ""} ${openLocalCollectionGalleryMenu === mod.path ? "local-collection-menu-open" : ""} ${selectedMod?.path === mod.path && !detailCollapsed ? "selected" : ""} ${focusPulseModName === mod.name ? "mod-focus-pulse" : ""}`}
                  onClick={(event) => {
                    if (
                      event.target.closest(".local-collection-gallery-dropdown")
                    )
                      return;
                    if (detailCollapsed || !selectedMod)
                      captureGalleryAnchor(mod.name);
                    setSelectedMod(mod);
                    setDetailCollapsed(false);
                  }}
                  onContextMenu={(e) => openModContextMenu(e, mod)}
                  key={mod.path}
                >
                  <div className="mod-gallery-card-image">
                    {mod.previewUrl ? (
                      <img
                        src={mod.previewUrl}
                        alt={mod.name}
                        loading="lazy"
                        draggable={false}
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="mod-gallery-card-placeholder">
                        <Icon name="image" size={24} />
                      </div>
                    )}
                    {mod.pinned && (
                      <div
                        className="mod-gallery-card-pin"
                        title={t("mods.status.pinned")}
                      >
                        <Icon name="pin" size={12} />
                      </div>
                    )}
                    {mod._localCollection && (
                      <div className="local-collection-badge">
                        {t("mods.collections.groupCount", {
                          variantsCount: mod._localCollection.variants.length,
                        })}
                      </div>
                    )}
                    {renderVersionMenu(mod)}
                    {markModeUnlocked ? (
                      <button
                        className={`mod-gallery-card-mark ${isMarked(mod) ? "active" : ""}`}
                        onClick={(e) => handleMarkMod(mod, e)}
                        title={
                          isMarked(mod)
                            ? t("mods.marked.unmark")
                            : t("mods.marked.markThisMod")
                        }
                      >
                        <Icon name="bookmark" size={13} />
                      </button>
                    ) : (
                      isMarked(mod) && (
                        <div
                          className="mod-gallery-card-mark active"
                          title={t("mods.marked.marked")}
                        >
                          <Icon name="bookmark" size={13} />
                        </div>
                      )
                    )}
                  </div>
                  <div className="mod-gallery-card-footer">
                    <div
                      className="mod-gallery-card-name"
                      title={
                        mod.notes
                          ? `${mod.name}
(${mod.notes})`
                          : mod.name
                      }
                    >
                      {getModTypeLabels(mod).length > 0 && (
                        <span className="mod-type-badge">
                          {getModTypeLabels(mod).join(" · ")}
                        </span>
                      )}
                      {mod.name}
                      {mod.hasConflict && lit && (
                        <span
                          className="mod-conflict-icon"
                          title={t("mods.conflicts.confirmToast")}
                        >
                          <Icon name="alert" size={13} />
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={!!lit}
                      aria-label={`${mod.enabled ? t("common.actions.disable") : t("common.actions.enable")} ${mod.name}`}
                      className={`toggle-switch-refined ${lit ? "active" : ""} ${mod.pendingEnabled ? "pending" : ""} mod-gallery-card-toggle`}
                      onClick={(e) => handleToggle(mod.name, mod.enabled, e)}
                      title={
                        mod.enabled
                          ? t("mods.library.disableHint")
                          : t("mods.library.enableHint")
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <ImportDropZone className="mod-gallery-import" {...dropZoneProps}>
            <div className="mod-import-hint">
              <Icon name="plus" size={15} />
              <span>
                {t("mods.library.dropIntoSection", {
                  activeAppearanceImportTargetName,
                })}
              </span>
            </div>
          </ImportDropZone>
        </div>
      ) : (
        <div
          ref={modsListRef}
          className="mods-list"
          tabIndex={0}
          onScroll={handleListScroll}
          onKeyDown={handleListKeys}
        >
          {emptyState}
          {displayMods.map((mod) => {
            const lit = mod.enabled || mod.pendingEnabled;
            return (
              <div
                data-mod-name={mod.name}
                className={`mod-row ${lit ? "is-lit" : ""} ${mod._localCollection ? "local-collection-row" : ""} ${selectedMod?.path === mod.path ? "selected" : ""} ${!mod.enabled ? "disabled" : ""} ${draggedMod?.name === mod.name ? "dragging" : ""} ${dragOverMod?.name === mod.name ? "drag-target" : ""} ${focusPulseModName === mod.name ? "mod-focus-pulse" : ""}`}
                draggable={!batchMode}
                onClick={() => {
                  if (batchMode) return toggleBatchSelect(mod.name);
                  setSelectedMod(mod);
                  setDetailCollapsed(false);
                }}
                onContextMenu={(e) => !batchMode && openModContextMenu(e, mod)}
                onDragStart={(e) => !batchMode && handleModDragStart(e, mod)}
                onDragEnd={handleModDragEnd}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (draggedMod && draggedMod.name !== mod.name) {
                    setDragOverMod(mod);
                  }
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget)) {
                    setDragOverMod(null);
                  }
                }}
                onDrop={(e) => handleModDrop(e, mod)}
                key={mod.path}
              >
                {batchMode ? (
                  <input
                    type="checkbox"
                    className="mod-row-check"
                    checked={selectedMods.has(mod.name)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => toggleBatchSelect(mod.name)}
                    aria-label={mod.name}
                  />
                ) : (
                  <button
                    className={`toggle-switch-refined ${lit ? "active" : ""} ${mod.pendingEnabled ? "pending" : ""} mod-toggle-wrap`}
                    type="button"
                    role="switch"
                    aria-checked={!!lit}
                    aria-label={`${mod.pendingEnabled ? t("mods.conflicts.cancelPending") : mod.enabled ? t("common.actions.disable") : t("common.actions.enable")} ${mod.name}`}
                    onClick={(e) => handleToggle(mod.name, mod.enabled, e)}
                  />
                )}
                <ModThumb mod={mod} />
                <div className="mod-row-info mod-mod-info" title={mod.originalName}>
                  <div className="mod-row-name">
                    {getModTypeLabels(mod).length > 0 && (
                      <span className="mod-type-badge">
                        {getModTypeLabels(mod).join(" · ")}
                      </span>
                    )}
                    <span className="mod-row-name-text">{mod.name}</span>
                    {mod.pinned && (
                      <span title={t("mods.status.pinned")} className="mod-pin-icon">
                        <Icon name="pin" size={12} />
                      </span>
                    )}
                    {isMarked(mod) && (
                      <span title={t("mods.marked.marked")} className="mod-marked-icon">
                        <Icon name="bookmark" size={12} />
                      </span>
                    )}
                    {conflictMap[mod.name] && lit && (
                      <button
                        type="button"
                        title={t("mods.conflicts.hashConflictHint", {
                          map: conflictMap[mod.name]
                            .map((c) => c.otherMods.join(", "))
                            .join(", "),
                        })}
                        aria-label={t("mods.conflicts.confirmToast")}
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowConflictDetail(
                            showConflictDetail === mod.name ? null : mod.name,
                          );
                        }}
                        className="mod-conflict-icon"
                      >
                        <Icon name="alert" size={13} />
                      </button>
                    )}
                  </div>
                  {showConflictDetail === mod.name && conflictMap[mod.name] && (
                    <div className="mod-conflict-detail">
                      {conflictMap[mod.name].map((c, i) => (
                        <div key={i}>
                          {"Hash "}
                          <code className="mod-conflict-hash">
                            {c.hash.substring(0, 8)}
                            {"..."}
                          </code>
                          {t("mods.conflicts.conflictPrefix")}
                          {c.otherMods.join(", ")}
                        </div>
                      ))}
                    </div>
                  )}
                  {mod.notes ? (
                    <div title={mod.notes} className="mod-note-line">
                      {mod.notes}
                    </div>
                  ) : (
                    mod.originalName?.replace(/^DISABLED_/i, "") !== mod.name && (
                      <div className="mod-original-name">{mod.originalName}</div>
                    )
                  )}
                </div>
                {renderVersionMenu(mod, true)}
                {markModeUnlocked && (
                  <button
                    onClick={(e) => handleMarkMod(mod, e)}
                    title={
                      isMarked(mod)
                        ? t("mods.marked.unmark")
                        : t("mods.marked.markThisMod")
                    }
                    className={`icon-btn icon-btn-sm mod-mark-toggle ${isMarked(mod) ? "is-active" : ""}`}
                  >
                    <Icon name="bookmark" size={14} />
                  </button>
                )}
                {!batchMode && (
                  <button
                    type="button"
                    className="icon-btn icon-btn-sm mod-row-more"
                    aria-label={t("common.actions.more")}
                    title={t("common.actions.more")}
                    onClick={(e) => {
                      e.stopPropagation();
                      openModContextMenu(e, mod);
                    }}
                  >
                    <Icon name="more" size={16} strokeWidth={2.4} />
                  </button>
                )}
                {dragOverMod?.name === mod.name && (
                  <div className="mod-drop-overlay">
                    {t("characters.grid.dropHere")}
                  </div>
                )}
              </div>
            );
          })}
          <ImportDropZone className="" {...dropZoneProps}>
            <div className="mod-import-hint">
              <Icon name="plus" size={15} />
              <div>
                <strong>{t("mods.library.dropFolderHint")}</strong>
                <span>
                  {t("mods.library.supportedTypesHint", {
                    activeAppearanceImportTargetName,
                  })}
                </span>
              </div>
            </div>
          </ImportDropZone>
        </div>
      )}
    </div>
  );
}
