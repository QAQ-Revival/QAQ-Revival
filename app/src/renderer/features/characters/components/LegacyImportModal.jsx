import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
import ReactDOM from "react-dom";
import { Icon } from "../../../components/Icon.jsx";
function LegacyImportModal({ preview, migrating, onClose, onMigrate }) {
  if (!preview?.hasCandidates) return null;
  const targetPreview = preview.targetCharacters.slice(0, 8);
  const movePreview = preview.previewMoves.slice(0, 6);
  return ReactDOM.createPortal(
    <div
      className="modal-backdrop legacy-import-overlay"
      onClick={() => !migrating && onClose?.()}
    >
      <div
        className="modal-content legacy-import-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="legacy-import-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="legacy-import-title" className="dialog-title">
          {t("characters.organization.unclassifiedTitle")}
        </h2>
        <p className="dialog-desc">
          {preview.modCount > 0
            ? t("characters.organization.availableMods", {
                categoryCount: preview.categoryCount,
                modCount: preview.modCount,
              })
            : t("characters.organization.emptyCategoriesHint", {
                categoryCount: preview.categoryCount,
              })}
        </p>
        <div className="dialog-body legacy-import-body">
          {targetPreview.length > 0 && (
            <div>
              <div className="legacy-import-label">
                {t("characters.organization.targetCharacters")}
              </div>
              <div className="legacy-import-tags">
                {targetPreview.map((name) => (
                  <span className="badge" key={name}>
                    {name}
                  </span>
                ))}
                {preview.targetCharacters.length > targetPreview.length && (
                  <span className="badge">
                    {"+"}
                    {preview.targetCharacters.length - targetPreview.length}
                  </span>
                )}
              </div>
            </div>
          )}
          {movePreview.length > 0 && (
            <div>
              <div className="legacy-import-label">
                {t("characters.organization.moveExamples")}
              </div>
              <div className="legacy-import-list">
                {movePreview.map((item, index) => (
                  <div
                    className="legacy-import-move"
                    key={`${item.sourceCategoryName}-${item.modName}-${index}`}
                  >
                    <span className="legacy-import-mod" title={item.modName}>
                      {item.modName}
                    </span>
                    <span className="legacy-import-source" title={item.sourceCategoryName}>
                      {item.sourceCategoryName}
                    </span>
                    <Icon name="arrow-right" size={13} />
                    <span className="legacy-import-target" title={item.targetDisplayName}>
                      {item.targetDisplayName}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <p className="legacy-import-note">{t("characters.organization.moveRules")}</p>
        </div>
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onClose} disabled={migrating}>
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
    </div>,
    document.body,
  );
}
export { LegacyImportModal };
