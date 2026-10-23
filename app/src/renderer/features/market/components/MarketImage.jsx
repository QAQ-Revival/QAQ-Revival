import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
function MarketImage({
  src,
  alt = "",
  className = "",
  imgClassName = "",
  loading = "lazy",
  fetchPriority = "auto",
  onClick,
  style,
  retryLimit = 2,
}) {
  const rootRef = React.useRef(null);
  const [visible, setVisible] = React.useState(loading === "eager");
  const [status, setStatus] = React.useState(src ? "loading" : "empty");
  const [retryCount, setRetryCount] = React.useState(0);
  const [naturalRatio, setNaturalRatio] = React.useState(null);
  React.useEffect(() => {
    setStatus(src ? "loading" : "empty");
    setRetryCount(0);
    setNaturalRatio(null);
  }, [src]);
  React.useEffect(() => {
    if (visible || loading === "eager") return void 0;
    const node = rootRef.current;
    if (!node) return void 0;
    if (!("IntersectionObserver" in window)) {
      setVisible(true);
      return void 0;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries.some(
            (entry) => entry.isIntersecting || entry.intersectionRatio > 0,
          )
        ) {
          setVisible(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: "280px 0px",
      },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loading, visible]);
  const shouldLoad = !!src && visible;
  const requestSrc = shouldLoad
    ? retryCount > 0
      ? `${src}${src.includes("?") ? "&" : "?"}qaqm_img_retry=${retryCount}`
      : src
    : void 0;
  const ratioClass = naturalRatio
    ? naturalRatio >= 1.72
      ? " market-image-wide"
      : naturalRatio >= 1.45
        ? " market-image-landscape"
        : naturalRatio <= 0.85
          ? " market-image-portrait"
          : " market-image-standard"
    : "";
  function handleError() {
    if (retryCount < retryLimit) {
      const nextRetry = retryCount + 1;
      setTimeout(
        () => {
          setRetryCount(nextRetry);
          setStatus("loading");
        },
        Math.min(1200 * nextRetry, 3200),
      );
      return;
    }
    setStatus("error");
  }
  function handleRetry(e) {
    e.stopPropagation();
    setRetryCount((count) => count + 1);
    setStatus("loading");
    setVisible(true);
  }
  return (
    <div
      ref={rootRef}
      className={`market-image ${className} market-image-${status}${ratioClass}`}
      style={{
        ...style,
        ...(naturalRatio
          ? {
              "--natural-ratio": naturalRatio,
            }
          : {}),
      }}
      onClick={onClick}
    >
      {requestSrc && status !== "error" && (
        <img
          src={requestSrc}
          alt={alt}
          className={imgClassName}
          loading={loading}
          decoding="async"
          fetchpriority={fetchPriority}
          onLoad={(e) => {
            const img = e.currentTarget;
            if (img?.naturalWidth && img?.naturalHeight) {
              const ratio = img.naturalWidth / img.naturalHeight;
              if (Number.isFinite(ratio) && ratio > 0) {
                setNaturalRatio(ratio);
              }
            }
            setStatus("loaded");
          }}
          onError={handleError}
          draggable={false}
        />
      )}
      {(status === "loading" || !shouldLoad) && (
        <div className="market-image-skeleton" />
      )}
      {status === "error" && (
        <button
          type="button"
          className="market-image-error"
          onClick={handleRetry}
        >
          <span>{"🖼️"}</span>
          <strong>{t("market.images.loadFailed")}</strong>
          <em>{t("market.images.retryHint")}</em>
        </button>
      )}
      {status === "empty" && <div className="market-image-empty">{"🖼️"}</div>}
    </div>
  );
}
export { MarketImage };
