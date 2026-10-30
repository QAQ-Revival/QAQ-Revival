import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
import { Icon } from "../../../components/Icon.jsx";
import {
  normalizeSearchValue,
  readCharacterPinnedSet,
} from "../model/characterHelpers.js";
import { pinyin, pinyinReady } from "../model/characterSearch.js";

const RAIL_COLLAPSED_KEY = "qaqr.characterRailCollapsed";

function readCollapsed() {
  try {
    return localStorage.getItem(RAIL_COLLAPSED_KEY) === "true";
  } catch {
    return false;
  }
}

function coversFrom(characters) {
  const covers = {};
  for (const character of characters) {
    if (character?.name && character.coverUrl)
      covers[character.name] = character.coverUrl;
  }
  return covers;
}

function matchesQuery(character, query) {
  const name = String(character?.name || "");
  const terms = [
    name,
    ...(Array.isArray(character?.searchTerms) ? character.searchTerms : []),
  ];
  if (pinyin && name) {
    try {
      terms.push(
        pinyin(name, { toneType: "none" }),
        pinyin(name, { toneType: "none", pattern: "first" }),
      );
    } catch {}
  }
  return terms.some((term) => normalizeSearchValue(term).includes(query));
}

// Stays beside the Mod list so moving between characters never leaves the workspace.
function CharacterRail({ gameId, cache, onCacheChange, selected, onSelect, onBack }) {
  const [collapsed, setCollapsed] = React.useState(readCollapsed);
  const [query, setQuery] = React.useState("");
  const [, setPinyinLoaded] = React.useState(!!pinyin);
  const list = React.useRef(null);
  const characters = Array.isArray(cache?.characters) ? cache.characters : [];
  const covers = cache?.characterCovers || {};
  // Counts for the open character arrive with its Mods, so only outside changes need a list read.
  const stale =
    !cache || (cache.needsRefresh && cache.staleCharacterName !== selected);
  React.useEffect(() => {
    if (!pinyin) pinyinReady.then(() => setPinyinLoaded(true));
  }, []);
  React.useEffect(() => {
    if (!stale) return void 0;
    let current = true;
    const timer = setTimeout(async () => {
      try {
        const result = await window.api.getCharacters();
        if (!current || !result?.success) return;
        const next = Array.isArray(result.characters) ? result.characters : [];
        onCacheChange?.({
          ...cache,
          characters: next,
          characterCovers: coversFrom(next),
          missingPath: false,
          loadError: "",
          needsRefresh: false,
        });
      } catch {}
    }, cache ? 400 : 0);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [stale, gameId]);
  const pinned = React.useMemo(() => readCharacterPinnedSet(gameId), [gameId]);
  const normalizedQuery = normalizeSearchValue(query);
  const rows = React.useMemo(() => {
    if (normalizedQuery)
      return characters.filter((item) => matchesQuery(item, normalizedQuery));
    const visible = characters.filter(
      (item) => Number(item?.modCount || 0) > 0 || item?.name === selected,
    );
    // Order stays stable while Mods are toggled, so a row never jumps away from the pointer.
    return [
      ...visible.filter((item) => pinned.has(item.name)),
      ...visible.filter((item) => !pinned.has(item.name)),
    ];
  }, [characters, normalizedQuery, pinned, selected]);
  React.useEffect(() => {
    list.current
      ?.querySelector('[aria-current="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [selected, collapsed]);
  function toggleCollapsed() {
    setCollapsed((value) => {
      try {
        localStorage.setItem(RAIL_COLLAPSED_KEY, String(!value));
      } catch {}
      return !value;
    });
  }
  function moveFocus(event) {
    if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;
    const items = [...list.current.querySelectorAll(".character-rail-item")];
    const index = items.indexOf(document.activeElement);
    const next = items[index + (event.key === "ArrowDown" ? 1 : -1)];
    if (!next) return;
    event.preventDefault();
    next.focus();
  }
  return (
    <aside
      className={`character-rail ${collapsed ? "is-collapsed" : ""}`}
      aria-label={t("characters.rail.label")}
    >
      <div className="character-rail-head">
        <button
          type="button"
          className="character-rail-back mod-view-back-btn"
          onClick={onBack}
          aria-label={t("mods.library.backToCharacters")}
          title={t("mods.library.backToCharacters")}
        >
          <Icon name="grid" size={15} />
          <span className="character-rail-label">
            {t("characters.rail.allCharacters")}
          </span>
        </button>
        <button
          type="button"
          className="icon-btn icon-btn-sm character-rail-toggle"
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          aria-label={t(
            collapsed ? "characters.rail.expand" : "characters.rail.collapse",
          )}
          title={t(
            collapsed ? "characters.rail.expand" : "characters.rail.collapse",
          )}
        >
          <Icon name={collapsed ? "chevron-right" : "chevron-left"} size={15} />
        </button>
      </div>
      <div className="character-rail-search search-field">
        <Icon name="search" size={14} />
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setQuery("");
          }}
          placeholder={t("characters.rail.search")}
          aria-label={t("characters.rail.search")}
        />
      </div>
      <div className="character-rail-list" ref={list} onKeyDown={moveFocus}>
        {rows.map((character) => {
          const name = character.name;
          const enabled = Number(character.enabledCount || 0);
          const isCurrent = name === selected;
          return (
            <button
              type="button"
              className={`character-rail-item ${enabled > 0 ? "is-lit" : ""}`}
              aria-current={isCurrent ? "true" : void 0}
              title={name}
              onClick={() => onSelect(name)}
              key={name}
            >
              <span className="character-rail-avatar">
                {covers[name] ? (
                  <img src={covers[name]} alt="" draggable={false} loading="lazy" />
                ) : (
                  name.charAt(0).toUpperCase()
                )}
              </span>
              <span className="character-rail-name">{name}</span>
              <span className="character-rail-count">
                {enabled > 0 ? (
                  <strong>{enabled}</strong>
                ) : null}
                {enabled > 0 ? "/" : ""}
                {character.modCount || 0}
              </span>
            </button>
          );
        })}
        {rows.length === 0 && (
          <div className="character-rail-empty">
            {t("characters.search.noMatches")}
          </div>
        )}
      </div>
    </aside>
  );
}
export { CharacterRail };
