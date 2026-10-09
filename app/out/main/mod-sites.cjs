'use strict';

// Verified game sections. Missing sections report an error until configured.
const GAMES = {
  endfield: { name: '终末地', banana: 21842 },
  'wuthering-waves': { name: '鸣潮', banana: 20357 },
  'genshin-impact': { name: '原神', banana: 8552 },
  zzz: { name: '绝区零', banana: 19567 },
  'honkai-star-rail': { name: '星穹铁道', banana: 18366 },
  'neverness-to-everness': { name: '异环', banana: 23012 }
};
const SITES = {
  gamebanana: { label: '香蕉网', home: 'https://gamebanana.com/', hosts: ['gamebanana.com'], mode: 'catalog',
    note: '列表、详情和下载共用站点会话。需要时在当前页面完成验证。' },
  arca: { label: '韩网 · Arca', home: 'https://arca.live/', hosts: ['arca.live'],
    sections: { endfield: 'https://arca.live/b/thingzyoa?category=enFielMd', 'wuthering-waves': 'https://arca.live/b/thingzyoa' },
    note: '终末地与鸣潮共用 thingzyoa 版块。需要时在当前页面完成验证或登录。' },
  loverslab: { label: 'LoversLab', home: 'https://www.loverslab.com/', hosts: ['loverslab.com'],
    sections: { endfield: 'https://www.loverslab.com/topic/262069-arknights-endfield-nude-mods', 'wuthering-waves': 'https://www.loverslab.com/topic/231084-req-wuthering-waves' },
    extra: { endfield: [{ label: '另一系列主题（成人内容）', url: 'https://www.loverslab.com/topic/264464-nude-arknights-endfield-mod-series' }] },
    note: '已配置终末地、鸣潮主题。需要时在页内完成验证或登录。' },
  huiyue: { label: '辉站', home: 'https://huiyue.org/', hosts: ['huiyue.org'],
    sections: {
      'wuthering-waves': 'https://huiyue.org/#page=c7ab0d38c4d283468c5f5b44',
      zzz: 'https://huiyue.org/#page=e9460edbfd6e8da0f2d21e5d',
      endfield: 'https://huiyue.org/#page=898ed52c298c60d95a8c9888',
      'neverness-to-everness': 'https://huiyue.org/#page=3955fe7c22f2ae1923799433',
      'honkai-star-rail': 'https://huiyue.org/#page=9e30eaef61cb3f27c43b242c'
    }, note: '访问前可能需要页内排队验证。原神目前不在公开游戏导航中。' },
  keke: { label: '可可站', home: 'https://kekehxl.org/', hosts: ['kekehxl.org', 'kekehxl.top'],
    sections: { endfield: 'https://kekehxl.org/product-category/endfield-mod/', 'wuthering-waves': 'https://kekehxl.org/product-category/wutheringwaves-mod/' },
    note: '原域名已跳转至 kekehxl.org。首次进入请在原站输入入站密码。已核实终末地、鸣潮两个 Mod 分区。' }
};
function siteDefinition(id) {
  if (!Object.hasOwn(SITES, id)) throw Error('不支持的下载来源');
  return SITES[id];
}
function safeWebUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port;
  } catch { return false; }
}
function siteUrl(value, id) {
  const site = siteDefinition(id);
  if (!safeWebUrl(value)) return false;
  const host = new URL(value).hostname;
  return site.hosts.some(domain => host === domain || host.endsWith('.' + domain));
}
function resolveSite(id, gameId, overrides = {}) {
  const site = siteDefinition(id), game = GAMES[gameId];
  const custom = overrides[id]?.[gameId];
  const section = custom && siteUrl(custom, id) ? custom :
    id === 'gamebanana' && game ? `https://gamebanana.com/mods/games/${game.banana}` : site.sections?.[gameId];
  return { id, label: site.label, home: site.home, url: section || site.home, gameId,
    gameName: game?.name || '当前游戏', hasSection: !!section, custom: !!custom,
    mode: 'catalog', note: site.note,
    extra: site.extra?.[gameId] || [] };
}
module.exports = { SITES, GAMES, siteDefinition, safeWebUrl, siteUrl, resolveSite };
