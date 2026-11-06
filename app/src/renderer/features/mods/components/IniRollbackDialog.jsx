import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
import ReactDOM from "react-dom";
export function IniRollbackDialog({
  iniRollbackConfirm,
  setIniRollbackConfirm,
  confirmRollbackModIni,
}) {
  return (
    iniRollbackConfirm &&
    ReactDOM.createPortal(
      <div
        className="modal-backdrop"
        onClick={() => setIniRollbackConfirm(null)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setIniRollbackConfirm(null);
        }}
      >
        <div
          className="modal-content"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="ini-rollback-title"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 id="ini-rollback-title" className="dialog-title">
            {t("mods.rollback.confirmTitle", {
              name: iniRollbackConfirm.mod?.name,
            })}
          </h2>
          <p className="dialog-desc">
            {t("mods.rollback.description", {
              label:
                iniRollbackConfirm.backup?.label ||
                iniRollbackConfirm.backup?.stamp,
              fileCount: iniRollbackConfirm.backup?.fileCount || 0,
            })}
          </p>
          <div className="dialog-actions">
            <button
              type="button"
              className="btn"
              onClick={() => setIniRollbackConfirm(null)}
            >
              {t("common.actions.cancel")}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              autoFocus={true}
              onClick={confirmRollbackModIni}
            >
              {t("mods.rollback.confirm")}
            </button>
          </div>
        </div>
      </div>,
      document.body,
    )
  );
}
