"use strict";

const path = require("path");
const fs = require("fs");
const coreLogger = require("../core/logger.cjs");
const gamesSettings = require("./settings.cjs");
function resolveActiveGameEnvRoot(gameId2 = gamesSettings.getActiveGameScopeId()) {
  try {
    const modsPath = gamesSettings.getModsPath(gameId2);
    if (!modsPath || !fs.existsSync(modsPath)) return null;
    const root = path.dirname(modsPath);
    const d3dxPath = path.join(root, "d3dx.ini");
    if (!fs.existsSync(d3dxPath)) return null;
    return {
      root,
      d3dxPath
    };
  } catch (e) {
    coreLogger.logger.warn("Failed to resolve active game env root for keypress bridge:", e?.message || e);
    return null;
  }
}
module.exports = {
  resolveActiveGameEnvRoot
};
