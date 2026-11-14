const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

// The real settings page and IPC against a synthetic MI folder. Nothing here is ever launched.
module.exports = async ({ handlers, root, evaluate, waitFor, captureUI, passed }) => {
  const call = (name, ...args) => handlers.get(name)({}, ...args);
  const xxmi = path.join(root, 'vulkan-XXMI'), efmi = path.join(xxmi, 'EFMI'), loader = path.join(xxmi, 'Resources/Bin/XXMI Launcher.exe');
  const write = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, value); return file; };
  const official = Buffer.from('Synthetic official runtime, never executed');
  write(loader, fs.readFileSync(process.execPath));
  write(path.join(efmi, 'd3dx.ini'), '[Constants]\n');
  write(path.join(efmi, 'd3d11.dll'), official);
  write(path.join(efmi, 'Mods/kept.ini'), 'keep mod');
  write(path.join(xxmi, 'Resources/Packages/XXMI/d3d11.dll'), official);
  write(path.join(xxmi, 'Resources/Packages/XXMI/Manifest.json'), JSON.stringify({ version: '1.2.2' }));
  const gamePath = write(path.join(root, 'vulkan-game/Endfield.exe'), 'Synthetic game, never executed');
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'secp384r1' });
  write(path.join(xxmi, 'Resources/Security/public_key.der'), publicKey.export({ type: 'spki', format: 'der' }).toString('base64'));
  const signature = crypto.sign('sha256', Buffer.from(os.userInfo().username), privateKey).toString('base64');
  const configFile = write(path.join(xxmi, 'XXMI Launcher Config.json'), JSON.stringify({
    Launcher: { customPreference: 'keep' },
    Importers: { EFMI: { Importer: { importer_folder: efmi, game_folder: path.dirname(gamePath), d3d11_mode_cmd_args: '-force-d3d11' }, Migoto: { unsafe_mode: true, unsafe_mode_signature: signature } } }
  }));
  const argument = () => JSON.parse(fs.readFileSync(configFile, 'utf8')).Importers.EFMI.Importer.d3d11_mode_cmd_args;
  const bundle = path.join(root, 'vulkan-release-fixture/1.2.2-nhd.27');
  const forkDir = path.join(path.dirname(process.execPath), 'local-components/xxmi-runtime-vulkan');
  assert.equal((await call('game:update', { gameId: 'endfield', updates: { modLoaderPath: loader, modFolderPath: path.join(efmi, 'Mods'), gamePath } })).success, true);
  await call('game:switch', 'endfield');
  await evaluate(`window.dispatchEvent(new CustomEvent('qaqm-navigate', { detail: { tab: 'characters' } }))`);
  const page = async id => { await waitFor(`!!document.querySelector('[data-section="${id}"]')`, 'settings page link ' + id); await evaluate(`document.querySelector('[data-section="${id}"]').click()`); await waitFor(`!!document.querySelector('.settings-page[data-page="${id}"]:not([hidden])')`, 'settings page ' + id); };
  await evaluate(`document.querySelector('.game-settings-button').click()`);
  await page('efmi-vulkan');
  const toggle = `document.querySelector('[aria-label="终末地 Vulkan Mod"]')`;
  await waitFor(`!!${toggle} && !${toggle}.disabled`, 'the Vulkan section reads its state');
  assert.equal(await evaluate(`${toggle}.checked`), false);
  assert.equal((await call('efmi:vulkan-status')).enabled, false);
  assert.deepEqual(fs.readFileSync(path.join(efmi, 'd3d11.dll')), official, 'opening settings never installs');
  assert.ok(await evaluate(`!!document.querySelector('.settings-category[data-section="efmi-vulkan"]')`));

  const moveTo = `(() => { const pane = document.querySelector('.game-settings-view .system-settings-pane'), section = document.querySelector('#settings-efmi-vulkan'); pane.style.scrollBehavior = 'auto'; pane.scrollTop += section.getBoundingClientRect().top - pane.getBoundingClientRect().top; })()`;
  await evaluate(moveTo);
  await captureUI('efmi-vulkan-off.png');

  await evaluate(`${toggle}.click()`);
  await waitFor(`${toggle}.checked && !${toggle}.disabled`, 'Vulkan turns on');
  assert.deepEqual(fs.readFileSync(path.join(efmi, 'd3d11.dll')), fs.readFileSync(path.join(forkDir, 'd3d11.dll')));
  assert.equal(argument(), '');
  for (const name of ['dxcompiler.dll', 'dxil.dll', 'SPIRV-Tools-shared.dll']) if (fs.existsSync(path.join(forkDir, name))) assert.deepEqual(fs.readFileSync(path.join(efmi, name)), fs.readFileSync(path.join(forkDir, name)));
  assert.equal(JSON.parse(fs.readFileSync(configFile, 'utf8')).Launcher.customPreference, 'keep');
  assert.equal(fs.readFileSync(path.join(efmi, 'Mods/kept.ini'), 'utf8'), 'keep mod');
  const variant = channel => `document.querySelector('[data-vulkan-component="runtime"] [data-channel="${channel}"]')`;
  const useButton = channel => `document.querySelector('[data-vulkan-component="runtime"] [data-channel="${channel}"] [data-action="use"]')`;
  await waitFor(`${variant('fork')}?.classList.contains('is-active') && !!${useButton('official')} && !${useButton('official')}.disabled`, 'the QAQR build is the default channel');
  await page('game-updates');
  await waitFor(`document.querySelector('#settings-mi-forks [data-component="runtime"] [data-channel="vulkan"]')?.classList.contains('is-active') && document.querySelector('#settings-mi-forks').textContent.includes('Vulkan 运行库')`, 'the DX11 switch names the Vulkan runtime and steps aside');
  await page('efmi-vulkan');
  await evaluate(moveTo);
  await captureUI('efmi-vulkan-on.png');

  const forkDll = path.join(path.dirname(process.execPath), 'local-components/xxmi-runtime-vulkan/d3d11.dll');
  await evaluate(`${useButton('official')}.click()`);
  await waitFor(`${variant('official')}.classList.contains('is-active')`, 'an explicit upstream choice remains available');
  assert.deepEqual(fs.readFileSync(path.join(efmi, 'd3d11.dll')), fs.readFileSync(path.join(bundle, 'd3d11.dll')));
  await evaluate(`${useButton('fork')}.click()`);
  await waitFor(`${variant('fork')}.classList.contains('is-active')`, 'the QAQR build becomes active');
  assert.deepEqual(fs.readFileSync(path.join(efmi, 'd3d11.dll')), fs.readFileSync(forkDll));
  assert.equal((await call('efmi:vulkan-status')).channel, 'fork');
  assert.equal(argument(), '');

  await evaluate(`${toggle}.click()`);
  await waitFor(`!${toggle}.checked && !${toggle}.disabled`, 'Vulkan turns off');
  assert.equal(argument(), '-force-d3d11');
  for (const name of ['dxcompiler.dll', 'dxil.dll', 'SPIRV-Tools-shared.dll']) assert.equal(fs.existsSync(path.join(efmi, name)), false, name);
  const onDisk = fs.readFileSync(path.join(efmi, 'd3d11.dll'));
  assert.ok(onDisk.equals(official) || onDisk.equals(fs.readFileSync(path.join(path.dirname(process.execPath), 'local-components/xxmi-runtime/d3d11.dll'))));
  assert.equal(onDisk.includes(Buffer.from('extended_rendering', 'utf16le')), false, 'the DX11 build is back');
  passed('Endfield switches between DX11 and Vulkan and between both Vulkan builds, moving the Launcher argument with the DLL and leaving Mods and preferences alone');
};
