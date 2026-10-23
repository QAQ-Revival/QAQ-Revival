import { t } from "../../../shared/i18n/index.mjs";
import React from "react";
function PresetView({ activeGame }) {
  const [presets, setPresets] = React.useState([]);
  const [activePresetId, setActivePresetId] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [toast, setToast] = React.useState(null);
  const [showCreate, setShowCreate] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [newDesc, setNewDesc] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [activatingId, setActivatingId] = React.useState(null);
  const [editingId, setEditingId] = React.useState(null);
  const [editName, setEditName] = React.useState("");
  const [editDesc, setEditDesc] = React.useState("");
  const [expandedId, setExpandedId] = React.useState(null);
  React.useEffect(() => {
    loadPresets();
  }, []);
  React.useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3e3);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  async function loadPresets() {
    try {
      const result = await window.api.presetList();
      if (result.success) {
        setPresets(result.presets || []);
        setActivePresetId(result.activePresetId);
      }
    } catch (e) {
      console.error("Failed to load presets:", e);
    } finally {
      setLoading(false);
    }
  }
  async function handleCreate() {
    if (!newName.trim()) {
      setToast({
        type: "error",
        message: t("mods.presets.nameRequired"),
      });
      return;
    }
    setCreating(true);
    try {
      const result = await window.api.presetCreate(
        newName.trim(),
        newDesc.trim(),
      );
      if (result.success) {
        setToast({
          type: "success",
          message: t("mods.presets.created", {
            name: result.preset.name,
          }),
        });
        setNewName("");
        setNewDesc("");
        setShowCreate(false);
        loadPresets();
      } else {
        setToast({
          type: "error",
          message: result.error,
        });
      }
    } catch (e) {
      setToast({
        type: "error",
        message: e.message,
      });
    } finally {
      setCreating(false);
    }
  }
  async function handleDelete(preset) {
    if (
      !confirm(
        t("mods.presets.confirmDelete", {
          name: preset.name,
        }),
      )
    )
      return;
    try {
      const result = await window.api.presetDelete(preset.id);
      if (result.success) {
        setToast({
          type: "success",
          message: t("mods.presets.deleted", {
            name: preset.name,
          }),
        });
        loadPresets();
      } else {
        setToast({
          type: "error",
          message: result.error,
        });
      }
    } catch (e) {
      setToast({
        type: "error",
        message: e.message,
      });
    }
  }
  async function handleActivate(preset) {
    setActivatingId(preset.id);
    try {
      const result = await window.api.presetActivate(preset.id);
      if (result.success) {
        const r = result.results;
        let msg = t("mods.presets.applied", {
          name: preset.name,
        });
        if (r.enabled > 0 || r.disabled > 0) {
          msg += t("mods.presets.toggledCount", {
            enabled: r.enabled,
            disabled: r.disabled,
          });
        }
        if (r.missing > 0) {
          msg += t("mods.presets.missingCount", {
            missing: r.missing,
          });
        }
        setToast({
          type: r.missing > 0 ? "error" : "success",
          message: msg,
        });
        loadPresets();
      } else {
        setToast({
          type: "error",
          message: result.error,
        });
      }
    } catch (e) {
      setToast({
        type: "error",
        message: e.message,
      });
    } finally {
      setActivatingId(null);
    }
  }
  async function handleSnapshot(preset) {
    try {
      const result = await window.api.presetSnapshot(preset.id);
      if (result.success) {
        setToast({
          type: "success",
          message: t("mods.presets.updated", {
            name: preset.name,
            modsCount: result.preset.mods.length,
          }),
        });
        loadPresets();
      } else {
        setToast({
          type: "error",
          message: result.error,
        });
      }
    } catch (e) {
      setToast({
        type: "error",
        message: e.message,
      });
    }
  }
  async function handleSaveEdit(preset) {
    try {
      const result = await window.api.presetUpdate(
        preset.id,
        editName,
        editDesc,
      );
      if (result.success) {
        setToast({
          type: "success",
          message: t("common.status.changesSaved"),
        });
        setEditingId(null);
        loadPresets();
      } else {
        setToast({
          type: "error",
          message: result.error,
        });
      }
    } catch (e) {
      setToast({
        type: "error",
        message: e.message,
      });
    }
  }
  function formatDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString("zh-CN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  function groupMods(mods) {
    const groups = {};
    for (const m of mods) {
      if (!groups[m.characterName]) groups[m.characterName] = [];
      groups[m.characterName].push(m);
    }
    return groups;
  }
  if (loading)
    return (
      <div className="preset-view-centered-content">
        {t("common.status.loading")}
      </div>
    );
  return (
    <div className="preset-view">
      <div className="page-header preset-view-page-header-layout">
        <div className="preset-view-stack">
          <span>{t("navigation.presetSettings")}</span>
          <span className="preset-view-hint">
            {t("mods.presets.gameDescription", {
              name: activeGame?.name || t("navigation.currentGame"),
            })}
          </span>
        </div>
        <div className="preset-view-row">
          <button
            className="btn preset-view-btn-layout"
            onClick={async () => {
              try {
                const result = await window.api.configImport();
                if (result.success) {
                  setToast({
                    type: "success",
                    message: result.message || t("mods.presets.imported"),
                  });
                  loadPresets();
                } else if (result.error) {
                  setToast({
                    type: "error",
                    message: result.error,
                  });
                }
              } catch (e) {
                setToast({
                  type: "error",
                  message: e.message,
                });
              }
            }}
            title={t("mods.presets.import")}
          >
            {t("common.actions.import")}
          </button>
          <button
            className="btn preset-view-btn-layout"
            onClick={async () => {
              try {
                const result = await window.api.configExport();
                if (result.success) {
                  setToast({
                    type: "success",
                    message: t("mods.presets.exported", {
                      path: result.path,
                    }),
                  });
                }
              } catch (e) {
                setToast({
                  type: "error",
                  message: e.message,
                });
              }
            }}
            title={t("mods.presets.export")}
          >
            {t("common.actions.export")}
          </button>
          <button
            className="btn btn-primary preset-view-toggle-create"
            onClick={() => setShowCreate(!showCreate)}
          >
            {showCreate ? t("common.actions.cancel") : t("mods.presets.create")}
          </button>
        </div>
      </div>
      {showCreate && (
        <div className="preset-create-panel">
          <h3 className="preset-view-content">{t("mods.presets.create")}</h3>
          <p className="preset-view-snapshot-hint">
            {t("mods.presets.snapshotHint")}
          </p>
          <div className="preset-view-vertical-list">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t("mods.presets.namePlaceholder")}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus={true}
              className="preset-view-input-field"
            />
            <input
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder={t("mods.presets.optionalNotes")}
              className="preset-view-input-field"
            />
            <button
              className="btn btn-primary preset-view-create-snapshot"
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
            >
              {creating
                ? t("common.status.creating")
                : t("mods.presets.createSnapshot")}
            </button>
          </div>
        </div>
      )}
      {presets.length === 0 && !showCreate && (
        <div className="preset-view-centered-content-spaced">
          <div className="preset-view-icon">{"📋"}</div>
          <p className="preset-view-heading">{t("mods.presets.empty")}</p>
          <p className="preset-view-empty-presets-hint">
            {t("mods.presets.emptyHint")}
          </p>
          <button
            className="btn btn-primary preset-view-create-first"
            onClick={() => setShowCreate(true)}
          >
            {t("mods.presets.createFirst")}
          </button>
        </div>
      )}
      <div className="preset-view-vertical-list">
        {presets.map((preset) => {
          const isActive = preset.id === activePresetId;
          const isActivating = preset.id === activatingId;
          const isEditing = preset.id === editingId;
          const isExpanded = preset.id === expandedId;
          const isBuiltIn = !!preset.isBuiltIn;
          const modGroups = groupMods(preset.mods || []);
          const charCount = Object.keys(modGroups).length;
          const modCount = (preset.mods || []).length;
          return (
            <div
              style={{
                borderRadius: "12px",
                border: isActive
                  ? "2px solid var(--color-accent-primary, #667eea)"
                  : "1px solid #e8e8e8",
              }}
              key={preset.id}
              className="preset-view-preset-card"
            >
              <div
                style={{
                  background: isActive
                    ? "rgba(102, 126, 234, 0.04)"
                    : "transparent",
                }}
                onClick={() => setExpandedId(isExpanded ? null : preset.id)}
                className="preset-view-row-spaced"
              >
                <div className="preset-view-preset-info">
                  {isEditing ? (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="preset-view-name-editor"
                    >
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        autoFocus={true}
                        className="preset-view-input-field-emphasis"
                      />
                      <button
                        className="btn preset-view-save-name"
                        onClick={() => handleSaveEdit(preset)}
                      >
                        {t("common.actions.save")}
                      </button>
                      <button
                        className="btn preset-view-save-name"
                        onClick={() => setEditingId(null)}
                      >
                        {t("common.actions.cancel")}
                      </button>
                    </div>
                  ) : (
                    <div className="preset-view-preset-heading">
                      <span className="preset-view-heading-emphasis">
                        {isActive ? "🟢" : "⚪"} {preset.name}
                      </span>
                      {isBuiltIn && (
                        <span className="preset-view-built-in-badge">
                          {t("mods.presets.fixed")}
                        </span>
                      )}
                      {isActive && (
                        <span className="preset-view-heading-spaced">
                          {t("mods.presets.current")}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="preset-view-preset-summary">
                    {t("mods.presets.summary", {
                      modCount,
                      charCount,
                      description:
                        preset.description && ` · ${preset.description}`,
                      status: preset.updatedAt
                        ? t("mods.presets.updatedAtSuffix", {
                            date: formatDate(preset.updatedAt),
                          })
                        : "",
                    })}
                  </div>
                </div>
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="preset-view-activate-actions"
                >
                  <button
                    className="btn btn-primary preset-view-btn-layout-spaced"
                    onClick={() => handleActivate(preset)}
                    disabled={isActivating}
                  >
                    {isActivating
                      ? t("navigation.switchingGame")
                      : t("common.actions.apply")}
                  </button>
                </div>
              </div>
              {isExpanded && (
                <div className="preset-expanded-content">
                  <div className="preset-view-preset-actions">
                    {!isBuiltIn ? (
                      <React.Fragment>
                        <button
                          className="btn preset-view-edit-action"
                          onClick={() => handleSnapshot(preset)}
                        >
                          {t("mods.presets.updateSnapshot")}
                        </button>
                        <button
                          className="btn preset-view-edit-action"
                          onClick={() => {
                            setEditingId(preset.id);
                            setEditName(preset.name);
                            setEditDesc(preset.description || "");
                          }}
                        >
                          {t("mods.presets.editInfo")}
                        </button>
                        <button
                          className="btn preset-view-delete-action"
                          onClick={() => handleDelete(preset)}
                        >
                          {t("common.actions.delete")}
                        </button>
                      </React.Fragment>
                    ) : (
                      <div className="preset-view-built-in-hint">
                        {t("mods.presets.fixedHint")}
                      </div>
                    )}
                  </div>
                  {Object.keys(modGroups).length === 0 ? (
                    <div className="preset-view-empty-mods-hint">
                      {t("mods.presets.noMods")}
                    </div>
                  ) : (
                    <div className="preset-view-character-groups">
                      {Object.entries(modGroups).map(([charName, mods]) => (
                        <div key={charName}>
                          <div className="preset-view-character-heading">
                            {"👤 "}
                            {charName}
                            {" ("}
                            {mods.length}
                            {")"}
                          </div>
                          <div className="preset-view-mod-list">
                            {mods.map((m, i) => (
                              <span key={i} className="preset-view-panel">
                                {m.modName}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {toast && (
        <div className={`toast toast-${toast.type}`}>{toast.message}</div>
      )}
      {null}
    </div>
  );
}
export { PresetView as default };
