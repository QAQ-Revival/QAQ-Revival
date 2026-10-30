import { t } from "../../../shared/i18n/index.mjs";
import React from "react";
import { Icon } from "../../components/Icon.jsx";
import { GameSettingsPanel } from "./GameSettingsPanel.jsx";
import { SettingsFrame } from "./SettingsControls.jsx";

function getSections(gameId) {
  return [
    ["game-paths", "folder", t("settings.game.pathAndLaunch")],
    ...(["endfield", "genshin-impact", "zzz", "wuthering-waves", "honkai-star-rail"].includes(gameId)
      ? [["xxmi-installer", "box", t("settings.mi.navigation")]]
      : []),
    ...(gameId === "genshin-impact"
      ? [
          ["genshin-anticrash", "shield", t("settings.game.antiError")],
          ["genshin-compatibility", "activity", t("settings.game.compatibility")],
        ]
      : []),
    ...(gameId === "wuthering-waves"
      ? [
          ["wuwa-dx12", "layers", "DX12 Mod"],
          ["wuwa-tuning", "monitor", t("settings.game.rendering")],
        ]
      : []),
    ...(["endfield", "wuthering-waves"].includes(gameId)
      ? [["steam-bridge", "link", t("settings.game.steamBridge")]]
      : []),
    ...(gameId === "neverness-to-everness"
      ? [["pak", "archive", t("settings.game.pakMode")]]
      : []),
    ...(gameId === "arknights"
      ? [
          ["arknights-cursor", "cursor", t("arknights.cursor.title")],
          ["arknights-tools", "wrench", t("arknights.settings.title")],
        ]
      : [
          ["fixer", "wrench", t("settings.game.fixer")],
          ["game-persist", "database", t("settings.categories.persist")],
        ]),
  ];
}

function GameSettingsView({ activeGame }) {
  const [toast, setToast] = React.useState(null);
  const pane = React.useRef(null);
  const following = React.useRef(true);
  const sections = getSections(activeGame?.id);
  const sectionKey = sections.map(([id]) => id).join();
  const [currentId, setCurrentId] = React.useState(sections[0][0]);
  React.useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  // The navigation follows whichever section reaches the top of the pane.
  React.useEffect(() => {
    const element = pane.current;
    if (!element) return;
    const ids = sectionKey.split(",");
    const update = () => {
      if (!following.current) return;
      const line = element.getBoundingClientRect().top + 48;
      let next = ids[0];
      for (const id of ids) {
        const node = document.getElementById(`settings-${id}`);
        if (node && node.getBoundingClientRect().top <= line) next = id;
      }
      if (element.scrollTop + element.clientHeight >= element.scrollHeight - 2)
        next = ids.at(-1);
      setCurrentId(next);
    };
    element.addEventListener("scroll", update, { passive: true });
    return () => element.removeEventListener("scroll", update);
  }, [sectionKey]);
  function jump(id) {
    const element = pane.current;
    const node = document.getElementById(`settings-${id}`);
    if (!element || !node) return;
    setCurrentId(id);
    following.current = false;
    const resume = () => {
      following.current = true;
      clearTimeout(timer);
      element.removeEventListener("scrollend", resume);
    };
    const timer = setTimeout(resume, 900);
    element.addEventListener("scrollend", resume);
    node.scrollIntoView({
      block: "start",
      behavior: "smooth",
    });
  }
  return (
    <SettingsFrame
      scope="game"
      gameId={activeGame?.id}
      gameName={activeGame?.name}
      paneRef={pane}
      toast={toast}
      nav={
        <nav
          className="settings-categories"
          aria-label={t("settings.game.categoryNavigation")}
        >
          {sections.map(([id, icon, label]) => (
            <button
              key={id}
              type="button"
              className="settings-category"
              data-section={id}
              aria-current={currentId === id ? "true" : undefined}
              onClick={() => jump(id)}
            >
              <Icon name={icon} size={15} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      }
    >
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
        <div className="settings-state">{t("settings.game.chooseFirst")}</div>
      )}
    </SettingsFrame>
  );
}
export { GameSettingsView as default };
