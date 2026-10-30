import { t } from "../../shared/i18n/index.mjs";
import React from "react";
import { MarketImage } from "../features/market/components/MarketImage.jsx";
import { Icon } from "./Icon.jsx";
function LightboxOverlay({ images, index, onClose, onChange }) {
  const [currentIdx, setCurrentIdx] = React.useState(index);
  const hasMultiple = images.length > 1;
  React.useEffect(() => {
    setCurrentIdx(index);
  }, [index]);
  React.useEffect(() => {
    function handleKey(e) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (!hasMultiple) return;
      if (e.key === "ArrowLeft") {
        setCurrentIdx((i) => {
          const n = (i - 1 + images.length) % images.length;
          onChange?.(n);
          return n;
        });
      } else if (e.key === "ArrowRight") {
        setCurrentIdx((i) => {
          const n = (i + 1) % images.length;
          onChange?.(n);
          return n;
        });
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [images.length, hasMultiple, onClose, onChange]);
  const goPrev = (e) => {
    e.stopPropagation();
    setCurrentIdx((i) => {
      const n = (i - 1 + images.length) % images.length;
      onChange?.(n);
      return n;
    });
  };
  const goNext = (e) => {
    e.stopPropagation();
    setCurrentIdx((i) => {
      const n = (i + 1) % images.length;
      onChange?.(n);
      return n;
    });
  };
  return (
    <div className="image-viewer" onClick={onClose}>
      <button
        type="button"
        className="image-viewer-btn image-viewer-close"
        aria-label={t("common.actions.close")}
        title={t("common.actions.close")}
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        <Icon name="x" size={18} />
      </button>
      {hasMultiple && (
        <React.Fragment>
          <button
            type="button"
            className="image-viewer-btn image-viewer-prev"
            aria-label={t("common.actions.previousPage")}
            onClick={goPrev}
          >
            <Icon name="chevron-left" size={22} />
          </button>
          <button
            type="button"
            className="image-viewer-btn image-viewer-next"
            aria-label={t("common.actions.nextPage")}
            onClick={goNext}
          >
            <Icon name="chevron-right" size={22} />
          </button>
          <div
            className="image-viewer-count"
            onClick={(e) => e.stopPropagation()}
          >
            {currentIdx + 1}
            {" / "}
            {images.length}
          </div>
        </React.Fragment>
      )}
      <div className="image-viewer-stage" onClick={(e) => e.stopPropagation()}>
        <MarketImage
          src={images[currentIdx]?.url}
          alt={t("common.actions.preview")}
          className="image-viewer-image"
          loading="eager"
          fetchPriority="high"
        />
      </div>
    </div>
  );
}
export { LightboxOverlay };
