const { imageUrl } = require('./character-catalog.cjs');

const WIKIS = {
  'wuthering-waves': { host: 'wutheringwaves.fandom.com', categories: ['Signature Outfits', 'Deluxe Outfits', 'Premium Outfits'] },
  zzz: { host: 'zenless-zone-zero.fandom.com', categories: ['Paid Outfits', 'Event Reward Outfits', 'Commission Reward Outfits'] },
  'honkai-star-rail': { host: 'honkai-star-rail.fandom.com', categories: ['Alternate Outfits', 'Outfit Trailblaze Fashion', 'Stellar Couture Outfits'] }
};
const NTE_REPO = 'https://raw.githubusercontent.com/Waifus-Grace/NTE_Assets/';
const key = value => String(value || '').replace(/_/g, ' ').trim().toLowerCase();
const unique = values => [...new Set(values.filter(Boolean))];
const clean = value => String(value || '').replace(/\[\[(?:[^|\]]+\|)?([^\]]+)\]\]/g, '$1').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim();

async function fetchJson(url, fetchFn) {
  const response = await fetchFn(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok || !response.body || Number(response.headers.get('content-length')) > 8 * 1024 * 1024) {
    await response.body?.cancel();
    throw Error(`外观资料请求失败（HTTP ${response.status}）`);
  }
  const reader = response.body.getReader(), chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8 * 1024 * 1024) throw Error('外观资料响应过大');
      chunks.push(Buffer.from(value));
    }
  } finally { await reader.cancel(); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
function fields(text, template) {
  const body = new RegExp('\\{\\{' + template + '\\b([\\s\\S]*?)^\\}\\}', 'mi').exec(text)?.[1];
  if (!body) return null;
  return Object.fromEntries([...body.matchAll(/^\|\s*(\w+)\s*=\s*([\s\S]*?)(?=^\|\s*\w+\s*=|$(?![\s\S]))/gm)].map(match => [match[1].toLowerCase(), match[2].trim()]));
}
function resolveCharacter(names, base, config) {
  const normalized = names.map(key).filter(Boolean);
  const existing = (base.characters || []).find(character =>
    [character.nameZh, character.nameEn, ...(character.aliases || [])].some(name => normalized.includes(key(name))));
  if (existing) return { nameZh: existing.nameZh, nameEn: existing.nameEn, aliases: unique([...(existing.aliases || []), ...names]) };
  for (const name of names) {
    const mapped = config.manualMappings?.[key(name)];
    const pair = config.characterNameMap?.pairs?.find(item => normalized.includes(key(item.en)) || normalized.includes(key(item.zh)));
    if (mapped || pair) return { nameZh: mapped?.displayName || pair.zh, nameEn: mapped?.canonicalEnName || pair.en, aliases: unique(names) };
  }
  // Some wikis use full names where the game catalog uses a short name. Accept only an unambiguous whole-word match.
  const candidates = (config.characterNameMap?.pairs || []).filter(pair => key(pair.en) && normalized.some(name => name.startsWith(key(pair.en) + ' ') || key(pair.en).startsWith(name + ' ')));
  if (unique(candidates.map(item => item.zh)).length === 1) return { nameZh: candidates[0].zh, nameEn: candidates[0].en, aliases: unique(names) };
  return { nameZh: names.find(name => /[\u3400-\u9fff]/.test(name)) || '', nameEn: names.find(name => !/[\u3400-\u9fff]/.test(name)) || '', aliases: unique(names) };
}
function imageFiles(text) {
  return unique([...String(text).replace(/<!--[\s\S]*?-->/g, '').trim().matchAll(/(?:^|\n|<gallery[^>]*>\s*)([^\n<>|]+\.(?:png|webp|jpe?g))(?=\||\s*(?:\n|$|<))/gi)].map(match => clean(match[1]).replace(/^File:/i, '')));
}
function parseWikiPage(gameId, page, base, config) {
  const text = page.revisions?.[0]?.slots?.main?.content;
  if (typeof text !== 'string') throw Error('Wiki 外观页面缺少正文');
  if (/\{\{\s*(Upcoming|Unreleased|Beta)\b/i.test(text)) return [];
  const info = fields(text, 'Outfit Infobox');
  if (!info) return [];
  const owner = clean(info.character || info.agent);
  if (!owner || !info.image || !info.type) throw Error(`外观页面格式变化：${page.title}`);
  if (/^(Original|Default)$/i.test(info.type)) return [];
  if (gameId === 'honkai-star-rail' && info.type === 'Trailblaze Fashion' && info.subtype !== 'Outfit') return [];
  const languages = fields(text, 'Other Languages') || {};
  const nameZh = clean(languages.zhs), nameEn = clean(languages.en) || page.title;
  const sourcePageUrl = `https://${WIKIS[gameId].host}/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`;
  const owners = gameId === 'wuthering-waves' && owner === 'Rover' ? [['男主', 'Rover (Male)', 'm'], ['女主', 'Rover (Female)', 'f']]
    : gameId === 'honkai-star-rail' && owner === 'Trailblazer' ? [['男主', 'Caelus', 'm'], ['女主', 'Stelle', 'f']] : [['', owner, '']];
  return owners.map(([zh, en, gender]) => {
    const character = resolveCharacter([zh, en].filter(Boolean), base, config);
    const oldCharacter = (base.characters || []).find(item => key(item.nameZh || item.nameEn) === key(character.nameZh || character.nameEn));
    const oldSkin = oldCharacter?.skins?.find(skin => key(skin.nameEn) === key(nameEn) || skin.sourcePageUrl === sourcePageUrl);
    const files = gender ? imageFiles(text).filter(file => gender === 'm' ? /\bMale\b|\(M\)/i.test(file) : /\bFemale\b|\(F\)/i.test(file)) : imageFiles(info.image);
    const score = file => /Portrait|Splash Art/i.test(file) ? 2 : /Icon|^Item /i.test(file) ? 1 : 0;
    const imageFile = imageFiles(text).find(file => oldSkin?.sourceImageFile && key(file) === key(oldSkin.sourceImageFile)) || files.sort((a, b) => score(b) - score(a))[0];
    if (!imageFile) throw Error(`外观页面缺少可用图片：${page.title}`);
    const id = `${gameId}-wiki-${page.pageid}${gender ? '-' + gender : ''}`;
    return { character, skin: {
      id, sectionId: 'skin:' + id, nameZh, nameEn, aliases: unique([nameZh, nameEn]),
      type: info.type.split(';').map(clean), sourcePageUrl, sourceImageFile: imageFile,
      ...(gender ? { genderVariant: gender } : {})
    } };
  });
}
function groupRecords(records) {
  const characters = new Map();
  for (const { character, skin } of records) {
    const identity = key(character.nameZh || character.nameEn);
    if (!identity) throw Error('外观缺少所属角色');
    if (!characters.has(identity)) characters.set(identity, { ...character, skins: [] });
    characters.get(identity).skins.push(skin);
  }
  if (!characters.size) throw Error('未取得有效外观，已保留原有目录');
  return { schemaVersion: 1, characters: [...characters.values()] };
}
async function fetchWikiSkins(gameId, base, config, fetchFn) {
  const wiki = WIKIS[gameId];
  const api = async params => {
    const result = await fetchJson(`https://${wiki.host}/api.php?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`, fetchFn);
    if (result.error) throw Error('Wiki 外观接口返回错误');
    return result;
  };
  const pages = new Map();
  for (const category of wiki.categories) {
    let continuation = {};
    for (let batch = 0; batch < 20; batch++) {
      const data = await api({ action: 'query', generator: 'categorymembers', gcmtitle: 'Category:' + category, gcmnamespace: '0', gcmlimit: '50', prop: 'revisions', rvprop: 'content', rvslots: 'main', ...continuation });
      for (const page of data.query?.pages || []) pages.set(page.pageid, page);
      if (!data.continue) break;
      if (batch === 19) throw Error('Wiki 外观列表分页超出限制');
      continuation = data.continue;
    }
  }
  const records = [...pages.values()].flatMap(page => parseWikiPage(gameId, page, base, config));
  const unknownOwners = unique(records.filter(record => !record.character.nameZh).map(record => record.character.nameEn));
  if (unknownOwners.length > 40) throw Error('过多外观无法匹配所属角色');
  if (unknownOwners.length) {
    const data = await api({ action: 'query', titles: unknownOwners.join('|'), redirects: '1', prop: 'revisions', rvprop: 'content', rvslots: 'main' });
    for (const page of data.query?.pages || []) {
      const text = page.revisions?.[0]?.slots?.main?.content || '';
      const info = fields(text, 'Agent Infobox') || {}, languages = fields(text, 'Other Languages') || {};
      const owner = resolveCharacter([page.title, clean(info.brief_name), clean(languages.zhs)].filter(Boolean), base, config);
      for (const record of records) if (key(record.character.nameEn) === key(page.title) && owner.nameZh) record.character = owner;
    }
  }
  const files = unique(records.map(record => record.skin.sourceImageFile)), images = new Map();
  for (let offset = 0; offset < files.length; offset += 40) {
    const data = await api({ action: 'query', titles: files.slice(offset, offset + 40).map(file => 'File:' + file).join('|'), prop: 'imageinfo', iiprop: 'url' });
    for (const page of data.query?.pages || []) images.set(key(page.title.replace(/^File:/i, '')), imageUrl(page.imageinfo?.[0]?.url));
  }
  for (const { skin } of records) {
    skin.image = skin.sourceImageUrl = images.get(key(skin.sourceImageFile));
    if (!skin.image) throw Error(`外观图片资料不完整：${skin.nameZh || skin.nameEn}`);
  }
  return { ...groupRecords(records), gameId, source: { name: wiki.host, url: `https://${wiki.host}`, license: 'CC BY-SA (wiki text); game images belong to their respective owners' } };
}
function parseNteSkins(appearanceData, characterData, defaults, revision, base, config) {
  const appearances = appearanceData?.[0]?.Rows, characters = characterData?.[0]?.Rows, defaultRows = defaults?.[0]?.Rows;
  if (!appearances || !characters || !defaultRows) throw Error('异环外观数据表格式变化');
  const defaultIds = new Set(Object.values(defaultRows).map(row => row.DefaultFashionID));
  const records = [];
  for (const [sourceFashionId, row] of Object.entries(appearances)) {
    if (row.AppearanceType !== 'EAppearanceType::Fashion' || row.IsDefault || defaultIds.has(sourceFashionId) || row.IsCharacterShow !== true || !row.AppearanceData?.PlayerAppearanceAsset?.AssetPathName) continue;
    const owner = characters[row.CharacterID]?.ItemName;
    if (!owner || !row.Name?.SourceString || /<!>|测试/.test(row.Name.SourceString)) continue;
    const existingOwner = (base.characters || []).find(character => character.skins?.some(skin => String(skin.sourceCharacterId || '') === String(row.CharacterID)));
    const character = existingOwner
      ? { nameZh: existingOwner.nameZh, nameEn: existingOwner.nameEn, aliases: existingOwner.aliases || [] }
      : resolveCharacter([owner.SourceString, owner.LocalizedString].filter(Boolean), base, config);
    const asset = row.PortraitImg?.AssetPathName || row.DisplayIcon?.AssetPathName;
    if (!asset?.startsWith('/Game/UI/') || asset.includes('..')) continue;
    const image = NTE_REPO + revision + '/' + asset.replace(/^\/Game\/UI\//, '').split('.')[0] + '.png';
    const id = 'nte-' + sourceFashionId.toLowerCase().replace(/_/g, '-');
    records.push({ character, skin: { id, sectionId: 'skin:' + id, sourceFashionId, sourceCharacterId: String(row.CharacterID),
      nameZh: row.Name.SourceString, nameEn: row.Name.LocalizedString || '', aliases: unique([row.Name.SourceString, row.Name.LocalizedString]),
      type: ['Character Fashion'], image, sourceImageUrl: image,
      sourcePageUrl: `https://github.com/Waifus-Grace/NTE_Assets/blob/${revision}/DataTable/Character/Appearance/DT_AppearanceData.json`
    } });
  }
  return { ...groupRecords(records), gameId: 'neverness-to-everness', source: { name: 'NTE_Assets', revision,
    url: 'https://github.com/Waifus-Grace/NTE_Assets', scope: 'Visible non-default character fashion with a concrete appearance asset; availability is not independently verified' } };
}
async function fetchSkinCatalog(gameId, base, config, fetchFn = fetch) {
  if (gameId === 'genshin-impact') {
    const { OUTFIT_SOURCES, parseOutfits } = require('./genshin.cjs');
    return parseOutfits(...await Promise.all(OUTFIT_SOURCES.map(url => fetchJson(url, fetchFn))));
  }
  if (WIKIS[gameId]) return fetchWikiSkins(gameId, base, config, fetchFn);
  if (gameId !== 'neverness-to-everness') throw Error('此游戏暂未配置可靠的在线外观目录，保留内置资料');
  const commit = await fetchJson('https://api.github.com/repos/Waifus-Grace/NTE_Assets/commits/main', fetchFn);
  if (!/^[a-f0-9]{40}$/.test(commit.sha)) throw Error('异环数据版本无效');
  const data = await Promise.all(['DataTable/Character/Appearance/DT_AppearanceData.json', 'DataTable/Character/DT_Character.json', 'DataTable/Character/Appearance/DT_DefaultAppearanceData.json'].map(file => fetchJson(NTE_REPO + commit.sha + '/' + file, fetchFn)));
  return parseNteSkins(...data, commit.sha, base, config);
}
module.exports = { fetchSkinCatalog, parseWikiPage, parseNteSkins };
