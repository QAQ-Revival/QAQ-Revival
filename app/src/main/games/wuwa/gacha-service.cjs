"use strict";

const electron = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { t } = require("../../../shared/i18n/core.cjs");
const { createGachaService } = require("./gacha.cjs");
const settings = require("../settings.cjs");
const windows = require("../../desktop/windows.cjs");

function registerIpc() {
  // Consent belongs to a live window and is never written to configuration.
  const approved = new Set();
  const service = createGachaService({
    stateDir: path.join(electron.app.getPath("userData"), "wuwa-gacha"),
    fetch: (...args) => electron.net.fetch(...args),
    getGamePaths: () => {
      const game = settings.getSettingsGame("wuthering-waves");
      const info = settings.readXxmiImporterPathInfo(
        game.modLoaderPath,
        game.id,
      );
      return [
        game.gamePath,
        info.gameFolder && info.xxmiRootDir
          ? path.resolve(info.xxmiRootDir, info.gameFolder)
          : "",
      ];
    },
    onProgress: (payload) => {
      for (const sender of approved) {
        if (!sender.isDestroyed()) sender.send("wuwa:gacha-progress", payload);
      }
    },
  });
  async function chooseSource(kind) {
    const selected = await electron.dialog.showOpenDialog(
      windows.mainWindowRef,
      {
        title: t(
          kind === "folder"
            ? "gacha.chooseFolderTitle"
            : "gacha.chooseLogTitle",
        ),
        properties: [kind === "folder" ? "openDirectory" : "openFile"],
        ...(kind === "folder"
          ? {}
          : { filters: [{ name: t("gacha.logFilter"), extensions: ["log"] }] }),
      },
    );
    if (selected.canceled || !selected.filePaths?.length)
      return { success: false, canceled: true };
    return service.extract(selected.filePaths[0]);
  }
  const actions = {
    "wuwa:gacha-extract": () => service.extract(),
    "wuwa:gacha-choose-folder": () => chooseSource("folder"),
    "wuwa:gacha-choose-log": () => chooseSource("log"),
    "wuwa:gacha-fetch": (_event, payload) =>
      service.fetchAll({ url: payload?.url, consent: true }),
    "wuwa:gacha-cancel": () => service.cancel(),
    "wuwa:gacha-import": async () => {
      if (service.state().busy) throw Error(t("gacha.busy"));
      const selected = await electron.dialog.showOpenDialog(
        windows.mainWindowRef,
        {
          title: t("gacha.import"),
          properties: ["openFile"],
          filters: [{ name: "JSON", extensions: ["json"] }],
        },
      );
      if (selected.canceled || !selected.filePaths?.length)
        return { success: false, canceled: true };
      let data;
      try {
        const file = selected.filePaths[0];
        if ((await fs.promises.stat(file)).size > 32 * 1024 * 1024)
          throw Error();
        data = JSON.parse(await fs.promises.readFile(file, "utf8"));
      } catch {
        throw Error(t("gacha.invalidImport"));
      }
      return service.saveSnapshot(data);
    },
    "wuwa:gacha-copy": async (_event, payload) => {
      await electron.clipboard.writeText(
        service.exportContents("url", payload?.url).trim(),
      );
      return { success: true };
    },
    "wuwa:gacha-export": async (_event, payload) => {
      const format = payload?.format;
      const contents = service.exportContents(format, payload?.url);
      const formats = {
        url: ["wuwa_gacha_url.txt", "txt", t("gacha.textFilter")],
        json: ["wuwa_gacha_records.json", "json", "JSON"],
        report: ["wuwa_gacha_report.md", "md", t("gacha.reportFilter")],
      };
      const [filename, extension, name] = formats[format];
      const selected = await electron.dialog.showSaveDialog(
        windows.mainWindowRef,
        {
          title: t("gacha.exportTitle"),
          defaultPath: path.join(electron.app.getPath("documents"), filename),
          filters: [{ name, extensions: [extension] }],
        },
      );
      if (selected.canceled || !selected.filePath)
        return { success: false, canceled: true };
      const temporary = selected.filePath + "." + crypto.randomUUID() + ".tmp";
      try {
        await fs.promises.writeFile(temporary, contents, {
          encoding: "utf8",
          flag: "wx",
        });
        await fs.promises.rename(temporary, selected.filePath);
        return { success: true, path: selected.filePath };
      } catch {
        throw Error(t("gacha.exportFailed"));
      } finally {
        await fs.promises.unlink(temporary).catch(() => {});
      }
    },
  };
  electron.ipcMain.handle("wuwa:gacha-state", (event) =>
    approved.has(event.sender)
      ? { ...service.state(), authorized: true }
      : { success: true, authorized: false },
  );
  electron.ipcMain.handle("wuwa:gacha-authorize", (event, payload) => {
    if (
      payload?.accepted !== true ||
      !event.sender ||
      event.sender.isDestroyed()
    )
      return { success: false, error: t("gacha.consentRequired") };
    if (!approved.has(event.sender)) {
      approved.add(event.sender);
      event.sender.once("destroyed", () => {
        approved.delete(event.sender);
        if (!approved.size) service.cancel();
      });
    }
    return { ...service.state(), authorized: true };
  });
  for (const [channel, action] of Object.entries(actions)) {
    electron.ipcMain.handle(channel, async (event, payload) => {
      if (!approved.has(event.sender))
        return { success: false, error: t("gacha.consentRequired") };
      try {
        return await action(event, payload);
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
  }
}

module.exports = { registerIpc };
