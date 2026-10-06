const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { REPOSITORY, saveRegistration } = require('./github-app-auth.cjs');
const state = crypto.randomBytes(32).toString('hex');
const root = path.resolve(__dirname, '..');
const statusFile = path.join(root, '.cache/github-app-setup.json');
let origin, manifest, stage = 'ready', registration;
function record() {
  fs.mkdirSync(path.dirname(statusFile), { recursive: true });
  fs.writeFileSync(statusFile, JSON.stringify({ url: origin, stage, ...registration }, null, 2));
}
const escape = value => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const server = http.createServer(async (request, response) => {
  if (request.headers.host !== new URL(origin).host) { response.writeHead(403); response.end(); return; }
  const url = new URL(request.url, origin);
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('X-Frame-Options', 'DENY');
  if (request.method !== 'GET') { response.writeHead(405); response.end(); return; }
  if (url.pathname === '/') {
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>QAQ-Revival 发布身份</title><body style="max-width:720px;margin:64px auto;font:17px/1.7 system-ui;color:#263238"><h1>配置项目发布机器人</h1><p>App 名称：<strong>QAQ-Revival Publisher</strong></p><p>所属组织：QAQ-Revival。创建为私有 App，安装时仅选择 <strong>${REPOSITORY}</strong>。</p><ul><li>Contents：读写（推送代码和标签）</li><li>Workflows：读写（更新 CI 文件）</li><li>Metadata：只读（GitHub 必需权限）</li><li>不订阅 webhook，不申请个人账号授权</li></ul><p>私钥将使用当前 Windows 账户加密保存在本机应用数据目录中，不写入仓库、不显示在聊天里。</p><form method="post" action="https://github.com/organizations/QAQ-Revival/settings/apps/new?state=${state}"><input type="hidden" name="manifest" value="${escape(JSON.stringify(manifest))}"><button style="padding:12px 20px;font:inherit">继续到 GitHub 确认</button></form></body></html>`);
    return;
  }
  if (url.pathname === '/callback') {
    if (url.searchParams.get('state') !== state || !/^[a-zA-Z0-9_-]+$/.test(url.searchParams.get('code') || '') || stage !== 'ready') { response.writeHead(400); response.end('Invalid registration callback'); return; }
    stage = 'saving'; record();
    try {
      const result = await fetch(`https://api.github.com/app-manifests/${url.searchParams.get('code')}/conversions`, { method: 'POST', headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'QAQ-Revival-publisher' }, signal: AbortSignal.timeout(20000) });
      if (!result.ok) throw Error(`GitHub registration failed (HTTP ${result.status})`);
      registration = saveRegistration(await result.json());
      stage = 'created'; record();
      response.writeHead(303, { Location: '/ready' }); response.end();
    } catch { stage = 'failed'; record(); response.writeHead(500); response.end('Registration could not be stored. No credentials have been displayed.'); }
    return;
  }
  if (url.pathname === '/ready' && registration) {
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>发布机器人已创建</title><body style="max-width:720px;margin:64px auto;font:17px/1.7 system-ui"><h1>发布机器人已创建</h1><p>身份：<strong>${escape(registration.slug)}[bot]</strong></p><p>私钥已加密保存。下一步仅为项目仓库安装这个 App。</p><a href="https://github.com/apps/${registration.slug}/installations/new">前往 GitHub 安装</a></body></html>`);
    return;
  }
  response.writeHead(404); response.end();
});
server.listen(0, '127.0.0.1', () => {
  origin = `http://127.0.0.1:${server.address().port}`;
  manifest = { name: 'QAQ-Revival Publisher', url: `https://github.com/${REPOSITORY}`, description: 'Repository-scoped publishing automation.',
    redirect_url: `${origin}/callback`, public: false, default_permissions: { contents: 'write', workflows: 'write' }, default_events: [], request_oauth_on_install: false };
  record(); console.log('GitHub App setup: ' + origin);
});
server.on('error', () => { console.error('Could not start local setup'); process.exitCode = 1; });
