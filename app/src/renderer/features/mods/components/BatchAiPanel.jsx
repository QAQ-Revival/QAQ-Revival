import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
import ReactDOM from "react-dom";
import { Icon } from "../../../components/Icon.jsx";
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
      <div className="task-float batch-ai-float">
        <div className="task-float-main">
          <Icon name={paused ? "pause" : "play"} size={15} />
          <span className="task-float-copy">
            <strong>
              {"AI "}
              {progress.current}
              {"/"}
              {progress.total}
            </strong>
            <span title={progress.currentMod}>{progress.currentMod}</span>
          </span>
          <button
            type="button"
            className="icon-btn icon-btn-sm"
            onClick={handlePause}
            aria-label={paused ? t("common.actions.continue") : t("downloads.actions.pause")}
            title={paused ? t("common.actions.continue") : t("downloads.actions.pause")}
          >
            <Icon name={paused ? "play" : "pause"} size={14} />
          </button>
          <button
            type="button"
            className="icon-btn icon-btn-sm"
            onClick={handleCancel}
            aria-label={t("common.actions.cancel")}
            title={t("common.actions.cancel")}
          >
            <Icon name="x" size={14} />
          </button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setCollapsed(false)}>
            {t("common.actions.expand")}
          </button>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
        {errorCount > 0 && (
          <div className="task-float-status is-danger">
            <span>{t("mods.ai.failureCount", { errorCount })}</span>
          </div>
        )}
      </div>,
      document.body,
    );
  }
  return ReactDOM.createPortal(
    <div className="modal-backdrop" onClick={!running ? onClose : void 0}>
      <div
        className="dev-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="batch-ai-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="dev-panel-head">
          <div className="dev-panel-heading">
            <h2 id="batch-ai-title" className="dev-panel-title">
              {t("mods.ai.batchTitle", {
                status: imageOnly ? t("mods.ai.imagesOnlySuffix") : "",
              })}
            </h2>
            <span className="dev-panel-sub">
              {t("mods.ai.batchGameSummary", {
                gameId: gameId || "unknown",
                pendingCount,
              })}
            </span>
          </div>
          {running && (
            <button type="button" className="btn btn-sm" onClick={() => setCollapsed(true)}>
              {t("mods.ai.runInBackground")}
            </button>
          )}
          <button
            type="button"
            className="icon-btn icon-btn-sm"
            onClick={onClose}
            disabled={running}
            aria-label={t("common.actions.close")}
            title={t("common.actions.close")}
          >
            <Icon name="x" size={15} />
          </button>
        </header>
        <div className="dev-panel-body">
          {!running && (
            <section className="dev-section">
              <div className="dev-section-title">
                <span>{t("market.cloud.chooseCharacters")}</span>
                {!selectAll && selectedChars.size > 0 && (
                  <em>{t("market.cloud.selectedCharacterCount", { size: selectedChars.size })}</em>
                )}
              </div>
              <div className="dev-chips">
                <button
                  type="button"
                  className={`chip ${selectAll ? "active" : ""}`}
                  aria-pressed={selectAll}
                  onClick={handleSelectAll}
                >
                  {t("characters.filter.all")}
                </button>
                {charList.map((c) => {
                  const sel = !selectAll && selectedChars.has(c);
                  return (
                    <button
                      type="button"
                      className={`chip ${sel ? "active" : ""}`}
                      aria-pressed={sel}
                      onClick={() => toggleChar(c)}
                      key={c}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </section>
          )}
          {!running && modList.length > 0 && (
            <div className="dev-note">
              {t("mods.ai.batchQueue", {
                total: modList.length,
                done: modList.filter((m) => m.hasCache).length,
                pending: pendingCount,
              })}
              {loadingMods && <span className="spinner" aria-hidden="true" />}
            </div>
          )}
          {running && (
            <section className="dev-section">
              <div className="dev-progress-head">
                <span>
                  {paused ? t("mods.ai.paused") : t("mods.ai.running")}
                  {" ("}
                  {progress.current}
                  {"/"}
                  {progress.total}
                  {")"}
                </span>
                <button type="button" className="btn btn-sm" onClick={handlePause}>
                  {paused ? t("common.actions.continue") : t("downloads.actions.pause")}
                </button>
                <button type="button" className="btn btn-sm" onClick={handleCancel}>
                  {t("common.actions.cancel")}
                </button>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="dev-note" title={progress.currentMod}>
                {progress.currentMod}
              </div>
            </section>
          )}
          {results.length > 0 && !running && (
            <div className={`notice ${errorCount > 0 ? "notice-warning" : "notice-success"}`}>
              <Icon name={errorCount > 0 ? "alert" : "check"} size={14} />
              <span>
                {t("mods.ai.batchSummary", {
                  doneCount,
                  errorCount,
                  filterCount: results.filter((r) => r.status === "skip").length,
                })}
              </span>
            </div>
          )}
          {results.length > 0 && (
            <div className="dev-log selectable">
              {results.map((r, i) =>
                r.status === "skip" ? (
                  <div key={i} className="dev-log-line is-muted">
                    {r.message}
                  </div>
                ) : (
                  <div
                    key={i}
                    className={`dev-log-line ${r.status === "ok" ? "is-ok" : "is-error"}`}
                  >
                    {"["}
                    {r.char}
                    {"] "}
                    {r.mod}
                    {r.status === "ok" ? " → " : " | "}
                    {r.message}
                  </div>
                ),
              )}
              <div ref={logEndRef} />
            </div>
          )}
          {!running && errorCount > 0 && (
            <section className="dev-section">
              <div className="dev-section-title">
                <span>{t("mods.ai.failureList", { errorCount })}</span>
              </div>
              <div className="dev-rows">
                {results
                  .filter((r) => r.status === "error")
                  .map((r, i) => (
                    <div key={i} className="dev-row is-stacked">
                      <span className="dev-row-name">
                        {"["}
                        {r.char}
                        {"] "}
                        {r.mod}
                      </span>
                      <span className="dev-row-error selectable">{r.message}</span>
                    </div>
                  ))}
              </div>
            </section>
          )}
        </div>
        <footer className="dev-panel-foot">
          {results.length > 0 && (
            <button
              type="button"
              className="btn"
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
            >
              {t("market.cloud.copyLogs")}
            </button>
          )}
          {!running && _batchAiDone.size > 0 && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                _batchAiDone.clear();
                loadMods();
              }}
            >
              {t("mods.ai.resetRecords")}
            </button>
          )}
          <span className="dev-panel-foot-spacer" />
          <button type="button" className="btn" onClick={onClose} disabled={running}>
            {t("common.actions.close")}
          </button>
          {!running && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={runBatchAi}
              disabled={pendingCount === 0 || loadingMods}
            >
              {pendingCount === 0
                ? t("mods.ai.allProcessed")
                : t("mods.ai.startBatch", { pendingCount })}
            </button>
          )}
        </footer>
      </div>
    </div>,
    document.body,
  );
}
export { BatchAiPanel as default };
