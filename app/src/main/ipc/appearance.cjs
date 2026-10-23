"use strict";

const i18n = require("../../shared/i18n/core.cjs");
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const charactersSkins = require("../characters/skins.cjs");
const desktopNotifications = require("../desktop/notifications.cjs");
const gamesSettings = require("../games/settings.cjs");
const modsAppearance = require("../mods/appearance.cjs");
const modsMetadata = require("../mods/metadata.cjs");
function registerIpc() {
  electron.ipcMain.handle("character-section:list", async (_, {
    characterName
  } = {}) => {
    try {
      const gameId2 = gamesSettings.getActiveGameScopeId();
      const {
        characterName: name
      } = modsAppearance.resolveAppearanceCharacterContext(characterName, gameId2);
      return {
        success: true,
        sections: charactersSkins.getMergedAppearanceSectionDefinitions(name, gameId2)
      };
    } catch (error) {
      return {
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("character-section:create", async (_, {
    characterName,
    name,
    nameEn = "",
    coverImagePath = null
  } = {}) => {
    let createdCoverDir = null;
    try {
      const gameId2 = gamesSettings.getActiveGameScopeId();
      const {
        characterName: targetCharacterName
      } = modsAppearance.resolveAppearanceCharacterContext(characterName, gameId2);
      const sectionName = String(name || "").trim().slice(0, 60);
      if (!sectionName) return {
        error: i18n.t("backend.ipc.appearance.sectionNameEmpty")
      };
      const existingNames = new Set(charactersSkins.getMergedAppearanceSectionDefinitions(targetCharacterName, gameId2).map(section => String(section.name || "").trim().toLowerCase()));
      if (existingNames.has(sectionName.toLowerCase())) return {
        error: i18n.t("backend.ipc.appearance.sectionAlreadyExists")
      };
      const sectionId = `custom:${crypto.randomUUID()}`;
      const now = new Date().toISOString();
      const customSections = charactersSkins.getCustomAppearanceSections(targetCharacterName, gameId2);
      const created = {
        id: sectionId,
        sectionId,
        kind: "custom",
        official: false,
        name: sectionName,
        nameZh: sectionName,
        nameEn: String(nameEn || "").trim().slice(0, 80),
        createdAt: now,
        updatedAt: now
      };
      let coverUrl = null;
      if (coverImagePath) {
        createdCoverDir = charactersSkins.getAppearanceSectionImagesDir(targetCharacterName, sectionId, gameId2);
        coverUrl = charactersSkins.saveAppearanceSectionCoverImage(targetCharacterName, sectionId, coverImagePath, gameId2).coverUrl;
      }
      charactersSkins.setCustomAppearanceSections(targetCharacterName, [...customSections, created], gameId2);
      createdCoverDir = null;
      desktopNotifications.notifyAllModWindowsChanged(targetCharacterName, {
        reason: "appearance-section-created"
      });
      return {
        success: true,
        section: {
          ...created,
          coverUrl
        }
      };
    } catch (error) {
      if (createdCoverDir) {
        try {
          fs.rmSync(createdCoverDir, {
            recursive: true,
            force: true
          });
        } catch (_2) {}
      }
      return {
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("character-section:update", async (_, {
    characterName,
    sectionId,
    name,
    nameEn
  } = {}) => {
    try {
      const gameId2 = gamesSettings.getActiveGameScopeId();
      const {
        characterName: targetCharacterName
      } = modsAppearance.resolveAppearanceCharacterContext(characterName, gameId2);
      const normalizedSectionId = charactersSkins.normalizeAppearanceSectionId(sectionId);
      if (!normalizedSectionId) return {
        error: i18n.t("backend.ipc.appearance.sectionIdMissing")
      };
      if (!charactersSkins.isCustomAppearanceSectionId(normalizedSectionId)) return {
        error: i18n.t("backend.ipc.appearance.officialSectionReadOnly")
      };
      const customSections = charactersSkins.getCustomAppearanceSections(targetCharacterName, gameId2);
      const index = customSections.findIndex(section2 => section2.sectionId === normalizedSectionId);
      if (index < 0) return {
        error: i18n.t("backend.ipc.appearance.customSectionMissing")
      };
      const nextName = name === void 0 ? customSections[index].name : String(name || "").trim().slice(0, 60);
      if (!nextName) return {
        error: i18n.t("backend.ipc.appearance.sectionNameEmpty")
      };
      const duplicate = charactersSkins.getMergedAppearanceSectionDefinitions(targetCharacterName, gameId2).some(section2 => section2.sectionId !== normalizedSectionId && String(section2.name || "").trim().toLowerCase() === nextName.toLowerCase());
      if (duplicate) return {
        error: i18n.t("backend.ipc.appearance.sectionAlreadyExists")
      };
      customSections[index] = {
        ...customSections[index],
        name: nextName,
        nameZh: nextName,
        ...(nameEn !== void 0 ? {
          nameEn: String(nameEn || "").trim().slice(0, 80)
        } : {}),
        updatedAt: new Date().toISOString()
      };
      const saved = charactersSkins.setCustomAppearanceSections(targetCharacterName, customSections, gameId2);
      const section = saved.find(item => item.sectionId === normalizedSectionId);
      desktopNotifications.notifyAllModWindowsChanged(targetCharacterName, {
        reason: "appearance-section-updated"
      });
      return {
        success: true,
        section: {
          ...section,
          coverUrl: charactersSkins.getAppearanceSectionCoverUrl(targetCharacterName, normalizedSectionId, gameId2)
        }
      };
    } catch (error) {
      return {
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("character-section:delete", async (_, {
    characterName,
    sectionId
  } = {}) => {
    try {
      const gameId2 = gamesSettings.getActiveGameScopeId();
      const {
        characterName: targetCharacterName
      } = modsAppearance.resolveAppearanceCharacterContext(characterName, gameId2);
      const normalizedSectionId = charactersSkins.normalizeAppearanceSectionId(sectionId);
      if (!normalizedSectionId) return {
        error: i18n.t("backend.ipc.appearance.sectionIdMissing")
      };
      if (!charactersSkins.isCustomAppearanceSectionId(normalizedSectionId)) return {
        error: i18n.t("backend.ipc.appearance.officialSectionCannotDelete")
      };
      const customSections = charactersSkins.getCustomAppearanceSections(targetCharacterName, gameId2);
      if (!customSections.some(section => section.sectionId === normalizedSectionId)) {
        return {
          error: i18n.t("backend.ipc.appearance.customSectionMissing")
        };
      }
      const targetRecords = modsAppearance.listModDirectoryRecordsForCharacter(targetCharacterName, gameId2).filter(record => {
        const meta = modsMetadata.readModMetadataFromDir(record.modDir);
        return modsAppearance.getStoredModAppearanceSectionId(meta) === normalizedSectionId;
      });
      const snapshots = [];
      try {
        for (const record of targetRecords) {
          const tagsFile = path.join(record.modDir, "tags.json");
          snapshots.push({
            tagsFile,
            existed: fs.existsSync(tagsFile),
            content: fs.existsSync(tagsFile) ? fs.readFileSync(tagsFile) : null
          });
          modsAppearance.writeModAppearanceSectionMetadata(record.modDir, targetCharacterName, charactersSkins.BASE_APPEARANCE_SECTION_ID, {
            gameId: gameId2,
            source: "section-deleted"
          });
        }
        charactersSkins.setCustomAppearanceSections(targetCharacterName, customSections.filter(section => section.sectionId !== normalizedSectionId), gameId2);
      } catch (error) {
        const rollbackErrors = [];
        for (const snapshot of snapshots.reverse()) {
          try {
            if (snapshot.existed) fs.writeFileSync(snapshot.tagsFile, snapshot.content);else fs.rmSync(snapshot.tagsFile, {
              force: true
            });
          } catch (rollbackError) {
            rollbackErrors.push(rollbackError?.message || String(rollbackError));
          }
        }
        try {
          charactersSkins.setCustomAppearanceSections(targetCharacterName, customSections, gameId2);
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError?.message || String(rollbackError));
        }
        return {
          error: i18n.t("backend.ipc.appearance.deleteRollbackFailed", {
            reason: error?.message || error
          }),
          reassignedCount: 0,
          rollbackErrors
        };
      }
      try {
        fs.rmSync(charactersSkins.getAppearanceSectionImagesDir(targetCharacterName, normalizedSectionId, gameId2), {
          recursive: true,
          force: true
        });
      } catch (_2) {}
      desktopNotifications.notifyAllModWindowsChanged(targetCharacterName, {
        reason: "appearance-section-deleted"
      });
      return {
        success: true,
        reassignedCount: targetRecords.length,
        fallbackSectionId: charactersSkins.BASE_APPEARANCE_SECTION_ID
      };
    } catch (error) {
      return {
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("character-section:set-cover", async (_, {
    characterName,
    sectionId,
    imagePath
  } = {}) => {
    try {
      const gameId2 = gamesSettings.getActiveGameScopeId();
      const {
        characterName: targetCharacterName
      } = modsAppearance.resolveAppearanceCharacterContext(characterName, gameId2);
      const normalizedSectionId = charactersSkins.normalizeAppearanceSectionId(sectionId);
      if (!normalizedSectionId || !imagePath) {
        return {
          error: i18n.t("backend.ipc.appearance.sectionOrCoverMissing")
        };
      }
      if (!charactersSkins.getCustomAppearanceSections(targetCharacterName, gameId2).some(section => section.sectionId === normalizedSectionId)) {
        return {
          error: i18n.t("backend.ipc.appearance.customCoverOnly")
        };
      }
      const result = charactersSkins.saveAppearanceSectionCoverImage(targetCharacterName, normalizedSectionId, imagePath, gameId2);
      desktopNotifications.notifyAllModWindowsChanged(targetCharacterName, {
        reason: "appearance-section-cover"
      });
      return {
        success: true,
        coverUrl: result.coverUrl
      };
    } catch (error) {
      return {
        error: error.message
      };
    }
  });
  electron.ipcMain.handle("character-section:assign-mod", async (_, {
    characterName,
    modName,
    sectionId
  } = {}) => {
    try {
      const gameId2 = gamesSettings.getActiveGameScopeId();
      const {
        characterName: targetCharacterName
      } = modsAppearance.resolveAppearanceCharacterContext(characterName, gameId2);
      const targetModName = charactersSkins.assertSafeAppearancePathSegment(modName, i18n.t("backend.validation.modName"));
      const normalizedSectionId = charactersSkins.normalizeAppearanceSectionId(sectionId) || charactersSkins.BASE_APPEARANCE_SECTION_ID;
      if (!charactersSkins.getAppearanceSectionDefinition(targetCharacterName, normalizedSectionId, gameId2)) {
        return {
          error: i18n.t("backend.ipc.appearance.targetSectionMissing")
        };
      }
      const resolved = modsAppearance.resolveExistingModDirectoryAnyMode(targetCharacterName, targetModName, gameId2);
      if (!resolved?.modPath) return {
        error: i18n.t("backend.developer.export.modFolderMissing")
      };
      const appearance = modsAppearance.writeModAppearanceSectionMetadata(resolved.modPath, targetCharacterName, normalizedSectionId, {
        gameId: gameId2,
        source: "user"
      });
      desktopNotifications.notifyAllModWindowsChanged(targetCharacterName, {
        modName: targetModName,
        sectionId: appearance.sectionId,
        reason: "appearance-section-assigned"
      });
      return {
        success: true,
        appearanceSectionId: appearance.sectionId
      };
    } catch (error) {
      return {
        error: error.message
      };
    }
  });
}
module.exports = {
  registerIpc
};
