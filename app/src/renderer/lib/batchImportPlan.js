import { t } from "../../shared/i18n/index.mjs";
export function getCharacterUsageStorageKey(gameId) {
  return `charview-usage-${gameId || "default"}`;
}
export function isBatchFolderPlanItem(item) {
  return !!item?.importPlan && Array.isArray(item.importPlan?.splitOptions);
}
export function updateImportItem(state, collection, index, update) {
  if (!state?.[collection]) return state;
  return {
    ...state,
    [collection]: state[collection].map((item, itemIndex) =>
      itemIndex === index ? update(item) : item,
    ),
  };
}
export function setImportPlanMode(item, mode) {
  if (!isBatchFolderPlanItem(item)) return item;
  const plan = item.importPlan;
  const next = {
    ...item,
    selectedImportMode: mode,
  };
  if (mode === "multiple" && !item.selectedSplitOptionId) {
    next.selectedSplitOptionId =
      plan.defaultSplitOptionId || plan.splitOptions?.[0]?.id || "";
  }
  if (mode === "integrated" && !item.selectedIntegratedOptionId) {
    next.selectedIntegratedOptionId =
      plan.defaultIntegratedOptionId || plan.integratedOptions?.[0]?.id || "";
  }
  return next;
}
export function setImportPreviewSelection(item, targetPath, selected) {
  if (!isBatchFolderPlanItem(item))
    return {
      ...item,
      selected,
    };
  const plan = item.importPlan;
  // A source can appear in several import plans; its selection stays consistent.
  const updateEntry = (entry) =>
    entry?.path === targetPath
      ? {
          ...entry,
          selected,
        }
      : entry;
  return {
    ...item,
    selected: true,
    importPlan: {
      ...plan,
      wholeItem: updateEntry(plan.wholeItem),
      splitOptions: (plan.splitOptions || []).map((option) => ({
        ...option,
        items: (option.items || []).map(updateEntry),
      })),
      integratedOptions: (plan.integratedOptions || []).map((option) => ({
        ...option,
        item: updateEntry(option.item),
      })),
    },
  };
}
export function getPlanSelectedMode(item) {
  return item?.selectedImportMode || item?.importPlan?.defaultMode || "single";
}
export function normalizeImportDisplayPart(value) {
  return String(value || "")
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .trim();
}
export function joinImportDisplayPath(...parts) {
  return parts.map(normalizeImportDisplayPart).filter(Boolean).join("/");
}
export function getBatchImportDisplayPath(item, fallbackRootName = "") {
  if (!item) return "";
  if (item.importDisplayPath) return item.importDisplayPath;
  const rootName =
    fallbackRootName || item.importPlanRootName || item.importRootName || "";
  const relativePath = item.importRelativePath || "";
  return (
    joinImportDisplayPath(rootName, relativePath) ||
    normalizeImportDisplayPart(relativePath) ||
    item.name ||
    ""
  );
}
export function decorateBatchImportItem(item, rootName = "") {
  if (!item) return item;
  const displayPath = getBatchImportDisplayPath(item, rootName);
  return {
    ...item,
    importPlanRootName:
      rootName || item.importPlanRootName || item.importRootName || "",
    importDisplayPath: displayPath,
  };
}
export function getSelectedBatchPlanItems(item) {
  if (!isBatchFolderPlanItem(item)) return [decorateBatchImportItem(item)];
  const plan = item.importPlan;
  const rootName = plan.rootName || item.name || "";
  const mode = getPlanSelectedMode(item);
  const applyPreferredName = (entry) =>
    mode === "single" && item.preferredModName
      ? {
          ...entry,
          name: item.preferredModName,
          preferredModName: item.preferredModName,
        }
      : entry;
  if (mode === "integrated") {
    const option =
      (plan.integratedOptions || []).find(
        (entry) => entry.id === item.selectedIntegratedOptionId,
      ) ||
      (plan.integratedOptions || []).find(
        (entry) => entry.id === plan.defaultIntegratedOptionId,
      ) ||
      (plan.integratedOptions || [])[0];
    return option?.item
      ? [
          decorateBatchImportItem(
            {
              ...option.item,
              selected:
                item.selected !== false && option.item.selected !== false,
            },
            rootName,
          ),
        ]
      : [
          decorateBatchImportItem(
            {
              ...plan.wholeItem,
              selected:
                item.selected !== false && plan.wholeItem?.selected !== false,
            },
            rootName,
          ),
        ];
  }
  if (mode === "multiple") {
    const option =
      (plan.splitOptions || []).find(
        (entry) => entry.id === item.selectedSplitOptionId,
      ) ||
      (plan.splitOptions || []).find(
        (entry) => entry.id === plan.defaultSplitOptionId,
      ) ||
      (plan.splitOptions || [])[0];
    return (option?.items?.length ? option.items : [plan.wholeItem]).map(
      (entry) => ({
        ...decorateBatchImportItem(entry, rootName),
        selected: item.selected !== false && entry.selected !== false,
      }),
    );
  }
  return [
    applyPreferredName(
      decorateBatchImportItem(
        {
          ...plan.wholeItem,
          selected:
            item.selected !== false && plan.wholeItem?.selected !== false,
        },
        rootName,
      ),
    ),
  ];
}
export function expandBatchPlanItems(items) {
  return (items || []).flatMap((item) => getSelectedBatchPlanItems(item));
}
export function getBatchPlanModeLabel(mode) {
  if (mode === "integrated") return t("characters.import.integratedPackage");
  if (mode === "multiple") return t("characters.import.multipleMods");
  return t("characters.import.singleMod");
}
