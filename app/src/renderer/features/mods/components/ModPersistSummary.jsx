import { t } from "../../../../shared/i18n/index.mjs";
import React from "react";
import {
  openPersistManager,
  PersistVariables,
} from "../../settings/PersistStateBrowser.jsx";
function ModPersistSummary({ gameId, characterName, modName }) {
  const [data, setData] = React.useState(null),
    [error, setError] = React.useState("");
  React.useEffect(() => {
    let canceled = false;
    setData(null);
    setError("");
    window.api
      .persistBridgeMod(gameId, characterName, modName)
      .then((result) => {
        if (!result?.success)
          throw Error(result?.error || t("mods.persist.readFailed"));
        if (!canceled) setData(result);
      })
      .catch((e) => {
        if (!canceled) setError(e.message);
      });
    return () => {
      canceled = true;
    };
  }, [gameId, characterName, modName]);
  return (
    <section
      className="mod-persist-summary"
      aria-label={t("mods.persist.fullTitle")}
    >
      <div className="persist-detail-heading">
        <strong>{t("mods.persist.title")}</strong>
        <button
          type="button"
          className="system-button"
          onClick={() => openPersistManager(gameId, characterName, modName)}
        >
          {t("mods.persist.openManager")}
        </button>
      </div>
      {error ? (
        <p role="alert">{error}</p>
      ) : !data ? (
        <p role="status">{t("common.status.reading")}</p>
      ) : (
        <React.Fragment>
          <p>
            {t("mods.persist.configurationCount", {
              status: data.game.enabled
                ? t("mods.persist.enabledForGame")
                : t("mods.persist.disabledForGame"),
              entriesCount: data.entries.length,
            })}
          </p>
          {data.entries.length ? (
            <details>
              <summary>{t("mods.persist.viewVariables")}</summary>
              <PersistVariables entries={data.entries} />
            </details>
          ) : (
            <p>{t("mods.persist.noSavedConfiguration")}</p>
          )}
        </React.Fragment>
      )}
    </section>
  );
}
export { ModPersistSummary as default };
