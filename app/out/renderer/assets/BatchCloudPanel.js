import { r as reactExports, R as ReactDOM, j as jsxRuntimeExports } from "./index.js";
const SERVER_URL_DEFAULT = "https://qaqm.top";
function BatchCloudPanel({ gameId, onClose }) {
  const [mode, setMode] = reactExports.useState(null);
  const [characters, setCharacters] = reactExports.useState("");
  const [charList, setCharList] = reactExports.useState([]);
  const [selectedChars, setSelectedChars] = reactExports.useState(/* @__PURE__ */ new Set());
  const [selectAll, setSelectAll] = reactExports.useState(true);
  const [force, setForce] = reactExports.useState(false);
  const [running, setRunning] = reactExports.useState(false);
  const [logs, setLogs] = reactExports.useState([]);
  const [logsCollapsed, setLogsCollapsed] = reactExports.useState(false);
  const [progress, setProgress] = reactExports.useState({ current: 0, total: 0, message: "" });
  const [result, setResult] = reactExports.useState(null);
  const [cloudItems, setCloudItems] = reactExports.useState(null);
  const [selectedPending, setSelectedPending] = reactExports.useState(/* @__PURE__ */ new Set());
  const [localMods, setLocalMods] = reactExports.useState([]);
  const [selectedMods, setSelectedMods] = reactExports.useState(null);
  const [loadingMods, setLoadingMods] = reactExports.useState(false);
  const [devConfig, setDevConfig] = reactExports.useState({ pythonPath: "python", scriptPath: "" });
  const [adminKey, setAdminKey] = reactExports.useState(() => localStorage.getItem("qaqm-dev-admin-key") || "");
  const [fillRunning, setFillRunning] = reactExports.useState(false);
  const [fillResult, setFillResult] = reactExports.useState(null);
  const logEndRef = reactExports.useRef(null);
  const cleanupRef = reactExports.useRef([]);
  reactExports.useEffect(() => {
    loadCharacters();
    loadDevConfig();
    return () => {
      cleanupRef.current.forEach((fn) => fn?.());
    };
  }, []);
  reactExports.useEffect(() => {
    loadLocalMods();
  }, [selectAll, selectedChars]);
  reactExports.useEffect(() => {
    if (logEndRef.current && !logsCollapsed) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, logsCollapsed]);
  async function loadCharacters() {
    try {
      const result2 = await window.api.getCharacters();
      if (result2?.success && Array.isArray(result2.characters)) {
        const chars = result2.characters.map((c) => c.name || c).filter(Boolean).sort();
        setCharList(chars);
      }
    } catch (_) {
    }
  }
  async function loadDevConfig() {
    try {
      const r = await window.api.devGetPublishConfig();
      if (r.success && r.config) setDevConfig((prev) => ({ ...prev, ...r.config }));
    } catch (_) {
    }
  }
  async function loadLocalMods() {
    setLoadingMods(true);
    try {
      const chars = selectAll ? [] : [...selectedChars];
      const r = await window.api.devListLocalMods({ characters: chars });
      if (r?.success) {
        setLocalMods(r.mods || []);
        setSelectedMods(null);
      }
    } catch (_) {
    }
    setLoadingMods(false);
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
  function toggleMod(folderName) {
    setSelectedMods((prev) => {
      const base = prev || new Set(localMods.map((m) => m.folderName));
      const next = new Set(base);
      if (next.has(folderName)) next.delete(folderName);
      else next.add(folderName);
      return next;
    });
  }
  function handleSelectAllMods() {
    setSelectedMods(null);
  }
  function isModSelected(folderName) {
    return selectedMods === null || selectedMods.has(folderName);
  }
  function handleSelectAll() {
    setSelectAll(true);
    setSelectedChars(/* @__PURE__ */ new Set());
  }
  async function fillMissingImages() {
    const key = adminKey || localStorage.getItem("qaqm-dev-admin-key") || "";
    if (!key) {
      const input = window.prompt("请输入管理员密钥 (x-admin-key)：");
      if (!input) return;
      setAdminKey(input);
      localStorage.setItem("qaqm-dev-admin-key", input);
    }
    setFillRunning(true);
    setFillResult(null);
    try {
      const config = await window.api.getConfig();
      const serverUrl = (config?.config?.serverUrl || SERVER_URL_DEFAULT).replace(/\/$/, "");
      const result2 = await window.api.devFillMissingImages({
        adminKey: adminKey || localStorage.getItem("qaqm-dev-admin-key") || "",
        serverUrl
      });
      if (!result2.success) throw new Error(result2.error);
      setFillResult(result2);
    } catch (e) {
      setFillResult({ error: e.message });
    } finally {
      setFillRunning(false);
    }
  }
  async function startOperation(opMode, extraParams = {}) {
    const { _keepLogs, ...restParams } = extraParams;
    setMode(opMode);
    setRunning(true);
    if (!_keepLogs) setLogs([]);
    setResult(null);
    if (opMode !== "list-cloud") setCloudItems(null);
    setProgress({ current: 0, total: 0, message: "启动中..." });
    setLogsCollapsed(false);
    const charFilter = selectAll ? "" : [...selectedChars].join(",");
    const modNamesFilter = selectedMods && opMode === "upload" ? [...selectedMods].join(",") : "";
    const cleanupProgress = window.api.onBatchCloudProgress((rawData) => {
      const lines = rawData.split("\n").filter((l) => l.trim());
      for (const line of lines) {
        try {
          const msg = JSON.parse(line);
          if (msg.type === "progress") {
            setProgress({ current: msg.current, total: msg.total, message: msg.message });
          } else if (msg.type === "log") {
            setLogs((prev) => [...prev, { message: msg.message, level: msg.level || "info" }]);
          } else if (msg.type === "result") {
            if (Array.isArray(msg.items)) {
              setCloudItems(msg.items);
              setSelectedPending(/* @__PURE__ */ new Set());
            } else {
              setResult({ success: msg.success, errors: msg.errors, errorList: msg.errorList || [] });
            }
          }
        } catch (_) {
          if (line.trim()) setLogs((prev) => [...prev, { message: line, level: "info" }]);
        }
      }
    });
    const cleanupDone = window.api.onBatchCloudDone(({ exitCode }) => {
      setRunning(false);
      if (exitCode !== 0 && !result) {
        setResult((prev) => prev || { success: 0, errors: 1, errorList: [{ error: `进程异常退出 (code=${exitCode})` }] });
      }
    });
    cleanupRef.current = [cleanupProgress, cleanupDone];
    const r = await window.api.devBatchCloudOp({
      mode: opMode,
      gameId: gameId || "endfield",
      characters: charFilter,
      password: "qsl",
      force,
      pythonPath: devConfig.pythonPath,
      scriptPath: devConfig.scriptPath,
      modNames: modNamesFilter,
      ...restParams
    });
    if (!r.success) {
      setLogs((prev) => [...prev, { message: `❌ ${r.error}`, level: "error" }]);
      setRunning(false);
    }
  }
  async function smartUploadWithFilter() {
    setLogs([]);
    setResult(null);
    setCloudItems(null);
    setProgress({ current: 0, total: 0, message: "正在检查图片和市场重复..." });
    const modsToCheck = selectedMods === null ? localMods : localMods.filter((m) => selectedMods.has(m.folderName));
    if (modsToCheck.length === 0) {
      setLogs([{ message: "⚠️ 没有可检查的mod", level: "warn" }]);
      return;
    }
    let marketModNames = /* @__PURE__ */ new Set();
    try {
      const config = await window.api.getConfig();
      const serverUrl = (config?.config?.serverUrl || SERVER_URL_DEFAULT).replace(/\/$/, "");
      const res = await fetch(`${serverUrl}/api/mods?gameId=${gameId || ""}`);
      if (res.ok) {
        const data = await res.json();
        const mods = data.mods || [];
        for (const mod of mods) {
          if (mod.name) marketModNames.add(mod.name);
        }
      }
    } catch (e) {
      setLogs((prev) => [...prev, { message: `⚠️ 获取市场数据失败: ${e.message}`, level: "warn" }]);
    }
    setLogs((prev) => [...prev, { message: `📊 市场已有 ${marketModNames.size} 个mod，开始逐个检查...`, level: "info" }]);
    const filtered = [];
    const skippedNoImage = [];
    const skippedDuplicate = [];
    for (let i = 0; i < modsToCheck.length; i++) {
      const mod = modsToCheck[i];
      setProgress({ current: i + 1, total: modsToCheck.length, message: `检查: [${mod.char}] ${mod.modName}` });
      if (marketModNames.has(mod.modName)) {
        skippedDuplicate.push(mod);
        continue;
      }
      try {
        const details = await window.api.getModDetails(mod.char, mod.modName);
        if (!details?.previewUrl) {
          skippedNoImage.push(mod);
          continue;
        }
      } catch {
        skippedNoImage.push(mod);
        continue;
      }
      filtered.push(mod);
    }
    if (skippedNoImage.length > 0) {
      setLogs((prev) => [...prev, { message: `⏭️ 无图片跳过 ${skippedNoImage.length} 个: ${skippedNoImage.map((m) => `[${m.char}]${m.modName}`).join(", ")}`, level: "warn" }]);
    }
    if (skippedDuplicate.length > 0) {
      setLogs((prev) => [...prev, { message: `⏭️ 市场重复跳过 ${skippedDuplicate.length} 个: ${skippedDuplicate.map((m) => `[${m.char}]${m.modName}`).join(", ")}`, level: "warn" }]);
    }
    setLogs((prev) => [...prev, { message: `✅ 符合条件: ${filtered.length} 个mod`, level: "info" }]);
    if (filtered.length === 0) {
      setLogs((prev) => [...prev, { message: "没有需要上传的mod，操作结束", level: "warn" }]);
      return;
    }
    const filteredNames = filtered.map((m) => m.modName).join(",");
    setLogs((prev) => [...prev, { message: `📤 开始上传 ${filtered.length} 个mod...`, level: "info" }]);
    await startOperation("upload", { modNames: filteredNames, _keepLogs: true });
  }
  function togglePending(id) {
    setSelectedPending((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function selectAllPending() {
    const pending = (cloudItems || []).filter((i) => i.status === "待发布").map((i) => i.id);
    setSelectedPending(new Set(pending));
  }
  async function republishSelected() {
    if (!selectedPending.size) return;
    await startOperation("replace", { modIds: [...selectedPending].join(",") });
  }
  const logColor = { info: "#d1d5db", warn: "#fbbf24", error: "#f87171", progress: "#818cf8" };
  return ReactDOM.createPortal(
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "div",
      {
        style: { position: "fixed", inset: 0, zIndex: 10005, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" },
        onClick: onClose,
        children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "div",
          {
            style: { background: "#fff", borderRadius: "14px", maxWidth: "700px", width: "95vw", maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" },
            onClick: (e) => e.stopPropagation(),
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { padding: "16px 20px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between", background: "linear-gradient(135deg, rgba(99,102,241,0.06), rgba(245,158,11,0.06))" }, children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontWeight: 700, fontSize: "15px" }, children: "☁️ 批量云盘操作" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { fontSize: "12px", color: "#9ca3af", marginTop: "2px" }, children: [
                    "游戏: ",
                    gameId || "endfield"
                  ] })
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: onClose, style: { background: "none", border: "none", cursor: "pointer", fontSize: "18px", color: "#9ca3af" }, children: "✕" })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { flex: 1, overflowY: "auto", padding: "18px 20px" }, children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { marginBottom: "16px" }, children: [
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
                          style: { padding: "3px 10px", fontSize: "11px", borderRadius: "10px", cursor: "pointer", border: sel ? "none" : "1px solid #e5e7eb", background: sel ? "#f59e0b" : "#fff", color: sel ? "#fff" : "#6b7280" },
                          children: c
                        },
                        c
                      );
                    })
                  ] }),
                  !selectAll && selectedChars.size > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { fontSize: "11px", color: "#6366f1" }, children: [
                    "已选 ",
                    selectedChars.size,
                    " 个角色"
                  ] })
                ] }),
                localMods.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { marginBottom: "14px" }, children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }, children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { fontSize: "12px", fontWeight: 600, color: "#374151" }, children: [
                      "📂 本地 mod（",
                      selectedMods === null ? "全选" : `已选 ${selectedMods.size}`,
                      "/",
                      localMods.length,
                      "）",
                      loadingMods && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { color: "#9ca3af", fontWeight: 400, marginLeft: 6 }, children: "加载中..." })
                    ] }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: handleSelectAllMods, style: { fontSize: "11px", padding: "2px 10px", border: "1px solid #e5e7eb", borderRadius: "6px", background: selectedMods === null ? "#6366f1" : "#fff", color: selectedMods === null ? "#fff" : "#6b7280", cursor: "pointer" }, children: "全选" })
                  ] }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { maxHeight: "180px", overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: "8px" }, children: (() => {
                    const grouped = {};
                    localMods.forEach((m) => {
                      if (!grouped[m.char]) grouped[m.char] = [];
                      grouped[m.char].push(m);
                    });
                    return Object.entries(grouped).map(([char, mods]) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { padding: "4px 10px", background: "#f9fafb", fontSize: "10px", fontWeight: 700, color: "#6b7280", borderBottom: "1px solid #f3f4f6", position: "sticky", top: 0 }, children: char }),
                      mods.map((m) => /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { style: { display: "flex", alignItems: "center", gap: "8px", padding: "5px 12px", borderBottom: "1px solid #f3f4f6", cursor: "pointer", background: isModSelected(m.folderName) ? "rgba(99,102,241,0.04)" : "transparent" }, children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "checkbox", checked: isModSelected(m.folderName), onChange: () => toggleMod(m.folderName) }),
                        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontSize: "11px", flex: 1, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: m.modName }),
                        m.modId && /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { fontSize: "10px", color: "#9ca3af", fontFamily: "monospace" }, children: [
                          "#",
                          m.modId
                        ] })
                      ] }, m.folderName))
                    ] }, char));
                  })() })
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { style: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px", cursor: "pointer", userSelect: "none", fontSize: "12px", color: "#6b7280" }, children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "checkbox", checked: force, onChange: (e) => setForce(e.target.checked) }),
                  "强制覆盖已存在的云盘文件（不勾选则跳过重名）"
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { marginBottom: "16px", paddingBottom: "16px", borderBottom: "1px solid #f3f4f6" }, children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontSize: "12px", fontWeight: 600, color: "#374151", marginBottom: "8px" }, children: "图片修复" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }, children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx(
                      "button",
                      {
                        onClick: fillMissingImages,
                        disabled: fillRunning || running,
                        style: { padding: "8px 16px", border: "none", borderRadius: "8px", cursor: fillRunning || running ? "default" : "pointer", fontSize: "12px", fontWeight: 600, color: "#fff", background: fillRunning || running ? "#d1d5db" : "linear-gradient(135deg, #ec4899, #8b5cf6)" },
                        children: fillRunning ? "⏳ 补全中..." : "🖼️ 补全缺图"
                      }
                    ),
                    /* @__PURE__ */ jsxRuntimeExports.jsx(
                      "input",
                      {
                        type: "password",
                        value: adminKey,
                        onChange: (e) => {
                          setAdminKey(e.target.value);
                          localStorage.setItem("qaqm-dev-admin-key", e.target.value);
                        },
                        placeholder: "管理员密钥",
                        style: { padding: "6px 10px", fontSize: "11px", border: "1px solid #e5e7eb", borderRadius: "6px", outline: "none", width: "140px", fontFamily: "monospace" }
                      }
                    )
                  ] }),
                  fillResult && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { marginTop: "10px", padding: "10px 14px", borderRadius: "8px", background: fillResult.error ? "rgba(239,68,68,0.06)" : "rgba(34,197,94,0.06)", border: `1px solid ${fillResult.error ? "#fca5a5" : "#86efac"}`, fontSize: "12px" }, children: fillResult.error ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { color: "#ef4444" }, children: [
                    "❌ ",
                    fillResult.error
                  ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { fontWeight: 600, color: "#16a34a", marginBottom: "4px" }, children: [
                      "✅ 共 ",
                      fillResult.total,
                      " 个缺图 · 已补全 ",
                      fillResult.filled,
                      " · 跳过 ",
                      fillResult.skipped,
                      " · 失败 ",
                      fillResult.errorCount
                    ] }),
                    fillResult.filledList?.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { maxHeight: "120px", overflowY: "auto", fontSize: "11px", color: "#374151" }, children: fillResult.filledList.map((m) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                      "#",
                      m.id,
                      " ",
                      m.name
                    ] }, m.id)) }),
                    fillResult.skippedList?.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { marginTop: "4px", fontSize: "10px", color: "#9ca3af" }, children: [
                      "跳过: ",
                      fillResult.skippedList.map((m) => `#${m.id}(${m.reason})`).join(" · ")
                    ] })
                  ] }) })
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }, children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    "button",
                    {
                      onClick: () => startOperation("sync-upload"),
                      disabled: running,
                      style: { flex: 1, minWidth: "150px", padding: "10px", border: "none", borderRadius: "8px", cursor: running ? "default" : "pointer", fontSize: "12px", fontWeight: 600, color: "#fff", background: running ? "#d1d5db" : "linear-gradient(135deg, #059669, #10b981)" },
                      children: "🔄 智能补传（只传缺失）"
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    "button",
                    {
                      onClick: () => startOperation("upload"),
                      disabled: running,
                      style: { flex: 1, minWidth: "150px", padding: "10px", border: "none", borderRadius: "8px", cursor: running ? "default" : "pointer", fontSize: "12px", fontWeight: 600, color: "#fff", background: running ? "#d1d5db" : "linear-gradient(135deg, #6366f1, #8b5cf6)" },
                      children: "📤 一键上传至mod市场"
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    "button",
                    {
                      onClick: smartUploadWithFilter,
                      disabled: running,
                      style: { flex: 1, minWidth: "150px", padding: "10px", border: "none", borderRadius: "8px", cursor: running ? "default" : "pointer", fontSize: "12px", fontWeight: 600, color: "#fff", background: running ? "#d1d5db" : "linear-gradient(135deg, #059669, #10b981)" },
                      children: "🖼️ 智能上传（有图+去重）"
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    "button",
                    {
                      onClick: () => startOperation("replace"),
                      disabled: running,
                      style: { flex: 1, minWidth: "120px", padding: "10px", border: "none", borderRadius: "8px", cursor: running ? "default" : "pointer", fontSize: "12px", fontWeight: 600, color: "#fff", background: running ? "#d1d5db" : "linear-gradient(135deg, #f59e0b, #ef4444)" },
                      children: "🔗 替换网盘链接"
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    "button",
                    {
                      onClick: () => startOperation("list-cloud"),
                      disabled: running,
                      style: { flex: 1, minWidth: "120px", padding: "10px", border: "none", borderRadius: "8px", cursor: running ? "default" : "pointer", fontSize: "12px", fontWeight: 600, color: "#fff", background: running ? "#d1d5db" : "linear-gradient(135deg, #10b981, #0ea5e9)" },
                      children: "☁️ 云盘对比"
                    }
                  )
                ] }),
                (running || result) && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { marginBottom: "12px" }, children: [
                  running && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#9ca3af", marginBottom: "4px" }, children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: progress.message }),
                      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
                        progress.current,
                        "/",
                        progress.total
                      ] })
                    ] }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { height: "5px", borderRadius: "3px", background: "#f3f4f6", overflow: "hidden" }, children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { height: "100%", borderRadius: "3px", background: "linear-gradient(90deg, #6366f1, #f59e0b)", width: `${progress.total > 0 ? progress.current / progress.total * 100 : 0}%`, transition: "width 0.3s" } }) })
                  ] }),
                  result && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { padding: "10px 14px", borderRadius: "8px", background: result.errors > 0 ? "rgba(239,68,68,0.06)" : "rgba(34,197,94,0.06)", border: `1px solid ${result.errors > 0 ? "#fca5a5" : "#86efac"}`, fontSize: "12px" }, children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { fontWeight: 600, color: result.errors > 0 ? "#ef4444" : "#16a34a" }, children: [
                      "✅ 成功: ",
                      result.success,
                      "   ❌ 失败: ",
                      result.errors
                    ] }),
                    result.errorList && result.errorList.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { marginTop: "8px", maxHeight: "120px", overflowY: "auto", fontSize: "11px", color: "#ef4444" }, children: result.errorList.map((e, i) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                      e.char && `[${e.char}] `,
                      e.mod && `${e.mod}: `,
                      e.error
                    ] }, i)) })
                  ] })
                ] }),
                cloudItems && !running && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { marginBottom: "16px" }, children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }, children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { fontSize: "12px", fontWeight: 600, color: "#374151" }, children: [
                      "☁️ 对比结果 — 共 ",
                      cloudItems.length,
                      " 个 mod  ",
                      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { color: "#ef4444" }, children: [
                        "待发布: ",
                        cloudItems.filter((i) => i.status === "待发布").length
                      ] }),
                      " ",
                      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { color: "#16a34a" }, children: [
                        "已发布: ",
                        cloudItems.filter((i) => i.status === "已发布").length
                      ] })
                    ] }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: selectAllPending, style: { fontSize: "11px", padding: "3px 10px", border: "1px solid #e5e7eb", borderRadius: "6px", background: "#fff", cursor: "pointer", color: "#6b7280" }, children: "全选待发布" })
                  ] }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { maxHeight: "220px", overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: "8px" }, children: cloudItems.map((item) => /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { style: { display: "flex", alignItems: "center", gap: "8px", padding: "7px 12px", borderBottom: "1px solid #f3f4f6", cursor: item.status === "待发布" ? "pointer" : "default", background: item.status === "待发布" && selectedPending.has(item.id) ? "rgba(239,68,68,0.05)" : "transparent" }, children: [
                    item.status === "待发布" ? /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "checkbox", checked: selectedPending.has(item.id), onChange: () => togglePending(item.id) }) : /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { width: "14px", display: "inline-block" } }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontSize: "10px", padding: "1px 6px", borderRadius: "8px", fontWeight: 600, background: item.status === "待发布" ? "#fee2e2" : "#dcfce7", color: item.status === "待发布" ? "#b91c1c" : "#15803d" }, children: item.status }),
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { fontSize: "12px", color: "#374151", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: [
                      "#",
                      item.id,
                      " ",
                      item.char && `[${item.char}] `,
                      item.name
                    ] })
                  ] }, item.id)) }),
                  selectedPending.size > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { marginTop: "10px", display: "flex", alignItems: "center", gap: "10px" }, children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { fontSize: "12px", color: "#6b7280" }, children: [
                      "已选 ",
                      selectedPending.size,
                      " 个待发布"
                    ] }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx(
                      "button",
                      {
                        onClick: republishSelected,
                        disabled: running,
                        style: { padding: "7px 18px", border: "none", borderRadius: "8px", background: "linear-gradient(135deg, #f59e0b, #ef4444)", color: "#fff", fontWeight: 600, fontSize: "12px", cursor: "pointer" },
                        children: "🔗 发布选中到市场"
                      }
                    )
                  ] })
                ] }),
                logs.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsxs(
                    "button",
                    {
                      onClick: () => setLogsCollapsed(!logsCollapsed),
                      style: { background: "none", border: "none", cursor: "pointer", fontSize: "11px", color: "#9ca3af", padding: 0, marginBottom: "6px" },
                      children: [
                        logsCollapsed ? "▶" : "▼",
                        " 终端日志 (",
                        logs.length,
                        " 条)"
                      ]
                    }
                  ),
                  !logsCollapsed && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { background: "#111827", borderRadius: "8px", padding: "10px", maxHeight: "200px", overflowY: "auto", fontFamily: "monospace", fontSize: "10px", userSelect: "text", cursor: "text" }, children: [
                    logs.map((log, i) => /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { color: logColor[log.level] || "#d1d5db", lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }, children: log.message }, i)),
                    running && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { color: "#818cf8" }, children: "▋" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { ref: logEndRef })
                  ] })
                ] })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { padding: "14px 20px", borderTop: "1px solid #f3f4f6", display: "flex", gap: "8px", justifyContent: "flex-end" }, children: [
                logs.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "button",
                  {
                    onClick: () => {
                      navigator.clipboard.writeText(logs.map((l) => l.message).join("\n"));
                    },
                    style: { padding: "7px 14px", border: "1px solid #e5e7eb", borderRadius: "8px", background: "#fff", cursor: "pointer", fontSize: "12px", color: "#6b7280" },
                    children: "📋 复制日志"
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "button",
                  {
                    onClick: onClose,
                    disabled: running,
                    style: { padding: "7px 16px", border: "1px solid #e5e7eb", borderRadius: "8px", background: "#fff", cursor: running ? "default" : "pointer", fontSize: "13px", color: "#6b7280" },
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
  BatchCloudPanel as default
};
