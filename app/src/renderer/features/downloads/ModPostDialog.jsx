import { t } from "../../../shared/i18n/index.mjs";
import React from "react";
import ReactDOM from "react-dom";
const h = React.createElement;
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
      {avatar ? "🐾" : "▧"}
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
      className="paw-modal-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="paw-detail-layout"
        role="dialog"
        aria-modal={true}
        aria-labelledby="paw-post-title"
        tabIndex={-1}
        ref={dialog}
      >
        {h(
          "nav",
          {
            className: "paw-related-sidebar",
            "aria-label": t("downloads.post.quickSwitch"),
          },
          ...related.map((item) => (
            <button
              key={postKey(item)}
              className="paw-related-card"
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
          )),
        )}
        <div className="paw-modal">
          <div className="paw-gallery" aria-label={t("downloads.post.image")}>
            {current && !post.mediaSource && (
              <div
                className="paw-gallery-backdrop"
                style={{
                  backgroundImage: `url(${JSON.stringify(current.thumbnail || current.url)})`,
                }}
                aria-hidden={true}
              />
            )}
            {current ? (
              <div className="paw-gallery-image">
                <Image
                  key={current.url}
                  src={current.url}
                  fallback={current.thumbnail}
                  alt={current.name || post.title}
                  loading="eager"
                  mediaSource={post.mediaSource}
                  gameId={post.gameId}
                />
              </div>
            ) : (
              <div className="paw-gallery-empty">
                <span>{"▧"}</span>
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
                  className="paw-gallery-nav previous"
                  onClick={() => moveImage(-1)}
                  aria-label={t("downloads.post.previousImage")}
                >
                  {"‹"}
                </button>
                <button
                  className="paw-gallery-nav next"
                  onClick={() => moveImage(1)}
                  aria-label={t("downloads.post.nextImage")}
                >
                  {"›"}
                </button>
                <span
                  className="paw-gallery-counter"
                  role="status"
                >{`${index + 1} / ${images.length}`}</span>
                {h(
                  "div",
                  {
                    className: "paw-gallery-thumbs",
                    "aria-label": t("native.dialog.selectImage"),
                  },
                  ...images.map((item, i) => (
                    <button
                      key={item.url}
                      className={i === index ? "active" : ""}
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
                  )),
                )}
              </React.Fragment>
            )}
            {current && (
              <button
                className="paw-gallery-original"
                onClick={() => openExternal(current.url)}
              >
                {t("downloads.post.viewImage")}
              </button>
            )}
          </div>
          <div className="paw-detail-right">
            <header className="paw-detail-header">
              <div className="paw-modal-heading">
                <span className="paw-eyebrow">
                  {t("downloads.post.detailHeading", {
                    toUpperCase: label.toUpperCase(),
                  })}
                </span>
                <button
                  className="paw-icon-button"
                  onClick={onClose}
                  aria-label={t("downloads.post.closeDetails")}
                >
                  {"✕"}
                </button>
              </div>
              <h2 id="paw-post-title">{post.title}</h2>
              <div className="paw-post-meta">
                {onAuthor ? (
                  <button
                    className="paw-text-button"
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
                <span className="paw-service">{post.service}</span>
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
            <div className="paw-detail-scroll" ref={scroll}>
              {loading && (
                <p role="status" className="paw-muted">
                  {t("downloads.post.loadingFullContent")}
                </p>
              )}
              {error && (
                <div role="alert" className="paw-alert">
                  {error}
                  <button
                    className="paw-button"
                    onClick={() => setRetry((value) => value + 1)}
                  >
                    {t("common.actions.retry")}
                  </button>
                </div>
              )}
              {post.previewOnly && (
                <p className="paw-notice">
                  {t("downloads.post.previewOnlyHint")}
                </p>
              )}
              <div className="paw-post-content">
                {content.text || (loading ? "" : t("downloads.post.emptyBody"))}
              </div>
              {content.links.length > 0 &&
                h(
                  "div",
                  {
                    className: "paw-content-links",
                  },
                  <h3>{t("downloads.post.bodyLinks")}</h3>,
                  ...content.links.map((link, i) => (
                    <button
                      key={i}
                      className="paw-text-button"
                      title={link.url}
                      onClick={() => openExternal(link.url)}
                    >
                      {link.label}
                      {" ↗"}
                    </button>
                  )),
                )}
              {files.length > 0 &&
                h(
                  "div",
                  {
                    className: "paw-files",
                  },
                  <h3>
                    {t("downloads.post.attachmentCount", {
                      filesCount: files.length,
                    })}
                  </h3>,
                  ...files.map((file) => {
                    const state =
                      attachmentState[`${source}:${key}:${file.path}`] || {};
                    return (
                      <div key={file.path}>
                        <button
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
                          {"📎 "}
                          {file.name || t("downloads.post.unnamedAttachment")}
                          {state.busy
                            ? t("downloads.post.queuingSuffix")
                            : file.previewOnly
                              ? t("downloads.post.previewSuffix")
                              : " ↓"}
                        </button>
                        {state.error && (
                          <p className="paw-alert" role="alert">
                            {state.error}
                          </p>
                        )}
                        {state.message && (
                          <p className="paw-notice" role="status">
                            {state.message}
                          </p>
                        )}
                      </div>
                    );
                  }),
                )}
            </div>
            <footer className="paw-modal-footer">
              {favoriteButton?.(post.creator)}
              {selected.changeKind && (
                <button
                  className="paw-button"
                  onClick={() => onMarkRead(selected)}
                >
                  {t("downloads.post.readBadge")}
                </button>
              )}
              <button
                className="paw-button"
                onClick={() => openExternal(post.url)}
              >
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
