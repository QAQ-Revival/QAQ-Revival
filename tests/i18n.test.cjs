'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTranslator, t, getLanguage, setLanguage, LANGUAGES } = require('../app/src/shared/i18n/core.cjs');
const { registerI18n } = require('../app/src/shared/i18n/main.cjs');
const { inspectSource, inspectMarkup, readLocales, validateLocales, flatten } = require('../tools/check-i18n.cjs');

test('resources use semantic keys, genuine English, and matching named interpolation', () => {
  const locales = readLocales();
  assert.deepEqual(validateLocales(locales), []);
  assert.deepEqual(flatten(require('../app/src/shared/i18n/resources.cjs')['zh-CN'].translation), locales['zh-CN']);
  assert.ok(Object.keys(locales['zh-CN']).length > 100);
  assert.deepEqual(LANGUAGES.map(item => item.code), ['zh-CN']);
  assert.deepEqual(validateLocales({ 'zh-CN': { 'demo.label': '{{name}}' }, en: { 'demo.label': '中文 {{arg1}}' } }).map(issue => issue.message),
    ['Use named interpolation', 'Interpolation differs from the default language', 'Untranslated Chinese in English resource']);
});

test('independent translators default to Chinese, interpolate text safely, and fall back to Chinese', () => {
  const chinese = createTranslator();
  const english = createTranslator('en');
  assert.equal(chinese.t('common.actions.cancel'), '取消');
  assert.equal(english.t('common.actions.cancel'), 'Cancel');
  assert.equal(english.t('common.actions.selectNamed', { label: '<Mods & skins>' }), 'Select <Mods & skins>');
  english.addResource('zh-CN', 'translation', 'example.fallback', '中文默认');
  assert.equal(english.t('example.fallback'), '中文默认');
  assert.equal(chinese.language, 'zh-CN');
  assert.equal(english.language, 'en');
});

test('language IPC persists before broadcasting and rejects unavailable languages and save failures', async () => {
  const handlers = new Map();
  const sent = [];
  let saved, writable = true;
  registerI18n({
    ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) },
    BrowserWindow: { getAllWindows: () => [1, 2].map(id => ({ webContents: { send: (...args) => sent.push({ id, saved, args }) } })) },
    readLanguage: () => 'unsupported',
    writeLanguage: language => { if (!writable) return false; saved = language; return true; }
  });
  assert.equal(handlers.get('i18n:get-language')().language, 'zh-CN');
  assert.equal((await handlers.get('i18n:set-language')({}, 'en')).success, false);
  assert.equal(saved, undefined);
  assert.equal((await handlers.get('i18n:set-language')({}, 'zh-CN')).success, true);
  assert.deepEqual(sent.map(item => [item.saved, item.args]), [
    ['zh-CN', ['i18n:language-changed', 'zh-CN']], ['zh-CN', ['i18n:language-changed', 'zh-CN']]
  ]);
  writable = false;
  assert.equal((await handlers.get('i18n:set-language')({}, 'zh-CN')).success, false);
  assert.equal(sent.length, 2);
  assert.equal(getLanguage(), 'zh-CN');
});

test('renderer consumes the preload language API and removes both subscriptions', async () => {
  const { initializeRendererI18n, changeLanguage } = await import('../app/src/shared/i18n/renderer.mjs');
  const { t: esmTranslate } = await import('../app/src/shared/i18n/index.mjs');
  const root = {};
  let listener, removed = false;
  const api = {
    i18nGetLanguage: async () => ({ success: true, language: 'zh-CN' }),
    i18nSetLanguage: async language => ({ success: language === 'zh-CN', language, error: 'unavailable' }),
    onLanguageChanged: callback => { listener = callback; return () => { removed = true; }; }
  };
  const dispose = await initializeRendererI18n(api, root);
  assert.equal(root.lang, 'zh-CN');
  assert.equal(esmTranslate('common.actions.save'), t('common.actions.save'));
  await changeLanguage(api, 'zh-CN');
  await assert.rejects(changeLanguage(api, 'en'), /unavailable/);
  await listener('zh-CN');
  dispose();
  assert.equal(removed, true);
  root.lang = 'disposed';
  await setLanguage('zh-CN');
  assert.equal(root.lang, 'disposed');
});

test('source checks detect display sinks, native dialogs, and invalid translation calls while preserving data', () => {
  const source = [
    "const character = { name: '角色名', path: '中文目录' };",
    "console.log('中文日志'); logger.error('错误日志');",
    "const regex = /中文正则/; const matches = value === '业务枚举';",
    "setLogs(previous => [...previous, { message: '保留原始日志' }]);",
    "function t(value) { return value; } t('不是翻译函数');",
    "h('span', null, '界面文本');",
    "jsx.jsx('input', { placeholder: '输入名称', 'aria-label': '名称输入框' });",
    "dialog.showMessageBox({ title: '确认操作', message: '继续吗', buttons: ['确定', '取消'] });",
    "throw Error('用户可见错误');",
    "const note = '通过变量显示'; setNotice(note);",
    "return value === '业务标记' ? '未识别的返回值' : '另一个业务值';"
  ].join('\n');
  const issues = inspectSource(source);
  assert.deepEqual(issues.map(issue => issue.text), ['界面文本', '输入名称', '名称输入框', '确认操作', '继续吗', '确定', '取消', '用户可见错误', '通过变量显示']);
  const assigned = inspectSource("stateError = '保存记录读取失败'; catalog.errors.storage = '组件记录读取失败'; data.name = '中文业务数据'; const result = { managedInstall: true, modName: `${gameName}修复器` }; system.probeWritableDirectory('中文路径', '安装目录');");
  assert.deepEqual(assigned.map(issue => issue.text), ['保存记录读取失败', '组件记录读取失败', '…修复器', '安装目录']);
  const invalid = inspectSource("t('demo.greeting'); t('demo.missing'); t('demo.greeting', { name: 'name', defaultValue: 'fallback' });", 'fixture.js', { 'demo.greeting': '你好，{{name}}' });
  assert.deepEqual(invalid.map(issue => issue.message), ['Missing interpolation: name', 'Unknown resource key', 'Put fallback text in the default-language resource']);
  const markup = inspectMarkup('<button title="按钮提示">点击</button><script>console.log("日志")</script>', 'fixture.html');
  assert.deepEqual(markup.map(issue => issue.text), ['按钮提示', '点击']);
});
