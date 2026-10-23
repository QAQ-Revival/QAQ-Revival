import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
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
    <div className="character-toolbar-shell page-transition-enter">
      <div className="character-toolbar-head">
        <div>
          <div className="text-h2">{t("characters.list.title")}</div>
          <div className="character-toolbar-subtitle">
            {t("characters.list.summary", {
              visibleCharactersCount: visibleCharacters.length,
              charactersCount: characters.length,
              totalVisibleMods,
              totalVisibleSkins,
            })}
          </div>
        </div>
        <div
          className="character-import-actions"
          role="group"
          aria-label={t("characters.import.title")}
        >
          <button
            type="button"
            className="btn batch-import-trigger-btn"
            onClick={handleBatchImportClick}
            disabled={loading || missingPath}
          >
            {t("characters.import.batchTitle")}
          </button>
          <button
            type="button"
            className="btn btn-secondary elevated-action-btn"
            onClick={handleIntegratedPackageImportClick}
            disabled={loading || missingPath}
          >
            {t("characters.import.integratedTitle")}
          </button>
        </div>
      </div>
      {renderToolbarActions()}
      <div className="character-toolbar-controls">
        {isNeverness && (
          <div
            className="character-sort-group"
            style={{
              borderColor:
                nevernessMode === "dx12" ? "rgba(239,68,68,0.28)" : void 0,
            }}
          >
            <span className="character-sort-label">
              {t("characters.mode.title")}
            </span>
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
            {nevernessMode === "dx12" && (
              <React.Fragment>
                <button
                  type="button"
                  className="character-sort-option"
                  onClick={handleOpenDx12PakFolder}
                  disabled={dx12Busy}
                  title={t("characters.mode.pakDirectoryHint", {
                    pakDirName: nevernessDx12Status?.paths?.pakDirName || "MOD",
                  })}
                >
                  {t("characters.mode.openPakDirectory", {
                    pakDirName: nevernessDx12Status?.paths?.pakDirName || "MOD",
                  })}
                </button>
              </React.Fragment>
            )}
          </div>
        )}
        <div className="character-search-box">
          <span className="character-search-icon">{"🔎"}</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("characters.search.placeholder")}
            className="character-search-input"
          />
          {searchQuery && (
            <button
              type="button"
              className="character-search-clear"
              onClick={() => setSearchQuery("")}
              title={t("common.actions.clearSearch")}
            >
              {"✕"}
            </button>
          )}
        </div>
        <div className="character-sort-group">
          <span className="character-sort-label">
            {t("common.fields.display")}
          </span>
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
        <div className="character-sort-group">
          <span className="character-sort-label">
            {t("common.fields.sort")}
          </span>
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
      {showReorderHint && (
        <div className="character-toolbar-tip">
          {t("characters.sort.dragHint")}
        </div>
      )}
      {pendingMoveMod && (
        <div className="character-toolbar-tip character-toolbar-character-toolbar-tip-layout">
          <span>
            {t("characters.move.chooseTarget", {
              modName: pendingMoveMod.modName,
            })}
          </span>
          <button
            type="button"
            className="btn btn-secondary character-toolbar-btn-layout"
            onClick={onCancelPendingMove}
          >
            {t("characters.move.cancel")}
          </button>
        </div>
      )}
    </div>
  );
}
