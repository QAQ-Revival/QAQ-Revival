const fs = require('node:fs');
const path = require('node:path');

function createIndependentFixer({ getSavedPath, savePath, findExisting, selectFile, launch }) {
  const pending = new Map();
  function isExecutable(file) {
    try {
      return typeof file === 'string' && path.isAbsolute(file) && /\.exe$/i.test(file) && fs.statSync(file).isFile();
    } catch {
      return false;
    }
  }
  function resolve(gameId) {
    const saved = getSavedPath(gameId);
    // A missing user selection must prompt again instead of silently using another tool.
    const file = saved || findExisting(gameId);
    return isExecutable(file) ? file : null;
  }
  async function select(gameId) {
    const result = await selectFile(gameId);
    if (result.canceled || !result.filePaths?.length) return { success: false, canceled: true };
    const exePath = result.filePaths[0];
    if (!isExecutable(exePath)) return { success: false, error: '请选择存在的修复器 .exe 文件' };
    await savePath(gameId, exePath);
    return { success: true, exePath, fileName: path.basename(exePath) };
  }
  function exclusive(gameId, operation) {
    if (pending.has(gameId)) return pending.get(gameId);
    const request = Promise.resolve().then(operation).catch(error => ({
      success: false, error: error?.message || String(error)
    })).finally(() => pending.delete(gameId));
    pending.set(gameId, request);
    return request;
  }
  function open(gameId) {
    return exclusive(gameId, async () => {
      let exePath = resolve(gameId);
      if (!exePath) {
        const selected = await select(gameId);
        if (!selected.success) return selected;
        exePath = selected.exePath;
      }
      // Keep the program beside its own dependencies. Opening it never edits Mods.
      const result = await launch(exePath, path.dirname(exePath));
      return { ...result, exePath, exeName: path.basename(exePath) };
    });
  }
  return { resolve, open, select: gameId => exclusive(gameId, () => select(gameId)) };
}

module.exports = { createIndependentFixer };
