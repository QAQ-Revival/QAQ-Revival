"use strict";

function collectErrorDetails(error, code = "") {
  if (typeof error === "string") return `${code} ${error}`.trim();
  return [code, error?.code, error?.name, error?.message, error?.cause?.code, error?.cause?.name, error?.cause?.message].filter(Boolean).join(" ");
}
function isNetworkDownloadFailure(error, code = "") {
  const details = collectErrorDetails(error, code);
  return String(code || error?.code || "").toUpperCase() === "NETWORK_FETCH_FAILED" || /fetch failed|network|socket|terminated|ECONNRESET|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|UND_ERR|ERR_/i.test(details);
}
module.exports = {
  isNetworkDownloadFailure
};
