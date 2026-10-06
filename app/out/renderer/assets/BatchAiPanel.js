import { r as reactExports, R as ReactDOM, j as jsxRuntimeExports } from "./index.js";
const _batchAiDone = /* @__PURE__ */ new Set();
function BatchAiPanel({ gameId, imageOnly = false, onClose }) {
  const [charList, setCharList] = reactExports.useState([]);
  const [selectedChars, setSelectedChars] = reactExports.useState(/* @__PURE__ */ new Set());
  const [selectAll, setSelectAll] = reactExports.useState(true);
  const [modList, setModList] = reactExports.useState([]);
  const [loadingMods, setLoadingMods] = reactExports.useState(false);
  const [running, setRunning] = reactExports.useState(false);
  const [paused, setPaused] = reactExports.useState(false);
  const [collapsed, setCollapsed] = reactExports.useState(false);
  const [progress, setProgress] = reactExports.useState({ current: 0, total: 0, currentMod: "" });
  const [results, setResults] = reactExports.useState([]);
  const [serverTags, setServerTags] = reactExports.useState([]);
  const pausedRef = reactExports.useRef(false);
  const cancelRef = reactExports.useRef(false);
  const logEndRef = reactExports.useRef(null);
  reactExports.useEffect(() => {
    loadCharacters();
    loadServerTags();
  }, []);
  reactExports.useEffect(() => {
    if (!running && charList.length > 0) loadMods();
  }, [selectAll, selectedChars, charList]);
  reactExports.useEffect(() => {
    if (logEndRef.current && !collapsed) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [results, collapsed]);
  async function loadCharacters() {
    try {
      const r = await window.api.getCharacters();
      if (r?.success && Array.isArray(r.characters)) {
        setCharList(r.characters.map((c) => c.name || c).filter(Boolean).sort());
      }
    } catch {
    }
  }
  async function loadServerTags() {
    try {
      const cfg = await window.api.getConfig();
      const url = (cfg?.config?.serverUrl || "https://qaqm.top").replace(/\/$/, "");
      const res = await fetch(`${url}/api/tags`);
      if (res.ok) {
        const data = await res.json();
        const tags = Array.isArray(data) ? data : data.tags || [];
        setServerTags(tags);
        return tags;
      }
    } catch {
    }
    return serverTags;
  }
  async function loadMods() {
    setLoadingMods(true);
    try {
      const chars = selectAll ? charList : [...selectedChars];
      const targetChars = chars.length > 0 ? chars : charList;
      const allMods = [];
      for (const char of targetChars) {
        try {
          const r = await window.api.getMods(char);
          const modArr = r?.mods || (Array.isArray(r) ? r : []);
          if (modArr.length > 0) {
            for (const mod of modArr) {
              let done = _batchAiDone.has(mod.path);
              if (!done) {
                try {
                  const tagResult = await window.api.devGetModTags(mod.path);
                  const tags = tagResult?.tags || [];
                  done = tags.length > 0;
                } catch {
                }
              }
              allMods.push({ char, name: mod.name, path: mod.path, hasCache: done });
            }
          }
        } catch {
        }
      }
      setModList(allMods);
    } catch {
    }
    setLoadingMods(false);
  }
  function handleSelectAll() {
    setSelectAll(true);
    setSelectedChars(/* @__PURE__ */ new Set());
  }
  function toggleChar(name) {
    setSelectedChars((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
    setSelectAll(false);
  }
  async function runBatchAi() {
    const toProcess = modList.filter((m) => !m.hasCache);
    if (toProcess.length === 0) return;
    setRunning(true);
    setPaused(false);
    pausedRef.current = false;
    cancelRef.current = false;
    setResults([]);
    setProgress({ current: 0, total: toProcess.length, currentMod: "" });
    setCollapsed(false);
    const latestTags = serverTags.length > 0 ? serverTags : await loadServerTags();
    const serverTagNames = new Set(latestTags.map((t) => t.name).filter(Boolean));
    const allTagNames = [...serverTagNames].join("、");
    for (let i = 0; i < toProcess.length; i++) {
      if (cancelRef.current) {
        setResults((prev) => [...prev, { mod: "---", char: "", status: "skip", message: "cancelled" }]);
        break;
      }
      while (pausedRef.current) {
        await new Promise((r) => setTimeout(r, 300));
        if (cancelRef.current) break;
      }
      if (cancelRef.current) break;
      const mod = toProcess[i];
      setProgress({ current: i + 1, total: toProcess.length, currentMod: `[${mod.char}] ${mod.name}` });
      try {
        const details = await window.api.getModDetails(mod.char, mod.name);
        const previewUrl = details?.previewUrl || null;
        if (imageOnly && !previewUrl) {
          setResults((prev) => [...prev, {
            mod: mod.name,
            char: mod.char,
            status: "skip",
            message: "无预览图，跳过"
          }]);
          continue;
        }
        const promptText = `这是一个游戏mod。
当前文件夹名："${mod.name}"，角色为"${mod.char}"
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
    "artistic":    [{"character":"${mod.char}","modName":"暗夜假日"}],
    "label":       [{"character":"${mod.char}","modName":"黑色蕾丝比基尼"}],
    "structural":  [{"character":"${mod.char}","modName":"蕾丝比基尼配薄纱罩裙"}]
  },
  "tags": ["tag1","tag2","tag3"]
}`;
        const isSupportedImage = previewUrl && /^data:image\/(jpeg|png|gif);/.test(previewUrl);
        const contentWithImg = isSupportedImage ? [{ type: "text", text: promptText }, { type: "image_url", image_url: { url: previewUrl } }] : promptText;
        const messages = [{ role: "user", content: contentWithImg }];
        const aiRequestOptions = {
          max_tokens: 700,
          response_format: { type: "json_object" },
          temperature: 0.2
        };
        let res = await window.api.devAiSuggest({ messages, ...aiRequestOptions });
        if (!res.success && isSupportedImage && res.error && res.error.includes("400")) {
          const retryMessages = [{ role: "user", content: promptText }];
          res = await window.api.devAiSuggest({ messages: retryMessages, ...aiRequestOptions });
        }
        if (!res.success) throw new Error(res.error);
        const text = res.content || "{}";
        const match = text.match(/\{[\s\S]*\}/);
        let groups = [], suggestedTags = [];
        if (match) {
          try {
            const parsed = JSON.parse(match[0]);
            const styleLabels = { artistic: "意境风", label: "标签风", structural: "结构风" };
            groups = Object.entries(parsed.names || {}).map(([style, items]) => ({
              style,
              label: styleLabels[style] || style,
              items: (items || []).map((s) => ({
                character: s.character || "",
                modName: s.modName || "",
                fullName: s.character ? `${s.character}-${s.modName}` : s.modName
              }))
            })).filter((g) => g.items.length > 0);
            suggestedTags = parsed.tags || [];
          } catch {
          }
        }
        if (groups.length === 0) throw new Error("AI 未返回有效建议");
        const rawTags = Array.isArray(suggestedTags) ? suggestedTags.map((t) => String(t || "").trim()).filter(Boolean) : [];
        const poolTags = [...new Set((Array.isArray(suggestedTags) ? suggestedTags : []).map((t) => String(t || "").trim()).filter((t) => serverTagNames.has(t)))];
        const newTags = [];
        const tagDiagnostic = poolTags.length > 0 ? "" : serverTagNames.size === 0 ? " | Tag 池为空或未加载成功" : rawTags.length === 0 ? ` | AI 原始未返回 tag，Tag 池 ${serverTagNames.size} 个` : ` | 原始 tag ${rawTags.length} 个，匹配池内 0 个：${rawTags.slice(0, 5).join("、")}`;
        if (poolTags.length > 0) {
          try {
            const existingResult = await window.api.devGetModTags(mod.path);
            const existingTags = existingResult?.tags || [];
            const merged = [.../* @__PURE__ */ new Set([...existingTags, ...poolTags])];
            await window.api.devSetModTags(mod.path, merged);
          } catch {
          }
        }
        try {
          await window.api.devSaveAiSuggestCache({
            modPath: mod.path,
            result: { groups, tags: poolTags, allTags: poolTags, newTags }
          });
        } catch {
        }
        try {
          await window.api.devSaveAiTags({
            modName: mod.name,
            characterName: mod.char,
            gameId: gameId || "unknown",
            allTags: poolTags,
            poolTags,
            newTags,
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          });
        } catch {
        }
        _batchAiDone.add(mod.path);
        setModList((prev) => prev.map((m) => m.path === mod.path ? { ...m, hasCache: true } : m));
        const namePreview = groups[0]?.items[0]?.fullName || "";
        setResults((prev) => [...prev, {
          mod: mod.name,
          char: mod.char,
          status: "ok",
          message: `${namePreview} | tags: ${poolTags.join(",")}${tagDiagnostic}`
        }]);
        await new Promise((r) => setTimeout(r, 1e3));
      } catch (e) {
        setResults((prev) => [...prev, {
          mod: mod.name,
          char: mod.char,
          status: "error",
          message: e.message || String(e)
        }]);
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    setRunning(false);
  }
  function handlePause() {
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
  }
  function handleCancel() {
    cancelRef.current = true;
    pausedRef.current = false;
    setPaused(false);
  }
  const pendingCount = modList.filter((m) => !m.hasCache).length;
  const doneCount = results.filter((r) => r.status === "ok").length;
  const errorCount = results.filter((r) => r.status === "error").length;
  const pct = progress.total > 0 ? progress.current / progress.total * 100 : 0;
  if (collapsed && running) {
    return ReactDOM.createPortal(
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: {
        position: "fixed",
        bottom: "48px",
        right: "12px",
        zIndex: 10006,
        background: "#fff",
        borderRadius: "12px",
        width: "280px",
        boxShadow: "0 4px 24px rgba(0,0,0,0.18), 0 0 0 1px rgba(99,102,241,0.15)",
        overflow: "hidden",
        userSelect: "none"
      }, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { padding: "10px 14px", background: "linear-gradient(135deg, rgba(99,102,241,0.1), rgba(168,85,247,0.1))" }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { fontSize: "12px", color: "#374151", fontWeight: 600 }, children: [
            paused ? "⏸" : "▶",
            " AI ",
            progress.current,
            "/",
            progress.total
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", gap: "4px" }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "button",
              {
                onClick: handlePause,
                style: { padding: "2px 8px", fontSize: "10px", borderRadius: "4px", border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", color: "#6b7280" },
                children: paused ? "▶" : "⏸"
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "button",
              {
                onClick: handleCancel,
                style: { padding: "2px 8px", fontSize: "10px", borderRadius: "4px", border: "none", background: "#ef4444", color: "#fff", cursor: "pointer" },
                children: "✕"
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "button",
              {
                onClick: () => setCollapsed(false),
                style: { padding: "2px 8px", fontSize: "10px", borderRadius: "4px", border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", color: "#6b7280" },
                children: "展开"
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { height: "4px", borderRadius: "2px", background: "#e5e7eb", overflow: "hidden" }, children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { height: "100%", borderRadius: "2px", background: "linear-gradient(90deg, #6366f1, #a855f7)", width: `${pct}%`, transition: "width 0.3s" } }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontSize: "10px", color: "#9ca3af", marginTop: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: progress.currentMod }),
        errorCount > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { fontSize: "10px", color: "#ef4444", marginTop: "2px" }, children: [
          "失败: ",
          errorCount
        ] })
      ] }) }),
      document.body
    );
  }
  return ReactDOM.createPortal(
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "div",
      {
        style: { position: "fixed", inset: 0, zIndex: 10005, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" },
        onClick: !running ? onClose : void 0,
        children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "div",
          {
            style: { background: "#fff", borderRadius: "14px", maxWidth: "680px", width: "95vw", maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" },
            onClick: (e) => e.stopPropagation(),
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { padding: "16px 20px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between", background: "linear-gradient(135deg, rgba(99,102,241,0.08), rgba(168,85,247,0.08))" }, children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { fontWeight: 700, fontSize: "15px", color: "#1f2937" }, children: [
                    "AI 批量推荐",
                    imageOnly ? "（仅有图）" : ""
                  ] }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { fontSize: "12px", color: "#9ca3af", marginTop: "2px" }, children: [
                    "游戏: ",
                    gameId || "unknown",
                    " | 待处理: ",
                    pendingCount,
                    " 个 mod"
                  ] })
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", gap: "6px", alignItems: "center" }, children: [
                  running && /* @__PURE__ */ jsxRuntimeExports.jsx(
                    "button",
                    {
                      onClick: () => setCollapsed(true),
                      style: { background: "none", border: "1px solid #e5e7eb", borderRadius: "6px", cursor: "pointer", fontSize: "12px", padding: "3px 8px", color: "#6b7280" },
                      children: "▲ 后台运行"
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    "button",
                    {
                      onClick: running ? void 0 : onClose,
                      style: { background: "none", border: "none", cursor: running ? "default" : "pointer", fontSize: "18px", color: running ? "#d1d5db" : "#9ca3af" },
                      children: "✕"
                    }
                  )
                ] })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { flex: 1, overflowY: "auto", padding: "18px 20px" }, children: [
                !running && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { marginBottom: "16px" }, children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontSize: "12px", fontWeight: 600, color: "#374151", marginBottom: "8px" }, children: "选择角色范围" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: "8px" }, children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx(
                      "button",
                      {
                        onClick: handleSelectAll,
                        style: { padding: "3px 12px", fontSize: "11px", borderRadius: "10px", cursor: "pointer", border: selectAll ? "none" : "1px solid #e5e7eb", background: selectAll ? "#6366f1" : "#fff", color: selectAll ? "#fff" : "#6b7280" },
                        children: "全部角色"
                      }
                    ),
                    charList.map((c) => {
                      const sel = !selectAll && selectedChars.has(c);
                      return /* @__PURE__ */ jsxRuntimeExports.jsx(
                        "button",
                        {
                          onClick: () => toggleChar(c),
                          style: { padding: "3px 10px", fontSize: "11px", borderRadius: "10px", cursor: "pointer", border: sel ? "none" : "1px solid #e5e7eb", background: sel ? "#a855f7" : "#fff", color: sel ? "#fff" : "#6b7280" },
                          children: c
                        },
                        c
                      );
                    })
                  ] }),
                  !selectAll && selectedChars.size > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { fontSize: "11px", color: "#a855f7" }, children: [
                    "已选 ",
                    selectedChars.size,
                    " 个角色"
                  ] })
                ] }),
                !running && modList.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { marginBottom: "16px", padding: "10px 14px", background: "#f9fafb", borderRadius: "8px", border: "1px solid #f3f4f6" }, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { fontSize: "12px", color: "#374151" }, children: [
                  "共 ",
                  /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: modList.length }),
                  " 个 mod， 已处理 ",
                  /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { style: { color: "#16a34a" }, children: modList.filter((m) => m.hasCache).length }),
                  "， 待处理 ",
                  /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { style: { color: "#6366f1" }, children: pendingCount }),
                  loadingMods && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { color: "#9ca3af", marginLeft: "8px" }, children: "加载中..." })
                ] }) }),
                !running && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", gap: "8px", marginBottom: "16px" }, children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    "button",
                    {
                      onClick: runBatchAi,
                      disabled: pendingCount === 0 || loadingMods,
                      style: {
                        flex: 1,
                        padding: "12px",
                        border: "none",
                        borderRadius: "8px",
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "#fff",
                        cursor: pendingCount === 0 || loadingMods ? "default" : "pointer",
                        background: pendingCount === 0 || loadingMods ? "#d1d5db" : "linear-gradient(135deg, #6366f1, #a855f7)"
                      },
                      children: pendingCount === 0 ? "全部已处理" : `开始批量 AI 推荐 (${pendingCount} 个)`
                    }
                  ),
                  _batchAiDone.size > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx(
                    "button",
                    {
                      onClick: () => {
                        _batchAiDone.clear();
                        loadMods();
                      },
                      style: { padding: "12px 16px", border: "1px solid #e5e7eb", borderRadius: "8px", fontSize: "12px", color: "#6b7280", cursor: "pointer", background: "#fff" },
                      children: "重置记录"
                    }
                  )
                ] }),
                running && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { marginBottom: "14px" }, children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }, children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { fontSize: "12px", color: "#374151", fontWeight: 600 }, children: [
                      paused ? "⏸ 已暂停" : "▶ 运行中...",
                      " (",
                      progress.current,
                      "/",
                      progress.total,
                      ")"
                    ] }),
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", gap: "6px" }, children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        "button",
                        {
                          onClick: handlePause,
                          style: { padding: "4px 12px", fontSize: "11px", borderRadius: "6px", border: "1px solid #e5e7eb", background: paused ? "#fef3c7" : "#fff", cursor: "pointer", color: "#6b7280" },
                          children: paused ? "▶ 继续" : "⏸ 暂停"
                        }
                      ),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        "button",
                        {
                          onClick: handleCancel,
                          style: { padding: "4px 12px", fontSize: "11px", borderRadius: "6px", border: "none", background: "#ef4444", color: "#fff", cursor: "pointer" },
                          children: "✕ 取消"
                        }
                      )
                    ] })
                  ] }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontSize: "11px", color: "#6b7280", marginBottom: "6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: progress.currentMod }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { height: "6px", borderRadius: "3px", background: "#f3f4f6", overflow: "hidden" }, children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { height: "100%", borderRadius: "3px", background: "linear-gradient(90deg, #6366f1, #a855f7)", width: `${pct}%`, transition: "width 0.3s" } }) })
                ] }),
                results.length > 0 && !running && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { marginBottom: "12px", padding: "10px 14px", borderRadius: "8px", background: errorCount > 0 ? "rgba(239,68,68,0.06)" : "rgba(34,197,94,0.06)", border: `1px solid ${errorCount > 0 ? "#fca5a5" : "#86efac"}`, fontSize: "12px" }, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { fontWeight: 600, color: errorCount > 0 ? "#b45309" : "#16a34a" }, children: [
                  "完成！成功: ",
                  doneCount,
                  " | 失败: ",
                  errorCount,
                  " | 跳过: ",
                  results.filter((r) => r.status === "skip").length
                ] }) }),
                results.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { background: "#111827", borderRadius: "8px", padding: "10px", maxHeight: "260px", overflowY: "auto", fontFamily: "monospace", fontSize: "10px", userSelect: "text", cursor: "text" }, children: [
                  results.map((r, i) => {
                    if (r.status === "skip") return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { color: "#9ca3af", lineHeight: 1.6 }, children: [
                      "━ ",
                      r.message
                    ] }, i);
                    const color = r.status === "ok" ? "#4ade80" : "#f87171";
                    const icon = r.status === "ok" ? "✓" : "✗";
                    return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { color, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }, children: [
                      icon,
                      " [",
                      r.char,
                      "] ",
                      r.mod,
                      r.status === "ok" && /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { color: "#9ca3af" }, children: [
                        " → ",
                        r.message
                      ] }),
                      r.status === "error" && /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { color: "#fbbf24" }, children: [
                        " | ",
                        r.message
                      ] })
                    ] }, i);
                  }),
                  running && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { color: "#818cf8" }, children: "▋" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("div", { ref: logEndRef })
                ] }) }),
                !running && errorCount > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { marginTop: "12px" }, children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { fontSize: "12px", fontWeight: 600, color: "#ef4444", marginBottom: "6px" }, children: [
                    "失败列表 (",
                    errorCount,
                    ")"
                  ] }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { maxHeight: "150px", overflowY: "auto", border: "1px solid #fca5a5", borderRadius: "8px", background: "rgba(239,68,68,0.03)" }, children: results.filter((r) => r.status === "error").map((r, i) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { padding: "6px 12px", borderBottom: "1px solid #fee2e2", fontSize: "11px" }, children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { color: "#ef4444", fontWeight: 600 }, children: [
                      "[",
                      r.char,
                      "] ",
                      r.mod
                    ] }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { color: "#9ca3af", marginLeft: "8px" }, children: r.message })
                  ] }, i)) })
                ] })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { padding: "14px 20px", borderTop: "1px solid #f3f4f6", display: "flex", gap: "8px", justifyContent: "flex-end" }, children: [
                results.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "button",
                  {
                    onClick: () => {
                      navigator.clipboard.writeText(results.map((r) => `${r.status === "ok" ? "✓" : "✗"} [${r.char}] ${r.mod} ${r.message}`).join("\n"));
                    },
                    style: { padding: "7px 14px", border: "1px solid #e5e7eb", borderRadius: "8px", background: "#fff", cursor: "pointer", fontSize: "12px", color: "#6b7280" },
                    children: "复制日志"
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "button",
                  {
                    onClick: running ? void 0 : onClose,
                    disabled: running,
                    style: { padding: "7px 16px", border: "1px solid #e5e7eb", borderRadius: "8px", background: "#fff", cursor: running ? "default" : "pointer", fontSize: "13px", color: running ? "#d1d5db" : "#6b7280" },
                    children: "关闭"
                  }
                )
              ] })
            ]
          }
        )
      }
    ),
    document.body
  );
}
export {
  BatchAiPanel as default
};
