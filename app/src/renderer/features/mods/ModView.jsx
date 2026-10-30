import { t } from "../../../shared/i18n/index.mjs";
import { getCharacterUsageStorageKey } from "../../lib/batchImportPlan.js";
import { useModGallery, DEFAULT_DETAIL_WIDTH } from "./hooks/useModGallery.js";
import { useModOrdering } from "./hooks/useModOrdering.js";
import { useModFocus } from "./hooks/useModFocus.js";
import { useModContextActions } from "./hooks/useModContextActions.js";
import { useAppearanceActions } from "./hooks/useAppearanceActions.js";
import { useModEditing } from "./hooks/useModEditing.js";
import { useMarkedMods } from "./hooks/useMarkedMods.js";
import { useModNaming } from "./hooks/useModNaming.js";
import { useModTags } from "./hooks/useModTags.js";
import { useModImport } from "./hooks/useModImport.js";
import { TagManagerDialog } from "./components/TagManagerDialog.jsx";
import { AiNameProgress } from "./components/AiNameProgress.jsx";
import { AiNameDialog } from "./components/AiNameDialog.jsx";
import { AiTagDialog } from "./components/AiTagDialog.jsx";
import { IniRollbackDialog } from "./components/IniRollbackDialog.jsx";
import { ModContextMenu } from "./components/ModContextMenu.jsx";
import { ArknightsLibraryNotice, ArknightsToolsDialog } from "../arknights/ArknightsTools.jsx";
import { RenameModDialog } from "./components/RenameModDialog.jsx";
import { MarkedModsToolbar } from "./components/MarkedModsToolbar.jsx";
import { MarkPasswordDialog } from "./components/MarkPasswordDialog.jsx";
import { ModDetailsPanel } from "./components/ModDetailsPanel.jsx";
import { ModLibraryPanel } from "./components/ModLibraryPanel.jsx";
import { DirectImportDialog } from "./components/DirectImportDialog.jsx";
import React from "react";
import { Icon } from "../../components/Icon.jsx";
import ReactDOM from "react-dom";
import { useCoalescedRefresh } from "../../hooks/useCoalescedRefresh.js";
import { getModViewStateStorageKey, getModViewPreferenceStorageKey, getAppearanceSectionStorageKey, readModViewState, readModViewPreferences, DEFAULT_PREVIEW_ASPECT_RATIO, getModAppearanceSectionId, getAppearanceImportTargetName, previewAspectRatioCache, aiSuggestionCache, callAppearanceSectionApi } from "./model/modHelpers.js";
import { BASE_SECTION_ID, getSectionId, getSectionName } from "./model/appearanceSections.js";
import { buildLocalCollectionView } from "./model/localCollections.js";
import { collectionSelectionKey, readCollectionSelections } from "../../lib/collectionSelection.js";
function ModView({
  characterName,
  activeGameId,
  managerTarget,
  onBack,
  devMode,
  onOpenPublishMod,
  onRequestMoveMod,
  onRequestBatchImportReview,
  runtimeInfo,
  onCharacterModsChanged
}) {
  const isWuwa = activeGameId === "wuthering-waves";
  const characterUsageStorageKey = getCharacterUsageStorageKey(activeGameId);
  const modViewStateStorageKey = getModViewStateStorageKey(activeGameId, characterName);
  const modViewPreferenceStorageKey = getModViewPreferenceStorageKey(activeGameId, characterName);
  const appearanceSectionStorageKey = getAppearanceSectionStorageKey(activeGameId, characterName);
  const initialViewState = React.useMemo(() => readModViewState(modViewStateStorageKey), [modViewStateStorageKey]);
  const initialViewPreferences = React.useMemo(() => readModViewPreferences(modViewPreferenceStorageKey), [modViewPreferenceStorageKey]);
  const [mods, setMods] = React.useState([]);
  const [modsLoadError, setModsLoadError] = React.useState("");
  const [modsLoading, setModsLoading] = React.useState(true);
  const modsLoadedRef = React.useRef(false);
  const loadMods = useCoalescedRefresh(readMods);
  const [appearanceSections, setAppearanceSections] = React.useState([]);
  const [activeAppearanceSectionId, setActiveAppearanceSectionId] = React.useState(() => {
    try {
      return localStorage.getItem(appearanceSectionStorageKey) || BASE_SECTION_ID;
    } catch {
      return BASE_SECTION_ID;
    }
  });
  const activeAppearanceSectionIdRef = React.useRef(activeAppearanceSectionId);
  const [appearanceSectionBusy, setAppearanceSectionBusy] = React.useState(false);
  const [characterAliases, setCharacterAliases] = React.useState([]);
  const [selectedMod, setSelectedMod] = React.useState(null);
  const [renameModTarget, setRenameModTarget] = React.useState(null);
  const [arknightsMod, setArknightsMod] = React.useState(null);
  const selectedModRef = React.useRef(null);
  const [localCollectionsEnabled, setLocalCollectionsEnabled] = React.useState(() => initialViewPreferences.localCollectionsEnabled);
  const [selectedLocalCollectionVariants, setSelectedLocalCollectionVariants] = React.useState(() => readCollectionSelections(activeGameId, characterName));
  const [openLocalCollectionGalleryMenu, setOpenLocalCollectionGalleryMenu] = React.useState(null);
  const [focusPulseModName, setFocusPulseModName] = React.useState(null);
  const [showScrollTop, setShowScrollTop] = React.useState(false);
  const [detailCollapsed, setDetailCollapsed] = React.useState(false);
  const galleryAnchorRef = React.useRef(null);
  const [previewImage, setPreviewImage] = React.useState(null);
  const [previewImageAspectRatio, setPreviewImageAspectRatio] = React.useState(DEFAULT_PREVIEW_ASPECT_RATIO);
  const [imageKey, setImageKey] = React.useState(Date.now());
  const [toast, setToast] = React.useState(null);
  const {
    modSearchQuery,
    setModSearchQuery,
    selectedTagFilters,
    toggleTagFilter,
    clearTagFilters,
    sortMethod,
    setSortMethod,
    sortedMods,
    setModInteractionOrder,
    draggedMod,
    dragOverMod,
    setDragOverMod,
    handleModDragStart,
    handleModDragEnd,
    handleModDrop
  } = useModOrdering({
    characterName,
    mods,
    activeAppearanceSectionId,
    setMods,
    setToast
  });
  const {
    fixRunning,
    reloadingMod,
    handleReloadMod,
    modContextMenu,
    setModContextMenu,
    iniRollbackBackups,
    iniRollbackConfirm,
    setIniRollbackConfirm,
    isDx12PakMod,
    openModSourceFolder,
    openModContextMenu,
    loadModIniBackups,
    requestRollbackModIni,
    confirmRollbackModIni,
    handleRequestMoveMod,
    handleFixMod
  } = useModContextActions({
    characterName,
    setToast,
    onRequestMoveMod,
    activeGameId
  });
  const {
    editingHotkey,
    setEditingHotkey,
    capturedKey,
    isEditingNotes,
    setIsEditingNotes,
    notesDraft,
    setNotesDraft,
    notesSaving,
    editingAliasSection,
    setEditingAliasSection,
    aliasDraft,
    setAliasDraft,
    aliasSaving,
    handleSaveModNotes,
    handleSaveHotkeyAlias,
    startHotkeyEdit,
    handleKeyCapture,
    saveHotkeyEdit,
    cancelHotkeyEdit
  } = useModEditing({
    selectedMod,
    setToast,
    setSelectedMod,
    setMods,
    characterName,
    loadModDetails
  });
  const {
    markModeUnlocked,
    setMarkModeUnlocked,
    showMarkPasswordModal,
    setShowMarkPasswordModal,
    markPasswordInput,
    setMarkPasswordInput,
    markPasswordError,
    setMarkPasswordError,
    markedMods,
    markDestFolder,
    markMoveRecord,
    markMoving,
    showMarkToolbar,
    setShowMarkToolbar,
    handleMarkMod,
    handleMarkPasswordSubmit,
    handleSelectDestFolder,
    handleMoveMarkedMods,
    handleRestoreMarkedMods,
    handleClearAllMarks
  } = useMarkedMods({
    devMode,
    activeGameId,
    characterName,
    setToast,
    loadMods
  });
  const {
    modTags,
    setModTags,
    tagInput,
    setTagInput,
    serverTags,
    tagSaving,
    showTagSuggestions,
    setShowTagSuggestions,
    aiTagLoading,
    aiTagSuggestions,
    setAiTagSuggestions,
    showAiTagModal,
    setShowAiTagModal,
    aiTagStage,
    aiTagElapsedSeconds,
    setAiTagElapsedSeconds,
    aiTagEmptyReason,
    showTagManagerModal,
    setShowTagManagerModal,
    tagManagerAdminKey,
    setTagManagerAdminKey,
    newTagName,
    setNewTagName,
    newTagColor,
    setNewTagColor,
    tagManagerLoading,
    editingTagId,
    setEditingTagId,
    editingTagName,
    setEditingTagName,
    editingTagColor,
    setEditingTagColor,
    saveModTags,
    addTagFromInput,
    handleAiSuggestTags,
    applyAiSuggestions,
    applyAiTags,
    reloadServerTags,
    handleCreateTag,
    handleUpdateTag,
    handleDeleteTag
  } = useModTags({
    devMode,
    selectedMod,
    activeGameId,
    setToast,
    characterName,
    mods
  });
  const [hotkeyGroups, setHotkeyGroups] = React.useState([]);
  const detailRequestRef = React.useRef(0);
  const [isRefreshingHotkeys, setIsRefreshingHotkeys] = React.useState(false);
  React.useEffect(() => {
    selectedModRef.current = selectedMod;
  }, [selectedMod]);
  const [isDragging, setIsDragging] = React.useState(false);
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);
  const [modToDelete, setModToDelete] = React.useState(null);
  const appearanceSectionsWithStats = React.useMemo(() => {
    const source = Array.isArray(appearanceSections) ? appearanceSections : [];
    const definitions = source.length > 0 ? source.map(section => ({
      ...section,
      id: getSectionId(section),
      sectionId: getSectionId(section)
    })) : [{
      id: BASE_SECTION_ID,
      sectionId: BASE_SECTION_ID,
      kind: "base",
      nameZh: t("mods.sections.originalCharacter"),
      nameEn: "Default"
    }];
    if (!definitions.some(section => getSectionId(section) === BASE_SECTION_ID)) {
      definitions.unshift({
        id: BASE_SECTION_ID,
        sectionId: BASE_SECTION_ID,
        kind: "base",
        nameZh: t("mods.sections.originalCharacter"),
        nameEn: "Default"
      });
    }
    const stats = new Map(definitions.map(section => [getSectionId(section), {
      modCount: 0,
      enabledCount: 0
    }]));
    mods.forEach(mod => {
      const requestedId = getModAppearanceSectionId(mod);
      const sectionId = stats.has(requestedId) ? requestedId : BASE_SECTION_ID;
      const current = stats.get(sectionId) || {
        modCount: 0,
        enabledCount: 0
      };
      current.modCount += 1;
      if (mod.enabled) current.enabledCount += 1;
      stats.set(sectionId, current);
    });
    return definitions.map(section => ({
      ...section,
      ...(stats.get(getSectionId(section)) || {
        modCount: 0,
        enabledCount: 0
      })
    }));
  }, [appearanceSections, mods]);
  const activeAppearanceSection = React.useMemo(() => appearanceSectionsWithStats.find(section => getSectionId(section) === activeAppearanceSectionId) || appearanceSectionsWithStats[0], [activeAppearanceSectionId, appearanceSectionsWithStats]);
  const {
    newModFile,
    setNewModFile,
    newModName,
    setNewModName,
    directInstallProgress,
    directImportReview,
    setDirectImportReview,
    updateDirectImportScanItem,
    setDirectImportPlanScanMode,
    setDirectImportPreviewItemSelected,
    updateDirectClassifyItem,
    setDirectClassifyInstallMode,
    handleStartDirectImportDecrypt,
    handleStartDirectImportInstall,
    handleAddMod,
    globalDragging,
    handleGlobalDragOver,
    handleGlobalDragLeave,
    handleGlobalDrop,
    handleDirectImportDropFiles,
    directImportTargetSectionName,
    directImportHasManagedInstall
  } = useModImport({
    setToast,
    characterName,
    activeAppearanceSectionIdRef,
    activeGameId,
    recordCharacterUsage,
    loadMods,
    appearanceSectionsWithStats,
    activeAppearanceSection
  });
  const activeAppearanceSectionName = getSectionName(activeAppearanceSection);
  const activeAppearanceImportTargetName = getAppearanceImportTargetName(activeAppearanceSection);
  const activeAppearanceEmptyHint = getSectionId(activeAppearanceSection) === BASE_SECTION_ID ? t("mods.sections.detectOnDropHint") : t("mods.sections.currentSectionDropHint");
  const activeAppearanceHasMods = Number(activeAppearanceSection?.modCount || 0) > 0;
  const appearanceFiltersActive = Boolean(modSearchQuery.trim()) || selectedTagFilters.size > 0;
  const localCollectionView = React.useMemo(() => buildLocalCollectionView(sortedMods, characterName, selectedLocalCollectionVariants, characterAliases), [sortedMods, characterName, selectedLocalCollectionVariants, characterAliases]);
  const displayMods = localCollectionsEnabled ? localCollectionView.displayMods : sortedMods;
  const appearanceFilterHasNoMatches = displayMods.length === 0 && activeAppearanceHasMods && appearanceFiltersActive;
  const selectedLocalCollection = selectedMod?.path ? localCollectionView.collectionByPath.get(selectedMod.path) || null : null;
  const conflictMap = React.useMemo(() => Object.fromEntries(mods.filter(mod => mod.conflicts?.length).map(mod => [mod.name, mod.conflicts.map(conflict => ({ hash: conflict.hash, otherMods: conflict.mods.filter(name => name !== mod.name) }))])), [mods]);
  const [confirmingConflicts, setConfirmingConflicts] = React.useState(false);
  const [showConflictDetail, setShowConflictDetail] = React.useState(null);
  const [exclusiveMode, setExclusiveMode] = React.useState(() => initialViewPreferences.exclusiveMode);
  React.useEffect(() => {
    const prefs = readModViewPreferences(modViewPreferenceStorageKey);
    setLocalCollectionsEnabled(prefs.localCollectionsEnabled);
    setExclusiveMode(prefs.exclusiveMode);
    setOpenLocalCollectionGalleryMenu(null);
    setSelectedLocalCollectionVariants(readCollectionSelections(activeGameId, characterName));
  }, [modViewPreferenceStorageKey]);
  React.useEffect(() => {
    function syncWindowSelection(event) {
      if (event.key === appearanceSectionStorageKey && appearanceSections.some(section => getSectionId(section) === event.newValue)) setActiveAppearanceSectionId(event.newValue);
      if (event.key === modViewPreferenceStorageKey) setExclusiveMode(readModViewPreferences(event.key).exclusiveMode);
      if (event.key === collectionSelectionKey(activeGameId, characterName)) {
        const next = readCollectionSelections(activeGameId, characterName);
        setSelectedLocalCollectionVariants(next);
        const name = next[selectedLocalCollection?.identity];
        const variant = mods.find(mod => mod.name === name);
        if (variant) setSelectedMod(variant);
      }
    }
    window.addEventListener("storage", syncWindowSelection);
    return () => window.removeEventListener("storage", syncWindowSelection);
  }, [appearanceSectionStorageKey, modViewPreferenceStorageKey, appearanceSections, activeGameId, characterName, selectedLocalCollection?.identity, mods]);
  const [batchMode, setBatchMode] = React.useState(false);
  const [selectedMods, setSelectedMods] = React.useState(new Set());
  const {
    viewMode,
    setGalleryDetailWidth,
    isResizingGallery,
    setIsResizingGallery,
    galleryContainerRef,
    maxDetailWidth,
    minDetailWidth,
    visibleDetailWidth,
    toggleViewMode
  } = useModGallery({
    setBatchMode,
    setSelectedMods
  });
  React.useEffect(() => {
    if (!openLocalCollectionGalleryMenu) return void 0;
    function handleDocClick(event) {
      if (event?.target?.closest?.(".local-collection-gallery-menu")) return;
      setOpenLocalCollectionGalleryMenu(null);
    }
    function handleKey(event) {
      if (event.key === "Escape") setOpenLocalCollectionGalleryMenu(null);
    }
    document.addEventListener("mousedown", handleDocClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleDocClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [openLocalCollectionGalleryMenu]);
  React.useEffect(() => {
    setOpenLocalCollectionGalleryMenu(null);
  }, [characterName, viewMode, localCollectionsEnabled]);
  function toggleLocalCollectionsEnabled() {
    setLocalCollectionsEnabled(prev => {
      const next = !prev;
      persistModViewPreferences({
        localCollectionsEnabled: next
      });
      if (!next) {
        setOpenLocalCollectionGalleryMenu(null);
      }
      return next;
    });
  }
  const [showImageLightbox, setShowImageLightbox] = React.useState(false);
  const [pakToggleProgress, setPakToggleProgress] = React.useState(null);
  const pakToggleProgressTimerRef = React.useRef(null);
  const [devInfoBusy, setDevInfoBusy] = React.useState(false);
  const modsListRef = React.useRef(null);
  const scrollRafRef = React.useRef(null);
  const handledManagerTargetRef = React.useRef(null);
  const pendingFocusRef = React.useRef(null);
  const enabledFocusCursorRef = React.useRef(-1);
  const focusPulseTimerRef = React.useRef(null);
  const modViewUnmountedRef = React.useRef(false);
  const characterNameRef = React.useRef(characterName);
  const scrollRestoredRef = React.useRef(false);
  const selectedModPathRef = React.useRef(null);
  React.useRef(0);
  const [modsLoadVersion, setModsLoadVersion] = React.useState(0);
  const {
    selectLocalCollectionVariant,
    focusNextEnabledMod,
    captureGalleryAnchor
  } = useModFocus({
    activeGameId,
    modsListRef,
    setFocusPulseModName,
    focusPulseTimerRef,
    setOpenLocalCollectionGalleryMenu,
    setSelectedLocalCollectionVariants,
    viewMode,
    selectedMod,
    setSelectedMod,
    setDetailCollapsed,
    displayMods,
    enabledFocusCursorRef,
    setToast,
    pendingFocusRef,
    characterName,
    modsLoadVersion,
    sortMethod,
    galleryAnchorRef,
    detailCollapsed,
    managerTarget,
    mods,
    handledManagerTargetRef
  });
  const {
    selectAppearanceSection,
    handleSaveCustomAppearanceSection,
    handleDeleteCustomAppearanceSection,
    handleAssignSelectedModAppearanceSection
  } = useAppearanceActions({
    activeAppearanceSectionIdRef,
    setActiveAppearanceSectionId,
    appearanceSectionStorageKey,
    setAppearanceSectionBusy,
    characterName,
    loadMods,
    setToast,
    selectedMod,
    appearanceSectionsWithStats,
    pendingFocusRef,
    modsLoadVersion
  });
  const {
    isRenamingMod,
    setIsRenamingMod,
    renameModDraft,
    setRenameModDraft,
    renameModSaving,
    aiNameLoading,
    aiNameResult,
    setAiNameResult,
    showAiNameModal,
    aiNameTaskTarget,
    aiNameTaskResult,
    aiNameTaskError,
    aiNameModalMinimized,
    aiNameStage,
    aiNameElapsedSeconds,
    minimizeAiNameModal,
    expandAiNameModal,
    closeAiNameTask,
    handleAiSuggestName,
    handleSaveModRename,
    handleRenameMod,
    applyAiName
  } = useModNaming({
    mods,
    setSelectedMod,
    selectedMod,
    characterName,
    activeGameId,
    serverTags,
    reloadServerTags,
    setToast,
    selectedModPathRef,
    pendingFocusRef,
    modsListRef,
    modsLoadVersion,
    loadMods
  });
  modViewUnmountedRef.current = false;
  characterNameRef.current = characterName;
  selectedModPathRef.current = selectedMod?.path || null;
  activeAppearanceSectionIdRef.current = activeAppearanceSectionId;
  React.useEffect(() => {
    if (!modsLoadedRef.current) return;
    const validSection = appearanceSectionsWithStats.some(section => getSectionId(section) === activeAppearanceSectionId);
    if (!validSection) {
      setActiveAppearanceSectionId(BASE_SECTION_ID);
      return;
    }
    try {
      localStorage.setItem(appearanceSectionStorageKey, activeAppearanceSectionId);
    } catch {}
  }, [activeAppearanceSectionId, appearanceSectionStorageKey, appearanceSectionsWithStats]);
  React.useEffect(() => {
    const sectionMods = mods.filter(mod => getModAppearanceSectionId(mod) === activeAppearanceSectionId);
    setSelectedMod(current => {
      if (current && getModAppearanceSectionId(current) === activeAppearanceSectionId) {
        return sectionMods.find(mod => mod.path === current.path || mod.name === current.name) || sectionMods[0] || null;
      }
      return sectionMods[0] || null;
    });
    setDetailCollapsed(false);
    setOpenLocalCollectionGalleryMenu(null);
    setBatchMode(false);
    setSelectedMods(new Set());
    enabledFocusCursorRef.current = -1;
    if (modsListRef.current) modsListRef.current.scrollTop = 0;
  }, [activeAppearanceSectionId]);
  function persistModViewState(nextPartialState = {}) {
    try {
      const currentState = readModViewState(modViewStateStorageKey);
      sessionStorage.setItem(modViewStateStorageKey, JSON.stringify({
        ...currentState,
        ...nextPartialState
      }));
    } catch {}
  }
  function persistModViewPreferences(nextPartialPreferences = {}) {
    try {
      const currentPreferences = readModViewPreferences(modViewPreferenceStorageKey);
      localStorage.setItem(modViewPreferenceStorageKey, JSON.stringify({
        ...currentPreferences,
        ...nextPartialPreferences
      }));
    } catch {}
  }
  function recordCharacterUsage(increment = 1) {
    if (!increment) return;
    try {
      const raw = localStorage.getItem(characterUsageStorageKey);
      const parsed = raw ? JSON.parse(raw) : {};
      parsed[characterName] = Number(parsed[characterName] || 0) + increment;
      localStorage.setItem(characterUsageStorageKey, JSON.stringify(parsed));
    } catch {}
  }
  React.useEffect(() => {
    loadMods({
      syncCharacterCache: true,
      conflictDelay: 650
    });
    const cleanup = window.api.onModsChanged?.(data => {
      if (data.gameId && data.gameId !== activeGameId) return;
      if (data.characterName === characterName || data.characterName === "__all__") {
        loadMods({
          syncCharacterCache: true,
          conflictDelay: 900
        });
      }
    });
    return () => {
      if (cleanup) cleanup();
    };
  }, [characterName]);
  React.useEffect(() => window.api.onHotkeysChanged?.(data => {
    const selected = selectedModRef.current;
    if (data.gameId !== activeGameId || !selected) return;
    if (data.characterName !== "__all__" && data.characterName !== characterName) return;
    if (data.modName && data.modName !== selected.name) return;
    loadModDetails(selected.name);
  }), [characterName, activeGameId]);
  React.useEffect(() => {
    enabledFocusCursorRef.current = -1;
  }, [characterName, sortMethod, modSearchQuery, selectedTagFilters]);
  React.useLayoutEffect(() => {
    if (displayMods.length > 0 && modsListRef.current && !scrollRestoredRef.current) {
      scrollRestoredRef.current = true;
      modsListRef.current.scrollTop = initialViewState.scrollTop || 0;
    }
  }, [initialViewState.scrollTop, displayMods]);
  React.useEffect(() => {
    persistModViewState({
      selectedModName: selectedMod?.name || null
    });
  }, [modViewStateStorageKey, selectedMod?.name]);
  React.useEffect(() => {
    if (!selectedLocalCollection?.identity || !selectedMod?.name) return;
    setSelectedLocalCollectionVariants(prev => prev[selectedLocalCollection.identity] === selectedMod.name ? prev : {
      ...prev,
      [selectedLocalCollection.identity]: selectedMod.name
    });
  }, [selectedLocalCollection?.identity, selectedMod?.name, activeGameId, characterName]);
  React.useEffect(() => {
    return () => {
      modViewUnmountedRef.current = true;
      clearTimeout(focusPulseTimerRef.current);
    };
  }, []);
  React.useEffect(() => {
    const cleanup = window.api.onNevernessPakToggleProgress?.(progress => {
      if (!progress || progress.characterName !== characterName) return;
      clearTimeout(pakToggleProgressTimerRef.current);
      setPakToggleProgress(progress);
      if (progress.status === "done" || progress.status === "error") {
        pakToggleProgressTimerRef.current = setTimeout(() => setPakToggleProgress(null), 1100);
      }
    });
    return () => {
      if (cleanup) cleanup();
      clearTimeout(pakToggleProgressTimerRef.current);
    };
  }, [characterName]);
  React.useEffect(() => {
    if (!aiTagLoading) return void 0;
    const startedAt = Date.now();
    setAiTagElapsedSeconds(0);
    const timer = setInterval(() => {
      setAiTagElapsedSeconds(Math.floor((Date.now() - startedAt) / 1e3));
    }, 1e3);
    return () => clearInterval(timer);
  }, [aiTagLoading]);
  React.useEffect(() => {
    if (!selectedMod) return;
    const handlePaste = e => {
      const active = document.activeElement;
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable)) {
        return;
      }
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type && item.type.startsWith("image/")) {
          const blob = item.getAsFile();
          if (!blob) continue;
          e.preventDefault();
          const reader = new FileReader();
          reader.onload = async () => {
            try {
              const dataUrl = reader.result;
              const result = await window.api.setModPreviewFromData(characterName, selectedMod.name, dataUrl);
              if (result?.success) {
                previewAspectRatioCache.delete(selectedMod.path || selectedMod.name);
                setImageKey(Date.now());
                if (result.previewUrl) setPreviewImage(result.previewUrl);else loadModDetails(selectedMod.name);
                setToast({
                  type: "success",
                  message: t("mods.preview.pasted")
                });
              } else {
                setToast({
                  type: "error",
                  message: t("mods.preview.pasteFailed", {
                    error: result?.error || t("common.errors.unknown")
                  })
                });
              }
            } catch (err) {
              setToast({
                type: "error",
                message: t("mods.preview.pasteException", {
                  message: err?.message || String(err)
                })
              });
            }
          };
          reader.readAsDataURL(blob);
          return;
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [selectedMod, characterName]);
  React.useEffect(() => {
    setIsRenamingMod(false);
    setRenameModDraft("");
    setIsEditingNotes(false);
    setNotesDraft("");
    setEditingAliasSection(null);
    setAliasDraft("");
  }, [selectedMod?.path]);
  React.useEffect(() => {
    if (selectedMod) {
      const cachedAspectRatio = previewAspectRatioCache.get(selectedMod.path || selectedMod.name);
      if (cachedAspectRatio) setPreviewImageAspectRatio(cachedAspectRatio);
      loadModDetails(selectedMod.name);
      const cached = aiSuggestionCache.get(selectedMod.path);
      if (cached) {
        setAiNameResult(cached);
      } else if (devMode) {
        setAiNameResult(null);
        window.api.devLoadAiSuggestCache({
          modPath: selectedMod.path
        }).then(r => {
          if (r?.result && r.result.groups) {
            aiSuggestionCache.set(selectedMod.path, r.result);
            setAiNameResult(r.result);
          }
        }).catch(() => {});
      } else {
        setAiNameResult(null);
      }
    } else {
      setPreviewImage(null);
      setPreviewImageAspectRatio(DEFAULT_PREVIEW_ASPECT_RATIO);
      detailRequestRef.current++;
      setHotkeyGroups([]);
      setIsRefreshingHotkeys(false);
      setAiNameResult(null);
    }
  }, [selectedMod]);
  React.useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3e3);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  async function readMods({
    syncCharacterCache = false
  } = {}, isCurrent) {
    setModsLoading(true);
    try {
      const result = await window.api.getMods(characterName);
      if (!isCurrent()) return;
      if (!result?.success) throw new Error(result?.error || t("mods.errors.read"));
      setModsLoadError("");
      const nextMods = Array.isArray(result.mods) ? result.mods : [];
      let nextSections = Array.isArray(result.sections) ? result.sections : [];
      if (nextSections.length === 0 && window.api?.getCharacterSections) {
        try {
          const sectionResult = await callAppearanceSectionApi("list", {
            characterName
          });
          nextSections = Array.isArray(sectionResult?.sections) ? sectionResult.sections : Array.isArray(sectionResult) ? sectionResult : [];
        } catch (_) {}
      }
      if (!isCurrent()) return;
      const availableSectionIds = new Set(nextSections.map(getSectionId));
      const requestedSectionId = activeAppearanceSectionIdRef.current || BASE_SECTION_ID;
      let targetSectionId = availableSectionIds.size === 0 || availableSectionIds.has(requestedSectionId) ? requestedSectionId : BASE_SECTION_ID;
      // Open a populated section on entry; later refreshes preserve a section
      // the user deliberately selected, including an empty import target.
      if (!modsLoadedRef.current && nextMods.length > 0 && !nextMods.some(mod => getModAppearanceSectionId(mod) === targetSectionId)) {
        const populatedSection = nextSections.find(section => nextMods.some(mod => getModAppearanceSectionId(mod) === getSectionId(section)));
        if (populatedSection) targetSectionId = getSectionId(populatedSection);
      }
      modsLoadedRef.current = true;
      if (targetSectionId !== activeAppearanceSectionIdRef.current) {
        activeAppearanceSectionIdRef.current = targetSectionId;
        setActiveAppearanceSectionId(targetSectionId);
      }
      setAppearanceSections(nextSections);
      setMods(nextMods);
      setCharacterAliases(Array.isArray(result.characterAliases) ? result.characterAliases : []);
      if (syncCharacterCache) {
        onCharacterModsChanged?.({
          characterName,
          mods: nextMods
        });
      }
      setModsLoadVersion(prev => prev + 1);
      setSelectedMod(prev => {
        const sectionMods = nextMods.filter(mod => getModAppearanceSectionId(mod) === targetSectionId);
        if (sectionMods.length === 0) return null;
        const preferredName = pendingFocusRef.current?.modName || prev?.name || initialViewState.selectedModName;
        const restoredMod = preferredName ? sectionMods.find(mod => mod.name === preferredName) : null;
        const stillExists = sectionMods.find(mod => mod.name === prev?.name);
        const selected = restoredMod || stillExists || sectionMods[0];
        if (!prev && !pendingFocusRef.current?.modName) {
          const selections = readCollectionSelections(activeGameId, characterName);
          const collection = buildLocalCollectionView(sectionMods, characterName, selections, result.characterAliases || []).collectionByPath.get(selected.path);
          return sectionMods.find(mod => mod.name === selections[collection?.identity]) || selected;
        }
        return selected;
      });
    } catch (error) {
      if (!isCurrent()) return;
      setModsLoadError(error?.message || String(error));
      setCharacterAliases([]);
      pendingFocusRef.current = null;
    } finally {
      if (isCurrent()) setModsLoading(false);
    }
  }
  function toggleBatchSelect(modName) {
    setSelectedMods(prev => {
      const next = new Set(prev);
      if (next.has(modName)) next.delete(modName);else next.add(modName);
      return next;
    });
  }
  function selectAllMods() {
    setSelectedMods(new Set(displayMods.map(m => m.name)));
  }
  function deselectAllMods() {
    setSelectedMods(new Set());
  }
  async function batchToggle(enable) {
    let count = 0, pending = false;
    for (const modName of selectedMods) {
      const mod = mods.find(item => item.name === modName);
      if (!mod || (enable ? mod.enabled : !mod.enabled && !mod.pendingEnabled)) continue;
      const result = await window.api.toggleMod(characterName, modName, enable);
      if (result.pending) pending = true;
      else if (result.success) count++;
      else { setToast({ type: "error", message: result.error }); break; }
    }
    recordCharacterUsage(count);
    if (pending) setToast({ type: "warning", message: t("mods.conflicts.confirmToast") });
    else if (count) setToast({ type: "success", message: t("mods.status.batchToggled", { status: enable ? t("common.actions.enable") : t("common.actions.disable"), count }) });
    await loadMods({ syncCharacterCache: count > 0 });
    setSelectedMods(new Set());
  }
  async function batchDelete() {
    if (!confirm(t("mods.delete.confirmSelected", {
      size: selectedMods.size
    }))) return;
    let count = 0;
    for (const modName of selectedMods) {
      try {
        await window.api.deleteMod(characterName, modName);
        count++;
      } catch (e) {
        console.error(`Failed to delete ${modName}:`, e);
      }
    }
    setToast({
      type: "success",
      message: t("mods.delete.selectedRecycled", {
        count
      })
    });
    setSelectedMods(new Set());
    setSelectedMod(null);
    await loadMods({
      syncCharacterCache: count > 0,
      conflictDelay: 900
    });
  }
  async function loadModDetails(name, refresh = false) {
    const requestId = ++detailRequestRef.current;
    const isCurrent = () => requestId === detailRequestRef.current && !modViewUnmountedRef.current && characterNameRef.current === characterName && selectedModRef.current?.name === name;
    setIsRefreshingHotkeys(refresh);
    setEditingHotkey(null);
    setEditingAliasSection(null);
    try {
      const result = await window.api.getModDetails(characterName, name, refresh);
      if (!isCurrent()) return;
      if (result.success) {
        setPreviewImage(result.previewUrl);
        setHotkeyGroups((Array.isArray(result.hotkeyGroups) ? result.hotkeyGroups : [{
          name,
          hotkeys: result.hotkeys || []
        }]).filter(group => group.hotkeys?.length));
        if (refresh) setToast({
          type: "success",
          message: t("mods.hotkeys.refreshed")
        });
      } else {
        setHotkeyGroups([]);
        setToast({
          type: "error",
          message: result.error || t("mods.errors.readDetails")
        });
      }
    } catch (error) {
      if (!isCurrent()) return;
      setHotkeyGroups([]);
      console.error("Failed to load mod details:", error);
      setToast({
        type: "error",
        message: error.message || t("mods.errors.readDetails")
      });
    } finally {
      if (isCurrent()) {
        setIsRefreshingHotkeys(false);
      }
    }
  }
  async function handleToggle(modName, currentStatus, e) {
    if (e) e.stopPropagation();
    const newState = !(currentStatus || mods.find(mod => mod.name === modName)?.pendingEnabled);
    pendingFocusRef.current = {
      characterName,
      modName,
      scrollTop: modsListRef.current?.scrollTop || 0,
      targetLoadVersion: modsLoadVersion + 1,
      forceTop: sortMethod === "enabled" && newState,
      preferTopAfterSort: sortMethod === "enabled" && newState
    };
    setModInteractionOrder(prev => {
      const next = [modName, ...prev.filter(n => n !== modName)];
      try {
        localStorage.setItem(`modview-interaction-order-${characterName}`, JSON.stringify(next));
      } catch {}
      return next;
    });
    if (exclusiveMode && newState) {
      for (const m of mods) {
        if (m.name !== modName && m.enabled) {
          await window.api.toggleMod(characterName, m.name, false);
        }
      }
    }
    const result = await window.api.toggleMod(characterName, modName, newState);
    if (result.pending) {
      pendingFocusRef.current = null;
      setToast({ type: "warning", message: t("mods.conflicts.confirmToast") });
      await loadMods();
      return;
    }
    if (result.success) {
      recordCharacterUsage(1);
      await loadMods({
        syncCharacterCache: true,
        conflictDelay: 1200
      });
      if (result.persistRestored) {
        setToast({
          type: "success",
          message: t("mods.status.accessoriesRestored", {
            modName
          })
        });
      }
      if (activeGameId === "arknights" && (result.autoReloaded || result.reloadError)) {
        setToast({ type: result.reloadError ? "error" : "success", message: result.reloadError ? t("arknights.reloadToggleFailed", { error: result.reloadError }) : t("arknights.reloaded", result) });
      }
    } else {
      pendingFocusRef.current = null;
      setToast({
        type: "error",
        message: t("common.errors.operationWithReason", {
          error: result.error
        })
      });
    }
  }
  async function confirmConflictSelection() {
    if (confirmingConflicts) return;
    setConfirmingConflicts(true);
    try {
      const result = await window.api.confirmModConflicts(characterName);
      setToast({ type: result.success && !result.reloadError ? "success" : "error", message: result.reloadError ? t("arknights.reloadToggleFailed", { error: result.reloadError }) : result.success ? t("mods.conflicts.confirmed") : result.error || t("mods.errors.read") });
      await loadMods({ syncCharacterCache: result.success });
    } finally { setConfirmingConflicts(false); }
  }
  async function handlePinMod(modName, nextPinned, e) {
    if (e) e.stopPropagation();
    pendingFocusRef.current = {
      characterName,
      modName,
      scrollTop: nextPinned ? 0 : modsListRef.current?.scrollTop || 0,
      targetLoadVersion: modsLoadVersion + 1,
      forceTop: nextPinned
    };
    const result = await window.api.pinMod(characterName, modName, nextPinned);
    if (result.success) {
      await loadMods();
      setToast({
        type: "success",
        message: nextPinned ? t("mods.pin.added", {
          modName
        }) : t("mods.pin.removed", {
          modName
        })
      });
    } else {
      pendingFocusRef.current = null;
      setToast({
        type: "error",
        message: t("mods.pin.failed", {
          error: result.error
        })
      });
    }
  }
  function toggleExclusiveMode() {
    const next = !exclusiveMode;
    setExclusiveMode(next);
    persistModViewPreferences({
      exclusiveMode: next, selectionModeVersion: 2
    });
    if (next) setToast({
      type: "success",
      message: t("mods.library.singleSelectEnabled")
    });
  }
  async function handleCopyDevModInfo() {
    if (!selectedMod?.path) {
      setToast({
        type: "error",
        message: t("mods.details.selectionRequired")
      });
      return;
    }
    setDevInfoBusy(true);
    try {
      const result = await window.api.devCopyModInfo(selectedMod.path, {
        modName: selectedMod.name,
        characterName,
        gameId: activeGameId
      });
      if (!result?.success) throw new Error(result?.error || t("common.errors.copyFailed"));
      const previewText = result.hasPreview ? t("mods.metadata.coverCopied") : t("mods.metadata.noCover");
      setToast({
        type: "success",
        message: t("mods.metadata.copiedSummary", {
          sourceModName: result.sourceModName || selectedMod.name,
          tagCount: result.tagCount || 0,
          previewText
        })
      });
    } catch (e) {
      setToast({
        type: "error",
        message: t("mods.metadata.copyFailed", {
          message: e?.message || String(e)
        })
      });
    } finally {
      setDevInfoBusy(false);
    }
  }
  async function handleImportDevModInfo() {
    if (!selectedMod?.path) {
      setToast({
        type: "error",
        message: t("mods.metadata.targetRequired")
      });
      return;
    }
    const targetMod = selectedMod;
    setDevInfoBusy(true);
    try {
      const result = await window.api.devImportModInfo(targetMod.path);
      if (!result?.success) throw new Error(result?.error || t("common.errors.importFailed"));
      const importedTags = (result.tags || []).map(t => typeof t === "string" ? t : t?.name || "").filter(Boolean);
      const patch = {
        tags: importedTags,
        ...(result.previewUrl ? {
          previewUrl: result.previewUrl
        } : {})
      };
      setMods(prev => prev.map(mod => mod.path === targetMod.path || mod.name === targetMod.name ? {
        ...mod,
        ...patch
      } : mod));
      setSelectedMod(prev => prev && (prev.path === targetMod.path || prev.name === targetMod.name) ? {
        ...prev,
        ...patch
      } : prev);
      previewAspectRatioCache.delete(targetMod.path || targetMod.name);
      const currentSelected = selectedModRef.current;
      if (currentSelected?.path === targetMod.path || currentSelected?.name === targetMod.name) {
        setModTags(importedTags);
        setImageKey(Date.now());
        if (result.previewUrl) setPreviewImage(result.previewUrl);else await loadModDetails(targetMod.name, false);
      }
      setToast({
        type: "success",
        message: t("mods.metadata.importedSummary", {
          sourceModName: result.sourceModName || t("mods.metadata.modCopied"),
          tagCount: result.tagCount || 0,
          status: result.copiedImage ? t("mods.metadata.withCover") : ""
        })
      });
    } catch (e) {
      setToast({
        type: "error",
        message: t("mods.metadata.importFailed", {
          message: e?.message || String(e)
        })
      });
    } finally {
      setDevInfoBusy(false);
    }
  }
  function clearAiSuggestions() {
    if (selectedMod?.path) aiSuggestionCache.delete(selectedMod.path);
    setAiNameResult(null);
  }
  async function handleDeleteMod() {
    if (!modToDelete) return;
    const result = await window.api.deleteMod(characterName, modToDelete);
    if (result.success) {
      setToast({
        type: "success",
        message: t("mods.delete.recycled")
      });
      await loadMods({
        syncCharacterCache: true,
        conflictDelay: 1200
      });
      if (selectedMod?.name === modToDelete) {
        setSelectedMod(null);
      }
    } else {
      setToast({
        type: "error",
        message: t("common.errors.deleteWithReason", {
          error: result.error
        })
      });
    }
    setShowDeleteModal(false);
    setModToDelete(null);
  }
  function confirmDelete(modName, e) {
    e.stopPropagation();
    setModToDelete(modName);
    setShowDeleteModal(true);
  }
  function handleGameModTools(mod, mode) {
    if (activeGameId !== "arknights") return handleFixMod(mod, mode);
    setModContextMenu(null);
    setArknightsMod(mod);
  }
  return <div ref={galleryContainerRef} className={`mod-view-container page-transition-enter ${activeGameId === "arknights" ? "arknights-mod-view" : ""} ${globalDragging ? "global-dragging" : ""} view-mode-${viewMode}${isResizingGallery ? " resizing-gallery" : ""} `} onDragOver={handleGlobalDragOver} onDragLeave={handleGlobalDragLeave} onDrop={handleGlobalDrop}>
      {activeGameId === "arknights" && <ArknightsLibraryNotice />}
      {activeGameId === "arknights" && arknightsMod && <ArknightsToolsDialog key={`${characterName}:${arknightsMod.name}`} characterName={characterName} mod={arknightsMod} onClose={() => setArknightsMod(null)} onCreated={loadMods} />}
      {globalDragging && <div className="global-drop-overlay">
          <div className="global-drop-content">
            <Icon name="box" size={28} className="mod-drop-icon" />
            {runtimeInfo?.elevated ? <React.Fragment>
                <div>{t("mods.import.elevatedDropTitle")}</div>
                <div className="mod-drop-hint">
                  {t("mods.import.elevatedDropHint")}
                </div>
              </React.Fragment> : <div>{t("mods.import.releaseHint")}</div>}
          </div>
        </div>}
      {directInstallProgress && <div className="mod-import-progress">
          <div className="mod-import-progress-heading">
            <span className="spinner" aria-hidden={true} />
            {directInstallProgress.phase === "decrypt" ? t("downloads.status.extracting") : t("downloads.status.installing")}
            {" · "}
            {characterName}
            {" / "}
            {activeAppearanceImportTargetName}
          </div>
          <div className="mod-import-progress-name">
            {directInstallProgress.modName || t("common.status.processing")}
          </div>
          <div className="mod-import-progress-track">
            <div style={{
          width: `${Math.min(100, Math.round(directInstallProgress.current / Math.max(1, directInstallProgress.total) * 100))}%`
        }} className="mod-import-progress-fill" />
          </div>
          <div className="mod-view-hint">
            {directInstallProgress.current}
            {" / "}
            {directInstallProgress.total}
          </div>
        </div>}
      <DirectImportDialog directImportReview={directImportReview} setDirectImportReview={setDirectImportReview} directImportHasManagedInstall={directImportHasManagedInstall} characterName={characterName} directImportTargetSectionName={directImportTargetSectionName} setDirectImportPlanScanMode={setDirectImportPlanScanMode} updateDirectImportScanItem={updateDirectImportScanItem} setDirectImportPreviewItemSelected={setDirectImportPreviewItemSelected} activeGameId={activeGameId} handleStartDirectImportDecrypt={handleStartDirectImportDecrypt} updateDirectClassifyItem={updateDirectClassifyItem} setDirectClassifyInstallMode={setDirectClassifyInstallMode} handleStartDirectImportInstall={handleStartDirectImportInstall} />
      {pakToggleProgress && <div className="mod-view-overlay">
          <div className="mod-view-panel">
            <div className="mod-view-row">
              <div className={`mod-view-pak-progress-icon ${pakToggleProgress.status === "done" ? "is-done" : ""}`}>
                {pakToggleProgress.status === "done" ? <Icon name="check" size={18} /> : <span className="spinner" aria-hidden={true} />}
              </div>
              <div className="mod-view-content">
                <div className="mod-view-heading">
                  {pakToggleProgress.phase === "prepare" ? t("mods.pak.organizing") : pakToggleProgress.enable ? t("mods.pak.enabling") : t("mods.pak.disabling")}
                </div>
                <div className="mod-view-truncated-text">
                  {pakToggleProgress.modName || "Pak Mod"}
                </div>
              </div>
            </div>
            <div className="mod-view-pak-progress-message">
              {pakToggleProgress.message || t("mods.status.movingDirectory")}
            </div>
            <div className="mod-view-pak-progress-track">
              <div style={{
            width: `${Math.min(100, Math.round(Number(pakToggleProgress.current || 0) / Math.max(1, Number(pakToggleProgress.total || 1)) * 100))}%`
          }} className="progress-fill mod-view-pak-progress-fill" />
            </div>
          </div>
        </div>}
      <ModLibraryPanel collectionByPath={localCollectionView.collectionByPath} mods={mods} confirmingConflicts={confirmingConflicts} confirmConflictSelection={confirmConflictSelection} viewMode={viewMode} characterName={characterName} activeAppearanceSectionName={activeAppearanceSectionName} exclusiveMode={exclusiveMode} toggleExclusiveMode={toggleExclusiveMode} localCollectionsEnabled={localCollectionsEnabled} toggleLocalCollectionsEnabled={toggleLocalCollectionsEnabled} toggleViewMode={toggleViewMode} appearanceSectionsWithStats={appearanceSectionsWithStats} activeAppearanceSectionId={activeAppearanceSectionId} appearanceSectionBusy={appearanceSectionBusy} selectAppearanceSection={selectAppearanceSection} handleSaveCustomAppearanceSection={handleSaveCustomAppearanceSection} handleDeleteCustomAppearanceSection={handleDeleteCustomAppearanceSection} modsLoadError={modsLoadError} modsLoading={modsLoading} loadMods={loadMods} modSearchQuery={modSearchQuery} setModSearchQuery={setModSearchQuery} sortMethod={sortMethod} setSortMethod={setSortMethod} focusNextEnabledMod={focusNextEnabledMod} sortedMods={sortedMods} displayMods={displayMods} selectedTagFilters={selectedTagFilters} toggleTagFilter={toggleTagFilter} clearTagFilters={clearTagFilters} batchMode={batchMode} selectedMods={selectedMods} selectAllMods={selectAllMods} deselectAllMods={deselectAllMods} batchToggle={batchToggle} batchDelete={batchDelete} modsListRef={modsListRef} scrollRafRef={scrollRafRef} persistModViewState={persistModViewState} setShowScrollTop={setShowScrollTop} activeAppearanceSection={activeAppearanceSection} appearanceFilterHasNoMatches={appearanceFilterHasNoMatches} activeAppearanceEmptyHint={activeAppearanceEmptyHint} openLocalCollectionGalleryMenu={openLocalCollectionGalleryMenu} selectedMod={selectedMod} detailCollapsed={detailCollapsed} focusPulseModName={focusPulseModName} captureGalleryAnchor={captureGalleryAnchor} setSelectedMod={setSelectedMod} setDetailCollapsed={setDetailCollapsed} openModContextMenu={openModContextMenu} setOpenLocalCollectionGalleryMenu={setOpenLocalCollectionGalleryMenu} selectLocalCollectionVariant={selectLocalCollectionVariant} markModeUnlocked={markModeUnlocked} markedMods={markedMods} activeGameId={activeGameId} handleMarkMod={handleMarkMod} handleToggle={handleToggle} isDragging={isDragging} setIsDragging={setIsDragging} handleDirectImportDropFiles={handleDirectImportDropFiles} newModFile={newModFile} newModName={newModName} setNewModName={setNewModName} handleAddMod={handleAddMod} setNewModFile={setNewModFile} activeAppearanceImportTargetName={activeAppearanceImportTargetName} draggedMod={draggedMod} dragOverMod={dragOverMod} toggleBatchSelect={toggleBatchSelect} handleModDragStart={handleModDragStart} handleModDragEnd={handleModDragEnd} setDragOverMod={setDragOverMod} handleModDrop={handleModDrop} conflictMap={conflictMap} setShowConflictDetail={setShowConflictDetail} showConflictDetail={showConflictDetail} />
      {selectedMod && <div className={`mod-gallery-splitter ${isResizingGallery ? "active" : ""} ${detailCollapsed ? "collapsed" : ""}`} aria-hidden={detailCollapsed} inert={detailCollapsed ? "" : void 0} onMouseDown={e => {
      if (e.target.closest(".mod-gallery-collapse-btn")) return;
      if (detailCollapsed) return;
      e.preventDefault();
      setIsResizingGallery(true);
    }} onDoubleClick={e => {
      if (e.target.closest(".mod-gallery-collapse-btn")) return;
      setGalleryDetailWidth(DEFAULT_DETAIL_WIDTH);
    }}>
          <button type="button" className="mod-gallery-collapse-btn" onClick={e => {
        e.stopPropagation();
        if (viewMode === "gallery") captureGalleryAnchor(selectedMod?.name);
        setDetailCollapsed(true);
      }} onMouseDown={e => e.stopPropagation()} title={t("mods.details.collapseHint")} aria-expanded={!detailCollapsed} aria-controls="mod-detail-panel" aria-label={t("mods.details.collapse")}>
            <Icon name="chevron-right" size={13} />
          </button>
          <div className="mod-gallery-splitter-handle" title={t("mods.details.resizeHint")} role="separator" tabIndex={detailCollapsed ? -1 : 0} aria-label={t("mods.details.resizeLabel")} aria-orientation="vertical" aria-controls="mod-detail-panel" aria-valuemin={Math.round(minDetailWidth)} aria-valuemax={Math.round(maxDetailWidth)} aria-valuenow={Math.round(visibleDetailWidth)} onKeyDown={event => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const width = event.key === "Home" ? minDetailWidth : event.key === "End" ? maxDetailWidth : visibleDetailWidth + (event.key === "ArrowLeft" ? 24 : -24);
        setGalleryDetailWidth(Math.min(maxDetailWidth, Math.max(minDetailWidth, width)));
      }}>
          </div>
        </div>}
      <ModDetailsPanel viewMode={viewMode} selectedMod={selectedMod} detailCollapsed={detailCollapsed} visibleDetailWidth={visibleDetailWidth} isRenamingMod={isRenamingMod} renameModDraft={renameModDraft} setRenameModDraft={setRenameModDraft} handleSaveModRename={handleSaveModRename} setIsRenamingMod={setIsRenamingMod} renameModSaving={renameModSaving} previewImage={previewImage} isDragging={isDragging} previewImageAspectRatio={previewImageAspectRatio} setIsDragging={setIsDragging} characterName={characterName} setImageKey={setImageKey} setPreviewImage={setPreviewImage} loadModDetails={loadModDetails} setToast={setToast} setShowImageLightbox={setShowImageLightbox} setPreviewImageAspectRatio={setPreviewImageAspectRatio} imageKey={imageKey} handleAssignSelectedModAppearanceSection={handleAssignSelectedModAppearanceSection} appearanceSectionBusy={appearanceSectionBusy} appearanceSectionsWithStats={appearanceSectionsWithStats} selectedLocalCollection={selectedLocalCollection} selectLocalCollectionVariant={selectLocalCollectionVariant} selectedTagFilters={selectedTagFilters} toggleTagFilter={toggleTagFilter} activeGameId={activeGameId} isEditingNotes={isEditingNotes} setNotesDraft={setNotesDraft} setIsEditingNotes={setIsEditingNotes} notesDraft={notesDraft} notesSaving={notesSaving} handleSaveModNotes={handleSaveModNotes} isRefreshingHotkeys={isRefreshingHotkeys} hotkeyGroups={hotkeyGroups} editingAliasSection={editingAliasSection} aliasDraft={aliasDraft} setAliasDraft={setAliasDraft} handleSaveHotkeyAlias={handleSaveHotkeyAlias} setEditingAliasSection={setEditingAliasSection} aliasSaving={aliasSaving} editingHotkey={editingHotkey} capturedKey={capturedKey} handleKeyCapture={handleKeyCapture} saveHotkeyEdit={saveHotkeyEdit} cancelHotkeyEdit={cancelHotkeyEdit} startHotkeyEdit={startHotkeyEdit} devMode={devMode} setShowTagManagerModal={setShowTagManagerModal} reloadServerTags={reloadServerTags} modTags={modTags} setModTags={setModTags} tagInput={tagInput} setTagInput={setTagInput} setShowTagSuggestions={setShowTagSuggestions} addTagFromInput={addTagFromInput} handleAiSuggestTags={handleAiSuggestTags} aiTagLoading={aiTagLoading} saveModTags={saveModTags} tagSaving={tagSaving} showTagSuggestions={showTagSuggestions} serverTags={serverTags} aiNameResult={aiNameResult} clearAiSuggestions={clearAiSuggestions} handleAiSuggestName={handleAiSuggestName} aiNameLoading={aiNameLoading} applyAiName={applyAiName} applyAiTags={applyAiTags} aiNameStage={aiNameStage} aiNameElapsedSeconds={aiNameElapsedSeconds} handlePinMod={handlePinMod} openModSourceFolder={openModSourceFolder} isDx12PakMod={isDx12PakMod} handleFixMod={handleGameModTools} fixRunning={fixRunning} confirmDelete={confirmDelete} handleToggle={handleToggle} onOpenPublishMod={onOpenPublishMod} handleCopyDevModInfo={handleCopyDevModInfo} devInfoBusy={devInfoBusy} handleImportDevModInfo={handleImportDevModInfo} />
      {toast && ReactDOM.createPortal(<div className={`toast toast-${toast.type}`}>{toast.message}</div>, document.body)}
      {showDeleteModal && <div className="modal-backdrop">
          <div className="modal-content">
            <div className="dialog-title mod-view-delete-heading">
              {t("common.dialog.confirmDelete")}
            </div>
            <p className="dialog-desc">
              {t("mods.delete.confirmPrefix")}
              <strong>
                {'"'}
                {modToDelete}
                {'"'}
              </strong>
              {t("characters.delete.confirmSuffix")}
              <br />
              {t("mods.delete.recycleHint")}
            </p>
            <div className="dialog-actions">
              <button className="btn" onClick={() => setShowDeleteModal(false)}>
                {t("common.actions.cancel")}
              </button>
              <button className="btn btn-danger" onClick={handleDeleteMod}>
                {t("common.actions.recycle")}
              </button>
            </div>
          </div>
        </div>}
      {showScrollTop && ReactDOM.createPortal(<button onClick={() => modsListRef.current && modsListRef.current.scrollTo({
      top: 0,
      behavior: "smooth"
    })} title={t("common.actions.backToTop")} aria-label={t("common.actions.backToTop")} className="scroll-top-btn">
            <Icon name="arrow-up" size={16} />
          </button>, document.body)}
      <MarkPasswordDialog showMarkPasswordModal={showMarkPasswordModal} setShowMarkPasswordModal={setShowMarkPasswordModal} markPasswordInput={markPasswordInput} setMarkPasswordInput={setMarkPasswordInput} setMarkPasswordError={setMarkPasswordError} handleMarkPasswordSubmit={handleMarkPasswordSubmit} markPasswordError={markPasswordError} />
      <MarkedModsToolbar markModeUnlocked={markModeUnlocked} setShowMarkToolbar={setShowMarkToolbar} markedMods={markedMods} showMarkToolbar={showMarkToolbar} markDestFolder={markDestFolder} handleSelectDestFolder={handleSelectDestFolder} handleMoveMarkedMods={handleMoveMarkedMods} markMoving={markMoving} markMoveRecord={markMoveRecord} handleRestoreMarkedMods={handleRestoreMarkedMods} handleClearAllMarks={handleClearAllMarks} setMarkModeUnlocked={setMarkModeUnlocked} />
      <ModContextMenu modContextMenu={modContextMenu} setModContextMenu={setModContextMenu} handlePinMod={handlePinMod} handleRequestRenameMod={setRenameModTarget} openModSourceFolder={openModSourceFolder} isDx12PakMod={isDx12PakMod} handleRequestMoveMod={handleRequestMoveMod} handleFixMod={handleGameModTools} isArknights={activeGameId === "arknights"} reloadingMod={reloadingMod} handleReloadMod={handleReloadMod} fixRunning={fixRunning} loadModIniBackups={loadModIniBackups} iniRollbackBackups={iniRollbackBackups} requestRollbackModIni={requestRollbackModIni} characterName={characterName} setToast={setToast} confirmDelete={confirmDelete} />
      {renameModTarget && <RenameModDialog key={renameModTarget.path} mod={renameModTarget} saving={renameModSaving} onRename={handleRenameMod} onClose={() => setRenameModTarget(null)} />}
      <IniRollbackDialog iniRollbackConfirm={iniRollbackConfirm} setIniRollbackConfirm={setIniRollbackConfirm} confirmRollbackModIni={confirmRollbackModIni} />
      <AiTagDialog showAiTagModal={showAiTagModal} setShowAiTagModal={setShowAiTagModal} aiTagLoading={aiTagLoading} aiTagStage={aiTagStage} aiTagElapsedSeconds={aiTagElapsedSeconds} aiTagSuggestions={aiTagSuggestions} setAiTagSuggestions={setAiTagSuggestions} aiTagEmptyReason={aiTagEmptyReason} applyAiSuggestions={applyAiSuggestions} handleAiSuggestTags={handleAiSuggestTags} />
      <AiNameDialog showAiNameModal={showAiNameModal} aiNameModalMinimized={aiNameModalMinimized} aiNameLoading={aiNameLoading} minimizeAiNameModal={minimizeAiNameModal} closeAiNameTask={closeAiNameTask} aiNameTaskTarget={aiNameTaskTarget} selectedMod={selectedMod} aiNameStage={aiNameStage} aiNameElapsedSeconds={aiNameElapsedSeconds} aiNameTaskError={aiNameTaskError} aiNameTaskResult={aiNameTaskResult} aiNameResult={aiNameResult} applyAiName={applyAiName} applyAiTags={applyAiTags} modTags={modTags} handleAiSuggestName={handleAiSuggestName} />
      <AiNameProgress aiNameTaskTarget={aiNameTaskTarget} aiNameModalMinimized={aiNameModalMinimized} aiNameTaskError={aiNameTaskError} aiNameLoading={aiNameLoading} expandAiNameModal={expandAiNameModal} aiNameStage={aiNameStage} aiNameElapsedSeconds={aiNameElapsedSeconds} closeAiNameTask={closeAiNameTask} />
      {showImageLightbox && previewImage && ReactDOM.createPortal(<div onClick={() => setShowImageLightbox(false)} className="mod-view-preview-lightbox">
            <img src={previewImage} alt="Preview" onClick={e => e.stopPropagation()} className="mod-view-lightbox-image" />
            <button onClick={() => setShowImageLightbox(false)} aria-label={t("common.actions.close")} className="icon-btn mod-view-action">
              <Icon name="x" size={18} />
            </button>
          </div>, document.body)}
      <TagManagerDialog showTagManagerModal={showTagManagerModal} setShowTagManagerModal={setShowTagManagerModal} reloadServerTags={reloadServerTags} tagManagerLoading={tagManagerLoading} tagManagerAdminKey={tagManagerAdminKey} setTagManagerAdminKey={setTagManagerAdminKey} newTagName={newTagName} setNewTagName={setNewTagName} handleCreateTag={handleCreateTag} newTagColor={newTagColor} setNewTagColor={setNewTagColor} serverTags={serverTags} editingTagId={editingTagId} editingTagName={editingTagName} setEditingTagName={setEditingTagName} handleUpdateTag={handleUpdateTag} setEditingTagId={setEditingTagId} editingTagColor={editingTagColor} setEditingTagColor={setEditingTagColor} handleDeleteTag={handleDeleteTag} />
    </div>;
}
export { ModView as default };
