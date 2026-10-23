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
module.exports = {
  getIniFiles
};
