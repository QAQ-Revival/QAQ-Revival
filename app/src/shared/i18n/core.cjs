"use strict";
const i18next = require("i18next");
const resources = require("./resources.cjs");

const DEFAULT_LANGUAGE = "zh-CN";
const LANGUAGES = Object.freeze([
  {
    code: DEFAULT_LANGUAGE,
    label:
      resources[DEFAULT_LANGUAGE].translation.settings.language
        .simplifiedChinese,
  },
]);

function normalizeLanguage(language) {
  return LANGUAGES.some((item) => item.code === language)
    ? language
    : DEFAULT_LANGUAGE;
}

function createTranslator(language = DEFAULT_LANGUAGE) {
  const instance = i18next.createInstance();
  instance.init({
    lng: resources[language] ? language : DEFAULT_LANGUAGE,
    fallbackLng: DEFAULT_LANGUAGE,
    resources,
    initAsync: false,
    load: "currentOnly",
    returnNull: false,
    returnEmptyString: false,
    interpolation: { escapeValue: false },
  });
  return instance;
}

const i18n = createTranslator();
const t = (key, values) => i18n.t(key, values);
const getLanguage = () => i18n.language;
const setLanguage = (language) =>
  i18n.changeLanguage(normalizeLanguage(language));

function onLanguageChanged(listener) {
  i18n.on("languageChanged", listener);
  return () => i18n.off("languageChanged", listener);
}

module.exports = {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  normalizeLanguage,
  createTranslator,
  t,
  getLanguage,
  setLanguage,
  onLanguageChanged,
};
