"use strict";

// A component QAQR builds from an organization fork ships inside the installation. The fork also
// publishes every build as a release, and this takes a newer one from there: the package is held
// against the digests GitHub publishes and against its own manifest, kept under the data folder,
// and from then on read in place of the bundled copy for as long as it is the newer of the two.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const AdmZip = require("adm-zip");
const i18n = require("../../shared/i18n/core.cjs");
const { readJsonFileSync, writeJsonFileSync } = require("../core/json-store.cjs");
const MAX_MANIFEST = 64 * 1024;
const MAX_PACKAGE = 96 * 1024 * 1024;
const MAX_ENTRY = 64 * 1024 * 1024;
const FRESH = 60 * 1000;
const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const failure = (code, values) => Object.assign(Error(i18n.t(`backend.componentUpdates.${code}`, values)), { code, componentUpdate: true });
const digestOf = asset => /^sha256:([a-f0-9]{64})$/i.exec(asset?.digest || "")?.[1].toLowerCase() || null;
// <upstream version>.<QAQR patch>, with whatever suffix the upstream numbers carry: 1.3.3.15, 1.2.2-nhd.30.13.
const VERSION = /^\d+(?:[.-][0-9A-Za-z]+)*$/;
function compareVersions(left, right) {
  const a = String(left).match(/\d+/g)?.map(Number) || [], b = String(right).match(/\d+/g)?.map(Number) || [];
  for (let index = 0; index < Math.max(a.length, b.length); index++) {
    if ((a[index] || 0) !== (b[index] || 0)) return (a[index] || 0) > (b[index] || 0) ? 1 : -1;
  }
  return 0;
}
// The manifest of a released package: where it comes from, its number, and the digest of every file.
function readManifest(bytes, repository) {
  let manifest;
  try { manifest = JSON.parse(bytes.toString("utf8")); } catch { throw failure("invalidRelease"); }
  const files = manifest?.files && !Array.isArray(manifest.files) ? Object.entries(manifest.files) : [];
  const safe = ([relative, digest]) => typeof relative === "string" && /^[a-f0-9]{64}$/.test(digest)
    && relative.toLowerCase() !== "component.json" && relative.split("/").every(part => /^[A-Za-z0-9][\w ._()-]*$/.test(part) && !part.endsWith("."));
  if (manifest?.source !== `https://github.com/${repository}` || !/^[a-f0-9]{40}$/.test(manifest.sourceCommit || "")
    || typeof manifest.version !== "string" || !VERSION.test(manifest.version) || manifest.version.length > 48
    || !files.length || files.length > 256 || !files.every(safe)) throw failure("invalidRelease");
  return manifest;
}
// The newest release that carries the package: its manifest and the archive, each with a published digest.
function releaseInfo(release, name) {
  const version = !release?.draft && new RegExp(`^${name}-(\\d[0-9A-Za-z.-]*)$`).exec(release?.tag_name || "")?.[1];
  if (!version || !VERSION.test(version)) return null;
  const assets = new Map((release.assets || []).map(asset => [asset?.name, asset]));
  const manifest = assets.get("component.json"), archive = assets.get(name + ".zip");
  if (!digestOf(manifest) || !digestOf(archive) || manifest.size > MAX_MANIFEST || archive.size > MAX_PACKAGE) return null;
  return { tag: release.tag_name, version, manifestSha256: digestOf(manifest), archiveSha256: digestOf(archive) };
}
// The REST API allows 60 anonymous requests an hour per address; the release page lists the same digests without that limit.
async function releasePage(fetchImpl, signal, repository, name) {
  async function text(url) {
    const response = await fetchImpl(url, { signal, headers: { Accept: "text/html" } });
    if (!response.ok) throw failure("updateCheckFailed", { status: response.status });
    return await response.text();
  }
  const tag = new RegExp(`/releases/expanded_assets/(${name}-\\d[0-9A-Za-z.-]*)["']`).exec(await text(`https://github.com/${repository}/releases`))?.[1];
  if (!tag) throw failure("invalidRelease");
  const assets = [];
  for (const [, row] of (await text(`https://github.com/${repository}/releases/expanded_assets/${tag}`)).matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) {
    const asset = ["component.json", name + ".zip"].find(item => row.includes(`/${repository}/releases/download/${tag}/${item}`));
    const digest = /sha256:([a-f0-9]{64})/i.exec(row)?.[1];
    if (asset && digest) assets.push({ name: asset, digest: "sha256:" + digest.toLowerCase(), size: 0 });
  }
  const found = releaseInfo({ tag_name: tag, draft: false, assets }, name);
  if (!found) throw failure("invalidRelease");
  return found;
}

// `bundled()` reads the copy in the installation, `load(directory, { downloaded })` reads and checks a
// package wherever it lies, and `versionOf(bundle)` numbers it. All three throw on a package QAQR cannot use.
function createComponentUpdates({ name, repository, storeDir, bundled, load, versionOf, fetch: fetchImpl, now = Date.now }) {
  const store = () => typeof storeDir === "function" ? storeDir() : storeDir;
  const assetUrl = (tag, asset) => `https://github.com/${repository}/releases/download/${tag}/${asset}`;
  let catalog = null, running = null;
  function saved() {
    if (catalog) return catalog;
    catalog = { available: null, error: null, checkedAt: null };
    try {
      const data = readJsonFileSync(path.join(store(), "catalog.json")), info = data.available;
      if (info && VERSION.test(info.version || "") && info.tag === `${name}-${info.version}` && [info.manifestSha256, info.archiveSha256].every(value => /^[a-f0-9]{64}$/.test(value || "")) && /^[a-f0-9]{40}$/.test(info.sourceCommit || "")) {
        catalog.available = { tag: info.tag, version: info.version, sourceCommit: info.sourceCommit, manifestSha256: info.manifestSha256, archiveSha256: info.archiveSha256 };
      }
      catalog.checkedAt = typeof data.checkedAt === "string" ? data.checkedAt : null;
    } catch (error) {
      if (error.code !== "ENOENT") catalog.error = i18n.t("backend.componentUpdates.storageReadFailed");
    }
    return catalog;
  }
  function downloaded() {
    let names;
    try { names = fs.readdirSync(store(), { withFileTypes: true }).filter(entry => entry.isDirectory() && /^[a-f0-9]{40}$/.test(entry.name)).map(entry => entry.name); }
    catch { return []; }
    const packages = [];
    for (const commit of names) {
      try {
        const bundle = load(path.join(store(), commit), { downloaded: true });
        if (bundle.manifest.sourceCommit === commit) packages.push({ bundle, version: versionOf(bundle) });
      } catch { /* A package that no longer checks out is as good as absent; the bundled copy stands in. */ }
    }
    return packages;
  }
  // The newer of the bundled package and what was downloaded. A manager update that ships the same
  // or a later build takes over again by itself.
  function active() {
    let best = null, missing = null;
    try { const bundle = bundled(); best = { bundle, version: versionOf(bundle), origin: "bundled" }; }
    catch (error) { missing = error; }
    for (const item of downloaded()) if (!best || compareVersions(item.version, best.version) > 0) best = { ...item, origin: "downloaded" };
    if (!best) throw missing;
    return { ...best.bundle, origin: best.origin };
  }
  async function download(url, limit, timeout = 120000) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetchImpl(url, { signal: controller.signal });
      if (!response.ok) throw failure("downloadFailed", { status: response.status });
      const chunks = [];
      let size = 0;
      for await (const chunk of response.body) {
        size += chunk.length;
        if (size > limit) throw failure("downloadFailed", { status: "size" });
        chunks.push(Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    } catch (error) {
      throw error.componentUpdate ? error : failure("downloadFailed", { status: "network" });
    } finally {
      clearTimeout(timer);
    }
  }
  async function manifestOf(info) {
    const bytes = await download(assetUrl(info.tag, "component.json"), MAX_MANIFEST, 20000);
    if (hash(bytes) !== info.manifestSha256) throw failure("checksumFailed", { name: "component.json" });
    const manifest = readManifest(bytes, repository);
    if (manifest.version !== info.version) throw failure("invalidRelease");
    return { bytes, manifest };
  }
  function persist(next) {
    catalog = next;
    try {
      fs.mkdirSync(store(), { recursive: true });
      writeJsonFileSync(path.join(store(), "catalog.json"), next);
    } catch { /* What was found still holds for this run. */ }
  }
  // Never rejects: without a network the packages on disk go on being used, and the row says the check failed.
  function check({ force = false } = {}) {
    if (running) return running;
    const last = Date.parse(saved().checkedAt || "");
    if (!force && !saved().error && now() - last >= 0 && now() - last < FRESH) return Promise.resolve(saved());
    running = (async () => {
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 20000);
      const next = { available: saved().available, error: null, checkedAt: new Date(now()).toISOString() };
      try {
        let found = null;
        try {
          // /releases/latest would do, but the list also survives an upstream-style release landing in the fork.
          const response = await fetchImpl(`https://api.github.com/repos/${repository}/releases?per_page=10`, { signal: controller.signal, headers: { Accept: "application/vnd.github+json" } });
          if (!response.ok) throw failure("updateCheckFailed", { status: response.status });
          const releases = await response.json();
          for (const release of Array.isArray(releases) ? releases : []) if ((found = releaseInfo(release, name))) break;
          if (!found) throw failure("invalidRelease");
        } catch {
          found = await releasePage(fetchImpl, controller.signal, repository, name);
        }
        const known = next.available && next.available.tag === found.tag && next.available.manifestSha256 === found.manifestSha256 && next.available.archiveSha256 === found.archiveSha256;
        next.available = known ? next.available : { ...found, sourceCommit: (await manifestOf(found)).manifest.sourceCommit };
      } catch (error) {
        next.error = error.componentUpdate ? error.message : i18n.t("backend.componentUpdates.updateCheckFailed", { status: "network" });
      } finally {
        clearTimeout(timer);
      }
      persist(next);
      return next;
    })().finally(() => { running = null; });
    return running;
  }
  // `current` is the version in use now, which the caller has already read from disk.
  function state(current) {
    const { available, error, checkedAt } = saved();
    return { checkedAt, error, latest: available?.version || null, build: available?.sourceCommit.slice(0, 12) || null,
      updateAvailable: !!available && (!current || compareVersions(available.version, current) > 0) };
  }
  function rename(from, to) {
    // A scanner can hold a file it has just seen written for a moment.
    for (let attempt = 0; ; attempt++) {
      try { return fs.renameSync(from, to); }
      catch (error) {
        if (!["EPERM", "EBUSY", "EACCES"].includes(error.code) || attempt === 4) throw error;
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 150);
      }
    }
  }
  // Downloads the release found by the last check and puts it beside the bundled copy. The package is
  // complete and verified under a temporary name before it takes its place; any failure leaves things as they were.
  async function update(current) {
    const info = saved().available;
    if (!info || current && compareVersions(info.version, current) <= 0) throw failure("nothingNew");
    const { bytes: manifestBytes, manifest } = await manifestOf(info);
    if (manifest.sourceCommit !== info.sourceCommit) throw failure("invalidRelease");
    const archive = await download(assetUrl(info.tag, name + ".zip"), MAX_PACKAGE, 10 * 60 * 1000);
    if (hash(archive) !== info.archiveSha256) throw failure("checksumFailed", { name: name + ".zip" });
    let entries;
    try { entries = new Map(new AdmZip(archive).getEntries().filter(entry => !entry.isDirectory).map(entry => [entry.entryName.replace(/\\/g, "/").replace(/^\.\//, ""), entry])); }
    catch { throw failure("invalidPackage"); }
    const root = store(), incoming = path.join(root, ".incoming-" + crypto.randomUUID()), final = path.join(root, manifest.sourceCommit);
    fs.mkdirSync(root, { recursive: true });
    for (const stale of fs.readdirSync(root).filter(entry => entry.startsWith(".incoming-"))) fs.rmSync(path.join(root, stale), { recursive: true, force: true });
    try {
      const inside = entries.get("component.json");
      if (!inside || inside.header.size > MAX_MANIFEST || !inside.getData().equals(manifestBytes)) throw failure("invalidPackage");
      for (const [relative, digest] of Object.entries(manifest.files)) {
        const entry = entries.get(relative);
        if (!entry || entry.header.size > MAX_ENTRY) throw failure("invalidPackage");
        const bytes = entry.getData();
        if (hash(bytes) !== digest) throw failure("checksumFailed", { name: relative });
        const file = path.join(incoming, relative);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, bytes);
      }
      fs.writeFileSync(path.join(incoming, "component.json"), manifestBytes);
      // Read back the way it will be read from now on, so a package QAQR would later refuse never lands.
      let bundle;
      try { bundle = load(incoming, { downloaded: true }); } catch { throw failure("invalidPackage"); }
      if (versionOf(bundle) !== manifest.version) throw failure("invalidPackage");
      fs.rmSync(final, { recursive: true, force: true });
      rename(incoming, final);
    } catch (error) {
      throw error.componentUpdate ? error : failure("installFailed");
    } finally {
      fs.rmSync(incoming, { recursive: true, force: true });
    }
    // One downloaded package is kept: the bundled copy is what stands behind it.
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (entry.isDirectory() && /^[a-f0-9]{40}$/.test(entry.name) && entry.name !== manifest.sourceCommit) fs.rmSync(path.join(root, entry.name), { recursive: true, force: true });
    }
    return { version: manifest.version, sourceCommit: manifest.sourceCommit };
  }
  return { active, check, state, update };
}

module.exports = { createComponentUpdates, compareVersions, readManifest, releaseInfo, releasePage };
