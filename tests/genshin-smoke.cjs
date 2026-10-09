const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

module.exports = async ({ electron, evaluate, waitFor, captureUI, window, root, profile, handlers, passed, launchRequests, setSelection }) => {
  const gameId = 'genshin-impact';
  const call = (channel, ...args) => handlers.get(channel)({ sender: window.webContents }, ...args);
  const write = (file, content) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); };
  const pe = Buffer.alloc(1024); pe.write('MZ'); pe.writeUInt32LE(128, 60); pe.write('PE\0\0', 128); pe.writeUInt16LE(0x8664, 132); pe.writeUInt16LE(1, 134); pe.writeUInt16LE(240, 148); pe.writeUInt16LE(0x20b, 152); pe.write('.text', 392); pe.writeUInt32LE(512, 408); pe.writeUInt32LE(512, 412);
  const xxmi = path.join(root, 'shared-XXMI');
  const launcher = path.join(xxmi, 'Resources/Bin/XXMI Launcher.exe');
  const importer = path.join(xxmi, 'custom-GIMI'), mods = path.join(importer, 'Mods');
  const gameFolder = path.join(root, '原神 Game');
  const game = path.join(gameFolder, 'YuanShen.exe');
  write(launcher, 'Synthetic launcher, never executed'); write(game, pe);
  write(path.join(gameFolder, 'YuanShen_Data', 'app.info'), 'fixture-data');
  write(path.join(importer, 'd3dx.ini'), '[Loader]\n');
  const ini = '[Constants]\nglobal persist $outfit = 0\n[KeyOutfit]\nkey = VK_UP\ntype = cycle\n$outfit = 0,1\n[TextureOverrideFixture]\nhash = 12345678\n';
  write(path.join(mods, 'Ayaka', 'Original', 'mod.ini'), ini);
  const xxmiConfig = { Launcher: { enabled_importers: ['WWMI', 'GIMI'] }, Importers: {
    GIMI: { Importer: { importer_folder: 'custom-GIMI', game_folder: gameFolder.replace(/\\/g, '/') }, Migoto: { keep: true } },
    WWMI: { Importer: { importer_folder: 'WWMI' } } } };
  write(path.join(xxmi, 'XXMI Launcher Config.json'), JSON.stringify(xxmiConfig));
  const configuredBefore = (await call('game:list')).games;
  assert.equal(configuredBefore.filter(item => item.id === gameId).length, 1);
  assert.deepEqual(configuredBefore.find(item => item.id === gameId).supportedLaunchModes, ['GIMI', 'XXMI']);
  await call('game:update', { gameId: 'wuthering-waves', updates: { modLoaderPath: launcher } });
  const detected = await call('auto-detect-paths', gameId);
  assert.equal(detected.success, true, detected.error);
  const settings = await call('game:get-settings', gameId);
  assert.equal(settings.game.gamePath, game); assert.equal(settings.game.modLoaderPath, launcher);
  assert.equal(settings.game.modFolderPath, mods); assert.equal(settings.xxmiImporterInfo.importerPath, importer);
  assert.equal((await call('game:list')).activeGameId, 'wuthering-waves');
  assert.equal(fs.existsSync(path.join(mods, '神里绫华')), false, 'Existing English alias folder is reused');
  assert.equal((await call('autoinstall:detect-game-path', gameId)).gamePath, game);
  passed('Existing profiles gain Genshin; shared XXMI detects CN executable, custom GIMI and Mods without switching games or duplicating alias folders');

  await evaluate(`document.querySelector('.game-selector-trigger').click()`);
  await waitFor(`!!document.querySelector('.game-selector-option[data-sort-id="genshin-impact"]')`, 'Genshin menu entry');
  await evaluate(`document.querySelector('.game-selector-option[data-sort-id="genshin-impact"]').click()`);
  await waitFor(`document.querySelector('.game-selector-trigger')?.textContent.includes('原神') && !!document.querySelector('.character-card[aria-label^="神里绫华，"]')`, 'Genshin characters');
  const characters = (await call('get-characters')).characters;
  for (const name of ['空', '荧', '神里绫华', '雷电将军', '武器', '滑翔翼']) assert.ok(characters.some(item => item.name === name), name);
  await captureUI('genshin-characters.png');
  for (const [label, args] of [['直接启动', ['--nogui', '--xxmi', 'GIMI']], ['XXMI 启动', []]]) {
    const before = launchRequests.length;
    await evaluate(`document.querySelector('[aria-label="${label}"]').click()`);
    await waitFor(`!document.querySelector('[aria-label="${label}"]').disabled`, label);
    assert.equal(launchRequests.length, before + 1);
    assert.match(path.basename(launchRequests.at(-1).file), /^r[a-f0-9]{24}\.exe$/);
    assert.equal(path.dirname(launchRequests.at(-1).file), path.dirname(launcher));
    assert.ok(fs.readFileSync(launchRequests.at(-1).file).equals(fs.readFileSync(launcher)));
    assert.deepEqual(launchRequests.at(-1).args, args);
  }
  assert.match((await call('launch-game', { gameId, launchMode: 'WWMI' })).error, /不支持/);
  // The random-launcher session from the launch above rewrites XXMI state; clean it so later
  // configuration assertions see the fixture as written.
  const cleanedSession = await call('genshin:anticrash-cleanup');
  assert.equal(cleanedSession.cleaned, true, cleanedSession.notes?.join('；'));
  const otherClient = path.join(gameFolder, 'GenshinImpact.exe'); fs.renameSync(game, otherClient);
  assert.equal((await call('auto-detect-paths', gameId)).success, true);
  assert.equal((await call('game:get-settings', gameId)).game.gamePath, otherClient);
  passed('Real sidebar and both launch buttons use GIMI; wrong importer is rejected; both CN and international executables are detected');

  const original = await call('get-mods', '神里绫华');
  assert.ok(original.mods.some(mod => mod.name === 'Original'));
  const official = original.sections.find(section => section.name === '花时来信');
  assert.ok(official?.official); assert.match(official.coverUrl, /^qaq-character-cover:/);
  const source = path.join(root, 'SpringOutfit'); write(path.join(source, 'mod.ini'), ini);
  const imported = await call('add-mod', { characterName: '神里绫华', filePath: source });
  assert.equal(imported.success, true, JSON.stringify(imported));
  let list = await call('get-mods', '神里绫华');
  const importedMod = list.mods.find(mod => mod.name !== 'Original'); assert.ok(importedMod);
  assert.equal((await call('character-section:assign-mod', { characterName: '神里绫华', modName: importedMod.name, sectionId: official.sectionId })).success, true);
  const details = await call('get-mod-details', { characterName: '神里绫华', modName: 'Original', refresh: true });
  assert.ok(JSON.stringify(details).includes('VK_UP'), 'GIMI hotkey is parsed');
  assert.ok(JSON.parse(fs.readFileSync(path.join(profile, 'hotkeys.json')))['genshin-impact/神里绫华/Original']);
  assert.equal(fs.existsSync(path.join(mods, '神里绫华')), false, 'Imports continue using the existing English directory');
  assert.equal((await call('toggle-mod', { characterName: '神里绫华', modName: 'Original', enable: false })).success, true);
  const preset = await call('preset:create', { name: '原神测试预设', mods: [{ characterName: '神里绫华', modName: 'Original', enabled: true }] });
  assert.equal(preset.success, true);
  assert.equal((await call('preset:activate', preset.preset.id)).success, true);
  assert.ok((await call('get-mods', '神里绫华')).mods.find(mod => mod.name === 'Original').enabled);
  assert.ok((await call('overlay-get-characters')).characters.some(item => item.name === '神里绫华'));
  assert.equal((await call('character:set-hidden', { gameId, characterName: '神里绫华', hidden: true })).success, true);
  assert.ok(!(await call('overlay-get-characters')).characters.some(item => item.name === '神里绫华'));
  assert.equal((await call('character:set-hidden', { gameId, characterName: '神里绫华', hidden: false })).success, true);
  passed('GIMI Mods import into existing aliases; official outfit assignments, hotkeys, toggles, presets, hide/restore and overlay use the Genshin scope');

  const fixture = (name, en, id) => ({ name, id, images: { filename_icon: 'UI_AvatarIcon_Ayaka' } });
  const online = ['空', '荧', '神里绫华', '雷电将军', '在线原神角色'].map((name, i) => fixture(name, '', [10000005, 10000007, 10000002, 10000052, 10000800][i]));
  const skin = { id: 200201, characterId: 10000002, characterName: '神里绫华', name: '花时来信', isDefault: false, images: { filename_splash: 'UI_Costume_AyakaCostumeFruhling' } };
  const originalFetch = electron.net.fetch; let offline = false;
  electron.net.fetch = (address, options) => {
    const url = new URL(address);
    if (url.hostname !== 'genshin-db-api.vercel.app') return originalFetch(address, options);
    if (offline) return Promise.reject(Error('Synthetic offline'));
    return Promise.resolve(new Response(JSON.stringify(url.pathname.endsWith('/characters') ? online : [skin])));
  };
  assert.equal((await call('character:update-catalog', gameId)).skins.success, true);
  assert.ok((await call('get-characters')).characters.some(item => item.name === '在线原神角色'));
  offline = true;
  assert.equal((await call('character:update-catalog', gameId)).success, false);
  assert.equal((await call('get-mods', '神里绫华')).mods.find(mod => mod.name === importedMod.name).appearanceSectionId, official.sectionId);
  electron.net.fetch = originalFetch;
  const update = path.join(root, 'GIMI-PACKAGE-update');
  write(path.join(update, 'Core/GIMI/main.ini'), 'new GIMI core');
  write(path.join(update, 'Mods/Ayaka/Original/mod.ini'), 'must not overwrite');
  assert.equal((await call('autoinstall:update-game-package', { packageDir: importer, updateSourcePath: update })).success, true);
  assert.equal(fs.readFileSync(path.join(importer, 'Core/GIMI/main.ini'), 'utf8'), 'new GIMI core');
  const actualMod = (await call('get-mods', '神里绫华')).mods.find(mod => mod.name === 'Original');
  assert.equal(fs.readFileSync(path.join(mods, 'Ayaka', (actualMod.enabled ? '' : 'DISABLED_') + 'Original/mod.ini'), 'utf8'), ini);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(xxmi, 'XXMI Launcher Config.json'))), xxmiConfig);
  passed('Online role/outfit updates and offline recovery keep assigned Mods; GIMI component update preserves Mods and existing XXMI configuration');

  const scan = await call('batch:scan-paths', { paths: [update] });
  assert.ok(JSON.stringify(scan).includes('game-package-update') && JSON.stringify(scan).includes('GIMI'));
  await call('game:switch', 'wuthering-waves');
  const managed = await call('managed-package:install', { sourcePath: update, gameId: 'wuthering-waves', installContentType: 'game-package-update' });
  assert.equal(managed.success, true, managed.error);
  assert.equal(managed.targetGameId, gameId, 'GIMI package name routes to Genshin even while another game is active');
  const { createRequire } = require('node:module');
  const runtimeRequire = createRequire(path.join(process.resourcesPath, 'app/package.json'));
  const zip = new (runtimeRequire('adm-zip'))(); zip.addFile('Core/GIMI/main.ini', Buffer.from('GIMI fixture'));
  const bundle = path.join(process.resourcesPath, 'autoinstall', 'GIMI-PACKAGE-v9.9.9.zip');
  write(bundle, zip.toBuffer());
  try {
    const packages = await call('autoinstall:get-bundled-packages');
    assert.ok(packages.packages.some(item => item.importer === 'GIMI' || item.importerName === 'GIMI' || item.file === path.basename(bundle)));
    const installed = await call('autoinstall:install-game-package', { importerName: 'GIMI', targetDir: path.join(root, 'new-component') });
    assert.equal(installed.success, true, installed.error);
    assert.ok(fs.existsSync(path.join(installed.packageDir, 'Core/GIMI/main.ini')));
  } finally { fs.unlinkSync(bundle); }
  await call('game:switch', gameId);
  const fixer = path.join(root, 'GenshinFixer.exe'); write(fixer, 'Synthetic fixer, never executed');
  setSelection({ canceled: false, filePaths: [fixer] });
  assert.equal((await call('fix:run-all', { gameId })).success, true);
  assert.equal(launchRequests.at(-1).file, fixer);
  for (const source of ['pawchive', 'kemono']) {
    const download = await call('attachment:download', { source, post: { service: 'patreon', user: '123', id: '1000' }, filePath: '/smoke/mod.zip' });
    assert.equal(download.success, true, download.error);
    const taskId = download.task.taskId;
    await waitFor(`window.api.attachmentTasks().then(result => result.tasks.some(task => task.taskId === ${JSON.stringify(taskId)} && task.status === 'completed'))`, source + ' download');
    const downloaded = await call('attachment:importPaths', { taskId });
    const added = await call('add-mod', { characterName: '胡桃', filePath: downloaded.paths[0], modInfo: { name: source + ' Mod' } });
    assert.equal(added.success, true, added.error);
  }
  assert.equal((await call('get-mods', '胡桃')).mods.length, 2);
  passed('Official GIMI package names install and route correctly; a scoped independent fixer opens; both archive download sources import ZIP Mods into Genshin');

  await call('game:switch', 'wuthering-waves');
  assert.ok(!(await call('preset:list')).presets.some(item => item.id === preset.preset.id));
  assert.deepEqual((await call('character:list-hidden', 'wuthering-waves')).characters, []);
  assert.ok(!(await call('get-characters')).characters.some(item => item.name === '神里绫华'));
  await call('game:switch', gameId);
  await window.loadFile(path.join(process.resourcesPath, 'app/out/renderer/index.html'));
  await waitFor(`document.querySelector('.game-selector-trigger')?.textContent.includes('原神')`, 'reload preserves Genshin selection');
  assert.ok((await call('preset:list')).presets.some(item => item.id === preset.preset.id));
  assert.equal(JSON.parse(fs.readFileSync(path.join(profile, 'config.json'))).activeGameId, gameId);
  passed('Game switching isolates character/hidden/preset data and reload retains the saved Genshin configuration');
};
