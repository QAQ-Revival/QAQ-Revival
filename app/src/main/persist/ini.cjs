"use strict";

const path = require("path");
const crypto = require("crypto");
const persistLayout = require("./layout.cjs");
function normalizePersistBridgeRelativePath(value) {
  return String(value || "").replace(/[\/]+/g, "\\").split("\\").filter(Boolean).map(segment => segment.replace(/^DISABLED_/i, "")).join("\\");
}
function parseLocalPersistDeclarations(content) {
  const declarations = [];
  const seen = new Set();
  const lines = String(content || "").replace(/\r\n/g, "\n").split("\n");
  for (const line of lines) {
    const match = line.match(/^\s*global\s+persist\s+\$([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    const variableName = match[1];
    const normalizedName = variableName.toLowerCase();
    if (seen.has(normalizedName)) continue;
    seen.add(normalizedName);
    declarations.push({
      variableName,
      normalizedName,
      defaultValue: match[2]
    });
  }
  return declarations;
}
function buildPersistBridgeDescriptor(modsRoot, iniPath) {
  const canonicalRelativePath = normalizePersistBridgeRelativePath(path.relative(modsRoot, iniPath));
  const hash = crypto.createHash("sha1").update(canonicalRelativePath.toLowerCase()).digest("hex").slice(0, 12);
  return {
    hash,
    canonicalRelativePath,
    stateFileName: `qaqm_state_${hash}.ini`,
    namespace: `QAQM\\Persist\\Bridge_${hash}`
  };
}
function buildPersistBridgeStateContent(descriptor, declarations, existingValues = new Map()) {
  return [`namespace = ${descriptor.namespace}`, "", "[Constants]", ...declarations.map(declaration => {
    const existingValue = existingValues.get(declaration.normalizedName);
    const value = existingValue !== void 0 ? existingValue : declaration.defaultValue;
    return `global persist $${declaration.variableName} = ${value}`;
  }), ""].join("\n");
}
function applyPersistBridgeToIniContent(content, descriptor, declarations) {
  const persistNames = new Set(declarations.map(declaration => declaration.normalizedName));
  const lines = String(content || "").replace(/\r\n/g, "\n").split("\n");
  const nextLines = [];
  let insertedBridgeComment = false;
  const replacements = declarations.map(declaration => ({
    regex: new RegExp(`(?<![A-Za-z0-9_\\\\])\\$${persistLayout.escapeRegExp(declaration.variableName)}\\b`, "gi"),
    replacement: `$\\${descriptor.namespace}\\${declaration.variableName}`
  }));
  for (const line of lines) {
    const persistMatch = line.match(/^\s*global\s+persist\s+\$([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (persistMatch && persistNames.has(persistMatch[1].toLowerCase())) {
      if (!insertedBridgeComment) {
        nextLines.push(`; Persisted state is hosted by ${descriptor.stateFileName}`);
        insertedBridgeComment = true;
      }
      continue;
    }
    if (/^\s*\[/.test(line)) {
      nextLines.push(line);
      continue;
    }
    let nextLine = line;
    for (const {
      regex,
      replacement
    } of replacements) {
      nextLine = nextLine.replace(regex, () => replacement);
    }
    nextLines.push(nextLine);
  }
  return nextLines.join("\n");
}
function parseIniNamespace(content) {
  const match = String(content || "").match(/^\s*namespace\s*=\s*(.+?)\s*$/im);
  return match ? match[1].trim() : null;
}
function applyExternalBridgeRefsToIniContent(content, externalMappings) {
  if (!externalMappings || externalMappings.length === 0) return content;
  let result = String(content || "");
  for (const {
    originalNamespace,
    bridgeNamespace,
    varNames
  } of externalMappings) {
    if (!originalNamespace || !varNames || varNames.length === 0) continue;
    const escapedNs = persistLayout.escapeRegExp(originalNamespace);
    const varNameMap = new Map(varNames.map(v => [v.toLowerCase(), v]));
    const varNamesPattern = varNames.map(persistLayout.escapeRegExp).join("|");
    const regex = new RegExp(`\\$\\\\${escapedNs}\\\\(${varNamesPattern})\\b`, "gi");
    result = result.replace(regex, (_match, capturedVarName) => {
      const canonicalVarName = varNameMap.get(capturedVarName.toLowerCase()) || capturedVarName;
      return `$\\${bridgeNamespace}\\${canonicalVarName}`;
    });
  }
  return result;
}
module.exports = {
  parseLocalPersistDeclarations,
  buildPersistBridgeDescriptor,
  buildPersistBridgeStateContent,
  applyPersistBridgeToIniContent,
  parseIniNamespace,
  applyExternalBridgeRefsToIniContent
};
