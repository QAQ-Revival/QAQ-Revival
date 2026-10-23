"use strict";

const i18n = require("../../shared/i18n/core.cjs");
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const child_process = require("child_process");
const crypto = require("crypto");
const charactersDirectories = require("../characters/directories.cjs");
const charactersImages = require("../characters/images.cjs");
const configStore = require("../config/store.cjs");
const developerAccess = require("./access.cjs");
const gamesSettings = require("../games/settings.cjs");
function buildLocalPublishKey(modFolder, gameId2, characterName, modName) {
  const identity = [String(gameId2 || "").trim().toLowerCase(), String(characterName || "").trim(), String(modName || "").trim(), String(path.resolve(modFolder || "")).replace(/\\/g, "/").toLowerCase()].join("|");
  const digest = crypto.createHash("sha256").update(identity, "utf8").digest("hex").slice(0, 24);
  return `local-client:${gameId2 || "endfield"}:${digest}`;
}
const devPublishProcesses = new Map();
function registerIpc() {
  electron.ipcMain.handle("dev:get-publish-config", async () => {
    return {
      success: true,
      config: developerAccess.normalizeDevPublishConfig(configStore.currentConfig.devPublishConfig || {})
    };
  });
  electron.ipcMain.handle("dev:save-publish-config", async (_, cfg) => {
    try {
      configStore.currentConfig.devPublishConfig = developerAccess.normalizeDevPublishConfig(cfg);
      configStore.saveConfig(configStore.currentConfig);
      return {
        success: true
      };
    } catch (e) {
      return {
        success: false,
        error: e.message
      };
    }
  });
  electron.ipcMain.handle("dev:get-mod-preview", async (_, {
    modFolderPath
  }) => {
    try {
      if (!modFolderPath || !fs.existsSync(modFolderPath)) {
        return {
          success: false,
          error: i18n.t("backend.developer.export.modFolderMissing")
        };
      }
      const previewNames = ["preview.png", "preview.jpg", "preview.jpeg", "preview.webp", "preview.gif", "Cover.png", "Cover.jpg", "Cover.jpeg", "Cover.webp", "Cover.gif", "cover.png", "cover.jpg", "cover.jpeg", "cover.webp", "cover.gif"];
      let previewPath = null;
      for (const name of previewNames) {
        const p = path.join(modFolderPath, name);
        if (fs.existsSync(p)) {
          previewPath = p;
          break;
        }
      }
      if (!previewPath) {
        try {
          const files = fs.readdirSync(modFolderPath);
          const imgFile = files.find(f => /\.(png|jpg|jpeg|webp|gif)$/i.test(f));
          if (imgFile) previewPath = path.join(modFolderPath, imgFile);
        } catch (_2) {}
      }
      let previewDataUrl = null;
      if (previewPath) {
        const ext = path.extname(previewPath).toLowerCase();
        const mime = charactersImages.getImageMimeTypeFromExt(ext);
        previewDataUrl = `data:${mime};base64,${fs.readFileSync(previewPath).toString("base64")}`;
      }
      return {
        success: true,
        previewDataUrl
      };
    } catch (e) {
      return {
        success: false,
        error: e.message
      };
    }
  });
  electron.ipcMain.handle("dev:get-market-publish-key", async (_, {
    modId,
    gameId: gameId2,
    characterName,
    modName
  }) => {
    try {
      const numericModId = Number(modId);
      if (!Number.isInteger(numericModId) || numericModId <= 0) {
        return {
          success: false,
          error: i18n.t("backend.developer.publish.invalidMarketModId")
        };
      }
      const modsPathStatus = gamesSettings.getModsPathStatus();
      if (!modsPathStatus.ok) return {
        success: false,
        error: modsPathStatus.error
      };
      const {
        modsPath
      } = modsPathStatus;
      for (const charDir of fs.readdirSync(modsPath, {
        withFileTypes: true
      }).filter(d => d.isDirectory())) {
        const charPath = path.join(modsPath, charDir.name);
        for (const modDir of fs.readdirSync(charPath, {
          withFileTypes: true
        }).filter(d => d.isDirectory())) {
          const modFolder = path.join(charPath, modDir.name);
          const idFile = path.join(modFolder, ".qaqmod_id");
          try {
            const localId = parseInt(fs.readFileSync(idFile, "utf-8").trim());
            if (localId !== numericModId) continue;
            const publishKeys = [buildLocalPublishKey(modFolder, gameId2 || gamesSettings.getActiveGameScopeId(), characterName || charDir.name, modName || modDir.name), buildLocalPublishKey(modFolder, gameId2 || gamesSettings.getActiveGameScopeId(), charDir.name, modDir.name)].filter((value, index, list) => value && list.indexOf(value) === index);
            return {
              success: true,
              publishKey: publishKeys[0] || null,
              publishKeys,
              modFolder
            };
          } catch {}
        }
      }
      return {
        success: true,
        publishKey: null
      };
    } catch (e) {
      return {
        success: false,
        error: e.message
      };
    }
  });
  electron.ipcMain.handle("dev:cancel-publish", async (_, params = {}) => {
    const taskId = String(params.taskId || "");
    if (!taskId) return {
      success: false,
      error: i18n.t("backend.developer.publish.publishTaskIdMissing")
    };
    const proc = devPublishProcesses.get(taskId);
    if (!proc) return {
      success: false,
      error: i18n.t("backend.developer.publish.publishTaskMissing")
    };
    try {
      if (process.platform === "win32") {
        child_process.spawn("taskkill", ["/pid", String(proc.pid), "/T", "/F"], {
          windowsHide: true
        });
      } else {
        proc.kill("SIGTERM");
      }
      return {
        success: true
      };
    } catch (e) {
      return {
        success: false,
        error: e.message
      };
    }
  });
  electron.ipcMain.handle("dev:publish-mod", async (event, params) => {
    try {
      const {
        modFolder,
        charName,
        modName,
        version,
        gameVersion,
        gameId: gameId2,
        modMode,
        description,
        author,
        sourceUrl,
        isNsfw,
        useAdultImageHost,
        tagIds,
        pythonPath,
        winrarPath,
        mode,
        modId,
        providers,
        baiduLink,
        quarkLink,
        taskId
      } = params;
      const publishTaskId = taskId || `publish-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const sendPublishProgress = data => event.sender.send("dev:publish-progress", {
        taskId: publishTaskId,
        data
      });
      const sendPublishDone = data => event.sender.send("dev:publish-done", {
        taskId: publishTaskId,
        ...data
      });
      const gate = developerAccess.requireDevKitUnlocked();
      if (!gate.success) return gate;
      const devKitScriptPath = gate.status.publishScriptPath;
      if (!devKitScriptPath || !fs.existsSync(devKitScriptPath)) {
        return {
          success: false,
          error: i18n.t("backend.developer.publish.publishScriptMissing", {
            devKitScriptPath
          })
        };
      }
      const explicitModFolder = String(modFolder || "").trim();
      const fallbackModFolder = !explicitModFolder && charName && modName ? charactersDirectories.resolveCharacterModPath(charName, modName, gameId2 || gamesSettings.getActiveGameScopeId()) : null;
      const resolvedModFolder = explicitModFolder || fallbackModFolder;
      if (!resolvedModFolder || !fs.existsSync(resolvedModFolder)) {
        return {
          success: false,
          error: i18n.t("backend.developer.publish.modFolderMissing", {
            resolvedModFolder: resolvedModFolder || modFolder || ""
          })
        };
      }
      if (!fs.statSync(resolvedModFolder).isDirectory()) {
        return {
          success: false,
          error: i18n.t("backend.developer.publish.modSourceNotDirectory", {
            resolvedModFolder
          })
        };
      }
      console.log(`[DevPublish] mod source explicit="${explicitModFolder}" fallback="${fallbackModFolder || ""}" selected="${resolvedModFolder}"`);
      const args = [devKitScriptPath, "--mod-folder", resolvedModFolder, "--char", charName, "--mod-name", modName, "--version", gameVersion || version || "v1.0"];
      if (mode) args.push("--mode", mode);
      if (modId) args.push("--mod-id", String(modId));
      if (providers) args.push("--providers", String(providers));
      if (baiduLink) args.push("--baidu-link", String(baiduLink));
      if (quarkLink) args.push("--quark-link", String(quarkLink));
      if (gameVersion) args.push("--game-version", gameVersion);
      if (gameId2) args.push("--game-id", gameId2);
      if (modMode) args.push("--mod-mode", modMode);
      if (description) args.push("--description", description);
      if (author) args.push("--author", author);
      if (sourceUrl) args.push("--source-url", sourceUrl);
      if (isNsfw) args.push("--nsfw");
      args.push(useAdultImageHost === false ? "--no-adult-image-host" : "--adult-image-host");
      if (tagIds && tagIds.length > 0) args.push("--tags", tagIds.join(","));
      if (winrarPath) args.push("--winrar", winrarPath);
      const python = pythonPath || "python";
      const scriptDir = path.dirname(devKitScriptPath);
      const childEnv = {
        ...process.env,
        PYTHONIOENCODING: "utf-8",
        PYTHONUNBUFFERED: "1"
      };
      if (gate.status.serverRootPath) childEnv.QAQM_SERVER_ROOT = gate.status.serverRootPath;
      console.log(`[DevPublish] Spawning: ${python} ${args.join(" ")}`);
      if (gate.status.serverRootPath) console.log(`[DevPublish] QAQM_SERVER_ROOT=${gate.status.serverRootPath}`);
      const proc = child_process.spawn(python, args, {
        cwd: scriptDir,
        env: childEnv
      });
      devPublishProcesses.set(publishTaskId, proc);
      proc.stdout.on("data", chunk => {
        sendPublishProgress(chunk.toString("utf-8"));
      });
      proc.stderr.on("data", chunk => {
        const line = chunk.toString("utf-8").trim();
        if (line) sendPublishProgress(JSON.stringify({
          type: "log",
          message: `[stderr] ${line}`,
          level: "warn"
        }) + "\n");
      });
      proc.on("close", code => {
        console.log(`[DevPublish] Process exited code=${code}`);
        if (devPublishProcesses.get(publishTaskId) === proc) devPublishProcesses.delete(publishTaskId);
        sendPublishDone({
          exitCode: code
        });
      });
      proc.on("error", err => {
        if (devPublishProcesses.get(publishTaskId) === proc) devPublishProcesses.delete(publishTaskId);
        sendPublishProgress(JSON.stringify({
          type: "error",
          message: i18n.t("backend.developer.publish.startupFailed", {
            reason: err.message
          })
        }) + "\n");
        sendPublishDone({
          exitCode: -1
        });
      });
      return {
        success: true,
        pid: proc.pid,
        taskId: publishTaskId
      };
    } catch (e) {
      return {
        success: false,
        error: e.message
      };
    }
  });
}
module.exports = {
  registerIpc
};
