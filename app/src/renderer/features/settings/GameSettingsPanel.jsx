import { t } from "../../../shared/i18n/index.mjs";
import React from "react";
import { evaluateXxmiImporterPathConsistency } from "../../lib/xxmiPaths.js";
import { WuwaTuningSettings } from "./WuwaTuningSettings.jsx";
import { EfmiVulkanSettings } from "./EfmiVulkanSettings.jsx";
import { EndfieldHdrSettings } from "./EndfieldHdrSettings.jsx";
import { EffSettings } from "./EffSettings.jsx";
import { WuwaDx12Settings } from "./WuwaDx12Settings.jsx";
import { SteamBridgeSettings } from "./SteamBridgeSettings.jsx";
import { GenshinCompatibilitySettings } from "./GenshinCompatibilitySettings.jsx";
import { GenshinAntiErrorSettings } from "./GenshinAntiErrorSettings.jsx";
import {
  ArknightsInputSettings,
  ArknightsSettings,
} from "../arknights/ArknightsTools.jsx";
import { GameVersionSettings } from "./GameVersionSettings.jsx";
import { loaderName } from "./gamePages.js";
import {
  check,
  Button,
  Notice,
  Row,
  PathControl,
  Page,
  PageHead,
  Section,
} from "./SettingsControls.jsx";

function GameSettings({ gameId, page, active = true, updates, notify }) {
  const [data, setData] = React.useState(null);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [revision, setRevision] = React.useState(0);
  // A page mounts on its first visit and is only hidden afterwards.
  const visited = React.useRef(new Set());
  visited.current.add(page);
  React.useEffect(() => {
    let canceled = false;
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
  const reload = React.useCallback(() => setRevision((v) => v + 1), []);
  // The general pages can change what is shown here, so read again when coming back from them.
  const wasActive = React.useRef(active);
  React.useEffect(() => {
    if (active && !wasActive.current) reload();
    wasActive.current = active;
  }, [active, reload]);
  async function act(action, message) {
    if (busy) return;
    setBusy(true);
    try {
      const result = await action();
      if (result?.canceled) return;
      check(result);
      reload();
      notify("success", result.message || message || t("common.status.saved"));
    } catch (e) {
      notify("error", e.message);
    } finally {
      setBusy(false);
    }
  }
  if (error && !data)
    return (
      <div className="settings-state" role="alert">
        {error}
        <Button onClick={reload}>{t("common.actions.reload")}</Button>
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
  const pageOf = (id, render) =>
    visited.current.has(id) && (
      <Page key={id} id={id} active={page === id}>
        {render()}
      </Page>
    );
  return (
    <div className="system-game-detail" data-game-id={game.id} aria-busy={busy}>
      {pageOf("game-paths", () => (
        <React.Fragment>
          <PageHead
            title={t("settings.game.pathAndLaunch")}
            actions={
              <Button
                disabled={busy}
                onClick={() => act(() => window.api.autoDetectPaths(game.id))}
              >
                {t("settings.game.detectPaths")}
              </Button>
            }
          />
          <Section id="game-paths">
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
          </Section>
        </React.Fragment>
      ))}
      {pageOf("loader-overview", () => (
        <React.Fragment>
          <PageHead
            title={loaderName(game.id)}
            description={t("settings.game.loaderSummary")}
            actions={
              <Button
                disabled={busy}
                onClick={() => act(() => window.api.autoDetectPaths(game.id))}
              >
                {t("settings.game.detectPaths")}
              </Button>
            }
          />
          <Section id="loader-paths">
            {game.id !== "arknights" &&
              pathRow(
                isNte
                  ? t("settings.game.nemiLoader")
                  : t("settings.game.xxmiLauncher"),
                isNte ? t("settings.game.nemiHint") : t("settings.game.xxmiHint"),
                game.modLoaderPath,
                () => window.api.selectXxmiPath(game.id),
              )}
            {pathRow(
              t("settings.game.modsFolder"),
              game.id === "arknights"
                ? t("arknights.settings.libraryHint")
                : t("settings.game.modsFolderHint"),
              game.modFolderPath,
              () => window.api.selectModsFolder(game.id),
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
        </React.Fragment>
      ))}
      {pageOf("game-updates", () => (
        <GameVersionSettings
          part="game"
          gameId={game.id}
          gameName={game.name}
          updates={updates}
          notify={notify}
          onPathsChanged={reload}
        />
      ))}
      {pageOf("loader-components", () => (
        <GameVersionSettings
          part="loader"
          gameId={game.id}
          gameName={loaderName(game.id)}
          updates={updates}
          notify={notify}
          onPathsChanged={reload}
        />
      ))}
      {pageOf("arknights-input", () => (
        <ArknightsInputSettings notify={notify} gamePath={game.gamePath} />
      ))}
      {pageOf("arknights-tools", () => (
        <ArknightsSettings notify={notify} gamePath={game.gamePath} />
      ))}
      {pageOf("genshin-anticrash", () => (
        <GenshinAntiErrorSettings />
      ))}
      {pageOf("genshin-compatibility", () => (
        <GenshinCompatibilitySettings onPathsChanged={reload} />
      ))}
      {pageOf("efmi-vulkan", () => (
        <EfmiVulkanSettings />
      ))}
      {pageOf("endfield-hdr", () => <EndfieldHdrSettings />)}
      {pageOf("eff", () => <EffSettings part="overview" />)}
      {pageOf("eff-components", () => <EffSettings part="components" />)}
      {pageOf("wuwa-dx12", () => (
        <WuwaDx12Settings />
      ))}
      {pageOf("wuwa-tuning", () => (
        <WuwaTuningSettings />
      ))}
      {pageOf("steam-bridge", () => (
        <SteamBridgeSettings
          key={`${game.id}:${game.gamePath}`}
          gameId={game.id}
        />
      ))}
      {pageOf("pak", () => (
        <React.Fragment>
          <PageHead title={t("settings.game.pakMode")} />
          <Section id="pak">
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
        </React.Fragment>
      ))}
    </div>
  );
}
export { GameSettings as GameSettingsPanel };
