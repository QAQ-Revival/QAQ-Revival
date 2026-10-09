const { Menu, BrowserWindow } = require('electron');

// A native popup is a separate OS surface, so the manager window cannot clip it.
function showCharacterContextMenu(event, options = {}) {
  const owner = BrowserWindow.fromWebContents(event.sender);
  if (!owner || owner.isDestroyed()) return Promise.resolve(null);
  return new Promise(resolve => {
    const item = (id, label, enabled = true) => ({ id, label, enabled, click: () => resolve(id) });
    const menu = Menu.buildFromTemplate([
      item('pin', options.pinned ? '取消置顶' : '置顶到最上方'),
      item('folder', '打开源文件夹'),
      ...(options.canMove ? [item('move', '移动到这里')] : []),
      { type: 'separator' },
      item('fix', '修复器', !options.busy),
      item('reset', '重置全部 Mod ini'),
      { type: 'separator' },
      item('change-fixer', '更换修复器', !options.busy)
    ]);
    // Let Electron use the screen cursor position and the OS work-area boundary.
    menu.popup({ window: owner, callback: () => resolve(null) });
  });
}

module.exports = { showCharacterContextMenu };
