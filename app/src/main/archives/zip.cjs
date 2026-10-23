"use strict";

const path = require("path");
const fs = require("fs");
const pathTo7zip = require("7zip-bin");
const iconv = require("iconv-lite");
function get7zaPath() {
  return pathTo7zip.path7za.replace("app.asar" + path.sep, "app.asar.unpacked" + path.sep);
}
function decodeZipEntryName(entry) {
  if (!entry) return "";
  const raw = entry.rawEntryName;
  const fallback = entry.entryName || "";
  if (!raw || !Buffer.isBuffer(raw)) return fallback;
  let hasHighByte = false;
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] >= 128) {
      hasHighByte = true;
      break;
    }
  }
  if (!hasHighByte) return fallback;
  const flags = entry.header && typeof entry.header.flags === "number" ? entry.header.flags : 0;
  if (flags & 2048) return fallback;
  try {
    const gbk = iconv.decode(raw, "gbk");
    if (gbk && !gbk.includes("�")) return gbk;
  } catch (_) {}
  return fallback;
}
function extractZipEntryWithCjkSupport(entry, targetDir) {
  if (!entry) return null;
  const decoded = decodeZipEntryName(entry);
  if (!decoded) return null;
  const normalized = decoded.replace(/\\/g, "/").replace(/\/+/g, "/");
  const segments = normalized.split("/").filter(seg => seg && seg !== "." && seg !== "..");
  if (segments.length === 0) return null;
  const outPath = path.join(targetDir, ...segments);
  const resolvedTarget = path.resolve(targetDir);
  const resolvedOut = path.resolve(outPath);
  if (resolvedOut !== resolvedTarget && !resolvedOut.startsWith(resolvedTarget + path.sep)) {
    return null;
  }
  if (entry.isDirectory) {
    fs.mkdirSync(outPath, {
      recursive: true
    });
  } else {
    fs.mkdirSync(path.dirname(outPath), {
      recursive: true
    });
    const data = entry.getData();
    fs.writeFileSync(outPath, data);
  }
  return {
    outPath,
    displayName: normalized
  };
}
module.exports = {
  get7zaPath,
  decodeZipEntryName,
  extractZipEntryWithCjkSupport
};
