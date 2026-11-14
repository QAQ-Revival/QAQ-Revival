const CATEGORY_KEY = "qaqm.settings.category";
const GAME_PAGE_KEY = "qaqm.settings.gamePage";
function remembered(key, fallback) {
  try {
    return sessionStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}
function remember(key, value) {
  try {
    sessionStorage.setItem(key, value);
  } catch {}
}
// Opens settings on one page: `category` for a general page, `section` for a page of the current game.
function openSettings({ category, section } = {}) {
  if (category) remember(CATEGORY_KEY, category);
  if (section) remember(GAME_PAGE_KEY, section);
  window.dispatchEvent(
    new CustomEvent("qaqm:settings-section", {
      detail: { category, section },
    }),
  );
  window.dispatchEvent(
    new CustomEvent("qaqm-navigate", {
      detail: { tab: section ? "game-settings" : "settings" },
    }),
  );
}
function applyCompatibility(level) {
  for (const element of [document.documentElement, document.body]) {
    element.classList.toggle("qaqm-compat-mode", level > 0);
    for (let i = 1; i <= 3; i++)
      element.classList.toggle(`qaqm-compat-level-${i}`, level === i);
  }
  window.dispatchEvent(
    new CustomEvent("qaqm:compatibility-mode-changed", {
      detail: {
        enabled: level > 0,
        level,
      },
    }),
  );
}
export {
  CATEGORY_KEY,
  GAME_PAGE_KEY,
  remembered,
  remember,
  openSettings,
  applyCompatibility,
};
