import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
import { isSameMarketCharacterName } from "../model/marketCollections.js";
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
  return (
    serverUrl &&
    mods.length > 0 && (
      <div className="mod-market-toolbar">
        <div
          className="mod-market-search"
          style={
            visibleSelectedTags.length > 0
              ? {
                  minWidth: "200px",
                  maxWidth: "360px",
                }
              : void 0
          }
        >
          <span className="search-icon">{"🔍"}</span>
          {visibleSelectedTags.length > 0 && (
            <div className="search-tag-bubbles">
              {visibleSelectedTags.map((tag) => (
                <span
                  className="search-tag-bubble"
                  style={{
                    background: `${tag.color || "#666"}18`,
                    color: tag.color || "#666",
                    borderColor: `${tag.color || "#666"}40`,
                  }}
                  key={tag.id}
                >
                  {tag.name}
                  <button
                    className="search-tag-bubble-x"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeTagFilter(tag.id);
                    }}
                    style={{
                      color: tag.color || "#666",
                    }}
                  >
                    {"✕"}
                  </button>
                </span>
              ))}
            </div>
          )}
          <input
            type="text"
            placeholder={
              visibleSelectedTags.length > 0
                ? t("market.filters.continueSearch")
                : t("market.filters.searchPlaceholder")
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={
              visibleSelectedTags.length > 0
                ? {
                    paddingLeft: "8px",
                  }
                : void 0
            }
          />
          {(searchQuery || visibleSelectedTags.length > 0) && (
            <button
              className="search-clear"
              onClick={() => {
                setSearchQuery("");
                setSelectedTags([]);
              }}
            >
              {"✕"}
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
          className="mod-market-select"
        >
          <option value="all">{t("market.filters.allGames")}</option>
          {gameOptions.map((game) => (
            <option value={game.id} key={game.id}>
              {"🎮 "}
              {game.name}
            </option>
          ))}
        </select>
        <div className="market-character-picker-wrap" ref={characterPickerRef}>
          <button
            type="button"
            className={`market-character-trigger ${showCharacterPicker ? "active" : ""}`}
            onClick={() => setShowCharacterPicker((value) => !value)}
            aria-haspopup="dialog"
            aria-expanded={showCharacterPicker}
          >
            <span className="market-character-trigger-icon">{"🎭"}</span>
            <span className="market-character-trigger-text">
              {selectedCharacterLabel}
            </span>
            <span className="market-character-trigger-caret">{"▾"}</span>
          </button>
          {showCharacterPicker && (
            <div
              className="market-character-panel"
              role="dialog"
              aria-label={t("market.filters.chooseCharacter")}
            >
              <div className="market-character-panel-head">
                <div>
                  <strong>{t("market.filters.characterCategory")}</strong>
                  <span>{t("market.filters.chooseCategoryHint")}</span>
                </div>
                <button
                  type="button"
                  className="market-character-all"
                  onClick={() => {
                    setSelectedCharacter("all");
                    setShowCharacterPicker(false);
                    setCurrentPage(1);
                  }}
                >
                  {t("characters.filter.all")}
                </button>
              </div>
              <div className="market-character-panel-body">
                <section className="market-character-section market-character-section-roles">
                  <div className="market-character-section-title">
                    {t("navigation.characters")}
                  </div>
                  <div className="market-character-grid">
                    {visibleCharacterPickerOptions.roleOptions.map((char) => (
                      <button
                        type="button"
                        className={`market-character-option ${isSameMarketCharacterName(selectedCharacter, char.name, marketCharacterAliasIndex) ? "active" : ""}`}
                        onClick={() => {
                          setSelectedCharacter(char.name);
                          setShowCharacterPicker(false);
                          setCurrentPage(1);
                        }}
                        title={char.name}
                        key={char.name}
                      >
                        <span className="market-character-avatar">
                          {char.coverUrl ? (
                            <img src={char.coverUrl} alt="" />
                          ) : (
                            <em>{char.name.slice(0, 1)}</em>
                          )}
                        </span>
                        <span className="market-character-name">
                          {char.name}
                        </span>
                        <span className="market-character-count">
                          {char.count}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
                {visibleCharacterPickerOptions.functionOptions.length > 0 && (
                  <section className="market-character-section market-character-section-functions">
                    <div className="market-character-section-title">
                      {t("market.filters.functionCategory")}
                    </div>
                    <div className="market-function-list">
                      {visibleCharacterPickerOptions.functionOptions.map(
                        (char) => (
                          <button
                            type="button"
                            className={`market-function-option ${isSameMarketCharacterName(selectedCharacter, char.name, marketCharacterAliasIndex) ? "active" : ""}`}
                            onClick={() => {
                              setSelectedCharacter(char.name);
                              setShowCharacterPicker(false);
                              setCurrentPage(1);
                            }}
                            title={char.name}
                            key={char.name}
                          >
                            <span className="market-function-avatar">
                              {char.coverUrl ? (
                                <img src={char.coverUrl} alt="" />
                              ) : (
                                <em>{char.name.slice(0, 1)}</em>
                              )}
                            </span>
                            <span>{char.name}</span>
                            <strong>{char.count}</strong>
                          </button>
                        ),
                      )}
                    </div>
                  </section>
                )}
              </div>
            </div>
          )}
        </div>
        <button
          type="button"
          className={`mod-market-favorite-filter ${likedOnly ? "active" : ""}`}
          aria-pressed={likedOnly}
          onClick={() => setLikedOnly((value) => !value)}
          title={
            likedOnly
              ? t("market.filters.showAllMods")
              : t("market.filters.showFavorites")
          }
        >
          <span className="mod-favorite-heart" aria-hidden="true">
            {likedOnly ? "♥" : "♡"}
          </span>
          <span>{t("market.actions.favorite")}</span>
        </button>
        {gameVersionOptions.length > 0 && (
          <select
            value={selectedGameVersion}
            onChange={(e) => setSelectedGameVersion(e.target.value)}
            className="mod-market-select"
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
          className="mod-market-select"
        >
          <option value="all">{t("market.filters.allModes")}</option>
          <option value="d3d">{"3dm"}</option>
          <option value="pak">{"Pak"}</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="mod-market-select market-toolbar-mod-market-select-layout"
        >
          <option value="newest">{t("market.filters.sortLatest")}</option>
          <option value="hot_today">{t("market.filters.sortToday")}</option>
          <option value="hot_week">{t("market.filters.sortWeek")}</option>
          <option value="hot_month">{t("market.filters.sortMonth")}</option>
          <option value="downloads">{t("market.filters.sortDownloads")}</option>
          <option value="name">{t("market.filters.sortName")}</option>
        </select>
        <span className="mod-market-count">
          {t("market.filters.resultCount", {
            displayedModsCount: displayedMods.length,
            gameDisplayedModsCount: gameDisplayedMods.length,
          })}
        </span>
      </div>
    )
  );
}
