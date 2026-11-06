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
      <div className="modal-backdrop" onClick={() => setShowAiTagModal(false)}>
        <div
          className="modal-content ai-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ai-tag-title"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 id="ai-tag-title" className="dialog-title">
            {t("mods.ai.tagTitle")}
          </h2>
          {aiTagLoading ? (
            <div className="ai-dialog-waiting" role="status">
              <span className="spinner" aria-hidden="true" />
              <div className="ai-dialog-stage">{aiTagStage || t("mods.ai.analyzing")}</div>
              <div className="ai-dialog-elapsed">
                {t("mods.ai.tagElapsed", { aiTagElapsedSeconds })}
              </div>
              {aiTagElapsedSeconds >= 20 && (
                <div className="ai-dialog-elapsed">{t("mods.ai.slowResponse")}</div>
              )}
            </div>
          ) : (
            <React.Fragment>
              <p className="dialog-desc">{t("mods.ai.selectExistingTagsHint")}</p>
              <div className="dialog-body ai-dialog-tags">
                {aiTagSuggestions.map((s, i) => (
                  <button
                    type="button"
                    className={`chip ${s.selected ? "active" : ""}`}
                    aria-pressed={!!s.selected}
                    onClick={() =>
                      setAiTagSuggestions((prev) =>
                        prev.map((x, j) =>
                          j === i ? { ...x, selected: !x.selected } : x,
                        ),
                      )
                    }
                    key={i}
                  >
                    {s.name}
                  </button>
                ))}
                {aiTagSuggestions.length === 0 && (
                  <div className="ai-dialog-elapsed">
                    {aiTagEmptyReason || t("mods.ai.noUsableTags")}
                  </div>
                )}
              </div>
              <div className="dialog-actions">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowAiTagModal(false)}
                >
                  {t("common.actions.cancel")}
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={
                    aiTagSuggestions.length > 0
                      ? applyAiSuggestions
                      : handleAiSuggestTags
                  }
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
