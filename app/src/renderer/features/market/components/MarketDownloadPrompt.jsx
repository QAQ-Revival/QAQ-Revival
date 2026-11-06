import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
import ReactDOM from "react-dom";
export function MarketDownloadPrompt({
  downloadPrompt,
  isActive,
  setDownloadPrompt,
}) {
  return (
    downloadPrompt &&
    isActive &&
    ReactDOM.createPortal(
      <div
        className="modal-backdrop market-stacked-backdrop"
        onClick={() => setDownloadPrompt(null)}
      >
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <h3 className="dialog-title">
            {t("market.downloadPrompt.unavailableTitle")}
          </h3>
          <p className="dialog-desc">
            {downloadPrompt.type === "login_required"
              ? downloadPrompt.sessionExpired
                ? t("market.downloadPrompt.sessionExpired")
                : t("market.downloadPrompt.loginRequired")
              : t("market.downloadPrompt.sourceUnavailable")}
          </p>
          <div className="dialog-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setDownloadPrompt(null)}
            >
              {t("common.actions.acknowledge")}
            </button>
          </div>
        </div>
      </div>,
      document.body,
    )
  );
}
