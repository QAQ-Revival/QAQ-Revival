// Observe existing per-frame Mod flags; never rewrite a Mod's own INI.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
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

async function collectProbes(env, characters) {
  const probes = [];
  async function visit(dir, characterName, modName) {
    for (const entry of await fs.promises.readdir(dir, { withFileTypes: true })) {
      if (/^(disabled|desktop)/i.test(entry.name) || entry.isSymbolicLink()) continue;
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) await visit(file, characterName, modName);
      else if (entry.isFile() && /\.ini$/i.test(entry.name)) {
        const content = await fs.promises.readFile(file, 'utf8');
        const flags = findActivityFlags(content);
        if (!flags.length) continue;
        const namespace = content.match(/^\s*namespace\s*=\s*([^\r\n;]+)/im)?.[1].trim()
          || path.relative(env.root, file).replace(/\//g, '\\');
        if (/[\r\n$]/.test(namespace)) continue;
        const enabled = /^\s*global\s+\$mod_enabled\b/im.test(content);
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
    'global persist $token = 0', `post $token = ${token}`,
    'global persist $tick = -1', 'post $tick = -1',
    ...sensors.flatMap((_, i) => [`global persist $m${i} = 0`, `post $m${i} = 0`]),
    '', '[Present]',
    // Capture every frame before the Mods' post-present resets. XXMI saves the
    // snapshot every two seconds; no GPU readback, frame dumps or process reads.
    '$tick = time',
    '', ...observers.flatMap((observer, i) => [`[IncludeActivityProbe${i}]`, `include = activity_probes\\${observer.name}`, ''])
  ].join('\n');
  return { content, observers, mods: sensors.map(({ characterName, modName }) => ({ characterName, modName })) };
}

function patchConfig(original, enabled, previousInterval) {
  let text = original.replace(/\r\n/g, '\n');
  text = text.replace(/^\[IncludeQAQMActivity\][\s\S]*?(?=^\[|(?![\s\S]))/gmi, '');
  const interval = /^(\s*settings_auto_save_interval\s*=\s*)([^\r\n]*)$/im;
  if (enabled) {
    if (!interval.test(text)) return null; // Older loaders cannot publish fresh snapshots.
    text = text.replace(interval, (_, prefix) => prefix + '2');
    return text.trimEnd() + '\n\n' + INCLUDE + '\n';
  }
  if (previousInterval !== undefined && /^\s*settings_auto_save_interval\s*=\s*2\s*$/im.test(text)) {
    text = text.replace(interval, (_, prefix) => prefix + previousInterval);
  }
  return text;
}

function readSnapshot(env, state, now = Date.now()) {
  const file = path.join(env.root, 'd3dx_user.ini');
  const empty = { status: state.mods.length ? 'waiting' : 'unsupported', mods: [] };
  try {
    const stat = fs.statSync(file);
    if (stat.mtimeMs < state.preparedAt || now - stat.mtimeMs > MAX_AGE || stat.mtimeMs > now + 1000 || stat.size > 8 * 1024 * 1024) return empty;
    const values = new Map();
    for (const match of fs.readFileSync(file, 'utf8').matchAll(/^\s*\$\\QAQM\\Activity\\(token|tick|m\d+)\s*=\s*([-+\d.eE]+)\s*$/gim)) {
      values.set(match[1].toLowerCase(), Number(match[2]));
    }
    if (values.get('token') !== state.token || !(values.get('tick') >= 0)) return empty;
    // A copied/touched old file is not a heartbeat. Require the game clock to advance.
    if (state.lastTick !== values.get('tick')) {
      if (state.lastTick !== undefined) state.seenAdvance = true;
      state.lastTick = values.get('tick');
      state.lastTickAt = now;
    }
    if (!state.seenAdvance || now - state.lastTickAt > MAX_AGE) return empty;
    const mods = state.mods.filter((_, i) => values.get(`m${i}`) === 1);
    return { status: 'live', sampledAt: stat.mtimeMs, mods: mods.filter((mod, i) => mods.findIndex(m => m.characterName === mod.characterName && m.modName === mod.modName) === i) };
  } catch { return empty; }
}

function createActivityTracker() {
  const states = new Map();
  const pending = new Map();
  let generation = 0;
  return {
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
        const probes = enabled ? await collectProbes(env, characters) : [];
        const signature = crypto.createHash('sha256').update('v2:' + JSON.stringify(probes)).digest('hex');
        const reused = signature === previous.signature && Number.isInteger(previous.token) && previous.token > 0 && previous.token <= 0xffffff;
        const token = reused ? previous.token : crypto.randomBytes(3).readUIntBE(0, 3) || 1;
        const bridge = buildBridge(probes, token);
        const supported = probes.length > 0 && /^\s*settings_auto_save_interval\s*=/im.test(config);
        const currentInterval = config.match(/^\s*settings_auto_save_interval\s*=\s*([^\r\n]*)/im)?.[1];
        const previousInterval = previous.enabled && currentInterval?.trim() === '2'
          ? previous.previousInterval ?? currentInterval : currentInterval;
        const next = patchConfig(config, enabled && supported, previousInterval);
        const preparedAt = reused ? 0 : Date.now();
        if (supported || previous.previousInterval !== undefined) {
          await fs.promises.mkdir(bridgeDir, { recursive: true });
          if (!fs.existsSync(env.d3dxPath + '.qaqm-activity.bak')) await fs.promises.copyFile(env.d3dxPath, env.d3dxPath + '.qaqm-activity.bak');
          // Back up the old bridge as well, so interrupted setup is recoverable.
          const bridgePath = path.join(bridgeDir, 'qaqm_activity.ini');
          if (enabled && supported) {
            const observerDir = path.join(bridgeDir, 'activity_probes');
            await fs.promises.mkdir(observerDir, { recursive: true });
            for (const observer of bridge.observers) {
              await fs.promises.writeFile(path.join(observerDir, observer.name), observer.content);
            }
          }
          const bridgeContent = enabled && supported ? bridge.content : '; Activity detection disabled\n';
          const oldBridge = fs.existsSync(bridgePath) ? await fs.promises.readFile(bridgePath, 'utf8') : null;
          if (oldBridge !== bridgeContent) {
            if (oldBridge !== null) await fs.promises.copyFile(bridgePath, bridgePath + '.bak');
            await fs.promises.writeFile(bridgePath, bridgeContent);
          }
          await fs.promises.writeFile(metadataPath, JSON.stringify({ previousInterval, signature, token, enabled: enabled && supported }));
          if (next !== null && next !== config.replace(/\r\n/g, '\n')) await fs.promises.writeFile(env.d3dxPath, next);
        }
        const state = { generation: currentGeneration, enabled, token, preparedAt, mods: supported ? bridge.mods : [],
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
