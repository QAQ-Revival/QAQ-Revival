import { t } from "../../../shared/i18n/index.mjs";
import React from "react";
import ReactDOM from "react-dom";
import { Icon } from "../../components/Icon.jsx";
import { SourceError } from "./SourceStates.jsx";
const postKey = (post) => `${post.service}:${post.user}:${post.id}`;
const date = (value) =>
  value
    ? new Date(value).toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : t("common.status.noDate");
function webUrl(value, base) {
  try {
    const url = new URL(value, base);
    return ["https:", "http:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}
function readableContent(content, base) {
  const doc = new DOMParser().parseFromString(content || "", "text/html");
  doc
    .querySelectorAll("script, style, iframe, object, template")
    .forEach((node) => node.remove());
  const links = [...doc.querySelectorAll("a[href]")].flatMap((node) => {
    const url = webUrl(node.getAttribute("href"), base);
    return url
      ? [
          {
            url,
            label: node.textContent.trim() || new URL(url).hostname,
          },
        ]
      : [];
  });
  const images = [...doc.querySelectorAll("img[src], img[data-src]")].flatMap(
    (node) => {
      const url = webUrl(
        node.getAttribute("data-src") || node.getAttribute("src"),
        base,
      );
      return url
        ? [
            {
              url,
              name: node.getAttribute("alt") || t("downloads.post.bodyImage"),
            },
          ]
        : [];
    },
  );
  doc
    .querySelectorAll("p, div, br, li, h1, h2, h3, tr")
    .forEach((node) => node.append("\n"));
  const text = doc.body.textContent
    .replace(/[\u200b\u200c\u200d\ufeff]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  for (const match of text.match(/https?:\/\/[^\s<>"'，。；）)\]]+/gi) || []) {
    const url = webUrl(match.replace(/[.,;:!?]+$/, ""), base);
    if (url)
      links.push({
        url,
        label: /mega\.(?:nz|co\.nz|io)\/#P!/i.test(url)
          ? t("downloads.post.megaPasswordLink")
          : url,
      });
  }
  return {
    text,
    links: [...new Map(links.map((link) => [link.url, link])).values()],
    images,
  };
}
function postImages(post, inline = []) {
  const files =
    post.images ||
    [post.file, ...(post.attachments || [])].filter((file) => file?.thumbnail);
  const images = [
    ...files.map((file) => ({
      ...file,
      url: file.url || file.thumbnail,
    })),
    ...inline,
  ];
  if (!images.length && post.thumbnail)
    images.push({
      url: post.thumbnail,
      name: post.title,
    });
  const seen = new Set();
  return images.filter((item) => {
    if (!webUrl(item.url)) return false;
    const url = new URL(item.url);
    const key = /(?:^|\.)((pawchive\.pw)|(kemono\.cr))$/.test(url.hostname)
      ? url.pathname.replace(/^\/thumbnail/, "")
      : url.href;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function Image({
  src,
  fallback,
  alt = "",
  avatar = false,
  loading = "lazy",
  mediaSource,
  gameId,
}) {
  const [failed, setFailed] = React.useState(0);
  const [resolved, setResolved] = React.useState("");
  React.useEffect(() => setFailed(0), [src, fallback]);
  const current = failed === 0 ? src : failed === 1 ? fallback : "";
  React.useEffect(() => {
    if (!mediaSource || !current) return;
    let cancelled = false;
    setResolved("");
    window.api
      .modSiteImage({
        source: mediaSource,
        gameId,
        url: current,
      })
      .then((result) => {
        if (!cancelled) {
          if (result.success) setResolved(result.dataUrl);
          else setFailed((value) => value + 1);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed((value) => value + 1);
      });
    return () => {
      cancelled = true;
    };
  }, [current, mediaSource, gameId]);
  const display = mediaSource ? current && resolved : current;
  return display ? (
    <img
      src={display}
      alt={alt}
      loading={loading}
      referrerPolicy="no-referrer"
      onError={() => setFailed((value) => value + 1)}
    />
  ) : (
    <span
      className="paw-image-placeholder"
      aria-label={
        avatar
          ? t("downloads.post.authorAvatar")
          : t("downloads.post.noPreview")
      }
    >
      <Icon name={avatar ? "user" : "image"} size={avatar ? 16 : 22} />
    </span>
  );
}
function PostDialog({
  selected,
  posts,
  source,
  onSelect,
  onClose,
  openExternal,
  onAuthor,
  favoriteButton,
  onMarkRead,
  Download,
  loadPost,
  sourceLabel,
  onAccessRequired,
}) {
  const key = postKey(selected);
  const [detail, setDetail] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [retry, setRetry] = React.useState(0);
  const [imageIndex, setImageIndex] = React.useState(0);
  const [attachmentState, setAttachmentState] = React.useState({});
  const attachmentLocks = React.useRef(new Set());
  const dialog = React.useRef(null);
  const scroll = React.useRef(null);
  const post = detail?.key === key ? detail.post : selected;
  const label = sourceLabel || (source === "kemono" ? "Kemono" : "Pawchive");
  const content = React.useMemo(
    () => readableContent(post.content, post.url),
    [post.content, post.url],
  );
  const images = React.useMemo(
    () => postImages(post, content.images),
    [post, content],
  );
  const index = Math.min(imageIndex, Math.max(0, images.length - 1));
  const current = images[index];
  const files = [
    ...new Map(
      [post.file, ...(post.attachments || [])]
        .filter(
          (file) =>
            file &&
            !file.isImage &&
            !file.thumbnail &&
            !/\.(?:jpe?g|png|gif|webp|avif|bmp|apng|svg|ico|tiff?|heic|heif|jxl)(?:$|[?#])/i.test(
              file.path || file.name || "",
            ),
        )
        .map((file) => [file.path, file]),
    ).values(),
  ];
  async function downloadAttachment(file) {
    const stateKey = `${source}:${key}:${file.path}`;
    if (attachmentLocks.current.has(stateKey)) return;
    attachmentLocks.current.add(stateKey);
    setAttachmentState((state) => ({
      ...state,
      [stateKey]: {
        busy: true,
      },
    }));
    try {
      const result = await window.api.attachmentDownload({
        source,
        post: {
          service: post.service,
          user: post.user,
          id: post.id,
          gameId: post.gameId,
          url: post.url,
          topic: post.topic,
        },
        filePath: file.path,
      });
      if (result?.code === "VERIFY_REQUIRED")
        onAccessRequired?.(result, selected);
      if (!result?.success)
        throw new Error(
          result?.error || t("downloads.post.addAttachmentFailed"),
        );
      window.dispatchEvent(
        new CustomEvent("qaqm:download-task-queued", {
          detail: result.task,
        }),
      );
      window.dispatchEvent(new CustomEvent("qaqm:open-download-orb"));
      setAttachmentState((state) => ({
        ...state,
        [stateKey]: {
          message: t("downloads.post.queued"),
        },
      }));
    } catch (error) {
      setAttachmentState((state) => ({
        ...state,
        [stateKey]: {
          error: error.message || t("downloads.post.attachmentFailed"),
        },
      }));
    } finally {
      attachmentLocks.current.delete(stateKey);
    }
  }
  const related = posts.some((item) => postKey(item) === key)
    ? posts
    : [selected, ...posts];
  function moveImage(delta) {
    if (images.length > 1)
      setImageIndex((value) => (value + delta + images.length) % images.length);
  }
  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    const fetchPost = loadPost || window.api[source + "GetPost"];
    fetchPost(selected)
      .then((result) => {
        if (cancelled) return;
        if (result?.code === "VERIFY_REQUIRED")
          onAccessRequired?.(result, selected);
        if (!result?.success)
          throw new Error(result?.error || t("downloads.post.loadFailed"));
        if (!cancelled)
          setDetail({
            key,
            post: result.post,
          });
      })
      .catch((error) => {
        if (!cancelled) setError(error.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [key, source, retry, loadPost]);
  React.useEffect(() => {
    setImageIndex(0);
    scroll.current?.scrollTo(0, 0);
    dialog.current
      ?.querySelector('.paw-related-card[aria-current="true"]')
      ?.scrollIntoView({
        block: "nearest",
        inline: "nearest",
      });
  }, [key]);
  React.useEffect(() => {
    const previous = document.activeElement;
    dialog.current?.focus();
    return () => {
      if (previous?.isConnected) previous.focus?.();
    };
  }, []);
  React.useEffect(() => {
    function keyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (
        !event.target.closest?.("input, textarea, select") &&
        ["ArrowLeft", "ArrowRight"].includes(event.key)
      ) {
        event.preventDefault();
        moveImage(event.key === "ArrowLeft" ? -1 : 1);
      }
      if (event.key !== "Tab") return;
      const controls = [
        ...dialog.current.querySelectorAll(
          'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex="0"]',
        ),
      ].filter((node) => node.getClientRects().length);
      const first = controls[0],
        last = controls.at(-1);
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === dialog.current)
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          document.activeElement === dialog.current)
      ) {
        event.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener("keydown", keyDown);
    return () => document.removeEventListener("keydown", keyDown);
  }, [onClose, images.length]);
  return ReactDOM.createPortal(
    <div
      className="detail-overlay paw-modal-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="detail-layout paw-detail-layout"
        role="dialog"
        aria-modal={true}
        aria-labelledby="paw-post-title"
        tabIndex={-1}
        ref={dialog}
      >
        <nav
          className="detail-rail paw-related-sidebar"
          aria-label={t("downloads.post.quickSwitch")}
        >
          {related.map((item) => (
            <button
              type="button"
              key={postKey(item)}
              className={`detail-rail-item paw-related-card ${postKey(item) === key ? "active" : ""}`}
              aria-current={postKey(item) === key ? "true" : undefined}
              title={item.title}
              onClick={() => onSelect(item)}
            >
              <Image
                src={item.thumbnail}
                alt=""
                mediaSource={item.mediaSource}
                gameId={item.gameId}
              />
              <span>{item.title}</span>
            </button>
          ))}
        </nav>
        <div className="detail-main paw-modal">
          <div
            className="detail-gallery paw-gallery"
            aria-label={t("downloads.post.image")}
          >
            <div
              className={`detail-stage ${current ? "paw-gallery-image" : "detail-stage-empty"}`}
            >
              {current ? (
                <Image
                  key={current.url}
                  src={current.url}
                  fallback={current.thumbnail}
                  alt={current.name || post.title}
                  loading="eager"
                  mediaSource={post.mediaSource}
                  gameId={post.gameId}
                />
              ) : (
                <div className="paw-gallery-empty">
                  <Icon name="image" size={28} />
                  <p>
                    {loading
                      ? t("downloads.post.imageLoading")
                      : t("downloads.post.noImages")}
                  </p>
                </div>
              )}
              {images.length > 1 && (
                <React.Fragment>
                  <button
                    type="button"
                    className="image-btn detail-nav is-previous"
                    onClick={() => moveImage(-1)}
                    aria-label={t("downloads.post.previousImage")}
                  >
                    <Icon name="chevron-left" size={18} />
                  </button>
                  <button
                    type="button"
                    className="image-btn detail-nav is-next"
                    onClick={() => moveImage(1)}
                    aria-label={t("downloads.post.nextImage")}
                  >
                    <Icon name="chevron-right" size={18} />
                  </button>
                  <span
                    className="image-badge detail-counter paw-gallery-counter"
                    role="status"
                  >{`${index + 1} / ${images.length}`}</span>
                </React.Fragment>
              )}
              {current && (
                <button
                  type="button"
                  className="image-pill detail-original paw-gallery-original"
                  onClick={() => openExternal(current.url)}
                >
                  <Icon name="external" size={13} />
                  {t("downloads.post.viewImage")}
                </button>
              )}
            </div>
            {images.length > 1 && (
              <div
                className="detail-thumbs paw-gallery-thumbs"
                aria-label={t("native.dialog.selectImage")}
              >
                {images.map((item, i) => (
                  <button
                    type="button"
                    key={item.url}
                    aria-label={t("downloads.post.imageNumber", {
                      count: i + 1,
                    })}
                    aria-pressed={i === index}
                    onClick={() => setImageIndex(i)}
                  >
                    <Image
                      src={item.thumbnail || item.url}
                      alt=""
                      mediaSource={post.mediaSource}
                      gameId={post.gameId}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="detail-side paw-detail-right">
            <header className="detail-head">
              <div className="detail-head-top">
                <span className="detail-eyebrow paw-eyebrow">{label}</span>
                <button
                  type="button"
                  className="icon-btn icon-btn-sm"
                  onClick={onClose}
                  aria-label={t("downloads.post.closeDetails")}
                  title={t("downloads.post.closeDetails")}
                >
                  <Icon name="x" size={16} />
                </button>
              </div>
              <h2 className="detail-title" id="paw-post-title">
                {post.title}
              </h2>
              <div className="detail-meta paw-post-meta">
                {onAuthor ? (
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => {
                      onClose();
                      onAuthor(post.creator);
                    }}
                  >
                    {post.creator?.name || t("downloads.post.unknownAuthor")}
                  </button>
                ) : (
                  <span>
                    {post.creator?.name || t("downloads.post.unknownAuthor")}
                  </span>
                )}
                {post.service && <span>{post.service}</span>}
                <time>
                  {t("downloads.archive.publishedDate", {
                    date: date(post.published),
                  })}
                </time>
                <time>
                  {t("downloads.archive.editedDate", {
                    date: date(post.edited),
                  })}
                </time>
              </div>
            </header>
            <div className="detail-scroll paw-detail-scroll" ref={scroll}>
              {loading && (
                <p role="status" className="detail-loading">
                  <span className="spinner" aria-hidden={true} />
                  {t("downloads.post.loadingFullContent")}
                </p>
              )}
              {error && (
                <SourceError
                  title={t("downloads.post.loadFailed")}
                  message={error}
                  onRetry={() => setRetry((value) => value + 1)}
                />
              )}
              {post.previewOnly && (
                <p className="notice notice-info paw-notice">
                  <Icon name="info" size={14} />
                  <span>{t("downloads.post.previewOnlyHint")}</span>
                </p>
              )}
              <div className="detail-body-text paw-post-content selectable">
                {content.text || (loading ? "" : t("downloads.post.emptyBody"))}
              </div>
              {content.links.length > 0 && (
                <section className="detail-section paw-content-links">
                  <h3>{t("downloads.post.bodyLinks")}</h3>
                  {content.links.map((link, i) => (
                    <button
                      type="button"
                      key={i}
                      className="link-btn detail-link"
                      title={link.url}
                      onClick={() => openExternal(link.url)}
                    >
                      <span>{link.label}</span>
                      <Icon name="external" size={12} />
                    </button>
                  ))}
                </section>
              )}
              {files.length > 0 && (
                <section className="detail-section paw-files">
                  <h3>
                    {t("downloads.post.attachmentCount", {
                      filesCount: files.length,
                    })}
                  </h3>
                  {files.map((file) => {
                    const state =
                      attachmentState[`${source}:${key}:${file.path}`] || {};
                    return (
                      <div className="paw-file-row" key={file.path}>
                        <button
                          type="button"
                          className="paw-file"
                          disabled={state.busy || file.previewOnly}
                          onClick={() => downloadAttachment(file)}
                          title={
                            file.previewOnly
                              ? t("downloads.post.attachmentPreviewOnly")
                              : t("downloads.post.downloadWithManager")
                          }
                          data-file-path={file.path}
                        >
                          <Icon name="file" size={14} />
                          <span className="paw-file-name">
                            {file.name || t("downloads.post.unnamedAttachment")}
                            {state.busy
                              ? t("downloads.post.queuingSuffix")
                              : file.previewOnly
                                ? t("downloads.post.previewSuffix")
                                : ""}
                          </span>
                          {!state.busy && !file.previewOnly && (
                            <Icon name="download" size={14} />
                          )}
                        </button>
                        {state.error && (
                          <p className="notice notice-danger paw-alert" role="alert">
                            <Icon name="alert" size={14} />
                            <span>{state.error}</span>
                          </p>
                        )}
                        {state.message && (
                          <p className="notice notice-success paw-notice" role="status">
                            <Icon name="check" size={14} />
                            <span>{state.message}</span>
                          </p>
                        )}
                      </div>
                    );
                  })}
                </section>
              )}
            </div>
            <footer className="detail-foot paw-modal-footer">
              {favoriteButton?.(post.creator)}
              {selected.changeKind && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => onMarkRead(selected)}
                >
                  {t("downloads.post.readBadge")}
                </button>
              )}
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => openExternal(post.url)}
              >
                <Icon name="external" size={14} />
                {t("downloads.post.openOriginal")}
              </button>
              {Download && !!post.megaLinks?.length && (
                <Download
                  key={key + post.megaLinks.map((link) => link.url).join("|")}
                  links={post.megaLinks}
                  name={post.title}
                />
              )}
            </footer>
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}
export { readableContent, postImages, Image, PostDialog as default };
