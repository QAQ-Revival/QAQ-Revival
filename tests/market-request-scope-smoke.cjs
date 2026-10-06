const assert = require('node:assert/strict');
const path = require('node:path');
module.exports = async ({ evaluate, waitFor, window, passed }) => {
  const requests = [];
  const originalFetch = global.fetch;
  global.fetch = async address => {
    const url = new URL(address);
    requests.push(url.pathname);
    const gameId = url.searchParams.get('gameId') || 'wuthering-waves';
    return new Response(JSON.stringify({ success: true, version: 'scope-v1', marketVersion: 'scope-v1', timestamp: new Date().toISOString(),
      mods: [{ id: 'scope-fixture', name: 'Scope fixture', characterName: '安可', gameId, downloadUrl: 'https://example.invalid/mod.zip' }] }), { headers: { 'content-type': 'application/json' } });
  };
  if (!window.webContents.debugger.isAttached()) window.webContents.debugger.attach('1.3');
  await window.webContents.debugger.sendCommand('Page.enable');
  const script = await window.webContents.debugger.sendCommand('Page.addScriptToEvaluateOnNewDocument', { source: `
    const polls = new Map(); const requests = []; let timerId = -100;
    const originalSetTimeout = window.setTimeout.bind(window), originalClearTimeout = window.clearTimeout.bind(window);
    window.setTimeout = (callback, delay, ...args) => {
      if (callback?.name === 'pollMarket') { const id = timerId--; polls.set(id, callback); return id; }
      return originalSetTimeout(callback, delay, ...args);
    };
    window.clearTimeout = id => { polls.delete(id); originalClearTimeout(id); };
    document.hasFocus = () => true;
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    window.fetch = async address => {
      const pathname = new URL(address, location.href).pathname; requests.push(pathname);
      const data = ['/api/announcements', '/api/blocks'].includes(pathname)
        ? { success: true, announcements: [{ id: 'retired-announcement', title: 'REMOTE_OPERATIONS_FIXTURE' }], blocks: [{ id: 'retired-banner', type: 'banner', title: 'REMOTE_OPERATIONS_FIXTURE', config: { linkUrl: 'https://example.invalid/promotion' } }] }
        : { success: true, versions: [], popular: [], likedModIds: [], counts: {} };
      return new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
    };
    window.__marketScope = { polls, requests, runPoll: async () => { const first = polls.entries().next().value; if (!first) throw Error('No active poll'); polls.delete(first[0]); await first[1](); } };
  ` });
  const pause = () => new Promise(resolve => setTimeout(resolve, 1200));
  async function selectSource(source) {
    await evaluate(`document.querySelector('.mod-download-source-trigger').click()`);
    await waitFor(`!!document.querySelector('.mod-download-source-option[data-source="${source}"]')`, 'source menu');
    await evaluate(`document.querySelector('.mod-download-source-option[data-source="${source}"]').click()`);
    await waitFor(`document.querySelector('.mod-download-provider:not([hidden])')?.dataset.source === '${source}'`, 'source ' + source);
  }
  async function expectQuiet(label) {
    const mainCount = requests.length;
    const rendererCount = await evaluate('window.__marketScope.requests.length');
    await pause();
    assert.equal(requests.length, mainCount, label + ': main must not request');
    assert.equal(await evaluate('window.__marketScope.requests.length'), rendererCount, label + ': renderer must not request');
    assert.equal(await evaluate('window.__marketScope.polls.size'), 0, label + ': polling stopped');
  }
  try {
    await window.loadFile(path.join(process.resourcesPath, 'app/out/renderer/index.html'));
    await waitFor(`!!document.querySelector('.nav-item[aria-label="MOD下载"]')`, 'scope test loaded');
    await expectQuiet('startup on character list');
    assert.deepEqual(requests, []);
    assert.deepEqual(await evaluate('window.__marketScope.requests'), []);
    await evaluate(`document.querySelector('.nav-item[aria-label="MOD下载"]').click()`);
    await waitFor(`document.querySelector('.mod-download-provider:not([hidden])')?.dataset.source === 'qaqm' && window.__marketScope.polls.size > 0`, 'active QAQM schedules polling');
    await waitFor(`document.querySelectorAll('.mod-card').length > 0`, 'market mock response');
    await pause();
    assert.ok(requests.includes('/api/mods'));
    const rendererRequests = await evaluate('window.__marketScope.requests');
    for (const pathname of ['/api/announcements', '/api/blocks']) assert.equal(rendererRequests.includes(pathname), false, pathname + ' must stay retired');
    for (const pathname of ['/api/mods/game-versions', '/api/mods/popular/today', '/api/mods/popular/week', '/api/mods/popular/month']) assert.ok(rendererRequests.includes(pathname), pathname + ' still supports market filters and sorting');
    assert.equal(await evaluate(`!!document.querySelector('.announcements-area, .dynamic-blocks-area') || document.body.textContent.includes('REMOTE_OPERATIONS_FIXTURE')`), false);
    passed('QAQM market no longer requests or renders remote announcements and banners; game versions and popularity remain available');
    await evaluate('window.__marketScope.runPoll().then(() => true)');
    assert.ok(requests.includes('/api/mods/sync-version'));
    await selectSource('kemono');
    await expectQuiet('Kemono selected');
    await evaluate(`window.api.gameSwitch('zzz')`);
    await waitFor(`document.querySelector('.game-selector-trigger').textContent.includes('绝区零')`, 'game changed outside QAQM');
    await expectQuiet('game change while QAQM hidden');
    const before = requests.length;
    await selectSource('qaqm');
    await pause();
    assert.ok(requests.length > before, 'returning to QAQM resumes sync');
    // A probe that fails after leaving the page must not try fallback hosts.
    const respondingFetch = global.fetch;
    let rejectProbe;
    global.fetch = (address, options) => {
      if (new URL(address).pathname === '/api/mods/sync-version') {
        requests.push('/api/mods/sync-version');
        return new Promise((_, reject) => { rejectProbe = reject; });
      }
      return respondingFetch(address, options);
    };
    const pendingPoll = evaluate('window.__marketScope.runPoll().then(() => true)');
    for (let i = 0; i < 40 && !rejectProbe; i++) await new Promise(resolve => setTimeout(resolve, 50));
    assert.ok(rejectProbe, 'probe is in flight');
    await evaluate(`document.querySelector('.sidebar-settings').click()`);
    await waitFor(`!!document.querySelector('.system-settings')`, 'leave downloads');
    const pendingCount = requests.length;
    rejectProbe(new Error('Synthetic failed probe after leaving QAQM'));
    await pendingPoll;
    assert.equal(requests.length, pendingCount, 'a retired poll must not try fallback hosts');
    await expectQuiet('settings page');
    passed('QAQM request scope: no startup requests or poll; active QAQM syncs/polls, switching source, leaving page and changing game while hidden stop automatic requests');
  } finally {
    global.fetch = originalFetch;
    await window.webContents.debugger.sendCommand('Page.removeScriptToEvaluateOnNewDocument', { identifier: script.identifier });
  }
};
