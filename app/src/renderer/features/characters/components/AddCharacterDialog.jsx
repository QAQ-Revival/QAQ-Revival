import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
export function AddCharacterDialog({
  showAddModal,
  renderManagementModal,
  inputRef,
  newCharName,
  setNewCharName,
  handleKeyDown,
  handleAddCharacter,
  setShowAddModal,
}) {
  return (
    showAddModal &&
    renderManagementModal(
      <React.Fragment>
        <div className="text-h2 add-character-dialog-content">
          {t("characters.actions.add")}
        </div>
        <input
          ref={inputRef}
          type="text"
          placeholder={t("characters.create.namePlaceholder")}
          value={newCharName}
          onChange={(e) => setNewCharName(e.target.value)}
          onKeyDown={handleKeyDown}
          className="input add-character-dialog-input-layout"
        />
        <div className="add-character-dialog-row">
          <button
            onClick={handleAddCharacter}
            className="btn btn-primary add-character-dialog-btn-layout"
          >
            {t("characters.create.confirm")}
          </button>
          <button
            onClick={() => {
              setShowAddModal(false);
              setNewCharName("");
            }}
            className="btn btn-secondary add-character-dialog-btn-layout"
          >
            {t("common.actions.cancel")}
          </button>
        </div>
      </React.Fragment>,
      () => {
        setShowAddModal(false);
        setNewCharName("");
      },
    )
  );
}
