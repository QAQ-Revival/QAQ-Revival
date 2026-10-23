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
        <div className="text-h2 delete-character-dialog-content">
          {t("common.dialog.confirmDelete")}
        </div>
        <div className="text-body delete-character-dialog-text-body-layout">
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
        <div className="add-character-dialog-row">
          <button
            onClick={() => handleDeleteCharacter(showDeleteModal)}
            className="btn btn-danger add-character-dialog-btn-layout"
          >
            {t("common.actions.recycle")}
          </button>
          <button
            onClick={() => setShowDeleteModal(null)}
            className="btn btn-secondary add-character-dialog-btn-layout"
          >
            {t("common.actions.cancel")}
          </button>
        </div>
      </React.Fragment>,
      () => setShowDeleteModal(null),
    )
  );
}
