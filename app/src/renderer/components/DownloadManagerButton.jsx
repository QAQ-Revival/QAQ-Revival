import { t } from "../../shared/i18n/index.mjs";
import React from "react";
import { Icon } from "./Icon.jsx";

function DownloadManagerButton() {
  const [summary, setSummary] = React.useState({
    count: 0,
    open: false,
  });
  React.useEffect(() => {
    const update = (event) => setSummary(event.detail);
    window.addEventListener("qaqm:download-summary", update);
    window.dispatchEvent(new CustomEvent("qaqm:request-download-summary"));
    return () => window.removeEventListener("qaqm:download-summary", update);
  }, []);
  return (
    <button
      type="button"
      className="icon-btn topbar-download-button"
      title={t("downloads.title")}
      aria-label={t("downloads.title")}
      aria-expanded={summary.open}
      onClick={(event) => {
        event.stopPropagation();
        window.dispatchEvent(new CustomEvent("qaqm:toggle-download-panel"));
      }}
    >
      <Icon name="download" size={18} />
      {summary.count > 0 && (
        <span className="topbar-download-count">
          {summary.count > 99 ? "99+" : summary.count}
        </span>
      )}
    </button>
  );
}
export { DownloadManagerButton };
