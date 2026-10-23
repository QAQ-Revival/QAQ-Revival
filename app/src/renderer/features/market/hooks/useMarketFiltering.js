import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
import {
  MARKET_FIRST_PAINT_LIMIT,
  logMarketPerf,
} from "../model/marketSession.js";
import { getMarketSnapshotSignature } from "../model/marketSnapshots.js";
import {
  getModGameId,
  normalizeMarketModCharacter,
  cleanCollectionText,
  EMPTY_COLLECTION_DATA,
  getMarketCanonicalCharacterName,
  getMarketDownloadCount,
  filterVisibleMarketTags,
  isMarketFunctionCategory,
  getExpandedMarketSearchQueries,
  parseClientCollectionName,
  normalizeCollectionKey,
  isSameMarketCharacterName,
  buildCollectionDisplayMods,
  splitMarketSections,
} from "../model/marketCollections.js";
export function useMarketFiltering({
  mods,
  selectedGameId,
  marketCharacterAliasIndex,
  searchQuery,
  selectedCharacter,
  selectedGameVersion,
  selectedModMode,
  likedOnly,
  selectedTags,
  sortBy,
  marketWarmData,
  defaultCharacterCovers,
  cachedCharacterPickerOptions,
  serverGameVersions,
  likedMods,
  popularityData,
  selectedCollectionVariants,
  marketGridColumns,
  showHotSection,
  detailMod,
  PAGE_SIZE,
  infiniteScroll,
  currentPage,
}) {
  const gameFilteredMods = React.useMemo(() => {
    return mods
      .filter((mod) => {
        if (selectedGameId === "all") return true;
        if (mod?.gameId === "all") return true;
        return getModGameId(mod) === selectedGameId;
      })
      .map((mod) =>
        normalizeMarketModCharacter(mod, marketCharacterAliasIndex),
      );
  }, [mods, selectedGameId, marketCharacterAliasIndex]);
  const gameFilteredModsSignature = React.useMemo(
    () => getMarketSnapshotSignature(gameFilteredMods),
    [gameFilteredMods],
  );
  const hasActiveMarketFilters =
    Boolean(cleanCollectionText(searchQuery)) ||
    selectedCharacter !== "all" ||
    selectedGameVersion !== "all" ||
    selectedModMode !== "all" ||
    likedOnly ||
    selectedTags.length > 0 ||
    sortBy !== "newest";
  const marketIsWarmed =
    marketWarmData.ready &&
    marketWarmData.sourceSignature === gameFilteredModsSignature;
  const collectionData = marketIsWarmed
    ? marketWarmData.collectionData
    : EMPTY_COLLECTION_DATA;
  const characterStats = marketWarmData.characterStats;
  const quickGameDisplayedMods = React.useMemo(
    () => gameFilteredMods.slice(0, MARKET_FIRST_PAINT_LIMIT),
    [gameFilteredMods],
  );
  const characterOptions = React.useMemo(() => {
    return Array.from(characterStats.keys()).sort((a, b) => {
      const statA = characterStats.get(a) || {};
      const statB = characterStats.get(b) || {};
      return (
        (statB.recentScore || 0) - (statA.recentScore || 0) ||
        (statB.totalDownloads || 0) - (statA.totalDownloads || 0) ||
        (statB.count || 0) - (statA.count || 0) ||
        a.localeCompare(b, "zh")
      );
    });
  }, [characterStats]);
  const selectedCharacterLabel =
    selectedCharacter === "all"
      ? t("characters.filter.all")
      : getMarketCanonicalCharacterName(
          selectedCharacter,
          marketCharacterAliasIndex,
        );
  const visibleSelectedTags = React.useMemo(
    () => filterVisibleMarketTags(selectedTags),
    [selectedTags],
  );
  const characterPickerOptions = React.useMemo(() => {
    const roleOptions = [];
    const functionOptions = [];
    characterOptions.forEach((name) => {
      const stats = characterStats.get(name) || {};
      const option = {
        name,
        coverUrl: defaultCharacterCovers[name] || null,
        count: stats.count || 0,
        recentScore: stats.recentScore || 0,
        totalDownloads: stats.totalDownloads || 0,
      };
      if (isMarketFunctionCategory(name)) {
        functionOptions.push(option);
      } else {
        roleOptions.push(option);
      }
    });
    return {
      roleOptions,
      functionOptions,
    };
  }, [characterOptions, characterStats, defaultCharacterCovers]);
  const visibleCharacterPickerOptions =
    characterPickerOptions.roleOptions.length ||
    characterPickerOptions.functionOptions.length
      ? characterPickerOptions
      : cachedCharacterPickerOptions;
  const gameVersionOptions = React.useMemo(() => {
    if (!marketIsWarmed) return [];
    const versions = new Set();
    gameFilteredMods.forEach((mod) => {
      if (mod.game_version) {
        versions.add(mod.game_version);
      }
    });
    serverGameVersions
      .filter((v) => selectedGameId === "all" || v.gameId === selectedGameId)
      .forEach((v) => versions.add(v.version));
    return Array.from(versions).sort((a, b) => b.localeCompare(a));
  }, [gameFilteredMods, serverGameVersions, selectedGameId, marketIsWarmed]);
  const filteredMods = React.useMemo(() => {
    if (!marketIsWarmed && !hasActiveMarketFilters) {
      return quickGameDisplayedMods;
    }
    const startedAt = performance.now();
    const searchQueries = getExpandedMarketSearchQueries(
      searchQuery,
      marketCharacterAliasIndex,
    );
    let result = gameFilteredMods.filter((mod) => {
      if (searchQueries.length > 0) {
        const parsedCollection = parseClientCollectionName(
          mod,
          marketCharacterAliasIndex,
        );
        const searchableText = [
          mod.name,
          mod.description,
          mod.characterName,
          mod._originalCharacterName,
          mod.collectionName,
          mod.variantName,
          mod.variantVersion,
          parsedCollection?.collectionName,
          parsedCollection?.variantName,
          parsedCollection?.variantVersion,
        ]
          .map((value) => String(value || "").toLowerCase())
          .join(" ");
        const searchableCompact = normalizeCollectionKey(searchableText);
        if (
          !searchQueries.some((query) => {
            const compactQuery = normalizeCollectionKey(query);
            return (
              searchableText.includes(query) ||
              (compactQuery && searchableCompact.includes(compactQuery))
            );
          })
        )
          return false;
      }
      if (
        selectedCharacter !== "all" &&
        !isSameMarketCharacterName(
          mod.characterName,
          selectedCharacter,
          marketCharacterAliasIndex,
        )
      )
        return false;
      if (
        selectedGameVersion !== "all" &&
        (mod.game_version || "") !== selectedGameVersion
      )
        return false;
      if (selectedModMode !== "all") {
        const modMode = mod.modMode === "pak" ? "pak" : "d3d";
        if (modMode !== selectedModMode) return false;
      }
      if (likedOnly && !likedMods.has(String(mod.id))) return false;
      if (selectedTags.length > 0) {
        const modTagIds = new Set((mod.tags || []).map((t) => t.id));
        if (!selectedTags.every((st) => modTagIds.has(st.id))) return false;
      }
      return true;
    });
    const pinnedSort = (a, b) => {
      const pinnedDiff = (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
      if (pinnedDiff !== 0) return pinnedDiff;
      return (a.sortOrder || 0) - (b.sortOrder || 0);
    };
    if (sortBy === "downloads") {
      result.sort(
        (a, b) =>
          pinnedSort(a, b) ||
          getMarketDownloadCount(b) - getMarketDownloadCount(a),
      );
    } else if (sortBy === "name") {
      result.sort(
        (a, b) =>
          pinnedSort(a, b) || (a.name || "").localeCompare(b.name || "", "zh"),
      );
    } else if (
      ["hot_today", "hot_week", "hot_month"].includes(sortBy) &&
      popularityData[sortBy]
    ) {
      const popMap = {};
      popularityData[sortBy].forEach((p) => {
        popMap[p.modId] = p.downloads;
      });
      result.sort(
        (a, b) => pinnedSort(a, b) || (popMap[b.id] || 0) - (popMap[a.id] || 0),
      );
    } else {
      result.sort(
        (a, b) =>
          pinnedSort(a, b) ||
          (b.updatedAt || "").localeCompare(a.updatedAt || ""),
      );
    }
    logMarketPerf(
      "filterAndSort",
      startedAt,
      `${result.length}/${gameFilteredMods.length} mods`,
    );
    return result;
  }, [
    gameFilteredMods,
    quickGameDisplayedMods,
    searchQuery,
    selectedCharacter,
    selectedGameVersion,
    selectedModMode,
    likedOnly,
    likedMods,
    sortBy,
    popularityData,
    selectedTags,
    marketCharacterAliasIndex,
    marketIsWarmed,
    hasActiveMarketFilters,
  ]);
  const gameDisplayedMods = React.useMemo(
    () =>
      marketIsWarmed
        ? buildCollectionDisplayMods(
            gameFilteredMods,
            selectedCollectionVariants,
            collectionData,
          )
        : gameFilteredMods,
    [
      gameFilteredMods,
      selectedCollectionVariants,
      collectionData,
      marketIsWarmed,
    ],
  );
  const displayedMods = React.useMemo(
    () =>
      marketIsWarmed
        ? buildCollectionDisplayMods(
            filteredMods,
            selectedCollectionVariants,
            collectionData,
          )
        : filteredMods,
    [filteredMods, selectedCollectionVariants, collectionData, marketIsWarmed],
  );
  const sectionedDisplayedMods = React.useMemo(() => {
    if (!marketIsWarmed && !hasActiveMarketFilters) return displayedMods;
    const startedAt = performance.now();
    const sectioned = splitMarketSections(displayedMods, marketGridColumns, {
      selectedCharacter,
      showHotSection,
    });
    logMarketPerf(
      "splitMarketSections",
      startedAt,
      `${sectioned.length} cards`,
    );
    return sectioned;
  }, [
    displayedMods,
    marketGridColumns,
    selectedCharacter,
    showHotSection,
    marketIsWarmed,
    hasActiveMarketFilters,
  ]);
  const detailCollectionGroup = React.useMemo(() => {
    if (!detailMod?.id) return null;
    const identity =
      detailMod._collectionIdentity ||
      collectionData.identityByModId.get(String(detailMod.id));
    return identity ? collectionData.groups.get(identity) || null : null;
  }, [detailMod, collectionData]);
  const totalPages = Math.max(
    1,
    Math.ceil(sectionedDisplayedMods.length / PAGE_SIZE),
  );
  const pagedMods = React.useMemo(
    () =>
      infiniteScroll
        ? sectionedDisplayedMods.slice(0, currentPage * PAGE_SIZE)
        : sectionedDisplayedMods.slice(
            (currentPage - 1) * PAGE_SIZE,
            currentPage * PAGE_SIZE,
          ),
    [currentPage, infiniteScroll, sectionedDisplayedMods],
  );
  const adaptiveColumns = React.useMemo(() => {
    const count = Math.max(1, marketGridColumns || 1);
    const columns = Array.from(
      {
        length: count,
      },
      () => [],
    );
    pagedMods.forEach((mod, index) => {
      columns[index % count].push({
        mod,
        index,
      });
    });
    return columns.filter((column) => column.length > 0);
  }, [pagedMods, marketGridColumns]);
  return {
    gameFilteredMods,
    gameFilteredModsSignature,
    selectedCharacterLabel,
    visibleSelectedTags,
    characterPickerOptions,
    visibleCharacterPickerOptions,
    gameVersionOptions,
    gameDisplayedMods,
    displayedMods,
    sectionedDisplayedMods,
    detailCollectionGroup,
    totalPages,
    pagedMods,
    adaptiveColumns,
  };
}
