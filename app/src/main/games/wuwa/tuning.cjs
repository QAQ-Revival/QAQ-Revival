const i18n = require("../../../shared/i18n/core.cjs");
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const FOV = 'r.Kuro.SkeletalMesh.DistanceLODBaseFOV';
const DISTANCE = 'r.Kuro.SkeletalMesh.LODDistanceScale';
const FULL = 'r.Streaming.FullyLoadUsedTextures';
const HIDDEN = 'r.Streaming.HiddenPrimitiveScale';
const FRAMES = 'r.Streaming.FramesForFullUpdate';
const PRESETS = [{
  id: 'default',
  name: i18n.t("backend.wuwaTuning.baselineName"),
  description: i18n.t("backend.wuwaTuning.baselineDescription")
}, {
  id: 'community36',
  name: i18n.t("backend.wuwaTuning.detailedName"),
  description: i18n.t("backend.wuwaTuning.detailedDescription")
}, {
  id: 'stable-textures',
  name: i18n.t("backend.wuwaTuning.textureName"),
  description: i18n.t("backend.wuwaTuning.textureDescription")
}, {
  id: 'legacy2024',
  name: i18n.t("backend.wuwaTuning.distanceName"),
  description: i18n.t("backend.wuwaTuning.distanceDescription")
}];
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function read(file) {
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 2 * 1024 * 1024) throw Error(i18n.t("backend.wuwaTuning.unsupportedConfigFile"));
    return fs.readFileSync(file);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}
function decode(bytes) {
  if (!bytes) return {
    text: '',
    encode: text => Buffer.from(text, 'utf8')
  };
  const wide = bytes[0] === 255 && bytes[1] === 254;
  if (bytes[0] === 254 && bytes[1] === 255) throw Error(i18n.t("backend.wuwaTuning.unsupportedBigEndianConfig"));
  const bom = wide ? bytes.subarray(0, 2) : bytes.subarray(0, 3).equals(Buffer.from([239, 187, 191])) ? bytes.subarray(0, 3) : Buffer.alloc(0);
  const encoding = wide ? 'utf16le' : 'utf8';
  const text = bytes.subarray(bom.length).toString(encoding);
  if (text.includes('\ufffd') || text.includes('\0')) throw Error(i18n.t("backend.wuwaTuning.unknownConfigEncoding"));
  return {
    text,
    encode: value => Buffer.concat([bom, Buffer.from(value, encoding)])
  };
}
function editIni(text, sections) {
  const newline = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  const managed = new Set(Object.values(sections).flatMap(values => Object.keys(values)).map(key => key.toLowerCase()));
  let section = '';
  const kept = lines.filter(line => {
    const heading = /^\s*\[([^\]]+)\]/.exec(line);
    if (heading) section = heading[1].toLowerCase();
    const assignment = /^\s*([^;#=]+?)\s*=/.exec(line);
    return !(['consolevariables', 'systemsettings', '/script/engine.renderersettings'].includes(section) && assignment && managed.has(assignment[1].trim().toLowerCase()));
  });
  for (const [name, values] of Object.entries(sections)) {
    const additions = Object.entries(values).filter(([, value]) => value !== null).map(([key, value]) => `${key}=${value}`);
    if (!additions.length) continue;
    const index = kept.findIndex(line => line.trim().toLowerCase() === `[${name.toLowerCase()}]`);
    if (index >= 0) kept.splice(index + 1, 0, ...additions);else {
      if (kept.at(-1) !== '') kept.push('');
      kept.push(`[${name}]`, ...additions, '');
    }
  }
  return kept.join(newline);
}
function iniValue(text, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = [...text.matchAll(new RegExp(`^\\s*${escaped}\\s*=\\s*([^;#\\r\\n]+)`, 'gmi'))];
  return matches.length ? Number(matches.at(-1)[1].trim()) : null;
}
function createWuwaTuningService({
  resolvePaths,
  backupDir,
  assertStopped = async () => {}
}) {
  const recordPath = path.join(backupDir, 'latest.json');
  let busy = false;
  function paths() {
    const {
      gameRoot,
      launcherConfig
    } = resolvePaths();
    if (!gameRoot || !fs.existsSync(path.join(gameRoot, 'Wuthering Waves.exe')) || !fs.existsSync(path.join(gameRoot, 'Client'))) throw Error(i18n.t("backend.wuwaTuning.gameExecutableRequired"));
    if (!launcherConfig || !fs.existsSync(launcherConfig)) throw Error(i18n.t("backend.wuwaTuning.launcherConfigurationRequired"));
    const result = {
      launcher: path.resolve(launcherConfig),
      user: path.join(gameRoot, 'Client/Config/UserEngine.ini'),
      engine: path.join(gameRoot, 'Client/Saved/Config/WindowsNoEditor/Engine.ini'),
      device: path.join(gameRoot, 'Client/Saved/Config/WindowsNoEditor/DeviceProfiles.ini')
    };
    for (const file of Object.values(result)) {
      let cursor = file;
      while (path.dirname(cursor) !== cursor) {
        if (fs.existsSync(cursor) && fs.lstatSync(cursor).isSymbolicLink()) throw Error(i18n.t("backend.wuwaTuning.linkedConfigPath"));
        cursor = path.dirname(cursor);
      }
    }
    return result;
  }
  function snapshot() {
    const targets = paths();
    const files = Object.fromEntries(Object.entries(targets).map(([key, file]) => [key, {
      file,
      bytes: read(file)
    }]));
    const revision = sha(Buffer.from(JSON.stringify(Object.values(files).map(({
      file,
      bytes
    }) => [file, bytes === null ? null : sha(bytes)]))));
    const launcher = JSON.parse(decode(files.launcher.bytes).text);
    if (!launcher.Importers?.WWMI?.Importer) throw Error(i18n.t("backend.wuwaTuning.wwmiConfigMissing"));
    return {
      files,
      revision,
      launcher
    };
  }
  function latest() {
    try {
      return JSON.parse(fs.readFileSync(recordPath, 'utf8'));
    } catch {
      return null;
    }
  }
  function managedDeviceProfile(record) {
    if (record && Object.hasOwn(record, 'deviceProfile')) return record.deviceProfile;
    // Records created before baseline tracking can still restore their original import.
    const entry = record?.preset === 'device-profile' && record.status === 'applied' && record.entries?.find(item => item.key === 'device');
    return entry ? {
      baseline: {
        id: record.id,
        file: entry.file,
        sha256: entry.before
      },
      after: entry.after
    } : null;
  }
  function get() {
    const s = snapshot();
    const user = decode(s.files.user.bytes).text,
      engine = decode(s.files.engine.bytes).text;
    const values = {
      fov: iniValue(user, FOV),
      launcherFov: s.launcher.Importers.WWMI.Importer.mesh_lod_distance_lod_base_fov ?? 165,
      distance: iniValue(engine, DISTANCE),
      fullyLoad: iniValue(engine, FULL),
      hidden: iniValue(engine, HIDDEN),
      frames: iniValue(engine, FRAMES)
    };
    let preset = 'custom';
    if (values.fov === 384 && values.launcherFov === 384 && values.hidden === 50 && values.frames === 0 && values.distance === null && values.fullyLoad === null) preset = 'community36';else if (values.hidden === 40 && values.frames === null && values.distance === null && values.fullyLoad === null) preset = 'stable-textures';else if (values.distance === 20 && values.fullyLoad === 1 && values.hidden === null && values.frames === null) preset = 'legacy2024';else if ((values.fov === null || values.fov === 165) && values.launcherFov === 165 && [values.distance, values.fullyLoad, values.hidden, values.frames].every(value => value === null)) preset = 'default';
    const record = latest();
    const canRestore = !!record && ['applied', 'prepared'].includes(record.status) && record.entries?.every(entry => s.files[entry.key]?.file === entry.file && [entry.after, ...(record.status === 'prepared' ? [entry.before] : [])].includes(s.files[entry.key].bytes === null ? null : sha(s.files[entry.key].bytes)));
    const profile = managedDeviceProfile(record);
    if (profile && profile.baseline.file === s.files.device.file && profile.after === (s.files.device.bytes === null ? null : sha(s.files.device.bytes))) preset = 'device-profile';
    return {
      success: true,
      revision: s.revision,
      values,
      preset,
      presets: PRESETS,
      canRestore,
      paths: Object.fromEntries(Object.entries(s.files).map(([key, item]) => [key, item.file]))
    };
  }
  function commit(s, replacements, preset, {
    profileBefore = null,
    profileAfter = null,
    importProfile = false
  } = {}) {
    const previousRecord = read(recordPath);
    const id = crypto.randomUUID(),
      directory = path.join(backupDir, id);
    fs.mkdirSync(directory, {
      recursive: true
    });
    const entries = Object.entries(replacements).map(([key, bytes]) => {
      const original = s.files[key];
      if (original.bytes !== null) fs.writeFileSync(path.join(directory, key + '.bak'), original.bytes, {
        flag: 'wx'
      });
      return {
        key,
        file: original.file,
        before: original.bytes === null ? null : sha(original.bytes),
        after: bytes === null ? null : sha(bytes)
      };
    });
    if (importProfile) {
      const device = entries.find(entry => entry.key === 'device');
      profileAfter = {
        baseline: profileBefore?.baseline || {
          id,
          file: device.file,
          sha256: device.before
        },
        after: device.after
      };
    }
    const record = {
      version: 1,
      id,
      preset,
      status: 'prepared',
      entries,
      deviceProfileBefore: profileBefore,
      deviceProfile: profileAfter
    };
    fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify(record));
    fs.writeFileSync(recordPath, JSON.stringify(record));
    const written = [];
    function put(file, bytes) {
      if (bytes === null) {
        if (fs.existsSync(file)) fs.unlinkSync(file);
        return;
      }
      fs.mkdirSync(path.dirname(file), {
        recursive: true
      });
      const temporary = file + '.qaq-' + id;
      try {
        fs.writeFileSync(temporary, bytes, {
          flag: 'wx'
        });
        fs.renameSync(temporary, file);
      } finally {
        if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
      }
    }
    try {
      if (snapshot().revision !== s.revision) throw Error(i18n.t("backend.wuwaTuning.configChangedDuringApply"));
      for (const entry of entries) {
        written.push(entry);
        put(entry.file, replacements[entry.key]);
        const bytes = read(entry.file);
        if ((bytes === null ? null : sha(bytes)) !== entry.after) throw Error(i18n.t("backend.genshinDiagnostics.writeVerificationFailed"));
      }
      record.status = 'applied';
      fs.writeFileSync(recordPath, JSON.stringify(record));
    } catch (error) {
      for (const entry of written.reverse()) put(entry.file, s.files[entry.key].bytes);
      if (previousRecord === null) fs.unlinkSync(recordPath);else fs.writeFileSync(recordPath, previousRecord);
      throw error;
    }
    return {
      ...get(),
      message: i18n.t("backend.wuwaTuning.configurationApplied")
    };
  }
  async function mutate(action) {
    if (busy) throw Error(i18n.t("backend.wuwaTuning.operationInProgress"));
    busy = true;
    try {
      const s = snapshot();
      await assertStopped(s.files);
      return action(s);
    } finally {
      busy = false;
    }
  }
  async function apply({
    preset,
    revision,
    deviceProfilePath
  } = {}) {
    if (!PRESETS.some(item => item.id === preset) && preset !== 'device-profile') throw Error(i18n.t("backend.wuwaTuning.unknownProfile"));
    return mutate(s => {
      if (revision !== s.revision) throw Error(i18n.t("backend.wuwaTuning.configChanged"));
      const user = decode(s.files.user.bytes),
        engine = decode(s.files.engine.bytes),
        launcher = decode(s.files.launcher.bytes);
      const fov = preset === 'community36' ? 384 : preset === 'stable-textures' ? s.launcher.Importers.WWMI.Importer.mesh_lod_distance_lod_base_fov ?? 165 : 165;
      s.launcher.Importers.WWMI.Importer.mesh_lod_distance_lod_base_fov = fov;
      const sections = {
        ConsoleVariables: {
          [FOV]: null,
          [DISTANCE]: preset === 'legacy2024' ? 20 : null,
          [FULL]: preset === 'legacy2024' ? 1 : null
        },
        SystemSettings: {
          [HIDDEN]: preset === 'community36' ? 50 : preset === 'stable-textures' ? 40 : null,
          [FRAMES]: preset === 'community36' ? 0 : null
        }
      };
      const replacements = {
        launcher: launcher.encode(JSON.stringify(s.launcher, null, 4) + '\n'),
        user: user.encode(editIni(user.text, {
          ConsoleVariables: {
            [FOV]: fov,
            [DISTANCE]: null,
            [FULL]: null,
            [HIDDEN]: null,
            [FRAMES]: null
          }
        })),
        engine: engine.encode(editIni(engine.text, sections))
      };
      const last = latest();
      if (last?.status === 'prepared') throw Error(i18n.t("backend.wuwaTuning.pendingApplication"));
      const profile = managedDeviceProfile(last);
      if (profile) {
        const baseline = profile.baseline;
        if (!/^[a-f0-9-]{36}$/.test(baseline.id)) throw Error(i18n.t("backend.wuwaTuning.invalidDeviceProfileBackup"));
        if (baseline.file !== s.files.device.file || (s.files.device.bytes === null ? null : sha(s.files.device.bytes)) !== profile.after) throw Error(i18n.t("backend.wuwaTuning.deviceProfileChanged"));
        const original = baseline.sha256 === null ? null : read(path.join(backupDir, baseline.id, 'device.bak'));
        if ((original === null ? null : sha(original)) !== baseline.sha256) throw Error(i18n.t("backend.wuwaTuning.deviceProfileBackupInvalid"));
        if (preset !== 'device-profile') replacements.device = original;
      }
      if (preset === 'device-profile') {
        if (typeof deviceProfilePath !== 'string' || path.extname(deviceProfilePath).toLowerCase() !== '.ini') throw Error(i18n.t("backend.wuwaTuning.deviceProfileFileRequired"));
        const bytes = read(deviceProfilePath),
          text = decode(bytes).text;
        if (!/\[[^\]\r\n]+\sDeviceProfile\]/i.test(text) || !/^\s*\+?CVars\s*=/im.test(text)) throw Error(i18n.t("backend.wuwaTuning.invalidDeviceProfile"));
        replacements.device = bytes;
      }
      return commit(s, replacements, preset, {
        profileBefore: profile,
        importProfile: preset === 'device-profile'
      });
    });
  }
  async function restore({
    revision
  } = {}) {
    return mutate(s => {
      if (revision !== s.revision) throw Error(i18n.t("backend.wuwaTuning.configChangedBeforeRestore"));
      const record = latest();
      if (!record || !['applied', 'prepared'].includes(record.status) || !/^[a-f0-9-]{36}$/.test(record.id) || !Array.isArray(record.entries) || !record.entries.length) throw Error(i18n.t("backend.wuwaTuning.backupMissing"));
      const replacements = {};
      for (const entry of record.entries) {
        if (!Object.hasOwn(s.files, entry.key) || s.files[entry.key].file !== entry.file) throw Error(i18n.t("backend.wuwaTuning.gamePathChanged"));
        const current = s.files[entry.key].bytes;
        const currentHash = current === null ? null : sha(current);
        if (currentHash !== entry.after && !(record.status === 'prepared' && currentHash === entry.before)) throw Error(i18n.t("backend.wuwaTuning.modifiedConfigPreserved"));
        const bytes = entry.before === null ? null : read(path.join(backupDir, record.id, entry.key + '.bak'));
        if ((bytes === null ? null : sha(bytes)) !== entry.before) throw Error(i18n.t("backend.wuwaTuning.backupVerificationFailed"));
        replacements[entry.key] = bytes;
      }
      const result = commit(s, replacements, 'restore', {
        profileBefore: managedDeviceProfile(record),
        profileAfter: record.deviceProfileBefore || null
      });
      const next = latest();
      next.status = 'restored';
      fs.writeFileSync(recordPath, JSON.stringify(next));
      return {
        ...result,
        canRestore: false,
        message: i18n.t("backend.wuwaTuning.configurationRestored")
      };
    });
  }
  return {
    get,
    apply,
    restore
  };
}
module.exports = {
  PRESETS,
  editIni,
  iniValue,
  createWuwaTuningService
};
