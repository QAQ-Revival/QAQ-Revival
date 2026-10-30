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
          className="modal-content"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mark-password-title"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 id="mark-password-title" className="dialog-title">
            {t("mods.marked.passwordPrompt")}
          </h2>
          <div className="dialog-body">
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
              aria-invalid={!!markPasswordError}
              className={`input ${markPasswordError ? "is-invalid" : ""}`}
            />
            {markPasswordError && (
              <div className="dialog-field-error" role="alert">
                {markPasswordError}
              </div>
            )}
          </div>
          <div className="dialog-actions">
            <button
              type="button"
              className="btn"
              onClick={() => setShowMarkPasswordModal(false)}
            >
              {t("common.actions.cancel")}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleMarkPasswordSubmit}
            >
              {t("common.actions.confirm")}
            </button>
          </div>
        </div>
      </div>,
      document.body,
    )
  );
}
