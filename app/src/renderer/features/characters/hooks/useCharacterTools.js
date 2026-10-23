import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
export function useCharacterTools({ setToast, activeGame }) {
  const [fixRunning, setFixRunning] = React.useState(false);
  async function handleResetCharacterIni(charName) {
    try {
      const result = await window.api.resetCharacterIni(charName);
      if (!result?.success) {
        throw new Error(result?.error || t("common.errors.resetFailed"));
      }
      if (result.restoredCount > 0) {
        setToast({
          type: "success",
          message: t("characters.fixer.iniReset", {
            charName,
            restoredCount: result.restoredCount,
          }),
        });
      } else {
        setToast({
          type: "success",
          message: t("characters.fixer.noIniToReset", {
            charName,
          }),
        });
      }
    } catch (error) {
      setToast({
        type: "error",
        message: error.message || t("common.errors.resetFailed"),
      });
    }
  }
  async function handleFixAll(mode = "external") {
    if (fixRunning) return;
    setFixRunning(true);
    try {
      const result = await window.api.fixRunAll(mode, activeGame?.id);
      if (result?.canceled) return;
      if (result?.success) {
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
  async function handleFixCharacter(charName, mode = "external") {
    if (fixRunning) return;
    setFixRunning(true);
    try {
      const result = await window.api.fixRunCharacter(
        charName,
        mode,
        activeGame?.id,
      );
      if (result?.canceled) return;
      if (result?.success) {
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
  async function handleSelectCustomFixExe() {
    if (fixRunning) return;
    setFixRunning(true);
    try {
      const result = await window.api.fixSelectCustomExe(activeGame?.id);
      if (result?.success) {
        setToast({
          type: "success",
          message: t("characters.fixer.saved", {
            fileName: result.fileName,
          }),
        });
      } else if (!result?.canceled) {
        setToast({
          type: "error",
          message: result?.error || t("common.errors.selectFailed"),
        });
      }
    } catch (e) {
      setToast({
        type: "error",
        message: e.message,
      });
    } finally {
      setFixRunning(false);
    }
  }
  return {
    fixRunning,
    handleResetCharacterIni,
    handleFixAll,
    handleFixCharacter,
    handleSelectCustomFixExe,
  };
}
