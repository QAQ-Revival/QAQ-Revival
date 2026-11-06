const i18n = require("../../shared/i18n/core.cjs");
const {
  Menu,
  BrowserWindow
} = require('electron');

// A native popup is a separate OS surface, so the manager window cannot clip it.
function showCharacterContextMenu(event, options = {}) {
  const owner = BrowserWindow.fromWebContents(event.sender);
  if (!owner || owner.isDestroyed()) return Promise.resolve(null);
  return new Promise(resolve => {
    const item = (id, label, enabled = true) => ({
      id,
      label,
      enabled,
      click: () => resolve(id)
    });
    const menu = Menu.buildFromTemplate([item('pin', options.pinned ? i18n.t("backend.characterContextMenu.unpin") : i18n.t("backend.characterContextMenu.pin")), item('folder', i18n.t("backend.characterContextMenu.openSourceFolder")), ...(options.canMove ? [item('move', i18n.t("backend.characterContextMenu.moveHere"))] : []), {
      type: 'separator'
    }, item('fix', i18n.t("backend.characterContextMenu.fixer"), !options.busy), item('reset', i18n.t("backend.characterContextMenu.resetAllModIni")), {
      type: 'separator'
    }, item('change-fixer', i18n.t("backend.characterContextMenu.changeFixer"), !options.busy), {
      type: 'separator'
    }, item('rename', i18n.t("backend.characterContextMenu.rename")), item('hide', i18n.t("backend.characterContextMenu.hide"), !options.busy), item('delete', i18n.t("backend.characterContextMenu.delete"))]);
    // Let Electron use the screen cursor position and the OS work-area boundary.
    menu.popup({
      window: owner,
      callback: () => resolve(null)
    });
  });
}
module.exports = {
  showCharacterContextMenu
};
