export function cleanCollectionText(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}
export function normalizeCollectionKey(value) {
  return cleanCollectionText(value)
    .toLowerCase()
    .replace(/[【】\[\]（）(){}<>《》"'`]/g, "")
    .replace(/[\s_\-－–—.:：/\\]+/g, "");
}
export function buildCharacterPrefixKeys(characterName, characterAliases = []) {
  return Array.from(
    new Set(
      [characterName, ...characterAliases]
        .map((alias) => normalizeCollectionKey(alias))
        .filter(Boolean),
    ),
  );
}
export function splitCollectionNameParts(name) {
  return cleanCollectionText(name)
    .replace(/^DISABLED_/i, "")
    .split(/[-－–—]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}
export function stripCollectionVersion(value) {
  const text = cleanCollectionText(value);
  if (!text)
    return {
      text: "",
      version: "",
    };
  const compactVersion = text.match(/^(.*?)(v\s*\d+(?:\.\d+){0,3}[a-z]?)$/i);
  if (compactVersion && cleanCollectionText(compactVersion[1])) {
    return {
      text: cleanCollectionText(compactVersion[1]).replace(/[-_－–—\s]+$/, ""),
      version: compactVersion[2],
    };
  }
  const separatedVersion = text.match(
    /^(.*?)[\s_\-－–—]+(\d+(?:\.\d+){1,3}[a-z]?)$/i,
  );
  if (separatedVersion && cleanCollectionText(separatedVersion[1])) {
    return {
      text: cleanCollectionText(separatedVersion[1]).replace(
        /[-_－–—\s]+$/,
        "",
      ),
      version: separatedVersion[2],
    };
  }
  return {
    text,
    version: "",
  };
}
export function parseArknightsCollectionName(mod, characterName, characterAliases = []) {
  // Converted bundle names include a content fingerprint, not a Mod identity.
  // Keep the complete title (including hyphenated descriptions) and resource
  // scope; a common prefix or a missing version is not evidence of a release.
  const name = cleanCollectionText(mod?.name).replace(/\s*\[[a-f\d]{8}\]$/i, "");
  const suffix = name.match(/\s*\((?:PC|Repaired)(?: \d+)?\)$/i)?.[0] || "";
  const parts = splitCollectionNameParts(suffix ? name.slice(0, -suffix.length) : name);
  if (buildCharacterPrefixKeys(characterName, characterAliases).includes(normalizeCollectionKey(parts[0]))) parts.shift();
  let version = "";
  const titleParts = [];
  for (const part of parts) {
    const pureVersion = /^v?\s*\d+(?:\.\d+){0,3}[a-z]?$/i.test(part);
    const stripped = pureVersion ? { text: "", version: part } : stripCollectionVersion(part);
    if (stripped.version) {
      if (version) return null;
      version = normalizeVersionLabel(stripped.version);
    }
    if (stripped.text) titleParts.push(stripped.text);
  }
  if (!version || !titleParts.length) return null;
  const collectionName = cleanCollectionText(titleParts.join("-") + suffix);
  const scope = mod.arknightsScope;
  const contentTypes = [...new Set(scope.contentTypes || [])].sort();
  if (!contentTypes.length) return null;
  return {
    mod,
    collectionName,
    collectionKey: JSON.stringify(["arknights", normalizeCollectionKey(collectionName), mod.appearanceSectionId || scope.sectionId || "", [...new Set(scope.sectionIds || [])].sort(), contentTypes]),
    variantName: "",
    variantVersion: version,
    explicitVersion: true,
  };
}
export function normalizeVersionLabel(value) {
  const text = cleanCollectionText(value);
  if (!text) return "";
  const collapsed = text.replace(/^v+/i, "v");
  const match = collapsed.match(/^v?\s*(\d+(?:\.\d+){0,3}[a-z]?)$/i);
  if (match) return `V${match[1]}`;
  return text.replace(/^v/i, "V");
}
export function parseVersionWeight(value) {
  const text = normalizeVersionLabel(value);
  const match = text.match(/^V(\d+(?:\.\d+){0,3})([a-z]?)$/i);
  if (!match)
    return {
      parts: [0],
      suffix: "",
      hasVersion: false,
    };
  const rawParts = match[1].split(".");
  const parts =
    rawParts.length === 2 && /^\d{2}$/.test(rawParts[1])
      ? [rawParts[0], rawParts[1][0], rawParts[1][1]]
      : rawParts;
  return {
    parts: parts.map((part) => Number(part) || 0),
    suffix: match[2] || "",
    hasVersion: true,
  };
}
export function compareVersionLabels(left, right) {
  const a = parseVersionWeight(left);
  const b = parseVersionWeight(right);
  if (a.hasVersion !== b.hasVersion) return a.hasVersion ? -1 : 1;
  const max = Math.max(a.parts.length, b.parts.length);
  for (let i = 0; i < max; i += 1) {
    const diff = (b.parts[i] || 0) - (a.parts[i] || 0);
    if (diff !== 0) return diff;
  }
  return String(a.suffix).localeCompare(String(b.suffix), "zh-CN");
}
