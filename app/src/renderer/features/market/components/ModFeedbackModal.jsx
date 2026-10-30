import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
import ReactDOM from "react-dom";
import { readAuthSession } from "../../../lib/authSession.js";
function getFeedbackTypes() {
  return [
    {
      key: "cloud_invalid",
      label: t("market.feedback.cloudBroken"),
      description: t("market.feedback.cloudBrokenDescription"),
    },
    {
      key: "direct_invalid",
      label: t("market.feedback.downloadBroken"),
      description: t("market.feedback.downloadBrokenDescription"),
    },
  ];
}
function ModFeedbackModal({
  open,
  mod,
  clientId,
  serverUrl,
  onClose,
  onSubmitted,
}) {
  const [content, setContent] = React.useState("");
  const [contact, setContact] = React.useState("");
  const [submittingType, setSubmittingType] = React.useState("");
  const [history, setHistory] = React.useState([]);
  const [loadingHistory, setLoadingHistory] = React.useState(false);
  React.useEffect(() => {
    if (open) {
      setContent("");
      setContact("");
      setSubmittingType("");
      loadHistory();
    }
  }, [open, mod?.id]);
  React.useEffect(() => {
    if (!open) return void 0;
    function handleKey(event) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);
  async function loadHistory() {
    if (!clientId || !serverUrl) return;
    setLoadingHistory(true);
    try {
      const data = await window.api.fetchMyFeedback(serverUrl, clientId);
      if (data?.success && Array.isArray(data.feedbacks)) {
        const relevant = mod?.id
          ? data.feedbacks.filter((f) => String(f.modId) === String(mod.id))
          : data.feedbacks;
        setHistory(relevant);
      } else {
        setHistory([]);
      }
    } catch {
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }
  function getReporterName() {
    const session = readAuthSession(serverUrl);
    const names = [
      session?.user?.username,
      localStorage.getItem("comment-nickname"),
    ];
    return names.map((item) => String(item || "").trim()).find(Boolean) || "";
  }
  async function handleSubmit(feedbackType) {
    if (!mod?.id) return;
    const feedbackMeta = getFeedbackTypes().find(
      (item) => item.key === feedbackType,
    );
    if (!feedbackMeta) return;
    setSubmittingType(feedbackType);
    try {
      const session = readAuthSession(serverUrl);
      const response = await fetch(`${serverUrl}/api/mod-feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
          ...(session?.token
            ? {
                Authorization: `Bearer ${session.token}`,
              }
            : {}),
        },
        body: JSON.stringify({
          modId: mod.id,
          clientId,
          feedbackType,
          content: content.trim() || feedbackMeta.label,
          contact: contact.trim(),
          reporterName: getReporterName(),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || t("market.feedback.submitFailed"));
      }
      onSubmitted?.({
        type: "success",
        message:
          data.message ||
          t("market.feedback.submittedLabel", {
            label: feedbackMeta.label,
          }),
      });
      setContent("");
      setContact("");
      loadHistory();
    } catch (error) {
      onSubmitted?.({
        type: "error",
        message: error.message || t("market.feedback.submitFailed"),
      });
    } finally {
      setSubmittingType("");
    }
  }
  function formatTime(isoStr) {
    if (!isoStr) return "";
    try {
      return new Date(isoStr).toLocaleString("zh-CN");
    } catch {
      return isoStr;
    }
  }
  const statusMap = {
    pending: {
      label: t("market.feedback.pending"),
      badge: "badge-warning",
    },
    replied: {
      label: t("market.feedback.replied"),
      badge: "badge-info",
    },
    resolved: {
      label: t("market.feedback.resolved"),
      badge: "badge-success",
    },
    dismissed: {
      label: t("market.feedback.ignored"),
      badge: "",
    },
  };
  const feedbackTypeMap = {
    general: t("market.feedback.general"),
    cloud_invalid: t("market.feedback.cloudBroken"),
    direct_invalid: t("market.feedback.downloadBroken"),
  };
  const submitting = !!submittingType;
  if (!open || !mod) return null;
  return ReactDOM.createPortal(
    // Stacked above the market detail overlay, which it can be opened from.
    <div className="modal-backdrop market-stacked-backdrop" onClick={onClose}>
      <div
        className="modal-content mod-feedback-modal"
        role="dialog"
        aria-modal={true}
        aria-label={t("market.feedback.brokenLink")}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="dialog-title">{t("market.feedback.brokenLink")}</h3>
        <p className="dialog-desc">{mod.name}</p>
        <div className="dialog-body feedback-form">
          <label className="feedback-field">
            <span>{t("market.feedback.details")}</span>
            <textarea
              className="textarea"
              rows={3}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t("market.feedback.detailsPlaceholder")}
              disabled={submitting}
            />
          </label>
          <label className="feedback-field">
            <span>{t("market.feedback.contact")}</span>
            <input
              className="input"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder={t("market.feedback.contactPlaceholder")}
              disabled={submitting}
            />
          </label>
        </div>
        <div className="dialog-actions">
          <button
            type="button"
            className="btn btn-ghost feedback-cancel"
            onClick={onClose}
            disabled={submitting}
          >
            {t("common.actions.cancel")}
          </button>
          {[...getFeedbackTypes()].reverse().map((item) => (
            <button
              type="button"
              className={`btn ${item.key === "cloud_invalid" ? "btn-primary" : ""}`}
              title={item.description}
              onClick={() => handleSubmit(item.key)}
              disabled={submitting}
              key={item.key}
            >
              {submittingType === item.key
                ? t("common.status.submitting")
                : item.label}
            </button>
          ))}
        </div>
        {history.length > 0 && (
          <div className="feedback-history">
            <h4>{t("market.feedback.myRecords")}</h4>
            {history.map((item) => {
              const st = statusMap[item.status] || statusMap.pending;
              return (
                <div className="feedback-history-card" key={item.id}>
                  <div className="feedback-history-head">
                    <span>
                      {feedbackTypeMap[item.feedbackType || "general"] ||
                        t("market.feedback.title")}
                    </span>
                    <span className={`badge ${st.badge}`}>{st.label}</span>
                    <time>{formatTime(item.createdAt)}</time>
                  </div>
                  <div className="feedback-history-text selectable">
                    {item.content}
                  </div>
                  {item.adminReply && (
                    <div className="feedback-reply">
                      <div className="feedback-history-head">
                        <span>{t("market.feedback.adminReply")}</span>
                        <time>{formatTime(item.repliedAt)}</time>
                      </div>
                      <div className="feedback-history-text selectable">
                        {item.adminReply}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {loadingHistory && history.length === 0 && (
          <div className="feedback-loading" role="status">
            <span className="spinner" aria-hidden="true" />
            {t("market.feedback.loadingRecords")}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
export { ModFeedbackModal };
