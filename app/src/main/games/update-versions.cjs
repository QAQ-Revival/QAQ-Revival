"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const HOYO = {
  "genshin-impact": { cn: "1Z8W5NHUQb", global: "gopR6Cufr3", biz: "hk4e" },
  "honkai-star-rail": { cn: "64kMb5iAWu", global: "4ziysqXOQ8", biz: "hkrpg" },
  zzz: { cn: "x6znKlJ0xK", global: "U5hbdsT9W7", biz: "nap" },
};
const WUWA = {
  cn: "https://prod-cn-alicdn-gamestarter.kurogame.com/launcher/game/10003_oLNgHF1CESo51DGHN2odtp40e3oI1HfZ/G152/official/index.json",
  bilibili: "https://prod-cn-alicdn-gamestarter.kurogame.com/launcher/game/10004_IY6xmlAusbImBjWrpPj1OwNuirXEO44x/G152/bilibili/index.json",
};
function version(value) {
  return typeof value === "string" && /^\d+(?:\.\d+){1,5}$/.test(value) && value.length < 64 ? value : "";
}
function compareVersions(left, right) {
  if (!version(left) || !version(right)) return null;
  const a = left.split(".").map(Number), b = right.split(".").map(Number);
  for (let index = 0; index < Math.max(a.length, b.length); index++) {
    if ((a[index] || 0) !== (b[index] || 0)) return (a[index] || 0) > (b[index] || 0) ? 1 : -1;
  }
  return 0;
}
function read(file, limit = 1024 * 1024) {
  try {
    const stat = fs.statSync(file);
    return stat.isFile() && stat.size <= limit ? fs.readFileSync(file) : null;
  } catch { return null; }
}
function json(file) {
  try { return JSON.parse(read(file)?.toString("utf8").replace(/^\uFEFF/, "") || "null"); } catch { return null; }
}
function ini(text, name) {
  return new RegExp(`^\\s*${name}\\s*=\\s*([^\\r\\n;]*)`, "mi").exec(text)?.[1].trim() || "";
}
function ancestors(file) {
  const result = [];
  for (let directory = path.dirname(file), depth = 0; depth < 6 && directory !== path.dirname(directory); depth++, directory = path.dirname(directory)) result.push(directory);
  return result;
}
function kuroIndex(game, directories, region) {
  const roots = [...new Set([...(game.officialLauncherPath ? ancestors(game.officialLauncherPath) : []), ...directories])];
  const candidates = [];
  for (const root of roots) {
    candidates.push(path.join(root, "Assets/KRApp.conf"));
    try {
      const versions = fs.readdirSync(root, { withFileTypes: true }).filter(item => item.isDirectory() && version(item.name))
        .map(item => item.name).sort((a, b) => compareVersions(b, a));
      candidates.push(...versions.map(name => path.join(root, name, "Assets/KRApp.conf")));
    } catch { /* Only the selected installation and its nearby launcher are inspected. */ }
  }
  for (const file of candidates) {
    try {
      // Public application metadata shipped with the launcher, not account data.
      const encoded = read(file)?.toString("utf8").trim();
      if (!encoded) continue;
      const bytes = Buffer.from(encoded, "base64");
      for (let index = 0; index < bytes.length; index++) bytes[index] ^= 0x63;
      const config = JSON.parse(bytes.toString("utf8"));
      for (const entry of config.games || []) {
        const channel = entry.gameId === "G153" && String(entry.resId) === "50004" ? "global"
          : entry.gameId === "G152" && String(entry.resId) === "10003" ? "cn"
          : entry.gameId === "G152" && String(entry.resId) === "10004" ? "bilibili" : "";
        if (!channel || (region && channel !== region)) continue;
        const url = new URL(entry.configUrl);
        // The old G152/10003_... path still returns HTTP 200 but is frozen at 3.7.1.
        if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash
          || !/^prod-(?:cn-)?(?:ali|vol)cdn-gamestarter\.kurogame\.(?:com|xyz)$/.test(url.hostname)
          || !new RegExp(`^/launcher/game/${entry.resId}_[A-Za-z0-9]+/${entry.gameId}/[A-Za-z0-9_-]+/index\\.json$`).test(url.pathname)) continue;
        return { source: url.href, region: channel };
      }
    } catch { /* Invalid or older launcher metadata does not supply a network destination. */ }
  }
  return null;
}
function localClient(game, selectedRegion = "auto") {
  const base = { id: "client", installed: "", region: "", manifestHash: "", state: "unconfigured" };
  if (!game?.gamePath || !fs.existsSync(game.gamePath)) return base;
  const directories = ancestors(game.gamePath);
  let root = directories[0], detected = "";
  base.state = "unknown";
  if (HOYO[game.id]) {
    const config = read(path.join(root, "config.ini"))?.toString("utf8") || "";
    base.installed = version(ini(config, "game_version"));
    const sdk = ["config.ini", "GenshinImpact_Data/Plugins/PCGameSDK/Config.ini", "YuanShen_Data/Plugins/PCGameSDK/Config.ini", "StarRail_Data/Plugins/PCGameSDK/Config.ini", "ZenlessZoneZero_Data/Plugins/PCGameSDK/Config.ini"]
      .map(file => read(path.join(root, file))?.toString("utf8") || "").join("\n");
    if (/\b(?:hk4e|hkrpg|nap)_cn\b/.test(sdk) || path.basename(game.gamePath).toLowerCase() === "yuanshen.exe") detected = "cn";
    else if (/\b(?:hk4e|hkrpg|nap)_(?:global|os)\b/.test(sdk) || path.basename(game.gamePath).toLowerCase() === "genshinimpact.exe") detected = "global";
    else if (/mihoyo launcher/i.test(root)) detected = "cn";
    else if (/hoyoplay/i.test(root)) detected = "global";
    // Channel packages can differ from the official mainland client.
    if (ini(config, "channel") === "14") detected = "bilibili";
  } else if (game.id === "wuthering-waves") {
    root = directories.find(directory => fs.existsSync(path.join(directory, "launcherDownloadConfig.json"))) || root;
    const config = json(path.join(root, "launcherDownloadConfig.json"));
    detected = String(config?.appId) === "10003" ? "cn" : String(config?.appId) === "10004" ? "bilibili" : String(config?.appId) === "50004" ? "global" : "";
    const common = json(path.join(root, "launcherDownloadConfig/common.json"));
    const bundleVersions = Object.values(config?.bundles || {}).map(bundle => version(bundle.version)).filter(Boolean);
    // New launchers leave the top-level version at the base install. The common pack is authoritative.
    base.installed = version(common?.version) || (bundleVersions.length && bundleVersions.every(item => item === bundleVersions[0]) ? bundleVersions[0] : "") || version(config?.version);
    if (config?.state || common?.state || Object.values(config?.bundles || {}).some(bundle => bundle.state)) base.state = "incomplete";
    const index = kuroIndex(game, directories, selectedRegion === "auto" ? detected : selectedRegion);
    if (index) { base.source = index.source; detected ||= index.region; }
  } else if (["endfield", "arknights"].includes(game.id)) {
    const config = read(path.join(root, "config.ini"))?.toString("utf8") || "";
    base.installed = version(ini(config, "game_version"));
    const manifest = read(path.join(root, "game_files"), 16 * 1024 * 1024);
    // A 16-byte encrypted empty manifest carries no installed-version evidence (Arknights).
    if (manifest?.length > 16) base.manifestHash = crypto.createHash("md5").update(manifest).digest("hex");
    if (ini(config, "channel") === "2") detected = "bilibili";
    else if (/gryphlink|gryphline/i.test(`${root} ${game.officialLauncherPath || ""}`)) detected = "global";
    else if (game.id === "arknights" || /hypergryph/i.test(`${root} ${game.officialLauncherPath || ""}`)) detected = "cn";
  } else {
    return { ...base, state: "unsupported" };
  }
  base.region = selectedRegion === "auto" ? detected : selectedRegion;
  if (!base.region) base.state = "regionRequired";
  return base;
}
async function fetchJson(fetchImpl, url, options = {}) {
  const response = await fetchImpl(url, { ...options, headers: { Accept: "application/json", ...options.headers }, signal: AbortSignal.timeout(15000), credentials: "omit", redirect: "error", cache: "no-store" });
  if (!response.ok) throw Error(`HTTP ${response.status}`);
  if (Number(response.headers?.get("content-length")) > 2 * 1024 * 1024) throw Error("Version response is too large");
  const text = await response.text();
  if (Buffer.byteLength(text) > 2 * 1024 * 1024) throw Error("Version response is too large");
  return JSON.parse(text);
}
async function checkClient(game, local, fetchImpl = globalThis.fetch) {
  const result = { ...local, latest: "", preDownload: "", updateAvailable: false, error: "", source: "" };
  if (["unconfigured", "unsupported", "regionRequired", "incomplete"].includes(local.state)) return result;
  try {
    let latest, preload, manifestHash;
    if (HOYO[game.id] && ["cn", "global"].includes(local.region)) {
      const host = local.region === "cn" ? "hyp-api.mihoyo.com" : "sg-hyp-api.hoyoverse.com";
      const launcher = local.region === "cn" ? "jGHBHlcOq1" : "VYTpXlbWo8";
      const id = HOYO[game.id][local.region];
      // HoYoPlay moved to Sophon branches; getGamePackages can still return obsolete versions.
      result.source = `https://${host}/hyp/hyp-connect/api/getGameBranches?launcher_id=${launcher}&game_ids%5B%5D=${id}`;
      const response = await fetchJson(fetchImpl, result.source);
      if (response.retcode !== 0) throw Error("Invalid HoYoPlay response");
      const entry = response.data?.game_branches?.find(item => item.game?.id === id);
      latest = entry?.main?.tag;
      preload = entry?.pre_download?.tag;
    } else if (game.id === "wuthering-waves" && (local.source || WUWA[local.region])) {
      result.source = local.source || WUWA[local.region];
      const response = await fetchJson(fetchImpl, result.source);
      latest = response.resourcePacks?.common?.version || response.default?.version;
      preload = response.predownload?.resourcePacks?.common?.version || response.predownload?.version;
    } else if (["endfield", "arknights"].includes(game.id) && !(game.id === "arknights" && local.region === "global")) {
      const global = local.region === "global", channel = global ? "6" : local.region === "bilibili" ? "2" : "1";
      const appcode = game.id === "arknights" ? "GzD1CpaWgmSq1wew" : global ? "YDUTE5gscDZ229CW" : "6LL0KJuqHBVz33WK";
      result.source = `https://launcher.${global ? "gryphline" : "hypergryph"}.com/api/proxy/batch_proxy`;
      const response = await fetchJson(fetchImpl, result.source, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ proxy_reqs: [{ kind: "get_latest_game", get_latest_game_req: { appcode, channel, sub_channel: channel, version: "", launcher_appcode: "" } }] }) });
      const entry = response.proxy_rsps?.[0]?.get_latest_game_rsp;
      latest = entry?.version;
      manifestHash = entry?.pkg?.game_files_md5;
    } else return { ...result, state: "unsupported" };
    result.latest = version(latest);
    result.preDownload = version(preload);
    if (!result.latest) throw Error("No valid release version in the official response");
    if (local.manifestHash && /^[a-f\d]{32}$/i.test(manifestHash || "")) {
      if (local.manifestHash === manifestHash.toLowerCase()) result.installed = result.latest;
      // A different manifest can also be a repaired or newer install; never claim it proves an update.
      else if (!result.installed) return { ...result, state: "verify" };
    }
    const order = compareVersions(result.latest, result.installed);
    result.state = order === null ? "unknown" : order > 0 ? "available" : order < 0 ? "ahead" : "current";
    result.updateAvailable = order !== null && order > 0;
  } catch (error) {
    result.state = "error";
    result.error = error.name === "TimeoutError" ? "timeout" : "connection";
  }
  return result;
}
module.exports = { compareVersions, localClient, checkClient, version };
