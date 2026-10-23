import { t } from "../../../shared/i18n/index.mjs";
import React from "react";
import { Button, Section, Row, Choices, check } from "./SettingsControls.jsx";
function SteamBridgeSettings({ gameId }) {
  const [data, setData] = React.useState(null),
    [options, setOptions] = React.useState(null);
  const [busy, setBusy] = React.useState(false),
    [error, setError] = React.useState(""),
    [message, setMessage] = React.useState("");
  const alive = React.useRef(true),
    inFlight = React.useRef(false);
  async function refresh(draft) {
    const result = check(
      await window.api.steamBridgeStatus({
        gameId,
        ...(draft
          ? {
              options: draft,
            }
          : {}),
      }),
    );
    if (alive.current) {
      setData({
        ...result.games[0],
        automation: result.automation,
      });
      setOptions(result.games[0].options);
    }
  }
  async function act(action) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (failure) {
      if (alive.current) setError(failure.message);
    } finally {
      inFlight.current = false;
      if (alive.current) setBusy(false);
    }
  }
  React.useEffect(() => {
    alive.current = true;
    act(() => refresh());
    return () => {
      alive.current = false;
    };
  }, [gameId]);
  const edit = (key, value) =>
    setOptions((previous) => ({
      ...previous,
      [key]: value,
    }));
  const apply = (all) =>
    act(async () => {
      const result = await window.api.steamBridgeApply({
        gameId,
        options,
        all,
      });
      if (result?.canceled) return;
      try {
        check(result);
        if (alive.current) setMessage(result.message);
      } finally {
        await refresh();
      }
    });
  const restore = () =>
    act(async () => {
      const result = await window.api.steamBridgeRestore({
        gameId,
      });
      if (result?.canceled) return;
      try {
        check(result);
        if (alive.current) setMessage(result.message);
      } finally {
        await refresh();
      }
    });
  const pathValue = (label, value) => (
    <input
      className="system-path"
      readOnly={true}
      aria-label={label}
      value={value || ""}
      title={value || t("settings.steam.notDetected")}
      placeholder={t("settings.steam.notDetected")}
    />
  );
  const checks = data && [
    [
      "Steam",
      !!data.steamRoot,
      data.steamRoot
        ? t("settings.steam.detected")
        : t("settings.steam.installAndLogin"),
    ],
    [
      t("settings.steam.library"),
      data.accountKnown && data.owned,
      data.accountKnown
        ? data.owned
          ? t("settings.steam.gameOwned")
          : t("settings.steam.addToLibrary")
        : data.accountError || t("settings.steam.waitingLogin"),
    ],
    [
      t("settings.steam.client"),
      data.clientReady,
      data.clientStatus || t("settings.steam.gamePathRequired"),
    ],
    [
      t("settings.steam.version"),
      data.metadataReady,
      data.metadataReady
        ? t("settings.steam.cacheAvailable")
        : t("settings.steam.refreshMetadataHint"),
    ],
  ];
  return (
    <Section id="steam-bridge" title={t("settings.game.steamBridge")}>
      <Row
        title={
          data?.installed
            ? data.phase === "enabled"
              ? t("settings.steam.configured")
              : t("settings.steam.incompleteHint")
            : t("settings.steam.title")
        }
        description={t("settings.steam.description")}
      >
        <Button
          disabled={busy}
          onClick={() =>
            act(async () =>
              check(
                await window.api.steamBridgeOpenLibrary({
                  gameId,
                }),
              ),
            )
          }
        >
          {t("settings.steam.openLibrary")}
        </Button>
      </Row>
      {options && (
        <React.Fragment>
          <Row
            title={t("settings.steam.launchMode")}
            description={t("settings.steam.launchDescription")}
            stacked={true}
          >
            <Choices
              label={t("settings.steam.launchModeLabel")}
              disabled={busy}
              value={options.launchMethod}
              onChange={(value) => edit("launchMethod", value)}
              options={[
                {
                  value: "qaqr",
                  label: "QAQR",
                  desc: t("settings.steam.currentManager"),
                },
                {
                  value: "official",
                  label: t("settings.steam.officialLauncher"),
                  desc: t("settings.steam.officialLauncherHint"),
                },
              ]}
            />
          </Row>
          {gameId === "endfield" && (
            <Row title={t("settings.steam.endfieldServer")}>
              <Choices
                label={t("settings.steam.serverLabel")}
                disabled={busy}
                value={options.channelId}
                onChange={(value) => edit("channelId", value)}
                options={[
                  {
                    value: "official",
                    label: t("settings.steam.officialServer"),
                  },
                  {
                    value: "bilibili",
                    label: t("settings.steam.bilibiliServer"),
                  },
                ]}
              />
            </Row>
          )}
          <Row
            title={t("settings.steam.officialLauncher")}
            description={t("settings.steam.detectLauncherHint")}
            stacked={true}
          >
            <div className="system-path-control">
              {pathValue(
                t("settings.steam.officialLauncherLabel"),
                options.launcher,
              )}
              <Button
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    const result = await window.api.steamBridgeSelectLauncher({
                      gameId,
                    });
                    if (result?.canceled) return;
                    check(result);
                    if (alive.current) edit("launcher", result.launcher);
                  })
                }
              >
                {t("settings.steam.selectLauncher")}
              </Button>
            </div>
          </Row>
          <Row
            title={t("settings.game.executable")}
            description={t("settings.steam.gameExecutableHint")}
            stacked={true}
          >
            {pathValue(t("settings.steam.gameExecutableLabel"), data.gamePath)}
          </Row>
          {options.launchMethod === "qaqr" && (
            <Row
              title={t("settings.steam.managedSession")}
              description={
                options.qaqrSteamManaged
                  ? t("settings.steam.managedSessionHint")
                  : t("settings.steam.independentSessionHint")
              }
            >
              <input
                type="checkbox"
                role="switch"
                className="system-switch"
                aria-label={t("settings.steam.managedSessionLabel")}
                disabled={busy}
                checked={!!options.qaqrSteamManaged}
                onChange={(event) =>
                  edit("qaqrSteamManaged", event.target.checked)
                }
              />
            </Row>
          )}
          <Row
            title={t("settings.steam.autoSync")}
            description={t("settings.steam.autoSyncHint")}
          >
            <input
              type="checkbox"
              role="switch"
              className="system-switch"
              aria-label={t("settings.steam.autoSync")}
              disabled={busy}
              checked={options.autoSync !== false}
              onChange={(event) => edit("autoSync", event.target.checked)}
            />
          </Row>
        </React.Fragment>
      )}
      {checks && (
        <div className="steam-bridge-checks" role="status">
          {checks.map(([label, ready, detail]) => (
            <div key={label} className={ready ? "ready" : "missing"}>
              <span aria-hidden={true}>{ready ? "✓ " : "· "}</span>
              <strong>{label + "："}</strong>
              {detail}
            </div>
          ))}
        </div>
      )}
      <div className="wuwa-tuning-actions steam-bridge-actions">
        <Button
          primary={true}
          disabled={busy || !options}
          onClick={() => apply(false)}
        >
          {t("settings.steam.applyCurrent")}
        </Button>
        <Button disabled={busy || !options} onClick={() => apply(true)}>
          {t("settings.steam.applyBoth")}
        </Button>
        <Button disabled={busy || !data?.installed} onClick={restore}>
          {t("settings.steam.restoreCurrent")}
        </Button>
        <Button disabled={busy} onClick={() => act(() => refresh(options))}>
          {t("settings.steam.detectAgain")}
        </Button>
      </div>
      {busy && (
        <p className="system-notice" role="status">
          {t("settings.steam.processing")}
        </p>
      )}
      {message && (
        <p className="system-notice" role="status">
          {message}
        </p>
      )}
      {data?.automation?.message && (
        <p className="system-notice" role="status">
          {data.automation.message}
        </p>
      )}
      {data?.automation?.warnings?.length > 0 && (
        <p className="system-notice" role="status">
          {data.automation.warnings.join("；")}
        </p>
      )}
      {(error || data?.error || data?.automation?.error) && (
        <p className="system-notice" role="alert">
          {error || data.error || data.automation.error}
        </p>
      )}
    </Section>
  );
}
export { SteamBridgeSettings };
