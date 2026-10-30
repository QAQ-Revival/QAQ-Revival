import { t } from "../../../shared/i18n/index.mjs";
import React from "react";
import { Icon } from "../../components/Icon.jsx";
import { Menu, MenuItem } from "../../components/Menu.jsx";
import { Dialog } from "../settings/SettingsControls.jsx";

const presetName = (preset) =>
  preset.isBuiltIn ? t("settings.presets.noModName") : preset.name;

function groupMods(mods) {
  const groups = {};
  for (const m of mods) {
    if (!groups[m.characterName]) groups[m.characterName] = [];
    groups[m.characterName].push(m);
  }
  return groups;
}

function PresetRow({
  preset,
  isActive,
  isActivating,
  isExpanded,
  onToggleExpand,
  onActivate,
  onSnapshot,
  onEdit,
  onDelete,
}) {
  const isBuiltIn = !!preset.isBuiltIn;
  const modGroups = groupMods(preset.mods || []);
  const charCount = Object.keys(modGroups).length;
  const modCount = (preset.mods || []).length;
  return (
    <li
      className={`preset-row${isActive ? " is-active" : ""}${isBuiltIn ? " is-builtin" : ""}${isExpanded ? " is-expanded" : ""}`}
      data-preset-id={preset.id}
    >
      <div className="preset-row-main">
        <button
          type="button"
          className="preset-row-summary"
          disabled={isBuiltIn}
          aria-expanded={isBuiltIn ? undefined : isExpanded}
          onClick={onToggleExpand}
        >
          <Icon
            name={isBuiltIn ? "ban" : isExpanded ? "chevron-down" : "chevron-right"}
            size={14}
            className="preset-row-chevron"
          />
          <span className="preset-row-copy">
            <span className="preset-row-title">
              <span className="preset-row-name">{presetName(preset)}</span>
              {isActive && (
                <span className="badge badge-accent">
                  {t("settings.presets.active")}
                </span>
              )}
            </span>
            {(isBuiltIn || preset.description) && (
              <span className="preset-row-desc">
                {isBuiltIn ? t("settings.presets.noModHint") : preset.description}
              </span>
            )}
          </span>
          {!isBuiltIn && (
            <span className="preset-row-stats">
              {t("settings.presets.stats", {
                modCount,
                charCount,
              })}
            </span>
          )}
        </button>
        <button
          type="button"
          className="btn"
          disabled={isActivating}
          onClick={onActivate}
        >
          {isActivating ? t("settings.presets.applying") : t("common.actions.apply")}
        </button>
        {isBuiltIn ? (
          <span className="preset-row-menu-spacer" aria-hidden={true} />
        ) : (
          <Menu
            label={t("common.actions.more")}
            trigger={({ props }) => (
              <button
                type="button"
                className="icon-btn"
                title={t("common.actions.more")}
                aria-label={t("settings.presets.moreNamed", {
                  name: preset.name,
                })}
                {...props}
              >
                <Icon name="more" size={16} strokeWidth={2.4} />
              </button>
            )}
          >
            <MenuItem icon={<Icon name="refresh" size={15} />} onClick={onSnapshot}>
              {t("settings.presets.updateSnapshot")}
            </MenuItem>
            <MenuItem icon={<Icon name="edit" size={15} />} onClick={onEdit}>
              {t("common.actions.edit")}
            </MenuItem>
            <div className="menu-sep" />
            <MenuItem
              danger={true}
              icon={<Icon name="trash" size={15} />}
              onClick={onDelete}
            >
              {t("common.actions.delete")}
            </MenuItem>
          </Menu>
        )}
      </div>
      {isExpanded && !isBuiltIn && (
        <div className="preset-row-detail">
          {preset.updatedAt && (
            <div className="preset-row-updated">
              {t("settings.presets.updatedAt", {
                date: new Date(preset.updatedAt).toLocaleDateString("zh-CN", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              })}
            </div>
          )}
          {charCount === 0 ? (
            <div className="preset-row-empty">{t("mods.presets.noMods")}</div>
          ) : (
            Object.entries(modGroups).map(([charName, mods]) => (
              <div key={charName} className="preset-character">
                <div className="preset-character-name">
                  {charName}
                  <span>{mods.length}</span>
                </div>
                <div className="preset-character-mods">
                  {mods.map((m, i) => (
                    <span key={i} className="chip" title={m.modName}>
                      {m.modName}
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </li>
  );
}

function PresetView() {
  const [presets, setPresets] = React.useState([]);
  const [activePresetId, setActivePresetId] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [toast, setToast] = React.useState(null);
  const [showCreate, setShowCreate] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [newDesc, setNewDesc] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [activatingId, setActivatingId] = React.useState(null);
  const [editing, setEditing] = React.useState(null);
  const [editName, setEditName] = React.useState("");
  const [editDesc, setEditDesc] = React.useState("");
  const [deleting, setDeleting] = React.useState(null);
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
    setDeleting(null);
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
          name: presetName(preset),
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
        setEditing(null);
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
  async function handleImport() {
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
  }
  async function handleExport() {
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
  }
  if (loading)
    return (
      <div className="app-page-loading">
        <span className="spinner" />
      </div>
    );
  const builtIn = presets.filter((preset) => preset.isBuiltIn);
  const custom = presets.filter((preset) => !preset.isBuiltIn);
  const renderRow = (preset) => (
    <PresetRow
      key={preset.id}
      preset={preset}
      isActive={preset.id === activePresetId}
      isActivating={preset.id === activatingId}
      isExpanded={preset.id === expandedId}
      onToggleExpand={() =>
        setExpandedId(preset.id === expandedId ? null : preset.id)
      }
      onActivate={() => handleActivate(preset)}
      onSnapshot={() => handleSnapshot(preset)}
      onEdit={() => {
        setEditing(preset);
        setEditName(preset.name);
        setEditDesc(preset.description || "");
      }}
      onDelete={() => setDeleting(preset)}
    />
  );
  return (
    <div className="page preset-view">
      <div className="page-header">
        <div className="page-heading">
          <h1 className="page-title">{t("navigation.presetSettings")}</h1>
          {custom.length > 0 && (
            <span className="page-subtitle">
              {t("settings.presets.count", {
                count: custom.length,
              })}
            </span>
          )}
        </div>
        <div className="page-actions">
          <Menu
            label={t("common.actions.more")}
            trigger={({ props }) => (
              <button
                type="button"
                className="icon-btn"
                title={t("common.actions.more")}
                aria-label={t("common.actions.more")}
                {...props}
              >
                <Icon name="more" size={16} strokeWidth={2.4} />
              </button>
            )}
          >
            <MenuItem
              icon={<Icon name="download" size={15} />}
              title={t("mods.presets.import")}
              onClick={handleImport}
            >
              {t("common.actions.import")}
            </MenuItem>
            <MenuItem
              icon={<Icon name="upload" size={15} />}
              title={t("mods.presets.export")}
              onClick={handleExport}
            >
              {t("common.actions.export")}
            </MenuItem>
          </Menu>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowCreate(true)}
          >
            <Icon name="plus" size={15} strokeWidth={2.2} />
            {t("mods.presets.create")}
          </button>
        </div>
      </div>
      <div className="page-body">
        {custom.length > 0 && <ul className="preset-list">{custom.map(renderRow)}</ul>}
        {custom.length === 0 && (
          <div className="empty-state preset-empty">
            <div className="empty-title">{t("mods.presets.empty")}</div>
            <div className="empty-text">{t("settings.presets.emptyHint")}</div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowCreate(true)}
            >
              {t("mods.presets.createFirst")}
            </button>
          </div>
        )}
        {builtIn.length > 0 && (
          <ul className="preset-list preset-list-builtin">
            {builtIn.map(renderRow)}
          </ul>
        )}
      </div>
      {showCreate && (
        <Dialog
          title={t("mods.presets.create")}
          description={t("mods.presets.snapshotHint")}
          busy={creating}
          onClose={() => setShowCreate(false)}
          actions={
            <React.Fragment>
              <button
                type="button"
                className="btn"
                disabled={creating}
                onClick={() => setShowCreate(false)}
              >
                {t("common.actions.cancel")}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={creating || !newName.trim()}
                onClick={handleCreate}
              >
                {creating
                  ? t("common.status.creating")
                  : t("settings.presets.save")}
              </button>
            </React.Fragment>
          }
        >
          <div className="preset-form">
            <input
              type="text"
              className="input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t("mods.presets.namePlaceholder")}
              aria-label={t("mods.presets.namePlaceholder")}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            <input
              type="text"
              className="input"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder={t("mods.presets.optionalNotes")}
              aria-label={t("mods.presets.optionalNotes")}
            />
          </div>
        </Dialog>
      )}
      {editing && (
        <Dialog
          title={t("common.actions.edit")}
          onClose={() => setEditing(null)}
          actions={
            <React.Fragment>
              <button
                type="button"
                className="btn"
                onClick={() => setEditing(null)}
              >
                {t("common.actions.cancel")}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!editName.trim()}
                onClick={() => handleSaveEdit(editing)}
              >
                {t("common.actions.save")}
              </button>
            </React.Fragment>
          }
        >
          <div className="preset-form">
            <input
              type="text"
              className="input"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder={t("mods.presets.namePlaceholder")}
              aria-label={t("mods.presets.namePlaceholder")}
              onKeyDown={(e) =>
                e.key === "Enter" && editName.trim() && handleSaveEdit(editing)
              }
            />
            <input
              type="text"
              className="input"
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              placeholder={t("mods.presets.optionalNotes")}
              aria-label={t("mods.presets.optionalNotes")}
            />
          </div>
        </Dialog>
      )}
      {deleting && (
        <Dialog
          title={t("mods.presets.delete")}
          description={t("mods.presets.confirmDelete", {
            name: deleting.name,
          })}
          onClose={() => setDeleting(null)}
          actions={
            <React.Fragment>
              <button
                type="button"
                className="btn"
                onClick={() => setDeleting(null)}
              >
                {t("common.actions.cancel")}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => handleDelete(deleting)}
              >
                {t("common.actions.delete")}
              </button>
            </React.Fragment>
          }
        />
      )}
      {toast && (
        <div
          className={`toast toast-${toast.type}`}
          role={toast.type === "error" ? "alert" : "status"}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
export { PresetView as default };
