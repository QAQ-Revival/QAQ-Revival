import React from "react";
import { t } from "../../../shared/i18n/index.mjs";
import { Icon } from "../../components/Icon.jsx";
import { Menu, MenuItem } from "../../components/Menu.jsx";

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
  // Bars compare pulls within the selected pool, so no pity cap has to be assumed.
  const longestPull = Math.max(1, ...(pool?.five || []).map((item) => item.pity || 0));

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
    <section className="page gacha-view" aria-labelledby="gacha-title">
      <header className="page-header">
        <div className="page-heading">
          <h1 id="gacha-title" className="page-title">
            {t("gacha.title")}
          </h1>
          <span className="page-subtitle">{t("gacha.official")}</span>
        </div>
        {state?.authorized && snapshot && summary && (
          <div className="page-actions">
            <Menu
              label={t("common.actions.export")}
              trigger={({ props }) => (
                <button type="button" className="btn" disabled={busy} {...props}>
                  <Icon name="upload" size={15} />
                  {t("common.actions.export")}
                </button>
              )}
            >
              <MenuItem
                icon={<Icon name="file" size={15} />}
                disabled={busy}
                onClick={() => exportFile("json")}
              >
                {t("gacha.exportJson")}
              </MenuItem>
              <MenuItem
                icon={<Icon name="file" size={15} />}
                disabled={busy}
                onClick={() => exportFile("report")}
              >
                {t("gacha.exportReport")}
              </MenuItem>
            </Menu>
          </div>
        )}
      </header>
      <div className="page-body gacha-body">
        {notice && (
          <div
            className={`gacha-notice notice ${notice.error ? "error notice-danger" : notice.warning ? "warning notice-warning" : "notice-success"}`}
            role={notice.error ? "alert" : "status"}
          >
            <Icon name={notice.error || notice.warning ? "alert" : "check"} size={14} />
            <span>{notice.text}</span>
          </div>
        )}
        {!state ? (
          <div className="gacha-state" role="status">
            <span className="spinner" />
            {t("gacha.loading")}
          </div>
        ) : !state.authorized ? (
          <div className="gacha-consent">
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
                className="btn btn-primary gacha-primary"
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
            <div className="gacha-source">
              <div className="gacha-source-row">
                <input
                  id="gacha-url"
                  className="input"
                  type="url"
                  value={url}
                  autoComplete="off"
                  spellCheck={false}
                  disabled={busy}
                  placeholder={t("gacha.urlPlaceholder")}
                  aria-label={t("gacha.urlLabel")}
                  title={t("gacha.urlHelp")}
                  onChange={(event) => setUrl(event.target.value)}
                />
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  title={t("gacha.instructions")}
                  onClick={() =>
                    run(() => window.api.wuwaGachaExtract(), "gacha.extracted")
                  }
                >
                  {t("gacha.extract")}
                </button>
                <button
                  type="button"
                  className="btn btn-primary gacha-primary"
                  disabled={busy || !url.trim()}
                  onClick={() =>
                    run(() => window.api.wuwaGachaFetch(url), null, {
                      fetched: true,
                    })
                  }
                >
                  {t("gacha.fetch")}
                </button>
                {state.busy && (
                  <button
                    type="button"
                    className="btn"
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
                <Menu
                  label={t("common.actions.more")}
                  trigger={({ props }) => (
                    <button
                      type="button"
                      className="icon-btn"
                      title={t("common.actions.more")}
                      aria-label={t("common.actions.more")}
                      {...props}
                    >
                      <Icon name="more" size={16} strokeWidth={2.4} />
                    </button>
                  )}
                >
                  <MenuItem
                    icon={<Icon name="folder" size={15} />}
                    disabled={busy}
                    onClick={() =>
                      run(
                        () => window.api.wuwaGachaChooseFolder(),
                        "gacha.extracted",
                      )
                    }
                  >
                    {t("gacha.chooseFolder")}
                  </MenuItem>
                  <MenuItem
                    icon={<Icon name="file" size={15} />}
                    disabled={busy}
                    onClick={() =>
                      run(() => window.api.wuwaGachaChooseLog(), "gacha.extracted")
                    }
                  >
                    {t("gacha.chooseLog")}
                  </MenuItem>
                  <MenuItem
                    icon={<Icon name="download" size={15} />}
                    disabled={busy}
                    onClick={() =>
                      run(() => window.api.wuwaGachaImport(), "gacha.imported")
                    }
                  >
                    {t("gacha.import")}
                  </MenuItem>
                  <div className="menu-sep" />
                  <MenuItem
                    icon={<Icon name="copy" size={15} />}
                    disabled={busy || !url.trim()}
                    onClick={() =>
                      run(() => window.api.wuwaGachaCopy(url), "gacha.copied")
                    }
                  >
                    {t("gacha.copy")}
                  </MenuItem>
                  <MenuItem
                    icon={<Icon name="link" size={15} />}
                    disabled={busy || !url.trim()}
                    onClick={() => exportFile("url")}
                  >
                    {t("gacha.saveUrl")}
                  </MenuItem>
                </Menu>
              </div>
              {state.sourcePath && (
                <p className="gacha-log-path" title={state.sourcePath}>
                  {t("gacha.source", { path: state.sourcePath })}
                </p>
              )}
              {state.busy && (
                <div className="gacha-progress" role="status">
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${(Math.max(0, (state.progress?.current || 1) - 1) / (state.progress?.total || 11)) * 100}%`,
                      }}
                    />
                  </div>
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
              <p className="gacha-notice notice warning notice-warning" role="alert">
                <Icon name="alert" size={14} />
                <span>{state.warning}</span>
              </p>
            )}
            {snapshot && summary ? (
              <>
                <div className="gacha-account">
                  <span>
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
                  </span>
                  <span className="gacha-muted">
                    {t("gacha.updated", {
                      time: new Date(snapshot.fetchedAt).toLocaleString(),
                    })}
                  </span>
                </div>
                {!snapshot.complete && (
                  <div className="gacha-notice notice warning notice-warning" role="status">
                    <Icon name="alert" size={14} />
                    <div>
                      <p>{t("gacha.partial")}</p>
                      <ul>
                        {snapshot.failedPools.map((item) => (
                          <li key={item.id}>
                            {t(`gacha.pools.pool${item.id}`)}：{item.error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
                <div className="gacha-stats">
                  {[
                    ["total", number(summary.total), ""],
                    ["five", number(summary.five), "is-five"],
                    ["four", number(summary.four), "is-four"],
                    ["rate", summary.rate.toFixed(2) + "%", ""],
                  ].map(([key, value, rarity]) => (
                    <div className={`gacha-stat ${rarity}`.trim()} key={key}>
                      <span>{t(`gacha.${key}`)}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
                <div className="gacha-results">
                  <h2>{t("gacha.overview")}</h2>
                  <div className="gacha-table-scroll">
                    <table>
                      <thead>
                        <tr>
                          {["pool", "total", "five", "four", "rate", "pity"].map(
                            (key) => (
                              <th
                                scope="col"
                                key={key}
                                className={key === "pool" ? "" : "is-number"}
                              >
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
                            <td className="is-number">{number(item.total)}</td>
                            <td className="is-number gacha-five">
                              {number(item.five.length)}
                            </td>
                            <td className="is-number gacha-four">
                              {number(item.four)}
                            </td>
                            <td className="is-number">{item.rate.toFixed(2)}%</td>
                            <td className="is-number">
                              {pity(item.pity, item.pityLowerBound)}
                            </td>
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
                  <div className="gacha-results">
                    <div className="gacha-details-heading">
                      <h2>{t("gacha.details")}</h2>
                      <span className="gacha-muted">
                        {t("gacha.range", { first: pool.first, last: pool.last })}
                      </span>
                      <select
                        className="select"
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
                                    <td className="gacha-time">{item.time}</td>
                                    <td className="gacha-five">{item.name}</td>
                                    <td>{item.type}</td>
                                    <td className="gacha-pulls">
                                      <span className="gacha-pulls-value">
                                        {pity(item.pity, item.lowerBound)}
                                      </span>
                                      <span className="gacha-pulls-track" aria-hidden={true}>
                                        <span
                                          className="gacha-pulls-bar"
                                          style={{
                                            width: `${((item.pity || 0) / longestPull) * 100}%`,
                                          }}
                                        />
                                      </span>
                                    </td>
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
                              className="btn btn-sm"
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
                              className="btn btn-sm"
                              disabled={currentPage === pages}
                              onClick={() => setPage(currentPage + 1)}
                            >
                              {t("gacha.next")}
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="gacha-state">{t("gacha.noFive")}</p>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="empty-state">
                <div className="empty-title">{t("gacha.empty")}</div>
                <div className="empty-text">{t("gacha.emptyHelp")}</div>
              </div>
            )}
          </>
        )}
        <footer className="gacha-credit">
          <button
            type="button"
            className="link-btn"
            onClick={() =>
              window.api.openExternalUrl(
                "https://github.com/lyndon0na/wuwa-gacha-export",
              )
            }
          >
            {t("gacha.credit")}
          </button>
        </footer>
      </div>
    </section>
  );
}
