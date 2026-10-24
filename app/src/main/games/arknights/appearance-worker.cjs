"use strict";

const { parentPort } = require("node:worker_threads");
const { inspectAppearance } = require("./appearance.cjs");

parentPort.on("message", ({ id, modDirs, sections }) => {
  try {
    parentPort.postMessage({ id, result: modDirs.map(dir => inspectAppearance(dir, sections)) });
  } catch (error) {
    parentPort.postMessage({ id, error: error.message });
  }
});
