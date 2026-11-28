"use strict";

module.exports = {
  ensurePersistBridgeMigrationForActiveGame,
  ensurePersistBridgeMigrationForActiveGameAsync,
  ensurePersistBridgeMigrationForModDir,
  ensurePersistBridgeMigrationForModDirsAsync
};
const path = require("path");
const fs = require("fs");
const coreLogger = require("../core/logger.cjs");
const gamesSettings = require("../games/settings.cjs");
const modsBackups = require("../mods/backups.cjs");
const modsIniFiles = require("../mods/ini-files.cjs");
const persistIni = require("./ini.cjs");
const persistLayout = require("./layout.cjs");
const persistService = require("./service.cjs");
const persistTracking = require("./tracking.cjs");

function normalizeLookupKey(value) {
  return process.platform === "win32" ? String(value || "").toLowerCase() : String(value || "");
}
function createLoopYielder(budgetMs = 12) {
  let lastYield = performance.now();
  return async () => {
    if (performance.now() - lastYield >= budgetMs) {
      await new Promise(resolve => setImmediate(resolve));
      lastYield = performance.now();
    }
  };
}
async function writeFileIfChangedAsync(filePath, content) {
  const normalized = String(content || "").replace(/\r\n/g, "\n");
  try {
    const existing = (await fs.promises.readFile(filePath, "utf-8")).replace(/\r\n/g, "\n");
    if (existing === normalized) return false;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  await fs.promises.mkdir(path.dirname(filePath), {
    recursive: true
  });
  await fs.promises.writeFile(filePath, normalized, "utf-8");
  return true;
}
function collectIniAndBakFilesSync(rootDir) {
  const iniFiles = [];
  const bakSet = new Set();
  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, {
        withFileTypes: true
      });
    } catch (_) {
      return;
    }
    for (const entry of entries) {
      const filePath = path.join(dir, entry.name);
      let isDirectory = entry.isDirectory();
      if (!isDirectory && entry.isSymbolicLink()) {
        try {
          isDirectory = fs.statSync(filePath).isDirectory();
        } catch (_) {
          isDirectory = false;
        }
      }
      if (isDirectory) {
        walk(filePath);
      } else {
        const lowerName = entry.name.toLowerCase();
        if (lowerName.endsWith(".ini")) {
          iniFiles.push(filePath);
        } else if (lowerName.endsWith(".ini.qaqm-persistbak")) {
          bakSet.add(normalizeLookupKey(filePath));
        }
      }
    }
  }
  walk(rootDir);
  return {
    iniFiles,
    bakSet
  };
}
async function collectIniAndBakFilesAsync(rootDir, maybeYield) {
  const iniFiles = [];
  const bakSet = new Set();
  async function walk(dir) {
    let entries;
    try {
      entries = await fs.promises.readdir(dir, {
        withFileTypes: true
      });
    } catch (_) {
      return;
    }
    for (const entry of entries) {
      const filePath = path.join(dir, entry.name);
      let isDirectory = entry.isDirectory();
      if (!isDirectory && entry.isSymbolicLink()) {
        try {
          isDirectory = (await fs.promises.stat(filePath)).isDirectory();
        } catch (_) {
          isDirectory = false;
        }
      }
      if (isDirectory) {
        await walk(filePath);
      } else {
        const lowerName = entry.name.toLowerCase();
        if (lowerName.endsWith(".ini")) {
          iniFiles.push(filePath);
        } else if (lowerName.endsWith(".ini.qaqm-persistbak")) {
          bakSet.add(normalizeLookupKey(filePath));
        }
      }
    }
    if (maybeYield) await maybeYield();
  }
  await walk(rootDir);
  return {
    iniFiles,
    bakSet
  };
}
// Builds the state file for an INI that still has local persist declarations. An existing state
// file is merged, not replaced: declarations moved there by an earlier migration stay while INIs
// still reference them, so adding a variable to an already migrated INI cannot drop older ones.
function buildMergedPersistStateContent(descriptor, declarations, existingStateContent, readBridgeReferences, d3dxUserConstants) {
  const existingStateValues = new Map();
  let stateDeclarations = declarations;
  if (existingStateContent !== null) {
    try {
      for (const declaration of persistIni.parseLocalPersistDeclarations(existingStateContent)) {
        existingStateValues.set(declaration.normalizedName, declaration.defaultValue);
      }
      stateDeclarations = persistIni.mergeHostedPersistDeclarations(declarations, existingStateContent, readBridgeReferences(), descriptor.namespace);
    } catch (_) {}
  }
  for (const declaration of stateDeclarations) {
    const rawKey = `$\\${descriptor.namespace}\\${declaration.variableName}`;
    const entry = d3dxUserConstants.get(persistService.normalizeD3dxUserKey(rawKey));
    if (entry) existingStateValues.set(declaration.normalizedName, entry.value);
  }
  return persistIni.buildPersistBridgeStateContent(descriptor, stateDeclarations, existingStateValues);
}
function ensurePersistBridgeMigrationForActiveGame(root) {
  if (!root || persistLayout.preparedPersistBridgeRoots.has(root)) return {
    rebuiltIncludes: false
  };
  const gameId = persistTracking.getPersistBridgeGameIdForRoot(root);
  if (!persistTracking.isPersistBridgeEnabled(gameId)) {
    try {
      const activeIncludePath = persistLayout.getQaqmBridgeFilePath(root, persistLayout.PERSIST_ACTIVE_INCLUDE_FILE);
      if (fs.existsSync(activeIncludePath)) persistLayout.writeFileIfChanged(activeIncludePath, "");
      const modsRoot = gamesSettings.getModsPath(gameId) || path.join(root, "Mods");
      if (fs.existsSync(modsRoot)) {
        const restoredCount = modsBackups.restorePersistBakFiles(modsRoot);
        if (restoredCount > 0) {
          coreLogger.logger.info(`Persist OFF startup cleanup: restored ${restoredCount} .qaqm-persistbak file(s) in ${modsRoot}`);
        }
      }
    } catch (e) {
      coreLogger.logger.warn("Failed to restore persist bak files on startup:", e?.message || e);
    }
    persistLayout.preparedPersistBridgeRoots.add(root);
    return {
      rebuiltIncludes: false
    };
  }
  let rebuiltIncludes = false;
  try {
    persistLayout.migrateQaqmBridgeFilesToBridgeDir(root);
    persistLayout.migratePersistBridgeStateFilesToCacheDir(root);
    const modsRoot = gamesSettings.getModsPath(gameId) || path.join(root, "Mods");
    if (!fs.existsSync(modsRoot)) {
      persistLayout.preparedPersistBridgeRoots.add(root);
      return {
        rebuiltIncludes: false
      };
    }
    let migratedIniCount = 0;
    let generatedStateCount = 0;
    const {
      iniFiles,
      bakSet
    } = collectIniAndBakFilesSync(modsRoot);
    const iniContents = new Map();
    for (const iniPath of iniFiles) {
      try {
        iniContents.set(iniPath, fs.readFileSync(iniPath, "utf-8"));
      } catch (_) {}
    }
    const stateDir = persistLayout.getPersistBridgeStateDir(root);
    const existingStateFiles = new Set((fs.existsSync(stateDir) ? fs.readdirSync(stateDir) : []).map(normalizeLookupKey));
    let references = null;
    const readBridgeReferences = () => {
      if (!references) {
        references = persistIni.collectBridgeReferences(iniContents.values());
      }
      return references;
    };
    let d3dxUserConstants = null;
    const getD3dxUserConstants = () => {
      if (!d3dxUserConstants) {
        const d3dxUserPath = path.join(root, "d3dx_user.ini");
        d3dxUserConstants = d3dxUserPath && fs.existsSync(d3dxUserPath) ? persistService.readD3dxUserConstants(d3dxUserPath).constantsMap : new Map();
      }
      return d3dxUserConstants;
    };
    const bridgeMappings = [];
    for (const iniPath of iniFiles) {
      if (!iniContents.has(iniPath)) continue;
      const backupPath = `${iniPath}.qaqm-persistbak`;
      const backupKey = normalizeLookupKey(backupPath);
      if (bakSet.has(backupKey)) {
        try {
          const currentRaw = iniContents.get(iniPath);
          const hasQaqmRefs = currentRaw.includes("\\QAQM\\Persist\\Bridge_");
          if (hasQaqmRefs) {
            const bakContent = fs.readFileSync(backupPath, "utf-8");
            const bakDeclarations = persistIni.parseLocalPersistDeclarations(bakContent);
            if (bakDeclarations.length > 0) {
              const descriptor2 = persistIni.buildPersistBridgeDescriptor(modsRoot, iniPath);
              const stateKey2 = normalizeLookupKey(descriptor2.stateFileName);
              if (!existingStateFiles.has(stateKey2)) {
                const statePath2 = persistLayout.resolvePersistBridgeStatePath(root, descriptor2.stateFileName);
                const constantsMap = getD3dxUserConstants();
                const stateDeclarations2 = persistIni.mergeHostedPersistDeclarations(bakDeclarations, "", readBridgeReferences(), descriptor2.namespace);
                const existingStateValues2 = new Map();
                for (const declaration of stateDeclarations2) {
                  const rawKey = `$\\${descriptor2.namespace}\\${declaration.variableName}`;
                  const entry = constantsMap.get(persistService.normalizeD3dxUserKey(rawKey));
                  if (entry) existingStateValues2.set(declaration.normalizedName, entry.value);
                }
                const stateContent2 = persistIni.buildPersistBridgeStateContent(descriptor2, stateDeclarations2, existingStateValues2);
                fs.mkdirSync(path.dirname(statePath2), {
                  recursive: true
                });
                if (persistLayout.writeFileIfChanged(statePath2, stateContent2)) {
                  generatedStateCount += 1;
                }
                existingStateFiles.add(stateKey2);
              }
              const originalNamespace2 = persistIni.parseIniNamespace(bakContent);
              if (originalNamespace2) {
                bridgeMappings.push({
                  originalNamespace: originalNamespace2,
                  bridgeNamespace: descriptor2.namespace,
                  varNames: bakDeclarations.map(d => d.variableName)
                });
              }
            }
            continue;
          } else {
            fs.unlinkSync(backupPath);
            bakSet.delete(backupKey);
          }
        } catch (e) {
          coreLogger.logger.warn(`Failed to handle persist bak for ${iniPath}:`, e?.message || e);
          continue;
        }
      }
      const content = iniContents.get(iniPath);
      const declarations = persistIni.parseLocalPersistDeclarations(content);
      if (declarations.length === 0) continue;
      const descriptor = persistIni.buildPersistBridgeDescriptor(modsRoot, iniPath);
      const statePath = persistLayout.resolvePersistBridgeStatePath(root, descriptor.stateFileName);
      const stateKey = normalizeLookupKey(descriptor.stateFileName);
      let existingStateContent = null;
      if (existingStateFiles.has(stateKey)) {
        try {
          existingStateContent = fs.readFileSync(statePath, "utf-8");
        } catch (_) {
          existingStateContent = null;
        }
      }
      const stateContent = buildMergedPersistStateContent(descriptor, declarations, existingStateContent, readBridgeReferences, getD3dxUserConstants());
      fs.mkdirSync(path.dirname(statePath), {
        recursive: true
      });
      if (persistLayout.writeFileIfChanged(statePath, stateContent)) {
        generatedStateCount += 1;
      }
      existingStateFiles.add(stateKey);
      const originalNamespace = persistIni.parseIniNamespace(content);
      if (originalNamespace) {
        bridgeMappings.push({
          originalNamespace,
          bridgeNamespace: descriptor.namespace,
          varNames: declarations.map(d => d.variableName)
        });
      }
      const nextContent = persistIni.applyPersistBridgeToIniContent(content, descriptor, declarations);
      if (nextContent === content) continue;
      if (!bakSet.has(backupKey)) {
        fs.writeFileSync(backupPath, content, "utf-8");
        bakSet.add(backupKey);
      }
      fs.writeFileSync(iniPath, nextContent, "utf-8");
      iniContents.set(iniPath, nextContent);
      references = null;
      migratedIniCount += 1;
    }
    if (bridgeMappings.length > 0) {
      for (const iniPath of iniFiles) {
        const currentContent = iniContents.get(iniPath);
        if (currentContent === void 0) continue;
        const updatedContent = persistIni.applyExternalBridgeRefsToIniContent(currentContent, bridgeMappings);
        if (updatedContent === currentContent) continue;
        const backupPath = `${iniPath}.qaqm-persistbak`;
        const backupKey = normalizeLookupKey(backupPath);
        if (!bakSet.has(backupKey)) {
          fs.writeFileSync(backupPath, currentContent, "utf-8");
          bakSet.add(backupKey);
        }
        fs.writeFileSync(iniPath, updatedContent, "utf-8");
        iniContents.set(iniPath, updatedContent);
        migratedIniCount += 1;
      }
    }
    for (const iniPath of iniFiles) {
      const content = iniContents.get(iniPath);
      if (!content) continue;
      const hostedStateFiles = persistTracking.extractHostedPersistStateFilesFromContent(content);
      for (const stateFileName of hostedStateFiles) {
        const stateKey = normalizeLookupKey(stateFileName);
        if (existingStateFiles.has(stateKey)) continue;
        const hashMatch = stateFileName.match(/^qaqm_state_([a-f0-9]+)\.ini$/i);
        if (!hashMatch) continue;
        const hash = hashMatch[1];
        const namespace = `QAQM\\Persist\\Bridge_${hash}`;
        const varPattern = new RegExp(`\\$\\\\${persistLayout.escapeRegExp(namespace)}\\\\([A-Za-z_][A-Za-z0-9_]*)`, "gi");
        const variableNames = new Set();
        let varMatch;
        while ((varMatch = varPattern.exec(content)) !== null) {
          variableNames.add(varMatch[1]);
        }
        if (variableNames.size === 0) continue;
        const constantsMap = getD3dxUserConstants();
        const stateLines = Array.from(variableNames).map(name => {
          const rawKey = `$\\${namespace}\\${name}`;
          const entry = constantsMap.get(persistService.normalizeD3dxUserKey(rawKey));
          const value = entry ? entry.value : "0";
          return `global persist $${name} = ${value}`;
        });
        const stateContent = [`namespace = ${namespace}`, "", "[Constants]", ...stateLines, ""].join("\n");
        const statePath = persistLayout.resolvePersistBridgeStatePath(root, stateFileName);
        fs.mkdirSync(path.dirname(statePath), {
          recursive: true
        });
        if (persistLayout.writeFileIfChanged(statePath, stateContent)) {
          generatedStateCount += 1;
          coreLogger.logger.info(`Recreated missing persist bridge state file: ${stateFileName}`);
        }
        existingStateFiles.add(stateKey);
      }
    }
    if (migratedIniCount > 0 || generatedStateCount > 0) {
      coreLogger.logger.info(`Persist bridge migration completed for ${root}: ${migratedIniCount} ini files, ${generatedStateCount} state files`);
      if (generatedStateCount > 0) {
        try {
          persistTracking.rebuildActivePersistBridgeIncludes(root);
          rebuiltIncludes = true;
        } catch (e) {
          coreLogger.logger.warn("Failed to rebuild active includes after state file recreation:", e?.message || e);
        }
      }
    }
  } catch (e) {
    coreLogger.logger.warn("Failed to migrate persist bridge files:", e?.message || e);
  } finally {
    persistLayout.preparedPersistBridgeRoots.add(root);
  }
  return {
    rebuiltIncludes
  };
}
const pendingActiveGameMigrations = new Map();
async function ensurePersistBridgeMigrationForActiveGameAsync(root) {
  if (!root || persistLayout.preparedPersistBridgeRoots.has(root)) return {
    rebuiltIncludes: false
  };
  const pendingKey = normalizeLookupKey(path.resolve(root));
  if (pendingActiveGameMigrations.has(pendingKey)) {
    return pendingActiveGameMigrations.get(pendingKey);
  }
  const work = (async () => {
    const gameId = persistTracking.getPersistBridgeGameIdForRoot(root);
    if (!persistTracking.isPersistBridgeEnabled(gameId)) {
      try {
        const activeIncludePath = persistLayout.getQaqmBridgeFilePath(root, persistLayout.PERSIST_ACTIVE_INCLUDE_FILE);
        try {
          await fs.promises.access(activeIncludePath);
          await writeFileIfChangedAsync(activeIncludePath, "");
        } catch (_) {}
        const modsRoot = gamesSettings.getModsPath(gameId) || path.join(root, "Mods");
        const restoredCount = await modsBackups.restorePersistBakFilesAsync(modsRoot);
        if (restoredCount > 0) {
          coreLogger.logger.info(`Persist OFF startup cleanup: restored ${restoredCount} .qaqm-persistbak file(s) in ${modsRoot}`);
        }
      } catch (e) {
        coreLogger.logger.warn("Failed to restore persist bak files on startup:", e?.message || e);
      }
      persistLayout.preparedPersistBridgeRoots.add(root);
      return {
        rebuiltIncludes: false
      };
    }
    let rebuiltIncludes = false;
    try {
      const maybeYield = createLoopYielder(12);
      persistLayout.migrateQaqmBridgeFilesToBridgeDir(root);
      persistLayout.migratePersistBridgeStateFilesToCacheDir(root);
      const modsRoot = gamesSettings.getModsPath(gameId) || path.join(root, "Mods");
      try {
        if (!(await fs.promises.stat(modsRoot)).isDirectory()) {
          persistLayout.preparedPersistBridgeRoots.add(root);
          return {
            rebuiltIncludes: false
          };
        }
      } catch (_) {
        persistLayout.preparedPersistBridgeRoots.add(root);
        return {
          rebuiltIncludes: false
        };
      }
      let migratedIniCount = 0;
      let generatedStateCount = 0;
      const {
        iniFiles,
        bakSet
      } = await collectIniAndBakFilesAsync(modsRoot, maybeYield);
      const iniContents = new Map();
      for (const iniPath of iniFiles) {
        try {
          iniContents.set(iniPath, await fs.promises.readFile(iniPath, "utf-8"));
        } catch (_) {}
        await maybeYield();
      }
      const stateDir = persistLayout.getPersistBridgeStateDir(root);
      const existingStateFiles = new Set((await fs.promises.readdir(stateDir).catch(() => [])).map(normalizeLookupKey));
      let references = null;
      const readBridgeReferences = () => {
        if (!references) {
          references = persistIni.collectBridgeReferences(iniContents.values());
        }
        return references;
      };
      let d3dxUserConstants = null;
      const getD3dxUserConstantsAsync = async () => {
        if (!d3dxUserConstants) {
          d3dxUserConstants = (await persistService.readD3dxUserConstantsAsync(path.join(root, "d3dx_user.ini"))).constantsMap;
        }
        return d3dxUserConstants;
      };
      const bridgeMappings = [];
      for (const iniPath of iniFiles) {
        await maybeYield();
        if (!iniContents.has(iniPath)) continue;
        const backupPath = `${iniPath}.qaqm-persistbak`;
        const backupKey = normalizeLookupKey(backupPath);
        if (bakSet.has(backupKey)) {
          try {
            const currentRaw = iniContents.get(iniPath);
            const hasQaqmRefs = currentRaw.includes("\\QAQM\\Persist\\Bridge_");
            if (hasQaqmRefs) {
              const bakContent = await fs.promises.readFile(backupPath, "utf-8");
              const bakDeclarations = persistIni.parseLocalPersistDeclarations(bakContent);
              if (bakDeclarations.length > 0) {
                const descriptor2 = persistIni.buildPersistBridgeDescriptor(modsRoot, iniPath);
                const stateKey2 = normalizeLookupKey(descriptor2.stateFileName);
                if (!existingStateFiles.has(stateKey2)) {
                  const statePath2 = persistLayout.resolvePersistBridgeStatePath(root, descriptor2.stateFileName);
                  const constantsMap = await getD3dxUserConstantsAsync();
                  const stateDeclarations2 = persistIni.mergeHostedPersistDeclarations(bakDeclarations, "", readBridgeReferences(), descriptor2.namespace);
                  const existingStateValues2 = new Map();
                  for (const declaration of stateDeclarations2) {
                    const rawKey = `$\\${descriptor2.namespace}\\${declaration.variableName}`;
                    const entry = constantsMap.get(persistService.normalizeD3dxUserKey(rawKey));
                    if (entry) existingStateValues2.set(declaration.normalizedName, entry.value);
                  }
                  const stateContent2 = persistIni.buildPersistBridgeStateContent(descriptor2, stateDeclarations2, existingStateValues2);
                  if (await writeFileIfChangedAsync(statePath2, stateContent2)) {
                    generatedStateCount += 1;
                  }
                  existingStateFiles.add(stateKey2);
                }
                const originalNamespace2 = persistIni.parseIniNamespace(bakContent);
                if (originalNamespace2) {
                  bridgeMappings.push({
                    originalNamespace: originalNamespace2,
                    bridgeNamespace: descriptor2.namespace,
                    varNames: bakDeclarations.map(d => d.variableName)
                  });
                }
              }
              continue;
            } else {
              await fs.promises.unlink(backupPath).catch(() => {});
              bakSet.delete(backupKey);
            }
          } catch (e) {
            coreLogger.logger.warn(`Failed to handle persist bak for ${iniPath}:`, e?.message || e);
            continue;
          }
        }
        const content = iniContents.get(iniPath);
        const declarations = persistIni.parseLocalPersistDeclarations(content);
        if (declarations.length === 0) continue;
        const descriptor = persistIni.buildPersistBridgeDescriptor(modsRoot, iniPath);
        const statePath = persistLayout.resolvePersistBridgeStatePath(root, descriptor.stateFileName);
        const stateKey = normalizeLookupKey(descriptor.stateFileName);
        let existingStateContent = null;
        if (existingStateFiles.has(stateKey)) {
          try {
            existingStateContent = await fs.promises.readFile(statePath, "utf-8");
          } catch (_) {
            existingStateContent = null;
          }
        }
        const constantsMap = await getD3dxUserConstantsAsync();
        const stateContent = buildMergedPersistStateContent(descriptor, declarations, existingStateContent, readBridgeReferences, constantsMap);
        if (await writeFileIfChangedAsync(statePath, stateContent)) {
          generatedStateCount += 1;
        }
        existingStateFiles.add(stateKey);
        const originalNamespace = persistIni.parseIniNamespace(content);
        if (originalNamespace) {
          bridgeMappings.push({
            originalNamespace,
            bridgeNamespace: descriptor.namespace,
            varNames: declarations.map(d => d.variableName)
          });
        }
        const nextContent = persistIni.applyPersistBridgeToIniContent(content, descriptor, declarations);
        if (nextContent === content) continue;
        if (!bakSet.has(backupKey)) {
          await fs.promises.writeFile(backupPath, content, "utf-8");
          bakSet.add(backupKey);
        }
        await fs.promises.writeFile(iniPath, nextContent, "utf-8");
        iniContents.set(iniPath, nextContent);
        references = null;
        migratedIniCount += 1;
      }
      if (bridgeMappings.length > 0) {
        for (const iniPath of iniFiles) {
          await maybeYield();
          const currentContent = iniContents.get(iniPath);
          if (currentContent === void 0) continue;
          const updatedContent = persistIni.applyExternalBridgeRefsToIniContent(currentContent, bridgeMappings);
          if (updatedContent === currentContent) continue;
          const backupPath = `${iniPath}.qaqm-persistbak`;
          const backupKey = normalizeLookupKey(backupPath);
          if (!bakSet.has(backupKey)) {
            await fs.promises.writeFile(backupPath, currentContent, "utf-8");
            bakSet.add(backupKey);
          }
          await fs.promises.writeFile(iniPath, updatedContent, "utf-8");
          iniContents.set(iniPath, updatedContent);
          migratedIniCount += 1;
        }
      }
      for (const iniPath of iniFiles) {
        await maybeYield();
        const content = iniContents.get(iniPath);
        if (!content) continue;
        const hostedStateFiles = persistTracking.extractHostedPersistStateFilesFromContent(content);
        for (const stateFileName of hostedStateFiles) {
          const stateKey = normalizeLookupKey(stateFileName);
          if (existingStateFiles.has(stateKey)) continue;
          const hashMatch = stateFileName.match(/^qaqm_state_([a-f0-9]+)\.ini$/i);
          if (!hashMatch) continue;
          const hash = hashMatch[1];
          const namespace = `QAQM\\Persist\\Bridge_${hash}`;
          const varPattern = new RegExp(`\\$\\\\${persistLayout.escapeRegExp(namespace)}\\\\([A-Za-z_][A-Za-z0-9_]*)`, "gi");
          const variableNames = new Set();
          let varMatch;
          while ((varMatch = varPattern.exec(content)) !== null) {
            variableNames.add(varMatch[1]);
          }
          if (variableNames.size === 0) continue;
          const constantsMap = await getD3dxUserConstantsAsync();
          const stateLines = Array.from(variableNames).map(name => {
            const rawKey = `$\\${namespace}\\${name}`;
            const entry = constantsMap.get(persistService.normalizeD3dxUserKey(rawKey));
            const value = entry ? entry.value : "0";
            return `global persist $${name} = ${value}`;
          });
          const stateContent = [`namespace = ${namespace}`, "", "[Constants]", ...stateLines, ""].join("\n");
          const statePath = persistLayout.resolvePersistBridgeStatePath(root, stateFileName);
          if (await writeFileIfChangedAsync(statePath, stateContent)) {
            generatedStateCount += 1;
            coreLogger.logger.info(`Recreated missing persist bridge state file: ${stateFileName}`);
          }
          existingStateFiles.add(stateKey);
        }
      }
      if (migratedIniCount > 0 || generatedStateCount > 0) {
        coreLogger.logger.info(`Persist bridge migration completed for ${root}: ${migratedIniCount} ini files, ${generatedStateCount} state files`);
        if (generatedStateCount > 0) {
          try {
            await persistTracking.rebuildActivePersistBridgeIncludesAsync(root, {
              iniContentsByPath: iniContents
            });
            rebuiltIncludes = true;
          } catch (e) {
            coreLogger.logger.warn("Failed to rebuild active includes after state file recreation:", e?.message || e);
          }
        }
      }
    } catch (e) {
      coreLogger.logger.warn("Failed to migrate persist bridge files:", e?.message || e);
    } finally {
      persistLayout.preparedPersistBridgeRoots.add(root);
    }
    return {
      rebuiltIncludes
    };
  })();
  pendingActiveGameMigrations.set(pendingKey, work);
  try {
    return await work;
  } finally {
    pendingActiveGameMigrations.delete(pendingKey);
  }
}
function ensurePersistBridgeMigrationForModDir(root, modDir) {
  const gameId = persistTracking.getPersistBridgeGameIdForRoot(root);
  if (!persistTracking.isPersistBridgeEnabled(gameId)) return;
  try {
    const modsRoot = gamesSettings.getModsPath(gameId) || path.join(root, "Mods");
    const {
      iniFiles,
      bakSet
    } = collectIniAndBakFilesSync(modDir);
    if (iniFiles.length === 0) return;
    const iniContents = new Map();
    for (const iniPath of iniFiles) {
      try {
        iniContents.set(iniPath, fs.readFileSync(iniPath, "utf-8"));
      } catch (_) {}
    }
    // Read references before backups are restored below, while the INIs still point at the bridges.
    const references = persistIni.collectBridgeReferences(iniContents.values());
    const readBridgeReferences = () => references;
    let d3dxUserConstants = null;
    const getD3dxUserConstants = () => {
      if (!d3dxUserConstants) {
        const d3dxUserPath = path.join(root, "d3dx_user.ini");
        d3dxUserConstants = d3dxUserPath && fs.existsSync(d3dxUserPath) ? persistService.readD3dxUserConstants(d3dxUserPath).constantsMap : new Map();
      }
      return d3dxUserConstants;
    };
    let generatedStateCount = 0;
    const bridgeMappings = [];
    for (const iniPath of iniFiles) {
      if (!iniContents.has(iniPath)) continue;
      const backupPath = `${iniPath}.qaqm-persistbak`;
      const backupKey = normalizeLookupKey(backupPath);
      if (bakSet.has(backupKey)) {
        try {
          const currentRaw = iniContents.get(iniPath);
          const hasQaqmRefs = currentRaw.includes("\\QAQM\\Persist\\Bridge_");
          if (hasQaqmRefs) {
            const bakContent = fs.readFileSync(backupPath, "utf-8");
            fs.writeFileSync(iniPath, bakContent, "utf-8");
            iniContents.set(iniPath, bakContent);
          } else {
            fs.unlinkSync(backupPath);
            bakSet.delete(backupKey);
          }
        } catch (e) {
          coreLogger.logger.warn(`Failed to handle persist bak for ${iniPath}:`, e?.message || e);
          continue;
        }
      }
      const content = iniContents.get(iniPath);
      const declarations = persistIni.parseLocalPersistDeclarations(content);
      if (declarations.length === 0) continue;
      const descriptor = persistIni.buildPersistBridgeDescriptor(modsRoot, iniPath);
      const statePath = persistLayout.resolvePersistBridgeStatePath(root, descriptor.stateFileName);
      let existingStateContent = null;
      if (fs.existsSync(statePath)) {
        try {
          existingStateContent = fs.readFileSync(statePath, "utf-8");
        } catch (_) {}
      }
      const stateContent = buildMergedPersistStateContent(descriptor, declarations, existingStateContent, readBridgeReferences, getD3dxUserConstants());
      fs.mkdirSync(path.dirname(statePath), {
        recursive: true
      });
      if (persistLayout.writeFileIfChanged(statePath, stateContent)) {
        generatedStateCount += 1;
      }
      const originalNamespace = persistIni.parseIniNamespace(content);
      if (originalNamespace) {
        bridgeMappings.push({
          originalNamespace,
          bridgeNamespace: descriptor.namespace,
          varNames: declarations.map(d => d.variableName)
        });
      }
      const nextContent = persistIni.applyPersistBridgeToIniContent(content, descriptor, declarations);
      if (nextContent === content) continue;
      if (!bakSet.has(backupKey)) {
        fs.writeFileSync(backupPath, content, "utf-8");
        bakSet.add(backupKey);
      }
      fs.writeFileSync(iniPath, nextContent, "utf-8");
      iniContents.set(iniPath, nextContent);
    }
    if (bridgeMappings.length > 0) {
      for (const iniPath of iniFiles) {
        const currentContent = iniContents.get(iniPath);
        if (currentContent === void 0) continue;
        const updatedContent = persistIni.applyExternalBridgeRefsToIniContent(currentContent, bridgeMappings);
        if (updatedContent === currentContent) continue;
        const backupPath = `${iniPath}.qaqm-persistbak`;
        const backupKey = normalizeLookupKey(backupPath);
        if (!bakSet.has(backupKey)) {
          fs.writeFileSync(backupPath, currentContent, "utf-8");
          bakSet.add(backupKey);
        }
        fs.writeFileSync(iniPath, updatedContent, "utf-8");
        iniContents.set(iniPath, updatedContent);
      }
    }
    if (generatedStateCount > 0) {
      try {
        persistTracking.rebuildActivePersistBridgeIncludes(root);
      } catch (e) {
        coreLogger.logger.warn("Failed to rebuild active includes after mod reset:", e?.message || e);
      }
    }
  } catch (e) {
    coreLogger.logger.warn("Failed to migrate persist bridge for mod dir:", e?.message || e);
  }
}
async function ensurePersistBridgeMigrationForModDirsAsync(root, modDirs) {
  const dirs = Array.from(new Set((Array.isArray(modDirs) ? modDirs : [modDirs]).filter(Boolean)));
  if (!root || dirs.length === 0) return;
  const gameId = persistTracking.getPersistBridgeGameIdForRoot(root);
  if (!persistTracking.isPersistBridgeEnabled(gameId)) return;
  try {
    const maybeYield = createLoopYielder(12);
    const modsRoot = gamesSettings.getModsPath(gameId) || path.join(root, "Mods");
    let d3dxUserConstants = null;
    const getD3dxUserConstantsAsync = async () => {
      if (!d3dxUserConstants) {
        d3dxUserConstants = (await persistService.readD3dxUserConstantsAsync(path.join(root, "d3dx_user.ini"))).constantsMap;
      }
      return d3dxUserConstants;
    };
    let generatedStateCount = 0;
    for (const modDir of dirs) {
      await maybeYield();
      const {
        iniFiles,
        bakSet
      } = await collectIniAndBakFilesAsync(modDir, maybeYield);
      if (iniFiles.length === 0) continue;
      const iniContents = new Map();
      for (const iniPath of iniFiles) {
        try {
          iniContents.set(iniPath, await fs.promises.readFile(iniPath, "utf-8"));
        } catch (_) {}
        await maybeYield();
      }
      const references = persistIni.collectBridgeReferences(iniContents.values());
      const readBridgeReferences = () => references;
      const bridgeMappings = [];
      for (const iniPath of iniFiles) {
        await maybeYield();
        if (!iniContents.has(iniPath)) continue;
        const backupPath = `${iniPath}.qaqm-persistbak`;
        const backupKey = normalizeLookupKey(backupPath);
        if (bakSet.has(backupKey)) {
          try {
            const currentRaw = iniContents.get(iniPath);
            const hasQaqmRefs = currentRaw.includes("\\QAQM\\Persist\\Bridge_");
            if (hasQaqmRefs) {
              const bakContent = await fs.promises.readFile(backupPath, "utf-8");
              await fs.promises.writeFile(iniPath, bakContent, "utf-8");
              iniContents.set(iniPath, bakContent);
            } else {
              await fs.promises.unlink(backupPath).catch(() => {});
              bakSet.delete(backupKey);
            }
          } catch (e) {
            coreLogger.logger.warn(`Failed to handle persist bak for ${iniPath}:`, e?.message || e);
            continue;
          }
        }
        const content = iniContents.get(iniPath);
        const declarations = persistIni.parseLocalPersistDeclarations(content);
        if (declarations.length === 0) continue;
        const descriptor = persistIni.buildPersistBridgeDescriptor(modsRoot, iniPath);
        const statePath = persistLayout.resolvePersistBridgeStatePath(root, descriptor.stateFileName);
        let existingStateContent = null;
        try {
          existingStateContent = await fs.promises.readFile(statePath, "utf-8");
        } catch (_) {}
        const constantsMap = await getD3dxUserConstantsAsync();
        const stateContent = buildMergedPersistStateContent(descriptor, declarations, existingStateContent, readBridgeReferences, constantsMap);
        if (await writeFileIfChangedAsync(statePath, stateContent)) {
          generatedStateCount += 1;
        }
        const originalNamespace = persistIni.parseIniNamespace(content);
        if (originalNamespace) {
          bridgeMappings.push({
            originalNamespace,
            bridgeNamespace: descriptor.namespace,
            varNames: declarations.map(d => d.variableName)
          });
        }
        const nextContent = persistIni.applyPersistBridgeToIniContent(content, descriptor, declarations);
        if (nextContent === content) continue;
        if (!bakSet.has(backupKey)) {
          await fs.promises.writeFile(backupPath, content, "utf-8");
          bakSet.add(backupKey);
        }
        await fs.promises.writeFile(iniPath, nextContent, "utf-8");
        iniContents.set(iniPath, nextContent);
      }
      if (bridgeMappings.length > 0) {
        for (const iniPath of iniFiles) {
          await maybeYield();
          const currentContent = iniContents.get(iniPath);
          if (currentContent === void 0) continue;
          const updatedContent = persistIni.applyExternalBridgeRefsToIniContent(currentContent, bridgeMappings);
          if (updatedContent === currentContent) continue;
          const backupPath = `${iniPath}.qaqm-persistbak`;
          const backupKey = normalizeLookupKey(backupPath);
          if (!bakSet.has(backupKey)) {
            await fs.promises.writeFile(backupPath, currentContent, "utf-8");
            bakSet.add(backupKey);
          }
          await fs.promises.writeFile(iniPath, updatedContent, "utf-8");
          iniContents.set(iniPath, updatedContent);
        }
      }
    }
    if (generatedStateCount > 0) {
      try {
        await persistTracking.rebuildActivePersistBridgeIncludesAsync(root);
      } catch (e) {
        coreLogger.logger.warn("Failed to rebuild active includes after mod migration:", e?.message || e);
      }
    }
  } catch (e) {
    coreLogger.logger.warn("Failed to migrate persist bridge for mod dirs:", e?.message || e);
  }
}
