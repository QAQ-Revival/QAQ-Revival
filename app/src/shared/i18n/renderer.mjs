import { t, getLanguage, setLanguage, onLanguageChanged } from "./index.mjs";

// preload exposes i18nGetLanguage(), i18nSetLanguage(code), and
// onLanguageChanged(listener), whose return value removes the IPC listener.
export async function initializeRendererI18n(
  api,
  root = document.documentElement,
) {
  const update = (language) => setLanguage(language);
  const unsubscribe = onLanguageChanged((language) => {
    root.lang = language;
  });
  const removeListener = api.onLanguageChanged(update);
  try {
    const result = await api.i18nGetLanguage();
    if (!result.success) throw Error(result.error);
    await update(result.language);
    root.lang = getLanguage();
  } catch (error) {
    removeListener();
    unsubscribe();
    throw error;
  }
  return () => {
    removeListener();
    unsubscribe();
  };
}

export async function changeLanguage(api, language) {
  const result = await api.i18nSetLanguage(language);
  if (!result.success)
    throw Error(result.error || t("settings.language.saveFailed"));
  await setLanguage(result.language);
  return result;
}
