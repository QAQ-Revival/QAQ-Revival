import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
import { Icon } from "../../../components/Icon.jsx";
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
  React.useEffect(() => {
    setStatus(src ? "loading" : "empty");
    setRetryCount(0);
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
      className={`market-image ${className} market-image-${status}`}
      style={style}
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
          onLoad={() => setStatus("loaded")}
          onError={handleError}
          draggable={false}
        />
      )}
      {(status === "loading" || !shouldLoad) && status !== "empty" && (
        <div className="market-image-skeleton skeleton" />
      )}
      {status === "error" && (
        <button
          type="button"
          className="market-image-error"
          title={t("market.images.retryHint")}
          onClick={handleRetry}
        >
          <Icon name="image" size={18} />
          <span>{t("market.images.loadFailed")}</span>
        </button>
      )}
      {status === "empty" && (
        <div className="market-image-empty">
          <Icon name="image" size={22} />
        </div>
      )}
    </div>
  );
}
export { MarketImage };
