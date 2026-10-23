import {
  cleanCollectionText,
  normalizeCollectionKey,
  buildCharacterPrefixKeys,
  splitCollectionNameParts,
  stripCollectionVersion,
  normalizeVersionLabel,
  parseVersionWeight,
  compareVersionLabels,
} from "../../shared/mod-collection-names.mjs";
export function parseOverlayCollectionName(
  mod,
  characterName,
  characterAliases = [],
) {
  const name = cleanCollectionText(mod?.name);
  if (!name) return null;
  const parts = splitCollectionNameParts(name);
  if (parts.length < 1) return null;
  const characterKeys = buildCharacterPrefixKeys(
    characterName,
    characterAliases,
  );
  const firstPartIsCharacter = characterKeys.includes(
    normalizeCollectionKey(parts[0]),
  );
  const bodyParts = firstPartIsCharacter ? parts.slice(1) : parts;
  if (!bodyParts.length) return null;
  const base = stripCollectionVersion(bodyParts[0]);
  const collectionName = cleanCollectionText(base.text || bodyParts[0]);
  if (!collectionName) return null;
  let version = normalizeVersionLabel(base.version);
  const variantParts = [];
  bodyParts.slice(1).forEach((part) => {
    const stripped = stripCollectionVersion(part);
    const explicitVersion = normalizeVersionLabel(stripped.version || part);
    const partIsPureVersion = /^v?\s*\d+(?:\.\d+){0,3}[a-z]?$/i.test(
      cleanCollectionText(part),
    );
    if (!version && (stripped.version || partIsPureVersion)) {
      version = explicitVersion;
    }
    if (stripped.text && !partIsPureVersion) {
      variantParts.push(stripped.text);
    }
  });
  return {
    mod,
    collectionName,
    collectionKey: normalizeCollectionKey(collectionName),
    variantName: cleanCollectionText(variantParts.join("-")),
    variantVersion: version,
  };
}
export function getCollectionVariantLabel(variant) {
  const version = cleanCollectionText(variant?._collectionVersionLabel);
  const variantName = cleanCollectionText(variant?._collectionVariantName);
  if (version && variantName) return `${version} · ${variantName}`;
  return version || variantName || "V1.0";
}
export function buildOverlayCollectionView(
  sortedMods,
  characterName,
  characterAliases = [],
  overlayCollectionSelections = {},
) {
  const characterIdentityKey =
    buildCharacterPrefixKeys(characterName, characterAliases)[0] ||
    normalizeCollectionKey(characterName);
  const records = sortedMods
    .map((mod, index) => {
      const parsed = parseOverlayCollectionName(
        mod,
        characterName,
        characterAliases,
      );
      return parsed
        ? {
            ...parsed,
            index,
          }
        : null;
    })
    .filter(Boolean);
  const candidateNames = new Map(
    records.map((record) => [record.collectionKey, record.collectionName]),
  );
  const groups = new Map();
  const identityByName = new Map();
  records.forEach((record) => {
    let collectionKey = record.collectionKey;
    let collectionName = record.collectionName;
    for (const [candidateKey, candidateName] of candidateNames.entries()) {
      if (
        !candidateKey ||
        candidateKey === collectionKey ||
        candidateKey.length < 2
      )
        continue;
      if (collectionKey.startsWith(candidateKey)) {
        collectionKey = candidateKey;
        collectionName = candidateName;
        break;
      }
    }
    let variantName = record.variantName;
    if (!variantName && collectionName !== record.collectionName) {
      const suffix = cleanCollectionText(
        record.collectionName.slice(collectionName.length),
      );
      if (suffix) variantName = suffix;
    }
    const identity = `${characterIdentityKey}:${collectionKey}`;
    if (!groups.has(identity)) {
      groups.set(identity, {
        identity,
        name: collectionName,
        records: [],
      });
    }
    groups.get(identity).records.push({
      ...record,
      collectionName,
      collectionKey,
      variantName,
      identity,
    });
    identityByName.set(record.mod.name, identity);
  });
  const displayMods = [];
  const displayedIdentities = new Set();
  for (const [identity, group] of groups.entries()) {
    const hasV10 = group.records.some(
      (record) => normalizeVersionLabel(record.variantVersion) === "V1.0",
    );
    group.variants = group.records
      .map((record) => {
        const version =
          normalizeVersionLabel(record.variantVersion) ||
          (hasV10 ? "V0.5" : "V1.0");
        return {
          ...record.mod,
          _collectionIdentity: identity,
          _collectionName: group.name,
          _collectionVariantName: record.variantName,
          _collectionVersionLabel: version,
          _collectionOriginalIndex: record.index,
        };
      })
      .sort(
        (a, b) =>
          compareVersionLabels(
            a._collectionVersionLabel,
            b._collectionVersionLabel,
          ) ||
          cleanCollectionText(a._collectionVariantName).localeCompare(
            cleanCollectionText(b._collectionVariantName),
            "zh-CN",
          ) ||
          (a._collectionOriginalIndex || 0) - (b._collectionOriginalIndex || 0),
      );
  }
  sortedMods.forEach((mod) => {
    const identity = identityByName.get(mod.name);
    const group = identity ? groups.get(identity) : null;
    if (!group || group.variants.length < 2) {
      displayMods.push(mod);
      return;
    }
    if (displayedIdentities.has(identity)) return;
    displayedIdentities.add(identity);
    const selectedName = overlayCollectionSelections[identity];
    const selectedVariant =
      group.variants.find((variant) => variant.name === selectedName) ||
      group.variants.find((variant) => variant.enabled) ||
      group.variants[0];
    displayMods.push({
      ...selectedVariant,
      _collection: {
        identity,
        name: group.name,
        variants: group.variants,
      },
    });
  });
  return displayMods;
}
