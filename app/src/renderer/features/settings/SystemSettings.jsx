import { t } from "../../../shared/i18n/index.mjs";
import React from "react";
import { ThemeContext } from "../../app/ThemeContext.js";
import { SoftwareUpdateSettings } from "./SoftwareUpdates.jsx";
import PersistStateManager from "./PersistStateBrowser.jsx";
import {
  remembered,
  remember,
  applyCompatibility,
} from "./settingsPreferences.js";
import {
  check,
  Button,
  Section,
  Row,
  Choices,
  Range,
  PathControl,
  Icon,
} from "./SettingsControls.jsx";
const h = React.createElement;
const DEFAULT_SERVER = "https://qaqm.top";
const CARD_IMAGE_RATIOS = ["4:3", "16:9", "16:10", "1:1", "3:4"];
function getCategories() {
  return [
    {
      id: "general",
      icon: "sliders",
      label: t("settings.categories.general"),
      desc: t("settings.categories.generalDescription"),
      items: [
        ["window", t("settings.window.title")],
        ["random-launch", t("settings.randomLaunch.title")],
        ["game-visibility", t("settings.gameVisibility.title")],
        ["persist", t("settings.persist.title")],
      ],
    },
    {
      id: "persist",
      icon: "game",
      label: t("settings.categories.persist"),
      desc: t("settings.categories.persistDescription"),
      items: [],
    },
    {
      id: "appearance",
      icon: "palette",
      label: t("settings.categories.appearance"),
      desc: t("settings.categories.appearanceDescription"),
      items: [
        ["theme", t("settings.theme.title")],
        ["scale", t("settings.scale.title")],
        ["mod-cards", t("settings.cards.title")],
        ["compatibility", t("settings.compatibility.title")],
      ],
    },
    {
      id: "downloads",
      icon: "download",
      label: t("settings.categories.downloads"),
      desc: t("settings.categories.downloadsDescription"),
      items: [
        ["cache", t("settings.downloadStorage.title")],
        ["server", t("settings.server.title")],
      ],
    },
    {
      id: "shortcuts",
      icon: "keyboard",
      label: t("settings.categories.shortcuts"),
      desc: t("settings.categories.shortcutsDescription"),
      items: [["overlay", t("settings.overlay.title")]],
    },
    {
      id: "maintenance",
      icon: "tool",
      label: t("settings.categories.maintenance"),
      desc: t("settings.categories.maintenanceDescription"),
      items: [
        ["updates", t("settings.maintenance.loaderUpdates")],
        ["help", t("settings.maintenance.troubleshooting")],
      ],
    },
    {
      id: "about",
      icon: "info",
      label: t("settings.categories.about"),
      desc: t("settings.categories.aboutDescription"),
      items: [],
    },
  ];
}
function SettingsView({ devMode = false, games = [], allGames = [] }) {
  const [categoryId, setCategoryId] = React.useState(() =>
    remembered("qaqm.settings.category", "general"),
  );
  const [appVersion, setAppVersion] = React.useState("");
  const [config, setConfig] = React.useState(null);
  const [overlay, setOverlay] = React.useState({});
  const [download, setDownload] = React.useState(null);
  const [hotkey, setHotkey] = React.useState("");
  const [closeBehavior, setCloseBehavior] = React.useState("ask");
  const [server, setServer] = React.useState(DEFAULT_SERVER);
  const [loadError, setLoadError] = React.useState("");
  const [toast, setToast] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const busyRef = React.useRef(false);
  const [recording, setRecording] = React.useState(false);
  const [draftHotkey, setDraftHotkey] = React.useState("");
  const [updateResult, setUpdateResult] = React.useState(null);
  const [loadTick, setLoadTick] = React.useState(0);
  const pane = React.useRef(null);
  const theme = React.useContext(ThemeContext);
  const category =
    getCategories().find((item) => item.id === categoryId) ||
    getCategories()[0];
  const notify = (type, message) =>
    setToast({
      type,
      message,
    });
  React.useEffect(() => {
    window.api
      .getRuntimeInfo()
      .then((info) => setAppVersion(info.appVersion || ""))
      .catch(() => {});
  }, []);
  React.useEffect(() => {
    let canceled = false;
    setLoadError("");
    Promise.all([
      window.api.getConfig(),
      window.api.overlayGetSettings(),
      window.api.marketGetDownloadSettings(),
      window.api.getOverlayHotkey(),
      window.api.getCloseBehavior(),
    ])
      .then(([c, o, d, k, b]) => {
        [c, o, d, k, b].forEach(check);
        if (canceled) return;
        setConfig(c.config);
        setOverlay(o.settings);
        setDownload(d);
        setHotkey(k.hotkey || "Alt+F");
        setCloseBehavior(
          b.closeBehavior === "exit" ? "quit" : b.closeBehavior || "ask",
        );
        setServer(c.config.serverUrl || DEFAULT_SERVER);
      })
      .catch((e) => {
        if (!canceled) setLoadError(e.message);
      });
    return () => {
      canceled = true;
    };
  }, [loadTick]);
  React.useEffect(() => {
    const handle = (event) => {
      if (getCategories().some((item) => item.id === event.detail?.category))
        chooseCategory(event.detail.category);
    };
    window.addEventListener("qaqm:settings-section", handle);
    return () => window.removeEventListener("qaqm:settings-section", handle);
  }, []);
  React.useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  React.useEffect(() => {
    pane.current?.scrollTo(0, 0);
    setRecording(false);
  }, [category.id]);
  function chooseCategory(id) {
    setCategoryId(id);
    remember("qaqm.settings.category", id);
  }
  async function run(action, message) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await action();
      if (message) notify("success", message);
    } catch (e) {
      notify("error", e.message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function updateConfig(key, value, save, apply) {
    await run(async () => {
      check(await save(value));
      setConfig((previous) => ({
        ...previous,
        [key]: value,
      }));
      apply?.(value);
    });
  }
  async function updateOverlay(key, value) {
    await run(
      async () => {
        check(
          await window.api.overlayUpdateSettings({
            [key]: value,
          }),
        );
        setOverlay((previous) => ({
          ...previous,
          [key]: value,
        }));
      },
      key === "persistBridgeEnabled"
        ? t("settings.persist.restartRequired")
        : undefined,
    );
  }
  async function updateLoader(kind) {
    await run(async () => {
      setUpdateResult(null);
      const name =
        kind === "xxmi"
          ? t("settings.game.xxmiLauncher")
          : t("settings.maintenance.gameComponents");
      const source = await window.api.autoinstallSelectUpdateSource(
        t("settings.maintenance.chooseUpdateSource", {
          name,
        }),
      );
      if (source.canceled) return;
      if (!source.path || source.error)
        throw new Error(
          source.error || t("settings.maintenance.noUpdateSelected"),
        );
      const target = await window.api.autoinstallSelectFolder(
        kind === "xxmi"
          ? t("settings.maintenance.selectExistingXxmi")
          : t("settings.maintenance.selectExistingGamePackage"),
      );
      if (target.canceled) return;
      check(target);
      check(
        kind === "xxmi"
          ? await window.api.autoinstallUpdateXxmi({
              xxmiRootDir: target.path,
              updateSourcePath: source.path,
            })
          : await window.api.autoinstallUpdateGamePackage({
              packageDir: target.path,
              updateSourcePath: source.path,
            }),
      );
      setUpdateResult(
        t("settings.maintenance.updatedPath", {
          name,
          path: target.path,
        }),
      );
    });
  }
  const subitems = category.items;
  const levelValue = Number(config?.compatibilityLevel);
  const level = Number.isFinite(levelValue)
    ? Math.max(0, Math.min(3, levelValue))
    : config?.compatibilityMode
      ? 3
      : 0;
  const marketScale =
    {
      small: 88,
      medium: 100,
      large: 122,
    }[config?.modMarketCardSize] ||
    Number(config?.modMarketCardSize) ||
    100;
  let content;
  if (loadError)
    content = (
      <div className="system-state" role="alert">
        {t("settings.errors.readConfiguration", {
          loadError,
        })}
        <Button onClick={() => setLoadTick((v) => v + 1)}>
          {t("common.actions.reload")}
        </Button>
      </div>
    );
  else if (!config)
    content = (
      <div className="system-state" role="status">
        {t("settings.status.loading")}
      </div>
    );
  else if (category.id === "general")
    content = (
      <React.Fragment>
        <Section id="window" title={t("settings.window.title")}>
          <Row
            title={t("settings.window.closeBehavior")}
            description={t("settings.window.closeBehaviorHint")}
            stacked={true}
          >
            <Choices
              label={t("settings.window.closeBehavior")}
              value={closeBehavior}
              disabled={busy}
              onChange={(value) =>
                run(async () => {
                  check(await window.api.setCloseBehavior(value));
                  setCloseBehavior(value);
                })
              }
              options={[
                {
                  value: "ask",
                  label: t("settings.window.askEveryTime"),
                  desc: t("settings.window.askDescription"),
                },
                {
                  value: "minimize",
                  label: t("settings.window.minimizeToTray"),
                  desc: t("settings.window.trayDescription"),
                },
                {
                  value: "quit",
                  label: t("settings.window.exit"),
                  desc: t("settings.window.exitDescription"),
                },
              ]}
            />
          </Row>
        </Section>
        {h(
          Section,
          {
            id: "random-launch",
            title: t("settings.randomLaunch.title"),
          },
          ...[
            [
              "manager",
              t("settings.randomLaunch.manager"),
              t("settings.randomLaunch.managerHint"),
            ],
            [
              "xxmi",
              t("settings.randomLaunch.xxmi"),
              t("settings.randomLaunch.xxmiHint"),
            ],
          ].map(([key, title, description]) => (
            <Row key={key} title={title} description={description}>
              <input
                type="checkbox"
                role="switch"
                className="system-switch"
                aria-label={title}
                checked={config.randomLaunch?.[key] !== false}
                disabled={busy}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  run(async () => {
                    const result = check(
                      await window.api.updateRandomLaunchSettings({
                        [key]: enabled,
                      }),
                    );
                    setConfig((previous) => ({
                      ...previous,
                      randomLaunch: result.settings,
                    }));
                    notify(
                      "success",
                      result.restartRequired
                        ? t("settings.randomLaunch.managerRestart")
                        : t("settings.randomLaunch.xxmiRestart"),
                    );
                  });
                }}
              />
            </Row>
          )),
        )}
        <Section
          id="game-visibility"
          title={t("settings.gameVisibility.title")}
        >
          <Row
            title={t("settings.gameVisibility.manage")}
            description={t("settings.gameVisibility.description")}
          />
          {allGames.map((game) => {
            const lastVisible = game.hidden !== true && games.length <= 1;
            return (
              <Row
                key={game.id}
                title={game.name}
                description={
                  lastVisible
                    ? t("settings.gameVisibility.keepVisible")
                    : t(
                        game.hidden === true
                          ? "settings.gameVisibility.hidden"
                          : "settings.gameVisibility.shown",
                      )
                }
              >
                <input
                  type="checkbox"
                  role="switch"
                  className="system-switch"
                  checked={game.hidden !== true}
                  disabled={busy || lastVisible}
                  data-game-visibility={game.id}
                  aria-label={t("settings.gameVisibility.toggle", {
                    name: game.name,
                  })}
                  onChange={(event) => {
                    const hidden = !event.target.checked;
                    run(async () => {
                      check(
                        await window.api.gameSetHidden(
                          game.id,
                          hidden,
                          games.find((item) => item.id !== game.id)?.id,
                        ),
                      );
                    });
                  }}
                />
              </Row>
            );
          })}
        </Section>
        <Section id="persist" title={t("settings.persist.title")}>
          <Row
            title={t("settings.persist.perGame")}
            description={t("settings.persist.perGameHint")}
          >
            <Button onClick={() => chooseCategory("persist")}>
              {t("settings.persist.manageGames")}
            </Button>
          </Row>
        </Section>
      </React.Fragment>
    );
  else if (category.id === "persist")
    content = <PersistStateManager games={games} />;
  else if (category.id === "appearance")
    content = (
      <React.Fragment>
        <Section id="theme" title={t("settings.theme.title")}>
          <Row
            title={t("settings.theme.colorTheme")}
            description={t("settings.theme.description")}
            stacked={true}
          >
            <Choices
              label={t("settings.theme.colorTheme")}
              disabled={busy || theme?.loadingSkins}
              value={theme?.activeSkinId || ""}
              onChange={(value) =>
                run(async () => {
                  check(await theme.setActiveTheme(value || null));
                })
              }
              options={[
                {
                  value: "",
                  label: t("settings.theme.default"),
                  desc: t("settings.theme.softLight"),
                },
                ...(theme?.skins || []).map((skin) => ({
                  value: skin.id,
                  label: skin.name || skin.id,
                  desc: skin.description,
                })),
              ]}
            />
          </Row>
        </Section>
        <Section id="scale" title={t("settings.scale.title")}>
          <Row
            title={t("settings.scale.sidebar")}
            description={t("settings.scale.sidebarHint")}
          >
            <Range
              label={t("settings.scale.sidebar")}
              value={Math.round((config.uiZoom || 1) * 100)}
              min={70}
              max={140}
              step={5}
              disabled={busy}
              onChange={(value) =>
                updateConfig("uiZoom", value / 100, window.api.setUiZoom, (v) =>
                  document.documentElement.style.setProperty("--ui-scale", v),
                )
              }
            />
          </Row>
          <Row
            title={t("settings.scale.marketCards")}
            description={t("settings.scale.marketCardsHint")}
          >
            <Range
              label={t("settings.scale.marketCards")}
              value={marketScale}
              min={80}
              max={140}
              disabled={busy}
              onChange={(value) =>
                updateConfig(
                  "modMarketCardSize",
                  value,
                  window.api.setModMarketCardSize,
                  (size) =>
                    window.dispatchEvent(
                      new CustomEvent("qaqm:mod-market-card-size-changed", {
                        detail: {
                          size,
                        },
                      }),
                    ),
                )
              }
            />
          </Row>
          <Row title={t("settings.scale.restoreDefault")}>
            <Button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  check(await window.api.setUiZoom(1));
                  check(await window.api.setModMarketCardSize(100));
                  setConfig((c) => ({
                    ...c,
                    uiZoom: 1,
                    modMarketCardSize: 100,
                  }));
                  document.documentElement.style.setProperty("--ui-scale", "1");
                  window.dispatchEvent(
                    new CustomEvent("qaqm:mod-market-card-size-changed", {
                      detail: {
                        size: 100,
                      },
                    }),
                  );
                })
              }
            >
              {t("settings.scale.restoreFull")}
            </Button>
          </Row>
        </Section>
        <Section id="mod-cards" title={t("settings.cards.downloadCards")}>
          <Row
            title={t("settings.cards.coverRatio")}
            description={t("settings.cards.coverRatioHint")}
            stacked={true}
          >
            <Choices
              label={t("settings.cards.coverRatioLabel")}
              disabled={busy}
              value={
                CARD_IMAGE_RATIOS.includes(config.modDownloadImageRatio)
                  ? config.modDownloadImageRatio
                  : "4:3"
              }
              options={CARD_IMAGE_RATIOS.map((value) => ({
                value,
                label: value,
                ...(value === "4:3"
                  ? {
                      desc: t("settings.theme.default"),
                    }
                  : {}),
              }))}
              onChange={(value) =>
                updateConfig(
                  "modDownloadImageRatio",
                  value,
                  window.api.setModDownloadImageRatio,
                  (ratio) =>
                    document.documentElement.style.setProperty(
                      "--mod-download-image-ratio",
                      ratio.replace(":", " / "),
                    ),
                )
              }
            />
          </Row>
        </Section>
        <Section id="compatibility" title={t("settings.compatibility.title")}>
          <Row
            title={t("settings.compatibility.mode")}
            description={t("settings.compatibility.description")}
            stacked={true}
          >
            <Choices
              label={t("settings.compatibility.mode")}
              value={level}
              disabled={busy}
              onChange={(value) =>
                updateConfig(
                  "compatibilityLevel",
                  value,
                  window.api.setCompatibilityMode,
                  applyCompatibility,
                )
              }
              options={[
                {
                  value: 0,
                  label: t("common.actions.close"),
                  desc: t("settings.compatibility.full"),
                },
                {
                  value: 1,
                  label: t("settings.compatibility.light"),
                  desc: t("settings.compatibility.lightHint"),
                },
                {
                  value: 2,
                  label: t("settings.compatibility.medium"),
                  desc: t("settings.compatibility.mediumHint"),
                },
                {
                  value: 3,
                  label: t("settings.compatibility.minimal"),
                  desc: t("settings.compatibility.minimalHint"),
                },
              ]}
            />
          </Row>
        </Section>
      </React.Fragment>
    );
  else if (category.id === "downloads")
    content = (
      <React.Fragment>
        <Section id="cache" title={t("settings.downloadStorage.title")}>
          <Row
            title={t("settings.downloadStorage.directory")}
            description={t("settings.downloadStorage.description")}
            stacked={true}
          >
            <PathControl
              label={t("settings.downloadStorage.directory")}
              value={download?.cacheDir}
              disabled={busy}
              onSelect={() =>
                run(async () => {
                  const r = await window.api.marketSelectDownloadCacheDir();
                  if (r.canceled) return;
                  check(r);
                  setDownload(r);
                })
              }
            >
              <Button
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const r = check(
                      await window.api.marketResetDownloadCacheDir(),
                    );
                    setDownload(r);
                  })
                }
              >
                {t("common.actions.restoreDefault")}
              </Button>
            </PathControl>
          </Row>
        </Section>
        <Section id="server" title={t("settings.server.title")}>
          <Row
            title={t("settings.server.address")}
            description={t("settings.server.defaultHint", {
              dEFAULT_SERVER: DEFAULT_SERVER,
            })}
            stacked={true}
          >
            <form
              className="system-path-control"
              onSubmit={(event) => {
                event.preventDefault();
                run(async () => {
                  const r = check(
                    await window.api.setServerUrl(
                      server.trim() || DEFAULT_SERVER,
                      {
                        devMode,
                      },
                    ),
                  );
                  setServer(r.serverUrl || server.trim() || DEFAULT_SERVER);
                }, t("settings.server.saved"));
              }}
            >
              <input
                className="system-text-input"
                type="url"
                aria-label={t("settings.server.address")}
                value={server}
                onChange={(e) => setServer(e.target.value)}
                placeholder={DEFAULT_SERVER}
              />
              <Button disabled={busy} onClick={() => setServer(DEFAULT_SERVER)}>
                {t("settings.server.fillDefault")}
              </Button>
              <Button primary={true} type="submit" disabled={busy}>
                {t("common.actions.save")}
              </Button>
            </form>
          </Row>
        </Section>
      </React.Fragment>
    );
  else if (category.id === "shortcuts")
    content = h(
      Section,
      {
        id: "overlay",
        title: t("settings.overlay.title"),
      },
      <Row
        title={t("settings.overlay.toggle")}
        description={t("settings.overlay.toggleHint")}
      >
        <kbd>{hotkey}</kbd>
        <Button
          disabled={busy}
          onClick={() => {
            setRecording(true);
            setDraftHotkey("");
          }}
        >
          {t("settings.overlay.changeHotkey")}
        </Button>
      </Row>,
      recording && (
        <Row
          title={t("settings.overlay.recordHotkey")}
          description={t("settings.overlay.recordHint")}
          stacked={true}
        >
          <div className="system-path-control">
            <input
              autoFocus={true}
              readOnly={true}
              className="system-text-input"
              aria-label={t("settings.overlay.recordHotkey")}
              value={draftHotkey}
              placeholder={t("settings.overlay.pressHotkey")}
              onKeyDown={(event) => {
                if (event.key === "Tab") return;
                event.preventDefault();
                event.stopPropagation();
                if (event.key === "Escape") {
                  setRecording(false);
                  return;
                }
                if (["Control", "Alt", "Shift", "Meta"].includes(event.key))
                  return;
                setDraftHotkey(
                  [
                    event.ctrlKey && "Ctrl",
                    event.altKey && "Alt",
                    event.shiftKey && "Shift",
                    event.metaKey && "Super",
                    event.key === " "
                      ? "Space"
                      : event.key.length === 1
                        ? event.key.toUpperCase()
                        : event.key,
                  ]
                    .filter(Boolean)
                    .join("+"),
                );
              }}
            />
            <Button
              primary={true}
              disabled={busy || !draftHotkey}
              onClick={() =>
                run(async () => {
                  const r = check(
                    await window.api.setOverlayHotkey(draftHotkey),
                  );
                  setHotkey(r.hotkey);
                  setRecording(false);
                }, t("settings.overlay.hotkeySaved"))
              }
            >
              {t("common.actions.save")}
            </Button>
            <Button onClick={() => setRecording(false)}>
              {t("common.actions.cancel")}
            </Button>
          </div>
        </Row>
      ),
      ...[
        [
          "autoReloadEnabled",
          t("settings.overlay.reloadAfterToggle"),
          t("settings.overlay.reloadAfterToggleHint"),
        ],
        [
          "presetAutoReloadEnabled",
          t("settings.overlay.reloadAfterPreset"),
          t("settings.overlay.reloadAfterPresetHint"),
        ],
        [
          "clickableHotkeysEnabled",
          t("settings.overlay.clickModHotkeys"),
          t("settings.overlay.clickModHotkeysHint"),
        ],
      ].map(([key, title, description]) => (
        <Row key={key} title={title} description={description}>
          <input
            type="checkbox"
            role="switch"
            className="system-switch"
            aria-label={title}
            checked={!!overlay[key]}
            disabled={busy}
            onChange={(e) => updateOverlay(key, e.target.checked)}
          />
        </Row>
      )),
      <Row
        title={t("settings.overlay.preview")}
        description={t("settings.overlay.previewHint")}
      >
        <Button
          onClick={() =>
            run(async () => {
              check(await window.api.toggleOverlayFromUI());
            })
          }
        >
          {t("settings.overlay.showOrHide")}
        </Button>
      </Row>,
    );
  else if (category.id === "maintenance")
    content = (
      <React.Fragment>
        <Section id="updates" title={t("settings.maintenance.loaderUpdates")}>
          <Row
            title={t("settings.maintenance.updateXxmi")}
            description={t("settings.maintenance.updateXxmiHint")}
          >
            <Button disabled={busy} onClick={() => updateLoader("xxmi")}>
              {busy
                ? t("common.status.processing")
                : t("settings.maintenance.chooseUpdatePackage")}
            </Button>
          </Row>
          <Row
            title={t("settings.maintenance.updateGameComponents")}
            description={t("settings.maintenance.updateGameComponentsHint")}
          >
            <Button disabled={busy} onClick={() => updateLoader("game")}>
              {busy
                ? t("common.status.processing")
                : t("settings.maintenance.chooseComponentPackage")}
            </Button>
          </Row>
          {updateResult && (
            <div className="system-notice" role="status">
              {updateResult}
            </div>
          )}
        </Section>
        <Section id="help" title={t("settings.maintenance.troubleshooting")}>
          <Row
            title={t("settings.maintenance.modTroubleshooting")}
            description={t("settings.maintenance.helpHint")}
          >
            <Button
              onClick={() =>
                window.api.openExternalUrl("https://www.qaqm.top/faq")
              }
            >
              {t("settings.maintenance.openHelp")}
            </Button>
          </Row>
        </Section>
      </React.Fragment>
    );
  else
    content = (
      <React.Fragment>
        <Section id="about" title={t("settings.about.appInfo")}>
          <Row
            title="QAQ-Revival"
            description={t("settings.about.description")}
          >
            <span className="system-version">{appVersion}</span>
          </Row>
        </Section>
        <SoftwareUpdateSettings />
      </React.Fragment>
    );
  return (
    <div className="settings-view system-settings">
      <aside className="system-settings-nav">
        <div className="system-settings-title">
          <h1>{t("navigation.systemSettings")}</h1>
          <p>{t("settings.about.preferences")}</p>
        </div>
        <nav aria-label={t("settings.about.categoryNavigation")}>
          {getCategories().map((item) => (
            <React.Fragment key={item.id}>
              <button
                type="button"
                className="system-category"
                data-category={item.id}
                aria-current={category.id === item.id ? "page" : undefined}
                disabled={busy}
                onClick={() => chooseCategory(item.id)}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </button>
              {category.id === item.id && subitems.length > 0 && (
                <div className="system-subnav">
                  {subitems.map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      data-subsection={id}
                      disabled={busy}
                      onClick={() =>
                        document
                          .getElementById(`settings-${id}`)
                          ?.scrollIntoView({
                            block: "start",
                            behavior: "smooth",
                          })
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </React.Fragment>
          ))}
        </nav>
        <p className="system-nav-footnote">
          {t("settings.about.autoSave")}
          <span>{t("settings.about.explicitSaveHint")}</span>
        </p>
      </aside>
      <div className="system-settings-pane" ref={pane}>
        <header className="system-settings-header">
          <div>
            <div className="system-breadcrumb">
              {t("settings.about.heading", {
                label: category.label,
              })}
            </div>
            <h2>{category.label}</h2>
            <p>{category.desc}</p>
          </div>
          <span className="system-scope">
            {category.id === "persist"
              ? t("settings.about.perGame")
              : t("settings.about.global")}
          </span>
        </header>
        <div className="system-settings-body">{content}</div>
      </div>
      {toast && (
        <div
          className={`system-toast ${toast.type}`}
          role={toast.type === "error" ? "alert" : "status"}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
export { SettingsView as default };
