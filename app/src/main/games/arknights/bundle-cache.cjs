"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const SCHEMA = 3;
const GENERATION = /^incremental-bundle-build-v\d+$/;
// Schema 2 recorded the tools package hash instead; every build that wrote it came from this generation.
const SCHEMA_2_GENERATION = "incremental-bundle-build-v1";

// The worker checks each bundle it reuses by content: the game original, the ordered inputs and the
// bundle's own bytes. A rebuilt tools package therefore keeps the bundles. Its hash changes with
// every build (source commit, binaries that are not reproducible), so it cannot be the cache key.
// The tools declare a new incremental-bundle-build generation when the same inputs must produce
// different bundles; only that starts over. A package without one keeps the whole-package rule.
function buildGeneration(manifest) {
  const declared = Array.isArray(manifest?.capabilities) ? manifest.capabilities.find(name => GENERATION.test(name)) : null;
  return declared || crypto.createHash("sha256").update(JSON.stringify(manifest)).digest("hex");
}
function recordedGeneration(state) {
  if (state?.schemaVersion === SCHEMA) return state.buildGeneration || null;
  return state?.schemaVersion === 2 ? SCHEMA_2_GENERATION : null;
}
// reusable: the worker may take bundles from this build, also for a game that moved, since it
// compares every original by content. unchanged: the build can be used as it is.
function evaluate(state, { generation, gamePath, resourceFingerprint }) {
  const reusable = !!generation && recordedGeneration(state) === generation;
  return { reusable, unchanged: reusable && state.gamePath === gamePath && state.resourceFingerprint === resourceFingerprint };
}
function record({ generation, gamePath, resourceFingerprint }, { bundleCount, resourceCount }) {
  return { schemaVersion: SCHEMA, resourceFingerprint, buildGeneration: generation, gamePath, bundleCount, resourceCount };
}

// What a build leaves in the data root when it does not reach its end: the worker's stage when it
// fails or is stopped, and a complete build the manager never moved into place.
const LEFTOVER = /^(?:\.qaqr-bundles-[a-z0-9_]{8}|bundle-build-[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})$/;
function leftoverBuilds(root) {
  try {
    // A linked directory is not a real one here, so it is neither read nor removed.
    return fs.readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory() && LEFTOVER.test(entry.name)).map(entry => path.join(root, entry.name)).sort();
  } catch { return []; }
}
function discard(directories) {
  for (const directory of directories) {
    try { fs.rmSync(directory, { recursive: true, force: true }); }
    catch { /* Still in use; the next finished build removes it. */ }
  }
}

module.exports = { buildGeneration, evaluate, record, leftoverBuilds, discard };
