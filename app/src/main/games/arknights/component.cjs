"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFile } = require("node:child_process");
const electron = require("electron");
const i18n = require("../../../shared/i18n/core.cjs");
const files = require("./files.cjs");
const SOURCE = "https://github.com/QAQ-Revival/Arknights-Mod-Tools";

function packageInfo() {
  const candidates = [path.dirname(process.execPath), path.resolve(electron.app.getAppPath(), "../.."), path.resolve(electron.app.getAppPath(), "..")].map(root => path.join(root, "local-components/arknights-tools"));
  const root = candidates.find(dir => fs.existsSync(path.join(dir, "component.json")));
  if (!root) throw Error(i18n.t("arknights.errors.componentMissing"));
  files.assertNoLinks(root);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "component.json"), "utf8"));
  if (manifest.protocol !== 1 || manifest.source !== SOURCE || !manifest.files) throw Error(i18n.t("arknights.errors.componentInvalid"));
  return { root, manifest };
}
function resolveFile(relative) {
  const { root, manifest } = packageInfo();
  const file = path.join(root, relative);
  if (!files.inside(file, root)) throw Error(i18n.t("arknights.errors.componentInvalid"));
  files.assertNoLinks(file);
  const expected = manifest.files[relative];
  if (!expected || !fs.existsSync(file) || crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex") !== expected) throw Error(i18n.t("arknights.errors.componentInvalid"));
  return file;
}
function state() {
  try {
    const { manifest } = packageInfo();
    const loader = resolveFile("loader/ArkLoader.exe");
    resolveFile("loader/ArkRuntime.dll");
    resolveFile("ArknightsTools/ArknightsTools.exe");
    return { loader, loaderReady: true, workerReady: true, singleModReloadSupported: manifest.capabilities?.includes("single-mod-reload-v2") === true, source: SOURCE, dependencies: manifest.dependencies, experimental: manifest.gameRuntimeValidated !== true };
  } catch (error) { return { loader: "", loaderReady: false, workerReady: false, source: SOURCE, experimental: true, componentError: error.message }; }
}
function runNative(args) {
  const executable = resolveFile("loader/ArkLoader.exe");
  resolveFile("loader/ArkRuntime.dll");
  return new Promise((resolve, reject) => {
    execFile(executable, args, { cwd: path.dirname(executable), windowsHide: true, timeout: ["--check", "--launch"].includes(args[0]) ? 10 * 60 * 1000 : 90000, maxBuffer: 1024 * 1024 }, (error, stdout) => {
      try {
        const result = JSON.parse(stdout);
        if (error || !result.success) throw Error(result.error || i18n.t("arknights.errors.workerFailed"));
        resolve(result);
      } catch (parseError) { reject(parseError); }
    });
  });
}
module.exports = { SOURCE, packageInfo, resolveFile, state, runNative };
