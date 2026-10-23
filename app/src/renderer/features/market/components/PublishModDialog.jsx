import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
import { fetchWithDirectFallback } from "../../../lib/marketApi.js";
import ReactDOM from "react-dom";
const SERVER_URL_DEFAULT = "https://qaqm.top";
const PUBLISH_PREFS_PREFIX = "qaqm-dev-publish-prefs";
const MAX_AUTHOR_PREFS = 30;
const MAX_SOURCE_PREFS = 80;
const MAX_AUTHOR_SOURCE_PREFS = 20;
function getDefaultDescription() {
  return t("market.publish.encryptedFileHint");
}
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
  const recent = (prefs.recentSources || []).find(
    (item) =>
      normalizeSourceUrl(item.url) === normalized && cleanText(item.author),
  );
  if (recent) return cleanText(recent.author);
  const author = (prefs.authors || []).find((item) =>
    (item.sources || []).some((url) => normalizeSourceUrl(url) === normalized),
  );
  return author?.name || "";
}
function normalizePublishPrefs(raw = {}) {
  const authors = [];
  const authorKeys = new Set();
  for (const item of Array.isArray(raw.authors) ? raw.authors : []) {
    const name = cleanText(item?.name);
    if (!name) continue;
    const key = name.toLowerCase();
    if (authorKeys.has(key)) continue;
    authorKeys.add(key);
    const sources = [];
    const sourceKeys = new Set();
    for (const url of Array.isArray(item?.sources) ? item.sources : []) {
      const normalized = normalizeSourceUrl(url);
      if (!normalized || sourceKeys.has(normalized)) continue;
      sourceKeys.add(normalized);
      sources.push(normalized);
      if (sources.length >= MAX_AUTHOR_SOURCE_PREFS) break;
    }
    authors.push({
      name,
      sources,
    });
    if (authors.length >= MAX_AUTHOR_PREFS) break;
  }
  const recentSources = [];
  const recentSourceKeys = new Set();
  for (const item of Array.isArray(raw.recentSources)
    ? raw.recentSources
    : []) {
    const url = normalizeSourceUrl(item?.url || item);
    if (!url || recentSourceKeys.has(url)) continue;
    recentSourceKeys.add(url);
    recentSources.push({
      url,
      author: cleanText(item?.author),
      updatedAt: Number(item?.updatedAt) || 0,
    });
    if (recentSources.length >= MAX_SOURCE_PREFS) break;
  }
  return {
    lastGameVersion: cleanText(raw.lastGameVersion),
    authors,
    recentSources,
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
    window.localStorage.setItem(
      getPublishPrefsKey(gameId),
      JSON.stringify(normalizePublishPrefs(prefs)),
    );
  } catch (_) {}
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
    const existingIndex = next.authors.findIndex(
      (item) => item.name.toLowerCase() === authorKey,
    );
    if (existingIndex >= 0) {
      authorEntry = {
        ...next.authors[existingIndex],
        name: selectedAuthor,
      };
      next.authors.splice(existingIndex, 1);
    } else {
      authorEntry = {
        name: selectedAuthor,
        sources: [],
      };
    }
    next.authors.unshift(authorEntry);
  }
  if (selectedSource) {
    if (authorEntry) {
      authorEntry.sources = [
        selectedSource,
        ...(authorEntry.sources || []).filter(
          (url) => normalizeSourceUrl(url) !== selectedSource,
        ),
      ].slice(0, MAX_AUTHOR_SOURCE_PREFS);
    }
    next.recentSources = [
      {
        url: selectedSource,
        author:
          selectedAuthor || findMappedAuthorBySource(next, selectedSource),
        updatedAt: Date.now(),
      },
      ...next.recentSources.filter(
        (item) => normalizeSourceUrl(item.url) !== selectedSource,
      ),
    ].slice(0, MAX_SOURCE_PREFS);
  }
  next.authors = next.authors.slice(0, MAX_AUTHOR_PREFS);
  return normalizePublishPrefs(next);
}
function getSourceOptions(prefs, selectedAuthor) {
  const options = [];
  const seen = new Set();
  const selectedAuthorKey = cleanText(selectedAuthor).toLowerCase();
  const add = (url, author) => {
    const normalized = normalizeSourceUrl(url);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    options.push({
      url: normalized,
      author: cleanText(author),
    });
  };
  if (selectedAuthorKey) {
    const authorEntry = (prefs.authors || []).find(
      (item) => item.name.toLowerCase() === selectedAuthorKey,
    );
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
  const progress = text.match(
    /(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?\s*(?:B|KB|MB|GB))\/(\d+(?:\.\d+)?\s*(?:B|KB|MB|GB))/i,
  );
  if (!speed && !progress) return null;
  return {
    provider: "R2",
    speed,
    percent: progress ? progress[1] : "",
    transferred: progress ? progress[2] : "",
    total: progress ? progress[3] : "",
  };
}
function PublishModDialog({
  characterName,
  modName,
  modFolderPath,
  gameId,
  initialModMode,
  visible = true,
  onClose,
  onMinimize,
  onStateChange,
}) {
  const effectiveGameId = gameId || "endfield";
  const initialPublishPrefsRef = React.useRef(null);
  if (!initialPublishPrefsRef.current)
    initialPublishPrefsRef.current = readPublishPrefs(effectiveGameId);
  const [publishPrefs, setPublishPrefs] = React.useState(
    initialPublishPrefsRef.current,
  );
  const [version, setVersion] = React.useState(
    initialPublishPrefsRef.current.lastGameVersion || "1.0",
  );
  const [gameVersion, setGameVersion] = React.useState(
    initialPublishPrefsRef.current.lastGameVersion || "",
  );
  const [gameVersions, setGameVersions] = React.useState([]);
  const [modMode, setModMode] = React.useState(
    initialModMode === "pak" ? "pak" : "d3d",
  );
  const [description, setDescription] = React.useState(getDefaultDescription());
  const [author, setAuthor] = React.useState("");
  const [sourceUrl, setSourceUrl] = React.useState("");
  const [isNsfw, setIsNsfw] = React.useState(false);
  const [useAdultImageHost, setUseAdultImageHost] = React.useState(true);
  const [selectedTags, setSelectedTags] = React.useState([]);
  const [userDirty, setUserDirty] = React.useState(false);
  const [availableTags, setAvailableTags] = React.useState([]);
  const [tagsLoading, setTagsLoading] = React.useState(true);
  const [tagsError, setTagsError] = React.useState("");
  const [previewDataUrl, setPreviewDataUrl] = React.useState(null);
  const [localTags, setLocalTags] = React.useState([]);
  const [devConfig, setDevConfig] = React.useState({
    pythonPath: "python",
    winrarPath: "C:\\Program Files\\WinRAR\\WinRAR.exe",
    scriptPath: "",
  });
  const [showDevConfig, setShowDevConfig] = React.useState(false);
  const [phase, setPhase] = React.useState("form");
  const [progressStep, setProgressStep] = React.useState(0);
  const [progressTotal, setProgressTotal] = React.useState(5);
  const [progressMessage, setProgressMessage] = React.useState("");
  const [logs, setLogs] = React.useState([]);
  const [logsCollapsed, setLogsCollapsed] = React.useState(false);
  const [resultMessage, setResultMessage] = React.useState("");
  const [resultLinks, setResultLinks] = React.useState({});
  const [uploadMetrics, setUploadMetrics] = React.useState(null);
  const logEndRef = React.useRef(null);
  const cleanupRef = React.useRef(null);
  const taskIdRef = React.useRef(createPublishTaskId());
  const onStateChangeRef = React.useRef(onStateChange);
  const authorDatalistId = `publish-author-options-${getDatalistSuffix(effectiveGameId)}`;
  const sourceDatalistId = `publish-source-options-${getDatalistSuffix(effectiveGameId)}`;
  const sourceOptions = getSourceOptions(publishPrefs, author);
  React.useEffect(() => {
    onStateChangeRef.current = onStateChange;
  }, [onStateChange]);
  React.useEffect(() => {
    const prefs = readPublishPrefs(effectiveGameId);
    setPublishPrefs(prefs);
    setVersion(prefs.lastGameVersion || "1.0");
    setGameVersion(prefs.lastGameVersion || "");
  }, [effectiveGameId]);
  React.useEffect(() => {
    loadTagsAndLocalTags();
    loadDevConfig();
    loadPreview();
    loadGameVersions();
    return () => {
      if (cleanupRef.current) cleanupRef.current();
    };
  }, []);
  React.useEffect(() => {
    if (logEndRef.current)
      logEndRef.current.scrollIntoView({
        behavior: "smooth",
      });
  }, [logs]);
  React.useEffect(() => {
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
      taskId: taskIdRef.current,
    });
  }, [
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
  ]);
  async function loadPreview() {
    try {
      const r = await window.api.devGetModPreview(modFolderPath);
      if (r.success && r.previewDataUrl) setPreviewDataUrl(r.previewDataUrl);
    } catch (_) {}
  }
  async function loadTagsAndLocalTags() {
    setTagsLoading(true);
    setTagsError("");
    try {
      let localTagNames = [];
      try {
        const r = await window.api.devGetModTags(modFolderPath);
        const raw = r?.tags || [];
        localTagNames = raw
          .map((t) => (typeof t === "string" ? t : t?.name || ""))
          .filter(Boolean);
        setLocalTags(localTagNames);
      } catch (_) {}
      const config = await window.api.getConfig();
      const serverUrl = (
        config?.config?.serverUrl || SERVER_URL_DEFAULT
      ).replace(/\/$/, "");
      const { response: resp } = await fetchWithDirectFallback(
        serverUrl,
        "/api/games/tags",
        {
          expectJson: true,
          timeoutMs: 4e3,
        },
      );
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      let tags = [];
      if (data.success) tags = data.tags || [];
      else if (Array.isArray(data)) tags = data;
      else if (data.tags) tags = data.tags;
      setAvailableTags(tags);
      if (localTagNames.length > 0 && tags.length > 0) {
        const matched = tags
          .filter(
            (t) =>
              localTagNames.includes(t.name) || localTagNames.includes(t.id),
          )
          .map((t) => t.id || t.name);
        setSelectedTags(matched);
      }
    } catch (e) {
      setTagsError(
        t("market.publish.loadTagsFailed", {
          message: e.message,
        }),
      );
    } finally {
      setTagsLoading(false);
    }
  }
  async function loadGameVersions() {
    try {
      const config = await window.api.getConfig();
      const serverUrl = (
        config?.config?.serverUrl || SERVER_URL_DEFAULT
      ).replace(/\/$/, "");
      const { response: resp } = await fetchWithDirectFallback(
        serverUrl,
        "/api/mods/game-versions",
        {
          expectJson: true,
          timeoutMs: 4e3,
        },
      );
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
    } catch (_) {}
  }
  async function loadDevConfig() {
    try {
      const r = await window.api.devGetPublishConfig();
      if (r.success && r.config)
        setDevConfig((prev) => ({
          ...prev,
          ...r.config,
        }));
    } catch (_) {}
  }
  function persistPublishPrefs(updates = {}) {
    const next = mergePublishPrefs(readPublishPrefs(effectiveGameId), {
      gameVersion: updates.gameVersion ?? (gameVersion || version),
      author: updates.author ?? author,
      sourceUrl: updates.sourceUrl ?? sourceUrl,
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
    if (selectedVersion)
      persistPublishPrefs({
        gameVersion: selectedVersion,
        author: "",
        sourceUrl: "",
      });
  }
  function handleAuthorChange(nextAuthor) {
    setAuthor(nextAuthor);
    setUserDirty(true);
  }
  function handleSourceUrlChange(nextSourceUrl) {
    setSourceUrl(nextSourceUrl);
    if (!cleanText(author)) {
      const mappedAuthor = findMappedAuthorBySource(
        publishPrefs,
        nextSourceUrl,
      );
      if (mappedAuthor) setAuthor(mappedAuthor);
    }
    setUserDirty(true);
  }
  function toggleTag(tagId) {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId],
    );
    setUserDirty(true);
  }
  function handleRequestClose() {
    if (phase === "publishing") {
      onMinimize?.();
      return;
    }
    if (phase === "form" && userDirty) {
      const ok = window.confirm(t("market.publish.confirmDiscard"));
      if (!ok) return;
    }
    onClose?.();
  }
  function addLog(message, level = "info") {
    setLogs((prev) => [
      ...prev,
      {
        message,
        level,
        ts: Date.now(),
      },
    ]);
  }
  function preparePublishRun() {
    cleanupRef.current?.();
    cleanupRef.current = null;
    taskIdRef.current = createPublishTaskId();
    setUploadMetrics(null);
    return taskIdRef.current;
  }
  function captureModId(message) {
    const match = String(message || "").match(
      /(?:市场发布成功!\s*ID\s*=|市场 ID\s*=\s*|市场 ID:\s*|ID\s*=\s*)(\d+)/,
    );
    if (match) {
      setResultLinks((prev) => ({
        ...prev,
        modId: Number(match[1]),
      }));
    }
  }
  function captureCloudLinks(message) {
    const text = String(message || "");
    const quark = text.match(/夸克[:：]\s*(https?:\/\/\S+)/)?.[1];
    const baidu = text.match(/百度[:：]\s*(https?:\/\/\S+)/)?.[1];
    if (quark || baidu) {
      setResultLinks((prev) => ({
        ...prev,
        ...(quark
          ? {
              quark,
            }
          : {}),
        ...(baidu
          ? {
              baidu,
            }
          : {}),
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
      if (metrics)
        setUploadMetrics((prev) => ({
          ...(prev || {}),
          ...metrics,
        }));
      addLog(msg.message, msg.level || "info");
    } else if (msg.type === "success") {
      setResultMessage(msg.message || successFallback);
      setResultLinks((prev) => ({
        ...prev,
        baidu: msg.baiduLink || prev.baidu,
        quark: msg.quarkLink || prev.quark,
        modId: msg.modId || prev.modId,
        directInstall: msg.directInstall ?? prev.directInstall,
        cdnObjectKey: msg.cdnObjectKey || prev.cdnObjectKey,
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
            setResultMessage(
              t("market.cloud.processExited", {
                exitCode,
              }),
            );
            return "error";
          }
          return prev;
        });
      }
      if (saveLog) {
        setTimeout(() => {
          const allLogs = document.querySelector("[data-log-content]");
          const logText = allLogs ? allLogs.innerText : "";
          window.api
            .devSaveLog({
              category: "publish",
              modName,
              content: logText,
            })
            .catch(() => {});
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
    setProgressMessage(t("market.publish.repairingLinks"));
    attachPublishListeners(taskId, t("market.publish.linksRepaired"));
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
      scriptPath: devConfig.scriptPath,
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
    setProgressMessage(t("games.launch.launching"));
    setResultLinks({});
    attachPublishListeners(taskId, t("market.publish.success"), true);
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
      scriptPath: devConfig.scriptPath,
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
      await window.api
        .devCancelPublish?.({
          taskId: previousTaskId,
        })
        .catch(() => {});
      addLog("⏹️ 已请求停止当前发布进程，准备只重传 R2", "warn");
    }
    await window.api.devSavePublishConfig(devConfig);
    persistPublishPrefs();
    const taskId = preparePublishRun();
    setPhase("publishing");
    setLogs([]);
    setProgressStep(0);
    setProgressMessage(t("market.publish.retryingR2"));
    setResultMessage("");
    setResultLinks((prev) => ({
      ...prev,
      modId,
    }));
    attachPublishListeners(taskId, t("market.publish.r2Retried"), true);
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
      scriptPath: devConfig.scriptPath,
    });
    if (!result.success) {
      addLog(`❌ 启动失败: ${result.error}`, "error");
      setResultMessage(result.error);
      setPhase("error");
      cleanupRef.current?.();
      cleanupRef.current = null;
    }
  }
  const logColor = {
    info: "#d1d5db",
    warn: "#fbbf24",
    error: "#f87171",
    progress: "#818cf8",
  };
  if (!visible) return null;
  return ReactDOM.createPortal(
    <div
      onClick={handleRequestClose}
      className="publish-mod-dialog-request-close-action"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="publish-mod-dialog-stack"
      >
        <div className="publish-mod-dialog-row">
          <div>
            <div className="publish-mod-dialog-heading">
              {phase === "form"
                ? t("market.publish.title")
                : phase === "publishing"
                  ? t("market.publish.publishing")
                  : phase === "done"
                    ? t("market.publish.success")
                    : t("market.publish.failed")}
            </div>
            <div className="publish-mod-dialog-hint">
              {characterName}
              {" · "}
              {modName}
            </div>
          </div>
          <button
            onClick={handleRequestClose}
            className="publish-mod-dialog-close-icon"
          >
            {"✕"}
          </button>
        </div>
        <div className="publish-mod-dialog-content">
          {phase === "form" && (
            <div>
              <div className="publish-mod-dialog-preview-and-options">
                <div className="publish-mod-dialog-preview-frame">
                  {previewDataUrl ? (
                    <img
                      src={previewDataUrl}
                      alt=""
                      className="publish-mod-dialog-preview-image"
                    />
                  ) : (
                    <div className="publish-mod-dialog-preview-placeholder">
                      {"🖼️"}
                    </div>
                  )}
                </div>
                <div className="publish-mod-dialog-flex-content">
                  <div className="publish-mod-dialog-option-field">
                    <label className="publish-mod-dialog-field-label">
                      {t("market.publish.gameVersion")}
                    </label>
                    {gameVersions.length > 0 ? (
                      <div className="publish-mod-dialog-game-version-options">
                        {gameVersions.map((gv) => (
                          <button
                            onClick={() => selectGameVersion(gv.version)}
                            style={{
                              borderRadius: "10px",
                              border:
                                gameVersion === gv.version
                                  ? "none"
                                  : "1px solid #e5e7eb",
                              background:
                                gameVersion === gv.version ? "#6366f1" : "#fff",
                              color:
                                gameVersion === gv.version ? "#fff" : "#6b7280",
                            }}
                            key={gv.id}
                            className="publish-mod-dialog-action"
                          >
                            {gv.version}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="publish-mod-dialog-mod-version-options">
                        {["v1.0", "v1.1", "v1.2", "v2.0"].map((v) => (
                          <button
                            onClick={() => selectGameVersion(v)}
                            style={{
                              borderRadius: "10px",
                              border:
                                version === v ? "none" : "1px solid #e5e7eb",
                              background: version === v ? "#6366f1" : "#fff",
                              color: version === v ? "#fff" : "#6b7280",
                            }}
                            key={v}
                            className="publish-mod-dialog-version-option"
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    )}
                    <input
                      type="text"
                      value={gameVersion || version}
                      onChange={(e) => selectGameVersion(e.target.value)}
                      placeholder={t("market.publish.customVersion")}
                      className="publish-mod-dialog-input-field"
                    />
                  </div>
                  <div className="publish-mod-dialog-option-field">
                    <label className="publish-mod-dialog-field-label">
                      {t("characters.mode.title")}
                    </label>
                    <div className="publish-mod-dialog-mod-mode-options">
                      {[
                        {
                          value: "d3d",
                          label: "3dm",
                        },
                        {
                          value: "pak",
                          label: "Pak",
                        },
                      ].map((item) => (
                        <button
                          onClick={() => {
                            setModMode(item.value);
                            setUserDirty(true);
                          }}
                          style={{
                            borderRadius: "10px",
                            border:
                              modMode === item.value
                                ? "none"
                                : "1px solid #e5e7eb",
                            background:
                              modMode === item.value
                                ? item.value === "pak"
                                  ? "#dc2626"
                                  : "#6366f1"
                                : "#fff",
                            color: modMode === item.value ? "#fff" : "#6b7280",
                          }}
                          key={item.value}
                          className="publish-mod-dialog-action-spaced"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="publish-mod-dialog-field-label">
                      {t("market.publish.optionalDescription")}
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => {
                        setDescription(e.target.value);
                        setUserDirty(true);
                      }}
                      placeholder={`${characterName} - ${modName}`}
                      rows={2}
                      className="publish-mod-dialog-textarea-field"
                    />
                  </div>
                  <div className="publish-mod-dialog-author-fields">
                    <div>
                      <label className="publish-mod-dialog-field-label">
                        {t("market.publish.optionalAuthor")}
                      </label>
                      <input
                        type="text"
                        value={author}
                        list={authorDatalistId}
                        onChange={(e) => handleAuthorChange(e.target.value)}
                        placeholder={t("market.publish.authorName")}
                        className="publish-mod-dialog-input-field"
                      />
                      <datalist id={authorDatalistId}>
                        {publishPrefs.authors.map((item) => (
                          <option value={item.name} key={item.name} />
                        ))}
                      </datalist>
                    </div>
                    <div>
                      <label className="publish-mod-dialog-field-label">
                        {t("market.publish.optionalSource")}
                      </label>
                      <input
                        type="url"
                        value={sourceUrl}
                        list={sourceDatalistId}
                        onChange={(e) => handleSourceUrlChange(e.target.value)}
                        placeholder="https://..."
                        className="publish-mod-dialog-input-field"
                      />
                      <datalist id={sourceDatalistId}>
                        {sourceOptions.map((item) => (
                          <option
                            value={item.url}
                            label={item.author ? item.author : void 0}
                            key={item.url}
                          />
                        ))}
                      </datalist>
                    </div>
                  </div>
                </div>
              </div>
              <div className="publish-mod-dialog-section">
                <label className="publish-mod-dialog-tags-heading">
                  {t("market.fields.tags")}
                  {localTags.length > 0 && (
                    <span className="publish-mod-dialog-selected-tag-count">
                      {t("market.publish.localTagsSelected", {
                        localTagsCount: localTags.length,
                      })}
                    </span>
                  )}
                  <button
                    onClick={loadTagsAndLocalTags}
                    className="publish-mod-dialog-load-tags-and-local-tags-action"
                  >
                    {t("common.actions.refresh")}
                  </button>
                </label>
                {tagsLoading ? (
                  <div className="publish-mod-dialog-tags-status">
                    {t("market.publish.connectingTagServer")}
                  </div>
                ) : tagsError ? (
                  <div className="publish-mod-dialog-tag-error">
                    <span>{tagsError}</span>
                    <button
                      onClick={loadTagsAndLocalTags}
                      className="publish-mod-dialog-retry-tags"
                    >
                      {t("common.actions.retry")}
                    </button>
                  </div>
                ) : availableTags.length === 0 ? (
                  <div className="publish-mod-dialog-tags-status">
                    {t("market.publish.noServerTags")}
                  </div>
                ) : (
                  <div className="publish-mod-dialog-tag-options">
                    {availableTags.map((tag) => {
                      const sel = selectedTags.includes(tag.id || tag.name);
                      return (
                        <button
                          onClick={() => toggleTag(tag.id || tag.name)}
                          style={{
                            borderRadius: "10px",
                            border: sel ? "none" : "1px solid #e5e7eb",
                            background: sel ? tag.color || "#6366f1" : "#fff",
                            color: sel ? "#fff" : "#6b7280",
                          }}
                          key={tag.id || tag.name}
                          className="publish-mod-dialog-tag-option"
                        >
                          {sel ? "✓ " : ""}
                          {tag.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <label className="publish-mod-dialog-content-option">
                <div
                  onClick={() => {
                    setIsNsfw(!isNsfw);
                    setUserDirty(true);
                  }}
                  style={{
                    background: isNsfw ? "#ef4444" : "#d1d5db",
                  }}
                  className="publish-mod-dialog-option-switch"
                >
                  <div
                    style={{
                      left: isNsfw ? 18 : 2,
                    }}
                    className="publish-mod-dialog-option-switch-thumb"
                  />
                </div>
                <span
                  style={{
                    color: isNsfw ? "#ef4444" : "#6b7280",
                  }}
                  className="publish-mod-dialog-content-option-label"
                >
                  {t("market.publish.adultOnly")}
                </span>
              </label>
              <label className="publish-mod-dialog-content-option">
                <div
                  onClick={() => {
                    setUseAdultImageHost(!useAdultImageHost);
                    setUserDirty(true);
                  }}
                  style={{
                    background: useAdultImageHost ? "#ef4444" : "#d1d5db",
                  }}
                  className="publish-mod-dialog-option-switch"
                >
                  <div
                    style={{
                      left: useAdultImageHost ? 18 : 2,
                    }}
                    className="publish-mod-dialog-option-switch-thumb"
                  />
                </div>
                <span
                  style={{
                    color: useAdultImageHost ? "#ef4444" : "#6b7280",
                  }}
                  className="publish-mod-dialog-content-option-label"
                >
                  {t("market.publish.adultImage")}
                </span>
              </label>
              <div className="publish-mod-dialog-developer-settings">
                <button
                  onClick={() => setShowDevConfig(!showDevConfig)}
                  className="publish-mod-dialog-developer-settings-toggle"
                >
                  {t("settings.developer.expandHeading", {
                    status: showDevConfig ? "▼" : "▶",
                  })}
                </button>
                {showDevConfig && (
                  <div className="publish-mod-dialog-tool-path-list">
                    {[
                      {
                        key: "pythonPath",
                        label: "Python",
                        placeholder: "python",
                      },
                      {
                        key: "winrarPath",
                        label: "WinRAR",
                        placeholder: "C:\\Program Files\\WinRAR\\WinRAR.exe",
                      },
                      {
                        key: "scriptPath",
                        label: t("market.publish.script"),
                        placeholder: t("market.publish.scriptPath"),
                      },
                    ].map(({ key, label, placeholder }) => (
                      <div
                        key={key}
                        className="publish-mod-dialog-tool-path-row"
                      >
                        <span className="publish-mod-dialog-tool-path-label">
                          {label}
                        </span>
                        <input
                          type="text"
                          value={devConfig[key] || ""}
                          onChange={(e) =>
                            setDevConfig((prev) => ({
                              ...prev,
                              [key]: e.target.value,
                            }))
                          }
                          placeholder={placeholder}
                          className="publish-mod-dialog-tool-path-input"
                        />
                        <button
                          onClick={async () => {
                            const r = await window.api.selectFile({
                              title: t("common.actions.selectNamed", {
                                label,
                              }),
                              filters: [
                                {
                                  name: "All",
                                  extensions: ["*"],
                                },
                              ],
                            });
                            if (r?.filePath)
                              setDevConfig((prev) => ({
                                ...prev,
                                [key]: r.filePath,
                              }));
                          }}
                          className="publish-mod-dialog-browse-tool-path"
                        >
                          {"..."}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          {(phase === "publishing" ||
            phase === "done" ||
            phase === "error") && (
            <div>
              {phase === "publishing" && (
                <div className="publish-mod-dialog-section">
                  <div className="publish-mod-dialog-progress-status">
                    <span>{progressMessage}</span>
                    <span>
                      {progressStep}
                      {"/"}
                      {progressTotal}
                    </span>
                  </div>
                  {uploadMetrics?.speed && (
                    <div className="publish-mod-dialog-upload-metrics">
                      <span>
                        {t("market.publish.r2UploadSpeed", {
                          speed: uploadMetrics.speed,
                        })}
                      </span>
                      {uploadMetrics.percent && (
                        <span>
                          {uploadMetrics.percent}
                          {"% · "}
                          {uploadMetrics.transferred}
                          {"/"}
                          {uploadMetrics.total}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="publish-mod-dialog-progress-track">
                    <div
                      style={{
                        width: `${progressTotal > 0 ? (progressStep / progressTotal) * 100 : 0}%`,
                      }}
                      className="publish-mod-dialog-progress-fill"
                    />
                  </div>
                  {resultLinks.modId && progressStep >= 4 && (
                    <button
                      onClick={handleRetryR2}
                      className="publish-mod-dialog-retry-r2-action"
                    >
                      {t("market.publish.stopAndRetryR2")}
                    </button>
                  )}
                </div>
              )}
              {phase === "done" && (
                <div className="publish-mod-dialog-heading-emphasis">
                  {resultMessage}
                  {resultLinks.modId && (
                    <div className="publish-mod-dialog-content-emphasis">
                      {t("market.publish.marketId", {
                        modId: resultLinks.modId,
                      })}
                    </div>
                  )}
                  {resultLinks.quark && (
                    <div className="publish-mod-dialog-quark-result">
                      {t("market.publish.quarkLinkSaved")}
                    </div>
                  )}
                  {resultLinks.baidu && (
                    <div className="publish-mod-dialog-baidu-result">
                      {t("market.publish.baiduLinkSaved")}
                    </div>
                  )}
                  {uploadMetrics?.speed && (
                    <div className="publish-mod-dialog-upload-speed-result">
                      {t("market.publish.r2Speed", {
                        speed: uploadMetrics.speed,
                      })}
                    </div>
                  )}
                </div>
              )}
              {phase === "error" && (
                <div className="publish-mod-dialog-error-result">
                  <div className="publish-mod-dialog-flex-content">
                    {"❌ "}
                    {resultMessage}
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(
                        resultMessage +
                          "\n\n" +
                          logs.map((l) => l.message).join("\n"),
                      );
                    }}
                    className="publish-mod-dialog-danger-action"
                  >
                    {t("market.cloud.copyLogs")}
                  </button>
                </div>
              )}
              {logs.length > 0 && (
                <div>
                  <button
                    onClick={() => setLogsCollapsed(!logsCollapsed)}
                    className="publish-mod-dialog-logs-toggle"
                  >
                    {t("market.cloud.logsHeading", {
                      status: logsCollapsed ? "▶" : "▼",
                      logsCount: logs.length,
                    })}
                  </button>
                  {!logsCollapsed && (
                    <div
                      data-log-content={true}
                      className="publish-mod-dialog-panel"
                    >
                      {logs.map((log, i) => (
                        <div
                          style={{
                            color: logColor[log.level] || "#d1d5db",
                          }}
                          key={i}
                          className="publish-mod-dialog-log-entry"
                        >
                          {log.message}
                        </div>
                      ))}
                      {phase === "publishing" && (
                        <div className="publish-mod-dialog-log-cursor">
                          {"▋"}
                        </div>
                      )}
                      <div ref={logEndRef} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="publish-mod-dialog-actions">
          {phase === "form" && (
            <React.Fragment>
              <button
                onClick={handleRequestClose}
                className="publish-mod-dialog-cancel-button"
              >
                {t("common.actions.cancel")}
              </button>
              <button
                onClick={() => handleSupplementLink(["baidu"])}
                className="publish-mod-dialog-action-emphasis"
              >
                {t("market.publish.fillBaidu")}
              </button>
              <button
                onClick={() => handleSupplementLink(["quark"])}
                className="publish-mod-dialog-supplement-link"
              >
                {t("market.publish.fillQuark")}
              </button>
              <button
                onClick={handleRetryR2}
                className="publish-mod-dialog-retry-r2-action-emphasis"
              >
                {t("market.publish.fillR2")}
              </button>
              <button
                onClick={() => handleSupplementLink(["baidu", "quark"])}
                className="publish-mod-dialog-primary-action"
              >
                {t("market.publish.fillBothClouds")}
              </button>
              <button
                onClick={handlePublish}
                className="publish-mod-dialog-publish-action"
              >
                {t("market.publish.publish")}
              </button>
            </React.Fragment>
          )}
          {phase === "publishing" && (
            <button
              onClick={handleRequestClose}
              className="publish-mod-dialog-cancel-button"
            >
              {t("common.actions.minimize")}
            </button>
          )}
          {(phase === "done" || phase === "error") && (
            <React.Fragment>
              <button
                onClick={() => window.api.devOpenLogsFolder()}
                className="publish-mod-dialog-open-logs"
              >
                {t("market.publish.openLogs")}
              </button>
              <button
                onClick={handleRetryR2}
                className="publish-mod-dialog-retry-upload"
              >
                {t("market.publish.retryR2Only")}
              </button>
              {phase === "error" && (
                <button
                  onClick={() => {
                    setPhase("form");
                    setLogs([]);
                  }}
                  className="publish-mod-dialog-cancel-button"
                >
                  {t("common.actions.retry")}
                </button>
              )}
              <button
                onClick={onClose}
                className="publish-mod-dialog-close-action"
              >
                {t("common.actions.finish")}
              </button>
            </React.Fragment>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
export { PublishModDialog as default };
