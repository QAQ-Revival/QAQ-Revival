import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
import ReactDOM from "react-dom";
import { Icon } from "../../../components/Icon.jsx";
const SERVER_URL_DEFAULT = "https://qaqm.top";
function BatchCloudPanel({ gameId, onClose }) {
  const [mode, setMode] = React.useState(null);
  const [characters, setCharacters] = React.useState("");
  const [charList, setCharList] = React.useState([]);
  const [selectedChars, setSelectedChars] = React.useState(new Set());
  const [selectAll, setSelectAll] = React.useState(true);
  const [force, setForce] = React.useState(false);
  const [running, setRunning] = React.useState(false);
  const [logs, setLogs] = React.useState([]);
  const [logsCollapsed, setLogsCollapsed] = React.useState(false);
  const [progress, setProgress] = React.useState({
    current: 0,
    total: 0,
    message: "",
  });
  const [result, setResult] = React.useState(null);
  const [cloudItems, setCloudItems] = React.useState(null);
  const [selectedPending, setSelectedPending] = React.useState(new Set());
  const [localMods, setLocalMods] = React.useState([]);
  const [selectedMods, setSelectedMods] = React.useState(null);
  const [loadingMods, setLoadingMods] = React.useState(false);
  const [devConfig, setDevConfig] = React.useState({
    pythonPath: "python",
    scriptPath: "",
  });
  const [adminKey, setAdminKey] = React.useState(
    () => localStorage.getItem("qaqm-dev-admin-key") || "",
  );
  const [fillRunning, setFillRunning] = React.useState(false);
  const [fillResult, setFillResult] = React.useState(null);
  const logEndRef = React.useRef(null);
  const cleanupRef = React.useRef([]);
  React.useEffect(() => {
    loadCharacters();
    loadDevConfig();
    return () => {
      cleanupRef.current.forEach((fn) => fn?.());
    };
  }, []);
  React.useEffect(() => {
    loadLocalMods();
  }, [selectAll, selectedChars]);
  React.useEffect(() => {
    if (logEndRef.current && !logsCollapsed) {
      logEndRef.current.scrollIntoView({
        behavior: "smooth",
      });
    }
  }, [logs, logsCollapsed]);
  async function loadCharacters() {
    try {
      const result2 = await window.api.getCharacters();
      if (result2?.success && Array.isArray(result2.characters)) {
        const chars = result2.characters
          .map((c) => c.name || c)
          .filter(Boolean)
          .sort();
        setCharList(chars);
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
  async function loadLocalMods() {
    setLoadingMods(true);
    try {
      const chars = selectAll ? [] : [...selectedChars];
      const r = await window.api.devListLocalMods({
        characters: chars,
      });
      if (r?.success) {
        setLocalMods(r.mods || []);
        setSelectedMods(null);
      }
    } catch (_) {}
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
    setSelectedChars(new Set());
  }
  async function fillMissingImages() {
    const key = adminKey || localStorage.getItem("qaqm-dev-admin-key") || "";
    if (!key) {
      const input = window.prompt(t("settings.developer.adminKeyPrompt"));
      if (!input) return;
      setAdminKey(input);
      localStorage.setItem("qaqm-dev-admin-key", input);
    }
    setFillRunning(true);
    setFillResult(null);
    try {
      const config = await window.api.getConfig();
      const serverUrl = (
        config?.config?.serverUrl || SERVER_URL_DEFAULT
      ).replace(/\/$/, "");
      const result2 = await window.api.devFillMissingImages({
        adminKey: adminKey || localStorage.getItem("qaqm-dev-admin-key") || "",
        serverUrl,
      });
      if (!result2.success) throw new Error(result2.error);
      setFillResult(result2);
    } catch (e) {
      setFillResult({
        error: e.message,
      });
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
    setProgress({
      current: 0,
      total: 0,
      message: t("games.launch.launching"),
    });
    setLogsCollapsed(false);
    const charFilter = selectAll ? "" : [...selectedChars].join(",");
    const modNamesFilter =
      selectedMods && opMode === "upload" ? [...selectedMods].join(",") : "";
    const cleanupProgress = window.api.onBatchCloudProgress((rawData) => {
      const lines = rawData.split("\n").filter((l) => l.trim());
      for (const line of lines) {
        try {
          const msg = JSON.parse(line);
          if (msg.type === "progress") {
            setProgress({
              current: msg.current,
              total: msg.total,
              message: msg.message,
            });
          } else if (msg.type === "log") {
            setLogs((prev) => [
              ...prev,
              {
                message: msg.message,
                level: msg.level || "info",
              },
            ]);
          } else if (msg.type === "result") {
            if (Array.isArray(msg.items)) {
              setCloudItems(msg.items);
              setSelectedPending(new Set());
            } else {
              setResult({
                success: msg.success,
                errors: msg.errors,
                errorList: msg.errorList || [],
              });
            }
          }
        } catch (_) {
          if (line.trim())
            setLogs((prev) => [
              ...prev,
              {
                message: line,
                level: "info",
              },
            ]);
        }
      }
    });
    const cleanupDone = window.api.onBatchCloudDone(({ exitCode }) => {
      setRunning(false);
      if (exitCode !== 0 && !result) {
        setResult(
          (prev) =>
            prev || {
              success: 0,
              errors: 1,
              errorList: [
                {
                  error: t("market.cloud.processExited", {
                    exitCode,
                  }),
                },
              ],
            },
        );
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
      ...restParams,
    });
    if (!r.success) {
      setLogs((prev) => [
        ...prev,
        {
          message: `${r.error}`,
          level: "error",
        },
      ]);
      setRunning(false);
    }
  }
  async function smartUploadWithFilter() {
    setLogs([]);
    setResult(null);
    setCloudItems(null);
    setProgress({
      current: 0,
      total: 0,
      message: t("market.cloud.checkingImages"),
    });
    const modsToCheck =
      selectedMods === null
        ? localMods
        : localMods.filter((m) => selectedMods.has(m.folderName));
    if (modsToCheck.length === 0) {
      setLogs([
        {
          message: "没有可检查的 Mod",
          level: "warn",
        },
      ]);
      return;
    }
    let marketModNames = new Set();
    try {
      const config = await window.api.getConfig();
      const serverUrl = (
        config?.config?.serverUrl || SERVER_URL_DEFAULT
      ).replace(/\/$/, "");
      const res = await fetch(`${serverUrl}/api/mods?gameId=${gameId || ""}`);
      if (res.ok) {
        const data = await res.json();
        const mods = data.mods || [];
        for (const mod of mods) {
          if (mod.name) marketModNames.add(mod.name);
        }
      }
    } catch (e) {
      setLogs((prev) => [
        ...prev,
        {
          message: `获取市场数据失败: ${e.message}`,
          level: "warn",
        },
      ]);
    }
    setLogs((prev) => [
      ...prev,
      {
        message: `市场已有 ${marketModNames.size} 个 Mod，开始逐个检查...`,
        level: "info",
      },
    ]);
    const filtered = [];
    const skippedNoImage = [];
    const skippedDuplicate = [];
    for (let i = 0; i < modsToCheck.length; i++) {
      const mod = modsToCheck[i];
      setProgress({
        current: i + 1,
        total: modsToCheck.length,
        message: t("market.cloud.checkingMod", {
          char: mod.char,
          modName: mod.modName,
        }),
      });
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
      setLogs((prev) => [
        ...prev,
        {
          message: `无图片跳过 ${skippedNoImage.length} 个: ${skippedNoImage.map((m) => `[${m.char}]${m.modName}`).join(", ")}`,
          level: "warn",
        },
      ]);
    }
    if (skippedDuplicate.length > 0) {
      setLogs((prev) => [
        ...prev,
        {
          message: `市场重复跳过 ${skippedDuplicate.length} 个: ${skippedDuplicate.map((m) => `[${m.char}]${m.modName}`).join(", ")}`,
          level: "warn",
        },
      ]);
    }
    setLogs((prev) => [
      ...prev,
      {
        message: `符合条件: ${filtered.length} 个 Mod`,
        level: "info",
      },
    ]);
    if (filtered.length === 0) {
      setLogs((prev) => [
        ...prev,
        {
          message: "没有需要上传的 Mod，操作结束",
          level: "warn",
        },
      ]);
      return;
    }
    const filteredNames = filtered.map((m) => m.modName).join(",");
    setLogs((prev) => [
      ...prev,
      {
        message: `开始上传 ${filtered.length} 个 Mod...`,
        level: "info",
      },
    ]);
    await startOperation("upload", {
      modNames: filteredNames,
      _keepLogs: true,
    });
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
    const pending = (cloudItems || [])
      .filter((i) => i.status === "待发布")
      .map((i) => i.id);
    setSelectedPending(new Set(pending));
  }
  async function republishSelected() {
    if (!selectedPending.size) return;
    await startOperation("replace", {
      modIds: [...selectedPending].join(","),
    });
  }
  const modsByCharacter = {};
  localMods.forEach((m) => {
    if (!modsByCharacter[m.char]) modsByCharacter[m.char] = [];
    modsByCharacter[m.char].push(m);
  });
  return ReactDOM.createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="dev-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="batch-cloud-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="dev-panel-head">
          <div className="dev-panel-heading">
            <h2 id="batch-cloud-title" className="dev-panel-title">
              {t("market.cloud.batchTitle")}
            </h2>
            <span className="dev-panel-sub">
              {t("market.cloud.gameLabel", { gameId: gameId || "endfield" })}
            </span>
          </div>
          <button
            type="button"
            className="icon-btn icon-btn-sm"
            onClick={onClose}
            aria-label={t("common.actions.close")}
            title={t("common.actions.close")}
          >
            <Icon name="x" size={15} />
          </button>
        </header>
        <div className="dev-panel-body">
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
          {localMods.length > 0 && (
            <section className="dev-section">
              <div className="dev-section-title">
                <span>{t("market.cloud.localMods")}</span>
                <em>
                  {selectedMods === null ? localMods.length : selectedMods.size}
                  {"/"}
                  {localMods.length}
                </em>
                {loadingMods && <span className="spinner" aria-hidden="true" />}
                <button
                  type="button"
                  className={`chip dev-section-action ${selectedMods === null ? "active" : ""}`}
                  aria-pressed={selectedMods === null}
                  onClick={handleSelectAllMods}
                >
                  {t("common.actions.selectAll")}
                </button>
              </div>
              <div className="dev-rows dev-rows-scroll">
                {Object.entries(modsByCharacter).map(([char, mods]) => (
                  <React.Fragment key={char}>
                    <div className="dev-row-group">{char}</div>
                    {mods.map((m) => (
                      <label className="dev-row" key={m.folderName}>
                        <input
                          type="checkbox"
                          checked={isModSelected(m.folderName)}
                          onChange={() => toggleMod(m.folderName)}
                        />
                        <span className="dev-row-name">{m.modName}</span>
                        {m.modId && (
                          <code className="dev-row-meta">
                            {"#"}
                            {m.modId}
                          </code>
                        )}
                      </label>
                    ))}
                  </React.Fragment>
                ))}
              </div>
            </section>
          )}
          <label className="dev-check">
            <input
              type="checkbox"
              checked={force}
              onChange={(e) => setForce(e.target.checked)}
            />
            {t("market.cloud.forceOverwrite")}
          </label>
          <section className="dev-section">
            <div className="dev-section-title">
              <span>{t("market.cloud.imageRepair")}</span>
            </div>
            <div className="dev-inline">
              <button
                type="button"
                className="btn"
                onClick={fillMissingImages}
                disabled={fillRunning || running}
              >
                {fillRunning
                  ? t("market.cloud.fillingImages")
                  : t("market.cloud.fillMissingImages")}
              </button>
              <input
                type="password"
                className="input"
                value={adminKey}
                onChange={(e) => {
                  setAdminKey(e.target.value);
                  localStorage.setItem("qaqm-dev-admin-key", e.target.value);
                }}
                placeholder={t("settings.developer.adminKey")}
              />
            </div>
            {fillResult &&
              (fillResult.error ? (
                <div className="notice notice-danger" role="alert">
                  <Icon name="alert" size={14} />
                  <span className="selectable">{fillResult.error}</span>
                </div>
              ) : (
                <div className="notice notice-success">
                  <Icon name="check" size={14} />
                  <div className="dev-notice-body">
                    <div>
                      {t("market.cloud.fillImagesSummary", {
                        total: fillResult.total,
                        filled: fillResult.filled,
                        skipped: fillResult.skipped,
                        errorCount: fillResult.errorCount,
                      })}
                    </div>
                    {fillResult.filledList?.map((m) => (
                      <div key={m.id}>
                        {"#"}
                        {m.id} {m.name}
                      </div>
                    ))}
                    {fillResult.skippedList?.length > 0 && (
                      <div>
                        {t("market.cloud.skippedPrefix")}
                        {fillResult.skippedList
                          .map((m) => `#${m.id}(${m.reason})`)
                          .join(" · ")}
                      </div>
                    )}
                  </div>
                </div>
              ))}
          </section>
          {(running || result) && (
            <section className="dev-section">
              {running && (
                <React.Fragment>
                  <div className="dev-progress-head">
                    <span>{progress.message}</span>
                    <em>
                      {progress.current}
                      {"/"}
                      {progress.total}
                    </em>
                  </div>
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </React.Fragment>
              )}
              {result && (
                <div className={`notice ${result.errors > 0 ? "notice-danger" : "notice-success"}`}>
                  <Icon name={result.errors > 0 ? "alert" : "check"} size={14} />
                  <div className="dev-notice-body">
                    <div>
                      {t("market.cloud.resultSummary", {
                        success: result.success,
                        errors: result.errors,
                      })}
                    </div>
                    {result.errorList?.map((e, i) => (
                      <div key={i} className="selectable">
                        {e.char && `[${e.char}] `}
                        {e.mod && `${e.mod}: `}
                        {e.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}
          {cloudItems && !running && (
            <section className="dev-section">
              <div className="dev-section-title">
                <span>{t("market.cloud.compareSummary", { count: cloudItems.length })}</span>
                <span className="badge badge-warning">
                  {t("market.cloud.pendingCount", {
                    filterCount: cloudItems.filter((i) => i.status === "待发布").length,
                  })}
                </span>
                <span className="badge badge-success">
                  {t("market.cloud.publishedCount", {
                    filterCount: cloudItems.filter((i) => i.status === "已发布").length,
                  })}
                </span>
                <button
                  type="button"
                  className="btn btn-sm dev-section-action"
                  onClick={selectAllPending}
                >
                  {t("market.cloud.selectPending")}
                </button>
              </div>
              <div className="dev-rows dev-rows-scroll">
                {cloudItems.map((item) => (
                  <label className="dev-row" key={item.id}>
                    {item.status === "待发布" ? (
                      <input
                        type="checkbox"
                        checked={selectedPending.has(item.id)}
                        onChange={() => togglePending(item.id)}
                      />
                    ) : (
                      <span className="dev-row-check-gap" />
                    )}
                    <span
                      className={`badge ${item.status === "待发布" ? "badge-warning" : "badge-success"}`}
                    >
                      {item.status}
                    </span>
                    <span className="dev-row-name">
                      {"#"}
                      {item.id} {item.char && `[${item.char}] `}
                      {item.name}
                    </span>
                  </label>
                ))}
              </div>
              {selectedPending.size > 0 && (
                <div className="dev-inline">
                  <span className="dev-note">
                    {t("market.cloud.selectedPendingCount", { size: selectedPending.size })}
                  </span>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={republishSelected}
                    disabled={running}
                  >
                    {t("market.cloud.publishSelected")}
                  </button>
                </div>
              )}
            </section>
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
                <div className="dev-log selectable">
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
        </div>
        <footer className="dev-panel-foot">
          {logs.length > 0 && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                navigator.clipboard.writeText(logs.map((l) => l.message).join("\n"));
              }}
            >
              {t("market.cloud.copyLogs")}
            </button>
          )}
          <span className="dev-panel-foot-spacer" />
          <button type="button" className="btn" onClick={onClose} disabled={running}>
            {t("common.actions.close")}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => startOperation("list-cloud")}
            disabled={running}
          >
            {t("market.cloud.compare")}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => startOperation("replace")}
            disabled={running}
          >
            {t("market.cloud.replaceLinks")}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => startOperation("sync-upload")}
            disabled={running}
          >
            {t("market.cloud.uploadMissing")}
          </button>
          <button
            type="button"
            className="btn"
            onClick={smartUploadWithFilter}
            disabled={running}
          >
            {t("market.cloud.uploadWithImages")}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => startOperation("upload")}
            disabled={running}
          >
            {t("market.cloud.uploadAll")}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
export { BatchCloudPanel as default };
