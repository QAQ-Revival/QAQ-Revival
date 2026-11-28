"use strict";

const path = require("path");
const fs = require("fs");
function getIniFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir, {
    withFileTypes: true
  });
  files.forEach(entry => {
    const filePath = path.join(dir, entry.name);
    const isDirectory = entry.isDirectory() || entry.isSymbolicLink() && fs.statSync(filePath).isDirectory();
    if (isDirectory) {
      getIniFiles(filePath, fileList);
    } else {
      if (path.extname(entry.name).toLowerCase() === ".ini") {
        fileList.push(filePath);
      }
    }
  });
  return fileList;
}
async function getIniFilesAsync(dir, fileList = []) {
  const files = await fs.promises.readdir(dir, {
    withFileTypes: true
  });
  for (const entry of files) {
    const filePath = path.join(dir, entry.name);
    let isDirectory = entry.isDirectory();
    if (!isDirectory && entry.isSymbolicLink()) {
      try {
        isDirectory = (await fs.promises.stat(filePath)).isDirectory();
      } catch (_) {
        isDirectory = false;
      }
    }
    if (isDirectory) {
      await getIniFilesAsync(filePath, fileList);
    } else if (path.extname(entry.name).toLowerCase() === ".ini") {
      fileList.push(filePath);
    }
  }
  return fileList;
}
module.exports = {
  getIniFiles,
  getIniFilesAsync
};
