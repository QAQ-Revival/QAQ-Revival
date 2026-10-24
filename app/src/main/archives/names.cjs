"use strict";

const path = require("path");
const marketSettings = require("../market/settings.cjs");
const systemPaths = require("../system/paths.cjs");

function getModArchiveName(filePath) {
  const name = path.basename(filePath, path.extname(filePath));
  const cachePrefix = /^[a-f0-9]{16}-(?=.)/i;
  if (!cachePrefix.test(name)) return name;

  const parentDir = path.dirname(filePath);
  const installDir = marketSettings.getQaqInstallDir();
  const cacheDirs = [marketSettings.getMarketDownloadCacheDir(), path.join(installDir, "QAQR_DownloadCache"), path.join(installDir, "QAQM_DownloadCache")];
  // Strip only our cache key; keep hashes in ordinary or original archive names.
  return cacheDirs.some(cacheDir => systemPaths.isSameResolvedPath(parentDir, cacheDir)) ? name.replace(cachePrefix, "") : name;
}

module.exports = { getModArchiveName };
