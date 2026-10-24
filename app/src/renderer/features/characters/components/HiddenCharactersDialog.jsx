import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
import ReactDOM from "react-dom";
function HiddenCharactersDialog({ gameId, gameName, onClose, onRestored }) {
  const [characters, setCharacters] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState("");
  const [error, setError] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [revision, setRevision] = React.useState(0);
  const dialogRef = React.useRef(null);
  const live = React.useRef(true);
  React.useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  React.useEffect(() => {
    let canceled = false;
    setLoading(true);
    setError("");
    window.api
      .getHiddenCharacters(gameId)
      .then((result) => {
        if (canceled) return;
        if (!result?.success)
          throw Error(result?.error || t("characters.hide.loadFailed"));
        setCharacters(result.characters);
      })
      .catch((error) => {
        if (!canceled) setError(error.message);
      })
      .finally(() => {
        if (!canceled) setLoading(false);
      });
    return () => {
      canceled = true;
    };
  }, [gameId, revision]);
  React.useEffect(() => {
    const previous = document.activeElement;
    dialogRef.current?.querySelector("input")?.focus();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  async function restore(name) {
    if (busy) return;
    setBusy(name);
    setError("");
    try {
      const result = await window.api.setCharacterHidden(name, false, gameId);
      if (!live.current) return;
      if (!result?.success)
        throw Error(result?.error || t("characters.hide.restoreFailed"));
      setCharacters((items) => items.filter((item) => item.name !== name));
      onRestored?.(name);
    } catch (error) {
      if (live.current) setError(error.message);
    } finally {
      if (live.current) setBusy("");
    }
  }
  function onKeyDown(event) {
    if (event.key === "Escape") {
      event.stopPropagation();
      if (!busy) onClose();
    }
    if (event.key !== "Tab") return;
    const controls = [
      ...dialogRef.current.querySelectorAll("button:not(:disabled), input"),
    ];
    const first = controls[0],
      last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
  const filtered = characters.filter((item) =>
    item.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  return ReactDOM.createPortal(
    <div
      className="modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="modal-content hidden-characters-dialog"
        role="dialog"
        aria-modal={true}
        aria-labelledby="hidden-characters-title"
        onKeyDown={onKeyDown}
      >
        <div className="hidden-characters-header">
          <h2 id="hidden-characters-title" className="text-h2">
            {t("characters.actions.hide")}
          </h2>
          <button
            type="button"
            className="btn btn-secondary"
            aria-label={t("characters.hide.close")}
            disabled={!!busy}
            onClick={onClose}
          >
            {t("common.actions.close")}
          </button>
        </div>
        <p className="hidden-characters-description">
          {t("characters.hide.description", {
            gameName: gameName || t("navigation.currentGame"),
          })}
        </p>
        <input
          className="input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label={t("characters.hide.searchLabel")}
          placeholder={t("characters.hide.searchPlaceholder")}
        />
        {error && (
          <div className="hidden-characters-error" role="alert">
            {error}
            {!busy && (
              <button
                className="btn btn-secondary"
                onClick={() => setRevision((value) => value + 1)}
              >
                {t("common.actions.reload")}
              </button>
            )}
          </div>
        )}
        <div className="hidden-characters-list" aria-busy={loading || !!busy}>
          {loading ? (
            <p>{t("characters.hide.loading")}</p>
          ) : filtered.length ? (
            filtered.map((item) => (
              <div key={item.name} className="hidden-character-row">
                <span className="hidden-character-avatar" aria-hidden="true">
                  {item.coverUrl && <img src={item.coverUrl} alt="" loading="lazy" decoding="async" />}
                </span>
                <span className="hidden-character-name">{item.name}</span>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={!!busy}
                  onClick={() => restore(item.name)}
                  aria-label={t("characters.hide.restoreNamed", {
                    name: item.name,
                  })}
                >
                  {busy === item.name
                    ? t("characters.hide.restoring")
                    : t("characters.hide.restore")}
                </button>
              </div>
            ))
          ) : (
            <p className="hidden-characters-empty">
              {query.trim()
                ? t("characters.hide.noMatches")
                : t("characters.hide.empty")}
            </p>
          )}
        </div>
        <p className="hidden-characters-description" role="status">
          {t("characters.hide.count", {
            charactersCount: characters.length,
          })}
        </p>
      </section>
    </div>,
    document.body,
  );
}
export { HiddenCharactersDialog as default };
