import { t } from "../../../shared/i18n/index.mjs";
import React from "react";
const check = (result) => {
  if (!result?.success)
    throw Error(result?.error || t("common.errors.operationFailed"));
  return result;
};
const button = (text, props = {}) => (
  <button type="button" className="system-button" {...props}>
    {text}
  </button>
);
const UNKNOWN = "__unlinked__";
function openPersistManager(gameId, characterName, modName) {
  sessionStorage.setItem(
    "qaqm.persist.target",
    JSON.stringify({
      gameId,
      characterName,
      modName,
    }),
  );
  sessionStorage.setItem("qaqm.settings.category", "persist");
  window.dispatchEvent(
    new CustomEvent("qaqm:settings-section", {
      detail: {
        category: "persist",
      },
    }),
  );
  window.dispatchEvent(
    new CustomEvent("qaqm-navigate", {
      detail: {
        tab: "settings",
      },
    }),
  );
}
function initialLocation(gameId) {
  if (gameId)
    return {
      gameId,
    };
  try {
    const saved = sessionStorage.getItem("qaqm.persist.target");
    sessionStorage.removeItem("qaqm.persist.target");
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}
function PersistVariables({ entries }) {
  return (
    <div className="persist-entries">
      {entries.map((entry) => (
        <details
          key={entry.id}
          className="persist-file"
          open={entries.length === 1}
          data-persist-entry={entry.id}
        >
          <summary>
            {entry.iniPath || entry.title}
            <span>
              {t("settings.persist.variableCountSuffix", {
                variablesCount: entry.variables.length,
              })}
            </span>
          </summary>
          {entry.modifiedAt && (
            <p className="persist-meta">
              {t("settings.persist.updatedAt", {
                value: new Date(entry.modifiedAt).toLocaleString(),
              })}
            </p>
          )}
          <table className="persist-variables">
            <thead>
              <tr>
                <th>{t("settings.persist.variable")}</th>
                <th>{t("settings.persist.savedValue")}</th>
              </tr>
            </thead>
            <tbody>
              {entry.variables.map((variable, index) => (
                <tr key={index}>
                  <td>{variable.name}</td>
                  <td>{variable.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      ))}
    </div>
  );
}
function PersistStateBrowser({ gameId = null }) {
  const [at, setAt] = React.useState(() => initialLocation(gameId));
  const [data, setData] = React.useState(null),
    [error, setError] = React.useState(""),
    [message, setMessage] = React.useState("");
  const [busy, setBusy] = React.useState(false),
    [revision, setRevision] = React.useState(0);
  const [search, setSearch] = React.useState(""),
    [page, setPage] = React.useState(0),
    [confirm, setConfirm] = React.useState(null);
  const lock = React.useRef(false),
    isMod = !!at.modName;
  React.useEffect(() => {
    let canceled = false;
    setData(null);
    setError("");
    const request = !at.gameId
      ? window.api.persistBridgeGames()
      : isMod && at.characterName !== UNKNOWN
        ? window.api.persistBridgeMod(at.gameId, at.characterName, at.modName)
        : window.api.persistBridgeList(at.gameId, {
            metadataOnly: !isMod,
            ids: isMod ? at.ids : undefined,
            refresh: revision > 0,
          });
    request
      .then(check)
      .then((result) => {
        if (!canceled) setData(result);
      })
      .catch((e) => {
        if (!canceled) setError(e.message);
      });
    return () => {
      canceled = true;
    };
  }, [at, revision]);
  function navigate(target) {
    if (!busy) {
      setData(null);
      setAt(target);
      setPage(0);
      setSearch("");
      setConfirm(null);
      setMessage("");
    }
  }
  async function act(action, success) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      check(await action());
      setConfirm(null);
      setMessage(success);
      setRevision((value) => value + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const toggle = (game) => (
    <input
      type="checkbox"
      role="switch"
      className="system-switch"
      checked={game.enabled}
      disabled={busy}
      aria-label={t("settings.persist.gameToggleLabel", {
        name: game.name,
      })}
      onChange={(event) => {
        const value = event.target.checked;
        act(
          () => window.api.persistBridgeSetEnabled(game.id, value),
          t("settings.persist.savedRestart"),
        );
      }}
    />
  );
  const notices = (
    <React.Fragment>
      {error && (
        <div className="system-notice persist-error" role="alert">
          {error}
          {button(t("common.actions.retry"), {
            onClick: () => setRevision((value) => value + 1),
          })}
        </div>
      )}
      {message && (
        <div className="system-notice" role="status">
          {message}
        </div>
      )}
      {!data && !error && (
        <div className="system-state" role="status">
          {t("settings.persist.loadingSaved")}
        </div>
      )}
    </React.Fragment>
  );
  if (!at.gameId)
    return (
      <div className="persist-manager" aria-busy={busy}>
        <p className="system-notice">{t("settings.persist.description")}</p>
        {notices}
        {data?.games && (
          <div className="persist-game-grid">
            {data.games.map((game) => (
              <article
                key={game.id}
                className="system-card persist-game-card"
                data-persist-game={game.id}
              >
                <div className="persist-game-heading">
                  <h3>{game.name}</h3>
                  {toggle(game)}
                </div>
                <p>
                  {t("settings.persist.configurationSummary", {
                    status: game.enabled
                      ? t("common.status.enabled")
                      : t("settings.persist.notEnabled"),
                    count: game.count,
                  })}
                </p>
                {!game.configured && (
                  <small>{t("settings.persist.modsFolderUnset")}</small>
                )}
                {button(t("settings.persist.viewCharacter"), {
                  disabled: busy,
                  "aria-label": t("settings.persist.manageGame", {
                    name: game.name,
                  }),
                  onClick: () =>
                    navigate({
                      gameId: game.id,
                    }),
                })}
              </article>
            ))}
          </div>
        )}
      </div>
    );
  const entries = data?.entries || [],
    groups = new Map(),
    query = search.trim().toLowerCase();
  if (!isMod)
    for (const entry of entries) {
      const character = entry.characterName || UNKNOWN;
      if (at.characterName && character !== at.characterName) continue;
      const name = at.characterName
        ? entry.modName || entry.name || entry.id
        : character;
      if (!groups.has(name))
        groups.set(name, {
          name,
          title: name === UNKNOWN ? t("settings.persist.unlinked") : name,
          entries: [],
          mods: new Set(),
        });
      const group = groups.get(name);
      group.entries.push(entry);
      group.mods.add(entry.modName || entry.id);
    }
  const items = (
    isMod
      ? entries
      : [...groups.values()].sort((a, b) =>
          a.title.localeCompare(b.title, "zh-CN"),
        )
  ).filter(
    (item) =>
      !query ||
      (isMod
        ? [
            item.iniPath,
            ...item.variables.flatMap((variable) => [
              variable.name,
              variable.value,
            ]),
          ]
        : [item.title, ...item.mods]
      ).some((value) => value?.toLowerCase().includes(query)),
  );
  const pageCount = Math.max(1, Math.ceil(items.length / 36)),
    currentPage = Math.min(page, pageCount - 1),
    visible = items.slice(currentPage * 36, (currentPage + 1) * 36);
  const title =
    at.modName ||
    (at.characterName === UNKNOWN
      ? t("settings.persist.unlinked")
      : at.characterName) ||
    data?.game?.name;
  const deleteIds = (ids, label) =>
    setConfirm({
      ids,
      label,
      count: ids?.length ?? entries.length,
    });
  return (
    <div
      className="persist-manager"
      data-persist-detail={at.gameId}
      data-persist-level={
        isMod ? "mod" : at.characterName ? "character" : "game"
      }
      aria-busy={busy}
    >
      <nav
        className="persist-breadcrumbs"
        aria-label={t("settings.persist.storagePath")}
      >
        {!gameId &&
          button(t("settings.persist.allGames"), {
            disabled: busy,
            onClick: () => navigate({}),
          })}
        {button(data?.game?.name || t("settings.persist.game"), {
          disabled: busy || !at.characterName,
          onClick: () =>
            navigate({
              gameId: at.gameId,
            }),
        })}
        {at.characterName &&
          button(
            at.characterName === UNKNOWN
              ? t("settings.persist.unlinked")
              : at.characterName,
            {
              disabled: busy || !isMod,
              onClick: () =>
                navigate({
                  gameId: at.gameId,
                  characterName: at.characterName,
                }),
            },
          )}
        {isMod && <span aria-current="page">{at.modName}</span>}
      </nav>
      {notices}
      {data?.game && (
        <React.Fragment>
          <div className="persist-detail-heading">
            <div>
              <h3>{title}</h3>
              <p>
                {isMod
                  ? t("settings.persist.variablesSummary", {
                      entriesCount: entries.length,
                      reduce: entries.reduce(
                        (sum, entry) => sum + entry.variables.length,
                        0,
                      ),
                    })
                  : t("settings.persist.itemSummary", {
                      size: groups.size,
                      status: at.characterName
                        ? " Mod"
                        : t("settings.persist.characterCategory"),
                    })}
              </p>
            </div>
            {!at.characterName
              ? toggle(data.game)
              : isMod &&
                data.modExists &&
                button(t("settings.persist.openModDetails"), {
                  disabled: busy,
                  onClick: () =>
                    window.dispatchEvent(
                      new CustomEvent("qaqm-open-manager-target", {
                        detail: at,
                      }),
                    ),
                })}
          </div>
          {!at.characterName && (
            <p className="system-notice">
              {t("settings.persist.characterHint")}
            </p>
          )}
          {at.characterName === UNKNOWN && (
            <p className="system-notice">
              {t("settings.persist.unlinkedHint")}
            </p>
          )}
          <div className="persist-toolbar">
            <input
              type="search"
              className="system-text-input"
              aria-label={t("settings.persist.searchSaved")}
              placeholder={
                isMod
                  ? t("settings.persist.searchVariablesPlaceholder")
                  : at.characterName
                    ? t("settings.persist.searchModsPlaceholder")
                    : t("settings.persist.searchCharactersPlaceholder")
              }
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
            />
            {button(t("common.actions.refresh"), {
              disabled: busy,
              onClick: () => setRevision((value) => value + 1),
            })}
            {!at.characterName &&
              button(t("settings.persist.clearGame"), {
                disabled: busy || !entries.length,
                onClick: () => deleteIds(null, data.game.name),
              })}
            {isMod &&
              button(t("settings.persist.deleteModSave"), {
                disabled: busy || !entries.length,
                onClick: () =>
                  deleteIds(
                    entries.map((entry) => entry.id),
                    at.modName,
                  ),
              })}
          </div>
          {confirm && (
            <div className="persist-confirm" role="alert">
              <p>
                {t("settings.persist.confirmDelete", {
                  label: confirm.label,
                  count: confirm.count,
                })}
              </p>
              {button(t("common.dialog.confirmDelete"), {
                disabled: busy,
                onClick: () =>
                  act(
                    () =>
                      confirm.ids
                        ? window.api.persistBridgeDelete(at.gameId, confirm.ids)
                        : window.api.clearPersistCache(at.gameId),
                    t("settings.persist.deletedRestart"),
                  ),
              })}
              {button(t("common.actions.cancel"), {
                disabled: busy,
                onClick: () => setConfirm(null),
              })}
            </div>
          )}
          {!items.length && (
            <div className="system-state">
              {query
                ? t("settings.persist.noMatches")
                : isMod
                  ? t("mods.persist.noSavedConfiguration")
                  : t("settings.persist.empty")}
            </div>
          )}
          {!isMod && (
            <div className="persist-group-grid">
              {visible.map((group) => (
                <button
                  key={group.name}
                  type="button"
                  className="system-card persist-group-card"
                  disabled={busy}
                  data-persist-character={
                    !at.characterName ? group.name : undefined
                  }
                  data-persist-mod={at.characterName ? group.name : undefined}
                  onClick={() =>
                    navigate(
                      at.characterName
                        ? {
                            gameId: at.gameId,
                            characterName: at.characterName,
                            modName: group.name,
                            ids: group.entries.map((entry) => entry.id),
                          }
                        : {
                            gameId: at.gameId,
                            characterName: group.name,
                          },
                    )
                  }
                >
                  <span className="persist-group-avatar" aria-hidden={true}>
                    {(group.name === UNKNOWN ? "?" : group.title).slice(0, 1)}
                  </span>
                  <span>
                    <strong>{group.title}</strong>
                    <small>
                      {at.characterName
                        ? t("settings.persist.entrySummary", {
                            entriesCount: group.entries.length,
                            status: group.entries.some((entry) => entry.active)
                              ? t("settings.persist.modEnabledSuffix")
                              : "",
                          })
                        : t("settings.persist.modSummary", {
                            size: group.mods.size,
                            entriesCount: group.entries.length,
                          })}
                    </small>
                  </span>
                  <span aria-hidden={true}>{"›"}</span>
                </button>
              ))}
            </div>
          )}
          {isMod && (
            <div className="persist-entries">
              {visible.map((entry) => (
                <article key={entry.id} className="system-card persist-entry">
                  <div className="persist-entry-content">
                    <PersistVariables entries={[entry]} />
                    {button(t("settings.persist.deleteItem"), {
                      disabled: busy,
                      onClick: () => deleteIds([entry.id], entry.iniPath),
                    })}
                  </div>
                </article>
              ))}
            </div>
          )}
          {pageCount > 1 && (
            <div className="persist-pagination">
              {button(t("common.actions.previousPage"), {
                disabled: busy || currentPage === 0,
                onClick: () => setPage(currentPage - 1),
              })}
              <span>{`${currentPage + 1} / ${pageCount}`}</span>
              {button(t("common.actions.nextPage"), {
                disabled: busy || currentPage + 1 >= pageCount,
                onClick: () => setPage(currentPage + 1),
              })}
            </div>
          )}
        </React.Fragment>
      )}
    </div>
  );
}
export { openPersistManager, PersistVariables, PersistStateBrowser as default };
