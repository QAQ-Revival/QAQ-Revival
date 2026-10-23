import { t } from "../../../shared/i18n/index.mjs";
import React from "react";
import PostDialog, { Image } from "./ModPostDialog.jsx";
const h = React.createElement;
const authorKey = (author) => `${author.service}:${author.id}`;
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
const number = (value) =>
  new Intl.NumberFormat("zh-CN", {
    notation: "compact",
  }).format(value || 0);
async function call(method, payload) {
  const result = await window.api[method](payload);
  if (!result?.success)
    throw new Error(result?.error || t("common.errors.operationFailed"));
  return result;
}
function RevivalDownload({ links, name }) {
  const [expanded, setExpanded] = React.useState(false);
  const [selected, setSelected] = React.useState(() =>
    links.map((link) => link.url),
  );
  const [keys, setKeys] = React.useState({});
  const [passwords, setPasswords] = React.useState({});
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");
  const lock = React.useRef(false);
  async function send() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await call("megaRevivalDownload", {
        links: selected.map((url) => ({
          url,
          key: keys[url] || "",
          password: passwords[url] || "",
        })),
        name,
      });
      setPasswords({});
      setMessage(
        t("downloads.archive.tasksAdded", {
          count: result.count,
        }),
      );
      window.dispatchEvent(new CustomEvent("qaqm:open-download-orb"));
    } catch (error) {
      setError(error.message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="paw-mega-download">
      {expanded &&
        h(
          "div",
          {
            className: "paw-mega-selection",
          },
          <h3>{t("downloads.archive.chooseMegaLinks")}</h3>,
          ...links.map((link, index) => (
            <div className="paw-mega-link" key={link.url}>
              <label>
                <input
                  type="checkbox"
                  checked={selected.includes(link.url)}
                  disabled={busy}
                  onChange={(event) =>
                    setSelected((values) =>
                      event.target.checked
                        ? [...values, link.url]
                        : values.filter((value) => value !== link.url),
                    )
                  }
                />
                {`${link.needsPassword ? t("downloads.archive.passwordProtected") : link.type === "folder" ? t("downloads.archive.folderLink") : link.type === "encrypted" ? t("downloads.archive.encryptedShare") : t("downloads.archive.fileLink")} ${index + 1}`}
                {link.id ? ` · ${link.id}` : ""}
              </label>
              {link.needsPassword && (
                <input
                  type="password"
                  placeholder={t("downloads.archive.passwordPlaceholder")}
                  autoComplete="off"
                  value={passwords[link.url] || ""}
                  aria-label={t("downloads.archive.linkPassword", {
                    count: index + 1,
                  })}
                  onChange={(event) =>
                    setPasswords((value) => ({
                      ...value,
                      [link.url]: event.target.value,
                    }))
                  }
                  disabled={busy}
                  maxLength={1024}
                />
              )}
              {link.needsKey && (
                <input
                  type="text"
                  placeholder={t("downloads.archive.keyPlaceholder")}
                  value={keys[link.url] || ""}
                  aria-label={t("downloads.archive.linkKey", {
                    count: index + 1,
                  })}
                  onChange={(event) =>
                    setKeys((value) => ({
                      ...value,
                      [link.url]: event.target.value,
                    }))
                  }
                  disabled={busy}
                  maxLength={43}
                />
              )}
            </div>
          )),
          <p className="paw-muted">
            {t("downloads.archive.saveLocationHint")}
          </p>,
        )}
      {error && (
        <p className="paw-alert" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="paw-notice" role="status">
          {message}
        </p>
      )}
      <button
        className="paw-button paw-primary paw-download-button"
        disabled={busy || (expanded && !selected.length)}
        onClick={() => {
          if (
            !expanded &&
            (links.length > 1 ||
              links.some((link) => link.needsKey || link.needsPassword))
          )
            setExpanded(true);
          else send();
        }}
      >
        {busy
          ? t("common.status.opening")
          : expanded
            ? t("downloads.archive.downloadSelected", {
                selectedCount: selected.length,
              })
            : t("common.actions.download")}
      </button>
    </div>
  );
}
function PawchiveView({ isActive = true, source = "pawchive" }) {
  const label = source === "kemono" ? "Kemono" : "Pawchive";
  const site =
    source === "kemono" ? "https://kemono.cr" : "https://pawchive.pw";
  const sourceCall = React.useCallback(
    (method, payload) => call(source + method, payload),
    [source],
  );
  const [view, setView] = React.useState("updates");
  const [creator, setCreator] = React.useState(null);
  const [authorTabs, setAuthorTabs] = React.useState([]);
  const [input, setInput] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [service, setService] = React.useState("");
  const [sort, setSort] = React.useState("updated");
  const [offset, setOffset] = React.useState(0);
  const [result, setResult] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [actionError, setActionError] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const [saved, setSaved] = React.useState({
    favorites: [],
    updateCount: 0,
    postUpdateCount: 0,
    lastCheckedAt: 0,
  });
  const [stateReady, setStateReady] = React.useState(false);
  const [checking, setChecking] = React.useState(false);
  const [busy, setBusy] = React.useState({});
  const [refresh, setRefresh] = React.useState(0);
  const [selected, setSelected] = React.useState(null);
  const [progress, setProgress] = React.useState(null);
  const request = React.useRef(0);
  const checkLock = React.useRef(false);
  const favoriteLocks = React.useRef(new Set());
  const forceRefresh = React.useRef(false);
  const pageStates = React.useRef(new Map());
  const lastFixedView = React.useRef("updates");
  const stateVersion = React.useRef(0);
  const observedCheck = React.useRef(false);
  const section = React.useRef(null);
  const favorites = React.useMemo(
    () => new Map(saved.favorites.map((item) => [authorKey(item), item])),
    [saved],
  );
  const postsMode = view === "posts" || !!creator;
  const updatesMode = view === "updates" && !creator;
  const contentMode = postsMode || updatesMode;
  const activeTab = creator ? "author:" + authorKey(creator) : view;
  const tabId = (key) => source + "-tab-" + encodeURIComponent(key);
  const panelId = source + "-page-content";
  const isChecking = checking || saved.checking;
  React.useEffect(
    () => window.api["on" + label + "Progress"](setProgress),
    [source],
  );
  React.useEffect(
    () =>
      window.api["on" + label + "StateChanged"]((value) => {
        stateVersion.current++;
        if (value.error) {
          setActionError(value.error);
          return;
        }
        const finished = observedCheck.current && !value.checking;
        observedCheck.current = !!value.checking;
        setSaved(value);
        setStateReady(true);
        if (!value.checking) setProgress(null);
        if (finished) setRefresh((tick) => tick + 1);
      }),
    [source],
  );
  React.useEffect(() => {
    if (!isActive) return;
    const tab = document.getElementById(tabId(activeTab));
    const strip = tab?.closest(".paw-author-tabs");
    if (!strip || !tab) return;
    function reveal() {
      const tabRect = tab.parentElement.getBoundingClientRect(),
        stripRect = strip.getBoundingClientRect();
      if (tabRect.left < stripRect.left)
        strip.scrollLeft += tabRect.left - stripRect.left;
      else if (tabRect.right > stripRect.right)
        strip.scrollLeft += tabRect.right - stripRect.right;
    }
    reveal();
    const observer = new ResizeObserver(reveal);
    observer.observe(strip);
    return () => observer.disconnect();
  }, [activeTab, isActive, authorTabs]);
  React.useEffect(() => {
    let cancelled = false;
    const version = stateVersion.current;
    sourceCall("GetState")
      .then((value) => {
        if (!cancelled && version === stateVersion.current) {
          setSaved(value);
          setStateReady(true);
          observedCheck.current = !!value.checking;
        }
      })
      .catch((error) => {
        if (!cancelled) setActionError(error.message);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);
  React.useEffect(() => {
    const current = ++request.current;
    setLoading(true);
    setError("");
    setResult(null);
    const options = {
      query,
      offset,
      service,
      sort,
      creator,
      favoritesOnly: view === "favorites" || view === "updates",
      unreadOnly: view === "updates",
      force: forceRefresh.current,
    };
    forceRefresh.current = false;
    sourceCall(
      updatesMode ? "GetUpdates" : postsMode ? "ListPosts" : "ListCreators",
      options,
    )
      .then((value) => {
        if (request.current !== current) return;
        setResult(value);
        if (value.offset !== offset) setOffset(value.offset);
      })
      .catch((error) => {
        if (request.current === current) setError(error.message);
      })
      .finally(() => {
        if (request.current === current) setLoading(false);
      });
    return () => {
      request.current++;
    };
  }, [
    view,
    creator,
    query,
    service,
    sort,
    offset,
    refresh,
    postsMode,
    updatesMode,
  ]);
  function switchPage(nextView, nextCreator = null) {
    const nextTab = nextCreator ? "author:" + authorKey(nextCreator) : nextView;
    setSelected(null);
    if (nextTab === activeTab) return;
    pageStates.current.set(activeTab, {
      input,
      query,
      service,
      sort,
      offset,
    });
    const previous = pageStates.current.get(nextTab) || {
      input: "",
      query: "",
      service: "",
      sort: "updated",
      offset: 0,
    };
    request.current++;
    setResult(null);
    setLoading(true);
    setError("");
    setNotice("");
    setView(nextView);
    setCreator(nextCreator);
    setInput(previous.input);
    setQuery(previous.query);
    setService(previous.service);
    setSort(previous.sort);
    setOffset(previous.offset);
  }
  function navigate(nextView) {
    lastFixedView.current = nextView;
    switchPage(nextView);
  }
  function openAuthor(author) {
    const key = authorKey(author);
    const existing = authorTabs.find((item) => authorKey(item) === key);
    const next = existing || author;
    if (!existing)
      setAuthorTabs((tabs) =>
        tabs.some((item) => authorKey(item) === key) ? tabs : [...tabs, author],
      );
    switchPage(view, next);
  }
  function back() {
    navigate(lastFixedView.current);
  }
  function closeAuthor(author) {
    const key = authorKey(author);
    const index = authorTabs.findIndex((item) => authorKey(item) === key);
    if (index < 0) return;
    const remaining = authorTabs.filter((item) => authorKey(item) !== key);
    setAuthorTabs(remaining);
    if (creator && authorKey(creator) === key) {
      const next = remaining[Math.min(index, remaining.length - 1)];
      if (next) switchPage(view, next);
      else navigate(lastFixedView.current);
      requestAnimationFrame(() =>
        document
          .getElementById(
            tabId(next ? "author:" + authorKey(next) : lastFixedView.current),
          )
          ?.focus(),
      );
    }
    pageStates.current.delete("author:" + key);
  }
  function tabKeyboard(event) {
    if (event.target.getAttribute("role") !== "tab") return;
    if (event.key === "Delete" && creator) {
      event.preventDefault();
      closeAuthor(creator);
      return;
    }
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const tabs = [...event.currentTarget.querySelectorAll('[role="tab"]')];
    const index = tabs.indexOf(event.target);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabs.length - 1
          : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) %
            tabs.length;
    tabs[next]?.click();
    tabs[next]?.focus();
  }
  function cardAction(open, label) {
    return {
      tabIndex: 0,
      "aria-label": label,
      onClick: (event) => {
        if (
          !event.target.closest("button, a, input, select, textarea") &&
          !window.getSelection()?.toString()
        )
          open();
      },
      onKeyDown: (event) => {
        if (
          event.target === event.currentTarget &&
          ["Enter", " "].includes(event.key)
        ) {
          event.preventDefault();
          open();
        }
      },
    };
  }
  async function openExternal(url) {
    try {
      if (!["https:", "http:"].includes(new URL(url).protocol))
        throw new Error(t("downloads.archive.invalidLink"));
      const result = await window.api.openExternalUrl(url);
      if (result?.error) throw new Error(result.error);
    } catch (error) {
      setActionError(error.message);
    }
  }
  async function toggleFavorite(author) {
    const key = authorKey(author);
    if (!stateReady || favoriteLocks.current.has(key)) return;
    favoriteLocks.current.add(key);
    setBusy((value) => ({
      ...value,
      [key]: true,
    }));
    setActionError("");
    try {
      const favorite = !favorites.has(key);
      setSaved(
        await sourceCall("SetFavorite", {
          creator: author,
          favorite,
        }),
      );
      setNotice(
        favorite
          ? t("downloads.archive.authorFavorited", {
              name: author.name,
            })
          : t("downloads.archive.authorUnfavorited", {
              name: author.name,
            }),
      );
      if (!postsMode) setRefresh((value) => value + 1);
    } catch (error) {
      setActionError(error.message);
    } finally {
      favoriteLocks.current.delete(key);
      setBusy((value) => ({
        ...value,
        [key]: false,
      }));
      setProgress(null);
    }
  }
  async function checkUpdates() {
    if (checkLock.current) return;
    checkLock.current = true;
    setChecking(true);
    setActionError("");
    setNotice("");
    try {
      const value = await sourceCall("CheckUpdates");
      setSaved(value);
      setNotice(
        t("downloads.archive.checkResult", {
          status: value.failures.length
            ? t("downloads.archive.checkPartial")
            : t("downloads.archive.checkComplete"),
          checked: value.checked,
          total: value.total,
          postUpdateCount: value.postUpdateCount,
          otherStatus: value.baselines
            ? t("downloads.archive.baselinesCreated", {
                baselines: value.baselines,
              })
            : "",
        }),
      );
      if (value.failures.length)
        setActionError(
          t("downloads.archive.checkErrors", {
            map: value.failures
              .map((item) => `${item.creator.name}：${item.error}`)
              .join("；"),
          }),
        );
      if (!postsMode) setRefresh((tick) => tick + 1);
    } catch (error) {
      setActionError(
        t("downloads.archive.checkFailed", {
          message: error.message,
        }),
      );
    } finally {
      checkLock.current = false;
      setChecking(false);
      setProgress(null);
    }
  }
  async function markRead(author) {
    setActionError("");
    try {
      setSaved(
        await sourceCall("MarkRead", {
          creator: author,
          token: author.readToken,
        }),
      );
      if (!postsMode) setRefresh((value) => value + 1);
    } catch (error) {
      setActionError(error.message);
    }
  }
  function reload() {
    forceRefresh.current = true;
    setActionError("");
    setRefresh((value) => value + 1);
  }
  async function markPostRead(post) {
    try {
      setSaved(
        await sourceCall("MarkRead", {
          creator: post.creator,
          postId: post.id,
          token: post.changeToken,
        }),
      );
      setRefresh((value) => value + 1);
    } catch (error) {
      setActionError(error.message);
    }
  }
  function search(event) {
    event.preventDefault();
    const next = input.trim();
    if (postsMode && next && [...next].length < 3) {
      setActionError(t("downloads.archive.searchMinimum"));
      return;
    }
    setActionError("");
    setQuery(next);
    setOffset(0);
    if (next === query) setRefresh((value) => value + 1);
  }
  const closeDialog = React.useCallback(() => setSelected(null), []);
  function favoriteButton(author) {
    const key = authorKey(author),
      favorite = favorites.has(key);
    return (
      <button
        className={`paw-button paw-favorite ${favorite ? "is-favorite" : ""}`}
        disabled={!stateReady || !!busy[key]}
        onClick={() => toggleFavorite(author)}
        aria-pressed={favorite}
        title={
          favorite
            ? t("downloads.archive.unfavoriteAuthor", {
                name: author.name,
              })
            : t("downloads.archive.favoriteAuthor", {
                name: author.name,
              })
        }
      >
        {busy[key]
          ? t("common.status.saving")
          : favorite
            ? t("downloads.archive.favoritedBadge")
            : t("downloads.archive.favoriteAction")}
      </button>
    );
  }
  function creatorCard(author) {
    const favorite = favorites.get(authorKey(author));
    return (
      <article
        className="paw-creator-card"
        key={authorKey(author)}
        data-author-id={author.id}
        data-author-service={author.service}
        {...cardAction(
          () => openAuthor(author),
          t("downloads.archive.openAuthorContent", {
            service: author.service,
            name: author.name,
          }),
        )}
      >
        <div className="paw-creator-top">
          <div className="paw-avatar">
            <Image src={author.avatar} avatar={true} />
          </div>
          <span className="paw-service">{author.service}</span>
          {favorite?.unread && (
            <span className="paw-update-badge">
              {t("downloads.archive.updateCount", {
                changesCount: favorite.changesCount,
              })}
            </span>
          )}
        </div>
        <button
          className="paw-creator-name"
          onClick={() => openAuthor(author)}
          title={author.name}
        >
          {author.name}
        </button>
        <div className="paw-muted paw-author-id">{`ID: ${author.id}`}</div>
        <div className="paw-creator-stats">
          <span>
            {t("downloads.archive.favoriteCount", {
              number: number(author.favorited),
            })}
          </span>
          <span>
            {t("downloads.archive.updatedDate", {
              date: date(author.updated),
            })}
          </span>
        </div>
        {author.missing && (
          <p className="paw-notice">{t("downloads.archive.missingAuthor")}</p>
        )}
        <div className="paw-card-actions">
          <button className="paw-button" onClick={() => openAuthor(author)}>
            {t("downloads.archive.viewContent")}
          </button>
          {favoriteButton(author)}
        </div>
        {favorite?.unread && (
          <button
            className="paw-text-button paw-read-button"
            onClick={() => markRead(favorite)}
          >
            {t("downloads.archive.markRead")}
          </button>
        )}
      </article>
    );
  }
  function postCard(post) {
    return (
      <article
        className="paw-post-card"
        key={`${post.service}:${post.user}:${post.id}`}
        {...cardAction(
          () => setSelected(post),
          t("downloads.archive.viewPostDetails", {
            title: post.title,
          }),
        )}
      >
        <button
          className="paw-card-image"
          onClick={() => setSelected(post)}
          aria-label={t("downloads.archive.viewPost", {
            title: post.title,
          })}
        >
          <Image src={post.thumbnail} alt={post.title} />
          <span className="paw-image-service">{post.service}</span>
          {post.previewOnly && (
            <span className="paw-preview-badge">
              {t("common.actions.preview")}
            </span>
          )}
        </button>
        <div className="paw-card-body">
          {post.changeKind && (
            <span className={`paw-change-kind ${post.changeKind}`}>
              {post.changeKind === "new"
                ? t("downloads.archive.newContent")
                : t("downloads.archive.editedContent")}
            </span>
          )}
          <button
            className="paw-post-title"
            onClick={() => setSelected(post)}
            title={post.title}
          >
            {post.title}
          </button>
          <button
            className="paw-card-author"
            onClick={() => openAuthor(post.creator)}
            title={t("downloads.archive.viewAuthorContent")}
          >
            {"🐾 "}
            {post.creator.name}
          </button>
          <div className="paw-post-stats">
            <time>
              {t("downloads.archive.publishedDate", {
                date: date(post.published),
              })}
            </time>
            {!post.changeKind && (
              <span>
                {t("downloads.archive.attachmentCount", {
                  count: post.attachments.length + (post.file ? 1 : 0),
                })}
              </span>
            )}
          </div>
          {post.edited > 0 && (
            <div className="paw-post-stats">
              <time>
                {t("downloads.archive.editedDate", {
                  date: date(post.edited),
                })}
              </time>
            </div>
          )}
          <div className="paw-card-actions">
            {favoriteButton(post.creator)}
            <button className="paw-button" onClick={() => setSelected(post)}>
              {t("downloads.site.detailsLink")}
            </button>
          </div>
          {post.changeKind && (
            <button
              className="paw-text-button paw-read-button"
              onClick={() => markPostRead(post)}
            >
              {t("downloads.archive.markRead")}
            </button>
          )}
        </div>
      </article>
    );
  }
  const activeAuthor =
    creator && (favorites.get(authorKey(creator)) || creator);
  const searchField = (
    <form
      className={creator ? "paw-author-search" : "paw-search-form"}
      onSubmit={search}
    >
      <div className="paw-search">
        <span aria-hidden={true}>{"⌕"}</span>
        <input
          type="search"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          aria-label={
            contentMode
              ? t("downloads.archive.searchContent")
              : t("downloads.archive.searchAuthors")
          }
          placeholder={
            postsMode
              ? creator
                ? t("downloads.archive.searchAuthorContentPlaceholder")
                : t("downloads.archive.searchContentPlaceholder")
              : updatesMode
                ? t("downloads.archive.searchUpdatesPlaceholder")
                : t("downloads.archive.searchAuthorsPlaceholder")
          }
          maxLength={200}
        />
        {input && (
          <button
            type="button"
            className="paw-search-clear"
            aria-label={t("common.actions.clearSearch")}
            onClick={() => {
              setInput("");
              setQuery("");
              setOffset(0);
              setActionError("");
            }}
          >
            {"✕"}
          </button>
        )}
      </div>
      <button className="paw-button" type="submit">
        {t("common.actions.search")}
      </button>
    </form>
  );
  return (
    <section className="pawchive-view" ref={section} aria-label={label}>
      <header className="paw-header">
        <div>
          <h2>{label}</h2>
        </div>
        <div className="paw-header-actions">
          <button className="paw-button" onClick={() => openExternal(site)}>
            {t("downloads.archive.openWebsite")}
          </button>
          <button className="paw-button" onClick={reload} disabled={loading}>
            {loading ? t("common.status.loading") : t("common.actions.refresh")}
          </button>
          <button
            className="paw-button paw-primary"
            onClick={checkUpdates}
            disabled={isChecking || !stateReady || !saved.favorites.length}
            title={
              saved.favorites.length
                ? t("downloads.archive.checkHint")
                : t("downloads.archive.favoriteBeforeCheck")
            }
          >
            {isChecking
              ? t("downloads.archive.checking")
              : t("downloads.archive.checkUpdates")}
          </button>
        </div>
      </header>
      <div className="paw-summary">
        <span>
          {t("downloads.archive.favoritedAuthorsCount", {
            favoritesCount: saved.favorites.length,
          })}
        </span>
        <span className={saved.postUpdateCount ? "paw-unread-count" : ""}>
          {t("downloads.archive.unreadUpdatesCount", {
            postUpdateCount: saved.postUpdateCount,
          })}
        </span>
        <span className="paw-last-check">
          {saved.lastCheckedAt
            ? t("downloads.archive.lastCheck", {
                date: date(saved.lastCheckedAt),
              })
            : t("downloads.archive.notChecked")}
        </span>
      </div>
      <nav
        className="paw-tabs"
        role="tablist"
        aria-label={t("downloads.archive.tabLabel", {
          label,
        })}
        onKeyDown={tabKeyboard}
      >
        {h(
          "div",
          {
            className: "paw-fixed-tabs",
          },
          ...[
            [
              "updates",
              t("downloads.archive.updatesTab", {
                postUpdateCount: saved.postUpdateCount,
              }),
            ],
            [
              "favorites",
              t("downloads.archive.favoritesTab", {
                favoritesCount: saved.favorites.length,
              }),
            ],
            ["creators", t("common.fields.author")],
            ["posts", t("downloads.archive.latestContent")],
          ].map(([id, title]) => (
            <button
              key={id}
              id={tabId(id)}
              className={activeTab === id ? "active" : ""}
              role="tab"
              aria-selected={activeTab === id}
              aria-controls={panelId}
              tabIndex={activeTab === id ? 0 : -1}
              onClick={() => navigate(id)}
            >
              {title}
            </button>
          )),
        )}
        {!!authorTabs.length && (
          <div className="paw-tab-divider" aria-hidden={true} />
        )}
        {!!authorTabs.length &&
          h(
            "div",
            {
              className: "paw-author-tabs",
              onWheel: (event) => {
                if (
                  !event.deltaX &&
                  event.currentTarget.scrollWidth >
                    event.currentTarget.clientWidth
                )
                  event.currentTarget.scrollLeft += event.deltaY;
              },
            },
            ...authorTabs.map((author) => {
              const key = "author:" + authorKey(author),
                selected = activeTab === key;
              const title = `[${author.service}] ${author.name}`;
              return (
                <div
                  key={key}
                  className={`paw-author-tab ${selected ? "active" : ""}`}
                >
                  <button
                    id={tabId(key)}
                    role="tab"
                    aria-label={title}
                    title={title}
                    aria-selected={selected}
                    aria-controls={panelId}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => switchPage(view, author)}
                  >
                    <span className="paw-service">{author.service}</span>
                    <span className="paw-tab-name">{author.name}</span>
                  </button>
                  <button
                    className="paw-tab-close"
                    onClick={() => closeAuthor(author)}
                    title={t("downloads.archive.closeTab")}
                    aria-label={t("downloads.archive.closeNamedTab", {
                      title,
                    })}
                    tabIndex={selected ? 0 : -1}
                  >
                    {"✕"}
                  </button>
                </div>
              );
            }),
          )}
      </nav>
      <div id={panelId} role="tabpanel" aria-labelledby={tabId(activeTab)}>
        {creator && (
          <div className="paw-author-banner">
            <button className="paw-button" onClick={back}>
              {t("common.actions.back")}
            </button>
            <div className="paw-avatar">
              <Image src={creator.avatar} avatar={true} />
            </div>
            <div className="paw-author-heading">
              <h2>{activeAuthor.name}</h2>
              <span className="paw-muted">{`${creator.service} · ${creator.id}`}</span>
            </div>
            {searchField}
            {activeAuthor.unread && (
              <button
                className="paw-button"
                onClick={() => markRead(activeAuthor)}
              >
                {t("downloads.archive.markRead")}
              </button>
            )}
            {favoriteButton(creator)}
            <button
              className="paw-button"
              onClick={() => openExternal(creator.url)}
            >
              {t("downloads.archive.authorHomepage")}
            </button>
          </div>
        )}
        {!creator && (
          <div className="paw-toolbar">
            {searchField}
            {!postsMode &&
              h(
                "select",
                {
                  value: service,
                  onChange: (event) => {
                    setService(event.target.value);
                    setOffset(0);
                  },
                  "aria-label": t("downloads.archive.platformFilter"),
                },
                <option value="">{t("downloads.archive.allPlatforms")}</option>,
                ...(result?.services || (service ? [service] : [])).map(
                  (item) => (
                    <option value={item} key={item}>
                      {item}
                    </option>
                  ),
                ),
              )}
            {!contentMode && (
              <select
                value={sort}
                onChange={(event) => {
                  setSort(event.target.value);
                  setOffset(0);
                }}
                aria-label={t("common.fields.sortOrder")}
              >
                <option value="updated">
                  {t("downloads.archive.sortRecentlyUpdated")}
                </option>
                <option value="popular">
                  {t("downloads.archive.sortMostFavorited")}
                </option>
                <option value="name">{t("downloads.archive.sortName")}</option>
              </select>
            )}
            <span className="paw-result-count">
              {loading
                ? t("downloads.archive.fetching")
                : result
                  ? contentMode
                    ? t("downloads.archive.pageContentCount", {
                        itemsCount: result.items.length,
                      })
                    : t("downloads.archive.authorsCount", {
                        number: number(result.total),
                      })
                  : ""}
            </span>
          </div>
        )}
        {progress && (
          <div className="paw-notice" role="status">
            {t("downloads.archive.checkProgress", {
              status:
                progress.operation === "favorite"
                  ? t("downloads.archive.creatingBaselines")
                  : t("downloads.archive.progressLabel"),
              completedAuthors: progress.completedAuthors,
              totalAuthors: progress.totalAuthors,
              author: progress.author,
              otherStatus: progress.done
                ? t("downloads.archive.completedSuffix")
                : t("downloads.archive.pageProgress", {
                    pages: progress.pages,
                    posts: progress.posts,
                  }),
            })}
          </div>
        )}
        {actionError && (
          <div className="paw-alert" role="alert">
            <span>{actionError}</span>
            <button
              className="paw-icon-button"
              aria-label={t("common.actions.dismissNotice")}
              onClick={() => setActionError("")}
            >
              {"✕"}
            </button>
          </div>
        )}
        {notice && (
          <div className="paw-notice" role="status">
            {notice}
          </div>
        )}
        {saved.autoCheckError && (
          <div className="paw-alert" role="alert">
            {saved.autoCheckError}
          </div>
        )}
        {result?.warning && (
          <div className="paw-notice" role="status">
            {result.warning}
            {result.cachedAt
              ? t("downloads.archive.cachedAt", {
                  date: date(result.cachedAt),
                })
              : ""}
          </div>
        )}
        {error ? (
          <div className="paw-empty" role="alert">
            <div className="paw-empty-icon">{"☁"}</div>
            <h2>{t("downloads.archive.temporarilyUnavailable")}</h2>
            <p>{error}</p>
            <button className="paw-button paw-primary" onClick={reload}>
              {t("common.actions.reload")}
            </button>
          </div>
        ) : loading ? (
          h(
            "div",
            {
              className: "paw-grid",
              "aria-busy": true,
              "aria-label": t("downloads.archive.loadingNamedContent", {
                label,
              }),
            },
            ...Array.from(
              {
                length: 8,
              },
              (_, index) => (
                <div className="paw-skeleton" key={index}>
                  <div />
                  <span />
                  <span />
                </div>
              ),
            ),
          )
        ) : !result?.items.length ? (
          <div className="paw-empty">
            <div className="paw-empty-icon">
              {view === "updates" ? "✓" : "🐾"}
            </div>
            <h2>
              {query || service
                ? t("downloads.archive.noMatchingContent")
                : updatesMode
                  ? t("downloads.archive.noUnreadUpdates")
                  : !creator && view === "favorites"
                    ? t("downloads.archive.noFavoriteAuthors")
                    : t("downloads.archive.empty")}
            </h2>
            <p>
              {query || service
                ? t("downloads.archive.noMatchesHint")
                : updatesMode
                  ? t("downloads.archive.automaticCheckHint")
                  : !creator && view === "favorites"
                    ? t("downloads.archive.noFavoritesHint")
                    : t("downloads.archive.emptyHint")}
            </p>
            {!creator && view === "favorites" && !query && (
              <button
                className="paw-button paw-primary"
                onClick={() => navigate("creators")}
              >
                {t("downloads.archive.discoverAuthors")}
              </button>
            )}
          </div>
        ) : (
          h(
            "div",
            {
              className: `paw-grid ${contentMode ? "" : "paw-creators-grid"}`,
            },
            ...result.items.map(contentMode ? postCard : creatorCard),
          )
        )}
        {result && !loading && (offset > 0 || result.hasMore) && (
          <div className="paw-pagination">
            <button
              className="paw-button"
              disabled={offset === 0}
              onClick={() => {
                setOffset(Math.max(0, offset - result.pageSize));
                section.current?.scrollIntoView({
                  block: "start",
                });
              }}
            >
              {t("common.actions.previousPage")}
            </button>
            <span>
              {t("downloads.archive.pageNumber", {
                count: Math.floor(offset / result.pageSize) + 1,
                status:
                  result.total != null
                    ? ` / ${Math.max(1, Math.ceil(result.total / result.pageSize))}`
                    : "",
              })}
            </span>
            <button
              className="paw-button"
              disabled={!result.hasMore}
              onClick={() => {
                setOffset(offset + result.pageSize);
                section.current?.scrollIntoView({
                  block: "start",
                });
              }}
            >
              {t("common.actions.nextPage")}
            </button>
          </div>
        )}
        <p className="paw-footnote">{t("downloads.archive.scheduleHint")}</p>
      </div>
      {selected && isActive && (
        <PostDialog
          selected={selected}
          posts={result?.items || []}
          source={source}
          onSelect={setSelected}
          onClose={closeDialog}
          openExternal={openExternal}
          onAuthor={openAuthor}
          favoriteButton={favoriteButton}
          onMarkRead={markPostRead}
          Download={RevivalDownload}
        />
      )}
    </section>
  );
}
export { RevivalDownload, PawchiveView as default };
