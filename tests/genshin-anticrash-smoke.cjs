const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { TWIN_EXE } = require('../app/out/main/genshin-anticrash.cjs');

module.exports = async ({ electron, evaluate, waitFor, captureUI, window, root, handlers, launchRequests, antiCrashRequests, passed, setLaunchFailure }) => {
  const call = (channel, ...args) => handlers.get(channel)({ sender: window.webContents }, ...args);
  const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const textButton = text => evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(text)}).click()`);
  const selectInjectMode = value => evaluate(`(() => {
    const select = document.querySelector('[aria-label="原神注入方式"]');
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, ${JSON.stringify(value)});
    select.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  const pe = Buffer.alloc(1024); pe.write('MZ'); pe.writeUInt32LE(128, 60); pe.write('PE\0\0', 128); pe.writeUInt16LE(0x8664, 132); pe.writeUInt16LE(1, 134); pe.writeUInt16LE(240, 148); pe.writeUInt16LE(0x20b, 152); pe.write('.text', 392); pe.writeUInt32LE(512, 408); pe.writeUInt32LE(512, 412);
  const write = (relative, value) => { const file = path.join(root, relative); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, value); return file; };
  const gameExe = write('GI/YuanShen.exe', pe), loader = write('GI-XXMI/Resources/Bin/XXMI Launcher.exe', pe), mods = path.join(root, 'GI-GIMI/Mods');
  fs.mkdirSync(mods, { recursive: true }); write('GI-GIMI/d3d11.dll', pe); write('GI-GIMI/d3dx.ini', '[Loader]\n'); write('GI-GIMI/Core/GIMI/main.ini', '; GIMI fixture');
  write('GI/YuanShen_Data/app.info', 'fixture-data');
  const gameDir = path.dirname(gameExe);
  const config = write('GI-XXMI/XXMI Launcher Config.json', JSON.stringify({
    Launcher: { keep: true },
    Importers: { GIMI: { Importer: { importer_folder: '../GI-GIMI', game_folder: gameDir.split(path.sep).join('/'), launch_options: '' } }, WWMI: { Importer: { untouched: true } } }
  }, null, 4) + '\n');
  const original = fs.readFileSync(config);
  const twins = () => fs.readdirSync(gameDir).filter(name => TWIN_EXE.test(name));
  const twinDataDirs = () => fs.readdirSync(gameDir).filter(name => /^[a-z][a-f0-9]{16}_Data$/.test(name));
  const xxmiConfig = () => JSON.parse(fs.readFileSync(config, 'utf8'));
  const adds = () => antiCrashRequests.filter(args => args.includes('add'));
  const deletes = () => antiCrashRequests.filter(args => args.includes('delete'));

  await call('game:update', { gameId: 'genshin-impact', updates: { gamePath: gameExe, modLoaderPath: loader, modFolderPath: mods } });
  await call('game:switch', 'genshin-impact');
  await waitFor(`document.querySelector('.game-selector-trigger')?.textContent.includes('原神')`, 'Genshin selected');
  await click('[aria-label="游戏设置"]');
  await waitFor(`!!document.querySelector('#settings-genshin-anticrash')`, 'anti-error section visible');
  assert.equal(await evaluate(`document.querySelector('[aria-label="原神双生启动"]').checked`), false);
  assert.equal(await evaluate(`document.querySelector('[aria-label="原神不启用主方案"]').checked`), true);
  assert.equal(await evaluate(`document.querySelector('.anticrash-advanced').open`), false, 'troubleshooting is collapsed by default');
  const bundledDll = path.join(path.dirname(process.execPath), 'local-components', 'd3d11-nocheck.dll');
  const defaultReport = await call('genshin:get-anticrash');
  assert.equal(defaultReport.customDllPath, fs.existsSync(bundledDll) ? bundledDll : '');
  assert.equal(defaultReport.customDllPathIsDefault, fs.existsSync(bundledDll));

  const primaryTopBeforeSave = await evaluate(`document.querySelector('.anticrash-primary').getBoundingClientRect().top`);
  await click('[aria-label="原神双生启动"]');
  await waitFor(`document.querySelector('[aria-label="原神双生启动"]').checked`, 'twin enabled');
  assert.match(await evaluate(`document.querySelector('#heading-genshin-anticrash [role="status"]').textContent`), /已保存/);
  assert.equal(await evaluate(`document.querySelector('#settings-genshin-anticrash > .system-card > [role="status"]')`), null, 'saving does not add a banner inside the card');
  assert.ok(Math.abs(await evaluate(`document.querySelector('.anticrash-primary').getBoundingClientRect().top`) - primaryTopBeforeSave) < 1, 'save feedback does not move the controls');
  const stored = (await call('get-config')).config.games.find(g => g.id === 'genshin-impact').genshinAntiError;
  assert.equal(stored.twin, true);
  assert.equal(stored.customDll, false);
  assert.equal(stored.customDllPath, '');

  await click('[aria-label="直接启动"]');
  await waitFor(`document.querySelectorAll('.anticrash-session').length === 1`, 'session card shown');
  const twinName = xxmiConfig().Importers.GIMI.Importer.process_exe_names?.[0];
  assert.match(twinName, TWIN_EXE);
  assert.ok(fs.existsSync(path.join(gameDir, twinName)));
  assert.equal(fs.readFileSync(path.join(gameDir, path.basename(twinName, '.exe') + '_Data', 'app.info'), 'utf8'), 'fixture-data', 'twin data junction resolves to the original data folder');
  assert.deepEqual(launchRequests.at(-1).args, ['--nogui', '--xxmi', 'GIMI']);
  assert.match(path.basename(launchRequests.at(-1).file), /^r[a-f0-9]{24}\.exe$/);
  assert.equal(xxmiConfig().Importers.GIMI.Importer.d3dx_ini.core.Loader.loader, path.basename(launchRequests.at(-1).file), 'Hook uses the actual random XXMI name');
  assert.equal(adds().length, 0);
  passed('Twin launch creates a random in-directory copy, redirects XXMI to it and reports the live session');

  await click('.anticrash-advanced summary');
  await waitFor(`document.querySelector('.anticrash-advanced').open`, 'troubleshooting expanded');
  await click('[aria-label="原神等待手动启动"]');
  await waitFor(`document.querySelector('[aria-label="原神等待手动启动"]').checked`, 'manual start enabled');
  await click('[aria-label="原神网络屏蔽"]');
  await waitFor(`document.querySelector('[aria-label="原神网络屏蔽"]').checked`, 'network block enabled');
  await selectInjectMode('direct');
  await waitFor(`document.querySelector('[aria-label="原神注入方式"]').value === 'direct' && !document.querySelector('[aria-label="原神注入方式"]').disabled`, 'direct injection chosen');
  assert.ok((await evaluate(`document.querySelector('.anticrash-session').textContent`)).includes('跟随 XXMI'), 'saving the next launch preference does not relabel the running session');
  await click('[aria-label="直接启动"]');
  await waitFor(`!!document.querySelector('.launch-notice') && document.querySelector('.launch-notice').textContent.includes('等待你手动启动游戏')`, 'manual start notice shown');
  const appliedNow = xxmiConfig().Importers.GIMI.Importer;
  assert.equal(appliedNow.game_launch, 'MANUAL');
  assert.equal(appliedNow.xxmi_dll_inject_mode, 'DIRECT');
  assert.equal((await call('genshin:get-anticrash')).session.injectMode, 'direct');
  assert.equal(adds().length, 2, 'firewall covers twin and original executable');
  assert.ok(adds().every(args => args.some(a => /^name=Block /.test(a))));
  assert.ok(adds().every(args => args.filter(a => a.startsWith('name=')).every(a => !/qaq|revival/i.test(a))), 'rule names carry no product identity');
  passed('Manual start, direct injection and network blocking rewrite XXMI fields with identity-free firewall rules');

  await textButton('立即清理');
  await waitFor(`document.querySelectorAll('.anticrash-session').length === 0`, 'session cleared');
  assert.ok(fs.readFileSync(config).equals(original), 'cleanup restores the exact original XXMI config');
  assert.deepEqual(twins(), [], 'twin copies removed');
  assert.deepEqual(twinDataDirs(), [], 'twin data junctions removed');
  assert.equal(fs.readFileSync(path.join(gameDir, 'YuanShen_Data', 'app.info'), 'utf8'), 'fixture-data', 'original data folder intact');
  assert.equal(deletes().length, adds().length, 'every firewall rule removed');
  passed('Manual cleanup restores config bytes, removes twins and firewall rules');

  await click('[aria-label="直接启动"]');
  await waitFor(`!!document.querySelector('.anticrash-session')`, 'new session after cleanup');
  assert.equal(await evaluate(`document.querySelector('.anticrash-feedback')?.textContent.includes('已清理') || false`), false, 'new sessions discard the previous cleanup result');
  await textButton('立即清理');
  await waitFor(`!document.querySelector('.anticrash-session')`, 'restarted session cleaned');

  const importerDir = path.dirname(mods);
  const originalDll = path.join(importerDir, 'original_d3d11.dll');
  const systemDll = fs.readFileSync(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'd3d11.dll'));
  await click('[aria-label="原神本地原版组件"]');
  await waitFor(`document.querySelector('[aria-label="原神本地原版组件"]').checked`, 'original dll enabled');
  await click('[aria-label="直接启动"]');
  await waitFor(`document.querySelector('.anticrash-session')?.textContent.includes('original_d3d11.dll')`, 'session reports deployed runtime copy');
  assert.ok(fs.existsSync(originalDll), 'runtime copy deployed into GIMI folder');
  assert.ok(fs.readFileSync(originalDll).equals(systemDll), 'deployed copy matches the system runtime');
  await textButton('立即清理');
  await waitFor(`document.querySelectorAll('.anticrash-session').length === 0`, 'session cleared again');
  assert.equal(fs.existsSync(originalDll), false, 'runtime copy removed with the session');
  passed('Original-runtime deployment recreates GIML twin-style loading from the system file and cleans up');

  const importerDll = path.join(importerDir, 'd3d11.dll');
  const originalDllBytes = fs.readFileSync(importerDll);
  const customDllBytes = Buffer.concat([pe, Buffer.from('-mantle-custom-')]);
  const customDllFile = write('custom-mantle/d3d11.dll', customDllBytes);
  assert.equal((await call('genshin:update-anticrash', { customDllPath: 'not-a-path.txt' })).success, false, 'relative non-dll paths rejected');
  await call('genshin:update-anticrash', { customDllPath: customDllFile });
  await waitFor(`!document.querySelector('[aria-label="原神外部定制组件"]').disabled`, 'custom dll switch unlocked after path saved');
  await selectInjectMode('hook');
  await waitFor(`document.querySelector('[aria-label="原神注入方式"]').value === 'hook' && !document.querySelector('[aria-label="原神注入方式"]').disabled`, 'hook preference saved');
  await click('[aria-label="原神外部定制组件"]');
  await waitFor(`document.querySelector('[aria-label="原神外部定制组件"]').checked`, 'mantle enabled');
  assert.equal(await evaluate(`document.querySelector('[aria-label="原神双生启动"]').checked`), false, 'selecting custom automatically deselects twin');
  assert.deepEqual(await evaluate(`(() => { const el = document.querySelector('[aria-label="原神注入方式"]'); return [el.value, el.disabled]; })()`), ['direct', true]);
  assert.equal((await call('genshin:get-anticrash')).settings.injectMode, 'hook', 'forced Direct does not overwrite the saved preference');
  await click('[aria-label="原神双生启动"]');
  await waitFor(`document.querySelector('[aria-label="原神双生启动"]').checked && !document.querySelector('[aria-label="原神双生启动"]').disabled`, 'twin selected again');
  assert.equal(await evaluate(`document.querySelector('[aria-label="原神外部定制组件"]').checked`), false);
  assert.deepEqual(await evaluate(`(() => { const el = document.querySelector('[aria-label="原神注入方式"]'); return [el.value, el.disabled]; })()`), ['hook', false]);
  await click('[aria-label="原神外部定制组件"]');
  await waitFor(`document.querySelector('[aria-label="原神外部定制组件"]').checked && !document.querySelector('[aria-label="原神外部定制组件"]').disabled`, 'mantle selected again');
  const selectedSettings = (await call('get-config')).config.games.find(g => g.id === 'genshin-impact').genshinAntiError;
  assert.equal(selectedSettings.twin, false);
  assert.equal(selectedSettings.customDll, true);
  await click('[aria-label="直接启动"]');
  await waitFor(`document.querySelector('.anticrash-session')?.textContent.includes('外部定制组件生效中')`, 'session reports the mantle swap');
  assert.ok(fs.readFileSync(importerDll).equals(customDllBytes), 'importer component replaced with the local file');
  const mantleConfig = xxmiConfig().Importers.GIMI;
  assert.equal(mantleConfig.Importer.xxmi_dll_inject_mode, 'DIRECT', 'injection forced to Direct');
  assert.equal(mantleConfig.Migoto.unsafe_mode, true, 'XXMI signature enforcement paused');
  assert.equal((await call('genshin:get-anticrash')).session.injectMode, 'direct');
  await evaluate(`document.querySelector('#settings-genshin-anticrash').scrollIntoView({ block: 'start', behavior: 'instant' })`);
  await captureUI('genshin-anticrash-custom-session.png');
  await textButton('立即清理');
  await waitFor(`document.querySelectorAll('.anticrash-session').length === 0`, 'mantle session cleared');
  assert.ok(fs.readFileSync(importerDll).equals(originalDllBytes), 'importer component restored byte-exact');
  assert.ok(fs.readFileSync(config).equals(original), 'config restored byte-exact after mantle');
  setLaunchFailure(true);
  try {
    const failed = await call('launch-game', { launchMode: 'DIRECT', gameId: 'genshin-impact' });
    assert.equal(failed.success, false);
    assert.match(failed.error, /取消管理员授权/);
    assert.equal((await call('genshin:get-anticrash')).session, null);
    assert.ok(fs.readFileSync(config).equals(original));
    assert.ok(fs.readFileSync(importerDll).equals(originalDllBytes));
    assert.equal(fs.existsSync(originalDll), false);
    assert.equal(deletes().length, adds().length);
  } finally { setLaunchFailure(false); }
  passed('Failed XXMI launch rolls back the DLL, config and firewall session before returning');
  await click('[aria-label="原神不启用主方案"]');
  await waitFor(`!document.querySelector('[aria-label="原神外部定制组件"]').checked`, 'mantle disabled');
  await call('genshin:update-anticrash', { customDllPath: '' });
  assert.equal((await call('genshin:get-anticrash')).customDllPath, defaultReport.customDllPath, 'clearing a manual path restores the bundled default');
  passed('Mantle swap uses a machine-local custom component with unsafe-mode pause, Direct injection and exact restore');

  const disableIfChecked = label => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(`[aria-label="${label}"]`)}); if (el.checked) el.click(); })()`);
  await waitFor(`!document.querySelector('[aria-label="原神双生启动"]').checked`, 'twin disabled');
  await disableIfChecked('原神本地原版组件');
  await waitFor(`!document.querySelector('[aria-label="原神本地原版组件"]').checked`, 'original dll disabled');
  await disableIfChecked('原神等待手动启动');
  await waitFor(`!document.querySelector('[aria-label="原神等待手动启动"]').checked`, 'manual disabled');
  await disableIfChecked('原神网络屏蔽');
  await waitFor(`!document.querySelector('[aria-label="原神网络屏蔽"]').checked`, 'network disabled');
  await selectInjectMode('default');
  await waitFor(`document.querySelector('[aria-label="原神注入方式"]').value === 'default' && !document.querySelector('[aria-label="原神注入方式"]').disabled`, 'inject mode reset');
  await call('settings:update-random-launch', { xxmi: false });
  const netshCount = antiCrashRequests.length, launchCount = launchRequests.length;
  await click('[aria-label="直接启动"]');
  await waitFor(`!document.querySelector('[aria-label="直接启动"]').disabled`, 'launch completed after disabling');
  await waitFor(`!document.querySelector('.launch-error')`, 'launch without anti-error errors');
  assert.equal(launchRequests.length, launchCount + 1);
  assert.deepEqual(twins(), []);
  assert.equal(antiCrashRequests.length, netshCount, 'no firewall activity when disabled');
  assert.ok(fs.readFileSync(config).equals(original), 'disabled configuration leaves XXMI untouched');
  assert.deepEqual(launchRequests.at(-1).args, ['--nogui', '--xxmi', 'GIMI']);

  const invalid = await call('genshin:update-anticrash', { twin: 'yes' });
  assert.equal(invalid.success, false);
  await captureUI('genshin-anticrash.png');
  passed('Disabled anti-error launches pass through untouched; invalid payloads rejected');
  const originalSize = window.getSize();
  for (const width of [1440, 980]) {
    window.setSize(width, 1000);
    await waitFor(`Math.abs(window.innerWidth - ${width}) < 20`, 'layout resized');
    const layout = await evaluate(`(() => {
      const section = document.querySelector('#settings-genshin-anticrash');
      const switches = [...section.querySelectorAll('[role="switch"]')];
      const select = section.querySelector('[aria-label="原神注入方式"]');
      return { tag: select.tagName, height: select.getBoundingClientRect().height,
        primaryCount: section.querySelectorAll('input[type="radio"]').length,
        checkedPrimaryCount: section.querySelectorAll('input[type="radio"]:checked').length,
        overflow: section.scrollWidth > section.clientWidth,
        right: switches.map(el => el.getBoundingClientRect().right),
        besideCopy: switches.every(el => el.getBoundingClientRect().left > el.closest('.system-row').querySelector('.system-row-copy').getBoundingClientRect().right) };
    })()`);
    assert.equal(layout.tag, 'SELECT');
    assert.ok(layout.height <= 40, 'injection mode uses a compact dropdown');
    assert.equal(layout.right.length, 3);
    assert.equal(layout.primaryCount, 3, 'two exclusive plans plus an off option');
    assert.equal(layout.checkedPrimaryCount, 1);
    assert.equal(layout.overflow, false, 'grouped settings fit the available width');
    assert.ok(Math.max(...layout.right) - Math.min(...layout.right) < 2, 'all switches align on the right');
    assert.equal(layout.besideCopy, true, 'switches stay beside the text instead of wrapping below it');
    await evaluate(`document.querySelector('#settings-genshin-anticrash').scrollIntoView({ block: 'start', behavior: 'instant' })`);
    await waitFor(`Math.abs(document.querySelector('#settings-genshin-anticrash').getBoundingClientRect().top - document.querySelector('.system-settings-pane').getBoundingClientRect().top) < 40`, 'anti-error section scrolled into view');
    await captureUI('genshin-anticrash-layout-' + width + '.png');
    await click('.anticrash-advanced summary');
    await waitFor(`!document.querySelector('.anticrash-advanced').open`, 'troubleshooting collapsed');
    await captureUI('genshin-anticrash-compact-' + width + '.png');
    await click('.anticrash-advanced summary');
    await waitFor(`document.querySelector('.anticrash-advanced').open`, 'troubleshooting reopened');
  }
  window.setSize(...originalSize);
  passed('Exclusive plans, optional switches and collapsible troubleshooting fit wide and narrow layouts');

  await call('game:switch', 'wuthering-waves');
  await waitFor(`document.querySelector('.game-settings-view')?.dataset.gameId === 'wuthering-waves'`, 'other game scope');
  assert.equal(await evaluate(`!!document.querySelector('#settings-genshin-anticrash')`), false);
  assert.equal((await call('launch-game', { launchMode: 'DIRECT', gameId: 'wuthering-waves' })).success, true);
  assert.equal(antiCrashRequests.length, netshCount, 'other games never touch anti-error machinery');
  passed('Anti-error stays scoped to Genshin and leaves other games untouched');
};
