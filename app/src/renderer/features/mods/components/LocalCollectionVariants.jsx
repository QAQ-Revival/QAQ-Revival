import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
import ReactDOM from "react-dom";
import {
  getLocalVariantLabel,
  cleanLocalCollectionText,
} from "../model/localCollections.js";
function LocalCollectionVariantStrip({
  collection,
  currentPath,
  onSelect,
  compact = false,
}) {
  const variants = Array.isArray(collection?.variants)
    ? collection.variants
    : [];
  if (variants.length < 2) return null;
  return (
    <div
      className={
        compact
          ? "local-collection-variants compact"
          : "local-collection-variants"
      }
    >
      {variants.map((variant) => {
        const active = variant.path === currentPath;
        return (
          <button
            type="button"
            className={`local-collection-variant-chip ${active ? "active" : ""}`}
            title={variant.name}
            onClick={(event) => {
              event.stopPropagation();
              onSelect?.(collection.identity, variant);
            }}
            key={variant.path || variant.name}
          >
            {getLocalVariantLabel(variant)}
          </button>
        );
      })}
    </div>
  );
}
function LocalCollectionGalleryDropdown({
  collection,
  currentPath,
  isOpen,
  onToggle,
  onClose,
  onSelect,
  inline = false,
}) {
  const variants = Array.isArray(collection?.variants)
    ? collection.variants
    : [];
  if (variants.length < 2) return null;
  const currentVariant =
    variants.find((variant) => variant.path === currentPath) || variants[0];
  const triggerLabel =
    cleanLocalCollectionText(currentVariant?._localVersionLabel) ||
    getLocalVariantLabel(currentVariant);
  const [menuRect, setMenuRect] = React.useState({
    left: 12,
    top: 12,
    width: 240,
  });
  const rootRef = React.useRef(null);
  React.useLayoutEffect(() => {
    if (!isOpen) return void 0;
    const root = rootRef.current;
    if (!root) return void 0;
    const updateMenuRect = () => {
      const rect = root.getBoundingClientRect();
      const viewportWidth =
        window.innerWidth || document.documentElement.clientWidth || 0;
      const viewportHeight =
        window.innerHeight || document.documentElement.clientHeight || 0;
      const width = Math.min(240, Math.max(180, viewportWidth - 24));
      const left = Math.min(
        Math.max(12, rect.right - width),
        Math.max(12, viewportWidth - width - 12),
      );
      const belowTop = rect.bottom + 6;
      const aboveTop = rect.top - 194;
      const top =
        belowTop + 188 > viewportHeight - 12 && aboveTop > 12
          ? aboveTop
          : belowTop;
      setMenuRect({
        left,
        top: Math.max(12, top),
        width,
      });
    };
    updateMenuRect();
    window.addEventListener("resize", updateMenuRect);
    window.addEventListener("scroll", updateMenuRect, true);
    return () => {
      window.removeEventListener("resize", updateMenuRect);
      window.removeEventListener("scroll", updateMenuRect, true);
    };
  }, [isOpen]);
  return (
    <div
      ref={rootRef}
      className={`local-collection-gallery-dropdown ${inline ? "inline" : ""}`}
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="local-collection-gallery-trigger"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        title={t("mods.collections.namedHeading", {
          name: collection.name,
        })}
        onClick={(event) => {
          event.stopPropagation();
          onToggle?.(collection.identity);
        }}
        onKeyDown={(event) => {
          if (
            event.key === "ArrowDown" ||
            event.key === "Enter" ||
            event.key === " "
          ) {
            event.preventDefault();
            event.stopPropagation();
            onToggle?.(collection.identity, true);
          }
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            onClose?.();
          }
        }}
      >
        <span className="local-collection-gallery-trigger-main">
          {triggerLabel}
        </span>
      </button>
      {isOpen &&
        ReactDOM.createPortal(
          <div
            className="local-collection-gallery-menu floating"
            role="listbox"
            style={{
              left: `${menuRect.left}px`,
              top: `${menuRect.top}px`,
              width: `${menuRect.width}px`,
            }}
            onClick={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
          >
            {variants.map((variant) => {
              const active = variant.path === currentPath;
              const stateLabel = active
                ? t("common.status.current")
                : variant.enabled
                  ? t("common.actions.enable")
                  : "";
              return (
                <button
                  type="button"
                  className={`local-collection-gallery-option ${active ? "active" : ""}`}
                  role="option"
                  aria-selected={active}
                  title={variant.name}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect?.(collection.identity, variant);
                    onClose?.();
                  }}
                  key={variant.path || variant.name}
                >
                  <span>{getLocalVariantLabel(variant)}</span>
                  {stateLabel && <em>{stateLabel}</em>}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}
export { LocalCollectionGalleryDropdown, LocalCollectionVariantStrip };
