import { t } from "../../../shared/i18n/index.mjs";
import React from "react";
import { GameSettingsPanel } from "./GameSettingsPanel.jsx";
import { Icon } from "./SettingsControls.jsx";
function GameSettingsView({ activeGame }) {
  const [toast, setToast] = React.useState(null);
  React.useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  const sections = [
    ["game-paths", t("settings.game.pathAndLaunch")],
    ...(["endfield", "genshin-impact", "zzz", "wuthering-waves", "honkai-star-rail"].includes(activeGame?.id) ? [["xxmi-installer", t("settings.mi.navigation")]] : []),
    ...(activeGame?.id === "genshin-impact"
      ? [
          ["genshin-anticrash", t("settings.game.antiError")],
          ["genshin-compatibility", t("settings.game.compatibility")],
        ]
      : []),
    ...(activeGame?.id === "wuthering-waves"
      ? [
          ["wuwa-dx12", "DX12 Mod"],
          ["wuwa-tuning", t("settings.game.rendering")],
        ]
      : []),
    ...(["endfield", "wuthering-waves"].includes(activeGame?.id)
      ? [["steam-bridge", t("settings.game.steamBridge")]]
      : []),
    ...(activeGame?.id === "neverness-to-everness"
      ? [["pak", t("settings.game.pakMode")]]
      : []),
    ...(activeGame?.id === "arknights"
      ? [["arknights-cursor", t("arknights.cursor.title")], ["arknights-tools", t("arknights.settings.title")]]
      : [["fixer", t("settings.game.fixer")], ["game-persist", t("settings.categories.persist")]]),
  ];
  return (
    <div
      className="settings-view system-settings game-settings-view"
      data-game-id={activeGame?.id}
    >
      <aside className="system-settings-nav">
        <div className="system-settings-title">
          <h1>{t("navigation.gameSettings")}</h1>
          <p>{activeGame?.name || t("navigation.currentGame")}</p>
        </div>
        <nav aria-label={t("settings.game.categoryNavigation")}>
          {sections.map(([id, label]) => (
            <button
              key={id}
              type="button"
              className="system-category"
              onClick={() =>
                document.getElementById(`settings-${id}`)?.scrollIntoView({
                  block: "start",
                  behavior: "smooth",
                })
              }
            >
              <Icon name={id === "fixer" ? "tool" : "game"} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <p className="system-nav-footnote">
          {t("settings.game.followsSelection")}
          <span>{t("settings.game.savedIndependently")}</span>
        </p>
      </aside>
      <div className="system-settings-pane">
        <header className="system-settings-header">
          <div>
            <div className="system-breadcrumb">
              {t("settings.game.heading", {
                name: activeGame?.name,
              })}
            </div>
            <h2>{activeGame?.name || t("navigation.gameSettings")}</h2>
            <p>{t("settings.game.pageDescription")}</p>
          </div>
          <span className="system-scope">{t("settings.game.currentOnly")}</span>
        </header>
        <div className="system-settings-body">
          {activeGame?.id ? (
            <GameSettingsPanel
              key={activeGame.id}
              gameId={activeGame.id}
              notify={(type, message) =>
                setToast({
                  type,
                  message,
                })
              }
            />
          ) : (
            <div className="system-state">{t("settings.game.chooseFirst")}</div>
          )}
        </div>
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
export { GameSettingsView as default };
