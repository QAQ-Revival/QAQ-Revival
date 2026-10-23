"use strict";

const i18n = require("../../shared/i18n/core.cjs");
module.exports = {
  flattenSingleSubfolder,
  spawnExtract,
  extractArchiveWithExternalTool
};
const path = require("path");
const fs = require("fs");
const child_process = require("child_process");
const iconv = require("iconv-lite");
const archivesZip = require("./zip.cjs");
const coreLogger = require("../core/logger.cjs");
const importsIntegrated = require("../imports/integrated.cjs");
const overlayHelperPaths = require("../overlay/helper-paths.cjs");
const BANDIZIP_PATH = "C:\\Program Files\\Bandizip\\bz.exe";
function getUnrarPath() {
  const bundled = overlayHelperPaths.resolveBundledHelperPath("UnRAR.exe");
  if (bundled && fs.existsSync(bundled)) return bundled;
  const systemPaths = ["C:\\Program Files\\WinRAR\\UnRAR.exe", "C:\\Program Files (x86)\\WinRAR\\UnRAR.exe"];
  return systemPaths.find(p => fs.existsSync(p)) || null;
}
function isBandizipAvailable() {
  return fs.existsSync(BANDIZIP_PATH);
}
function flattenSingleSubfolder(targetPath) {
  try {
    const extracted = fs.readdirSync(targetPath);
    if (extracted.length === 1) {
      if (String(extracted[0] || "").toLowerCase() === "mods") {
        coreLogger.logger.info("Skipped flattening Mods root for integrated package");
        return;
      }
      const singleItem = path.join(targetPath, extracted[0]);
      if (importsIntegrated.findIntegratedModsDir(singleItem, 1)) {
        coreLogger.logger.info("Skipped flattening integrated package wrapper");
        return;
      }
      if (fs.statSync(singleItem).isDirectory()) {
        const innerFiles = fs.readdirSync(singleItem);
        for (const file of innerFiles) {
          fs.renameSync(path.join(singleItem, file), path.join(targetPath, file));
        }
        fs.rmdirSync(singleItem);
        coreLogger.logger.info("Flattened single subfolder");
      }
    }
  } catch (_) {}
}
function spawnExtract(exePath, args) {
  return new Promise((resolve, reject) => {
    const child = child_process.spawn(exePath, args, {
      windowsHide: true
    });
    const stdoutChunks = [];
    const stderrChunks = [];
    child.stdout.on("data", d => {
      stdoutChunks.push(d);
    });
    child.stderr.on("data", d => {
      stderrChunks.push(d);
    });
    child.on("error", reject);
    child.on("close", code => {
      const stdout = iconv.decode(Buffer.concat(stdoutChunks), "gbk");
      const stderr = iconv.decode(Buffer.concat(stderrChunks), "gbk");
      if (stdout) coreLogger.logger.info(`stdout: ${stdout}`);
      if (stderr) coreLogger.logger.error(`stderr: ${stderr}`);
      resolve({
        code,
        stdout,
        stderr
      });
    });
  });
}
async function extractArchiveWithExternalTool(archivePath, targetPath, { flatten = true, purpose = "mod" } = {}) {
  const update = purpose === "update";
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, {
      recursive: true
    });
  }
  const sevenZipPath = archivesZip.get7zaPath();
  const ext = path.extname(archivePath).toLowerCase();
  coreLogger.logger.info(`Extracting archive: ${archivePath}`);
  coreLogger.logger.info(`Target path: ${targetPath}`);
  // The bundled 7za supports ZIP/7z, but has no RAR decoder.
  if (ext === ".rar" || ext === ".exe") {
    const unrarExe = getUnrarPath();
    if (unrarExe) {
      coreLogger.logger.info(`RAR/SFX archive detected, using UnRAR: ${unrarExe}`);
      const argsUnrar = ["x", "-y", "-o+", "-p-", archivePath, targetPath + path.sep];
      const resultUnrar = await spawnExtract(unrarExe, argsUnrar);
      coreLogger.logger.info(`UnRAR exit code: ${resultUnrar.code}`);
      if (resultUnrar.code === 0) {
        if (flatten) flattenSingleSubfolder(targetPath);
        return;
      }
      throw new Error(i18n.t(update ? "backend.install.managed.updateUnrarFailed" : "backend.archives.extract.unrarExtractionFailed", {
        code: resultUnrar.code,
        stderr: resultUnrar.stderr || resultUnrar.stdout
      }));
    }
    if (update) throw new Error(i18n.t("backend.install.managed.updateUnrarMissing", { archiveType: ext.slice(1).toUpperCase() }));
    throw new Error(i18n.t("backend.archives.extract.unrarMissing", {
      label: ext === ".rar" ? i18n.t("backend.archives.extract.rarArchive") : i18n.t("backend.archives.extract.selfExtractingArchive")
    }));
  }
  const args7z = ["x", archivePath, `-o${targetPath}`, "-y", "-aoa"];
  coreLogger.logger.info(`Trying 7zip: ${sevenZipPath}`);
  const result7z = await spawnExtract(sevenZipPath, args7z);
  coreLogger.logger.info(`7z exit code: ${result7z.code}`);
  if (result7z.code === 0) {
    if (flatten) flattenSingleSubfolder(targetPath);
    return;
  }
  if (isBandizipAvailable()) {
    coreLogger.logger.info(`7zip failed (code ${result7z.code}), trying Bandizip fallback`);
    const argsBz = ["x", archivePath, `-o:${targetPath}`, "-y", "-aoa"];
    const resultBz = await spawnExtract(BANDIZIP_PATH, argsBz);
    coreLogger.logger.info(`Bandizip exit code: ${resultBz.code}`);
    if (resultBz.code === 0) {
      if (flatten) flattenSingleSubfolder(targetPath);
      return;
    }
    throw new Error(i18n.t(update ? "backend.install.managed.updateExtractorsFailed" : "backend.archives.extract.extractorsFailed", {
      code: result7z.code,
      code2: resultBz.code
    }));
  }
  throw new Error(i18n.t(update ? "backend.install.managed.updateSevenZipFailed" : "backend.archives.extract.sevenZipExitedWithCode", {
    code: result7z.code,
    stderr: result7z.stderr || result7z.stdout
  }));
}
