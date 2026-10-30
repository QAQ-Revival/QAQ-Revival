import React from "react";
import { ThemeContext } from "./ThemeContext.js";

const THEME_STORAGE_KEY = "qaqr.theme";
const THEME_MODES = ["dark", "light", "system"];

function readThemeMode() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return THEME_MODES.includes(stored) ? stored : "dark";
  } catch {
    return "dark";
  }
}

function resolveTheme(mode) {
  if (mode !== "system") return mode;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function ThemeProvider({ children }) {
  const [mode, setModeState] = React.useState(readThemeMode);
  React.useEffect(() => {
    let active = true;
    const apply = () => {
      if (active)
        document.documentElement.setAttribute("data-theme", resolveTheme(mode));
    };
    // Native menus and file pickers follow the same choice as the window.
    const synced = window.api.setNativeTheme?.(mode);
    if (synced?.then) synced.then(apply, apply);
    else apply();
    if (mode !== "system")
      return () => {
        active = false;
      };
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    query.addEventListener("change", apply);
    return () => {
      active = false;
      query.removeEventListener("change", apply);
    };
  }, [mode]);
  const setMode = React.useCallback((next) => {
    if (!THEME_MODES.includes(next)) return;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {}
    setModeState(next);
  }, []);
  const value = React.useMemo(() => ({ mode, setMode }), [mode, setMode]);
  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
export { ThemeProvider };
