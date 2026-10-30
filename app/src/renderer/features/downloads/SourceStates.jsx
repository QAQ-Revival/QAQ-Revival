import { t } from "../../../shared/i18n/index.mjs";
import React from "react";
import { Icon } from "../../components/Icon.jsx";
import { isNetworkDownloadFailure } from "../../lib/downloadErrors.js";

// Placeholder cards shown while a source loads its first page.
function SkeletonGrid({ count = 8, label }) {
  return (
    <div className="media-grid" aria-busy={true} aria-label={label}>
      {Array.from({ length: count }, (_, index) => (
        <div className="media-card paw-skeleton" key={index}>
          <div className="media-card-image skeleton" />
          <div className="media-card-body">
            <span className="skeleton skeleton-line" />
            <span className="skeleton skeleton-line is-short" />
          </div>
        </div>
      ))}
    </div>
  );
}

// A failed source load: one human sentence and a retry. Raw transport errors stay in the tooltip.
function SourceError({ title, message, onRetry, retryLabel }) {
  const raw = String(message || "");
  const network = isNetworkDownloadFailure(raw);
  return (
    <div
      className="notice notice-danger source-error"
      role="alert"
      title={network ? raw : void 0}
    >
      <Icon name="alert" size={16} />
      <div className="source-error-copy">
        {title && <strong>{title}</strong>}
        <span>
          {network
            ? t("downloads.errors.network")
            : raw || t("common.errors.unknown")}
        </span>
      </div>
      {onRetry && (
        <button type="button" className="btn btn-sm" onClick={onRetry}>
          {retryLabel || t("common.actions.retry")}
        </button>
      )}
    </div>
  );
}

export { SkeletonGrid, SourceError };
