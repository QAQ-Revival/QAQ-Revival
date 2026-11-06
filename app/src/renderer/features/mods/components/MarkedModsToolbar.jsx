import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
import ReactDOM from "react-dom";
import { Icon } from "../../../components/Icon.jsx";
export function MarkedModsToolbar({
  markModeUnlocked,
  setShowMarkToolbar,
  markedMods,
  showMarkToolbar,
  markDestFolder,
  handleSelectDestFolder,
  handleMoveMarkedMods,
  markMoving,
  markMoveRecord,
  handleRestoreMarkedMods,
  handleClearAllMarks,
  setMarkModeUnlocked,
}) {
  const count = Object.keys(markedMods).length;
  return (
    markModeUnlocked &&
    ReactDOM.createPortal(
      <div
        className={`marked-toolbar ${showMarkToolbar ? "is-open" : ""}`}
        role="toolbar"
        aria-label={t("mods.marked.toolbarLabel")}
      >
        <button
          type="button"
          className="marked-toolbar-toggle"
          onClick={() => setShowMarkToolbar((v) => !v)}
          title={t("mods.marked.toolbarLabel")}
          aria-expanded={!!showMarkToolbar}
        >
          <Icon name="bookmark" size={14} />
          <span>{t("mods.marked.heading", { keysCount: count })}</span>
        </button>
        {showMarkToolbar && (
          <React.Fragment>
            <span className="marked-toolbar-sep" />
            <button
              type="button"
              className="btn btn-sm btn-ghost marked-toolbar-folder"
              onClick={handleSelectDestFolder}
              title={markDestFolder || t("mods.marked.chooseTargetFolder")}
            >
              <Icon name="folder" size={13} />
              <span>
                {markDestFolder
                  ? markDestFolder.split(/[\\/]/).pop()
                  : t("mods.marked.noTargetFolder")}
              </span>
            </button>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={handleMoveMarkedMods}
              disabled={markMoving || !markDestFolder || count === 0}
            >
              {markMoving
                ? t("common.status.moving")
                : t("mods.marked.moveToTarget")}
            </button>
            {markMoveRecord?.moves?.length > 0 && (
              <button
                type="button"
                className="btn btn-sm"
                onClick={handleRestoreMarkedMods}
                disabled={markMoving}
              >
                {t("mods.marked.moveBack", {
                  movesCount: markMoveRecord.moves.length,
                })}
              </button>
            )}
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={handleClearAllMarks}
            >
              {t("mods.marked.clearAll")}
            </button>
            <button
              type="button"
              className="icon-btn icon-btn-sm"
              onClick={() => {
                setMarkModeUnlocked(false);
                setShowMarkToolbar(false);
              }}
              aria-label={t("mods.marked.close")}
              title={t("mods.marked.close")}
            >
              <Icon name="x" size={14} />
            </button>
          </React.Fragment>
        )}
      </div>,
      document.body,
    )
  );
}
