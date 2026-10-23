import { t } from "../../../shared/i18n/index.mjs";
import React from "react";
import PostDialog, { Image } from "./ModPostDialog.jsx";
import { RevivalDownload } from "./PawchiveView.jsx";
const h = React.createElement;
const button = (label, onClick, props = {}) => (
  <button type="button" className="paw-button" onClick={onClick} {...props}>
    {label}
  </button>
);
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
        y = Math.max(36, rect.top);
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
          ".mod-download-source-menu, .game-selector-menu, .qaqm-download-panel, .modal-backdrop",
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
        <div>
          <strong>{t("downloads.site.verifyOrLogin")}</strong>
          <p className="paw-muted">
            {host || t("downloads.site.loading")}
            {status === 403 ? t("downloads.site.forbiddenHint") : ""}
          </p>
        </div>
        <div className="mod-site-actions">
          {button(t("downloads.site.refreshVerification"), () =>
            window.api.modSiteReload({
              source,
              token: token.current,
            }),
          )}
          {button(
            finishing
              ? t("downloads.site.confirming")
              : t("downloads.site.finishVerification"),
            finish,
            {
              className: "paw-button paw-primary",
              disabled: finishing,
            },
          )}
          {button(t("common.actions.cancel"), onCancel)}
        </div>
      </div>
      {error && (
        <p className="paw-alert" role="alert">
          {error}
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
function ModSiteView({ source, gameId, isActive }) {
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
      className="pawchive-view mod-site-view"
      aria-label={site?.label || t("downloads.site.source")}
    >
      <header className="mod-site-toolbar">
        <h2>
          {site
            ? `${site.label} · ${site.gameName}`
            : t("downloads.site.loadingSource")}
        </h2>
        <div className="mod-site-actions">
          {button(
            t("common.actions.refresh"),
            () => {
              setVerificationCancelled(false);
              setRevision((value) => value + 1);
            },
            {
              disabled: !!verification || loading,
            },
          )}
          {button(t("downloads.site.account"), () => setAccount(!account), {
            "aria-expanded": account,
          })}
          {button(t("downloads.site.sectionSettings"), () => {
            setUrl(site?.url || "");
            setEditing(!editing);
          })}
        </div>
      </header>
      {account && (
        <div className="mod-site-account">
          <span>
            {state?.hasSession
              ? t("downloads.site.sessionSaved")
              : t("downloads.site.noSession")}
          </span>
          {button(t("downloads.site.loginOrVerify"), () => {
            setVerification({
              url: site?.url || "",
              post: null,
            });
            setSelected(null);
          })}
          {button(t("downloads.site.clearSession"), () => setClearing(true))}
        </div>
      )}
      {clearing && (
        <div className="paw-notice">
          <p>{t("downloads.site.clearSessionConfirm")}</p>
          {button(t("common.actions.confirmClear"), clearSession, {
            disabled: busy,
          })}{" "}
          {button(t("common.actions.cancel"), () => setClearing(false))}
        </div>
      )}
      {editing && (
        <form
          className="mod-site-section-form"
          onSubmit={(event) => {
            event.preventDefault();
            configure(url);
          }}
        >
          <label>
            {t("downloads.site.gameSectionUrl")}
            <input
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              maxLength={2000}
              required={true}
            />
          </label>
          <div className="mod-site-actions">
            <button className="paw-button" disabled={busy}>
              {t("downloads.site.saveSection")}
            </button>
            {button(t("common.actions.restoreDefault"), () => configure(""), {
              disabled: busy,
            })}
          </div>
        </form>
      )}
      {state?.warning && <p className="paw-alert">{state.warning}</p>}
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
          {source === "loverslab" && !!site?.extra?.length && (
            <div className="paw-toolbar">
              <label>
                {t("downloads.site.topicPrefix")}
                {h(
                  "select",
                  {
                    value: topic || site.url,
                    onChange: (event) => {
                      setTopic(event.target.value);
                      setPage(1);
                      setCursors([""]);
                    },
                  },
                  <option value={site.url}>
                    {t("downloads.site.primaryTopics")}
                  </option>,
                  ...site.extra.map((item) => (
                    <option key={item.url} value={item.url}>
                      {item.label}
                    </option>
                  )),
                )}
              </label>
            </div>
          )}
          <form className="paw-toolbar mod-site-search" onSubmit={search}>
            <input
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
            <button className="paw-button" disabled={loading}>
              {t("common.actions.search")}
            </button>
            {result && (
              <span className="paw-muted">
                {t("downloads.site.pageSummary", {
                  page,
                  itemsCount: result.items.length,
                  status: pageSearch ? t("downloads.site.pageSearchHint") : "",
                })}
              </span>
            )}
          </form>
          {error ? (
            <div className="paw-empty" role="alert">
              <h2>
                {error.code === "VERIFY_REQUIRED"
                  ? t("downloads.site.loginRequired")
                  : t("downloads.site.parseFailed")}
              </h2>
              <p>{error.error || t("common.errors.unknown")}</p>
              {button(
                t("common.actions.reload"),
                () => {
                  setVerificationCancelled(false);
                  setRevision((value) => value + 1);
                },
                {
                  className: "paw-button paw-primary",
                },
              )}
            </div>
          ) : loading ? (
            h(
              "div",
              {
                className: "paw-grid",
                "aria-busy": true,
              },
              ...Array.from(
                {
                  length: 8,
                },
                (_, key) => (
                  <div className="paw-skeleton" key={key}>
                    <div />
                    <span />
                    <span />
                  </div>
                ),
              ),
            )
          ) : result && !result.items.length ? (
            <div className="paw-empty">
              <h2>{t("downloads.site.noMatches")}</h2>
            </div>
          ) : (
            h(
              "div",
              {
                className: "paw-grid",
              },
              ...(result?.items || []).map((post) => (
                <article
                  className="paw-post-card"
                  key={post.id}
                  tabIndex={0}
                  role="button"
                  onClick={() => setSelected(post)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelected(post);
                    }
                  }}
                >
                  <div className="paw-card-image">
                    <Image
                      src={post.thumbnail}
                      alt={post.title}
                      mediaSource={source}
                      gameId={gameId}
                    />
                    <span className="paw-image-service">{site?.label}</span>
                  </div>
                  <div className="paw-card-body">
                    <button
                      className="paw-post-title"
                      type="button"
                      title={post.title}
                    >
                      {post.title}
                    </button>
                    <span className="paw-card-author">{post.creator.name}</span>
                    <div className="paw-post-stats">
                      {post.published
                        ? new Date(post.published).toLocaleDateString("zh-CN")
                        : t("common.actions.viewDetails")}
                    </div>
                    <div className="paw-card-actions">
                      <button className="paw-button" type="button">
                        {t("downloads.site.detailsLink")}
                      </button>
                    </div>
                  </div>
                </article>
              )),
            )
          )}
          {result && !loading && (
            <div className="paw-pagination">
              {button(
                t("common.actions.previousPage"),
                () => setPage((value) => value - 1),
                {
                  disabled: page <= 1,
                },
              )}
              {button(t("common.actions.nextPage"), next, {
                disabled: !result.hasMore,
              })}
            </div>
          )}
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
