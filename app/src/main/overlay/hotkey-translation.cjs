const i18n = require("../../shared/i18n/core.cjs");
const ENDPOINT = 'https://translate.googleapis.com/translate_a/single';

// Only prepare the display label; never change the underlying INI section or keys.
function translationText(name) {
  return name.trim().replace(/^swp_[a-f\d]{6,}_/i, '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_+/g, ' ').trim();
}
function createHotkeyTranslator({
  fetch,
  timeoutMs = 10000,
  cacheLimit = 1000
}) {
  const cache = new Map();
  const pending = new Map();
  async function request(text) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const url = new URL(ENDPOINT);
      url.search = new URLSearchParams({
        client: 'gtx',
        sl: 'auto',
        tl: 'zh-CN',
        dt: 't',
        q: text
      }).toString();
      const response = await fetch(url.href, {
        signal: controller.signal,
        credentials: 'omit'
      });
      if (response.status === 429 || response.status === 403) throw Error(i18n.t("backend.hotkeyTranslation.rateLimited"));
      if (!response.ok) throw Error(i18n.t("backend.hotkeyTranslation.serviceUnavailable"));
      const data = await response.json();
      const segments = Array.isArray(data) && data[0];
      if (!Array.isArray(segments) || !segments.length || segments.some(segment => !Array.isArray(segment) || typeof segment[0] !== 'string')) {
        throw Error(i18n.t("backend.hotkeyTranslation.invalidResponse"));
      }
      const translated = segments.map(segment => segment[0]).join('').trim();
      if (!translated) throw Error(i18n.t("backend.hotkeyTranslation.emptyResponse"));
      cache.set(text, translated);
      while (cache.size > cacheLimit) cache.delete(cache.keys().next().value);
      return translated;
    } catch (error) {
      if (controller.signal.aborted) throw Error(i18n.t("backend.hotkeyTranslation.requestTimedOut"));
      if (error?.message?.startsWith('谷歌翻译')) throw error;
      throw Error(i18n.t("backend.hotkeyTranslation.connectionFailed"));
    } finally {
      clearTimeout(timer);
    }
  }
  function translateOne(name) {
    const text = translationText(name);
    if (!text || !/\p{L}/u.test(text)) return Promise.resolve(name);
    if (cache.has(text)) return Promise.resolve(cache.get(text));
    if (!pending.has(text)) pending.set(text, request(text).finally(() => pending.delete(text)));
    return pending.get(text);
  }
  return async function translateNames(names) {
    if (!Array.isArray(names) || names.length > 200 || names.some(name => typeof name !== 'string' || name.length > 512) || names.join('').length > 32768) {
      return {
        success: false,
        error: i18n.t("backend.hotkeyTranslation.hotkeyNamesTooLarge")
      };
    }
    const translations = new Array(names.length);
    let next = 0;
    let failure;
    // Preserve each row's identity instead of splitting a translated multiline blob.
    await Promise.all(Array.from({
      length: Math.min(3, names.length)
    }, async () => {
      while (!failure && next < names.length) {
        const index = next++;
        try {
          translations[index] = await translateOne(names[index]);
        } catch (error) {
          failure = error;
        }
      }
    }));
    return failure ? {
      success: false,
      error: failure.message
    } : {
      success: true,
      translations
    };
  };
}
function registerHotkeyTranslation({
  ipcMain,
  fetch
}) {
  const translate = createHotkeyTranslator({
    fetch
  });
  ipcMain.handle('overlay-translate-hotkey-names', (_, names) => translate(names));
}
module.exports = {
  createHotkeyTranslator,
  registerHotkeyTranslation
};
