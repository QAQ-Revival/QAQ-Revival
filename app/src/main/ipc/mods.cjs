"use strict";

const i18n = require("../../shared/i18n/core.cjs");
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const charactersCatalog = require("../characters/catalog.cjs");
const charactersDirectories = require("../characters/directories.cjs");
const charactersHidden = require("../characters/hidden.cjs");
const charactersImages = require("../characters/images.cjs");
const charactersOrganization = require("../characters/organization.cjs");
const charactersSkins = require("../characters/skins.cjs");
const configStore = require("../config/store.cjs");
const coreLogger = require("../core/logger.cjs");
const desktopNotifications = require("../desktop/notifications.cjs");
const developerMarkedMove = require("../developer/marked-move.cjs");
const gamesEnvironment = require("../games/environment.cjs");
const gamesNevernessLoader = require("../games/neverness/loader.cjs");
const gamesSettings = require("../games/settings.cjs");
const modsAppearance = require("../mods/appearance.cjs");
const modsConflicts = require("../mods/conflicts.cjs");
const modsHotkeys = require("../mods/hotkeys.cjs");
const modsIniFiles = require("../mods/ini-files.cjs");
const modsMetadata = require("../mods/metadata.cjs");
const modPreviews = require("../mods/preview-gallery.cjs");
const modsNevernessPaks = require("../games/neverness/paks.cjs");
const modsEffRoutes = require("../mods/eff-routes.cjs");
// The EFF Mod an action on the Mods page addresses, if that is what it names.
const effRoute = (gameId, characterName, modName) => modsEffRoutes.route(gameId, characterName, modName, charactersDirectories.resolveCharacterPath(characterName, gameId));
const overlayWindow = require("../overlay/window.cjs");
const persistService = require("../persist/service.cjs");
const persistTracking = require("../persist/tracking.cjs");
const systemFiles = require("../system/files.cjs");
const systemPaths = require("../system/paths.cjs");
function resolvePreviewMod(characterName, modName, gameId = gamesSettings.getActiveGameScopeId()) {
  charactersSkins.assertSafeAppearancePathSegment(characterName, i18n.t("backend.validation.characterName"));
  charactersSkins.assertSafeAppearancePathSegment(modName, i18n.t("backend.validation.modName"));
  const eff = effRoute(gameId, characterName, modName);
  const modPath = eff?.mod.path || modsAppearance.resolveExistingModDirectoryAnyMode(characterName, modName, gameId)?.modPath;
  if (!modPath) throw Error(i18n.t("backend.ipc.mods.modFolderNotFound"));
  return { modPath, eff, options: eff ? modsEffRoutes.previewOptions(eff.mod) : undefined };
}
async function getPreviewGallery(modPath, options) {
  const gallery = await modPreviews.listImages(modPath, options);
  const previewImages = gallery.images.flatMap(image => {
    try { return [{ id: image.id, url: charactersImages.getLocalImageUrl(image.path) }]; }
    catch { return []; }
  });
  const selected = previewImages.find(image => image.id === gallery.selectedImageId) || previewImages[0];
  return { previewImages, previewImageId: selected?.id || null, previewUrl: selected?.url || null };
}
function notifyPreviewChanged(characterName, modName, gameId, file, imageId, galleryChanged = false) {
  const result = { success: true, previewUrl: charactersImages.getLocalImageUrl(file), previewImageId: imageId };
  desktopNotifications.notifyAllModWindowsChanged(characterName, { gameId, modName, ...result, reason: "mod-preview-changed", resourcesChanged: false, galleryChanged });
  return result;
}
async function listMods(characterName) {
    try {
      const gameId2 = gamesSettings.getActiveGameScopeId();
      if (gamesNevernessLoader.isNevernessDx12Mode(gameId2)) {
        return modsNevernessPaks.getNevernessDx12Mods(characterName);
      }
      charactersOrganization.organizeLegacyCharacterFoldersIfNeeded(gameId2);
      const charPath = charactersDirectories.resolveCharacterPath(characterName, gameId2);
      if (!charPath || !fs.existsSync(charPath)) {
        return {
          error: i18n.t("backend.ipc.characters.characterNotFound")
        };
      }
      const files = fs.readdirSync(charPath, {
        withFileTypes: true
      });
      const addedAtAccessor = gamesSettings.createModAddedAtAccessor();
      const modDirectories = files.filter(dirent => dirent.isDirectory());
      const definitions = charactersSkins.getMergedAppearanceSectionDefinitions(characterName, gameId2);
      const pinnedState = modsMetadata.applyPinnedStateToMods(characterName, modDirectories.map(dirent => ({ name: dirent.name.replace(/^DISABLED_/, "") })));
      const resourceScopes = gameId2 === "arknights" ? await require("../games/arknights/appearance.cjs").inspectAppearances(modDirectories.map(dirent => path.join(charPath, dirent.name)), definitions) : null;
      let mods = modDirectories.map((dirent, index) => {
        const originalName = dirent.name;
        const isDisabled = originalName.startsWith("DISABLED_");
        const displayName = isDisabled ? originalName.replace("DISABLED_", "") : originalName;
        const modPath = path.join(charPath, originalName);
        const {
          addedAt,
          addedAtMs
        } = addedAtAccessor.get(characterName, displayName, modPath);
        let tags = [];
        let notes = "";
        let hotkeyAliases = {};
        let modMeta = {};
        try {
          const tagsFile = path.join(modPath, "tags.json");
          if (fs.existsSync(tagsFile)) {
            const meta = JSON.parse(fs.readFileSync(tagsFile, "utf-8"));
            modMeta = meta && typeof meta === "object" ? meta : {};
            if (Array.isArray(modMeta.tags)) {
              tags = modMeta.tags.map(t => typeof t === "string" ? t : t && t.name ? String(t.name) : "").filter(Boolean);
            }
            if (typeof modMeta.notes === "string") notes = modMeta.notes;
            if (modMeta.hotkeyAliases && typeof modMeta.hotkeyAliases === "object" && !Array.isArray(modMeta.hotkeyAliases)) {
              for (const [section, alias] of Object.entries(modMeta.hotkeyAliases)) {
                if (typeof alias === "string" && alias.trim()) hotkeyAliases[section] = alias;
              }
            }
          }
        } catch (_2) {}
        let previewUrl = null;
        try {
          const previewImagePath = charactersImages.findModPreviewImageFile(modPath);
          if (previewImagePath) previewUrl = charactersImages.getLocalImageUrl(previewImagePath);
        } catch (_2) {}
        return {
          name: displayName,
          originalName,
          enabled: !isDisabled,
          path: modPath,
          previewUrl,
          addedAt,
          addedAtMs,
          tags,
          notes,
          hotkeyAliases,
          pinned: pinnedState[index].pinned,
          pinnedIndex: pinnedState[index].pinnedIndex,
          ...(resourceScopes ? { arknightsScope: resourceScopes[index] } : {}),
          appearanceSectionId: modsAppearance.resolveModAppearanceSectionId({
            characterName,
            modName: displayName,
            modDir: modPath,
            meta: modMeta,
            gameId: gameId2,
            definitions,
            resourceScope: resourceScopes?.[index]
          })
        };
      });
      // EFF Mods of the character sit in the same list, from data/EFF/Mods.
      mods = mods.concat(modsEffRoutes.entries({
        gameId: gameId2,
        characterName,
        efmiCharacterPath: charPath,
        taken: mods.map(mod => mod.name),
        addedAtAccessor,
        pinnedState: list => modsMetadata.applyPinnedStateToMods(characterName, list),
        imageUrl: file => charactersImages.getLocalImageUrl(file)
      }));
      const modOrders = configStore.currentConfig.modOrders || {};
      const {
        value: customOrder
      } = charactersDirectories.getCharacterConfigStoreValue(modOrders, characterName, [], gameId2);
      if (customOrder.length > 0) {
        const orderedMods = [];
        const unorderedMods = [];
        for (const mod of mods) {
          if (customOrder.includes(mod.name)) {
            orderedMods.push(mod);
          } else {
            unorderedMods.push(mod);
          }
        }
        orderedMods.sort((a, b) => customOrder.indexOf(a.name) - customOrder.indexOf(b.name));
        unorderedMods.sort((a, b) => a.name.localeCompare(b.name, "zh"));
        mods = [...orderedMods, ...unorderedMods];
      }
      mods = modsMetadata.movePinnedModsToTop(mods);
      const selection = require("../mods/selection.cjs");
      mods = await selection.snapshot({ characterName, gameId: gameId2 }, mods);
      const toggleQueue = selection.queueState({ characterName, gameId: gameId2 });
      mods = mods.map(mod => ({ ...mod, fullName: mod.originalName, marked: require("../developer/marked.cjs").isModMarked(gameId2, characterName, mod.name) }));
      const sections = charactersSkins.buildAppearanceSectionsWithStats(characterName, mods, gameId2, definitions);
      addedAtAccessor.saveIfDirty();
      return {
        success: true,
        mods,
        sections,
        enabledSectionIds: sections.filter(section => section.enabledCount > 0).map(section => section.sectionId),
        toggleQueue,
        characterAliases: charactersCatalog.getCharacterAliasCandidates(characterName, gameId2)
      };
    } catch (error) {
      return {
        error: error.message
      };
    }
}

// With a batch from the toggle queue, refreshes and game reloads wait for
// commitModToggleBatch, which runs them once for the whole batch.
async function applyModToggle({ characterName, modName, enable, gameId, autoReload = false, confirmedConflictIds = [], batch = null }) {
    try {
      const gameId2 = gameId || gamesSettings.getActiveGameScopeId();
      characterName = charactersSkins.assertSafeAppearancePathSegment(characterName, i18n.t("backend.validation.characterName"));
      modName = charactersSkins.assertSafeAppearancePathSegment(modName, i18n.t("backend.validation.modName"));
      if (enable) charactersHidden.assertCharacterVisible(characterName, gameId2);
      if (gameId2 === "arknights") return require("../games/arknights/service.cjs").toggleMod({ characterName, modName, enable, autoReload, confirmedConflictIds, batch });
      if (gamesNevernessLoader.isNevernessDx12Mode(gameId2)) {
        const result = modsNevernessPaks.toggleNevernessDx12PakMod(characterName, modName, enable, { notify: !batch });
        if (batch && result.success) (batch.changed ||= []).push({ gameId: gameId2, characterName, modName });
        return result;
      }
      charactersOrganization.organizeLegacyCharacterFoldersIfNeeded(gameId2);
      const env = gamesEnvironment.resolveActiveGameEnvRoot(gameId2);
      const charPath = charactersDirectories.resolveCharacterPath(characterName, gameId2);
      if (!charPath) {
        return {
          error: i18n.t("backend.imports.local.characterFolderNotFound")
        };
      }
      const currentName = enable ? `DISABLED_${modName}` : modName;
      const newName = enable ? modName : `DISABLED_${modName}`;
      const currentPath = path.join(charPath, currentName);
      const newPath = path.join(charPath, newName);
      if (!fs.existsSync(currentPath) && fs.existsSync(newPath)) return { success: true, alreadyInState: true };
      if (!fs.existsSync(currentPath)) {
        return {
          error: i18n.t("backend.ipc.mods.modFolderNotFound")
        };
      }
      if (!enable && persistTracking.isPersistBridgeEnabled(gameId2)) {
        if (persistService.usesManagedPersistBridge(characterName, modName, gameId2)) {
          persistTracking.syncPersistBridgeStateForModDir(currentPath, gameId2);
        }
      }
      const renameResult = await systemFiles.renameModDirectoryWithRetry(currentPath, newPath);
      if (!renameResult.success) {
        return {
          error: renameResult.error || i18n.t("backend.ipc.mods.renameFailedAfterRetries")
        };
      }
      if (env?.root && persistTracking.isPersistBridgeEnabled(gameId2)) {
        const stateFiles = persistTracking.collectHostedPersistStateFilesForModDir(newPath);
        persistTracking.updateActivePersistBridgeIncludesIncremental(env.root, enable ? {
          enableStateFiles: stateFiles
        } : {
          disableStateFiles: stateFiles
        });
      }
      modsConflicts.clearConflictCache(characterName, gameId2);
      if (enable && persistTracking.isPersistBridgeEnabled(gameId2)) {
        persistService.restorePersistStateForMod(characterName, modName, newPath, gameId2);
      }
      if (batch) {
        const result = { success: true, persistRestored: false };
        (batch.changed ||= []).push({ gameId: gameId2, characterName, modName });
        if (enable && autoReload) (batch.overlayReload ||= []).push(result);
        return result;
      }
      desktopNotifications.notifyCharacterListChanged(characterName, {
        modName,
        reason: "manager-toggle"
      });
      let reloadError = "";
      if (enable && autoReload) {
        try { await require("../overlay/helper.cjs").triggerOverlayReload(); }
        catch (error) { reloadError = error.message; }
      }
      return {
        success: true,
        persistRestored: false,
        autoReloaded: !!(enable && autoReload && !reloadError),
        ...(reloadError ? { reloadError } : {})
      };
    } catch (error) {
      return {
        error: error.message
      };
    }
}
async function commitModToggleBatch(batch) {
  if (batch.arknights) await require("../games/arknights/service.cjs").commitToggleBatch(batch);
  if (batch.overlayReload?.length) {
    let reloadError = "";
    try { await require("../overlay/helper.cjs").triggerOverlayReload(); }
    catch (error) { reloadError = error.message; }
    for (const result of batch.overlayReload) Object.assign(result, reloadError ? { reloadError } : { autoReloaded: true });
  }
  const changed = batch.changed || [];
  if (!changed.length) return;
  const characters = new Set(changed.map(item => item.characterName));
  desktopNotifications.notifyCharacterListChanged(characters.size === 1 ? changed[0].characterName : "__all__", {
    gameId: changed[0].gameId,
    ...(changed.length === 1 ? { modName: changed[0].modName } : {}),
    reason: "manager-toggle",
    resourcesChanged: false
  });
}

function selectionContext(characterName, overlay = false) {
  const gameId = gamesSettings.getActiveGameScopeId();
  characterName = charactersSkins.assertSafeAppearancePathSegment(characterName, i18n.t("backend.validation.characterName"));
  characterName = charactersDirectories.resolveCharacterEntry(characterName, gameId)?.displayName || characterName;
  return { characterName, gameId, autoReload: overlay ? !!configStore.currentConfig.overlayAutoReloadEnabled : gameId === "arknights" };
}
async function toggleMod(characterName, modName, enable, overlay = false) {
  try {
    const context = selectionContext(characterName, overlay);
    modName = charactersSkins.assertSafeAppearancePathSegment(modName, i18n.t("backend.validation.modName"));
    if (typeof enable !== "boolean") throw Error("Invalid Mod state");
    if (enable) charactersHidden.assertCharacterVisible(context.characterName, context.gameId);
    // EFF reads its Mods at game start, so there is nothing to queue, check for hash conflicts or reload.
    const eff = effRoute(context.gameId, context.characterName, modName);
    if (eff) {
      eff.eff.setCharacterModEnabled(eff.mod, enable);
      desktopNotifications.notifyAllModWindowsChanged(context.characterName, { modName, reason: "toggle" });
      return { success: true, enabled: enable, framework: "eff" };
    }
    const result = await require("../mods/selection.cjs").request({ ...context, modName, enable });
    if (result.busy) return { ...result, error: i18n.t(result.enable ? "backend.ipc.mods.enableQueued" : "backend.ipc.mods.disableQueued") };
    return result;
  } catch (error) { return { success: false, error: error.message }; }
}
async function confirmModConflicts(characterName, overlay = false) {
  try { return await require("../mods/selection.cjs").confirm(selectionContext(characterName, overlay)); }
  catch (error) { return { success: false, error: error.message }; }
}

function registerIpc() {
  electron.ipcMain.handle("pin-mod", async (_, {
    characterName,
    modName,
    pinned
  }) => {
    try {
      charactersOrganization.organizeLegacyCharacterFoldersIfNeeded(gamesSettings.getActiveGameScopeId());
      const currentPinned = modsMetadata.getPinnedModsForCharacter(characterName);
      const alreadyPinned = currentPinned.includes(modName);
      const nextPinned = typeof pinned === "boolean" ? pinned : !alreadyPinned;
      const nextPinnedMods = nextPinned ? [modName, ...currentPinned.filter(name => name !== modName)] : currentPinned.filter(name => name !== modName);
      modsMetadata.setPinnedModsForCharacter(characterName, nextPinnedMods);
      desktopNotifications.notifyAllModWindowsChanged(characterName, {
        modName,
        reason: "pin"
      });
      return {
        success: true,
        pinned: nextPinned
      };
    } catch (error) {
      return {
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("save-hotkey", async (_, {
    characterName,
    modName,
    sectionName,
    newKey,
    relativePath
  }) => {
    try {
      const gameId2 = gamesSettings.getActiveGameScopeId();
      charactersOrganization.organizeLegacyCharacterFoldersIfNeeded(gameId2);
      const charPath = charactersDirectories.resolveCharacterPath(characterName, gameId2);
      if (!charPath) {
        return {
          error: i18n.t("backend.imports.local.characterFolderNotFound")
        };
      }
      let modPath = path.join(charPath, modName);
      if (!fs.existsSync(modPath)) {
        const disabledModPath = path.join(charPath, `DISABLED_${modName}`);
        if (fs.existsSync(disabledModPath)) {
          modPath = disabledModPath;
        } else {
          return {
            error: i18n.t("backend.ipc.mods.modFolderNotFound")
          };
        }
      }
      const iniFiles = modsIniFiles.getIniFiles(modPath).filter(file => relativePath === undefined || path.relative(modPath, path.dirname(file)).split(path.sep).join("/") === relativePath);
      if (iniFiles.length === 0) {
        return {
          error: i18n.t("backend.ipc.mods.noINIFilesFoundInModFolder")
        };
      }
      let updated = false;
      for (const iniPath of iniFiles) {
        const content = fs.readFileSync(iniPath, "utf-8");
        const lines = content.split(/\r?\n/);
        let newLines = [];
        let inTargetSection = false;
        let keyUpdated = false;
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const trimmedLine = line.trim();
          const sectionMatch = trimmedLine.match(/^\[Key(.*?)\]$/i);
          if (/^\[.*\]$/.test(trimmedLine)) {
            if (inTargetSection && !keyUpdated) {
              newLines.push(`key = ${newKey}`);
              keyUpdated = true;
              updated = true;
            }
            if (sectionMatch && sectionMatch[1] === sectionName) {
              inTargetSection = true;
            } else {
              inTargetSection = false;
            }
            newLines.push(line);
          } else if (inTargetSection && trimmedLine.match(/^key\s*=/i)) {
            newLines.push(`key = ${newKey}`);
            keyUpdated = true;
            updated = true;
          } else {
            newLines.push(line);
          }
        }
        if (inTargetSection && !keyUpdated) {
          newLines.push(`key = ${newKey}`);
          updated = true;
        }
        if (updated) {
          fs.writeFileSync(iniPath, newLines.join("\r\n"), "utf-8");
          modsHotkeys.clearHotkeysCacheForMod(characterName, modName, gameId2);
          modsHotkeys.notifyHotkeysChanged(characterName, modName, gameId2, _?.sender?.id);
          return {
            success: true
          };
        }
      }
      return {
        error: i18n.t("backend.ipc.mods.sectionKeyNotFoundInAnyINIFile", {
          sectionName
        })
      };
    } catch (error) {
      console.error("save-hotkey error:", error);
      return {
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("get-mods", (_, characterName) => listMods(characterName));
  electron.ipcMain.handle("toggle-mod", (_, { characterName, modName, enable }) => toggleMod(characterName, modName, enable));
  electron.ipcMain.handle("confirm-mod-conflicts", (_, { characterName, overlay = false }) => confirmModConflicts(characterName, overlay));
  electron.ipcMain.on("notify-overlay-mods-changed", (_, {
    characterName
  }) => {
    if (overlayWindow.overlayWindow && !overlayWindow.overlayWindow.isDestroyed()) {
      overlayWindow.overlayWindow.webContents.send("mods-changed", {
        characterName
      });
    }
  });
  electron.ipcMain.handle("get-mod-details", async (_, {
    characterName,
    modName,
    refresh = false,
    gameId
  }) => {
    try {
      const gameId2 = gameId || gamesSettings.getActiveGameScopeId();
      const previewContext = resolvePreviewMod(characterName, modName, gameId2);
      const gallery = await getPreviewGallery(previewContext.modPath, previewContext.options);
      // EFF keys are bound in its own Ins panel; the page shows them from the Mod entry.
      if (previewContext.eff) return { success: true, ...gallery, hotkeys: [], hotkeyGroups: [] };
      if (gamesNevernessLoader.isNevernessDx12Mode(gameId2)) {
        return {
          success: true,
          ...gallery,
          hotkeys: [],
          hotkeyGroups: []
        };
      }
      const modPath = previewContext.modPath;
      let imagePath = null;
      const canonicalCharacterName = charactersDirectories.getCanonicalCharacterConfigKey(characterName, gameId2);
      const charImagesPath = path.join(charactersImages.IMAGES_PATH, canonicalCharacterName);
      if (fs.existsSync(charImagesPath)) {
        const imageFiles = fs.readdirSync(charImagesPath);
        const sanitizedModName = modName.replace(/[<>:"/\\|?*]/g, "_");
        const previewFile = imageFiles.find(f => f.startsWith(`${sanitizedModName}_preview`) && /\.(png|jpg|jpeg|webp|gif)$/i.test(f));
        if (previewFile) {
          imagePath = path.join(charImagesPath, previewFile);
        }
      }
      const previewUrl = gallery.previewUrl || (imagePath && fs.existsSync(imagePath) ? charactersImages.getLocalImageUrl(imagePath) : null);
      const cacheKey = modsHotkeys.getPrimaryHotkeysCacheKey(characterName, modName, gameId2);
      const iniFiles = fs.existsSync(modPath) ? modsIniFiles.getIniFiles(modPath) : [];
      let hotkeys = [];
      let hotkeyGroups = [];
      // Always read the current INI files when a detail panel is opened or refreshed.
      if (fs.existsSync(modPath)) {
        try {
          const allHotkeys = [];
          const groupsByDirectory = new Map();
          iniFiles.forEach(iniPath => {
            const fileHotkeys = modsHotkeys.parseIniForHotkeys(iniPath);
            if (fileHotkeys.length > 0) {
              allHotkeys.push(...fileHotkeys);
              const directory = path.dirname(iniPath);
              const relativePath = path.relative(modPath, directory).split(path.sep).join("/");
              if (!groupsByDirectory.has(relativePath)) {
                groupsByDirectory.set(relativePath, {
                  name: relativePath ? path.basename(directory) : modName,
                  relativePath,
                  hotkeys: []
                });
              }
              groupsByDirectory.get(relativePath).hotkeys.push(...fileHotkeys);
            }
          });
          const menuFirst = (a, b) => {
            if (a.isMenu && !b.isMenu) return -1;
            if (!a.isMenu && b.isMenu) return 1;
            return 0;
          };
          const groups = Array.from(groupsByDirectory.values()).sort((a, b) => a.relativePath.localeCompare(b.relativePath));
          hotkeyGroups = groups.map(group => ({
            ...group,
            name: groups.some(other => other !== group && other.name === group.name) ? group.relativePath || i18n.t("backend.ipc.mods.rootDirectoryLabel", {
              name: group.name
            }) : group.name,
            hotkeys: modsHotkeys.dedupeHotkeysBySemanticBinding(group.hotkeys).sort(menuFirst)
          }));
          // Keep the flat list for older consumers; both detail views use directory groups.
          hotkeys = modsHotkeys.dedupeHotkeysBySemanticBinding(allHotkeys).sort(menuFirst);
          modsHotkeys.hotkeysCache[cacheKey] = {
            scanned: true,
            hotkeys,
            hotkeyGroups,
            timestamp: Date.now(),
            version: modsHotkeys.HOTKEYS_CACHE_VERSION
          };
          modsHotkeys.saveHotkeysCache();
        } catch (err) {
          console.error("Error scanning hotkeys:", err);
          delete modsHotkeys.hotkeysCache[cacheKey];
          modsHotkeys.saveHotkeysCache();
          return {
            success: false,
            error: err.message
          };
        }
      }
      if (refresh) modsHotkeys.notifyHotkeysChanged(characterName, modName, gameId2, _?.sender?.id);
      return {
        success: true,
        previewImages: gallery.previewImages,
        previewImageId: gallery.previewImageId,
        previewUrl,
        hotkeys,
        hotkeyGroups
      };
    } catch (error) {
      console.error("get-mod-details error:", error);
      return {
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("select-mod-preview", (_, { characterName, modName, imageId, gameId }) => {
    try {
      const scope = gameId || gamesSettings.getActiveGameScopeId();
      const { modPath, options } = resolvePreviewMod(characterName, modName, scope);
      const file = modPreviews.selectImage(modPath, imageId, options);
      return notifyPreviewChanged(characterName, modName, scope, file, imageId);
    } catch (error) { return { success: false, error: error.message }; }
  });
  electron.ipcMain.handle("set-mod-preview", async (_, {
    characterName,
    modName,
    imagePath
  }) => {
    try {
      if (!fs.existsSync(imagePath)) {
        return {
          error: i18n.t("backend.ipc.mods.sourceImageNotFound", {
            imagePath
          })
        };
      }
      const gameId2 = gamesSettings.getActiveGameScopeId();
      const eff = effRoute(gameId2, characterName, modName);
      if (eff) {
        const file = eff.eff.setCharacterModPreview(eff.mod, modsEffRoutes.pngBytes(fs.readFileSync(imagePath)));
        modPreviews.selectImage(eff.mod.path, path.basename(file), modsEffRoutes.previewOptions(eff.mod));
        return { ...notifyPreviewChanged(characterName, modName, gameId2, file, path.basename(file), true), newPath: file };
      }
      charactersOrganization.organizeLegacyCharacterFoldersIfNeeded(gameId2);
      let actualModName = modName;
      const charPath = gamesNevernessLoader.isNevernessDx12Mode(gameId2) ? modsNevernessPaks.getNevernessDx12CharacterPath(characterName, {
        ensure: true
      }) : charactersDirectories.resolveCharacterPath(characterName, gameId2);
      if (!charPath) {
        return {
          error: i18n.t("backend.imports.local.characterFolderNotFound")
        };
      }
      const modPathEnabled = path.join(charPath, modName);
      const modPathDisabled = path.join(charPath, `DISABLED_${modName}`);
      let targetModPath = null;
      if (fs.existsSync(modPathEnabled)) {
        targetModPath = modPathEnabled;
      } else if (fs.existsSync(modPathDisabled)) {
        targetModPath = modPathDisabled;
        actualModName = `DISABLED_${modName}`;
      } else {
        return {
          error: i18n.t("backend.ipc.mods.modFolderNotFound")
        };
      }
      const ext = path.extname(imagePath).toLowerCase();
      const targetFilename = `preview${ext}`;
      const targetPath = path.join(targetModPath, targetFilename);
      const sourceBuffer = fs.readFileSync(imagePath);
      const files = fs.readdirSync(targetModPath);
      for (const file of files) {
        if (file.startsWith("preview.") && /\.(png|jpg|jpeg|webp|gif|bmp|svg|ico|tiff|tif)$/i.test(file)) {
          try {
            fs.unlinkSync(path.join(targetModPath, file));
          } catch (e) {
            console.error("Failed to delete old preview:", e);
          }
        }
      }
      fs.writeFileSync(targetPath, sourceBuffer);
      modPreviews.selectImage(targetModPath, targetFilename);
      notifyPreviewChanged(characterName, modName, gameId2, targetPath, targetFilename, true);
      console.log(`Image saved to: ${targetPath}`);
      const targetExt = path.extname(targetPath).toLowerCase();
      const mimeType = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".bmp": "image/bmp",
        ".svg": "image/svg+xml",
        ".ico": "image/x-icon",
        ".tiff": "image/tiff",
        ".tif": "image/tiff"
      }[targetExt] || "image/jpeg";
      const imageBuffer = fs.readFileSync(targetPath);
      const base64 = imageBuffer.toString("base64");
      const previewUrl = `data:${mimeType};base64,${base64}`;
      return {
        success: true,
        newPath: targetPath,
        previewUrl
      };
    } catch (error) {
      console.error("set-mod-preview error:", error);
      return {
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("set-mod-preview-from-data", async (_, {
    characterName,
    modName,
    dataUrl
  }) => {
    try {
      if (!dataUrl || typeof dataUrl !== "string") {
        return {
          error: i18n.t("backend.ipc.mods.invalidImageData")
        };
      }
      const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
      if (!match) return {
        error: i18n.t("backend.ipc.mods.unsupportedImageFormat")
      };
      const mime = match[1].toLowerCase();
      const base64 = match[2];
      const extMap = {
        "image/png": ".png",
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/webp": ".webp",
        "image/gif": ".gif",
        "image/bmp": ".bmp"
      };
      const ext = extMap[mime] || ".png";
      const gameId2 = gamesSettings.getActiveGameScopeId();
      const eff = effRoute(gameId2, characterName, modName);
      if (eff) {
        const png = modsEffRoutes.pngBytes(Buffer.from(base64, "base64"));
        const file = eff.eff.setCharacterModPreview(eff.mod, png);
        modPreviews.selectImage(eff.mod.path, path.basename(file), modsEffRoutes.previewOptions(eff.mod));
        return { ...notifyPreviewChanged(characterName, modName, gameId2, file, path.basename(file), true), newPath: file };
      }
      charactersOrganization.organizeLegacyCharacterFoldersIfNeeded(gameId2);
      const charPath = gamesNevernessLoader.isNevernessDx12Mode(gameId2) ? modsNevernessPaks.getNevernessDx12CharacterPath(characterName, {
        ensure: true
      }) : charactersDirectories.resolveCharacterPath(characterName, gameId2);
      if (!charPath) return {
        error: i18n.t("backend.imports.local.characterFolderNotFound")
      };
      const modPathEnabled = path.join(charPath, modName);
      const modPathDisabled = path.join(charPath, `DISABLED_${modName}`);
      let targetModPath = null;
      if (fs.existsSync(modPathEnabled)) targetModPath = modPathEnabled;else if (fs.existsSync(modPathDisabled)) targetModPath = modPathDisabled;else return {
        error: i18n.t("backend.ipc.mods.modFolderNotFound")
      };
      const files = fs.readdirSync(targetModPath);
      for (const file of files) {
        if (file.startsWith("preview.") && /\.(png|jpg|jpeg|webp|gif|bmp|svg|ico|tiff|tif)$/i.test(file)) {
          try {
            fs.unlinkSync(path.join(targetModPath, file));
          } catch (_2) {}
        }
      }
      const targetPath = path.join(targetModPath, `preview${ext}`);
      fs.writeFileSync(targetPath, Buffer.from(base64, "base64"));
      modPreviews.selectImage(targetModPath, path.basename(targetPath));
      notifyPreviewChanged(characterName, modName, gameId2, targetPath, path.basename(targetPath), true);
      const imageBuffer = fs.readFileSync(targetPath);
      const previewUrl = `data:${mime};base64,${imageBuffer.toString("base64")}`;
      return {
        success: true,
        newPath: targetPath,
        previewUrl
      };
    } catch (error) {
      console.error("set-mod-preview-from-data error:", error);
      return {
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("rename-mod", async (_, {
    characterName,
    oldName,
    newName
  }) => {
    try {
      const gameId2 = gamesSettings.getActiveGameScopeId();
      characterName = charactersSkins.assertSafeAppearancePathSegment(characterName, i18n.t("backend.validation.characterName"));
      oldName = charactersSkins.assertSafeAppearancePathSegment(oldName, i18n.t("backend.validation.oldModName"));
      newName = charactersSkins.assertSafeAppearancePathSegment(newName, i18n.t("backend.validation.newModName"));
      const eff = effRoute(gameId2, characterName, oldName);
      if (eff) {
        const renamed = eff.eff.renameCharacterMod(eff.mod, newName);
        modsEffRoutes.movePreviewSelection(eff.mod.path, renamed.path);
        const currentPinned = modsMetadata.getPinnedModsForCharacter(characterName);
        if (currentPinned.includes(oldName)) modsMetadata.setPinnedModsForCharacter(characterName, currentPinned.map(name => name === oldName ? newName : name));
        desktopNotifications.notifyCharacterListChanged(characterName, { modName: newName, previousModName: oldName, reason: "mod-renamed" });
        return { success: true, newName, newPath: renamed.path };
      }
      charactersOrganization.organizeLegacyCharacterFoldersIfNeeded(gameId2);
      const charPath = charactersDirectories.resolveCharacterPath(characterName, gameId2);
      if (!charPath) return {
        error: i18n.t("backend.imports.local.characterFolderNotFound")
      };
      let oldPath = path.join(charPath, oldName);
      let isDisabled = false;
      if (!fs.existsSync(oldPath)) {
        const disabledPath = path.join(charPath, `DISABLED_${oldName}`);
        if (fs.existsSync(disabledPath)) {
          oldPath = disabledPath;
          isDisabled = true;
        } else {
          return {
            error: i18n.t("backend.ipc.mods.modFolderNotFound")
          };
        }
      }
      const newFolderName = isDisabled ? `DISABLED_${newName}` : newName;
      const newPath = path.join(charPath, newFolderName);
      if (fs.existsSync(newPath)) {
        return {
          error: i18n.t("backend.ipc.mods.targetNameExists", {
            newName
          })
        };
      }
      fs.renameSync(oldPath, newPath);
      const currentPinned = modsMetadata.getPinnedModsForCharacter(characterName);
      if (currentPinned.includes(oldName)) {
        modsMetadata.setPinnedModsForCharacter(characterName, currentPinned.map(name => name === oldName ? newName : name));
      }
      modsConflicts.clearConflictCache(characterName, gameId2);
      desktopNotifications.notifyCharacterListChanged(characterName, {
        modName: newName,
        previousModName: oldName,
        reason: "mod-renamed"
      });
      coreLogger.logger.info(`Renamed mod: ${oldPath} -> ${newPath}`);
      return {
        success: true,
        newName,
        newPath
      };
    } catch (error) {
      return {
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("move-mod-to-character", async (_, {
    sourceCharacterName,
    modName,
    targetCharacterName,
    targetAppearanceSectionId = null,
    targetCharacterSkinId = null
  }) => {
    try {
      const gameId2 = gamesSettings.getActiveGameScopeId();
      const sourceContext = modsAppearance.resolveAppearanceCharacterContext(sourceCharacterName, gameId2);
      const targetContext = modsAppearance.resolveAppearanceCharacterContext(targetCharacterName, gameId2);
      const sourceName = sourceContext.characterName;
      const targetName = targetContext.characterName;
      charactersHidden.assertCharacterVisible(targetName, gameId2);
      const cleanModName = charactersSkins.assertSafeAppearancePathSegment(modName, i18n.t("backend.validation.modName"));
      if (sourceName === targetName) return {
        error: i18n.t("backend.ipc.mods.sameTargetCategory")
      };
      charactersOrganization.organizeLegacyCharacterFoldersIfNeeded(gameId2);
      const source = modsAppearance.resolveExistingModDirectoryAnyMode(sourceName, cleanModName, gameId2);
      if (!source || !source.modPath || !fs.existsSync(source.modPath)) return {
        error: i18n.t("backend.ipc.mods.sourceModMissing")
      };
      if (modsAppearance.resolveExistingModDirectoryAnyMode(targetName, cleanModName, gameId2)) {
        return {
          error: i18n.t("backend.ipc.mods.targetModExists", {
            cleanModName
          })
        };
      }
      let targetCharPath = targetContext.characterPath;
      if (gamesNevernessLoader.isNevernessDx12Mode(gameId2)) {
        targetCharPath = source.enabled ? modsNevernessPaks.getNevernessDx12CharacterPath(targetName, {
          ensure: true,
          gameId: gameId2
        }) : modsNevernessPaks.getNevernessDx12DisabledCharacterPath(targetName, gamesNevernessLoader.getNevernessDx12Paths(gameId2), {
          ensure: true,
          gameId: gameId2
        });
      }
      if (!targetCharPath) return {
        error: i18n.t("backend.ipc.mods.targetCategoryMissing")
      };
      fs.mkdirSync(targetCharPath, {
        recursive: true
      });
      const targetPath = path.join(targetCharPath, source.folderName);
      if (!systemPaths.isPathInsideDirectory(targetPath, targetCharPath)) {
        return {
          error: i18n.t("backend.ipc.mods.invalidModTargetPath")
        };
      }
      await developerMarkedMove.moveDirectoryWithIntegrityCheck(source.modPath, targetPath);
      const requestedAppearance = targetAppearanceSectionId || targetCharacterSkinId ? {
        appearanceSectionId: targetAppearanceSectionId,
        characterSkinId: targetCharacterSkinId
      } : null;
      let appearanceSectionId = charactersSkins.BASE_APPEARANCE_SECTION_ID;
      try {
        appearanceSectionId = modsAppearance.assignInstalledModAppearance({
          characterName: targetName,
          modName: cleanModName,
          modDir: targetPath,
          requested: requestedAppearance,
          gameId: gameId2,
          source: requestedAppearance ? "explicit-move" : "move-reclassify",
          ignoreStored: true
        }).sectionId;
      } catch (error) {
        coreLogger.logger.warn(`Failed to reclassify moved mod ${targetName}/${cleanModName}: ${error?.message || error}`);
        try {
          await developerMarkedMove.moveDirectoryWithIntegrityCheck(targetPath, source.modPath);
        } catch (rollbackError) {
          return {
            error: i18n.t("backend.ipc.mods.appearanceMoveRollbackFailed", {
              reason: error?.message || error
            }),
            rollbackError: rollbackError?.message || String(rollbackError),
            partial: true
          };
        }
        return {
          error: i18n.t("backend.ipc.mods.appearanceMoveRolledBack", {
            reason: error?.message || error
          })
        };
      }
      const currentPinned = modsMetadata.getPinnedModsForCharacter(sourceName);
      if (currentPinned.includes(cleanModName)) {
        modsMetadata.setPinnedModsForCharacter(sourceName, currentPinned.filter(name => name !== cleanModName));
      }
      modsConflicts.clearConflictCache(sourceName, gameId2);
      modsConflicts.clearConflictCache(targetName, gameId2);
      desktopNotifications.notifyCharacterListChanged(targetName, {
        reason: "mod-moved",
        sourceCharacterName: sourceName,
        modName: cleanModName
      });
      return {
        success: true,
        sourceCharacterName: sourceName,
        targetCharacterName: targetName,
        modName: cleanModName,
        appearanceSectionId,
        newPath: targetPath
      };
    } catch (error) {
      return {
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("delete-mod", async (_, {
    characterName,
    modName
  }) => {
    try {
      const gameId2 = gamesSettings.getActiveGameScopeId();
      characterName = charactersSkins.assertSafeAppearancePathSegment(characterName, i18n.t("backend.validation.characterName"));
      modName = charactersSkins.assertSafeAppearancePathSegment(modName, i18n.t("backend.validation.modName"));
      if (gamesNevernessLoader.isNevernessDx12Mode(gameId2)) {
        return await modsNevernessPaks.deleteNevernessDx12PakMod(characterName, modName);
      }
      const eff = effRoute(gameId2, characterName, modName);
      if (eff) {
        await eff.eff.removeCharacterMod(eff.mod);
        const currentPinned = modsMetadata.getPinnedModsForCharacter(characterName);
        if (currentPinned.includes(modName)) modsMetadata.setPinnedModsForCharacter(characterName, currentPinned.filter(name => name !== modName));
        desktopNotifications.notifyCharacterListChanged(characterName, { modName, reason: "mod-deleted" });
        return { success: true, recycled: true };
      }
      charactersOrganization.organizeLegacyCharacterFoldersIfNeeded(gameId2);
      const env = gamesEnvironment.resolveActiveGameEnvRoot(gameId2);
      const charPath = charactersDirectories.resolveCharacterPath(characterName, gameId2);
      if (!charPath) {
        return {
          error: i18n.t("backend.imports.local.characterFolderNotFound")
        };
      }
      let modPath = path.join(charPath, modName);
      if (!fs.existsSync(modPath)) {
        const disabledPath = path.join(charPath, `DISABLED_${modName}`);
        if (fs.existsSync(disabledPath)) {
          modPath = disabledPath;
        } else {
          return {
            error: i18n.t("backend.ipc.mods.modFolderNotFound")
          };
        }
      }
      let hostedStateFiles = [];
      if (persistTracking.isPersistBridgeEnabled(gameId2)) {
        hostedStateFiles = persistTracking.collectHostedPersistStateFilesForModDir(modPath);
      }
      await systemFiles.movePathToRecycleBin(modPath, "delete mod");
      if (env?.root && persistTracking.isPersistBridgeEnabled(gameId2) && hostedStateFiles.length > 0) {
        persistTracking.updateActivePersistBridgeIncludesIncremental(env.root, {
          removeStateFiles: hostedStateFiles
        });
      }
      const currentPinned = modsMetadata.getPinnedModsForCharacter(characterName);
      if (currentPinned.includes(modName)) {
        modsMetadata.setPinnedModsForCharacter(characterName, currentPinned.filter(name => name !== modName));
      }
      modsConflicts.clearConflictCache(characterName, gameId2);
      desktopNotifications.notifyCharacterListChanged(characterName, {
        modName,
        reason: "mod-deleted"
      });
      coreLogger.logger.info(`Deleted mod to Recycle Bin: ${modPath}`);
      return {
        success: true,
        recycled: true
      };
    } catch (error) {
      console.error("delete-mod error:", error);
      return {
        error: error.message
      };
    }
  });
}
module.exports = {
  registerIpc, listMods, toggleMod, applyModToggle, commitModToggleBatch, confirmModConflicts
};
