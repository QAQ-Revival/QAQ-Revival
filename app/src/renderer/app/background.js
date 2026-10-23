const DEFAULT_BG_OPACITY = 0.5;
const DEFAULT_BG_BLUR = 4;
const DEFAULT_BG_OVERLAY = 0.3;
function normalizeCompatibilityLevel(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(3, Math.max(0, Math.round(number)));
}
function getCompatibilityLevel(config = {}) {
  if (config.compatibilityLevel !== void 0) {
    return normalizeCompatibilityLevel(config.compatibilityLevel);
  }
  return config.compatibilityMode ? 3 : 0;
}
function applyCompatibilityModeClass(level) {
  if (typeof document === "undefined") return;
  const normalizedLevel = normalizeCompatibilityLevel(level);
  const enabled = normalizedLevel > 0;
  document.documentElement.classList.toggle("qaqm-compat-mode", enabled);
  document.body?.classList.toggle("qaqm-compat-mode", enabled);
  for (let i = 1; i <= 3; i += 1) {
    document.documentElement.classList.toggle(
      `qaqm-compat-level-${i}`,
      normalizedLevel === i,
    );
    document.body?.classList.toggle(
      `qaqm-compat-level-${i}`,
      normalizedLevel === i,
    );
  }
}
function getPersonalizationStorageKey(gameId, key) {
  return `personalization:${gameId || "global"}:${key}`;
}
function readScopedBackgroundState(gameId) {
  const customBg =
    localStorage.getItem(getPersonalizationStorageKey(gameId, "customBgUrl")) ||
    null;
  const bgOpacity = parseFloat(
    localStorage.getItem(
      getPersonalizationStorageKey(gameId, "customBgOpacity"),
    ) || String(DEFAULT_BG_OPACITY),
  );
  const bgBlur = parseFloat(
    localStorage.getItem(
      getPersonalizationStorageKey(gameId, "customBgBlur"),
    ) || String(DEFAULT_BG_BLUR),
  );
  const bgOverlay = parseFloat(
    localStorage.getItem(
      getPersonalizationStorageKey(gameId, "customBgOverlay"),
    ) || String(DEFAULT_BG_OVERLAY),
  );
  return {
    customBg,
    bgOpacity: Number.isFinite(bgOpacity) ? bgOpacity : DEFAULT_BG_OPACITY,
    bgBlur: Number.isFinite(bgBlur) ? bgBlur : DEFAULT_BG_BLUR,
    bgOverlay: Number.isFinite(bgOverlay) ? bgOverlay : DEFAULT_BG_OVERLAY,
  };
}
function getBackgroundRenderSize() {
  if (typeof window === "undefined") {
    return {
      width: 1600,
      height: 900,
      pixelRatio: 1,
    };
  }
  return {
    width: Math.max(1, Math.round(window.innerWidth || 1600)),
    height: Math.max(1, Math.round(window.innerHeight || 900)),
    pixelRatio: Math.min(1.5, Math.max(1, window.devicePixelRatio || 1)),
  };
}
function loadBackgroundImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load background image"));
    image.src = src;
  });
}
function drawCoverImage(ctx, image, width, height) {
  const imageWidth = image.naturalWidth || image.width || 1;
  const imageHeight = image.naturalHeight || image.height || 1;
  const scale = Math.max(width / imageWidth, height / imageHeight);
  const drawWidth = imageWidth * scale;
  const drawHeight = imageHeight * scale;
  const drawX = (width - drawWidth) / 2;
  const drawY = (height - drawHeight) / 2;
  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
}
function createObjectUrlFromCanvas(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Failed to render blurred background"));
        return;
      }
      resolve(URL.createObjectURL(blob));
    }, "image/png");
  });
}
function revokeGeneratedBackgroundUrl(url) {
  if (
    typeof URL !== "undefined" &&
    typeof url === "string" &&
    url.startsWith("blob:")
  ) {
    URL.revokeObjectURL(url);
  }
}
function revokeGeneratedBackgroundUrlSoon(url) {
  if (!url) return;
  window.setTimeout(() => revokeGeneratedBackgroundUrl(url), 1e3);
}
async function renderBlurredBackgroundImage(src, blur, renderSize) {
  const image = await loadBackgroundImage(src);
  const pixelRatio = renderSize?.pixelRatio || 1;
  const width = Math.max(
    1,
    Math.round((renderSize?.width || 1600) * pixelRatio),
  );
  const height = Math.max(
    1,
    Math.round((renderSize?.height || 900) * pixelRatio),
  );
  const blurPx = Math.max(0.1, blur * pixelRatio);
  const pad = Math.ceil(Math.max(4, blurPx * 3));
  const baseCanvas = document.createElement("canvas");
  baseCanvas.width = width;
  baseCanvas.height = height;
  const baseCtx = baseCanvas.getContext("2d");
  baseCtx.imageSmoothingEnabled = true;
  baseCtx.imageSmoothingQuality = "high";
  drawCoverImage(baseCtx, image, width, height);
  const paddedCanvas = document.createElement("canvas");
  paddedCanvas.width = width + pad * 2;
  paddedCanvas.height = height + pad * 2;
  const paddedCtx = paddedCanvas.getContext("2d");
  paddedCtx.imageSmoothingEnabled = true;
  paddedCtx.imageSmoothingQuality = "high";
  paddedCtx.drawImage(baseCanvas, pad, pad);
  paddedCtx.drawImage(baseCanvas, 0, 0, width, 1, pad, 0, width, pad);
  paddedCtx.drawImage(
    baseCanvas,
    0,
    height - 1,
    width,
    1,
    pad,
    pad + height,
    width,
    pad,
  );
  paddedCtx.drawImage(baseCanvas, 0, 0, 1, height, 0, pad, pad, height);
  paddedCtx.drawImage(
    baseCanvas,
    width - 1,
    0,
    1,
    height,
    pad + width,
    pad,
    pad,
    height,
  );
  paddedCtx.drawImage(baseCanvas, 0, 0, 1, 1, 0, 0, pad, pad);
  paddedCtx.drawImage(baseCanvas, width - 1, 0, 1, 1, pad + width, 0, pad, pad);
  paddedCtx.drawImage(
    baseCanvas,
    0,
    height - 1,
    1,
    1,
    0,
    pad + height,
    pad,
    pad,
  );
  paddedCtx.drawImage(
    baseCanvas,
    width - 1,
    height - 1,
    1,
    1,
    pad + width,
    pad + height,
    pad,
    pad,
  );
  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = width;
  outputCanvas.height = height;
  const outputCtx = outputCanvas.getContext("2d");
  outputCtx.imageSmoothingEnabled = true;
  outputCtx.imageSmoothingQuality = "high";
  outputCtx.filter = `blur(${blurPx}px)`;
  outputCtx.drawImage(paddedCanvas, -pad, -pad);
  outputCtx.filter = "none";
  return createObjectUrlFromCanvas(outputCanvas);
}
function isImageOnlyDrag(dataTransfer) {
  if (!dataTransfer) return false;
  if (dataTransfer.items && dataTransfer.items.length > 0) {
    return Array.from(dataTransfer.items).every((item) =>
      item.type.startsWith("image/"),
    );
  }
  if (dataTransfer.files && dataTransfer.files.length > 0) {
    return Array.from(dataTransfer.files).every(
      (file) =>
        file.type.startsWith("image/") ||
        /\.(png|jpg|jpeg|webp|gif|bmp)$/i.test(file.name),
    );
  }
  return false;
}
export {
  DEFAULT_BG_OPACITY,
  DEFAULT_BG_BLUR,
  DEFAULT_BG_OVERLAY,
  getBackgroundRenderSize,
  getCompatibilityLevel,
  applyCompatibilityModeClass,
  normalizeCompatibilityLevel,
  readScopedBackgroundState,
  revokeGeneratedBackgroundUrl,
  renderBlurredBackgroundImage,
  revokeGeneratedBackgroundUrlSoon,
  isImageOnlyDrag,
};
