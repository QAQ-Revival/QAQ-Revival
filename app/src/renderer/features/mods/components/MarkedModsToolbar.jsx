import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
import ReactDOM from "react-dom";
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
  return (
    markModeUnlocked &&
    ReactDOM.createPortal(
      <React.Fragment>
        <button
          onClick={() => setShowMarkToolbar((v) => !v)}
          title={t("mods.marked.toolbarLabel")}
          style={{
            background:
              Object.keys(markedMods).length > 0 ? "#f59e0b" : "#e5e7eb",
            color: Object.keys(markedMods).length > 0 ? "#fff" : "#6b7280",
          }}
          className="marked-mods-toolbar-floating-panel"
        >
          {"🔖"}
          {Object.keys(markedMods).length > 0 && (
            <span className="marked-mods-toolbar-row">
              {Object.keys(markedMods).length}
            </span>
          )}
        </button>
        {showMarkToolbar && (
          <React.Fragment>
            <div
              onClick={() => setShowMarkToolbar(false)}
              className="marked-mods-toolbar-overlay"
            />
            <div className="marked-mods-toolbar-floating-panel-spaced">
              <div className="marked-mods-toolbar-heading">
                {t("mods.marked.heading", {
                  keysCount: Object.keys(markedMods).length,
                })}
              </div>
              <div className="marked-mods-toolbar-destination-controls">
                <div
                  title={markDestFolder || t("common.status.unselected")}
                  style={{
                    color: markDestFolder ? "#555" : "#bbb",
                  }}
                  className="marked-mods-toolbar-truncated-text"
                >
                  {markDestFolder
                    ? markDestFolder.split(/[\\/]/).pop()
                    : t("mods.marked.noTargetFolder")}
                </div>
                <button
                  onClick={handleSelectDestFolder}
                  title={t("mods.marked.chooseTargetFolder")}
                  className="marked-mods-toolbar-select-dest-folder-action"
                >
                  {"📁"}
                </button>
              </div>
              <button
                className="btn btn-primary marked-mods-toolbar-btn-layout"
                onClick={handleMoveMarkedMods}
                disabled={
                  markMoving ||
                  !markDestFolder ||
                  Object.keys(markedMods).length === 0
                }
              >
                {markMoving
                  ? t("common.status.moving")
                  : t("mods.marked.moveToTarget")}
              </button>
              {markMoveRecord?.moves?.length > 0 && (
                <button
                  className="btn btn-secondary marked-mods-toolbar-btn-layout"
                  onClick={handleRestoreMarkedMods}
                  disabled={markMoving}
                >
                  {t("mods.marked.moveBack", {
                    movesCount: markMoveRecord.moves.length,
                  })}
                </button>
              )}
              <div className="marked-mods-toolbar-content" />
              <button
                className="btn btn-secondary marked-mods-toolbar-clear-marks"
                onClick={handleClearAllMarks}
              >
                {t("mods.marked.clearAll")}
              </button>
              <button
                onClick={() => {
                  setMarkModeUnlocked(false);
                  setShowMarkToolbar(false);
                }}
                className="marked-mods-toolbar-action"
              >
                {t("mods.marked.close")}
              </button>
            </div>
          </React.Fragment>
        )}
      </React.Fragment>,
      document.body,
    )
  );
}
