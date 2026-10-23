import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
import ReactDOM from "react-dom";
export function AiTagDialog({
  showAiTagModal,
  setShowAiTagModal,
  aiTagLoading,
  aiTagStage,
  aiTagElapsedSeconds,
  aiTagSuggestions,
  setAiTagSuggestions,
  aiTagEmptyReason,
  applyAiSuggestions,
  handleAiSuggestTags,
}) {
  return (
    showAiTagModal &&
    ReactDOM.createPortal(
      <div
        onClick={() => setShowAiTagModal(false)}
        className="ai-name-dialog-overlay"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="ai-tag-dialog-panel"
        >
          <div className="ai-tag-dialog-heading">{t("mods.ai.tagTitle")}</div>
          {aiTagLoading ? (
            <div className="ai-name-dialog-centered-content">
              <div className="ai-tag-dialog-heading-emphasis">
                {aiTagStage || t("mods.ai.analyzing")}
              </div>
              <div className="ai-tag-dialog-hint">
                {t("mods.ai.tagElapsed", {
                  aiTagElapsedSeconds,
                })}
              </div>
              {aiTagElapsedSeconds >= 20 && (
                <div className="ai-tag-dialog-slow-response-hint">
                  {t("mods.ai.slowResponse")}
                </div>
              )}
            </div>
          ) : (
            <React.Fragment>
              <div className="ai-tag-dialog-row">
                {aiTagSuggestions.map((s, i) => (
                  <span
                    onClick={() =>
                      setAiTagSuggestions((prev) =>
                        prev.map((x, j) =>
                          j === i
                            ? {
                                ...x,
                                selected: !x.selected,
                              }
                            : x,
                        ),
                      )
                    }
                    style={{
                      fontSize: "12px",
                      background: s.selected ? "#6366f1" : "#f3f4f6",
                      color: s.selected ? "#fff" : "#374151",
                      fontWeight: s.selected ? "600" : "400",
                    }}
                    key={i}
                    className="ai-tag-dialog-content"
                  >
                    {s.name}
                  </span>
                ))}
                {aiTagSuggestions.length === 0 && (
                  <div
                    style={{
                      color: "#6b7280",
                    }}
                    className="ai-tag-dialog-empty-result-hint"
                  >
                    {aiTagEmptyReason || t("mods.ai.noUsableTags")}
                  </div>
                )}
              </div>
              <div className="ai-tag-dialog-selection-hint">
                {t("mods.ai.selectExistingTagsHint")}
              </div>
              <div className="ai-tag-dialog-actions">
                <button
                  onClick={() => setShowAiTagModal(false)}
                  className="ai-name-dialog-close-ai-name-task-action"
                >
                  {t("common.actions.cancel")}
                </button>
                <button
                  onClick={
                    aiTagSuggestions.length > 0
                      ? applyAiSuggestions
                      : handleAiSuggestTags
                  }
                  className="ai-name-dialog-ai-suggest-name-action"
                >
                  {aiTagSuggestions.length > 0
                    ? t("mods.ai.addSelected")
                    : t("mods.ai.recommendAgain")}
                </button>
              </div>
            </React.Fragment>
          )}
        </div>
      </div>,
      document.body,
    )
  );
}
