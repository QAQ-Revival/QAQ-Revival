import { t } from "../../../shared/i18n/index.mjs";
import { getCharacterUsageStorageKey } from "../../lib/batchImportPlan.js";
import { useCharacterTools } from "./hooks/useCharacterTools.js";
import { useCoalescedRefresh } from "../../hooks/useCoalescedRefresh.js";
import { ManagementModal } from "../../components/ManagementModal.jsx";
import { useNevernessMode } from "./hooks/useNevernessMode.js";
import { useCharacterOrganization } from "./hooks/useCharacterOrganization.js";
import { useCharacterImport } from "./hooks/useCharacterImport.js";
import { DeleteCharacterDialog } from "./components/DeleteCharacterDialog.jsx";
import { AddCharacterDialog } from "./components/AddCharacterDialog.jsx";
import { Dx12RiskDialog } from "./components/Dx12RiskDialog.jsx";
import { CharacterToolbar } from "./components/CharacterToolbar.jsx";
import { CharacterGrid } from "./components/CharacterGrid.jsx";
import { BatchImportDialog } from "./components/BatchImportDialog.jsx";
import React from "react";
import ReactDOM from "react-dom";
import HiddenCharactersDialog from "./components/HiddenCharactersDialog.jsx";
import {
  getCharacterCustomOrderKey,
  readNevernessModeFallback,
  readCharacterPinnedSet,
  getCharacterPinnedStorageKey,
  getCharacterShowAllStorageKey,
  readCharacterShowAll,
  normalizeSearchValue,
  getCharacterSkinCount,
  writeCharacterPinnedSet,
  isCoverImageFile,
} from "./model/characterHelpers.js";
import { pinyin, pinyinReady } from "./model/characterSearch.js";
import { LegacyImportModal } from "./components/LegacyImportModal.jsx";
import { ImageCropper } from "../../components/ImageCropper.jsx";
function CharacterView({
  activeGame,
  initialCache,
  onCacheChange,
  onSelectCharacter,
  onOpenSettings,
  pendingBatchItems,
  pendingBatchPreferredCharacter,
  onPendingBatchConsumed,
  pendingMoveMod,
  onCancelPendingMove,
  onPendingMoveCompleted,
}) {
  const [characters, setCharacters] = React.useState(() =>
    Array.isArray(initialCache?.characters) ? initialCache.characters : [],
  );
  const [characterCovers, setCharacterCovers] = React.useState(
    () => initialCache?.characterCovers || {},
  );
  const [loading, setLoading] = React.useState(() => !initialCache);
  const [initialized, setInitialized] = React.useState(() => !!initialCache);
  const [missingPath, setMissingPath] = React.useState(
    () => !!initialCache?.missingPath,
  );
  const [loadError, setLoadError] = React.useState(
    () => initialCache?.loadError || "",
  );
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [showDeleteModal, setShowDeleteModal] = React.useState(null);
  const [showHiddenCharacters, setShowHiddenCharacters] = React.useState(false);
  const [hiddenCharacterCount, setHiddenCharacterCount] = React.useState(0);
  const [hidingCharacter, setHidingCharacter] = React.useState(false);
  const [newCharName, setNewCharName] = React.useState("");
  const [toast, setToast] = React.useState(null);
  const fetchCharacters = useCoalescedRefresh(readCharacters);
  const {
    fixRunning,
    handleResetCharacterIni,
    handleFixAll,
    handleFixCharacter,
    handleSelectCustomFixExe,
  } = useCharacterTools({
    setToast,
    activeGame,
  });
  const {
    legacyImportPreview,
    setLegacyImportPreview,
    legacyPromptDismissed,
    setLegacyPromptDismissed,
    migratingLegacyImport,
    setLooseRootFolders,
    setMisplacedModFolders,
    quarantiningLooseRoot,
    showLooseRootReview,
    setShowLooseRootReview,
    selectedLooseRootItemIds,
    selectedMisplacedItemIds,
    latestPreviewRef,
    scanningOrganization,
    handleOrganizeCharacters,
    handleMigrateLegacyImport,
    getLooseIssueGroups,
    getMisplacedIssueGroups,
    getLooseIssueReason,
    getMisplacedIssueReason,
    setLooseIssueSelection,
    setMisplacedIssueSelection,
    toggleLooseIssueItem,
    toggleMisplacedIssueItem,
    handleQuarantineLooseRootFolders,
  } = useCharacterOrganization({
    initialCache,
    setToast,
    fetchCharacters,
  });
  const [draggingOver, setDraggingOver] = React.useState(null);
  const [refreshingCharacters, setRefreshingCharacters] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [sortMethod, setSortMethod] = React.useState(() => {
    try {
      return (
        localStorage.getItem(`charview-sort-${activeGame?.id || "default"}`) ||
        "common"
      );
    } catch {
      return "common";
    }
  });
  const [showReorderHint, setShowReorderHint] = React.useState(false);
  const [customOrderActive, setCustomOrderActive] = React.useState(() => {
    try {
      return (
        localStorage.getItem(getCharacterCustomOrderKey(activeGame?.id)) ===
        "true"
      );
    } catch {
      return false;
    }
  });
  const inputRef = React.useRef(null);
  const [draggedChar, setDraggedChar] = React.useState(null);
  const [dragOverChar, setDragOverChar] = React.useState(null);
  const [croppingImage, setCroppingImage] = React.useState(null);
  const [editingCharName, setEditingCharName] = React.useState(null);
  const [renamingChar, setRenamingChar] = React.useState(null);
  const [renameValue, setRenameValue] = React.useState("");
  const renameInputRef = React.useRef(null);
  const [showScrollTop, setShowScrollTop] = React.useState(false);
  const isManagementModalOpen =
    showAddModal || !!showDeleteModal || showHiddenCharacters;
  const canDragReorder = sortMethod === "common" && !searchQuery.trim();
  const [updatingCharacters, setUpdatingCharacters] = React.useState(false);
  const [pinnedCharacters, setPinnedCharacters] = React.useState(() =>
    readCharacterPinnedSet(activeGame?.id),
  );
  const [pinnedCharactersStorageKey, setPinnedCharactersStorageKey] =
    React.useState(() => getCharacterPinnedStorageKey(activeGame?.id));
  const [showAllCharactersStorageKey, setShowAllCharactersStorageKey] =
    React.useState(() => getCharacterShowAllStorageKey(activeGame?.id));
  const [showAllCharacters, setShowAllCharacters] = React.useState(() =>
    readCharacterShowAll(activeGame?.id),
  );
  const characterNames = React.useMemo(
    () => characters.map((char) => char.name),
    [characters],
  );
  const normalizedSearchQuery = normalizeSearchValue(searchQuery);
  const isNeverness = activeGame?.id === "neverness-to-everness";
  const {
    nevernessDx12Status,
    setNevernessDx12Status,
    showDx12RiskConfirm,
    setShowDx12RiskConfirm,
    dx12Busy,
    nevernessMode,
    refreshNevernessDx12Status,
    handleSwitchNevernessMode,
    confirmEnableDx12Mode,
    handleOpenDx12PakFolder,
  } = useNevernessMode({
    initialCache,
    activeGame,
    setToast,
    isNeverness,
    fetchCharacters,
  });
  const isWuwa = activeGame?.id === "wuthering-waves";
  const characterUsageMap = React.useMemo(() => {
    try {
      const raw = localStorage.getItem(
        getCharacterUsageStorageKey(activeGame?.id),
      );
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }, [activeGame?.id, characters]);
  const [pinyinLoaded, setPinyinLoaded] = React.useState(!!pinyin);
  React.useEffect(() => {
    if (!pinyin) pinyinReady.then(() => setPinyinLoaded(true));
  }, []);
  const searchableCharacterIndex = React.useMemo(() => {
    return new Map(
      characters.map((char) => {
        const name = typeof char?.name === "string" ? char.name : "";
        const baseTerms = [
          name,
          ...(Array.isArray(char?.searchTerms) ? char.searchTerms : []),
        ];
        let fullPinyin = "";
        let initialPinyin = "";
        try {
          if (name && pinyin) {
            fullPinyin =
              pinyin(name, {
                toneType: "none",
              }) || "";
            initialPinyin =
              pinyin(name, {
                toneType: "none",
                pattern: "first",
              }) || "";
          }
        } catch {}
        const normalizedTerms = Array.from(
          new Set(
            [
              ...baseTerms,
              fullPinyin,
              initialPinyin,
              String(fullPinyin).replace(/\s+/g, ""),
              String(initialPinyin).replace(/\s+/g, ""),
            ]
              .map(normalizeSearchValue)
              .filter(Boolean),
          ),
        );
        return [char.name, normalizedTerms];
      }),
    );
  }, [characters, pinyinLoaded]);
  const {
    batchImport,
    setBatchImport,
    batchCharacterPickerPosition,
    setBatchCharacterPickerPosition,
    showBatchGuide,
    setShowBatchGuide,
    showIntegratedPackageGuide,
    setShowIntegratedPackageGuide,
    batchImportHasManagedInstall,
    batchImportTitle,
    batchImportIsIntegratedEntry,
    getBatchCharacterOptions,
    updateBatchClassifyItem,
    updateBatchCharacterPickerPosition,
    selectBatchCharacter,
    updateBatchScanItem,
    setBatchPlanPreviewItemSelected,
    setBatchPlanScanMode,
    setClassifyInstallMode,
    handleBatchImportClick,
    handleOpenBatchImport,
    handleIntegratedPackageImportClick,
    handleOpenIntegratedPackageDownload,
    handleOpenExtractorDownload,
    handleOpenIntegratedPackageFiles,
    handleStartDecrypt,
    handleStartBatchImport,
  } = useCharacterImport({
    characters,
    pinnedCharacters,
    characterUsageMap,
    searchableCharacterIndex,
    setToast,
    activeGame,
    refreshNevernessDx12Status,
    fetchCharacters,
  });
  const visibleCharacters = React.useMemo(() => {
    const modeFiltered = showAllCharacters
      ? characters
      : characters.filter((char) => Number(char?.modCount || 0) > 0);
    const filtered = normalizedSearchQuery
      ? modeFiltered.filter((char) => {
          const tokens = searchableCharacterIndex.get(char?.name) || [];
          return tokens.some((token) => token.includes(normalizedSearchQuery));
        })
      : modeFiltered;
    const originalOrderIndex = new Map(
      characters.map((char, index) => [char.name, index]),
    );
    const sortPinnedFirst = (left, right) => {
      const leftPinned = pinnedCharacters.has(left.name);
      const rightPinned = pinnedCharacters.has(right.name);
      if (leftPinned !== rightPinned) {
        return leftPinned ? -1 : 1;
      }
      return 0;
    };
    if (sortMethod === "common") {
      return [...filtered].sort((left, right) => {
        const pinnedDiff = sortPinnedFirst(left, right);
        if (pinnedDiff !== 0) return pinnedDiff;
        if (customOrderActive) {
          return (
            (originalOrderIndex.get(left.name) || 0) -
            (originalOrderIndex.get(right.name) || 0)
          );
        }
        const usageDiff =
          Number(characterUsageMap?.[right.name] || 0) -
          Number(characterUsageMap?.[left.name] || 0);
        if (usageDiff !== 0) return usageDiff;
        return (
          (originalOrderIndex.get(left.name) || 0) -
          (originalOrderIndex.get(right.name) || 0)
        );
      });
    }
    if (sortMethod === "name") {
      return [...filtered].sort((left, right) => {
        const pinnedDiff = sortPinnedFirst(left, right);
        if (pinnedDiff !== 0) return pinnedDiff;
        return left.name.localeCompare(right.name, "zh");
      });
    }
    if (sortMethod === "modCount") {
      return [...filtered].sort((left, right) => {
        const pinnedDiff = sortPinnedFirst(left, right);
        if (pinnedDiff !== 0) return pinnedDiff;
        if ((right?.modCount || 0) !== (left?.modCount || 0)) {
          return (right?.modCount || 0) - (left?.modCount || 0);
        }
        return left.name.localeCompare(right.name, "zh");
      });
    }
    return filtered;
  }, [
    characterUsageMap,
    characters,
    customOrderActive,
    normalizedSearchQuery,
    pinnedCharacters,
    searchableCharacterIndex,
    showAllCharacters,
    sortMethod,
  ]);
  const totalVisibleMods = React.useMemo(
    () =>
      visibleCharacters.reduce(
        (sum, char) => sum + Number(char?.modCount || 0),
        0,
      ),
    [visibleCharacters],
  );
  const totalVisibleSkins = React.useMemo(
    () =>
      visibleCharacters.reduce(
        (sum, char) => sum + getCharacterSkinCount(char),
        0,
      ),
    [visibleCharacters],
  );
  React.useEffect(() => {
    fetchCharacters({
      keepVisible: !!initialCache || initialized,
    });
    setShowHiddenCharacters(false);
    setHiddenCharacterCount(0);
  }, [activeGame?.id]);
  React.useEffect(() => {
    if (activeGame?.id !== "neverness-to-everness") {
      setNevernessDx12Status(null);
      setShowDx12RiskConfirm(false);
      return;
    }
    setNevernessDx12Status(
      (prev) =>
        prev || {
          success: true,
          mode: readNevernessModeFallback(activeGame),
          paths: {},
        },
    );
    refreshNevernessDx12Status();
  }, [activeGame?.id, activeGame?.launchMode]);
  React.useEffect(() => {
    if (activeGame?.id !== "neverness-to-everness") return;
    const handleNevernessModeChanged = async () => {
      await refreshNevernessDx12Status();
    };
    window.addEventListener(
      "qaqm-neverness-mode-changed",
      handleNevernessModeChanged,
    );
    return () =>
      window.removeEventListener(
        "qaqm-neverness-mode-changed",
        handleNevernessModeChanged,
      );
  }, [activeGame?.id]);
  React.useEffect(() => {
    let refreshTimer = null;
    const cleanup = window.api.onModsChanged?.((data = {}) => {
      if (data.gameId && data.gameId !== activeGame?.id) return;
      if (refreshTimer) clearTimeout(refreshTimer);
      const delay =
        data?.fullRefresh || data?.reason === "preset-applied" ? 120 : 40;
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        fetchCharacters({
          keepVisible: true,
        });
      }, delay);
    });
    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      if (cleanup) cleanup();
    };
  }, [activeGame?.id]);
  React.useEffect(() => {
    if (!pendingBatchItems?.length || !initialized) return;
    const items = pendingBatchItems.map((item) => ({
      ...item,
      selected: true,
    }));
    setBatchImport({
      phase: "scan",
      folderPath: null,
      items,
      entryMode: "droppedFiles",
      preferredCharacter: pendingBatchPreferredCharacter || "",
    });
    onPendingBatchConsumed?.();
  }, [pendingBatchItems, pendingBatchPreferredCharacter, initialized]);
  React.useEffect(() => {
    const nextSortMethod = (() => {
      try {
        return (
          localStorage.getItem(
            `charview-sort-${activeGame?.id || "default"}`,
          ) || "common"
        );
      } catch {
        return "common";
      }
    })();
    setSortMethod(nextSortMethod);
    setSearchQuery("");
    setShowAllCharactersStorageKey(
      getCharacterShowAllStorageKey(activeGame?.id),
    );
    setShowAllCharacters(readCharacterShowAll(activeGame?.id));
  }, [activeGame?.id]);
  React.useEffect(() => {
    const storageKey = getCharacterShowAllStorageKey(activeGame?.id);
    if (showAllCharactersStorageKey !== storageKey) return;
    try {
      localStorage.setItem(storageKey, showAllCharacters ? "true" : "false");
    } catch {}
  }, [activeGame?.id, showAllCharacters, showAllCharactersStorageKey]);
  React.useEffect(() => {
    setPinnedCharacters(readCharacterPinnedSet(activeGame?.id));
    setPinnedCharactersStorageKey(getCharacterPinnedStorageKey(activeGame?.id));
  }, [activeGame?.id]);
  React.useEffect(() => {
    const storageKey = getCharacterPinnedStorageKey(activeGame?.id);
    if (pinnedCharactersStorageKey !== storageKey) return;
    writeCharacterPinnedSet(activeGame?.id, pinnedCharacters);
  }, [activeGame?.id, pinnedCharacters, pinnedCharactersStorageKey]);
  React.useEffect(() => {
    try {
      localStorage.setItem(
        `charview-sort-${activeGame?.id || "default"}`,
        sortMethod,
      );
    } catch {}
  }, [activeGame?.id, sortMethod]);
  React.useEffect(() => {
    if (!showReorderHint) return void 0;
    const timer = setTimeout(() => setShowReorderHint(false), 2600);
    return () => clearTimeout(timer);
  }, [showReorderHint]);
  React.useEffect(() => {
    if (characters.length === 0) return;
    const mainContent = document.querySelector(".main-content");
    if (!mainContent) return;
    const saved = sessionStorage.getItem("charview-scroll");
    if (saved) {
      requestAnimationFrame(() => {
        mainContent.scrollTop = parseInt(saved, 10);
      });
    }
    let rafId = null;
    const handleScroll = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        sessionStorage.setItem(
          "charview-scroll",
          String(mainContent.scrollTop),
        );
        setShowScrollTop(mainContent.scrollTop > 300);
      });
    };
    mainContent.addEventListener("scroll", handleScroll, {
      passive: true,
    });
    return () => {
      mainContent.removeEventListener("scroll", handleScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [characters]);
  React.useEffect(() => {
    if (showAddModal && inputRef.current) {
      setTimeout(() => {
        inputRef.current.focus();
      }, 100);
    }
  }, [showAddModal]);
  React.useEffect(() => {
    const mainContent = document.querySelector(".main-content");
    if (!mainContent) return void 0;
    const previousOverflow = mainContent.style.overflowY;
    const previousOverscroll = mainContent.style.overscrollBehavior;
    if (isManagementModalOpen) {
      mainContent.style.overflowY = "hidden";
      mainContent.style.overscrollBehavior = "contain";
    }
    return () => {
      mainContent.style.overflowY = previousOverflow;
      mainContent.style.overscrollBehavior = previousOverscroll;
    };
  }, [isManagementModalOpen]);
  React.useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3e3);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  async function readCharacters(options = {}, isCurrent) {
    const { keepVisible = false } = options;
    if (!keepVisible) {
      setLoading(true);
    }
    try {
      const result = await (options.force
        ? window.api.refreshCharacters()
        : window.api.getCharacters());
      if (!isCurrent()) return false;
      if (result.success) {
        const nextCharacters = Array.isArray(result.characters)
          ? result.characters
          : [];
        const nextCovers = {};
        nextCharacters.forEach((char) => {
          if (char?.name && char?.coverUrl) {
            nextCovers[char.name] = char.coverUrl;
          }
        });
        setMissingPath(false);
        setLoadError("");
        setCharacters(nextCharacters);
        setHiddenCharacterCount(result.hiddenCount || 0);
        setCharacterCovers(nextCovers);
        setLegacyImportPreview(null);
        setLooseRootFolders(null);
        setMisplacedModFolders(null);
        latestPreviewRef.current = null;
        setLegacyPromptDismissed(false);
        onCacheChange?.({
          characters: nextCharacters,
          characterCovers: nextCovers,
          missingPath: false,
          loadError: "",
          legacyImportPreview: null,
          looseRootFolders: null,
          misplacedModFolders: null,
          legacyPromptDismissed: false,
          nevernessDx12Status,
          needsRefresh: false,
        });
      } else {
        setCharacters([]);
        setCharacterCovers({});
        setLegacyImportPreview(null);
        setLooseRootFolders(null);
        setMisplacedModFolders(null);
        latestPreviewRef.current = null;
        setLegacyPromptDismissed(false);
        const nextMissingPath =
          result.code === "MODS_PATH_NOT_SET" ||
          result.code === "MODS_PATH_NOT_FOUND";
        setMissingPath(nextMissingPath);
        setLoadError(result.error || t("characters.errors.loadList"));
        console.error(result.error);
        onCacheChange?.({
          characters: [],
          characterCovers: {},
          missingPath: nextMissingPath,
          loadError: result.error || t("characters.errors.loadList"),
          legacyImportPreview: null,
          looseRootFolders: null,
          misplacedModFolders: null,
          legacyPromptDismissed: false,
          nevernessDx12Status,
          needsRefresh: false,
        });
      }
      return !!result.success;
    } catch (err) {
      if (!isCurrent()) return false;
      setCharacters([]);
      setCharacterCovers({});
      setLegacyImportPreview(null);
      setLooseRootFolders(null);
      setMisplacedModFolders(null);
      latestPreviewRef.current = null;
      setLegacyPromptDismissed(false);
      setMissingPath(false);
      setLoadError(err.message || t("characters.errors.loadList"));
      console.error(err);
    } finally {
      if (isCurrent()) {
        setInitialized(true);
        setLoading(false);
      }
    }
  }
  async function handleRefreshCharacters() {
    if (refreshingCharacters || scanningOrganization) return;
    setRefreshingCharacters(true);
    try {
      if (
        await fetchCharacters({
          keepVisible: true,
          force: true,
        })
      ) {
        setToast({
          type: "success",
          message: t("characters.status.refreshed"),
        });
      }
    } catch (error) {
      setToast({
        type: "error",
        message: error.message || t("common.errors.refreshFailed"),
      });
    } finally {
      setRefreshingCharacters(false);
    }
  }
  async function handleUpdateCharacters() {
    if (updatingCharacters || scanningOrganization) return;
    setUpdatingCharacters(true);
    try {
      const result = await window.api.updateCharacterCatalog(activeGame?.id);
      setToast({
        type: result?.success ? "success" : "error",
        message: result?.success
          ? result.message ||
            t("characters.status.catalogUpdated", {
              added: result.added || 0,
            })
          : result?.error || t("characters.errors.updateCatalog"),
      });
    } catch (error) {
      setToast({
        type: "error",
        message: error.message || t("characters.errors.updateCatalog"),
      });
    } finally {
      setUpdatingCharacters(false);
    }
  }
  async function handleAddCharacter() {
    if (!newCharName.trim()) {
      setToast({
        type: "error",
        message: t("characters.create.nameRequired"),
      });
      return;
    }
    try {
      const result = await window.api.addCharacter(newCharName, null);
      if (result.success) {
        setShowAddModal(false);
        setNewCharName("");
        setToast({
          type: "success",
          message: t("characters.create.success"),
        });
      } else {
        setToast({
          type: "error",
          message: t("characters.errors.addFailed", {
            error: result.error,
          }),
        });
      }
    } catch (e) {
      setToast({
        type: "error",
        message: t("characters.errors.addException", {
          message: e.message,
        }),
      });
    }
  }
  async function handleDeleteCharacter(charName) {
    try {
      const result = await window.api.deleteCharacter(charName);
      if (result.success) {
        setShowDeleteModal(null);
        setToast({
          type: "success",
          message: t("characters.delete.recycled", {
            charName,
          }),
        });
      } else {
        setToast({
          type: "error",
          message: t("common.errors.deleteWithReason", {
            error: result.error,
          }),
        });
      }
    } catch (e) {
      setToast({
        type: "error",
        message: t("common.errors.deleteException", {
          message: e.message,
        }),
      });
    }
  }
  async function handleHideCharacter(charName) {
    if (hidingCharacter) return;
    setHidingCharacter(true);
    try {
      const result = await window.api.setCharacterHidden(
        charName,
        true,
        activeGame?.id,
      );
      if (!result?.success)
        throw Error(result?.error || t("characters.errors.hide"));
      setCharacters((items) => items.filter((item) => item.name !== charName));
      setHiddenCharacterCount((count) => count + 1);
      setToast({
        type: "success",
        message: t("characters.hide.success", {
          charName,
          disabledCount: result.disabledCount,
        }),
      });
    } catch (error) {
      setToast({
        type: "error",
        message: error.message || t("characters.errors.hide"),
      });
    } finally {
      setHidingCharacter(false);
    }
  }
  async function handleDropCover(charName, e) {
    const files = e.dataTransfer.files;
    const file = files && files.length > 0 ? files[0] : null;
    if (!isCoverImageFile(file)) {
      setDraggingOver(null);
      return false;
    }
    e.preventDefault();
    e.stopPropagation();
    setDraggingOver(null);
    if (files.length > 0) {
      const reader = new FileReader();
      reader.onload = () => {
        setCroppingImage(reader.result);
        setEditingCharName(charName);
      };
      reader.readAsDataURL(file);
    }
    return true;
  }
  async function onCropSave(croppedImage) {
    if (!editingCharName || !croppedImage) return;
    try {
      const result = await window.api.setCharacterCover(
        editingCharName,
        croppedImage,
      );
      if (result.success) {
        setCharacterCovers((prev) => ({
          ...prev,
          [editingCharName]: result.coverUrl,
        }));
        setToast({
          type: "success",
          message: t("characters.cover.updated", {
            editingCharName,
          }),
        });
      } else {
        setToast({
          type: "error",
          message: t("characters.cover.failed", {
            error: result.error,
          }),
        });
      }
    } catch (e) {
      setToast({
        type: "error",
        message: t("characters.cover.exception", {
          message: e.message,
        }),
      });
    } finally {
      setCroppingImage(null);
      setEditingCharName(null);
    }
  }
  function handleDragStart(e, charName) {
    if (!canDragReorder) {
      e.preventDefault();
      setShowReorderHint(true);
      return;
    }
    setDraggedChar(charName);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", charName);
    setTimeout(() => {
      e.target.style.opacity = "0.5";
    }, 0);
  }
  function handleDragEnd(e) {
    e.target.style.opacity = "1";
    setDraggedChar(null);
    setDragOverChar(null);
  }
  function handleDragOverReorder(e, charName) {
    e.preventDefault();
    if (draggedChar && draggedChar !== charName) {
      setDragOverChar(charName);
    }
  }
  async function handleDropReorder(e, targetChar) {
    e.preventDefault();
    e.stopPropagation();
    if (!canDragReorder) {
      setDraggedChar(null);
      setDragOverChar(null);
      return;
    }
    if (!draggedChar || draggedChar === targetChar) {
      setDraggedChar(null);
      setDragOverChar(null);
      return;
    }
    if (e.dataTransfer.files.length > 0) {
      handleDropCover(targetChar, e);
      return;
    }
    const newOrder = [...characterNames];
    const draggedIndex = newOrder.indexOf(draggedChar);
    const targetIndex = newOrder.indexOf(targetChar);
    if (draggedIndex !== -1 && targetIndex !== -1) {
      newOrder.splice(draggedIndex, 1);
      newOrder.splice(targetIndex, 0, draggedChar);
      const characterMap = new Map(characters.map((char) => [char.name, char]));
      setCharacters(
        newOrder.map((name) => characterMap.get(name)).filter(Boolean),
      );
      try {
        await window.api.saveCharacterOrder(newOrder);
        setCustomOrderActive(true);
        try {
          localStorage.setItem(
            getCharacterCustomOrderKey(activeGame?.id),
            "true",
          );
        } catch {}
        setToast({
          type: "success",
          message: t("characters.sort.saved"),
        });
      } catch (err) {
        console.error("Failed to save character order:", err);
      }
    }
    setDraggedChar(null);
    setDragOverChar(null);
  }
  function handleKeyDown(e) {
    if (e.key === "Enter") {
      handleAddCharacter();
    } else if (e.key === "Escape") {
      setShowAddModal(false);
      setNewCharName("");
    }
  }
  async function handleRename(oldName) {
    const newName = renameValue.trim();
    if (!newName || newName === oldName) {
      setRenamingChar(null);
      return;
    }
    try {
      const result = await window.api.renameCharacter(oldName, newName);
      if (result.success) {
        setToast({
          type: "success",
          message: t("common.status.renamed", {
            newName,
          }),
        });
        setRenamingChar(null);
        fetchCharacters();
      } else {
        setToast({
          type: "error",
          message: t("common.errors.renameWithReason", {
            error: result.error,
          }),
        });
      }
    } catch (e) {
      setToast({
        type: "error",
        message: t("common.errors.renameException", {
          message: e.message,
        }),
      });
    }
  }
  if (loading && !initialized) {
    return (
      <div className="character-view page-transition-enter character-view-loading">
        {t("common.status.loading")}
      </div>
    );
  }
  function scrollToTop() {
    const mainContent = document.querySelector(".main-content");
    if (mainContent)
      mainContent.scrollTo({
        top: 0,
        behavior: "smooth",
      });
  }
  async function handlePinCharacter(charName) {
    const wasPinned = pinnedCharacters.has(charName);
    const nextPinnedCharacters = new Set(pinnedCharacters);
    if (wasPinned) {
      nextPinnedCharacters.delete(charName);
    } else {
      nextPinnedCharacters.add(charName);
    }
    writeCharacterPinnedSet(activeGame?.id, nextPinnedCharacters);
    setPinnedCharacters(nextPinnedCharacters);
    setToast({
      type: "success",
      message: wasPinned
        ? t("characters.pin.removed", {
            charName,
          })
        : t("characters.pin.added", {
            charName,
          }),
    });
  }
  async function handleOpenCharacterFolder(charName) {
    try {
      const result = await window.api.openCharacterFolder(charName);
      if (!result?.success) {
        throw new Error(result?.error || t("characters.errors.openDirectory"));
      }
      setToast({
        type: "success",
        message: t("characters.status.sourceOpened", {
          charName,
        }),
      });
    } catch (error) {
      setToast({
        type: "error",
        message: error.message || t("characters.errors.openDirectory"),
      });
    }
  }
  async function handleMovePendingModToCharacter(targetCharacterName) {
    const moving = pendingMoveMod;
    if (!moving?.characterName || !moving?.modName) return;
    if (moving.characterName === targetCharacterName) {
      setToast({
        type: "error",
        message: t("characters.move.sameCategory"),
      });
      return;
    }
    try {
      const result = await window.api.moveModToCharacter(
        moving.characterName,
        moving.modName,
        targetCharacterName,
      );
      if (!result?.success) {
        throw new Error(result?.error || t("common.errors.moveFailed"));
      }
      setToast({
        type: "success",
        message: t("characters.move.success", {
          modName: moving.modName,
          targetCharacterName,
        }),
      });
      onPendingMoveCompleted?.();
      await fetchCharacters({
        keepVisible: true,
      });
    } catch (error) {
      setToast({
        type: "error",
        message: error.message || t("common.errors.moveFailed"),
      });
    }
  }
  async function openCharacterContextMenu(event, charName, pinned) {
    try {
      const action = await window.api.showCharacterContextMenu({
        pinned,
        busy: fixRunning,
        canMove: !!pendingMoveMod && charName !== pendingMoveMod.characterName,
      });
      const actions = {
        pin: () => handlePinCharacter(charName),
        folder: () => handleOpenCharacterFolder(charName),
        move: () => handleMovePendingModToCharacter(charName),
        fix: () => handleFixCharacter(charName, "external"),
        reset: () => handleResetCharacterIni(charName),
        "change-fixer": () => handleSelectCustomFixExe(),
      };
      if (Object.hasOwn(actions, action)) await actions[action]();
    } catch (error) {
      setToast({
        type: "error",
        message: error.message || t("characters.errors.openMenu"),
      });
    }
  }
  function renderManagementModal(
    children,
    onBackdropClose,
    contentStyle = void 0,
  ) {
    return ReactDOM.createPortal(
      <ManagementModal
        onBackdropClose={onBackdropClose}
        contentStyle={contentStyle}
        children={children}
      />,
      document.body,
    );
  }
  function renderToolbarActions() {
    const h = React.createElement;
    const busy =
      refreshingCharacters ||
      updatingCharacters ||
      scanningOrganization ||
      migratingLegacyImport ||
      quarantiningLooseRoot ||
      loading;
    const button = (label, title, onClick, disabled = busy) => (
      <button
        type="button"
        className="character-tool-button"
        title={title}
        onClick={onClick}
        disabled={disabled}
      >
        {label}
      </button>
    );
    const group = (label, className, ...children) =>
      h(
        "div",
        {
          className: "character-action-group " + className,
          role: "group",
          "aria-label": label,
        },
        <span className="character-action-label">{label}</span>,
        ...children,
      );
    return (
      <div className="character-toolbar-actions">
        {group(
          t("characters.catalog.title"),
          "",
          button(
            updatingCharacters
              ? t("common.status.updating")
              : t("characters.catalog.update"),
            t("characters.catalog.updateHint"),
            handleUpdateCharacters,
          ),
          button(
            t("characters.hide.buttonLabel", {
              status: hiddenCharacterCount ? ` (${hiddenCharacterCount})` : "",
            }),
            t("characters.hide.manageHint"),
            () => setShowHiddenCharacters(true),
            hidingCharacter,
          ),
        )}
        {group(
          t("characters.list.localFiles"),
          "",
          button(
            refreshingCharacters
              ? t("common.status.refreshing")
              : t("common.actions.refresh"),
            t("characters.list.refreshHint"),
            handleRefreshCharacters,
          ),
          button(
            scanningOrganization
              ? t("common.status.scanning")
              : t("characters.organization.title"),
            t("characters.organization.previewHint"),
            () => handleOrganizeCharacters(),
            busy || missingPath,
          ),
        )}
        {group(
          t("characters.tools.external"),
          "character-external-tools",
          button(
            fixRunning
              ? t("common.status.opening")
              : t("characters.fixer.title"),
            t("characters.fixer.openHint"),
            () => handleFixAll("external"),
            fixRunning,
          ),
        )}
      </div>
    );
  }
  return (
    <div className="character-view page-transition-enter">
      <CharacterToolbar
        visibleCharacters={visibleCharacters}
        characters={characters}
        totalVisibleMods={totalVisibleMods}
        totalVisibleSkins={totalVisibleSkins}
        handleBatchImportClick={handleBatchImportClick}
        loading={loading}
        missingPath={missingPath}
        handleIntegratedPackageImportClick={handleIntegratedPackageImportClick}
        renderToolbarActions={renderToolbarActions}
        isNeverness={isNeverness}
        nevernessMode={nevernessMode}
        handleSwitchNevernessMode={handleSwitchNevernessMode}
        dx12Busy={dx12Busy}
        nevernessDx12Status={nevernessDx12Status}
        handleOpenDx12PakFolder={handleOpenDx12PakFolder}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        showAllCharacters={showAllCharacters}
        setShowAllCharacters={setShowAllCharacters}
        sortMethod={sortMethod}
        setSortMethod={setSortMethod}
        showReorderHint={showReorderHint}
        pendingMoveMod={pendingMoveMod}
        onCancelPendingMove={onCancelPendingMove}
      />
      <Dx12RiskDialog
        showDx12RiskConfirm={showDx12RiskConfirm}
        renderManagementModal={renderManagementModal}
        nevernessDx12Status={nevernessDx12Status}
        setShowDx12RiskConfirm={setShowDx12RiskConfirm}
        dx12Busy={dx12Busy}
        confirmEnableDx12Mode={confirmEnableDx12Mode}
      />
      {missingPath ? (
        <div className="settings-card character-view-settings-card-layout">
          <div className="character-view-icon">{"📁"}</div>
          <div className="text-h3 character-view-content">
            {t("characters.errors.modsFolderUnset", {
              name: activeGame?.name || t("navigation.currentGame"),
            })}
          </div>
          <div className="text-body character-view-text-body-layout">
            {t("characters.errors.configureGameFolder")}
          </div>
          <button
            className="btn btn-primary"
            onClick={() => onOpenSettings?.()}
          >
            {t("characters.actions.openGameSettings")}
          </button>
        </div>
      ) : loadError ? (
        <div className="settings-card character-view-settings-card-layout-spaced">
          {loadError}
        </div>
      ) : (
        <React.Fragment>
          <LegacyImportModal
            preview={legacyPromptDismissed ? null : legacyImportPreview}
            migrating={migratingLegacyImport}
            onClose={() => setLegacyPromptDismissed(true)}
            onMigrate={handleMigrateLegacyImport}
          />
          {showLooseRootReview &&
            ReactDOM.createPortal(
              <div
                className="modal-backdrop"
                onClick={() =>
                  !quarantiningLooseRoot && setShowLooseRootReview(false)
                }
              >
                <div
                  className="modal-content character-view-modal-content-layout"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="character-view-row">
                    <div>
                      <div className="text-h2 character-view-organization-title">
                        {t("characters.organization.confirmTitle")}
                      </div>
                      <div className="character-view-hint">
                        {t("characters.organization.planHint")}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary character-grid-rename-btn-layout"
                      onClick={() => setShowLooseRootReview(false)}
                      disabled={quarantiningLooseRoot}
                    >
                      {t("common.actions.close")}
                    </button>
                  </div>
                  {(() => {
                    const misplacedGroups = getMisplacedIssueGroups();
                    const looseGroups = getLooseIssueGroups();
                    const misplacedIds = misplacedGroups.flatMap((group) =>
                      group.items.map((item) => item.id),
                    );
                    const looseIds = looseGroups.flatMap((group) =>
                      group.items.map((item) => item.id),
                    );
                    const allIds = [...misplacedIds, ...looseIds];
                    const selectedMisplacedCount = misplacedIds.filter((id) =>
                      selectedMisplacedItemIds.has(id),
                    ).length;
                    const selectedLooseCount = looseIds.filter((id) =>
                      selectedLooseRootItemIds.has(id),
                    ).length;
                    const selectedCount =
                      selectedMisplacedCount + selectedLooseCount;
                    const allSelected =
                      allIds.length > 0 && selectedCount === allIds.length;
                    return (
                      <React.Fragment>
                        <div className="character-view-row-spaced">
                          <div className="character-view-organization-selection-summary">
                            {t("characters.organization.selectionSummary", {
                              selectedCount,
                              allIdsCount: allIds.length,
                              value:
                                misplacedIds.length > 0
                                  ? t(
                                      "characters.organization.misplacedSummary",
                                      {
                                        selectedMisplacedCount,
                                        misplacedIdsCount: misplacedIds.length,
                                      },
                                    )
                                  : "",
                              otherValue:
                                looseIds.length > 0
                                  ? t("characters.organization.looseSummary", {
                                      selectedLooseCount,
                                      looseIdsCount: looseIds.length,
                                    })
                                  : "",
                            })}
                          </div>
                          <button
                            type="button"
                            className="btn btn-secondary character-view-btn-layout"
                            onClick={() => {
                              setMisplacedIssueSelection(
                                misplacedIds,
                                !allSelected,
                              );
                              setLooseIssueSelection(looseIds, !allSelected);
                            }}
                            disabled={
                              quarantiningLooseRoot || allIds.length === 0
                            }
                          >
                            {allSelected
                              ? t("common.actions.clearSelection")
                              : t("common.actions.selectAll")}
                          </button>
                        </div>
                        <div className="character-view-stack">
                          {misplacedGroups.length > 0 && (
                            <div className="character-view-issue-category">
                              <div className="character-view-heading">
                                {t("characters.organization.moveSuggestion")}
                              </div>
                              {misplacedGroups.map((group) => {
                                const groupIds = group.items.map(
                                  (item) => item.id,
                                );
                                const groupSelectedCount = groupIds.filter(
                                  (id) => selectedMisplacedItemIds.has(id),
                                ).length;
                                const groupAllSelected =
                                  groupSelectedCount === groupIds.length;
                                return (
                                  <div
                                    key={group.id}
                                    className="character-view-misplaced-group"
                                  >
                                    <div className="character-view-misplaced-group-header">
                                      <div className="character-view-issue-text">
                                        <div className="character-view-heading-emphasis">
                                          {group.title}
                                        </div>
                                        <div className="character-view-misplaced-group-description">
                                          {group.subtitle}
                                          <br />
                                          {t(
                                            "characters.organization.targetPrefix",
                                          )}
                                          {group.targetText}
                                        </div>
                                      </div>
                                      <button
                                        type="button"
                                        className="btn btn-secondary character-view-select-issue-group"
                                        onClick={() =>
                                          setMisplacedIssueSelection(
                                            groupIds,
                                            !groupAllSelected,
                                          )
                                        }
                                        disabled={quarantiningLooseRoot}
                                      >
                                        {groupAllSelected
                                          ? t(
                                              "characters.organization.clearGroupSelection",
                                            )
                                          : t(
                                              "characters.organization.selectGroup",
                                            )}
                                      </button>
                                    </div>
                                    <div className="character-view-issue-items">
                                      {group.items.map((item) => (
                                        <label
                                          style={{
                                            cursor: quarantiningLooseRoot
                                              ? "default"
                                              : "pointer",
                                          }}
                                          key={item.id}
                                          className="character-view-content-spaced"
                                        >
                                          <input
                                            type="checkbox"
                                            checked={selectedMisplacedItemIds.has(
                                              item.id,
                                            )}
                                            onChange={() =>
                                              toggleMisplacedIssueItem(item.id)
                                            }
                                            disabled={quarantiningLooseRoot}
                                            className="character-view-input-field"
                                          />
                                          <span className="character-view-issue-text">
                                            <span className="character-view-misplaced-item-name">
                                              {item.name}
                                            </span>
                                            <span className="character-view-misplaced-item-reason">
                                              {getMisplacedIssueReason(item)}
                                            </span>
                                            {item.path && (
                                              <span className="character-view-misplaced-item-path">
                                                {item.path}
                                              </span>
                                            )}
                                          </span>
                                        </label>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {looseGroups.length > 0 && (
                            <div className="character-view-issue-category">
                              <div className="character-view-quarantine-heading">
                                {t(
                                  "characters.organization.quarantineSuggestion",
                                )}
                              </div>
                              {looseGroups.map((group) => {
                                const groupIds = group.items.map(
                                  (item) => item.id,
                                );
                                const groupSelectedCount = groupIds.filter(
                                  (id) => selectedLooseRootItemIds.has(id),
                                ).length;
                                const groupAllSelected =
                                  groupSelectedCount === groupIds.length;
                                return (
                                  <div
                                    key={group.id}
                                    className="character-view-loose-group"
                                  >
                                    <div className="character-view-loose-group-header">
                                      <div className="character-view-issue-text">
                                        <div className="character-view-loose-group-title">
                                          {group.title}
                                        </div>
                                        <div className="character-view-loose-group-description">
                                          {group.subtitle}
                                          <br />
                                          {t(
                                            "characters.organization.destinationPrefix",
                                          )}
                                          {group.targetText}
                                        </div>
                                      </div>
                                      <button
                                        type="button"
                                        className="btn btn-secondary character-view-select-issue-group"
                                        onClick={() =>
                                          setLooseIssueSelection(
                                            groupIds,
                                            !groupAllSelected,
                                          )
                                        }
                                        disabled={quarantiningLooseRoot}
                                      >
                                        {groupAllSelected
                                          ? t(
                                              "characters.organization.clearGroupSelection",
                                            )
                                          : t(
                                              "characters.organization.selectGroup",
                                            )}
                                      </button>
                                    </div>
                                    <div className="character-view-issue-items">
                                      {group.items.map((item) => (
                                        <label
                                          style={{
                                            cursor: quarantiningLooseRoot
                                              ? "default"
                                              : "pointer",
                                          }}
                                          key={item.id}
                                          className="character-view-loose-item"
                                        >
                                          <input
                                            type="checkbox"
                                            checked={selectedLooseRootItemIds.has(
                                              item.id,
                                            )}
                                            onChange={() =>
                                              toggleLooseIssueItem(item.id)
                                            }
                                            disabled={quarantiningLooseRoot}
                                            className="character-view-input-field"
                                          />
                                          <span className="character-view-issue-text">
                                            <span className="character-view-loose-item-name">
                                              {item.name}
                                            </span>
                                            <span className="character-view-loose-item-reason">
                                              {getLooseIssueReason(item)}
                                            </span>
                                            {item.path && (
                                              <span className="character-view-issue-path">
                                                {item.path}
                                              </span>
                                            )}
                                          </span>
                                        </label>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </React.Fragment>
                    );
                  })()}
                  <div className="character-view-actions">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setShowLooseRootReview(false)}
                      disabled={quarantiningLooseRoot}
                    >
                      {t("common.actions.cancel")}
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary character-view-organize-confirm"
                      onClick={handleQuarantineLooseRootFolders}
                      disabled={
                        quarantiningLooseRoot ||
                        selectedLooseRootItemIds.size +
                          selectedMisplacedItemIds.size ===
                          0
                      }
                    >
                      {quarantiningLooseRoot
                        ? t("characters.organization.processing")
                        : selectedMisplacedItemIds.size > 0 &&
                            selectedLooseRootItemIds.size > 0
                          ? t("characters.organization.processSelected")
                          : selectedMisplacedItemIds.size > 0
                            ? t("characters.organization.moveToCategory")
                            : t("characters.organization.quarantineAndDisable")}
                    </button>
                  </div>
                </div>
              </div>,
              document.body,
            )}
          {showBatchGuide &&
            ReactDOM.createPortal(
              <div
                className="batch-guide-overlay"
                onClick={() => setShowBatchGuide(false)}
              >
                <div
                  className="batch-guide-card"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="batch-guide-hero">
                    <div className="batch-guide-hero-icon">{"📦"}</div>
                    <div>
                      <h2>{t("characters.import.batchModsTitle")}</h2>
                      <p>{t("characters.import.batchDescription")}</p>
                    </div>
                  </div>
                  <div className="batch-guide-body">
                    <div className="batch-guide-step">
                      <div className="batch-guide-step-num">{"1"}</div>
                      <div>
                        <div className="batch-guide-step-title">
                          {t("characters.import.prepareFolder")}
                        </div>
                        <div className="batch-guide-step-desc">
                          {t("characters.import.prepareFolderHint")}
                        </div>
                      </div>
                    </div>
                    <div className="batch-guide-step">
                      <div className="batch-guide-step-num">{"2"}</div>
                      <div>
                        <div className="batch-guide-step-title">
                          {t("characters.import.selectPreparedFolder")}
                        </div>
                        <div className="batch-guide-step-desc">
                          {t("characters.import.selectPreparedFolderHint")}
                        </div>
                      </div>
                    </div>
                    <div className="batch-guide-step">
                      <div className="batch-guide-step-num">{"3"}</div>
                      <div>
                        <div className="batch-guide-step-title">
                          {t("characters.import.matchCharacters")}
                        </div>
                        <div className="batch-guide-step-desc">
                          {t("characters.import.matchCharactersHint")}
                        </div>
                      </div>
                    </div>
                    <div className="batch-guide-actions">
                      <label className="batch-guide-dismiss">
                        <input
                          type="checkbox"
                          onChange={(e) => {
                            try {
                              localStorage.setItem(
                                "batch-import-guide-dismissed",
                                e.target.checked ? "true" : "false",
                              );
                            } catch {}
                          }}
                        />
                        {t("common.actions.doNotShowAgain")}
                      </label>
                      <div className="character-view-batch-guide-actions">
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => setShowBatchGuide(false)}
                        >
                          {t("common.actions.cancel")}
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={handleOpenBatchImport}
                        >
                          {t("native.dialog.selectFolder")}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>,
              document.body,
            )}
          {showIntegratedPackageGuide &&
            ReactDOM.createPortal(
              <div
                className="batch-guide-overlay"
                onClick={() => setShowIntegratedPackageGuide(false)}
              >
                <div
                  className="batch-guide-card integrated-package-guide-card"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="batch-guide-hero">
                    <div className="batch-guide-hero-icon">{"🧩"}</div>
                    <div>
                      <h2>{t("characters.import.integratedTitle")}</h2>
                      <p>{t("characters.import.integratedDescription")}</p>
                    </div>
                  </div>
                  <div className="batch-guide-body">
                    <div className="batch-guide-link-row">
                      <button
                        type="button"
                        className="btn btn-secondary elevated-action-btn"
                        onClick={handleOpenIntegratedPackageDownload}
                      >
                        {t("characters.import.getIntegratedPackage")}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary elevated-action-btn"
                        onClick={handleOpenExtractorDownload}
                      >
                        {t("characters.import.getArchiveTool")}
                      </button>
                    </div>
                    <div className="batch-guide-step">
                      <div className="batch-guide-step-num">{"1"}</div>
                      <div>
                        <div className="batch-guide-step-title">
                          {t("characters.import.downloadIntegratedFirst")}
                        </div>
                        <div className="batch-guide-step-desc">
                          {t("characters.import.integratedStructureHint")}
                        </div>
                      </div>
                    </div>
                    <div className="batch-guide-step">
                      <div className="batch-guide-step-num">{"2"}</div>
                      <div>
                        <div className="batch-guide-step-title">
                          {t("characters.import.encryptedVideoTitle")}
                        </div>
                        <div className="batch-guide-step-desc">
                          {t("characters.import.encryptedVideoHint")}
                        </div>
                      </div>
                    </div>
                    <div className="batch-guide-step">
                      <div className="batch-guide-step-num">{"3"}</div>
                      <div>
                        <div className="batch-guide-step-title">
                          {t("characters.import.extractArchiveFirst")}
                        </div>
                        <div className="batch-guide-step-desc">
                          {t("characters.import.extractArchiveHint")}
                        </div>
                      </div>
                    </div>
                    <div className="batch-guide-note">
                      {t("characters.import.integratedDetectionHint")}
                    </div>
                    <div className="batch-guide-actions">
                      <span className="batch-guide-dismiss">
                        {t("characters.import.supportedExtensions")}
                      </span>
                      <div className="batch-guide-action-buttons">
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => setShowIntegratedPackageGuide(false)}
                        >
                          {t("common.actions.cancel")}
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={handleOpenIntegratedPackageFiles}
                        >
                          {t("characters.import.selectIntegratedFile")}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>,
              document.body,
            )}
          {batchImport &&
            ReactDOM.createPortal(
              <BatchImportDialog
                batchImport={batchImport}
                setBatchImport={setBatchImport}
                batchImportTitle={batchImportTitle}
                batchImportHasManagedInstall={batchImportHasManagedInstall}
                batchImportIsIntegratedEntry={batchImportIsIntegratedEntry}
                setBatchPlanScanMode={setBatchPlanScanMode}
                updateBatchScanItem={updateBatchScanItem}
                setBatchPlanPreviewItemSelected={
                  setBatchPlanPreviewItemSelected
                }
                activeGame={activeGame}
                handleStartDecrypt={handleStartDecrypt}
                getBatchCharacterOptions={getBatchCharacterOptions}
                setClassifyInstallMode={setClassifyInstallMode}
                updateBatchCharacterPickerPosition={
                  updateBatchCharacterPickerPosition
                }
                updateBatchClassifyItem={updateBatchClassifyItem}
                setBatchCharacterPickerPosition={
                  setBatchCharacterPickerPosition
                }
                selectBatchCharacter={selectBatchCharacter}
                batchCharacterPickerPosition={batchCharacterPickerPosition}
                characters={characters}
                pinnedCharacters={pinnedCharacters}
                characterUsageMap={characterUsageMap}
                handleStartBatchImport={handleStartBatchImport}
              />,
              document.body,
            )}
          <CharacterGrid
            setShowAddModal={setShowAddModal}
            visibleCharacters={visibleCharacters}
            pinnedCharacters={pinnedCharacters}
            draggingOver={draggingOver}
            dragOverChar={dragOverChar}
            draggedChar={draggedChar}
            canDragReorder={canDragReorder}
            onSelectCharacter={onSelectCharacter}
            openCharacterContextMenu={openCharacterContextMenu}
            handleDragStart={handleDragStart}
            handleDragEnd={handleDragEnd}
            handleDragOverReorder={handleDragOverReorder}
            setDraggingOver={setDraggingOver}
            setDragOverChar={setDragOverChar}
            handleDropReorder={handleDropReorder}
            handleDropCover={handleDropCover}
            hidingCharacter={hidingCharacter}
            handleHideCharacter={handleHideCharacter}
            setShowDeleteModal={setShowDeleteModal}
            characterCovers={characterCovers}
            setCharacterCovers={setCharacterCovers}
            renamingChar={renamingChar}
            renameInputRef={renameInputRef}
            renameValue={renameValue}
            setRenameValue={setRenameValue}
            handleRename={handleRename}
            setRenamingChar={setRenamingChar}
          />
        </React.Fragment>
      )}
      {toast && (
        <div className={`toast toast-${toast.type}`}>{toast.message}</div>
      )}
      {croppingImage && (
        <ImageCropper
          imageSrc={croppingImage}
          onCancel={() => {
            setCroppingImage(null);
            setEditingCharName(null);
          }}
          onSave={onCropSave}
        />
      )}
      {showHiddenCharacters && (
        <HiddenCharactersDialog
          key={activeGame?.id}
          gameId={activeGame?.id}
          gameName={activeGame?.name}
          onClose={() => setShowHiddenCharacters(false)}
          onRestored={(name) => {
            setToast({
              type: "success",
              message: t("characters.hide.restored", {
                name,
              }),
            });
          }}
        />
      )}
      <AddCharacterDialog
        showAddModal={showAddModal}
        renderManagementModal={renderManagementModal}
        inputRef={inputRef}
        newCharName={newCharName}
        setNewCharName={setNewCharName}
        handleKeyDown={handleKeyDown}
        handleAddCharacter={handleAddCharacter}
        setShowAddModal={setShowAddModal}
      />
      <DeleteCharacterDialog
        showDeleteModal={showDeleteModal}
        renderManagementModal={renderManagementModal}
        handleDeleteCharacter={handleDeleteCharacter}
        setShowDeleteModal={setShowDeleteModal}
      />
      {showScrollTop &&
        ReactDOM.createPortal(
          <button
            onClick={scrollToTop}
            title={t("common.actions.backToTop")}
            className="character-view-scroll-to-top-action"
          >
            {"↑"}
          </button>,
          document.body,
        )}
    </div>
  );
}
export { CharacterView as default };
