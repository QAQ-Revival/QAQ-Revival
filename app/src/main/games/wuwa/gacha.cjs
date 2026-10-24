"use strict";

// Adapted from https://github.com/lyndon0na/wuwa-gacha-export (MIT).
// See licenses/wuwa-gacha-export-LICENSE.txt for the original license.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { t } = require("../../../shared/i18n/core.cjs");
const {
  readJsonFileSync,
  writeJsonFileSync,
} = require("../../core/json-store.cjs");

const POOL_IDS = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 13]);
const LINK_HOST = /^aki-gm-resources(?:-oversea)?\.aki-game\.(?:com|net)$/;
const LINK_PATTERN =
  /https:\/\/aki-gm-resources(?:-oversea)?\.aki-game\.(?:com|net)\/aki\/gacha[^\x00-\x20"'<>\\]*/g;
const API = Object.freeze({
  cn: "https://gmserver-api.aki-game2.com/gacha/record/query",
  global: "https://gmserver-api.aki-game2.net/gacha/record/query",
});

function poolName(id) {
  return t(`gacha.pools.pool${id}`);
}

function parseGachaUrl(value) {
  try {
    if (typeof value !== "string" || value.length > 8192) throw Error();
    const url = new URL(value.trim().replace(/&amp;/g, "&"));
    if (
      url.protocol !== "https:" ||
      !LINK_HOST.test(url.hostname) ||
      url.port ||
      url.username ||
      url.password ||
      !/^\/aki\/gacha(?:\/index\.html)?\/?$/.test(url.pathname)
    )
      throw Error();
    const query = new URLSearchParams(
      url.search || url.hash.slice(url.hash.indexOf("?") + 1),
    );
    const params = Object.fromEntries(query);
    for (const key of ["player_id", "svr_id", "record_id", "resources_id"]) {
      if (
        !params[key] ||
        params[key].length > 2048 ||
        /[\x00-\x1f\x7f]/.test(params[key])
      )
        throw Error();
    }
    const region =
      params.svr_area === "global" ||
      url.hostname.includes("-oversea") ||
      url.hostname.endsWith(".net")
        ? "global"
        : "cn";
    return { url: url.href, params, region };
  } catch {
    throw Error(t("gacha.invalidUrl"));
  }
}

function decryptLog(data) {
  const result = Buffer.allocUnsafe(data.length);
  // Parity refers to each byte's VALUE, not its offset in the file.
  for (let i = 0; i < data.length; i++)
    result[i] = data[i] ^ (data[i] & 1 ? 0xa5 : 0xef);
  return result;
}

async function findLogs(input) {
  if (typeof input !== "string" || !input.trim())
    throw Error(t("gacha.missingPath"));
  const root = path.resolve(input.trim().replace(/^(["'])(.*)\1$/, "$2"));
  const stat = await fs.promises.stat(root).catch(() => null);
  if (!stat) throw Error(t("gacha.noLogs"));
  if (stat.isFile() && /\.log$/i.test(root)) return [root];
  let base = stat.isDirectory() ? root : path.dirname(root);
  // A configured executable may be inside Client/Binaries/Win64.
  if (stat.isFile()) {
    for (let dir = base, level = 0; level < 6; level++) {
      if (fs.existsSync(path.join(dir, "Client/Saved/Logs"))) {
        base = dir;
        break;
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  const directories = new Set([base]);
  for (const suffix of [
    "Client/Saved/Logs",
    "Saved/Logs",
    "Wuthering Waves Game/Client/Saved/Logs",
  ])
    directories.add(path.join(base, suffix));
  let inspected = 0;
  async function visit(dir, depth) {
    if (++inspected > 300) return;
    for (const item of await fs.promises
      .readdir(dir, { withFileTypes: true })
      .catch(() => [])) {
      if (!item.isDirectory() || item.isSymbolicLink()) continue;
      const child = path.join(dir, item.name);
      directories.add(path.join(child, "Client/Saved/Logs"));
      if (depth > 0) await visit(child, depth - 1);
    }
  }
  await visit(base, 1);
  const logs = new Map();
  for (const directory of directories) {
    for (const item of await fs.promises
      .readdir(directory, { withFileTypes: true })
      .catch(() => [])) {
      if (!item.isFile() || !/\.log$/i.test(item.name)) continue;
      const file = path.join(directory, item.name);
      const info = await fs.promises.stat(file).catch(() => null);
      if (info) logs.set(file, info.mtimeMs);
    }
  }
  if (!logs.size) throw Error(t("gacha.noLogs"));
  return [...logs].sort((a, b) => b[1] - a[1]).map(([file]) => file);
}

async function extractGachaUrl(input) {
  const logs = await findLogs(input);
  let readable = false;
  for (const file of logs) {
    let found = null;
    const tails = ["", ""];
    try {
      // Streaming handles large live logs and links spanning read boundaries.
      for await (const chunk of fs.createReadStream(file, {
        highWaterMark: 1024 * 1024,
      })) {
        readable = true;
        for (const [index, bytes] of [chunk, decryptLog(chunk)].entries()) {
          const text = tails[index] + bytes.toString("latin1");
          for (const match of text.matchAll(LINK_PATTERN)) {
            try {
              found = parseGachaUrl(match[0]);
            } catch {
              /* Skip truncated or unrelated links. */
            }
          }
          tails[index] = text.slice(-8192);
        }
      }
      if (found) return { ...found, sourcePath: file };
    } catch {
      /* A rotated or locked log must not hide readable backup logs. */
    }
  }
  throw Error(t(readable ? "gacha.noUrl" : "gacha.readFailed"));
}

function validateRecords(records) {
  if (!Array.isArray(records) || records.length > 100000)
    throw Error(t("gacha.invalidResponse"));
  let expanded = 0;
  for (const record of records) {
    if (
      !record ||
      typeof record !== "object" ||
      Array.isArray(record) ||
      !Number.isInteger(Number(record.qualityLevel)) ||
      Number(record.qualityLevel) < 1 ||
      Number(record.qualityLevel) > 5 ||
      !Number.isSafeInteger(Number(record.count ?? 1)) ||
      Number(record.count ?? 1) < 1 ||
      Number(record.count ?? 1) > 10000 ||
      typeof record.name !== "string" ||
      typeof record.time !== "string" ||
      record.name.length > 1000 ||
      record.time.length > 100
    )
      throw Error(t("gacha.invalidResponse"));
    expanded += Number(record.count ?? 1);
    if (expanded > 1000000) throw Error(t("gacha.invalidResponse"));
  }
  return records;
}

function analyzePool(id, records) {
  validateRecords(records);
  const five = [];
  let total = 0,
    four = 0,
    pity = 0;
  // The API returns newest first. Preserve the order of same-time pulls.
  for (const record of [...records].reverse()) {
    const count = Number(record.count ?? 1);
    total += count;
    if (Number(record.qualityLevel) === 5) {
      for (let i = 0; i < count; i++) {
        five.push({
          name: record.name,
          time: record.time,
          type: String(record.resourceType ?? ""),
          banner: String(record.cardPoolType ?? ""),
          pity: pity + 1,
          lowerBound: five.length === 0,
        });
        pity = 0;
      }
    } else {
      pity += count;
      if (Number(record.qualityLevel) === 4) four += count;
    }
  }
  const label = String(records[0]?.cardPoolType ?? "");
  return {
    id: Number(id),
    name: label && !/^\d+$/.test(label) ? label : poolName(id),
    total,
    five,
    four,
    rate: total ? (five.length / total) * 100 : 0,
    pity,
    pityLowerBound: five.length === 0,
    first: records.at(-1)?.time || "",
    last: records[0]?.time || "",
  };
}

function summarize(snapshot) {
  const pools = Object.entries(snapshot.pools)
    .filter(([, records]) => records.length)
    .map(([id, records]) => analyzePool(id, records));
  const total = pools.reduce((sum, pool) => sum + pool.total, 0);
  const five = pools.reduce((sum, pool) => sum + pool.five.length, 0);
  return {
    pools,
    total,
    five,
    four: pools.reduce((sum, pool) => sum + pool.four, 0),
    rate: total ? (five / total) * 100 : 0,
  };
}

function markdownReport(snapshot) {
  const parsed = parseGachaUrl(snapshot.url);
  const summary = summarize(snapshot);
  const cell = (value) =>
    String(value ?? "")
      .replace(/\|/g, "\\|")
      .replace(/[\r\n]/g, " ")
      .replace(/[<>]/g, "");
  const headings = (keys) =>
    "| " + keys.map((key) => t(`gacha.${key}`)).join(" | ") + " |";
  const lines = [
    "# " + t("gacha.reportTitle"),
    "",
    t("gacha.account", {
      uid: cell(parsed.params.player_id),
      region: t(`gacha.${parsed.region}`),
      server: cell(parsed.params.svr_id),
    }),
    t("gacha.updated", { time: snapshot.fetchedAt }),
    "",
    t("gacha.retention"),
    "",
  ];
  if (!snapshot.complete)
    lines.push(
      t("gacha.partial"),
      ...(snapshot.failedPools || []).map(
        (item) => `- ${poolName(item.id)}: ${cell(item.error)}`,
      ),
      "",
    );
  lines.push(
    "## " + t("gacha.overview"),
    "",
    headings(["pool", "total", "five", "four", "rate", "pity"]),
    "| --- | ---: | ---: | ---: | ---: | ---: |",
  );
  for (const pool of summary.pools) {
    const pity = pool.pityLowerBound
      ? t("gacha.lowerBound", { count: pool.pity })
      : pool.pity;
    lines.push(
      `| ${cell(pool.name)} | ${pool.total} | ${pool.five.length} | ${pool.four} | ${pool.rate.toFixed(2)}% | ${pity} |`,
    );
  }
  for (const pool of summary.pools) {
    if (!pool.five.length) continue;
    lines.push(
      "",
      `## ${cell(pool.name)} · ${t("gacha.details")}`,
      "",
      headings(["time", "name", "type", "pulls", "banner"]),
      "| --- | --- | --- | ---: | --- |",
    );
    for (const item of pool.five)
      lines.push(
        `| ${cell(item.time)} | ${cell(item.name)} | ${cell(item.type)} | ${item.lowerBound ? t("gacha.lowerBound", { count: item.pity }) : item.pity} | ${cell(item.banner)} |`,
      );
  }
  return lines.join("\n") + "\n";
}

function validateSnapshot(value) {
  try {
    const parsed = parseGachaUrl(value.url);
    if (
      !value.pools ||
      typeof value.pools !== "object" ||
      Array.isArray(value.pools)
    )
      throw Error();
    for (const [id, records] of Object.entries(value.pools)) {
      if (!POOL_IDS.includes(Number(id))) throw Error();
      validateRecords(records);
    }
    if (!Object.values(value.pools).some((records) => records.length))
      throw Error();
    return {
      url: parsed.url,
      params: parsed.params,
      pools: value.pools,
      fetchedAt:
        typeof value.fetchedAt === "string"
          ? value.fetchedAt
          : new Date().toISOString(),
      complete: value.complete !== false,
      failedPools: Array.isArray(value.failedPools)
        ? value.failedPools
            .filter((item) => POOL_IDS.includes(item?.id))
            .map((item) => ({
              id: item.id,
              error: String(item.error || "").slice(0, 500),
            }))
        : [],
    };
  } catch {
    throw Error(t("gacha.invalidImport"));
  }
}

function createGachaService({
  stateDir,
  getGamePaths = () => [],
  fetch: fetchRecords,
  onProgress = () => {},
}) {
  let snapshot = null,
    url = "",
    sourcePath = "",
    loaded = false,
    cacheWarning = "";
  let controller = null,
    progress = null;
  const latestFile = path.join(stateDir, "latest.json");
  function state() {
    if (!loaded) {
      loaded = true;
      try {
        const pointer = readJsonFileSync(latestFile);
        if (!/^[a-f0-9]{24}-(complete|partial)\.json$/.test(pointer.file))
          throw Error();
        snapshot = validateSnapshot(
          readJsonFileSync(path.join(stateDir, pointer.file)),
        );
        url = snapshot.url;
      } catch (error) {
        if (error.code !== "ENOENT" || fs.existsSync(latestFile))
          cacheWarning = t("gacha.cacheReadFailed");
      }
    }
    return {
      success: true,
      busy: !!controller,
      progress,
      url,
      sourcePath,
      snapshot,
      summary: snapshot ? summarize(snapshot) : null,
      warning: cacheWarning,
    };
  }
  async function extract(input) {
    state();
    if (controller) throw Error(t("gacha.busy"));
    let result, lastError;
    const candidates = input ? [input] : getGamePaths().filter(Boolean);
    if (!candidates.length) throw Error(t("gacha.missingPath"));
    for (const candidate of candidates) {
      try {
        result = await extractGachaUrl(candidate);
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (!result) throw lastError;
    url = result.url;
    sourcePath = result.sourcePath;
    return state();
  }
  function saveSnapshot(value) {
    state();
    snapshot = validateSnapshot(value);
    url = snapshot.url;
    cacheWarning = "";
    try {
      const parsed = parseGachaUrl(url);
      const key = crypto
        .createHash("sha256")
        .update(
          `${parsed.region}:${parsed.params.svr_id}:${parsed.params.player_id}`,
        )
        .digest("hex")
        .slice(0, 24);
      const file = `${key}-${snapshot.complete ? "complete" : "partial"}.json`;
      // A partial result never overwrites this account's complete snapshot.
      writeJsonFileSync(path.join(stateDir, file), snapshot);
      writeJsonFileSync(latestFile, { file });
    } catch {
      cacheWarning = t("gacha.cacheSaveFailed");
    }
    return state();
  }
  function publish(value) {
    progress = value;
    onProgress({ busy: !!controller, progress });
  }
  async function query(parsed, id, signal) {
    const timeout = AbortSignal.timeout(25000);
    const combined = AbortSignal.any([signal, timeout]);
    try {
      const origin = new URL(parsed.url).origin;
      // Only the two fixed Kuro endpoints above receive the explicitly approved fields.
      const response = await fetchRecords(API[parsed.region], {
        method: "POST",
        redirect: "error",
        credentials: "omit",
        signal: combined,
        headers: {
          "Content-Type": "application/json",
          Origin: origin,
          Referer: origin + "/",
        },
        body: JSON.stringify({
          playerId: parsed.params.player_id,
          cardPoolId: parsed.params.resources_id,
          cardPoolType: id,
          serverId: parsed.params.svr_id,
          languageCode: parsed.params.lang || "zh-Hans",
          recordId: parsed.params.record_id,
        }),
      });
      if (!response.ok)
        throw Object.assign(
          Error(t("gacha.httpFailed", { status: response.status })),
          { safe: true },
        );
      const text = await response.text();
      if (text.length > 32 * 1024 * 1024) throw Error();
      let payload;
      try {
        payload = JSON.parse(text);
      } catch {
        throw Object.assign(Error(t("gacha.invalidResponse")), { safe: true });
      }
      if (!payload || typeof payload !== "object")
        throw Object.assign(Error(t("gacha.invalidResponse")), { safe: true });
      if (
        !["0", "200"].includes(String(payload.code)) &&
        payload.message !== "成功"
      )
        throw Object.assign(Error(t("gacha.expired")), { safe: true });
      try {
        return validateRecords(payload.data ?? []);
      } catch {
        throw Object.assign(Error(t("gacha.invalidResponse")), { safe: true });
      }
    } catch (error) {
      if (signal.aborted) throw signal.reason;
      if (timeout.aborted) throw Error(t("gacha.timeout"));
      // Fetch errors and server messages can contain tokens. Never expose them.
      throw Error(
        error.safe === true ? error.message : t("gacha.requestFailed"),
      );
    }
  }
  async function fetchAll({ url: value, consent } = {}) {
    // Defense in depth: the IPC adapter also requires this window's checked consent.
    if (consent !== true) throw Error(t("gacha.consentRequired"));
    state();
    if (controller) throw Error(t("gacha.busy"));
    const parsed = parseGachaUrl(value || url);
    url = parsed.url;
    const job = new AbortController();
    controller = job;
    const pools = {},
      failedPools = [];
    let result;
    try {
      for (const [index, id] of POOL_IDS.entries()) {
        job.signal.throwIfAborted();
        publish({ id, current: index + 1, total: POOL_IDS.length });
        try {
          pools[id] = await query(parsed, id, job.signal);
        } catch (error) {
          job.signal.throwIfAborted();
          failedPools.push({ id, error: error.message });
          // An expired credential affects every pool; avoid repeating the rejection.
          if (error.message === t("gacha.expired")) {
            for (const remaining of POOL_IDS.slice(index + 1))
              failedPools.push({ id: remaining, error: error.message });
            break;
          }
        }
      }
      job.signal.throwIfAborted();
      if (!Object.values(pools).some((records) => records.length)) {
        result = {
          success: false,
          error: t(failedPools.length ? "gacha.allFailed" : "gacha.noRecords"),
          failedPools,
        };
      } else {
        saveSnapshot({
          url: parsed.url,
          pools,
          fetchedAt: new Date().toISOString(),
          complete: failedPools.length === 0,
          failedPools,
        });
        result = { success: true };
      }
    } catch (error) {
      if (job.signal.aborted) result = { success: false, canceled: true };
      else throw error;
    } finally {
      controller = null;
      publish(null);
    }
    return { ...state(), ...result };
  }
  function cancel() {
    controller?.abort(new Error(t("gacha.canceled")));
    return { success: true };
  }
  function exportContents(format, value) {
    state();
    if (format === "url") return parseGachaUrl(value || url).url + "\n";
    if (!snapshot) throw Error(t("gacha.noSnapshot"));
    if (format === "json") return JSON.stringify(snapshot, null, 2) + "\n";
    if (format === "report") return markdownReport(snapshot);
    throw Error(t("gacha.exportFailed"));
  }
  return { state, extract, saveSnapshot, fetchAll, cancel, exportContents };
}

module.exports = {
  POOL_IDS,
  API,
  poolName,
  parseGachaUrl,
  decryptLog,
  findLogs,
  extractGachaUrl,
  validateRecords,
  validateSnapshot,
  analyzePool,
  summarize,
  markdownReport,
  createGachaService,
};
