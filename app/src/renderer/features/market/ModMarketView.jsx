import { t } from "../../../shared/i18n/index.mjs";
import { useMarketFiltering } from "./hooks/useMarketFiltering.js";
import { useMarketSync } from "./hooks/useMarketSync.js";
import { useMarketDownloads } from "./hooks/useMarketDownloads.js";
import { MarketDownloadPrompt } from "./components/MarketDownloadPrompt.jsx";
import { MarketDetailDialog } from "./components/MarketDetailDialog.jsx";
import { MarketToolbar } from "./components/MarketToolbar.jsx";
import { MarketHeader } from "./components/MarketHeader.jsx";
import React from "react";
import ReactDOM from "react-dom";
import { readAuthSession } from "../../lib/authSession.js";
import {
  getCanonicalClientId,
  getCachedClientId,
} from "../../lib/clientIdentity.js";
import {
  getMarketSessionCache,
  createMarketSyncStatus,
  createLoginRequiredMarketAccess,
  readMarketCharacterPickerCache,
  normalizeMarketCharacterDetails,
  areStringMapsEqual,
  areCharacterDetailsEqual,
  getMarketScrollStorageKey,
  normalizeMarketScrollFilters,
  getMarketScrollFilterKey,
  readMarketScrollState,
  cancelMarketWork,
  scheduleMarketWork,
  logMarketPerf,
  clearMarketSessionCache,
  writeMarketSessionCache,
  writeMarketCharacterPickerCache,
  MARKET_SCROLL_RESTORE_MIN_TOP,
  removeMarketScrollState,
  writeMarketScrollState,
} from "./model/marketSession.js";
import {
  shouldHideControlledMarketCache,
  getMarketSnapshotSignature,
} from "./model/marketSnapshots.js";
import {
  createEmptyCollectionData,
  createMarketCharacterAliasIndex,
  normalizeMarketCardScale,
  getModGameId,
  buildCollectionData,
  getMarketCanonicalCharacterName,
  getMarketRecentDownloadScore,
  getMarketDownloadCount,
  filterVisibleMarketTags,
  getMarketCardMinWidth,
  getMarketCardGap,
  isHiddenMarketTag,
  getVariantVersionLabel,
  isMarketRecentlyPublished,
  buildImageList,
  getVariantLabel,
  getVariantSourceLabel,
  getCollectionCardTitle,
  getModModeLabel,
  getMarketVersionLabel,
} from "./model/marketCollections.js";
import { MarketImage } from "./components/MarketImage.jsx";
import { LightboxOverlay } from "../../components/LightboxOverlay.jsx";
import { ModFeedbackModal } from "./components/ModFeedbackModal.jsx";
import { Icon } from "../../components/Icon.jsx";
import { Menu, MenuItem } from "../../components/Menu.jsx";
import { SkeletonGrid, SourceError } from "../downloads/SourceStates.jsx";
// Images carry the card, so the stored scale maps onto a denser grid.
const getCardWidth = (scale) => Math.round(getMarketCardMinWidth(scale) * 0.8);
const getCardGap = (scale) => Math.round(getMarketCardGap(scale) * 0.6);
function ModMarketView({
  activeGameId,
  games = [],
  devMode = false,
  isActive = true,
  pendingDetailMod,
  onPendingDetailConsumed,
  sourceTabs,
}) {
  const initialMarketGameId = activeGameId || "endfield";
  const marketVisibleRef = React.useRef(isActive);
  marketVisibleRef.current = isActive;
  React.useEffect(
    () => () => {
      marketVisibleRef.current = false;
    },
    [],
  );
  const initialMarketSessionCache = getMarketSessionCache(initialMarketGameId);
  const initialAuthSession = readAuthSession();
  const initialCachedMarketAccess =
    initialMarketSessionCache?.syncStatus?.marketAccess;
  const initialCacheHiddenForAnonymous = shouldHideControlledMarketCache(
    initialCachedMarketAccess,
    Boolean(initialAuthSession?.token),
  );
  const [mods, setMods] = React.useState(() =>
    initialCacheHiddenForAnonymous ? [] : initialMarketSessionCache?.mods || [],
  );
  const [marketDataGameId, setMarketDataGameId] = React.useState(() =>
    initialMarketSessionCache?.mods?.length
      ? initialMarketSessionCache.gameId
      : null,
  );
  const [loading, setLoading] = React.useState(false);
  const [initialCacheReady, setInitialCacheReady] = React.useState(
    () =>
      Boolean(initialMarketSessionCache?.mods?.length) ||
      initialCacheHiddenForAnonymous,
  );
  const [syncing, setSyncing] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [serverUrl, setServerUrl] = React.useState(
    () => initialMarketSessionCache?.serverUrl || "https://qaqm.top",
  );
  const [syncStatus, setSyncStatus] = React.useState(() =>
    initialCacheHiddenForAnonymous
      ? createMarketSyncStatus(
          {
            refreshBlocked: true,
            marketAccess: createLoginRequiredMarketAccess(
              initialCachedMarketAccess,
            ),
          },
          initialMarketSessionCache?.syncStatus,
        )
      : initialMarketSessionCache?.syncStatus || null,
  );
  const [searchQuery, setSearchQuery] = React.useState(
    () => initialMarketSessionCache?.filters?.searchQuery || "",
  );
  const [selectedGameId, setSelectedGameId] = React.useState(
    () =>
      initialMarketSessionCache?.filters?.selectedGameId ||
      activeGameId ||
      "endfield",
  );
  const [selectedCharacter, setSelectedCharacter] = React.useState(
    () => initialMarketSessionCache?.filters?.selectedCharacter || "all",
  );
  const [selectedGameVersion, setSelectedGameVersion] = React.useState(
    () => initialMarketSessionCache?.filters?.selectedGameVersion || "all",
  );
  const [selectedModMode, setSelectedModMode] = React.useState(
    () => initialMarketSessionCache?.filters?.selectedModMode || "all",
  );
  const [likedOnly, setLikedOnly] = React.useState(
    () => initialMarketSessionCache?.filters?.likedOnly === true,
  );
  const [selectedTags, setSelectedTags] = React.useState(
    () => initialMarketSessionCache?.filters?.selectedTags || [],
  );
  const [sortBy, setSortBy] = React.useState(
    () => initialMarketSessionCache?.filters?.sortBy || "newest",
  );
  const PAGE_SIZE = 24;
  const [currentPage, setCurrentPage] = React.useState(
    () => initialMarketSessionCache?.currentPage || 1,
  );
  const [infiniteScroll, setInfiniteScroll] = React.useState(() => {
    const saved = localStorage.getItem("modmarket-infinite-scroll");
    return saved === null ? true : saved === "true";
  });
  const [equalRowHeight, setEqualRowHeight] = React.useState(() => {
    const saved = localStorage.getItem("modmarket-equal-row-height");
    return saved === null ? true : saved === "true";
  });
  const [showHotSection, setShowHotSection] = React.useState(() => {
    const saved = localStorage.getItem("modmarket-show-hot-section");
    return saved === null ? true : saved === "true";
  });
  const [lightboxData, setLightboxData] = React.useState(null);
  const [cardImageIdx, setCardImageIdx] = React.useState({});
  const [selectedCollectionVariants, setSelectedCollectionVariants] =
    React.useState({});
  const [detailMod, setDetailMod] = React.useState(null);
  const [detailGalleryIdx, setDetailGalleryIdx] = React.useState(0);
  const [closingDetail, setClosingDetail] = React.useState(false);
  const relatedScrollRef = React.useRef(null);
  const [feedbackTargetMod, setFeedbackTargetMod] = React.useState(null);
  const [toast, setToast] = React.useState(null);
  const [likedMods, setLikedMods] = React.useState(new Set());
  const [commentCounts, setCommentCounts] = React.useState({});
  const [modMarketCardScale, setModMarketCardScale] = React.useState(100);
  const [clientId, setClientId] = React.useState(
    () => getCachedClientId() || "",
  );
  React.useEffect(() => {
    let cancelled = false;
    getCanonicalClientId().then((id) => {
      if (cancelled) return;
      if (id && id !== clientId) setClientId(id);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const [showBackToTop, setShowBackToTop] = React.useState(false);
  const [showBackToMarketPosition, setShowBackToMarketPosition] =
    React.useState(false);
  const [savedMarketScroll, setSavedMarketScroll] = React.useState(null);
  const contentRef = React.useRef(null);
  const marketGridRef = React.useRef(null);
  const currentPageRef = React.useRef(1);
  const infiniteScrollRef = React.useRef(infiniteScroll);
  const marketScrollFiltersRef = React.useRef(null);
  const skipNextFilterPageResetRef = React.useRef(false);
  const pendingMarketRestoreRef = React.useRef(null);
  const marketRestoreTimerRef = React.useRef(null);
  const marketWarmupTimerRef = React.useRef(null);
  const marketModsRef = React.useRef(mods);
  const marketSyncStatusRef = React.useRef(syncStatus);
  const activeGameIdRef = React.useRef(activeGameId || null);
  const [marketGridColumns, setMarketGridColumns] = React.useState(4);
  React.useEffect(() => {
    marketModsRef.current = mods;
  }, [mods]);
  React.useEffect(() => {
    marketSyncStatusRef.current = syncStatus;
  }, [syncStatus]);
  const [serverGameVersions, setServerGameVersions] = React.useState(
    () => initialMarketSessionCache?.serverGameVersions || [],
  );
  const [defaultCharacterCovers, setDefaultCharacterCovers] = React.useState(
    () => initialMarketSessionCache?.defaultCharacterCovers || {},
  );
  const [defaultCharacterDetails, setDefaultCharacterDetails] = React.useState(
    () => initialMarketSessionCache?.defaultCharacterDetails || [],
  );
  const [marketCharacterAliasPools, setMarketCharacterAliasPools] =
    React.useState(
      () => initialMarketSessionCache?.marketCharacterAliasPools || [],
    );
  const [cachedCharacterPickerOptions, setCachedCharacterPickerOptions] =
    React.useState(() => ({
      roleOptions: [],
      functionOptions: [],
    }));
  const [marketWarmData, setMarketWarmData] = React.useState(() => ({
    ready: Boolean(
      initialMarketSessionCache?.marketWarmData?.ready &&
      initialMarketSessionCache?.mods?.length,
    ),
    sourceSignature: initialMarketSessionCache?.modsSignature || "",
    collectionData:
      initialMarketSessionCache?.marketWarmData?.collectionData ||
      createEmptyCollectionData(),
    characterStats:
      initialMarketSessionCache?.marketWarmData?.characterStats || new Map(),
  }));
  const [popularityData, setPopularityData] = React.useState(
    () => initialMarketSessionCache?.popularityData || {},
  );
  const loadedCommentCountIdsRef = React.useRef(new Set());
  const [showCharacterPicker, setShowCharacterPicker] = React.useState(false);
  const characterPickerRef = React.useRef(null);
  const gameOptions = React.useMemo(
    () =>
      games.map((game) => ({
        id: game.id,
        name: game.name,
      })),
    [games],
  );
  const gameNameMap = React.useMemo(
    () => Object.fromEntries(gameOptions.map((game) => [game.id, game.name])),
    [gameOptions],
  );
  const visibleGameIds = React.useMemo(
    () => new Set(games.map((game) => game.id)),
    [games],
  );
  React.useEffect(() => {
    if (selectedGameId !== "all" && !visibleGameIds.has(selectedGameId)) {
      setSelectedGameId(activeGameId || games[0]?.id || "all");
      setSelectedCharacter("all");
      setSelectedGameVersion("all");
      setSelectedModMode("all");
    }
    if (
      detailMod &&
      detailMod.gameId !== "all" &&
      !visibleGameIds.has(getModGameId(detailMod))
    ) {
      setDetailMod(null);
    }
  }, [visibleGameIds, selectedGameId, activeGameId, detailMod]);
  const marketGameId = gameOptions.some((game) => game.id === selectedGameId)
    ? selectedGameId
    : activeGameId || "endfield";
  const { silentlyRefreshMarket, syncMods } = useMarketSync({
    isActive,
    marketGameId,
    setInitialCacheReady,
    marketVisibleRef,
    setMods,
    setMarketDataGameId,
    setSyncStatus,
    serverUrl,
    setServerUrl,
    activeGameId,
    setSelectedGameId,
    setSyncing,
    setLoading,
    setError,
    mods,
    marketDataGameId,
    loadPopularityData,
    loadLikedMods,
    marketSyncStatusRef,
    setDetailMod,
    marketModsRef,
    setServerGameVersions,
  });
  const {
    downloadPrompt,
    setDownloadPrompt,
    handleDirectDownload,
    shouldShowDirectDownload,
    handleDownload,
  } = useMarketDownloads({
    serverUrl,
    setToast,
    clientId,
    setSyncStatus,
    silentlyRefreshMarket,
    syncMods,
  });
  const marketCharacterAliasIndex = React.useMemo(
    () => createMarketCharacterAliasIndex(marketCharacterAliasPools),
    [marketCharacterAliasPools],
  );
  const {
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
  } = useMarketFiltering({
    mods,
    visibleGameIds,
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
  });
  React.useEffect(() => {
    const cached = readMarketCharacterPickerCache(marketGameId);
    const cachedDetails = normalizeMarketCharacterDetails(
      cached?.characterDetails,
    );
    setCachedCharacterPickerOptions({
      roleOptions: cached?.roleOptions || [],
      functionOptions: cached?.functionOptions || [],
    });
    setDefaultCharacterCovers(cached?.covers || {});
    setDefaultCharacterDetails(cachedDetails);
    setMarketCharacterAliasPools(
      cachedDetails.map((item) => ({
        canonical: item.name,
        aliases: item.aliases,
      })),
    );
  }, [marketGameId]);
  React.useEffect(() => {
    if (!toast) return void 0;
    const timer = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timer);
  }, [toast]);
  React.useEffect(() => {
    let cancelled = false;
    window.api
      .getConfig?.()
      .then((result) => {
        if (cancelled || !result?.success) return;
        setModMarketCardScale(
          normalizeMarketCardScale(result.config?.modMarketCardSize),
        );
      })
      .catch(() => {});
    function handleCardSizeChanged(event) {
      setModMarketCardScale(normalizeMarketCardScale(event?.detail?.size));
    }
    window.addEventListener(
      "qaqm:mod-market-card-size-changed",
      handleCardSizeChanged,
    );
    return () => {
      cancelled = true;
      window.removeEventListener(
        "qaqm:mod-market-card-size-changed",
        handleCardSizeChanged,
      );
    };
  }, []);
  React.useEffect(() => {
    let cancelled = false;
    let timer = null;
    async function loadDefaultCharacterCovers() {
      try {
        const result = await window.api.getDefaultCharacters?.(marketGameId);
        if (cancelled || !result?.success) return;
        const covers = {};
        const details = [];
        if (Array.isArray(result.characterDetails)) {
          result.characterDetails.forEach((item) => {
            if (item?.name && item?.coverUrl) covers[item.name] = item.coverUrl;
            if (item?.name) {
              details.push({
                name: item.name,
                coverUrl: item.coverUrl || null,
                aliases: Array.isArray(item.aliases) ? item.aliases : [],
              });
            }
          });
        }
        const normalizedDetails = normalizeMarketCharacterDetails(details);
        setDefaultCharacterCovers((prev) =>
          areStringMapsEqual(prev, covers) ? prev : covers,
        );
        setDefaultCharacterDetails((prev) =>
          areCharacterDetailsEqual(prev, normalizedDetails)
            ? prev
            : normalizedDetails,
        );
      } catch {
        if (!cancelled) setDefaultCharacterCovers({});
      }
    }
    timer = window.setTimeout(
      loadDefaultCharacterCovers,
      showCharacterPicker ? 0 : 1800,
    );
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [marketGameId, showCharacterPicker]);
  React.useEffect(() => {
    if (!showCharacterPicker) return void 0;
    function handleDocClick(e) {
      if (
        characterPickerRef.current &&
        !characterPickerRef.current.contains(e.target)
      ) {
        setShowCharacterPicker(false);
      }
    }
    function handleKey(e) {
      if (e.key === "Escape") setShowCharacterPicker(false);
    }
    document.addEventListener("mousedown", handleDocClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleDocClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [showCharacterPicker]);
  React.useEffect(() => {
    if (!activeGameId || activeGameIdRef.current === activeGameId) return;
    activeGameIdRef.current = activeGameId;
    setSelectedGameId(activeGameId);
    setSelectedCharacter("all");
    setSelectedGameVersion("all");
    setSelectedModMode("all");
  }, [activeGameId]);
  const marketScrollStorageKey = getMarketScrollStorageKey(marketGameId);
  React.useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);
  React.useEffect(() => {
    infiniteScrollRef.current = infiniteScroll;
  }, [infiniteScroll]);
  const currentMarketScrollFilters = React.useMemo(
    () =>
      normalizeMarketScrollFilters({
        selectedGameId,
        searchQuery,
        selectedCharacter,
        selectedGameVersion,
        selectedModMode,
        likedOnly,
        sortBy,
        selectedTags,
        showHotSection,
      }),
    [
      selectedGameId,
      searchQuery,
      selectedCharacter,
      selectedGameVersion,
      selectedModMode,
      likedOnly,
      sortBy,
      selectedTags,
      showHotSection,
    ],
  );
  const currentMarketScrollFilterKey = React.useMemo(
    () => getMarketScrollFilterKey(currentMarketScrollFilters),
    [currentMarketScrollFilters],
  );
  React.useEffect(() => {
    marketScrollFiltersRef.current = currentMarketScrollFilters;
  }, [currentMarketScrollFilters]);
  React.useEffect(() => {
    const saved = readMarketScrollState(marketScrollStorageKey);
    setSavedMarketScroll(saved);
    setShowBackToMarketPosition(Boolean(saved));
  }, [marketScrollStorageKey]);
  const marketIsBooting =
    !initialCacheReady && marketDataGameId !== marketGameId;
  React.useEffect(() => {
    if (marketIsBooting) {
      if (marketWarmupTimerRef.current) {
        cancelMarketWork(marketWarmupTimerRef.current);
        marketWarmupTimerRef.current = null;
      }
      setMarketWarmData((prev) =>
        prev.ready || prev.sourceSignature
          ? {
              ready: false,
              sourceSignature: "",
              collectionData: prev.collectionData,
              characterStats: new Map(),
            }
          : prev,
      );
      return void 0;
    }
    const startedAt = performance.now();
    setMarketWarmData((prev) =>
      prev.sourceSignature === gameFilteredModsSignature
        ? prev
        : {
            ready: false,
            sourceSignature: gameFilteredModsSignature,
            collectionData: prev.collectionData,
            characterStats: new Map(),
          },
    );
    if (marketWarmupTimerRef.current) {
      cancelMarketWork(marketWarmupTimerRef.current);
      marketWarmupTimerRef.current = null;
    }
    marketWarmupTimerRef.current = scheduleMarketWork(() => {
      marketWarmupTimerRef.current = null;
      const buildStartedAt = performance.now();
      const nextCollectionData = buildCollectionData(
        gameFilteredMods,
        marketCharacterAliasIndex,
      );
      logMarketPerf(
        "buildCollectionData",
        buildStartedAt,
        `${gameFilteredMods.length} mods`,
      );
      const statsStartedAt = performance.now();
      const nextCharacterStats = (() => {
        const stats = new Map();
        gameFilteredMods.forEach((mod) => {
          const name = getMarketCanonicalCharacterName(
            mod.characterName,
            marketCharacterAliasIndex,
          );
          if (!name) return;
          const current = stats.get(name) || {
            count: 0,
            recentScore: 0,
            totalDownloads: 0,
          };
          current.count += 1;
          current.recentScore += getMarketRecentDownloadScore(
            mod,
            popularityData,
          );
          current.totalDownloads += getMarketDownloadCount(mod);
          stats.set(name, current);
        });
        return stats;
      })();
      logMarketPerf(
        "buildCharacterStats",
        statsStartedAt,
        `${nextCharacterStats.size} characters`,
      );
      setMarketWarmData({
        ready: true,
        sourceSignature: gameFilteredModsSignature,
        collectionData: nextCollectionData,
        characterStats: nextCharacterStats,
      });
      logMarketPerf(
        "marketWarmupTotal",
        startedAt,
        `${gameFilteredMods.length} mods`,
      );
    });
    return () => {
      if (marketWarmupTimerRef.current) {
        cancelMarketWork(marketWarmupTimerRef.current);
        marketWarmupTimerRef.current = null;
      }
    };
  }, [
    gameFilteredMods,
    gameFilteredModsSignature,
    popularityData,
    marketCharacterAliasIndex,
    marketIsBooting,
  ]);
  React.useEffect(() => {
    setSelectedTags((prev) => {
      const filtered = filterVisibleMarketTags(prev);
      return filtered.length === prev.length ? prev : filtered;
    });
  }, []);
  React.useEffect(() => {
    if (!marketGameId || marketDataGameId !== marketGameId) return;
    if (!mods.length) {
      if (!syncStatus?.refreshBlocked) clearMarketSessionCache(marketGameId);
      return;
    }
    writeMarketSessionCache(marketGameId, {
      mods,
      modsSignature: getMarketSnapshotSignature(mods),
      serverUrl,
      syncStatus,
      filters: currentMarketScrollFilters,
      currentPage,
      serverGameVersions,
      defaultCharacterCovers,
      defaultCharacterDetails,
      marketCharacterAliasPools,
      popularityData,
      marketWarmData: marketWarmData.ready
        ? {
            ready: true,
            sourceSignature: marketWarmData.sourceSignature,
            collectionData: marketWarmData.collectionData,
            characterStats: marketWarmData.characterStats,
          }
        : null,
    });
  }, [
    marketGameId,
    marketDataGameId,
    mods,
    serverUrl,
    syncStatus,
    currentMarketScrollFilters,
    currentPage,
    serverGameVersions,
    defaultCharacterCovers,
    defaultCharacterDetails,
    marketCharacterAliasPools,
    popularityData,
    marketWarmData,
  ]);
  React.useEffect(() => {
    if (
      !characterPickerOptions.roleOptions.length &&
      !characterPickerOptions.functionOptions.length
    )
      return;
    writeMarketCharacterPickerCache(marketGameId, {
      ...characterPickerOptions,
      covers: defaultCharacterCovers,
      characterDetails: defaultCharacterDetails,
    });
    setCachedCharacterPickerOptions(characterPickerOptions);
  }, [
    marketGameId,
    characterPickerOptions,
    defaultCharacterCovers,
    defaultCharacterDetails,
  ]);
  React.useEffect(() => {
    const grid = marketGridRef.current;
    if (!grid) return void 0;
    let rafId = null;
    const updateColumns = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        let columns = 0;
        if (equalRowHeight) {
          const computed = window.getComputedStyle(grid);
          columns = computed.gridTemplateColumns
            .split(" ")
            .filter((part) => part && part !== "none").length;
        } else {
          const minWidth = getCardWidth(modMarketCardScale);
          const gap = getCardGap(modMarketCardScale);
          columns = Math.max(
            1,
            Math.floor((grid.clientWidth + gap) / (minWidth + gap)),
          );
        }
        if (columns > 0) setMarketGridColumns(columns);
      });
    };
    updateColumns();
    const observer = new ResizeObserver(updateColumns);
    observer.observe(grid);
    window.addEventListener("resize", updateColumns);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      observer.disconnect();
      window.removeEventListener("resize", updateColumns);
    };
  }, [displayedMods.length, modMarketCardScale, equalRowHeight]);
  React.useEffect(() => {
    if (skipNextFilterPageResetRef.current) {
      skipNextFilterPageResetRef.current = false;
      return;
    }
    setCurrentPage(1);
  }, [
    searchQuery,
    selectedCharacter,
    selectedGameVersion,
    selectedModMode,
    likedOnly,
    sortBy,
    selectedGameId,
    selectedTags,
    showHotSection,
  ]);
  React.useEffect(() => {
    if (!isActive) return void 0;
    const el = document.querySelector(".main-content");
    if (!el) return;
    contentRef.current = el;
    let rafId = null;
    let loadingMore = false;
    const saveScroll = (allowClear = false) => {
      const scrollTop = Math.round(el.scrollTop || 0);
      if (scrollTop < MARKET_SCROLL_RESTORE_MIN_TOP) {
        if (allowClear) {
          const saved = readMarketScrollState(marketScrollStorageKey);
          const savedFilterKey = getMarketScrollFilterKey(saved?.filters);
          const currentFilterKey = getMarketScrollFilterKey(
            marketScrollFiltersRef.current,
          );
          if (!savedFilterKey || savedFilterKey === currentFilterKey) {
            removeMarketScrollState(marketScrollStorageKey);
            if (showBackToMarketPosition) {
              setSavedMarketScroll(null);
              setShowBackToMarketPosition(false);
            }
          }
        }
        return;
      }
      const payload = {
        scrollTop,
        page: Math.max(1, Number(currentPageRef.current || 1)),
        infiniteScroll: Boolean(infiniteScrollRef.current),
        filters: marketScrollFiltersRef.current,
        savedAt: Date.now(),
      };
      writeMarketScrollState(marketScrollStorageKey, payload);
    };
    const handler = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        setShowBackToTop(el.scrollTop > 300);
        saveScroll(true);
        if (
          infiniteScroll &&
          !loadingMore &&
          el.scrollHeight - el.scrollTop - el.clientHeight < 200
        ) {
          setCurrentPage((p) => {
            if (p * PAGE_SIZE < sectionedDisplayedMods.length) {
              loadingMore = true;
              setTimeout(() => {
                loadingMore = false;
              }, 300);
              return p + 1;
            }
            return p;
          });
        }
      });
    };
    el.addEventListener("scroll", handler, {
      passive: true,
    });
    return () => {
      saveScroll(false);
      el.removeEventListener("scroll", handler);
      if (rafId) cancelAnimationFrame(rafId);
      if (contentRef.current === el) contentRef.current = null;
    };
  }, [
    infiniteScroll,
    marketScrollStorageKey,
    sectionedDisplayedMods.length,
    showBackToMarketPosition,
    isActive,
  ]);
  async function loadPopularityData() {
    if (!marketVisibleRef.current || !serverUrl) return;
    try {
      const [today, week, month] = await Promise.all([
        fetch(`${serverUrl}/api/mods/popular/today`).then((r) => r.json()),
        fetch(`${serverUrl}/api/mods/popular/week`).then((r) => r.json()),
        fetch(`${serverUrl}/api/mods/popular/month`).then((r) => r.json()),
      ]);
      setPopularityData({
        hot_today: today.popular || [],
        hot_week: week.popular || [],
        hot_month: month.popular || [],
      });
    } catch (e) {
      console.error("Load popularity data failed:", e);
    }
  }
  async function loadLikedMods() {
    if (!marketVisibleRef.current || !serverUrl || !clientId) return;
    try {
      const res = await fetch(`${serverUrl}/api/mods/liked/${clientId}`);
      const data = await res.json();
      if (data.success) {
        setLikedMods(
          new Set((data.likedModIds || []).map((modId) => String(modId))),
        );
      }
    } catch (e) {
      console.error("Load liked mods failed:", e);
    }
  }
  React.useEffect(() => {
    loadLikedMods();
  }, [serverUrl, clientId, isActive]);
  React.useEffect(() => {
    if (!isActive || !serverUrl || pagedMods.length === 0) return;
    const timer = setTimeout(() => {
      loadCommentCounts(pagedMods);
    }, 500);
    return () => clearTimeout(timer);
  }, [serverUrl, pagedMods, isActive]);
  React.useEffect(() => {
    if (!isActive || !serverUrl || !detailMod?.id) return;
    if (loadedCommentCountIdsRef.current.has(String(detailMod.id))) return;
    loadCommentCounts([detailMod]);
  }, [serverUrl, detailMod, isActive]);
  async function loadCommentCounts(modsList) {
    if (!marketVisibleRef.current || !serverUrl) return;
    const ids = (modsList || [])
      .map((m) => m?.id)
      .filter(Boolean)
      .map((id) => String(id))
      .filter((id) => !loadedCommentCountIdsRef.current.has(id));
    if (!ids.length) return;
    try {
      const res = await fetch(
        `${serverUrl}/api/mod-comments/counts?modIds=${ids.join(",")}`,
      );
      const data = await res.json();
      if (data.success && data.counts) {
        ids.forEach((id) => loadedCommentCountIdsRef.current.add(id));
        setCommentCounts((prev) => ({
          ...prev,
          ...data.counts,
        }));
      }
    } catch (e) {
      console.error("Load comment counts failed:", e);
    }
  }
  async function handleToggleLike(modId) {
    if (!serverUrl) return;
    try {
      const res = await fetch(`${serverUrl}/api/mods/${modId}/like`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const likedModId = String(modId);
        setLikedMods((prev) => {
          const next = new Set(prev);
          if (data.liked) {
            next.add(likedModId);
          } else {
            next.delete(likedModId);
          }
          return next;
        });
      }
    } catch (e) {
      console.error("Like toggle failed:", e);
    }
  }
  function scrollToTop() {
    const el = document.querySelector(".main-content");
    if (el)
      el.scrollTo({
        top: 0,
        behavior: "smooth",
      });
  }
  function runPendingMarketRestore(smooth = false) {
    const pending = pendingMarketRestoreRef.current;
    if (!pending) return;
    const el = contentRef.current || document.querySelector(".main-content");
    if (!el) return;
    const maxTop = Math.max(0, el.scrollHeight - el.clientHeight);
    if (maxTop < pending.scrollTop - 24 && pending.attempts < 18) {
      pending.attempts += 1;
      marketRestoreTimerRef.current = setTimeout(
        () => runPendingMarketRestore(smooth),
        80,
      );
      return;
    }
    el.scrollTo({
      top: Math.min(pending.scrollTop, maxTop),
      behavior: smooth ? "smooth" : "auto",
    });
    pendingMarketRestoreRef.current = null;
    marketRestoreTimerRef.current = null;
  }
  function restoreMarketScrollPosition() {
    const saved =
      readMarketScrollState(marketScrollStorageKey) || savedMarketScroll;
    if (!saved) return;
    const targetPage = Math.max(1, Number(saved.page || 1));
    const savedFilters = normalizeMarketScrollFilters(saved.filters);
    const savedFilterKey = getMarketScrollFilterKey(savedFilters);
    const shouldRestoreFilters =
      savedFilterKey && savedFilterKey !== currentMarketScrollFilterKey;
    pendingMarketRestoreRef.current = {
      scrollTop: Math.max(0, Number(saved.scrollTop || 0)),
      attempts: 0,
    };
    if (shouldRestoreFilters) {
      skipNextFilterPageResetRef.current = true;
      setSelectedGameId(savedFilters.selectedGameId);
      setSearchQuery(savedFilters.searchQuery);
      setSelectedCharacter(savedFilters.selectedCharacter);
      setSelectedGameVersion(savedFilters.selectedGameVersion);
      setSelectedModMode(savedFilters.selectedModMode);
      setLikedOnly(savedFilters.likedOnly === true);
      setShowHotSection(savedFilters.showHotSection !== false);
      setSortBy(savedFilters.sortBy);
      setSelectedTags(filterVisibleMarketTags(savedFilters.selectedTags));
    }
    if (targetPage !== currentPageRef.current || shouldRestoreFilters) {
      setCurrentPage(targetPage);
    }
    setShowBackToMarketPosition(false);
    if (marketRestoreTimerRef.current)
      clearTimeout(marketRestoreTimerRef.current);
    marketRestoreTimerRef.current = setTimeout(
      () => runPendingMarketRestore(true),
      shouldRestoreFilters ? 160 : 60,
    );
  }
  React.useEffect(() => {
    return () => {
      if (marketRestoreTimerRef.current)
        clearTimeout(marketRestoreTimerRef.current);
    };
  }, []);
  function openModDetail(mod) {
    setClosingDetail(false);
    setDetailMod(mod);
    setDetailGalleryIdx(0);
  }
  function selectCollectionVariant(identity, variant, openDetail = false) {
    if (!identity || !variant) return;
    setSelectedCollectionVariants((prev) => ({
      ...prev,
      [identity]: variant.id,
    }));
    setCardImageIdx((prev) => ({
      ...prev,
      [`collection:${identity}`]: 0,
    }));
    if (openDetail) openModDetail(variant);
  }
  function closeDetailModal() {
    setClosingDetail(true);
    setTimeout(() => {
      setDetailMod(null);
      setClosingDetail(false);
    }, 250);
  }
  React.useEffect(() => {
    if (!detailMod || !relatedScrollRef.current) return;
    const active = relatedScrollRef.current.querySelector(
      ".detail-rail-item.active",
    );
    if (active) {
      active.scrollIntoView({
        block: "center",
        behavior: "smooth",
      });
    }
  }, [detailMod]);
  React.useEffect(() => {
    if (!pendingDetailMod) return;
    const match =
      mods.find((m) => m.id === pendingDetailMod.id) || pendingDetailMod;
    openModDetail(match);
    onPendingDetailConsumed?.();
  }, [pendingDetailMod]);
  function openFeedbackModal(mod) {
    setFeedbackTargetMod(mod);
  }
  function addTagFilter(tag) {
    if (isHiddenMarketTag(tag)) return;
    setSelectedTags((prev) => {
      if (prev.some((t) => t.id === tag.id)) return prev;
      return [...prev, tag];
    });
  }
  function removeTagFilter(tagId) {
    setSelectedTags((prev) => prev.filter((t) => t.id !== tagId));
  }
  function applyQuickFilter({
    gameId,
    character,
    gameVersion,
    closeDetail = false,
  }) {
    if (gameId) {
      setSelectedGameId(gameId);
    }
    if (character !== void 0) {
      setSelectedCharacter(
        character === "all"
          ? "all"
          : getMarketCanonicalCharacterName(
              character,
              marketCharacterAliasIndex,
            ),
      );
    }
    if (gameVersion !== void 0) {
      setSelectedGameVersion(gameVersion);
    }
    setSearchQuery("");
    setSelectedTags([]);
    if (closeDetail) {
      closeDetailModal();
    }
    requestAnimationFrame(() => scrollToTop());
  }
  function renderFilterTag({
    label,
    className = "chip",
    onClick,
    title = t("market.filters.categoryHint"),
  }) {
    return (
      <button
        type="button"
        className={className}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
        title={title}
      >
        {label}
      </button>
    );
  }
  function renderMarketCard(mod) {
    const cardKey = mod._displayKey || mod.id;
    const displayCharacterName = getMarketCanonicalCharacterName(
      mod.characterName || mod._originalCharacterName || "通用",
      marketCharacterAliasIndex,
    );
    const collectionVariants = Array.isArray(mod._collectionVariants)
      ? mod._collectionVariants
      : [];
    const selectedVariantIndex = collectionVariants.findIndex(
      (variant) => String(variant.id) === String(mod.id),
    );
    const selectedVariantVersion = getVariantVersionLabel(
      mod,
      selectedVariantIndex >= 0 ? selectedVariantIndex : 0,
    );
    const isPinnedCard = mod._marketSection === "pinned";
    const isHotCard = mod._marketSection === "hot";
    const isUpdatedCard = isMarketRecentlyPublished(mod);
    const images = buildImageList(mod);
    const imageIndex = Math.min(cardImageIdx[cardKey] || 0, images.length - 1);
    const liked = likedMods.has(String(mod.id));
    const openDetail = () => openModDetail(mod);
    const stepImage = (e, delta) => {
      e.stopPropagation();
      setCardImageIdx((prev) => ({
        ...prev,
        [cardKey]: ((prev[cardKey] || 0) + delta + images.length) % images.length,
      }));
    };
    return (
      <article
        className="media-card mod-card"
        tabIndex={0}
        aria-label={getCollectionCardTitle(mod)}
        onClick={openDetail}
        onKeyDown={(e) => {
          if (e.target === e.currentTarget && ["Enter", " "].includes(e.key)) {
            e.preventDefault();
            openDetail();
          }
        }}
        key={cardKey}
      >
        <div className="media-card-image mod-card-image">
          {images.length > 0 ? (
            <MarketImage
              src={images[imageIndex].url}
              alt={mod.name}
              className="market-image-card"
              key={`${cardKey}-${mod.id}-${imageIndex}`}
            />
          ) : (
            <div className="market-image-empty">
              <Icon name="image" size={24} />
            </div>
          )}
          {(isPinnedCard ||
            isHotCard ||
            isUpdatedCard ||
            mod._isCollectionCard) && (
            <div className="media-card-badges">
              {isPinnedCard && (
                <span className="image-badge">
                  {t("characters.actions.pinShort")}
                </span>
              )}
              {isHotCard && (
                <span className="image-badge">
                  {t("market.collections.popular")}
                </span>
              )}
              {isUpdatedCard && (
                <span className="image-badge">
                  {t("common.actions.update")}
                </span>
              )}
              {mod._isCollectionCard && (
                <span className="image-badge">
                  {t("market.collections.variantCount", {
                    collectionVariantsCount: collectionVariants.length,
                  })}
                </span>
              )}
            </div>
          )}
          <div className="media-card-actions">
            <button
              type="button"
              className={`image-btn ${liked ? "is-active" : ""}`}
              title={
                liked
                  ? t("market.actions.unfavorite")
                  : t("market.actions.favorite")
              }
              aria-label={
                liked
                  ? t("market.actions.unfavorite")
                  : t("market.actions.favorite")
              }
              aria-pressed={liked}
              onClick={(e) => {
                e.stopPropagation();
                handleToggleLike(mod.id);
              }}
            >
              <Icon
                name="heart"
                size={14}
                fill={liked ? "currentColor" : "none"}
              />
            </button>
          </div>
          {images.length > 1 && (
            <React.Fragment>
              <span className="image-badge media-card-corner">
                <Icon name="image" size={12} />
                {images.length}
              </span>
              <button
                type="button"
                className="image-btn media-card-nav is-previous"
                aria-label={t("market.images.previous")}
                onClick={(e) => stepImage(e, -1)}
              >
                <Icon name="chevron-left" size={16} />
              </button>
              <button
                type="button"
                className="image-btn media-card-nav is-next"
                aria-label={t("market.images.next")}
                onClick={(e) => stepImage(e, 1)}
              >
                <Icon name="chevron-right" size={16} />
              </button>
            </React.Fragment>
          )}
          {(shouldShowDirectDownload(mod) ||
            mod.downloadUrl ||
            mod.quarkDownloadUrl) && (
            <div className="media-card-downloads">
              {shouldShowDirectDownload(mod) && (
                <button
                  type="button"
                  className="image-pill"
                  title={t("market.actions.downloadAndInstall")}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDirectDownload(mod, "market_card");
                  }}
                >
                  <Icon name="download" size={13} />
                  {t("common.actions.download")}
                </button>
              )}
              {mod.downloadUrl && (
                <button
                  type="button"
                  className="image-pill"
                  title={t("market.actions.downloadBaidu")}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload(mod, mod.downloadUrl, "baidu", "market_card");
                  }}
                >
                  {t("market.sources.baidu")}
                </button>
              )}
              {mod.quarkDownloadUrl && (
                <button
                  type="button"
                  className="image-pill"
                  title={t("market.actions.downloadQuark")}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload(
                      mod,
                      mod.quarkDownloadUrl,
                      "quark",
                      "market_card",
                    );
                  }}
                >
                  {t("market.sources.quark")}
                </button>
              )}
            </div>
          )}
        </div>
        <div className="media-card-body">
          <h3
            className="media-card-title mod-card-title"
            title={getCollectionCardTitle(mod)}
          >
            {getCollectionCardTitle(mod)}
          </h3>
          <div className="media-card-meta">
            {renderFilterTag({
              label: displayCharacterName || t("settings.categories.general"),
              className: "meta-link",
              onClick: () =>
                applyQuickFilter({
                  gameId: getModGameId(mod),
                  character: displayCharacterName || "all",
                }),
              title: displayCharacterName
                ? t("market.filters.characterHint", {
                    displayCharacterName,
                  })
                : t("market.filters.sharedModHint"),
            })}
            <span title={(mod.modMode || "d3d") === "pak" ? "Pak Mod" : "3dm Mod"}>
              {getModModeLabel(mod.modMode || "d3d")}
            </span>
            {mod._isCollectionCard && collectionVariants.length > 1 ? (
              <span className="mod-card-variant" onClick={(e) => e.stopPropagation()}>
                <Menu
                  label={t("market.collections.title")}
                  align="start"
                  trigger={({ props }) => (
                    <button
                      type="button"
                      className="meta-link mod-card-variant-trigger"
                      {...props}
                    >
                      {selectedVariantVersion}
                      <Icon name="chevron-down" size={12} />
                    </button>
                  )}
                >
                  {collectionVariants.map((variant, index) => (
                    <MenuItem
                      role="menuitemradio"
                      aria-checked={String(variant.id) === String(mod.id)}
                      hint={getVariantSourceLabel(variant)}
                      onClick={() =>
                        selectCollectionVariant(mod._collectionIdentity, variant)
                      }
                      key={variant.id}
                    >
                      {getVariantLabel(variant, index)}
                    </MenuItem>
                  ))}
                </Menu>
              </span>
            ) : (
              renderFilterTag({
                label: getMarketVersionLabel(mod),
                className: "meta-link",
                onClick: () =>
                  mod.game_version
                    ? applyQuickFilter({
                        gameId: getModGameId(mod),
                        character: selectedCharacter,
                        gameVersion: mod.game_version,
                      })
                    : void 0,
                title: mod.game_version
                  ? t("market.filters.versionHint", {
                      mod: mod.game_version,
                    })
                  : t("mods.fields.version"),
              })
            )}
          </div>
        </div>
      </article>
    );
  }
  const marketReady = serverUrl && !loading && !marketIsBooting && !error;
  return (
    <div className="page mod-market-container">
      <MarketHeader
        sourceTabs={sourceTabs}
        syncing={syncing}
        syncStatus={syncStatus}
        infiniteScroll={infiniteScroll}
        setInfiniteScroll={setInfiniteScroll}
        setCurrentPage={setCurrentPage}
        equalRowHeight={equalRowHeight}
        setEqualRowHeight={setEqualRowHeight}
        showHotSection={showHotSection}
        setShowHotSection={setShowHotSection}
        loading={loading}
        serverUrl={serverUrl}
        syncMods={syncMods}
      />
      <MarketToolbar
        serverUrl={serverUrl}
        mods={mods}
        visibleSelectedTags={visibleSelectedTags}
        removeTagFilter={removeTagFilter}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        setSelectedTags={setSelectedTags}
        selectedGameId={selectedGameId}
        setSelectedGameId={setSelectedGameId}
        setSelectedCharacter={setSelectedCharacter}
        setSelectedGameVersion={setSelectedGameVersion}
        setSelectedModMode={setSelectedModMode}
        gameOptions={gameOptions}
        characterPickerRef={characterPickerRef}
        showCharacterPicker={showCharacterPicker}
        setShowCharacterPicker={setShowCharacterPicker}
        selectedCharacterLabel={selectedCharacterLabel}
        setCurrentPage={setCurrentPage}
        visibleCharacterPickerOptions={visibleCharacterPickerOptions}
        selectedCharacter={selectedCharacter}
        marketCharacterAliasIndex={marketCharacterAliasIndex}
        likedOnly={likedOnly}
        setLikedOnly={setLikedOnly}
        gameVersionOptions={gameVersionOptions}
        selectedGameVersion={selectedGameVersion}
        selectedModMode={selectedModMode}
        sortBy={sortBy}
        setSortBy={setSortBy}
        displayedMods={displayedMods}
        gameDisplayedMods={gameDisplayedMods}
      />
      <div className="page-body">
        {error && (
          <SourceError
            title={t("market.errors.load")}
            message={error}
            onRetry={() => syncMods(false)}
          />
        )}
        {!serverUrl && !error && (
          <div className="empty-state">
            <div className="empty-title">{t("market.errors.serverRequired")}</div>
          </div>
        )}
        {(loading || marketIsBooting) && (
          <SkeletonGrid count={12} label={t("market.status.loading")} />
        )}
        {marketReady && (
          <div
            className={[
              "mod-market-grid",
              equalRowHeight
                ? "mod-market-grid-equal"
                : "mod-market-grid-adaptive",
            ].join(" ")}
            style={{
              "--market-card-min": `${getCardWidth(modMarketCardScale)}px`,
              "--market-card-gap": `${getCardGap(modMarketCardScale)}px`,
            }}
            ref={marketGridRef}
          >
            {equalRowHeight
              ? pagedMods.map((mod) => renderMarketCard(mod))
              : adaptiveColumns.map((column, columnIndex) => (
                  <div
                    className="mod-market-column"
                    key={`market-column-${columnIndex}`}
                  >
                    {column.map(({ mod }) => renderMarketCard(mod))}
                  </div>
                ))}
            {initialCacheReady && sectionedDisplayedMods.length === 0 && (
              <div className="empty-state mod-market-no-results">
                <div className="empty-face">{"QAQ"}</div>
                <div className="empty-title">
                  {t("market.status.noMatchingMods")}
                </div>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedTags([]);
                    setSelectedCharacter("all");
                    setSelectedGameVersion("all");
                    setSelectedModMode("all");
                    setLikedOnly(false);
                  }}
                >
                  {t("market.filters.clearFilters")}
                </button>
              </div>
            )}
          </div>
        )}
        {marketReady && !infiniteScroll && sectionedDisplayedMods.length > 0 && (
          <div className="paw-pagination mod-market-pagination">
            <button
              type="button"
              className="btn btn-sm"
              aria-label={t("common.actions.previousPage")}
              onClick={() => {
                setCurrentPage((p) => Math.max(1, p - 1));
                scrollToTop();
              }}
              disabled={currentPage === 1}
            >
              <Icon name="chevron-left" size={14} />
            </button>
            {Array.from(
              {
                length: totalPages,
              },
              (_, i) => i + 1,
            )
              .filter(
                (p) =>
                  p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2,
              )
              .reduce((acc, p, idx, arr) => {
                if (idx > 0 && p - arr[idx - 1] > 1) acc.push("...");
                acc.push(p);
                return acc;
              }, [])
              .map((item, idx) =>
                item === "..." ? (
                  <span className="toolbar-label" key={`ellipsis-${idx}`}>
                    {"…"}
                  </span>
                ) : (
                  <button
                    type="button"
                    className={`btn btn-sm ${item === currentPage ? "btn-primary" : ""}`}
                    aria-current={item === currentPage ? "page" : void 0}
                    onClick={() => {
                      setCurrentPage(item);
                      scrollToTop();
                    }}
                    key={item}
                  >
                    {item}
                  </button>
                ),
              )}
            <button
              type="button"
              className="btn btn-sm"
              aria-label={t("common.actions.nextPage")}
              onClick={() => {
                setCurrentPage((p) => Math.min(totalPages, p + 1));
                scrollToTop();
              }}
              disabled={currentPage === totalPages}
            >
              <Icon name="chevron-right" size={14} />
            </button>
            <span className="toolbar-label">
              {t("market.status.pageSummary", {
                currentPage,
                totalPages,
                sectionedDisplayedModsCount: sectionedDisplayedMods.length,
              })}
            </span>
          </div>
        )}
      </div>
      {lightboxData &&
        isActive &&
        ReactDOM.createPortal(
          <LightboxOverlay
            images={lightboxData.images}
            index={lightboxData.index}
            onClose={() => setLightboxData(null)}
            onChange={(newIndex) =>
              setLightboxData((prev) =>
                prev
                  ? {
                      ...prev,
                      index: newIndex,
                    }
                  : null,
              )
            }
          />,
          document.body,
        )}
      <MarketDetailDialog
        detailMod={detailMod}
        isActive={isActive}
        closingDetail={closingDetail}
        closeDetailModal={closeDetailModal}
        displayedMods={displayedMods}
        relatedScrollRef={relatedScrollRef}
        openModDetail={openModDetail}
        detailGalleryIdx={detailGalleryIdx}
        setLightboxData={setLightboxData}
        setDetailGalleryIdx={setDetailGalleryIdx}
        detailCollectionGroup={detailCollectionGroup}
        selectCollectionVariant={selectCollectionVariant}
        marketCharacterAliasIndex={marketCharacterAliasIndex}
        renderFilterTag={renderFilterTag}
        gameNameMap={gameNameMap}
        applyQuickFilter={applyQuickFilter}
        selectedCharacter={selectedCharacter}
        addTagFilter={addTagFilter}
        serverUrl={serverUrl}
        clientId={clientId}
        devMode={devMode}
        likedMods={likedMods}
        handleToggleLike={handleToggleLike}
        commentCounts={commentCounts}
        openFeedbackModal={openFeedbackModal}
        shouldShowDirectDownload={shouldShowDirectDownload}
        handleDirectDownload={handleDirectDownload}
        handleDownload={handleDownload}
      />
      {isActive &&
        showBackToMarketPosition &&
        ReactDOM.createPortal(
          <button
            type="button"
            className={`btn btn-sm market-restore-position-btn ${showBackToTop ? "with-back-top" : ""}`}
            onClick={restoreMarketScrollPosition}
          >
            <Icon name="history" size={14} />
            {t("market.actions.restoreScroll")}
          </button>,
          document.body,
        )}
      {isActive &&
        showBackToTop &&
        ReactDOM.createPortal(
          <button
            type="button"
            className="icon-btn back-to-top-btn"
            onClick={scrollToTop}
            title={t("common.actions.backToTop")}
            aria-label={t("common.actions.backToTop")}
          >
            <Icon name="arrow-up" size={16} />
          </button>,
          document.body,
        )}
      <MarketDownloadPrompt
        downloadPrompt={downloadPrompt}
        isActive={isActive}
        setDownloadPrompt={setDownloadPrompt}
      />
      <ModFeedbackModal
        open={isActive && !!feedbackTargetMod}
        mod={feedbackTargetMod}
        clientId={clientId}
        serverUrl={serverUrl}
        onClose={() => setFeedbackTargetMod(null)}
        onSubmitted={(payload) => setToast(payload)}
      />
      {toast &&
        ReactDOM.createPortal(
          <div className={`toast toast-${toast.type || "success"}`}>
            {toast.message}
          </div>,
          document.body,
        )}
    </div>
  );
}
export { ModMarketView as default };
