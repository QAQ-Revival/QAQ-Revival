import { t } from "../../shared/i18n/index.mjs";
import React from "react";
import ReactDOM from "react-dom";
import Cropper from "react-easy-crop";
async function getCroppedImg(imageSrc, pixelCrop) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height,
  );
  return canvas.toDataURL("image/jpeg", 0.9);
}
function createImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.src = url;
  });
}
function ImageCropper({ imageSrc, onCancel, onSave }) {
  const [crop, setCrop] = React.useState({
    x: 0,
    y: 0,
  });
  const [zoom, setZoom] = React.useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = React.useState(null);
  const [saving, setSaving] = React.useState(false);
  const onCropComplete = React.useCallback(
    (croppedArea, croppedAreaPixels2) => {
      setCroppedAreaPixels(croppedAreaPixels2);
    },
    [],
  );
  React.useEffect(() => {
    const mainContent = document.querySelector(".main-content");
    if (!mainContent) return void 0;
    const previousOverflow = mainContent.style.overflowY;
    const previousOverscroll = mainContent.style.overscrollBehavior;
    mainContent.style.overflowY = "hidden";
    mainContent.style.overscrollBehavior = "contain";
    return () => {
      mainContent.style.overflowY = previousOverflow;
      mainContent.style.overscrollBehavior = previousOverscroll;
    };
  }, []);
  const handleSave = async () => {
    setSaving(true);
    try {
      const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels);
      onSave(croppedImage);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };
  return ReactDOM.createPortal(
    <div
      className="cropper-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) {
          onCancel?.();
        }
      }}
      onWheel={(e) => e.preventDefault()}
    >
      <div className="cropper-container" onClick={(e) => e.stopPropagation()}>
        <div className="cropper-header">
          <h3>{t("characters.cover.editAvatar")}</h3>
        </div>
        <div className="cropper-area">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={3 / 4}
            onCropChange={setCrop}
            onCropComplete={onCropComplete}
            onZoomChange={setZoom}
            showGrid={false}
          />
        </div>
        <div className="cropper-controls">
          <div className="zoom-slider-container">
            <span role="img" aria-label="zoom-out">
              {"➖"}
            </span>
            <input
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.1}
              aria-labelledby="Zoom"
              onChange={(e) => setZoom(e.target.value)}
              className="zoom-slider"
            />
            <span role="img" aria-label="zoom-in">
              {"➕"}
            </span>
          </div>
          <div className="cropper-actions">
            <button
              className="btn btn-secondary"
              onClick={onCancel}
              disabled={saving}
            >
              {t("common.actions.cancel")}
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving
                ? t("common.status.saving")
                : t("characters.cover.confirmCrop")}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
export { ImageCropper };
