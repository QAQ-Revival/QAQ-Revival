const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createCursorService } = require('../app/src/main/games/arknights/cursor.cjs');

function fixture(t) {
  const base = path.resolve(__dirname, '../test-results');
  fs.mkdirSync(base, { recursive: true });
  const root = fs.mkdtempSync(path.join(base, 'cursor-service-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const game = path.join(root, '游戏 folder'), gamePath = path.join(game, 'Arknights.exe'), stateRoot = path.join(root, 'backup');
  fs.mkdirSync(path.join(game, 'Arknights_Data'), { recursive: true }); fs.writeFileSync(gamePath, 'synthetic, never executed');
  let mode = 'game', running = false, configured = gamePath;
  const calls = [];
  const service = createCursorService({ getGamePath: () => configured, getStateRoot: () => stateRoot, resolveExecutable: () => path.join(root, 'cursor.exe'),
    execute(executable, args, options, callback) {
      assert.equal(options.windowsHide, true); assert.notEqual(options.shell, true);
      calls.push({ executable, args });
      assert.deepEqual(args.slice(1), ['--game-dir', path.dirname(configured), '--state-dir', stateRoot, '--json']);
      if (args[0] === 'enable') mode = 'system';
      if (args[0] === 'restore') mode = 'game';
      setTimeout(() => callback(null, JSON.stringify({ Success: true, ChangedFiles: args[0] === 'status' ? 0 : 1, Status: { GameDirectory: path.dirname(configured), Mode: mode, GameRunning: running, StateDirectory: path.join(stateRoot, 'installation'), Resources: [{}] } })), 5);
    }
  });
  return { service, calls, gamePath, configure(value) { if ('running' in value) running = value.running; if ('mode' in value) mode = value.mode; if ('gamePath' in value) configured = value.gamePath; } };
}

test('cursor adapter reads actual resource mode, coalesces scans, and delegates reversible enable/restore', async t => {
  const f = fixture(t);
  const [first, second] = await Promise.all([f.service.status(), f.service.status()]);
  assert.deepEqual(first, second); assert.equal(first.enabled, false); assert.equal(f.calls.length, 1);
  const enabled = await f.service.setEnabled({ enabled: true, gamePath: f.gamePath });
  assert.equal(enabled.enabled, true); assert.equal(enabled.mode, 'system');
  const restored = await f.service.setEnabled({ enabled: false, gamePath: f.gamePath });
  assert.equal(restored.enabled, false); assert.equal(restored.mode, 'game');
  assert.deepEqual(f.calls.filter(call => call.args[0] !== 'status').map(call => call.args[0]), ['enable', 'restore']);
  assert.equal(fs.readFileSync(f.gamePath, 'utf8'), 'synthetic, never executed');
});

test('cursor changes reject a running game, unsupported resources, stale paths and non-boolean values', async t => {
  const f = fixture(t); f.configure({ running: true });
  await assert.rejects(f.service.setEnabled({ enabled: true, gamePath: f.gamePath }), /退出|Close/);
  f.configure({ running: false, mode: 'unsupported' });
  await assert.rejects(f.service.setEnabled({ enabled: true, gamePath: f.gamePath }), /资源|resource/);
  await assert.rejects(f.service.setEnabled({ enabled: true, gamePath: path.join(path.dirname(f.gamePath), 'other/Arknights.exe') }), /变化|changed/);
  await assert.rejects(f.service.setEnabled({ enabled: 'true', gamePath: f.gamePath }), /路径|path/);
  assert.equal(f.calls.some(call => call.args[0] !== 'status'), false);
});
