import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
import ReactDOM from "react-dom";
import { Icon } from "../../../components/Icon.jsx";
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
      <div className="modal-backdrop" onClick={() => setShowTagManagerModal(false)}>
        <div
          className="dev-panel dev-panel-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tag-manager-title"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="dev-panel-head">
            <h2 id="tag-manager-title" className="dev-panel-title">
              {t("mods.tags.poolTitle")}
            </h2>
            <button
              type="button"
              className="icon-btn icon-btn-sm"
              onClick={() => reloadServerTags({ force: true })}
              disabled={tagManagerLoading}
              title={t("mods.tags.refreshPool")}
              aria-label={t("mods.tags.refreshPool")}
            >
              <Icon name="refresh" size={15} className={tagManagerLoading ? "is-spinning" : ""} />
            </button>
            <button
              type="button"
              className="icon-btn icon-btn-sm"
              onClick={() => setShowTagManagerModal(false)}
              title={t("common.actions.close")}
              aria-label={t("common.actions.close")}
            >
              <Icon name="x" size={15} />
            </button>
          </header>
          <div className="dev-panel-body">
            <section className="dev-section">
              <label className="dev-field">
                <span>{"Admin Key"}</span>
                <input
                  type="password"
                  className="input"
                  value={tagManagerAdminKey}
                  onChange={(e) => {
                    setTagManagerAdminKey(e.target.value);
                    localStorage.setItem("qaqm-dev-admin-key", e.target.value);
                  }}
                  placeholder={t("mods.tags.adminKeyPlaceholder")}
                />
              </label>
              <div className="dev-inline">
                <input
                  className="input"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateTag();
                  }}
                  placeholder={t("mods.tags.newNamePlaceholder")}
                />
                <input
                  type="color"
                  className="dev-color"
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                  title={t("mods.tags.chooseColor")}
                  aria-label={t("mods.tags.chooseColor")}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleCreateTag}
                  disabled={tagManagerLoading || !newTagName.trim()}
                >
                  {t("common.actions.add")}
                </button>
              </div>
            </section>
            <section className="dev-rows">
              {serverTags.length === 0 && (
                <div className="dev-empty">{t("mods.tags.emptyPool")}</div>
              )}
              {serverTags.map((tag) => (
                <div key={tag.id} className="dev-row">
                  {editingTagId === tag.id ? (
                    <React.Fragment>
                      <input
                        className="input dev-row-input"
                        value={editingTagName}
                        onChange={(e) => setEditingTagName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleUpdateTag(tag.id);
                          if (e.key === "Escape") setEditingTagId(null);
                        }}
                        autoFocus={true}
                      />
                      <input
                        type="color"
                        className="dev-color"
                        value={editingTagColor}
                        onChange={(e) => setEditingTagColor(e.target.value)}
                        aria-label={t("mods.tags.chooseColor")}
                      />
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() => handleUpdateTag(tag.id)}
                        disabled={tagManagerLoading}
                      >
                        {t("common.actions.save")}
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => setEditingTagId(null)}
                      >
                        {t("common.actions.cancel")}
                      </button>
                    </React.Fragment>
                  ) : (
                    <React.Fragment>
                      {/* A tag's colour is its own data, so it stays inline. */}
                      <span className="dev-swatch" style={{ background: tag.color || undefined }} />
                      <span className="dev-row-name">{tag.name}</span>
                      <code className="dev-row-meta">{tag.color}</code>
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        onClick={() => {
                          setEditingTagId(tag.id);
                          setEditingTagName(tag.name);
                          setEditingTagColor(tag.color || "#666666");
                        }}
                      >
                        {t("common.actions.edit")}
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDeleteTag(tag.id)}
                        disabled={tagManagerLoading}
                      >
                        {t("common.actions.delete")}
                      </button>
                    </React.Fragment>
                  )}
                </div>
              ))}
            </section>
          </div>
        </div>
      </div>,
      document.body,
    )
  );
}
