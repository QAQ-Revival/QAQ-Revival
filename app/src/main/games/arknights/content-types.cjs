"use strict";

const path = require("node:path");

const CONTENT_TYPE_ORDER = [
  "baseIllustration", "skinIllustration", "illustration", "dynamic",
  "baseChibi", "skinChibi", "chibi", "storyPortrait", "avatar", "portrait",
  "cg", "background", "voice", "music", "sound", "effect", "enemy",
  "summon", "battleObject", "namecard", "ui", "map", "video", "other",
];
const cleanPath = value => String(value || "").replace(/\\/g, "/").toLowerCase();
const stemOf = value => value.replace(/\.(?:png|skel|atlas|json)(?:\.txt)?$/, "").replace(/\[(?:alpha|alphe)\]$|_alpha$/, "").replace(/__(?:page|atlas)\d+$/, "");

function classifyContentTypes(resources, classifyAppearance) {
  const records = resources.map(resource => {
    const bundle = cleanPath(resource.bundle);
    const relative = cleanPath(resource.relative || resource.resource);
    const name = path.posix.basename(cleanPath(resource.resource));
    return { ...resource, bundle, name, location: bundle || relative, group: bundle || path.posix.dirname(relative), stem: stemOf(name) };
  });
  const skeletons = new Set(records.filter(record => /\.(?:skel|atlas)(?:\.txt)?$/.test(record.name)).map(record => `${record.group}/${record.stem}`));
  function appearanceType(record, kind) {
    const scope = classifyAppearance(record);
    if (scope === "base") return `base${kind}`;
    if (scope.startsWith("skin:") || /(?:char_\d+_[a-z0-9]+|token_\d+_[a-z0-9_]+)_[a-z][a-z0-9]*[#@_]\d+/.test(record.name)) return `skin${kind}`;
    return kind.toLowerCase();
  }
  function classify(record) {
    const { name, location, stem } = record;
    const texture = name.split("__texture_").at(-1);
    if (/\.(?:ini|json|txt)$/.test(name) && !record.bundle && !/^(?:(?:sp_|entry_)?dyn_|illust_|front_|back_|build_)/.test(name)) return null;
    if (/\.(?:mp4|webm|usm|avi)$/.test(name)) return "video";
    const audio = /\.(?:wav|ogg|mp3|flac)$/.test(name) || /(?:^|\/)(?:audio|voice(?:_[a-z]+)?|music|bgm)\//.test(location);
    if (audio) {
      if (/(?:^|\/)(?:music|bgm)(?:\/|[_.])/.test(location) || /^(?:music|bgm)_/.test(name)) return "music";
      if (/(?:^|\/)voice(?:_[a-z]+)?\//.test(location)) return "voice";
      if (/(?:^|\/)audio\//.test(location) || /^(?:sfx|se|sound)_/.test(name)) return "sound";
      return "voice";
    }
    // Ignore metadata and instructions. Recognize Spine text/JSON only when
    // it names a model or has an explicit binding to a game bundle.
    if (!/\.(?:png|skel|atlas|ab|bundle|unity3d)$/.test(name) &&
        !(/\.(?:json|txt)$/.test(name) && (record.bundle || /^(?:(?:sp_|entry_)?dyn_|illust_|front_|back_|build_)/.test(name)))) return null;
    // A portrait's effect/background textures are part of that portrait, not
    // separate background or VFX replacements.
    if (/^(?:(?:sp_|entry_)?dyn_(?:illust|portrait|entrance)_)/.test(name)) return "dynamic";
    if (/(?:^|\/)arts\/dynchars\/effect\.ab$/.test(location)) return "effect";
    if (/(?:^|\/)arts\/dynchars\//.test(location)) return "dynamic";
    if (/(?:^|\/)avg\/characters\//.test(location) || /^avg_(?:char_)?\d+_[a-z][a-z0-9]*_/.test(name)) return "storyPortrait";
    if (/(?:^|\/)arts\/charavatars\//.test(location) || /^charavatars_/.test(name)) return "avatar";
    if (/(?:^|\/)arts\/charportraits\//.test(location) || /^charportraits_/.test(name)) return "portrait";
    if (/(?:^|\/)arts\/ui\/namecardskin\//.test(location)) return "namecard";
    if (/(?:^|\/)(?:arts\/ui|ui|activity)\//.test(location)) return "ui";
    if (/(?:^|\/)(?:arts|battle)\/maps\//.test(location)) return "map";
    if (/(?:^|\/)(?:avg\/effects|battle\/prefabs\/effects|refs\/fx)\//.test(location) || /^(?:fx_|effect_)/.test(name)) return "effect";
    if (/(?:^|\/)battle\/prefabs\/enemies\//.test(location) || /^(?:(?:front|back)_)?enemy_/.test(name)) return "enemy";
    if (/^(?:(?:front|back|build)_)?token_/.test(name) || /\/\[uc\]tokens\.ab$/.test(location)) return "summon";
    if (/^(?:(?:front|back|build)_)?trap_/.test(name)) return "battleObject";
    if (/(?:^|\/)avg\/bg\//.test(location)) return "background";
    if (/(?:^|\/)avg\/(?:imgs|images)\//.test(location)) return /^bg_/.test(texture) ? "background" : "cg";
    if (/^(?:bg|background)_/.test(name)) return "background";
    if (/^(?:cg_|avg_\d+_\d+)/.test(name)) return "cg";
    if (/^(?:front|back|build)_char_/.test(name)) return appearanceType(record, "Chibi");
    if (/^(?:sp_)?illust_char_/.test(name)) return appearanceType(record, "Illustration");
    if (/^char_\d+_[a-z0-9]+/.test(name) && !name.includes("__texture_") && /\.(?:png|skel|atlas|json)(?:\.txt)?$/.test(name)) {
      return appearanceType(record, skeletons.has(`${record.group}/${stem}`) ? "Chibi" : "Illustration");
    }
    return "other";
  }
  const groups = new Map();
  let unknownLooseResource = false;
  for (const record of records) {
    const type = classify(record);
    if (!type) continue;
    if (type === "other" && !record.bundle && !/__(?:texture|page|atlas)/.test(record.name)) unknownLooseResource = true;
    const types = groups.get(record.group) || new Set();
    types.add(type);
    groups.set(record.group, types);
  }
  const found = new Set();
  for (const types of groups.values()) {
    // Generic atlas/material textures in a classified bundle support its
    // named resources; they should not add an "other" chip to every Mod.
    if (types.size > 1) types.delete("other");
    for (const type of types) found.add(type);
  }
  if (unknownLooseResource) found.add("other");
  return CONTENT_TYPE_ORDER.filter(type => found.has(type));
}

module.exports = { CONTENT_TYPE_ORDER, classifyContentTypes };
