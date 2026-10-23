"use strict";

const i18n = require("../../shared/i18n/core.cjs");
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const {
  applyDisablePlan
} = require("../characters/hidden-store.cjs");
const charactersCatalog = require("../characters/catalog.cjs");
const charactersDirectories = require("../characters/directories.cjs");
const charactersHidden = require("../characters/hidden.cjs");
const charactersImages = require("../characters/images.cjs");
const charactersOrganization = require("../characters/organization.cjs");
const charactersSkins = require("../characters/skins.cjs");
const configStore = require("../config/store.cjs");
const coreLogger = require("../core/logger.cjs");
const desktopNotifications = require("../desktop/notifications.cjs");
const gamesEnvironment = require("../games/environment.cjs");
const gamesNevernessLoader = require("../games/neverness/loader.cjs");
const gamesSettings = require("../games/settings.cjs");
const modsConflicts = require("../mods/conflicts.cjs");
const modsHotkeys = require("../mods/hotkeys.cjs");
const modsNevernessPaks = require("../games/neverness/paks.cjs");
const overlayWindow = require("../overlay/window.cjs");
const persistService = require("../persist/service.cjs");
const persistTracking = require("../persist/tracking.cjs");
const systemFiles = require("../system/files.cjs");
const systemPaths = require("../system/paths.cjs");
function readCharacterDirectoryStatus(gameId2) {
  if (!gamesNevernessLoader.isNevernessDx12Mode(gameId2)) return gamesSettings.getModsPathStatus();
  const modsPath = gamesNevernessLoader.getNevernessDx12Paths(gameId2).pakModsDir;
  if (!modsPath) return {
    ok: false,
    code: "MODS_PATH_NOT_SET",
    error: i18n.t("backend.ipc.characters.nevernessDirectoryMissing")
  };
  // An absent Pak directory is an empty list, not a reason to create folders.
  return {
    ok: true,
    modsPath
  };
}
async function readCurrentCharacters() {
  try {
    const gameId2 = gamesSettings.getActiveGameScopeId();
    const status = readCharacterDirectoryStatus(gameId2);
    if (!status.ok) return {
      success: false,
      error: status.error,
      code: status.code
    };
    return {
      success: true,
      ...charactersDirectories.buildCharacterRefreshResponse(status.modsPath, gameId2)
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}
function buildCharacterDisablePlan(characterName, gameId) {
  const canonical = charactersCatalog.getCharacterMappingEntry(characterName, gameId)?.displayName || characterName;
  const aliases = new Set(charactersCatalog.getCharacterAliasCandidates(canonical, gameId).map(charactersCatalog.normalizeCharacterFolderKey));
  const plan = [];
  const seen = new Set();
  const scanRoot = (root, pakPaths = null) => {
    if (!root || !fs.existsSync(root)) return;
    if (fs.lstatSync(root).isSymbolicLink()) throw new Error(i18n.t("backend.hiddenCharacters.linkedDirectory", {
      root
    }));
    for (const entry of fs.readdirSync(root, {
      withFileTypes: true
    })) {
      if (!aliases.has(charactersCatalog.normalizeCharacterFolderKey(entry.name))) continue;
      if (entry.isSymbolicLink()) throw new Error(i18n.t("backend.hiddenCharacters.linkedDirectory", {
        root: entry.name
      }));
      if (!entry.isDirectory()) continue;
      const charPath = path.join(root, entry.name);
      for (const mod of fs.readdirSync(charPath, {
        withFileTypes: true
      })) {
        if (!pakPaths && /^DISABLED_/i.test(mod.name)) continue;
        if (mod.isSymbolicLink()) throw new Error(i18n.t("backend.ipc.characters.linkedMod", {
          name: mod.name
        }));
        if (!mod.isDirectory()) continue;
        const from = path.join(charPath, mod.name);
        if (pakPaths && !modsNevernessPaks.getNevernessDx12ModDirectoryInfo(from, pakPaths)) continue;
        const key = path.resolve(from).toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        const to = pakPaths ? path.join(modsNevernessPaks.getNevernessDx12DisabledCharacterPath(canonical, pakPaths, {
          gameId
        }), mod.name.replace(/^DISABLED_/i, "")) : path.join(charPath, `DISABLED_${mod.name}`);
        plan.push({
          from,
          to,
          pak: !!pakPaths
        });
      }
    }
  };
  const modsPath = gamesSettings.getModsPath(gameId);
  const pakPaths = gameId === gamesNevernessLoader.NEVERNESS_GAME_ID ? gamesNevernessLoader.getNevernessDx12Paths(gameId) : null;
  const pakRoots = new Set(Object.values(pakPaths?.pakModsDirs || {}).filter(Boolean).map(root => path.resolve(root).toLowerCase()));
  if (modsPath && !pakRoots.has(path.resolve(modsPath).toLowerCase())) {
    scanRoot(modsPath);
    for (const container of charactersOrganization.LEGACY_CHARACTER_CONTAINER_NAMES) scanRoot(path.join(modsPath, container));
  }
  if (pakPaths) for (const root of Object.values(pakPaths.pakModsDirs)) scanRoot(root, pakPaths);
  return plan;
}
function registerIpc() {
  electron.ipcMain.handle("character:refresh", async () => {
    modsHotkeys.invalidateHotkeysForGame();
    return readCurrentCharacters();
  });
  electron.ipcMain.handle("character:context-menu", require("../characters/context-menu.cjs").showCharacterContextMenu);
  electron.ipcMain.handle("character:list-hidden", async (_, requestedGameId) => {
    try {
      const gameId = gamesSettings.getSettingsGame(requestedGameId)?.id;
      if (!gameId) throw new Error(i18n.t("backend.ipc.characters.gameMissing"));
      return {
        success: true,
        gameId,
        characters: charactersHidden.hiddenCharacters.list(gameId).map(name => ({
          name,
          coverUrl: charactersImages.getCharacterCoverUrl(name, gameId)
        }))
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("character:set-hidden", async (_, {
    characterName,
    hidden,
    gameId: requestedGameId
  } = {}) => {
    try {
      const gameId = gamesSettings.getSettingsGame(requestedGameId)?.id;
      if (!gameId) throw new Error(i18n.t("backend.ipc.characters.gameMissing"));
      if (typeof hidden !== "boolean") throw new Error(i18n.t("backend.ipc.characters.invalidHiddenState"));
      characterName = charactersSkins.assertSafeAppearancePathSegment(characterName, i18n.t("backend.validation.characterName"));
      characterName = charactersCatalog.getCharacterMappingEntry(characterName, gameId)?.displayName || characterName;
      const plan = hidden ? buildCharacterDisablePlan(characterName, gameId) : [];
      const stateFiles = [];
      if (persistTracking.isPersistBridgeEnabled(gameId)) for (const item of plan.filter(item => !item.pak)) {
        if (persistService.dirUsesManagedPersistBridge(item.from)) persistTracking.syncPersistBridgeStateForModDir(item.from, gameId);
        stateFiles.push(...persistTracking.collectHostedPersistStateFilesForModDir(item.from));
      }
      const disabledCount = applyDisablePlan(plan, () => charactersHidden.hiddenCharacters.set(gameId, characterName, hidden), systemFiles.moveDirectoryWithFallback);
      if (stateFiles.length) {
        const env = gamesEnvironment.resolveActiveGameEnvRoot(gameId);
        if (env?.root) persistTracking.updateActivePersistBridgeIncludesIncremental(env.root, {
          disableStateFiles: stateFiles
        });
      }
      modsConflicts.clearConflictCache(characterName, gameId);
      desktopNotifications.notifyCharacterListChanged(characterName, {
        gameId,
        reason: hidden ? "character-hidden" : "character-restored"
      });
      if (hidden && gameId === gamesSettings.getActiveGameScopeId()) overlayWindow.hideSideWindow();
      return {
        success: true,
        gameId,
        hidden,
        disabledCount
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("get-characters", readCurrentCharacters);
  electron.ipcMain.handle("character:update-catalog", async (_, requestedGameId) => {
    const gameId = requestedGameId || gamesSettings.getActiveGameScopeId();
    modsHotkeys.invalidateHotkeysForGame(gameId);
    const result = await charactersCatalog.characterCatalogService.refresh(gameId, true);
    const skins = await charactersSkins.characterSkinCatalogService.refresh(gameId, charactersSkins.readBundledCharacterSkinCatalog(gameId), charactersCatalog.getCharacterConfigForGame(gameId));
    const messages = [];
    if (result.success) messages.push(i18n.t("backend.ipc.characters.catalogUpdated"));else messages.push(result.error);
    if (skins.success) messages.push(i18n.t("backend.ipc.characters.appearancesUpdated", {
      added: skins.added,
      count: skins.count
    }));else messages.push(skins.error);
    if (!result.success && !skins.success) return {
      success: false,
      gameId,
      error: messages.join("；"),
      skins
    };
    try {
      const modsPath = gamesNevernessLoader.isNevernessDx12Mode(gameId) ? gamesNevernessLoader.getNevernessDx12Paths(gameId).pakModsDir : gamesSettings.getModsPath(gameId);
      const added = result.success && modsPath && fs.existsSync(modsPath) ? charactersDirectories.ensureDefaultCharacterFolders(modsPath, gameId).createdCount : 0;
      desktopNotifications.notifyCharacterListChanged("__all__", {
        gameId,
        reason: "character-catalog-updated"
      });
      return {
        ...result,
        success: true,
        gameId,
        added,
        skins,
        message: messages.join("；")
      };
    } catch (error) {
      return {
        success: false,
        gameId,
        error: i18n.t("backend.ipc.characters.defaultFoldersFailed", {
          reason: error.message
        })
      };
    }
  });
  electron.ipcMain.handle("character:organize-preview", async () => {
    try {
      const gameId2 = gamesSettings.getActiveGameScopeId();
      const status = readCharacterDirectoryStatus(gameId2);
      if (!status.ok) return {
        success: false,
        error: status.error,
        code: status.code
      };
      if (gamesNevernessLoader.isNevernessDx12Mode(gameId2)) {
        return {
          success: true,
          legacyImport: {
            hasCandidates: false
          },
          looseRootFolders: null,
          misplacedModFolders: null
        };
      }
      return {
        success: true,
        ...charactersDirectories.buildCharacterOrganizePreview(status.modsPath, gameId2)
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("dev:list-local-mods", async (_, {
    characters
  } = {}) => {
    try {
      const modsPathStatus = gamesSettings.getModsPathStatus();
      if (!modsPathStatus.ok) return {
        success: false,
        error: modsPathStatus.error
      };
      const {
        modsPath
      } = modsPathStatus;
      const charFilter = characters && characters.length > 0 ? new Set(characters) : null;
      const result = [];
      const charDirs = fs.readdirSync(modsPath, {
        withFileTypes: true
      }).filter(d => d.isDirectory() && (!charFilter || charFilter.has(d.name)));
      for (const charDir of charDirs) {
        const charPath = path.join(modsPath, charDir.name);
        const modDirs = fs.readdirSync(charPath, {
          withFileTypes: true
        }).filter(d => d.isDirectory());
        for (const modDir of modDirs) {
          const cleanName = modDir.name.replace(/^DISABLED_/, "");
          const idFile = path.join(charPath, modDir.name, ".qaqmod_id");
          let modId = null;
          try {
            modId = parseInt(fs.readFileSync(idFile, "utf-8").trim()) || null;
          } catch (_2) {}
          result.push({
            char: charDir.name,
            modName: cleanName,
            folderName: modDir.name,
            modId
          });
        }
      }
      return {
        success: true,
        mods: result
      };
    } catch (e) {
      return {
        success: false,
        error: e.message
      };
    }
  });
  electron.ipcMain.handle("get-default-characters", async (_, {
    gameId: gameId2
  } = {}) => {
    try {
      const targetGameId = gameId2 || gamesSettings.getActiveGameScopeId();
      const characters = charactersCatalog.getDefaultCharactersForGame(targetGameId);
      const characterDetails = characters.map(name => ({
        name,
        coverUrl: charactersImages.getCharacterCoverUrl(name, targetGameId),
        aliases: charactersCatalog.getCharacterAliasCandidates(name, targetGameId).filter(alias => alias && alias !== name)
      }));
      return {
        success: true,
        characters,
        characterDetails
      };
    } catch (error) {
      return {
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("save-character-order", async (_, characterOrder) => {
    try {
      gamesSettings.setScopedCharacterOrder(characterOrder);
      return {
        success: true
      };
    } catch (error) {
      return {
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("save-mod-order", async (_, {
    characterName,
    modOrder
  }) => {
    try {
      if (!configStore.currentConfig.modOrders) {
        configStore.currentConfig.modOrders = {};
      }
      const canonicalCharacterName = charactersDirectories.getCanonicalCharacterConfigKey(characterName);
      configStore.currentConfig.modOrders[canonicalCharacterName] = modOrder;
      configStore.saveConfig(configStore.currentConfig);
      return {
        success: true
      };
    } catch (error) {
      return {
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("add-character", async (_, {
    name,
    coverImagePath
  }) => {
    try {
      const gameId2 = gamesSettings.getActiveGameScopeId();
      name = charactersSkins.assertSafeAppearancePathSegment(name, i18n.t("backend.validation.characterName"));
      let charPath;
      if (gamesNevernessLoader.isNevernessDx12Mode(gameId2)) {
        gamesNevernessLoader.ensureNevernessDx12GamePaths(gameId2);
        charPath = modsNevernessPaks.getNevernessDx12CharacterPath(name, {
          gameId: gameId2
        });
      } else {
        const modsPathStatus = gamesSettings.getModsPathStatus({
          gameId: gameId2
        });
        if (!modsPathStatus.ok) return {
          error: modsPathStatus.error,
          code: modsPathStatus.code
        };
        charPath = path.join(modsPathStatus.modsPath, name);
        if (!systemPaths.isPathInsideDirectory(charPath, modsPathStatus.modsPath)) {
          return {
            error: i18n.t("backend.characters.directories.invalidCharacterPath")
          };
        }
      }
      if (charactersDirectories.resolveCharacterEntry(name, gameId2) || fs.existsSync(charPath)) {
        return {
          error: i18n.t("backend.ipc.characters.characterAlreadyExists")
        };
      }
      fs.mkdirSync(charPath, {
        recursive: true
      });
      const infoPath = path.join(charPath, "info.json");
      const info = {
        name,
        createdAt: new Date().toISOString(),
        description: ""
      };
      fs.writeFileSync(infoPath, JSON.stringify(info, null, 2));
      if (coverImagePath) {
        if (coverImagePath.startsWith("data:")) {
          const matches = coverImagePath.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
          if (matches && matches.length === 3) {
            const type = matches[1];
            const buffer = Buffer.from(matches[2], "base64");
            let ext = ".png";
            if (type === "image/jpeg") ext = ".jpg";else if (type === "image/gif") ext = ".gif";
            const targetCover = path.join(charPath, `_cover${ext}`);
            fs.writeFileSync(targetCover, buffer);
          }
        } else {
          const ext = path.extname(coverImagePath);
          const targetCover = path.join(charPath, `_cover${ext}`);
          fs.copyFileSync(coverImagePath, targetCover);
        }
      }
      modsConflicts.clearConflictCache(name, gameId2);
      desktopNotifications.notifyCharacterListChanged(name, {
        reason: "character-created"
      });
      return {
        success: true
      };
    } catch (error) {
      console.error("add-character error:", error);
      return {
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("delete-character", async (_, characterName) => {
    try {
      const gameId2 = gamesSettings.getActiveGameScopeId();
      characterName = charactersSkins.assertSafeAppearancePathSegment(characterName, i18n.t("backend.validation.characterName"));
      let characterPaths = [];
      if (gamesNevernessLoader.isNevernessDx12Mode(gameId2)) {
        const paths = gamesNevernessLoader.getNevernessDx12Paths(gameId2);
        characterPaths = [modsNevernessPaks.getNevernessDx12CharacterPath(characterName, {
          gameId: gameId2
        }), modsNevernessPaks.getNevernessDx12DisabledCharacterPath(characterName, paths, {
          gameId: gameId2
        })];
      } else {
        const modsPathStatus = gamesSettings.getModsPathStatus({
          gameId: gameId2
        });
        if (!modsPathStatus.ok) {
          return {
            error: modsPathStatus.error,
            code: modsPathStatus.code
          };
        }
        characterPaths = [charactersDirectories.resolveCharacterPath(characterName, gameId2) || path.join(modsPathStatus.modsPath, characterName)];
      }
      characterPaths = Array.from(new Set(characterPaths.filter(Boolean))).filter(targetPath => fs.existsSync(targetPath));
      if (characterPaths.length === 0) {
        return {
          error: i18n.t("backend.ipc.characters.characterNotFound")
        };
      }
      for (const targetPath of characterPaths) {
        await systemFiles.movePathToRecycleBin(targetPath, "delete character");
      }
      const scopedCharacterOrder = gamesSettings.getScopedCharacterOrder();
      if (scopedCharacterOrder.includes(characterName)) {
        gamesSettings.setScopedCharacterOrder(scopedCharacterOrder.filter(name => name !== characterName));
      }
      if (configStore.currentConfig.pinnedMods) {
        const {
          key,
          value
        } = charactersDirectories.getCharacterConfigStoreValue(configStore.currentConfig.pinnedMods, characterName, [], gameId2);
        if (Array.isArray(value) && value.length > 0) {
          delete configStore.currentConfig.pinnedMods[key];
          configStore.saveConfig(configStore.currentConfig);
        }
      }
      if (charactersSkins.getCustomAppearanceSections(characterName, gameId2).length > 0) {
        charactersSkins.setCustomAppearanceSections(characterName, [], gameId2);
      }
      charactersSkins.deletePersistedCharacterSkinCatalogIdentity(characterName, gameId2);
      const scopedCharacterImagesDir = charactersImages.getScopedCharacterImagesDir(characterName, gameId2);
      if (fs.existsSync(scopedCharacterImagesDir)) {
        try {
          await systemFiles.movePathToRecycleBin(scopedCharacterImagesDir, "delete character appearance covers");
        } catch (error) {
          coreLogger.logger.warn(`Failed to recycle character appearance covers for ${characterName}: ${error?.message || error}`);
        }
      }
      configStore.saveConfig(configStore.currentConfig);
      modsConflicts.clearConflictCache(characterName, gameId2);
      desktopNotifications.notifyCharacterListChanged(characterName, {
        reason: "character-deleted"
      });
      coreLogger.logger.info(`Deleted character to Recycle Bin: ${characterName}`);
      return {
        success: true,
        recycled: true,
        recycledCount: characterPaths.length
      };
    } catch (error) {
      console.error("delete-character error:", error);
      return {
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("rename-character", async (_, {
    oldName,
    newName
  }) => {
    try {
      if (!newName || !newName.trim()) return {
        error: i18n.t("backend.ipc.characters.nameEmpty")
      };
      const gameId2 = gamesSettings.getActiveGameScopeId();
      oldName = charactersSkins.assertSafeAppearancePathSegment(oldName, i18n.t("backend.validation.oldCharacterName"));
      const trimmed = charactersSkins.assertSafeAppearancePathSegment(newName, i18n.t("backend.validation.newCharacterName"));
      if (trimmed === oldName) return {
        success: true
      };
      const previousCatalogEntry = charactersSkins.getCharacterSkinCatalogEntry(oldName, gameId2);
      const previousCatalogIdentity = charactersSkins.getPersistedCharacterSkinCatalogIdentity(oldName, gameId2) || previousCatalogEntry?.nameZh || previousCatalogEntry?.nameEn || previousCatalogEntry?.characterId || "";
      const resolvedEntry = charactersDirectories.resolveCharacterEntry(oldName, gameId2);
      const mappingEntry = charactersCatalog.getCharacterMappingEntry(oldName, gameId2);
      if (gameId2 === "wuthering-waves" && resolvedEntry?.diskName && mappingEntry) {
        return {
          error: i18n.t("backend.ipc.characters.wuwaMappedCharacterRenameUnsupported")
        };
      }
      let renamePairs = [];
      if (gamesNevernessLoader.isNevernessDx12Mode(gameId2)) {
        const paths = gamesNevernessLoader.getNevernessDx12Paths(gameId2);
        renamePairs = [{
          oldPath: modsNevernessPaks.getNevernessDx12CharacterPath(oldName, {
            gameId: gameId2
          }),
          newPath: modsNevernessPaks.getNevernessDx12CharacterPath(trimmed, {
            gameId: gameId2
          })
        }, {
          oldPath: modsNevernessPaks.getNevernessDx12DisabledCharacterPath(oldName, paths, {
            gameId: gameId2
          }),
          newPath: modsNevernessPaks.getNevernessDx12DisabledCharacterPath(trimmed, paths, {
            gameId: gameId2
          })
        }].filter(pair => pair.oldPath && fs.existsSync(pair.oldPath));
      } else {
        const modsPathStatus = gamesSettings.getModsPathStatus({
          gameId: gameId2
        });
        if (!modsPathStatus.ok) {
          return {
            error: modsPathStatus.error,
            code: modsPathStatus.code
          };
        }
        const {
          modsPath
        } = modsPathStatus;
        renamePairs = [{
          oldPath: charactersDirectories.resolveCharacterPath(oldName, gameId2) || path.join(modsPath, oldName),
          newPath: path.join(modsPath, trimmed)
        }].filter(pair => pair.oldPath && fs.existsSync(pair.oldPath));
      }
      if (renamePairs.length === 0) return {
        error: i18n.t("backend.ipc.characters.characterMissing")
      };
      const conflictingPair = renamePairs.find(pair => fs.existsSync(pair.newPath));
      if (conflictingPair) return {
        error: i18n.t("backend.ipc.characters.namedCharacterAlreadyExists", {
          trimmed
        })
      };
      const characterSectionStore = charactersSkins.getCharacterSectionGameStore(gameId2);
      const oldCharacterSectionEntry = charactersDirectories.getCharacterStoreEntry(characterSectionStore, oldName, gameId2);
      const renamedPairs = [];
      try {
        for (const pair of renamePairs) {
          fs.mkdirSync(path.dirname(pair.newPath), {
            recursive: true
          });
          fs.renameSync(pair.oldPath, pair.newPath);
          renamedPairs.push(pair);
        }
      } catch (error) {
        for (const pair of renamedPairs.reverse()) {
          try {
            if (fs.existsSync(pair.newPath) && !fs.existsSync(pair.oldPath)) {
              fs.renameSync(pair.newPath, pair.oldPath);
            }
          } catch (rollbackError) {
            coreLogger.logger.warn(`Failed to rollback character rename ${pair.newPath}: ${rollbackError?.message || rollbackError}`);
          }
        }
        throw error;
      }
      const scopedCharacterOrder = gamesSettings.getScopedCharacterOrder();
      if (scopedCharacterOrder.length > 0) {
        if (!configStore.currentConfig.characterOrdersByGame || typeof configStore.currentConfig.characterOrdersByGame !== "object") {
          configStore.currentConfig.characterOrdersByGame = {};
        }
        configStore.currentConfig.characterOrdersByGame[gameId2] = scopedCharacterOrder.map(c => c === oldName ? trimmed : c);
        if (gameId2 === "endfield") {
          configStore.currentConfig.characterOrder = configStore.currentConfig.characterOrdersByGame[gameId2];
        }
      }
      if (configStore.currentConfig.modOrders) {
        const oldModOrder = charactersDirectories.getCharacterConfigStoreValue(configStore.currentConfig.modOrders, oldName, [], gameId2).value;
        if (Array.isArray(oldModOrder) && oldModOrder.length > 0) {
          configStore.currentConfig.modOrders[trimmed] = oldModOrder;
          const oldModOrderEntry = charactersDirectories.getCharacterStoreEntry(configStore.currentConfig.modOrders, oldName, gameId2);
          delete configStore.currentConfig.modOrders[oldModOrderEntry.key];
        }
      }
      if (configStore.currentConfig.pinnedMods) {
        const oldPinnedMods = charactersDirectories.getCharacterConfigStoreValue(configStore.currentConfig.pinnedMods, oldName, [], gameId2).value;
        if (Array.isArray(oldPinnedMods) && oldPinnedMods.length > 0) {
          configStore.currentConfig.pinnedMods[trimmed] = oldPinnedMods;
          const oldPinnedEntry = charactersDirectories.getCharacterStoreEntry(configStore.currentConfig.pinnedMods, oldName, gameId2);
          delete configStore.currentConfig.pinnedMods[oldPinnedEntry.key];
        }
      }
      if (configStore.currentConfig.characterUsage) {
        const oldUsageEntry = charactersDirectories.getCharacterStoreEntry(configStore.currentConfig.characterUsage, oldName, gameId2);
        if (oldUsageEntry.value !== void 0) {
          configStore.currentConfig.characterUsage[trimmed] = oldUsageEntry.value;
          delete configStore.currentConfig.characterUsage[oldUsageEntry.key];
        }
      }
      if (Array.isArray(oldCharacterSectionEntry.value)) {
        const writableSectionStore = charactersSkins.getCharacterSectionGameStore(gameId2, {
          ensure: true
        });
        writableSectionStore[trimmed] = oldCharacterSectionEntry.value;
        if (oldCharacterSectionEntry.key && oldCharacterSectionEntry.key !== trimmed) {
          delete writableSectionStore[oldCharacterSectionEntry.key];
        }
      }
      const scopedOldImgDir = charactersImages.getScopedCharacterImagesDir(oldName, gameId2);
      const scopedNewImgDir = charactersImages.getScopedCharacterImagesDir(trimmed, gameId2);
      if (fs.existsSync(scopedOldImgDir) && !fs.existsSync(scopedNewImgDir)) {
        fs.mkdirSync(path.dirname(scopedNewImgDir), {
          recursive: true
        });
        fs.renameSync(scopedOldImgDir, scopedNewImgDir);
      }
      const legacyOldImgDir = path.join(charactersImages.IMAGES_PATH, oldName);
      const legacyNewImgDir = path.join(charactersImages.IMAGES_PATH, trimmed);
      if (fs.existsSync(legacyOldImgDir) && !fs.existsSync(legacyNewImgDir)) {
        fs.renameSync(legacyOldImgDir, legacyNewImgDir);
      }
      charactersSkins.deletePersistedCharacterSkinCatalogIdentity(oldName, gameId2);
      if (previousCatalogIdentity) {
        charactersSkins.setPersistedCharacterSkinCatalogIdentity(trimmed, previousCatalogIdentity, gameId2);
      }
      configStore.saveConfig(configStore.currentConfig);
      modsConflicts.clearConflictCache(oldName, gameId2);
      modsConflicts.clearConflictCache(trimmed, gameId2);
      desktopNotifications.notifyCharacterListChanged(trimmed, {
        reason: "character-renamed",
        previousCharacterName: oldName
      });
      console.log(`Renamed character: ${oldName} -> ${trimmed}`);
      return {
        success: true
      };
    } catch (error) {
      console.error("rename-character error:", error);
      return {
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("set-character-cover", async (_, {
    characterName,
    imagePath
  }) => {
    try {
      const charImagesPath = charactersImages.getScopedCharacterImagesDir(characterName, gamesSettings.getActiveGameScopeId());
      if (!fs.existsSync(charImagesPath)) {
        fs.mkdirSync(charImagesPath, {
          recursive: true
        });
      }
      let targetPath;
      let mimeType;
      let buffer;
      if (imagePath.startsWith("data:")) {
        const matches = imagePath.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
          return {
            error: i18n.t("backend.ipc.characters.invalidDataURL")
          };
        }
        mimeType = matches[1];
        buffer = Buffer.from(matches[2], "base64");
        let ext = ".png";
        if (mimeType === "image/jpeg") ext = ".jpg";else if (mimeType === "image/gif") ext = ".gif";else if (mimeType === "image/webp") ext = ".webp";
        targetPath = path.join(charImagesPath, `_cover${ext}`);
        fs.writeFileSync(targetPath, buffer);
      } else {
        if (!fs.existsSync(imagePath)) {
          return {
            error: i18n.t("backend.ipc.characters.imageFileNotFound")
          };
        }
        const ext = path.extname(imagePath).toLowerCase();
        targetPath = path.join(charImagesPath, `_cover${ext}`);
        buffer = fs.readFileSync(imagePath);
        fs.writeFileSync(targetPath, buffer);
        mimeType = {
          ".jpg": "image/jpeg",
          ".jpeg": "image/jpeg",
          ".png": "image/png",
          ".gif": "image/gif",
          ".webp": "image/webp"
        }[ext] || "image/jpeg";
      }
      console.log(`Character cover saved: ${targetPath}`);
      const base64 = buffer.toString("base64");
      const coverUrl = `data:${mimeType};base64,${base64}`;
      if (overlayWindow.overlayWindow && !overlayWindow.overlayWindow.isDestroyed()) {
        overlayWindow.overlayWindow.webContents.send("covers-changed");
      }
      return {
        success: true,
        coverUrl
      };
    } catch (error) {
      console.error("set-character-cover error:", error);
      return {
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("get-character-cover", async (_, characterName) => {
    try {
      const coverPath = charactersImages.findCharacterCoverFilePath(characterName, gamesSettings.getActiveGameScopeId(), gamesSettings.getModsPath());
      if (coverPath && fs.existsSync(coverPath)) {
        const ext = path.extname(coverPath).toLowerCase();
        const mimeType = {
          ".jpg": "image/jpeg",
          ".jpeg": "image/jpeg",
          ".png": "image/png",
          ".gif": "image/gif",
          ".webp": "image/webp"
        }[ext] || "image/jpeg";
        const imageBuffer = fs.readFileSync(coverPath);
        const base64 = imageBuffer.toString("base64");
        const coverUrl = `data:${mimeType};base64,${base64}`;
        return {
          success: true,
          coverUrl
        };
      }
      return {
        success: true,
        coverUrl: null
      };
    } catch (error) {
      console.error("get-character-cover error:", error);
      return {
        error: error.message
      };
    }
  });
}
module.exports = {
  registerIpc
};
