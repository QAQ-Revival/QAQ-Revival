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
      emoji: "⏳",
      color: "#f59e0b",
    },
    replied: {
      label: t("market.feedback.replied"),
      emoji: "💬",
      color: "#10b981",
    },
    resolved: {
      label: t("market.feedback.resolved"),
      emoji: "✅",
      color: "#059669",
    },
    dismissed: {
      label: t("market.feedback.ignored"),
      emoji: "🔕",
      color: "#9ca3af",
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
    /* Keep feedback above the market detail overlay. The detail overlay
  sits above the market header, so this secondary modal must sit
  higher still. Without this override
  the shared .modal-backdrop class at z-index: 100 would cause the
  feedback panel to render behind the detail view when invoked from
  inside a mod's detail page, forcing the user to close the detail
  before the feedback form became visible. */
    <div
      className="modal-backdrop mod-feedback-modal-modal-backdrop-layout"
      onClick={onClose}
    >
      <div
        className="modal-content mod-feedback-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="feedback-head">
          <div>
            <div className="feedback-kicker">
              {t("market.feedback.brokenLink")}
            </div>
            <h3>{mod.name}</h3>
            <p>{t("market.feedback.description")}</p>
          </div>
          <button type="button" className="feedback-close" onClick={onClose}>
            {"✕"}
          </button>
        </div>
        <div className="feedback-quick-grid">
          {getFeedbackTypes().map((item) => (
            <button
              type="button"
              className="feedback-quick-card"
              onClick={() => handleSubmit(item.key)}
              disabled={submitting}
              key={item.key}
            >
              <span className="feedback-quick-title">
                {submittingType === item.key
                  ? t("common.status.submitting")
                  : item.label}
              </span>
              <span className="feedback-quick-desc">{item.description}</span>
            </button>
          ))}
        </div>
        <div className="feedback-form">
          <label className="feedback-field">
            <span>{t("market.feedback.details")}</span>
            <textarea
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t("market.feedback.detailsPlaceholder")}
              disabled={submitting}
            />
          </label>
          <label className="feedback-field">
            <span>{t("market.feedback.contact")}</span>
            <input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder={t("market.feedback.contactPlaceholder")}
              disabled={submitting}
            />
          </label>
          <div className="feedback-actions">
            <button
              type="button"
              className="btn"
              onClick={onClose}
              disabled={submitting}
            >
              {t("common.actions.cancel")}
            </button>
          </div>
        </div>
        {history.length > 0 && (
          <div className="feedback-history">
            <div className="feedback-history-title">
              {t("market.feedback.myRecords")}
            </div>
            {history.map((item) => {
              const st = statusMap[item.status] || statusMap.pending;
              return (
                <div className="feedback-history-card" key={item.id}>
                  <div className="fh-header">
                    <span className="fh-time">
                      {formatTime(item.createdAt)}
                    </span>
                    <span
                      className="fh-status"
                      style={{
                        color: st.color,
                      }}
                    >
                      {feedbackTypeMap[item.feedbackType || "general"] ||
                        t("market.feedback.title")}
                      {" · "}
                      {st.emoji} {st.label}
                    </span>
                  </div>
                  <div className="fh-content">{item.content}</div>
                  {item.adminReply && (
                    <div className="fh-reply">
                      <div className="fh-reply-header">
                        {t("market.feedback.adminReply")}
                        <span className="fh-reply-time">
                          {formatTime(item.repliedAt)}
                        </span>
                      </div>
                      <div className="fh-reply-body">{item.adminReply}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {loadingHistory && history.length === 0 && (
          <div className="mod-feedback-modal-hint">
            {t("market.feedback.loadingRecords")}
          </div>
        )}
        {null}
      </div>
    </div>,
    document.body,
  );
}
export { ModFeedbackModal };
