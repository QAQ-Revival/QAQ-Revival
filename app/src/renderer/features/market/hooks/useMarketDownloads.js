import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
import { readAuthSession } from "../../../lib/authSession.js";
import {
  getMarketDownloadedRecord,
  recordMarketModDownload,
} from "../../../lib/marketDownloadHistory.js";
import { createMarketSyncStatus } from "../model/marketSession.js";
import {
  getModGameId,
  hasMarketDirectSource,
} from "../model/marketCollections.js";
export function useMarketDownloads({
  serverUrl,
  setToast,
  clientId,
  setSyncStatus,
  silentlyRefreshMarket,
  syncMods,
}) {
  const [downloadPrompt, setDownloadPrompt] = React.useState(null);
  const marketDownloadInFlightRef = React.useRef(new Set());
  function getSavedAuthSession() {
    return readAuthSession(serverUrl);
  }
  async function handleDirectDownload(mod, scene) {
    if (!mod?.id) {
      setToast({
        type: "error",
        message: t("market.downloads.unrecognizedMod"),
      });
      return;
    }
    const downloadKey = `${getModGameId(mod)}:${String(mod.id)}`;
    if (marketDownloadInFlightRef.current.has(downloadKey)) {
      setToast({
        type: "error",
        message: t("market.downloads.alreadyQueued"),
      });
      return;
    }
    const session = getSavedAuthSession();
    if (!session?.token) {
      setDownloadPrompt({
        type: "login_required",
      });
      return;
    }
    if (!mod?.hasDirectInstall) {
      setToast({
        type: "error",
        message: t("market.downloads.noDirectLink"),
      });
      return;
    }
    const previousDownload = getMarketDownloadedRecord(mod);
    if (previousDownload) {
      const downloadedAt = Number(previousDownload.downloadedAt);
      const dateLabel =
        Number.isFinite(downloadedAt) && downloadedAt > 0
          ? t("market.downloads.previousDate", {
              value: new Date(downloadedAt).toLocaleString(),
            })
          : "";
      if (
        !window.confirm(
          t("market.downloads.confirmRedownload", {
            name: mod.name || t("market.downloads.thisMod"),
            dateLabel,
          }),
        )
      ) {
        return;
      }
    }
    marketDownloadInFlightRef.current.add(downloadKey);
    try {
      await executeDirectDownload(mod, scene, session);
    } catch (error2) {
      setToast({
        type: "error",
        message: error2?.message || t("downloads.status.failed"),
      });
    } finally {
      marketDownloadInFlightRef.current.delete(downloadKey);
    }
  }
  async function executeDirectDownload(mod, scene, session) {
    const taskId = `${mod.id}-${Date.now()}`;
    window.dispatchEvent(
      new CustomEvent("qaqm:download-task-queued", {
        detail: {
          taskId,
          status: "queued",
          modId: mod.id,
          name: mod.name,
          characterName: mod.characterName,
          gameId: getModGameId(mod),
          percent: 0,
          retryPayload: {
            serverUrl,
            authToken: session.token,
            authServerUrl: session.serverUrl,
            clientId,
            mod,
            scene,
          },
        },
      }),
    );
    const result = await window.api.marketDownloadInstallMod({
      taskId,
      serverUrl,
      authToken: session.token,
      authServerUrl: session.serverUrl,
      clientId,
      mod,
      scene,
    });
    if (!result?.success) {
      if (result?.canceled || result?.code === "DOWNLOAD_CANCELED") return;
      if (
        result?.code === "LOGIN_REQUIRED" ||
        result?.code === "SESSION_EXPIRED" ||
        result?.code === "MARKET_ACCESS_DENIED"
      ) {
        const marketAccess = {
          controlled: true,
          allowed: false,
          code: result.code,
          clearExisting: false,
        };
        setSyncStatus((prev) =>
          createMarketSyncStatus(
            {
              refreshBlocked: true,
              marketAccess,
              fromCache: true,
            },
            prev,
          ),
        );
        silentlyRefreshMarket({
          reason: "download-denied",
          forceFullSync: true,
        }).catch(() => {});
      }
      if (
        result?.code === "LOGIN_REQUIRED" ||
        result?.code === "SESSION_EXPIRED"
      ) {
        setDownloadPrompt({
          type: "login_required",
          sessionExpired: result?.code === "SESSION_EXPIRED",
        });
      } else if (result?.code === "MARKET_ACCESS_DENIED") {
        setToast({
          type: "error",
          message: t("market.downloads.noRefreshPermission"),
        });
      } else if (
        result?.code === "DIRECT_DOWNLOAD_REQUIRED" ||
        result?.code === "SPONSOR_REQUIRED"
      ) {
        setDownloadPrompt({
          type: "unavailable",
        });
      } else {
        setToast({
          type: "error",
          message: result?.error || t("downloads.status.failed"),
        });
      }
      return;
    }
    setToast({
      type: "success",
      message: result.renamedDueToDuplicate
        ? t("market.downloads.nameConflictResolved", {
            modName: result.modName || mod.name,
          })
        : t("market.downloads.installed"),
    });
    recordMarketModDownload(mod);
    syncMods(false).catch(() => {});
  }
  function shouldShowDirectDownload(mod) {
    return hasMarketDirectSource(mod) && Boolean(getSavedAuthSession()?.token);
  }
  function handleDownload(mod, downloadUrl, source, scene) {
    const downloadKey = `${getModGameId(mod)}:${String(mod?.id || "")}`;
    if (mod?.id && marketDownloadInFlightRef.current.has(downloadKey)) {
      setToast({
        type: "error",
        message: t("market.downloads.alreadyQueued"),
      });
      return;
    }
    const previousDownload = getMarketDownloadedRecord(mod);
    if (
      previousDownload &&
      !window.confirm(
        t("market.downloads.confirmReopenLink", {
          name: mod.name || t("market.downloads.thisMod"),
        }),
      )
    ) {
      return;
    }
    const modId = mod?.id;
    window.api.openExternalUrl(downloadUrl);
    navigator.clipboard.writeText(downloadUrl).catch(() => {});
    if (serverUrl && modId) {
      const session = getSavedAuthSession();
      fetch(`${serverUrl}/api/mods/${modId}/download-click`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.token
            ? {
                Authorization: `Bearer ${session.token}`,
              }
            : {}),
        },
        body: JSON.stringify({
          channel: "client",
          source,
          entry: "desktop_market",
          scene,
          clientId: clientId || null,
          gameId: getModGameId(mod),
          modMode: mod?.modMode || "d3d",
        }),
      }).catch(() => {});
    }
  }
  return {
    downloadPrompt,
    setDownloadPrompt,
    handleDirectDownload,
    shouldShowDirectDownload,
    handleDownload,
  };
}
