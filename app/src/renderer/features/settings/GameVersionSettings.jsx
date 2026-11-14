import React from "react";
import { t } from "../../../shared/i18n/index.mjs";
import { XxmiSettings } from "./XxmiSettings.jsx";
import { usesXxmi } from "./gamePages.js";
import {
  Button,
  ComponentCard,
  Notice,
  PageHead,
  Row,
  Section,
  Switch,
  VersionRow,
  check as checkResult,
} from "./SettingsControls.jsx";

const CLIENT_STATUS = { current: "current", available: "update", error: "error" };
// States that need the user to do something read as warnings; the rest are plain notes.
const CLIENT_WARNINGS = ["available", "incomplete", "verify", "regionRequired", "unconfigured"];

// Versions of one module: `game` is the client and its update checks, `loader` the Launcher and the MI components.
// Both share one check, which reads the client and the components together.
export function GameVersionSettings({
  part = "game",
  gameId,
  gameName,
  updates,
  notify,
  onPathsChanged,
}) {
  const { state, error, check, configure } = updates;
  const [opening, setOpening] = React.useState(false);
  const [checkedTick, setCheckedTick] = React.useState(0);
  const loader = part === "loader";
  const hasXxmi = usesXxmi(gameId) && loader;
  const client = state?.client;
  const clientState = client?.state || "unchecked";
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
  async function checkAll() {
    await check(true);
    setCheckedTick((value) => value + 1);
  }
  return (
    <React.Fragment>
      <PageHead
        title={
          loader
            ? t("settings.game.componentsTitle", { name: gameName })
            : t("settings.game.gameUpdate")
        }
        description={
          state?.lastCheckedAt > 0
            ? t("games.updates.lastChecked", {
                time: new Date(state.lastCheckedAt).toLocaleString(),
              })
            : t("games.updates.states.unchecked")
        }
        actions={
          <Button
            data-action="check-updates"
            disabled={!state || state.checking}
            onClick={checkAll}
          >
            {t(
              state?.checking ? "games.updates.checking" : "settings.mi.check",
            )}
          </Button>
        }
      />
      {!loader && <Section id="game-updates" title={t("settings.game.gameSection")} plain>
        {(error || state?.storageError) && (
          <Notice kind="danger" role="alert">
            {error || t("games.updates.storageError")}
          </Notice>
        )}
        <ComponentCard
          data-component="client"
          name={gameName}
          tag={t("games.updates.client")}
          rows={
            <VersionRow
              channel="client"
              name={
                client?.region
                  ? t(`games.updates.regions.${client.region}`)
                  : t("settings.versions.official")
              }
              local={client?.installed || t("games.updates.unknown")}
              latest={client?.latest}
              status={CLIENT_STATUS[clientState]}
              actions={
                <Button
                  small
                  disabled={opening}
                  onClick={openOfficial}
                >
                  {t("games.updates.openOfficial")}
                </Button>
              }
            />
          }
        >
          {!["current", "unchecked"].includes(clientState) && (
            <p
              className={
                CLIENT_WARNINGS.includes(clientState)
                  ? "settings-warning-text"
                  : clientState === "error"
                    ? "settings-error"
                    : undefined
              }
            >
              {t(`games.updates.states.${clientState}`)}
            </p>
          )}
          {client?.preDownload && (
            <p>
              {t("games.updates.preDownload", { version: client.preDownload })}
            </p>
          )}
        </ComponentCard>
      </Section>}
      {hasXxmi && (
        <XxmiSettings
          gameId={gameId}
          notify={notify}
          onPathsChanged={onPathsChanged}
          checkedTick={checkedTick}
          checkedAt={state?.lastCheckedAt || 0}
          checkFailed={!!state?.miError}
        />
      )}
      {!loader && <Section id="update-options" title={t("settings.game.updateOptions")}>
        <Row
          title={t("games.updates.automatic")}
          description={t("games.updates.automaticHint")}
        >
          <Switch
            label={t("games.updates.automatic")}
            checked={state?.enabled !== false}
            disabled={!state || state.checking}
            onChange={(enabled) => configure({ enabled })}
          />
        </Row>
        <Row
          title={t("games.updates.region")}
          description={t("games.updates.regionHint")}
        >
          <select
            className="select settings-compact-select"
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
      </Section>}
    </React.Fragment>
  );
}
