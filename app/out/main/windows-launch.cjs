const childProcess = require('node:child_process');
const path = require('node:path');

// Windows command-line quoting, used only for ShellExecute's argument string.
// Native spawn receives an argument array and does not need manual quoting.
function quoteWindowsArgument(value) {
  return '"' + String(value).replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/, '$1$1') + '"';
}
function buildElevationScript(executablePath, workingDir, args) {
  const literal = value => "'" + String(value).replace(/'/g, "''") + "'";
  const argumentsOption = args.length ? ` -ArgumentList ${literal(args.map(quoteWindowsArgument).join(' '))}` : '';
  return `$ErrorActionPreference = 'Stop'; Start-Process -FilePath ${literal(executablePath)} -WorkingDirectory ${literal(workingDir)}${argumentsOption} -Verb RunAs -PassThru | Out-Null`;
}
function getDirectLaunchMode(game) {
  const importer = { 'genshin-impact': 'GIMI', endfield: 'EFMI', 'wuthering-waves': 'WWMI', zzz: 'ZZMI', 'honkai-star-rail': 'SRMI' }[game?.id];
  if (importer) return importer;
  if (game?.id === 'neverness-to-everness') return game.launchMode === 'DX12' ? 'DX12' : 'NEMI';
  return null;
}
function createWindowsLauncher({ isElevated, spawn = childProcess.spawn, execFile = childProcess.execFile, platform = process.platform } = {}) {
  function elevate(executablePath, workingDir, args) {
    const script = buildElevationScript(executablePath, workingDir, args);
    const encoded = Buffer.from(script, 'utf16le').toString('base64');
    const powershell = path.win32.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    return new Promise(resolve => {
      execFile(powershell, ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], { windowsHide: true }, (error, _stdout, stderr) => {
        resolve(error ? { success: false, error: String(stderr || error.message).trim() } : { success: true });
      });
    });
  }
  async function launch(executablePath, workingDir, args = [], { requireElevation = true } = {}) {
    try {
      if (platform === 'win32' && requireElevation && !isElevated()) {
        return await elevate(executablePath, workingDir, args);
      }
      return await new Promise(resolve => {
        const child = spawn(executablePath, args, {
          cwd: workingDir, shell: false, windowsHide: true, detached: true, stdio: 'ignore'
        });
        child.once('error', error => resolve({ success: false, error: error.message }));
        child.once('spawn', () => {
          child.unref();
          resolve({ success: true, pid: child.pid });
        });
      });
    } catch (error) {
      return { success: false, error: error.message || String(error) };
    }
  }
  return { launch };
}
module.exports = { createWindowsLauncher, getDirectLaunchMode, quoteWindowsArgument, buildElevationScript };
