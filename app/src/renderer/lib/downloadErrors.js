import { t } from "../../shared/i18n/index.mjs";
function collectErrorDetails(error, code = "") {
  if (typeof error === "string") return `${code} ${error}`.trim();
  return [
    code,
    error?.code,
    error?.name,
    error?.message,
    error?.cause?.code,
    error?.cause?.name,
    error?.cause?.message,
  ]
    .filter(Boolean)
    .join(" ");
}
function isNetworkDownloadFailure(error, code = "") {
  const details = collectErrorDetails(error, code);
  return (
    String(code || error?.code || "").toUpperCase() ===
      "NETWORK_FETCH_FAILED" ||
    /fetch failed|network|socket|terminated|ECONNRESET|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|UND_ERR|ERR_/i.test(
      details,
    )
  );
}
function normalizeNetdiskUrl(value) {
  const url = String(value || "").trim();
  return /^https?:\/\//i.test(url) ? url : "";
}
function getMarketNetdiskLinks(mod) {
  if (!mod || typeof mod !== "object") return [];
  const links = [
    {
      source: "baidu",
      label: t("market.sources.baiduDrive"),
      url: normalizeNetdiskUrl(mod.downloadUrl),
    },
    {
      source: "quark",
      label: t("market.sources.quarkDrive"),
      url: normalizeNetdiskUrl(mod.quarkDownloadUrl),
    },
  ];
  return links.filter((link) => link.url);
}
export { isNetworkDownloadFailure, getMarketNetdiskLinks };
