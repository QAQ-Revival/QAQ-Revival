import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
import { Icon } from "../../../components/Icon.jsx";
const MAX_VISIBLE = 3;
function MarketUpdateToast({ mods, onDismiss, onModClick }) {
  if (!mods || mods.length === 0) return null;
  const visible = mods.slice(0, MAX_VISIBLE);
  const extra = mods.length - MAX_VISIBLE;
  return (
    <div className="market-toast" role="status">
      <div className="market-toast-header">
        <strong>
          {t("market.updates.title", {
            count: mods.length,
          })}
        </strong>
        <button
          type="button"
          className="icon-btn icon-btn-sm"
          onClick={onDismiss}
          title={t("common.actions.close")}
          aria-label={t("common.actions.close")}
        >
          <Icon name="x" size={14} />
        </button>
      </div>
      <div className="market-toast-list">
        {visible.map((mod) => (
          <button
            type="button"
            className="market-toast-item"
            onClick={() => onModClick(mod)}
            title={mod.name}
            key={mod.id}
          >
            <span className="market-toast-img">
              {mod.imageUrl ? (
                <img src={mod.imageUrl} alt="" loading="lazy" />
              ) : (
                <Icon name="image" size={16} />
              )}
            </span>
            <span className="market-toast-info">
              <span className="market-toast-mod-name">{mod.name}</span>
              {mod.characterName && (
                <span className="market-toast-mod-char">
                  {mod.characterName}
                </span>
              )}
            </span>
            <Icon name="chevron-right" size={14} />
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
