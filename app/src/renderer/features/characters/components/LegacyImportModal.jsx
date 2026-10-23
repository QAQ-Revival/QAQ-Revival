import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
import ReactDOM from "react-dom";
function LegacyImportModal({ preview, migrating, onClose, onMigrate }) {
  if (!preview?.hasCandidates) return null;
  const targetPreview = preview.targetCharacters.slice(0, 6);
  const movePreview = preview.previewMoves.slice(0, 4);
  return ReactDOM.createPortal(
    <div
      className="legacy-import-overlay"
      onClick={() => !migrating && onClose?.()}
    >
      <div className="legacy-import-card" onClick={(e) => e.stopPropagation()}>
        <div className="legacy-import-hero">
          <div className="legacy-import-badge">
            {t("characters.organization.assistant")}
          </div>
          <button
            type="button"
            className="legacy-import-close"
            onClick={() => !migrating && onClose?.()}
            disabled={migrating}
          >
            {"✕"}
          </button>
          <div className="legacy-import-hero-main">
            <div className="legacy-import-hero-icon">{"🪄"}</div>
            <div>
              <h2>{t("characters.organization.unclassifiedTitle")}</h2>
              <p>
                {t("characters.organization.detectedPrefix")}
                <strong>{preview.categoryCount}</strong>
                {t("characters.organization.oldCategoryCountSuffix")}
                {preview.modCount > 0 ? (
                  <React.Fragment>
                    {t("characters.organization.availableMods", {
                      modCount: preview.modCount,
                    })}
                  </React.Fragment>
                ) : (
                  <React.Fragment>
                    {t("characters.organization.emptyCategoriesHint")}
                  </React.Fragment>
                )}
              </p>
            </div>
          </div>
        </div>
        <div className="legacy-import-body">
          <div className="legacy-import-note">
            {t("characters.organization.moveRules")}
          </div>
          {targetPreview.length > 0 && (
            <div className="legacy-import-section">
              <div className="legacy-import-label">
                {t("characters.organization.targetCharacters")}
              </div>
              <div className="legacy-import-tags">
                {targetPreview.map((name) => (
                  <span className="legacy-import-tag" key={name}>
                    {name}
                  </span>
                ))}
                {preview.targetCharacters.length > targetPreview.length && (
                  <span className="legacy-import-tag muted">
                    {"+"}
                    {preview.targetCharacters.length - targetPreview.length}
                  </span>
                )}
              </div>
            </div>
          )}
          {movePreview.length > 0 && (
            <div className="legacy-import-section">
              <div className="legacy-import-label">
                {t("characters.organization.moveExamples")}
              </div>
              <div className="legacy-import-list">
                {movePreview.map((item, index) => (
                  <div
                    className="legacy-import-list-item"
                    key={`${item.sourceCategoryName}-${item.modName}-${index}`}
                  >
                    <span className="legacy-import-source">
                      {item.sourceCategoryName}
                    </span>
                    <span className="legacy-import-arrow">{"→"}</span>
                    <span className="legacy-import-target">
                      {item.targetDisplayName}
                    </span>
                    <span className="legacy-import-mod">{item.modName}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="legacy-import-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={migrating}
            >
              {t("common.actions.skipForNow")}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={onMigrate}
              disabled={migrating}
            >
              {migrating
                ? t("characters.organization.processing")
                : t("characters.organization.confirm")}
            </button>
          </div>
        </div>
      </div>
      {null}
    </div>,
    document.body,
  );
}
export { LegacyImportModal };
