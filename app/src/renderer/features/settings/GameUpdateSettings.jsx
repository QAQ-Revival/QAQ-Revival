import React from "react";
import { t } from "../../../shared/i18n/index.mjs";
import { useGameUpdates } from "../../hooks/useGameUpdates.js";
import {
  Button,
  Notice,
  Row,
  Section,
  check as checkResult,
} from "./SettingsControls.jsx";

export function GameUpdateSettings({ gameId, notify }) {
  const { state, error, check, configure } = useGameUpdates(gameId);
  const [opening, setOpening] = React.useState(false);
  const client = state?.client;
  async function openOfficial() {
    setOpening(true);
    try {
      checkResult(
        await window.api.launchGame({ gameId, launchMode: "OFFICIAL" }),
      );
    } catch (failure) {
      notify("error", failure.message);
    } finally {
      setOpening(false);
    }
  }
  return (
    <Section
      id="game-updates"
      title={t("games.updates.title")}
      actions={
        <Button small disabled={state?.checking} onClick={() => check(true)}>
          {t(
            state?.checking ? "games.updates.checking" : "games.updates.check",
          )}
        </Button>
      }
    >
      {(error || state?.storageError) && (
        <Notice kind="danger" role="alert">
          {error || t("games.updates.storageError")}
        </Notice>
      )}
      <Row
        title={t("games.updates.automatic")}
        description={t("games.updates.automaticHint")}
      >
        <input
          type="checkbox"
          aria-label={t("games.updates.automatic")}
          checked={state?.enabled !== false}
          disabled={!state || state.checking}
          onChange={(event) => configure({ enabled: event.target.checked })}
        />
      </Row>
      <Row
        title={t("games.updates.region")}
        description={t("games.updates.regionHint")}
      >
        <select
          aria-label={t("games.updates.region")}
          value={state?.region || "auto"}
          disabled={!state || state.checking}
          onChange={(event) => configure({ region: event.target.value })}
        >
          {["auto", "cn", "global", "bilibili"].map((region) => (
            <option key={region} value={region}>
              {t(`games.updates.regions.${region}`)}
            </option>
          ))}
        </select>
      </Row>
      <Row
        title={t("games.updates.client")}
        description={t(`games.updates.states.${client?.state || "unchecked"}`)}
        details={
          client && (
            <React.Fragment>
              <p>
                {t("games.updates.versions", {
                  installed: client.installed || t("games.updates.unknown"),
                  latest: client.latest || "—",
                })}
                {client.region &&
                  ` · ${t(`games.updates.regions.${client.region}`)}`}
              </p>
              {client.preDownload && (
                <p>
                  {t("games.updates.preDownload", {
                    version: client.preDownload,
                  })}
                </p>
              )}
            </React.Fragment>
          )
        }
      >
        <Button
          disabled={opening}
          primary={client?.updateAvailable}
          onClick={openOfficial}
        >
          {t("games.updates.openOfficial")}
        </Button>
      </Row>
      {(state?.components || []).map((component) => (
        <Row
          key={component.id}
          title={component.id === "Launcher" ? "XXMI Launcher" : component.id}
          description={
            component.error
              ? t("games.updates.failed")
              : !component.installed
                ? t("games.updates.notInstalled")
                : component.updateAvailable
                  ? t("games.updates.componentAvailable")
                  : component.latest
                    ? t("games.updates.states.current")
                    : t("games.updates.states.unchecked")
          }
          details={
            <p>
              {t("games.updates.versions", {
                installed: component.installed || "—",
                latest: component.latest || "—",
              })}
            </p>
          }
        >
          <Button
            ghost
            onClick={() =>
              document
                .getElementById(
                  component.id === "Launcher"
                    ? "settings-xxmi-installer"
                    : "settings-mi-forks",
                )
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
          >
            {t("games.updates.manageComponent")}
          </Button>
        </Row>
      ))}
      {state?.miError && (
        <Notice kind="warning">{t("games.updates.miFailed")}</Notice>
      )}
      {state?.lastCheckedAt > 0 && (
        <p className="settings-state">
          {t("games.updates.lastChecked", {
            time: new Date(state.lastCheckedAt).toLocaleString(),
          })}
        </p>
      )}
    </Section>
  );
}
