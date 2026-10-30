import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
import { Icon } from "../../../components/Icon.jsx";
function PublishProgressFloat({
  target,
  state,
  visible,
  onExpand,
  onClose,
  offsetIndex = 0,
}) {
  if (!target || visible) return null;
  const phase = state?.phase || "form";
  const total = Number(state?.progressTotal) || 0;
  const step = Number(state?.progressStep) || 0;
  const percent =
    total > 0
      ? Math.max(0, Math.min(100, Math.round((step / total) * 100)))
      : 0;
  const isPublishing = phase === "publishing";
  const isDone = phase === "done";
  const isError = phase === "error";
  const canClose = phase !== "publishing";
  const title = isPublishing
    ? t("market.publish.backgroundRunning")
    : isDone
      ? t("market.publish.completed")
      : isError
        ? t("market.publish.failed")
        : t("market.publish.preparing");
  const metrics = state?.uploadMetrics;
  const statusText = metrics?.speed
    ? `R2 ${metrics.percent ? `${metrics.percent}% · ` : ""}${metrics.speed}`
    : state?.progressMessage ||
      state?.resultMessage ||
      t("market.publish.expandProgressHint");
  return (
    <div
      className="task-float"
      // Concurrent publishes stack upward; the offset is the stack position.
      style={{ bottom: `${54 + offsetIndex * 104}px` }}
    >
      <button type="button" className="task-float-main" onClick={onExpand}>
        {isPublishing ? (
          <span className="spinner" aria-hidden="true" />
        ) : isDone ? (
          <Icon name="check" size={16} className="is-success" />
        ) : isError ? (
          <Icon name="alert" size={16} className="is-danger" />
        ) : (
          <Icon name="upload" size={16} />
        )}
        <span className="task-float-copy">
          <strong>{title}</strong>
          <span>
            {target.characterName}
            {" · "}
            {target.modName}
          </span>
        </span>
        <span className="task-float-action">
          {isPublishing ? `${percent}%` : t("common.actions.expand")}
        </span>
      </button>
      <div className="progress-track">
        <div
          className={`progress-fill ${isError ? "is-danger" : ""}`}
          style={{ width: `${isPublishing ? percent : isDone ? 100 : 0}%` }}
        />
      </div>
      <div className="task-float-status">
        <span title={statusText}>{statusText}</span>
        {canClose && (
          <button
            type="button"
            className="icon-btn icon-btn-sm"
            onClick={onClose}
            title={t("market.publish.closeProgress")}
            aria-label={t("market.publish.closeProgress")}
          >
            <Icon name="x" size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
export { PublishProgressFloat };
