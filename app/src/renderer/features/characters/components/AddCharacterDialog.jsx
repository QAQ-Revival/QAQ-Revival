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
        <div className="dialog-title">
          {t("characters.actions.add")}
        </div>
        <input
          ref={inputRef}
          type="text"
          placeholder={t("characters.create.namePlaceholder")}
          value={newCharName}
          onChange={(e) => setNewCharName(e.target.value)}
          onKeyDown={handleKeyDown}
          className="input dialog-body"
        />
        <div className="dialog-actions">
          <button
            onClick={() => {
              setShowAddModal(false);
              setNewCharName("");
            }}
            className="btn"
          >
            {t("common.actions.cancel")}
          </button>
          <button onClick={handleAddCharacter} className="btn btn-primary">
            {t("characters.create.confirm")}
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
