import { t } from "../../../shared/i18n/index.mjs";
import React from "react";
import { Icon } from "../../components/Icon.jsx";
import { Menu, MenuItem } from "../../components/Menu.jsx";
import {
  Button,
  Dialog,
  Notice,
  Switch,
  check,
} from "./SettingsControls.jsx";
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
            <span className="persist-file-name" title={entry.iniPath || entry.title}>
              {entry.iniPath || entry.title}
            </span>
            <span className="persist-file-count">
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
function PersistStateBrowser({ gameId = null, games = [] }) {
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
  const gameAvailable =
    !at.gameId || !!gameId || games.some((game) => game.id === at.gameId);
  const visibleGameKey = games
    .map((game) => game.id)
    .sort()
    .join("\0");
  React.useEffect(() => {
    if (!gameAvailable) setAt({});
  }, [gameAvailable]);
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
  }, [at, revision, visibleGameKey]);
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
    <Switch
      checked={game.enabled}
      disabled={busy}
      label={t("settings.persist.gameToggleLabel", {
        name: game.name,
      })}
      onChange={(value) =>
        act(
          () => window.api.persistBridgeSetEnabled(game.id, value),
          t("settings.persist.savedRestart"),
        )
      }
    />
  );
  const notices = (
    <React.Fragment>
      {error && (
        <Notice kind="danger" className="persist-error" role="alert">
          {error}
          <Button
            small={true}
            onClick={() => setRevision((value) => value + 1)}
          >
            {t("common.actions.retry")}
          </Button>
        </Notice>
      )}
      {message && (
        <Notice kind="success" role="status">
          {message}
        </Notice>
      )}
      {!data && !error && (
        <div className="settings-state" role="status">
          <span className="spinner" />
          {t("settings.persist.loadingSaved")}
        </div>
      )}
    </React.Fragment>
  );
  if (!gameAvailable) return null;
  if (!at.gameId)
    return (
      <div className="persist-manager" aria-busy={busy}>
        {notices}
        {data?.games && (
          <div className="persist-game-list">
            {games
              .flatMap((game) => {
                const saved = data.games.find((item) => item.id === game.id);
                return saved ? [saved] : [];
              })
              .map((game) => (
                <article
                  key={game.id}
                  className="system-row"
                  data-persist-game={game.id}
                >
                  <div className="system-row-copy">
                    <div className="system-row-title">{game.name}</div>
                    <p>
                      {t("settings.persist.configurationSummary", {
                        status: game.enabled
                          ? t("common.status.enabled")
                          : t("settings.persist.notEnabled"),
                        count: game.count,
                      })}
                      {!game.configured &&
                        ` · ${t("settings.persist.modsFolderUnset")}`}
                    </p>
                  </div>
                  <div className="system-row-control">
                    <Button
                      disabled={busy}
                      aria-label={t("settings.persist.manageGame", {
                        name: game.name,
                      })}
                      onClick={() =>
                        navigate({
                          gameId: game.id,
                        })
                      }
                    >
                      {t("common.actions.view")}
                    </Button>
                    {toggle(game)}
                  </div>
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
  const deleteIds = (ids, label) =>
    setConfirm({
      ids,
      label,
      count: ids?.length ?? entries.length,
    });
  const showCrumbs = !gameId || !!at.characterName;
  return (
    <div
      className="persist-manager"
      data-persist-detail={at.gameId}
      data-persist-level={
        isMod ? "mod" : at.characterName ? "character" : "game"
      }
      aria-busy={busy}
    >
      {showCrumbs && (
        <nav
          className="persist-breadcrumbs"
          aria-label={t("settings.persist.storagePath")}
        >
          {!gameId && (
            <React.Fragment>
              <button
                type="button"
                className="link-btn"
                disabled={busy}
                onClick={() => navigate({})}
              >
                {t("settings.persist.allGames")}
              </button>
              <Icon name="chevron-right" size={12} />
            </React.Fragment>
          )}
          <button
            type="button"
            className="link-btn"
            disabled={busy || !at.characterName}
            aria-current={at.characterName ? undefined : "page"}
            onClick={() =>
              navigate({
                gameId: at.gameId,
              })
            }
          >
            {data?.game?.name || t("settings.persist.game")}
          </button>
          {at.characterName && (
            <React.Fragment>
              <Icon name="chevron-right" size={12} />
              <button
                type="button"
                className="link-btn"
                disabled={busy || !isMod}
                aria-current={isMod ? undefined : "page"}
                onClick={() =>
                  navigate({
                    gameId: at.gameId,
                    characterName: at.characterName,
                  })
                }
              >
                {at.characterName === UNKNOWN
                  ? t("settings.persist.unlinked")
                  : at.characterName}
              </button>
            </React.Fragment>
          )}
          {isMod && (
            <React.Fragment>
              <Icon name="chevron-right" size={12} />
              <span aria-current="page">{at.modName}</span>
            </React.Fragment>
          )}
        </nav>
      )}
      {notices}
      {data?.game && (
        <React.Fragment>
          {!at.characterName && (
            <div className="system-row">
              <div className="system-row-copy">
                <div className="system-row-title">
                  {t("settings.persist.toggle")}
                </div>
                <p>
                  {t("settings.persist.itemSummary", {
                    size: groups.size,
                    status: t("settings.persist.characterCategory"),
                  })}
                </p>
              </div>
              <div className="system-row-control">{toggle(data.game)}</div>
            </div>
          )}
          {at.characterName === UNKNOWN && (
            <p className="settings-footnote">
              {t("settings.persist.unlinkedHint")}
            </p>
          )}
          <div className="persist-toolbar">
            <div className="search-field">
              <Icon name="search" size={15} />
              <input
                type="text"
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
                onKeyDown={(e) => {
                  if (e.key === "Escape") setSearch("");
                }}
              />
              {search && (
                <button
                  type="button"
                  className="icon-btn search-clear"
                  title={t("common.actions.clearSearch")}
                  aria-label={t("common.actions.clearSearch")}
                  onClick={() => setSearch("")}
                >
                  <Icon name="x" size={14} />
                </button>
              )}
            </div>
            <Button
              disabled={busy}
              onClick={() => setRevision((value) => value + 1)}
            >
              {t("common.actions.refresh")}
            </Button>
            {isMod && data.modExists && (
              <Button
                disabled={busy}
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent("qaqm-open-manager-target", {
                      detail: at,
                    }),
                  )
                }
              >
                {t("settings.persist.openModDetails")}
              </Button>
            )}
            {(!at.characterName || isMod) && (
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
                    <Icon name="more" size={16} strokeWidth={2.4} />
                  </button>
                )}
              >
                {!at.characterName && (
                  <MenuItem
                    danger={true}
                    icon={<Icon name="trash" size={15} />}
                    disabled={busy || !entries.length}
                    onClick={() => deleteIds(null, data.game.name)}
                  >
                    {t("settings.persist.clearGame")}
                  </MenuItem>
                )}
                {isMod && (
                  <MenuItem
                    danger={true}
                    icon={<Icon name="trash" size={15} />}
                    disabled={busy || !entries.length}
                    onClick={() =>
                      deleteIds(
                        entries.map((entry) => entry.id),
                        at.modName,
                      )
                    }
                  >
                    {t("settings.persist.deleteModSave")}
                  </MenuItem>
                )}
              </Menu>
            )}
          </div>
          {confirm && (
            <Dialog
              className="persist-confirm"
              title={t("common.dialog.confirmDelete")}
              description={t("settings.persist.confirmDelete", {
                label: confirm.label,
                count: confirm.count,
              })}
              busy={busy}
              onClose={() => setConfirm(null)}
              actions={
                <React.Fragment>
                  <Button disabled={busy} onClick={() => setConfirm(null)}>
                    {t("common.actions.cancel")}
                  </Button>
                  <Button
                    danger={true}
                    disabled={busy}
                    onClick={() =>
                      act(
                        () =>
                          confirm.ids
                            ? window.api.persistBridgeDelete(
                                at.gameId,
                                confirm.ids,
                              )
                            : window.api.clearPersistCache(at.gameId),
                        t("settings.persist.deletedRestart"),
                      )
                    }
                  >
                    {t("common.dialog.confirmDelete")}
                  </Button>
                </React.Fragment>
              }
            />
          )}
          {!items.length && (
            <div className="settings-state">
              {query
                ? t("settings.persist.noMatches")
                : isMod
                  ? t("mods.persist.noSavedConfiguration")
                  : t("settings.persist.empty")}
            </div>
          )}
          {!isMod && items.length > 0 && (
            <div className="persist-group-list">
              {visible.map((group) => (
                <button
                  key={group.name}
                  type="button"
                  className="persist-group"
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
                  <span className="persist-group-name">{group.title}</span>
                  <span className="persist-group-meta">
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
                  </span>
                  <Icon name="chevron-right" size={14} />
                </button>
              ))}
            </div>
          )}
          {isMod && (
            <div className="persist-entry-list">
              {visible.map((entry) => (
                <article key={entry.id} className="persist-entry">
                  <PersistVariables entries={[entry]} />
                  <Button
                    small={true}
                    danger={true}
                    disabled={busy}
                    onClick={() => deleteIds([entry.id], entry.iniPath)}
                  >
                    {t("settings.persist.deleteItem")}
                  </Button>
                </article>
              ))}
            </div>
          )}
          {pageCount > 1 && (
            <div className="persist-pagination">
              <Button
                small={true}
                disabled={busy || currentPage === 0}
                onClick={() => setPage(currentPage - 1)}
              >
                {t("common.actions.previousPage")}
              </Button>
              <span>{`${currentPage + 1} / ${pageCount}`}</span>
              <Button
                small={true}
                disabled={busy || currentPage + 1 >= pageCount}
                onClick={() => setPage(currentPage + 1)}
              >
                {t("common.actions.nextPage")}
              </Button>
            </div>
          )}
        </React.Fragment>
      )}
    </div>
  );
}
export { openPersistManager, PersistVariables, PersistStateBrowser as default };
