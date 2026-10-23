import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
import { readNevernessModeFallback } from "../model/characterHelpers.js";
export function useNevernessMode({
  initialCache,
  activeGame,
  setToast,
  isNeverness,
  fetchCharacters,
}) {
  const [nevernessDx12Status, setNevernessDx12Status] = React.useState(
    () =>
      initialCache?.nevernessDx12Status ||
      (activeGame?.id === "neverness-to-everness"
        ? {
            success: true,
            mode: readNevernessModeFallback(activeGame),
            paths: {},
          }
        : null),
  );
  const [showDx12RiskConfirm, setShowDx12RiskConfirm] = React.useState(false);
  const [dx12Busy, setDx12Busy] = React.useState(false);
  const nevernessMode = nevernessDx12Status?.mode === "dx12" ? "dx12" : "nemi";
  async function refreshNevernessDx12Status() {
    try {
      const result = await window.api.nevernessDx12Status?.();
      if (result?.success) {
        setNevernessDx12Status(result);
        try {
          localStorage.setItem(
            "neverness-mod-mode",
            result.mode === "dx12" ? "dx12" : "nemi",
          );
        } catch {}
      }
      return result;
    } catch (e) {
      setToast({
        type: "error",
        message: t("characters.mode.readPakException", {
          message: e.message,
        }),
      });
      return null;
    }
  }
  async function handleSwitchNevernessMode(mode) {
    if (!isNeverness || dx12Busy || mode === nevernessMode) return;
    if (mode === "dx12") {
      setShowDx12RiskConfirm(true);
      return;
    }
    setDx12Busy(true);
    try {
      const result = await window.api.nevernessDx12SetMode?.("nemi");
      if (result?.success) {
        setNevernessDx12Status(result);
        try {
          localStorage.setItem("neverness-mod-mode", "nemi");
        } catch {}
        setToast({
          type: "success",
          message: t("characters.mode.dx11Enabled"),
        });
        fetchCharacters({
          keepVisible: true,
        });
      } else {
        setToast({
          type: "error",
          message: result?.error || t("common.errors.switchFailed"),
        });
      }
    } catch (e) {
      setToast({
        type: "error",
        message: t("common.errors.switchException", {
          message: e.message,
        }),
      });
    } finally {
      setDx12Busy(false);
    }
  }
  async function confirmEnableDx12Mode() {
    setDx12Busy(true);
    try {
      const status = await refreshNevernessDx12Status();
      if (!status?.success)
        throw new Error(status?.error || t("characters.mode.readPakFailed"));
      const result = await window.api.nevernessDx12SetMode?.("dx12");
      if (!result?.success)
        throw new Error(result?.error || t("common.errors.switchFailed"));
      setNevernessDx12Status(result);
      try {
        localStorage.setItem("neverness-mod-mode", "dx12");
      } catch {}
      setShowDx12RiskConfirm(false);
      setToast({
        type: "success",
        message: t("characters.mode.pakEnabled"),
      });
      fetchCharacters({
        keepVisible: true,
      });
    } catch (e) {
      setToast({
        type: "error",
        message: e.message,
      });
    } finally {
      setDx12Busy(false);
    }
  }
  async function handleOpenDx12PakFolder() {
    const result = await window.api.nevernessDx12OpenPakFolder?.();
    if (!result?.success)
      setToast({
        type: "error",
        message: result?.error || t("characters.mode.openPakFolderFailed"),
      });
  }
  return {
    nevernessDx12Status,
    setNevernessDx12Status,
    showDx12RiskConfirm,
    setShowDx12RiskConfirm,
    dx12Busy,
    nevernessMode,
    refreshNevernessDx12Status,
    handleSwitchNevernessMode,
    confirmEnableDx12Mode,
    handleOpenDx12PakFolder,
  };
}
