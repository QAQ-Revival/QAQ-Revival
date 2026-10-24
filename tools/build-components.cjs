const fs = require('node:fs');
const path = require('node:path');
const components = require('./component-repositories.json');
const root = path.resolve(__dirname, '..');

function buildComponent(target, { test = false } = {}) {
  const component = Object.values(components).find(entry => Object.hasOwn(entry.targets, target));
  if (!component) throw Error('Unknown native build target: ' + target);
  const options = { ...component.targets[target], test };
  for (const key of ['output', 'testOutput', 'work', 'upstream']) if (options[key]) options[key] = path.join(root, options[key]);
  if (options.upstream && component.dependencies?.length === 1) {
    const ownDependency = path.join(root, component.source, component.dependencies[0].path);
    if (fs.existsSync(ownDependency)) options.upstream = ownDependency;
  }
  if (target === 'mega-worker' && test) options.output = options.testOutput;
  return require(path.join(root, component.source, component.build)).build(options);
}

if (require.main === module) {
  const target = process.argv.slice(2).find(arg => !arg.startsWith('--'));
  const targets = target ? [target] : Object.values(components).flatMap(entry => Object.keys(entry.targets));
  for (const name of targets) buildComponent(name, { test: process.argv.includes('--test') });
}
module.exports = { buildComponent };
