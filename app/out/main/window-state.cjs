'use strict';
const { readJsonFileSync, writeJsonFileSync } = require('./json-store.cjs');

function readWindowState(file, workArea) {
  let saved;
  try { saved = readJsonFileSync(file); } catch { /* First launch or unreadable state: use defaults. */ }
  const dimension = (value, fallback, limit) => Math.min(
    Number.isSafeInteger(value) && value > 0 ? value : fallback, limit
  );
  return {
    width: dimension(saved?.width, 1600, workArea.width),
    height: dimension(saved?.height, 900, workArea.height),
    maximized: saved?.maximized === true
  };
}

function trackWindowState(window, file, onError = () => {}) {
  let timer;
  let maximized = window.isMaximized();
  let lastSaved;
  const save = () => {
    clearTimeout(timer);
    if (window.isDestroyed()) return;
    // Keep the restore size, even when closing a maximized/minimized window.
    const { width, height } = window.getNormalBounds();
    if (width <= 0 || height <= 0) return;
    if (!window.isMinimized() && !window.isFullScreen()) maximized = window.isMaximized();
    const state = { width, height, maximized };
    const serialized = JSON.stringify(state);
    if (serialized === lastSaved) return;
    try {
      writeJsonFileSync(file, state);
      lastSaved = serialized;
    } catch (error) { onError(error); }
  };
  const scheduleSave = () => {
    clearTimeout(timer);
    timer = setTimeout(save, 250);
  };
  window.on('resize', scheduleSave);
  window.on('maximize', () => { maximized = true; scheduleSave(); });
  window.on('unmaximize', () => { maximized = false; scheduleSave(); });
  // Flush before either quitting or hiding to the tray, including a quick close after resizing.
  window.on('close', save);
  window.on('session-end', save);
  window.on('closed', () => clearTimeout(timer));
}

module.exports = { readWindowState, trackWindowState };
