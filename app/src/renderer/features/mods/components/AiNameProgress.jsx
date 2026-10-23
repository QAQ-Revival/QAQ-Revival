import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
import ReactDOM from "react-dom";
export function AiNameProgress({
  aiNameTaskTarget,
  aiNameModalMinimized,
  aiNameTaskError,
  aiNameLoading,
  expandAiNameModal,
  aiNameStage,
  aiNameElapsedSeconds,
  closeAiNameTask,
}) {
  return (
    aiNameTaskTarget &&
    aiNameModalMinimized &&
    ReactDOM.createPortal(
      <div className="ai-name-progress-floating-panel">
        <div
          style={{
            borderRadius: "16px",
            border: `1px solid ${aiNameTaskError ? "#ef4444" : aiNameLoading ? "#8b5cf6" : "#22c55e"}`,
          }}
          className="ai-name-progress-column"
        >
          <button
            onClick={expandAiNameModal}
            className="ai-name-progress-expand-ai-name-modal-action"
          >
            <span
              style={{
                background: `linear-gradient(135deg, #6366f1, ${aiNameTaskError ? "#ef4444" : aiNameLoading ? "#8b5cf6" : "#22c55e"})`,
              }}
              className="ai-name-progress-row"
            >
              {aiNameLoading ? "🤖" : aiNameTaskError ? "⚠️" : "✅"}
            </span>
            <span className="ai-name-progress-content">
              <span className="ai-name-progress-heading">
                {aiNameLoading
                  ? t("mods.ai.backgroundRunning")
                  : aiNameTaskError
                    ? t("mods.ai.failed")
                    : t("mods.ai.completed")}
              </span>
              <span className="ai-name-progress-truncated-text">
                {aiNameTaskTarget.characterName}
                {" · "}
                {aiNameTaskTarget.modName}
              </span>
            </span>
            <span className="ai-name-progress-hint">
              {t("common.actions.expand")}
            </span>
          </button>
          <div className="ai-name-progress-content-spaced">
            <div className="ai-name-progress-progress-track">
              <div
                style={{
                  width: aiNameLoading
                    ? "56%"
                    : aiNameTaskError
                      ? "100%"
                      : "100%",
                  background: `linear-gradient(90deg, #6366f1, ${aiNameTaskError ? "#ef4444" : aiNameLoading ? "#8b5cf6" : "#22c55e"})`,
                }}
                className="ai-name-progress-progress-fill"
              />
            </div>
            <div className="ai-name-progress-status-actions">
              <div className="ai-name-progress-status-text">
                {aiNameLoading
                  ? t("mods.ai.nameProgress", {
                      aiNameStage: aiNameStage || t("mods.ai.analyzingShort"),
                      aiNameElapsedSeconds,
                    })
                  : aiNameTaskError || t("mods.ai.expandHint")}
              </div>
              {!aiNameLoading && (
                <button
                  onClick={closeAiNameTask}
                  title={t("market.publish.closeProgress")}
                  className="ai-name-progress-close-ai-name-task-action"
                >
                  {"✕"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>,
      document.body,
    )
  );
}
