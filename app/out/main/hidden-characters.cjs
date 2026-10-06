const fs = require('node:fs');
const path = require('node:path');

function createHiddenCharactersStore({ read, write, normalize = name => name.toLowerCase() }) {
  const list = gameId => {
    const names = read()?.[gameId];
    return Array.isArray(names) ? names.filter(name => typeof name === 'string') : [];
  };
  return {
    list,
    has: (gameId, name) => list(gameId).some(item => normalize(item) === normalize(name)),
    set(gameId, name, hidden) {
      const next = list(gameId).filter(item => normalize(item) !== normalize(name));
      if (hidden) next.push(name);
      write({ ...read(), [gameId]: next });
    }
  };
}

// Preflight every destination before touching files. A failed save/rename restores
// the previous directory layout, so a visible character never silently loses Mods.
function applyDisablePlan(plan, commit, move = fs.renameSync) {
  const destinations = new Set();
  for (const { from, to } of plan) {
    const key = path.resolve(to).toLowerCase();
    if (fs.existsSync(to) || destinations.has(key)) throw Error(`无法禁用，目标已存在：${to}`);
    if (fs.lstatSync(from).isSymbolicLink()) throw Error(`请先处理链接目录：${from}`);
    destinations.add(key);
  }
  const completed = [];
  try {
    for (const item of plan) {
      fs.mkdirSync(path.dirname(item.to), { recursive: true });
      move(item.from, item.to);
      completed.push(item);
    }
    commit();
  } catch (error) {
    const rollbackErrors = [];
    for (const item of completed.reverse()) {
      try { move(item.to, item.from); }
      catch (rollbackError) { rollbackErrors.push(`${item.from}: ${rollbackError.message}`); }
    }
    throw Error(rollbackErrors.length ? `${error.message}；部分目录恢复失败：${rollbackErrors.join('；')}` : error.message);
  }
  return plan.length;
}

module.exports = { createHiddenCharactersStore, applyDisablePlan };
