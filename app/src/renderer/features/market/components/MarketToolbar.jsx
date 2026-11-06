import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
import { Icon } from "../../../components/Icon.jsx";
import { isSameMarketCharacterName } from "../model/marketCollections.js";
function CharacterOption({ char, active, onSelect, className }) {
  return (
    <button
      type="button"
      className={`${className} ${active ? "active" : ""}`}
      onClick={onSelect}
      title={char.name}
    >
      <span className="market-character-avatar">
        {char.coverUrl ? (
          <img src={char.coverUrl} alt="" />
        ) : (
          <em>{char.name.slice(0, 1)}</em>
        )}
      </span>
      <span className="market-character-name">{char.name}</span>
      <span className="market-character-count">{char.count}</span>
    </button>
  );
}
export function MarketToolbar({
  serverUrl,
  mods,
  visibleSelectedTags,
  removeTagFilter,
  searchQuery,
  setSearchQuery,
  setSelectedTags,
  selectedGameId,
  setSelectedGameId,
  setSelectedCharacter,
  setSelectedGameVersion,
  setSelectedModMode,
  gameOptions,
  characterPickerRef,
  showCharacterPicker,
  setShowCharacterPicker,
  selectedCharacterLabel,
  setCurrentPage,
  visibleCharacterPickerOptions,
  selectedCharacter,
  marketCharacterAliasIndex,
  likedOnly,
  setLikedOnly,
  gameVersionOptions,
  selectedGameVersion,
  selectedModMode,
  sortBy,
  setSortBy,
  displayedMods,
  gameDisplayedMods,
}) {
  function chooseCharacter(name) {
    setSelectedCharacter(name);
    setShowCharacterPicker(false);
    setCurrentPage(1);
  }
  function clearSearch() {
    setSearchQuery("");
    setSelectedTags([]);
  }
  return (
    serverUrl &&
    mods.length > 0 && (
      <div className="source-toolbar mod-market-toolbar">
        <div className="search-field mod-market-search">
          <Icon name="search" size={15} />
          <input
            type="text"
            placeholder={t("market.filters.searchPlaceholder")}
            aria-label={t("market.filters.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") clearSearch();
            }}
          />
          {(searchQuery || visibleSelectedTags.length > 0) && (
            <button
              type="button"
              className="icon-btn search-clear"
              title={t("common.actions.clearSearch")}
              aria-label={t("common.actions.clearSearch")}
              onClick={clearSearch}
            >
              <Icon name="x" size={14} />
            </button>
          )}
        </div>
        <select
          value={selectedGameId}
          onChange={(e) => {
            setSelectedGameId(e.target.value);
            setSelectedCharacter("all");
            setSelectedGameVersion("all");
            setSelectedModMode("all");
          }}
          className="select mod-market-select"
          aria-label={t("market.filters.allGames")}
        >
          <option value="all">{t("market.filters.allGames")}</option>
          {gameOptions.map((game) => (
            <option value={game.id} key={game.id}>
              {game.name}
            </option>
          ))}
        </select>
        <div className="market-character-picker-wrap" ref={characterPickerRef}>
          <button
            type="button"
            className="btn market-character-trigger"
            onClick={() => setShowCharacterPicker((value) => !value)}
            aria-haspopup="dialog"
            aria-expanded={showCharacterPicker}
          >
            <span className="market-character-trigger-text">
              {selectedCharacter === "all"
                ? t("market.filters.allCharacters")
                : selectedCharacterLabel}
            </span>
            <Icon name="chevron-down" size={14} />
          </button>
          {showCharacterPicker && (
            <div
              className="market-character-panel"
              role="dialog"
              aria-label={t("market.filters.chooseCharacter")}
            >
              <div className="market-character-panel-head">
                <strong>{t("market.filters.characterCategory")}</strong>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => chooseCharacter("all")}
                >
                  {t("characters.filter.all")}
                </button>
              </div>
              <div className="market-character-grid">
                {visibleCharacterPickerOptions.roleOptions.map((char) => (
                  <CharacterOption
                    key={char.name}
                    char={char}
                    className="market-character-option"
                    active={isSameMarketCharacterName(
                      selectedCharacter,
                      char.name,
                      marketCharacterAliasIndex,
                    )}
                    onSelect={() => chooseCharacter(char.name)}
                  />
                ))}
              </div>
              {visibleCharacterPickerOptions.functionOptions.length > 0 && (
                <React.Fragment>
                  <div className="market-character-section-title">
                    {t("market.filters.functionCategory")}
                  </div>
                  <div className="market-character-grid">
                    {visibleCharacterPickerOptions.functionOptions.map(
                      (char) => (
                        <CharacterOption
                          key={char.name}
                          char={char}
                          className="market-character-option"
                          active={isSameMarketCharacterName(
                            selectedCharacter,
                            char.name,
                            marketCharacterAliasIndex,
                          )}
                          onSelect={() => chooseCharacter(char.name)}
                        />
                      ),
                    )}
                  </div>
                </React.Fragment>
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          className={`icon-btn mod-market-favorite-filter ${likedOnly ? "is-active" : ""}`}
          aria-pressed={likedOnly}
          onClick={() => setLikedOnly((value) => !value)}
          title={
            likedOnly
              ? t("market.filters.showAllMods")
              : t("market.filters.showFavorites")
          }
          aria-label={t("market.filters.showFavorites")}
        >
          <Icon
            name="heart"
            size={16}
            fill={likedOnly ? "currentColor" : "none"}
          />
        </button>
        {gameVersionOptions.length > 0 && (
          <select
            value={selectedGameVersion}
            onChange={(e) => setSelectedGameVersion(e.target.value)}
            className="select"
            aria-label={t("market.filters.allVersions")}
          >
            <option value="all">{t("market.filters.allVersions")}</option>
            {gameVersionOptions.map((ver) => (
              <option value={ver} key={ver}>
                {ver}
              </option>
            ))}
          </select>
        )}
        <select
          value={selectedModMode}
          onChange={(e) => setSelectedModMode(e.target.value)}
          className="select"
          aria-label={t("market.filters.allModes")}
        >
          <option value="all">{t("market.filters.allModes")}</option>
          <option value="d3d">{"3dm"}</option>
          <option value="pak">{"Pak"}</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="select"
          aria-label={t("common.fields.sortOrder")}
        >
          <option value="newest">{t("market.filters.sortLatest")}</option>
          <option value="hot_today">{t("market.filters.sortToday")}</option>
          <option value="hot_week">{t("market.filters.sortWeek")}</option>
          <option value="hot_month">{t("market.filters.sortMonth")}</option>
          <option value="downloads">{t("market.filters.sortDownloads")}</option>
          <option value="name">{t("market.filters.sortName")}</option>
        </select>
        <span className="toolbar-label mod-market-count">
          {t("market.filters.resultCount", {
            displayedModsCount: displayedMods.length,
            gameDisplayedModsCount: gameDisplayedMods.length,
          })}
        </span>
        {visibleSelectedTags.length > 0 && (
          <div className="mod-market-tag-filters">
            {visibleSelectedTags.map((tag) => (
              <span className="chip active" key={tag.id}>
                {tag.name}
                <button
                  type="button"
                  className="chip-remove"
                  aria-label={t("common.actions.remove")}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeTagFilter(tag.id);
                  }}
                >
                  <Icon name="x" size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    )
  );
}
