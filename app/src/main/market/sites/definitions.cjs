'use strict';

// Verified game sections. Missing sections report an error until configured.
const i18n = require("../../../shared/i18n/core.cjs");
const GAMES = {
  endfield: {
    name: '终末地',
    banana: 21842
  },
  'wuthering-waves': {
    name: '鸣潮',
    banana: 20357
  },
  'genshin-impact': {
    name: '原神',
    banana: 8552
  },
  zzz: {
    name: '绝区零',
    banana: 19567
  },
  'honkai-star-rail': {
    name: '星穹铁道',
    banana: 18366
  },
  'neverness-to-everness': {
    name: '异环',
    banana: 23012
  }
};
const SITES = {
  gamebanana: {
    label: i18n.t("backend.modSites.gamebananaLabel"),
    home: 'https://gamebanana.com/',
    hosts: ['gamebanana.com'],
    mode: 'catalog',
    note: i18n.t("backend.modSites.gamebananaNote")
  },
  arca: {
    label: i18n.t("backend.modSites.arcaLabel"),
    home: 'https://arca.live/',
    hosts: ['arca.live'],
    sections: {
      endfield: 'https://arca.live/b/thingzyoa?category=enFielMd',
      'wuthering-waves': 'https://arca.live/b/thingzyoa'
    },
    note: i18n.t("backend.modSites.arcaNote")
  },
  loverslab: {
    label: 'LoversLab',
    home: 'https://www.loverslab.com/',
    hosts: ['loverslab.com'],
    sections: {
      endfield: 'https://www.loverslab.com/topic/262069-arknights-endfield-nude-mods',
      'wuthering-waves': 'https://www.loverslab.com/topic/231084-req-wuthering-waves'
    },
    extra: {
      endfield: [{
        label: i18n.t("backend.modSites.adultTheme"),
        url: 'https://www.loverslab.com/topic/264464-nude-arknights-endfield-mod-series'
      }]
    },
    note: i18n.t("backend.modSites.loverslabNote")
  },
  huiyue: {
    label: i18n.t("backend.modSites.huiyueLabel"),
    home: 'https://huiyue.org/',
    hosts: ['huiyue.org'],
    sections: {
      'wuthering-waves': 'https://huiyue.org/#page=c7ab0d38c4d283468c5f5b44',
      zzz: 'https://huiyue.org/#page=e9460edbfd6e8da0f2d21e5d',
      endfield: 'https://huiyue.org/#page=898ed52c298c60d95a8c9888',
      'neverness-to-everness': 'https://huiyue.org/#page=3955fe7c22f2ae1923799433',
      'honkai-star-rail': 'https://huiyue.org/#page=9e30eaef61cb3f27c43b242c'
    },
    note: i18n.t("backend.modSites.huiyueNote")
  },
  keke: {
    label: i18n.t("backend.modSites.kekeLabel"),
    home: 'https://kekehxl.org/',
    hosts: ['kekehxl.org', 'kekehxl.top'],
    sections: {
      endfield: 'https://kekehxl.org/product-category/endfield-mod/',
      'wuthering-waves': 'https://kekehxl.org/product-category/wutheringwaves-mod/'
    },
    note: i18n.t("backend.modSites.kekeNote")
  }
};
function siteDefinition(id) {
  if (!Object.hasOwn(SITES, id)) throw Error(i18n.t("backend.modSites.sourceUnsupported"));
  return SITES[id];
}
function safeWebUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port;
  } catch {
    return false;
  }
}
function siteUrl(value, id) {
  const site = siteDefinition(id);
  if (!safeWebUrl(value)) return false;
  const host = new URL(value).hostname;
  return site.hosts.some(domain => host === domain || host.endsWith('.' + domain));
}
function resolveSite(id, gameId, overrides = {}) {
  const site = siteDefinition(id),
    game = GAMES[gameId];
  const custom = overrides[id]?.[gameId];
  const section = custom && siteUrl(custom, id) ? custom : id === 'gamebanana' && game ? `https://gamebanana.com/mods/games/${game.banana}` : site.sections?.[gameId];
  return {
    id,
    label: site.label,
    home: site.home,
    url: section || site.home,
    gameId,
    gameName: game?.name || i18n.t("backend.fixes.service.currentGame"),
    hasSection: !!section,
    custom: !!custom,
    mode: 'catalog',
    note: site.note,
    extra: site.extra?.[gameId] || []
  };
}
module.exports = {
  SITES,
  GAMES,
  siteDefinition,
  safeWebUrl,
  siteUrl,
  resolveSite
};
