const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'app/src');
const output = path.join(root, 'app/out');

async function buildApp() {
  // Keep Node modules unbundled so native dependencies and adjacent resources retain their paths.
  for (const name of ['main', 'preload', 'shared']) {
    const destination = path.join(output, name);
    fs.rmSync(destination, { recursive: true, force: true });
    fs.cpSync(path.join(source, name), destination, { recursive: true });
  }
  const { build } = await import('vite');
  await build({ configFile: path.join(root, 'vite.config.mjs') });
}

if (require.main === module) {
  buildApp().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { buildApp };
