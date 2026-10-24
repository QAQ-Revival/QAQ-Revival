"use strict";

const i18n = require("../../shared/i18n/core.cjs");
module.exports = {
  isExternalExtractArchivePath,
  isLargeArchiveForExternalExtraction,
  formatLargeArchiveExternalExtractMessage,
  batchLoosePakItem,
  pushBatchItem,
  createBatchFolderItem,
  batchIsModFolder,
  batchArchiveItem,
  getMultiModPackageStats,
  isAmbiguousIntegratedModsSource,
  batchIntegratedPackageItem,
  batchDirectoryPlanItem,
  batchScanDir,
  scanBatchPaths
};
const path = require("path");
const fs = require("fs");
const archivesDisguised = require("../archives/disguised.cjs");
const archivesNames = require("../archives/names.cjs");
const importsIntegrated = require("./integrated.cjs");
const installAdvice = require("../install/advice.cjs");
const installManaged = require("../install/managed.cjs");
const modsNevernessPaks = require("../games/neverness/paks.cjs");
const systemFiles = require("../system/files.cjs");
const systemPaths = require("../system/paths.cjs");
const BATCH_ARCHIVE_EXTS = new Set([".zip", ".rar", ".7z", ".exe", ".mp4"]);
const BATCH_IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".dds", ".webp", ".bmp", ".gif"]);
const EXTERNAL_EXTRACT_ARCHIVE_EXTS = new Set([".zip", ".rar", ".7z", ".exe"]);
const LARGE_ARCHIVE_EXTERNAL_EXTRACT_BYTES = 10 * 1024 * 1024 * 1024;
function isExternalExtractArchivePath(filePath) {
  return EXTERNAL_EXTRACT_ARCHIVE_EXTS.has(path.extname(filePath || "").toLowerCase());
}
function isLargeArchiveForExternalExtraction(filePath, stat = null) {
  if (!isExternalExtractArchivePath(filePath)) return false;
  try {
    const fileStat = stat || fs.statSync(filePath);
    return fileStat.isFile() && fileStat.size > LARGE_ARCHIVE_EXTERNAL_EXTRACT_BYTES;
  } catch (_) {
    return false;
  }
}
function formatLargeArchiveExternalExtractMessage(filePath) {
  return [i18n.t("backend.imports.batchScan.largeArchiveDetected", {
    fileName: path.basename(filePath || "") || filePath
  }), i18n.t("backend.imports.batchScan.archiveSize", {
    fileSizeLabel: installAdvice.getFileSizeLabel(filePath)
  }), i18n.t("backend.imports.batchScan.extractLargeArchiveFirst")].join("\n");
}
function batchLoosePakItem(filePath) {
  const ext = modsNevernessPaks.getNevernessPakExt(path.basename(filePath));
  if (!ext || ext === ".sig") return null;
  const baseName = modsNevernessPaks.getNevernessPakBaseName(path.basename(filePath));
  const dirPath = path.dirname(filePath);
  const group = modsNevernessPaks.scanNevernessPakGroups(dirPath).find(candidate => candidate.baseName === baseName);
  if (!group) return null;
  return {
    name: baseName,
    path: dirPath,
    type: "pak-folder"
  };
}
function pushBatchItem(items, item) {
  if (!item) return false;
  const key = `${item.type || ""}
${item.path || ""}
${item.name || ""}`;
  if (items.some(existing => `${existing.type || ""}
${existing.path || ""}
${existing.name || ""}` === key)) return false;
  items.push(item);
  return true;
}
function createBatchFolderItem(dirPath, extras = {}) {
  return {
    name: path.basename(dirPath) || "Mod",
    path: dirPath,
    type: "folder",
    ...extras
  };
}
function getVisibleDirectoryEntries(dirPath) {
  try {
    return fs.readdirSync(dirPath, {
      withFileTypes: true
    }).filter(entry => entry.isDirectory() && !entry.name.startsWith("."));
  } catch (_) {
    return [];
  }
}
function commonParentPath(paths) {
  const normalized = (paths || []).filter(Boolean).map(p => path.resolve(p));
  if (!normalized.length) return null;
  const firstParent = path.dirname(normalized[0]);
  return normalized.every(p => systemPaths.isSameResolvedPath(path.dirname(p), firstParent)) ? firstParent : null;
}
function getBatchPlanOptionSample(names, limit = 3) {
  const values = (names || []).filter(Boolean);
  if (!values.length) return "";
  const shown = values.slice(0, limit).join("、");
  return values.length > limit ? i18n.t("backend.imports.batchScan.optionSample", {
    shown,
    count: values.length
  }) : shown;
}
function formatBatchImportDisplayPath(value) {
  return String(value || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}
function getBatchPlanLayerPathLabel(rootPath, rootName, parentDirs, depth) {
  if (depth === 0) return rootName;
  const parents = Array.isArray(parentDirs) ? parentDirs.filter(entry => entry?.path) : [];
  if (parents.length === 1) {
    return formatBatchImportDisplayPath([rootName, path.relative(rootPath, parents[0].path)].filter(Boolean).join("/")) || rootName;
  }
  const commonParent = commonParentPath(parents.map(entry => entry.path));
  const commonRelative = commonParent ? path.relative(rootPath, commonParent) : "";
  return formatBatchImportDisplayPath([rootName, commonRelative, i18n.t("backend.imports.batchScan.siblingFolders")].filter(Boolean).join("/")) || i18n.t("backend.imports.batchScan.nestedSiblingFolders", {
    rootName
  });
}
function looksLikeNamedModFolder(folderName) {
  const value = String(folderName || "");
  return /[-_—－]/.test(value) && !/^(mods?|resources?|textures?|body|head|lightmap|materialmap|toggles)$/i.test(value);
}
function buildBatchDirectoryImportPlan(dirPath) {
  try {
    if (!dirPath || !fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) return null;
  } catch (_) {
    return null;
  }
  const rootPath = path.resolve(dirPath);
  const rootName = path.basename(rootPath) || "Mod";
  const rootIntegratedStats = importsIntegrated.getIntegratedModsPackageStats(rootPath);
  const rootIntegratedAmbiguous = !!(rootIntegratedStats && isAmbiguousIntegratedModsSource(rootPath, rootIntegratedStats.sourceModsDir));
  const rootMultiStats = getMultiModPackageStats(rootPath);
  const wholeItem = createBatchFolderItem(rootPath, {
    importMode: "single",
    importPlanRoot: rootPath
  });
  const splitOptions = [];
  const integratedOptions = [];
  let parentDirs = [{
    path: rootPath,
    name: rootName,
    depth: 0
  }];
  for (let depth = 0; depth <= 4; depth++) {
    const childItems = [];
    for (const parent of parentDirs) {
      const children = getVisibleDirectoryEntries(parent.path);
      for (const child of children) {
        const childPath = path.join(parent.path, child.name);
        if (!systemFiles.directoryHasAnyFile(childPath)) continue;
        childItems.push(createBatchFolderItem(childPath, {
          importMode: "single",
          importPlanRoot: rootPath,
          importLayerDepth: depth + 1,
          importParentPath: parent.path,
          importParentName: parent.name,
          importRelativePath: path.relative(rootPath, childPath)
        }));
      }
    }
    if (childItems.length > 0) {
      const parentNames = parentDirs.map(entry => entry.name);
      const optionId = `children-depth-${depth}`;
      splitOptions.push({
        id: optionId,
        mode: "multiple",
        depth,
        label: depth === 0 ? i18n.t("backend.imports.batchScan.splitCurrentFolder") : i18n.t("backend.imports.batchScan.splitNamedFolder", {
          batchPlanOptionSample: getBatchPlanOptionSample(parentNames)
        }),
        pathLabel: getBatchPlanLayerPathLabel(rootPath, rootName, parentDirs, depth),
        description: i18n.t("backend.imports.batchScan.splitFolderDescription", {
          count: childItems.length
        }),
        itemCount: childItems.length,
        sampleNames: childItems.slice(0, 6).map(item => item.name),
        items: childItems
      });
      const integratedSource = parentDirs.length === 1 ? parentDirs[0].path : commonParentPath(parentDirs.map(entry => entry.path));
      if (integratedSource && systemFiles.directoryHasAnyFile(integratedSource)) {
        const integratedStats = importsIntegrated.getIntegratedModsPackageStats(integratedSource);
        integratedOptions.push({
          id: `integrated-depth-${depth}`,
          mode: "integrated",
          depth,
          label: depth === 0 ? i18n.t("backend.imports.batchScan.detectCurrentIntegratedPackage") : i18n.t("backend.imports.batchScan.detectNamedIntegratedPackage", {
            batchPlanOptionSample: getBatchPlanOptionSample(parentNames)
          }),
          pathLabel: formatBatchImportDisplayPath([rootName, path.relative(rootPath, integratedSource)].filter(Boolean).join("/")) || rootName,
          description: integratedStats ? i18n.t("backend.imports.batchScan.integratedPackageCounts", {
            characterCount: integratedStats.characterCount || 0,
            modCount: integratedStats.modCount || 0
          }) : i18n.t("backend.imports.batchScan.integratedPackageDescription"),
          itemCount: 1,
          item: {
            name: path.basename(integratedSource) || "整合包",
            path: integratedSource,
            type: "integrated-package",
            importMode: "integrated",
            importPlanRoot: rootPath,
            importRelativePath: path.relative(rootPath, integratedSource),
            expectedIntegratedPackage: true,
            forceIntegratedPackage: true,
            integratedPackageCandidate: true,
            integratedPackageAmbiguous: false,
            integratedPackageTotalItems: integratedStats?.totalItems || 0,
            integratedPackageModCount: integratedStats?.modCount || 0,
            integratedPackageCharacterCount: integratedStats?.characterCount || 0
          }
        });
      }
    }
    parentDirs = childItems.map(item => ({
      path: item.path,
      name: item.name,
      depth: depth + 1
    }));
    if (!parentDirs.length) break;
  }
  const defaultMode = (() => {
    if (rootIntegratedStats && !rootIntegratedAmbiguous) return "integrated";
    if (looksLikeNamedModFolder(rootName) || batchDirectoryLooksLikeModRoot(rootPath)) return "single";
    if (rootMultiStats.candidate || splitOptions.some(option => option.itemCount > 1)) return "multiple";
    return "single";
  })();
  const defaultSplitOption = splitOptions.find(option => option.itemCount === rootMultiStats.count) || splitOptions.find(option => option.itemCount > 1) || splitOptions[0] || null;
  const defaultIntegratedOption = integratedOptions.find(option => option.item.path === rootIntegratedStats?.sourceModsDir) || integratedOptions[0] || null;
  return {
    rootPath,
    rootName,
    wholeItem,
    defaultMode,
    defaultSplitOptionId: defaultSplitOption?.id || null,
    defaultIntegratedOptionId: defaultIntegratedOption?.id || null,
    rootIntegratedCandidate: !!rootIntegratedStats,
    rootIntegratedAmbiguous,
    rootIntegratedStats: rootIntegratedStats ? {
      sourceModsDir: rootIntegratedStats.sourceModsDir,
      characterCount: rootIntegratedStats.characterCount || 0,
      modCount: rootIntegratedStats.modCount || 0,
      totalItems: rootIntegratedStats.totalItems || 0,
      affectedCharacters: rootIntegratedStats.affectedCharacters || []
    } : null,
    rootMultiCandidate: !!rootMultiStats.candidate,
    rootMultiStats,
    splitOptions,
    integratedOptions
  };
}
function getDefaultItemsFromBatchImportPlan(plan, preferredMode = null) {
  if (!plan) return [];
  const mode = preferredMode || plan.defaultMode || "single";
  if (mode === "integrated") {
    const option = plan.integratedOptions?.find(item => item.id === plan.defaultIntegratedOptionId) || plan.integratedOptions?.[0];
    return option?.item ? [option.item] : [plan.wholeItem];
  }
  if (mode === "multiple") {
    const option = plan.splitOptions?.find(item => item.id === plan.defaultSplitOptionId) || plan.splitOptions?.[0];
    return option?.items?.length ? option.items : [plan.wholeItem];
  }
  return [plan.wholeItem];
}
function batchIsModFolder(dirPath) {
  try {
    const children = fs.readdirSync(dirPath, {
      withFileTypes: true
    });
    const visibleDirs = children.filter(c => c.isDirectory() && !c.name.startsWith("."));
    let hasLeafImage = false;
    return children.some(c => {
      if (c.isDirectory() && /^paks?$/i.test(c.name)) {
        return modsNevernessPaks.scanNevernessPakGroups(path.join(dirPath, c.name)).length > 0;
      }
      if (c.isFile() && BATCH_IMAGE_EXTS.has(path.extname(c.name).toLowerCase())) {
        hasLeafImage = true;
      }
      return c.isFile() && (c.name.toLowerCase().endsWith(".ini") || !!modsNevernessPaks.getNevernessPakExt(c.name));
    }) || visibleDirs.length === 0 && hasLeafImage;
  } catch {
    return false;
  }
}
function batchArchiveItem(filePath, allowExtensionlessDisguised = false) {
  const ext = path.extname(filePath).toLowerCase();
  const shouldProbeDisguised = ext === ".mp4" || ext === ".zip" || allowExtensionlessDisguised && !ext;
  const disguised = shouldProbeDisguised && archivesDisguised.isDisguisedMp4(filePath);
  if (!BATCH_ARCHIVE_EXTS.has(ext) && !disguised) return null;
  let fileSize = 0;
  try {
    fileSize = fs.statSync(filePath).size;
  } catch (_) {
    fileSize = 0;
  }
  return {
    name: archivesNames.getModArchiveName(filePath),
    path: filePath,
    type: ext ? ext.slice(1) : "disguised",
    disguised,
    fileSize,
    largeArchive: isLargeArchiveForExternalExtraction(filePath, fileSize ? {
      isFile: () => true,
      size: fileSize
    } : null)
  };
}
function batchDirectoryLooksLikeModRoot(dirPath) {
  if (batchIsModFolder(dirPath)) return true;
  try {
    const children = fs.readdirSync(dirPath, {
      withFileTypes: true
    });
    const visibleDirs = children.filter(entry => entry.isDirectory() && !entry.name.startsWith("."));
    if (!visibleDirs.length) return false;
    const modLikeChildCount = visibleDirs.filter(entry => {
      const childPath = path.join(dirPath, entry.name);
      if (batchIsModFolder(childPath)) return true;
      try {
        return fs.readdirSync(childPath, {
          withFileTypes: true
        }).some(child => child.isDirectory() && !child.name.startsWith(".") && /^(meshes|textures|resources?|shaderfixes|shaders?|buf|buffers?)$/i.test(child.name));
      } catch (_) {
        return false;
      }
    }).length;
    return modLikeChildCount > 0 && modLikeChildCount === visibleDirs.length;
  } catch (_) {
    return false;
  }
}
function getMultiModPackageStats(dirPath) {
  try {
    if (!dirPath || !fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
      return {
        candidate: false,
        count: 0,
        names: []
      };
    }
    const children = fs.readdirSync(dirPath, {
      withFileTypes: true
    });
    const visibleDirs = children.filter(entry => entry.isDirectory() && !entry.name.startsWith("."));
    const visibleFiles = children.filter(entry => entry.isFile() && !entry.name.startsWith("."));
    const rootHasModFile = visibleFiles.some(entry => {
      return entry.name.toLowerCase().endsWith(".ini") || !!modsNevernessPaks.getNevernessPakExt(entry.name);
    });
    if (visibleDirs.length < 2 || rootHasModFile) {
      return {
        candidate: false,
        count: 0,
        names: []
      };
    }
    const modDirs = visibleDirs.filter(entry => systemFiles.directoryHasAnyFile(path.join(dirPath, entry.name)));
    if (modDirs.length < 2) {
      return {
        candidate: false,
        count: 0,
        names: []
      };
    }
    return {
      candidate: true,
      count: modDirs.length,
      names: modDirs.map(entry => entry.name)
    };
  } catch (_) {
    return {
      candidate: false,
      count: 0,
      names: []
    };
  }
}
function isAmbiguousIntegratedModsSource(sourceRoot, sourceModsDir = null) {
  const modsDir = sourceModsDir || importsIntegrated.findIntegratedModsDir(sourceRoot);
  if (!sourceRoot || !modsDir) return false;
  try {
    if (path.basename(path.resolve(modsDir)).toLowerCase() === "mods") return false;
    if (path.basename(path.resolve(sourceRoot)).toLowerCase() === "mods") return false;
  } catch (_) {
    return false;
  }
  return batchDirectoryLooksLikeModRoot(sourceRoot);
}
function batchIntegratedPackageItem(dirPath) {
  const modsDir = importsIntegrated.findIntegratedModsDir(dirPath);
  if (!modsDir) return null;
  return {
    name: path.basename(dirPath) || "整合包",
    path: dirPath,
    type: "integrated-package",
    integratedPackageCandidate: true,
    integratedPackageAmbiguous: isAmbiguousIntegratedModsSource(dirPath, modsDir)
  };
}
function batchDirectoryPlanItem(dirPath, preferredMode = null) {
  const plan = buildBatchDirectoryImportPlan(dirPath);
  if (!plan) return null;
  if (!plan.rootIntegratedCandidate && !plan.rootMultiCandidate && !plan.splitOptions?.length && !batchIsModFolder(dirPath) && !batchDirectoryLooksLikeModRoot(dirPath) && !looksLikeNamedModFolder(path.basename(dirPath))) {
    return null;
  }
  return {
    ...createBatchFolderItem(dirPath),
    type: "folder-plan",
    importPlan: plan,
    selectedImportMode: preferredMode || plan.defaultMode || "single",
    selectedSplitOptionId: plan.defaultSplitOptionId,
    selectedIntegratedOptionId: plan.defaultIntegratedOptionId,
    defaultItems: getDefaultItemsFromBatchImportPlan(plan, preferredMode),
    integratedPackageCandidate: !!plan.rootIntegratedCandidate,
    integratedPackageAmbiguous: !!plan.rootIntegratedAmbiguous,
    multiModCandidate: !!plan.rootMultiCandidate,
    multiModCount: plan.rootMultiStats?.count || 0,
    multiModNames: plan.rootMultiStats?.names || []
  };
}
function batchScanDir(dirPath, items, maxDepth = 5) {
  if (maxDepth <= 0) return false;
  let entries;
  try {
    entries = fs.readdirSync(dirPath, {
      withFileTypes: true
    });
  } catch {
    return false;
  }
  let found = false;
  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);
    const managedItem = installManaged.buildManagedDropScanItem(entryPath);
    if (managedItem) {
      pushBatchItem(items, managedItem);
      found = true;
      continue;
    }
    if (entry.isDirectory()) {
      const integratedPackageItem = batchIntegratedPackageItem(entryPath);
      if (integratedPackageItem) {
        pushBatchItem(items, integratedPackageItem);
        found = true;
      } else if (batchIsModFolder(entryPath)) {
        pushBatchItem(items, batchDirectoryPlanItem(entryPath) || createBatchFolderItem(entryPath));
        found = true;
      } else {
        const foundInner = batchScanDir(entryPath, items, maxDepth - 1);
        if (foundInner) found = true;
      }
    } else if (entry.isFile()) {
      const item = batchArchiveItem(entryPath, false);
      const loosePakItem = item ? null : batchLoosePakItem(entryPath);
      if (item || loosePakItem) {
        pushBatchItem(items, item || loosePakItem);
        found = true;
      }
    }
  }
  return found;
}
function scanBatchPaths(paths) {
  const items = [];
  if (!Array.isArray(paths) || paths.length === 0) return items;
  for (const p of paths) {
    let stat;
    try {
      stat = fs.statSync(p);
    } catch {
      continue;
    }
    const managedItem = installManaged.buildManagedDropScanItem(p);
    if (managedItem) {
      pushBatchItem(items, managedItem);
      continue;
    }
    if (stat.isDirectory()) {
      const name = path.basename(p);
      const planItem = batchDirectoryPlanItem(p);
      if (planItem) {
        pushBatchItem(items, planItem);
      } else {
        const innerItems = [];
        const foundInner = batchScanDir(p, innerItems);
        if (foundInner) {
          items.push(...innerItems);
        } else {
          items.push(createBatchFolderItem(p, {
            name
          }));
        }
      }
    } else if (stat.isFile()) {
      const item = batchArchiveItem(p, true);
      const loosePakItem = item ? null : batchLoosePakItem(p);
      pushBatchItem(items, item || loosePakItem);
    }
  }
  return items;
}
