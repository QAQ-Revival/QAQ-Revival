let pinyin = null;
const pinyinReady = import("pinyin-pro").then((mod) => {
  pinyin = mod.pinyin;
});
export { pinyin, pinyinReady };
