import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
import { Icon } from "../../../components/Icon.jsx";
import {
  readCommentsCache,
  getOrCreateNickname,
  fetchUserProfile,
  mergeRetainRecentOwn,
  writeCommentsCache,
  timeAgo,
} from "../model/comments.js";
function AvatarCircle({ nickname, avatarUrl, size = 28 }) {
  const style = {
    width: size,
    height: size,
  };
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={nickname}
        style={style}
        className="comment-avatar"
      />
    );
  }
  return (
    <div style={style} className="comment-avatar comment-avatar-placeholder">
      {(nickname || "?")[0]}
    </div>
  );
}
function ModCommentSection({
  modId,
  serverUrl,
  clientId,
  devMode = false,
  mod = null,
}) {
  const initialCache = readCommentsCache(serverUrl, modId);
  const [comments, setComments] = React.useState(
    () => initialCache?.comments || [],
  );
  const [total, setTotal] = React.useState(() => initialCache?.total || 0);
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [content, setContent] = React.useState("");
  const [replyTo, setReplyTo] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [nickname, setNickname] = React.useState(() => getOrCreateNickname());
  const [myAvatarUrl, setMyAvatarUrl] = React.useState(
    () => localStorage.getItem("comment-avatar-url") || null,
  );
  const [developerPublishKeys, setDeveloperPublishKeys] = React.useState([]);
  const [hidingCommentId, setHidingCommentId] = React.useState(null);
  const isActiveRef = React.useRef(true);
  React.useEffect(() => {
    isActiveRef.current = true;
    return () => {
      isActiveRef.current = false;
    };
  }, []);
  const currentModIdRef = React.useRef(modId);
  React.useEffect(() => {
    if (currentModIdRef.current === modId) return;
    currentModIdRef.current = modId;
    const cached = readCommentsCache(serverUrl, modId);
    setComments(cached?.comments || []);
    setTotal(cached?.total || 0);
    setPage(1);
  }, [serverUrl, modId]);
  React.useEffect(() => {
    if (!serverUrl || !clientId) return;
    let cancelled = false;
    fetchUserProfile(serverUrl, clientId).then((profile) => {
      if (cancelled) return;
      if (profile.nickname) setNickname(profile.nickname);
      if (profile.avatarUrl) {
        setMyAvatarUrl(profile.avatarUrl);
        try {
          localStorage.setItem("comment-avatar-url", profile.avatarUrl);
        } catch {}
      }
    });
    return () => {
      cancelled = true;
    };
  }, [serverUrl, clientId]);
  React.useEffect(() => {
    let cancelled = false;
    setDeveloperPublishKeys([]);
    if (!devMode || !modId || !window.api?.devGetMarketPublishKey) return;
    window.api
      .devGetMarketPublishKey({
        modId,
        gameId: mod?.gameId,
        characterName: mod?.characterName,
        modName: mod?.name,
      })
      .then((result) => {
        if (cancelled) return;
        if (result?.success) {
          const keys = Array.isArray(result.publishKeys)
            ? result.publishKeys
            : [result.publishKey];
          setDeveloperPublishKeys(keys.filter(Boolean));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [devMode, modId, mod?.gameId, mod?.characterName, mod?.name]);
  const loadComments = React.useCallback(
    async (pageNum = 1, append = false, silent = false) => {
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
          if (!isActiveRef.current || currentModIdRef.current !== fetchModId)
            return;
          const res = await fetch(url, {
            cache: "no-store",
            headers: {
              "Cache-Control": "no-cache",
              Pragma: "no-cache",
            },
          });
          const data = await res.json();
          if (!isActiveRef.current || currentModIdRef.current !== fetchModId) {
            lastErr = null;
            break;
          }
          if (data.success) {
            const markOwn = (list) =>
              (list || []).map((c) => ({
                ...c,
                isOwn:
                  typeof c.isOwn === "boolean"
                    ? c.isOwn
                    : !!(c.clientId && clientId && c.clientId === clientId),
                replies: markOwn(c.replies),
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
            if (
              pageNum === 1 &&
              !append &&
              !myAvatarUrl &&
              isActiveRef.current
            ) {
              const ownWithAvatar =
                incoming.find((c) => c.isOwn && c.avatarUrl) ||
                incoming
                  .flatMap((c) => c.replies || [])
                  .find((c) => c.isOwn && c.avatarUrl);
              if (ownWithAvatar && ownWithAvatar.avatarUrl) {
                setMyAvatarUrl(ownWithAvatar.avatarUrl);
                localStorage.setItem(
                  "comment-avatar-url",
                  ownWithAvatar.avatarUrl,
                );
                if (
                  ownWithAvatar.nickname &&
                  typeof ownWithAvatar.nickname === "string"
                ) {
                  setNickname(ownWithAvatar.nickname);
                }
              }
            }
            if (pageNum === 1 && !append) {
              const cachedNow = readCommentsCache(serverUrl, fetchModId);
              const merged = mergeRetainRecentOwn(
                cachedNow?.comments || [],
                incoming,
              );
              writeCommentsCache(serverUrl, fetchModId, {
                comments: merged,
                total: data.total || 0,
              });
            }
            lastErr = null;
            break;
          }
        } catch (e) {
          lastErr = e;
        }
      }
      if (lastErr)
        console.warn(
          "[ModCommentSection] Load comments failed after retries:",
          lastErr,
        );
      if (
        !silent &&
        currentModIdRef.current === fetchModId &&
        isActiveRef.current
      ) {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [serverUrl, modId, clientId],
  );
  React.useEffect(() => {
    const hasCache = !!readCommentsCache(serverUrl, modId);
    loadComments(1, false, hasCache);
  }, [loadComments, serverUrl, modId]);
  React.useEffect(() => {
    if (!serverUrl || !modId) return;
    if (page !== 1) return;
    writeCommentsCache(serverUrl, modId, {
      comments,
      total,
    });
  }, [serverUrl, modId, comments, total, page]);
  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;
    if (trimmed.length > 500) {
      setError(t("market.comments.tooLong"));
      return;
    }
    const isReply = !!replyTo;
    const displayContent = isReply
      ? `@${replyTo.nickname} ${trimmed}`
      : trimmed;
    if (
      isReply &&
      typeof replyTo.id === "string" &&
      replyTo.id.startsWith("temp-")
    ) {
      setError(t("market.comments.waitForSend"));
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
      createdAt: new Date().toISOString(),
      likes: 0,
      isLiked: false,
      isOwn: true,
      pending: true,
      replies: [],
    };
    if (isReply) {
      setComments((prev) =>
        prev.map((c) =>
          c.id === replyTo.id
            ? {
                ...c,
                replies: [...(c.replies || []), optimistic],
              }
            : c,
        ),
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
        avatarUrl: myAvatarUrl || void 0,
      };
      const res = await fetch(`${serverUrl}/api/mods/${postModId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const rawText = await res.text();
      let data = null;
      try {
        data = JSON.parse(rawText);
      } catch {}
      const stillOnOriginMod =
        currentModIdRef.current === postModId && isActiveRef.current;
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
            replies: real.replies || [],
          };
          const swapIn = (list) => {
            if (isReply) {
              return list.map((c) => {
                if (c.id !== replyTo.id) return c;
                return {
                  ...c,
                  replies: (c.replies || []).map((r) =>
                    r.id === tempId ? normalizedReal : r,
                  ),
                };
              });
            }
            return list.map((c) => (c.id === tempId ? normalizedReal : c));
          };
          if (stillOnOriginMod) {
            setComments(swapIn);
          } else {
            const cached = readCommentsCache(serverUrl, postModId);
            if (cached) {
              writeCommentsCache(serverUrl, postModId, {
                comments: swapIn(cached.comments || []),
                total: cached.total,
              });
            }
          }
        } else if (stillOnOriginMod) {
          setComments((prev) => {
            const clearPending = (c) =>
              c.id === tempId
                ? {
                    ...c,
                    pending: false,
                  }
                : c.replies
                  ? {
                      ...c,
                      replies: c.replies.map(clearPending),
                    }
                  : c;
            return prev.map(clearPending);
          });
        }
      } else {
        if (stillOnOriginMod) {
          setComments(prevComments);
          setTotal(prevTotal);
          setContent(prevContent);
          setReplyTo(prevReplyTo);
          const serverMsg =
            data?.error ||
            (rawText ? rawText.slice(0, 80).replace(/\s+/g, " ") : "");
          setError(
            t("market.comments.sendHttpFailed", {
              status: res.status,
              otherStatus: serverMsg ? ": " + serverMsg : "",
            }),
          );
        } else {
          const cached = readCommentsCache(serverUrl, postModId);
          if (cached) {
            const strip = (list) =>
              list
                .filter((c) => c.id !== tempId)
                .map((c) => ({
                  ...c,
                  replies: (c.replies || []).filter((r) => r.id !== tempId),
                }));
            writeCommentsCache(serverUrl, postModId, {
              comments: strip(cached.comments || []),
              total: Math.max(0, (cached.total || 0) - 1),
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
        setError(
          t("market.comments.sendException", {
            message: e2.message || t("common.errors.network"),
          }),
        );
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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setComments((prev) =>
          prev.map((c) => {
            if (c.id === commentId)
              return {
                ...c,
                likes: data.likes,
                isLiked: data.liked,
              };
            if (c.replies) {
              return {
                ...c,
                replies: c.replies.map((r) =>
                  r.id === commentId
                    ? {
                        ...r,
                        likes: data.likes,
                        isLiked: data.liked,
                      }
                    : r,
                ),
              };
            }
            return c;
          }),
        );
      }
    } catch (e) {
      console.error("Like comment failed:", e);
    }
  }
  async function handleHideComment(commentId, isReply = false) {
    if (!serverUrl || !developerPublishKeys.length || hidingCommentId) return;
    if (!window.confirm(t("market.comments.confirmHide"))) return;
    setHidingCommentId(commentId);
    setError(null);
    try {
      let hidden = false;
      let lastError = null;
      for (const publishKey of developerPublishKeys) {
        const res = await fetch(`${serverUrl}/api/comments/${commentId}/hide`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            publishKey,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) {
          hidden = true;
          break;
        }
        lastError =
          data.error ||
          t("market.comments.hideHttpFailed", {
            status: res.status,
          });
      }
      if (!hidden)
        throw new Error(lastError || t("market.comments.hideFailed"));
      const removeHidden = (list) =>
        (list || [])
          .filter((c) => c.id !== commentId)
          .map((c) => ({
            ...c,
            replies: (c.replies || []).filter((r) => r.id !== commentId),
          }));
      setComments((prev) => removeHidden(prev));
      if (!isReply) setTotal((value) => Math.max(0, value - 1));
      const cached = readCommentsCache(serverUrl, modId);
      if (cached) {
        writeCommentsCache(serverUrl, modId, {
          comments: removeHidden(cached.comments || []),
          total: isReply
            ? cached.total || 0
            : Math.max(0, (cached.total || 0) - 1),
        });
      }
    } catch (e) {
      setError(e.message || t("market.comments.hideFailed"));
    } finally {
      setHidingCommentId(null);
    }
  }
  const hasMore = comments.length < total;
  const canModerateComments = devMode && developerPublishKeys.length > 0;
  function renderComment(comment, isReply = false) {
    return (
      <div
        key={comment.id}
        className={`comment-row ${isReply ? "is-reply" : ""} ${comment.pending ? "is-pending" : ""}`}
      >
        <AvatarCircle
          nickname={comment.nickname}
          avatarUrl={
            comment.isOwn ? comment.avatarUrl || myAvatarUrl : comment.avatarUrl
          }
          size={isReply ? 24 : 28}
        />
        <div className="comment-copy">
          <div className="comment-author-line">
            <strong>{comment.nickname}</strong>
            <span>
              {comment.pending
                ? t("common.status.sending")
                : timeAgo(comment.createdAt)}
            </span>
            {comment.pending && <span className="spinner" aria-hidden="true" />}
          </div>
          <div className="comment-text selectable">{comment.content}</div>
          <div className="comment-actions">
            <button
              type="button"
              onClick={() => handleLikeComment(comment.id)}
              className={comment.isLiked ? "is-active" : ""}
              aria-pressed={!!comment.isLiked}
            >
              <Icon
                name="heart"
                size={13}
                fill={comment.isLiked ? "currentColor" : "none"}
              />
              {comment.likes || 0}
            </button>
            {!isReply && (
              <button
                type="button"
                onClick={() =>
                  setReplyTo({
                    id: comment.id,
                    nickname: comment.nickname,
                  })
                }
              >
                {t("market.comments.reply")}
              </button>
            )}
            {canModerateComments && !comment.pending && (
              <button
                type="button"
                onClick={() => handleHideComment(comment.id, isReply)}
                disabled={hidingCommentId === comment.id}
                title={t("market.comments.hideHint")}
                className="is-danger"
              >
                {hidingCommentId === comment.id
                  ? t("market.comments.hiding")
                  : t("common.actions.hide")}
              </button>
            )}
          </div>
          {!isReply && comment.replies && comment.replies.length > 0 && (
            <div className="comment-replies">
              {comment.replies.map((r) => renderComment(r, true))}
            </div>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="mod-comment-section">
      <h3 className="comment-header">
        {t("market.comments.title")}
        {total > 0 && <span className="badge">{total}</span>}
      </h3>
      {replyTo && (
        <div className="comment-reply-hint">
          <span>
            {t("market.comments.replyHeading", {
              nickname: replyTo.nickname,
            })}
          </span>
          <button
            type="button"
            className="icon-btn icon-btn-sm"
            aria-label={t("common.actions.cancel")}
            onClick={() => setReplyTo(null)}
          >
            <Icon name="x" size={14} />
          </button>
        </div>
      )}
      {error && (
        <div className="notice notice-danger comment-error" role="alert">
          <Icon name="alert" size={14} />
          <span>{error}</span>
          <button
            type="button"
            className="icon-btn icon-btn-sm"
            onClick={() => setError(null)}
            aria-label={t("common.actions.dismissError")}
          >
            <Icon name="x" size={14} />
          </button>
        </div>
      )}
      <form className="comment-input-area" onSubmit={handleSubmit}>
        <AvatarCircle nickname={nickname} avatarUrl={myAvatarUrl} size={28} />
        <div className="comment-input-field">
          <textarea
            className="textarea"
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              if (error) setError(null);
            }}
            placeholder={
              replyTo
                ? t("market.comments.replyPlaceholder", {
                    nickname: replyTo.nickname,
                  })
                : t("market.comments.placeholder")
            }
            rows={2}
            maxLength={500}
          />
          {(content || submitting) && (
            <div className="comment-input-foot">
              <span className={content.length > 450 ? "is-near-limit" : ""}>
                {content.length}
                {"/500"}
              </span>
              <button
                type="submit"
                className="btn btn-sm"
                disabled={submitting || !content.trim()}
              >
                {submitting
                  ? t("common.status.sending")
                  : t("common.actions.send")}
              </button>
            </div>
          )}
        </div>
      </form>
      {loading ? (
        <div className="comment-empty" role="status">
          <span className="spinner" aria-hidden="true" />
          {t("market.comments.loading")}
        </div>
      ) : comments.length === 0 ? (
        <div className="comment-empty">{t("market.comments.empty")}</div>
      ) : (
        <div className="comment-list">
          {comments.map((c) => renderComment(c))}
          {hasMore && (
            <button
              type="button"
              className="btn btn-sm btn-ghost comment-load-more"
              onClick={() => loadComments(page + 1, true)}
              disabled={loadingMore}
            >
              {loadingMore
                ? t("common.status.loading")
                : t("market.comments.loadMore", {
                    commentsCount: comments.length,
                    total,
                  })}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
export { ModCommentSection };
