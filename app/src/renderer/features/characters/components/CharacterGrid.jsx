import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
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
  hidingCharacter,
  handleHideCharacter,
  setShowDeleteModal,
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
        <div className="character-grid-icon">{"+"}</div>
        <div className="character-grid-heading">
          {t("characters.actions.add")}
        </div>
      </div>
      {visibleCharacters.map((char) => {
        const charName = char.name;
        const isPinned = pinnedCharacters.has(charName);
        const skinCount = getCharacterSkinCount(char);
        return (
          <div
            className={`character-card form-pop-enter ${draggingOver === charName ? "dragging" : ""} ${dragOverChar === charName ? "drag-target" : ""} ${draggedChar === charName ? "dragging-self" : ""}`}
            draggable={canDragReorder}
            style={{
              cursor: canDragReorder ? "grab" : "pointer",
            }}
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
              enabledCount: char.enabledCount || 0,
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
            <button
              type="button"
              className="hide-character-btn"
              disabled={hidingCharacter}
              title={t("characters.actions.hideHint")}
              aria-label={t("characters.actions.hideNamed", {
                charName,
              })}
              onClick={(event) => {
                event.stopPropagation();
                handleHideCharacter(charName);
              }}
              onPointerDown={(event) => event.stopPropagation()}
              onDragStart={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
            >
              <svg
                width={16}
                height={16}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.7}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden={true}
              >
                <path d="m3 3 18 18 M10.6 10.6a2 2 0 0 0 2.8 2.8 M9.9 5.2A11 11 0 0 1 12 5c7 0 10 7 10 7a17 17 0 0 1-3.2 4.3 M6.3 6.3A19 19 0 0 0 2 12s3 7 10 7a11 11 0 0 0 5.7-1.7" />
              </svg>
            </button>
            <button
              className="delete-btn"
              aria-label={t("characters.actions.deleteNamed", {
                charName,
              })}
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteModal(charName);
              }}
              title={t("characters.actions.delete")}
            >
              {"✕"}
            </button>
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
              <div className="card-stats-badge">
                <span className="icon">{"📦"}</span>
                <span className="count">
                  <span
                    style={{
                      color:
                        char.enabledCount > 0
                          ? "var(--color-accent-primary)"
                          : "inherit",
                    }}
                  >
                    {char.enabledCount || 0}
                  </span>
                  {"/"}
                  {char.modCount || 0}
                </span>
              </div>
              {skinCount > 0 && (
                <div
                  className="character-skin-count-badge"
                  aria-label={t("characters.grid.officialSkinsCount", {
                    skinCount,
                  })}
                >
                  <span aria-hidden="true">{"👗"}</span>
                  <strong>{skinCount}</strong>
                  <span>{t("characters.grid.skinsUnit")}</span>
                </div>
              )}
              {isPinned && <div className="character-pin-badge">{"📌"}</div>}
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
                    className="character-grid-input-field"
                  />
                ) : (
                  <React.Fragment>
                    <span
                      title={charName}
                      className="character-grid-truncated-text"
                    >
                      {charName}
                    </span>
                    <button
                      className="rename-btn character-grid-rename-btn-layout"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRenamingChar(charName);
                        setRenameValue(charName);
                        setTimeout(() => renameInputRef.current?.select(), 50);
                      }}
                      title={t("common.actions.rename")}
                    >
                      {"✏️"}
                    </button>
                  </React.Fragment>
                )}
              </div>
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
      {visibleCharacters.length === 0 && (
        <div className="character-empty-state form-pop-enter">
          <div className="character-empty-icon">{"🔍"}</div>
          <div className="character-empty-title">
            {t("characters.search.noMatches")}
          </div>
          <div className="character-empty-text">
            {t("characters.search.suggestion")}
          </div>
        </div>
      )}
    </div>
  );
}
