const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const workspace = path.resolve(__dirname, '../../..');
const destination = path.join(workspace, '.cache/roslyn-4.14.0');

async function main() {
  if (fs.existsSync(path.join(destination, 'tasks/net472/csc.exe'))) {
    return;
  }
  const url = 'https://api.nuget.org/v3-flatcontainer/microsoft.net.compilers.toolset/4.14.0/microsoft.net.compilers.toolset.4.14.0.nupkg';
  const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!response.ok) {
    throw Error('Official C# compiler download failed: ' + response.status);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  const AdmZip = require(path.join(workspace, 'app/node_modules/adm-zip'));
  const zip = new AdmZip(bytes);
  for (const entry of zip.getEntries()) {
    const target = path.resolve(destination, entry.entryName);
    const relative = path.relative(destination, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw Error('Compiler archive path escaped the cache directory');
    }
  }
  fs.mkdirSync(destination, { recursive: true });
  zip.extractAllTo(destination, false);
  fs.writeFileSync(path.join(destination, 'download.json'), JSON.stringify({ url, sha256: crypto.createHash('sha256').update(bytes).digest('hex') }, null, 2));
}
main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
