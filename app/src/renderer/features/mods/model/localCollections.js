import {
  cleanCollectionText as cleanLocalCollectionText,
  normalizeCollectionKey as normalizeLocalCollectionKey,
  buildCharacterPrefixKeys as buildLocalCharacterPrefixKeys,
  splitCollectionNameParts as splitLocalModNameParts,
  stripCollectionVersion as stripLocalVariantVersion,
  normalizeVersionLabel as normalizeLocalVersionLabel,
  compareVersionLabels as compareLocalVersionLabels,
  parseArknightsCollectionName,
} from "../../../../shared/mod-collection-names.mjs";
function stripDisabledPrefix(name) {
  return String(name || "").replace(/^DISABLED_/i, "");
}
function parseLocalModCollectionName(
  mod,
  characterName,
  characterAliases = [],
) {
  if (mod?.arknightsScope) return parseArknightsCollectionName(mod, characterName, characterAliases);
  const name = cleanLocalCollectionText(mod?.name);
  if (!name) return null;
  const parts = splitLocalModNameParts(name);
  if (parts.length < 1) return null;
  const characterKeys = buildLocalCharacterPrefixKeys(
    characterName,
    characterAliases,
  );
  const firstPartIsCharacter = characterKeys.includes(
    normalizeLocalCollectionKey(parts[0]),
  );
  const bodyParts = firstPartIsCharacter ? parts.slice(1) : parts;
  if (!bodyParts.length) return null;
  const base = stripLocalVariantVersion(bodyParts[0]);
  const collectionName = cleanLocalCollectionText(base.text || bodyParts[0]);
  if (!collectionName) return null;
  let version = normalizeLocalVersionLabel(base.version);
  const variantParts = [];
  bodyParts.slice(1).forEach((part) => {
    const stripped = stripLocalVariantVersion(part);
    const explicitVersion = normalizeLocalVersionLabel(
      stripped.version || part,
    );
    const partIsPureVersion = /^v?\s*\d+(?:\.\d+){0,3}[a-z]?$/i.test(
      cleanLocalCollectionText(part),
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
    collectionKey: normalizeLocalCollectionKey(collectionName),
    variantName: cleanLocalCollectionText(variantParts.join("-")),
    variantVersion: version,
    explicitVersion: !!version,
  };
}
function getLocalVariantLabel(variant) {
  const version = cleanLocalCollectionText(variant?._localVersionLabel);
  const variantName = cleanLocalCollectionText(variant?._localVariantName);
  if (version && variantName) return `${version} · ${variantName}`;
  return version || variantName || "V1.0";
}
function buildLocalCollectionView(
  sortedMods,
  characterName,
  selectedVariants = {},
  characterAliases = [],
) {
  const characterIdentityKey =
    buildLocalCharacterPrefixKeys(characterName, characterAliases)[0] ||
    normalizeLocalCollectionKey(characterName);
  const records = sortedMods
    .map((mod, index) => {
      const parsed = parseLocalModCollectionName(
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
  const groups = new Map();
  const identityByPath = new Map();
  records.forEach((record) => {
    const { collectionKey, collectionName } = record;
    const identity = `${characterIdentityKey}:${collectionKey}`;
    if (!groups.has(identity)) {
      groups.set(identity, {
        identity,
        name: collectionName,
        firstIndex: record.index,
        records: [],
      });
    }
    groups.get(identity).records.push({
      ...record,
      identity,
    });
    if (record.mod?.path) identityByPath.set(record.mod.path, identity);
  });
  const collectionByPath = new Map();
  const displayMods = [];
  const displayedIdentities = new Set();
  for (const [identity, group] of groups.entries()) {
    const hasV10 = group.records.some(
      (record) => normalizeLocalVersionLabel(record.variantVersion) === "V1.0",
    );
    group.variants = group.records
      .map((record) => {
        const version =
          normalizeLocalVersionLabel(record.variantVersion) ||
          (hasV10 ? "V0.5" : "V1.0");
        return {
          ...record.mod,
          _localCollectionIdentity: identity,
          _localCollectionName: group.name,
          _localVariantName: record.variantName,
          _localVersionLabel: version,
          _localOriginalIndex: record.index,
        };
      })
      .sort(
        (a, b) =>
          compareLocalVersionLabels(
            a._localVersionLabel,
            b._localVersionLabel,
          ) ||
          cleanLocalCollectionText(a._localVariantName).localeCompare(
            cleanLocalCollectionText(b._localVariantName),
            "zh-CN",
          ) ||
          (a._localOriginalIndex || 0) - (b._localOriginalIndex || 0),
      );
    if (group.variants.length >= 2) {
      group.variants.forEach((variant) => {
        if (variant?.path)
          collectionByPath.set(variant.path, {
            identity,
            name: group.name,
            variants: group.variants,
          });
      });
    }
  }
  sortedMods.forEach((mod) => {
    const identity = mod?.path ? identityByPath.get(mod.path) : null;
    const group = identity ? groups.get(identity) : null;
    if (!group || group.variants.length < 2) {
      displayMods.push(mod);
      return;
    }
    if (displayedIdentities.has(identity)) return;
    displayedIdentities.add(identity);
    const selectedValue = selectedVariants[identity];
    const selectedVariant =
      group.variants.find((variant) => variant.name === selectedValue || variant.path === selectedValue) ||
      group.variants.find((variant) => variant.enabled) ||
      group.variants[0];
    displayMods.push({
      ...selectedVariant,
      _localCollection: {
        identity,
        name: group.name,
        variants: group.variants,
      },
    });
  });
  return {
    displayMods,
    collectionByPath,
  };
}
export {
  getLocalVariantLabel,
  cleanLocalCollectionText,
  buildLocalCollectionView,
  stripDisabledPrefix,
};
