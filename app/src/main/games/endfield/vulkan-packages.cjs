const i18n = require("../../../shared/i18n/core.cjs");
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {
  readJsonFileSync,
  writeJsonFileSync
} = require("../../core/json-store.cjs");
const REPOSITORY = 'myparsleycat/XXMI-Libs-Package-Forked';
const MAX_FILE = 64 * 1024 * 1024;
const MAX_MANIFEST = 64 * 1024;
// The release this version of QAQR was checked against, by the digests GitHub publishes for its assets.
const PINNED = {
  version: '1.2.2-nhd.27',
  files: {
    'd3d11.dll': '6b2bb820de27c2fd1ed7aa091bc15169db1fb6bb86e6f735605cbd5e765fb098',
    'dxcompiler.dll': '78b5e21a91707b4a567ef281a519c52a45b709561202f54c5ad79c5a315847ed',
    'dxil.dll': '77e039c905030a641e53658a008b74e90635a5ea9b6b79eabd0f2003bdfca59a',
    'SPIRV-Tools-shared.dll': '7cc66528fc09c12cd188296050edf9f31c8734451f661ddd24dd8d4dd7041ef3'
  }
};
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const number = version => /^(\d+)\.(\d+)\.(\d+)-nhd\.(\d+)$/.exec(version)?.slice(1).map(Number) || null;
function newer(a, b) {
  const left = number(a), right = number(b);
  for (let i = 0; i < 4; i++) if (left[i] !== right[i]) return left[i] > right[i];
  return false;
}
function validate(info) {
  if (!info || !number(info.version) || !info.files || !/^[a-f0-9]{64}$/.test(info.files['d3d11.dll'] || '')) throw Error(i18n.t("backend.efmiVulkan.invalidRelease"));
  const names = Object.keys(info.files);
  if (names.length > 17 || names.some(name => !/^[A-Za-z0-9._-]+\.dll$/.test(name) || name === 'd3dcompiler_47.dll' || !/^[a-f0-9]{64}$/.test(info.files[name]))) throw Error(i18n.t("backend.efmiVulkan.invalidRelease"));
  return { version: info.version, files: { ...info.files } };
}
// What a launcher takes from a release, per the upstream's docs/runtime-dependencies.md.
function releaseFiles(release, dependencies) {
  if (!release || release.draft || release.prerelease || !/^v\d+\.\d+\.\d+-nhd\.\d+$/.test(release.tag_name || '')) throw Error(i18n.t("backend.efmiVulkan.invalidRelease"));
  const assets = new Map((release.assets || []).map(asset => [asset.name, asset]));
  const listed = dependencies.schema === 1 && Array.isArray(dependencies.files) && dependencies.files.length <= 16 ? dependencies.files.map(file => file.name) : ['dxcompiler.dll', 'dxil.dll'];
  const files = {};
  for (const name of ['d3d11.dll', ...listed]) {
    const asset = assets.get(name), digest = asset?.digest?.replace(/^sha256:/, '');
    if (!digest || asset.size > MAX_FILE) throw Error(i18n.t("backend.efmiVulkan.invalidRelease"));
    files[name] = digest;
  }
  return validate({ version: release.tag_name.slice(1), files });
}
function createEfmiVulkanPackages({
  bundledDir,
  cacheDir,
  fetch: fetchImpl
}) {
  const catalogFile = path.join(cacheDir, 'versions.json');
  let catalog = { selected: null, available: null, error: null, checkedAt: null };
  try {
    const saved = readJsonFileSync(catalogFile);
    if (saved.selected) catalog.selected = validate(saved.selected);
    if (saved.available) catalog.available = validate(saved.available);
    catalog.checkedAt = saved.checkedAt || null;
  } catch (error) {
    if (error.code !== 'ENOENT') catalog.error = i18n.t("backend.efmiVulkan.storageReadFailed");
  }
  const selected = () => catalog.selected || PINNED;
  const assetUrl = (version, name) => `https://github.com/${REPOSITORY}/releases/download/v${version}/${name}`;
  async function download(url, limit) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 120000);
    try {
      const response = await fetchImpl(url, { signal: controller.signal });
      if (!response.ok) throw Error(i18n.t("backend.efmiVulkan.downloadFailed", { status: response.status }));
      const chunks = [];
      let size = 0;
      for await (const chunk of response.body) {
        size += chunk.length;
        if (size > limit) throw Error(i18n.t("backend.efmiVulkan.downloadFailed", { status: 'size' }));
        chunks.push(Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    } finally {
      clearTimeout(timer);
    }
  }
  // Every file is held against its pinned digest, from the install or the cache, before the network is asked.
  async function ensure(info = selected()) {
    const files = new Map();
    for (const [name, digest] of Object.entries(validate(info).files)) {
      let bytes = null;
      for (const dir of [bundledDir, path.join(cacheDir, info.version)]) {
        const file = dir === bundledDir ? path.join(dir, info.version, name) : path.join(dir, name);
        if (!fs.existsSync(file)) continue;
        const candidate = fs.readFileSync(file);
        if (hash(candidate) === digest) { bytes = candidate; break; }
      }
      if (!bytes) {
        bytes = await download(assetUrl(info.version, name), MAX_FILE);
        if (hash(bytes) !== digest) throw Error(i18n.t("backend.efmiVulkan.checksumFailed", { name }));
        fs.mkdirSync(path.join(cacheDir, info.version), { recursive: true });
        fs.writeFileSync(path.join(cacheDir, info.version, name), bytes);
      }
      files.set(name, bytes);
    }
    return files;
  }
  async function checkUpdates() {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 20000);
    const next = structuredClone(catalog);
    next.error = null;
    next.checkedAt = new Date().toISOString();
    try {
      const response = await fetchImpl(`https://api.github.com/repos/${REPOSITORY}/releases/latest`, {
        signal: controller.signal,
        headers: { Accept: 'application/vnd.github+json' }
      });
      if (!response.ok) throw Error(i18n.t("backend.efmiVulkan.updateCheckFailed", { status: response.status }));
      const release = await response.json();
      const manifest = await download(assetUrl(release.tag_name?.slice(1), 'runtime-dependencies.json'), MAX_MANIFEST).catch(() => null);
      next.available = releaseFiles(release, manifest ? JSON.parse(manifest.toString('utf8')) : {});
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
  return {
    selected,
    ensure,
    checkUpdates,
    commit,
    state,
    pending: () => catalog.available
  };
}
module.exports = {
  PINNED,
  REPOSITORY,
  createEfmiVulkanPackages,
  releaseFiles
};
