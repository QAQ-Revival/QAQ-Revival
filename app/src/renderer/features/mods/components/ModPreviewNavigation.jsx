import React from "react";
import { t } from "../../../../shared/i18n/index.mjs";
import { Icon } from "../../../components/Icon.jsx";

export function ModPreviewNavigation({ count, index, onChange }) {
  if (count < 2) return null;
  return <>
    {[-1, 1].map(direction => <button key={direction} type="button"
      className={`mod-preview-arrow ${direction < 0 ? "previous" : "next"}`}
      aria-label={t(direction < 0 ? "mods.preview.previous" : "mods.preview.next")}
      title={t(direction < 0 ? "mods.preview.previous" : "mods.preview.next")}
      onClick={event => { event.stopPropagation(); onChange(direction); }}
      onKeyDown={event => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault(); event.stopPropagation(); onChange(event.key === "ArrowLeft" ? -1 : 1);
        }
      }}>
      <Icon name={direction < 0 ? "chevron-left" : "chevron-right"} size={20} />
    </button>)}
    <span className="mod-preview-counter" aria-live="polite">{index + 1} / {count}</span>
  </>;
}
