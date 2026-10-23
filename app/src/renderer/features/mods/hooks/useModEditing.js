import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
export function useModEditing({
  selectedMod,
  setToast,
  setSelectedMod,
  setMods,
  characterName,
  loadModDetails,
}) {
  const [editingHotkey, setEditingHotkey] = React.useState(null);
  const [capturedKey, setCapturedKey] = React.useState("");
  const [isEditingNotes, setIsEditingNotes] = React.useState(false);
  const [notesDraft, setNotesDraft] = React.useState("");
  const [notesSaving, setNotesSaving] = React.useState(false);
  const [editingAliasSection, setEditingAliasSection] = React.useState(null);
  const [aliasDraft, setAliasDraft] = React.useState("");
  const [aliasSaving, setAliasSaving] = React.useState(false);
  async function handleSaveModNotes() {
    if (!selectedMod) return;
    setNotesSaving(true);
    try {
      const result = await window.api.setModMeta(selectedMod.path, {
        notes: notesDraft,
      });
      if (!result?.success) {
        setToast({
          type: "error",
          message: t("mods.notes.saveFailed", {
            error: result?.error || t("common.errors.unknown"),
          }),
        });
        return;
      }
      setSelectedMod((prev) =>
        prev
          ? {
              ...prev,
              notes: notesDraft,
            }
          : prev,
      );
      setMods((prev) =>
        prev.map((m) =>
          m.path === selectedMod.path
            ? {
                ...m,
                notes: notesDraft,
              }
            : m,
        ),
      );
      setIsEditingNotes(false);
      setToast({
        type: "success",
        message: notesDraft ? t("mods.notes.saved") : t("mods.notes.cleared"),
      });
    } catch (e) {
      setToast({
        type: "error",
        message: t("mods.notes.saveException", {
          message: e?.message || String(e),
        }),
      });
    } finally {
      setNotesSaving(false);
    }
  }
  async function handleSaveHotkeyAlias(section) {
    if (!selectedMod || !section) return;
    setAliasSaving(true);
    try {
      const trimmed = (aliasDraft || "").trim();
      const patch = {
        [section]: trimmed,
      };
      const result = await window.api.setModMeta(selectedMod.path, {
        hotkeyAliases: patch,
      });
      if (!result?.success) {
        setToast({
          type: "error",
          message: t("mods.hotkeys.saveNameFailed", {
            error: result?.error || t("common.errors.unknown"),
          }),
        });
        return;
      }
      const mergeAliases = (prev) => {
        const current =
          prev && typeof prev.hotkeyAliases === "object" && prev.hotkeyAliases
            ? prev.hotkeyAliases
            : {};
        const next = {
          ...current,
        };
        if (trimmed) next[section] = trimmed;
        else delete next[section];
        return {
          ...prev,
          hotkeyAliases: next,
        };
      };
      setSelectedMod((prev) => (prev ? mergeAliases(prev) : prev));
      setMods((prev) =>
        prev.map((m) => (m.path === selectedMod.path ? mergeAliases(m) : m)),
      );
      setEditingAliasSection(null);
      setAliasDraft("");
      setToast({
        type: "success",
        message: trimmed
          ? t("mods.hotkeys.nameSaved")
          : t("mods.hotkeys.defaultNameRestored"),
      });
    } catch (e) {
      setToast({
        type: "error",
        message: t("mods.hotkeys.saveNameException", {
          message: e?.message || String(e),
        }),
      });
    } finally {
      setAliasSaving(false);
    }
  }
  function startHotkeyEdit(index, hk, relativePath) {
    setEditingHotkey({
      index,
      section: hk.section,
      relativePath,
      currentKey: hk.keys.join(" + "),
    });
    setCapturedKey("");
  }
  function handleKeyCapture(e) {
    e.preventDefault();
    e.stopPropagation();
    let parts = [];
    if (e.ctrlKey) parts.push("ctrl");
    if (e.altKey) parts.push("alt");
    if (e.shiftKey) parts.push("shift");
    const key = e.key.toUpperCase();
    if (key !== "CONTROL" && key !== "ALT" && key !== "SHIFT") {
      if (key.length === 1) {
        parts.push(key);
      } else {
        const keyMap = {
          F1: "F1",
          F2: "F2",
          F3: "F3",
          F4: "F4",
          F5: "F5",
          F6: "F6",
          F7: "F7",
          F8: "F8",
          F9: "F9",
          F10: "F10",
          F11: "F11",
          F12: "F12",
          ESCAPE: "Esc",
          ENTER: "Enter",
          TAB: "Tab",
          BACKSPACE: "Backspace",
          DELETE: "Delete",
          ARROWUP: "Up",
          ARROWDOWN: "Down",
          ARROWLEFT: "Left",
          ARROWRIGHT: "Right",
          HOME: "Home",
          END: "End",
          PAGEUP: "PageUp",
          PAGEDOWN: "PageDown",
          INSERT: "Insert",
          SPACE: "Space",
          " ": "Space",
        };
        parts.push(keyMap[key] || key);
      }
    }
    if (parts.length > 0) {
      setCapturedKey(parts.join(" + "));
    }
  }
  async function saveHotkeyEdit() {
    if (!editingHotkey || !capturedKey) return;
    const formattedKey = capturedKey.replace(/\s*\+\s*/g, " ");
    const result = await window.api.saveHotkey(
      characterName,
      selectedMod.name,
      editingHotkey.section,
      formattedKey,
      editingHotkey.relativePath,
    );
    if (result.success) {
      setToast({
        type: "success",
        message: t("mods.hotkeys.saved"),
      });
      loadModDetails(selectedMod.name, true);
    } else {
      setToast({
        type: "error",
        message: t("common.errors.saveWithReason", {
          error: result.error,
        }),
      });
    }
    setEditingHotkey(null);
    setCapturedKey("");
  }
  function cancelHotkeyEdit() {
    setEditingHotkey(null);
    setCapturedKey("");
  }
  return {
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
    cancelHotkeyEdit,
  };
}
