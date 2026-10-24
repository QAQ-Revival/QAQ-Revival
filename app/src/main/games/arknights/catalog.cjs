"use strict";

const SKIN_SOURCE = "https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/master/zh_CN/gamedata/excel/skin_table.json";
function parseSkins(data, config) {
  const owners = new Map((config.characterNameMap?.pairs || []).map(pair => [pair.en, pair]));
  const characters = new Map();
  for (const skin of Object.values(data.charSkins || {})) {
    const owner = owners.get(skin.charId);
    const name = skin.displaySkin?.skinName;
    if (!owner || !name || !skin.avatarId || !skin.skinId) continue;
    if (!characters.has(skin.charId)) characters.set(skin.charId, { characterId: skin.charId, nameZh: owner.zh, nameEn: owner.en, aliases: owner.aliases || [], skins: [] });
    const assets = [skin.skinId, skin.illustId, skin.spIllustId, skin.dynIllustId, skin.spDynIllustId, skin.buildingId, skin.avatarId, skin.portraitId].filter(value => typeof value === "string");
    const id = skin.skinId.replace(/[@#]/g, ".");
    const image = `https://raw.githubusercontent.com/ArknightsAssets/ArknightsAssets2/cn/assets/dyn/arts/charportraits/skins/${encodeURIComponent(skin.portraitId || skin.avatarId)}.png`;
    characters.get(skin.charId).skins.push({
      id,
      sectionId: `skin:${id}`,
      nameZh: name,
      aliases: [...new Set(assets.flatMap(value => [value, value.replace(/[#@]/g, "_")]))],
      image,
      sourceImageUrl: image,
      type: [skin.dynIllustId ? "dynamic" : "static"]
    });
  }
  return { schemaVersion: 1, gameId: "arknights", source: { url: SKIN_SOURCE }, characters: [...characters.values()] };
}
module.exports = { SKIN_SOURCE, parseSkins };
