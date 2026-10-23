import { t } from "../../../../shared/i18n/index.mjs";
import { readAuthSession } from "../../../lib/authSession.js";
function getModGameId(mod) {
  return mod?.gameId || "endfield";
}
function buildImageList(mod) {
  const raw =
    Array.isArray(mod?.images) && mod.images.length > 0
      ? mod.images
      : mod?.imageUrl
        ? [
            {
              url: mod.imageUrl,
            },
          ]
        : [];
  if (!mod?.imageUrl || raw.length <= 1) return raw;
  const coverIdx = raw.findIndex((img) => img.url === mod.imageUrl);
  if (coverIdx <= 0) return raw;
  const reordered = [...raw];
  reordered.splice(coverIdx, 1);
  reordered.unshift({
    url: mod.imageUrl,
  });
  return reordered;
}
function cleanCollectionText(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}
function normalizeCollectionKey(value) {
  return cleanCollectionText(value)
    .toLowerCase()
    .replace(/[【】\[\]（）(){}<>《》"'`]/g, "")
    .replace(/[\s_\-－–—.:：/\\]+/g, "");
}
const MARKET_CHARACTER_ALIAS_POOLS = [
  {
    canonical: "女主",
    aliases: ["铃", "玲", "Belle"],
  },
  {
    canonical: "洛瑟菈",
    aliases: ["露琪拉", "露西拉", "Lucilla"],
  },
  {
    canonical: "希希芙",
    aliases: ["茜茜娅", "Cissia"],
  },
  {
    canonical: "南宫羽",
    aliases: ["南宫玉", "NangongYu", "Nangong Yu"],
  },
  {
    canonical: "小吱",
    aliases: ["赤子", "Chiz"],
  },
];
function createMarketCharacterAliasIndex(extraPools = []) {
  const canonicalByKey = new Map();
  const aliasesByCanonicalKey = new Map();
  const aliasTextsByCanonicalKey = new Map();
  const addPool = (pool) => {
    const canonical = cleanCollectionText(
      pool?.canonical || pool?.displayName || pool?.name,
    );
    if (!canonical) return;
    const canonicalKey = normalizeCollectionKey(canonical);
    if (!canonicalKey) return;
    const values = [
      canonical,
      pool?.canonicalEnName,
      pool?.jasmName,
      ...(Array.isArray(pool?.aliases) ? pool.aliases : []),
    ]
      .map(cleanCollectionText)
      .filter(Boolean);
    if (!aliasesByCanonicalKey.has(canonicalKey))
      aliasesByCanonicalKey.set(canonicalKey, new Set());
    if (!aliasTextsByCanonicalKey.has(canonicalKey))
      aliasTextsByCanonicalKey.set(canonicalKey, new Set());
    const aliasSet = aliasesByCanonicalKey.get(canonicalKey);
    const aliasTextSet = aliasTextsByCanonicalKey.get(canonicalKey);
    values.forEach((value) => {
      const key = normalizeCollectionKey(value);
      if (!key) return;
      canonicalByKey.set(key, canonical);
      aliasSet.add(key);
      aliasTextSet.add(value);
    });
  };
  MARKET_CHARACTER_ALIAS_POOLS.forEach(addPool);
  extraPools.forEach(addPool);
  return {
    canonicalByKey,
    aliasesByCanonicalKey,
    aliasTextsByCanonicalKey,
  };
}
const DEFAULT_MARKET_CHARACTER_ALIAS_INDEX = createMarketCharacterAliasIndex();
function getMarketCanonicalCharacterName(
  name,
  aliasIndex = DEFAULT_MARKET_CHARACTER_ALIAS_INDEX,
) {
  const text = cleanCollectionText(name);
  if (!text) return "";
  return aliasIndex?.canonicalByKey?.get(normalizeCollectionKey(text)) || text;
}
function getMarketCharacterAliasKeys(
  name,
  aliasIndex = DEFAULT_MARKET_CHARACTER_ALIAS_INDEX,
) {
  const canonical = getMarketCanonicalCharacterName(name, aliasIndex);
  const canonicalKey = normalizeCollectionKey(canonical);
  if (!canonicalKey) return new Set();
  return (
    aliasIndex?.aliasesByCanonicalKey?.get(canonicalKey) ||
    new Set([canonicalKey])
  );
}
function isSameMarketCharacterName(
  a,
  b,
  aliasIndex = DEFAULT_MARKET_CHARACTER_ALIAS_INDEX,
) {
  const aKey = normalizeCollectionKey(a);
  const bKey = normalizeCollectionKey(b);
  if (!aKey || !bKey) return false;
  if (aKey === bKey) return true;
  const aAliases = getMarketCharacterAliasKeys(a, aliasIndex);
  return aAliases.has(bKey);
}
function isSameMarketCharacterToken(
  token,
  characterName,
  aliasIndex = DEFAULT_MARKET_CHARACTER_ALIAS_INDEX,
) {
  const text = cleanCollectionText(token);
  if (!text) return false;
  if (isSameMarketCharacterName(text, characterName, aliasIndex)) return true;
  const withoutVersion = stripCollectionVersionText(text);
  return (
    withoutVersion !== text &&
    isSameMarketCharacterName(withoutVersion, characterName, aliasIndex)
  );
}
function normalizeMarketModCharacter(
  mod,
  aliasIndex = DEFAULT_MARKET_CHARACTER_ALIAS_INDEX,
) {
  if (!mod) return mod;
  const originalCharacterName = cleanCollectionText(mod.characterName);
  const canonicalCharacterName = getMarketCanonicalCharacterName(
    originalCharacterName,
    aliasIndex,
  );
  if (
    !originalCharacterName ||
    canonicalCharacterName === originalCharacterName
  )
    return mod;
  return {
    ...mod,
    characterName: canonicalCharacterName,
    _originalCharacterName: originalCharacterName,
  };
}
const MARKET_FUNCTION_CATEGORY_KEYWORDS = [
  "大世界",
  "功能",
  "武器",
  "ui",
  "UI",
  "修复器",
  "修复",
  "通用",
  "魔法",
  "更新",
  "管理器",
  "光锥",
  "载具",
  "插件",
  "工具",
  "场景",
  "其他",
  "杂项",
];
const HIDDEN_MARKET_TAG_PATTERN = /(?:18\+|18禁|r18|r-18|nsfw|成人|涩涩|🔞)/i;
function isHiddenMarketTag(tag) {
  const id = cleanCollectionText(tag?.id || tag);
  const name = cleanCollectionText(tag?.name || tag?.label || tag);
  return (
    HIDDEN_MARKET_TAG_PATTERN.test(id) || HIDDEN_MARKET_TAG_PATTERN.test(name)
  );
}
function filterVisibleMarketTags(tags) {
  if (!Array.isArray(tags)) return [];
  return tags.filter((tag) => !isHiddenMarketTag(tag));
}
function isMarketFunctionCategory(name) {
  const text = cleanCollectionText(name);
  if (!text) return false;
  return MARKET_FUNCTION_CATEGORY_KEYWORDS.some((keyword) =>
    text.toLowerCase().includes(String(keyword).toLowerCase()),
  );
}
function getExpandedMarketSearchQueries(
  query,
  aliasIndex = DEFAULT_MARKET_CHARACTER_ALIAS_INDEX,
) {
  const normalizedQuery = cleanCollectionText(query).toLowerCase();
  if (!normalizedQuery) return [];
  const queries = new Set([normalizedQuery]);
  const compactQuery = normalizeCollectionKey(normalizedQuery);
  aliasIndex.aliasesByCanonicalKey.forEach((aliasKeys, canonicalKey) => {
    const aliases = new Set([canonicalKey, ...aliasKeys]);
    const matched = Array.from(aliases).some((aliasKey) => {
      return (
        aliasKey.includes(compactQuery) ||
        compactQuery.includes(aliasKey) ||
        (compactQuery &&
          aliasKey &&
          (aliasKey.includes(compactQuery) || compactQuery.includes(aliasKey)))
      );
    });
    if (matched) {
      const canonicalName = aliasIndex.canonicalByKey.get(canonicalKey);
      if (canonicalName) queries.add(canonicalName.toLowerCase());
      aliasIndex.aliasTextsByCanonicalKey
        ?.get(canonicalKey)
        ?.forEach((aliasText) => {
          const text = cleanCollectionText(aliasText).toLowerCase();
          if (text) queries.add(text);
        });
      aliases.forEach((aliasKey) => {
        if (aliasKey) queries.add(aliasKey);
      });
    }
  });
  return Array.from(queries);
}
function splitCollectionNameParts(name) {
  return cleanCollectionText(name)
    .split(/[-－–—]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}
function stripVariantVersion(value) {
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
function stripCollectionVersionText(value) {
  const stripped = stripVariantVersion(value);
  return cleanCollectionText(stripped.text || value);
}
function normalizeCollectionIdentityKey(value) {
  return normalizeCollectionKey(stripCollectionVersionText(value));
}
function normalizeVariantVersionLabel(value) {
  const text = cleanCollectionText(value);
  if (!text) return "";
  const collapsed = text.replace(/^v+/i, "v");
  const match = collapsed.match(/^v?\s*(\d+(?:\.\d+){0,3}[a-z]?)$/i);
  if (match) return `V${match[1]}`;
  return text.replace(/^v/i, "V");
}
function parseVariantVersionWeight(value) {
  const text = normalizeVariantVersionLabel(value);
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
function compareVariantVersionLabels(left, right) {
  const a = parseVariantVersionWeight(left);
  const b = parseVariantVersionWeight(right);
  if (a.hasVersion !== b.hasVersion) return a.hasVersion ? -1 : 1;
  const max = Math.max(a.parts.length, b.parts.length);
  for (let i = 0; i < max; i += 1) {
    const diff = (b.parts[i] || 0) - (a.parts[i] || 0);
    if (diff !== 0) return diff;
  }
  return String(a.suffix).localeCompare(String(b.suffix), "zh-CN");
}
function parseClientCollectionName(
  mod,
  aliasIndex = DEFAULT_MARKET_CHARACTER_ALIAS_INDEX,
) {
  const name = cleanCollectionText(mod?.name);
  if (!name) return null;
  const characterName = getMarketCanonicalCharacterName(
    mod?.characterName,
    aliasIndex,
  );
  let parts = splitCollectionNameParts(name);
  if (parts.length >= 2) {
    while (
      parts.length &&
      isSameMarketCharacterToken(parts[0], characterName, aliasIndex)
    ) {
      parts = parts.slice(1);
    }
    if (!parts.length) return null;
  } else if (
    characterName &&
    normalizeCollectionKey(name).startsWith(
      normalizeCollectionKey(characterName),
    )
  ) {
    const sliced = name.slice(characterName.length).replace(/^[-_－–—\s]+/, "");
    parts = splitCollectionNameParts(sliced || name);
  } else if (isSameMarketCharacterToken(name, characterName, aliasIndex)) {
    return null;
  }
  const body = parts.length ? parts.join("-") : name;
  const stripped = stripVariantVersion(body);
  const bodyParts = splitCollectionNameParts(stripped.text);
  const collectionName = cleanCollectionText(bodyParts[0] || stripped.text);
  const inlineVariant = cleanCollectionText(bodyParts.slice(1).join("-"));
  if (!collectionName) return null;
  return {
    collectionName,
    collectionKey: normalizeCollectionKey(collectionName),
    bodyCore: stripped.text,
    bodyKey: normalizeCollectionKey(stripped.text),
    variantName: cleanCollectionText(mod?.variantName) || inlineVariant,
    nameVariantVersion: stripped.version,
    hasNameVariantVersion: Boolean(stripped.version),
    variantVersion:
      cleanCollectionText(mod?.variantVersion) || stripped.version,
  };
}
function getExplicitCollectionIdentity(
  mod,
  aliasIndex = DEFAULT_MARKET_CHARACTER_ALIAS_INDEX,
) {
  if (!mod) return null;
  const gameId = getModGameId(mod);
  const characterName = getMarketCanonicalCharacterName(
    mod.characterName || "all",
    aliasIndex,
  );
  const explicitName = cleanCollectionText(mod.collectionName);
  const explicitKey = normalizeCollectionIdentityKey(
    mod.collectionKey || explicitName,
  );
  if (
    explicitKey &&
    isSameMarketCharacterToken(
      mod.collectionKey || explicitName,
      characterName,
      aliasIndex,
    )
  ) {
    return null;
  }
  if (explicitKey) return `name:${gameId}:${characterName}:${explicitKey}`;
  if (mod.collectionId)
    return `id:${gameId}:${characterName}:${mod.collectionId}`;
  return null;
}
function getExplicitCollectionMeta(
  mod,
  parsed,
  aliasIndex = DEFAULT_MARKET_CHARACTER_ALIAS_INDEX,
) {
  const explicitName = cleanCollectionText(mod?.collectionName);
  const strippedExplicitName = explicitName
    ? stripVariantVersion(explicitName)
    : null;
  const strippedExplicitKey = mod?.collectionKey
    ? stripVariantVersion(mod.collectionKey)
    : null;
  const characterName = getMarketCanonicalCharacterName(
    mod?.characterName,
    aliasIndex,
  );
  const collectionName =
    cleanCollectionText(strippedExplicitName?.text) ||
    cleanCollectionText(strippedExplicitKey?.text) ||
    parsed?.collectionName ||
    explicitName ||
    mod?.name;
  const normalizedCollectionName = isSameMarketCharacterToken(
    collectionName,
    characterName,
    aliasIndex,
  )
    ? parsed?.collectionName || ""
    : collectionName;
  const parsedVersion =
    parsed?.nameVariantVersion ||
    strippedExplicitName?.version ||
    strippedExplicitKey?.version ||
    "";
  return {
    collectionName: normalizedCollectionName,
    variantName:
      cleanCollectionText(mod?.variantName) || parsed?.variantName || "",
    parsedVersion,
  };
}
function createEmptyCollectionData() {
  return {
    groups: new Map(),
    identityByModId: new Map(),
  };
}
const EMPTY_COLLECTION_DATA = createEmptyCollectionData();
function getVariantLabel(mod, index = 0) {
  const parsed = parseClientCollectionName(mod);
  const version =
    normalizeVariantVersionLabel(mod?._clientEffectiveVariantVersion) ||
    normalizeVariantVersionLabel(mod?._clientVariantVersion) ||
    normalizeVariantVersionLabel(mod?.variantVersion) ||
    normalizeVariantVersionLabel(parsed?.variantVersion) ||
    "V1.0";
  const parts = [
    cleanCollectionText(mod?._clientVariantName) ||
      cleanCollectionText(mod?.variantName) ||
      parsed?.variantName,
    version,
  ].filter(Boolean);
  if (parts.length) return parts.join(" ");
  return `V${index + 1}.0`;
}
function getVariantVersionLabel(mod, index = 0) {
  const parsed = parseClientCollectionName(mod);
  return (
    normalizeVariantVersionLabel(mod?._clientEffectiveVariantVersion) ||
    normalizeVariantVersionLabel(mod?._clientVariantVersion) ||
    normalizeVariantVersionLabel(mod?.variantVersion) ||
    normalizeVariantVersionLabel(parsed?.variantVersion) ||
    `V${index + 1}.0`
  );
}
function getModModeLabel(modMode) {
  return modMode === "pak" ? "Pak" : "3dm";
}
function normalizeMarketCardScale(value) {
  if (value === "small") return 88;
  if (value === "large") return 122;
  if (value === "medium") return 100;
  const number = Number(value);
  if (!Number.isFinite(number)) return 100;
  return Math.min(140, Math.max(80, Math.round(number)));
}
function getMarketCardMinWidth(scale) {
  return Math.round((260 * normalizeMarketCardScale(scale)) / 100);
}
function getMarketCardGap(scale) {
  return Math.round((20 * normalizeMarketCardScale(scale)) / 100);
}
function getMarketCardImageMinHeight(scale) {
  return Math.round((190 * normalizeMarketCardScale(scale)) / 100);
}
function getMarketCardWideImageMinHeight(scale) {
  return Math.round((214 * normalizeMarketCardScale(scale)) / 100);
}
function getMarketCardImageMaxHeight(scale) {
  return Math.round((260 * normalizeMarketCardScale(scale)) / 100);
}
function getMarketVersionLabel(mod) {
  if (mod?.game_version) return mod.game_version;
  if (mod?.version) return `v${mod.version}`;
  return t("market.collections.versionUnspecified");
}
function hasMarketDirectSource(mod) {
  return !!mod?.hasDirectInstall;
}
function getMarketDownloadCount(mod) {
  const value =
    mod?.downloadCount ??
    mod?.downloads ??
    mod?.download_count ??
    mod?.totalDownloads ??
    mod?.downloadClicks ??
    0;
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}
const MARKET_UPDATE_BADGE_DURATION_MS = 24 * 60 * 60 * 1e3;
function getMarketRecentDownloadScore(mod, popularityData = {}) {
  const modId = String(mod?.id || "");
  const weekItem = Array.isArray(popularityData.hot_week)
    ? popularityData.hot_week.find(
        (item) => String(item?.modId || item?.id) === modId,
      )
    : null;
  const monthItem = Array.isArray(popularityData.hot_month)
    ? popularityData.hot_month.find(
        (item) => String(item?.modId || item?.id) === modId,
      )
    : null;
  const value =
    mod?.recentDownloadCount ??
    mod?.recentDownloads ??
    mod?.downloadsLast7Days ??
    mod?.weeklyDownloads ??
    mod?.weekDownloads ??
    weekItem?.downloads ??
    monthItem?.downloads ??
    0;
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}
function parseMarketTime(value) {
  if (!value) return 0;
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : 0;
  }
  const text = String(value).trim();
  if (!text) return 0;
  const direct = Date.parse(text);
  if (Number.isFinite(direct)) return direct;
  const normalized = text.replace(" ", "T");
  const normalizedTime = Date.parse(normalized);
  return Number.isFinite(normalizedTime) ? normalizedTime : 0;
}
function getMarketPublishTime(mod) {
  const variants = Array.isArray(mod?._collectionVariants)
    ? mod._collectionVariants
    : [mod];
  return Math.max(
    0,
    ...variants.map((item) =>
      parseMarketTime(
        item?.publishedAt ||
          item?.published_at ||
          item?.approvedAt ||
          item?.approved_at ||
          item?.createdAt ||
          item?.created_at ||
          item?.updatedAt ||
          item?.updated_at,
      ),
    ),
  );
}
function isMarketRecentlyPublished(mod, now = Date.now()) {
  const publishTime = getMarketPublishTime(mod);
  if (!publishTime) return false;
  return (
    publishTime <= now + 60 * 1e3 &&
    now - publishTime <= MARKET_UPDATE_BADGE_DURATION_MS
  );
}
function getCardDownloadCount(mod) {
  const variants = Array.isArray(mod?._collectionVariants)
    ? mod._collectionVariants
    : [];
  if (!variants.length) return getMarketDownloadCount(mod);
  return Math.max(
    getMarketDownloadCount(mod),
    ...variants.map(getMarketDownloadCount),
  );
}
function getMarketOrderValue(mod, keys, fallback = Number.MAX_SAFE_INTEGER) {
  for (const key of keys) {
    const value = Number(mod?.[key]);
    if (Number.isFinite(value)) return value;
  }
  return fallback;
}
function getMarketSectionValue(mod) {
  return String(
    mod?.marketSection ||
      mod?.homeSection ||
      mod?.section ||
      mod?.featuredSection ||
      mod?.displaySection ||
      "",
  ).toLowerCase();
}
function modHasTruthyFlag(mod, keys) {
  return keys.some((key) => {
    const value = mod?.[key];
    return (
      value === true ||
      value === 1 ||
      value === "1" ||
      String(value).toLowerCase() === "true"
    );
  });
}
function isMarketPinnedMod(mod) {
  const variants = Array.isArray(mod?._collectionVariants)
    ? mod._collectionVariants
    : [mod];
  return variants.some(
    (item) =>
      modHasTruthyFlag(item, [
        "pinned",
        "isPinned",
        "marketPinned",
        "homePinned",
        "featuredPinned",
      ]) ||
      ["pinned", "pin", "top", "sticky"].includes(getMarketSectionValue(item)),
  );
}
function isMarketHotMod(mod) {
  const variants = Array.isArray(mod?._collectionVariants)
    ? mod._collectionVariants
    : [mod];
  return variants.some(
    (item) =>
      modHasTruthyFlag(item, [
        "hot",
        "isHot",
        "marketHot",
        "homeHot",
        "popular",
        "isPopular",
      ]) ||
      ["hot", "popular", "trending"].includes(getMarketSectionValue(item)),
  );
}
const NON_MOD_HOT_CATEGORY_VALUES = new Set([
  "tool",
  "tools",
  "utility",
  "utilities",
  "manager",
  "fixer",
  "fix",
  "hotfix",
  "patch",
  "proxy",
  "vpn",
  "magic",
  "function",
  "feature",
  "functional",
  "工具",
  "工具类",
  "修复",
  "修复器",
  "修复工具",
  "修复补丁",
  "补丁",
  "管理器",
  "魔法",
  "功能",
  "功能mod",
  "功能 mod",
  "功能类",
  "前置",
  "前置mod",
  "前置 mod",
]);
const NON_MOD_HOT_TAG_VALUES = new Set([
  "tool",
  "tools",
  "utility",
  "utilities",
  "manager",
  "fixer",
  "fix",
  "hotfix",
  "patch",
  "proxy",
  "vpn",
  "magic",
  "工具",
  "工具类",
  "修复器",
  "修复工具",
  "修复补丁",
  "补丁",
  "管理器",
  "魔法",
]);
const NON_MOD_HOT_NAME_PATTERNS = [
  /^mod\s*修复(?:$|[-_－–—\s:：])/i,
  /^功能\s*mod(?:$|[-_－–—\s:：])/i,
  /^功能(?:$|[-_－–—\s:：])/,
  /^前置(?:$|[-_－–—\s:：])/,
  /^修复器(?:$|[-_－–—\s:：])/,
  /^修复工具(?:$|[-_－–—\s:：])/,
  /^修复补丁(?:$|[-_－–—\s:：])/,
  /^管理器(?:$|[-_－–—\s:：])/,
  /^魔法(?:$|[-_－–—\s:：])/,
  /qaq\s*manager/i,
  /qaqmanager/i,
  /(?:^|[-_－–—\s:：])hotfix(?:$|[-_－–—\s:：])/i,
  /(?:^|[-_－–—\s:：])fixer(?:$|[-_－–—\s:：])/i,
  /修复器/,
  /修复工具/,
  /修复补丁/,
  /修复文件/,
];
function normalizeMarketTypeText(value) {
  return cleanCollectionText(value).toLowerCase();
}
function getTagNameList(item) {
  if (!Array.isArray(item?.tags)) return [];
  return item.tags
    .map((tag) => cleanCollectionText(tag?.name || tag?.id || tag))
    .filter(Boolean);
}
function isNonModDownloadHotItem(item) {
  const categoryValues = [
    item?.marketType,
    item?.contentType,
    item?.resourceType,
    item?.category,
    item?.sourceCategory,
    item?.characterName,
  ]
    .map(normalizeMarketTypeText)
    .filter(Boolean);
  if (categoryValues.some((value) => NON_MOD_HOT_CATEGORY_VALUES.has(value)))
    return true;
  const tags = getTagNameList(item).map(normalizeMarketTypeText);
  if (tags.some((value) => NON_MOD_HOT_TAG_VALUES.has(value))) return true;
  const nameText = cleanCollectionText(
    [item?.name, item?.collectionName, item?._collectionName]
      .filter(Boolean)
      .join(" "),
  );
  return NON_MOD_HOT_NAME_PATTERNS.some((pattern) => pattern.test(nameText));
}
function isDownloadHotEligibleMod(mod) {
  const variants = Array.isArray(mod?._collectionVariants)
    ? mod._collectionVariants
    : [mod];
  return variants.every((item) => !isNonModDownloadHotItem(item));
}
function getDownloadHotCharacterKey(mod) {
  const variants = Array.isArray(mod?._collectionVariants)
    ? mod._collectionVariants
    : [mod];
  const names = variants
    .map((item) =>
      getMarketCanonicalCharacterName(
        item?.characterName || mod?.characterName || "",
      ),
    )
    .filter(Boolean);
  if (!names.length) return "";
  return normalizeCollectionKey(names[0]);
}
function getPinnedOrder(mod) {
  const variants = Array.isArray(mod?._collectionVariants)
    ? mod._collectionVariants
    : [mod];
  return Math.min(
    ...variants.map((item) =>
      getMarketOrderValue(item, [
        "pinnedOrder",
        "pinOrder",
        "homePinnedOrder",
        "sortOrder",
      ]),
    ),
  );
}
function getHotOrder(mod) {
  const variants = Array.isArray(mod?._collectionVariants)
    ? mod._collectionVariants
    : [mod];
  return Math.min(
    ...variants.map((item) =>
      getMarketOrderValue(item, [
        "hotOrder",
        "popularOrder",
        "homeHotOrder",
        "featuredOrder",
        "sortOrder",
      ]),
    ),
  );
}
function splitMarketSections(displayedMods, columnCount, options = {}) {
  const safeColumns = Math.max(1, Number(columnCount) || 4);
  const topCapacity = safeColumns * 2;
  const selectedCharacter = cleanCollectionText(options.selectedCharacter);
  const showHotSection = options.showHotSection !== false;
  const shouldDedupeDownloadHotByCharacter =
    !selectedCharacter || selectedCharacter === "all";
  const remaining = [...displayedMods];
  const take = (predicate, sorter) => {
    const matches = remaining.filter(predicate).sort(sorter);
    const ids = new Set(
      matches.map((mod) => String(mod._displayKey || mod.id)),
    );
    for (let i = remaining.length - 1; i >= 0; i--) {
      const key = String(remaining[i]._displayKey || remaining[i].id);
      if (ids.has(key)) remaining.splice(i, 1);
    }
    return matches;
  };
  const pinned = take(
    isMarketPinnedMod,
    (a, b) =>
      getPinnedOrder(a) - getPinnedOrder(b) ||
      (b.updatedAt || "").localeCompare(a.updatedAt || ""),
  ).map((mod) => ({
    ...mod,
    _marketSection: "pinned",
  }));
  const hotSlots = showHotSection
    ? Math.max(0, topCapacity - pinned.length)
    : 0;
  const explicitHot = remaining
    .filter(isMarketHotMod)
    .sort(
      (a, b) =>
        getHotOrder(a) - getHotOrder(b) ||
        getCardDownloadCount(b) - getCardDownloadCount(a) ||
        (b.updatedAt || "").localeCompare(a.updatedAt || ""),
    );
  const explicitHotKeys = new Set(
    explicitHot.map((mod) => String(mod._displayKey || mod.id)),
  );
  const hotCharacterKeys = shouldDedupeDownloadHotByCharacter
    ? new Set(explicitHot.map(getDownloadHotCharacterKey).filter(Boolean))
    : new Set();
  const downloadHot = remaining
    .filter(
      (mod) =>
        !explicitHotKeys.has(String(mod._displayKey || mod.id)) &&
        isDownloadHotEligibleMod(mod),
    )
    .sort(
      (a, b) =>
        getCardDownloadCount(b) - getCardDownloadCount(a) ||
        (b.updatedAt || "").localeCompare(a.updatedAt || ""),
    )
    .filter((mod) => {
      if (!shouldDedupeDownloadHotByCharacter) return true;
      const characterKey = getDownloadHotCharacterKey(mod);
      if (!characterKey) return true;
      if (hotCharacterKeys.has(characterKey)) return false;
      hotCharacterKeys.add(characterKey);
      return true;
    });
  const hot = showHotSection
    ? [...explicitHot, ...downloadHot].slice(0, hotSlots)
    : [];
  const hotKeys = new Set(hot.map((mod) => String(mod._displayKey || mod.id)));
  const updates = remaining
    .filter((mod) => !hotKeys.has(String(mod._displayKey || mod.id)))
    .map((mod) => ({
      ...mod,
      _marketSection: "updates",
    }));
  return [
    ...pinned,
    ...hot.map((mod) => ({
      ...mod,
      _marketSection: "hot",
    })),
    ...updates,
  ];
}
function getCollectionCardTitle(mod) {
  if (!mod?._isCollectionCard) return mod?.name || "";
  const collectionName = cleanCollectionText(
    mod._collectionName || mod.collectionName || mod.name,
  );
  const characterName = cleanCollectionText(mod.characterName);
  if (
    !collectionName ||
    !characterName ||
    characterName.toLowerCase() === "all"
  ) {
    return collectionName || mod?.name || "";
  }
  const collectionKey = normalizeCollectionKey(collectionName);
  const characterKey = normalizeCollectionKey(characterName);
  if (characterKey && collectionKey.startsWith(characterKey))
    return collectionName;
  return `${characterName}-${collectionName}`;
}
function getVariantSourceLabel(mod) {
  const sources = [];
  if (hasMarketDirectSource(mod) && readAuthSession()?.token)
    sources.push(t("common.actions.download"));
  if (mod?.downloadUrl) sources.push(t("market.sources.baidu"));
  if (mod?.quarkDownloadUrl) sources.push(t("market.sources.quark"));
  return sources.join(" / ") || t("market.collections.noDownload");
}
function compareCollectionVariants(a, b) {
  const orderDiff = (a.collectionSortOrder || 0) - (b.collectionSortOrder || 0);
  if (orderDiff !== 0) return orderDiff;
  const primaryDiff =
    (b.isCollectionPrimary ? 1 : 0) - (a.isCollectionPrimary ? 1 : 0);
  if (primaryDiff !== 0) return primaryDiff;
  const versionA = normalizeVariantVersionLabel(
    a._clientEffectiveVariantVersion ||
      a.variantVersion ||
      parseClientCollectionName(a)?.variantVersion,
  );
  const versionB = normalizeVariantVersionLabel(
    b._clientEffectiveVariantVersion ||
      b.variantVersion ||
      parseClientCollectionName(b)?.variantVersion,
  );
  if (versionA || versionB)
    return compareVariantVersionLabels(versionA, versionB);
  return (b.updatedAt || "").localeCompare(a.updatedAt || "");
}
function applyClientVariantVersionDefaults(
  group,
  aliasIndex = DEFAULT_MARKET_CHARACTER_ALIAS_INDEX,
) {
  const variants = group.variants.map((variant) => {
    const parsed = parseClientCollectionName(variant, aliasIndex);
    return {
      variant,
      nameVersion: normalizeVariantVersionLabel(
        variant?._clientNameVariantVersion || parsed?.nameVariantVersion,
      ),
      storedVersion: normalizeVariantVersionLabel(variant?.variantVersion),
    };
  });
  const hasNamedV10 = variants.some((item) => item.nameVersion === "V1.0");
  group.variants = variants.map(({ variant, nameVersion, storedVersion }) => {
    let effectiveVersion = nameVersion;
    if (!effectiveVersion) {
      effectiveVersion =
        hasNamedV10 && (!storedVersion || storedVersion === "V1.0")
          ? "V0.5"
          : storedVersion || "V1.0";
    }
    return {
      ...variant,
      _clientNameVariantVersion: nameVersion || "",
      _clientEffectiveVariantVersion: effectiveVersion,
    };
  });
}
function buildCollectionData(
  sourceMods = [],
  aliasIndex = DEFAULT_MARKET_CHARACTER_ALIAS_INDEX,
) {
  const records = sourceMods
    .map((mod) => {
      const parsed = parseClientCollectionName(mod, aliasIndex);
      const characterName = getMarketCanonicalCharacterName(
        mod?.characterName || "all",
        aliasIndex,
      );
      return {
        mod,
        parsed,
        explicitIdentity: getExplicitCollectionIdentity(mod, aliasIndex),
        gameId: getModGameId(mod),
        characterName,
      };
    })
    .filter((record) => record.mod?.id != null);
  const fallbackBuckets = new Map();
  records.forEach((record) => {
    if (record.explicitIdentity || !record.parsed?.collectionKey) return;
    const bucketKey = `${record.gameId}:${record.characterName}`;
    if (!fallbackBuckets.has(bucketKey)) fallbackBuckets.set(bucketKey, []);
    fallbackBuckets.get(bucketKey).push(record);
  });
  const groups = new Map();
  const identityByModId = new Map();
  function addToGroup(identity, collectionName, mod, meta = {}) {
    if (!groups.has(identity)) {
      groups.set(identity, {
        identity,
        name:
          cleanCollectionText(collectionName) || mod.collectionName || mod.name,
        variants: [],
      });
    }
    groups.get(identity).variants.push(
      Object.keys(meta).length
        ? {
            ...mod,
            ...meta,
          }
        : mod,
    );
    identityByModId.set(String(mod.id), identity);
  }
  records.forEach((record) => {
    if (!record.explicitIdentity) return;
    const explicitMeta = getExplicitCollectionMeta(
      record.mod,
      record.parsed,
      aliasIndex,
    );
    if (!cleanCollectionText(explicitMeta.collectionName)) return;
    addToGroup(
      record.explicitIdentity,
      explicitMeta.collectionName,
      record.mod,
      {
        _clientCollectionName: explicitMeta.collectionName,
        _clientVariantName: explicitMeta.variantName,
        _clientVariantVersion: explicitMeta.parsedVersion,
        _clientNameVariantVersion: explicitMeta.parsedVersion,
      },
    );
  });
  fallbackBuckets.forEach((bucket) => {
    const candidates = Array.from(
      new Map(
        bucket
          .filter((record) => record.parsed?.collectionKey)
          .map((record) => [
            record.parsed.collectionKey,
            record.parsed.collectionName,
          ]),
      ),
    ).sort((a, b) => a[0].length - b[0].length);
    bucket.forEach((record) => {
      const parsed = record.parsed;
      let collectionName = parsed.collectionName;
      let collectionKey = parsed.collectionKey;
      let variantName = parsed.variantName;
      for (const [candidateKey, candidateName] of candidates) {
        if (!candidateKey || candidateKey === collectionKey) continue;
        if (
          collectionKey.startsWith(candidateKey) &&
          candidateKey.length >= 2
        ) {
          collectionName = candidateName;
          collectionKey = candidateKey;
          if (!variantName && parsed.bodyCore.startsWith(candidateName)) {
            variantName = cleanCollectionText(
              parsed.bodyCore.slice(candidateName.length),
            );
          }
          break;
        }
      }
      const identity = `name:${record.gameId}:${record.characterName}:${collectionKey}`;
      addToGroup(identity, collectionName, record.mod, {
        _clientCollectionName: collectionName,
        _clientVariantName: variantName,
        _clientVariantVersion: parsed.nameVariantVersion,
        _clientNameVariantVersion: parsed.nameVariantVersion,
      });
    });
  });
  groups.forEach((group, identity) => {
    applyClientVariantVersionDefaults(group, aliasIndex);
    group.variants = [...group.variants].sort((a, b) =>
      compareCollectionVariants(a, b),
    );
    if (group.variants.length <= 1) {
      group.variants.forEach((mod) => identityByModId.delete(String(mod.id)));
      groups.delete(identity);
    }
  });
  return {
    groups,
    identityByModId,
  };
}
function buildCollectionDisplayMods(
  filteredMods,
  selectedCollectionVariants,
  collectionData,
) {
  if (!collectionData?.groups?.size) return filteredMods;
  const filteredByIdentity = new Map();
  filteredMods.forEach((mod) => {
    const identity = collectionData.identityByModId.get(String(mod.id));
    if (!identity || !collectionData.groups.has(identity)) return;
    if (!filteredByIdentity.has(identity)) filteredByIdentity.set(identity, []);
    filteredByIdentity.get(identity).push(mod);
  });
  const displayed = [];
  const seenIdentities = new Set();
  filteredMods.forEach((mod) => {
    const identity = collectionData.identityByModId.get(String(mod.id));
    const group = identity ? collectionData.groups.get(identity) : null;
    if (!group) {
      displayed.push(mod);
      return;
    }
    if (seenIdentities.has(identity)) return;
    seenIdentities.add(identity);
    const selectedId = selectedCollectionVariants[identity];
    const filteredGroup = filteredByIdentity.get(identity) || [];
    const selected =
      group.variants.find(
        (variant) => String(variant.id) === String(selectedId),
      ) ||
      group.variants.find((variant) =>
        filteredGroup.some((item) => item.id === variant.id),
      ) ||
      group.variants[0];
    displayed.push({
      ...selected,
      _displayKey: `collection:${identity}`,
      _isCollectionCard: true,
      _collectionIdentity: identity,
      _collectionName: group.name,
      _collectionVariants: group.variants,
      _collectionFilteredCount: filteredGroup.length,
    });
  });
  return displayed;
}
export {
  cleanCollectionText,
  filterVisibleMarketTags,
  createEmptyCollectionData,
  createMarketCharacterAliasIndex,
  normalizeMarketCardScale,
  getModGameId,
  normalizeMarketModCharacter,
  EMPTY_COLLECTION_DATA,
  buildCollectionData,
  getMarketCanonicalCharacterName,
  getMarketRecentDownloadScore,
  getMarketDownloadCount,
  isMarketFunctionCategory,
  getExpandedMarketSearchQueries,
  parseClientCollectionName,
  normalizeCollectionKey,
  isSameMarketCharacterName,
  buildCollectionDisplayMods,
  splitMarketSections,
  getMarketCardMinWidth,
  getMarketCardGap,
  hasMarketDirectSource,
  isHiddenMarketTag,
  getVariantVersionLabel,
  isMarketRecentlyPublished,
  buildImageList,
  getVariantLabel,
  getVariantSourceLabel,
  getCollectionCardTitle,
  getModModeLabel,
  getMarketVersionLabel,
  getMarketCardImageMinHeight,
  getMarketCardWideImageMinHeight,
  getMarketCardImageMaxHeight,
};
