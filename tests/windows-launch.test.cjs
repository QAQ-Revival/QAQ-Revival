const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createWindowsLauncher, getDirectLaunchMode, quoteWindowsArgument, buildElevationScript } = require('../app/out/main/windows-launch.cjs');

test('direct launch selects the correct importer instead of the saved launcher UI mode', () => {
  for (const [id, expected] of Object.entries({ endfield: 'EFMI', 'wuthering-waves': 'WWMI', zzz: 'ZZMI', 'honkai-star-rail': 'SRMI' })) {
    assert.equal(getDirectLaunchMode({ id, launchMode: 'XXMI' }), expected);
    assert.equal(getDirectLaunchMode({ id, launchMode: null }), expected);
  }
  assert.equal(getDirectLaunchMode({ id: 'neverness-to-everness', launchMode: 'DX12' }), 'DX12');
  assert.equal(getDirectLaunchMode({ id: 'neverness-to-everness', launchMode: 'NEMI' }), 'NEMI');
  assert.equal(getDirectLaunchMode({ id: 'unknown' }), null);
});
test('elevated launch inherits the parent token without requesting RunAs again', async () => {
  let invocation, detached = false;
  const exe = 'D:\\Games & Tools\\XXMI Launcher.exe';
  const args = ['--nogui', '--xxmi', 'EFMI', 'with spaces', 'literal & %VALUE%'];
  const launcher = createWindowsLauncher({ platform: 'win32', isElevated: () => true,
    execFile: () => assert.fail('Unexpected RunAs'),
    spawn: (...received) => {
      invocation = received;
      const child = new EventEmitter(); child.pid = 123; child.unref = () => { detached = true; };
      queueMicrotask(() => child.emit('spawn'));
      return child;
    }
  });
  assert.deepEqual(await launcher.launch(exe, 'D:\\Games & Tools', args), { success: true, pid: 123 });
  assert.deepEqual(invocation.slice(0, 2), [exe, args]);
  assert.equal(invocation[2].shell, false);
  assert.equal(invocation[2].windowsHide, true);
  assert.equal(invocation[2].cwd, 'D:\\Games & Tools');
  assert.ok(detached);
});
test('non-elevated launch requests normal UAC once with quoted arguments', async () => {
  let calls = 0;
  const exe = "D:\\Tester's Tools\\XXMI Launcher.exe", cwd = "D:\\Tester's Tools";
  const args = ['--nogui', '--xxmi', 'WWMI', 'path with spaces\\', 'a"b'];
  const launcher = createWindowsLauncher({ platform: 'win32', isElevated: () => false,
    spawn: () => assert.fail('Unexpected non-elevated launch'),
    execFile: (file, params, options, callback) => {
      calls++;
      assert.ok(file.endsWith('powershell.exe'));
      assert.ok(options.windowsHide);
      const script = Buffer.from(params.at(-1), 'base64').toString('utf16le');
      assert.equal(script, buildElevationScript(exe, cwd, args));
      assert.ok(script.includes("Tester''s Tools"));
      assert.equal((script.match(/-Verb RunAs/g) || []).length, 1);
      callback(null, '', '');
    }
  });
  assert.equal((await launcher.launch(exe, cwd, args)).success, true);
  assert.equal(calls, 1);
  assert.equal(quoteWindowsArgument('a"b'), '"a\\"b"');
  assert.equal(quoteWindowsArgument('path\\'), '"path\\\\"');
});
test('UAC cancellation returns an error without retrying or false success', async () => {
  let calls = 0;
  const launcher = createWindowsLauncher({ platform: 'win32', isElevated: () => false,
    execFile: (_file, _args, _options, callback) => { calls++; callback(new Error('cancelled'), '', 'Operation cancelled by user'); }
  });
  const result = await launcher.launch('test.exe', 'D:\\test');
  assert.equal(result.success, false);
  assert.match(result.error, /cancelled/);
  assert.equal(calls, 1);
});
test('OS spawn failures propagate to the UI', async () => {
  const launcher = createWindowsLauncher({ platform: 'win32', isElevated: () => true,
    spawn: () => { const child = new EventEmitter(); queueMicrotask(() => child.emit('error', new Error('ENOENT'))); return child; }
  });
  assert.deepEqual(await launcher.launch('missing.exe', 'D:\\test'), { success: false, error: 'ENOENT' });
});
