import React from "react";
import { t } from "../../../shared/i18n/index.mjs";

export default function GachaView() {
  const [state, setState] = React.useState(null);
  const [checked, setChecked] = React.useState(false);
  const [url, setUrl] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [notice, setNotice] = React.useState(null);
  const [poolId, setPoolId] = React.useState(null);
  const [page, setPage] = React.useState(1);
  const applyState = React.useCallback((result) => {
    setState((previous) => ({ ...previous, ...result }));
    if (typeof result.url === "string") setUrl(result.url);
  }, []);
  React.useEffect(() => {
    let live = true;
    const refresh = () =>
      window.api
        .wuwaGachaState()
        .then((result) => {
          if (live) applyState(result);
        })
        .catch(() => {
          if (live) setNotice({ error: true, text: t("gacha.failed") });
        });
    const unsubscribe = window.api.onWuwaGachaProgress((payload) => {
      if (!live) return;
      setState((previous) => ({ ...previous, ...payload }));
      if (!payload.busy) refresh();
    });
    refresh();
    return () => {
      live = false;
      unsubscribe();
    };
  }, [applyState]);

  const summary = state?.summary;
  const snapshot = state?.snapshot;
  const pool =
    summary?.pools.find((item) => item.id === poolId) || summary?.pools[0];
  const pages = Math.max(1, Math.ceil((pool?.five.length || 0) / 50));
  const currentPage = Math.min(page, pages);
  const busy = pending || state?.busy;
  const number = (value) => Number(value || 0).toLocaleString();
  const pity = (value, lowerBound) =>
    lowerBound
      ? t("gacha.lowerBound", { count: number(value) })
      : number(value);

  async function run(action, successKey, { fetched = false } = {}) {
    setPending(true);
    setNotice(null);
    try {
      const result = await action();
      if ("snapshot" in result || "authorized" in result) applyState(result);
      if (result.canceled) {
        if (fetched) setNotice({ text: t("gacha.canceled") });
        return;
      }
      if (!result.success) throw Error(result.error || t("gacha.failed"));
      if (fetched) {
        setNotice({
          text: t(
            result.snapshot?.complete ? "gacha.fetched" : "gacha.partial",
          ),
          warning: !result.snapshot?.complete,
        });
      } else if (successKey) {
        setNotice({ text: t(successKey, { path: result.path }) });
      }
    } catch (error) {
      setNotice({ error: true, text: error.message || t("gacha.failed") });
    } finally {
      setPending(false);
    }
  }
  const exportFile = (format) =>
    run(() => window.api.wuwaGachaExport(format, url), "gacha.saved");

  return (
    <section className="gacha-view" aria-labelledby="gacha-title">
      <header className="gacha-header">
        <div>
          <div className="gacha-eyebrow">WUTHERING WAVES</div>
          <h1 id="gacha-title">{t("gacha.title")}</h1>
          <p>{t("gacha.subtitle")}</p>
        </div>
        <span className="gacha-region">{t("gacha.official")}</span>
      </header>
      {notice && (
        <div
          className={`gacha-notice ${notice.error ? "error" : notice.warning ? "warning" : ""}`}
          role={notice.error ? "alert" : "status"}
        >
          {notice.text}
        </div>
      )}
      {!state ? (
        <p role="status">{t("gacha.loading")}</p>
      ) : !state.authorized ? (
        <div className="gacha-card gacha-consent">
          <h2>{t("gacha.consentTitle")}</h2>
          <p>{t("gacha.consentRead")}</p>
          <p>{t("gacha.consentSend")}</p>
          <div className="gacha-endpoints">
            <code>https://gmserver-api.aki-game2.com/gacha/record/query</code>
            <code>https://gmserver-api.aki-game2.net/gacha/record/query</code>
          </div>
          <p>{t("gacha.consentPrivacy")}</p>
          <label className="gacha-consent-check">
            <input
              type="checkbox"
              checked={checked}
              disabled={pending}
              onChange={(event) => setChecked(event.target.checked)}
            />
            <span>{t("gacha.consentCheck")}</span>
          </label>
          <div className="gacha-actions">
            <button
              type="button"
              className="gacha-primary"
              disabled={!checked || pending}
              onClick={() => run(() => window.api.wuwaGachaAuthorize(checked))}
            >
              {t("gacha.consentUse")}
            </button>
            <span className="gacha-muted">{t("gacha.consentSession")}</span>
          </div>
        </div>
      ) : (
        <>
          <div className="gacha-card gacha-source">
            <p className="gacha-instructions">{t("gacha.instructions")}</p>
            <div className="gacha-actions">
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  run(() => window.api.wuwaGachaExtract(), "gacha.extracted")
                }
              >
                {t("gacha.extract")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  run(
                    () => window.api.wuwaGachaChooseFolder(),
                    "gacha.extracted",
                  )
                }
              >
                {t("gacha.chooseFolder")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  run(() => window.api.wuwaGachaChooseLog(), "gacha.extracted")
                }
              >
                {t("gacha.chooseLog")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  run(() => window.api.wuwaGachaImport(), "gacha.imported")
                }
              >
                {t("gacha.import")}
              </button>
            </div>
            {state.sourcePath && (
              <p className="gacha-log-path">
                {t("gacha.source", { path: state.sourcePath })}
              </p>
            )}
            <label htmlFor="gacha-url">{t("gacha.urlLabel")}</label>
            <input
              id="gacha-url"
              type="url"
              value={url}
              autoComplete="off"
              spellCheck={false}
              disabled={busy}
              placeholder={t("gacha.urlPlaceholder")}
              onChange={(event) => setUrl(event.target.value)}
            />
            <p className="gacha-muted">{t("gacha.urlHelp")}</p>
            <div className="gacha-actions">
              <button
                type="button"
                className="gacha-primary"
                disabled={busy || !url.trim()}
                onClick={() =>
                  run(() => window.api.wuwaGachaFetch(url), null, {
                    fetched: true,
                  })
                }
              >
                {t("gacha.fetch")}
              </button>
              <button
                type="button"
                disabled={busy || !url.trim()}
                onClick={() =>
                  run(() => window.api.wuwaGachaCopy(url), "gacha.copied")
                }
              >
                {t("gacha.copy")}
              </button>
              <button
                type="button"
                disabled={busy || !url.trim()}
                onClick={() => exportFile("url")}
              >
                {t("gacha.saveUrl")}
              </button>
              {state.busy && (
                <button
                  type="button"
                  onClick={() =>
                    window.api
                      .wuwaGachaCancel()
                      .catch(() =>
                        setNotice({ error: true, text: t("gacha.failed") }),
                      )
                  }
                >
                  {t("gacha.cancel")}
                </button>
              )}
            </div>
            {state.busy && (
              <div className="gacha-progress" role="status">
                <progress
                  max={state.progress?.total || 11}
                  value={Math.max(0, (state.progress?.current || 1) - 1)}
                />
                {state.progress && (
                  <span>
                    {t("gacha.progress", {
                      pool: t(`gacha.pools.pool${state.progress.id}`),
                      current: state.progress.current,
                      total: state.progress.total,
                    })}
                  </span>
                )}
              </div>
            )}
          </div>
          {state.warning && (
            <p className="gacha-notice warning" role="alert">
              {state.warning}
            </p>
          )}
          {snapshot && summary ? (
            <>
              <div className="gacha-result-heading">
                <div>
                  <h2>
                    {t("gacha.account", {
                      uid: snapshot.params.player_id,
                      region: t(
                        snapshot.params.svr_area === "global" ||
                          /aki-game\.net|resources-oversea/.test(snapshot.url)
                          ? "gacha.global"
                          : "gacha.cn",
                      ),
                      server: snapshot.params.svr_id,
                    })}
                  </h2>
                  <p>
                    {t("gacha.updated", {
                      time: new Date(snapshot.fetchedAt).toLocaleString(),
                    })}
                  </p>
                </div>
                <div className="gacha-actions">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => exportFile("json")}
                  >
                    {t("gacha.exportJson")}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => exportFile("report")}
                  >
                    {t("gacha.exportReport")}
                  </button>
                </div>
              </div>
              {!snapshot.complete && (
                <div className="gacha-notice warning" role="status">
                  <p>{t("gacha.partial")}</p>
                  <ul>
                    {snapshot.failedPools.map((item) => (
                      <li key={item.id}>
                        {t(`gacha.pools.pool${item.id}`)}：{item.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="gacha-stats">
                {[
                  ["total", number(summary.total)],
                  ["five", number(summary.five)],
                  ["four", number(summary.four)],
                  ["rate", summary.rate.toFixed(2) + "%"],
                ].map(([key, value]) => (
                  <div className="gacha-card" key={key}>
                    <span>{t(`gacha.${key}`)}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
              <div className="gacha-card gacha-results">
                <h2>{t("gacha.overview")}</h2>
                <div className="gacha-table-scroll">
                  <table>
                    <thead>
                      <tr>
                        {["pool", "total", "five", "four", "rate", "pity"].map(
                          (key) => (
                            <th scope="col" key={key}>
                              {t(`gacha.${key}`)}
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {summary.pools.map((item) => (
                        <tr
                          key={item.id}
                          className={pool?.id === item.id ? "selected" : ""}
                        >
                          <th scope="row">
                            <button
                              type="button"
                              aria-pressed={pool?.id === item.id}
                              onClick={() => {
                                setPoolId(item.id);
                                setPage(1);
                              }}
                            >
                              {item.name}
                            </button>
                          </th>
                          <td>{number(item.total)}</td>
                          <td className="gacha-five">
                            {number(item.five.length)}
                          </td>
                          <td>{number(item.four)}</td>
                          <td>{item.rate.toFixed(2)}%</td>
                          <td>{pity(item.pity, item.pityLowerBound)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="gacha-muted gacha-retention">
                  {t("gacha.retention")}
                </p>
              </div>
              {pool && (
                <div className="gacha-card gacha-results">
                  <div className="gacha-details-heading">
                    <h2>{t("gacha.details")}</h2>
                    <select
                      aria-label={t("gacha.pool")}
                      value={pool.id}
                      onChange={(event) => {
                        setPoolId(Number(event.target.value));
                        setPage(1);
                      }}
                    >
                      {summary.pools.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="gacha-muted">
                    {t("gacha.range", { first: pool.first, last: pool.last })}
                  </p>
                  {pool.five.length ? (
                    <>
                      <div className="gacha-table-scroll">
                        <table>
                          <thead>
                            <tr>
                              {["time", "name", "type", "pulls", "banner"].map(
                                (key) => (
                                  <th scope="col" key={key}>
                                    {t(`gacha.${key}`)}
                                  </th>
                                ),
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {pool.five
                              .slice()
                              .reverse()
                              .slice((currentPage - 1) * 50, currentPage * 50)
                              .map((item, index) => (
                                <tr key={index}>
                                  <td>{item.time}</td>
                                  <td className="gacha-five">{item.name}</td>
                                  <td>{item.type}</td>
                                  <td>{pity(item.pity, item.lowerBound)}</td>
                                  <td>{item.banner}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                      {pages > 1 && (
                        <div className="gacha-actions gacha-pagination">
                          <button
                            type="button"
                            disabled={currentPage === 1}
                            onClick={() => setPage(currentPage - 1)}
                          >
                            {t("gacha.previous")}
                          </button>
                          <span>
                            {t("gacha.page", {
                              current: currentPage,
                              total: pages,
                            })}
                          </span>
                          <button
                            type="button"
                            disabled={currentPage === pages}
                            onClick={() => setPage(currentPage + 1)}
                          >
                            {t("gacha.next")}
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="gacha-empty">{t("gacha.noFive")}</p>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="gacha-card gacha-empty">
              <h2>{t("gacha.empty")}</h2>
              <p>{t("gacha.emptyHelp")}</p>
            </div>
          )}
        </>
      )}
      <footer className="gacha-credit">
        <button
          type="button"
          onClick={() =>
            window.api.openExternalUrl(
              "https://github.com/lyndon0na/wuwa-gacha-export",
            )
          }
        >
          {t("gacha.credit")}
        </button>
      </footer>
    </section>
  );
}
