import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
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
  const accent = isError ? "#ef4444" : isDone ? "#22c55e" : "#f59e0b";
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
  const bottom = 54 + offsetIndex * 128;
  return (
    <div
      style={{
        bottom: `${bottom}px`,
      }}
      className="publish-progress-float-floating-panel"
    >
      <div
        style={{
          borderRadius: "16px",
          border: `1px solid ${accent}`,
        }}
        className="publish-progress-float-column"
      >
        <button
          onClick={onExpand}
          className="publish-progress-float-expand-action"
        >
          <span
            style={{
              background: `linear-gradient(135deg, #6366f1, ${accent})`,
            }}
            className="publish-progress-float-row"
          >
            {isPublishing ? "🚀" : isDone ? "✅" : isError ? "⚠️" : "📤"}
          </span>
          <span className="publish-progress-float-content">
            <span className="publish-progress-float-heading">{title}</span>
            <span className="publish-progress-float-truncated-text">
              {target.characterName}
              {" · "}
              {target.modName}
            </span>
          </span>
          <span className="publish-progress-float-hint">
            {isPublishing ? `${percent}%` : t("common.actions.expand")}
          </span>
        </button>
        <div className="publish-progress-float-content-spaced">
          <div className="publish-progress-float-progress-track">
            <div
              style={{
                width: `${isPublishing ? percent : isDone ? 100 : 0}%`,
                background: `linear-gradient(90deg, #6366f1, ${accent})`,
              }}
              className="publish-progress-float-progress-fill"
            />
          </div>
          <div className="publish-progress-float-status-actions">
            <div className="publish-progress-float-status-text">
              {statusText}
            </div>
            {canClose && (
              <button
                onClick={onClose}
                title={t("market.publish.closeProgress")}
                className="publish-progress-float-close-action"
              >
                {"✕"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
export { PublishProgressFloat };
