const path = require('node:path');

const GAME_ID = 'genshin-impact';
const EXECUTABLES = ['YuanShen.exe', 'GenshinImpact.exe'];
const dataUrl = (folder, language) => `https://genshin-db-api.vercel.app/api/v5/${folder}?query=names&matchCategories=true&verboseCategories=true&resultLanguage=${language}`;
const CHARACTER_SOURCES = ['ChineseSimplified', 'English'].map(language => dataUrl('characters', language));
const OUTFIT_SOURCES = ['ChineseSimplified', 'English'].map(language => dataUrl('outfits', language));
const unique = values => [...new Set(values.filter(Boolean))];
const assetImage = filename => /^UI_[A-Za-z0-9_]+$/.test(filename || '') ? `https://enka.network/ui/${filename}.png` : null;
const traveler = id => Number(id) === 10000005 ? { name: '空', en: 'Aether', aliases: ['男主', '旅行者男', 'TravelerMale', 'TravelerBoy', 'PlayerBoy'] }
  : Number(id) === 10000007 ? { name: '荧', en: 'Lumine', aliases: ['女主', '旅行者女', 'TravelerFemale', 'TravelerGirl', 'PlayerGirl'] } : null;
const characterAliases = {
  10000002: ['Ayaka', '绫华'], 10000033: ['Childe', '公子'], 10000047: ['Kazuha', '万叶'],
  10000052: ['Raiden', 'RaidenShogun', 'Shogun', '雷神', '影'], 10000054: ['Kokomi', '心海'],
  10000056: ['Sara', '裟罗'], 10000057: ['Itto', '一斗'], 10000058: ['Yae', 'YaeMiko', '神子'],
  10000059: ['Heizou', '平藏'], 10000065: ['Shinobu', '阿忍'], 10000066: ['Ayato', '绫人'],
  10000075: ['Scaramouche', '散兵'], 10000109: ['Mizuki', '瑞希']
};
function requireList(value) {
  if (!Array.isArray(value) || value.length > 2000) throw Error('原神资料格式无效');
  return value;
}
function parseCharacters(chinese, english) {
  const translated = new Map(requireList(english).map(item => [item.id, item]));
  const records = new Map();
  for (const item of requireList(chinese)) {
    // One folder per playable character (and per Traveler), regardless of element.
    if (!Number.isInteger(item.id) || item.id < 10000001 || item.id >= 10000900 || !item.name || records.has(item.id)) continue;
    const en = translated.get(item.id)?.name || '';
    if (/试用|测试|\b(?:Trial|Test)\b/i.test(item.name + ' ' + en)) continue;
    const identity = traveler(item.id) || { name: item.name, en, aliases: [] };
    const asset = item.images?.filename_icon;
    const shorthand = String(asset || '').replace(/^UI_AvatarIcon_/, '');
    records.set(item.id, { ...identity, aliases: unique([...identity.aliases, ...(characterAliases[item.id] || []),
      identity.en.replace(/[\s.'’()-]/g, ''), shorthand]), image: assetImage(asset) });
  }
  return [...records.values()];
}
function parseOutfits(chinese, english) {
  const translated = new Map(requireList(english).map(item => [item.id, item]));
  const characters = new Map(), seen = new Set();
  for (const item of requireList(chinese)) {
    if (item.isDefault !== false || !Number.isInteger(item.id) || !Number.isInteger(item.characterId) || seen.has(item.id)) continue;
    const en = translated.get(item.id);
    const identity = traveler(item.characterId) || { name: item.characterName, en: en?.characterName || '', aliases: [] };
    const image = assetImage(item.images?.filename_splash || item.images?.filename_icon);
    if (!identity.name || !item.name || !image) throw Error('原神外观资料不完整');
    if (!characters.has(item.characterId)) characters.set(item.characterId, { nameZh: identity.name, nameEn: identity.en, aliases: identity.aliases, skins: [] });
    const id = 'genshin-outfit-' + item.id;
    characters.get(item.characterId).skins.push({ id, sectionId: 'skin:' + id, sourceFashionId: String(item.id),
      nameZh: item.name, nameEn: en?.name || '', aliases: unique([item.name, en?.name]), releaseVersion: item.version || '',
      type: ['Character Outfit'], image, sourceImageUrl: image, sourcePageUrl: 'https://github.com/theBowja/genshin-db' });
    seen.add(item.id);
  }
  if (!seen.size) throw Error('未取得原神外观资料，已保留原有目录');
  return { schemaVersion: 1, gameId: GAME_ID, characters: [...characters.values()], source: {
    name: 'genshin-db / Enka.Network', url: 'https://github.com/theBowja/genshin-db', urls: OUTFIT_SOURCES,
    license: 'genshin-db: MIT; game images and data belong to HoYoverse' } };
}
function buildGamePathCandidates(readRegistry, gameFolders = [], env = process.env) {
  const folders = [...gameFolders];
  for (const publisher of ['miHoYo', 'Cognosphere']) {
    for (const channel of ['hk4e_cn', 'hk4e_global', 'hk4e_os', 'hk4e_bilibili']) {
      const installed = readRegistry(`HKCU\\SOFTWARE\\${publisher}\\HYP\\1_1\\${channel}`, 'GameInstallPath');
      if (installed) folders.push(installed);
    }
  }
  const roots = ['C', 'D', 'E', 'F', 'G'].map(drive => drive + ':\\');
  roots.push(env.ProgramFiles || 'C:\\Program Files', env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)');
  for (const root of roots) {
    for (const parent of ['', 'Games', 'HoYoPlay\\games', 'miHoYo Launcher\\games', 'Genshin Impact', '原神']) {
      for (const folder of ['Genshin Impact Game', 'Genshin Impact', 'YuanShen', '原神']) folders.push(path.win32.join(root, parent, folder));
    }
  }
  return unique(folders.flatMap(folder => EXECUTABLES.map(exe => path.win32.join(folder, exe))));
}
module.exports = { GAME_ID, EXECUTABLES, CHARACTER_SOURCES, OUTFIT_SOURCES, parseCharacters, parseOutfits, buildGamePathCandidates };
