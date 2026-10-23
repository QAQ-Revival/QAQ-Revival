"use strict";

const i18n = require("../../shared/i18n/core.cjs");
const path = require("path");
const fs = require("fs");
const child_process = require("child_process");
const {
  createWindowsLauncher
} = require("./launch.cjs");
const coreLogger = require("../core/logger.cjs");
const windowsLauncher = createWindowsLauncher({
  isElevated: isProcessElevated
});
function isProcessElevated() {
  if (process.platform !== "win32") return false;
  try {
    child_process.execFileSync("fltmc.exe", [], {
      stdio: "ignore",
      timeout: 1500,
      windowsHide: true
    });
    return true;
  } catch (_) {
    return false;
  }
}
function isWindowsProtectedPath(targetPath) {
  if (process.platform !== "win32" || !targetPath) return false;
  const normalized = path.resolve(targetPath).toLowerCase();
  const protectedRoots = [process.env.ProgramFiles, process.env["ProgramFiles(x86)"], process.env.ProgramW6432, process.env.SystemRoot].filter(Boolean).map(item => path.resolve(item).toLowerCase());
  return protectedRoots.some(root => normalized === root || normalized.startsWith(root + path.sep));
}
function formatWindowsFileOperationError(error, context = {}) {
  const message = String(error?.message || error || "");
  const code = error?.code || "";
  const syscall = error?.syscall || context.operation || "";
  const targetPath = error?.path || context.path || "";
  const protectedPath = isWindowsProtectedPath(targetPath);
  const targetSuffix = targetPath ? i18n.t("backend.system.windows.targetPathDetail", {
    targetPath
  }) : "";
  if (["EPERM", "EACCES"].includes(code) || /operation not permitted|permission denied/i.test(message)) {
    const advice = protectedPath ? i18n.t("backend.system.windows.protectedPathAdvice") : i18n.t("backend.system.windows.permissionAdvice");
    return i18n.t("backend.system.windows.writeDenied", {
      code: code || i18n.t("backend.system.windows.permissionDenied"),
      syscall: syscall || i18n.t("backend.system.windows.fileOperation"),
      advice,
      targetSuffix
    });
  }
  if (code === "EBUSY" || /resource busy|locked|being used by another process/i.test(message)) {
    return i18n.t("backend.system.windows.fileBusy", {
      targetSuffix
    });
  }
  if (code === "EXDEV") {
    return i18n.t("backend.system.windows.crossDeviceMove", {
      targetSuffix
    });
  }
  return message;
}
function probeWritableDirectory(targetDir, label = i18n.t("backend.validation.targetDirectory")) {
  if (!targetDir) throw new Error(i18n.t("backend.system.windows.emptyWritePath", {
    label
  }));
  try {
    fs.mkdirSync(targetDir, {
      recursive: true
    });
    const probePath = path.join(targetDir, `.qaqm-write-test-${process.pid}-${Date.now()}`);
    fs.writeFileSync(probePath, "ok");
    fs.unlinkSync(probePath);
  } catch (error) {
    throw new Error(i18n.t("backend.system.windows.pathNotWritable", {
      label,
      windowsFileOperationError: formatWindowsFileOperationError(error, {
        path: targetDir,
        operation: "write-test"
      })
    }));
  }
}
function runPowershell(script) {
  return new Promise((resolve, reject) => {
    const encoded = Buffer.from(script, "utf16le").toString("base64");
    child_process.exec(`powershell -NoProfile -NonInteractive -EncodedCommand ${encoded}`, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr?.trim() || stdout?.trim() || error.message));
        return;
      }
      resolve({
        stdout,
        stderr
      });
    });
  });
}
function isWindowsProcessRunning(imageName) {
  return new Promise(resolve => {
    child_process.exec(`tasklist /FI "IMAGENAME eq ${imageName}" /FO CSV /NH`, {
      windowsHide: true
    }, (_error, stdout) => {
      resolve(String(stdout || "").toLowerCase().includes(imageName.toLowerCase()));
    });
  });
}
async function waitForWindowsProcess(imageName, timeoutMs = 3e4, intervalMs = 500) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await isWindowsProcessRunning(imageName)) return true;
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  return false;
}
function parseLaunchArgs(argsText) {
  return String(argsText || "").match(/"[^"]*"|'[^']*'|\S+/g)?.map(arg => arg.replace(/^["']|["']$/g, "")) || [];
}
function quoteWindowsCommandArg(arg) {
  return `"${String(arg).replace(/"/g, '\\"')}"`;
}
function launchWindowsExecutableViaStart(executablePath, args = []) {
  const cwd = path.dirname(executablePath);
  const commandArgs = args.length ? ` ${args.map(quoteWindowsCommandArg).join(" ")}` : "";
  return child_process.exec(`start "" /D "${cwd}" "${executablePath}"${commandArgs}`, error => {
    if (error) coreLogger.logger.error("Failed to launch executable via start:", error);
  });
}
function launchElevated(executablePath, workingDir, args = []) {
  return windowsLauncher.launch(executablePath, workingDir, args);
}
module.exports = {
  isProcessElevated,
  formatWindowsFileOperationError,
  probeWritableDirectory,
  isWindowsProcessRunning,
  waitForWindowsProcess,
  parseLaunchArgs,
  launchWindowsExecutableViaStart,
  launchElevated,
  windowsLauncher
};
