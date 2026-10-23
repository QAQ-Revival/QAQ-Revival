import React from "react";
export function useModGallery({ setBatchMode, setSelectedMods }) {
  const [viewMode, setViewMode] = React.useState(() => {
    return localStorage.getItem("modview-view-mode") === "gallery"
      ? "gallery"
      : "list";
  });
  const [galleryDetailWidth, setGalleryDetailWidth] = React.useState(() => {
    const v = parseInt(
      localStorage.getItem("modview-gallery-detail-width") || "480",
      10,
    );
    return Number.isFinite(v) && v > 0 ? Math.min(900, Math.max(220, v)) : 480;
  });
  const [isResizingGallery, setIsResizingGallery] = React.useState(false);
  const galleryContainerRef = React.useRef(null);
  const [detailContainerWidth, setDetailContainerWidth] = React.useState(0);
  React.useEffect(() => {
    const container = galleryContainerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) =>
      setDetailContainerWidth(entry.contentRect.width),
    );
    observer.observe(container);
    setDetailContainerWidth(container.clientWidth);
    return () => observer.disconnect();
  }, []);
  // Keep space for the list/grid, including its toolbar, at every window size.
  const maxDetailWidth = detailContainerWidth
    ? Math.max(220, Math.min(900, detailContainerWidth - 340))
    : 480;
  const minDetailWidth = Math.min(280, maxDetailWidth);
  const visibleDetailWidth = Math.min(
    maxDetailWidth,
    Math.max(minDetailWidth, galleryDetailWidth),
  );
  React.useEffect(() => {
    localStorage.setItem("modview-view-mode", viewMode);
  }, [viewMode]);
  React.useEffect(() => {
    localStorage.setItem(
      "modview-gallery-detail-width",
      String(galleryDetailWidth),
    );
  }, [galleryDetailWidth]);
  function toggleViewMode() {
    setViewMode((prev) => {
      const next = prev === "gallery" ? "list" : "gallery";
      if (next === "gallery") {
        setBatchMode(false);
        setSelectedMods(new Set());
      }
      return next;
    });
  }
  React.useEffect(() => {
    if (!isResizingGallery) return;
    const handleMouseMove = (e) => {
      const container = galleryContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const scale = rect.width / container.offsetWidth || 1;
      const newDetailWidth = (rect.right - e.clientX) / scale;
      setGalleryDetailWidth(
        Math.min(maxDetailWidth, Math.max(minDetailWidth, newDetailWidth)),
      );
    };
    const handleMouseUp = () => setIsResizingGallery(false);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("blur", handleMouseUp);
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("blur", handleMouseUp);
    };
  }, [isResizingGallery, maxDetailWidth, minDetailWidth]);
  return {
    viewMode,
    setGalleryDetailWidth,
    isResizingGallery,
    setIsResizingGallery,
    galleryContainerRef,
    maxDetailWidth,
    minDetailWidth,
    visibleDetailWidth,
    toggleViewMode,
  };
}
