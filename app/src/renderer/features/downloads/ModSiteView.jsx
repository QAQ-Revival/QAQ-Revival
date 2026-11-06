import { t } from "../../../shared/i18n/index.mjs";
import React from "react";
import ReactDOM from "react-dom";
import { Icon } from "../../components/Icon.jsx";
import { Menu, MenuItem } from "../../components/Menu.jsx";
import PostDialog, { Image } from "./ModPostDialog.jsx";
import { RevivalDownload } from "./PawchiveView.jsx";
import { SkeletonGrid, SourceError } from "./SourceStates.jsx";
function EmbeddedVerification({ source, gameId, url, onFinish, onCancel }) {
  const viewport = React.useRef(null),
    token = React.useRef(crypto.randomUUID());
  const [error, setError] = React.useState(""),
    [host, setHost] = React.useState(""),
    [status, setStatus] = React.useState(0);
  const [finishing, setFinishing] = React.useState(false);
  React.useEffect(() => {
    let disposed = false,
      opened = false,
      frame,
      last = "";
    const identity = {
      source,
      gameId,
      token: token.current,
    };
    function geometry() {
      const rect = viewport.current.getBoundingClientRect();
      const x = Math.max(0, rect.left),
        y = Math.max(
          document.querySelector(".app-topbar")?.getBoundingClientRect().bottom ||
            0,
          rect.top,
        );
      return {
        x,
        y,
        width: Math.max(0, Math.min(window.innerWidth, rect.right) - x),
        height: Math.max(0, Math.min(window.innerHeight, rect.bottom) - y),
      };
    }
    function update() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (disposed || !opened) return;
        const visible = !document.querySelector(
          ".menu:not([hidden]), .game-selector-menu, .qaqm-download-panel, .modal-backdrop",
        );
        const bounds = geometry(),
          serialized = JSON.stringify({
            visible,
            bounds,
          });
        if (serialized === last) return;
        last = serialized;
        window.api.modSiteResize({
          ...identity,
          bounds,
          visible,
        });
      });
    }
    window.api
      .modSiteOpen({
        ...identity,
        url,
        bounds: geometry(),
      })
      .then((result) => {
        if (disposed) {
          window.api.modSiteHide(identity);
          return;
        }
        if (!result.success) {
          setError(result.error);
          return;
        }
        opened = true;
        setHost(result.host);
        update();
      })
      .catch((error) => {
        if (!disposed) setError(error.message);
      });
    const resize = new ResizeObserver(update);
    resize.observe(viewport.current);
    const mutations = new MutationObserver(update);
    mutations.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "hidden"],
    });
    document.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    const unsubscribe = window.api.onModSiteChanged((value) => {
      if (value.source !== source) return;
      if (value.host) setHost(value.host);
      if (value.status) setStatus(value.status);
      if (value.error) setError(value.error);
    });
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      mutations.disconnect();
      unsubscribe();
      document.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      window.api.modSiteHide(identity);
    };
  }, [source, gameId, url]);
  async function finish() {
    if (finishing) return;
    setFinishing(true);
    setError("");
    try {
      const result = await window.api.modSiteFinish({
        source,
        token: token.current,
      });
      if (!result?.success) {
        setError(result?.error || t("downloads.site.verificationIncomplete"));
        return;
      }
      onFinish();
    } catch (error) {
      setError(error.message);
    } finally {
      setFinishing(false);
    }
  }
  return (
    <section
      className="mod-site-verification"
      aria-label={t("downloads.site.inlineVerification")}
    >
      <div className="mod-site-verification-header">
        <div className="mod-site-verification-copy">
          <strong>{t("downloads.site.verifyOrLogin")}</strong>
          <span className="toolbar-label">
            {host || t("downloads.site.loading")}
            {status === 403 ? t("downloads.site.forbiddenHint") : ""}
          </span>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            {t("common.actions.cancel")}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() =>
              window.api.modSiteReload({
                source,
                token: token.current,
              })
            }
          >
            {t("downloads.site.refreshVerification")}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={finishing}
            onClick={finish}
          >
            {finishing
              ? t("downloads.site.confirming")
              : t("downloads.site.finishVerification")}
          </button>
        </div>
      </div>
      {error && (
        <p className="notice notice-danger" role="alert">
          <Icon name="alert" size={14} />
          <span>{error}</span>
        </p>
      )}
      <div
        ref={viewport}
        className="mod-site-verification-viewport"
        aria-label={t("downloads.site.embeddedPage")}
      />
    </section>
  );
}
function ModSiteView({ source, gameId, isActive, sourceTabs }) {
  const [state, setState] = React.useState(null),
    [result, setResult] = React.useState(null),
    [error, setError] = React.useState(null);
  const [loading, setLoading] = React.useState(false),
    [revision, setRevision] = React.useState(0);
  const [input, setInput] = React.useState(""),
    [query, setQuery] = React.useState(""),
    [page, setPage] = React.useState(1),
    [cursors, setCursors] = React.useState([""]);
  const [topic, setTopic] = React.useState(""),
    [selected, setSelected] = React.useState(null),
    [verification, setVerification] = React.useState(null);
  const [account, setAccount] = React.useState(false),
    [clearing, setClearing] = React.useState(false),
    [editing, setEditing] = React.useState(false),
    [url, setUrl] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [verificationCancelled, setVerificationCancelled] =
    React.useState(false);
  const site = state?.site,
    pageSearch = ["keke", "loverslab"].includes(source);
  React.useEffect(() => {
    let cancelled = false;
    window.api
      .modSiteDescribe({
        source,
        gameId,
      })
      .then((value) => {
        if (!cancelled) {
          if (value.success) setState(value);
          else setError(value);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [source, gameId, revision]);
  const requireAccess = React.useCallback((value, post = null) => {
    setError(value);
    setSelected(null);
    setVerification({
      url: value.verifyUrl || post?.url || "",
      post,
    });
  }, []);
  React.useEffect(() => {
    if (!isActive || !site || verification || verificationCancelled) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setResult(null);
    window.api
      .modSiteList({
        source,
        gameId,
        query,
        page,
        cursor: cursors[page - 1] || "",
        topic,
      })
      .then((value) => {
        if (cancelled) return;
        if (!value.success) {
          setError(value);
          if (value.code === "VERIFY_REQUIRED") requireAccess(value);
        } else setResult(value);
      })
      .catch((error) => {
        if (!cancelled)
          setError({
            error: error.message,
          });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    source,
    gameId,
    isActive,
    !!site,
    revision,
    query,
    page,
    topic,
    verification,
    verificationCancelled,
  ]);
  const loadPost = React.useCallback(
    (post) =>
      window.api.modSiteGetPost({
        source,
        gameId,
        id: post.id,
        url: post.url,
        topic,
      }),
    [source, gameId, topic],
  );
  function openLink(target) {
    setVerification({
      url: target,
      post: selected,
    });
    setSelected(null);
  }
  function finishVerification() {
    const post = verification?.post;
    setVerificationCancelled(false);
    setVerification(null);
    setError(null);
    setRevision((value) => value + 1);
    if (post) setSelected(post);
  }
  async function configure(value) {
    setBusy(true);
    try {
      const response = await window.api.modSiteConfigure({
        source,
        gameId,
        url: value,
      });
      if (!response.success) throw Error(response.error);
      setState(response);
      setEditing(false);
      setPage(1);
      setCursors([""]);
      setRevision((value) => value + 1);
    } catch (error) {
      setError({
        error: error.message,
      });
    } finally {
      setBusy(false);
    }
  }
  async function clearSession() {
    setBusy(true);
    try {
      const response = await window.api.modSiteClear({
        source,
        gameId,
      });
      if (!response.success) throw Error(response.error);
      setVerification(null);
      setVerificationCancelled(false);
      setState(response);
      setClearing(false);
      setRevision((value) => value + 1);
    } catch (error) {
      setError({
        error: error.message,
      });
    } finally {
      setBusy(false);
    }
  }
  function search(event) {
    event.preventDefault();
    setQuery(input.trim());
    setPage(1);
    setCursors([""]);
    setRevision((value) => value + 1);
  }
  function next() {
    setCursors((values) => [...values.slice(0, page), result.nextUrl || ""]);
    setPage((value) => value + 1);
  }
  return (
    <section
      className="page pawchive-view mod-site-view"
      aria-label={site?.label || t("downloads.site.source")}
    >
      <header className="page-header mod-site-toolbar">
        <h2 className="sr-only">
          {site ? `${site.label} · ${site.gameName}` : t("downloads.site.source")}
        </h2>
        {sourceTabs}
        <div className="page-actions">
          <button
            type="button"
            className="btn"
            disabled={!!verification || loading}
            onClick={() => {
              setVerificationCancelled(false);
              setRevision((value) => value + 1);
            }}
          >
            {t("common.actions.refresh")}
          </button>
          <Menu
            label={t("common.actions.more")}
            trigger={({ props }) => (
              <button
                type="button"
                className="icon-btn"
                title={t("common.actions.more")}
                aria-label={t("common.actions.more")}
                {...props}
              >
                <Icon name="more" size={18} />
              </button>
            )}
          >
            <div className="menu-label">
              {state?.hasSession
                ? t("downloads.site.sessionSaved")
                : t("downloads.site.noSession")}
            </div>
            <MenuItem
              icon={<Icon name="user" size={15} />}
              onClick={() => {
                setVerification({
                  url: site?.url || "",
                  post: null,
                });
                setSelected(null);
              }}
            >
              {t("downloads.site.loginOrVerify")}
            </MenuItem>
            <MenuItem
              icon={<Icon name="link" size={15} />}
              onClick={() => {
                setUrl(site?.url || "");
                setEditing(true);
              }}
            >
              {t("downloads.site.sectionSettings")}
            </MenuItem>
            <div className="menu-sep" />
            <MenuItem
              danger={true}
              icon={<Icon name="trash" size={15} />}
              onClick={() => setClearing(true)}
            >
              {t("downloads.site.clearSession")}
            </MenuItem>
          </Menu>
        </div>
      </header>
      {clearing &&
        ReactDOM.createPortal(
          <div className="modal-backdrop" onClick={() => setClearing(false)}>
            <div
              className="modal-content"
              role="dialog"
              aria-modal={true}
              aria-label={t("downloads.site.clearSession")}
              onClick={(event) => event.stopPropagation()}
            >
              <h3 className="dialog-title">{t("downloads.site.clearSession")}</h3>
              <p className="dialog-desc">
                {t("downloads.site.clearSessionConfirm")}
              </p>
              <div className="dialog-actions">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setClearing(false)}
                >
                  {t("common.actions.cancel")}
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={busy}
                  onClick={clearSession}
                >
                  {t("common.actions.confirmClear")}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
      {editing &&
        ReactDOM.createPortal(
          <div className="modal-backdrop" onClick={() => setEditing(false)}>
            <form
              className="modal-content"
              role="dialog"
              aria-modal={true}
              aria-label={t("downloads.site.sectionSettings")}
              onClick={(event) => event.stopPropagation()}
              onSubmit={(event) => {
                event.preventDefault();
                configure(url);
              }}
            >
              <h3 className="dialog-title">
                {t("downloads.site.sectionSettings")}
              </h3>
              <label className="feedback-field dialog-body">
                <span>{t("downloads.site.gameSectionUrl")}</span>
                <input
                  className="input"
                  type="url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  maxLength={2000}
                  required={true}
                />
              </label>
              <div className="dialog-actions">
                <button
                  type="button"
                  className="btn btn-ghost feedback-cancel"
                  disabled={busy}
                  onClick={() => configure("")}
                >
                  {t("common.actions.restoreDefault")}
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setEditing(false)}
                >
                  {t("common.actions.cancel")}
                </button>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {t("downloads.site.saveSection")}
                </button>
              </div>
            </form>
          </div>,
          document.body,
        )}
      {state?.warning && (
        <div className="source-panel-notice">
          <p className="notice notice-warning paw-alert">
            <Icon name="alert" size={14} />
            <span>{state.warning}</span>
          </p>
        </div>
      )}
      {isActive && verification ? (
        <EmbeddedVerification
          key={verification.url}
          source={source}
          gameId={gameId}
          url={verification.url}
          onFinish={finishVerification}
          onCancel={() => {
            setVerificationCancelled(true);
            setVerification(null);
            setLoading(false);
            setError({
              error: t("downloads.site.verificationCanceled"),
            });
          }}
        />
      ) : (
        <React.Fragment>
          <form
            className="source-toolbar paw-toolbar mod-site-search"
            onSubmit={search}
          >
            {source === "loverslab" && !!site?.extra?.length && (
              <select
                className="select"
                aria-label={t("downloads.site.topic")}
                value={topic || site.url}
                onChange={(event) => {
                  setTopic(event.target.value);
                  setPage(1);
                  setCursors([""]);
                }}
              >
                <option value={site.url}>
                  {t("downloads.site.primaryTopics")}
                </option>
                {site.extra.map((item) => (
                  <option key={item.url} value={item.url}>
                    {item.label}
                  </option>
                ))}
              </select>
            )}
            <div className="search-field paw-search">
              <Icon name="search" size={15} />
              <input
                type="search"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                maxLength={100}
                placeholder={
                  pageSearch
                    ? t("downloads.site.filterPage")
                    : t("downloads.site.searchCurrentGame")
                }
                aria-label={t("market.search.placeholder")}
              />
            </div>
            {!!result?.items.length && (
              <span className="toolbar-label paw-result-count">
                {t("downloads.site.pageSummary", {
                  page,
                  itemsCount: result.items.length,
                })}
              </span>
            )}
          </form>
          <div className="page-body source-panel">
            {error ? (
              <SourceError
                title={
                  error.code === "VERIFY_REQUIRED"
                    ? t("downloads.site.loginRequired")
                    : t("downloads.site.parseFailed")
                }
                message={error.error}
                retryLabel={t("common.actions.reload")}
                onRetry={() => {
                  setVerificationCancelled(false);
                  setRevision((value) => value + 1);
                }}
              />
            ) : loading || !result ? (
              <SkeletonGrid />
            ) : !result.items.length ? (
              <div className="empty-state">
                <div className="empty-face">{"QAQ"}</div>
                <div className="empty-title">
                  {t("downloads.site.noMatches")}
                </div>
              </div>
            ) : (
              <div className="media-grid paw-grid">
                {result.items.map((post) => (
                  <article
                    className="media-card paw-post-card"
                    key={post.id}
                    tabIndex={0}
                    role="button"
                    aria-label={post.title}
                    onClick={() => setSelected(post)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelected(post);
                      }
                    }}
                  >
                    <div className="media-card-image paw-card-image">
                      <Image
                        src={post.thumbnail}
                        alt={post.title}
                        mediaSource={source}
                        gameId={gameId}
                      />
                    </div>
                    <div className="media-card-body">
                      <h3
                        className="media-card-title paw-post-title"
                        title={post.title}
                      >
                        {post.title}
                      </h3>
                      <div className="media-card-meta">
                        <span className="paw-card-author">
                          {post.creator.name}
                        </span>
                        {post.published && (
                          <time className="paw-post-stats">
                            {new Date(post.published).toLocaleDateString(
                              "zh-CN",
                            )}
                          </time>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
            {result && !loading && (page > 1 || result.hasMore) && (
              <div className="paw-pagination">
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={page <= 1}
                  onClick={() => setPage((value) => value - 1)}
                >
                  {t("common.actions.previousPage")}
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={!result.hasMore}
                  onClick={next}
                >
                  {t("common.actions.nextPage")}
                </button>
              </div>
            )}
          </div>
        </React.Fragment>
      )}
      {isActive && selected && !verification && (
        <PostDialog
          selected={selected}
          posts={result?.items || []}
          source={source}
          sourceLabel={site?.label}
          onSelect={setSelected}
          onClose={() => setSelected(null)}
          openExternal={openLink}
          loadPost={loadPost}
          onAccessRequired={requireAccess}
          Download={RevivalDownload}
        />
      )}
    </section>
  );
}
export { ModSiteView as default };
