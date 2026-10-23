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
        onClick={() => setIniRollbackConfirm(null)}
        className="ini-rollback-dialog-overlay"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="ini-rollback-dialog-panel"
        >
          <div className="ini-rollback-dialog-content">{"↩️"}</div>
          <div className="ini-rollback-dialog-heading">
            {t("mods.rollback.confirmTitle", {
              name: iniRollbackConfirm.mod?.name,
            })}
          </div>
          <div className="ini-rollback-dialog-hint">
            {t("mods.rollback.description", {
              label:
                iniRollbackConfirm.backup?.label ||
                iniRollbackConfirm.backup?.stamp,
              fileCount: iniRollbackConfirm.backup?.fileCount || 0,
            })}
          </div>
          <div className="ini-rollback-dialog-actions">
            <button
              onClick={() => setIniRollbackConfirm(null)}
              className="ini-rollback-dialog-action"
            >
              {t("common.actions.cancel")}
            </button>
            <button
              onClick={confirmRollbackModIni}
              className="ini-rollback-dialog-confirm-rollback-mod-ini-action"
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
