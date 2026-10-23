"use strict";

module.exports = {
  ensurePersistBridgeMigrationForActiveGame,
  ensurePersistBridgeMigrationForModDir
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
function ensurePersistBridgeMigrationForActiveGame(root) {
  if (!root || persistLayout.preparedPersistBridgeRoots.has(root)) return;
  if (!persistTracking.isPersistBridgeEnabled(persistTracking.getPersistBridgeGameIdForRoot(root))) {
    try {
      const activeIncludePath = persistLayout.getQaqmBridgeFilePath(root, persistLayout.PERSIST_ACTIVE_INCLUDE_FILE);
      if (fs.existsSync(activeIncludePath)) persistLayout.writeFileIfChanged(activeIncludePath, "");
      const modsRoot = gamesSettings.getModsPath(persistTracking.getPersistBridgeGameIdForRoot(root)) || path.join(root, "Mods");
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
    return;
  }
  try {
    persistLayout.migrateQaqmBridgeFilesToBridgeDir(root);
    persistLayout.migratePersistBridgeStateFilesToCacheDir(root);
    const modsRoot = gamesSettings.getModsPath(persistTracking.getPersistBridgeGameIdForRoot(root)) || path.join(root, "Mods");
    if (!fs.existsSync(modsRoot)) {
      persistLayout.preparedPersistBridgeRoots.add(root);
      return;
    }
    let migratedIniCount = 0;
    let generatedStateCount = 0;
    const iniFiles = modsIniFiles.getIniFiles(modsRoot);
    const bridgeMappings = [];
    const d3dxUserPath = path.join(root, "d3dx_user.ini");
    const {
      constantsMap: d3dxUserConstants
    } = d3dxUserPath && fs.existsSync(d3dxUserPath) ? persistService.readD3dxUserConstants(d3dxUserPath) : {
      constantsMap: new Map()
    };
    for (const iniPath of iniFiles) {
      const backupPath = `${iniPath}.qaqm-persistbak`;
      if (fs.existsSync(backupPath)) {
        try {
          const currentRaw = fs.readFileSync(iniPath, "utf-8");
          const hasQaqmRefs = currentRaw.includes("\\QAQM\\Persist\\Bridge_");
          if (hasQaqmRefs) {
            const bakContent = fs.readFileSync(backupPath, "utf-8");
            const bakDeclarations = persistIni.parseLocalPersistDeclarations(bakContent);
            if (bakDeclarations.length > 0) {
              const descriptor2 = persistIni.buildPersistBridgeDescriptor(modsRoot, iniPath);
              const statePath2 = persistLayout.resolvePersistBridgeStatePath(root, descriptor2.stateFileName);
              if (!fs.existsSync(statePath2)) {
                const existingStateValues2 = new Map();
                for (const declaration of bakDeclarations) {
                  const rawKey = `$\\${descriptor2.namespace}\\${declaration.variableName}`;
                  const entry = d3dxUserConstants.get(persistService.normalizeD3dxUserKey(rawKey));
                  if (entry) existingStateValues2.set(declaration.normalizedName, entry.value);
                }
                const stateContent2 = persistIni.buildPersistBridgeStateContent(descriptor2, bakDeclarations, existingStateValues2);
                if (persistLayout.writeFileIfChanged(statePath2, stateContent2)) {
                  generatedStateCount += 1;
                }
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
          }
        } catch (e) {
          coreLogger.logger.warn(`Failed to handle persist bak for ${iniPath}:`, e?.message || e);
          continue;
        }
      }
      let content = "";
      try {
        content = fs.readFileSync(iniPath, "utf-8");
      } catch (_) {
        continue;
      }
      const declarations = persistIni.parseLocalPersistDeclarations(content);
      if (declarations.length === 0) continue;
      const descriptor = persistIni.buildPersistBridgeDescriptor(modsRoot, iniPath);
      const statePath = persistLayout.resolvePersistBridgeStatePath(root, descriptor.stateFileName);
      const existingStateValues = new Map();
      if (fs.existsSync(statePath)) {
        try {
          const existingStateContent = fs.readFileSync(statePath, "utf-8");
          for (const line of existingStateContent.replace(/\r\n/g, "\n").split("\n")) {
            const m = line.match(/^\s*global\s+persist\s+\$([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
            if (m) existingStateValues.set(m[1].toLowerCase(), m[2]);
          }
        } catch (_) {}
      }
      for (const declaration of declarations) {
        const rawKey = `$\\${descriptor.namespace}\\${declaration.variableName}`;
        const entry = d3dxUserConstants.get(persistService.normalizeD3dxUserKey(rawKey));
        if (entry) existingStateValues.set(declaration.normalizedName, entry.value);
      }
      const stateContent = persistIni.buildPersistBridgeStateContent(descriptor, declarations, existingStateValues);
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
      if (!fs.existsSync(backupPath)) {
        fs.writeFileSync(backupPath, content, "utf-8");
      }
      fs.writeFileSync(iniPath, nextContent, "utf-8");
      migratedIniCount += 1;
    }
    if (bridgeMappings.length > 0) {
      for (const iniPath of iniFiles) {
        let currentContent = "";
        try {
          currentContent = fs.readFileSync(iniPath, "utf-8");
        } catch (_) {
          continue;
        }
        const updatedContent = persistIni.applyExternalBridgeRefsToIniContent(currentContent, bridgeMappings);
        if (updatedContent === currentContent) continue;
        const backupPath = `${iniPath}.qaqm-persistbak`;
        if (!fs.existsSync(backupPath)) {
          fs.writeFileSync(backupPath, currentContent, "utf-8");
        }
        fs.writeFileSync(iniPath, updatedContent, "utf-8");
        migratedIniCount += 1;
      }
    }
    for (const iniPath of iniFiles) {
      let content = "";
      try {
        content = fs.readFileSync(iniPath, "utf-8");
      } catch (_) {
        continue;
      }
      const hostedStateFiles = persistTracking.extractHostedPersistStateFilesFromContent(content);
      for (const stateFileName of hostedStateFiles) {
        const statePath = persistLayout.resolvePersistBridgeStatePath(root, stateFileName);
        if (fs.existsSync(statePath)) continue;
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
        const stateLines = Array.from(variableNames).map(name => {
          const rawKey = `$\\${namespace}\\${name}`;
          const entry = d3dxUserConstants.get(persistService.normalizeD3dxUserKey(rawKey));
          const value = entry ? entry.value : "0";
          return `global persist $${name} = ${value}`;
        });
        const stateContent = [`namespace = ${namespace}`, "", "[Constants]", ...stateLines, ""].join("\n");
        if (persistLayout.writeFileIfChanged(statePath, stateContent)) {
          generatedStateCount += 1;
          coreLogger.logger.info(`Recreated missing persist bridge state file: ${stateFileName}`);
        }
      }
    }
    if (migratedIniCount > 0 || generatedStateCount > 0) {
      coreLogger.logger.info(`Persist bridge migration completed for ${root}: ${migratedIniCount} ini files, ${generatedStateCount} state files`);
      if (generatedStateCount > 0) {
        try {
          persistTracking.rebuildActivePersistBridgeIncludes(root);
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
}
function ensurePersistBridgeMigrationForModDir(root, modDir) {
  if (!persistTracking.isPersistBridgeEnabled(persistTracking.getPersistBridgeGameIdForRoot(root))) return;
  try {
    const modsRoot = gamesSettings.getModsPath(persistTracking.getPersistBridgeGameIdForRoot(root)) || path.join(root, "Mods");
    const iniFiles = modsIniFiles.getIniFiles(modDir);
    let generatedStateCount = 0;
    const bridgeMappings = [];
    const d3dxUserPath = path.join(root, "d3dx_user.ini");
    const {
      constantsMap: d3dxUserConstants
    } = d3dxUserPath && fs.existsSync(d3dxUserPath) ? persistService.readD3dxUserConstants(d3dxUserPath) : {
      constantsMap: new Map()
    };
    for (const iniPath of iniFiles) {
      const backupPath = `${iniPath}.qaqm-persistbak`;
      if (fs.existsSync(backupPath)) {
        try {
          const currentRaw = fs.readFileSync(iniPath, "utf-8");
          const hasQaqmRefs = currentRaw.includes("\\QAQM\\Persist\\Bridge_");
          if (hasQaqmRefs) {
            const bakContent = fs.readFileSync(backupPath, "utf-8");
            fs.writeFileSync(iniPath, bakContent, "utf-8");
          } else {
            fs.unlinkSync(backupPath);
          }
        } catch (e) {
          coreLogger.logger.warn(`Failed to handle persist bak for ${iniPath}:`, e?.message || e);
          continue;
        }
      }
      let content = "";
      try {
        content = fs.readFileSync(iniPath, "utf-8");
      } catch (_) {
        continue;
      }
      const declarations = persistIni.parseLocalPersistDeclarations(content);
      if (declarations.length === 0) continue;
      const descriptor = persistIni.buildPersistBridgeDescriptor(modsRoot, iniPath);
      const statePath = persistLayout.resolvePersistBridgeStatePath(root, descriptor.stateFileName);
      const existingStateValues = new Map();
      if (fs.existsSync(statePath)) {
        try {
          const existingStateContent = fs.readFileSync(statePath, "utf-8");
          for (const line of existingStateContent.replace(/\r\n/g, "\n").split("\n")) {
            const m = line.match(/^\s*global\s+persist\s+\$([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
            if (m) existingStateValues.set(m[1].toLowerCase(), m[2]);
          }
        } catch (_) {}
      }
      for (const declaration of declarations) {
        const rawKey = `$\\${descriptor.namespace}\\${declaration.variableName}`;
        const entry = d3dxUserConstants.get(persistService.normalizeD3dxUserKey(rawKey));
        if (entry) existingStateValues.set(declaration.normalizedName, entry.value);
      }
      const stateContent = persistIni.buildPersistBridgeStateContent(descriptor, declarations, existingStateValues);
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
      if (!fs.existsSync(backupPath)) {
        fs.writeFileSync(backupPath, content, "utf-8");
      }
      fs.writeFileSync(iniPath, nextContent, "utf-8");
    }
    if (bridgeMappings.length > 0) {
      for (const iniPath of iniFiles) {
        let currentContent = "";
        try {
          currentContent = fs.readFileSync(iniPath, "utf-8");
        } catch (_) {
          continue;
        }
        const updatedContent = persistIni.applyExternalBridgeRefsToIniContent(currentContent, bridgeMappings);
        if (updatedContent === currentContent) continue;
        const backupPath = `${iniPath}.qaqm-persistbak`;
        if (!fs.existsSync(backupPath)) {
          fs.writeFileSync(backupPath, currentContent, "utf-8");
        }
        fs.writeFileSync(iniPath, updatedContent, "utf-8");
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
