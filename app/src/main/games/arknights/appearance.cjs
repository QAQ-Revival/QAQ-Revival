"use strict";

const path = require("node:path");
const files = require("./files.cjs");
const SHARED_SECTION = "arknights:shared";
const normalize = value => String(value || "").toLowerCase().replace(/[@#]/g, "_");

function matchingSkins(name, sections, transform = value => value) {
  return sections.filter(section => section.kind === "official-skin" || section.sectionId?.startsWith("skin:")).filter(section =>
    (section.aliases || []).some(alias => {
      if (!/char_\d+_/.test(alias)) return false;
      const normalized = transform(normalize(alias)), index = name.indexOf(normalized);
      return index >= 0 && !/[0-9]/.test(name[index + normalized.length] || "");
    })
  );
}

function classifyResources(resources, sections) {
  const affected = new Set();
  for (const value of resources) {
    const bundle = typeof value === "string" ? "" : normalize(value.bundle);
    if (/^chararts\//.test(bundle) || /^arts\/dynchars\/char_\d+_[a-z0-9]+_[12]\.ab$/.test(bundle)) {
      affected.add("base");
      continue;
    }
    // A bound dynamic bundle belongs to one outfit. Its effect texture names
    // can retain another outfit's name and must not widen that bundle's scope.
    if (bundle.startsWith("arts/dynchars/")) {
      const bundleMatches = matchingSkins(bundle, sections);
      if (bundleMatches.length === 1) { affected.add(bundleMatches[0].sectionId); continue; }
    }
    // Reference aliases may accompany otherwise unnamed material textures in
    // a resource manifest after their PC prefab dependencies are inspected.
    const references = typeof value === "object" && Array.isArray(value.appearanceAliases) ? matchingSkins(value.appearanceAliases.map(normalize).join(" "), sections) : [];
    if (references.length) { affected.add(references.length === 1 ? references[0].sectionId : SHARED_SECTION); continue; }
    const name = normalize(typeof value === "string" ? value : value.resource || path.basename(value.target || ""));
    const token = bundle.match(/^(?:skinpack|chararts)\/(token_[a-z0-9_]+)\.ab$/)?.[1];
    const matches = matchingSkins(name, sections, alias => token ? alias.replace(/^char_\d+_[a-z0-9]+/, token) : alias);
    if (token && matches.length === 0) {
      const tokenIndex = name.indexOf(token);
      const suffix = tokenIndex < 0 ? "" : name.slice(tokenIndex + token.length).replace(/\[alpha\](?=\.)/, "");
      if (tokenIndex >= 0 && /^(?:_[12])?(?:__atlas\d+)?(?:__page\d+)?\.(png|skel|atlas|json)$/.test(suffix)) { affected.add("base"); continue; }
    }
    if (matches.length === 1) {
      affected.add(matches[0].sectionId);
      continue;
    }
    if (matches.length > 1 || /\.(ab|bundle|unity3d)$/.test(name) || name.includes("__texture_")) {
      affected.add(SHARED_SECTION);
      continue;
    }
    const character = name.match(/char_\d+_[a-z0-9]+/);
    if (!character) { affected.add(SHARED_SECTION); continue; }
    const suffix = name.slice(character.index + character[0].length).replace(/\[alpha\](?=\.)/, "");
    affected.add(/^(?:_[12](?:b|\+)?)?(?:_start)?(?:__atlas\d+)?(?:__page\d+)?\.(png|skel|atlas|json)$/.test(suffix) ? "base" : SHARED_SECTION);
  }
  const sectionIds = [...affected];
  return { sectionId: sectionIds.length === 1 ? sectionIds[0] : SHARED_SECTION, sectionIds, uncertain: affected.has(SHARED_SECTION) };
}

function inspectAppearance(modDir, sections) {
  const entries = files.walk(modDir);
  const { bindings } = files.readBindings(modDir);
  const names = [...entries.filter(file => files.RESOURCES.has(file.ext) && ![".txt", ".ini"].includes(file.ext)).map(file => {
    const binding = bindings.get(file.path.toLowerCase());
    return binding ? { resource: binding.target, bundle: binding.bundle, appearanceAliases: binding.appearanceAliases } : file.name;
  }), ...entries.filter(file => files.BUNDLES.has(file.ext)).map(file => file.name)];
  return classifyResources(names, sections);
}

let appearanceWorker = null;
let nextRequestId = 0;
const pending = new Map();
function inspectAppearances(modDirs, sections) {
  if (!modDirs.length) return Promise.resolve([]);
  if (!appearanceWorker) {
    const { Worker } = require("node:worker_threads");
    const worker = new Worker(path.join(__dirname, "appearance-worker.cjs"));
    appearanceWorker = worker;
    const fail = error => {
      if (appearanceWorker !== worker) return;
      appearanceWorker = null;
      for (const request of pending.values()) request.reject(error);
      pending.clear();
    };
    worker.on("message", ({ id, result, error }) => {
      const request = pending.get(id);
      if (!request) return;
      pending.delete(id);
      if (error) request.reject(new Error(error));
      else request.resolve(result);
      if (!pending.size) worker.unref();
    });
    worker.on("error", fail);
    worker.on("exit", code => fail(new Error(`Appearance worker exited (${code})`)));
    worker.unref();
  }
  const worker = appearanceWorker;
  return new Promise((resolve, reject) => {
    const id = ++nextRequestId;
    pending.set(id, { resolve, reject });
    worker.ref();
    try { worker.postMessage({ id, modDirs, sections }); }
    catch (error) {
      pending.delete(id);
      if (!pending.size) worker.unref();
      reject(error);
    }
  });
}

module.exports = { SHARED_SECTION, classifyResources, inspectAppearance, inspectAppearances };
