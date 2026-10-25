"use strict";

const { parentPort } = require("node:worker_threads");
const { inspectAppearance } = require("./appearance.cjs");

parentPort.on("message", ({ id, action, entries, modDirs, sections }) => {
  try {
    const result = action === "conflicts" ? require("./deployment.cjs").findConflicts(entries).map(({ id, hash, mods }) => ({ id, hash, mods })) : modDirs.map(dir => inspectAppearance(dir, sections));
    parentPort.postMessage({ id, result });
  } catch (error) {
    parentPort.postMessage({ id, error: error.message });
  }
});
