import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
import ReactDOM from "react-dom";
function LinkCheckerPanel({ gameId, onClose }) {
  const [running, setRunning] = React.useState(false);
  const [logs, setLogs] = React.useState([]);
  const [logsCollapsed, setLogsCollapsed] = React.useState(false);
  const [progress, setProgress] = React.useState({
    current: 0,
    total: 0,
    message: "",
  });
  const [brokenItems, setBrokenItems] = React.useState(null);
  const [selectedIds, setSelectedIds] = React.useState(new Set());
  const [ghostItems, setGhostItems] = React.useState(null);
  const [selectedGhostIds, setSelectedGhostIds] = React.useState(new Set());
  const [result, setResult] = React.useState(null);
  const [devConfig, setDevConfig] = React.useState({
    pythonPath: "python",
    scriptPath: "",
  });
  const [phase, setPhase] = React.useState("idle");
  const [lastFixItems, setLastFixItems] = React.useState([]);
  const [copyNotice, setCopyNotice] = React.useState("");
  const logEndRef = React.useRef(null);
  const cleanupRef = React.useRef([]);
  React.useEffect(() => {
    loadDevConfig();
    return () => {
      cleanupRef.current.forEach((fn) => fn?.());
    };
  }, []);
  React.useEffect(() => {
    if (logEndRef.current && !logsCollapsed) {
      logEndRef.current.scrollIntoView({
        behavior: "smooth",
      });
    }
  }, [logs, logsCollapsed]);
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
  async function resolveCurrentModsDir() {
    try {
      const r = await window.api.getConfig();
      const cfg = r?.config || {};
      const targetGameId = gameId || cfg.activeGame?.id || cfg.activeGameId;
      const game =
        (cfg.games || []).find((g) => g.id === targetGameId) || cfg.activeGame;
      return game?.modFolderPath || cfg.modsPath || "";
    } catch (_) {
      return "";
    }
  }
  async function runOperation(mode, extraParams = {}) {
    setRunning(true);
    setResult(null);
    setProgress({
      current: 0,
      total: 0,
      message: t("games.launch.launching"),
    });
    setLogsCollapsed(false);
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
              if (msg.mode === "ghosts") {
                setGhostItems(msg.items);
                setSelectedGhostIds(new Set(msg.items.map((i) => i.id)));
              } else {
                setBrokenItems(msg.items);
                setSelectedIds(new Set(msg.items.map((i) => i.id)));
              }
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
    const modsDir = extraParams.modsDir || (await resolveCurrentModsDir());
    const r = await window.api.devBatchCloudOp({
      mode,
      gameId: gameId || "endfield",
      modsDir,
      characters: "",
      password: "qsl",
      pythonPath: devConfig.pythonPath,
      scriptPath: devConfig.scriptPath,
      ...extraParams,
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
  async function startCheck() {
    setLogs([]);
    setBrokenItems(null);
    setSelectedIds(new Set());
    setPhase("checking");
    await runOperation("check-links");
    setPhase("checked");
  }
  async function startFix(targetIds = selectedIds, targetItems = brokenItems) {
    if (targetIds.size === 0) return;
    const pending = (targetItems || []).filter((i) => targetIds.has(i.id));
    setLastFixItems(pending);
    setLogs((prev) => [
      ...prev,
      {
        message: `🔧 开始修复 ${targetIds.size} 个失效mod...`,
        level: "info",
      },
    ]);
    setPhase("fixing");
    await runOperation("fix-links", {
      modIds: [...targetIds].join(","),
    });
    setPhase("checked");
  }
  function retryFailedFix() {
    if (!lastFixItems.length) return;
    const failedNames = new Set(
      (result?.errorList || []).map((e) => `${e.char || ""}::${e.mod || ""}`),
    );
    const matchedItems =
      failedNames.size > 0
        ? lastFixItems.filter((i) =>
            failedNames.has(`${i.char || ""}::${i.name || ""}`),
          )
        : [];
    const retryItems = matchedItems.length > 0 ? matchedItems : lastFixItems;
    const retryIds = new Set(retryItems.map((i) => i.id));
    setSelectedIds(retryIds);
    startFix(retryIds, lastFixItems);
  }
  function buildCopyText() {
    const lines = [];
    lines.push(t("market.links.title"));
    lines.push(
      t("market.cloud.gameLabel", {
        gameId: gameId || "endfield",
      }),
    );
    if (progress.message)
      lines.push(
        t("market.links.copyProgress", {
          message: progress.message,
          status:
            progress.total > 0 ? `${progress.current}/${progress.total}` : "",
        }),
      );
    if (brokenItems) {
      lines.push(
        t("market.links.copyBrokenCount", {
          brokenItemsCount: brokenItems.length,
        }),
      );
      brokenItems.forEach((item) =>
        lines.push(
          `[${item.char}] ${item.name} ID:${item.id} ${item.reason || ""}`,
        ),
      );
    }
    if (lastFixItems.length > 0) {
      lines.push(
        t("market.links.copyPendingCount", {
          lastFixItemsCount: lastFixItems.length,
        }),
      );
      lastFixItems.forEach((item) =>
        lines.push(`[${item.char}] ${item.name} ID:${item.id}`),
      );
    }
    if (ghostItems) {
      lines.push(
        t("market.links.copyOrphanCount", {
          ghostItemsCount: ghostItems.length,
        }),
      );
      ghostItems.forEach((item) =>
        lines.push(
          `[${item.char}] ${item.name} ID:${item.id} ${item.reason || ""}`,
        ),
      );
    }
    if (result) {
      lines.push(
        t("market.links.copyFixResult", {
          success: result.success || 0,
          errors: result.errors || 0,
        }),
      );
      (result.errorList || []).forEach((e) =>
        lines.push(
          t("market.links.copyFailure", {
            status: e.char ? `[${e.char}] ` : "",
            mod: e.mod || "",
            error: e.error || "",
          }),
        ),
      );
    }
    if (logs.length > 0) {
      lines.push(t("market.links.copyLogsHeading"));
      logs.forEach((log) => lines.push(log.message));
    }
    return lines.join("\n");
  }
  async function copyPanelContent() {
    try {
      await navigator.clipboard.writeText(buildCopyText());
      setCopyNotice(t("common.status.copied"));
      setTimeout(() => setCopyNotice(""), 1500);
    } catch (_) {
      setCopyNotice(t("common.errors.copyFailed"));
      setTimeout(() => setCopyNotice(""), 1500);
    }
  }
  async function startDetectGhosts() {
    setLogs([]);
    setGhostItems(null);
    setSelectedGhostIds(new Set());
    setPhase("detecting");
    await runOperation("detect-ghosts");
    setPhase("checked");
  }
  async function startDeleteGhosts() {
    if (selectedGhostIds.size === 0) return;
    const count = selectedGhostIds.size;
    const ok = window.confirm(
      t("market.links.confirmDeleteOrphans", {
        count,
      }),
    );
    if (!ok) return;
    setLogs((prev) => [
      ...prev,
      {
        message: `🗑️ 开始删除 ${count} 个幽灵 mod...`,
        level: "info",
      },
    ]);
    setPhase("deleting");
    await runOperation("delete-mods", {
      modIds: [...selectedGhostIds].join(","),
    });
    setGhostItems((prev) =>
      prev ? prev.filter((i) => !selectedGhostIds.has(i.id)) : prev,
    );
    setSelectedGhostIds(new Set());
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
    setSelectedIds(new Set());
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
    setSelectedGhostIds(new Set());
  }
  const overlay = (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && !running) onClose();
      }}
      className="link-checker-panel-overlay"
    >
      <div className="link-checker-panel-stack">
        <div className="link-checker-panel-row">
          <div className="link-checker-panel-heading">
            {t("market.links.title")}
          </div>
          <div className="link-checker-panel-header-actions">
            {copyNotice && (
              <span
                style={{
                  color:
                    copyNotice === t("common.status.copied")
                      ? "#16a34a"
                      : "#dc2626",
                }}
                className="link-checker-panel-hint"
              >
                {copyNotice}
              </span>
            )}
            <button
              onClick={copyPanelContent}
              className="link-checker-panel-copy-panel-content-action"
            >
              {t("market.links.copyContent")}
            </button>
            <div
              onClick={() => !running && onClose()}
              style={{
                cursor: running ? "default" : "pointer",
              }}
              className="link-checker-panel-content"
            >
              {"✕"}
            </div>
          </div>
        </div>
        <div className="link-checker-panel-content-spaced">
          <div className="link-checker-panel-scan-actions">
            <button
              onClick={startCheck}
              disabled={running}
              style={{
                cursor: running ? "default" : "pointer",
                background: running
                  ? "#d1d5db"
                  : "linear-gradient(135deg, #6366f1, #8b5cf6)",
              }}
              className="link-checker-panel-start-check-action"
            >
              {t("market.links.checkInvalid")}
            </button>
            <button
              onClick={startDetectGhosts}
              disabled={running}
              style={{
                cursor: running ? "default" : "pointer",
                background: running
                  ? "#d1d5db"
                  : "linear-gradient(135deg, #0891b2, #06b6d4)",
              }}
              className="link-checker-panel-start-check-action"
            >
              {t("market.links.checkOrphans")}
            </button>
            {brokenItems && brokenItems.length > 0 && (
              <button
                onClick={() => startFix()}
                disabled={running || selectedIds.size === 0}
                style={{
                  cursor:
                    running || selectedIds.size === 0 ? "default" : "pointer",
                  background:
                    running || selectedIds.size === 0
                      ? "#d1d5db"
                      : "linear-gradient(135deg, #ef4444, #f97316)",
                }}
                className="link-checker-panel-start-check-action"
              >
                {t("market.links.fixSelected", {
                  size: selectedIds.size,
                })}
              </button>
            )}
            {ghostItems && ghostItems.length > 0 && (
              <button
                onClick={startDeleteGhosts}
                disabled={running || selectedGhostIds.size === 0}
                style={{
                  cursor:
                    running || selectedGhostIds.size === 0
                      ? "default"
                      : "pointer",
                  background:
                    running || selectedGhostIds.size === 0
                      ? "#d1d5db"
                      : "linear-gradient(135deg, #991b1b, #dc2626)",
                }}
                className="link-checker-panel-start-check-action"
              >
                {t("market.links.deleteSelected", {
                  size: selectedGhostIds.size,
                })}
              </button>
            )}
          </div>
          {(running || progress.message) && (
            <div className="link-checker-panel-panel">
              <div className="link-checker-panel-progress-status">
                <span className="link-checker-panel-progress-message">
                  {progress.message || t("common.status.preparing")}
                </span>
                {progress.total > 0 && (
                  <span className="link-checker-panel-progress-count">
                    {progress.current}
                    {"/"}
                    {progress.total}
                  </span>
                )}
              </div>
              {progress.total > 0 && (
                <div className="link-checker-panel-progress-track">
                  <div
                    style={{
                      width: `${Math.min(100, (progress.current / progress.total) * 100)}%`,
                    }}
                    className="link-checker-panel-progress-fill"
                  />
                </div>
              )}
            </div>
          )}
          {brokenItems && brokenItems.length > 0 && (
            <div className="link-checker-panel-result-section">
              <div className="link-checker-panel-result-toolbar">
                <span className="link-checker-panel-heading-emphasis">
                  {t("market.links.brokenCount", {
                    brokenItemsCount: brokenItems.length,
                  })}
                </span>
                <div className="link-checker-panel-selection-actions">
                  <button
                    onClick={selectAllBroken}
                    className="link-checker-panel-select-all-broken-action"
                  >
                    {t("common.actions.selectAll")}
                  </button>
                  <button
                    onClick={deselectAllBroken}
                    className="link-checker-panel-select-all-broken-action"
                  >
                    {t("common.actions.clearSelection")}
                  </button>
                </div>
              </div>
              <div className="link-checker-panel-result-list">
                {brokenItems.map((item) => (
                  <label
                    style={{
                      background: selectedIds.has(item.id) ? "#fef2f2" : "#fff",
                    }}
                    key={item.id}
                    className="link-checker-panel-result-item"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.id)}
                      onChange={() => toggleId(item.id)}
                    />
                    <span className="link-checker-panel-result-character">
                      {"["}
                      {item.char}
                      {"]"}
                    </span>
                    <span className="link-checker-panel-result-mod-name">
                      {item.name}
                    </span>
                    <span className="link-checker-panel-result-meta">
                      {"ID:"}
                      {item.id}
                    </span>
                    <span
                      style={{
                        background:
                          item.baiduBroken && item.quarkBroken
                            ? "#fecaca"
                            : "#fed7aa",
                        color:
                          item.baiduBroken && item.quarkBroken
                            ? "#991b1b"
                            : "#9a3412",
                      }}
                      className="link-checker-panel-hint-spaced"
                    >
                      {item.reason}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
          {brokenItems && brokenItems.length === 0 && !running && (
            <div className="link-checker-panel-healthy-summary">
              {t("market.links.allHealthy")}
            </div>
          )}
          {ghostItems && ghostItems.length > 0 && (
            <div className="link-checker-panel-result-section">
              <div className="link-checker-panel-result-toolbar">
                <span className="link-checker-panel-orphan-summary">
                  {t("market.links.orphanCount", {
                    ghostItemsCount: ghostItems.length,
                  })}
                </span>
                <div className="link-checker-panel-selection-actions">
                  <button
                    onClick={selectAllGhosts}
                    className="link-checker-panel-select-all-broken-action"
                  >
                    {t("common.actions.selectAll")}
                  </button>
                  <button
                    onClick={deselectAllGhosts}
                    className="link-checker-panel-select-all-broken-action"
                  >
                    {t("common.actions.clearSelection")}
                  </button>
                </div>
              </div>
              <div className="link-checker-panel-result-list">
                {ghostItems.map((item) => (
                  <label
                    style={{
                      background: selectedGhostIds.has(item.id)
                        ? "#ecfeff"
                        : "#fff",
                    }}
                    key={item.id}
                    className="link-checker-panel-result-item"
                  >
                    <input
                      type="checkbox"
                      checked={selectedGhostIds.has(item.id)}
                      onChange={() => toggleGhostId(item.id)}
                    />
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt=""
                        onError={(e) => {
                          e.target.style.visibility = "hidden";
                        }}
                        className="link-checker-panel-mod-thumbnail"
                      />
                    ) : (
                      <div className="link-checker-panel-thumbnail-fallback">
                        {"👻"}
                      </div>
                    )}
                    <span className="link-checker-panel-result-character">
                      {"["}
                      {item.char}
                      {"]"}
                    </span>
                    <span className="link-checker-panel-result-mod-name">
                      {item.name}
                    </span>
                    <span className="link-checker-panel-result-meta">
                      {"ID:"}
                      {item.id}
                    </span>
                    {item.pinned && (
                      <span className="link-checker-panel-pinned-badge">
                        {t("characters.actions.pinShort")}
                      </span>
                    )}
                    <span className="link-checker-panel-panel-spaced">
                      {item.reason}
                    </span>
                  </label>
                ))}
              </div>
              <div className="link-checker-panel-delete-warning">
                {t("market.links.deleteWarning")}
              </div>
            </div>
          )}
          {ghostItems && ghostItems.length === 0 && !running && (
            <div className="link-checker-panel-healthy-summary">
              {t("market.links.noOrphans")}
            </div>
          )}
          {result && (
            <div
              style={{
                background: result.errors > 0 ? "#fef2f2" : "#f0fdf4",
              }}
              className="link-checker-panel-repair-result"
            >
              <div
                style={{
                  color: result.errors > 0 ? "#dc2626" : "#16a34a",
                }}
                className="link-checker-panel-repair-summary"
              >
                {t("market.links.fixCompleted", {
                  success: result.success,
                  errors: result.errors,
                })}
              </div>
              {result.errorList?.length > 0 && (
                <div className="link-checker-panel-error-list">
                  {result.errorList.map((e, i) => (
                    <div key={i} className="link-checker-panel-error-item">
                      {"• "}
                      {e.char && `[${e.char}] `}
                      {e.mod}
                      {": "}
                      {e.error}
                    </div>
                  ))}
                </div>
              )}
              {result.errors > 0 && lastFixItems.length > 0 && (
                <div className="link-checker-panel-retry-actions">
                  <span className="link-checker-panel-result-meta">
                    {t("market.links.pendingKept", {
                      lastFixItemsCount: lastFixItems.length,
                    })}
                  </span>
                  <button
                    onClick={retryFailedFix}
                    disabled={running}
                    style={{
                      cursor: running ? "default" : "pointer",
                    }}
                    className="link-checker-panel-retry-failed-fix-action"
                  >
                    {t("market.links.retryFill")}
                  </button>
                  <button
                    onClick={copyPanelContent}
                    className="link-checker-panel-copy-result"
                  >
                    {t("market.links.copyResult")}
                  </button>
                </div>
              )}
            </div>
          )}
          {logs.length > 0 && (
            <div className="link-checker-panel-log-section">
              <div
                onClick={() => setLogsCollapsed(!logsCollapsed)}
                className="link-checker-panel-logs-toggle"
              >
                {t("market.links.logsHeading", {
                  status: logsCollapsed ? "▶" : "▼",
                  logsCount: logs.length,
                })}
              </div>
              {!logsCollapsed && (
                <div className="link-checker-panel-log-output">
                  {logs.map((log, i) => (
                    <div
                      style={{
                        color:
                          log.level === "error"
                            ? "#f87171"
                            : log.level === "warn"
                              ? "#fbbf24"
                              : "#d1d5db",
                      }}
                      key={i}
                      className="link-checker-panel-log-entry"
                    >
                      {log.message}
                    </div>
                  ))}
                  <div ref={logEndRef} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
  return ReactDOM.createPortal(overlay, document.body);
}
export { LinkCheckerPanel as default };
