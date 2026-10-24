import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
export function useModContextActions({
  characterName,
  setToast,
  onRequestMoveMod,
  activeGameId,
}) {
  const [fixRunning, setFixRunning] = React.useState(false);
  const [modContextMenu, setModContextMenu] = React.useState(null);
  const [iniRollbackBackups, setIniRollbackBackups] = React.useState({
    modName: "",
    loading: false,
    items: [],
    error: "",
  });
  const [iniRollbackConfirm, setIniRollbackConfirm] = React.useState(null);
  React.useEffect(() => {
    if (!modContextMenu) return void 0;
    const handleClose = () => setModContextMenu(null);
    const handlePointerDown = (event) => {
      if (event.button !== 0) return;
      if (
        event.target instanceof Element &&
        event.target.closest(".mod-context-menu")
      )
        return;
      setModContextMenu(null);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setModContextMenu(null);
    };
    window.addEventListener("resize", handleClose);
    window.addEventListener("scroll", handleClose, true);
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("resize", handleClose);
      window.removeEventListener("scroll", handleClose, true);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [modContextMenu]);
  function isDx12PakMod(mod) {
    return mod?.modType === "dx12-pak";
  }
  async function openModSourceFolder(mod) {
    if (isDx12PakMod(mod)) {
      const result = await window.api.openModFolder(characterName, mod.name);
      if (!result?.success)
        setToast({
          type: "error",
          message: result?.error || t("mods.pak.openCharacterDirectoryFailed"),
        });
      return;
    }
    window.api.openModFolder(characterName, mod.name);
  }
  function openModContextMenu(e, mod) {
    e.preventDefault();
    e.stopPropagation();
    const menuWidth = 220;
    const submenuWidth = 252;
    const menuHeight = 350;
    const pad = 12;
    const maxX = window.innerWidth - menuWidth - submenuWidth - pad;
    const fallbackMaxX = window.innerWidth - menuWidth - pad;
    const x = Math.max(
      pad,
      Math.min(e.clientX + 8, maxX > pad ? maxX : fallbackMaxX),
    );
    const y = Math.max(
      pad,
      Math.min(e.clientY + 8, window.innerHeight - menuHeight - pad),
    );
    setModContextMenu({
      mod,
      x,
      y,
    });
  }
  async function loadModIniBackups(modName) {
    if (!modName) return;
    if (
      iniRollbackBackups.modName === modName &&
      (iniRollbackBackups.loading ||
        iniRollbackBackups.items.length > 0 ||
        iniRollbackBackups.error)
    ) {
      return;
    }
    setIniRollbackBackups({
      modName,
      loading: true,
      items: [],
      error: "",
    });
    try {
      const result = await window.api.listModIniBackups?.(
        characterName,
        modName,
      );
      if (!result?.success)
        throw new Error(result?.error || t("mods.rollback.readFailed"));
      setIniRollbackBackups({
        modName,
        loading: false,
        items: Array.isArray(result.backups) ? result.backups : [],
        error: "",
      });
    } catch (error) {
      setIniRollbackBackups({
        modName,
        loading: false,
        items: [],
        error: error.message || t("mods.rollback.readFailed"),
      });
    }
  }
  function requestRollbackModIni(mod, backup) {
    setModContextMenu(null);
    setIniRollbackConfirm({
      mod,
      backup,
    });
  }
  async function confirmRollbackModIni() {
    const target = iniRollbackConfirm;
    if (!target?.mod?.name || !target?.backup?.stamp) return;
    try {
      const result = await window.api.restoreModIniBackup?.(
        characterName,
        target.mod.name,
        target.backup.stamp,
      );
      if (!result?.success) {
        if (result?.restoreSucceeded || result?.cleanupAttempted) {
          setIniRollbackBackups({
            modName: "",
            loading: false,
            items: [],
            error: "",
          });
        }
        const message =
          result?.error || result?.errors?.[0] || t("mods.rollback.failed");
        throw new Error(message);
      }
      setToast({
        type: "success",
        message: t("mods.rollback.completed", {
          name: target.mod.name,
          restoredCount: result.restoredCount || 0,
        }),
      });
      setIniRollbackConfirm(null);
      setIniRollbackBackups({
        modName: "",
        loading: false,
        items: [],
        error: "",
      });
    } catch (error) {
      setToast({
        type: "error",
        message: error.message || t("mods.rollback.failed"),
      });
    }
  }
  function handleRequestMoveMod(mod) {
    setModContextMenu(null);
    onRequestMoveMod?.({
      characterName,
      modName: mod.name,
      originalName: mod.originalName,
      path: mod.path,
      gameId: activeGameId,
    });
  }
  async function handleFixMod(mod, mode = "external") {
    setModContextMenu(null);
    if (fixRunning) return;
    setFixRunning(true);
    try {
      const result = await window.api.fixRunMod(
        characterName,
        mod.name,
        mode,
        activeGameId,
      );
      if (result?.canceled) return;
      if (result?.success) {
        setIniRollbackBackups((previous) =>
          previous.modName === mod.name
            ? {
                modName: "",
                loading: false,
                items: [],
                error: "",
              }
            : previous,
        );
        setToast({
          type: "success",
          message: t("characters.fixer.opened"),
        });
      } else {
        setToast({
          type: "error",
          message: result?.error || t("characters.fixer.openFailed"),
        });
      }
    } catch (e) {
      setToast({
        type: "error",
        message: t("characters.fixer.openException", {
          message: e.message,
        }),
      });
    } finally {
      setFixRunning(false);
    }
  }
  return {
    fixRunning,
    modContextMenu,
    setModContextMenu,
    iniRollbackBackups,
    iniRollbackConfirm,
    setIniRollbackConfirm,
    isDx12PakMod,
    openModSourceFolder,
    openModContextMenu,
    loadModIniBackups,
    requestRollbackModIni,
    confirmRollbackModIni,
    handleRequestMoveMod,
    handleFixMod,
  };
}
