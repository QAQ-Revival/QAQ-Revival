import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
import { Icon } from "../../../components/Icon.jsx";
export function CharacterToolbar({
  visibleCharacters,
  characters,
  totalVisibleMods,
  totalVisibleSkins,
  handleBatchImportClick,
  loading,
  missingPath,
  handleIntegratedPackageImportClick,
  renderToolbarActions,
  isNeverness,
  nevernessMode,
  handleSwitchNevernessMode,
  dx12Busy,
  nevernessDx12Status,
  handleOpenDx12PakFolder,
  searchQuery,
  setSearchQuery,
  showAllCharacters,
  setShowAllCharacters,
  sortMethod,
  setSortMethod,
  showReorderHint,
  pendingMoveMod,
  onCancelPendingMove,
}) {
  return (
    <div className="page-header character-toolbar-shell">
      <div className="page-heading character-toolbar-head">
        <h1 className="page-title">{t("characters.list.title")}</h1>
        <span className="page-subtitle character-toolbar-subtitle">
          {t("characters.list.summary", {
            visibleCharactersCount: visibleCharacters.length,
            charactersCount: characters.length,
            totalVisibleMods,
            totalVisibleSkins,
          })}
        </span>
      </div>
      <div className="page-actions">
        {renderToolbarActions()}
        <span className="toolbar-divider" aria-hidden={true} />
        <div
          className="character-import-actions"
          role="group"
          aria-label={t("characters.import.title")}
        >
          <button
            type="button"
            className="btn elevated-action-btn"
            onClick={handleIntegratedPackageImportClick}
            disabled={loading || missingPath}
          >
            {t("characters.import.integratedTitle")}
          </button>
          <button
            type="button"
            className="btn btn-primary batch-import-trigger-btn"
            onClick={handleBatchImportClick}
            disabled={loading || missingPath}
          >
            <Icon name="plus" size={15} strokeWidth={2.2} />
            {t("characters.import.batchTitle")}
          </button>
        </div>
      </div>
      <div className="page-toolbar character-toolbar-controls">
        <div className="search-field character-search-box">
          <Icon name="search" size={15} className="character-search-icon" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setSearchQuery("");
            }}
            placeholder={t("characters.search.placeholder")}
            aria-label={t("characters.search.placeholder")}
            className="character-search-input"
          />
          {searchQuery && (
            <button
              type="button"
              className="icon-btn search-clear character-search-clear"
              onClick={() => setSearchQuery("")}
              title={t("common.actions.clearSearch")}
              aria-label={t("common.actions.clearSearch")}
            >
              <Icon name="x" size={14} />
            </button>
          )}
        </div>
        {isNeverness && (
          <div
            className={`character-sort-group ${nevernessMode === "dx12" ? "is-pak" : ""}`}
          >
            <span className="toolbar-label character-sort-label">
              {t("characters.mode.title")}
            </span>
            <div className="segmented">
              <button
                type="button"
                className={`character-sort-option ${nevernessMode !== "dx12" ? "active" : ""}`}
                onClick={() => handleSwitchNevernessMode("nemi")}
                disabled={dx12Busy}
                title={t("characters.mode.dx11Hint")}
              >
                {"NEMI"}
              </button>
              <button
                type="button"
                className={`character-sort-option ${nevernessMode === "dx12" ? "active" : ""}`}
                onClick={() => handleSwitchNevernessMode("dx12")}
                disabled={dx12Busy}
                title={t("characters.mode.pakHint", {
                  pakDirName: nevernessDx12Status?.paths?.pakDirName || "MOD",
                })}
              >
                {"Pak"}
              </button>
            </div>
            {nevernessMode === "dx12" && (
              <button
                type="button"
                className="btn btn-ghost btn-sm character-sort-option"
                onClick={handleOpenDx12PakFolder}
                disabled={dx12Busy}
                title={t("characters.mode.pakDirectoryHint", {
                  pakDirName: nevernessDx12Status?.paths?.pakDirName || "MOD",
                })}
              >
                <Icon name="folder" size={14} />
                {t("characters.mode.openPakDirectory", {
                  pakDirName: nevernessDx12Status?.paths?.pakDirName || "MOD",
                })}
              </button>
            )}
          </div>
        )}
        <div className="character-sort-group">
          <div className="segmented" role="group" aria-label={t("common.fields.display")}>
            <button
              type="button"
              className={`character-sort-option ${!showAllCharacters ? "active" : ""}`}
              onClick={() => setShowAllCharacters(false)}
              title={t("characters.filter.withContentHint")}
            >
              {t("characters.filter.withContent")}
            </button>
            <button
              type="button"
              className={`character-sort-option ${showAllCharacters ? "active" : ""}`}
              onClick={() => setShowAllCharacters(true)}
              title={t("characters.filter.allHint")}
            >
              {t("characters.filter.all")}
            </button>
          </div>
        </div>
        <div className="character-sort-group">
          <div className="segmented" role="group" aria-label={t("common.fields.sort")}>
            <button
              type="button"
              className={`character-sort-option ${sortMethod === "common" ? "active" : ""}`}
              onClick={() => setSortMethod("common")}
              title={t("characters.sort.usageHint")}
            >
              {t("characters.sort.usage")}
            </button>
            <button
              type="button"
              className={`character-sort-option ${sortMethod === "modCount" ? "active" : ""}`}
              onClick={() => setSortMethod("modCount")}
              title={t("characters.sort.modCountHint")}
            >
              {t("characters.sort.modCount")}
            </button>
            <button
              type="button"
              className={`character-sort-option ${sortMethod === "name" ? "active" : ""}`}
              onClick={() => setSortMethod("name")}
              title={t("characters.sort.nameHint")}
            >
              {t("common.fields.name")}
            </button>
          </div>
        </div>
      </div>
      {showReorderHint && (
        <div className="notice character-toolbar-tip">
          <Icon name="info" size={14} />
          {t("characters.sort.dragHint")}
        </div>
      )}
      {pendingMoveMod && (
        <div className="notice notice-info character-toolbar-tip character-move-tip">
          <Icon name="info" size={14} />
          <span>
            {t("characters.move.chooseTarget", {
              modName: pendingMoveMod.modName,
            })}
          </span>
          <button
            type="button"
            className="btn btn-sm"
            onClick={onCancelPendingMove}
          >
            {t("characters.move.cancel")}
          </button>
        </div>
      )}
    </div>
  );
}
