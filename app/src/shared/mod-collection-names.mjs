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
