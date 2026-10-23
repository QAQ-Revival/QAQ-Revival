import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
import ReactDOM from "react-dom";
export function TagManagerDialog({
  showTagManagerModal,
  setShowTagManagerModal,
  reloadServerTags,
  tagManagerLoading,
  tagManagerAdminKey,
  setTagManagerAdminKey,
  newTagName,
  setNewTagName,
  handleCreateTag,
  newTagColor,
  setNewTagColor,
  serverTags,
  editingTagId,
  editingTagName,
  setEditingTagName,
  handleUpdateTag,
  setEditingTagId,
  editingTagColor,
  setEditingTagColor,
  handleDeleteTag,
}) {
  return (
    showTagManagerModal &&
    ReactDOM.createPortal(
      <div
        onClick={() => setShowTagManagerModal(false)}
        className="tag-manager-dialog-overlay"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="tag-manager-dialog-stack"
        >
          <div className="tag-manager-dialog-row">
            <span>{t("mods.tags.poolTitle")}</span>
            <div className="mod-details-panel-hotkey-keys-layout">
              <button
                onClick={() =>
                  reloadServerTags({
                    force: true,
                  })
                }
                disabled={tagManagerLoading}
                title={t("mods.tags.refreshPool")}
                className="tag-manager-dialog-action"
              >
                {"🔄"}
              </button>
              <button
                onClick={() => setShowTagManagerModal(false)}
                className="tag-manager-dialog-close-icon"
              >
                {"✕"}
              </button>
            </div>
          </div>
          <div className="tag-manager-dialog-credentials-row">
            <span className="tag-manager-dialog-hint">{"Admin Key:"}</span>
            <input
              type="password"
              value={tagManagerAdminKey}
              onChange={(e) => {
                setTagManagerAdminKey(e.target.value);
                localStorage.setItem("qaqm-dev-admin-key", e.target.value);
              }}
              placeholder={t("mods.tags.adminKeyPlaceholder")}
              className="tag-manager-dialog-input-field"
            />
          </div>
          <div className="tag-manager-dialog-create-tag-row">
            <input
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateTag();
              }}
              placeholder={t("mods.tags.newNamePlaceholder")}
              className="tag-manager-dialog-new-tag-name"
            />
            <input
              type="color"
              value={newTagColor}
              onChange={(e) => setNewTagColor(e.target.value)}
              title={t("mods.tags.chooseColor")}
              className="tag-manager-dialog-new-tag-color"
            />
            <button
              onClick={handleCreateTag}
              disabled={tagManagerLoading || !newTagName.trim()}
              className="tag-manager-dialog-create-tag-action"
            >
              {t("common.actions.add")}
            </button>
          </div>
          <div className="tag-manager-dialog-tag-list">
            {serverTags.length === 0 && (
              <div className="tag-manager-dialog-empty-tags-hint">
                {t("mods.tags.emptyPool")}
              </div>
            )}
            {serverTags.map((tag) => (
              <div key={tag.id} className="tag-manager-dialog-row-spaced">
                {editingTagId === tag.id ? (
                  <React.Fragment>
                    <input
                      value={editingTagName}
                      onChange={(e) => setEditingTagName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleUpdateTag(tag.id);
                        if (e.key === "Escape") setEditingTagId(null);
                      }}
                      autoFocus={true}
                      className="tag-manager-dialog-input-field-spaced"
                    />
                    <input
                      type="color"
                      value={editingTagColor}
                      onChange={(e) => setEditingTagColor(e.target.value)}
                      className="tag-manager-dialog-edit-tag-color"
                    />
                    <button
                      onClick={() => handleUpdateTag(tag.id)}
                      disabled={tagManagerLoading}
                      className="tag-manager-dialog-save-tag"
                    >
                      {t("common.actions.save")}
                    </button>
                    <button
                      onClick={() => setEditingTagId(null)}
                      className="tag-manager-dialog-action-spaced"
                    >
                      {t("common.actions.cancel")}
                    </button>
                  </React.Fragment>
                ) : (
                  <React.Fragment>
                    <span
                      style={{
                        background: tag.color || "#666",
                      }}
                      className="tag-manager-dialog-content"
                    />
                    <span className="tag-manager-dialog-hint-emphasis">
                      {tag.name}
                    </span>
                    <span className="tag-manager-dialog-tag-color-label">
                      {tag.color || "#666"}
                    </span>
                    <button
                      onClick={() => {
                        setEditingTagId(tag.id);
                        setEditingTagName(tag.name);
                        setEditingTagColor(tag.color || "#666666");
                      }}
                      className="tag-manager-dialog-edit-tag"
                    >
                      {t("common.actions.edit")}
                    </button>
                    <button
                      onClick={() => handleDeleteTag(tag.id)}
                      disabled={tagManagerLoading}
                      className="tag-manager-dialog-danger-action"
                    >
                      {t("common.actions.delete")}
                    </button>
                  </React.Fragment>
                )}
              </div>
            ))}
          </div>
          <div className="tag-manager-dialog-actions">
            <button
              onClick={() => setShowTagManagerModal(false)}
              className="tag-manager-dialog-close-button"
            >
              {t("common.actions.close")}
            </button>
          </div>
        </div>
      </div>,
      document.body,
    )
  );
}
