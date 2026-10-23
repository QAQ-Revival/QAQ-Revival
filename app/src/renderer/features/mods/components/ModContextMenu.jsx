import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
import ReactDOM from "react-dom";
export function ModContextMenu({
  modContextMenu,
  setModContextMenu,
  handlePinMod,
  openModSourceFolder,
  isDx12PakMod,
  handleRequestMoveMod,
  handleFixMod,
  fixRunning,
  loadModIniBackups,
  iniRollbackBackups,
  requestRollbackModIni,
  characterName,
  setToast,
}) {
  return (
    modContextMenu &&
    ReactDOM.createPortal(
      <div className="mod-context-backdrop">
        <div
          className="mod-context-menu"
          style={{
            left: modContextMenu.x,
            top: modContextMenu.y,
          }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <button
            onClick={() => {
              setModContextMenu(null);
              handlePinMod(modContextMenu.mod.name, !modContextMenu.mod.pinned);
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
            className="mod-context-menu-action"
          >
            {modContextMenu.mod.pinned
              ? t("characters.actions.unpin")
              : t("characters.actions.pinShort")}
          </button>
          <button
            onClick={() => {
              const mod = modContextMenu.mod;
              setModContextMenu(null);
              openModSourceFolder(mod);
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
            className="mod-context-menu-action"
          >
            {isDx12PakMod(modContextMenu.mod)
              ? t("mods.actions.open")
              : t("characters.actions.openSource")}
          </button>
          <button
            onClick={() => handleRequestMoveMod(modContextMenu.mod)}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#eff6ff")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
            className="mod-context-menu-action-emphasis"
          >
            {t("common.actions.move")}
          </button>
          <div className="mod-context-menu-content" />
          <button
            onClick={() => handleFixMod(modContextMenu.mod, "external")}
            disabled={fixRunning}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#fff7ed")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
            className="mod-context-menu-fixer-action"
          >
            {t("characters.fixer.title")}
          </button>
          <div
            className="qaqm-context-submenu-wrap"
            onMouseEnter={() => loadModIniBackups(modContextMenu.mod.name)}
          >
            <button
              onClick={() => loadModIniBackups(modContextMenu.mod.name)}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "#f5f3ff")
              }
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
              className="mod-context-menu-rollback-trigger"
            >
              <span>{t("mods.rollback.action")}</span>
              <span className="mod-context-menu-submenu-arrow">{"›"}</span>
            </button>
            <div className="qaqm-context-submenu">
              {iniRollbackBackups.modName !== modContextMenu.mod.name ||
              iniRollbackBackups.loading ? (
                <div className="qaqm-context-submenu-empty">
                  {t("mods.rollback.loading")}
                </div>
              ) : iniRollbackBackups.error ? (
                <div className="qaqm-context-submenu-empty is-error">
                  {iniRollbackBackups.error}
                </div>
              ) : iniRollbackBackups.items.length === 0 ? (
                <div className="qaqm-context-submenu-empty">
                  {t("mods.rollback.empty")}
                </div>
              ) : (
                iniRollbackBackups.items.map((backup) => (
                  <button
                    className="qaqm-context-submenu-item"
                    onClick={() =>
                      requestRollbackModIni(modContextMenu.mod, backup)
                    }
                    title={t("mods.rollback.backupOption", {
                      label: backup.label,
                      fileCount: backup.fileCount || 0,
                    })}
                    key={backup.stamp}
                  >
                    <span className="qaqm-context-submenu-title">
                      {backup.label || backup.stamp}
                    </span>
                    <span className="qaqm-context-submenu-meta">
                      {t("common.count.files", {
                        fileCount: backup.fileCount || 0,
                      })}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
          <button
            onClick={async () => {
              const mod = modContextMenu.mod;
              setModContextMenu(null);
              try {
                const r = await window.api.resetModIni(characterName, mod.name);
                if (r?.success)
                  setToast({
                    type: "success",
                    message: t("mods.ini.resetSuccess", {
                      name: mod.name,
                      restoredCount: r.restoredCount,
                    }),
                  });
                else
                  setToast({
                    type: "error",
                    message: r?.error || t("common.errors.resetFailed"),
                  });
              } catch (e) {
                setToast({
                  type: "error",
                  message: t("mods.ini.resetFailed", {
                    message: e.message,
                  }),
                });
              }
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#faf5ff")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
            className="mod-context-menu-action-spaced"
          >
            {t("mods.ini.reset")}
          </button>
        </div>
      </div>,
      document.body,
    )
  );
}
