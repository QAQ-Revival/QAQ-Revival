const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
module.exports = async ({ evaluate, waitFor, captureUI, root, setSelection, passed }) => {
  await evaluate(`localStorage.setItem('batch-import-guide-dismissed', 'true')`);
  async function importFixture(name, target, confirm = false) {
    const source = path.join(root, 'manual-group-import', name);
    const bytes = '[TextureOverrideImportFixture]\nhash = deadbeef\n';
    fs.mkdirSync(source, { recursive: true });
    fs.writeFileSync(path.join(source, 'mod.ini'), bytes);
    setSelection({ canceled: false, filePaths: [source] });
    await evaluate(`document.querySelector('.batch-import-trigger-btn').click()`);
    await waitFor(`!!document.querySelector('.batch-import-overlay')`, 'import preview');
    await evaluate(`[...document.querySelectorAll('.batch-import-overlay button')].find(button => button.textContent.includes('开始分析')).click()`);
    await waitFor(`!!document.querySelector('[aria-label="导入目标分组"]')`, 'classification');
    const previous = await evaluate(`document.querySelector('[aria-label="导入目标分组"]').value`);
    if (!name.startsWith('安可')) assert.equal(previous, '');
    else assert.equal(previous, '安可');
    await evaluate(`(() => { const input = document.querySelector('[aria-label="导入目标分组"]'); input.focus(); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(target)}); input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    if (confirm) await evaluate(`document.querySelector('[aria-label="导入目标分组"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))`);
    if (target === '测试') await captureUI('import-custom-group.png');
    await evaluate(`[...document.querySelectorAll('.batch-import-overlay button')].find(button => button.textContent.includes('开始安装')).click()`);
    await waitFor(`!!document.querySelector('.batch-import-done-summary')`, 'import completes');
    assert.match(await evaluate(`document.querySelector('.batch-import-done-summary').textContent`), /1 个成功，0 个失败/);
    const expected = target.trim() || '其他';
    assert.equal(await evaluate(`document.querySelector('.batch-import-result-char').textContent`), expected);
    assert.equal(fs.readFileSync(path.join(root, 'wuwa-mods', expected, name, 'mod.ini'), 'utf8'), bytes);
    if (expected !== '其他') assert.equal(fs.existsSync(path.join(root, 'wuwa-mods', '其他', name)), false);
    await evaluate(`[...document.querySelectorAll('.batch-import-overlay button')].find(button => button.textContent.trim() === '完成').click()`);
    await waitFor(`!document.querySelector('.batch-import-overlay')`, 'import dismissed');
  }
  await importFixture('UnmappedImportAlpha', '测试'); // No Enter/option selection: typing alone must be sufficient.
  await importFixture('安可_ImportBeta', ' 新分组 ', true); // Editing an automatic match overrides it.
  await importFixture('UnmappedImportGamma', ''); // Intentionally blank still uses the fallback.
  passed('Real import: unknown grouping honors a typed new name without Enter, edited automatic matches honor trimmed names, and only blank input falls back to 其他');
};
