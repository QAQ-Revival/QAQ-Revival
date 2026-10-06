const MANAGED_INSTALL_OPTIONS = [
  { value: "mod", label: "作为 Mod" },
  { value: "xxmi-update", label: "更新 XXMI" },
  { value: "game-package-update", label: "更新游戏包" },
  { value: "fixer", label: "安装修复器" }
];
function normalizeInstallContentType(value) {
  return MANAGED_INSTALL_OPTIONS.some((option) => option.value === value) ? value : "mod";
}
function isManagedInstallContentType(value) {
  return normalizeInstallContentType(value) !== "mod";
}
function getInstallContentTypeLabel(value) {
  return MANAGED_INSTALL_OPTIONS.find((option) => option.value === normalizeInstallContentType(value))?.label || "作为 Mod";
}
function getManagedInstallResultMessage(result) {
  if (!result?.success) return result?.error || "安装失败";
  if (result.installContentType === "fixer") {
    return `独立修复器已更新：${result.fileName || result.resolvedExePath || ""}`;
  }
  if (result.installContentType === "xxmi-update") {
    return `XXMI 已更新，共覆盖 ${result.copiedFiles || 0} 个文件`;
  }
  return `游戏包已更新，共覆盖 ${result.copiedFiles || 0} 个文件（Mods 已保留）`;
}
export {
  MANAGED_INSTALL_OPTIONS as M,
  getManagedInstallResultMessage as a,
  getInstallContentTypeLabel as g,
  isManagedInstallContentType as i,
  normalizeInstallContentType as n
};
