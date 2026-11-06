import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
export function Dx12RiskDialog({
  showDx12RiskConfirm,
  renderManagementModal,
  nevernessDx12Status,
  setShowDx12RiskConfirm,
  dx12Busy,
  confirmEnableDx12Mode,
}) {
  return (
    showDx12RiskConfirm &&
    renderManagementModal(
      <React.Fragment>
        <h2 className="dialog-title">{t("characters.mode.confirmPakTitle")}</h2>
        <p className="dialog-desc">{t("characters.mode.confirmPakDescription")}</p>
        <div className="dialog-body dx12-risk-path">
          <span>{t("characters.mode.pakPathPrefix")}</span>
          <code className="selectable">
            {t("characters.mode.pakPathExample", {
              pakDirName: nevernessDx12Status?.paths?.pakDirName || "MOD",
            })}
          </code>
        </div>
        <div className="dialog-actions">
          <button
            type="button"
            className="btn"
            onClick={() => setShowDx12RiskConfirm(false)}
            disabled={dx12Busy}
          >
            {t("common.actions.cancel")}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={confirmEnableDx12Mode}
            disabled={dx12Busy}
          >
            {dx12Busy
              ? t("common.status.processing")
              : t("characters.mode.confirmPak")}
          </button>
        </div>
      </React.Fragment>,
      () => !dx12Busy && setShowDx12RiskConfirm(false),
    )
  );
}
