import React from "react";
import { createRoot } from "react-dom/client";
import App from "./app/App.jsx";
import { getLanguage, onLanguageChanged } from "../shared/i18n/index.mjs";
import { initializeRendererI18n } from "../shared/i18n/renderer.mjs";
import "./styles/index.css";
function LocalizedApp() {
  const language = React.useSyncExternalStore(onLanguageChanged, getLanguage);
  return <App key={language} />;
}
async function start() {
  try {
    await initializeRendererI18n(window.api);
  } catch (error) {
    console.error("Unable to read language settings", error);
  }
  createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <LocalizedApp />
    </React.StrictMode>,
  );
}
start();
