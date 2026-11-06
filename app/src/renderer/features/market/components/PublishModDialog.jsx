import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
import { fetchWithDirectFallback } from "../../../lib/marketApi.js";
import ReactDOM from "react-dom";
import { Icon } from "../../../components/Icon.jsx";
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
      addLog(`${msg.message}`, "error");
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
      addLog(`启动失败: ${result.error}`, "error");
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
      addLog(`启动失败: ${result.error}`, "error");
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
      addLog("已请求停止当前发布进程，准备只重传 R2", "warn");
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
      addLog(`启动失败: ${result.error}`, "error");
      setResultMessage(result.error);
      setPhase("error");
      cleanupRef.current?.();
      cleanupRef.current = null;
    }
  }
  if (!visible) return null;
  return ReactDOM.createPortal(
    <div className="modal-backdrop" onClick={handleRequestClose}>
      <div
        className="dev-panel dev-panel-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="dev-panel-head">
          <div className="dev-panel-heading">
            <h2 id="publish-title" className="dev-panel-title">
              {phase === "form"
                ? t("market.publish.title")
                : phase === "publishing"
                  ? t("market.publish.publishing")
                  : phase === "done"
                    ? t("market.publish.success")
                    : t("market.publish.failed")}
            </h2>
            <span className="dev-panel-sub">
              {characterName}
              {" · "}
              {modName}
            </span>
          </div>
          <button
            type="button"
            className="icon-btn icon-btn-sm"
            onClick={handleRequestClose}
            aria-label={t("common.actions.close")}
            title={t("common.actions.close")}
          >
            <Icon name="x" size={15} />
          </button>
        </header>
        <div className="dev-panel-body">
          {phase === "form" && (
            <React.Fragment>
              <div className="publish-form">
                <div className="publish-preview">
                  {previewDataUrl ? (
                    <img src={previewDataUrl} alt="" />
                  ) : (
                    <Icon name="image" size={24} />
                  )}
                </div>
                <div className="publish-fields">
                  <div className="dev-field">
                    <span>{t("market.publish.gameVersion")}</span>
                    <div className="dev-chips">
                      {gameVersions.length > 0
                        ? gameVersions.map((gv) => (
                            <button
                              type="button"
                              className={`chip ${gameVersion === gv.version ? "active" : ""}`}
                              aria-pressed={gameVersion === gv.version}
                              onClick={() => selectGameVersion(gv.version)}
                              key={gv.id}
                            >
                              {gv.version}
                            </button>
                          ))
                        : ["v1.0", "v1.1", "v1.2", "v2.0"].map((v) => (
                            <button
                              type="button"
                              className={`chip ${version === v ? "active" : ""}`}
                              aria-pressed={version === v}
                              onClick={() => selectGameVersion(v)}
                              key={v}
                            >
                              {v}
                            </button>
                          ))}
                    </div>
                    <input
                      type="text"
                      className="input"
                      value={gameVersion || version}
                      onChange={(e) => selectGameVersion(e.target.value)}
                      placeholder={t("market.publish.customVersion")}
                    />
                  </div>
                  <div className="dev-field">
                    <span>{t("characters.mode.title")}</span>
                    <div className="segmented">
                      {[
                        { value: "d3d", label: "3dm" },
                        { value: "pak", label: "Pak" },
                      ].map((item) => (
                        <button
                          type="button"
                          className={modMode === item.value ? "active" : ""}
                          onClick={() => {
                            setModMode(item.value);
                            setUserDirty(true);
                          }}
                          key={item.value}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="dev-field">
                    <span>{t("market.publish.optionalDescription")}</span>
                    <textarea
                      className="textarea"
                      value={description}
                      onChange={(e) => {
                        setDescription(e.target.value);
                        setUserDirty(true);
                      }}
                      placeholder={`${characterName} - ${modName}`}
                      rows={2}
                    />
                  </label>
                  <div className="dev-field-pair">
                    <label className="dev-field">
                      <span>{t("market.publish.optionalAuthor")}</span>
                      <input
                        type="text"
                        className="input"
                        value={author}
                        list={authorDatalistId}
                        onChange={(e) => handleAuthorChange(e.target.value)}
                        placeholder={t("market.publish.authorName")}
                      />
                      <datalist id={authorDatalistId}>
                        {publishPrefs.authors.map((item) => (
                          <option value={item.name} key={item.name} />
                        ))}
                      </datalist>
                    </label>
                    <label className="dev-field">
                      <span>{t("market.publish.optionalSource")}</span>
                      <input
                        type="url"
                        className="input"
                        value={sourceUrl}
                        list={sourceDatalistId}
                        onChange={(e) => handleSourceUrlChange(e.target.value)}
                        placeholder="https://..."
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
                    </label>
                  </div>
                </div>
              </div>
              <section className="dev-section">
                <div className="dev-section-title">
                  <span>{t("market.fields.tags")}</span>
                  {localTags.length > 0 && (
                    <em>
                      {t("market.publish.localTagsSelected", {
                        localTagsCount: localTags.length,
                      })}
                    </em>
                  )}
                  <button
                    type="button"
                    className="link-btn dev-section-action"
                    onClick={loadTagsAndLocalTags}
                  >
                    {t("common.actions.refresh")}
                  </button>
                </div>
                {tagsLoading ? (
                  <div className="dev-note">
                    <span className="spinner" aria-hidden="true" />
                    {t("market.publish.connectingTagServer")}
                  </div>
                ) : tagsError ? (
                  <div className="notice notice-danger" role="alert">
                    <Icon name="alert" size={14} />
                    <span>{tagsError}</span>
                    <button type="button" className="btn btn-sm" onClick={loadTagsAndLocalTags}>
                      {t("common.actions.retry")}
                    </button>
                  </div>
                ) : availableTags.length === 0 ? (
                  <div className="dev-note">{t("market.publish.noServerTags")}</div>
                ) : (
                  <div className="dev-chips">
                    {availableTags.map((tag) => {
                      const sel = selectedTags.includes(tag.id || tag.name);
                      return (
                        <button
                          type="button"
                          className={`chip ${sel ? "active" : ""}`}
                          aria-pressed={sel}
                          onClick={() => toggleTag(tag.id || tag.name)}
                          key={tag.id || tag.name}
                        >
                          {tag.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
              <div className="publish-switches">
                <div className="publish-switch">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isNsfw}
                    aria-label={t("market.publish.adultOnly")}
                    className={`toggle-switch-refined ${isNsfw ? "active" : ""}`}
                    onClick={() => {
                      setIsNsfw(!isNsfw);
                      setUserDirty(true);
                    }}
                  />
                  <span>{t("market.publish.adultOnly")}</span>
                </div>
                <div className="publish-switch">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={useAdultImageHost}
                    aria-label={t("market.publish.adultImage")}
                    className={`toggle-switch-refined ${useAdultImageHost ? "active" : ""}`}
                    onClick={() => {
                      setUseAdultImageHost(!useAdultImageHost);
                      setUserDirty(true);
                    }}
                  />
                  <span>{t("market.publish.adultImage")}</span>
                </div>
              </div>
              <section className="dev-section">
                <button
                  type="button"
                  className="dev-log-toggle"
                  aria-expanded={showDevConfig}
                  onClick={() => setShowDevConfig(!showDevConfig)}
                >
                  <Icon name={showDevConfig ? "chevron-down" : "chevron-right"} size={14} />
                  {t("settings.developer.expandHeading", { status: "" })}
                </button>
                {showDevConfig && (
                  <div className="dev-rows">
                    {[
                      { key: "pythonPath", label: "Python", placeholder: "python" },
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
                      <div key={key} className="dev-row">
                        <span className="dev-row-meta publish-tool-label">{label}</span>
                        <input
                          type="text"
                          className="input dev-row-input"
                          value={devConfig[key] || ""}
                          onChange={(e) =>
                            setDevConfig((prev) => ({
                              ...prev,
                              [key]: e.target.value,
                            }))
                          }
                          placeholder={placeholder}
                        />
                        <button
                          type="button"
                          className="icon-btn icon-btn-sm"
                          aria-label={t("common.actions.selectNamed", { label })}
                          title={t("common.actions.selectNamed", { label })}
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
                        >
                          <Icon name="folder" size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </React.Fragment>
          )}
          {(phase === "publishing" || phase === "done" || phase === "error") && (
            <React.Fragment>
              {phase === "publishing" && (
                <section className="dev-section">
                  <div className="dev-progress-head">
                    <span>{progressMessage}</span>
                    <em>
                      {progressStep}
                      {"/"}
                      {progressTotal}
                    </em>
                  </div>
                  {uploadMetrics?.speed && (
                    <div className="dev-progress-head">
                      <span>
                        {t("market.publish.r2UploadSpeed", {
                          speed: uploadMetrics.speed,
                        })}
                      </span>
                      {uploadMetrics.percent && (
                        <em>
                          {uploadMetrics.percent}
                          {"% · "}
                          {uploadMetrics.transferred}
                          {"/"}
                          {uploadMetrics.total}
                        </em>
                      )}
                    </div>
                  )}
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${progressTotal > 0 ? (progressStep / progressTotal) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  {resultLinks.modId && progressStep >= 4 && (
                    <div>
                      <button type="button" className="btn btn-sm" onClick={handleRetryR2}>
                        {t("market.publish.stopAndRetryR2")}
                      </button>
                    </div>
                  )}
                </section>
              )}
              {phase === "done" && (
                <div className="notice notice-success">
                  <Icon name="check" size={14} />
                  <div className="dev-notice-body">
                    <div>{resultMessage}</div>
                    {resultLinks.modId && (
                      <div>{t("market.publish.marketId", { modId: resultLinks.modId })}</div>
                    )}
                    {resultLinks.quark && <div>{t("market.publish.quarkLinkSaved")}</div>}
                    {resultLinks.baidu && <div>{t("market.publish.baiduLinkSaved")}</div>}
                    {uploadMetrics?.speed && (
                      <div>{t("market.publish.r2Speed", { speed: uploadMetrics.speed })}</div>
                    )}
                  </div>
                </div>
              )}
              {phase === "error" && (
                <div className="notice notice-danger" role="alert">
                  <Icon name="alert" size={14} />
                  <span className="dev-notice-body selectable">{resultMessage}</span>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        resultMessage +
                          "\n\n" +
                          logs.map((l) => l.message).join("\n"),
                      );
                    }}
                  >
                    {t("market.cloud.copyLogs")}
                  </button>
                </div>
              )}
              {logs.length > 0 && (
                <section className="dev-section">
                  <button
                    type="button"
                    className="dev-log-toggle"
                    aria-expanded={!logsCollapsed}
                    onClick={() => setLogsCollapsed(!logsCollapsed)}
                  >
                    <Icon name={logsCollapsed ? "chevron-right" : "chevron-down"} size={14} />
                    {t("market.cloud.logsHeading", { logsCount: logs.length })}
                  </button>
                  {!logsCollapsed && (
                    <div data-log-content={true} className="dev-log selectable">
                      {logs.map((log, i) => (
                        <div key={i} className={`dev-log-line is-${log.level}`}>
                          {log.message}
                        </div>
                      ))}
                      <div ref={logEndRef} />
                    </div>
                  )}
                </section>
              )}
            </React.Fragment>
          )}
        </div>
        <footer className="dev-panel-foot">
          {phase === "form" && (
            <React.Fragment>
              <button type="button" className="btn" onClick={handleRequestClose}>
                {t("common.actions.cancel")}
              </button>
              <span className="dev-panel-foot-spacer" />
              <button type="button" className="btn" onClick={() => handleSupplementLink(["baidu"])}>
                {t("market.publish.fillBaidu")}
              </button>
              <button type="button" className="btn" onClick={() => handleSupplementLink(["quark"])}>
                {t("market.publish.fillQuark")}
              </button>
              <button type="button" className="btn" onClick={handleRetryR2}>
                {t("market.publish.fillR2")}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => handleSupplementLink(["baidu", "quark"])}
              >
                {t("market.publish.fillBothClouds")}
              </button>
              <button type="button" className="btn btn-primary" onClick={handlePublish}>
                {t("market.publish.publish")}
              </button>
            </React.Fragment>
          )}
          {phase === "publishing" && (
            <button type="button" className="btn" onClick={handleRequestClose}>
              {t("common.actions.minimize")}
            </button>
          )}
          {(phase === "done" || phase === "error") && (
            <React.Fragment>
              <button type="button" className="btn btn-ghost" onClick={() => window.api.devOpenLogsFolder()}>
                {t("market.publish.openLogs")}
              </button>
              <span className="dev-panel-foot-spacer" />
              <button type="button" className="btn" onClick={handleRetryR2}>
                {t("market.publish.retryR2Only")}
              </button>
              {phase === "error" && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setPhase("form");
                    setLogs([]);
                  }}
                >
                  {t("common.actions.retry")}
                </button>
              )}
              <button type="button" className="btn btn-primary" onClick={onClose}>
                {t("common.actions.finish")}
              </button>
            </React.Fragment>
          )}
        </footer>
      </div>
    </div>,
    document.body,
  );
}
export { PublishModDialog as default };
