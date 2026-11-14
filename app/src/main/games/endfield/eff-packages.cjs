"use strict";

const i18n = require("../../../shared/i18n/core.cjs");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const AdmZip = require("adm-zip");
const { readJsonFileSync, writeJsonFileSync } = require("../../core/json-store.cjs");
const REPOSITORY = "ssice-a/EFF";
const MAX_ZIP = 32 * 1024 * 1024;
const MAX_ENTRY = 16 * 1024 * 1024;
// The release this version of QAQR was checked against, by the digest GitHub publishes for its asset.
const PINNED = { version: "2.0.12", sha256: "8882de2a9bbd4085571e9cf152765d1bf1b4e1a750f284fc92bb946285167dfc" };
// What a release puts in the game directory. plugin/eff.ini is the player's and only written when missing.
const PROXIES = ["d3dcompiler_47.dll", "vulkan-1.dll"];
const PLUGIN_FILES = ["plugin/eff.dll", "plugin/package-protocol.json", "plugin/LICENSE", "plugin/THIRD_PARTY_NOTICES"];
const SETTINGS_FILE = "plugin/eff.ini";
const REQUIRED = ["plugin/eff.dll", "plugin/package-protocol.json", ...PROXIES];
// Both proxies of EFF (and of ApplePie Manager, whose loader it shares) read this file before loading plugin\*.dll.
const PROXY_MARK = Buffer.from("plugin\\applepie_manager_config.txt", "latin1");
const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const zipName = version => `EFF_v${version}_dll.zip`;
const number = version => /^(\d+)\.(\d+)\.(\d+)$/.exec(version || "")?.slice(1).map(Number) || null;
function newer(a, b) {
  const left = number(a), right = number(b);
  if (!left || !right) return false;
  for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return left[i] > right[i];
  return false;
}
function validate(info) {
  if (!info || !number(info.version) || !/^[a-f0-9]{64}$/.test(info.sha256 || "")) throw Error(i18n.t("backend.eff.invalidRelease"));
  return { version: info.version, sha256: info.sha256 };
}
// Only the files EFF documents for the game directory are taken; anything else in the archive is ignored.
function readPackage(bytes) {
  let entries;
  try {
    entries = new AdmZip(bytes).getEntries();
  } catch {
    throw Error(i18n.t("backend.eff.invalidPackage"));
  }
  const wanted = new Set([...PROXIES, ...PLUGIN_FILES, SETTINGS_FILE]);
  const files = new Map();
  for (const entry of entries) {
    const name = entry.entryName.replace(/\\/g, "/");
    if (entry.isDirectory || !wanted.has(name)) continue;
    if (entry.header.size > MAX_ENTRY) throw Error(i18n.t("backend.eff.invalidPackage"));
    files.set(name, entry.getData());
  }
  if (REQUIRED.some(name => !files.has(name)) || PROXIES.some(name => !files.get(name).includes(PROXY_MARK))) throw Error(i18n.t("backend.eff.invalidPackage"));
  return files;
}
function releaseInfo(release) {
  if (!release || release.draft || !/^v\d+\.\d+\.\d+$/.test(release.tag_name || "")) return null;
  const version = release.tag_name.slice(1);
  const asset = (release.assets || []).find(item => item?.name === zipName(version));
  const sha256 = asset?.digest?.replace(/^sha256:/, "").toLowerCase();
  if (!sha256 || asset.size > MAX_ZIP) return null;
  return validate({ version, sha256 });
}
// The REST API allows 60 anonymous requests an hour per address; the release page lists the same digests without that limit.
async function releasePage(fetchImpl, signal) {
  async function text(url) {
    const response = await fetchImpl(url, { signal, headers: { Accept: "text/html" } });
    if (!response.ok) throw Error(i18n.t("backend.eff.updateCheckFailed", { status: response.status }));
    return await response.text();
  }
  const tag = /\/releases\/expanded_assets\/(v\d+\.\d+\.\d+)["']/.exec(await text(`https://github.com/${REPOSITORY}/releases`))?.[1];
  if (!tag) throw Error(i18n.t("backend.eff.invalidRelease"));
  const name = zipName(tag.slice(1));
  for (const [, row] of (await text(`https://github.com/${REPOSITORY}/releases/expanded_assets/${tag}`)).matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) {
    const digest = /sha256:([a-f0-9]{64})/i.exec(row)?.[1];
    if (digest && row.includes(`/${REPOSITORY}/releases/download/${tag}/${name}`)) return validate({ version: tag.slice(1), sha256: digest.toLowerCase() });
  }
  throw Error(i18n.t("backend.eff.invalidRelease"));
}
function createEffPackages({ cacheDir, fetch: fetchImpl }) {
  const catalogFile = path.join(cacheDir, "versions.json");
  let catalog = { selected: null, available: null, error: null, checkedAt: null };
  try {
    const saved = readJsonFileSync(catalogFile);
    if (saved.selected) catalog.selected = validate(saved.selected);
    if (saved.available) catalog.available = validate(saved.available);
    catalog.checkedAt = saved.checkedAt || null;
  } catch (error) {
    if (error.code !== "ENOENT") catalog.error = i18n.t("backend.eff.storageReadFailed");
  }
  const selected = () => catalog.selected || PINNED;
  async function download(url, limit, timeout = 120000) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetchImpl(url, { signal: controller.signal });
      if (!response.ok) throw Error(i18n.t("backend.eff.downloadFailed", { status: response.status }));
      const chunks = [];
      let size = 0;
      for await (const chunk of response.body) {
        size += chunk.length;
        if (size > limit) throw Error(i18n.t("backend.eff.downloadFailed", { status: "size" }));
        chunks.push(Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    } finally {
      clearTimeout(timer);
    }
  }
  // The archive is held against its published digest, from the cache first, before its files are read.
  async function ensure(info = selected()) {
    const { version, sha256 } = validate(info);
    const file = path.join(cacheDir, version, zipName(version));
    let bytes = fs.existsSync(file) ? fs.readFileSync(file) : null;
    if (!bytes || hash(bytes) !== sha256) {
      bytes = await download(`https://github.com/${REPOSITORY}/releases/download/v${version}/${zipName(version)}`, MAX_ZIP);
      if (hash(bytes) !== sha256) throw Error(i18n.t("backend.eff.checksumFailed", { name: zipName(version) }));
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, bytes);
    }
    return readPackage(bytes);
  }
  async function checkUpdates() {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 20000);
    const next = structuredClone(catalog);
    next.error = null;
    next.checkedAt = new Date().toISOString();
    try {
      let found = null;
      try {
        // /releases/latest skips pre-releases, which QAQR takes as soon as they are out.
        const response = await fetchImpl(`https://api.github.com/repos/${REPOSITORY}/releases?per_page=10`, {
          signal: controller.signal,
          headers: { Accept: "application/vnd.github+json" }
        });
        if (!response.ok) throw Error(i18n.t("backend.eff.updateCheckFailed", { status: response.status }));
        const releases = await response.json();
        for (const release of Array.isArray(releases) ? releases : []) if ((found = releaseInfo(release))) break;
        if (!found) throw Error(i18n.t("backend.eff.invalidRelease"));
      } catch {
        found = await releasePage(fetchImpl, controller.signal);
      }
      next.available = found;
    } catch (error) {
      next.error = error.message;
      next.available = null;
    } finally {
      clearTimeout(timer);
    }
    writeJsonFileSync(catalogFile, next);
    catalog = next;
    return state();
  }
  function commit(info) {
    const next = structuredClone(catalog);
    next.selected = validate(info);
    writeJsonFileSync(catalogFile, next);
    catalog = next;
  }
  function state() {
    return {
      checkedAt: catalog.checkedAt,
      error: catalog.error,
      version: selected().version,
      available: catalog.available?.version || null,
      updateAvailable: !!catalog.available && newer(catalog.available.version, selected().version)
    };
  }
  return { selected, ensure, checkUpdates, commit, state, pending: () => catalog.available };
}
module.exports = {
  PINNED,
  REPOSITORY,
  PROXIES,
  PLUGIN_FILES,
  SETTINGS_FILE,
  PROXY_MARK,
  createEffPackages,
  readPackage,
  releaseInfo,
  releasePage,
  newer
};
