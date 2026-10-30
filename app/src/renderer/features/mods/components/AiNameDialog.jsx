import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
import ReactDOM from "react-dom";
import { Icon } from "../../../components/Icon.jsx";
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
  const result = aiNameTaskResult || aiNameResult;
  const dismiss = aiNameLoading ? minimizeAiNameModal : closeAiNameTask;
  return (
    showAiNameModal &&
    !aiNameModalMinimized &&
    ReactDOM.createPortal(
      <div className="modal-backdrop" onClick={dismiss}>
        <div
          className="modal-content ai-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ai-name-title"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="ai-dialog-head">
            <h2 id="ai-name-title" className="dialog-title">
              {t("mods.ai.nameTitle")}
            </h2>
            <button
              type="button"
              className="icon-btn icon-btn-sm"
              onClick={dismiss}
              aria-label={
                aiNameLoading ? t("mods.ai.minimize") : t("common.actions.close")
              }
              title={aiNameLoading ? t("mods.ai.minimize") : t("common.actions.close")}
            >
              <Icon name={aiNameLoading ? "minus" : "x"} size={15} />
            </button>
          </div>
          <p className="dialog-desc ai-dialog-current" title={aiNameTaskTarget?.modName || selectedMod?.name}>
            {t("mods.ai.currentPrefix")}
            {aiNameTaskTarget?.modName || selectedMod?.name}
          </p>
          {aiNameLoading ? (
            <div className="ai-dialog-waiting" role="status">
              <span className="spinner" aria-hidden="true" />
              <div className="ai-dialog-stage">{aiNameStage || t("mods.ai.analyzing")}</div>
              <div className="ai-dialog-elapsed">
                {t("mods.ai.nameElapsed", { aiNameElapsedSeconds })}
              </div>
              {aiNameElapsedSeconds >= 20 && (
                <div className="ai-dialog-elapsed">{t("mods.ai.slowResponse")}</div>
              )}
            </div>
          ) : aiNameTaskError ? (
            <div className="notice notice-danger dialog-body" role="alert">
              <Icon name="alert" size={14} />
              <span>{t("mods.ai.nameFailed", { aiNameTaskError })}</span>
            </div>
          ) : result ? (
            <React.Fragment>
              <div className="dialog-body ai-dialog-results">
                {result.groups.map((g, gi) => (
                  <div key={gi}>
                    <div className="ai-dialog-group-label">{g.label}</div>
                    {g.items.map((item, ii) => (
                      <div key={ii} className="ai-dialog-suggestion">
                        <span className="selectable" title={item.fullName}>
                          {item.fullName}
                        </span>
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => applyAiName(item.fullName, aiNameTaskTarget)}
                        >
                          {t("common.actions.use")}
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
                {result.tags?.length > 0 && (
                  <div>
                    <div className="ai-dialog-group-label">
                      <span>{t("mods.ai.recommendedTags")}</span>
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() => applyAiTags(result.tags, aiNameTaskTarget)}
                      >
                        {t("mods.ai.addAll")}
                      </button>
                    </div>
                    <div className="ai-dialog-tags">
                      {result.tags.map((tag, ti) => {
                        const alreadyAdded = modTags.includes(tag);
                        return (
                          <button
                            type="button"
                            className={`chip ${alreadyAdded ? "active" : ""}`}
                            aria-pressed={alreadyAdded}
                            disabled={alreadyAdded}
                            onClick={() => applyAiTags([tag], aiNameTaskTarget)}
                            key={ti}
                          >
                            {alreadyAdded && <Icon name="check" size={12} />}
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              <div className="dialog-actions">
                <button type="button" className="btn" onClick={closeAiNameTask}>
                  {t("common.actions.close")}
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleAiSuggestName}
                  disabled={aiNameLoading}
                >
                  {t("mods.ai.recommendAgain")}
                </button>
              </div>
            </React.Fragment>
          ) : (
            <div className="ai-dialog-waiting">{t("mods.ai.noResults")}</div>
          )}
        </div>
      </div>,
      document.body,
    )
  );
}
