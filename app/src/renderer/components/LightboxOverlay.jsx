import { t } from "../../shared/i18n/index.mjs";
import React from "react";
import { MarketImage } from "../features/market/components/MarketImage.jsx";
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
    <div className="lightbox-overlay" onClick={onClose}>
      <button
        className="lightbox-close"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        {"✕"}
      </button>
      {hasMultiple && (
        <React.Fragment>
          <button className="lightbox-nav lightbox-nav-prev" onClick={goPrev}>
            {"‹"}
          </button>
          <button className="lightbox-nav lightbox-nav-next" onClick={goNext}>
            {"›"}
          </button>
          <div
            className="lightbox-counter"
            onClick={(e) => e.stopPropagation()}
          >
            {currentIdx + 1}
            {" / "}
            {images.length}
          </div>
        </React.Fragment>
      )}
      <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
        <MarketImage
          src={images[currentIdx]?.url}
          alt={t("common.actions.preview")}
          className="market-image-lightbox"
          loading="eager"
          fetchPriority="high"
        />
      </div>
    </div>
  );
}
export { LightboxOverlay };
