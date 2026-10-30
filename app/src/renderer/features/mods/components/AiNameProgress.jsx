import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
import ReactDOM from "react-dom";
import { Icon } from "../../../components/Icon.jsx";
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
      <div className="task-float ai-name-float">
        <button type="button" className="task-float-main" onClick={expandAiNameModal}>
          {aiNameLoading ? (
            <span className="spinner" aria-hidden="true" />
          ) : aiNameTaskError ? (
            <Icon name="alert" size={16} className="is-danger" />
          ) : (
            <Icon name="check" size={16} className="is-success" />
          )}
          <span className="task-float-copy">
            <strong>
              {aiNameLoading
                ? t("mods.ai.backgroundRunning")
                : aiNameTaskError
                  ? t("mods.ai.failed")
                  : t("mods.ai.completed")}
            </strong>
            <span>
              {aiNameTaskTarget.characterName}
              {" · "}
              {aiNameTaskTarget.modName}
            </span>
          </span>
          <span className="task-float-action">{t("common.actions.expand")}</span>
        </button>
        <div className="progress-track">
          <div
            className={`progress-fill ${aiNameTaskError ? "is-danger" : ""}`}
            style={{ width: aiNameLoading ? "56%" : "100%" }}
          />
        </div>
        <div className="task-float-status">
          <span>
            {aiNameLoading
              ? t("mods.ai.nameProgress", {
                  aiNameStage: aiNameStage || t("mods.ai.analyzingShort"),
                  aiNameElapsedSeconds,
                })
              : aiNameTaskError || t("mods.ai.expandHint")}
          </span>
          {!aiNameLoading && (
            <button
              type="button"
              className="icon-btn icon-btn-sm"
              onClick={closeAiNameTask}
              title={t("market.publish.closeProgress")}
              aria-label={t("market.publish.closeProgress")}
            >
              <Icon name="x" size={14} />
            </button>
          )}
        </div>
      </div>,
      document.body,
    )
  );
}
