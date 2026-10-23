import { t } from "../../shared/i18n/index.mjs";
function getManagedInstallOptions() {
  return [
    {
      value: "mod",
      label: t("mods.managedInstall.asMod"),
    },
    {
      value: "xxmi-update",
      label: t("mods.managedInstall.updateXxmi"),
    },
    {
      value: "game-package-update",
      label: t("mods.managedInstall.updateGamePackage"),
    },
    {
      value: "fixer",
      label: t("mods.managedInstall.installFixer"),
    },
  ];
}
function normalizeInstallContentType(value) {
  return getManagedInstallOptions().some((option) => option.value === value)
    ? value
    : "mod";
}
function isManagedInstallContentType(value) {
  return normalizeInstallContentType(value) !== "mod";
}
function getInstallContentTypeLabel(value) {
  return (
    getManagedInstallOptions().find(
      (option) => option.value === normalizeInstallContentType(value),
    )?.label || t("mods.managedInstall.asMod")
  );
}
function getManagedInstallResultMessage(result) {
  if (!result?.success) return result?.error || t("mods.managedInstall.failed");
  if (result.installContentType === "fixer") {
    return t("mods.managedInstall.fixerUpdated", {
      fileName: result.fileName || result.resolvedExePath || "",
    });
  }
  if (result.installContentType === "xxmi-update") {
    return t("mods.managedInstall.xxmiUpdated", {
      copiedFiles: result.copiedFiles || 0,
    });
  }
  return t("mods.managedInstall.gamePackageUpdated", {
    copiedFiles: result.copiedFiles || 0,
  });
}
export {
  getManagedInstallOptions,
  getManagedInstallResultMessage,
  getInstallContentTypeLabel,
  isManagedInstallContentType,
  normalizeInstallContentType,
};
