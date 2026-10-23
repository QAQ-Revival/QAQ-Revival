import { t } from "../../shared/i18n/index.mjs";
import React from "react";
import { ThemeContext } from "./ThemeContext.js";
function parseCssVariables(cssVariables) {
  if (!cssVariables) return {};
  if (typeof cssVariables === "string") {
    try {
      const parsed = JSON.parse(cssVariables);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof cssVariables === "object" ? cssVariables : {};
}
function ThemeProvider({ children }) {
  const [skins, setSkins] = React.useState([]);
  const [activeSkinId, setActiveSkinId] = React.useState(null);
  const [loadingSkins, setLoadingSkins] = React.useState(false);
  const appliedVarKeysRef = React.useRef(new Set());
  const themeSwitchTimerRef = React.useRef(null);
  const cacheThemeBootstrap = React.useCallback((skin, variables = null) => {
    try {
      if (!skin || !skin.id) {
        localStorage.removeItem("themeBootstrapSkinId");
        localStorage.removeItem("themeBootstrapCssVars");
        return;
      }
      localStorage.setItem("themeBootstrapSkinId", skin.id);
      const source = variables || parseCssVariables(skin.cssVariables);
      const safeVars = {};
      for (const [key, value2] of Object.entries(source)) {
        if (
          typeof key === "string" &&
          key.startsWith("--") &&
          value2 !== void 0 &&
          value2 !== null &&
          value2 !== ""
        ) {
          safeVars[key] = String(value2);
        }
      }
      localStorage.setItem("themeBootstrapCssVars", JSON.stringify(safeVars));
    } catch {}
  }, []);
  const applyThemeToDom = React.useCallback(
    (skin) => {
      const root = document.documentElement;
      root.setAttribute("data-theme-switching", "true");
      if (themeSwitchTimerRef.current) {
        window.clearTimeout(themeSwitchTimerRef.current);
      }
      for (const key of appliedVarKeysRef.current) {
        root.style.removeProperty(key);
      }
      appliedVarKeysRef.current = new Set();
      if (!skin || !skin.id) {
        root.removeAttribute("data-skin");
        cacheThemeBootstrap(null);
        themeSwitchTimerRef.current = window.setTimeout(() => {
          root.removeAttribute("data-theme-switching");
        }, 180);
        return;
      }
      root.setAttribute("data-skin", skin.id);
      const variables = parseCssVariables(skin.cssVariables);
      for (const [key, value2] of Object.entries(variables)) {
        if (value2 !== void 0 && value2 !== null && value2 !== "") {
          root.style.setProperty(key, value2);
          appliedVarKeysRef.current.add(key);
        }
      }
      cacheThemeBootstrap(skin, variables);
      themeSwitchTimerRef.current = window.setTimeout(() => {
        root.removeAttribute("data-theme-switching");
      }, 180);
    },
    [cacheThemeBootstrap],
  );
  const refreshSkins = React.useCallback(async () => {
    setLoadingSkins(true);
    try {
      const result = await window.api.getSkins();
      if (!result?.success) {
        return {
          success: false,
          error: result?.error || t("settings.theme.loadFailed"),
        };
      }
      const nextSkins = result.skins || [];
      const nextActiveSkinId = result.activeSkinId || null;
      setSkins(nextSkins);
      setActiveSkinId(nextActiveSkinId);
      if (!nextActiveSkinId) {
        applyThemeToDom(null);
        return {
          success: true,
          skins: nextSkins,
          activeSkinId: null,
        };
      }
      const matched = nextSkins.find((skin) => skin.id === nextActiveSkinId);
      if (matched) {
        applyThemeToDom(matched);
        return {
          success: true,
          skins: nextSkins,
          activeSkinId: nextActiveSkinId,
        };
      }
      const activeResult = await window.api.getActiveSkin();
      if (activeResult?.success) {
        applyThemeToDom(activeResult.skin || null);
      }
      return {
        success: true,
        skins: nextSkins,
        activeSkinId: nextActiveSkinId,
      };
    } catch (error) {
      console.error("Failed to refresh skins:", error);
      return {
        success: false,
        error: error.message,
      };
    } finally {
      setLoadingSkins(false);
    }
  }, [applyThemeToDom]);
  const setActiveTheme = React.useCallback(
    async (skinId) => {
      try {
        const nextSkinId = skinId || null;
        const result = await window.api.setActiveSkin(nextSkinId);
        if (!result?.success) {
          return {
            success: false,
            error: result?.error || t("settings.theme.switchFailed"),
          };
        }
        setActiveSkinId(nextSkinId);
        if (!nextSkinId) {
          applyThemeToDom(null);
          return {
            success: true,
          };
        }
        const matched = skins.find((skin) => skin.id === nextSkinId);
        if (matched) {
          applyThemeToDom(matched);
          return {
            success: true,
          };
        }
        const activeResult = await window.api.getActiveSkin();
        if (activeResult?.success) {
          applyThemeToDom(activeResult.skin || null);
        }
        return {
          success: true,
        };
      } catch (error) {
        console.error("Failed to set active theme:", error);
        return {
          success: false,
          error: error.message,
        };
      }
    },
    [applyThemeToDom, skins],
  );
  React.useEffect(() => {
    return () => {
      if (themeSwitchTimerRef.current) {
        window.clearTimeout(themeSwitchTimerRef.current);
      }
    };
  }, []);
  React.useEffect(() => {
    refreshSkins();
  }, [refreshSkins]);
  const value = React.useMemo(
    () => ({
      skins,
      activeSkinId,
      loadingSkins,
      refreshSkins,
      setActiveTheme,
    }),
    [skins, activeSkinId, loadingSkins, refreshSkins, setActiveTheme],
  );
  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
export { ThemeProvider };
