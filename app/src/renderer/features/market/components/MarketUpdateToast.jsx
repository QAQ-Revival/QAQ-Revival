import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
const MAX_VISIBLE = 3;
function MarketUpdateToast({ mods, onDismiss, onModClick }) {
  if (!mods || mods.length === 0) return null;
  const visible = mods.slice(0, MAX_VISIBLE);
  const extra = mods.length - MAX_VISIBLE;
  return (
    <div className="market-toast">
      <div className="market-toast-header">
        <span className="market-toast-title">
          <span className="market-toast-dot" />
          {t("market.updates.prefix")}
          {mods.length}
          {t("market.updates.countSuffix")}
        </span>
        <button
          className="market-toast-close"
          onClick={onDismiss}
          title={t("common.actions.close")}
        >
          {"✕"}
        </button>
      </div>
      <div className="market-toast-list">
        {visible.map((mod) => (
          <button
            className="market-toast-item"
            onClick={() => onModClick(mod)}
            title={mod.name}
            key={mod.id}
          >
            <div className="market-toast-img">
              {mod.imageUrl ? (
                <img src={mod.imageUrl} alt={mod.name} loading="lazy" />
              ) : (
                <span className="market-toast-img-placeholder">{"🎮"}</span>
              )}
            </div>
            <div className="market-toast-info">
              <div className="market-toast-mod-name">{mod.name}</div>
              {mod.description && (
                <div className="market-toast-mod-desc">{mod.description}</div>
              )}
              {mod.characterName && (
                <div className="market-toast-mod-char">{mod.characterName}</div>
              )}
            </div>
            <span className="market-toast-arrow">{"›"}</span>
          </button>
        ))}
      </div>
      {extra > 0 && (
        <div className="market-toast-extra">
          {t("market.updates.moreCount", {
            extra,
          })}
        </div>
      )}
    </div>
  );
}
export { MarketUpdateToast as default };
