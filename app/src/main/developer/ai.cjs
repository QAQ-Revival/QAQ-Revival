"use strict";

const i18n = require("../../shared/i18n/core.cjs");
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const coreLogger = require("../core/logger.cjs");
function normalizeAiBaseUrl(value) {
  const raw = String(value || "").trim().replace(/\/+$/, "");
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    if (!parsed.pathname || parsed.pathname === "/") parsed.pathname = "/v1";
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return raw;
  }
}
function buildAiProviderConfigs(config = {}) {
  const primaryModel = config.model || config.AI_MODEL || "gpt-4o";
  const definitions = [{
    label: "primary",
    baseURL: config.baseURL || config.AI_API_BASE,
    apiKEY: config.apiKEY || config.AI_API_KEY,
    model: primaryModel
  }, {
    label: "secondary",
    baseURL: config.baseURL_2 || config.AI_API_BASE_2,
    apiKEY: config.apiKEY_2 || config.AI_API_KEY_2,
    model: config.model_2 || config.AI_MODEL_2 || primaryModel
  }];
  return definitions.map(provider => ({
    ...provider,
    baseURL: normalizeAiBaseUrl(provider.baseURL)
  })).filter(provider => provider.baseURL && provider.apiKEY);
}
function loadAiEnvConfig() {
  const candidates = [path.join(electron.app.getAppPath(), "..", ".env"), path.join(electron.app.getAppPath(), ".env"), path.join(electron.app.getAppPath(), "..", "..", ".env")];
  for (const envPath of candidates) {
    try {
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, "utf-8");
        const config = {};
        for (const line of content.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;
          const eqIdx = trimmed.indexOf("=");
          if (eqIdx > 0) {
            const key = trimmed.slice(0, eqIdx).trim().replace(/^\uFEFF/, "");
            config[key] = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, "");
          }
        }
        const providers = buildAiProviderConfigs(config);
        if (providers.length > 0) {
          coreLogger.logger.info(`AI config loaded from: ${envPath} (providers=${providers.length})`);
          return config;
        }
      }
    } catch (_) {}
  }
  return null;
}
function parseOpenAiAiContent(raw) {
  const extractText = value => {
    if (typeof value === "string") return value;
    if (!Array.isArray(value)) return "";
    return value.map(part => part?.text || part?.content || "").join("");
  };
  let content = "";
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data: ") || trimmed === "data: [DONE]") continue;
    try {
      const chunk = JSON.parse(trimmed.slice(6));
      const choice = chunk.choices?.[0];
      const chunkContent = extractText(choice?.delta?.content) || extractText(choice?.message?.content) || extractText(choice?.text);
      if (chunkContent) content += chunkContent;
    } catch {}
  }
  if (!content) {
    try {
      const data = JSON.parse(raw);
      content = extractText(data.choices?.[0]?.message?.content) || extractText(data.choices?.[0]?.text);
    } catch {}
  }
  return content;
}
const AI_IMAGE_MIME_ALIASES = {
  "image/jpg": "image/jpeg"
};
const OPENAI_AI_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const ANTHROPIC_AI_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
function normalizeAiImageUrl(url) {
  const rawUrl = String(url || "").trim();
  if (!rawUrl) return null;
  if (/^https?:\/\//i.test(rawUrl)) return {
    url: rawUrl,
    mediaType: ""
  };
  const match = rawUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const mediaType = AI_IMAGE_MIME_ALIASES[match[1].toLowerCase()] || match[1].toLowerCase();
  const data = match[2];
  if (!mediaType || !data) return null;
  return {
    url: `data:${mediaType};base64,${data}`,
    mediaType,
    data
  };
}
function hasAiImageContent(messages) {
  return Array.isArray(messages) && messages.some(message => Array.isArray(message?.content) && message.content.some(part => part?.type === "image_url" || part?.type === "image"));
}
function toOpenAiAiContent(content, {
  dropImages = false
} = {}) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return String(content || "");
  const parts = [];
  for (const part of content) {
    if (part?.type === "text") {
      const text = String(part.text || "");
      if (text) parts.push({
        type: "text",
        text
      });
      continue;
    }
    if (dropImages || part?.type !== "image_url") continue;
    const image = normalizeAiImageUrl(part.image_url?.url || part.url);
    if (!image) continue;
    if (image.mediaType && !OPENAI_AI_IMAGE_TYPES.has(image.mediaType)) continue;
    parts.push({
      type: "image_url",
      image_url: {
        url: image.url
      }
    });
  }
  const hasImage = parts.some(part => part.type === "image_url");
  if (hasImage) return parts;
  return parts.map(part => part.text || "").filter(Boolean).join("\n");
}
function normalizeOpenAiAiMessages(messages, options = {}) {
  return (Array.isArray(messages) ? messages : []).map(message => {
    const role = message?.role === "system" || message?.role === "assistant" ? message.role : "user";
    const content = toOpenAiAiContent(message?.content, options);
    return {
      role,
      content
    };
  }).filter(message => typeof message.content === "string" ? message.content.trim() : Array.isArray(message.content) && message.content.length > 0);
}
function toAnthropicAiContent(content, {
  dropImages = false
} = {}) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return String(content || "");
  const parts = [];
  for (const part of content) {
    if (part?.type === "text") {
      const text = String(part.text || "");
      if (text) parts.push({
        type: "text",
        text
      });
      continue;
    }
    if (dropImages) continue;
    if (part?.type === "image_url") {
      const image = normalizeAiImageUrl(part.image_url?.url || part.url);
      if (image?.data && ANTHROPIC_AI_IMAGE_TYPES.has(image.mediaType)) {
        parts.push({
          type: "image",
          source: {
            type: "base64",
            media_type: image.mediaType,
            data: image.data
          }
        });
      }
    }
  }
  const hasImage = parts.some(part => part.type === "image");
  if (hasImage) return parts;
  return parts.map(part => part.text || "").filter(Boolean).join("\n");
}
function buildAnthropicAiPayload(messages, model, maxTokens, options = {}) {
  const anthropicMessages = [];
  const system = [];
  for (const message of messages) {
    if (message?.role === "system") {
      if (typeof message.content === "string") system.push(message.content);
      continue;
    }
    const content = toAnthropicAiContent(message?.content, options);
    if (typeof content === "string" ? !content.trim() : !Array.isArray(content) || content.length === 0) {
      continue;
    }
    anthropicMessages.push({
      role: message?.role === "assistant" ? "assistant" : "user",
      content
    });
  }
  const numericMaxTokens = Number(maxTokens);
  return {
    model,
    messages: anthropicMessages,
    max_tokens: Number.isFinite(numericMaxTokens) && numericMaxTokens > 0 ? numericMaxTokens : 1e3,
    ...(system.length ? {
      system: system.join("\n")
    } : {})
  };
}
const DEV_AI_SUGGEST_TIMEOUT_MS = 12e4;
const DEV_AI_PROVIDER_TIMEOUT_MS = 6e4;
const DEV_AI_COMPATIBILITY_STATUSES = new Set([400, 404, 405, 415, 422]);
let devAiSuggestRequestSequence = 0;
function createDevAiError(message, {
  code = "",
  status = 0,
  compatibilityRetry = false
} = {}) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  error.compatibilityRetry = compatibilityRetry;
  return error;
}
function summarizeDevAiUpstreamBody(raw, maxLength = 200) {
  const text = String(raw || "").trim();
  if (/<!doctype\s+html|<html[\s>]/i.test(text)) return "HTML error page";
  return text.slice(0, maxLength);
}
function formatDevAiUserError(error) {
  if (error?.code === "AI_TIMEOUT") {
    return i18n.t("backend.developer.ai.serviceTimedOut");
  }
  const status = Number(error?.status || 0);
  if (status === 524 || status === 504) return i18n.t("backend.developer.ai.upstreamTimedOut");
  if (status === 429) return i18n.t("backend.developer.ai.rateLimited");
  if (status >= 500) return i18n.t("backend.developer.ai.serviceUnavailable", {
    status
  });
  if (/fetch failed|network|socket|connect/i.test(String(error?.message || ""))) {
    return i18n.t("backend.developer.ai.connectionFailed");
  }
  return error?.message || String(error);
}
async function fetchDevAiText(url, options, timeoutMs) {
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1e3) {
    throw createDevAiError(i18n.t("backend.developer.ai.aIRequestDeadlineExceeded"), {
      code: "AI_TIMEOUT"
    });
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return {
      response,
      raw: await response.text()
    };
  } catch (error) {
    if (controller.signal.aborted) {
      throw createDevAiError(i18n.t("backend.developer.ai.aIRequestTimedOutAfterS", {
        ceil: Math.ceil(timeoutMs / 1e3)
      }), {
        code: "AI_TIMEOUT"
      });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
async function requestOpenAiDevAiSuggest({
  requestId,
  attemptLabel,
  normalizedBaseUrl,
  apiKEY,
  model,
  messages,
  maxTokens,
  responseFormat,
  temperature,
  dropImages = false,
  tokenParam = "max_tokens",
  timeoutMs
}) {
  const url = `${normalizedBaseUrl}/chat/completions`;
  const numericTemperature = Number(temperature);
  const normalizedMessages = normalizeOpenAiAiMessages(messages, {
    dropImages
  });
  if (normalizedMessages.length === 0) {
    throw new Error(i18n.t("backend.developer.ai.openAICompatibleRequestHasNoUsableMessages"));
  }
  const body = {
    model,
    messages: normalizedMessages,
    stream: true,
    ...(responseFormat ? {
      response_format: responseFormat
    } : {}),
    ...(Number.isFinite(numericTemperature) ? {
      temperature: numericTemperature
    } : {})
  };
  if (Number.isFinite(Number(maxTokens)) && Number(maxTokens) > 0) {
    body[tokenParam] = Number(maxTokens);
  }
  const serializedBody = JSON.stringify(body);
  const startedAt = Date.now();
  coreLogger.logger.info(`[AI suggest ${requestId}] OpenAI attempt=${attemptLabel} start model=${model} timeout=${Math.ceil(timeoutMs / 1e3)}s image=${!dropImages && hasAiImageContent(messages)} payload=${Buffer.byteLength(serializedBody, "utf8")}B tokenParam=${tokenParam}`);
  const {
    response,
    raw
  } = await fetchDevAiText(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKEY}`
    },
    body: serializedBody
  }, timeoutMs);
  const contentType = response.headers?.get?.("content-type") || "";
  if (response.ok && /text\/html/i.test(contentType)) {
    throw createDevAiError(i18n.t("backend.developer.ai.openAICompatibleReturnedHTMLInsteadOfAnAPIResponse"), {
      code: "AI_INVALID_RESPONSE"
    });
  }
  if (!response.ok) {
    throw createDevAiError(i18n.t("backend.developer.ai.openAICompatible", {
      status: response.status,
      devAiUpstreamBody: summarizeDevAiUpstreamBody(raw)
    }), {
      status: response.status,
      compatibilityRetry: DEV_AI_COMPATIBILITY_STATUSES.has(response.status)
    });
  }
  const content = parseOpenAiAiContent(raw).trim();
  if (!content) {
    throw createDevAiError(i18n.t("backend.developer.ai.openAICompatibleReturnedEmptyContent"), {
      code: "AI_EMPTY_RESPONSE",
      compatibilityRetry: true
    });
  }
  coreLogger.logger.info(`[AI suggest ${requestId}] OpenAI attempt=${attemptLabel} success elapsed=${Date.now() - startedAt}ms response=${Buffer.byteLength(raw, "utf8")}B content=${content.length} chars`);
  return content;
}
async function requestAnthropicDevAiSuggest({
  requestId,
  attemptLabel,
  normalizedBaseUrl,
  apiKEY,
  model,
  messages,
  maxTokens,
  dropImages = false,
  timeoutMs
}) {
  const url = `${normalizedBaseUrl}/messages`;
  const body = buildAnthropicAiPayload(messages, model, maxTokens, {
    dropImages
  });
  const serializedBody = JSON.stringify(body);
  const startedAt = Date.now();
  coreLogger.logger.info(`[AI suggest ${requestId}] Anthropic attempt=${attemptLabel} start model=${model} timeout=${Math.ceil(timeoutMs / 1e3)}s image=${!dropImages && hasAiImageContent(messages)} payload=${Buffer.byteLength(serializedBody, "utf8")}B`);
  const {
    response,
    raw
  } = await fetchDevAiText(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKEY,
      "anthropic-version": "2023-06-01",
      "User-Agent": "Mozilla/5.0"
    },
    body: serializedBody
  }, timeoutMs);
  if (!response.ok) {
    throw createDevAiError(i18n.t("backend.developer.ai.anthropicMessages", {
      status: response.status,
      devAiUpstreamBody: summarizeDevAiUpstreamBody(raw)
    }), {
      status: response.status,
      compatibilityRetry: DEV_AI_COMPATIBILITY_STATUSES.has(response.status)
    });
  }
  let data = null;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(i18n.t("backend.developer.ai.anthropicMessagesReturnedInvalidJSON", {
      devAiUpstreamBody: summarizeDevAiUpstreamBody(raw, 120)
    }));
  }
  const content = (Array.isArray(data.content) ? data.content.map(part => part?.text || "").join("") : String(data.content || "")).trim();
  if (!content) {
    throw createDevAiError(i18n.t("backend.developer.ai.anthropicMessagesReturnedEmptyContent"), {
      code: "AI_EMPTY_RESPONSE",
      compatibilityRetry: true
    });
  }
  coreLogger.logger.info(`[AI suggest ${requestId}] Anthropic attempt=${attemptLabel} success elapsed=${Date.now() - startedAt}ms response=${Buffer.byteLength(raw, "utf8")}B content=${content.length} chars`);
  return content;
}
const AI_SUGGEST_CACHE_PATH = path.join(electron.app.getPath("userData"), "ai-suggest-cache.json");
let _aiSuggestDiskCache = null;
function loadAiSuggestCache() {
  if (_aiSuggestDiskCache) return _aiSuggestDiskCache;
  try {
    if (fs.existsSync(AI_SUGGEST_CACHE_PATH)) {
      _aiSuggestDiskCache = JSON.parse(fs.readFileSync(AI_SUGGEST_CACHE_PATH, "utf-8"));
    } else {
      _aiSuggestDiskCache = {};
    }
  } catch {
    _aiSuggestDiskCache = {};
  }
  return _aiSuggestDiskCache;
}
function saveAiSuggestCache() {
  try {
    fs.writeFileSync(AI_SUGGEST_CACHE_PATH, JSON.stringify(_aiSuggestDiskCache || {}, null, 2), "utf-8");
  } catch (e) {
    coreLogger.logger.error("Save AI suggest cache error:", e);
  }
}
function registerIpc() {
  electron.ipcMain.handle("dev:ai-suggest", async (_, {
    messages,
    max_tokens = 1e3,
    response_format,
    temperature
  } = {}) => {
    const requestId = `${Date.now().toString(36)}-${++devAiSuggestRequestSequence}`;
    const requestStartedAt = Date.now();
    const requestDeadline = requestStartedAt + DEV_AI_SUGGEST_TIMEOUT_MS;
    try {
      coreLogger.logger.info(`[AI suggest ${requestId}] received messages=${Array.isArray(messages) ? messages.length : 0}`);
      const envCfg = loadAiEnvConfig();
      if (!envCfg) {
        return {
          success: false,
          error: i18n.t("backend.developer.ai.configurationMissing")
        };
      }
      if (!Array.isArray(messages) || messages.length === 0) {
        return {
          success: false,
          error: i18n.t("backend.developer.ai.messagesEmpty")
        };
      }
      const providers = buildAiProviderConfigs(envCfg);
      if (providers.length === 0) {
        return {
          success: false,
          error: i18n.t("backend.developer.ai.configurationInvalid")
        };
      }
      const responseFormat = response_format && typeof response_format === "object" ? response_format : null;
      const failures = [];
      const containsImage = hasAiImageContent(messages);
      coreLogger.logger.info(`[AI suggest ${requestId}] prepared providers=${providers.length} image=${containsImage} responseFormat=${!!responseFormat} budget=${DEV_AI_SUGGEST_TIMEOUT_MS}ms`);
      for (const provider of providers) {
        const providerDeadline = Math.min(requestDeadline, Date.now() + DEV_AI_PROVIDER_TIMEOUT_MS);
        const remainingProviderTimeout = () => Math.max(0, providerDeadline - Date.now());
        const resolvedModel = provider.model;
        const isGpt5Model = String(resolvedModel).toLowerCase().startsWith("gpt-5");
        const defaultTokenParam = isGpt5Model ? "max_completion_tokens" : "max_tokens";
        const openAiAttempts = [{
          label: "primary",
          dropImages: false,
          responseFormat,
          tokenParam: defaultTokenParam
        }, ...(responseFormat ? [{
          label: "without response_format",
          dropImages: false,
          responseFormat: null,
          tokenParam: defaultTokenParam
        }] : []), ...(containsImage ? [{
          label: "text only",
          dropImages: true,
          responseFormat: null,
          tokenParam: defaultTokenParam
        }] : [])];
        let tryAnthropic = true;
        coreLogger.logger.info(`[AI suggest ${requestId}] provider=${provider.label} start model=${resolvedModel} base=${provider.baseURL} attempts=${openAiAttempts.length}`);
        for (const attempt of openAiAttempts) {
          try {
            const content = await requestOpenAiDevAiSuggest({
              requestId,
              attemptLabel: `${provider.label}/${attempt.label}`,
              normalizedBaseUrl: provider.baseURL,
              apiKEY: provider.apiKEY,
              model: resolvedModel,
              messages,
              maxTokens: max_tokens,
              responseFormat: attempt.responseFormat,
              temperature,
              dropImages: attempt.dropImages,
              tokenParam: attempt.tokenParam,
              timeoutMs: remainingProviderTimeout()
            });
            const elapsedMs = Date.now() - requestStartedAt;
            const completedAttempt = `${provider.label}/${attempt.label}`;
            coreLogger.logger.info(`[AI suggest ${requestId}] completed attempt=${completedAttempt} elapsed=${elapsedMs}ms`);
            return {
              success: true,
              content,
              requestId,
              provider: provider.label,
              attempt: completedAttempt,
              elapsedMs
            };
          } catch (error) {
            const message = error?.message || String(error);
            failures.push(`${provider.label} OpenAI-compatible ${attempt.label}: ${message}`);
            coreLogger.logger.warn(`[AI suggest ${requestId}] provider=${provider.label} OpenAI attempt=${attempt.label} failed: ${message}`);
            if (!error?.compatibilityRetry || remainingProviderTimeout() < 1e3) {
              tryAnthropic = false;
              break;
            }
          }
        }
        if (!tryAnthropic || remainingProviderTimeout() < 1e3) {
          coreLogger.logger.warn(`[AI suggest ${requestId}] switching after provider=${provider.label} OpenAI failure`);
          continue;
        }
        try {
          const content = await requestAnthropicDevAiSuggest({
            requestId,
            attemptLabel: `${provider.label}/primary`,
            normalizedBaseUrl: provider.baseURL,
            apiKEY: provider.apiKEY,
            model: resolvedModel,
            messages,
            maxTokens: max_tokens,
            dropImages: false,
            timeoutMs: remainingProviderTimeout()
          });
          const elapsedMs = Date.now() - requestStartedAt;
          const completedAttempt = `${provider.label}/anthropic-primary`;
          coreLogger.logger.info(`[AI suggest ${requestId}] completed attempt=${completedAttempt} elapsed=${elapsedMs}ms`);
          return {
            success: true,
            content,
            requestId,
            provider: provider.label,
            attempt: completedAttempt,
            elapsedMs
          };
        } catch (error) {
          const message = error?.message || String(error);
          failures.push(`${provider.label} Anthropic Messages primary: ${message}`);
          coreLogger.logger.warn(`[AI suggest ${requestId}] provider=${provider.label} Anthropic attempt=primary failed: ${message}`);
        }
        if (containsImage && remainingProviderTimeout() >= 1e3) {
          try {
            const content = await requestAnthropicDevAiSuggest({
              requestId,
              attemptLabel: `${provider.label}/text-only`,
              normalizedBaseUrl: provider.baseURL,
              apiKEY: provider.apiKEY,
              model: resolvedModel,
              messages,
              maxTokens: max_tokens,
              dropImages: true,
              timeoutMs: remainingProviderTimeout()
            });
            const elapsedMs = Date.now() - requestStartedAt;
            const completedAttempt = `${provider.label}/anthropic-text-only`;
            coreLogger.logger.info(`[AI suggest ${requestId}] completed attempt=${completedAttempt} elapsed=${elapsedMs}ms`);
            return {
              success: true,
              content,
              requestId,
              provider: provider.label,
              attempt: completedAttempt,
              elapsedMs
            };
          } catch (error) {
            const message = error?.message || String(error);
            failures.push(`${provider.label} Anthropic Messages text only: ${message}`);
            coreLogger.logger.warn(`[AI suggest ${requestId}] provider=${provider.label} Anthropic attempt=text-only failed: ${message}`);
          }
        }
        coreLogger.logger.warn(`[AI suggest ${requestId}] exhausted provider=${provider.label}; switching provider`);
      }
      coreLogger.logger.error(`[AI suggest ${requestId}] exhausted elapsed=${Date.now() - requestStartedAt}ms failures=${failures.length}`);
      return {
        success: false,
        error: i18n.t("backend.developer.ai.requestFailed", {
          detail: failures.join("; ").slice(0, 500)
        })
      };
    } catch (e) {
      const elapsedMs = Date.now() - requestStartedAt;
      coreLogger.logger.error(`[AI suggest ${requestId}] failed elapsed=${elapsedMs}ms:`, e);
      return {
        success: false,
        error: formatDevAiUserError(e),
        requestId,
        elapsedMs
      };
    }
  });
  electron.ipcMain.handle("dev:save-ai-suggest-cache", async (_, {
    modPath,
    result
  }) => {
    try {
      const cache = loadAiSuggestCache();
      cache[modPath] = {
        ...result,
        savedAt: new Date().toISOString()
      };
      saveAiSuggestCache();
      return {
        success: true
      };
    } catch (e) {
      return {
        error: e.message
      };
    }
  });
  electron.ipcMain.handle("dev:load-ai-suggest-cache", async (_, {
    modPath
  }) => {
    try {
      const cache = loadAiSuggestCache();
      if (modPath) return {
        success: true,
        result: cache[modPath] || null
      };
      return {
        success: true,
        result: cache
      };
    } catch (e) {
      return {
        success: true,
        result: null
      };
    }
  });
}
module.exports = {
  registerIpc
};
