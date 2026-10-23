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
export { remembered, remember, applyCompatibility };
