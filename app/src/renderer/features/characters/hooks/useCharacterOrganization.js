import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
import { normalizeLegacyPreview } from "../model/characterHelpers.js";
export function useCharacterOrganization({
  initialCache,
  setToast,
  fetchCharacters,
}) {
  const [legacyImportPreview, setLegacyImportPreview] = React.useState(
    () => initialCache?.legacyImportPreview || null,
  );
  const [legacyPromptDismissed, setLegacyPromptDismissed] = React.useState(
    () => !!initialCache?.legacyPromptDismissed,
  );
  const [migratingLegacyImport, setMigratingLegacyImport] =
    React.useState(false);
  const [looseRootFolders, setLooseRootFolders] = React.useState(
    () => initialCache?.looseRootFolders || null,
  );
  const [misplacedModFolders, setMisplacedModFolders] = React.useState(
    () => initialCache?.misplacedModFolders || null,
  );
  const [quarantiningLooseRoot, setQuarantiningLooseRoot] =
    React.useState(false);
  const [showLooseRootReview, setShowLooseRootReview] = React.useState(false);
  const [selectedLooseRootItemIds, setSelectedLooseRootItemIds] =
    React.useState(() => new Set());
  const [selectedMisplacedItemIds, setSelectedMisplacedItemIds] =
    React.useState(() => new Set());
  const latestPreviewRef = React.useRef(null);
  const [scanningOrganization, setScanningOrganization] = React.useState(false);
  async function handleOrganizeCharacters({ quiet = false } = {}) {
    setScanningOrganization(true);
    try {
      const result = await window.api.previewCharacterOrganization();
      if (!result?.success)
        throw new Error(
          result?.error || t("characters.organization.scanFailed"),
        );
      const preview = normalizeLegacyPreview(result.legacyImport);
      setLegacyImportPreview(preview);
      latestPreviewRef.current = preview;
      setLegacyPromptDismissed(false);
      setLooseRootFolders(result.looseRootFolders || null);
      setMisplacedModFolders(result.misplacedModFolders || null);
      setShowLooseRootReview(false);
      // Review legacy moves first; rescan after confirmation before reviewing loose files.
      if (preview.hasCandidates) return;
      if (
        hasDetectedModIssues(
          result.looseRootFolders,
          result.misplacedModFolders,
        )
      ) {
        openModIssueReview(result.looseRootFolders, result.misplacedModFolders);
      } else if (!quiet) {
        setToast({
          type: "success",
          message: t("characters.organization.nothingToOrganize"),
        });
      }
    } catch (error) {
      setToast({
        type: "error",
        message: error.message || t("characters.organization.scanFailed"),
      });
    } finally {
      setScanningOrganization(false);
    }
  }
  async function handleMigrateLegacyImport() {
    try {
      setMigratingLegacyImport(true);
      const result = await window.api.migrateLegacyImport({
        token: legacyImportPreview?.token,
      });
      if (!result?.success) {
        throw new Error(
          result?.error || t("characters.organization.categoriesFailed"),
        );
      }
      const summary = result.summary || {};
      const conflictCount = Array.isArray(summary.skippedConflicts)
        ? summary.skippedConflicts.length
        : 0;
      const message =
        summary.migratedModCount > 0
          ? t("characters.organization.categoriesResult", {
              migratedModCount: summary.migratedModCount,
              status: conflictCount
                ? t("characters.organization.conflictsSuffix", {
                    conflictCount,
                  })
                : "",
            })
          : conflictCount > 0
            ? t("characters.organization.conflictsSkipped", {
                conflictCount,
              })
            : t("characters.organization.noOldCategories");
      const nextPreview = normalizeLegacyPreview(result.preview);
      latestPreviewRef.current = nextPreview;
      setLegacyImportPreview(nextPreview);
      setLegacyPromptDismissed(false);
      setToast({
        type: "success",
        message,
      });
      await fetchCharacters({
        keepVisible: true,
      });
      await handleOrganizeCharacters({
        quiet: true,
      });
    } catch (error) {
      setToast({
        type: "error",
        message: error.message || t("characters.organization.categoriesFailed"),
      });
    } finally {
      setMigratingLegacyImport(false);
    }
  }
  function getLooseIssueGroups(scan = looseRootFolders) {
    if (!scan?.hasLooseFolders) return [];
    const groups = [];
    const rootItems = [
      ...(scan.rootFolders || scan.folders || []),
      ...(scan.rootFiles || []),
    ].filter((item) => item?.id);
    if (rootItems.length > 0) {
      groups.push({
        id: "root",
        title: t("characters.organization.modsRoot"),
        subtitle: t("characters.organization.rootFilesHint"),
        targetText: t("characters.organization.rootQuarantineExample"),
        items: rootItems,
      });
    }
    for (const group of scan.characterGroups || []) {
      const items = (group.items || []).filter((item) => item?.id);
      if (!items.length) continue;
      groups.push({
        id: `character:${group.characterName}`,
        title: group.characterName,
        subtitle: t("characters.organization.looseResourcesHint"),
        targetText: t("characters.organization.characterQuarantineExample", {
          characterName: group.characterName,
        }),
        items,
      });
    }
    return groups;
  }
  function getMisplacedIssueGroups(scan = misplacedModFolders) {
    if (!scan?.hasMisplacedFolders) return [];
    return (scan.groups || [])
      .map((group) => {
        const items = (group.items || []).filter((item) => item?.id);
        if (!items.length) return null;
        return {
          id: `misplaced:${group.targetCharacterName}`,
          title: t("characters.organization.moveToCharacter", {
            targetCharacterName: group.targetCharacterName,
          }),
          subtitle: t("characters.organization.misplacedDescription"),
          targetText: t("characters.organization.keepFolderName", {
            targetCharacterName: group.targetCharacterName,
          }),
          targetCharacterName: group.targetCharacterName,
          items,
        };
      })
      .filter(Boolean);
  }
  function hasDetectedModIssues(
    looseScan = looseRootFolders,
    misplacedScan = misplacedModFolders,
  ) {
    return (
      getLooseIssueGroups(looseScan).length > 0 ||
      getMisplacedIssueGroups(misplacedScan).length > 0
    );
  }
  function getLooseIssueDefaultIds(scan = looseRootFolders) {
    return getLooseIssueGroups(scan)
      .flatMap((group) => group.items)
      .filter((item) => item.defaultSelected !== false)
      .map((item) => item.id);
  }
  function getMisplacedIssueDefaultIds(scan = misplacedModFolders) {
    return getMisplacedIssueGroups(scan)
      .flatMap((group) => group.items)
      .filter((item) => item.defaultSelected !== false)
      .map((item) => item.id);
  }
  function getLooseIssueReason(item) {
    if (item.reason === "non-chinese-folder")
      return t("characters.organization.nonChineseReason");
    if (item.reason === "resource-directory")
      return t("characters.organization.resourcesAtCategoryRoot");
    if (item.reason === "loose-file")
      return t("characters.organization.filesOutsideMod");
    if (item.reason === "root-file")
      return t("characters.organization.filesAtModsRoot");
    if (item.reason === "root-folder")
      return t("characters.organization.unknownCategory");
    return item.type === "directory"
      ? t("characters.organization.possibleMisplacedFolder")
      : t("characters.organization.possibleMisplacedFile");
  }
  function getMisplacedIssueReason(item) {
    const source =
      item.sourceLabel ||
      item.sourceCharacterName ||
      t("characters.organization.modsRoot");
    const target =
      item.targetCharacterName || t("characters.organization.correctCategory");
    const aliasText = item.matchedAlias
      ? t("characters.organization.matchedAlias", {
          matchedAlias: item.matchedAlias,
        })
      : "";
    if (item.reason === "root-character-mod")
      return t("characters.organization.moveExplanation", {
        source,
        aliasText,
        target,
      });
    return t("characters.organization.moveExplanation", {
      source,
      aliasText,
      target,
    });
  }
  function openModIssueReview(
    looseScan = looseRootFolders,
    misplacedScan = misplacedModFolders,
  ) {
    setSelectedLooseRootItemIds(new Set(getLooseIssueDefaultIds(looseScan)));
    setSelectedMisplacedItemIds(
      new Set(getMisplacedIssueDefaultIds(misplacedScan)),
    );
    setShowLooseRootReview(true);
  }
  function setLooseIssueSelection(ids, selected) {
    setSelectedLooseRootItemIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => {
        if (selected) next.add(id);
        else next.delete(id);
      });
      return next;
    });
  }
  function setMisplacedIssueSelection(ids, selected) {
    setSelectedMisplacedItemIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => {
        if (selected) next.add(id);
        else next.delete(id);
      });
      return next;
    });
  }
  function toggleLooseIssueItem(id) {
    setSelectedLooseRootItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleMisplacedIssueItem(id) {
    setSelectedMisplacedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  async function handleQuarantineLooseRootFolders() {
    try {
      const selectedLooseIds = Array.from(selectedLooseRootItemIds);
      const selectedMisplacedIds = Array.from(selectedMisplacedItemIds);
      if (selectedLooseIds.length === 0 && selectedMisplacedIds.length === 0) {
        setToast({
          type: "error",
          message: t("characters.organization.selectionRequired"),
        });
        return;
      }
      setQuarantiningLooseRoot(true);
      let movedCount = 0;
      let quarantinedCount = 0;
      if (selectedMisplacedIds.length > 0) {
        const result = await window.api.moveMisplacedModFolders?.({
          selectedIds: selectedMisplacedIds,
        });
        if (!result?.success) {
          throw new Error(
            result?.error || t("characters.organization.moveFailed"),
          );
        }
        movedCount = result.movedCount || 0;
      }
      if (selectedLooseIds.length > 0) {
        const result = await window.api.quarantineLooseRootFolders?.({
          selectedIds: selectedLooseIds,
        });
        if (!result?.success) {
          throw new Error(
            result?.error || t("characters.organization.quarantineFailed"),
          );
        }
        quarantinedCount = result.movedCount || 0;
      }
      setShowLooseRootReview(false);
      setLooseRootFolders(null);
      setMisplacedModFolders(null);
      setToast({
        type: "success",
        message: t("characters.organization.completed", {
          movedCount,
          quarantinedCount,
        }),
      });
      await fetchCharacters({
        keepVisible: true,
      });
    } catch (error) {
      setToast({
        type: "error",
        message: error.message || t("characters.organization.quarantineFailed"),
      });
    } finally {
      setQuarantiningLooseRoot(false);
    }
  }
  return {
    legacyImportPreview,
    setLegacyImportPreview,
    legacyPromptDismissed,
    setLegacyPromptDismissed,
    migratingLegacyImport,
    setLooseRootFolders,
    setMisplacedModFolders,
    quarantiningLooseRoot,
    showLooseRootReview,
    setShowLooseRootReview,
    selectedLooseRootItemIds,
    selectedMisplacedItemIds,
    latestPreviewRef,
    scanningOrganization,
    handleOrganizeCharacters,
    handleMigrateLegacyImport,
    getLooseIssueGroups,
    getMisplacedIssueGroups,
    getLooseIssueReason,
    getMisplacedIssueReason,
    setLooseIssueSelection,
    setMisplacedIssueSelection,
    toggleLooseIssueItem,
    toggleMisplacedIssueItem,
    handleQuarantineLooseRootFolders,
  };
}
