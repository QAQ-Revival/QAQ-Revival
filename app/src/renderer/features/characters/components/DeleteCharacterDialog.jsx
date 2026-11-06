import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
export function DeleteCharacterDialog({
  showDeleteModal,
  renderManagementModal,
  handleDeleteCharacter,
  setShowDeleteModal,
}) {
  return (
    showDeleteModal &&
    renderManagementModal(
      <React.Fragment>
        <div className="dialog-title">
          {t("common.dialog.confirmDelete")}
        </div>
        <div className="dialog-desc">
          {t("characters.delete.confirmPrefix")}
          <strong>
            {'"'}
            {showDeleteModal}
            {'"'}
          </strong>
          {t("characters.delete.confirmSuffix")}
          <br />
          <span className="delete-character-dialog-contents-warning">
            {t("characters.delete.contentsHint")}
          </span>
        </div>
        <div className="dialog-actions">
          <button onClick={() => setShowDeleteModal(null)} className="btn">
            {t("common.actions.cancel")}
          </button>
          <button
            onClick={() => handleDeleteCharacter(showDeleteModal)}
            className="btn btn-danger"
          >
            {t("common.actions.recycle")}
          </button>
        </div>
      </React.Fragment>,
      () => setShowDeleteModal(null),
    )
  );
}
