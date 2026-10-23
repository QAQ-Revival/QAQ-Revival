"use strict";

const i18n = require("../../shared/i18n/core.cjs");
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const child_process = require("child_process");
const charactersImages = require("../characters/images.cjs");
const developerAccess = require("./access.cjs");
const gamesSettings = require("../games/settings.cjs");
const netQaqm = require("../net/qaqm.cjs");
function registerIpc() {
  electron.ipcMain.handle("dev:batch-cloud-op", async (event, params) => {
    try {
      const {
        mode,
        gameId: gameId2,
        modsDir,
        characters,
        password,
        force,
        pythonPath,
        modIds,
        modNames
      } = params;
      const gate = developerAccess.requireDevKitUnlocked();
      if (!gate.success) return gate;
      const batchScript = gate.status.batchScriptPath;
      if (!fs.existsSync(batchScript)) {
        return {
          success: false,
          error: i18n.t("backend.developer.cloud.batchScriptMissing", {
            batchScript
          })
        };
      }
      const args = [batchScript, "--mode", mode, "--game-id", gameId2 || "endfield"];
      const resolvedModsDir = modsDir || gamesSettings.getResolvedActiveGamePaths().modsPath || "";
      if (resolvedModsDir) args.push("--mods-dir", resolvedModsDir);
      if (characters) args.push("--characters", characters);
      if (password) args.push("--password", password);
      if (force) args.push("--force");
      if (modIds) args.push("--mod-ids", modIds);
      if (modNames) args.push("--mod-names", modNames);
      const python = pythonPath || "python";
      const scriptDir = path.dirname(batchScript);
      console.log(`[DevBatch] Spawning: ${python} ${args.join(" ")}`);
      const proc = child_process.spawn(python, args, {
        cwd: scriptDir,
        env: {
          ...process.env,
          PYTHONIOENCODING: "utf-8",
          PYTHONUNBUFFERED: "1"
        }
      });
      proc.stdout.on("data", chunk => {
        event.sender.send("dev:batch-progress", chunk.toString("utf-8"));
      });
      proc.stderr.on("data", chunk => {
        const line = chunk.toString("utf-8").trim();
        if (line) event.sender.send("dev:batch-progress", JSON.stringify({
          type: "log",
          message: `[stderr] ${line}`,
          level: "warn"
        }) + "\n");
      });
      proc.on("close", code => {
        console.log(`[DevBatch] Process exited code=${code}`);
        event.sender.send("dev:batch-done", {
          exitCode: code
        });
      });
      proc.on("error", err => {
        event.sender.send("dev:batch-progress", JSON.stringify({
          type: "error",
          message: i18n.t("backend.developer.cloud.startupFailed", {
            reason: err.message
          })
        }) + "\n");
        event.sender.send("dev:batch-done", {
          exitCode: -1
        });
      });
      return {
        success: true,
        pid: proc.pid
      };
    } catch (e) {
      return {
        success: false,
        error: e.message
      };
    }
  });
  electron.ipcMain.handle("dev:fill-missing-images", async (_, {
    adminKey,
    serverUrl
  }) => {
    try {
      const baseUrl = (serverUrl || netQaqm.DEFAULT_SERVER_URL).replace(/\/$/, "");
      const modsPathStatus = gamesSettings.getModsPathStatus();
      if (!modsPathStatus.ok) return {
        success: false,
        error: modsPathStatus.error
      };
      const {
        modsPath
      } = modsPathStatus;
      const modIdToPath = {};
      for (const charDir of fs.readdirSync(modsPath, {
        withFileTypes: true
      }).filter(d => d.isDirectory())) {
        const charPath = path.join(modsPath, charDir.name);
        for (const modDir of fs.readdirSync(charPath, {
          withFileTypes: true
        }).filter(d => d.isDirectory())) {
          const idFile = path.join(charPath, modDir.name, ".qaqmod_id");
          try {
            const id = parseInt(fs.readFileSync(idFile, "utf-8").trim());
            if (id) modIdToPath[id] = path.join(charPath, modDir.name);
          } catch {}
        }
      }
      const resp = await fetch(`${baseUrl}/api/mods`);
      if (!resp.ok) return {
        success: false,
        error: i18n.t("backend.developer.cloud.modListRequestFailed", {
          status: resp.status
        })
      };
      const data = await resp.json();
      const allMods = data.mods || (Array.isArray(data) ? data : []);
      const modsWithoutImage = allMods.filter(m => !m.imageUrl);
      if (modsWithoutImage.length === 0) {
        return {
          success: true,
          total: 0,
          filled: 0,
          skipped: 0,
          errors: [],
          message: i18n.t("backend.developer.cloud.allModsHaveImages")
        };
      }
      const filled = [];
      const skipped = [];
      const errors = [];
      const previewNames = ["preview.png", "preview.jpg", "preview.jpeg", "preview.webp", "preview.gif", "Cover.png", "Cover.jpg", "Cover.jpeg", "Cover.webp", "Cover.gif", "cover.png", "cover.jpg", "cover.jpeg", "cover.webp", "cover.gif"];
      for (const mod of modsWithoutImage) {
        const folderPath = modIdToPath[mod.id];
        if (!folderPath) {
          skipped.push({
            id: mod.id,
            name: mod.name,
            reason: i18n.t("backend.developer.cloud.localFolderMissing")
          });
          continue;
        }
        let previewPath = null;
        for (const name of previewNames) {
          const p = path.join(folderPath, name);
          if (fs.existsSync(p)) {
            previewPath = p;
            break;
          }
        }
        if (!previewPath) {
          try {
            const imgFile = fs.readdirSync(folderPath).find(f => /\.(png|jpg|jpeg|webp|gif)$/i.test(f));
            if (imgFile) previewPath = path.join(folderPath, imgFile);
          } catch {}
        }
        if (!previewPath) {
          skipped.push({
            id: mod.id,
            name: mod.name,
            reason: i18n.t("backend.developer.cloud.localPreviewMissing")
          });
          continue;
        }
        try {
          const imageBuffer = fs.readFileSync(previewPath);
          const filename = path.basename(previewPath);
          const mimeType = charactersImages.getImageMimeTypeFromExt(path.extname(filename));
          const formData = new FormData();
          formData.append("image", new Blob([imageBuffer], {
            type: mimeType
          }), filename);
          const uploadResp = await fetch(`${baseUrl}/api/mods/${mod.id}/upload-image`, {
            method: "POST",
            headers: {
              "x-admin-key": adminKey
            },
            body: formData
          });
          if (!uploadResp.ok) {
            const err = await uploadResp.json().catch(() => ({}));
            errors.push({
              id: mod.id,
              name: mod.name,
              error: err.error || i18n.t("backend.developer.cloud.hTTP", {
                status: uploadResp.status
              })
            });
          } else {
            filled.push({
              id: mod.id,
              name: mod.name
            });
          }
        } catch (e) {
          errors.push({
            id: mod.id,
            name: mod.name,
            error: e.message
          });
        }
      }
      return {
        success: true,
        total: modsWithoutImage.length,
        filled: filled.length,
        skipped: skipped.length,
        errorCount: errors.length,
        filledList: filled,
        skippedList: skipped,
        errors
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
