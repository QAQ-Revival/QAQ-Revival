"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { getDataRoot } = require("./data-paths.cjs");
function writeRuntimePathReport(app, config, configPath) {
  try {
    const report = {
      pid: process.pid,
      updatedAt: new Date().toISOString(),
      executable: process.execPath,
      appPath: app.getAppPath(),
      isPackaged: app.isPackaged,
      userData: app.getPath("userData"),
      configPath,
      dataRoot: getDataRoot(),
      activeGameId: config.activeGameId,
      games: (config.games || []).map(game => ({ id: game.id, modFolderPath: game.modFolderPath, modLoaderPath: game.modLoaderPath }))
    };
    const file = path.join(app.getPath("userData"), "runtime-paths.json");
    fs.writeFileSync(file + ".tmp", JSON.stringify(report, null, 2));
    fs.renameSync(file + ".tmp", file);
    return report;
  } catch { return null; }
}
module.exports = { writeRuntimePathReport };
