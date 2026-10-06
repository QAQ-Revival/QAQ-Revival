const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { wrap } = require('node:module');

const entry = path.resolve(__dirname, '../app/out/main/index.js');
const source = fs.readFileSync(entry, 'utf8');

for (const override of [undefined, path.resolve('test-results/single-instance-profile')]) {
  test(`duplicate launch exits before services, dialogs or windows (${override ? 'test' : 'shared'} profile)`, () => {
    const paths = { appData: path.resolve('test-results/AppData') };
    const expected = override || path.join(paths.appData, 'QAQ-Revival');
    let locked = false;
    let quit = false;
    const app = {
      getPath: name => paths[name],
      setPath: (name, value) => { paths[name] = value; },
      setName() {},
      requestSingleInstanceLock() {
        assert.equal(paths.userData, expected);
        assert.equal(paths.sessionData, expected);
        locked = true;
        return false;
      },
      quit() { quit = true; }
    };
    const load = name => {
      if (name === 'electron') return { app };
      if (name === 'path') return path;
      if (name === 'fs') return { mkdirSync: directory => assert.equal(directory, expected) };
      assert.fail(`Duplicate instance initialized a dependency: ${name}`);
    };
    const run = vm.runInNewContext(wrap(source), { process: { env: { QAQM_USER_DATA: override } } }, { filename: entry });
    run({}, load, { exports: {} }, entry, path.dirname(entry));
    assert.equal(locked, true);
    assert.equal(quit, true);
  });
}
