"use strict";
const path = require("node:path");

// The build copies main, preload and renderer without changing their relative layout.
const mainDir = path.resolve(__dirname, "..");
module.exports = { mainDir };
