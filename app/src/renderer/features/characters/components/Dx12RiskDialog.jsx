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
      <div className="dx12-risk-dialog-content">
        <h2 className="dx12-risk-dialog-centered-content">
          {t("characters.mode.confirmPakTitle")}
        </h2>
        <div className="dx12-risk-dialog-panel">
          {t("characters.mode.confirmPakDescription")}
        </div>
        <div className="dx12-risk-dialog-content-muted">
          {t("characters.mode.pakPathPrefix")}
          <strong className="dx12-risk-dialog-pak-path">
            {t("characters.mode.pakPathExample", {
              pakDirName: nevernessDx12Status?.paths?.pakDirName || "MOD",
            })}
          </strong>
          {t("characters.mode.pakLoaderDescription")}
        </div>
        <div className="modal-actions dx12-risk-dialog-modal-actions-layout">
          <button
            className="btn btn-secondary"
            onClick={() => setShowDx12RiskConfirm(false)}
            disabled={dx12Busy}
          >
            {t("common.actions.cancel")}
          </button>
          <button
            className="btn btn-primary dx12-risk-dialog-btn-layout"
            onClick={confirmEnableDx12Mode}
            disabled={dx12Busy}
          >
            {dx12Busy
              ? t("common.status.processing")
              : t("characters.mode.confirmPak")}
          </button>
        </div>
      </div>,
      () => !dx12Busy && setShowDx12RiskConfirm(false),
      {
        width: "min(680px, calc(100vw - 64px))",
        maxWidth: "min(680px, calc(100vw - 64px))",
        padding: "34px 42px",
        textAlign: "left",
      },
    )
  );
}
