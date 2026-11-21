"use strict";

// The components an organization fork releases by itself, and what makes a directory one of them:
// the repository it names, the files it has to hold, and where its number is read. Each service
// asks here for its package and gets the newer of the bundled copy and a downloaded release.
const fs = require("node:fs");
const path = require("node:path");
const i18n = require("../../shared/i18n/core.cjs");
const { bundleDirectory, loadBundleAt, runtimePackage, FORK_MARK, VULKAN_MARK } = require("./mi-forks.cjs");
const { createComponentUpdates } = require("./component-updates.cjs");
const invalid = () => Object.assign(Error(i18n.t("settings.mi.fork.invalidBundle")), { code: "invalidBundle" });
// A bundled copy from before packages were numbered ranks below every release.
const numbered = bundle => typeof bundle.manifest.version === "string" ? bundle.manifest.version : "0";
// `accept` gets the last word, and is told when the package came from a download rather than the installation.
function described(repository, files, accept = () => true) {
  const name = repository.split("/")[1];
  return {
    repository,
    load(directory, { downloaded = false } = {}) {
      const bundle = loadBundleAt(directory, name);
      if (files.some(file => !bundle.files[file]) || !accept(bundle, downloaded)) throw invalid();
      return bundle;
    },
    version: numbered
  };
}
const PACKAGES = {
  "xxmi-runtime": runtimePackage,
  "efmi-core": described("QAQ-Revival/EFMI-Package", [], bundle => !!bundle.manifest.official?.version && !!bundle.manifest.compatibleFiles),
  "xxmi-runtime-vulkan": described("QAQ-Revival/XXMI-Libs-Vulkan", ["d3d11.dll"], (bundle, downloaded) => {
    if (bundle.manifest.backend !== "vulkan") return false;
    if (!downloaded) return true;
    const bytes = fs.readFileSync(bundle.files["d3d11.dll"]);
    return bytes.includes(FORK_MARK) && bytes.includes(VULKAN_MARK);
  }),
  "wwmi-dx12-qaqr": described("QAQ-Revival/wwmi-dx12", ["wwmi_dx12.addon64"]),
  eff: described("QAQ-Revival/EFF", ["EFFLoader.exe", "plugin/eff.dll"]),
  "endfield-hdr": described("QAQ-Revival/renodx", ["dxgi.dll", "renodx-endfield.addon64"])
};

// One updater per component, made the first time a service asks for it.
function createComponentPackages({ roots, storeRoot, fetch }) {
  const made = new Map();
  return name => {
    const known = PACKAGES[name];
    if (!known) throw Error("Unknown component package: " + name);
    if (!made.has(name)) {
      made.set(name, createComponentUpdates({
        name, repository: known.repository, fetch,
        storeDir: () => path.join(typeof storeRoot === "function" ? storeRoot() : storeRoot, name),
        bundled: () => known.load(bundleDirectory(typeof roots === "function" ? roots() : roots, name)),
        load: known.load, versionOf: known.version
      }));
    }
    return made.get(name);
  };
}

module.exports = { createComponentPackages, PACKAGES };
