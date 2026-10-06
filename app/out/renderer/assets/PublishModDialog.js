import { r as reactExports, f as fetchWithDirectFallback, R as ReactDOM, j as jsxRuntimeExports } from "./index.js";
const SERVER_URL_DEFAULT = "https://qaqm.top";
const PUBLISH_PREFS_PREFIX = "qaqm-dev-publish-prefs";
const MAX_AUTHOR_PREFS = 30;
const MAX_SOURCE_PREFS = 80;
const MAX_AUTHOR_SOURCE_PREFS = 20;
const DEFAULT_DESCRIPTION = "下载的mp4文件拖进管理器里面能自动解密安装，手动安装失效。";
function createPublishTaskId() {
  return `publish-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
function getPublishPrefsKey(gameId) {
  return `${PUBLISH_PREFS_PREFIX}:${gameId || "endfield"}`;
}
function cleanText(value) {
  return String(value || "").trim();
}
function normalizeSourceUrl(value) {
  const text = cleanText(value);
  if (!text) return "";
  try {
    return new URL(text).toString();
  } catch (_) {
    return text;
  }
}
function findMappedAuthorBySource(prefs, sourceUrl) {
  const normalized = normalizeSourceUrl(sourceUrl);
  if (!normalized) return "";
  const recent = (prefs.recentSources || []).find((item) => normalizeSourceUrl(item.url) === normalized && cleanText(item.author));
  if (recent) return cleanText(recent.author);
  const author = (prefs.authors || []).find((item) => (item.sources || []).some((url) => normalizeSourceUrl(url) === normalized));
  return author?.name || "";
}
function normalizePublishPrefs(raw = {}) {
  const authors = [];
  const authorKeys = /* @__PURE__ */ new Set();
  for (const item of Array.isArray(raw.authors) ? raw.authors : []) {
    const name = cleanText(item?.name);
    if (!name) continue;
    const key = name.toLowerCase();
    if (authorKeys.has(key)) continue;
    authorKeys.add(key);
    const sources = [];
    const sourceKeys = /* @__PURE__ */ new Set();
    for (const url of Array.isArray(item?.sources) ? item.sources : []) {
      const normalized = normalizeSourceUrl(url);
      if (!normalized || sourceKeys.has(normalized)) continue;
      sourceKeys.add(normalized);
      sources.push(normalized);
      if (sources.length >= MAX_AUTHOR_SOURCE_PREFS) break;
    }
    authors.push({ name, sources });
    if (authors.length >= MAX_AUTHOR_PREFS) break;
  }
  const recentSources = [];
  const recentSourceKeys = /* @__PURE__ */ new Set();
  for (const item of Array.isArray(raw.recentSources) ? raw.recentSources : []) {
    const url = normalizeSourceUrl(item?.url || item);
    if (!url || recentSourceKeys.has(url)) continue;
    recentSourceKeys.add(url);
    recentSources.push({
      url,
      author: cleanText(item?.author),
      updatedAt: Number(item?.updatedAt) || 0
    });
    if (recentSources.length >= MAX_SOURCE_PREFS) break;
  }
  return {
    lastGameVersion: cleanText(raw.lastGameVersion),
    authors,
    recentSources
  };
}
function readPublishPrefs(gameId) {
  try {
    const raw = window.localStorage.getItem(getPublishPrefsKey(gameId));
    if (!raw) return normalizePublishPrefs();
    return normalizePublishPrefs(JSON.parse(raw));
  } catch (_) {
    return normalizePublishPrefs();
  }
}
function writePublishPrefs(gameId, prefs) {
  try {
    window.localStorage.setItem(getPublishPrefsKey(gameId), JSON.stringify(normalizePublishPrefs(prefs)));
  } catch (_) {
  }
}
function mergePublishPrefs(rawPrefs, { gameVersion, author, sourceUrl }) {
  const next = normalizePublishPrefs(rawPrefs);
  const selectedVersion = cleanText(gameVersion);
  const selectedAuthor = cleanText(author);
  const selectedSource = normalizeSourceUrl(sourceUrl);
  if (selectedVersion) next.lastGameVersion = selectedVersion;
  let authorEntry = null;
  if (selectedAuthor) {
    const authorKey = selectedAuthor.toLowerCase();
    const existingIndex = next.authors.findIndex((item) => item.name.toLowerCase() === authorKey);
    if (existingIndex >= 0) {
      authorEntry = { ...next.authors[existingIndex], name: selectedAuthor };
      next.authors.splice(existingIndex, 1);
    } else {
      authorEntry = { name: selectedAuthor, sources: [] };
    }
    next.authors.unshift(authorEntry);
  }
  if (selectedSource) {
    if (authorEntry) {
      authorEntry.sources = [
        selectedSource,
        ...(authorEntry.sources || []).filter((url) => normalizeSourceUrl(url) !== selectedSource)
      ].slice(0, MAX_AUTHOR_SOURCE_PREFS);
    }
    next.recentSources = [
      { url: selectedSource, author: selectedAuthor || findMappedAuthorBySource(next, selectedSource), updatedAt: Date.now() },
      ...next.recentSources.filter((item) => normalizeSourceUrl(item.url) !== selectedSource)
    ].slice(0, MAX_SOURCE_PREFS);
  }
  next.authors = next.authors.slice(0, MAX_AUTHOR_PREFS);
  return normalizePublishPrefs(next);
}
function getSourceOptions(prefs, selectedAuthor) {
  const options = [];
  const seen = /* @__PURE__ */ new Set();
  const selectedAuthorKey = cleanText(selectedAuthor).toLowerCase();
  const add = (url, author) => {
    const normalized = normalizeSourceUrl(url);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    options.push({ url: normalized, author: cleanText(author) });
  };
  if (selectedAuthorKey) {
    const authorEntry = (prefs.authors || []).find((item) => item.name.toLowerCase() === selectedAuthorKey);
    for (const url of authorEntry?.sources || []) add(url, authorEntry.name);
  }
  for (const item of prefs.recentSources || []) add(item.url, item.author);
  for (const item of prefs.authors || []) {
    for (const url of item.sources || []) add(url, item.name);
  }
  return options;
}
function getDatalistSuffix(gameId) {
  return String(gameId || "endfield").replace(/[^a-z0-9_-]/gi, "-");
}
function parseR2Metrics(message) {
  const text = String(message || "");
  if (!text.includes("R2")) return null;
  const speed = text.match(/(\d+(?:\.\d+)?\s*(?:B|KB|MB|GB)\/s)/i)?.[1] || "";
  const progress = text.match(/(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?\s*(?:B|KB|MB|GB))\/(\d+(?:\.\d+)?\s*(?:B|KB|MB|GB))/i);
  if (!speed && !progress) return null;
  return {
    provider: "R2",
    speed,
    percent: progress ? progress[1] : "",
    transferred: progress ? progress[2] : "",
    total: progress ? progress[3] : ""
  };
}
function PublishModDialog({ characterName, modName, modFolderPath, gameId, initialModMode, visible = true, onClose, onMinimize, onStateChange }) {
  const effectiveGameId = gameId || "endfield";
  const initialPublishPrefsRef = reactExports.useRef(null);
  if (!initialPublishPrefsRef.current) initialPublishPrefsRef.current = readPublishPrefs(effectiveGameId);
  const [publishPrefs, setPublishPrefs] = reactExports.useState(initialPublishPrefsRef.current);
  const [version, setVersion] = reactExports.useState(initialPublishPrefsRef.current.lastGameVersion || "1.0");
  const [gameVersion, setGameVersion] = reactExports.useState(initialPublishPrefsRef.current.lastGameVersion || "");
  const [gameVersions, setGameVersions] = reactExports.useState([]);
  const [modMode, setModMode] = reactExports.useState(initialModMode === "pak" ? "pak" : "d3d");
  const [description, setDescription] = reactExports.useState(DEFAULT_DESCRIPTION);
  const [author, setAuthor] = reactExports.useState("");
  const [sourceUrl, setSourceUrl] = reactExports.useState("");
  const [isNsfw, setIsNsfw] = reactExports.useState(false);
  const [useAdultImageHost, setUseAdultImageHost] = reactExports.useState(true);
  const [selectedTags, setSelectedTags] = reactExports.useState([]);
  const [userDirty, setUserDirty] = reactExports.useState(false);
  const [availableTags, setAvailableTags] = reactExports.useState([]);
  const [tagsLoading, setTagsLoading] = reactExports.useState(true);
  const [tagsError, setTagsError] = reactExports.useState("");
  const [previewDataUrl, setPreviewDataUrl] = reactExports.useState(null);
  const [localTags, setLocalTags] = reactExports.useState([]);
  const [devConfig, setDevConfig] = reactExports.useState({
    pythonPath: "python",
    winrarPath: "C:\\Program Files\\WinRAR\\WinRAR.exe",
    scriptPath: ""
  });
  const [showDevConfig, setShowDevConfig] = reactExports.useState(false);
  const [phase, setPhase] = reactExports.useState("form");
  const [progressStep, setProgressStep] = reactExports.useState(0);
  const [progressTotal, setProgressTotal] = reactExports.useState(5);
  const [progressMessage, setProgressMessage] = reactExports.useState("");
  const [logs, setLogs] = reactExports.useState([]);
  const [logsCollapsed, setLogsCollapsed] = reactExports.useState(false);
  const [resultMessage, setResultMessage] = reactExports.useState("");
  const [resultLinks, setResultLinks] = reactExports.useState({});
  const [uploadMetrics, setUploadMetrics] = reactExports.useState(null);
  const logEndRef = reactExports.useRef(null);
  const cleanupRef = reactExports.useRef(null);
  const taskIdRef = reactExports.useRef(createPublishTaskId());
  const onStateChangeRef = reactExports.useRef(onStateChange);
  const authorDatalistId = `publish-author-options-${getDatalistSuffix(effectiveGameId)}`;
  const sourceDatalistId = `publish-source-options-${getDatalistSuffix(effectiveGameId)}`;
  const sourceOptions = getSourceOptions(publishPrefs, author);
  reactExports.useEffect(() => {
    onStateChangeRef.current = onStateChange;
  }, [onStateChange]);
  reactExports.useEffect(() => {
    const prefs = readPublishPrefs(effectiveGameId);
    setPublishPrefs(prefs);
    setVersion(prefs.lastGameVersion || "1.0");
    setGameVersion(prefs.lastGameVersion || "");
  }, [effectiveGameId]);
  reactExports.useEffect(() => {
    loadTagsAndLocalTags();
    loadDevConfig();
    loadPreview();
    loadGameVersions();
    return () => {
      if (cleanupRef.current) cleanupRef.current();
    };
  }, []);
  reactExports.useEffect(() => {
    if (logEndRef.current) logEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [logs]);
  reactExports.useEffect(() => {
    onStateChangeRef.current?.({
      characterName,
      modName,
      phase,
      progressStep,
      progressTotal,
      progressMessage,
      uploadMetrics,
      resultMessage,
      resultLinks,
      logs,
      taskId: taskIdRef.current
    });
  }, [characterName, modName, phase, progressStep, progressTotal, progressMessage, uploadMetrics, resultMessage, resultLinks, logs]);
  async function loadPreview() {
    try {
      const r = await window.api.devGetModPreview(modFolderPath);
      if (r.success && r.previewDataUrl) setPreviewDataUrl(r.previewDataUrl);
    } catch (_) {
    }
  }
  async function loadTagsAndLocalTags() {
    setTagsLoading(true);
    setTagsError("");
    try {
      let localTagNames = [];
      try {
        const r = await window.api.devGetModTags(modFolderPath);
        const raw = r?.tags || [];
        localTagNames = raw.map((t) => typeof t === "string" ? t : t?.name || "").filter(Boolean);
        setLocalTags(localTagNames);
      } catch (_) {
      }
      const config = await window.api.getConfig();
      const serverUrl = (config?.config?.serverUrl || SERVER_URL_DEFAULT).replace(/\/$/, "");
      const { response: resp } = await fetchWithDirectFallback(serverUrl, "/api/games/tags", {
        expectJson: true,
        timeoutMs: 4e3
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      let tags = [];
      if (data.success) tags = data.tags || [];
      else if (Array.isArray(data)) tags = data;
      else if (data.tags) tags = data.tags;
      setAvailableTags(tags);
      if (localTagNames.length > 0 && tags.length > 0) {
        const matched = tags.filter((t) => localTagNames.includes(t.name) || localTagNames.includes(t.id)).map((t) => t.id || t.name);
        setSelectedTags(matched);
      }
    } catch (e) {
      setTagsError(`标签加载失败: ${e.message}`);
    } finally {
      setTagsLoading(false);
    }
  }
  async function loadGameVersions() {
    try {
      const config = await window.api.getConfig();
      const serverUrl = (config?.config?.serverUrl || SERVER_URL_DEFAULT).replace(/\/$/, "");
      const { response: resp } = await fetchWithDirectFallback(serverUrl, "/api/mods/game-versions", {
        expectJson: true,
        timeoutMs: 4e3
      });
      if (!resp.ok) return;
      const data = await resp.json();
      if (data.success && Array.isArray(data.versions)) {
        setGameVersions(data.versions);
        const savedVersion = readPublishPrefs(effectiveGameId).lastGameVersion;
        const defaultVersion = savedVersion || data.versions[0]?.version || "";
        if (defaultVersion && !gameVersion) {
          setVersion(defaultVersion);
          setGameVersion(defaultVersion);
        }
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
  function persistPublishPrefs(updates = {}) {
    const next = mergePublishPrefs(readPublishPrefs(effectiveGameId), {
      gameVersion: updates.gameVersion ?? (gameVersion || version),
      author: updates.author ?? author,
      sourceUrl: updates.sourceUrl ?? sourceUrl
    });
    writePublishPrefs(effectiveGameId, next);
    setPublishPrefs(next);
    return next;
  }
  function selectGameVersion(nextVersion, dirty = true) {
    const selectedVersion = cleanText(nextVersion);
    setVersion(selectedVersion);
    setGameVersion(selectedVersion);
    if (dirty) setUserDirty(true);
    if (selectedVersion) persistPublishPrefs({ gameVersion: selectedVersion, author: "", sourceUrl: "" });
  }
  function handleAuthorChange(nextAuthor) {
    setAuthor(nextAuthor);
    setUserDirty(true);
  }
  function handleSourceUrlChange(nextSourceUrl) {
    setSourceUrl(nextSourceUrl);
    if (!cleanText(author)) {
      const mappedAuthor = findMappedAuthorBySource(publishPrefs, nextSourceUrl);
      if (mappedAuthor) setAuthor(mappedAuthor);
    }
    setUserDirty(true);
  }
  function toggleTag(tagId) {
    setSelectedTags((prev) => prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]);
    setUserDirty(true);
  }
  function handleRequestClose() {
    if (phase === "publishing") {
      onMinimize?.();
      return;
    }
    if (phase === "form" && userDirty) {
      const ok = window.confirm("你已经填写了发布表单内容，关闭后这些内容会丢失。确定要关闭吗？");
      if (!ok) return;
    }
    onClose?.();
  }
  function addLog(message, level = "info") {
    setLogs((prev) => [...prev, { message, level, ts: Date.now() }]);
  }
  function preparePublishRun() {
    cleanupRef.current?.();
    cleanupRef.current = null;
    taskIdRef.current = createPublishTaskId();
    setUploadMetrics(null);
    return taskIdRef.current;
  }
  function captureModId(message) {
    const match = String(message || "").match(/(?:市场发布成功!\s*ID\s*=|市场 ID\s*=\s*|市场 ID:\s*|ID\s*=\s*)(\d+)/);
    if (match) {
      setResultLinks((prev) => ({ ...prev, modId: Number(match[1]) }));
    }
  }
  function captureCloudLinks(message) {
    const text = String(message || "");
    const quark = text.match(/夸克[:：]\s*(https?:\/\/\S+)/)?.[1];
    const baidu = text.match(/百度[:：]\s*(https?:\/\/\S+)/)?.[1];
    if (quark || baidu) {
      setResultLinks((prev) => ({
        ...prev,
        ...quark ? { quark } : {},
        ...baidu ? { baidu } : {}
      }));
    }
  }
  function handleCliMessage(msg, successFallback) {
    if (msg.type === "progress") {
      setProgressStep(msg.step);
      setProgressTotal(msg.total);
      setProgressMessage(msg.message);
      addLog(`[${msg.step}/${msg.total}] ${msg.message}`, "progress");
    } else if (msg.type === "log") {
      captureModId(msg.message);
      captureCloudLinks(msg.message);
      const metrics = parseR2Metrics(msg.message);
      if (metrics) setUploadMetrics((prev) => ({ ...prev || {}, ...metrics }));
      addLog(msg.message, msg.level || "info");
    } else if (msg.type === "success") {
      setResultMessage(msg.message || successFallback);
      setResultLinks((prev) => ({
        ...prev,
        baidu: msg.baiduLink || prev.baidu,
        quark: msg.quarkLink || prev.quark,
        modId: msg.modId || prev.modId,
        directInstall: msg.directInstall ?? prev.directInstall,
        cdnObjectKey: msg.cdnObjectKey || prev.cdnObjectKey
      }));
      setPhase("done");
    } else if (msg.type === "error") {
      addLog(`❌ ${msg.message}`, "error");
      setResultMessage(msg.message);
      setPhase("error");
    }
  }
  function attachPublishListeners(taskId, successFallback, saveLog = false) {
    const cleanupProgress = window.api.onPublishProgress((rawData) => {
      const lines = rawData.split("\n").filter((l) => l.trim());
      for (const line of lines) {
        try {
          handleCliMessage(JSON.parse(line), successFallback);
        } catch (_) {
          if (line.trim()) addLog(line, "info");
        }
      }
    }, taskId);
    const cleanupDone = window.api.onPublishDone(({ exitCode }) => {
      if (exitCode !== 0) {
        setPhase((prev) => {
          if (prev !== "done") {
            setResultMessage(`进程异常退出 (code=${exitCode})`);
            return "error";
          }
          return prev;
        });
      }
      if (saveLog) {
        setTimeout(() => {
          const allLogs = document.querySelector("[data-log-content]");
          const logText = allLogs ? allLogs.innerText : "";
          window.api.devSaveLog({ category: "publish", modName, content: logText }).catch(() => {
          });
        }, 500);
      }
    }, taskId);
    cleanupRef.current = () => {
      cleanupProgress?.();
      cleanupDone?.();
    };
  }
  async function handleSupplementLink(providers = ["baidu", "quark"]) {
    await window.api.devSavePublishConfig(devConfig);
    persistPublishPrefs();
    const taskId = preparePublishRun();
    setPhase("publishing");
    setLogs([]);
    setProgressStep(0);
    setProgressMessage("补链接启动中...");
    attachPublishListeners(taskId, "补链接成功！");
    const result = await window.api.devPublishMod({
      mode: "supplement-link",
      taskId,
      modFolder: modFolderPath,
      charName: characterName,
      modName,
      gameId: gameId || "endfield",
      modMode,
      author: author.trim(),
      sourceUrl: sourceUrl.trim(),
      providers: providers.join(","),
      pythonPath: devConfig.pythonPath,
      scriptPath: devConfig.scriptPath
    });
    if (!result.success) {
      addLog(`❌ 启动失败: ${result.error}`, "error");
      setResultMessage(result.error);
      setPhase("error");
      cleanupRef.current?.();
      cleanupRef.current = null;
    }
  }
  async function handlePublish() {
    await window.api.devSavePublishConfig(devConfig);
    persistPublishPrefs();
    const taskId = preparePublishRun();
    setPhase("publishing");
    setLogs([]);
    setProgressStep(0);
    setProgressMessage("启动中...");
    setResultLinks({});
    attachPublishListeners(taskId, "发布成功！", true);
    const result = await window.api.devPublishMod({
      modFolder: modFolderPath,
      taskId,
      charName: characterName,
      modName,
      version: gameVersion || version,
      gameVersion: gameVersion || version,
      gameId: gameId || "endfield",
      modMode,
      description,
      author: author.trim(),
      sourceUrl: sourceUrl.trim(),
      isNsfw,
      useAdultImageHost,
      tagIds: selectedTags,
      pythonPath: devConfig.pythonPath,
      winrarPath: devConfig.winrarPath,
      scriptPath: devConfig.scriptPath
    });
    if (!result.success) {
      addLog(`❌ 启动失败: ${result.error}`, "error");
      setResultMessage(result.error);
      setPhase("error");
      cleanupRef.current?.();
      cleanupRef.current = null;
    }
  }
  async function handleRetryR2() {
    const modId = resultLinks.modId || "";
    const previousTaskId = taskIdRef.current;
    if (phase === "publishing" && previousTaskId) {
      await window.api.devCancelPublish?.({ taskId: previousTaskId }).catch(() => {
      });
      addLog("⏹️ 已请求停止当前发布进程，准备只重传 R2", "warn");
    }
    await window.api.devSavePublishConfig(devConfig);
    persistPublishPrefs();
    const taskId = preparePublishRun();
    setPhase("publishing");
    setLogs([]);
    setProgressStep(0);
    setProgressMessage("R2 重传启动中...");
    setResultMessage("");
    setResultLinks((prev) => ({ ...prev, modId }));
    attachPublishListeners(taskId, "R2 重传成功！", true);
    const result = await window.api.devPublishMod({
      mode: "retry-r2",
      taskId,
      modFolder: modFolderPath,
      charName: characterName,
      modName,
      modId,
      quarkLink: resultLinks.quark || "",
      baiduLink: resultLinks.baidu || "",
      gameId: gameId || "endfield",
      modMode,
      author: author.trim(),
      sourceUrl: sourceUrl.trim(),
      tagIds: selectedTags,
      pythonPath: devConfig.pythonPath,
      winrarPath: devConfig.winrarPath,
      scriptPath: devConfig.scriptPath
    });
    if (!result.success) {
      addLog(`❌ 启动失败: ${result.error}`, "error");
      setResultMessage(result.error);
      setPhase("error");
      cleanupRef.current?.();
      cleanupRef.current = null;
    }
  }
  const logColor = { info: "#d1d5db", warn: "#fbbf24", error: "#f87171", progress: "#818cf8" };
  if (!visible) return null;
  return ReactDOM.createPortal(
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "div",
      {
        style: { position: "fixed", inset: 0, zIndex: 10003, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" },
        onClick: handleRequestClose,
        children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "div",
          {
            style: { background: "#fff", borderRadius: "14px", maxWidth: "600px", width: "95vw", maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" },
            onClick: (e) => e.stopPropagation(),
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { padding: "16px 20px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between", background: "linear-gradient(135deg, rgba(99,102,241,0.06), rgba(245,158,11,0.06))" }, children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontWeight: 700, fontSize: "15px", color: "#1f2937" }, children: phase === "form" ? "📤 发布 Mod 到市场" : phase === "publishing" ? "⏳ 发布中..." : phase === "done" ? "✅ 发布成功！" : "❌ 发布失败" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { fontSize: "12px", color: "#9ca3af", marginTop: "2px" }, children: [
                    characterName,
                    " · ",
                    modName
                  ] })
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: handleRequestClose, style: { background: "none", border: "none", cursor: "pointer", fontSize: "18px", color: "#9ca3af" }, children: "✕" })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { flex: 1, overflowY: "auto", padding: "18px 20px" }, children: [
                phase === "form" && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", gap: "14px", marginBottom: "18px" }, children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { width: "90px", height: "120px", flexShrink: 0, borderRadius: "8px", overflow: "hidden", background: "#f9fafb", border: "1px solid #e5e7eb" }, children: previewDataUrl ? /* @__PURE__ */ jsxRuntimeExports.jsx("img", { src: previewDataUrl, alt: "", style: { width: "100%", height: "100%", objectFit: "cover" } }) : /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#d1d5db", fontSize: "28px" }, children: "🖼️" }) }),
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { flex: 1 }, children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { marginBottom: "10px" }, children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx("label", { style: { fontSize: "11px", color: "#9ca3af", display: "block", marginBottom: "4px" }, children: "游戏版本" }),
                        gameVersions.length > 0 ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "4px" }, children: gameVersions.map((gv) => /* @__PURE__ */ jsxRuntimeExports.jsx(
                          "button",
                          {
                            onClick: () => selectGameVersion(gv.version),
                            style: { padding: "2px 10px", fontSize: "11px", borderRadius: "10px", cursor: "pointer", border: gameVersion === gv.version ? "none" : "1px solid #e5e7eb", background: gameVersion === gv.version ? "#6366f1" : "#fff", color: gameVersion === gv.version ? "#fff" : "#6b7280" },
                            children: gv.version
                          },
                          gv.id
                        )) }) : /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { display: "flex", gap: "4px", marginBottom: "4px" }, children: ["v1.0", "v1.1", "v1.2", "v2.0"].map((v) => /* @__PURE__ */ jsxRuntimeExports.jsx(
                          "button",
                          {
                            onClick: () => selectGameVersion(v),
                            style: { padding: "2px 8px", fontSize: "11px", borderRadius: "10px", cursor: "pointer", border: version === v ? "none" : "1px solid #e5e7eb", background: version === v ? "#6366f1" : "#fff", color: version === v ? "#fff" : "#6b7280" },
                            children: v
                          },
                          v
                        )) }),
                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                          "input",
                          {
                            type: "text",
                            value: gameVersion || version,
                            onChange: (e) => selectGameVersion(e.target.value),
                            placeholder: "自定义版本号",
                            style: { width: "100%", padding: "5px 8px", fontSize: "12px", border: "1px solid #e5e7eb", borderRadius: "6px", outline: "none", boxSizing: "border-box" }
                          }
                        )
                      ] }),
                      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { marginBottom: "10px" }, children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx("label", { style: { fontSize: "11px", color: "#9ca3af", display: "block", marginBottom: "4px" }, children: "Mod 模式" }),
                        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { display: "flex", gap: "6px" }, children: [
                          { value: "d3d", label: "3dm" },
                          { value: "pak", label: "Pak" }
                        ].map((item) => /* @__PURE__ */ jsxRuntimeExports.jsx(
                          "button",
                          {
                            onClick: () => {
                              setModMode(item.value);
                              setUserDirty(true);
                            },
                            style: { padding: "3px 10px", fontSize: "11px", borderRadius: "10px", cursor: "pointer", border: modMode === item.value ? "none" : "1px solid #e5e7eb", background: modMode === item.value ? item.value === "pak" ? "#dc2626" : "#6366f1" : "#fff", color: modMode === item.value ? "#fff" : "#6b7280" },
                            children: item.label
                          },
                          item.value
                        )) })
                      ] }),
                      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx("label", { style: { fontSize: "11px", color: "#9ca3af", display: "block", marginBottom: "4px" }, children: "描述（可选）" }),
                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                          "textarea",
                          {
                            value: description,
                            onChange: (e) => {
                              setDescription(e.target.value);
                              setUserDirty(true);
                            },
                            placeholder: `${characterName} - ${modName}`,
                            rows: 2,
                            style: { width: "100%", padding: "5px 8px", fontSize: "12px", border: "1px solid #e5e7eb", borderRadius: "6px", outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }
                          }
                        )
                      ] }),
                      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: "8px", marginTop: "10px" }, children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                          /* @__PURE__ */ jsxRuntimeExports.jsx("label", { style: { fontSize: "11px", color: "#9ca3af", display: "block", marginBottom: "4px" }, children: "作者（可选）" }),
                          /* @__PURE__ */ jsxRuntimeExports.jsx(
                            "input",
                            {
                              type: "text",
                              value: author,
                              list: authorDatalistId,
                              onChange: (e) => handleAuthorChange(e.target.value),
                              placeholder: "作者名",
                              style: { width: "100%", padding: "5px 8px", fontSize: "12px", border: "1px solid #e5e7eb", borderRadius: "6px", outline: "none", boxSizing: "border-box" }
                            }
                          ),
                          /* @__PURE__ */ jsxRuntimeExports.jsx("datalist", { id: authorDatalistId, children: publishPrefs.authors.map((item) => /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: item.name }, item.name)) })
                        ] }),
                        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                          /* @__PURE__ */ jsxRuntimeExports.jsx("label", { style: { fontSize: "11px", color: "#9ca3af", display: "block", marginBottom: "4px" }, children: "原址（可选）" }),
                          /* @__PURE__ */ jsxRuntimeExports.jsx(
                            "input",
                            {
                              type: "url",
                              value: sourceUrl,
                              list: sourceDatalistId,
                              onChange: (e) => handleSourceUrlChange(e.target.value),
                              placeholder: "https://...",
                              style: { width: "100%", padding: "5px 8px", fontSize: "12px", border: "1px solid #e5e7eb", borderRadius: "6px", outline: "none", boxSizing: "border-box" }
                            }
                          ),
                          /* @__PURE__ */ jsxRuntimeExports.jsx("datalist", { id: sourceDatalistId, children: sourceOptions.map((item) => /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: item.url, label: item.author ? item.author : void 0 }, item.url)) })
                        ] })
                      ] })
                    ] })
                  ] }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { marginBottom: "14px" }, children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { style: { fontSize: "11px", color: "#9ca3af", display: "block", marginBottom: "6px" }, children: [
                      "标签",
                      localTags.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { marginLeft: "6px", fontSize: "10px", color: "#6366f1" }, children: [
                        "(已从本地 tags.json 预选 ",
                        localTags.length,
                        " 个)"
                      ] }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: loadTagsAndLocalTags, style: { marginLeft: "6px", fontSize: "10px", background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }, children: "↺ 刷新" })
                    ] }),
                    tagsLoading ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontSize: "11px", color: "#9ca3af" }, children: "正在连接标签服务器..." }) : tagsError ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", color: "#ef4444" }, children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: tagsError }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: loadTagsAndLocalTags, style: { padding: 0, border: "none", background: "none", color: "#6366f1", cursor: "pointer", fontSize: "11px" }, children: "重试" })
                    ] }) : availableTags.length === 0 ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontSize: "11px", color: "#9ca3af" }, children: "服务器暂无标签" }) : /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { display: "flex", flexWrap: "wrap", gap: "5px" }, children: availableTags.map((tag) => {
                      const sel = selectedTags.includes(tag.id || tag.name);
                      return /* @__PURE__ */ jsxRuntimeExports.jsxs(
                        "button",
                        {
                          onClick: () => toggleTag(tag.id || tag.name),
                          style: { padding: "3px 10px", fontSize: "11px", borderRadius: "10px", cursor: "pointer", border: sel ? "none" : "1px solid #e5e7eb", background: sel ? tag.color || "#6366f1" : "#fff", color: sel ? "#fff" : "#6b7280", transition: "all 0.15s" },
                          children: [
                            sel ? "✓ " : "",
                            tag.name
                          ]
                        },
                        tag.id || tag.name
                      );
                    }) })
                  ] }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { style: { display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", userSelect: "none", marginBottom: "16px" }, children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx(
                      "div",
                      {
                        onClick: () => {
                          setIsNsfw(!isNsfw);
                          setUserDirty(true);
                        },
                        style: { width: 34, height: 18, borderRadius: 9, cursor: "pointer", background: isNsfw ? "#ef4444" : "#d1d5db", position: "relative", transition: "background 0.2s", flexShrink: 0 },
                        children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { position: "absolute", top: 2, left: isNsfw ? 18 : 2, width: 14, height: 14, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" } })
                      }
                    ),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontSize: "12px", color: isNsfw ? "#ef4444" : "#6b7280" }, children: "🔞 仅限 18+ (NSFW)" })
                  ] }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { style: { display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", userSelect: "none", marginBottom: "16px" }, children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx(
                      "div",
                      {
                        onClick: () => {
                          setUseAdultImageHost(!useAdultImageHost);
                          setUserDirty(true);
                        },
                        style: { width: 34, height: 18, borderRadius: 9, cursor: "pointer", background: useAdultImageHost ? "#ef4444" : "#d1d5db", position: "relative", transition: "background 0.2s", flexShrink: 0 },
                        children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { position: "absolute", top: 2, left: useAdultImageHost ? 18 : 2, width: 14, height: 14, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" } })
                      }
                    ),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontSize: "12px", color: useAdultImageHost ? "#ef4444" : "#6b7280" }, children: "18+图" })
                  ] }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { borderTop: "1px solid #f3f4f6", paddingTop: "10px" }, children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsxs(
                      "button",
                      {
                        onClick: () => setShowDevConfig(!showDevConfig),
                        style: { background: "none", border: "none", cursor: "pointer", fontSize: "11px", color: "#9ca3af", padding: 0 },
                        children: [
                          showDevConfig ? "▼" : "▶",
                          " 开发者设置"
                        ]
                      }
                    ),
                    showDevConfig && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { marginTop: "10px", display: "flex", flexDirection: "column", gap: "8px" }, children: [
                      { key: "pythonPath", label: "Python", placeholder: "python" },
                      { key: "winrarPath", label: "WinRAR", placeholder: "C:\\Program Files\\WinRAR\\WinRAR.exe" },
                      { key: "scriptPath", label: "脚本", placeholder: "publish_mod_cli.py 路径" }
                    ].map(({ key, label, placeholder }) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", alignItems: "center", gap: "6px" }, children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontSize: "10px", color: "#9ca3af", width: "40px", flexShrink: 0 }, children: label }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        "input",
                        {
                          type: "text",
                          value: devConfig[key] || "",
                          onChange: (e) => setDevConfig((prev) => ({ ...prev, [key]: e.target.value })),
                          placeholder,
                          style: { flex: 1, padding: "4px 6px", fontSize: "10px", border: "1px solid #e5e7eb", borderRadius: "4px", outline: "none", fontFamily: "monospace" }
                        }
                      ),
                      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: async () => {
                        const r = await window.api.selectFile({ title: `选择 ${label}`, filters: [{ name: "All", extensions: ["*"] }] });
                        if (r?.filePath) setDevConfig((prev) => ({ ...prev, [key]: r.filePath }));
                      }, style: { padding: "4px 8px", fontSize: "10px", border: "1px solid #e5e7eb", borderRadius: "4px", background: "#fff", cursor: "pointer" }, children: "..." })
                    ] }, key)) })
                  ] })
                ] }),
                (phase === "publishing" || phase === "done" || phase === "error") && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                  phase === "publishing" && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { marginBottom: "14px" }, children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#9ca3af", marginBottom: "4px" }, children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: progressMessage }),
                      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
                        progressStep,
                        "/",
                        progressTotal
                      ] })
                    ] }),
                    uploadMetrics?.speed && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#6366f1", marginBottom: "6px" }, children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
                        "R2 上传速度: ",
                        uploadMetrics.speed
                      ] }),
                      uploadMetrics.percent && /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
                        uploadMetrics.percent,
                        "% · ",
                        uploadMetrics.transferred,
                        "/",
                        uploadMetrics.total
                      ] })
                    ] }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { height: "5px", borderRadius: "3px", background: "#f3f4f6", overflow: "hidden" }, children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { height: "100%", borderRadius: "3px", background: "linear-gradient(90deg, #6366f1, #f59e0b)", width: `${progressTotal > 0 ? progressStep / progressTotal * 100 : 0}%`, transition: "width 0.4s" } }) }),
                    resultLinks.modId && progressStep >= 4 && /* @__PURE__ */ jsxRuntimeExports.jsx(
                      "button",
                      {
                        onClick: handleRetryR2,
                        style: { marginTop: "10px", padding: "6px 12px", border: "1px solid #f59e0b", borderRadius: "8px", background: "#fff7ed", color: "#c2410c", cursor: "pointer", fontSize: "12px", fontWeight: 700 },
                        children: "⏹️ 停止当前上传并只重传 R2"
                      }
                    )
                  ] }),
                  phase === "done" && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { padding: "10px 14px", borderRadius: "8px", background: "rgba(34,197,94,0.08)", border: "1px solid #22c55e", marginBottom: "10px", fontSize: "12px", color: "#16a34a", fontWeight: 600 }, children: [
                    resultMessage,
                    resultLinks.modId && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { fontWeight: 400, marginTop: "3px" }, children: [
                      "市场 ID: ",
                      resultLinks.modId
                    ] }),
                    resultLinks.quark && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontWeight: 400, marginTop: "3px", color: "#c2410c" }, children: "夸克链接已记录" }),
                    resultLinks.baidu && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontWeight: 400, marginTop: "3px", color: "#2563eb" }, children: "百度链接已记录" }),
                    uploadMetrics?.speed && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { fontWeight: 400, marginTop: "3px", color: "#4f46e5" }, children: [
                      "R2 速度: ",
                      uploadMetrics.speed
                    ] })
                  ] }),
                  phase === "error" && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { padding: "10px 14px", borderRadius: "8px", background: "rgba(239,68,68,0.08)", border: "1px solid #ef4444", marginBottom: "10px", fontSize: "12px", color: "#ef4444", userSelect: "text", cursor: "text", display: "flex", alignItems: "flex-start", gap: "8px" }, children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { flex: 1 }, children: [
                      "❌ ",
                      resultMessage
                    ] }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx(
                      "button",
                      {
                        onClick: () => {
                          navigator.clipboard.writeText(resultMessage + "\n\n" + logs.map((l) => l.message).join("\n"));
                        },
                        style: { flexShrink: 0, padding: "2px 8px", fontSize: "10px", border: "1px solid #ef4444", borderRadius: "4px", background: "transparent", color: "#ef4444", cursor: "pointer" },
                        children: "复制日志"
                      }
                    )
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
                    !logsCollapsed && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { "data-log-content": true, style: { background: "#111827", borderRadius: "8px", padding: "10px", maxHeight: "200px", overflowY: "auto", fontFamily: "monospace", fontSize: "10px", userSelect: "text", cursor: "text" }, children: [
                      logs.map((log, i) => /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { color: logColor[log.level] || "#d1d5db", lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }, children: log.message }, i)),
                      phase === "publishing" && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { color: "#818cf8" }, children: "▋" }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { ref: logEndRef })
                    ] })
                  ] })
                ] })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { padding: "14px 20px", borderTop: "1px solid #f3f4f6", display: "flex", gap: "8px", justifyContent: "flex-end", flexWrap: "wrap" }, children: [
                phase === "form" && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: handleRequestClose, style: { padding: "7px 16px", border: "1px solid #e5e7eb", borderRadius: "8px", background: "#fff", cursor: "pointer", fontSize: "13px", color: "#6b7280" }, children: "取消" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: () => handleSupplementLink(["baidu"]), style: { padding: "7px 12px", border: "1px solid #dbeafe", borderRadius: "8px", cursor: "pointer", fontSize: "12px", color: "#2563eb", background: "#eff6ff", fontWeight: 700 }, children: "补百度" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: () => handleSupplementLink(["quark"]), style: { padding: "7px 12px", border: "1px solid #fed7aa", borderRadius: "8px", cursor: "pointer", fontSize: "12px", color: "#c2410c", background: "#fff7ed", fontWeight: 700 }, children: "补夸克" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: handleRetryR2, style: { padding: "7px 12px", border: "1px solid #fde68a", borderRadius: "8px", cursor: "pointer", fontSize: "12px", color: "#a16207", background: "#fefce8", fontWeight: 700 }, children: "补R2" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: () => handleSupplementLink(["baidu", "quark"]), style: { padding: "7px 12px", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "12px", color: "#fff", background: "linear-gradient(135deg, #dc2626, #f97316)", fontWeight: 700 }, children: "补百度+夸克" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: handlePublish, style: { padding: "7px 20px", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "13px", color: "#fff", background: "linear-gradient(135deg, #6366f1, #f59e0b)", fontWeight: 600 }, children: "🚀 发布" })
                ] }),
                phase === "publishing" && /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: handleRequestClose, style: { padding: "7px 16px", border: "1px solid #e5e7eb", borderRadius: "8px", background: "#fff", cursor: "pointer", fontSize: "13px", color: "#6b7280" }, children: "最小化" }),
                (phase === "done" || phase === "error") && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: () => window.api.devOpenLogsFolder(), style: { padding: "7px 14px", border: "1px solid #e5e7eb", borderRadius: "8px", background: "#fff", cursor: "pointer", fontSize: "12px", color: "#9ca3af" }, children: "📂 日志" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: handleRetryR2, style: { padding: "7px 16px", border: "1px solid #f59e0b", borderRadius: "8px", background: "#fff7ed", cursor: "pointer", fontSize: "13px", color: "#c2410c", fontWeight: 700 }, children: "♻️ 只重传 R2" }),
                  phase === "error" && /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: () => {
                    setPhase("form");
                    setLogs([]);
                  }, style: { padding: "7px 16px", border: "1px solid #e5e7eb", borderRadius: "8px", background: "#fff", cursor: "pointer", fontSize: "13px", color: "#6b7280" }, children: "重试" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: onClose, style: { padding: "7px 20px", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "13px", color: "#fff", background: "#6366f1" }, children: "完成" })
                ] })
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
  PublishModDialog as default
};
