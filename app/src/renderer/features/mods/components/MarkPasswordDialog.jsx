import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
import ReactDOM from "react-dom";
export function MarkPasswordDialog({
  showMarkPasswordModal,
  setShowMarkPasswordModal,
  markPasswordInput,
  setMarkPasswordInput,
  setMarkPasswordError,
  handleMarkPasswordSubmit,
  markPasswordError,
}) {
  return (
    showMarkPasswordModal &&
    ReactDOM.createPortal(
      <div
        className="modal-backdrop"
        onClick={() => setShowMarkPasswordModal(false)}
      >
        <div
          className="modal-content mark-password-dialog-modal-content-layout"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mark-password-dialog-heading">
            {t("mods.marked.passwordPrompt")}
          </div>
          <input
            type="password"
            autoFocus={true}
            value={markPasswordInput}
            onChange={(e) => {
              setMarkPasswordInput(e.target.value);
              setMarkPasswordError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleMarkPasswordSubmit();
              if (e.key === "Escape") setShowMarkPasswordModal(false);
            }}
            placeholder={t("common.fields.password")}
            style={{
              borderRadius: "8px",
              border: markPasswordError
                ? "1.5px solid #e74c3c"
                : "1.5px solid #ddd",
            }}
            className="mark-password-dialog-input-field"
          />
          {markPasswordError && (
            <div className="mark-password-dialog-hint">{markPasswordError}</div>
          )}
          <div className="mark-password-dialog-row">
            <button
              className="btn btn-primary direct-import-dialog-content"
              onClick={handleMarkPasswordSubmit}
            >
              {t("common.actions.confirm")}
            </button>
            <button
              className="btn btn-secondary direct-import-dialog-content"
              onClick={() => setShowMarkPasswordModal(false)}
            >
              {t("common.actions.cancel")}
            </button>
          </div>
        </div>
      </div>,
      document.body,
    )
  );
}
