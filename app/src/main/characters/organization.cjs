"use strict";

module.exports = {
  getKnownCharacterDisplayName,
  isLegacyCharacterContainerName,
  scanImportCandidates,
  shouldDeferDefaultCharacterBootstrap,
  buildImportMovePlan,
  executeImportMovePlan,
  organizeLegacyCharacterFoldersIfNeeded,
  organizationToken,
  previewOrganization,
  buildImportPreview
};
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const charactersCatalog = require("./catalog.cjs");
const coreLogger = require("../core/logger.cjs");
const gamesSettings = require("../games/settings.cjs");
const systemFiles = require("../system/files.cjs");
const LEGACY_CHARACTER_CONTAINER_NAMES = new Set(["character", "characters"]);
function readDirectoryEntriesSafe(dirPath) {
  try {
    return fs.readdirSync(dirPath, {
      withFileTypes: true
    });
  } catch (_) {
    return [];
  }
}
function getDefaultCharacterDisplayName(name, gameId2 = gamesSettings.getActiveGameScopeId()) {
  const normalizedKey = charactersCatalog.normalizeCharacterFolderKey(name);
  if (!normalizedKey) return null;
  const defaultCharacters = charactersCatalog.getDefaultCharactersForGame(gameId2);
  return defaultCharacters.find(entry => charactersCatalog.normalizeCharacterFolderKey(entry) === normalizedKey) || null;
}
function getKnownCharacterDisplayName(name, gameId2 = gamesSettings.getActiveGameScopeId()) {
  const mappingEntry = charactersCatalog.getCharacterMappingEntry(name, gameId2);
  if (mappingEntry?.displayName) {
    return mappingEntry.displayName;
  }
  return getDefaultCharacterDisplayName(name, gameId2);
}
function isLegacyCharacterContainerName(name) {
  return LEGACY_CHARACTER_CONTAINER_NAMES.has(charactersCatalog.normalizeCharacterFolderKey(name));
}
function classifyFolderImportRole(folderName, sourceRootPath, modsPath, gameId2 = gamesSettings.getActiveGameScopeId()) {
  const displayName = getKnownCharacterDisplayName(folderName, gameId2);
  if (!displayName) return null;
  const sourceRootResolved = path.resolve(sourceRootPath);
  const modsPathResolved = path.resolve(modsPath);
  const inNestedContainer = sourceRootResolved !== modsPathResolved;
  const isCanonicalRootFolder = charactersCatalog.normalizeCharacterFolderKey(folderName) === charactersCatalog.normalizeCharacterFolderKey(displayName);
  const needsMigration = inNestedContainer || !isCanonicalRootFolder;
  return {
    displayName,
    sourceName: folderName,
    sourceRootPath,
    inNestedContainer,
    isCanonicalRootFolder,
    needsMigration
  };
}
function listDirectModChildren(categoryDir) {
  return readDirectoryEntriesSafe(categoryDir).filter(entry => entry.isDirectory() && !entry.name.startsWith(".")).map(entry => ({
    name: entry.name,
    path: path.join(categoryDir, entry.name)
  }));
}
function analyzeImportSourceDirectory(sourceRootPath, modsPath, gameId2 = gamesSettings.getActiveGameScopeId()) {
  const categories = [];
  readDirectoryEntriesSafe(sourceRootPath).filter(entry => entry.isDirectory() && !entry.name.startsWith(".")).forEach(entry => {
    const role = classifyFolderImportRole(entry.name, sourceRootPath, modsPath, gameId2);
    if (!role) return;
    const sourceCategoryPath = path.join(sourceRootPath, entry.name);
    const modChildren = listDirectModChildren(sourceCategoryPath);
    if (modChildren.length === 0) return;
    categories.push({
      ...role,
      sourceCategoryPath,
      modChildren,
      modCount: modChildren.length
    });
  });
  return {
    sourceRootPath,
    relativeRoot: path.relative(modsPath, sourceRootPath) || ".",
    categories,
    actionableCategories: categories.filter(category => category.needsMigration)
  };
}
function scanImportCandidates(modsPath, gameId2 = gamesSettings.getActiveGameScopeId()) {
  if (!modsPath || !fs.existsSync(modsPath)) {
    return {
      modsPath,
      gameId: gameId2,
      hasCandidates: false,
      analyses: [],
      categories: [],
      existingCategories: [],
      sourceRoots: []
    };
  }
  const rootCandidates = [modsPath];
  for (const containerName of LEGACY_CHARACTER_CONTAINER_NAMES) {
    const candidate = path.join(modsPath, containerName);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      rootCandidates.push(candidate);
    }
  }
  const uniqueRoots = Array.from(new Set(rootCandidates.map(entry => path.resolve(entry))));
  const analyses = uniqueRoots.map(rootPath => analyzeImportSourceDirectory(rootPath, modsPath, gameId2));
  const categories = analyses.flatMap(analysis => analysis.actionableCategories);
  const existingCategories = analyses.flatMap(analysis => analysis.categories.filter(category => !category.needsMigration));
  return {
    modsPath,
    gameId: gameId2,
    hasCandidates: categories.length > 0,
    analyses,
    categories,
    existingCategories,
    sourceRoots: Array.from(new Set(categories.map(category => category.relativeRoot || path.relative(modsPath, category.sourceRootPath) || ".")))
  };
}
function shouldDeferDefaultCharacterBootstrap(modsPath, gameId2 = gamesSettings.getActiveGameScopeId()) {
  return scanImportCandidates(modsPath, gameId2).hasCandidates;
}
function buildImportMovePlan(scanResult, modsPath, gameId2 = gamesSettings.getActiveGameScopeId()) {
  const plan = {
    modsPath,
    gameId: gameId2,
    moves: [],
    sourceCategoryPaths: [],
    sourceRootPaths: [],
    categoryCount: scanResult?.categories?.length || 0,
    modCount: 0
  };
  for (const category of scanResult?.categories || []) {
    plan.sourceCategoryPaths.push(category.sourceCategoryPath);
    plan.sourceRootPaths.push(category.sourceRootPath);
    for (const modChild of category.modChildren) {
      plan.moves.push({
        sourceRootPath: category.sourceRootPath,
        sourceCategoryPath: category.sourceCategoryPath,
        sourceCategoryName: category.sourceName,
        targetDisplayName: category.displayName,
        sourceModName: modChild.name,
        sourceModPath: modChild.path,
        targetCategoryPath: path.join(modsPath, category.displayName),
        targetModPath: path.join(modsPath, category.displayName, modChild.name)
      });
      plan.modCount += 1;
    }
  }
  plan.sourceCategoryPaths = Array.from(new Set(plan.sourceCategoryPaths));
  plan.sourceRootPaths = Array.from(new Set(plan.sourceRootPaths));
  return plan;
}
function ensureCharacterCategoryDir(modsPath, displayName) {
  const categoryDir = path.join(modsPath, displayName);
  if (!fs.existsSync(categoryDir)) {
    fs.mkdirSync(categoryDir, {
      recursive: true
    });
  }
  return categoryDir;
}
function executeImportMovePlan(movePlan) {
  const movedCategories = new Set();
  const sourceRoots = new Set();
  const moved = [];
  const skippedConflicts = [];
  for (const move of movePlan.moves) {
    sourceRoots.add(path.relative(movePlan.modsPath, move.sourceRootPath) || ".");
    if (!fs.existsSync(move.sourceModPath)) {
      continue;
    }
    ensureCharacterCategoryDir(movePlan.modsPath, move.targetDisplayName);
    if (fs.existsSync(move.targetModPath)) {
      skippedConflicts.push({
        characterName: move.targetDisplayName,
        modName: move.sourceModName,
        sourcePath: move.sourceModPath,
        targetPath: move.targetModPath
      });
      continue;
    }
    systemFiles.moveDirectoryWithFallback(move.sourceModPath, move.targetModPath);
    moved.push({
      characterName: move.targetDisplayName,
      modName: move.sourceModName,
      sourcePath: move.sourceModPath,
      targetPath: move.targetModPath
    });
    movedCategories.add(move.targetDisplayName);
  }
  const cleanupTargets = [...movePlan.sourceCategoryPaths.slice().sort((left, right) => right.length - left.length), ...movePlan.sourceRootPaths.filter(rootPath => path.resolve(rootPath) !== path.resolve(movePlan.modsPath)).sort((left, right) => right.length - left.length)];
  cleanupTargets.forEach(systemFiles.removeDirectoryIfEmpty);
  const summary = {
    migratedCategoryCount: movedCategories.size,
    migratedModCount: moved.length,
    skippedConflicts,
    sourceRoots: Array.from(sourceRoots),
    moved
  };
  coreLogger.logger.info(`[ModsImport] scanned=${movePlan.categoryCount} categories, planned=${movePlan.modCount} mods, migrated=${summary.migratedModCount}, conflicts=${skippedConflicts.length}`);
  return summary;
}
const LEGACY_ORGANIZE_SCAN_CACHE_TTL_MS = 8e3;
const legacyOrganizeScanCache = new Map();
function getLegacyOrganizeScanCacheKey(modsPath, gameId2) {
  return `${gameId2 || ""}::${path.resolve(modsPath || "")}`;
}
function clearLegacyOrganizeScanCache(gameId2 = null) {
  if (!gameId2) {
    legacyOrganizeScanCache.clear();
    return;
  }
  for (const key of Array.from(legacyOrganizeScanCache.keys())) {
    if (key.startsWith(`${gameId2}::`)) legacyOrganizeScanCache.delete(key);
  }
}
function organizeLegacyCharacterFoldersIfNeeded() {
  // Legacy callers include read-only views. Organization is now explicitly previewed
  // and confirmed through legacy-import:migrate; opening a view must never move Mods.
  return null;
}
const organizationTokens = new Map();
function organizationToken(scan, modsPath, gameId2) {
  return crypto.createHash("sha256").update(JSON.stringify(buildImportMovePlan(scan, modsPath, gameId2))).digest("hex");
}
function previewOrganization(modsPath, gameId2) {
  const scan = scanImportCandidates(modsPath, gameId2);
  const token = organizationToken(scan, modsPath, gameId2);
  organizationTokens.set(gameId2, token);
  return {
    ...buildImportPreview(scan, modsPath),
    token
  };
}
function buildImportPreview(scanResult, modsPath) {
  if (!scanResult?.hasCandidates) {
    return {
      hasCandidates: false,
      categoryCount: 0,
      modCount: 0,
      sourceRoots: [],
      targetCharacters: [],
      previewMoves: []
    };
  }
  const movePlan = buildImportMovePlan(scanResult, modsPath, scanResult.gameId);
  const targetCharacters = Array.from(new Set([...movePlan.moves.map(move => move.targetDisplayName)]));
  return {
    hasCandidates: movePlan.moves.length > 0,
    categoryCount: movePlan.categoryCount,
    modCount: movePlan.modCount,
    sourceRoots: scanResult.sourceRoots,
    targetCharacters,
    previewMoves: movePlan.moves.slice(0, 8).map(move => ({
      sourceCategoryName: move.sourceCategoryName,
      targetDisplayName: move.targetDisplayName,
      modName: move.sourceModName
    }))
  };
}
Object.assign(module.exports, {
  LEGACY_CHARACTER_CONTAINER_NAMES,
  organizationTokens
});
