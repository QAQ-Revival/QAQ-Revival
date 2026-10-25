import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
import { isMarkedModEntry } from "../model/markedMods.js";
import {
  CharacterSectionNavigator,
  SectionCover,
} from "./CharacterSectionNavigator.jsx";
import {
  LocalCollectionGalleryDropdown,
} from "./LocalCollectionVariants.jsx";
import { collectModTags, getModTypeLabels } from "../../../lib/modPresentation.js";
import "../../../lib/mod-selection.css";
export function ModLibraryPanel({
  mods,
  collectionByPath,
  confirmingConflicts,
  confirmConflictSelection,
  viewMode,
  onBack,
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
  confirmDelete,
}) {
  const availableTags = collectModTags(mods);
  const pendingMods = mods.filter(mod => mod.pendingEnabled);
  function renderVersionMenu(mod, inline = false) {
    const collection = mod._localCollection || collectionByPath.get(mod.path);
    if (!collection) return null;
    return <LocalCollectionGalleryDropdown
      collection={collection}
      currentPath={mod.path}
      inline={inline}
      isOpen={openLocalCollectionGalleryMenu === mod.path}
      onToggle={(_identity, forceOpen = false) => setOpenLocalCollectionGalleryMenu(current => forceOpen || current !== mod.path ? mod.path : null)}
      onClose={() => setOpenLocalCollectionGalleryMenu(null)}
      onSelect={selectLocalCollectionVariant}
    />;
  }
  return (
    <div
      className={`${viewMode === "gallery" ? "mod-gallery-panel" : "mod-list-panel"} card mod-library-panel`}
      aria-busy={modsLoading}
    >
      <div className="mod-view-titlebar">
        <button
          onClick={onBack}
          className="btn btn-secondary mod-view-back-btn"
          aria-label={t("mods.library.backToCharacters")}
        >
          {"←"}
        </button>
        <div className="text-h2 mod-view-title">
          <span>{characterName}</span>
          <span className="mod-view-active-section-label">
            {activeAppearanceSectionName}
          </span>
        </div>
        <div className="mod-view-titlebar-actions">
          <button
            className={`sort-option ${exclusiveMode ? "active" : ""}`}
            onClick={toggleExclusiveMode}
            title={t("mods.library.singleSelectHint")}
          >
            {t("mods.library.singleSelect")}
          </button>
          <button
            className={`sort-option local-collection-toggle ${localCollectionsEnabled ? "active" : ""}`}
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
            <span className="view-mode-toggle-icon" aria-hidden="true">
              {viewMode === "gallery" ? (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <rect
                    x="1"
                    y="2"
                    width="12"
                    height="2"
                    rx="1"
                    fill="currentColor"
                  />
                  <rect
                    x="1"
                    y="6"
                    width="12"
                    height="2"
                    rx="1"
                    fill="currentColor"
                  />
                  <rect
                    x="1"
                    y="10"
                    width="12"
                    height="2"
                    rx="1"
                    fill="currentColor"
                  />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <rect
                    x="1"
                    y="1"
                    width="5"
                    height="5"
                    rx="1"
                    fill="currentColor"
                  />
                  <rect
                    x="8"
                    y="1"
                    width="5"
                    height="5"
                    rx="1"
                    fill="currentColor"
                  />
                  <rect
                    x="1"
                    y="8"
                    width="5"
                    height="5"
                    rx="1"
                    fill="currentColor"
                  />
                  <rect
                    x="8"
                    y="8"
                    width="5"
                    height="5"
                    rx="1"
                    fill="currentColor"
                  />
                </svg>
              )}
            </span>
            <span className="view-mode-toggle-label">
              {viewMode === "gallery"
                ? t("mods.library.openList")
                : t("mods.library.openGallery")}
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
      {modsLoading && (
        <div className="appearance-section-loading" role="status">
          <span className="mod-import-spinner" aria-hidden="true">{"⟳"}</span>
          {t("common.status.loading")}
        </div>
      )}
      {!modsLoading && modsLoadError && (
        <div className="appearance-section-load-error" role="alert">
          <span>
            {t("mods.library.loadFailed", {
              modsLoadError,
            })}
          </span>
          <button type="button" onClick={() => loadMods()}>
            {t("common.actions.retry")}
          </button>
        </div>
      )}
      <div className="mod-sort-bar">
        <div className="mod-search-field">
          <input
            type="text"
            placeholder={t("mods.library.searchPlaceholder")}
            aria-label={t("mods.library.searchLabel")}
            value={modSearchQuery}
            onChange={(e) => setModSearchQuery(e.target.value)}
            className="mod-search-input"
          />
          {modSearchQuery && (
            <button
              onClick={() => setModSearchQuery("")}
              aria-label={t("common.actions.clearSearch")}
              className="mod-library-panel-action"
            >
              {"✕"}
            </button>
          )}
          <details className="mod-tag-filter">
            <summary aria-label={t("mods.library.selectTags")}>{t("mods.library.selectTags")}{selectedTagFilters.size > 0 ? " (" + selectedTagFilters.size + ")" : ""}</summary>
            <div className="mod-tag-filter-menu">
              {availableTags.length === 0 && <span>{t("mods.library.noTags")}</span>}
              {availableTags.map(([key, name]) => <label key={key}><input type="checkbox" checked={selectedTagFilters.has(key)} onChange={() => toggleTagFilter(key)} /><span>{name}</span></label>)}
              {selectedTagFilters.size > 0 && <button type="button" onClick={clearTagFilters}>{t("common.actions.clear")}</button>}
            </div>
          </details>
        </div>
        <div
          className="mod-sort-options"
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
          className="sort-option mod-focus-enabled-btn"
          onClick={focusNextEnabledMod}
          disabled={!sortedMods.some((mod) => mod.enabled)}
          title={
            sortedMods.some((mod) => mod.enabled)
              ? t("mods.library.locateEnabledHint", {
                  filterCount: displayMods.filter((mod) => mod.enabled).length,
                })
              : t("mods.library.noEnabledMods")
          }
        >
          {t("mods.library.locateEnabled")}
        </button>
      </div>
      {selectedTagFilters.size > 0 && (
        <div className="mod-library-panel-row">
          <span className="mod-library-panel-content">
            {t("mods.library.tagFilterHeading")}
          </span>
          {Array.from(selectedTagFilters).map((tagKey) => (
            <span
              key={`filter-chip-${tagKey}`}
              className="mod-library-panel-panel"
            >
              <span>
                {"#"}
                {tagKey}
              </span>
              <button
                onClick={() => toggleTagFilter(tagKey)}
                title={t("mods.library.removeTagFilter", {
                  tagKey,
                })}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "rgba(255,255,255,0.4)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "rgba(255,255,255,0.25)")
                }
                className="mod-library-panel-remove-tag-filter"
              >
                {"×"}
              </button>
            </span>
          ))}
          <button
            onClick={clearTagFilters}
            title={t("mods.library.clearTagFilters")}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "rgba(255,255,255,1)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "rgba(255,255,255,0.7)")
            }
            className="mod-library-panel-clear-tag-filters-action"
          >
            {t("common.actions.clear")}
          </button>
          <div className="direct-import-dialog-content" />
          <span className="mod-library-panel-hint">
            {t("mods.library.matchedCountPrefix")}
            <strong className="mod-library-panel-mod-count">
              {displayMods.length}
            </strong>
            {t("mods.library.modCountSuffix")}
          </span>
        </div>
      )}
      {pendingMods.length > 0 && <div className="mod-conflict-confirm" role="status">
        <span>⚠️ {t("mods.conflicts.pendingCount", { count: pendingMods.length })}</span>
        <span className="mod-conflict-confirm-hint">{t("mods.conflicts.pendingHint")}</span>
        <button type="button" disabled={confirmingConflicts} onClick={confirmConflictSelection}>{confirmingConflicts ? t("common.status.loading") : t("mods.conflicts.confirmTogether")}</button>
      </div>}
      {batchMode && (
        <div className="mod-library-panel-batch-toolbar">
          <span className="mod-library-panel-selection-summary">
            {t("mods.library.selectedCountPrefix")}
            <strong className="mod-library-panel-mod-count">
              {selectedMods.size}
            </strong>
            {t("common.count.itemsSuffix")}
          </span>
          <button
            onClick={selectAllMods}
            className="mod-library-panel-select-all-mods-action"
          >
            {t("common.actions.selectAll")}
          </button>
          <button
            onClick={deselectAllMods}
            className="mod-library-panel-select-all-mods-action"
          >
            {t("common.actions.clearSelection")}
          </button>
          <div className="direct-import-dialog-content" />
          <button
            onClick={() => batchToggle(true)}
            disabled={selectedMods.size === 0}
            style={{
              cursor: selectedMods.size > 0 ? "pointer" : "default",
              opacity: selectedMods.size > 0 ? 1 : 0.5,
            }}
            className="mod-library-panel-batch-action"
          >
            {t("mods.library.enableSelected")}
          </button>
          <button
            onClick={() => batchToggle(false)}
            disabled={selectedMods.size === 0}
            style={{
              cursor: selectedMods.size > 0 ? "pointer" : "default",
              opacity: selectedMods.size > 0 ? 1 : 0.5,
            }}
            className="mod-library-panel-action-spaced"
          >
            {t("mods.library.disableSelected")}
          </button>
          <button
            onClick={batchDelete}
            disabled={selectedMods.size === 0}
            style={{
              cursor: selectedMods.size > 0 ? "pointer" : "default",
              opacity: selectedMods.size > 0 ? 1 : 0.5,
            }}
            className="mod-library-panel-batch-delete-action"
          >
            {t("mods.library.deleteSelected")}
          </button>
        </div>
      )}
      {viewMode === "gallery" ? (
        <div
          ref={modsListRef}
          className="mod-gallery-grid-wrap"
          onScroll={(e) => {
            const scrollTop = e.target.scrollTop;
            if (scrollRafRef.current) return;
            scrollRafRef.current = requestAnimationFrame(() => {
              scrollRafRef.current = null;
              persistModViewState({
                scrollTop,
              });
              setShowScrollTop(scrollTop > 300);
            });
          }}
        >
          {displayMods.length === 0 && !modsLoading && !modsLoadError && (
            <div className="appearance-section-empty-state">
              <SectionCover
                section={activeAppearanceSection}
                className="appearance-section-empty-cover"
                decorative={true}
              />
              <div>
                <strong>
                  {appearanceFilterHasNoMatches
                    ? t("mods.library.noMatchingMods")
                    : t("mods.library.emptySection", {
                        activeAppearanceSectionName,
                      })}
                </strong>
                <span>
                  {appearanceFilterHasNoMatches
                    ? t("mods.library.clearFiltersHint")
                    : activeAppearanceEmptyHint}
                </span>
                {appearanceFilterHasNoMatches && (
                  <button
                    type="button"
                    className="appearance-section-empty-clear"
                    onClick={() => {
                      setModSearchQuery("");
                      clearTagFilters();
                    }}
                  >
                    {t("mods.library.clearFilters")}
                  </button>
                )}
              </div>
            </div>
          )}
          <div className="mod-gallery-grid">
            {displayMods.map((mod) => (
              <div
                data-mod-name={mod.name}
                className={`mod-gallery-card ${mod._localCollection ? "local-collection-card" : ""} ${openLocalCollectionGalleryMenu === mod.path ? "local-collection-menu-open" : ""} ${selectedMod?.path === mod.path && !detailCollapsed ? "selected" : ""} ${focusPulseModName === mod.name ? "mod-focus-pulse" : ""}`}
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
                    <div className="mod-gallery-card-placeholder">{"🖼️"}</div>
                  )}
                  {mod.pinned && (
                    <div
                      className="mod-gallery-card-pin"
                      title={t("mods.status.pinned")}
                    >
                      {"📌"}
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
                      className={`mod-gallery-card-mark ${isMarkedModEntry(markedMods, mod, characterName, activeGameId) ? "active" : ""}`}
                      onClick={(e) => handleMarkMod(mod, e)}
                      title={
                        isMarkedModEntry(
                          markedMods,
                          mod,
                          characterName,
                          activeGameId,
                        )
                          ? t("mods.marked.unmark")
                          : t("mods.marked.markThisMod")
                      }
                    >
                      {"🔖"}
                    </button>
                  ) : (
                    isMarkedModEntry(
                      markedMods,
                      mod,
                      characterName,
                      activeGameId,
                    ) && (
                      <div
                        className="mod-gallery-card-mark active"
                        title={t("mods.marked.marked")}
                      >
                        {"🔖"}
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
                    {getModTypeLabels(mod).length > 0 && <span className="mod-type-badge">{getModTypeLabels(mod).join(" · ")}</span>}
                    {mod.name}
                    {mod.hasConflict && (mod.enabled || mod.pendingEnabled) && <span className="mod-conflict-icon" title={t("mods.conflicts.confirmToast")}>⚠️</span>}
                  </div>
                  <div
                    className={`toggle-switch-refined ${mod.enabled || mod.pendingEnabled ? "active" : ""} ${mod.pendingEnabled ? "pending" : ""} mod-gallery-card-toggle`}
                    onClick={(e) => handleToggle(mod.name, mod.enabled, e)}
                    title={
                      mod.enabled
                        ? t("mods.library.disableHint")
                        : t("mods.library.enableHint")
                    }
                  />
                </div>
              </div>
            ))}
          </div>
          <div
            className={`drop-zone ${isDragging ? "active" : ""} mod-library-panel-active-layout`}
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
              <div className="mod-library-panel-column">
                <div className="mod-library-panel-content-emphasis">
                  {"📦 "}
                  {newModFile.name}
                </div>
                <input
                  type="text"
                  placeholder={t("mods.library.namePlaceholder")}
                  value={newModName}
                  onChange={(e) => setNewModName(e.target.value)}
                  className="input mod-library-panel-input-layout"
                />
                <div className="mod-library-panel-import-actions">
                  <button onClick={handleAddMod} className="btn btn-primary">
                    {t("mods.library.saveMod")}
                  </button>
                  <button
                    onClick={() => setNewModFile(null)}
                    className="btn btn-secondary"
                  >
                    {t("common.actions.cancel")}
                  </button>
                </div>
              </div>
            ) : (
              <React.Fragment>
                <div className="mod-library-panel-import-icon">{"📂"}</div>
                <div className="mod-library-panel-import-target-hint">
                  {t("mods.library.dropIntoSection", {
                    activeAppearanceImportTargetName,
                  })}
                </div>
              </React.Fragment>
            )}
          </div>
        </div>
      ) : (
        <div
          ref={modsListRef}
          className="mods-list"
          onScroll={(e) => {
            const scrollTop = e.target.scrollTop;
            if (scrollRafRef.current) return;
            scrollRafRef.current = requestAnimationFrame(() => {
              scrollRafRef.current = null;
              persistModViewState({
                scrollTop,
              });
              setShowScrollTop(scrollTop > 300);
            });
          }}
        >
          <div className="mod-list-summary">
            <strong>
              {t("mods.library.listHeading", {
                displayModsCount: displayMods.length,
              })}
            </strong>
            <span>
              {t("mods.library.enabledCount", {
                filterCount: displayMods.filter((mod) => mod.enabled).length,
              })}
            </span>
          </div>
          {displayMods.length === 0 && !modsLoading && !modsLoadError && (
            <div className="appearance-section-empty-state compact">
              <SectionCover
                section={activeAppearanceSection}
                className="appearance-section-empty-cover"
                decorative={true}
              />
              <div>
                <strong>
                  {appearanceFilterHasNoMatches
                    ? t("mods.library.noMatchingMods")
                    : t("mods.library.emptySection", {
                        activeAppearanceSectionName,
                      })}
                </strong>
                <span>
                  {appearanceFilterHasNoMatches
                    ? t("mods.library.clearFiltersHint")
                    : activeAppearanceEmptyHint}
                </span>
                {appearanceFilterHasNoMatches && (
                  <button
                    type="button"
                    className="appearance-section-empty-clear"
                    onClick={() => {
                      setModSearchQuery("");
                      clearTagFilters();
                    }}
                  >
                    {t("mods.library.clearFilters")}
                  </button>
                )}
              </div>
            </div>
          )}
          {displayMods.map((mod, index) => (
            <div
              data-mod-name={mod.name}
              className={`mod-row ${mod._localCollection ? "local-collection-row" : ""} ${selectedMod?.path === mod.path ? "selected" : ""} ${!mod.enabled ? "disabled" : ""} ${draggedMod?.name === mod.name ? "dragging" : ""} ${dragOverMod?.name === mod.name ? "drag-target" : ""} ${focusPulseModName === mod.name ? "mod-focus-pulse" : ""}`}
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
                <div
                  style={{
                    borderRadius: "4px",
                    border: selectedMods.has(mod.name)
                      ? "2px solid var(--color-accent-primary, #667eea)"
                      : "2px solid #ccc",
                    background: selectedMods.has(mod.name)
                      ? "var(--color-accent-primary, #667eea)"
                      : "transparent",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleBatchSelect(mod.name);
                  }}
                  className="mod-library-panel-selection-checkbox"
                >
                  {selectedMods.has(mod.name) && (
                    <span className="mod-library-panel-hint-emphasis">
                      {"✓"}
                    </span>
                  )}
                </div>
              ) : (
                <div
                  className="drag-handle"
                  title={t("mods.library.dragToSort")}
                >
                  {"⋮⋮"}
                </div>
              )}
              <button
                className={`toggle-switch-refined ${mod.enabled || mod.pendingEnabled ? "active" : ""} ${mod.pendingEnabled ? "pending" : ""} mod-toggle-wrap`}
                type="button"
                role="switch"
                aria-checked={mod.enabled || mod.pendingEnabled}
                aria-label={`${mod.pendingEnabled ? t("mods.conflicts.cancelPending") : mod.enabled ? t("common.actions.disable") : t("common.actions.enable")} ${mod.name}`}
                onClick={(e) => handleToggle(mod.name, mod.enabled, e)}
              />
              <div
                className="mod-row-info mod-mod-info"
                title={mod.originalName}
              >
                <div className="mod-row-name">
                  {mod._localCollection && (
                    <span className="local-collection-inline-badge">
                      {t("mods.collections.groupCount", {
                        variantsCount: mod._localCollection.variants.length,
                      })}
                    </span>
                  )}
                  {getModTypeLabels(mod).length > 0 && <span className="mod-type-badge">{getModTypeLabels(mod).join(" · ")}</span>}
                  <span className="mod-row-name-text">{mod.name}</span>
                  {renderVersionMenu(mod, true)}
                  {mod.pinned && (
                    <span
                      title={t("mods.status.pinned")}
                      className="mod-pin-icon"
                    >
                      {"📌"}
                    </span>
                  )}
                  {isMarkedModEntry(
                    markedMods,
                    mod,
                    characterName,
                    activeGameId,
                  ) && (
                    <span
                      title={t("mods.marked.marked")}
                      className="mod-library-panel-marked-badge"
                    >
                      {"🔖"}
                    </span>
                  )}
                  {conflictMap[mod.name] && (mod.enabled || mod.pendingEnabled) && (
                    <span
                      title={t("mods.conflicts.hashConflictHint", {
                        map: conflictMap[mod.name]
                          .map((c) => c.otherMods.join(", "))
                          .join(", "),
                      })}
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowConflictDetail(
                          showConflictDetail === mod.name ? null : mod.name,
                        );
                      }}
                      className="mod-conflict-icon"
                    >
                      {"⚠️"}
                    </span>
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
                    {"("}
                    {mod.notes}
                    {")"}
                  </div>
                ) : (
                  mod.originalName?.replace(/^DISABLED_/i, "") !== mod.name && (
                    <div className="mod-original-name">{mod.originalName}</div>
                  )
                )}
              </div>
              {markModeUnlocked && (
                <button
                  onClick={(e) => handleMarkMod(mod, e)}
                  title={
                    isMarkedModEntry(
                      markedMods,
                      mod,
                      characterName,
                      activeGameId,
                    )
                      ? t("mods.marked.unmark")
                      : t("mods.marked.markThisMod")
                  }
                  style={{
                    opacity: isMarkedModEntry(
                      markedMods,
                      mod,
                      characterName,
                      activeGameId,
                    )
                      ? 1
                      : 0.3,
                  }}
                  className="mod-library-panel-mark-toggle"
                >
                  {"🔖"}
                </button>
              )}
              <button
                className="delete-btn mod-delete-btn"
                aria-label={t("mods.actions.deleteNamed", {
                  name: mod.name,
                })}
                title={t("mods.actions.delete")}
                onClick={(e) => confirmDelete(mod.name, e)}
              >
                {"×"}
              </button>
              {dragOverMod?.name === mod.name && (
                <div className="mod-drop-overlay">
                  {t("characters.grid.dropHere")}
                </div>
              )}
            </div>
          ))}
          <div
            className={`drop-zone mod-import-zone ${isDragging ? "active" : ""}`}
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
              <div className="mod-library-panel-column">
                <div className="mod-library-panel-content-emphasis">
                  {"📦 "}
                  {newModFile.name}
                </div>
                <input
                  type="text"
                  placeholder={t("mods.library.namePlaceholder")}
                  value={newModName}
                  onChange={(e) => setNewModName(e.target.value)}
                  className="input mod-library-panel-import-name"
                />
                <div className="mod-library-panel-import-actions">
                  <button onClick={handleAddMod} className="btn btn-primary">
                    {t("mods.library.saveMod")}
                  </button>
                  <button
                    onClick={() => setNewModFile(null)}
                    className="btn btn-secondary"
                  >
                    {t("common.actions.cancel")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mod-import-hint">
                <span className="mod-import-icon" aria-hidden={true}>
                  {"+"}
                </span>
                <div>
                  <strong>{t("mods.library.dropFolderHint")}</strong>
                  <span>
                    {t("mods.library.supportedTypesHint", {
                      activeAppearanceImportTargetName,
                    })}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
