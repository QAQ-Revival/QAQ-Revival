import { r as reactExports, R as ReactDOM, j as jsxRuntimeExports, b as readAuthSession, c as getAuthSessionIdentity, s as subscribeAuthSession, n as normalizeApiBaseUrl, d as getMarketDownloadedRecord, e as recordMarketModDownload, h as runSyncFallbackChain } from "./index.js";
import { g as getCanonicalClientId, a as getCachedClientId } from "./clientIdentity.js";
function ModFeedbackModal({ open, mod, clientId, serverUrl, onClose, onSubmitted }) {
  const [content, setContent] = reactExports.useState("");
  const [contact, setContact] = reactExports.useState("");
  const [submittingType, setSubmittingType] = reactExports.useState("");
  const [history, setHistory] = reactExports.useState([]);
  const [loadingHistory, setLoadingHistory] = reactExports.useState(false);
  reactExports.useEffect(() => {
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
        const relevant = mod?.id ? data.feedbacks.filter((f) => String(f.modId) === String(mod.id)) : data.feedbacks;
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
      localStorage.getItem("comment-nickname")
    ];
    return names.map((item) => String(item || "").trim()).find(Boolean) || "";
  }
  async function handleSubmit(feedbackType) {
    if (!mod?.id) return;
    const feedbackMeta = FEEDBACK_TYPES.find((item) => item.key === feedbackType);
    if (!feedbackMeta) return;
    setSubmittingType(feedbackType);
    try {
      const session = readAuthSession(serverUrl);
      const response = await fetch(`${serverUrl}/api/mod-feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
          ...session?.token ? { Authorization: `Bearer ${session.token}` } : {}
        },
        body: JSON.stringify({
          modId: mod.id,
          clientId,
          feedbackType,
          content: content.trim() || feedbackMeta.label,
          contact: contact.trim(),
          reporterName: getReporterName()
        })
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "反馈提交失败");
      }
      onSubmitted?.({ type: "success", message: data.message || `${feedbackMeta.label}已提交` });
      setContent("");
      setContact("");
      loadHistory();
    } catch (error) {
      onSubmitted?.({ type: "error", message: error.message || "反馈提交失败" });
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
    pending: { label: "等待处理", emoji: "⏳", color: "#f59e0b" },
    replied: { label: "已回复", emoji: "💬", color: "#10b981" },
    resolved: { label: "已解决", emoji: "✅", color: "#059669" },
    dismissed: { label: "已忽略", emoji: "🔕", color: "#9ca3af" }
  };
  const feedbackTypeMap = {
    general: "普通反馈",
    cloud_invalid: "网盘失效",
    direct_invalid: "下载失效"
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
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "modal-backdrop", style: { zIndex: 13200 }, onClick: onClose, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "modal-content mod-feedback-modal", onClick: (e) => e.stopPropagation(), children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "feedback-head", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "feedback-kicker", children: "失效反馈" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: mod.name }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: "选择具体失效类型，服务器会把同一个 Mod 的反馈聚合到后台卡片里，方便管理员集中补链。" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: "feedback-close", onClick: onClose, children: "✕" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "feedback-quick-grid", children: FEEDBACK_TYPES.map((item) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "button",
        {
          type: "button",
          className: "feedback-quick-card",
          onClick: () => handleSubmit(item.key),
          disabled: submitting,
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "feedback-quick-title", children: submittingType === item.key ? "提交中..." : item.label }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "feedback-quick-desc", children: item.description })
          ]
        },
        item.key
      )) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "feedback-form", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "feedback-field", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "补充说明" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "textarea",
            {
              rows: 4,
              value: content,
              onChange: (e) => setContent(e.target.value),
              placeholder: "可选。例如：百度盘 404、夸克提示资源违规、下载提示文件不存在等",
              disabled: submitting
            }
          )
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "feedback-field", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "联系方式" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "input",
            {
              value: contact,
              onChange: (e) => setContact(e.target.value),
              placeholder: "可选，方便管理员联系你",
              disabled: submitting
            }
          )
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "feedback-actions", children: /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: "btn", onClick: onClose, disabled: submitting, children: "取消" }) })
      ] }),
      history.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "feedback-history", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "feedback-history-title", children: "📋 我的反馈记录" }),
        history.map((item) => {
          const st = statusMap[item.status] || statusMap.pending;
          return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "feedback-history-card", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "fh-header", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "fh-time", children: formatTime(item.createdAt) }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "fh-status", style: { color: st.color }, children: [
                feedbackTypeMap[item.feedbackType || "general"] || "反馈",
                " · ",
                st.emoji,
                " ",
                st.label
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "fh-content", children: item.content }),
            item.adminReply && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "fh-reply", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "fh-reply-header", children: [
                "💬 管理员回复",
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "fh-reply-time", children: formatTime(item.repliedAt) })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "fh-reply-body", children: item.adminReply })
            ] })
          ] }, item.id);
        })
      ] }),
      loadingHistory && history.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { padding: "16px 24px", textAlign: "center", color: "#9ca3af", fontSize: 13 }, children: "加载反馈记录中..." }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("style", { children: `
                    .mod-feedback-modal {
                        width: min(600px, 92vw);
                        max-height: 85vh;
                        border-radius: 22px;
                        overflow: hidden;
                        overflow-y: auto;
                        background: rgba(255,255,255,0.97);
                        box-shadow: 0 24px 56px rgba(15, 23, 42, 0.2);
                    }
                    .mod-feedback-modal::-webkit-scrollbar {
                        width: 6px;
                    }
                    .mod-feedback-modal::-webkit-scrollbar-thumb {
                        background: rgba(255, 182, 193, 0.5);
                        border-radius: 10px;
                    }
                    .feedback-head {
                        position: relative;
                        padding: 22px 24px 18px;
                        background: linear-gradient(135deg, rgba(255, 182, 193, 0.35), rgba(255, 228, 225, 0.5));
                        text-align: center;
                    }
                    .feedback-head > div:first-child {
                        max-width: 440px;
                        margin: 0 auto;
                    }
                    .feedback-kicker {
                        margin-bottom: 6px;
                        font-size: 11px;
                        font-weight: 800;
                        letter-spacing: 0.08em;
                        text-transform: uppercase;
                        color: #e91e63;
                    }
                    .feedback-head h3 {
                        margin: 0 0 8px 0;
                        font-size: 22px;
                        color: #1f2937;
                    }
                    .feedback-head p {
                        margin: 0;
                        font-size: 13px;
                        line-height: 1.7;
                        color: rgba(55, 65, 81, 0.76);
                    }
                    .feedback-close {
                        position: absolute;
                        top: 16px;
                        right: 16px;
                        width: 38px;
                        height: 38px;
                        border: none;
                        border-radius: 999px;
                        background: rgba(255,255,255,0.74);
                        cursor: pointer;
                        color: #6b7280;
                        font-size: 16px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        transition: background 0.2s;
                    }
                    .feedback-close:hover {
                        background: rgba(255,255,255,0.95);
                    }
                    .feedback-form {
                        display: grid;
                        gap: 14px;
                        padding: 16px 24px 18px;
                    }
                    .feedback-quick-grid {
                        display: grid;
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                        gap: 12px;
                        padding: 20px 24px 0;
                    }
                    .feedback-quick-card {
                        display: grid;
                        gap: 8px;
                        text-align: left;
                        border: 1px solid rgba(233, 30, 99, 0.22);
                        border-radius: 16px;
                        padding: 16px;
                        background: rgba(255, 250, 250, 0.78);
                        color: #1f2937;
                        cursor: pointer;
                        transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
                    }
                    .feedback-quick-card:hover:not(:disabled) {
                        transform: translateY(-1px);
                        border-color: rgba(233, 30, 99, 0.45);
                        box-shadow: 0 12px 28px rgba(233, 30, 99, 0.12);
                    }
                    .feedback-quick-card:disabled {
                        opacity: 0.68;
                        cursor: wait;
                    }
                    .feedback-quick-title {
                        font-size: 15px;
                        font-weight: 800;
                    }
                    .feedback-quick-desc {
                        font-size: 12px;
                        line-height: 1.55;
                        color: #6b7280;
                    }
                    .feedback-field {
                        display: grid;
                        gap: 7px;
                    }
                    .feedback-field span {
                        font-size: 13px;
                        font-weight: 700;
                        color: #374151;
                    }
                    .feedback-field textarea,
                    .feedback-field input {
                        width: 100%;
                        padding: 10px 14px;
                        border-radius: 12px;
                        border: 1px solid rgba(255, 182, 193, 0.5);
                        font: inherit;
                        font-size: 13px;
                        color: #1f2937;
                        background: rgba(255, 250, 250, 0.6);
                        transition: border-color 0.2s, box-shadow 0.2s;
                    }
                    .feedback-field textarea {
                        resize: vertical;
                    }
                    .feedback-field textarea:focus,
                    .feedback-field input:focus {
                        outline: none;
                        border-color: rgba(233, 30, 99, 0.45);
                        box-shadow: 0 0 0 3px rgba(233, 30, 99, 0.1);
                    }
                    .feedback-actions {
                        display: flex;
                        justify-content: flex-end;
                        gap: 10px;
                    }
                    .feedback-history {
                        padding: 0 24px 20px;
                    }
                    .feedback-history-title {
                        font-size: 14px;
                        font-weight: 700;
                        color: #374151;
                        padding: 10px 0 12px;
                        border-top: 1px solid rgba(255, 182, 193, 0.3);
                        margin-top: 2px;
                    }
                    .feedback-history-card {
                        background: rgba(255, 250, 250, 0.7);
                        border: 1px solid rgba(255, 182, 193, 0.3);
                        border-radius: 14px;
                        padding: 14px 16px;
                        margin-bottom: 10px;
                    }
                    .fh-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 8px;
                    }
                    .fh-time {
                        font-size: 12px;
                        color: #9ca3af;
                    }
                    .fh-status {
                        font-size: 12px;
                        font-weight: 700;
                    }
                    .fh-content {
                        font-size: 13px;
                        color: #374151;
                        line-height: 1.65;
                        white-space: pre-wrap;
                    }
                    .fh-reply {
                        margin-top: 10px;
                        padding: 10px 14px;
                        background: linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(5, 150, 105, 0.06));
                        border: 1px solid rgba(16, 185, 129, 0.25);
                        border-radius: 12px;
                    }
                    .fh-reply-header {
                        font-size: 12px;
                        font-weight: 700;
                        color: #059669;
                        margin-bottom: 6px;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    }
                    .fh-reply-time {
                        font-weight: 400;
                        color: #9ca3af;
                        font-size: 11px;
                    }
                    .fh-reply-body {
                        font-size: 13px;
                        color: #374151;
                        line-height: 1.65;
                        white-space: pre-wrap;
                    }
                    @media (max-width: 640px) {
                        .feedback-quick-grid {
                            grid-template-columns: 1fr;
                        }
                        .feedback-actions {
                            flex-direction: column-reverse;
                        }
                        .feedback-actions .btn {
                            width: 100%;
                        }
                    }
                ` })
    ] }) }),
    document.body
  );
}
const RANDOM_PREFIXES = ["旅行者", "星际旅客", "像素猎人", "模组爱好者", "赛博游侠", "数据猎手", "虚拟探险家", "次元行者"];
const commentsMemoryCache = /* @__PURE__ */ new Map();
function getCommentsCacheKey(serverUrl, modId) {
  return `${serverUrl}|${modId}`;
}
function readCommentsCache(serverUrl, modId) {
  if (!serverUrl || !modId) return null;
  return commentsMemoryCache.get(getCommentsCacheKey(serverUrl, modId)) || null;
}
function writeCommentsCache(serverUrl, modId, payload) {
  if (!serverUrl || !modId) return;
  commentsMemoryCache.set(getCommentsCacheKey(serverUrl, modId), { ...payload, ts: Date.now() });
}
const profileCache = /* @__PURE__ */ new Map();
const profileInflight = /* @__PURE__ */ new Map();
const PROFILE_TTL_MS = 5 * 60 * 1e3;
function getProfileCacheKey(serverUrl, clientId) {
  return `${serverUrl}|${clientId}`;
}
async function fetchUserProfile(serverUrl, clientId) {
  if (!serverUrl || !clientId) return { nickname: null, avatarUrl: null };
  const key = getProfileCacheKey(serverUrl, clientId);
  const cached = profileCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < PROFILE_TTL_MS) return cached;
  if (profileInflight.has(key)) return profileInflight.get(key);
  const task = (async () => {
    let nickname = null;
    let avatarUrl = null;
    try {
      const profileRes = await fetch(`${serverUrl}/api/comment-profiles/${encodeURIComponent(clientId)}`);
      if (profileRes.ok) {
        const profileData = await profileRes.json().catch(() => null);
        if (profileData?.success && profileData.profile) {
          if (profileData.profile.nickname) nickname = profileData.profile.nickname;
          if (profileData.profile.avatarUrl) {
            const raw = profileData.profile.avatarUrl;
            avatarUrl = raw.startsWith("http") ? raw : `${serverUrl}${raw}`;
          }
        }
      }
    } catch (e) {
      console.warn("[ModCommentSection] Failed to load avatar profile:", e);
    }
    const entry = { nickname, avatarUrl, fetchedAt: Date.now() };
    profileCache.set(key, entry);
    return entry;
  })();
  profileInflight.set(key, task);
  try {
    return await task;
  } finally {
    profileInflight.delete(key);
  }
}
function mergeRetainRecentOwn(prev, incoming, thresholdMs = 6e4) {
  if (!Array.isArray(prev) || !prev.length) return incoming;
  const now = Date.now();
  const seen = /* @__PURE__ */ new Set();
  const collect = (list) => {
    for (const c of list || []) {
      if (c && c.id != null) seen.add(c.id);
      if (c && c.replies) collect(c.replies);
    }
  };
  collect(incoming);
  const isRecentOwn = (c) => {
    if (!c || !c.isOwn) return false;
    if (c.pending) return true;
    if (!c.createdAt) return false;
    try {
      const iso = String(c.createdAt);
      const t = new Date(iso.endsWith("Z") ? iso : iso + "Z").getTime();
      if (!Number.isFinite(t)) return false;
      return now - t < thresholdMs;
    } catch {
      return false;
    }
  };
  const missingRoots = [];
  const missingRepliesByParent = /* @__PURE__ */ new Map();
  for (const c of prev) {
    if (!c || c.id == null) continue;
    if (!seen.has(c.id) && isRecentOwn(c)) {
      missingRoots.push(c);
    }
    if (c.replies && c.replies.length) {
      for (const r of c.replies) {
        if (!r || r.id == null) continue;
        if (!seen.has(r.id) && isRecentOwn(r)) {
          if (!missingRepliesByParent.has(c.id)) {
            missingRepliesByParent.set(c.id, []);
          }
          missingRepliesByParent.get(c.id).push(r);
        }
      }
    }
  }
  if (!missingRoots.length && missingRepliesByParent.size === 0) return incoming;
  const mergedBody = incoming.map((c) => {
    const extras = missingRepliesByParent.get(c.id);
    if (!extras || !extras.length) return c;
    return { ...c, replies: [...c.replies || [], ...extras] };
  });
  return [...missingRoots, ...mergedBody];
}
function generateRandomNickname() {
  const prefix = RANDOM_PREFIXES[Math.floor(Math.random() * RANDOM_PREFIXES.length)];
  const hex = Math.random().toString(16).substr(2, 4).toUpperCase();
  return `${prefix}#${hex}`;
}
function getOrCreateNickname() {
  let nick = localStorage.getItem("comment-nickname");
  if (!nick) {
    nick = generateRandomNickname();
    localStorage.setItem("comment-nickname", nick);
  }
  return nick;
}
function timeAgo(dateStr) {
  if (!dateStr) return "";
  const now = Date.now();
  const then = new Date(dateStr.endsWith("Z") ? dateStr : dateStr + "Z").getTime();
  const diff = now - then;
  if (diff < 6e4) return "刚刚";
  if (diff < 36e5) return `${Math.floor(diff / 6e4)}分钟前`;
  if (diff < 864e5) return `${Math.floor(diff / 36e5)}小时前`;
  if (diff < 6048e5) return `${Math.floor(diff / 864e5)}天前`;
  return new Date(then).toLocaleDateString("zh-CN");
}
function AvatarCircle({ nickname, avatarUrl, size = 32 }) {
  if (avatarUrl) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx(
      "img",
      {
        src: avatarUrl,
        alt: nickname,
        style: {
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          flexShrink: 0
        }
      }
    );
  }
  let hash = 0;
  for (let i = 0; i < (nickname || "").length; i++) {
    hash = nickname.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  const char = (nickname || "?")[0];
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    "div",
    {
      style: {
        width: size,
        height: size,
        borderRadius: "50%",
        background: `hsl(${hue}, 55%, 60%)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
        fontSize: size * 0.45,
        fontWeight: 700,
        flexShrink: 0
      },
      children: char
    }
  );
}
function ModCommentSection({ modId, serverUrl, clientId, devMode = false, mod = null }) {
  const initialCache = readCommentsCache(serverUrl, modId);
  const [comments, setComments] = reactExports.useState(() => initialCache?.comments || []);
  const [total, setTotal] = reactExports.useState(() => initialCache?.total || 0);
  const [page, setPage] = reactExports.useState(1);
  const [loading, setLoading] = reactExports.useState(false);
  const [loadingMore, setLoadingMore] = reactExports.useState(false);
  const [submitting, setSubmitting] = reactExports.useState(false);
  const [content, setContent] = reactExports.useState("");
  const [replyTo, setReplyTo] = reactExports.useState(null);
  const [error, setError] = reactExports.useState(null);
  const [nickname, setNickname] = reactExports.useState(() => getOrCreateNickname());
  const [myAvatarUrl, setMyAvatarUrl] = reactExports.useState(() => localStorage.getItem("comment-avatar-url") || null);
  const [developerPublishKeys, setDeveloperPublishKeys] = reactExports.useState([]);
  const [hidingCommentId, setHidingCommentId] = reactExports.useState(null);
  const isActiveRef = reactExports.useRef(true);
  reactExports.useEffect(() => {
    isActiveRef.current = true;
    return () => {
      isActiveRef.current = false;
    };
  }, []);
  const currentModIdRef = reactExports.useRef(modId);
  reactExports.useEffect(() => {
    if (currentModIdRef.current === modId) return;
    currentModIdRef.current = modId;
    const cached = readCommentsCache(serverUrl, modId);
    setComments(cached?.comments || []);
    setTotal(cached?.total || 0);
    setPage(1);
  }, [serverUrl, modId]);
  reactExports.useEffect(() => {
    if (!serverUrl || !clientId) return;
    let cancelled = false;
    fetchUserProfile(serverUrl, clientId).then((profile) => {
      if (cancelled) return;
      if (profile.nickname) setNickname(profile.nickname);
      if (profile.avatarUrl) {
        setMyAvatarUrl(profile.avatarUrl);
        try {
          localStorage.setItem("comment-avatar-url", profile.avatarUrl);
        } catch {
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [serverUrl, clientId]);
  reactExports.useEffect(() => {
    let cancelled = false;
    setDeveloperPublishKeys([]);
    if (!devMode || !modId || !window.api?.devGetMarketPublishKey) return;
    window.api.devGetMarketPublishKey({
      modId,
      gameId: mod?.gameId,
      characterName: mod?.characterName,
      modName: mod?.name
    }).then((result) => {
      if (cancelled) return;
      if (result?.success) {
        const keys = Array.isArray(result.publishKeys) ? result.publishKeys : [result.publishKey];
        setDeveloperPublishKeys(keys.filter(Boolean));
      }
    }).catch(() => {
    });
    return () => {
      cancelled = true;
    };
  }, [devMode, modId, mod?.gameId, mod?.characterName, mod?.name]);
  const loadComments = reactExports.useCallback(async (pageNum = 1, append = false, silent = false) => {
    if (!serverUrl || !modId) return;
    const fetchModId = modId;
    if (!silent) {
      if (append) setLoadingMore(true);
      else setLoading(true);
    }
    const url = `${serverUrl}/api/mods/${modId}/comments?page=${pageNum}&limit=20&clientId=${encodeURIComponent(clientId)}&_t=${Date.now()}`;
    let lastErr = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 1e3));
        if (!isActiveRef.current || currentModIdRef.current !== fetchModId) return;
        const res = await fetch(url, {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache",
            Pragma: "no-cache"
          }
        });
        const data = await res.json();
        if (!isActiveRef.current || currentModIdRef.current !== fetchModId) {
          lastErr = null;
          break;
        }
        if (data.success) {
          const markOwn = (list) => (list || []).map((c) => ({
            ...c,
            isOwn: typeof c.isOwn === "boolean" ? c.isOwn : !!(c.clientId && clientId && c.clientId === clientId),
            replies: markOwn(c.replies)
          }));
          const incoming = markOwn(data.comments || []);
          if (append) {
            setComments((prev) => [...prev, ...incoming]);
          } else {
            setComments((prev) => mergeRetainRecentOwn(prev, incoming));
          }
          setTotal((prevTotal) => {
            const serverTotal = data.total || 0;
            if (append) return serverTotal || prevTotal;
            return serverTotal;
          });
          setPage(pageNum);
          if (pageNum === 1 && !append && !myAvatarUrl && isActiveRef.current) {
            const ownWithAvatar = incoming.find((c) => c.isOwn && c.avatarUrl) || incoming.flatMap((c) => c.replies || []).find((c) => c.isOwn && c.avatarUrl);
            if (ownWithAvatar && ownWithAvatar.avatarUrl) {
              setMyAvatarUrl(ownWithAvatar.avatarUrl);
              localStorage.setItem("comment-avatar-url", ownWithAvatar.avatarUrl);
              if (ownWithAvatar.nickname && typeof ownWithAvatar.nickname === "string") {
                setNickname(ownWithAvatar.nickname);
              }
            }
          }
          if (pageNum === 1 && !append) {
            const cachedNow = readCommentsCache(serverUrl, fetchModId);
            const merged = mergeRetainRecentOwn(cachedNow?.comments || [], incoming);
            writeCommentsCache(serverUrl, fetchModId, {
              comments: merged,
              total: data.total || 0
            });
          }
          lastErr = null;
          break;
        }
      } catch (e) {
        lastErr = e;
      }
    }
    if (lastErr) console.warn("[ModCommentSection] Load comments failed after retries:", lastErr);
    if (!silent && currentModIdRef.current === fetchModId && isActiveRef.current) {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [serverUrl, modId, clientId]);
  reactExports.useEffect(() => {
    const hasCache = !!readCommentsCache(serverUrl, modId);
    loadComments(1, false, hasCache);
  }, [loadComments, serverUrl, modId]);
  reactExports.useEffect(() => {
    if (!serverUrl || !modId) return;
    if (page !== 1) return;
    writeCommentsCache(serverUrl, modId, { comments, total });
  }, [serverUrl, modId, comments, total, page]);
  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;
    if (trimmed.length > 500) {
      setError("评论不能超过500字");
      return;
    }
    const isReply = !!replyTo;
    const displayContent = isReply ? `@${replyTo.nickname} ${trimmed}` : trimmed;
    if (isReply && typeof replyTo.id === "string" && replyTo.id.startsWith("temp-")) {
      setError("请稍等，上一条评论还在发送中");
      return;
    }
    const postModId = modId;
    const prevComments = comments;
    const prevTotal = total;
    const prevContent = content;
    const prevReplyTo = replyTo;
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const optimistic = {
      id: tempId,
      nickname,
      avatarUrl: myAvatarUrl,
      content: displayContent,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      likes: 0,
      isLiked: false,
      isOwn: true,
      pending: true,
      replies: []
    };
    if (isReply) {
      setComments(
        (prev) => prev.map(
          (c) => c.id === replyTo.id ? { ...c, replies: [...c.replies || [], optimistic] } : c
        )
      );
    } else {
      setComments((prev) => [optimistic, ...prev]);
    }
    setTotal((t) => t + 1);
    setContent("");
    setReplyTo(null);
    setSubmitting(true);
    setError(null);
    try {
      const body = {
        clientId,
        nickname,
        content: displayContent,
        parentId: replyTo?.id || void 0,
        // Let the server persist our current avatar onto the comment row so
        // it survives reloads even if the user has no comment_profiles
        // record yet. The server validates the URL against its whitelist
        // (imgbb / our own /uploads/ paths) and profile-backed avatars
        // always win over this, so sending it here is safe.
        avatarUrl: myAvatarUrl || void 0
      };
      const res = await fetch(`${serverUrl}/api/mods/${postModId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const rawText = await res.text();
      let data = null;
      try {
        data = JSON.parse(rawText);
      } catch {
      }
      const stillOnOriginMod = currentModIdRef.current === postModId && isActiveRef.current;
      if (res.ok && data && data.success) {
        const real = data.comment;
        if (real) {
          const normalizedReal = {
            ...real,
            // Preserve own-avatar in the UI even if server didn't echo one back
            avatarUrl: real.avatarUrl || myAvatarUrl || null,
            isOwn: true,
            isLiked: false,
            likes: real.likes ?? 0,
            replies: real.replies || []
          };
          const swapIn = (list) => {
            if (isReply) {
              return list.map((c) => {
                if (c.id !== replyTo.id) return c;
                return {
                  ...c,
                  replies: (c.replies || []).map(
                    (r) => r.id === tempId ? normalizedReal : r
                  )
                };
              });
            }
            return list.map((c) => c.id === tempId ? normalizedReal : c);
          };
          if (stillOnOriginMod) {
            setComments(swapIn);
          } else {
            const cached = readCommentsCache(serverUrl, postModId);
            if (cached) {
              writeCommentsCache(serverUrl, postModId, {
                comments: swapIn(cached.comments || []),
                total: cached.total
              });
            }
          }
        } else if (stillOnOriginMod) {
          setComments((prev) => {
            const clearPending = (c) => c.id === tempId ? { ...c, pending: false } : c.replies ? { ...c, replies: c.replies.map(clearPending) } : c;
            return prev.map(clearPending);
          });
        }
      } else {
        if (stillOnOriginMod) {
          setComments(prevComments);
          setTotal(prevTotal);
          setContent(prevContent);
          setReplyTo(prevReplyTo);
          const serverMsg = data?.error || (rawText ? rawText.slice(0, 80).replace(/\s+/g, " ") : "");
          setError(`发送失败 (HTTP ${res.status})${serverMsg ? ": " + serverMsg : ""}`);
        } else {
          const cached = readCommentsCache(serverUrl, postModId);
          if (cached) {
            const strip = (list) => list.filter((c) => c.id !== tempId).map((c) => ({ ...c, replies: (c.replies || []).filter((r) => r.id !== tempId) }));
            writeCommentsCache(serverUrl, postModId, {
              comments: strip(cached.comments || []),
              total: Math.max(0, (cached.total || 0) - 1)
            });
          }
        }
      }
    } catch (e2) {
      if (currentModIdRef.current === postModId && isActiveRef.current) {
        setComments(prevComments);
        setTotal(prevTotal);
        setContent(prevContent);
        setReplyTo(prevReplyTo);
        setError("发送失败：" + (e2.message || "网络错误"));
      }
    } finally {
      if (currentModIdRef.current === postModId && isActiveRef.current) {
        setSubmitting(false);
      }
    }
  }
  async function handleLikeComment(commentId) {
    if (!serverUrl) return;
    try {
      const res = await fetch(`${serverUrl}/api/comments/${commentId}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId })
      });
      const data = await res.json();
      if (data.success) {
        setComments((prev) => prev.map((c) => {
          if (c.id === commentId) return { ...c, likes: data.likes, isLiked: data.liked };
          if (c.replies) {
            return { ...c, replies: c.replies.map((r) => r.id === commentId ? { ...r, likes: data.likes, isLiked: data.liked } : r) };
          }
          return c;
        }));
      }
    } catch (e) {
      console.error("Like comment failed:", e);
    }
  }
  async function handleHideComment(commentId, isReply = false) {
    if (!serverUrl || !developerPublishKeys.length || hidingCommentId) return;
    if (!window.confirm("确认隐藏这条评论？隐藏后所有用户都看不到。")) return;
    setHidingCommentId(commentId);
    setError(null);
    try {
      let hidden = false;
      let lastError = null;
      for (const publishKey of developerPublishKeys) {
        const res = await fetch(`${serverUrl}/api/comments/${commentId}/hide`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publishKey })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) {
          hidden = true;
          break;
        }
        lastError = data.error || `隐藏失败 (HTTP ${res.status})`;
      }
      if (!hidden) throw new Error(lastError || "隐藏失败");
      const removeHidden = (list) => (list || []).filter((c) => c.id !== commentId).map((c) => ({ ...c, replies: (c.replies || []).filter((r) => r.id !== commentId) }));
      setComments((prev) => removeHidden(prev));
      if (!isReply) setTotal((value) => Math.max(0, value - 1));
      const cached = readCommentsCache(serverUrl, modId);
      if (cached) {
        writeCommentsCache(serverUrl, modId, {
          comments: removeHidden(cached.comments || []),
          total: isReply ? cached.total || 0 : Math.max(0, (cached.total || 0) - 1)
        });
      }
    } catch (e) {
      setError(e.message || "隐藏失败");
    } finally {
      setHidingCommentId(null);
    }
  }
  const hasMore = comments.length < total;
  const canModerateComments = devMode && developerPublishKeys.length > 0;
  function renderComment(comment, isReply = false) {
    return /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "div",
      {
        style: {
          display: "flex",
          gap: "10px",
          padding: isReply ? "8px 0 8px 42px" : "12px 0",
          borderBottom: isReply ? "none" : "1px solid rgba(0,0,0,0.05)",
          opacity: comment.pending ? 0.65 : 1,
          transition: "opacity 0.25s ease"
        },
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(AvatarCircle, { nickname: comment.nickname, avatarUrl: comment.isOwn ? comment.avatarUrl || myAvatarUrl : comment.avatarUrl, size: isReply ? 28 : 32 }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontWeight: 600, fontSize: "13px", color: "var(--color-text-primary)" }, children: comment.nickname }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontSize: "11px", color: "var(--color-text-tertiary)" }, children: comment.pending ? "发送中…" : timeAgo(comment.createdAt) }),
              comment.pending && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "comment-pending-spinner", "aria-hidden": "true" })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontSize: "13px", color: "var(--color-text-secondary)", lineHeight: "1.6", wordBreak: "break-word" }, children: comment.content }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", alignItems: "center", gap: "12px", marginTop: "6px" }, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs(
                "button",
                {
                  onClick: () => handleLikeComment(comment.id),
                  style: {
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "12px",
                    color: comment.isLiked ? "#ff8fa3" : "#9ca3af",
                    display: "flex",
                    alignItems: "center",
                    gap: "3px",
                    padding: 0
                  },
                  children: [
                    comment.isLiked ? "❤️" : "🤍",
                    " ",
                    comment.likes || 0
                  ]
                }
              ),
              !isReply && /* @__PURE__ */ jsxRuntimeExports.jsx(
                "button",
                {
                  onClick: () => setReplyTo({ id: comment.id, nickname: comment.nickname }),
                  style: {
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "12px",
                    color: "#9ca3af",
                    padding: 0
                  },
                  children: "回复"
                }
              ),
              canModerateComments && !comment.pending && /* @__PURE__ */ jsxRuntimeExports.jsx(
                "button",
                {
                  onClick: () => handleHideComment(comment.id, isReply),
                  disabled: hidingCommentId === comment.id,
                  style: {
                    background: "none",
                    border: "none",
                    cursor: hidingCommentId === comment.id ? "wait" : "pointer",
                    fontSize: "12px",
                    color: "#ef4444",
                    padding: 0,
                    opacity: hidingCommentId === comment.id ? 0.6 : 1
                  },
                  title: "开发者隐藏：所有用户都看不到",
                  children: hidingCommentId === comment.id ? "隐藏中..." : "隐藏"
                }
              )
            ] }),
            !isReply && comment.replies && comment.replies.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { marginTop: "4px" }, children: comment.replies.map((r) => renderComment(r, true)) })
          ] })
        ]
      },
      comment.id
    );
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mod-comment-section", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("style", { children: `
        .mod-comment-section {
          padding: 0;
        }
        .comment-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 16px;
        }
        .comment-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 700;
          color: var(--color-text-primary);
        }
        .comment-count-badge {
          background: var(--color-accent-primary, #ff8fa3);
          color: white;
          font-size: 11px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 10px;
        }
        .comment-input-area {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          margin-bottom: 20px;
          padding: 12px;
          background: rgba(0,0,0,0.02);
          border-radius: 12px;
          border: 1px solid rgba(0,0,0,0.05);
        }
        .comment-input-area textarea {
          /* The textarea is nested inside a non-flex wrapper div, so the
             former 'flex: 1' was a no-op and the element fell back to its
             intrinsic cols width (~20ch), leaving a large blank gap on
             the right. Use explicit width + box-sizing to guarantee it
             always fills its parent. */
          width: 100%;
          box-sizing: border-box;
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 8px;
          padding: 8px 12px;
          font-size: 13px;
          resize: none;
          min-height: 40px;
          max-height: 120px;
          font-family: inherit;
          background: white;
          line-height: 1.5;
        }
        .comment-input-area textarea:focus {
          outline: none;
          border-color: var(--color-accent-primary, #ff8fa3);
        }
        .comment-send-btn {
          background: var(--color-accent-gradient, linear-gradient(135deg, #ff9a9e, #fecfef));
          color: white;
          border: none;
          border-radius: 8px;
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.2s;
          flex-shrink: 0;
        }
        .comment-send-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(255,143,163,0.3);
        }
        .comment-send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }
        .comment-reply-hint {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--color-accent-primary, #ff8fa3);
          margin-bottom: 8px;
          padding: 4px 8px;
          background: rgba(255,143,163,0.08);
          border-radius: 6px;
        }
        .comment-reply-cancel {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 14px;
          color: #999;
          padding: 0 2px;
        }
        .comment-load-more {
          display: flex;
          justify-content: center;
          padding: 12px 0;
        }
        .comment-load-more button {
          background: rgba(0,0,0,0.04);
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 8px;
          padding: 8px 20px;
          font-size: 13px;
          color: var(--color-text-secondary);
          cursor: pointer;
          transition: all 0.2s;
        }
        .comment-load-more button:hover {
          background: rgba(0,0,0,0.08);
        }
        .comment-empty {
          text-align: center;
          padding: 24px;
          color: var(--color-text-tertiary);
          font-size: 14px;
        }
        .comment-loading-dots {
          display: inline-flex;
          gap: 4px;
          margin-left: 8px;
        }
        .comment-loading-dots span {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--color-accent-primary, #ff8fa3);
          opacity: 0.35;
          animation: comment-dot 1.2s infinite ease-in-out;
        }
        .comment-loading-dots span:nth-child(2) { animation-delay: 0.15s; }
        .comment-loading-dots span:nth-child(3) { animation-delay: 0.3s; }
        @keyframes comment-dot {
          0%, 80%, 100% { opacity: 0.25; transform: scale(0.85); }
          40% { opacity: 1; transform: scale(1); }
        }
        .comment-pending-spinner {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          border: 1.5px solid rgba(255, 143, 163, 0.35);
          border-top-color: var(--color-accent-primary, #ff8fa3);
          animation: comment-spin 0.8s linear infinite;
          display: inline-block;
        }
        @keyframes comment-spin {
          to { transform: rotate(360deg); }
        }
        .comment-error-banner {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          margin-bottom: 12px;
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.28);
          border-radius: 10px;
          color: #dc2626;
          font-size: 13px;
          line-height: 1.5;
          animation: comment-error-in 0.22s ease-out;
        }
        .comment-error-icon {
          font-size: 16px;
          flex-shrink: 0;
        }
        .comment-error-text {
          flex: 1;
          word-break: break-word;
        }
        .comment-error-close {
          background: none;
          border: none;
          cursor: pointer;
          color: #dc2626;
          opacity: 0.7;
          font-size: 14px;
          padding: 2px 6px;
          border-radius: 4px;
          flex-shrink: 0;
        }
        .comment-error-close:hover {
          opacity: 1;
          background: rgba(239, 68, 68, 0.12);
        }
        @keyframes comment-error-in {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      ` }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "comment-header", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "💬 评论" }),
      total > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "comment-count-badge", children: total })
    ] }),
    replyTo && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "comment-reply-hint", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
        "回复 @",
        replyTo.nickname
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "comment-reply-cancel", onClick: () => setReplyTo(null), children: "✕" })
    ] }),
    error && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "comment-error-banner", role: "alert", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "comment-error-icon", "aria-hidden": "true", children: "⚠️" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "comment-error-text", children: error }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          type: "button",
          className: "comment-error-close",
          onClick: () => setError(null),
          "aria-label": "关闭错误提示",
          children: "✕"
        }
      )
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("form", { className: "comment-input-area", onSubmit: handleSubmit, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", flexShrink: 0 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(AvatarCircle, { nickname, avatarUrl: myAvatarUrl, size: 32 }),
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "textarea",
          {
            value: content,
            onChange: (e) => {
              setContent(e.target.value);
              if (error) setError(null);
            },
            placeholder: replyTo ? `回复 @${replyTo.nickname}...` : "说点什么吧...",
            rows: 2,
            maxLength: 500
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { display: "flex", justifyContent: "flex-end", marginTop: "6px" }, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { fontSize: "11px", color: content.length > 450 ? "#ef4444" : "#9ca3af" }, children: [
          content.length,
          "/500"
        ] }) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "submit", className: "comment-send-btn", disabled: submitting || !content.trim(), children: submitting ? "发送中..." : "发送" })
    ] }),
    loading ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "comment-empty", children: [
      "正在加载评论",
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "comment-loading-dots", "aria-hidden": "true", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", {}),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", {}),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", {})
      ] })
    ] }) : comments.length === 0 ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "comment-empty", children: "暂无评论，来说两句吧~" }) : /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
      comments.map((c) => renderComment(c)),
      hasMore && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "comment-load-more", children: /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: () => loadComments(page + 1, true), disabled: loadingMore, children: loadingMore ? "加载中..." : `加载更多评论 (${comments.length}/${total})` }) })
    ] })
  ] });
}
function normalizeMarketAccessPayload(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const controlled = value.controlled === true;
  const allowed = value.allowed !== false;
  const code = String(value.code || (allowed ? "UNRESTRICTED" : "MARKET_ACCESS_DENIED")).trim().toUpperCase();
  return {
    controlled,
    allowed,
    code,
    clearExisting: value.clearExisting === true
  };
}
function shouldHideControlledMarketCache(marketAccess, hasAuthToken = false) {
  const access = normalizeMarketAccessPayload(marketAccess);
  return Boolean(access?.controlled && !hasAuthToken);
}
function getMarketSnapshotSignature(mods = []) {
  if (!Array.isArray(mods) || mods.length === 0) return "0";
  return mods.map(
    (mod) => [
      mod?.id,
      mod?.updatedAt || mod?.updated_at || "",
      mod?.downloadCount || mod?.downloads || 0,
      mod?.pinned ? 1 : 0,
      mod?.hot || mod?.isHot || mod?.marketHot ? 1 : 0,
      mod?.sortOrder || 0
    ].join(":")
  ).join("|");
}
function shouldPreserveMarketSnapshotOnEmptyResult(result, currentMods = []) {
  if (!Array.isArray(currentMods) || currentMods.length === 0) return false;
  if (result?.wasIncremental === true) return false;
  if (!Array.isArray(result?.mods)) return true;
  if (result.mods.length > 0) return false;
  return result?.marketAccess?.allowed !== true;
}
function shouldReplaceMarketSnapshot(result, currentMods = []) {
  if (!result?.success || result.stale === true || result.ignoredEmpty === true) {
    return false;
  }
  if (!Array.isArray(result.mods)) return false;
  if (result.fromCache && result.syncError) return false;
  if (result.refreshBlocked === true) return result.mods.length === 0;
  if (shouldPreserveMarketSnapshotOnEmptyResult(result, currentMods)) return false;
  if (result.wasIncremental !== true) return true;
  if (!Array.isArray(currentMods) || currentMods.length === 0) return true;
  if (Number(result.updatedCount || 0) > 0 || Number(result.deletedCount || 0) > 0) return true;
  return getMarketSnapshotSignature(result.mods) !== getMarketSnapshotSignature(currentMods);
}
function createLatestRequestTracker() {
  let nextId = 0;
  const latestByKey = /* @__PURE__ */ new Map();
  return {
    begin(key) {
      const normalizedKey = String(key || "default");
      const ticket = { key: normalizedKey, id: ++nextId };
      latestByKey.set(normalizedKey, ticket.id);
      return ticket;
    },
    isCurrent(ticket) {
      return Boolean(ticket && latestByKey.get(ticket.key) === ticket.id);
    },
    invalidate(key) {
      const normalizedKey = String(key || "default");
      latestByKey.set(normalizedKey, ++nextId);
    },
    invalidateAll() {
      nextId += 1;
      latestByKey.clear();
    }
  };
}
function getModGameId(mod) {
  return mod?.gameId || "endfield";
}
function buildImageList(mod) {
  const raw = Array.isArray(mod?.images) && mod.images.length > 0 ? mod.images : mod?.imageUrl ? [{ url: mod.imageUrl }] : [];
  if (!mod?.imageUrl || raw.length <= 1) return raw;
  const coverIdx = raw.findIndex((img) => img.url === mod.imageUrl);
  if (coverIdx <= 0) return raw;
  const reordered = [...raw];
  reordered.splice(coverIdx, 1);
  reordered.unshift({ url: mod.imageUrl });
  return reordered;
}
function cleanCollectionText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}
function normalizeCollectionKey(value) {
  return cleanCollectionText(value).toLowerCase().replace(/[【】\[\]（）(){}<>《》"'`]/g, "").replace(/[\s_\-－–—.:：/\\]+/g, "");
}
const MARKET_CHARACTER_ALIAS_POOLS = [
  { canonical: "女主", aliases: ["铃", "玲", "Belle"] },
  { canonical: "洛瑟菈", aliases: ["露琪拉", "露西拉", "Lucilla"] },
  { canonical: "希希芙", aliases: ["茜茜娅", "Cissia"] },
  { canonical: "南宫羽", aliases: ["南宫玉", "NangongYu", "Nangong Yu"] },
  { canonical: "小吱", aliases: ["赤子", "Chiz"] }
];
function createMarketCharacterAliasIndex(extraPools = []) {
  const canonicalByKey = /* @__PURE__ */ new Map();
  const aliasesByCanonicalKey = /* @__PURE__ */ new Map();
  const aliasTextsByCanonicalKey = /* @__PURE__ */ new Map();
  const addPool = (pool) => {
    const canonical = cleanCollectionText(pool?.canonical || pool?.displayName || pool?.name);
    if (!canonical) return;
    const canonicalKey = normalizeCollectionKey(canonical);
    if (!canonicalKey) return;
    const values = [
      canonical,
      pool?.canonicalEnName,
      pool?.jasmName,
      ...Array.isArray(pool?.aliases) ? pool.aliases : []
    ].map(cleanCollectionText).filter(Boolean);
    if (!aliasesByCanonicalKey.has(canonicalKey)) aliasesByCanonicalKey.set(canonicalKey, /* @__PURE__ */ new Set());
    if (!aliasTextsByCanonicalKey.has(canonicalKey)) aliasTextsByCanonicalKey.set(canonicalKey, /* @__PURE__ */ new Set());
    const aliasSet = aliasesByCanonicalKey.get(canonicalKey);
    const aliasTextSet = aliasTextsByCanonicalKey.get(canonicalKey);
    values.forEach((value) => {
      const key = normalizeCollectionKey(value);
      if (!key) return;
      canonicalByKey.set(key, canonical);
      aliasSet.add(key);
      aliasTextSet.add(value);
    });
  };
  MARKET_CHARACTER_ALIAS_POOLS.forEach(addPool);
  extraPools.forEach(addPool);
  return { canonicalByKey, aliasesByCanonicalKey, aliasTextsByCanonicalKey };
}
const DEFAULT_MARKET_CHARACTER_ALIAS_INDEX = createMarketCharacterAliasIndex();
function getMarketCanonicalCharacterName(name, aliasIndex = DEFAULT_MARKET_CHARACTER_ALIAS_INDEX) {
  const text = cleanCollectionText(name);
  if (!text) return "";
  return aliasIndex?.canonicalByKey?.get(normalizeCollectionKey(text)) || text;
}
function getMarketCharacterAliasKeys(name, aliasIndex = DEFAULT_MARKET_CHARACTER_ALIAS_INDEX) {
  const canonical = getMarketCanonicalCharacterName(name, aliasIndex);
  const canonicalKey = normalizeCollectionKey(canonical);
  if (!canonicalKey) return /* @__PURE__ */ new Set();
  return aliasIndex?.aliasesByCanonicalKey?.get(canonicalKey) || /* @__PURE__ */ new Set([canonicalKey]);
}
function isSameMarketCharacterName(a, b, aliasIndex = DEFAULT_MARKET_CHARACTER_ALIAS_INDEX) {
  const aKey = normalizeCollectionKey(a);
  const bKey = normalizeCollectionKey(b);
  if (!aKey || !bKey) return false;
  if (aKey === bKey) return true;
  const aAliases = getMarketCharacterAliasKeys(a, aliasIndex);
  return aAliases.has(bKey);
}
function isSameMarketCharacterToken(token, characterName, aliasIndex = DEFAULT_MARKET_CHARACTER_ALIAS_INDEX) {
  const text = cleanCollectionText(token);
  if (!text) return false;
  if (isSameMarketCharacterName(text, characterName, aliasIndex)) return true;
  const withoutVersion = stripCollectionVersionText(text);
  return withoutVersion !== text && isSameMarketCharacterName(withoutVersion, characterName, aliasIndex);
}
function normalizeMarketModCharacter(mod, aliasIndex = DEFAULT_MARKET_CHARACTER_ALIAS_INDEX) {
  if (!mod) return mod;
  const originalCharacterName = cleanCollectionText(mod.characterName);
  const canonicalCharacterName = getMarketCanonicalCharacterName(originalCharacterName, aliasIndex);
  if (!originalCharacterName || canonicalCharacterName === originalCharacterName) return mod;
  return {
    ...mod,
    characterName: canonicalCharacterName,
    _originalCharacterName: originalCharacterName
  };
}
const MARKET_FUNCTION_CATEGORY_KEYWORDS = [
  "大世界",
  "功能",
  "武器",
  "ui",
  "UI",
  "修复器",
  "修复",
  "通用",
  "魔法",
  "更新",
  "管理器",
  "光锥",
  "载具",
  "插件",
  "工具",
  "场景",
  "其他",
  "杂项"
];
const HIDDEN_MARKET_TAG_PATTERN = /(?:18\+|18禁|r18|r-18|nsfw|成人|涩涩|🔞)/i;
function isHiddenMarketTag(tag) {
  const id = cleanCollectionText(tag?.id || tag);
  const name = cleanCollectionText(tag?.name || tag?.label || tag);
  return HIDDEN_MARKET_TAG_PATTERN.test(id) || HIDDEN_MARKET_TAG_PATTERN.test(name);
}
function filterVisibleMarketTags(tags) {
  if (!Array.isArray(tags)) return [];
  return tags.filter((tag) => !isHiddenMarketTag(tag));
}
function isMarketFunctionCategory(name) {
  const text = cleanCollectionText(name);
  if (!text) return false;
  return MARKET_FUNCTION_CATEGORY_KEYWORDS.some(
    (keyword) => text.toLowerCase().includes(String(keyword).toLowerCase())
  );
}
function getExpandedMarketSearchQueries(query, aliasIndex = DEFAULT_MARKET_CHARACTER_ALIAS_INDEX) {
  const normalizedQuery = cleanCollectionText(query).toLowerCase();
  if (!normalizedQuery) return [];
  const queries = /* @__PURE__ */ new Set([normalizedQuery]);
  const compactQuery = normalizeCollectionKey(normalizedQuery);
  aliasIndex.aliasesByCanonicalKey.forEach((aliasKeys, canonicalKey) => {
    const aliases = /* @__PURE__ */ new Set([canonicalKey, ...aliasKeys]);
    const matched = Array.from(aliases).some((aliasKey) => {
      return aliasKey.includes(compactQuery) || compactQuery.includes(aliasKey) || compactQuery && aliasKey && (aliasKey.includes(compactQuery) || compactQuery.includes(aliasKey));
    });
    if (matched) {
      const canonicalName = aliasIndex.canonicalByKey.get(canonicalKey);
      if (canonicalName) queries.add(canonicalName.toLowerCase());
      aliasIndex.aliasTextsByCanonicalKey?.get(canonicalKey)?.forEach((aliasText) => {
        const text = cleanCollectionText(aliasText).toLowerCase();
        if (text) queries.add(text);
      });
      aliases.forEach((aliasKey) => {
        if (aliasKey) queries.add(aliasKey);
      });
    }
  });
  return Array.from(queries);
}
function splitCollectionNameParts(name) {
  return cleanCollectionText(name).split(/[-－–—]+/).map((part) => part.trim()).filter(Boolean);
}
function stripVariantVersion(value) {
  const text = cleanCollectionText(value);
  if (!text) return { text: "", version: "" };
  const compactVersion = text.match(/^(.*?)(v\s*\d+(?:\.\d+){0,3}[a-z]?)$/i);
  if (compactVersion && cleanCollectionText(compactVersion[1])) {
    return {
      text: cleanCollectionText(compactVersion[1]).replace(/[-_－–—\s]+$/, ""),
      version: compactVersion[2]
    };
  }
  const separatedVersion = text.match(/^(.*?)[\s_\-－–—]+(\d+(?:\.\d+){1,3}[a-z]?)$/i);
  if (separatedVersion && cleanCollectionText(separatedVersion[1])) {
    return {
      text: cleanCollectionText(separatedVersion[1]).replace(/[-_－–—\s]+$/, ""),
      version: separatedVersion[2]
    };
  }
  return { text, version: "" };
}
function stripCollectionVersionText(value) {
  const stripped = stripVariantVersion(value);
  return cleanCollectionText(stripped.text || value);
}
function normalizeCollectionIdentityKey(value) {
  return normalizeCollectionKey(stripCollectionVersionText(value));
}
function normalizeVariantVersionLabel(value) {
  const text = cleanCollectionText(value);
  if (!text) return "";
  const collapsed = text.replace(/^v+/i, "v");
  const match = collapsed.match(/^v?\s*(\d+(?:\.\d+){0,3}[a-z]?)$/i);
  if (match) return `V${match[1]}`;
  return text.replace(/^v/i, "V");
}
function parseVariantVersionWeight(value) {
  const text = normalizeVariantVersionLabel(value);
  const match = text.match(/^V(\d+(?:\.\d+){0,3})([a-z]?)$/i);
  if (!match) return { parts: [0], suffix: "", hasVersion: false };
  const rawParts = match[1].split(".");
  const parts = rawParts.length === 2 && /^\d{2}$/.test(rawParts[1]) ? [rawParts[0], rawParts[1][0], rawParts[1][1]] : rawParts;
  return {
    parts: parts.map((part) => Number(part) || 0),
    suffix: match[2] || "",
    hasVersion: true
  };
}
function compareVariantVersionLabels(left, right) {
  const a = parseVariantVersionWeight(left);
  const b = parseVariantVersionWeight(right);
  if (a.hasVersion !== b.hasVersion) return a.hasVersion ? -1 : 1;
  const max = Math.max(a.parts.length, b.parts.length);
  for (let i = 0; i < max; i += 1) {
    const diff = (b.parts[i] || 0) - (a.parts[i] || 0);
    if (diff !== 0) return diff;
  }
  return String(a.suffix).localeCompare(String(b.suffix), "zh-CN");
}
function parseClientCollectionName(mod, aliasIndex = DEFAULT_MARKET_CHARACTER_ALIAS_INDEX) {
  const name = cleanCollectionText(mod?.name);
  if (!name) return null;
  const characterName = getMarketCanonicalCharacterName(mod?.characterName, aliasIndex);
  let parts = splitCollectionNameParts(name);
  if (parts.length >= 2) {
    while (parts.length && isSameMarketCharacterToken(parts[0], characterName, aliasIndex)) {
      parts = parts.slice(1);
    }
    if (!parts.length) return null;
  } else if (characterName && normalizeCollectionKey(name).startsWith(normalizeCollectionKey(characterName))) {
    const sliced = name.slice(characterName.length).replace(/^[-_－–—\s]+/, "");
    parts = splitCollectionNameParts(sliced || name);
  } else if (isSameMarketCharacterToken(name, characterName, aliasIndex)) {
    return null;
  }
  const body = parts.length ? parts.join("-") : name;
  const stripped = stripVariantVersion(body);
  const bodyParts = splitCollectionNameParts(stripped.text);
  const collectionName = cleanCollectionText(bodyParts[0] || stripped.text);
  const inlineVariant = cleanCollectionText(bodyParts.slice(1).join("-"));
  if (!collectionName) return null;
  return {
    collectionName,
    collectionKey: normalizeCollectionKey(collectionName),
    bodyCore: stripped.text,
    bodyKey: normalizeCollectionKey(stripped.text),
    variantName: cleanCollectionText(mod?.variantName) || inlineVariant,
    nameVariantVersion: stripped.version,
    hasNameVariantVersion: Boolean(stripped.version),
    variantVersion: cleanCollectionText(mod?.variantVersion) || stripped.version
  };
}
function getExplicitCollectionIdentity(mod, aliasIndex = DEFAULT_MARKET_CHARACTER_ALIAS_INDEX) {
  if (!mod) return null;
  const gameId = getModGameId(mod);
  const characterName = getMarketCanonicalCharacterName(mod.characterName || "all", aliasIndex);
  const explicitName = cleanCollectionText(mod.collectionName);
  const explicitKey = normalizeCollectionIdentityKey(mod.collectionKey || explicitName);
  if (explicitKey && isSameMarketCharacterToken(mod.collectionKey || explicitName, characterName, aliasIndex)) {
    return null;
  }
  if (explicitKey) return `name:${gameId}:${characterName}:${explicitKey}`;
  if (mod.collectionId) return `id:${gameId}:${characterName}:${mod.collectionId}`;
  return null;
}
function getExplicitCollectionMeta(mod, parsed, aliasIndex = DEFAULT_MARKET_CHARACTER_ALIAS_INDEX) {
  const explicitName = cleanCollectionText(mod?.collectionName);
  const strippedExplicitName = explicitName ? stripVariantVersion(explicitName) : null;
  const strippedExplicitKey = mod?.collectionKey ? stripVariantVersion(mod.collectionKey) : null;
  const characterName = getMarketCanonicalCharacterName(mod?.characterName, aliasIndex);
  const collectionName = cleanCollectionText(strippedExplicitName?.text) || cleanCollectionText(strippedExplicitKey?.text) || parsed?.collectionName || explicitName || mod?.name;
  const normalizedCollectionName = isSameMarketCharacterToken(collectionName, characterName, aliasIndex) ? parsed?.collectionName || "" : collectionName;
  const parsedVersion = parsed?.nameVariantVersion || strippedExplicitName?.version || strippedExplicitKey?.version || "";
  return {
    collectionName: normalizedCollectionName,
    variantName: cleanCollectionText(mod?.variantName) || parsed?.variantName || "",
    parsedVersion
  };
}
function createEmptyCollectionData() {
  return {
    groups: /* @__PURE__ */ new Map(),
    identityByModId: /* @__PURE__ */ new Map()
  };
}
const EMPTY_COLLECTION_DATA = createEmptyCollectionData();
function getVariantLabel(mod, index = 0) {
  const parsed = parseClientCollectionName(mod);
  const version = normalizeVariantVersionLabel(mod?._clientEffectiveVariantVersion) || normalizeVariantVersionLabel(mod?._clientVariantVersion) || normalizeVariantVersionLabel(mod?.variantVersion) || normalizeVariantVersionLabel(parsed?.variantVersion) || "V1.0";
  const parts = [
    cleanCollectionText(mod?._clientVariantName) || cleanCollectionText(mod?.variantName) || parsed?.variantName,
    version
  ].filter(Boolean);
  if (parts.length) return parts.join(" ");
  return `V${index + 1}.0`;
}
function getVariantVersionLabel(mod, index = 0) {
  const parsed = parseClientCollectionName(mod);
  return normalizeVariantVersionLabel(mod?._clientEffectiveVariantVersion) || normalizeVariantVersionLabel(mod?._clientVariantVersion) || normalizeVariantVersionLabel(mod?.variantVersion) || normalizeVariantVersionLabel(parsed?.variantVersion) || `V${index + 1}.0`;
}
function getModModeLabel(modMode) {
  return modMode === "pak" ? "Pak" : "3dm";
}
function normalizeMarketCardScale(value) {
  if (value === "small") return 88;
  if (value === "large") return 122;
  if (value === "medium") return 100;
  const number = Number(value);
  if (!Number.isFinite(number)) return 100;
  return Math.min(140, Math.max(80, Math.round(number)));
}
function getMarketCardMinWidth(scale) {
  return Math.round(260 * normalizeMarketCardScale(scale) / 100);
}
function getMarketCardGap(scale) {
  return Math.round(20 * normalizeMarketCardScale(scale) / 100);
}
function getMarketCardImageMinHeight(scale) {
  return Math.round(190 * normalizeMarketCardScale(scale) / 100);
}
function getMarketCardWideImageMinHeight(scale) {
  return Math.round(214 * normalizeMarketCardScale(scale) / 100);
}
function getMarketCardImageMaxHeight(scale) {
  return Math.round(260 * normalizeMarketCardScale(scale) / 100);
}
function getMarketVersionLabel(mod) {
  if (mod?.game_version) return mod.game_version;
  if (mod?.version) return `v${mod.version}`;
  return "未标注";
}
function hasMarketDirectSource(mod) {
  return !!mod?.hasDirectInstall;
}
function getMarketDownloadCount(mod) {
  const value = mod?.downloadCount ?? mod?.downloads ?? mod?.download_count ?? mod?.totalDownloads ?? mod?.downloadClicks ?? 0;
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}
const MARKET_UPDATE_BADGE_DURATION_MS = 24 * 60 * 60 * 1e3;
function getMarketRecentDownloadScore(mod, popularityData = {}) {
  const modId = String(mod?.id || "");
  const weekItem = Array.isArray(popularityData.hot_week) ? popularityData.hot_week.find((item) => String(item?.modId || item?.id) === modId) : null;
  const monthItem = Array.isArray(popularityData.hot_month) ? popularityData.hot_month.find((item) => String(item?.modId || item?.id) === modId) : null;
  const value = mod?.recentDownloadCount ?? mod?.recentDownloads ?? mod?.downloadsLast7Days ?? mod?.weeklyDownloads ?? mod?.weekDownloads ?? weekItem?.downloads ?? monthItem?.downloads ?? 0;
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}
function parseMarketTime(value) {
  if (!value) return 0;
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : 0;
  }
  const text = String(value).trim();
  if (!text) return 0;
  const direct = Date.parse(text);
  if (Number.isFinite(direct)) return direct;
  const normalized = text.replace(" ", "T");
  const normalizedTime = Date.parse(normalized);
  return Number.isFinite(normalizedTime) ? normalizedTime : 0;
}
function getMarketPublishTime(mod) {
  const variants = Array.isArray(mod?._collectionVariants) ? mod._collectionVariants : [mod];
  return Math.max(
    0,
    ...variants.map(
      (item) => parseMarketTime(
        item?.publishedAt || item?.published_at || item?.approvedAt || item?.approved_at || item?.createdAt || item?.created_at || item?.updatedAt || item?.updated_at
      )
    )
  );
}
function isMarketRecentlyPublished(mod, now = Date.now()) {
  const publishTime = getMarketPublishTime(mod);
  if (!publishTime) return false;
  return publishTime <= now + 60 * 1e3 && now - publishTime <= MARKET_UPDATE_BADGE_DURATION_MS;
}
function getCardDownloadCount(mod) {
  const variants = Array.isArray(mod?._collectionVariants) ? mod._collectionVariants : [];
  if (!variants.length) return getMarketDownloadCount(mod);
  return Math.max(getMarketDownloadCount(mod), ...variants.map(getMarketDownloadCount));
}
function getMarketOrderValue(mod, keys, fallback = Number.MAX_SAFE_INTEGER) {
  for (const key of keys) {
    const value = Number(mod?.[key]);
    if (Number.isFinite(value)) return value;
  }
  return fallback;
}
function getMarketSectionValue(mod) {
  return String(
    mod?.marketSection || mod?.homeSection || mod?.section || mod?.featuredSection || mod?.displaySection || ""
  ).toLowerCase();
}
function modHasTruthyFlag(mod, keys) {
  return keys.some((key) => {
    const value = mod?.[key];
    return value === true || value === 1 || value === "1" || String(value).toLowerCase() === "true";
  });
}
function isMarketPinnedMod(mod) {
  const variants = Array.isArray(mod?._collectionVariants) ? mod._collectionVariants : [mod];
  return variants.some((item) => modHasTruthyFlag(item, ["pinned", "isPinned", "marketPinned", "homePinned", "featuredPinned"]) || ["pinned", "pin", "top", "sticky"].includes(getMarketSectionValue(item)));
}
function isMarketHotMod(mod) {
  const variants = Array.isArray(mod?._collectionVariants) ? mod._collectionVariants : [mod];
  return variants.some((item) => modHasTruthyFlag(item, ["hot", "isHot", "marketHot", "homeHot", "popular", "isPopular"]) || ["hot", "popular", "trending"].includes(getMarketSectionValue(item)));
}
const NON_MOD_HOT_CATEGORY_VALUES = /* @__PURE__ */ new Set([
  "tool",
  "tools",
  "utility",
  "utilities",
  "manager",
  "fixer",
  "fix",
  "hotfix",
  "patch",
  "proxy",
  "vpn",
  "magic",
  "function",
  "feature",
  "functional",
  "工具",
  "工具类",
  "修复",
  "修复器",
  "修复工具",
  "修复补丁",
  "补丁",
  "管理器",
  "魔法",
  "功能",
  "功能mod",
  "功能 mod",
  "功能类",
  "前置",
  "前置mod",
  "前置 mod"
]);
const NON_MOD_HOT_TAG_VALUES = /* @__PURE__ */ new Set([
  "tool",
  "tools",
  "utility",
  "utilities",
  "manager",
  "fixer",
  "fix",
  "hotfix",
  "patch",
  "proxy",
  "vpn",
  "magic",
  "工具",
  "工具类",
  "修复器",
  "修复工具",
  "修复补丁",
  "补丁",
  "管理器",
  "魔法"
]);
const NON_MOD_HOT_NAME_PATTERNS = [
  /^mod\s*修复(?:$|[-_－–—\s:：])/i,
  /^功能\s*mod(?:$|[-_－–—\s:：])/i,
  /^功能(?:$|[-_－–—\s:：])/,
  /^前置(?:$|[-_－–—\s:：])/,
  /^修复器(?:$|[-_－–—\s:：])/,
  /^修复工具(?:$|[-_－–—\s:：])/,
  /^修复补丁(?:$|[-_－–—\s:：])/,
  /^管理器(?:$|[-_－–—\s:：])/,
  /^魔法(?:$|[-_－–—\s:：])/,
  /qaq\s*manager/i,
  /qaqmanager/i,
  /(?:^|[-_－–—\s:：])hotfix(?:$|[-_－–—\s:：])/i,
  /(?:^|[-_－–—\s:：])fixer(?:$|[-_－–—\s:：])/i,
  /修复器/,
  /修复工具/,
  /修复补丁/,
  /修复文件/
];
function normalizeMarketTypeText(value) {
  return cleanCollectionText(value).toLowerCase();
}
function getTagNameList(item) {
  if (!Array.isArray(item?.tags)) return [];
  return item.tags.map((tag) => cleanCollectionText(tag?.name || tag?.id || tag)).filter(Boolean);
}
function isNonModDownloadHotItem(item) {
  const categoryValues = [
    item?.marketType,
    item?.contentType,
    item?.resourceType,
    item?.category,
    item?.sourceCategory,
    item?.characterName
  ].map(normalizeMarketTypeText).filter(Boolean);
  if (categoryValues.some((value) => NON_MOD_HOT_CATEGORY_VALUES.has(value))) return true;
  const tags = getTagNameList(item).map(normalizeMarketTypeText);
  if (tags.some((value) => NON_MOD_HOT_TAG_VALUES.has(value))) return true;
  const nameText = cleanCollectionText(
    [
      item?.name,
      item?.collectionName,
      item?._collectionName
    ].filter(Boolean).join(" ")
  );
  return NON_MOD_HOT_NAME_PATTERNS.some((pattern) => pattern.test(nameText));
}
function isDownloadHotEligibleMod(mod) {
  const variants = Array.isArray(mod?._collectionVariants) ? mod._collectionVariants : [mod];
  return variants.every((item) => !isNonModDownloadHotItem(item));
}
function getDownloadHotCharacterKey(mod) {
  const variants = Array.isArray(mod?._collectionVariants) ? mod._collectionVariants : [mod];
  const names = variants.map((item) => getMarketCanonicalCharacterName(item?.characterName || mod?.characterName || "")).filter(Boolean);
  if (!names.length) return "";
  return normalizeCollectionKey(names[0]);
}
function getPinnedOrder(mod) {
  const variants = Array.isArray(mod?._collectionVariants) ? mod._collectionVariants : [mod];
  return Math.min(
    ...variants.map(
      (item) => getMarketOrderValue(item, ["pinnedOrder", "pinOrder", "homePinnedOrder", "sortOrder"])
    )
  );
}
function getHotOrder(mod) {
  const variants = Array.isArray(mod?._collectionVariants) ? mod._collectionVariants : [mod];
  return Math.min(
    ...variants.map(
      (item) => getMarketOrderValue(item, ["hotOrder", "popularOrder", "homeHotOrder", "featuredOrder", "sortOrder"])
    )
  );
}
function splitMarketSections(displayedMods, columnCount, options = {}) {
  const safeColumns = Math.max(1, Number(columnCount) || 4);
  const topCapacity = safeColumns * 2;
  const selectedCharacter = cleanCollectionText(options.selectedCharacter);
  const showHotSection = options.showHotSection !== false;
  const shouldDedupeDownloadHotByCharacter = !selectedCharacter || selectedCharacter === "all";
  const remaining = [...displayedMods];
  const take = (predicate, sorter) => {
    const matches = remaining.filter(predicate).sort(sorter);
    const ids = new Set(matches.map((mod) => String(mod._displayKey || mod.id)));
    for (let i = remaining.length - 1; i >= 0; i--) {
      const key = String(remaining[i]._displayKey || remaining[i].id);
      if (ids.has(key)) remaining.splice(i, 1);
    }
    return matches;
  };
  const pinned = take(
    isMarketPinnedMod,
    (a, b) => getPinnedOrder(a) - getPinnedOrder(b) || (b.updatedAt || "").localeCompare(a.updatedAt || "")
  ).map((mod) => ({ ...mod, _marketSection: "pinned" }));
  const hotSlots = showHotSection ? Math.max(0, topCapacity - pinned.length) : 0;
  const explicitHot = remaining.filter(isMarketHotMod).sort(
    (a, b) => getHotOrder(a) - getHotOrder(b) || getCardDownloadCount(b) - getCardDownloadCount(a) || (b.updatedAt || "").localeCompare(a.updatedAt || "")
  );
  const explicitHotKeys = new Set(explicitHot.map((mod) => String(mod._displayKey || mod.id)));
  const hotCharacterKeys = shouldDedupeDownloadHotByCharacter ? new Set(
    explicitHot.map(getDownloadHotCharacterKey).filter(Boolean)
  ) : /* @__PURE__ */ new Set();
  const downloadHot = remaining.filter(
    (mod) => !explicitHotKeys.has(String(mod._displayKey || mod.id)) && isDownloadHotEligibleMod(mod)
  ).sort(
    (a, b) => getCardDownloadCount(b) - getCardDownloadCount(a) || (b.updatedAt || "").localeCompare(a.updatedAt || "")
  ).filter((mod) => {
    if (!shouldDedupeDownloadHotByCharacter) return true;
    const characterKey = getDownloadHotCharacterKey(mod);
    if (!characterKey) return true;
    if (hotCharacterKeys.has(characterKey)) return false;
    hotCharacterKeys.add(characterKey);
    return true;
  });
  const hot = showHotSection ? [...explicitHot, ...downloadHot].slice(0, hotSlots) : [];
  const hotKeys = new Set(hot.map((mod) => String(mod._displayKey || mod.id)));
  const updates = remaining.filter((mod) => !hotKeys.has(String(mod._displayKey || mod.id))).map((mod) => ({ ...mod, _marketSection: "updates" }));
  return [
    ...pinned,
    ...hot.map((mod) => ({ ...mod, _marketSection: "hot" })),
    ...updates
  ];
}
function getCollectionCardTitle(mod) {
  if (!mod?._isCollectionCard) return mod?.name || "";
  const collectionName = cleanCollectionText(mod._collectionName || mod.collectionName || mod.name);
  const characterName = cleanCollectionText(mod.characterName);
  if (!collectionName || !characterName || characterName.toLowerCase() === "all") {
    return collectionName || mod?.name || "";
  }
  const collectionKey = normalizeCollectionKey(collectionName);
  const characterKey = normalizeCollectionKey(characterName);
  if (characterKey && collectionKey.startsWith(characterKey)) return collectionName;
  return `${characterName}-${collectionName}`;
}
function getVariantSourceLabel(mod) {
  const sources = [];
  if (hasMarketDirectSource(mod) && readAuthSession()?.token) sources.push("下载");
  if (mod?.downloadUrl) sources.push("百度");
  if (mod?.quarkDownloadUrl) sources.push("夸克");
  return sources.join(" / ") || "暂无下载";
}
function compareCollectionVariants(a, b) {
  const orderDiff = (a.collectionSortOrder || 0) - (b.collectionSortOrder || 0);
  if (orderDiff !== 0) return orderDiff;
  const primaryDiff = (b.isCollectionPrimary ? 1 : 0) - (a.isCollectionPrimary ? 1 : 0);
  if (primaryDiff !== 0) return primaryDiff;
  const versionA = normalizeVariantVersionLabel(
    a._clientEffectiveVariantVersion || a.variantVersion || parseClientCollectionName(a)?.variantVersion
  );
  const versionB = normalizeVariantVersionLabel(
    b._clientEffectiveVariantVersion || b.variantVersion || parseClientCollectionName(b)?.variantVersion
  );
  if (versionA || versionB) return compareVariantVersionLabels(versionA, versionB);
  return (b.updatedAt || "").localeCompare(a.updatedAt || "");
}
function applyClientVariantVersionDefaults(group, aliasIndex = DEFAULT_MARKET_CHARACTER_ALIAS_INDEX) {
  const variants = group.variants.map((variant) => {
    const parsed = parseClientCollectionName(variant, aliasIndex);
    return {
      variant,
      nameVersion: normalizeVariantVersionLabel(
        variant?._clientNameVariantVersion || parsed?.nameVariantVersion
      ),
      storedVersion: normalizeVariantVersionLabel(variant?.variantVersion)
    };
  });
  const hasNamedV10 = variants.some((item) => item.nameVersion === "V1.0");
  group.variants = variants.map(({ variant, nameVersion, storedVersion }) => {
    let effectiveVersion = nameVersion;
    if (!effectiveVersion) {
      effectiveVersion = hasNamedV10 && (!storedVersion || storedVersion === "V1.0") ? "V0.5" : storedVersion || "V1.0";
    }
    return {
      ...variant,
      _clientNameVariantVersion: nameVersion || "",
      _clientEffectiveVariantVersion: effectiveVersion
    };
  });
}
function buildCollectionData(sourceMods = [], aliasIndex = DEFAULT_MARKET_CHARACTER_ALIAS_INDEX) {
  const records = sourceMods.map((mod) => {
    const parsed = parseClientCollectionName(mod, aliasIndex);
    const characterName = getMarketCanonicalCharacterName(mod?.characterName || "all", aliasIndex);
    return {
      mod,
      parsed,
      explicitIdentity: getExplicitCollectionIdentity(mod, aliasIndex),
      gameId: getModGameId(mod),
      characterName
    };
  }).filter((record) => record.mod?.id != null);
  const fallbackBuckets = /* @__PURE__ */ new Map();
  records.forEach((record) => {
    if (record.explicitIdentity || !record.parsed?.collectionKey) return;
    const bucketKey = `${record.gameId}:${record.characterName}`;
    if (!fallbackBuckets.has(bucketKey)) fallbackBuckets.set(bucketKey, []);
    fallbackBuckets.get(bucketKey).push(record);
  });
  const groups = /* @__PURE__ */ new Map();
  const identityByModId = /* @__PURE__ */ new Map();
  function addToGroup(identity, collectionName, mod, meta = {}) {
    if (!groups.has(identity)) {
      groups.set(identity, {
        identity,
        name: cleanCollectionText(collectionName) || mod.collectionName || mod.name,
        variants: []
      });
    }
    groups.get(identity).variants.push(Object.keys(meta).length ? { ...mod, ...meta } : mod);
    identityByModId.set(String(mod.id), identity);
  }
  records.forEach((record) => {
    if (!record.explicitIdentity) return;
    const explicitMeta = getExplicitCollectionMeta(record.mod, record.parsed, aliasIndex);
    if (!cleanCollectionText(explicitMeta.collectionName)) return;
    addToGroup(
      record.explicitIdentity,
      explicitMeta.collectionName,
      record.mod,
      {
        _clientCollectionName: explicitMeta.collectionName,
        _clientVariantName: explicitMeta.variantName,
        _clientVariantVersion: explicitMeta.parsedVersion,
        _clientNameVariantVersion: explicitMeta.parsedVersion
      }
    );
  });
  fallbackBuckets.forEach((bucket) => {
    const candidates = Array.from(
      new Map(
        bucket.filter((record) => record.parsed?.collectionKey).map((record) => [record.parsed.collectionKey, record.parsed.collectionName])
      )
    ).sort((a, b) => a[0].length - b[0].length);
    bucket.forEach((record) => {
      const parsed = record.parsed;
      let collectionName = parsed.collectionName;
      let collectionKey = parsed.collectionKey;
      let variantName = parsed.variantName;
      for (const [candidateKey, candidateName] of candidates) {
        if (!candidateKey || candidateKey === collectionKey) continue;
        if (collectionKey.startsWith(candidateKey) && candidateKey.length >= 2) {
          collectionName = candidateName;
          collectionKey = candidateKey;
          if (!variantName && parsed.bodyCore.startsWith(candidateName)) {
            variantName = cleanCollectionText(parsed.bodyCore.slice(candidateName.length));
          }
          break;
        }
      }
      const identity = `name:${record.gameId}:${record.characterName}:${collectionKey}`;
      addToGroup(identity, collectionName, record.mod, {
        _clientCollectionName: collectionName,
        _clientVariantName: variantName,
        _clientVariantVersion: parsed.nameVariantVersion,
        _clientNameVariantVersion: parsed.nameVariantVersion
      });
    });
  });
  groups.forEach((group, identity) => {
    applyClientVariantVersionDefaults(group, aliasIndex);
    group.variants = [...group.variants].sort((a, b) => compareCollectionVariants(a, b));
    if (group.variants.length <= 1) {
      group.variants.forEach((mod) => identityByModId.delete(String(mod.id)));
      groups.delete(identity);
    }
  });
  return { groups, identityByModId };
}
function buildCollectionDisplayMods(filteredMods, selectedCollectionVariants, collectionData) {
  if (!collectionData?.groups?.size) return filteredMods;
  const filteredByIdentity = /* @__PURE__ */ new Map();
  filteredMods.forEach((mod) => {
    const identity = collectionData.identityByModId.get(String(mod.id));
    if (!identity || !collectionData.groups.has(identity)) return;
    if (!filteredByIdentity.has(identity)) filteredByIdentity.set(identity, []);
    filteredByIdentity.get(identity).push(mod);
  });
  const displayed = [];
  const seenIdentities = /* @__PURE__ */ new Set();
  filteredMods.forEach((mod) => {
    const identity = collectionData.identityByModId.get(String(mod.id));
    const group = identity ? collectionData.groups.get(identity) : null;
    if (!group) {
      displayed.push(mod);
      return;
    }
    if (seenIdentities.has(identity)) return;
    seenIdentities.add(identity);
    const selectedId = selectedCollectionVariants[identity];
    const filteredGroup = filteredByIdentity.get(identity) || [];
    const selected = group.variants.find((variant) => String(variant.id) === String(selectedId)) || group.variants.find((variant) => filteredGroup.some((item) => item.id === variant.id)) || group.variants[0];
    displayed.push({
      ...selected,
      _displayKey: `collection:${identity}`,
      _isCollectionCard: true,
      _collectionIdentity: identity,
      _collectionName: group.name,
      _collectionVariants: group.variants,
      _collectionFilteredCount: filteredGroup.length
    });
  });
  return displayed;
}
function MarketImage({
  src,
  alt = "",
  className = "",
  imgClassName = "",
  loading = "lazy",
  fetchPriority = "auto",
  onClick,
  style,
  retryLimit = 2
}) {
  const rootRef = reactExports.useRef(null);
  const [visible, setVisible] = reactExports.useState(loading === "eager");
  const [status, setStatus] = reactExports.useState(src ? "loading" : "empty");
  const [retryCount, setRetryCount] = reactExports.useState(0);
  const [naturalRatio, setNaturalRatio] = reactExports.useState(null);
  reactExports.useEffect(() => {
    setStatus(src ? "loading" : "empty");
    setRetryCount(0);
    setNaturalRatio(null);
  }, [src]);
  reactExports.useEffect(() => {
    if (visible || loading === "eager") return void 0;
    const node = rootRef.current;
    if (!node) return void 0;
    if (!("IntersectionObserver" in window)) {
      setVisible(true);
      return void 0;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting || entry.intersectionRatio > 0)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "280px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loading, visible]);
  const shouldLoad = !!src && visible;
  const requestSrc = shouldLoad ? retryCount > 0 ? `${src}${src.includes("?") ? "&" : "?"}qaqm_img_retry=${retryCount}` : src : void 0;
  const ratioClass = naturalRatio ? naturalRatio >= 1.72 ? " market-image-wide" : naturalRatio >= 1.45 ? " market-image-landscape" : naturalRatio <= 0.85 ? " market-image-portrait" : " market-image-standard" : "";
  function handleError() {
    if (retryCount < retryLimit) {
      const nextRetry = retryCount + 1;
      setTimeout(() => {
        setRetryCount(nextRetry);
        setStatus("loading");
      }, Math.min(1200 * nextRetry, 3200));
      return;
    }
    setStatus("error");
  }
  function handleRetry(e) {
    e.stopPropagation();
    setRetryCount((count) => count + 1);
    setStatus("loading");
    setVisible(true);
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      ref: rootRef,
      className: `market-image ${className} market-image-${status}${ratioClass}`,
      style: {
        ...style,
        ...naturalRatio ? { "--natural-ratio": naturalRatio } : {}
      },
      onClick,
      children: [
        requestSrc && status !== "error" && /* @__PURE__ */ jsxRuntimeExports.jsx(
          "img",
          {
            src: requestSrc,
            alt,
            className: imgClassName,
            loading,
            decoding: "async",
            fetchpriority: fetchPriority,
            onLoad: (e) => {
              const img = e.currentTarget;
              if (img?.naturalWidth && img?.naturalHeight) {
                const ratio = img.naturalWidth / img.naturalHeight;
                if (Number.isFinite(ratio) && ratio > 0) {
                  setNaturalRatio(ratio);
                }
              }
              setStatus("loaded");
            },
            onError: handleError,
            draggable: false
          }
        ),
        (status === "loading" || !shouldLoad) && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "market-image-skeleton" }),
        status === "error" && /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { type: "button", className: "market-image-error", onClick: handleRetry, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "🖼️" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: "图片加载失败" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("em", { children: "点击重试，海外图床可能需要开启代理" })
        ] }),
        status === "empty" && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "market-image-empty", children: "🖼️" })
      ]
    }
  );
}
function LightboxOverlay({ images, index, onClose, onChange }) {
  const [currentIdx, setCurrentIdx] = reactExports.useState(index);
  const hasMultiple = images.length > 1;
  reactExports.useEffect(() => {
    setCurrentIdx(index);
  }, [index]);
  reactExports.useEffect(() => {
    function handleKey(e) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (!hasMultiple) return;
      if (e.key === "ArrowLeft") {
        setCurrentIdx((i) => {
          const n = (i - 1 + images.length) % images.length;
          onChange?.(n);
          return n;
        });
      } else if (e.key === "ArrowRight") {
        setCurrentIdx((i) => {
          const n = (i + 1) % images.length;
          onChange?.(n);
          return n;
        });
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [images.length, hasMultiple, onClose, onChange]);
  const goPrev = (e) => {
    e.stopPropagation();
    setCurrentIdx((i) => {
      const n = (i - 1 + images.length) % images.length;
      onChange?.(n);
      return n;
    });
  };
  const goNext = (e) => {
    e.stopPropagation();
    setCurrentIdx((i) => {
      const n = (i + 1) % images.length;
      onChange?.(n);
      return n;
    });
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lightbox-overlay", onClick: onClose, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "button",
      {
        className: "lightbox-close",
        onClick: (e) => {
          e.stopPropagation();
          onClose();
        },
        children: "✕"
      }
    ),
    hasMultiple && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "lightbox-nav lightbox-nav-prev", onClick: goPrev, children: "‹" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "lightbox-nav lightbox-nav-next", onClick: goNext, children: "›" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "lightbox-counter", onClick: (e) => e.stopPropagation(), children: [
        currentIdx + 1,
        " / ",
        images.length
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "lightbox-content", onClick: (e) => e.stopPropagation(), children: /* @__PURE__ */ jsxRuntimeExports.jsx(
      MarketImage,
      {
        src: images[currentIdx]?.url,
        alt: "预览",
        className: "market-image-lightbox",
        loading: "eager",
        fetchPriority: "high"
      }
    ) })
  ] });
}
const MARKET_SCROLL_RESTORE_MIN_TOP = 360;
const MARKET_SCROLL_STORAGE_PREFIX = "qaqm-mod-market-scroll:";
const MARKET_CHARACTER_PICKER_CACHE_PREFIX = "qaqm-market-character-picker:";
const MARKET_FIRST_PAINT_LIMIT = 24;
const MARKET_SESSION_CACHE_MAX_AGE_MS = 10 * 60 * 1e3;
const MARKET_SESSION_CACHE = /* @__PURE__ */ new Map();
function getMarketSessionCache(gameId) {
  const key = cleanCollectionText(gameId || "default");
  if (!key) return null;
  const cached = MARKET_SESSION_CACHE.get(key);
  if (!cached) return null;
  if (Date.now() - Number(cached.savedAt || 0) > MARKET_SESSION_CACHE_MAX_AGE_MS) {
    MARKET_SESSION_CACHE.delete(key);
    return null;
  }
  return cached;
}
function createMarketSyncStatus(result, previous = null) {
  return {
    ...previous || {},
    fromCache: result?.fromCache || false,
    wasIncremental: result?.wasIncremental || false,
    updatedCount: result?.updatedCount || 0,
    deletedCount: result?.deletedCount || 0,
    syncError: result?.syncError || null,
    fallbackUrl: result?.fallbackUrl || null,
    primarySyncError: result?.primarySyncError || null,
    marketAccess: normalizeMarketAccessPayload(result?.marketAccess),
    refreshBlocked: result?.refreshBlocked === true
  };
}
function createLoginRequiredMarketAccess(marketAccess) {
  const current = normalizeMarketAccessPayload(marketAccess);
  return {
    ...current || {},
    controlled: true,
    allowed: false,
    code: "LOGIN_REQUIRED",
    clearExisting: false
  };
}
function writeMarketSessionCache(gameId, patch) {
  const key = cleanCollectionText(gameId || "default");
  if (!key || !patch || typeof patch !== "object") return;
  const prev = MARKET_SESSION_CACHE.get(key) || {};
  MARKET_SESSION_CACHE.set(key, {
    ...prev,
    ...patch,
    gameId: key,
    savedAt: Date.now()
  });
}
function clearMarketSessionCache(gameId) {
  const key = cleanCollectionText(gameId || "default");
  if (key) MARKET_SESSION_CACHE.delete(key);
}
function scheduleMarketWork(callback, { timeout = 1200, delay = 48 } = {}) {
  if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
    return {
      type: "idle",
      id: window.requestIdleCallback(callback, { timeout })
    };
  }
  return {
    type: "timer",
    id: window.setTimeout(callback, delay)
  };
}
function cancelMarketWork(handle) {
  if (!handle) return;
  if (handle.type === "idle" && typeof window !== "undefined" && typeof window.cancelIdleCallback === "function") {
    window.cancelIdleCallback(handle.id);
    return;
  }
  window.clearTimeout(handle.id);
}
function logMarketPerf(label, startedAt, extra = "") {
}
function getMarketScrollStorageKey(gameId) {
  return `${MARKET_SCROLL_STORAGE_PREFIX}${gameId || "default"}`;
}
function readMarketScrollState(storageKey) {
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const scrollTop = Number(parsed?.scrollTop || 0);
    if (!Number.isFinite(scrollTop) || scrollTop < MARKET_SCROLL_RESTORE_MIN_TOP) return null;
    return {
      scrollTop,
      page: Math.max(1, Number(parsed?.page || 1)),
      savedAt: Number(parsed?.savedAt || 0),
      filters: normalizeMarketScrollFilters(parsed?.filters)
    };
  } catch {
    return null;
  }
}
function writeMarketScrollState(storageKey, payload) {
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(payload));
  } catch {
  }
}
function removeMarketScrollState(storageKey) {
  try {
    sessionStorage.removeItem(storageKey);
  } catch {
  }
}
function getMarketCharacterPickerCacheKey(gameId) {
  return `${MARKET_CHARACTER_PICKER_CACHE_PREFIX}${gameId || "default"}`;
}
function readMarketCharacterPickerCache(gameId) {
  try {
    const raw = localStorage.getItem(getMarketCharacterPickerCacheKey(gameId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return {
      roleOptions: Array.isArray(parsed.roleOptions) ? parsed.roleOptions : [],
      functionOptions: Array.isArray(parsed.functionOptions) ? parsed.functionOptions : [],
      covers: parsed.covers && typeof parsed.covers === "object" ? parsed.covers : {},
      characterDetails: Array.isArray(parsed.characterDetails) ? parsed.characterDetails : []
    };
  } catch {
    return null;
  }
}
function writeMarketCharacterPickerCache(gameId, payload) {
  try {
    localStorage.setItem(
      getMarketCharacterPickerCacheKey(gameId),
      JSON.stringify({
        ...payload,
        savedAt: Date.now()
      })
    );
  } catch {
  }
}
function normalizeMarketCharacterDetails(details) {
  if (!Array.isArray(details)) return [];
  return details.map((item) => {
    const name = cleanCollectionText(item?.name || item?.zh || item?.displayName);
    if (!name) return null;
    return {
      name,
      coverUrl: item?.coverUrl || null,
      aliases: Array.isArray(item.aliases) ? item.aliases.map(cleanCollectionText).filter(Boolean) : []
    };
  }).filter(Boolean);
}
function areStringMapsEqual(a = {}, b = {}) {
  const aKeys = Object.keys(a || {});
  const bKeys = Object.keys(b || {});
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => a[key] === b[key]);
}
function areCharacterDetailsEqual(a = [], b = []) {
  if (a.length !== b.length) return false;
  return a.every((item, index) => {
    const other = b[index];
    if (!other || item.name !== other.name || item.coverUrl !== other.coverUrl) return false;
    const aliases = Array.isArray(item.aliases) ? item.aliases : [];
    const otherAliases = Array.isArray(other.aliases) ? other.aliases : [];
    return aliases.length === otherAliases.length && aliases.every((alias, aliasIndex) => alias === otherAliases[aliasIndex]);
  });
}
function normalizeMarketScrollFilters(filters) {
  if (!filters || typeof filters !== "object") return null;
  const selectedTags = filterVisibleMarketTags(Array.isArray(filters.selectedTags) ? filters.selectedTags.map((tag) => {
    const id = cleanCollectionText(tag?.id || tag);
    if (!id) return null;
    return {
      id,
      name: cleanCollectionText(tag?.name || tag?.label || id)
    };
  }).filter(Boolean) : []);
  return {
    selectedGameId: cleanCollectionText(filters.selectedGameId || filters.gameId || "all"),
    searchQuery: String(filters.searchQuery || ""),
    selectedCharacter: cleanCollectionText(filters.selectedCharacter || "all"),
    selectedGameVersion: cleanCollectionText(filters.selectedGameVersion || "all"),
    selectedModMode: cleanCollectionText(filters.selectedModMode || "all"),
    likedOnly: filters.likedOnly === true,
    showHotSection: filters.showHotSection !== false,
    sortBy: cleanCollectionText(filters.sortBy || "newest"),
    selectedTags
  };
}
function getMarketScrollFilterKey(filters) {
  const normalized = normalizeMarketScrollFilters(filters);
  if (!normalized) return "";
  return JSON.stringify({
    selectedGameId: normalized.selectedGameId,
    searchQuery: normalized.searchQuery,
    selectedCharacter: normalized.selectedCharacter,
    selectedGameVersion: normalized.selectedGameVersion,
    selectedModMode: normalized.selectedModMode,
    likedOnly: normalized.likedOnly,
    showHotSection: normalized.showHotSection,
    sortBy: normalized.sortBy,
    selectedTags: normalized.selectedTags.map((tag) => tag.id).sort()
  });
}
function ModMarketView({
  activeGameId,
  games = [],
  devMode = false,
  isActive = true,
  pendingDetailMod,
  onPendingDetailConsumed
}) {
  const initialMarketGameId = activeGameId || "endfield";
  const marketVisibleRef = reactExports.useRef(isActive);
  marketVisibleRef.current = isActive;
  reactExports.useEffect(() => () => { marketVisibleRef.current = false; }, []);
  const initialMarketSessionCache = getMarketSessionCache(initialMarketGameId);
  const initialAuthSession = readAuthSession();
  const initialCachedMarketAccess = initialMarketSessionCache?.syncStatus?.marketAccess;
  const initialCacheHiddenForAnonymous = shouldHideControlledMarketCache(
    initialCachedMarketAccess,
    Boolean(initialAuthSession?.token)
  );
  const [mods, setMods] = reactExports.useState(
    () => initialCacheHiddenForAnonymous ? [] : initialMarketSessionCache?.mods || []
  );
  const [marketDataGameId, setMarketDataGameId] = reactExports.useState(
    () => initialMarketSessionCache?.mods?.length ? initialMarketSessionCache.gameId : null
  );
  const [loading, setLoading] = reactExports.useState(false);
  const [initialCacheReady, setInitialCacheReady] = reactExports.useState(
    () => Boolean(initialMarketSessionCache?.mods?.length) || initialCacheHiddenForAnonymous
  );
  const [syncing, setSyncing] = reactExports.useState(false);
  const [error, setError] = reactExports.useState(null);
  const [serverUrl, setServerUrl] = reactExports.useState(() => initialMarketSessionCache?.serverUrl || "https://qaqm.top");
  const [syncStatus, setSyncStatus] = reactExports.useState(
    () => initialCacheHiddenForAnonymous ? createMarketSyncStatus(
      {
        refreshBlocked: true,
        marketAccess: createLoginRequiredMarketAccess(initialCachedMarketAccess)
      },
      initialMarketSessionCache?.syncStatus
    ) : initialMarketSessionCache?.syncStatus || null
  );
  const [searchQuery, setSearchQuery] = reactExports.useState(() => initialMarketSessionCache?.filters?.searchQuery || "");
  const [selectedGameId, setSelectedGameId] = reactExports.useState(
    () => initialMarketSessionCache?.filters?.selectedGameId || activeGameId || "endfield"
  );
  const [selectedCharacter, setSelectedCharacter] = reactExports.useState(
    () => initialMarketSessionCache?.filters?.selectedCharacter || "all"
  );
  const [selectedGameVersion, setSelectedGameVersion] = reactExports.useState(
    () => initialMarketSessionCache?.filters?.selectedGameVersion || "all"
  );
  const [selectedModMode, setSelectedModMode] = reactExports.useState(
    () => initialMarketSessionCache?.filters?.selectedModMode || "all"
  );
  const [likedOnly, setLikedOnly] = reactExports.useState(
    () => initialMarketSessionCache?.filters?.likedOnly === true
  );
  const [selectedTags, setSelectedTags] = reactExports.useState(() => initialMarketSessionCache?.filters?.selectedTags || []);
  const [sortBy, setSortBy] = reactExports.useState(() => initialMarketSessionCache?.filters?.sortBy || "newest");
  const PAGE_SIZE = 24;
  const [currentPage, setCurrentPage] = reactExports.useState(() => initialMarketSessionCache?.currentPage || 1);
  const [infiniteScroll, setInfiniteScroll] = reactExports.useState(() => {
    const saved = localStorage.getItem("modmarket-infinite-scroll");
    return saved === null ? true : saved === "true";
  });
  const [equalRowHeight, setEqualRowHeight] = reactExports.useState(() => {
    const saved = localStorage.getItem("modmarket-equal-row-height");
    return saved === null ? true : saved === "true";
  });
  const [showHotSection, setShowHotSection] = reactExports.useState(() => {
    const saved = localStorage.getItem("modmarket-show-hot-section");
    return saved === null ? true : saved === "true";
  });
  const [showLayoutMenu, setShowLayoutMenu] = reactExports.useState(false);
  const [lightboxData, setLightboxData] = reactExports.useState(null);
  const [cardImageIdx, setCardImageIdx] = reactExports.useState({});
  const [selectedCollectionVariants, setSelectedCollectionVariants] = reactExports.useState({});
  const [openCollectionVariantMenu, setOpenCollectionVariantMenu] = reactExports.useState(null);
  const [detailMod, setDetailMod] = reactExports.useState(null);
  const [detailGalleryIdx, setDetailGalleryIdx] = reactExports.useState(0);
  const [closingDetail, setClosingDetail] = reactExports.useState(false);
  const relatedScrollRef = reactExports.useRef(null);
  const [feedbackTargetMod, setFeedbackTargetMod] = reactExports.useState(null);
  const [toast, setToast] = reactExports.useState(null);
  const [downloadPrompt, setDownloadPrompt] = reactExports.useState(null);
  const [likedMods, setLikedMods] = reactExports.useState(/* @__PURE__ */ new Set());
  const [commentCounts, setCommentCounts] = reactExports.useState({});
  const [modMarketCardScale, setModMarketCardScale] = reactExports.useState(100);
  const [clientId, setClientId] = reactExports.useState(() => getCachedClientId() || "");
  reactExports.useEffect(() => {
    let cancelled = false;
    getCanonicalClientId().then((id) => {
      if (cancelled) return;
      if (id && id !== clientId) setClientId(id);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const [showBackToTop, setShowBackToTop] = reactExports.useState(false);
  const [showBackToMarketPosition, setShowBackToMarketPosition] = reactExports.useState(false);
  const [savedMarketScroll, setSavedMarketScroll] = reactExports.useState(null);
  const contentRef = reactExports.useRef(null);
  const marketGridRef = reactExports.useRef(null);
  const currentPageRef = reactExports.useRef(1);
  const infiniteScrollRef = reactExports.useRef(infiniteScroll);
  const marketScrollFiltersRef = reactExports.useRef(null);
  const skipNextFilterPageResetRef = reactExports.useRef(false);
  const pendingMarketRestoreRef = reactExports.useRef(null);
  const marketRestoreTimerRef = reactExports.useRef(null);
  const marketWarmupTimerRef = reactExports.useRef(null);
  const marketInitCacheRequestRef = reactExports.useRef({ key: null, promise: null });
  const marketInitConfigRequestRef = reactExports.useRef(null);
  const marketInitSyncRequestRef = reactExports.useRef({ key: null, promise: null });
  const marketSilentRefreshRef = reactExports.useRef({ key: null, promise: null });
  const marketApplyRequestTrackerRef = reactExports.useRef(createLatestRequestTracker());
  const marketAuthIdentityRef = reactExports.useRef(getAuthSessionIdentity(readAuthSession()));
  const marketDownloadInFlightRef = reactExports.useRef(/* @__PURE__ */ new Set());
  const marketModsRef = reactExports.useRef(mods);
  const marketSyncStatusRef = reactExports.useRef(syncStatus);
  const activeGameIdRef = reactExports.useRef(activeGameId || null);
  const [marketGridColumns, setMarketGridColumns] = reactExports.useState(4);
  reactExports.useEffect(() => {
    marketModsRef.current = mods;
  }, [mods]);
  reactExports.useEffect(() => {
    marketSyncStatusRef.current = syncStatus;
  }, [syncStatus]);
  const [serverGameVersions, setServerGameVersions] = reactExports.useState(() => initialMarketSessionCache?.serverGameVersions || []);
  const [defaultCharacterCovers, setDefaultCharacterCovers] = reactExports.useState(
    () => initialMarketSessionCache?.defaultCharacterCovers || {}
  );
  const [defaultCharacterDetails, setDefaultCharacterDetails] = reactExports.useState(
    () => initialMarketSessionCache?.defaultCharacterDetails || []
  );
  const [marketCharacterAliasPools, setMarketCharacterAliasPools] = reactExports.useState(
    () => initialMarketSessionCache?.marketCharacterAliasPools || []
  );
  const [cachedCharacterPickerOptions, setCachedCharacterPickerOptions] = reactExports.useState(() => ({
    roleOptions: [],
    functionOptions: []
  }));
  const [marketWarmData, setMarketWarmData] = reactExports.useState(() => ({
    ready: Boolean(initialMarketSessionCache?.marketWarmData?.ready && initialMarketSessionCache?.mods?.length),
    sourceSignature: initialMarketSessionCache?.modsSignature || "",
    collectionData: initialMarketSessionCache?.marketWarmData?.collectionData || createEmptyCollectionData(),
    characterStats: initialMarketSessionCache?.marketWarmData?.characterStats || /* @__PURE__ */ new Map()
  }));
  const [popularityData, setPopularityData] = reactExports.useState(() => initialMarketSessionCache?.popularityData || {});
  const loadedCommentCountIdsRef = reactExports.useRef(/* @__PURE__ */ new Set());
  const [showRefreshMenu, setShowRefreshMenu] = reactExports.useState(false);
  const [showCharacterPicker, setShowCharacterPicker] = reactExports.useState(false);
  const refreshMenuRef = reactExports.useRef(null);
  const layoutMenuRef = reactExports.useRef(null);
  const characterPickerRef = reactExports.useRef(null);
  const gameOptions = reactExports.useMemo(
    () => games.map((game) => ({ id: game.id, name: game.name })),
    [games]
  );
  const gameNameMap = reactExports.useMemo(
    () => Object.fromEntries(gameOptions.map((game) => [game.id, game.name])),
    [gameOptions]
  );
  const marketGameId = gameOptions.some((game) => game.id === selectedGameId) ? selectedGameId : activeGameId || "endfield";
  const marketCharacterAliasIndex = reactExports.useMemo(
    () => createMarketCharacterAliasIndex(marketCharacterAliasPools),
    [marketCharacterAliasPools]
  );
  reactExports.useEffect(() => {
    const cached = readMarketCharacterPickerCache(marketGameId);
    const cachedDetails = normalizeMarketCharacterDetails(cached?.characterDetails);
    setCachedCharacterPickerOptions({
      roleOptions: cached?.roleOptions || [],
      functionOptions: cached?.functionOptions || []
    });
    setDefaultCharacterCovers(cached?.covers || {});
    setDefaultCharacterDetails(cachedDetails);
    setMarketCharacterAliasPools(
      cachedDetails.map((item) => ({
        canonical: item.name,
        aliases: item.aliases
      }))
    );
  }, [marketGameId]);
  reactExports.useEffect(() => {
    if (!toast) return void 0;
    const timer = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timer);
  }, [toast]);
  reactExports.useEffect(() => {
    let cancelled = false;
    window.api.getConfig?.().then((result) => {
      if (cancelled || !result?.success) return;
      setModMarketCardScale(normalizeMarketCardScale(result.config?.modMarketCardSize));
    }).catch(() => {
    });
    function handleCardSizeChanged(event) {
      setModMarketCardScale(normalizeMarketCardScale(event?.detail?.size));
    }
    window.addEventListener("qaqm:mod-market-card-size-changed", handleCardSizeChanged);
    return () => {
      cancelled = true;
      window.removeEventListener("qaqm:mod-market-card-size-changed", handleCardSizeChanged);
    };
  }, []);
  reactExports.useEffect(() => {
    let cancelled = false;
    let timer = null;
    async function loadDefaultCharacterCovers() {
      try {
        const result = await window.api.getDefaultCharacters?.(marketGameId);
        if (cancelled || !result?.success) return;
        const covers = {};
        const details = [];
        if (Array.isArray(result.characterDetails)) {
          result.characterDetails.forEach((item) => {
            if (item?.name && item?.coverUrl) covers[item.name] = item.coverUrl;
            if (item?.name) {
              details.push({
                name: item.name,
                coverUrl: item.coverUrl || null,
                aliases: Array.isArray(item.aliases) ? item.aliases : []
              });
            }
          });
        }
        const normalizedDetails = normalizeMarketCharacterDetails(details);
        setDefaultCharacterCovers((prev) => areStringMapsEqual(prev, covers) ? prev : covers);
        setDefaultCharacterDetails(
          (prev) => areCharacterDetailsEqual(prev, normalizedDetails) ? prev : normalizedDetails
        );
      } catch {
        if (!cancelled) setDefaultCharacterCovers({});
      }
    }
    timer = window.setTimeout(loadDefaultCharacterCovers, showCharacterPicker ? 0 : 1800);
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [marketGameId, showCharacterPicker]);
  reactExports.useEffect(() => {
    if (!showRefreshMenu) return void 0;
    function handleDocClick(e) {
      if (refreshMenuRef.current && !refreshMenuRef.current.contains(e.target)) {
        setShowRefreshMenu(false);
      }
    }
    function handleKey(e) {
      if (e.key === "Escape") setShowRefreshMenu(false);
    }
    document.addEventListener("mousedown", handleDocClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleDocClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [showRefreshMenu]);
  reactExports.useEffect(() => {
    if (!showLayoutMenu) return void 0;
    function handleDocClick(e) {
      if (layoutMenuRef.current && !layoutMenuRef.current.contains(e.target)) {
        setShowLayoutMenu(false);
      }
    }
    function handleKey(e) {
      if (e.key === "Escape") setShowLayoutMenu(false);
    }
    document.addEventListener("mousedown", handleDocClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleDocClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [showLayoutMenu]);
  reactExports.useEffect(() => {
    if (!showCharacterPicker) return void 0;
    function handleDocClick(e) {
      if (characterPickerRef.current && !characterPickerRef.current.contains(e.target)) {
        setShowCharacterPicker(false);
      }
    }
    function handleKey(e) {
      if (e.key === "Escape") setShowCharacterPicker(false);
    }
    document.addEventListener("mousedown", handleDocClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleDocClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [showCharacterPicker]);
  reactExports.useEffect(() => {
    if (!openCollectionVariantMenu) return void 0;
    function handleDocClick() {
      setOpenCollectionVariantMenu(null);
    }
    function handleKey(e) {
      if (e.key === "Escape") setOpenCollectionVariantMenu(null);
    }
    document.addEventListener("mousedown", handleDocClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleDocClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [openCollectionVariantMenu]);
  reactExports.useEffect(() => {
    if (!activeGameId || activeGameIdRef.current === activeGameId) return;
    activeGameIdRef.current = activeGameId;
    setSelectedGameId(activeGameId);
    setSelectedCharacter("all");
    setSelectedGameVersion("all");
    setSelectedModMode("all");
  }, [activeGameId]);
  const marketScrollStorageKey = getMarketScrollStorageKey(marketGameId);
  reactExports.useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);
  reactExports.useEffect(() => {
    infiniteScrollRef.current = infiniteScroll;
  }, [infiniteScroll]);
  const currentMarketScrollFilters = reactExports.useMemo(
    () => normalizeMarketScrollFilters({
      selectedGameId,
      searchQuery,
      selectedCharacter,
      selectedGameVersion,
      selectedModMode,
      likedOnly,
      sortBy,
      selectedTags,
      showHotSection
    }),
    [
      selectedGameId,
      searchQuery,
      selectedCharacter,
      selectedGameVersion,
      selectedModMode,
      likedOnly,
      sortBy,
      selectedTags,
      showHotSection
    ]
  );
  const currentMarketScrollFilterKey = reactExports.useMemo(
    () => getMarketScrollFilterKey(currentMarketScrollFilters),
    [currentMarketScrollFilters]
  );
  reactExports.useEffect(() => {
    marketScrollFiltersRef.current = currentMarketScrollFilters;
  }, [currentMarketScrollFilters]);
  reactExports.useEffect(() => {
    const saved = readMarketScrollState(marketScrollStorageKey);
    setSavedMarketScroll(saved);
    setShowBackToMarketPosition(Boolean(saved));
  }, [marketScrollStorageKey]);
  const gameFilteredMods = reactExports.useMemo(() => {
    return mods.filter((mod) => {
      if (selectedGameId === "all") return true;
      if (mod?.gameId === "all") return true;
      return getModGameId(mod) === selectedGameId;
    }).map((mod) => normalizeMarketModCharacter(mod, marketCharacterAliasIndex));
  }, [mods, selectedGameId, marketCharacterAliasIndex]);
  const gameFilteredModsSignature = reactExports.useMemo(
    () => getMarketSnapshotSignature(gameFilteredMods),
    [gameFilteredMods]
  );
  const hasActiveMarketFilters = Boolean(cleanCollectionText(searchQuery)) || selectedCharacter !== "all" || selectedGameVersion !== "all" || selectedModMode !== "all" || likedOnly || selectedTags.length > 0 || sortBy !== "newest";
  const marketIsBooting = !initialCacheReady && marketDataGameId !== marketGameId;
  const marketIsWarmed = marketWarmData.ready && marketWarmData.sourceSignature === gameFilteredModsSignature;
  const collectionData = marketIsWarmed ? marketWarmData.collectionData : EMPTY_COLLECTION_DATA;
  const characterStats = marketWarmData.characterStats;
  const quickGameDisplayedMods = reactExports.useMemo(
    () => gameFilteredMods.slice(0, MARKET_FIRST_PAINT_LIMIT),
    [gameFilteredMods]
  );
  reactExports.useEffect(() => {
    if (marketIsBooting) {
      if (marketWarmupTimerRef.current) {
        cancelMarketWork(marketWarmupTimerRef.current);
        marketWarmupTimerRef.current = null;
      }
      setMarketWarmData(
        (prev) => prev.ready || prev.sourceSignature ? {
          ready: false,
          sourceSignature: "",
          collectionData: prev.collectionData,
          characterStats: /* @__PURE__ */ new Map()
        } : prev
      );
      return void 0;
    }
    const startedAt = performance.now();
    setMarketWarmData(
      (prev) => prev.sourceSignature === gameFilteredModsSignature ? prev : {
        ready: false,
        sourceSignature: gameFilteredModsSignature,
        collectionData: prev.collectionData,
        characterStats: /* @__PURE__ */ new Map()
      }
    );
    if (marketWarmupTimerRef.current) {
      cancelMarketWork(marketWarmupTimerRef.current);
      marketWarmupTimerRef.current = null;
    }
    marketWarmupTimerRef.current = scheduleMarketWork(() => {
      marketWarmupTimerRef.current = null;
      const buildStartedAt = performance.now();
      const nextCollectionData = buildCollectionData(gameFilteredMods, marketCharacterAliasIndex);
      logMarketPerf("buildCollectionData", buildStartedAt, `${gameFilteredMods.length} mods`);
      const statsStartedAt = performance.now();
      const nextCharacterStats = (() => {
        const stats = /* @__PURE__ */ new Map();
        gameFilteredMods.forEach((mod) => {
          const name = getMarketCanonicalCharacterName(mod.characterName, marketCharacterAliasIndex);
          if (!name) return;
          const current = stats.get(name) || { count: 0, recentScore: 0, totalDownloads: 0 };
          current.count += 1;
          current.recentScore += getMarketRecentDownloadScore(mod, popularityData);
          current.totalDownloads += getMarketDownloadCount(mod);
          stats.set(name, current);
        });
        return stats;
      })();
      logMarketPerf("buildCharacterStats", statsStartedAt, `${nextCharacterStats.size} characters`);
      setMarketWarmData({
        ready: true,
        sourceSignature: gameFilteredModsSignature,
        collectionData: nextCollectionData,
        characterStats: nextCharacterStats
      });
      logMarketPerf("marketWarmupTotal", startedAt, `${gameFilteredMods.length} mods`);
    });
    return () => {
      if (marketWarmupTimerRef.current) {
        cancelMarketWork(marketWarmupTimerRef.current);
        marketWarmupTimerRef.current = null;
      }
    };
  }, [gameFilteredMods, gameFilteredModsSignature, popularityData, marketCharacterAliasIndex, marketIsBooting]);
  const characterOptions = reactExports.useMemo(() => {
    return Array.from(characterStats.keys()).sort((a, b) => {
      const statA = characterStats.get(a) || {};
      const statB = characterStats.get(b) || {};
      return (statB.recentScore || 0) - (statA.recentScore || 0) || (statB.totalDownloads || 0) - (statA.totalDownloads || 0) || (statB.count || 0) - (statA.count || 0) || a.localeCompare(b, "zh");
    });
  }, [characterStats]);
  const selectedCharacterLabel = selectedCharacter === "all" ? "全部角色" : getMarketCanonicalCharacterName(selectedCharacter, marketCharacterAliasIndex);
  const visibleSelectedTags = reactExports.useMemo(
    () => filterVisibleMarketTags(selectedTags),
    [selectedTags]
  );
  reactExports.useEffect(() => {
    setSelectedTags((prev) => {
      const filtered = filterVisibleMarketTags(prev);
      return filtered.length === prev.length ? prev : filtered;
    });
  }, []);
  const characterPickerOptions = reactExports.useMemo(() => {
    const roleOptions = [];
    const functionOptions = [];
    characterOptions.forEach((name) => {
      const stats = characterStats.get(name) || {};
      const option = {
        name,
        coverUrl: defaultCharacterCovers[name] || null,
        count: stats.count || 0,
        recentScore: stats.recentScore || 0,
        totalDownloads: stats.totalDownloads || 0
      };
      if (isMarketFunctionCategory(name)) {
        functionOptions.push(option);
      } else {
        roleOptions.push(option);
      }
    });
    return { roleOptions, functionOptions };
  }, [characterOptions, characterStats, defaultCharacterCovers]);
  const visibleCharacterPickerOptions = characterPickerOptions.roleOptions.length || characterPickerOptions.functionOptions.length ? characterPickerOptions : cachedCharacterPickerOptions;
  reactExports.useEffect(() => {
    if (!marketGameId || marketDataGameId !== marketGameId) return;
    if (!mods.length) {
      if (!syncStatus?.refreshBlocked) clearMarketSessionCache(marketGameId);
      return;
    }
    writeMarketSessionCache(marketGameId, {
      mods,
      modsSignature: getMarketSnapshotSignature(mods),
      serverUrl,
      syncStatus,
      filters: currentMarketScrollFilters,
      currentPage,
      serverGameVersions,
      defaultCharacterCovers,
      defaultCharacterDetails,
      marketCharacterAliasPools,
      popularityData,
      marketWarmData: marketWarmData.ready ? {
        ready: true,
        sourceSignature: marketWarmData.sourceSignature,
        collectionData: marketWarmData.collectionData,
        characterStats: marketWarmData.characterStats
      } : null
    });
  }, [
    marketGameId,
    marketDataGameId,
    mods,
    serverUrl,
    syncStatus,
    currentMarketScrollFilters,
    currentPage,
    serverGameVersions,
    defaultCharacterCovers,
    defaultCharacterDetails,
    marketCharacterAliasPools,
    popularityData,
    marketWarmData
  ]);
  reactExports.useEffect(() => {
    if (!characterPickerOptions.roleOptions.length && !characterPickerOptions.functionOptions.length) return;
    writeMarketCharacterPickerCache(marketGameId, {
      ...characterPickerOptions,
      covers: defaultCharacterCovers,
      characterDetails: defaultCharacterDetails
    });
    setCachedCharacterPickerOptions(characterPickerOptions);
  }, [marketGameId, characterPickerOptions, defaultCharacterCovers, defaultCharacterDetails]);
  const gameVersionOptions = reactExports.useMemo(() => {
    if (!marketIsWarmed) return [];
    const versions = /* @__PURE__ */ new Set();
    gameFilteredMods.forEach((mod) => {
      if (mod.game_version) {
        versions.add(mod.game_version);
      }
    });
    serverGameVersions.filter((v) => selectedGameId === "all" || v.gameId === selectedGameId).forEach((v) => versions.add(v.version));
    return Array.from(versions).sort((a, b) => b.localeCompare(a));
  }, [gameFilteredMods, serverGameVersions, selectedGameId, marketIsWarmed]);
  const filteredMods = reactExports.useMemo(() => {
    if (!marketIsWarmed && !hasActiveMarketFilters) {
      return quickGameDisplayedMods;
    }
    const startedAt = performance.now();
    const searchQueries = getExpandedMarketSearchQueries(searchQuery, marketCharacterAliasIndex);
    let result = gameFilteredMods.filter((mod) => {
      if (searchQueries.length > 0) {
        const parsedCollection = parseClientCollectionName(mod, marketCharacterAliasIndex);
        const searchableText = [
          mod.name,
          mod.description,
          mod.characterName,
          mod._originalCharacterName,
          mod.collectionName,
          mod.variantName,
          mod.variantVersion,
          parsedCollection?.collectionName,
          parsedCollection?.variantName,
          parsedCollection?.variantVersion
        ].map((value) => String(value || "").toLowerCase()).join(" ");
        const searchableCompact = normalizeCollectionKey(searchableText);
        if (!searchQueries.some((query) => {
          const compactQuery = normalizeCollectionKey(query);
          return searchableText.includes(query) || compactQuery && searchableCompact.includes(compactQuery);
        }))
          return false;
      }
      if (selectedCharacter !== "all" && !isSameMarketCharacterName(mod.characterName, selectedCharacter, marketCharacterAliasIndex))
        return false;
      if (selectedGameVersion !== "all" && (mod.game_version || "") !== selectedGameVersion)
        return false;
      if (selectedModMode !== "all") {
        const modMode = mod.modMode === "pak" ? "pak" : "d3d";
        if (modMode !== selectedModMode) return false;
      }
      if (likedOnly && !likedMods.has(String(mod.id))) return false;
      if (selectedTags.length > 0) {
        const modTagIds = new Set((mod.tags || []).map((t) => t.id));
        if (!selectedTags.every((st) => modTagIds.has(st.id))) return false;
      }
      return true;
    });
    const pinnedSort = (a, b) => {
      const pinnedDiff = (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
      if (pinnedDiff !== 0) return pinnedDiff;
      return (a.sortOrder || 0) - (b.sortOrder || 0);
    };
    if (sortBy === "downloads") {
      result.sort((a, b) => pinnedSort(a, b) || getMarketDownloadCount(b) - getMarketDownloadCount(a));
    } else if (sortBy === "name") {
      result.sort((a, b) => pinnedSort(a, b) || (a.name || "").localeCompare(b.name || "", "zh"));
    } else if (["hot_today", "hot_week", "hot_month"].includes(sortBy) && popularityData[sortBy]) {
      const popMap = {};
      popularityData[sortBy].forEach((p) => {
        popMap[p.modId] = p.downloads;
      });
      result.sort((a, b) => pinnedSort(a, b) || (popMap[b.id] || 0) - (popMap[a.id] || 0));
    } else {
      result.sort(
        (a, b) => pinnedSort(a, b) || (b.updatedAt || "").localeCompare(a.updatedAt || "")
      );
    }
    logMarketPerf("filterAndSort", startedAt, `${result.length}/${gameFilteredMods.length} mods`);
    return result;
  }, [
    gameFilteredMods,
    quickGameDisplayedMods,
    searchQuery,
    selectedCharacter,
    selectedGameVersion,
    selectedModMode,
    likedOnly,
    likedMods,
    sortBy,
    popularityData,
    selectedTags,
    marketCharacterAliasIndex,
    marketIsWarmed,
    hasActiveMarketFilters
  ]);
  const gameDisplayedMods = reactExports.useMemo(
    () => marketIsWarmed ? buildCollectionDisplayMods(gameFilteredMods, selectedCollectionVariants, collectionData) : gameFilteredMods,
    [gameFilteredMods, selectedCollectionVariants, collectionData, marketIsWarmed]
  );
  const displayedMods = reactExports.useMemo(
    () => marketIsWarmed ? buildCollectionDisplayMods(filteredMods, selectedCollectionVariants, collectionData) : filteredMods,
    [filteredMods, selectedCollectionVariants, collectionData, marketIsWarmed]
  );
  const sectionedDisplayedMods = reactExports.useMemo(
    () => {
      if (!marketIsWarmed && !hasActiveMarketFilters) return displayedMods;
      const startedAt = performance.now();
      const sectioned = splitMarketSections(displayedMods, marketGridColumns, {
        selectedCharacter,
        showHotSection
      });
      logMarketPerf("splitMarketSections", startedAt, `${sectioned.length} cards`);
      return sectioned;
    },
    [displayedMods, marketGridColumns, selectedCharacter, showHotSection, marketIsWarmed, hasActiveMarketFilters]
  );
  reactExports.useEffect(() => {
    const grid = marketGridRef.current;
    if (!grid) return void 0;
    let rafId = null;
    const updateColumns = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        let columns = 0;
        if (equalRowHeight) {
          const computed = window.getComputedStyle(grid);
          columns = computed.gridTemplateColumns.split(" ").filter((part) => part && part !== "none").length;
        } else {
          const minWidth = getMarketCardMinWidth(modMarketCardScale);
          const gap = getMarketCardGap(modMarketCardScale);
          columns = Math.max(1, Math.floor((grid.clientWidth + gap) / (minWidth + gap)));
        }
        if (columns > 0) setMarketGridColumns(columns);
      });
    };
    updateColumns();
    const observer = new ResizeObserver(updateColumns);
    observer.observe(grid);
    window.addEventListener("resize", updateColumns);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      observer.disconnect();
      window.removeEventListener("resize", updateColumns);
    };
  }, [displayedMods.length, modMarketCardScale, equalRowHeight]);
  const detailCollectionGroup = reactExports.useMemo(() => {
    if (!detailMod?.id) return null;
    const identity = detailMod._collectionIdentity || collectionData.identityByModId.get(String(detailMod.id));
    return identity ? collectionData.groups.get(identity) || null : null;
  }, [detailMod, collectionData]);
  reactExports.useEffect(() => {
    if (skipNextFilterPageResetRef.current) {
      skipNextFilterPageResetRef.current = false;
      return;
    }
    setCurrentPage(1);
  }, [
    searchQuery,
    selectedCharacter,
    selectedGameVersion,
    selectedModMode,
    likedOnly,
    sortBy,
    selectedGameId,
    selectedTags,
    showHotSection
  ]);
  const totalPages = Math.max(1, Math.ceil(sectionedDisplayedMods.length / PAGE_SIZE));
  const pagedMods = reactExports.useMemo(
    () => infiniteScroll ? sectionedDisplayedMods.slice(0, currentPage * PAGE_SIZE) : sectionedDisplayedMods.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [currentPage, infiniteScroll, sectionedDisplayedMods]
  );
  const adaptiveColumns = reactExports.useMemo(() => {
    const count = Math.max(1, marketGridColumns || 1);
    const columns = Array.from({ length: count }, () => []);
    pagedMods.forEach((mod, index) => {
      columns[index % count].push({ mod, index });
    });
    return columns.filter((column) => column.length > 0);
  }, [pagedMods, marketGridColumns]);
  reactExports.useEffect(() => {
    if (!isActive) return;
    let mounted = true;
    const delayedRequests = [];
    const warmSessionCache = getMarketSessionCache(marketGameId);
    const hasWarmSessionCache = Boolean(
      warmSessionCache?.mods?.length && warmSessionCache.gameId === marketGameId
    );
    if (!hasWarmSessionCache) {
      setInitialCacheReady(false);
    }
    function requestCachedMods(gameId) {
      const current = marketInitCacheRequestRef.current;
      if (current.key === gameId && current.promise) {
        return current.promise;
      }
      const promise = window.api.getCachedMods(gameId).finally(() => {
        if (marketInitCacheRequestRef.current.key === gameId) {
          marketInitCacheRequestRef.current = { key: null, promise: null };
        }
      });
      marketInitCacheRequestRef.current = { key: gameId, promise };
      return promise;
    }
    function requestConfig() {
      const current = marketInitConfigRequestRef.current;
      if (current?.promise) return current.promise;
      const promise = window.api.getConfig().finally(() => {
        if (marketInitConfigRequestRef.current?.promise === promise) {
          marketInitConfigRequestRef.current = null;
        }
      });
      marketInitConfigRequestRef.current = { promise };
      return promise;
    }
    async function syncWithFallback(resolvedUrl, forceFullSync, hasCached) {
      const primaryUrl = normalizeApiBaseUrl(resolvedUrl);
      const storedSession = readAuthSession() || {};
      const authKey = storedSession.token || "anonymous";
      const syncKey = `${marketGameId}|${primaryUrl}|${"delta"}|${authKey}`;
      const currentSync = marketInitSyncRequestRef.current;
      let chainResult;
      if (currentSync.key === syncKey && currentSync.promise) {
        chainResult = await currentSync.promise;
      } else {
        const requestTicket = marketApplyRequestTrackerRef.current.begin(marketGameId);
        const promise = runSyncFallbackChain({
          userUrl: primaryUrl,
          secureOnly: Boolean(storedSession.token),
          syncOnce: (url) => mounted && marketVisibleRef.current ? window.api.syncModMarket(url, forceFullSync, marketGameId, readAuthSession(url) || {}) : Promise.resolve({ success: true, stale: true })
        }).then(
          (result) => marketApplyRequestTrackerRef.current.isCurrent(requestTicket) ? result : { ...result, stale: true }
        ).finally(() => {
          if (marketInitSyncRequestRef.current.key === syncKey) {
            marketInitSyncRequestRef.current = { key: null, promise: null };
          }
        });
        marketInitSyncRequestRef.current = { key: syncKey, promise };
        chainResult = await promise;
      }
      if (chainResult.fallbackUrl && hasCached && chainResult.success) {
        return { ...chainResult, fromCache: false };
      }
      return chainResult;
    }
    async function init() {
      try {
        let cacheResult = warmSessionCache?.mods?.length ? {
          success: true,
          mods: warmSessionCache.mods,
          marketAccess: warmSessionCache.syncStatus?.marketAccess,
          syncStatus: warmSessionCache.syncStatus,
          fromSession: true
        } : null;
        if (!cacheResult) {
          const cacheStartedAt = performance.now();
          cacheResult = await requestCachedMods(marketGameId);
          logMarketPerf(
            "getCachedMods",
            cacheStartedAt,
            `${cacheResult?.mods?.length || 0} mods / ${marketGameId}`
          );
        } else {
          logMarketPerf("getCachedMods(session)", performance.now(), `${cacheResult.mods.length} mods / ${marketGameId}`);
        }
        if (!mounted) return;
        const hasStoredCache = Boolean(
          cacheResult.success && cacheResult.mods && cacheResult.mods.length > 0
        );
        const cachedMarketAccess = cacheResult.marketAccess || cacheResult.syncStatus?.marketAccess || null;
        const hideCachedForAnonymous = shouldHideControlledMarketCache(
          cachedMarketAccess,
          Boolean(readAuthSession()?.token)
        );
        const hasCached = hasStoredCache && !hideCachedForAnonymous;
        if (hideCachedForAnonymous) {
          setMods([]);
          setMarketDataGameId(marketGameId);
          setSyncStatus(
            (prev) => createMarketSyncStatus(
              {
                success: true,
                mods: [],
                refreshBlocked: true,
                marketAccess: createLoginRequiredMarketAccess(cachedMarketAccess)
              },
              prev || cacheResult.syncStatus
            )
          );
          setInitialCacheReady(true);
        } else if (hasCached) {
          if (!cacheResult.fromSession) {
            setMods(cacheResult.mods);
            setMarketDataGameId(marketGameId);
            setSyncStatus(createMarketSyncStatus({ ...cacheResult, fromCache: true }));
          }
          setInitialCacheReady(true);
        } else {
          setInitialCacheReady(false);
        }
        const configStartedAt = performance.now();
        const configResult = await requestConfig();
        logMarketPerf("getConfig", configStartedAt);
        let resolvedUrl = serverUrl;
        if (mounted && configResult.success && configResult.config.serverUrl) {
          resolvedUrl = configResult.config.serverUrl;
          setServerUrl(resolvedUrl);
        }
        if (mounted && !activeGameId && configResult.success && configResult.config.activeGame?.id) {
          setSelectedGameId(configResult.config.activeGame.id);
        }
        if (mounted && resolvedUrl) {
          if (hasCached && !hasWarmSessionCache) {
            setSyncing(true);
          } else if (!hasCached) {
            setLoading(true);
          }
          setError(null);
          let result = null;
          try {
            const syncStartedAt = performance.now();
            result = await syncWithFallback(resolvedUrl, false, hasCached);
            logMarketPerf(
              "syncModMarket",
              syncStartedAt,
              `${result?.mods?.length || 0} mods / cached=${hasCached}`
            );
            if (!mounted) return;
            if (result.success) {
              if (!result.stale) {
                if (result.fallbackUrl) setServerUrl(result.fallbackUrl);
                const currentMods = cacheResult.mods || mods;
                const shouldReplaceMods = shouldReplaceMarketSnapshot(result, currentMods);
                if (shouldReplaceMods) {
                  const nextMods = result.mods || [];
                  const nextSignature = getMarketSnapshotSignature(nextMods);
                  const currentSignature = getMarketSnapshotSignature(currentMods);
                  if (nextSignature !== currentSignature || marketDataGameId !== marketGameId) {
                    setMods(nextMods);
                    setMarketDataGameId(marketGameId);
                  }
                }
                setSyncStatus((prev) => createMarketSyncStatus(result, prev));
              }
              setInitialCacheReady(true);
            } else {
              setInitialCacheReady(true);
              setError(result.error || "同步失败");
            }
          } catch (e) {
            if (mounted) {
              setInitialCacheReady(true);
              setError("连接服务器失败: " + e.message);
            }
          } finally {
            if (mounted) {
              setLoading(false);
              setSyncing(false);
            }
          }
          if (!mounted) return;
          delayedRequests.push(setTimeout(() => {
            loadPopularityData();
          }, 500));
          delayedRequests.push(setTimeout(() => {
            loadLikedMods();
          }, 800));
        }
      } catch (e) {
        console.error("Failed to init mod market:", e);
        if (mounted) {
          setInitialCacheReady(true);
          setLoading(false);
          setSyncing(false);
        }
      }
    }
    init();
    return () => {
      mounted = false;
      delayedRequests.forEach(clearTimeout);
      marketInitSyncRequestRef.current = { key: null, promise: null };
      window.api.invalidateMarketRequests?.(marketGameId).catch(() => {});
    };
  }, [marketGameId, isActive]);
  async function syncModsFromUrl(baseUrl, forceFullSync = false) {
    const normalizedUrl = normalizeApiBaseUrl(baseUrl);
    const storedSession = readAuthSession() || {};
    const requestTicket = marketApplyRequestTrackerRef.current.begin(marketGameId);
    const result = await runSyncFallbackChain({
      userUrl: normalizedUrl,
      secureOnly: Boolean(storedSession.token),
      syncOnce: (url) => marketVisibleRef.current ? window.api.syncModMarket(url, forceFullSync, marketGameId, readAuthSession(url) || {}) : Promise.resolve({ success: true, stale: true })
    });
    return marketApplyRequestTrackerRef.current.isCurrent(requestTicket) ? result : { ...result, stale: true };
  }
  async function silentlyRefreshMarket({ reason = "active", forceFullSync = false } = {}) {
    if (!marketVisibleRef.current || !serverUrl || !marketGameId) return null;
    const authKey = readAuthSession()?.token || "anonymous";
    const refreshKey = `${marketGameId}|${normalizeApiBaseUrl(serverUrl)}|${forceFullSync ? "full" : "delta"}|${authKey}`;
    if (marketSilentRefreshRef.current.key === refreshKey && marketSilentRefreshRef.current.promise) {
      return marketSilentRefreshRef.current.promise;
    }
    const promise = (async () => {
      try {
        const startedAt = performance.now();
        const result = await syncModsFromUrl(serverUrl, forceFullSync);
        logMarketPerf(`silentSyncModMarket:${reason}`, startedAt, `${result?.mods?.length || 0} mods`);
        if (!result?.success) {
          setSyncStatus((prev) => ({
            ...prev || {},
            syncError: result?.error || "同步失败",
            primarySyncError: result?.primarySyncError || null,
            fallbackUrl: result?.fallbackUrl || null
          }));
          return result;
        }
        if (result.stale) return result;
        if (result.fallbackUrl) setServerUrl(result.fallbackUrl);
        const nextMods = Array.isArray(result.mods) ? result.mods : [];
        const shouldReplaceMods = shouldReplaceMarketSnapshot(result, mods);
        if (shouldReplaceMods) {
          setMods(nextMods);
          setMarketDataGameId(marketGameId);
          setInitialCacheReady(true);
        }
        setSyncStatus((prev) => createMarketSyncStatus(result, prev));
        return result;
      } catch (e) {
        setSyncStatus((prev) => ({
          ...prev || {},
          syncError: e?.message || "后台同步失败"
        }));
        return { success: false, error: e?.message || "后台同步失败" };
      } finally {
        if (marketSilentRefreshRef.current.key === refreshKey) {
          marketSilentRefreshRef.current = { key: null, promise: null };
        }
      }
    })();
    marketSilentRefreshRef.current = { key: refreshKey, promise };
    return promise;
  }
  reactExports.useEffect(() => {
    const unsubscribe = subscribeAuthSession((session) => {
      const nextIdentity = getAuthSessionIdentity(session);
      if (marketAuthIdentityRef.current === nextIdentity) return;
      marketAuthIdentityRef.current = nextIdentity;
      marketApplyRequestTrackerRef.current.invalidate(marketGameId);
      const invalidation = window.api.invalidateMarketRequests?.(marketGameId);
      invalidation?.catch?.(() => {
      });
      marketInitSyncRequestRef.current = { key: null, promise: null };
      marketSilentRefreshRef.current = { key: null, promise: null };
      const hasAuthToken = Boolean(session?.token);
      const currentMarketAccess = marketSyncStatusRef.current?.marketAccess;
      if (shouldHideControlledMarketCache(currentMarketAccess, hasAuthToken)) {
        setMods([]);
        setMarketDataGameId(marketGameId);
        setInitialCacheReady(true);
        setDetailMod(null);
        setSyncStatus(
          (prev) => createMarketSyncStatus(
            {
              refreshBlocked: true,
              marketAccess: createLoginRequiredMarketAccess(
                prev?.marketAccess || currentMarketAccess
              )
            },
            prev
          )
        );
      }
      if (!serverUrl) return;
      silentlyRefreshMarket({ reason: "auth-change", forceFullSync: true }).catch(() => {
      });
    });
    return unsubscribe;
  }, [marketGameId, serverUrl]);
  reactExports.useEffect(() => {
    const handlePollResult = (event) => {
      const result = event?.detail;
      if (!result?.success || result.stale || result.gameId !== marketGameId) return;
      const currentMods = marketModsRef.current;
      if (shouldReplaceMarketSnapshot(result, currentMods)) {
        const nextMods = Array.isArray(result.mods) ? result.mods : [];
        setMods(nextMods);
        setMarketDataGameId(marketGameId);
        setInitialCacheReady(true);
      }
      setSyncStatus((prev) => createMarketSyncStatus(result, prev));
    };
    window.addEventListener("qaqm:market-poll-result", handlePollResult);
    return () => window.removeEventListener("qaqm:market-poll-result", handlePollResult);
  }, [marketGameId]);
  reactExports.useEffect(() => {
    if (!isActive || !serverUrl) return;
    let cancelled = false;
    const controller = new AbortController();
    async function fetchGameVersions() {
      try {
        const res = await fetch(`${serverUrl}/api/mods/game-versions`, { cache: "no-store", signal: controller.signal });
        const data = await res.json();
        if (!cancelled && data.success) {
          setServerGameVersions(data.versions || []);
        }
      } catch {
      }
    }
    fetchGameVersions();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [serverUrl, isActive]);
  reactExports.useEffect(() => {
    if (!isActive) return void 0;
    const el = document.querySelector(".main-content");
    if (!el) return;
    contentRef.current = el;
    let rafId = null;
    let loadingMore = false;
    const saveScroll = (allowClear = false) => {
      const scrollTop = Math.round(el.scrollTop || 0);
      if (scrollTop < MARKET_SCROLL_RESTORE_MIN_TOP) {
        if (allowClear) {
          const saved = readMarketScrollState(marketScrollStorageKey);
          const savedFilterKey = getMarketScrollFilterKey(saved?.filters);
          const currentFilterKey = getMarketScrollFilterKey(marketScrollFiltersRef.current);
          if (!savedFilterKey || savedFilterKey === currentFilterKey) {
            removeMarketScrollState(marketScrollStorageKey);
            if (showBackToMarketPosition) {
              setSavedMarketScroll(null);
              setShowBackToMarketPosition(false);
            }
          }
        }
        return;
      }
      const payload = {
        scrollTop,
        page: Math.max(1, Number(currentPageRef.current || 1)),
        infiniteScroll: Boolean(infiniteScrollRef.current),
        filters: marketScrollFiltersRef.current,
        savedAt: Date.now()
      };
      writeMarketScrollState(marketScrollStorageKey, payload);
    };
    const handler = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        setShowBackToTop(el.scrollTop > 300);
        saveScroll(true);
        if (infiniteScroll && !loadingMore && el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
          setCurrentPage((p) => {
            if (p * PAGE_SIZE < sectionedDisplayedMods.length) {
              loadingMore = true;
              setTimeout(() => {
                loadingMore = false;
              }, 300);
              return p + 1;
            }
            return p;
          });
        }
      });
    };
    el.addEventListener("scroll", handler, { passive: true });
    return () => {
      saveScroll(false);
      el.removeEventListener("scroll", handler);
      if (rafId) cancelAnimationFrame(rafId);
      if (contentRef.current === el) contentRef.current = null;
    };
  }, [infiniteScroll, marketScrollStorageKey, sectionedDisplayedMods.length, showBackToMarketPosition, isActive]);
  async function syncMods(forceFullSync = false) {
    if (!marketVisibleRef.current) return;
    if (!serverUrl) {
      setError("请先在设置中配置服务器地址");
      return;
    }
    if (mods.length === 0) {
      setLoading(true);
    } else {
      setSyncing(true);
    }
    setError(null);
    try {
      const result = await syncModsFromUrl(serverUrl, forceFullSync);
      if (result.success) {
        if (result.stale) return;
        if (result.fallbackUrl) setServerUrl(result.fallbackUrl);
        const syncedMods = result.mods || [];
        if (shouldReplaceMarketSnapshot(result, mods)) {
          setMods(syncedMods);
          setMarketDataGameId(marketGameId);
        }
        setInitialCacheReady(true);
        setSyncStatus((prev) => createMarketSyncStatus(result, prev));
        loadLikedMods();
      } else {
        setError(result.error || "同步失败");
      }
    } catch (e) {
      setError("连接服务器失败: " + e.message);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }
  function getSavedAuthSession() {
    return readAuthSession(serverUrl);
  }
  async function handleDirectDownload(mod, scene) {
    if (!mod?.id) {
      setToast({ type: "error", message: "无法识别这个 Mod，暂时不能下载" });
      return;
    }
    const downloadKey = `${getModGameId(mod)}:${String(mod.id)}`;
    if (marketDownloadInFlightRef.current.has(downloadKey)) {
      setToast({ type: "error", message: "该 Mod 已在下载队列中，请勿重复添加" });
      return;
    }
    const session = getSavedAuthSession();
    if (!session?.token) {
      setDownloadPrompt({ type: "login_required" });
      return;
    }
    if (!mod?.hasDirectInstall) {
      setToast({ type: "error", message: "这个 Mod 暂无直接下载链接，请使用网盘链接" });
      return;
    }
    const previousDownload = getMarketDownloadedRecord(mod);
    if (previousDownload) {
      const downloadedAt = Number(previousDownload.downloadedAt);
      const dateLabel = Number.isFinite(downloadedAt) && downloadedAt > 0 ? `（上次下载：${new Date(downloadedAt).toLocaleString()}）` : "";
      if (!window.confirm(`「${mod.name || "这个 Mod"}」之前已经下载过${dateLabel}，是否仍要重新下载？`)) {
        return;
      }
    }
    marketDownloadInFlightRef.current.add(downloadKey);
    try {
      await executeDirectDownload(mod, scene, session);
    } catch (error2) {
      setToast({ type: "error", message: error2?.message || "下载失败" });
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
            scene
          }
        }
      })
    );
    const result = await window.api.marketDownloadInstallMod({
      taskId,
      serverUrl,
      authToken: session.token,
      authServerUrl: session.serverUrl,
      clientId,
      mod,
      scene
    });
    if (!result?.success) {
      if (result?.canceled || result?.code === "DOWNLOAD_CANCELED") return;
      if (result?.code === "LOGIN_REQUIRED" || result?.code === "SESSION_EXPIRED" || result?.code === "MARKET_ACCESS_DENIED") {
        const marketAccess = {
          controlled: true,
          allowed: false,
          code: result.code,
          clearExisting: false
        };
        setSyncStatus(
          (prev) => createMarketSyncStatus(
            { refreshBlocked: true, marketAccess, fromCache: true },
            prev
          )
        );
        silentlyRefreshMarket({ reason: "download-denied", forceFullSync: true }).catch(() => {
        });
      }
      if (result?.code === "LOGIN_REQUIRED" || result?.code === "SESSION_EXPIRED") {
        setDownloadPrompt({
          type: "login_required",
          sessionExpired: result?.code === "SESSION_EXPIRED"
        });
      } else if (result?.code === "MARKET_ACCESS_DENIED") {
        setToast({ type: "error", message: "当前账号没有刷新该游戏 Mod 市场的权限" });
      } else if (result?.code === "DIRECT_DOWNLOAD_REQUIRED" || result?.code === "SPONSOR_REQUIRED") {
        setDownloadPrompt({ type: "unavailable" });
      } else {
        setToast({ type: "error", message: result?.error || "下载失败" });
      }
      return;
    }
    setToast({
      type: "success",
      message: result.renamedDueToDuplicate ? `该路径已有同名 Mod，已安装为「${result.modName || mod.name}」` : "Mod 已下载并安装"
    });
    recordMarketModDownload(mod);
    syncMods(false).catch(() => {
    });
  }
  function shouldShowDirectDownload(mod) {
    return hasMarketDirectSource(mod) && Boolean(getSavedAuthSession()?.token);
  }
  function handleDownload(mod, downloadUrl, source, scene) {
    const downloadKey = `${getModGameId(mod)}:${String(mod?.id || "")}`;
    if (mod?.id && marketDownloadInFlightRef.current.has(downloadKey)) {
      setToast({ type: "error", message: "该 Mod 已在下载队列中，请勿重复添加" });
      return;
    }
    const previousDownload = getMarketDownloadedRecord(mod);
    if (previousDownload && !window.confirm(`「${mod.name || "这个 Mod"}」之前已经下载过，是否仍要打开下载链接？`)) {
      return;
    }
    const modId = mod?.id;
    window.api.openExternalUrl(downloadUrl);
    navigator.clipboard.writeText(downloadUrl).catch(() => {
    });
    if (serverUrl && modId) {
      const session = getSavedAuthSession();
      fetch(`${serverUrl}/api/mods/${modId}/download-click`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...session?.token ? { Authorization: `Bearer ${session.token}` } : {}
        },
        body: JSON.stringify({
          channel: "client",
          source,
          entry: "desktop_market",
          scene,
          clientId: clientId || null,
          gameId: getModGameId(mod),
          modMode: mod?.modMode || "d3d"
        })
      }).catch(() => {
      });
    }
  }
  async function loadPopularityData() {
    if (!marketVisibleRef.current || !serverUrl) return;
    try {
      const [today, week, month] = await Promise.all([
        fetch(`${serverUrl}/api/mods/popular/today`).then((r) => r.json()),
        fetch(`${serverUrl}/api/mods/popular/week`).then((r) => r.json()),
        fetch(`${serverUrl}/api/mods/popular/month`).then((r) => r.json())
      ]);
      setPopularityData({
        hot_today: today.popular || [],
        hot_week: week.popular || [],
        hot_month: month.popular || []
      });
    } catch (e) {
      console.error("Load popularity data failed:", e);
    }
  }
  async function loadLikedMods() {
    if (!marketVisibleRef.current || !serverUrl || !clientId) return;
    try {
      const res = await fetch(`${serverUrl}/api/mods/liked/${clientId}`);
      const data = await res.json();
      if (data.success) {
        setLikedMods(new Set((data.likedModIds || []).map((modId) => String(modId))));
      }
    } catch (e) {
      console.error("Load liked mods failed:", e);
    }
  }
  reactExports.useEffect(() => {
    loadLikedMods();
  }, [serverUrl, clientId, isActive]);
  reactExports.useEffect(() => {
    if (!isActive || !serverUrl || pagedMods.length === 0) return;
    const timer = setTimeout(() => {
      loadCommentCounts(pagedMods);
    }, 500);
    return () => clearTimeout(timer);
  }, [serverUrl, pagedMods, isActive]);
  reactExports.useEffect(() => {
    if (!isActive || !serverUrl || !detailMod?.id) return;
    if (loadedCommentCountIdsRef.current.has(String(detailMod.id))) return;
    loadCommentCounts([detailMod]);
  }, [serverUrl, detailMod, isActive]);
  async function loadCommentCounts(modsList) {
    if (!marketVisibleRef.current || !serverUrl) return;
    const ids = (modsList || []).map((m) => m?.id).filter(Boolean).map((id) => String(id)).filter((id) => !loadedCommentCountIdsRef.current.has(id));
    if (!ids.length) return;
    try {
      const res = await fetch(`${serverUrl}/api/mod-comments/counts?modIds=${ids.join(",")}`);
      const data = await res.json();
      if (data.success && data.counts) {
        ids.forEach((id) => loadedCommentCountIdsRef.current.add(id));
        setCommentCounts((prev) => ({ ...prev, ...data.counts }));
      }
    } catch (e) {
      console.error("Load comment counts failed:", e);
    }
  }
  async function handleToggleLike(modId) {
    if (!serverUrl) return;
    try {
      const res = await fetch(`${serverUrl}/api/mods/${modId}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId })
      });
      const data = await res.json();
      if (data.success) {
        const likedModId = String(modId);
        setLikedMods((prev) => {
          const next = new Set(prev);
          if (data.liked) {
            next.add(likedModId);
          } else {
            next.delete(likedModId);
          }
          return next;
        });
      }
    } catch (e) {
      console.error("Like toggle failed:", e);
    }
  }
  function scrollToTop() {
    const el = document.querySelector(".main-content");
    if (el) el.scrollTo({ top: 0, behavior: "smooth" });
  }
  function runPendingMarketRestore(smooth = false) {
    const pending = pendingMarketRestoreRef.current;
    if (!pending) return;
    const el = contentRef.current || document.querySelector(".main-content");
    if (!el) return;
    const maxTop = Math.max(0, el.scrollHeight - el.clientHeight);
    if (maxTop < pending.scrollTop - 24 && pending.attempts < 18) {
      pending.attempts += 1;
      marketRestoreTimerRef.current = setTimeout(() => runPendingMarketRestore(smooth), 80);
      return;
    }
    el.scrollTo({
      top: Math.min(pending.scrollTop, maxTop),
      behavior: smooth ? "smooth" : "auto"
    });
    pendingMarketRestoreRef.current = null;
    marketRestoreTimerRef.current = null;
  }
  function restoreMarketScrollPosition() {
    const saved = readMarketScrollState(marketScrollStorageKey) || savedMarketScroll;
    if (!saved) return;
    const targetPage = Math.max(1, Number(saved.page || 1));
    const savedFilters = normalizeMarketScrollFilters(saved.filters);
    const savedFilterKey = getMarketScrollFilterKey(savedFilters);
    const shouldRestoreFilters = savedFilterKey && savedFilterKey !== currentMarketScrollFilterKey;
    pendingMarketRestoreRef.current = {
      scrollTop: Math.max(0, Number(saved.scrollTop || 0)),
      attempts: 0
    };
    if (shouldRestoreFilters) {
      skipNextFilterPageResetRef.current = true;
      setSelectedGameId(savedFilters.selectedGameId);
      setSearchQuery(savedFilters.searchQuery);
      setSelectedCharacter(savedFilters.selectedCharacter);
      setSelectedGameVersion(savedFilters.selectedGameVersion);
      setSelectedModMode(savedFilters.selectedModMode);
      setLikedOnly(savedFilters.likedOnly === true);
      setShowHotSection(savedFilters.showHotSection !== false);
      setSortBy(savedFilters.sortBy);
      setSelectedTags(filterVisibleMarketTags(savedFilters.selectedTags));
    }
    if (targetPage !== currentPageRef.current || shouldRestoreFilters) {
      setCurrentPage(targetPage);
    }
    setShowBackToMarketPosition(false);
    if (marketRestoreTimerRef.current) clearTimeout(marketRestoreTimerRef.current);
    marketRestoreTimerRef.current = setTimeout(
      () => runPendingMarketRestore(true),
      shouldRestoreFilters ? 160 : 60
    );
  }
  reactExports.useEffect(() => {
    return () => {
      if (marketRestoreTimerRef.current) clearTimeout(marketRestoreTimerRef.current);
    };
  }, []);
  function openModDetail(mod) {
    setClosingDetail(false);
    setDetailMod(mod);
    setDetailGalleryIdx(0);
  }
  function selectCollectionVariant(identity, variant, openDetail = false) {
    if (!identity || !variant) return;
    setSelectedCollectionVariants((prev) => ({
      ...prev,
      [identity]: variant.id
    }));
    setCardImageIdx((prev) => ({
      ...prev,
      [`collection:${identity}`]: 0
    }));
    if (openDetail) openModDetail(variant);
  }
  function closeDetailModal() {
    setClosingDetail(true);
    setTimeout(() => {
      setDetailMod(null);
      setClosingDetail(false);
    }, 250);
  }
  reactExports.useEffect(() => {
    if (!detailMod || !relatedScrollRef.current) return;
    const active = relatedScrollRef.current.querySelector(".xhs-related-item.active");
    if (active) {
      active.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [detailMod]);
  reactExports.useEffect(() => {
    if (!pendingDetailMod) return;
    const match = mods.find((m) => m.id === pendingDetailMod.id) || pendingDetailMod;
    openModDetail(match);
    onPendingDetailConsumed?.();
  }, [pendingDetailMod]);
  function openFeedbackModal(mod) {
    setFeedbackTargetMod(mod);
  }
  function addTagFilter(tag) {
    if (isHiddenMarketTag(tag)) return;
    setSelectedTags((prev) => {
      if (prev.some((t) => t.id === tag.id)) return prev;
      return [...prev, tag];
    });
  }
  function removeTagFilter(tagId) {
    setSelectedTags((prev) => prev.filter((t) => t.id !== tagId));
  }
  function applyQuickFilter({
    gameId,
    character,
    gameVersion,
    closeDetail = false
  }) {
    if (gameId) {
      setSelectedGameId(gameId);
    }
    if (character !== void 0) {
      setSelectedCharacter(
        character === "all" ? "all" : getMarketCanonicalCharacterName(character, marketCharacterAliasIndex)
      );
    }
    if (gameVersion !== void 0) {
      setSelectedGameVersion(gameVersion);
    }
    setSearchQuery("");
    setSelectedTags([]);
    if (closeDetail) {
      closeDetailModal();
    }
    requestAnimationFrame(() => scrollToTop());
  }
  function renderFilterTag({ label, className = "", onClick, title = "点击按此分类筛选" }) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx(
      "button",
      {
        type: "button",
        className: `tag tag-clickable ${className}`.trim(),
        onClick: (e) => {
          e.stopPropagation();
          onClick?.();
        },
        title,
        children: label
      }
    );
  }
  function renderMarketCard(mod, visualIndex = 0) {
    const cardKey = mod._displayKey || mod.id;
    const displayCharacterName = getMarketCanonicalCharacterName(
      mod.characterName || mod._originalCharacterName || "通用",
      marketCharacterAliasIndex
    );
    const collectionVariants = Array.isArray(mod._collectionVariants) ? mod._collectionVariants : [];
    const isVariantMenuOpen = openCollectionVariantMenu === mod._collectionIdentity;
    const selectedVariantIndex = collectionVariants.findIndex(
      (variant) => String(variant.id) === String(mod.id)
    );
    const selectedVariantVersion = getVariantVersionLabel(
      mod,
      selectedVariantIndex >= 0 ? selectedVariantIndex : 0
    );
    const isPinnedCard = mod._marketSection === "pinned";
    const isHotCard = mod._marketSection === "hot";
    const isUpdatedCard = isMarketRecentlyPublished(mod);
    const isFirstRowCard = visualIndex < Math.max(1, marketGridColumns || 1);
    const useFixedImage = equalRowHeight || isPinnedCard || isFirstRowCard;
    return /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "div",
      {
        className: [
          "mod-card",
          equalRowHeight ? "mod-card-equal-row" : "mod-card-adaptive-row",
          isFirstRowCard ? "mod-card-first-row" : "",
          isPinnedCard ? "mod-card-fixed-image" : "",
          isVariantMenuOpen ? "variant-menu-open" : ""
        ].filter(Boolean).join(" "),
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs(
            "div",
            {
              className: `mod-card-image ${useFixedImage ? "mod-card-image-fixed" : "mod-card-image-adaptive"}`,
              onClick: () => openModDetail(mod),
              children: [
                (() => {
                  const images = buildImageList(mod);
                  const idx = Math.min(cardImageIdx[cardKey] || 0, images.length - 1);
                  return images.length > 0 ? /* @__PURE__ */ jsxRuntimeExports.jsx(
                    MarketImage,
                    {
                      src: images[idx].url,
                      alt: mod.name,
                      className: "market-image-card"
                    },
                    `${cardKey}-${mod.id}-${idx}`
                  ) : /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mod-card-placeholder", children: "🖼️" });
                })(),
                buildImageList(mod).length > 1 && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mod-card-img-count", children: [
                    "🖼 ",
                    buildImageList(mod).length
                  ] }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    "button",
                    {
                      className: "mod-card-nav-btn mod-card-nav-prev",
                      onClick: (e) => {
                        e.stopPropagation();
                        const len = buildImageList(mod).length;
                        setCardImageIdx((prev) => ({
                          ...prev,
                          [cardKey]: ((prev[cardKey] || 0) - 1 + len) % len
                        }));
                      },
                      children: "‹"
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    "button",
                    {
                      className: "mod-card-nav-btn mod-card-nav-next",
                      onClick: (e) => {
                        e.stopPropagation();
                        const len = buildImageList(mod).length;
                        setCardImageIdx((prev) => ({
                          ...prev,
                          [cardKey]: ((prev[cardKey] || 0) + 1) % len
                        }));
                      },
                      children: "›"
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mod-card-dots", children: buildImageList(mod).map((_, i) => /* @__PURE__ */ jsxRuntimeExports.jsx(
                    "button",
                    {
                      className: `mod-card-dot ${i === (cardImageIdx[cardKey] || 0) ? "active" : ""}`,
                      onClick: (e) => {
                        e.stopPropagation();
                        setCardImageIdx((prev) => ({ ...prev, [cardKey]: i }));
                      }
                    },
                    i
                  )) })
                ] }),
                mod._isCollectionCard && collectionVariants.length > 1 && /* @__PURE__ */ jsxRuntimeExports.jsxs(
                  "div",
                  {
                    className: "mod-card-variant-row mod-card-variant-floating",
                    onClick: (e) => e.stopPropagation(),
                    onMouseDown: (e) => e.stopPropagation(),
                    children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        "button",
                        {
                          type: "button",
                          className: "mod-card-variant-trigger",
                          "aria-haspopup": "listbox",
                          "aria-expanded": isVariantMenuOpen,
                          onClick: (e) => {
                            e.stopPropagation();
                            setOpenCollectionVariantMenu(
                              (current) => current === mod._collectionIdentity ? null : mod._collectionIdentity
                            );
                          },
                          onKeyDown: (e) => {
                            if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setOpenCollectionVariantMenu(mod._collectionIdentity);
                            }
                          },
                          children: /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "mod-card-variant-trigger-main", children: selectedVariantVersion })
                        }
                      ),
                      isVariantMenuOpen && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mod-card-variant-menu", role: "listbox", children: collectionVariants.map((variant, index) => {
                        const isSelected = String(variant.id) === String(mod.id);
                        return /* @__PURE__ */ jsxRuntimeExports.jsxs(
                          "button",
                          {
                            type: "button",
                            className: `mod-card-variant-option ${isSelected ? "active" : ""}`,
                            role: "option",
                            "aria-selected": isSelected,
                            onClick: (e) => {
                              e.stopPropagation();
                              selectCollectionVariant(mod._collectionIdentity, variant);
                              setOpenCollectionVariantMenu(null);
                            },
                            children: [
                              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: getVariantLabel(variant, index) }),
                              /* @__PURE__ */ jsxRuntimeExports.jsx("em", { children: getVariantSourceLabel(variant) })
                            ]
                          },
                          variant.id
                        );
                      }) })
                    ]
                  }
                ),
                mod._isCollectionCard && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mod-card-collection-badge", children: [
                  "合集 ",
                  collectionVariants.length
                ] }),
                (isPinnedCard || isHotCard || isUpdatedCard) && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mod-card-section-badges", children: [
                  isPinnedCard && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mod-card-section-badge mod-card-section-pinned", children: "置顶" }),
                  isHotCard && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mod-card-section-badge mod-card-section-hot", children: "热门" }),
                  isUpdatedCard && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mod-card-section-badge mod-card-section-update", children: "更新" })
                ] })
              ]
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mod-card-body", onClick: () => openModDetail(mod), children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { className: "mod-card-title", children: getCollectionCardTitle(mod) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mod-card-tags", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mod-card-tags-row", children: [
              renderFilterTag({
                label: `👤 ${displayCharacterName || "通用"}`,
                className: "tag-character",
                onClick: () => applyQuickFilter({
                  gameId: getModGameId(mod),
                  character: displayCharacterName || "all"
                }),
                title: displayCharacterName ? `点击筛选角色「${displayCharacterName}」` : "点击查看通用 Mod"
              }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                "span",
                {
                  className: "tag",
                  title: (mod.modMode || "d3d") === "pak" ? "Pak Mod" : "3dm Mod",
                  children: getModModeLabel(mod.modMode || "d3d")
                }
              ),
              renderFilterTag({
                label: getMarketVersionLabel(mod),
                className: "tag-version",
                onClick: () => mod.game_version ? applyQuickFilter({
                  gameId: getModGameId(mod),
                  character: selectedCharacter,
                  gameVersion: mod.game_version
                }) : void 0,
                title: mod.game_version ? `点击筛选游戏版本「${mod.game_version}」` : "Mod 版本"
              })
            ] }) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mod-card-bottom", onClick: (e) => e.stopPropagation(), children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mod-card-downloads", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                "button",
                {
                  type: "button",
                  className: `mod-dl-btn mod-dl-favorite ${likedMods.has(String(mod.id)) ? "active" : ""}`,
                  title: likedMods.has(String(mod.id)) ? "取消收藏" : "收藏",
                  "aria-label": likedMods.has(String(mod.id)) ? "取消收藏" : "收藏",
                  "aria-pressed": likedMods.has(String(mod.id)),
                  onClick: () => handleToggleLike(mod.id),
                  children: /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "mod-favorite-heart", "aria-hidden": "true", children: likedMods.has(String(mod.id)) ? "♥" : "♡" })
                }
              ),
              shouldShowDirectDownload(mod) && /* @__PURE__ */ jsxRuntimeExports.jsx(
                "button",
                {
                  className: "mod-dl-btn mod-dl-direct",
                  onClick: () => handleDirectDownload(mod, "market_card"),
                  children: "下载"
                }
              ),
              mod.downloadUrl && /* @__PURE__ */ jsxRuntimeExports.jsx(
                "button",
                {
                  className: "mod-dl-btn mod-dl-baidu",
                  onClick: () => handleDownload(mod, mod.downloadUrl, "baidu", "market_card"),
                  children: "百度"
                }
              ),
              mod.quarkDownloadUrl && /* @__PURE__ */ jsxRuntimeExports.jsx(
                "button",
                {
                  className: "mod-dl-btn mod-dl-quark",
                  onClick: () => handleDownload(mod, mod.quarkDownloadUrl, "quark", "market_card"),
                  children: "夸克"
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                "button",
                {
                  type: "button",
                  className: "mod-dl-btn mod-dl-feedback",
                  title: "反馈网盘或下载失效",
                  onClick: () => openFeedbackModal(mod),
                  children: "失效"
                }
              )
            ] }) })
          ] })
        ]
      },
      cardKey
    );
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mod-market-container", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mod-market-header", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "header-left", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "mod-market-title", children: "QAQM" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            type: "button",
            className: "btn-market-web",
            onClick: () => window.api.openExternalUrl("https://www.qaqm.top/market"),
            title: "打开官网网页版 Mod 市场",
            children: "网页版"
          }
        ),
        syncing && /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "sync-indicator", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "sync-spinner" }),
          "同步中..."
        ] }),
        !syncing && syncStatus && syncStatus.fromCache && syncStatus.syncError && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "sync-indicator", style: { color: "#e67e22" }, children: "⚠️ 离线模式" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "header-right", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "btn-refresh-wrap", ref: layoutMenuRef, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs(
            "button",
            {
              className: "btn-refresh",
              onClick: () => setShowLayoutMenu((v) => !v),
              "aria-haspopup": "menu",
              "aria-expanded": showLayoutMenu,
              children: [
                "布局",
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "btn-refresh-caret", children: "▾" })
              ]
            }
          ),
          showLayoutMenu && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "refresh-menu layout-menu", role: "menu", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs(
              "button",
              {
                className: `refresh-menu-item layout-menu-toggle ${infiniteScroll ? "active" : ""}`,
                role: "menuitemcheckbox",
                "aria-checked": infiniteScroll,
                onClick: () => {
                  const val = !infiniteScroll;
                  setInfiniteScroll(val);
                  localStorage.setItem("modmarket-infinite-scroll", String(val));
                  setCurrentPage(1);
                },
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "refresh-menu-item-title", children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "layout-toggle-mark", children: infiniteScroll ? "✓" : "" }),
                    "瀑布流"
                  ] }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "refresh-menu-item-desc", children: "滚动到底自动加载更多" })
                ]
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsxs(
              "button",
              {
                className: `refresh-menu-item layout-menu-toggle ${equalRowHeight ? "active" : ""}`,
                role: "menuitemcheckbox",
                "aria-checked": equalRowHeight,
                onClick: () => {
                  const val = !equalRowHeight;
                  setEqualRowHeight(val);
                  localStorage.setItem("modmarket-equal-row-height", String(val));
                },
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "refresh-menu-item-title", children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "layout-toggle-mark", children: equalRowHeight ? "✓" : "" }),
                    "齐行高度"
                  ] }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "refresh-menu-item-desc", children: "同一排卡片统一图片高度" })
                ]
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsxs(
              "button",
              {
                className: `refresh-menu-item layout-menu-toggle ${showHotSection ? "active" : ""}`,
                role: "menuitemcheckbox",
                "aria-checked": showHotSection,
                onClick: () => {
                  const val = !showHotSection;
                  setShowHotSection(val);
                  localStorage.setItem("modmarket-show-hot-section", String(val));
                  setCurrentPage(1);
                },
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "refresh-menu-item-title", children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "layout-toggle-mark", children: showHotSection ? "✓" : "" }),
                    "热门区"
                  ] }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "refresh-menu-item-desc", children: "在首页前两排补充热门推荐" })
                ]
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "btn-refresh-wrap", ref: refreshMenuRef, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs(
            "button",
            {
              className: "btn-refresh",
              onClick: () => setShowRefreshMenu((v) => !v),
              disabled: loading || syncing || !serverUrl,
              "aria-haspopup": "menu",
              "aria-expanded": showRefreshMenu,
              children: [
                loading ? "加载中..." : "🔄 刷新",
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "btn-refresh-caret", children: "▾" })
              ]
            }
          ),
          showRefreshMenu && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "refresh-menu", role: "menu", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs(
              "button",
              {
                className: "refresh-menu-item",
                role: "menuitem",
                onClick: () => {
                  setShowRefreshMenu(false);
                  syncMods(false);
                },
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "refresh-menu-item-title", children: "⚡ 增量刷新" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "refresh-menu-item-desc", children: "只拉取最新变化（推荐，秒开）" })
                ]
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsxs(
              "button",
              {
                className: "refresh-menu-item",
                role: "menuitem",
                onClick: () => {
                  setShowRefreshMenu(false);
                  syncMods(true);
                },
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "refresh-menu-item-title", children: "🔁 全量刷新" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "refresh-menu-item-desc", children: "重建本地缓存（数据异常时使用）" })
                ]
              }
            )
          ] })
        ] })
      ] })
    ] }),
    serverUrl && mods.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mod-market-toolbar", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "div",
        {
          className: "mod-market-search",
          style: visibleSelectedTags.length > 0 ? { minWidth: "200px", maxWidth: "360px" } : void 0,
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "search-icon", children: "🔍" }),
            visibleSelectedTags.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "search-tag-bubbles", children: visibleSelectedTags.map((tag) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
              "span",
              {
                className: "search-tag-bubble",
                style: {
                  background: `${tag.color || "#666"}18`,
                  color: tag.color || "#666",
                  borderColor: `${tag.color || "#666"}40`
                },
                children: [
                  tag.name,
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    "button",
                    {
                      className: "search-tag-bubble-x",
                      onClick: (e) => {
                        e.stopPropagation();
                        removeTagFilter(tag.id);
                      },
                      style: { color: tag.color || "#666" },
                      children: "✕"
                    }
                  )
                ]
              },
              tag.id
            )) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "input",
              {
                type: "text",
                placeholder: visibleSelectedTags.length > 0 ? "继续搜索..." : "搜索 Mod...",
                value: searchQuery,
                onChange: (e) => setSearchQuery(e.target.value),
                style: visibleSelectedTags.length > 0 ? { paddingLeft: "8px" } : void 0
              }
            ),
            (searchQuery || visibleSelectedTags.length > 0) && /* @__PURE__ */ jsxRuntimeExports.jsx(
              "button",
              {
                className: "search-clear",
                onClick: () => {
                  setSearchQuery("");
                  setSelectedTags([]);
                },
                children: "✕"
              }
            )
          ]
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "select",
        {
          value: selectedGameId,
          onChange: (e) => {
            setSelectedGameId(e.target.value);
            setSelectedCharacter("all");
            setSelectedGameVersion("all");
            setSelectedModMode("all");
          },
          className: "mod-market-select",
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "all", children: "🌐 全部游戏" }),
            gameOptions.map((game) => /* @__PURE__ */ jsxRuntimeExports.jsxs("option", { value: game.id, children: [
              "🎮 ",
              game.name
            ] }, game.id))
          ]
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "market-character-picker-wrap", ref: characterPickerRef, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "button",
          {
            type: "button",
            className: `market-character-trigger ${showCharacterPicker ? "active" : ""}`,
            onClick: () => setShowCharacterPicker((value) => !value),
            "aria-haspopup": "dialog",
            "aria-expanded": showCharacterPicker,
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "market-character-trigger-icon", children: "🎭" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "market-character-trigger-text", children: selectedCharacterLabel }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "market-character-trigger-caret", children: "▾" })
            ]
          }
        ),
        showCharacterPicker && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "market-character-panel", role: "dialog", "aria-label": "选择角色分类", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "market-character-panel-head", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: "角色分类" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "选择角色、功能或通用分类" })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "button",
              {
                type: "button",
                className: "market-character-all",
                onClick: () => {
                  setSelectedCharacter("all");
                  setShowCharacterPicker(false);
                  setCurrentPage(1);
                },
                children: "全部角色"
              }
            )
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "market-character-panel-body", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "market-character-section market-character-section-roles", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "market-character-section-title", children: "角色" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "market-character-grid", children: visibleCharacterPickerOptions.roleOptions.map((char) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
                "button",
                {
                  type: "button",
                  className: `market-character-option ${isSameMarketCharacterName(selectedCharacter, char.name, marketCharacterAliasIndex) ? "active" : ""}`,
                  onClick: () => {
                    setSelectedCharacter(char.name);
                    setShowCharacterPicker(false);
                    setCurrentPage(1);
                  },
                  title: char.name,
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "market-character-avatar", children: char.coverUrl ? /* @__PURE__ */ jsxRuntimeExports.jsx("img", { src: char.coverUrl, alt: "" }) : /* @__PURE__ */ jsxRuntimeExports.jsx("em", { children: char.name.slice(0, 1) }) }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "market-character-name", children: char.name }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "market-character-count", children: char.count })
                  ]
                },
                char.name
              )) })
            ] }),
            visibleCharacterPickerOptions.functionOptions.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "market-character-section market-character-section-functions", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "market-character-section-title", children: "功能" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "market-function-list", children: visibleCharacterPickerOptions.functionOptions.map((char) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
                "button",
                {
                  type: "button",
                  className: `market-function-option ${isSameMarketCharacterName(selectedCharacter, char.name, marketCharacterAliasIndex) ? "active" : ""}`,
                  onClick: () => {
                    setSelectedCharacter(char.name);
                    setShowCharacterPicker(false);
                    setCurrentPage(1);
                  },
                  title: char.name,
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "market-function-avatar", children: char.coverUrl ? /* @__PURE__ */ jsxRuntimeExports.jsx("img", { src: char.coverUrl, alt: "" }) : /* @__PURE__ */ jsxRuntimeExports.jsx("em", { children: char.name.slice(0, 1) }) }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: char.name }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: char.count })
                  ]
                },
                char.name
              )) })
            ] })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "button",
        {
          type: "button",
          className: `mod-market-favorite-filter ${likedOnly ? "active" : ""}`,
          "aria-pressed": likedOnly,
          onClick: () => setLikedOnly((value) => !value),
          title: likedOnly ? "显示全部 Mod" : "只显示收藏的 Mod",
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "mod-favorite-heart", "aria-hidden": "true", children: likedOnly ? "♥" : "♡" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "收藏" })
          ]
        }
      ),
      gameVersionOptions.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "select",
        {
          value: selectedGameVersion,
          onChange: (e) => setSelectedGameVersion(e.target.value),
          className: "mod-market-select",
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "all", children: "📦 全部版本" }),
            gameVersionOptions.map((ver) => /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: ver, children: ver }, ver))
          ]
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "select",
        {
          value: selectedModMode,
          onChange: (e) => setSelectedModMode(e.target.value),
          className: "mod-market-select",
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "all", children: "🧩 全部模式" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "d3d", children: "3dm" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "pak", children: "Pak" })
          ]
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "select",
        {
          value: sortBy,
          onChange: (e) => setSortBy(e.target.value),
          className: "mod-market-select",
          style: { minWidth: "80px" },
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "newest", children: "📅 最新" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "hot_today", children: "🔥 今日最火" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "hot_week", children: "🔥 7日最火" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "hot_month", children: "🔥 月度最火" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "downloads", children: "📊 历史下载" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "name", children: "🔤 名称" })
          ]
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "mod-market-count", children: [
        displayedMods.length,
        " / ",
        gameDisplayedMods.length,
        " 个"
      ] })
    ] }),
    error && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mod-market-error", children: [
      "⚠️ ",
      error
    ] }),
    !serverUrl && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mod-market-empty", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "empty-icon", children: "🔗" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: "请先在设置中配置服务器地址" })
    ] }),
    (loading || marketIsBooting) && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mod-market-loading", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "spinner" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: marketIsBooting ? "正在读取本地市场缓存..." : "正在加载 Mod..." })
    ] }),
    serverUrl && !loading && !marketIsBooting && !error && /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "div",
      {
        className: [
          "mod-market-grid",
          equalRowHeight ? "mod-market-grid-equal" : "mod-market-grid-adaptive"
        ].join(" "),
        style: {
          "--market-card-min": `${getMarketCardMinWidth(modMarketCardScale)}px`,
          "--market-card-gap": `${getMarketCardGap(modMarketCardScale)}px`,
          "--market-card-min-image-height": `${getMarketCardImageMinHeight(modMarketCardScale)}px`,
          "--market-card-wide-min-image-height": `${getMarketCardWideImageMinHeight(modMarketCardScale)}px`,
          "--market-card-max-image-height": `${getMarketCardImageMaxHeight(modMarketCardScale)}px`
        },
        ref: marketGridRef,
        children: [
          equalRowHeight ? pagedMods.map((mod, index) => renderMarketCard(mod, index)) : adaptiveColumns.map((column, columnIndex) => /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mod-market-column", children: column.map(({ mod, index }) => renderMarketCard(mod, index)) }, `market-column-${columnIndex}`)),
          initialCacheReady && sectionedDisplayedMods.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mod-market-no-results", children: "没有找到匹配的 Mod" })
        ]
      }
    ),
    serverUrl && !loading && !marketIsBooting && !error && !infiniteScroll && sectionedDisplayedMods.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mod-market-pagination", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          className: "page-btn",
          onClick: () => {
            setCurrentPage(1);
            scrollToTop();
          },
          disabled: currentPage === 1,
          children: "«"
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          className: "page-btn",
          onClick: () => {
            setCurrentPage((p) => Math.max(1, p - 1));
            scrollToTop();
          },
          disabled: currentPage === 1,
          children: "‹"
        }
      ),
      Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2).reduce((acc, p, idx, arr) => {
        if (idx > 0 && p - arr[idx - 1] > 1) acc.push("...");
        acc.push(p);
        return acc;
      }, []).map(
        (item, idx) => item === "..." ? /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "page-ellipsis", children: "…" }, `ellipsis-${idx}`) : /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            className: `page-btn ${item === currentPage ? "active" : ""}`,
            onClick: () => {
              setCurrentPage(item);
              scrollToTop();
            },
            children: item
          },
          item
        )
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          className: "page-btn",
          onClick: () => {
            setCurrentPage((p) => Math.min(totalPages, p + 1));
            scrollToTop();
          },
          disabled: currentPage === totalPages,
          children: "›"
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          className: "page-btn",
          onClick: () => {
            setCurrentPage(totalPages);
            scrollToTop();
          },
          disabled: currentPage === totalPages,
          children: "»"
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "page-info", children: [
        currentPage,
        " / ",
        totalPages,
        " 页 · 共 ",
        sectionedDisplayedMods.length,
        " 个"
      ] })
    ] }),
    lightboxData && isActive && ReactDOM.createPortal(
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        LightboxOverlay,
        {
          images: lightboxData.images,
          index: lightboxData.index,
          onClose: () => setLightboxData(null),
          onChange: (newIndex) => setLightboxData((prev) => prev ? { ...prev, index: newIndex } : null)
        }
      ),
      document.body
    ),
    detailMod && isActive && ReactDOM.createPortal(
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "div",
        {
          className: `xhs-detail-overlay ${closingDetail ? "closing" : ""}`,
          onClick: () => closeDetailModal(),
          children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "xhs-detail-layout", onClick: (e) => e.stopPropagation(), children: [
            (() => {
              const related = displayedMods;
              if (related.length <= 1) return null;
              return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "xhs-related-sidebar", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "xhs-related-sidebar-scroll", ref: relatedScrollRef, children: related.map((m) => {
                const isCurrent = m.id === detailMod.id;
                return /* @__PURE__ */ jsxRuntimeExports.jsxs(
                  "div",
                  {
                    className: `xhs-related-item ${isCurrent ? "active" : ""}`,
                    "data-mod-id": m.id,
                    onClick: () => {
                      if (!isCurrent) openModDetail(m);
                    },
                    title: m.name,
                    children: [
                      m.imageUrl ? /* @__PURE__ */ jsxRuntimeExports.jsx(
                        MarketImage,
                        {
                          src: m.imageUrl,
                          alt: m.name,
                          className: "market-image-related"
                        }
                      ) : /* @__PURE__ */ jsxRuntimeExports.jsx(
                        "div",
                        {
                          style: {
                            width: "100%",
                            aspectRatio: "3/4",
                            background: "rgba(255,255,255,0.1)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "24px"
                          },
                          children: "🖼️"
                        }
                      ),
                      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "xhs-related-item-name", children: m.name })
                    ]
                  },
                  m.id
                );
              }) }) });
            })(),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "xhs-detail-container", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "xhs-detail-close", onClick: () => closeDetailModal(), children: "✕" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "xhs-detail-left", children: (() => {
                const galleryImages = buildImageList(detailMod);
                if (!galleryImages.length) return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "xhs-detail-no-img", children: "🖼️" });
                const idx = Math.min(detailGalleryIdx, galleryImages.length - 1);
                return /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    "div",
                    {
                      className: "xhs-detail-bg-blur",
                      style: { backgroundImage: `url(${galleryImages[idx].url})` }
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    MarketImage,
                    {
                      src: galleryImages[idx].url,
                      alt: detailMod.name,
                      className: "xhs-detail-main-img",
                      loading: "eager",
                      fetchPriority: "high",
                      onClick: () => setLightboxData({
                        images: galleryImages,
                        index: idx
                      })
                    },
                    `detail-${idx}`
                  ),
                  galleryImages.length > 1 && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx(
                      "button",
                      {
                        className: "xhs-img-nav xhs-img-nav-prev",
                        onClick: () => setDetailGalleryIdx(
                          (i) => (i - 1 + galleryImages.length) % galleryImages.length
                        ),
                        children: "‹"
                      }
                    ),
                    /* @__PURE__ */ jsxRuntimeExports.jsx(
                      "button",
                      {
                        className: "xhs-img-nav xhs-img-nav-next",
                        onClick: () => setDetailGalleryIdx((i) => (i + 1) % galleryImages.length),
                        children: "›"
                      }
                    ),
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "xhs-img-counter", children: [
                      idx + 1,
                      " / ",
                      galleryImages.length
                    ] }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "xhs-img-dots", children: galleryImages.map((_, i) => /* @__PURE__ */ jsxRuntimeExports.jsx(
                      "button",
                      {
                        className: `xhs-img-dot ${i === idx ? "active" : ""}`,
                        onClick: () => setDetailGalleryIdx(i)
                      },
                      i
                    )) })
                  ] }),
                  galleryImages.length > 1 && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "xhs-thumb-strip", children: galleryImages.map((img, i) => /* @__PURE__ */ jsxRuntimeExports.jsx(
                    MarketImage,
                    {
                      src: img.url,
                      alt: "",
                      className: `xhs-thumb ${i === idx ? "active" : ""}`,
                      loading: Math.abs(i - idx) <= 1 ? "eager" : "lazy",
                      onClick: () => setDetailGalleryIdx(i)
                    },
                    i
                  )) })
                ] });
              })() }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "xhs-detail-right", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "xhs-detail-right-scroll", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "xhs-detail-header", children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "xhs-detail-title", children: detailMod.name }),
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "xhs-detail-meta-row", children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "xhs-meta-item", children: [
                        "📅",
                        " ",
                        detailMod.createdAt ? new Date(detailMod.createdAt).toLocaleDateString("zh-CN") : "未知"
                      ] }),
                      detailMod.updatedAt && /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "xhs-meta-item", children: [
                        "🔄 ",
                        new Date(detailMod.updatedAt).toLocaleDateString("zh-CN")
                      ] })
                    ] })
                  ] }),
                  detailCollectionGroup?.variants?.length > 1 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "xhs-detail-section xhs-collection-variants", children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "xhs-collection-variants-head", children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "合集" }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: detailCollectionGroup.name })
                    ] }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "xhs-variant-buttons", children: detailCollectionGroup.variants.map((variant, index) => {
                      const isCurrent = String(variant.id) === String(detailMod.id);
                      return /* @__PURE__ */ jsxRuntimeExports.jsxs(
                        "button",
                        {
                          type: "button",
                          className: `xhs-variant-button ${isCurrent ? "active" : ""}`,
                          onClick: () => {
                            if (!isCurrent) {
                              selectCollectionVariant(detailCollectionGroup.identity, variant, true);
                            }
                          },
                          children: [
                            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: getVariantLabel(variant, index) }),
                            /* @__PURE__ */ jsxRuntimeExports.jsx("em", { children: getVariantSourceLabel(variant) })
                          ]
                        },
                        variant.id
                      );
                    }) })
                  ] }),
                  detailMod.description && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "xhs-detail-section", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "xhs-detail-desc", children: detailMod.description }) }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "xhs-detail-section", children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "xhs-detail-filter-tags", children: [
                      (() => {
                        const detailCharacterName = getMarketCanonicalCharacterName(
                          detailMod.characterName || detailMod._originalCharacterName || "通用",
                          marketCharacterAliasIndex
                        );
                        return /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
                          renderFilterTag({
                            label: `🎮 ${gameNameMap[getModGameId(detailMod)] || getModGameId(detailMod)}`,
                            onClick: () => applyQuickFilter({
                              gameId: getModGameId(detailMod),
                              character: "all",
                              closeDetail: true
                            }),
                            title: "点击筛选当前游戏"
                          }),
                          renderFilterTag({
                            label: `👤 ${detailCharacterName || "通用"}`,
                            className: "tag-character",
                            onClick: () => applyQuickFilter({
                              gameId: getModGameId(detailMod),
                              character: detailCharacterName || "all",
                              closeDetail: true
                            }),
                            title: detailCharacterName ? `点击筛选角色「${detailCharacterName}」` : "点击查看通用 Mod"
                          })
                        ] });
                      })(),
                      detailMod.game_version && renderFilterTag({
                        label: `📦 ${detailMod.game_version}`,
                        className: "tag-version",
                        onClick: () => applyQuickFilter({
                          gameId: getModGameId(detailMod),
                          character: selectedCharacter,
                          gameVersion: detailMod.game_version,
                          closeDetail: true
                        }),
                        title: `点击筛选游戏版本「${detailMod.game_version}」`
                      }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        "span",
                        {
                          className: "tag",
                          title: (detailMod.modMode || "d3d") === "pak" ? "Pak Mod" : "3dm Mod",
                          children: getModModeLabel(detailMod.modMode || "d3d")
                        }
                      ),
                      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "tag", children: getMarketVersionLabel(detailMod) })
                    ] }),
                    filterVisibleMarketTags(detailMod.tags).length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "xhs-detail-mod-tags", children: filterVisibleMarketTags(detailMod.tags).map((tag) => /* @__PURE__ */ jsxRuntimeExports.jsx(
                      "button",
                      {
                        className: "tag mod-tag-pill tag-clickable",
                        style: {
                          background: `${tag.color || "#666"}18`,
                          color: tag.color || "#666",
                          border: `1px solid ${tag.color || "#666"}40`
                        },
                        title: `点击筛选「${tag.name}」`,
                        onClick: () => {
                          addTagFilter(tag);
                          closeDetailModal();
                        },
                        children: tag.name
                      },
                      tag.id
                    )) })
                  ] }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "xhs-detail-section xhs-detail-comments", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
                    ModCommentSection,
                    {
                      modId: detailMod.id,
                      serverUrl,
                      clientId,
                      devMode,
                      mod: detailMod
                    }
                  ) })
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "xhs-detail-bottom-bar", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "xhs-bottom-stats", children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsxs(
                      "button",
                      {
                        className: `xhs-bottom-stat ${likedMods.has(String(detailMod.id)) ? "liked" : ""}`,
                        onClick: () => handleToggleLike(detailMod.id),
                        title: likedMods.has(String(detailMod.id)) ? "取消收藏" : "收藏",
                        style: likedMods.has(String(detailMod.id)) ? { color: "#ec4899" } : void 0,
                        children: [
                          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "xhs-bottom-stat-icon mod-favorite-heart", "aria-hidden": "true", children: likedMods.has(String(detailMod.id)) ? "♥" : "♡" }),
                          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "xhs-bottom-stat-num", children: "收藏" })
                        ]
                      }
                    ),
                    commentCounts[detailMod.id] > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "xhs-bottom-stat", children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "xhs-bottom-stat-icon", children: "💬" }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "xhs-bottom-stat-num", children: commentCounts[detailMod.id] })
                    ] }),
                    /* @__PURE__ */ jsxRuntimeExports.jsxs(
                      "button",
                      {
                        className: "xhs-bottom-stat xhs-feedback-stat",
                        onClick: () => openFeedbackModal(detailMod),
                        title: "反馈网盘或下载失效",
                        children: [
                          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "xhs-bottom-stat-icon", children: "!" }),
                          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "xhs-bottom-stat-num", children: "失效反馈" })
                        ]
                      }
                    )
                  ] }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "xhs-bottom-actions", children: [
                    shouldShowDirectDownload(detailMod) && /* @__PURE__ */ jsxRuntimeExports.jsx(
                      "button",
                      {
                        className: "btn btn-primary xhs-dl-btn",
                        title: "下载并安装",
                        onClick: () => handleDirectDownload(detailMod, "mod_detail"),
                        children: "下载"
                      }
                    ),
                    detailMod.downloadUrl && /* @__PURE__ */ jsxRuntimeExports.jsx(
                      "button",
                      {
                        className: "btn btn-primary xhs-dl-btn xhs-dl-baidu",
                        title: "从百度网盘下载",
                        onClick: () => handleDownload(detailMod, detailMod.downloadUrl, "baidu", "mod_detail"),
                        children: "百度"
                      }
                    ),
                    detailMod.quarkDownloadUrl && /* @__PURE__ */ jsxRuntimeExports.jsx(
                      "button",
                      {
                        className: "btn btn-primary xhs-dl-btn xhs-dl-quark",
                        title: "从夸克网盘下载",
                        onClick: () => handleDownload(
                          detailMod,
                          detailMod.quarkDownloadUrl,
                          "quark",
                          "mod_detail"
                        ),
                        children: "夸克"
                      }
                    )
                  ] })
                ] })
              ] })
            ] })
          ] })
        }
      ),
      document.body
    ),
    showBackToMarketPosition && ReactDOM.createPortal(
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          className: `market-restore-position-btn ${showBackToTop ? "with-back-top" : ""}`,
          onClick: restoreMarketScrollPosition,
          title: "回到刚刚浏览的位置",
          children: "回到刚刚位置"
        }
      ),
      document.body
    ),
    showBackToTop && ReactDOM.createPortal(
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "back-to-top-btn", onClick: scrollToTop, title: "回到顶部", children: "↑" }),
      document.body
    ),
    downloadPrompt && isActive && ReactDOM.createPortal(
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "market-download-prompt-overlay", onClick: () => setDownloadPrompt(null), children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "market-download-prompt-dialog", onClick: (e) => e.stopPropagation(), children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "market-download-prompt-icon", children: "↓" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "暂时无法直接下载" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: downloadPrompt.type === "login_required" ? downloadPrompt.sessionExpired ? "登录状态已失效，当前版本已移除账号登录入口。如有外部下载链接，可通过链接获取 Mod。" : "直接下载需要登录账号，当前版本已移除账号登录入口。如有外部下载链接，可通过链接获取 Mod。" : "该下载源暂不可用。如有外部下载链接，可通过链接获取 Mod。" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "market-download-prompt-actions", children:
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn btn-primary", onClick: () => setDownloadPrompt(null), children: "知道了" })
        })
      ] }) }),
      document.body
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      ModFeedbackModal,
      {
        open: isActive && !!feedbackTargetMod,
        mod: feedbackTargetMod,
        clientId,
        serverUrl,
        onClose: () => setFeedbackTargetMod(null),
        onSubmitted: (payload) => setToast(payload)
      }
    ),
    toast && ReactDOM.createPortal(
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: `toast toast-${toast.type || "success"}`, children: toast.message }),
      document.body
    )
  ] });
}
export {
  ModMarketView as default
};
