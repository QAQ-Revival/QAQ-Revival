"use strict";

// Pending choices live in the main process so every Mod window sees the same
// state. They never rename a folder or reload the game until confirmed.
function createSelectionController({ scope, conflicts, apply, notify }) {
  const pending = new Map();
  let queue = Promise.resolve();
  const serialize = operation => {
    const result = queue.then(operation);
    queue = result.catch(() => {});
    return result;
  };
  function names(context) { return pending.get(scope(context)) || new Set(); }
  function publish(context) { notify(context); }
  async function applyResolvedChoices(context) {
    const selected = names(context);
    if (!selected.size) return;
    let found;
    try { found = await conflicts(context, [...selected]); } catch { return; }
    for (const modName of [...selected]) {
      if (found.some(item => item.mods.includes(modName))) continue;
      const result = await apply({ ...context, modName, enable: true });
      if (result.success) selected.delete(modName);
    }
  }
  async function snapshot(context, mods) {
    const selected = names(context);
    const existing = new Set(mods.map(mod => mod.name));
    for (const name of selected) if (!existing.has(name) || mods.find(mod => mod.name === name)?.enabled) selected.delete(name);
    let found;
    try { found = await conflicts(context, [...selected]); }
    catch { found = [...selected].map(name => ({ hash: "", mods: [name] })); }
    return mods.map(mod => ({
      ...mod,
      pendingEnabled: selected.has(mod.name),
      hasConflict: found.some(item => item.mods.includes(mod.name)),
      conflicts: found.filter(item => item.mods.includes(mod.name))
    }));
  }
  function request(context) {
    return serialize(async () => {
      const key = scope(context), selected = names(context);
      if (!context.enable && selected.has(context.modName)) {
        selected.delete(context.modName);
        await applyResolvedChoices(context);
        publish(context);
        return { success: true, cancelledPending: true };
      }
      if (context.enable) {
        const found = (await conflicts(context, [...selected, context.modName])).filter(item => item.mods.includes(context.modName));
        if (found.length) {
          selected.add(context.modName);
          pending.set(key, selected);
          publish(context);
          return { success: false, pending: true, conflicts: found };
        }
      }
      const result = await apply(context);
      if (result.success) { selected.delete(context.modName); await applyResolvedChoices(context); publish(context); }
      return result;
    });
  }
  function confirm(context) {
    return serialize(async () => {
      const selected = names(context), requested = [...selected], applied = [];
      if (!selected.size) return { success: true };
      try {
        let result;
        const confirmedConflictIds = (await conflicts(context, [...selected])).filter(item => item.mods.some(name => selected.has(name))).map(item => item.id).filter(Boolean);
        for (const modName of requested) {
          result = await apply({ ...context, modName, enable: true, confirmedConflictIds });
          if (!result.success) throw Error(result.error || "Mod enable failed");
          if (!result.alreadyInState) applied.push(modName);
        }
        pending.delete(scope(context));
        publish(context);
        return { ...result, success: true, confirmedCount: applied.length };
      } catch (error) {
        const rollbackErrors = [];
        for (const modName of applied.reverse()) {
          try {
            const result = await apply({ ...context, modName, enable: false });
            if (!result.success) rollbackErrors.push(result.error || modName);
          } catch (rollback) { rollbackErrors.push(rollback.message); }
        }
        pending.set(scope(context), new Set(requested));
        publish(context);
        return { success: false, error: [error.message, ...rollbackErrors].join("; ") };
      }
    });
  }
  return { request, confirm, snapshot };
}

let controller;
function shared() {
  if (controller) return controller;
  const fs = require("node:fs"), path = require("node:path");
  const directories = require("../characters/directories.cjs");
  const detect = require("./conflicts.cjs");
  controller = createSelectionController({
    scope: context => {
      const root = directories.resolveCharacterPath(context.characterName, context.gameId);
      if (!root) throw Error("Character folder not found");
      return JSON.stringify([context.gameId, path.resolve(root).toLowerCase()]);
    },
    conflicts: async (context, selected) => {
      const root = directories.resolveCharacterPath(context.characterName, context.gameId);
      if (!root || !fs.existsSync(root)) return [];
      if (context.gameId === "arknights") {
        const service = require("../games/arknights/service.cjs");
        const canonicalName = directories.resolveCharacterEntry(context.characterName, context.gameId)?.displayName || context.characterName;
        const entries = service.enabledEntries();
        for (const name of new Set(selected)) {
          const modPath = directories.resolveExistingStandardModDirectory(context.characterName, name, context.gameId)?.modPath;
          if (modPath && !entries.some(entry => path.resolve(entry.path).toLowerCase() === path.resolve(modPath).toLowerCase())) entries.push({ path: modPath, name: `${canonicalName}/${name}` });
        }
        const prefix = canonicalName + "/";
        const found = await require("../games/arknights/appearance.cjs").inspectResourceConflicts(entries);
        return found.map(({ id, hash, mods }) => ({ id, hash, mods: mods.map(name => name.startsWith(prefix) ? name.slice(prefix.length) : name) }));
      }
      return detect.detectConflictsForCharacter(root, { includeDisabledNames: selected });
    },
    apply: context => require("../ipc/mods.cjs").applyModToggle(context),
    notify: context => require("../desktop/notifications.cjs").notifyAllModWindowsChanged(context.characterName, { gameId: context.gameId, resourcesChanged: false, reason: "mod-selection" })
  });
  return controller;
}

module.exports = { createSelectionController, request: context => shared().request(context), confirm: context => shared().confirm(context), snapshot: (context, mods) => shared().snapshot(context, mods) };
