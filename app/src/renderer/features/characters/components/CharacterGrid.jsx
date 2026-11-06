import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
import { Icon } from "../../../components/Icon.jsx";
import {
  getCharacterSkinCount,
  dataTransferIncludesCoverImage,
} from "../model/characterHelpers.js";
export function CharacterGrid({
  setShowAddModal,
  visibleCharacters,
  pinnedCharacters,
  draggingOver,
  dragOverChar,
  draggedChar,
  canDragReorder,
  onSelectCharacter,
  openCharacterContextMenu,
  handleDragStart,
  handleDragEnd,
  handleDragOverReorder,
  setDraggingOver,
  setDragOverChar,
  handleDropReorder,
  handleDropCover,
  characterCovers,
  setCharacterCovers,
  renamingChar,
  renameInputRef,
  renameValue,
  setRenameValue,
  handleRename,
  setRenamingChar,
}) {
  return (
    <div className="character-grid">
      {visibleCharacters.map((char) => {
        const charName = char.name;
        const isPinned = pinnedCharacters.has(charName);
        const skinCount = getCharacterSkinCount(char);
        const enabledCount = char.enabledCount || 0;
        return (
          <div
            className={`character-card form-pop-enter ${enabledCount > 0 ? "is-lit" : ""} ${draggingOver === charName ? "dragging" : ""} ${dragOverChar === charName ? "drag-target" : ""} ${draggedChar === charName ? "dragging-self" : ""}`}
            draggable={canDragReorder}
            onClick={() => onSelectCharacter(charName)}
            onKeyDown={(event) => {
              if (
                event.target === event.currentTarget &&
                (event.key === "Enter" || event.key === " ")
              ) {
                event.preventDefault();
                onSelectCharacter(charName);
              }
            }}
            role="group"
            aria-roledescription={t("characters.grid.openableCard")}
            tabIndex={0}
            aria-label={t("characters.grid.cardLabel", {
              charName,
              enabledCount,
              modCount: char.modCount || 0,
              skinCount,
            })}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              openCharacterContextMenu(e, charName, isPinned);
            }}
            onDragStart={(e) => handleDragStart(e, charName)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => {
              if (draggedChar && canDragReorder) {
                e.preventDefault();
                e.stopPropagation();
                handleDragOverReorder(e, charName);
              } else if (dataTransferIncludesCoverImage(e.dataTransfer)) {
                e.preventDefault();
                e.stopPropagation();
                if (draggingOver !== charName) {
                  setDraggingOver(charName);
                }
              } else if (draggingOver === charName) {
                setDraggingOver(null);
              }
            }}
            onDragLeave={(e) => {
              if (draggingOver === charName) {
                e.preventDefault();
              }
              if (!e.currentTarget.contains(e.relatedTarget)) {
                setDraggingOver(null);
                setDragOverChar(null);
              }
            }}
            onDrop={(e) => {
              if (draggedChar) {
                handleDropReorder(e, charName);
              } else if (dataTransferIncludesCoverImage(e.dataTransfer)) {
                handleDropCover(charName, e);
              } else {
                setDraggingOver(null);
              }
            }}
            key={charName}
          >
            <div className="card-image">
              {characterCovers[charName] ? (
                <img
                  src={characterCovers[charName]}
                  alt={charName}
                  draggable={false}
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  onError={() =>
                    setCharacterCovers((previous) => ({
                      ...previous,
                      [charName]: null,
                    }))
                  }
                />
              ) : (
                <div className="character-grid-avatar-initial">
                  {charName.charAt(0).toUpperCase()}
                </div>
              )}
              {isPinned && (
                <div
                  className="character-pin-badge"
                  title={t("mods.status.pinned")}
                >
                  <Icon name="pin" size={12} />
                </div>
              )}
              {skinCount > 0 && (
                <div
                  className="character-skin-count-badge"
                  aria-label={t("characters.grid.officialSkinsCount", {
                    skinCount,
                  })}
                  title={t("characters.grid.officialSkinsCount", { skinCount })}
                >
                  <Icon name="shirt" size={12} />
                  <strong>{skinCount}</strong>
                </div>
              )}
              <button
                type="button"
                className="character-more-btn"
                aria-label={t("characters.grid.moreActions", { charName })}
                title={t("common.actions.more")}
                onClick={(event) => {
                  event.stopPropagation();
                  openCharacterContextMenu(event, charName, isPinned);
                }}
                onPointerDown={(event) => event.stopPropagation()}
                onDragStart={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
              >
                <Icon name="more" size={16} strokeWidth={2.4} />
              </button>
            </div>
            <div className="card-bottom-section">
              <div className="card-name">
                {renamingChar === charName ? (
                  <input
                    ref={renameInputRef}
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter") handleRename(charName);
                      if (e.key === "Escape") setRenamingChar(null);
                    }}
                    onBlur={() => handleRename(charName)}
                    onClick={(e) => e.stopPropagation()}
                    autoFocus={true}
                    className="input character-grid-input-field"
                  />
                ) : (
                  <span
                    title={charName}
                    className="character-grid-truncated-text"
                  >
                    {charName}
                  </span>
                )}
              </div>
              {renamingChar !== charName && (
                <div className="card-stats-badge">
                  <span className={enabledCount > 0 ? "is-lit" : ""}>
                    {enabledCount}
                  </span>
                  {"/"}
                  {char.modCount || 0}
                </div>
              )}
            </div>
            {draggingOver === charName && !draggedChar && (
              <div className="drop-overlay">
                {t("characters.cover.dropHint")}
              </div>
            )}
            {dragOverChar === charName && (
              <div className="drop-overlay reorder-overlay">
                {t("characters.grid.dropHere")}
              </div>
            )}
          </div>
        );
      })}
      <div
        className="character-card add-card form-pop-enter"
        onClick={() => setShowAddModal(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setShowAddModal(true);
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={t("characters.actions.addCategory")}
      >
        <Icon name="plus" size={22} className="character-grid-icon" />
        <div className="character-grid-heading">
          {t("characters.actions.add")}
        </div>
      </div>
      {visibleCharacters.length === 0 && (
        <div className="character-empty-state empty-state form-pop-enter">
          <div className="empty-face" aria-hidden={true}>
            {"QAQ"}
          </div>
          <div className="empty-title character-empty-title">
            {t("characters.search.noMatches")}
          </div>
          <div className="empty-text character-empty-text">
            {t("characters.search.suggestion")}
          </div>
        </div>
      )}
    </div>
  );
}
