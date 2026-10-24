import { t } from "../../../shared/i18n/index.mjs";
import React from "react";
import ReactDOM from "react-dom";
import {
  isNetworkDownloadFailure,
  getMarketNetdiskLinks,
} from "../../lib/downloadErrors.js";
import { recordMarketModDownload } from "../../lib/marketDownloadHistory.js";
const STORAGE_KEY = "qaqm.download.orbPos.v1";
const ORB_SIZE = 56;
const EDGE_MARGIN = 16;
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
function loadStoredPosition() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const { side, top } = parsed;
    if (side !== "left" && side !== "right") return null;
    if (typeof top !== "number" || !Number.isFinite(top)) return null;
    return {
      side,
      top,
    };
  } catch {
    return null;
  }
}
function defaultPosition() {
  const viewportH = typeof window !== "undefined" ? window.innerHeight : 800;
  return {
    side: "right",
    top: Math.max(EDGE_MARGIN, Math.round(viewportH / 2 - ORB_SIZE / 2)),
  };
}
function clampTop(top) {
  if (typeof window === "undefined") return top;
  const max = window.innerHeight - ORB_SIZE - EDGE_MARGIN;
  return Math.max(EDGE_MARGIN, Math.min(max, top));
}
function isStoredDownload(task) {
  return task?.provider === "mega" || task?.provider === "archive";
}
function FloatingDownloadOrb({ onImportTask }) {
  const [tasks, setTasks] = React.useState([]);
  const [panelOpen, setPanelOpen] = React.useState(false);
  const [panelAnchor, setPanelAnchor] = React.useState({
    left: 240,
    top: 90,
  });
  const [importingTaskId, setImportingTaskId] = React.useState("");
  const importLock = React.useRef(false);
  const [visible, setVisible] = React.useState(false);
  const [, setClockTick] = React.useState(0);
  const [position, setPosition] = React.useState(
    () => loadStoredPosition() || defaultPosition(),
  );
  const [dragging, setDragging] = React.useState(false);
  const [panelOffsetY, setPanelOffsetY] = React.useState(0);
  const dragInfoRef = React.useRef(null);
  const dragMovedRef = React.useRef(false);
  const hiddenByUserRef = React.useRef(false);
  const panelDismissedRef = React.useRef(false);
  const orbRef = React.useRef(null);
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
      setVisible(true);
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
    if (!panelOpen) return;
    const update = () => {
      const rect = document
        .querySelector(".sidebar-download-button")
        ?.getBoundingClientRect();
      if (rect)
        setPanelAnchor({
          left: Math.max(
            12,
            Math.min(
              rect.right + 12,
              window.innerWidth - Math.min(440, window.innerWidth - 24) - 12,
            ),
          ),
          top: Math.min(rect.top, Math.max(12, window.innerHeight - 280)),
        });
    };
    update();
    const observer = new ResizeObserver(update);
    const sidebar = document.querySelector(".sidebar");
    if (sidebar) observer.observe(sidebar);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [panelOpen]);
  React.useEffect(() => {
    if (!panelOpen) return;
    const close = (event) => {
      if (event.type === "keydown" && event.key !== "Escape") return;
      if (
        event.type === "pointerdown" &&
        (panelRef.current?.contains(event.target) ||
          event.target.closest(".sidebar-download-button"))
      )
        return;
      panelDismissedRef.current = true;
      setPanelOpen(false);
      if (event.type === "keydown")
        document.querySelector(".sidebar-download-button")?.focus();
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
    if (dragging) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
    } catch (_) {}
  }, [position, dragging]);
  React.useEffect(() => {
    if (!visible || !tasks.some((task) => task.status === "downloading"))
      return void 0;
    const timer = window.setInterval(
      () => setClockTick((value) => value + 1),
      1e3,
    );
    return () => window.clearInterval(timer);
  }, [tasks, visible]);
  React.useEffect(() => {
    if (!window.api?.onMarketDownloadProgress) return void 0;
    const off = window.api.onMarketDownloadProgress((progress) => {
      if (!progress?.taskId) return;
      if (deletedTaskIdsRef.current.has(progress.taskId)) return;
      if (!hiddenByUserRef.current) setVisible(true);
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
      hiddenByUserRef.current = false;
      panelDismissedRef.current = false;
      setVisible(true);
      setPanelOpen(true);
    }
    window.addEventListener("qaqm:download-task-queued", onQueued);
    return () =>
      window.removeEventListener("qaqm:download-task-queued", onQueued);
  }, []);
  React.useEffect(() => {
    function onOpen() {
      hiddenByUserRef.current = false;
      panelDismissedRef.current = false;
      setVisible(true);
      setPanelOpen(true);
    }
    window.addEventListener("qaqm:open-download-orb", onOpen);
    return () => window.removeEventListener("qaqm:open-download-orb", onOpen);
  }, []);
  React.useEffect(() => {
    function onResize() {
      setPosition((prev) => ({
        ...prev,
        top: clampTop(prev.top),
      }));
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  React.useEffect(() => {
    if (!panelOpen || !panelRef.current) {
      setPanelOffsetY(0);
      return void 0;
    }
    const panel = panelRef.current;
    const updatePanelOffset = () => {
      const panelHeight = panel.offsetHeight;
      const maxTop = Math.max(
        EDGE_MARGIN,
        window.innerHeight - panelHeight - EDGE_MARGIN,
      );
      const nextTop = Math.max(EDGE_MARGIN, Math.min(maxTop, position.top));
      const nextOffset = nextTop - position.top;
      setPanelOffsetY((current) =>
        current === nextOffset ? current : nextOffset,
      );
    };
    updatePanelOffset();
    const resizeObserver =
      typeof ResizeObserver === "function"
        ? new ResizeObserver(updatePanelOffset)
        : null;
    resizeObserver?.observe(panel);
    window.addEventListener("resize", updatePanelOffset);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updatePanelOffset);
    };
  }, [panelOpen, position.top]);
  const activeCount = React.useMemo(
    () => tasks.filter((t2) => ACTIVE_STATUSES.includes(t2.status)).length,
    [tasks],
  );
  const latest = tasks[0] || null;
  const percent = Math.max(0, Math.min(100, Number(latest?.percent) || 0));
  const handlePointerDown = React.useCallback((e) => {
    if (e.button !== 0) return;
    const rect = orbRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragInfoRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    };
    dragMovedRef.current = false;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (_) {}
  }, []);
  const handlePointerMove = React.useCallback((e) => {
    const info = dragInfoRef.current;
    if (!info || info.pointerId !== e.pointerId) return;
    const dx = e.clientX - info.startX;
    const dy = e.clientY - info.startY;
    if (!dragMovedRef.current && Math.hypot(dx, dy) < 4) return;
    dragMovedRef.current = true;
    setDragging(true);
    setPanelOpen(false);
    const nextLeft = e.clientX - info.offsetX;
    const nextTop = clampTop(e.clientY - info.offsetY);
    setPosition({
      side: "free",
      top: nextTop,
      left: nextLeft,
    });
  }, []);
  const handlePointerUp = React.useCallback((e) => {
    const info = dragInfoRef.current;
    if (!info || info.pointerId !== e.pointerId) return;
    dragInfoRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (_) {}
    if (!dragMovedRef.current) {
      setDragging(false);
      return;
    }
    setDragging(false);
    setPosition((prev) => {
      const viewportW = window.innerWidth;
      const left =
        typeof prev.left === "number"
          ? prev.left
          : prev.side === "left"
            ? EDGE_MARGIN
            : viewportW - ORB_SIZE - EDGE_MARGIN;
      const centerX = left + ORB_SIZE / 2;
      const side = centerX < viewportW / 2 ? "left" : "right";
      return {
        side,
        top: clampTop(prev.top),
      };
    });
  }, []);
  const handleOrbClick = React.useCallback((e) => {
    if (dragMovedRef.current) {
      dragMovedRef.current = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    setPanelOpen((open) => {
      const next = !open;
      panelDismissedRef.current = !next;
      return next;
    });
  }, []);
  const handlePanelClose = React.useCallback(() => {
    panelDismissedRef.current = true;
    setPanelOpen(false);
  }, []);
  const handleOrbDoubleClick = React.useCallback((e) => {
    dragMovedRef.current = false;
    e.preventDefault();
    e.stopPropagation();
    setPanelOpen(false);
    hiddenByUserRef.current = true;
    panelDismissedRef.current = true;
    setVisible(false);
  }, []);
  const handleRetry = React.useCallback(async (task) => {
    if (isStoredDownload(task)) return controlStoredDownload(task, "retry");
    if (
      !task?.taskId ||
      !task?.retryPayload ||
      !window.api?.marketDownloadInstallMod
    )
      return;
    hiddenByUserRef.current = false;
    panelDismissedRef.current = false;
    setVisible(true);
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
  if (!visible) return null;
  const orbStyle =
    position.side === "free"
      ? {
          left: `${position.left}px`,
          top: `${position.top}px`,
          right: "auto",
          bottom: "auto",
        }
      : position.side === "left"
        ? {
            left: `${EDGE_MARGIN}px`,
            top: `${position.top}px`,
            right: "auto",
            bottom: "auto",
          }
        : {
            right: `${EDGE_MARGIN}px`,
            top: `${position.top}px`,
            left: "auto",
            bottom: "auto",
          };
  const node = (
    <div
      className={`qaqm-download-float sidebar-download-panel ${panelOpen ? "open" : ""}`}
      style={{
        left: panelAnchor.left,
        top: panelAnchor.top,
      }}
    >
      {false && (
        <button
          ref={orbRef}
          className={`qaqm-download-orb ${dragging ? "dragging" : ""}`}
          type="button"
          title={t("downloads.tasks.dragHint")}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onClick={handleOrbClick}
          onDoubleClick={handleOrbDoubleClick}
        >
          <span
            className="qaqm-download-orb-ring"
            style={{
              "--progress": `${percent}%`,
            }}
          />
          <span className="qaqm-download-orb-inner">
            <span className="qaqm-download-plus-mark">{"DL"}</span>
            {activeCount > 0 && (
              <span className="qaqm-download-orb-badge">
                {activeCount > 99 ? "99+" : activeCount}
              </span>
            )}
          </span>
        </button>
      )}
      {panelOpen && (
        <div
          ref={panelRef}
          className={`qaqm-download-panel side-${position.side === "left" ? "left" : "right"}`}
          style={{
            maxHeight: `calc(100vh - ${panelAnchor.top + 12}px)`,
          }}
          role="region"
          aria-label={t("downloads.tasks.title")}
        >
          <div className="qaqm-download-panel-head">
            <strong>{t("downloads.tasks.title")}</strong>
            <div className="qaqm-download-panel-head-actions">
              <button
                type="button"
                onClick={() => {
                  try {
                    sessionStorage.setItem(
                      "qaqm.settings.category",
                      "downloads",
                    );
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
                {"⚙"}
              </button>
              <button
                type="button"
                onClick={handlePanelClose}
                aria-label={t("common.actions.close")}
              >
                {"×"}
              </button>
            </div>
          </div>
          <div className="qaqm-download-list">
            {tasks.length === 0 && (
              <div className="qaqm-download-empty">{t("downloads.empty")}</div>
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
              return (
                <div
                  className={`qaqm-download-item status-${task.status || "queued"}`}
                  key={task.taskId}
                >
                  <div className="qaqm-download-item-top">
                    <span>
                      {task.name ||
                        task.fileName ||
                        t("downloads.tasks.modDownload")}
                    </span>
                    <div className="qaqm-download-item-status-wrap">
                      <em>
                        {task.status === "completed"
                          ? t("downloads.status.completed")
                          : task.status === "canceled"
                            ? t("downloads.status.canceled")
                            : task.status === "error"
                              ? t("common.status.failed")
                              : task.status === "installing"
                                ? t("downloads.status.installing")
                                : task.status === "checking"
                                  ? t("downloads.status.verifying")
                                  : task.status === "paused"
                                    ? t("downloads.status.paused")
                                    : `${taskPercent}%`}
                      </em>
                      <button
                        type="button"
                        className="qaqm-download-task-delete"
                        title={t("downloads.actions.deleteTaskHint")}
                        aria-label={t("downloads.actions.deleteTask")}
                        onClick={() => handleDeleteTask(task)}
                      >
                        {"×"}
                      </button>
                    </div>
                  </div>
                  <div className="qaqm-download-progress">
                    <i
                      style={{
                        width: `${taskPercent}%`,
                      }}
                    />
                  </div>
                  <div className="qaqm-download-meta">
                    {task.error
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
                                task.speed
                                  ? `${formatBytes(task.speed)}/s`
                                  : "",
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                  </div>
                  {networkTip && (
                    <div className="qaqm-download-tip">
                      {t("downloads.hints.slowNetwork")}
                    </div>
                  )}
                  {networkFailure && netdiskLinks.length > 0 && (
                    <div className="qaqm-download-tip qaqm-download-network-fallback">
                      {t("downloads.hints.externalLink")}
                    </div>
                  )}
                  {task.provider === "mega" && (
                    <div className="qaqm-download-retained">
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
                    <div className="qaqm-download-settings-error" role="alert">
                      {task.importError}
                    </div>
                  )}
                  {task.provider !== "mega" &&
                    task.status === "error" &&
                    task.archivePath && (
                      <div className="qaqm-download-retained">
                        {t("downloads.hints.archiveKept")}
                      </div>
                    )}
                  {(PAUSABLE_STATUSES.includes(task.status) ||
                    CANCELABLE_STATUSES.includes(task.status) ||
                    canRetryDownload ||
                    canRetryInstall ||
                    canOpenArchive ||
                    canOpenInstalled ||
                    canImport) && (
                    <div className="qaqm-download-task-actions">
                      {PAUSABLE_STATUSES.includes(task.status) && (
                        <button
                          type="button"
                          className="qaqm-download-action"
                          onClick={() => handlePauseToggle(task)}
                        >
                          {task.status === "paused"
                            ? t("common.actions.continue")
                            : t("downloads.actions.pause")}
                        </button>
                      )}
                      {CANCELABLE_STATUSES.includes(task.status) && (
                        <button
                          type="button"
                          className="qaqm-download-action danger"
                          onClick={() => handleCancel(task)}
                        >
                          {t("common.actions.cancel")}
                        </button>
                      )}
                      {canRetryDownload && (
                        <button
                          type="button"
                          className="qaqm-download-action danger"
                          onClick={() => handleRetry(task)}
                        >
                          {t("downloads.actions.retryDownload")}
                        </button>
                      )}
                      {netdiskLinks.map((link) => (
                        <button
                          type="button"
                          className="qaqm-download-action primary"
                          onClick={() => handleOpenNetdisk(link)}
                          key={link.source}
                        >
                          {link.label}
                        </button>
                      ))}
                      {canRetryInstall && (
                        <button
                          type="button"
                          className="qaqm-download-action primary"
                          onClick={() => handleRetryInstall(task)}
                        >
                          {t("downloads.actions.retryInstall")}
                        </button>
                      )}
                      {canOpenArchive && (
                        <button
                          type="button"
                          className="qaqm-download-action"
                          onClick={() => handleOpenArchiveFolder(task)}
                        >
                          {t("characters.actions.openSource")}
                        </button>
                      )}
                      {canOpenInstalled && (
                        <button
                          type="button"
                          className="qaqm-download-action primary"
                          onClick={() => handleOpenInstalledTask(task)}
                        >
                          {t("downloads.actions.openManager")}
                        </button>
                      )}
                      {canImport && (
                        <button
                          type="button"
                          className="qaqm-download-action primary"
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
      )}
    </div>
  );
  return ReactDOM.createPortal(node, document.body);
}
export { FloatingDownloadOrb };
