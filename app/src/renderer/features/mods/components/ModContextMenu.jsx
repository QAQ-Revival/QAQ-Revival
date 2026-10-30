import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
import ReactDOM from "react-dom";
import { Icon } from "../../../components/Icon.jsx";
export function ModContextMenu({
  modContextMenu,
  setModContextMenu,
  handlePinMod,
  handleRequestRenameMod,
  openModSourceFolder,
  isDx12PakMod,
  handleRequestMoveMod,
  handleFixMod,
  fixRunning,
  isArknights = false,
  handleReloadMod,
  reloadingMod,
  loadModIniBackups,
  iniRollbackBackups,
  requestRollbackModIni,
  characterName,
  setToast,
  confirmDelete,
}) {
  return (
    modContextMenu &&
    ReactDOM.createPortal(
      <div
        className="mod-context-backdrop"
        onClick={() => setModContextMenu(null)}
        onContextMenu={(e) => {
          e.preventDefault();
          setModContextMenu(null);
        }}
      >
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
          {isArknights && <button
            className="mod-context-menu-action"
            disabled={!!reloadingMod}
            onClick={() => handleReloadMod(modContextMenu.mod)}
          >{t(reloadingMod ? "arknights.reloading" : "arknights.reloadMod")}</button>}
          <button
            onClick={() => {
              setModContextMenu(null);
              handlePinMod(modContextMenu.mod.name, !modContextMenu.mod.pinned);
            }}
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
              handleRequestRenameMod(mod);
            }}
            className="mod-context-menu-action"
          >
            {t("common.actions.rename")}
          </button>
          <button
            onClick={() => {
              const mod = modContextMenu.mod;
              setModContextMenu(null);
              openModSourceFolder(mod);
            }}
            className="mod-context-menu-action"
          >
            {isDx12PakMod(modContextMenu.mod)
              ? t("mods.actions.open")
              : t("characters.actions.openSource")}
          </button>
          <button
            onClick={async () => {
              const mod = modContextMenu.mod;
              setModContextMenu(null);
              try {
                if (!mod.path) throw new Error(t("common.errors.copyFailed"));
                await navigator.clipboard.writeText(mod.path);
                setToast({
                  type: "success",
                  message: t("mods.pathCopied"),
                });
              } catch {
                setToast({
                  type: "error",
                  message: t("common.errors.copyFailed"),
                });
              }
            }}
            className="mod-context-menu-action"
          >
            {t("mods.actions.copyPath")}
          </button>
          <button
            onClick={() => handleRequestMoveMod(modContextMenu.mod)}
            className="mod-context-menu-action-emphasis"
          >
            {t("common.actions.move")}
          </button>
          <div className="mod-context-menu-content" />
          <button
            onClick={() => handleFixMod(modContextMenu.mod, "external")}
            disabled={fixRunning}
            className="mod-context-menu-fixer-action"
          >
            {t(isArknights ? "arknights.tools" : "characters.fixer.title")}
          </button>
          {!isArknights && <><div
            className="qaqm-context-submenu-wrap"
            onMouseEnter={() => loadModIniBackups(modContextMenu.mod.name)}
          >
            <button
              onClick={() => loadModIniBackups(modContextMenu.mod.name)}
              className="mod-context-menu-rollback-trigger"
            >
              <span>{t("mods.rollback.action")}</span>
              <Icon name="chevron-right" size={14} className="mod-context-menu-submenu-arrow" />
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
            className="mod-context-menu-action-spaced"
          >
            {t("mods.ini.reset")}
          </button></>}
          <div className="mod-context-menu-content" />
          <button
            onClick={(e) => {
              const mod = modContextMenu.mod;
              setModContextMenu(null);
              confirmDelete(mod.name, e);
            }}
            className="mod-context-menu-delete"
          >
            {t("common.actions.delete")}
          </button>
        </div>
      </div>,
      document.body,
    )
  );
}
