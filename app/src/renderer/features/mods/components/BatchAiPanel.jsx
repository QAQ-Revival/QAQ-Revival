import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
import ReactDOM from "react-dom";
const _batchAiDone = new Set();
function BatchAiPanel({ gameId, imageOnly = false, onClose }) {
  const [charList, setCharList] = React.useState([]);
  const [selectedChars, setSelectedChars] = React.useState(new Set());
  const [selectAll, setSelectAll] = React.useState(true);
  const [modList, setModList] = React.useState([]);
  const [loadingMods, setLoadingMods] = React.useState(false);
  const [running, setRunning] = React.useState(false);
  const [paused, setPaused] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);
  const [progress, setProgress] = React.useState({
    current: 0,
    total: 0,
    currentMod: "",
  });
  const [results, setResults] = React.useState([]);
  const [serverTags, setServerTags] = React.useState([]);
  const pausedRef = React.useRef(false);
  const cancelRef = React.useRef(false);
  const logEndRef = React.useRef(null);
  React.useEffect(() => {
    loadCharacters();
    loadServerTags();
  }, []);
  React.useEffect(() => {
    if (!running && charList.length > 0) loadMods();
  }, [selectAll, selectedChars, charList]);
  React.useEffect(() => {
    if (logEndRef.current && !collapsed) {
      logEndRef.current.scrollIntoView({
        behavior: "smooth",
      });
    }
  }, [results, collapsed]);
  async function loadCharacters() {
    try {
      const r = await window.api.getCharacters();
      if (r?.success && Array.isArray(r.characters)) {
        setCharList(
          r.characters
            .map((c) => c.name || c)
            .filter(Boolean)
            .sort(),
        );
      }
    } catch {}
  }
  async function loadServerTags() {
    try {
      const cfg = await window.api.getConfig();
      const url = (cfg?.config?.serverUrl || "https://qaqm.top").replace(
        /\/$/,
        "",
      );
      const res = await fetch(`${url}/api/tags`);
      if (res.ok) {
        const data = await res.json();
        const tags = Array.isArray(data) ? data : data.tags || [];
        setServerTags(tags);
        return tags;
      }
    } catch {}
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
                } catch {}
              }
              allMods.push({
                char,
                name: mod.name,
                path: mod.path,
                hasCache: done,
              });
            }
          }
        } catch {}
      }
      setModList(allMods);
    } catch {}
    setLoadingMods(false);
  }
  function handleSelectAll() {
    setSelectAll(true);
    setSelectedChars(new Set());
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
    setProgress({
      current: 0,
      total: toProcess.length,
      currentMod: "",
    });
    setCollapsed(false);
    const latestTags =
      serverTags.length > 0 ? serverTags : await loadServerTags();
    const serverTagNames = new Set(
      latestTags.map((t) => t.name).filter(Boolean),
    );
    const allTagNames = [...serverTagNames].join("、");
    for (let i = 0; i < toProcess.length; i++) {
      if (cancelRef.current) {
        setResults((prev) => [
          ...prev,
          {
            mod: "---",
            char: "",
            status: "skip",
            message: "cancelled",
          },
        ]);
        break;
      }
      while (pausedRef.current) {
        await new Promise((r) => setTimeout(r, 300));
        if (cancelRef.current) break;
      }
      if (cancelRef.current) break;
      const mod = toProcess[i];
      setProgress({
        current: i + 1,
        total: toProcess.length,
        currentMod: `[${mod.char}] ${mod.name}`,
      });
      try {
        const details = await window.api.getModDetails(mod.char, mod.name);
        const previewUrl = details?.previewUrl || null;
        if (imageOnly && !previewUrl) {
          setResults((prev) => [
            ...prev,
            {
              mod: mod.name,
              char: mod.char,
              status: "skip",
              message: t("mods.ai.skippedWithoutPreview"),
            },
          ]);
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
        const isSupportedImage =
          previewUrl && /^data:image\/(jpeg|png|gif);/.test(previewUrl);
        const contentWithImg = isSupportedImage
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
            content: contentWithImg,
          },
        ];
        const aiRequestOptions = {
          max_tokens: 700,
          response_format: {
            type: "json_object",
          },
          temperature: 0.2,
        };
        let res = await window.api.devAiSuggest({
          messages,
          ...aiRequestOptions,
        });
        if (
          !res.success &&
          isSupportedImage &&
          res.error &&
          res.error.includes("400")
        ) {
          const retryMessages = [
            {
              role: "user",
              content: promptText,
            },
          ];
          res = await window.api.devAiSuggest({
            messages: retryMessages,
            ...aiRequestOptions,
          });
        }
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
          throw new Error(t("mods.ai.noValidSuggestions"));
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
        const tagDiagnostic =
          poolTags.length > 0
            ? ""
            : serverTagNames.size === 0
              ? t("mods.ai.emptyTagPoolSuffix")
              : rawTags.length === 0
                ? t("mods.ai.noTagsReturnedSuffix")
                : t("mods.ai.tagsNotMatchedSuffix");
        if (poolTags.length > 0) {
          try {
            const existingResult = await window.api.devGetModTags(mod.path);
            const existingTags = existingResult?.tags || [];
            const merged = [...new Set([...existingTags, ...poolTags])];
            await window.api.devSetModTags(mod.path, merged);
          } catch {}
        }
        try {
          await window.api.devSaveAiSuggestCache({
            modPath: mod.path,
            result: {
              groups,
              tags: poolTags,
              allTags: poolTags,
              newTags,
            },
          });
        } catch {}
        try {
          await window.api.devSaveAiTags({
            modName: mod.name,
            characterName: mod.char,
            gameId: gameId || "unknown",
            allTags: poolTags,
            poolTags,
            newTags,
            timestamp: new Date().toISOString(),
          });
        } catch {}
        _batchAiDone.add(mod.path);
        setModList((prev) =>
          prev.map((m) =>
            m.path === mod.path
              ? {
                  ...m,
                  hasCache: true,
                }
              : m,
          ),
        );
        const namePreview = groups[0]?.items[0]?.fullName || "";
        setResults((prev) => [
          ...prev,
          {
            mod: mod.name,
            char: mod.char,
            status: "ok",
            message: `${namePreview} | tags: ${poolTags.join(",")}${tagDiagnostic}`,
          },
        ]);
        await new Promise((r) => setTimeout(r, 1e3));
      } catch (e) {
        setResults((prev) => [
          ...prev,
          {
            mod: mod.name,
            char: mod.char,
            status: "error",
            message: e.message || String(e),
          },
        ]);
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
  const pct =
    progress.total > 0 ? (progress.current / progress.total) * 100 : 0;
  if (collapsed && running) {
    return ReactDOM.createPortal(
      <div className="batch-ai-panel-floating-panel">
        <div className="batch-ai-panel-panel">
          <div className="batch-ai-panel-row">
            <span className="batch-ai-panel-heading">
              {paused ? "⏸" : "▶"}
              {" AI "}
              {progress.current}
              {"/"}
              {progress.total}
            </span>
            <div className="batch-ai-panel-compact-controls">
              <button
                onClick={handlePause}
                className="batch-ai-panel-pause-action"
              >
                {paused ? "▶" : "⏸"}
              </button>
              <button
                onClick={handleCancel}
                className="batch-ai-panel-cancel-action"
              >
                {"✕"}
              </button>
              <button
                onClick={() => setCollapsed(false)}
                className="batch-ai-panel-pause-action"
              >
                {t("common.actions.expand")}
              </button>
            </div>
          </div>
          <div className="batch-ai-panel-content">
            <div
              style={{
                width: `${pct}%`,
              }}
              className="batch-ai-panel-compact-progress-fill"
            />
          </div>
          <div className="batch-ai-panel-truncated-text">
            {progress.currentMod}
          </div>
          {errorCount > 0 && (
            <div className="batch-ai-panel-error-text">
              {t("mods.ai.failureCount", {
                errorCount,
              })}
            </div>
          )}
        </div>
      </div>,
      document.body,
    );
  }
  return ReactDOM.createPortal(
    <div
      onClick={!running ? onClose : void 0}
      className="batch-ai-panel-overlay"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="batch-ai-panel-stack"
      >
        <div className="batch-ai-panel-row-spaced">
          <div>
            <div className="batch-ai-panel-heading-emphasis">
              {t("mods.ai.batchTitle", {
                status: imageOnly ? t("mods.ai.imagesOnlySuffix") : "",
              })}
            </div>
            <div className="batch-ai-panel-hint">
              {t("mods.ai.batchGameSummary", {
                gameId: gameId || "unknown",
                pendingCount,
              })}
            </div>
          </div>
          <div className="batch-ai-panel-header-actions">
            {running && (
              <button
                onClick={() => setCollapsed(true)}
                className="batch-ai-panel-action"
              >
                {t("mods.ai.runInBackground")}
              </button>
            )}
            <button
              onClick={running ? void 0 : onClose}
              style={{
                cursor: running ? "default" : "pointer",
                color: running ? "#d1d5db" : "#9ca3af",
              }}
              className="batch-ai-panel-close-icon"
            >
              {"✕"}
            </button>
          </div>
        </div>
        <div className="batch-ai-panel-content-spaced">
          {!running && (
            <div className="batch-ai-panel-character-picker">
              <div className="batch-ai-panel-character-picker-heading">
                {t("market.cloud.chooseCharacters")}
              </div>
              <div className="batch-ai-panel-character-options">
                <button
                  onClick={handleSelectAll}
                  style={{
                    borderRadius: "10px",
                    border: selectAll ? "none" : "1px solid #e5e7eb",
                    background: selectAll ? "#6366f1" : "#fff",
                    color: selectAll ? "#fff" : "#6b7280",
                  }}
                  className="batch-ai-panel-select-all-action"
                >
                  {t("characters.filter.all")}
                </button>
                {charList.map((c) => {
                  const sel = !selectAll && selectedChars.has(c);
                  return (
                    <button
                      onClick={() => toggleChar(c)}
                      style={{
                        borderRadius: "10px",
                        border: sel ? "none" : "1px solid #e5e7eb",
                        background: sel ? "#a855f7" : "#fff",
                        color: sel ? "#fff" : "#6b7280",
                      }}
                      key={c}
                      className="batch-ai-panel-character-option"
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
              {!selectAll && selectedChars.size > 0 && (
                <div className="batch-ai-panel-selected-character-count">
                  {t("market.cloud.selectedCharacterCount", {
                    size: selectedChars.size,
                  })}
                </div>
              )}
            </div>
          )}
          {!running && modList.length > 0 && (
            <div className="batch-ai-panel-panel-spaced">
              <div className="batch-ai-panel-queue-summary">
                {t("mods.ai.batchTotalPrefix")}
                <strong>{modList.length}</strong>
                {t("mods.ai.batchProcessedSeparator")}
                <strong className="batch-ai-panel-cached-count">
                  {modList.filter((m) => m.hasCache).length}
                </strong>
                {t("mods.ai.batchPendingSeparator")}
                <strong className="batch-ai-panel-pending-count">
                  {pendingCount}
                </strong>
                {loadingMods && (
                  <span className="batch-ai-panel-muted-message">
                    {t("common.status.loading")}
                  </span>
                )}
              </div>
            </div>
          )}
          {!running && (
            <div className="batch-ai-panel-start-actions">
              <button
                onClick={runBatchAi}
                disabled={pendingCount === 0 || loadingMods}
                style={{
                  cursor:
                    pendingCount === 0 || loadingMods ? "default" : "pointer",
                  background:
                    pendingCount === 0 || loadingMods
                      ? "#d1d5db"
                      : "linear-gradient(135deg, #6366f1, #a855f7)",
                }}
                className="batch-ai-panel-run-batch-ai-action"
              >
                {pendingCount === 0
                  ? t("mods.ai.allProcessed")
                  : t("mods.ai.startBatch", {
                      pendingCount,
                    })}
              </button>
              {_batchAiDone.size > 0 && (
                <button
                  onClick={() => {
                    _batchAiDone.clear();
                    loadMods();
                  }}
                  className="batch-ai-panel-reset-records"
                >
                  {t("mods.ai.resetRecords")}
                </button>
              )}
            </div>
          )}
          {running && (
            <div className="batch-ai-panel-progress-section">
              <div className="batch-ai-panel-row">
                <span className="batch-ai-panel-heading">
                  {paused ? t("mods.ai.paused") : t("mods.ai.running")}
                  {" ("}
                  {progress.current}
                  {"/"}
                  {progress.total}
                  {")"}
                </span>
                <div className="batch-ai-panel-progress-actions">
                  <button
                    onClick={handlePause}
                    style={{
                      background: paused ? "#fef3c7" : "#fff",
                    }}
                    className="batch-ai-panel-pause-button"
                  >
                    {paused
                      ? t("common.actions.continue")
                      : t("downloads.actions.pause")}
                  </button>
                  <button
                    onClick={handleCancel}
                    className="batch-ai-panel-cancel-button"
                  >
                    {t("common.actions.cancel")}
                  </button>
                </div>
              </div>
              <div className="batch-ai-panel-current-mod">
                {progress.currentMod}
              </div>
              <div className="batch-ai-panel-progress-track">
                <div
                  style={{
                    width: `${pct}%`,
                  }}
                  className="batch-ai-panel-progress-fill"
                />
              </div>
            </div>
          )}
          {results.length > 0 && !running && (
            <div
              style={{
                borderRadius: "8px",
                background:
                  errorCount > 0
                    ? "rgba(239,68,68,0.06)"
                    : "rgba(34,197,94,0.06)",
                border: `1px solid ${errorCount > 0 ? "#fca5a5" : "#86efac"}`,
              }}
              className="batch-ai-panel-hint-spaced"
            >
              <div
                style={{
                  color: errorCount > 0 ? "#b45309" : "#16a34a",
                }}
                className="batch-ai-panel-result-summary"
              >
                {t("mods.ai.batchSummary", {
                  doneCount,
                  errorCount,
                  filterCount: results.filter((r) => r.status === "skip")
                    .length,
                })}
              </div>
            </div>
          )}
          {results.length > 0 && (
            <div>
              <div className="batch-ai-panel-log-output">
                {results.map((r, i) => {
                  if (r.status === "skip")
                    return (
                      <div key={i} className="batch-ai-panel-log-skip">
                        {"━ "}
                        {r.message}
                      </div>
                    );
                  const color = r.status === "ok" ? "#4ade80" : "#f87171";
                  const icon = r.status === "ok" ? "✓" : "✗";
                  return (
                    <div
                      style={{
                        color,
                      }}
                      key={i}
                      className="batch-ai-panel-log-entry"
                    >
                      {icon}
                      {" ["}
                      {r.char}
                      {"] "}
                      {r.mod}
                      {r.status === "ok" && (
                        <span className="batch-ai-panel-log-result">
                          {" → "}
                          {r.message}
                        </span>
                      )}
                      {r.status === "error" && (
                        <span className="batch-ai-panel-log-error">
                          {" | "}
                          {r.message}
                        </span>
                      )}
                    </div>
                  );
                })}
                {running && (
                  <div className="batch-ai-panel-log-cursor">{"▋"}</div>
                )}
                <div ref={logEndRef} />
              </div>
            </div>
          )}
          {!running && errorCount > 0 && (
            <div className="batch-ai-panel-error-section">
              <div className="batch-ai-panel-error-heading">
                {t("mods.ai.failureList", {
                  errorCount,
                })}
              </div>
              <div className="batch-ai-panel-error-list">
                {results
                  .filter((r) => r.status === "error")
                  .map((r, i) => (
                    <div key={i} className="batch-ai-panel-error-item">
                      <span className="batch-ai-panel-error-target">
                        {"["}
                        {r.char}
                        {"] "}
                        {r.mod}
                      </span>
                      <span className="batch-ai-panel-muted-message">
                        {r.message}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
        <div className="batch-ai-panel-actions">
          {results.length > 0 && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(
                  results
                    .map(
                      (r) =>
                        `${r.status === "ok" ? "✓" : "✗"} [${r.char}] ${r.mod} ${r.message}`,
                    )
                    .join("\n"),
                );
              }}
              className="batch-ai-panel-action-spaced"
            >
              {t("market.cloud.copyLogs")}
            </button>
          )}
          <button
            onClick={running ? void 0 : onClose}
            disabled={running}
            style={{
              cursor: running ? "default" : "pointer",
              color: running ? "#d1d5db" : "#6b7280",
            }}
            className="batch-ai-panel-close-button"
          >
            {t("common.actions.close")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
export { BatchAiPanel as default };
