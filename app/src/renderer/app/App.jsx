import { t } from "../../shared/i18n/index.mjs";
import { WindowControls } from "../components/WindowControls.jsx";
import { SoftwareUpdateNotice } from "../features/settings/SoftwareUpdates.jsx";
import React from "react";
import { lazyWithPreload } from "../lib/lazyWithPreload.js";
import {
  DEFAULT_BG_OPACITY,
  DEFAULT_BG_BLUR,
  DEFAULT_BG_OVERLAY,
  getBackgroundRenderSize,
  getCompatibilityLevel,
  applyCompatibilityModeClass,
  normalizeCompatibilityLevel,
  readScopedBackgroundState,
  revokeGeneratedBackgroundUrl,
  renderBlurredBackgroundImage,
  revokeGeneratedBackgroundUrlSoon,
  isImageOnlyDrag,
} from "./background.js";
import {
  getAuthSessionIdentity,
  readAuthSession,
  subscribeAuthSession,
} from "../lib/authSession.js";
import { ThemeProvider } from "./ThemeProvider.jsx";
import { Sidebar } from "../components/Sidebar.jsx";
import { useGameOrder } from "../hooks/useGameOrder.js";
import { FloatingDownloadOrb } from "../features/downloads/FloatingDownloadOrb.jsx";
import { PublishProgressFloat } from "../features/market/components/PublishProgressFloat.jsx";
const CharacterView = lazyWithPreload(
  () => import("../features/characters/CharacterView.jsx"),
);
const ModView = lazyWithPreload(() => import("../features/mods/ModView.jsx"));
const SettingsView = lazyWithPreload(
  () => import("../features/settings/SystemSettings.jsx"),
);
const GameSettingsView = lazyWithPreload(
  () => import("../features/settings/GameSettings.jsx"),
);
const ModDownloadView = lazyWithPreload(
  () => import("../features/downloads/ModDownloadView.jsx"),
);
const PresetView = lazyWithPreload(
  () => import("../features/presets/PresetView.jsx"),
);
const GachaView = lazyWithPreload(
  () => import("../features/gacha/GachaView.jsx"),
);
const MarketUpdateToast = React.lazy(
  () => import("../features/market/components/MarketUpdateToast.jsx"),
);
const BatchCloudPanel = React.lazy(
  () => import("../features/market/components/BatchCloudPanel.jsx"),
);
const BatchAiPanel = React.lazy(
  () => import("../features/mods/components/BatchAiPanel.jsx"),
);
const LinkCheckerPanel = React.lazy(
  () => import("../features/market/components/LinkCheckerPanel.jsx"),
);
const PublishModDialog = React.lazy(
  () => import("../features/market/components/PublishModDialog.jsx"),
);
function App() {
  const [activeTab, setActiveTab] = React.useState("characters");
  const [selectedCharacter, setSelectedCharacter] = React.useState(null);
  const [managerTarget, setManagerTarget] = React.useState(null);
  const [gameKey, setGameKey] = React.useState(0);
  const [pendingBatchItems, setPendingBatchItems] = React.useState(null);
  const [pendingBatchContext, setPendingBatchContext] = React.useState(null);
  const [isDraggingFiles, setIsDraggingFiles] = React.useState(false);
  const dragCounterRef = React.useRef(0);
  const dropScanPendingRef = React.useRef(false);
  const [dropError, setDropError] = React.useState("");
  const [modViewKey, setModViewKey] = React.useState(0);
  const [pendingModMove, setPendingModMove] = React.useState(null);
  const [activeGame, setActiveGame] = React.useState(null);
  const activeGameIdRef = React.useRef(null);
  const [allGames, setGames] = React.useState([]);
  const gameOrder = useGameOrder(allGames);
  const games = gameOrder.items;
  React.useEffect(() => {
    if (activeTab === "gacha" && activeGame?.id && activeGame.id !== "wuthering-waves")
      setActiveTab("characters");
  }, [activeTab, activeGame?.id]);
  const [runtimeInfo, setRuntimeInfo] = React.useState(null);
  const [devMode, setDevMode] = React.useState(false);
  const [showDevPasswordModal, setShowDevPasswordModal] = React.useState(false);
  const [devPasswordInput, setDevPasswordInput] = React.useState("");
  const [devPasswordError, setDevPasswordError] = React.useState("");
  const [showBatchCloudPanel, setShowBatchCloudPanel] = React.useState(false);
  const [showBatchAiPanel, setShowBatchAiPanel] = React.useState(false);
  const [batchAiImageOnly, setBatchAiImageOnly] = React.useState(false);
  const [showLinkChecker, setShowLinkChecker] = React.useState(false);
  const [characterViewCache, setCharacterViewCache] = React.useState({});
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(() => {
    return localStorage.getItem("sidebarCollapsed") === "true";
  });
  const [customBg, setCustomBg] = React.useState(null);
  const [bgOpacity, setBgOpacity] = React.useState(DEFAULT_BG_OPACITY);
  const [bgBlur, setBgBlur] = React.useState(DEFAULT_BG_BLUR);
  const [bgOverlay, setBgOverlay] = React.useState(DEFAULT_BG_OVERLAY);
  const [renderSize, setRenderSize] = React.useState(() =>
    getBackgroundRenderSize(),
  );
  const [blurredBgUrl, setBlurredBgUrl] = React.useState(null);
  const blurredBgUrlRef = React.useRef(null);
  const [compatibilityLevel, setCompatibilityLevel] = React.useState(0);
  const [marketNewMods, setMarketNewMods] = React.useState([]);
  const [qaqmActive, setQaqmActive] = React.useState(false);
  const [pendingMarketMod, setPendingMarketMod] = React.useState(null);
  const [hasOpenedMarket, setHasOpenedMarket] = React.useState(false);
  const [publishTasks, setPublishTasks] = React.useState([]);
  React.useEffect(() => {
    window.api
      .getRuntimeInfo?.()
      .then((res) => {
        if (res) setRuntimeInfo(res);
      })
      .catch(() => {});
  }, []);
  const handleOpenPublishMod = React.useCallback((target) => {
    if (!target) return;
    setPublishTasks((prev) => {
      const existing = prev.find(
        (task) =>
          task.target?.modFolderPath === target.modFolderPath &&
          ["form", "publishing"].includes(task.state?.phase || "form"),
      );
      if (existing) {
        return prev.map((task) => ({
          ...task,
          visible: task.id === existing.id,
        }));
      }
      const id2 = `publish-ui-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      return [
        ...prev.map((task) => ({
          ...task,
          visible: false,
        })),
        {
          id: id2,
          target,
          visible: true,
          state: null,
          sessionKey: Date.now(),
        },
      ];
    });
  }, []);
  const updatePublishTaskState = React.useCallback((taskId, state) => {
    setPublishTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? {
              ...task,
              state,
            }
          : task,
      ),
    );
  }, []);
  const setPublishTaskVisible = React.useCallback((taskId, visible) => {
    setPublishTasks((prev) =>
      prev.map((task) => ({
        ...task,
        visible: visible
          ? task.id === taskId
          : task.id === taskId
            ? false
            : task.visible,
      })),
    );
  }, []);
  const handleClosePublishTask = React.useCallback((taskId) => {
    setPublishTasks((prev) => prev.filter((task) => task.id !== taskId));
  }, []);
  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", "light");
  }, []);
  React.useEffect(() => {
    async function applyUiPreferences() {
      try {
        const result = await window.api.getConfig();
        if (result.success) {
          const zoom = result.config.uiZoom;
          const ratio = ["4:3", "16:9", "16:10", "1:1", "3:4"].includes(
            result.config.modDownloadImageRatio,
          )
            ? result.config.modDownloadImageRatio
            : "4:3";
          document.documentElement.style.setProperty(
            "--mod-download-image-ratio",
            ratio.replace(":", " / "),
          );
          if (zoom && zoom !== 1) {
            document.documentElement.style.setProperty(
              "--ui-scale",
              String(zoom),
            );
          }
          const level = getCompatibilityLevel(result.config);
          setCompatibilityLevel(level);
          applyCompatibilityModeClass(level);
        }
      } catch (_) {}
    }
    applyUiPreferences();
  }, []);
  React.useEffect(() => {
    function handleCompatibilityModeChanged(event) {
      const level = normalizeCompatibilityLevel(
        event?.detail?.level ?? (event?.detail?.enabled ? 3 : 0),
      );
      setCompatibilityLevel(level);
      applyCompatibilityModeClass(level);
    }
    window.addEventListener(
      "qaqm:compatibility-mode-changed",
      handleCompatibilityModeChanged,
    );
    return () => {
      window.removeEventListener(
        "qaqm:compatibility-mode-changed",
        handleCompatibilityModeChanged,
      );
    };
  }, []);
  const handleSetActiveTab = React.useCallback((tab) => {
    if (tab === "pawchive") tab = "modmarket";
    if (
      ![
        "characters",
        "modmarket",
        "presets",
        "settings",
        "game-settings",
        "gacha",
      ].includes(tab)
    )
      return;
    if (tab === "characters") setModViewKey((k2) => k2 + 1);
    if (tab === "modmarket") setHasOpenedMarket(true);
    setActiveTab(tab);
    const preloaders = {
      characters: [CharacterView.preload, ModView.preload],
      modmarket: [ModDownloadView.preload],
      presets: [PresetView.preload],
      settings: [SettingsView.preload],
      gacha: [GachaView.preload],
    };
    (preloaders[tab] || []).forEach((fn) => {
      try {
        fn?.();
      } catch {}
    });
  }, []);
  React.useEffect(() => {
    const idle = window.requestIdleCallback || ((cb2) => setTimeout(cb2, 400));
    const cancelIdle = window.cancelIdleCallback || clearTimeout;
    const handle = idle(() => {
      try {
        ModView.preload?.();
      } catch {}
      try {
        CharacterView.preload?.();
      } catch {}
    });
    return () => {
      try {
        cancelIdle(handle);
      } catch {}
    };
  }, []);
  const handleToggleSidebar = React.useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebarCollapsed", String(next));
      return next;
    });
  }, []);
  const openManagerTarget = React.useCallback(
    async (payload) => {
      if (!payload?.characterName) return;
      const targetGameId = payload?.gameId;
      if (
        targetGameId &&
        activeGame?.id &&
        targetGameId !== activeGame.id &&
        window.api?.gameSwitch
      ) {
        const switchResult = await window.api.gameSwitch(targetGameId);
        if (!switchResult?.success) return;
        if (switchResult?.success) {
          await refreshGameState();
          setGameKey((k2) => k2 + 1);
          setModViewKey((k2) => k2 + 1);
        }
      }
      setActiveTab("characters");
      setSelectedCharacter(payload.characterName);
      setManagerTarget({
        ...payload,
        requestId: Date.now(),
      });
    },
    [activeGame?.id],
  );
  React.useEffect(() => {
    const cleanup = window.api.onOpenManagerTarget?.((payload) => {
      openManagerTarget(payload);
    });
    return () => {
      if (cleanup) cleanup();
    };
  }, [openManagerTarget]);
  React.useEffect(() => {
    const handler = (event) => {
      openManagerTarget(event?.detail);
    };
    window.addEventListener("qaqm-open-manager-target", handler);
    return () =>
      window.removeEventListener("qaqm-open-manager-target", handler);
  }, [openManagerTarget]);
  React.useEffect(() => {
    const handler = (e) => {
      const tab = e?.detail?.tab;
      if (typeof tab !== "string") return;
      handleSetActiveTab(tab);
    };
    window.addEventListener("qaqm-navigate", handler);
    return () => window.removeEventListener("qaqm-navigate", handler);
  }, [handleSetActiveTab]);
  React.useEffect(() => {
    const handler = async (event) => {
      const keepCurrentView = event?.detail?.keepCurrentView === true;
      if (!keepCurrentView) {
        setManagerTarget(null);
        setSelectedCharacter(null);
        handleSetActiveTab("characters");
        setModViewKey((k2) => k2 + 1);
      }
      await refreshGameState();
    };
    window.addEventListener("qaqm-pak-imported", handler);
    return () => window.removeEventListener("qaqm-pak-imported", handler);
  }, [handleSetActiveTab]);
  async function refreshGameState() {
    try {
      const result = await window.api.getConfig();
      if (result.success) {
        const nextId = result.config.activeGame?.id || null;
        if (activeGameIdRef.current && activeGameIdRef.current !== nextId) {
          setSelectedCharacter(null);
          setManagerTarget(null);
          setPendingBatchItems(null);
          setPendingBatchContext(null);
          setPendingModMove(null);
          setPendingMarketMod(null);
          setMarketNewMods([]);
        }
        activeGameIdRef.current = nextId;
        setActiveGame(result.config.activeGame || null);
        setGames(result.config.games || []);
      }
    } catch (e) {
      console.error("Failed to refresh game state:", e);
    }
  }
  React.useEffect(() => {
    refreshGameState();
    const cleanup = window.api.onGamesChanged?.(() => {
      refreshGameState();
    });
    return () => {
      if (cleanup) cleanup();
    };
  }, []);
  React.useEffect(() => {
    const nextState = readScopedBackgroundState(activeGame?.id);
    setCustomBg(nextState.customBg);
    setBgOpacity(nextState.bgOpacity);
    setBgBlur(nextState.bgBlur);
    setBgOverlay(nextState.bgOverlay);
  }, [activeGame?.id]);
  React.useEffect(() => {
    let frameId = null;
    const handleResize = () => {
      if (frameId) cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        setRenderSize(getBackgroundRenderSize());
        frameId = null;
      });
    };
    window.addEventListener("resize", handleResize);
    return () => {
      if (frameId) cancelAnimationFrame(frameId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);
  React.useEffect(() => {
    const effectiveBgForRender = compatibilityLevel >= 3 ? null : customBg;
    const blurValue = Math.max(0, Number(bgBlur) || 0);
    let cancelled = false;
    let renderTimer = null;
    async function renderBlurredBg() {
      if (!effectiveBgForRender || blurValue <= 0) {
        if (blurredBgUrlRef.current) {
          revokeGeneratedBackgroundUrl(blurredBgUrlRef.current);
          blurredBgUrlRef.current = null;
        }
        setBlurredBgUrl(null);
        return;
      }
      try {
        const nextUrl = await renderBlurredBackgroundImage(
          effectiveBgForRender,
          blurValue,
          renderSize,
        );
        if (cancelled) {
          revokeGeneratedBackgroundUrl(nextUrl);
          return;
        }
        const previousUrl = blurredBgUrlRef.current;
        blurredBgUrlRef.current = nextUrl;
        setBlurredBgUrl(nextUrl);
        if (previousUrl) {
          revokeGeneratedBackgroundUrlSoon(previousUrl);
        }
      } catch (error) {
        console.warn("Failed to pre-render custom background blur:", error);
        if (!cancelled) {
          if (blurredBgUrlRef.current) {
            revokeGeneratedBackgroundUrl(blurredBgUrlRef.current);
            blurredBgUrlRef.current = null;
          }
          setBlurredBgUrl(null);
        }
      }
    }
    renderTimer = setTimeout(renderBlurredBg, 120);
    return () => {
      cancelled = true;
      if (renderTimer) clearTimeout(renderTimer);
    };
  }, [
    customBg,
    bgBlur,
    renderSize.width,
    renderSize.height,
    renderSize.pixelRatio,
    compatibilityLevel,
  ]);
  React.useEffect(() => {
    return () => {
      if (blurredBgUrlRef.current) {
        revokeGeneratedBackgroundUrl(blurredBgUrlRef.current);
        blurredBgUrlRef.current = null;
      }
    };
  }, []);
  React.useEffect(() => {
    if (activeTab !== "modmarket" || !qaqmActive) return;
    const foregroundIntervalMs = 30 * 60 * 1e3;
    const foregroundJitterMs = 5 * 60 * 1e3;
    const hiddenRecheckMs = 10 * 60 * 1e3;
    let timer = null;
    let stopped = false;
    let running = false;
    let lastPollAt = 0;
    let authEpoch = 0;
    let authIdentity = getAuthSessionIdentity(readAuthSession());
    const isForeground = () =>
      document.visibilityState === "visible" && document.hasFocus();
    const schedulePoll = (delayMs) => {
      if (stopped) return;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(pollMarket, Math.max(1e3, delayMs));
    };
    async function pollMarket() {
      if (stopped || running) return;
      if (!isForeground()) {
        schedulePoll(hiddenRecheckMs);
        return;
      }
      running = true;
      lastPollAt = Date.now();
      const requestAuthEpoch = authEpoch;
      try {
        const result = await window.api.marketPoll?.(readAuthSession() || {});
        if (stopped || requestAuthEpoch !== authEpoch) return;
        if (!result?.success) return;
        window.dispatchEvent(
          new CustomEvent("qaqm:market-poll-result", {
            detail: result,
          }),
        );
        if (result.refreshBlocked) {
          setMarketNewMods([]);
          return;
        }
        if (result.stale || result.fromCache || !result.mods?.length) return;
        const gameId = result.gameId || "endfield";
        const seenKey = `market-seen-ids-${gameId}`;
        let seenIds;
        try {
          seenIds = new Set(JSON.parse(localStorage.getItem(seenKey) || "[]"));
        } catch {
          seenIds = new Set();
        }
        if (seenIds.size === 0) {
          localStorage.setItem(
            seenKey,
            JSON.stringify(result.mods.map((m2) => m2.id)),
          );
          return;
        }
        const newMods = result.mods.filter((m2) => !seenIds.has(m2.id));
        if (newMods.length > 0) {
          setMarketNewMods(newMods);
        }
      } catch (e) {
        console.error("Market poll failed:", e);
      } finally {
        running = false;
        schedulePoll(foregroundIntervalMs + Math.random() * foregroundJitterMs);
      }
    }
    const handleVisibilityChange = () => {
      if (!isForeground()) return;
      const overdue =
        !lastPollAt || Date.now() - lastPollAt >= foregroundIntervalMs;
      if (overdue) schedulePoll(15e3 + Math.random() * 6e4);
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleVisibilityChange);
    const unsubscribeAuth = subscribeAuthSession((session) => {
      const nextIdentity = getAuthSessionIdentity(session);
      if (nextIdentity === authIdentity) return;
      authIdentity = nextIdentity;
      authEpoch += 1;
      setMarketNewMods([]);
      const invalidation = window.api.invalidateMarketRequests?.();
      invalidation?.catch?.(() => {});
    });
    schedulePoll(2 * 60 * 1e3 + Math.random() * 3 * 60 * 1e3);
    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
      unsubscribeAuth?.();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleVisibilityChange);
      window.api.invalidateMarketRequests?.().catch(() => {});
    };
  }, [activeTab, qaqmActive]);
  const handleMarketToastDismiss = React.useCallback(() => {
    setMarketNewMods((prev) => {
      if (prev.length > 0) {
        const gameId = activeGame?.id || "endfield";
        const seenKey = `market-seen-ids-${gameId}`;
        try {
          const existing = new Set(
            JSON.parse(localStorage.getItem(seenKey) || "[]"),
          );
          prev.forEach((m2) => existing.add(m2.id));
          localStorage.setItem(seenKey, JSON.stringify([...existing]));
        } catch {}
      }
      return [];
    });
  }, [activeGame?.id]);
  const handleMarketToastModClick = React.useCallback(
    (mod) => {
      handleMarketToastDismiss();
      handleSetActiveTab("modmarket");
      setPendingMarketMod(mod);
    },
    [handleMarketToastDismiss, handleSetActiveTab],
  );
  const handleRequestMoveMod = React.useCallback(
    (payload) => {
      if (!payload?.characterName || !payload?.modName) return;
      setPendingModMove({
        ...payload,
        requestedAt: Date.now(),
      });
      setSelectedCharacter(null);
      handleSetActiveTab("characters");
    },
    [handleSetActiveTab],
  );
  function isDevModeShortcut(e) {
    return (
      e.ctrlKey &&
      e.shiftKey &&
      !e.altKey &&
      (e.code === "KeyL" || String(e.key || "").toLowerCase() === "l")
    );
  }
  React.useEffect(() => {
    function handleKeyDown(e) {
      if (isDevModeShortcut(e)) {
        e.preventDefault();
        if (devMode) {
          handleExitDevMode();
        } else {
          setDevPasswordInput("");
          setDevPasswordError("");
          setShowDevPasswordModal(true);
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [devMode]);
  async function handleDevPasswordSubmit() {
    const result = await window.api.devUnlock?.(devPasswordInput);
    if (result?.success) {
      setDevMode(true);
      setShowDevPasswordModal(false);
      setDevPasswordError("");
    } else {
      setDevPasswordError(
        result?.error || t("settings.developer.enableFailed"),
      );
    }
  }
  function handleExitDevMode() {
    setDevMode(false);
    window.api.devLock?.();
  }
  const handleGameSwitch = React.useCallback(async () => {
    setSelectedCharacter(null);
    setManagerTarget(null);
    setGameKey((k2) => k2 + 1);
    setModViewKey((k2) => k2 + 1);
    await refreshGameState();
  }, []);
  const handleDragLeave = React.useCallback((e) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDraggingFiles(false);
      dragCounterRef.current = 0;
    }
  }, []);
  const handleDragOver = React.useCallback(
    (e) => {
      if (selectedCharacter) {
        if (isDraggingFiles) setIsDraggingFiles(false);
        return;
      }
      if (e.dataTransfer.types.includes("Files")) {
        if (isImageOnlyDrag(e.dataTransfer)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        dragCounterRef.current = 1;
        setIsDraggingFiles(true);
      }
    },
    [selectedCharacter, isDraggingFiles],
  );
  const handleDroppedPaths = React.useCallback(
    async (paths) => {
      setIsDraggingFiles(false);
      dragCounterRef.current = 0;
      if (
        selectedCharacter ||
        dropScanPendingRef.current ||
        pendingBatchItems ||
        document.querySelector(
          ".batch-import-overlay, .modal-backdrop, .cropper-overlay",
        )
      )
        return;
      if (
        !paths.length ||
        paths.every((file) => /\.(png|jpg|jpeg|webp|gif|bmp)$/i.test(file))
      )
        return;
      if (!activeGame?.modFolderPath) {
        setDropError(t("characters.import.configureBeforeDrop"));
        return;
      }
      dropScanPendingRef.current = true;
      setDropError("");
      try {
        const result = await window.api.batchScanPaths([...new Set(paths)]);
        if (result?.error) throw new Error(result.error);
        if (!result?.items?.length)
          throw new Error(t("characters.import.noSupportedFiles"));
        const current = await window.api.getConfig();
        if ((current?.config || current)?.activeGameId !== activeGame.id)
          return;
        setSelectedCharacter(null);
        handleSetActiveTab("characters");
        setPendingBatchContext(null);
        setPendingBatchItems(result.items);
      } catch (error) {
        setDropError(
          error?.message || t("characters.import.scanDroppedFailed"),
        );
      } finally {
        dropScanPendingRef.current = false;
      }
    },
    [
      activeGame?.id,
      activeGame?.modFolderPath,
      handleSetActiveTab,
      selectedCharacter,
      pendingBatchItems,
    ],
  );
  React.useEffect(
    () =>
      window.api.onNativeFileDrop?.(({ paths }) => {
        // Native reception only supplies paths; the existing scan/review/install flow owns the import.
        if (Array.isArray(paths)) handleDroppedPaths(paths);
      }),
    [handleDroppedPaths],
  );
  React.useEffect(
    () =>
      window.api.onNativeFileDragState?.((dragging) => {
        setIsDraggingFiles(
          !!dragging &&
            !selectedCharacter &&
            !dropScanPendingRef.current &&
            !document.querySelector(
              ".batch-import-overlay, .modal-backdrop, .cropper-overlay",
            ),
        );
      }),
    [selectedCharacter],
  );
  React.useEffect(() => {
    if (!dropError) return;
    const timer = setTimeout(() => setDropError(""), 5000);
    return () => clearTimeout(timer);
  }, [dropError]);
  const handleDrop = React.useCallback(
    async (e) => {
      if (selectedCharacter) {
        setIsDraggingFiles(false);
        dragCounterRef.current = 0;
        return;
      }
      e.preventDefault();
      dragCounterRef.current = 0;
      setIsDraggingFiles(false);
      const files = Array.from(e.dataTransfer.files);
      const allImages =
        files.length > 0 &&
        files.every(
          (f2) =>
            f2.type.startsWith("image/") ||
            /\.(png|jpg|jpeg|webp|gif|bmp)$/i.test(f2.name),
        );
      if (allImages) return;
      const paths = files
        .map((f2) => window.api.getPathForFile(f2))
        .filter(Boolean);
      if (!paths.length) return;
      await handleDroppedPaths(paths);
    },
    [handleDroppedPaths, selectedCharacter],
  );
  const handleRequestBatchImportReview = React.useCallback(
    (items, context = {}) => {
      if (!Array.isArray(items) || !items.length) return;
      setPendingBatchContext({
        preferredCharacter:
          context.preferredCharacter || selectedCharacter || "",
      });
      setPendingBatchItems(items);
      setSelectedCharacter(null);
      handleSetActiveTab("characters");
    },
    [handleSetActiveTab, selectedCharacter],
  );
  const handleImportDownloadedTask = React.useCallback(
    async (task) => {
      const gameId = activeGame?.id;
      if (!gameId || !activeGame?.modFolderPath)
        throw new Error(t("characters.import.configureBeforeImport"));
      const source = await (
        task.provider === "archive"
          ? window.api.attachmentImportPaths
          : window.api.megaRevivalImportPaths
      )(task.taskId);
      if (!source?.success)
        throw new Error(source?.error || t("downloads.errors.readFile"));
      const scanned = await window.api.batchScanPaths(source.paths);
      if (scanned?.error) throw new Error(scanned.error);
      if (!scanned?.items?.length)
        throw new Error(t("characters.import.checkDownloadedFile"));
      const configResult = await window.api.getConfig();
      if ((configResult?.config || configResult)?.activeGameId !== gameId)
        throw new Error(t("characters.import.gameChanged"));
      handleRequestBatchImportReview(scanned.items);
    },
    [activeGame?.id, activeGame?.modFolderPath, handleRequestBatchImportReview],
  );
  const gameScopeKey = activeGame?.id || `unknown-${gameKey}`;
  const characterScopeKey = [
    activeGame?.id || "__unknown__",
    activeGame?.modFolderPath || "",
    activeGame?.launchMode || "",
    activeGame?.dx12DisabledModsDir || "",
  ].join("|");
  const characterCacheKey = characterScopeKey;
  const currentCharacterViewCache =
    characterViewCache[characterCacheKey] || null;
  const handleCharacterCacheChange = React.useCallback(
    (nextCache) => {
      setCharacterViewCache((prev) => ({
        ...prev,
        [characterCacheKey]: nextCache,
      }));
    },
    [characterCacheKey],
  );
  const handleCharacterModsChanged = React.useCallback(
    ({ characterName, mods } = {}) => {
      if (!characterName || !Array.isArray(mods)) return;
      setCharacterViewCache((prev) => {
        const currentCache = prev[characterCacheKey] || {};
        const currentCharacters = Array.isArray(currentCache.characters)
          ? currentCache.characters
          : [];
        return {
          ...prev,
          [characterCacheKey]: {
            ...currentCache,
            characters: currentCharacters.map((character) =>
              character?.name === characterName
                ? {
                    ...character,
                    modCount: mods.length,
                    enabledCount: mods.filter((mod) => mod?.enabled).length,
                  }
                : character,
            ),
            needsRefresh: false,
          },
        };
      });
    },
    [characterCacheKey],
  );
  React.useEffect(() => {
    const cleanup = window.api.onModsChanged?.((data = {}) => {
      setCharacterViewCache((prev) => {
        const currentCache = prev[characterCacheKey];
        if (!currentCache) return prev;
        return {
          ...prev,
          [characterCacheKey]: {
            ...currentCache,
            needsRefresh: true,
            staleCharacterName: data?.characterName || "__all__",
          },
        };
      });
    });
    return () => {
      if (cleanup) cleanup();
    };
  }, [activeTab, characterCacheKey, selectedCharacter]);
  const compatibilityMode = compatibilityLevel > 0;
  const effectiveCustomBg = compatibilityLevel >= 3 ? null : customBg;
  const normalizedBgBlur = Math.max(0, Number(bgBlur) || 0);
  const normalizedBgOverlay = Math.max(
    0,
    Math.min(0.8, Number(bgOverlay) || 0),
  );
  const bgNeedsBlur = normalizedBgBlur > 0;
  const customBgClass = effectiveCustomBg
    ? `custom-bg-active ${!bgNeedsBlur && normalizedBgOverlay === 0 ? "custom-bg-clear" : ""}`
    : "";
  return (
    <ThemeProvider>
      <div
        className={`app-container ${customBgClass} ${compatibilityMode ? `compatibility-mode compatibility-level-${compatibilityLevel}` : ""} ${isDraggingFiles ? "dragging-files" : ""}`}
        data-drop-hint={t("characters.import.globalDropHint")}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        style={
          effectiveCustomBg
            ? {
                "--custom-bg-image": `url("${effectiveCustomBg}")`,
                "--custom-bg-blurred-image": blurredBgUrl
                  ? `url("${blurredBgUrl}")`
                  : `url("${effectiveCustomBg}")`,
                "--custom-bg-overlay": normalizedBgOverlay,
                "--custom-bg-sidebar-overlay": Math.min(
                  0.32,
                  normalizedBgOverlay * 0.9,
                ),
                "--custom-bg-sidebar-overlay-soft": Math.min(
                  0.16,
                  normalizedBgOverlay * 0.45,
                ),
                "--custom-bg-card-overlay":
                  normalizedBgOverlay > 0
                    ? Math.min(0.82, normalizedBgOverlay + 0.18)
                    : 0,
              }
            : void 0
        }
      >
        {effectiveCustomBg && (
          <div className="app-custom-bg-layer" aria-hidden="true" />
        )}
        <WindowControls />
        {effectiveCustomBg && bgNeedsBlur && (
          <div
            className="app-custom-bg-layer app-custom-bg-blur-layer"
            aria-hidden="true"
          />
        )}
        {dropError && (
          <div className="toast toast-error" role="alert">
            {dropError}
          </div>
        )}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={handleSetActiveTab}
          activeGame={activeGame}
          onGameSwitch={handleGameSwitch}
          games={allGames}
          collapsed={sidebarCollapsed}
          onToggleCollapse={handleToggleSidebar}
        />
        <div className="main-content">
          <React.Suspense
            fallback={
              <div className="page-transition-enter app-page-loading">
                {t("common.status.loading")}
              </div>
            }
          >
            {activeTab === "characters" && !selectedCharacter && (
              <CharacterView
                activeGame={activeGame}
                initialCache={currentCharacterViewCache}
                onCacheChange={handleCharacterCacheChange}
                onSelectCharacter={setSelectedCharacter}
                onOpenSettings={() => setActiveTab("game-settings")}
                pendingBatchItems={pendingBatchItems}
                pendingBatchPreferredCharacter={
                  pendingBatchContext?.preferredCharacter || ""
                }
                onPendingBatchConsumed={() => {
                  setPendingBatchItems(null);
                  setPendingBatchContext(null);
                }}
                pendingMoveMod={pendingModMove}
                onCancelPendingMove={() => setPendingModMove(null)}
                onPendingMoveCompleted={() => setPendingModMove(null)}
                key={`characters-${characterScopeKey}-${gameKey}`}
              />
            )}
            {activeTab === "characters" && selectedCharacter && (
              <ModView
                characterName={selectedCharacter}
                activeGameId={activeGame?.id}
                managerTarget={managerTarget}
                onBack={() => setSelectedCharacter(null)}
                devMode={devMode}
                onOpenPublishMod={handleOpenPublishMod}
                onRequestMoveMod={handleRequestMoveMod}
                onRequestBatchImportReview={handleRequestBatchImportReview}
                runtimeInfo={runtimeInfo}
                onCharacterModsChanged={handleCharacterModsChanged}
                key={`modview-${gameScopeKey}-${selectedCharacter}-${modViewKey}`}
              />
            )}
            {activeTab === "presets" && (
              <PresetView
                activeGame={activeGame}
                key={`presets-${gameScopeKey}`}
              />
            )}
            {(hasOpenedMarket || pendingMarketMod) && (
              <div
                style={{
                  display: activeTab === "modmarket" ? "contents" : "none",
                }}
              >
                <ModDownloadView
                  activeGameId={activeGame?.id}
                  games={games}
                  devMode={devMode}
                  isActive={activeTab === "modmarket"}
                  onQaqmActiveChange={setQaqmActive}
                  marketKey={gameScopeKey}
                  pendingDetailMod={pendingMarketMod}
                  onPendingDetailConsumed={() => setPendingMarketMod(null)}
                  key={"mod-download"}
                />
              </div>
            )}
            {activeTab === "game-settings" && (
              <GameSettingsView
                activeGame={activeGame}
                key={activeGame?.id || "game-settings"}
              />
            )}
            {activeTab === "gacha" && activeGame?.id === "wuthering-waves" && (
              <GachaView />
            )}
            {activeTab === "settings" && (
              <SettingsView
                devMode={devMode}
                games={games}
                allGames={gameOrder.allItems}
                key={"system-settings"}
              />
            )}
          </React.Suspense>
        </div>
        {marketNewMods.length > 0 && (
          <React.Suspense fallback={null}>
            <MarketUpdateToast
              mods={marketNewMods}
              onDismiss={handleMarketToastDismiss}
              onModClick={handleMarketToastModClick}
            />
          </React.Suspense>
        )}
        {devMode && (
          <div className="app-dev-toolbar">
            <div
              onClick={() => {
                setBatchAiImageOnly(false);
                setShowBatchAiPanel(true);
              }}
              title={t("mods.ai.recommendAll")}
              className="app-dev-ai-action"
            >
              {"AI"}
            </div>
            <div
              onClick={() => {
                setBatchAiImageOnly(true);
                setShowBatchAiPanel(true);
              }}
              title={t("mods.ai.recommendWithImages")}
              className="app-dev-image-only-action"
            >
              {"AI+IMG"}
            </div>
            <div
              onClick={() => setShowLinkChecker(true)}
              title={t("market.links.checkInvalid")}
              className="app-dev-link-action"
            >
              {t("market.links.shortLabel")}
            </div>
            <div
              onClick={() => setShowBatchCloudPanel(true)}
              title={t("market.cloud.batchTitle")}
              className="app-dev-cloud-action"
            >
              {t("market.cloud.shortLabel")}
            </div>
            <div
              onClick={handleExitDevMode}
              title={t("settings.developer.exitHint")}
              className="app-dev-mode-action"
            >
              {"DEV"}
            </div>
          </div>
        )}
        {showBatchCloudPanel && (
          <React.Suspense fallback={null}>
            <BatchCloudPanel
              gameId={activeGame?.id}
              onClose={() => setShowBatchCloudPanel(false)}
            />
          </React.Suspense>
        )}
        {showLinkChecker && (
          <React.Suspense fallback={null}>
            <LinkCheckerPanel
              gameId={activeGame?.id}
              onClose={() => setShowLinkChecker(false)}
            />
          </React.Suspense>
        )}
        {showBatchAiPanel && (
          <React.Suspense fallback={null}>
            <BatchAiPanel
              gameId={activeGame?.id}
              imageOnly={batchAiImageOnly}
              onClose={() => setShowBatchAiPanel(false)}
            />
          </React.Suspense>
        )}
        {publishTasks.map((task) => (
          <React.Suspense fallback={null} key={task.id}>
            <PublishModDialog
              {...task.target}
              visible={task.visible}
              onMinimize={() => setPublishTaskVisible(task.id, false)}
              onClose={() => handleClosePublishTask(task.id)}
              onStateChange={(state) => updatePublishTaskState(task.id, state)}
              key={`${task.id}-${task.sessionKey}`}
            />
          </React.Suspense>
        ))}
        <FloatingDownloadOrb onImportTask={handleImportDownloadedTask} />
        <SoftwareUpdateNotice />
        {publishTasks.map((task, index) => (
          <PublishProgressFloat
            target={task.target}
            state={task.state}
            visible={task.visible}
            offsetIndex={index}
            onExpand={() => setPublishTaskVisible(task.id, true)}
            onClose={() => handleClosePublishTask(task.id)}
            key={`${task.id}-float`}
          />
        ))}
        {showDevPasswordModal && (
          <div
            onClick={() => setShowDevPasswordModal(false)}
            className="app-dev-dialog-overlay"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="app-dev-dialog"
            >
              <div className="app-dev-dialog-title">
                {t("settings.developer.title")}
              </div>
              <input
                type="password"
                autoFocus={true}
                placeholder={t("settings.developer.passwordPlaceholder")}
                value={devPasswordInput}
                onChange={(e) => {
                  setDevPasswordInput(e.target.value);
                  setDevPasswordError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleDevPasswordSubmit();
                }}
                style={{
                  borderRadius: "6px",
                  border: `1px solid ${devPasswordError ? "#ef4444" : "var(--color-border)"}`,
                }}
                className="app-dev-password"
              />
              {devPasswordError && (
                <div className="app-dev-password-error">{devPasswordError}</div>
              )}
              <div className="app-dev-dialog-actions">
                <button
                  onClick={() => setShowDevPasswordModal(false)}
                  className="app-dev-dialog-cancel"
                >
                  {t("common.actions.cancel")}
                </button>
                <button
                  onClick={handleDevPasswordSubmit}
                  className="app-dev-dialog-confirm"
                >
                  {t("common.actions.confirm")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ThemeProvider>
  );
}
export { App as default };
