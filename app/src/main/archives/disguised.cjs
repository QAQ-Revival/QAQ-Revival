"use strict";

const i18n = require("../../shared/i18n/core.cjs");
module.exports = {
  writeFileToFdSync,
  writeXorFileToFdSync,
  writeXorSingleFileZipToFdSync,
  getDirectoryStatsSync,
  pickExportEncryptVideo,
  run7zSync,
  getEncryptedExportArchiveSource,
  isDisguisedMp4,
  peekDisguisedModName,
  extractDisguisedMp4
};
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const AdmZip = require("adm-zip");
const child_process = require("child_process");
const iconv = require("iconv-lite");
const archivesExtract = require("./extract.cjs");
const archivesTemp = require("./temp.cjs");
const archivesZip = require("./zip.cjs");
const coreLogger = require("../core/logger.cjs");
const systemFiles = require("../system/files.cjs");
const DISGUISE_PASSWORD = "qsl";
const DISGUISE_XOR_KEY = Buffer.from([165, 163, 127, 209, 142, 66, 185, 106, 240, 29, 83, 200, 116, 43, 230, 145]);
const DISGUISE_MAGIC = Buffer.from("QAQM0002", "ascii");
const EXPORT_ENCRYPT_VIDEO_DIR = path.join(electron.app.getPath("videos"), "QAQ-Revival");
const EXPORT_ENCRYPT_LONG_VIDEO_DIR = path.join(EXPORT_ENCRYPT_VIDEO_DIR, "长视频");
const EXPORT_ENCRYPT_LONG_VIDEO_THRESHOLD = 512 * 1024 * 1024;
const EXPORT_ENCRYPT_DIRECT_7Z_THRESHOLD = 1024 * 1024 * 1024;
function findDisguiseMagic(filePath) {
  try {
    const fd = fs.openSync(filePath, "r");
    const stat = fs.fstatSync(fd);
    if (!stat.isFile()) {
      fs.closeSync(fd);
      return -1;
    }
    const fileSize = stat.size;
    const chunkSize = 4 * 1024 * 1024;
    const overlap = DISGUISE_MAGIC.length - 1;
    let pos = fileSize;
    let carry = Buffer.alloc(0);
    while (pos > 0) {
      const readLen = Math.min(chunkSize, pos);
      pos -= readLen;
      const chunk = Buffer.alloc(readLen + carry.length);
      fs.readSync(fd, chunk, 0, readLen, pos);
      carry.copy(chunk, readLen);
      const idx = chunk.lastIndexOf(DISGUISE_MAGIC);
      if (idx !== -1) {
        fs.closeSync(fd);
        return pos + idx;
      }
      carry = chunk.subarray(0, Math.min(overlap, chunk.length));
    }
    fs.closeSync(fd);
  } catch (_) {}
  return -1;
}
function decodeV2ToTempZip(filePath, tempDir = electron.app.getPath("temp")) {
  const magicOffset = findDisguiseMagic(filePath);
  if (magicOffset < 0) return null;
  const dataOffset = magicOffset + DISGUISE_MAGIC.length;
  const stat = fs.statSync(filePath);
  const dataLen = stat.size - dataOffset;
  if (dataLen <= 0) return null;
  fs.mkdirSync(tempDir, {
    recursive: true
  });
  const tmpZip = path.join(tempDir, `qaqm-xor-${Date.now()}.zip`);
  const inFd = fs.openSync(filePath, "r");
  const outFd = fs.openSync(tmpZip, "w");
  const chunkSize = 4 * 1024 * 1024;
  let remaining = dataLen;
  let readOffset = dataOffset;
  let keyOffset = 0;
  try {
    while (remaining > 0) {
      const readLen = Math.min(chunkSize, remaining);
      const chunk = Buffer.alloc(readLen);
      const bytesRead = fs.readSync(inFd, chunk, 0, readLen, readOffset);
      if (bytesRead <= 0) throw new Error(i18n.t("backend.archives.disguised.unexpectedEOFWhileDecodingDisguisedMod"));
      for (let i = 0; i < bytesRead; i++) {
        chunk[i] = chunk[i] ^ DISGUISE_XOR_KEY[(keyOffset + i) % DISGUISE_XOR_KEY.length];
      }
      fs.writeSync(outFd, chunk, 0, bytesRead);
      readOffset += bytesRead;
      keyOffset += bytesRead;
      remaining -= bytesRead;
    }
  } finally {
    fs.closeSync(inFd);
    fs.closeSync(outFd);
  }
  return tmpZip;
}
function emitDisguiseProgress(onProgress, payload = {}) {
  if (typeof onProgress !== "function") return;
  try {
    onProgress(payload);
  } catch (_) {}
}
function getPercentLabel(done, total) {
  if (!Number.isFinite(done) || !Number.isFinite(total) || total <= 0) return "";
  return `${Math.max(0, Math.min(100, done / total * 100)).toFixed(1)}%`;
}
function yieldToEventLoop() {
  return new Promise(resolve => setImmediate(resolve));
}
async function decodeV2ToTempZipAsync(filePath, tempDir = electron.app.getPath("temp"), onProgress = null) {
  const magicOffset = findDisguiseMagic(filePath);
  if (magicOffset < 0) return null;
  const dataOffset = magicOffset + DISGUISE_MAGIC.length;
  const stat = await fs.promises.stat(filePath);
  const dataLen = stat.size - dataOffset;
  if (dataLen <= 0) return null;
  await fs.promises.mkdir(tempDir, {
    recursive: true
  });
  const tmpZip = path.join(tempDir, `qaqm-xor-${Date.now()}.zip`);
  const inHandle = await fs.promises.open(filePath, "r");
  const outHandle = await fs.promises.open(tmpZip, "w");
  const chunkSize = 4 * 1024 * 1024;
  let remaining = dataLen;
  let readOffset = dataOffset;
  let keyOffset = 0;
  let copied = 0;
  let lastProgressAt = 0;
  try {
    while (remaining > 0) {
      const readLen = Math.min(chunkSize, remaining);
      const chunk = Buffer.alloc(readLen);
      const {
        bytesRead
      } = await inHandle.read(chunk, 0, readLen, readOffset);
      if (bytesRead <= 0) throw new Error(i18n.t("backend.archives.disguised.unexpectedEOFWhileDecodingDisguisedMod"));
      for (let i = 0; i < bytesRead; i++) {
        chunk[i] = chunk[i] ^ DISGUISE_XOR_KEY[(keyOffset + i) % DISGUISE_XOR_KEY.length];
      }
      await outHandle.write(chunk, 0, bytesRead);
      readOffset += bytesRead;
      keyOffset += bytesRead;
      copied += bytesRead;
      remaining -= bytesRead;
      if (copied - lastProgressAt >= 32 * 1024 * 1024 || remaining === 0) {
        lastProgressAt = copied;
        emitDisguiseProgress(onProgress, {
          status: "running",
          stage: "decode",
          message: i18n.t("backend.archives.disguised.decodingVideo", {
            progress: getPercentLabel(copied, dataLen)
          }),
          currentBytes: copied,
          totalBytes: dataLen
        });
      }
      await yieldToEventLoop();
    }
  } finally {
    await inHandle.close().catch(() => {});
    await outHandle.close().catch(() => {});
  }
  return tmpZip;
}
function parse7zSltPaths(output) {
  const paths = [];
  let inItems = false;
  for (const line of String(output || "").split(/\r?\n/)) {
    if (line.startsWith("----------")) {
      inItems = true;
      continue;
    }
    if (inItems && line.startsWith("Path = ")) {
      const itemPath = line.slice("Path = ".length).trim();
      if (itemPath) paths.push(itemPath);
    }
  }
  return paths;
}
function decodeXorRangeFromFileSync(filePath, fileOffset, length, keyOffset) {
  const fd = fs.openSync(filePath, "r");
  const buffer = Buffer.alloc(length);
  try {
    const bytesRead = fs.readSync(fd, buffer, 0, length, fileOffset);
    if (bytesRead !== length) throw new Error(i18n.t("backend.archives.disguised.unexpectedEOFWhileReadingDisguisedPayload"));
    for (let i = 0; i < bytesRead; i++) {
      buffer[i] = buffer[i] ^ DISGUISE_XOR_KEY[(keyOffset + i) % DISGUISE_XOR_KEY.length];
    }
    return buffer;
  } finally {
    fs.closeSync(fd);
  }
}
function readZip64SizeFromExtra(extraBuffer, compressedSize) {
  let offset = 0;
  while (offset + 4 <= extraBuffer.length) {
    const headerId = extraBuffer.readUInt16LE(offset);
    const dataSize = extraBuffer.readUInt16LE(offset + 2);
    const dataStart = offset + 4;
    if (headerId === 1 && dataStart + dataSize <= extraBuffer.length) {
      if (compressedSize === 4294967295 && dataSize >= 16) {
        return Number(extraBuffer.readBigUInt64LE(dataStart + 8));
      }
      if (compressedSize === 4294967295 && dataSize >= 8) {
        return Number(extraBuffer.readBigUInt64LE(dataStart));
      }
    }
    offset = dataStart + dataSize;
  }
  return compressedSize;
}
function peekStoredOuterZipEntryNameFromDisguise(mp4Path) {
  const magicOffset = findDisguiseMagic(mp4Path);
  if (magicOffset < 0) return null;
  const dataOffset = magicOffset + DISGUISE_MAGIC.length;
  const header = decodeXorRangeFromFileSync(mp4Path, dataOffset, 30, 0);
  if (header.readUInt32LE(0) !== 67324752) return null;
  const method = header.readUInt16LE(8);
  if (method !== 0) return null;
  const nameLength = header.readUInt16LE(26);
  if (nameLength <= 0 || nameLength > 4096) return null;
  const nameBuffer = decodeXorRangeFromFileSync(mp4Path, dataOffset + 30, nameLength, 30);
  return nameBuffer.toString("utf-8").replace(/\\/g, "/");
}
async function tryExtractStoredOuterZipEntryFromDisguiseAsync(mp4Path, tempDir, onProgress = null) {
  const magicOffset = findDisguiseMagic(mp4Path);
  if (magicOffset < 0) return null;
  const dataOffset = magicOffset + DISGUISE_MAGIC.length;
  const header = decodeXorRangeFromFileSync(mp4Path, dataOffset, 30, 0);
  if (header.readUInt32LE(0) !== 67324752) return null;
  const flags = header.readUInt16LE(6);
  const method = header.readUInt16LE(8);
  if (method !== 0 || flags & 8) return null;
  let compressedSize = header.readUInt32LE(18);
  const nameLength = header.readUInt16LE(26);
  const extraLength = header.readUInt16LE(28);
  if (nameLength <= 0 || nameLength > 4096 || extraLength > 4096) return null;
  const nameBuffer = decodeXorRangeFromFileSync(mp4Path, dataOffset + 30, nameLength, 30);
  const entryName = nameBuffer.toString("utf-8").replace(/\\/g, "/");
  if (!entryName.toLowerCase().endsWith(".7z")) return null;
  const extraBuffer = extraLength > 0 ? decodeXorRangeFromFileSync(mp4Path, dataOffset + 30 + nameLength, extraLength, 30 + nameLength) : Buffer.alloc(0);
  compressedSize = readZip64SizeFromExtra(extraBuffer, compressedSize);
  if (!Number.isSafeInteger(compressedSize) || compressedSize <= 0) return null;
  const safeName = path.basename(entryName) || `qaqm-${Date.now()}.7z`;
  const sevenzPath = path.join(tempDir, safeName);
  const payloadOffset = 30 + nameLength + extraLength;
  const fileDataOffset = dataOffset + payloadOffset;
  const inHandle = await fs.promises.open(mp4Path, "r");
  const outHandle = await fs.promises.open(sevenzPath, "w");
  const buffer = Buffer.alloc(4 * 1024 * 1024);
  let copied = 0;
  let lastProgressAt = 0;
  try {
    while (copied < compressedSize) {
      const readLen = Math.min(buffer.length, compressedSize - copied);
      const {
        bytesRead
      } = await inHandle.read(buffer, 0, readLen, fileDataOffset + copied);
      if (bytesRead <= 0) throw new Error(i18n.t("backend.archives.disguised.unexpectedEOFWhileExtractingOuterZIPEntry"));
      for (let i = 0; i < bytesRead; i++) {
        buffer[i] = buffer[i] ^ DISGUISE_XOR_KEY[(payloadOffset + copied + i) % DISGUISE_XOR_KEY.length];
      }
      await outHandle.write(buffer, 0, bytesRead);
      copied += bytesRead;
      if (copied - lastProgressAt >= 32 * 1024 * 1024 || copied >= compressedSize) {
        lastProgressAt = copied;
        emitDisguiseProgress(onProgress, {
          status: "running",
          stage: "extract-outer-entry",
          message: i18n.t("backend.archives.disguised.extractingEncryptedData", {
            progress: getPercentLabel(copied, compressedSize)
          }),
          currentBytes: copied,
          totalBytes: compressedSize
        });
      }
      await yieldToEventLoop();
    }
  } finally {
    await inHandle.close().catch(() => {});
    await outHandle.close().catch(() => {});
  }
  return {
    sevenzPath,
    sevenzName: safeName
  };
}
function writeFileToFdSync(sourcePath, outFd) {
  const inFd = fs.openSync(sourcePath, "r");
  const buffer = Buffer.alloc(4 * 1024 * 1024);
  let total = 0;
  try {
    while (true) {
      const bytesRead = fs.readSync(inFd, buffer, 0, buffer.length, null);
      if (bytesRead <= 0) break;
      fs.writeSync(outFd, buffer, 0, bytesRead);
      total += bytesRead;
    }
  } finally {
    fs.closeSync(inFd);
  }
  return total;
}
function writeXorFileToFdSync(sourcePath, outFd, key) {
  const inFd = fs.openSync(sourcePath, "r");
  const buffer = Buffer.alloc(4 * 1024 * 1024);
  let total = 0;
  try {
    while (true) {
      const bytesRead = fs.readSync(inFd, buffer, 0, buffer.length, null);
      if (bytesRead <= 0) break;
      for (let i = 0; i < bytesRead; i++) {
        buffer[i] = buffer[i] ^ key[(total + i) % key.length];
      }
      fs.writeSync(outFd, buffer, 0, bytesRead);
      total += bytesRead;
    }
  } finally {
    fs.closeSync(inFd);
  }
  return total;
}
let crc32Table = null;
function getCrc32Table() {
  if (crc32Table) return crc32Table;
  crc32Table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
    }
    crc32Table[i] = c >>> 0;
  }
  return crc32Table;
}
function getDosDateTime(date = new Date()) {
  const year = Math.max(date.getFullYear(), 1980);
  const dosTime = date.getHours() << 11 | date.getMinutes() << 5 | Math.floor(date.getSeconds() / 2);
  const dosDate = year - 1980 << 9 | date.getMonth() + 1 << 5 | date.getDate();
  return {
    dosTime,
    dosDate
  };
}
function computeFileCrc32Sync(filePath) {
  const table = getCrc32Table();
  const inFd = fs.openSync(filePath, "r");
  const buffer = Buffer.alloc(4 * 1024 * 1024);
  let crc = 4294967295;
  try {
    while (true) {
      const bytesRead = fs.readSync(inFd, buffer, 0, buffer.length, null);
      if (bytesRead <= 0) break;
      for (let i = 0; i < bytesRead; i++) {
        crc = table[(crc ^ buffer[i]) & 255] ^ crc >>> 8;
      }
    }
  } finally {
    fs.closeSync(inFd);
  }
  return (crc ^ 4294967295) >>> 0;
}
function writeXorBufferToFdSync(buffer, outFd, key, keyOffset) {
  const out = Buffer.from(buffer);
  for (let i = 0; i < out.length; i++) {
    out[i] = out[i] ^ key[(keyOffset + i) % key.length];
  }
  fs.writeSync(outFd, out);
  return out.length;
}
function createZip64SizeExtra(fileSize) {
  const extra = Buffer.alloc(20);
  extra.writeUInt16LE(1, 0);
  extra.writeUInt16LE(16, 2);
  extra.writeBigUInt64LE(BigInt(fileSize), 4);
  extra.writeBigUInt64LE(BigInt(fileSize), 12);
  return extra;
}
function writeXorSingleFileZipToFdSync(sourcePath, zipEntryName, outFd, key) {
  const stat = fs.statSync(sourcePath);
  const fileSize = stat.size;
  const crc = computeFileCrc32Sync(sourcePath);
  const nameBuffer = Buffer.from(zipEntryName, "utf-8");
  const zip64Extra = createZip64SizeExtra(fileSize);
  const {
    dosTime,
    dosDate
  } = getDosDateTime(stat.mtime);
  let total = 0;
  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(67324752, 0);
  localHeader.writeUInt16LE(45, 4);
  localHeader.writeUInt16LE(2048, 6);
  localHeader.writeUInt16LE(0, 8);
  localHeader.writeUInt16LE(dosTime, 10);
  localHeader.writeUInt16LE(dosDate, 12);
  localHeader.writeUInt32LE(crc, 14);
  localHeader.writeUInt32LE(4294967295, 18);
  localHeader.writeUInt32LE(4294967295, 22);
  localHeader.writeUInt16LE(nameBuffer.length, 26);
  localHeader.writeUInt16LE(zip64Extra.length, 28);
  total += writeXorBufferToFdSync(localHeader, outFd, key, total);
  total += writeXorBufferToFdSync(nameBuffer, outFd, key, total);
  total += writeXorBufferToFdSync(zip64Extra, outFd, key, total);
  const inFd = fs.openSync(sourcePath, "r");
  const fileBuffer = Buffer.alloc(4 * 1024 * 1024);
  try {
    while (true) {
      const bytesRead = fs.readSync(inFd, fileBuffer, 0, fileBuffer.length, null);
      if (bytesRead <= 0) break;
      const chunk = Buffer.from(fileBuffer.subarray(0, bytesRead));
      total += writeXorBufferToFdSync(chunk, outFd, key, total);
    }
  } finally {
    fs.closeSync(inFd);
  }
  const centralDirOffset = total;
  const centralHeader = Buffer.alloc(46);
  centralHeader.writeUInt32LE(33639248, 0);
  centralHeader.writeUInt16LE(45, 4);
  centralHeader.writeUInt16LE(45, 6);
  centralHeader.writeUInt16LE(2048, 8);
  centralHeader.writeUInt16LE(0, 10);
  centralHeader.writeUInt16LE(dosTime, 12);
  centralHeader.writeUInt16LE(dosDate, 14);
  centralHeader.writeUInt32LE(crc, 16);
  centralHeader.writeUInt32LE(4294967295, 20);
  centralHeader.writeUInt32LE(4294967295, 24);
  centralHeader.writeUInt16LE(nameBuffer.length, 28);
  centralHeader.writeUInt16LE(zip64Extra.length, 30);
  centralHeader.writeUInt16LE(0, 32);
  centralHeader.writeUInt16LE(0, 34);
  centralHeader.writeUInt16LE(0, 36);
  centralHeader.writeUInt32LE(32, 38);
  centralHeader.writeUInt32LE(0, 42);
  total += writeXorBufferToFdSync(centralHeader, outFd, key, total);
  total += writeXorBufferToFdSync(nameBuffer, outFd, key, total);
  total += writeXorBufferToFdSync(zip64Extra, outFd, key, total);
  const centralDirSize = total - centralDirOffset;
  const zip64EocdOffset = total;
  const zip64Eocd = Buffer.alloc(56);
  zip64Eocd.writeUInt32LE(101075792, 0);
  zip64Eocd.writeBigUInt64LE(BigInt(44), 4);
  zip64Eocd.writeUInt16LE(45, 12);
  zip64Eocd.writeUInt16LE(45, 14);
  zip64Eocd.writeUInt32LE(0, 16);
  zip64Eocd.writeUInt32LE(0, 20);
  zip64Eocd.writeBigUInt64LE(BigInt(1), 24);
  zip64Eocd.writeBigUInt64LE(BigInt(1), 32);
  zip64Eocd.writeBigUInt64LE(BigInt(centralDirSize), 40);
  zip64Eocd.writeBigUInt64LE(BigInt(centralDirOffset), 48);
  total += writeXorBufferToFdSync(zip64Eocd, outFd, key, total);
  const zip64Locator = Buffer.alloc(20);
  zip64Locator.writeUInt32LE(117853008, 0);
  zip64Locator.writeUInt32LE(0, 4);
  zip64Locator.writeBigUInt64LE(BigInt(zip64EocdOffset), 8);
  zip64Locator.writeUInt32LE(1, 16);
  total += writeXorBufferToFdSync(zip64Locator, outFd, key, total);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(101010256, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(Math.min(centralDirSize, 4294967295), 12);
  eocd.writeUInt32LE(centralDirOffset > 4294967295 ? 4294967295 : centralDirOffset, 16);
  eocd.writeUInt16LE(0, 20);
  total += writeXorBufferToFdSync(eocd, outFd, key, total);
  return total;
}
function getDirectoryStatsSync(dirPath) {
  const stack = [dirPath];
  let size = 0;
  let files = 0;
  while (stack.length) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(current, {
        withFileTypes: true
      });
    } catch (_) {
      continue;
    }
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      try {
        if (entry.isDirectory()) {
          stack.push(fullPath);
        } else if (entry.isFile()) {
          const stat = fs.statSync(fullPath);
          size += stat.size;
          files += 1;
        }
      } catch (_) {}
    }
  }
  return {
    size,
    files
  };
}
function getMp4FilesFromDir(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  return fs.readdirSync(dirPath).filter(fileName => fileName.toLowerCase().endsWith(".mp4")).map(fileName => path.join(dirPath, fileName));
}
function pickExportEncryptVideo(modStats) {
  const useLongVideo = (modStats?.size || 0) >= EXPORT_ENCRYPT_LONG_VIDEO_THRESHOLD;
  const preferredDir = useLongVideo ? EXPORT_ENCRYPT_LONG_VIDEO_DIR : EXPORT_ENCRYPT_VIDEO_DIR;
  let videos = getMp4FilesFromDir(preferredDir);
  let selectedDir = preferredDir;
  if (!videos.length && useLongVideo) {
    videos = getMp4FilesFromDir(EXPORT_ENCRYPT_VIDEO_DIR);
    selectedDir = EXPORT_ENCRYPT_VIDEO_DIR;
  }
  if (!videos.length) return {
    videoPath: null,
    useLongVideo,
    selectedDir: null
  };
  return {
    videoPath: videos[Math.floor(Math.random() * videos.length)],
    useLongVideo,
    selectedDir
  };
}
function run7zSync(sevenZipPath, args, timeout = 30 * 60 * 1e3, cwd = void 0) {
  try {
    child_process.execFileSync(sevenZipPath, args, {
      cwd,
      timeout,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"]
    });
  } catch (error) {
    const stderr = error.stderr ? iconv.decode(error.stderr, "gbk").trim() : "";
    const stdout = error.stdout ? iconv.decode(error.stdout, "gbk").trim() : "";
    throw new Error(i18n.t("backend.archives.disguised.archiveCreationFailed", {
      stderr: stderr || stdout || error.message
    }));
  }
}
function getEncryptedExportArchiveSource(modPath) {
  const baseName = path.basename(modPath);
  if (baseName.toLowerCase() === "mods") {
    return {
      cwd: path.dirname(modPath),
      include: baseName,
      preserveRoot: true
    };
  }
  return {
    cwd: modPath,
    include: "*",
    preserveRoot: false
  };
}
function isDisguisedMp4(filePath) {
  try {
    if (findDisguiseMagic(filePath) >= 0) return true;
    try {
      const zip = new AdmZip(filePath);
      const entries = zip.getEntries();
      if (entries.some(e => e.entryName.endsWith(".7z"))) return true;
    } catch (_) {}
    try {
      const sevenZipPath = archivesZip.get7zaPath();
      const output = child_process.execFileSync(sevenZipPath, ["l", "-slt", filePath], {
        timeout: 1e4,
        encoding: "utf-8",
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"]
      });
      // Only archive entries count; the listing header contains the input filename.
      return parse7zSltPaths(output).some(entry => entry.endsWith(".7z"));
    } catch (_) {
      return false;
    }
  } catch (_) {
    return false;
  }
}
function peekDisguisedModName(filePath) {
  try {
    const sevenZipPath = archivesZip.get7zaPath();
    const {
      execSync
    } = require("child_process");
    let workFile = filePath;
    let tmpXorZip = null;
    let tmpDir = null;
    const magicOff = findDisguiseMagic(filePath);
    if (magicOff >= 0) {
      const storedEntryName = peekStoredOuterZipEntryNameFromDisguise(filePath);
      if (storedEntryName?.toLowerCase().endsWith(".7z")) {
        return path.basename(storedEntryName).replace(/\.7z$/i, "");
      }
      tmpDir = archivesTemp.ensureTempRootNearPath(filePath, `.qaqm-peek-${Date.now()}`);
      tmpXorZip = decodeV2ToTempZip(filePath, tmpDir);
      if (!tmpXorZip) return null;
      workFile = tmpXorZip;
    }
    const outerOutput = execSync(`"${sevenZipPath}" l "${workFile}"`, {
      timeout: 1e4,
      encoding: "utf-8",
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"]
    });
    if (!tmpDir) tmpDir = archivesTemp.ensureTempRootNearPath(filePath, `.qaqm-peek-${Date.now()}`);
    try {
      execSync(`"${sevenZipPath}" x "${workFile}" -o"${tmpDir}" -y -aoa`, {
        timeout: 15e3,
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"]
      });
      const files = fs.readdirSync(tmpDir);
      const sevenzFile = files.find(f => f.endsWith(".7z"));
      if (!sevenzFile) return null;
      const sevenzPath = path.join(tmpDir, sevenzFile);
      const innerOutput = execSync(`"${sevenZipPath}" l "${sevenzPath}" -p${DISGUISE_PASSWORD}`, {
        timeout: 1e4,
        encoding: "utf-8",
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"]
      });
      const zipMatch = innerOutput.match(/(\S+\.zip)\s*$/m);
      if (zipMatch) {
        const realName = zipMatch[1].replace(/\.zip$/i, "");
        coreLogger.logger.info(`[Disguise] Peeked real mod name: "${realName}" from ${path.basename(filePath)}`);
        return realName;
      }
    } finally {
      if (tmpDir) try {
        fs.rmSync(tmpDir, {
          recursive: true,
          force: true
        });
      } catch (_) {}
      if (tmpXorZip) try {
        fs.unlinkSync(tmpXorZip);
      } catch (_) {}
    }
  } catch (e) {
    coreLogger.logger.warn(`[Disguise] peekDisguisedModName failed: ${e.message}`);
  }
  return null;
}
async function extractDisguisedMp4(mp4Path, targetPath, {
  onProgress = null
} = {}) {
  const sevenZipPath = archivesZip.get7zaPath();
  coreLogger.logger.info(`[Disguise] Extracting disguised MP4: ${mp4Path}`);
  emitDisguiseProgress(onProgress, {
    status: "running",
    stage: "prepare",
    message: i18n.t("backend.archives.disguised.preparingDecodeCache")
  });
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, {
      recursive: true
    });
  }
  const tmpDir = archivesTemp.ensureTempRootNearPath(targetPath, `.qaqm-disguise-${Date.now()}`);
  let workFile = mp4Path;
  let tmpXorZip = null;
  let sevenzPath = null;
  let sevenzName = null;
  const magicOff = findDisguiseMagic(mp4Path);
  if (magicOff >= 0) {
    coreLogger.logger.info(`[Disguise] Detected v2 XOR format (magic at offset ${magicOff}), decoding...`);
    emitDisguiseProgress(onProgress, {
      status: "running",
      stage: "detect",
      message: i18n.t("backend.archives.disguised.readingOuterArchive")
    });
    const directOuterEntry = await tryExtractStoredOuterZipEntryFromDisguiseAsync(mp4Path, tmpDir, onProgress);
    if (directOuterEntry) {
      sevenzPath = directOuterEntry.sevenzPath;
      sevenzName = directOuterEntry.sevenzName;
      coreLogger.logger.info(`[Disguise] Extracted outer ZIP entry directly: ${sevenzPath}`);
    } else {
      tmpXorZip = await decodeV2ToTempZipAsync(mp4Path, tmpDir, onProgress);
      if (!tmpXorZip) throw new Error(i18n.t("backend.archives.disguised.xorDecodeFailed"));
      workFile = tmpXorZip;
      coreLogger.logger.info(`[Disguise] XOR decoded to: ${tmpXorZip}`);
    }
  }
  try {
    if (!sevenzPath) {
      coreLogger.logger.info("[Disguise] Step 1: Extract outer ZIP layer with 7z");
      emitDisguiseProgress(onProgress, {
        status: "running",
        stage: "extract-outer",
        message: i18n.t("backend.archives.disguised.extractingOuterArchive")
      });
      const outerArgs = ["x", workFile, `-o${tmpDir}`, "-y", "-aoa"];
      const outerResult = await archivesExtract.spawnExtract(sevenZipPath, outerArgs);
      if (outerResult.code !== 0) {
        if (archivesTemp.isDiskSpaceError(outerResult)) {
          throw new Error(i18n.t("backend.archives.disguised.outerArchiveDiskFull", {
            code: outerResult.code
          }));
        }
        if (magicOff >= 0) {
          coreLogger.logger.info("[Disguise] Outer ZIP layer not found, trying direct encrypted 7z payload");
          sevenzPath = workFile;
          sevenzName = path.basename(workFile);
        } else {
          coreLogger.logger.info("[Disguise] 7z failed for outer layer, trying AdmZip fallback");
          try {
            const outerZip = new AdmZip(workFile);
            outerZip.extractAllTo(tmpDir, true);
          } catch (admErr) {
            throw new Error(i18n.t("backend.archives.disguised.outerArchiveExtractionFailed", {
              code: outerResult.code,
              reason: admErr.message
            }));
          }
        }
      } else if (tmpXorZip) {
        try {
          fs.unlinkSync(tmpXorZip);
        } catch (_) {}
        tmpXorZip = null;
      }
    }
    if (!sevenzPath) {
      const tmpFiles = fs.readdirSync(tmpDir);
      sevenzName = tmpFiles.find(f => f.endsWith(".7z"));
      if (!sevenzName) {
        throw new Error(i18n.t("backend.archives.disguised.innerArchiveMissing", {
          path: tmpFiles.join(", ")
        }));
      }
      sevenzPath = path.join(tmpDir, sevenzName);
    }
    coreLogger.logger.info(`[Disguise] Found encrypted: ${sevenzName}`);
    emitDisguiseProgress(onProgress, {
      status: "running",
      stage: "list-inner",
      message: i18n.t("backend.archives.disguised.inspectingEncryptedArchive")
    });
    const listResult = await archivesExtract.spawnExtract(sevenZipPath, ["l", "-slt", sevenzPath, `-p${DISGUISE_PASSWORD}`]);
    if (listResult.code !== 0) {
      throw new Error(i18n.t("backend.archives.disguised.archiveListingFailed", {
        code: listResult.code,
        stderr: listResult.stderr || listResult.stdout
      }));
    }
    const listedPaths = parse7zSltPaths(listResult.stdout);
    const innerZipPathInArchive = listedPaths.find(f => f.toLowerCase().endsWith(".zip"));
    const innerDir = innerZipPathInArchive ? path.join(tmpDir, "_inner") : targetPath;
    fs.mkdirSync(innerDir, {
      recursive: true
    });
    coreLogger.logger.info("[Disguise] Step 2: Decrypt 7z with password");
    emitDisguiseProgress(onProgress, {
      status: "running",
      stage: "decrypt-7z",
      message: i18n.t("backend.archives.disguised.decryptingArchive")
    });
    const args7z = ["x", sevenzPath, `-o${innerDir}`, `-p${DISGUISE_PASSWORD}`, "-y", "-aoa"];
    const result7z = await archivesExtract.spawnExtract(sevenZipPath, args7z);
    if (result7z.code !== 0) {
      throw new Error(i18n.t("backend.archives.disguised.archiveDecryptionFailed", {
        code: result7z.code,
        stderr: result7z.stderr || result7z.stdout
      }));
    }
    if (!innerZipPathInArchive) {
      coreLogger.logger.info("[Disguise] Step 3: No inner ZIP, extracted files directly");
      archivesExtract.flattenSingleSubfolder(targetPath);
      emitDisguiseProgress(onProgress, {
        status: "running",
        stage: "detect-package",
        message: i18n.t("backend.archives.disguised.detectingIntegratedPackage")
      });
      const fileCount2 = fs.readdirSync(targetPath).length;
      coreLogger.logger.info(`[Disguise] Extraction complete: ${fileCount2} items in ${targetPath}`);
      systemFiles.assertDirectoryHasAnyFile(targetPath, "Disguised mod");
      emitDisguiseProgress(onProgress, {
        status: "done",
        stage: "done",
        message: i18n.t("backend.archives.disguised.decryptionComplete")
      });
      return null;
    }
    const innerFiles = fs.readdirSync(innerDir);
    const innerZipName = innerFiles.find(f => f.endsWith(".zip"));
    if (innerZipName) {
      coreLogger.logger.info(`[Disguise] Step 3: Extract inner ZIP: ${innerZipName}`);
      emitDisguiseProgress(onProgress, {
        status: "running",
        stage: "extract-inner",
        message: i18n.t("backend.archives.disguised.extractingInnerArchive", {
          innerZipName
        })
      });
      const innerZipPath = path.join(innerDir, innerZipName);
      const innerArgs = ["x", innerZipPath, `-o${targetPath}`, "-y", "-aoa"];
      const innerResult = await archivesExtract.spawnExtract(sevenZipPath, innerArgs);
      if (innerResult.code !== 0) {
        try {
          const innerZip = new AdmZip(innerZipPath);
          innerZip.extractAllTo(targetPath, true);
        } catch (e) {
          throw new Error(i18n.t("backend.archives.disguised.innerArchiveExtractionFailed", {
            reason: e.message
          }));
        }
      }
    } else {
      coreLogger.logger.info("[Disguise] Step 3: No inner ZIP, copying files directly");
      for (const item of innerFiles) {
        const src = path.join(innerDir, item);
        const dest = path.join(targetPath, item);
        if (fs.statSync(src).isDirectory()) {
          fs.cpSync(src, dest, {
            recursive: true
          });
        } else {
          fs.copyFileSync(src, dest);
        }
      }
    }
    archivesExtract.flattenSingleSubfolder(targetPath);
    emitDisguiseProgress(onProgress, {
      status: "running",
      stage: "detect-package",
      message: i18n.t("backend.archives.disguised.detectingIntegratedPackage")
    });
    const fileCount = fs.readdirSync(targetPath).length;
    coreLogger.logger.info(`[Disguise] Extraction complete: ${fileCount} items in ${targetPath}`);
    systemFiles.assertDirectoryHasAnyFile(targetPath, "Disguised mod");
    emitDisguiseProgress(onProgress, {
      status: "done",
      stage: "done",
      message: i18n.t("backend.archives.disguised.decryptionComplete")
    });
    return innerZipName ? innerZipName.replace(/\.zip$/i, "") : null;
  } finally {
    try {
      fs.rmSync(tmpDir, {
        recursive: true,
        force: true
      });
    } catch (_) {}
    if (tmpXorZip) try {
      fs.unlinkSync(tmpXorZip);
    } catch (_) {}
  }
}
Object.assign(module.exports, {
  DISGUISE_PASSWORD,
  DISGUISE_XOR_KEY,
  DISGUISE_MAGIC,
  EXPORT_ENCRYPT_DIRECT_7Z_THRESHOLD
});
