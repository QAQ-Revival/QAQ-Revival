import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
import { aiSuggestionCache } from "../model/modHelpers.js";
export function useModNaming({
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
  loadMods,
}) {
  const [isRenamingMod, setIsRenamingMod] = React.useState(false);
  const [renameModDraft, setRenameModDraft] = React.useState("");
  const [renameModSaving, setRenameModSaving] = React.useState(false);
  const [aiNameLoading, setAiNameLoading] = React.useState(false);
  const [aiNameResult, setAiNameResult] = React.useState(null);
  const [showAiNameModal, setShowAiNameModal] = React.useState(false);
  const [aiNameTaskTarget, setAiNameTaskTarget] = React.useState(null);
  const [aiNameTaskResult, setAiNameTaskResult] = React.useState(null);
  const [aiNameTaskError, setAiNameTaskError] = React.useState("");
  const [aiNameModalMinimized, setAiNameModalMinimized] = React.useState(false);
  const [aiNameStage, setAiNameStage] = React.useState("");
  const [aiNameElapsedSeconds, setAiNameElapsedSeconds] = React.useState(0);
  React.useEffect(() => {
    if (!aiNameLoading) return void 0;
    const startedAt = Date.now();
    setAiNameElapsedSeconds(0);
    const timer = setInterval(() => {
      setAiNameElapsedSeconds(Math.floor((Date.now() - startedAt) / 1e3));
    }, 1e3);
    return () => clearInterval(timer);
  }, [aiNameLoading]);
  function minimizeAiNameModal() {
    setAiNameModalMinimized(true);
  }
  function expandAiNameModal() {
    if (aiNameTaskTarget?.path) {
      const targetMod = mods.find(
        (mod) =>
          mod.path === aiNameTaskTarget.path ||
          mod.name === aiNameTaskTarget.modName,
      );
      if (targetMod) setSelectedMod(targetMod);
    }
    setShowAiNameModal(true);
    setAiNameModalMinimized(false);
  }
  function closeAiNameTask() {
    setShowAiNameModal(false);
    setAiNameModalMinimized(false);
    if (!aiNameLoading) {
      setAiNameTaskTarget(null);
      setAiNameTaskResult(null);
      setAiNameTaskError("");
    }
  }
  async function handleAiSuggestName() {
    if (!selectedMod?.path) return;
    const taskTarget = {
      characterName,
      modName: selectedMod.name,
      path: selectedMod.path,
      gameId: activeGameId || "unknown",
    };
    setAiNameTaskTarget(taskTarget);
    setAiNameTaskResult(null);
    setAiNameTaskError("");
    setAiNameLoading(true);
    setShowAiNameModal(true);
    setAiNameModalMinimized(false);
    setAiNameStage(t("mods.ai.readingMod"));
    try {
      const details = await window.api.getModDetails(
        taskTarget.characterName,
        taskTarget.modName,
      );
      const previewUrl = details?.previewUrl || null;
      setAiNameStage(t("mods.ai.preparingTags"));
      const latestTags =
        serverTags.length > 0
          ? serverTags
          : await reloadServerTags({
              force: true,
              timeoutMs: 8e3,
            });
      const tagPoolNames = latestTags.map((t) => t.name).filter(Boolean);
      if (tagPoolNames.length === 0)
        throw new Error(t("mods.ai.tagPoolUnavailable"));
      const allTagNames = tagPoolNames.join("、");
      const promptText = `这是一个游戏mod。
当前文件夹名："${taskTarget.modName}"，角色为"${taskTarget.characterName}"
当前tag池：${allTagNames || "(空)"}

请完成以下任务，只返回JSON，不要其他内容：
1. 按三种命名风格各给1-2个名称建议，格式为"角色-mod描述"
   - artistic（意境风）：有意境感的名称，如"余烬-暗夜假日"
   - label（标签风）：直接描述外观特征，如"余烬-黑色蕾丝比基尼"
   - structural（结构风）：描述服装部件组合，如"余烬-蕾丝比基尼配薄纱罩裙"
2. 推荐5-8个tag（中文），必须全部从当前tag池中精确选择已有tag，禁止创造、改写、翻译或返回tag池中不存在的tag；如果tag池为空或没有合适tag，返回[]

返回格式：
{
  "names": {
    "artistic":    [{"character":"${taskTarget.characterName}","modName":"暗夜假日"}],
    "label":       [{"character":"${taskTarget.characterName}","modName":"黑色蕾丝比基尼"}],
    "structural":  [{"character":"${taskTarget.characterName}","modName":"蕾丝比基尼配薄纱罩裙"}]
  },
  "tags": ["tag1","tag2","tag3"]
}`;
      const content = previewUrl
        ? [
            {
              type: "text",
              text: promptText,
            },
            {
              type: "image_url",
              image_url: {
                url: previewUrl,
              },
            },
          ]
        : promptText;
      const messages = [
        {
          role: "user",
          content,
        },
      ];
      setAiNameStage(
        previewUrl
          ? t("mods.ai.analyzingImageAndName")
          : t("mods.ai.analyzingName"),
      );
      const res = await window.api.devAiSuggest({
        messages,
        max_tokens: 700,
        response_format: {
          type: "json_object",
        },
        temperature: 0.2,
      });
      if (!res.success) throw new Error(res.error);
      const text = res.content || "{}";
      const match = text.match(/\{[\s\S]*\}/);
      let groups = [],
        suggestedTags = [];
      if (match) {
        try {
          const parsed = JSON.parse(match[0]);
          const styleLabels = {
            artistic: t("mods.ai.styles.artistic"),
            label: t("mods.ai.styles.label"),
            structural: t("mods.ai.styles.structural"),
          };
          groups = Object.entries(parsed.names || {})
            .map(([style, items]) => ({
              style,
              label: styleLabels[style] || style,
              items: (items || []).map((s) => ({
                character: s.character || "",
                modName: s.modName || "",
                fullName: s.character
                  ? `${s.character}-${s.modName}`
                  : s.modName,
              })),
            }))
            .filter((g) => g.items.length > 0);
          suggestedTags = parsed.tags || [];
        } catch {}
      }
      if (groups.length === 0)
        throw new Error(t("mods.ai.invalidNameResponse"));
      const serverTagNames = new Set(tagPoolNames);
      const rawTags = Array.isArray(suggestedTags)
        ? suggestedTags.map((t) => String(t || "").trim()).filter(Boolean)
        : [];
      const poolTags = [
        ...new Set(
          (Array.isArray(suggestedTags) ? suggestedTags : [])
            .map((t) => String(t || "").trim())
            .filter((t) => serverTagNames.has(t)),
        ),
      ];
      const newTags = [];
      if (poolTags.length === 0) {
        const reason =
          serverTagNames.size === 0
            ? t("mods.ai.noTagPool")
            : rawTags.length === 0
              ? t("mods.ai.noTagsInResponse")
              : t("mods.ai.noMatchingTags");
        setToast({
          type: "error",
          message: reason,
        });
      }
      const result = {
        groups,
        tags: poolTags,
        allTags: poolTags,
        newTags,
      };
      setAiNameTaskResult(result);
      if (selectedModPathRef.current === taskTarget.path)
        setAiNameResult(result);
      aiSuggestionCache.set(taskTarget.path, result);
      try {
        await window.api.devSaveAiSuggestCache({
          modPath: taskTarget.path,
          result,
        });
      } catch {}
      try {
        await window.api.devSaveAiTags({
          modName: taskTarget.modName,
          characterName: taskTarget.characterName,
          gameId: taskTarget.gameId,
          allTags: poolTags,
          poolTags,
          newTags,
          timestamp: new Date().toISOString(),
        });
      } catch {}
    } catch (e) {
      setAiNameTaskError(e.message);
      setToast({
        type: "error",
        message: t("mods.ai.nameRequestFailed", {
          message: e.message,
        }),
      });
      setAiNameModalMinimized(true);
    } finally {
      setAiNameStage("");
      setAiNameLoading(false);
    }
  }
  async function handleSaveModRename() {
    return handleRenameMod(selectedMod, renameModDraft);
  }
  async function handleRenameMod(mod, draft) {
    if (!mod || renameModSaving) return false;
    const nextName = draft.trim();
    if (!nextName) {
      setToast({
        type: "error",
        message: t("common.errors.nameRequired"),
      });
      return false;
    }
    if (nextName === mod.name) {
      setIsRenamingMod(false);
      return true;
    }
    setRenameModSaving(true);
    try {
      const result = await window.api.renameMod(
        characterName,
        mod.name,
        nextName,
      );
      if (result?.error) {
        setToast({
          type: "error",
          message: t("mods.errors.renameWithReason", {
            error: result.error,
          }),
        });
        return false;
      }
      pendingFocusRef.current = {
        characterName,
        modName: nextName,
        scrollTop: modsListRef.current?.scrollTop || 0,
        targetLoadVersion: modsLoadVersion + 1,
      };
      setToast({
        type: "success",
        message: t("mods.status.renamed", {
          nextName,
        }),
      });
      setIsRenamingMod(false);
      await loadMods();
      return true;
    } catch (e) {
      setToast({
        type: "error",
        message: t("mods.errors.renameException", {
          message: e?.message || String(e),
        }),
      });
      return false;
    } finally {
      setRenameModSaving(false);
    }
  }
  async function applyAiName(newName, target = null) {
    const targetMod = target?.path
      ? mods.find((mod) => mod.path === target.path) || {
          name: target.modName,
          path: target.path,
        }
      : selectedMod;
    const targetCharacterName = target?.characterName || characterName;
    if (!targetMod || !newName) return;
    try {
      const result = await window.api.renameMod(
        targetCharacterName,
        targetMod.name,
        newName,
      );
      if (result.error) {
        setToast({
          type: "error",
          message: t("common.errors.renameWithReason", {
            error: result.error,
          }),
        });
        return;
      }
      const oldPath = targetMod.path;
      const cached = aiSuggestionCache.get(oldPath);
      if (cached && result.newPath) {
        aiSuggestionCache.set(result.newPath, cached);
      }
      aiSuggestionCache.delete(oldPath);
      pendingFocusRef.current = {
        characterName: targetCharacterName,
        modName: newName,
        scrollTop: modsListRef.current?.scrollTop || 0,
        targetLoadVersion: modsLoadVersion + 1,
      };
      setToast({
        type: "success",
        message: t("mods.status.renamedMod", {
          newName,
        }),
      });
      setAiNameTaskTarget(null);
      setAiNameTaskResult(null);
      setAiNameTaskError("");
      setShowAiNameModal(false);
      setAiNameModalMinimized(false);
      loadMods();
    } catch (e) {
      setToast({
        type: "error",
        message: t("mods.errors.renameMessage", {
          message: e.message,
        }),
      });
    }
  }
  return {
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
    applyAiName,
  };
}
