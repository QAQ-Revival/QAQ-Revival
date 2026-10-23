"use strict";

const FALLBACK_DEFAULT_CHARACTERS_BY_GAME = {
  endfield: ["汤汤", "洛茜", "男主", "女主", "佩丽卡", "陈千语", "莱万汀", "伊冯", "洁尔佩塔", "艾尔黛拉", "余烬", "别礼", "黎风", "骏卫", "阿列什", "弧光", "艾维文娜", "大潘", "昼雪", "狼卫", "赛希", "秋栗", "安塔尔", "卡契尔", "埃特拉", "萤石", "诀", "梨诺", "NPC", "大世界", "UI", "功能", "武器"],
  zzz: ["男主", "女主", "安比", "零号·安比", "安东", "本", "比利", "可琳", "格莉丝", "珂蕾妲", "猫又", "妮可", "艾莲", "苍角", "莱卡恩", "丽娜", "11号", "朱鸢", "青衣", "简", "赛斯", "露西", "派派", "凯撒", "柏妮思", "耀嘉音", "雅", "悠真", "伊芙琳", "仪玄", "橘福福", "扳机", "薇薇安", "雨果", "柚叶", "爱丽丝", "席德", "奥菲丝&鬼火", "潘引壶", "真斗", "卢西娅", "伊德海莉", "般岳", "叶瞬光", "照", "爱芮", "千夏", "南宫羽", "希希芙", "普罗米娅", "维琳娜", "诺姆", "柳", "波可娜", "琉音", "莱特", "佩洛伊斯", "NPC", "UI", "功能", "大世界", "武器"],
  "wuthering-waves": ["男主", "女主", "秋水", "爱弥斯", "奥古斯塔", "白芷", "布兰特", "卜灵", "卡卡罗", "椿", "坎特蕾拉", "珂莱塔", "卡提希娅", "长离", "千咲", "炽霞", "夏空", "丹瑾", "安可", "嘉贝莉娜", "绯雪", "尤诺", "鉴心", "今汐", "忌炎", "凌阳", "洛瑟菈", "灯灯", "露帕", "陆·赫斯", "琳奈", "莫宁", "莫特斐", "菲比", "弗洛洛", "仇远", "洛可可", "散华", "守岸人", "希格莉卡", "桃祈", "维里奈", "相里要", "秧秧", "吟霖", "釉瑚", "渊武", "赞妮", "折枝", "穗穗", "秧秧·玄翎", "其他", "武器", "滑翔翼", "载具", "UI", "功能", "大世界", "NPC"]
};
const FALLBACK_MANUAL_CHARACTER_MAPPINGS_BY_GAME = {
  endfield: {
    endministratormale: {
      displayName: "男主",
      canonicalEnName: "EndministratorMale"
    },
    endministratorfemale: {
      displayName: "女主",
      canonicalEnName: "EndministratorFemale"
    },
    others: {
      displayName: "其他",
      canonicalEnName: "Others"
    },
    weapons: {
      displayName: "武器",
      canonicalEnName: "Weapons"
    },
    陈: {
      displayName: "陈千语",
      canonicalEnName: "ChenQianyu"
    },
    chen: {
      displayName: "陈千语",
      canonicalEnName: "ChenQianyu"
    },
    "chen qianyu": {
      displayName: "陈千语",
      canonicalEnName: "ChenQianyu"
    },
    chenqianyu: {
      displayName: "陈千语",
      canonicalEnName: "ChenQianyu"
    },
    lastrite: {
      displayName: "别礼",
      canonicalEnName: "LastRite"
    },
    "last rite": {
      displayName: "别礼",
      canonicalEnName: "LastRite"
    },
    dapan: {
      displayName: "大潘",
      canonicalEnName: "DaPan"
    },
    "da pan": {
      displayName: "大潘",
      canonicalEnName: "DaPan"
    },
    openworld: {
      displayName: "大世界",
      canonicalEnName: "OpenWorld"
    },
    "open world": {
      displayName: "大世界",
      canonicalEnName: "OpenWorld"
    },
    function: {
      displayName: "功能",
      canonicalEnName: "Function"
    },
    functions: {
      displayName: "功能",
      canonicalEnName: "Function"
    },
    arcane: {
      displayName: "诀",
      canonicalEnName: "Arcane"
    },
    "オクギ": {
      displayName: "诀",
      canonicalEnName: "Arcane"
    },
    liino: {
      displayName: "梨诺",
      canonicalEnName: "Liino"
    },
    "リーノ": {
      displayName: "梨诺",
      canonicalEnName: "Liino"
    },
    管理员: {
      displayName: "管理员",
      canonicalEnName: "Endministrator"
    }
  },
  zzz: {
    wise: {
      displayName: "男主",
      canonicalEnName: "Wise"
    },
    哲: {
      displayName: "男主",
      canonicalEnName: "Wise"
    },
    belle: {
      displayName: "女主",
      canonicalEnName: "Belle"
    },
    铃: {
      displayName: "女主",
      canonicalEnName: "Belle"
    },
    玲: {
      displayName: "女主",
      canonicalEnName: "Belle"
    },
    ssanby: {
      displayName: "零号·安比",
      canonicalEnName: "SSAnby"
    },
    "soldier 0 - anby": {
      displayName: "零号·安比",
      canonicalEnName: "SSAnby"
    },
    jane: {
      displayName: "简",
      canonicalEnName: "Jane"
    },
    "jane doe": {
      displayName: "简",
      canonicalEnName: "Jane"
    },
    astra: {
      displayName: "耀嘉音",
      canonicalEnName: "Astra"
    },
    "astra yao": {
      displayName: "耀嘉音",
      canonicalEnName: "Astra"
    },
    harumasa: {
      displayName: "悠真",
      canonicalEnName: "Harumasa"
    },
    "asaba harumasa": {
      displayName: "悠真",
      canonicalEnName: "Harumasa"
    },
    miyabi: {
      displayName: "雅",
      canonicalEnName: "Miyabi"
    },
    "hoshimi miyabi": {
      displayName: "雅",
      canonicalEnName: "Miyabi"
    },
    lycaon: {
      displayName: "莱卡恩",
      canonicalEnName: "Lycaon"
    },
    "von lycaon": {
      displayName: "莱卡恩",
      canonicalEnName: "Lycaon"
    },
    rina: {
      displayName: "丽娜",
      canonicalEnName: "Rina"
    },
    "alexandrina sebastian": {
      displayName: "丽娜",
      canonicalEnName: "Rina"
    },
    nekomata: {
      displayName: "猫又",
      canonicalEnName: "Nekomata"
    },
    "nekomiya mana": {
      displayName: "猫又",
      canonicalEnName: "Nekomata"
    },
    yanagi: {
      displayName: "柳",
      canonicalEnName: "Yanagi"
    },
    "tsukishiro yanagi": {
      displayName: "柳",
      canonicalEnName: "Yanagi"
    },
    panyinhu: {
      displayName: "潘引壶",
      canonicalEnName: "PanYinhu"
    },
    "pan yinhu": {
      displayName: "潘引壶",
      canonicalEnName: "PanYinhu"
    },
    orphiemagnusson: {
      displayName: "奥菲丝&鬼火",
      canonicalEnName: "OrphieMagnusson"
    },
    "orphie magnusson & magus": {
      displayName: "奥菲丝&鬼火",
      canonicalEnName: "OrphieMagnusson"
    },
    character_others: {
      displayName: "其他",
      canonicalEnName: "Character_Others"
    },
    weapons: {
      displayName: "武器",
      canonicalEnName: "Weapons"
    },
    nangongyu: {
      displayName: "南宫羽",
      canonicalEnName: "NangongYu"
    },
    "nangong yu": {
      displayName: "南宫羽",
      canonicalEnName: "NangongYu"
    },
    南宫羽: {
      displayName: "南宫羽",
      canonicalEnName: "NangongYu"
    },
    南宫玉: {
      displayName: "南宫羽",
      canonicalEnName: "NangongYu"
    },
    cissia: {
      displayName: "希希芙",
      canonicalEnName: "Cissia"
    },
    希希芙: {
      displayName: "希希芙",
      canonicalEnName: "Cissia"
    },
    茜茜娅: {
      displayName: "希希芙",
      canonicalEnName: "Cissia"
    },
    "11号": {
      displayName: "11号",
      canonicalEnName: "Soldier11"
    },
    soldier11: {
      displayName: "11号",
      canonicalEnName: "Soldier11"
    },
    "soldier 11": {
      displayName: "11号",
      canonicalEnName: "Soldier11"
    },
    "「11号」": {
      displayName: "11号",
      canonicalEnName: "Soldier11"
    },
    扳机: {
      displayName: "扳机",
      canonicalEnName: "Trigger"
    },
    "「扳机」": {
      displayName: "扳机",
      canonicalEnName: "Trigger"
    },
    席德: {
      displayName: "席德",
      canonicalEnName: "Seed"
    },
    "「席德」": {
      displayName: "席德",
      canonicalEnName: "Seed"
    },
    "奥菲丝&鬼火": {
      displayName: "奥菲丝&鬼火",
      canonicalEnName: "OrphieMagnusson"
    },
    "奥菲丝&「鬼火」": {
      displayName: "奥菲丝&鬼火",
      canonicalEnName: "OrphieMagnusson"
    },
    openworld: {
      displayName: "大世界",
      canonicalEnName: "OpenWorld"
    },
    "open world": {
      displayName: "大世界",
      canonicalEnName: "OpenWorld"
    },
    function: {
      displayName: "功能",
      canonicalEnName: "Function"
    },
    functions: {
      displayName: "功能",
      canonicalEnName: "Function"
    },
    pyrois: {
      displayName: "佩洛伊斯",
      canonicalEnName: "Pyrois"
    },
    佩洛伊斯: {
      displayName: "佩洛伊斯",
      canonicalEnName: "Pyrois"
    }
  },
  "wuthering-waves": {
    rover: {
      displayName: "漂泊者",
      canonicalEnName: "Rover"
    },
    shorekeeper: {
      displayName: "守岸人",
      canonicalEnName: "Shorekeeper"
    },
    "the shorekeeper": {
      displayName: "守岸人",
      canonicalEnName: "Shorekeeper"
    },
    luuk: {
      displayName: "陆·赫斯",
      canonicalEnName: "Luuk"
    },
    "luuk herssen": {
      displayName: "陆·赫斯",
      canonicalEnName: "Luuk"
    },
    lumi: {
      displayName: "灯灯",
      canonicalEnName: "LUMI"
    },
    xiangliyao: {
      displayName: "相里要",
      canonicalEnName: "Xiangliyao"
    },
    "xiangli yao": {
      displayName: "相里要",
      canonicalEnName: "Xiangliyao"
    },
    others: {
      displayName: "其他",
      canonicalEnName: "Others"
    },
    weapons: {
      displayName: "武器",
      canonicalEnName: "Weapons"
    },
    gliders: {
      displayName: "滑翔翼",
      canonicalEnName: "Gliders"
    },
    vehicles: {
      displayName: "载具",
      canonicalEnName: "Vehicles"
    },
    vehicle: {
      displayName: "载具",
      canonicalEnName: "Vehicles"
    },
    lucilla: {
      displayName: "洛瑟菈",
      canonicalEnName: "Lucilla"
    },
    sigrika: {
      displayName: "希格莉卡",
      canonicalEnName: "Sigrika"
    },
    hiyuki: {
      displayName: "绯雪",
      canonicalEnName: "Hiyuki"
    },
    feixue: {
      displayName: "绯雪",
      canonicalEnName: "Hiyuki"
    },
    suisui: {
      displayName: "穗穗",
      canonicalEnName: "Suisui"
    },
    "穂穂": {
      displayName: "穗穗",
      canonicalEnName: "Suisui"
    },
    "yangyang: xuanling": {
      displayName: "秧秧·玄翎",
      canonicalEnName: "YangyangXuanling"
    },
    "yangyang xuanling": {
      displayName: "秧秧·玄翎",
      canonicalEnName: "YangyangXuanling"
    },
    yangyangxuanling: {
      displayName: "秧秧·玄翎",
      canonicalEnName: "YangyangXuanling"
    },
    "秧秧・玄翎": {
      displayName: "秧秧·玄翎",
      canonicalEnName: "YangyangXuanling"
    },
    露琪拉: {
      displayName: "洛瑟菈",
      canonicalEnName: "Lucilla"
    },
    露西拉: {
      displayName: "洛瑟菈",
      canonicalEnName: "Lucilla"
    },
    希格丽卡: {
      displayName: "希格莉卡",
      canonicalEnName: "Sigrika"
    },
    openworld: {
      displayName: "大世界",
      canonicalEnName: "OpenWorld"
    },
    "open world": {
      displayName: "大世界",
      canonicalEnName: "OpenWorld"
    },
    function: {
      displayName: "功能",
      canonicalEnName: "Function"
    },
    functions: {
      displayName: "功能",
      canonicalEnName: "Function"
    }
  }
};
module.exports = {
  FALLBACK_DEFAULT_CHARACTERS_BY_GAME,
  FALLBACK_MANUAL_CHARACTER_MAPPINGS_BY_GAME
};
