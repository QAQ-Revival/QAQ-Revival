"use strict";
const { LANGUAGES, t, getLanguage, setLanguage } = require("./core.cjs");

// config.json owns `language`; pass the existing config reader/writer to preserve
// all other settings. Register this before creating windows or native menus.
function registerI18n({ ipcMain, BrowserWindow, readLanguage, writeLanguage }) {
  setLanguage(readLanguage());
  const state = () => ({
    success: true,
    language: getLanguage(),
    languages: LANGUAGES,
  });
  ipcMain.handle("i18n:get-language", state);
  ipcMain.handle("i18n:set-language", async (_event, language) => {
    if (!LANGUAGES.some((item) => item.code === language)) {
      return { success: false, error: t("settings.language.unsupported") };
    }
    try {
      if ((await writeLanguage(language)) === false)
        throw Error(t("settings.language.saveFailed"));
      await setLanguage(language);
      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send("i18n:language-changed", language);
      }
      return state();
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}

module.exports = { registerI18n };
