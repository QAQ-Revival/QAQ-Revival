import { t } from "../../../shared/i18n/index.mjs";
import React from "react";
import { evaluateXxmiImporterPathConsistency } from "../../lib/xxmiPaths.js";
import { WuwaTuningSettings } from "./WuwaTuningSettings.jsx";
import { WuwaDx12Settings } from "./WuwaDx12Settings.jsx";
import { SteamBridgeSettings } from "./SteamBridgeSettings.jsx";
import { GenshinCompatibilitySettings } from "./GenshinCompatibilitySettings.jsx";
import { GenshinAntiErrorSettings } from "./GenshinAntiErrorSettings.jsx";
import PersistStateManager from "./PersistStateBrowser.jsx";
import { ArknightsSettings } from "../arknights/ArknightsTools.jsx";
import { XxmiSettings } from "./XxmiSettings.jsx";
import {
  check,
  Button,
  Notice,
  Row,
  PathControl,
  Section,
} from "./SettingsControls.jsx";
function GameSettings({ gameId, notify }) {
  const [data, setData] = React.useState(null);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [revision, setRevision] = React.useState(0);
  React.useEffect(() => {
    let canceled = false;
    setData(null);
    setError("");
    Promise.all([
      window.api.gameGetSettings(gameId),
      window.api.fixGetExePath(gameId),
      gameId === "neverness-to-everness"
        ? window.api.nevernessDx12Status()
        : null,
    ])
      .then(([result, fixer, pak]) => {
        check(result);
        if (!canceled)
          setData({
            ...result,
            fixer: fixer?.exePath || "",
            pak: pak?.success ? pak : null,
          });
      })
      .catch((e) => {
        if (!canceled) setError(e.message);
      });
    return () => {
      canceled = true;
    };
  }, [gameId, revision]);
  async function act(action, message) {
    if (busy) return;
    setBusy(true);
    try {
      const result = await action();
      if (result?.canceled) return;
      check(result);
      setRevision((v) => v + 1);
      notify("success", result.message || message || t("common.status.saved"));
    } catch (e) {
      notify("error", e.message);
    } finally {
      setBusy(false);
    }
  }
  if (error)
    return (
      <div className="settings-state" role="alert">
        {error}
        <Button onClick={() => setRevision((v) => v + 1)}>
          {t("common.actions.reload")}
        </Button>
      </div>
    );
  if (!data)
    return (
      <div className="settings-state" role="status">
        <span className="spinner" />
        {t("settings.game.loading")}
      </div>
    );
  const game = data.game,
    isNte = game.id === "neverness-to-everness";
  const consistency =
    data.xxmiImporterInfo?.supported && game.modFolderPath && game.modLoaderPath
      ? evaluateXxmiImporterPathConsistency({
          modsPath: game.modFolderPath,
          importerPath: data.xxmiImporterInfo.importerPath,
        })
      : null;
  const pathRow = (title, hint, value, action, extra) => (
    <Row title={title} hint={hint} path={true}>
      <PathControl
        label={title}
        value={value}
        disabled={busy}
        onSelect={action && (() => act(action))}
      >
        {extra}
      </PathControl>
    </Row>
  );
  return (
    <div className="system-game-detail" data-game-id={game.id} aria-busy={busy}>
      <Section
        id="game-paths"
        title={t("settings.game.pathAndLaunch")}
        actions={
          <Button
            small={true}
            disabled={busy}
            onClick={() => act(() => window.api.autoDetectPaths(game.id))}
          >
            {t("settings.game.detectPaths")}
          </Button>
        }
      >
        {pathRow(
          t("settings.game.modsFolder"),
          game.id === "arknights"
            ? t("arknights.settings.libraryHint")
            : t("settings.game.modsFolderHint"),
          game.modFolderPath,
          () => window.api.selectModsFolder(game.id),
        )}
        {pathRow(
          t("settings.game.executable"),
          isNte
            ? t("settings.game.nteExecutableHint")
            : t("settings.game.executableHint", {
                executableHint:
                  game.executableHint || t("settings.game.mainExecutable"),
              }),
          game.gamePath,
          () => window.api.selectGamePath(game.id),
        )}
        {pathRow(
          t("settings.game.officialLauncher"),
          t("settings.game.officialLauncherHint"),
          game.officialLauncherPath,
          () => window.api.selectOfficialLauncherPath(game.id),
        )}
        {game.id !== "arknights" &&
          pathRow(
            isNte
              ? t("settings.game.nemiLoader")
              : t("settings.game.xxmiLauncher"),
            isNte ? t("settings.game.nemiHint") : t("settings.game.xxmiHint"),
            game.modLoaderPath,
            () => window.api.selectXxmiPath(game.id),
          )}
        {consistency && consistency.status !== "match" && (
          <Notice kind="warning" role="status">
            {consistency.status === "unconfigured"
              ? t("settings.game.xxmiUnconfigured")
              : t("settings.game.xxmiPathMismatch")}
            {data.xxmiImporterInfo.importerPath && (
              <div className="settings-mono-line">
                {t("settings.game.xxmiImporterPath", {
                  importerPath: data.xxmiImporterInfo.importerPath,
                })}
              </div>
            )}
          </Notice>
        )}
      </Section>
      {game.id === "arknights" && (
        <ArknightsSettings notify={notify} gamePath={game.gamePath} />
      )}
      {["endfield", "genshin-impact", "zzz", "wuthering-waves", "honkai-star-rail"].includes(game.id) && (
        <XxmiSettings
          gameId={game.id}
          notify={notify}
          onPathsChanged={() => setRevision((value) => value + 1)}
        />
      )}
      {game.id === "genshin-impact" && <GenshinAntiErrorSettings />}
      {game.id === "genshin-impact" && (
        <GenshinCompatibilitySettings
          onPathsChanged={() => {
            window.api
              .gameGetSettings(game.id)
              .then((result) => {
                check(result);
                setData((previous) =>
                  previous
                    ? {
                        ...previous,
                        ...result,
                      }
                    : previous,
                );
              })
              .catch((e) => notify("error", e.message));
          }}
        />
      )}
      {game.id === "wuthering-waves" && <WuwaDx12Settings />}
      {game.id === "wuthering-waves" && <WuwaTuningSettings />}
      {["endfield", "wuthering-waves"].includes(game.id) && (
        <SteamBridgeSettings
          key={`${game.id}:${game.gamePath}`}
          gameId={game.id}
        />
      )}
      {isNte && (
        <Section id="pak" title={t("settings.game.pakMode")}>
          {pathRow(
            t("settings.game.pakModsFolder"),
            t("settings.game.pakModsFolderHint"),
            data.pak?.paths?.pakModsDir,
          )}
          {pathRow(
            t("settings.game.disabledPakFolder"),
            t("settings.game.disabledPakFolderHint"),
            data.pak?.paths?.disabledModsDir,
            () => window.api.nevernessDx12SelectDisabledModsDir(),
            <Button
              disabled={busy}
              onClick={() =>
                act(() => window.api.nevernessDx12ResetDisabledModsDir())
              }
            >
              {t("common.actions.restoreDefault")}
            </Button>,
          )}
          {pathRow(
            t("settings.game.pakLauncher"),
            t("settings.game.pakLauncherHint"),
            game.dx12LauncherPath || data.pak?.paths?.dx12LoaderExe,
            async () => {
              const r = await window.api.gameSelectExe(
                t("settings.game.selectPakLauncher"),
              );
              if (r.canceled) return r;
              check(r);
              return window.api.gameUpdate(game.id, {
                dx12LauncherPath: r.path,
              });
            },
            game.dx12LauncherPath && (
              <Button
                disabled={busy}
                onClick={() =>
                  act(() =>
                    window.api.gameUpdate(game.id, {
                      dx12LauncherPath: "",
                    }),
                  )
                }
              >
                {t("settings.game.useBundled")}
              </Button>
            ),
          )}
          <Row
            title={t("settings.game.repairPakLauncher")}
            hint={t("settings.game.repairPakLauncherHint")}
          >
            <Button
              disabled={busy}
              onClick={() =>
                act(
                  () => window.api.nevernessDx12ReinstallLoader(),
                  t("settings.game.pakLauncherReinstalled"),
                )
              }
            >
              {t("common.actions.reinstall")}
            </Button>
          </Row>
        </Section>
      )}
      {game.id !== "arknights" && (
        <Section id="fixer" title={t("settings.game.fixer")}>
          {pathRow(
            t("settings.game.fixerExecutable"),
            t("settings.game.fixerHint"),
            data.fixer,
            () => window.api.fixSelectCustomExe(game.id),
          )}
        </Section>
      )}
      {game.id !== "arknights" && (
        <Section id="game-persist" title={t("settings.categories.persist")}>
          <PersistStateManager key={game.id} gameId={game.id} />
        </Section>
      )}
    </div>
  );
}
export { GameSettings as GameSettingsPanel };
