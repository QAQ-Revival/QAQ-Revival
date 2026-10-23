import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
import ReactDOM from "react-dom";
export function AiNameDialog({
  showAiNameModal,
  aiNameModalMinimized,
  aiNameLoading,
  minimizeAiNameModal,
  closeAiNameTask,
  aiNameTaskTarget,
  selectedMod,
  aiNameStage,
  aiNameElapsedSeconds,
  aiNameTaskError,
  aiNameTaskResult,
  aiNameResult,
  applyAiName,
  applyAiTags,
  modTags,
  handleAiSuggestName,
}) {
  return (
    showAiNameModal &&
    !aiNameModalMinimized &&
    ReactDOM.createPortal(
      <div
        onClick={aiNameLoading ? minimizeAiNameModal : closeAiNameTask}
        className="ai-name-dialog-overlay"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="ai-name-dialog-panel"
        >
          <div className="ai-name-dialog-row">
            <div className="ai-name-dialog-heading">
              {t("mods.ai.nameTitle")}
            </div>
            <button
              onClick={aiNameLoading ? minimizeAiNameModal : closeAiNameTask}
              className="ai-name-dialog-action"
            >
              {aiNameLoading ? "—" : "✕"}
            </button>
          </div>
          <div className="ai-name-dialog-hint">
            {t("mods.ai.currentPrefix")}
            <code className="ai-name-dialog-content">
              {aiNameTaskTarget?.modName || selectedMod?.name}
            </code>
          </div>
          {aiNameLoading ? (
            <div className="ai-name-dialog-centered-content">
              <div className="ai-name-dialog-heading-emphasis">
                {aiNameStage || t("mods.ai.analyzing")}
              </div>
              <div className="ai-name-dialog-elapsed-time">
                {t("mods.ai.nameElapsed", {
                  aiNameElapsedSeconds,
                })}
              </div>
              {aiNameElapsedSeconds >= 20 && (
                <div className="ai-name-dialog-slow-response-hint">
                  {t("mods.ai.slowResponse")}
                </div>
              )}
              <button
                onClick={minimizeAiNameModal}
                className="ai-name-dialog-minimize-ai-name-modal-action"
              >
                {t("mods.ai.minimize")}
              </button>
            </div>
          ) : aiNameTaskError ? (
            <div className="ai-name-dialog-error-text">
              {t("mods.ai.nameFailed", {
                aiNameTaskError,
              })}
            </div>
          ) : aiNameTaskResult || aiNameResult ? (
            <React.Fragment>
              {(aiNameTaskResult || aiNameResult).groups.map((g, gi) => (
                <div key={gi} className="ai-name-dialog-suggestion-group">
                  <div className="ai-name-dialog-suggestion-group-label">
                    {g.label}
                  </div>
                  {g.items.map((item, ii) => (
                    <div
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "#eef2ff";
                        e.currentTarget.style.borderColor = "#6366f1";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "#f9fafb";
                        e.currentTarget.style.borderColor = "#e5e7eb";
                      }}
                      key={ii}
                      className="ai-name-dialog-suggestion-row"
                    >
                      <span className="ai-name-dialog-content-emphasis">
                        {item.fullName}
                      </span>
                      <button
                        onClick={() =>
                          applyAiName(item.fullName, aiNameTaskTarget)
                        }
                        className="ai-name-dialog-action-emphasis"
                      >
                        {t("common.actions.use")}
                      </button>
                    </div>
                  ))}
                </div>
              ))}
              {(aiNameTaskResult || aiNameResult).tags?.length > 0 && (
                <div className="ai-name-dialog-recommended-tags">
                  <div className="ai-name-dialog-recommended-tags-heading">
                    <span className="ai-name-dialog-recommended-tags-title">
                      {t("mods.ai.recommendedTags")}
                    </span>
                    <button
                      onClick={() =>
                        applyAiTags(
                          (aiNameTaskResult || aiNameResult).tags,
                          aiNameTaskTarget,
                        )
                      }
                      className="ai-name-dialog-add-recommended-tags"
                    >
                      {t("mods.ai.addAll")}
                    </button>
                  </div>
                  <div className="ai-name-dialog-recommended-tag-list">
                    {(aiNameTaskResult || aiNameResult).tags.map((tag, ti) => {
                      const alreadyAdded = modTags.includes(tag);
                      return (
                        <span
                          onClick={() =>
                            !alreadyAdded &&
                            applyAiTags([tag], aiNameTaskTarget)
                          }
                          style={{
                            borderRadius: "12px",
                            background: alreadyAdded ? "#d1fae5" : "#f3f4f6",
                            color: alreadyAdded ? "#059669" : "#374151",
                            cursor: alreadyAdded ? "default" : "pointer",
                            border: alreadyAdded
                              ? "1px solid #a7f3d0"
                              : "1px solid #e5e7eb",
                          }}
                          key={ti}
                          className="ai-name-dialog-hint-emphasis"
                        >
                          {alreadyAdded ? "✓ " : ""}
                          {tag}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="ai-name-dialog-actions">
                <button
                  onClick={closeAiNameTask}
                  className="ai-name-dialog-close-ai-name-task-action"
                >
                  {t("common.actions.close")}
                </button>
                <button
                  onClick={handleAiSuggestName}
                  disabled={aiNameLoading}
                  style={{
                    opacity: aiNameLoading ? 0.6 : 1,
                  }}
                  className="ai-name-dialog-ai-suggest-name-action"
                >
                  {t("mods.ai.recommendAgain")}
                </button>
              </div>
            </React.Fragment>
          ) : (
            <div className="ai-name-dialog-empty-result-hint">
              {t("mods.ai.noResults")}
            </div>
          )}
        </div>
      </div>,
      document.body,
    )
  );
}
