import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
function FittingTagRow({ tags, selectedTags, onToggleTag }) {
  const containerRef = React.useRef(null);
  const orderedTags = React.useMemo(() => {
    if (!selectedTags || selectedTags.size === 0) return tags;
    const sel = [];
    const unsel = [];
    for (const t of tags) {
      if (selectedTags.has(String(t).toLowerCase())) sel.push(t);
      else unsel.push(t);
    }
    return [...sel, ...unsel];
  }, [tags, selectedTags]);
  const [visibleCount, setVisibleCount] = React.useState(orderedTags.length);
  const [measured, setMeasured] = React.useState(false);
  React.useLayoutEffect(() => {
    setVisibleCount(orderedTags.length);
    setMeasured(false);
  }, [orderedTags]);
  React.useLayoutEffect(() => {
    if (measured) return;
    const el = containerRef.current;
    if (!el) return;
    const chips = Array.from(el.querySelectorAll("[data-fit-chip]"));
    if (!chips.length) return;
    const moreEl = el.querySelector("[data-fit-more]");
    const moreW = moreEl ? moreEl.offsetWidth : 32;
    const containerW = el.clientWidth;
    const gap = 4;
    let used = 0;
    let fitted = 0;
    for (let i = 0; i < chips.length; i++) {
      const w = chips[i].offsetWidth;
      const remaining = chips.length - i - 1;
      const reserve = remaining > 0 ? moreW + gap : 0;
      const cost = w + (i > 0 ? gap : 0);
      if (used + cost + reserve > containerW) break;
      used += cost;
      fitted++;
    }
    const final = Math.max(1, fitted);
    if (final !== orderedTags.length) setVisibleCount(final);
    setMeasured(true);
  });
  React.useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let lastWidth = el.clientWidth;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      if (w === lastWidth || w === 0) return;
      lastWidth = w;
      setVisibleCount(orderedTags.length);
      setMeasured(false);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [orderedTags.length]);
  const visible = orderedTags.slice(0, visibleCount);
  const hidden = orderedTags.slice(visibleCount);
  return (
    <div ref={containerRef} className="mod-row-tag-row">
      {visible.map((tag, ti) => {
        const active =
          selectedTags && selectedTags.has(String(tag).toLowerCase());
        return (
          <span
            data-fit-chip={true}
            title={
              active
                ? t("mods.tags.removeFilterHint", {
                    tag,
                  })
                : t("mods.tags.addFilterHint", {
                    tag,
                  })
            }
            onClick={(e) => {
              e.stopPropagation();
              onToggleTag && onToggleTag(String(tag));
            }}
            key={`fit-${ti}`}
            className={active ? "mod-row-tag-chip-active" : "mod-row-tag-chip"}
          >
            {"#"}
            {tag}
          </span>
        );
      })}
      {hidden.length > 0 && (
        <span
          data-fit-more={true}
          title={hidden.map((t) => `#${t}`).join("  ")}
          className="mod-row-tag-more"
        >
          {"+"}
          {hidden.length}
        </span>
      )}
    </div>
  );
}
export { FittingTagRow };
