import { r as reactExports, j as jsxRuntimeExports, R as ReactDOM } from "./index.js";
function LinkCheckerPanel({ gameId, onClose }) {
  const [running, setRunning] = reactExports.useState(false);
  const [logs, setLogs] = reactExports.useState([]);
  const [logsCollapsed, setLogsCollapsed] = reactExports.useState(false);
  const [progress, setProgress] = reactExports.useState({ current: 0, total: 0, message: "" });
  const [brokenItems, setBrokenItems] = reactExports.useState(null);
  const [selectedIds, setSelectedIds] = reactExports.useState(/* @__PURE__ */ new Set());
  const [ghostItems, setGhostItems] = reactExports.useState(null);
  const [selectedGhostIds, setSelectedGhostIds] = reactExports.useState(/* @__PURE__ */ new Set());
  const [result, setResult] = reactExports.useState(null);
  const [devConfig, setDevConfig] = reactExports.useState({ pythonPath: "python", scriptPath: "" });
  const [phase, setPhase] = reactExports.useState("idle");
  const [lastFixItems, setLastFixItems] = reactExports.useState([]);
  const [copyNotice, setCopyNotice] = reactExports.useState("");
  const logEndRef = reactExports.useRef(null);
  const cleanupRef = reactExports.useRef([]);
  reactExports.useEffect(() => {
    loadDevConfig();
    return () => {
      cleanupRef.current.forEach((fn) => fn?.());
    };
  }, []);
  reactExports.useEffect(() => {
    if (logEndRef.current && !logsCollapsed) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, logsCollapsed]);
  async function loadDevConfig() {
    try {
      const r = await window.api.devGetPublishConfig();
      if (r.success && r.config) setDevConfig((prev) => ({ ...prev, ...r.config }));
    } catch (_) {
    }
  }
  async function resolveCurrentModsDir() {
    try {
      const r = await window.api.getConfig();
      const cfg = r?.config || {};
      const targetGameId = gameId || cfg.activeGame?.id || cfg.activeGameId;
      const game = (cfg.games || []).find((g) => g.id === targetGameId) || cfg.activeGame;
      return game?.modFolderPath || cfg.modsPath || "";
    } catch (_) {
      return "";
    }
  }
  async function runOperation(mode, extraParams = {}) {
    setRunning(true);
    setResult(null);
    setProgress({ current: 0, total: 0, message: "启动中..." });
    setLogsCollapsed(false);
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
              if (msg.mode === "ghosts") {
                setGhostItems(msg.items);
                setSelectedGhostIds(new Set(msg.items.map((i) => i.id)));
              } else {
                setBrokenItems(msg.items);
                setSelectedIds(new Set(msg.items.map((i) => i.id)));
              }
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
    const modsDir = extraParams.modsDir || await resolveCurrentModsDir();
    const r = await window.api.devBatchCloudOp({
      mode,
      gameId: gameId || "endfield",
      modsDir,
      characters: "",
      password: "qsl",
      pythonPath: devConfig.pythonPath,
      scriptPath: devConfig.scriptPath,
      ...extraParams
    });
    if (!r.success) {
      setLogs((prev) => [...prev, { message: `❌ ${r.error}`, level: "error" }]);
      setRunning(false);
    }
  }
  async function startCheck() {
    setLogs([]);
    setBrokenItems(null);
    setSelectedIds(/* @__PURE__ */ new Set());
    setPhase("checking");
    await runOperation("check-links");
    setPhase("checked");
  }
  async function startFix(targetIds = selectedIds, targetItems = brokenItems) {
    if (targetIds.size === 0) return;
    const pending = (targetItems || []).filter((i) => targetIds.has(i.id));
    setLastFixItems(pending);
    setLogs((prev) => [...prev, { message: `🔧 开始修复 ${targetIds.size} 个失效mod...`, level: "info" }]);
    setPhase("fixing");
    await runOperation("fix-links", { modIds: [...targetIds].join(",") });
    setPhase("checked");
  }
  function retryFailedFix() {
    if (!lastFixItems.length) return;
    const failedNames = new Set((result?.errorList || []).map((e) => `${e.char || ""}::${e.mod || ""}`));
    const matchedItems = failedNames.size > 0 ? lastFixItems.filter((i) => failedNames.has(`${i.char || ""}::${i.name || ""}`)) : [];
    const retryItems = matchedItems.length > 0 ? matchedItems : lastFixItems;
    const retryIds = new Set(retryItems.map((i) => i.id));
    setSelectedIds(retryIds);
    startFix(retryIds, lastFixItems);
  }
  function buildCopyText() {
    const lines = [];
    lines.push("链接失效检测 & 修复");
    lines.push(`游戏: ${gameId || "endfield"}`);
    if (progress.message) lines.push(`进度: ${progress.message} ${progress.total > 0 ? `${progress.current}/${progress.total}` : ""}`);
    if (brokenItems) {
      lines.push(`失效链接: ${brokenItems.length} 个`);
      brokenItems.forEach((item) => lines.push(`[${item.char}] ${item.name} ID:${item.id} ${item.reason || ""}`));
    }
    if (lastFixItems.length > 0) {
      lines.push(`本次待补充: ${lastFixItems.length} 个`);
      lastFixItems.forEach((item) => lines.push(`[${item.char}] ${item.name} ID:${item.id}`));
    }
    if (ghostItems) {
      lines.push(`幽灵 mod: ${ghostItems.length} 个`);
      ghostItems.forEach((item) => lines.push(`[${item.char}] ${item.name} ID:${item.id} ${item.reason || ""}`));
    }
    if (result) {
      lines.push(`修复结果: 成功 ${result.success || 0}，失败 ${result.errors || 0}`);
      (result.errorList || []).forEach((e) => lines.push(`失败: ${e.char ? `[${e.char}] ` : ""}${e.mod || ""}: ${e.error || ""}`));
    }
    if (logs.length > 0) {
      lines.push("日志:");
      logs.forEach((log) => lines.push(log.message));
    }
    return lines.join("\n");
  }
  async function copyPanelContent() {
    try {
      await navigator.clipboard.writeText(buildCopyText());
      setCopyNotice("已复制");
      setTimeout(() => setCopyNotice(""), 1500);
    } catch (_) {
      setCopyNotice("复制失败");
      setTimeout(() => setCopyNotice(""), 1500);
    }
  }
  async function startDetectGhosts() {
    setLogs([]);
    setGhostItems(null);
    setSelectedGhostIds(/* @__PURE__ */ new Set());
    setPhase("detecting");
    await runOperation("detect-ghosts");
    setPhase("checked");
  }
  async function startDeleteGhosts() {
    if (selectedGhostIds.size === 0) return;
    const count = selectedGhostIds.size;
    const ok = window.confirm(`确认从 mod 市场永久删除 ${count} 个幽灵 mod？

删除后用户客户端下次同步将不再看到这些 mod，此操作无法撤销。`);
    if (!ok) return;
    setLogs((prev) => [...prev, { message: `🗑️ 开始删除 ${count} 个幽灵 mod...`, level: "info" }]);
    setPhase("deleting");
    await runOperation("delete-mods", { modIds: [...selectedGhostIds].join(",") });
    setGhostItems((prev) => prev ? prev.filter((i) => !selectedGhostIds.has(i.id)) : prev);
    setSelectedGhostIds(/* @__PURE__ */ new Set());
    setPhase("checked");
  }
  function toggleId(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function selectAllBroken() {
    if (brokenItems) setSelectedIds(new Set(brokenItems.map((i) => i.id)));
  }
  function deselectAllBroken() {
    setSelectedIds(/* @__PURE__ */ new Set());
  }
  function toggleGhostId(id) {
    setSelectedGhostIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function selectAllGhosts() {
    if (ghostItems) setSelectedGhostIds(new Set(ghostItems.map((i) => i.id)));
  }
  function deselectAllGhosts() {
    setSelectedGhostIds(/* @__PURE__ */ new Set());
  }
  const overlay = /* @__PURE__ */ jsxRuntimeExports.jsx(
    "div",
    {
      style: { position: "fixed", inset: 0, zIndex: 10001, background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center" },
      onClick: (e) => {
        if (e.target === e.currentTarget && !running) onClose();
      },
      children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { background: "#fff", borderRadius: "12px", width: "780px", maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 8px 32px rgba(0,0,0,0.25)" }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #e5e7eb" }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontWeight: 700, fontSize: "15px", color: "#1f2937" }, children: "🔗 链接失效检测 & 修复" }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", alignItems: "center", gap: "8px" }, children: [
            copyNotice && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontSize: "11px", color: copyNotice === "已复制" ? "#16a34a" : "#dc2626" }, children: copyNotice }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: copyPanelContent, style: { padding: "4px 10px", border: "1px solid #e5e7eb", borderRadius: "6px", background: "#fff", cursor: "pointer", fontSize: "11px", color: "#6b7280" }, children: "复制内容" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { onClick: () => !running && onClose(), style: { cursor: running ? "default" : "pointer", fontSize: "18px", color: "#9ca3af", lineHeight: 1 }, children: "✕" })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { flex: 1, overflow: "auto", padding: "16px 20px" }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "button",
              {
                onClick: startCheck,
                disabled: running,
                style: { flex: 1, minWidth: "180px", padding: "10px", border: "none", borderRadius: "8px", cursor: running ? "default" : "pointer", fontSize: "12px", fontWeight: 600, color: "#fff", background: running ? "#d1d5db" : "linear-gradient(135deg, #6366f1, #8b5cf6)" },
                children: "🔍 检测市场失效链接"
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "button",
              {
                onClick: startDetectGhosts,
                disabled: running,
                style: { flex: 1, minWidth: "180px", padding: "10px", border: "none", borderRadius: "8px", cursor: running ? "default" : "pointer", fontSize: "12px", fontWeight: 600, color: "#fff", background: running ? "#d1d5db" : "linear-gradient(135deg, #0891b2, #06b6d4)" },
                children: "👻 检测幽灵 mod（本地已删）"
              }
            ),
            brokenItems && brokenItems.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs(
              "button",
              {
                onClick: () => startFix(),
                disabled: running || selectedIds.size === 0,
                style: { flex: 1, minWidth: "180px", padding: "10px", border: "none", borderRadius: "8px", cursor: running || selectedIds.size === 0 ? "default" : "pointer", fontSize: "12px", fontWeight: 600, color: "#fff", background: running || selectedIds.size === 0 ? "#d1d5db" : "linear-gradient(135deg, #ef4444, #f97316)" },
                children: [
                  "🔧 修复选中 (",
                  selectedIds.size,
                  ") 个"
                ]
              }
            ),
            ghostItems && ghostItems.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs(
              "button",
              {
                onClick: startDeleteGhosts,
                disabled: running || selectedGhostIds.size === 0,
                style: { flex: 1, minWidth: "180px", padding: "10px", border: "none", borderRadius: "8px", cursor: running || selectedGhostIds.size === 0 ? "default" : "pointer", fontSize: "12px", fontWeight: 600, color: "#fff", background: running || selectedGhostIds.size === 0 ? "#d1d5db" : "linear-gradient(135deg, #991b1b, #dc2626)" },
                children: [
                  "🗑️ 从市场删除选中 (",
                  selectedGhostIds.size,
                  ") 个"
                ]
              }
            )
          ] }),
          (running || progress.message) && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { marginBottom: "12px", padding: "10px", background: "#f0f9ff", borderRadius: "8px", fontSize: "12px" }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", justifyContent: "space-between", marginBottom: "4px" }, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { color: "#1e40af" }, children: progress.message || "准备中..." }),
              progress.total > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { color: "#6b7280" }, children: [
                progress.current,
                "/",
                progress.total
              ] })
            ] }),
            progress.total > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { height: "4px", background: "#dbeafe", borderRadius: "2px", overflow: "hidden" }, children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { height: "100%", width: `${Math.min(100, progress.current / progress.total * 100)}%`, background: "#3b82f6", borderRadius: "2px", transition: "width 0.3s" } }) })
          ] }),
          brokenItems && brokenItems.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { marginBottom: "12px" }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { fontWeight: 600, fontSize: "13px", color: "#dc2626" }, children: [
                "❌ 失效链接: ",
                brokenItems.length,
                " 个"
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", gap: "8px" }, children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: selectAllBroken, style: { fontSize: "11px", padding: "2px 8px", border: "1px solid #d1d5db", borderRadius: "4px", cursor: "pointer", background: "#fff" }, children: "全选" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: deselectAllBroken, style: { fontSize: "11px", padding: "2px 8px", border: "1px solid #d1d5db", borderRadius: "4px", cursor: "pointer", background: "#fff" }, children: "取消全选" })
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { maxHeight: "250px", overflow: "auto", border: "1px solid #e5e7eb", borderRadius: "8px" }, children: brokenItems.map((item) => /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { style: {
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 12px",
              borderBottom: "1px solid #f3f4f6",
              cursor: "pointer",
              fontSize: "12px",
              background: selectedIds.has(item.id) ? "#fef2f2" : "#fff"
            }, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "checkbox", checked: selectedIds.has(item.id), onChange: () => toggleId(item.id) }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { fontWeight: 600, color: "#374151", minWidth: "60px" }, children: [
                "[",
                item.char,
                "]"
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { flex: 1, color: "#1f2937" }, children: item.name }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { color: "#6b7280", fontSize: "11px" }, children: [
                "ID:",
                item.id
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: {
                fontSize: "11px",
                padding: "1px 6px",
                borderRadius: "3px",
                background: item.baiduBroken && item.quarkBroken ? "#fecaca" : "#fed7aa",
                color: item.baiduBroken && item.quarkBroken ? "#991b1b" : "#9a3412"
              }, children: item.reason })
            ] }, item.id)) })
          ] }),
          brokenItems && brokenItems.length === 0 && !running && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { padding: "20px", textAlign: "center", color: "#059669", fontSize: "14px", fontWeight: 600 }, children: "✅ 所有链接均正常，无失效项" }),
          ghostItems && ghostItems.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { marginBottom: "12px" }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { fontWeight: 600, fontSize: "13px", color: "#0e7490" }, children: [
                "👻 幽灵 mod（本地已删但市场仍在）: ",
                ghostItems.length,
                " 个"
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", gap: "8px" }, children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: selectAllGhosts, style: { fontSize: "11px", padding: "2px 8px", border: "1px solid #d1d5db", borderRadius: "4px", cursor: "pointer", background: "#fff" }, children: "全选" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: deselectAllGhosts, style: { fontSize: "11px", padding: "2px 8px", border: "1px solid #d1d5db", borderRadius: "4px", cursor: "pointer", background: "#fff" }, children: "取消全选" })
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { maxHeight: "250px", overflow: "auto", border: "1px solid #e5e7eb", borderRadius: "8px" }, children: ghostItems.map((item) => /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { style: {
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 12px",
              borderBottom: "1px solid #f3f4f6",
              cursor: "pointer",
              fontSize: "12px",
              background: selectedGhostIds.has(item.id) ? "#ecfeff" : "#fff"
            }, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "checkbox", checked: selectedGhostIds.has(item.id), onChange: () => toggleGhostId(item.id) }),
              item.imageUrl ? /* @__PURE__ */ jsxRuntimeExports.jsx("img", { src: item.imageUrl, alt: "", style: { width: "32px", height: "32px", objectFit: "cover", borderRadius: "4px", background: "#f3f4f6" }, onError: (e) => {
                e.target.style.visibility = "hidden";
              } }) : /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { width: "32px", height: "32px", borderRadius: "4px", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px" }, children: "👻" }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { fontWeight: 600, color: "#374151", minWidth: "60px" }, children: [
                "[",
                item.char,
                "]"
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { flex: 1, color: "#1f2937" }, children: item.name }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { color: "#6b7280", fontSize: "11px" }, children: [
                "ID:",
                item.id
              ] }),
              item.pinned && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontSize: "11px", padding: "1px 6px", borderRadius: "3px", background: "#fef3c7", color: "#92400e" }, children: "置顶" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontSize: "11px", padding: "1px 6px", borderRadius: "3px", background: "#cffafe", color: "#0e7490" }, children: item.reason })
            ] }, item.id)) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { marginTop: "6px", fontSize: "11px", color: "#6b7280" }, children: "⚠️ 删除会永久抹掉 mod 市场里的条目（包括图片、下载链接、评论、点赞），操作无法撤销。带『置顶』标记的 mod 请仔细核对后再勾选。" })
          ] }),
          ghostItems && ghostItems.length === 0 && !running && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { padding: "20px", textAlign: "center", color: "#059669", fontSize: "14px", fontWeight: 600 }, children: "✅ 未发现幽灵 mod，市场与本地一一对应" }),
          result && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: {
            marginBottom: "12px",
            padding: "10px",
            borderRadius: "8px",
            fontSize: "12px",
            background: result.errors > 0 ? "#fef2f2" : "#f0fdf4"
          }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { fontWeight: 600, color: result.errors > 0 ? "#dc2626" : "#16a34a" }, children: [
              "修复完成: 成功 ",
              result.success,
              "，失败 ",
              result.errors
            ] }),
            result.errorList?.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { marginTop: "6px" }, children: result.errorList.map((e, i) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { color: "#dc2626", fontSize: "11px" }, children: [
              "• ",
              e.char && `[${e.char}] `,
              e.mod,
              ": ",
              e.error
            ] }, i)) }),
            result.errors > 0 && lastFixItems.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { marginTop: "8px", display: "flex", gap: "8px", alignItems: "center" }, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { color: "#6b7280", fontSize: "11px" }, children: [
                "已保留本次待补充 ",
                lastFixItems.length,
                " 个，可修复问题后直接重试。"
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: retryFailedFix, disabled: running, style: { padding: "3px 10px", border: "1px solid #fecaca", borderRadius: "5px", background: "#fff", color: "#dc2626", cursor: running ? "default" : "pointer", fontSize: "11px" }, children: "重试补充" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: copyPanelContent, style: { padding: "3px 10px", border: "1px solid #e5e7eb", borderRadius: "5px", background: "#fff", color: "#6b7280", cursor: "pointer", fontSize: "11px" }, children: "复制结果" })
            ] })
          ] }),
          logs.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { marginBottom: "8px" }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs(
              "div",
              {
                onClick: () => setLogsCollapsed(!logsCollapsed),
                style: { cursor: "pointer", fontSize: "12px", color: "#6b7280", fontWeight: 600, marginBottom: "4px", userSelect: "none" },
                children: [
                  logsCollapsed ? "▶" : "▼",
                  " 日志 (",
                  logs.length,
                  ")"
                ]
              }
            ),
            !logsCollapsed && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { maxHeight: "200px", overflow: "auto", background: "#1f2937", borderRadius: "8px", padding: "8px 12px", fontSize: "11px", fontFamily: "Consolas, monospace" }, children: [
              logs.map((log, i) => /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { color: log.level === "error" ? "#f87171" : log.level === "warn" ? "#fbbf24" : "#d1d5db", lineHeight: "1.6" }, children: log.message }, i)),
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { ref: logEndRef })
            ] })
          ] })
        ] })
      ] })
    }
  );
  return ReactDOM.createPortal(overlay, document.body);
}
export {
  LinkCheckerPanel as default
};
