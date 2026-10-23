"use strict";

const electron = require("electron");
const path = require("path");
const fs = require("fs");
const LOGS_DIR = path.join(electron.app.getPath("userData"), "logs");
function getLogFileName() {
  const now = new Date();
  const dateStr = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
  return `manager-${dateStr}.log`;
}
function formatMessage(level, message, ...args) {
  const timestamp = new Date().toISOString().replace("T", " ").split(".")[0];
  let formattedArgs = args.map(arg => {
    if (arg instanceof Error) return arg.stack || arg.message;
    if (typeof arg === "object") return JSON.stringify(arg);
    return String(arg);
  }).join(" ");
  if (formattedArgs) {
    return `[${timestamp}] [${level}] ${message} ${formattedArgs}`;
  }
  return `[${timestamp}] [${level}] ${message}`;
}
function writeToFile(text) {
  try {
    const filePath = path.join(LOGS_DIR, getLogFileName());
    fs.appendFileSync(filePath, text + "\n", "utf8");
  } catch (e) {
    console.error("Write log failed:", e);
  }
}
const logger = {
  info(message, ...args) {
    const text = formatMessage("INFO", message, ...args);
    console.log(text);
    writeToFile(text);
  },
  error(message, ...args) {
    const text = formatMessage("ERROR", message, ...args);
    console.error(text);
    writeToFile(text);
  },
  warn(message, ...args) {
    const text = formatMessage("WARN", message, ...args);
    console.warn(text);
    writeToFile(text);
  },
  getLogsPath() {
    return LOGS_DIR;
  }
};
function initialize() {
  if (!fs.existsSync(LOGS_DIR)) {
    try {
      fs.mkdirSync(LOGS_DIR, {
        recursive: true
      });
      console.log(`[Logger] Created logs directory at: ${LOGS_DIR}`);
    } catch (e) {
      console.error("[Logger] Failed to create logs directory:", e);
    }
  }
}
module.exports = {
  initialize,
  logger
};
