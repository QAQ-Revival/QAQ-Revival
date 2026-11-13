"use strict";

const path = require("node:path");
const crypto = require("node:crypto");
const { readJsonFileSync, writeJsonFileSync } = require("../core/json-store.cjs");
const { localClient, checkClient } = require("./update-versions.cjs");
const INTERVAL = 60 * 60 * 1000;
const REGIONS = new Set(["auto", "cn", "global", "bilibili"]);

function createGameUpdates({ userData, getGame, checkMi, supportsMi, fetch: fetchImpl = globalThis.fetch, now = Date.now, onChange = () => {} }) {
  const file = path.join(userData, "game-updates.json");
  let saved = { games: {} }, storageError = false;
  const running = new Map(), revisions = new Map();
  try {
    const data = readJsonFileSync(file);
    if (!data?.games || typeof data.games !== "object" || Array.isArray(data.games)) throw Error("Invalid game update preferences");
    saved = data;
  } catch (error) { storageError = error.code !== "ENOENT"; }
  function context(gameId) {
    const game = getGame(gameId);
    if (!game || game.id !== gameId) throw Error("Unknown game");
    const record = Object.hasOwn(saved.games, gameId) ? saved.games[gameId] : {};
    const region = REGIONS.has(record.region) ? record.region : "auto";
    const local = localClient(game, region);
    const fingerprint = crypto.createHash("sha256").update(JSON.stringify([game.gamePath, game.modLoaderPath, game.officialLauncherPath, region, local, revisions.get(gameId) || 0])).digest("hex");
    return { game, record, region, local, fingerprint };
  }
  function state(gameId) {
    const { record, region, local, fingerprint } = context(gameId);
    const valid = record.fingerprint === fingerprint;
    return { success: true, gameId, enabled: record.enabled !== false, region, checking: running.has(gameId), storageError,
      lastCheckedAt: valid ? record.lastCheckedAt || 0 : 0,
      client: valid && record.client ? record.client : { ...local, state: local.state === "unknown" ? "unchecked" : local.state, latest: "", updateAvailable: false },
      components: valid ? record.components || [] : [], miError: valid ? record.miError || "" : "" };
  }
  function persist(gameId, record) {
    if (storageError) throw Error("Game update settings could not be read");
    const next = { ...saved, games: { ...saved.games, [gameId]: record } };
    writeJsonFileSync(file, next);
    saved = next;
  }
  function configure({ gameId, enabled, region }) {
    const { record } = context(gameId);
    if (typeof enabled !== "boolean" || !REGIONS.has(region)) throw Error("Invalid game update preferences");
    revisions.set(gameId, (revisions.get(gameId) || 0) + 1);
    persist(gameId, { ...record, enabled, region, fingerprint: "", lastAttemptAt: 0 });
    onChange(state(gameId));
    return state(gameId);
  }
  function invalidate(gameId) {
    if (!getGame(gameId)) return;
    revisions.set(gameId, (revisions.get(gameId) || 0) + 1);
    onChange(state(gameId));
  }
  async function check({ gameId, manual = false }) {
    if (running.has(gameId)) {
      const fingerprint = context(gameId).fingerprint;
      await running.get(gameId);
      const latest = context(gameId);
      if (latest.fingerprint === fingerprint && latest.record.fingerprint !== fingerprint && (manual || latest.record.enabled !== false)) return check({ gameId, manual });
      return state(gameId);
    }
    const { game, record, local, fingerprint } = context(gameId);
    if (storageError || (!manual && record.enabled === false)) return state(gameId);
    const age = now() - (record.lastAttemptAt || 0);
    if (!manual && record.fingerprint === fingerprint && age >= 0 && age < INTERVAL) return state(gameId);
    const task = Promise.resolve().then(async () => {
      const [client, mi] = await Promise.allSettled([
        checkClient(game, local, fetchImpl),
        supportsMi(gameId) && game.modLoaderPath ? checkMi(gameId) : Promise.resolve(null),
      ]);
      if (context(gameId).fingerprint !== fingerprint) return;
      const miState = mi.status === "fulfilled" ? mi.value : null;
      persist(gameId, { ...record, fingerprint, lastAttemptAt: now(), lastCheckedAt: now(),
        client: client.status === "fulfilled" ? client.value : { ...local, state: "error", error: "connection", updateAvailable: false },
        components: miState?.components || [],
        miError: mi.status === "rejected" || miState?.success === false || miState?.busy ? "checkFailed" : "" });
    });
    running.set(gameId, task);
    onChange(state(gameId));
    try { await task; }
    finally { running.delete(gameId); onChange(state(gameId)); }
    return state(gameId);
  }
  return { state, check, configure, invalidate };
}

let service;
function registerIpc() {
  const electron = require("electron"), settings = require("./settings.cjs"), xxmi = require("../install/xxmi.cjs");
  const { IMPORTERS } = require("../runtime/data-paths.cjs");
  service = createGameUpdates({ userData: electron.app.getPath("userData"), getGame: id => settings.getGameById(id),
    checkMi: id => xxmi.status(id, "check"), supportsMi: id => Object.hasOwn(IMPORTERS, id),
    onChange: value => {
      for (const window of electron.BrowserWindow.getAllWindows()) if (!window.isDestroyed()) window.webContents.send("game-updates:changed", value);
    } });
  for (const [channel, action] of [["state", id => service.state(id)], ["check", payload => service.check(payload)], ["configure", payload => service.configure(payload)]]) {
    electron.ipcMain.handle("game-updates:" + channel, async (_, payload) => {
      try { return await action(payload); }
      catch { return { success: false, error: require("../../shared/i18n/core.cjs").t("games.updates.failed") }; }
    });
  }
}
module.exports = { createGameUpdates, registerIpc, invalidate: gameId => service?.invalidate(gameId) };
