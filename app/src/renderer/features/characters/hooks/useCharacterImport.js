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
  normalizeSearchValue,
  INTEGRATED_PACKAGE_DOWNLOAD_URL,
  INTEGRATED_PACKAGE_EXTRACTOR_URL,
} from "../model/characterHelpers.js";
export function useCharacterImport({
  characters,
  pinnedCharacters,
  characterUsageMap,
  searchableCharacterIndex,
  setToast,
  activeGame,
  refreshNevernessDx12Status,
  fetchCharacters,
}) {
  const [batchImport, setBatchImport] = React.useState(null);
  const [batchCharacterPickerPosition, setBatchCharacterPickerPosition] =
    React.useState(null);
  const [showBatchGuide, setShowBatchGuide] = React.useState(false);
  const [showIntegratedPackageGuide, setShowIntegratedPackageGuide] =
    React.useState(false);
  const batchImportHasIntegratedCandidate = !!(
    batchImport?.items?.some((item) => item.integratedPackageCandidate) ||
    batchImport?.classifyItems?.some((item) => item.integratedPackageCandidate)
  );
  const batchImportHasCertainIntegratedCandidate = !!(
    batchImport?.items?.some(
      (item) =>
        item.integratedPackageCandidate && !item.integratedPackageAmbiguous,
    ) ||
    batchImport?.classifyItems?.some((item) => item.installAsIntegratedPackage)
  );
  const batchImportHasManagedInstall = !!(
    batchImport?.items?.some((item) =>
      isManagedInstallContentType(item.installContentType),
    ) ||
    batchImport?.classifyItems?.some((item) =>
      isManagedInstallContentType(item.installContentType),
    )
  );
  const batchImportTitle = batchImportHasManagedInstall
    ? t("characters.import.installManagedPackage")
    : batchImport?.entryMode === "integratedPackage" ||
        batchImportHasCertainIntegratedCandidate
      ? t("characters.import.integratedTitle")
      : t("characters.import.batchModsTitle");
  const batchImportIsIntegratedEntry =
    batchImport?.entryMode === "integratedPackage" ||
    batchImportHasIntegratedCandidate;
  const batchCharacterOptions = React.useMemo(() => {
    const originalOrderIndex = new Map(
      characters.map((char, index) => [char.name, index]),
    );
    return [...characters].sort((left, right) => {
      const leftPinned = pinnedCharacters.has(left.name);
      const rightPinned = pinnedCharacters.has(right.name);
      if (leftPinned !== rightPinned) return leftPinned ? -1 : 1;
      const usageDiff =
        Number(characterUsageMap?.[right.name] || 0) -
        Number(characterUsageMap?.[left.name] || 0);
      if (usageDiff !== 0) return usageDiff;
      return (
        (originalOrderIndex.get(left.name) || 0) -
        (originalOrderIndex.get(right.name) || 0)
      );
    });
  }, [characterUsageMap, characters, pinnedCharacters]);
  function getBatchCharacterOptions(query) {
    const normalizedQuery = normalizeSearchValue(query);
    if (!normalizedQuery) return batchCharacterOptions.slice(0, 24);
    return batchCharacterOptions
      .filter((char) => {
        const tokens = searchableCharacterIndex.get(char?.name) || [];
        return tokens.some((token) => token.includes(normalizedQuery));
      })
      .slice(0, 24);
  }
  function updateBatchClassifyItem(index, patch) {
    setBatchImport((previous) =>
      updateImportItem(previous, "classifyItems", index, (current) => ({
        ...current,
        ...patch,
      })),
    );
  }
  function updateBatchCharacterPickerPosition(input) {
    const rect = input?.getBoundingClientRect?.();
    if (!rect) return;
    const margin = 12;
    const width = Math.max(rect.width, 220);
    const spaceBelow = window.innerHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    const openAbove = spaceBelow < 220 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(
      160,
      Math.min(320, openAbove ? spaceAbove - 6 : spaceBelow - 6),
    );
    const left = Math.min(
      Math.max(margin, rect.left),
      window.innerWidth - width - margin,
    );
    const top = openAbove
      ? Math.max(margin, rect.top - maxHeight - 6)
      : Math.min(window.innerHeight - margin - maxHeight, rect.bottom + 6);
    setBatchCharacterPickerPosition({
      top,
      left,
      width,
      maxHeight,
    });
  }
  function selectBatchCharacter(index, characterName) {
    updateBatchClassifyItem(index, {
      targetCharacter: characterName,
      charQuery: characterName === "其他" ? "" : characterName,
      charPickerOpen: false,
    });
    setBatchCharacterPickerPosition(null);
  }
  function updateBatchScanItem(index, patch) {
    setBatchImport((previous) =>
      updateImportItem(previous, "items", index, (current) => ({
        ...current,
        ...patch,
      })),
    );
  }
  function setBatchPlanPreviewItemSelected(index, previewItem, checked) {
    setBatchImport((previous) =>
      updateImportItem(previous, "items", index, (current) =>
        setImportPreviewSelection(current, previewItem?.path, checked),
      ),
    );
  }
  function setBatchPlanScanMode(index, item, mode) {
    setBatchImport((previous) =>
      updateImportItem(previous, "items", index, (current) =>
        setImportPlanMode(current, mode),
      ),
    );
  }
  function setClassifyInstallMode(index, item, mode) {
    const singleName =
      item.singleModName ||
      stripDisabledPrefix(item.realName || item.name || item.modName || "Mod");
    if (mode === "integrated") {
      updateBatchClassifyItem(index, {
        installAsIntegratedPackage: true,
        installAsMultipleMods: false,
        modName: t("characters.import.integratedPackage"),
        charPickerOpen: false,
      });
    } else if (mode === "multiple") {
      updateBatchClassifyItem(index, {
        installAsIntegratedPackage: false,
        installAsMultipleMods: true,
        singleModName: singleName,
        modName: `${item.multiModCount || item.multiModNames?.length || 2} Mods`,
        charPickerOpen: false,
      });
    } else {
      const targetCharacter =
        item.targetCharacter && item.targetCharacter !== "__all__"
          ? item.targetCharacter
          : autoMatchCharacter(singleName, characters);
      updateBatchClassifyItem(index, {
        installAsIntegratedPackage: false,
        installAsMultipleMods: false,
        modName: singleName,
        singleModName: singleName,
        targetCharacter,
        charQuery: targetCharacter === "其他" ? "" : targetCharacter,
        charPickerOpen: false,
      });
    }
    setBatchCharacterPickerPosition(null);
  }
  function stripDisabledPrefix(name) {
    return name.replace(/^DISABLED_/i, "");
  }
  function autoMatchCharacter(itemName, charList) {
    const norm = (s) => s.toLowerCase().replace(/[\s_\-·]/g, "");
    const normalized = norm(itemName);
    const getTerms = (c) => {
      const terms = [c.name];
      if (Array.isArray(c.searchTerms)) terms.push(...c.searchTerms);
      return terms;
    };
    for (const c of charList) {
      if (getTerms(c).some((t) => normalized.startsWith(norm(t))))
        return c.name;
    }
    for (const c of charList) {
      if (
        getTerms(c).some((t) => {
          const nt = norm(t);
          return nt && normalized.includes(nt);
        })
      )
        return c.name;
    }
    return t("characters.groups.other");
  }
  function handleBatchImportClick() {
    try {
      const dismissed =
        localStorage.getItem("batch-import-guide-dismissed") === "true";
      if (dismissed) {
        handleOpenBatchImport();
      } else {
        setShowBatchGuide(true);
      }
    } catch {
      setShowBatchGuide(true);
    }
  }
  async function handleOpenBatchImport() {
    setShowBatchGuide(false);
    const result = await window.api.batchScanFolder();
    if (!result || result.canceled || result.error) return;
    const items = (result.items || []).map((item) => ({
      ...item,
      selected: true,
    }));
    setBatchImport({
      phase: "scan",
      folderPath: result.folderPath,
      items,
      entryMode: "batch",
    });
  }
  function handleIntegratedPackageImportClick() {
    setShowIntegratedPackageGuide(true);
  }
  function handleOpenIntegratedPackageDownload() {
    window.api.openExternalUrl?.(INTEGRATED_PACKAGE_DOWNLOAD_URL);
  }
  function handleOpenExtractorDownload() {
    window.api.openExternalUrl?.(INTEGRATED_PACKAGE_EXTRACTOR_URL);
  }
  async function handleOpenIntegratedPackageFiles() {
    setShowIntegratedPackageGuide(false);
    const result = await window.api.batchSelectFiles?.({
      title: t("characters.import.selectIntegratedFile"),
      buttonLabel: t("characters.import.selectIntegrated"),
      filterName: t("characters.import.fileFilter"),
    });
    if (!result || result.canceled) return;
    if (result.error) {
      setToast({
        type: "error",
        message: t("characters.import.selectIntegratedFailed", {
          error: result.error,
        }),
      });
      return;
    }
    const items = (result.items || []).map((item) => ({
      ...item,
      selected: true,
    }));
    if (!items.length) {
      setToast({
        type: "error",
        message: t("characters.import.noInstallablePackage"),
      });
      return;
    }
    setBatchImport({
      phase: "scan",
      folderPath: null,
      items,
      entryMode: "integratedPackage",
    });
  }
  async function handleStartDecrypt() {
    const selected = expandBatchPlanItems(batchImport.items).filter(
      (i) => i.selected,
    );
    if (!selected.length) return;
    const decryptProgress = selected.map((i) => ({
      name: i.name,
      importDisplayPath: getBatchImportDisplayPath(i),
      status: "pending",
      realName: null,
      error: null,
    }));
    setBatchImport((prev) => ({
      ...prev,
      phase: "decrypting",
      decryptProgress,
    }));
    const cleanup = window.api.onBatchDecryptProgress?.((data) => {
      setBatchImport((prev) => ({
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
                integratedPackageCandidate: !!data.integratedPackageCandidate,
                integratedPackageAmbiguous: !!data.integratedPackageAmbiguous,
                integratedPackageTotalItems:
                  data.integratedPackageTotalItems || 0,
                integratedPackageModCount: data.integratedPackageModCount || 0,
                integratedPackageCharacterCount:
                  data.integratedPackageCharacterCount || 0,
                multiModCandidate: !!data.multiModCandidate,
                multiModCount: data.multiModCount || 0,
                multiModNames: data.multiModNames || [],
              }
            : item,
        ),
      }));
    });
    const result = await window.api.batchDecryptAll({
      items: selected,
    });
    if (cleanup) cleanup();
    const preferredCharacter =
      batchImport.preferredCharacter &&
      characters.some((char) => char.name === batchImport.preferredCharacter)
        ? batchImport.preferredCharacter
        : "";
    const classifyItems = (result.results || []).map((r, i) => {
      const candidateName = stripDisabledPrefix(
        r.realName || selected[i]?.name || "Mod",
      );
      const installContentType = normalizeInstallContentType(
        r.installContentType || selected[i]?.installContentType,
      );
      const managedInstall = isManagedInstallContentType(installContentType);
      const forcedIntegrated = !!(
        selected[i]?.forceIntegratedPackage ||
        selected[i]?.expectedIntegratedPackage
      );
      const integratedPackageCandidate =
        !managedInstall && !!(r.integratedPackageCandidate || forcedIntegrated);
      const installAsIntegratedPackage =
        !managedInstall &&
        (forcedIntegrated ||
          (integratedPackageCandidate && !r.integratedPackageAmbiguous));
      const multiModCandidate = !!r.multiModCandidate;
      const matchedCharacter = managedInstall
        ? ""
        : preferredCharacter || autoMatchCharacter(candidateName, characters);
      return {
        filePath: r.originalPath,
        tempPath: r.tempPath,
        path: r.originalPath,
        name: selected[i]?.name || r.realName,
        type: selected[i]?.type,
        importMode: selected[i]?.importMode || "",
        importDisplayPath: getBatchImportDisplayPath(selected[i]),
        realName: r.realName,
        modName: managedInstall
          ? getInstallContentTypeLabel(installContentType)
          : installAsIntegratedPackage
            ? t("characters.import.integratedPackage")
            : candidateName,
        singleModName: candidateName,
        targetCharacter: matchedCharacter,
        charQuery: matchedCharacter === "其他" ? "" : matchedCharacter,
        selected: r.success,
        decryptSuccess: r.success,
        decryptError: r.error || null,
        installContentType,
        targetGameId:
          r.targetGameId || selected[i]?.targetGameId || activeGame?.id,
        importerName: r.importerName || selected[i]?.importerName || "",
        managedTargetPath:
          r.managedTargetPath || selected[i]?.managedTargetPath || "",
        managedTargetLabel:
          r.managedTargetLabel || selected[i]?.managedTargetLabel || "",
        managedTargetError:
          r.managedTargetError || selected[i]?.managedTargetError || "",
        integratedPackageCandidate,
        integratedPackageAmbiguous: !!r.integratedPackageAmbiguous,
        installAsIntegratedPackage,
        integratedPackageTotalItems: r.integratedPackageTotalItems || 0,
        integratedPackageModCount: r.integratedPackageModCount || 0,
        integratedPackageCharacterCount: r.integratedPackageCharacterCount || 0,
        multiModCandidate,
        installAsMultipleMods: false,
        multiModCount: r.multiModCount || 0,
        multiModNames: r.multiModNames || [],
      };
    });
    setBatchImport((prev) => ({
      ...prev,
      phase: "classify",
      classifyItems,
    }));
  }
  async function handleStartBatchImport() {
    const { classifyItems } = batchImport;
    const selected = (classifyItems || []).filter(
      (i) => i.selected && i.decryptSuccess,
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
    setBatchImport((prev) => ({
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
      setBatchImport((prev) => ({
        ...prev,
        progress: managedItems.length + data.current,
        total: managedItems.length + data.total,
        currentMod: data.modName,
      }));
    });
    const combinedResults = [];
    for (let index = 0; index < managedItems.length; index += 1) {
      const item = managedItems[index];
      setBatchImport((prev) => ({
        ...prev,
        progress: index,
        currentMod: getInstallContentTypeLabel(item.installContentType),
      }));
      const managedResult = await window.api.managedPackageInstall({
        sourcePath: item.filePath || item.path,
        installContentType: item.installContentType,
        gameId: item.targetGameId || activeGame?.id,
        importerName: item.importerName || "",
      });
      combinedResults.push({
        ...managedResult,
        modName:
          managedResult?.modName ||
          getInstallContentTypeLabel(item.installContentType),
      });
      setBatchImport((prev) => ({
        ...prev,
        progress: index + 1,
      }));
    }
    let modResult = {
      results: [],
    };
    if (modItems.length)
      modResult = await window.api.batchAddMods({
        items: modItems.map((i) => ({
          filePath: i.filePath || i.path,
          tempPath: i.tempPath || null,
          characterName: i.installAsIntegratedPackage
            ? "__all__"
            : i.targetCharacter || "其他",
          modName: i.installAsIntegratedPackage
            ? t("characters.import.integratedPackage")
            : i.modName,
          expectedIntegratedPackage: !!i.installAsIntegratedPackage,
          installAsIntegratedPackage: !!i.installAsIntegratedPackage,
          installAsMultipleMods: !!i.installAsMultipleMods,
          integratedPackageTotalItems: i.integratedPackageTotalItems || 0,
          integratedPackageModCount: i.integratedPackageModCount || 0,
          integratedPackageCharacterCount:
            i.integratedPackageCharacterCount || 0,
          multiModCount: i.multiModCount || 0,
          multiModNames: i.multiModNames || [],
        })),
      });
    if (cleanup) cleanup();
    const result = {
      results: [...combinedResults, ...(modResult.results || [])],
    };
    setBatchImport((prev) => ({
      ...prev,
      phase: "done",
      results: result.results || [],
    }));
    const importedPak = (result.results || []).some(
      (item) => item.success && item.modMode === "pak",
    );
    const importedIntegrated = (result.results || []).some(
      (item) => item.success && item.integratedPackage,
    );
    const integratedStats = (result.results || []).find(
      (item) => item.success && item.integratedPackage,
    );
    if (importedPak) {
      const status = await refreshNevernessDx12Status();
      if (status?.success)
        setToast({
          type: "success",
          message: t("characters.mode.detectedPak"),
        });
    } else if (importedIntegrated) {
      setToast({
        type: "success",
        message: t("characters.import.integratedInstalled", {
          characterCount: integratedStats?.characterCount || 0,
          modCount: integratedStats?.modCount || 0,
        }),
      });
    } else if (combinedResults.length === 1) {
      setToast({
        type: combinedResults[0].success ? "success" : "error",
        message: getManagedInstallResultMessage(combinedResults[0]),
      });
    }
    await fetchCharacters({
      keepVisible: true,
    });
  }
  return {
    batchImport,
    setBatchImport,
    batchCharacterPickerPosition,
    setBatchCharacterPickerPosition,
    showBatchGuide,
    setShowBatchGuide,
    showIntegratedPackageGuide,
    setShowIntegratedPackageGuide,
    batchImportHasManagedInstall,
    batchImportTitle,
    batchImportIsIntegratedEntry,
    getBatchCharacterOptions,
    updateBatchClassifyItem,
    updateBatchCharacterPickerPosition,
    selectBatchCharacter,
    updateBatchScanItem,
    setBatchPlanPreviewItemSelected,
    setBatchPlanScanMode,
    setClassifyInstallMode,
    handleBatchImportClick,
    handleOpenBatchImport,
    handleIntegratedPackageImportClick,
    handleOpenIntegratedPackageDownload,
    handleOpenExtractorDownload,
    handleOpenIntegratedPackageFiles,
    handleStartDecrypt,
    handleStartBatchImport,
  };
}
