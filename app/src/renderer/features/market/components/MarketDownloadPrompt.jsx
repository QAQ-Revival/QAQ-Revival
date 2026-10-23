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
        className="market-download-prompt-overlay"
        onClick={() => setDownloadPrompt(null)}
      >
        <div
          className="market-download-prompt-dialog"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="market-download-prompt-icon">{"↓"}</div>
          <h3>{t("market.downloadPrompt.unavailableTitle")}</h3>
          <p>
            {downloadPrompt.type === "login_required"
              ? downloadPrompt.sessionExpired
                ? t("market.downloadPrompt.sessionExpired")
                : t("market.downloadPrompt.loginRequired")
              : t("market.downloadPrompt.sourceUnavailable")}
          </p>
          <div className="market-download-prompt-actions">
            <button
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
