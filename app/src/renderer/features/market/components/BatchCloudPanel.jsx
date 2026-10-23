import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
import ReactDOM from "react-dom";
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
          message: `❌ ${r.error}`,
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
          message: "⚠️ 没有可检查的mod",
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
          message: `⚠️ 获取市场数据失败: ${e.message}`,
          level: "warn",
        },
      ]);
    }
    setLogs((prev) => [
      ...prev,
      {
        message: `📊 市场已有 ${marketModNames.size} 个mod，开始逐个检查...`,
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
          message: `⏭️ 无图片跳过 ${skippedNoImage.length} 个: ${skippedNoImage.map((m) => `[${m.char}]${m.modName}`).join(", ")}`,
          level: "warn",
        },
      ]);
    }
    if (skippedDuplicate.length > 0) {
      setLogs((prev) => [
        ...prev,
        {
          message: `⏭️ 市场重复跳过 ${skippedDuplicate.length} 个: ${skippedDuplicate.map((m) => `[${m.char}]${m.modName}`).join(", ")}`,
          level: "warn",
        },
      ]);
    }
    setLogs((prev) => [
      ...prev,
      {
        message: `✅ 符合条件: ${filtered.length} 个mod`,
        level: "info",
      },
    ]);
    if (filtered.length === 0) {
      setLogs((prev) => [
        ...prev,
        {
          message: "没有需要上传的mod，操作结束",
          level: "warn",
        },
      ]);
      return;
    }
    const filteredNames = filtered.map((m) => m.modName).join(",");
    setLogs((prev) => [
      ...prev,
      {
        message: `📤 开始上传 ${filtered.length} 个mod...`,
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
  const logColor = {
    info: "#d1d5db",
    warn: "#fbbf24",
    error: "#f87171",
    progress: "#818cf8",
  };
  return ReactDOM.createPortal(
    <div onClick={onClose} className="batch-cloud-panel-close-action">
      <div
        onClick={(e) => e.stopPropagation()}
        className="batch-cloud-panel-stack"
      >
        <div className="batch-cloud-panel-row">
          <div>
            <div className="batch-cloud-panel-heading">
              {t("market.cloud.batchTitle")}
            </div>
            <div className="batch-cloud-panel-hint">
              {t("market.cloud.gameLabel", {
                gameId: gameId || "endfield",
              })}
            </div>
          </div>
          <button onClick={onClose} className="batch-cloud-panel-close-icon">
            {"✕"}
          </button>
        </div>
        <div className="batch-cloud-panel-content">
          <div className="batch-cloud-panel-section">
            <div className="batch-cloud-panel-heading-emphasis">
              {t("market.cloud.chooseCharacters")}
            </div>
            <div className="batch-cloud-panel-character-options">
              <button
                onClick={handleSelectAll}
                style={{
                  borderRadius: "10px",
                  border: selectAll ? "none" : "1px solid #e5e7eb",
                  background: selectAll ? "#6366f1" : "#fff",
                  color: selectAll ? "#fff" : "#6b7280",
                }}
                className="batch-cloud-panel-select-all-action"
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
                      background: sel ? "#f59e0b" : "#fff",
                      color: sel ? "#fff" : "#6b7280",
                    }}
                    key={c}
                    className="batch-cloud-panel-action"
                  >
                    {c}
                  </button>
                );
              })}
            </div>
            {!selectAll && selectedChars.size > 0 && (
              <div className="batch-cloud-panel-selected-character-count">
                {t("market.cloud.selectedCharacterCount", {
                  size: selectedChars.size,
                })}
              </div>
            )}
          </div>
          {localMods.length > 0 && (
            <div className="batch-cloud-panel-mod-selection">
              <div className="batch-cloud-panel-mod-selection-toolbar">
                <div className="batch-cloud-panel-mod-selection-heading">
                  {t("market.cloud.localModsPrefix")}
                  {selectedMods === null
                    ? t("common.actions.selectAll")
                    : t("market.cloud.selectedCount", {
                        size: selectedMods.size,
                      })}
                  {"/"}
                  {localMods.length}
                  {"）"}
                  {loadingMods && (
                    <span className="batch-cloud-panel-content-emphasis">
                      {t("common.status.loading")}
                    </span>
                  )}
                </div>
                <button
                  onClick={handleSelectAllMods}
                  style={{
                    background: selectedMods === null ? "#6366f1" : "#fff",
                    color: selectedMods === null ? "#fff" : "#6b7280",
                  }}
                  className="batch-cloud-panel-select-all-mods-action"
                >
                  {t("common.actions.selectAll")}
                </button>
              </div>
              <div className="batch-cloud-panel-local-mod-list">
                {(() => {
                  const grouped = {};
                  localMods.forEach((m) => {
                    if (!grouped[m.char]) grouped[m.char] = [];
                    grouped[m.char].push(m);
                  });
                  return Object.entries(grouped).map(([char, mods]) => (
                    <div key={char}>
                      <div className="batch-cloud-panel-mod-group-character">
                        {char}
                      </div>
                      {mods.map((m) => (
                        <label
                          style={{
                            background: isModSelected(m.folderName)
                              ? "rgba(99,102,241,0.04)"
                              : "transparent",
                          }}
                          key={m.folderName}
                          className="batch-cloud-panel-row-spaced"
                        >
                          <input
                            type="checkbox"
                            checked={isModSelected(m.folderName)}
                            onChange={() => toggleMod(m.folderName)}
                          />
                          <span className="batch-cloud-panel-truncated-text">
                            {m.modName}
                          </span>
                          {m.modId && (
                            <span className="batch-cloud-panel-mod-id">
                              {"#"}
                              {m.modId}
                            </span>
                          )}
                        </label>
                      ))}
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}
          <label className="batch-cloud-panel-overwrite-option">
            <input
              type="checkbox"
              checked={force}
              onChange={(e) => setForce(e.target.checked)}
            />
            {t("market.cloud.forceOverwrite")}
          </label>
          <div className="batch-cloud-panel-image-repair">
            <div className="batch-cloud-panel-heading-emphasis">
              {t("market.cloud.imageRepair")}
            </div>
            <div className="batch-cloud-panel-image-repair-actions">
              <button
                onClick={fillMissingImages}
                disabled={fillRunning || running}
                style={{
                  cursor: fillRunning || running ? "default" : "pointer",
                  background:
                    fillRunning || running
                      ? "#d1d5db"
                      : "linear-gradient(135deg, #ec4899, #8b5cf6)",
                }}
                className="batch-cloud-panel-fill-missing-images-action"
              >
                {fillRunning
                  ? t("market.cloud.fillingImages")
                  : t("market.cloud.fillMissingImages")}
              </button>
              <input
                type="password"
                value={adminKey}
                onChange={(e) => {
                  setAdminKey(e.target.value);
                  localStorage.setItem("qaqm-dev-admin-key", e.target.value);
                }}
                placeholder={t("settings.developer.adminKey")}
                className="batch-cloud-panel-input-field"
              />
            </div>
            {fillResult && (
              <div
                style={{
                  borderRadius: "8px",
                  background: fillResult.error
                    ? "rgba(239,68,68,0.06)"
                    : "rgba(34,197,94,0.06)",
                  border: `1px solid ${fillResult.error ? "#fca5a5" : "#86efac"}`,
                }}
                className="batch-cloud-panel-image-repair-result"
              >
                {fillResult.error ? (
                  <div className="batch-cloud-panel-error-text">
                    {"❌ "}
                    {fillResult.error}
                  </div>
                ) : (
                  <div>
                    <div className="batch-cloud-panel-image-repair-summary">
                      {t("market.cloud.fillImagesSummary", {
                        total: fillResult.total,
                        filled: fillResult.filled,
                        skipped: fillResult.skipped,
                        errorCount: fillResult.errorCount,
                      })}
                    </div>
                    {fillResult.filledList?.length > 0 && (
                      <div className="batch-cloud-panel-repaired-mod-list">
                        {fillResult.filledList.map((m) => (
                          <div key={m.id}>
                            {"#"}
                            {m.id} {m.name}
                          </div>
                        ))}
                      </div>
                    )}
                    {fillResult.skippedList?.length > 0 && (
                      <div className="batch-cloud-panel-skipped-mod-summary">
                        {t("market.cloud.skippedPrefix")}
                        {fillResult.skippedList
                          .map((m) => `#${m.id}(${m.reason})`)
                          .join(" · ")}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="batch-cloud-panel-operation-actions">
            <button
              onClick={() => startOperation("sync-upload")}
              disabled={running}
              style={{
                cursor: running ? "default" : "pointer",
                background: running
                  ? "#d1d5db"
                  : "linear-gradient(135deg, #059669, #10b981)",
              }}
              className="batch-cloud-panel-action-emphasis"
            >
              {t("market.cloud.uploadMissing")}
            </button>
            <button
              onClick={() => startOperation("upload")}
              disabled={running}
              style={{
                cursor: running ? "default" : "pointer",
                background: running
                  ? "#d1d5db"
                  : "linear-gradient(135deg, #6366f1, #8b5cf6)",
              }}
              className="batch-cloud-panel-action-emphasis"
            >
              {t("market.cloud.uploadAll")}
            </button>
            <button
              onClick={smartUploadWithFilter}
              disabled={running}
              style={{
                cursor: running ? "default" : "pointer",
                background: running
                  ? "#d1d5db"
                  : "linear-gradient(135deg, #059669, #10b981)",
              }}
              className="batch-cloud-panel-action-emphasis"
            >
              {t("market.cloud.uploadWithImages")}
            </button>
            <button
              onClick={() => startOperation("replace")}
              disabled={running}
              style={{
                cursor: running ? "default" : "pointer",
                background: running
                  ? "#d1d5db"
                  : "linear-gradient(135deg, #f59e0b, #ef4444)",
              }}
              className="batch-cloud-panel-replace-links"
            >
              {t("market.cloud.replaceLinks")}
            </button>
            <button
              onClick={() => startOperation("list-cloud")}
              disabled={running}
              style={{
                cursor: running ? "default" : "pointer",
                background: running
                  ? "#d1d5db"
                  : "linear-gradient(135deg, #10b981, #0ea5e9)",
              }}
              className="batch-cloud-panel-replace-links"
            >
              {t("market.cloud.compare")}
            </button>
          </div>
          {(running || result) && (
            <div className="batch-cloud-panel-progress-section">
              {running && (
                <div>
                  <div className="batch-cloud-panel-progress-status">
                    <span>{progress.message}</span>
                    <span>
                      {progress.current}
                      {"/"}
                      {progress.total}
                    </span>
                  </div>
                  <div className="batch-cloud-panel-progress-track">
                    <div
                      style={{
                        width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`,
                      }}
                      className="batch-cloud-panel-progress-fill"
                    />
                  </div>
                </div>
              )}
              {result && (
                <div
                  style={{
                    borderRadius: "8px",
                    background:
                      result.errors > 0
                        ? "rgba(239,68,68,0.06)"
                        : "rgba(34,197,94,0.06)",
                    border: `1px solid ${result.errors > 0 ? "#fca5a5" : "#86efac"}`,
                  }}
                  className="batch-cloud-panel-hint-spaced"
                >
                  <div
                    style={{
                      color: result.errors > 0 ? "#ef4444" : "#16a34a",
                    }}
                    className="batch-cloud-panel-operation-summary"
                  >
                    {t("market.cloud.resultSummary", {
                      success: result.success,
                      errors: result.errors,
                    })}
                  </div>
                  {result.errorList && result.errorList.length > 0 && (
                    <div className="batch-cloud-panel-error-list">
                      {result.errorList.map((e, i) => (
                        <div key={i}>
                          {e.char && `[${e.char}] `}
                          {e.mod && `${e.mod}: `}
                          {e.error}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {cloudItems && !running && (
            <div className="batch-cloud-panel-section">
              <div className="batch-cloud-panel-comparison-toolbar">
                <div className="batch-cloud-panel-mod-selection-heading">
                  {t("market.cloud.compareResultPrefix")}
                  {cloudItems.length}
                  {t("market.cloud.modCountSuffix")}
                  <span className="batch-cloud-panel-error-text">
                    {t("market.cloud.pendingCount", {
                      filterCount: cloudItems.filter(
                        (i) => i.status === "待发布",
                      ).length,
                    })}
                  </span>
                  {" "}
                  <span className="batch-cloud-panel-published-count">
                    {t("market.cloud.publishedCount", {
                      filterCount: cloudItems.filter(
                        (i) => i.status === "已发布",
                      ).length,
                    })}
                  </span>
                </div>
                <button
                  onClick={selectAllPending}
                  className="batch-cloud-panel-select-all-pending-action"
                >
                  {t("market.cloud.selectPending")}
                </button>
              </div>
              <div className="batch-cloud-panel-comparison-list">
                {cloudItems.map((item) => (
                  <label
                    style={{
                      cursor: item.status === "待发布" ? "pointer" : "default",
                      background:
                        item.status === "待发布" && selectedPending.has(item.id)
                          ? "rgba(239,68,68,0.05)"
                          : "transparent",
                    }}
                    key={item.id}
                    className="batch-cloud-panel-comparison-item"
                  >
                    {item.status === "待发布" ? (
                      <input
                        type="checkbox"
                        checked={selectedPending.has(item.id)}
                        onChange={() => togglePending(item.id)}
                      />
                    ) : (
                      <span className="batch-cloud-panel-column" />
                    )}
                    <span
                      style={{
                        background:
                          item.status === "待发布" ? "#fee2e2" : "#dcfce7",
                        color: item.status === "待发布" ? "#b91c1c" : "#15803d",
                      }}
                      className="batch-cloud-panel-heading-spaced"
                    >
                      {item.status}
                    </span>
                    <span className="batch-cloud-panel-comparison-mod-name">
                      {"#"}
                      {item.id} {item.char && `[${item.char}] `}
                      {item.name}
                    </span>
                  </label>
                ))}
              </div>
              {selectedPending.size > 0 && (
                <div className="batch-cloud-panel-republish-actions">
                  <span className="batch-cloud-panel-selected-count">
                    {t("market.cloud.selectedPendingCount", {
                      size: selectedPending.size,
                    })}
                  </span>
                  <button
                    onClick={republishSelected}
                    disabled={running}
                    className="batch-cloud-panel-republish-selected-action"
                  >
                    {t("market.cloud.publishSelected")}
                  </button>
                </div>
              )}
            </div>
          )}
          {logs.length > 0 && (
            <div>
              <button
                onClick={() => setLogsCollapsed(!logsCollapsed)}
                className="batch-cloud-panel-logs-toggle"
              >
                {t("market.cloud.logsHeading", {
                  status: logsCollapsed ? "▶" : "▼",
                  logsCount: logs.length,
                })}
              </button>
              {!logsCollapsed && (
                <div className="batch-cloud-panel-panel">
                  {logs.map((log, i) => (
                    <div
                      style={{
                        color: logColor[log.level] || "#d1d5db",
                      }}
                      key={i}
                      className="batch-cloud-panel-log-entry"
                    >
                      {log.message}
                    </div>
                  ))}
                  {running && (
                    <div className="batch-cloud-panel-log-cursor">{"▋"}</div>
                  )}
                  <div ref={logEndRef} />
                </div>
              )}
            </div>
          )}
        </div>
        <div className="batch-cloud-panel-actions">
          {logs.length > 0 && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(
                  logs.map((l) => l.message).join("\n"),
                );
              }}
              className="batch-cloud-panel-action-spaced"
            >
              {t("market.cloud.copyLogs")}
            </button>
          )}
          <button
            onClick={onClose}
            disabled={running}
            style={{
              cursor: running ? "default" : "pointer",
            }}
            className="batch-cloud-panel-close-button"
          >
            {t("common.actions.close")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
export { BatchCloudPanel as default };
