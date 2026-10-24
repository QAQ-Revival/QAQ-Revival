"use strict";

const electron = require("electron");
const path = require("path");
const fs = require("fs");

// Resolve the shared profile before taking its lock, including direct launches.
const localProfile = process.env.QAQR_USER_DATA || process.env.QAQM_USER_DATA || path.join(electron.app.getPath("appData"), "QAQ-Revival");
fs.mkdirSync(localProfile, {
  recursive: true
});
electron.app.setPath("userData", localProfile);
electron.app.setPath("sessionData", localProfile);
electron.app.setName("QAQ-Revival");
if (!electron.app.requestSingleInstanceLock()) {
  // A second process must stop before loading services or creating any windows.
  electron.app.quit();
  return;
}
const i18n = require("../shared/i18n/core.cjs");
const {
  startRandomManager,
  readRandomLaunchSettings
} = require("./runtime/random-executable.cjs");
let runtimeIdentity;
try {
  runtimeIdentity = startRandomManager(electron.app, {
    enabled: readRandomLaunchSettings(localProfile).manager
  });
  if (runtimeIdentity.relaunched) return;
  if (runtimeIdentity.name) electron.app.setName(runtimeIdentity.name);
} catch (error) {
  electron.dialog.showErrorBox(i18n.t("backend.index.startupFailed"), i18n.t("backend.index.installationWritableAdvice", {
    reason: error.message
  }));
  electron.app.exit(1);
  return;
}
const {
  startApplication
} = require("./application.cjs");
const {
  activateMainWindow
} = require("./desktop/windows.cjs");
electron.app.on("second-instance", () => {
  electron.app.whenReady().then(activateMainWindow);
});
startApplication(runtimeIdentity);
