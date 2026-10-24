'use strict';

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const { spawn } = require('node:child_process');
const { mainDir } = require('../runtime/paths.cjs');

function createNativeTray({ app, icon, showLabel, quitLabel, onShow, onQuit, onFallback, onReady = () => {}, onError = () => {},
  executable = path.join(mainDir, '../../resources/tray-host/QaqrTrayHost.exe'), launch = spawn }) {
  if (process.platform !== 'win32' || !app.isPackaged || !fs.existsSync(executable)) return false;
  let child, lines, timer, stopped = false;
  function stop() {
    if (stopped) return;
    stopped = true;
    clearTimeout(timer);
    app.removeListener('will-quit', stop);
    lines?.close();
    child?.stdin.end();
  }
  function fail(error) {
    if (stopped) return;
    stop();
    child?.kill();
    onError(error);
    onFallback();
  }
  try {
    child = launch(executable, [], { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });
    child.on('error', fail);
    child.on('exit', () => fail(Error('Tray host exited unexpectedly')));
    child.stdin.on('error', fail);
    lines = readline.createInterface({ input: child.stdout });
    lines.on('line', line => {
      if (stopped) return;
      try {
        const message = JSON.parse(line);
        if (message.type === 'ready') { clearTimeout(timer); onReady(); }
        else if (message.type === 'show') onShow();
        else if (message.type === 'quit') onQuit();
        else fail(Error('Tray host could not create its icon'));
      } catch (error) { fail(error); }
    });
    timer = setTimeout(() => fail(Error('Tray host startup timed out')), 5000);
    timer.unref();
    app.once('will-quit', stop);
    child.stdin.write(JSON.stringify({ icon, show: showLabel, quit: quitLabel }) + '\n', 'utf8');
    return true;
  } catch (error) {
    stop();
    child?.kill();
    onError(error);
    return false;
  }
}

module.exports = { createNativeTray };
