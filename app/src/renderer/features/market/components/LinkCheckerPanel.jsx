import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
import ReactDOM from "react-dom";
import { Icon } from "../../../components/Icon.jsx";
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
          message: `${r.error}`,
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
        message: `开始修复 ${targetIds.size} 个失效 Mod...`,
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
        message: `开始删除 ${count} 个幽灵 Mod...`,
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
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !running) onClose();
      }}
    >
      <div
        className="dev-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="link-checker-title"
      >
        <header className="dev-panel-head">
          <div className="dev-panel-heading">
            <h2 id="link-checker-title" className="dev-panel-title">
              {t("market.links.title")}
            </h2>
            {copyNotice && <span className="dev-panel-sub">{copyNotice}</span>}
          </div>
          <button
            type="button"
            className="icon-btn icon-btn-sm"
            onClick={copyPanelContent}
            aria-label={t("market.links.copyContent")}
            title={t("market.links.copyContent")}
          >
            <Icon name="copy" size={15} />
          </button>
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
          {(running || progress.message) && (
            <section className="dev-section">
              <div className="dev-progress-head">
                <span>{progress.message || t("common.status.preparing")}</span>
                {progress.total > 0 && (
                  <em>
                    {progress.current}
                    {"/"}
                    {progress.total}
                  </em>
                )}
              </div>
              {progress.total > 0 && (
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${Math.min(100, (progress.current / progress.total) * 100)}%`,
                    }}
                  />
                </div>
              )}
            </section>
          )}
          {brokenItems && brokenItems.length > 0 && (
            <section className="dev-section">
              <div className="dev-section-title">
                <span>{t("market.links.brokenCount", { brokenItemsCount: brokenItems.length })}</span>
                <button
                  type="button"
                  className="link-btn dev-section-action"
                  onClick={selectAllBroken}
                >
                  {t("common.actions.selectAll")}
                </button>
                <button type="button" className="link-btn" onClick={deselectAllBroken}>
                  {t("common.actions.clearSelection")}
                </button>
              </div>
              <div className="dev-rows dev-rows-scroll">
                {brokenItems.map((item) => (
                  <label className="dev-row" key={item.id}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.id)}
                      onChange={() => toggleId(item.id)}
                    />
                    <span className="dev-row-meta">{item.char}</span>
                    <span className="dev-row-name">{item.name}</span>
                    <code className="dev-row-meta">
                      {"#"}
                      {item.id}
                    </code>
                    <span
                      className={`badge ${item.baiduBroken && item.quarkBroken ? "badge-danger" : "badge-warning"}`}
                    >
                      {item.reason}
                    </span>
                  </label>
                ))}
              </div>
            </section>
          )}
          {brokenItems && brokenItems.length === 0 && !running && (
            <div className="notice notice-success">
              <Icon name="check" size={14} />
              <span>{t("market.links.allHealthy")}</span>
            </div>
          )}
          {ghostItems && ghostItems.length > 0 && (
            <section className="dev-section">
              <div className="dev-section-title">
                <span>{t("market.links.orphanCount", { ghostItemsCount: ghostItems.length })}</span>
                <button
                  type="button"
                  className="link-btn dev-section-action"
                  onClick={selectAllGhosts}
                >
                  {t("common.actions.selectAll")}
                </button>
                <button type="button" className="link-btn" onClick={deselectAllGhosts}>
                  {t("common.actions.clearSelection")}
                </button>
              </div>
              <div className="dev-rows dev-rows-scroll">
                {ghostItems.map((item) => (
                  <label className="dev-row" key={item.id}>
                    <input
                      type="checkbox"
                      checked={selectedGhostIds.has(item.id)}
                      onChange={() => toggleGhostId(item.id)}
                    />
                    <span className="dev-thumb">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt=""
                          onError={(e) => {
                            e.target.style.visibility = "hidden";
                          }}
                        />
                      ) : (
                        <Icon name="image" size={14} />
                      )}
                    </span>
                    <span className="dev-row-meta">{item.char}</span>
                    <span className="dev-row-name">{item.name}</span>
                    <code className="dev-row-meta">
                      {"#"}
                      {item.id}
                    </code>
                    {item.pinned && (
                      <span className="badge">{t("characters.actions.pinShort")}</span>
                    )}
                    <span className="badge badge-warning">{item.reason}</span>
                  </label>
                ))}
              </div>
              <div className="notice notice-warning">
                <Icon name="alert" size={14} />
                <span>{t("market.links.deleteWarning")}</span>
              </div>
            </section>
          )}
          {ghostItems && ghostItems.length === 0 && !running && (
            <div className="notice notice-success">
              <Icon name="check" size={14} />
              <span>{t("market.links.noOrphans")}</span>
            </div>
          )}
          {result && (
            <div className={`notice ${result.errors > 0 ? "notice-danger" : "notice-success"}`}>
              <Icon name={result.errors > 0 ? "alert" : "check"} size={14} />
              <div className="dev-notice-body">
                <div>
                  {t("market.links.fixCompleted", {
                    success: result.success,
                    errors: result.errors,
                  })}
                </div>
                {result.errorList?.map((e, i) => (
                  <div key={i} className="selectable">
                    {e.char && `[${e.char}] `}
                    {e.mod}
                    {": "}
                    {e.error}
                  </div>
                ))}
                {result.errors > 0 && lastFixItems.length > 0 && (
                  <div className="dev-inline">
                    <span>
                      {t("market.links.pendingKept", {
                        lastFixItemsCount: lastFixItems.length,
                      })}
                    </span>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={retryFailedFix}
                      disabled={running}
                    >
                      {t("market.links.retryFill")}
                    </button>
                    <button type="button" className="btn btn-sm" onClick={copyPanelContent}>
                      {t("market.links.copyResult")}
                    </button>
                  </div>
                )}
              </div>
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
                {t("market.links.logsHeading", { logsCount: logs.length })}
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
          {ghostItems && ghostItems.length > 0 && (
            <button
              type="button"
              className="btn btn-danger"
              onClick={startDeleteGhosts}
              disabled={running || selectedGhostIds.size === 0}
            >
              {t("market.links.deleteSelected", { size: selectedGhostIds.size })}
            </button>
          )}
          <span className="dev-panel-foot-spacer" />
          <button type="button" className="btn" onClick={startDetectGhosts} disabled={running}>
            {t("market.links.checkOrphans")}
          </button>
          <button
            type="button"
            className={`btn ${brokenItems?.length ? "" : "btn-primary"}`}
            onClick={startCheck}
            disabled={running}
          >
            {t("market.links.checkInvalid")}
          </button>
          {brokenItems && brokenItems.length > 0 && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => startFix()}
              disabled={running || selectedIds.size === 0}
            >
              {t("market.links.fixSelected", { size: selectedIds.size })}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
  return ReactDOM.createPortal(overlay, document.body);
}
export { LinkCheckerPanel as default };
