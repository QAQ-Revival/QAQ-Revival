"use strict";

const windows = require("./desktop/windows.cjs");
const config = require("./config/store.cjs");
const { registerI18n } = require("../shared/i18n/main.cjs");

function startApplication(runtimeIdentity) {
  windows.configureRuntime(runtimeIdentity);

  // Load persisted state before exposing services to IPC or creating windows.
  require("./core/logger.cjs").initialize();
  config.initialize();
  registerI18n({
    ipcMain: require("electron").ipcMain,
    BrowserWindow: require("electron").BrowserWindow,
    readLanguage: () => config.currentConfig.language,
    writeLanguage(language) {
      const next = { ...config.currentConfig, language };
      if (!config.saveConfig(next)) return false;
      config.currentConfig = next;
      return true;
    }
  });
  require("./games/settings.cjs").initialize();
  require("./runtime/path-report.cjs").writeRuntimePathReport(require("electron").app, config.currentConfig, config.configPath);
  require("./characters/hidden.cjs").initialize();
  require("./characters/images.cjs").initialize();
  require("./characters/catalog.cjs").initialize();
  require("./characters/skins.cjs").initialize();
  require("./games/arknights/service.cjs").initialize();
  require("./mods/hotkeys.cjs").initialize();
  require("./persist/service.cjs").initialize();
  require("./games/genshin/service.cjs").initialize();
  require("./games/wuwa/service.cjs").initialize();
  require("./fixes/service.cjs").initialize();
  require("./overlay/window.cjs").initialize();

  require("./market/sources.cjs").registerIpc();
  require("./developer/access.cjs").registerIpc();
  windows.registerIpc();
  require("./config/appearance.cjs").registerIpc();
  require("./ipc/settings.cjs").registerIpc();
  require("./ipc/games.cjs").registerIpc();
  require("./games/arknights/service.cjs").registerIpc();
  require("./games/genshin/service.cjs").registerIpc();
  require("./games/wuwa/service.cjs").registerIpc();
  require("./games/wuwa/gacha-service.cjs").registerIpc();
  require("./games/steam/service.cjs").registerIpc();
  require("./games/neverness/loader.cjs").registerIpc();
  require("./games/launch.cjs").registerIpc();
  require("./ipc/shell.cjs").registerIpc();
  require("./ipc/characters.cjs").registerIpc();
  require("./ipc/organization.cjs").registerIpc();
  require("./ipc/mods.cjs").registerIpc();
  require("./ipc/appearance.cjs").registerIpc();
  require("./mods/conflicts.cjs").registerIpc();
  require("./imports/local.cjs").registerIpc();
  require("./imports/batch.cjs").registerIpc();
  require("./install/managed.cjs").registerIpc();
  require("./install/setup.cjs").registerIpc();
  require("./install/xxmi.cjs").registerIpc();
  require("./fixes/service.cjs").registerIpc();
  require("./market/downloads.cjs").registerIpc();
  require("./market/install.cjs").registerIpc();
  require("./market/catalog.cjs").registerIpc();
  require("./presets/service.cjs").registerIpc();
  require("./persist/service.cjs").registerIpc();
  require("./overlay/window.cjs").registerIpc();
  require("./developer/marked.cjs").registerIpc();
  require("./developer/marked-move.cjs").registerIpc();
  require("./developer/metadata.cjs").registerIpc();
  require("./developer/publish.cjs").registerIpc();
  require("./developer/export.cjs").registerIpc();
  require("./developer/ai.cjs").registerIpc();
  require("./developer/tags.cjs").registerIpc();
  require("./developer/cloud.cjs").registerIpc();

  require("./desktop/lifecycle.cjs").start();
}

module.exports = { startApplication };
