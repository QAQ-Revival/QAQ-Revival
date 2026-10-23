import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
import { fetchWithDirectFallback } from "../../../lib/marketApi.js";
export function useModTags({
  devMode,
  selectedMod,
  activeGameId,
  setToast,
  characterName,
  mods,
}) {
  const [modTags, setModTags] = React.useState([]);
  const [tagInput, setTagInput] = React.useState("");
  const [serverTags, setServerTags] = React.useState([]);
  const [tagSaving, setTagSaving] = React.useState(false);
  const [showTagSuggestions, setShowTagSuggestions] = React.useState(false);
  const [aiTagLoading, setAiTagLoading] = React.useState(false);
  const [aiTagSuggestions, setAiTagSuggestions] = React.useState([]);
  const [showAiTagModal, setShowAiTagModal] = React.useState(false);
  const [aiTagStage, setAiTagStage] = React.useState("");
  const [aiTagElapsedSeconds, setAiTagElapsedSeconds] = React.useState(0);
  const [aiTagEmptyReason, setAiTagEmptyReason] = React.useState("");
  const [showTagManagerModal, setShowTagManagerModal] = React.useState(false);
  const [tagManagerAdminKey, setTagManagerAdminKey] = React.useState(
    () => localStorage.getItem("qaqm-dev-admin-key") || "",
  );
  const [newTagName, setNewTagName] = React.useState("");
  const [newTagColor, setNewTagColor] = React.useState("#6366f1");
  const [tagManagerLoading, setTagManagerLoading] = React.useState(false);
  const [editingTagId, setEditingTagId] = React.useState(null);
  const [editingTagName, setEditingTagName] = React.useState("");
  const [editingTagColor, setEditingTagColor] = React.useState("");
  const serverTagsLastFetchRef = React.useRef(0);
  React.useEffect(() => {
    if (!devMode) return;
    async function loadServerTags() {
      try {
        const cfg = await window.api.getConfig();
        const serverUrl = cfg?.config?.serverUrl || "https://qaqm.top";
        const { response: res } = await fetchWithDirectFallback(
          serverUrl,
          "/api/tags",
          {
            expectJson: true,
            timeoutMs: 4e3,
          },
        );
        if (!res.ok) throw new Error(`Tag API HTTP ${res.status}`);
        const data = await res.json();
        if (Array.isArray(data)) setServerTags(data);
        else if (data.tags) setServerTags(data.tags);
        serverTagsLastFetchRef.current = Date.now();
      } catch (e) {
        console.error("Failed to load server tags:", e);
      }
    }
    loadServerTags();
  }, [devMode]);
  React.useEffect(() => {
    if (!devMode || !selectedMod?.path) {
      setModTags([]);
      return;
    }
    window.api.devGetModTags(selectedMod.path).then((r) => {
      const raw = r?.tags || [];
      setModTags(
        raw
          .map((t) => (typeof t === "string" ? t : t?.name || ""))
          .filter(Boolean),
      );
    });
  }, [devMode, selectedMod?.path]);
  async function saveModTags(tags) {
    if (!selectedMod?.path) return;
    const normalizedTags = tags
      .map((t) => (typeof t === "string" ? t : t?.name || ""))
      .filter(Boolean);
    setTagSaving(true);
    try {
      await window.api.devSetModTags(selectedMod.path, normalizedTags);
      setModTags(normalizedTags);
      const cfg = await window.api.getConfig();
      const serverUrl = cfg?.config?.serverUrl || "https://qaqm.top";
      const modFolderName = selectedMod.name;
      for (const tagName of normalizedTags) {
        if (!serverTags.find((t) => t.id === tagName || t.name === tagName)) {
          try {
            const r = await fetch(`${serverUrl}/api/tags`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-admin-key": tagManagerAdminKey,
              },
              body: JSON.stringify({
                name: tagName,
              }),
            });
            const newTag = await r.json();
            if (newTag?.id) setServerTags((prev) => [...prev, newTag]);
          } catch {}
        }
      }
      const modsRes = await fetch(
        `${serverUrl}/api/mods?gameId=${activeGameId || "endfield"}`,
      );
      const modsData = await modsRes.json();
      const allMods = modsData.mods || modsData.data || [];
      const serverMod = allMods.find((m) => m.name === modFolderName);
      if (serverMod) {
        await fetch(`${serverUrl}/api/games/tags/mod/${serverMod.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tagIds: normalizedTags,
          }),
        });
      }
      setToast({
        type: "success",
        message: t("mods.tags.saved", {
          status: serverMod
            ? t("mods.tags.savedToServerSuffix")
            : t("mods.tags.savedLocallySuffix"),
        }),
      });
    } catch (e) {
      setToast({
        type: "error",
        message: t("mods.tags.saveFailed", {
          message: e.message,
        }),
      });
    } finally {
      setTagSaving(false);
    }
  }
  function addTagFromInput() {
    const t = tagInput.trim();
    if (!t || modTags.includes(t)) {
      setTagInput("");
      return;
    }
    setModTags((prev) => [...prev, t]);
    setTagInput("");
    setShowTagSuggestions(false);
  }
  async function handleAiSuggestTags() {
    if (!selectedMod?.path) return;
    setAiTagLoading(true);
    setShowAiTagModal(true);
    setAiTagSuggestions([]);
    setAiTagEmptyReason("");
    setAiTagStage(t("mods.ai.readingMod"));
    try {
      const details = await window.api.getModDetails(
        characterName,
        selectedMod.name,
      );
      const previewUrl = details?.previewUrl || null;
      setAiTagStage(t("mods.ai.preparingTags"));
      const latestTags =
        serverTags.length > 0
          ? serverTags
          : await reloadServerTags({
              force: true,
              timeoutMs: 8e3,
            });
      const tagPool = new Set(latestTags.map((t) => t.name).filter(Boolean));
      if (tagPool.size === 0) throw new Error(t("mods.ai.tagPoolUnavailable"));
      const allTagNames = [...tagPool].join(", ");
      const messages = [
        {
          role: "user",
          content: previewUrl
            ? [
                {
                  type: "text",
                  text: `这是一个游戏mod，名称为"${selectedMod.name}"，角色为"${characterName}"。当前tag池：${allTagNames || "(空)"}。请根据mod名称和图片，推荐5-8个合适的tag（中文）。必须只从当前tag池中精确选择已有tag，禁止创造、改写、翻译或返回tag池中不存在的tag；如果tag池为空或没有合适tag，返回[]。只返回JSON数组，格式：["tag1","tag2",...]`,
                },
                {
                  type: "image_url",
                  image_url: {
                    url: previewUrl,
                  },
                },
              ]
            : [
                {
                  type: "text",
                  text: `这是一个游戏mod，名称为"${selectedMod.name}"，角色为"${characterName}"。当前tag池：${allTagNames || "(空)"}。请推荐5-8个合适的tag（中文）。必须只从当前tag池中精确选择已有tag，禁止创造、改写、翻译或返回tag池中不存在的tag；如果tag池为空或没有合适tag，返回[]。只返回JSON数组，格式：["tag1","tag2",...]`,
                },
              ],
        },
      ];
      setAiTagStage(
        previewUrl
          ? t("mods.ai.analyzingImageTags")
          : t("mods.ai.analyzingNameTags"),
      );
      const res = await window.api.devAiSuggest({
        messages,
        max_tokens: 300,
        temperature: 0.2,
      });
      if (!res.success) throw new Error(res.error);
      const text = res.content || "[]";
      const match = text.match(/\[[\s\S]*\]/);
      const parsed = match ? JSON.parse(match[0]) : [];
      const rawTags = Array.isArray(parsed)
        ? parsed.map((name) => String(name || "").trim()).filter(Boolean)
        : [];
      const suggested = [
        ...new Set(
          (Array.isArray(parsed) ? parsed : [])
            .map((name) => String(name || "").trim())
            .filter((name) => tagPool.has(name)),
        ),
      ];
      if (suggested.length === 0) {
        const reason =
          tagPool.size === 0
            ? t("mods.ai.noTagPool")
            : rawTags.length === 0
              ? t("mods.ai.emptyTagResponse")
              : t("mods.ai.unmatchedTagResponse");
        setAiTagEmptyReason(reason);
        setToast({
          type: "error",
          message: reason,
        });
      }
      setAiTagSuggestions(
        suggested.map((name) => ({
          name,
          isNew: false,
          selected: !modTags.includes(name),
        })),
      );
    } catch (e) {
      const reason = t("mods.ai.tagRequestFailed", {
        message: e?.message || String(e),
      });
      setAiTagEmptyReason(reason);
      setToast({
        type: "error",
        message: t("mods.ai.recommendException", {
          message: e.message,
        }),
      });
    } finally {
      setAiTagStage("");
      setAiTagLoading(false);
    }
  }
  function applyAiSuggestions() {
    const toAdd = aiTagSuggestions.filter((s) => s.selected).map((s) => s.name);
    const merged = [...new Set([...modTags, ...toAdd])];
    setModTags(merged);
    setShowAiTagModal(false);
    setAiTagSuggestions([]);
  }
  async function applyAiTags(tags, target = null) {
    const targetMod = target?.path
      ? mods.find((mod) => mod.path === target.path) || {
          path: target.path,
        }
      : selectedMod;
    if (!tags?.length || !targetMod?.path) return;
    const serverTagNames = new Set(
      serverTags.map((t) => t.name).filter(Boolean),
    );
    const validTags = [
      ...new Set(
        tags
          .map((t) => String(t || "").trim())
          .filter((t) => serverTagNames.has(t)),
      ),
    ];
    if (validTags.length === 0) {
      setToast({
        type: "error",
        message: t("mods.ai.noValidPoolTags"),
      });
      return;
    }
    try {
      let baseTags = modTags;
      if (target?.path && target.path !== selectedMod?.path) {
        const r = await window.api.devGetModTags(targetMod.path);
        const raw = r?.tags || [];
        baseTags = raw
          .map((t) => (typeof t === "string" ? t : t?.name || ""))
          .filter(Boolean);
      }
      const merged = [...new Set([...baseTags, ...validTags])];
      await window.api.devSetModTags(targetMod.path, merged);
      if (!target?.path || target.path === selectedMod?.path)
        setModTags(merged);
      setToast({
        type: "success",
        message: t("mods.tags.recommendedSaved", {
          validTagsCount: validTags.length,
        }),
      });
    } catch (e) {
      setToast({
        type: "error",
        message: t("mods.tags.saveException", {
          message: e.message,
        }),
      });
    }
  }
  async function getServerUrlAndKey() {
    const cfg = await window.api.getConfig();
    const serverUrl = cfg?.config?.serverUrl || "https://qaqm.top";
    return {
      serverUrl,
      adminKey: tagManagerAdminKey,
    };
  }
  async function reloadServerTags({ force = false, timeoutMs = 8e3 } = {}) {
    const now = Date.now();
    if (!force && now - serverTagsLastFetchRef.current < 3e4) return serverTags;
    try {
      const { serverUrl } = await getServerUrlAndKey();
      const { response: res } = await fetchWithDirectFallback(
        serverUrl,
        "/api/tags",
        {
          expectJson: true,
          timeoutMs,
        },
      );
      if (!res.ok) throw new Error(`Tag API HTTP ${res.status}`);
      const data = await res.json();
      const tags = Array.isArray(data) ? data : data.tags || [];
      setServerTags(tags);
      serverTagsLastFetchRef.current = Date.now();
      return tags;
    } catch {
      return serverTags;
    }
  }
  async function handleCreateTag() {
    const name = newTagName.trim();
    if (!name) return;
    setTagManagerLoading(true);
    try {
      const { serverUrl, adminKey } = await getServerUrlAndKey();
      const res = await fetch(`${serverUrl}/api/tags`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey,
        },
        body: JSON.stringify({
          name,
          color: newTagColor,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setToast({
          type: "error",
          message: err.error || t("common.errors.createFailed"),
        });
        return;
      }
      setNewTagName("");
      setNewTagColor("#6366f1");
      await reloadServerTags({
        force: true,
      });
    } catch (e) {
      setToast({
        type: "error",
        message: t("common.errors.createException", {
          message: e.message,
        }),
      });
    } finally {
      setTagManagerLoading(false);
    }
  }
  async function handleUpdateTag(id) {
    setTagManagerLoading(true);
    try {
      const { serverUrl, adminKey } = await getServerUrlAndKey();
      const res = await fetch(
        `${serverUrl}/api/tags/${encodeURIComponent(id)}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-admin-key": adminKey,
          },
          body: JSON.stringify({
            name: editingTagName,
            color: editingTagColor,
          }),
        },
      );
      if (!res.ok) {
        const err = await res.json();
        setToast({
          type: "error",
          message: err.error || t("common.errors.updateFailed"),
        });
        return;
      }
      setEditingTagId(null);
      await reloadServerTags({
        force: true,
      });
    } catch (e) {
      setToast({
        type: "error",
        message: t("common.errors.updateException", {
          message: e.message,
        }),
      });
    } finally {
      setTagManagerLoading(false);
    }
  }
  async function handleDeleteTag(id) {
    setTagManagerLoading(true);
    try {
      const { serverUrl, adminKey } = await getServerUrlAndKey();
      const res = await fetch(
        `${serverUrl}/api/tags/${encodeURIComponent(id)}`,
        {
          method: "DELETE",
          headers: {
            "x-admin-key": adminKey,
          },
        },
      );
      if (!res.ok) {
        const err = await res.json();
        setToast({
          type: "error",
          message: err.error || t("common.errors.deleteFailed"),
        });
        return;
      }
      await reloadServerTags({
        force: true,
      });
    } catch (e) {
      setToast({
        type: "error",
        message: t("common.errors.deleteMessage", {
          message: e.message,
        }),
      });
    } finally {
      setTagManagerLoading(false);
    }
  }
  return {
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
    handleDeleteTag,
  };
}
