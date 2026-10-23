import { t } from "../../../../shared/i18n/index.mjs";
import {
  isBatchFolderPlanItem,
  expandBatchPlanItems,
  getBatchImportDisplayPath,
  updateImportItem,
  setImportPlanMode,
  setImportPreviewSelection,
} from "../../../lib/batchImportPlan.js";
import React from "react";
import {
  isManagedInstallContentType,
  normalizeInstallContentType,
  getInstallContentTypeLabel,
  getManagedInstallResultMessage,
} from "../../../lib/managedInstall.js";
import {
  getAppearanceImportTargetName,
  getExplicitImportAppearanceSectionId,
  notifyPakImported,
} from "../model/modHelpers.js";
import {
  BASE_SECTION_ID,
  getSectionId,
  getSectionName,
} from "../model/appearanceSections.js";
import { stripDisabledPrefix } from "../model/localCollections.js";
export function useModImport({
  setToast,
  characterName,
  activeAppearanceSectionIdRef,
  activeGameId,
  recordCharacterUsage,
  loadMods,
  appearanceSectionsWithStats,
  activeAppearanceSection,
}) {
  const [newModFile, setNewModFile] = React.useState(null);
  const [newModName, setNewModName] = React.useState("");
  const [directInstallProgress, setDirectInstallProgress] =
    React.useState(null);
  const [directImportReview, setDirectImportReview] = React.useState(null);
  function openDirectImportReview(scanItems, options = {}) {
    const items = (scanItems || []).map((item, index) => {
      const preferredName = index === 0 ? options.preferredModName : "";
      return {
        ...item,
        selected: item.selected !== false,
        ...(preferredName
          ? {
              name: preferredName,
              preferredModName: preferredName,
            }
          : {}),
      };
    });
    if (!items.length) {
      setToast({
        type: "error",
        message: t("mods.import.noInstallableMods"),
      });
      return false;
    }
    setDirectInstallProgress(null);
    setDirectImportReview({
      phase: "scan",
      items,
      folderPath: options.folderPath || null,
      preferredCharacter: characterName,
      appearanceSectionId:
        options.appearanceSectionId ||
        activeAppearanceSectionIdRef.current ||
        BASE_SECTION_ID,
    });
    return true;
  }
  function updateDirectImportScanItem(index, patch) {
    setDirectImportReview((previous) =>
      updateImportItem(previous, "items", index, (current) => ({
        ...current,
        ...patch,
      })),
    );
  }
  function setDirectImportPlanScanMode(index, item, mode) {
    setDirectImportReview((previous) =>
      updateImportItem(previous, "items", index, (current) =>
        setImportPlanMode(current, mode),
      ),
    );
  }
  function setDirectImportPreviewItemSelected(index, previewItem, checked) {
    setDirectImportReview((previous) =>
      updateImportItem(previous, "items", index, (current) =>
        setImportPreviewSelection(current, previewItem?.path, checked),
      ),
    );
  }
  function updateDirectClassifyItem(index, patch) {
    setDirectImportReview((previous) =>
      updateImportItem(previous, "classifyItems", index, (current) => ({
        ...current,
        ...patch,
      })),
    );
  }
  function setDirectClassifyInstallMode(index, item, mode) {
    const singleName =
      item.singleModName ||
      stripDisabledPrefix(item.realName || item.name || item.modName || "Mod");
    if (mode === "integrated") {
      updateDirectClassifyItem(index, {
        installAsIntegratedPackage: true,
        installAsMultipleMods: false,
        modName: t("characters.import.integratedPackage"),
      });
      return;
    }
    if (mode === "multiple") {
      updateDirectClassifyItem(index, {
        installAsIntegratedPackage: false,
        installAsMultipleMods: true,
        modName: t("mods.import.multipleModCount", {
          multiModCount:
            item.multiModCount ||
            item.multiModNames?.length ||
            t("common.options.automatic"),
        }),
        targetCharacter: characterName,
      });
      return;
    }
    updateDirectClassifyItem(index, {
      installAsIntegratedPackage: false,
      installAsMultipleMods: false,
      modName: singleName,
      singleModName: singleName,
      targetCharacter: characterName,
    });
  }
  async function handleStartDirectImportDecrypt() {
    const review = directImportReview;
    const selected = expandBatchPlanItems(review?.items).filter(
      (item) => item.selected,
    );
    if (!selected.length) return;
    const decryptProgress = selected.map((item) => ({
      name: item.name,
      importDisplayPath: getBatchImportDisplayPath(item),
      status: "pending",
      realName: null,
      error: null,
    }));
    setDirectImportReview((prev) => ({
      ...prev,
      phase: "decrypting",
      decryptProgress,
    }));
    const cleanup = window.api.onBatchDecryptProgress?.((data) => {
      setDirectImportReview((prev) =>
        prev?.decryptProgress
          ? {
              ...prev,
              decryptProgress: prev.decryptProgress.map((item, i) =>
                i === data.idx
                  ? {
                      ...item,
                      status: data.status,
                      stage: data.stage || item.stage || "",
                      message: data.message || item.message || "",
                      realName: data.realName || null,
                      error: data.error || null,
                      integratedPackageCandidate:
                        !!data.integratedPackageCandidate,
                      integratedPackageAmbiguous:
                        !!data.integratedPackageAmbiguous,
                      multiModCandidate: !!data.multiModCandidate,
                      multiModCount: data.multiModCount || 0,
                      multiModNames: data.multiModNames || [],
                    }
                  : item,
              ),
            }
          : prev,
      );
    });
    try {
      const result = await window.api.batchDecryptAll({
        items: selected,
      });
      const classifyItems = (result?.results || []).map((r, i) => {
        const sourceItem = selected[i] || {};
        const candidateName = stripDisabledPrefix(
          r.realName || sourceItem.name || "Mod",
        );
        const installContentType = normalizeInstallContentType(
          r.installContentType || sourceItem.installContentType,
        );
        const managedInstall = isManagedInstallContentType(installContentType);
        const forcedIntegrated = !!(
          sourceItem.forceIntegratedPackage ||
          sourceItem.expectedIntegratedPackage
        );
        const integratedPackageCandidate =
          !managedInstall &&
          !!(r.integratedPackageCandidate || forcedIntegrated);
        const installAsIntegratedPackage =
          !managedInstall &&
          (forcedIntegrated ||
            (integratedPackageCandidate && !r.integratedPackageAmbiguous));
        const multiModCandidate = !!r.multiModCandidate;
        return {
          filePath: r.originalPath,
          tempPath: r.tempPath,
          path: r.originalPath,
          name: sourceItem.name || r.realName,
          type: sourceItem.type,
          importMode: sourceItem.importMode || "",
          importDisplayPath: getBatchImportDisplayPath(sourceItem),
          realName: r.realName,
          modName: managedInstall
            ? getInstallContentTypeLabel(installContentType)
            : installAsIntegratedPackage
              ? t("characters.import.integratedPackage")
              : candidateName,
          singleModName: candidateName,
          targetCharacter: managedInstall ? "" : characterName,
          selected: r.success,
          decryptSuccess: r.success,
          decryptError: r.error || null,
          installContentType,
          targetGameId:
            r.targetGameId || sourceItem.targetGameId || activeGameId,
          importerName: r.importerName || sourceItem.importerName || "",
          managedTargetPath:
            r.managedTargetPath || sourceItem.managedTargetPath || "",
          managedTargetLabel:
            r.managedTargetLabel || sourceItem.managedTargetLabel || "",
          managedTargetError:
            r.managedTargetError || sourceItem.managedTargetError || "",
          integratedPackageCandidate,
          integratedPackageAmbiguous: !!r.integratedPackageAmbiguous,
          installAsIntegratedPackage,
          integratedPackageTotalItems: r.integratedPackageTotalItems || 0,
          integratedPackageModCount: r.integratedPackageModCount || 0,
          integratedPackageCharacterCount:
            r.integratedPackageCharacterCount || 0,
          multiModCandidate,
          installAsMultipleMods: false,
          multiModCount: r.multiModCount || 0,
          multiModNames: r.multiModNames || [],
        };
      });
      setDirectImportReview((prev) => ({
        ...prev,
        phase: "classify",
        classifyItems,
      }));
    } catch (err) {
      setDirectImportReview(null);
      setToast({
        type: "error",
        message: t("mods.import.analysisFailed", {
          message: err?.message || String(err),
        }),
      });
    } finally {
      if (cleanup) cleanup();
    }
  }
  async function handleStartDirectImportInstall() {
    const selected = (directImportReview?.classifyItems || []).filter(
      (item) => item.selected && item.decryptSuccess,
    );
    if (!selected.length) return;
    const getInstallProgressWeight = (item) => {
      const multiTotal = Number(item.multiModCount || 0);
      if (
        item.installAsMultipleMods &&
        Number.isFinite(multiTotal) &&
        multiTotal > 1
      )
        return multiTotal;
      const integratedTotal = Number(
        item.integratedPackageTotalItems || item.integratedPackageModCount || 0,
      );
      return item.installAsIntegratedPackage &&
        Number.isFinite(integratedTotal) &&
        integratedTotal > 0
        ? integratedTotal
        : 1;
    };
    const total = selected.reduce(
      (sum, item) => sum + getInstallProgressWeight(item),
      0,
    );
    setDirectImportReview((prev) => ({
      ...prev,
      phase: "importing",
      progress: 0,
      total,
      currentMod: "",
    }));
    const managedItems = selected.filter((item) =>
      isManagedInstallContentType(item.installContentType),
    );
    const modItems = selected.filter(
      (item) => !isManagedInstallContentType(item.installContentType),
    );
    const cleanup = window.api.onBatchProgress?.((data) => {
      setDirectImportReview((prev) => ({
        ...prev,
        progress: managedItems.length + data.current,
        total: managedItems.length + data.total,
        currentMod: data.modName,
      }));
    });
    try {
      const managedResults = [];
      for (let index = 0; index < managedItems.length; index += 1) {
        const item = managedItems[index];
        setDirectImportReview((prev) => ({
          ...prev,
          progress: index,
          currentMod: getInstallContentTypeLabel(item.installContentType),
        }));
        const managedResult = await window.api.managedPackageInstall({
          sourcePath: item.filePath || item.path,
          installContentType: item.installContentType,
          gameId: item.targetGameId || activeGameId,
          importerName: item.importerName || "",
        });
        managedResults.push({
          ...managedResult,
          modName:
            managedResult?.modName ||
            getInstallContentTypeLabel(item.installContentType),
        });
        setDirectImportReview((prev) => ({
          ...prev,
          progress: index + 1,
        }));
      }
      let modResult = {
        results: [],
      };
      if (modItems.length)
        modResult = await window.api.batchAddMods({
          items: modItems.map((item) => ({
            filePath: item.filePath || item.path,
            tempPath: item.tempPath || null,
            characterName: item.installAsIntegratedPackage
              ? "__all__"
              : characterName,
            modName: item.installAsIntegratedPackage
              ? t("characters.import.integratedPackage")
              : item.modName,
            appearanceSectionId: item.installAsIntegratedPackage
              ? null
              : getExplicitImportAppearanceSectionId(
                  directImportReview?.appearanceSectionId ||
                    activeAppearanceSectionIdRef.current ||
                    BASE_SECTION_ID,
                ),
            expectedIntegratedPackage: !!item.installAsIntegratedPackage,
            installAsIntegratedPackage: !!item.installAsIntegratedPackage,
            installAsMultipleMods: !!item.installAsMultipleMods,
            integratedPackageTotalItems: item.integratedPackageTotalItems || 0,
            integratedPackageModCount: item.integratedPackageModCount || 0,
            integratedPackageCharacterCount:
              item.integratedPackageCharacterCount || 0,
            multiModCount: item.multiModCount || 0,
            multiModNames: item.multiModNames || [],
          })),
        });
      const modResults = modResult?.results || [];
      const results = [...managedResults, ...modResults];
      const ok = modResults.reduce(
        (sum, item) => sum + (item.success ? Number(item.modCount || 1) : 0),
        0,
      );
      const importedPak = results.some(
        (item) => item.success && item.modMode === "pak",
      );
      setDirectImportReview((prev) => ({
        ...prev,
        phase: "done",
        results,
      }));
      if (ok > 0) recordCharacterUsage(ok);
      await loadMods({
        syncCharacterCache: ok > 0,
        conflictDelay: 1400,
      });
      if (importedPak)
        notifyPakImported({
          keepCurrentView: true,
          characterName,
        });
      if (managedResults.length === 1 && modResults.length === 0) {
        setToast({
          type: managedResults[0].success ? "success" : "error",
          message: getManagedInstallResultMessage(managedResults[0]),
        });
      }
    } catch (err) {
      setToast({
        type: "error",
        message: t("mods.import.installFailed", {
          message: err?.message || String(err),
        }),
      });
      setDirectImportReview((prev) => ({
        ...prev,
        phase: "classify",
      }));
    } finally {
      if (cleanup) cleanup();
    }
  }
  async function handleAddMod() {
    if (!newModFile || !newModName) return;
    try {
      const scan = await window.api.batchScanPaths?.([newModFile.path]);
      const scanItems = scan?.items || [];
      if (scanItems.length) {
        openDirectImportReview(scanItems, {
          preferredModName: newModName,
        });
        setNewModFile(null);
        setNewModName("");
        return;
      }
    } catch (_) {}
    const result = await window.api.addMod(characterName, newModFile.path, {
      name: newModName,
      appearanceSectionId: getExplicitImportAppearanceSectionId(
        activeAppearanceSectionIdRef.current || BASE_SECTION_ID,
      ),
    });
    if (result.success) {
      setNewModFile(null);
      setNewModName("");
      if (result.modMode === "pak") {
        setToast({
          type: "success",
          message: t("mods.import.pakDetected"),
        });
        await loadMods({
          syncCharacterCache: true,
          conflictDelay: 1400,
        });
        notifyPakImported({
          keepCurrentView: true,
          characterName,
        });
        return;
      }
      if (result.integratedPackage) {
        await loadMods({
          syncCharacterCache: true,
          conflictDelay: 1400,
        });
        setToast({
          type: "success",
          message: t("mods.import.integratedInstalled", {
            characterCount: result.characterCount || 0,
            modCount: result.modCount || 0,
          }),
        });
        return;
      }
      await loadMods({
        syncCharacterCache: true,
        conflictDelay: 1400,
      });
      const installedSection = appearanceSectionsWithStats.find(
        (section) => getSectionId(section) === result.appearanceSectionId,
      );
      setToast({
        type: "success",
        message: t("mods.import.addedToSection", {
          sectionName: getSectionName(
            installedSection || activeAppearanceSection,
          ),
        }),
      });
    } else {
      setToast({
        type: "error",
        message: t("characters.errors.addFailed", {
          error: result.error,
        }),
      });
    }
  }
  const [globalDragging, setGlobalDragging] = React.useState(false);
  function handleGlobalDragOver(e) {
    e.preventDefault();
    if (e.target.closest(".image-drop-zone")) {
      setGlobalDragging(false);
      return;
    }
    if (e.dataTransfer.types.includes("Files")) {
      let hasImage = false;
      if (e.dataTransfer.items) {
        for (let i = 0; i < e.dataTransfer.items.length; i++) {
          if (e.dataTransfer.items[i].type.startsWith("image/")) {
            hasImage = true;
            break;
          }
        }
      }
      if (!hasImage) {
        setGlobalDragging(true);
      } else {
        setGlobalDragging(false);
      }
    }
  }
  function handleGlobalDragLeave(e) {
    if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget)) {
      setGlobalDragging(false);
    }
  }
  function handleGlobalDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setGlobalDragging(false);
    const files = Array.from(e.dataTransfer?.files || []);
    if (!files.length) return;
    const allImages = files.every(
      (f) =>
        f.type?.startsWith("image/") ||
        /\.(png|jpg|jpeg|webp|gif|bmp)$/i.test(f.name || ""),
    );
    if (allImages) return;
    const paths = files
      .map((f) => window.api.getPathForFile(f))
      .filter(Boolean);
    if (!paths.length) return;
    runDirectInstallForCurrentCharacter(paths);
  }
  async function handleDirectImportDropFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const allImages = files.every(
      (file) =>
        file.type?.startsWith("image/") ||
        /\.(png|jpg|jpeg|webp|gif|bmp)$/i.test(file.name || ""),
    );
    if (allImages) return;
    const paths = files
      .map((file) => window.api.getPathForFile(file))
      .filter(Boolean);
    if (!paths.length) return;
    try {
      const scan = await window.api.batchScanPaths?.(paths);
      const scanItems = scan?.items || [];
      if (!scanItems.length) {
        setToast({
          type: "error",
          message: t("mods.import.noInstallableMods"),
        });
        return;
      }
      openDirectImportReview(scanItems);
    } catch (err) {
      setToast({
        type: "error",
        message: t("mods.import.scanFailed", {
          message: err?.message || String(err),
        }),
      });
    }
  }
  async function runDirectInstallForCurrentCharacter(paths) {
    let decryptCleanup = null;
    let progressCleanup = null;
    const targetAppearanceSectionId =
      activeAppearanceSectionIdRef.current || BASE_SECTION_ID;
    const targetAppearanceSection = appearanceSectionsWithStats.find(
      (section) => getSectionId(section) === targetAppearanceSectionId,
    );
    const targetAppearanceSectionName = getAppearanceImportTargetName(
      targetAppearanceSection,
    );
    try {
      const scan = await window.api.batchScanPaths(paths);
      const scanItems = scan?.items || [];
      if (!scanItems.length) {
        setToast({
          type: "error",
          message: t("mods.import.noInstallableMods"),
        });
        return;
      }
      if (openDirectImportReview(scanItems)) return;
      setDirectInstallProgress({
        phase: "decrypt",
        current: 0,
        total: scanItems.length,
        modName: "",
      });
      decryptCleanup = window.api.onBatchDecryptProgress?.((data) => {
        setDirectInstallProgress({
          phase: "decrypt",
          current: ["done", "error", "skipped"].includes(data?.status)
            ? (data?.idx ?? 0) + 1
            : (data?.idx ?? 0),
          total: data?.total ?? scanItems.length,
          modName: data?.message || data?.realName || "",
        });
      });
      const decryptResult = await window.api.batchDecryptAll({
        items: scanItems,
      });
      if (decryptCleanup) {
        decryptCleanup();
        decryptCleanup = null;
      }
      const multiModCandidates = (decryptResult?.results || []).filter(
        (r) =>
          r.success && r.multiModCandidate && !r.integratedPackageCandidate,
      );
      const installCandidatesAsMultiple =
        multiModCandidates.length > 0
          ? window.confirm(
              t("mods.import.confirmMultipleFolders", {
                multiModCandidatesCount: multiModCandidates.length,
              }),
            )
          : false;
      const addItems = (decryptResult?.results || [])
        .filter((r) => r.success)
        .map((r, i) => ({
          filePath: r.originalPath,
          tempPath: r.tempPath,
          characterName,
          modName: (r.realName || scanItems[i]?.name || "mod").replace(
            /^DISABLED_/i,
            "",
          ),
          appearanceSectionId: getExplicitImportAppearanceSectionId(
            targetAppearanceSectionId,
          ),
          installAsMultipleMods:
            installCandidatesAsMultiple && !!r.multiModCandidate,
          multiModCount: r.multiModCount || 0,
          multiModNames: r.multiModNames || [],
        }));
      if (!addItems.length) {
        setDirectInstallProgress(null);
        const firstError = (decryptResult?.results || []).find(
          (r) => !r.success && r.error,
        )?.error;
        setToast({
          type: "error",
          message: firstError || t("mods.import.extractionEmpty"),
        });
        return;
      }
      setDirectInstallProgress({
        phase: "install",
        current: 0,
        total: addItems.length,
        modName: "",
      });
      progressCleanup = window.api.onBatchProgress?.((data) => {
        setDirectInstallProgress({
          phase: "install",
          current: data?.current ?? 0,
          total: data?.total ?? addItems.length,
          modName: data?.modName || "",
        });
      });
      const result = await window.api.batchAddMods({
        items: addItems,
      });
      if (progressCleanup) {
        progressCleanup();
        progressCleanup = null;
      }
      const ok = (result?.results || []).reduce(
        (sum, r) => sum + (r.success ? Number(r.modCount || 1) : 0),
        0,
      );
      const fail = (result?.results || []).filter((r) => !r.success).length;
      setDirectInstallProgress(null);
      const importedPak = (result?.results || []).some(
        (r) => r.success && r.modMode === "pak",
      );
      const importedIntegrated = (result?.results || []).some(
        (r) => r.success && r.integratedPackage,
      );
      const integratedStats = (result?.results || []).find(
        (r) => r.success && r.integratedPackage,
      );
      setToast({
        type: fail > 0 ? "error" : "success",
        message:
          fail > 0
            ? t("mods.import.installResult", {
                ok,
                fail,
              })
            : importedPak
              ? t("mods.import.pakDetected")
              : importedIntegrated
                ? t("mods.import.integratedInstalled", {
                    characterCount: integratedStats?.characterCount || 0,
                    modCount: integratedStats?.modCount || 0,
                  })
                : t("mods.import.installedToSection", {
                    ok,
                    characterName,
                    targetAppearanceSectionName,
                  }),
      });
      if (importedPak) {
        await loadMods({
          syncCharacterCache: true,
          conflictDelay: 1400,
        });
        notifyPakImported({
          keepCurrentView: true,
          characterName,
        });
        return;
      }
      if (ok > 0) {
        recordCharacterUsage(ok);
        await loadMods({
          syncCharacterCache: true,
          conflictDelay: 1400,
        });
      }
    } catch (err) {
      setDirectInstallProgress(null);
      setToast({
        type: "error",
        message: t("mods.import.installFailed", {
          message: err?.message || String(err),
        }),
      });
    } finally {
      if (decryptCleanup) decryptCleanup();
      if (progressCleanup) progressCleanup();
    }
  }
  const directImportTargetSection =
    appearanceSectionsWithStats.find(
      (section) =>
        getSectionId(section) === directImportReview?.appearanceSectionId,
    ) || activeAppearanceSection;
  const directImportTargetSectionName = getAppearanceImportTargetName(
    directImportTargetSection,
  );
  const directImportHasManagedInstall = !!(
    directImportReview?.items?.some((item) =>
      isManagedInstallContentType(item.installContentType),
    ) ||
    directImportReview?.classifyItems?.some((item) =>
      isManagedInstallContentType(item.installContentType),
    )
  );
  return {
    newModFile,
    setNewModFile,
    newModName,
    setNewModName,
    directInstallProgress,
    directImportReview,
    setDirectImportReview,
    updateDirectImportScanItem,
    setDirectImportPlanScanMode,
    setDirectImportPreviewItemSelected,
    updateDirectClassifyItem,
    setDirectClassifyInstallMode,
    handleStartDirectImportDecrypt,
    handleStartDirectImportInstall,
    handleAddMod,
    globalDragging,
    handleGlobalDragOver,
    handleGlobalDragLeave,
    handleGlobalDrop,
    handleDirectImportDropFiles,
    directImportTargetSectionName,
    directImportHasManagedInstall,
  };
}
