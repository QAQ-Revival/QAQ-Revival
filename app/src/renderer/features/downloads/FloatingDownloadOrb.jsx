import { t } from "../../../shared/i18n/index.mjs";
import React from "react";
import ReactDOM from "react-dom";
import { Icon } from "../../components/Icon.jsx";
import {
  isNetworkDownloadFailure,
  getMarketNetdiskLinks,
} from "../../lib/downloadErrors.js";
import { recordMarketModDownload } from "../../lib/marketDownloadHistory.js";
const PANEL_WIDTH = 400;
const WINDOW_MARGIN = 12;
const ACTIVE_STATUSES = [
  "queued",
  "checking",
  "downloading",
  "installing",
  "paused",
];
const PAUSABLE_STATUSES = ["downloading", "paused"];
const CANCELABLE_STATUSES = ["queued", "checking", "downloading", "paused"];
const SLOW_SPEED_BPS = 200 * 1024;
const SLOW_DOWNLOAD_DELAY_MS = 10 * 1e3;
function formatTaskError(message, code = "") {
  const raw = String(message || "").trim();
  if (!raw) return "";
  if (code === "DOWNLOAD_STALLED") {
    return t("downloads.errors.stalled");
  }
  if (isNetworkDownloadFailure(raw, code)) {
    return t("downloads.errors.connection");
  }
  if (
    /LOGIN_REQUIRED|SESSION_EXPIRED/.test(code) ||
    /登录|LOGIN_REQUIRED|SESSION_EXPIRED/i.test(raw)
  ) {
    return t("downloads.errors.loginRequired");
  }
  if (
    /DIRECT_DOWNLOAD_REQUIRED|SPONSOR_REQUIRED/.test(code) ||
    /全部档|最高档|高速下载|直链下载|赞助|QAQ[MR] Plus|DIRECT_DOWNLOAD_REQUIRED|SPONSOR_REQUIRED/i.test(
      raw,
    )
  ) {
    return t("downloads.errors.sourceUnavailable");
  }
  return raw;
}
function formatBytes(value) {
  const bytes = Number(value || 0);
  if (!bytes) return "";
  if (bytes >= 1024 * 1024 * 1024)
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}
function getTaskElapsedMs(task) {
  const explicitElapsed = Number(task?.elapsedMs || 0);
  if (Number.isFinite(explicitElapsed) && explicitElapsed > 0)
    return explicitElapsed;
  const startedAt = Number(task?.downloadStartedAt || task?.createdAt || 0);
  if (!Number.isFinite(startedAt) || startedAt <= 0) return 0;
  return Date.now() - startedAt;
}
function shouldShowNetworkTip(task) {
  if (task?.status !== "downloading") return false;
  const speed = Number(task.speed || 0);
  const slowSpeed = speed > 0 && speed < SLOW_SPEED_BPS;
  const longEnough = getTaskElapsedMs(task) > SLOW_DOWNLOAD_DELAY_MS;
  return longEnough && (slowSpeed || speed === 0);
}
function isStoredDownload(task) {
  return task?.provider === "mega" || task?.provider === "archive";
}
function taskStatus(task, percent) {
  switch (task.status) {
    case "queued":
      return {
        label: t("downloads.status.waiting"),
        className: "badge",
      };
    case "completed":
      return {
        label: t("downloads.status.completed"),
        className: "badge badge-success",
      };
    case "canceled":
      return {
        label: t("downloads.status.canceled"),
        className: "badge",
      };
    case "error":
      return {
        label: t("common.status.failed"),
        className: "badge badge-danger",
      };
    case "installing":
      return {
        label: t("downloads.status.installing"),
        className: "badge badge-info",
      };
    case "checking":
      return {
        label: t("downloads.status.verifying"),
        className: "badge badge-info",
      };
    case "paused":
      return {
        label: t("downloads.status.paused"),
        className: "badge badge-warning",
      };
    default:
      return {
        label: `${percent}%`,
        className: "qaqm-download-percent",
      };
  }
}
// The download manager: a popover under the top bar button, fed by download events.
function FloatingDownloadOrb({ onImportTask }) {
  const [tasks, setTasks] = React.useState([]);
  const [panelOpen, setPanelOpen] = React.useState(false);
  const [panelAnchor, setPanelAnchor] = React.useState({
    right: WINDOW_MARGIN,
    top: 56,
  });
  const [importingTaskId, setImportingTaskId] = React.useState("");
  const importLock = React.useRef(false);
  const [, setClockTick] = React.useState(0);
  const panelDismissedRef = React.useRef(false);
  const panelRef = React.useRef(null);
  const deletedTaskIdsRef = React.useRef(new Set());
  React.useEffect(() => {
    for (const request of [
      window.api.megaRevivalTasks?.(),
      window.api.attachmentTasks?.(),
    ])
      request
        ?.then((result) => {
          if (result.success)
            setTasks((previous) => [
              ...new Map(
                [...result.tasks, ...previous].map((task) => [
                  task.taskId,
                  task,
                ]),
              ).values(),
            ]);
        })
        .catch(() => {});
  }, []);
  React.useEffect(() => {
    const report = () =>
      window.dispatchEvent(
        new CustomEvent("qaqm:download-summary", {
          detail: {
            open: panelOpen,
            count: tasks.filter((task) => ACTIVE_STATUSES.includes(task.status))
              .length,
          },
        }),
      );
    report();
    window.addEventListener("qaqm:request-download-summary", report);
    return () =>
      window.removeEventListener("qaqm:request-download-summary", report);
  }, [tasks, panelOpen]);
  React.useEffect(() => {
    const toggle = () => {
      setPanelOpen((value) => {
        panelDismissedRef.current = value;
        return !value;
      });
    };
    window.addEventListener("qaqm:toggle-download-panel", toggle);
    return () =>
      window.removeEventListener("qaqm:toggle-download-panel", toggle);
  }, []);
  React.useLayoutEffect(() => {
    if (!panelOpen) return void 0;
    const update = () => {
      const rect = document
        .querySelector(".topbar-download-button")
        ?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(PANEL_WIDTH, window.innerWidth - WINDOW_MARGIN * 2);
      setPanelAnchor({
        right: Math.max(
          WINDOW_MARGIN,
          Math.min(
            window.innerWidth - rect.right,
            window.innerWidth - width - WINDOW_MARGIN,
          ),
        ),
        top: rect.bottom + 12,
      });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [panelOpen]);
  React.useEffect(() => {
    if (!panelOpen) return void 0;
    const close = (event) => {
      if (event.type === "keydown" && event.key !== "Escape") return;
      if (
        event.type === "pointerdown" &&
        (panelRef.current?.contains(event.target) ||
          event.target.closest(".topbar-download-button"))
      )
        return;
      panelDismissedRef.current = true;
      setPanelOpen(false);
      if (event.type === "keydown")
        document.querySelector(".topbar-download-button")?.focus();
    };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", close);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("pointerdown", close);
    };
  }, [panelOpen]);
  async function controlStoredDownload(task, action) {
    const result = await (
      task.provider === "archive"
        ? window.api.attachmentControl
        : window.api.megaRevivalControl
    )({
      taskId: task.taskId,
      action,
    });
    if (!result?.success)
      setTasks((previous) =>
        previous.map((item) =>
          item.taskId === task.taskId
            ? {
                ...item,
                error: result?.error || t("downloads.errors.operation"),
              }
            : item,
        ),
      );
  }
  async function handleImportTask(task) {
    if (importLock.current) return;
    importLock.current = true;
    setImportingTaskId(task.taskId);
    setTasks((previous) =>
      previous.map((item) =>
        item.taskId === task.taskId
          ? {
              ...item,
              importError: "",
            }
          : item,
      ),
    );
    try {
      await onImportTask(task);
      panelDismissedRef.current = true;
      setPanelOpen(false);
    } catch (error) {
      setTasks((previous) =>
        previous.map((item) =>
          item.taskId === task.taskId
            ? {
                ...item,
                importError:
                  error.message || t("downloads.errors.prepareImport"),
              }
            : item,
        ),
      );
    } finally {
      importLock.current = false;
      setImportingTaskId("");
    }
  }
  React.useEffect(() => {
    if (!panelOpen || !tasks.some((task) => task.status === "downloading"))
      return void 0;
    const timer = window.setInterval(
      () => setClockTick((value) => value + 1),
      1e3,
    );
    return () => window.clearInterval(timer);
  }, [tasks, panelOpen]);
  React.useEffect(() => {
    if (!window.api?.onMarketDownloadProgress) return void 0;
    const off = window.api.onMarketDownloadProgress((progress) => {
      if (!progress?.taskId) return;
      if (deletedTaskIdsRef.current.has(progress.taskId)) return;
      setTasks((prev) => {
        const idx = prev.findIndex((task) => task.taskId === progress.taskId);
        const now = Date.now();
        if (idx === -1) {
          return [
            {
              ...progress,
              createdAt: now,
              downloadStartedAt: progress.status === "downloading" ? now : null,
            },
            ...prev,
          ];
        }
        const next = [...prev];
        const previous = next[idx];
        next[idx] = {
          ...previous,
          ...progress,
          downloadStartedAt:
            previous.downloadStartedAt ||
            progress.downloadStartedAt ||
            (progress.status === "downloading" ? now : null),
          updatedAt: now,
        };
        return next;
      });
      if (
        ["checking", "downloading", "installing"].includes(progress.status) &&
        !panelDismissedRef.current
      ) {
        setPanelOpen(true);
      }
    });
    return off;
  }, []);
  React.useEffect(() => {
    function onQueued(event) {
      const task = event?.detail;
      if (!task?.taskId) return;
      if (deletedTaskIdsRef.current.has(task.taskId)) return;
      setTasks((prev) => {
        if (prev.some((t2) => t2.taskId === task.taskId)) return prev;
        return [
          {
            ...task,
            createdAt: Date.now(),
          },
          ...prev,
        ];
      });
      panelDismissedRef.current = false;
      setPanelOpen(true);
    }
    window.addEventListener("qaqm:download-task-queued", onQueued);
    return () =>
      window.removeEventListener("qaqm:download-task-queued", onQueued);
  }, []);
  React.useEffect(() => {
    function onOpen() {
      panelDismissedRef.current = false;
      setPanelOpen(true);
    }
    window.addEventListener("qaqm:open-download-orb", onOpen);
    return () => window.removeEventListener("qaqm:open-download-orb", onOpen);
  }, []);
  const handlePanelClose = React.useCallback(() => {
    panelDismissedRef.current = true;
    setPanelOpen(false);
  }, []);
  const handleRetry = React.useCallback(async (task) => {
    if (isStoredDownload(task)) return controlStoredDownload(task, "retry");
    if (
      !task?.taskId ||
      !task?.retryPayload ||
      !window.api?.marketDownloadInstallMod
    )
      return;
    panelDismissedRef.current = false;
    setTasks((prev) =>
      prev.map((item) =>
        item.taskId === task.taskId
          ? {
              ...item,
              status: "queued",
              error: "",
              percent: 0,
              downloaded: 0,
              total: 0,
              speed: 0,
              updatedAt: Date.now(),
            }
          : item,
      ),
    );
    setPanelOpen(true);
    try {
      const result = await window.api.marketDownloadInstallMod({
        ...task.retryPayload,
        taskId: task.taskId,
      });
      if (result?.success) {
        recordMarketModDownload(task.retryPayload.mod);
      }
    } catch (error) {
      setTasks((prev) =>
        prev.map((item) =>
          item.taskId === task.taskId
            ? {
                ...item,
                status: "error",
                error: error?.message || t("common.errors.retryFailed"),
                updatedAt: Date.now(),
              }
            : item,
        ),
      );
    }
  }, []);
  const handleRetryInstall = React.useCallback(async (task) => {
    if (
      !task?.taskId ||
      !task?.archivePath ||
      !window.api?.marketRetryInstallDownloadedMod
    )
      return;
    setTasks((prev) =>
      prev.map((item) =>
        item.taskId === task.taskId
          ? {
              ...item,
              status: "installing",
              error: "",
              percent: 100,
              updatedAt: Date.now(),
            }
          : item,
      ),
    );
    setPanelOpen(true);
    try {
      const result = await window.api.marketRetryInstallDownloadedMod({
        taskId: task.taskId,
        archivePath: task.archivePath,
        mod: task.mod || task.retryPayload?.mod || {},
      });
      if (!result?.success) {
        setTasks((prev) =>
          prev.map((item) =>
            item.taskId === task.taskId
              ? {
                  ...item,
                  status: "error",
                  code: result?.code || item.code || "INSTALL_FAILED",
                  error:
                    result?.error || t("downloads.errors.installArchiveKept"),
                  archivePath: result?.archivePath || item.archivePath,
                  archiveFileName:
                    result?.archiveFileName || item.archiveFileName,
                  mod: result?.mod || item.mod,
                  updatedAt: Date.now(),
                }
              : item,
          ),
        );
      } else {
        recordMarketModDownload(task.mod || task.retryPayload?.mod);
      }
    } catch (error) {
      setTasks((prev) =>
        prev.map((item) =>
          item.taskId === task.taskId
            ? {
                ...item,
                status: "error",
                code: item.code || "INSTALL_FAILED",
                error:
                  error?.message ||
                  t("downloads.errors.retryInstallArchiveKept"),
                updatedAt: Date.now(),
              }
            : item,
        ),
      );
    }
  }, []);
  const handleOpenArchiveFolder = React.useCallback(async (task) => {
    if (isStoredDownload(task)) {
      const result = await (
        task.provider === "archive"
          ? window.api.attachmentOpen
          : window.api.megaRevivalOpen
      )(task.taskId);
      if (!result.success) {
        setTasks((previous) =>
          previous.map((item) =>
            item.taskId === task.taskId
              ? {
                  ...item,
                  error: result.error || t("downloads.errors.openSourceFolder"),
                }
              : item,
          ),
        );
      }
      return;
    }
    if (!task?.archivePath || !window.api?.marketOpenDownloadedArchiveFolder)
      return;
    const result = await window.api.marketOpenDownloadedArchiveFolder({
      archivePath: task.archivePath,
    });
    if (!result?.success) {
      setTasks((prev) =>
        prev.map((item) =>
          item.taskId === task.taskId
            ? {
                ...item,
                status: "error",
                error: result?.error || t("downloads.errors.openSourceFolder"),
                updatedAt: Date.now(),
              }
            : item,
        ),
      );
    }
  }, []);
  const handlePauseToggle = React.useCallback(async (task) => {
    if (isStoredDownload(task))
      return controlStoredDownload(
        task,
        task.status === "paused" ? "resume" : "pause",
      );
    if (!task?.taskId || !window.api?.marketDownloadControl) return;
    const paused = task.status === "paused";
    const nextStatus = paused ? "downloading" : "paused";
    setTasks((prev) =>
      prev.map((item) =>
        item.taskId === task.taskId
          ? {
              ...item,
              status: nextStatus,
              updatedAt: Date.now(),
            }
          : item,
      ),
    );
    const result = await window.api.marketDownloadControl({
      taskId: task.taskId,
      action: paused ? "resume" : "pause",
    });
    if (!result?.success) {
      setTasks((prev) =>
        prev.map((item) =>
          item.taskId === task.taskId
            ? {
                ...item,
                status: task.status,
                error: result?.error || t("downloads.errors.controlTask"),
                updatedAt: Date.now(),
              }
            : item,
        ),
      );
    }
  }, []);
  const handleCancel = React.useCallback(async (task) => {
    if (isStoredDownload(task)) return controlStoredDownload(task, "cancel");
    if (!task?.taskId || !window.api?.marketDownloadControl) return;
    setTasks((prev) =>
      prev.map((item) =>
        item.taskId === task.taskId
          ? {
              ...item,
              status: "canceled",
              error: t("downloads.status.canceledNotice"),
              updatedAt: Date.now(),
            }
          : item,
      ),
    );
    const result = await window.api.marketDownloadControl({
      taskId: task.taskId,
      action: "cancel",
    });
    if (!result?.success) {
      setTasks((prev) =>
        prev.map((item) =>
          item.taskId === task.taskId
            ? {
                ...item,
                status: "error",
                error: result?.error || t("downloads.errors.cancel"),
                updatedAt: Date.now(),
              }
            : item,
        ),
      );
    }
  }, []);
  const handleDeleteTask = React.useCallback(async (task) => {
    if (isStoredDownload(task)) {
      const result = await (
        task.provider === "archive"
          ? window.api.attachmentControl
          : window.api.megaRevivalControl
      )({
        taskId: task.taskId,
        action: "delete",
      });
      if (!result.success) {
        setTasks((previous) =>
          previous.map((item) =>
            item.taskId === task.taskId
              ? {
                  ...item,
                  error: result.error || t("downloads.errors.deleteTask"),
                }
              : item,
          ),
        );
        return;
      }
      deletedTaskIdsRef.current.add(task.taskId);
      setTasks((previous) =>
        previous.filter((item) => item.taskId !== task.taskId),
      );
      return;
    }
    if (!task?.taskId) return;
    deletedTaskIdsRef.current.add(task.taskId);
    setTasks((prev) => prev.filter((item) => item.taskId !== task.taskId));
    if (
      ACTIVE_STATUSES.includes(task.status) &&
      window.api?.marketDownloadControl
    ) {
      await window.api
        .marketDownloadControl({
          taskId: task.taskId,
          action: "cancel",
        })
        .catch(() => {});
    }
  }, []);
  const handleOpenInstalledTask = React.useCallback((task) => {
    if (task?.integratedPackage || task?.modMode === "integrated") return;
    const characterName =
      task?.characterName || task?.retryPayload?.mod?.characterName;
    const modName = task?.modName || task?.name;
    if (!characterName || !modName) return;
    window.dispatchEvent(
      new CustomEvent("qaqm-open-manager-target", {
        detail: {
          characterName,
          modName,
          gameId: task?.gameId || task?.retryPayload?.mod?.gameId || null,
        },
      }),
    );
    setPanelOpen(false);
  }, []);
  const handleOpenNetdisk = React.useCallback((link) => {
    if (!link?.url) return;
    window.api?.openExternalUrl?.(link.url);
    navigator.clipboard.writeText(link.url).catch(() => {});
  }, []);
  if (!panelOpen) return null;
  const node = (
    <div
      ref={panelRef}
      className="qaqm-download-panel"
      style={{
        top: panelAnchor.top,
        right: panelAnchor.right,
        maxHeight: `calc(100vh - ${panelAnchor.top + WINDOW_MARGIN}px)`,
      }}
      role="region"
      aria-label={t("downloads.tasks.title")}
    >
      <div className="qaqm-download-panel-head">
        <strong>{t("downloads.tasks.title")}</strong>
        <button
          type="button"
          className="icon-btn icon-btn-sm"
          onClick={() => {
            try {
              sessionStorage.setItem("qaqm.settings.category", "downloads");
            } catch {}
            window.dispatchEvent(
              new CustomEvent("qaqm:settings-section", {
                detail: {
                  category: "downloads",
                },
              }),
            );
            window.dispatchEvent(
              new CustomEvent("qaqm-navigate", {
                detail: {
                  tab: "settings",
                },
              }),
            );
            setPanelOpen(false);
          }}
          aria-label={t("downloads.tasks.settings")}
          title={t("downloads.tasks.settings")}
        >
          <Icon name="gear" size={15} />
        </button>
        <button
          type="button"
          className="icon-btn icon-btn-sm"
          onClick={handlePanelClose}
          aria-label={t("common.actions.close")}
          title={t("common.actions.close")}
        >
          <Icon name="x" size={15} />
        </button>
      </div>
      <div className="qaqm-download-list">
        {tasks.length === 0 && (
          <div className="empty-state qaqm-download-empty">
            <div className="empty-title">{t("downloads.empty")}</div>
          </div>
        )}
        {tasks.map((task) => {
          const taskPercent = Math.max(
            0,
            Math.min(100, Number(task.percent) || 0),
          );
          const isIntegratedPackage =
            !!task.integratedPackage || task.modMode === "integrated";
          const canOpenInstalled =
            task.status === "completed" &&
            !isIntegratedPackage &&
            (task.characterName || task.retryPayload?.mod?.characterName);
          const canRetryInstall =
            task.status === "error" &&
            task.archivePath &&
            task.code === "INSTALL_FAILED";
          const canOpenArchive =
            task.archivePath &&
            (task.status === "error" ||
              (isStoredDownload(task) &&
                ["completed", "paused", "canceled"].includes(task.status)));
          const canRetryDownload =
            (task.status === "error" ||
              (isStoredDownload(task) && task.status === "canceled")) &&
            task.retryPayload;
          const canImport =
            isStoredDownload(task) &&
            task.status === "completed" &&
            task.archivePath &&
            (task.provider !== "archive" || task.canImport);
          const networkTip =
            task.provider !== "mega" && shouldShowNetworkTip(task);
          const networkFailure =
            task.provider !== "mega" &&
            task.status === "error" &&
            (task.code === "DOWNLOAD_STALLED" ||
              isNetworkDownloadFailure(task.error, task.code));
          const waitingForFirstData =
            task.status === "downloading" &&
            taskPercent === 0 &&
            Number(task.downloaded || 0) === 0 &&
            Number(task.speed || 0) === 0;
          const netdiskLinks = networkFailure
            ? getMarketNetdiskLinks(task.mod || task.retryPayload?.mod)
            : [];
          const status = taskStatus(task, taskPercent);
          const meta =
            task.status === "canceled"
              ? ""
              : task.error
                ? formatTaskError(task.error, task.code)
                : waitingForFirstData
                  ? t("downloads.status.awaitingData")
                  : isIntegratedPackage
                    ? t("downloads.status.integratedInstalled", {
                        characterCount: task.characterCount || 0,
                        modCount: task.modCount || 0,
                      })
                    : task.renamedDueToDuplicate
                      ? t("downloads.status.nameConflictResolved", {
                          modName:
                            task.modName ||
                            task.name ||
                            t("downloads.tasks.newMod"),
                        })
                      : [
                          formatBytes(task.downloaded),
                          task.speed ? `${formatBytes(task.speed)}/s` : "",
                        ]
                          .filter(Boolean)
                          .join(" · ");
          return (
            <div
              className={`qaqm-download-item status-${task.status || "queued"}`}
              key={task.taskId}
            >
              <div className="qaqm-download-item-top">
                <span
                  className="qaqm-download-name"
                  title={task.name || task.fileName}
                >
                  {task.name ||
                    task.fileName ||
                    t("downloads.tasks.modDownload")}
                </span>
                <span className={status.className}>{status.label}</span>
                <button
                  type="button"
                  className="icon-btn icon-btn-sm qaqm-download-task-delete"
                  title={t("downloads.actions.deleteTask")}
                  aria-label={t("downloads.actions.deleteTask")}
                  onClick={() => handleDeleteTask(task)}
                >
                  <Icon name="x" size={14} />
                </button>
              </div>
              {task.status !== "canceled" && (
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${taskPercent}%`,
                    }}
                  />
                </div>
              )}
              {meta && (
                <div
                  className={`qaqm-download-meta ${task.status === "error" ? "is-error" : ""}`}
                >
                  {meta}
                </div>
              )}
              {networkTip && (
                <div className="qaqm-download-tip">
                  {t("downloads.hints.slowNetwork")}
                </div>
              )}
              {task.provider === "mega" && (
                <div className="qaqm-download-meta">
                  {[
                    task.currentFile,
                    task.filesTotal
                      ? t("downloads.status.fileProgress", {
                          filesCompleted: task.filesCompleted || 0,
                          filesTotal: task.filesTotal,
                        })
                      : t("downloads.status.resolvingMega"),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              )}
              {task.importError && (
                <div className="qaqm-download-tip is-danger" role="alert">
                  {task.importError}
                </div>
              )}
              {task.provider !== "mega" &&
                task.status === "error" &&
                task.archivePath && (
                  <div className="qaqm-download-meta">
                    {t("downloads.hints.archiveKept")}
                  </div>
                )}
              {(PAUSABLE_STATUSES.includes(task.status) ||
                CANCELABLE_STATUSES.includes(task.status) ||
                canRetryDownload ||
                canRetryInstall ||
                canOpenArchive ||
                canOpenInstalled ||
                canImport ||
                netdiskLinks.length > 0) && (
                <div className="qaqm-download-task-actions">
                  {PAUSABLE_STATUSES.includes(task.status) && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => handlePauseToggle(task)}
                    >
                      <Icon
                        name={task.status === "paused" ? "play" : "pause"}
                        size={13}
                      />
                      {task.status === "paused"
                        ? t("common.actions.continue")
                        : t("downloads.actions.pause")}
                    </button>
                  )}
                  {CANCELABLE_STATUSES.includes(task.status) && (
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      onClick={() => handleCancel(task)}
                    >
                      {t("common.actions.cancel")}
                    </button>
                  )}
                  {canRetryDownload && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => handleRetry(task)}
                    >
                      {t("downloads.actions.retryDownload")}
                    </button>
                  )}
                  {netdiskLinks.map((link) => (
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => handleOpenNetdisk(link)}
                      key={link.source}
                    >
                      {link.label}
                    </button>
                  ))}
                  {canRetryInstall && (
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={() => handleRetryInstall(task)}
                    >
                      {t("downloads.actions.retryInstall")}
                    </button>
                  )}
                  {canOpenArchive && (
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      onClick={() => handleOpenArchiveFolder(task)}
                    >
                      {t("characters.actions.openSource")}
                    </button>
                  )}
                  {canOpenInstalled && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => handleOpenInstalledTask(task)}
                    >
                      {t("downloads.actions.openManager")}
                    </button>
                  )}
                  {canImport && (
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      disabled={!!importingTaskId}
                      title={t("downloads.actions.importToCurrentGame")}
                      onClick={() => handleImportTask(task)}
                    >
                      {importingTaskId === task.taskId
                        ? t("downloads.status.preparingImport")
                        : t("characters.import.title")}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
  return ReactDOM.createPortal(node, document.body);
}
export { FloatingDownloadOrb };
