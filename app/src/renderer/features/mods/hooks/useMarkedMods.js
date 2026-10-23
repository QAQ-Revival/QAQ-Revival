import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
import {
  readMarkedMods,
  flattenMarkedMods,
  writeMarkedMods,
  findMarkedModKey,
} from "../model/markedMods.js";
export function useMarkedMods({
  devMode,
  activeGameId,
  characterName,
  setToast,
  loadMods,
}) {
  const [markModeUnlocked, setMarkModeUnlocked] = React.useState(false);
  const [showMarkPasswordModal, setShowMarkPasswordModal] =
    React.useState(false);
  const [markPasswordInput, setMarkPasswordInput] = React.useState("");
  const [markPasswordError, setMarkPasswordError] = React.useState("");
  const [markedMods, setMarkedMods] = React.useState(() => readMarkedMods());
  const [markDestFolder, setMarkDestFolder] = React.useState(
    () => localStorage.getItem("qaqm-mark-dest") || "",
  );
  const [markMoveRecord, setMarkMoveRecord] = React.useState(null);
  const [markMoving, setMarkMoving] = React.useState(false);
  const [showMarkToolbar, setShowMarkToolbar] = React.useState(false);
  React.useEffect(() => {
    if (devMode && !markModeUnlocked) {
      setMarkModeUnlocked(true);
      loadMarkedModsFromMain({
        migrateLocal: true,
      });
      window.api.markGetMoveRecord?.().then((r) => {
        if (r?.success && r.record) setMarkMoveRecord(r.record);
      });
    } else if (!devMode && markModeUnlocked) {
      setMarkModeUnlocked(false);
    }
  }, [devMode]);
  React.useEffect(() => {
    if (!devMode) return;
    loadMarkedModsFromMain({
      migrateLocal: true,
    });
    const cleanup = window.api.onMarkedModsChanged?.((data) => {
      if (!data?.gameId || data.gameId === activeGameId) {
        loadMarkedModsFromMain();
      }
    });
    return () => {
      if (cleanup) cleanup();
    };
  }, [devMode, activeGameId]);
  async function loadMarkedModsFromMain({ migrateLocal = false } = {}) {
    const result = await window.api.devGetMarkedMods?.(activeGameId);
    if (result?.success) {
      const local = readMarkedMods();
      const next = flattenMarkedMods(result.marked, activeGameId);
      if (migrateLocal) {
        for (const [path, item] of Object.entries(local)) {
          if (!item || item.gameId !== activeGameId || next[path]) continue;
          if (!item.characterName || !item.name) continue;
          next[path] = item;
          await window.api.devMarkMod?.(
            activeGameId,
            item.characterName,
            item.name,
            path,
          );
        }
      }
      writeMarkedMods(next);
      setMarkedMods(next);
      return next;
    }
    const fallback = readMarkedMods();
    setMarkedMods(fallback);
    return fallback;
  }
  async function handleMarkMod(mod, e) {
    e.stopPropagation();
    const next = {
      ...readMarkedMods(),
    };
    const existingKey = findMarkedModKey(
      next,
      mod,
      characterName,
      activeGameId,
    );
    if (existingKey) {
      delete next[existingKey];
      writeMarkedMods(next);
      setMarkedMods(next);
      await window.api.devUnmarkMod?.(activeGameId, characterName, mod.name);
    } else {
      next[mod.path] = {
        name: mod.name,
        originalName: mod.originalName,
        characterName,
        gameId: activeGameId,
        path: mod.path,
        markedAt: new Date().toISOString(),
      };
      writeMarkedMods(next);
      setMarkedMods(next);
      await window.api.devMarkMod?.(
        activeGameId,
        characterName,
        mod.name,
        mod.path,
      );
    }
  }
  async function handleMarkPasswordSubmit() {
    const result = await window.api.devUnlock?.(markPasswordInput);
    if (result?.success) {
      setMarkModeUnlocked(true);
      setShowMarkPasswordModal(false);
      setMarkPasswordError("");
      loadMarkedModsFromMain({
        migrateLocal: true,
      });
      window.api.markGetMoveRecord().then((r) => {
        if (r?.success && r.record) setMarkMoveRecord(r.record);
      });
    } else {
      setMarkPasswordError(result?.error || t("mods.marked.enableFailed"));
      setMarkPasswordInput("");
    }
  }
  async function handleSelectDestFolder() {
    const result = await window.api.markSelectDestFolder();
    if (result.success) {
      setMarkDestFolder(result.folderPath);
      localStorage.setItem("qaqm-mark-dest", result.folderPath);
    }
  }
  async function handleMoveMarkedMods() {
    const entries = Object.entries(readMarkedMods()).map(([markKey, item]) => ({
      ...item,
      markKey,
    }));
    if (entries.length === 0) {
      setToast({
        type: "error",
        message: t("mods.marked.noMarkedMods"),
      });
      return;
    }
    if (!markDestFolder) {
      setToast({
        type: "error",
        message: t("mods.marked.targetRequired"),
      });
      return;
    }
    setMarkMoving(true);
    try {
      const result = await window.api.markMoveMods(entries, markDestFolder);
      if (!result?.success || !Array.isArray(result.results)) {
        setToast({
          type: "error",
          message: t("mods.marked.moveFailed", {
            error: result?.error || t("common.errors.unknown"),
          }),
        });
        return;
      }
      const ok = result.results.filter((r) => r.success).length;
      const failedResults = result.results.filter((r) => !r.success);
      const fail = failedResults.length;
      if (ok > 0) {
        const movedEntries = result.results.filter((r) => r.success);
        const next = {
          ...readMarkedMods(),
        };
        for (const move of movedEntries) {
          const storedKey =
            move.markKey && next[move.markKey]
              ? move.markKey
              : next[move.src]
                ? move.src
                : Object.entries(next).find(
                    ([, item]) =>
                      item?.name === move.name &&
                      item?.characterName === move.characterName &&
                      (!item?.gameId ||
                        !move.gameId ||
                        item.gameId === move.gameId),
                  )?.[0];
          const marked = storedKey ? next[storedKey] : move;
          if (marked?.characterName && marked?.name) {
            await window.api.devUnmarkMod?.(
              marked.gameId || move.gameId || activeGameId,
              marked.characterName,
              marked.name,
            );
          }
          if (storedKey) {
            delete next[storedKey];
          }
        }
        writeMarkedMods(next);
        setMarkedMods(next);
        setMarkMoveRecord({
          moves: result.results.filter((r) => r.success),
        });
        await loadMods();
      }
      const failDetail = failedResults
        .slice(0, 3)
        .map(
          (r) =>
            `${r.name || t("mods.marked.unknownMod")}：${r.error || t("common.errors.unknown")}`,
        )
        .join("；");
      setToast({
        type: fail > 0 ? "error" : "success",
        message: t("mods.marked.moveSummary", {
          ok,
          status:
            fail > 0
              ? t("mods.marked.failureSummary", {
                  fail,
                  failDetail,
                  status: fail > 3 ? "；..." : "",
                })
              : "",
        }),
      });
    } finally {
      setMarkMoving(false);
    }
  }
  async function handleRestoreMarkedMods() {
    if (!markMoveRecord?.moves?.length) {
      setToast({
        type: "error",
        message: t("mods.marked.noMoveHistory"),
      });
      return;
    }
    setMarkMoving(true);
    try {
      const result = await window.api.markRestoreMods(markMoveRecord.moves);
      if (!result?.success || !Array.isArray(result.results)) {
        setToast({
          type: "error",
          message: t("mods.marked.moveBackFailed", {
            error: result?.error || t("common.errors.unknown"),
          }),
        });
        return;
      }
      const ok = result.results.filter((r) => r.success).length;
      const failedResults = result.results.filter((r) => !r.success);
      const fail = failedResults.length;
      if (ok > 0) {
        setMarkMoveRecord(null);
        await loadMods();
      }
      const failDetail = failedResults
        .slice(0, 3)
        .map(
          (r) =>
            `${r.name || t("mods.marked.unknownMod")}：${r.error || t("common.errors.unknown")}`,
        )
        .join("；");
      setToast({
        type: fail > 0 ? "error" : "success",
        message: t("mods.marked.moveBackSummary", {
          ok,
          status:
            fail > 0
              ? t("mods.marked.failureSummary", {
                  fail,
                  failDetail,
                  status: fail > 3 ? "；..." : "",
                })
              : "",
        }),
      });
    } finally {
      setMarkMoving(false);
    }
  }
  async function handleClearAllMarks() {
    const entries = Object.values(readMarkedMods());
    for (const entry of entries) {
      if (entry?.characterName && entry?.name) {
        await window.api.devUnmarkMod?.(
          entry.gameId || activeGameId,
          entry.characterName,
          entry.name,
        );
      }
    }
    writeMarkedMods({});
    setMarkedMods({});
    setToast({
      type: "success",
      message: t("mods.marked.cleared"),
    });
  }
  return {
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
    handleClearAllMarks,
  };
}
