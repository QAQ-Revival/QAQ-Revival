"use strict";

// Pending choices live in the main process so every Mod window sees the same
// state. They never rename a folder or reload the game until confirmed.
// Toggle requests queue here as well. A Mod takes one request at a time, and
// requests that arrive while a batch runs are applied together afterwards:
// renames stay in order, while refreshes, game reloads and Arknights rebuilds
// run once per batch through commit().
function createSelectionController({ scope, conflicts, apply, commit = async () => {}, notify, publishQueue = () => {} }) {
  const pending = new Map();
  const queued = new Map();
  let waiting = [];
  let draining = false;
  let version = 0;
  let queue = Promise.resolve();
  const serialize = operation => {
    const result = queue.then(operation);
    queue = result.catch(() => {});
    return result;
  };
  function names(context) { return pending.get(scope(context)) || new Set(); }
  function publish(context) { notify(context); }
  function queueState(context) {
    let mods;
    try { mods = queued.get(scope(context)); } catch { mods = null; }
    return { version, items: [...(mods || [])].map(([modName, enable]) => ({ modName, enable })) };
  }
  function announce(context, applied = []) { publishQueue(context, { ...queueState(context), applied }); }
  function createSession() { return { renamed: new Set(), selectionChanged: new Set() }; }
  async function applyResolvedChoices(context, session) {
    const selected = names(context);
    if (!selected.size) return;
    let found;
    try { found = await conflicts(context, [...selected]); } catch { return; }
    for (const modName of [...selected]) {
      if (found.some(item => item.mods.includes(modName))) continue;
      const result = await apply({ ...context, modName, enable: true }, session);
      if (result.success) { selected.delete(modName); session.renamed.add(scope(context)); }
    }
  }
  async function snapshot(context, mods) {
    const selected = names(context);
    const existing = new Set(mods.map(mod => mod.name));
    for (const name of selected) if (!existing.has(name) || mods.find(mod => mod.name === name)?.enabled) selected.delete(name);
    let found = [];
    // Disabled, unselected Mods cannot conflict. Avoid scanning the whole
    // Arknights library just to display a character with no active Mods.
    if (selected.size || mods.some(mod => mod.enabled)) {
      try { found = await conflicts(context, [...selected]); }
      catch { found = [...selected].map(name => ({ hash: "", mods: [name] })); }
    }
    return mods.map(mod => ({
      ...mod,
      pendingEnabled: selected.has(mod.name),
      hasConflict: found.some(item => item.mods.includes(mod.name)),
      conflicts: found.filter(item => item.mods.includes(mod.name))
    }));
  }
  async function handle(context, session, touched) {
    const key = scope(context), selected = names(context);
    touched.set(key, context);
    if (!context.enable && selected.has(context.modName)) {
      selected.delete(context.modName);
      session.selectionChanged.add(key);
      return { success: true, cancelledPending: true };
    }
    if (context.enable) {
      const found = (await conflicts(context, [...selected, context.modName])).filter(item => item.mods.includes(context.modName));
      if (found.length) {
        selected.add(context.modName);
        pending.set(key, selected);
        session.selectionChanged.add(key);
        return { success: false, pending: true, conflicts: found };
      }
    }
    const result = await apply(context, session);
    if (result.success) { selected.delete(context.modName); if (!result.alreadyInState) session.renamed.add(key); }
    return result;
  }
  async function run(batch) {
    const session = createSession(), touched = new Map(), results = new Map();
    // Disabling first keeps a swap inside one batch from counting as a conflict.
    const ordered = [...batch.filter(item => !item.context.enable), ...batch.filter(item => item.context.enable)];
    try {
      for (const item of ordered) {
        try { results.set(item, await handle(item.context, session, touched)); }
        catch (error) { results.set(item, { success: false, error: error.message }); }
      }
      for (const context of touched.values()) {
        try { await applyResolvedChoices(context, session); } catch { /* Choices stay pending. */ }
      }
    } finally {
      // Deferred work also releases anything the batch holds, so it always runs.
      try { await commit(session); }
      catch (error) { for (const item of ordered) if (results.get(item)?.success) results.set(item, { success: false, error: error.message }); }
    }
    const applied = new Map();
    for (const item of batch) {
      const mods = queued.get(item.key);
      mods?.delete(item.context.modName);
      if (mods && !mods.size) queued.delete(item.key);
      const result = results.get(item) || { success: false, error: "Mod toggle was not applied" };
      if (result.success && !result.cancelledPending) {
        if (!applied.has(item.key)) applied.set(item.key, []);
        applied.get(item.key).push({ modName: item.context.modName, enabled: item.context.enable });
      }
    }
    version++;
    for (const item of batch) item.resolve(results.get(item) || { success: false, error: "Mod toggle was not applied" });
    for (const [key, context] of new Map(batch.map(item => [item.key, item.context]))) announce(context, applied.get(key) || []);
    for (const [key, context] of touched) if (session.selectionChanged.has(key) && !session.renamed.has(key)) publish(context);
  }
  function schedule() {
    if (draining) return;
    draining = true;
    serialize(async () => {
      draining = false;
      const batch = waiting;
      waiting = [];
      if (batch.length) await run(batch);
    });
  }
  function request(context) {
    let key;
    try { key = scope(context); } catch (error) { return Promise.resolve({ success: false, error: error.message }); }
    const mods = queued.get(key) || new Map();
    if (mods.has(context.modName)) return Promise.resolve({ success: false, busy: true, enable: mods.get(context.modName) });
    mods.set(context.modName, context.enable);
    queued.set(key, mods);
    version++;
    announce(context);
    return new Promise(resolve => {
      waiting.push({ context, key, resolve });
      schedule();
    });
  }
  function confirm(context) {
    return serialize(async () => {
      const selected = names(context), requested = [...selected], applied = [];
      if (!selected.size) return { success: true };
      const session = createSession();
      let result, failure;
      try {
        const confirmedConflictIds = (await conflicts(context, [...selected])).filter(item => item.mods.some(name => selected.has(name))).map(item => item.id).filter(Boolean);
        for (const modName of requested) {
          result = await apply({ ...context, modName, enable: true, confirmedConflictIds }, session);
          if (!result.success) throw Error(result.error || "Mod enable failed");
          if (!result.alreadyInState) applied.push({ modName, result });
        }
      } catch (error) {
        failure = error;
        const rollbackErrors = [];
        for (const { modName } of applied.reverse()) {
          try {
            const rollback = await apply({ ...context, modName, enable: false }, session);
            if (!rollback.success) rollbackErrors.push(rollback.error || modName);
          } catch (rollback) { rollbackErrors.push(rollback.message); }
        }
        if (rollbackErrors.length) failure = Error([error.message, ...rollbackErrors].join("; "));
      } finally {
        try { await commit(session); } catch (error) { failure ||= error; }
      }
      // A deployment can still fail after every rename went through.
      const late = failure ? [] : applied.filter(item => !item.result.success);
      if (failure || late.length) {
        pending.set(scope(context), new Set(failure ? requested : late.map(item => item.modName)));
        publish(context);
        return { success: false, error: failure ? failure.message : late.map(item => item.result.error).join("; ") };
      }
      pending.delete(scope(context));
      publish(context);
      return { ...result, success: true, confirmedCount: applied.length };
    });
  }
  return { request, confirm, snapshot, queueState };
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
    apply: (context, session) => require("../ipc/mods.cjs").applyModToggle({ ...context, batch: session }),
    commit: session => require("../ipc/mods.cjs").commitModToggleBatch(session),
    notify: context => require("../desktop/notifications.cjs").notifyAllModWindowsChanged(context.characterName, { gameId: context.gameId, resourcesChanged: false, reason: "mod-selection" }),
    publishQueue: (context, state) => require("../desktop/notifications.cjs").notifyModToggleQueue({ gameId: context.gameId, characterName: context.characterName, ...state })
  });
  return controller;
}

module.exports = {
  createSelectionController,
  request: context => shared().request(context),
  confirm: context => shared().confirm(context),
  snapshot: (context, mods) => shared().snapshot(context, mods),
  queueState: context => shared().queueState(context)
};
