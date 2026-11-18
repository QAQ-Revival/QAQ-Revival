"use strict";

const { execFile } = require("node:child_process");
const path = require("node:path");
const KEY = "HKCU\\Software\\Microsoft\\DirectX\\UserGpuPreferences";
function autoHdrAllowed(preference, fallback = false) {
  const match = /(?:^|;)\s*AutoHDREnable=(\d+)\s*(?:;|$)/i.exec(preference || "");
  return match ? Number(match[1]) % 2 === 1 : fallback;
}
function withAutoHdr(preference, enabled) {
  const original = String(preference || "");
  const match = /(?:^|;)\s*AutoHDREnable=(\d+)\s*(?:;|$)/i.exec(original);
  const flags = match && Number.isSafeInteger(Number(match[1])) ? Number(match[1]) : 2096;
  const fields = original.split(";").filter(field => field && !/^\s*AutoHDREnable=/i.test(field));
  fields.push(`AutoHDREnable=${flags - flags % 2 + Number(enabled)}`);
  return fields.join(";") + ";";
}
function createWindowsHdrPreferences({ run = (file, args) => new Promise((resolve, reject) => {
  execFile(file, args, { windowsHide: true, timeout: 10000, encoding: "utf8" }, (error, stdout) => error ? reject(error) : resolve(stdout));
}) } = {}) {
  const system = path.join(process.env.SystemRoot || "C:\\Windows", "System32");
  return {
    async read(gamePath) {
      const literal = value => "'" + value.replaceAll("'", "''") + "'";
      const script = `$ErrorActionPreference='Stop'; [Console]::OutputEncoding=[Text.UTF8Encoding]::new(); $key=[Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Software\\Microsoft\\DirectX\\UserGpuPreferences'); try { @{ app=if($key){$key.GetValue(${literal(gamePath)})}else{$null}; global=if($key){$key.GetValue('DirectXUserGlobalSettings')}else{$null} } | ConvertTo-Json -Compress } finally { if($key){$key.Dispose()} }`;
      return JSON.parse(await run(path.join(system, "WindowsPowerShell/v1.0/powershell.exe"), ["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")]));
    },
    async write(gamePath, value) {
      await run(path.join(system, "reg.exe"), value === null
        ? ["delete", KEY, "/v", gamePath, "/f"]
        : ["add", KEY, "/v", gamePath, "/t", "REG_SZ", "/d", value, "/f"]);
    }
  };
}
module.exports = { createWindowsHdrPreferences, autoHdrAllowed, withAutoHdr };
