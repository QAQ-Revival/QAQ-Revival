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
const BRIDGE_REFERENCE_PATTERN = /\$\\QAQM\\Persist\\Bridge_([A-Fa-f0-9]+)\\([A-Za-z_][A-Za-z0-9_]*)/g;
// Bridge variables referenced by INI contents: lower-case namespace -> (lower-case name -> name as written).
function collectBridgeReferences(contents) {
  const references = new Map();
  for (const content of contents) {
    for (const match of String(content || "").matchAll(BRIDGE_REFERENCE_PATTERN)) {
      const namespace = `qaqm\\persist\\bridge_${match[1].toLowerCase()}`;
      if (!references.has(namespace)) references.set(namespace, new Map());
      const names = references.get(namespace);
      const normalizedName = match[2].toLowerCase();
      if (!names.has(normalizedName)) names.set(normalizedName, match[2]);
    }
  }
  return references;
}
// A state file is rebuilt from the INI's remaining local declarations. Variables an earlier
// migration already moved into the state file are no longer declared in the INI, so keep every
// hosted declaration (with its value) that INIs still reference; drop the rest. Referenced names
// that are declared nowhere are added with the default 0 so 3DMigoto keeps the commands using them.
function mergeHostedPersistDeclarations(declarations, existingStateContent, references, namespace) {
  const merged = [...declarations];
  const seen = new Set(declarations.map(declaration => declaration.normalizedName));
  const referenced = references?.get(String(namespace).toLowerCase()) || new Map();
  for (const declaration of parseLocalPersistDeclarations(existingStateContent)) {
    if (seen.has(declaration.normalizedName) || !referenced.has(declaration.normalizedName)) continue;
    seen.add(declaration.normalizedName);
    merged.push(declaration);
  }
  for (const [normalizedName, variableName] of referenced) {
    if (seen.has(normalizedName)) continue;
    seen.add(normalizedName);
    merged.push({
      variableName,
      normalizedName,
      defaultValue: "0"
    });
  }
  return merged;
}
function parseIniNamespace(content) {
  const match = String(content || "").match(/^\s*namespace\s*=\s*(.+?)\s*$/im);
  return match ? match[1].trim() : null;
}
function isIdentifierCharCode(code) {
  return code >= 48 && code <= 57 || code >= 65 && code <= 90 || code >= 97 && code <= 122 || code === 95;
}
const compiledExternalMappingsCache = new WeakMap();
function compileExternalBridgeMappings(externalMappings) {
  if (compiledExternalMappingsCache.has(externalMappings)) {
    return compiledExternalMappingsCache.get(externalMappings);
  }
  const byNamespace = new Map();
  const prefix1 = new Set();
  const prefix2 = new Set();
  const fallbackRegexes = [];
  let minNsLen = Infinity;
  let maxNsLen = 0;
  let useFallback = false;
  for (let order = 0; order < externalMappings.length; order++) {
    const {
      originalNamespace,
      bridgeNamespace,
      varNames
    } = externalMappings[order] || {};
    if (!originalNamespace || !varNames || varNames.length === 0) continue;
    const nsText = String(originalNamespace);
    const nsKey = nsText.toLowerCase();
    const localVars = new Map();
    for (const rawVar of varNames) {
      if (!rawVar) continue;
      const varText = String(rawVar);
      if (!/^[A-Za-z0-9_]+$/.test(varText)) useFallback = true;
      localVars.set(varText.toLowerCase(), varText);
    }
    if (localVars.size === 0) continue;
    minNsLen = Math.min(minNsLen, nsKey.length);
    maxNsLen = Math.max(maxNsLen, nsKey.length);
    if (nsKey.length === 1) prefix1.add(nsKey[0]);
    else prefix2.add(nsKey.slice(0, 2));
    let nsMap = byNamespace.get(nsKey);
    if (!nsMap) {
      nsMap = new Map();
      byNamespace.set(nsKey, nsMap);
    }
    for (const [lowerVar, canonicalVarName] of localVars) {
      if (!nsMap.has(lowerVar)) {
        nsMap.set(lowerVar, {
          bridgeNamespace,
          canonicalVarName,
          order
        });
      }
    }
    fallbackRegexes.push({
      regex: new RegExp(`\\$\\\\${persistLayout.escapeRegExp(nsText)}\\\\(${Array.from(localVars.values(), persistLayout.escapeRegExp).join("|")})\\b`, "gi"),
      varNameMap: localVars,
      bridgeNamespace
    });
  }
  const compiled = {
    byNamespace,
    prefix1,
    prefix2,
    minNsLen,
    maxNsLen,
    useFallback,
    fallbackRegexes
  };
  compiledExternalMappingsCache.set(externalMappings, compiled);
  return compiled;
}
function applyExternalBridgeRefsToIniContent(content, externalMappings) {
  if (!externalMappings || externalMappings.length === 0) return content;
  const text = String(content || "");
  let idx = text.indexOf("$\\");
  if (idx === -1) return text;
  const compiled = compileExternalBridgeMappings(externalMappings);
  if (compiled.byNamespace.size === 0) return text;
  if (compiled.useFallback) {
    let result = text;
    for (const {
      regex,
      varNameMap,
      bridgeNamespace
    } of compiled.fallbackRegexes) {
      result = result.replace(regex, (_match, capturedVarName) => {
        const canonicalVarName = varNameMap.get(capturedVarName.toLowerCase()) || capturedVarName;
        return `$\\${bridgeNamespace}\\${canonicalVarName}`;
      });
    }
    return result;
  }
  const {
    byNamespace,
    prefix1,
    prefix2,
    minNsLen,
    maxNsLen
  } = compiled;
  const len = text.length;
  let chunks = null;
  let lastCopyIdx = 0;
  while (idx !== -1) {
    const nsStart = idx + 2;
    if (nsStart + minNsLen + 1 < len) {
      const c0 = text[nsStart].toLowerCase();
      const hasPrefix = prefix1.has(c0) || nsStart + 1 < len && prefix2.has(c0 + text[nsStart + 1].toLowerCase());
      if (hasPrefix) {
        const maxSlash = Math.min(len - 2, nsStart + maxNsLen);
        let best = null;
        for (let slashIdx = nsStart + minNsLen; slashIdx <= maxSlash; slashIdx++) {
          const code = text.charCodeAt(slashIdx);
          if (code === 10 || code === 13) break;
          if (code !== 92) continue;
          const varStart = slashIdx + 1;
          if (!isIdentifierCharCode(text.charCodeAt(varStart))) continue;
          const nsMap = byNamespace.get(text.slice(nsStart, slashIdx).toLowerCase());
          if (!nsMap) continue;
          let varEnd = varStart + 1;
          while (varEnd < len && isIdentifierCharCode(text.charCodeAt(varEnd))) {
            varEnd++;
          }
          const hit = nsMap.get(text.slice(varStart, varEnd).toLowerCase());
          if (hit && (!best || hit.order < best.order)) {
            best = {
              end: varEnd,
              replacement: `$\\${hit.bridgeNamespace}\\${hit.canonicalVarName}`,
              order: hit.order
            };
          }
        }
        if (best) {
          if (!chunks) chunks = [];
          chunks.push(text.slice(lastCopyIdx, idx), best.replacement);
          lastCopyIdx = best.end;
          idx = text.indexOf("$\\", best.end);
          continue;
        }
      }
    }
    idx = text.indexOf("$\\", nsStart);
  }
  if (!chunks) return text;
  chunks.push(text.slice(lastCopyIdx));
  return chunks.join("");
}
module.exports = {
  parseLocalPersistDeclarations,
  buildPersistBridgeDescriptor,
  buildPersistBridgeStateContent,
  applyPersistBridgeToIniContent,
  parseIniNamespace,
  applyExternalBridgeRefsToIniContent,
  collectBridgeReferences,
  mergeHostedPersistDeclarations
};
