// Observe existing per-frame Mod flags; never rewrite a Mod's own INI.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createActivityChannel, supportsActivityChannel, MAX_SENSORS } = require('./activity-channel.cjs');
const NS = 'QAQM\\Activity';
const INCLUDE = '[IncludeQAQMActivity]\ninclude = qaqm\\qaqm_activity.ini';
const MAX_AGE = 6500;

function findActivityFlags(content) {
  const text = content.replace(/^\uFEFF/, '').replace(/^\s*;.*$/gm, '');
  const flags = [];
  // Require all three: a declaration, a draw-time assignment, and a post-present
  // reset. An enabled toggle or an arbitrary $active variable is not evidence.
  const sections = text.split(/(?=^\s*\[)/m);
  const present = sections.filter(s => /^\s*\[Present\]/i.test(s)).join('\n');
  const draws = sections.filter(s => /^\s*\[TextureOverride[^\]]*\]/i.test(s)).join('\n');
  for (const match of text.matchAll(/^\s*global\s+\$(object_detected|active\d*)\b/gim)) {
    const name = match[1];
    if (!new RegExp(`^\\s*post\\s+\\$${name}\\s*=\\s*0\\s*(?:;.*)?$`, 'im').test(present)) continue;
    if (!new RegExp(`^\\s*\\$${name}\\s*=\\s*1\\s*(?:;.*)?$`, 'im').test(draws)) continue;
    if (new RegExp(`^\\s*\\$${name}\\s*=\\s*0\\s*(?:;.*)?$`, 'im').test(present)) continue;
    flags.push(name);
  }
  return [...new Set(flags)];
}

async function collectProbes(env, characters, cache) {
  const probes = [];
  const visited = new Set();
  async function visit(dir, characterName, modName) {
    for (const entry of await fs.promises.readdir(dir, { withFileTypes: true })) {
      if (/^(disabled|desktop)/i.test(entry.name) || entry.isSymbolicLink()) continue;
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) await visit(file, characterName, modName);
      else if (entry.isFile() && /\.ini$/i.test(entry.name)) {
        visited.add(file);
        const stat = await fs.promises.stat(file);
        const fingerprint = `${stat.ino}:${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}`;
        let parsed = cache.get(file);
        if (parsed?.fingerprint !== fingerprint) {
          const content = await fs.promises.readFile(file, 'utf8');
          parsed = { fingerprint, flags: findActivityFlags(content),
            namespace: content.match(/^\s*namespace\s*=\s*([^\r\n;]+)/im)?.[1].trim()
              || path.relative(env.root, file).replace(/\//g, '\\'),
            enabled: /^\s*global\s+\$mod_enabled\b/im.test(content) };
          cache.set(file, parsed);
        }
        const { flags, namespace, enabled } = parsed;
        if (!flags.length) continue;
        if (/[\r\n$]/.test(namespace)) continue;
        probes.push({ characterName, modName, namespace, flags, enabled });
      }
    }
  }
  for (const character of characters) {
    for (const mod of await fs.promises.readdir(character.characterRootPath, { withFileTypes: true })) {
      if (!mod.isDirectory() || mod.isSymbolicLink() || /^disabled/i.test(mod.name)) continue;
      await visit(path.join(character.characterRootPath, mod.name), character.displayName, mod.name);
    }
  }
  for (const file of cache.keys()) if (!visited.has(file)) cache.delete(file);
  // Two enabled Mods declaring the same namespace cannot be distinguished.
  return probes.filter(probe => !probes.some(other => other !== probe
    && other.namespace.toLowerCase() === probe.namespace.toLowerCase()
    && (other.characterName !== probe.characterName || other.modName !== probe.modName)))
    .sort((a, b) => a.namespace.localeCompare(b.namespace));
}

function buildBridge(probes, token) {
  const sensors = [];
  for (const probe of probes) {
    let sensor = sensors.find(s => s.namespace.toLowerCase() === probe.namespace.toLowerCase());
    if (!sensor) sensors.push(sensor = { ...probe, flags: [] });
    sensor.flags.push(...probe.flags.filter(flag => !sensor.flags.includes(flag)));
  }
  // Reuse the original INI namespace in a separate observer file. Local flag
  // references also work on loaders that cannot tokenize spaces in long paths.
  const observers = sensors.map((sensor, i) => ({
    name: crypto.createHash('sha256').update(sensor.namespace.toLowerCase()).digest('hex').slice(0, 20) + '.ini',
    content: [`namespace = ${sensor.namespace}`, '', '[Present]', `$\\${NS}\\m${i} = 0`,
      `if (${sensor.flags.map(flag => `$${flag} > 0`).join(' || ')})${sensor.enabled ? ' && $mod_enabled > 0' : ''}`,
      `    $\\${NS}\\m${i} = 1`, 'endif', ''].join('\n')
  }));
  const content = [
    `namespace = ${NS}`, '', '[Constants]',
    'global $token = 0', `post $token = ${token}`,
    // Keep the old variable declared while migrating an existing user INI.
    'global $tick = -1', 'post $tick = -1',
    ...sensors.flatMap((_, i) => [`global $m${i} = 0`, `post $m${i} = 0`]),
    '', ...observers.flatMap((observer, i) => [`[IncludeActivityProbe${i}]`, `include = activity_probes\\${observer.name}`, ''])
  ].join('\n');
  return { content, observers, mods: sensors.map(({ characterName, modName }) => ({ characterName, modName })) };
}

function patchConfig(original, enabled, previousInterval) {
  let text = original.replace(/\r\n/g, '\n');
  text = text.replace(/^\[IncludeQAQMActivity\][\s\S]*?(?=^\[|(?![\s\S]))/gmi, '');
  const interval = /^(\s*settings_auto_save_interval\s*=\s*)([^\r\n]*)$/im;
  if (previousInterval !== undefined && /^\s*settings_auto_save_interval\s*=\s*2\s*$/im.test(text)) {
    text = text.replace(interval, (_, prefix) => prefix + previousInterval);
  }
  return enabled ? text.trimEnd() + '\n\n' + INCLUDE + '\n' : text;
}

function readSnapshot(env, state, now = Date.now()) {
  const empty = { status: state.mods.length ? 'waiting' : 'unsupported', mods: [] };
  try {
    const sample = state.channel.read(state.token, state.mods.length);
    if (!sample || sample.token !== state.token || !Number.isFinite(sample.tick) || sample.tick < 0 || sample.flags.length !== state.mods.length) return empty;
    // A mapping can outlive the game while a reader has it open. Require a fresh
    // advancing game clock; stale memory never counts as a live Mod.
    if (state.lastTick !== sample.tick) {
      if (state.lastTick !== undefined) state.seenAdvance = true;
      state.lastTick = sample.tick;
      state.lastTickAt = now;
    }
    if (now - state.lastTickAt > MAX_AGE) {
      state.channel.close();
      return empty;
    }
    if (!state.seenAdvance) return empty;
    const mods = state.mods.filter((_, i) => sample.flags[i] === 1);
    return { status: 'live', sampledAt: state.lastTickAt, mods: mods.filter((mod, i) => mods.findIndex(m => m.characterName === mod.characterName && m.modName === mod.modName) === i) };
  } catch { return empty; }
}

async function writeIfChanged(file, content) {
  try { if (await fs.promises.readFile(file, 'utf8') === content) return; } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await fs.promises.writeFile(file, content);
}

function createActivityTracker({ supportsRuntime = supportsActivityChannel, openChannel = createActivityChannel } = {}) {
  const states = new Map();
  const pending = new Map();
  const probeCaches = new Map();
  let generation = 0;
  return {
    dispose() { for (const state of states.values()) state.channel.close(); states.clear(); probeCaches.clear(); },
    invalidate() { generation++; },
    async prepare(env, characters, enabled = true) {
      if (!env) return null;
      const key = path.resolve(env.root);
      if (pending.has(key)) { await pending.get(key); return this.prepare(env, characters, enabled); }
      const cached = states.get(key);
      if (cached?.generation === generation && cached.enabled === enabled) return cached;
      const currentGeneration = generation;
      const work = (async () => {
        const config = await fs.promises.readFile(env.d3dxPath, 'utf8');
        const bridgeDir = path.join(env.root, 'qaqm');
        const metadataPath = path.join(bridgeDir, 'qaqm_activity.json');
        let previous = {};
        try { previous = JSON.parse(await fs.promises.readFile(metadataPath, 'utf8')); } catch {}
        const capable = enabled && supportsRuntime(env.root);
        if (!probeCaches.has(key)) probeCaches.set(key, new Map());
        const probes = capable ? await collectProbes(env, characters, probeCaches.get(key)) : [];
        const signature = crypto.createHash('sha256').update('v3-memory:' + JSON.stringify(probes)).digest('hex');
        const reused = signature === previous.signature && Number.isInteger(previous.token) && previous.token > 0 && previous.token <= 0xffffff;
        const token = reused ? previous.token : crypto.randomBytes(3).readUIntBE(0, 3) || 1;
        const bridge = buildBridge(probes, token);
        const supported = probes.length > 0 && bridge.mods.length <= MAX_SENSORS;
        const currentInterval = config.match(/^\s*settings_auto_save_interval\s*=\s*([^\r\n]*)/im)?.[1];
        const previousInterval = previous.enabled && previous.transport !== 'memory-v1' && currentInterval?.trim() === '2'
          ? previous.previousInterval ?? '60' : undefined;
        const next = patchConfig(config, enabled && supported, previousInterval);
        const preparedAt = reused ? 0 : Date.now();
        if (supported || previous.enabled || /\[IncludeQAQMActivity\]/i.test(config)) {
          await fs.promises.mkdir(bridgeDir, { recursive: true });
          const bridgePath = path.join(bridgeDir, 'qaqm_activity.ini');
          const observerDir = path.join(bridgeDir, 'activity_probes');
          if (enabled && supported) {
            await fs.promises.mkdir(observerDir, { recursive: true });
            for (const observer of bridge.observers) {
              await writeIfChanged(path.join(observerDir, observer.name), observer.content);
            }
          }
          const bridgeContent = enabled && supported ? bridge.content : '; Activity detection disabled\n';
          await writeIfChanged(bridgePath, bridgeContent);
          const wanted = new Set(enabled && supported ? bridge.observers.map(observer => observer.name) : []);
          for (const name of await fs.promises.readdir(observerDir).catch(error => { if (error.code === 'ENOENT') return []; throw error; })) {
            if (/^[a-f0-9]{20}\.ini$/.test(name) && !wanted.has(name)) await fs.promises.unlink(path.join(observerDir, name));
          }
          await writeIfChanged(metadataPath, JSON.stringify({ transport: 'memory-v1', signature, token, enabled: enabled && supported }));
          if (next !== null && next !== config.replace(/\r\n/g, '\n')) await fs.promises.writeFile(env.d3dxPath, next);
        }
        if (cached && (cached.token !== token || !enabled || !supported)) cached.channel.close();
        const state = { generation: currentGeneration, enabled, token, preparedAt, mods: supported ? bridge.mods : [],
          channel: cached?.token === token ? cached.channel : openChannel(),
          ...(cached?.token === token ? { lastTick: cached.lastTick, lastTickAt: cached.lastTickAt, seenAdvance: cached.seenAdvance } : {}) };
        states.set(key, state);
        return state;
      })();
      pending.set(key, work);
      try { return await work; } finally { pending.delete(key); }
    },
    read(env) {
      const state = env && states.get(path.resolve(env.root));
      if (!state?.enabled) return { status: 'unsupported', mods: [] };
      if (state.generation !== generation) return { status: 'waiting', mods: [] };
      return readSnapshot(env, state);
    }
  };
}

module.exports = { findActivityFlags, buildBridge, patchConfig, readSnapshot, createActivityTracker };
